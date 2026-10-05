import type { Station, StationSpriteKind } from '../../data/types';

/**
 * 駅ごとの乗客。
 * 大きな駅ほどたくさん乗り、無人駅は数人。
 * 「何人のせて走ったか」を記録に残すための仕組み。
 */
const BOARDING: Readonly<Record<StationSpriteKind, [number, number]>> = {
  shinkansen: [45, 90],
  terminal: [18, 40],
  urban: [10, 22],
  'tram-stop': [4, 11],
  rural: [3, 9],
  unmanned: [1, 4],
};

const DEFAULT_RANGE: [number, number] = [3, 9];

export interface Boarding {
  /** 乗った人数。 */
  on: number;
  /** 降りた人数。 */
  off: number;
}

/**
 * その駅での乗り降り。
 * ノーミスで打てた駅は「気持ちよく発車できた」ぶんだけ多めに乗る。
 */
export function boardingAt(
  station: Station,
  onboard: number,
  noMiss: boolean,
  rand: () => number = Math.random,
): Boarding {
  const [lo, hi] = BOARDING[station.sprite ?? 'rural'] ?? DEFAULT_RANGE;
  let on = lo + Math.floor(rand() * (hi - lo + 1));
  if (noMiss) on += Math.max(1, Math.round(on * 0.25));
  // 降りる人は今乗っている人数の一部。乗っていなければ降りられない
  const off = Math.min(onboard, Math.floor(rand() * Math.max(1, Math.round(onboard * 0.3))));
  return { on, off };
}
