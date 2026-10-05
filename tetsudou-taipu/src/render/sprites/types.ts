/** 1文字1ピクセルのスプライト定義。'.' は透明。 */
export interface ShapeDef {
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

/** トークン文字 → 色。形状は色を持たず、塗装（リバリー）で着せ替える。 */
export type Livery = Readonly<Record<string, string>>;

/** 定義した行が宣言した幅と一致するか検査する（打ち間違い検出）。 */
export function assertShape(name: string, s: ShapeDef): ShapeDef {
  if (s.rows.length !== s.h) {
    throw new Error(`${name}: rows=${s.rows.length} but h=${s.h}`);
  }
  s.rows.forEach((r, i) => {
    if (r.length !== s.w) throw new Error(`${name}: row ${i} length=${r.length} but w=${s.w}`);
  });
  return s;
}
