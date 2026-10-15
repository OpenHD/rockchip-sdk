// NEX MDM — API para el sistema de cobranza del ISP (servidor a servidor).
//
//   GET  /jwks                                 público: clave para verificar el JWT de atestación
//   GET  /devices?limit=&offset=&ref=          → {devices: [...], limit, offset}
//   GET  /devices/<id>                         → equipo
//   POST /devices/<id>/lock          {reason?}
//   POST /devices/<id>/unlock
//   POST /devices/<id>/paid-until    {paid_until: "YYYY-MM-DD" | null}
//   POST /devices/<id>/external-ref  {external_ref: string | null}
//   POST /devices/<id>/unlock-code             → {code, valid_on, hours}
// <id> = uuid del equipo o ref:<external_ref>.
// Auth: Authorization: Bearer nexk_<43 caracteres base64url>. En la base solo vive sha256(clave).
//
// Secretos: NEX_SIGNING_KEY (para /jwks). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// La service role solo se usa para llamar a las funciones mdm_isp_*, que validan la clave y la empresa adentro.
//
// Deploy: supabase functions deploy isp-api --no-verify-jwt
// (la autenticación es la clave de API propia: el ISP no tiene JWT de Supabase). Sin CORS: no es para navegadores.

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
};

const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const MAX_BODY = 4 * 1024;
const RSA_ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

const KEY_RE = /^Bearer (nexk_[A-Za-z0-9_-]{43})$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

class HttpError extends Error {
  status: number;
  headers: Record<string, string>;
  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

// ---------------------------------------------------------------------------
// JWKS (misma clave MDM que firma la configuración y la atestación)
// ---------------------------------------------------------------------------

function pemToDer(pem: string, label: string): ArrayBuffer {
  const text = pem.replace(/\\n/g, '\n').trim();
  const m = text.match(new RegExp(`^-----BEGIN ${label}-----([A-Za-z0-9+/=\\s]+)-----END ${label}-----$`));
  if (!m) throw new Error(`NEX_SIGNING_KEY no es un PEM "${label}" (PKCS8)`);
  const bin = atob(m[1].replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PublicJwk {
  kty: 'RSA';
  n: string;
  e: string;
  alg: 'RS256';
  use: 'sig';
  kid: string;
}

async function loadJwk(pem: string): Promise<PublicJwk> {
  const privateKey = await crypto.subtle.importKey('pkcs8', pemToDer(pem, 'PRIVATE KEY'), RSA_ALG, true, ['sign']);
  const { modulusLength } = privateKey.algorithm as RsaHashedKeyAlgorithm;
  if (modulusLength < 3072) throw new Error('NEX_SIGNING_KEY debe ser RSA de 3072 bits o más');
  // Solo la parte pública (n, e): el resto del JWK privado se descarta acá.
  const { n, e } = await crypto.subtle.exportKey('jwk', privateKey);
  if (!n || !e) throw new Error('No se pudo derivar la clave pública');
  const publicKey = await crypto.subtle.importKey('jwk', { kty: 'RSA', n, e, ext: true }, RSA_ALG, true, ['verify']);
  const kid = toHex(await crypto.subtle.digest('SHA-256', await crypto.subtle.exportKey('spki', publicKey))).slice(0, 16);
  return { kty: 'RSA', n, e, alg: 'RS256', use: 'sig', kid };
}

let jwkPromise: Promise<PublicJwk> | null = null;
function publicJwk(): Promise<PublicJwk> {
  if (!jwkPromise) {
    jwkPromise = loadJwk(env('NEX_SIGNING_KEY')).catch((err) => {
      jwkPromise = null;
      throw err;
    });
  }
  return jwkPromise;
}

// ---------------------------------------------------------------------------
// Llamadas a la base
// ---------------------------------------------------------------------------

// SQLSTATE de las funciones mdm_isp_* → HTTP. El mensaje de la base solo sale para estos códigos (son nuestros).
const SQLSTATE_HTTP: Record<string, number> = {
  '28000': 401,
  '42501': 403,
  P0002: 404,
  '22023': 400,
  '22007': 400,
  '22008': 400,
  '22P02': 400,
  '23505': 409,
  '53400': 429,
};

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (res.ok) return text ? JSON.parse(text) : null;

  let err: { code?: string; message?: string } = {};
  try {
    err = JSON.parse(text);
  } catch {
    // respuesta no JSON del gateway
  }
  const status = err.code ? SQLSTATE_HTTP[err.code] : undefined;
  if (!status) throw new Error(`PostgREST ${res.status} ${err.code ?? ''}`.trim());
  if (status === 401) throw new HttpError(401, 'Clave de API inválida o revocada', { 'WWW-Authenticate': 'Bearer' });
  if (status === 429) throw new HttpError(429, err.message ?? 'Demasiadas solicitudes', { 'Retry-After': '60' });
  throw new HttpError(status, (err.message ?? 'Error').slice(0, 300));
}

async function keyHash(key: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
}

// ---------------------------------------------------------------------------
// Validación de entrada
// ---------------------------------------------------------------------------

function parseDeviceId(segment: string): string {
  let id: string;
  try {
    id = decodeURIComponent(segment);
  } catch {
    throw new HttpError(400, 'Identificador de equipo inválido');
  }
  if (UUID_RE.test(id)) return id.toLowerCase();
  if (id.startsWith('ref:') && REF_RE.test(id.slice(4))) return id;
  throw new HttpError(400, 'Identificador de equipo inválido (uuid o ref:<referencia>)');
}

function parseIntParam(v: string | null, name: string, min: number, max: number, def: number): number {
  if (v === null || v === '') return def;
  if (!/^\d{1,7}$/.test(v)) throw new HttpError(400, `${name} inválido`);
  const n = Number(v);
  if (n < min || n > max) throw new HttpError(400, `${name} fuera de rango (${min}-${max})`);
  return n;
}

function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Body JSON opcional, objeto plano, solo con las claves permitidas. */
async function readBody(req: Request, allowed: string[]): Promise<Record<string, unknown>> {
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, 'Body demasiado grande');
    }
    chunks.push(value);
  }
  if (total === 0) return {};
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type debe ser application/json');
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf));
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, 'El body debe ser un objeto JSON');
  }
  const extra = Object.keys(parsed).filter((k) => !allowed.includes(k));
  if (extra.length) throw new HttpError(400, `Campos no permitidos: ${extra.slice(0, 5).join(', ')}`);
  return parsed as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

function routeOf(url: URL): string[] {
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('isp-api');
  return i >= 0 ? parts.slice(i + 1) : parts;
}

function requireMethod(req: Request, method: string): void {
  if (req.method !== method) throw new HttpError(405, 'Método no permitido', { Allow: method });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const route = routeOf(url);

  if (route.length === 1 && route[0] === 'jwks') {
    requireMethod(req, 'GET');
    return json(200, { keys: [await publicJwk()] }, { 'Cache-Control': 'public, max-age=300' });
  }
  if (route[0] !== 'devices' || route.length > 3) throw new HttpError(404, 'Ruta inexistente');

  // Auth antes de mirar cualquier otra cosa del pedido.
  const key = req.headers.get('authorization')?.match(KEY_RE)?.[1];
  if (!key) throw new HttpError(401, 'Falta la clave de API (Authorization: Bearer nexk_...)', { 'WWW-Authenticate': 'Bearer' });
  const p_key_hash = await keyHash(key);

  if (route.length === 1) {
    requireMethod(req, 'GET');
    const q = url.searchParams;
    const ref = q.get('ref');
    if (ref !== null && !REF_RE.test(ref)) throw new HttpError(400, 'ref inválido');
    return json(200, await rpc('mdm_isp_list_devices', {
      p_key_hash,
      p_limit: parseIntParam(q.get('limit'), 'limit', 1, 200, 50),
      p_offset: parseIntParam(q.get('offset'), 'offset', 0, 1_000_000, 0),
      p_ref: ref,
    }));
  }

  const p_id = parseDeviceId(route[1]);

  if (route.length === 2) {
    requireMethod(req, 'GET');
    return json(200, await rpc('mdm_isp_get_device', { p_key_hash, p_id }));
  }

  requireMethod(req, 'POST');
  switch (route[2]) {
    case 'lock': {
      const body = await readBody(req, ['reason']);
      const reason = body.reason ?? null;
      if (reason !== null && (typeof reason !== 'string' || reason.length > 280)) {
        throw new HttpError(400, 'reason debe ser texto de hasta 280 caracteres');
      }
      return json(200, await rpc('mdm_isp_set_lock', { p_key_hash, p_id, p_locked: true, p_reason: reason }));
    }
    case 'unlock': {
      await readBody(req, []);
      return json(200, await rpc('mdm_isp_set_lock', { p_key_hash, p_id, p_locked: false, p_reason: null }));
    }
    case 'paid-until': {
      const body = await readBody(req, ['paid_until']);
      if (!('paid_until' in body)) throw new HttpError(400, 'Falta paid_until ("YYYY-MM-DD" o null)');
      const v = body.paid_until;
      if (v !== null && (typeof v !== 'string' || !isValidDate(v))) {
        throw new HttpError(400, 'paid_until debe ser una fecha "YYYY-MM-DD" válida o null');
      }
      return json(200, await rpc('mdm_isp_set_paid_until', { p_key_hash, p_id, p_paid_until: v }));
    }
    case 'external-ref': {
      const body = await readBody(req, ['external_ref']);
      if (!('external_ref' in body)) throw new HttpError(400, 'Falta external_ref (texto o null)');
      const v = body.external_ref;
      if (v !== null && (typeof v !== 'string' || !REF_RE.test(v))) {
        throw new HttpError(400, 'external_ref inválido (1-64 caracteres: letras, números, . _ : @ -)');
      }
      return json(200, await rpc('mdm_isp_set_external_ref', { p_key_hash, p_id, p_external_ref: v }));
    }
    case 'unlock-code': {
      await readBody(req, []);
      return json(200, await rpc('mdm_isp_unlock_code', { p_key_hash, p_id }));
    }
    default:
      throw new HttpError(404, 'Ruta inexistente');
  }
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message }, err.headers);
    // Sin claves, hashes ni bodies en el log.
    console.error('isp-api:', (err as Error)?.message ?? 'error');
    return json(500, { error: 'Error interno' });
  }
});
