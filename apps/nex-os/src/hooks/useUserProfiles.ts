import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyProfile,
  fetchProfilesByNicknames,
  isNicknameVerified,
  requestVerification,
  upsertMyProfile,
  type ProfilePublic,
  type UserProfile,
  type VerifiedReason,
} from '../utils/userProfiles';

export function useUserProfiles(nickname: string, userId: string | null) {
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!nickname?.trim() || !userId) return;
    let cancelled = false;
    setSyncing(true);
    void upsertMyProfile(nickname, userId)
      .then((p) => {
        if (!cancelled) setMyProfile(p);
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nickname, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const p = await fetchMyProfile(userId);
    setMyProfile(p);
  }, [userId]);

  const requestVerify = useCallback(
    async (message?: string) => {
      if (!nickname) throw new Error('Configurá tu nickname');
      await requestVerification(nickname, message);
      await refresh();
    },
    [nickname, refresh],
  );

  return { myProfile, syncing, refresh, requestVerify, isVerified: Boolean(myProfile?.verified) };
}

/** Load verified map for a list of nicknames (playlist owners, commenters). */
export function useVerifiedMap(nicknames: string[]) {
  const [map, setMap] = useState<Map<string, ProfilePublic>>(() => new Map());
  const key = nicknames
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');

  useEffect(() => {
    if (!key) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    const list = key.split('|');
    void fetchProfilesByNicknames(list).then((m) => {
      if (!cancelled) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const isVerified = useCallback(
    (nick: string | undefined | null) => isNicknameVerified(map, nick),
    [map],
  );

  const reasonFor = useCallback(
    (nick: string | undefined | null): VerifiedReason | null => {
      if (!nick) return null;
      return map.get(nick.trim().toLowerCase())?.verifiedReason ?? null;
    },
    [map],
  );

  return { map, isVerified, reasonFor };
}
