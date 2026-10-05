import { describe, expect, it } from 'vitest';
import { createTypingState, feedKey, expectedChars } from '../matcher';
import { renderRomaji } from '../hint';
import type { TypingState } from '../types';

/** キー列を順に流し、最終状態とミス数を返す。 */
function feedAll(reading: string, keys: string) {
  let st = createTypingState(reading);
  let misses = 0;
  for (const k of keys) {
    const r = feedKey(st, k);
    if (r.type === 'hit') st = r.state;
    else if (r.type === 'miss') misses++;
  }
  return { st, misses };
}

const completes = (reading: string, keys: string) => {
  const { st, misses } = feedAll(reading, keys);
  return st.done && misses === 0;
};

describe('打鍵シーケンス', () => {
  it('しんくらしき をヘボン式で完走', () => {
    expect(completes('しんくらしき', 'shinkurashiki')).toBe(true);
  });
  it('しんくらしき を訓令式で完走', () => {
    expect(completes('しんくらしき', 'sinnkurasiki')).toBe(true);
  });
  it('こんこう を konnkou / konkou どちらでも完走', () => {
    expect(completes('こんこう', 'konnkou')).toBe(true);
    expect(completes('こんこう', 'konkou')).toBe(true);
  });
  it('語尾の ん は n だけでは終わらない', () => {
    expect(feedAll('なかのごん', 'nakanogon').st.done).toBe(false);
    expect(completes('なかのごん', 'nakanogonn')).toBe(true);
  });
  it('ちゃやまち を3通りの綴りで完走', () => {
    expect(completes('ちゃやまち', 'chayamachi')).toBe(true);
    expect(completes('ちゃやまち', 'tyayamati')).toBe(true);
    expect(completes('ちゃやまち', 'cyayamati')).toBe(true);
  });
  it('促音を子音重ねでも xtu でも完走', () => {
    expect(completes('ほっかい', 'hokkai')).toBe(true);
    expect(completes('ほっかい', 'holtukai')).toBe(true);
    expect(completes('ほっかい', 'hoxtukai')).toBe(true);
  });
  it('びっちゅうこうじろ を完走', () => {
    expect(completes('びっちゅうこうじろ', 'bicchuukoujiro')).toBe(true);
    expect(completes('びっちゅうこうじろ', 'bittyuukouziro')).toBe(true);
  });
  it('最長クラスの駅名を完走', () => {
    // 「そううん + の」: ん の次が な行なので nn が必須（n が3つ並ぶ）
    expect(completes('そううんのさとえばら', 'souunnnosatoebara')).toBe(true);
    expect(feedAll('そううんのさとえばら', 'souunnosatoebara').st.done).toBe(false);
    // 「でん + みゅ」: ん の次が ま行なので単独 n で確定できる
    expect(completes('ひがしやまおかでんみゅーじあむ', 'higashiyamaokadenmyu-jiamu')).toBe(true);
  });
  it('大文字でも完走する', () => {
    expect(completes('おかやま', 'OKAYAMA')).toBe(true);
  });
});

describe('commit-and-retry（撥音の確定→再試行）', () => {
  it('ん に n を打った直後の子音が miss にならない', () => {
    let st = createTypingState('んこ');
    const r1 = feedKey(st, 'n');
    expect(r1.type).toBe('hit');
    st = (r1 as { state: TypingState }).state;
    expect(st.nodeIndex).toBe(0); // まだ ん は伸びる可能性がある

    const r2 = feedKey(st, 'k');
    expect(r2.type).toBe('hit'); // ん が確定し、k は こ の先頭として解釈される
    st = (r2 as { state: TypingState }).state;
    expect(st.nodeIndex).toBe(1);
    expect(st.committed).toBe('n');
  });
  it('nnko でも完走する', () => {
    expect(completes('んこ', 'nnko')).toBe(true);
  });
});

describe('ミスと無視', () => {
  it('ミス時に状態が一切変わらない（同じ参照を返す）', () => {
    const st = createTypingState('かに');
    const r = feedKey(st, 'z');
    expect(r.type).toBe('miss');
    expect((r as { state: TypingState }).state).toBe(st);
  });
  it('修飾キー・機能キーは ignore', () => {
    const st = createTypingState('かに');
    for (const k of ['Shift', 'ArrowLeft', 'F5', 'Enter', 'Control']) {
      expect(feedKey(st, k).type).toBe('ignore');
    }
  });
  it('完了後の打鍵は ignore', () => {
    const { st } = feedAll('か', 'ka');
    expect(st.done).toBe(true);
    expect(feedKey(st, 'a').type).toBe('ignore');
  });
  it('expectedChars がミス時の候補集合を返す', () => {
    const st = createTypingState('し');
    expect(expectedChars(st).sort()).toEqual(['c', 's']);
  });
  it('ん の途中では次ノードの先頭も expected に含まれる', () => {
    let st = createTypingState('んこ');
    st = (feedKey(st, 'n') as { state: TypingState }).state;
    expect(expectedChars(st)).toEqual(expect.arrayContaining(['n', 'k', 'c']));
  });
});

describe('ヒント表示（sticky preferred）', () => {
  it('し に s を打つと残りは hi（si に切り替わらない）', () => {
    let st = createTypingState('し');
    st = (feedKey(st, 's') as { state: TypingState }).state;
    expect(renderRomaji(st).rest).toBe('hi');
  });
  it('し に s,h と打っても shi のまま', () => {
    let st = createTypingState('し');
    st = (feedKey(st, 's') as { state: TypingState }).state;
    st = (feedKey(st, 'h') as { state: TypingState }).state;
    expect(renderRomaji(st).active).toBe('sh');
    expect(renderRomaji(st).rest).toBe('i');
  });
  it('si と打った場合は si で確定する', () => {
    const { st, misses } = feedAll('し', 'si');
    expect(st.done).toBe(true);
    expect(misses).toBe(0);
    expect(st.committed).toBe('si');
  });
  it('語尾の ん の初期ヒントは nn', () => {
    const st = createTypingState('ごん');
    expect(st.nodes[1]!.patterns[0]).toBe('nn');
  });
  it('つ の初期ヒントは tsu', () => {
    expect(renderRomaji(createTypingState('つ')).rest).toBe('tsu');
  });
  it('upcoming が以降ノードの preferred 連結と一致する', () => {
    const st = createTypingState('おかやま');
    expect(renderRomaji(st).upcoming).toBe('kayama');
  });
});

describe('境界', () => {
  it('空の読みは即 done', () => {
    expect(createTypingState('').done).toBe(true);
  });
});
