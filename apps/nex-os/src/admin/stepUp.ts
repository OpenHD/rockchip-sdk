import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

/** El servidor exige TOTP de hace menos de 5 min; el panel lo pide si pasaron más de 4 (margen de reloj). */
export const STEP_UP_WINDOW_MS = 4 * 60_000;

export interface StepUpApi {
  /** Ejecuta una acción crítica: pide el código de segundo factor si hace falta y reintenta si el servidor lo exige. */
  guard: <T>(action: () => Promise<T>) => Promise<T>;
}

export const StepUpContext = createContext<StepUpApi>({ guard: (action) => action() });

export function useStepUp(): StepUpApi {
  return useContext(StepUpContext);
}

/** Momento (ms) del último TOTP según el claim "amr" del access token, o 0 si no hay. */
export function lastTotpAt(session: Session | null): number {
  const token = session?.access_token;
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const amr: unknown = payload.amr;
    if (!Array.isArray(amr)) return 0;
    const ts = amr
      .filter((a) => a && typeof a === 'object' && a.method === 'totp' && Number.isFinite(a.timestamp))
      .map((a) => Number(a.timestamp) * 1000);
    return ts.length ? Math.max(...ts) : 0;
  } catch {
    return 0;
  }
}
