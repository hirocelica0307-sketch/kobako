import { assertShape, type ShapeDef } from './types';

/**
 * 車輪。走行距離から回転フレームを選ぶので、減速すると回転も遅くなる。
 * K=タイヤ U=輪心 P=スポーク
 */
export const WHEEL_0: ShapeDef = assertShape('WHEEL_0', {
  w: 8,
  h: 8,
  rows: [
    "...KK...",
    ".KKPKKK.",
    ".KUPUUK.",
    "KKUKKUKK",
    "KPPKKPPK",
    ".KUUPUK.",
    ".KKKPKK.",
    "...KK...",
  ],
});

export const WHEEL_1: ShapeDef = assertShape('WHEEL_1', {
  w: 8,
  h: 8,
  rows: [
    "...KK...",
    ".KKKPKK.",
    ".KUUPUK.",
    "KPPKKUKK",
    "KKUKKPPK",
    ".KUPUUK.",
    ".KKPKKK.",
    "...KK...",
  ],
});

export const WHEEL_2: ShapeDef = assertShape('WHEEL_2', {
  w: 8,
  h: 8,
  rows: [
    "...KK...",
    ".KKKKKK.",
    ".KPUUPK.",
    "KKUKKUKK",
    "KKUKKUKK",
    ".KPUUPK.",
    ".KKKKKK.",
    "...KK...",
  ],
});

export const WHEEL_3: ShapeDef = assertShape('WHEEL_3', {
  w: 8,
  h: 8,
  rows: [
    "...KK...",
    ".KKPKKK.",
    ".KUPUUK.",
    "KKUKKPPK",
    "KPPKKUKK",
    ".KUUPUK.",
    ".KKKPKK.",
    "...KK...",
  ],
});

export const WHEEL_FRAMES: readonly ShapeDef[] = [WHEEL_0, WHEEL_1, WHEEL_2, WHEEL_3];
