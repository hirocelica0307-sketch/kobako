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
/* 太さ：どうぐごとに べつに おぼえる */
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
const newPage = bg => ({ bg: B.sanitizeBg(bg), objs: [], undo: [], redo: [] });

/* ---------- canvas ---------- */
const cBg = $('#c-bg'), cInk = $('#c-ink'), cTop = $('#c-top');
const xBg = cBg.getContext('2d'), xInk = cInk.getContext('2d', { willReadFrequently: false }), xTop = cTop.getContext('2d');
let W = 0, H = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth; H = window.innerHeight;
  for (const c of [cBg, cInk, cTop]) {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  for (const x of [xBg, xInk, xTop]) x.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderBg(); renderInk(); renderTop();
}

/* ---------- 背景を かく ---------- */
function renderBg() {
  const bg = page().bg;
  xBg.save();
  xBg.fillStyle = (B.BG_COLORS[bg.color] || B.BG_COLORS.white).fill;
  xBg.fillRect(0, 0, W, H);
  const sh = B.bgShapes(bg, W, H);
  xBg.strokeStyle = xBg.fillStyle = B.bgLineColor(bg);
  xBg.globalAlpha = B.STRENGTH_ALPHA[bg.strength];
  for (const l of sh.lines) {
    xBg.beginPath();
    xBg.lineWidth = l.w;
    xBg.setLineDash(l.dash ? [4, 5] : []);
    /* 1px の 線を くっきり：ピクセルの まんなかに */
    const off = (Math.round(l.w * dpr) % 2) ? 0.5 / dpr : 0;
    if (l.x1 === l.x2) { xBg.moveTo(l.x1 + off, l.y1); xBg.lineTo(l.x2 + off, l.y2); }
    else { xBg.moveTo(l.x1, l.y1 + off); xBg.lineTo(l.x2, l.y2 + off); }
    xBg.stroke();
  }
  xBg.setLineDash([]);
  if (sh.dots.length) {
    xBg.globalAlpha = Math.min(1, B.STRENGTH_ALPHA[bg.strength] + 0.2);
    xBg.beginPath();
    for (const d of sh.dots) { xBg.moveTo(d.x + d.r, d.y); xBg.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
    xBg.fill();
  }
  xBg.restore();
  document.body.style.background = (B.BG_COLORS[bg.color] || B.BG_COLORS.white).fill;
}

/* ---------- もの を かく ---------- */
const imgCache = new Map(); /* src → { img, data } */
function fillImage(o) {
  let e = imgCache.get(o.src);
  if (!e) {
    const img = new Image();
    e = { img: img, ready: false };
    img.onload = () => { e.ready = true; renderInk(); };
    img.src = o.src;
    imgCache.set(o.src, e);
  }
  return e.ready ? e.img : null;
}
function fillAlphaAt(o, x, y) {
  const e = imgCache.get(o.src);
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
  if (pts.length === 1) { x.moveTo(pts[0][0], pts[0][1]); x.lineTo(pts[0][0] + 0.01, pts[0][1]); return; }
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
        x.lineWidth = Math.max(1, o.w * 0.5); x.stroke(); x.fill();
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
  }
  x.restore();
}

/* skip: かかない id、replace: id → かわりに かく もの */
function renderInk(skip, replace) {
  if (!pages.length) return;
  xInk.clearRect(0, 0, W, H);
  for (const o of page().objs) {
    if (skip && skip.has(o.id)) continue;
    drawObj(xInk, (replace && replace.get(o.id)) || o);
  }
}

/* ---------- いちばん上（かいて いる とちゅう・えらんだ わく・消しゴムの まる） ---------- */
let act = null;      /* いま ドラッグ中の そうさ */
let hover = null;    /* マウスの ある ところ */
let selection = new Set();
let topQueued = false;
function queueTop() {
  if (topQueued) return;
  topQueued = true;
  requestAnimationFrame(() => { topQueued = false; renderTop(); });
}
function renderTop() {
  xTop.clearRect(0, 0, W, H);
  if (act && act.obj && (act.kind === 'pen' || act.kind === 'shape')) drawObj(xTop, act.obj);
  /* えらんだ もの */
  if (selection.size) {
    const moved = act && act.kind === 'move' ? act : null;
    xTop.save();
    xTop.strokeStyle = '#1f6fd1'; xTop.lineWidth = 1.5; xTop.setLineDash([6, 4]);
    for (const o of page().objs) {
      if (!selection.has(o.id)) continue;
      const b = B.bbox(moved ? B.translate(o, moved.dx, moved.dy) : o);
      xTop.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
    }
    xTop.restore();
  }
  if (act && act.kind === 'marquee') {
    const r = B.normRect(act.x0, act.y0, act.x1, act.y1);
    xTop.save();
    xTop.fillStyle = 'rgba(31,111,209,.08)'; xTop.strokeStyle = '#1f6fd1'; xTop.lineWidth = 1; xTop.setLineDash([5, 4]);
    xTop.fillRect(r.x, r.y, r.w, r.h); xTop.strokeRect(r.x, r.y, r.w, r.h);
    xTop.restore();
  }
  /* 消しゴムの まる */
  if (hover && (S.tool === 'erase' || S.tool === 'objerase')) {
    const r = S.tool === 'erase' ? S.eraseW / 2 : OBJ_ERASE_TOL;
    const dark = B.isDarkBg(page().bg);
    xTop.save();
    xTop.beginPath(); xTop.arc(hover.x, hover.y, r, 0, Math.PI * 2);
    xTop.fillStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)'; xTop.fill();
    xTop.lineWidth = 1.5; xTop.strokeStyle = dark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.55)'; xTop.stroke();
    xTop.restore();
  }
}
const OBJ_ERASE_TOL = 10;

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
  renderInk(); renderTop(); syncUndo(); syncSelect(); save();
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
let saveTimer = 0, warnedQuota = false;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 500);
}
function saveNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(LS_SET, JSON.stringify(S)); } catch (e) { /* なにも しない */ }
  try {
    localStorage.setItem(LS_BOARD, JSON.stringify({ v: 1, cur: cur, pages: pages.map(p => ({ bg: p.bg, objs: p.objs })) }));
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
    const d = JSON.parse(localStorage.getItem(LS_BOARD) || 'null');
    if (d && Array.isArray(d.pages) && d.pages.length) {
      pages = d.pages.map(B.sanitizePage).map(p => Object.assign(p, { undo: [], redo: [] }));
      cur = B.clamp(Math.round(d.cur) || 0, 0, pages.length - 1);
    }
  } catch (e) { pages = []; }
  if (!pages.length) { pages = [newPage(B.DEFAULT_BG)]; cur = 0; }
}

/* ---------- ゆび・マウス ---------- */
function pt(e) {
  const r = cTop.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function snapIfOn(p) {
  const bg = page().bg;
  if (S.snap && B.canSnap(bg)) { const s = B.snapPoint(p.x, p.y, bg.size); return { x: s[0], y: s[1] }; }
  return p;
}
function topHit(p, tol) {
  const objs = page().objs;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.t === 'erase') continue;
    if (B.hitTest(o, p.x, p.y, tol) && (o.t !== 'fill' || fillAlphaAt(o, p.x, p.y))) return o;
  }
  return null;
}

let lastDown = { t: 0, x: 0, y: 0 };
cTop.addEventListener('pointerdown', e => {
  if (act) return;                                   /* 2本目の ゆび・てのひら は むし */
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  const p = pt(e);
  const dbl = e.timeStamp - lastDown.t < 400 && Math.hypot(p.x - lastDown.x, p.y - lastDown.y) < 8;
  lastDown = { t: e.timeStamp, x: p.x, y: p.y };

  if (edit) { commitText(); if (S.tool !== 'text') return; }
  hover = p;
  const t = S.tool;

  if (t === 'text') {
    const hit = topHit(p, 4);
    if (hit && hit.t === 'text') openEditor(hit.x, hit.y, hit);
    else openEditor(p.x, p.y - S.textSize * B.TEXT_LINE / 2, null);
    return;
  }
  if (t === 'fill') { doFill(p); return; }

  cTop.setPointerCapture(e.pointerId);
  if (t === 'pen' || t === 'hl') {
    act = { kind: 'pen', pid: e.pointerId, obj: { t: 'pen', id: B.newId(), pts: [[p.x, p.y]], c: S.color, w: t === 'hl' ? S.hlW : S.penW, hl: t === 'hl' } };
  } else if (t === 'erase') {
    act = { kind: 'erase', pid: e.pointerId, obj: { t: 'erase', id: B.newId(), pts: [[p.x, p.y]], w: S.eraseW } };
    eraseLive(act.obj.pts);
  } else if (t === 'objerase') {
    act = { kind: 'objerase', pid: e.pointerId, hidden: new Set(), last: p };
    objEraseAt(p, p);
  } else if (SHAPE_TOOLS.indexOf(t) >= 0) {
    const s = snapIfOn(p);
    act = { kind: 'shape', pid: e.pointerId, x0: s.x, y0: s.y, obj: null };
    updateShape(s, e.shiftKey);
  } else if (t === 'select') {
    const hit = topHit(p, 8);
    if (hit && dbl && hit.t === 'text') { cTop.releasePointerCapture(e.pointerId); openEditor(hit.x, hit.y, hit); return; }
    if (hit) {
      if (e.shiftKey) { if (selection.has(hit.id)) selection.delete(hit.id); else selection.add(hit.id); }
      else if (!selection.has(hit.id)) { selection.clear(); selection.add(hit.id); }
      act = { kind: 'move', pid: e.pointerId, x0: p.x, y0: p.y, dx: 0, dy: 0 };
    } else {
      if (!e.shiftKey) selection.clear();
      act = { kind: 'marquee', pid: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey };
    }
    syncSelect();
  }
  renderTop();
});

cTop.addEventListener('pointermove', e => {
  const p = pt(e);
  hover = p;
  if (!act || e.pointerId !== act.pid) { if (S.tool === 'erase' || S.tool === 'objerase') queueTop(); updateCursor(p); return; }
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs.map(pt) : [p];
  if (act.kind === 'pen') {
    const pts = act.obj.pts;
    for (const q of list) {
      const l = pts[pts.length - 1];
      if (Math.hypot(q.x - l[0], q.y - l[1]) >= 0.8) pts.push([q.x, q.y]);
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
    renderInk(null, rep);
  } else if (act.kind === 'marquee') {
    act.x1 = p.x; act.y1 = p.y;
  }
  queueTop();
});

function endPointer(e, cancel) {
  if (!act || e.pointerId !== act.pid) return;
  const a = act; act = null;
  const objs = page().objs;
  if (a.kind === 'pen') {
    const o = a.obj;
    o.pts = B.thinPoints(o.pts, 1.2).map(q => [B.round1(q[0]), B.round1(q[1])]);
    if (!cancel || o.pts.length > 2) commit(objs.concat([o]));
  } else if (a.kind === 'erase') {
    const o = a.obj;
    o.pts = B.thinPoints(o.pts, 1).map(q => [B.round1(q[0]), B.round1(q[1])]);
    const eb = B.bbox(o);
    /* なにも ない ところを こすった だけなら きろく しない */
    if (objs.some(x => x.t !== 'erase' && B.rectsOverlap(B.bbox(x), eb))) commit(objs.concat([o]));
    else renderInk();
  } else if (a.kind === 'objerase') {
    if (a.hidden.size) commit(objs.filter(o => !a.hidden.has(o.id)));
  } else if (a.kind === 'shape') {
    if (a.obj && !cancel && shapeSize(a.obj) >= 3) commit(objs.concat([a.obj]));
  } else if (a.kind === 'move') {
    if (a.dx || a.dy) commit(objs.map(o => selection.has(o.id) ? B.translate(o, a.dx, a.dy) : o));
    else renderInk();
  } else if (a.kind === 'marquee') {
    const r = B.normRect(a.x0, a.y0, a.x1, a.y1);
    if (r.w > 3 || r.h > 3) {
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

function updateCursor(p) {
  const t = S.tool;
  let c = 'cur-draw';
  if (t === 'text') c = 'cur-text';
  else if (t === 'erase') c = 'cur-none';
  else if (t === 'fill') c = 'cur-fill';
  else if (t === 'select') c = p && topHit(p, 8) ? 'cur-move' : 'cur-select';
  if (cTop.dataset.cur !== c) { cTop.className = c; cTop.dataset.cur = c; }
}

/* 消しゴム：かいて いる あいだは ink に じかに けす */
function eraseLive(pts) {
  xInk.save();
  xInk.globalCompositeOperation = 'destination-out';
  xInk.lineCap = 'round'; xInk.lineJoin = 'round'; xInk.lineWidth = S.eraseW; xInk.strokeStyle = '#000';
  xInk.beginPath();
  xInk.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) xInk.lineTo(pts[0][0] + 0.01, pts[0][1]);
  for (let i = 1; i < pts.length; i++) xInk.lineTo(pts[i][0], pts[i][1]);
  xInk.stroke();
  xInk.restore();
}
/* 線ごと 消す：a から b まで なぞった ところに ある もの を かくす */
function objEraseAt(a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  let changed = false;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    for (const o of page().objs) {
      if (o.t === 'erase' || act.hidden.has(o.id)) continue;
      if (B.hitTest(o, x, y, OBJ_ERASE_TOL) && (o.t !== 'fill' || fillAlphaAt(o, x, y))) { act.hidden.add(o.id); changed = true; }
    }
  }
  if (changed) renderInk(act.hidden);
}

/* 直線・図形 */
function updateShape(p, shift) {
  const t = S.tool, x0 = act.x0, y0 = act.y0;
  let x2 = p.x, y2 = p.y;
  const base = { id: act.obj ? act.obj.id : B.newId(), c: S.color, w: S.shapeW, dash: S.dash };
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

/* ---------- ぬりつぶし ---------- */
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function doFill(p) {
  renderInk();
  const Wd = cInk.width, Hd = cInk.height;
  let data;
  try { data = xInk.getImageData(0, 0, Wd, Hd).data; } catch (e) { return; }
  const sx = Math.floor(p.x * dpr), sy = Math.floor(p.y * dpr);
  const i0 = (sy * Wd + sx) * 4;
  if (sx < 0 || sy < 0 || sx >= Wd || sy >= Hd) return;
  const under = data[i0 + 3] <= 48;
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
  imgCache.set(src, { img: c, ready: true });
  const o = { t: 'fill', id: B.newId(), x: res.x / dpr, y: res.y / dpr, w: res.w / dpr, h: res.h / dpr, src: src, under: under };
  commit(page().objs.concat([o]));
}

/* ---------- 文字 ---------- */
const te = $('#texted');
let edit = null; /* { x, y, orig } */
function styleEditor() {
  if (!edit) return;
  const f = B.FONTS[S.font] || B.FONTS.gothic;
  te.style.font = fontCss(S.textSize, S.font);
  te.style.fontWeight = f.weight;
  te.style.lineHeight = B.TEXT_LINE;
  te.style.color = S.color;
  te.style.left = edit.x + 'px'; te.style.top = edit.y + 'px';
  sizeEditor();
}
function measureText(text, size, font) {
  xTop.save();
  xTop.font = fontCss(size, font);
  const lines = text.split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, xTop.measureText(l).width);
  xTop.restore();
  return { w: Math.ceil(w), h: Math.ceil(lines.length * size * B.TEXT_LINE) };
}
function sizeEditor() {
  const m = measureText(te.value || ' ', S.textSize, S.font);
  te.style.width = Math.max(S.textSize * 2, m.w + S.textSize) + 'px';
  te.style.height = Math.max(S.textSize * B.TEXT_LINE, m.h) + 'px';
}
function openEditor(x, y, orig) {
  commitText();
  if (orig) {
    S.textSize = orig.size; S.font = orig.font; S.color = orig.c;
    if (S.tool !== 'text') setTool('text');
    syncUI();
  }
  edit = { x: x, y: y, orig: orig };
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
  const m = measureText(text, S.textSize, S.font);
  const o = { t: 'text', id: e.orig ? e.orig.id : B.newId(), x: e.x, y: e.y, text: text, size: S.textSize, c: S.color, font: S.font, w: m.w, h: m.h };
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
  const add = [];
  for (const o of page().objs) if (selection.has(o.id)) add.push(B.duplicate(o, 24, 24));
  selection = new Set(add.map(o => o.id));
  commit(page().objs.concat(add));
}
function nudgeSelection(dx, dy) {
  if (!selection.size) return;
  commit(page().objs.map(o => selection.has(o.id) ? B.translate(o, dx, dy) : o));
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
function syncSelect() {
  const show = S.tool === 'select';
  $('#sec-select').hidden = !show;
  $('#out-selcount').textContent = selection.size ? selection.size + 'こ' : 'なし';
  $('#b-sel-del').disabled = !selection.size;
  $('#b-sel-dup').disabled = !selection.size;
}

/* ---------- ページ ---------- */
function goPage(i) {
  commitText();
  if (i < 0 || i >= pages.length || i === cur) return;
  cur = i; selection.clear();
  renderBg(); renderInk(); renderTop(); syncUI(); save();
}
function addPage() {
  commitText();
  pages.splice(cur + 1, 0, newPage(page().bg));
  cur++; selection.clear();
  renderBg(); renderInk(); renderTop(); syncUI(); save();
  toast('新しい ページを つくりました（' + (cur + 1) + ' / ' + pages.length + '）');
}
function deletePage() {
  commitText();
  const doIt = () => {
    if (pages.length === 1) { pages[0] = newPage(page().bg); }
    else { pages.splice(cur, 1); cur = Math.min(cur, pages.length - 1); }
    selection.clear();
    renderBg(); renderInk(); renderTop(); syncUI(); save();
  };
  if (!page().objs.length && pages.length > 1) { doIt(); return; }
  confirmDlg(pages.length === 1 ? 'この ページを 消して、まっさらに しますか？（もとに もどせません）' : 'この ページを 消しますか？（もとに もどせません）', doIt);
}

/* ---------- 画像で 保存 ---------- */
function savePng() {
  commitText();
  const c = document.createElement('canvas');
  c.width = cInk.width; c.height = cInk.height;
  const x = c.getContext('2d');
  x.drawImage(cBg, 0, 0); x.drawImage(cInk, 0, 0);
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
  $('#b-side').addEventListener('click', () => { S.side = S.side === 'left' ? 'right' : 'left'; syncPanel(); save(); });
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
  if (dlg.open) return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && k === 's') { e.preventDefault(); savePng(); return; }
  if (mod || e.altKey) return;
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

/* ---------- はじめる ---------- */
load();
buildPanel();
syncUI();
resize();
updateCursor(null);
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); styleEditor(); }, 60); });
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
/* 文字の 書体が とどいたら かきなおす */
if (document.fonts) {
  for (const k of Object.keys(B.FONTS)) document.fonts.load(fontCss(32, k), 'あ').catch(() => {});
  document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => renderInk());
  document.fonts.ready.then(() => renderInk());
}

/* tests.html などから さわれる ように */
window.FreeBoard = { S: S, pages: () => pages, cur: () => cur, commit: commit, undo: undo, redo: redo, setTool: setTool };
})();
