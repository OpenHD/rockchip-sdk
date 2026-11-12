import { deviceStatus, type Company, type Device, type DeviceStatus } from './api';
import type { HealthScore } from './health';

/** Lógica pura del listado de equipos: orden, páginas y reparto por estado (Resumen). */

export type DeviceSort = 'nombre' | 'problemas' | 'salud' | 'conexion' | 'pago';

export const DEVICE_SORTS: { id: DeviceSort; label: string }[] = [
  { id: 'nombre', label: 'Nombre (A-Z)' },
  { id: 'problemas', label: 'Problemas primero' },
  { id: 'salud', label: 'Peor salud primero' },
  { id: 'conexion', label: 'Más tiempo sin conexión' },
  { id: 'pago', label: 'Pago más próximo o vencido' },
];

/** De lo más grave a lo más tranquilo: lo que el operador tiene que mirar primero. */
export const STATUS_ORDER: DeviceStatus[] = ['bloqueado', 'pago vencido', 'restringido', 'por vencer', 'sin conexión', 'activo'];

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const byName = (a: Device, b: Device) => {
  if (!a.name || !b.name) return a.name ? -1 : b.name ? 1 : a.id.localeCompare(b.id);
  return collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
};
/** Compara valores que pueden faltar: los que faltan van siempre al final. */
function nullsLast<T>(a: T | null | undefined, b: T | null | undefined, cmp: (x: T, y: T) => number): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  return cmp(a, b);
}

export function sortDevices(
  devices: readonly Device[],
  sort: DeviceSort,
  company: Company,
  health: ReadonlyMap<string, HealthScore>,
): Device[] {
  const list = [...devices];
  const score = (d: Device) => health.get(d.id)?.score;
  switch (sort) {
    case 'problemas': {
      const rank = new Map(list.map((d) => [d.id, STATUS_ORDER.indexOf(deviceStatus(d, company))]));
      return list.sort(
        (a, b) => rank.get(a.id)! - rank.get(b.id)! || nullsLast(score(a), score(b), (x, y) => x - y) || byName(a, b),
      );
    }
    case 'salud':
      return list.sort((a, b) => nullsLast(score(a), score(b), (x, y) => x - y) || byName(a, b));
    case 'conexion':
      return list.sort((a, b) => nullsLast(a.last_seen_at, b.last_seen_at, (x, y) => x.localeCompare(y)) || byName(a, b));
    case 'pago':
      return list.sort((a, b) => nullsLast(a.paid_until, b.paid_until, (x, y) => x.localeCompare(y)) || byName(a, b));
    default:
      return list.sort(byName);
  }
}

export const PAGE_SIZE = 50;

export interface Page<T> {
  items: T[];
  /** Página efectiva (1…pageCount): si la pedida quedó fuera de rango se ajusta. */
  page: number;
  pageCount: number;
  /** Posición (desde 1) del primer y último elemento mostrados; 0 si no hay ninguno. */
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: current, pageCount, from: total ? start + 1 : 0, to: start + slice.length, total };
}

/** ¿El equipo coincide con lo que se escribió en el buscador? Nombre, ID o n.º de cliente, sin importar mayúsculas ni tildes. */
export function matchesQuery(d: Pick<Device, 'id' | 'name' | 'external_ref'>, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(d.name ?? '').includes(q) || d.id.toLowerCase().startsWith(q) || fold(d.external_ref ?? '').includes(q);
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Cuántos equipos hay en cada estado, en orden de gravedad y sin los estados vacíos. */
export function statusBreakdown(devices: readonly Device[], company: Company): { status: DeviceStatus; count: number }[] {
  const counts = new Map<DeviceStatus, number>();
  for (const d of devices) {
    const s = deviceStatus(d, company);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return STATUS_ORDER.filter((s) => counts.has(s)).map((status) => ({ status, count: counts.get(status)! }));
}
