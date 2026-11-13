import { useCallback, useEffect, useRef } from 'react';
import type { AudioPreset, NexAudioSettings } from './useNexAudioEnhance';

/** EQ gains (dB) per preset — FxSound-inspired colour (aggressive). */
const PRESET_EQ: Record<AudioPreset, { bass: number; mid: number; treble: number; presence: number }> = {
  flat: { bass: 0, mid: 0, treble: 0, presence: 0 },
  clear: { bass: -1, mid: 2, treble: 5, presence: 3 },
  bass: { bass: 10, mid: -0.5, treble: -1, presence: 1 },
  loud: { bass: 5, mid: 2.5, treble: 3.5, presence: 2.5 },
  club: { bass: 11, mid: 2, treble: 4.5, presence: 3.5 },
  night: { bass: -2, mid: 0, treble: -4, presence: -1 },
};

export type DspEngine = {
  ensureContext: () => AudioContext;
  attachElement: (el: HTMLMediaElement) => void;
  applySettings: (settings: NexAudioSettings, uiVolume: number) => void;
  setUiVolume: (uiVolume: number, settings: NexAudioSettings) => void;
  disconnect: () => void;
};

/**
 * Real output chain (FxSound-style): media → EQ → compressor → gain → 8D pan → speakers.
 * Requires crossOrigin media with CORS * (Piped proxy).
 */
export function createNexDspEngine(): DspEngine {
  let ctx: AudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let bass: BiquadFilterNode | null = null;
  let mid: BiquadFilterNode | null = null;
  let presence: BiquadFilterNode | null = null;
  let treble: BiquadFilterNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let makeup: GainNode | null = null;
  let master: GainNode | null = null;
  let panner: StereoPannerNode | null = null;
  let attachedEl: HTMLMediaElement | null = null;
  let spatialRaf: number | null = null;
  let spatialEnabled = false;
  let spatialSpeed = 0.18;

  const ensureGraph = () => {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (!bass) {
      bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 75;
      mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 900;
      mid.Q.value = 0.85;
      presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3200;
      presence.Q.value = 1.1;
      treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 7000;
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 22;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.18;
      makeup = ctx.createGain();
      master = ctx.createGain();
      panner = ctx.createStereoPanner();
      bass.connect(mid!);
      mid!.connect(presence!);
      presence!.connect(treble!);
      treble!.connect(compressor!);
      compressor!.connect(makeup!);
      makeup!.connect(master!);
      master!.connect(panner!);
      panner!.connect(ctx.destination);
    }
    return ctx;
  };

  const stopSpatial = () => {
    if (spatialRaf != null) {
      cancelAnimationFrame(spatialRaf);
      spatialRaf = null;
    }
    if (panner) panner.pan.value = 0;
  };

  const tickSpatial = () => {
    if (!spatialEnabled || !panner || !ctx) {
      stopSpatial();
      return;
    }
    const t = ctx.currentTime;
    panner.pan.value = Math.sin(t * Math.PI * 2 * spatialSpeed) * 0.92;
    spatialRaf = requestAnimationFrame(tickSpatial);
  };

  const applySettings = (settings: NexAudioSettings, uiVolume: number) => {
    ensureGraph();
    if (!bass || !mid || !presence || !treble || !compressor || !makeup || !master || !panner) return;

    const power = Math.max(0, Math.min(100, settings.power)) / 100;
    const eq = PRESET_EQ[settings.preset] ?? PRESET_EQ.flat;
    const boostOn = settings.boost !== false;
    // FxSound-like: power drives colour + loudness hard
    const bassExtra = boostOn ? power * 5.5 : power * 2;
    const midExtra = boostOn ? power * 1.8 : 0;
    const presenceExtra = boostOn ? power * 3.2 : power * 1;
    const trebleExtra = boostOn ? power * 3.5 : power * 1.2;

    bass.gain.value = eq.bass + bassExtra + (settings.eqBass ?? 0);
    mid.gain.value = eq.mid + midExtra + (settings.eqMid ?? 0);
    presence.gain.value = eq.presence + presenceExtra;
    treble.gain.value = eq.treble + trebleExtra + (settings.eqTreble ?? 0);

    // Squash dynamics then make up — the “always loud” feel
    compressor.threshold.value = -16 - power * 16;
    compressor.knee.value = 12 + power * 16;
    compressor.ratio.value = 8 + power * 12;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.14 + (1 - power) * 0.12;

    // Makeup: up to ~+9 dB linear at full power (~2.8x)
    const makeupLin = 1 + power * (boostOn ? 1.85 : 1.1) + (boostOn ? 0.35 : 0);
    makeup.gain.value = makeupLin;

    // DSP volume: don't soft-cap as hard as the YT iframe path
    const ui = Math.max(0, Math.min(100, uiVolume)) / 100;
    const curved = Math.pow(ui, boostOn ? 0.48 : 0.7);
    const powerLift = 1 + power * 0.85;
    master.gain.value = Math.min(2.4, curved * powerLift * (settings.preset === 'club' ? 1.12 : 1));

    spatialEnabled = Boolean(settings.spatial8d);
    spatialSpeed = 0.12 + (settings.spatialSpeed ?? 40) / 100 * 0.35;
    if (spatialEnabled) {
      if (spatialRaf == null) tickSpatial();
    } else {
      stopSpatial();
    }
  };

  return {
    ensureContext: () => {
      const c = ensureGraph();
      if (c.state === 'suspended') void c.resume();
      return c;
    },
    attachElement: (el: HTMLMediaElement) => {
      ensureGraph();
      // createMediaElementSource may only be called once per HTMLMediaElement
      if (attachedEl === el && source) return;
      if (attachedEl && attachedEl !== el) {
        try {
          source?.disconnect();
        } catch {
          /* ignore */
        }
        source = null;
        attachedEl = null;
      }
      if (attachedEl === el) return;
      el.crossOrigin = 'anonymous';
      el.volume = 1;
      source = ctx!.createMediaElementSource(el);
      source.connect(bass!);
      attachedEl = el;
    },
    applySettings,
    setUiVolume: (uiVolume, settings) => applySettings(settings, uiVolume),
    disconnect: () => {
      stopSpatial();
      try {
        source?.disconnect();
      } catch {
        /* ignore */
      }
      source = null;
      attachedEl = null;
    },
  };
}

export function useNexDspEngine() {
  const engineRef = useRef<DspEngine | null>(null);
  if (!engineRef.current) engineRef.current = createNexDspEngine();

  useEffect(() => {
    return () => {
      engineRef.current?.disconnect();
    };
  }, []);

  const getEngine = useCallback(() => engineRef.current!, []);
  return { getEngine, engineRef };
}
