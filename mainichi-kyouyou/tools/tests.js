/* 毎日教養 ── 画面を 使わない 処理（logic.js）と 問題データを ためす
   つかいかた： node mainichi-kyouyou/tools/tests.js
   まちがいが あれば 終了コード 1。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'base.js'), 'utf8') + ';this.MKData=MKData;', ctx);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dataFiles = Array.from(html.matchAll(/<script src="(data\/[a-z]+\.js)"/g)).map(m => m[1]).filter(f => !f.endsWith('/base.js'));
dataFiles.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
vm.runInContext(fs.readFileSync(path.join(ROOT, 'logic.js'), 'utf8'), ctx);
const L = ctx.MKLogic;
const D = ctx.MKData;

let fails = 0, passes = 0;
function ok(cond, msg) {
    if (cond) passes++;
    else { fails++; console.log('  NG  ' + msg); }
}
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + '（' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b) + '）'); }
function section(name) { console.log('■ ' + name); }

/* ---------- 問題データ ---------- */
section('問題データ');
eq(dataFiles.length, 20, 'index.html が 20ジャンルの データを 読みこむ');
eq(L.validate(D), [], 'データに まちがいが ない');
const Q = L.buildQuestions(D);
eq(Q.list.length, 2000, '問題は 2000問');
D.GENRES.forEach(g => eq((D.rows[g.id] || []).length, 100, g.id + ' は 100問'));
eq(Object.keys(Q.byId).length, 2000, 'id が すべて ちがう');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
// sw.js の 保存一覧（ジャンル id から 作る）：ジャンルが そろい、どの ファイルも 実在する（1つでも ないと オフライン用の 保存が 失敗する）
const swCtx = { self: { addEventListener() {} }, location: { origin: '' } };
vm.createContext(swCtx);
vm.runInContext(sw + ';this.__G=GENRES;this.__F=FILES;', swCtx);
eq(Array.from(swCtx.__G), D.GENRES.map(g => g.id), 'sw.js の ジャンルが データと 同じ');
dataFiles.forEach(f => ok(swCtx.__F.includes('./' + f), 'sw.js の 保存一覧に ' + f + ' が ある'));
swCtx.__F.filter(f => f !== './').forEach(f => ok(fs.existsSync(path.join(ROOT, f)), f + ' が 実在する'));

/* 公開の しかた（GitHub Pages は Jekyll で ページを つくる）で ファイルが 消えない
   Jekyll は 名前が「_」や「.」で はじまる ファイル・フォルダーを 公開しない。index.html が 読みこむ ファイルが 1つでも 消えると、
   画面が 空の まま 何も おせなく なる（data/_base.js で じっさいに おきた）。 */
const loaded = Array.from(html.matchAll(/(?:src|href)="([^"#:]+)"/g)).map(m => m[1]).filter(f => !f.startsWith('http'));
ok(loaded.length > 20, 'index.html が 読みこむ ファイルを 見つけた（' + loaded.length + '）');
loaded.forEach(f => {
    ok(fs.existsSync(path.join(ROOT, f)), f + ' が 実在する');
    ok(!f.split('/').some(seg => /^[_.]/.test(seg) && seg !== '.' && seg !== '..'), f + ' の 名前が「_」「.」で はじまらない（Jekyll で 消えない）');
});
(function walk(dir) {
    fs.readdirSync(dir).forEach(name => {
        const full = path.join(dir, name);
        const rel = path.relative(ROOT, full);
        if (rel.startsWith('tools')) return;
        ok(!/^[_.]/.test(name), rel + ' の 名前が「_」「.」で はじまらない');
        if (fs.statSync(full).isDirectory()) walk(full);
    });
})(ROOT);

/* validate が まちがいを 見つける */
const bad = { GENRES: [{ id: 'x' }], rows: { x: [
    ['A', '問1', ['a', 'b', 'c', 'd'], '解説', ['1', '2', '3'], '点'],
    ['A', '問2', ['a', 'b', 'c', 'd'], '解説', ['1', '2', '3'], '点'],
    ['B', '問1', ['a', 'b', 'c', 'd'], '解説', ['1', '2', '3'], '点'],
    ['C', '問3', ['a', 'a', 'c', 'd'], '解説', ['1', '2', '3'], '点'],
    ['D', '問4', ['a', 'b', 'c'], '', ['1', '2'], '点'],
    ['E', '問5']
] } };
const errs = L.validate(bad);
ok(errs.some(e => e.includes('テーマが 重なって')), 'テーマの 重なりを 見つける');
ok(errs.some(e => e.includes('同じ 問題文')), '問題文の 重なりを 見つける');
ok(errs.some(e => e.includes('同じ 選択肢')), '同じ 選択肢を 見つける');
ok(errs.some(e => e.includes('選択肢が 4つ でない')), '選択肢の 数の まちがいを 見つける');
ok(errs.some(e => e.includes('解説が 空')), '空の 解説を 見つける');
ok(errs.some(e => e.includes('説明が 3つ でない')), '説明の 数の まちがいを 見つける');
ok(errs.some(e => e.includes('要素が 6つ でない')), '行の 形の まちがいを 見つける');

/* ---------- 日付・乱数 ---------- */
section('日付・乱数');
const d0 = new Date(2026, 9, 18, 23, 59);
const n0 = L.dayNum(d0);
eq(L.dayNum(new Date(2026, 9, 18, 0, 1)), n0, '同じ日なら 時刻に よらず 同じ 番号');
eq(L.dayNum(new Date(2026, 9, 19, 0, 0)), n0 + 1, '次の日は 1 ふえる');
eq(L.dayLabel(n0), '10/18', '日付の 表示');
eq(L.dayNum(L.dayToDate(n0)), n0, '番号 → 日付 → 番号 が もどる');
eq(L.dayNum(new Date(2024, 1, 29)) + 1, L.dayNum(new Date(2024, 2, 1)), 'うるう年の 2月29日の 次は 3月1日');
const r1 = L.rng(42), r2 = L.rng(42);
const a1 = [r1(), r1(), r1()], a2 = [r2(), r2(), r2()];
eq(a1, a2, '同じ 種なら 同じ 乱数');
ok(a1.every(x => x >= 0 && x < 1), '乱数は 0以上 1未満');
const sh = L.shuffle([1, 2, 3, 4, 5, 6, 7], L.rng(3));
eq(sh.slice().sort(), [1, 2, 3, 4, 5, 6, 7], 'シャッフルは 並べかえ だけ');
const co = L.choiceOrder(L.rng(9));
eq(co.slice().sort(), [0, 1, 2, 3], '選択肢の 並びは 0〜3 を 1回ずつ');
// 正解の 位置が かたよらない
const pos = [0, 0, 0, 0];
const rr = L.rng(123);
for (let i = 0; i < 4000; i++) pos[L.choiceOrder(rr).indexOf(0)]++;
ok(pos.every(p => p > 850 && p < 1150), '正解の 位置が 4か所に ほぼ 均等（' + pos.join(',') + '）');

/* ---------- 復習の 予定 ---------- */
section('復習の 予定');
const T = 20000;
let c = L.review(null, true, 'maybe', T);
eq([c.box, c.due, c.n, c.ok], [1, T + 1, 1, 1], 'はじめて「たぶん」で 正解 → 箱1・翌日');
c = L.review(c, true, 'maybe', T + 1);
eq([c.box, c.due], [2, T + 1 + 3], '次も 正解 → 箱2・3日後');
c = L.review(c, true, 'sure', T + 4);
eq([c.box, c.due], [3, T + 4 + 7], '正解 → 箱3・1週間後');
c = L.review(c, true, 'sure', T + 11);
eq([c.box, c.due], [4, T + 11 + 21], '正解 → 箱4・3週間後');
ok(!L.isMastered(c), '箱4 は まだ「覚えた」では ない');
c = L.review(c, true, 'sure', T + 32);
eq([c.box, c.due], [5, T + 32 + 60], '3週間後も 正解 → 箱5・2か月後');
ok(L.isMastered(c), '箱5 で「覚えた」');
c = L.review(c, true, 'sure', T + 92);
c = L.review(c, true, 'sure', T + 300);
eq(c.box, 6, '箱は 6 で 止まる');
eq(c.due, T + 300 + 150, '箱6 は 5か月後');
c = L.review(c, true, 'guess', T + 450);
eq(c.box, 5, '勘で 正解 → 1つ 下の 箱');
c = L.review(c, false, 'maybe', T + 510);
eq([c.box, c.due, c.ng, c.over, !!c.overOpen], [1, T + 511, 1, 0, false], 'まちがい → 箱1・翌日');

let s = L.review(null, true, 'sure', T);
eq([s.box, s.due], [2, T + 3], 'はじめから 自信ありで 正解 → 箱2・3日後');
s = L.review(null, true, 'guess', T);
eq(s.box, 1, 'はじめて 勘で 正解 → 箱1');
s = L.review(null, true, null, T);
eq(s.box, 1, '自信を たずねない 設定でも 動く');

let o = L.review(null, false, 'sure', T);
eq([o.box, o.over, o.overOpen, o.due], [1, 1, true, T + 1], '自信ありで まちがい → 思い込み として 翌日');
o = L.review(o, true, 'guess', T + 1);
ok(o.overOpen, '勘で 当たっても 思い込みは 消えない');
o = L.review(o, true, 'maybe', T + 2);
ok(!o.overOpen, 'ちゃんと 正解すると 思い込みが 消える');
eq(o.over, 1, '思い込みの 回数は 記録に のこる');

ok(!L.isDue(null, T), '記録の ない 問題は 復習の 対象外');
ok(!L.isDue(L.newCard(T), T), '解いて いない 記録は 復習の 対象外');
ok(L.isDue(L.review(null, false, 'maybe', T), T + 1), '翌日に 復習の 対象');
ok(!L.isDue(L.review(null, false, 'maybe', T), T), '当日は まだ 対象外');

/* ---------- セットの 組み立て ---------- */
section('セットの 組み立て');
let set = L.buildSet(Q, {}, T, { size: 10 });
eq(set.length, 10, '10問 えらぶ');
eq(new Set(set).size, 10, '同じ 問題が ない');
ok(set.every(id => Q.byId[id]), 'どれも ある 問題');
const gs = set.map(id => Q.byId[id].g);
ok(gs.every((g, i) => i === 0 || g !== gs[i - 1]), 'となりの 問題は ちがう ジャンル');
ok(new Set(gs).size >= 8, '10問に いろいろな ジャンルが まざる（' + new Set(gs).size + '）');
eq(L.buildSet(Q, {}, T, { size: 10 }), set, '同じ 日なら 同じ セット');
ok(JSON.stringify(L.buildSet(Q, {}, T + 1, { size: 10 })) !== JSON.stringify(set), '日が かわれば ちがう セット');
[5, 15, 20].forEach(n => eq(L.buildSet(Q, {}, T, { size: n }).length, n, n + '問の 設定'));

// 復習は 半分まで
const cards = {};
Q.list.slice(0, 30).forEach(q => { cards[q.id] = L.review(null, false, 'maybe', T - 5); });
set = L.buildSet(Q, cards, T, { size: 10 });
eq(set.filter(id => cards[id]).length, 5, '復習が 多くても 半分（5問）まで');
eq(set.length, 10, '残りは 新しい 問題');
set = L.buildSet(Q, cards, T, { size: 10, mode: 'review' });
ok(set.length === 10 && set.every(id => cards[id]), '復習モードは 復習だけ');
// 思い込みが 先に 出る
const cards2 = {};
Q.list.slice(0, 20).forEach((q, i) => { cards2[q.id] = L.review(null, false, i === 19 ? 'sure' : 'maybe', T - 5); });
set = L.buildSet(Q, cards2, T, { size: 10 });
ok(set.includes(Q.list[19].id), '思い込みの 問題は 優先して 復習に 入る');
set = L.buildSet(Q, cards2, T, { size: 10, mode: 'over' });
eq(set, [Q.list[19].id], '思い込みモードは 思い込みの 問題だけ');
set = L.buildSet(Q, {}, T, { size: 10, mode: 'star', star: { [Q.list[5].id]: 1, [Q.list[700].id]: 1 } });
eq(set.slice().sort(), [Q.list[5].id, Q.list[700].id].sort(), '★モードは ★の 問題だけ');
// ジャンルの しぼりこみ
set = L.buildSet(Q, {}, T, { size: 10, only: 'kagaku' });
ok(set.length === 10 && set.every(id => id.startsWith('kagaku/')), '1つの ジャンルだけ');
set = L.buildSet(Q, {}, T, { size: 10, genres: ['seiji', 'it'] });
ok(set.every(id => /^(seiji|it)\//.test(id)), 'えらんだ ジャンルだけ');
// 全部 解き終わっても セットが 作れる
const all = {};
Q.list.forEach(q => { all[q.id] = L.review(L.review(null, true, 'sure', T - 10), true, 'sure', T - 7); });
set = L.buildSet(Q, all, T, { size: 10 });
eq(set.length, 10, '全部 解いた 後も 10問 作れる');
eq(new Set(set).size, 10, 'そのときも 重ならない');
// 少ない 問題でも 落ちない
const tiny = { list: Q.list.slice(0, 3), byId: Q.byId };
eq(L.buildSet(tiny, {}, T, { size: 10 }).length, 3, '問題が 足りなければ ある分だけ');
eq(L.buildSet(Q, {}, T, { size: 10, mode: 'over' }), [], '思い込みが なければ 空');

/* ---------- つづけた 日数・おやすみ券 ---------- */
section('つづけた 日数・おやすみ券');
let st = L.emptyState();
eq(L.streak(st.days, T), 0, 'はじめは 0日');
for (let d = T; d < T + 6; d++) eq(L.finishDay(st, d), false, (d - T + 1) + '日目は 券なし');
eq(L.streak(st.days, T + 5), 6, '6日 つづいた');
eq(L.streak(st.days, T + 6), 6, '翌日、まだ 解いて いなくても 6日の まま');
eq(L.finishDay(st, T + 6), true, '7日目で 券が 1枚');
eq(st.tickets, 1, '券 1枚');
eq(L.finishDay(st, T + 6), false, '同じ 日に 2回 おわっても ふえない');
eq(st.best, 7, '最高 記録 7日');
eq(L.streak(st.days, T + 8), 0, '1日 休むと 0日（券を 使う 前）');
eq(L.applyRest(st, T + 8), 1, '休んだ 1日を 券で うめる');
eq(st.tickets, 0, '券が へる');
ok(st.days[T + 7].rest, '休んだ 日に おやすみの 印');
eq(L.streak(st.days, T + 8), 7, 'おやすみの 日は 数えずに つながる');
L.finishDay(st, T + 8);
eq(L.streak(st.days, T + 8), 8, '再開して 8日');
eq(L.applyRest(st, T + 12), 0, '券が 足りなければ 使わない');
eq(L.streak(st.days, T + 12), 0, 'そのときは 0日に もどる');
// 券は 2枚まで
st = L.emptyState();
for (let d = T; d < T + 28; d++) L.finishDay(st, d);
eq(st.tickets, 2, '券は 2枚まで');
eq(L.streak(st.days, T + 27), 28, '28日 つづいた');

/* ---------- 集計 ---------- */
section('集計');
const gstat = L.genreStats(Q, cards, T, D.GENRES);
eq(Object.keys(gstat).length, 20, '全ジャンルの 集計が ある');
eq(gstat.chiri.seen, 0, 'まだ 解いて いない ジャンルは 0');
eq(Object.values(gstat).reduce((a, x) => a + x.total, 0), 2000, '合計 2000問');
const tt = L.totals(Q, cards2, T);
eq([tt.seen, tt.over, tt.overOpen, tt.due], [20, 1, 1, 20], '全体の 集計');
eq(L.pct(1, 3), 33, '割合');
eq(L.pct(1, 0), 0, '0で わらない');

/* ---------- 保存データ ---------- */
section('保存データ');
eq(L.normalizeState(null), L.emptyState(), 'こわれた データ → 空の 状態');
eq(L.normalizeState('abc').cards, {}, '文字列 でも 落ちない');
let ns = L.normalizeState({ cards: [], tickets: 99, settings: { size: 7, off: 'x', font: 'xl' } });
eq([ns.cards, ns.tickets, ns.settings.size, ns.settings.off, ns.settings.font], [{}, 2, 10, [], 'xl'], 'おかしな 値を 直す');
ns = L.normalizeState({ settings: { size: '15' } });
eq(ns.settings.size, 15, '文字の 数字も 数に する');
const sess = { ids: ['a'], ans: [], retry: [] };
ns = L.normalizeState({ daily: sess, other: { ids: 1 }, cur: 'daily' });
eq([!!ns.daily, ns.other, ns.cur], [true, null, 'daily'], '途中の セットを のこす');
ns = L.normalizeState({ daily: null, cur: 'daily' });
eq(ns.cur, null, 'セットが ない のに 続き には しない');
const round = L.normalizeState(JSON.parse(JSON.stringify(Object.assign(L.emptyState(), { cards: cards2, star: { a: 1 }, best: 5 }))));
eq([Object.keys(round.cards).length, round.star, round.best], [20, { a: 1 }, 5], '保存 → 読みこみで 記録が のこる');

console.log('\n' + passes + ' 件 ok' + (fails ? '、' + fails + ' 件 NG' : '、すべて ok'));
process.exit(fails ? 1 : 0);
