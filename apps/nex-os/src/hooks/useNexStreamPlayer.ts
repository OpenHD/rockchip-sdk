import { useCallback, useEffect, useRef, useState } from 'react';
import type { NexAudioSettings } from './useNexAudioEnhance';
import type { DspEngine } from './useNexDspEngine';
import { resolveYoutubeStream, type StreamResolveResult } from '../utils/youtubeStream';

export type { StreamResolveResult };
export type PlaybackMode = 'idle' | 'dsp' | 'youtube';
export type PlayVideoResult = 'ok' | 'abort' | 'fail';

function waitForMedia(el: HTMLMediaElement, signal: AbortSignal, timeoutMs = 14000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve();
      return;
    }

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(el.error?.message || 'media error'));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('media timeout'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };

    el.addEventListener('canplay', onReady);
    el.addEventListener('loadeddata', onReady);
    el.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Hidden media element + DSP. Falls back to caller (YouTube iframe) on failure.
 */
export function useNexStreamPlayer(opts: {
  getEngine: () => DspEngine;
  getSettings: () => NexAudioSettings;
  getUiVolume: () => number;
  onEnded: () => void;
  onPlayingChange: (playing: boolean) => void;
  onTime: (current: number, duration: number) => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<PlaybackMode>('idle');
  const [mode, setModeState] = useState<PlaybackMode>('idle');
  const [dspReady, setDspReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const setMode = useCallback((next: PlaybackMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const ensureMedia = useCallback(() => {
    if (mediaRef.current && document.body.contains(mediaRef.current)) return mediaRef.current;
    const el = document.createElement('video');
    el.setAttribute('playsinline', '1');
    el.setAttribute('webkit-playsinline', '1');
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.muted = false;
    el.style.cssText =
      'position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;top:0;z-index:-1;';
    el.addEventListener('ended', () => optsRef.current.onEnded());
    el.addEventListener('play', () => optsRef.current.onPlayingChange(true));
    el.addEventListener('pause', () => {
      if (!el.ended) optsRef.current.onPlayingChange(false);
    });
    document.body.appendChild(el);
    mediaRef.current = el;
    return el;
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    progressTimerRef.current = window.setInterval(() => {
      const el = mediaRef.current;
      if (!el || modeRef.current !== 'dsp') return;
      const dur = el.duration;
      if (Number.isFinite(dur) && dur > 0) {
        optsRef.current.onTime(el.currentTime, dur);
      }
    }, 500);
  }, [stopProgress]);

  const stopDsp = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopProgress();
    const el = mediaRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute('src');
        el.load();
      } catch {
        /* ignore */
      }
    }
    setDspReady(false);
  }, [stopProgress]);

  const playVideoId = useCallback(
    async (videoId: string): Promise<PlayVideoResult> => {
      const settings = optsRef.current.getSettings();
      if (settings.preferDsp === false) {
        stopDsp();
        setMode('youtube');
        setLastError('preferDsp off');
        return 'fail';
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const resolved = await resolveYoutubeStream(videoId, ac.signal);
        if (ac.signal.aborted) return 'abort';

        const el = ensureMedia();
        const engine = optsRef.current.getEngine();
        engine.ensureContext();
        engine.attachElement(el);

        el.crossOrigin = 'anonymous';
        el.src = resolved.url;
        el.load();

        await waitForMedia(el, ac.signal);
        if (ac.signal.aborted) return 'abort';

        engine.ensureContext();
        engine.applySettings(optsRef.current.getSettings(), optsRef.current.getUiVolume());

        await el.play();
        if (ac.signal.aborted) {
          try {
            el.pause();
          } catch {
            /* ignore */
          }
          return 'abort';
        }

        setDspReady(true);
        setMode('dsp');
        setLastError(null);
        startProgress();
        optsRef.current.onPlayingChange(true);
        if (Number.isFinite(el.duration) && el.duration > 0) {
          optsRef.current.onTime(el.currentTime, el.duration);
        }
        engine.applySettings(optsRef.current.getSettings(), optsRef.current.getUiVolume());
        return 'ok';
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return 'abort';
        const msg = (err as Error)?.message || 'stream fail';
        console.warn('[NEX DSP] stream fallback → YouTube', msg);
        stopDsp();
        setMode('youtube');
        setLastError(msg);
        return 'fail';
      }
    },
    [ensureMedia, setMode, startProgress, stopDsp],
  );

  const play = useCallback(async () => {
    const el = mediaRef.current;
    if (!el || modeRef.current !== 'dsp') return false;
    optsRef.current.getEngine().ensureContext();
    await el.play();
    startProgress();
    return true;
  }, [startProgress]);

  const pause = useCallback(() => {
    mediaRef.current?.pause();
    stopProgress();
  }, [stopProgress]);

  const seekTo = useCallback((seconds: number) => {
    const el = mediaRef.current;
    if (!el || modeRef.current !== 'dsp') return;
    el.currentTime = Math.max(0, seconds);
  }, []);

  const getCurrentTime = useCallback(() => mediaRef.current?.currentTime ?? 0, []);
  const getDuration = useCallback(() => mediaRef.current?.duration ?? 0, []);

  const syncSettings = useCallback(() => {
    if (modeRef.current !== 'dsp') return;
    optsRef.current.getEngine().applySettings(optsRef.current.getSettings(), optsRef.current.getUiVolume());
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopProgress();
      const el = mediaRef.current;
      if (el) {
        try {
          el.pause();
          el.remove();
        } catch {
          /* ignore */
        }
        mediaRef.current = null;
      }
    };
  }, [stopProgress]);

  return {
    mode,
    dspReady,
    lastError,
    playVideoId,
    play,
    pause,
    seekTo,
    getCurrentTime,
    getDuration,
    stopDsp,
    syncSettings,
    isDspActive: mode === 'dsp' && dspReady,
  };
}
