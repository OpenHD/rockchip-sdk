import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { genId } from '../utils/id';

export type SystemState = 'OFF' | 'BOOTING' | 'UEFI' | 'WINDOWS_BOOT' | 'LOGIN' | 'DESKTOP' | 'SHUTTING_DOWN' | 'RESTARTING';

export interface Notification {
  id: string;
  title: string;
  message: string;
  icon?: React.ReactNode;
  timestamp: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  pin: string;
  settings: {
    wallpaper: string;
    theme: 'light' | 'dark';
    neonTheme: 'none' | 'cyberpunk' | 'matrix' | 'synthwave';
    accentColor: string;
    isNightLightEnabled: boolean;
  };
}

interface SettingsContextType {
  // Global Settings
  brightness: number;
  setBrightness: (val: number) => void;
  volume: number;
  setVolume: (val: number) => void;
  isWifiEnabled: boolean;
  setIsWifiEnabled: (enabled: boolean) => void;
  isBluetoothEnabled: boolean;
  setIsBluetoothEnabled: (enabled: boolean) => void;
  systemState: SystemState;
  setSystemState: (state: SystemState) => void;
  osType: 'windows' | 'nexos';
  setOsType: (os: 'windows' | 'nexos') => void;
  updateStatus: 'idle' | 'checking' | 'downloading' | 'up-to-date';
  setUpdateStatus: (status: 'idle' | 'checking' | 'downloading' | 'up-to-date') => void;
  lockSystem: () => void;
  notifications: Notification[];
  addNotification: (title: string, message: string, icon?: React.ReactNode) => void;
  removeNotification: (id: string) => void;
  isTaskViewOpen: boolean;
  setIsTaskViewOpen: (val: boolean) => void;
  playSound: (type: 'startup' | 'notif' | 'error' | 'beep') => void;

  // Multi-User Management
  users: UserProfile[];
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  addUser: (name: string, pin: string) => void;
  
  // User Settings (Derived from currentUser)
  userName: string;
  setUserName: (name: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  isNightLightEnabled: boolean;
  setIsNightLightEnabled: (enabled: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  neonTheme: 'none' | 'cyberpunk' | 'matrix' | 'synthwave';
  setNeonTheme: (theme: 'none' | 'cyberpunk' | 'matrix' | 'synthwave') => void;
  wallpaper: string;
  setWallpaper: (url: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Global States
  const [systemState, setSystemState] = useState<SystemState>('OFF');
  const [osType, setOsType] = useState<'windows' | 'nexos'>(() => 
    (localStorage.getItem('win11_osType') as 'windows' | 'nexos') || 'windows'
  );
  const [brightness, setBrightness] = useState(() => 
    Number(localStorage.getItem('win11_brightness')) || 100
  );
  const [volume, setVolume] = useState(() => 
    Number(localStorage.getItem('win11_volume')) || 50
  );
  const [isWifiEnabled, setIsWifiEnabled] = useState(() => 
    localStorage.getItem('win11_wifi') !== 'false'
  );
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(() => 
    localStorage.getItem('win11_bluetooth') !== 'false'
  );
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'up-to-date'>('idle');
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const raw = localStorage.getItem('win11_notifications');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<Omit<Notification, 'timestamp' | 'icon'> & { timestamp: string }>;
      return parsed.map((n) => ({
        ...n,
        icon: undefined,
        timestamp: new Date(n.timestamp),
      }));
    } catch {
      return [];
    }
  });
  const [isTaskViewOpen, setIsTaskViewOpen] = useState(false);

  // Multi-User States
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('win11_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing users", e);
      }
    }
    // Fallback: migrate old settings to a default user
    return [{
      id: 'default',
      name: localStorage.getItem('win11_userName') || 'Usuario',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop',
      pin: '',
      settings: {
        wallpaper: localStorage.getItem('win11_wallpaper') || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1974',
        theme: (localStorage.getItem('win11_theme') as 'light' | 'dark') || 'dark',
        neonTheme: (localStorage.getItem('win11_neonTheme') as any) || 'none',
        accentColor: localStorage.getItem('win11_accentColor') || '#60cdff',
        isNightLightEnabled: localStorage.getItem('win11_nightlight') === 'true'
      }
    }];
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(users.length > 0 ? users[0].id : null);
  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  // Save users to localstorage whenever they change
  useEffect(() => {
    localStorage.setItem('win11_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    const lean = notifications.map(({ id, title, message, timestamp }) => ({
      id,
      title,
      message,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    }));
    localStorage.setItem('win11_notifications', JSON.stringify(lean));
  }, [notifications]);

  // Derived User Settings
  const userName = currentUser?.name || 'Invitado';
  const wallpaper = currentUser?.settings.wallpaper || '';
  const theme = currentUser?.settings.theme || 'dark';
  const neonTheme = currentUser?.settings.neonTheme || 'none';
  const accentColor = currentUser?.settings.accentColor || '#60cdff';
  const isNightLightEnabled = currentUser?.settings.isNightLightEnabled || false;

  // Helpers to update user settings
  const updateUserSetting = useCallback((key: keyof UserProfile['settings'], value: any) => {
    if (!currentUserId) return;
    setUsers(prev => prev.map(u => 
      u.id === currentUserId 
        ? { ...u, settings: { ...u.settings, [key]: value } }
        : u
    ));
  }, [currentUserId]);

  const setUserName = useCallback((name: string) => {
    if (!currentUserId) return;
    setUsers(prev => prev.map(u => u.id === currentUserId ? { ...u, name } : u));
  }, [currentUserId]);

  const addUser = useCallback((name: string, pin: string) => {
    const newUser: UserProfile = {
      id: genId(),
      name,
      pin,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      settings: {
        wallpaper: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1974',
        theme: 'dark',
        neonTheme: 'none',
        accentColor: '#60cdff',
        isNightLightEnabled: false
      }
    };
    setUsers(prev => [...prev, newUser]);
    setCurrentUserId(newUser.id);
  }, []);

  const setWallpaper = useCallback((url: string) => updateUserSetting('wallpaper', url), [updateUserSetting]);
  const toggleTheme = useCallback(
    () => updateUserSetting('theme', theme === 'dark' ? 'light' : 'dark'),
    [updateUserSetting, theme],
  );
  const setNeonTheme = useCallback((nt: any) => updateUserSetting('neonTheme', nt), [updateUserSetting]);
  const setAccentColor = useCallback((color: string) => updateUserSetting('accentColor', color), [updateUserSetting]);
  const setIsNightLightEnabled = useCallback(
    (enabled: boolean) => updateUserSetting('isNightLightEnabled', enabled),
    [updateUserSetting],
  );

  // Apply visual changes when current user settings change
  useEffect(() => {
    document.documentElement.setAttribute('data-neon', neonTheme);
  }, [neonTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--win-accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--win-brightness', (brightness / 100).toString());
    localStorage.setItem('win11_brightness', brightness.toString());
  }, [brightness]);

  useEffect(() => {
    localStorage.setItem('win11_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('win11_wifi', isWifiEnabled.toString());
  }, [isWifiEnabled]);

  useEffect(() => {
    localStorage.setItem('win11_bluetooth', isBluetoothEnabled.toString());
  }, [isBluetoothEnabled]);

  useEffect(() => {
    localStorage.setItem('win11_osType', osType);
  }, [osType]);

  // Forward-declared by ref so addNotification can call playSound without
  // forming a stale closure on `volume`.
  const playSoundRef = useRef<(t: 'startup' | 'notif' | 'error' | 'beep') => void>(() => {});
  const addNotification = useCallback((title: string, message: string, icon?: React.ReactNode) => {
    const newNotif: Notification = { id: genId(), title, message, icon, timestamp: new Date() };
    setNotifications(prev => [newNotif, ...prev].slice(0, 5));
    playSoundRef.current('notif');
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Cache audio elements to avoid creating new instances on every play call.
  const audioCacheRef = useRef<Record<string, HTMLAudioElement>>({});
  const playSound = useCallback((type: 'startup' | 'notif' | 'error' | 'beep') => {
    const urls: Record<string, string> = {
      startup: 'https://archive.org/download/windows-11-original-sounds/Windows%20Logon.mp3',
      notif: 'https://archive.org/download/windows-11-original-sounds/Windows%20Notify%20System%20Generic.mp3',
      error: 'https://archive.org/download/windows-11-original-sounds/Windows%20Foreground.mp3',
      beep: 'https://www.soundjay.com/buttons/beep-07.wav',
    };
    let audio = audioCacheRef.current[type];
    if (!audio) {
      audio = new Audio(urls[type]);
      audio.preload = 'auto';
      audioCacheRef.current[type] = audio;
    }
    audio.volume = volume / 100;
    // Reset to start so rapid notifications still play
    try { audio.currentTime = 0; } catch { /* ignore */ }
    audio.play().catch(() => { /* Audio blocked by browser policy */ });
  }, [volume]);

  // Keep the ref pointing at the latest playSound so addNotification
  // (with a stable identity) always plays at the current volume.
  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  const lockSystem = useCallback(() => {
    if (systemState === 'DESKTOP') {
      setSystemState('LOGIN');
    }
  }, [systemState, setSystemState]);

  const value = useMemo(
    () => ({
      brightness, setBrightness,
      volume, setVolume,
      isWifiEnabled, setIsWifiEnabled,
      isBluetoothEnabled, setIsBluetoothEnabled,
      systemState, setSystemState,
      osType, setOsType,
      updateStatus, setUpdateStatus,
      lockSystem,
      notifications, addNotification, removeNotification,
      isTaskViewOpen, setIsTaskViewOpen,
      playSound,
      users, currentUserId, setCurrentUserId, addUser,
      userName, setUserName,
      accentColor, setAccentColor,
      isNightLightEnabled, setIsNightLightEnabled,
      theme, toggleTheme,
      neonTheme, setNeonTheme,
      wallpaper, setWallpaper,
    }),
    [
      brightness, volume, isWifiEnabled, isBluetoothEnabled, systemState, osType,
      updateStatus, lockSystem, notifications, addNotification, removeNotification,
      isTaskViewOpen, playSound, users, currentUserId, addUser, userName, setUserName,
      accentColor, setAccentColor, isNightLightEnabled, setIsNightLightEnabled,
      theme, toggleTheme, neonTheme, setNeonTheme, wallpaper, setWallpaper,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
