import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 岡山県内を東端から西端まで。岡山駅は途中駅になる。 */
const STOPS: readonly StationId[] = [
  'mitsuishi', 'yoshinaga', 'wake', 'kumayama', 'mantomi', 'seto', 'jouto',
  'higashi-okayama', 'takashima', 'nishigawara', 'okayama',
  'kitanagase', 'niwase', 'nakashou', 'kurashiki', 'nishiachi',
  'shinkurashiki', 'konkou', 'kamogata', 'satoshou', 'kasaoka',
];

/** 三石からの累計営業キロ。 */
const KM = [
  0, 5.4, 11.7, 16.2, 19.8, 23.4, 27.4,
  31.5, 34.3, 36.2, 38.6,
  41.3, 44.1, 49.6, 54.5, 58.5,
  63.6, 69.2, 73.0, 76.6, 82.2,
];

/** 区間ごとの風景。県東部は山あい、岡山近郊は市街、西部は田園。 */
const SCENES: readonly SceneKind[] = [
  'mountain', 'mountain', 'river', 'rural', 'rural', 'rural',
  'suburb', 'suburb', 'city', 'city',
  'city', 'suburb', 'suburb', 'suburb', 'rural',
  'rural', 'rural', 'rural', 'rural', 'rural',
];

export const SANYO_MAIN_DOWN: Line = {
  id: 'sanyo-main-down',
  nameJp: '山陽本線',
  nameKana: 'さんようほんせん',
  company: 'JR西日本',
  lineColor: '#0072bc',
  vehicle: '115-yellow',
  destination: '笠岡',
  originName: '三石',
  trainType: '普通',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main',
  scopeNote: '岡山県内（三石〜笠岡）21駅・約82km',
};
