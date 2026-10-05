import { describe, expect, it } from 'vitest';
import { buildNodes } from '../patterns';

const pat = (reading: string, i = 0) => buildNodes(reading)[i]!.patterns;

describe('基本かな', () => {
  it('し は shi / si / ci で打てる', () => {
    expect(pat('し')).toEqual(expect.arrayContaining(['shi', 'si', 'ci']));
    expect(pat('し')[0]).toBe('shi'); // preferred
  });
  it('つ の preferred は tsu、tu も打てる', () => {
    expect(pat('つ')[0]).toBe('tsu');
    expect(pat('つ')).toContain('tu');
  });
  it('ぢ は di のみ（ji は ji ではない）', () => {
    expect(pat('ぢ')).toEqual(['di']);
  });
  it('づ は du / dzu', () => {
    expect(pat('づ')).toEqual(expect.arrayContaining(['du', 'dzu']));
  });
  it('を は wo のみ', () => {
    expect(pat('を')).toEqual(['wo']);
  });
});

describe('拗音', () => {
  it('しゃ は sha / sya / shixya / silya を含む', () => {
    const p = pat('しゃ');
    expect(p).toEqual(expect.arrayContaining(['sha', 'sya', 'shixya', 'silya']));
  });
  it('しゃ は shiya を含まない（「しや」と衝突するため）', () => {
    expect(pat('しゃ')).not.toContain('shiya');
    expect(pat('しゃ')).not.toContain('siya');
  });
  it('みゅ は myu で打てる', () => {
    expect(pat('みゅ')).toContain('myu');
  });
  it('ゔぁ は va / vuxa で打てる', () => {
    expect(pat('ゔぁ')).toEqual(expect.arrayContaining(['va', 'vuxa']));
  });
});

describe('促音', () => {
  it('っち は cchi / tti / ltuchi / xtsuchi を含む', () => {
    const p = pat('っち');
    expect(p).toEqual(expect.arrayContaining(['cchi', 'tti', 'ltuchi', 'xtsuchi']));
  });
  it('っち は tchi / ctti を含まない', () => {
    const p = pat('っち');
    expect(p).not.toContain('tchi');
    expect(p).not.toContain('ctti');
  });
  it('っな は nna を含まない（「んあ」になってしまう）', () => {
    const p = pat('っな');
    expect(p).not.toContain('nna');
    expect(p).toEqual(expect.arrayContaining(['ltuna', 'xtuna']));
  });
  it('っあ は母音重ねを生成しない', () => {
    expect(pat('っあ')).not.toContain('aa');
  });
  it('っちゅ の preferred は cchu', () => {
    expect(pat('っちゅ')[0]).toBe('cchu');
  });
  it('語尾の っ は xtu / ltu で打つ', () => {
    expect(pat('あっ', 1)).toEqual(expect.arrayContaining(['xtu', 'ltu']));
  });
});

describe('撥音の先読み', () => {
  it('ん + か行 は単独 n で打てる', () => {
    expect(pat('んか')).toContain('n');
    expect(pat('んか')[0]).toBe('n');
  });
  it('ん + あ行 は単独 n で打てない', () => {
    expect(pat('んあ')).not.toContain('n');
    expect(pat('んあ')[0]).toBe('nn');
  });
  it('ん + な行 は単独 n で打てない', () => {
    expect(pat('んな')).not.toContain('n');
  });
  it('ん + や行 は単独 n で打てない', () => {
    expect(pat('んや')).not.toContain('n');
  });
  it('語尾の ん は単独 n で打てない', () => {
    expect(pat('ん')).not.toContain('n');
    expect(pat('ん')).toEqual(expect.arrayContaining(['nn', 'xn', "n'"]));
  });
  it('ん + 拗音（な行以外）は単独 n で打てる', () => {
    expect(pat('んちゃ')).toContain('n');
  });
});

describe('長音', () => {
  it('ー は - のみ', () => {
    expect(pat('みゅー', 1)).toEqual(['-']);
  });
});
