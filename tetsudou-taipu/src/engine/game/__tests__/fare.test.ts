import { describe, expect, it } from 'vitest';
import { calcFare, calcSurcharge } from '../fare';
import { getFareRule } from '../../../data/fareTable';
import { boardingAt } from '../passengers';
import { LINES } from '../../../data/lines';
import { getStation } from '../../../data/stations';
import type { Station } from '../../../data/types';

describe('運賃', () => {
  it('距離が伸びれば運賃は下がらない', () => {
    for (const line of LINES) {
      const rule = getFareRule(line.fareRule);
      let prev = -1;
      for (let km = 0; km <= 200; km += 1) {
        const f = calcFare(rule, km, Math.floor(km));
        expect(f, `${line.nameJp} ${km}km`).toBeGreaterThanOrEqual(prev);
        prev = f;
      }
    }
  });

  it('地方交通線は同じ距離でも幹線より高い', () => {
    const main = getFareRule('jr-main');
    const local = getFareRule('jr-local');
    // 帯の境目では同額になることもあるので、代表的な距離で比べる
    const cheaper = [12, 18, 28, 45, 70].filter(
      (km) => calcFare(local, km) < calcFare(main, km),
    );
    expect(cheaper).toEqual([]);
    expect(calcFare(local, 45)).toBeGreaterThan(calcFare(main, 45));
  });

  it('均一運賃の路線は距離ではなく駅数で増える', () => {
    const okaden = getFareRule('okaden-flat');
    expect(okaden.perRideYen).toBe(140);
    expect(calcFare(okaden, 0.3, 1)).toBe(140);
    expect(calcFare(okaden, 3.1, 5)).toBe(700);
    // 距離を変えても駅数が同じなら同額
    expect(calcFare(okaden, 99, 5)).toBe(calcFare(okaden, 1, 5));
  });

  it('新幹線は自由席特急料金が上乗せされる', () => {
    expect(calcSurcharge('shinkansen', 120)).toBeGreaterThan(0);
    expect(calcSurcharge(undefined, 120)).toBe(0);
    expect(calcSurcharge('shinkansen', 0)).toBe(0);
    // 遠いほど高い
    expect(calcSurcharge('shinkansen', 250)).toBeGreaterThan(calcSurcharge('shinkansen', 60));
  });

  it('0km では運賃が発生しない（均一運賃をのぞく）', () => {
    for (const id of ['jr-main', 'jr-local', 'mizurin', 'ibara-fare', 'chizu-fare']) {
      expect(calcFare(getFareRule(id), 0, 0), id).toBe(0);
    }
  });

  it('岡山〜倉敷がおおむね実際の水準に収まる', () => {
    // 山陽本線 岡山〜倉敷 は 15.9km。幹線の帯では 240〜330円あたり
    const f = calcFare(getFareRule('jr-main'), 15.9);
    expect(f).toBeGreaterThanOrEqual(240);
    expect(f).toBeLessThanOrEqual(420);
  });
});

describe('乗客', () => {
  const st = (id: string): Station => getStation(id);

  it('大きな駅ほど多く乗る', () => {
    const half = () => 0.5;
    const okayama = boardingAt(st('okayama'), 0, false, half).on;
    const unmanned = boardingAt(st('sakane'), 0, false, half).on;
    expect(okayama).toBeGreaterThan(unmanned);
  });

  it('ノーミスだと多めに乗る', () => {
    const half = () => 0.5;
    const plain = boardingAt(st('kurashiki'), 0, false, half).on;
    const clean = boardingAt(st('kurashiki'), 0, true, half).on;
    expect(clean).toBeGreaterThan(plain);
  });

  it('誰も乗っていなければ誰も降りない', () => {
    for (let i = 0; i < 20; i++) {
      expect(boardingAt(st('okayama'), 0, false).off).toBe(0);
    }
  });

  it('乗っている人数より多くは降りない', () => {
    for (let i = 0; i < 100; i++) {
      const onboard = 1 + Math.floor(Math.random() * 40);
      expect(boardingAt(st('okayama'), onboard, false).off).toBeLessThanOrEqual(onboard);
    }
  });

  it('乗る人数は必ず1人以上', () => {
    for (const s of ['okayama', 'sakane', 'kurashiki', 'okaden-ekimae', 'shin-kobe']) {
      for (let i = 0; i < 40; i++) {
        expect(boardingAt(st(s), 5, false).on, s).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
