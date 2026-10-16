import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

interface SupabaseAuthState {
  userId: string | null;
  isReady: boolean;
  error: string | null;
  isEnabled: boolean;
  retry: () => void;
}

const SupabaseAuthContext = createContext<SupabaseAuthState>({
  userId: null,
  isReady: true,
  error: null,
  isEnabled: false,
  retry: () => {},
});

let authInitPromise: Promise<{ userId: string | null; error: string | null }> | null = null;

async function initSupabaseAuth(): Promise<{ userId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { userId: null, error: null };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { userId: null, error: 'No se pudo crear el cliente Supabase' };
  }

  const timeoutMs = 12_000;
  const work = async (): Promise<{ userId: string | null; error: string | null }> => {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      return { userId: null, error: sessionErr.message };
    }
    if (sessionData.session?.user) {
      return { userId: sessionData.session.user.id, error: null };
    }

    const { data, error: signErr } = await supabase.auth.signInAnonymously();
    if (signErr) {
      const msg = signErr.message.includes('Anonymous')
        ? 'Activá Anonymous sign-ins en Supabase → Authentication → Providers'
        : signErr.message;
      return { userId: null, error: msg };
    }
    return { userId: data.user?.id ?? null, error: data.user ? null : 'Auth anónima sin usuario' };
  };

  try {
    return await Promise.race([
      work(),
      new Promise<{ userId: null; error: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout conectando a Supabase (12s)')), timeoutMs),
      ),
    ]);
  } catch (err) {
    return {
      userId: null,
      error: err instanceof Error ? err.message : 'Error de conexión con Supabase',
    };
  }
}

function runAuthInit(): Promise<{ userId: string | null; error: string | null }> {
  if (!authInitPromise) {
    authInitPromise = initSupabaseAuth().finally(() => {
      // Mantener promise resuelta para lecturas posteriores
    });
  }
  return authInitPromise;
}

export function resetSupabaseAuth() {
  authInitPromise = null;
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsReady(true);
      setUserId(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    setError(null);

    runAuthInit().then(({ userId: uid, error: err }) => {
      if (cancelled) return;
      setUserId(uid);
      setError(err);
      setIsReady(true);
    });

    const supabase = getSupabase();
    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, [attempt]);

  const retry = () => {
    resetSupabaseAuth();
    setAttempt((a) => a + 1);
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        userId,
        isReady,
        error,
        isEnabled: isSupabaseConfigured,
        retry,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

/** @deprecated use useSupabaseAuthContext */
export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}

export function useSupabaseAuthContext() {
  return useContext(SupabaseAuthContext);
}
