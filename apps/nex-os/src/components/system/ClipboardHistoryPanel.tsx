import React from 'react';
import { Clipboard24Regular, Delete24Regular, Image24Regular } from '@fluentui/react-icons';
import { useClipboardHistory } from '../../context/ClipboardHistoryContext';

const ClipboardHistoryPanel: React.FC = () => {
  const { items, isOpen, closeHistory, pasteItem, clearHistory } = useClipboardHistory();

  if (!isOpen) return null;

  return (
    <div className="clip-overlay" onClick={closeHistory}>
      <div className="clip-panel mica" onClick={(e) => e.stopPropagation()}>
        <div className="clip-head">
          <div className="clip-title">
            <Clipboard24Regular />
            <span>Historial del portapapeles</span>
          </div>
          <div className="clip-actions">
            <button type="button" onClick={clearHistory} title="Vaciar">
              <Delete24Regular />
            </button>
            <kbd>Ctrl+Alt+V</kbd>
          </div>
        </div>
        <div className="clip-list">
          {items.length === 0 && (
            <div className="clip-empty">
              Copiá texto o hacé un recorte (Ctrl+Alt+S). Acá aparece el historial.
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="clip-item"
              onClick={() => void pasteItem(item.id)}
            >
              {item.kind === 'image' && item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="clip-thumb" />
              ) : (
                <div className="clip-text">{item.text}</div>
              )}
              <div className="clip-meta">
                {item.kind === 'image' ? <Image24Regular /> : null}
                <span>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .clip-overlay {
          position: fixed; inset: 0; z-index: 10060;
          background: rgba(0,0,0,0.25);
          display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 72px;
        }
        .clip-panel {
          width: min(520px, 94vw);
          max-height: min(420px, 60vh);
          border-radius: 14px;
          border: 1px solid var(--border-color, rgba(255,255,255,0.12));
          overflow: hidden;
          display: flex; flex-direction: column;
          background: color-mix(in srgb, var(--mica-bg, #1c1c1c) 94%, transparent);
        }
        .clip-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
        }
        .clip-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: var(--win-fg, #fff); }
        .clip-actions { display: flex; align-items: center; gap: 10px; }
        .clip-actions button { background: transparent; border: 0; color: inherit; cursor: pointer; opacity: 0.75; }
        .clip-actions kbd {
          font-size: 11px; opacity: 0.55; border: 1px solid rgba(255,255,255,0.15);
          padding: 2px 6px; border-radius: 6px;
        }
        .clip-list { overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .clip-empty { padding: 28px 16px; text-align: center; opacity: 0.6; font-size: 13px; color: var(--win-fg, #fff); }
        .clip-item {
          text-align: left; border: 1px solid transparent; border-radius: 10px;
          background: rgba(255,255,255,0.04); color: var(--win-fg, #fff);
          padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
        }
        .clip-item:hover { border-color: var(--win-accent, #60cdff); background: color-mix(in srgb, var(--win-accent, #60cdff) 12%, transparent); }
        .clip-text {
          font-size: 13px; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
          white-space: pre-wrap; word-break: break-word;
        }
        .clip-thumb { max-height: 120px; width: auto; border-radius: 8px; object-fit: contain; }
        .clip-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: 0.5; }
      `}</style>
    </div>
  );
};

export default ClipboardHistoryPanel;
