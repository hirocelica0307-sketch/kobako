import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 智頭急行 智頭線 上郡〜智頭。個性的な駅名が並ぶ。 */
const STOPS: readonly StationId[] = [
  'kamigori', 'kokenawa', 'kounohara-enshin', 'kuzaki', 'sayo', 'hirafuku',
  'ishii', 'miyamoto-musashi', 'ohara', 'nishi-awakura', 'awakura-onsen',
  'yamasato', 'koiyamagata', 'chizu',
];
const KM = [0, 4.1, 6.1, 9.7, 14.2, 18.7, 23.7, 27.1, 30.3, 35.4, 38.9, 43.1, 48.3, 56.1];
const SCENES: readonly SceneKind[] = [
  'rural', 'river', 'river', 'rural', 'rural', 'mountain', 'mountain',
  'rural', 'mountain', 'mountain', 'tunnel', 'mountain', 'mountain',
];

export const CHIZU_LINE: Line = {
  id: 'chizu', nameJp: '智頭線', nameKana: 'ちずせん',
  company: '智頭急行', lineColor: '#c8102e', vehicle: 'hot7000',
  destination: '智頭', originName: '上郡', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'chizu-fare', difficultyOverride: 74,
  scopeNote: '上郡〜智頭　14駅・約56km',
};
