import { deviceStatus, enforcement, isOnline, type Company, type Device, type ZoneStatus } from './api';
import { healthIssues, paymentText, type Filter } from './deviceMeta';
import { relativeTime } from './format';
import type { HealthScore } from './health';
import { outageSummary, sortZonesByUrgency } from './zones';

/** Lógica pura de "Para hacer hoy" (Resumen) y de la lista de primeros pasos de una empresa nueva. */

export type TodoKind = 'outage' | 'security' | 'overdue' | 'restricted' | 'health' | 'due' | 'offline' | 'pending';

/** De lo más urgente a lo que puede esperar. */
export const TODO_ORDER: TodoKind[] = ['outage', 'security', 'overdue', 'restricted', 'health', 'due', 'offline', 'pending'];

/** Qué ofrece el botón del renglón: registrar un pago, abrir el equipo o ver el listado filtrado. */
export type TodoAction = 'pay' | 'open' | 'list';

export interface TodoItem {
  id: string;
  kind: TodoKind;
  tone: 'danger' | 'warning';
  title: string;
  detail: string;
  /** Cuántos equipos abarca (1 si es de un solo equipo). */
  count: number;
  action: TodoAction;
  /** Equipo del renglón (cuando es de uno solo). */
  deviceId?: string;
  /** Zona de la caída. */
  zoneId?: string;
  /** Filtro del listado de equipos al que lleva "Ver". */
  filter?: Filter;
}

const KIND: Record<Exclude<TodoKind, 'outage'>, { tone: 'danger' | 'warning'; action: TodoAction; filter: Filter; group: (n: number) => string; groupDetail: string }> = {
  security: { tone: 'danger', action: 'open', filter: 'alertas', group: (n) => `${n} equipos con alertas de seguridad`, groupDetail: 'Posible infección o protección caída: hay que revisarlos' },
  overdue: { tone: 'danger', action: 'pay', filter: 'vencidos', group: (n) => `${n} equipos bloqueados por falta de pago`, groupDetail: 'Cuando registres el pago se desbloquean solos' },
  restricted: { tone: 'warning', action: 'pay', filter: 'restringidos', group: (n) => `${n} equipos restringidos`, groupDetail: 'Con el menú pero sin apps, por pago atrasado' },
  health: { tone: 'warning', action: 'open', filter: 'salud-baja', group: (n) => `${n} equipos con salud baja`, groupDetail: 'Temperatura, memoria o red con problemas' },
  due: { tone: 'warning', action: 'pay', filter: 'por-vencer', group: (n) => `${n} pagos por vencer`, groupDetail: 'Vencen en estos días o están en los días de gracia' },
  offline: { tone: 'warning', action: 'open', filter: 'offline', group: (n) => `${n} equipos sin conexión hace rato`, groupDetail: 'Fuera de las zonas con caída' },
  pending: { tone: 'warning', action: 'open', filter: 'todos', group: (n) => `${n} cambios sin aplicar`, groupDetail: 'El TV todavía no confirmó el bloqueo o desbloqueo' },
};

/** Hasta esta cantidad, cada equipo va en su renglón con su botón; con más, un solo renglón que lleva al listado. */
export const TODO_INDIVIDUAL_MAX = 3;

export interface TodoInput {
  devices: readonly Device[];
  company: Company;
  health: ReadonlyMap<string, HealthScore>;
  zones: readonly ZoneStatus[];
  now?: number;
}

/**
 * Lo que hay que atender hoy, ya priorizado: caídas de zona, equipos posiblemente infectados, bloqueados por pago,
 * restringidos por pago, salud baja, pagos por vencer, equipos sin conexión y cambios que el TV no confirmó.
 * Un equipo sin conexión dentro de una zona en caída no se lista aparte: ya lo cuenta la caída.
 */
export function buildTodo({ devices, company, health, zones, now = Date.now() }: TodoInput): TodoItem[] {
  const items: TodoItem[] = [];
  const outages = sortZonesByUrgency(zones).filter((z) => z.outage_started_at);
  const inOutage = new Set(outages.map((z) => z.zone_id));
  for (const z of outages) {
    items.push({ id: `outage-${z.zone_id}`, kind: 'outage', tone: 'danger', title: `Caída en ${z.name}`, detail: outageSummary(z, now), count: z.total, action: 'list', zoneId: z.zone_id, filter: 'offline' });
  }

  const name = (d: Device) => d.name ?? `Equipo ${d.id.slice(0, 8)}`;
  const buckets: Record<Exclude<TodoKind, 'outage'>, { device: Device; title: string; detail: string }[]> = {
    security: [], overdue: [], restricted: [], health: [], due: [], offline: [], pending: [],
  };
  for (const d of devices) {
    const status = deviceStatus(d, company);
    const issues = healthIssues(d);
    if (issues.length > 0) buckets.security.push({ device: d, title: name(d), detail: issues.length === 1 ? issues[0] : `${issues[0]} (y ${issues.length - 1} más)` });
    if (status === 'pago vencido') buckets.overdue.push({ device: d, title: name(d), detail: `Bloqueado por falta de pago · ${paymentText(d, company).text.toLowerCase()}` });
    else if (status === 'restringido' && !d.restricted) buckets.restricted.push({ device: d, title: name(d), detail: `Restringido por pago atrasado · ${paymentText(d, company).text.toLowerCase()}` });
    else if (status === 'por vencer') buckets.due.push({ device: d, title: name(d), detail: paymentText(d, company).text });
    const score = health.get(d.id);
    if (score?.band === 'problemas') buckets.health.push({ device: d, title: name(d), detail: `Salud ${score.score} de 100 · ${score.reasons[0]?.text ?? 'ver detalle'}` });
    if (!isOnline(d) && d.offline_alerted_at && !(d.zone_id && inOutage.has(d.zone_id))) {
      buckets.offline.push({ device: d, title: name(d), detail: `Sin conexión · visto ${relativeTime(d.last_seen_at, now)}` });
    }
    if (enforcement(d, company) === 'pendiente') buckets.pending.push({ device: d, title: name(d), detail: 'Cambio sin aplicar: el TV todavía no lo confirmó' });
  }
  // Los pagos, del vencimiento más viejo al más nuevo.
  const byDue = (a: { device: Device }, b: { device: Device }) => (a.device.paid_until ?? '').localeCompare(b.device.paid_until ?? '');
  buckets.overdue.sort(byDue);
  buckets.restricted.sort(byDue);
  buckets.due.sort(byDue);

  for (const kind of TODO_ORDER) {
    if (kind === 'outage') continue;
    const meta = KIND[kind];
    const rows = buckets[kind];
    if (rows.length === 0) continue;
    if (rows.length <= TODO_INDIVIDUAL_MAX) {
      for (const r of rows) items.push({ id: `${kind}-${r.device.id}`, kind, tone: meta.tone, title: r.title, detail: r.detail, count: 1, action: meta.action, deviceId: r.device.id, filter: meta.filter });
    } else {
      items.push({ id: kind, kind, tone: meta.tone, title: meta.group(rows.length), detail: meta.groupDetail, count: rows.length, action: 'list', filter: meta.filter });
    }
  }
  return items;
}

export type OnboardingStepId = 'device' | 'brand' | 'alerts' | 'zone' | 'team';

export interface OnboardingStep {
  id: OnboardingStepId;
  done: boolean;
}

/**
 * Primeros pasos de una empresa nueva. `memberCount` null = todavía no se sabe (no se reclama invitar a nadie).
 * La lista se muestra mientras quede algún paso sin hacer.
 */
export function onboardingSteps(input: {
  company: Pick<Company, 'logo_path' | 'alert_emails' | 'alert_telegram_chat_id'>;
  deviceCount: number;
  zoneCount: number;
  memberCount: number | null;
}): OnboardingStep[] {
  const { company } = input;
  return [
    { id: 'device', done: input.deviceCount > 0 },
    { id: 'brand', done: !!company.logo_path },
    { id: 'alerts', done: (company.alert_emails?.length ?? 0) > 0 || !!company.alert_telegram_chat_id },
    { id: 'zone', done: input.zoneCount > 0 },
    { id: 'team', done: input.memberCount === null || input.memberCount > 1 },
  ];
}

export function onboardingPending(steps: readonly OnboardingStep[]): number {
  return steps.filter((s) => !s.done).length;
}
