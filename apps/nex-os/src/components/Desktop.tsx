import React, { Suspense, lazy, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveRegisteredApp } from '@nex-os/sdk';
import { useSettings } from '../context/SettingsContext';
import Taskbar from './Taskbar';
import StartMenu from './StartMenu';
import NotificationsMenu from './NotificationsMenu';
import CalendarMenu from './CalendarMenu';
import SearchPane from './SearchPane';
import WidgetsPanel from './system/WidgetsPanel';
import NexAssistantPanel from './system/NexAssistantPanel';
import TaskView from './system/TaskView';
import AltTabSwitcher from './system/AltTabSwitcher';
import Window from './Window';
import ContextMenu from './ContextMenu';
import { useWindowManager } from '../context/WindowManager';
import { useDesktop, type DesktopIcon } from '../context/DesktopContext';
import { useFileSystem } from '../context/FileSystemContext';
import { useUI } from '../context/UIContext';
import { useNexRuntime } from '../context/NexRuntimeContext';
import { 
  Document24Regular, 
  Delete24Regular,
  ArrowClockwise24Regular, 
  TextBulletList24Regular,
  Grid24Regular,
  Desktop24Regular,
  DrawText24Regular,
  ClipboardPaste24Regular,
  Folder24Regular,
  ArrowSort24Regular,
  Apps24Regular,
  ImageMultiple24Regular,
  ImageArrowBack24Regular,
  Settings24Regular,
  Calculator24Regular,
  Cut24Regular,
  Copy24Regular,
  Rename24Regular,
  Delete20Regular,
  ShieldCheckmark24Regular,
  Globe24Regular,
} from '@fluentui/react-icons';
import { Code24Regular, Person24Regular } from '@fluentui/react-icons';
import { useIsPhone } from '../hooks/useMobileAppShell';

const MobileShell = lazy(() => import('./mobile/MobileShell'));

const NEX_ICONS: Record<string, React.ReactNode> = {
  notepad:       <Document24Regular />,
  cmd:           <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
  terminal:      <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 16 }}>C:\</span>,
  chrome:        <Globe24Regular />,
  'file-explorer': <Folder24Regular />,
  paint:         <span style={{ fontSize: 18 }}>🎨</span>,
  calculator:    <Calculator24Regular />,
  taskmanager:   <Apps24Regular />,
  NexReproductor:       <span style={{ fontSize: 18 }}>🎵</span>,
  settings:      <Settings24Regular />,
  wordpad:       <Document24Regular />,
  defender:      <ShieldCheckmark24Regular />,
  mediaplayer:   <span style={{ fontSize: 18 }}>▶️</span>,
  'devcpp-2026': <Code24Regular style={{ color: '#3b82f6' }} />,
};



interface DesktopProps {
  onShutdown: () => void;
  onRestart: () => void;
}

const Desktop: React.FC<DesktopProps> = ({ onShutdown, onRestart }) => {
  const { windows, openWindow, closeFocusedWindow, minimizeAllWindows } = useWindowManager();
  const { desktopIcons, addDesktopIcon, updateDesktopIcon, removeDesktopIcon, sortDesktopIcons, currentDesktopId, virtualDesktops, switchDesktop, addDesktop } = useDesktop();
  const { isStartOpen, toggleStart, closeStart, isWidgetsOpen, toggleWidgets, closeWidgets, isDesktopSwitcherOpen, isAssistantOpen, toggleAssistant, closeAssistant } = useUI();
  const { createFile, clipboard, pasteItem, files, copyItem, cutItem } = useFileSystem();
  const { resolveNex } = useNexRuntime();

  const { isTaskViewOpen, setIsTaskViewOpen, addNotification, userName, wallpaper, neonTheme } = useSettings();
  const isPhone = useIsPhone();

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [draggingIconId, setDraggingIconId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ mouseX: number, mouseY: number, iconX: number, iconY: number } | null>(null);
  const [iconSize, setIconSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [iconContextTarget, setIconContextTarget] = useState<string | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runCommand, setRunCommand] = useState('');
  const [runError, setRunError] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIconContextTarget(null);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const executeRunCommand = (command: string) => {
    const normalized = command.trim().toLowerCase();
    if (!normalized) {
      setRunError('El comando no puede estar vacío');
      return;
    }

    setRunError('');

    // Community apps (@nex-os/sdk) — appId, alias o título
    const community = resolveRegisteredApp(normalized);
    if (community) {
      openWindow(
        community.id,
        community.appId,
        community.title,
        community.icon,
        community.defaultProps as Record<string, unknown> | undefined,
      );
      setRunDialogOpen(false);
      setRunCommand('');
      return;
    }

    // Check .nex execution via runtime registry
    const nexApp = resolveNex(normalized);
    if (nexApp) {
      const appIcon = NEX_ICONS[nexApp.appId] || <span style={{ fontSize: 18 }}>⚡</span>;
      openWindow(nexApp.appId, nexApp.appId, nexApp.title, appIcon);
      setRunDialogOpen(false);
      setRunCommand('');
      return;
    }

    if (normalized === 'cmd' || normalized === 'cmd.exe' || normalized === 'terminal') {
      openWindow('cmd', 'cmd', 'Terminal', <span style={{ fontFamily: 'Consolas, monospace', fontSize: 18 }}>C:\\</span>);
    } else if (normalized === 'explorer' || normalized === 'file explorer' || normalized === 'files') {
      openWindow('file-explorer', 'file-explorer', 'Explorador de archivos', <Folder24Regular />);
    } else if (normalized === 'notepad') {
      openWindow('notepad', 'notepad', 'Notepad', <Document24Regular />);
    } else if (normalized === 'taskmgr' || normalized === 'task manager') {
      openWindow('taskmanager', 'taskmanager', 'Administrador de tareas', <Apps24Regular />);
    } else if (normalized === 'calc' || normalized === 'calculator') {
      openWindow('calculator', 'calculator', 'Calculadora', <Calculator24Regular />);
    } else if (normalized === 'tetris') {
      openWindow('tetris', 'tetris', 'Tetris', <span style={{ fontSize: 18 }}>🧱</span>);
    } else if (normalized === 'games') {
      openWindow('games', 'games', 'Games', <span style={{ fontSize: 18 }}>🎮</span>);
    } else if (normalized === 'defender' || normalized === 'ms-settings:windowsdefender') {
      openWindow('defender', 'defender', 'Seguridad de Windows', <ShieldCheckmark24Regular />);
    } else if (normalized === 'devcpp' || normalized === 'dev-cpp') {
      openWindow('devcpp-2026', 'devcpp-2026', 'Dev-C++ 2026', <Code24Regular primaryFill="#3b82f6" />);
    } else if (normalized === 'shutdown') {
      onShutdown();
    } else {
      setRunError(`'${command}' no se reconoce como un comando interno o externo.`);
      return;
    }

    setRunDialogOpen(false);
    setRunCommand('');
  };


  const handleNewFile = () => {
    const fileId = createFile('desktop', 'Nuevo archivo.txt', 'txt');
    addDesktopIcon({
      id: fileId,
      title: 'Nuevo archivo.txt',
      icon: <Document24Regular primaryFill="#ecf0f1" />,
      type: 'file',
      x: contextMenu?.x || 100,
      y: contextMenu?.y || 100,
      appId: 'notepad',
      appProps: { fileId }
    });
  };

  const handleNewFolder = () => {
    addDesktopIcon({
      title: 'Nueva carpeta',
      icon: <Folder24Regular primaryFill="#f1c40f" />,
      type: 'folder',
      x: contextMenu?.x || 100,
      y: contextMenu?.y || 100,
    });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    const mode = clipboard.type;
    const sourceId = clipboard.id;
    const source = files.find((f) => f.id === sourceId);
    const pastedId = pasteItem('desktop');
    if (!pastedId || !source) return;
    if (mode === 'cut') {
      removeDesktopIcon(sourceId);
    }
    const title = mode === 'copy' ? `${source.name} - Copia` : source.name;
    addDesktopIcon({
      id: pastedId,
      title,
      icon:
        source.type === 'folder' ? (
          <Folder24Regular primaryFill="#f1c40f" />
        ) : (
          <Document24Regular primaryFill="#ecf0f1" />
        ),
      type: source.type === 'folder' ? 'folder' : 'file',
      x: contextMenu?.x || 120,
      y: contextMenu?.y || 120,
      appId: source.ext === 'txt' ? 'notepad' : undefined,
      appProps: source.ext === 'txt' ? { fileId: pastedId } : undefined,
    });
    setContextMenu(null);
  };

  const handleIconSizeChange = (size: 'small' | 'medium' | 'large') => {
    setIconSize(size);
    setContextMenu(null);
  };

  const handleSortIcons = (by: 'name' | 'type' | 'position') => {
    sortDesktopIcons(by);
    setContextMenu(null);
  };

  const handleDeleteIcon = (id: string) => {
    removeDesktopIcon(id);
  };

  const onIconDoubleClick = (icon: DesktopIcon) => {
    // Folders without an explicit appId open in the file explorer.
    // Otherwise prefer the icon's own appId, falling back to icon.id.
    const appId =
      icon.appId ||
      (icon.type === 'folder' ? 'file-explorer' : icon.id);
    const appProps =
      icon.appProps ||
      (icon.type === 'folder' ? { initialFolderId: icon.id } : undefined);
    openWindow(icon.id, appId, icon.title, icon.icon, appProps);
  };
  const handleIconMouseDown = (e: React.MouseEvent, icon: DesktopIcon) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setDraggingIconId(icon.id);
    setDragStart({ mouseX: e.clientX, mouseY: e.clientY, iconX: icon.x, iconY: icon.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingIconId || !dragStart) return;
    e.preventDefault();

    const newX = Math.max(10, dragStart.iconX + (e.clientX - dragStart.mouseX));
    const newY = Math.max(10, dragStart.iconY + (e.clientY - dragStart.mouseY));

    updateDesktopIcon(draggingIconId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggingIconId(null);
    setDragStart(null);
  };

  const closeAllMenus = () => {
    closeStart();
    closeWidgets();
    setContextMenu(null);
    setIsNotificationsOpen(false);
    setIsSearchOpen(false);
    setSelectedIconId(null);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atajos Ctrl+Alt+* — Win+* / Alt+Tab los captura Windows antes del browser
      const nexMod = e.ctrlKey && e.altKey && !e.metaKey;

      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'F4') {
        e.preventDefault();
        closeFocusedWindow();
      }
      if (nexMod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        minimizeAllWindows();
      }
      if (nexMod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        openWindow('file-explorer', 'file-explorer', 'Explorador de archivos', <Desktop24Regular />);
      }
      if (nexMod && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRunDialogOpen(true);
        setRunCommand('');
        setRunError('');
      }
      if (nexMod && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsTaskViewOpen(!isTaskViewOpen);
      }
      if (nexMod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleAssistant();
      }
      if (e.key === 'Escape' && isTaskViewOpen) {
        setIsTaskViewOpen(false);
      }
      // [ ] — no usar flechas (Intel Graphics rota la pantalla con Ctrl+Alt+←→)
      if (nexMod && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        const currentIndex = virtualDesktops.findIndex((d) => d.id === currentDesktopId);
        const prevIndex = (currentIndex - 1 + virtualDesktops.length) % virtualDesktops.length;
        switchDesktop(virtualDesktops[prevIndex].id);
      }
      if (nexMod && (e.key === ']' || e.code === 'BracketRight')) {
        e.preventDefault();
        const currentIndex = virtualDesktops.findIndex((d) => d.id === currentDesktopId);
        const nextIndex = (currentIndex + 1) % virtualDesktops.length;
        switchDesktop(virtualDesktops[nextIndex].id);
      }
      if (e.key === 'Escape' && runDialogOpen) {
        setRunDialogOpen(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        if (!runDialogOpen && !isSearchOpen) {
          e.preventDefault();
          handlePaste();
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedIconId) {
        const icon = desktopIcons.find((i) => i.id === selectedIconId);
        if (icon && (icon.type === 'file' || files.some((f) => f.id === icon.id))) {
          e.preventDefault();
          copyItem(icon.id);
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'x' && selectedIconId) {
        const icon = desktopIcons.find((i) => i.id === selectedIconId);
        if (icon && (icon.type === 'file' || files.some((f) => f.id === icon.id))) {
          e.preventDefault();
          cutItem(icon.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeFocusedWindow, minimizeAllWindows, openWindow, runDialogOpen, currentDesktopId, switchDesktop, virtualDesktops, isTaskViewOpen, setIsTaskViewOpen, selectedIconId, desktopIcons, files, copyItem, cutItem, isSearchOpen, clipboard, toggleAssistant]);

  const toggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    if (!isNotificationsOpen) {
      setIsCalendarOpen(false);
      closeStart();
    }
  };

  const toggleCalendar = () => {
    setIsCalendarOpen((prev: boolean) => !prev);
    if (!isCalendarOpen) {
      setIsNotificationsOpen(false);
      closeStart();
    }
  };

  const handleStartToggle = () => {
    toggleStart();
    setIsNotificationsOpen(false);
    closeWidgets();
  };

  if (isPhone) {
    return (
      <Suspense fallback={<div className="w-full h-full bg-black" />}>
        <MobileShell onShutdown={onShutdown} onRestart={onRestart} />
      </Suspense>
    );
  }

  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundImage: `url(${wallpaper || '/wallpaper-premium.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      onContextMenu={handleContextMenu}
      onClick={closeAllMenus}
    >
      <div 
        className="w-full h-full relative" 
        onClick={closeAllMenus}
      >
        <div
          className="desktop-icons"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {desktopIcons.map((icon) => {
            const sizeMap = { small: 60, medium: 80, large: 100 } as const;
            const iconFont = { small: 24, medium: 32, large: 40 } as const;
            return (
            <div
              key={icon.id}
              className={`desktop-icon hover-lift shine-effect ${draggingIconId === icon.id ? 'dragging' : ''} ${selectedIconId === icon.id ? 'selected' : ''}`}
              onDoubleClick={() => onIconDoubleClick(icon)}
              onMouseDown={(e) => {
                setSelectedIconId(icon.id);
                handleIconMouseDown(e, icon);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIconId(icon.id);
                setIconContextTarget(icon.id);
                setContextMenu({ x: e.clientX, y: e.clientY });
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: icon.x,
                top: icon.y,
                width: sizeMap[iconSize],
                cursor: 'grab',
                userSelect: 'none',
              }}
            >
              <div className="icon-wrapper" style={{ fontSize: iconFont[iconSize], marginBottom: 6 }}>
                {icon.icon}
              </div>
              <span className="icon-label">{icon.title}</span>
            </div>
            );
          })}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <AnimatePresence mode="popLayout">
            {windows.filter((win) => win.desktopId === currentDesktopId && win.isOpen).map((win) => <Window key={win.id} window={win} />)}
          </AnimatePresence>
          {isStartOpen && <StartMenu isOpen={isStartOpen} onClose={closeStart} onShutdown={onShutdown} onRestart={onRestart} />}
          {runDialogOpen && (
            <div className="run-overlay" onClick={() => setRunDialogOpen(false)}>
              <div className="run-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="run-title">Ejecutar <span style={{ opacity: 0.45, fontWeight: 400, fontSize: 12 }}>Ctrl+Alt+R</span></div>
                <input
                  className="run-input"
                  value={runCommand}
                  onChange={(e) => setRunCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeRunCommand(runCommand)}
                  placeholder="notepad · hello · explorer"
                  autoFocus
                />
                <div className="run-actions">
                  <button className="run-btn" onClick={() => executeRunCommand(runCommand)}>Ejecutar</button>
                  <button className="run-btn" onClick={() => setRunDialogOpen(false)}>Cancelar</button>
                </div>
                {runError && <div className="run-error">{runError}</div>}
              </div>
            </div>
          )}
          <AnimatePresence>
            {isWidgetsOpen && (
              <WidgetsPanel
                isOpen={isWidgetsOpen}
                onClose={closeWidgets}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isAssistantOpen && (
              <NexAssistantPanel
                isOpen={isAssistantOpen}
                onClose={closeAssistant}
              />
            )}
          </AnimatePresence>
        </div>

        {isDesktopSwitcherOpen && (
          <div className="virtual-desktop-strip">
            {virtualDesktops.map((desk) => (
              <button
                key={desk.id}
                className={`desktop-switch ${currentDesktopId === desk.id ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); switchDesktop(desk.id); }}
              >
                {desk.name}
              </button>
            ))}
            <button className="desktop-add" onClick={(e) => { e.stopPropagation(); addDesktop(); }} title="Agregar escritorio">+</button>
          </div>
        )}

        {/* GitHub Button */}
        <button
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            padding: 12,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            transition: 'all 0.2s ease',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onClick={(e) => {
            e.stopPropagation();
            openWindow('github-chrome', 'chrome', 'Google Chrome', <span style={{ fontSize: 18 }}>🌐</span>, {
              initialUrl: 'https://github.com/shadownrx/windows'
            });
          }}
          title="GitHub Repository (Open in Chrome)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </button>

        <Taskbar 
          onStartClick={handleStartToggle} 
          isStartOpen={isStartOpen} 
          onNotificationsClick={() => toggleNotifications()}
          onClockClick={() => toggleCalendar()}
          isNotificationsOpen={isNotificationsOpen}
          onShutdown={onShutdown}
          onRestart={onRestart}
          onSearchClick={() => setIsSearchOpen(!isSearchOpen)}
        />

        <AnimatePresence>
          {isSearchOpen && (
            <SearchPane isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
          )}
        </AnimatePresence>

        <CalendarMenu isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
        <NotificationsMenu isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
        <AnimatePresence>
           {isTaskViewOpen && <TaskView />}
           <AltTabSwitcher />
        </AnimatePresence>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setIconContextTarget(null);
          }}
          options={iconContextTarget ? [
            {
              label: 'Abrir',
              icon: <Folder24Regular />,
              onClick: () => {
                const icon = desktopIcons.find((i) => i.id === iconContextTarget);
                if (icon) onIconDoubleClick(icon);
                setContextMenu(null);
                setIconContextTarget(null);
              }
            },
            { label: 'Propiedades', icon: <Grid24Regular />, onClick: () => { setContextMenu(null); setIconContextTarget(null); }, disabled: true }
          ] : [
            {
              label: 'Widgets',
              icon: <Grid24Regular />,
              onClick: () => { toggleWidgets(); setContextMenu(null); },
            },
            {
              label: 'Ver',
              icon: <Grid24Regular />,
              onClick: () => {},
              submenu: [
                { label: 'Iconos grandes', icon: <Apps24Regular />, onClick: () => handleIconSizeChange('large') },
                { label: 'Iconos medianos', icon: <Grid24Regular />, onClick: () => handleIconSizeChange('medium') },
                { label: 'Iconos pequeños', icon: <ImageMultiple24Regular />, onClick: () => handleIconSizeChange('small') },
              ]
            },
            {
              label: 'Ordenar por',
              icon: <ArrowSort24Regular />,
              onClick: () => {},
              divider: true,
              submenu: [
                { label: 'Nombre', icon: <TextBulletList24Regular />, onClick: () => handleSortIcons('name') },
                { label: 'Tipo de elemento', icon: <TextBulletList24Regular />, onClick: () => handleSortIcons('type') },
                { label: 'Posición', icon: <TextBulletList24Regular />, onClick: () => handleSortIcons('position') },
              ]
            },
            { label: 'Actualizar', icon: <ArrowClockwise24Regular />, onClick: () => window.location.reload(), divider: true },
            { label: 'Pegar', icon: <ClipboardPaste24Regular />, onClick: handlePaste, shortcut: 'Ctrl+V', disabled: !clipboard },
            { label: 'Pegar acceso directo', icon: <ImageArrowBack24Regular />, onClick: handlePaste, disabled: !clipboard, divider: true },
            {
              label: 'Nuevo',
              icon: <Document24Regular />,
              onClick: () => {},
              divider: true,
              submenu: [
                { label: 'Carpeta', icon: <Folder24Regular />, onClick: handleNewFolder, shortcut: 'Ctrl+Shift+N' },
                { label: 'Archivo de texto', icon: <DrawText24Regular />, onClick: handleNewFile },
              ]
            },
            { label: 'Configuración de pantalla', icon: <Desktop24Regular />, onClick: () => openWindow('control-panel', 'control-panel', 'Configuración', <Settings24Regular />) },
            { label: 'Personalizar', icon: <Apps24Regular />, onClick: () => openWindow('control-panel', 'control-panel', 'Configuración', <Settings24Regular />) },
            { label: 'Abrir en Terminal', icon: <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>&gt;_</span>, onClick: () => openWindow('cmd', 'cmd', 'Terminal', <span style={{ fontFamily: 'Consolas, monospace', fontSize: 18 }}>C:\\</span>) },
          ]}
        />
      )}

      <style>{`
  .desktop-icons {
    position: relative;
    width: 100%;
    height: calc(100% - var(--taskbar-height));
    overflow: auto;
    padding: 10px;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 10px;
  }

  /* Desktop mode - absolute positioning */
  @media (min-width: 1024px) {
    .desktop-icons {
      display: block;
      overflow: hidden;
    }

    .desktop-icon {
      position: absolute !important;
    }
  }

  .desktop-icon {
    width: 90px;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 5px;
    border-radius: 6px;
    cursor: grab;
    transition: background 0.2s, transform 0.1s;
    color: white;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    flex-shrink: 0;
  }

  /* Responsive icon sizes */
  @media (max-width: 639px) {
    .desktop-icon {
      width: 60px;
      padding: 8px 4px;
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .desktop-icon {
      width: 75px;
      padding: 9px 4px;
    }
  }

  .desktop-icon.dragging {
    cursor: grabbing;
    transform: scale(1.05);
    z-index: 20;
    background: rgba(255, 255, 255, 0.15);
  }

  .desktop-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
  }

  .desktop-icon.selected {
    background: rgba(255, 255, 255, 0.15);
    border: 1px dotted rgba(255, 255, 255, 0.2);
  }

  .icon-wrapper {
    font-size: 32px;
    margin-bottom: 6px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  @media (max-width: 639px) {
    .icon-wrapper {
      font-size: 24px;
      margin-bottom: 4px;
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .icon-wrapper {
      font-size: 28px;
      margin-bottom: 5px;
    }
  }

  .icon-label {
    font-size: 11px;
    text-align: center;
    line-height: 1.3;
    max-width: 100%;
    word-break: normal;
    overflow-wrap: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    padding: 2px 4px;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  @media (max-width: 639px) {
    .icon-label {
      font-size: 9px;
      -webkit-line-clamp: 1;
    }
  }

  /* --- PANELES Y WIDGETS (RESPONSIVE) --- */
  .widgets-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 400px;
    height: 100vh;
    background: rgba(24, 24, 24, 0.6);
    backdrop-filter: blur(60px) saturate(200%);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding: 40px 24px;
    z-index: 1500;
    box-shadow: 20px 0 50px rgba(0,0,0,0.3);
    color: white;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
  }

  @media (max-width: 639px) {
    .widgets-panel {
      width: 100%;
      height: 100%;
      padding: 20px 16px;
      gap: 16px;
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .widgets-panel {
      width: 350px;
      padding: 32px 20px;
    }
  }

  .widgets-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .widgets-user-icon {
    width: 32px;
    height: 32px;
    background: var(--win-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: black;
  }

  .widgets-panel h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 700;
  }

  @media (max-width: 639px) {
    .widgets-panel h3 {
      font-size: 14px;
    }
  }

  .widget-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  @media (max-width: 639px) {
    .widget-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }

  .widget-card {
    background: rgba(255,255,255,0.08);
    padding: 10px;
    border-radius: 10px;
    min-height: 68px;
    color: white;
    font-size: 12px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  @media (max-width: 639px) {
    .widget-card {
      padding: 12px;
      min-height: 60px;
      font-size: 11px;
    }
  }

  .virtual-desktop-strip {
    position: fixed;
    bottom: calc(var(--taskbar-height) + 60px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(25, 25, 25, 0.75);
    border: 1px solid rgba(255,255,255,0.14);
    backdrop-filter: blur(10px);
    z-index: 1100;
    max-width: 90vw;
    overflow-x: auto;
  }

  @media (max-width: 639px) {
    .virtual-desktop-strip {
      bottom: calc(var(--taskbar-height) + 50px);
      gap: 6px;
      padding: 4px 8px;
    }
  }

  .desktop-switch {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.6);
    padding: 4px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  @media (max-width: 639px) {
    .desktop-switch {
      padding: 4px 10px;
      font-size: 11px;
    }
  }

  .desktop-switch.active {
    background: rgba(255,255,255,0.18);
    color: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .desktop-add {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: white;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  @media (max-width: 639px) {
    .desktop-add {
      width: 24px;
      height: 24px;
      font-size: 14px;
    }
  }
  
  .desktop-add:hover {
    background: rgba(255,255,255,0.2);
  }
`}</style>

    </div>
  );
};

export default Desktop;
