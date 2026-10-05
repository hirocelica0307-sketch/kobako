import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 水島臨海鉄道 水島本線。倉敷から工場地帯へ。 */
const STOPS: readonly StationId[] = [
  'kurashikishi', 'kyujomae', 'nishi-tomii', 'fukui', 'urata',
  'yayoi', 'sakae', 'tokiwa', 'mizushima', 'mitsubishi-jiko-mae',
];
const KM = [0, 1.6, 2.4, 3.2, 4.5, 5.5, 6.2, 6.8, 7.5, 10.4];
const SCENES: readonly SceneKind[] = [
  'city', 'suburb', 'suburb', 'suburb', 'suburb', 'suburb', 'city', 'city', 'city',
];

export const MIZURIN_LINE: Line = {
  id: 'mizurin', nameJp: '水島本線', nameKana: 'みずしまほんせん',
  nickname: '水島臨海鉄道', company: '水島臨海鉄道',
  lineColor: '#1a6f3c', vehicle: 'kiha120-mizurin',
  destination: '三菱自工前', originName: '倉敷市', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'mizurin', difficultyOverride: 22,
  scopeNote: '倉敷市〜三菱自工前　10駅・約10km',
};
