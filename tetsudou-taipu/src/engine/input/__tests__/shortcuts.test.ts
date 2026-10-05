import { describe, expect, it } from 'vitest';
import { isReservedLetter, lettersReservedWhileTyping } from '../shortcuts';
import { ALL_STATIONS } from '../../../data/stations';
import { buildNodes } from '../../kana/patterns';

describe('文字キーのショートカット', () => {
  it('駅名入力中は文字キーを1つも予約していない', () => {
    // 1つでも予約するとその文字を含む駅が打てなくなる。
    expect(lettersReservedWhileTyping()).toEqual([]);
  });

  it('全駅名で使われる文字が、入力中に横取りされない', () => {
    const used = new Set<string>();
    for (const s of ALL_STATIONS) {
      for (const node of buildNodes(s.kana)) {
        for (const pattern of node.patterns) {
          for (const ch of pattern) used.add(ch);
        }
      }
    }
    expect(used.size).toBeGreaterThan(20); // a-z をほぼ網羅しているはず
    for (const ch of used) {
      expect(isReservedLetter(ch, 'atStation'), `"${ch}" が入力中に予約されている`).toBe(false);
    }
  });

  it('リザルト画面では R と T が効く', () => {
    expect(isReservedLetter('r', 'result')).toBe(true);
    expect(isReservedLetter('T', 'result')).toBe(true);
  });

  it('タイトルでは M が効く', () => {
    expect(isReservedLetter('m', 'title')).toBe(true);
  });
});
