import { useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { Track } from '../types/music';

export type CloudSyncStatus = 'off' | 'connecting' | 'synced' | 'saving' | 'error';

function parseTracks(raw: unknown): Track[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Track => t && typeof t === 'object' && 'id' in t)
    .map((t) => ({
      id: String(t.id),
      title: String(t.title ?? ''),
      artist: String(t.artist ?? ''),
      cover: String(t.cover ?? ''),
      url: String(t.url ?? ''),
      service: (t.service as Track['service']) ?? 'youtube',
      kind: t.kind,
      videoId: t.videoId ? String(t.videoId) : String(t.id),
    }));
}

interface UseCloudLibraryOptions {
  userId: string | null;
  isAuthReady: boolean;
  authError: string | null;
  nickname: string;
  favorites: Track[];
  history: Track[];
  setFavorites: React.Dispatch<React.SetStateAction<Track[]>>;
  setHistory: React.Dispatch<React.SetStateAction<Track[]>>;
  onSynced?: () => void;
}

export function useCloudLibrary({
  userId,
  isAuthReady,
  authError,
  nickname,
  favorites,
  history,
  setFavorites,
  setHistory,
  onSynced,
}: UseCloudLibraryOptions) {
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const skipNextSaveRef = useRef(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('off');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCloudSyncStatus('off');
      return;
    }
    if (!isAuthReady) {
      setCloudSyncStatus('connecting');
      return;
    }
    if (authError || !userId) {
      setCloudSyncStatus('error');
      return;
    }
    if (!loadedRef.current) {
      setCloudSyncStatus('connecting');
    }
  }, [isAuthReady, userId, authError]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isAuthReady || !userId || loadedRef.current) return;

    const supabase = getSupabase();
    if (!supabase) return;

    setCloudSyncStatus('connecting');

    const loadTimeoutMs = 12_000;
    let timedOut = false;

    (async () => {
      try {
        const queryPromise = supabase
          .from('user_library')
          .select('favorites, history, updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        const { data, error } = await Promise.race([
          queryPromise,
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => {
              timedOut = true;
              resolve({ data: null, error: { message: 'Timeout cargando biblioteca (12s)' } });
            }, loadTimeoutMs),
          ),
        ]);

        if (timedOut) {
          loadedRef.current = true;
          setCloudSyncStatus('error');
          return;
        }

        loadedRef.current = true;

        if (error) {
          console.warn('[NEX Music] user_library:', error.message);
          setCloudSyncStatus('error');
          return;
        }

        if (data) {
          const cloudFavorites = parseTracks(data.favorites);
          const cloudHistory = parseTracks(data.history);

          skipNextSaveRef.current = true;
          if (cloudFavorites.length > 0) {
            setFavorites((local) => mergeTracks(cloudFavorites, local));
          }
          if (cloudHistory.length > 0) {
            setHistory((local) => mergeTracks(cloudHistory, local).slice(0, 50));
          }
          onSynced?.();
        }

        setCloudSyncStatus('synced');
      } catch (err) {
        loadedRef.current = true;
        console.warn('[NEX Music] user_library:', err);
        setCloudSyncStatus('error');
      }
    })();
  }, [userId, isAuthReady, setFavorites, setHistory, onSynced]);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId || !loadedRef.current) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setCloudSyncStatus('saving');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const payload = {
        user_id: userId,
        nickname,
        favorites,
        history: history.slice(0, 50),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('user_library').upsert(payload, { onConflict: 'user_id' });
      setCloudSyncStatus('synced');
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [userId, nickname, favorites, history]);

  return {
    cloudSyncEnabled: isSupabaseConfigured && !!userId,
    cloudSyncStatus,
  };
}

function mergeTracks(cloud: Track[], local: Track[]): Track[] {
  const map = new Map<string, Track>();
  for (const t of [...local, ...cloud]) {
    if (!map.has(t.id)) map.set(t.id, t);
  }
  return Array.from(map.values());
}
