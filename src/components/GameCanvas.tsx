import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene, type GameSceneProps } from './scene/GameScene';

interface GameCanvasProps extends GameSceneProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onContextLost: () => void;
}

export function GameCanvas(props: GameCanvasProps) {
  const coarse = matchMedia('(pointer:coarse)').matches;
  return (
    <div id="world" aria-label="First-person 3D game">
      <Canvas
        dpr={[1, coarse ? 1.35 : 1.65]}
        camera={{ fov: 76, near: 0.045, far: 360 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.domElement.tabIndex = 0;
          gl.domElement.addEventListener('webglcontextlost', props.onContextLost, { once: true });
          props.onCanvasReady(gl.domElement);
        }}
      >
        <GameScene {...props} />
      </Canvas>
    </div>
  );
}
