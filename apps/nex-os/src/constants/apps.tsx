import React from 'react';
import {
  Folder24Regular,
  Search24Regular,
  Edit24Regular,
  Settings24Regular,
  Document24Regular,
  Apps24Regular,
  Calendar24Regular,
  ShieldCheckmark24Regular,
  Clock24Regular,
  Image24Regular,
  MusicNote2Regular,
  Calculator24Regular,
  Globe24Regular,
  Games24Regular,
} from '@fluentui/react-icons';

/**
 * Lightweight metadata for the apps shown in the Start Menu, Search Pane and Taskbar.
 *
 * Notes:
 * - We intentionally do NOT eagerly import the heavy app components here.
 *   They are loaded on demand via {@link AppRegistry} using the `appId` field.
 * - Built-in apps: register in `AppRegistry.tsx` and add an `AppItem` below.
 * - Community apps: use `@nex-os/sdk` (`defineApp`) + import in `community-apps/`.
 */
export interface AppItem {
  /** Unique identifier (also used as the window id by default) */
  id: string;
  /** Identifier resolved by AppRegistry to lazy-load the actual component */
  appId: string;
  icon: React.ReactNode;
  label: string;
  /** Whether the app should be pinned to the taskbar permanently */
  isPinned?: boolean;
}

export const APPS: AppItem[] = [
  { id: 'search', appId: 'search', icon: <Search24Regular />, label: 'Buscar' },
  { id: 'files', appId: 'file-explorer', icon: <Folder24Regular />, label: 'Explorador de archivos', isPinned: true },
  { id: 'chrome', appId: 'chrome', icon: <Globe24Regular primaryFill="#4285F4" />, label: 'Google Chrome', isPinned: true },
  {
    id: 'vscode',
    appId: 'vscode',
    icon: (
      <svg viewBox="0 0 100 100" width="24" height="24">
        <path
          d="M74.9 10.4L50 35.3l-11-11L10 42.8v14.4l11-8.2 11 11 28-28.9V74l-11-8-11 11 28.9 13L90 79V21z"
          fill="#007ACC"
        />
      </svg>
    ),
    label: 'NEX Code',
    isPinned: true
  },
  { id: 'hermes', appId: 'hermes', icon: <Globe24Regular />, label: 'Hermes Agent', isPinned: true },
  { id: 'paint', appId: 'paint', icon: <Edit24Regular />, label: 'Paint' },
  { id: 'control-panel', appId: 'control-panel', icon: <Settings24Regular />, label: 'Configuración', isPinned: true },
  { id: 'wordpad', appId: 'wordpad', icon: <Document24Regular />, label: 'WordPad' },
  { id: 'task-manager', appId: 'task-manager', icon: <Apps24Regular />, label: 'Administrador de tareas' },
  { id: 'calendar', appId: 'calendar', icon: <Calendar24Regular />, label: 'Calendario' },
  { id: 'defender', appId: 'defender', icon: <ShieldCheckmark24Regular />, label: 'Seguridad de Windows' },
  { id: 'calculator', appId: 'calculator', icon: <Calculator24Regular />, label: 'Calculadora' },
  { id: 'notepad', appId: 'notepad', icon: <Document24Regular />, label: 'Bloc de notas' },
  {
    id: 'terminal',
    appId: 'terminal',
    icon: <span style={{ fontFamily: 'Consolas, monospace', fontSize: 16 }}>C:\\</span>,
    label: 'Terminal',
    isPinned: true
  },
  { id: 'clock', appId: 'clock', icon: <Clock24Regular />, label: 'Reloj' },
  { id: 'photos', appId: 'photos', icon: <Image24Regular />, label: 'Fotos' },
  { id: 'nexreproductor', appId: 'nexreproductor', icon: <MusicNote2Regular />, label: 'NexReproductor', isPinned: true },
  { id: 'virtual-dj', appId: 'virtual-dj', icon: <MusicNote2Regular primaryFill="#ff6b4a" />, label: 'NEX DJ', isPinned: true },
  { id: 'spotify', appId: 'spotify', icon: <MusicNote2Regular />, label: 'Spotify' },
  {
    id: 'nex-store',
    appId: 'nex-store',
    icon: <span style={{ fontSize: 18 }}>🛒</span>,
    label: 'NEX Store',
    isPinned: true,
  },
  { id: 'tetris', appId: 'tetris', icon: <span style={{ fontSize: 18 }}>🧱</span>, label: 'Tetris' },
  { id: 'games', appId: 'games', icon: <Games24Regular primaryFill="#22d3ee" />, label: 'Games' },
];
