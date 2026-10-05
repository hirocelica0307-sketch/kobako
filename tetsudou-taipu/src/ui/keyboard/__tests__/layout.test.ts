import { describe, expect, it } from 'vitest';
import { HOME_KEYS, KEY_ROWS, ROW_UNITS, typableKeys } from '../layout';
import { ALL_STATIONS } from '../../../data/stations';
import { buildNodes } from '../../../engine/kana/patterns';

/** 全駅名の全綴りで使われる文字。 */
function charsUsedByAllStations(): Set<string> {
  const used = new Set<string>();
  for (const s of ALL_STATIONS) {
    for (const node of buildNodes(s.kana)) {
      for (const pattern of node.patterns) {
        for (const ch of pattern) used.add(ch);
      }
    }
  }
  return used;
}

describe('画面下のキーボード', () => {
  /**
   * これが落ちるときは、押さないと進めないのに光らないキーがある。
   * 手元を見ずに打つ練習が、そのキーのところで必ず止まる。
   */
  it('駅名を打つのに必要なキーがすべてある', () => {
    const keys = new Set(typableKeys());
    const used = charsUsedByAllStations();
    expect(used.size).toBeGreaterThan(20); // a-z をほぼ網羅しているはず
    for (const ch of used) {
      expect(keys.has(ch), `"${ch}" キーが配列に無い`).toBe(true);
    }
  });

  it('どの段も幅の合計がそろっている', () => {
    for (const [i, row] of KEY_ROWS.entries()) {
      const sum = row.reduce((a, k) => a + k.u, 0);
      expect(sum, `${i + 1}段目の幅が ${sum}u`).toBeCloseTo(ROW_UNITS, 5);
    }
  });

  /** 画面のローマ字は小文字なので、キートップも小文字でそろえる。 */
  it('アルファベットのキートップはすべて小文字', () => {
    for (const k of KEY_ROWS.flat()) {
      expect(k.label, `"${k.label}" に大文字がある`).toBe(k.label.toLowerCase());
    }
  });

  it('同じキーが2か所に出てこない', () => {
    const keys = typableKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ホームポジションの目印は実在するキーに付いている', () => {
    const keys = new Set(typableKeys());
    for (const h of HOME_KEYS) expect(keys.has(h)).toBe(true);
  });
});
