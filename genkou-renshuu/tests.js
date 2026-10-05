/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までの ぶぶんを とりだして しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box, window: undefined });
const G = box.GenkouRules, Q = box.GenkouQuiz;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const cols = (doc, N, opt) => G.layout(G.parse(doc), N, opt).map(G.colStr);
const J = x => JSON.stringify(x);

/* ---------- ならべかた ---------- */
t('だんらくの はじめは 1マス あける', J(cols({ body: 'あいう\nえお' }, 5)) === J(['␣あいう␣', '␣えお␣␣']));
t('「。」が 行の 上に 来たら まえの マスに', J(cols({ body: 'あいうえ。' }, 5)) === J(['␣あいう{え。}']));
t('「。」」は 1マスに', J(cols({ body: '「おはよう。」' }, 8)) === J(['「おはよう{。」}␣␣']));
t('かいわは 行を かえて 1マス目から', J(cols({ body: 'あさだ。「おはよう。」と言った。' }, 8)) === J(['␣あさだ。␣␣␣', '「おはよう{。」}␣␣', 'と言った。␣␣␣']));
t('文の とちゅうの「」は 行を かえない', J(cols({ body: 'ぼくは「がんばろう」と思った。' }, 20)) === J(['␣ぼくは「がんばろう」と思った。␣␣␣␣']));
t('かいわが つづく ときは 1つずつ 行を かえる', J(cols({ body: '「あ。」「い。」と言った。' }, 6)) === J(['「あ{。」}␣␣␣', '「い{。」}␣␣␣', 'と言った。␣']));
t('だいめいは 上を 2マス・なまえは 下を 1マス', J(cols({ title: 'あさ', body: 'あ。' }, 8, { name: 'やま はな' })) === J(['␣␣あさ␣␣␣␣', '␣␣やま␣はな␣', '␣あ。␣␣␣␣␣']));
t('だいめい 3マスの せってい', cols({ title: 'あさ', body: 'あ。' }, 8, { titleIndent: 3 })[0] === '␣␣␣あさ␣␣␣');
t('空白は とる', J(cols({ body: 'あ い　う' }, 5)) === J(['␣あいう␣']));

/* ---------- 子どもの ならべかたを しらべる ---------- */
const P1 = G.parse({ title: 'あさ', body: 'いぬがいた。「わん。」となく。' });
const codes = acts => G.check(P1, G.replay(P1, 8, acts).cols, 8, { titleRows: [2, 3] }).map(e => P1.units[e.u].c + ':' + e.code);
const good = G.solve(P1, 8, { titleRows: [2, 3] });
t('おてほんどおりの 手じゅんが 見つかる', !!good);
t('おてほんどおりなら まちがい なし', good && codes(good).length === 0);
t('おてほんどおりの 手じゅん ＝ 自動の ならべかた', good && J(G.replay(P1, 8, good).cols.map(G.colStr)) === J(G.layout(P1, 8).map(G.colStr)));
const allPut = P1.units.map(() => 'put');
const ng = codes(allPut);
t('だいめいの 上を あけない → まちがい', ng.includes('あ:title-indent'), ng);
t('だんらくで 行を かえない → まちがい', ng.includes('い:dan-line'), ng);
t('かいわで 行を かえない → まちがい', G.check(P1, G.replay(P1, 10, allPut).cols, 10).some(e => P1.units[e.u].c === '「' && e.code === 'kaiwa-line'));
t('「。」」を わける → まちがい', ng.includes('」:kakko'), ng);
t('かいわの あとで 行を かえない → まちがい', ng.includes('と:after-line'), ng);
t('だんらくの 1マスを あけない → まちがい', codes(['blank', 'blank', 'put', 'put', 'newline', 'put']).includes('い:dan-indent'));
t('2マス あける → まちがい', codes(['blank', 'blank', 'put', 'put', 'newline', 'blank', 'blank', 'put']).includes('い:dan-many'));
t('ことばの あいだを あける → まちがい', codes(['blank', 'blank', 'put', 'put', 'newline', 'blank', 'put', 'blank', 'put']).includes('ぬ:space'));
t('とちゅうで 行を かえる → まちがい', codes(['blank', 'blank', 'put', 'put', 'newline', 'blank', 'put', 'newline', 'put']).includes('ぬ:newline'));
t('1マスに 2字 → まちがい', codes(['blank', 'blank', 'put', 'put', 'newline', 'blank', 'put', 'together']).includes('ぬ:together'));
const P2 = G.parse({ body: 'がっこう' });
t('小さい字を つめる → まちがい', G.check(P2, G.replay(P2, 6, ['blank', 'put', 'together']).cols, 6).some(e => e.code === 'small-together'));
const P3 = G.parse({ body: 'あいうえ。' });
t('行の 上に「。」 → まちがい', G.check(P3, G.replay(P3, 5, ['blank', 'put', 'put', 'put', 'put', 'put']).cols, 5).some(e => e.code === 'gyoto'));
t('行の 上に 来る「。」を まえの マスへ → まる', G.check(P3, G.replay(P3, 5, ['blank', 'put', 'put', 'put', 'put', 'together']).cols, 5).length === 0);
t('まだ マスが あるのに まえの マスへ → まちがい', G.check(P3, G.replay(P3, 6, ['blank', 'put', 'put', 'put', 'put', 'together']).cols, 6).some(e => e.code === 'together'));
t('ヒント：だいめいは 2マス あけて かく', J(G.hint(P1, 8, [], { titleRows: [2, 3] })) === J(['blank', 'blank', 'put']));
t('ヒント：かいわは 行を かえて かく', J(G.hint(P1, 8, good.slice(0, good.lastIndexOf('newline', good.indexOf('newline', good.indexOf('newline') + 1))), { titleRows: [2, 3] })) !== 'null');
t('どの きまりの まちがいにも ことばが ある', Object.keys(G.MSG_RULE).every(k => G.MSG[k] && Q.RULE[G.MSG_RULE[k]]));

/* ---------- おてほん ---------- */
for (const d of Q.TEXTS) {
    let ok = true, why = '';
    for (const N of [8, 10, 12, 15, 20]) {
        const P = G.parse(d), acts = G.solve(P, N, { titleRows: [2, 3] });
        if (!acts || J(G.replay(P, N, acts).cols.map(G.colStr)) !== J(G.layout(P, N).map(G.colStr))) { ok = false; why = N + 'マス'; }
    }
    t(`おてほん「${d.title}」：どの マスの かずでも きまりどおりに 書ける`, ok, why);
    t(`おてほん「${d.title}」：だいめいが 8マスでも 1行に 入る`, G.chars(d.title).length <= 6);
    t(`おてほん「${d.title}」：空白が ない`, !/[ 　]/.test(d.body));
}
t('おてほんの id が かぶらない', new Set(Q.TEXTS.map(d => d.id)).size === Q.TEXTS.length);

/* ---------- クイズ ---------- */
let bad = [];
for (let seed = 1; seed <= 300; seed++) for (const id of Object.keys(Q.MAKERS)) for (const ty of Object.keys(Q.MAKERS[id])) {
    const q = Q.MAKERS[id][ty](Q.makeRng(seed), { ti: ['2', '3', '23'][seed % 3] });
    const fail = m => bad.push(`${id}/${ty}/${seed}: ${m}`);
    if (q.opts) {
        const k = o => J(o.cols.map(c => c.cells.map(x => x && [x.t, x.v])));
        if (new Set(q.opts.map(k)).size !== q.opts.length) fail('おなじ えらびが ある');
        if (!(q.answer >= 0 && q.answer < q.opts.length)) fail('こたえが ない');
    }
    if (q.ok) {
        if (!q.ok.length || q.ok.some(x => !x)) fail('こたえの マスが ない');
        if (q.ok.some(x => { const [c, r] = x.split(',').map(Number); return c >= q.grid.cols.length || r >= q.grid.N; })) fail('こたえが マスの そと');
    }
    if (q.type === 'tap') { const [c, r] = q.ok[0].split(',').map(Number); if (!q.grid.cols[c].cells[r]) fail('まちがいの マスが から'); }
    if (q.type === 'place' && q.rule !== 'gyoto') { const [c, r] = q.ok[0].split(',').map(Number); if (q.grid.cols[c].cells[r]) fail('書く マスが うまって いる'); }
    if (q.type === 'place' && q.rule === 'gyoto') { const [c, r] = q.ok[0].split(',').map(Number); if (!q.grid.cols[c].cells[r] || q.grid.cols[c].cells[r].t.includes('。')) fail('「。」の まえの 字が ない'); }
    if ([q.grid && q.grid.N, q.model.N, ...(q.opts || []).map(o => o.N)].filter(Boolean).some(n => n > 11)) fail('マスが 多すぎる');
    if (id !== 'gyoto' && q.model.cols.some(c => c.cells.some(x => x && x.hang))) fail('ほかの きまり（行の 上の「。」）が まざる');
    if (!Q.RULE[q.rule] || !q.prompt) fail('きまり・もんだい文が ない');
}
t('クイズ 300かい つくっても おかしな もんだいが ない', bad.length === 0, bad.slice(0, 3).join(' / '));
const qz = Q.makeQuiz(['dan', 'kaiwa'], 10, 5);
t('えらんだ きまりだけ 出る', qz.length === 10 && qz.every(q => ['dan', 'kaiwa'].includes(q.rule)));
t('ぜんぶの きまりに もんだいが ある', Q.RULES.every(r => Q.MAKERS[r.id]));
t('だいめい 2〜3マスの せってい', J(Q.tiRows('23')) === J([2, 3]) && J(Q.tiRows('3')) === J([3]) && Q.ruleText('daimei', '3').includes('3マス'));

const ngs = rows.filter(r => !r.ok);
for (const r of ngs) console.log('NG', r.name, r.detail);
console.log(ngs.length ? `${ngs.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `ぜんぶ OK（${rows.length}こ）`);
process.exitCode = ngs.length ? 1 : 0;
