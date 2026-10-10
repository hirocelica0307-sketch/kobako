'use strict';
/* =========================================================
   ばめんの ある デザイン（絵の 中に 書く ところが ある）
   ds.scene ＝ しゅるい、ds.slots ＝ [{ lab, n, end }]、ds.title ＝ タイトル
   ========================================================= */

// 書く ところ（ラベル ＋ 点線）
function slotT(x, y, w, h, s, o = {}) {
  if (!s) return '';
  let t = '';
  const sz = o.size || (G === 'low' ? 4.2 : 3.8);
  const cx = o.center;
  if (s.lab) t += R(cx ? x + w / 2 : x + 3, y + sz + 1.4, s.lab, { size: sz, font: F_T, anchor: cx ? 'middle' : 'start', rsize: Math.max(1.4, sz * 0.36) });
  const y0 = y + (s.lab ? sz + 2.5 : 0);
  t += fillLines(x + 3, x + w - 3 - (s.end ? rtw(s.end, 4, F_T) + 2 : 0), y0, y + h, { end: s.end });
  return t;
}
const sTitle = (ds) => ds.title || CATS[ds.cat].title[G];
function sceneStart(ds, ty = 29, maxW = 170, size = 12) {
  TITLE = { src: sTitle(ds), en: CATS[ds.cat].en, kakari: false };
  return drawTitle(105, ty, maxW, size);
}
function tailTo(bx, by, tx, ty) { // ふきだしの しっぽ（白で ふちを けす）
  const a = Math.atan2(ty - by, tx - bx), w = 3.2;
  const p1 = [bx + w * Math.sin(a), by - w * Math.cos(a)], p2 = [bx - w * Math.sin(a), by + w * Math.cos(a)];
  return P(`M${n(p1[0])},${n(p1[1])} L${n(tx)},${n(ty)} L${n(p2[0])},${n(p2[1])}`, { w: 0.8 }) + P(`M${n(p1[0])},${n(p1[1])} L${n(p2[0])},${n(p2[1])}`, { fill: 'none', w: 1.4, stroke: '#fff' });
}

const SCENES = {
  /* ---- 階段を のぼって ゴールへ ---- */
  stairs(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    const N = 6, run = (194 - 16) / N, rise = 11, base = 178;
    let path = `M16,284 V${base}`;
    for (let i = 0; i < N; i++) { path += ` H${n(16 + (i + 1) * run)}`; if (i < N - 1) path += ` V${base - (i + 1) * rise}`; }
    d += P(path + ' V284 Z', { w: 1 });
    for (let i = 0; i < N; i++) d += L(16 + i * run + 1.5, base - i * rise + 2.6, 16 + (i + 1) * run - 1.5, base - i * rise + 2.6, 0.35);
    // ゴール
    const topY = base - (N - 1) * rise, gx = 16 + (N - 0.4) * run;
    d += L(gx, topY, gx, topY - 30, 1) + P(`M${n(gx)},${n(topY - 30)} L${n(gx - 22)},${n(topY - 25)} L${n(gx)},${n(topY - 19)} Z`, { w: 0.7 });
    t += T(gx - 9, topY - 23.3, 'GOAL', { size: 3.4, font: F_T, anchor: 'middle' });
    // 子ども（0〜3だんめ）
    const k = Math.min(3, ds.step ?? 2), s = 0.7;
    const fy = base - k * rise - 2.2, fx = 16 + (k + 0.62) * run;
    const hx = fx + 10.3, hy = fy - 31.5 * s - 44 * s;
    d += kidD(hx, fy - 31.5 * s, s, { pose: 'climb', headband: ds.headband });
    d += P(`M${n(fx - 10)},${n(fy - 30)} h-8 M${n(fx - 8)},${n(fy - 22)} h-10 M${n(fx - 10)},${n(fy - 14)} h-7`, { fill: 'none', w: 0.6 });
    // ふきだし（ひだり うえ）と かんばん（みぎ うえ）
    d += RR(16, 50, 76, 50, 10, { w: 0.9 }) + tailTo(70, 99.5, hx - 9, hy);
    t += slotT(19, 52, 70, 46, ds.slots[0]);
    const sx = k >= 3 ? hx + 12 : 112;
    d += RR(sx, 50, 194 - sx, 38, 3, { w: 0.9 });
    t += slotT(sx + 1, 51, 194 - sx - 2, 36, ds.slots[1], { size: k >= 3 ? 3.4 : undefined });
    d += sparkle(98, 60, 2.6) + star(104, 74, 2, { w: 0.5 });
    // かいだんの 中
    t += slotT(22, 190, 166, 44, ds.slots[2]);
    d += L(22, 238, 188, 238, 0.4, 'stroke-dasharray="1.6 1.2"');
    t += slotT(22, 241, 166, 42, ds.slots[3]);
    return wrap(d, t);
  },

  /* ---- ききゅう（ふうせんの 中に 書く） ---- */
  balloon(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    const B = [[58, 96, 40], [152, 92, 38], [105, 156, 42]];
    B.forEach(([x, y, r], i) => {
      d += C(x, y, r, { w: 1 });
      d += P(`M${n(x - r * 0.62)},${n(y - r * 0.55)} A${n(r * 0.85)},${n(r * 0.85)} 0 0 1 ${n(x - r * 0.1)},${n(y - r * 0.82)}`, { fill: 'none', w: 0.5 });
      d += C(x + r * 0.7, y - r * 0.55, 1.2, { w: 0.4 }) + C(x + r * 0.62, y + r * 0.64, 0.9, { w: 0.4 });
      void i;
    });
    t += slotT(28, 66, 60, 50, ds.slots[0], { center: true });
    t += slotT(124, 62, 56, 50, ds.slots[1], { center: true });
    t += slotT(73, 130, 64, 52, ds.slots[2], { center: true });
    // かご と 子ども
    d += L(86, 194, 92, 222, 0.6) + L(124, 194, 118, 222, 0.6) + L(98, 197, 100, 222, 0.5) + L(112, 197, 110, 222, 0.5);
    d += kidD(103, 236, 0.42, { pose: 'wave' });
    d += RR(86, 222, 38, 22, 3, { w: 0.9 });
    for (let x = 92; x < 124; x += 6) d += L(x, 223, x, 243, 0.35);
    d += L(87, 230, 123, 230, 0.35) + L(87, 237, 123, 237, 0.35);
    // くも・とり
    d += cloudShape(38, 236, 46, 14, { w: 0.7 }) + cloudShape(176, 222, 34, 12, { w: 0.7 });
    d += P('M164,140 q3,-3 6,0 q3,-3 6,0 M176,152 q2.4,-2.4 4.8,0 q2.4,-2.4 4.8,0 M22,150 q3,-3 6,0 q3,-3 6,0', { fill: 'none', w: 0.6 });
    d += sparkle(196 - 6, 60, 2.6) + sparkle(20, 66, 2.2);
    // した の おび
    d += RR(16, 252, 178, 32, 4, { w: 0.9 });
    t += slotT(19, 253, 172, 30, ds.slots[3]);
    if (ds.shout) t += T(190, 204, ds.shout, { size: 5, font: F_T, hollow: true, anchor: 'end' });
    return wrap(d, t);
  },

  /* ---- マンガの コマ ---- */
  manga(ds) {
    let d = RR(8, 8, 194, 281, 0, { w: 1.4 }), t = '';
    d += RR(14, 13, 24, 9, 1, { w: 0.6 });
    t += T(26, 19.4, G === 'low' ? 'マンガふう' : 'マンガ風', { size: 3, anchor: 'middle', font: F_T });
    TITLE = { src: sTitle(ds), en: '', kakari: false };
    t += drawTitle(42, 23, 150, 11, { anchor: 'start' });
    t += nameRow(16, 34, 178);
    const K = (x, y, w, h) => RR(x, y, w, h, 0, { w: 1.4 });
    // コマ1：学校
    d += K(14, 40, 88, 62) + heroAt('school', 16, 48, 52, 52);
    d += RR(62, 44, 37, 14, 1, { w: 0.6 });
    t += fitR(80.5, 52.6, ds.intro || (G === 'low' ? 'がっこうの はじまり…' : '{新学期|しんがっき}の はじまり…'), 33, 3.2, { anchor: 'middle' });
    // コマ2：かんがえる
    d += K(106, 40, 90, 62);
    d += kidD(166, 90, 0.42, { pose: 'think', flip: true });
    d += C(140, 66, 2, { w: 0.5 }) + C(134, 60, 3, { w: 0.5 });
    t += T(124, 58, '？', { size: 7, font: F_T, hollow: true }) + T(184, 56, '？', { size: 5, font: F_T, hollow: true });
    d += RR(109, 44, 34, 11, 1, { w: 0.6 });
    t += T(126, 51.6, 'そうだな、まずは…', { size: 2.7, anchor: 'middle' });
    // コマ3：ドーン（いちばん 大きい）
    d += K(14, 106, 182, 66);
    let lines = '';
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; lines += L(105 + 70 * Math.cos(a), 139 + 26 * Math.sin(a), 105 + 160 * Math.cos(a), 139 + 70 * Math.sin(a), i % 2 ? 0.25 : 0.45); }
    d += clipRect(14, 106, 182, 66, lines);
    const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = i % 2 ? 1 : 1.1; pts.push([105 + 80 * r * Math.cos(a), 139 + 28 * r * Math.sin(a)]); }
    d += POLY(pts, { w: 0.9 });
    t += slotT(40, 115, 130, 46, { ...ds.slots[0], end: ds.slots[0].end ?? 'です！' });
    // コマ4：ふきだし 2つ
    d += K(14, 176, 182, 52);
    d += E(57, 204, 40, 20, { w: 0.8 }) + E(153, 204, 40, 20, { w: 0.8 });
    t += slotT(26, 188, 62, 30, ds.slots[1], { center: true, size: 3.4 });
    t += slotT(122, 188, 62, 30, ds.slots[2], { center: true, size: 3.4 });
    // コマ5：きめポーズ
    d += K(14, 232, 182, 52);
    let sp = '';
    for (let i = 0; i < 9; i++) sp += L(100 + i * 4, 240 + i * 4.4, 196, 240 + i * 4.4 + (i % 2), 0.35);
    d += clipRect(14, 232, 182, 52, sp);
    d += kidD(50, 266, 0.5, { pose: 'point', headband: ds.headband });
    t += T(152, 264, ds.shout || (G === 'low' ? 'がんばるぞ！' : 'やってやるぞ！'), { size: 10, font: F_T, hollow: true, anchor: 'middle' });
    return wrap(d, t);
  },

  /* ---- ふね（ほに 書く） ---- */
  ship(ds) {
    let d = frameStd(5, 1), t = '';
    TITLE = { src: sTitle(ds), en: '', kakari: false };
    t += drawTitle(18, 30, 120, 12, { anchor: 'start' });
    d += sunIcon(182, 24, 8);
    t += nameRow(18, 42, 174);
    // マスト と ほ
    d += L(118, 56, 118, 198, 1.6) + L(49, 88, 49, 198, 1.2);
    d += P('M118,56 L138,60 L118,66 Z', { w: 0.7 }) + P('M49,88 L64,91 L49,95 Z', { w: 0.6 });
    d += P('M80,66 Q118,60 156,66 Q162,124 156,184 Q118,178 80,184 Q86,124 80,66 Z', { w: 1 });
    d += P('M24,98 Q49,92 74,98 Q78,142 74,188 Q49,184 24,188 Q20,142 24,98 Z', { w: 1 });
    t += slotT(87, 72, 64, 106, ds.slots[0], { center: true });
    t += slotT(27, 103, 44, 80, ds.slots[1], { center: true, size: 3.4 });
    // せん体
    d += P('M14,196 H196 L182,246 H28 Z', { w: 1.1 });
    d += L(14, 202, 194.3, 202, 0.5);
    t += slotT(34, 205, 142, 38, ds.slots[2]);
    // 子ども（へさきで ゆびさす）
    d += kidD(176, 178, 0.48, { pose: 'point' });
    // うみ
    for (let k = 0; k < 4; k++) {
      let wv = `M10,${252 + k * 9}`;
      for (let x = 10; x < 200; x += 12) wv += ' q3,-3 6,0 q3,3 6,0';
      d += P(wv, { fill: 'none', w: 0.55 });
    }
    d += fish(40, 276, 1.2) + fish(160, 270, 1, true) + P('M148,150 q3,-3 6,0 q3,-3 6,0 M168,128 q2.4,-2.4 4.8,0 q2.4,-2.4 4.8,0', { fill: 'none', w: 0.6 });
    return wrap(d, t);
  },

  /* ---- ロケット（まどに じぶんの かお） ---- */
  rocket(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds, 28, 150, 12);
    t += nameRow(18, 40, 174);
    for (const [x, y, r] of [[24, 52, 2.4], [190, 50, 2.6], [30, 180, 2], [184, 176, 2.2], [20, 258, 2], [192, 256, 2.4]]) d += star(x, y, r, { w: 0.5 });
    d += P('M60,182 L34,240 L60,228 Z M150,182 L176,240 L150,228 Z', { w: 1 });
    d += P('M76,234 Q88,262 105,272 Q122,262 134,234 Z', { w: 0.9 }) + P('M88,234 Q96,252 105,258 Q114,252 122,234 Z', { w: 0.6 });
    d += P('M105,48 C134,62 150,96 150,130 V234 H60 V130 C60,96 76,62 105,48 Z', { w: 1.2 });
    d += L(60, 132, 150, 132, 0.5);
    d += C(105, 100, 24, { w: 1 }) + C(105, 100, 20, { w: 0.6 });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; d += C(105 + 22 * Math.cos(a), 100 + 22 * Math.sin(a), 0.7, { w: 0.35 }); }
    d += P('M89,118 Q90,108 105,107 Q120,108 121,118', { w: 0.7 }) + faceCircle(105, 96, 9);
    d += RR(68, 138, 74, 90, 4, { w: 0.5, fill: 'none', dash: '1 1' });
    t += slotT(70, 140, 70, 86, ds.slots[0], { center: true });
    // まわりの はこ
    d += RR(14, 58, 42, 112, 5, { w: 0.9 }) + RR(154, 58, 42, 112, 5, { w: 0.9 });
    d += C(35, 58, 5, { w: 0.6 }) + P('M28,58 q7,-4 14,0', { fill: 'none', w: 0.4 });
    d += C(175, 58, 5, { w: 0.6 }) + star(175, 58, 2.6, { w: 0.4 });
    t += slotT(15, 66, 40, 102, ds.slots[1], { center: true, size: 3.3 });
    t += slotT(155, 66, 40, 102, ds.slots[2], { center: true, size: 3.3 });
    d += RR(14, 272, 182, 12, 3, { w: 0.8 });
    if (ds.slots[3]) t += R(18, 280, ds.slots[3].lab, { size: 3.4, font: F_T }) + dotL(20 + rtw(ds.slots[3].lab, 3.4, F_T), 192, 281);
    return wrap(d, t);
  },

  /* ---- ステージで えんそう ---- */
  stage(ds) {
    let d = RR(8, 8, 194, 281, 4, { w: 1 }), t = '';
    d += P('M10,136 H200 V148 H10 Z', { w: 0.8 });
    for (let x = 22; x < 200; x += 12) d += L(x, 140, x, 148, 0.35);
    d += E(105, 136, 36, 4.5, { fill: 'none', w: 0.45, dash: '1 1' });
    const curtain = tf => P('M10,30 H50 C46,56 38,80 33,96 C42,110 46,124 48,136 H10 Z', { w: 0.9, tf }) +
      P('M21,30 C23,60 25,84 27,96 C27,110 23,124 21,136 M36,30 C37,54 35,78 31,96 C36,112 37,124 37,136', { fill: 'none', w: 0.45, tf }) + RR(24, 93.5, 12, 5, 2.2, { w: 0.7, tf });
    d += curtain('') + curtain('translate(210 0) scale(-1 1)');
    let val = 'M10,10 H200 V27';
    for (let k = 0; k < 10; k++) val += ' a9.5,7 0 0 1 -19,0';
    d += P(val + ' Z', { w: 0.9 });
    TITLE = { src: sTitle(ds), en: '', kakari: false };
    t += drawTitle(105, 24, 170, 10);
    // 子ども と がっき
    const inst = ds.inst || 'recorder';
    const pose = { recorder: 'recorder', keyboard: 'keyboard', drum: 'drum', sing: 'sing' }[inst];
    const prop = { recorder: PROPS.recorder, keyboard: PROPS.keyboard, drum: PROPS.drum, sing: PROPS.mic }[inst];
    d += kidD(inst === 'keyboard' || inst === 'drum' ? 92 : 105, 108, 0.72, { pose, prop });
    d += note(60, 62, 1.1) + note(148, 56, 1.1, true) + note(160, 92, 1) + note(56, 104, 1, true) + note(132, 40, 0.8);
    d += sparkle(78, 48, 2.4) + sparkle(140, 116, 2);
    t += nameRow(18, 157, 174);
    // した の はこ（がくふ ふう）
    const box = (x, y, w, h) => { let s = RR(x, y, w, h, 3, { w: 0.9 }); for (let i = 0; i < 3; i++) s += L(x + w - 40, y + 3 + i * 1.5, x + w - 4, y + 3 + i * 1.5, 0.25); return s + note(x + w - 12, y + 6.6, 0.5); };
    d += box(16, 163, 178, 34) + box(16, 202, 86, 44) + box(108, 202, 86, 44) + box(16, 251, 178, 33);
    t += slotT(18, 164, 150, 32, ds.slots[0]);
    t += slotT(18, 203, 82, 42, ds.slots[1]);
    t += slotT(110, 203, 82, 42, ds.slots[2]);
    t += slotT(18, 252, 174, 31, ds.slots[3]);
    return wrap(d, t);
  },

  /* ---- ゴールテープ（ラストスパート） ---- */
  finish(ds) {
    let d = frameStd(5, 1), t = '';
    d += P('M8,12 Q105,26 202,12', { fill: 'none', w: 0.5 });
    for (let i = 1; i < 14; i++) { const tt = i / 14, x = 8 + 194 * tt, y = 12 + 14 * 4 * tt * (1 - tt) / 1; d += POLY([[x - 3.6, y], [x + 3.6, y + 0.2], [x, y + 7]], { w: 0.45 }); }
    t += sceneStart(ds, 38, 170, 12);
    t += nameRow(18, 49, 174);
    // トラック
    d += P('M10,152 Q105,128 200,140', { fill: 'none', w: 0.7 }) + P('M10,138 Q105,114 200,126', { fill: 'none', w: 0.4, dash: '2 1.6' }) + P('M10,124 Q105,100 200,112', { fill: 'none', w: 0.4, dash: '2 1.6' });
    // ゴール
    d += L(126, 78, 126, 140, 1.2) + L(186, 72, 186, 134, 1.2);
    d += RR(122, 62, 68, 12, 2, { w: 0.9 });
    t += T(156, 70.6, 'GOAL', { size: 5, font: F_T, anchor: 'middle' });
    const k = kid(160, 112, 0.6, { pose: 'sprint', headband: true });
    const chest = [k.J.sh[0] + 3, k.J.sh[1] + 6];
    d += P(`M126,104 Q${n(chest[0] - 18)},${n(chest[1] + 6)} ${n(chest[0] - 3)},${n(chest[1])} l1,2.4 Q${n(chest[0] - 18)},${n(chest[1] + 9)} 126,107 Z`, { w: 0.5 });
    d += P(`M186,100 Q${n(chest[0] + 18)},${n(chest[1] + 4)} ${n(chest[0] + 3)},${n(chest[1] - 1)} l-1,2.4 Q${n(chest[0] + 18)},${n(chest[1] + 7)} 186,103 Z`, { w: 0.5 });
    d += k.d;
    d += P('M110,90 h-14 M112,100 h-18 M110,110 h-12', { fill: 'none', w: 0.6 });
    t += T(64, 90, ds.shout || (G === 'low' ? 'ラストスパート！' : 'ラストスパート！'), { size: 8.5, font: F_T, hollow: true, anchor: 'middle', rot: -6 });
    d += confetti([[30, 66, 0], [48, 104, 2], [96, 70, 1], [196, 90, 3], [20, 120, 1], [112, 128, 0]]);
    // した：おうだんまく と ゼッケン
    d += RR(16, 160, 178, 44, 4, { w: 1 }) + C(16, 166, 2.4, { w: 0.6 }) + C(194, 166, 2.4, { w: 0.6 });
    t += slotT(20, 161, 170, 42, ds.slots[0]);
    for (const x of [16, 108]) {
      d += RR(x, 210, 86, 74, 3, { w: 1 });
      for (const [cx, cy] of [[x + 5, 215], [x + 81, 215], [x + 5, 279], [x + 81, 279]]) d += C(cx, cy, 1.6, { w: 0.5 });
    }
    t += slotT(19, 214, 80, 68, ds.slots[1]);
    t += slotT(111, 214, 80, 68, ds.slots[2]);
    return wrap(d, t);
  },

  /* ---- 山のぼり ---- */
  mountain(ds) {
    let d = frameStd(5, 1), t = '';
    TITLE = { src: sTitle(ds), en: '', kakari: false };
    t += drawTitle(18, 30, 112, 11, { anchor: 'start' });
    t += nameRow(18, 41, 174);
    d += sunIcon(24, 64, 7) + cloudShape(64, 60, 30, 9, { w: 0.6 });
    d += P('M10,284 V236 L74,152 L96,170 L140,96 L200,196 V284 Z', { w: 1.1 });
    d += P('M128,116 L140,96 L152,116 L146,112 L140,120 L134,112 Z', { w: 0.6 });
    d += P('M40,234 C90,236 150,262 120,240 S60,218 96,200 S150,178 128,158 S118,128 138,104', { fill: 'none', w: 0.9, dash: '2.4 2' });
    d += kidD(140, 78, 0.48, { pose: 'flag', prop: PROPS.flag });
    t += T(160, 52, ds.shout || 'ゴール！', { size: 6, font: F_T, hollow: true });
    const sign = (x, y, w, h, s) => { d += L(x + w / 2, y + h, x + w / 2, y + h + 10, 1.2) + RR(x, y, w, h, 2, { w: 0.9 }); t += slotT(x + 1, y + 1, w - 2, h - 2, s, { size: 3.4 }); };
    sign(14, 92, 64, 44, ds.slots[0]);
    sign(130, 150, 66, 44, ds.slots[1]);
    sign(14, 176, 66, 44, ds.slots[2]);
    d += RR(16, 236, 178, 48, 3, { w: 0.9 });
    t += slotT(19, 237, 172, 46, ds.slots[3]);
    return wrap(d, t);
  },

  /* ---- せいちょうの 木 ---- */
  tree(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    d += P('M92,276 C96,240 94,214 88,196 L100,190 L104,206 L112,190 L122,196 C116,214 114,240 118,276 Z', { w: 1 });
    const blobs = [[105, 116, 60], [56, 130, 40], [154, 130, 40], [80, 82, 34], [132, 82, 34], [105, 168, 34]];
    blobs.forEach(([x, y, r]) => { d += C(x, y, r, { w: 1 }); });
    blobs.forEach(([x, y, r]) => { d += C(x, y, r - 1.2, { w: 0, fill: '#fff' }); });
    const fr = [[54, 100], [105, 78], [156, 100], [72, 150], [138, 150]];
    fr.forEach(([x, y], i) => {
      d += C(x, y, 22, { w: 0.9 }) + P(`M${x},${y - 22} q2,-6 7,-7 M${x},${y - 22} q-3,-4 -7,-3`, { fill: 'none', w: 0.6 });
      t += slotT(x - 18, y - 16, 36, 34, ds.slots[i], { center: true, size: 3.1 });
    });
    d += L(10, 276, 200, 276, 0.8);
    d += kidD(40, 244, 0.5, { pose: 'water', prop: PROPS.can });
    for (const x of [64, 150, 176]) d += P(`M${x},276 v-6 M${x},272 q-4,-4 -6,-1 M${x},271 q4,-5 6,-2`, { fill: 'none', w: 0.6 });
    d += RR(126, 210, 70, 60, 3, { w: 0.9 }) + L(161, 270, 161, 276, 1);
    t += slotT(128, 211, 66, 58, ds.slots[5], { size: 3.4 });
    return wrap(d, t);
  },

  /* ---- 本を よむ ---- */
  reading(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    // くも（かんそう）
    d += P('M98,58 Q100,46 116,48 Q126,38 142,44 Q156,36 170,46 Q190,44 192,62 Q200,76 192,92 Q196,112 178,118 Q170,132 150,126 Q136,136 120,126 Q100,130 98,114 Q84,104 92,88 Q84,70 98,58 Z', { w: 1 });
    t += slotT(104, 54, 84, 66, ds.slots[0], { center: true });
    d += C(88, 124, 4, { w: 0.7 }) + C(80, 134, 2.6, { w: 0.6 });
    // 本の 山 と 子ども
    d += RR(16, 238, 64, 12, 2, { w: 0.9 }) + RR(20, 226, 58, 12, 2, { w: 0.9 }) + RR(14, 250, 68, 14, 2, { w: 0.9 });
    d += L(26, 226, 26, 238, 0.4) + L(70, 238, 70, 250, 0.4) + L(24, 250, 24, 264, 0.4);
    d += kidD(46, 205, 0.6, { pose: 'read', prop: PROPS.book });
    d += L(10, 264, 90, 264, 0.6);
    // 左上：おすすめ
    d += RR(16, 52, 70, 56, 4, { w: 0.9 });
    const sl = ds.slots[3] || { lab: G === 'low' ? 'おすすめ ど' : 'おすすめ{度|ど}' };
    t += R(51, 62, sl.lab, { size: 3.6, font: F_T, anchor: 'middle' });
    for (let i = 0; i < 5; i++) d += star(26 + i * 12.5, 74, 5, { w: 0.6 });
    t += slotT(18, 82, 66, 24, sl.lines ? { lab: '', n: 1 } : null);
    // ひらいた 本（題名 ＋ 絵）
    d += PIC.page(94, 140, 100, 136);
    t += slotT(98, 148, 44, 124, ds.slots[1], { size: 3.4 });
    t += R(169, 152, ds.slots[2] ? ds.slots[2].lab : '', { size: 3.4, font: F_T, anchor: 'middle' });
    d += RR(148, 158, 42, 108, 1, { w: 0.35, fill: 'none', dash: '1 1' });
    return wrap(d, t);
  },

  /* ---- なわとび ---- */
  jump(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    d += kidD(56, 138, 0.82, { pose: 'jump', prop: PROPS.rope });
    d += L(14, 196, 98, 196, 0.8) + E(56, 196, 18, 2.2, { fill: 'HATCH', w: 0.3 });
    t += T(26, 70, G === 'low' ? 'ぴょん！' : 'ピョン！', { size: 6, font: F_T, hollow: true, rot: -10 });
    d += P('M86,170 l6,-2 M88,178 l7,0 M24,170 l-6,-2 M22,178 l-7,0', { fill: 'none', w: 0.6 });
    d += RR(104, 52, 90, 40, 4, { w: 0.9 });
    t += slotT(106, 53, 86, 38, ds.slots[0]);
    d += RR(104, 98, 90, 98, 4, { w: 0.9 });
    t += R(107, 104.5, ds.slots[1].lab, { size: 3.6, font: F_T });
    const st = SEC.stamps.fill({ n: ds.stampN || 12, cols: 3, goalEvery: 4 }, 104, 106, 90, 196);
    d += st.d; t += st.t;
    d += RR(16, 204, 178, 80, 4, { w: 0.9 });
    const st2 = SEC.stamps.fill({ n: 16, cols: 8, goalEvery: 8 }, 16, 212, 178, 254);
    t += R(19, 210.5, ds.slots[2].lab, { size: 3.6, font: F_T });
    d += st2.d; t += st2.t;
    t += slotT(19, 254, 172, 29, ds.slots[3]);
    return wrap(d, t);
  },

  /* ---- 手を ふって じこしょうかい ---- */
  wave(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    d += kidD(52, 200, 1.0, { pose: 'wave' });
    d += P('M22,146 q-4,-6 -2,-12 M16,150 q-6,-8 -4,-18', { fill: 'none', w: 0.6 }) + sparkle(84, 112, 3) + heart(24, 214, 3);
    d += L(14, 238, 96, 238, 0.6);
    d += RR(16, 50, 74, 50, 8, { w: 0.9 });
    t += slotT(18, 51, 70, 48, ds.slots[0]);
    const bubbles = [[100, 50, 46], [100, 102, 46], [100, 154, 46]];
    bubbles.forEach(([x, y, h], i) => { d += RR(x, y, 94, h, 8, { w: 0.9 }) + tailTo(x, y + h / 2, x - 9, y + h / 2 + 6); t += slotT(x + 2, y + 1, 90, h - 2, ds.slots[i + 1]); });
    d += RR(16, 244, 178, 40, 4, { w: 0.9 });
    t += slotT(19, 245, 172, 38, ds.slots[4]);
    return wrap(d, t);
  },

  /* ---- バス（えんそく） ---- */
  bus(ds) {
    let d = frameStd(5, 1), t = sceneStart(ds);
    t += nameRow(18, 41, 174);
    d += sunIcon(184, 58, 7) + P('M10,150 L40,104 L62,128 L90,92 L128,150 Z', { w: 0.6 }) + cloudShape(130, 60, 30, 9, { w: 0.6 });
    d += tree(150, 150, 1.2) + tree(170, 150, 0.9);
    d += RR(14, 82, 150, 70, 9, { w: 1.2 });
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 24;
      d += RR(x, 90, 20, 20, 3, { w: 0.8 });
      d += faceCircle(x + 10, 98, 5) + P(`M${x + 3},110 Q${x + 10},103 ${x + 17},110`, { w: 0.5 });
    }
    d += RR(142, 90, 16, 38, 2, { w: 0.8 }) + L(150, 90, 150, 128, 0.4);
    d += RR(18, 116, 118, 30, 2, { w: 0.6 });
    t += slotT(19, 116, 116, 30, ds.slots[0], { size: 3.4 });
    d += C(42, 154, 9, { w: 1.1 }) + C(42, 154, 3.6, { w: 0.6 }) + C(138, 154, 9, { w: 1.1 }) + C(138, 154, 3.6, { w: 0.6 });
    d += L(10, 164, 200, 164, 0.9) + P('M10,172 H200', { fill: 'none', w: 0.5, dash: '6 4' });
    d += L(186, 164, 186, 118, 1) + RR(172, 98, 28, 20, 2, { w: 0.9 });
    t += T(186, 110.5, G === 'low' ? 'えんそく' : '遠足', { size: 3.6, font: F_T, anchor: 'middle' });
    d += RR(16, 180, 178, 50, 4, { w: 0.9 }) + RR(16, 236, 86, 48, 4, { w: 0.9 }) + RR(108, 236, 86, 48, 4, { w: 0.9 });
    t += slotT(19, 181, 172, 48, ds.slots[1]);
    t += slotT(19, 237, 80, 46, ds.slots[2]);
    t += slotT(111, 237, 80, 46, ds.slots[3]);
    return wrap(d, t);
  },

  /* ---- ケーキ（おたんじょうび） ---- */
  cake(ds) {
    let d = frameStd(6, 1), t = '';
    d += P('M8,12 Q105,26 202,12', { fill: 'none', w: 0.5 });
    for (let i = 1; i < 14; i++) { const tt = i / 14, x = 8 + 194 * tt, y = 12 + 14 * 4 * tt * (1 - tt); d += POLY([[x - 3.6, y], [x + 3.6, y + 0.2], [x, y + 7]], { w: 0.45 }); }
    t += sceneStart(ds, 36, 170, 12);
    t += nameRow(18, 47, 174);
    const tier = (x1, x2, y1, y2) => {
      let s = RR(x1, y1, x2 - x1, y2 - y1, 3, { w: 1 });
      let drip = `M${x1 + 1},${y1 + 2}`;
      for (let x = x1 + 1; x < x2 - 8; x += 9) drip += ` q2.2,${n(5 + (x % 3))} 4.5,0 q2.2,-3 4.5,0`;
      return s + P(drip, { fill: 'none', w: 0.5 });
    };
    for (const cx of [86, 105, 124]) d += RR(cx - 1.6, 58, 3.2, 12, 0.6, { w: 0.6 }) + P(`M${cx},51 q2.4,3 0,6 q-2.4,-2.4 0,-6 Z`, { w: 0.5 });
    d += tier(72, 138, 70, 98) + tier(55, 155, 98, 146) + tier(38, 172, 146, 204);
    d += E(105, 207, 84, 5, { w: 0.9 });
    t += slotT(74, 76, 62, 20, ds.slots[0], { center: true, size: 3.4 });
    t += slotT(59, 108, 92, 36, ds.slots[1], { center: true });
    t += slotT(42, 156, 126, 46, ds.slots[2], { center: true });
    d += kidD(188, 186, 0.36, { pose: 'jumpCheer' }) + kidD(22, 186, 0.36, { pose: 'cheer', flip: true });
    d += confetti([[28, 70, 0], [40, 90, 2], [170, 70, 1], [186, 92, 3], [20, 120, 1], [190, 130, 0]]);
    d += RR(16, 216, 178, 68, 4, { w: 0.9 });
    t += R(19, 222.5, ds.slots[3].lab, { size: 3.6, font: F_T });
    const y = SEC.yosegaki.fill({ n: 4, cols: 4 }, 16, 225, 178, 284);
    d += y.d; t += y.t;
    return wrap(d, t);
  },
};

/* =========================================================
   うごく 子どもの え（ヒーロー：ほかの デザインの かざり用）
   ========================================================= */
Object.assign(HEROES, {
  kidRun: () => kidD(50, 52, 0.95, { pose: 'run', headband: true }) + P('M14,40 h-10 M16,52 h-12 M14,64 h-9', { fill: 'none', w: 1 }),
  kidSprint: () => {
    const k = kid(52, 54, 0.95, { pose: 'sprint', headband: true });
    return L(10, 30, 10, 96, 1.6) + L(92, 26, 92, 92, 1.6) + P(`M10,52 Q${n(k.J.sh[0] - 14)},${n(k.J.sh[1] + 12)} ${n(k.J.sh[0])},${n(k.J.sh[1] + 6)}`, { fill: 'none', w: 1.6 }) + P(`M92,48 Q${n(k.J.sh[0] + 14)},${n(k.J.sh[1] + 10)} ${n(k.J.sh[0])},${n(k.J.sh[1] + 6)}`, { fill: 'none', w: 1.6 }) + k.d;
  },
  kidCheer: () => kidD(50, 54, 0.95, { pose: 'jumpCheer' }) + sparkle(14, 20, 5) + sparkle(88, 26, 4) + star(12, 66, 4) + star(90, 70, 3),
  kidClimb: () => {
    let s = P('M2,100 V82 H26 V66 H50 V50 H74 V34 H98 V100 Z', { w: 1 });
    s += kidD(46, 34, 0.62, { pose: 'climb' }) + L(92, 34, 92, 8, 1) + P('M92,8 L80,12 L92,16 Z', { w: 0.8 });
    return s;
  },
  kidRecorder: () => kidD(46, 54, 0.95, { pose: 'recorder', prop: PROPS.recorder }) + note(84, 30, 2) + note(76, 12, 1.6, true),
  kidKeyboard: () => kidD(36, 54, 0.92, { pose: 'keyboard', prop: PROPS.keyboard }) + note(84, 20, 2),
  kidDrum: () => kidD(34, 54, 0.92, { pose: 'drum', prop: PROPS.drum }) + note(86, 22, 1.8, true),
  kidSing: () => kidD(44, 54, 0.95, { pose: 'sing', prop: PROPS.mic }) + note(80, 24, 2) + note(88, 50, 1.6, true) + note(12, 20, 1.6),
  kidRead: () => kidD(44, 54, 0.95, { pose: 'read', prop: PROPS.book }) + sparkle(84, 20, 4),
  kidJump: () => kidD(50, 58, 0.78, { pose: 'jump', prop: PROPS.rope }),
  kidWave: () => kidD(50, 54, 0.95, { pose: 'wave' }) + P('M86,20 q6,4 6,12 M92,14 q8,6 8,18', { fill: 'none', w: 0.8 }),
  kidPoint: () => kidD(36, 54, 0.92, { pose: 'point' }) + P('M74,30 h18 M76,36 h20 M74,42 h16', { fill: 'none', w: 0.8 }),
  kidFlag: () => P('M2,100 L50,56 L98,100 Z', { w: 1 }) + kidD(50, 36, 0.5, { pose: 'flag', prop: PROPS.flag }),
  kidWater: () => kidD(36, 54, 0.92, { pose: 'water', prop: PROPS.can }) + P('M84,98 v-12 M84,90 q-6,-6 -10,-2 M84,88 q6,-8 10,-4', { fill: 'none', w: 0.9 }),
  kidWalk: () => kidD(50, 54, 0.95, { pose: 'walk', bag: true, cap: true }),
  kidThink: () => kidD(50, 54, 0.95, { pose: 'think' }) + T(78, 24, '？', { size: 16, font: F_T, hollow: true }),
  kidThrow: () => kidD(46, 56, 0.9, { pose: 'throw', prop: PROPS.ball, headband: true }) + P('M70,8 L90,8 L86,22 L74,22 Z', { w: 0.8 }) + L(80, 22, 80, 40, 1),
  kidPull: () => kidD(56, 56, 0.9, { pose: 'pull', headband: true }) + P('M70,30 C80,32 90,26 100,30', { fill: 'none', w: 3 }),
});
