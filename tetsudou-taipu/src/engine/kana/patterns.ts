import {
  BASE, SMALL, DIGRAPH, VOWELS,
  N_BLOCKING_HEADS, CHOON_PATTERNS, HATSUON_PATTERNS, SOKUON_STANDALONE,
} from './romajiTable';
import { normalizeKana } from './normalize';
import { segmentKana, type KanaChunk } from './segment';

export type NodeKind = KanaChunk['kind'];

export interface TypingNode {
  /** 元のかな。促音ノードは "っちゅ"。 */
  readonly kana: string;
  /** ふりがな着色に使う文字数。 */
  readonly kanaLength: number;
  readonly kind: NodeKind;
  /** 許容される綴り。先頭が preferred（ヒント表示の既定）。 */
  readonly patterns: readonly string[];
}

function dedupe(xs: readonly string[]): string[] {
  return [...new Set(xs)].filter((x) => x.length > 0);
}

/** 促音・撥音以外の本体の綴りを求める。 */
function patternsForCore(core: string): string[] {
  if (core === 'ー') return [...CHOON_PATTERNS];
  if (core.length === 2) {
    const a = core[0]!;
    const b = core[1]!;
    const shorthand = DIGRAPH[core] ?? [];
    const cross: string[] = [];
    for (const base of BASE[a] ?? []) {
      for (const small of SMALL[b] ?? []) cross.push(base + small);
    }
    return dedupe([...shorthand, ...cross]);
  }
  return dedupe([...(BASE[core] ?? []), ...(SMALL[core] ?? [])]);
}

/**
 * 促音ノードの綴り。
 * 「っな」を "nna" と打つことはできない（それは「んあ」になる）ので、
 * 次の綴りの先頭が母音か 'n' のときは子音重ねを生成しない。
 */
function patternsForSokuon(core: string): string[] {
  if (core === '') return [...SOKUON_STANDALONE];
  const inner = patternsForCore(core);
  const doubled: string[] = [];
  for (const p of inner) {
    const head = p[0]!;
    if (VOWELS.has(head) || head === 'n') continue;
    doubled.push(head + p);
  }
  const spelled: string[] = [];
  for (const x of SOKUON_STANDALONE) {
    for (const p of inner) spelled.push(x + p);
  }
  return dedupe([...doubled, ...spelled]);
}

/**
 * 撥音ノードの綴り。
 * 単独 "n" で確定できるのは、次のかながあ行・な行・や行・ん・小書き母音の
 * いずれでもないときだけ。語尾の「ん」も "nn" が必須になる。
 */
function patternsForHatsuon(next: KanaChunk | undefined): string[] {
  if (next === undefined) return [...HATSUON_PATTERNS];
  const head = next.kana[0]!;
  if (N_BLOCKING_HEADS.has(head)) return [...HATSUON_PATTERNS];
  return ['n', ...HATSUON_PATTERNS];
}

function toNode(chunk: KanaChunk, next: KanaChunk | undefined): TypingNode {
  let patterns: string[];
  switch (chunk.kind) {
    case 'sokuon':
      patterns = patternsForSokuon(chunk.core);
      break;
    case 'hatsuon':
      patterns = patternsForHatsuon(next);
      break;
    case 'choon':
      patterns = [...CHOON_PATTERNS];
      break;
    default:
      patterns = patternsForCore(chunk.core);
  }
  return {
    kana: chunk.kana,
    kanaLength: chunk.kana.length,
    kind: chunk.kind,
    patterns: Object.freeze(patterns),
  };
}

/** 駅名の読み（かな）から打鍵ノード列を作る。入力判定の唯一の入口。 */
export function buildNodes(reading: string): TypingNode[] {
  const chunks = segmentKana(normalizeKana(reading));
  return chunks.map((chunk, i) => toNode(chunk, chunks[i + 1]));
}
