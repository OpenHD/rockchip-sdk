import React from 'react';
import { Search24Regular } from '@fluentui/react-icons';
import type { AppItem } from '../../constants/apps';
import { colorForApp } from './appColors';

const SHORT_LABELS: Record<string, string> = {
  files: 'Archivos',
  chrome: 'Chrome',
  vscode: 'VS Code',
  hermes: 'Hermes',
  paint: 'Paint',
  'control-panel': 'Ajustes',
  wordpad: 'WordPad',
  'task-manager': 'Tareas',
  calendar: 'Agenda',
  defender: 'Seguridad',
  calculator: 'Calc',
  notepad: 'Notas',
  terminal: 'Consola',
  clock: 'Reloj',
  photos: 'Fotos',
  nexreproductor: 'Música',
  'virtual-dj': 'DJ',
  spotify: 'Spotify',
  'nex-store': 'Store',
  tetris: 'Tetris',
  games: 'Juegos',
};

function homeLabel(app: AppItem) {
  return SHORT_LABELS[app.id] ?? app.label;
}

export function AppGlyph({ app }: { app: AppItem }) {
  return (
    <span className="nex-m-icon" style={{ background: colorForApp(app.id) }}>
      <span className="nex-m-icon-glyph">{app.icon}</span>
    </span>
  );
}

interface MobileHomeProps {
  apps: AppItem[];
  query: string;
  onQuery: (q: string) => void;
  onLaunch: (app: AppItem) => void;
  userName: string;
  now: Date;
}

const MobileHome: React.FC<MobileHomeProps> = ({ apps, query, onQuery, onLaunch, userName, now }) => {
  const q = query.trim().toLowerCase();
  const filtered = apps.filter((a) => {
    const label = homeLabel(a);
    return !q || label.toLowerCase().includes(q) || a.label.toLowerCase().includes(q);
  });

  return (
    <div className="nex-m-home">
      <div className="nex-m-clock">
        <time dateTime={now.toISOString()}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
        <div className="nex-m-date">
          {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
        </div>
        <div className="nex-m-hello">Hola, {userName}</div>
      </div>

      <label className="nex-m-search">
        <Search24Regular />
        <input
          type="search"
          enterKeyHint="search"
          placeholder="Buscar"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      <div className="nex-m-grid-wrap">
        {filtered.length === 0 ? (
          <div className="nex-m-empty">Nada coincide con “{query}”</div>
        ) : (
          <div className="nex-m-grid">
            {filtered.map((app) => (
              <button
                key={app.id}
                type="button"
                className="nex-m-app-btn"
                onClick={() => onLaunch(app)}
              >
                <AppGlyph app={app} />
                <span className="nex-m-app-label">{homeLabel(app)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileHome;
