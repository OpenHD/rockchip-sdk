import React, { useEffect, useMemo, useState } from 'react';
import { useWindowManager } from '../../context/WindowManager';
import { isNexMod } from '../../utils/nexShortcuts';

/**
 * App switcher — NO usa Alt+Tab (Windows se lo come).
 * Atajo: Ctrl+Alt+`  (no Alt+Tab ni Ctrl+Alt+Tab — los come Windows)
 */
const AltTabSwitcher: React.FC = () => {
  const { windows, focusWindow, restoreWindow } = useWindowManager();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const stack = useMemo(
    () =>
      [...windows]
        .filter((w) => w.isOpen)
        .sort((a, b) => b.zIndex - a.zIndex),
    [windows],
  );

  useEffect(() => {
    const activate = (id: string) => {
      restoreWindow(id);
      focusWindow(id);
    };

    const isSwitcherKey = (e: KeyboardEvent) => {
      if (!isNexMod(e)) return false;
      return e.key === '`' || e.code === 'Backquote';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSwitcherKey(e)) return;
      if (!stack.length) return;

      e.preventDefault();
      if (!open) {
        setOpen(true);
        setIndex(e.shiftKey ? stack.length - 1 : Math.min(1, stack.length - 1));
        return;
      }
      setIndex((prev) => {
        if (e.shiftKey) return (prev - 1 + stack.length) % stack.length;
        return (prev + 1) % stack.length;
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Cerrar al soltar Alt o Ctrl (fin del gesto Ctrl+Alt)
      if (e.key !== 'Alt' && e.key !== 'AltLeft' && e.key !== 'AltRight'
        && e.key !== 'Control' && e.key !== 'ControlLeft' && e.key !== 'ControlRight') {
        return;
      }
      if (!open) return;
      const target = stack[index];
      if (target) activate(target.id);
      setOpen(false);
      setIndex(0);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [open, index, stack, focusWindow, restoreWindow]);

  if (!open || !stack.length) return null;

  return (
    <div
      className="alt-tab-overlay"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="alt-tab-panel mica">
        <div className="alt-tab-hint">Ctrl+Alt+` · cambiar app</div>
        {stack.map((w, i) => (
          <button
            key={`${w.desktopId}-${w.id}`}
            type="button"
            className={`alt-tab-card ${i === index ? 'selected' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onClick={() => {
              restoreWindow(w.id);
              focusWindow(w.id);
              setOpen(false);
            }}
          >
            <div className="alt-tab-icon">{w.icon}</div>
            <div className="alt-tab-title">{w.title}</div>
            {w.isMinimized && <div className="alt-tab-badge">min</div>}
          </button>
        ))}
      </div>
      <style>{`
        .alt-tab-overlay {
          position: fixed;
          inset: 0;
          z-index: 10050;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(6px);
        }
        .alt-tab-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          max-width: min(920px, 92vw);
          padding: 20px;
          padding-top: 36px;
          border-radius: 16px;
          border: 1px solid var(--border-color, rgba(255,255,255,0.12));
          background: color-mix(in srgb, var(--mica-bg, #1c1c1c) 92%, transparent);
          position: relative;
        }
        .alt-tab-hint {
          position: absolute; top: 10px; left: 16px;
          font-size: 11px; opacity: 0.5; color: var(--win-fg, #fff);
        }
        .alt-tab-card {
          width: 140px;
          height: 110px;
          border-radius: 12px;
          border: 2px solid transparent;
          background: rgba(255,255,255,0.04);
          color: var(--win-fg, #fff);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          position: relative;
        }
        .alt-tab-card.selected {
          border-color: var(--win-accent, #60cdff);
          background: color-mix(in srgb, var(--win-accent, #60cdff) 18%, transparent);
        }
        .alt-tab-icon { font-size: 28px; display: grid; place-items: center; }
        .alt-tab-title {
          font-size: 12px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .alt-tab-badge {
          position: absolute;
          top: 6px;
          right: 8px;
          font-size: 10px;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default AltTabSwitcher;
