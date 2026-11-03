import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useClipboardHistory } from '../../context/ClipboardHistoryContext';
import { useSettings } from '../../context/SettingsContext';
import { Image24Regular } from '@fluentui/react-icons';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Ctrl+Alt+S snipping — Win+Shift+S lo captura Windows; usamos mod interno.
 */
const SnippingOverlay: React.FC = () => {
  const { pushImage } = useClipboardHistory();
  const { addNotification } = useSettings();
  const [active, setActive] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const capturing = useRef(false);

  const finish = useCallback(async (r: Rect) => {
    if (capturing.current || r.w < 4 || r.h < 4) {
      setActive(false);
      setStart(null);
      setRect(null);
      return;
    }
    capturing.current = true;
    setActive(false);
    try {
      const root = document.getElementById('root') || document.body;
      const full = await toPng(root, {
        cacheBust: true,
        pixelRatio: 1,
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.classList?.contains('snip-overlay')
            && !node.classList?.contains('clip-overlay')
            && !node.classList?.contains('alt-tab-overlay');
        },
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('img'));
        img.src = full;
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(r.w);
      canvas.height = Math.round(r.h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(
        img,
        Math.round(r.x),
        Math.round(r.y),
        Math.round(r.w),
        Math.round(r.h),
        0,
        0,
        Math.round(r.w),
        Math.round(r.h),
      );
      const dataUrl = canvas.toDataURL('image/png');
      pushImage(dataUrl);
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch {
        /* ignore */
      }
      addNotification('Recorte capturado', 'Copiado · Ctrl+Alt+V para el historial', <Image24Regular />);
    } catch {
      addNotification('Recorte', 'No se pudo capturar esta región. Probá de nuevo.');
    } finally {
      capturing.current = false;
      setStart(null);
      setRect(null);
    }
  }, [addNotification, pushImage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && !e.metaKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setActive(true);
        setStart(null);
        setRect(null);
      }
      if (e.key === 'Escape' && active) {
        setActive(false);
        setStart(null);
        setRect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="snip-overlay"
      onMouseDown={(e) => {
        setStart({ x: e.clientX, y: e.clientY });
        setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
      }}
      onMouseMove={(e) => {
        if (!start) return;
        const x = Math.min(start.x, e.clientX);
        const y = Math.min(start.y, e.clientY);
        const w = Math.abs(e.clientX - start.x);
        const h = Math.abs(e.clientY - start.y);
        setRect({ x, y, w, h });
      }}
      onMouseUp={() => {
        if (rect) void finish(rect);
      }}
    >
      <div className="snip-hint">Arrastrá para recortar · Esc cancela · Ctrl+Alt+S</div>
      {rect && (
        <div
          className="snip-rect"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        />
      )}
      <style>{`
        .snip-overlay {
          position: fixed; inset: 0; z-index: 10070;
          cursor: crosshair;
          background: rgba(0,0,0,0.35);
        }
        .snip-hint {
          position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.65); color: #fff; padding: 8px 14px;
          border-radius: 999px; font-size: 12px; pointer-events: none;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .snip-rect {
          position: fixed;
          border: 2px solid var(--win-accent, #60cdff);
          background: transparent;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default SnippingOverlay;
