import type { SceneKind } from '../data/types';

export type Weather = 'sunny' | 'cloudy' | 'sunset' | 'rain' | 'snow';

export interface SkyPalette {
  top: string;
  bottom: string;
  /** 遠景の山の色。天気で沈む。 */
  hill: string;
  /** 中景の色被せ（空気遠近）。null なら被せない。 */
  haze: string | null;
  /** 画面全体に薄くかける色。夕焼け・雨の空気感を作る。 */
  tint: string | null;
  cloud: string;
}

export const WEATHER_SKY: Readonly<Record<Weather, SkyPalette>> = {
  sunny:  { top: '#5fb4e8', bottom: '#d8eefb', hill: '#9fb8a6', haze: null,
            tint: null, cloud: '#ffffff' },
  cloudy: { top: '#93a3ae', bottom: '#cfd6db', hill: '#8f9e94', haze: 'rgba(180,190,200,0.18)',
            tint: 'rgba(150,160,170,0.10)', cloud: '#e6ebef' },
  sunset: { top: '#4a4a86', bottom: '#f2a860', hill: '#7a6a72', haze: 'rgba(240,150,90,0.16)',
            tint: 'rgba(240,140,70,0.14)', cloud: '#ffd2a6' },
  rain:   { top: '#5a6670', bottom: '#93a0a8', hill: '#6f8076', haze: 'rgba(120,140,155,0.24)',
            tint: 'rgba(90,110,130,0.18)', cloud: '#b8c2c9' },
  snow:   { top: '#8fa2b4', bottom: '#dfe8ef', hill: '#b9c4c4', haze: 'rgba(230,238,245,0.22)',
            tint: 'rgba(225,235,245,0.14)', cloud: '#ffffff' },
};

export const WEATHER_LABEL: Readonly<Record<Weather, string>> = {
  sunny: 'はれ', cloudy: 'くもり', sunset: 'ゆうやけ', rain: 'あめ', snow: 'ゆき',
};

/**
 * 路線ごとの天気の出やすさ。
 *
 * ここに書いた路線は**この表がそのまま全部**になる（既定値とは混ぜない）。
 * 混ぜる作りにすると、書き落とした天気が既定値から漏れて出てしまう
 * （瀬戸大橋線に雪を降らせてしまう不具合を出した）。
 * 0 と書けば「出ない」がそのまま読み取れる。
 */
type Weights = Readonly<Record<Weather, number>>;

const DEFAULT_WEIGHTS: Weights = {
  sunny: 5, cloudy: 3, sunset: 2, rain: 2, snow: 1,
};

const WEIGHTS: Readonly<Record<string, Weights>> = {
  // 山あいは雪が出やすい
  hakubi: { sunny: 3, cloudy: 3, sunset: 1, rain: 2, snow: 3 },
  geibi:  { sunny: 2, cloudy: 3, sunset: 1, rain: 2, snow: 4 },
  kishin: { sunny: 3, cloudy: 3, sunset: 1, rain: 2, snow: 3 },
  inbi:   { sunny: 3, cloudy: 3, sunset: 1, rain: 2, snow: 3 },
  chizu:  { sunny: 3, cloudy: 2, sunset: 1, rain: 2, snow: 3 },
  // 瀬戸内側は晴れやすく、雪は降らせない
  'seto-ohashi': { sunny: 6, cloudy: 2, sunset: 3, rain: 1, snow: 0 },
  uno:    { sunny: 5, cloudy: 2, sunset: 3, rain: 1, snow: 0 },
  ako:    { sunny: 5, cloudy: 2, sunset: 3, rain: 1, snow: 0 },
  mizurin:{ sunny: 5, cloudy: 3, sunset: 2, rain: 2, snow: 0 },
  okaden: { sunny: 4, cloudy: 3, sunset: 2, rain: 2, snow: 0 },
  kibi:   { sunny: 5, cloudy: 3, sunset: 2, rain: 2, snow: 0 },
};

/** プレイのたびに天気を引き直す。 */
export function rollWeather(lineId: string, rand: () => number = Math.random): Weather {
  const w = WEIGHTS[lineId] ?? DEFAULT_WEIGHTS;
  const entries = (Object.entries(w) as Array<[Weather, number]>).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  let r = rand() * total;
  for (const [kind, n] of entries) {
    r -= n;
    if (r <= 0) return kind;
  }
  return entries[entries.length - 1]![0];
}

/** トンネルの中は天気が見えないので、空の描画自体を差し替える。 */
export function skyFor(weather: Weather, scene: SceneKind): SkyPalette | null {
  return scene === 'tunnel' ? null : WEATHER_SKY[weather];
}
