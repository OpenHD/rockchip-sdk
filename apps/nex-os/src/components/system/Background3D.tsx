import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSettings } from '../../context/SettingsContext';
import CyberpunkBG from './3d/CyberpunkBG';
import MatrixBG from './3d/MatrixBG';
import SynthwaveBG from './3d/SynthwaveBG';

const Background3D: React.FC = () => {
  const { neonTheme } = useSettings();

  // Respeta `prefers-reduced-motion` y desactiva el WebGL en dispositivos
  // de baja potencia para evitar lag en móviles antiguos.
  const [shouldRender3D, setShouldRender3D] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 2;
    const phone = window.matchMedia('(max-width: 768px)').matches;
    setShouldRender3D(!reduced && !lowEnd && !phone);
  }, []);

  // No renderizar nada si no hay tema neon activo para ahorrar recursos
  if (neonTheme === 'none') return null;

  // Fallback estático cuando el usuario prefiere menos movimiento.
  if (!shouldRender3D) {
    const gradient = neonTheme === 'cyberpunk'
      ? 'radial-gradient(circle at 30% 30%, #ff00aa22, #0a0a0c 60%)'
      : neonTheme === 'matrix'
        ? 'radial-gradient(circle at 50% 50%, #00ff8822, #0a0a0c 70%)'
        : 'radial-gradient(circle at 70% 30%, #ff66cc22, #0a0a0c 60%)';
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none', background: `${gradient}, #0a0a0c`,
      }} />
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      background: '#0a0a0c'
    }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 2]} // Optimización para pantallas retina
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <Suspense fallback={null}>
          {neonTheme === 'cyberpunk' && <CyberpunkBG />}
          {neonTheme === 'matrix' && <MatrixBG />}
          {neonTheme === 'synthwave' && <SynthwaveBG />}
        </Suspense>
      </Canvas>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at center, transparent 0%, rgba(10, 10, 12, 0.4) 100%)',
        pointerEvents: 'none'
      }} />
    </div>
  );
};

export default Background3D;
