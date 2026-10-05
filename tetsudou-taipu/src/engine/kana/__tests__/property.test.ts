import { describe, expect, it } from 'vitest';
import { buildNodes } from '../patterns';
import { createTypingState, feedKey } from '../../typing/matcher';
import type { TypingState } from '../../typing/types';
import { ALL_STATIONS } from '../../../data/stations';

/**
 * Phase 2 以降で投入予定の難読駅。
 * データがまだ入っていない段階でも、エンジンがこれらを扱えることを保証する。
 */
const FUTURE_READINGS: readonly string[] = [
  'びっちゅうこうじろ',  // 備中神代
  'きびのまきび',        // 吉備真備
  'びっちゅうくれせ',    // 備中呉妹
  'そううんのさとえばら', // 早雲の里荏原
  'こもりうたのさとたかや', // 子守唄の里高屋
  'みなぎ',              // 美袋
  'ほうこく',            // 方谷
  'いしが',              // 石蟹
  'おさかべ',            // 刑部
  'かめのこう',          // 亀甲
  'こうめ',              // 神目
  'のち',                // 野馳
  'みまさかたきお',      // 美作滝尾
  'こいやまがた',        // 恋山形
  'みやもとむさし',      // 宮本武蔵
  'こうのはらえんしん',  // 河野原円心
  'ひがしやまおかでんみゅーじあむ',
  'みつびしじこうまえ',  // 三菱自工前
  'たんじべ',            // 丹治部
  'みまさかおいわけ',    // 美作追分
  'せのお',              // 妹尾
  'はざかわ',            // 迫川
  'いんべ',              // 伊部
  'かがと',              // 香登
  'おさふね',            // 長船
  'おく',                // 邑久
  'びぜんいちのみや',    // 備前一宮
  'ちゃやまち',          // 茶屋町
  'そうじゃ',            // 総社
  'しんみゃくづくり',    // 拗音・促音・撥音を同時に含む合成ケース
];

const READINGS: readonly string[] = [
  ...ALL_STATIONS.map((s) => s.kana),
  ...FUTURE_READINGS,
];

/** 決定的な擬似乱数（テストを再現可能にする）。 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 各ノードからランダムに綴りを選んで連結した打鍵列を作る。 */
function randomSpelling(reading: string, rand: () => number): string {
  return buildNodes(reading)
    .map((n) => n.patterns[Math.floor(rand() * n.patterns.length)]!)
    .join('');
}

function play(reading: string, keys: string): { done: boolean; misses: number } {
  let st: TypingState = createTypingState(reading);
  let misses = 0;
  for (const k of keys) {
    const r = feedKey(st, k);
    if (r.type === 'hit') st = r.state;
    else if (r.type === 'miss') misses++;
  }
  return { done: st.done, misses };
}

describe('プロパティテスト: 全読み × ランダム綴り', () => {
  it('どの綴りの組み合わせでも必ずミス0で完走する', () => {
    const rand = mulberry32(20260914);
    const failures: string[] = [];

    for (const reading of READINGS) {
      for (let trial = 0; trial < 100; trial++) {
        const keys = randomSpelling(reading, rand);
        const { done, misses } = play(reading, keys);
        if (!done || misses > 0) {
          failures.push(`${reading} / "${keys}" (done=${done}, misses=${misses})`);
        }
      }
    }

    expect(failures.slice(0, 10)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it('preferred 綴りだけでも必ず完走する', () => {
    for (const reading of READINGS) {
      const keys = buildNodes(reading).map((n) => n.patterns[0]!).join('');
      const { done, misses } = play(reading, keys);
      expect({ reading, done, misses }).toEqual({ reading, done: true, misses: 0 });
    }
  });

  it('すべてのノードが少なくとも1つの綴りを持つ', () => {
    for (const reading of READINGS) {
      for (const node of buildNodes(reading)) {
        expect(node.patterns.length, `${reading} / ${node.kana}`).toBeGreaterThan(0);
      }
    }
  });

  it('ノードのかなを連結すると元の読みに戻る', () => {
    for (const reading of READINGS) {
      expect(buildNodes(reading).map((n) => n.kana).join('')).toBe(reading);
    }
  });
});
