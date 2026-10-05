import { describe, expect, it } from 'vitest';
import { rollWeather, skyFor, WEATHER_LABEL, WEATHER_SKY } from '../weather';
import { LINES } from '../../data/lines';

describe('天気', () => {
  it('すべての天気に色とラベルがある', () => {
    for (const w of Object.keys(WEATHER_SKY) as Array<keyof typeof WEATHER_SKY>) {
      expect(WEATHER_SKY[w].top).toMatch(/^#[0-9a-f]{6}$/);
      expect(WEATHER_LABEL[w].length).toBeGreaterThan(0);
    }
  });

  it('どの路線でも必ず有効な天気を返す', () => {
    for (const line of LINES) {
      for (let i = 0; i < 50; i++) {
        expect(WEATHER_SKY[rollWeather(line.id)]).toBeDefined();
      }
    }
  });

  it('乱数の端（0と1直前）でも落ちない', () => {
    for (const line of LINES) {
      expect(WEATHER_SKY[rollWeather(line.id, () => 0)]).toBeDefined();
      expect(WEATHER_SKY[rollWeather(line.id, () => 0.999999)]).toBeDefined();
    }
  });

  it('海沿いの路線では雪が出ない', () => {
    for (const id of ['seto-ohashi', 'uno', 'ako', 'okaden', 'mizurin', 'kibi']) {
      const seen = new Set(Array.from({ length: 300 }, () => rollWeather(id)));
      expect(seen.has('snow'), id).toBe(false);
    }
  });

  it('山あいの路線では雪も出る', () => {
    const seen = new Set(Array.from({ length: 300 }, () => rollWeather('geibi')));
    expect(seen.has('snow')).toBe(true);
  });

  it('トンネルの中は空を描かない', () => {
    expect(skyFor('sunny', 'tunnel')).toBeNull();
    expect(skyFor('sunny', 'sea')).not.toBeNull();
  });
});
