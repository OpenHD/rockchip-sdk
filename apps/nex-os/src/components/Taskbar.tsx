import React from 'react';
import {
  Grid24Filled,
  Search24Regular,
  Speaker224Regular,
  Wifi424Regular,
  Calendar24Regular,
  WifiWarning24Regular,
  SpeakerMute24Regular,
  Play24Filled,
  Pause24Filled,
  Previous24Filled,
  Next24Filled,
  Apps24Regular,
  Desktop24Regular,
  Pin24Regular,
  Dismiss24Regular,
  SquareMultiple24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import { useWindowManager } from '../context/WindowManager';
import { useUI } from '../context/UIContext';
import { useSettings } from '../context/SettingsContext';
import { type AppItem } from '../constants/apps';
import { useLauncherApps } from '../hooks/useLauncherApps';
import ContextMenu, { type ContextMenuOption } from './ContextMenu';
import { useMusicPlayer } from '../context/MusicPlayerContext';

const PIN_KEY = 'win11_pinned_apps';

function loadPinnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

interface TaskbarProps {
  onStartClick: () => void;
  isStartOpen: boolean;
  onNotificationsClick?: () => void;
  onClockClick?: () => void;
  isNotificationsOpen?: boolean;
  onShutdown?: () => void;
  onRestart?: () => void;
  onSearchClick?: () => void;
}

/** Isolated so the 1s tick does not re-render the whole taskbar. */
function TaskbarClock({ onClockClick }: { onClockClick?: () => void }) {
  const [time, setTime] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="taskbar-clock" onClick={(e) => { e.stopPropagation(); onClockClick?.(); }}>
      <div className="time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="date">{time.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
    </div>
  );
}

const Taskbar: React.FC<TaskbarProps> = ({ 
  onStartClick, 
  isStartOpen, 
  onNotificationsClick,
  onClockClick,
  isNotificationsOpen,
  onShutdown,
  onRestart,
  onSearchClick,
}) => {
  const { openWindow, windows, minimizeWindow, focusedWindowId, minimizeAllWindows, restoreWindow, closeWindow } = useWindowManager();
  const { isWidgetsOpen, toggleWidgets, isAssistantOpen, toggleAssistant } = useUI();
  const { isWifiEnabled, volume, isTaskViewOpen, setIsTaskViewOpen, notifications } = useSettings();
  const { currentTrack, isPlaying, togglePlay, nextTrack, prevTrack, isGlobalMiniPlayerVisible, toggleGlobalMiniPlayer } = useMusicPlayer();
  const launcherApps = useLauncherApps();
  const [pinnedIds, setPinnedIds] = React.useState<Set<string>>(() => loadPinnedIds());
  const [taskbarContextMenu, setTaskbarContextMenu] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
    app?: AppItem;
  }>({ isOpen: false, x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem(PIN_KEY, JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  const appsWithPins = React.useMemo(
    () =>
      launcherApps.map((app) => ({
        ...app,
        isPinned: pinnedIds.has(app.id) || (!pinnedIds.has(`!${app.id}`) && !!app.isPinned),
      })),
    [launcherApps, pinnedIds],
  );

  const togglePin = (appId: string, currentlyPinned: boolean) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (currentlyPinned) {
        next.delete(appId);
        next.add(`!${appId}`); // explicit unpin override
      } else {
        next.delete(`!${appId}`);
        next.add(appId);
      }
      return next;
    });
  };

  // El dock es visible si se pasa el ratón por encima, o si hay un menú importante abierto
  const isVisible = isHovered || isStartOpen || isWidgetsOpen || taskbarContextMenu.isOpen;


  const [allMinimized, setAllMinimized] = React.useState(false);

  const handleAppClick = (app: AppItem) => {
    const existing = windows.find(w => w.id === app.id);
    if (existing) {
      if (existing.isMinimized) {
        openWindow(app.id, app.appId, app.label, app.icon);
      } else {
        minimizeWindow(app.id);
      }
      return;
    }
    openWindow(app.id, app.appId, app.label, app.icon);
  };

  const toggleShowDesktop = () => {
    const anyOpen = windows.some(w => !w.isMinimized);
    if (anyOpen) {
      minimizeAllWindows();
      setAllMinimized(true);
    } else {
      // Restore all windows that were open
      windows.forEach(w => {
        if (w.isOpen) {
          restoreWindow(w.id);
        }
      });
      setAllMinimized(false);
    }
  };

  return (
    <>
      {/* Global Miniplayer */}
      {isGlobalMiniPlayerVisible && currentTrack && (
        <div className="global-miniplayer">
          <img src={currentTrack.cover} alt="" className="global-miniplayer-cover" />
          <div className="global-miniplayer-info">
            <div className="global-miniplayer-title">{currentTrack.title}</div>
            <div className="global-miniplayer-artist">{currentTrack.artist}</div>
          </div>
          <div className="global-miniplayer-controls">
            <button onClick={prevTrack} className="global-miniplayer-btn">
              <Previous24Filled />
            </button>
            <button onClick={togglePlay} className="global-miniplayer-play-btn">
              {isPlaying ? <Pause24Filled /> : <Play24Filled />}
            </button>
            <button onClick={nextTrack} className="global-miniplayer-btn">
              <Next24Filled />
            </button>
          </div>
          <button onClick={toggleGlobalMiniPlayer} className="global-miniplayer-close">×</button>
        </div>
      )}

      <div 
        className={`taskbar-trigger-area ${isVisible ? 'expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <footer className={`taskbar-container mica gpu-accelerated ${isVisible ? 'visible' : ''}`}>
      <div className="taskbar-left">
        <button
          className={`taskbar-icon ${isWidgetsOpen ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleWidgets(); }}
        >
          <Grid24Filled />
        </button>

        {/* Nex Assistant — asistente de IA que puede operar el sistema */}
        <button
          className={`taskbar-icon ${isAssistantOpen ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleAssistant(); }}
          title="Nex Assistant · Ctrl+Alt+A"
        >
          <Sparkle24Regular />
        </button>

        {/* Miniplayer Toggle Button */}
        {currentTrack && (
          <button 
            className={`taskbar-icon ${isGlobalMiniPlayerVisible ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleGlobalMiniPlayer(); }}
            title="NEX Player"
          >
            <Play24Filled />
          </button>
        )}
      </div>

      <div className="taskbar-center">
        {/* START BUTTON */}
        <button 
          className={`taskbar-icon start-btn ${isStartOpen ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onStartClick(); }}
        >
          <Grid24Filled primaryFill="#0078d4" />
        </button>

        {/* SEARCH BAR (MODERNA) */}
        <div className="taskbar-search-pill" onClick={(e) => { e.stopPropagation(); onSearchClick?.(); }}>
          <Search24Regular className="search-pill-icon" />
          <span>Buscar</span>
        </div>

        <button
          className={`taskbar-icon ${isTaskViewOpen ? 'active' : ''}`}
          title="Vista de tareas"
          onClick={(e) => { e.stopPropagation(); setIsTaskViewOpen(!isTaskViewOpen); }}
        >
          <SquareMultiple24Regular />
        </button>

        {/* PINNED & OPEN APPS */}
        <div
          className="taskbar-apps"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTaskbarContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
          }}
        >
          {appsWithPins.filter(a => a.id !== 'search').map(app => {
            const isOpen = windows.some(w => w.id === app.id);
            const isFocused = focusedWindowId === app.id;
            
            // Si la app no está anclada ni abierta, no la mostramos en el dock
            if (!app.isPinned && !isOpen) return null;

            return (
              <button 
                key={app.id}
                className={`taskbar-app-icon ${isOpen ? 'open' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={() => handleAppClick(app)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTaskbarContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, app });
                }}
                title={app.label}
              >
                <div className="app-icon-inner">{app.icon}</div>
                {isOpen && <div className="app-indicator" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="taskbar-right">
        <div className="system-tray" onClick={(e) => { e.stopPropagation(); onNotificationsClick?.(); }}>
          {isWifiEnabled ? <Wifi424Regular /> : <WifiWarning24Regular />}
          {volume > 0 ? <Speaker224Regular /> : <SpeakerMute24Regular />}
          <div className="notifications-badge-container">
            {notifications.length > 0 && <div className="notifications-badge">{notifications.length}</div>}
          </div>
        </div>

        <TaskbarClock onClockClick={onClockClick} />
        
        <div className="show-desktop" onClick={(e) => { e.stopPropagation(); toggleShowDesktop(); }} />
      </div>
    </footer>
    </div>

    {taskbarContextMenu.isOpen && (
      <ContextMenu
        x={taskbarContextMenu.x}
        y={taskbarContextMenu.y}
        onClose={() => setTaskbarContextMenu({ isOpen: false, x: 0, y: 0 })}
        options={((): ContextMenuOption[] => {
          const app = taskbarContextMenu.app;
          if (app) {
            const win = windows.find((w) => w.id === app.id);
            return [
              {
                label: 'Abrir',
                icon: app.icon,
                onClick: () => handleAppClick(app),
              },
              {
                label: app.isPinned ? 'Desanclar de la barra' : 'Anclar a la barra',
                icon: <Pin24Regular />,
                onClick: () => togglePin(app.id, !!app.isPinned),
              },
              {
                label: 'Cerrar ventana',
                icon: <Dismiss24Regular />,
                disabled: !win,
                onClick: () => win && closeWindow(win.id),
                divider: true,
              },
            ];
          }
          return [
            {
              label: 'Mostrar escritorio',
              icon: <Desktop24Regular />,
              onClick: () => toggleShowDesktop(),
            },
            {
              label: 'Vista de tareas',
              icon: <SquareMultiple24Regular />,
              onClick: () => setIsTaskViewOpen(true),
            },
            {
              label: 'Administrador de tareas',
              icon: <Apps24Regular />,
              onClick: () =>
                openWindow('taskmanager', 'taskmanager', 'Administrador de tareas', <Apps24Regular />),
              divider: true,
            },
          ];
        })()}
      />
    )}

    <style>{`
        .taskbar-trigger-area {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 12px;
          z-index: 10000;
        }

        .taskbar-trigger-area.expanded {
          height: calc(var(--taskbar-height) + 20px);
        }

        .taskbar-container {
          position: fixed;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%) translateY(calc(100% + 24px));
          width: calc(100% - 16px);
          max-width: 1600px;
          height: var(--taskbar-height);
          background: rgba(20, 20, 20, 0.45);
          backdrop-filter: blur(60px) saturate(200%);
          -webkit-backdrop-filter: blur(60px) saturate(200%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-radius: var(--win-radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: var(--shadow-lg);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s;
          pointer-events: auto;
        }

        .taskbar-container.visible {
          transform: translateX(-50%) translateY(0);
        }

        /* Mobile taskbar - larger height for touch */
        @media (max-width: 639px) {
          .taskbar-container {
            bottom: 4px;
            width: calc(100% - 8px);
            height: 56px;
            border-radius: 8px;
            padding: 0 10px;
            max-width: 100%;
          }
        }

        /* Tablet taskbar */
        @media (min-width: 640px) and (max-width: 1023px) {
          .taskbar-container {
            height: 48px;
            max-width: 95%;
            width: calc(95% - 16px);
          }
        }

        /* Small height screens */
        @media (max-height: 600px) {
          .taskbar-container {
            height: 40px;
          }
        }

        .taskbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .taskbar-left .taskbar-icon {
          width: 44px;
          height: 44px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          background: transparent;
          border: none;
          color: white;
          font-size: 22px;
        }

        .taskbar-left .taskbar-icon:hover {
          background: rgba(255,255,255,0.1);
        }

        .taskbar-left .taskbar-icon.active {
          background: rgba(255,255,255,0.15);
        }

        @media (max-width: 639px) {
          .taskbar-left .taskbar-icon {
            width: 40px;
            height: 40px;
            font-size: 20px;
          }
        }

        .taskbar-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        @media (max-width: 639px) {
          .taskbar-center {
            gap: 2px;
          }
        }

        .taskbar-search-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.05);
          height: 34px;
          padding: 0 20px 0 12px;
          border-radius: 17px;
          cursor: pointer;
          transition: all 0.2s;
          margin: 0 4px;
          white-space: nowrap;
          max-width: 300px;
        }

        .taskbar-search-pill:hover {
          background: rgba(255,255,255,0.12);
        }

        .taskbar-search-pill span {
          font-size: 13px;
          color: rgba(255,255,255,0.9);
          white-space: nowrap;
        }

        .search-pill-icon {
          color: var(--win-accent);
          font-size: 18px;
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .taskbar-search-pill {
            display: none;
          }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .taskbar-search-pill {
            max-width: 200px;
            padding: 0 16px 0 10px;
            height: 32px;
          }

          .taskbar-search-pill span {
            font-size: 12px;
          }
        }

        .taskbar-apps {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          max-width: calc(100vw - 280px);
          overflow-x: auto;
          overflow-y: hidden;
          padding-right: 8px;
          scroll-behavior: smooth;
        }

        @media (max-width: 639px) {
          .taskbar-apps {
            max-width: calc(100vw - 140px);
            gap: 4px;
          }
        }

        .taskbar-app-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-origin: bottom center;
        }

        .taskbar-app-icon:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-6px) scale(1.15);
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }

        .taskbar-app-icon:active {
          transform: translateY(-2px) scale(1.05);
        }

        .taskbar-app-icon.open {
          background: rgba(255,255,255,0.12);
        }

        .taskbar-app-icon.focused {
          background: rgba(255,255,255,0.15);
        }

        .app-icon-inner {
          font-size: 26px;
          transition: transform 0.2s;
          color: white;
        }

        .taskbar-app-icon:active .app-icon-inner {
          transform: scale(0.85);
        }

        .app-indicator {
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 3px;
          background: var(--win-accent);
          border-radius: 2px;
          transition: width 0.2s;
        }

        .taskbar-app-icon.focused .app-indicator {
          width: 12px;
        }

        @media (max-width: 639px) {
          .taskbar-app-icon {
            width: 40px;
            height: 40px;
          }

          .app-icon-inner {
            font-size: 22px;
          }
        }

        .taskbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .system-tray {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          color: rgba(255,255,255,0.8);
          font-size: 18px;
        }

        .system-tray:hover {
          background: rgba(255,255,255,0.1);
        }

        @media (max-width: 639px) {
          .system-tray {
            gap: 2px;
            padding: 4px 6px;
            font-size: 16px;
          }
        }

        .taskbar-clock {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .taskbar-clock:hover {
          background: rgba(255,255,255,0.1);
        }

        .taskbar-clock .time {
          font-size: 12px;
          color: rgba(255,255,255,0.9);
        }

        .taskbar-clock .date {
          font-size: 11px;
          opacity: 0.8;
          color: rgba(255,255,255,0.7);
        }

        @media (max-width: 639px) {
          .taskbar-clock .date {
            display: none;
          }

          .taskbar-clock .time {
            font-size: 11px;
          }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .taskbar-clock .time {
            font-size: 11px;
          }

          .taskbar-clock .date {
            font-size: 10px;
          }
        }

        .notifications-badge-container {
          position: relative;
          margin-left: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .notifications-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--win-accent);
          color: black;
          font-size: 10px;
          font-weight: bold;
          min-width: 14px;
          height: 14px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .show-desktop {
          width: 5px;
          height: 32px;
          border-left: 1px solid rgba(255,255,255,0.1);
          margin-left: 4px;
        }

        @media (max-width: 639px) {
          .show-desktop {
            display: none;
          }
        }

        /* Touch device optimizations */
        @media (hover: none) and (pointer: coarse) {
          .taskbar-container {
            height: 56px;
          }

          .taskbar-app-icon,
          .taskbar-left .taskbar-icon {
            width: 44px;
            height: 44px;
            min-height: 44px;
            min-width: 44px;
          }
        }

        /* Global Miniplayer */
        .global-miniplayer {
          position: fixed;
          bottom: 100px;
          right: 30px;
          width: 360px;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(40px);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 10001;
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .global-miniplayer-cover {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          object-fit: cover;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .global-miniplayer-info {
          flex: 1;
          min-width: 0;
        }

        .global-miniplayer-title {
          font-size: 15px;
          font-weight: 600;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0 0 4px;
        }

        .global-miniplayer-artist {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }

        .global-miniplayer-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .global-miniplayer-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .global-miniplayer-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .global-miniplayer-play-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: white;
          color: black;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .global-miniplayer-play-btn:hover {
          transform: scale(1.1);
        }

        .global-miniplayer-close {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 24px;
          cursor: pointer;
          padding: 4px;
        }

        .global-miniplayer-close:hover {
          color: white;
        }

        @media (max-width: 639px) {
          .global-miniplayer {
            width: calc(100% - 32px);
            right: 16px;
            bottom: 120px;
          }
        }
      `}</style>
    </>
  );
};

export default Taskbar;
