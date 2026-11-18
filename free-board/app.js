/* フリーボード ── 画面と そうさ */
(function () {
'use strict';
const B = window.Board;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const LS_BOARD = 'free-board-v1';
const LS_SET = 'free-board-settings-v1';
const MAX_UNDO = 150;

/* ---------- どうぐ・色 ---------- */
const TOOLS = [
  { g: 'かく' },
  { id: 'pen', label: 'ペン', key: 'P' },
  { id: 'hl', label: '蛍光ペン', key: 'M' },
  { id: 'text', label: '文字', key: 'T' },
  { g: '線・図形' },
  { id: 'line', label: '直線', key: 'L' },
  { id: 'arrow', label: '矢印', key: 'A' },
  { id: 'circle', label: '円', key: 'C' },
  { id: 'ellipse', label: 'だ円', key: 'O' },
  { id: 'rect', label: '四角', key: 'R' },
  { id: 'tri', label: '三角' },
  { id: 'rtri', label: '直角三角' },
  { id: 'fill', label: 'ぬりつぶし', key: 'B', wide: true },
  { g: '消す・うごかす' },
  { id: 'erase', label: '消しゴム', key: 'E' },
  { id: 'objerase', label: '線ごと消す', key: 'X' },
  { id: 'select', label: 'えらぶ・動かす', key: 'V' }
];
const TOOL_IDS = TOOLS.filter(t => t.id).map(t => t.id);
const SHAPE_TOOLS = ['line', 'arrow', 'circle', 'ellipse', 'rect', 'tri', 'rtri'];
const COLORS = [
  ['#222222', '黒'], ['#ffffff', '白'], ['#e53935', '赤'], ['#1e66d0', '青'], ['#2e9e44', '緑'], ['#f5c400', '黄'],
  ['#f57c00', 'オレンジ'], ['#ec5f9e', 'ピンク'], ['#8e44ad', 'むらさき'], ['#8d5a2b', '茶'], ['#29b6f6', '水色'], ['#9e9e9e', '灰色']
];
/* 太さ：どうぐごとに べつに おぼえる。画面の 上での 太さ（拡大して いても この 太さで かく） */
const WIDTH = {
  pen: { key: 'penW', title: '太さ', presets: [[2, '細い'], [4, 'ふつう'], [8, '太い'], [16, '特太']], max: 40 },
  hl: { key: 'hlW', title: '太さ', presets: [[12, '細い'], [22, 'ふつう'], [36, '太い']], max: 60 },
  shape: { key: 'shapeW', title: '線の 太さ', presets: [[2, '細い'], [4, 'ふつう'], [8, '太い']], max: 30 },
  erase: { key: 'eraseW', title: '消しゴムの 大きさ', presets: [[16, '小'], [36, '中'], [80, '大']], max: 160 }
};
const widthGroup = t => t === 'pen' ? 'pen' : t === 'hl' ? 'hl' : t === 'erase' ? 'erase' : SHAPE_TOOLS.indexOf(t) >= 0 ? 'shape' : null;
const TSIZE_PRESETS = [[24, '小'], [40, '中'], [64, '大'], [100, '特大']];

const S = {
  tool: 'pen', color: '#222222',
  penW: 4, hlW: 22, shapeW: 4, eraseW: 36,
  textSize: 48, font: 'gothic',
  shapeFill: 'none', dash: false, snap: true,
  side: 'left', open: true
};

/* ---------- ページ ---------- */
let pages = [];
let cur = 0;
const page = () => pages[cur];
const view = () => pages[cur].view;
const newPage = bg => ({ bg: B.sanitizeBg(bg), view: Object.assign({}, B.DEFAULT_VIEW), objs: [], undo: [], redo: [] });
const r3 = v => Math.round(v * 1000) / 1000;

/* ---------- canvas ----------
   c-bg（背景）・c-img（はりつけた 画像）・c-ink（かいた もの）・c-top（かいて いる とちゅう・わく）
   画像は 消しゴムで 消えない ように、べつの canvas に かく */
const cBg = $('#c-bg'), cImg = $('#c-img'), cInk = $('#c-ink'), cTop = $('#c-top');
const xBg = cBg.getContext('2d'), xImg = cImg.getContext('2d'), xInk = cInk.getContext('2d'), xTop = cTop.getContext('2d');
let W = 0, H = 0, dpr = 1;

const worldTf = x => { const v = view(); x.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.x, dpr * v.y); };
const screenTf = x => x.setTransform(dpr, 0, 0, dpr, 0, 0);
const clearC = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); };
const toS = (wx, wy) => B.toScreen(view(), wx, wy);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth; H = window.innerHeight;
  for (const c of [cBg, cImg, cInk, cTop]) {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  renderAll();
}
function renderAll() { renderBg(); renderScene(); renderTop(); syncZoom(); }
function renderScene(skip, replace) { renderImg(skip, replace); renderInk(skip, replace); }

/* ---------- 背景を かく（拡大しても 線は 1px の まま、くっきり） ---------- */
function renderBg() {
  const bg = page().bg, v = view();
  clearC(xBg);
  screenTf(xBg);
  xBg.fillStyle = (B.BG_COLORS[bg.color] || B.BG_COLORS.white).fill;
  xBg.fillRect(0, 0, W, H);
  const sh = B.bgShapes(bg, B.visibleRect(v, W, H), W, v.s);
  xBg.strokeStyle = xBg.fillStyle = B.bgLineColor(bg);
  xBg.globalAlpha = B.STRENGTH_ALPHA[bg.strength];
  const crisp = (p, w) => Math.round(p * dpr) / dpr + ((Math.round(w * dpr) % 2) ? 0.5 / dpr : 0);
  for (const l of sh.lines) {
    xBg.beginPath();
    xBg.lineWidth = l.w;
    xBg.setLineDash(l.dash ? [4, 5] : []);
    const a = toS(l.x1, l.y1), b = toS(l.x2, l.y2);
    if (l.x1 === l.x2) { const x = crisp(a[0], l.w); xBg.moveTo(x, a[1]); xBg.lineTo(x, b[1]); }
    else { const y = crisp(a[1], l.w); xBg.moveTo(a[0], y); xBg.lineTo(b[0], y); }
    xBg.stroke();
  }
  xBg.setLineDash([]);
  if (sh.dots.length) {
    xBg.globalAlpha = Math.min(1, B.STRENGTH_ALPHA[bg.strength] + 0.2);
    xBg.beginPath();
    for (const d of sh.dots) { const p = toS(d.x, d.y); xBg.moveTo(p[0] + d.r, p[1]); xBg.arc(p[0], p[1], d.r, 0, Math.PI * 2); }
    xBg.fill();
  }
  xBg.globalAlpha = 1;
  document.body.style.background = (B.BG_COLORS[bg.color] || B.BG_COLORS.white).fill;
}

/* ---------- はりつけた 画像（IndexedDB に しまう） ---------- */
let dbP = null;
function idb() {
  if (!dbP) dbP = new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('IndexedDB なし')); return; }
    const r = indexedDB.open('free-board', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}
function idbDo(mode, fn) {
  return idb().then(db => new Promise((res, rej) => {
    const tx = db.transaction('images', mode);
    const rq = fn(tx.objectStore('images'));
    tx.oncomplete = () => res(rq ? rq.result : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  }));
}
const idbPut = (ref, blob) => idbDo('readwrite', st => st.put(blob, ref));
const idbGet = ref => idbDo('readonly', st => st.get(ref));
const idbKeys = () => idbDo('readonly', st => st.getAllKeys());
const idbDel = ref => idbDo('readwrite', st => st.delete(ref));

const images = new Map(); /* ref → { state: 'loading' | 'ready' | 'missing', bmp } */
function imageFor(ref) {
  let e = images.get(ref);
  if (!e) {
    e = { state: 'loading', bmp: null };
    images.set(ref, e);
    idbGet(ref)
      .then(blob => blob ? createImageBitmap(blob) : null)
      .then(bmp => { if (bmp) { e.bmp = bmp; e.state = 'ready'; } else e.state = 'missing'; renderImg(); })
      .catch(() => { e.state = 'missing'; renderImg(); });
  }
  return e;
}
function drawImageObj(x, o) {
  const e = imageFor(o.ref);
  x.save();
  if (e.state === 'ready') {
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(e.bmp, o.x, o.y, o.w, o.h);
  } else {
    const v = view();
    x.fillStyle = 'rgba(128,128,128,.12)'; x.fillRect(o.x, o.y, o.w, o.h);
    x.strokeStyle = 'rgba(128,128,128,.6)'; x.lineWidth = 1.5 / v.s; x.setLineDash([6 / v.s, 5 / v.s]);
    x.strokeRect(o.x, o.y, o.w, o.h);
    if (e.state === 'missing') {
      x.fillStyle = 'rgba(100,100,100,.9)'; x.font = (14 / v.s) + 'px sans-serif'; x.textBaseline = 'top';
      x.fillText('画像が 見つかりません', o.x + 8 / v.s, o.y + 8 / v.s);
    }
  }
  x.restore();
}
function renderImg(skip, replace) {
  if (!pages.length) return;
  clearC(xImg); worldTf(xImg);
  for (const o of page().objs) {
    if (o.t !== 'image' || (skip && skip.has(o.id))) continue;
    drawImageObj(xImg, (replace && replace.get(o.id)) || o);
  }
}

/* ---------- もの を かく ---------- */
const fillCache = new Map(); /* src → { img, ready, data } */
function fillImage(o) {
  let e = fillCache.get(o.src);
  if (!e) {
    const img = new Image();
    e = { img: img, ready: false };
    img.onload = () => { e.ready = true; renderInk(); };
    img.src = o.src;
    fillCache.set(o.src, e);
  }
  return e.ready ? e.img : null;
}
function fillAlphaAt(o, x, y) {
  const e = fillCache.get(o.src);
  if (!e || !e.ready) return true;
  if (!e.data) {
    const c = document.createElement('canvas');
    c.width = e.img.naturalWidth || e.img.width; c.height = e.img.naturalHeight || e.img.height;
    const cx = c.getContext('2d');
    cx.drawImage(e.img, 0, 0);
    e.data = { w: c.width, h: c.height, d: cx.getImageData(0, 0, c.width, c.height).data };
  }
  const px = Math.floor((x - o.x) / o.w * e.data.w), py = Math.floor((y - o.y) / o.h * e.data.h);
  if (px < 0 || py < 0 || px >= e.data.w || py >= e.data.h) return false;
  return e.data.d[(py * e.data.w + px) * 4 + 3] > 20;
}

function strokePath(x, pts) {
  x.beginPath();
  if (pts.length === 1) { x.moveTo(pts[0][0], pts[0][1]); x.lineTo(pts[0][0] + 0.001, pts[0][1]); return; }
  x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    x.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  x.lineTo(l[0], l[1]);
}
function fontCss(size, font) {
  const f = B.FONTS[font] || B.FONTS.gothic;
  return f.weight + ' ' + size + 'px ' + f.css;
}
function shapeFillStyle(x, o) {
  if (!o.fill || o.fill === 'none') return false;
  x.fillStyle = o.c;
  x.globalAlpha = o.fill === 'light' ? 0.25 : 1;
  return true;
}
function drawObj(x, o) {
  x.save();
  x.lineCap = 'round'; x.lineJoin = 'round';
  switch (o.t) {
    case 'pen':
      x.strokeStyle = o.c; x.lineWidth = o.w;
      if (o.hl) { x.globalAlpha = 0.38; x.lineCap = 'butt'; x.lineJoin = 'round'; if (o.pts.length === 1) x.lineCap = 'square'; }
      strokePath(x, o.pts); x.stroke();
      break;
    case 'erase':
      x.globalCompositeOperation = 'destination-out';
      x.strokeStyle = '#000'; x.lineWidth = o.w;
      strokePath(x, o.pts); x.stroke();
      break;
    case 'line': {
      x.strokeStyle = x.fillStyle = o.c; x.lineWidth = o.w;
      if (o.dash) { x.setLineDash([o.w * 2.6, o.w * 2.2]); x.lineCap = 'butt'; }
      let ex = o.x2, ey = o.y2, head = null;
      if (o.arrow) {
        head = B.arrowHead(o.x1, o.y1, o.x2, o.y2, o.w);
        /* 線の 先は 矢じりの なかほどまで（太い 線が はみ出さない） */
        ex = (head[1][0] + head[2][0]) / 2 * 0.6 + o.x2 * 0.4;
        ey = (head[1][1] + head[2][1]) / 2 * 0.6 + o.y2 * 0.4;
      }
      x.beginPath(); x.moveTo(o.x1, o.y1); x.lineTo(ex, ey); x.stroke();
      if (head) {
        x.setLineDash([]);
        x.beginPath(); x.moveTo(head[0][0], head[0][1]); x.lineTo(head[1][0], head[1][1]); x.lineTo(head[2][0], head[2][1]); x.closePath();
        x.lineWidth = o.w * 0.5; x.stroke(); x.fill();
      }
      break;
    }
    case 'circle': case 'ellipse': case 'rect': case 'tri': case 'rtri': {
      x.beginPath();
      if (o.t === 'circle') x.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
      else if (o.t === 'ellipse') x.ellipse((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, Math.abs(o.x2 - o.x1) / 2, Math.abs(o.y2 - o.y1) / 2, 0, 0, Math.PI * 2);
      else { const p = B.shapePolygon(o); x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); x.closePath(); }
      if (o.t === 'rect' || o.t === 'tri' || o.t === 'rtri') x.lineJoin = 'miter';
      if (shapeFillStyle(x, o)) { x.fill(); x.globalAlpha = 1; }
      x.strokeStyle = o.c; x.lineWidth = o.w;
      if (o.dash) { x.setLineDash([o.w * 2.6, o.w * 2.2]); x.lineCap = 'butt'; }
      x.stroke();
      break;
    }
    case 'text': {
      x.font = fontCss(o.size, o.font); x.fillStyle = o.c; x.textBaseline = 'middle';
      const lh = o.size * B.TEXT_LINE;
      o.text.split('\n').forEach((line, i) => x.fillText(line, o.x, o.y + lh * i + lh / 2));
      break;
    }
    case 'fill': {
      const img = fillImage(o);
      if (img) {
        if (o.under) x.globalCompositeOperation = 'destination-over';
        x.drawImage(img, o.x, o.y, o.w, o.h);
      }
      break;
    }
    case 'image':
      drawImageObj(x, o);
      break;
  }
  x.restore();
}

/* skip: かかない id、replace: id → かわりに かく もの */
function renderInk(skip, replace) {
  if (!pages.length) return;
  clearC(xInk); worldTf(xInk);
  for (const o of page().objs) {
    if (o.t === 'image' || (skip && skip.has(o.id))) continue;
    drawObj(xInk, (replace && replace.get(o.id)) || o);
  }
}

/* ---------- いちばん上（かいて いる とちゅう・えらんだ わく・消しゴムの まる） ---------- */
let act = null;      /* いま ドラッグ中の そうさ */
let hover = null;    /* マウスの ある ところ（画面の ざひょう） */
let selection = new Set();
let topQueued = false, allQueued = false;
function queueTop() {
  if (topQueued) return;
  topQueued = true;
  requestAnimationFrame(() => { topQueued = false; renderTop(); });
}
function queueAll() {
  if (allQueued) return;
  allQueued = true;
  requestAnimationFrame(() => { allQueued = false; renderAll(); });
}
const OBJ_ERASE_TOL = 10;  /* 画面の 上での ゆとり */
const HANDLE = 12;         /* 画像の 角の つまみ（画面の 上での 大きさ） */

/* えらんで いる ものが 画像 1まい だけなら その 画像 */
function selectedImage() {
  if (selection.size !== 1) return null;
  const id = selection.values().next().value;
  const o = page().objs.find(x => x.id === id);
  return o && o.t === 'image' ? o : null;
}
function renderTop() {
  clearC(xTop);
  if (!pages.length) return;
  if (act && act.obj && (act.kind === 'pen' || act.kind === 'shape')) { worldTf(xTop); drawObj(xTop, act.obj); }
  screenTf(xTop);
  /* えらんだ もの */
  if (selection.size) {
    const shown = o => act && act.kind === 'move' ? B.translate(o, act.dx, act.dy) : act && act.kind === 'resize' && act.id === o.id && act.cur ? act.cur : o;
    xTop.save();
    xTop.strokeStyle = '#1f6fd1'; xTop.lineWidth = 1.5; xTop.setLineDash([6, 4]);
    for (const o of page().objs) {
      if (!selection.has(o.id)) continue;
      const b = B.bbox(shown(o)), a = toS(b.x, b.y), z = toS(b.x + b.w, b.y + b.h);
      xTop.strokeRect(a[0] - 5, a[1] - 5, z[0] - a[0] + 10, z[1] - a[1] + 10);
    }
    const img = selectedImage();
    if (img) {
      xTop.setLineDash([]); xTop.fillStyle = '#fff'; xTop.lineWidth = 2;
      for (const c of B.corners(shown(img))) {
        const p = toS(c[0], c[1]);
        xTop.fillRect(p[0] - HANDLE / 2, p[1] - HANDLE / 2, HANDLE, HANDLE);
        xTop.strokeRect(p[0] - HANDLE / 2, p[1] - HANDLE / 2, HANDLE, HANDLE);
      }
    }
    xTop.restore();
  }
  if (act && act.kind === 'marquee') {
    const r = B.normRect(act.sx0, act.sy0, act.sx1, act.sy1);
    xTop.save();
    xTop.fillStyle = 'rgba(31,111,209,.08)'; xTop.strokeStyle = '#1f6fd1'; xTop.lineWidth = 1; xTop.setLineDash([5, 4]);
    xTop.fillRect(r.x, r.y, r.w, r.h); xTop.strokeRect(r.x, r.y, r.w, r.h);
    xTop.restore();
  }
  /* 消しゴムの まる（画面の 上で いつも おなじ 大きさ） */
  if (hover && (S.tool === 'erase' || S.tool === 'objerase') && !(act && act.kind === 'pinch')) {
    const r = S.tool === 'erase' ? S.eraseW / 2 : OBJ_ERASE_TOL;
    const dark = B.isDarkBg(page().bg);
    xTop.save();
    xTop.beginPath(); xTop.arc(hover.x, hover.y, r, 0, Math.PI * 2);
    xTop.fillStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)'; xTop.fill();
    xTop.lineWidth = 1.5; xTop.strokeStyle = dark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.55)'; xTop.stroke();
    xTop.restore();
  }
}

/* ---------- きろく（もどす・やりなおす） ---------- */
function commit(objs) {
  const p = page();
  p.undo.push(p.objs);
  if (p.undo.length > MAX_UNDO) p.undo.shift();
  p.redo = [];
  p.objs = objs;
  afterChange();
}
function afterChange() {
  const ids = new Set(page().objs.map(o => o.id));
  for (const id of Array.from(selection)) if (!ids.has(id)) selection.delete(id);
  renderScene(); renderTop(); syncUndo(); syncSelect(); save();
}
function undo() {
  commitText();
  const p = page();
  if (!p.undo.length) return;
  p.redo.push(p.objs); p.objs = p.undo.pop();
  afterChange();
}
function redo() {
  commitText();
  const p = page();
  if (!p.redo.length) return;
  p.undo.push(p.objs); p.objs = p.redo.pop();
  afterChange();
}
function syncUndo() {
  $('#b-undo').disabled = !page().undo.length;
  $('#m-undo').disabled = !page().undo.length;
  $('#b-redo').disabled = !page().redo.length;
}

/* ---------- ほぞん ---------- */
let saveTimer = 0, warnedQuota = false, loadedOk = true;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 500);
}
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(LS_SET, JSON.stringify(S)); } catch (e) { /* なにも しない */ }
  try {
    localStorage.setItem(LS_BOARD, JSON.stringify({ v: 1, cur: cur, pages: pages.map(p => ({ bg: p.bg, view: p.view, objs: p.objs })) }));
    warnedQuota = false;
  } catch (e) {
    if (!warnedQuota) toast('ボードが 大きく なりすぎて、ブラウザに 保存 できませんでした（ぬりつぶし を へらすか、ページを 消して ください）', 5000);
    warnedQuota = true;
  }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SET) || 'null');
    if (s && typeof s === 'object') {
      for (const k of Object.keys(S)) if (typeof s[k] === typeof S[k]) S[k] = s[k];
    }
  } catch (e) { /* はじめから */ }
  if (TOOL_IDS.indexOf(S.tool) < 0) S.tool = 'pen';
  if (!/^#[0-9a-fA-F]{6}$/.test(S.color)) S.color = '#222222';
  if (!B.FONTS[S.font]) S.font = 'gothic';
  if (['none', 'light', 'solid'].indexOf(S.shapeFill) < 0) S.shapeFill = 'none';
  if (S.side !== 'right') S.side = 'left';
  for (const g of Object.values(WIDTH)) S[g.key] = B.clamp(Math.round(S[g.key]) || g.presets[1][0], 1, g.max);
  S.textSize = B.clamp(Math.round(S.textSize) || 48, 12, 240);
  try {
    const raw = localStorage.getItem(LS_BOARD);
    const d = JSON.parse(raw || 'null');
    if (d && Array.isArray(d.pages) && d.pages.length) {
      pages = d.pages.map(B.sanitizePage).map(p => Object.assign(p, { undo: [], redo: [] }));
      cur = B.clamp(Math.round(d.cur) || 0, 0, pages.length - 1);
    } else if (raw) loadedOk = false;
  } catch (e) { pages = []; loadedOk = false; }
  if (!pages.length) { pages = [newPage(B.DEFAULT_BG)]; cur = 0; }
}
/* どの ページでも つかって いない 画像を けす（ひらいた ときに 1回） */
function cleanImages() {
  if (!loadedOk) return;
  const used = B.imageRefs(pages);
  idbKeys().then(keys => { for (const k of keys) if (!used.has(k)) idbDel(k).catch(() => {}); }).catch(() => {});
}

/* ---------- ゆび・マウス ---------- */
const spt = e => { const r = cTop.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const toW = sp => { const w = B.toWorld(view(), sp.x, sp.y); return { x: w[0], y: w[1] }; };
function snapIfOn(p) {
  const bg = page().bg;
  if (S.snap && B.canSnap(bg)) { const s = B.snapPoint(p.x, p.y, bg.size); return { x: s[0], y: s[1] }; }
  return p;
}
/* いちばん 上に ある もの（画像は かいた ものより 下） */
function topHit(p, tolScreen) {
  const objs = page().objs, tol = tolScreen / view().s;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (o.t === 'erase' || (pass === 0) === (o.t === 'image')) continue;
      if (B.hitTest(o, p.x, p.y, tol) && (o.t !== 'fill' || fillAlphaAt(o, p.x, p.y))) return o;
    }
  }
  return null;
}
function handleAt(sp, touch) {
  const img = selectedImage();
  if (!img) return -1;
  const cs = B.corners(img), lim = touch ? 22 : 12;
  for (let i = 0; i < 4; i++) {
    const p = toS(cs[i][0], cs[i][1]);
    if (Math.abs(p[0] - sp.x) <= lim && Math.abs(p[1] - sp.y) <= lim) return i;
  }
  return -1;
}

const touches = new Map(); /* ゆびの id → 画面の ざひょう */
let spaceDown = false;
let lastDown = { t: 0, x: 0, y: 0 };

function cancelAct() {
  const a = act; act = null;
  if (!a) return;
  if (['erase', 'objerase', 'move', 'resize'].indexOf(a.kind) >= 0) renderScene();
  renderTop();
}
function startPinch() {
  cancelAct();
  commitText();
  const ids = Array.from(touches.keys()).slice(-2);
  act = { kind: 'pinch', ptype: 'touch', ids: ids, a0: touches.get(ids[0]), b0: touches.get(ids[1]), v0: Object.assign({}, view()) };
  renderTop();
}
function setView(v) {
  page().view = B.sanitizeView(v);
  queueAll();
}

cTop.addEventListener('pointerdown', e => {
  const sp = spt(e);
  if (e.pointerType === 'touch') touches.set(e.pointerId, sp);
  /* 2本目の ゆび → 拡大・移動（ペンで かいて いる ときの てのひら は むし） */
  if (e.pointerType === 'touch' && touches.size >= 2 && (!act || act.ptype === 'touch')) { e.preventDefault(); startPinch(); return; }
  if (act) return;
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  const p = toW(sp);
  const dbl = e.timeStamp - lastDown.t < 400 && Math.hypot(sp.x - lastDown.x, sp.y - lastDown.y) < 8;
  lastDown = { t: e.timeStamp, x: sp.x, y: sp.y };
  hover = sp;

  /* スペースを おしながら・まんなかの ボタン → ボードを うごかす */
  if (spaceDown || e.button === 1) {
    commitText();
    cTop.setPointerCapture(e.pointerId);
    act = { kind: 'pan', pid: e.pointerId, ptype: e.pointerType, sx: sp.x, sy: sp.y, v0: Object.assign({}, view()) };
    return;
  }
  if (edit) { commitText(); if (S.tool !== 'text') return; }
  const t = S.tool, s = view().s;

  if (t === 'text') {
    const hit = topHit(p, 4);
    if (hit && hit.t === 'text') openEditor(hit.x, hit.y, hit);
    else openEditor(p.x, p.y - S.textSize / s * B.TEXT_LINE / 2, null);
    return;
  }
  if (t === 'fill') { doFill(sp); return; }

  cTop.setPointerCapture(e.pointerId);
  const base = { pid: e.pointerId, ptype: e.pointerType, t0: e.timeStamp };
  if (t === 'pen' || t === 'hl') {
    act = Object.assign(base, { kind: 'pen', obj: { t: 'pen', id: B.newId(), pts: [[p.x, p.y]], c: S.color, w: r3((t === 'hl' ? S.hlW : S.penW) / s), hl: t === 'hl' } });
  } else if (t === 'erase') {
    act = Object.assign(base, { kind: 'erase', obj: { t: 'erase', id: B.newId(), pts: [[p.x, p.y]], w: r3(S.eraseW / s) } });
    eraseLive(act.obj.pts);
  } else if (t === 'objerase') {
    act = Object.assign(base, { kind: 'objerase', hidden: new Set(), last: p });
    objEraseAt(p, p);
  } else if (SHAPE_TOOLS.indexOf(t) >= 0) {
    const q = snapIfOn(p);
    act = Object.assign(base, { kind: 'shape', x0: q.x, y0: q.y, obj: null });
    updateShape(q, e.shiftKey);
  } else if (t === 'select') {
    const corner = handleAt(sp, e.pointerType === 'touch');
    if (corner >= 0) {
      const img = selectedImage();
      act = Object.assign(base, { kind: 'resize', id: img.id, corner: corner, orig: img, cur: null });
      renderTop();
      return;
    }
    const hit = topHit(p, 8);
    if (hit && dbl && hit.t === 'text') { cTop.releasePointerCapture(e.pointerId); openEditor(hit.x, hit.y, hit); return; }
    if (hit) {
      if (e.shiftKey) { if (selection.has(hit.id)) selection.delete(hit.id); else selection.add(hit.id); }
      else if (!selection.has(hit.id)) { selection.clear(); selection.add(hit.id); }
      act = Object.assign(base, { kind: 'move', x0: p.x, y0: p.y, dx: 0, dy: 0 });
    } else {
      if (!e.shiftKey) selection.clear();
      act = Object.assign(base, { kind: 'marquee', sx0: sp.x, sy0: sp.y, sx1: sp.x, sy1: sp.y });
    }
    syncSelect();
  }
  renderTop();
});

cTop.addEventListener('pointermove', e => {
  const sp = spt(e);
  if (touches.has(e.pointerId)) touches.set(e.pointerId, sp);
  if (act && act.kind === 'pinch') {
    if (act.ids.indexOf(e.pointerId) >= 0 && touches.has(act.ids[0]) && touches.has(act.ids[1])) {
      const a = touches.get(act.ids[0]), b = touches.get(act.ids[1]);
      setView(B.pinchView(act.v0, [act.a0.x, act.a0.y], [act.b0.x, act.b0.y], [a.x, a.y], [b.x, b.y]));
    }
    return;
  }
  hover = sp;
  if (!act || e.pointerId !== act.pid) { if (S.tool === 'erase' || S.tool === 'objerase') queueTop(); updateCursor(sp); return; }
  if (act.kind === 'pan') {
    setView({ s: act.v0.s, x: act.v0.x + sp.x - act.sx, y: act.v0.y + sp.y - act.sy });
    return;
  }
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = (evs.length ? evs.map(spt) : [sp]).map(toW);
  const p = list[list.length - 1];
  if (act.kind === 'pen') {
    const pts = act.obj.pts, minD = 0.8 / view().s;
    for (const q of list) {
      const l = pts[pts.length - 1];
      if (Math.hypot(q.x - l[0], q.y - l[1]) >= minD) pts.push([q.x, q.y]);
    }
  } else if (act.kind === 'erase') {
    const pts = act.obj.pts;
    for (const q of list) pts.push([q.x, q.y]);
    eraseLive(pts.slice(-list.length - 1));
  } else if (act.kind === 'objerase') {
    for (const q of list) { objEraseAt(act.last, q); act.last = q; }
  } else if (act.kind === 'shape') {
    updateShape(snapIfOn(p), e.shiftKey);
  } else if (act.kind === 'move') {
    act.dx = p.x - act.x0; act.dy = p.y - act.y0;
    const rep = new Map();
    for (const o of page().objs) if (selection.has(o.id)) rep.set(o.id, B.translate(o, act.dx, act.dy));
    renderScene(null, rep);
  } else if (act.kind === 'resize') {
    act.cur = B.resizeBox(act.orig, act.corner, p.x, p.y, 16 / view().s);
    renderImg(null, new Map([[act.id, act.cur]]));
  } else if (act.kind === 'marquee') {
    act.sx1 = sp.x; act.sy1 = sp.y;
  }
  queueTop();
});

function endPointer(e, cancel) {
  touches.delete(e.pointerId);
  if (!act) return;
  if (act.kind === 'pinch') {
    if (act.ids.indexOf(e.pointerId) >= 0) { act = null; save(); renderTop(); }
    return;
  }
  if (e.pointerId !== act.pid) return;
  const a = act; act = null;
  const objs = page().objs;
  if (a.kind === 'pan') {
    save();
  } else if (a.kind === 'pen') {
    const o = a.obj;
    o.pts = B.thinPoints(o.pts, 1.2 / view().s).map(q => [r3(q[0]), r3(q[1])]);
    if (!cancel || o.pts.length > 2) commit(objs.concat([o]));
  } else if (a.kind === 'erase') {
    const o = a.obj;
    o.pts = B.thinPoints(o.pts, 1 / view().s).map(q => [r3(q[0]), r3(q[1])]);
    const eb = B.bbox(o);
    /* なにも ない ところを こすった だけなら きろく しない */
    if (objs.some(x => x.t !== 'erase' && x.t !== 'image' && B.rectsOverlap(B.bbox(x), eb))) commit(objs.concat([o]));
    else renderInk();
  } else if (a.kind === 'objerase') {
    if (a.hidden.size) commit(objs.filter(o => !a.hidden.has(o.id)));
  } else if (a.kind === 'shape') {
    if (a.obj && !cancel && shapeSize(a.obj) * view().s >= 3) commit(objs.concat([a.obj]));
  } else if (a.kind === 'move') {
    if (a.dx || a.dy) commit(objs.map(o => selection.has(o.id) ? B.translate(o, a.dx, a.dy) : o));
    else renderScene();
  } else if (a.kind === 'resize') {
    if (a.cur && !cancel) commit(objs.map(o => o.id === a.id ? a.cur : o));
    else renderScene();
  } else if (a.kind === 'marquee') {
    const r1 = B.normRect(a.sx0, a.sy0, a.sx1, a.sy1);
    if (r1.w > 3 || r1.h > 3) {
      const p0 = toW({ x: r1.x, y: r1.y }), p1 = toW({ x: r1.x + r1.w, y: r1.y + r1.h });
      const r = { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
      for (const o of objs) {
        if (o.t === 'erase') continue;
        const b = B.bbox(o);
        if (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h) selection.add(o.id);
      }
    }
    syncSelect();
  }
  renderTop();
}
cTop.addEventListener('pointerup', e => endPointer(e, false));
cTop.addEventListener('pointercancel', e => endPointer(e, true));
cTop.addEventListener('pointerleave', () => { if (!act) { hover = null; queueTop(); } });
cTop.addEventListener('contextmenu', e => e.preventDefault());

/* タッチパッドの 2本ゆび：ピンチ（Ctrl つきの ホイール）で 拡大、スクロールで 移動 */
cTop.addEventListener('wheel', e => {
  e.preventDefault();
  if (act && act.kind !== 'pan') return;
  commitText();
  const v = view();
  if (e.ctrlKey || e.metaKey) {
    const sp = spt(e);
    /* タッチパッドの ピンチは 小さく こまかく、マウスの ホイールは 1こま 1.35ばい まで */
    setView(B.zoomAt(v, v.s * Math.exp(-B.clamp(e.deltaY, -60, 60) * 0.005), sp.x, sp.y));
  } else {
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    setView({ s: v.s, x: v.x - dx, y: v.y - dy });
  }
  save();
}, { passive: false });
/* ボード いがいでも、ブラウザ じたいの 拡大は させない（せっていの 画面は そのままの 大きさ） */
window.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
['gesturestart', 'gesturechange'].forEach(n => document.addEventListener(n, e => e.preventDefault()));

function updateCursor(sp) {
  const t = S.tool;
  let c = 'cur-draw';
  if (spaceDown) c = 'cur-grab';
  else if (t === 'text') c = 'cur-text';
  else if (t === 'erase') c = 'cur-none';
  else if (t === 'fill') c = 'cur-fill';
  else if (t === 'select') {
    const h = sp ? handleAt(sp, false) : -1;
    c = h === 0 || h === 2 ? 'cur-nwse' : h === 1 || h === 3 ? 'cur-nesw' : sp && topHit(toW(sp), 8) ? 'cur-move' : 'cur-select';
  }
  if (cTop.dataset.cur !== c) { cTop.className = c; cTop.dataset.cur = c; }
}

/* 消しゴム：かいて いる あいだは ink に じかに けす */
function eraseLive(pts) {
  xInk.save();
  worldTf(xInk);
  xInk.globalCompositeOperation = 'destination-out';
  xInk.lineCap = 'round'; xInk.lineJoin = 'round'; xInk.lineWidth = act.obj.w; xInk.strokeStyle = '#000';
  xInk.beginPath();
  xInk.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) xInk.lineTo(pts[0][0] + 0.001, pts[0][1]);
  for (let i = 1; i < pts.length; i++) xInk.lineTo(pts[i][0], pts[i][1]);
  xInk.stroke();
  xInk.restore();
}
/* 線ごと 消す：a から b まで なぞった ところに ある もの を かくす（画像は けさない） */
function objEraseAt(a, b) {
  const s = view().s, tol = OBJ_ERASE_TOL / s;
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * s / 4));
  let changed = false;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    for (const o of page().objs) {
      if (o.t === 'erase' || o.t === 'image' || act.hidden.has(o.id)) continue;
      if (B.hitTest(o, x, y, tol) && (o.t !== 'fill' || fillAlphaAt(o, x, y))) { act.hidden.add(o.id); changed = true; }
    }
  }
  if (changed) renderInk(act.hidden);
}

/* 直線・図形 */
function updateShape(p, shift) {
  const t = S.tool, x0 = act.x0, y0 = act.y0;
  let x2 = p.x, y2 = p.y;
  const base = { id: act.obj ? act.obj.id : B.newId(), c: S.color, w: r3(S.shapeW / view().s), dash: S.dash };
  if (t === 'line' || t === 'arrow') {
    if (shift) [x2, y2] = B.constrainAngle(x0, y0, x2, y2, 15);
    act.obj = Object.assign(base, { t: 'line', x1: x0, y1: y0, x2: x2, y2: y2, arrow: t === 'arrow' });
  } else if (t === 'circle') {
    act.obj = Object.assign(base, { t: 'circle', cx: x0, cy: y0, r: Math.hypot(x2 - x0, y2 - y0), fill: S.shapeFill });
  } else {
    if (shift) [x2, y2] = B.constrainSquare(x0, y0, x2, y2);
    act.obj = Object.assign(base, { t: t, x1: x0, y1: y0, x2: x2, y2: y2, fill: S.shapeFill });
  }
  queueTop();
}
function shapeSize(o) {
  if (o.t === 'circle') return o.r;
  return Math.max(Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1));
}

/* ---------- ぬりつぶし（いま 見えて いる 画面の こまかさで つくる） ---------- */
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function doFill(sp) {
  renderInk();
  const Wd = cInk.width, Hd = cInk.height;
  const sx = Math.floor(sp.x * dpr), sy = Math.floor(sp.y * dpr);
  if (sx < 0 || sy < 0 || sx >= Wd || sy >= Hd) return;
  let data;
  try { data = xInk.getImageData(0, 0, Wd, Hd).data; } catch (e) { return; }
  const under = data[(sy * Wd + sx) * 4 + 3] <= 48;
  let res = B.floodFill(data, Wd, Hd, sx, sy, 48);
  if (!res) return;
  res = B.dilateMask(res, Wd, Hd, under ? Math.max(2, Math.round(2 * dpr)) : 1);
  const c = document.createElement('canvas');
  c.width = res.w; c.height = res.h;
  const cx = c.getContext('2d');
  const img = cx.createImageData(res.w, res.h);
  const rgb = hexRgb(S.color), d = img.data, m = res.mask;
  for (let y = 0; y < res.h; y++) {
    const row = (res.y + y) * Wd + res.x;
    for (let x = 0; x < res.w; x++) {
      if (!m[row + x]) continue;
      const k = (y * res.w + x) * 4;
      d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  const src = c.toDataURL('image/png');
  fillCache.set(src, { img: c, ready: true });
  const v = view();
  const o = { t: 'fill', id: B.newId(), x: r3((res.x / dpr - v.x) / v.s), y: r3((res.y / dpr - v.y) / v.s), w: r3(res.w / dpr / v.s), h: r3(res.h / dpr / v.s), src: src, under: under };
  commit(page().objs.concat([o]));
}

/* ---------- 文字（大きさは 画面の 上での 大きさ。拡大して いる ときは そのぶん 小さく しまう） ---------- */
const te = $('#texted');
let edit = null; /* { x, y, orig, shown } x,y は ボードの ざひょう */
function editScreenSize() {
  if (edit && edit.orig && S.textSize === edit.shown) return edit.orig.size * view().s;
  return S.textSize;
}
function styleEditor() {
  if (!edit) return;
  const f = B.FONTS[S.font] || B.FONTS.gothic, size = editScreenSize(), p = toS(edit.x, edit.y);
  te.style.font = fontCss(size, S.font);
  te.style.fontWeight = f.weight;
  te.style.lineHeight = B.TEXT_LINE;
  te.style.color = S.color;
  te.style.left = p[0] + 'px'; te.style.top = p[1] + 'px';
  sizeEditor();
}
function measureText(text, size, font) {
  xTop.save();
  xTop.setTransform(1, 0, 0, 1, 0, 0);
  xTop.font = fontCss(size, font);
  const lines = text.split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, xTop.measureText(l).width);
  xTop.restore();
  return { w: w, h: lines.length * size * B.TEXT_LINE };
}
function sizeEditor() {
  const size = editScreenSize(), m = measureText(te.value || ' ', size, S.font);
  te.style.width = Math.ceil(Math.max(size * 2, m.w + size)) + 'px';
  te.style.height = Math.ceil(Math.max(size * B.TEXT_LINE, m.h)) + 'px';
}
function openEditor(x, y, orig) {
  commitText();
  let shown = 0;
  if (orig) {
    shown = B.clamp(Math.round(orig.size * view().s), 12, 240);
    S.textSize = shown; S.font = orig.font; S.color = orig.c;
    if (S.tool !== 'text') setTool('text');
    syncUI();
  }
  edit = { x: x, y: y, orig: orig, shown: shown };
  te.value = orig ? orig.text : '';
  te.hidden = false;
  styleEditor();
  if (orig) renderInk(new Set([orig.id]));
  const focusIt = () => { if (edit && document.activeElement !== te) { te.focus(); te.setSelectionRange(te.value.length, te.value.length); } };
  focusIt();
  setTimeout(focusIt, 0);
}
function commitText() {
  if (!edit) return;
  const e = edit; edit = null;
  const text = te.value.replace(/[\s　]+$/, '');
  te.hidden = true; te.value = '';
  te.blur();
  const objs = page().objs;
  if (!text) {
    if (e.orig) commit(objs.filter(o => o.id !== e.orig.id));
    else renderInk();
    return;
  }
  const size = e.orig && S.textSize === e.shown ? e.orig.size : r3(S.textSize / view().s);
  const m = measureText(text, size, S.font);
  const o = { t: 'text', id: e.orig ? e.orig.id : B.newId(), x: e.x, y: e.y, text: text, size: size, c: S.color, font: S.font, w: r3(m.w), h: r3(m.h) };
  if (e.orig) {
    const same = e.orig.text === o.text && e.orig.size === o.size && e.orig.c === o.c && e.orig.font === o.font;
    if (same) { renderInk(); return; }
    commit(objs.map(x => x.id === e.orig.id ? o : x));
  } else {
    commit(objs.concat([o]));
  }
}
te.addEventListener('input', sizeEditor);
te.addEventListener('keydown', e => {
  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitText(); }
  e.stopPropagation();
});
te.addEventListener('pointerdown', e => e.stopPropagation());

/* ---------- えらんだ もの ---------- */
function deleteSelection() {
  if (!selection.size) return;
  const ids = new Set(selection);
  selection.clear();
  commit(page().objs.filter(o => !ids.has(o.id)));
}
function duplicateSelection() {
  if (!selection.size) return;
  const add = [], d = 24 / view().s;
  for (const o of page().objs) if (selection.has(o.id)) add.push(B.duplicate(o, d, d));
  selection = new Set(add.map(o => o.id));
  commit(page().objs.concat(add));
}
function nudgeSelection(dx, dy) {
  if (!selection.size) return;
  const s = view().s;
  commit(page().objs.map(o => selection.has(o.id) ? B.translate(o, dx / s, dy / s) : o));
}
function recolorSelection(c) {
  let changed = false;
  const objs = page().objs.map(o => {
    if (!selection.has(o.id) || !B.hasColor(o) || o.c === c) return o;
    changed = true;
    return Object.assign({}, o, { c: c });
  });
  if (changed) commit(objs);
}
function reorderSelection(toFront) {
  if (!selection.size) return;
  const objs = page().objs, sel = objs.filter(o => selection.has(o.id)), rest = objs.filter(o => !selection.has(o.id));
  commit(toFront ? rest.concat(sel) : sel.concat(rest));
}
function syncSelect() {
  const show = S.tool === 'select';
  $('#sec-select').hidden = !show;
  $('#out-selcount').textContent = selection.size ? selection.size + 'こ' : 'なし';
  for (const id of ['#b-sel-del', '#b-sel-dup', '#b-sel-front', '#b-sel-back']) $(id).disabled = !selection.size;
}

/* ---------- 拡大・移動 ---------- */
/* せっていに かくれて いない ところ（画面の ざひょう） */
function freeScreenRect() {
  let x0 = 0, x1 = W;
  if (S.open) {
    const r = $('#panel').getBoundingClientRect();
    if (S.side === 'left') x0 = Math.min(W - 100, r.right); else x1 = Math.max(100, r.left);
  }
  return { x: x0, y: 0, w: x1 - x0, h: H };
}
function zoomBy(f) {
  commitText();
  const r = freeScreenRect(), v = view();
  setView(B.zoomAt(v, v.s * f, r.x + r.w / 2, r.y + r.h / 2));
  save();
}
function resetView() {
  commitText();
  setView(B.DEFAULT_VIEW);
  save();
}
function syncZoom() {
  if (!pages.length) return;
  const v = view(), pct = Math.round(v.s * 100) + '%';
  $('#out-zoom').textContent = pct;
  $('#zb-pct').textContent = pct;
  const moved = v.s !== 1 || v.x !== 0 || v.y !== 0;
  const zb = $('#zoombadge');
  zb.hidden = !moved;
  zb.classList.toggle('left', S.side === 'right');
  $('#b-zoomreset').disabled = !moved;
  if (edit) styleEditor();
}

/* ---------- 画像・PDF を はる ---------- */
const MAX_IMG = 3200;   /* しまう 画像の 長い 辺（これより 大きい 画像は 小さく する） */
const PDF_PX = 2800;    /* PDF の 1ページを 画像に する ときの 長い 辺 */
function canvasToBlob(c, type, q) { return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('画像に できません')), type, q)); }
async function storeImage(blob) {
  let bmp = await createImageBitmap(blob);
  let w = bmp.width, h = bmp.height, out = blob;
  const okType = /^image\/(png|jpeg|webp|gif)$/.test(blob.type);
  if (Math.max(w, h) > MAX_IMG || !okType || blob.size > 6e6) {
    const k = Math.min(1, MAX_IMG / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(bmp, 0, 0, c.width, c.height);
    out = await canvasToBlob(c, 'image/webp', 0.92);
    if (bmp.close) bmp.close();
    bmp = await createImageBitmap(out);
    w = c.width; h = c.height;
  }
  const ref = B.newId();
  await idbPut(ref, out);
  images.set(ref, { state: 'ready', bmp: bmp });
  return { ref: ref, w: w, h: h };
}
/* 画像たちを よこに ならべて、いま 見えて いる ところの まんなかに おく */
function placeImages(items) {
  if (!items.length) return;
  const gap = 24, totalW = items.reduce((a, it) => a + it.w, 0) + gap * (items.length - 1), maxH = Math.max.apply(null, items.map(it => it.h));
  const sr = freeScreenRect(), p0 = toW({ x: sr.x, y: sr.y }), p1 = toW({ x: sr.x + sr.w, y: sr.y + sr.h });
  const fit = B.fitInto(totalW, maxH, { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y }, 0.85);
  const k = fit.w / totalW;
  let x = fit.x;
  const add = items.map(it => {
    const o = { t: 'image', id: B.newId(), x: r3(x), y: r3(fit.y + (maxH - it.h) * k / 2), w: r3(it.w * k), h: r3(it.h * k), ref: it.ref };
    x += (it.w + gap) * k;
    return o;
  });
  commit(page().objs.concat(add));
  setTool('select');
  selection = new Set(add.map(o => o.id));
  syncSelect(); renderTop();
  toast('はりつけました。角の □ を ひっぱると 大きさを かえられます', 3200);
}
/* 新しい ページを つくって 1まいずつ おく */
function imagesToNewPages(items) {
  commitText();
  const bg = page().bg, at = cur + 1;
  items.forEach((it, i) => {
    const p = newPage(bg);
    const sr = freeScreenRect();
    const fit = B.fitInto(it.w, it.h, sr, 0.94);
    p.objs.push({ t: 'image', id: B.newId(), x: r3(fit.x), y: r3(fit.y), w: r3(fit.w), h: r3(fit.h), ref: it.ref });
    pages.splice(at + i, 0, p);
  });
  cur = at; selection.clear();
  renderAll(); syncUI(); save();
  toast(items.length + 'ページ ふやしました（' + (cur + 1) + ' / ' + pages.length + '）', 3000);
}

const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
async function handleFiles(list) {
  commitText();
  const files = Array.from(list || []);
  const imgs = files.filter(f => /^image\//.test(f.type)), pdfs = files.filter(isPdf);
  if (!imgs.length && !pdfs.length) { if (files.length) toast('画像（PNG・JPEG など）か PDF を えらんで ください'); return; }
  if (imgs.length) {
    busy('画像を 読みこんで います…');
    const items = [];
    for (const f of imgs) {
      try { items.push(await storeImage(f)); } catch (e) { toast('読みこめない 画像が ありました（' + (f.name || '画像') + '）', 3500); }
    }
    busy(null);
    placeImages(items);
  }
  for (const f of pdfs) await openPdf(f);
}

let pdfLib = null;
function closePdf(doc) {
  try { if (doc.loadingTask && doc.loadingTask.destroy) doc.loadingTask.destroy(); else if (doc.destroy) doc.destroy(); } catch (e) { /* なにも しない */ }
}
async function getPdfLib() {
  if (!pdfLib) {
    const base = new URL('lib/pdfjs/', location.href).href;
    const lib = await import(base + 'pdf.min.js');
    lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
    pdfLib = { lib: lib, base: base };
  }
  return pdfLib;
}
async function renderPdfPage(doc, n, longSide) {
  const pg = await doc.getPage(n);
  const vp1 = pg.getViewport({ scale: 1 });
  const k = Math.min(5, longSide / Math.max(vp1.width, vp1.height));
  const vp = pg.getViewport({ scale: k });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvas: c, canvasContext: cx, viewport: vp, background: '#ffffff' }).promise;
  pg.cleanup();
  return c;
}
async function pdfPagesToImages(doc, nums) {
  const items = [];
  for (let i = 0; i < nums.length; i++) {
    busy('PDF を 画像に して います… ' + (i + 1) + ' / ' + nums.length);
    const c = await renderPdfPage(doc, nums[i], PDF_PX);
    items.push(await storeImage(await canvasToBlob(c, 'image/webp', 0.92)));
    c.width = c.height = 0;
  }
  busy(null);
  return items;
}
async function openPdf(file) {
  let doc = null;
  try {
    busy('PDF を 読みこんで います…');
    const { lib, base } = await getPdfLib();
    const data = new Uint8Array(await file.arrayBuffer());
    doc = await lib.getDocument({
      data: data, cMapUrl: base + 'cmaps/', cMapPacked: true, wasmUrl: base + 'wasm/', iccUrl: base + 'iccs/',
      useSystemFonts: true, isEvalSupported: false, enableXfa: false
    }).promise;
    busy(null);
    if (doc.numPages === 1) {
      placeImages(await pdfPagesToImages(doc, [1]));
      closePdf(doc);
      return;
    }
    await pdfDialog(doc, file.name || 'PDF');
    closePdf(doc);
  } catch (e) {
    busy(null);
    if (doc) closePdf(doc);
    const pw = e && e.name === 'PasswordException';
    toast(pw ? 'パスワードの かかった PDF は 読みこめません' : 'PDF を 読みこめませんでした', 4000);
  }
}
/* 2ページ いじょうの PDF：ページを えらんで はる */
function pdfDialog(doc, name) {
  return new Promise(resolve => {
    const dlgP = $('#pdfdlg'), grid = $('#pdf-pages'), n = doc.numPages;
    const picked = new Set([1]);
    let closed = false;
    $('#pdf-name').textContent = name + '（' + n + 'ページ）';
    grid.innerHTML = '';
    const btns = [];
    for (let i = 1; i <= n; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pg'; b.dataset.n = i;
      const box = document.createElement('span'); box.className = 'thumb';
      const cap = document.createElement('span'); cap.className = 'cap'; cap.textContent = i + 'ページ';
      b.appendChild(box); b.appendChild(cap);
      b.addEventListener('click', () => { if (picked.has(i)) picked.delete(i); else picked.add(i); sync(); });
      grid.appendChild(b); btns.push(b);
    }
    const sync = () => {
      btns.forEach((b, i) => b.classList.toggle('on', picked.has(i + 1)));
      $('#pdf-count').textContent = picked.size + 'ページ えらんで います';
      $('#pdf-here').disabled = $('#pdf-new').disabled = !picked.size;
    };
    sync();
    /* 小さい 見本を じゅんに つくる */
    (async () => {
      for (let i = 1; i <= n && !closed; i++) {
        try {
          const c = await renderPdfPage(doc, i, 220);
          if (closed) break;
          btns[i - 1].firstChild.appendChild(c);
        } catch (e) { /* 見本が できなくても はれる */ }
      }
    })();
    const finish = async how => {
      closed = true;
      dlgP.close();
      const nums = Array.from(picked).sort((a, b) => a - b);
      if (how && nums.length) {
        try {
          const items = await pdfPagesToImages(doc, nums);
          if (how === 'here') placeImages(items); else imagesToNewPages(items);
        } catch (e) { busy(null); toast('PDF を 画像に できませんでした', 4000); }
      }
      resolve();
    };
    $('#pdf-all').onclick = () => { for (let i = 1; i <= n; i++) picked.add(i); sync(); };
    $('#pdf-none').onclick = () => { picked.clear(); sync(); };
    $('#pdf-here').onclick = () => finish('here');
    $('#pdf-new').onclick = () => finish('new');
    $('#pdf-cancel').onclick = () => finish(null);
    dlgP.oncancel = e => { e.preventDefault(); finish(null); };
    dlgP.showModal();
  });
}

/* ファイルを えらぶ・ドラッグして おとす・Ctrl+V */
$('#in-file').addEventListener('change', e => { const f = e.target.files; handleFiles(f).then(() => { e.target.value = ''; }); });
window.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
document.addEventListener('paste', e => {
  if (e.target === te || !e.clipboardData) return;
  let files = Array.from(e.clipboardData.files || []);
  if (!files.length) files = Array.from(e.clipboardData.items || []).filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(Boolean);
  if (!files.length) return;
  e.preventDefault();
  handleFiles(files);
});

/* ---------- ページ ---------- */
function goPage(i) {
  commitText();
  if (i < 0 || i >= pages.length || i === cur) return;
  cur = i; selection.clear();
  renderAll(); syncUI(); save();
}
function addPage() {
  commitText();
  pages.splice(cur + 1, 0, newPage(page().bg));
  cur++; selection.clear();
  renderAll(); syncUI(); save();
  toast('新しい ページを つくりました（' + (cur + 1) + ' / ' + pages.length + '）');
}
function deletePage() {
  commitText();
  const doIt = () => {
    if (pages.length === 1) { pages[0] = newPage(page().bg); }
    else { pages.splice(cur, 1); cur = Math.min(cur, pages.length - 1); }
    selection.clear();
    renderAll(); syncUI(); save();
  };
  if (!page().objs.length && pages.length > 1) { doIt(); return; }
  confirmDlg(pages.length === 1 ? 'この ページを 消して、まっさらに しますか？（もとに もどせません）' : 'この ページを 消しますか？（もとに もどせません）', doIt);
}

/* ---------- 画像で 保存（いま 見えて いる まま） ---------- */
function savePng() {
  commitText();
  const c = document.createElement('canvas');
  c.width = cInk.width; c.height = cInk.height;
  const x = c.getContext('2d');
  x.drawImage(cBg, 0, 0); x.drawImage(cImg, 0, 0); x.drawImage(cInk, 0, 0);
  c.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'freeboard-' + B.stamp(new Date()) + (pages.length > 1 ? '-p' + (cur + 1) : '') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('画像を 保存しました（ダウンロード フォルダー）');
  }, 'image/png');
}

/* ---------- おしらせ・かくにん ---------- */
let toastTimer = 0;
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
}
/* 読みこみ中の おしらせ（null で けす） */
function busy(msg) {
  const t = $('#toast');
  clearTimeout(toastTimer);
  if (msg) { t.textContent = msg; t.classList.add('show'); }
  else t.classList.remove('show');
}
const dlg = $('#dlg');
let dlgYes = null;
function confirmDlg(msg, yes) {
  $('#dlg-msg').textContent = msg;
  dlgYes = yes;
  if (dlg.showModal) dlg.showModal(); else if (window.confirm(msg)) yes();
}
$('#dlg-no').addEventListener('click', () => { dlgYes = null; dlg.close(); });
$('#dlg-yes').addEventListener('click', () => { const f = dlgYes; dlgYes = null; dlg.close(); if (f) f(); });

/* ---------- せっていの 画面 ---------- */
function buildPanel() {
  const tools = $('#tools');
  for (const t of TOOLS) {
    if (t.g) { const d = document.createElement('div'); d.className = 'gl'; d.textContent = t.g; tools.appendChild(d); continue; }
    const b = document.createElement('button');
    b.className = 'tool' + (t.wide ? ' wide' : '');
    b.dataset.tool = t.id;
    b.textContent = t.label;
    b.title = t.key ? t.label + '（キー ' + t.key + '）' : t.label;
    b.addEventListener('click', () => setTool(t.id));
    tools.appendChild(b);
  }
  const sw = $('#swatches');
  for (const [c, name] of COLORS) {
    const b = document.createElement('button');
    b.className = 'sw'; b.dataset.color = c; b.style.background = c;
    b.title = name; b.setAttribute('aria-label', name);
    b.addEventListener('click', () => setColor(c));
    sw.appendChild(b);
  }
  $('#in-color').addEventListener('input', e => setColor(e.target.value));

  $('#in-width').addEventListener('input', e => {
    const g = WIDTH[widthGroup(S.tool)]; if (!g) return;
    S[g.key] = +e.target.value; syncWidth(); save(); queueTop();
  });
  $('#in-tsize').addEventListener('input', e => { S.textSize = +e.target.value; syncText(); styleEditor(); save(); });
  const fontSeg = $('#seg-font');
  for (const k of Object.keys(B.FONTS)) {
    const b = document.createElement('button');
    b.dataset.v = k; b.textContent = B.FONTS[k].label;
    b.style.fontFamily = B.FONTS[k].css;
    fontSeg.appendChild(b);
  }
  const tsz = $('#tsize-presets');
  for (const [v, l] of TSIZE_PRESETS) {
    const b = document.createElement('button'); b.dataset.v = v; b.textContent = l; tsz.appendChild(b);
  }
  segClick('#tsize-presets', v => { S.textSize = +v; syncText(); styleEditor(); save(); });
  segClick('#seg-font', v => { S.font = v; syncText(); styleEditor(); save(); });
  segClick('#width-presets', v => { const g = WIDTH[widthGroup(S.tool)]; if (g) { S[g.key] = +v; syncWidth(); save(); } });
  segClick('#seg-fill', v => { S.shapeFill = v; syncUI(); save(); });
  segClick('#seg-dash', v => { S.dash = v === '1'; syncUI(); save(); });

  /* 背景 */
  const setBg = (patch) => {
    const bg = page().bg, wasDark = B.isDarkBg(bg);
    page().bg = B.sanitizeBg(Object.assign({}, bg, patch));
    const dark = B.isDarkBg(page().bg);
    /* 地の 色を くろ ⇄ しろ に かえたら、黒・白の ペンも いれかえる */
    if (dark !== wasDark) {
      if (dark && S.color === '#222222') S.color = '#ffffff';
      else if (!dark && S.color === '#ffffff') S.color = '#222222';
    }
    renderBg(); renderTop(); syncUI(); save();
  };
  segClick('#seg-bgkind', v => setBg({ kind: v }));
  segClick('#seg-bgcolor', v => setBg({ color: v }));
  segClick('#seg-linecolor', v => setBg({ lineColor: v }));
  segClick('#seg-strength', v => setBg({ strength: +v }));
  $('#in-bgsize').addEventListener('input', e => setBg({ size: +e.target.value }));
  $('#b-bgsize-minus').addEventListener('click', () => setBg({ size: page().bg.size - 2 }));
  $('#b-bgsize-plus').addEventListener('click', () => setBg({ size: page().bg.size + 2 }));
  $('#in-sub').addEventListener('change', e => setBg({ sub: e.target.checked }));
  $('#in-bold5').addEventListener('change', e => setBg({ bold5: e.target.checked }));
  $('#in-snap').addEventListener('change', e => { S.snap = e.target.checked; save(); });

  /* ボタン */
  $('#b-undo').addEventListener('click', undo);
  $('#b-redo').addEventListener('click', redo);
  $('#m-undo').addEventListener('click', undo);
  $('#b-close').addEventListener('click', () => setOpen(false));
  $('#m-open').addEventListener('click', () => setOpen(true));
  $$('[data-mtool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.mtool)));
  $('#b-side').addEventListener('click', () => { S.side = S.side === 'left' ? 'right' : 'left'; syncPanel(); syncZoom(); save(); });
  $('#b-full').addEventListener('click', toggleFull);
  $('#b-clear').addEventListener('click', () => {
    commitText();
    if (!page().objs.length) return;
    selection.clear();
    commit([]);
    toast('ぜんぶ 消しました（「もどす」で もとに もどせます）', 3000);
  });
  $('#b-png').addEventListener('click', savePng);
  $('#b-prev').addEventListener('click', () => goPage(cur - 1));
  $('#b-next').addEventListener('click', () => goPage(cur + 1));
  $('#b-addpage').addEventListener('click', addPage);
  $('#b-delpage').addEventListener('click', deletePage);
  $('#b-sel-del').addEventListener('click', deleteSelection);
  $('#b-sel-dup').addEventListener('click', duplicateSelection);
  $('#b-sel-front').addEventListener('click', () => reorderSelection(true));
  $('#b-sel-back').addEventListener('click', () => reorderSelection(false));
  $('#b-insert').addEventListener('click', () => $('#in-file').click());
  $('#b-zoomin').addEventListener('click', () => zoomBy(1.25));
  $('#b-zoomout').addEventListener('click', () => zoomBy(0.8));
  $('#b-zoomreset').addEventListener('click', resetView);
  $('#zb-reset').addEventListener('click', resetView);

  /* せっていの ボタンを おしても 文字の 入力を おわらせない（色や 大きさを かえながら 書ける） */
  $('#panel').addEventListener('pointerdown', e => {
    if (edit && e.target.closest('button,.sw') && !e.target.closest('#b-undo,#b-redo')) e.preventDefault();
  });
}
function segClick(sel, fn) {
  $(sel).addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (b) fn(b.dataset.v);
  });
}
function setSeg(sel, v) {
  $$(sel + ' button[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
}

function setTool(t) {
  if (TOOL_IDS.indexOf(t) < 0) return;
  if (t !== 'text') commitText();
  S.tool = t;
  if (t !== 'select') selection.clear();
  syncUI(); renderTop(); updateCursor(hover); save();
}
function setColor(c) {
  S.color = c.toLowerCase();
  if (S.tool === 'select' && selection.size) recolorSelection(S.color);
  if (edit) styleEditor();
  syncUI(); save();
}
function setOpen(open) {
  S.open = open;
  syncPanel(); save();
}
function syncPanel() {
  const p = $('#panel'), m = $('#mini');
  p.classList.toggle('right', S.side === 'right');
  p.classList.toggle('hide', !S.open);
  p.setAttribute('aria-hidden', String(!S.open));
  p.inert = !S.open;
  m.hidden = S.open;
  m.classList.toggle('right', S.side === 'right');
  $('#b-side').textContent = S.side === 'left' ? 'せっていを 右に' : 'せっていを 左に';
}
function syncWidth() {
  const gk = widthGroup(S.tool), g = WIDTH[gk];
  $('#sec-width').hidden = !g;
  if (!g) return;
  const v = S[g.key];
  $('#width-title').textContent = g.title;
  $('#out-width').textContent = v + 'px';
  const r = $('#in-width'); r.max = g.max; r.value = v;
  const wp = $('#width-presets');
  if (wp.dataset.group !== gk) {
    wp.innerHTML = '';
    for (const [pv, l] of g.presets) { const b = document.createElement('button'); b.dataset.v = pv; b.textContent = l; wp.appendChild(b); }
    wp.dataset.group = gk;
  }
  setSeg('#width-presets', v);
  const dot = $('#width-dot'), sz = Math.min(v, 44);
  dot.style.width = dot.style.height = sz + 'px';
  dot.style.background = gk === 'erase' ? 'transparent' : S.color;
  dot.style.border = gk === 'erase' ? '1.5px solid #555' : (S.color === '#ffffff' ? '1px solid #bbb' : '0');
  dot.style.opacity = gk === 'hl' ? 0.45 : 1;
}
function syncText() {
  $('#out-tsize').textContent = S.textSize + 'px';
  $('#in-tsize').value = S.textSize;
  setSeg('#tsize-presets', S.textSize);
  setSeg('#seg-font', S.font);
}
function syncUI() {
  $$('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  $$('[data-mtool]').forEach(b => b.classList.toggle('on', b.dataset.mtool === S.tool));
  $$('.sw').forEach(b => b.classList.toggle('on', b.dataset.color === S.color));
  $('#in-color').value = S.color;
  const noColor = S.tool === 'erase' || S.tool === 'objerase';
  $('#sec-color').hidden = noColor;
  syncWidth();
  $('#sec-shape').hidden = SHAPE_TOOLS.indexOf(S.tool) < 0;
  /* 直線・矢印に「中を ぬる」は ない */
  const lineLike = S.tool === 'line' || S.tool === 'arrow';
  $('#seg-fill').hidden = lineLike; $('#seg-fill').previousElementSibling.hidden = lineLike;
  setSeg('#seg-fill', S.shapeFill);
  setSeg('#seg-dash', S.dash ? '1' : '0');
  $('#sec-text').hidden = S.tool !== 'text';
  syncText();
  syncSelect();

  const bg = page().bg;
  setSeg('#seg-bgkind', bg.kind);
  setSeg('#seg-bgcolor', bg.color);
  setSeg('#seg-linecolor', bg.lineColor);
  setSeg('#seg-strength', bg.strength);
  $('#bg-more').hidden = bg.kind === 'plain';
  $('#bgsize-title').textContent = { grid: 'マスの 大きさ', hline: '線の あいだ', vline: '線の あいだ', dot: '点の あいだ' }[bg.kind] || '大きさ';
  $('#out-bgsize').textContent = bg.size + 'px（約 ' + (bg.size * 0.2646).toFixed(1).replace(/\.0$/, '') + 'mm）';
  $('#in-bgsize').value = bg.size;
  $('#lab-sub').hidden = bg.kind === 'dot';
  $('#sub-text').textContent = bg.kind === 'grid' ? 'マスの 中に 十字の 点線' : '線と 線の あいだに 点線';
  $('#in-sub').checked = bg.sub;
  $('#lab-bold5').hidden = bg.kind !== 'grid';
  $('#in-bold5').checked = bg.bold5;
  $('#lab-snap').hidden = !B.canSnap(bg);
  $('#in-snap').checked = S.snap;

  $('#out-page').textContent = (cur + 1) + ' / ' + pages.length;
  $('#b-prev').disabled = cur === 0;
  $('#b-next').disabled = cur === pages.length - 1;
  syncUndo();
  syncPanel();
  syncZoom();
}

/* ---------- 全画面 ---------- */
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => toast('全画面に できませんでした'));
}
document.addEventListener('fullscreenchange', () => {
  $('#b-full').textContent = document.fullscreenElement ? '全画面を やめる' : '全画面';
});

/* ---------- キーボード ---------- */
const KEY_TOOL = {};
for (const t of TOOLS) if (t.key) KEY_TOOL[t.key.toLowerCase()] = t.id;
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
  if (dlg.open || $('#pdfdlg').open) return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  /* Ctrl＋＋／－／0 は ブラウザでは なく ボードの 拡大 */
  if (mod && (k === '+' || k === '=' || k === ';')) { e.preventDefault(); zoomBy(1.25); return; }
  if (mod && (k === '-' || k === '_')) { e.preventDefault(); zoomBy(0.8); return; }
  if (mod && k === '0') { e.preventDefault(); resetView(); return; }
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && k === 's') { e.preventDefault(); savePng(); return; }
  if (mod && k === 'o') { e.preventDefault(); $('#in-file').click(); return; }
  if (mod || e.altKey) return;
  if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; updateCursor(hover); } return; }
  if ((k === 'delete' || k === 'backspace') && selection.size) { e.preventDefault(); deleteSelection(); return; }
  if (k === 'escape') { if (selection.size) { selection.clear(); syncSelect(); renderTop(); } return; }
  if (k === 'pageup') { e.preventDefault(); goPage(cur - 1); return; }
  if (k === 'pagedown') { e.preventDefault(); goPage(cur + 1); return; }
  if (k.indexOf('arrow') === 0 && selection.size && tag !== 'INPUT') {
    e.preventDefault();
    const n = e.shiftKey ? 10 : 1;
    nudgeSelection(k === 'arrowleft' ? -n : k === 'arrowright' ? n : 0, k === 'arrowup' ? -n : k === 'arrowdown' ? n : 0);
    return;
  }
  if (k === 's') { setOpen(!S.open); return; }
  if (k === 'f') { toggleFull(); return; }
  if (KEY_TOOL[k]) setTool(KEY_TOOL[k]);
});
document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; updateCursor(hover); } });
window.addEventListener('blur', () => { spaceDown = false; });

/* ---------- はじめる ---------- */
load();
buildPanel();
syncUI();
resize();
updateCursor(null);
setTimeout(cleanImages, 3000);
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); styleEditor(); }, 60); });
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
/* 文字の 書体が とどいたら かきなおす */
if (document.fonts) {
  for (const k of Object.keys(B.FONTS)) document.fonts.load(fontCss(32, k), 'あ').catch(() => {});
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => renderInk());
  document.fonts.ready.then(() => renderInk());
}

/* tests などから さわれる ように */
window.FreeBoard = { S: S, pages: () => pages, cur: () => cur, view: () => view(), commit: commit, undo: undo, redo: redo, setTool: setTool, handleFiles: handleFiles };
})();
