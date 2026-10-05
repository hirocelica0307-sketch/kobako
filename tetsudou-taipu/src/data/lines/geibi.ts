import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 芸備線 備中神代〜備後落合。県西端の山あいを行く難読駅の連続。 */
const STOPS: readonly StationId[] = [
  'bitchu-kojiro', 'sakane', 'ichioka', 'yagami', 'nochi', 'tojo',
  'bingo-yawata', 'uchina', 'onuka', 'dogoyama', 'bingo-ochiai',
];
const KM = [0, 6.5, 9.5, 12.7, 16.3, 21.8, 28.9, 33.0, 38.3, 43.5, 48.1];
const SCENES: readonly SceneKind[] = [
  'mountain', 'mountain', 'river', 'mountain', 'mountain',
  'mountain', 'tunnel', 'mountain', 'mountain', 'mountain',
];

export const GEIBI_LINE: Line = {
  id: 'geibi', nameJp: '芸備線', nameKana: 'げいびせん',
  company: 'JR西日本', lineColor: '#7a5aa8', vehicle: 'kiha120-mizurin',
  destination: '備後落合', originName: '備中神代', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-local', difficultyOverride: 84,
  scopeNote: '備中神代〜備後落合　11駅・約48km（最難読）',
};
