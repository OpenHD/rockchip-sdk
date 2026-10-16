import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useWindowManager, type AppWindow } from '../../context/WindowManager';
import { useSettings } from '../../context/SettingsContext';
import AppRegistry from '../AppRegistry';
import ErrorBoundary from '../system/ErrorBoundary';

const IOS_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

interface MobileAppWindowProps {
  window: AppWindow;
}

const MobileAppWindow: React.FC<MobileAppWindowProps> = ({ window: appWindow }) => {
  const { closeWindow, focusWindow } = useWindowManager();
  const { neonTheme } = useSettings();
  const reduceMotion = useReducedMotion();
  const startX = useRef<number | null>(null);

  const goBack = () => {
    closeWindow(appWindow.id);
  };

  return (
    <motion.div
      className={`nex-m-app ${neonTheme !== 'none' ? 'neon-border' : ''} ${neonTheme === 'cyberpunk' ? 'scanlines' : ''}`}
      initial={reduceMotion ? { opacity: 0 } : { scale: 0.92, y: '10%', opacity: 0.35 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { scale: 0.94, y: '14%', opacity: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : { duration: 0.42, ease: IOS_EASE }
      }
      style={{ zIndex: appWindow.zIndex }}
      onPointerDown={() => focusWindow(appWindow.id)}
    >
      <div
        className="nex-m-edge-back"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          startX.current = null;
          if (dx > 56) goBack();
        }}
      />
      <div className="nex-m-app-body">
        <div className="nex-m-app-fill">
          <ErrorBoundary appName={appWindow.title}>
            <AppRegistry appId={appWindow.appId} appProps={appWindow.appProps} />
          </ErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(MobileAppWindow);
