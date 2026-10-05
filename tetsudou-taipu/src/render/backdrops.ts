import { VIEW_W } from './canvas';
import type { SceneKind } from '../data/types';
import type { SkyPalette, Weather } from './weather';

/**
 * 風景の描き分け。
 *
 * 以前は city / suburb しか分岐しておらず、bridge・sea・river・street が
 * すべて「木と家」に落ちていた。瀬戸大橋を渡っても橋が出なかったのはこれが原因。
 */

const mod = (a: number, n: number) => ((a % n) + n) % n;

export interface BackdropCtx {
  ctx: CanvasRenderingContext2D;
  distance: number;
  groundY: number;
  sky: SkyPalette;
  weather: Weather;
  time: number;
}

/** 遠景の山。山岳路線は高く険しく、海沿いは低く。 */
export function drawHills(c: BackdropCtx, scene: SceneKind): void {
  const { ctx, distance, groundY, sky } = c;
  if (scene === 'bridge' || scene === 'sea') return; // 海の向こうは島にする
  const amp = scene === 'mountain' ? 26 : scene === 'river' ? 18 : 13;
  const base = scene === 'mountain' ? 26 : 18;
  const off = mod(distance * 0.15, 160);
  ctx.fillStyle = sky.hill;
  for (let seg = -160; seg < VIEW_W + 160; seg += 160) {
    for (let x = 0; x < 160; x++) {
      const h = base + Math.round(amp * Math.sin(x * 0.06) + 8 * Math.sin(x * 0.021 + 1.7));
      const px = Math.round(seg - off + x);
      if (px < 0 || px >= VIEW_W) continue;
      ctx.fillRect(px, groundY - 30 - h, 1, h + 30);
    }
  }
  // 山岳路線は稜線を2重にして奥行きを出す
  if (scene === 'mountain') {
    ctx.fillStyle = shade(sky.hill, -14);
    const off2 = mod(distance * 0.24, 130);
    for (let seg = -130; seg < VIEW_W + 130; seg += 130) {
      for (let x = 0; x < 130; x++) {
        const h = 14 + Math.round(16 * Math.sin(x * 0.085 + 2.2));
        const px = Math.round(seg - off2 + x);
        if (px < 0 || px >= VIEW_W) continue;
        ctx.fillRect(px, groundY - 26 - h, 1, h + 26);
      }
    }
  }
}

/** 海。波が横に流れる。 */
function drawSea(c: BackdropCtx, top: number, bottom: number): void {
  const { ctx, distance, time, weather } = c;
  const deep = weather === 'sunset' ? '#3a4f7a' : weather === 'rain' ? '#3f5560' : '#2f6d96';
  const shallow = weather === 'sunset' ? '#8a6a9a' : weather === 'rain' ? '#5b7280' : '#4f9dc4';
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    ctx.fillStyle = mix(deep, shallow, t);
    ctx.fillRect(0, y, VIEW_W, 1);
  }
  // 白波。距離ではなく時間で動かす（停車中も海は動く）
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let row = 0; row < 5; row++) {
    const y = top + 4 + row * Math.max(2, Math.floor((bottom - top) / 6));
    if (y >= bottom) break;
    const speed = 6 + row * 5;
    const off = mod(time * speed + distance * 0.08, 34);
    for (let x = -34; x < VIEW_W + 34; x += 34) {
      ctx.fillRect(Math.round(x + off), y, 4 + row, 1);
    }
  }
}

/** 遠くの島影。瀬戸内らしさを出す。 */
function drawIslands(c: BackdropCtx, horizon: number): void {
  const { ctx, distance, sky } = c;
  ctx.fillStyle = shade(sky.hill, -18);
  const off = mod(distance * 0.12, 190);
  for (let seg = -190; seg < VIEW_W + 190; seg += 190) {
    for (const [cx, w, h] of [[30, 34, 9], [96, 22, 6], [150, 40, 12]] as const) {
      for (let x = -w; x <= w; x++) {
        const px = Math.round(seg - off + cx + x);
        if (px < 0 || px >= VIEW_W) continue;
        const hh = Math.round(h * Math.cos((x / w) * 1.5));
        if (hh > 0) ctx.fillRect(px, horizon - hh, 1, hh);
      }
    }
  }
}

/**
 * 瀬戸大橋。ここが本作のビジュアルの目玉。
 * 主塔が近づき、斜張橋のケーブルが扇状に画面を横切る。
 */
export function drawBridge(c: BackdropCtx): void {
  const { ctx, distance, groundY } = c;
  const horizon = groundY - 34;
  drawIslands(c, horizon);
  drawSea(c, horizon, groundY + 40);

  const steel = '#c8ccd2';
  const steelDark = '#8f959d';
  const period = 300;
  const off = mod(distance, period);

  for (let seg = -period; seg < VIEW_W + period; seg += period) {
    const towerX = Math.round(seg - off + period / 2);

    // ケーブル（扇状）。主塔から桁へ斜めに張る
    ctx.strokeStyle = steelDark;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const spread = i * 17;
      const topY = 6 + i * 3;
      ctx.beginPath();
      ctx.moveTo(towerX + 0.5, topY);
      ctx.lineTo(towerX - spread + 0.5, groundY - 8);
      ctx.moveTo(towerX + 0.5, topY);
      ctx.lineTo(towerX + spread + 0.5, groundY - 8);
      ctx.stroke();
    }

    // 主塔（2本脚＋横梁）
    ctx.fillStyle = steel;
    ctx.fillRect(towerX - 7, 2, 4, groundY - 6);
    ctx.fillRect(towerX + 4, 2, 4, groundY - 6);
    ctx.fillStyle = steelDark;
    for (const y of [8, 26, 52]) ctx.fillRect(towerX - 7, y, 15, 3);
    // 航空障害灯
    ctx.fillStyle = '#ff5d5d';
    ctx.fillRect(towerX - 6, 2, 2, 2);
    ctx.fillRect(towerX + 5, 2, 2, 2);
  }

  // 桁（線路が載る部分）とトラス
  ctx.fillStyle = steelDark;
  ctx.fillRect(0, groundY - 8, VIEW_W, 3);
  ctx.fillStyle = steel;
  ctx.fillRect(0, groundY - 5, VIEW_W, 5);
  const tOff = mod(distance, 24);
  ctx.strokeStyle = steelDark;
  for (let x = -24; x < VIEW_W + 24; x += 24) {
    const px = Math.round(x - tOff);
    ctx.beginPath();
    ctx.moveTo(px + 0.5, groundY - 8);
    ctx.lineTo(px + 12.5, groundY);
    ctx.lineTo(px + 24.5, groundY - 8);
    ctx.stroke();
  }
}

/** 海沿い。水平線と防波堤。 */
export function drawSeaside(c: BackdropCtx): void {
  const { ctx, distance, groundY } = c;
  const horizon = groundY - 30;
  drawIslands(c, horizon);
  drawSea(c, horizon, groundY - 12);
  // 防波堤
  ctx.fillStyle = '#9a958c';
  ctx.fillRect(0, groundY - 14, VIEW_W, 4);
  ctx.fillStyle = '#b6b1a6';
  const off = mod(distance * 0.9, 14);
  for (let x = -14; x < VIEW_W + 14; x += 14) ctx.fillRect(Math.round(x - off), groundY - 14, 7, 1);
}

/** 川。鉄橋のトラスが手前を横切る。 */
export function drawRiver(c: BackdropCtx): void {
  const { ctx, distance, groundY } = c;
  const top = groundY - 22;
  ctx.fillStyle = '#4a7f9e';
  ctx.fillRect(0, top, VIEW_W, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const off = mod(c.time * 9 + distance * 0.1, 26);
  for (let row = 0; row < 3; row++) {
    for (let x = -26; x < VIEW_W + 26; x += 26) {
      ctx.fillRect(Math.round(x + off + row * 9), top + 4 + row * 5, 5, 1);
    }
  }
  // 手前のトラス
  const period = 64;
  const tOff = mod(distance, period);
  ctx.strokeStyle = '#6d7680';
  ctx.lineWidth = 1;
  for (let seg = -period; seg < VIEW_W + period; seg += period) {
    const x0 = Math.round(seg - tOff);
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, groundY - 2);
    ctx.lineTo(x0 + 0.5, groundY - 28);
    ctx.lineTo(x0 + period / 2 + 0.5, groundY - 36);
    ctx.lineTo(x0 + period + 0.5, groundY - 28);
    ctx.lineTo(x0 + period + 0.5, groundY - 2);
    ctx.moveTo(x0 + 0.5, groundY - 28);
    ctx.lineTo(x0 + period + 0.5, groundY - 28);
    ctx.stroke();
  }
}

/** トンネル。壁の照明だけが流れていく。 */
export function drawTunnel(c: BackdropCtx): void {
  const { ctx, distance, groundY } = c;
  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, VIEW_W, groundY + 2);
  ctx.fillStyle = '#1b2029';
  ctx.fillRect(0, groundY - 46, VIEW_W, 46);
  const off = mod(distance, 52);
  for (let x = -52; x < VIEW_W + 52; x += 52) {
    const px = Math.round(x - off);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(px, groundY - 42, 5, 2);
    ctx.fillStyle = 'rgba(255,233,168,0.14)';
    ctx.fillRect(px - 3, groundY - 40, 11, 10);
  }
  // 側壁のケーブルラック
  ctx.fillStyle = '#2a323d';
  ctx.fillRect(0, groundY - 22, VIEW_W, 2);
}

/** 街なか（路面電車）。車道と自動車。 */
export function drawStreet(c: BackdropCtx): void {
  const { ctx, distance, groundY, sky } = c;
  // 商店の並び
  const period = 78;
  const off = mod(distance * 0.45, period);
  for (let seg = -period; seg < VIEW_W + period; seg += period) {
    const x0 = Math.round(seg - off);
    for (const [dx, w, h, col] of [[2, 26, 40, '#c9c2b6'], [32, 20, 52, '#b3aca0'], [56, 18, 34, '#d2cabb']] as const) {
      ctx.fillStyle = col;
      ctx.fillRect(x0 + dx, groundY - 22 - h, w, h);
      ctx.fillStyle = '#5d7f96';
      for (let wy = groundY - 22 - h + 5; wy < groundY - 28; wy += 8) {
        for (let wx = x0 + dx + 3; wx < x0 + dx + w - 3; wx += 6) ctx.fillRect(wx, wy, 3, 4);
      }
      ctx.fillStyle = '#8a6f63';
      ctx.fillRect(x0 + dx - 1, groundY - 23 - h, w + 2, 2);
    }
  }
  // 車道
  ctx.fillStyle = '#4b4f57';
  ctx.fillRect(0, groundY - 22, VIEW_W, 22);
  ctx.fillStyle = '#d8d2c4';
  const lOff = mod(distance, 18);
  for (let x = -18; x < VIEW_W + 18; x += 18) ctx.fillRect(Math.round(x - lOff), groundY - 17, 9, 1);
  // 自動車（電車より少し遅く流れる）
  const cOff = mod(distance * 0.8, 120);
  for (let seg = -120; seg < VIEW_W + 120; seg += 120) {
    const cx = Math.round(seg - cOff);
    for (const [dx, col] of [[10, '#c0392b'], [64, '#3b7fc4']] as const) {
      ctx.fillStyle = col;
      ctx.fillRect(cx + dx, groundY - 14, 16, 5);
      ctx.fillRect(cx + dx + 3, groundY - 17, 9, 3);
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(cx + dx + 2, groundY - 9, 3, 2);
      ctx.fillRect(cx + dx + 11, groundY - 9, 3, 2);
    }
  }
  void sky;
}

// ---- 色のユーティリティ ----

function parse(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function toHex(v: readonly number[]): string {
  return `#${v.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a); const pb = parse(b);
  return toHex(pa.map((v, i) => v + (pb[i]! - v) * t));
}
export function shade(hex: string, amount: number): string {
  return toHex(parse(hex).map((v) => v + amount));
}
