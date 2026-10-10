'use strict';
/* =========================================================
   なわとびカード（低学年・中学年・高学年）
   学年に あわせた 技と 回数で、表・検定・すごろく・ビンゴ・カレンダー／グラフ
   ========================================================= */

// 技と 回数（それぞれ 5だんかい）
const NAWA_DATA = {
  low: {
    unit: 'かい',
    chart: [
      ['まえとび', [10, 20, 30, 50, 100]],
      ['うしろとび', [10, 20, 30, 50, 100]],
      ['かけあしとび', [10, 20, 30, 50, 100]],
      ['グーパーとび', [5, 10, 20, 30, 50]],
      ['けんけんとび', [5, 10, 20, 30, 50]],
      ['あやとび', [5, 10, 15, 20, 30]],
      ['こうさとび', [5, 10, 15, 20, 30]],
      ['にじゅうとび', [1, 2, 3, 5, 10]],
    ],
    kentei: [
      ['10きゅう', 'まえとび', 10], ['9きゅう', 'まえとび', 30], ['8きゅう', 'うしろとび', 10], ['7きゅう', 'かけあしとび', 30],
      ['6きゅう', 'まえとび', 50], ['5きゅう', 'うしろとび', 30], ['4きゅう', 'グーパーとび', 20], ['3きゅう', 'あやとび', 10],
      ['2きゅう', 'こうさとび', 10], ['1きゅう', 'にじゅうとび', 1],
    ],
  },
  mid: {
    unit: '{回|かい}',
    chart: [
      ['{前|まえ}とび', [30, 50, 100, 150, 200]],
      ['{後|うし}ろとび', [30, 50, 100, 150, 200]],
      ['{前|まえ}あやとび', [10, 20, 30, 40, 50]],
      ['{後|うし}ろあやとび', [10, 20, 30, 40, 50]],
      ['{前|まえ}{交差|こうさ}とび', [10, 20, 30, 40, 50]],
      ['{後|うし}ろ{交差|こうさ}とび', [5, 10, 20, 30, 40]],
      ['{側振|そくしん}とび', [5, 10, 15, 20, 30]],
      ['{二重|にじゅう}とび', [1, 3, 5, 10, 20]],
      ['{後|うし}ろ{二重|にじゅう}とび', [1, 2, 3, 5, 10]],
    ],
    kentei: [
      ['10{級|きゅう}', '{前|まえ}とび', 100], ['9{級|きゅう}', '{後|うし}ろとび', 50], ['8{級|きゅう}', '{前|まえ}あやとび', 20], ['7{級|きゅう}', '{後|うし}ろあやとび', 20],
      ['6{級|きゅう}', '{前|まえ}{交差|こうさ}とび', 20], ['5{級|きゅう}', '{後|うし}ろ{交差|こうさ}とび', 10], ['4{級|きゅう}', '{側振|そくしん}とび', 10], ['3{級|きゅう}', '{二重|にじゅう}とび', 5],
      ['2{級|きゅう}', '{二重|にじゅう}とび', 10], ['1{級|きゅう}', '{後|うし}ろ{二重|にじゅう}とび', 3],
    ],
  },
  high: {
    unit: '{回|かい}',
    chart: [
      ['{二重|にじゅう}とび', [10, 20, 30, 50, 100]],
      ['{後|うし}ろ{二重|にじゅう}とび', [5, 10, 20, 30, 50]],
      ['はやぶさ（あや{二重|にじゅう}）', [1, 3, 5, 10, 20]],
      ['{後|うし}ろはやぶさ', [1, 3, 5, 10, 20]],
      ['つばめ（{交差|こうさ}{二重|にじゅう}）', [1, 3, 5, 10, 20]],
      ['{側振|そくしん}{交差|こうさ}とび', [5, 10, 15, 20, 30]],
      ['{三重|さんじゅう}とび', [1, 2, 3, 5, 10]],
      ['{持久|じきゅう}とび（{前|まえ}とび）', ['1{分|ぷん}', '2{分|ふん}', '3{分|ぷん}', '4{分|ふん}', '5{分|ふん}']],
    ],
    kentei: [
      ['{初段|しょだん}', '{二重|にじゅう}とび', 30], ['{二段|にだん}', '{後|うし}ろ{二重|にじゅう}とび', 10], ['{三段|さんだん}', 'はやぶさ', 5], ['{四段|よんだん}', '{後|うし}ろはやぶさ', 3],
      ['{五段|ごだん}', 'つばめ', 5], ['{六段|ろくだん}', '{側振|そくしん}{交差|こうさ}とび', 10], ['{七段|ななだん}', 'はやぶさ', 20], ['{八段|はちだん}', '{二重|にじゅう}とび', 100],
      ['{九段|きゅうだん}', '{三重|さんじゅう}とび', 1], ['{十段|じゅうだん}', '{三重|さんじゅう}とび', 5],
    ],
  },
};
const nawaCount = c => typeof c === 'number' ? c + NAWA_DATA[G].unit : c;
// はばに あわせて 文字を 小さく
function fitR(x, y, src, maxW, size, o = {}) {
  const w = rtw(src, size, o.font || F_L);
  const sz = w > maxW ? size * maxW / w : size;
  return R(x, y, src, { ...o, size: sz, rsize: Math.max(1, sz * 0.4) });
}

Object.assign(SEC, {
  // 技 × 回数（クリアしたら ぬる）
  nawachart: {
    min: () => 20 + NAWA_DATA[G].chart.length * 10, wt: () => 6,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const rows = NAWA_DATA[G].chart, x1 = x + 4, x2 = x + w - 4, y1 = y + 1, y2 = b - 3;
      const lc = G === 'low' ? 36 : 46, hh = 7, rh = (y2 - y1 - hh) / rows.length, cw = (x2 - x1 - lc) / 5;
      d += RR(x1, y1, x2 - x1, y2 - y1, 1, { w: 0.8, fill: 'none' });
      d += L(x1, y1 + hh, x2, y1 + hh, 0.7) + L(x1 + lc, y1, x1 + lc, y2, 0.7);
      t += R(x1 + lc / 2, y1 + 5, G === 'low' ? 'わざ' : '{技|わざ}', { size: 3.4, anchor: 'middle', font: F_T, rsize: 1.3 });
      t += R(x1 + lc + (x2 - x1 - lc) / 2, y1 + 5, G === 'low' ? 'できたら ぬろう！' : 'クリアしたら ぬろう', { size: 3.2, anchor: 'middle', rsize: 1.3 });
      rows.forEach(([waza, cs], i) => {
        const ry = y1 + hh + i * rh;
        if (i) d += L(x1, ry, x2, ry, 0.45);
        t += fitR(x1 + 2.5, ry + rh / 2 + 1.4, waza, lc - 5, G === 'low' ? 3.8 : 3.4);
        cs.forEach((c, j) => {
          const cx = x1 + lc + j * cw;
          d += RR(cx + 1.4, ry + 1.4, cw - 2.8, rh - 2.8, 2, { w: 0.5 });
          t += R(cx + cw / 2, ry + rh / 2 + 1.3, nawaCount(c), { size: Math.min(3.6, rh * 0.38), anchor: 'middle', rsize: 1.2 });
        });
      });
      return { d, t };
    },
  },
  // 検定（級・段）
  kentei: {
    min: () => 20 + 10 * 9, wt: () => 6,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const rows = NAWA_DATA[G].kentei, x1 = x + 4, x2 = x + w - 4, y1 = y + 1, y2 = b - 3;
      const hh = 7, rh = (y2 - y1 - hh) / rows.length, W = x2 - x1;
      const cols = [[0.15, G === 'high' ? '{段位|だんい}' : G === 'mid' ? '{級|きゅう}' : 'きゅう'], [0.33, G === 'low' ? 'わざ' : '{技|わざ}'], [0.14, G === 'low' ? 'かいすう' : '{回数|かいすう}'], [0.2, G === 'low' ? 'ごうかくした ひ' : '{合格日|ごうかくび}'], [0.18, G === 'low' ? 'サイン' : 'サイン・はんこ']];
      d += RR(x1, y1, W, y2 - y1, 1, { w: 0.8, fill: 'none' }) + L(x1, y1 + hh, x2, y1 + hh, 0.7);
      let cx = x1;
      cols.forEach(([f, lb], j) => {
        if (j) d += L(cx, y1, cx, y2, j === 1 ? 0.6 : 0.35);
        t += R(cx + W * f / 2, y1 + 5, lb, { size: 3.2, anchor: 'middle', font: F_T, rsize: 1.2 });
        cx += W * f;
      });
      rows.forEach(([lv, waza, c], i) => {
        const ry = y1 + hh + i * rh, my = ry + rh / 2 + 1.4;
        if (i) d += L(x1, ry, x2, ry, 0.4);
        let cx2 = x1;
        t += fitR(cx2 + W * cols[0][0] / 2, my, lv, W * cols[0][0] - 3, 3.6, { anchor: 'middle', font: F_T }); cx2 += W * cols[0][0];
        t += fitR(cx2 + 2, my, waza, W * cols[1][0] - 4, 3.6); cx2 += W * cols[1][0];
        t += R(cx2 + W * cols[2][0] / 2, my, nawaCount(c), { size: 3.6, anchor: 'middle', rsize: 1.2 }); cx2 += W * cols[2][0];
        t += R(cx2 + W * cols[3][0] - 3, my, G === 'low' ? '　がつ　　にち' : '　{月|がつ}　　{日|にち}', { size: 2.8, anchor: 'end', rsize: 1 });
        cx2 += W * cols[3][0];
        d += C(cx2 + W * cols[4][0] / 2, ry + rh / 2, Math.min(rh / 2 - 1.2, 4.6), { fill: 'none', w: 0.4, dash: '1 0.9' });
      });
      return { d, t };
    },
  },
  // すごろく（スタート → 10の かだい → ゴール）
  sugoroku: {
    min: () => 150, wt: () => 8,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const steps = [['START'], ...NAWA_DATA[G].kentei.map(k => [k[1], k[2]]), ['GOAL']];
      const cols = 4, rows = Math.ceil(steps.length / cols), gx = 7, gy = 8;
      const cw = (w - 8 - gx * (cols - 1)) / cols, ch = (b - y - 4 - gy * (rows - 1)) / rows;
      const pos = i => {
        const r = Math.floor(i / cols), c0 = i % cols, c = r % 2 ? cols - 1 - c0 : c0;
        return [x + 4 + c * (cw + gx), y + 1 + r * (ch + gy)];
      };
      steps.forEach((st, i) => {
        const [cx, cy] = pos(i);
        // やじるし
        if (i < steps.length - 1) {
          const [nx, ny] = pos(i + 1);
          if (ny === cy) {
            const ax = nx > cx ? cx + cw + 1 : cx - 1, dir = nx > cx ? 1 : -1;
            d += P(`M${ax},${cy + ch / 2 - 2.6} L${ax + dir * (gx - 2)},${cy + ch / 2} L${ax},${cy + ch / 2 + 2.6} Z`, { fill: '#000', w: 0.3 });
          } else {
            d += P(`M${cx + cw / 2 - 2.6},${cy + ch + 1} L${cx + cw / 2},${cy + ch + gy - 1} L${cx + cw / 2 + 2.6},${cy + ch + 1} Z`, { fill: '#000', w: 0.3 });
          }
        }
        if (st[0] === 'START' || st[0] === 'GOAL') {
          d += RR(cx, cy, cw, ch, 5, { w: 1.2 });
          t += T(cx + cw / 2, cy + ch / 2 + 2.4, st[0], { size: 6, font: F_T, hollow: true, anchor: 'middle' });
          if (st[0] === 'GOAL') d += L(cx + cw - 9, cy + ch - 4, cx + cw - 9, cy + 4, 0.7) + P(`M${cx + cw - 9},${cy + 4} L${cx + cw - 2.5},${cy + 6.5} L${cx + cw - 9},${cy + 9} Z`, { w: 0.5 }) + star(cx + 7, cy + 7, 3.4, { w: 0.5 });
          else d += HEROES.jumprope ? scaled(cx + 2, cy + ch - 16, 0.15, HEROES.jumprope) : '';
          return;
        }
        d += RR(cx, cy, cw, ch, 4, { w: 0.8 });
        d += C(cx + cw - 6, cy + 6, 4, { w: 0.5, dash: '1 0.9' });
        t += T(cx + 4, cy + 6.5, String(i), { size: 4.2, font: F_T });
        t += fitR(cx + cw / 2, cy + ch / 2 + 2.2, st[0], cw - 6, G === 'low' ? 3.8 : 3.5, { anchor: 'middle', font: F_T });
        t += R(cx + cw / 2, cy + ch / 2 + 8.6, nawaCount(st[1]), { size: 3.6, anchor: 'middle', rsize: 1.2 });
      });
      t += hintText(x + w - 4 - rtw('クリアしたら ○を ぬろう', 2.7), y - 2.2, 'クリアしたら ○を ぬろう');
      return { d, t };
    },
  },
  // ビンゴ
  bingo: {
    min: () => 150, wt: () => 8,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const ch = NAWA_DATA[G].chart;
      const n = G === 'low' ? 3 : G === 'mid' ? 4 : 5;
      let cells;
      if (n === 3) cells = ch.slice(0, 8).map(r => [r[0], r[1][2]]);
      else if (n === 4) cells = ch.flatMap(r => [[r[0], r[1][1]], [r[0], r[1][3]]]).slice(0, 16);
      else cells = ch.flatMap(r => [[r[0], r[1][0]], [r[0], r[1][2]], [r[0], r[1][4]]]).slice(0, 24);
      // ならびを まぜる（いつも おなじ ならび）
      cells = cells.map((c, i) => [c, (i * 7 + 3) % cells.length]).sort((a, b2) => a[1] - b2[1]).map(a => a[0]);
      if (n !== 4) cells.splice(Math.floor(n * n / 2), 0, ['FREE']);
      const size = Math.min(w - 10, b - y - 6), cs = size / n, x0 = x + (w - size) / 2, y0 = y + 2;
      d += RR(x0, y0, size, size, 2, { w: 1.2, fill: 'none' });
      for (let i = 1; i < n; i++) d += L(x0 + i * cs, y0, x0 + i * cs, y0 + size, 0.6) + L(x0, y0 + i * cs, x0 + size, y0 + i * cs, 0.6);
      cells.forEach((c, i) => {
        const cx = x0 + (i % n) * cs, cy = y0 + Math.floor(i / n) * cs;
        if (c[0] === 'FREE') { d += star(cx + cs / 2, cy + cs / 2 - 1, cs * 0.28, { w: 0.6 }); t += T(cx + cs / 2, cy + cs - 4, 'FREE', { size: 3.4, font: F_T, anchor: 'middle' }); return; }
        const fs = Math.min(4.2, cs * 0.13);
        t += fitR(cx + cs / 2, cy + cs / 2 - 0.5, c[0], cs - 4, fs, { anchor: 'middle', font: F_T });
        t += R(cx + cs / 2, cy + cs / 2 + fs * 1.8, nawaCount(c[1]), { size: fs, anchor: 'middle', rsize: 1.2 });
      });
      t += hintText(x + w - 4 - rtw(G === 'low' ? 'できたら ぬろう。たて・よこ・ななめ そろったら ビンゴ！' : 'クリアしたら ぬろう。{縦|たて}・{横|よこ}・ななめ そろえば ビンゴ！', 2.7), y - 2.2, G === 'low' ? 'できたら ぬろう。たて・よこ・ななめ そろったら ビンゴ！' : 'クリアしたら ぬろう。{縦|たて}・{横|よこ}・ななめ そろえば ビンゴ！');
      return { d, t };
    },
  },
  // カレンダー（とんだ 回数を 書く）
  days: {
    min: () => 13 + 5 * 17, wt: () => 6,
    fill(s, x, y, w, b) {
      let d = '', t = '';
      const cols = 7, rows = 5, x1 = x + 4, cw = (w - 8) / cols, ch = (b - y - 3) / rows;
      for (let i = 0; i < 31; i++) {
        const cx = x1 + (i % cols) * cw, cy = y + 1 + Math.floor(i / cols) * ch;
        d += RR(cx + 0.8, cy + 0.8, cw - 1.6, ch - 1.6, 2, { w: 0.5 });
        t += T(cx + 3, cy + 5, String(i + 1), { size: 3, font: F_T });
        t += dotL(cx + 3, cx + cw - 3, cy + ch - 4);
      }
      t += R(x1 + 4 * cw + 2, y + 1 + 4 * ch + ch / 2, G === 'low' ? 'がんばった ひに シールも はろう' : 'とんだ{回数|かいすう}や{技|わざ}を{書|か}こう', { size: 2.8, rsize: 1.1 });
      return { d, t };
    },
  },
});

/* ---------- カテゴリと デザイン ---------- */
const NawaChart = lab => ({ t: 'nawachart', lab });
const Kentei = lab => ({ t: 'kentei', lab });
const Sugo = lab => ({ t: 'sugoroku', lab });
const Bingo = lab => ({ t: 'bingo', lab });
const Days = lab => ({ t: 'days', lab });

CATS.nawa = {
  name: 'なわとびカード', when: '冬の 体育・休み時間', en: 'JUMP ROPE',
  title: { low: 'なわとび カード', mid: 'なわとびカード', high: 'なわとびカード' },
  sec: { low: [], mid: [], high: [] },
};
const MONTH = g => g === 'low' ? ['', 'がつ'] : ['', '{月|がつ}'];
addDesigns('nawa', [
  // 低学年（1・2年）
  { grade: 'low', theme: 'animals', layout: 'stack', name: 'わざ × かいすう', title: 'なわとび カード',
    secs: [NawaChart('できたら ぬろう'), Ln('おうちの ひと・せんせいから', 1)] },
  { grade: 'low', theme: 'stamp', layout: 'stack', name: 'けんてい（10〜1きゅう）', title: 'なわとび けんてい',
    secs: [Kentei('けんてい'), Ln('つぎの めあて', 1)] },
  { grade: 'low', theme: 'dino', layout: 'stack', name: 'すごろく', title: 'なわとび すごろく',
    secs: [Sugo('すごろく'), Ln('おうちの ひとから', 1)] },
  { grade: 'low', theme: 'rainbow', layout: 'stack', name: 'ビンゴ（3×3）', title: 'なわとび ビンゴ',
    secs: [Bingo('ビンゴ'), Ln('ひとこと', 1)] },
  { grade: 'low', theme: 'train', layout: 'stack', name: 'カレンダー', title: 'なわとび カレンダー',
    secs: [Fi('なんがつ？', MONTH('low'), { blank: 12 }), Days('とんだ かいすう'), Ln('がんばった こと', 1)] },
  // 中学年（3・4年）
  { grade: 'mid', theme: 'forest', layout: 'stack', name: '技 × 回数', title: 'なわとびカード',
    secs: [NawaChart('クリア{表|ひょう}'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'mid', theme: 'wa', layout: 'stack', name: '検定（10〜1級）', title: 'なわとび{検定|けんてい}',
    secs: [Kentei('{検定|けんてい}'), Ln('つぎの{目標|もくひょう}', 1)] },
  { grade: 'mid', theme: 'route', layout: 'stack', name: 'すごろく', title: 'なわとび{線|せん} {各駅停車|かくえきていしゃ}',
    secs: [Sugo('すごろく'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'mid', theme: 'space', layout: 'stack', name: 'ビンゴ（4×4）', title: 'なわとびビンゴ',
    secs: [Bingo('ビンゴ'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'mid', theme: 'notebook', layout: 'stack', name: 'カレンダー', title: 'なわとび{記録|きろく}カレンダー',
    secs: [Fi('{月|つき}', MONTH('mid'), { blank: 12, half: true }), Ln('{今月|こんげつ}の{目標|もくひょう}', 1, { half: true, ratio: 0.36 }), Days('{記録|きろく}'), Ln('ふり{返|かえ}り', 1)] },
  // 高学年（5・6年）
  { grade: 'high', theme: 'stadium', layout: 'stack', name: '技 × 回数', title: 'なわとび{記録表|きろくひょう}',
    secs: [NawaChart('クリア{表|ひょう}'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'high', theme: 'rpg', layout: 'stack', name: '段位認定（初段〜十段）', title: 'なわとび{段位|だんい}{認定|にんてい}',
    secs: [Kentei('{段位|だんい}'), Ln('つぎの{目標|もくひょう}', 1)] },
  { grade: 'high', theme: 'manga', layout: 'stack', name: 'すごろく', title: '{十段|じゅうだん}への{道|みち}',
    secs: [Sugo('すごろく'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'high', theme: 'tcg', layout: 'stack', name: 'ビンゴ（5×5）', title: 'なわとびビンゴ',
    secs: [Bingo('ビンゴ'), Ln('ふり{返|かえ}り', 1)] },
  { grade: 'high', theme: 'lab', layout: 'stack', name: '記録グラフ', title: 'なわとび{記録|きろく}グラフ',
    secs: [Ln('{技|わざ}', 1, { half: true }), Ln('{目標|もくひょう}（{回数|かいすう}）', 1, { half: true }), Gr('{記録|きろく}の グラフ（{点|てん}を{打|う}って{線|せん}で つなごう）', { xl: '{日目|にちめ}', yl: '{回数|かいすう}' }), Cg('{記録|きろく}', ['', '', '', '', ''], ['{日付|ひづけ}', '{回数|かいすう}', '{気|き}づいた こと'], { lc: 0, colW: [0.2, 0.2, 0.6] })] },
]);
