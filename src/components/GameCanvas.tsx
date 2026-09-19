import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useEffect, useRef, type MutableRefObject} from 'react';
import * as THREE from 'three';
import {stepGame} from '../game/engine';
import type {GameInput, GameState} from '../game/types';
import {createWorld} from '../game/world';

interface SceneBridgeProps {
  gameRef: MutableRefObject<GameState>;
  inputRef: MutableRefObject<GameInput>;
  reducedMotionRef: MutableRefObject<boolean>;
  onFrame: (game:GameState, time:number) => void;
}

function SceneBridge({gameRef,inputRef,reducedMotionRef,onFrame}:SceneBridgeProps){
  const {scene,camera}=useThree();
  const worldRef=useRef<ReturnType<typeof createWorld>|null>(null);

  useEffect(()=>{
    worldRef.current=createWorld(scene,camera as THREE.PerspectiveCamera);
    return ()=>{worldRef.current?.destroy();worldRef.current=null};
  },[scene,camera]);

  useFrame(({clock},delta)=>{
    const game=gameRef.current;
    stepGame(game,inputRef.current,delta);
    worldRef.current?.update(game,clock.elapsedTime,delta,reducedMotionRef.current);
    onFrame(game,clock.elapsedTime);
  });
  return null;
}

interface GameCanvasProps extends SceneBridgeProps {
  onCanvasReady: (canvas:HTMLCanvasElement) => void;
  onContextLost: () => void;
}

export function GameCanvas(props:GameCanvasProps){
  const coarse=matchMedia('(pointer:coarse)').matches;
  return <div id="world" aria-label="First-person 3D game">
    <Canvas
      dpr={[1,coarse?1.35:1.65]}
      camera={{fov:76,near:.045,far:360}}
      gl={{antialias:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.1}}
      onCreated={({gl})=>{
        gl.shadowMap.enabled=true;gl.shadowMap.type=THREE.PCFShadowMap;
        gl.domElement.tabIndex=0;
        gl.domElement.addEventListener('webglcontextlost',props.onContextLost,{once:true});
        props.onCanvasReady(gl.domElement);
      }}
    >
      <SceneBridge {...props}/>
    </Canvas>
  </div>;
}
