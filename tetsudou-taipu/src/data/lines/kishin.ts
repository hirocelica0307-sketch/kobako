import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 姫新線 新見〜美作土居。岡山県内をまるごと東西に横断する最長コース。 */
const STOPS: readonly StationId[] = [
  'niimi', 'iwayama', 'tajibe', 'osakabe', 'tomihara', 'tsukida',
  'chugoku-katsuyama', 'kuse', 'mimasaka-ochiai', 'komi', 'mimasaka-oiwake',
  'mimasaka-sendai', 'innosho', 'tsuyama', 'higashi-tsuyama', 'mimasaka-osaki',
  'nishi-katsumada', 'katsumada', 'hayashino', 'narahara', 'mimasaka-emi', 'mimasaka-doi',
];
const KM = [0, 6.7, 12.5, 16.6, 23.0, 27.9, 32.1, 36.7, 42.5, 46.6, 51.4,
  56.4, 59.9, 64.0, 66.3, 70.4, 73.4, 75.9, 79.7, 83.7, 87.3, 92.0];
const SCENES: readonly SceneKind[] = [
  'mountain', 'mountain', 'mountain', 'river', 'mountain', 'rural',
  'rural', 'river', 'rural', 'rural', 'rural', 'rural', 'suburb',
  'suburb', 'rural', 'rural', 'rural', 'rural', 'rural', 'rural', 'rural',
];

export const KISHIN_LINE: Line = {
  id: 'kishin', nameJp: '姫新線', nameKana: 'きしんせん',
  company: 'JR西日本', lineColor: '#4a9a8a', vehicle: 'kiha120-mizurin',
  destination: '美作土居', originName: '新見', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-local', difficultyOverride: 88,
  scopeNote: '新見〜美作土居　22駅・約92km（最長）',
};
