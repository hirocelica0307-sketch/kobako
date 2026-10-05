import type { TypingNode } from '../kana/patterns';

export type { TypingNode };

export interface TypingState {
  readonly nodes: readonly TypingNode[];
  /** suffixHint[i] = nodes[i..] の preferred 綴りを連結したもの（事前計算）。 */
  readonly suffixHint: readonly string[];
  readonly nodeIndex: number;
  /** 現ノードで打鍵済みの文字列。 */
  readonly typed: string;
  /** 確定済みノードの実打鍵文字列。 */
  readonly committed: string;
  /** 現ノードで生き残っている綴りの index。 */
  readonly viable: readonly number[];
  /** 表示中の候補 index。viable な限り変えない（ちらつき防止）。 */
  readonly hintIndex: number;
  readonly done: boolean;
}

export type KeyResult =
  | { type: 'hit'; state: TypingState; nodeCompleted: boolean; finished: boolean }
  | { type: 'miss'; state: TypingState; expected: readonly string[] }
  | { type: 'ignore' };

export interface RomajiDisplay {
  /** 確定済みノードの実打鍵（着色済み）。 */
  committed: string;
  /** 現ノードで打鍵済み（着色済み）。 */
  active: string;
  /** 現ノードの残り（未入力）。 */
  rest: string;
  /** 以降のノードの preferred 綴り（未入力）。 */
  upcoming: string;
}
