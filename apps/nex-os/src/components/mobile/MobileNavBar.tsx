import React from 'react';
import { ArrowLeft24Regular, SquareMultiple24Regular } from '@fluentui/react-icons';

interface MobileNavBarProps {
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
  recentsOpen?: boolean;
  overlay?: boolean;
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ onBack, onHome, onRecents, recentsOpen, overlay }) => {
  return (
    <nav className={`nex-m-nav ${overlay ? 'is-overlay' : ''}`} aria-label="Navegación NEX">
      <button type="button" className="nex-m-nav-btn" onClick={onBack} aria-label="Atrás">
        <ArrowLeft24Regular />
      </button>
      <button
        type="button"
        className={`nex-m-nav-btn ${recentsOpen ? '' : 'active'}`}
        onClick={onHome}
        aria-label="Inicio"
      >
        <span className="nex-m-home-pill" />
      </button>
      <button type="button" className="nex-m-nav-btn" onClick={onRecents} aria-label="Recientes">
        <SquareMultiple24Regular />
      </button>
    </nav>
  );
};

export default MobileNavBar;
