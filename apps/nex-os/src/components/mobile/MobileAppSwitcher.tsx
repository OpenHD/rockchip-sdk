import React from 'react';
import { motion } from 'framer-motion';
import { Dismiss20Regular } from '@fluentui/react-icons';
import type { AppWindow } from '../../context/WindowManager';
import { colorForApp } from './appColors';

interface MobileAppSwitcherProps {
  windows: AppWindow[];
  onOpen: (id: string) => void;
  onCloseApp: (id: string) => void;
  onHome: () => void;
}

const MobileAppSwitcher: React.FC<MobileAppSwitcherProps> = ({ windows, onOpen, onCloseApp, onHome }) => {
  const open = windows.filter((w) => w.isOpen);

  return (
    <motion.div
      className="nex-m-switcher"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      onClick={onHome}
    >
      <h2>Recientes</h2>
      {open.length === 0 ? (
        <div className="nex-m-switcher-empty">No hay apps abiertas</div>
      ) : (
        <div className="nex-m-cards" onClick={(e) => e.stopPropagation()}>
          {open
            .slice()
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((w) => (
              <div key={w.id} className="nex-m-card">
                <button
                  type="button"
                  className="nex-m-card-preview"
                  style={{ ['--card-accent' as string]: colorForApp(w.appId || w.id) }}
                  onClick={() => onOpen(w.id)}
                >
                  {w.icon}
                </button>
                <div className="nex-m-card-meta">
                  <span>{w.title}</span>
                  <button
                    type="button"
                    className="nex-m-card-close"
                    aria-label={`Cerrar ${w.title}`}
                    onClick={() => onCloseApp(w.id)}
                  >
                    <Dismiss20Regular />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </motion.div>
  );
};

export default MobileAppSwitcher;
