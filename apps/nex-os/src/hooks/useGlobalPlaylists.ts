import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensureSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseConfigured,
  type DbGlobalPlaylist,
  type DbPlaylistReaction,
  type DbPlaylistVote,
} from '../lib/supabase';
import { scoreTrending, sortCloudPlaylists, type GlobalRanking } from '../utils/cloudPlaylist';
import type { Playlist, Track } from '../types/music';

export const REACTION_EMOJIS = ['🔥', '❤️', '🎧', '😍', '🙌', '💜'] as const;

export interface CloudPlaylistView {
  id: string;
  name: string;
  cover?: string;
  tracks: Track[];
  ownerName: string;
  createdAt: number;
  playCount: number;
  votes: string[];
  voterUserIds: string[];
  voteTimestamps: { nickname: string; userId: string | null; at: number }[];
  reactionSummary: Record<string, number>;
  recentReactions: { emoji: string; user: string; at: number }[];
  weeklyVotes: number;
  trendingScore: number;
}

const CLOUD_MAP_KEY = 'nexCloudPlaylistMap';

function getCloudMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCloudMap(map: Record<string, string>) {
  localStorage.setItem(CLOUD_MAP_KEY, JSON.stringify(map));
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

function buildViews(
  rows: DbGlobalPlaylist[],
  votes: DbPlaylistVote[],
  reactions: DbPlaylistReaction[],
): CloudPlaylistView[] {
  const votesByPlaylist = new Map<string, DbPlaylistVote[]>();
  for (const v of votes) {
    const list = votesByPlaylist.get(v.playlist_id) ?? [];
    list.push(v);
    votesByPlaylist.set(v.playlist_id, list);
  }

  const reactionsByPlaylist = new Map<string, DbPlaylistReaction[]>();
  for (const r of reactions) {
    const list = reactionsByPlaylist.get(r.playlist_id) ?? [];
    list.push(r);
    reactionsByPlaylist.set(r.playlist_id, list);
  }

  return rows.map((row) => {
    const playlistVotes = votesByPlaylist.get(row.id) ?? [];
    const playlistReactions = reactionsByPlaylist.get(row.id) ?? [];

    const reactionSummary: Record<string, number> = {};
    const recentReactions: { emoji: string; user: string; at: number }[] = [];

    for (const r of playlistReactions) {
      reactionSummary[r.emoji] = (reactionSummary[r.emoji] ?? 0) + 1;
      recentReactions.push({
        emoji: r.emoji,
        user: r.user_nickname,
        at: new Date(r.created_at).getTime(),
      });
    }
    recentReactions.sort((a, b) => b.at - a.at);

    const voteTimestamps = playlistVotes.map((v) => ({
      nickname: v.voter_nickname,
      userId: v.user_id,
      at: new Date(v.created_at).getTime(),
    }));

    const { weeklyVotes, trendingScore } = scoreTrending(
      voteTimestamps,
      recentReactions,
      row.play_count ?? 0,
    );

    return {
      id: row.id,
      name: row.name,
      cover: row.cover ?? undefined,
      tracks: parseTracks(row.tracks),
      ownerName: row.owner_nickname,
      createdAt: new Date(row.created_at).getTime(),
      playCount: row.play_count ?? 0,
      votes: playlistVotes.map((v) => v.voter_nickname),
      voterUserIds: playlistVotes.map((v) => v.user_id).filter(Boolean) as string[],
      voteTimestamps,
      reactionSummary,
      recentReactions: recentReactions.slice(0, 8),
      weeklyVotes,
      trendingScore,
    };
  });
}

export function useGlobalPlaylists(nickname: string, userId: string | null) {
  const [playlists, setPlaylists] = useState<CloudPlaylistView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<GlobalRanking>('trending');
  const [liveReaction, setLiveReaction] = useState<{ playlistId: string; emoji: string; user: string } | null>(null);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from('global_playlists')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (rowsErr) throw rowsErr;
      const playlistRows = (rows ?? []) as DbGlobalPlaylist[];
      const ids = playlistRows.map((r) => r.id);

      if (ids.length === 0) {
        setPlaylists([]);
        return;
      }

      const [{ data: voteRows, error: votesErr }, { data: reactionRows, error: reactionsErr }] =
        await Promise.all([
          supabase.from('playlist_votes').select('*').in('playlist_id', ids),
          supabase
            .from('playlist_reactions')
            .select('*')
            .in('playlist_id', ids)
            .order('created_at', { ascending: false })
            .limit(800),
        ]);

      if (votesErr) throw votesErr;
      if (reactionsErr) throw reactionsErr;

      setPlaylists(
        buildViews(
          playlistRows,
          (voteRows ?? []) as DbPlaylistVote[],
          (reactionRows ?? []) as DbPlaylistReaction[],
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar listas globales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    refresh();

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('nex-global-playlists')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_playlists' }, () => {
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_votes' }, () => {
        refresh();
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'playlist_reactions' },
        (payload) => {
          const row = payload.new as DbPlaylistReaction;
          if (row.user_nickname !== nicknameRef.current) {
            setLiveReaction({
              playlistId: row.playlist_id,
              emoji: row.emoji,
              user: row.user_nickname,
            });
            setTimeout(() => setLiveReaction(null), 2500);
          }
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const sortedPlaylists = sortCloudPlaylists(playlists, ranking);

  const publishPlaylist = useCallback(
    async (playlist: Playlist): Promise<string> => {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase no configurado. Revisá VITE_SUPABASE_URL en .env');
      }
      if (!nickname?.trim()) {
        throw new Error('Configurá tu nickname primero');
      }
      if (playlist.tracks.length === 0) {
        throw new Error('La lista está vacía — agregá canciones antes de publicar');
      }

      const ownerUserId = userId ?? (await ensureSupabaseSession());

      const cover =
        playlist.cover?.startsWith('http')
          ? playlist.cover
          : playlist.tracks[0]?.cover || null;

      const tracks = playlist.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        cover: t.cover,
        url: t.url,
        service: t.service,
        kind: t.kind,
        videoId: t.videoId ?? t.id,
      }));

      const map = getCloudMap();
      const cloudId = map[playlist.id];

      const row: Record<string, unknown> = {
        name: playlist.name,
        cover,
        tracks,
        owner_nickname: nickname,
        updated_at: new Date().toISOString(),
      };
      if (ownerUserId) row.owner_user_id = ownerUserId;

      const publishTimeoutMs = 15_000;
      const withTimeout = <T,>(promise: PromiseLike<T>, label: string) =>
        Promise.race([
          Promise.resolve(promise),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${label} (15s)`)), publishTimeoutMs),
          ),
        ]);

      if (cloudId) {
        const { error: updateErr } = await withTimeout(
          supabase.from('global_playlists').update(row).eq('id', cloudId),
          'actualizar lista',
        );
        if (updateErr) throw updateErr;
        void refresh();
        return cloudId;
      }

      const { data, error: insertErr } = await withTimeout(
        supabase.from('global_playlists').insert(row).select('id').single(),
        'publicar lista',
      );

      if (insertErr) throw insertErr;
      if (!data?.id) throw new Error('Supabase no devolvió el ID de la lista');

      map[playlist.id] = data.id;
      saveCloudMap(map);
      void refresh();
      return data.id;
    },
    [nickname, userId, refresh],
  );

  const hasVoted = useCallback(
    (playlist: CloudPlaylistView) => {
      if (userId && playlist.voterUserIds.includes(userId)) return true;
      return nickname ? playlist.votes.includes(nickname) : false;
    },
    [userId, nickname],
  );

  const toggleVote = useCallback(
    async (playlistId: string, voted: boolean) => {
      const supabase = getSupabase();
      if (!supabase || !nickname || !userId) return;

      if (voted) {
        await supabase
          .from('playlist_votes')
          .delete()
          .eq('playlist_id', playlistId)
          .eq('user_id', userId);
      } else {
        await supabase.from('playlist_votes').insert({
          playlist_id: playlistId,
          voter_nickname: nickname,
          user_id: userId,
        });
      }
    },
    [nickname, userId],
  );

  const sendReaction = useCallback(
    async (playlistId: string, emoji: string) => {
      const supabase = getSupabase();
      if (!supabase || !nickname || !userId) return;

      await supabase.from('playlist_reactions').insert({
        playlist_id: playlistId,
        emoji,
        user_nickname: nickname,
        user_id: userId,
      });
    },
    [nickname, userId],
  );

  const trackPlay = useCallback(async (playlistId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.rpc('increment_playlist_plays', { playlist_uuid: playlistId });
  }, []);

  return {
    enabled: isSupabaseConfigured,
    playlists: sortedPlaylists,
    ranking,
    setRanking,
    loading,
    error,
    liveReaction,
    refresh,
    publishPlaylist,
    hasVoted,
    toggleVote,
    sendReaction,
    trackPlay,
    getCloudId: (localId: string) => getCloudMap()[localId] ?? null,
    userId,
  };
}
