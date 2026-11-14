import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveDjStream } from './streamResolve';
import type { DjMasterApi } from './useDjMaster';
import {
  DEFAULT_EQ,
  type DjCuePoint,
  type DjDeckId,
  type DjDeckUiState,
  type DjEqBands,
  type DjLoopRegion,
  type DjTrackRef,
} from './types';

const CUE_STORAGE_PREFIX = 'nexDjCues_v1:';

function loadCues(videoId: string): DjCuePoint[] {
  try {
    const raw = localStorage.getItem(CUE_STORAGE_PREFIX + videoId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DjCuePoint[];
    return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c.time === 'number') : [];
  } catch {
    return [];
  }
}

function saveCues(videoId: string, cues: DjCuePoint[]) {
  try {
    localStorage.setItem(CUE_STORAGE_PREFIX + videoId, JSON.stringify(cues));
  } catch {
    /* ignore */
  }
}

/** Deterministic pseudo-waveform when decode isn't possible (CORS). */
function proceduralPeaks(seed: string, bars = 256): Float32Array {
  const out = new Float32Array(bars);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = (h >>> 0) / 0xffffffff;
    const envelope = 0.35 + 0.65 * Math.sin((i / bars) * Math.PI);
    out[i] = Math.min(1, 0.15 + n * 0.85 * envelope);
  }
  return out;
}

async function tryDecodePeaks(url: string, ctx: AudioContext, signal: AbortSignal): Promise<Float32Array | null> {
  try {
    const res = await fetch(url, { signal, mode: 'cors' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (signal.aborted) return null;
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channel = audio.getChannelData(0);
    const bars = 512;
    const block = Math.floor(channel.length / bars) || 1;
    const peaks = new Float32Array(bars);
    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      for (let j = start; j < end; j += 8) {
        const v = Math.abs(channel[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    let peak = 0;
    for (let i = 0; i < bars; i++) if (peaks[i] > peak) peak = peaks[i];
    if (peak > 0) {
      for (let i = 0; i < bars; i++) peaks[i] /= peak;
    }
    return peaks;
  } catch {
    return null;
  }
}

function waitForMedia(el: HTMLMediaElement, signal: AbortSignal, timeoutMs = 16000): Promise<void> {
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

type Graph = {
  source: MediaElementAudioSourceNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  vol: GainNode;
};

export function useDjDeck(deckId: DjDeckId, getMaster: () => Promise<DjMasterApi>) {
  const [state, setState] = useState<DjDeckUiState>({
    track: null,
    loading: false,
    error: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    rate: 1,
    volume: 0.85,
    eq: { ...DEFAULT_EQ },
    cues: [],
    loop: null,
    cuePreview: false,
    peaks: null,
  });

  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loopRef = useRef<DjLoopRegion | null>(null);
  const activeCueRef = useRef(0);
  const rateRef = useRef(1);
  const volumeRef = useRef(0.85);
  const eqRef = useRef<DjEqBands>({ ...DEFAULT_EQ });
  const rafRef = useRef<number | null>(null);
  const masterApiRef = useRef<DjMasterApi | null>(null);
  const cuesRef = useRef<DjCuePoint[]>([]);

  const ensureMedia = useCallback(() => {
    if (mediaRef.current && document.body.contains(mediaRef.current)) return mediaRef.current;
    const el = document.createElement('audio');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.setAttribute('playsinline', '1');
    el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;';
    document.body.appendChild(el);
    mediaRef.current = el;
    return el;
  }, []);

  const applyEq = useCallback((g: Graph, eq: DjEqBands) => {
    g.low.gain.value = eq.low;
    g.mid.gain.value = eq.mid;
    g.high.gain.value = eq.high;
  }, []);

  const ensureGraph = useCallback(
    async (el: HTMLMediaElement, master: DjMasterApi) => {
      if (graphRef.current) return graphRef.current;
      await master.ensure();
      const ctx = master.ctx;
      const source = ctx.createMediaElementSource(el);
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 110;
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 0.9;
      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 6500;
      const vol = ctx.createGain();
      vol.gain.value = volumeRef.current;
      source.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(vol);
      vol.connect(master.getDeckInput(deckId));
      const g = { source, low, mid, high, vol };
      applyEq(g, eqRef.current);
      graphRef.current = g;
      return g;
    },
    [applyEq, deckId],
  );

  const tick = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    const loop = loopRef.current;
    if (loop?.enabled && loop.outTime > loop.inTime && el.currentTime >= loop.outTime) {
      el.currentTime = loop.inTime;
    }
    setState((s) => ({
      ...s,
      currentTime: el.currentTime || 0,
      duration: Number.isFinite(el.duration) ? el.duration : s.duration,
      playing: !el.paused,
    }));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTick = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopTick = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const loadTrack = useCallback(
    async (track: DjTrackRef) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const cues = loadCues(track.videoId);
      cuesRef.current = cues;
      loopRef.current = null;
      activeCueRef.current = 0;

      setState((s) => ({
        ...s,
        track,
        loading: true,
        error: null,
        playing: false,
        currentTime: 0,
        duration: track.durationSec || 0,
        cues,
        loop: null,
        peaks: proceduralPeaks(track.videoId),
      }));

      try {
        const master = await getMaster();
        masterApiRef.current = master;

        const isLocal = track.source === 'local' || Boolean(track.playUrl?.startsWith('blob:'));
        let mediaUrl: string;
        let resolvedTitle = track.title;
        let resolvedDuration = track.durationSec;

        if (isLocal) {
          if (!track.playUrl) throw new Error('Archivo local sin URL de reproducción.');
          mediaUrl = track.playUrl;
        } else {
          const stream = await resolveDjStream(track.videoId, ac.signal);
          if (ac.signal.aborted) return;
          mediaUrl = stream.url;
          resolvedTitle = stream.title || track.title;
          resolvedDuration = stream.duration || track.durationSec;
        }
        if (ac.signal.aborted) return;

        if (graphRef.current) {
          try {
            graphRef.current.source.disconnect();
            graphRef.current.low.disconnect();
            graphRef.current.mid.disconnect();
            graphRef.current.high.disconnect();
            graphRef.current.vol.disconnect();
          } catch {
            /* ignore */
          }
          graphRef.current = null;
        }
        if (mediaRef.current) {
          try {
            mediaRef.current.pause();
            mediaRef.current.removeAttribute('src');
            mediaRef.current.load();
            mediaRef.current.remove();
          } catch {
            /* ignore */
          }
          mediaRef.current = null;
        }

        const media = ensureMedia();
        // Blob URLs don't need CORS; anonymous can block some local decode paths.
        if (isLocal) media.removeAttribute('crossorigin');
        else media.crossOrigin = 'anonymous';
        media.src = mediaUrl;
        media.load();
        await waitForMedia(media, ac.signal);
        if (ac.signal.aborted) return;

        await ensureGraph(media, master);
        media.playbackRate = rateRef.current;
        media.currentTime = 0;

        const decoded = await tryDecodePeaks(mediaUrl, master.ctx, ac.signal);
        const duration =
          Number.isFinite(media.duration) && media.duration > 0
            ? media.duration
            : resolvedDuration || 0;
        setState((s) => ({
          ...s,
          loading: false,
          error: null,
          duration,
          peaks: decoded || proceduralPeaks(track.videoId),
          track: {
            ...track,
            title: resolvedTitle,
            durationSec: duration || track.durationSec,
          },
        }));
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
        setState((s) => ({
          ...s,
          loading: false,
          error:
            (err as Error).message ||
            (track.source === 'local' || track.playUrl
              ? 'No se pudo cargar el archivo local.'
              : 'No se pudo cargar el stream. Usá archivos locales o un music server.'),
          playing: false,
        }));
      }
    },
    [ensureGraph, ensureMedia, getMaster],
  );

  const play = useCallback(async () => {
    const master = await getMaster();
    masterApiRef.current = master;
    const el = mediaRef.current;
    if (!el?.src) return;
    await ensureGraph(el, master);
    await master.ensure();
    await el.play();
    startTick();
    setState((s) => ({ ...s, playing: true }));
  }, [ensureGraph, getMaster, startTick]);

  const pause = useCallback(() => {
    mediaRef.current?.pause();
    setState((s) => ({ ...s, playing: false }));
  }, []);

  const toggle = useCallback(async () => {
    if (mediaRef.current && !mediaRef.current.paused) pause();
    else await play();
  }, [pause, play]);

  const seek = useCallback((time: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const dur = Number.isFinite(el.duration) ? el.duration : state.duration;
    el.currentTime = Math.max(0, Math.min(dur || time, time));
    setState((s) => ({ ...s, currentTime: el.currentTime }));
  }, [state.duration]);

  const cueJump = useCallback(() => {
    seek(activeCueRef.current);
    if (mediaRef.current && mediaRef.current.paused) void play();
  }, [play, seek]);

  const setRate = useCallback((rate: number) => {
    const r = Math.min(1.15, Math.max(0.85, rate));
    rateRef.current = r;
    if (mediaRef.current) mediaRef.current.playbackRate = r;
    setState((s) => ({ ...s, rate: r }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const v = Math.min(1, Math.max(0, volume));
    volumeRef.current = v;
    if (graphRef.current) graphRef.current.vol.gain.value = v;
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const setEq = useCallback(
    (eq: Partial<DjEqBands>) => {
      eqRef.current = { ...eqRef.current, ...eq };
      if (graphRef.current) applyEq(graphRef.current, eqRef.current);
      setState((s) => ({ ...s, eq: { ...eqRef.current } }));
    },
    [applyEq],
  );

  const setHotCue = useCallback((slot: number, time?: number) => {
    const t = time ?? mediaRef.current?.currentTime ?? 0;
    setState((s) => {
      if (!s.track) return s;
      const next = [...s.cues.filter((c) => c.id !== slot), { id: slot, time: t }];
      next.sort((a, b) => a.id - b.id);
      cuesRef.current = next;
      saveCues(s.track.videoId, next);
      return { ...s, cues: next };
    });
  }, []);

  const jumpHotCue = useCallback(
    (slot: number) => {
      const cue = cuesRef.current.find((c) => c.id === slot);
      if (!cue) return;
      activeCueRef.current = cue.time;
      seek(cue.time);
      void play();
    },
    [play, seek],
  );

  const clearHotCue = useCallback((slot: number) => {
    setState((s) => {
      if (!s.track) return s;
      const next = s.cues.filter((c) => c.id !== slot);
      cuesRef.current = next;
      saveCues(s.track.videoId, next);
      return { ...s, cues: next };
    });
  }, []);

  const setLoopIn = useCallback(() => {
    const t = mediaRef.current?.currentTime ?? state.currentTime;
    setState((s) => {
      const next: DjLoopRegion = {
        inTime: t,
        outTime: s.loop?.outTime ?? Math.min((s.duration || t + 8), t + 8),
        enabled: s.loop?.enabled ?? false,
      };
      if (next.outTime <= next.inTime) next.outTime = next.inTime + 1;
      loopRef.current = next;
      return { ...s, loop: next };
    });
  }, [state.currentTime]);

  const setLoopOut = useCallback(() => {
    const t = mediaRef.current?.currentTime ?? state.currentTime;
    setState((s) => {
      const inTime = s.loop?.inTime ?? Math.max(0, t - 8);
      const next: DjLoopRegion = {
        inTime,
        outTime: Math.max(inTime + 0.25, t),
        enabled: true,
      };
      loopRef.current = next;
      return { ...s, loop: next };
    });
  }, [state.currentTime]);

  const toggleLoop = useCallback(() => {
    setState((s) => {
      if (!s.loop) {
        const t = s.currentTime;
        const next: DjLoopRegion = { inTime: t, outTime: t + 8, enabled: true };
        loopRef.current = next;
        return { ...s, loop: next };
      }
      const next = { ...s.loop, enabled: !s.loop.enabled };
      loopRef.current = next;
      return { ...s, loop: next };
    });
  }, []);

  const syncRateFrom = useCallback((masterRate: number) => {
    setRate(masterRate);
  }, [setRate]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopTick();
      try {
        mediaRef.current?.pause();
        mediaRef.current?.remove();
        graphRef.current?.source.disconnect();
      } catch {
        /* ignore */
      }
      mediaRef.current = null;
      graphRef.current = null;
    };
  }, [stopTick]);

  return {
    deckId,
    state,
    loadTrack,
    play,
    pause,
    toggle,
    seek,
    cueJump,
    setRate,
    setVolume,
    setEq,
    setHotCue,
    jumpHotCue,
    clearHotCue,
    setLoopIn,
    setLoopOut,
    toggleLoop,
    syncRateFrom,
  };
}

export type DjDeckApi = ReturnType<typeof useDjDeck>;
