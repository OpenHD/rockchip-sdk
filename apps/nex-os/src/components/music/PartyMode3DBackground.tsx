import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface PartyMode3DBackgroundProps {
  isPlaying?: boolean;
}

const EtherealCore: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulse = useRef(1);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const target = isPlaying ? 1 + Math.sin(t * 2.4) * 0.06 : 1;
    pulse.current += (target - pulse.current) * 0.08;

    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.12;
      coreRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
      coreRef.current.scale.setScalar(pulse.current);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.08;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[1.8, 4]} />
          <MeshDistortMaterial
            color="#0ea5e9"
            emissive="#0369a1"
            emissiveIntensity={0.8}
            roughness={0.1}
            metalness={0.9}
            distort={0.45}
            speed={2.5}
          />
        </mesh>
      </Float>

      <mesh ref={ringRef}>
        <torusGeometry args={[3.2, 0.04, 16, 128]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.55} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.5, 0.02, 8, 128]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

const FloatingOrbs: React.FC = () => {
  const orbs = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        position: [
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 6 - 2,
        ] as [number, number, number],
        scale: Math.random() * 0.35 + 0.15,
        speed: Math.random() * 0.6 + 0.3,
        color: i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#c084fc' : '#2dd4bf',
      })),
    [],
  );

  return (
    <>
      {orbs.map((orb, i) => (
        <Float
          key={i}
          speed={orb.speed * 2}
          rotationIntensity={1.5}
          floatIntensity={2}
          position={orb.position}
        >
          <mesh scale={orb.scale}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial
              color={orb.color}
              emissive={orb.color}
              emissiveIntensity={0.6}
              roughness={0.2}
              metalness={0.8}
              transparent
              opacity={0.85}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
};

const CameraDrift: React.FC = () => {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    state.camera.position.x = Math.sin(t * 0.15) * 0.8;
    state.camera.position.y = Math.cos(t * 0.12) * 0.4;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
};

const PartyScene: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => (
  <>
    <color attach="background" args={['#020208']} />
    <fog attach="fog" args={['#020208', 8, 22]} />
    <ambientLight intensity={0.15} />
    <pointLight position={[4, 3, 4]} intensity={2} color="#38bdf8" />
    <pointLight position={[-5, -2, 2]} intensity={1.5} color="#a855f7" />
    <pointLight position={[0, -4, -3]} intensity={0.8} color="#2dd4bf" />
    <Stars radius={60} depth={30} count={800} factor={2.5} saturation={0} fade speed={0.4} />
    <Sparkles count={40} scale={12} size={2} speed={0.3} color="#67e8f9" opacity={0.5} />
    <EtherealCore isPlaying={isPlaying} />
    <FloatingOrbs />
    <CameraDrift />
  </>
);

const PartyMode3DBackground: React.FC<PartyMode3DBackgroundProps> = ({ isPlaying = false }) => (
  <div className="party-3d-bg" aria-hidden="true">
    <Canvas
      camera={{ position: [0, 0, 7], fov: 55 }}
      dpr={[1, 1.25]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      frameloop="always"
    >
      <PartyScene isPlaying={isPlaying} />
    </Canvas>
    <div className="party-3d-vignette" />
  </div>
);

export default PartyMode3DBackground;
