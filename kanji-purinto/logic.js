/* かんじプリント の しくみ（画面に かかわらない ぶぶん）
   index.html から よみこみ、tests.js（node）でも そのまま しらべます。 */
(function (root) {
'use strict';

/* ---------- 学年別漢字配当表（小学校学習指導要領） ---------- */
const KANJI1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
const KANJI2 = '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';

const isKanji = ch => /^[㐀-鿿豈-﫿々〆]$/.test(ch);
const isKana = ch => /^[ぁ-ゖァ-ヺー]$/.test(ch);
const isHiraWord = s => /^[ぁ-ゖー]+$/.test(s);

/* 全角の かっこ・空白を そろえる */
function normalize(s) {
  return String(s)
    .replace(/［/g, '[').replace(/］/g, ']')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/[ 　\t]+/g, ' ')
    .trim();
}

/* ================================================================
   例文：「[近く](ちかく)の 公園」のように、もんだいに する ところを
   [ ] で かこみ、すぐ うしろの ( ) に 読みを 書く。1行に 1もん。
   ================================================================ */
function parseSentence(raw) {
  const line = normalize(raw);
  const m = line.match(/^([^\[\]]*)\[([^\[\]()]+)\]\(([^()]*)\)(.*)$/);
  if (!m) {
    if (!/[\[\]]/.test(line)) return { line, error: 'もんだいに する ところを [ ] で かこんで ください（れい：[色](いろ)がみを おる）' };
    return { line, error: '[ ] の すぐ うしろに ( ) で 読みを 書いて ください' };
  }
  const before = m[1], inner = m[2].replace(/ /g, ''), reading = m[3].replace(/ /g, ''), after = m[4];
  if (/[\[\]]/.test(after)) return { line, error: '1行に もんだいは 1つだけです' };
  if (/[()]/.test(before + after)) return { line, error: '( ) は [ ] の すぐ うしろだけに 書けます' };
  const chars = [...inner];
  if (!isKanji(chars[0])) return { line, error: '[ ] の 中は 漢字から はじめて ください' };
  if (!reading) return { line, error: '( ) の 中に 読みを 書いて ください' };
  if (!isHiraWord(reading)) return { line, error: '読みは ひらがなで 書いて ください' };
  for (const ch of chars) if (!isKanji(ch) && !isKana(ch)) return { line, error: `[ ] の 中に 使えない 字が あります（${ch}）` };
  let k = chars.length;
  while (k > 0 && !isKanji(chars[k - 1])) k--;
  const okuri = chars.slice(k).join('');
  const head = chars.slice(0, k);                       // 送りがなを のぞいた ところ（漢字で はじまり 漢字で おわる）
  if (okuri && !reading.endsWith(okuri)) return { line, error: `送りがな「${okuri}」と 読み「${reading}」が あいません` };
  const headReading = reading.slice(0, reading.length - okuri.length);
  if (!headReading) return { line, error: '読みが たりません' };
  return {
    line, before, after,
    target: {
      text: inner, chars, head: head.join(''), okuri, reading, headReading,
      kanji: [...new Set(chars.filter(isKanji))],
      kana: chars.some(c => !isKanji(c)),               // 送りがな・まんなかの かなが ある → 書きは（ ）に する
    },
  };
}

/* 例文の 一覧（テキスト）を よむ。空の 行と # で はじまる 行は とばす */
function parseBank(text) {
  const items = [];
  const seen = new Set();
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const s = normalize(raw);
    if (!s || s[0] === '#' || s[0] === '＃') return;
    const p = parseSentence(s);
    p.lineNo = i + 1;
    if (!p.error && seen.has(p.line)) p.error = '同じ 例文が 上にも あります';
    if (!p.error) seen.add(p.line);
    if (!p.error) {
      const others = [...(p.before + p.after)].filter(isKanji);
      p.unknown = [...new Set(others.concat(p.target.kanji).filter(c => !KANJI1.includes(c) && !KANJI2.includes(c)))];
    }
    items.push(p);
  });
  return items;
}

/* ================================================================
   単元：「学期, 単元名, 漢字」を 1行に 1つ。エクセルから はりつけた
   タブでも、カンマ・｜ でも よい。
   ================================================================ */
function parseUnits(text) {
  const units = [], errors = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const s = raw.trim();
    if (!s || s[0] === '#' || s[0] === '＃') return;
    const parts = s.split(/\t|,|，|\||｜/).map(x => x.trim());
    if (parts.length < 3) { errors.push({ lineNo: i + 1, line: s, error: '「学期, 単元名, 漢字」の 3つを 書いて ください' }); return; }
    const t = parts[0].replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).match(/[1-3]/);
    if (!t) { errors.push({ lineNo: i + 1, line: s, error: '学期は 1・2・3 の どれかです' }); return; }
    const kanji = [...new Set([...parts.slice(2).join('')].filter(isKanji))];
    if (!kanji.length) { errors.push({ lineNo: i + 1, line: s, error: '漢字が ありません' }); return; }
    units.push({ term: +t[0], name: parts[1] || '（名前なし）', kanji, lineNo: i + 1 });
  });
  return { units, errors };
}

/* ================================================================
   出す はんい
   R = 出したい 漢字。allowed = もう 習った ことに して よい 漢字。
   ================================================================ */
function rangeOf(units, mode, sel) {
  const R = new Set();
  const allowed = new Set(KANJI1);
  if (mode === 'kanji') {
    (sel || []).forEach(c => { R.add(c); allowed.add(c); });
    return { R, allowed };
  }
  let last = -1;
  units.forEach((u, i) => {
    const on = mode === 'term' ? (sel || []).includes(u.term) : (sel || []).includes(i);
    if (on) { u.kanji.forEach(c => R.add(c)); last = i; }
  });
  units.forEach((u, i) => { if (i <= last) u.kanji.forEach(c => allowed.add(c)); });
  return { R, allowed };
}

const eligible = (p, range) =>
  !p.error && p.target.kanji.some(c => range.R.has(c)) && p.target.kanji.every(c => range.allowed.has(c));

/* ---------- じゅんばんが きまる 乱数 ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* まだ 出て いない 漢字を ふくむ 例文を さきに えらぶ（かたよりなく） */
function bestNext(cands, range, cover) {
  let best = null, bestScore = -Infinity;
  for (const p of cands) {
    const ks = p.target.kanji.filter(c => range.R.has(c));
    const fresh = ks.filter(c => !cover.get(c)).length;
    const least = Math.min(...ks.map(c => cover.get(c) || 0));
    const score = fresh * 100 - least;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return best;
}
function addCover(cover, p, range) { p.target.kanji.forEach(c => { if (range.R.has(c)) cover.set(c, (cover.get(c) || 0) + 1); }); }

/* もんだいを えらぶ。kinds = { yomi: 読みの 数, kaki: 書きの 数 } */
function pickQuestions(bank, range, kinds, seed) {
  const r = rng(seed);
  const pool = shuffle(bank.filter(p => eligible(p, range)), r);
  const n = kinds.yomi + kinds.kaki;
  const picked = [], cover = new Map();
  while (picked.length < n) {
    const cands = pool.filter(p => !picked.includes(p));
    if (!cands.length) break;
    const p = bestNext(cands, range, cover);
    picked.push(p); addCover(cover, p, range);
  }
  const kindList = shuffle(picked.map((_, i) => (i < kinds.yomi ? 'yomi' : 'kaki')), r);
  const qs = picked.map((p, i) => ({ line: p.line, kind: kindList[i] }));
  // 読みの もんだいを さきに、書きを あとに
  qs.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'yomi' ? -1 : 1));
  return { questions: qs, poolSize: pool.length, short: Math.max(0, n - picked.length) };
}

/* 1もんだけ ほかの 例文に 入れかえる */
function replaceOne(questions, idx, bank, range, seed) {
  const r = rng(seed);
  const used = new Set(questions.map(q => q.line));
  const cands = shuffle(bank.filter(p => eligible(p, range) && !used.has(p.line)), r);
  if (!cands.length) return null;
  const cover = new Map();
  const byLine = new Map(bank.filter(p => !p.error).map(p => [p.line, p]));
  questions.forEach((q, i) => { const p = byLine.get(q.line); if (i !== idx && p) addCover(cover, p, range); });
  const p = bestNext(cands, range, cover);
  return { line: p.line, kind: questions[idx].kind };
}

/* ================================================================
   テストの 紙の 大きさ（mm）。15もんから B4、それより 少なければ A4。
   どちらも よこ向き。たて書きで、右に だい名、左に れんしゅうの マス。
   ================================================================ */
const PAPERS = {
  A4L: { w: 297, h: 210, label: 'A4 よこ' },
  B4L: { w: 364, h: 257, label: 'B4 よこ' },          // JIS B4
  B5: { w: 182, h: 257, label: 'B5' },                // JIS B5（市販の ノートと 同じ）
  A4: { w: 210, h: 297, label: 'A4' },
};
function testGeometry(n) {
  const paper = n >= 15 ? 'B4L' : 'A4L';
  const P = PAPERS[paper];
  const m = 10;                                       // まわりの 余白
  const headW = 20;                                   // だい名・名前の 列
  const rows = n <= 5 ? 1 : 2;
  const perRow = Math.ceil(n / rows);
  const innerH = P.h - m * 2;
  const sq = Math.min(paper === 'B4L' ? 22 : 18, innerH / 10);  // れんしゅうの マス（よこ2れつ・たて10マス）
  const practiceW = sq * 2;
  const labelW = 6;
  const qW = P.w - m * 2 - headW - practiceW - labelW - 8;
  const colW = qW / perRow;
  const rowH = (innerH - (rows - 1) * 0) / rows;
  return { paper, w: P.w, h: P.h, m, headW, rows, perRow, sq, practiceW, labelW, qW, colW, rowH };
}

/* 1もんの 文の ながさ（字の 大きさ c を 1 と した とき）*/
const BOX = 1.45;                                     // □の 大きさ
const SIDE = 0.85;                                    // 右の 読みがな・読みの 答えの はば
function sentenceUnits(p, kind) {
  const plain = s => [...s].reduce((a, ch) => a + (ch === ' ' ? 0.5 : 1), 0);
  const t = p.target;
  let mid;
  if (kind === 'kaki') mid = t.kana ? [...t.text].length * 1.1 + 0.8 : t.chars.length * BOX + 0.15 * (t.chars.length - 1);
  else mid = Math.max([...t.head].length, [...t.headReading].length * 0.7) + 0.3 + [...t.okuri].length;
  return 1.6 + plain(p.before) + mid + plain(p.after);   // 1.6 = ばんごう
}
function charSize(p, kind, geo) {
  const byW = geo.colW / (BOX + SIDE);
  const byH = (geo.rowH - 8) / sentenceUnits(p, kind);
  return Math.max(4, Math.min(geo.rows === 1 ? 13 : 10, byW, byH));
}
/* 字を いちばん 小さく しても だんに 入らない 文 */
const tooLong = (p, kind, geo) => sentenceUnits(p, kind) * charSize(p, kind, geo) > geo.rowH - 8 + 1e-6;

/* ================================================================
   漢字ノート。市販の 漢字練習帳（ジャポニカ学習帳 かんじれんしゅう・
   漢字練習帳 B5）と 同じ マス。w×h は よこ×たて（mm）。
   cols＝たての 行の 数、rows＝1行の 字数。
   ================================================================ */
const NOTE_SIZES = [
  { id: 50, cols: 5, rows: 10, w: 22, h: 22 },
  { id: 84, cols: 7, rows: 12, w: 18, h: 17 },
  { id: 91, cols: 7, rows: 13, w: 17, h: 17 },
  { id: 104, cols: 8, rows: 13, w: 17, h: 15 },
  { id: 120, cols: 8, rows: 15, w: 14, h: 14 },
  { id: 150, cols: 10, rows: 15, w: 14, h: 12 },
  { id: 200, cols: 10, rows: 20, w: 11, h: 11 },
];
const noteSize = id => NOTE_SIZES.find(s => s.id === +id) || NOTE_SIZES[1];

function noteGeometry(sizeId, paperId) {
  const s = noteSize(sizeId);
  const P = PAPERS[paperId === 'A4' ? 'A4' : 'B5'];
  const maxW = 169;                                   // B5 で 左右 6.5mm ずつ のこす（A4 でも 同じ 大きさ）
  const rubyW = Math.max(2.5, Math.min(s.w * 0.4, (maxW - s.cols * s.w) / s.cols));
  const gridW = s.cols * (s.w + rubyW);
  const gridH = s.rows * s.h;
  const headH = 9;
  const left = (P.w - gridW) / 2;
  const top = Math.max(6, (P.h - gridH - headH) / 2) + headH;
  return Object.assign({}, s, { paper: paperId === 'A4' ? 'A4' : 'B5', pw: P.w, ph: P.h, rubyW, gridW, gridH, headH, left, top });
}

/* ノートの ことば：「春の風(はるのかぜ)」「花(はな)火(び)」 */
function parseWord(raw) {
  const s = normalize(raw).replace(/ /g, '');
  const chars = [], rubies = [];
  const re = /([^()]*)\(([^()]*)\)|([^()]+)$/g;
  let m, used = 0;
  while ((m = re.exec(s)) && m[0]) {
    used += m[0].length;
    const text = m[1] !== undefined ? m[1] : m[3];
    const start = chars.length;
    [...text].forEach(c => chars.push(c));
    if (m[2] !== undefined && m[2] !== '') rubies.push(...alignRuby([...text], m[2], start));
  }
  if (used !== s.length || /[()]/.test(chars.join(''))) return { error: '( ) の 書き方を たしかめて ください', chars: [...s.replace(/[()]/g, '')], rubies: [] };
  return { chars, rubies };
}

/* 読みを 漢字の かたまりに わりふる。かなが 読みの 中に あれば それを 目じるしに する */
function alignRuby(chars, reading, offset) {
  const runs = [];
  chars.forEach((c, i) => {
    const k = isKanji(c);
    const last = runs[runs.length - 1];
    if (last && last.k === k) last.len++;
    else runs.push({ k, start: i, len: 1 });
  });
  const kanjiRuns = runs.filter(r => r.k);
  if (!kanjiRuns.length) return [];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pat = '^' + runs.map(r => (r.k ? '(.+?)' : esc(chars.slice(r.start, r.start + r.len).join('')))).join('') + '$';
  const m = reading.match(new RegExp(pat));
  if (m) return kanjiRuns.map((r, i) => ({ start: offset + r.start, len: r.len, reading: m[i + 1] }));
  // あわない とき：漢字の かたまりが 1つなら そこに（「の風(かぜ)」）、2つ いじょうなら ことば ぜんぶに
  if (kanjiRuns.length === 1) return [{ start: offset + kanjiRuns[0].start, len: kanjiRuns[0].len, reading }];
  return [{ start: offset, len: chars.length, reading }];
}

/* ことばを 行（たての れつ）に ならべる。1行に 1つ。ながい ことばは つぎの 行へ。
   空の 行は 空の れつ（あけて おく）。 */
function layoutNote(text, sizeId) {
  const s = noteSize(sizeId);
  const lines = String(text || '').split(/\r?\n/);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const cols = [], errors = [];
  lines.forEach((raw, i) => {
    if (!raw.trim()) { cols.push({ cells: [], rubies: [] }); return; }
    const w = parseWord(raw);
    if (w.error) errors.push({ lineNo: i + 1, line: raw.trim(), error: w.error });
    for (let st = 0; st < Math.max(1, w.chars.length); st += s.rows) {
      const en = st + s.rows;
      cols.push({
        cells: w.chars.slice(st, en),
        rubies: w.rubies.filter(r => r.start < en && r.start + r.len > st).map(r => {
          const a = Math.max(r.start, st), b = Math.min(r.start + r.len, en);
          const rc = [...r.reading];
          const ra = Math.round(rc.length * (a - r.start) / r.len), rb = Math.round(rc.length * (b - r.start) / r.len);
          return { start: a - st, len: b - a, reading: rc.slice(ra, rb).join('') };
        }).filter(r => r.reading),
      });
    }
  });
  const pages = [];
  for (let i = 0; i < Math.max(1, cols.length); i += s.cols) pages.push(cols.slice(i, i + s.cols));
  return { pages, errors };
}

/* 学年の 数字を 漢数字に（タイトル用） */
const KANSUJI = ['', '一', '二', '三', '四', '五', '六'];

const KP = {
  KANJI1, KANJI2, isKanji, isKana, normalize,
  parseSentence, parseBank, parseUnits, rangeOf, eligible,
  rng, shuffle, pickQuestions, replaceOne,
  PAPERS, testGeometry, sentenceUnits, charSize, tooLong, BOX, SIDE,
  NOTE_SIZES, noteSize, noteGeometry, parseWord, alignRuby, layoutNote, KANSUJI,
};
root.KP = KP;
if (typeof module !== 'undefined' && module.exports) module.exports = KP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
