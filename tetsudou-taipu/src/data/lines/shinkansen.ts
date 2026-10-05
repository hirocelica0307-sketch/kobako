import type { Line, SceneKind, StationId } from '../types';
import { buildSegments } from './shared';

/**
 * 山陽新幹線 新神戸〜広島。
 * 駅は少ないが駅間が長いので、1駅あたりの運賃が桁違いに大きい高額コース。
 */
const STOPS: readonly StationId[] = [
  'shin-kobe', 'nishi-akashi', 'himeji', 'aioi', 'okayama',
  'shinkurashiki', 'fukuyama', 'shin-onomichi', 'mihara',
  'higashi-hiroshima', 'hiroshima',
];
const KM = [0, 22.8, 54.8, 66.7, 112.6, 134.3, 162.9, 182.0, 197.5, 227.0, 252.3];
const SCENES: readonly SceneKind[] = [
  'tunnel', 'city', 'city', 'tunnel', 'city',
  'suburb', 'city', 'tunnel', 'suburb', 'tunnel',
];

export const SHINKANSEN_LINE: Line = {
  id: 'shinkansen', nameJp: '山陽新幹線', nameKana: 'さんようしんかんせん',
  company: 'JR西日本', lineColor: '#1b4f9c', vehicle: 'n700-shinkansen',
  destination: '広島', originName: '新神戸', trainType: 'のぞみ',
  stops: STOPS, segments: buildSegments(STOPS, KM, SCENES),
  fareRule: 'jr-main', surchargeRule: 'shinkansen',
  difficultyOverride: 40,
  scopeNote: '新神戸〜広島　11駅・約252km（1駅が高額）',
};
