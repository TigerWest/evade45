import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { GameState } from '../../game/types';
import { createDroneModel, type DroneModel } from '../../game/world';
import { disposeObjectTree } from './resources';

interface DroneFieldProps {
  gameRef: MutableRefObject<GameState>;
}

export function DroneField({ gameRef }: DroneFieldProps) {
  const field = useRef<THREE.Group>(null);
  const liveModels = useRef(new Map<number, DroneModel>());
  const showcase = useMemo(createDroneModel, []);
  const rotation = useMemo(
    () => ({ quaternion: new THREE.Quaternion(), euler: new THREE.Euler(0, 0, 0, 'YXZ') }),
    [],
  );

  useEffect(
    () => () => {
      for (const model of liveModels.current.values()) disposeObjectTree(model.root);
      liveModels.current.clear();
      disposeObjectTree(showcase.root);
    },
    [showcase],
  );

  useFrame(({ clock }, delta) => {
    const game = gameRef.current,
      time = clock.elapsedTime;
    showcase.root.visible = game.status === 'ready';
    if (showcase.root.visible) {
      showcase.root.position.set(
        1.1 + Math.sin(time * 0.6) * 0.7,
        6.9 + Math.sin(time * 1.3) * 0.14,
        12,
      );
      showcase.body.rotation.set(0.1, Math.PI * 0.65 + Math.sin(time * 0.3) * 0.2, 0.05);
      showcase.rotors.forEach(
        (rotor, index) => (rotor.rotation.y = time * (index % 2 ? 120 : -120)),
      );
    }

    const liveIds = new Set<number>();
    for (const drone of game.drones) {
      liveIds.add(drone.id);
      let model = liveModels.current.get(drone.id);
      if (!model) {
        model = createDroneModel();
        liveModels.current.set(drone.id, model);
        field.current?.add(model.root);
      }
      model.root.position.set(drone.x, drone.y, drone.z);
      const yaw = Math.atan2(-drone.vx, -drone.vz),
        speed = Math.hypot(drone.vx, drone.vy, drone.vz),
        pitch = Math.atan2(drone.vy, Math.hypot(drone.vx, drone.vz)) - 0.18 - speed * 0.006;
      rotation.euler.set(pitch, yaw, drone.roll || 0, 'YXZ');
      rotation.quaternion.setFromEuler(rotation.euler);
      model.body.quaternion.slerp(rotation.quaternion, 1 - Math.exp(-delta * 15));
      model.rotors.forEach(
        (rotor, index) => (rotor.rotation.y = time * (index % 2 ? 1 : -1) * (140 + speed * 3)),
      );
    }
    for (const [id, model] of liveModels.current)
      if (!liveIds.has(id)) {
        liveModels.current.delete(id);
        disposeObjectTree(model.root);
      }
  });

  return (
    <group ref={field}>
      <primitive object={showcase.root} scale={1.65} />
    </group>
  );
}
