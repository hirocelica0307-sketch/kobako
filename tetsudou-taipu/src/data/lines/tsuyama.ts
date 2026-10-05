import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 津山線 岡山〜津山。旭川に沿って里山を north へ。 */
const STOPS: readonly StationId[] = [
  'okayama', 'hokaiin', 'bizen-hara', 'tamagashi', 'makiyama', 'nonokuchi',
  'kanagawa', 'takebe', 'fukuwatari', 'koume', 'yuge', 'tanjoji',
  'obara', 'kamenoko', 'sarayama', 'tsuyamaguchi', 'tsuyama',
];
const KM = [0, 2.3, 4.6, 8.4, 11.3, 14.6, 17.8, 24.4, 27.9, 33.6, 37.6, 41.2, 43.6, 46.9, 52.9, 56.8, 58.7];
const SCENES: readonly SceneKind[] = [
  'city', 'suburb', 'suburb', 'river', 'river', 'rural', 'river',
  'river', 'rural', 'rural', 'rural', 'rural', 'rural', 'rural', 'rural', 'suburb',
];

export const TSUYAMA_LINE: Line = {
  id: 'tsuyama',
  nameJp: '津山線',
  nameKana: 'つやません',
  company: 'JR西日本',
  lineColor: '#6aa84f',
  vehicle: 'kiha40-orange',
  destination: '津山',
  originName: '岡山',
  trainType: '普通',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-local',
  difficultyOverride: 56,
  scopeNote: '岡山〜津山　17駅・約59km',
};
