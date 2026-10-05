/**
 * 画面下に出す JIS キーボード（Chromebook 配列）の並び。
 *
 * コンポーネントから分けてあるのは、
 * **駅名を打つのに必要なキーが全部そろっているか**をテストで確かめるため。
 * 1つでも欠けると、そのキーを含む駅で「光らないのに押さないと進まない」
 * という一番たちの悪い状態になる。
 */

export interface KeyDef {
  /** KeyboardEvent.key と突き合わせる文字。打鍵に使わないキーは null。 */
  code: string | null;
  /** キートップの表示。**大文字は使わない**（画面のローマ字と合わせる）。 */
  label: string;
  /**
   * Shift を押したときに出る文字。
   * 「ん」を n' と打つ人がいるので、' がどのキーかも分かる必要がある
   * （JIS では Shift + 7）。
   */
  shifted?: string;
  /** キー幅。1 = 標準キー1個ぶん。 */
  u: number;
  /** 打鍵に使わない修飾キー。薄く描く。 */
  mod?: true;
}

const K = (code: string, label = code, u = 1): KeyDef => ({ code, label, u });
/** Shift 付きの文字も出るキー。 */
const KS = (code: string, shifted: string, u = 1): KeyDef => ({ code, label: code, shifted, u });
const MOD = (label: string, u: number): KeyDef => ({ code: null, label, u, mod: true });

/** 段の合計幅。修飾キーの幅を実物どおりにするために、全段でそろえてある。 */
export const ROW_UNITS = 15;

/**
 * 数字段から下だけを出す。
 * 最上段のファンクション行は打鍵に使わないので、場所を取らせない。
 */
export const KEY_ROWS: readonly (readonly KeyDef[])[] = [
  [
    KS('1', '!'), KS('2', '"'), KS('3', '#'), KS('4', '$'), KS('5', '%'),
    KS('6', '&'), KS('7', "'"), KS('8', '('), KS('9', ')'), K('0'),
    KS('-', '='), KS('^', '~'), KS('¥', '|'), MOD('back space', 2),
  ],
  [
    MOD('tab', 1.5),
    K('q'), K('w'), K('e'), K('r'), K('t'), K('y'), K('u'), K('i'), K('o'), K('p'),
    KS('@', '`'), KS('[', '{'), MOD('enter', 1.5),
  ],
  [
    MOD('けんさく', 1.75),
    K('a'), K('s'), K('d'), K('f'), K('g'), K('h'), K('j'), K('k'), K('l'),
    KS(';', '+'), KS(':', '*'), KS(']', '}'), MOD('', 1.25),
  ],
  [
    MOD('shift', 2.25),
    K('z'), K('x'), K('c'), K('v'), K('b'), K('n'), K('m'),
    KS(',', '<'), KS('.', '>'), KS('/', '?'), KS('\\', '_'), MOD('shift', 1.75),
  ],
  [
    MOD('ctrl', 1.25), MOD('alt', 1.25), MOD('えいすう', 1.25),
    K(' ', 'space', 5.5),
    MOD('かな', 1.25), MOD('alt', 1.25), MOD('ctrl', 1.25), MOD('←↑↓→', 2),
  ],
];

/** ホームポジションの目印を付けるキー。 */
export const HOME_KEYS: ReadonlySet<string> = new Set(['f', 'j']);

/** 実際に押せる文字の一覧（Shift 付きで出る文字も含む）。 */
export function typableKeys(): string[] {
  const out: string[] = [];
  for (const k of KEY_ROWS.flat()) {
    if (k.code !== null) out.push(k.code);
    if (k.shifted !== undefined) out.push(k.shifted);
  }
  return out;
}

/** その文字を出すキーが光るか。Shift 付きの文字でも同じキーを光らせる。 */
export function keyMatches(k: KeyDef, ch: string): boolean {
  const c = ch.toLowerCase();
  return (k.code !== null && k.code.toLowerCase() === c) || k.shifted === ch;
}
