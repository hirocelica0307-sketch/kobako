import { describe, expect, it } from 'vitest';
import { noteToFreq } from '../context';
import { TRACKS, trackFor } from '../tracks';

describe('音名の解釈', () => {
  it('基準音が正しい', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 5);
  });
  it('オクターブが倍になる', () => {
    expect(noteToFreq('A5')).toBeCloseTo(880, 5);
    expect(noteToFreq('A3')).toBeCloseTo(220, 5);
  });
  it('# と S は同じ意味', () => {
    expect(noteToFreq('F#5')).toBeCloseTo(noteToFreq('FS5'), 5);
  });
  it('フラットが半音下がる', () => {
    expect(noteToFreq('Bb3')).toBeCloseTo(noteToFreq('A#3'), 5);
  });
  it('壊れた音名は例外にする（無言で440Hzにしない）', () => {
    expect(() => noteToFreq('H4')).toThrow();
    expect(() => noteToFreq('C')).toThrow();
  });
});

describe('BGM のデータ', () => {
  const ids = Object.keys(TRACKS);

  it('全パートの音名が解釈できる', () => {
    for (const id of ids) {
      const t = TRACKS[id]!;
      for (const part of [t.lead, t.bass]) {
        for (const note of part) {
          if (note === null || note === '-') continue;
          expect(() => noteToFreq(note), `${id}: ${note}`).not.toThrow();
        }
      }
    }
  });

  it('lead / bass / drums の長さが揃っている', () => {
    for (const id of ids) {
      const t = TRACKS[id]!;
      expect(t.bass.length, id).toBe(t.lead.length);
      expect(t.drums.length, id).toBe(t.lead.length);
    }
  });

  it('先頭が伸ばし記号で始まっていない', () => {
    for (const id of ids) {
      expect(TRACKS[id]!.lead[0], id).not.toBe('-');
      expect(TRACKS[id]!.bass[0], id).not.toBe('-');
    }
  });

  it('テンポが常識的な範囲にある', () => {
    for (const id of ids) {
      expect(TRACKS[id]!.bpm, id).toBeGreaterThanOrEqual(60);
      expect(TRACKS[id]!.bpm, id).toBeLessThanOrEqual(200);
    }
  });

  it('打楽器の記号が k/s/h のいずれか', () => {
    for (const id of ids) {
      for (const d of TRACKS[id]!.drums) {
        if (d !== null) expect(['k', 's', 'h'], id).toContain(d);
      }
    }
  });

  it('知らない路線でも曲が返る（無音にならない）', () => {
    expect(trackFor('does-not-exist')).toBeDefined();
  });
});
