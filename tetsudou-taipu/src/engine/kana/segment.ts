import { BASE, SMALL, DIGRAPH, SMALL_KANA } from './romajiTable';

export type ChunkKind = 'kana' | 'sokuon' | 'hatsuon' | 'choon';

export interface KanaChunk {
  /** 表示・着色に使う元のかな。促音ノードは "っちゅ" のように促音を含む。 */
  readonly kana: string;
  readonly kind: ChunkKind;
  /** 促音を取り除いた本体。"っちゅ" → "ちゅ"。語尾の「っ」は空文字。 */
  readonly core: string;
}

/** 拗音の後半になれる小書きかな（「っ」は除く）。 */
const YOUON_SMALL = new Set([...SMALL_KANA].filter((k) => k !== 'っ'));

/** 2文字で1チャンクになるか（拗音）。 */
function isDigraph(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  if (!YOUON_SMALL.has(b)) return false;
  if (DIGRAPH[a + b] !== undefined) return true;
  // DIGRAPH に無くても BASE×SMALL で打てるなら拗音として扱う
  return BASE[a] !== undefined;
}

/** 促音・撥音以外の1チャンクを読む。読めなければ null。 */
function readSimple(s: string, i: number): KanaChunk | null {
  const a = s[i];
  if (a === undefined) return null;
  if (a === 'ー') return { kana: 'ー', kind: 'choon', core: 'ー' };
  if (a === 'ん') return { kana: 'ん', kind: 'hatsuon', core: 'ん' };
  if (a === 'っ') return null; // 促音は呼び出し側で処理する
  if (isDigraph(a, s[i + 1])) {
    const kana = a + s[i + 1]!;
    return { kana, kind: 'kana', core: kana };
  }
  if (BASE[a] !== undefined || SMALL[a] !== undefined) {
    return { kana: a, kind: 'kana', core: a };
  }
  return null;
}

/**
 * 正規化済みのかな列をチャンクに分割する。
 *
 * 促音は**次のチャンクに吸収**する。`っち` を `cchi` と打つとき重ねる子音は
 * 次チャンクで選ばれた綴りに依存するため、ノードを分けると
 * ノード間の制約が必要になりマッチャが破綻する。
 */
export function segmentKana(normalized: string): KanaChunk[] {
  const out: KanaChunk[] = [];
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i]!;
    if (c === 'っ') {
      const next = readSimple(normalized, i + 1);
      if (next === null || next.kind === 'hatsuon' || next.kind === 'choon') {
        // 「っ」単独（語尾、または撥音・長音の前）は小書き文字として打つ
        out.push({ kana: 'っ', kind: 'sokuon', core: '' });
        i += 1;
      } else {
        out.push({ kana: c + next.kana, kind: 'sokuon', core: next.core });
        i += 1 + next.kana.length;
      }
      continue;
    }
    const chunk = readSimple(normalized, i);
    if (chunk === null) {
      i += 1; // 想定外の文字は読み飛ばす（normalizeKana で除去済みのはず）
      continue;
    }
    out.push(chunk);
    i += chunk.kana.length;
  }
  return out;
}
