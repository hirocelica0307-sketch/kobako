import { VIEW_H, VIEW_W } from './canvas';
import { bake, blit } from './bake';
import { LIVERIES, SCENE_COLORS as C } from './palette';
import { EMU_SUBURBAN_HEAD, EMU_SUBURBAN_MID } from './sprites/trains';
import { WHEEL_FRAMES } from './sprites/wheels';
import {
  BUILDING, CATENARY_POLE, HOUSE, TREE,
  CLOUD_A, CLOUD_B, PERSON_A, PERSON_B, SIGNAL,
} from './sprites/scenery';
import { LANDMARKS, LANDMARK_LIVERY } from './sprites/landmarks';
import { drawText, measureText } from './bitmapFont';
import type { LandmarkId, SceneKind, VehicleId } from '../data/types';
import { WEATHER_SKY, type Weather } from './weather';
import {
  drawBridge, drawHills, drawRiver, drawSeaside, drawStreet, drawTunnel,
  mix, type BackdropCtx,
} from './backdrops';

/** 地面（線路の基準）の y 座標。下は駅名帯（DOM）に譲るので高めに置く。 */
const GROUND_Y = 118;
const TRAIN_Y = GROUND_Y - 30;
/** 列車は画面中央。駅名帯の中央スロットと縦に揃える。 */
const TRAIN_X = Math.round(VIEW_W / 2 - (EMU_SUBURBAN_MID.w + EMU_SUBURBAN_HEAD.w + 1) / 2);
const PLATFORM_Y = GROUND_Y - 12;

export interface Spark { x: number; y: number; vx: number; vy: number; life: number }

export interface SceneState {
  /** 走行距離（論理px）。背景スクロールと車輪回転を駆動する。 */
  distance: number;
  /** 現在の速度（px/秒）。0 なら停車中。 */
  speed: number;
  scene: SceneKind;
  vehicle: VehicleId;
  /** 停車中の駅名（漢字）。null なら走行中。 */
  stoppedAt: string | null;
  /** その駅の名所。停車中に描く。 */
  landmarks: readonly LandmarkId[];
  /** 駅名標に出すローマ字。Canvas の英数字はビットマップフォントで描ける。 */
  stationRomaji: string;
  direction: 1 | -1;
  shake: number;
  sparks: readonly Spark[];
  /** 走行に同期する時間。 */
  time: number;
  /** 列車が止まっていても進み続ける時間。雲・乗客・信号を動かす。 */
  idleTime: number;
  /** ドアの開き具合 0..1。停車で開き、発車で閉じる。 */
  doorOpen: number;
  /** 出発信号。打ち終わると青になる。 */
  signalGreen: boolean;
  showSpeed: boolean;
  reduceMotion: boolean;
  /** その回の天気。プレイのたびに引き直す。 */
  weather: Weather;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

function drawSky(ctx: CanvasRenderingContext2D, scene: SceneKind, weather: Weather): void {
  if (scene === 'tunnel') return; // トンネルは backdrops 側で塗る
  const sky = WEATHER_SKY[weather];
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = mix(sky.top, sky.bottom, i / (bands - 1));
    ctx.fillRect(0, Math.floor((i * GROUND_Y) / bands), VIEW_W, Math.ceil(GROUND_Y / bands) + 1);
  }
}

/**
 * 雲。**列車の速度とは無関係に、常に一定速度で流れる。**
 * 停車して打鍵している間も画面が完全に静止しないための一番効く仕掛け。
 */
function drawClouds(ctx: CanvasRenderingContext2D, idleTime: number, scene: SceneKind, weather: Weather): void {
  if (scene === 'tunnel' || scene === 'bridge') return;
  const liv = { W: WEATHER_SKY[weather].cloud };
  const big = bake('cloudA', CLOUD_A, liv);
  const small = bake('cloudB', CLOUD_B, liv);
  ctx.globalAlpha = weather === 'cloudy' || weather === 'rain' ? 0.95 : 0.8;
  const drift = idleTime * 4.5;
  for (const [sprite, period, y, phase] of [
    [big, 150, 12, 0], [small, 110, 30, 55], [big, 190, 42, 120],
  ] as const) {
    const off = mod(drift * (period === 110 ? 1.6 : 1) + phase, period);
    for (let base = -period; base < VIEW_W + period; base += period) {
      blit(ctx, sprite, base + period - off, y);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMidground(ctx: CanvasRenderingContext2D, distance: number, scene: SceneKind): void {
  // これらの風景は backdrops 側が画面を占めるので、町並みは重ねない
  if (scene === 'tunnel' || scene === 'bridge' || scene === 'sea' || scene === 'street') return;
  const period = 96;
  const off = mod(distance * 0.45, period);
  const liv = { A: C.building, O: C.roof, G: '#5d7f96', D: '#7a6552', T: '#5f8c4e', M: C.pole };
  const top = GROUND_Y - 22;
  for (let base = -period; base < VIEW_W + period; base += period) {
    const x0 = Math.round(base - off);
    if (scene === 'city') {
      blit(ctx, bake('bld', BUILDING, liv), x0 + 6, top - BUILDING.h);
      blit(ctx, bake('house', HOUSE, liv), x0 + 30, top - HOUSE.h);
      blit(ctx, bake('bld', BUILDING, liv), x0 + 58, top - BUILDING.h);
    } else if (scene === 'suburb') {
      blit(ctx, bake('house', HOUSE, liv), x0 + 8, top - HOUSE.h);
      blit(ctx, bake('tree', TREE, liv), x0 + 34, top - TREE.h);
      blit(ctx, bake('house', HOUSE, liv), x0 + 52, top - HOUSE.h);
    } else {
      blit(ctx, bake('tree', TREE, liv), x0 + 12, top - TREE.h);
      blit(ctx, bake('tree', TREE, liv), x0 + 46, top - TREE.h);
      blit(ctx, bake('house', HOUSE, liv), x0 + 68, top - HOUSE.h);
    }
  }
  ctx.fillStyle = C.field;
  ctx.fillRect(0, top, VIEW_W, 22);
  ctx.fillStyle = C.fieldAlt;
  const fOff = mod(distance * 0.7, 12);
  for (let x = -12; x < VIEW_W + 12; x += 12) ctx.fillRect(Math.round(x - fOff), GROUND_Y - 14, 6, 3);
}

/** その駅の名所。停車のたびに画が変わるので、単調さへの一番の対策になる。 */
function drawLandmarks(ctx: CanvasRenderingContext2D, ids: readonly LandmarkId[]): void {
  if (ids.length === 0) return;
  // ホームの高さに合わせて置く。これより上げると宙に浮いて見える。
  const base = PLATFORM_Y + 1;
  const xs = ids.length === 1 ? [232] : [212, 250];
  ids.forEach((id, i) => {
    const shape = LANDMARKS[id];
    blit(ctx, bake(`lm:${id}`, shape, LANDMARK_LIVERY), xs[i]!, base - shape.h);
  });
}

function drawTrack(ctx: CanvasRenderingContext2D, distance: number): void {
  ctx.fillStyle = C.ballast;
  ctx.fillRect(0, GROUND_Y - 4, VIEW_W, VIEW_H - GROUND_Y + 4);
  const off = mod(distance, 16);
  ctx.fillStyle = C.sleeper;
  for (let x = -16; x < VIEW_W + 16; x += 16) ctx.fillRect(Math.round(x - off), GROUND_Y, 10, 3);
  ctx.fillStyle = C.rail;
  ctx.fillRect(0, GROUND_Y - 2, VIEW_W, 2);
  ctx.fillStyle = C.railShine;
  ctx.fillRect(0, GROUND_Y - 2, VIEW_W, 1);
}

function drawPoles(ctx: CanvasRenderingContext2D, distance: number): void {
  const period = 48;
  const off = mod(distance, period);
  const sprite = bake('pole', CATENARY_POLE, { M: C.pole });
  for (let base = -period; base < VIEW_W + period; base += period) {
    blit(ctx, sprite, base - off, GROUND_Y - CATENARY_POLE.h);
  }
}

/** ホーム。停車中は駅名標・乗客・出発信号も出す。 */
function drawPlatform(ctx: CanvasRenderingContext2D, s: SceneState): void {
  ctx.fillStyle = C.platformSide;
  ctx.fillRect(0, PLATFORM_Y, VIEW_W, 12);
  ctx.fillStyle = C.platform;
  ctx.fillRect(0, PLATFORM_Y, VIEW_W, 3);
  ctx.fillStyle = C.platformEdge;
  ctx.fillRect(0, PLATFORM_Y + 3, VIEW_W, 1);
  if (s.stoppedAt === null) return;

  drawStationSign(ctx, s.stationRomaji);

  // 乗客。停車中は小さく上下して「待っている」感を出す
  const personLiv = { F: '#e8c9a0', J: '#3f5a86', K: '#2a2f38' };
  const a = bake('personA', PERSON_A, personLiv);
  const b = bake('personB', PERSON_B, { ...personLiv, J: '#7a4a5a' });
  const bob = (phase: number) =>
    s.reduceMotion ? 0 : Math.round(Math.sin(s.idleTime * 3 + phase) * 0.6);
  blit(ctx, a, 64, PLATFORM_Y - PERSON_A.h + 1 + bob(0));
  blit(ctx, b, 76, PLATFORM_Y - PERSON_B.h + 1 + bob(1.9));
  blit(ctx, a, 196, PLATFORM_Y - PERSON_A.h + 1 + bob(3.4));

  // 出発信号。打ち終わると青に変わって発車する
  const lit = s.signalGreen
    ? { M: '#4a5058', 1: '#2a2f38', 2: '#5fd68a' }
    : { M: '#4a5058', 1: '#ff5d5d', 2: '#2a2f38' };
  blit(ctx, bake(`signal:${s.signalGreen}`, SIGNAL, lit), 288, PLATFORM_Y - SIGNAL.h + 2);
}

/**
 * 駅名標。本物と同じくローマ字を大きく出す。
 * 日本語は Canvas だと滲むのでビットマップフォントのローマ字だけを描き、
 * 漢字・かなは DOM 側の駅名帯に任せる。
 */
function drawStationSign(ctx: CanvasRenderingContext2D, romaji: string): void {
  const label = romaji.toUpperCase();
  const w = Math.max(measureText(label) + 10, 34);
  const h = 15;
  const x = 24;
  const y = PLATFORM_Y - h - 10;
  ctx.fillStyle = C.signPost;
  ctx.fillRect(x + Math.floor(w / 2) - 1, y + h, 2, 10);
  ctx.fillStyle = '#1b2029';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = C.signFace;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.signBand;
  ctx.fillRect(x, y + h - 3, w, 3);
  drawText(ctx, label, x + 5, y + 4, '#1b2029');
}

function drawTrain(ctx: CanvasRenderingContext2D, s: SceneState): void {
  const liv = LIVERIES[s.vehicle];
  // 停車中はドアを開ける（ドアトークンを窓ガラス色にして「開いている」ことを示す）
  const doorLiv = s.doorOpen > 0.5 ? { ...liv, D: '#232b38' } : liv;
  const key = s.doorOpen > 0.5 ? `${s.vehicle}:open` : s.vehicle;
  const head = bake(`head:${key}`, EMU_SUBURBAN_HEAD, doorLiv);
  const mid = bake(`mid:${key}`, EMU_SUBURBAN_MID, doorLiv);

  // 走行中は上下1px、停車中もごくわずかに揺らしてアイドリングを見せる
  let bob = 0;
  if (!s.reduceMotion) {
    bob = s.speed > 0
      ? Math.round(Math.sin(s.time * 14) * 0.6)
      : (Math.sin(s.idleTime * 5.5) > 0.86 ? 1 : 0);
  }
  const y = TRAIN_Y + bob;
  const flip = s.direction === -1;
  const cars: Array<[HTMLCanvasElement, number, boolean]> = flip
    ? [[head, TRAIN_X, true], [mid, TRAIN_X + EMU_SUBURBAN_HEAD.w + 1, false]]
    : [[mid, TRAIN_X, false], [head, TRAIN_X + EMU_SUBURBAN_MID.w + 1, false]];
  for (const [sprite, x, f] of cars) blit(ctx, sprite, x, y, f);

  const frame = Math.floor(mod(s.distance / (Math.PI * 8), 1) * WHEEL_FRAMES.length);
  const wheel = bake(`wheel:${frame}`, WHEEL_FRAMES[frame]!, { K: '#1a1d24', U: '#4a5058', P: '#8a919b' });
  for (const carX of [TRAIN_X, TRAIN_X + EMU_SUBURBAN_MID.w + 1]) {
    for (const dx of [6, 16, 26, 36]) blit(ctx, wheel, carX + dx, y + 17);
  }
}

/**
 * 雪化粧。空を白くするだけだと「霞んでいる」ようにしか見えないので、
 * 地面と屋根に実際に雪を積もらせる。
 */
function drawSnowCover(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.weather !== 'snow') return;
  if (s.scene === 'tunnel' || s.scene === 'bridge' || s.scene === 'sea') return;
  const groundTop = GROUND_Y - 22;
  ctx.fillStyle = 'rgba(248,252,255,0.82)';
  ctx.fillRect(0, groundTop, VIEW_W, 5);
  // まだらに積もらせて、べた塗りに見せない
  ctx.fillStyle = 'rgba(248,252,255,0.5)';
  for (let x = 0; x < VIEW_W; x += 2) {
    const h = 2 + ((x * 7919) % 5);
    ctx.fillRect(x, groundTop + 5, 2, h);
  }
  // 砂利の上にもうっすら
  ctx.fillStyle = 'rgba(240,246,252,0.28)';
  ctx.fillRect(0, GROUND_Y + 3, VIEW_W, VIEW_H - GROUND_Y - 3);
}

/** 雨と雪。列車の速度と無関係に降るので、停車中も画面が動く。 */
function drawPrecipitation(ctx: CanvasRenderingContext2D, s: SceneState): void {
  if (s.scene === 'tunnel') return;
  if (s.weather !== 'rain' && s.weather !== 'snow') return;
  const count = s.weather === 'rain' ? 70 : 46;
  const t = s.idleTime;
  for (let i = 0; i < count; i++) {
    // 疑似乱数を i から作る（配列を持たずに毎フレーム同じ粒を動かす）
    const seedX = (i * 73.13) % 1;
    const seedY = (i * 37.71) % 1;
    if (s.weather === 'rain') {
      const speed = 150 + seedY * 90;
      const x = Math.round(mod(seedX * VIEW_W - t * 34, VIEW_W));
      const y = Math.round(mod(seedY * VIEW_H + t * speed, VIEW_H));
      ctx.fillStyle = 'rgba(190,215,235,0.55)';
      ctx.fillRect(x, y, 1, 4);
    } else {
      const speed = 22 + seedY * 18;
      const sway = Math.sin(t * 1.6 + i) * 6;
      const x = Math.round(mod(seedX * VIEW_W + sway, VIEW_W));
      const y = Math.round(mod(seedY * VIEW_H + t * speed, VIEW_H));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawSparks(ctx: CanvasRenderingContext2D, sparks: readonly Spark[]): void {
  ctx.fillStyle = '#ffe066';
  for (const s of sparks) {
    if (s.life > 0) ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
  }
}

function drawSpeedo(ctx: CanvasRenderingContext2D, speed: number): void {
  const label = `${Math.round(speed * 0.9)} KM/H`;
  const w = measureText(label) + 6;
  ctx.fillStyle = 'rgba(10,12,16,0.62)';
  ctx.fillRect(VIEW_W - w - 4, 4, w, 13);
  drawText(ctx, label, VIEW_W - w - 1, 7, '#9fe8a0');
}

export function renderScene(ctx: CanvasRenderingContext2D, s: SceneState): void {
  ctx.save();
  if (s.shake > 0 && !s.reduceMotion) ctx.translate(Math.round(Math.sin(s.shake * 90) * 1.5), 0);

  const sky = WEATHER_SKY[s.weather];
  const bd: BackdropCtx = {
    ctx, distance: s.distance, groundY: GROUND_Y, sky, weather: s.weather, time: s.idleTime,
  };

  drawSky(ctx, s.scene, s.weather);
  drawClouds(ctx, s.idleTime, s.scene, s.weather);

  // 風景の主役を scene ごとに描き分ける
  switch (s.scene) {
    case 'tunnel': drawTunnel(bd); break;
    case 'bridge': drawBridge(bd); break;
    case 'sea':    drawHills(bd, s.scene); drawSeaside(bd); break;
    case 'street': drawStreet(bd); break;
    case 'river':  drawHills(bd, s.scene); drawRiver(bd); break;
    default:       drawHills(bd, s.scene);
  }

  drawMidground(ctx, s.distance, s.scene);
  drawSnowCover(ctx, s);

  // 空気遠近。天気が悪いほど遠くが白く沈む
  if (sky.haze !== null && s.scene !== 'tunnel') {
    ctx.fillStyle = sky.haze;
    ctx.fillRect(0, 0, VIEW_W, GROUND_Y - 10);
  }

  if (s.stoppedAt !== null) drawLandmarks(ctx, s.landmarks);

  // 橋の上には架線柱も砂利も無い
  if (s.scene !== 'bridge') {
    drawPoles(ctx, s.distance);
    drawTrack(ctx, s.distance);
  } else {
    drawBridgeTrack(ctx, s.distance);
  }

  drawPlatform(ctx, s);
  drawTrain(ctx, s);
  drawSparks(ctx, s.sparks);
  drawPrecipitation(ctx, s);

  // 夕焼け・雨などの空気を画面全体にかける
  if (sky.tint !== null && s.scene !== 'tunnel') {
    ctx.fillStyle = sky.tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (s.speed > 0 && s.showSpeed) drawSpeedo(ctx, s.speed);
  ctx.restore();
}

/** 橋の上の線路。砂利が無く、桁の上に枕木が直接載る。 */
function drawBridgeTrack(ctx: CanvasRenderingContext2D, distance: number): void {
  const off = mod(distance, 16);
  ctx.fillStyle = '#6b5a4a';
  for (let x = -16; x < VIEW_W + 16; x += 16) ctx.fillRect(Math.round(x - off), GROUND_Y, 10, 3);
  ctx.fillStyle = C.rail;
  ctx.fillRect(0, GROUND_Y - 2, VIEW_W, 2);
  ctx.fillStyle = C.railShine;
  ctx.fillRect(0, GROUND_Y - 2, VIEW_W, 1);
}
