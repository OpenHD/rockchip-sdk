import type { Device } from './api';

/** Lógica pura del buscador global (Ctrl/⌘ K): qué equipos, acciones y secciones coinciden con lo escrito, y en qué orden. */

export type SearchDevice = Pick<Device, 'id' | 'name' | 'external_ref' | 'locked' | 'restricted' | 'paid_until'>;

/** Lo que se puede hacer con un equipo directamente desde el buscador. */
export type DeviceAction = 'pay' | 'lock' | 'unlock' | 'restrict' | 'unrestrict' | 'code';

/** Acción general, sección o filtro del listado: algo a lo que se llega por su nombre. */
export interface PaletteEntry {
  id: string;
  label: string;
  /** Otras palabras con las que alguien lo buscaría ("cobro", "wifi"…). */
  keywords?: string;
}

export type PaletteResult =
  | { kind: 'device'; key: string; device: SearchDevice }
  | { kind: 'device-action'; key: string; action: DeviceAction; device: SearchDevice }
  | { kind: 'entry'; key: string; group: 'action' | 'section' | 'filter'; entry: PaletteEntry };

export interface PaletteContext {
  devices: readonly SearchDevice[];
  actions: readonly PaletteEntry[];
  sections: readonly PaletteEntry[];
  filters: readonly PaletteEntry[];
  /** Ids de los últimos equipos abiertos, del más reciente al más viejo. */
  recents?: readonly string[];
}

export const MAX_DEVICE_RESULTS = 6;

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Primera palabra que indica qué se quiere hacer: "pago perez", "bloquear 123", "codigo gomez". */
const VERBS: { action: DeviceAction; stems: string[] }[] = [
  { action: 'unlock', stems: ['desbloq', 'habilit', 'reactiv'] },
  { action: 'unrestrict', stems: ['desrestr'] },
  { action: 'pay', stems: ['pag', 'cobr', 'abon'] },
  { action: 'lock', stems: ['bloq', 'cort', 'suspend'] },
  { action: 'restrict', stems: ['restri', 'limit'] },
  { action: 'code', stems: ['codig', 'clave'] },
];

function verbOf(token: string): DeviceAction | null {
  if (token.length < 3) return null;
  // Con pocas letras ("pag") alcanza con que el verbo empiece así; con la palabra entera ("pagar"), que empiece con la raíz.
  return VERBS.find((v) => v.stems.some((s) => token.startsWith(s) || s.startsWith(token)))?.action ?? null;
}

/** ¿Tiene sentido la acción con el equipo como está ahora? (No se ofrece bloquear uno ya bloqueado.) */
export function actionApplies(action: DeviceAction, d: SearchDevice): boolean {
  switch (action) {
    case 'lock':
      return !d.locked;
    case 'unlock':
      return d.locked;
    case 'restrict':
      return !d.restricted && !d.locked;
    case 'unrestrict':
      return d.restricted;
    default:
      return true;
  }
}

/** Acciones que se ofrecen para un equipo, en el orden en que más se usan. */
export function actionsFor(d: SearchDevice): DeviceAction[] {
  return (['pay', 'unlock', 'lock', 'unrestrict', 'restrict', 'code'] as DeviceAction[]).filter((a) => actionApplies(a, d));
}

/**
 * Puntaje de un equipo para lo escrito (0 = no coincide). Todas las palabras tienen que aparecer.
 * De más a menos: n.º de cliente exacto, ID, final del n.º de cliente ("123" → ABO-000123), nombre que empieza así,
 * palabras del nombre que empiezan así, y por último texto suelto dentro del nombre o del n.º de cliente.
 */
export function scoreDevice(d: SearchDevice, query: string): number {
  const q = fold(query.trim());
  if (!q) return 0;
  const name = fold(d.name ?? '');
  const ref = fold(d.external_ref ?? '');
  const id = d.id.toLowerCase();
  if (ref && ref === q) return 100;
  if (q.length >= 4 && id.startsWith(q)) return 95;
  if (ref && ref.endsWith(q) && /\d$/.test(q)) return 88;
  if (ref && ref.startsWith(q)) return 85;
  if (name && name.startsWith(q)) return 80;
  const tokens = q.split(/\s+/);
  const nameWords = words(d.name ?? '');
  const hit = (t: string) => (nameWords.some((w) => w.startsWith(t)) ? 2 : name.includes(t) || ref.includes(t) ? 1 : 0);
  const hits = tokens.map(hit);
  if (hits.some((h) => h === 0)) return 0;
  return hits.every((h) => h === 2) ? 70 : 50;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function rankDevices(devices: readonly SearchDevice[], query: string, limit = MAX_DEVICE_RESULTS): SearchDevice[] {
  return devices
    .map((d) => ({ d, score: scoreDevice(d, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || collator.compare(a.d.name ?? '￿', b.d.name ?? '￿') || a.d.id.localeCompare(b.d.id))
    .slice(0, limit)
    .map((x) => x.d);
}

/** ¿La acción, sección o filtro coincide? Cada palabra escrita tiene que ser el comienzo de alguna de sus palabras. */
export function matchesEntry(entry: PaletteEntry, query: string): boolean {
  const tokens = words(query);
  if (tokens.length === 0) return true;
  const own = words(`${entry.label} ${entry.keywords ?? ''}`);
  // También al revés para los plurales: "pagos vencidos" encuentra "Pago vencido".
  return tokens.every((t) => own.some((w) => w.startsWith(t) || (w.length >= 4 && t.startsWith(w))));
}

const deviceResult = (device: SearchDevice): PaletteResult => ({ kind: 'device', key: `d:${device.id}`, device });
const actionResult = (action: DeviceAction, device: SearchDevice): PaletteResult => ({ kind: 'device-action', key: `a:${action}:${device.id}`, action, device });
const entryResults = (group: 'action' | 'section' | 'filter', entries: readonly PaletteEntry[], query: string): PaletteResult[] =>
  entries.filter((e) => matchesEntry(e, query)).map((entry) => ({ kind: 'entry', key: `${group}:${entry.id}`, group, entry }));

/**
 * Resultados del buscador, en el orden en que se muestran.
 * - Sin texto: acciones frecuentes, últimos equipos abiertos y secciones.
 * - "pago perez", "bloquear 123": la acción pedida sobre los equipos que coinciden.
 * - Cualquier otro texto: equipos, lo que se puede hacer con el primero, y después acciones, filtros y secciones.
 */
export function searchPalette(query: string, ctx: PaletteContext): PaletteResult[] {
  const q = query.trim();
  if (!q) {
    const byId = new Map(ctx.devices.map((d) => [d.id, d]));
    const recents = (ctx.recents ?? []).map((id) => byId.get(id)).filter((d): d is SearchDevice => !!d).slice(0, 5);
    return [...entryResults('action', ctx.actions, ''), ...recents.map(deviceResult), ...entryResults('section', ctx.sections, '')];
  }

  const general = [...entryResults('action', ctx.actions, q), ...entryResults('filter', ctx.filters, q), ...entryResults('section', ctx.sections, q)];
  const tokens = fold(q).split(/\s+/);
  const verb = tokens.length > 1 ? verbOf(tokens[0]) : null;
  if (verb) {
    const found = rankDevices(ctx.devices, tokens.slice(1).join(' ')).filter((d) => actionApplies(verb, d));
    if (found.length > 0) {
      // Por si la primera palabra era parte de un nombre ("Cortés Juan"): los equipos que coinciden con todo el texto van igual.
      const literal = rankDevices(ctx.devices, q);
      const seen = new Set(literal.map((d) => d.id));
      const devices = [...literal, ...found.slice(0, 3).filter((d) => !seen.has(d.id))];
      return [...found.map((d) => actionResult(verb, d)), ...devices.map(deviceResult), ...general];
    }
  }

  const found = rankDevices(ctx.devices, q);
  const top = found[0];
  return [...found.map(deviceResult), ...(top ? actionsFor(top).map((a) => actionResult(a, top)) : []), ...general];
}

/** Suma un equipo al principio de los recientes (sin repetir, hasta `max`). */
export function pushRecent(recents: readonly string[], id: string, max = 5): string[] {
  return [id, ...recents.filter((r) => r !== id)].slice(0, max);
}
