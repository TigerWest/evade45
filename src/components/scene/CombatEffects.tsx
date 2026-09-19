import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { GameState } from '../../game/types';

interface CombatEffectsProps {
  gameRef: MutableRefObject<GameState>;
}

export function CombatEffects({ gameRef }: CombatEffectsProps) {
  const sparks = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.1, 0), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffbe72 }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    if (!sparks.current || !flash.current) return;
    for (const child of sparks.current.children) child.visible = false;
    flash.current.intensity = 0;
    const explosion = gameRef.current.explosions.at(-1);
    if (!explosion) return;
    flash.current.position.set(explosion.x, explosion.y + 1, explosion.z);
    flash.current.intensity = Math.max(0, 1 - explosion.age * 4) * 150;
    sparks.current.children.forEach((child, index) => {
      const angle = index * 2.399 + explosion.seed,
        velocity = 3 + (index % 7) * 1.3;
      child.visible = explosion.age < 0.8;
      child.position.set(
        explosion.x + Math.sin(angle) * velocity * explosion.age,
        explosion.y +
          Math.cos(angle * 2) * velocity * explosion.age +
          3 * explosion.age -
          5 * explosion.age * explosion.age,
        explosion.z + Math.cos(angle) * velocity * explosion.age,
      );
      child.scale.setScalar(Math.max(0.1, 1 - explosion.age));
    });
  });

  return (
    <>
      <group ref={sparks}>
        {Array.from({ length: 36 }, (_, index) => (
          <mesh key={index} geometry={geometry} material={material} visible={false} />
        ))}
      </group>
      <pointLight ref={flash} color={0xffa04d} intensity={0} distance={18} decay={2} />
    </>
  );
}
