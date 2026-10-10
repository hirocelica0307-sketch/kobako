'use strict';
/* =========================================================
   テーマ（ついか）：ウェブで よく 見かける カードの アイデアを もとに、
   ここで あたらしく かいた デザイン
   ========================================================= */
let CHAT_N = 0;

function clipPathEO(dPath, content) {
  const id = 'cp' + (++CLIPN);
  return `<clipPath id="${id}"><path d="${dPath}" clip-rule="evenodd"/></clipPath><g clip-path="url(#${id})">${content}</g>`;
}
function weatherIcon(kind, cx, cy, s = 1) {
  if (kind === 'sun') return sunIcon(cx, cy, 2.6 * s);
  if (kind === 'cloud') return cloudShape(cx, cy, 9 * s, 4.4 * s, { w: 0.5 });
  if (kind === 'rain') return P(`M${n(cx - 4.5 * s)},${n(cy)} Q${n(cx)},${n(cy - 6 * s)} ${n(cx + 4.5 * s)},${n(cy)} Z`, { w: 0.5 }) + L(cx, cy, cx, cy + 4 * s, 0.5) + P(`M${n(cx)},${n(cy + 4 * s)} q0,1.4 -1.4,1.4`, { fill: 'none', w: 0.5 });
  if (kind === 'thunder') return POLY([[cx + 1 * s, cy - 4 * s], [cx - 2.6 * s, cy + 0.6 * s], [cx, cy + 0.6 * s], [cx - 1.4 * s, cy + 4.6 * s], [cx + 2.8 * s, cy - 0.8 * s], [cx + 0.2 * s, cy - 0.8 * s]], { w: 0.5 });
  if (kind === 'snow') return snowman(cx, cy + 2.6 * s, 0.38 * s);
  if (kind === 'rainbow') { let d = ''; for (const r of [4, 3, 2]) d += P(`M${n(cx - r * s)},${n(cy + 2 * s)} A${n(r * s)},${n(r * s)} 0 0 1 ${n(cx + r * s)},${n(cy + 2 * s)}`, { fill: 'none', w: 0.5 }); return d; }
  return '';
}
function burst(cx, cy, r, k = 16) {
  let d = '';
  for (let i = 0; i < k; i++) {
    const a = i / k * Math.PI * 2;
    d += L(cx + r * 0.3 * Math.cos(a), cy + r * 0.3 * Math.sin(a), cx + r * 0.85 * Math.cos(a), cy + r * 0.85 * Math.sin(a), 0.45);
    d += C(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.7, { w: 0.35 });
  }
  return d + C(cx, cy, 1, { w: 0.4 });
}
function cakeIcon(x, y, s = 1) {
  let d = '';
  for (const cx of [x + 6 * s, x + 11 * s, x + 16 * s]) {
    d += RR(cx - 0.8 * s, y - 6 * s, 1.6 * s, 6 * s, 0.4, { w: 0.4 });
    d += P(`M${n(cx)},${n(y - 9.4 * s)} q${n(1.4 * s)},${n(1.6 * s)} 0,${n(2.8 * s)} q${n(-1.4 * s)},${n(-1.2 * s)} 0,${n(-2.8 * s)} Z`, { w: 0.4 });
  }
  d += RR(x + 1 * s, y, 20 * s, 8 * s, 1.2, { w: 0.7 }) + RR(x - 2 * s, y + 8 * s, 26 * s, 10 * s, 1.2, { w: 0.7 });
  d += P(`M${n(x + 1 * s)},${n(y + 3 * s)} q${n(2.5 * s)},${n(2.4 * s)} ${n(5 * s)},0 t${n(5 * s)},0 t${n(5 * s)},0 t${n(5 * s)},0`, { fill: 'none', w: 0.45 });
  d += P(`M${n(x - 2 * s)},${n(y + 11.5 * s)} q${n(3.25 * s)},${n(2.6 * s)} ${n(6.5 * s)},0 t${n(6.5 * s)},0 t${n(6.5 * s)},0 t${n(6.5 * s)},0`, { fill: 'none', w: 0.45 });
  return d;
}
function present(x, y, s = 1) {
  return RR(x, y + 5 * s, 18 * s, 14 * s, 0.8, { w: 0.7 }) + RR(x - 1.5 * s, y + 1 * s, 21 * s, 5 * s, 0.8, { w: 0.7 }) +
    RR(x + 7.5 * s, y + 1 * s, 3 * s, 18 * s, 0, { w: 0.5 }) +
    E(x + 5.5 * s, y - 1 * s, 4 * s, 2.4 * s, { w: 0.6, tf: `rotate(20 ${n(x + 5.5 * s)} ${n(y - s)})` }) + E(x + 12.5 * s, y - 1 * s, 4 * s, 2.4 * s, { w: 0.6, tf: `rotate(-20 ${n(x + 12.5 * s)} ${n(y - s)})` }) +
    C(x + 9 * s, y + 0.4 * s, 1.6 * s, { w: 0.6 });
}
function bookStack(x, y) {
  return RR(x, y + 18, 24, 7, 1, { w: 0.7 }) + RR(x + 3, y + 11, 22, 7, 1, { w: 0.7 }) + RR(x + 1, y + 4, 21, 7, 1, { w: 0.7 }) +
    L(x + 5, y + 18, x + 5, y + 25, 0.4) + L(x + 20, y + 11, x + 20, y + 18, 0.4) + L(x + 6, y + 4, x + 6, y + 11, 0.4) +
    P(`M${x + 15},${y + 4} V${y - 2} L${x + 17},${y} L${x + 19},${y - 2} V${y + 4}`, { w: 0.5 });
}

Object.assign(BOX, {
  wanted(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 0, { w: 0.7 }) + RR(x + 1.3, y + 1.3, w - 2.6, h - 2.6, 0, { w: 0.3, fill: 'none' }) + star(x + 5.5, y + 6, 2.2, { w: 0.45 }) + star(x + w - 5.5, y + 6, 2.2, { w: 0.45 }),
      t: lab(x + 10, y + 8, l), top: y + 10 };
  },
  tcg(x, y, w, h, l) {
    let d = RR(x, y, w, h, 2, { w: 0.6 });
    for (const cx of [x + 5, x + 10.5]) d += C(cx, y + 6, 2.3, { w: 0.55 }) + star(cx, y + 6.1, 1.3, { w: 0.3 });
    return { d, t: lab(x + 15, y + 7.8, l), top: y + 11 };
  },
  sunny(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 4, { w: 0.9 }) + sunIcon(x + 7, y + 7, 2.2), t: lab(x + 14, y + 8.8, l), top: y + 12 };
  },
  chat(x, y, w, h, l) {
    const right = (CHAT_N++) % 2 === 1;
    let d = '';
    const ax = right ? x + w - 5 : x + 5;
    d += C(ax, y + 5, 4.5, { w: 0.6 }) + faceCircle(ax, y + 5, 3);
    const bx = right ? x : x + 12, bw = w - 12;
    d += RR(bx, y, bw, h, 5, { w: 0.8 });
    d += right ? P(`M${bx + bw - 0.4},${y + 4} L${bx + bw + 3.5},${y + 5} L${bx + bw - 0.4},${y + 8} Z`, { w: 0.6 }) + P(`M${bx + bw - 0.4},${y + 4.4} V${y + 7.6}`, { fill: 'none', w: 1, stroke: '#fff' })
      : P(`M${bx + 0.4},${y + 4} L${bx - 3.5},${y + 5} L${bx + 0.4},${y + 8} Z`, { w: 0.6 }) + P(`M${bx + 0.4},${y + 4.4} V${y + 7.6}`, { fill: 'none', w: 1, stroke: '#fff' });
    return { d, t: lab(bx + 5, y + 7.6, l, { size: LBL * 0.92 }), top: y + 10, x: bx, w: bw };
  },
  bookmark(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 2, { w: 0.8 }) + P(`M${x + 5},${y - 3} H${x + 12} V${y + 10} L${x + 8.5},${y + 7} L${x + 5},${y + 10} Z`, { w: 0.6 }),
      t: lab(x + 15, y + 7.6, l), top: y + 11 };
  },
  clapper(x, y, w, h, l) {
    let d = RR(x, y, w, h, 1, { w: 0.8 }) + RR(x + 3, y + 5, 10, 6, 0.5, { w: 0.6 });
    d += P(`M${x + 3},${y + 5} L${x + 12.6},${y + 2} L${x + 13.2},${y + 3.8} L${x + 3.6},${y + 6.8} Z`, { w: 0.5 });
    d += L(x + 6, y + 4, x + 7.4, y + 5.4, 0.5) + L(x + 9.2, y + 3, x + 10.6, y + 4.4, 0.5);
    return { d, t: lab(x + 16, y + 9, l), top: y + 12 };
  },
  plainbox(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 1, { w: 0.7 }), t: lab(x + 3.5, y + 6.4, l, { size: LBL * 0.9 }), top: y + 8 };
  },
  postcard(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 1, { w: 0.6 }) + L(x + 4, y + 10, x + 8 + lw(l), y + 10, 0.5) + RR(x + w - 9, y + 2.5, 6, 7, 0.4, { w: 0.4, dash: '0.6 0.6' }),
      t: lab(x + 5, y + 8, l), top: y + 11 };
  },
  candle(x, y, w, h, l) {
    let d = RR(x, y, w, h, 5, { w: 0.9 }) + RR(x + 5, y + 5, 2.4, 6, 0.4, { w: 0.5 });
    d += P(`M${x + 6.2},${y + 1.4} q1.4,1.6 0,3 q-1.4,-1.2 0,-3 Z`, { w: 0.45 });
    return { d, t: lab(x + 11, y + 9.4, l), top: y + 12 };
  },
  uchiwa(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 5, { w: 0.9 }) + C(x + 7, y + 5.8, 3.6, { w: 0.6 }) + L(x + 7, y + 9.4, x + 7, y + 12.4, 0.8) + P(`M${x + 4.8},${y + 4.6} q2.2,-2 4.4,0`, { fill: 'none', w: 0.35 }),
      t: lab(x + 13, y + 8.8, l), top: y + 13 };
  },
  station(x, y, w, h, l) {
    return { d: RR(x, y, w, h, 3, { w: 0.8 }) + L(x + 6.5, y - 4, x + 6.5, y + 4, 1.6) + C(x + 6.5, y + 6.5, 2.8, { w: 1 }),
      t: lab(x + 12, y + 8.4, l), top: y + 11 };
  },
  ticket(x, y, w, h, l) {
    const r = 3;
    const d = P(`M${x + r},${y} H${x + w - r} A${r},${r} 0 0 0 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 0 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 0 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 0 ${x + r},${y} Z`, { w: 0.8 }) + star(x + 7, y + 6.6, 2.3, { w: 0.45 });
    return { d, t: lab(x + 12, y + 8.6, l), top: y + 12 };
  },
});

Object.assign(PIC, {
  mugshot(x, y, w, h) {
    let d = RR(x, y, w, h, 0.5, { w: 0.9 });
    for (let yy = y + 4, k = 0; yy < y + h - 2; yy += 4, k++) d += L(x, yy, x + (k % 2 ? 3 : 6), yy, 0.35) + L(x + w, yy, x + w - (k % 2 ? 3 : 6), yy, 0.35);
    d += RR(x + w / 2 - 17, y + h - 11, 34, 8, 0.5, { w: 0.7 });
    return d;
  },
  tcgArt(x, y, w, h) {
    return RR(x, y, w, h, 1, { w: 1.2 }) + RR(x + 2.5, y + 2.5, w - 5, h - 5, 0.5, { w: 0.45 }) + L(x + 2.5, y + h - 8, x + w - 2.5, y + h - 8, 0.35, 'stroke-dasharray="0.01 1.3"');
  },
  page(x, y, w, h) {
    const m = x + w / 2;
    return P(`M${m},${y + 4} Q${x + w / 4},${y - 1} ${x},${y + 3} V${y + h} Q${x + w / 4},${y + h - 4} ${m},${y + h} Z`, { w: 0.8 }) +
      P(`M${m},${y + 4} Q${x + w * 0.75},${y - 1} ${x + w},${y + 3} V${y + h} Q${x + w * 0.75},${y + h - 4} ${m},${y + h} Z`, { w: 0.8 });
  },
  screen(x, y, w, h) {
    let d = RR(x, y, w, h, 1, { w: 0.9 });
    d += P(`M${x},${y} H${x + 14} Q${x + 8},${y + 8} ${x},${y + 12} Z M${x + w},${y} H${x + w - 14} Q${x + w - 8},${y + 8} ${x + w},${y + 12} Z`, { w: 0.6 });
    d += P(`M${x},${y} H${x + w} V${y + 4} Q${x + w * 0.75},${y + 7} ${x + w / 2},${y + 4} Q${x + w / 4},${y + 7} ${x},${y + 4} Z`, { w: 0.6 });
    return d;
  },
  stamp(x, y, w, h) {
    let d = RR(x, y, w, h, 0, { w: 0.8 });
    for (let xx = x + 2; xx < x + w - 1; xx += 3) d += C(xx, y, 0.9, { w: 0, fill: '#fff' }) + C(xx, y, 0.9, { w: 0.35, fill: 'none' }) + C(xx, y + h, 0.9, { w: 0, fill: '#fff' }) + C(xx, y + h, 0.9, { w: 0.35, fill: 'none' });
    for (let yy = y + 2; yy < y + h - 1; yy += 3) d += C(x, yy, 0.9, { w: 0, fill: '#fff' }) + C(x, yy, 0.9, { w: 0.35, fill: 'none' }) + C(x + w, yy, 0.9, { w: 0, fill: '#fff' }) + C(x + w, yy, 0.9, { w: 0.35, fill: 'none' });
    return d + RR(x + 3, y + 3, w - 6, h - 6, 0, { w: 0.35, fill: 'none' });
  },
  chat(x, y, w, h) {
    return C(x + 5, y + 5, 4.5, { w: 0.6 }) + faceCircle(x + 5, y + 5, 3) + RR(x + 12, y, w - 12, h, 5, { w: 0.8 }) + RR(x + 15, y + 3, w - 18, h - 6, 3, { w: 0.35, fill: 'none', dash: '1 1' });
  },
});

Object.assign(THEMES, {
  wanted: {
    name: 'WANTED ポスター', box: 'wanted', pic: 'mugshot',
    frame() {
      let d = RR(8, 8, 194, 281, 1, { w: 0.8 }) + RR(13, 13, 184, 271, 0, { w: 1.6, fill: 'none' }) + RR(15.5, 15.5, 179, 266, 0, { w: 0.4, fill: 'none' });
      for (const [x, y] of [[11, 11], [199, 11], [11, 286], [199, 286]]) d += C(x, y, 1.5, { w: 0.6 });
      return d;
    },
    header() {
      let d = '', t = '';
      t += T(105, 41, 'WANTED', { size: 25, font: F_T, hollow: true, anchor: 'middle' });
      const sub = G === 'low' ? 'この こを さがしています！' : 'この{人物|じんぶつ}を さがしています';
      const sw = rtw(sub, 3.6);
      t += R(105, 49.5, sub, { size: 3.6, anchor: 'middle' });
      d += L(22, 48.4, 105 - sw / 2 - 4, 48.4, 0.5) + L(105 + sw / 2 + 4, 48.4, 188, 48.4, 0.5);
      d += star(22, 30, 3) + star(188, 30, 3);
      t += drawTitle(105, 61, 150, 8.5);
      return { d, t, top: 66 };
    },
  },
  tcg: {
    name: 'トレーディングカード', box: 'tcg', pic: 'tcgArt', bottom: 274,
    frame() {
      let d = RR(8, 8, 194, 281, 8, { w: 1.4 }) + RR(13, 13, 184, 271, 5, { w: 0.5, fill: 'none' });
      d += star(176, 281, 1.8, { w: 0.4 }) + star(182, 281, 1.8, { w: 0.4 }) + star(188, 281, 1.8, { w: 0.4 });
      return d + `<text x="18" y="282" font-size="2.6" font-family="${F_T}">No.　　　　/ 　　</text>`;
    },
    header() {
      let d = '', t = '';
      d += RR(16, 16, 178, 19, 3, { w: 0.9 });
      t += drawTitle(21, 30, 128, 8.5, { anchor: 'start' });
      t += T(156, 30, 'HP', { size: 4.6, font: F_T });
      d += L(164, 31, 178, 31, 0.5);
      d += C(187, 25.5, 6, { w: 0.8 }) + star(187, 25.8, 3.6, { w: 0.5 });
      return { d, t, top: 40 };
    },
  },
  weather: {
    name: 'てんきよほう', box: 'sunny', pic: 'tv',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += RR(14, 12, 182, 42, 4, { w: 1 }) + RR(16.5, 14.5, 177, 37, 3, { w: 0.35, fill: 'none' });
      t += drawTitle(105, 30, 160, 11);
      const kinds = [['sun', 'はれ'], ['cloud', 'くもり'], ['rain', 'あめ'], ['thunder', 'かみなり'], ['rainbow', 'にじ']];
      kinds.forEach(([k, lb], i) => {
        const x = 50 + i * 27.5;
        d += weatherIcon(k, x - 5, 42, 0.9);
        t += T(x + 0.5, 43.5, lb, { size: 2.6 });
      });
      return { d, t, top: 60 };
    },
  },
  chat: {
    name: 'チャットがめん', box: 'chat', pic: 'chat', bottom: 262,
    frame() {
      let d = RR(8, 8, 194, 281, 10, { w: 1.3 });
      d += RR(16, 268, 150, 10, 5, { w: 0.6 }) + C(181, 273, 5.5, { w: 0.7 }) + POLY([[178.6, 270.2], [184.6, 273], [178.6, 275.8]], { w: 0.4 });
      return d;
    },
    header() {
      let d = '', t = '';
      t += T(18, 16.5, '9:41', { size: 3, font: F_T });
      d += RR(182, 13.4, 8, 3.8, 0.8, { w: 0.4 }) + `<rect x="183" y="14.3" width="4.5" height="2" fill="#000"/>`;
      d += L(8, 31, 202, 31, 0.4);
      d += P('M20,22 l-4,4 l4,4', { fill: 'none', w: 0.9 });
      d += L(184, 23, 192, 23, 0.7) + L(184, 26, 192, 26, 0.7) + L(184, 29, 192, 29, 0.7);
      t += drawTitle(105, 28, 140, 8);
      d += RR(88, 35, 34, 6, 3, { w: 0.5 });
      t += R(105, 39.4, G === 'low' ? 'きょう' : '{今日|きょう}', { size: 2.8, anchor: 'middle' });
      return { d, t, top: 44 };
    },
  },
  book: {
    name: 'ほん', box: 'bookmark', pic: 'page',
    frame() {
      return RR(11.5, 11, 190, 279, 3, { w: 0.5 }) + RR(8, 8, 190, 279, 3, { w: 1 }) + P('M168,8 H178 V36 L173,31 L168,36 Z', { w: 0.7 });
    },
    header() {
      let d = '', t = '';
      d += bookStack(14, 20);
      d += RR(44, 15, 118, 31, 2, { w: 0.9 }) + RR(47, 18, 112, 25, 1, { w: 0.35, fill: 'none', dash: '1 1' });
      t += drawTitle(103, 35.5, 104, 11);
      d += sparkle(186, 44, 2.4);
      return { d, t, top: 54 };
    },
  },
  movie: {
    name: 'えいがの ポスター', box: 'clapper', pic: 'screen', bottom: 262,
    frame() {
      let d = RR(8, 8, 194, 281, 0, { w: 1.2 });
      d += `<rect x="8" y="8" width="194" height="10" fill="#000"/>`;
      for (let x = 11; x < 200; x += 6) d += RR(x, 10.5, 3, 5, 0.6, { w: 0, fill: '#fff' });
      d += L(14, 266, 196, 266, 0.4);
      const cr = G === 'low' ? ['かんとく', 'しゅえん', 'こうかいび'] : ['{監督|かんとく}', '{主演|しゅえん}', '{公開日|こうかいび}'];
      cr.forEach((c, i) => { const x = 16 + i * 62; d += R(x, 274, c, { size: 3 }) + L(x + rtw(c, 3) + 2, 275, x + 56, 275, 0.35); });
      d += T(105, 283, '★ ★ ★ ★ ★', { size: 3, anchor: 'middle' });
      return d;
    },
    header() {
      let d = '', t = '';
      t += T(105, 26, 'C O M I N G   S O O N', { size: 3.2, font: F_T, anchor: 'middle' });
      t += drawTitle(105, 42, 170, 13);
      d += L(30, 47, 180, 47, 0.4);
      return { d, t, top: 50 };
    },
  },
  diary: {
    name: 'えにっき', box: 'plainbox', pic: 'plain',
    frame: () => RR(8, 8, 194, 281, 2, { w: 1 }),
    header() {
      let d = '', t = '';
      t += drawTitle(105, 23, 150, 10);
      const y = 35;
      t += L(16, y + 1, 26, y + 1, 0.4) + R(27, y, '{月|がつ}', { size: 3.8 }) + L(33, y + 1, 43, y + 1, 0.4) + R(44, y, '{日|にち}', { size: 3.8 });
      t += T(50, y, '（　　）', { size: 3.8 });
      t += R(76, y, '{天気|てんき}', { size: 3.8 });
      ['sun', 'cloud', 'rain', 'snow'].forEach((k, i) => { d += weatherIcon(k, 98 + i * 13, y - 1.6, 0.85); });
      t += T(194, y, 'ぴったりの てんきを ○で かこもう', { size: 2.4, anchor: 'end' });
      d += L(14, 40, 196, 40, 0.5);
      return { d, t, top: 44 };
    },
  },
  airmail: {
    name: 'エアメール', box: 'postcard', pic: 'stamp',
    frame() {
      let stripes = '';
      for (let i = -300; i < 220; i += 12) stripes += `<line x1="${i}" y1="0" x2="${i + 300}" y2="300" stroke="#000" stroke-width="3.6"/><line x1="${i}" y1="0" x2="${i + 300}" y2="300" stroke="#fff" stroke-width="2.6"/>`;
      const band = 'M8,8 H202 V289 H8 Z M15,15 V282 H195 V15 Z';
      let d = clipPathEO(band, stripes);
      d += RR(8, 8, 194, 281, 2, { w: 0.9, fill: 'none' }) + RR(15, 15, 180, 267, 1, { w: 0.6, fill: 'none' });
      return d;
    },
    header() {
      let d = '', t = '';
      t += T(22, 27, 'AIR MAIL', { size: 4.2, font: F_T });
      d += L(22, 29, 52, 29, 0.4);
      t += drawTitle(22, 44, 118, 11, { anchor: 'start' });
      d += C(150, 34, 9, { w: 0.6 }) + C(150, 34, 6.8, { w: 0.3, fill: 'none' });
      for (let i = 0; i < 3; i++) d += P(`M${128},${29 + i * 5} q3,-2 6,0 t6,0 t6,0`, { fill: 'none', w: 0.4 });
      d += PIC.stamp(166, 20, 22, 26) + heart(177, 33, 4.4, { w: 0.6 });
      return { d, t, top: 56 };
    },
  },
  cake: {
    name: 'バースデーケーキ', box: 'candle', pic: 'frame',
    frame: () => frameStd(6, 1),
    header() {
      let d = '', t = '';
      d += cakeIcon(16, 30, 1.1) + present(176, 26, 1);
      d += RR(48, 15, 114, 30, 15, { w: 1 }) + RR(50.5, 17.5, 109, 25, 12.5, { w: 0.35, fill: 'none', dash: '1 1' });
      t += drawTitle(105, 35.5, 98, 11);
      d += confetti([[46, 50, 0], [70, 52, 2], [98, 50, 1], [130, 52, 3], [160, 50, 0], [60, 12, 1], [150, 12, 2]]);
      return { d, t, top: 56 };
    },
  },
  hanabi: {
    name: 'はなび', box: 'uchiwa', pic: 'scallop',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += burst(26, 26, 13) + burst(184, 27, 12) + burst(156, 16, 6, 12) + burst(56, 15, 6, 12);
      t += drawTitle(105, 39, 108, 12);
      let wv = 'M10,52';
      for (let x = 10; x < 200; x += 12) wv += ' q3,-3 6,0 q3,3 6,0';
      d += P(wv, { fill: 'none', w: 0.6 });
      return { d, t, top: 62 };
    },
  },
  route: {
    name: 'えきの かんばん', box: 'station', pic: 'plain',
    frame: () => frameStd(4, 1),
    header() {
      let d = '', t = '';
      d += RR(56, 44, 4, 12, 0.6, { w: 0.6 }) + RR(150, 44, 4, 12, 0.6, { w: 0.6 });
      d += RR(28, 12, 154, 34, 2, { w: 1 });
      t += drawTitle(105, 29, 136, 11);
      d += RR(28, 34, 154, 4, 0, { w: 0.6, fill: 'HATCH' });
      t += R(34, 43.4, G === 'low' ? '← まえ' : '← {前|まえ}', { size: 3 }) + R(176, 43.4, G === 'low' ? 'つぎ →' : '{次|つぎ} →', { size: 3, anchor: 'end' });
      d += L(12, 60, 198, 60, 2.2) + P('M12,60 H198', { fill: 'none', w: 0.9, stroke: '#fff' });
      for (const x of [20, 62, 105, 148, 190]) d += C(x, 60, 2.8, { w: 0.9 });
      return { d, t, top: 66 };
    },
  },
  stamp: {
    name: 'スタンプラリー', box: 'ticket', pic: 'plain',
    frame: () => RR(8, 8, 194, 281, 4, { w: 1 }) + RR(12, 12, 186, 273, 3, { fill: 'none', w: 0.8, dash: '0.01 2' }),
    header() {
      let d = '', t = '';
      d += RR(36, 15, 138, 30, 15, { w: 1.2 }) + RR(39, 18, 132, 24, 12, { w: 0.35, fill: 'none', dash: '1 1' });
      t += drawTitle(105, 35, 120, 11);
      d += C(21, 30, 8, { fill: 'none', w: 0.6, dash: '1.2 1' }) + star(21, 30.5, 4, { w: 0.5 });
      d += C(189, 30, 8, { fill: 'none', w: 0.6, dash: '1.2 1' }) + heart(189, 30.5, 3.6, { w: 0.5 });
      return { d, t, top: 52 };
    },
  },
  bento: {
    name: 'おべんとう', box: 'pill', pic: 'frame',
    frame: () => frameStd(5, 1),
    header() {
      let d = '', t = '';
      d += RR(160, 18, 36, 28, 4, { w: 1 }) + RR(163, 21, 30, 22, 2, { w: 0.5 }) + L(178, 21, 178, 43, 0.5) + L(178, 32, 193, 32, 0.5);
      d += P('M166,40 L170.5,24 L175,40 Z', { w: 0.6 }) + RR(168, 35, 5, 5, 0.4, { w: 0, fill: 'HATCH' });
      d += RR(181, 24, 9, 5, 1.5, { w: 0.5 }) + E(185.5, 37, 4.4, 3, { w: 0.5 });
      d += L(152, 44, 158, 16, 0.8) + L(155, 45, 161, 17, 0.8);
      d += P('M14,44 Q14,22 28,18 Q24,30 30,44 Z', { w: 0.7 }) + P('M17,42 Q20,30 26,22', { fill: 'none', w: 0.35 });
      t += drawTitle(96, 36, 118, 12);
      return { d, t, top: 54 };
    },
  },
});
