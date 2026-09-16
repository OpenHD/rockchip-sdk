import React, { Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { getRegisteredApp, subscribeRegistry } from '@nex-os/sdk';

// Lazy-load every built-in app so the initial bundle stays small.
const RecycleBin = React.lazy(() => import('./apps/RecycleBin'));
const Notepad = React.lazy(() => import('./apps/Notepad'));
const FileExplorer = React.lazy(() => import('./apps/FileExplorer'));
const TaskManager = React.lazy(() => import('./apps/TaskManager'));
const Cmd = React.lazy(() => import('./apps/Cmd'));
const Terminal = React.lazy(() => import('./apps/Terminal'));
const BrowserApp = React.lazy(() => import('./apps/BrowserApp'));
const IEApp = React.lazy(() => import('./apps/IEApp'));
const CounterStrikeApp = React.lazy(() => import('./apps/counter'));
const WindowsDefender = React.lazy(() => import('./apps/WindowsDefender'));
const DevCpp2026 = React.lazy(() => import('./apps/DevCpp2026'));
const ControlPanel = React.lazy(() => import('./apps/ControlPanel'));
const Paint = React.lazy(() => import('./apps/Paint'));
const WordPad = React.lazy(() => import('./apps/WordPad'));
const Calendar = React.lazy(() => import('./apps/Calendar'));
const SearchApp = React.lazy(() => import('./apps/SearchApp'));
const ManualApp = React.lazy(() => import('./apps/ManualApp'));
const Calculator = React.lazy(() => import('./apps/Calculator'));
const Clock = React.lazy(() => import('./apps/Clock'));
const MediaPlayer = React.lazy(() => import('./apps/mediaplayer'));
const ImageViewer = React.lazy(() => import('./apps/ImageViewer'));
const Photos = React.lazy(() => import('./apps/Photos'));
const Settings = React.lazy(() => import('./apps/Settings'));
const SpotifyMini = React.lazy(() => import('./apps/SpotifyMini'));
const VirtualDj = React.lazy(() => import('./apps/VirtualDj'));
const VsCode = React.lazy(() => import('./apps/VsCode'));
const HermesAgent = React.lazy(() => import('./apps/HermesAgent'));
const NexStore = React.lazy(() => import('./apps/NexStore'));
const Tetris = React.lazy(() => import('./apps/Tetris'));
const Games = React.lazy(() => import('./apps/Games'));

interface AppRegistryProps {
  appId: string;
  appProps?: Record<string, unknown>;
}

type AnyLazy = LazyExoticComponent<ComponentType<any>>;
const BUILTIN: Record<string, AnyLazy> = {
  'recycle-bin': RecycleBin,
  notepad: Notepad,
  'file-explorer': FileExplorer,
  files: FileExplorer,
  taskmanager: TaskManager,
  'task-manager': TaskManager,
  cmd: Cmd,
  terminal: Terminal,
  chrome: BrowserApp,
  browser: BrowserApp,
  ie: IEApp,
  'counter-strike': CounterStrikeApp,
  defender: WindowsDefender,
  'devcpp-2026': DevCpp2026,
  'control-panel': ControlPanel,
  settings: Settings,
  paint: Paint,
  wordpad: WordPad,
  calendar: Calendar,
  search: SearchApp,
  manual: ManualApp,
  calculator: Calculator,
  clock: Clock,
  mediaplayer: MediaPlayer,
  'media-player': MediaPlayer,
  'image-viewer': ImageViewer,
  photos: Photos,
  nexreproductor: SpotifyMini,
  spotify: SpotifyMini,
  'virtual-dj': VirtualDj,
  'nex-dj': VirtualDj,
  nexdj: VirtualDj,
  'Nex Code': VsCode,
  vscode: VsCode,
  'nex-code': VsCode,
  hermes: HermesAgent,
  'hermes-agent': HermesAgent,
  'nex-store': NexStore,
  store: NexStore,
  'microsoft-store': NexStore,
  tetris: Tetris,
  'nex-tetris': Tetris,
  games: Games,
  'nex-games': Games,
};

const Fallback = () => (
  <div
    style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
    }}
  >
    <div
      className="spinner"
      style={{
        width: '32px',
        height: '32px',
        border: '3px solid rgba(255,255,255,0.2)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

const NotFound: React.FC<{ appId: string }> = ({ appId }) => (
  <div
    style={{
      padding: '32px',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
      fontFamily: 'Segoe UI, sans-serif',
    }}
  >
    <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.6 }}>📦</div>
    <h2 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Aplicación no encontrada</h2>
    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
      No se pudo abrir{' '}
      <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
        {appId}
      </code>
      .
    </p>
    <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.4)', fontSize: 12, maxWidth: 320 }}>
      ¿Es una community app? Registrate con <code>@nex-os/sdk</code> →{' '}
      <code>defineApp()</code>.
    </p>
  </div>
);

const AppRegistry: React.FC<AppRegistryProps> = ({ appId, appProps }) => {
  // Re-render when community apps register after first paint
  const [, setTick] = useState(0);
  useEffect(() => subscribeRegistry(() => setTick((n) => n + 1)), []);

  if (appId === 'empty-file') {
    return (
      <div style={{ padding: 16, color: 'white' }}>
        Archivo vacío o formato no soportado.
      </div>
    );
  }

  const community = getRegisteredApp(appId);
  if (community) {
    const Comp = community.component;
    const props = { ...(community.defaultProps || {}), ...(appProps || {}) };
    return (
      <Suspense fallback={<Fallback />}>
        <Comp {...props} />
      </Suspense>
    );
  }

  const AppComponent = BUILTIN[appId];
  if (!AppComponent) {
    return <NotFound appId={appId} />;
  }

  return (
    <Suspense fallback={<Fallback />}>
      <AppComponent {...(appProps || {})} />
    </Suspense>
  );
};

export default AppRegistry;
