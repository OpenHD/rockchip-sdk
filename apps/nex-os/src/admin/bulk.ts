import type { Device } from './api';
import { addMonths, todayIso } from './format';

/** Lógica pura de las acciones en lote sobre equipos: a cuáles les toca, ejecución con avance y resumen del resultado. */

export type BulkKind = 'pay' | 'lock' | 'unlock' | 'restrict' | 'unrestrict';

/**
 * Nuevo "pagado hasta" al registrar `months` meses: se suma desde el vencimiento actual si todavía no pasó,
 * o desde hoy si ya venció o el equipo no tenía control de pago (mismo criterio que el diálogo de pago).
 */
export function nextPaidUntil(paidUntil: string | null, months = 1, today = todayIso()): string {
  return addMonths(paidUntil && paidUntil >= today ? paidUntil : today, months);
}

type BulkDevice = Pick<Device, 'id' | 'locked' | 'restricted' | 'paid_until'>;

/**
 * Separa los equipos a los que hay que aplicarles la acción de los que no se tocan: los que ya están así y,
 * al registrar pagos, los que no tienen control de pago (activárselo en lote los dejaría con un vencimiento que nadie eligió).
 */
export function bulkTargets<T extends BulkDevice>(kind: BulkKind, devices: readonly T[]): { targets: T[]; skipped: T[] } {
  const applies = (d: T) =>
    kind === 'lock' ? !d.locked : kind === 'unlock' ? d.locked : kind === 'restrict' ? !d.restricted : kind === 'unrestrict' ? d.restricted : !!d.paid_until;
  return { targets: devices.filter(applies), skipped: devices.filter((d) => !applies(d)) };
}

export interface BulkOutcome {
  id: string;
  ok: boolean;
  error?: string;
}

/**
 * Ejecuta `fn` para cada elemento, de a `concurrency` a la vez, sin cortar ante un error: cada uno deja su resultado.
 * `shouldStop` se consulta antes de empezar cada elemento; los que no llegaron a empezar no aparecen en el resultado.
 */
export async function runBulk<T extends { id: string }>(
  items: readonly T[],
  fn: (item: T) => Promise<unknown>,
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void; shouldStop?: () => boolean } = {},
): Promise<BulkOutcome[]> {
  const outcomes: BulkOutcome[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length && !opts.shouldStop?.()) {
      const item = items[next++];
      try {
        await fn(item);
        outcomes.push({ id: item.id, ok: true });
      } catch (err) {
        outcomes.push({ id: item.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      opts.onProgress?.(outcomes.length, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 4, items.length)) }, worker));
  return outcomes;
}

export interface BulkSummary {
  ok: number;
  failed: number;
  /** No llegaron a ejecutarse (se detuvo antes). */
  pending: number;
  /** Ya estaban en el estado pedido. */
  skipped: number;
  tone: 'success' | 'warning' | 'danger';
  title: string;
  /** Ids que fallaron, para reintentar. */
  failedIds: string[];
  /** Errores distintos con cuántos equipos tuvo cada uno, del más frecuente al menos. */
  errors: { message: string; count: number }[];
}

const DONE: Record<BulkKind, [one: string, many: string]> = {
  pay: ['pago registrado', 'pagos registrados'],
  lock: ['equipo bloqueado', 'equipos bloqueados'],
  unlock: ['equipo desbloqueado', 'equipos desbloqueados'],
  restrict: ['equipo restringido', 'equipos restringidos'],
  unrestrict: ['restricción quitada', 'restricciones quitadas'],
};

export function summarizeBulk(kind: BulkKind, total: number, outcomes: readonly BulkOutcome[], skipped = 0): BulkSummary {
  const ok = outcomes.filter((o) => o.ok).length;
  const failures = outcomes.filter((o) => !o.ok);
  const failed = failures.length;
  const pending = Math.max(0, total - outcomes.length);
  const counts = new Map<string, number>();
  for (const f of failures) counts.set(f.error ?? 'Error desconocido', (counts.get(f.error ?? 'Error desconocido') ?? 0) + 1);
  const done = `${ok} ${DONE[kind][ok === 1 ? 0 : 1]}`;
  const title =
    failed === 0 && pending === 0
      ? done
      : ok === 0 && pending === 0
        ? failed === 1 ? 'No se pudo aplicar' : `No se pudo aplicar a ninguno de los ${failed}`
        : [done, failed > 0 && `${failed} ${failed === 1 ? 'falló' : 'fallaron'}`, pending > 0 && `${pending} sin hacer`].filter(Boolean).join(' · ');
  return {
    ok,
    failed,
    pending,
    skipped,
    tone: failed === 0 && pending === 0 ? 'success' : ok === 0 ? 'danger' : 'warning',
    title,
    failedIds: failures.map((f) => f.id),
    errors: [...counts].map(([message, count]) => ({ message, count })).sort((a, b) => b.count - a.count),
  };
}
