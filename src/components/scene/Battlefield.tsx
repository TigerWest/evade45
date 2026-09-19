import { useEffect, useMemo } from 'react';
import { createBattlefield } from '../../game/world';
import { disposeObjectTree } from './resources';

export function Battlefield() {
  const battlefield = useMemo(createBattlefield, []);
  useEffect(() => () => disposeObjectTree(battlefield), [battlefield]);
  return <primitive object={battlefield} />;
}
