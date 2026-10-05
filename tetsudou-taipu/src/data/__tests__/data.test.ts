import { describe, expect, it } from 'vitest';
import { ALL_STATIONS, STATIONS } from '../stations';
import { LINES } from '../lines';
import { getFareRule } from '../fareTable';
import { LANDMARKS } from '../../render/sprites/landmarks';
import { TRACKS } from '../../audio/tracks';
import { MAP_LINES, MAP_LINE_MAP } from '../mapLayout';

describe('駅レジストリ', () => {
  it('読みがひらがなと長音符だけで構成されている', () => {
    for (const s of ALL_STATIONS) {
      expect(s.kana, `${s.kanji}`).toMatch(/^[ぁ-ゖー]+$/);
    }
  });
  it('駅 id が重複していない', () => {
    expect(STATIONS.size).toBe(ALL_STATIONS.length);
  });
  it('同じ漢字名に複数の id が無い', () => {
    const byKanji = new Map<string, string[]>();
    for (const s of ALL_STATIONS) {
      byKanji.set(s.kanji, [...(byKanji.get(s.kanji) ?? []), s.id]);
    }
    const dup = [...byKanji].filter(([, ids]) => ids.length > 1);
    expect(dup).toEqual([]);
  });
  it('読みが未確認の駅が無い', () => {
    const unverified = ALL_STATIONS.filter((s) => !s.verified).map((s) => s.kanji);
    expect(unverified).toEqual([]);
  });
});

describe('路線', () => {
  it('segments が stops と整合している', () => {
    for (const line of LINES) {
      expect(line.segments.length, line.nameJp).toBe(line.stops.length - 1);
      line.segments.forEach((seg, i) => {
        expect(seg.from).toBe(line.stops[i]);
        expect(seg.to).toBe(line.stops[i + 1]);
      });
    }
  });
  it('すべての停車駅がレジストリに存在する', () => {
    for (const line of LINES) {
      for (const id of line.stops) {
        expect(STATIONS.has(id), `${line.nameJp}: ${id}`).toBe(true);
      }
    }
  });
  it('区間距離がすべて正の値', () => {
    for (const line of LINES) {
      for (const seg of line.segments) {
        expect(seg.km, `${line.nameJp}: ${seg.from}→${seg.to}`).toBeGreaterThan(0);
      }
    }
  });
  it('運賃ルールが解決できる', () => {
    for (const line of LINES) {
      expect(() => getFareRule(line.fareRule)).not.toThrow();
    }
  });
});

describe('名所・特産', () => {
  it('参照しているスプライトが実在する', () => {
    for (const s of ALL_STATIONS) {
      for (const lm of s.landmarks ?? []) {
        expect(LANDMARKS[lm.sprite], `${s.kanji}: ${lm.sprite}`).toBeDefined();
      }
    }
  });
  it('ラベルが空でない', () => {
    for (const s of ALL_STATIONS) {
      for (const lm of s.landmarks ?? []) {
        expect(lm.label.length, `${s.kanji}`).toBeGreaterThan(0);
      }
    }
  });
  it('1駅あたり2件まで（画面に収まる範囲）', () => {
    for (const s of ALL_STATIONS) {
      expect((s.landmarks ?? []).length, `${s.kanji}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('山陽本線の長さ', () => {
  it('岡山県の端から端まで21駅ある', () => {
    const line = LINES.find((l) => l.id === 'sanyo-main-down')!;
    expect(line.stops).toHaveLength(21);
    expect(line.stops[0]).toBe('mitsuishi');
    expect(line.stops.at(-1)).toBe('kasaoka');
  });
  it('岡山駅は途中駅として含まれる', () => {
    const line = LINES.find((l) => l.id === 'sanyo-main-down')!;
    const i = line.stops.indexOf('okayama');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(line.stops.length - 1);
  });
  it('全長が60km以上ある（すぐ折り返さない長さ）', () => {
    const line = LINES.find((l) => l.id === 'sanyo-main-down')!;
    const total = line.segments.reduce((a, s) => a + s.km, 0);
    expect(total).toBeGreaterThan(60);
  });
});

describe('15路線', () => {
  it('15路線ある', () => {
    expect(LINES).toHaveLength(15);
  });
  it('路線 id が重複していない', () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
  });
  it('すべての路線に BGM がある（無音の路線を作らない）', () => {
    for (const line of LINES) {
      expect(TRACKS[line.id], `${line.nameJp} の曲が無い`).toBeDefined();
    }
  });
  it('やさしい順に並んでいる', () => {
    const d = LINES.map((l) => l.difficultyOverride ?? 40);
    for (let i = 1; i < d.length; i++) {
      expect(d[i]!, `${LINES[i]!.nameJp} が ${LINES[i - 1]!.nameJp} より easy`).toBeGreaterThanOrEqual(d[i - 1]!);
    }
  });
  it('路線名の読みがひらがなだけ', () => {
    for (const line of LINES) {
      expect(line.nameKana, line.nameJp).toMatch(/^[ぁ-ゖー]+$/);
    }
  });
});

describe('路線選択の地図', () => {
  it('すべての路線が地図に載っている', () => {
    for (const line of LINES) {
      expect(MAP_LINE_MAP.get(line.id), `${line.nameJp} が地図に無い`).toBeDefined();
    }
  });
  it('地図に実在しない路線が混ざっていない', () => {
    const ids = new Set(LINES.map((l) => l.id));
    for (const ml of MAP_LINES) {
      expect(ids.has(ml.id), `${ml.id} は路線一覧に無い`).toBe(true);
    }
  });
  it('地図は id で引くので並び順に依存しない', () => {
    // 並びが違っても、id さえ揃っていれば正しい路線が選ばれる
    expect(new Set(MAP_LINES.map((m) => m.id))).toEqual(new Set(LINES.map((l) => l.id)));
  });
  it('折れ線が画面内に収まっている', () => {
    for (const ml of MAP_LINES) {
      expect(ml.path.length, ml.id).toBeGreaterThanOrEqual(2);
      for (const p of ml.path) {
        expect(p.x, `${ml.id} x`).toBeGreaterThanOrEqual(0);
        expect(p.x, `${ml.id} x`).toBeLessThanOrEqual(320);
        expect(p.y, `${ml.id} y`).toBeGreaterThanOrEqual(0);
        expect(p.y, `${ml.id} y`).toBeLessThanOrEqual(180);
      }
    }
  });
});
