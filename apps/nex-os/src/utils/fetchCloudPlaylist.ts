import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { Track } from '../types/music';

export interface CloudPlaylistDetail {
  id: string;
  name: string;
  cover?: string;
  tracks: Track[];
  ownerName: string;
  createdAt: number;
}

function parseTracks(raw: unknown): Track[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Track => t && typeof t === 'object' && 'id' in t && 'title' in t)
    .map((t) => ({
      id: String(t.id),
      title: String(t.title),
      artist: String(t.artist ?? ''),
      cover: String(t.cover ?? ''),
      url: String(t.url ?? ''),
      service: (t.service as Track['service']) ?? 'youtube',
      kind: t.kind,
      videoId: t.videoId ? String(t.videoId) : String(t.id),
    }));
}

/** Fetch a single published playlist by UUID (for ?cloud= deep links). */
export async function fetchCloudPlaylistById(id: string): Promise<CloudPlaylistDetail | null> {
  if (!isSupabaseConfigured || !id.trim()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('global_playlists')
    .select('id, name, cover, tracks, owner_nickname, created_at')
    .eq('id', id.trim())
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    cover: data.cover ?? undefined,
    tracks: parseTracks(data.tracks),
    ownerName: data.owner_nickname || 'Anonymous',
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  };
}
