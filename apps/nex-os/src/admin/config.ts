/** Opciones de seguridad del panel definidas al compilar. */

/** Registro público apagado por defecto: las cuentas las crea NEX (invitación desde Supabase). */
export const SIGNUP_ENABLED = import.meta.env.VITE_NEX_ADMIN_SIGNUP === '1';

/** Captcha de Cloudflare Turnstile en el login (opcional: solo si hay site key). */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
