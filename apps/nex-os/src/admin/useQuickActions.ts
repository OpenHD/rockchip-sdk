import { useCallback } from 'react';
import { rpcSetLock, rpcSetPaidUntil, rpcSetRestricted, type Device } from './api';
import { nextPaidUntil } from './bulk';
import { formatDate } from './format';
import { useToast } from './toast';

type QuickDevice = Pick<Device, 'id' | 'name' | 'paid_until' | 'locked' | 'lock_reason' | 'restricted' | 'restrict_reason'>;

/**
 * Acciones de un toque sobre un equipo, con "Deshacer" en el aviso: sumar un mes de pago, desbloquear y quitar la restricción.
 * Deshacer vuelve a dejar el equipo como estaba (misma fecha de pago, mismo motivo de bloqueo).
 * Bloquear y restringir no están acá: cortan el servicio y piden motivo en su propio diálogo.
 */
export function useQuickActions(reload: () => void) {
  const toast = useToast();

  const attempt = useCallback(
    async (fn: () => Promise<unknown>, done: string, undo: () => Promise<unknown>, undone: string) => {
      try {
        await fn();
        reload();
        toast.show(done, 'success', {
          label: 'Deshacer',
          onClick: () => {
            undo().then(
              () => {
                toast.show(undone, 'info');
                reload();
              },
              (err: Error) => toast.show(`No se pudo deshacer: ${err.message}`, 'error'),
            );
          },
        });
        return true;
      } catch (err) {
        toast.show((err as Error).message, 'error');
        return false;
      }
    },
    [reload, toast],
  );

  const label = (d: QuickDevice) => d.name ?? 'el equipo';

  /** Registra un mes más de pago. Solo para equipos que ya tienen control de pago (los demás eligen la fecha en el diálogo). */
  const payOneMonth = useCallback(
    (d: QuickDevice) => {
      const until = nextPaidUntil(d.paid_until, 1);
      return attempt(
        () => rpcSetPaidUntil(d.id, until),
        `Pago registrado: ${label(d)} queda pagado hasta el ${formatDate(until)}`,
        () => rpcSetPaidUntil(d.id, d.paid_until, 'Corrección: pago registrado por error'),
        `Listo, ${label(d)} volvió a como estaba`,
      );
    },
    [attempt],
  );

  const unlock = useCallback(
    (d: QuickDevice) =>
      attempt(
        () => rpcSetLock(d.id, false),
        `Desbloqueo enviado a ${label(d)}`,
        () => rpcSetLock(d.id, true, d.lock_reason),
        `Listo, ${label(d)} sigue bloqueado`,
      ),
    [attempt],
  );

  const unrestrict = useCallback(
    (d: QuickDevice) =>
      attempt(
        () => rpcSetRestricted(d.id, false),
        `Restricción quitada a ${label(d)}`,
        () => rpcSetRestricted(d.id, true, d.restrict_reason),
        `Listo, ${label(d)} sigue restringido`,
      ),
    [attempt],
  );

  return { payOneMonth, unlock, unrestrict };
}
