import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export async function fetchPlaylistComments(playlistId: string) {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('playlist_comments')
    .select('id, user_nickname, body, created_at')
    .eq('playlist_id', playlistId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return [];
  return data ?? [];
}

export async function postPlaylistComment(playlistId: string, nickname: string, body: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.from('playlist_comments').insert({
    playlist_id: playlistId,
    user_nickname: nickname,
    body: body.trim().slice(0, 280),
  });
  if (error) throw error;
}

export async function isFollowingCreator(follower: string, creator: string) {
  const supabase = getSupabase();
  if (!supabase || !follower || !creator) return false;
  const { data } = await supabase
    .from('creator_follows')
    .select('id')
    .eq('follower_nickname', follower)
    .eq('creator_nickname', creator)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function toggleFollowCreator(follower: string, creator: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  if (follower === creator) return false;
  const following = await isFollowingCreator(follower, creator);
  if (following) {
    await supabase
      .from('creator_follows')
      .delete()
      .eq('follower_nickname', follower)
      .eq('creator_nickname', creator);
    return false;
  }
  await supabase.from('creator_follows').insert({
    follower_nickname: follower,
    creator_nickname: creator,
  });
  return true;
}

export type FollowStats = {
  followers: number;
  following: number;
};

/** Counts for a creator nickname (case-insensitive via ilike exact). */
export async function fetchFollowStats(nickname: string): Promise<FollowStats> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured || !nickname.trim()) {
    return { followers: 0, following: 0 };
  }
  const nick = nickname.trim();
  const [{ count: followers, error: e1 }, { count: following, error: e2 }] = await Promise.all([
    supabase
      .from('creator_follows')
      .select('id', { count: 'exact', head: true })
      .ilike('creator_nickname', nick),
    supabase
      .from('creator_follows')
      .select('id', { count: 'exact', head: true })
      .ilike('follower_nickname', nick),
  ]);
  if (e1 || e2) {
    // Table missing → zeros
    return { followers: 0, following: 0 };
  }
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function fetchFollowerNicknames(creatorNickname: string, limit = 50): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || !creatorNickname.trim()) return [];
  const { data, error } = await supabase
    .from('creator_follows')
    .select('follower_nickname')
    .ilike('creator_nickname', creatorNickname.trim())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => r.follower_nickname as string);
}

export async function fetchFollowingNicknames(followerNickname: string, limit = 50): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || !followerNickname.trim()) return [];
  const { data, error } = await supabase
    .from('creator_follows')
    .select('creator_nickname')
    .ilike('follower_nickname', followerNickname.trim())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => r.creator_nickname as string);
}
