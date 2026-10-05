import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 伯備線 岡山〜新見。倉敷までは山陽本線と同じ駅を共有する。難読駅の宝庫。 */
const STOPS: readonly StationId[] = [
  'okayama', 'kitanagase', 'niwase', 'nakashou', 'kurashiki', 'kiyone', 'soja',
  'gokei', 'hiwa', 'minagi', 'bitchu-hirose', 'bitchu-takahashi',
  'kinoyama', 'bitchu-kawamo', 'hokoku', 'ikura', 'ishiga', 'niimi',
];
const KM = [0, 2.7, 5.5, 11.0, 15.9, 19.3, 22.7, 26.9, 31.0, 34.1,
  40.7, 45.9, 50.6, 54.6, 58.0, 63.7, 68.3, 74.3];
const SCENES: readonly SceneKind[] = [
  'city', 'suburb', 'suburb', 'suburb', 'rural', 'rural', 'river',
  'river', 'river', 'mountain', 'mountain', 'mountain', 'river',
  'mountain', 'tunnel', 'mountain', 'mountain',
];

export const HAKUBI_LINE: Line = {
  id: 'hakubi',
  nameJp: '伯備線',
  nameKana: 'はくびせん',
  company: 'JR西日本',
  lineColor: '#9b59b6',
  vehicle: '115-yellow',
  destination: '新見',
  originName: '岡山',
  trainType: '普通',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main',
  difficultyOverride: 78,
  scopeNote: '岡山〜新見　18駅・約74km（難読駅が多い上級コース）',
};
