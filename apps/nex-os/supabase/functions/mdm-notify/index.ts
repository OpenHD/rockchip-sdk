// NEX MDM — envío de avisos (Telegram + email) desde la cola mdm_notifications.
//
// Jobs (todos POST):
//   ?job=tick      cada minuto (pg_cron): detecta equipos sin conexión y envía avisos pendientes.
//   ?job=digest    una vez por día: encola el resumen de intentos de piratería.
//   ?job=telegram  webhook del bot: responde /id con el ID del chat para configurarlo en el panel.
//
// Secretos (supabase secrets set ...):
//   MDM_CRON_SECRET          header x-mdm-cron-secret de los jobs programados
//   TELEGRAM_BOT_TOKEN       bot de NEX (@BotFather)
//   TELEGRAM_WEBHOOK_SECRET  secret_token configurado en setWebhook
//   RESEND_API_KEY, MDM_EMAIL_FROM   envío de email (https://resend.com)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
//
// Deploy: supabase functions deploy mdm-notify --no-verify-jwt
// (la autenticación es por secreto propio: el cron y Telegram no tienen JWT de usuario).

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
};

const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const MAX_ATTEMPTS = 5;
const BATCH = 50;

interface OutboxRow {
  id: number;
  company_id: string;
  channel: 'telegram' | 'email';
  subject: string | null;
  body: string | null;
  attempts: number;
}

interface CompanyAlerts {
  id: string;
  alert_telegram_chat_id: string | null;
  alert_emails: string[];
}

/** Comparación en tiempo constante: no filtra cuántos caracteres del secreto coinciden. */
function safeEqual(a: string | null, b: string): boolean {
  if (a === null || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Texto plano (sin parse_mode): los nombres de equipos los escribe el cliente, no se interpretan.
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendEmail(to: string[], subject: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    // Solo texto: sin HTML no hay inyección de contenido.
    body: JSON.stringify({ from: env('MDM_EMAIL_FROM'), to, subject: subject.slice(0, 200), text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function deliverPending(): Promise<{ sent: number; failed: number }> {
  // Libera avisos tomados por un worker que murió a mitad de camino.
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  await rest(`mdm_notifications?status=eq.sending&claimed_at=lt.${stale}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pending' }),
  });

  const pending = (await rest(
    `mdm_notifications?status=eq.pending&order=created_at.asc&limit=${BATCH}` +
      '&select=id,company_id,channel,subject,body,attempts',
    { method: 'GET' },
  )) as OutboxRow[];
  if (pending.length === 0) return { sent: 0, failed: 0 };

  const ids = [...new Set(pending.map((n) => n.company_id))].join(',');
  const companies = (await rest(
    `mdm_companies?id=in.(${ids})&select=id,alert_telegram_chat_id,alert_emails`,
    { method: 'GET' },
  )) as CompanyAlerts[];
  const byId = new Map(companies.map((c) => [c.id, c]));

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    // Toma atómica: si otro worker ya la tomó, la respuesta viene vacía.
    const claimed = (await rest(`mdm_notifications?id=eq.${n.id}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sending', claimed_at: new Date().toISOString() }),
    })) as unknown[];
    if (claimed.length === 0) continue;

    const company = byId.get(n.company_id);
    try {
      const text = n.body ?? n.subject ?? '';
      if (n.channel === 'telegram') {
        if (!company?.alert_telegram_chat_id) throw new Error('Telegram no configurado');
        await sendTelegram(company.alert_telegram_chat_id, text);
      } else {
        if (!company?.alert_emails?.length) throw new Error('Sin emails configurados');
        await sendEmail(company.alert_emails, n.subject ?? 'Aviso NEX MDM', text);
      }
      await rest(`mdm_notifications?id=eq.${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), attempts: n.attempts + 1 }),
      });
      sent++;
    } catch (err) {
      const attempts = n.attempts + 1;
      await rest(`mdm_notifications?id=eq.${n.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempts,
          last_error: String((err as Error).message).slice(0, 300),
        }),
      });
      failed++;
    }
  }
  return { sent, failed };
}

async function queueDigest(): Promise<number> {
  const rows = (await rest('rpc/mdm_piracy_digest', { method: 'POST', body: '{}' })) as
    { company_id: string; body: string }[];
  if (!rows?.length) return 0;
  const companies = (await rest(
    `mdm_companies?id=in.(${rows.map((r) => r.company_id).join(',')})&select=id,alert_telegram_chat_id,alert_emails`,
    { method: 'GET' },
  )) as CompanyAlerts[];
  const inserts = companies.flatMap((c) => {
    const body = rows.find((r) => r.company_id === c.id)?.body ?? '';
    const out = [];
    if (c.alert_telegram_chat_id) out.push({ company_id: c.id, channel: 'telegram', subject: 'Resumen de piratería', body });
    if (c.alert_emails.length) out.push({ company_id: c.id, channel: 'email', subject: 'Resumen diario de piratería', body });
    return out;
  });
  if (inserts.length) await rest('mdm_notifications', { method: 'POST', body: JSON.stringify(inserts) });
  return inserts.length;
}

async function telegramWebhook(req: Request): Promise<Response> {
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), env('TELEGRAM_WEBHOOK_SECRET'))) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const text: string = msg?.text ?? '';
  if (msg?.chat?.id !== undefined && /^\/(id|start)(@\w+)?\b/.test(text)) {
    await sendTelegram(
      String(msg.chat.id),
      `ID de este chat: ${msg.chat.id}\nCopialo en el panel NEX MDM → Avisos → Telegram.`,
    );
  }
  return new Response('ok');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const job = new URL(req.url).searchParams.get('job');

  try {
    if (job === 'telegram') return await telegramWebhook(req);

    if (!safeEqual(req.headers.get('x-mdm-cron-secret'), env('MDM_CRON_SECRET'))) {
      return new Response('forbidden', { status: 403 });
    }
    if (job === 'tick') {
      const offline = await rest('rpc/mdm_check_offline', { method: 'POST', body: '{}' });
      const result = await deliverPending();
      return Response.json({ offline, ...result });
    }
    if (job === 'digest') {
      const queued = await queueDigest();
      await rest('rpc/mdm_purge_old_events', { method: 'POST', body: '{}' });
      return Response.json({ queued });
    }
    return new Response('unknown job', { status: 400 });
  } catch (err) {
    console.error(err);
    // Sin detalles al exterior.
    return new Response('error', { status: 500 });
  }
});
