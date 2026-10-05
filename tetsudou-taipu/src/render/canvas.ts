/** 論理解像度。すべての描画座標はこの中の整数で考える。 */
export const VIEW_W = 320;
export const VIEW_H = 180;

/**
 * 画面下のキーボードが占める高さ。**ステージ幅に対する比**で持つ。
 *
 * キーボードは幅がステージの 62%、1段が 0.62u、5段＋すき間＋余白で 3.66u。
 * 1u = 幅/15 なので
 *   0.62 × 3.66 / 15 ≒ 0.151
 * 端数の分を少し足して 0.155。keyboard.css の値を変えたらここも合わせる。
 * 先に差し引いておかないと、ステージが縦にはみ出す。
 */
export const KEYBOARD_RESERVE = 0.155;

export interface Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** 現在の拡大倍率。 */
  scale: number;
}

/**
 * 320x180 の論理解像度を持つ Canvas を用意する。
 * CSS で拡大し、image-rendering: pixelated を効かせることで
 * ぼやけない本物のドット絵になる。
 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx === null) throw new Error('2d context unavailable');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, scale: 1 };
}

/**
 * 親要素に収まる最大の倍率を求める。
 *
 * 整数倍だけに丸めていたころは、1366×768 の Chromebook で
 * 倍率 4 に届かず 3 に落ち、画面の4分の1が余っていた。
 * 「画面が小さくて運賃が見えない」と言われたのはこれが原因なので、
 * **0.25 刻み**まで許す。320 と 180 のどちらも 0.25 刻みなら整数 px に収まり、
 * 最近傍拡大の周期も 4px 以内なのでドット絵の見え方はほとんど変わらない。
 *
 * @param reserveRatio ステージ幅に対して、下に空けておく高さの比
 */
export function fitScale(containerW: number, containerH: number, reserveRatio = 0): number {
  // 高さは「ステージ + 予約ぶん」で判定する
  const byW = containerW / VIEW_W;
  const byH = containerH / (VIEW_H + VIEW_W * reserveRatio);
  const raw = Math.min(byW, byH);
  return Math.max(1, Math.floor(raw * 4) / 4);
}
