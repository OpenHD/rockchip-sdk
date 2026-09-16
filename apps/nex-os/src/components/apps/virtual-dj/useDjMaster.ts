import { useCallback, useEffect, useRef, useState } from 'react';
import type { DjDeckId } from './types';

export type DjMasterApi = {
  ctx: AudioContext;
  ensure: () => Promise<AudioContext>;
  getDeckInput: (id: DjDeckId) => GainNode;
  setCrossfader: (value: number) => void;
  setMasterVolume: (value: number) => void;
  setCuePreview: (id: DjDeckId, enabled: boolean) => void;
  crossfader: number;
  masterVolume: number;
};

/**
 * Shared AudioContext + equal-power crossfader + master.
 * Cue preview: when a deck is in cue mode, mute the other on the master bus
 * (simplified headphone cue without dual output devices).
 */
export function useDjMaster(): {
  master: DjMasterApi | null;
  crossfader: number;
  masterVolume: number;
  setCrossfader: (v: number) => void;
  setMasterVolume: (v: number) => void;
  cuePreview: { A: boolean; B: boolean };
  setCuePreview: (id: DjDeckId, enabled: boolean) => void;
  ensureMaster: () => Promise<DjMasterApi>;
} {
  const [crossfader, setCrossfaderState] = useState(0.5);
  const [masterVolume, setMasterVolumeState] = useState(0.85);
  const [cuePreview, setCuePreviewState] = useState({ A: false, B: false });
  const [ready, setReady] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const xfRef = useRef(0.5);
  const volRef = useRef(0.85);
  const cueRef = useRef({ A: false, B: false });

  const applyGains = useCallback(() => {
    const a = gainARef.current;
    const b = gainBRef.current;
    const m = masterRef.current;
    if (!a || !b || !m) return;

    const x = Math.min(1, Math.max(0, xfRef.current));
    // Equal-power crossfade
    const gainA = Math.cos(x * 0.5 * Math.PI);
    const gainB = Math.sin(x * 0.5 * Math.PI);

    const cue = cueRef.current;
    let outA = gainA;
    let outB = gainB;
    if (cue.A && !cue.B) {
      outA = 1;
      outB = 0;
    } else if (cue.B && !cue.A) {
      outA = 0;
      outB = 1;
    }

    a.gain.value = outA;
    b.gain.value = outB;
    m.gain.value = volRef.current;
  }, []);

  const ensureMaster = useCallback(async (): Promise<DjMasterApi> => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      const master = ctx.createGain();
      gainA.connect(master);
      gainB.connect(master);
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      gainARef.current = gainA;
      gainBRef.current = gainB;
      masterRef.current = master;
      applyGains();
      setReady(true);
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }

    const ctx = ctxRef.current!;
    return {
      ctx,
      ensure: async () => {
        if (ctx.state === 'suspended') await ctx.resume();
        return ctx;
      },
      getDeckInput: (id) => (id === 'A' ? gainARef.current! : gainBRef.current!),
      setCrossfader: (value: number) => {
        xfRef.current = value;
        setCrossfaderState(value);
        applyGains();
      },
      setMasterVolume: (value: number) => {
        volRef.current = value;
        setMasterVolumeState(value);
        applyGains();
      },
      setCuePreview: (id, enabled) => {
        cueRef.current = { ...cueRef.current, [id]: enabled };
        setCuePreviewState({ ...cueRef.current });
        applyGains();
      },
      crossfader: xfRef.current,
      masterVolume: volRef.current,
    };
  }, [applyGains]);

  useEffect(() => {
    return () => {
      try {
        gainARef.current?.disconnect();
        gainBRef.current?.disconnect();
        masterRef.current?.disconnect();
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
    };
  }, []);

  const setCrossfader = useCallback(
    (v: number) => {
      xfRef.current = v;
      setCrossfaderState(v);
      applyGains();
    },
    [applyGains],
  );

  const setMasterVolume = useCallback(
    (v: number) => {
      volRef.current = v;
      setMasterVolumeState(v);
      applyGains();
    },
    [applyGains],
  );

  const setCuePreview = useCallback(
    (id: DjDeckId, enabled: boolean) => {
      cueRef.current = { ...cueRef.current, [id]: enabled };
      setCuePreviewState({ ...cueRef.current });
      applyGains();
    },
    [applyGains],
  );

  const master: DjMasterApi | null = ready && ctxRef.current
    ? {
        ctx: ctxRef.current,
        ensure: async () => {
          if (ctxRef.current!.state === 'suspended') await ctxRef.current!.resume();
          return ctxRef.current!;
        },
        getDeckInput: (id) => (id === 'A' ? gainARef.current! : gainBRef.current!),
        setCrossfader,
        setMasterVolume,
        setCuePreview,
        crossfader,
        masterVolume,
      }
    : null;

  return {
    master,
    crossfader,
    masterVolume,
    setCrossfader,
    setMasterVolume,
    cuePreview,
    setCuePreview,
    ensureMaster,
  };
}
