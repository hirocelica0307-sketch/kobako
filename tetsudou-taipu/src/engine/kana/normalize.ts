/**
 * かな正規化。
 * 駅名の読みは `kana` フィールドに手入力されるが、表記ゆれを吸収して
 * セグメンタが扱える形（ひらがな + 長音符）に落とす。
 */

const KATAKANA_START = 0x30a1; // ァ
const KATAKANA_END = 0x30f6; // ヶ
const KANA_OFFSET = 0x60; // カタカナ → ひらがな

/** セグメンタが受理する文字。これ以外は入力対象から除外される。 */
const ACCEPTED = /[ぁ-ゖー]/;

/**
 * カタカナをひらがなに、全角スペース・中黒・括弧などの装飾を除去する。
 * 「東山・おかでんミュージアム」→「ひがしやまおかでんみゅーじあむ」のように、
 * 駅名に含まれる記号は打鍵対象にしない。
 */
export function normalizeKana(raw: string): string {
  let out = '';
  for (const ch of raw.normalize('NFKC')) {
    const code = ch.codePointAt(0)!;
    let c = ch;
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      c = String.fromCodePoint(code - KANA_OFFSET);
    }
    // ヴ(30f4) は上の変換で ゔ(3094) になる。
    if (ACCEPTED.test(c)) out += c;
  }
  return out;
}

/** 入力キーの正規化。打鍵対象外なら null を返す。 */
export function normalizeKey(rawKey: string): string | null {
  if (rawKey.length !== 1) return null; // Shift, ArrowLeft, F5 ...
  const k = rawKey.toLowerCase();
  return /^[a-z0-9\-',.]$/.test(k) ? k : null;
}
