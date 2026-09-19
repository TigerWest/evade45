// Procedural model factories only. React Three Fiber owns scene composition,
// animation, and lifecycle in src/components/scene.
import * as THREE from 'three';
import type { Obstacle } from './types';
import { BUILDINGS, OBSTACLES, seededRandom, clamp } from './engine.js';

type TextureKind = 'ground' | 'road' | 'wall' | 'rust';
function noiseLayer(size: number, rand: () => number): (x: number, y: number) => number {
  const values = Float32Array.from({ length: size * size }, () => rand() - 0.5);
  return (x: number, y: number) => {
    const xx = (x / 512) * (size - 1),
      yy = (y / 512) * (size - 1),
      ix = Math.floor(xx),
      iy = Math.floor(yy),
      fx = xx - ix,
      fy = yy - iy;
    const a = values[iy * size + ix] * (1 - fx) + values[iy * size + ix + 1] * fx;
    const b = values[(iy + 1) * size + ix] * (1 - fx) + values[(iy + 1) * size + ix + 1] * fx;
    return a * (1 - fy) + b * fy;
  };
}
function texture(kind: TextureKind, rand: () => number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  const palettes: Record<TextureKind, readonly [number, number, number]> = {
    ground: [94, 89, 66],
    road: [103, 96, 79],
    wall: [141, 139, 119],
    rust: [89, 68, 47],
  };
  const base = palettes[kind];
  const data = c.createImageData(512, 512),
    broad = noiseLayer(8, rand),
    medium = noiseLayer(32, rand),
    fine = noiseLayer(128, rand);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const n = (rand() - 0.5) * 27 + broad(x, y) * 36 + medium(x, y) * 25 + fine(x, y) * 19;
      for (let k = 0; k < 3; k++) data.data[i + k] = clamp(base[k] + n, 0, 255);
      data.data[i + 3] = 255;
    }
  c.putImageData(data, 0, 0);
  if (kind === 'road') {
    for (let i = 0; i < 7000; i++) {
      c.fillStyle = rand() > 0.5 ? '#201e1744' : '#d1c7a033';
      c.fillRect(rand() * 512, rand() * 512, rand() * 2 + 1, rand() * 2 + 1);
    }
    for (const x of [135, 166, 348, 379]) {
      c.strokeStyle = '#322d2129';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 3, 512);
      c.stroke();
    }
  }
  if (kind === 'wall') {
    for (let i = 0; i < 60; i++) {
      const x = rand() * 512,
        y = rand() * 512;
      c.fillStyle = '#4a493d36';
      c.fillRect(x, y, rand() * 50 + 2, rand() * 3 + 1);
    }
    for (let i = 0; i < 12; i++) {
      c.beginPath();
      let x = rand() * 512,
        y = rand() * 512;
      c.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += rand() * 25 - 12;
        y += rand() * 30;
        c.lineTo(x, y);
      }
      c.strokeStyle = '#33372d44';
      c.lineWidth = rand() * 2;
      c.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function createSmokeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!,
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.65)');
  g.addColorStop(0.35, 'rgba(255,255,255,.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createBattlefield() {
  const root = new THREE.Group(),
    rand = seededRandom(923);
  root.name = 'battlefield';
  const groundMap = texture('ground', rand);
  groundMap.repeat.set(75, 75);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundMap,
    color: 0x9d9b7a,
    roughness: 1,
  });
  const groundGeo = new THREE.PlaneGeometry(530, 530, 90, 90);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i),
      z = gp.getZ(i),
      edge = Math.max(Math.abs(x), Math.abs(z));
    gp.setY(
      i,
      edge > 83
        ? (edge - 83) * 0.06 +
            Math.sin(x * 0.035) * Math.cos(z * 0.04) * Math.min(13, (edge - 83) * 0.18)
        : -0.035,
    );
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  root.add(ground);
  const roadMap = texture('road', rand);
  roadMap.repeat.set(1, 33);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadMap,
    roughness: 1,
    color: 0xb9b59b,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 240), roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.005;
  road.receiveShadow = true;
  root.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(180, 7), roadMaterial);
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.set(0, 0.009, 3);
  crossRoad.receiveShadow = true;
  root.add(crossRoad);
  const wallMap = texture('wall', rand);
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallMap,
    roughness: 1,
    color: 0xb8b4a4,
  });
  const rustMaterial = new THREE.MeshStandardMaterial({
    map: texture('rust', rand),
    roughness: 0.94,
    color: 0x8c806b,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222823, roughness: 0.95 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x4f4633, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x4a5149,
    roughness: 0.75,
    metalness: 0.45,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    shadow = true,
  ): THREE.Mesh {
    const m = new THREE.Mesh(unitBox, material);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = shadow && Math.max(w, h, d) > 1.2;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cylinder(
    parent: THREE.Object3D,
    a: [number, number, number],
    b: [number, number, number],
    r: number,
    material: THREE.Material,
    r2 = r,
  ): THREE.Mesh {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      direction = end.clone().sub(start);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, direction.length(), 7), material);
    m.position.copy(start.add(end).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function facade(g: THREE.Group, width: number, height: number, depth: number) {
    box(g, 0, 0.7, depth / 2, width, 1.4, 0.4, wallMaterial);
    box(g, 0, height - 0.6, depth / 2, width, 1.2, 0.4, wallMaterial);
    const n = Math.max(2, Math.floor(width / 3));
    const section = width / n;
    for (let i = 0; i < n; i++) {
      const x = -width / 2 + section * (i + 0.5);
      box(g, x - section / 2 + 0.2, height / 2, depth / 2, 0.45, height, 0.45, wallMaterial);
      box(g, x, 2.2, depth / 2 - 0.24, section - 0.5, 1.6, 0.1, dark, false);
      box(g, x, 1.38, depth / 2 + 0.15, section - 0.25, 0.12, 0.6, wallMaterial);
      box(g, x, 3.08, depth / 2 + 0.1, section - 0.25, 0.14, 0.5, wallMaterial);
      box(g, x, 2.2, depth / 2, 0.09, 1.5, 0.13, timber);
      if (height > 5) {
        box(g, x, 4.1, depth / 2, section - 0.4, 1.7, 0.4, wallMaterial);
        box(g, x, 5.55, depth / 2 - 0.24, section - 0.5, 1.2, 0.1, dark, false);
        box(g, x, 5.1, depth / 2 + 0.1, section - 0.25, 0.15, 0.5, wallMaterial);
      }
    }
    box(g, width / 2 - 0.1, height / 2, depth / 2, 0.3, height, 0.45, wallMaterial);
  }
  for (const b of BUILDINGS) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    root.add(g);
    box(g, 0, 0.14, 0, b.w + 0.6, 0.28, b.d + 0.6, dark);
    box(g, -b.w / 2, b.h / 2, 0, 0.5, b.h, b.d, wallMaterial);
    box(g, b.w / 2, b.h / 2, 0, 0.5, b.h, b.d, wallMaterial);
    box(g, 0, b.h / 2, -b.d / 2, b.w, b.h, 0.5, wallMaterial);
    box(g, 0, b.h - 0.8, 0, b.w, 0.18, b.d, dark);
    facade(g, b.w, b.h, b.d);
    if (b.kind === 'house') {
      for (const side of [-1, 1]) {
        const roof = box(
          g,
          0,
          b.h + 0.85,
          (side * b.d) / 4,
          b.w + 1,
          0.18,
          b.d * 0.59,
          rustMaterial,
        );
        roof.rotation.x = side * 0.38;
        for (let k = -b.w / 2; k < b.w / 2; k += 0.7) {
          const strip = box(
            g,
            k,
            b.h + 0.91,
            (side * b.d) / 4,
            0.035,
            0.04,
            b.d * 0.59,
            metal,
            false,
          );
          strip.rotation.x = side * 0.38;
        }
      }
      box(g, b.w * 0.25, b.h + 1.6, -b.d * 0.15, 0.75, 2, 0.85, wallMaterial);
    } else if (b.kind === 'ruin') {
      for (let i = 0; i < 9; i++) {
        const h = 0.4 + rand() * 1.8;
        box(g, -b.w / 2 + (i * b.w) / 9, b.h + h / 2, -b.d / 2, b.w / 10, h, 0.4, wallMaterial);
        cylinder(
          g,
          [-b.w / 2 + (i * b.w) / 9, b.h, -b.d / 2],
          [-b.w / 2 + (i * b.w) / 9 + 0.14, b.h + 2.1, -b.d / 2],
          0.035,
          metal,
        );
      }
      for (let i = 0; i < 10; i++) {
        const slab = box(
          g,
          (rand() - 0.5) * b.w,
          0.4,
          (rand() - 0.5) * b.d,
          1.4 + rand() * 2,
          0.3,
          1.5,
          wallMaterial,
        );
        slab.rotation.set(rand() * 0.5, rand() * 6, rand() * 0.3);
      }
    } else {
      const roof = box(g, 0, b.h + 0.15, 0, b.w + 1, 0.18, b.d + 1, rustMaterial);
      roof.rotation.z = 0.05;
    }
    // Weathering, exposed bricks, and a sagging drainpipe.
    for (let j = 0; j < 12; j++) {
      const x = (rand() - 0.5) * b.w,
        y = 0.2 + rand() * 1.1;
      box(g, x, y, b.d / 2 + 0.215, 0.25 + rand() * 0.6, 0.08, 0.045, rustMaterial, false);
    }
    cylinder(
      g,
      [b.w / 2 - 0.2, 0, b.d / 2 + 0.3],
      [b.w / 2 - 0.2, b.h, b.d / 2 + 0.3],
      0.065,
      metal,
    );
  }
  function wreck(b: Obstacle) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    root.add(g);
    box(g, 0, 0.64, 0, b.w * 0.88, 0.68, b.d * 0.9, rustMaterial);
    box(g, 0, 1.2, -0.2, b.w * 0.8, 0.55, b.d * 0.43, dark);
    box(g, 0, 1.54, -0.2, b.w * 0.85, 0.13, b.d * 0.48, rustMaterial);
    for (const x of [-b.w * 0.48, b.w * 0.48])
      for (const z of [-b.d * 0.32, b.d * 0.32]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.26, 12), dark);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.43, z);
        g.add(tire);
        tire.castShadow = true;
      }
    for (const x of [-b.w * 0.35, b.w * 0.35])
      box(
        g,
        x,
        0.8,
        b.d * 0.46,
        0.32,
        0.2,
        0.08,
        new THREE.MeshStandardMaterial({ color: 0x918777, roughness: 0.6 }),
      );
    box(g, 0, 0.5, b.d * 0.5, b.w, 0.2, 0.18, metal);
  }
  for (const b of OBSTACLES.slice(BUILDINGS.length))
    if (b.kind === 'car') wreck(b);
    else {
      box(root, b.x, b.h / 2, b.z, b.w, b.h, b.d, wallMaterial);
      for (let i = 0; i < 4; i++)
        box(
          root,
          b.x + (rand() - 0.5) * b.w,
          b.h + 0.1,
          b.z + (rand() - 0.5) * b.d,
          0.6,
          0.22,
          0.6,
          wallMaterial,
        );
    }
  // Debris uses one instanced draw call and stays below collision height.
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0),
    rockMaterial = new THREE.MeshStandardMaterial({ color: 0x827f6d, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 380),
    dummy = new THREE.Object3D();
  for (let i = 0; i < 380; i++) {
    let x = (rand() - 0.5) * 155;
    const z = (rand() - 0.5) * 155;
    if (Math.abs(x) < 4) x += 6;
    const s = 0.07 + rand() * 0.45;
    dummy.position.set(x, s * 0.23, z);
    dummy.rotation.set(rand() * 3, rand() * 6, rand() * 2);
    dummy.scale.set(s, s * 0.55, s * 0.85);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);
  // Mixed trees build a real 3D treeline, not a background image.
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.24, 1, 7), timber, 180);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4e5940, roughness: 1 });
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafMaterial, 540);
  for (let i = 0; i < 180; i++) {
    let x = (rand() - 0.5) * 350;
    const z = (rand() - 0.5) * 350;
    if (Math.abs(x) < 66 && Math.abs(z) < 82) x = (x < 0 ? -1 : 1) * (85 + rand() * 20);
    const h = 5 + rand() * 9;
    dummy.position.set(x, h * 0.5, z);
    dummy.scale.set(1, h, 1);
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      dummy.position.set(x + (rand() - 0.5) * 3, h * 0.65 + j * h * 0.13, z + (rand() - 0.5) * 3);
      const s = h * (0.22 + rand() * 0.1);
      dummy.scale.set(s, s * 0.85, s);
      dummy.rotation.set(rand(), rand() * 6, rand());
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 3 + j, dummy.matrix);
      crowns.setColorAt(
        i * 3 + j,
        new THREE.Color().setHSL(0.21 + rand() * 0.04, 0.14 + rand() * 0.15, 0.16 + rand() * 0.12),
      );
    }
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  root.add(trunks, crowns);
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.025, 0, 0, 0.025, 0, 0, -0.035, 0.35, 0, 0, 0, -0.025, 0, 0, 0.025, 0, 0.28, 0.025],
      3,
    ),
  );
  grassGeo.computeVertexNormals();
  const grass = new THREE.InstancedMesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ color: 0x797957, roughness: 1, side: THREE.DoubleSide }),
    2400,
  );
  for (let i = 0; i < 2400; i++) {
    let x = (rand() - 0.5) * 160,
      z = (rand() - 0.5) * 160;
    if (Math.abs(x) < 6) x += x < 0 ? -7 : 7;
    if (Math.abs(z - 3) < 5) z += 7;
    dummy.position.set(x, 0.01, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    const s = 0.3 + rand() * 0.85;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  grass.receiveShadow = true;
  root.add(grass);
  // Utility wires create strong parallax cues while moving along the road.
  for (let i = 0; i < 7; i++) {
    const z = 65 - i * 25;
    box(root, 8.5, 4.5, z, 0.23, 9, 0.23, timber);
    box(root, 8.5, 8.4, z, 2.6, 0.14, 0.14, timber);
    if (i < 6)
      for (const dx of [-0.9, 0.9]) {
        const points = [];
        for (let t = 0; t <= 20; t++) {
          const f = t / 20;
          points.push(new THREE.Vector3(8.5 + dx, 8.45 - Math.sin(f * Math.PI) * 1.1, z - f * 25));
        }
        root.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0x242e2d }),
          ),
        );
      }
  }
  // Simple sandbags and supply crates give the street a human scale.
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x888568, roughness: 1 });
  for (let i = 0; i < 15; i++) {
    const row = Math.floor(i / 5),
      col = i % 5;
    const bag = box(
      root,
      -8 + col * 0.8 + (row % 2) * 0.3,
      0.22 + row * 0.35,
      -3,
      0.83,
      0.38,
      0.62,
      bagMat,
    );
    bag.rotation.y = 0.07 * Math.sin(i);
  }
  for (const [x, z] of [
    [-8, 10],
    [14, -15],
    [19, 22],
  ]) {
    box(root, x, 0.6, z, 1.2, 1.2, 1.2, timber);
    for (const y of [0.1, 1.1]) box(root, x, y, z + 0.615, 1.24, 0.1, 0.06, metal);
  }
  return root;
}

export interface DroneModel {
  root: THREE.Group;
  body: THREE.Group;
  rotors: THREE.Group[];
}

export function createDroneModel(): DroneModel {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    rotors: THREE.Group[] = [];
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const droneMaterial = new THREE.MeshStandardMaterial({
    color: 0x202925,
    metalness: 0.55,
    roughness: 0.55,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222823, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x4a5149,
    roughness: 0.75,
    metalness: 0.45,
  });
  const box = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  };
  root.add(body);
  box(body, 0, 0, 0, 0.33, 0.14, 0.43, droneMaterial);
  box(body, 0, -0.1, -0.22, 0.13, 0.1, 0.1, dark);
  const arm1 = box(body, 0, 0, 0, 1.1, 0.055, 0.055, metal);
  arm1.rotation.y = Math.PI / 4;
  const arm2 = arm1.clone();
  arm2.rotation.y = -Math.PI / 4;
  body.add(arm2);
  for (const x of [-0.37, 0.37])
    for (const z of [-0.37, 0.37]) {
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10), metal);
      motor.position.set(x, 0.05, z);
      body.add(motor);
      const rotor = new THREE.Group();
      rotor.position.set(x, 0.13, z);
      body.add(rotor);
      box(rotor, 0, 0, 0, 0.46, 0.008, 0.036, dark);
      box(rotor, 0, 0, 0, 0.035, 0.008, 0.46, dark);
      rotors.push(rotor);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.24, 20),
        new THREE.MeshBasicMaterial({
          color: 0xadb4a7,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.13, z);
      body.add(disc);
    }
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff773e }),
  );
  led.position.set(0, 0.07, -0.23);
  body.add(led);
  const payload = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 9), dark);
  payload.rotation.x = Math.PI / 2;
  payload.position.set(0, -0.13, 0.04);
  body.add(payload);
  return { root, body, rotors };
}
