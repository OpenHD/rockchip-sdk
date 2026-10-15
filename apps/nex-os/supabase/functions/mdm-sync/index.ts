// NEX MDM — sync firmado del equipo (v8).
//
// POST /functions/v1/mdm-sync   (Authorization: Bearer <anon key>, igual que antes el RPC)
// Body: el mismo JSON que iba a rpc/mdm_device_sync (p_token, p_firmware, p_status, p_events, p_hardware_id).
//
// Reenvía a rpc/mdm_device_sync con las credenciales del que llama (anon: el RPC autentica por token de equipo).
// Si el equipo está vinculado, devuelve la configuración firmada:
//   {"status":"paired","payload":"<string JSON>","sig":"<base64 RS256 sobre los bytes de payload>"}
// payload = resultado del RPC + kind:"nex-config", v:1, attestation:<JWT RS256 | null>.
// El equipo verifica con /etc/nex-agent/mdm-sign.pub.pem y rechaza configuración sin firma válida.
// Cualquier otro estado (unpaired, unknown) se devuelve tal cual: no da permisos.
//
// Secretos (supabase secrets set ...):
//   NEX_SIGNING_KEY   clave privada MDM RSA-3072, PKCS8 PEM (tools/nex-os/keys/gen-mdm-sign-key.sh)
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase.
//
// Deploy: supabase functions deploy mdm-sync   (con verificación de JWT: el equipo manda la anon key)

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MAX_BODY = 32 * 1024;
const ATTESTATION_TTL = 6 * 3600;
const FORWARDED = ['p_token', 'p_firmware', 'p_status', 'p_events', 'p_hardware_id'] as const;

// ---------------------------------------------------------------------------
// Firma (WebCrypto, RSASSA-PKCS1-v1_5 SHA-256)
// ---------------------------------------------------------------------------

interface SigningKey {
  key: CryptoKey;
  kid: string;
}

let signingKey: Promise<SigningKey> | null = null;

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** PKCS8 PEM → DER. Acepta saltos de línea escapados ("\n" literal) por cómo se cargan algunos secretos. */
function pkcs8Der(pem: string): ArrayBuffer {
  const text = pem.replace(/\\n/g, '\n').trim();
  const m = text.match(/^-----BEGIN PRIVATE KEY-----([A-Za-z0-9+/=\s]+)-----END PRIVATE KEY-----$/);
  if (!m) throw new Error('NEX_SIGNING_KEY debe ser una clave privada PKCS8 PEM (BEGIN PRIVATE KEY)');
  const bin = atob(m[1].replace(/\s+/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

async function loadSigningKey(): Promise<SigningKey> {
  const pem = Deno.env.get('NEX_SIGNING_KEY');
  if (!pem) throw new Error('Falta el secreto NEX_SIGNING_KEY');
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const der = pkcs8Der(pem);
  // Importación exportable solo para derivar la pública (kid); la que firma no es exportable.
  const full = await crypto.subtle.importKey('pkcs8', der, alg, true, ['sign']);
  const jwk = (await crypto.subtle.exportKey('jwk', full)) as JsonWebKey;
  if (!jwk.n || atob(jwk.n.replace(/-/g, '+').replace(/_/g, '/')).length < 384) {
    throw new Error('NEX_SIGNING_KEY debe ser RSA de 3072 bits o más');
  }
  const pub = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, ext: true }, alg, true, ['verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pub));
  const kid = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', spki))).slice(0, 16);
  const key = await crypto.subtle.importKey('pkcs8', der, alg, false, ['sign']);
  return { key, kid };
}

function getSigningKey(): Promise<SigningKey> {
  if (!signingKey) {
    signingKey = loadSigningKey();
    signingKey.catch(() => (signingKey = null)); // reintenta en la próxima request si el secreto estaba mal
  }
  return signingKey;
}

async function sign(key: CryptoKey, data: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data)));
}

/** JSON con todo lo no-ASCII escapado (\uXXXX): el string firmado es ASCII puro y no depende de cómo
 *  cada herramienta del equipo (jq, shell) maneje UTF-8. Sigue siendo el mismo JSON. */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

async function attestation(sk: SigningKey, result: Record<string, unknown>): Promise<string | null> {
  if (result.attestation_eligible !== true) return null;
  const device = result.device as { id?: unknown } | null;
  const company = result.company as { id?: unknown } | null;
  if (typeof device?.id !== 'string' || typeof company?.id !== 'string') return null;
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sk.kid };
  const claims = {
    iss: 'nex-mdm',
    aud: 'nex-services',
    sub: device.id,
    cid: company.id,
    ref: typeof result.external_ref === 'string' ? result.external_ref : null,
    st: 'active',
    iat,
    exp: iat + ATTESTATION_TTL,
  };
  const enc = new TextEncoder();
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claims)))}`;
  return `${input}.${b64url(await sign(sk.key, input))}`;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

/** Lee el cuerpo cortando en max bytes (no confía en Content-Length). null = demasiado grande. */
async function readBody(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (!SUPABASE_URL) throw new Error('Falta SUPABASE_URL');

  let text: string | null;
  try {
    text = await readBody(req, MAX_BODY);
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (text === null) return json({ error: 'body_too_large' }, 413);

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return json({ error: 'invalid_body' }, 400);
  const body = input as Record<string, unknown>;
  if (typeof body.p_token !== 'string') return json({ error: 'invalid_body' }, 400);
  // Solo los parámetros conocidos: evita que PostgREST elija otra sobrecarga o reciba basura.
  const forward: Record<string, unknown> = {};
  for (const k of FORWARDED) if (k in body) forward[k] = body[k];

  const apikey = req.headers.get('apikey') ?? ANON_KEY;
  const auth = req.headers.get('authorization') ?? (ANON_KEY ? `Bearer ${ANON_KEY}` : '');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mdm_device_sync`, {
    method: 'POST',
    headers: { apikey, Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(forward),
  });
  const resText = await res.text();
  if (!res.ok) {
    // Errores del RPC (token mal formado, rate limit): mismo status y cuerpo que el RPC directo.
    // Errores del servidor: genérico, sin detalles.
    if (res.status >= 500) return json({ error: 'upstream_error' }, 502);
    return json(resText || '{}', res.status);
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(resText);
  } catch {
    return json({ error: 'upstream_error' }, 502);
  }
  if (typeof result !== 'object' || result === null || result.status !== 'paired') {
    return json(resText);
  }

  const sk = await getSigningKey();
  const payload = asciiJson({ ...result, kind: 'nex-config', v: 1, attestation: await attestation(sk, result) });
  const sig = b64(await sign(sk.key, payload));
  return json({ status: 'paired', payload, sig });
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (err) {
    // Solo el mensaje: nunca el cuerpo (trae el token del equipo) ni la clave.
    console.error('mdm-sync:', (err as Error)?.message ?? 'error');
    return json({ error: 'internal' }, 500);
  }
});
