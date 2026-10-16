import { useCallback, useEffect, useState } from 'react';

export type RepeatMode = 'off' | 'all' | 'one';

const REPEAT_KEY = 'nexMusicRepeatMode';
const SHUFFLE_KEY = 'nexMusicShuffle';

function loadRepeat(): RepeatMode {
  try {
    const v = localStorage.getItem(REPEAT_KEY);
    if (v === 'all' || v === 'one' || v === 'off') return v;
  } catch { /* ignore */ }
  return 'off';
}

export function usePlaybackModes() {
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>(() => loadRepeat());
  const [shuffleOn, setShuffleOnState] = useState(() => {
    try {
      return localStorage.getItem(SHUFFLE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(REPEAT_KEY, repeatMode); } catch { /* ignore */ }
  }, [repeatMode]);

  useEffect(() => {
    try { localStorage.setItem(SHUFFLE_KEY, shuffleOn ? '1' : '0'); } catch { /* ignore */ }
  }, [shuffleOn]);

  const cycleRepeat = useCallback(() => {
    setRepeatModeState((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleOnState((v) => !v);
  }, []);

  return {
    repeatMode,
    shuffleOn,
    cycleRepeat,
    toggleShuffle,
    setRepeatMode: setRepeatModeState,
    setShuffleOn: setShuffleOnState,
  };
}
