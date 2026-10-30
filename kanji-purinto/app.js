/* かんじプリント：画面 */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const mm = v => v.toFixed(2) + 'mm';
const abs = (cls, x, y, w, h) => { const e = el('div', 'ab ' + (cls || '')); e.style.left = mm(x); e.style.top = mm(y); if (w !== undefined) e.style.width = mm(w); if (h !== undefined) e.style.height = mm(h); return e; };
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/* 見本の 例文（オリジナル）。「見本の 例文を 下に たす」で 入る */
const SAMPLE = [
  '# 見本の 例文（けして かまいません）',
  '[春](はる)に なると 花が さく',
  '[夏](なつ)休みに 海へ 行く',
  '[秋](あき)の 虫の こえを 聞く',
  '[冬](ふゆ)の あさは さむい',
  '[朝](あさ)ごはんを 食べる',
  '[昼](ひる)休みに 本を よむ',
  '[夜](よる)空に 星が 光る',
  '[電車](でんしゃ)に のる',
  '[友](とも)だちと あそぶ',
  '大きな [声](こえ)で うたう',
  '[新しい](あたらしい) くつを はく',
  '[国語](こくご)の 時間',
  '[高い](たかい) 山に のぼる',
  'みんなの 前で [話す](はなす)',
  '[弟](おとうと)と 公園へ 行く',
  '[雪](ゆき)が つもる',
  '[東](ひがし)の 空が 明るい',
  '小さな [鳥](とり)が 鳴く',
  '[絵](え)を かく',
  '[算数](さんすう)の ノート',
];

/* ---------- 保存 ---------- */
const LS_KEY = 'kanji-purinto:v1';
const DEF = {
  tab: 'test', bank: '', units: '', hidden: [], saved: [],
  test: { title: '二年 かんじテスト', count: 10, kind: 'kaki', yomi: 5, range: 'kanji', terms: [1], units: [], kanji: [...KP.KANJI2],
          cross: true, answers: true, seed: 1, questions: null },
  note: { title: '二年 かんじノート', size: 84, paper: 'B5', words: '' },
};
const clone = o => JSON.parse(JSON.stringify(o));
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { s = null; }
  const st = clone(DEF);
  if (s && typeof s === 'object') {
    ['tab', 'bank', 'units'].forEach(k => { if (typeof s[k] === 'string') st[k] = s[k]; });
    ['hidden', 'saved'].forEach(k => { if (Array.isArray(s[k])) st[k] = s[k]; });
    if (s.test) Object.assign(st.test, s.test);
    if (s.note) Object.assign(st.note, s.note);
  }
  return st;
}
let st = load();
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* 保存できない ときも うごかす */ } }, 200);
}

let toastTimer = 0;
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms || 2600);
}

/* ---------- データ ---------- */
let bankItems = [], unitData = { units: [], errors: [] };
function parseData() {
  bankItems = KP.parseBank(st.bank);
  unitData = KP.parseUnits(st.units);
}
const pool = () => { const h = new Set(st.hidden); return bankItems.filter(p => !p.error && !h.has(p.line)); };
function curRange() {
  const t = st.test;
  const sel = t.range === 'term' ? t.terms : t.range === 'unit' ? t.units : t.kanji;
  return KP.rangeOf(unitData.units, t.range, sel);
}
function kinds() {
  const t = st.test, n = t.count;
  if (t.kind === 'yomi') return { yomi: n, kaki: 0 };
  if (t.kind === 'kaki') return { yomi: 0, kaki: n };
  const y = Math.max(0, Math.min(n, t.yomi));
  return { yomi: y, kaki: n - y };
}
let lastShort = 0;
function regen(newSeed) {
  if (newSeed) st.test.seed = Math.floor(Math.random() * 1e9);
  const res = KP.pickQuestions(pool(), curRange(), kinds(), st.test.seed);
  st.test.questions = res.questions;
  lastShort = res.short;
  save();
}

/* ================================================================
   テストの 紙
   ================================================================ */
function sentenceTokens(p, kind, c, answer, cross) {
  const b = KP.BOX * c, sw = KP.SIDE * c;
  const out = [];
  const tk = (h) => { const t = el('div', 'tk'); t.style.width = mm(b + sw); if (h) t.style.height = mm(h); const m = el('div', 'tm'); m.style.width = mm(b); const s = el('div', 'ts'); s.style.width = mm(sw); t.append(m, s); return { t, m, s }; };
  const plain = (text) => {
    if (!text.trim()) return;
    const { t, m } = tk();
    const d = el('div', 'ptxt', text.trim());
    d.style.fontSize = mm(c * 0.92); d.style.lineHeight = mm(b);
    m.append(d); out.push(t);
  };
  const T = p.target;
  plain(p.before);
  if (kind === 'kaki') {
    if (!T.kana) {
      const H = T.chars.length * b + (T.chars.length - 1) * 0.15 * c;
      const { t, m, s } = tk(H);
      m.style.justifyContent = 'space-between';
      T.chars.forEach(ch => {
        const k = el('div', 'kbox' + (cross ? ' cross' : '')); k.style.width = mm(b); k.style.height = mm(b);
        if (answer) { const a = el('span', 'ansk', ch); a.style.fontSize = mm(c); k.append(a); }
        m.append(k);
      });
      sideReading(s, T.reading, H, c);
      out.push(t);
    } else {
      const H = T.chars.length * 1.1 * c + 0.8 * c;
      const { t, m, s } = tk(H);
      const k = el('div', 'brk'); k.style.width = mm(b * 0.8); k.style.height = mm(H);
      if (answer) { const a = el('span', 'ansk', T.text); a.style.fontSize = mm(c); a.style.letterSpacing = mm(c * 0.1); k.append(a); }
      m.append(k);
      sideReading(s, T.reading, H, c);
      out.push(t);
    }
  } else {
    const hl = [...T.head].length, rl = [...T.headReading].length;
    const H = (Math.max(hl, rl * 0.7) + 0.3) * c;
    const { t, m, s } = tk(H);
    const d = el('div', 'ptxt', T.head); d.style.fontSize = mm(c * 0.92); d.style.lineHeight = mm(b);
    m.append(d);
    const box = el('div', 'ybox'); box.style.width = mm(sw - 1);
    if (answer) { const a = el('span', 'ansk', T.headReading); a.style.fontSize = mm(Math.min(c * 0.5, (H - 1) / rl * 0.95, (sw - 1.6) * 0.95)); box.append(a); }
    s.append(box);
    out.push(t);
    plain(T.okuri + p.after);
    return out;
  }
  plain(p.after);
  return out;
}
function sideReading(s, reading, H, c) {
  const r = el('div', 'side-yomi', reading);
  const n = [...reading].length;
  r.style.fontSize = mm(Math.min(c * 0.42, H / n * 0.95));
  s.append(r);
}

function testSheet(questions, answer) {
  const t = st.test, g = KP.testGeometry(t.count);
  const sheet = el('div', 'sheet p-' + g.paper);
  sheet.style.width = mm(g.w); sheet.style.height = mm(g.h - 0.4);
  const innerH = g.h - g.m * 2;

  // だい名・名前（右はし）
  const headX = g.w - g.m - g.headW;
  const head = abs('t-head', headX, g.m, g.headW, innerH);
  const title = el('div', 'vt t-title', t.title || '');
  if (answer) title.append(el('span', 'ans-mark', '　こたえ'));
  head.append(title, el('div', 'vt t-date', '月　　日'), el('div', 'vt t-name', 'なまえ'), el('div', 't-namebox'));
  sheet.append(head);

  // もんだい
  const qx = headX - g.qW;
  sheet.append(abs('t-qarea', qx, g.m, g.qW, innerH));
  for (let r = 1; r < g.rows; r++) sheet.append(abs('q-row-sep', qx, g.m + r * g.rowH, g.qW, 0));
  for (let i = 0; i < t.count; i++) {
    const row = Math.floor(i / g.perRow), col = i % g.perRow;
    const q = abs('q' + (col === g.perRow - 1 ? ' first-col' : ''), headX - (col + 1) * g.colW, g.m + row * g.rowH, g.colW, g.rowH);
    const item = questions[i];
    const p = item && KP.parseSentence(item.line);
    if (p && !p.error) {
      const c = KP.charSize(p, item.kind, g);
      const qi = el('div', 'qi');
      const num = el('div', 'tk'); num.style.width = mm((KP.BOX + KP.SIDE) * c); num.style.height = mm(1.6 * c);
      const nm = el('div', 'tm qn', CIRCLED[i] || String(i + 1)); nm.style.width = mm(KP.BOX * c); nm.style.fontSize = mm(c * 0.62);
      num.append(nm);
      qi.append(num, ...sentenceTokens(p, item.kind, c, answer, t.cross));
      q.append(qi);
      if (!answer) q.append(qTools(i));
    } else if (!answer) {
      q.append(el('div', 'q-empty', '（例文が たりません）'));
    }
    sheet.append(q);
  }

  // れんしゅうの マス（左はし。よこ2れつ・たて10マス）
  const py = g.m + (innerH - g.sq * 10) / 2;
  const pr = abs('practice', g.m, py, g.practiceW, g.sq * 10);
  for (let i = 0; i < 20; i++) { const d = el('div'); d.style.height = mm(g.sq); pr.append(d); }
  sheet.append(pr);
  const lb = abs('vt p-label', g.m + g.practiceW + 1, py, g.labelW, undefined);
  lb.textContent = 'れんしゅう';
  sheet.append(lb);
  return sheet;
}

function qTools(i) {
  const box = el('div', 'qtools');
  const mk = (label, title, fn) => { const b = el('button', '', label); b.title = title; b.addEventListener('click', e => { e.stopPropagation(); fn(i); }); box.append(b); };
  mk('⇄', 'ほかの 例文に 入れかえる', swapQ);
  mk('直す', 'この 例文を 直す', editQ);
  mk('出さない', 'この 例文を もう 出さない', hideQ);
  return box;
}
function swapQ(i) {
  const qs = st.test.questions;
  const nq = KP.replaceOne(qs, i, pool(), curRange(), Math.floor(Math.random() * 1e9));
  if (!nq) { toast('ほかに 使える 例文が ありません'); return; }
  qs[i] = nq; save(); renderAll();
}
function editQ(i) {
  const q = st.test.questions[i];
  const v = prompt('例文を 直します（[ ] と ( ) の 書き方は そのまま）', q.line);
  if (v === null) return;
  const p = KP.parseSentence(v);
  if (p.error) { alert(p.error); return; }
  let found = false;
  st.bank = st.bank.split(/\r?\n/).map(l => { if (!found && KP.normalize(l) === q.line) { found = true; return p.line; } return l; }).join('\n');
  if (!found) st.bank = (st.bank.trim() ? st.bank.replace(/\s*$/, '\n') : '') + p.line;
  q.line = p.line;
  parseData(); save(); renderAll(); renderData();
  toast('例文を 直しました');
}
function hideQ(i) {
  const qs = st.test.questions;
  if (!st.hidden.includes(qs[i].line)) st.hidden.push(qs[i].line);
  const nq = KP.replaceOne(qs, i, pool(), curRange(), Math.floor(Math.random() * 1e9));
  if (nq) qs[i] = nq; else qs.splice(i, 1);
  save(); renderAll(); renderData();
  toast('もう 出しません（「例文・単元」で もどせます）', 3200);
}

/* ================================================================
   ノートの 紙
   ================================================================ */
const SVGNS = 'http://www.w3.org/2000/svg';
function noteSheet(cols, g) {
  const t = st.note;
  const sheet = el('div', 'sheet p-' + g.paper);
  sheet.style.width = mm(g.pw); sheet.style.height = mm(g.ph - 0.4);

  const head = abs('n-head', g.left, g.top - g.headH, g.gridW, g.headH - 2);
  const name = el('span', 'n-name');
  head.append(el('span', 'n-title', t.title || ''), el('span', '', '　　月　　日　　曜日'), el('span', '', 'なまえ'), name);
  sheet.append(head);

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', mm(g.pw)); svg.setAttribute('height', mm(g.ph));
  svg.setAttribute('viewBox', `0 0 ${g.pw} ${g.ph}`);
  svg.style.position = 'absolute'; svg.style.left = 0; svg.style.top = 0;
  const line = (x1, y1, x2, y2, w, color, dash) => {
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', color); l.setAttribute('stroke-width', w);
    if (dash) l.setAttribute('stroke-dasharray', dash);
    svg.append(l);
  };
  const L = g.left, T = g.top, R = g.left + g.gridW, B = g.top + g.gridH, step = g.w + g.rubyW;
  const BLUE = '#5f9fcf', LIGHT = '#a8cbe6';
  for (let i = 0; i < g.cols; i++) {
    const xr = R - i * step, xm = xr - g.rubyW, xl = xm - g.w;
    line(xm, T, xm, B, 0.2, BLUE);                                 // マスと 読みがなの さかい
    line(xl, T, xl, B, 0.35, BLUE);                                // 行の さかい
    line(xl + g.w / 2, T, xl + g.w / 2, B, 0.18, LIGHT, '0.9 0.9'); // 十字（たて）
    for (let r = 0; r < g.rows; r++) line(xl, T + (r + 0.5) * g.h, xm, T + (r + 0.5) * g.h, 0.18, LIGHT, '0.9 0.9'); // 十字（よこ）
  }
  for (let r = 1; r < g.rows; r++) line(L, T + r * g.h, R, T + r * g.h, 0.2, BLUE);
  line(L, T, R, T, 0.45, BLUE); line(L, B, R, B, 0.45, BLUE); line(L, T, L, B, 0.45, BLUE); line(R, T, R, B, 0.45, BLUE);
  sheet.append(svg);

  const fs = Math.min(g.w, g.h) * 0.8;
  cols.forEach((col, i) => {
    const xr = R - i * step, xm = xr - g.rubyW, xl = xm - g.w;
    col.cells.forEach((ch, r) => {
      const d = abs('n-cell', xl, T + r * g.h, g.w, g.h);
      const s = el('span', '', ch); s.style.fontSize = mm(fs);
      d.append(s); sheet.append(d);
    });
    col.rubies.forEach(rb => {
      const H = rb.len * g.h, n = [...rb.reading].length;
      const d = abs('n-ruby', xm, T + rb.start * g.h, g.rubyW, H, rb.reading);
      d.textContent = rb.reading;
      d.style.fontSize = mm(Math.min(g.rubyW * 0.8, g.h * 0.32, H / n * 0.92));
      sheet.append(d);
    });
  });
  return sheet;
}

/* ================================================================
   画面を かく
   ================================================================ */
const zooms = [];
function wrap(sheet, skip) {
  const z = el('div', 'zoom' + (skip ? ' skip' : ''));
  z.append(sheet); zooms.push(z);
  return z;
}
function fitZoom() {
  const box = $('#sheets');
  const avail = box.clientWidth - 4;
  zooms.forEach(z => {
    const w = parseFloat(z.firstChild.style.width) * 96 / 25.4;
    z.style.zoom = Math.min(1, avail / w).toFixed(4);
  });
}
function markLast() {
  const list = zooms.filter(z => !z.classList.contains('skip'));
  zooms.forEach(z => z.classList.remove('last'));
  if (list.length) list[list.length - 1].classList.add('last');
}

function renderAll() {
  document.body.classList.toggle('tab-test', st.tab === 'test');
  document.body.classList.toggle('tab-note', st.tab === 'note');
  document.body.classList.toggle('tab-data', st.tab === 'data');
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === st.tab));
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === st.tab));
  renderSide();
  const box = $('#sheets');
  box.textContent = ''; zooms.length = 0;
  if (st.tab === 'test') renderTestSheets(box);
  else if (st.tab === 'note') renderNoteSheets(box);
  markLast();
  fitZoom();
}

function renderTestSheets(box) {
  const t = st.test;
  if (!Array.isArray(t.questions)) regen(false);
  const g = KP.testGeometry(t.count);
  const qs = t.questions;
  const lab1 = el('p', 'sheet-label', '問題');
  box.append(lab1, wrap(testSheet(qs, false)));
  const lab2 = el('p', 'sheet-label ans', '答え');
  if (!t.answers) lab2.append(el('span', 'off', '（印刷しない）'));
  box.append(lab2, wrap(testSheet(qs, true), !t.answers));

  const n = $('#notice'); n.textContent = '';
  const k = kinds();
  n.append(`用紙：${KP.PAPERS[g.paper].label}（印刷は 倍率「100%（実際の サイズ）」で）・読み ${k.yomi}問／書き ${k.kaki}問・使える 例文 ${pool().filter(p => KP.eligible(p, curRange())).length}こ。問題に マウスを のせると「⇄ 入れかえ・直す・出さない」が 出ます。`);
  const long = qs.map((q, i) => { const p = KP.parseSentence(q.line); return !p.error && KP.tooLong(p, q.kind, g) ? CIRCLED[i] : ''; }).filter(Boolean);
  if (long.length) n.append(el('span', 'warn', `　${long.join('')}の 文が ながくて 入りきりません（「直す」で みじかく して ください）。`));
  const short = t.count - qs.length;
  if (!bankItems.some(p => !p.error)) n.append(el('span', 'warn', '　まだ 例文が ありません。「例文・単元」で 入れて ください。'));
  else if (short > 0) n.append(el('span', 'warn', `　例文が ${short}こ たりません（はんいを ひろげるか、例文を ふやして ください）。`));
}

function renderNoteSheets(box) {
  const t = st.note;
  const g = KP.noteGeometry(t.size, t.paper);
  const res = KP.layoutNote(t.words, t.size);
  res.pages.forEach((cols, i) => {
    if (res.pages.length > 1) box.append(el('p', 'sheet-label', `${i + 1}まいめ`));
    box.append(wrap(noteSheet(cols, g)));
  });
  const errs = $('#n-errs'); errs.textContent = '';
  res.errors.forEach(e => { const li = el('li'); li.append(`${e.lineNo}行目：`, el('code', '', e.line), `　${e.error}`); errs.append(li); });
  const P = KP.PAPERS[g.paper];
  const sz = KP.noteSize(t.size);
  $('#notice').textContent = `用紙：${g.paper}（${P.w}×${P.h}mm）・${sz.id}字（${sz.rows}字×${sz.cols}行、マス ${sizeLabel(sz)}）・${res.pages.length}まい。印刷は 倍率「100%（実際の サイズ）」で。`;
}
const sizeLabel = s => (s.w === s.h ? `${s.w}mm` : `${s.w}×${s.h}mm`);

/* ---------- 左の 設定 ---------- */
function setSeg(id, v) { $$(id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }
function renderSide() {
  const t = st.test;
  $('#t-title').value = t.title;
  setSeg('#t-count', t.count);
  setSeg('#t-kind', t.kind);
  setSeg('#t-range', t.range);
  setSeg('#t-cross', t.cross ? 1 : 0);
  $('#t-mix').classList.toggle('on', t.kind === 'mix');
  const k = kinds();
  $('#t-yomi').textContent = k.yomi; $('#t-kaki').textContent = k.kaki;
  $('#b-ans').checked = !!t.answers;
  renderRange();
  renderSaved();

  const n = st.note;
  $('#n-title').value = n.title;
  setSeg('#n-size', n.size);
  setSeg('#n-paper', n.paper);
  if ($('#n-words').value !== n.words) $('#n-words').value = n.words;
}

function countByKanji() {
  const m = new Map();
  pool().forEach(p => p.target.kanji.forEach(c => m.set(c, (m.get(c) || 0) + 1)));
  return m;
}
function renderRange() {
  const t = st.test, body = $('#t-range-body');
  body.textContent = '';
  const goData = () => { const p = el('p', 'empty'); p.append('単元が まだ ありません。'); const a = el('a', '', '「例文・単元」'); a.addEventListener('click', () => setTab('data')); p.append(a, 'で 入れて ください。'); return p; };
  if (t.range === 'term') {
    if (!unitData.units.length) body.append(goData());
    else {
      const chips = el('div', 'chips');
      [1, 2, 3].forEach(n => {
        const b = el('button', t.terms.includes(n) ? 'on' : '', `${n}学期`);
        b.addEventListener('click', () => { t.terms = toggle(t.terms, n).sort(); changed(); });
        chips.append(b);
      });
      body.append(chips);
    }
  } else if (t.range === 'unit') {
    if (!unitData.units.length) body.append(goData());
    else {
      const ul = el('ul', 'ulist');
      unitData.units.forEach((u, i) => {
        const li = el('li'), lb = el('label'), cb = el('input');
        cb.type = 'checkbox'; cb.checked = t.units.includes(i);
        cb.addEventListener('change', () => { t.units = toggle(t.units, i).sort((a, b) => a - b); changed(); });
        lb.append(cb, el('span', '', `${u.term}学期　${u.name}`), el('span', 'k', u.kanji.join('')));
        li.append(lb); ul.append(li);
      });
      body.append(ul);
    }
  } else {
    const cnt = countByKanji();
    const row = el('div', 'row-btns');
    const all = el('button', 'btn', 'ぜんぶ'), none = el('button', 'btn', 'なし'), has = el('button', 'btn', '例文が ある 字');
    all.addEventListener('click', () => { t.kanji = [...KP.KANJI2]; changed(); });
    none.addEventListener('click', () => { t.kanji = []; changed(); });
    has.addEventListener('click', () => { t.kanji = [...KP.KANJI2].filter(c => cnt.get(c)); changed(); });
    row.append(all, none, has);
    const grid = el('div', 'kgrid');
    [...KP.KANJI2].forEach(c => {
      const n = cnt.get(c) || 0;
      const b = el('button', (t.kanji.includes(c) ? 'on' : '') + (n ? '' : ' zero'));
      b.append(c, el('i', '', n));
      b.title = `${c}：例文 ${n}こ`;
      b.addEventListener('click', () => { t.kanji = toggle(t.kanji, c); changed(); });
      grid.append(b);
    });
    body.append(grid, row);
  }
  const R = curRange();
  $('#t-range-info').textContent = `出す 漢字 ${R.R.size}字・使える 例文 ${pool().filter(p => KP.eligible(p, R)).length}こ。習う 漢字から、かたよりなく 出します。`;
}
const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.concat([v]));

function renderSaved() {
  const ul = $('#t-saved'); ul.textContent = '';
  st.saved.forEach((s, i) => {
    const li = el('li');
    const d = new Date(s.at);
    li.append(el('span', '', s.name), el('small', '', `${d.getMonth() + 1}/${d.getDate()}`));
    const open = el('button', '', 'ひらく'), del = el('button', '', 'けす');
    open.addEventListener('click', () => { st.test = Object.assign(clone(DEF.test), clone(s.test)); save(); renderAll(); toast(`「${s.name}」を ひらきました`); });
    del.addEventListener('click', () => { if (confirm(`「${s.name}」を けしますか？`)) { st.saved.splice(i, 1); save(); renderSaved(); } });
    li.append(open, del); ul.append(li);
  });
}

/* ---------- 例文・単元 ---------- */
function renderData() {
  if ($('#d-bank').value !== st.bank) $('#d-bank').value = st.bank;
  if ($('#d-units').value !== st.units) $('#d-units').value = st.units;
  const ok = bankItems.filter(p => !p.error);
  $('#d-bank-count').textContent = `（使える 例文 ${pool().length}こ${st.hidden.length ? `・出さない ${ok.length - pool().length}こ` : ''}）`;
  const errs = $('#d-bank-errs'); errs.textContent = '';
  bankItems.forEach(p => {
    if (p.error) { const li = el('li'); li.append(`${p.lineNo}行目：`, el('code', '', p.line), `　${p.error}`); errs.append(li); }
    else if (p.unknown && p.unknown.length) { const li = el('li', 'warn'); li.append(`${p.lineNo}行目：`, el('code', '', p.line), `　1・2年で 習わない 漢字（${p.unknown.join('・')}）が あります`); errs.append(li); }
  });
  const cnt = countByKanji();
  const grid = $('#d-cover'); grid.textContent = '';
  [...KP.KANJI2].forEach(c => { const n = cnt.get(c) || 0; const s = el('span', n ? '' : 'zero'); s.append(c, el('i', '', n)); grid.append(s); });
  const hul = $('#d-hidden'); hul.textContent = '';
  $('#d-hidden-wrap').style.display = st.hidden.length ? '' : 'none';
  st.hidden.forEach((line, i) => {
    const li = el('li'); li.append(el('span', '', line));
    const b = el('button', '', 'もどす');
    b.addEventListener('click', () => { st.hidden.splice(i, 1); dataChanged(); });
    li.append(b); hul.append(li);
  });

  $('#d-unit-count').textContent = `（${unitData.units.length}単元・${new Set(unitData.units.flatMap(u => u.kanji)).size}字）`;
  const ue = $('#d-unit-errs'); ue.textContent = '';
  unitData.errors.forEach(e => { const li = el('li'); li.append(`${e.lineNo}行目：`, el('code', '', e.line), `　${e.error}`); ue.append(li); });
  const tb = $('#d-unit-table'); tb.textContent = '';
  if (unitData.units.length) {
    const h = el('tr'); ['学期', '単元', '漢字', '例文'].forEach(x => h.append(el('th', '', x))); tb.append(h);
    unitData.units.forEach(u => {
      const tr = el('tr');
      const n = pool().filter(p => p.target.kanji.some(c => u.kanji.includes(c))).length;
      tr.append(el('td', '', `${u.term}学期`), el('td', '', u.name), el('td', 'k', u.kanji.join('')), el('td', '', `${n}こ`));
      tb.append(tr);
    });
  }
}
let dataTimer = 0;
function dataChanged() {
  parseData();
  st.test.questions = null;                           // つぎに テストを ひらいた ときに 作り直す
  save(); renderData();
}

/* ---------- 入力 ---------- */
function changed() { regen(false); renderAll(); }
function setTab(tab) { st.tab = tab; save(); renderAll(); if (tab === 'data') renderData(); window.scrollTo(0, 0); }

function bind() {
  $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#t-title').addEventListener('input', e => { st.test.title = e.target.value; save(); renderAllSoon(); });
  $$('#t-count button').forEach(b => b.addEventListener('click', () => {
    const t = st.test; const old = t.count; t.count = +b.dataset.v;
    t.yomi = Math.round(t.yomi * t.count / old); changed();
  }));
  $$('#t-kind button').forEach(b => b.addEventListener('click', () => { st.test.kind = b.dataset.v; changed(); }));
  $$('#t-mix .step').forEach(b => b.addEventListener('click', () => { const t = st.test; t.yomi = Math.max(0, Math.min(t.count, kinds().yomi + +b.dataset.d)); changed(); }));
  $$('#t-range button').forEach(b => b.addEventListener('click', () => { st.test.range = b.dataset.v; changed(); }));
  $$('#t-cross button').forEach(b => b.addEventListener('click', () => { st.test.cross = b.dataset.v === '1'; save(); renderAll(); }));
  $('#b-ans').addEventListener('change', e => { st.test.answers = e.target.checked; save(); renderAll(); });
  $('#b-remake').addEventListener('click', () => { regen(true); renderAll(); toast('ちがう 問題で 作り直しました'); });
  $('#b-print').addEventListener('click', doPrint);
  $('#b-pdf').addEventListener('click', () => { toast('印刷の 画面で「送り先」を「PDFに 保存」に して ください', 4000); setTimeout(doPrint, 600); });
  $('#t-save').addEventListener('click', () => {
    const name = $('#t-save-name').value.trim() || `${st.test.title}（${new Date().toLocaleDateString('ja-JP')}）`;
    st.saved.unshift({ name, at: Date.now(), test: clone(st.test) });
    $('#t-save-name').value = ''; save(); renderSaved(); toast('保存しました');
  });

  const sizes = $('#n-size');
  KP.NOTE_SIZES.forEach(s => { const b = el('button'); b.dataset.v = s.id; b.append(el('b', '', `${s.id}字`), el('span', '', sizeLabel(s))); sizes.append(b); });
  $$('#n-size button').forEach(b => b.addEventListener('click', () => { st.note.size = +b.dataset.v; save(); renderAll(); }));
  $$('#n-paper button').forEach(b => b.addEventListener('click', () => { st.note.paper = b.dataset.v; save(); renderAll(); }));
  $('#n-title').addEventListener('input', e => { st.note.title = e.target.value; save(); renderAllSoon(); });
  $('#n-words').addEventListener('input', e => { st.note.words = e.target.value; save(); renderAllSoon(); });

  $('#d-bank').addEventListener('input', e => { st.bank = e.target.value; clearTimeout(dataTimer); dataTimer = setTimeout(dataChanged, 300); });
  $('#d-units').addEventListener('input', e => { st.units = e.target.value; clearTimeout(dataTimer); dataTimer = setTimeout(dataChanged, 300); });
  $('#d-sample').addEventListener('click', () => {
    const have = new Set(st.bank.split(/\r?\n/).map(KP.normalize));
    const add = SAMPLE.filter(l => !have.has(KP.normalize(l)));
    if (!add.length) { toast('見本は もう 入って います'); return; }
    st.bank = (st.bank.trim() ? st.bank.replace(/\s*$/, '\n') : '') + add.join('\n');
    dataChanged(); toast('見本の 例文を たしました');
  });
  $('#d-export').addEventListener('click', () => {
    const data = { app: 'kanji-purinto', version: 1, bank: st.bank, units: st.units, hidden: st.hidden, saved: st.saved };
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const d = new Date();
    a.download = `kanji-purinto-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#d-import').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    f.text().then(txt => {
      let d;
      try { d = JSON.parse(txt); } catch (err) { d = null; }
      if (!d || d.app !== 'kanji-purinto') { alert('かんじプリントの ファイルでは ありません'); return; }
      if (!confirm('いまの 例文・単元・保存した 問題を、ファイルの なかみに 入れかえます。よいですか？')) return;
      st.bank = String(d.bank || ''); st.units = String(d.units || '');
      st.hidden = Array.isArray(d.hidden) ? d.hidden : []; st.saved = Array.isArray(d.saved) ? d.saved : [];
      dataChanged(); renderSide(); toast('よみこみました');
    });
  });

  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitZoom, 100); });
}
let fitTimer = 0, renderTimer = 0;
function renderAllSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(renderAll, 150); }

function doPrint() {
  const go = () => window.print();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
}

parseData();
bind();
renderAll();
if (st.tab === 'data') renderData();
})();
