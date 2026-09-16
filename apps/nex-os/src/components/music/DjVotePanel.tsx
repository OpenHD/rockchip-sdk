import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp24Regular, Delete24Regular, Play24Filled } from '@fluentui/react-icons';
import type { DjEqSettings, DjModeState, DjVoteEntry } from '../../types/music';

interface DjVotePanelProps {
  djMode: DjModeState;
  djPool: DjVoteEntry[];
  djEq: DjEqSettings;
  isHost: boolean;
  onToggleDj: (enabled: boolean) => void;
  onToggleAutoPlay: (autoPlay: boolean) => void;
  onUpdateDjEq: (eq: DjEqSettings) => void;
  onVote: (entryId: string) => void;
  onPlayTop: () => void;
  onClear: () => void;
}

export const DjVotePanel: React.FC<DjVotePanelProps> = ({
  djMode,
  djPool,
  djEq,
  isHost,
  onToggleDj,
  onToggleAutoPlay,
  onUpdateDjEq,
  onVote,
  onPlayTop,
  onClear,
}) => {
  const [localEq, setLocalEq] = useState<DjEqSettings>(djEq);

  useEffect(() => {
    setLocalEq(djEq);
  }, [djEq]);

  const presets = useMemo(
    () => [
      { name: 'Flat', bands: Array(32).fill(0) },
      { name: 'Bass Boost', bands: Array(32).fill(0).map((_, index) => (index < 10 ? 5 : 0)) },
      { name: 'Treble Boost', bands: Array(32).fill(0).map((_, index) => (index >= 22 ? 5 : 0)) },
      { name: 'Vocal', bands: Array(32).fill(0).map((_, index) => (index >= 10 && index < 22 ? 3 : 0)) },
      { name: 'Dance', bands: Array(32).fill(0).map((_, index) => (index >= 8 && index < 24 ? 4 : 0)) },
    ],
    [],
  );

  const updateEq = (updates: Partial<DjEqSettings>) => {
    const nextEq = { ...localEq, ...updates };
    setLocalEq(nextEq);
    onUpdateDjEq(nextEq);
  };

  const setBandValue = (index: number, value: number) => {
    const bands = [...localEq.bands];
    bands[index] = value;
    updateEq({ bands, preset: 'Custom' });
  };

  return (
    <div className="dj-panel">
      <div className="dj-panel-header">
        <span className="dj-badge">🎧 Modo DJ</span>
        {isHost && (
          <label className="dj-toggle">
            <input
              type="checkbox"
              checked={djMode.enabled}
              onChange={(e) => onToggleDj(e.target.checked)}
            />
            {djMode.enabled ? 'Activo' : 'Inactivo'}
          </label>
        )}
      </div>

      {!djMode.enabled ? (
        <p className="dj-hint">
          {isHost
            ? 'Activá el modo DJ para que la audiencia sugiera canciones y vote cuál suena después.'
            : 'El anfitrión aún no activó el modo DJ.'}
        </p>
      ) : (
        <>
          {isHost && (
            <>
              <div className="dj-host-controls">
                <label className="dj-autoplay">
                  <input
                    type="checkbox"
                    checked={djMode.autoPlay}
                    onChange={(e) => onToggleAutoPlay(e.target.checked)}
                  />
                  Auto-reproducir ganadora al terminar
                </label>
                <div className="dj-host-actions">
                  <button type="button" className="dj-btn primary" onClick={onPlayTop} disabled={!djPool.length}>
                    <Play24Filled /> Reproducir top
                  </button>
                  <button type="button" className="dj-btn" onClick={onClear} disabled={!djPool.length}>
                    <Delete24Regular /> Limpiar
                  </button>
                </div>
              </div>

              <div className="dj-eq-panel">
                <div className="dj-eq-header">
                  <span className="dj-eq-title">Ecualizador DJ</span>
                  <label className="dj-eq-toggle">
                    <input
                      type="checkbox"
                      checked={localEq.enabled}
                      onChange={(e) => updateEq({ enabled: e.target.checked })}
                    />
                    Activado
                  </label>
                </div>

                <div className="dj-eq-summary">
                  <span>Preset: <strong>{localEq.preset}</strong></span>
                  <span>{localEq.lowCut ? 'Low cut ON' : 'Low cut OFF'}</span>
                  <span>{localEq.highCut ? 'High cut ON' : 'High cut OFF'}</span>
                </div>

                <div className="dj-eq-presets">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={`dj-eq-preset ${localEq.preset === preset.name ? 'active' : ''}`}
                      onClick={() => updateEq({ preset: preset.name, bands: preset.bands })}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className={`dj-eq-bands ${!localEq.enabled ? 'disabled' : ''}`}>
                  {localEq.bands.map((value, index) => (
                    <label key={index} className="dj-eq-band">
                      <span className="dj-eq-band-value">{value > 0 ? `+${value}` : value}</span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        value={value}
                        onChange={(e) => setBandValue(index, Number(e.target.value))}
                      />
                      <span className="dj-eq-band-index">{index + 1}</span>
                    </label>
                  ))}
                </div>

                <div className="dj-eq-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={localEq.lowCut}
                      onChange={(e) => updateEq({ lowCut: e.target.checked })}
                    />
                    Low cut
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={localEq.highCut}
                      onChange={(e) => updateEq({ highCut: e.target.checked })}
                    />
                    High cut
                  </label>
                </div>
              </div>
            </>
          )}

          <p className="dj-hint active">
            {isHost
              ? 'La audiencia vota desde la búsqueda con “Sugerir al DJ”.'
              : 'Buscá una canción y tocá “Sugerir al DJ” para proponerla.'}
          </p>

          {djPool.length === 0 ? (
            <div className="dj-empty">Sin sugerencias todavía — ¡sé el primero!</div>
          ) : (
            <ul className="dj-vote-list">
              {djPool.map((entry, index) => (
                <li key={entry.entryId} className={index === 0 ? 'leading' : ''}>
                  <div className="dj-vote-rank">{index + 1}</div>
                  {entry.track.cover && (
                    <img src={entry.track.cover} alt="" className="dj-vote-cover" />
                  )}
                  <div className="dj-vote-info">
                    <div className="dj-vote-title">{entry.track.title}</div>
                    <div className="dj-vote-meta">
                      {entry.track.artist} · por {entry.suggestedByName}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dj-vote-btn ${entry.votedByMe ? 'voted' : ''}`}
                    onClick={() => onVote(entry.entryId)}
                    title={entry.votedByMe ? 'Quitar voto' : 'Votar'}
                  >
                    <ArrowUp24Regular />
                    {entry.voteCount}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <style>{`
        .dj-panel {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dj-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .dj-badge {
          font-size: 13px;
          font-weight: 800;
          color: #fbbf24;
        }

        .dj-toggle, .dj-autoplay {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.75);
          cursor: pointer;
        }

        .dj-host-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dj-host-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .dj-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .dj-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .dj-btn.primary { background: #1db954; border-color: #1db954; color: #000; }
        .dj-btn svg { width: 16px; height: 16px; }

        .dj-hint {
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          line-height: 1.45;
        }

        .dj-hint.active { color: rgba(255,255,255,0.65); }

        .dj-empty {
          text-align: center;
          padding: 16px;
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px;
        }

        .dj-vote-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
        }

        .dj-vote-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 10px;
          background: rgba(0,0,0,0.25);
          border: 1px solid transparent;
        }

        .dj-vote-list li.leading {
          border-color: rgba(29,185,84,0.45);
          background: rgba(29,185,84,0.08);
        }

        .dj-vote-rank {
          width: 22px;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,0.45);
        }

        .dj-vote-list li.leading .dj-vote-rank { color: #1db954; }

        .dj-eq-panel {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dj-eq-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .dj-eq-title {
          font-size: 13px;
          font-weight: 800;
          color: #fbbf24;
        }

        .dj-eq-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.75);
          font-size: 12px;
          cursor: pointer;
        }

        .dj-eq-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: rgba(255,255,255,0.75);
          padding: 6px 0 0;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .dj-eq-summary span {
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }

        .dj-eq-summary strong {
          color: #fff;
        }

        .dj-eq-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dj-eq-preset {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.8);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .dj-eq-preset.active {
          border-color: #1db954;
          background: rgba(29,185,84,0.12);
          color: #fff;
        }

        .dj-eq-bands {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 6px;
          max-height: 240px;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 4px 0;
        }

        .dj-eq-bands.disabled {
          opacity: 0.45;
          pointer-events: none;
        }

        .dj-eq-band {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: rgba(255,255,255,0.55);
        }

        .dj-eq-band-value {
          font-size: 11px;
          color: rgba(255,255,255,0.75);
          min-height: 18px;
        }

        .dj-eq-band input {
          writing-mode: bt-lr; /* vertical slider support */
          -webkit-appearance: slider-vertical;
          width: 100%;
          height: 100px;
          background: transparent;
        }

        .dj-eq-band-index {
          font-size: 10px;
          color: rgba(255,255,255,0.45);
        }

        .dj-eq-options {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dj-eq-options label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.75);
          cursor: pointer;
        }

        .dj-vote-cover {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .dj-vote-info {
          flex: 1;
          min-width: 0;
        }

        .dj-vote-title {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dj-vote-meta {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dj-vote-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          min-width: 44px;
          padding: 6px 8px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .dj-vote-btn.voted {
          background: #1db954;
          border-color: #1db954;
          color: #000;
        }

        .dj-vote-btn svg { width: 14px; height: 14px; }
      `}</style>
    </div>
  );
};

export default DjVotePanel;
