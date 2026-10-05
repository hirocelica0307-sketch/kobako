import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/** 宇野線（宇野みなと線）岡山〜宇野。瀬戸内海へ向かう。 */
const STOPS: readonly StationId[] = [
  'okayama', 'omoto', 'bizen-nishiichi', 'senoo', 'bitchu-mishima', 'hayashima',
  'kuguhara', 'chayamachi', 'hikosaki', 'bizen-kataoka', 'hazakawa',
  'tsuneyama', 'hachihama', 'bizen-tai', 'uno',
];
const KM = [0, 2.0, 4.0, 6.7, 8.5, 10.2, 11.7, 14.9, 19.0, 20.9, 22.4, 24.2, 26.8, 30.3, 32.8];
const SCENES: readonly SceneKind[] = [
  'city', 'city', 'suburb', 'suburb', 'rural', 'rural', 'rural',
  'rural', 'rural', 'rural', 'rural', 'sea', 'sea', 'sea',
];

export const UNO_LINE: Line = {
  id: 'uno',
  nameJp: '宇野線',
  nameKana: 'うのせん',
  nickname: '宇野みなと線',
  company: 'JR西日本',
  lineColor: '#2aa3c8',
  vehicle: '105-red',
  destination: '宇野',
  originName: '岡山',
  trainType: '普通',
  stops: STOPS,
  segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main',
  difficultyOverride: 26,
  scopeNote: '岡山〜宇野　15駅・約33km',
};
