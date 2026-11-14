import type { Notice, NoticeCategory, NoticeSeverity } from './api';

/**
 * Comunicados a los TV (v12): reglas del formulario y lectura del estado, sin componentes.
 * Los límites son los mismos que valida la base (mdm_notices / mdm_create_notice).
 */

export const NOTICE_TITLE_MAX = 80;
export const NOTICE_BODY_MAX = 500;
export const NOTICE_MAX_DAYS = 31;
export const NOTICES_PER_DAY = 30;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const CATEGORY_LABELS: Record<NoticeCategory, string> = {
  corte: 'Corte de servicio',
  clima: 'Clima',
  salud: 'Salud',
  municipal: 'Municipal',
  general: 'General',
};

export const SEVERITY_META: Record<NoticeSeverity, { label: string; tone: 'neutral' | 'warning' | 'danger'; tv: string }> = {
  info: { label: 'Informativo', tone: 'neutral', tv: 'Cartel chico, no interrumpe lo que se está viendo.' },
  importante: { label: 'Importante', tone: 'warning', tv: 'Cartel destacado arriba de la pantalla.' },
  emergencia: { label: 'Emergencia', tone: 'danger', tv: 'Pantalla completa: interrumpe lo que se está viendo hasta que lo aceptan.' },
};

export type DurationId = '1h' | '6h' | '24h' | '3d' | '7d';
export const DURATIONS: { id: DurationId; label: string; ms: number }[] = [
  { id: '1h', label: '1 hora', ms: HOUR },
  { id: '6h', label: '6 horas', ms: 6 * HOUR },
  { id: '24h', label: '1 día', ms: DAY },
  { id: '3d', label: '3 días', ms: 3 * DAY },
  { id: '7d', label: '7 días', ms: 7 * DAY },
];

export interface NoticeDraft {
  title: string;
  body: string;
  category: NoticeCategory;
  severity: NoticeSeverity;
  /** 'now' = sale apenas se envía; 'later' = empieza en startsAt. */
  startMode: 'now' | 'later';
  /** Valor de <input type="datetime-local"> (hora local, sin zona). */
  startsAt: string;
  /** Preset, o 'custom' para terminar en `until`. */
  duration: DurationId | 'custom';
  until: string;
  /** v15: 'all' = todos los equipos; 'zones' = solo los de zoneIds. */
  audience: 'all' | 'zones';
  zoneIds: string[];
}

export const EMPTY_DRAFT: NoticeDraft = {
  title: '',
  body: '',
  category: 'general',
  severity: 'info',
  startMode: 'now',
  startsAt: '',
  duration: '24h',
  until: '',
  audience: 'all',
  zoneIds: [],
};

export interface NoticeTemplate {
  id: string;
  label: string;
  draft: Pick<NoticeDraft, 'title' | 'body' | 'category' | 'severity' | 'duration'>;
}

/** Lo que va entre [corchetes] lo completa quien envía; el formulario no deja mandarlo así. */
export const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'corte-programado',
    label: 'Corte programado',
    draft: {
      category: 'corte', severity: 'importante', duration: '24h',
      title: 'Corte programado de servicio',
      body: 'El [día] de [hora] a [hora] vamos a hacer tareas de mantenimiento en la red. Durante ese tiempo podés quedarte sin internet y sin TV. Disculpá las molestias.',
    },
  },
  {
    id: 'falla',
    label: 'Falla en el servicio',
    draft: {
      category: 'corte', severity: 'importante', duration: '6h',
      title: 'Estamos trabajando en una falla',
      body: 'Detectamos una falla que afecta el servicio en la zona de [barrio o zona]. Nuestro equipo técnico ya está trabajando para resolverla lo antes posible.',
    },
  },
  {
    id: 'alerta-meteorologica',
    label: 'Alerta meteorológica',
    draft: {
      category: 'clima', severity: 'emergencia', duration: '24h',
      title: 'Alerta meteorológica',
      body: 'Rige una alerta [amarilla / naranja / roja] por [tormentas fuertes] para nuestra zona. Evitá salir si no es necesario y asegurá los objetos que se puedan volar.',
    },
  },
  {
    id: 'campana-salud',
    label: 'Campaña de salud',
    draft: {
      category: 'salud', severity: 'info', duration: '7d',
      title: 'Campaña de vacunación',
      body: 'Del [fecha] al [fecha] se vacuna gratis en [lugar], de [hora] a [hora]. Llevá tu DNI y tu carnet de vacunas.',
    },
  },
  {
    id: 'municipal',
    label: 'Aviso municipal',
    draft: {
      category: 'municipal', severity: 'info', duration: '3d',
      title: 'Aviso de la municipalidad',
      body: '[Texto del aviso]',
    },
  },
];

/** Primer dato sin completar de una plantilla ("[día]"), o null. */
export function pendingPlaceholder(text: string): string | null {
  return text.match(/\[[^\][]{1,60}\]/)?.[0] ?? null;
}

/** Date → valor de datetime-local en hora local. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type NoticeWindow =
  | { ok: true; start: Date; end: Date; /** null = "ahora": lo fija el servidor. */ startsAt: string | null; expiresAt: string }
  | { ok: false; error: string };

/** Desde y hasta cuándo se muestra, con las mismas reglas que la base (termina después de empezar, máximo 31 días). */
export function noticeWindow(d: Pick<NoticeDraft, 'startMode' | 'startsAt' | 'duration' | 'until'>, now = Date.now()): NoticeWindow {
  let start = new Date(now);
  if (d.startMode === 'later') {
    const parsed = parseLocal(d.startsAt);
    if (!parsed) return { ok: false, error: 'Elegí cuándo empieza a mostrarse' };
    if (parsed.getTime() <= now) return { ok: false, error: 'El inicio ya pasó: elegí una fecha futura o "Ahora"' };
    start = parsed;
  }
  let end: Date;
  if (d.duration === 'custom') {
    const parsed = parseLocal(d.until);
    if (!parsed) return { ok: false, error: 'Elegí hasta cuándo se muestra' };
    end = parsed;
  } else {
    end = new Date(start.getTime() + DURATIONS.find((x) => x.id === d.duration)!.ms);
  }
  if (end.getTime() <= start.getTime()) return { ok: false, error: 'Tiene que terminar después de empezar' };
  if (end.getTime() - start.getTime() > NOTICE_MAX_DAYS * DAY) return { ok: false, error: `Un comunicado dura como máximo ${NOTICE_MAX_DAYS} días` };
  return { ok: true, start, end, startsAt: d.startMode === 'later' ? start.toISOString() : null, expiresAt: end.toISOString() };
}

/** Primer problema del borrador, o null si se puede enviar. */
export function validateNotice(d: NoticeDraft, now = Date.now()): string | null {
  const title = d.title.trim();
  const body = d.body.trim();
  if (!title) return 'Escribí un título';
  if (title.length > NOTICE_TITLE_MAX) return `El título tiene más de ${NOTICE_TITLE_MAX} caracteres`;
  if (!body) return 'Escribí el mensaje';
  if (body.length > NOTICE_BODY_MAX) return `El mensaje tiene más de ${NOTICE_BODY_MAX} caracteres`;
  const pending = pendingPlaceholder(title) ?? pendingPlaceholder(body);
  if (pending) return `Completá ${pending} antes de enviar`;
  if (d.audience === 'zones' && d.zoneIds.length === 0) return 'Elegí al menos una zona, o mandalo a todos los equipos';
  const w = noticeWindow(d, now);
  return w.ok ? null : w.error;
}

export type NoticeStatus = 'activo' | 'programado' | 'vencido' | 'cancelado';

export const STATUS_LABELS: Record<NoticeStatus, { label: string; tone: 'success' | 'info' | 'neutral' }> = {
  activo: { label: 'En pantalla', tone: 'success' },
  programado: { label: 'Programado', tone: 'info' },
  vencido: { label: 'Finalizado', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

export function noticeStatus(n: Pick<Notice, 'starts_at' | 'expires_at' | 'cancelled_at'>, now = Date.now()): NoticeStatus {
  if (n.cancelled_at) return 'cancelado';
  if (new Date(n.expires_at).getTime() <= now) return 'vencido';
  if (new Date(n.starts_at).getTime() > now) return 'programado';
  return 'activo';
}

/** Zonas para mdm_create_notice (p_zones): null = todos los equipos. */
export function noticeZones(d: Pick<NoticeDraft, 'audience' | 'zoneIds'>): string[] | null {
  return d.audience === 'zones' && d.zoneIds.length > 0 ? d.zoneIds : null;
}

/** Porcentaje de equipos que lo mostraron (0-100). Sin equipos: 0. */
export function seenPercent(n: Pick<Notice, 'seen' | 'devices'>): number {
  if (!n.devices || n.devices <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((n.seen / n.devices) * 100)));
}

/** Comunicados creados en las últimas 24 h (el servidor acepta hasta 30). */
export function sentLastDay(notices: Pick<Notice, 'created_at'>[], now = Date.now()): number {
  return notices.filter((n) => now - new Date(n.created_at).getTime() < DAY).length;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "hoy 14:30", "mañana 09:00", "vie 14 nov, 09:00" (24 h: entra en una línea del listado). */
export function formatWhen(d: Date, now = Date.now()): string {
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const today = new Date(now);
  if (sameDay(d, today)) return `hoy ${time}`;
  if (sameDay(d, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))) return `mañana ${time}`;
  if (sameDay(d, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))) return `ayer ${time}`;
  return `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

/**
 * Qué comunicados vigentes (en pantalla o programados) toca borrar una zona, igual que mdm_delete_zone:
 * los que iban solo a esa zona se cancelan; los que iban a varias la pierden y siguen para el resto.
 */
export function noticesHitByZoneDelete<T extends Pick<Notice, 'starts_at' | 'expires_at' | 'cancelled_at' | 'zone_ids'>>(
  notices: readonly T[],
  zoneId: string,
  now = Date.now(),
): { cancelled: T[]; trimmed: T[] } {
  const live = notices.filter((n) => {
    const s = noticeStatus(n, now);
    return (s === 'activo' || s === 'programado') && !!n.zone_ids?.includes(zoneId);
  });
  return {
    cancelled: live.filter((n) => n.zone_ids!.every((z) => z === zoneId)),
    trimmed: live.filter((n) => n.zone_ids!.some((z) => z !== zoneId)),
  };
}
