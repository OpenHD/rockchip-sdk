import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Stars, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const CyberpunkBG: React.FC = () => {
  const group = useRef<THREE.Group>(null);
  
  // Generar formas aleatorias
  const shapes = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      position: [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5
      ] as [number, number, number],
      scale: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.5 + 0.2,
      color: i % 2 === 0 ? '#ff00ff' : '#00ffff'
    }));
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ff00ff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#00ffff" />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {shapes.map((shape, i) => (
        <Float
          key={i}
          speed={shape.speed * 2} 
          rotationIntensity={2} 
          floatIntensity={2}
          position={shape.position}
        >
          <mesh scale={shape.scale}>
            <octahedronGeometry />
            <MeshDistortMaterial
              color={shape.color}
              speed={2}
              distort={0.4}
              radius={1}
              emissive={shape.color}
              emissiveIntensity={0.5}
              roughness={0}
              metalness={1}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

export default CyberpunkBG;
