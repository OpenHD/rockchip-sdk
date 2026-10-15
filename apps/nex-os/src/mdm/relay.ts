/**
 * Pedidos de la UI al agente (CGI local, ver docs/GESTION_REMOTA.md).
 * El relay solo encola: responde 202 y el resultado aparece después en ui-state.json.
 * Content-Type JSON es obligatorio (fuerza el preflight CORS: otra página no puede mandarlo).
 */
const RELAY_URL = '/cgi-bin/nex';
const TIMEOUT_MS = 8000;
const MAX_BODY = 1024;

export type RelayRequest =
  | { action: 'wifi_scan' }
  | { action: 'wifi_connect'; ssid: string; psk: string }
  | { action: 'wifi_forget' }
  | { action: 'unlock_code'; code: string };

export type RelayResult = { ok: true } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  timeout: 'El equipo no respondió. Probá de nuevo.',
  network: 'No se pudo hablar con el equipo. Probá de nuevo en unos segundos.',
  too_large: 'El dato es demasiado largo.',
  busy: 'El equipo está ocupado. Probá de nuevo en unos segundos.',
  rate_limited: 'Demasiados intentos. Esperá unos minutos.',
  invalid_psk: 'La contraseña tiene que tener entre 8 y 63 caracteres.',
  invalid_ssid: 'Nombre de red inválido.',
  invalid_code: 'El código tiene que tener 8 dígitos.',
  // Códigos del CGI (device/.../nex-os/cgi-nex).
  invalid: 'Datos inválidos. Revisalos y probá de nuevo.',
  agent: 'El sistema del equipo todavía está iniciando. Probá de nuevo en unos segundos.',
  length: 'El dato es demasiado largo.',
  origin: 'Pedido rechazado por seguridad.',
  content_type: 'Pedido rechazado por seguridad.',
  method: 'Pedido rechazado por seguridad.',
};

export function relayErrorText(code: string): string {
  return ERRORS[code] ?? `El equipo rechazó el pedido (${code.slice(0, 40)}).`;
}

/** Contraseña Wi-Fi aceptada por el agente: vacía (red abierta) o 8–63 ASCII imprimible. */
export function isValidPsk(psk: string): boolean {
  return psk === '' || (psk.length >= 8 && psk.length <= 63 && /^[\x20-\x7e]+$/.test(psk));
}

export async function sendRelay(req: RelayRequest): Promise<RelayResult> {
  const body = JSON.stringify(req);
  if (new TextEncoder().encode(body).length > MAX_BODY) return { ok: false, error: 'too_large' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      signal: ctrl.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Respuesta sin JSON: se decide solo por el status.
    }
    const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    if (res.ok && o.ok !== false) return { ok: true };
    const error = typeof o.error === 'string' && o.error ? o.error.slice(0, 60) : res.status === 429 ? 'rate_limited' : `http_${res.status}`;
    return { ok: false, error };
  } catch (err) {
    return { ok: false, error: (err as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
