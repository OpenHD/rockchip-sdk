import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioPreset = 'flat' | 'clear' | 'bass' | 'loud' | 'club' | 'night';

export interface NexAudioSettings {
  hd: boolean;
  /** Crossfade en segundos (0 = off). Con dual player es overlap real. */
  crossfadeSec: number;
  normalize: boolean;
  boost: boolean;
  /** Intensidad 0–100 del motor de potencia */
  power: number;
  /** Subida automática al inicio del tema */
  autoGain: boolean;
  /** Golpe corto al arrancar (punch) */
  punch: boolean;
  /** Crossfade con 2 players (overlap). Si false, solo fade out/in. */
  dualCrossfade: boolean;
  preset: AudioPreset;
  /** Preferir stream propio + Web Audio (EQ/8D real). Si falla → YouTube iframe. */
  preferDsp: boolean;
  /** Stereo pan oscilante (8D) — solo con pipeline DSP */
  spatial8d: boolean;
  /** Velocidad del barrido 8D (0–100) */
  spatialSpeed: number;
  /** EQ manual extra (dB), sumado al preset */
  eqBass: number;
  eqMid: number;
  eqTreble: number;
}

const STORAGE_KEY = 'nexMusicAudioEnhance_v3';

export const DEFAULT_AUDIO_SETTINGS: NexAudioSettings = {
  hd: true,
  crossfadeSec: 4,
  normalize: true,
  boost: true,
  power: 85,
  autoGain: true,
  punch: true,
  dualCrossfade: true,
  preset: 'club',
  preferDsp: true,
  spatial8d: false,
  spatialSpeed: 40,
  eqBass: 0,
  eqMid: 0,
  eqTreble: 0,
};

const PRESET_MULT: Record<AudioPreset, number> = {
  flat: 1,
  clear: 1.02,
  bass: 1.1,
  loud: 1.14,
  club: 1.2,
  night: 0.7,
};

export function loadAudioSettings(): NexAudioSettings {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('nexMusicAudioEnhance_v2') ||
      localStorage.getItem('nexMusicAudioEnhance');
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: NexAudioSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/**
 * Curva de loudness + potencia.
 * Soft-ceiling ~96 para evitar clipping percibido al 100.
 */
export function mapUiVolumeToPlayer(uiVolume: number, settings: NexAudioSettings): number {
  const v = Math.max(0, Math.min(100, uiVolume)) / 100;
  const power = Math.max(0, Math.min(100, settings.power)) / 100;
  const exponent = settings.boost ? 0.55 - power * 0.12 : 0.82;
  let curved = Math.pow(v, Math.max(0.4, exponent));

  curved *= PRESET_MULT[settings.preset] ?? 1;
  // Extra headroom from power (up to +18%)
  curved *= 1 + power * 0.18;

  if (settings.normalize) {
    curved = Math.min(0.96, Math.max(0.14, curved));
  } else {
    curved = Math.min(0.96, curved);
  }

  return Math.round(curved * 100);
}

export type YtPlayerLike = {
  setVolume?: (n: number) => void;
  getVolume?: () => number;
  setPlaybackQuality?: (q: string) => void;
  getAvailableQualityLevels?: () => string[];
  loadVideoById?: (opts: string | { videoId: string; suggestedQuality?: string }) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  mute?: () => void;
  unMute?: () => void;
  seekTo?: (s: number, allow: boolean) => void;
  getPlayerState?: () => number;
};

export function applyHdQuality(player: YtPlayerLike | null | undefined) {
  if (!player?.setPlaybackQuality) return;
  try {
    const levels = player.getAvailableQualityLevels?.() ?? [];
    const preferred = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720'];
    const pick = preferred.find((q) => levels.includes(q)) || levels[0];
    if (pick) player.setPlaybackQuality(pick);
    else player.setPlaybackQuality('hd1080');
  } catch {
    try {
      player.setPlaybackQuality?.('hd1080');
    } catch {
      /* ignore */
    }
  }
}

export function useNexAudioEnhance() {
  const [settings, setSettingsState] = useState<NexAudioSettings>(() => loadAudioSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Multiple timers so dual overlap fades can run in parallel. */
  const fadeTimersRef = useRef<number[]>([]);
  const autoGainTimerRef = useRef<number | null>(null);
  const punchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    saveAudioSettings(settings);
  }, [settings]);

  const setSettings = useCallback((patch: Partial<NexAudioSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const stopFade = useCallback(() => {
    fadeTimersRef.current.forEach((id) => clearInterval(id));
    fadeTimersRef.current = [];
  }, []);

  const stopEnvelopes = useCallback(() => {
    if (autoGainTimerRef.current) {
      clearInterval(autoGainTimerRef.current);
      autoGainTimerRef.current = null;
    }
    if (punchTimerRef.current) {
      clearTimeout(punchTimerRef.current);
      punchTimerRef.current = null;
    }
  }, []);

  const applyVolume = useCallback((player: YtPlayerLike | null | undefined, uiVolume: number) => {
    if (!player?.setVolume) return;
    const s = settingsRef.current;
    let vol = mapUiVolumeToPlayer(uiVolume, s);
    // Extra punch on YT path when boost/club — iframe can't EQ, so we push loudness harder
    if (s.boost && s.preset === 'club') vol = Math.min(100, Math.round(vol * 1.08));
    player.setVolume(vol);
  }, []);

  const spatialRafRef = useRef<number | null>(null);

  const stopYtSpatial = useCallback(() => {
    if (spatialRafRef.current != null) {
      cancelAnimationFrame(spatialRafRef.current);
      spatialRafRef.current = null;
    }
  }, []);

  /** 8D / potencia audible on YouTube iframe (volume LFO — not real stereo). */
  const startYtSpatial = useCallback(
    (player: YtPlayerLike | null | undefined, uiVolume: number) => {
      stopYtSpatial();
      if (!player?.setVolume) return;
      const s0 = settingsRef.current;
      if (!s0.spatial8d) {
        applyVolume(player, uiVolume);
        return;
      }
      const t0 = performance.now();
      const tick = () => {
        const s = settingsRef.current;
        if (!s.spatial8d || !player.setVolume) {
          stopYtSpatial();
          applyVolume(player, uiVolume);
          return;
        }
        const base = mapUiVolumeToPlayer(uiVolume, s);
        const speed = 0.14 + ((s.spatialSpeed ?? 40) / 100) * 0.4;
        const depth = 0.4 + (s.power / 100) * 0.5;
        const wave = 0.5 + 0.5 * Math.sin(((performance.now() - t0) / 1000) * Math.PI * 2 * speed);
        const mod = 1 - depth + depth * wave;
        player.setVolume(Math.max(8, Math.min(100, Math.round(base * mod))));
        spatialRafRef.current = requestAnimationFrame(tick);
      };
      spatialRafRef.current = requestAnimationFrame(tick);
    },
    [applyVolume, stopYtSpatial],
  );

  const fadeVolume = useCallback(
    (player: YtPlayerLike | null | undefined, from: number, to: number, ms: number) =>
      new Promise<void>((resolve) => {
        if (!player?.setVolume || ms <= 0) {
          player?.setVolume?.(to);
          resolve();
          return;
        }
        const steps = Math.max(10, Math.floor(ms / 32));
        let i = 0;
        const id = window.setInterval(() => {
          i += 1;
          const t = i / steps;
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const vol = Math.round(from + (to - from) * eased);
          player.setVolume?.(vol);
          if (i >= steps) {
            clearInterval(id);
            fadeTimersRef.current = fadeTimersRef.current.filter((x) => x !== id);
            player.setVolume?.(to);
            resolve();
          }
        }, ms / steps);
        fadeTimersRef.current.push(id);
      }),
    [],
  );

  /** Punch + auto-gain al empezar un tema (sin pelearse entre sí). */
  const startTrackEnvelope = useCallback(
    (player: YtPlayerLike | null | undefined, uiVolume: number) => {
      if (!player?.setVolume) return;
      stopEnvelopes();
      const s = settingsRef.current;
      const target = mapUiVolumeToPlayer(uiVolume, s);
      const wantPunch = s.punch && s.power > 20;
      const wantGain = s.autoGain && s.power > 10;

      if (wantPunch && !wantGain) {
        const peak = Math.min(96, Math.round(target * 1.12));
        player.setVolume(peak);
        punchTimerRef.current = window.setTimeout(() => {
          player.setVolume?.(target);
        }, 180);
        return;
      }

      if (wantGain) {
        const start = Math.max(8, Math.round(target * (wantPunch ? 0.78 : 0.86)));
        if (wantPunch) {
          player.setVolume(Math.min(96, Math.round(target * 1.1)));
          punchTimerRef.current = window.setTimeout(() => {
            player.setVolume?.(start);
            const steps = 24;
            let i = 0;
            autoGainTimerRef.current = window.setInterval(() => {
              i += 1;
              const vol = Math.round(start + (target - start) * (i / steps));
              player.setVolume?.(vol);
              if (i >= steps) {
                if (autoGainTimerRef.current) clearInterval(autoGainTimerRef.current);
                autoGainTimerRef.current = null;
                player.setVolume?.(target);
              }
            }, 250);
          }, 160);
        } else {
          player.setVolume(start);
          const steps = 24;
          let i = 0;
          autoGainTimerRef.current = window.setInterval(() => {
            i += 1;
            const vol = Math.round(start + (target - start) * (i / steps));
            player.setVolume?.(vol);
            if (i >= steps) {
              if (autoGainTimerRef.current) clearInterval(autoGainTimerRef.current);
              autoGainTimerRef.current = null;
              player.setVolume?.(target);
            }
          }, 250);
        }
        return;
      }

      player.setVolume(target);
    },
    [stopEnvelopes],
  );

  const crossfadeToNext = useCallback(
    async (
      player: YtPlayerLike | null | undefined,
      uiVolume: number,
      loadNext: () => void | Promise<void>,
      opts?: {
        nextPlayer?: YtPlayerLike | null;
        onSwapped?: (active: YtPlayerLike) => void;
      },
    ) => {
      const s = settingsRef.current;
      const sec = s.crossfadeSec;
      const target = mapUiVolumeToPlayer(uiVolume, s);
      const nextPlayer = opts?.nextPlayer;

      // Dual overlap crossfade
      if (s.dualCrossfade && nextPlayer?.setVolume && player?.setVolume && sec > 0) {
        stopEnvelopes();
        stopFade();
        const current = player.getVolume?.() ?? target;
        nextPlayer.setVolume(0);
        await loadNext();
        if (s.hd) applyHdQuality(nextPlayer);
        nextPlayer.playVideo?.();
        const ms = sec * 1000;
        await Promise.all([
          fadeVolume(player, current, 0, ms),
          fadeVolume(nextPlayer, 0, target, ms),
        ]);
        player.pauseVideo?.();
        player.setVolume?.(0);
        opts?.onSwapped?.(nextPlayer);
        startTrackEnvelope(nextPlayer, uiVolume);
        return;
      }

      // Single-player fade
      if (!player?.setVolume || sec <= 0) {
        await loadNext();
        applyVolume(player, uiVolume);
        applyHdQuality(player);
        startTrackEnvelope(player, uiVolume);
        return;
      }

      stopFade();
      const current = player.getVolume?.() ?? target;
      await fadeVolume(player, current, 0, (sec * 1000) / 2);
      await loadNext();
      applyHdQuality(player);
      player.playVideo?.();
      await fadeVolume(player, 0, target, (sec * 1000) / 2);
      startTrackEnvelope(player, uiVolume);
    },
    [applyVolume, fadeVolume, startTrackEnvelope, stopEnvelopes, stopFade],
  );

  const enablePowerPreset = useCallback(() => {
    setSettingsState((prev) => ({
      ...prev,
      boost: true,
      normalize: true,
      autoGain: true,
      punch: true,
      hd: true,
      dualCrossfade: true,
      preferDsp: true,
      spatial8d: true,
      power: 100,
      preset: 'club',
      crossfadeSec: Math.max(prev.crossfadeSec, 3),
      eqBass: Math.max(prev.eqBass, 3),
      eqTreble: Math.max(prev.eqTreble, 2),
    }));
  }, []);

  return {
    settings,
    setSettings,
    applyVolume,
    applyHdQuality,
    crossfadeToNext,
    startTrackEnvelope,
    startYtSpatial,
    stopYtSpatial,
    stopFade,
    stopEnvelopes,
    enablePowerPreset,
    mapVolume: (ui: number) => mapUiVolumeToPlayer(ui, settings),
  };
}
