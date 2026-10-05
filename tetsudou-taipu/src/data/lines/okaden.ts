import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 岡山電気軌道 東山本線。路面電車。駅名が短く電停の間隔も短いので入門に最適。 */
const STOPS: readonly StationId[] = [
  'okaden-ekimae', 'nishigawa-park', 'yanagawa', 'shiroshita', 'kencho-dori',
  'saidaijicho', 'kobashi', 'chunagon', 'kadotayashiki', 'higashiyama-okaden',
];
const KM = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 1.9, 2.2, 2.5, 3.1];
const SCENES: readonly SceneKind[] = [
  'street', 'street', 'street', 'street', 'street', 'street', 'street', 'street', 'street',
];

export const OKADEN_LINE: Line = {
  id: 'okaden', nameJp: '東山本線', nameKana: 'ひがしやまほんせん',
  nickname: '岡電', company: '岡山電気軌道',
  lineColor: '#1f7a4a', vehicle: 'momo-tram',
  destination: '東山', originName: '岡山駅前', trainType: '電車',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'okaden-flat', difficultyOverride: 10,
  scopeNote: '岡山駅前〜東山　10電停・約3km（いちばんやさしい）',
};
