import {
  ensureSupabaseSession,
  getSupabase,
  getSupabaseErrorMessage,
  isSupabaseConfigured,
} from '../lib/supabase';

export type VerifiedReason = 'creator' | 'artist' | 'staff' | 'partner';

export interface UserProfile {
  userId: string;
  nickname: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verifiedReason: VerifiedReason | null;
}

export interface ProfilePublic {
  nickname: string;
  displayName: string | null;
  bio: string | null;
  verified: boolean;
  verifiedReason: VerifiedReason | null;
}

type DbProfile = {
  user_id: string;
  nickname: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  verified_at: string | null;
  verified_reason: string | null;
};

function mapProfile(row: DbProfile): UserProfile {
  return {
    userId: row.user_id,
    nickname: row.nickname,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at,
    verifiedReason: (row.verified_reason as VerifiedReason | null) ?? null,
  };
}

/** Upsert own profile when nickname is set (cannot self-verify — DB trigger). */
export async function upsertMyProfile(nickname: string, userId?: string | null): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return null;
  const nick = nickname.trim().slice(0, 32);
  if (!nick) return null;

  const uid = userId || (await ensureSupabaseSession());
  // Don't clobber display_name/bio on every visit — only ensure row exists
  const existing = await supabase
    .from('user_profiles')
    .select(
      'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
    )
    .eq('user_id', uid)
    .maybeSingle();

  if (existing.data) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        nickname: nick,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', uid)
      .select(
        'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
      )
      .single();
    if (error) {
      console.warn('[profiles]', getSupabaseErrorMessage(error));
      return mapProfile(existing.data as DbProfile);
    }
    return data ? mapProfile(data as DbProfile) : null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: uid,
      nickname: nick,
      display_name: nick,
      updated_at: new Date().toISOString(),
    })
    .select(
      'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
    )
    .single();

  if (error) {
    console.warn('[profiles]', getSupabaseErrorMessage(error));
    return null;
  }
  return data ? mapProfile(data as DbProfile) : null;
}

export async function fetchMyProfile(userId?: string | null): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return null;
  const uid = userId || (await ensureSupabaseSession().catch(() => null));
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
    )
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data as DbProfile);
}

/** Batch lookup by nicknames (case-insensitive). */
export async function fetchProfilesByNicknames(nicknames: string[]): Promise<Map<string, ProfilePublic>> {
  const map = new Map<string, ProfilePublic>();
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return map;

  const unique = [...new Set(nicknames.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return map;

  const normalized = unique.map((n) => n.toLowerCase());
  const { data, error } = await supabase
    .from('user_profiles')
    .select('nickname, display_name, bio, verified, verified_reason, nickname_normalized')
    .in('nickname_normalized', normalized);

  if (error || !data) return map;

  for (const row of data as {
    nickname: string;
    display_name: string | null;
    bio: string | null;
    verified: boolean;
    verified_reason: string | null;
    nickname_normalized: string;
  }[]) {
    const pub: ProfilePublic = {
      nickname: row.nickname,
      displayName: row.display_name,
      bio: row.bio,
      verified: Boolean(row.verified),
      verifiedReason: (row.verified_reason as VerifiedReason | null) ?? null,
    };
    map.set(row.nickname_normalized, pub);
    map.set(row.nickname.toLowerCase(), pub);
  }
  return map;
}

/** Search public profiles by nickname (ilike). Empty query → verified first. */
export async function searchUserProfiles(query: string, limit = 40): Promise<ProfilePublic[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];

  const q = query.trim();
  let req = supabase
    .from('user_profiles')
    .select('nickname, display_name, bio, verified, verified_reason, updated_at')
    .order('verified', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`nickname.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error) {
    console.warn('[profiles search]', getSupabaseErrorMessage(error));
    return [];
  }

  return (data ?? []).map((row) => ({
    nickname: row.nickname as string,
    displayName: (row.display_name as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    verified: Boolean(row.verified),
    verifiedReason: (row.verified_reason as VerifiedReason | null) ?? null,
  }));
}

export async function fetchProfileByNickname(nickname: string): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured || !nickname.trim()) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
    )
    .eq('nickname_normalized', nickname.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data as DbProfile);
}

export async function updateMyProfileFields(fields: {
  displayName?: string;
  bio?: string;
}): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const uid = await ensureSupabaseSession();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.displayName !== undefined) {
    patch.display_name = fields.displayName.trim().slice(0, 48) || null;
  }
  if (fields.bio !== undefined) {
    patch.bio = fields.bio.trim().slice(0, 160) || null;
  }
  const { data, error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('user_id', uid)
    .select(
      'user_id, nickname, display_name, bio, avatar_url, verified, verified_at, verified_reason',
    )
    .single();
  if (error) throw new Error(getSupabaseErrorMessage(error));
  return data ? mapProfile(data as DbProfile) : null;
}

export type OwnerPlaylistSummary = {
  id: string;
  name: string;
  cover: string | null;
  trackCount: number;
  playCount: number;
};

export async function fetchPlaylistsByOwnerNickname(nickname: string): Promise<OwnerPlaylistSummary[]> {
  const supabase = getSupabase();
  if (!supabase || !nickname.trim()) return [];
  const { data, error } = await supabase
    .from('global_playlists')
    .select('id, name, cover, tracks, play_count, owner_nickname')
    .ilike('owner_nickname', nickname.trim())
    .order('play_count', { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    cover: (row.cover as string | null) ?? null,
    trackCount: Array.isArray(row.tracks) ? row.tracks.length : 0,
    playCount: Number(row.play_count ?? 0),
  }));
}

export function isNicknameVerified(map: Map<string, ProfilePublic>, nickname: string | undefined | null): boolean {
  if (!nickname) return false;
  return Boolean(map.get(nickname.trim().toLowerCase())?.verified);
}

export async function requestVerification(nickname: string, message?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const uid = await ensureSupabaseSession();
  const { error } = await supabase.from('verification_requests').insert({
    user_id: uid,
    nickname: nickname.trim().slice(0, 32),
    message: message?.trim().slice(0, 280) || null,
    status: 'pending',
  });
  if (error) {
    if (error.code === '23505') throw new Error('Ya tenés una solicitud pendiente');
    if (error.message?.includes('verification_requests') || error.code === '42P01') {
      throw new Error('Ejecutá supabase/schema-profiles-v4.sql en Supabase');
    }
    throw new Error(getSupabaseErrorMessage(error));
  }
}

export function verifiedReasonLabel(reason: VerifiedReason | null | undefined): string {
  switch (reason) {
    case 'artist':
      return 'Artista verificado';
    case 'staff':
      return 'Staff NEX';
    case 'partner':
      return 'Partner';
    case 'creator':
    default:
      return 'Creador verificado';
  }
}
