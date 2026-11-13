import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const SynthwaveBG: React.FC = () => {
  const gridRef = useRef<THREE.Mesh>(null);
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (gridRef.current) {
      gridRef.current.position.z = (t * 2) % 2;
    }
    if (sunRef.current) {
      sunRef.current.position.y = 2 + Math.sin(t * 0.5) * 0.2;
    }
  });

  return (
    <group>
      <color attach="background" args={['#050110']} />
      
      {/* Sun */}
      <mesh ref={sunRef} position={[0, 2, -10]}>
        <circleGeometry args={[5, 64]} />
        <meshBasicMaterial color="#f92aad" />
      </mesh>
      
      {/* Glow for sun */}
      <mesh position={[0, 2, -10.1]}>
        <circleGeometry args={[7, 64]} />
        <meshBasicMaterial color="#7214fc" transparent opacity={0.3} />
      </mesh>

      {/* Infinite Grid */}
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[100, 100, 50, 50]} />
        <meshBasicMaterial color="#7214fc" wireframe />
      </mesh>

      <Sparkles count={50} scale={20} size={2} speed={0.4} color="#f92aad" />
      
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, -5]} intensity={1.5} color="#f92aad" />
    </group>
  );
};

export default SynthwaveBG;
