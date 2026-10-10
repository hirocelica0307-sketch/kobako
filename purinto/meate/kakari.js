'use strict';
/* =========================================================
   係カードの こうもく（チェックで くみたて）
   ========================================================= */
const K_ITEMS = [
  { k: 'member', lab: 'メンバー', ui: 'メンバー' },
  { k: 'meate', lab: 'めあて', ui: 'めあて' },
  { k: 'work', lab: '{仕事|しごと} {内容|ないよう}', ui: '仕事内容' },
  { k: 'toban', lab: '{当番表|とうばんひょう}', ui: '当番表' },
  { k: 'mark', lab: '{係|かかり}の マーク', ui: '係の マーク（絵）' },
  { k: 'minna', lab: 'クラスの みんなへ', ui: 'クラスの みんなへ' },
  { k: 'kufu', lab: '{工夫|くふう}したい こと', ui: '工夫したい こと' },
  { k: 'furi', lab: 'ふりかえり', ui: 'ふりかえり（星を ぬる）' },
];
const K_TOBAN = [
  { k: 'youbi', lab: '曜日ごと（月〜金）' },
  { k: 'week', lab: '週ごと（1〜4しゅうめ）' },
  { k: 'check', lab: 'できたら ○（4しゅう×5日）' },
];
const K_PRESETS = {
  full: { member: 1, meate: 1, work: 1, toban: 1, mark: 0, minna: 1, kufu: 0, furi: 0 },
  notoban: { member: 1, meate: 1, work: 1, toban: 0, mark: 1, minna: 1, kufu: 0, furi: 0 },
  simple: { member: 1, meate: 1, work: 1, toban: 0, mark: 0, minna: 0, kufu: 0, furi: 0 },
  all: { member: 1, meate: 1, work: 1, toban: 1, mark: 1, minna: 1, kufu: 1, furi: 1 },
};

/* --- こうもくの なかみ（ラベルの 下の 場所に かく） --- */
function kLines(x1, x2, y0, y1) { return fillLines(x1, x2, y0, y1); }
const K_FILL = {
  member(x, y, w, b) {
    const k = S.kk.mem, cols = k <= 4 ? k : 3, cw2 = (w - 8) / cols;
    let d = '', t = '';
    for (let i = 0; i < k; i++) {
      const cx = x + 4 + (i % cols) * cw2, cy = y + 7 + Math.floor(i / cols) * 13;
      d += faceCircle(cx + 5.5, cy, 4.6);
      t += dotL(cx + 12, cx + cw2 - 3, cy + 3);
    }
    return { d, t };
  },
  meate(x, y, w, b) { return { d: '', t: kLines(x + 5, x + w - 5, y, b) }; },
  minna(x, y, w, b) { return { d: '', t: kLines(x + 5, x + w - 5, y, b) }; },
  work(x, y, w, b) {
    let d = '', t = '', i = 0;
    for (let yy = y + LG() * 0.8; yy <= b - 2.5; yy += LG()) {
      d += C(x + 7, yy - 1.6, 2.4, { w: 0.5 });
      t += T(x + 7, yy - 0.5, String(++i), { size: 2.8, anchor: 'middle', font: F_T });
      t += dotL(x + 11.5, x + w - 5, yy);
    }
    return { d, t };
  },
  mark(x, y, w, b) {
    const r = Math.min(w - 12, b - y - 10) / 2;
    return { d: C(x + w / 2, y + (b - y - 5) / 2, r, { fill: 'none', w: 0.6, dash: '1.8 1.4' }),
      t: T(x + w / 2, b - 2.5, 'マークを かこう', { size: 2.6, anchor: 'middle' }) };
  },
  furi(x, y, w, b) {
    let d = '', t = '';
    t += T(x + 5, y + 6, 'できた ど', { size: 3.4 });
    for (let i = 0; i < 5; i++) d += star(x + 28 + i * 9, y + 4.6, 3.8, { w: 0.55 });
    t += kLines(x + 5, x + w - 5, y + 4, b);
    return { d, t };
  },
  toban(x, y, w, b) {
    let d = '', t = '';
    const x1 = x + 4, x2 = x + w - 4, y1 = y + 2, y2 = b - 3;
    const days = ['{月|げつ}', '{火|か}', '{水|すい}', '{木|もく}', '{金|きん}'];
    if (S.kk.toban === 'check') {
      const lc = 14, cw3 = (x2 - x1 - lc) / 5, rh = (y2 - y1) / 5;
      d += RR(x1, y1, x2 - x1, y2 - y1, 1, { w: 0.7 });
      for (let i = 1; i < 5; i++) d += L(x1, y1 + i * rh, x2, y1 + i * rh, i === 1 ? 0.6 : 0.4);
      d += L(x1 + lc, y1, x1 + lc, y2, 0.6);
      for (let j = 1; j < 5; j++) d += L(x1 + lc + j * cw3, y1, x1 + lc + j * cw3, y2, 0.4);
      days.forEach((dd, j) => { t += R(x1 + lc + (j + 0.5) * cw3, y1 + rh / 2 + 1.4, dd, { size: 3.4, anchor: 'middle', rsize: 1.4 }); });
      for (let i = 1; i < 5; i++) t += T(x1 + lc / 2, y1 + (i + 0.5) * rh + 1.2, `${i}しゅう`, { size: 2.7, anchor: 'middle' });
      t += T(x2, b + 0.2, 'できたら ○を かこう', { size: 2.4, anchor: 'end' });
      return { d, t };
    }
    const rows = S.kk.toban === 'week' ? ['1しゅうめ', '2しゅうめ', '3しゅうめ', '4しゅうめ'] : days;
    const lc = S.kk.toban === 'week' ? 17 : 10;
    const rh = (y2 - y1) / (rows.length + 1);
    d += RR(x1, y1, x2 - x1, y2 - y1, 1, { w: 0.7 });
    for (let i = 1; i <= rows.length; i++) d += L(x1, y1 + i * rh, x2, y1 + i * rh, i === 1 ? 0.6 : 0.4);
    d += L(x1 + lc, y1, x1 + lc, y2, 0.6);
    t += T(x1 + lc + (x2 - x1 - lc) / 2, y1 + rh / 2 + 1.3, 'なまえ', { size: 3.2, anchor: 'middle' });
    rows.forEach((r, i) => {
      const yy = y1 + (i + 1.5) * rh + 1.3;
      t += r.includes('{') ? R(x1 + lc / 2, yy, r, { size: 3.4, anchor: 'middle', rsize: 1.4 }) : T(x1 + lc / 2, yy, r, { size: 2.8, anchor: 'middle' });
    });
    return { d, t };
  },
};

function kMin(k) {
  if (k === 'member') { const rows = Math.ceil(S.kk.mem / (S.kk.mem <= 4 ? S.kk.mem : 3)); return 15 + rows * 13; }
  return { meate: 13 + 2 * LG(), work: 13 + 3 * LG(), toban: S.kk.toban === 'check' ? 46 : 52, mark: 44, minna: 13 + 2 * LG(), furi: 22 + LG(), kufu: 13 + 2 * LG() }[k];
}
const K_WEIGHT = { member: 0, meate: 1, work: 2, toban: 1.2, mark: 1, minna: 1, furi: 0.7, kufu: 1 };

// えらばれた こうもく → セクション
function kakariSections() {
  const on = k => !!S.kk.items[k];
  const lab = k => K_ITEMS.find(it => it.k === k).lab;
  const out = [];
  if (on('member')) out.push({ t: 'members', lab: lab('member') });
  if (on('meate')) out.push({ t: 'lines', lab: lab('meate'), n: 2 });
  const pair = on('work') && on('toban');
  if (on('work')) out.push({ t: 'num', lab: lab('work'), n: 3, half: pair, ratio: 0.56 });
  if (on('toban')) out.push({ t: 'toban', lab: lab('toban'), half: pair });
  if (on('kufu')) out.push({ t: 'lines', lab: lab('kufu'), n: 2 });
  const pair2 = on('mark') && on('minna');
  if (on('mark')) out.push({ t: 'mark', lab: lab('mark'), half: pair2, ratio: 0.36 });
  if (on('minna')) out.push({ t: 'lines', lab: lab('minna'), n: 2, half: pair2 });
  if (on('furi')) out.push({ t: 'stars', lab: lab('furi'), n: 1 });
  return out;
}

/* =========================================================
   10. みんなの かかり（クラスの 係 いちらん表）
   ========================================================= */
function cardIchiran() {
  let d = '', t = '';
  d += RR(8, 8, 194, 281, 5, { w: 1 });
  // はた
  d += L(12, 13, 198, 13, 0.6);
  for (let i = 0; i < 16; i++) {
    const x = 15 + i * 11.6;
    d += POLY([[x, 13], [x + 9, 13], [x + 4.5, 21]], { w: 0.55 });
  }
  // えんぴつ と けしゴム
  d += P('M18,40 L44,34 L46,40 L20,46 Z', { w: 0.7 }) + P('M44,34 L52,35.5 L46,40 Z', { w: 0.6 }) + P('M50.2,35.2 L52,35.5 L50.6,36.8 Z', { fill: '#000', w: 0.3 });
  d += RR(160, 32, 16, 9, 1.5, { w: 0.7, tf: 'rotate(-12 168 36)' }) + L(166, 31.6, 167.8, 40.4, 0.5, 'transform="rotate(-12 168 36)"');
  d += star(186, 30, 2.6, { w: 0.5 }) + sparkle(192, 42, 2) + sparkle(58, 28, 2);
  t += T(105, 40, 'みんなの かかり', { size: 13, font: F_T, hollow: true, anchor: 'middle' });
  // 年 組
  let cx = 74;
  for (const [lab, val] of [['{年|ねん}', S.nen], ['{組|くみ}', S.kumi]]) {
    t += L(cx, 53.2, cx + 14, 53.2, 0.4);
    if (val) t += T(cx + 7, 51.8, val, { size: 5, anchor: 'middle', font: F_H, weight: 600 });
    t += R(cx + 15, 52, lab, { size: 4 });
    cx += 34;
  }
  // ひょう
  const x1 = 14, x2 = 196, y1 = 58, y2 = 284, hh = 9;
  const nRow = S.ichiran.rows, nCol = S.ichiran.cols, lc = 52;
  const rh = (y2 - y1 - hh) / nRow, cw4 = (x2 - x1 - lc) / nCol;
  d += RR(x1, y1, x2 - x1, y2 - y1, 1.5, { w: 0.9 });
  d += L(x1, y1 + hh, x2, y1 + hh, 0.7);
  d += L(x1 + lc, y1, x1 + lc, y2, 0.7);
  for (let j = 1; j < nCol; j++) d += L(x1 + lc + j * cw4, y1 + hh, x1 + lc + j * cw4, y2, 0.35, 'stroke-dasharray="1 1"');
  t += R(x1 + lc / 2, y1 + 6.4, '{係|かかり}の なまえ', { size: 3.6, anchor: 'middle', font: F_T, rsize: 1.5 });
  t += T(x1 + lc + (x2 - x1 - lc) / 2, y1 + 6.4, 'メンバー', { size: 3.6, anchor: 'middle', font: F_T });
  for (let i = 0; i < nRow; i++) {
    const ry = y1 + hh + i * rh;
    if (i) d += L(x1, ry, x2, ry, 0.5);
    const mr = Math.min(5, rh / 2 - 2);
    d += C(x1 + 4 + mr, ry + rh / 2, mr, { fill: 'none', w: 0.45, dash: '1 1' });
    t += R(x1 + lc - 2, ry + rh - 2, '（　　{人|にん}）', { size: 2.6, anchor: 'end', rsize: 1.2 });
  }
  return wrap(d, t);
}

