import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search24Regular, 
  Globe24Regular, 
  Calendar24Regular, 
  Settings24Regular, 
  Document24Regular, 
  Speaker224Regular, 
  Power24Regular, 
  ArrowClockwise24Regular,
  Edit24Regular,
  Apps24Regular,
  Folder24Regular,
  Calculator24Regular,
  ShieldCheckmark24Regular,
  Code24Regular,
  Book24Regular,
} from '@fluentui/react-icons';
import { getCommunityLauncherItems, subscribeRegistry } from '@nex-os/sdk';
import { useWindowManager } from '../context/WindowManager';
import { useSettings } from '../context/SettingsContext';
import { formatRecentWhen, recentAppsWithIcons } from '../utils/recentApps';


interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onShutdown: () => void;
  onRestart: () => void;
}

interface App {
  id: string;
  appId: string;
  icon: React.ReactNode;
  name: string;
  color: string;
}

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onShutdown, onRestart }) => {
  const { openWindow } = useWindowManager();
  const { userName, lockSystem } = useSettings();
  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [registryTick, setRegistryTick] = useState(0);
  const [recentsTick, setRecentsTick] = useState(0);
  useEffect(() => subscribeRegistry(() => setRegistryTick((n) => n + 1)), []);
  useEffect(() => {
    const onRecents = () => setRecentsTick((n) => n + 1);
    window.addEventListener('nex-recents-changed', onRecents);
    return () => window.removeEventListener('nex-recents-changed', onRecents);
  }, []);

  const pinnedApps: App[] = useMemo(() => {
    const builtins: App[] = [
      { id: 'browser', appId: 'browser', icon: <Globe24Regular />, name: 'Edge', color: '#0078d4' },
      { id: 'files', appId: 'file-explorer', icon: <Folder24Regular />, name: 'Explorador', color: '#f1c40f' },
      { id: 'nex-store', appId: 'nex-store', icon: <span style={{ fontSize: 20 }}>🛒</span>, name: 'NEX Store', color: '#3dd6c6' },
      { id: 'notepad', appId: 'notepad', icon: <Document24Regular />, name: 'Bloc de notas', color: '#4CAF50' },
      { id: 'calculator', appId: 'calculator', icon: <Calculator24Regular />, name: 'Calculadora', color: '#D32F2F' },
      { id: 'cmd', appId: 'cmd', icon: <span style={{ fontFamily: 'Consolas, monospace', fontSize: 18 }}>C:\\</span>, name: 'Terminal', color: '#64b5f6' },
      { id: 'paint', appId: 'paint', icon: <Edit24Regular />, name: 'Paint', color: '#FF6E40' },
      { id: 'wordpad', appId: 'wordpad', icon: <Document24Regular />, name: 'WordPad', color: '#4CAF50' },
      { id: 'task-manager', appId: 'taskmanager', icon: <Apps24Regular />, name: 'Admin. tareas', color: '#2196F3' },
      { id: 'control-panel', appId: 'control-panel', icon: <Settings24Regular />, name: 'Configuración', color: '#757575' },
      { id: 'calendar', appId: 'calendar', icon: <Calendar24Regular />, name: 'Calendario', color: '#E91E63' },
      { id: 'search', appId: 'search', icon: <Search24Regular />, name: 'Buscar', color: '#FF9800' },
      { id: 'defender', appId: 'defender', icon: <ShieldCheckmark24Regular />, name: 'Seguridad', color: '#008a17' },
      { id: 'devcpp-2026', appId: 'devcpp-2026', icon: <Code24Regular primaryFill="#3b82f6" />, name: 'Dev-C++ 2026', color: '#3b82f6' },
      { id: 'manual', appId: 'manual', icon: <Book24Regular />, name: 'Manual', color: '#3b82f6' },
      { id: 'clock', appId: 'clock', icon: <span style={{ fontSize: 20 }}>🕐</span>, name: 'Reloj', color: '#60cdff' },
      { id: 'photos', appId: 'photos', icon: <span style={{ fontSize: 20 }}>📷</span>, name: 'Fotos', color: '#ff6b6b' },
      { id: 'nexreproductor', appId: 'nexreproductor', icon: <span style={{ fontSize: 20 }}>🎵</span>, name: 'NexReproductor', color: '#1db954' },
      { id: 'virtual-dj', appId: 'virtual-dj', icon: <span style={{ fontSize: 20 }}>🎧</span>, name: 'NEX DJ', color: '#ff6b4a' },
      { id: 'tetris', appId: 'tetris', icon: <span style={{ fontSize: 20 }}>🧱</span>, name: 'Tetris', color: '#22d3ee' },
      { id: 'games', appId: 'games', icon: <span style={{ fontSize: 20 }}>🎮</span>, name: 'Games', color: '#22d3ee' },
    ];
    const builtinIds = new Set(builtins.map((a) => a.id));
    const community = getCommunityLauncherItems()
      .filter((item) => !builtinIds.has(item.id))
      .map((item) => ({
        id: item.id,
        appId: item.appId,
        icon: item.icon,
        name: item.label,
        color: '#1d9bf0',
      }));
    return [...builtins, ...community];
  }, [registryTick]);

  const recentApps = useMemo(() => recentAppsWithIcons(), [recentsTick, isOpen, registryTick]);

  const filteredApps = pinnedApps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAppClick = (app: App) => {
    openWindow(app.id, app.appId, app.name, app.icon);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="start-menu mica premium-shadow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="start-menu-inner">
            <div className="search-container">
              <div className="search-box">
                <Search24Regular className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar aplicaciones, configuraciones y documentos" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="scroll-content">
              <div className="section">
                <div className="section-header">
                  <h3>Anclado</h3>
                  <button className="section-action">Todas las aplicaciones &gt;</button>
                </div>
                <div className="apps-grid">
                  {filteredApps.map((app, index) => (
                    <button key={index} className="app-btn" onClick={() => handleAppClick(app)}>
                      <div className="app-icon-wrapper" style={{ color: app.color }}>
                        {app.icon}
                      </div>
                      <span className="app-label">{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="section">
                <div className="section-header">
                  <h3>Recientes</h3>
                  <button
                    className="section-action"
                    onClick={() => {
                      openWindow('nex-store', 'nex-store', 'NEX Store', <span>🛒</span>);
                      onClose();
                    }}
                  >
                    NEX Store &gt;
                  </button>
                </div>
                <div className="recommended-grid">
                  {recentApps.length === 0 && (
                    <div className="rec-item" style={{ opacity: 0.55, cursor: 'default' }}>
                      <div className="rec-icon"><Apps24Regular /></div>
                      <div className="rec-text">
                        <span className="rec-name">Todavía no hay recientes</span>
                        <span className="rec-sub">Abrí una app y aparece acá</span>
                      </div>
                    </div>
                  )}
                  {recentApps.map((item) => (
                    <button
                      key={`${item.id}-${item.openedAt}`}
                      className="rec-item"
                      onClick={() => {
                        openWindow(item.id, item.appId, item.title, item.icon);
                        onClose();
                      }}
                    >
                      <div className="rec-icon">{item.icon}</div>
                      <div className="rec-text">
                        <span className="rec-name">{item.title}</span>
                        <span className="rec-sub">{formatRecentWhen(item.openedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="start-footer">
              <div className="user-area">
                <div className="user-avatar" style={{ background: 'var(--win-accent)', color: 'black', fontWeight: 'bold' }}>
                   {userName.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{userName}</span>
              </div>

              <div className="power-container">
                <button
                  className="power-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPowerMenu((prev) => !prev);
                  }}
                  title="Opciones de energía"
                >
                  <Power24Regular />
                </button>

                {showPowerMenu && (
                  <div
                    className="power-options"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="power-option"
                      onClick={() => {
                        lockSystem();
                        setShowPowerMenu(false);
                        onClose();
                      }}
                    >
                      <span style={{ marginRight: 8 }}>🔒</span>
                      Bloquear
                    </button>
                    <button
                      className="power-option"
                      onClick={() => {
                        // Sleep no implementado en la demo
                        setShowPowerMenu(false);
                        onClose();
                      }}
                    >
                      <span style={{ marginRight: 8 }}>🌙</span>
                      Suspender
                    </button>
                    <button
                      className="power-option"
                      onClick={() => {
                        onRestart();
                        setShowPowerMenu(false);
                        onClose();
                      }}
                    >
                      <ArrowClockwise24Regular style={{ marginRight: 8 }} />
                      Reiniciar
                    </button>
                    <button
                      className="power-option"
                      onClick={() => {
                        onShutdown();
                        setShowPowerMenu(false);
                        onClose();
                      }}
                    >
                      <Power24Regular style={{ marginRight: 8 }} />
                      Apagar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <style>{`
            .start-menu {
              position: fixed;
              bottom: calc(var(--taskbar-height) + 16px);
              left: 50%;
              transform: translateX(-50%);
              width: 680px;
              max-width: 95vw;
              height: 540px;
              max-height: 80vh;
              border-radius: var(--win-radius-lg);
              z-index: 1001;
              display: flex;
              flex-direction: column;
              background: rgba(20, 20, 20, 0.45);
              backdrop-filter: blur(60px) saturate(200%);
              -webkit-backdrop-filter: blur(60px) saturate(200%);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-top: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05);
            }

            /* Mobile Start Menu */
            @media (max-width: 639px) {
              .start-menu {
                width: 95vw;
                height: 85vh;
                max-height: 85vh;
                bottom: calc(var(--taskbar-height) + 10px);
                border-radius: var(--win-radius-lg);
              }
            }

            /* Tablet Start Menu */
            @media (min-width: 640px) and (max-width: 1023px) {
              .start-menu {
                width: 90vw;
                height: 80vh;
                max-height: 80vh;
                max-width: 700px;
              }
            }

            /* Small height screens */
            @media (max-height: 600px) {
              .start-menu {
                max-height: 95vh;
                height: 95vh;
              }
            }

            .start-menu-inner {
              height: 100%;
              display: flex;
              flex-direction: column;
              padding: 32px 0 0 0;
              position: relative;
            }

            @media (max-width: 639px) {
              .start-menu-inner {
                padding: 20px 0 0 0;
              }
            }

            .search-container {
              padding: 0 32px 32px 32px;
            }

            @media (max-width: 639px) {
              .search-container {
                padding: 0 16px 20px 16px;
              }
            }

            .search-box {
              background: rgba(0, 0, 0, 0.2);
              border-bottom: 2px solid var(--win-blue);
              border-radius: 4px;
              padding: 8px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
            }

            @media (max-width: 639px) {
              .search-box {
                padding: 10px 12px;
                gap: 8px;
              }
            }

            .search-box input {
              background: transparent;
              border: none;
              color: white;
              flex: 1;
              outline: none;
              font-size: 14px;
            }

            @media (max-width: 639px) {
              .search-box input {
                font-size: 13px;
              }
            }

            @media (max-width: 639px) {
              .search-box input::placeholder {
                font-size: 12px;
              }
            }

            .scroll-content {
              flex: 1;
              overflow-y: auto;
              padding: 0 32px;
            }

            @media (max-width: 639px) {
              .scroll-content {
                padding: 0 16px;
              }
            }

            .section {
              margin-bottom: 32px;
            }

            @media (max-width: 639px) {
              .section {
                margin-bottom: 20px;
              }
            }

            .section-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
            }

            @media (max-width: 639px) {
              .section-header {
                margin-bottom: 12px;
              }
            }

            .section-header h3 {
              font-size: 13px;
              font-weight: 600;
              margin: 0;
            }

            @media (max-width: 639px) {
              .section-header h3 {
                font-size: 12px;
              }
            }

            .section-action {
              background: rgba(255, 255, 255, 0.08);
              border: none;
              color: white;
              font-size: 12px;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              white-space: nowrap;
            }

            @media (max-width: 639px) {
              .section-action {
                font-size: 11px;
                padding: 3px 6px;
              }
            }

            .apps-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 8px;
            }

            /* Responsive grid columns */
            @media (min-width: 1440px) {
              .apps-grid {
                grid-template-columns: repeat(7, 1fr);
                gap: 10px;
              }
            }

            @media (min-width: 1024px) and (max-width: 1439px) {
              .apps-grid {
                grid-template-columns: repeat(5, 1fr);
                gap: 8px;
              }
            }

            @media (min-width: 640px) and (max-width: 1023px) {
              .apps-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
              }
            }

            @media (max-width: 639px) {
              .apps-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
              }
            }

            @media (max-width: 450px) {
              .apps-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 4px;
              }
            }

            .app-btn {
              background: transparent;
              border: none;
              color: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
              padding: 12px 4px;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.2s;
            }

            .app-btn:hover {
              background: var(--hover-bg);
            }

            @media (max-width: 639px) {
              .app-btn {
                gap: 6px;
                padding: 8px 2px;
              }
            }

            .app-icon-wrapper {
              font-size: 24px;
            }

            @media (max-width: 639px) {
              .app-icon-wrapper {
                font-size: 20px;
              }
            }

            .app-label {
              font-size: 12px;
              text-align: center;
              line-height: 1.2;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }

            @media (max-width: 639px) {
              .app-label {
                font-size: 10px;
                -webkit-line-clamp: 1;
              }
            }

            .recommended-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }

            @media (max-width: 639px) {
              .recommended-grid {
                grid-template-columns: 1fr;
                gap: 8px;
              }
            }

            .rec-item {
              background: transparent;
              border: none;
              color: white;
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 8px 12px;
              border-radius: 4px;
              cursor: pointer;
              text-align: left;
              transition: background 0.2s;
            }

            .rec-item:hover {
              background: var(--hover-bg);
            }

            @media (max-width: 639px) {
              .rec-item {
                gap: 8px;
                padding: 8px 10px;
              }
            }

            .rec-icon {
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 4px;
              flex-shrink: 0;
            }

            @media (max-width: 639px) {
              .rec-icon {
                width: 28px;
                height: 28px;
                font-size: 16px;
              }
            }

            .rec-text {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;
            }

            .rec-name {
              font-size: 12px;
              font-weight: 500;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            @media (max-width: 639px) {
              .rec-name {
                font-size: 11px;
              }
            }

            .rec-sub {
              font-size: 11px;
              opacity: 0.6;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            @media (max-width: 639px) {
              .rec-sub {
                font-size: 10px;
              }
            }

            .start-footer {
              background: rgba(0, 0, 0, 0.2);
              padding: 16px 48px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 12px;
              flex-shrink: 0;
            }

            @media (max-width: 639px) {
              .start-footer {
                padding: 12px 16px;
                margin-top: 8px;
              }
            }

            .user-area {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 4px 12px;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.2s;
            }

            .user-area:hover {
              background: var(--hover-bg);
            }

            @media (max-width: 639px) {
              .user-area {
                gap: 8px;
                padding: 4px 8px;
              }
            }

            .user-avatar {
              width: 32px;
              height: 32px;
              background: var(--win-blue);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              flex-shrink: 0;
            }

            @media (max-width: 639px) {
              .user-avatar {
                width: 28px;
                height: 28px;
                font-size: 12px;
              }
            }

            .user-name {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            @media (max-width: 639px) {
              .user-name {
                font-size: 12px;
              }
            }

            .power-container {
              position: relative;
            }

            .power-options {
              position: absolute;
              right: 0;
              bottom: 48px;
              background: rgba(24, 24, 24, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(14px);
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
              display: flex;
              flex-direction: column;
              z-index: 1002;
            }

            @media (max-width: 639px) {
              .power-options {
                bottom: 44px;
                width: 140px;
              }
            }

            .power-option {
              background: transparent;
              border: none;
              color: white;
              padding: 8px 16px;
              text-align: left;
              cursor: pointer;
              width: 170px;
              transition: background 0.2s;
              white-space: nowrap;
              font-size: 13px;
            }

            .power-option:hover {
              background: rgba(255, 255, 255, 0.1);
            }

            @media (max-width: 639px) {
              .power-option {
                width: 100%;
                padding: 10px 12px;
                font-size: 12px;
              }
            }

            .power-btn {
              background: transparent;
              border: none;
              color: white;
              padding: 8px;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 32px;
              min-height: 32px;
            }

            .power-btn:hover {
              background: var(--hover-bg);
            }

            @media (max-width: 639px) {
              .power-btn {
                min-width: 28px;
                min-height: 28px;
                padding: 6px;
              }
            }

            @media (hover: none) and (pointer: coarse) {
              .app-btn,
              .rec-item,
              .power-btn {
                min-height: 44px;
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartMenu;
