/* フリーボード の しくみ（画面に かかわらない ぶぶん）
   index.html から よみこみ、tests.js（node）でも そのまま しらべます。

   ボードに かいた ものは すべて「もの（オブジェクト）」の ならびで おぼえます。
   ざひょうは 画面の CSS ピクセル（左上が 0,0）。
     pen    … フリーの 線・蛍光ペン   { t, id, pts:[[x,y],...], c, w, hl }
     erase  … 消しゴムで けした あと   { t, id, pts, w }
     line   … 直線・矢印              { t, id, x1,y1,x2,y2, c, w, dash, arrow }
     rect / ellipse / tri / rtri … 四角・だ円・三角・直角三角 { t, id, x1,y1,x2,y2, c, w, dash, fill }
     circle … 円（中心と 半径）        { t, id, cx,cy,r, c, w, dash, fill }
     text   … 文字                     { t, id, x,y, text, size, c, font, w:はば, h:たかさ }
     image  … はりつけた 画像・PDF     { t, id, x,y, w,h, ref } … ref は IndexedDB に しまった 画像の なまえ
     fill   … ぬりつぶし（画像）       { t, id, x,y, w,h, src:dataURL, under }
               under … すきまを ぬった とき true。それより 前に かいた 線の「うしろ」に ぬる（ふちが きれい）
*/
(function (root) {
'use strict';

/* ---------- いろいろ ---------- */
let idSeq = 0;
function newId() {
  idSeq = (idSeq + 1) % 1e6;
  return Date.now().toString(36) + '-' + idSeq.toString(36) + '-' + Math.floor(Math.random() * 1296).toString(36);
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const SHAPES = ['rect', 'ellipse', 'tri', 'rtri'];
const isBoxShape = t => SHAPES.indexOf(t) >= 0;

/* ---------- 背景 ---------- */
const BG_KINDS = ['plain', 'grid', 'hline', 'vline', 'dot'];
const BG_COLORS = {
  white: { fill: '#ffffff', dark: false },
  cream: { fill: '#fbf6e6', dark: false },
  black: { fill: '#111214', dark: true },
  green: { fill: '#1f4d3a', dark: true }
};
/* 線の 色：あかるい 地 と くらい 地 で かえる */
const LINE_COLORS = {
  blue:   { light: '#3d8fd6', dark: '#8cc4f2' },
  gray:   { light: '#7a7a7a', dark: '#c8c8c8' },
  green:  { light: '#3a9a55', dark: '#9fdcae' },
  orange: { light: '#e0782a', dark: '#ffc08a' }
};
const STRENGTH_ALPHA = [0.28, 0.5, 0.8]; /* うすい・ふつう・こい */
const DEFAULT_BG = { kind: 'plain', color: 'white', size: 40, sub: false, bold5: false, lineColor: 'blue', strength: 1 };

function sanitizeBg(bg) {
  const b = Object.assign({}, DEFAULT_BG, bg || {});
  if (BG_KINDS.indexOf(b.kind) < 0) b.kind = 'plain';
  if (!BG_COLORS[b.color]) b.color = 'white';
  if (!LINE_COLORS[b.lineColor]) b.lineColor = 'blue';
  b.size = clamp(Math.round(Number(b.size) || 40), 16, 160);
  b.strength = clamp(Math.round(Number(b.strength)), 0, 2);
  if (!Number.isFinite(b.strength)) b.strength = 1;
  b.sub = !!b.sub; b.bold5 = !!b.bold5;
  return b;
}
const isDarkBg = bg => !!(BG_COLORS[bg.color] || BG_COLORS.white).dark;
function bgLineColor(bg) {
  const lc = LINE_COLORS[bg.lineColor] || LINE_COLORS.blue;
  return isDarkBg(bg) ? lc.dark : lc.light;
}

/* 背景の 線と 点を 計算する。
   r … 見えて いる ところ（ボードの ざひょう）{ x, y, w, h }
   anchorX … 縦の線を ならべる 右の はし（ボードの ざひょう。ふつうは 画面の はば）
   lines の ざひょうは ボードの ざひょう。w は 画面の 上での 線の 太さ（拡大しても 太く しない）、dash は 点線。
   画面の 上で マスが 小さすぎる とき（minPx より 小さい）は、こまかい 線を はぶく。 */
function bgShapes(bgIn, r, anchorX, scale) {
  const bg = sanitizeBg(bgIn);
  const s = bg.size, lines = [], dots = [];
  scale = scale || 1;
  const px = s * scale;                 /* 画面の 上での マスの 大きさ */
  if (bg.kind === 'plain' || px < 3) return { lines: lines, dots: dots };
  const showSub = bg.sub && px >= 12;
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  const vert = (x, w, dash) => lines.push({ x1: x, y1: y0, x2: x, y2: y1, w: w, dash: dash });
  const horz = (y, w, dash) => lines.push({ x1: x0, y1: y, x2: x1, y2: y, w: w, dash: dash });
  const kFrom = (lo, off) => Math.ceil((lo - off) / s - 1e-9);
  const kTo = (hi, off) => Math.floor((hi - off) / s + 1e-9);
  const mod5 = k => ((k % 5) + 5) % 5;
  if (bg.kind === 'grid') {
    for (let k = kFrom(x0 - s, 0); k <= kTo(x1, 0); k++) {
      const x = k * s;
      if (x >= x0 - 0.01) vert(x, bg.bold5 && mod5(k) === 0 ? 2.5 : 1, false);
      if (showSub && x + s / 2 >= x0 && x + s / 2 <= x1) vert(x + s / 2, 1, true);
    }
    for (let k = kFrom(y0 - s, 0); k <= kTo(y1, 0); k++) {
      const y = k * s;
      if (y >= y0 - 0.01) horz(y, bg.bold5 && mod5(k) === 0 ? 2.5 : 1, false);
      if (showSub && y + s / 2 >= y0 && y + s / 2 <= y1) horz(y + s / 2, 1, true);
    }
  } else if (bg.kind === 'hline') {
    for (let k = kFrom(y0, 0); k <= kTo(y1 + s / 2, 0); k++) {
      const y = k * s;
      if (y <= y1 + 0.01) horz(y, 1.5, false);
      if (showSub && y - s / 2 >= y0 && y - s / 2 <= y1) horz(y - s / 2, 1, true);
    }
  } else if (bg.kind === 'vline') {
    /* たて書きは 右から 書くので、右の はし（anchorX）から ならべる */
    const a = anchorX || 0;
    for (let k = kFrom(x0, a); k <= kTo(x1 + s / 2, a); k++) {
      const x = a + k * s;
      if (x <= x1 + 0.01) vert(x, 1.5, false);
      if (showSub && x - s / 2 >= x0 && x - s / 2 <= x1) vert(x - s / 2, 1, true);
    }
  } else if (bg.kind === 'dot') {
    if (px >= 5) {
      const rad = clamp(px / 22, 1.6, 4); /* 画面の 上での 点の 半径 */
      for (let j = kFrom(y0, 0); j <= kTo(y1, 0); j++) for (let i = kFrom(x0, 0); i <= kTo(x1, 0); i++) dots.push({ x: i * s, y: j * s, r: rad });
    }
  }
  return { lines: lines, dots: dots };
}

/* ---------- 拡大・移動（ビュー） ----------
   画面の 点 = ボードの 点 × s ＋ (x, y) */
const ZOOM_MIN = 0.25, ZOOM_MAX = 8;
const DEFAULT_VIEW = { s: 1, x: 0, y: 0 };
function sanitizeView(v) {
  v = v && typeof v === 'object' ? v : {};
  const n = (a, d) => typeof a === 'number' && Number.isFinite(a) ? a : d;
  return { s: clamp(n(v.s, 1), ZOOM_MIN, ZOOM_MAX), x: clamp(n(v.x, 0), -1e6, 1e6), y: clamp(n(v.y, 0), -1e6, 1e6) };
}
const toWorld = (v, sx, sy) => [(sx - v.x) / v.s, (sy - v.y) / v.s];
const toScreen = (v, wx, wy) => [wx * v.s + v.x, wy * v.s + v.y];
/* 画面の (cx, cy) を 中心に s ばいに する（その 点の 下の ものは うごかない） */
function zoomAt(v, newS, cx, cy) {
  const s = clamp(newS, ZOOM_MIN, ZOOM_MAX);
  const w = toWorld(v, cx, cy);
  return { s: s, x: cx - w[0] * s, y: cy - w[1] * s };
}
/* 2本の ゆび：はじめの ビュー v0 と、ゆびの はじめ (a0,b0) → いま (a1,b1) から あたらしい ビュー */
function pinchView(v0, a0, b0, a1, b1) {
  const d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1, d1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1;
  const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  const s = clamp(v0.s * d1 / d0, ZOOM_MIN, ZOOM_MAX);
  const w = toWorld(v0, m0[0], m0[1]);
  return { s: s, x: m1[0] - w[0] * s, y: m1[1] - w[1] * s };
}
/* 見えて いる ところ（ボードの ざひょう） */
function visibleRect(v, W, H) {
  const p = toWorld(v, 0, 0);
  return { x: p[0], y: p[1], w: W / v.s, h: H / v.s };
}

/* 画像を 四角 r の 中に、たて よこの わりあいを かえずに おさめる（ratio … r の 何わりの 大きさまで） */
function fitInto(iw, ih, r, ratio) {
  const k = Math.min(r.w * ratio / iw, r.h * ratio / ih);
  const w = iw * k, h = ih * k;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w: w, h: h };
}
/* 画像の 角を ひっぱって 大きさを かえる（たて よこの わりあいは そのまま。はんたいの 角は うごかない）
   corner … 0 左上・1 右上・2 右下・3 左下 */
function resizeBox(o, corner, px, py, minW) {
  minW = minW || 8;
  const ax = corner === 0 || corner === 3 ? o.x + o.w : o.x;   /* うごかない 角 */
  const ay = corner === 0 || corner === 1 ? o.y + o.h : o.y;
  const ratio = o.h / o.w;
  let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) / ratio);
  w = Math.max(minW, w);
  const h = w * ratio;
  const x = corner === 0 || corner === 3 ? ax - w : ax;
  const y = corner === 0 || corner === 1 ? ay - h : ay;
  return Object.assign({}, o, { x: x, y: y, w: w, h: h });
}
function corners(o) {
  return [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
}

/* マス目・点に ぴったり あわせる */
function snapPoint(x, y, size) {
  return [Math.round(x / size) * size, Math.round(y / size) * size];
}
const canSnap = bg => bg && (bg.kind === 'grid' || bg.kind === 'dot');

/* Shift を おしながら：直線は 15° ごと、四角・だ円は 正方形・円 */
function constrainAngle(x1, y1, x2, y2, stepDeg) {
  const step = (stepDeg || 15) * Math.PI / 180;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (!len) return [x2, y2];
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return [x1 + Math.round(Math.cos(a) * len * 1000) / 1000, y1 + Math.round(Math.sin(a) * len * 1000) / 1000];
}
function constrainSquare(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, m = Math.max(Math.abs(dx), Math.abs(dy));
  return [x1 + (dx < 0 ? -m : m), y1 + (dy < 0 ? -m : m)];
}

/* ---------- 形の 点 ---------- */
function shapePolygon(o) {
  if (o.t === 'rect') return [[o.x1, o.y1], [o.x2, o.y1], [o.x2, o.y2], [o.x1, o.y2]];
  if (o.t === 'tri') return [[(o.x1 + o.x2) / 2, o.y1], [o.x2, o.y2], [o.x1, o.y2]];
  if (o.t === 'rtri') return [[o.x1, o.y1], [o.x1, o.y2], [o.x2, o.y2]];
  if (o.t === 'ellipse') {
    const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2, rx = Math.abs(o.x2 - o.x1) / 2, ry = Math.abs(o.y2 - o.y1) / 2, p = [];
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return p;
  }
  return [];
}

/* 矢印の 先（三角）の 3点 */
function arrowHead(x1, y1, x2, y2, w) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const size = Math.min(Math.max(12, w * 3.6), len * 0.6 + w);
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len, px = -uy, py = ux;
  const bx = x2 - ux * size, by = y2 - uy * size, half = size * 0.55;
  return [[x2, y2], [bx + px * half, by + py * half], [bx - px * half, by - py * half]];
}

/* ---------- 当たり判定 ---------- */
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function distToPolyline(px, py, pts, closed) {
  if (!pts.length) return Infinity;
  if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1]);
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSeg(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  if (closed) d = Math.min(d, distToSeg(px, py, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]));
  return d;
}
function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* (x,y) が もの o に あたって いるか。tol は ゆび・マウスの ゆとり */
function hitTest(o, x, y, tol) {
  tol = tol || 0;
  const reach = (o.w || 0) / 2 + tol;
  switch (o.t) {
    case 'pen': return distToPolyline(x, y, o.pts, false) <= reach;
    case 'line': return distToSeg(x, y, o.x1, o.y1, o.x2, o.y2) <= reach;
    case 'circle': {
      const d = Math.hypot(x - o.cx, y - o.cy);
      return Math.abs(d - o.r) <= reach || (o.fill && o.fill !== 'none' && d <= o.r);
    }
    case 'rect': case 'ellipse': case 'tri': case 'rtri': {
      const poly = shapePolygon(o);
      return distToPolyline(x, y, poly, true) <= reach || (o.fill && o.fill !== 'none' && pointInPolygon(x, y, poly));
    }
    case 'text': case 'fill': case 'image':
      return x >= o.x - tol && x <= o.x + o.w + tol && y >= o.y - tol && y <= o.y + o.h + tol;
    default: return false;
  }
}

/* もの を かこむ 四角 { x, y, w, h } */
function bbox(o) {
  const pad = (o.w && o.t !== 'text' && o.t !== 'fill' && o.t !== 'image') ? o.w / 2 : 0;
  let x1, y1, x2, y2;
  if (o.t === 'pen' || o.t === 'erase') {
    x1 = y1 = Infinity; x2 = y2 = -Infinity;
    for (const p of o.pts) { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); }
  } else if (o.t === 'circle') {
    x1 = o.cx - o.r; y1 = o.cy - o.r; x2 = o.cx + o.r; y2 = o.cy + o.r;
  } else if (o.t === 'text' || o.t === 'fill' || o.t === 'image') {
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  } else {
    x1 = Math.min(o.x1, o.x2); y1 = Math.min(o.y1, o.y2); x2 = Math.max(o.x1, o.x2); y2 = Math.max(o.y1, o.y2);
    if (o.t === 'line' && o.arrow) {
      for (const p of arrowHead(o.x1, o.y1, o.x2, o.y2, o.w)) { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); }
    }
  }
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}
function rectsOverlap(a, b) {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}
function normRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/* うごかした あたらしい もの（もとの ものは かえない：もとに もどす ため） */
function translate(o, dx, dy) {
  const n = Object.assign({}, o);
  if (o.pts) n.pts = o.pts.map(p => [p[0] + dx, p[1] + dy]);
  if ('x1' in o) { n.x1 += dx; n.y1 += dy; n.x2 += dx; n.y2 += dy; }
  if ('cx' in o) { n.cx += dx; n.cy += dy; }
  if (o.t === 'text' || o.t === 'fill' || o.t === 'image') { n.x += dx; n.y += dy; }
  return n;
}
function duplicate(o, dx, dy) {
  const n = translate(o, dx, dy);
  n.id = newId();
  return n;
}
/* 色を かえられる もの */
const hasColor = o => o.t !== 'erase' && o.t !== 'fill' && o.t !== 'image';

/* 線の 点を へらす（ちかすぎる 点は すてる） */
function thinPoints(pts, minDist) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const l = out[out.length - 1];
    if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const round1 = v => Math.round(v * 10) / 10;

/* ---------- ぬりつぶし（バケツ） ----------
   data: RGBA の ならび（W×H）。(sx,sy) と おなじ 色で つながって いる ところを mask に 1 で つける。
   すきとおった ところ を おした ときは、うすい ふち（アンチエイリアス）までを なかまに する。 */
function floodFill(data, W, H, sx, sy, tol) {
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
  tol = tol == null ? 48 : tol;
  const i0 = (sy * W + sx) * 4;
  const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2], ta = data[i0 + 3];
  const clear = ta <= tol;
  const match = i => {
    const a = data[i + 3];
    if (clear) return a <= tol;
    return Math.abs(a - ta) <= tol && Math.abs(data[i] - tr) <= tol && Math.abs(data[i + 1] - tg) <= tol && Math.abs(data[i + 2] - tb) <= tol;
  };
  const mask = new Uint8Array(W * H);
  let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(), x0 = stack.pop();
    let x = x0;
    while (x >= 0 && !mask[y * W + x] && match((y * W + x) * 4)) x--;
    x++;
    let up = false, down = false;
    while (x < W && !mask[y * W + x] && match((y * W + x) * 4)) {
      mask[y * W + x] = 1; count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (y > 0) {
        const m = !mask[(y - 1) * W + x] && match(((y - 1) * W + x) * 4);
        if (m && !up) { stack.push(x, y - 1); up = true; } else if (!m) up = false;
      }
      if (y < H - 1) {
        const m = !mask[(y + 1) * W + x] && match(((y + 1) * W + x) * 4);
        if (m && !down) { stack.push(x, y + 1); down = true; } else if (!m) down = false;
      }
      x++;
    }
  }
  if (!count) return null;
  return { mask: mask, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count: count };
}
/* mask を r ピクセル ふとらせる（線の ふちの うすい ところの 下まで ぬる）。
   よこ → たて の じゅんに 2回 しらべるので、大きい 画面でも はやい。 */
function dilateMask(res, W, H, r) {
  if (!res || r <= 0) return res;
  const src = res.mask;
  const x0 = Math.max(0, res.x - r), y0 = Math.max(0, res.y - r);
  const x1 = Math.min(W - 1, res.x + res.w - 1 + r), y1 = Math.min(H - 1, res.y + res.h - 1 + r);
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = res.y; y < res.y + res.h; y++) {
    const row = y * W;
    let last = -1e9;
    for (let x = x0; x <= x1; x++) { if (src[row + x]) last = x; if (x - last <= r) tmp[row + x] = 1; }
    last = 1e9;
    for (let x = x1; x >= x0; x--) { if (src[row + x]) last = x; if (last - x <= r) tmp[row + x] = 1; }
  }
  for (let x = x0; x <= x1; x++) {
    let last = -1e9;
    for (let y = y0; y <= y1; y++) { if (tmp[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; }
    last = 1e9;
    for (let y = y1; y >= y0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; }
  }
  return { mask: out, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, count: res.count };
}

/* ---------- 保存した データを たしかめる ---------- */
const num = v => typeof v === 'number' && Number.isFinite(v);
const isColor = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
function sanitizeObj(o) {
  if (!o || typeof o !== 'object') return null;
  const base = { id: typeof o.id === 'string' ? o.id : newId(), t: o.t };
  const w = num(o.w) ? clamp(o.w, 0.02, 800) : 4;
  const pts = Array.isArray(o.pts) ? o.pts.filter(p => Array.isArray(p) && num(p[0]) && num(p[1])).map(p => [p[0], p[1]]) : [];
  switch (o.t) {
    case 'pen':
      if (!pts.length || !isColor(o.c)) return null;
      return Object.assign(base, { pts: pts, c: o.c, w: w, hl: !!o.hl });
    case 'erase':
      if (!pts.length) return null;
      return Object.assign(base, { pts: pts, w: w });
    case 'line': case 'rect': case 'ellipse': case 'tri': case 'rtri':
      if (![o.x1, o.y1, o.x2, o.y2].every(num) || !isColor(o.c)) return null;
      return Object.assign(base, { x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, c: o.c, w: w, dash: !!o.dash },
        o.t === 'line' ? { arrow: !!o.arrow } : { fill: ['solid', 'light'].indexOf(o.fill) >= 0 ? o.fill : 'none' });
    case 'circle':
      if (![o.cx, o.cy, o.r].every(num) || !isColor(o.c)) return null;
      return Object.assign(base, { cx: o.cx, cy: o.cy, r: Math.abs(o.r), c: o.c, w: w, dash: !!o.dash,
        fill: ['solid', 'light'].indexOf(o.fill) >= 0 ? o.fill : 'none' });
    case 'text':
      if (typeof o.text !== 'string' || !o.text || ![o.x, o.y, o.w, o.h, o.size].every(num) || !isColor(o.c)) return null;
      return Object.assign(base, { x: o.x, y: o.y, w: o.w, h: o.h, text: o.text, size: clamp(o.size, 1, 1000), c: o.c,
        font: FONTS[o.font] ? o.font : 'gothic' });
    case 'fill':
      if (![o.x, o.y, o.w, o.h].every(num) || typeof o.src !== 'string' || o.src.indexOf('data:image/png;base64,') !== 0) return null;
      return Object.assign(base, { x: o.x, y: o.y, w: o.w, h: o.h, src: o.src, under: !!o.under });
    case 'image':
      if (![o.x, o.y, o.w, o.h].every(num) || !(o.w > 0) || !(o.h > 0) || typeof o.ref !== 'string' || !/^[a-z0-9-]{1,80}$/.test(o.ref)) return null;
      return Object.assign(base, { x: o.x, y: o.y, w: o.w, h: o.h, ref: o.ref });
    default: return null;
  }
}
function sanitizePage(p) {
  p = p && typeof p === 'object' ? p : {};
  return { bg: sanitizeBg(p.bg), view: sanitizeView(p.view), objs: (Array.isArray(p.objs) ? p.objs : []).map(sanitizeObj).filter(Boolean) };
}
/* ページたちが つかって いる 画像の なまえ */
function imageRefs(pages) {
  const set = new Set();
  for (const p of pages) for (const o of p.objs || []) if (o.t === 'image') set.add(o.ref);
  return set;
}

/* 文字の 書体（canvas と 入力わく で おなじ ものを つかう） */
const FONTS = {
  gothic: { label: 'ゴシック', css: '"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif', weight: 500 },
  kyoka: { label: '教科書体ふう', css: '"Klee One","Noto Sans JP",sans-serif', weight: 600 },
  maru: { label: '丸ゴシック', css: '"Zen Maru Gothic","Noto Sans JP",sans-serif', weight: 700 },
  mincho: { label: '明朝', css: '"Noto Serif JP","Noto Serif CJK JP","Hiragino Mincho ProN","Yu Mincho",serif', weight: 500 }
};
const TEXT_LINE = 1.3; /* 行の 高さ（文字の 大きさの 何ばいか） */

/* ファイル名の 日時 */
function stamp(d) {
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes());
}

const api = {
  newId, clamp, SHAPES, isBoxShape, BG_KINDS, BG_COLORS, LINE_COLORS, STRENGTH_ALPHA, DEFAULT_BG,
  sanitizeBg, isDarkBg, bgLineColor, bgShapes, ZOOM_MIN, ZOOM_MAX, DEFAULT_VIEW, sanitizeView, toWorld, toScreen, zoomAt,
  pinchView, visibleRect, fitInto, resizeBox, corners, imageRefs, snapPoint, canSnap, constrainAngle, constrainSquare,
  shapePolygon, arrowHead, distToSeg, distToPolyline, pointInPolygon, hitTest, bbox, rectsOverlap, normRect,
  translate, duplicate, hasColor, thinPoints, round1, floodFill, dilateMask, sanitizeObj, sanitizePage,
  FONTS, TEXT_LINE, stamp
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Board = api;
})(typeof self !== 'undefined' ? self : this);
