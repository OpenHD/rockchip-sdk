import type { Device, ZoneOutage, ZoneStatus } from './api';

/**
 * Zonas (v15): localidades, nodos u OLT en que el ISP agrupa sus equipos. Lógica pura, sin componentes:
 * filtros del listado, a cuántos equipos les llega un comunicado y cómo se lee una caída masiva.
 */

/** Valor del filtro (y de la ruta ?z=) para los equipos que no tienen zona. */
export const NO_ZONE = 'sin-zona';
export const ZONE_NAME_MAX = 60;
export const ZONES_MAX = 200;

/** Filtro del listado: null = todas las zonas, NO_ZONE = sin zona, o el id de una zona. */
export type ZoneFilter = string | null;

export function matchesZone(d: Pick<Device, 'zone_id'>, filter: ZoneFilter): boolean {
  if (!filter) return true;
  return filter === NO_ZONE ? !d.zone_id : d.zone_id === filter;
}

/** Un filtro que llega por la URL solo vale si la zona existe (o es "sin zona"). */
export function parseZoneFilter(value: string | null | undefined, zones: readonly Pick<ZoneStatus, 'zone_id'>[]): ZoneFilter {
  if (!value) return null;
  return value === NO_ZONE || zones.some((z) => z.zone_id === value) ? value : null;
}

/** Equipos por zona (clave: id de zona, o NO_ZONE). */
export function zoneCounts(devices: readonly Pick<Device, 'zone_id'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of devices) {
    const key = d.zone_id ?? NO_ZONE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca zonas por nombre, sin importar mayúsculas ni tildes. */
export function searchZones<T extends { name: string }>(zones: readonly T[], query: string): T[] {
  const q = fold(query);
  return q ? zones.filter((z) => fold(z.name).includes(q)) : [...zones];
}

/** Primer problema del nombre de una zona, o null. `others` son los nombres de las demás zonas. */
export function zoneNameProblem(name: string, others: readonly string[]): string | null {
  const n = name.trim();
  if (!n) return 'Escribí un nombre';
  if (n.length > ZONE_NAME_MAX) return `El nombre tiene más de ${ZONE_NAME_MAX} caracteres`;
  if (others.some((o) => o.trim().toLowerCase() === n.toLowerCase())) return 'Ya hay una zona con ese nombre';
  return null;
}

// ---------------------------------------------------------------------------
// Asignación masiva
// ---------------------------------------------------------------------------

export interface ZoneMove {
  /** Equipos que cambian de zona. */
  changing: number;
  /** Equipos que ya estaban en la zona de destino (no se tocan). */
  unchanged: number;
  /** De dónde salen los que cambian (id de zona o NO_ZONE), de más a menos. */
  from: { zone: string; count: number }[];
}

/** Qué pasa si los equipos elegidos van a `target` (null = quedan sin zona). */
export function planZoneMove(devices: readonly Pick<Device, 'zone_id'>[], target: string | null): ZoneMove {
  const from = new Map<string, number>();
  let unchanged = 0;
  for (const d of devices) {
    if ((d.zone_id ?? null) === target) unchanged++;
    else from.set(d.zone_id ?? NO_ZONE, (from.get(d.zone_id ?? NO_ZONE) ?? 0) + 1);
  }
  return {
    changing: devices.length - unchanged,
    unchanged,
    from: [...from].map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Comunicados: a quién le llega
// ---------------------------------------------------------------------------

/** Equipos que reciben un comunicado. Sin zonas (null o vacío) = todos, igual que mdm_create_notice. */
export function audienceCount(devices: readonly Pick<Device, 'zone_id'>[], zoneIds: readonly string[] | null | undefined): number {
  if (!zoneIds || zoneIds.length === 0) return devices.length;
  const set = new Set(zoneIds);
  return devices.filter((d) => d.zone_id !== null && set.has(d.zone_id)).length;
}

/** "Todos los equipos", "Centro", "Centro y Norte", "Centro, Norte y 2 zonas más". */
export function audienceLabel(zoneIds: readonly string[] | null | undefined, zones: readonly Pick<ZoneStatus, 'zone_id' | 'name'>[], max = 2): string {
  if (!zoneIds || zoneIds.length === 0) return 'Todos los equipos';
  const byId = new Map(zones.map((z) => [z.zone_id, z.name]));
  const names = zoneIds.map((id) => byId.get(id)).filter((n): n is string => !!n).sort(collator.compare);
  const missing = zoneIds.length - names.length;
  if (names.length === 0) return missing === 1 ? 'Una zona eliminada' : `${missing} zonas eliminadas`;
  const shown = names.slice(0, names.length <= max ? names.length : max);
  const rest = zoneIds.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} y ${rest} ${rest === 1 ? 'zona' : 'zonas'} más`;
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} y ${shown[shown.length - 1]}`;
}

/** "1 equipo" / "85 equipos". */
export function devicesText(n: number): string {
  return `${n} ${n === 1 ? 'equipo' : 'equipos'}`;
}

// ---------------------------------------------------------------------------
// Caídas
// ---------------------------------------------------------------------------

export type ZoneState = 'caida' | 'normal' | 'vacia';

export function zoneState(z: Pick<ZoneStatus, 'total' | 'outage_started_at'>): ZoneState {
  if (z.outage_started_at) return 'caida';
  return z.total === 0 ? 'vacia' : 'normal';
}

export function zoneOffline(z: Pick<ZoneStatus, 'total' | 'online'>): number {
  return Math.max(0, z.total - z.online);
}

/** Porcentaje de equipos en línea (0-100). Zona sin equipos: 0. */
export function onlinePercent(z: Pick<ZoneStatus, 'total' | 'online'>): number {
  if (z.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((z.online / z.total) * 100)));
}

/** Las caídas primero (la más vieja arriba), después el resto por nombre. */
export function sortZonesByUrgency<T extends Pick<ZoneStatus, 'name' | 'outage_started_at'>>(zones: readonly T[]): T[] {
  return [...zones].sort((a, b) => {
    if (a.outage_started_at && b.outage_started_at) return a.outage_started_at.localeCompare(b.outage_started_at) || collator.compare(a.name, b.name);
    if (a.outage_started_at || b.outage_started_at) return a.outage_started_at ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
}

/** Duración corta: "menos de 1 min", "12 min", "1 h 05 min", "3 h", "2 días 4 h". */
export function formatDuration(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'día' : 'días'}${h % 24 ? ` ${h % 24} h` : ''}`;
}

/** "desde hace 12 min", o null si la zona no está en caída. */
export function outageSince(z: Pick<ZoneStatus, 'outage_started_at'>, now = Date.now()): string | null {
  return z.outage_started_at ? `desde hace ${formatDuration(now - new Date(z.outage_started_at).getTime())}` : null;
}

/** "8 de 10 equipos sin conexión · desde hace 12 min". */
export function outageSummary(z: Pick<ZoneStatus, 'total' | 'online' | 'outage_started_at'>, now = Date.now()): string {
  const head = z.total === 0 ? 'La zona ya no tiene equipos' : `${zoneOffline(z)} de ${devicesText(z.total)} sin conexión`;
  const since = outageSince(z, now);
  return since ? `${head} · ${since}` : head;
}

/** Cuánto duró (o lleva) una caída del historial. */
export function outageDuration(o: Pick<ZoneOutage, 'started_at' | 'ended_at'>, now = Date.now()): string {
  const end = o.ended_at ? new Date(o.ended_at).getTime() : now;
  return formatDuration(end - new Date(o.started_at).getTime());
}

/** Texto de un evento de zona (zone_outage / zone_restored) para la línea de tiempo. */
export function zoneEventDetail(kind: string, details: Record<string, unknown>): string | null {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const offline = num(details.offline);
  const total = num(details.total);
  if (kind === 'zone_outage') return offline !== null && total !== null ? `${offline} de ${devicesText(total)} sin conexión` : null;
  if (kind === 'zone_restored') {
    const minutes = num(details.minutes);
    return minutes !== null ? `la caída duró ${formatDuration(minutes * 60_000)}` : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Selección del listado
// ---------------------------------------------------------------------------

/** Estado de la casilla "seleccionar todo" de la página visible. */
export function pageSelection(pageIds: readonly string[], selected: ReadonlySet<string>): 'none' | 'some' | 'all' {
  const n = pageIds.filter((id) => selected.has(id)).length;
  return n === 0 ? 'none' : n === pageIds.length ? 'all' : 'some';
}

/** Marca (o desmarca) un grupo de equipos sin tocar el resto de la selección. */
export function setSelected(selected: ReadonlySet<string>, ids: readonly string[], on: boolean): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}
