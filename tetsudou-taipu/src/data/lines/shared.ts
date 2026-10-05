import type { SceneKind, Segment, StationId } from '../types';

/**
 * 駅列と起点からの累計キロから segments を組み立てる。
 * 全路線で使い回す（各路線ファイルで同じ関数を書かない）。
 */
export function buildSegments(
  stops: readonly StationId[],
  kmFromOrigin: readonly number[],
  scenes: readonly SceneKind[],
): Segment[] {
  return stops.slice(1).map((to, i) => ({
    from: stops[i]!,
    to,
    km: Number((kmFromOrigin[i + 1]! - kmFromOrigin[i]!).toFixed(1)),
    scene: scenes[i]!,
  }));
}
