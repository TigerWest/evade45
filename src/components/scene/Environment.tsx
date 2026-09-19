import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seededRandom } from '../../game/engine';
import { createSmokeTexture } from '../../game/world';

const vertexShader =
  'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragmentShader =
  'varying vec3 vWorld;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vWorld).y;vec3 col=mix(bottom,top,smoothstep(-.08,.8,h));float cloud=sin(vWorld.x*.04+sin(vWorld.z*.05))*sin(vWorld.z*.018+vWorld.x*.012);col+=smoothstep(.15,.7,cloud)*.1*smoothstep(.08,.7,h);gl_FragColor=vec4(col,1.);}';

interface SmokeParticle {
  x: number;
  z: number;
  phase: number;
  seed: number;
}

export function Environment() {
  const coarse = useMemo(() => matchMedia('(pointer:coarse)').matches, []);
  const smokeMap = useMemo(createSmokeTexture, []);
  const smokeGroup = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const smoke = useMemo<SmokeParticle[]>(() => {
    const rand = seededRandom(1701),
      particles: SmokeParticle[] = [];
    for (const [x, z] of [
      [-38, -36],
      [29, -53],
      [63, 38],
    ])
      for (let i = 0; i < 12; i++) particles.push({ x, z, phase: i / 12, seed: rand() * 8 });
    return particles;
  }, []);
  const dustPositions = useMemo(() => {
    const rand = seededRandom(923),
      positions = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i++) {
      positions[i * 3] = (rand() - 0.5) * 140;
      positions[i * 3 + 1] = rand() * 12;
      positions[i * 3 + 2] = (rand() - 0.5) * 140;
    }
    return positions;
  }, []);
  const skyUniforms = useMemo(
    () => ({
      top: { value: new THREE.Color('#7b929c') },
      bottom: { value: new THREE.Color('#d9c7a7') },
    }),
    [],
  );

  useEffect(() => () => smokeMap.dispose(), [smokeMap]);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    smokeGroup.current?.children.forEach((child, index) => {
      const sprite = child as THREE.Sprite,
        particle = smoke[index],
        phase = (time * 0.018 + particle.phase) % 1;
      sprite.position.set(
        particle.x + phase * 7 + Math.sin(time * 0.1 + particle.seed),
        1 + phase * 26,
        particle.z + phase * 3,
      );
      const size = 3 + phase * 14;
      sprite.scale.set(size, size * 1.3, 1);
      (sprite.material as THREE.SpriteMaterial).opacity =
        (1 - phase) * 0.22 * Math.min(phase * 12, 1);
    });
    if (dust.current) {
      dust.current.position.x = Math.sin(time * 0.015) * 5;
      dust.current.position.z = Math.cos(time * 0.011) * 5;
    }
  });

  const shadowSize = coarse ? 1024 : 2048;
  return (
    <>
      <color attach="background" args={[0xadb3a5]} />
      <fogExp2 attach="fog" args={[0xa5a99b, 0.0077]} />
      <hemisphereLight args={[0xc3d3de, 0x514936, 2.2]} />
      <directionalLight
        castShadow
        color={0xffdab0}
        intensity={3.2}
        position={[-65, 48, -85]}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={85}
        shadow-camera-bottom={-85}
        shadow-camera-near={1}
        shadow-camera-far={240}
        shadow-normalBias={0.04}
        shadow-bias={-0.0001}
      />
      <mesh>
        <sphereGeometry args={[290, 32, 20]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={skyUniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      <mesh position={[-100, 43, -160]}>
        <sphereGeometry args={[3.6, 24, 12]} />
        <meshBasicMaterial color={0xffe8b2} fog={false} />
      </mesh>
      <sprite position={[-100, 43, -160]} scale={[55, 55, 1]}>
        <spriteMaterial
          map={smokeMap}
          color={0xffdfad}
          transparent
          opacity={0.27}
          depthWrite={false}
          fog={false}
        />
      </sprite>
      <group ref={smokeGroup}>
        {smoke.map((_, index) => (
          <sprite key={index}>
            <spriteMaterial
              map={smokeMap}
              color={0x444943}
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={0xe4d5ac}
          size={0.05}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </points>
    </>
  );
}
