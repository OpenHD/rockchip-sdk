import React, { useState, useRef } from 'react';
import { Globe24Regular } from '@fluentui/react-icons';

// --- Helpers de Lógica de Navegación ---
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

function resolveUrl(raw: string): string {
  const input = raw.trim();
  if (!input) return 'https://www.google.com/webhp?igu=1';

  const ytMatch = input.match(YOUTUBE_REGEX);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;

  const isUrl = /^(?!-)[A-Za-z0-9-]+(\.[a-z0-9]+)+\.[A-Za-z]{2,6}(:[0-9]{1,5})?(\/.*)?$/.test(input);
  
  if (isUrl) {
    return input.startsWith('http') ? input : `https://${input}`;
  }

  return `https://www.bing.com/search?q=${encodeURIComponent(input)}`;
}

export const IEIcon = () => <Globe24Regular primaryFill="#0078d4" />;

const IEApp: React.FC = () => {
  const [history, setHistory] = useState<string[]>(['https://www.google.com/webhp?igu=1']);
  const [pointer, setPointer] = useState(0);
  const [addressVal, setAddressVal] = useState('https://www.google.com');
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentUrl = history[pointer];

  const navigateTo = (raw: string) => {
    setLoading(true);
    const resolved = resolveUrl(raw);
    const newHistory = history.slice(0, pointer + 1);
    setHistory([...newHistory, resolved]);
    setPointer(newHistory.length);
    setAddressVal(resolved);
  };

  const goBack = () => { if (pointer > 0) { setPointer(p => p - 1); setAddressVal(history[pointer - 1]); } };
  const goForward = () => { if (pointer < history.length - 1) { setPointer(p => p + 1); setAddressVal(history[pointer + 1]); } };
  const goHome = () => navigateTo('https://www.google.com/webhp?igu=1');

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigateTo(addressVal);
  };

  return (
    <div className="ie-root">
      <div className="ie-toolbar">
        <div className="ie-top-row">
          <div className="ie-nav-buttons">
            <button className="ie-btn" onClick={goBack} disabled={pointer === 0} title="Atrás">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button className="ie-btn" onClick={goForward} disabled={pointer === history.length - 1} title="Adelante">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
            <button className="ie-btn ie-home" onClick={goHome} title="Página principal">
               <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </button>
          </div>

          <div className="ie-address-container">
            <div className="ie-world-icon">🌐</div>
            <input 
              className="ie-address" 
              value={addressVal}
              onChange={e => setAddressVal(e.target.value)}
              onKeyDown={handleKey}
              onFocus={(e) => e.target.select()}
            />
            <button className="ie-refresh-btn" onClick={() => navigateTo(currentUrl)}>
               <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#666" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
          </div>

          <div className="ie-search-container">
            <input 
              className="ie-search" 
              placeholder="Buscar con Bing..." 
              onKeyDown={(e) => e.key === 'Enter' && navigateTo(e.currentTarget.value)}
            />
            <span className="ie-search-icon">🔍</span>
          </div>
        </div>

        <div className="ie-bottom-row">
          <div className="ie-menu-bar">
            <span>Archivo</span>
            <span>Edición</span>
            <span>Ver</span>
            <span>Favoritos</span>
            <span>Herramientas</span>
            <span>Ayuda</span>
          </div>
        </div>
      </div>
      
      <div className="ie-content">
        {loading && (
          <div className="ie-loading-bar">
            <div className="ie-progress-animation"></div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={currentUrl}
          className="ie-iframe"
          title="Nex Browser"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
        />
      </div>

      <style>{`
        .ie-root { display: flex; flex-direction: column; height: 100%; background: #f0f0f0; }
        .ie-toolbar { background: #f5f6f7; border-bottom: 1px solid #ccc; display: flex; flex-direction: column; }
        .ie-top-row { display: flex; align-items: center; padding: 6px; gap: 8px; }
        .ie-nav-buttons { display: flex; gap: 4px; align-items: center; }
        
        .ie-btn { 
          width: 28px; height: 28px; border: 1px solid transparent; 
          background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center;
          border-radius: 4px; color: black;
        }
        .ie-btn:hover:not(:disabled) { background: #e0e0e0; border-color: #bbb; }
        .ie-btn:disabled { color: #ccc; cursor: default; }
        .ie-home { color: #2c89db; }

        .ie-address-container { 
          flex: 1; display: flex; background: #ffffff !important; 
          border: 1px solid #abadb3; height: 28px; align-items: center; 
          border-radius: 2px; padding: 0 4px;
        }

        .ie-address { 
          flex: 1; width: 100%; border: none; outline: none; font-size: 13px; 
          color: #333 !important; background: transparent !important; padding: 0 8px;
        }

        .ie-address:-webkit-autofill {
          -webkit-text-fill-color: #333;
          -webkit-box-shadow: 0 0 0px 1000px #fff inset;
        }

        .ie-world-icon { margin-right: 4px; font-size: 14px; }
        .ie-refresh-btn { background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; }

        .ie-search-container { 
          width: 180px; display: flex; background: #ffffff !important; 
          border: 1px solid #abadb3; height: 28px; align-items: center; 
          padding: 0 4px; border-radius: 2px;
        }

        .ie-search { 
          flex: 1; border: none; outline: none; font-size: 13px; 
          color: #333 !important; background: transparent !important; padding: 0 4px;
        }

        .ie-search:-webkit-autofill {
          -webkit-text-fill-color: #333;
          -webkit-box-shadow: 0 0 0px 1000px #fff inset;
        }

        .ie-search-icon { padding: 0 4px; font-size: 14px; color: #888; }

        .ie-bottom-row { background: #f5f6f7; padding: 2px 10px; border-top: 1px solid #fff; }
        .ie-menu-bar { display: flex; gap: 14px; font-size: 12px; color: black; }
        .ie-menu-bar span { cursor: pointer; padding: 2px 4px; border-radius: 2px; }
        .ie-menu-bar span:hover { background: #e5f1fb; outline: 1px solid #a5d1f5; }

        .ie-content { flex: 1; background: #fff; position: relative; overflow: hidden; }
        .ie-iframe { width: 100%; height: 100%; border: none; background: #fff; }
        
        .ie-loading-bar { 
          position: absolute; top: 0; left: 0; width: 100%; height: 2px; 
          background: #e0e0e0; z-index: 20; 
        }
        .ie-progress-animation {
          height: 100%; width: 30%; background: #2c89db;
          animation: ie-load 1.5s infinite ease-in-out;
        }
        @keyframes ie-load {
          0% { margin-left: -30%; }
          100% { margin-left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default IEApp;