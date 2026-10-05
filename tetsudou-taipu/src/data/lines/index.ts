import type { Line, LineId } from '../types';
import { OKADEN_LINE } from './okaden';
import { KIBI_LINE } from './kibi';
import { MIZURIN_LINE } from './mizurin';
import { UNO_LINE } from './uno';
import { SANYO_MAIN_DOWN } from './sanyo-main';
import { SETO_OHASHI_LINE } from './seto-ohashi';
import { SHINKANSEN_LINE } from './shinkansen';
import { AKO_LINE } from './ako';
import { TSUYAMA_LINE } from './tsuyama';
import { INBI_LINE } from './inbi';
import { CHIZU_LINE } from './chizu';
import { HAKUBI_LINE } from './hakubi';
import { GEIBI_LINE } from './geibi';
import { KISHIN_LINE } from './kishin';
import { IBARA_LINE } from './ibara';

/** やさしい順に並べる。路線選択はこの順で出る。 */
export const LINES: readonly Line[] = [
  OKADEN_LINE,      // ★1 路面電車・電停が短い
  KIBI_LINE,        // ★1 桃太郎線
  MIZURIN_LINE,     // ★2 水島臨海
  UNO_LINE,         // ★2 海へ
  SETO_OHASHI_LINE, // ★3 瀬戸大橋を渡る
  SANYO_MAIN_DOWN,  // ★3 県を横断
  SHINKANSEN_LINE,  // ★3 駅は少ないが高額
  AKO_LINE,         // ★3 瀬戸内の海沿い
  TSUYAMA_LINE,     // ★4 里山
  INBI_LINE,        // ★4 美作の山里
  CHIZU_LINE,       // ★4 智頭急行
  HAKUBI_LINE,      // ★5 難読の宝庫
  GEIBI_LINE,       // ★5 最難読
  KISHIN_LINE,      // ★5 最長
  IBARA_LINE,       // ★5 長い駅名
];

export const LINE_MAP: ReadonlyMap<LineId, Line> = new Map(LINES.map((l) => [l.id, l]));

export function getLine(id: LineId): Line {
  const l = LINE_MAP.get(id);
  if (l === undefined) throw new Error(`unknown line: ${id}`);
  return l;
}

export const DEFAULT_LINE_ID = OKADEN_LINE.id;
