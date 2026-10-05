import {
  DEFAULT_SAVE, MAX_MISS_KANA_ENTRIES, TOP_N,
  type SaveDataV1, type ScoreEntry, type ScoreKey, type Settings, type TimeLimit,
} from './schema';

const STORAGE_KEY = 'okayama-rail-typing';

/** 保存が使えない環境（プライベートブラウジング等）ではメモリ上だけで動かす。 */
let memoryOnly = false;
let cached: SaveDataV1 | null = null;

export function storageFailed(): boolean {
  return memoryOnly;
}

/** 壊れた JSON・未知の version は既定値に落とす。 */
function migrate(raw: unknown): SaveDataV1 {
  if (typeof raw !== 'object' || raw === null) return structuredClone(DEFAULT_SAVE);
  const d = raw as Partial<SaveDataV1>;
  if (d.version !== 1) return structuredClone(DEFAULT_SAVE);
  return {
    version: 1,
    playCount: typeof d.playCount === 'number' ? d.playCount : 0,
    highScores: typeof d.highScores === 'object' && d.highScores !== null ? d.highScores : {},
    settings: { ...DEFAULT_SAVE.settings, ...(d.settings ?? {}) },
    stats: { ...DEFAULT_SAVE.stats, ...(d.stats ?? {}) },
  };
}

export function loadSave(): SaveDataV1 {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw === null ? structuredClone(DEFAULT_SAVE) : migrate(JSON.parse(raw));
  } catch {
    memoryOnly = true;
    cached = structuredClone(DEFAULT_SAVE);
  }
  return cached;
}

export function saveSave(data: SaveDataV1): void {
  cached = data;
  if (memoryOnly) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    memoryOnly = true;
  }
}

export function scoreKey(lineId: string, timeLimit: TimeLimit): ScoreKey {
  return `${lineId}:${timeLimit}`;
}

export function getScores(lineId: string, timeLimit: TimeLimit): ScoreEntry[] {
  return loadSave().highScores[scoreKey(lineId, timeLimit)] ?? [];
}

export function bestFare(lineId: string, timeLimit: TimeLimit): number | null {
  return getScores(lineId, timeLimit)[0]?.fare ?? null;
}

/** スコアを記録し、自己ベスト更新なら true を返す。 */
export function recordScore(
  lineId: string,
  timeLimit: TimeLimit,
  entry: ScoreEntry,
  runSeconds: number,
): boolean {
  const data = loadSave();
  const key = scoreKey(lineId, timeLimit);
  const list = [...(data.highScores[key] ?? []), entry]
    .sort((a, b) => b.fare - a.fare)
    .slice(0, TOP_N);
  const isBest = list[0] === entry;

  const stats = data.stats;
  saveSave({
    ...data,
    playCount: data.playCount + 1,
    highScores: { ...data.highScores, [key]: list },
    stats: {
      totalRuns: stats.totalRuns + 1,
      totalKeystrokes: stats.totalKeystrokes + entry.keystrokes,
      totalMisses: stats.totalMisses + entry.misses,
      totalSeconds: stats.totalSeconds + runSeconds,
      missByKana: trimMissByKana(stats.missByKana),
    },
  });
  return isBest;
}

function trimMissByKana(src: Record<string, number>): Record<string, number> {
  const entries = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, MAX_MISS_KANA_ENTRIES);
  return Object.fromEntries(entries);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const data = loadSave();
  const settings = { ...data.settings, ...patch };
  saveSave({ ...data, settings });
  return settings;
}

/** 券番号は路線とプレイ回数から作る（実在の券番号体系は模倣しない）。 */
export function ticketNumber(): string {
  return String(loadSave().playCount % 10000).padStart(4, '0');
}
