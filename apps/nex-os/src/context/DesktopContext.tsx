import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { 
  Delete24Regular,
  Edit24Regular,
  Document24Regular,
  CheckmarkCircle24Regular,
  Settings24Regular,
  Calendar24Regular,
  Search24Regular,
  Book24Regular,
  Globe24Regular,
  Games24Regular,
  Code24Regular,
} from '@fluentui/react-icons';
import type { AppProps } from './WindowManager';
import { genId } from '../utils/id';
import { resolveAppMeta } from '../utils/resolveAppMeta';

export interface DesktopIcon {
  id: string;
  title: string;
  icon: ReactNode;
  type: 'file' | 'folder' | 'system';
  appId?: string;
  appProps?: AppProps;
  x: number;
  y: number;
}

export interface VirtualDesktop {
  id: string;
  name: string;
}

type PersistedIcon = {
  id: string;
  title: string;
  type: 'file' | 'folder' | 'system';
  appId?: string;
  appProps?: AppProps;
  x: number;
  y: number;
};

const ICONS_KEY = 'win11_desktop_icons';
const VD_KEY = 'win11_virtual_desktops';

const DEFAULT_ICONS: DesktopIcon[] = [
  { 
    id: 'recycle-bin', 
    title: 'Papelera de reciclaje', 
    icon: <Delete24Regular primaryFill="#ecf0f1" />, 
    type: 'system',
    appId: 'recycle-bin',
    x: 20, 
    y: 20 
  },
  {
    id: 'ie',
    title: 'Internet Explorer',
    icon: <Globe24Regular primaryFill="#0078d4" />,
    type: 'system',
    appId: 'ie',
    x: 20,
    y: 120,
  },
  {
    id: 'chrome',
    title: 'Google Chrome',
    icon: <Globe24Regular primaryFill="#4285F4" />,
    type: 'system',
    appId: 'chrome',
    x: 20,
    y: 220,
  },
  { 
    id: 'counter-strike', 
    title: 'Counter-Strike 1.6', 
    icon: <Games24Regular primaryFill="#ef6c00" />,
    type: 'system',
    appId: 'counter-strike',
    x: 20, 
    y: 320
  },
  {
    id: 'paint',
    title: 'Paint',
    icon: <Edit24Regular primaryFill="#FF6E40" />,
    type: 'system',
    appId: 'paint',
    x: 120,
    y: 20,
  },
  {
    id: 'wordpad',
    title: 'WordPad',
    icon: <Document24Regular primaryFill="#4CAF50" />,
    type: 'system',
    appId: 'wordpad',
    x: 120,
    y: 120,
  },
  {
    id: 'task-manager',
    title: 'Administrador de tareas',
    icon: <CheckmarkCircle24Regular primaryFill="#2196F3" />,
    type: 'system',
    appId: 'taskmanager',
    x: 120,
    y: 220,
  },
  {
    id: 'control-panel',
    title: 'Panel de Control',
    icon: <Settings24Regular primaryFill="#757575" />,
    type: 'system',
    appId: 'control-panel',
    x: 120,
    y: 320,
  },
  {
    id: 'calendar',
    title: 'Calendario',
    icon: <Calendar24Regular primaryFill="#E91E63" />,
    type: 'system',
    appId: 'calendar',
    x: 220,
    y: 20,
  },
  {
    id: 'search',
    title: 'Buscar',
    icon: <Search24Regular primaryFill="#FF9800" />,
    type: 'system',
    appId: 'search',
    x: 220,
    y: 120,
  },
  {
    id: 'devcpp-2026',
    title: 'Dev-C++ 2026',
    icon: <Code24Regular primaryFill="#3b82f6" />,
    type: 'system',
    appId: 'devcpp-2026',
    x: 320,
    y: 20,
  },
  {
    id: 'manual',
    title: 'Manual de NEX',
    icon: <Book24Regular primaryFill="#3b82f6" />,
    type: 'system',
    appId: 'manual',
    x: 320,
    y: 120,
  },
  {
    id: 'games',
    title: 'Games',
    icon: <Games24Regular primaryFill="#22d3ee" />,
    type: 'system',
    appId: 'games',
    x: 220,
    y: 220,
  },
];

function hydrateIcon(p: PersistedIcon): DesktopIcon {
  const fallback = DEFAULT_ICONS.find((d) => d.id === p.id);
  if (fallback) {
    return { ...fallback, title: p.title || fallback.title, x: p.x, y: p.y, appProps: p.appProps };
  }
  const meta = p.appId ? resolveAppMeta(p.appId) : { title: p.title, icon: <Document24Regular /> };
  return {
    id: p.id,
    title: p.title || meta.title,
    icon: meta.icon,
    type: p.type,
    appId: p.appId,
    appProps: p.appProps,
    x: p.x,
    y: p.y,
  };
}

function loadIcons(): DesktopIcon[] {
  try {
    const raw = localStorage.getItem(ICONS_KEY);
    if (!raw) return DEFAULT_ICONS;
    const parsed = JSON.parse(raw) as PersistedIcon[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_ICONS;
    const icons = parsed.map(hydrateIcon);
    const have = new Set(icons.map((i) => i.id));
    for (const def of DEFAULT_ICONS) {
      if (!have.has(def.id)) icons.push(def);
    }
    return icons;
  } catch {
    return DEFAULT_ICONS;
  }
}

function loadVirtualDesktops(): { list: VirtualDesktop[]; current: string } {
  try {
    const raw = localStorage.getItem(VD_KEY);
    if (!raw) {
      return {
        list: [
          { id: 'desktop-1', name: 'Escritorio 1' },
          { id: 'desktop-2', name: 'Escritorio 2' },
          { id: 'desktop-3', name: 'Escritorio 3' },
        ],
        current: 'desktop-1',
      };
    }
    const parsed = JSON.parse(raw) as { list: VirtualDesktop[]; current: string };
    return {
      list: parsed.list?.length ? parsed.list : [{ id: 'desktop-1', name: 'Escritorio 1' }],
      current: parsed.current || 'desktop-1',
    };
  } catch {
    return {
      list: [{ id: 'desktop-1', name: 'Escritorio 1' }],
      current: 'desktop-1',
    };
  }
}

interface DesktopContextType {
  desktopIcons: DesktopIcon[];
  addDesktopIcon: (icon: Omit<DesktopIcon, 'id'> & { id?: string }) => void;
  removeDesktopIcon: (id: string) => void;
  updateDesktopIcon: (id: string, updates: Partial<DesktopIcon>) => void;
  sortDesktopIcons: (by: 'name' | 'type' | 'position') => void;
  currentDesktopId: string;
  virtualDesktops: VirtualDesktop[];
  switchDesktop: (id: string) => void;
  addDesktop: () => void;
}

const DesktopContext = createContext<DesktopContextType | undefined>(undefined);

export const DesktopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialVd = useMemo(() => loadVirtualDesktops(), []);
  const [currentDesktopId, setCurrentDesktopId] = useState(initialVd.current);
  const [virtualDesktops, setVirtualDesktops] = useState<VirtualDesktop[]>(initialVd.list);
  const [desktopIcons, setDesktopIcons] = useState<DesktopIcon[]>(() => loadIcons());

  useEffect(() => {
    const payload: PersistedIcon[] = desktopIcons.map(({ icon: _i, ...rest }) => rest);
    localStorage.setItem(ICONS_KEY, JSON.stringify(payload));
  }, [desktopIcons]);

  useEffect(() => {
    localStorage.setItem(VD_KEY, JSON.stringify({ list: virtualDesktops, current: currentDesktopId }));
  }, [virtualDesktops, currentDesktopId]);

  const addDesktopIcon = (icon: Omit<DesktopIcon, 'id'> & { id?: string }) => {
    const id = icon.id || genId();
    setDesktopIcons((prev) => [...prev, { ...icon, id }]);
  };

  const removeDesktopIcon = (id: string) => {
    setDesktopIcons((prev) => prev.filter((icon) => icon.id !== id));
  };

  const updateDesktopIcon = (id: string, updates: Partial<DesktopIcon>) => {
    setDesktopIcons((prev) => prev.map((icon) => icon.id === id ? { ...icon, ...updates } : icon));
  };

  const sortDesktopIcons = (by: 'name' | 'type' | 'position') => {
    setDesktopIcons((prev) => {
      const sorted = [...prev];
      if (by === 'name') {
        sorted.sort((a, b) => a.title.localeCompare(b.title));
      } else if (by === 'type') {
        sorted.sort((a, b) => a.type.localeCompare(b.type));
      } else {
        sorted.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      }
      return sorted;
    });
  };

  const switchDesktop = (id: string) => {
    if (!virtualDesktops.some((desk) => desk.id === id)) return;
    setCurrentDesktopId(id);
  };

  const addDesktop = () => {
    const nextNumber = virtualDesktops.length + 1;
    const newId = `desktop-${nextNumber}`;
    setVirtualDesktops((prev) => [...prev, { id: newId, name: `Escritorio ${nextNumber}` }]);
    setCurrentDesktopId(newId);
  };

  return (
    <DesktopContext.Provider value={{
      desktopIcons, addDesktopIcon, removeDesktopIcon, updateDesktopIcon, sortDesktopIcons,
      currentDesktopId, virtualDesktops, switchDesktop, addDesktop
    }}>
      {children}
    </DesktopContext.Provider>
  );
};

export const useDesktop = () => {
  const context = useContext(DesktopContext);
  if (!context) throw new Error('useDesktop must be used within a DesktopProvider');
  return context;
};
