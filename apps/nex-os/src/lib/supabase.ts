import { createClient, SupabaseClient } from '@supabase/supabase-js';

function readSupabaseEnv() {
  // VITE_SUPABASE_* es el nombre correcto. VITE_SUPBASE_* cubre el typo frecuente en Vercel.
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPBASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPBASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPBASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return { url, anonKey };
}

const { url, anonKey } = readSupabaseEnv();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function getSupabaseErrorMessage(err: unknown, fallback = 'Error de Supabase'): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as { message?: string; details?: string; hint?: string; code?: string };
    if (o.message) {
      if (o.message.includes('owner_user_id')) {
        return `${o.message} — ejecutá supabase/schema-v2.sql en el SQL Editor`;
      }
      if (o.message.includes('user_profiles') || o.message.includes('verification_requests')) {
        return `${o.message} — ejecutá supabase/schema-profiles-v4.sql en el SQL Editor`;
      }
      if (o.code === '42501') return 'Sin permiso (RLS). Revisá las políticas en Supabase.';
      return o.details ? `${o.message}: ${o.details}` : o.message;
    }
  }
  return fallback;
}

export async function ensureSupabaseSession(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado (VITE_SUPABASE_URL / KEY)');

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error(sessionErr.message);
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const { data, error: signErr } = await supabase.auth.signInAnonymously();
  if (signErr) {
    throw new Error(
      signErr.message.includes('Anonymous')
        ? 'Activá Anonymous sign-ins en Supabase → Authentication → Providers'
        : signErr.message,
    );
  }
  if (!data.user?.id) throw new Error('No se pudo iniciar sesión anónima');
  return data.user.id;
}

export interface DbGlobalPlaylist {
  id: string;
  name: string;
  cover: string | null;
  tracks: unknown;
  owner_nickname: string;
  owner_user_id: string | null;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbPlaylistVote {
  id: string;
  playlist_id: string;
  voter_nickname: string;
  user_id: string | null;
  created_at: string;
}

export interface DbPlaylistReaction {
  id: string;
  playlist_id: string;
  emoji: string;
  user_nickname: string;
  user_id: string | null;
  created_at: string;
}

export interface DbUserLibrary {
  user_id: string;
  nickname: string | null;
  favorites: unknown;
  history: unknown;
  updated_at: string;
}

export interface DbUserProfile {
  user_id: string;
  nickname: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  verified_at: string | null;
  verified_reason: string | null;
}
