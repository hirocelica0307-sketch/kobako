import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 赤穂線 東岡山〜播州赤穂。瀬戸内の海沿いを行く。 */
const STOPS: readonly StationId[] = [
  'higashi-okayama', 'oodara', 'saidaiji', 'oodomi', 'oku', 'osafune', 'kagato',
  'imbe', 'nishi-katakami', 'bizen-katakami', 'iri', 'hinase', 'sougo',
  'bizen-fukukawa', 'tenwa', 'sakoshi', 'banshu-ako',
];
const KM = [0, 2.2, 4.8, 8.3, 11.0, 14.2, 17.7, 20.2, 23.4, 24.6, 27.8, 33.3, 36.2, 38.5, 41.4, 44.1, 48.0];
const SCENES: readonly SceneKind[] = [
  'suburb', 'suburb', 'rural', 'rural', 'rural', 'rural', 'rural',
  'rural', 'sea', 'sea', 'sea', 'sea', 'sea', 'sea', 'sea', 'sea',
];

export const AKO_LINE: Line = {
  id: 'ako', nameJp: '赤穂線', nameKana: 'あこうせん',
  company: 'JR西日本', lineColor: '#e05a8a', vehicle: '115-yellow',
  destination: '播州赤穂', originName: '東岡山', trainType: '普通',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main', difficultyOverride: 48,
  scopeNote: '東岡山〜播州赤穂　17駅・約48km',
};
