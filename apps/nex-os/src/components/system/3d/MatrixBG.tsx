import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const CHARS = '0123456789ABCDEFHIJKLMNOPQRSTUVWXYZ$#@%&*';

const MatrixStream = ({ position }: { position: [number, number, number] }) => {
  const group = useRef<THREE.Group>(null);
  const streamLength = useMemo(() => Math.floor(Math.random() * 10) + 10, []);
  const speed = useMemo(() => Math.random() * 0.05 + 0.02, []);
  
  const chars = useMemo(() => {
    return Array.from({ length: streamLength }).map((_, i) => ({
      char: CHARS[Math.floor(Math.random() * CHARS.length)],
      y: i * 0.5,
      opacity: 1 - (i / streamLength)
    }));
  }, [streamLength]);

  useFrame(() => {
    if (group.current) {
      group.current.position.y -= speed;
      if (group.current.position.y < -10) {
        group.current.position.y = 10;
      }
    }
  });

  return (
    <group ref={group} position={position}>
      {chars.map((c, i) => (
        <Text
          key={i}
          position={[0, c.y, 0]}
          fontSize={0.4}
          color="#00ff41"
          fillOpacity={c.opacity}
        >
          {c.char}
        </Text>
      ))}
    </group>
  );
};

const MatrixBG: React.FC = () => {
  const streams = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() * 10) - 8 // Z entre -8 y 2 (Cámara está en 5)
      ] as [number, number, number]
    }));
  }, []);

  return (
    <group>
      <color attach="background" args={['#000500']} />
      {streams.map((s, i) => (
        <MatrixStream key={i} position={s.position} />
      ))}
    </group>
  );
};

export default MatrixBG;
