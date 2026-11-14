import React, { useEffect, useState } from 'react';
import type { DjDeckApi } from './useDjDeck';

type Props = {
  crossfader: number;
  masterVolume: number;
  onCrossfader: (v: number) => void;
  onMasterVolume: (v: number) => void;
  onSyncSlave: () => void;
  masterDeck: 'A' | 'B';
  channelA: DjDeckApi;
  channelB: DjDeckApi;
};

function LevelMeter({
  active,
  level,
  accent,
}: {
  active: boolean;
  level: number;
  accent: string;
}) {
  const bars = 8;
  const lit = active ? Math.max(1, Math.round(level * bars)) : 0;
  return (
    <div className="vdj-vu" style={{ ['--vu' as string]: accent }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={i < lit ? 'on' : ''} style={{ opacity: i < lit ? 0.55 + i * 0.06 : 0.2 }} />
      ))}
    </div>
  );
}

function ChannelStrip({
  deck,
  label,
  accent,
}: {
  deck: DjDeckApi;
  label: string;
  accent: string;
}) {
  const { state } = deck;
  const [pulse, setPulse] = useState(0.35);

  useEffect(() => {
    if (!state.playing) {
      setPulse(0.2);
      return;
    }
    let raf = 0;
    const tick = () => {
      // Visual-only meter: volume × gentle pseudo-activity
      const wobble = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 140));
      setPulse(Math.min(1, state.volume * wobble));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.playing, state.volume]);

  return (
    <div className={`vdj-ch ${state.playing ? 'live' : ''}`} style={{ ['--ch' as string]: accent }}>
      <div className="vdj-ch-label">{label}</div>
      <LevelMeter active={state.playing} level={pulse} accent={accent} />
      {(['high', 'mid', 'low'] as const).map((band) => (
        <label key={band} className="vdj-knob-wrap">
          <span>{band === 'high' ? 'HI' : band === 'mid' ? 'MID' : 'LOW'}</span>
          <input
            type="range"
            className="vdj-knob"
            min={-12}
            max={12}
            step={0.5}
            value={state.eq[band]}
            onChange={(e) => deck.setEq({ [band]: Number(e.target.value) })}
          />
          <em>
            {state.eq[band] > 0 ? '+' : ''}
            {state.eq[band]}
          </em>
        </label>
      ))}
      <div className="vdj-ch-gain">
        <span>GAIN</span>
        <input
          type="range"
          className="vdj-vert-fader ch"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(e) => deck.setVolume(Number(e.target.value))}
          aria-label={`Gain deck ${label}`}
        />
        <em>{Math.round(state.volume * 100)}</em>
      </div>
    </div>
  );
}

export const MixerPanel: React.FC<Props> = ({
  crossfader,
  masterVolume,
  onCrossfader,
  onMasterVolume,
  onSyncSlave,
  masterDeck,
  channelA,
  channelB,
}) => {
  const xfPct = Math.round(crossfader * 100);

  return (
    <div className="vdj-mixer">
      <div className="vdj-mixer-title">MIXER</div>

      <div className="vdj-mixer-channels">
        <ChannelStrip deck={channelA} label="A" accent="#ff6b4a" />
        <div className="vdj-mixer-center">
          <div className="vdj-meter-block">
            <span>MASTER</span>
            <input
              type="range"
              className="vdj-vert-fader master"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => onMasterVolume(Number(e.target.value))}
              aria-label="Master volume"
            />
            <em>{Math.round(masterVolume * 100)}</em>
          </div>
          <button
            type="button"
            className="vdj-sync-btn"
            onClick={onSyncSlave}
            title="Match pitch del otro deck al master"
          >
            SYNC
            <small>→ {masterDeck === 'A' ? 'B' : 'A'}</small>
          </button>
        </div>
        <ChannelStrip deck={channelB} label="B" accent="#2ec4b6" />
      </div>

      <div className="vdj-xfade-block">
        <div className="vdj-xfade-labels">
          <span className={crossfader < 0.45 ? 'hot' : ''}>A</span>
          <button
            type="button"
            className="vdj-xfade-center"
            onClick={() => onCrossfader(0.5)}
            title="Centrar crossfader"
          >
            XF {xfPct < 50 ? `A${50 - xfPct}` : xfPct > 50 ? `B${xfPct - 50}` : 'CTR'}
          </button>
          <span className={crossfader > 0.55 ? 'hot' : ''}>B</span>
        </div>
        <div className="vdj-xfade-rail">
          <div className="vdj-xfade-fill" style={{ ['--xf' as string]: String(crossfader) }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={crossfader}
            onChange={(e) => onCrossfader(Number(e.target.value))}
            className="vdj-xfade"
            aria-label="Crossfader"
          />
        </div>
      </div>
    </div>
  );
};

export default MixerPanel;
