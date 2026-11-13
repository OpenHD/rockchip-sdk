import React, { useState } from 'react';
import type { DjDeckApi } from './useDjDeck';
import { CUE_COLORS } from './types';
import Platter from './Platter';
import Waveform from './Waveform';

type Props = {
  deck: DjDeckApi;
  accent: string;
  label: string;
  isMaster?: boolean;
  onMakeMaster?: () => void;
  onCuePreview: (enabled: boolean) => void;
  cuePreview: boolean;
  /** Mirror layout for deck B (pitch fader on the left). */
  mirror?: boolean;
  /** Drop a local audio file straight onto this deck. */
  onLocalFile?: (file: File) => void;
};

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isAudioFile(file: File) {
  if (file.type.startsWith('audio/')) return true;
  return /\.(mp3|wav|flac|ogg|m4a|aac|webm|opus|aiff?)$/i.test(file.name);
}

export const DeckPanel: React.FC<Props> = ({
  deck,
  accent,
  label,
  isMaster,
  onMakeMaster,
  onCuePreview,
  cuePreview,
  mirror = false,
  onLocalFile,
}) => {
  const { state } = deck;
  const pitchPct = (state.rate - 1) * 100;
  const [dragOver, setDragOver] = useState(false);
  const remain = Math.max(0, (state.duration || 0) - (state.currentTime || 0));
  const isLocal = state.track?.source === 'local' || Boolean(state.track?.playUrl?.startsWith('blob:'));
  const loadingMsg = isLocal || !state.track ? 'Cargando audio…' : 'Resolviendo stream…';

  return (
    <div
      className={`vdj-deck ${mirror ? 'mirror' : ''} ${dragOver ? 'drag-over' : ''} ${state.playing ? 'playing' : ''} ${!state.track ? 'empty' : ''}`}
      style={{ ['--a' as string]: accent }}
      onDragEnter={(e) => {
        if (!onLocalFile) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (!onLocalFile) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!onLocalFile) return;
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && isAudioFile(file)) onLocalFile(file);
      }}
    >
      <div className="vdj-deck-head">
        <div className="vdj-deck-badge">{label}</div>
        <div className="vdj-deck-meta">
          {state.track ? (
            <>
              <div className="vdj-track-title" title={state.track.title}>
                {state.track.title}
              </div>
              <div className="vdj-track-artist">
                <span className={`vdj-src-chip ${isLocal ? 'local' : 'yt'}`}>
                  {isLocal ? 'LOCAL' : 'YT'}
                </span>
                {state.track.artist}
              </div>
            </>
          ) : (
            <div className="vdj-track-empty">
              <strong>Deck vacío</strong>
              <span>Soltá un audio o cargá desde Library</span>
            </div>
          )}
        </div>
        <div className="vdj-deck-leds">
          <button
            type="button"
            className={`vdj-led ${isMaster ? 'on' : ''}`}
            onClick={onMakeMaster}
            title="Master para SYNC"
          >
            MST
          </button>
          <button
            type="button"
            className={`vdj-led ${cuePreview ? 'on teal' : ''}`}
            onClick={() => onCuePreview(!cuePreview)}
            title="PFL / cue preview"
          >
            PFL
          </button>
        </div>
      </div>

      <div className="vdj-wave-wrap">
        <Waveform
          peaks={state.peaks}
          currentTime={state.currentTime}
          duration={state.duration}
          cues={state.cues}
          loop={state.loop}
          accent={accent}
          onSeek={deck.seek}
        />
        {(state.loading || state.error) && (
          <div className={`vdj-wave-overlay ${state.error ? 'err' : ''}`}>
            {state.loading ? (
              <span className="vdj-wave-loading">
                <i />
                {loadingMsg}
              </span>
            ) : (
              state.error
            )}
          </div>
        )}
      </div>

      <div className="vdj-deck-body">
        <div className="vdj-platter-col">
          <Platter
            accent={accent}
            label={label}
            cover={state.track?.cover}
            title={state.track?.title}
            playing={state.playing}
            rate={state.rate}
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={deck.seek}
            empty={!state.track}
          />
          <div className="vdj-time-row">
            <span>{fmt(state.currentTime)}</span>
            <span className="vdj-pitch" title="Pitch">
              {pitchPct >= 0 ? '+' : ''}
              {pitchPct.toFixed(1)}%
            </span>
            <span className="vdj-remain" title="Restante">
              −{fmt(remain)}
            </span>
          </div>
        </div>

        <div className="vdj-pitch-col">
          <span className="vdj-fader-cap">PITCH</span>
          <input
            type="range"
            className="vdj-vert-fader"
            min={-15}
            max={15}
            step={0.1}
            value={pitchPct}
            onChange={(e) => deck.setRate(1 + Number(e.target.value) / 100)}
            aria-label={`Pitch deck ${label}`}
          />
          <button type="button" className="vdj-btn tiny" onClick={() => deck.setRate(1)} title="Reset pitch">
            0
          </button>
        </div>
      </div>

      <div className="vdj-transport">
        <button type="button" className="vdj-pad cue" onClick={() => deck.cueJump()} title="Jump to cue / set if empty">
          CUE
        </button>
        <button
          type="button"
          className={`vdj-pad play ${state.playing ? 'active' : ''}`}
          onClick={() => void deck.toggle()}
          disabled={state.loading || !state.track}
        >
          {state.playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className="vdj-pad" onClick={deck.setLoopIn} title="Loop in">
          IN
        </button>
        <button type="button" className="vdj-pad" onClick={deck.setLoopOut} title="Loop out">
          OUT
        </button>
        <button
          type="button"
          className={`vdj-pad ${state.loop?.enabled ? 'active' : ''}`}
          onClick={deck.toggleLoop}
          title="Toggle loop"
        >
          LOOP
        </button>
      </div>

      <div className="vdj-cues">
        {[1, 2, 3, 4].map((slot) => {
          const has = state.cues.some((c) => c.id === slot);
          return (
            <button
              key={slot}
              type="button"
              className={`vdj-cue ${has ? 'set' : ''}`}
              style={{ ['--c' as string]: CUE_COLORS[slot - 1] }}
              title={has ? 'Click: jump · Shift: clear · Alt: set' : 'Set hot cue'}
              onClick={(e) => {
                if (e.shiftKey && has) {
                  deck.clearHotCue(slot);
                  return;
                }
                if (e.altKey || e.metaKey || !has) {
                  deck.setHotCue(slot);
                  return;
                }
                deck.jumpHotCue(slot);
              }}
            >
              <span>{slot}</span>
              {has && <i />}
            </button>
          );
        })}
      </div>
      <div className="vdj-cue-hint">Hot cues · Shift limpia · Alt fija</div>
    </div>
  );
};

export default DeckPanel;
