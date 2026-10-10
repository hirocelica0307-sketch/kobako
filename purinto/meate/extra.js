'use strict';
/* =========================================================
   ついかの こうもく・きりとり カード・カテゴリ
   （ウェブで よく つかわれて いる 学級の カードを 参考に した カテゴリ）
   ========================================================= */

/* ---------- あたらしい こうもくの しゅるい ---------- */
const Ws = (lab, o = {}) => ({ t: 'weathers', lab, ...o });
const Masu = (lab, o = {}) => ({ t: 'masu', lab, ...o });
const Stp = (lab, n, o = {}) => ({ t: 'stamps', lab, n, ...o });
const Cg = (lab, rows, cols, o = {}) => ({ t: 'checkgrid', lab, rows, cols, ...o });
const Tl = (lab, list, o = {}) => ({ t: 'timeline', lab, list, ...o });
const Tf = (lab, n, o = {}) => ({ t: 'tofrom', lab, n, ...o });
const Yo = (lab, n, o = {}) => ({ t: 'yosegaki', lab, n, ...o });
const Gr = (lab, o = {}) => ({ t: 'graph', lab, ...o });

Object.assign(SEC, {
  weathers: {
    min: () => 30, wt: () => 0.2,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const kinds = s.kinds || [['sun', 'はれ'], ['cloud', 'くもり'], ['rain', 'あめ'], ['thunder', 'かみなり'], ['rainbow', 'にじ']];
      const cw = (w - 10) / kinds.length, cy = y + Math.max(5, (b - y) / 2 - 2);
      kinds.forEach(([k, lb], i) => {
        const cx = x + 5 + cw * (i + 0.5);
        d += weatherIcon(k, cx, cy - 1.5, 1.2);
        t += T(cx, cy + 6.8, lb, { size: 2.8, anchor: 'middle' });
      });
      t += hintText(x + w - 4 - rtw('ぴったりの ものを ○で かこもう', 2.7), y - 2.2, 'ぴったりの ものを ○で かこもう');
      return { d, t };
    },
  },
  masu: {
    min: () => 13 + 4 * (G === 'low' ? 9 : 7.5), wt: () => 4,
    fill(s, x, y, w, b) {
      const cs = s.cell || (G === 'low' ? 9 : 7.5);
      const cols = Math.floor((w - 8) / cs), rows = Math.floor((b - y - 3) / cs);
      const x0 = x + (w - cols * cs) / 2, y0 = y + 1;
      let d = RR(x0, y0, cols * cs, rows * cs, 0, { w: 0.6, fill: 'none' });
      for (let i = 1; i < cols; i++) d += L(x0 + i * cs, y0, x0 + i * cs, y0 + rows * cs, 0.25);
      for (let j = 1; j < rows; j++) d += L(x0, y0 + j * cs, x0 + cols * cs, y0 + j * cs, 0.25);
      return { d, t: '' };
    },
  },
  stamps: {
    min: s => 13 + Math.ceil((s.n || 20) / (s.cols || 5)) * 15, wt: () => 2,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const k = s.n || 20, cols = s.cols || Math.min(k, Math.max(5, Math.round(w / 30))), rows = Math.ceil(k / cols);
      const cw = (w - 8) / cols, ch = (b - y - 3) / rows, r = Math.min(cw, ch) / 2 - 1.6;
      for (let i = 0; i < k; i++) {
        const cx = x + 4 + cw * (i % cols + 0.5), cy = y + 1 + ch * (Math.floor(i / cols) + 0.5);
        d += C(cx, cy, r, { w: 0.55, dash: '1.2 1' });
        t += T(cx - r * 0.72, cy - r * 0.55, String(i + 1), { size: Math.max(2.2, r * 0.32), anchor: 'middle', font: F_T });
        if (s.goalEvery && (i + 1) % s.goalEvery === 0) d += star(cx, cy, r * 0.35, { w: 0.4 });
      }
      return { d, t };
    },
  },
  checkgrid: {
    min: s => 14 + (s.rows.length + 1) * 7.5, wt: s => s.rows.length * 0.4,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const x1 = x + 4, x2 = x + w - 4, y1 = y + 1, y2 = b - 3;
      const nr = s.rows.length + 1, rh = (y2 - y1) / nr;
      const lc = s.lc ?? 30, nc = s.cols.length;
      const widths = s.colW ? s.colW.map(f => f * (x2 - x1 - lc)) : Array(nc).fill((x2 - x1 - lc) / nc);
      d += RR(x1, y1, x2 - x1, y2 - y1, 1, { w: 0.7, fill: 'none' });
      for (let i = 1; i < nr; i++) d += L(x1, y1 + i * rh, x2, y1 + i * rh, i === 1 ? 0.6 : 0.35);
      if (lc) d += L(x1 + lc, y1, x1 + lc, y2, 0.6);
      let cx = x1 + lc;
      s.cols.forEach((c, j) => {
        if (j) d += L(cx, y1, cx, y2, 0.35);
        t += R(cx + widths[j] / 2, y1 + rh / 2 + 1.3, c, { size: Math.min(3.2, rh * 0.5), anchor: 'middle', rsize: 1.2 });
        cx += widths[j];
      });
      if (s.corner) t += R(x1 + lc / 2, y1 + rh / 2 + 1.3, s.corner, { size: 3, anchor: 'middle', rsize: 1.2 });
      s.rows.forEach((r, i) => {
        if (r) t += R(x1 + 2, y1 + (i + 1.5) * rh + 1.2, r, { size: Math.min(3.3, rh * 0.5), rsize: 1.2 });
      });
      return { d, t };
    },
  },
  timeline: {
    min: () => 74, wt: () => 4,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const k = s.list.length, gap = 7, pw = (w - 8 - gap * (k - 1)) / k;
      const gp = LG(), nl = s.n ?? 2;
      s.list.forEach((lb, i) => {
        const px = x + 4 + i * (pw + gap), py = y + 1, ph = b - y - 4;
        d += RR(px, py, pw, ph, 3, { w: 0.6 });
        t += R(px + pw / 2, py + 6.2, lb, { size: 3.4, anchor: 'middle', font: F_T, rsize: 1.3 });
        const dh = ph - 10 - nl * gp - 2;
        d += RR(px + 3, py + 9, pw - 6, dh, 1.5, { w: 0.35, dash: '1 1', fill: 'none' });
        for (let j = 0; j < nl; j++) t += dotL(px + 3, px + pw - 3, py + 9 + dh + gp * (j + 0.85));
        if (i < k - 1) d += P(`M${px + pw + 1},${py + ph / 2 - 3} L${px + pw + gap - 1},${py + ph / 2} L${px + pw + 1},${py + ph / 2 + 3} Z`, { w: 0.5, fill: '#000' });
      });
      return { d, t };
    },
  },
  tofrom: {
    min: s => 22 + (s.n || 3) * LG(), wt: s => s.n || 3,
    fill(s, x, y, w, b) {
      const sz = G === 'low' ? 4 : 3.6;
      let t = L(x + 5, y + 7, x + 50, y + 7, 0.45) + R(x + 52, y + 6.5, s.to || (G === 'low' ? 'さんへ' : 'さんへ'), { size: sz });
      t += fillLines(x + 5, x + w - 5, y + 8, b - 9);
      t += L(x + w - 52, b - 3, x + w - 16, b - 3, 0.45) + R(x + w - 14, b - 3.5, 'より', { size: sz });
      return { d: '', t };
    },
  },
  yosegaki: {
    min: s => 14 + Math.ceil((s.n || 6) / 2) * 26, wt: s => (s.n || 6),
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const k = s.n || 6, cols = s.cols || (w > 140 ? (k >= 9 ? 3 : 2) : 2), rows = Math.ceil(k / cols);
      const gap = 4, cw = (w - 8 - gap * (cols - 1)) / cols, ch = (b - y - 3 - gap * (rows - 1)) / rows;
      const shapes = s.shapes || ['round', 'cloud', 'heart', 'star'];
      for (let i = 0; i < k; i++) {
        const bx = x + 4 + (i % cols) * (cw + gap), by = y + 1 + Math.floor(i / cols) * (ch + gap);
        const sh = shapes[i % shapes.length];
        d += RR(bx, by, cw, ch, sh === 'round' ? 6 : 2, { w: 0.6, dash: sh === 'cloud' ? '1.4 1' : '' });
        d += sh === 'heart' ? heart(bx + 5, by + 5, 2, { w: 0.45 }) : sh === 'star' ? star(bx + 5, by + 5, 2.4, { w: 0.45 }) : sh === 'cloud' ? flowerSmall(bx + 5, by + 5, 2.6) : C(bx + 5, by + 5, 1.8, { w: 0.45 });
        const gp = Math.min(LG(), (ch - 12) / 2.2);
        for (let yy = by + 6 + gp * 0.8; yy < by + ch - 7; yy += gp) t += dotL(bx + 3, bx + cw - 3, yy);
        t += L(bx + cw - 26, by + ch - 2.6, bx + cw - 9, by + ch - 2.6, 0.4) + T(bx + cw - 3, by + ch - 3, 'より', { size: 2.8, anchor: 'end' });
      }
      return { d, t };
    },
  },
  graph: {
    min: () => 70, wt: () => 4,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const gx = x + 16, gy = y + 3, gw = w - 22, gh = b - y - 14;
      const nx = s.nx || 10, ny = s.ny || 8;
      for (let i = 0; i <= nx; i++) d += L(gx + gw * i / nx, gy, gx + gw * i / nx, gy + gh, i ? 0.2 : 0.8);
      for (let j = 0; j <= ny; j++) d += L(gx, gy + gh * j / ny, gx + gw, gy + gh * j / ny, j === ny ? 0.8 : 0.2);
      for (let i = 1; i <= nx; i++) t += T(gx + gw * (i - 0.5) / nx, gy + gh + 4.5, String(i), { size: 2.6, anchor: 'middle' });
      t += R(gx + gw, gy + gh + 9, s.xl || '{回|かい}', { size: 2.8, anchor: 'end' });
      t += R(x + 4, gy + 2, s.yl || '{記録|きろく}', { size: 2.8 });
      for (let j = 1; j < ny; j++) t += L(x + 6, gy + gh * j / ny, gx - 2, gy + gh * j / ny, 0.3, 'stroke-dasharray="0.01 1.2"');
      return { d, t };
    },
  },
});

/* =========================================================
   きりとり カード（1まいに 2・4・6まい）
   ========================================================= */
function miniDeco(kind, x, y, s = 1) {
  switch (kind) {
    case 'heart': return heart(x, y, 2.4 * s, { w: 0.5 });
    case 'star': return star(x, y, 3 * s, { w: 0.5 });
    case 'flower': return flowerSmall(x, y, 3.6 * s);
    case 'sakura': return sakura(x, y, 4 * s);
    case 'cat': return scaled(x - 5 * s, y - 5 * s, 0.4 * s, () => cat(12, 14));
    case 'balloon': return balloon(x, y - 2 * s, 2.6 * s, x + 1, y + 6 * s);
    case 'note': return note(x, y + 2 * s, 0.7 * s, true);
    case 'sun': return sunIcon(x, y, 2.4 * s);
    case 'crown': return scaled(x - 5 * s, y - 5 * s, 0.1 * s, HEROES.crown);
    case 'paw': return paw(x, y, 1.1 * s);
    case 'leaf': return mapleLeaf(x, y, 3.6 * s, 0.3);
    case 'ribbon': return E(x - 2.4 * s, y, 2.4 * s, 1.5 * s, { w: 0.5 }) + E(x + 2.4 * s, y, 2.4 * s, 1.5 * s, { w: 0.5 }) + C(x, y, 1 * s, { w: 0.5 });
    case 'like': return heart(x, y, 2.6 * s, { w: 0.6 }) + T(x + 4 * s, y + 1.2 * s, 'いいね', { size: 2.4 * s });
    case 'sparkle': return sparkle(x, y, 2.8 * s);
    default: return '';
  }
}
function cardShape(shape, x, y, w, h) {
  switch (shape) {
    case 'scallop': return PIC.scallop(x, y, w, h);
    case 'stamp': return PIC.stamp(x, y, w, h);
    case 'ticket': return BOX.ticket(x, y, w, h, '').d.replace(/<polygon[^>]*>/, '');
    case 'double': return RR(x, y, w, h, 2, { w: 1 }) + RR(x + 2, y + 2, w - 4, h - 4, 1, { w: 0.35, fill: 'none' });
    case 'note': return RR(x, y, w, h, 1, { w: 0.7 }) + RR(x + w / 2 - 8, y - 2.5, 16, 5, 0.5, { w: 0.4, fill: 'DOTS' });
    case 'wa': return RR(x, y, w, h, 0, { w: 1 }) + RR(x + 1.6, y + 1.6, w - 3.2, h - 3.2, 0, { w: 0.35, fill: 'none' });
    default: return RR(x, y, w, h, 5, { w: 0.9 }) + RR(x + 2.2, y + 2.2, w - 4.4, h - 4.4, 3.5, { w: 0.35, fill: 'none', dash: '1 1' });
  }
}
function renderMulti(ds) {
  const k = ds.multi, cols = k === 2 ? 1 : 2, rows = k / cols;
  let d = '', t = '';
  const X0 = 10, Y0 = 10, W = 190, H = 277, gap = 10;
  const cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows;
  // きりとり せん
  for (let c = 1; c < cols; c++) { const xx = X0 + c * (cw + gap) - gap / 2; t += L(xx, 4, xx, 293, 0.3, 'stroke-dasharray="2 1.6"'); }
  for (let r = 1; r < rows; r++) { const yy = Y0 + r * (ch + gap) - gap / 2; t += L(4, yy, 206, yy, 0.3, 'stroke-dasharray="2 1.6"'); }
  t += T(8, Y0 + ch + gap / 2 + 1.2, '✂', { size: 4 });
  const title = ds.ctitle || CATS[ds.cat].title[G];
  const deco = ds.deco || ['heart', 'star'];
  for (let i = 0; i < k; i++) {
    const x = X0 + (i % cols) * (cw + gap), y = Y0 + Math.floor(i / cols) * (ch + gap);
    d += cardShape(ds.shape, x, y, cw, ch);
    const tsz = Math.min(G === 'low' ? 8 : 7, (cw - 24) / Math.max(4, plain(title).length * 0.95));
    t += R(x + cw / 2, y + 7 + tsz, title, { size: tsz, font: F_T, hollow: true, anchor: 'middle', rsize: Math.max(1.6, tsz * 0.24) });
    d += miniDeco(deco[0], x + 8, y + 9, 1) + miniDeco(deco[1 % deco.length], x + cw - 8, y + 9, 1);
    const sz = G === 'low' ? 3.8 : 3.4, ty = y + 12 + tsz * 1.6;
    t += L(x + 6, ty + 1, x + cw * 0.55, ty + 1, 0.45) + R(x + cw * 0.55 + 2, ty, ds.to || 'さんへ', { size: sz });
    const bottomY = y + ch - 6;
    t += fillLines(x + 6, x + cw - 6, ty + 2, bottomY - 6);
    t += L(x + cw - 50, bottomY, x + cw - 16, bottomY, 0.45) + R(x + cw - 14, bottomY - 0.5, 'より', { size: sz });
    if (deco[2]) d += miniDeco(deco[2], x + 9, bottomY - 2, 0.9);
  }
  return wrap(d, t);
}

/* =========================================================
   カテゴリ（ついか）
   ========================================================= */
Object.assign(CATS, {
  natsu: {
    name: '夏休みの 思い出', when: '夏休み あけ', en: 'MY SUMMER',
    title: { low: 'なつやすみの おもいで', high: '{夏休|なつやす}みの{思|おも}い{出|で}' },
    sec: {
      low: [Dr('いちばんの おもいで'), Ln('どこで・だれと', 1), Ln('たのしかった こと', 2), Ws('そのときの きもち'), Ln('2がっきに がんばりたい こと', 1)],
      high: [Nm('{夏休|なつやす}みの{思|おも}い{出|で} ベスト3', 3, { medal: true }), Ln('いちばん がんばった こと', 2), Ln('{新|あたら}しく{知|し}った こと・{発見|はっけん}', 2), Ln('{2学期|にがっき}に{生|い}かしたい こと', 2), St('{夏休|なつやす}みの{満足度|まんぞくど}', 0, { slab: '{満足度|まんぞくど}' })],
    },
  },
  ensoku: {
    name: '遠足・見学・旅行', when: '遠足・社会科見学・宿泊学習の あと', en: 'FIELD TRIP',
    title: { low: 'えんそく カード', high: '{校外学習|こうがいがくしゅう} ふり{返|かえ}り' },
    sec: {
      low: [Ln('いった ところ', 1), Dr('みつけた もの・たのしかった こと'), Ln('たのしかった こと', 2), Ws('きもちの てんき'), Ln('ありがとうを つたえたい ひと', 1)],
      high: [Ln('{見学先|けんがくさき}', 1, { half: true }), Fi('{日|ひ}にち', BD, { half: true, blank: 12 }), Nm('わかった こと・{学|まな}んだ こと', 3), Ln('{疑問|ぎもん}に{思|おも}った こと', 2, { half: true }), Ln('これから{調|しら}べたい こと', 2, { half: true }), Dr('{印象|いんしょう}に{残|のこ}った{場面|ばめん}', { min: 44 })],
    },
  },
  dokusho: {
    name: '読書カード', when: '読書の 時間・夏休み', en: 'BOOK REVIEW',
    title: { low: 'どくしょ カード', high: '{読書|どくしょ}カード' },
    sec: {
      low: [Ln('ほんの だいめい', 1), Ln('かいた ひと', 1, { half: true }), Fi('よんだ ひ', BD, { half: true, blank: 12 }), St('おもしろさ', 0, { slab: 'おもしろさ' }), Dr('すきな ばめん'), Ln('おもしろかった ところ', 2)],
      high: [Ln('{書名|しょめい}', 1), Ln('{作者|さくしゃ}', 1, { half: true }), Fi('{読|よ}んだ{日|ひ}', BD, { half: true, blank: 12 }), St('おすすめ{度|ど}', 0, { slab: 'おすすめ{度|ど}' }), Ln('あらすじ', 2), Ln('{心|こころ}に{残|のこ}った{言葉|ことば}', 1), Ln('{感想|かんそう}', 3)],
    },
  },
  ganbari: {
    name: 'がんばりカード', when: 'なわとび・音読・九九 など', en: 'CHALLENGE',
    title: { low: 'がんばり カード', high: 'チャレンジ カード' },
    sec: {
      low: [Ln('チャレンジ する こと', 1), Stp('できたら スタンプ・シール', 20, { cols: 5, goalEvery: 5 }), St('がんばった ど', 0, { slab: 'がんばった ど' }), Ln('おうちの ひとから', 1)],
      high: [Ln('チャレンジ{内容|ないよう}', 1, { half: true }), Ln('{目標|もくひょう}', 1, { half: true }), Cg('{記録|きろく}', Array(10).fill(''), ['{日付|ひづけ}', '{記録|きろく}・{回数|かいすう}', 'ひとこと', 'サイン'], { lc: 0, colW: [0.16, 0.24, 0.44, 0.16] }), Ln('ふり{返|かえ}り', 2)],
    },
  },
  arigato: {
    name: 'ありがとう・いいところ', when: 'いつでも（きりとり カード）', en: 'THANK YOU',
    title: { low: 'ありがとう カード', high: '{感謝|かんしゃ}の カード' },
    multi: true,
  },
  tanjoubi: {
    name: 'おたんじょうび', when: 'クラスの おたんじょうび', en: 'HAPPY BIRTHDAY',
    title: { low: 'おたんじょうび おめでとう', high: 'HAPPY BIRTHDAY' },
    sec: {
      low: [Dr('にがおえ', { face: true, half: true, ratio: 0.42, min: 50 }), Fi('たんじょうび', BD, { half: true }), Yo('みんなから ひとこと', 6)],
      high: [Dr('{似顔絵|にがおえ}', { face: true, half: true, ratio: 0.36, min: 46 }), Fi('{誕生日|たんじょうび}', BD, { half: true }), Yo('みんなから メッセージ', 8)],
    },
  },
  seicho: {
    name: '成長・未来の 自分', when: '二分の一成人式・3学期', en: 'GROWING UP',
    title: { low: 'おおきく なったよ', high: '{二分|にぶん}の{一成人式|いちせいじんしき}' },
    sec: {
      low: [Tl('じぶんの あゆみ', ['あかちゃんの とき', 'ようちえん・ほいくえん', 'いま']), Ln('できるように なった こと', 2), Ln('おうちの ひとへ ありがとう', 2)],
      high: [Tl('{自分|じぶん}の あゆみ', ['10{年前|ねんまえ}', '{今|いま}', '10{年後|ねんご}']), Ln('{将来|しょうらい}の{夢|ゆめ}', 2), Le('{家族|かぞく}への{手紙|てがみ}', 4, { to: '', from: 'より' })],
    },
  },
  sotsugyo: {
    name: '6年生へ・卒業', when: '6年生を 送る会・卒業式', en: 'GRADUATION',
    title: { low: '6ねんせいへ ありがとう', high: '{卒業|そつぎょう}おめでとう' },
    sec: {
      low: [Dr('6ねんせいとの おもいで', { min: 60 }), Tf('6ねんせいへ', 4)],
      high: [Ln('{小学校|しょうがっこう}6{年間|ねんかん}の{思|おも}い{出|で}', 3), Nm('{成長|せいちょう}した こと', 3), Ln('{中学校|ちゅうがっこう}で がんばりたい こと', 2), Tf('{先生|せんせい}・{友達|ともだち}・{家族|かぞく}へ', 3)],
    },
  },
});

CATS.jiko.when = '新学期の はじめ';

/* ---------- デザイン ---------- */
const NAWA = ['まえとび', 'うしろとび', 'かけあしとび', 'あやとび', 'こうさとび', 'にじゅうとび', ''];
const DESIGN_EXTRA = {
  jiko: [
    { grade: 'low', theme: 'wanted', layout: 'side', sideN: 3, title: 'わたしを さがせ！',
      secs: [Dr('にがおえ', { face: true, pic: 'mugshot' }), Ln('とくちょう', 2), Ln('すきな もの', 1), Ln('とくいわざ', 1), Ln('みつけたら こえを かけてね', 2)] },
    { grade: 'high', theme: 'tcg', layout: 'stack', title: 'わたしの カード',
      secs: [Dr('', { face: true, pic: 'tcgArt', min: 84 }), Ln('とくぎ', 1, { half: true }), Ln('ひっさつわざ（{得意|とくい}な こと）', 1, { half: true }), Me('ステータス', ['{元気|げんき}', 'やさしさ', '{集中力|しゅうちゅうりょく}', '']), Ln('せつめい（みんなへ ひとこと）', 2)] },
  ],
  natsu: [
    { grade: 'low', theme: 'diary', layout: 'stack', title: 'なつやすみ えにっき', secs: [Dr('え', { min: 100 }), Masu('にっき')] },
    { grade: 'low', theme: 'hanabi', layout: 'side', sideN: 2, hero: 'hanabi' },
    { grade: 'low', theme: 'sea', layout: 'stack', hero: 'suika', drop: ['draw'] },
    { grade: 'low', theme: 'forest', layout: 'around', hero: 'kabuto', title: 'なつの たんけん',
      secs: [Ln('いった ところ', 2), Ln('みつけた もの', 3), Ln('たのしかった こと', 3), Ln('がんばった こと', 2), Ws('きもちの てんき')] },
    { grade: 'low', theme: 'weather', layout: 'hero', hero: 'asagao', drop: ['draw'], title: 'なつやすみ ふりかえり' },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'suika', title: '{夏休|なつやす}み{新聞|しんぶん}' },
    { grade: 'high', theme: 'sns', layout: 'stack', hero: 'hanabi', title: '#{夏|なつ}の{思|おも}い{出|で}' },
    { grade: 'high', theme: 'movie', layout: 'side', sideN: 2, title: '{映画|えいが}「わたしの{夏休|なつやす}み」',
      secs: [Dr('ポスターの{絵|え}'), Ln('あらすじ（{何|なに}を した？）', 3), Ln('{見|み}どころ', 2), Nm('{名場面|めいばめん} ベスト3', 3, { medal: true }), Ln('{2学期|にがっき}への{予告|よこく}', 2)] },
    { grade: 'high', theme: 'chat', layout: 'stack', title: '{夏休|なつやす}み{報告|ほうこく}トーク',
      secs: [Ln('どこへ{行|い}った？', 2), Ln('いちばん{楽|たの}しかった ことは？', 2), Ln('がんばった ことは？', 2), Ln('{2学期|にがっき}に がんばる ことは？', 2), Ln('みんなへ ひとこと', 1)] },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'kakigori' },
  ],
  ensoku: [
    { grade: 'low', theme: 'bento', layout: 'side', sideN: 2, hero: 'bento' },
    { grade: 'low', theme: 'route', layout: 'stack', hero: 'bus', drop: ['draw'], title: 'えんそく れっしゃ' },
    { grade: 'low', theme: 'animals', layout: 'around', hero: 'mapPin', title: 'どうぶつえん たんけん',
      secs: [Ln('みた どうぶつ', 3), Ln('びっくりした こと', 3), Ln('かわいかった こと', 3), Ln('もっと しりたい こと', 3), Ws('きもちの てんき')] },
    { grade: 'low', theme: 'balloon', layout: 'hero', hero: 'mapPin', drop: ['draw'] },
    { grade: 'low', theme: 'weather', layout: 'side', sideN: 2, hero: 'bus', title: 'えんそくの ひの てんき' },
    { grade: 'high', theme: 'route', layout: 'side', sideN: 2, hero: 'mapPin', title: '{見学|けんがく} レポート' },
    { grade: 'high', theme: 'lab', layout: 'stack', hero: 'mapPin', title: '{社会科見学|しゃかいかけんがく} レポート' },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'bus', title: '{校外学習|こうがいがくしゅう}{新聞|しんぶん}' },
    { grade: 'high', theme: 'chat', layout: 'stack', title: '{修学旅行|しゅうがくりょこう} トーク',
      secs: [Ln('{行|い}き{先|さき}・{日程|にってい}', 1), Ln('いちばん{心|こころ}に{残|のこ}った ことは？', 2), Ln('{新|あたら}しく{知|し}った ことは？', 2), Ln('{班|はん}の みんなと がんばった ことは？', 2), Ln('お{家|うち}の{人|ひと}に{伝|つた}えたい ことは？', 2)] },
    { grade: 'high', theme: 'magazine', layout: 'side', sideN: 2, hero: 'bento', title: '{修学旅行|しゅうがくりょこう} ガイドブック' },
  ],
  dokusho: [
    { grade: 'low', theme: 'book', layout: 'stack', hero: 'openBook' },
    { grade: 'low', theme: 'animals', layout: 'stack', hero: 'books', title: 'よんだよ カード' },
    { grade: 'low', theme: 'sweets', layout: 'grid', hero: 'books', title: 'ほんの おやつ カード' },
    { grade: 'low', theme: 'space', layout: 'stack', hero: 'rocket', drop: ['draw'], title: 'ほんの うちゅう りょこう' },
    { grade: 'low', theme: 'rainbow', layout: 'side', sideN: 2, title: 'すきな ほん しょうかい',
      secs: [Dr('ほんの ひょうし'), Ln('ほんの だいめい', 1), Ln('かいた ひと', 1), Ln('ここが すき！', 2), St('おすすめ', 0, { slab: 'おすすめ' }), Ln('だれに よんで ほしい？', 1)] },
    { grade: 'high', theme: 'book', layout: 'stack', hero: 'glasses' },
    { grade: 'high', theme: 'movie', layout: 'side', sideN: 2, title: 'この{本|ほん}を{映画|えいが}に するなら',
      secs: [Dr('{名場面|めいばめん}'), Ln('{書名|しょめい}・{作者|さくしゃ}', 2), Ln('{主人公|しゅじんこう}を{演|えん}じて ほしい{人|ひと}', 1), Ln('{予告編|よこくへん}の せりふ', 2), Ln('{感想|かんそう}', 3)] },
    { grade: 'high', theme: 'tcg', layout: 'stack', title: '{登場人物|とうじょうじんぶつ} カード',
      secs: [Ln('{書名|しょめい}', 1), Dr('{登場人物|とうじょうじんぶつ}の{絵|え}', { pic: 'tcgArt', min: 70 }), Me('{特徴|とくちょう}', ['{勇気|ゆうき}', 'やさしさ', 'ちえ', '']), Ln('{名言|めいげん}（{心|こころ}に{残|のこ}った{言葉|ことば}）', 2), Ln('この{人物|じんぶつ}の すごい ところ', 2)] },
    { grade: 'high', theme: 'sns', layout: 'side', sideN: 2, hero: 'books', title: '#{読書記録|どくしょきろく}' },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'openBook', title: '{今月|こんげつ}の{書評|しょひょう}' },
  ],
  ganbari: [
    { grade: 'low', theme: 'stamp', layout: 'stack' },
    { grade: 'low', theme: 'animals', layout: 'stack', hero: 'jumprope', title: 'なわとび カード',
      secs: [Cg('できたら ○を かこう', NAWA, ['10かい', '20かい', '30かい', '50かい'], { corner: 'わざ', lc: 34 }), St('がんばった ど', 0, { slab: 'がんばった ど' }), Ln('おうちの ひとから', 1)] },
    { grade: 'low', theme: 'train', layout: 'stack', title: 'おんどく れっしゃ',
      secs: [Ln('よむ ところ', 1), Stp('よんだら おうちの ひとに サインを もらおう', 30, { cols: 6, goalEvery: 10 }), Ln('おうちの ひとから', 1)] },
    { grade: 'low', theme: 'space', layout: 'stack', title: 'くくの うちゅう たんけん',
      secs: [Cg('いえたら ○を かこう', ['1のだん', '2のだん', '3のだん', '4のだん', '5のだん', '6のだん', '7のだん', '8のだん', '9のだん'], ['じゅんばん', 'ぎゃくから', 'ばらばら'], { corner: 'だん', lc: 30 }), St('がんばった ど', 0, { slab: 'がんばった ど' })] },
    { grade: 'low', theme: 'rainbow', layout: 'stack', title: 'にじの シール カード',
      secs: [Ln('めあて', 1), Stp('できたら シール', 15, { cols: 5, goalEvery: 5 }), Ws('きもちの てんき')] },
    { grade: 'high', theme: 'stamp', layout: 'stack' },
    { grade: 'high', theme: 'rpg', layout: 'stack', title: 'レベルアップ チャレンジ',
      secs: [Ln('チャレンジ{内容|ないよう}', 1), Cg('レベル', ['Lv.1', 'Lv.2', 'Lv.3', 'Lv.4', 'Lv.5', 'Lv.6', 'Lv.7', 'Lv.8'], ['クリア{条件|じょうけん}', 'クリア{日|び}', 'サイン'], { corner: 'LEVEL', lc: 20, colW: [0.6, 0.2, 0.2] }), Ln('ふり{返|かえ}り', 2)] },
    { grade: 'high', theme: 'stadium', layout: 'stack', title: 'なわとび{記録表|きろくひょう}',
      secs: [Cg('{記録|きろく}（{回数|かいすう}を{書|か}こう）', ['{前|まえ}とび', '{後|うし}ろとび', 'あやとび', '{交差|こうさ}とび', '{二重|にじゅう}とび', 'はやぶさ', ''], ['1{回目|かいめ}', '2{回目|かいめ}', '3{回目|かいめ}', '4{回目|かいめ}', '{自己|じこ}ベスト'], { corner: '{技|わざ}', lc: 30 }), Ln('ふり{返|かえ}り', 2)] },
    { grade: 'high', theme: 'notebook', layout: 'stack', title: '{家庭学習|かていがくしゅう} {記録|きろく}カード',
      secs: [Cg('{記録|きろく}', Array(12).fill(''), ['{日付|ひづけ}', '{教科|きょうか}', '{内容|ないよう}', '{時間|じかん}', 'サイン'], { lc: 0, colW: [0.14, 0.13, 0.45, 0.13, 0.15] }), Ln('ふり{返|かえ}り', 2)] },
    { grade: 'high', theme: 'lab', layout: 'stack', title: '{記録|きろく}アップ グラフ',
      secs: [Ln('チャレンジ{内容|ないよう}', 1, { half: true }), Ln('{目標|もくひょう}', 1, { half: true }), Gr('{記録|きろく}の グラフ（{点|てん}を{打|う}って{線|せん}で つなごう）'), Ln('{気|き}づいた こと', 2)] },
  ],
  arigato: [
    { grade: 'low', multi: 4, shape: 'round', deco: ['heart', 'star', 'flower'], name: 'ありがとう（4まい）' },
    { grade: 'low', multi: 4, shape: 'scallop', deco: ['flower', 'sparkle', 'sun'], ctitle: 'いいところ みつけた！', name: 'いいところ みつけ（4まい）' },
    { grade: 'low', multi: 2, shape: 'round', deco: ['cat', 'paw', 'heart'], name: 'どうぶつ（2まい）' },
    { grade: 'low', multi: 6, shape: 'ticket', deco: ['star', 'sparkle'], ctitle: 'すてき カード', name: 'すてき カード（6まい）' },
    { grade: 'low', multi: 4, shape: 'stamp', deco: ['balloon', 'ribbon', 'note'], ctitle: 'ありがとうの てがみ', name: 'てがみ（4まい）' },
    { grade: 'high', multi: 4, shape: 'double', deco: ['ribbon', 'sparkle'], ctitle: 'Thank you!', name: 'Thank you（4まい）' },
    { grade: 'high', multi: 2, shape: 'stamp', deco: ['heart', 'sparkle', 'flower'], ctitle: '{感謝|かんしゃ}の{手紙|てがみ}', name: '感謝の 手紙（2まい）' },
    { grade: 'high', multi: 6, shape: 'round', deco: ['like', 'star'], ctitle: 'いいね！カード', name: 'いいね！カード（6まい）' },
    { grade: 'high', multi: 4, shape: 'note', deco: ['star', 'sparkle'], ctitle: 'ナイス！{見|み}つけた', name: 'ナイス！見つけた（4まい）' },
    { grade: 'high', multi: 4, shape: 'wa', deco: ['sakura', 'leaf'], ctitle: 'ありがとう', name: 'わがら（4まい）' },
  ],
  tanjoubi: [
    { grade: 'low', theme: 'cake', layout: 'stack' },
    { grade: 'low', theme: 'balloon', layout: 'stack', hero: 'present' },
    { grade: 'low', theme: 'animals', layout: 'stack' },
    { grade: 'low', theme: 'sweets', layout: 'stack' },
    { grade: 'low', theme: 'rainbow', layout: 'stack' },
    { grade: 'high', theme: 'cake', layout: 'stack' },
    { grade: 'high', theme: 'chat', layout: 'stack', title: 'おめでとう トーク',
      secs: [Ln('{今日|きょう}の{主役|しゅやく}', 1, { half: true }), Fi('{誕生日|たんじょうび}', BD, { half: true }), Ln('メッセージ 1', 2), Ln('メッセージ 2', 2), Ln('メッセージ 3', 2), Ln('メッセージ 4', 2)] },
    { grade: 'high', theme: 'sns', layout: 'stack' },
    { grade: 'high', theme: 'magazine', layout: 'stack', title: 'バースデー{特集号|とくしゅうごう}' },
    { grade: 'high', theme: 'airmail', layout: 'stack' },
  ],
  seicho: [
    { grade: 'low', theme: 'garden', layout: 'stack', hero: 'sprout' },
    { grade: 'low', theme: 'balloon', layout: 'stack', hero: 'babyFeet' },
    { grade: 'low', theme: 'rainbow', layout: 'stack' },
    { grade: 'low', theme: 'animals', layout: 'stack', title: 'ぼく・わたしの せいちょう きろく' },
    { grade: 'low', theme: 'cake', layout: 'stack', title: 'おおきく なった ね' },
    { grade: 'high', theme: 'movie', layout: 'side', sideN: 2, title: '{映画|えいが}「10{年後|ねんご}の わたし」',
      secs: [Dr('10{年後|ねんご}の{自分|じぶん}'), Ln('{仕事|しごと}・{夢|ゆめ}', 2), Ln('どんな{人|ひと}に なって いる？', 2), Nm('{夢|ゆめ}を かなえる ために すること', 3), Ln('{未来|みらい}の{自分|じぶん}へ ひとこと', 2)] },
    { grade: 'high', theme: 'passport', layout: 'side', sideN: 2, title: '{未来|みらい} パスポート',
      secs: [Dr('20{歳|さい}の{自分|じぶん}', { face: true, pic: 'id' }), Ln('{行|い}きたい ところ', 1), Ln('{就|つ}きたい{仕事|しごと}', 1), Ln('{今|いま}の{自分|じぶん}の{宝物|たからもの}', 1), Ln('{家族|かぞく}への ありがとう', 3)] },
    { grade: 'high', theme: 'newspaper', layout: 'stack', title: '20　　{年|ねん}　{未来|みらい}{新聞|しんぶん}',
      secs: [Ln('{見出|みだ}し', 1), Dr('{未来|みらい}の{自分|じぶん}が{活躍|かつやく}して いる{写真|しゃしん}', { min: 70 }), Ln('{記事|きじ}', 4)] },
    { grade: 'high', theme: 'airmail', layout: 'stack', title: '10{年後|ねんご}の{自分|じぶん}へ',
      secs: [Tl('{自分|じぶん}の あゆみ', ['10{年前|ねんまえ}', '{今|いま}', '10{年後|ねんご}'], { n: 1 }), Le('{未来|みらい}の{自分|じぶん}への{手紙|てがみ}', 6, { to: '10{年後|ねんご}の わたしへ', from: '10{歳|さい}の わたしより' })] },
    { grade: 'high', theme: 'magazine', layout: 'stack' },
  ],
  sotsugyo: [
    { grade: 'low', theme: 'sakura', layout: 'stack', hero: 'bouquet' },
    { grade: 'low', theme: 'airmail', layout: 'stack', title: '6ねんせいへの てがみ' },
    { grade: 'low', theme: 'balloon', layout: 'stack' },
    { grade: 'low', theme: 'garden', layout: 'stack', title: 'そつぎょう おめでとう' },
    { grade: 'low', theme: 'cake', layout: 'stack', title: 'いままで ありがとう' },
    { grade: 'high', theme: 'wa', layout: 'stack', hero: 'diploma' },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'bouquet', title: '{卒業|そつぎょう}{記念号|きねんごう}' },
    { grade: 'high', theme: 'movie', layout: 'side', sideN: 2, title: '{映画|えいが}「6{年間|ねんかん}の{物語|ものがたり}」',
      secs: [Dr('いちばんの{名場面|めいばめん}'), Ln('{主演|しゅえん}（わたし）の{成長|せいちょう}', 2), Ln('{助演|じょえん}（{支|ささ}えて くれた{人|ひと}）', 2), Nm('{名場面|めいばめん} ベスト3', 3, { medal: true }), Ln('{続編|ぞくへん}（{中学校|ちゅうがっこう}{編|へん}）の{予告|よこく}', 2)] },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'diploma', title: '{卒業|そつぎょう}{新聞|しんぶん}' },
    { grade: 'high', theme: 'sns', layout: 'stack', hero: 'bouquet', title: '#{卒業|そつぎょう}' },
  ],
};
for (const [cat, list] of Object.entries(DESIGN_EXTRA)) addDesigns(cat, list);
