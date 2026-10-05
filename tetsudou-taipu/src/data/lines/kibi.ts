import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 吉備線（桃太郎線）岡山〜総社。駅名が短く、入門に向く。 */
const STOPS: readonly StationId[] = [
  'okayama', 'bizen-mikado', 'daianji', 'bizen-ichinomiya', 'kibitsu',
  'bitchu-takamatsu', 'ashimori', 'hattori', 'higashi-soja', 'soja',
];
const KM = [0, 1.9, 3.3, 6.5, 8.4, 11.0, 13.4, 16.2, 18.8, 20.4];
const SCENES: readonly SceneKind[] = [
  'city', 'city', 'suburb', 'rural', 'rural', 'rural', 'rural', 'rural', 'suburb',
];

export const KIBI_LINE: Line = {
  id: 'kibi',
  nameJp: '吉備線',
  nameKana: 'きびせん',
  nickname: '桃太郎線',
  company: 'JR西日本',
  lineColor: '#e8673c',
  vehicle: 'kiha40-orange',
  destination: '総社',
  originName: '岡山',
  trainType: '普通',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-local',
  difficultyOverride: 14,
  scopeNote: '岡山〜総社　10駅・約20km',
};
