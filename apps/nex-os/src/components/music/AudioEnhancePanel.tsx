import React from 'react';
import type { AudioPreset, NexAudioSettings } from '../../hooks/useNexAudioEnhance';

interface AudioEnhancePanelProps {
  open: boolean;
  onClose: () => void;
  settings: NexAudioSettings;
  onChange: (patch: Partial<NexAudioSettings>) => void;
  onEnablePower?: () => void;
  /** 'dsp' = Web Audio real; 'youtube' = iframe loudness only */
  playbackMode?: 'idle' | 'dsp' | 'youtube';
}

const PRESETS: { id: AudioPreset; label: string; hint: string }[] = [
  { id: 'flat', label: 'Natural', hint: 'Sin color' },
  { id: 'clear', label: 'Clear', hint: 'Más definición' },
  { id: 'bass', label: 'Bass', hint: 'Más cuerpo' },
  { id: 'loud', label: 'Loud', hint: 'Más volumen' },
  { id: 'club', label: 'Club', hint: 'Máxima potencia' },
  { id: 'night', label: 'Noche', hint: 'Suave' },
];

const AudioEnhancePanel: React.FC<AudioEnhancePanelProps> = ({
  open,
  onClose,
  settings,
  onChange,
  onEnablePower,
  playbackMode = 'idle',
}) => {
  if (!open) return null;

  const dspLive = playbackMode === 'dsp';
  const hasMusicServer = Boolean(import.meta.env.VITE_MUSIC_SERVER_URL);

  return (
    <div className="audio-enhance-panel" role="dialog" aria-label="Sonido Potencia">
      <div className="audio-enhance-header">
        <strong>Sonido Potencia</strong>
        <button type="button" className="audio-enhance-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className={`audio-mode-pill ${dspLive ? 'live' : playbackMode === 'youtube' ? 'yt' : ''}`}>
        {dspLive
          ? 'DSP en vivo · EQ + compresor + 8D stereo'
          : playbackMode === 'youtube'
            ? hasMusicServer
              ? 'YouTube · music server no resolvió este tema'
              : 'YouTube · falta music server (yt-dlp) para DSP real'
            : 'Esperando reproducción'}
      </div>

      {onEnablePower && (
        <button type="button" className="audio-power-cta" onClick={onEnablePower}>
          Activar Modo Potencia + 8D
        </button>
      )}

      <div className="audio-enhance-block">
        <div className="audio-enhance-label">Potencia · {settings.power}</div>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.power}
          onChange={(e) => onChange({ power: Number(e.target.value) })}
        />
        <div className="audio-power-meter" aria-hidden>
          <div className="audio-power-fill" style={{ width: `${settings.power}%` }} />
        </div>
      </div>

      <label className="audio-enhance-row">
        <span>Pipeline DSP (salida propia)</span>
        <input
          type="checkbox"
          checked={settings.preferDsp !== false}
          onChange={(e) => onChange({ preferDsp: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>8D espacial {dspLive ? '' : '(requiere DSP)'}</span>
        <input
          type="checkbox"
          checked={settings.spatial8d}
          onChange={(e) => onChange({ spatial8d: e.target.checked })}
        />
      </label>

      {settings.spatial8d && (
        <div className="audio-enhance-block">
          <div className="audio-enhance-label">Velocidad 8D · {settings.spatialSpeed}</div>
          <input
            type="range"
            min={5}
            max={100}
            value={settings.spatialSpeed}
            onChange={(e) => onChange({ spatialSpeed: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="audio-enhance-block">
        <div className="audio-enhance-label">EQ · Bass {settings.eqBass > 0 ? '+' : ''}{settings.eqBass}</div>
        <input
          type="range"
          min={-8}
          max={8}
          step={0.5}
          value={settings.eqBass}
          onChange={(e) => onChange({ eqBass: Number(e.target.value) })}
        />
        <div className="audio-enhance-label">EQ · Mid {settings.eqMid > 0 ? '+' : ''}{settings.eqMid}</div>
        <input
          type="range"
          min={-8}
          max={8}
          step={0.5}
          value={settings.eqMid}
          onChange={(e) => onChange({ eqMid: Number(e.target.value) })}
        />
        <div className="audio-enhance-label">EQ · Treble {settings.eqTreble > 0 ? '+' : ''}{settings.eqTreble}</div>
        <input
          type="range"
          min={-8}
          max={8}
          step={0.5}
          value={settings.eqTreble}
          onChange={(e) => onChange({ eqTreble: Number(e.target.value) })}
        />
      </div>

      <label className="audio-enhance-row">
        <span>Calidad HD (mejor bitrate YT)</span>
        <input
          type="checkbox"
          checked={settings.hd}
          onChange={(e) => onChange({ hd: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>Boost + soft ceiling</span>
        <input
          type="checkbox"
          checked={settings.boost}
          onChange={(e) => onChange({ boost: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>Auto-gain al inicio</span>
        <input
          type="checkbox"
          checked={settings.autoGain}
          onChange={(e) => onChange({ autoGain: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>Punch de ataque</span>
        <input
          type="checkbox"
          checked={settings.punch}
          onChange={(e) => onChange({ punch: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>Normalizar entre temas</span>
        <input
          type="checkbox"
          checked={settings.normalize}
          onChange={(e) => onChange({ normalize: e.target.checked })}
        />
      </label>

      <label className="audio-enhance-row">
        <span>Crossfade dual (overlap)</span>
        <input
          type="checkbox"
          checked={settings.dualCrossfade}
          onChange={(e) => onChange({ dualCrossfade: e.target.checked })}
        />
      </label>

      <div className="audio-enhance-block">
        <div className="audio-enhance-label">
          Crossfade · {settings.crossfadeSec}s
        </div>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={settings.crossfadeSec}
          onChange={(e) => onChange({ crossfadeSec: Number(e.target.value) })}
        />
      </div>

      <div className="audio-enhance-block">
        <div className="audio-enhance-label">Perfil</div>
        <div className="audio-enhance-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`audio-preset-btn ${settings.preset === p.id ? 'active' : ''}`}
              onClick={() => onChange({ preset: p.id })}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="audio-enhance-note">
        DSP real necesita el music server con yt-dlp (
        <code style={{ fontSize: 10 }}>VITE_MUSIC_SERVER_URL</code>
        ). Sin eso, YouTube bloquea el stream y solo queda potencia/8D por volumen.
      </p>

      <style>{`
        .audio-enhance-panel {
          position: absolute;
          right: 12px;
          bottom: calc(100% + 10px);
          width: min(320px, calc(100vw - 24px));
          background: linear-gradient(160deg, #141414 0%, #0c1a12 100%);
          border: 1px solid rgba(29,185,84,0.28);
          border-radius: 14px;
          padding: 14px;
          z-index: 120;
          box-shadow: 0 12px 40px rgba(0,0,0,0.55);
          max-height: min(70vh, 560px);
          overflow-y: auto;
        }
        .audio-enhance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .audio-enhance-close {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 14px;
        }
        .audio-mode-pill {
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 8px;
          margin-bottom: 10px;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.55);
        }
        .audio-mode-pill.live {
          background: rgba(29,185,84,0.18);
          color: #6dff9a;
        }
        .audio-mode-pill.yt {
          background: rgba(240,193,75,0.14);
          color: #f0c14b;
        }
        .audio-power-cta {
          width: 100%;
          margin-bottom: 12px;
          border: none;
          border-radius: 999px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          background: linear-gradient(90deg, #1db954, #12d6c5);
          color: #04120a;
        }
        .audio-enhance-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: rgba(255,255,255,0.85);
          margin-bottom: 10px;
        }
        .audio-enhance-block { margin: 12px 0; }
        .audio-enhance-label {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 8px;
        }
        .audio-enhance-block input[type="range"] { width: 100%; accent-color: #1db954; }
        .audio-power-meter {
          margin-top: 8px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .audio-power-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #1db954, #f0c14b 70%, #ff5a5a);
          transition: width 0.15s ease;
        }
        .audio-enhance-presets {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .audio-preset-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          border-radius: 8px;
          padding: 8px 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .audio-preset-btn.active {
          background: #1db954;
          color: #000;
          border-color: #1db954;
        }
        .audio-enhance-note {
          margin: 10px 0 0;
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
};

export default AudioEnhancePanel;
