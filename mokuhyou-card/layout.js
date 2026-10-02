'use strict';
/* =========================================================
   こうもく（セクション）と ならべかた
   セクション： { t: しゅるい, lab: ラベル, n: 線の 数, half: よこに ならべる, ... }
   ========================================================= */

// 書く 線（下の はしまで）
function fillLines(x1, x2, y0, y1, o = {}) {
  const gap = LG();
  let s = '', last = null;
  for (let y = y0 + gap * 0.8; y <= y1 - 2.5; y += gap) { s += dotL(x1, x2, y); last = y; }
  if (o.end && last !== null) s += R(x2, last - 1, o.end, { size: G === 'low' ? 4 : 3.4, font: F_T, anchor: 'end' });
  return s;
}
function hintText(x, y, src) { return R(x, y, src, { size: 2.7, rsize: 1.2 }); }

const SEC = {
  lines: {
    min: s => 13 + (s.n || 2) * LG(),
    wt: s => s.n || 2,
    fill(s, x, y, w, b) {
      let t = '', y0 = y;
      if (s.hint) { t += hintText(x + 5, y + 3.6, s.hint); y0 += 3; }
      t += fillLines(x + 5, x + w - 5 - (s.end ? rtw(s.end, 4, F_T) + 2 : 0), y0, b, { end: s.end });
      if (s.end) t = t.replace(/(<text [^>]*>)/, '$1');
      return { d: '', t };
    },
  },
  num: {
    min: s => 13 + (s.n || 3) * LG(),
    wt: s => s.n || 3,
    fill(s, x, y, w, b) {
      let d = '', t = '', i = 0;
      const gap = LG(), r = G === 'low' ? 2.8 : 2.3;
      for (let yy = y + gap * 0.8; yy <= b - 2.5; yy += gap) {
        if (i >= (s.n || 3) + 2) { t += dotL(x + 7 + r + 2.5, x + w - 5, yy); continue; }
        i++;
        if (s.medal && i <= 3) d += P(`M${x + 5.4},${yy - 1} l-1.6,4.4 l2,-0.8 l0.8,1.8 l1.2,-4.6 Z M${x + 8.6},${yy - 1} l1.6,4.4 l-2,-0.8 l-0.8,1.8 l-1.2,-4.6 Z`, { w: 0.35 });
        d += C(x + 7, yy - r * 0.9, r, { w: 0.55 });
        t += T(x + 7, yy - r * 0.9 + r * 0.45, String(i), { size: r * 1.25, anchor: 'middle', font: F_T });
        t += dotL(x + 7 + r + 2.5, x + w - 5, yy);
      }
      return { d, t };
    },
  },
  stars: {
    min: s => 22 + (s.n || 0) * LG(),
    wt: s => 0.4 + (s.n || 0),
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const lb = s.slab || (G === 'low' ? 'できた ど' : '{達成度|たっせいど}');
      t += R(x + 5, y + 6.5, lb, { size: 3.4 });
      const sx = x + 8 + rtw(lb, 3.4);
      for (let i = 0; i < 5; i++) d += star(sx + 3 + i * 9, y + 5, 3.9, { w: 0.6 });
      if (s.n) t += fillLines(x + 5, x + w - 5, y + 7, b);
      return { d, t };
    },
  },
  chips: {
    min: s => 18 + Math.ceil((s.list.length + 1) / 4) * 10,
    wt: () => 0.2,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const cols = w > 120 ? 4 : w > 80 ? 3 : 2;
      const cwid = (w - 10 - (cols - 1) * 3) / cols;
      const items = [...s.list, ''];
      items.forEach((e, i) => {
        const cx = x + 5 + (i % cols) * (cwid + 3), cy = y + 2 + Math.floor(i / cols) * 10;
        d += RR(cx, cy, cwid, 7.4, 3.7, { w: 0.6 });
        if (e) t += R(cx + cwid / 2, cy + 5.2, e, { size: Math.min(3.3, (cwid - 3) / (plain(e).length * 0.95)), anchor: 'middle', rsize: 1.2 });
        else t += dotL(cx + 4, cx + cwid - 4, cy + 5.4);
      });
      const hs = G === 'low' ? '○で かこもう' : '{当|あ}てはまる ものを ○で {囲|かこ}もう';
      t += hintText(x + w - 4 - rtw(hs, 2.7), b - 2.2, hs);
      return { d, t };
    },
  },
  fill: {
    min: () => 22,
    wt: () => 0,
    fill(s, x, y, w, b) {
      let t = '', cx = x + 6;
      const yy = y + (b - y) / 2 + 2, sz = G === 'low' ? 4.2 : 3.8;
      for (const seg of s.segs) {
        if (seg === '') { t += L(cx, yy + 1.2, cx + (s.blank || 16), yy + 1.2, 0.4); cx += (s.blank || 16) + 1.5; }
        else { t += R(cx, yy, seg, { size: sz }); cx += rtw(seg, sz) + 2; }
      }
      return { d: '', t };
    },
  },
  months: {
    min: () => 40,
    wt: () => 0.3,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const k = s.list.length, cw = (w - 10) / k, mid = y + (b - y) / 2;
      let path = '';
      s.list.forEach((m, i) => {
        const cx = x + 5 + cw * (i + 0.5);
        path += (i ? ' L' : 'M') + n(cx) + ',' + n(mid - 2);
        t += R(cx, mid - 7, m, { size: 3.6, anchor: 'middle', font: F_T });
      });
      d += P(path, { fill: 'none', w: 0.6, dash: '1.6 1.4' });
      s.list.forEach((m, i) => {
        const cx = x + 5 + cw * (i + 0.5);
        d += C(cx, mid - 2, 1.4, { fill: '#000', w: 0 });
        d += C(cx, mid + 7, 4.2, { w: 0.6 });
      });
      t += hintText(x + 5, b - 2, G === 'low' ? 'おわったら ○に ◎・○・△ を かこう' : 'ふり{返|かえ}って ○に ◎・○・△ を {書|か}こう');
      return { d, t };
    },
  },
  meter: {
    min: s => 14 + s.list.length * 8.6,
    wt: () => 0.2,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const k = s.cells || 10, lx = x + 5, cx0 = x + 30, cwid = (w - 30 - 14) / k;
      s.list.forEach((lb, i) => {
        const yy = y + 5 + i * 8.6;
        if (lb) t += R(lx, yy + 1.3, lb, { size: 3.3 });
        else d += RR(lx - 1, yy - 3.2, 23, 6, 3, { w: 0.4, dash: '0.8 0.8' });
        for (let j = 0; j < k; j++) d += RR(cx0 + j * cwid, yy - 3, cwid - 1.2, 5.6, 1, { w: 0.45 });
        t += T(x + w - 7.5, yy + 1.3, 'MAX', { size: 2.6, font: F_T, anchor: 'middle' });
      });
      return { d, t };
    },
  },
  letter: {
    min: s => 15 + (s.n || 3) * LG(),
    wt: s => s.n || 3,
    fill(s, x, y, w, b) {
      let t = R(x + 5, y + 5, s.to || '', { size: 3.4 });
      t += fillLines(x + 5, x + w - 5, y + 3, b - 6);
      t += R(x + w - 5, b - 2.5, s.from || 'より', { size: 3.4, anchor: 'end' });
      return { d: '', t };
    },
  },
  // 係の こうもく
  members: { min: () => kMin('member'), wt: () => 0, fill: (s, x, y, w, b) => K_FILL.member(x, y, w, b) },
  toban: { min: () => kMin('toban'), wt: () => 1.2, fill: (s, x, y, w, b) => K_FILL.toban(x, y, w, b) },
  mark: { min: () => kMin('mark'), wt: () => 1, fill: (s, x, y, w, b) => K_FILL.mark(x, y, w, b) },
};

/* ---------- 1つの はこ ---------- */
function secBox(th, s, x, y, w, h) {
  if (s.t === 'draw') return drawBox(th, s, x, y, w, h);
  if (s.t === 'hero') return { d: heroAt(s.key, x + 2, y + 2, w - 4, h - 4), t: '' };
  const box = BOX[s.box || th.box](x, y, w, h, s.lab);
  const f = SEC[s.t].fill(s, box.x ?? x, box.top, box.w ?? w, y + h);
  return { d: box.d + f.d, t: box.t + f.t };
}
function drawBox(th, s, x, y, w, h) {
  const kind = s.pic || th.pic || 'plain';
  if (s.boxed) {
    const box = BOX[th.box](x, y, w, h, s.lab);
    const k2 = ['polaroid', 'photo', 'post', 'tv', 'porthole', 'round', 'egg', 'arch', 'window'].includes(kind) ? 'plain' : kind;
    return { d: box.d + PIC[k2](x + 4, box.top + 1, w - 8, y + h - box.top - 5), t: box.t };
  }
  let d = PIC[kind](x, y, w, h);
  let t = '';
  const hint = s.lab || (G === 'low' ? 'じぶんの えを かこう' : '{自分|じぶん}の {絵|え}を かこう');
  // ヒントは わくの 下 か 上 に 小さく
  if (kind === 'polaroid' || kind === 'photo' || kind === 'post') t += hintText(x + 5, y + h - 2.6 - (kind === 'post' ? 1 : 0), kind === 'post' ? '' : hint);
  else t += T(x + w / 2, y + (kind === 'tv' ? 13 : kind === 'window' || kind === 'arch' ? Math.min(w / 2, 14) + 2 : 7), plain(hint), { size: 2.6, anchor: 'middle' });
  if (s.face) d += faceCircle(x + w / 2, y + h * 0.45, Math.min(w, h) * 0.22);
  return { d, t };
}
const secMin = s => s.t === 'draw' ? (s.min || 46) : s.t === 'hero' ? (s.min || 30) : SEC[s.t].min(s);
const secWt = s => s.t === 'draw' ? (s.wt ?? 3) : s.t === 'hero' ? 0.5 : SEC[s.t].wt(s);

/* ---------- ブロック（よこ 1れつ） ---------- */
function rowBlock(secs, ratio) {
  return {
    min: Math.max(...secs.map(secMin)) + (secs.some(s => s.t !== 'draw' && s.t !== 'hero') ? 0 : 0),
    wt: Math.max(...secs.map(secWt)),
    render(th, X, W, y, h) {
      let d = '', t = '';
      const GAPX = 6;
      const parts = secs.length === 1 ? [[X, W]] : [[X, W * ratio - GAPX / 2], [X + W * ratio + GAPX / 2, W * (1 - ratio) - GAPX / 2]];
      secs.forEach((s, j) => { const r = secBox(th, s, parts[j][0], y, parts[j][1], h); d += r.d; t += r.t; });
      return { d, t };
    },
  };
}
// 縦に つむ（列の 中）
function columnRender(th, secs, x, w, y, h, gap) {
  const mins = secs.map(secMin), wts = secs.map(secWt);
  const room = h - gap * (secs.length - 1), msum = mins.reduce((a, b) => a + b, 0);
  const extra = Math.max(0, room - msum), shrink = msum > room ? room / msum : 1;
  const ws = wts.reduce((a, b) => a + b, 0) || 1;
  let d = '', t = '', yy = y;
  secs.forEach((s, i) => {
    const hh = mins[i] * shrink + extra * wts[i] / ws;
    const r = secBox(th, s, x, yy, w, hh); d += r.d; t += r.t;
    yy += hh + gap;
  });
  return { d, t };
}
function colBlock(left, right, ratio, gap) {
  const need = list => list.reduce((a, s) => a + secMin(s), 0) + gap * Math.max(0, list.length - 1);
  return {
    min: Math.max(need(left), need(right)),
    wt: Math.max(left.reduce((a, s) => a + secWt(s), 0), right.reduce((a, s) => a + secWt(s), 0)),
    render(th, X, W, y, h) {
      const lw2 = W * ratio - 3, rx = X + W * ratio + 3, rw = W * (1 - ratio) - 3;
      const a = columnRender(th, left, X, lw2, y, h, gap), b = columnRender(th, right, rx, rw, y, h, gap);
      return { d: a.d + b.d, t: a.t + b.t };
    },
  };
}
function aroundBlock(left, right, heroKey, gap) {
  const need = list => list.reduce((a, s) => a + secMin(s), 0) + gap * Math.max(0, list.length - 1);
  return {
    min: Math.max(need(left), need(right), 60),
    wt: left.reduce((a, s) => a + secWt(s), 0) + right.reduce((a, s) => a + secWt(s), 0),
    render(th, X, W, y, h) {
      const mid = 46, cw = (W - mid - 8) / 2;
      const a = columnRender(th, left, X, cw, y, h, gap), b = columnRender(th, right, X + W - cw, cw, y, h, gap);
      const cx = X + W / 2, cy = y + h / 2;
      let d = C(cx, cy, mid / 2, { w: 0.9 }) + C(cx, cy, mid / 2 - 2.2, { w: 0.35, fill: 'none', dash: '1 1' });
      d += heroAt(heroKey, cx - mid / 2 + 7, cy - mid / 2 + 7, mid - 14, mid - 14);
      d += sparkle(cx - 12, y + 6, 2.4) + sparkle(cx + 12, y + h - 6, 2.4) + star(cx + 10, y + 10, 2, { w: 0.5 }) + star(cx - 10, y + h - 10, 2, { w: 0.5 });
      return { d: a.d + b.d + d, t: a.t + b.t };
    },
  };
}
function heroBand(key, hmin = 44) {
  return {
    min: hmin, wt: 1.6,
    render(th, X, W, y, h) {
      let d = heroAt(key, X + W / 2 - h * 0.6, y, h * 1.2, h);
      d += sparkle(X + W / 2 - h * 0.9, y + h * 0.3, 3) + sparkle(X + W / 2 + h * 0.9, y + h * 0.6, 2.6);
      d += star(X + W / 2 - h * 0.8, y + h * 0.8, 2.2, { w: 0.5 }) + star(X + W / 2 + h * 0.85, y + h * 0.2, 2.2, { w: 0.5 });
      return { d, t: '' };
    },
  };
}

/* ---------- ならべる ---------- */
// half の セクションを となり どうし ペアに
function pairRows(secs) {
  const blocks = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (s.half && secs[i + 1] && secs[i + 1].half) { blocks.push(rowBlock([s, secs[i + 1]], s.ratio || 0.5)); i++; }
    else blocks.push(rowBlock([s], 0.5));
  }
  return blocks;
}

function layoutBlocks(ds, secs) {
  const L0 = ds.layout || 'stack';
  const GAP = 7;
  secs = secs.map(s => ({ ...s }));
  if (L0 === 'stack') {
    if (ds.hero) {
      const i = secs.findIndex(s => s.t === 'lines' && !s.half);
      if (i >= 0) { secs[i].half = true; secs[i].ratio = 0.7; secs.splice(i + 1, 0, { t: 'hero', key: ds.hero, half: true }); }
    }
    return pairRows(secs);
  }
  if (L0 === 'hero') return [heroBand(ds.hero, ds.heroH || 40), ...pairRows(secs)];
  if (L0 === 'side') {
    const di = secs.findIndex(s => s.t === 'draw');
    const left = di >= 0 ? [secs.splice(di, 1)[0]] : [{ t: 'hero', key: ds.hero, min: 40 }];
    const k = ds.sideN || 3;
    const right = [];
    while (right.length < k && secs.length) { const s = secs.shift(); right.push({ ...s, half: false }); }
    if (ds.hero && di >= 0 && ds.sideHero) left.push({ t: 'hero', key: ds.hero, min: 24 });
    const blocks = [colBlock(left, right, ds.sideRatio || 0.42, GAP)];
    if (ds.flip) { const b = blocks[0], r0 = b.render; b.render = (th, X, W, y, h) => { void r0; return colBlock(right, left, 1 - (ds.sideRatio || 0.42), GAP).render(th, X, W, y, h); }; }
    return [...blocks, ...pairRows(secs)];
  }
  if (L0 === 'grid') {
    const top = [], rest = [];
    secs.forEach(s => (s.t === 'draw' || s.full ? top : rest).push({ ...s, half: false }));
    if (ds.hero) rest.push({ t: 'hero', key: ds.hero, min: 30 });
    const left = rest.filter((_, i) => i % 2 === 0), right = rest.filter((_, i) => i % 2 === 1);
    return [...top.map(s => rowBlock([s], 0.5)), colBlock(left, right, 0.5, GAP)];
  }
  if (L0 === 'around') {
    const four = secs.splice(0, 4).map(s => ({ ...s, half: false }));
    return [aroundBlock(four.slice(0, 2), four.slice(2), ds.hero || 'notes', GAP), ...pairRows(secs)];
  }
  return pairRows(secs);
}

function renderGeneric(ds) {
  const cat = CATS[ds.cat];
  const th = THEMES[ds.theme];
  TITLE = { src: ds.title || cat.title[G], en: cat.en, kakari: !!cat.kakari };
  REPORT_NO = 0;
  CHAT_N = 0;
  LBL = G === 'low' ? 4.5 : 4;
  let d = th.frame ? th.frame() : frameStd(), t = '';
  const h = th.header();
  d += h.d; t += h.t;
  let top = h.top;
  const [X, W] = th.cx || [16, 178];
  if (!cat.kakari && !cat.noName) { t += nameRow(X + 2, top + 1, W - 4); top += 9; }
  const secs = cat.kakari ? kakariSections() : (ds.secs || cat.sec[G]);
  if (!secs.length) { t += T(105, 160, 'のせたい こうもくに チェックを いれてね', { size: 5, anchor: 'middle' }); return wrap(d, t); }
  const bottom = th.bottom || 284;
  const GAP = 7.5;
  const blocks = layoutBlocks(ds, secs);
  const avail = bottom - top - GAP * (blocks.length - 1) - 3;
  const mins = blocks.map(b => b.min), wts = blocks.map(b => b.wt);
  const msum = mins.reduce((a, b) => a + b, 0);
  const extra = Math.max(0, avail - msum), shrink = msum > avail ? avail / msum : 1;
  const ws = wts.reduce((a, b) => a + b, 0) || 1;
  let y = top + 3;
  blocks.forEach((b, i) => {
    const hh = mins[i] * shrink + extra * wts[i] / ws;
    const r = b.render(th, X, W, y, hh);
    d += r.d; t += r.t;
    y += hh + GAP;
  });
  return wrap(d, t);
}

/* =========================================================
   しょうじょう（ひょうしょうじょう）
   ========================================================= */
const CERT = {
  dots() {
    let d = RR(10, 10, 190, 277, 0, { w: 1.4 }) + RR(15, 15, 180, 267, 0, { w: 0.5, fill: 'none' });
    for (let x = 19; x <= 191; x += 6) d += C(x, 12.5, 0.75, { w: 0.35 }) + C(x, 284.5, 0.75, { w: 0.35 });
    for (let y = 19; y <= 278; y += 6.05) d += C(12.5, y, 0.75, { w: 0.35 }) + C(197.5, y, 0.75, { w: 0.35 });
    for (const [x, y] of [[15, 15], [195, 15], [15, 282], [195, 282]]) d += C(x, y, 5, { w: 0.8 }) + star(x, y, 3.6, { w: 0.45 });
    return d;
  },
  stars() {
    let d = RR(10, 10, 190, 277, 6, { w: 1.2 }) + RR(16, 16, 178, 265, 4, { w: 0.5, fill: 'none' });
    for (let x = 22; x <= 188; x += 11) d += star(x, 13, 2.2, { w: 0.4 }) + star(x, 284, 2.2, { w: 0.4 });
    for (let y = 24; y <= 274; y += 11) d += star(13, y, 2.2, { w: 0.4 }) + star(197, y, 2.2, { w: 0.4 });
    return d;
  },
  flower() {
    let d = RR(12, 12, 186, 273, 10, { w: 1 });
    for (const [x, y] of [[20, 20], [190, 20], [20, 277], [190, 277]]) d += flowerSmall(x, y, 8);
    for (let x = 40; x <= 170; x += 26) d += flowerSmall(x, 12, 3.2) + flowerSmall(x, 285, 3.2);
    for (let y = 46; y <= 252; y += 26) d += flowerSmall(12, y, 3.2) + flowerSmall(198, y, 3.2);
    return d;
  },
  ribbon() {
    let d = RR(12, 12, 186, 273, 3, { w: 1 }) + RR(16, 16, 178, 265, 2, { w: 0.4, fill: 'none', dash: '1.2 1' });
    for (const [x, y, r] of [[19, 19, -45], [191, 19, 45], [19, 278, 45], [191, 278, -45]]) d += RR(x - 12, y - 3.5, 24, 7, 0, { w: 0.7, fill: 'HATCH', tf: `rotate(${r} ${x} ${y})` });
    return d;
  },
  animals() {
    let d = RR(12, 16, 186, 270, 8, { w: 1 }) + RR(16, 20, 178, 262, 6, { w: 0.4, fill: 'none' });
    for (let x = 30; x <= 180; x += 25) d += paw(x, 283, 1.1, (x % 3) * 10);
    d += cat(28, 18) + paw(184, 16, 1.4, 20);
    return d;
  },
  classic() {
    let d = RR(9, 9, 192, 279, 0, { w: 1.6 }) + RR(13, 13, 184, 271, 0, { w: 0.5, fill: 'none' }) + RR(16, 16, 178, 265, 0, { w: 0.3, fill: 'none' });
    for (const [x, y, sx, sy] of [[16, 16, 1, 1], [194, 16, -1, 1], [16, 281, 1, -1], [194, 281, -1, -1]]) {
      d += P(`M${x},${y + sy * 22} Q${x + sx * 4},${y + sy * 4} ${x + sx * 22},${y}`, { fill: 'none', w: 0.6 });
      d += spiral(x + sx * 9, y + sy * 9, 3.4);
    }
    return d;
  },
  wa() {
    let d = RR(9, 9, 192, 279, 0, { w: 1.4 }) + RR(14, 14, 182, 269, 0, { w: 0.4, fill: 'none' });
    d += seigaiha(14, 14, 182, 12, 4) + L(14, 26, 196, 26, 0.5);
    d += seigaiha(14, 271, 182, 12, 4) + L(14, 271, 196, 271, 0.5);
    d += ume(24, 40, 6) + ume(186, 40, 6);
    return d;
  },
  guilloche() {
    let d = RR(10, 10, 190, 277, 2, { w: 1 }) + RR(18, 18, 174, 261, 1, { w: 0.6, fill: 'none' });
    for (const ph of [0, Math.PI / 2, Math.PI]) {
      let p = '', q = '';
      for (let x = 14; x <= 196; x += 1.4) { p += (x === 14 ? 'M' : 'L') + n(x) + ',' + n(14 + 2.4 * Math.sin(x / 3 + ph)); q += (x === 14 ? 'M' : 'L') + n(x) + ',' + n(283 + 2.4 * Math.sin(x / 3 + ph)); }
      let a = '', b = '';
      for (let y = 18; y <= 279; y += 1.4) { a += (y === 18 ? 'M' : 'L') + n(14 + 2.4 * Math.sin(y / 3 + ph)) + ',' + n(y); b += (y === 18 ? 'M' : 'L') + n(196 + 2.4 * Math.sin(y / 3 + ph)) + ',' + n(y); }
      d += P(p, { fill: 'none', w: 0.25 }) + P(q, { fill: 'none', w: 0.25 }) + P(a, { fill: 'none', w: 0.25 }) + P(b, { fill: 'none', w: 0.25 });
    }
    return d;
  },
  modern() {
    let d = RR(10, 10, 190, 277, 0, { w: 0.5 });
    for (const [x, y, sx, sy] of [[10, 10, 1, 1], [200, 10, -1, 1], [10, 287, 1, -1], [200, 287, -1, -1]]) {
      d += P(`M${x},${y} H${x + sx * 46} L${x},${y + sy * 46} Z`, { w: 0.6, fill: 'HATCH' });
      d += P(`M${x + sx * 52},${y} L${x},${y + sy * 52}`, { fill: 'none', w: 0.6 });
    }
    return d;
  },
  crest() {
    let d = RR(10, 10, 190, 277, 3, { w: 1.2 }) + RR(15, 15, 180, 267, 2, { w: 0.4, fill: 'none' });
    for (const [x, y] of [[24, 24], [186, 24], [24, 273], [186, 273]]) {
      d += P(`M${x - 8},${y - 8} H${x + 8} V${y} Q${x + 8},${y + 7} ${x},${y + 10} Q${x - 8},${y + 7} ${x - 8},${y} Z`, { w: 0.8 });
      d += star(x, y, 4, { w: 0.5 });
    }
    return d;
  },
};

function renderCert(ds) {
  const low = G === 'low';
  let d = CERT[ds.frame](), t = '';
  const heroK = ds.hero || 'rosette';
  d += heroAt(heroK, 80, 22, 50, 46);
  if (ds.laurel !== false) d += laurel(105, 50, 34, 112, 200, 6) + laurel(105, 50, 34, 68, -20, 6);
  t += T(105, 98, low ? 'しょうじょう' : '表彰状', { size: low ? 17 : 19, font: F_T, hollow: true, anchor: 'middle', ls: low ? 0 : 3 });
  // 第〇学期 〜賞
  const sz = 6, A = '{第|だい}', B = low ? '{学期|がっき} がんばったで{賞|しょう}' : '{学期|がっき} {努力賞|どりょくしょう}', gap = 11;
  const tot = rtw(A, sz, F_T) + gap + rtw(B, sz, F_T);
  let x0 = 105 - tot / 2;
  t += R(x0, 116, A, { size: sz, font: F_T, rsize: 2.3 });
  x0 += rtw(A, sz, F_T);
  if (S.term) t += T(x0 + gap / 2, 116, S.term, { size: sz * 1.1, font: F_T, anchor: 'middle' });
  else t += L(x0 + 1, 117.5, x0 + gap - 1, 117.5, 0.5);
  t += R(x0 + gap, 116, B, { size: sz, font: F_T, rsize: 2.3 });
  t += L(46, 138, 150, 138, 0.5) + T(155, 137, low ? 'さん' : '様', { size: 6, font: F_T });
  if (low) {
    t += R(30, 156, 'あなたは この {学期|がっき}、', { size: 4.6 });
    t += wlines(30, 180, 170, 3, 12);
    t += T(30, 208, 'を とても がんばりました。', { size: 4.6 });
    t += T(30, 220, 'その がんばりを ここに たたえます。', { size: 4.6 });
  } else {
    t += R(30, 154, 'あなたは この{学期|がっき}、', { size: 4.2 });
    t += wlines(30, 180, 166, 4, 10);
    t += R(30, 208, 'に{粘|ねば}り{強|づよ}く{取|と}り{組|く}み、{立派|りっぱ}な{成果|せいか}を{上|あ}げました。', { size: 4.2 });
    t += R(30, 219, 'その{努力|どりょく}を{称|たた}え、ここに{表彰|ひょうしょう}します。', { size: 4.2 });
  }
  t += R(180, 236, '{年|ねん}　　　{月|がつ}　　　{日|にち}', { size: 4.2, anchor: 'end' });
  t += R(30, 248, low ? 'おうちの {人|ひと}・せんせいから ひとこと' : 'おうちの{人|ひと}・{先生|せんせい}から ひとこと', { size: 3.4 });
  d += RR(28, 251, 106, 22, 3, { w: 0.7 });
  t += dotL(33, 129, 261) + dotL(33, 129, 269.5);
  d += C(164, 259, 13, { fill: 'none', w: 0.6, dash: '1.4 1.2' });
  t += R(164, 257.5, low ? 'じぶんの' : '{自分|じぶん}の', { size: 2.8, anchor: 'middle' });
  t += T(164, 262.5, 'サイン', { size: 3.4, anchor: 'middle', font: F_T });
  return wrap(d, t);
}
