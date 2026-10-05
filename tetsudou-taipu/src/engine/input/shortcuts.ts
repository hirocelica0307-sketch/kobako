import type { Phase } from '../game/engine';

/**
 * 文字キーのショートカット。
 *
 * **駅名を打っている間（atStation）は、文字キーを1つも予約してはいけない。**
 * ローマ字は a〜z をすべて使うので、1つでも横取りすると
 * その文字を含む駅が打てなくなる（実際に M を予約して
 * 「三門（みかど）」が打てない不具合を出した）。
 */
export const LETTER_SHORTCUTS: Readonly<Record<string, readonly Phase[]>> = {
  // ミュート。入力中以外のどこでも効く
  m: ['title', 'lineSelect', 'config', 'countdown', 'departing', 'turnaround', 'result'],
  // もう一度
  r: ['result'],
  // タイトルへ戻る
  t: ['result'],
};

/** その画面でその文字キーがショートカットとして予約されているか。 */
export function isReservedLetter(key: string, phase: Phase): boolean {
  return LETTER_SHORTCUTS[key.toLowerCase()]?.includes(phase) ?? false;
}

/** 打鍵中に予約されている文字キー。**常に空でなければならない。** */
export function lettersReservedWhileTyping(): string[] {
  return Object.entries(LETTER_SHORTCUTS)
    .filter(([, phases]) => phases.includes('atStation'))
    .map(([key]) => key);
}
