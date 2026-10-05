import { buildNodes, type TypingNode } from '../kana/patterns';
import { normalizeKey } from '../kana/normalize';
import type { KeyResult, TypingState } from './types';

function allIndices(node: TypingNode | undefined): number[] {
  if (node === undefined) return [];
  return node.patterns.map((_, i) => i);
}

/** nodes[i..] の preferred 綴りを連結した配列を作る。 */
function buildSuffixHints(nodes: readonly TypingNode[]): string[] {
  const out = new Array<string>(nodes.length + 1);
  out[nodes.length] = '';
  for (let i = nodes.length - 1; i >= 0; i--) {
    out[i] = (nodes[i]!.patterns[0] ?? '') + out[i + 1]!;
  }
  return out;
}

export function createTypingState(reading: string): TypingState {
  const nodes = buildNodes(reading);
  return {
    nodes,
    suffixHint: buildSuffixHints(nodes),
    nodeIndex: 0,
    typed: '',
    committed: '',
    viable: allIndices(nodes[0]),
    hintIndex: 0,
    done: nodes.length === 0,
  };
}

/** ノードを確定して次へ進める。 */
function commitNode(st: TypingState, typed: string): TypingState {
  const nodeIndex = st.nodeIndex + 1;
  const next = st.nodes[nodeIndex];
  return {
    ...st,
    nodeIndex,
    typed: '',
    committed: st.committed + typed,
    viable: allIndices(next),
    hintIndex: 0,
    done: nodeIndex >= st.nodes.length,
  };
}

/** いま打てる文字の集合。ミス分析とヒント表示に使う。 */
export function expectedChars(st: TypingState): string[] {
  const node = st.nodes[st.nodeIndex];
  if (node === undefined) return [];
  const set = new Set<string>();
  for (const i of st.viable) {
    const p = node.patterns[i]!;
    if (p.length > st.typed.length) set.add(p[st.typed.length]!);
  }
  // 現ノードが完成形なら、次ノードの先頭文字も打てる（「ん」→「こ」など）
  const closable = st.viable.some((i) => node.patterns[i] === st.typed);
  const next = st.nodes[st.nodeIndex + 1];
  if (closable && next !== undefined) {
    for (const p of next.patterns) set.add(p[0]!);
  }
  return [...set];
}

/**
 * 表示候補を選ぶ。
 * いま表示している候補がまだ生きているなら絶対に変えない（sticky preferred）。
 * これにより、正攻法で打つ人はヒントが一切揺れない。
 */
function pickHint(current: number, viable: readonly number[]): number {
  return viable.includes(current) ? current : (viable[0] ?? 0);
}

/**
 * 1打鍵を処理する。
 *
 * 肝は commit-and-retry:
 * 現ノードを伸ばせなくても、現ノードが既に完成形なら確定して
 * 同じキーを次ノードの先頭として解釈し直す（「ん」を "n" で打った直後に
 * 子音が来るケース）。
 */
export function feedKey(state: TypingState, rawKey: string): KeyResult {
  const key = normalizeKey(rawKey);
  if (key === null || state.done) return { type: 'ignore' };

  let st = state;
  // 確定を挟んだ再試行は最大1回（確定可能なノードは連続しない）
  for (let attempt = 0; attempt < 2; attempt++) {
    const node = st.nodes[st.nodeIndex];
    if (node === undefined) break;

    const cand = st.typed + key;
    const viable = st.viable.filter((i) => node.patterns[i]!.startsWith(cand));

    if (viable.length > 0) {
      const exact = viable.some((i) => node.patterns[i] === cand);
      const extendable = viable.some((i) => node.patterns[i]!.length > cand.length);

      if (exact && !extendable) {
        const next = commitNode(st, cand);
        return {
          type: 'hit',
          state: next,
          nodeCompleted: true,
          finished: next.done,
        };
      }
      return {
        type: 'hit',
        state: {
          ...st,
          typed: cand,
          viable,
          hintIndex: pickHint(st.hintIndex, viable),
        },
        nodeCompleted: false,
        finished: false,
      };
    }

    // 現ノードを伸ばせない。既に完成形なら確定して次ノードで再試行する。
    const closable = st.viable.some((i) => node.patterns[i] === st.typed);
    if (closable && st.nodeIndex + 1 < st.nodes.length) {
      st = commitNode(st, st.typed);
      continue;
    }
    break;
  }

  // ミス時は状態を一切変えない
  return { type: 'miss', state, expected: expectedChars(state) };
}
