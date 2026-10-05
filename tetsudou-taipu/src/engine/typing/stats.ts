export interface RunStats {
  /** 正解打鍵数。 */
  correct: number;
  /** ミス打鍵数。 */
  misses: number;
  /** かな単位のミス集計（苦手分析用）。 */
  missByKana: Record<string, number>;
}

export function emptyStats(): RunStats {
  return { correct: 0, misses: 0, missByKana: {} };
}

export function totalKeystrokes(s: RunStats): number {
  return s.correct + s.misses;
}

export function accuracy(s: RunStats): number {
  const total = totalKeystrokes(s);
  return total === 0 ? 100 : (s.correct / total) * 100;
}

/** 日本語タイピングの標準指標。正解打鍵 / 分。 */
export function kpm(s: RunStats, elapsedSec: number): number {
  return elapsedSec <= 0 ? 0 : s.correct / (elapsedSec / 60);
}

/** 国際指標として併記する。慣例で 1 word = 5 打鍵。 */
export function wpm(s: RunStats, elapsedSec: number): number {
  return kpm(s, elapsedSec) / 5;
}
