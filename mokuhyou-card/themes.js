'use strict';
/* =========================================================
   テーマ（わく・タイトル・はこの かたち・えの わく）
   header() は { d, t, top } を かえす（top ＝ なかみを はじめる y）
   ========================================================= */

// いま かいて いる カードの タイトル
let TITLE = { src: '', en: '', kakari: false };
let CLIPN = 0;
function clipRect(x, y, w, h, content) {
  const id = 'cp' + (++CLIPN);
  return `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath><g clip-path="url(#${id})">${content}</g>`;
}

// 係名の らん（線 ＋ 大きな「係」）
function kakariName(x1, x2, y, sz = 15) {
  let t = '';
  t += L(x1, y + 1.5, x2, y + 1.5, 0.6);
  if (S.kk.name) t += T((x1 + x2) / 2, y - 0.5, S.kk.name, { size: Math.min(10, sz * 0.7), font: F_H, weight: 600, anchor: 'middle' });
  t += R(x2 + 2, y + 1, '{係|かかり}', { size: sz, font: F_T, hollow: true, rsize: Math.max(1.8, sz * 0.18) });
  return t;
}
// タイトル（はばに あわせて 小さく する）。係カードの ときは 係名の らん
function drawTitle(cx, y, maxW, size, o = {}) {
  if (TITLE.kakari) {
    const kw = size * 1.1;
    const lw = Math.min(maxW - kw - 4, 110);
    const x1 = o.anchor === 'start' ? cx : cx - (lw + kw + 2) / 2;
    return kakariName(x1, x1 + lw, y, size);
  }
  let sz = size;
  const w = rtw(TITLE.src, sz, F_T);
  if (w > maxW) sz = sz * maxW / w;
  return R(cx, y, TITLE.src, { size: sz, font: F_T, hollow: !o.solid, anchor: o.anchor || 'middle', rsize: Math.max(1.7, sz * 0.24) });
}

/* ---------- 小さな え ---------- */
function paw(x, y, s = 1, rot = 0) {
  const tf = `rotate(${rot} ${n(x)} ${n(y)})`;
  let d = E(x, y + 1.2 * s, 2.2 * s, 1.8 * s, { w: 0.45, tf });
  for (const [dx, dy] of [[-2.4, -1.4], [-0.8, -2.8], [0.8, -2.8], [2.4, -1.4]]) d += E(x + dx * s, y + dy * s, 0.75 * s, 0.95 * s, { w: 0.4, tf });
  return d;
}
function cloudShape(cx, cy, w, h, o = {}) {
  // まるを ならべた くも
  const k = Math.max(3, Math.round(w / (h * 0.9)));
  let d = '';
  const rr = h * 0.55;
  for (let i = 0; i < k; i++) {
    const x = cx - w / 2 + rr + (w - 2 * rr) * i / (k - 1);
    const yy = cy - (i % 2 ? h * 0.12 : -h * 0.05);
    d += C(x, yy, rr * (i % 2 ? 1.05 : 0.9), { w: o.w || 0.7 });
  }
  d += RR(cx - w / 2 + rr * 0.6, cy - h * 0.1, w - rr * 1.2, h * 0.55, h * 0.25, { w: 0, fill: '#fff' });
  return d;
}
function flowerSmall(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    d += E(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a), r * 0.45, r * 0.3, { w: 0.45, tf: `rotate(${i * 60} ${n(cx + r * 0.62 * Math.cos(a))} ${n(cy + r * 0.62 * Math.sin(a))})` });
  }
  return d + C(cx, cy, r * 0.3, { w: 0.45 });
}
function tulip(x, y, h = 16) {
  let d = '';
  d += P(`M${x},${y} V${y - h + 6}`, { fill: 'none', w: 0.6 });
  d += P(`M${x},${y - 2} q-5,-2 -6,-8 q5,1 6,6`, { w: 0.5 });
  d += P(`M${x - 4},${y - h + 6} L${x - 4},${y - h} L${x - 2},${y - h + 3} L${x},${y - h - 1} L${x + 2},${y - h + 3} L${x + 4},${y - h} L${x + 4},${y - h + 6} Q${x},${y - h + 9} ${x - 4},${y - h + 6} Z`, { w: 0.6 });
  return d;
}
function balloon(x, y, r, sx, sy) {
  return P(`M${n(x)},${n(y + r * 1.15)} Q${n((x + sx) / 2 + 3)},${n((y + sy) / 2)} ${n(sx)},${n(sy)}`, { fill: 'none', w: 0.4 }) +
    E(x, y, r, r * 1.15, { w: 0.7 }) + P(`M${n(x - 1)},${n(y + r * 1.15)} L${n(x + 1)},${n(y + r * 1.15)} L${n(x)},${n(y + r * 1.15 + 1.6)} Z`, { w: 0.4 }) +
    P(`M${n(x - r * 0.5)},${n(y - r * 0.4)} q${n(r * 0.15)},${n(-r * 0.4)} ${n(r * 0.5)},${n(-r * 0.5)}`, { fill: 'none', w: 0.35 });
}
function tree(x, y, s = 1) {
  return RR(x - 1.2 * s, y - 6 * s, 2.4 * s, 6 * s, 0.4, { w: 0.5 }) +
    POLY([[x, y - 22 * s], [x - 7 * s, y - 10 * s], [x + 7 * s, y - 10 * s]], { w: 0.6 }) +
    POLY([[x, y - 17 * s], [x - 9 * s, y - 5 * s], [x + 9 * s, y - 5 * s]], { w: 0.6 });
}
function mushroom(x, y, s = 1) {
  return RR(x - 2 * s, y - 5 * s, 4 * s, 5 * s, 1.2, { w: 0.5 }) +
    P(`M${n(x - 6 * s)},${n(y - 5 * s)} Q${n(x - 6 * s)},${n(y - 12 * s)} ${n(x)},${n(y - 12 * s)} Q${n(x + 6 * s)},${n(y - 12 * s)} ${n(x + 6 * s)},${n(y - 5 * s)} Z`, { w: 0.6 }) +
    C(x - 2.5 * s, y - 8.5 * s, 1.1 * s, { w: 0.4 }) + C(x + 2.6 * s, y - 9 * s, 0.9 * s, { w: 0.4 });
}
function fish(x, y, s = 1, flip = false) {
  const tf = flip ? `translate(${n(2 * x)} 0) scale(-1 1)` : '';
  return P(`M${n(x - 5 * s)},${n(y)} Q${n(x)},${n(y - 4 * s)} ${n(x + 5 * s)},${n(y)} Q${n(x)},${n(y + 4 * s)} ${n(x - 5 * s)},${n(y)} Z M${n(x + 5 * s)},${n(y)} L${n(x + 8 * s)},${n(y - 2.5 * s)} L${n(x + 8 * s)},${n(y + 2.5 * s)} Z`, { w: 0.5, tf }) +
    C(flip ? x + 2.5 * s : x - 2.5 * s, y - 0.6 * s, 0.5 * s, { fill: '#000', w: 0 });
}
function butterfly(x, y, s = 1) {
  return E(x - 2.4 * s, y - 1.6 * s, 2.4 * s, 2 * s, { w: 0.45 }) + E(x + 2.4 * s, y - 1.6 * s, 2.4 * s, 2 * s, { w: 0.45 }) +
    E(x - 1.8 * s, y + 1.6 * s, 1.6 * s, 1.4 * s, { w: 0.45 }) + E(x + 1.8 * s, y + 1.6 * s, 1.6 * s, 1.4 * s, { w: 0.45 }) +
    E(x, y, 0.6 * s, 3 * s, { w: 0.45 }) + P(`M${n(x)},${n(y - 3 * s)} q-1,-2 -2,-2.6 M${n(x)},${n(y - 3 * s)} q1,-2 2,-2.6`, { fill: 'none', w: 0.35 });
}
function snowman(x, y, s = 1) {
  return C(x, y, 7 * s, { w: 0.7 }) + C(x, y - 10 * s, 5 * s, { w: 0.7 }) +
    RR(x - 4 * s, y - 18.5 * s, 8 * s, 4 * s, 0.6, { w: 0.6 }) + RR(x - 5.5 * s, y - 15 * s, 11 * s, 1.4 * s, 0.6, { w: 0.6 }) +
    C(x - 1.8 * s, y - 11 * s, 0.6 * s, { fill: '#000', w: 0 }) + C(x + 1.8 * s, y - 11 * s, 0.6 * s, { fill: '#000', w: 0 }) +
    P(`M${n(x)},${n(y - 9.6 * s)} l${n(3 * s)},${n(0.8 * s)} l${n(-3 * s)},${n(0.8 * s)} Z`, { w: 0.4 }) +
    L(x - 6.5 * s, y - 3 * s, x - 12 * s, y - 8 * s, 0.6) + L(x + 6.5 * s, y - 3 * s, x + 12 * s, y - 8 * s, 0.6) +
    C(x, y - 2 * s, 0.7 * s, { fill: '#000', w: 0 }) + C(x, y + 1.5 * s, 0.7 * s, { fill: '#000', w: 0 });
}
function pixelHeart(x, y, p = 1.1) {
  const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  let d = '';
  rows.forEach((r, i) => [...r].forEach((c, j) => { if (c === 'X') d += RR(x + j * p, y + i * p, p, p, 0, { w: 0.25 }); }));
  return d;
}
function barcode(x, y, w, h) {
  let d = '', cx = x;
  const ws = [0.5, 0.3, 0.8, 0.3, 0.4, 1, 0.3, 0.6, 0.3, 0.9, 0.4, 0.3, 0.7, 0.3, 0.5, 1, 0.3, 0.4, 0.8, 0.3, 0.6, 0.3, 0.9, 0.4];
  for (let i = 0; cx < x + w && i < 200; i++) {
    const bw = ws[i % ws.length];
    if (i % 2 === 0) d += `<rect x="${n(cx)}" y="${n(y)}" width="${n(bw)}" height="${n(h)}" fill="#000"/>`;
    cx += bw + 0.35;
  }
  return d;
}
function seigaiha(x, y, w, h, r = 5) {
  let d = '';
  for (let row = 0; row * r * 0.5 < h + r; row++) {
    const yy = y + row * r * 0.5;
    const off = row % 2 ? r : 0;
    for (let xx = x - r + off; xx < x + w + r; xx += 2 * r) {
      for (const k of [1, 0.66, 0.33]) d += P(`M${n(xx - r * k)},${n(yy)} A${n(r * k)},${n(r * k)} 0 0 1 ${n(xx + r * k)},${n(yy)}`, { fill: k === 1 ? '#fff' : 'none', w: 0.35 });
    }
  }
  return clipRect(x, y, w, h, d);
}
function sunIcon(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    d += L(cx + (r + 1.5) * Math.cos(a), cy + (r + 1.5) * Math.sin(a), cx + (r + 4) * Math.cos(a), cy + (r + 4) * Math.sin(a), 0.6);
  }
  return d + C(cx, cy, r, { w: 0.7 });
}

/* ---------- はこの かたち（ラベルの つけかた） ---------- */
let LBL = 4;   // ラベルの 文字の 大きさ（低学年は 大きめ）
function lab(x, y, src, o = {}) { return R(x, y, src, { size: o.size || LBL, font: F_T, rsize: 1.6, anchor: o.anchor, hollow: o.hollow }); }
const lw = (src, sz) => rtw(src, sz || LBL, F_T);
let REPORT_NO = 0;

const BOX = {
  tab(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 3, { w: 0.9 }) + RR(x + 4, y - 4.5, lw(l) + 10, 9, 3, { w: 0.8 }), t: lab(x + 9, y + 1.9, l), top: y + 7 };
  },
  bar(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 1.5, { w: 0.9 }) + RR(x, y, w, 9.5, 1.5, { w: 0.9 }) + RR(x + 3, y + 2.8, 4, 4, 0.5, { w: 0.5, fill: 'HATCH' }),
      t: lab(x + 10, y + 7, l), top: y + 10 };
  },
  tag(x, y, w, h, l) {
    const W = lw(l) + 12;
    return { d: RR(x, y, w, h, 4, { w: 0.9 }) + P(`M${x + 3},${y + 3} H${x + 3 + W} L${x + 8 + W},${y + 7.5} L${x + 3 + W},${y + 12} H${x + 3} Z`, { w: 0.75 }),
      t: lab(x + 8, y + 9.4, l), top: y + 13 };
  },
  star(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 5, { w: 0.9 }) + star(x + 7.5, y + 7, 3.8, { w: 0.6 }), t: lab(x + 13.5, y + 9, l), top: y + 12 };
  },
  tape(x, y, w, h, l) {
    let d = RR(x, y, w, h, 1, { w: 0.9 });
    d += RR(x - 3, y - 3, 14, 6, 0.5, { w: 0.4, fill: 'DOTS', tf: `rotate(-28 ${x + 4} ${y})` });
    d += RR(x + w - 11, y - 3, 14, 6, 0.5, { w: 0.4, fill: 'DOTS', tf: `rotate(28 ${x + w - 4} ${y})` });
    d += L(x + 6, y + 11, x + 8 + lw(l), y + 11, 0.8);
    return { d, t: lab(x + 7, y + 9.4, l), top: y + 13 };
  },
  paw(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 5, { w: 0.9 }) + RR(x + 3, y + 3, lw(l) + 15, 8.5, 4.25, { w: 0.6 }) + paw(x + 9, y + 7.5, 0.95),
      t: lab(x + 14.5, y + 9.2, l), top: y + 12 };
  },
  pill(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 6, { w: 0.9 }) + RR(x + 6, y - 4.5, lw(l) + 12, 9, 4.5, { w: 0.8 }) + C(x + 10.5, y, 1.1, { w: 0.4 }),
      t: lab(x + 14, y + 1.9, l), top: y + 7 };
  },
  cloud(x, y, w, h, l) {
    const W = lw(l) + 14;
    return { d: RR(x, y, w, h, 6, { w: 0.9 }) + cloudShape(x + 4 + W / 2, y + 0.5, W, 10, { w: 0.7 }),
      t: lab(x + 11, y + 2.4, l), top: y + 9 };
  },
  wood(x, y, w, h, l) {
    const W = lw(l) + 12;
    let d = RR(x, y, w, h, 2, { w: 0.9 }) + RR(x + 4, y - 4.5, W, 9.5, 1, { w: 0.8 });
    d += P(`M${x + 6},${y - 2} q${W / 3},1.4 ${W - 4},0`, { fill: 'none', w: 0.3 });
    d += C(x + 6.5, y + 2.6, 0.6, { w: 0.35 }) + C(x + W + 1.5, y + 2.6, 0.6, { w: 0.35 });
    return { d, t: lab(x + 10, y + 2.6, l), top: y + 8 };
  },
  flag(x, y, w, h, l) {
    const W = lw(l) + 10;
    return { d: RR(x, y, w, h, 3, { w: 0.9 }) + P(`M${x + 3},${y + 3} H${x + 3 + W + 6} L${x + 3 + W},${y + 7.5} L${x + 3 + W + 6},${y + 12} H${x + 3} Z`, { w: 0.75 }),
      t: lab(x + 7, y + 9.4, l), top: y + 13 };
  },
  leaf(x, y, w, h, l) {
    const lf = (cx, cy, r) => P(`M${cx - 3.2},${cy + 1.6} Q${cx - 2},${cy - 3.2} ${cx + 3.2},${cy - 1.6} Q${cx + 2},${cy + 3.2} ${cx - 3.2},${cy + 1.6} Z`, { w: 0.5, tf: `rotate(${r} ${cx} ${cy})` });
    return { d: RR(x, y, w, h, 6, { w: 0.9 }) + lf(x + 8, y + 7.4, 0) + L(x + 13, y + 11, x + 15 + lw(l), y + 11, 0.5, 'stroke-dasharray="1 1"'),
      t: lab(x + 13.5, y + 9.4, l), top: y + 12 };
  },
  snowcap(x, y, w, h, l) {
    let cap = `M${x + 3},${y + 0.6} H${x + w - 3}`;
    let d = RR(x, y, w, h, 4, { w: 0.9 });
    let path = `M${x + 1.2},${y + 3} Q${x + 1.2},${y - 1.6} ${x + 5},${y - 1.6} H${x + w - 5} Q${x + w - 1.2},${y - 1.6} ${x + w - 1.2},${y + 3}`;
    for (let k = 0; k < 6; k++) {
      const x2 = x + w - 1.2 - (w - 2.4) * (k + 1) / 6, xm = (x2 + (x + w - 1.2 - (w - 2.4) * k / 6)) / 2;
      path += ` Q${n(xm)},${n(y + (k % 2 ? 3.5 : 6))} ${n(x2)},${n(y + 3)}`;
    }
    d += P(path + ' Z', { w: 0.7 });
    void cap;
    return { d: d + snow(x + w - 8, y + 11, 2.6), t: lab(x + 6, y + 11.5, l), top: y + 14 };
  },
  bubble(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 6, { w: 0.9 }) + C(x + 6, y + 7, 2.6, { w: 0.6 }) + C(x + 10, y + 3.6, 1.3, { w: 0.5 }) + C(x + 4.4, y + 3, 0.9, { w: 0.45 }),
      t: lab(x + 12, y + 9, l), top: y + 12 };
  },
  news(x, y, w, h, l) {
    let d = L(x, y + 0.3, x + w, y + 0.3, 1.5) + L(x, y + 10.5, x + w, y + 10.5, 0.4) + L(x, y + h, x + w, y + h, 0.4);
    d += `<rect x="${n(x + 0.6)}" y="${n(y + 3.6)}" width="3.6" height="3.6" fill="#000"/>`;
    return { d, t: lab(x + 6.5, y + 7.6, l), top: y + 12 };
  },
  note(x, y, w, h, l) {
    let d = RR(x, y, w, h, 2, { w: 0.6 });
    d += RR(x + 5, y + 5.6, lw(l) + 4, 4.6, 0.8, { w: 0.3, fill: 'DOTS' });
    d += L(x + 3, y + 2, x + 3, y + h - 2, 0.3, 'stroke-dasharray="0.8 0.8"');
    return { d, t: lab(x + 7, y + 9.4, l), top: y + 12 };
  },
  mag(x, y, w, h, l) {
    const W = lw(l) + 8;
    let d = RR(x, y, w, h, 0, { w: 0.8 });
    d += `<rect x="${n(x)}" y="${n(y)}" width="${n(W)}" height="9" fill="#000"/>`;
    return { d, t: R(x + 4, y + 6.6, l, { size: LBL, font: F_T, rsize: 1.6, fill: '#fff' }), top: y + 10 };
  },
  form(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 1, { w: 0.6 }) + L(x + 2, y + 9, x + 6 + lw(l, 3.4), y + 9, 0.35),
      t: R(x + 3, y + 6.6, l, { size: 3.4, font: F_T, rsize: 1.4 }), top: y + 9 };
  },
  card(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 4, { w: 0.6 }),
      t: T(x + 5, y + 8.6, '#', { size: 4.6, font: F_T }) + lab(x + 9, y + 8.6, l), top: y + 11 };
  },
  window(x, y, w, h, l) {
    const W = lw(l) + 8;
    return { d: RR(x, y, w, h, 2, { w: 1.4 }) + RR(x + 1.7, y + 1.7, w - 3.4, h - 3.4, 1.2, { w: 0.45, fill: 'none' }) + RR(x + 5, y - 3.2, W, 6.4, 1, { w: 0.6 }),
      t: lab(x + 9, y + 1.5, l, { size: 3.8 }), top: y + 6 };
  },
  koma(x, y, w, h, l) {
    const W = lw(l) + 10;
    let d = RR(x, y, w, h, 0, { w: 1.5 });
    d += E(x + 4 + W / 2, y + 7.5, W / 2 + 1, 5, { w: 0.6 }) + P(`M${x + 8},${y + 11.6} L${x + 5},${y + 15} L${x + 12},${y + 12}`, { w: 0.6 });
    d += E(x + 4 + W / 2, y + 7.5, W / 2 + 0.5, 4.6, { w: 0, fill: '#fff' });
    return { d, t: lab(x + 9, y + 9, l), top: y + 13 };
  },
  report(x, y, w, h, l) {
    REPORT_NO++;
    let d = RR(x, y, w, h, 0, { w: 0.6 }) + L(x, y + 10, x + w, y + 10, 0.4);
    d += C(x + 6, y + 5.2, 3.2, { w: 0.6 });
    return { d, t: T(x + 6, y + 6.5, String(REPORT_NO), { size: 3.4, font: F_T, anchor: 'middle' }) + lab(x + 12, y + 7, l), top: y + 11 };
  },
  wa(x, y, w, h, l) {
    const W = lw(l) + 10;
    let d = RR(x, y, w, h, 0, { w: 1 }) + RR(x + 1.6, y + 1.6, w - 3.2, h - 3.2, 0, { w: 0.35, fill: 'none' });
    d += P(`M${x + 4},${y + 3.5} H${x + 4 + W} L${x + 6 + W},${y + 7.5} L${x + 4 + W},${y + 11.5} H${x + 4} L${x + 6},${y + 7.5} Z`, { w: 0.6 });
    return { d, t: lab(x + 9, y + 9.3, l), top: y + 13 };
  },
  staff(x, y, w, h, l) {
    let d = RR(x, y, w, h, 3, { w: 0.9 });
    for (let i = 0; i < 3; i++) d += L(x + 14 + lw(l), y + 4 + i * 1.6, x + w - 4, y + 4 + i * 1.6, 0.25);
    return { d: d + note(x + 6, y + 9.4, 0.75), t: lab(x + 10, y + 9.2, l), top: y + 12 };
  },
};

/* ---------- えを かく わく ---------- */
// p: { x, y, w, h, hint }
const PIC = {
  plain(x, y, w, h) { return RR(x, y, w, h, 3, { w: 0.8 }) + RR(x + 2, y + 2, w - 4, h - 4, 2, { w: 0.35, fill: 'none', dash: '1 1' }); },
  polaroid(x, y, w, h) { return RR(x, y, w, h, 1, { w: 0.8 }) + RR(x + 3.5, y + 3.5, w - 7, h - 12, 0.5, { w: 0.5 }); },
  frame(x, y, w, h) {
    let d = RR(x, y, w, h, 0, { w: 0.9 }) + RR(x + 3, y + 3, w - 6, h - 6, 0, { w: 0.5 });
    for (const [cx, cy] of [[x + 1.5, y + 1.5], [x + w - 1.5, y + 1.5], [x + 1.5, y + h - 1.5], [x + w - 1.5, y + h - 1.5]]) d += RR(cx - 2.6, cy - 2.6, 5.2, 5.2, 0.6, { w: 0.6 }) + C(cx, cy, 1, { w: 0.4 });
    d += L(x, y, x + 3, y + 3, 0.4) + L(x + w, y, x + w - 3, y + 3, 0.4) + L(x, y + h, x + 3, y + h - 3, 0.4) + L(x + w, y + h, x + w - 3, y + h - 3, 0.4);
    return d;
  },
  window(x, y, w, h) {
    const r = Math.min(w / 2, 14);
    return P(`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`, { w: 0.9 }) +
      RR(x - 2, y + h - 1, w + 4, 3.2, 1, { w: 0.6 }) +
      P(`M${x + 2.5},${y + h - 1} V${y + r} Q${x + 2.5},${y + 2.5} ${x + r},${y + 2.5} H${x + w - r} Q${x + w - 2.5},${y + 2.5} ${x + w - 2.5},${y + r} V${y + h - 1}`, { fill: 'none', w: 0.35 });
  },
  tv(x, y, w, h) {
    let d = L(x + w / 2, y + 4, x + w / 2 - 8, y - 1, 0.5) + L(x + w / 2, y + 4, x + w / 2 + 8, y - 1, 0.5);
    d += RR(x, y + 4, w, h - 4, 5, { w: 0.9 }) + RR(x + 4, y + 8, w - 16, h - 12, 3, { w: 0.6 });
    d += C(x + w - 6, y + 14, 1.8, { w: 0.5 }) + C(x + w - 6, y + 21, 1.8, { w: 0.5 });
    return d;
  },
  scallop(x, y, w, h) {
    let path = `M${x + 3},${y}`;
    const k = Math.max(4, Math.round(w / 8)), kk = Math.max(3, Math.round(h / 8));
    const sx = (w - 6) / k, sy = (h - 6) / kk;
    for (let i = 0; i < k; i++) path += ` a${n(sx / 2)},${n(sx / 2.6)} 0 0 1 ${n(sx)},0`;
    path += ` L${x + w},${y + 3}`;
    for (let i = 0; i < kk; i++) path += ` a${n(sy / 2.6)},${n(sy / 2)} 0 0 1 0,${n(sy)}`;
    path += ` L${x + w - 3},${y + h}`;
    for (let i = 0; i < k; i++) path += ` a${n(sx / 2)},${n(sx / 2.6)} 0 0 1 ${n(-sx)},0`;
    path += ` L${x},${y + h - 3}`;
    for (let i = 0; i < kk; i++) path += ` a${n(sy / 2.6)},${n(sy / 2)} 0 0 1 0,${n(-sy)}`;
    return P(path + ' Z', { w: 0.8 }) + RR(x + 4, y + 4, w - 8, h - 8, 2, { w: 0.35, fill: 'none', dash: '1 1' });
  },
  round(x, y, w, h) { return E(x + w / 2, y + h / 2, w / 2, h / 2, { w: 0.9 }) + E(x + w / 2, y + h / 2, w / 2 - 2.5, h / 2 - 2.5, { w: 0.35, fill: 'none', dash: '1 1' }); },
  egg(x, y, w, h) {
    const cx = x + w / 2;
    return P(`M${cx},${y} C${x + w},${y} ${x + w},${y + h} ${cx},${y + h} C${x},${y + h} ${x},${y} ${cx},${y} Z`, { w: 0.9 }) +
      P(`M${x + w * 0.12},${y + h * 0.48} l${w * 0.12},-4 l${w * 0.1},5 l${w * 0.12},-5 l${w * 0.12},5 l${w * 0.1},-5 l${w * 0.12},4`, { fill: 'none', w: 0.45 });
  },
  porthole(x, y, w, h) {
    const r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
    let d = C(cx, cy, r, { w: 1 }) + C(cx, cy, r - 4, { w: 0.7 });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; d += C(cx + (r - 2) * Math.cos(a), cy + (r - 2) * Math.sin(a), 0.8, { w: 0.4 }); }
    return d;
  },
  photo(x, y, w, h) { return RR(x, y, w, h - 7, 0, { w: 0.8 }) + L(x + 6, y + h - 2, x + w, y + h - 2, 0.35, 'stroke-dasharray="0.01 1.4"'); },
  tape(x, y, w, h) {
    return RR(x, y, w, h, 0.5, { w: 0.8 }) + RR(x + w / 2 - 9, y - 3, 18, 6, 0.5, { w: 0.4, fill: 'DOTS', tf: `rotate(-4 ${x + w / 2} ${y})` }) +
      RR(x + w - 10, y + h - 4, 14, 5.5, 0.5, { w: 0.4, fill: 'DOTS', tf: `rotate(-35 ${x + w - 3} ${y + h})` });
  },
  post(x, y, w, h) {
    let d = RR(x, y, w, h - 9, 1, { w: 0.8 });
    d += heart(x + 5, y + h - 4.5, 2) + P(`M${x + 11},${y + h - 7} h6 a1.5,1.5 0 0 1 1.5,1.5 v2.5 a1.5,1.5 0 0 1 -1.5,1.5 h-3 l-2,2 v-2 h-1 a1.5,1.5 0 0 1 -1.5,-1.5 v-2.5 a1.5,1.5 0 0 1 1.5,-1.5 Z`, { w: 0.45 });
    d += P(`M${x + w - 6},${y + h - 7.2} h4 v5.6 l-2,-1.6 l-2,1.6 Z`, { w: 0.45 });
    return d;
  },
  koma(x, y, w, h) { return RR(x, y, w, h, 0, { w: 1.6 }); },
  grid(x, y, w, h) {
    let d = RR(x, y, w, h, 0.5, { w: 0.8 });
    for (let xx = x + 5; xx < x + w; xx += 5) d += L(xx, y + 0.5, xx, y + h - 0.5, 0.12);
    for (let yy = y + 5; yy < y + h; yy += 5) d += L(x + 0.5, yy, x + w - 0.5, yy, 0.12);
    return d;
  },
  id(x, y, w, h) {
    let d = RR(x, y, w, h, 1, { w: 0.6 });
    const k = 4;
    for (const [cx, cy, sx, sy] of [[x + 3, y + 3, 1, 1], [x + w - 3, y + 3, -1, 1], [x + 3, y + h - 3, 1, -1], [x + w - 3, y + h - 3, -1, -1]])
      d += P(`M${cx},${cy + sy * k} V${cy} H${cx + sx * k}`, { fill: 'none', w: 0.8 });
    return d;
  },
  arch(x, y, w, h) {
    const r = w / 2;
    if (h < r + 6) return PIC.plain(x, y, w, h);
    return P(`M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`, { w: 0.9 }) +
      P(`M${x + 2.5},${y + h - 2.5} V${y + r} A${r - 2.5},${r - 2.5} 0 0 1 ${x + w - 2.5},${y + r} V${y + h - 2.5} Z`, { fill: 'none', w: 0.35, dash: '1 1' });
  },
  cover(x, y, w, h) {
    let d = RR(x, y, w, h, 0, { w: 0.8 });
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) d += L(cx - 2.5, cy, cx + 2.5, cy, 0.3) + L(cx, cy - 2.5, cx, cy + 2.5, 0.3);
    return d;
  },
};

/* ---------- テーマ ---------- */
const frameStd = (r = 5, w = 1) => RR(8, 8, 194, 281, r, { w });

const THEMES = {
  /* ===== 低学年むけ ===== */
  sakura: {
    name: 'さくらの リボン', box: 'tab', pic: 'scallop',
    frame: () => frameStd(5, 0.9),
    header() {
      let d = '', t = '';
      d += P('M26,19 H50 V41 H26 L33,30 Z', { w: 0.8 }) + P('M184,19 H160 V41 H184 L177,30 Z', { w: 0.8 });
      d += P('M40,38 L50,41 L50,38 Z', { fill: 'HATCH', w: 0.6 }) + P('M170,38 L160,41 L160,38 Z', { fill: 'HATCH', w: 0.6 });
      d += RR(40, 12, 130, 26, 2, { w: 0.9 });
      t += drawTitle(105, 32.5, 118, 12);
      d += sakura(20, 22, 9) + sakura(190, 22, 9);
      for (const [x, y, r] of [[60, 45, 20], [150, 44, -30], [100, 44, 60]]) d += petal(x, y, 0.07, r);
      return { d, t, top: 46 };
    },
  },
  animals: {
    name: 'どうぶつ', box: 'paw', pic: 'round',
    frame: () => RR(8, 14, 194, 275, 6, { w: 1 }),
    header() {
      let d = '', t = '';
      // ねこ（ひだり）
      d += P('M16,22 L18,9 L26,16 Z M40,22 L38,9 L30,16 Z', { w: 0.8 });
      d += E(28, 24, 14, 11, { w: 0.9 });
      d += C(23, 23, 1.1, { fill: '#000', w: 0 }) + C(33, 23, 1.1, { fill: '#000', w: 0 });
      d += P('M26,27 q1,1.4 2,0 q1,1.4 2,0', { fill: 'none', w: 0.5 });
      d += L(18, 26, 13, 25, 0.4) + L(18, 28, 13, 29, 0.4) + L(38, 26, 43, 25, 0.4) + L(38, 28, 43, 29, 0.4);
      // うさぎ（みぎ）
      d += E(176, 12, 3.4, 10, { w: 0.8, tf: 'rotate(-12 176 12)' }) + E(188, 12, 3.4, 10, { w: 0.8, tf: 'rotate(12 188 12)' });
      d += E(176, 12, 1.4, 7, { w: 0.4, tf: 'rotate(-12 176 12)' }) + E(188, 12, 1.4, 7, { w: 0.4, tf: 'rotate(12 188 12)' });
      d += E(182, 27, 13, 10.5, { w: 0.9 });
      d += C(177, 26, 1.1, { fill: '#000', w: 0 }) + C(187, 26, 1.1, { fill: '#000', w: 0 });
      d += P('M182,29 v1.6 M180.4,31.4 q1.6,1.2 3.2,0', { fill: 'none', w: 0.5 });
      d += E(173.5, 30, 1.8, 1, { w: 0.35 }) + E(190.5, 30, 1.8, 1, { w: 0.35 });
      // タイトル
      d += RR(46, 16, 118, 28, 14, { w: 1 });
      d += RR(48.5, 18.5, 113, 23, 11.5, { w: 0.35, fill: 'none', dash: '1 1' });
      t += drawTitle(105, 35, 100, 11);
      d += paw(18, 46, 1, -20) + paw(30, 50, 1, -10) + paw(180, 46, 1, 15) + paw(192, 50, 1, 25);
      return { d, t, top: 54 };
    },
  },
  sweets: {
    name: 'おかし', box: 'pill', pic: 'scallop',
    frame: () => frameStd(6, 1),
    header() {
      let d = '', t = '';
      let p = 'M8,14 Q8,8 14,8 H196 Q202,8 202,14 V19';
      const drips = [[190, 26], [178, 21], [166, 30], [150, 22], [136, 27], [118, 21], [104, 29], [90, 22], [74, 26], [58, 21], [44, 30], [28, 22], [14, 26]];
      let px = 202;
      for (const [x, yd] of drips) { p += ` Q${(px + x) / 2 + 4},19 ${x + 3},20 Q${x + 3},${yd} ${x},${yd} Q${x - 3},${yd} ${x - 3},20`; px = x - 3; }
      p += ' Q9,19 8,19 Z';
      d += P(p, { w: 0.8 });
      for (const [x, y, r] of [[30, 13, 20], [60, 12, -30], [96, 14, 60], [130, 12, 10], [168, 13, -40], [186, 12, 80]]) d += RR(x - 1.6, y - 0.6, 3.2, 1.2, 0.6, { w: 0.35, tf: `rotate(${r} ${x} ${y})` });
      // カップケーキ
      d += P('M14,44 L30,44 L28,58 L16,58 Z', { w: 0.7 }) + L(19, 44, 19.5, 58, 0.35) + L(22, 44, 22, 58, 0.35) + L(25, 44, 24.5, 58, 0.35);
      d += P('M13,44 Q12,38 17,37 Q18,31 23,32 Q27,30 28,35 Q32,36 31,44 Z', { w: 0.7 }) + C(22.5, 30, 2, { w: 0.6 });
      // アイス
      d += P('M182,42 L194,42 L188,60 Z', { w: 0.7 }) + L(184, 46, 191.5, 50, 0.3) + L(192, 46, 185, 51, 0.3) + L(186, 53, 190, 55, 0.3);
      d += C(188, 37, 6, { w: 0.7 }) + C(188, 28.5, 4.6, { w: 0.7 });
      t += drawTitle(105, 42, 126, 12);
      return { d, t, top: 54 };
    },
  },
  rainbow: {
    name: 'にじと くも', box: 'cloud', pic: 'window',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      for (const r of [50, 44, 38, 32]) d += P(`M${105 - r},62 A${r},${r} 0 0 1 ${105 + r},62`, { fill: 'none', w: 0.6 });
      d += sunIcon(24, 24, 7);
      d += C(22.5, 23, 0.7, { fill: '#000', w: 0 }) + C(26, 23, 0.7, { fill: '#000', w: 0 }) + P('M22.5,26 q1.7,1.6 3.4,0', { fill: 'none', w: 0.45 });
      d += cloudShape(105, 46, 142, 20, { w: 0.9 });
      t += drawTitle(105, 52, 124, 11);
      d += cloudShape(186, 20, 20, 8, { w: 0.6 });
      return { d, t, top: 66 };
    },
  },
  dino: {
    name: 'きょうりゅう', box: 'tag', pic: 'egg',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += P('M12,46 C16,40 22,37 30,37 C36,37 38,32 39,26 C40,21 44,19 48,21 C51,23 50,27 46,27 C44,28 43,32 43,38 C44,44 44,48 42,52 L42,58 L38,58 L37,53 L25,53 L24,58 L20,58 L20,52 C16,50 11,49 7,51 C8,48 10,47 12,46 Z', { w: 0.9 });
      d += C(46.5, 23, 0.8, { fill: '#000', w: 0 });
      d += C(26, 42, 2, { w: 0.45 }) + C(33, 41, 1.6, { w: 0.45 }) + C(30, 46.5, 1.4, { w: 0.45 });
      // かざん
      d += P('M160,58 L174,28 L184,28 L198,58 Z', { w: 0.9 }) + P('M174,28 L177,34 L180,30 L182,35 L184,28', { fill: 'none', w: 0.5 });
      d += C(176, 22, 3, { w: 0.5 }) + C(181, 17, 3.6, { w: 0.5 }) + C(186, 11.5, 2.6, { w: 0.5 });
      d += L(10, 58, 200, 58, 0.7);
      for (const x of [58, 92, 128, 150]) d += P(`M${x},58 l1,-3 l1,3 l1,-4 l1,4`, { fill: 'none', w: 0.45 });
      for (const [x, y] of [[66, 62], [80, 60], [94, 62]]) d += E(x, y, 1.6, 1.1, { w: 0.4 }) + C(x - 1.2, y - 1.6, 0.5, { w: 0.3 }) + C(x, y - 2, 0.5, { w: 0.3 }) + C(x + 1.2, y - 1.6, 0.5, { w: 0.3 });
      t += drawTitle(104, 40, 104, 12);
      return { d, t, top: 68 };
    },
  },
  train: {
    name: 'でんしゃ', box: 'tag', pic: 'window',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += C(24, 15, 3.4, { w: 0.6 }) + C(31, 12.5, 4.2, { w: 0.6 }) + C(39.5, 14, 3, { w: 0.6 });
      d += RR(25, 20, 6, 9, 1, { w: 0.7 });
      d += P('M14,56 V36 Q14,28 22,28 H40 V20 H62 V56 Z', { w: 0.9 });
      d += RR(44, 25, 13, 12, 1.5, { w: 0.7 }) + RR(10, 50, 6, 5, 1, { w: 0.6 });
      d += L(62, 50, 66, 50, 0.9);
      d += RR(66, 22, 130, 34, 5, { w: 0.9 }) + RR(66, 22, 130, 5, 2.5, { w: 0.6 });
      t += TITLE.kakari ? kakariName(80, 166, 47, 14) : drawTitle(131, 46, 118, 11);
      for (const x of [22, 46, 80, 106, 154, 180]) d += C(x, 58.5, 4.6, { w: 0.8 }) + C(x, 58.5, 1.3, { w: 0.5 });
      d += L(10, 63.6, 200, 63.6, 0.8);
      for (let x = 12; x < 200; x += 8) d += RR(x, 64.2, 4, 2, 0.4, { w: 0.4 });
      return { d, t, top: 74 };
    },
  },
  sea: {
    name: 'うみ', box: 'bubble', pic: 'porthole',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      // くじら
      d += P('M14,44 C14,32 30,28 42,32 C48,34 52,38 54,42 L60,36 L58,44 L62,50 L54,47 C50,52 38,54 28,52 C18,51 14,48 14,44 Z', { w: 0.9 });
      d += C(24, 40, 0.9, { fill: '#000', w: 0 }) + P('M18,46 q8,3 18,1', { fill: 'none', w: 0.45 });
      d += P('M30,28 q-1,-6 -5,-8 M30,28 q0,-7 2,-10 M30,28 q2,-6 6,-8', { fill: 'none', w: 0.5 });
      // ヨット
      d += P('M172,52 L196,52 L192,58 L176,58 Z', { w: 0.8 }) + L(184, 52, 184, 22, 0.6) + P('M184,24 L184,48 L172,48 Z', { w: 0.7 }) + P('M185.5,28 L185.5,48 L195,48 Z', { w: 0.7 });
      d += P('M140,18 q2,-2 4,0 q2,-2 4,0 M154,24 q1.6,-1.6 3.2,0 q1.6,-1.6 3.2,0', { fill: 'none', w: 0.5 });
      let wv = 'M8,60';
      for (let x = 8; x < 202; x += 10) wv += ` q2.5,-3 5,0 q2.5,3 5,0`;
      d += P(wv, { fill: 'none', w: 0.6 });
      d += C(66, 52, 1.2, { w: 0.4 }) + C(70, 47, 0.9, { w: 0.4 }) + C(160, 50, 1.2, { w: 0.4 });
      t += drawTitle(110, 36, 104, 12);
      return { d, t, top: 68 };
    },
  },
  forest: {
    name: 'もりの かんばん', box: 'wood', pic: 'frame',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += RR(54, 40, 5, 22, 1, { w: 0.7 }) + RR(151, 40, 5, 22, 1, { w: 0.7 });
      d += RR(40, 12, 130, 32, 3, { w: 1 });
      d += P('M44,20 q30,2 60,-1 t60,1 M44,38 q40,-2 80,1 t40,-1', { fill: 'none', w: 0.3 });
      d += C(45, 16, 0.8, { w: 0.4 }) + C(165, 16, 0.8, { w: 0.4 }) + C(45, 40, 0.8, { w: 0.4 }) + C(165, 40, 0.8, { w: 0.4 });
      t += drawTitle(105, 33, 116, 11.5);
      d += tree(22, 62, 1.6) + tree(36, 62, 1) + tree(188, 62, 1.6) + tree(174, 62, 1.1);
      d += mushroom(66, 62, 0.9) + mushroom(144, 62, 1.1);
      d += L(10, 62, 200, 62, 0.6);
      for (const x of [80, 100, 120]) d += P(`M${x},62 l1,-3 l1,3 l1,-4 l1,4`, { fill: 'none', w: 0.45 });
      return { d, t, top: 70 };
    },
  },
  space: {
    name: 'うちゅう', box: 'star', pic: 'round',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      const tf = 'translate(9 2) rotate(35 28 40)';
      d += P('M24,58 Q28,66 32,58 Z', { w: 0.6, tf });
      d += P('M22,48 L15,58 L22,55 Z M34,48 L41,58 L34,55 Z', { w: 0.7, tf });
      d += P('M28,16 C36,24 37,40 34,56 H22 C19,40 20,24 28,16 Z', { w: 0.9, tf });
      d += C(28, 34, 4.2, { w: 0.7, tf }) + L(22.6, 46, 33.4, 46, 0.5, `transform="${tf}"`);
      d += C(180, 36, 11, { w: 0.9 });
      d += P('M166,40 C156,46 172,46 192,34 C200,28 197,24 190,27', { fill: 'none', w: 0.8 });
      d += P('M172,30 q4,-2 8,0 M176,42 q4,2 8,-1', { fill: 'none', w: 0.4 });
      for (const [x, y, r] of [[54, 16, 2.4], [160, 16, 2.6], [150, 62, 1.8], [60, 62, 2], [196, 60, 2.2], [104, 14, 1.6]]) d += star(x, y, r, { w: 0.5 });
      d += sparkle(166, 54, 2.2) + sparkle(46, 30, 1.8);
      d += RR(50, 25, 108, 30, 15, { w: 1 });
      d += RR(53, 28, 102, 24, 12, { w: 0.35, fill: 'none', dash: '0.9 0.9' });
      t += TITLE.kakari ? kakariName(64, 128, 46, 14) : drawTitle(104, 45, 94, 11);
      return { d, t, top: 74 };
    },
  },
  shop: {
    name: 'おみせ', box: 'tab', pic: 'polaroid',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += RR(14, 12, 182, 16, 1, { w: 0.9 });
      for (let i = 0; i < 14; i++) {
        const x = 14 + i * 13;
        d += P(`M${x},28 a6.5,6.5 0 0 0 13,0`, { w: 0.8, fill: i % 2 ? 'HATCH' : '#fff' });
        if (i) d += L(x, 12, x, 28, 0.6);
      }
      for (let i = 0; i < 14; i += 2) d += RR(14 + i * 13 + 0.6, 12.6, 11.8, 14.8, 0, { w: 0, fill: 'HATCH' });
      d += RR(14, 12, 182, 16, 1, { w: 0.9, fill: 'none' });
      d += L(56, 35, 56, 41, 0.6) + L(154, 35, 154, 41, 0.6);
      d += RR(40, 40, 130, 27, 4, { w: 1 });
      d += RR(42.5, 42.5, 125, 22, 2.5, { w: 0.35, fill: 'none', dash: '0.9 0.9' });
      t += TITLE.kakari ? kakariName(50, 134, 60) : drawTitle(105, 59, 116, 11.5);
      for (const x of [24, 186]) {
        d += P(`M${x - 6},58 L${x + 6},58 L${x + 4.5},67 L${x - 4.5},67 Z`, { w: 0.7 });
        d += E(x, 52, 4, 5.5, { w: 0.6, tf: `rotate(-25 ${x} 52)` }) + E(x, 52, 4, 5.5, { w: 0.6, tf: `rotate(25 ${x} 52)` });
        d += L(x, 58, x, 50, 0.6);
      }
      return { d, t, top: 76 };
    },
  },
  balloon: {
    name: 'ふうせん', box: 'flag', pic: 'frame',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += P('M8,12 Q105,22 202,12', { fill: 'none', w: 0.5 });
      for (let i = 1; i < 16; i++) {
        const tt = i / 16, x = 8 + 194 * tt, y = 12 + 20 * tt * (1 - tt);
        d += POLY([[x - 3.5, y], [x + 3.5, y + 0.2], [x, y + 6]], { w: 0.45 });
      }
      d += balloon(18, 32, 5, 26, 60) + balloon(30, 26, 5.6, 26, 60) + balloon(26, 42, 4.6, 26, 60);
      d += balloon(180, 30, 5.4, 184, 60) + balloon(192, 36, 4.8, 184, 60) + balloon(186, 44, 4.2, 184, 60);
      t += drawTitle(105, 44, 128, 12.5);
      d += sparkle(52, 30, 2) + sparkle(158, 52, 2.2) + star(60, 54, 1.8, { w: 0.45 }) + star(150, 30, 1.8, { w: 0.45 });
      return { d, t, top: 62 };
    },
  },
  garden: {
    name: 'おはなばたけ', box: 'leaf', pic: 'arch', bottom: 266,
    frame() {
      let d = frameStd(5, 1);
      for (let x = 16; x <= 194; x += 11) d += tulip(x, 286, 15 + (x % 3) * 2);
      d += L(10, 286, 200, 286, 0.6);
      return d;
    },
    header() {
      let d = '', t = '';
      d += RR(36, 14, 138, 30, 15, { w: 1 });
      d += flowerSmall(40, 18, 5) + flowerSmall(170, 18, 5) + flowerSmall(40, 40, 4) + flowerSmall(170, 40, 4);
      t += drawTitle(105, 34.5, 112, 11.5);
      d += butterfly(20, 28, 1.6) + butterfly(190, 34, 1.4);
      return { d, t, top: 52 };
    },
  },
  snow: {
    name: 'ゆきの ひ', box: 'snowcap', pic: 'round',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += P('M8,60 Q40,46 80,56 Q120,64 160,52 Q186,44 202,50 V62 H8 Z', { w: 0.6 });
      d += snowman(184, 50, 1.4);
      for (const [x, y, r] of [[20, 20, 3.5], [44, 32, 2.5], [160, 18, 3], [146, 36, 2.2], [24, 46, 2.4], [196, 20, 2.4]]) d += snow(x, y, r);
      t += drawTitle(98, 36, 120, 12);
      return { d, t, top: 68 };
    },
  },

  /* ===== 高学年むけ ===== */
  newspaper: {
    name: 'しんぶん', box: 'news', pic: 'photo',
    frame: () => RR(8, 8, 194, 281, 0, { w: 0.6 }),
    header() {
      let d = '', t = '';
      t += drawTitle(14, 32, 136, 14, { anchor: 'start' });
      d += `<rect x="160" y="13" width="34" height="22" fill="#000"/>`;
      t += `<text x="177" y="28.6" font-size="10" font-family="${F_T}" text-anchor="middle" fill="#fff">${G === 'low' ? 'ごうがい' : '号外'}</text>`;
      d += L(12, 39, 198, 39, 1.4) + L(12, 41.2, 198, 41.2, 0.4);
      t += R(14, 47, '{第|だい}　　{号|ごう}', { size: 3.2 });
      t += R(110, 47, '{年|ねん}　　{月|がつ}　　{日|にち}　{発行|はっこう}', { size: 3.2, anchor: 'middle' });
      t += R(196, 47, '{発行者|はっこうしゃ}', { size: 3.2, anchor: 'end' });
      d += L(12, 50, 198, 50, 0.4);
      return { d, t, top: 54 };
    },
  },
  notebook: {
    name: 'ノート', box: 'note', pic: 'tape', cx: [22, 172],
    frame() {
      let d = RR(14, 8, 188, 281, 3, { w: 1 });
      for (let y = 16; y < 286; y += 11) d += C(14, y, 1.6, { w: 0.5 }) + P(`M8,${y + 2} q-1,-5 6,-3.6`, { fill: 'none', w: 0.6 });
      return d;
    },
    header() {
      let d = '', t = '';
      d += RR(42, 14, 132, 30, 2, { w: 1 }) + RR(44.5, 16.5, 127, 25, 1, { w: 0.35, fill: 'none' });
      d += L(46, 21.5, 66, 21.5, 0.3);
      t += T(46, 20.6, 'NOTE', { size: 3, font: F_T });
      t += drawTitle(108, 35.5, 114, 11);
      d += RR(24, 12, 18, 7, 0.5, { w: 0.4, fill: 'DOTS', tf: 'rotate(-30 33 15)' });
      d += P('M184,6 V30 Q184,34 188,34 Q192,34 192,30 V12 Q192,9 189.5,9 Q187,9 187,12 V28', { fill: 'none', w: 0.7 });
      d += sparkle(182, 44, 2.2);
      return { d, t, top: 52 };
    },
  },
  magazine: {
    name: 'ざっしの ひょうし', box: 'mag', pic: 'cover', bottom: 268,
    frame() {
      let d = RR(8, 8, 194, 281, 0, { w: 1 });
      d += barcode(170, 273, 24, 10);
      d += RR(167, 271, 30, 14, 0, { w: 0.4, fill: 'none' });
      return d;
    },
    header() {
      let d = '', t = '';
      const en = TITLE.en || 'MY GOALS', esz = Math.min(17, 17 * 140 / tw(en, 17, F_T));
      t += T(14, 31, en, { size: esz, font: F_T, hollow: true });
      t += T(14, 16, 'VOL.', { size: 3, font: F_T });
      d += L(23, 16.6, 34, 16.6, 0.35);
      t += drawTitle(14, 45, 132, 9, { anchor: 'start' });
      d += C(178, 30, 16, { w: 0.9 }) + C(178, 30, 13.6, { w: 0.35, fill: 'none', dash: '0.8 0.8' });
      t += R(178, 27.5, G === 'low' ? 'とくしゅう' : '{特集|とくしゅう}', { size: 5, font: F_T, anchor: 'middle' });
      t += R(178, 35, G === 'low' ? 'わたしの こと' : '{私|わたし}の{目標|もくひょう}', { size: 3.2, anchor: 'middle' });
      d += L(12, 50, 198, 50, 0.8);
      return { d, t, top: 56 };
    },
  },
  passport: {
    name: 'パスポート', box: 'form', pic: 'id',
    frame() {
      let d = RR(8, 8, 194, 281, 4, { w: 0.9 }) + RR(12, 12, 186, 273, 2, { w: 0.4, fill: 'none' });
      for (const ph of [0, Math.PI]) {
        let p = '';
        for (let x = 14; x <= 196; x += 1.5) p += (x === 14 ? 'M' : 'L') + n(x) + ',' + n(20 + 3 * Math.sin(x / 4 + ph));
        d += P(p, { fill: 'none', w: 0.3 });
      }
      return d;
    },
    header() {
      let d = '', t = '';
      d += C(30, 40, 11, { w: 0.8 }) + C(30, 40, 8.5, { w: 0.35, fill: 'none' }) + sakura(30, 40, 7);
      t += T(110, 34, 'P A S S P O R T', { size: 4, font: F_T, anchor: 'middle' });
      t += drawTitle(112, 47, 120, 10);
      t += T(178, 33, 'No.', { size: 3, font: F_T });
      d += L(184, 33.6, 196, 33.6, 0.35);
      d += L(14, 54, 196, 54, 0.4);
      return { d, t, top: 60 };
    },
  },
  sns: {
    name: 'SNSの とうこう', box: 'card', pic: 'post',
    frame: () => RR(8, 8, 194, 281, 10, { w: 1.3 }),
    header() {
      let d = '', t = '';
      t += T(18, 16.5, '9:41', { size: 3, font: F_T });
      d += RR(182, 13.4, 8, 3.8, 0.8, { w: 0.4 }) + `<rect x="183" y="14.3" width="4.5" height="2" fill="#000"/>` + RR(190.3, 14.6, 0.8, 1.4, 0.2, { w: 0.3 });
      d += L(8, 20, 202, 20, 0.35);
      d += C(24, 31, 7, { w: 0.8 }) + faceCircle(24, 31, 5);
      t += T(34, 30, '@', { size: 4, font: F_T });
      d += L(39, 30.8, 92, 30.8, 0.4);
      t += T(34, 36, G === 'low' ? 'フォロー　　　　フォロワー' : 'フォロー　　　フォロワー', { size: 2.6 });
      d += RR(150, 26, 22, 8, 4, { w: 0.6 });
      t += T(161, 31.6, 'フォロー', { size: 3, anchor: 'middle', font: F_T });
      d += heart(181, 30, 2.4) + P('M186,27.5 h6 a1.5,1.5 0 0 1 1.5,1.5 v2.5 a1.5,1.5 0 0 1 -1.5,1.5 h-3 l-2,2 v-2 h-1 a1.5,1.5 0 0 1 -1.5,-1.5 v-2.5 a1.5,1.5 0 0 1 1.5,-1.5 Z', { w: 0.45 });
      t += drawTitle(105, 52, 170, 11);
      d += L(14, 58, 196, 58, 0.3);
      return { d, t, top: 66 };
    },
  },
  rpg: {
    name: 'ゲームがめん', box: 'window', pic: 'koma',
    frame: () => RR(8, 8, 194, 281, 2, { w: 1.6 }) + RR(11, 11, 188, 275, 1, { w: 0.5, fill: 'none' }),
    header() {
      let d = '', t = '';
      d += RR(16, 15, 178, 34, 2, { w: 1.4 }) + RR(18, 17, 174, 30, 1.2, { w: 0.45, fill: 'none' });
      d += POLY([[23, 28], [28, 31], [23, 34]], { fill: '#000', w: 0.3 });
      t += drawTitle(108, 38, 140, 12);
      d += pixelHeart(170, 21, 1) + pixelHeart(178.5, 21, 1) + pixelHeart(187, 21, 1);
      t += T(30, 22.8, 'QUEST', { size: 2.8, font: F_T });
      return { d, t, top: 60 };
    },
  },
  board: {
    name: 'こくばん', box: 'tape', pic: 'tape',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += RR(14, 12, 182, 48, 2, { w: 1 }) + RR(18.5, 16.5, 173, 39, 1, { w: 0.7 });
      d += RR(22, 60, 166, 4, 1, { w: 0.7 });
      d += RR(40, 57.6, 9, 2.4, 1, { w: 0.5 }) + RR(54, 57.6, 7, 2.4, 1, { w: 0.5 }) + RR(150, 60.5, 10, 2, 0.8, { w: 0.45 });
      for (const [x, y] of [[26, 22], [184, 22]]) d += C(x, y, 2.6, { w: 0.6 }) + C(x - 0.7, y - 0.7, 0.7, { fill: 'none', w: 0.3 });
      t += TITLE.kakari ? kakariName(44, 140, 44, 15) : drawTitle(105, 42, 150, 13);
      d += sparkle(168, 50, 2.2) + star(176, 44, 1.8, { w: 0.5 });
      return { d, t, top: 74 };
    },
  },
  company: {
    name: 'ビルの かんばん', box: 'bar', pic: 'frame',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += L(12, 66, 198, 66, 0.8);
      for (const x of [20, 190]) d += L(x, 66, x, 56, 0.8) + C(x, 50, 7, { w: 0.7 }) + C(x - 3, 48, 2.5, { fill: 'none', w: 0.35 });
      d += RR(32, 14, 146, 52, 1, { w: 1 }) + RR(29, 11, 152, 5, 1, { w: 0.8 });
      for (const bx of [36, 156]) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) d += RR(bx + c * 9, 21 + r * 13, 7, 9, 0.8, { w: 0.55 });
      d += RR(58, 19, 94, 31, 2, { w: 0.9 });
      if (TITLE.kakari) { t += R(105, 27.5, '{株式会社|かぶしきがいしゃ}', { size: 3.4, anchor: 'middle', rsize: 1.6 }); t += kakariName(68, 128, 42, 13); }
      else t += drawTitle(105, 38.5, 86, 10);
      d += RR(95, 52, 20, 14, 1, { w: 0.7 }) + L(105, 52, 105, 66, 0.5);
      d += C(102.5, 59, 0.6, { fill: '#000', w: 0 }) + C(107.5, 59, 0.6, { fill: '#000', w: 0 });
      return { d, t, top: 76 };
    },
  },
  manga: {
    name: 'マンガ', box: 'koma', pic: 'koma',
    frame: () => RR(8, 8, 194, 281, 0, { w: 1.4 }),
    header() {
      let d = '', t = '';
      const cx = 105, cy = 34, rx = 66, ry = 15;
      let lines = '';
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2 + (i % 3) * 0.02;
        const x1 = cx + rx * 1.05 * Math.cos(a), y1 = cy + ry * 1.1 * Math.sin(a);
        const x2 = cx + rx * 2 * Math.cos(a), y2 = cy + ry * 4 * Math.sin(a);
        lines += L(x1, y1, x2, y2, i % 2 ? 0.25 : 0.45);
      }
      d += clipRect(12, 12, 186, 46, lines);
      d += RR(12, 12, 186, 46, 0, { w: 1.2, fill: 'none' });
      const pts = [];
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 1 : 1.16; pts.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]); }
      d += POLY(pts, { w: 0.8 });
      t += drawTitle(105, 38.5, 112, 11.5);
      return { d, t, top: 66 };
    },
  },
  lab: {
    name: 'けんきゅう レポート', box: 'report', pic: 'grid',
    frame: () => frameStd(3, 0.9),
    header() {
      let d = '', t = '';
      let g = '';
      for (let x = 14; x <= 196; x += 4) g += L(x, 12, x, 52, 0.12);
      for (let y = 12; y <= 52; y += 4) g += L(14, y, 196, y, 0.12);
      d += g + RR(14, 12, 182, 40, 1, { w: 0.6, fill: 'none' });
      d += RR(40, 20, 130, 26, 2, { w: 0.9 });
      t += T(44, 25, 'REPORT No.', { size: 2.6, font: F_T });
      d += L(62, 25.6, 74, 25.6, 0.3);
      t += drawTitle(106, 39.5, 116, 10.5);
      // フラスコ
      d += P('M22,20 H30 M24,20 V28 L18,42 Q17,45 20,45 H34 Q37,45 36,42 L30,28 V20', { w: 0.8 }) + P('M20.5,38 H33.5', { fill: 'none', w: 0.4 });
      d += C(24, 41, 1, { w: 0.35 }) + C(29, 39.5, 0.8, { w: 0.35 });
      // むしめがね
      d += C(182, 30, 7, { w: 0.9 }) + L(187, 35, 193, 44, 1.6) + P('M178,27 q2,-3 5,-2', { fill: 'none', w: 0.4 });
      return { d, t, top: 60 };
    },
  },
  wa: {
    name: 'わがら', box: 'wa', pic: 'frame',
    frame: () => RR(8, 8, 194, 281, 0, { w: 1.2 }) + RR(12, 12, 186, 273, 0, { w: 0.4, fill: 'none' }),
    header() {
      let d = '', t = '';
      d += seigaiha(12, 12, 186, 20, 5);
      d += L(12, 32, 198, 32, 0.6);
      d += P('M42,30 H168 L174,36 V52 L168,58 H42 L36,52 V36 Z', { w: 1 });
      d += P('M45,33 H165 L170,38 V50 L165,55 H45 L40,50 V38 Z', { fill: 'none', w: 0.35 });
      t += drawTitle(105, 49.5, 120, 11.5);
      d += ume(22, 46, 7) + ume(188, 46, 7);
      return { d, t, top: 66 };
    },
  },
  score: {
    name: 'がくふと けんばん', box: 'staff', pic: 'frame',
    frame: () => frameStd(4, 1),
    header() {
      let d = '', t = '';
      for (let i = 0; i < 5; i++) d += L(14, 14 + i * 2.4, 196, 14 + i * 2.4, 0.3);
      d += L(14, 14, 14, 23.6, 0.6) + L(196, 14, 196, 23.6, 0.6);
      for (const [x, y, dbl] of [[30, 21.2, 0], [48, 18.8, 1], [80, 16.4, 0], [104, 20, 1], [140, 17.6, 0], [160, 22.4, 1], [180, 15.2, 0]]) d += note(x, y, 0.75, !!dbl);
      t += drawTitle(105, 42, 160, 12);
      const kx = 14, kw = 182 / 26;
      for (let i = 0; i < 26; i++) d += RR(kx + i * kw, 50, kw, 12, 0.3, { w: 0.4 });
      for (let i = 0; i < 25; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) d += `<rect x="${n(kx + (i + 1) * kw - 1.6)}" y="50" width="3.2" height="7.4" fill="#000"/>`;
      return { d, t, top: 70 };
    },
  },
  stadium: {
    name: 'スコアボード', box: 'mag', pic: 'photo',
    frame: () => frameStd(4, 1),
    header() {
      let d = '', t = '';
      for (const x of [18, 192]) {
        d += L(x, 60, x, 22, 0.8);
        d += RR(x - 7, 12, 14, 9, 1, { w: 0.6 });
        for (let i = 0; i < 3; i++) d += C(x - 4 + i * 4, 16.5, 1.3, { w: 0.4 });
      }
      d += RR(32, 12, 146, 46, 3, { w: 1.2 }) + RR(35, 15, 140, 22, 1.5, { w: 0.5 });
      t += drawTitle(105, 30.5, 128, 11);
      t += R(66, 51, G === 'low' ? 'あかぐみ' : '{赤組|あかぐみ}', { size: 4, font: F_T, anchor: 'middle' });
      t += R(144, 51, G === 'low' ? 'しろぐみ' : '{白組|しろぐみ}', { size: 4, font: F_T, anchor: 'middle' });
      d += RR(86, 40, 14, 15, 1, { w: 0.6 }) + RR(110, 40, 14, 15, 1, { w: 0.6 });
      t += T(105, 50, '－', { size: 4, anchor: 'middle', font: F_T });
      return { d, t, top: 68 };
    },
  },
};
