import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search24Regular, 
  Apps24Filled, 
  History24Regular, 
  Document24Regular, 
  Globe24Regular,
  ChevronRight24Regular,
  Grid24Filled,
} from '@fluentui/react-icons';
import { type AppItem } from '../constants/apps';
import { useLauncherApps } from '../hooks/useLauncherApps';
import { useWindowManager } from '../context/WindowManager';

interface SearchPaneProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchPane: React.FC<SearchPaneProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { openWindow } = useWindowManager();
  const apps = useLauncherApps();

  const filteredApps = useMemo(() => {
    if (!query) return [];
    return apps.filter(app => 
      app.label.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }, [query, apps]);

  if (!isOpen) return null;

  return (
    <div className="search-overlay-mask" onClick={onClose}>
      <motion.div 
        className="search-pane mica premium-shadow"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* SEARCH HEADER */}
        <div className="search-header">
          <Search24Regular className="search-icon-header" />
          <input 
            autoFocus
            type="text" 
            placeholder="Escribe aquí para buscar" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input-main"
          />
        </div>

        <div className="search-body custom-scrollbar">
          {!query ? (
            <>
              {/* TOP APPS */}
              <div className="search-section">
                <div className="section-title">Aplicaciones principales</div>
                <div className="top-apps-grid">
                  {apps.slice(0, 5).map((app: AppItem) => (
                    <div key={app.id} className="top-app-item" onClick={() => { openWindow(app.id, app.appId, app.label, app.icon); onClose(); }}>
                      <div className="top-app-icon">{app.icon}</div>
                      <div className="top-app-label">{app.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECENT / QUICK SEARCHES */}
              <div className="search-section">
                <div className="section-title">Búsquedas rápidas</div>
                <div className="quick-search-list">
                  <div className="quick-item">
                    <History24Regular className="quick-icon" />
                    <span>Configuración de pantalla</span>
                  </div>
                  <div className="quick-item">
                    <History24Regular className="quick-icon" />
                    <span>Actualizaciones de Windows</span>
                  </div>
                  <div className="quick-item">
                    <History24Regular className="quick-icon" />
                    <span>Fondo de pantalla</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="search-results">
              <div className="section-title">Mejor coincidencia</div>
              {filteredApps.length > 0 ? (
                filteredApps.map((app: AppItem) => (
                  <div key={app.id} className="result-item" onClick={() => { openWindow(app.id, app.appId, app.label, app.icon); onClose(); }}>
                    <div className="result-left">
                       <div className="result-icon">{app.icon}</div>
                       <div className="result-info">
                         <div className="result-name">{app.label}</div>
                         <div className="result-type">Aplicación</div>
                       </div>
                    </div>
                    <ChevronRight24Regular className="result-arrow" />
                  </div>
                ))
              ) : (
                <div className="no-results">
                  <Globe24Regular style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }} />
                  <div>Buscar "{query}" en la web</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="search-footer">
          <div className="footer-item active"><Apps24Filled /><span>Todo</span></div>
          <div className="footer-item"><Grid24Filled /><span>Apps</span></div>
          <div className="footer-item"><Document24Regular /><span>Documentos</span></div>
          <div className="footer-item"><Globe24Regular /><span>Web</span></div>
        </div>
      </motion.div>

      <style>{`
        .search-overlay-mask {
          position: fixed;
          inset: 0;
          z-index: 1400;
          display: flex;
          justify-content: center;
          align-items: flex-end;
          padding-bottom: calc(var(--taskbar-height) + 12px);
          background: rgba(0,0,0,0.01);
        }

        .search-pane {
          width: 740px;
          height: 640px;
          border-radius: 12px;
          background: var(--mica-bg);
          backdrop-filter: blur(50px) saturate(200%);
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .search-header {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 2px solid var(--win-accent);
          background: rgba(0,0,0,0.2);
        }

        .search-icon-header { color: var(--win-accent); }
        .search-input-main {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 15px;
          outline: none;
        }

        .search-body {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
          opacity: 0.9;
        }

        .top-apps-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }

        .top-app-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 16px;
          border-radius: 8px;
          transition: background 0.2s;
          cursor: pointer;
        }
        .top-app-item:hover { background: var(--hover-bg); }
        .top-app-icon { font-size: 32px; }
        .top-app-label { font-size: 12px; text-align: center; }

        .quick-search-list { display: flex; flex-direction: column; gap: 4px; }
        .quick-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        .quick-item:hover { background: var(--hover-bg); }
        .quick-icon { opacity: 0.6; }

        .result-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .result-item:hover { background: var(--hover-bg); transform: scale(1.01); }
        .result-left { display: flex; align-items: center; gap: 16px; }
        .result-icon { font-size: 28px; }
        .result-name { font-size: 14px; font-weight: 500; }
        .result-type { font-size: 11px; opacity: 0.6; }
        .result-arrow { opacity: 0.4; }

        .no-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          opacity: 0.8;
          font-size: 14px;
        }

        .search-footer {
          height: 48px;
          background: rgba(0,0,0,0.1);
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 12px;
        }
        .footer-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          opacity: 0.7;
        }
        .footer-item:hover { background: var(--hover-bg); opacity: 1; }
        .footer-item.active { background: rgba(255,255,255,0.05); opacity: 1; font-weight: 600; }
        .footer-item span { margin-top: 2px; }
      `}</style>
    </div>
  );
};

export default SearchPane;
