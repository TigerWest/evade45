# React Three Fiber Scene Architecture Refactor Implementation Plan

> **For agentic workers:** Execute inline in this session. Keep the pure game engine unchanged and verify each scene module through type checking, existing regression tests, and a production build.

**Goal:** Replace the imperative `createWorld(scene, camera)` bridge with a declarative React Three Fiber scene whose modules own their objects, animation, and cleanup.

**Architecture:** `GameCanvas` owns only renderer configuration and composes `GameScene`. `GameScene` advances the pure game engine, while focused scene modules own environment, battlefield, cockpit/camera, drones, and combat effects. Procedural Three.js construction remains behind small model-factory interfaces where JSX would obscure rather than clarify the geometry.

**Tech Stack:** React 19, TypeScript 5, React Three Fiber 9, Three.js 0.186, Vitest 3, Vite 7.

## Global Constraints

- Preserve the current game rules, controls, modes, difficulty settings, audio events, and visual content.
- Do not add a scene-state library or another rendering dependency.
- React Three Fiber must own scene composition and frame callbacks.
- Custom geometries, materials, and textures created outside JSX must be disposed on unmount.

---

### Task 1: Establish the R3F scene seam

**Files:**

- Create: `src/components/scene/GameScene.tsx`
- Modify: `src/components/GameCanvas.tsx`

**Interfaces:**

- Consumes: mutable `GameState`, `GameInput`, reduced-motion refs, and the existing `onFrame` callback.
- Produces: `GameScene(props): ReactNode`, the single declarative child of `Canvas`.

- [x] **Step 1: Move simulation stepping into `GameScene`.**

```tsx
useFrame(({ clock }, delta) => {
  stepGame(gameRef.current, inputRef.current, delta);
  onFrame(gameRef.current, clock.elapsedTime);
}, -100);
```

- [x] **Step 2: Replace `SceneBridge` and `useThree` world creation with `<GameScene {...props} />`.**

- [x] **Step 3: Run `npm run typecheck`; expect exit code 0.**

### Task 2: Separate static and animated scene modules

**Files:**

- Create: `src/components/scene/Environment.tsx`
- Create: `src/components/scene/Battlefield.tsx`
- Create: `src/components/scene/resources.ts`
- Modify: `src/game/world.ts`

**Interfaces:**

- Produces: `Environment`, `Battlefield`, `createBattlefield(): THREE.Group`, and `disposeObjectTree(root): void`.
- Invariant: model factories return detached object trees and never mutate a `THREE.Scene`.

- [x] **Step 1: Render background, fog, lights, sky, sun, smoke, and dust as an `Environment` JSX subtree.**

- [x] **Step 2: Extract terrain and scenery creation into detached `createBattlefield()` output.**

- [x] **Step 3: Mount the battlefield through a memoized `<primitive>` and dispose its resources on unmount.**

```tsx
const battlefield = useMemo(createBattlefield, []);
useEffect(() => () => disposeObjectTree(battlefield), [battlefield]);
return <primitive object={battlefield} />;
```

- [x] **Step 4: Run `npm test -- --run` and `npm run typecheck`; expect all tests and type checking to pass.**

### Task 3: Give dynamic systems independent frame ownership

**Files:**

- Create: `src/components/scene/PlayerRig.tsx`
- Create: `src/components/scene/DroneField.tsx`
- Create: `src/components/scene/CombatEffects.tsx`
- Modify: `src/game/cockpit.ts`
- Modify: `src/game/world.ts`
- Modify: `tests/cockpit.test.ts`

**Interfaces:**

- Produces: `createCockpit(): {cameraRoot, vehicleRoot, motion, update, destroy}`, `createDroneModel()`, and focused R3F scene modules.
- Invariant: cockpit construction returns detached roots; `PlayerRig` mounts the camera root with an R3F portal and the vehicle root in the scene.

- [x] **Step 1: Remove scene/camera mutation from `createCockpit` and expose detached roots.**

- [x] **Step 2: Move camera and cockpit animation into `PlayerRig.useFrame`.**

- [x] **Step 3: Move drone pooling/showcase animation into `DroneField.useFrame`.**

- [x] **Step 4: Move explosion flash and spark animation into `CombatEffects.useFrame`.**

- [x] **Step 5: Update cockpit fixtures to mount the returned roots explicitly.**

- [x] **Step 6: Run `npm test -- --run`; expect 46 or more passing tests.**

### Task 4: Verify architecture and runtime output

**Files:**

- Modify: `README.md`
- Test: `tests/*.test.ts`, `tests/*.test.tsx`

**Interfaces:**

- Consumes: the completed declarative scene tree.
- Produces: documented module ownership and verified production output.

- [x] **Step 1: Update README scene-module descriptions.**

- [x] **Step 2: Confirm `src/game/world.ts` contains no `scene.add`, camera mutation, renderer ownership, or animation loop.**

- [x] **Step 3: Run `npm test -- --run`, `npm run typecheck`, and `npm run build`; expect successful exits.**

- [x] **Step 4: Open the local build and visually confirm the menu scene and an active run render without console/runtime errors.**

## Self-Review

- Spec coverage: the plan replaces the imperative scene bridge, localizes `useFrame`, preserves procedural geometry, and retains behavior.
- Placeholder scan: every task names concrete files, interfaces, commands, and expected results.
- Type consistency: `GameState` and `GameInput` remain the shared engine contracts; scene modules receive refs to them and do not duplicate game state.
