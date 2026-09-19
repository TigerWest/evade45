export type Mode = 'foot' | 'bike' | 'armor';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameStatus = 'ready' | 'playing' | 'paused' | 'lost' | 'won';
export type DronePhase = 'approach' | 'commit' | 'pass' | 'dead';

export interface GameInput {
  forward?: number;
  right?: number;
  boost?: boolean;
  jump?: boolean;
}

export interface PlayerState {
  x: number; z: number; y: number; vx: number; vz: number; speed: number;
  yaw: number; bodyYaw: number; pitch: number; energy: number; health: number;
  invulnerable: number; boosting: boolean; exhausted: boolean; altitude: number;
  verticalSpeed: number; jumpHeld: boolean; jumpCooldown: number; landing: number;
  dodgeX: number; dodgeZ: number;
}

export interface DroneState {
  id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  age: number; phase: DronePhase; roll: number; pitch?: number; closest: number; passed: boolean;
}

export interface ExplosionState {x: number; y: number; z: number; age: number; seed: number}
export interface PassState {time: number; side: number; gap: number; speed: number}

export interface GameState {
  mode: Mode; difficulty: Difficulty; status: GameStatus; elapsed: number; distance: number;
  dodges: number; nearMisses: number; random: () => number; nextDrone: number; nextId: number;
  drones: DroneState[]; explosions: ExplosionState[]; nearest: number; threat: number;
  damageCount: number; lastHit: string; collision: number; boundary: boolean; passCount: number;
  lastPass: PassState | null; peakDroneSpeed: number; player: PlayerState;
}

export interface ModeConfig {speed: number; boost: number; response: number; radius: number; health: number; eye: number}
export interface DifficultyConfig {speed: number; acceleration: number; turnAcceleration: number; commitDistance: number; interval: number; max: number; source: string}
export interface Obstacle {x: number; z: number; w: number; d: number; h: number; kind?: 'house' | 'ruin' | 'shed' | 'wall' | 'car'}
