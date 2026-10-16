import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from '../lib/supabase';

/**
 * Cliente de Supabase exclusivo del panel.
 *
 * - Sesión en sessionStorage, con clave propia: no se comparte con NEX Music (que usa
 *   sesiones anónimas en localStorage en el mismo dominio) y se borra al cerrar la pestaña.
 * - Sin lectura de tokens desde la URL.
 */
const { url, anonKey } = readSupabaseEnv();

export const isAdminSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
  if (!isAdminSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storageKey: 'nex-mdm-admin-session',
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
