'use strict';
/* =========================================================
   めあてカード こうぼう
   1まい ＝ A4（210×297mm）。SVG の 1 単位 ＝ 1mm。
   線は くろ・ぬりは しろ だけ（子どもが 色を ぬる）。
   ========================================================= */

const F_T = "'Mochiy Pop One','Zen Maru Gothic',sans-serif";    // タイトル
const F_L = "'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif"; // ラベル
const F_H = "'Klee One','Zen Maru Gothic',sans-serif";          // 手書きふう（学年・組）
const SW = 0.7;

const S = {
  nen: '', kumi: '', term: '', ruby: 'auto', wobble: true, cat: 'g1', cur: '', grade: 'all',
  kk: { theme: 'shop', items: { member: 1, meate: 1, work: 1, toban: 1, mark: 0, minna: 1, furi: 0 }, mem: 4, toban: 'youbi', name: '' },
  ichiran: { rows: 10, cols: 4 },
};

// いま かいて いる カードの 学年むけ（'low' 低学年 ／ 'high' 高学年）
let G = 'low';
// ふりがな：auto は 低学年だけ
const rubyOn = () => S.ruby === 'auto' ? G === 'low' : (S.ruby === 'on' || S.ruby === true);
// 書く 線の 間かく
const LG = () => G === 'low' ? 11 : 8.6;
// イラストを 縮小・拡大して おく ときに 線の 太さを そろえる
let SC = 1;
function scaled(x, y, s, fn) {
  const old = SC; SC = old * s;
  try { return `<g transform="translate(${n(x)} ${n(y)}) scale(${+s.toFixed(4)})">${fn()}</g>`; } finally { SC = old; }
}

/* ---------- きほんの 部品 ---------- */
const n = v => +(+v).toFixed(2);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(x, y, s, o = {}) {
  const sz = o.size || 4;
  let a = `x="${n(x)}" y="${n(y)}" font-size="${sz}" font-family="${o.font || F_L}" font-weight="${o.weight || 700}"`;
  if (o.anchor && o.anchor !== 'start') a += ` text-anchor="${o.anchor}"`;
  if (o.hollow) a += ` fill="#fff" stroke="#000" stroke-width="${n(sz * 0.05)}" stroke-linejoin="round"`;
  else if (o.fill) a += ` fill="${o.fill}"`;
  if (o.rot) a += ` transform="rotate(${o.rot} ${n(x)} ${n(y)})"`;
  if (o.ls) a += ` letter-spacing="${o.ls}"`;
  return `<text ${a}>${esc(String(s).replace(/ /g, '\u00a0'))}</text>`;
}
// 文字の はば。ブラウザで じっさいに はかる（はかれない ときは 全角＝1em で みつもる）
const MC = new Map();
let CV = null;
try { CV = document.createElement('canvas').getContext('2d'); } catch (e) { CV = null; }
function cw(ch, sz) {
  if (ch === ' ') return sz * 0.3;
  if (/[\x21-\x7e]/.test(ch)) return sz * 0.62;
  return sz;
}
function tw(str, sz, font = F_L, weight = 700) {
  str = String(str).replace(/ /g, '\u00a0');
  if (!CV) return [...str].reduce((a, c) => a + cw(c === '\u00a0' ? ' ' : c, sz), 0);
  const key = weight + '|' + font + '|' + str;
  if (!MC.has(key)) { CV.font = `${weight} 100px ${font}`; MC.set(key, CV.measureText(str).width / 100); }
  return MC.get(key) * sz;
}
const plain = src => src.replace(/\{([^|}]+)\|[^}]+\}/g, '$1');
const rtw = (src, sz, font = F_L, weight = 700) => tw(plain(src), sz, font, weight);
// ふりがな つき 文字。 '{学期|がっき}の めあて'
function R(x, y, src, o = {}) {
  const sz = o.size || 4;
  const segs = [];
  src.replace(/\{([^|}]+)\|([^}]+)\}|([^{]+)/g, (m, b, k, p) => { segs.push(b ? { t: b, k } : { t: p }); return m; });
  const font = o.font || F_L, wt = o.weight || 700;
  const total = segs.reduce((a, s) => a + tw(s.t, sz, font, wt), 0);
  let cx = o.anchor === 'middle' ? x - total / 2 : o.anchor === 'end' ? x - total : x;
  let out = '';
  for (const s of segs) {
    const w = tw(s.t, sz, font, wt);
    out += T(cx, y, s.t, { ...o, anchor: 'start' });
    if (s.k && rubyOn()) {
      const ks = o.rsize || Math.max(1.6, sz * 0.4);
      out += T(cx + w / 2, y - sz * (o.hollow ? 0.98 : 0.9), s.k, { size: ks, anchor: 'middle', font: F_L, weight: 700, fill: o.fill });
    }
    cx += w;
  }
  return out;
}

function attrs(o, defFill = '#fff') {
  let a = ` fill="${o.fill || defFill}" stroke="${o.stroke || '#000'}" stroke-width="${n((o.w ?? SW) / SC)}" stroke-linejoin="round" stroke-linecap="round"`;
  if (o.dash) a += ` stroke-dasharray="${o.dash}"`;
  if (o.tf) a += ` transform="${o.tf}"`;
  return a;
}
const P = (d, o = {}) => `<path d="${d}"${attrs(o)}/>`;
const C = (cx, cy, r, o = {}) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrs(o)}/>`;
const E = (cx, cy, rx, ry, o = {}) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"${attrs(o)}/>`;
const RR = (x, y, w, h, r, o = {}) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}"${attrs(o)}/>`;
const L = (x1, y1, x2, y2, w = SW, extra = '') => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#000" stroke-width="${n(w / SC)}" stroke-linecap="round"${extra ? ' ' + extra : ''}/>`;
const POLY = (pts, o = {}) => `<polygon points="${pts.map(p => n(p[0]) + ',' + n(p[1])).join(' ')}"${attrs(o)}/>`;
// 書く 線（点線）
const dotL = (x1, x2, y) => L(x1, y, x2, y, 0.5, 'stroke-dasharray="0.01 1.5"');
const wlines = (x1, x2, y0, count, gap) => { let s = ''; for (let i = 0; i < count; i++) s += dotL(x1, x2, y0 + i * gap); return s; };

/* ---------- かざり ---------- */
function starPts(cx, cy, r, ri = r * 0.45, k = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const rr = i % 2 ? ri : r, a = (rot + i * 180 / k) * Math.PI / 180;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
const star = (cx, cy, r, o = {}) => POLY(starPts(cx, cy, r, o.ri || r * 0.45), o);
const sparkle = (cx, cy, r, o = {}) =>
  P(`M${n(cx)},${n(cy - r)} Q${n(cx)},${n(cy)} ${n(cx + r)},${n(cy)} Q${n(cx)},${n(cy)} ${n(cx)},${n(cy + r)} Q${n(cx)},${n(cy)} ${n(cx - r)},${n(cy)} Q${n(cx)},${n(cy)} ${n(cx)},${n(cy - r)} Z`, { w: 0.5, ...o });
const heart = (cx, cy, s, o = {}) =>
  P(`M${n(cx)},${n(cy + s * 0.9)} C${n(cx - s * 1.4)},${n(cy)} ${n(cx - s * 0.9)},${n(cy - s * 1.1)} ${n(cx)},${n(cy - s * 0.35)} C${n(cx + s * 0.9)},${n(cy - s * 1.1)} ${n(cx + s * 1.4)},${n(cy)} ${n(cx)},${n(cy + s * 0.9)} Z`, { w: 0.5, ...o });
function note(x, y, s = 1, double = false) {
  // 8分音符（たま は くろ）
  let d = E(x, y, 1.7 * s, 1.15 * s, { fill: '#000', w: 0.3, tf: `rotate(-22 ${n(x)} ${n(y)})` });
  const sx = x + 1.5 * s;
  d += L(sx, y, sx, y - 8 * s, 0.5);
  if (double) {
    const x2 = sx + 5 * s;
    d += E(x2 - 1.5 * s, y - 1 * s, 1.7 * s, 1.15 * s, { fill: '#000', w: 0.3, tf: `rotate(-22 ${n(x2 - 1.5 * s)} ${n(y - s)})` });
    d += L(x2, y - s, x2, y - 9 * s, 0.5);
    d += P(`M${n(sx)},${n(y - 8 * s)} L${n(x2)},${n(y - 9 * s)} L${n(x2)},${n(y - 7.6 * s)} L${n(sx)},${n(y - 6.6 * s)} Z`, { fill: '#000', w: 0.3 });
  } else {
    d += P(`M${n(sx)},${n(y - 8 * s)} q${n(3 * s)},${n(2 * s)} ${n(2.6 * s)},${n(5 * s)}`, { fill: 'none', w: 0.5 });
  }
  return d;
}
function snow(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
    d += L(cx, cy, ex, ey, 0.5);
    const mx = cx + r * 0.55 * Math.cos(a), my = cy + r * 0.55 * Math.sin(a);
    for (const sgn of [-1, 1]) {
      const b = a + sgn * 0.7;
      d += L(mx, my, mx + r * 0.32 * Math.cos(b), my + r * 0.32 * Math.sin(b), 0.45);
    }
  }
  return d;
}
function ume(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * Math.PI / 180;
    d += C(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a), r * 0.5, { w: 0.5 });
  }
  d += C(cx, cy, r * 0.3, { w: 0.5 });
  for (let i = 0; i < 5; i++) {
    const a = (-54 + i * 72) * Math.PI / 180;
    d += L(cx, cy, cx + r * 0.55 * Math.cos(a), cy + r * 0.55 * Math.sin(a), 0.35);
  }
  return d;
}
// さくらの はなびら（ねもと が 0,0、さきが うえ。ながさ およそ 90）
const PETAL = 'M0,-14 C-14,-22 -34,-48 -26,-72 C-22,-84 -10,-90 -4,-86 L0,-79 L4,-86 C10,-90 22,-84 26,-72 C34,-48 14,-22 0,-14 Z';
const petal = (x, y, s, rot) => P(PETAL, { w: 0.5 / s, tf: `translate(${n(x)} ${n(y)}) rotate(${rot}) scale(${s}) translate(0 50)` });
function sakura(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 5; i++) d += P(PETAL, { w: 0.5 / (r / 88), tf: `translate(${n(cx)} ${n(cy)}) rotate(${i * 72}) scale(${n(r / 88, 3)})` });
  d += C(cx, cy, r * 0.17, { w: 0.45 });
  return d;
}
function wave(x, y, w = 4) {
  return P(`M${n(x)},${n(y)} q${n(w / 2)},${n(-w / 2)} ${n(w)},0 q${n(w / 2)},${n(-w / 2)} ${n(w)},0`, { fill: 'none', w: 0.5 });
}
function spiral(x, y, r) {
  return P(`M${n(x - r)},${n(y)} a${n(r)},${n(r)} 0 1 1 ${n(2 * r)},0 a${n(r * 0.72)},${n(r * 0.72)} 0 1 1 ${n(-r * 1.44)},0 a${n(r * 0.42)},${n(r * 0.42)} 0 1 1 ${n(r * 0.84)},0`, { fill: 'none', w: 0.55 });
}
function confetti(list) {
  let d = '';
  list.forEach(([x, y, k, rot], i) => {
    const tf = `rotate(${rot || (i * 37) % 90} ${n(x)} ${n(y)})`;
    if (k === 0) d += RR(x - 1.4, y - 0.8, 2.8, 1.6, 0.3, { w: 0.4, tf });
    else if (k === 1) d += C(x, y, 1, { w: 0.4 });
    else if (k === 2) d += POLY([[x, y - 1.4], [x + 1.3, y + 0.9], [x - 1.3, y + 0.9]], { w: 0.4, tf });
    else d += P(`M${n(x - 1.6)},${n(y)} q0.8,-1.2 1.6,0 q0.8,1.2 1.6,0`, { fill: 'none', w: 0.45, tf });
  });
  return d;
}
const screw = (x, y) => C(x, y, 2.2, { w: 0.6 }) + L(x - 1.3, y - 1.3, x + 1.3, y + 1.3, 0.5);
// かおを かく まる（てんせん）
const faceCircle = (cx, cy, r) => C(cx, cy, r, { fill: 'none', w: 0.65, dash: '1.8 1.4' });

function cat(cx, cy) {
  let d = '';
  d += E(cx, cy + 10, 7.5, 6.5, { w: 0.7 });                        // からだ
  d += E(cx + 9.5, cy - 2, 2.6, 3.2, { w: 0.6, tf: `rotate(25 ${cx + 9.5} ${cy - 2})` }); // ふる て
  d += P(`M${cx + 6},${cy + 6} Q${cx + 9},${cy + 2} ${cx + 9},${cy + 1}`, { fill: 'none', w: 0.6 });
  d += P(`M${cx - 8},${cy - 2} L${cx - 7.2},${cy - 11} L${cx - 1.8},${cy - 6.6} Z`, { w: 0.7 });
  d += P(`M${cx + 8},${cy - 2} L${cx + 7.2},${cy - 11} L${cx + 1.8},${cy - 6.6} Z`, { w: 0.7 });
  d += E(cx, cy, 9, 7.4, { w: 0.75 });
  d += C(cx - 3.3, cy - 0.6, 0.8, { fill: '#000', w: 0 }) + C(cx + 3.3, cy - 0.6, 0.8, { fill: '#000', w: 0 });
  d += P(`M${cx - 1.6},${cy + 1.8} q0.8,1.2 1.6,0 q0.8,1.2 1.6,0`, { fill: 'none', w: 0.45 });
  d += L(cx - 6, cy + 1.2, cx - 10, cy + 0.4, 0.35) + L(cx - 6, cy + 2.6, cx - 10, cy + 3.2, 0.35);
  d += L(cx + 6, cy + 1.2, cx + 10, cy + 0.4, 0.35) + L(cx + 6, cy + 2.6, cx + 10, cy + 3.2, 0.35);
  return d;
}
function randoseru(x, y) {
  let d = '';
  d += P(`M${x + 7},${y + 1} Q${x + 11},${y - 5} ${x + 15},${y + 1}`, { fill: 'none', w: 0.9 });
  d += RR(x, y, 22, 27, 4, { w: 0.8 });
  d += P(`M${x},${y + 6} Q${x},${y} ${x + 6},${y} H${x + 16} Q${x + 22},${y} ${x + 22},${y + 6} V${y + 17} Q${x + 22},${y + 21} ${x + 18},${y + 21} H${x + 4} Q${x},${y + 21} ${x},${y + 17} Z`, { w: 0.8 });
  d += P(`M${x + 2.5},${y + 6} Q${x + 2.5},${y + 2.5} ${x + 6},${y + 2.5} H${x + 16} Q${x + 19.5},${y + 2.5} ${x + 19.5},${y + 6} V${y + 16} Q${x + 19.5},${y + 18.5} ${x + 17},${y + 18.5} H${x + 5} Q${x + 2.5},${y + 18.5} ${x + 2.5},${y + 16} Z`, { fill: 'none', w: 0.35, dash: '0.8 0.8' });
  d += RR(x + 9, y + 18, 4, 6, 1, { w: 0.6 });
  return d;
}
function kite(cx, cy, s = 1, tail = 1) {
  let d = '';
  // しっぽ
  d += P(`M${n(cx)},${n(cy + 12 * s)} c${n(-4 * s)},${n(6 * s)} ${n(4 * s)},${n(8 * s)} 0,${n(14 * s)} c${n(-4 * s * tail)},${n(5 * s)} ${n(3 * s * tail)},${n(7 * s)} ${n(-1 * s)},${n(12 * s)}`, { fill: 'none', w: 0.5 });
  d += P(`M${n(cx - 2 * s)},${n(cy + 17 * s)} l${n(4 * s)},${n(2 * s)} m0,${n(-2 * s)} l${n(-4 * s)},${n(2 * s)}`, { fill: 'none', w: 0.5 });
  d += P(`M${n(cx)},${n(cy - 10 * s)} L${n(cx + 8 * s)},${n(cy)} L${n(cx)},${n(cy + 12 * s)} L${n(cx - 8 * s)},${n(cy)} Z`, { w: 0.7 });
  d += L(cx, cy - 10 * s, cx, cy + 12 * s, 0.4) + L(cx - 8 * s, cy, cx + 8 * s, cy, 0.4);
  return d;
}
function camera(x, y) {
  let d = '';
  d += RR(x + 3, y - 2.2, 6, 3, 0.8, { w: 0.6 });
  d += RR(x, y, 22, 15, 2.5, { w: 0.8 });
  d += C(x + 11, y + 7.5, 5.2, { w: 0.8 }) + C(x + 11, y + 7.5, 3, { w: 0.5 });
  d += C(x + 18.3, y + 3.3, 1.2, { w: 0.5 });
  return d;
}
function laurel(cx, cy, r, a0, a1, cnt) {
  let d = '';
  const rad = a => a * Math.PI / 180;
  const p = a => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const [sx, sy] = p(a0), [ex, ey] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  d += P(`M${n(sx)},${n(sy)} A${r},${r} 0 ${large} ${sweep} ${n(ex)},${n(ey)}`, { fill: 'none', w: 0.6 });
  for (let i = 1; i <= cnt; i++) {
    const a = a0 + (a1 - a0) * i / (cnt + 0.4);
    const [x, y] = p(a);
    const tang = a + (a1 > a0 ? 90 : -90);
    for (const side of [-1, 1]) {
      const off = side * 2.6, lx = x + off * Math.cos(rad(a)), ly = y + off * Math.sin(rad(a));
      d += E(lx, ly, 3.2, 1.35, { w: 0.5, tf: `rotate(${n(tang - side * 28)} ${n(lx)} ${n(ly)})` });
    }
  }
  return d;
}

/* 年・組・番・なまえ の 行 */
function nameRow(x, y, w, sz = 3.8) {
  let s = '', cx = x;
  const f = (lab, val, ww) => {
    s += L(cx, y + 1.2, cx + ww, y + 1.2, 0.4);
    if (val) s += T(cx + ww / 2, y - 0.2, val, { size: sz * 1.35, anchor: 'middle', font: F_H, weight: 600 });
    cx += ww + 0.8;
    s += R(cx, y, lab, { size: sz });
    cx += rtw(lab, sz) + 3;
  };
  f('{年|ねん}', S.nen, 9);
  f('{組|くみ}', S.kumi, 9);
  f('{番|ばん}', '', 9);
  const nm = G === 'high' ? '{名前|なまえ}' : 'なまえ';
  s += R(cx, y, nm, { size: sz });
  cx += rtw(nm, sz) + 1.5;
  s += L(cx, y + 1.2, x + w, y + 1.2, 0.4);
  return s;
}

let UID = 0;
function wrap(deco, text) {
  const id = ++UID;
  const fil = S.wobble ? ` filter="url(#wob${id})"` : '';
  deco = deco.replace(/HATCH/g, `url(#ht${id})`).replace(/DOTS/g, `url(#dt${id})`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm">
<defs>
<filter id="wob${id}" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="nz"/><feDisplacementMap in="SourceGraphic" in2="nz" scale="0.9" xChannelSelector="R" yChannelSelector="G"/></filter>
<pattern id="ht${id}" patternUnits="userSpaceOnUse" width="1.5" height="1.5" patternTransform="rotate(45)"><rect width="1.5" height="1.5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="1.5" stroke="#000" stroke-width="0.35"/></pattern>
<pattern id="dt${id}" patternUnits="userSpaceOnUse" width="2" height="2"><rect width="2" height="2" fill="#fff"/><circle cx="1" cy="1" r="0.3" fill="#000"/></pattern>
</defs>
<rect width="210" height="297" fill="#fff"/>
<g${fil}>${deco}</g>
<g>${text}</g>
</svg>`;
}

