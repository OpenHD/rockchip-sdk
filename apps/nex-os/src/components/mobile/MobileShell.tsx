import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Pause24Filled, Play24Filled } from '@fluentui/react-icons';
import { useWindowManager } from '../../context/WindowManager';
import { useSettings } from '../../context/SettingsContext';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import { useUI } from '../../context/UIContext';
import { useLauncherApps } from '../../hooks/useLauncherApps';
import type { AppItem } from '../../constants/apps';
import MobileStatusBar from './MobileStatusBar';
import MobileHome, { AppGlyph } from './MobileHome';
import MobileNavBar from './MobileNavBar';
import MobileShade from './MobileShade';
import MobileAppSwitcher from './MobileAppSwitcher';
import MobileAppWindow from './MobileAppWindow';
import NexAssistantPanel from '../system/NexAssistantPanel';
import './mobile.css';

const DOCK_IDS = ['games', 'chrome', 'nexreproductor', 'control-panel'];

interface MobileShellProps {
  onShutdown: () => void;
  onRestart: () => void;
}

const MobileShell: React.FC<MobileShellProps> = ({ onShutdown, onRestart }) => {
  const { windows, openWindow, closeWindow, minimizeAllWindows, restoreWindow, minimizeOthers, focusedWindowId } =
    useWindowManager();
  const { wallpaper, userName, lockSystem } = useSettings();
  const { currentTrack, isPlaying, togglePlay } = useMusicPlayer();
  const { isAssistantOpen, toggleAssistant, closeAssistant } = useUI();
  const launcherApps = useLauncherApps();

  const [query, setQuery] = useState('');
  const [shadeOpen, setShadeOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const homeApps = useMemo(
    () => launcherApps.filter((a) => a.id !== 'search'),
    [launcherApps],
  );

  const dockApps = useMemo(() => {
    const byId = new Map(homeApps.map((a) => [a.id, a]));
    const picked = DOCK_IDS.map((id) => byId.get(id)).filter(Boolean) as AppItem[];
    if (picked.length >= 4) return picked.slice(0, 4);
    const extra = homeApps.filter((a) => !DOCK_IDS.includes(a.id)).slice(0, 4 - picked.length);
    return [...picked, ...extra].slice(0, 4);
  }, [homeApps]);

  const visibleWindows = windows.filter((w) => w.isOpen && !w.isMinimized);
  const hasApp = visibleWindows.length > 0;

  const launch = (app: AppItem) => {
    setShadeOpen(false);
    setRecentsOpen(false);
    setQuery('');
    openWindow(app.id, app.appId, app.label, app.icon);
    minimizeOthers(app.id);
  };

  const goHome = () => {
    setRecentsOpen(false);
    setShadeOpen(false);
    setPowerOpen(false);
    minimizeAllWindows();
  };

  const goBack = () => {
    if (isAssistantOpen) {
      closeAssistant();
      return;
    }
    if (powerOpen) {
      setPowerOpen(false);
      return;
    }
    if (shadeOpen) {
      setShadeOpen(false);
      return;
    }
    if (recentsOpen) {
      setRecentsOpen(false);
      return;
    }
    const focused = visibleWindows.find((w) => w.id === focusedWindowId) || visibleWindows[0];
    if (focused) {
      closeWindow(focused.id);
    }
  };

  const intercepting = hasApp || recentsOpen || shadeOpen || powerOpen || isAssistantOpen;
  const goBackRef = useRef(goBack);

  useEffect(() => {
    goBackRef.current = goBack;
  });

  useEffect(() => {
    if (!intercepting) return;
    if (!window.history.state?.nexPhone) {
      window.history.pushState({ nexPhone: true }, '');
    }
  }, [intercepting]);

  useEffect(() => {
    const onPop = () => goBackRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openRecents = () => {
    setShadeOpen(false);
    setPowerOpen(false);
    setRecentsOpen((v) => !v);
  };

  const openSettings = () => {
    const settings = homeApps.find((a) => a.id === 'control-panel') || homeApps.find((a) => a.appId === 'control-panel');
    if (settings) launch(settings);
    else {
      openWindow('control-panel', 'control-panel', 'Configuración', <span>⚙️</span>);
    }
  };

  return (
    <div
      className={`nex-m-shell ${hasApp ? 'has-app' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="nex-m-wallpaper"
        style={{ backgroundImage: `url(${wallpaper || '/wallpaper-premium.png'})` }}
      />

      <MobileStatusBar onPullDown={() => { setRecentsOpen(false); setShadeOpen(true); }} />

      <div className="nex-m-home-stage" data-dimmed={hasApp ? '1' : '0'} aria-hidden={hasApp}>
        <MobileHome
          apps={homeApps}
          query={query}
          onQuery={setQuery}
          onLaunch={launch}
          userName={userName}
          now={now}
        />

        <div className="nex-m-dock">
          {dockApps.map((app) => (
            <button
              key={app.id}
              type="button"
              className="nex-m-app-btn"
              onClick={() => launch(app)}
              aria-label={app.label}
            >
              <AppGlyph app={app} />
            </button>
          ))}
        </div>

        {currentTrack && (
          <div className="nex-m-mini">
            <button
              type="button"
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left' }}
              onClick={() => {
                const music = homeApps.find((a) => a.id === 'nexreproductor');
                if (music) launch(music);
              }}
            >
              <img src={currentTrack.cover} alt="" />
              <div className="nex-m-mini-info">
                <strong>{currentTrack.title}</strong>
                <span>{currentTrack.artist}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause24Filled /> : <Play24Filled />}
            </button>
          </div>
        )}
      </div>

      <div className="nex-m-app-stage">
        <AnimatePresence>
          {visibleWindows.map((win) => (
            <MobileAppWindow key={win.id} window={win} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {shadeOpen && (
          <MobileShade
            onClose={() => setShadeOpen(false)}
            onLock={() => {
              setShadeOpen(false);
              lockSystem();
            }}
            onSettings={() => {
              setShadeOpen(false);
              openSettings();
            }}
            onPower={() => {
              setShadeOpen(false);
              setPowerOpen(true);
            }}
            onAssistant={() => {
              setShadeOpen(false);
              toggleAssistant();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAssistantOpen && (
          <NexAssistantPanel isOpen={isAssistantOpen} onClose={closeAssistant} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recentsOpen && (
          <MobileAppSwitcher
            windows={windows}
            onOpen={(id) => {
              restoreWindow(id);
              minimizeOthers(id);
              setRecentsOpen(false);
            }}
            onCloseApp={closeWindow}
            onHome={goHome}
          />
        )}
      </AnimatePresence>

      {powerOpen && (
        <>
          <div className="nex-m-shade-backdrop" onClick={() => setPowerOpen(false)} />
          <div className="nex-m-shade" style={{ maxHeight: 'none', top: 'auto', bottom: 0, borderRadius: '28px 28px 0 0' }}>
            <div className="nex-m-shade-handle" />
            <div className="nex-m-shade-actions">
              <button type="button" onClick={() => { setPowerOpen(false); lockSystem(); }}>
                Bloquear
              </button>
              <button type="button" onClick={() => { setPowerOpen(false); onRestart(); }}>
                Reiniciar
              </button>
              <button type="button" className="danger" onClick={() => { setPowerOpen(false); onShutdown(); }}>
                Apagar
              </button>
            </div>
          </div>
        </>
      )}

      <MobileNavBar
        onBack={goBack}
        onHome={goHome}
        onRecents={openRecents}
        recentsOpen={recentsOpen}
        overlay={hasApp}
      />
    </div>
  );
};

export default MobileShell;
