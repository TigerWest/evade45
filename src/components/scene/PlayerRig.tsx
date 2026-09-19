import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { createCockpit } from '../../game/cockpit';
import type { GameState } from '../../game/types';

interface PlayerRigProps {
  gameRef: MutableRefObject<GameState>;
  reducedMotionRef: MutableRefObject<boolean>;
}

export function PlayerRig({ gameRef, reducedMotionRef }: PlayerRigProps) {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const cockpit = useMemo(createCockpit, []);
  const animation = useRef({ fov: 76, lastDamage: 0, lastPass: 0, shake: 0 });

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    return () => cockpit.destroy();
  }, [camera, cockpit]);

  useFrame(({ clock }, delta) => {
    const game = gameRef.current,
      p = game.player,
      time = clock.elapsedTime,
      reduced = reducedMotionRef.current;
    cockpit.update(game, time, delta, reduced);
    if (game.status === 'ready') {
      camera.position.set(3.8 + Math.sin(time * 0.07) * 0.5, 2.3, 26);
      camera.lookAt(-5, 3.5, -20);
      return;
    }

    const state = animation.current;
    const moving = Math.min(1, Math.abs(p.speed) / 4),
      frequency = game.mode === 'foot' ? (p.boosting ? 15 : 10) : 22;
    const bob = reduced
      ? 0
      : game.mode === 'foot'
        ? cockpit.motion.bob
        : Math.sin(time * frequency) * 0.013 * moving;
    if (game.damageCount !== state.lastDamage) {
      state.shake = 0.22;
      state.lastDamage = game.damageCount;
    }
    if (game.passCount !== state.lastPass) {
      state.shake = Math.max(state.shake, 0.055);
      state.lastPass = game.passCount;
    }
    state.shake = Math.max(0, state.shake - delta * 0.5);
    const fall = game.status === 'lost' ? 0.7 : 0;
    camera.position.set(
      p.x + (reduced ? 0 : Math.sin(time * 73) * state.shake),
      p.y + bob - fall - (reduced ? 0 : p.landing * 0.2),
      p.z + (reduced ? 0 : Math.cos(time * 61) * state.shake),
    );
    camera.rotation.set(
      p.pitch + (reduced ? 0 : Math.sin(time * 61) * state.shake * 0.12),
      p.yaw,
      game.status === 'lost'
        ? 0.3
        : reduced
          ? 0
          : game.mode === 'foot'
            ? cockpit.motion.roll
            : Math.sin(time * frequency * 0.5) * 0.007 * moving,
      'YXZ',
    );
    const targetFov = game.mode === 'armor' ? 65 : p.boosting ? 84 : 76;
    state.fov += (targetFov - state.fov) * Math.min(delta * 4, 1);
    if (Math.abs(camera.fov - state.fov) > 0.05) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  }, -50);

  return (
    <>
      {createPortal(<primitive object={cockpit.cameraRoot} />, camera)}
      <primitive object={cockpit.vehicleRoot} />
    </>
  );
}
