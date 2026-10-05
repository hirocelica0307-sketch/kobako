import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 井原鉄道 井原線 総社〜神辺。長い駅名がそろう。 */
const STOPS: readonly StationId[] = [
  'soja', 'kiyone', 'kawabejuku', 'kibinomakibi', 'bitchu-kurese', 'mitani',
  'yakage', 'oda', 'souun-ebara', 'ibara', 'izue', 'komoriuta-takaya',
  'goryo', 'yuno', 'kannabe',
];
const KM = [0, 3.4, 7.4, 9.4, 12.2, 16.0, 19.3, 23.7, 26.2, 29.0, 31.0, 33.8, 36.5, 38.5, 41.7];
const SCENES: readonly SceneKind[] = [
  'rural', 'river', 'rural', 'rural', 'rural', 'rural', 'rural',
  'rural', 'suburb', 'rural', 'rural', 'rural', 'rural', 'suburb',
];

export const IBARA_LINE: Line = {
  id: 'ibara', nameJp: '井原線', nameKana: 'いばらせん',
  company: '井原鉄道', lineColor: '#2e9e5b', vehicle: 'ibara',
  destination: '神辺', originName: '総社', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'ibara-fare', difficultyOverride: 92,
  scopeNote: '総社〜神辺　15駅・約42km（長い駅名の宝庫）',
  hideRomajiDefault: false,
};
