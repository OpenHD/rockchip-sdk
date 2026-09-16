import React, { useCallback, useEffect, useState } from 'react';
import DeckPanel from './virtual-dj/DeckPanel';
import LibraryPanel from './virtual-dj/LibraryPanel';
import MixerPanel from './virtual-dj/MixerPanel';
import { useDjDeck } from './virtual-dj/useDjDeck';
import { useDjMaster } from './virtual-dj/useDjMaster';
import type { DjTrackRef } from './virtual-dj/types';

const ACCENT_A = '#ff6b4a';
const ACCENT_B = '#2ec4b6';

const VirtualDj: React.FC = () => {
  const {
    ensureMaster,
    crossfader,
    masterVolume,
    setCrossfader,
    setMasterVolume,
    cuePreview,
    setCuePreview,
  } = useDjMaster();

  const getMaster = useCallback(() => ensureMaster(), [ensureMaster]);
  const deckA = useDjDeck('A', getMaster);
  const deckB = useDjDeck('B', getMaster);
  const [masterDeck, setMasterDeck] = useState<'A' | 'B'>('A');

  const onLoad = useCallback(
    (deck: 'A' | 'B', track: DjTrackRef) => {
      void (deck === 'A' ? deckA.loadTrack(track) : deckB.loadTrack(track));
    },
    [deckA, deckB],
  );

  const fileToLocalTrack = useCallback((file: File): DjTrackRef => {
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || file.name;
    return {
      videoId: `local:${file.name}:${file.size}:${file.lastModified}`,
      title,
      artist: 'Local',
      cover: '',
      source: 'local',
      playUrl: URL.createObjectURL(file),
    };
  }, []);

  const syncSlave = useCallback(() => {
    if (masterDeck === 'A') deckB.syncRateFrom(deckA.state.rate);
    else deckA.syncRateFrom(deckB.state.rate);
  }, [deckA, deckB, masterDeck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        const deck = masterDeck === 'A' ? deckA : deckB;
        void deck.toggle();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        void deckA.toggle();
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        void deckB.toggle();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        (masterDeck === 'A' ? deckA : deckB).cueJump();
        return;
      }
      if (e.key === 'ArrowLeft' && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setCrossfader(Math.max(0, crossfader - 0.05));
        return;
      }
      if (e.key === 'ArrowRight' && (e.altKey || e.metaKey)) {
        e.preventDefault();
        setCrossfader(Math.min(1, crossfader + 0.05));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [crossfader, deckA, deckB, masterDeck, setCrossfader]);

  const live = deckA.state.playing || deckB.state.playing;

  return (
    <div className="vdj-root">
      <header className="vdj-header">
        <div className="vdj-brand">
          <span className="vdj-mark">NEX</span>
          <div>
            <div className="vdj-title">VIRTUAL DJ</div>
            <div className="vdj-sub">Dual platter · Local crate · Web Audio</div>
          </div>
        </div>
        <div className="vdj-header-right">
          <div className="vdj-keys" title="Atajos de teclado">
            <kbd>Space</kbd>
            <span>master</span>
            <kbd>Z</kbd>
            <span>A</span>
            <kbd>X</kbd>
            <span>B</span>
            <kbd>C</kbd>
            <span>cue</span>
          </div>
          <span className={`vdj-live ${live ? 'on' : ''}`}>
            <i />
            {live ? 'LIVE' : 'IDLE'}
          </span>
        </div>
      </header>

      <div className="vdj-main">
        <LibraryPanel onLoad={onLoad} />

        <div className="vdj-booth">
          <div className="vdj-chassis">
            <DeckPanel
              deck={deckA}
              label="A"
              accent={ACCENT_A}
              isMaster={masterDeck === 'A'}
              onMakeMaster={() => setMasterDeck('A')}
              cuePreview={cuePreview.A}
              onCuePreview={(enabled) => setCuePreview('A', enabled)}
              onLocalFile={(file) => onLoad('A', fileToLocalTrack(file))}
            />
            <MixerPanel
              crossfader={crossfader}
              masterVolume={masterVolume}
              onCrossfader={setCrossfader}
              onMasterVolume={setMasterVolume}
              onSyncSlave={syncSlave}
              masterDeck={masterDeck}
              channelA={deckA}
              channelB={deckB}
            />
            <DeckPanel
              deck={deckB}
              label="B"
              accent={ACCENT_B}
              isMaster={masterDeck === 'B'}
              onMakeMaster={() => setMasterDeck('B')}
              cuePreview={cuePreview.B}
              onCuePreview={(enabled) => setCuePreview('B', enabled)}
              onLocalFile={(file) => onLoad('B', fileToLocalTrack(file))}
              mirror
            />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@500;600&display=swap');

        .vdj-root {
          --vdj-bg: #05070a;
          --vdj-metal: #12171f;
          --vdj-metal-2: #1a222e;
          --vdj-line: rgba(220, 235, 255, 0.1);
          --vdj-text: #eef4fa;
          --vdj-muted: rgba(190, 210, 230, 0.55);
          --vdj-orange: #ff6b4a;
          --vdj-teal: #2ec4b6;
          height: 100%;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(ellipse 50% 35% at 12% -5%, rgba(255, 107, 74, 0.16), transparent 55%),
            radial-gradient(ellipse 45% 30% at 88% 0%, rgba(46, 196, 182, 0.14), transparent 50%),
            linear-gradient(180deg, #0a0e14 0%, var(--vdj-bg) 40%);
          color: var(--vdj-text);
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .vdj-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--vdj-line);
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
          flex-shrink: 0;
        }
        .vdj-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .vdj-mark {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.16em;
          font-size: 18px;
          padding: 6px 10px 4px;
          border: 1px solid rgba(255, 107, 74, 0.65);
          color: var(--vdj-orange);
          background: rgba(255, 107, 74, 0.08);
          animation: vdj-mark-in 0.55s ease-out;
        }
        .vdj-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 26px;
          letter-spacing: 0.08em;
          line-height: 1;
        }
        .vdj-sub { font-size: 11px; color: var(--vdj-muted); margin-top: 2px; }
        .vdj-header-right {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }
        .vdj-keys {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: var(--vdj-muted);
        }
        .vdj-keys kbd {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--vdj-line);
          background: rgba(255,255,255,0.04);
          color: var(--vdj-text);
        }
        .vdj-live {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--vdj-muted);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 64px;
          justify-content: flex-end;
        }
        .vdj-live i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.45;
        }
        .vdj-live.on { color: #ff5a5a; text-shadow: 0 0 12px rgba(255, 90, 90, 0.55); }
        .vdj-live.on i {
          opacity: 1;
          animation: vdj-pulse 1.1s ease-in-out infinite;
        }
        @keyframes vdj-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.7); opacity: 0.55; }
        }
        @keyframes vdj-mark-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: none; }
        }

        .vdj-main {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 260px 1fr;
        }

        .vdj-booth {
          min-height: 0;
          overflow: auto;
          padding: 12px;
          display: flex;
        }
        .vdj-chassis {
          flex: 1;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) 220px minmax(280px, 1fr);
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.04), transparent 40%),
            linear-gradient(180deg, #161c26, #0c1016 70%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 20px 50px rgba(0,0,0,0.45);
          min-height: 0;
        }

        /* ── Library ── */
        .vdj-lib {
          border-right: 1px solid var(--vdj-line);
          background: linear-gradient(180deg, rgba(10,14,20,0.98), rgba(6,9,14,0.96));
          display: flex;
          flex-direction: column;
          min-height: 0;
          transition: background 0.2s ease, outline-color 0.2s ease;
        }
        .vdj-lib-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 14px 8px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 0.14em;
        }
        .vdj-dsp-pill {
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid var(--vdj-line);
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .vdj-dsp-pill.ok { color: var(--vdj-teal); border-color: rgba(46,196,182,0.45); }
        .vdj-dsp-pill.warn { color: #ff9f1c; border-color: rgba(255,159,28,0.4); }
        .vdj-lib.drag-over {
          outline: 1px dashed rgba(46,196,182,0.7);
          outline-offset: -6px;
          background: rgba(46,196,182,0.08);
        }
        .vdj-lib-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          padding: 0 12px 10px;
        }
        .vdj-lib-tab {
          border: 1px solid var(--vdj-line);
          background: rgba(255,255,255,0.02);
          color: var(--vdj-muted);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .vdj-lib-tab em {
          font-style: normal;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 999px;
          background: rgba(46,196,182,0.18);
          color: var(--vdj-teal);
        }
        .vdj-lib-tab.active {
          color: var(--vdj-text);
          border-color: rgba(46,196,182,0.45);
          background: rgba(46,196,182,0.1);
        }
        .vdj-dropzone {
          margin: 0 12px 10px;
          padding: 18px 14px;
          border-radius: 12px;
          border: 1px dashed rgba(46,196,182,0.35);
          background:
            linear-gradient(160deg, rgba(46,196,182,0.08), transparent 55%),
            rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          text-align: center;
          transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
        }
        .vdj-dropzone:hover, .vdj-dropzone.hot {
          border-color: rgba(46,196,182,0.75);
          transform: translateY(-1px);
          background:
            linear-gradient(160deg, rgba(46,196,182,0.14), transparent 55%),
            rgba(0,0,0,0.28);
        }
        .vdj-dropzone.compact { padding: 12px 10px; }
        .vdj-dropzone-icon {
          color: var(--vdj-teal);
          margin-bottom: 2px;
        }
        .vdj-dropzone strong {
          font-size: 13px;
          font-weight: 700;
        }
        .vdj-dropzone span {
          font-size: 11px;
          color: var(--vdj-muted);
        }
        .vdj-lib-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 14px 8px;
          font-size: 11px;
          color: var(--vdj-muted);
        }
        .vdj-lib-ph.local {
          display: grid;
          place-items: center;
          color: var(--vdj-teal);
          font-size: 18px;
          background: linear-gradient(145deg, #15202b, #0d1520);
          border: 1px solid rgba(46,196,182,0.35);
        }
        .vdj-lib-search {
          display: flex;
          gap: 6px;
          padding: 0 12px 8px;
        }
        .vdj-lib-search input {
          flex: 1;
          background: #05070a;
          border: 1px solid var(--vdj-line);
          color: var(--vdj-text);
          border-radius: 6px;
          padding: 9px 10px;
          font-size: 13px;
          outline: none;
          font-family: inherit;
        }
        .vdj-lib-search input:focus { border-color: rgba(46,196,182,0.5); }
        .vdj-lib-error, .vdj-lib-empty {
          padding: 0 14px 10px;
          font-size: 11px;
          color: var(--vdj-muted);
          line-height: 1.45;
        }
        .vdj-lib-error { color: var(--vdj-orange); }
        .vdj-lib-empty-card {
          margin: 8px 6px;
          padding: 16px 12px;
          border-radius: 10px;
          border: 1px solid var(--vdj-line);
          background: rgba(255,255,255,0.02);
        }
        .vdj-lib-empty-card p {
          margin: 0 0 4px;
          font-size: 12px;
          font-weight: 700;
        }
        .vdj-lib-empty-card span {
          font-size: 11px;
          color: var(--vdj-muted);
          line-height: 1.45;
        }
        .vdj-lib-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px 12px;
        }
        .vdj-lib-row {
          display: grid;
          grid-template-columns: 42px 1fr 34px 34px;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border-radius: 10px;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .vdj-lib-row:hover { background: rgba(255,255,255,0.045); }
        .vdj-lib-row.flash { animation: vdj-row-flash 0.42s ease; }
        @keyframes vdj-row-flash {
          from { background: rgba(46,196,182,0.18); }
          to { background: transparent; }
        }
        .vdj-lib-row img, .vdj-lib-ph {
          width: 42px;
          height: 42px;
          border-radius: 8px;
          object-fit: cover;
          background: #15202b;
        }
        .vdj-lib-info { min-width: 0; }
        .vdj-lib-title {
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vdj-lib-ch { font-size: 11px; color: var(--vdj-muted); }
        .vdj-load-a, .vdj-load-b {
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--vdj-line);
          background: #0c1118;
          color: var(--vdj-text);
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .vdj-load-a {
          border-color: rgba(255,107,74,0.45);
          color: var(--vdj-orange);
        }
        .vdj-load-b {
          border-color: rgba(46,196,182,0.45);
          color: var(--vdj-teal);
        }
        .vdj-load-a:hover, .vdj-load-b:hover { transform: translateY(-1px); }
        .vdj-load-a.pulse, .vdj-load-b.pulse {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.12);
          transform: scale(1.06);
        }

        /* ── Deck ── */
        .vdj-deck.drag-over {
          outline: 1px dashed rgba(46,196,182,0.7);
          outline-offset: -4px;
          background: linear-gradient(180deg, rgba(46,196,182,0.12), var(--vdj-metal));
        }
        .vdj-deck {
          background: linear-gradient(180deg, var(--vdj-metal-2), var(--vdj-metal));
          border: 1px solid var(--vdj-line);
          border-radius: 14px;
          padding: 12px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          transition: border-color 0.2s ease, box-shadow 0.25s ease;
        }
        .vdj-deck.playing {
          border-color: color-mix(in srgb, var(--a) 45%, var(--vdj-line));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 0 1px color-mix(in srgb, var(--a) 18%, transparent),
            0 12px 28px rgba(0,0,0,0.28);
        }
        .vdj-deck-head {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
        }
        .vdj-deck-badge {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 2px solid var(--a);
          color: var(--a);
          background: color-mix(in srgb, var(--a) 14%, transparent);
          line-height: 1;
          padding-top: 2px;
        }
        .vdj-deck-meta { min-width: 0; }
        .vdj-track-title {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vdj-track-artist {
          font-size: 11px;
          color: var(--vdj-muted);
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .vdj-track-empty {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .vdj-track-empty strong { font-size: 12px; }
        .vdj-track-empty span { font-size: 11px; color: var(--vdj-muted); }
        .vdj-src-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.06em;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid var(--vdj-line);
          flex-shrink: 0;
        }
        .vdj-src-chip.local {
          color: var(--vdj-teal);
          border-color: rgba(46,196,182,0.4);
        }
        .vdj-src-chip.yt {
          color: #ff9f1c;
          border-color: rgba(255,159,28,0.4);
        }
        .vdj-deck-leds { display: flex; gap: 4px; }
        .vdj-led {
          border: 1px solid var(--vdj-line);
          background: #0a0e14;
          color: var(--vdj-muted);
          border-radius: 4px;
          padding: 5px 7px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .vdj-led.on {
          color: #fff;
          border-color: var(--vdj-orange);
          background: rgba(255, 107, 74, 0.25);
          box-shadow: 0 0 10px rgba(255, 107, 74, 0.35);
        }
        .vdj-led.on.teal {
          border-color: var(--vdj-teal);
          background: rgba(46, 196, 182, 0.22);
          box-shadow: 0 0 10px rgba(46, 196, 182, 0.35);
        }

        .vdj-wave-wrap {
          position: relative;
          height: 72px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--vdj-line);
          background: #05080c;
        }
        .vdj-wave-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(5, 8, 12, 0.78);
          font-size: 12px;
          color: var(--vdj-muted);
          padding: 12px;
          text-align: center;
          backdrop-filter: blur(2px);
        }
        .vdj-wave-overlay.err { color: var(--vdj-orange); }
        .vdj-wave-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .vdj-wave-loading i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--a);
          animation: vdj-pulse 0.9s ease-in-out infinite;
        }

        .vdj-deck-body {
          display: grid;
          grid-template-columns: 1fr 44px;
          gap: 8px;
          align-items: center;
          flex: 1;
        }
        .vdj-deck.mirror .vdj-deck-body {
          grid-template-columns: 44px 1fr;
        }
        .vdj-deck.mirror .vdj-platter-col { order: 2; }
        .vdj-deck.mirror .vdj-pitch-col { order: 1; }

        .vdj-platter-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .vdj-pitch-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          height: 100%;
          min-height: 200px;
        }
        .vdj-fader-cap {
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--vdj-muted);
          font-weight: 700;
        }

        /* ── Platter ── */
        .vdj-platter {
          width: min(100%, 250px);
          aspect-ratio: 1;
          cursor: crosshair;
          user-select: none;
          position: relative;
        }
        .vdj-platter-chassis {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), transparent 40%),
            radial-gradient(circle at 50% 50%, #1c2430, #070a0e 70%);
          border: 3px solid #2a3340;
          box-shadow:
            inset 0 0 30px rgba(0,0,0,0.65),
            0 8px 24px rgba(0,0,0,0.5),
            0 0 0 1px rgba(255,255,255,0.05);
          position: relative;
          display: grid;
          place-items: center;
        }
        .vdj-platter-ring {
          position: absolute;
          inset: 4%;
          width: 92%;
          height: 92%;
          pointer-events: none;
          z-index: 3;
        }
        .vdj-platter-progress {
          filter: drop-shadow(0 0 4px var(--accent));
          transition: stroke-dasharray 0.08s linear;
        }
        .vdj-platter-disc {
          width: 78%;
          height: 78%;
          border-radius: 50%;
          position: relative;
          z-index: 1;
          will-change: transform;
          background: #0a0c10;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
        }
        .vdj-platter-grooves {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            repeating-radial-gradient(
              circle at center,
              transparent 0,
              transparent 2px,
              rgba(255,255,255,0.035) 2px,
              rgba(255,255,255,0.035) 3px
            );
          opacity: 0.9;
        }
        .vdj-platter-label {
          position: absolute;
          inset: 28%;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid color-mix(in srgb, var(--accent) 55%, #333);
          box-shadow: 0 0 0 4px rgba(0,0,0,0.45);
          background: #111;
        }
        .vdj-platter-label img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
        }
        .vdj-platter-empty {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: radial-gradient(circle, color-mix(in srgb, var(--accent) 25%, #151515), #0a0a0a);
          font-family: 'Bebas Neue', sans-serif;
          font-size: 42px;
          color: color-mix(in srgb, var(--accent) 80%, white);
          letter-spacing: 0.05em;
        }
        .vdj-platter-empty small {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          opacity: 0.7;
        }
        .vdj-platter.is-empty .vdj-platter-chassis {
          animation: vdj-empty-breathe 2.4s ease-in-out infinite;
        }
        @keyframes vdj-empty-breathe {
          0%, 100% { box-shadow: inset 0 0 30px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.5); }
          50% {
            box-shadow:
              inset 0 0 30px rgba(0,0,0,0.65),
              0 8px 24px rgba(0,0,0,0.5),
              0 0 18px color-mix(in srgb, var(--accent) 22%, transparent);
          }
        }
        .vdj-platter-spindle {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 12%;
          height: 12%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #ddd, #666 55%, #222);
          box-shadow: 0 1px 3px rgba(0,0,0,0.6);
          z-index: 2;
        }
        .vdj-platter-tonearm {
          position: absolute;
          top: 8%;
          right: 10%;
          width: 4px;
          height: 38%;
          background: linear-gradient(180deg, #8a93a0, #3a4250);
          border-radius: 2px;
          transform: rotate(8deg);
          transform-origin: top center;
          z-index: 4;
          box-shadow: 1px 2px 4px rgba(0,0,0,0.4);
          opacity: 0.55;
          pointer-events: none;
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .vdj-platter-tonearm.down { transform: rotate(22deg); }
        .vdj-platter-tonearm::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          width: 14px;
          height: 14px;
          margin-left: -7px;
          border-radius: 50% 50% 40% 40%;
          background: #c4cad3;
        }

        .vdj-time-row {
          display: flex;
          justify-content: space-between;
          width: 100%;
          max-width: 250px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--vdj-muted);
        }
        .vdj-pitch { color: var(--a, var(--vdj-text)); font-weight: 600; }
        .vdj-remain { opacity: 0.85; }

        .vdj-transport {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }
        .vdj-pad {
          border: 1px solid var(--vdj-line);
          background: linear-gradient(180deg, #243041, #151b24);
          color: var(--vdj-text);
          border-radius: 8px;
          padding: 10px 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          font-family: inherit;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
          transition: border-color 0.15s ease, transform 0.1s ease, background 0.15s ease;
        }
        .vdj-pad:hover:not(:disabled) { border-color: rgba(255,255,255,0.22); }
        .vdj-pad:active:not(:disabled) { transform: translateY(1px); }
        .vdj-pad:disabled { opacity: 0.4; cursor: not-allowed; }
        .vdj-pad.play {
          background: linear-gradient(180deg, color-mix(in srgb, var(--a) 45%, #243041), color-mix(in srgb, var(--a) 18%, #151b24));
          border-color: color-mix(in srgb, var(--a) 55%, white);
          font-size: 14px;
        }
        .vdj-pad.play.active, .vdj-pad.active {
          background: color-mix(in srgb, var(--vdj-teal) 28%, #151b24);
          border-color: var(--vdj-teal);
          color: #b8fff6;
        }
        .vdj-pad.cue { letter-spacing: 0.12em; }

        .vdj-cues {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .vdj-cue {
          height: 42px;
          border-radius: 8px;
          border: 1px solid var(--vdj-line);
          background: #0c1118;
          color: var(--vdj-muted);
          font-weight: 700;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          position: relative;
          transition: transform 0.12s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .vdj-cue i {
          position: absolute;
          left: 6px;
          right: 6px;
          bottom: 5px;
          height: 3px;
          border-radius: 2px;
          background: var(--c);
          opacity: 0.9;
        }
        .vdj-cue.set {
          border-color: var(--c);
          color: #fff;
          background: color-mix(in srgb, var(--c) 28%, #0c1118);
          box-shadow: 0 0 12px color-mix(in srgb, var(--c) 35%, transparent);
        }
        .vdj-cue:hover { transform: translateY(-1px); }
        .vdj-cue-hint {
          font-size: 10px;
          color: var(--vdj-muted);
          text-align: center;
          letter-spacing: 0.02em;
          margin-top: -2px;
        }

        .vdj-btn {
          border: 1px solid var(--vdj-line);
          background: rgba(255,255,255,0.04);
          color: var(--vdj-text);
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          font-family: inherit;
        }
        .vdj-btn:hover { border-color: rgba(255,255,255,0.25); }
        .vdj-btn.primary {
          background: color-mix(in srgb, var(--vdj-teal) 22%, transparent);
          border-color: color-mix(in srgb, var(--vdj-teal) 50%, white);
        }
        .vdj-btn.ghost {
          background: transparent;
          color: var(--vdj-muted);
        }
        .vdj-btn.slim { padding: 6px 8px; min-width: 34px; }
        .vdj-btn.tiny {
          padding: 4px 6px;
          min-width: 28px;
          font-size: 10px;
        }

        /* Vertical faders (no invalid HTML orient attr) */
        .vdj-vert-fader {
          writing-mode: vertical-lr;
          direction: rtl;
          width: 28px;
          height: 160px;
          flex: 1;
          accent-color: var(--a, var(--vdj-orange));
          cursor: pointer;
        }
        .vdj-vert-fader.ch { accent-color: var(--ch); height: 110px; }
        .vdj-vert-fader.master { accent-color: #e8f1f8; height: 120px; }

        /* ── Mixer ── */
        .vdj-mixer {
          background: linear-gradient(180deg, #1c2430, #10151c);
          border: 1px solid var(--vdj-line);
          border-radius: 14px;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: stretch;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .vdj-mixer-title {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.2em;
          font-size: 18px;
          text-align: center;
          color: var(--vdj-muted);
        }
        .vdj-mixer-channels {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 6px;
          flex: 1;
          min-height: 0;
        }
        .vdj-ch {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 8px 4px;
          border-radius: 10px;
          background: rgba(0,0,0,0.25);
          border: 1px solid color-mix(in srgb, var(--ch) 25%, transparent);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .vdj-ch.live {
          border-color: color-mix(in srgb, var(--ch) 55%, transparent);
          box-shadow: 0 0 16px color-mix(in srgb, var(--ch) 18%, transparent);
        }
        .vdj-ch-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 20px;
          color: var(--ch);
          line-height: 1;
        }
        .vdj-vu {
          display: flex;
          gap: 2px;
          height: 14px;
          align-items: flex-end;
          margin-bottom: 2px;
        }
        .vdj-vu span {
          width: 5px;
          height: 100%;
          border-radius: 1px;
          background: rgba(255,255,255,0.12);
          transition: background 0.08s linear, opacity 0.08s linear;
        }
        .vdj-vu span.on {
          background: linear-gradient(180deg, var(--vu), color-mix(in srgb, var(--vu) 40%, white));
        }
        .vdj-knob-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 9px;
          letter-spacing: 0.08em;
          color: var(--vdj-muted);
          font-weight: 700;
          width: 100%;
        }
        .vdj-knob-wrap em {
          font-style: normal;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: var(--vdj-text);
        }
        .vdj-knob {
          width: 100%;
          accent-color: var(--ch);
          height: 18px;
        }
        .vdj-ch-gain {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--vdj-muted);
          font-weight: 700;
        }
        .vdj-ch-gain em {
          font-style: normal;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--vdj-text);
        }
        .vdj-mixer-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 0;
        }
        .vdj-meter-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--vdj-muted);
          font-weight: 700;
        }
        .vdj-meter-block em {
          font-style: normal;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--vdj-text);
        }
        .vdj-sync-btn {
          border: 1px solid rgba(46,196,182,0.45);
          background: rgba(46,196,182,0.12);
          color: #9ff0e6;
          border-radius: 8px;
          padding: 10px 8px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          letter-spacing: 0.12em;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.1;
        }
        .vdj-sync-btn small {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0;
          opacity: 0.8;
        }
        .vdj-xfade-block { margin-top: auto; }
        .vdj-xfade-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--vdj-muted);
          margin-bottom: 6px;
          font-weight: 700;
        }
        .vdj-xfade-labels .hot { color: var(--vdj-text); }
        .vdj-xfade-center {
          border: 1px solid var(--vdj-line);
          background: rgba(255,255,255,0.04);
          color: var(--vdj-muted);
          border-radius: 999px;
          padding: 3px 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          letter-spacing: 0.04em;
        }
        .vdj-xfade-center:hover {
          color: var(--vdj-text);
          border-color: rgba(255,255,255,0.25);
        }
        .vdj-xfade-rail {
          position: relative;
          padding: 10px 8px;
          border-radius: 10px;
          background: rgba(0,0,0,0.35);
          border: 1px solid var(--vdj-line);
          overflow: hidden;
        }
        .vdj-xfade-fill {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            rgba(255,107,74,0.18) 0%,
            transparent calc(var(--xf) * 100%),
            rgba(46,196,182,0.18) 100%
          );
        }
        .vdj-xfade {
          position: relative;
          width: 100%;
          accent-color: #e8f1f8;
          height: 22px;
          cursor: pointer;
        }

        @media (max-width: 1100px) {
          .vdj-main { grid-template-columns: 1fr; }
          .vdj-lib { max-height: 260px; border-right: none; border-bottom: 1px solid var(--vdj-line); }
          .vdj-chassis { grid-template-columns: 1fr; }
          .vdj-platter { width: min(100%, 220px); }
          .vdj-keys { display: none; }
        }
      `}</style>
    </div>
  );
};

export default VirtualDj;
