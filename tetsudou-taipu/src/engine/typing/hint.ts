import type { RomajiDisplay, TypingState } from './types';

/** ローマ字3段目の表示内容を組み立てる。 */
export function renderRomaji(st: TypingState): RomajiDisplay {
  const node = st.nodes[st.nodeIndex];
  if (node === undefined) {
    return { committed: st.committed, active: '', rest: '', upcoming: '' };
  }
  const hint = node.patterns[st.hintIndex] ?? node.patterns[0] ?? '';
  return {
    committed: st.committed,
    active: st.typed,
    rest: hint.slice(st.typed.length),
    upcoming: st.suffixHint[st.nodeIndex + 1] ?? '',
  };
}

/** ふりがな行の着色位置。[確定済み文字数, 入力中の文字数]。 */
export function furiganaSplit(st: TypingState): { done: number; active: number } {
  let done = 0;
  for (let i = 0; i < st.nodeIndex; i++) done += st.nodes[i]!.kanaLength;
  const node = st.nodes[st.nodeIndex];
  return { done, active: node?.kanaLength ?? 0 };
}

/** その読みを preferred 綴りで打った場合の総打鍵数。難易度計算に使う。 */
export function preferredLength(st: TypingState): number {
  return st.suffixHint[0]?.length ?? 0;
}
