import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { stepGame } from '../../game/engine';
import type { GameInput, GameState } from '../../game/types';
import { Battlefield } from './Battlefield';
import { CombatEffects } from './CombatEffects';
import { DroneField } from './DroneField';
import { Environment } from './Environment';
import { PlayerRig } from './PlayerRig';

export interface GameSceneProps {
  gameRef: MutableRefObject<GameState>;
  inputRef: MutableRefObject<GameInput>;
  reducedMotionRef: MutableRefObject<boolean>;
  onFrame: (game: GameState, time: number) => void;
}

export function GameScene(props: GameSceneProps) {
  useFrame(({ clock }, delta) => {
    const game = props.gameRef.current;
    stepGame(game, props.inputRef.current, delta);
    props.onFrame(game, clock.elapsedTime);
  }, -100);

  return (
    <>
      <Environment />
      <Battlefield />
      <PlayerRig gameRef={props.gameRef} reducedMotionRef={props.reducedMotionRef} />
      <DroneField gameRef={props.gameRef} />
      <CombatEffects gameRef={props.gameRef} />
    </>
  );
}
