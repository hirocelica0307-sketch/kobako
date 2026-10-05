import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 瀬戸大橋線 岡山〜高松。茶屋町までは宇野線と同じ駅を共有する。 */
const STOPS: readonly StationId[] = [
  'okayama', 'omoto', 'bizen-nishiichi', 'senoo', 'bitchu-mishima', 'hayashima',
  'kuguhara', 'chayamachi', 'uematsu', 'kimi', 'kaminocho', 'kojima',
  'utazu', 'sakaide', 'takamatsu',
];
const KM = [0, 2.0, 4.0, 6.7, 8.5, 10.2, 11.7, 14.9, 17.5, 20.5, 25.3, 27.8, 45.9, 51.0, 71.8];
const SCENES: readonly SceneKind[] = [
  'city', 'city', 'suburb', 'suburb', 'rural', 'rural', 'rural',
  'rural', 'rural', 'rural', 'sea', 'bridge', 'suburb', 'suburb',
];

export const SETO_OHASHI_LINE: Line = {
  id: 'seto-ohashi',
  nameJp: '瀬戸大橋線',
  nameKana: 'せとおおはしせん',
  company: 'JR西日本',
  lineColor: '#1b64a8',
  vehicle: '213-marine',
  destination: '高松',
  originName: '岡山',
  trainType: '快速',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main',
  difficultyOverride: 34,
  scopeNote: '岡山〜高松　15駅・約72km（瀬戸大橋を渡ります）',
};
