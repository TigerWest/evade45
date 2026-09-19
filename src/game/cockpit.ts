// Low-level procedural model factory. R3F owns where both detached roots live.
import * as THREE from 'three';
import type { GameState } from './types';
import { clamp, angleDifference, seededRandom } from './engine.js';

// Hands follow the camera on foot; vehicles belong to the world and follow the chassis.
type Point3 = readonly [number, number, number] | number[];
type ViewMode = 'foot' | 'bike' | 'armor';
interface Gauge {
  needle: THREE.Group;
  max: number;
}

export function createCockpit() {
  const root = new THREE.Group();
  const vehicle = new THREE.Group();
  const views = Object.fromEntries(
    (['foot', 'bike', 'armor'] as ViewMode[]).map((mode) => {
      const g = new THREE.Group();
      (mode === 'foot' ? root : vehicle).add(g);
      return [mode, g];
    }),
  ) as Record<ViewMode, THREE.Group>;
  const random = seededRandom(412),
    textures: THREE.CanvasTexture[] = [];
  function surface(base: string, fabric = false): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1900; i++) {
      ctx.fillStyle = random() > 0.5 ? '#ffffff12' : '#00000018';
      ctx.fillRect(random() * 128, random() * 128, fabric ? 1 : random() * 5 + 1, 1);
    }
    if (fabric) {
      ctx.strokeStyle = '#00000012';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 128; i += 3) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 128);
        ctx.moveTo(0, i);
        ctx.lineTo(128, i);
        ctx.stroke();
      }
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    return map;
  }
  const mat = (
    color: THREE.ColorRepresentation,
    roughness = 0.8,
    metalness = 0,
    map: THREE.Texture | null = null,
  ) => new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
  const paint = mat(0xffffff, 0.72, 0.35, surface('#485341'));
  const edge = mat(0x77816c, 0.66, 0.5),
    steel = mat(0x9a9d90, 0.4, 0.75),
    black = mat(0x171e1c, 0.8, 0.15);
  const rubber = mat(0x242622, 0.96),
    cloth = mat(0xffffff, 1, 0, surface('#505742', true));
  const seam = mat(0x737760, 1),
    leather = mat(0xffffff, 0.93, 0, surface('#484536', true));
  const skin = mat(0xb88e70, 0.92),
    nail = mat(0xc4a28b, 0.72),
    crease = mat(0x80604a, 1);
  const amber = new THREE.MeshStandardMaterial({
    color: 0xd5a55e,
    emissive: 0x986223,
    emissiveIntensity: 0.4,
  });
  const red = mat(0x9e493b),
    glass = mat(0x91a8a1, 0.2, 0.65);
  const cube = new THREE.BoxGeometry(1, 1, 1),
    sphere = new THREE.SphereGeometry(1, 16, 12);
  const rods = new Map<string, THREE.CylinderGeometry>(),
    rings = new Map<string, THREE.TorusGeometry>();
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const m = mesh(parent, cube, material, x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  function oval(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const m = mesh(parent, sphere, material, x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  function rod(
    parent: THREE.Object3D,
    a: Point3,
    b: Point3,
    r: number,
    material: THREE.Material,
    r2 = r,
  ): THREE.Mesh {
    const key = `${r}:${r2}`;
    if (!rods.has(key)) rods.set(key, new THREE.CylinderGeometry(r2, r, 1, 16));
    const start = new THREE.Vector3(a[0], a[1], a[2]),
      end = new THREE.Vector3(b[0], b[1], b[2]),
      delta = end.clone().sub(start);
    const m = mesh(parent, rods.get(key)!, material);
    m.position.copy(start.add(end).multiplyScalar(0.5));
    m.scale.y = delta.length();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return m;
  }
  function ring(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    t: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const key = `${r}:${t}`;
    if (!rings.has(key)) rings.set(key, new THREE.TorusGeometry(r, t, 8, 40));
    return mesh(parent, rings.get(key)!, material, x, y, z);
  }
  function cable(
    parent: THREE.Object3D,
    points: Point3[],
    r = 0.006,
    material: THREE.Material = black,
  ): THREE.Mesh {
    return mesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))),
        16,
        r,
        5,
        false,
      ),
      material,
    );
  }
  function bolt(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.009): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    rod(g, [0, 0, -0.005], [0, 0, 0.005], r, steel);
    box(g, 0, 0, 0.0055, r * 1.05, 0.002, 0.0015, black);
    return g;
  }
  function plate(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number) {
    box(parent, x, y, z, w, h, 0.018, black);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        bolt(parent, x + sx * (w / 2 - 0.02), y + sy * (h / 2 - 0.02), z + 0.014, 0.006);
  }
  function label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    color = '#b6bba1',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 30px monospace';
    ctx.fillText(text, 256, 32);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    return mesh(
      parent,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
      x,
      y,
      z,
    );
  }
  function hand(
    parent: THREE.Object3D,
    side: number,
    x: number,
    y: number,
    z: number,
    grip = false,
  ): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    const wrist = [0, -0.018, 0.095],
      elbow = [side * 0.14, -0.34, 0.43];
    rod(g, elbow, wrist, 0.083, cloth, 0.049);
    // Raised cloth folds, cuff binding, stitching, and a small wrist closure.
    for (const t of [0.25, 0.48, 0.72, 0.9]) {
      const a = new THREE.Vector3(...elbow).lerp(new THREE.Vector3(...wrist), t),
        b = a.clone().add(new THREE.Vector3(-side * 0.004, 0.012, -0.018));
      rod(g, a.toArray(), b.toArray(), 0.083 - 0.034 * t + 0.003, cloth, 0.083 - 0.034 * t);
    }
    rod(g, [0, -0.024, 0.115], [0, -0.015, 0.071], 0.053, leather, 0.049);
    rod(g, [side * 0.042, 0.002, 0.103], [side * 0.095, -0.15, 0.27], 0.002, seam);
    box(g, side * 0.024, 0.03, 0.09, 0.038, 0.012, 0.032, black);
    box(g, side * 0.024, 0.037, 0.09, 0.025, 0.003, 0.015, edge);
    const wristJoint = new THREE.Group(),
      palm = new THREE.Group();
    g.add(wristJoint);
    wristJoint.add(palm);
    wristJoint.position.set(0, -0.015, 0.071);
    palm.position.set(0, 0.015, -0.071);
    g.userData.wrist = wristJoint;
    oval(palm, 0, 0, 0.006, 0.064, 0.032, 0.07, leather);
    oval(palm, 0, 0.023, -0.004, 0.049, 0.015, 0.045, leather);
    // Four separately bent fingers, exposed knuckles, nail beds and flexion lines.
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) * 0.028,
        len = [0.064, 0.076, 0.07, 0.052][i],
        r = [0.014, 0.015, 0.014, 0.012][i];
      const pts: [number, number, number][] = grip
        ? [
            [fx, 0.006, -0.04],
            [fx, 0.006, -0.04 - len * 0.55],
            [fx, -0.032, -0.047 - len * 0.6],
            [fx, -0.05, -0.039],
          ]
        : [
            [fx, 0.01, -0.04],
            [fx, 0.004, -0.04 - len * 0.65],
            [fx, -0.022, -0.043 - len],
            [fx, -0.045, -0.036 - len * 0.72],
          ];
      for (let j = 0; j < 3; j++) {
        rod(palm, pts[j], pts[j + 1], r, skin, r * 0.92);
        oval(palm, ...pts[j], r, r * 0.95, r, skin);
      }
      oval(palm, ...pts[3], r * 0.91, r * 0.86, r * 0.92, skin);
      const knuckle = pts[1];
      rod(
        palm,
        [fx - r * 0.6, knuckle[1] + r * 0.9, knuckle[2]],
        [fx + r * 0.6, knuckle[1] + r * 0.9, knuckle[2]],
        0.0014,
        crease,
      );
      const tip = pts[3];
      oval(palm, fx, tip[1] + r * 0.55, tip[2] - 0.004, r * 0.57, 0.0025, 0.009, nail);
      oval(palm, fx, 0.03, -0.03, 0.012, 0.008, 0.017, edge);
    }
    const thumb: [number, number, number][] = [
      [-side * 0.05, -0.009, 0.02],
      [-side * 0.078, -0.026, -0.012],
      [-side * 0.072, -0.05, -0.04],
      [-side * 0.041, -0.054, -0.056],
    ];
    for (let i = 0; i < 3; i++) {
      rod(palm, thumb[i], thumb[i + 1], 0.018 - i * 0.001, skin);
      oval(palm, ...thumb[i], 0.019, 0.018, 0.019, skin);
    }
    oval(palm, ...thumb[3], 0.015, 0.014, 0.017, skin);
    for (const sideX of [-1, 1])
      rod(palm, [sideX * 0.047, 0.026, 0.035], [sideX * 0.047, 0.028, -0.014], 0.0017, seam);
    return g;
  }
  // Anchor each arm at the shoulder and elbow; the wrist adds a small delayed
  // rotation. Moving the joints keeps the sleeve attached instead of sliding a fist.
  const footArms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group(),
      elbow = new THREE.Group();
    views.foot.add(shoulder);
    shoulder.add(elbow);
    shoulder.position.set(side * 0.43, -0.22, 0.09);
    elbow.position.set(0, -0.28, 0);
    rod(shoulder, [0, 0, 0], [0, -0.28, 0], 0.087, cloth, 0.078);
    oval(shoulder, 0, -0.28, 0, 0.08, 0.084, 0.08, cloth);
    const fist = hand(elbow, side, -side * 0.14, 0.34, -0.43);
    elbow.rotation.x = -0.74;
    fist.userData.wrist.rotation.z = -side * 0.5;
    return { side, shoulder, elbow, wrist: fist.userData.wrist };
  });
  const motion = { bob: 0, roll: 0 };
  let gaitPhase = 0,
    gaitWeight = 0,
    sprintWeight = 0,
    airWeight = 0,
    strafe = 0,
    lookLag = 0,
    lastLook = 0,
    animationGame: GameState | null = null;

  // Dials use one static face texture; only the needle moves at runtime.
  function gauge(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    max: number,
    unit: string,
  ): Gauge {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    rod(g, [0, 0, -0.035], [0, 0, 0], r * 1.1, black);
    ring(g, 0, 0, 0.005, r, 0.007, steel);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#172320';
    ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    for (let i = 0; i <= 40; i++) {
      const a = ((-225 + (i / 40) * 270) * Math.PI) / 180,
        major = i % 5 === 0;
      ctx.strokeStyle = i > 32 ? '#b7684d' : '#d4d9bc';
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (major ? 87 : 94), Math.sin(a) * (major ? 87 : 94));
      ctx.lineTo(Math.cos(a) * 105, Math.sin(a) * 105);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#d4d9bc';
        ctx.font = '17px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.round((i / 40) * max)), Math.cos(a) * 70, Math.sin(a) * 70);
      }
    }
    ctx.font = '14px monospace';
    ctx.fillStyle = '#a3b69d';
    ctx.fillText(unit, 0, 42);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    mesh(
      g,
      new THREE.CircleGeometry(r * 0.96, 40),
      new THREE.MeshBasicMaterial({ map }),
      0,
      0,
      0.008,
    );
    const needle = new THREE.Group();
    needle.position.z = 0.016;
    g.add(needle);
    box(needle, r * 0.31, 0, 0, r * 0.76, 0.005, 0.004, amber);
    oval(g, 0, 0, 0.02, 0.012, 0.012, 0.006, steel);
    needle.rotation.z = Math.PI * 1.25;
    return { needle, max };
  }
  const bike = views.bike,
    bar = new THREE.Group();
  bike.add(bar);
  bar.name = 'handlebars';
  bar.position.set(0, -0.39, -0.66);
  // Sculpted fuel tank and cap, with a center seam and knee panels.
  oval(bike, 0, -0.78, -0.48, 0.22, 0.2, 0.42, paint);
  oval(bike, 0, -0.625, -0.57, 0.16, 0.065, 0.27, paint);
  for (const s of [-1, 1]) oval(bike, s * 0.18, -0.78, -0.44, 0.048, 0.13, 0.26, rubber);
  rod(bike, [0, -0.56, -0.56], [0, -0.545, -0.56], 0.056, steel);
  const cap = ring(bike, 0, -0.54, -0.56, 0.043, 0.005, black);
  cap.rotation.x = -Math.PI / 2;
  box(bike, 0, -0.533, -0.56, 0.041, 0.008, 0.013, steel);
  cable(
    bar,
    [
      [-0.48, 0, 0.04],
      [-0.27, 0, 0],
      [-0.18, -0.048, -0.04],
      [0.18, -0.048, -0.04],
      [0.27, 0, 0],
      [0.48, 0, 0.04],
    ],
    0.02,
    steel,
  );
  box(bar, 0, -0.056, -0.025, 0.25, 0.035, 0.09, paint);
  for (const s of [-1, 1]) {
    box(bar, s * 0.075, -0.032, -0.02, 0.043, 0.025, 0.066, black);
    bolt(bar, s * 0.075, -0.017, 0.017);
    rod(bar, [s * 0.29, 0, 0.015], [s * 0.49, 0, 0.045], 0.03, rubber);
    for (let i = 0; i < 11; i++) {
      const x = s * (0.315 + i * 0.015);
      rod(bar, [x, 0, 0.02], [x + s * 0.004, 0, 0.02], 0.032, black);
    }
    box(bar, s * 0.275, 0.002, 0.01, 0.058, 0.066, 0.059, black);
    box(bar, s * 0.275, 0.036, 0.012, 0.019, 0.009, 0.027, s > 0 ? red : edge);
    rod(bar, [s * 0.28, -0.027, -0.04], [s * 0.48, -0.027, -0.045], 0.008, steel);
    oval(bar, s * 0.48, -0.027, -0.045, 0.013, 0.012, 0.012, steel);
    cable(
      bar,
      [
        [s * 0.255, -0.01, -0.03],
        [s * 0.24, -0.1, -0.1],
        [s * 0.12, -0.18, -0.03],
        [s * 0.1, -0.3, 0.05],
      ],
      0.007,
    );
    rod(bar, [s * 0.27, 0.02, -0.02], [s * 0.46, 0.24, -0.13], 0.009, black);
    const mirror = new THREE.Group();
    mirror.position.set(s * 0.47, 0.25, -0.13);
    mirror.rotation.y = -s * 0.18;
    bar.add(mirror);
    oval(mirror, 0, 0, 0, 0.105, 0.059, 0.018, black);
    oval(mirror, 0, 0, 0.014, 0.093, 0.048, 0.007, glass);
    // A subtle horizon highlight suggests glass without a second scene render.
    rod(mirror, [-0.067, 0.018, 0.019], [0.053, 0.025, 0.019], 0.0025, edge);
    hand(bar, s, s * 0.383, 0.027, 0.052, true);
  }
  const bikeCluster = new THREE.Group();
  bikeCluster.position.set(0, 0.026, -0.105);
  bikeCluster.rotation.x = -0.3;
  bar.add(bikeCluster);
  const bikeSpeed = gauge(bikeCluster, 0, 0, 0, 0.085, 100, 'km/h');
  plate(bikeCluster, 0.14, -0.025, -0.007, 0.09, 0.09);
  const neutral = label(bikeCluster, 'N', 0.14, -0.015, 0.013, 0.035, 0.023, '#98bf8f');
  for (let i = 0; i < 3; i++)
    oval(
      bikeCluster,
      0.112 + i * 0.027,
      -0.054,
      0.009,
      0.006,
      0.005,
      0.003,
      i === 0 ? amber : edge,
    );

  const armor = views.armor;
  // Sloped hood, welded panel seams and fasteners remain below the sight line.
  box(armor, 0, -0.79, -1.55, 3.2, 0.3, 2.6, paint);
  const hood = box(armor, 0, -0.54, -2.02, 2.8, 0.085, 1.3, paint);
  hood.rotation.x = 0.09;
  for (const s of [-1, 1]) {
    box(armor, s * 0.68, -0.472, -2.08, 0.012, 0.008, 1.08, black);
    for (let i = 0; i < 5; i++) {
      const b = bolt(armor, s * 0.68, -0.463, -2.5 + i * 0.22);
      b.rotation.x = -Math.PI / 2;
    }
    box(armor, s * 1.02, 0.015, -1.25, 0.13, 1.37, 0.2, paint);
    box(armor, s * 0.952, 0.012, -1.135, 0.018, 1.15, 0.018, rubber);
    for (const y of [-0.43, -0.12, 0.19, 0.5]) bolt(armor, s * 1.02, y, -1.14, 0.014);
    box(armor, s * 1.25, -0.4, -1.55, 0.22, 0.24, 1.55, paint);
    rod(armor, [s * 0.78, -0.46, -2.44], [s * 0.78, -0.38, -2.44], 0.015, steel);
    rod(armor, [s * 0.78, -0.38, -2.44], [s * 0.78, -0.38, -2.16], 0.015, steel);
    rod(armor, [s * 0.78, -0.38, -2.16], [s * 0.78, -0.46, -2.16], 0.015, steel);
    // Window latch and lower-edge wiper, kept out of the central view.
    box(armor, s * 0.92, -0.17, -1.13, 0.08, 0.035, 0.05, black);
    rod(armor, [s * 0.82, -0.39, -1.25], [s * 0.4, -0.31, -1.27], 0.009, black);
    rod(armor, [s * 0.53, -0.335, -1.275], [s * 0.2, -0.29, -1.275], 0.012, rubber);
  }
  box(armor, 0, 0.66, -1.25, 2.16, 0.18, 0.22, paint);
  box(armor, 0, 0.555, -1.13, 1.91, 0.018, 0.03, rubber);
  for (let i = 0; i < 9; i++) box(armor, 0.78 + i * 0.06, -0.49, -2.01, 0.025, 0.014, 0.36, black);
  const dash = new THREE.Group();
  dash.position.set(0, -0.48, -1.02);
  dash.rotation.x = -0.12;
  armor.add(dash);
  box(dash, 0, 0, 0, 1.9, 0.3, 0.19, paint);
  box(dash, 0, 0.15, 0.075, 1.96, 0.047, 0.14, rubber);
  plate(dash, -0.27, 0.01, 0.109, 0.67, 0.235);
  const armorSpeed = gauge(dash, -0.43, 0.025, 0.133, 0.082, 60, 'km/h');
  const armorPower = gauge(dash, -0.22, 0.025, 0.133, 0.067, 100, '%');
  label(dash, '01 / DRIVE', -0.3, -0.086, 0.125, 0.26, 0.023);
  plate(dash, 0.38, 0.01, 0.108, 0.5, 0.23);
  for (let i = 0; i < 4; i++) {
    const x = 0.215 + i * 0.106;
    ring(dash, x, -0.027, 0.13, 0.024, 0.004, steel);
    rod(dash, [x, -0.027, 0.127], [x, -0.007, 0.17], 0.006, steel);
    oval(dash, x, 0.059, 0.125, 0.013, 0.008, 0.006, i === 0 ? amber : edge);
  }
  label(dash, 'AUX / LIGHT / VENT', 0.38, -0.076, 0.127, 0.4, 0.021);
  for (const s of [-1, 1])
    for (let i = 0; i < 5; i++)
      box(dash, s * 0.8, 0.087 - i * 0.034, 0.111, 0.16, 0.011, 0.009, black);
  const wheel = new THREE.Group();
  wheel.position.set(0, -0.34, -0.72);
  wheel.rotation.x = -0.25;
  armor.add(wheel);
  const wheelTurn = new THREE.Group();
  wheel.add(wheelTurn);
  wheelTurn.name = 'steering-wheel';
  ring(wheelTurn, 0, 0, 0, 0.215, 0.021, rubber);
  ring(wheelTurn, 0, 0, -0.009, 0.215, 0.005, edge);
  for (const a of [0, Math.PI, Math.PI * 1.5])
    rod(wheelTurn, [0, 0, -0.01], [Math.cos(a) * 0.2, Math.sin(a) * 0.2, -0.003], 0.014, steel);
  oval(wheelTurn, 0, 0, 0.009, 0.063, 0.047, 0.03, black);
  bolt(wheelTurn, 0, 0, 0.04, 0.013);
  for (const s of [-1, 1]) hand(wheelTurn, s, s * 0.203, 0.018, 0.052, true);
  rod(armor, [0.52, -0.85, -0.59], [0.48, -0.52, -0.72], 0.015, steel);
  oval(armor, 0.48, -0.51, -0.72, 0.038, 0.033, 0.032, black);

  // A continuous cabin surrounds the eye point. Window apertures remain open
  // for visibility; doors, roof and rear bulkhead are real, two-sided volumes.
  const lining = mat(0x59604e, 0.95),
    seat = mat(0x303a30, 1),
    windowMat = new THREE.MeshStandardMaterial({
      color: 0xa5b5a6,
      roughness: 0.15,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  box(armor, 0, -1.33, 0.2, 2.22, 0.14, 3.08, paint);
  box(armor, 0, 0.69, 0.2, 2.22, 0.12, 3.08, paint);
  box(armor, 0, 0.619, 0.3, 1.97, 0.025, 2.7, lining);
  for (const s of [-1, 1]) {
    // Lower door, padded inner panel, window sill, and rear quarter panel.
    box(armor, s * 1.05, -0.68, -0.23, 0.15, 1.24, 1.98, paint);
    box(armor, s * 0.965, -0.62, -0.22, 0.025, 0.91, 1.65, lining);
    box(armor, s * 0.942, -0.19, -0.25, 0.085, 0.085, 1.75, rubber);
    box(armor, s * 1.05, 0.59, 0.13, 0.15, 0.13, 2.96, paint);
    box(armor, s * 1.05, 0.28, 0.68, 0.15, 0.62, 0.14, paint);
    box(armor, s * 1.05, -0.33, 1.24, 0.15, 1.91, 1.03, paint);
    box(armor, s * 0.962, 0.25, 1.12, 0.026, 0.49, 0.61, lining);
    for (const z of [-1.09, 0.58]) box(armor, s * 0.953, 0.27, z, 0.018, 0.55, 0.027, rubber);
    const pane = mesh(
      armor,
      new THREE.PlaneGeometry(1.65, 0.51),
      windowMat,
      s * 1.012,
      0.27,
      -0.255,
    );
    pane.rotation.y = Math.PI / 2;
    // Armrest, latch, pull handle and hinges face inward, toward the driver.
    box(armor, s * 0.86, -0.51, -0.3, 0.19, 0.1, 0.63, black);
    box(armor, s * 0.916, -0.31, -0.79, 0.06, 0.11, 0.2, black);
    rod(armor, [s * 0.873, -0.29, -0.85], [s * 0.873, -0.29, -0.72], 0.014, steel);
    rod(armor, [s * 0.91, -0.7, 0.19], [s * 0.81, -0.7, 0.19], 0.017, steel);
    rod(armor, [s * 0.81, -0.7, 0.19], [s * 0.81, -0.4, 0.19], 0.017, steel);
    rod(armor, [s * 0.81, -0.4, 0.19], [s * 0.91, -0.4, 0.19], 0.017, steel);
    for (const z of [-0.97, 0.49])
      for (const y of [-1.05, -0.22]) {
        const b = bolt(armor, s * 0.943, y, z, 0.012);
        b.rotation.y = (-s * Math.PI) / 2;
      }
    for (const y of [-0.86, -0.29]) box(armor, s * 0.953, y, 0.56, 0.055, 0.15, 0.08, steel);
    // Roof crossmembers and wiring give side/upward glances a continuous structure.
    rod(armor, [s * 0.93, 0.49, -1.12], [s * 0.93, 0.49, 1.54], 0.016, black);
    box(armor, s * 0.93, 0.59, 0.68, 0.16, 0.12, 0.18, edge);
    const rearSeat = box(armor, s * 0.66, -1.02, 1.07, 0.48, 0.17, 0.81, seat);
    rearSeat.rotation.z = -s * 0.035;
    box(armor, s * 0.91, -0.67, 1.08, 0.11, 0.63, 0.85, seat);
    for (let i = 0; i < 4; i++)
      box(armor, s * 0.66, -0.929, 0.8 + i * 0.18, 0.43, 0.008, 0.008, black);
    rod(armor, [s * 0.92, -1.23, 0.8], [s * 0.92, -1.23, 1.4], 0.027, steel);
  }
  // Rear wall with an inset inspection window and a latched equipment locker.
  box(armor, 0, -0.59, 1.73, 2.22, 1.48, 0.13, paint);
  box(armor, 0, 0.54, 1.73, 2.22, 0.3, 0.13, paint);
  for (const s of [-1, 1]) box(armor, s * 0.735, 0.265, 1.73, 0.75, 0.25, 0.13, paint);
  box(armor, 0, 0.13, 1.64, 0.76, 0.035, 0.055, rubber);
  box(armor, 0, 0.4, 1.64, 0.76, 0.035, 0.055, rubber);
  for (const s of [-1, 1]) box(armor, s * 0.38, 0.265, 1.64, 0.035, 0.3, 0.055, rubber);
  mesh(armor, new THREE.PlaneGeometry(0.72, 0.23), windowMat, 0, 0.265, 1.715);
  const locker = new THREE.Group();
  locker.position.set(0, -0.66, 1.6);
  locker.rotation.y = Math.PI;
  armor.add(locker);
  plate(locker, 0, 0, 0, 0.67, 0.57);
  label(locker, 'STOWAGE', 0, 0.16, 0.014, 0.37, 0.038);
  box(locker, 0, -0.04, 0.035, 0.16, 0.045, 0.05, steel);
  for (const x of [-0.25, 0.25]) box(locker, x, 0, 0.018, 0.022, 0.46, 0.016, edge);
  // Driver seat behind/below the camera, with a headrest, belt and seat rails.
  box(armor, 0, -1.03, 0.13, 0.57, 0.16, 0.72, seat);
  const backrest = box(armor, 0, -0.56, 0.53, 0.59, 0.88, 0.16, seat);
  backrest.rotation.x = 0.07;
  for (const x of [-0.13, 0.13]) rod(armor, [x, -0.16, 0.53], [x, 0.12, 0.55], 0.012, steel);
  box(armor, 0, 0.16, 0.55, 0.36, 0.2, 0.13, seat);
  for (const x of [-0.2, 0.2]) rod(armor, [x, -1.24, -0.13], [x, -1.24, 0.59], 0.023, steel);
  rod(armor, [-0.27, -0.16, 0.425], [0.24, -0.91, 0.45], 0.021, black);
  box(armor, 0.25, -0.94, 0.05, 0.06, 0.1, 0.055, red);
  // Roof hatch rim, latch, braces and a restrained interior lamp.
  for (const x of [-0.4, 0.4]) box(armor, x, 0.584, 0.25, 0.045, 0.045, 0.95, black);
  for (const z of [-0.225, 0.725]) box(armor, 0, 0.584, z, 0.84, 0.045, 0.045, black);
  box(armor, 0, 0.59, 0.25, 0.72, 0.025, 0.85, paint);
  rod(armor, [-0.13, 0.554, 0.52], [0.13, 0.554, 0.52], 0.014, steel);
  for (const z of [-0.92, 1.33]) box(armor, 0, 0.56, z, 2.04, 0.1, 0.085, edge);
  box(armor, 0.65, 0.56, 0.98, 0.24, 0.075, 0.15, black);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xd8cda7,
    emissive: 0xd8cda7,
    emissiveIntensity: 0.6,
  });
  box(armor, 0.65, 0.516, 0.98, 0.18, 0.018, 0.1, lampMat);
  const cabinLight = new THREE.PointLight(0xffe2b4, 0.55, 2.8, 2);
  cabinLight.position.set(0.65, 0.45, 0.98);
  armor.add(cabinLight);

  let active = '',
    lastYaw: number | null = null,
    steer = 0;
  function update(game: GameState, time: number, dt: number, reduced: boolean) {
    const p = game.player;
    if (active !== game.mode || animationGame !== game) {
      for (const [mode, g] of Object.entries(views)) g.visible = mode === game.mode;
      active = game.mode;
      lastYaw = null;
      steer = 0;
      animationGame = game;
      gaitPhase = gaitWeight = sprintWeight = airWeight = strafe = lookLag = 0;
      lastLook = p.yaw;
      motion.bob = motion.roll = 0;
    }
    root.visible = vehicle.visible = game.status !== 'ready';
    vehicle.position.set(p.x, p.y, p.z);
    vehicle.rotation.set(0, p.bodyYaw, 0);
    const moving = clamp(Math.abs(p.speed) / 4, 0, 1);
    const yawRate =
      lastYaw === null || dt <= 0 || game.status !== 'playing'
        ? 0
        : angleDifference(p.bodyYaw, lastYaw) / dt;
    // Positive yaw is a left turn; reversing flips chassis yaw, not the handle.
    const handleRate = yawRate * (p.speed < -0.1 ? -1 : 1);
    lastYaw = p.bodyYaw;
    steer += (clamp(handleRate * 0.23, -0.3, 0.3) - steer) * Math.min(dt * 9, 1);
    if (game.mode === 'foot' && game.status === 'playing') {
      const step = clamp(dt, 0, 0.1),
        blend = 1 - Math.exp(-step * 10),
        speed = Math.abs(p.speed);
      gaitWeight += (clamp(speed / 4.9, 0, 1) - gaitWeight) * blend;
      sprintWeight += (clamp((speed - 4.9) / 3.3, 0, 1) - sprintWeight) * blend;
      airWeight += ((p.altitude > 0.03 ? 1 : 0) - airWeight) * blend;
      const lateral = p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw);
      strafe += (clamp(lateral / 8.2, -1, 1) - strafe) * blend;
      const yawRate = step > 0 ? angleDifference(lastLook, p.yaw) / step : 0;
      lastLook = p.yaw;
      lookLag += (clamp(yawRate * 0.025, -0.045, 0.045) - lookLag) * blend;
      // Continuous phase: changing speed never jumps to a different wall-clock sine.
      gaitPhase =
        (gaitPhase + step * (5.6 + sprintWeight * 2.6) * gaitWeight * (1 - airWeight)) %
        (Math.PI * 2);
      const movement = reduced ? 0 : gaitWeight * (1 - airWeight * 0.85);
      for (const { side, shoulder, elbow, wrist } of footArms) {
        const phase = gaitPhase + (side > 0 ? Math.PI : 0),
          swing = Math.sin(phase),
          follow = Math.sin(phase - 0.45);
        shoulder.rotation.set(
          swing * (0.14 + sprintWeight * 0.1) * movement,
          side * 0.06 + (reduced ? 0 : lookLag),
          -side * (0.025 + sprintWeight * 0.07),
        );
        shoulder.position.x = side * (0.43 - sprintWeight * 0.035) - (reduced ? 0 : strafe * 0.014);
        shoulder.position.y = -0.22 + airWeight * 0.025 - (reduced ? 0 : p.landing * 0.012);
        elbow.rotation.x =
          -0.74 +
          gaitWeight * 0.2 +
          sprintWeight * 0.2 +
          airWeight * 0.15 +
          Math.max(0, follow) * 0.065 * movement;
        wrist.rotation.set(
          -0.07 + follow * 0.035 * movement,
          side * 0.12,
          -side * (0.5 + sprintWeight * 0.12) + follow * 0.025 * movement,
        );
      }
      motion.bob = reduced
        ? 0
        : (Math.cos(gaitPhase * 2) - 1) * (0.004 + sprintWeight * 0.003) * movement;
      motion.roll = reduced ? 0 : Math.sin(gaitPhase) * 0.0018 * movement;
    }
    bar.rotation.y = steer;
    bike.rotation.z = reduced ? 0 : steer * 0.18;
    bike.position.y = reduced ? 0 : Math.sin(time * 28) * moving * 0.003;
    wheelTurn.rotation.z = steer * 1.8;
    neutral.visible = Math.abs(p.speed) < 0.15;
    const readings: [Gauge, number][] = [
      [bikeSpeed, Math.abs(p.speed) * 3.6],
      [armorSpeed, Math.abs(p.speed) * 3.6],
      [armorPower, p.energy],
    ];
    for (const [dial, value] of readings)
      dial.needle.rotation.z = Math.PI * 1.25 - clamp(value / dial.max, 0, 1) * Math.PI * 1.5;
  }
  return {
    cameraRoot: root,
    vehicleRoot: vehicle,
    update,
    motion,
    destroy() {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      for (const group of [root, vehicle])
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            geometries.add(o.geometry);
            for (const material of Array.isArray(o.material) ? o.material : [o.material])
              materials.add(material);
          }
        });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      root.removeFromParent();
      vehicle.removeFromParent();
    },
  };
}
