import { describe, expect, it } from 'vitest';
import { normalizeKana } from '../normalize';
import { segmentKana } from '../segment';

const seg = (s: string) => segmentKana(normalizeKana(s)).map((c) => c.kana);

describe('normalizeKana', () => {
  it('カタカナをひらがなにする', () => {
    expect(normalizeKana('ヒガシヤマ')).toBe('ひがしやま');
  });
  it('中黒や空白を除去する', () => {
    expect(normalizeKana('ひがしやま・おかでん')).toBe('ひがしやまおかでん');
    expect(normalizeKana('おかやま　えき')).toBe('おかやまえき');
  });
  it('ヴをゔに正規化する', () => {
    expect(normalizeKana('ヴぁ')).toBe('ゔぁ');
  });
  it('空文字でも落ちない', () => {
    expect(normalizeKana('')).toBe('');
    expect(seg('')).toEqual([]);
  });
});

describe('segmentKana', () => {
  it('拗音を1チャンクにまとめる', () => {
    expect(seg('きょう')).toEqual(['きょ', 'う']);
    expect(seg('しゅう')).toEqual(['しゅ', 'う']);
  });
  it('促音を次のチャンクに吸収する', () => {
    expect(seg('っと')).toEqual(['っと']);
    expect(seg('びっちゅうこうじろ')).toEqual(['び', 'っちゅ', 'う', 'こ', 'う', 'じ', 'ろ']);
  });
  it('促音ノードの kanaLength が元のかな数と一致する', () => {
    const chunks = segmentKana(normalizeKana('びっちゅう'));
    expect(chunks[1]!.kana).toBe('っちゅ');
    expect(chunks[1]!.kana.length).toBe(3);
    expect(chunks[1]!.core).toBe('ちゅ');
  });
  it('撥音を単独チャンクにする', () => {
    expect(seg('ん')).toEqual(['ん']);
    expect(seg('しんくらしき')).toEqual(['し', 'ん', 'く', 'ら', 'し', 'き']);
    expect(seg('なかのごん')).toEqual(['な', 'か', 'の', 'ご', 'ん']);
  });
  it('長音符を単独チャンクにする', () => {
    expect(seg('みゅーじあむ')).toEqual(['みゅ', 'ー', 'じ', 'あ', 'む']);
  });
  it('語尾の促音は単独チャンクになる', () => {
    const chunks = segmentKana(normalizeKana('あっ'));
    expect(chunks.map((c) => c.kana)).toEqual(['あ', 'っ']);
    expect(chunks[1]!.core).toBe('');
  });
});
