/**
 * Links de los emails de Supabase Auth que abren el panel: invitación de un miembro y "Olvidé mi contraseña".
 *
 * Dos formatos:
 * - token_hash (recomendado, plantillas de email editadas): /admin?token_hash=…&type=invite|recovery. El panel lo
 *   canjea con verifyOtp recién cuando la persona aprieta "Continuar", así un antivirus de correo que abra el link
 *   no lo gasta.
 * - implícito (plantillas por defecto): Supabase verifica el link y vuelve con
 *   /admin#access_token=…&refresh_token=…&type=invite|recovery.
 * El cliente del panel tiene detectSessionInUrl: false: solo estos dos tipos se aceptan, y siempre a mano.
 */
export type LinkType = 'invite' | 'recovery';

export type AuthLink =
  | { kind: 'token_hash'; type: LinkType; tokenHash: string }
  | { kind: 'session'; type: LinkType; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

const TYPES: LinkType[] = ['invite', 'recovery'];
const isType = (t: string | null): t is LinkType => TYPES.includes(t as LinkType);

export function parseAuthLink(search: string, hash: string): AuthLink | null {
  const q = new URLSearchParams(search);
  const tokenHash = q.get('token_hash');
  const qType = q.get('type');
  if (tokenHash && isType(qType) && /^[A-Za-z0-9_-]{8,200}$/.test(tokenHash)) {
    return { kind: 'token_hash', type: qType, tokenHash };
  }
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const errorDescription = h.get('error_description') ?? q.get('error_description');
  if (errorDescription) {
    const expired = /expired|invalid/i.test(errorDescription) || h.get('error_code') === 'otp_expired';
    return {
      kind: 'error',
      message: expired
        ? 'El link venció o ya se usó. Pedí uno nuevo con "Olvidé mi contraseña" o pedile al dueño de tu empresa que te invite otra vez.'
        : 'No se pudo abrir el link del email.',
    };
  }
  const accessToken = h.get('access_token');
  const refreshToken = h.get('refresh_token');
  const hType = h.get('type');
  if (accessToken && refreshToken && isType(hType)) {
    return { kind: 'session', type: hType, accessToken, refreshToken };
  }
  return null;
}

/** Quita los parámetros del link de la barra de direcciones (y del historial). */
export function stripAuthLink(): void {
  const url = new URL(window.location.href);
  for (const k of ['token_hash', 'type', 'error', 'error_code', 'error_description']) url.searchParams.delete(k);
  const keepHash = /access_token|error_description/.test(url.hash) ? '' : url.hash;
  window.history.replaceState(null, '', url.pathname + url.search + keepHash);
}

/** Mientras está puesta, el panel pide definir la contraseña antes de entrar (sobrevive a recargar la pestaña). */
const PENDING_KEY = 'nex-mdm-set-password';

export function setPasswordPending(type: LinkType | null): void {
  try {
    if (type) sessionStorage.setItem(PENDING_KEY, type);
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* sin storage: se pide igual en esta carga */
  }
}

export function passwordPending(): LinkType | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    return isType(v) ? v : null;
  } catch {
    return null;
  }
}

/** URL a la que vuelven los links de los emails: siempre el panel en el mismo sitio. */
export function panelUrl(): string {
  return `${window.location.origin}/admin`;
}
