import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 因美線 東津山〜智頭。美作の山里を抜けて鳥取へ。 */
const STOPS: readonly StationId[] = [
  'higashi-tsuyama', 'takano', 'mimasaka-takio', 'miura', 'mimasaka-kamo',
  'chiwa', 'mimasaka-kawai', 'nagi', 'haji', 'chizu',
];
const KM = [0, 3.9, 7.4, 10.4, 12.7, 17.8, 21.1, 25.1, 31.2, 34.4];
const SCENES: readonly SceneKind[] = [
  'rural', 'rural', 'river', 'rural', 'mountain', 'mountain', 'mountain', 'tunnel', 'mountain',
];

export const INBI_LINE: Line = {
  id: 'inbi', nameJp: '因美線', nameKana: 'いんびせん',
  company: 'JR西日本', lineColor: '#c88a2a', vehicle: 'kiha120-mizurin',
  destination: '智頭', originName: '東津山', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-local', difficultyOverride: 70,
  scopeNote: '東津山〜智頭　10駅・約34km',
};
