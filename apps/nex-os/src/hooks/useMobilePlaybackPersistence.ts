import { useEffect, useRef } from 'react';
import type { Track } from '../types/music';

const SESSION_KEY = 'nexMusicPlaybackSession';

export interface PlaybackSession {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  queue: Track[];
  savedAt: number;
}

export function loadPlaybackSession(): PlaybackSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PlaybackSession;
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function savePlaybackSession(session: Omit<PlaybackSession, 'savedAt'>) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...session, savedAt: Date.now() }),
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

interface UseMobilePlaybackPersistenceOptions {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration?: number;
  volume: number;
  queue: Track[];
  playerRef: React.RefObject<{ playVideo?: () => void; pauseVideo?: () => void; getCurrentTime?: () => number; seekTo?: (s: number, allow: boolean) => void } | null>;
  startProgressTracking: () => void;
  stopProgressTracking: () => void;
  setIsPlaying: (playing: boolean) => void;
  /** Optional: resume DSP / custom player instead of YouTube */
  onResumePlayback?: () => boolean | void;
}

export function useMobilePlaybackPersistence({
  currentTrack,
  isPlaying,
  progress,
  duration = 0,
  volume,
  queue,
  playerRef,
  startProgressTracking,
  stopProgressTracking,
  setIsPlaying,
  onResumePlayback,
}: UseMobilePlaybackPersistenceOptions) {
  const wasPlayingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const onResumeRef = useRef(onResumePlayback);
  onResumeRef.current = onResumePlayback;

  // Persist session — debounce progress writes (every tick was freezing phones)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      savePlaybackSession({ currentTrack, isPlaying, progress, volume, queue });
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentTrack, isPlaying, progress, volume, queue]);

  // Flush immediately on track / play-state changes
  useEffect(() => {
    savePlaybackSession({ currentTrack, isPlaying, progress, volume, queue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, isPlaying, volume, queue]);

  // Resume playback when returning from background / bfcache
  useEffect(() => {
    const resumeIfNeeded = () => {
      if (!wasPlayingRef.current) return;
      if (onResumeRef.current?.()) {
        setIsPlaying(true);
        return;
      }
      if (!playerRef.current?.playVideo) return;
      playerRef.current.playVideo();
      setIsPlaying(true);
      startProgressTracking();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasPlayingRef.current = isPlaying;
        savePlaybackSession({ currentTrack, isPlaying, progress, volume, queue });
        return;
      }
      resumeIfNeeded();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resumeIfNeeded();
    };

    const handlePageHide = () => {
      wasPlayingRef.current = isPlaying;
      savePlaybackSession({ currentTrack, isPlaying, progress, volume, queue });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [
    currentTrack,
    isPlaying,
    progress,
    volume,
    queue,
    playerRef,
    setIsPlaying,
    startProgressTracking,
  ]);

  // Media Session API — lock screen controls on mobile
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.cover
        ? [{ src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    const seekBy = (delta: number) => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || !player?.seekTo) return;
      const next = Math.max(0, player.getCurrentTime() + delta);
      player.seekTo(next, true);
    };

    navigator.mediaSession.setActionHandler('play', () => {
      playerRef.current?.playVideo?.();
      setIsPlaying(true);
      startProgressTracking();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      playerRef.current?.pauseVideo?.();
      setIsPlaying(false);
      stopProgressTracking();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      window.dispatchEvent(new CustomEvent('nex-music-prev'));
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      window.dispatchEvent(new CustomEvent('nex-music-next'));
    });
    try {
      navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime == null || !playerRef.current?.seekTo) return;
        playerRef.current.seekTo(details.seekTime, true);
      });
    } catch {
      /* some browsers don't support seek handlers */
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    return () => {
      ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto'].forEach(
        (action) => {
          try {
            navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
          } catch {
            /* unsupported action */
          }
        },
      );
    };
  }, [currentTrack, isPlaying, playerRef, setIsPlaying, startProgressTracking, stopProgressTracking]);

  // Keep lock-screen scrubber in sync (throttled — every progress tick was expensive on phones)
  const lastPosWriteRef = useRef(0);
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    const durationSec = duration > 0 ? duration : 0;
    if (durationSec <= 0) return;
    const now = Date.now();
    if (now - lastPosWriteRef.current < 1000 && isPlaying) return;
    lastPosWriteRef.current = now;
    try {
      navigator.mediaSession.setPositionState({
        duration: durationSec,
        playbackRate: 1,
        position: Math.min(durationSec, Math.max(0, (progress / 100) * durationSec)),
      });
    } catch {
      /* ignore */
    }
  }, [currentTrack, duration, progress, isPlaying]);

  // Wake Lock while playing (helps on Android PWA)
  useEffect(() => {
    if (!isPlaying || !('wakeLock' in navigator)) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    let cancelled = false;
    navigator.wakeLock.request('screen').then((lock) => {
      if (cancelled) {
        lock.release().catch(() => {});
        return;
      }
      wakeLockRef.current = lock;
    }).catch(() => {});

    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isPlaying]);
}
