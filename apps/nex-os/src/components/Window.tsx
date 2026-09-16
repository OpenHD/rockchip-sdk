import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dismiss20Regular, Subtract20Regular, Square20Regular, Copy20Regular } from '@fluentui/react-icons';
import { useWindowManager, type AppWindow } from '../context/WindowManager';
import { useSettings } from '../context/SettingsContext';
import AppRegistry from './AppRegistry';
import ErrorBoundary from './system/ErrorBoundary';

interface WindowProps {
  window: AppWindow;
}

const defaultSize = () => ({
  width: globalThis.innerWidth < 640 ? globalThis.innerWidth : (globalThis.innerWidth < 1024 ? Math.min(800, globalThis.innerWidth - 40) : 800),
  height: globalThis.innerWidth < 640 ? globalThis.innerHeight - 48 : (globalThis.innerWidth < 1024 ? Math.min(600, globalThis.innerHeight - 100) : 600),
});

const defaultPosition = (width: number, height: number) => ({
  x: globalThis.innerWidth < 640 ? 0 : Math.max(0, (globalThis.innerWidth - width) / 2 + (Math.random() * 40 - 20)),
  y: globalThis.innerWidth < 640 ? 0 : Math.max(0, (globalThis.innerHeight - height) / 2 + (Math.random() * 40 - 20)),
});

const Window: React.FC<WindowProps> = ({ window: appWindow }) => {
  const { closeWindow, minimizeWindow, maximizeWindow, snapWindow, focusWindow, focusedWindowId, updateWindowBounds, minimizeOthers } = useWindowManager();
  const { neonTheme } = useSettings();
  const [size, setSize] = useState(() => ({
    width: appWindow.width ?? defaultSize().width,
    height: appWindow.height ?? defaultSize().height,
  }));
  const [position, setPosition] = useState(() => {
    if (typeof appWindow.x === 'number' && typeof appWindow.y === 'number') {
      return { x: appWindow.x, y: appWindow.y };
    }
    const s = defaultSize();
    return defaultPosition(appWindow.width ?? s.width, appWindow.height ?? s.height);
  });


  // Auto-maximize on mobile
  useEffect(() => {
    if (globalThis.innerWidth < 640 && !appWindow.isMaximized) {
      maximizeWindow(appWindow.id);
    }
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [snapPreview, setSnapPreview] = useState<'maximize' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const [showSnapLayouts, setShowSnapLayouts] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  // Restore size from savedSize when un-maximizing
  useEffect(() => {
    if (!appWindow.isMaximized && appWindow.savedSize) {
      setSize({ width: appWindow.savedSize.width, height: appWindow.savedSize.height });
      setPosition({ x: appWindow.savedSize.x, y: appWindow.savedSize.y });
    }
  }, [appWindow.isMaximized]);

  const handleResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startXPos = position.x;
    const startYPos = position.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startXPos;
      let newY = startYPos;

      if (direction.includes('e')) newWidth = Math.max(300, startWidth + deltaX);
      if (direction.includes('s')) newHeight = Math.max(200, startHeight + deltaY);
      if (direction.includes('w')) {
        const potentialWidth = startWidth - deltaX;
        if (potentialWidth > 300) {
          newWidth = potentialWidth;
          newX = startXPos + deltaX;
        }
      }
      if (direction.includes('n')) {
        const potentialHeight = startHeight - deltaY;
        if (potentialHeight > 200) {
          newHeight = potentialHeight;
          newY = startYPos + deltaY;
        }
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      setIsResizing(false);
      const deltaX = upEvent.clientX - startX;
      const deltaY = upEvent.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startXPos;
      let newY = startYPos;
      if (direction.includes('e')) newWidth = Math.max(300, startWidth + deltaX);
      if (direction.includes('s')) newHeight = Math.max(200, startHeight + deltaY);
      if (direction.includes('w')) {
        const potentialWidth = startWidth - deltaX;
        if (potentialWidth > 300) {
          newWidth = potentialWidth;
          newX = startXPos + deltaX;
        }
      }
      if (direction.includes('n')) {
        const potentialHeight = startHeight - deltaY;
        if (potentialHeight > 200) {
          newHeight = potentialHeight;
          newY = startYPos + deltaY;
        }
      }
      updateWindowBounds(appWindow.id, { x: newX, y: newY, width: newWidth, height: newHeight });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <>
    {snapPreview && (
      <div 
        className="snap-preview-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: snapPreview === 'right' ? '50vw' : 0,
          width: snapPreview === 'maximize' ? '100vw' : '50vw',
          height: 'calc(100vh - var(--taskbar-height))',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: appWindow.zIndex - 1,
          borderRadius: 'var(--win-radius)',
          pointerEvents: 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
    )}
    <motion.div
      ref={windowRef}
      initial={{ scale: 0.9, opacity: 0, y: 40, filter: 'blur(10px)' }}
      exit={{ scale: 0.9, opacity: 0, y: 40, filter: 'blur(10px)', transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
      animate={{ 
        scale: appWindow.isMinimized ? 0.7 : 1, 
        opacity: appWindow.isMinimized ? 0 : 1,
        filter: appWindow.isMinimized ? 'blur(20px)' : 'blur(0px)',
        width: appWindow.isMaximized ? '100vw' : (appWindow.snap?.includes('left') || appWindow.snap?.includes('right')) ? '50vw' : size.width,
        height: appWindow.isMaximized ? 'calc(100vh - var(--taskbar-height))' : 
                (appWindow.snap?.includes('top') || appWindow.snap?.includes('bottom')) ? 'calc((100vh - var(--taskbar-height)) / 2)' : 
                size.height,
        y: appWindow.isMinimized ? 150 : (appWindow.isMaximized ? 0 : 
             appWindow.snap?.includes('top') ? 0 : 
             appWindow.snap?.includes('bottom') ? 'calc((100vh - var(--taskbar-height)) / 2)' : 
             (appWindow.snap !== 'none' && appWindow.snap ? 0 : position.y)),
        x: appWindow.isMaximized ? 0 : 
              appWindow.snap?.includes('left') ? 0 : 
              appWindow.snap?.includes('right') ? '50vw' : 
              position.x,
      }}
      transition={isDragging || isResizing ? { duration: 0 } : { type: 'spring', damping: 22, stiffness: 220, mass: 0.8 }}
      style={{ 
        zIndex: appWindow.zIndex, 
        position: appWindow.isMaximized ? 'fixed' : 'absolute', 
        top: 0,
        left: 0,
        willChange: 'transform, opacity, width, height',
        pointerEvents: appWindow.isMinimized ? 'none' : 'auto',
        transformOrigin: 'bottom center'
      }}
      onMouseDown={() => {
        if (!appWindow.isMinimized) focusWindow(appWindow.id);
      }}
      className={`window gpu-accelerated mica premium-shadow border-glow ${appWindow.isMaximized ? 'maximized' : ''} ${neonTheme !== 'none' ? 'neon-border' : ''} ${neonTheme === 'cyberpunk' ? 'scanlines' : ''} ${focusedWindowId === appWindow.id ? 'focused' : ''}`}
    >
      {/* Resizers */}
      {!appWindow.isMaximized && (
        <>
          <div className="resizer n" onMouseDown={(e) => handleResize(e, 'n')} />
          <div className="resizer e" onMouseDown={(e) => handleResize(e, 'e')} />
          <div className="resizer s" onMouseDown={(e) => handleResize(e, 's')} />
          <div className="resizer w" onMouseDown={(e) => handleResize(e, 'w')} />
          <div className="resizer ne" onMouseDown={(e) => handleResize(e, 'ne')} />
          <div className="resizer se" onMouseDown={(e) => handleResize(e, 'se')} />
          <div className="resizer sw" onMouseDown={(e) => handleResize(e, 'sw')} />
          <div className="resizer nw" onMouseDown={(e) => handleResize(e, 'nw')} />
        </>
      )}

      <div 
        className="window-header" 
        onDoubleClick={() => maximizeWindow(appWindow.id, { ...size, ...position })}
        onMouseDown={(e) => {
          let currentTargetX = position.x;
          let currentTargetY = position.y;

          if (appWindow.isMaximized || (appWindow.snap && appWindow.snap !== 'none')) {
            if (appWindow.isMaximized) maximizeWindow(appWindow.id);
            if (appWindow.snap && appWindow.snap !== 'none') snapWindow(appWindow.id, 'none');
            
            currentTargetX = e.clientX - (size.width / 2);
            currentTargetY = 0;
            setPosition({ x: currentTargetX, y: currentTargetY });
          }

          setIsDragging(true);
          const startX = e.clientX;
          const startY = e.clientY;
          const startXPos = currentTargetX;
          const startYPos = currentTargetY;
          let dragSnapPreview: 'maximize' | 'left' | 'right' | null = null;
          // Aero Shake: count horizontal direction flips while dragging
          let lastX = startX;
          let lastDir = 0;
          let flips = 0;
          let shook = false;

          const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.clientX;
            const currentY = moveEvent.clientY;

            const dx = currentX - lastX;
            if (Math.abs(dx) > 12) {
              const dir = dx > 0 ? 1 : -1;
              if (lastDir !== 0 && dir !== lastDir) flips += 1;
              lastDir = dir;
              lastX = currentX;
              if (!shook && flips >= 4) {
                shook = true;
                minimizeOthers(appWindow.id);
              }
            }

            if (currentY <= 5) {
              dragSnapPreview = 'maximize';
            } else if (currentX <= 5) {
              dragSnapPreview = 'left';
            } else if (currentX >= globalThis.innerWidth - 10) {
              dragSnapPreview = 'right';
            } else {
              dragSnapPreview = null;
            }
            setSnapPreview(dragSnapPreview);

            setPosition({
              x: startXPos + (currentX - startX),
              y: startYPos + (currentY - startY)
            });
          };

          const onMouseUp = (upEvent: MouseEvent) => {
            setIsDragging(false);
            const nextX = startXPos + (upEvent.clientX - startX);
            const nextY = startYPos + (upEvent.clientY - startY);
            if (dragSnapPreview === 'maximize') {
              if (!appWindow.isMaximized) maximizeWindow(appWindow.id, { ...size, x: nextX, y: nextY });
            } else if (dragSnapPreview === 'left') {
              snapWindow(appWindow.id, 'left');
            } else if (dragSnapPreview === 'right') {
              snapWindow(appWindow.id, 'right');
            } else {
              updateWindowBounds(appWindow.id, { x: nextX, y: nextY, width: size.width, height: size.height });
            }
            setSnapPreview(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      >
        <div className="window-title">
          <div className="title-icon">{appWindow.icon}</div>
          <span>{appWindow.title}</span>
        </div>
        <div className="window-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => snapWindow(appWindow.id, 'left')} title="Acoplar izquierda">◀</button>
          <button onClick={() => snapWindow(appWindow.id, 'right')} title="Acoplar derecha">▶</button>
          <button onClick={() => minimizeWindow(appWindow.id)} title="Minimizar"><Subtract20Regular /></button>
          <div 
            style={{ position: 'relative', height: '100%', display: 'flex' }}
            onMouseEnter={() => setShowSnapLayouts(true)}
            onMouseLeave={() => setShowSnapLayouts(false)}
          >
            <button onClick={() => maximizeWindow(appWindow.id, { ...size, ...position })}>
              {appWindow.isMaximized ? <Copy20Regular /> : <Square20Regular />}
            </button>
            {showSnapLayouts && (
              <SnapLayoutsMenu onSnap={(s) => {
                if (s === 'maximize') maximizeWindow(appWindow.id, { ...size, ...position, width: size.width, height: size.height });
                else snapWindow(appWindow.id, s);
                setShowSnapLayouts(false);
              }} />
            )}
          </div>
          <button className="close" onClick={() => closeWindow(appWindow.id)}><Dismiss20Regular /></button>
        </div>
      </div>
      <div className="window-content" style={{ pointerEvents: isDragging || isResizing ? 'none' : 'auto' }}>
        {/* Unmount app content while minimized so heavy apps (Monaco, Spotify, DJ) stop work */}
        {!appWindow.isMinimized && (
          <ErrorBoundary appName={appWindow.title}>
            <AppRegistry appId={appWindow.appId} appProps={appWindow.appProps} />
          </ErrorBoundary>
        )}
      </div>

      <style>{`
        .window.maximized {
          border-radius: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
        }

        .window.maximized .window-content {
          max-height: none !important;
        }

        .window {
          border-radius: var(--win-radius);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          user-select: none;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
          min-width: 280px;
          min-height: 200px;
        }

        @media (max-width: 639px) {
          .window {
            min-width: 200px;
            min-height: 150px;
            border-radius: 8px;
          }
        }
        
        .window.focused {
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(96, 205, 255, 0.1);
          border-color: rgba(96, 205, 255, 0.3);
        }

        .window-header {
          height: 36px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 0 0 12px;
          background: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(10px);
          cursor: default;
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .window-header {
            height: 32px;
            padding: 0 0 0 8px;
          }
        }

        @media (max-height: 600px) {
          .window-header {
            height: 28px;
          }
        }

        .window-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        @media (max-width: 639px) {
          .window-title {
            gap: 8px;
            font-size: 11px;
          }
        }

        .title-icon {
          font-size: 16px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .title-icon {
            font-size: 14px;
          }
        }

        .window-controls {
          display: flex;
          height: 100%;
          flex-shrink: 0;
        }

        .window-controls button {
          width: 32px;
          height: 100%;
          background: transparent;
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.1s;
          font-size: 14px;
          font-weight: bold;
          min-width: 32px;
          min-height: 32px;
        }

        @media (max-width: 639px) {
          .window-controls button {
            width: 28px;
            min-width: 28px;
            min-height: 28px;
            font-size: 12px;
          }
        }

        @media (max-width: 450px) {
          .window-controls button:nth-child(1),
          .window-controls button:nth-child(2) {
            display: none;
          }
        }

        .window-controls button:hover {
          background: var(--hover-bg);
        }

        .window-controls button.close:hover {
          background: #c42b1c;
        }

        .window-content {
          flex: 1;
          background: rgba(25, 25, 25, 0.4);
          overflow: auto;
          position: relative;
          min-height: 0;
        }

        /* Resizers */
        .resizer {
          position: absolute;
          z-index: 10;
          transition: background 0.1s;
        }

        .resizer:hover {
          background: rgba(96, 205, 255, 0.2);
        }

        .resizer.n { top: -4px; left: 0; right: 0; height: 8px; cursor: n-resize; }
        .resizer.s { bottom: -4px; left: 0; right: 0; height: 8px; cursor: s-resize; }
        .resizer.e { top: 0; bottom: 0; right: -4px; width: 8px; cursor: e-resize; }
        .resizer.w { top: 0; bottom: 0; left: -4px; width: 8px; cursor: w-resize; }
        .resizer.ne { top: -4px; right: -4px; width: 12px; height: 12px; cursor: ne-resize; }
        .resizer.nw { top: -4px; left: -4px; width: 12px; height: 12px; cursor: nw-resize; }
        .resizer.se { bottom: -4px; right: -4px; width: 12px; height: 12px; cursor: se-resize; }
        .resizer.sw { bottom: -4px; left: -4px; width: 12px; height: 12px; cursor: sw-resize; }

        /* Touch-friendly resizers on mobile */
        @media (hover: none) and (pointer: coarse) {
          .resizer.n { height: 12px; top: -6px; }
          .resizer.s { height: 12px; bottom: -6px; }
          .resizer.e { width: 12px; right: -6px; }
          .resizer.w { width: 12px; left: -6px; }
          .resizer.ne { width: 16px; height: 16px; top: -8px; right: -8px; }
          .resizer.nw { width: 16px; height: 16px; top: -8px; left: -8px; }
          .resizer.se { width: 16px; height: 16px; bottom: -8px; right: -8px; }
          .resizer.sw { width: 16px; height: 16px; bottom: -8px; left: -8px; }
        }

        /* Hide resizers on very small screens */
        @media (max-width: 450px) {
          .resizer {
            display: none;
          }
        }

        .snap-layouts-menu {
          position: absolute;
          top: 36px;
          right: 0;
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          z-index: 2000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          max-height: 90vh;
          overflow-y: auto;
        }

        @media (max-width: 639px) {
          .snap-layouts-menu {
            top: 32px;
            padding: 8px;
            gap: 8px;
            grid-template-columns: 1fr;
          }
        }

        .snap-group {
          width: 80px;
          height: 50px;
          display: grid;
          gap: 4px;
          cursor: pointer;
        }

        @media (max-width: 639px) {
          .snap-group {
            width: 100%;
            height: 60px;
            gap: 2px;
          }
        }

        .snap-zone {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          transition: all 0.2s;
        }

        .snap-zone:hover {
          background: var(--win-accent);
          border-color: white;
        }

        @media (max-width: 639px) {
          .snap-zone:active {
            background: var(--win-accent);
            border-color: white;
          }
        }

        .snap-group {
          width: 80px;
          height: 50px;
          display: grid;
          gap: 4px;
          cursor: pointer;
        }

        @media (max-width: 639px) {
          .snap-group {
            width: 100%;
            height: 60px;
            gap: 2px;
          }
        }

        .snap-zone {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          transition: all 0.2s;
        }

        .snap-zone:hover {
          background: var(--win-accent);
          border-color: white;
        }

        @media (max-width: 639px) {
          .snap-zone:active {
            background: var(--win-accent);
            border-color: white;
          }
        }
      `}</style>
    </motion.div>
    </>
  );
};

const SnapLayoutsMenu = ({ onSnap }: { onSnap: (s: any) => void }) => (
  <div className="snap-layouts-menu">
    {/* Layout 1: Mitades */}
    <div className="snap-group" style={{ gridTemplateColumns: '1fr 1fr' }}>
       <div className="snap-zone" onClick={() => onSnap('left')} />
       <div className="snap-zone" onClick={() => onSnap('right')} />
    </div>
    {/* Layout 2: Quadrants */}
    <div className="snap-group" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
       <div className="snap-zone" onClick={() => onSnap('top-left')} />
       <div className="snap-zone" onClick={() => onSnap('top-right')} />
       <div className="snap-zone" onClick={() => onSnap('bottom-left')} />
       <div className="snap-zone" onClick={() => onSnap('bottom-right')} />
    </div>
    {/* Layout 3: Three columns */}
    <div className="snap-group" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
       <div className="snap-zone" onClick={() => onSnap('left')} />
       <div className="snap-zone" onClick={() => onSnap('maximize')} />
       <div className="snap-zone" onClick={() => onSnap('right')} />
    </div>
    {/* Layout 4: One half, two quarters */}
    <div className="snap-group" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
       <div className="snap-zone" style={{ gridRow: 'span 2' }} onClick={() => onSnap('left')} />
       <div className="snap-zone" onClick={() => onSnap('top-right')} />
       <div className="snap-zone" onClick={() => onSnap('bottom-right')} />
    </div>
  </div>
);

// Memoized: avoids re-rendering every Window when an unrelated state in any
// shared context changes. Each Window only re-renders when its own props change.
export default React.memo(Window);
