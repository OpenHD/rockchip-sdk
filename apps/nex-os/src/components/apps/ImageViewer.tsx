import React, { useState, useEffect } from 'react';
import {
  ZoomIn20Regular,
  ZoomOut20Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Delete20Regular,
  Edit20Regular,
  Share20Regular
} from '@fluentui/react-icons';

interface ImageViewerProps {
  files: { name: string; imageUrl: string }[];
  initialIndex: number;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ files, initialIndex }) => {
  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const current = files[idx];

  const prev = () => {
    setIdx(i => (i - 1 + files.length) % files.length);
    setZoom(1);
  };
  const next = () => {
    setIdx(i => (i + 1) % files.length);
    setZoom(1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Assuming WindowManager handles focus to some extent, but global listeners might catch background events.
      // We will just do basic arrow keys if it seems focused (e.g., hover). 
      // For a perfect OS lock, it should only trigger if the window is active.
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files.length]);

  if (!current) {
    return (
      <div className="iv-empty">
        No se pudo cargar la imagen
      </div>
    );
  }

  return (
    <div className="iv-root">
      {/* Toolbar */}
      <div className="iv-toolbar">
        <div className="iv-toolbar-left">
          <button className="iv-btn" title="Zoom in" onClick={() => setZoom(z => Math.min(z + 0.25, 3))}><ZoomIn20Regular /></button>
          <button className="iv-btn" title="Zoom out" onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}><ZoomOut20Regular /></button>
          <button className="iv-btn iv-text-btn" title="Tamaño original" onClick={() => setZoom(1)}>1:1</button>
        </div>
        <div className="iv-filename">{current.name}</div>
        <div className="iv-toolbar-right">
          <button className="iv-btn" title="Editar"><Edit20Regular /></button>
          <button className="iv-btn" title="Compartir"><Share20Regular /></button>
          <button className="iv-btn" title="Eliminar"><Delete20Regular /></button>
        </div>
      </div>

      {/* Main Image Area */}
      <div className="iv-main">
        {files.length > 1 && (
          <button className="iv-nav iv-nav-left" onClick={prev}>
            <ChevronLeft24Regular />
          </button>
        )}

        <div className="iv-image-container">
          <img
            src={current.imageUrl}
            alt={current.name}
            className="iv-image"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>

        {files.length > 1 && (
          <button className="iv-nav iv-nav-right" onClick={next}>
            <ChevronRight24Regular />
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div className="iv-statusbar">
        <div className="iv-status-text">
          {idx + 1} de {files.length}
        </div>
      </div>

      <style>{`
        .iv-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #202020;
          color: white;
          font-family: 'Segoe UI Variable', 'Segoe UI', sans-serif;
          user-select: none;
        }

        .iv-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        .iv-toolbar-left, .iv-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .iv-filename {
          font-size: 12px;
          font-weight: 500;
          opacity: 0.8;
          max-width: 40%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .iv-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: background 0.1s;
        }

        .iv-btn:hover { background: rgba(255, 255, 255, 0.1); }
        .iv-text-btn { width: auto; padding: 0 12px; font-size: 12px; font-weight: 500; }

        .iv-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #111;
        }

        .iv-image-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
        }

        .iv-image {
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
          transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          border-radius: 4px;
        }

        .iv-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          z-index: 10;
        }

        .iv-nav:hover { background: rgba(255, 255, 255, 0.15); }
        .iv-nav:active { transform: translateY(-50%) scale(0.95); }
        .iv-nav-left { left: 16px; }
        .iv-nav-right { right: 16px; }

        .iv-statusbar {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }

        .iv-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #202020;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default ImageViewer;
