import React, { Suspense, lazy, useEffect } from 'react';
import { WindowManagerProvider, useWindowManager } from './context/WindowManager';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import NotificationContainer from './components/system/NotificationToast';
import { ArrowClockwise24Regular, Info24Regular } from '@fluentui/react-icons';
import { FileSystemProvider } from './context/FileSystemContext';
import { DesktopProvider } from './context/DesktopContext';
import { UIProvider } from './context/UIContext';
import { NexRuntimeProvider } from './context/NexRuntimeContext';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { ClipboardHistoryProvider } from './context/ClipboardHistoryContext';
import ClipboardHistoryPanel from './components/system/ClipboardHistoryPanel';
import SnippingOverlay from './components/system/SnippingOverlay';
import { useNexPhoneShell } from './hooks/useMobileAppShell';

const OffScreen = lazy(() => import('./components/system/OffScreen'));
const BootScreen = lazy(() => import('./components/system/BootScreen'));
const LoginScreen = lazy(() => import('./components/system/LoginScreen'));
const ShutdownScreen = lazy(() => import('./components/system/ShutdownScreen'));
const RestartScreen = lazy(() => import('./components/system/restart'));
const Background3D = lazy(() => import('./components/system/Background3D'));
const UEFI = lazy(() => import('./components/system/UEFI'));
const WindowsBoot = lazy(() => import('./components/system/WindowsBoot'));
const Desktop = lazy(() => import('./components/Desktop'));
const NexDesktop = lazy(() => import('./components/nexos/NexDesktop'));

function ScreenFallback() {
  return <div className="w-screen h-screen bg-black" aria-hidden />;
}

function WelcomeBackEffect() {
  const { systemState, addNotification, playSound, osType } = useSettings();
  const { windows } = useWindowManager();
  const hasLoggedInRef = React.useRef(false);

  useEffect(() => {
    if (systemState === 'DESKTOP' && !hasLoggedInRef.current) {
      if (osType === 'windows') {
        playSound('startup');
        const openCount = windows.filter((w) => w.isOpen).length;
        if (openCount > 0) {
          addNotification(
            'De nuevo en NEX',
            `${openCount} ventana${openCount === 1 ? '' : 's'} restaurada${openCount === 1 ? '' : 's'} · seguí donde dejaste`,
            <ArrowClockwise24Regular />,
          );
        } else {
          addNotification(
            'Bienvenido',
            window.matchMedia('(max-width: 768px)').matches
              ? 'NEX OS Mobile · deslizá desde arriba para el centro de control'
              : 'NEX OS listo · Ctrl+Alt+V portapapeles · Ctrl+Alt+S recorte',
            <Info24Regular />,
          );
        }
      }
      hasLoggedInRef.current = true;
    }
    if (systemState === 'LOGIN' || systemState === 'OFF') {
      hasLoggedInRef.current = false;
    }
  }, [systemState, osType, windows, addNotification, playSound]);

  return null;
}

function AppContent() {
  const isPhone = useNexPhoneShell();
  const { isNightLightEnabled, systemState, setSystemState, wallpaper, osType, setOsType } = useSettings();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (systemState === 'BOOTING') {
      timeout = setTimeout(() => {
        setOsType('windows');
        setSystemState('WINDOWS_BOOT');
      }, 2500);
    } else if (systemState === 'WINDOWS_BOOT') {
      timeout = setTimeout(() => {
        setSystemState('LOGIN');
      }, 3500);
    } else if (systemState === 'SHUTTING_DOWN') timeout = setTimeout(() => setSystemState('OFF'), 3000);
    else if (systemState === 'RESTARTING') timeout = setTimeout(() => setSystemState('BOOTING'), 2500);

    return () => clearTimeout(timeout);
  }, [systemState, setSystemState, setOsType]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative select-none gpu-accelerated">
      <div className="brightness-overlay" />
      {isNightLightEnabled && (
        <div
          className="fixed inset-0 bg-[#ff990022] pointer-events-none z-[9998]"
          style={{ mixBlendMode: 'multiply' }}
        />
      )}

      <WelcomeBackEffect />

      <Suspense fallback={<ScreenFallback />}>
        {systemState === 'DESKTOP' && !isPhone && <Background3D />}

        {systemState === 'OFF' && <OffScreen onPowerOn={() => setSystemState('BOOTING')} />}
        {systemState === 'BOOTING' && <BootScreen />}
        {systemState === 'WINDOWS_BOOT' && <WindowsBoot />}
        {systemState === 'UEFI' && (
          <UEFI
            onBootWindows={() => setSystemState('WINDOWS_BOOT')}
            onBootNexOS={() => {
              setSystemState('LOGIN');
            }}
            setOsType={setOsType}
          />
        )}
        {systemState === 'LOGIN' && <LoginScreen onLogin={() => setSystemState('DESKTOP')} wallpaper={wallpaper} />}
        {systemState === 'DESKTOP' && (
          isPhone || osType === 'windows' ? (
            <Desktop
              onShutdown={() => setSystemState('SHUTTING_DOWN')}
              onRestart={() => setSystemState('RESTARTING')}
            />
          ) : (
            <NexDesktop />
          )
        )}
        {systemState === 'SHUTTING_DOWN' && <ShutdownScreen />}
        {systemState === 'RESTARTING' && <RestartScreen />}
      </Suspense>

      <NotificationContainer />
      <ClipboardHistoryPanel />
      <SnippingOverlay />
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <MusicPlayerProvider>
        <FileSystemProvider>
          <NexRuntimeProvider>
            <DesktopProvider>
              <UIProvider>
                <WindowManagerProvider>
                  <ClipboardHistoryProvider>
                    <AppContent />
                  </ClipboardHistoryProvider>
                </WindowManagerProvider>
              </UIProvider>
            </DesktopProvider>
          </NexRuntimeProvider>
        </FileSystemProvider>
      </MusicPlayerProvider>
    </SettingsProvider>
  );
}

export default App;
