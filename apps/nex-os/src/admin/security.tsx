import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LogOut, ShieldCheck, TimerReset } from 'lucide-react';
import { ApiError, db } from './api';
import { lastTotpAt, STEP_UP_WINDOW_MS, StepUpContext, type StepUpApi } from './stepUp';
import { useToast } from './toast';
import { Button, ErrorText, inputClass, Modal } from './ui';

const MAX_STEP_UP_FAILURES = 5;

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
}

/**
 * Verificación reforzada: antes de una acción crítica pide el código TOTP si el último
 * tiene más de 4 minutos. Tras 5 códigos incorrectos seguidos cierra la sesión
 * (un token robado no alcanza para operar a fuerza de intentos).
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const failures = useRef(0);

  const prompt = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        setCode('');
        setError(null);
        setPending({ resolve, reject });
      }),
    [],
  );

  const guard = useCallback<StepUpApi['guard']>(
    async (action) => {
      const { data } = await db().auth.getSession();
      if (Date.now() - lastTotpAt(data.session) > STEP_UP_WINDOW_MS) await prompt();
      try {
        return await action();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'P0401') {
          await prompt();
          return action();
        }
        throw err;
      }
    },
    [prompt],
  );

  const cancel = () => {
    pending?.reject(new ApiError('Acción cancelada: no se confirmó el segundo factor', 'cancelled'));
    setPending(null);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const auth = db().auth;
      const { data } = await auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      if (!totp) throw new Error('No hay un segundo factor configurado');
      const { error: err } = await auth.mfa.challengeAndVerify({ factorId: totp.id, code });
      if (err) {
        failures.current += 1;
        if (failures.current >= MAX_STEP_UP_FAILURES) {
          pending.reject(new ApiError('Demasiados códigos incorrectos: se cerró la sesión', 'locked_out'));
          setPending(null);
          await auth.signOut();
          return;
        }
        setCode('');
        throw new Error(`Código incorrecto (${MAX_STEP_UP_FAILURES - failures.current} intentos restantes)`);
      }
      failures.current = 0;
      pending.resolve();
      setPending(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ guard }), [guard]);

  return (
    <StepUpContext.Provider value={value}>
      {children}
      {pending && (
        <Modal title="Confirmá que sos vos" description="Esta acción es sensible. Ingresá el código de tu app de autenticación." onClose={cancel} width="max-w-sm">
          <form onSubmit={verify} className="flex flex-col gap-4">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </span>
            </div>
            <input
              className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <ErrorText error={error} />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={cancel}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={busy || code.length !== 6}>Confirmar</Button>
            </div>
            <p className="text-center text-xs text-zinc-500">No se vuelve a pedir durante unos minutos.</p>
          </form>
        </Modal>
      )}
    </StepUpContext.Provider>
  );
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

/** Cierra la sesión tras un período sin actividad, con aviso previo de 60 segundos. */
export function IdleGuard({ idleMinutes = 15 }: { idleMinutes?: number }) {
  const toast = useToast();
  const idleMs = idleMinutes * 60_000;
  const warnMs = 60_000;
  const lastActivity = useRef(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  const signOut = useCallback(async () => {
    await db().auth.signOut();
    toast.show('Sesión cerrada por inactividad', 'info');
  }, [toast]);

  useEffect(() => {
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleMs) {
        clearInterval(timer);
        signOut();
      } else if (idle >= idleMs - warnMs) {
        setRemaining(Math.ceil((idleMs - idle) / 1000));
      } else {
        setRemaining(null);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, touch));
    };
  }, [idleMs, signOut]);

  if (remaining === null) return null;
  return (
    <Modal
      title="¿Seguís ahí?"
      description={`Por seguridad, la sesión se cierra en ${remaining} segundos.`}
      onClose={() => {
        lastActivity.current = Date.now();
        setRemaining(null);
      }}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" icon={LogOut} onClick={signOut}>Cerrar sesión</Button>
          <Button
            icon={TimerReset}
            onClick={() => {
              lastActivity.current = Date.now();
              setRemaining(null);
            }}
          >
            Seguir conectado
          </Button>
        </>
      }
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(remaining / 60) * 100}%` }} />
      </div>
    </Modal>
  );
}
