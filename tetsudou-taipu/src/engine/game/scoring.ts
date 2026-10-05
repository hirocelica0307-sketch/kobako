import type { RunStats } from '../typing/stats';
import { accuracy, kpm, totalKeystrokes, wpm } from '../typing/stats';

/** ノーミスで通過した駅1つあたりのボーナス（円）。 */
export const COMBO_BONUS_PER_STATION = 50;

/** 終点到達ボーナスの倍率。 */
export const TERMINAL_BONUS_RATE = 0.2;

export interface RunSummary {
  lineId: string;
  lineName: string;
  trainType: string;
  originKanji: string;
  originKana: string;
  reachedKanji: string;
  reachedKana: string;
  reachedCount: number;
  km: number;
  timeLimit: number;
  elapsedSec: number;
  baseFare: number;
  bonus: number;
  fare: number;
  keystrokes: number;
  correct: number;
  misses: number;
  accuracy: number;
  kpm: number;
  wpm: number;
  maxCombo: number;
  laps: number;
  /** のべ何人のせて走ったか。 */
  passengers: number;
}

export function comboBonus(totalComboStations: number): number {
  return totalComboStations * COMBO_BONUS_PER_STATION;
}

export function terminalBonus(baseFare: number, laps: number): number {
  return Math.round(baseFare * TERMINAL_BONUS_RATE * laps);
}

export function buildSummary(input: {
  lineId: string; lineName: string; trainType: string;
  originKanji: string; originKana: string;
  reachedKanji: string; reachedKana: string;
  reachedCount: number; km: number;
  timeLimit: number; elapsedSec: number;
  baseFare: number; bonus: number;
  stats: RunStats; maxCombo: number; laps: number; passengers: number;
}): RunSummary {
  const { stats, elapsedSec } = input;
  return {
    ...input,
    fare: input.baseFare + input.bonus,
    keystrokes: totalKeystrokes(stats),
    correct: stats.correct,
    misses: stats.misses,
    accuracy: accuracy(stats),
    kpm: kpm(stats, elapsedSec),
    wpm: wpm(stats, elapsedSec),
  };
}
