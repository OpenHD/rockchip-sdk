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

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const decimal = (n: number) => n.toFixed(1).replace('.', ',');

/** Megabytes legibles: "412 MB", "1,9 GB". Sin dato: "—". */
export function formatMb(mb: number | null | undefined): string {
  if (!finite(mb) || mb < 0) return '—';
  return mb >= 1024 ? `${decimal(mb / 1024)} GB` : `${Math.round(mb)} MB`;
}

/** "412 MB de 1,9 GB (21%)"; sin total, solo lo libre; sin nada, "—". */
export function formatFreeOf(free: number | null | undefined, total: number | null | undefined): string {
  if (!finite(free) || free < 0) return '—';
  if (!finite(total) || total <= 0) return formatMb(free);
  return `${formatMb(free)} de ${formatMb(total)} (${Math.round(Math.min(100, (free / total) * 100))}%)`;
}

export function formatTemp(c: number | null | undefined): string {
  return finite(c) ? `${Math.round(c)} °C` : '—';
}

/** Latencia y pérdida de un tramo: "3 ms · 0% pérdida", "No responde", "—". */
export function formatHop(ms: number | null | undefined, loss: number | null | undefined): string {
  const parts = [finite(ms) && `${Math.round(ms)} ms`, finite(loss) && `${Math.round(loss)}% pérdida`].filter(Boolean);
  if (parts.length === 0) return '—';
  if (!finite(ms) && finite(loss) && loss >= 100) return 'No responde';
  return parts.join(' · ');
}

/** Banda Wi-Fi a partir de la frecuencia del canal. */
export function wifiBand(mhz: number | null | undefined): string | null {
  if (!finite(mhz)) return null;
  if (mhz >= 5925) return '6 GHz';
  if (mhz >= 4900) return '5 GHz';
  if (mhz >= 2400 && mhz < 2500) return '2,4 GHz';
  return null;
}

/** "Wi-Fi 5 GHz", "Cable", "Sin red" o "—" si el equipo no lo informa. */
export function formatConnection(t: string | null | undefined, mhz?: number | null): string {
  if (t === 'wifi') return ['Wi-Fi', wifiBand(mhz)].filter(Boolean).join(' ');
  if (t === 'eth') return 'Cable';
  if (t === 'none') return 'Sin red';
  return '—';
}

/** Señal Wi-Fi en palabras; los cortes coinciden con los de health.ts. */
export function formatRssi(rssi: number | null | undefined): string {
  if (!finite(rssi)) return '—';
  const word = rssi <= -80 ? 'muy débil' : rssi <= -70 ? 'débil' : rssi <= -60 ? 'buena' : 'excelente';
  return `${Math.round(rssi)} dBm (${word})`;
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
export const RESTRICT_REASONS = ['Falta de pago', 'Pago parcial', 'Uso indebido'];

export const AUDIT_LABELS: Record<string, string> = {
  'device.lock': 'Bloqueó un equipo',
  'device.unlock': 'Desbloqueó un equipo',
  'device.restrict': 'Restringió un equipo',
  'device.unrestrict': 'Quitó la restricción de un equipo',
  'device.claim': 'Vinculó un equipo',
  'device.rename': 'Renombró un equipo',
  'device.unpair': 'Desvinculó un equipo',
  'device.payment': 'Registró un pago',
  'app.set': 'Cambió una app',
  'company.update': 'Editó marca o cobro',
  'company.create': 'Creó la empresa',
  'member.set': 'Cambió un miembro',
  'alerts.update': 'Configuró avisos',
  'notice.create': 'Envió un comunicado',
  'notice.cancel': 'Canceló un comunicado',
  'device.net_diag': 'Pidió un diagnóstico de red',
  'android_app.upsert': 'Cargó o actualizó una app Android',
  'android_app.set': 'Habilitó o deshabilitó una app Android',
  'android_app.delete': 'Quitó una app Android',
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
