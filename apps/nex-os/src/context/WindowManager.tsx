import React, {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDesktop } from './DesktopContext';
import { resolveAppMeta } from '../utils/resolveAppMeta';
import { pushRecentApp } from '../utils/recentApps';

/** Props passed from the desktop/launcher to a specific app instance. */
export type AppProps = Record<string, unknown>;

export interface AppWindow {
  id: string;
  title: string;
  icon: ReactNode;
  appId: string;
  appProps?: AppProps;
  desktopId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  snap?: 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';
  zIndex: number;
  /** Live geometry (synced from Window chrome). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Saved size/position for restore-from-maximized */
  savedSize?: { width: number; height: number; x: number; y: number };
}

type PersistedWindow = {
  id: string;
  title: string;
  appId: string;
  appProps?: AppProps;
  desktopId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  snap?: AppWindow['snap'];
  zIndex: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  savedSize?: AppWindow['savedSize'];
};

const SESSION_KEY = 'win11_windows';

function loadSession(): { windows: AppWindow[]; focusedWindowId: string | null; nextZ: number } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { windows: [], focusedWindowId: null, nextZ: 10 };
    const parsed = JSON.parse(raw) as { windows?: PersistedWindow[]; focusedWindowId?: string | null };
    const windows = (parsed.windows || []).map((w) => {
      const meta = resolveAppMeta(w.appId);
      return {
        ...w,
        title: w.title || meta.title,
        icon: meta.icon,
        isOpen: true,
      } as AppWindow;
    });
    const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex || 0), 10);
    return {
      windows,
      focusedWindowId: parsed.focusedWindowId ?? null,
      nextZ: maxZ + 1,
    };
  } catch {
    return { windows: [], focusedWindowId: null, nextZ: 10 };
  }
}

interface WindowManagerContextType {
  windows: AppWindow[];
  openWindow: (id: string, appId: string, title: string, icon: ReactNode, appProps?: AppProps) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  minimizeAllWindows: () => void;
  /** Aero Shake — minimize every window except `id`. */
  minimizeOthers: (id: string) => void;
  closeFocusedWindow: () => void;
  maximizeWindow: (id: string, currentSize?: { width: number; height: number; x: number; y: number }) => void;
  snapWindow: (id: string, direction: 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none') => void;
  focusWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  focusedWindowId: string | null;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const session = useRef(loadSession());
  const [windows, setWindows] = useState<AppWindow[]>(() => session.current.windows);
  const nextZRef = useRef(session.current.nextZ);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(() => session.current.focusedWindowId);
  const focusedWindowIdRef = useRef<string | null>(focusedWindowId);
  focusedWindowIdRef.current = focusedWindowId;

  const { currentDesktopId } = useDesktop();
  const currentDesktopIdRef = useRef(currentDesktopId);
  currentDesktopIdRef.current = currentDesktopId;

  // Persist session (icons rehydrated via appId on load)
  useEffect(() => {
    const payload: { windows: PersistedWindow[]; focusedWindowId: string | null } = {
      focusedWindowId,
      windows: windows.map(({ icon: _icon, ...rest }) => rest),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }, [windows, focusedWindowId]);

  const bumpZ = useCallback(() => {
    const z = nextZRef.current;
    nextZRef.current = z + 1;
    return z;
  }, []);

  const openWindow = useCallback((id: string, appId: string, title: string, icon: ReactNode, appProps?: AppProps) => {
    const desktopId = currentDesktopIdRef.current;
    const z = bumpZ();
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === id && w.desktopId === desktopId);
      if (existing) {
        return prev.map((w) =>
          w.id === id && w.desktopId === desktopId
            ? { ...w, appId, appProps, title, icon, isOpen: true, isMinimized: false, snap: 'none', zIndex: z }
            : w,
        );
      }
      const filteredPrev = prev.filter((w) => !(w.id === id && w.desktopId === desktopId));
      return [
        ...filteredPrev,
        {
          id,
          appId,
          appProps,
          title,
          icon,
          desktopId,
          isOpen: true,
          isMinimized: false,
          isMaximized: false,
          snap: 'none' as const,
          zIndex: z,
        },
      ];
    });
    setFocusedWindowId(id);
    pushRecentApp(id, appId, title);
  }, [bumpZ]);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    if (focusedWindowIdRef.current === id) {
      setFocusedWindowId(null);
    }
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)));
    if (focusedWindowIdRef.current === id) {
      setFocusedWindowId(null);
    }
  }, []);

  const minimizeAllWindows = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
    setFocusedWindowId(null);
  }, []);

  const minimizeOthers = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: false } : { ...w, isMinimized: true })),
    );
    setFocusedWindowId(id);
  }, []);

  const closeFocusedWindow = useCallback(() => {
    const id = focusedWindowIdRef.current;
    if (!id) return;
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFocusedWindowId(null);
  }, []);

  const focusWindow = useCallback((id: string) => {
    const z = bumpZ();
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w)));
    setFocusedWindowId(id);
  }, [bumpZ]);

  const maximizeWindow = useCallback((id: string, currentSize?: { width: number; height: number; x: number; y: number }) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (!w.isMaximized) {
          return { ...w, isMaximized: true, snap: 'none', savedSize: currentSize ?? w.savedSize };
        }
        return { ...w, isMaximized: false };
      }),
    );
    focusWindow(id);
  }, [focusWindow]);

  const restoreWindow = useCallback((id: string) => {
    const z = bumpZ();
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: false, zIndex: z } : w)),
    );
    setFocusedWindowId(id);
  }, [bumpZ]);

  const snapWindow = useCallback((
    id: string,
    direction: 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none',
  ) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMaximized: false, isMinimized: false, snap: direction } : w,
      ),
    );
    focusWindow(id);
  }, [focusWindow]);

  const updateWindowBounds = useCallback((
    id: string,
    bounds: { x: number; y: number; width: number; height: number },
  ) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...bounds } : w)),
    );
  }, []);

  const value = useMemo(
    () => ({
      windows,
      openWindow,
      closeWindow,
      minimizeWindow,
      minimizeAllWindows,
      minimizeOthers,
      maximizeWindow,
      snapWindow,
      focusWindow,
      restoreWindow,
      updateWindowBounds,
      closeFocusedWindow,
      focusedWindowId,
    }),
    [
      windows,
      openWindow,
      closeWindow,
      minimizeWindow,
      minimizeAllWindows,
      minimizeOthers,
      maximizeWindow,
      snapWindow,
      focusWindow,
      restoreWindow,
      updateWindowBounds,
      closeFocusedWindow,
      focusedWindowId,
    ],
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager debe usarse dentro de WindowManagerProvider');
  }
  return context;
};
