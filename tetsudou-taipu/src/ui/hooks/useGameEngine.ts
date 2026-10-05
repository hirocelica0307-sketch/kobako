import { useSyncExternalStore } from 'react';
import type { GameEngine, Snapshot } from '../../engine/game/engine';

/** エンジンのスナップショットを購読する。毎フレームではなく、打鍵・遷移・100ms ごとに更新される。 */
export function useEngineSnapshot(engine: GameEngine): Snapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
