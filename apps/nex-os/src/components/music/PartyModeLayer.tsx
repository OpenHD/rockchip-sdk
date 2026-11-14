import React, { Component, useEffect, useState } from 'react';
import PartyMode3DBackground from './PartyMode3DBackground';

interface PartyModeLayerProps {
  enabled: boolean;
  isPlaying: boolean;
}

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function shouldUse3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if ((navigator.hardwareConcurrency ?? 4) <= 2) return false;
  return canUseWebGL();
}

class Party3DErrorBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/** Fondo CSS cuando WebGL no está disponible o falla */
const PartyCssBackground: React.FC = () => (
  <div className="party-css-bg" aria-hidden="true">
    <div className="party-css-orb party-css-orb-1" />
    <div className="party-css-orb party-css-orb-2" />
    <div className="party-css-orb party-css-orb-3" />
    <style>{`
      .party-css-bg {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
        background: radial-gradient(ellipse at 50% 40%, #0c1222 0%, #020208 70%);
      }
      .party-css-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        opacity: 0.45;
        animation: partyOrbFloat 12s ease-in-out infinite;
      }
      .party-css-orb-1 {
        width: 280px;
        height: 280px;
        background: #38bdf8;
        top: 20%;
        left: 15%;
      }
      .party-css-orb-2 {
        width: 320px;
        height: 320px;
        background: #a855f7;
        bottom: 10%;
        right: 10%;
        animation-delay: -4s;
      }
      .party-css-orb-3 {
        width: 200px;
        height: 200px;
        background: #2dd4bf;
        top: 50%;
        left: 50%;
        animation-delay: -8s;
      }
      @keyframes partyOrbFloat {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(20px, -30px) scale(1.08); }
      }
    `}</style>
  </div>
);

const PartyModeLayer: React.FC<PartyModeLayerProps> = ({ enabled, isPlaying }) => {
  const [mounted, setMounted] = useState(false);
  const [use3d, setUse3d] = useState(true);
  const [forceCss, setForceCss] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMounted(false);
      return;
    }
    // Montar el canvas en el próximo frame — evita bloquear el click y sensación de "reload"
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => {
      window.cancelAnimationFrame(id);
      setMounted(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      setUse3d(shouldUse3D());
      setForceCss(false);
    }
  }, [enabled]);

  if (!enabled || !mounted) return null;

  if (!use3d || forceCss) {
    return <PartyCssBackground />;
  }

  return (
    <Party3DErrorBoundary onError={() => setForceCss(true)}>
      <PartyMode3DBackground isPlaying={isPlaying} />
    </Party3DErrorBoundary>
  );
};

export default PartyModeLayer;
