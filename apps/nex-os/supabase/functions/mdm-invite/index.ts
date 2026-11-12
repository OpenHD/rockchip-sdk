// NEX MDM — invitar a un miembro por email (ver schema-mdm-v14.sql).
//
// POST { company, email, role }  con el JWT del dueño de la empresa (Authorization: Bearer …).
// 1. mdm_invite_precheck con el JWT del dueño: rol dueño, 2FA reciente (P0401), email y límite de invitaciones.
// 2. Si el email no tiene cuenta, POST /auth/v1/invite con la clave de servicio: Supabase manda el email con el link
//    al panel (MDM_PANEL_URL); ahí la persona define su contraseña y activa el segundo factor.
// 3. mdm_set_member con el JWT del dueño (queda auditado con su usuario).
//
// Secretos: MDM_PANEL_URL (ej. https://nex-mdm-demo.vercel.app/admin, debe estar en Auth > URL Configuration).
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
// Deploy: supabase functions deploy mdm-invite   (con verificación de JWT)

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
};

const SUPABASE_URL = env('SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const PANEL_URL = Deno.env.get('MDM_PANEL_URL') ?? 'https://nex-mdm-demo.vercel.app/admin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** RPC con el JWT de quien llama: los permisos y la auditoría son los suyos. */
async function rpcAsCaller(auth: string, fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Método no permitido' });
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return reply(401, { message: 'Sin sesión' });

  let body: { company?: string; email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { message: 'Pedido inválido' });
  }
  const company = String(body.company ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? '');
  if (!/^[0-9a-f-]{36}$/.test(company)) return reply(400, { message: 'Empresa inválida' });

  const pre = await rpcAsCaller(auth, 'mdm_invite_precheck', { p_company: company, p_email: email, p_role: role });
  if (!pre.ok) {
    // Se pasa el código de Postgres (P0401 = falta el 2FA reciente) para que el panel pida el código y reintente.
    return reply(pre.status === 401 ? 401 : 400, { code: pre.data?.code, message: pre.data?.message ?? 'Sin permiso' });
  }

  let invited = false;
  if (!pre.data?.exists) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/invite?redirect_to=${encodeURIComponent(PANEL_URL)}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = res.status === 429 ? 'Se mandaron muchos emails seguidos. Probá en unos minutos.' : (err.msg ?? err.message ?? 'No se pudo mandar la invitación');
      return reply(502, { message: msg });
    }
    invited = true;
  }

  const set = await rpcAsCaller(auth, 'mdm_set_member', { p_company: company, p_email: email, p_role: role });
  if (!set.ok) return reply(400, { code: set.data?.code, message: set.data?.message ?? 'No se pudo sumar al miembro' });
  return reply(200, { invited });
});
