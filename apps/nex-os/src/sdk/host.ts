/**
 * Bridge del host NEX OS → community apps.
 *
 * Importá desde `../sdk/host` (o `@/sdk/host` si tenés alias).
 * Los hooks viven en el shell porque dependen de los React contexts del OS.
 */
export { useWindowManager } from '../context/WindowManager';
export { useSettings } from '../context/SettingsContext';
export { useDesktop } from '../context/DesktopContext';
export { useFileSystem, useNexFs } from '../context/FileSystemContext';
export { useUI } from '../context/UIContext';
export { useMusicPlayer } from '../context/MusicPlayerContext';
export { useNexRuntime } from '../context/NexRuntimeContext';

export { useOpenApp } from './useOpenApp';
