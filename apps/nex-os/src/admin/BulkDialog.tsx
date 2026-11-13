import { useMemo, useRef, useState } from 'react';
import { Ban, CircleCheck, CreditCard, Lock, LockOpen, TriangleAlert, type LucideIcon } from 'lucide-react';
import { ApiError, rpcSetLock, rpcSetPaidUntil, rpcSetRestricted, type Company, type Device } from './api';
import { bulkTargets, nextPaidUntil, runBulk, summarizeBulk, type BulkKind, type BulkOutcome } from './bulk';
import { formatDate, LOCK_REASONS, RESTRICT_REASONS } from './format';
import { useStepUp } from './stepUp';
import { Button, Callout, Chip, Field, inputClass, Modal } from './ui';
import { devicesText } from './zones';

const META: Record<BulkKind, { title: string; verb: string; icon: LucideIcon; danger: boolean; skipped: [one: string, many: string]; explain: string }> = {
  pay: { title: 'Registrar pago', verb: 'Registrar pago a', icon: CreditCard, danger: false, skipped: ['no tiene control de pago (se le registra aparte, eligiendo la fecha)', 'no tienen control de pago (se les registra de a uno, eligiendo la fecha)'], explain: 'A cada equipo se le suma el período desde su vencimiento, o desde hoy si ya venció.' },
  lock: { title: 'Bloquear equipos', verb: 'Bloquear', icon: Lock, danger: true, skipped: ['ya está bloqueado', 'ya están bloqueados'], explain: 'Los TV muestran la pantalla de bloqueo en menos de un minuto y cortan lo que se esté viendo.' },
  unlock: { title: 'Desbloquear equipos', verb: 'Desbloquear', icon: LockOpen, danger: false, skipped: ['no está bloqueado a mano', 'no están bloqueados a mano'], explain: 'Quita el bloqueo manual. Los que tienen el pago vencido siguen bloqueados hasta que registres el pago.' },
  restrict: { title: 'Restringir equipos', verb: 'Restringir', icon: Ban, danger: true, skipped: ['ya está restringido', 'ya están restringidos'], explain: 'Paso intermedio antes del bloqueo: queda el menú y la pantalla de pago, sin apps.' },
  unrestrict: { title: 'Quitar restricción', verb: 'Quitar la restricción a', icon: CircleCheck, danger: false, skipped: ['no está restringido a mano', 'no están restringidos a mano'], explain: 'Quita la restricción manual. Las apps vuelven en menos de un minuto.' },
};

type Stage = { at: 'confirm' } | { at: 'running'; done: number; total: number } | { at: 'done'; total: number; outcomes: BulkOutcome[] };

/**
 * Acción en lote sobre los equipos seleccionados: confirma primero, aplica de a pocos con una barra de avance
 * y al final dice cuántos salieron bien y cuáles fallaron (con opción de reintentar solo esos).
 * Bloquear y restringir en lote piden el segundo factor, igual que las demás acciones críticas.
 */
export default function BulkDialog({ kind, devices, company, onClose, onChanged }: {
  kind: BulkKind;
  devices: readonly Device[];
  company: Company;
  /** `applied`: se llegó a aplicar algo (para soltar la selección). */
  onClose: (applied: boolean) => void;
  /** Algo cambió: hay que volver a leer los equipos. */
  onChanged: () => void;
}) {
  const meta = META[kind];
  const stepUp = useStepUp();
  const reasons = kind === 'lock' ? LOCK_REASONS : RESTRICT_REASONS;
  const [reason, setReason] = useState(reasons[0]);
  const [custom, setCustom] = useState('');
  const [months, setMonths] = useState(1);
  const [stage, setStage] = useState<Stage>({ at: 'confirm' });
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  // Se calcula una sola vez: al recargar los datos, los equipos ya cambiados no tienen que pasar a "ya estaban así".
  const [{ targets, skipped }] = useState(() => bulkTargets(kind, devices));
  const byId = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const needsReason = kind === 'lock' || kind === 'restrict';
  const finalReason = reason === 'Otro' ? custom.trim() : reason;

  const apply = (d: Device) => {
    switch (kind) {
      case 'pay':
        return rpcSetPaidUntil(d.id, nextPaidUntil(d.paid_until, months));
      case 'lock':
        return rpcSetLock(d.id, true, finalReason);
      case 'unlock':
        return rpcSetLock(d.id, false);
      case 'restrict':
        return rpcSetRestricted(d.id, true, finalReason);
      default:
        return rpcSetRestricted(d.id, false);
    }
  };

  const start = async (list: readonly Device[]) => {
    setError(null);
    stop.current = false;
    // Al reintentar, lo que ya salió bien en la pasada anterior se conserva en el resumen.
    const again = new Set(list.map((d) => d.id));
    const kept = stage.at === 'done' ? stage.outcomes.filter((o) => !again.has(o.id)) : [];
    const work = async () => {
      setStage({ at: 'running', done: 0, total: list.length });
      return runBulk(list, apply, { onProgress: (done, total) => setStage({ at: 'running', done, total }), shouldStop: () => stop.current });
    };
    try {
      const outcomes = await (meta.danger ? stepUp.guard(work) : work());
      setStage({ at: 'done', total: targets.length, outcomes: [...kept, ...outcomes] });
      onChanged();
    } catch (err) {
      setStage({ at: 'confirm' });
      if (!(err instanceof ApiError && err.code === 'cancelled')) setError((err as Error).message);
    }
  };

  const running = stage.at === 'running';
  const summary = stage.at === 'done' ? summarizeBulk(kind, stage.total, stage.outcomes, skipped.length) : null;
  const failedDevices = summary ? summary.failedIds.map((id) => byId.get(id)).filter((d): d is Device => !!d) : [];
  const notRun = stage.at === 'done' ? targets.filter((d) => !stage.outcomes.some((o) => o.id === d.id)) : [];

  return (
    <Modal
      title={meta.title}
      description={devicesText(devices.length) + (devices.length === 1 ? ' seleccionado' : ' seleccionados')}
      // Mientras corre no se cierra por accidente: primero hay que detenerlo.
      onClose={running ? () => {} : () => onClose(stage.at === 'done')}
      footer={
        stage.at === 'confirm' ? (
          <>
            <Button variant="secondary" onClick={() => onClose(false)}>Cancelar</Button>
            <Button variant={meta.danger ? 'danger' : 'primary'} icon={meta.icon} disabled={targets.length === 0 || (needsReason && !finalReason)} onClick={() => start(targets)}>
              {meta.verb} {devicesText(targets.length)}
            </Button>
          </>
        ) : running ? (
          <Button variant="secondary" onClick={() => { stop.current = true; }}>Detener</Button>
        ) : (
          <>
            {failedDevices.length + notRun.length > 0 && (
              <Button variant="secondary" onClick={() => start([...failedDevices, ...notRun])}>
                Reintentar {failedDevices.length + notRun.length === 1 ? 'el que falta' : `los ${failedDevices.length + notRun.length} que faltan`}
              </Button>
            )}
            <Button onClick={() => onClose(true)}>Listo</Button>
          </>
        )
      }
    >
      {stage.at === 'confirm' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-fg-2">{meta.explain}</p>
          {kind === 'pay' && (
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Período pagado">
              {[1, 3, 6].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={months === m}
                  onClick={() => setMonths(m)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${months === m ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-fill'}`}
                >
                  <div className="text-sm font-semibold text-fg">+{m} {m === 1 ? 'mes' : 'meses'}</div>
                  <div className="text-xs text-fg-3">desde hoy: {formatDate(nextPaidUntil(null, m))}</div>
                </button>
              ))}
            </div>
          )}
          {needsReason && (
            <>
              <div>
                <div className="mb-2 text-[13px] font-medium text-fg-2">Motivo</div>
                <div className="flex flex-wrap gap-2">
                  {[...reasons, 'Otro'].map((r) => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
                </div>
              </div>
              {reason === 'Otro' && (
                <Field label="Describí el motivo">
                  <input autoFocus className={inputClass} maxLength={280} value={custom} onChange={(e) => setCustom(e.target.value)} />
                </Field>
              )}
              {kind === 'lock' && (
                <div className="rounded-xl border border-line bg-inset p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-4">Así lo verán los clientes en el TV</div>
                  <div className="text-sm text-fg-2">{company.lock_message}</div>
                </div>
              )}
            </>
          )}
          {skipped.length > 0 && (
            <Callout tone="neutral">
              {targets.length === 0
                ? `${skipped.length === 1 ? 'El equipo' : `Los ${skipped.length} equipos`} que elegiste ${meta.skipped[skipped.length === 1 ? 0 : 1]}: no hay nada para hacer.`
                : `${devicesText(skipped.length)} ${meta.skipped[skipped.length === 1 ? 0 : 1]}: no se ${skipped.length === 1 ? 'toca' : 'tocan'}.`}
            </Callout>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      )}

      {stage.at === 'running' && (
        <div className="flex flex-col gap-3 py-2" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-sm text-fg-2">
            <span>Aplicando… no cierres esta ventana.</span>
            <span className="tabular-nums text-fg"><span className="font-semibold">{stage.done}</span> de {stage.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill-2" role="progressbar" aria-label="Avance" aria-valuemin={0} aria-valuemax={stage.total} aria-valuenow={stage.done}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${stage.total ? (stage.done / stage.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-3">
          <Callout tone={summary.tone} icon={summary.tone === 'success' ? CircleCheck : TriangleAlert} title={summary.title}>
            {summary.tone === 'success'
              ? kind === 'pay' ? 'Los que estaban bloqueados por pago se desbloquean solos en el próximo minuto.' : 'Los TV lo aplican en menos de un minuto.'
              : 'Lo que salió bien ya quedó aplicado. Podés reintentar solo los que faltan.'}
          </Callout>
          {summary.errors.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-fg-2">
              {summary.errors.slice(0, 3).map((e) => (
                <li key={e.message}><span className="font-medium tabular-nums text-danger">{e.count}×</span> {e.message}</li>
              ))}
            </ul>
          )}
          {failedDevices.length > 0 && (
            <p className="text-[13px] leading-relaxed text-fg-3">
              Fallaron: {failedDevices.slice(0, 5).map((d) => `${d.name ?? d.id.slice(0, 8)}${d.external_ref ? ` (${d.external_ref})` : ''}`).join(', ')}
              {failedDevices.length > 5 && ` y ${failedDevices.length - 5} más`}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
