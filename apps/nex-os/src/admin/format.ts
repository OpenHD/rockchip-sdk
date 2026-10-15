/** Utilidades de formato del panel (sin componentes). */

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 5 min", "hace 3 h", "en 2 días". */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return 'nunca';
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return diff <= 0 ? 'recién' : 'en instantes';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return rtf.format(Math.round(diff / (30 * 86_400_000)), 'month');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function daysFromToday(isoDate: string): number {
  const a = new Date(`${todayIso()}T00:00:00Z`).getTime();
  const b = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function formatUptime(seconds: number | undefined): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((seconds % 3600) / 60)} min`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '?').replace(/[·|-]/g, ' ').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const APP_COLORS: Record<string, string> = {
  netflix: 'from-red-600 to-red-800',
  youtube: 'from-red-500 to-rose-700',
  'disney-plus': 'from-blue-600 to-indigo-800',
  'prime-video': 'from-sky-500 to-cyan-700',
  spotify: 'from-emerald-500 to-green-700',
};

export function appGradient(id: string): string {
  return APP_COLORS[id] ?? 'from-indigo-500 to-violet-700';
}

export const LOCK_REASONS = ['Falta de pago', 'Baja del servicio', 'Equipo robado o extraviado', 'Uso indebido'];

export const AUDIT_LABELS: Record<string, string> = {
  'device.lock': 'Bloqueó un equipo',
  'device.unlock': 'Desbloqueó un equipo',
  'device.claim': 'Vinculó un equipo',
  'device.rename': 'Renombró un equipo',
  'device.unpair': 'Desvinculó un equipo',
  'device.payment': 'Registró un pago',
  'app.set': 'Cambió una app',
  'company.update': 'Editó marca o cobro',
  'company.create': 'Creó la empresa',
  'member.set': 'Cambió un miembro',
  'alerts.update': 'Configuró avisos',
  'catalog.upsert': 'Editó el catálogo',
  'domain.classify': 'Clasificó un dominio',
  'device.unlock_code': 'Pidió un código de desbloqueo',
  'device.external_ref': 'Cambió el n.º de cliente',
  'api_key.create': 'Creó una clave de API',
  'api_key.revoke': 'Revocó una clave de API',
  'catalog.attestation': 'Cambió la atestación de una app',
  'firmware.publish': 'Publicó firmware',
  'firmware.target': 'Asignó firmware',
};

/** Copia al portapapeles; false si el navegador no lo permite. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
