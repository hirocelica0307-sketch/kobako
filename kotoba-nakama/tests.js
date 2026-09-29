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
const L = box.NakamaLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const J = x => JSON.stringify(x);
const tags = (sk, ws) => ws.map(w => L.tagsOf(sk, w));
const judge = (ws, name, sk = 'kyokasho') => L.judgeBox(tags(sk, ws), L.catOf(name));

/* データ */
for (const sk of L.SET_KEYS) {
    const s = L.SETS[sk];
    const inGroups = s.groups.flatMap(g => g.words);
    t(sk + '：ならびと グループの ことばが おなじ', J([...inGroups].sort()) === J([...s.order].sort()));
    t(sk + '：ことばに だぶりが ない', new Set(L.wordsFor(sk, true)).size === L.wordsFor(sk, true).length);
    t(sk + '：どの ことばにも なかまが ある', L.wordsFor(sk, true).every(w => L.tagsOf(sk, w).length > 0));
    t(sk + '：こうほに ぜんぶの なかまが ある', s.groups.every(g => s.chips.includes(g.cat)));
    t(sk + '：こうほは しって いる なかまだけ', s.chips.every(k => L.CATS[k]));
}
t('きょうかしょは 18まい', L.SETS.kyokasho.order.length === 18);

/* なまえ */
t('ひらがな', L.catOf('やさい') === 'yasai');
t('カタカナでも', L.catOf('ヤサイ') === 'yasai');
t('漢字でも', L.catOf('野菜') === 'yasai' && L.catOf('魚') === 'sakana' && L.catOf('花') === 'hana');
t('「〜の なかま」を とる', L.catOf('虫の なかま') === 'mushi' && L.catOf('どうぶつなかま') === 'doubutsu');
t('空白・ぜんかく空白を とる', L.catOf(' はな　') === 'hana');
t('「〜たち」を とる', L.catOf('むしたち') === 'mushi');
t('なまえが ない', L.catOf('') === '' && L.catOf('   ') === '');
t('しらない なまえ', L.catOf('うみの なかま') === null);

/* はこ */
t('からの はこ', L.judgeBox([], '').state === 'empty');
t('やさい 4つ ＋ やさい → ◎', judge(['だいこん', 'きゅうり', 'さつまいも', 'トマト'], 'やさい').state === 'ok');
t('花 ＋ はな → ◎', judge(['さくら', 'あさがお'], 'はな').state === 'ok');
t('さくら・うめ ＋ 木 → ◎', judge(['さくら', 'うめ'], '木').state === 'ok');
t('あさがお ＋ 木 → なまえが あわない', judge(['あさがお', 'チューリップ'], '木').state === 'name');
t('なまえ なし → noname', judge(['とんぼ', 'かぶと虫'], '').state === 'noname');
t('じぶんで 考えた なまえ → free', judge(['いわし', 'さば'], 'うみに すむ もの').state === 'free');
t('どうぶつ と 虫 を いきもの → broad', judge(['ぞう', 'とんぼ'], 'いきもの').state === 'broad');
let r = judge(['だいこん', 'きゅうり', 'いわし'], 'やさい');
t('やさいに いわし → mixed で いわしに ？', r.state === 'mixed' && J(r.odd) === '[2]', J(r));
r = judge(['だいこん', 'きゅうり', 'いわし'], '');
t('なまえ なしでも 大きな なかまだけなら mixed', r.state === 'mixed' && J(r.odd) === '[2]', J(r));
r = judge(['だいこん', 'きゅうり', 'いわし'], 'たべもの');
t('たべもの なら ぜんぶ なかま → broad', r.state === 'broad', J(r));
r = judge(['ぞう', 'パンダ', 'とんぼ', 'ライオン'], 'どうぶつ');
t('どうぶつに とんぼ → とんぼに ？', r.state === 'mixed' && J(r.odd) === '[2]', J(r));
r = judge(['いわし', 'ぞう', 'パンダ'], 'さかな');
t('なまえが さかな なら さかなで ない ほうに ？', r.state === 'mixed' && J(r.odd) === '[1,2]', J(r));
r = judge(['メロン', 'みかん', 'いちご', 'トマト'], 'くだもの');
t('れいの くだものに トマト → トマトに ？', r.state === 'mixed' && J(r.odd) === '[3]', J(r));
r = judge(['ぞう', 'はる'], '', 'kyokasho');
t('しらない ことばが まじっても こわれない', r.state === 'mixed', J(r));
r = L.judgeBox(tags('kurashi', ['ピアノ', 'えんぴつ']), L.catOf('どうぐ'));
t('がっき と ぶんぼうぐ を どうぐ → broad', r.state === 'broad', J(r));
r = L.judgeBox(tags('kotoba', ['あめ', 'ゆき', 'はれ']), L.catOf('お天気'));
t('てんき（お天気）→ ◎', r.state === 'ok', J(r));

/* ぜんぶの はこ */
const S = L.SETS.kyokasho;
const perfect = S.groups.map((g, i) => ({ id: 'b' + i, name: L.CATS[g.cat].label, cards: g.words.slice() }));
let a = L.judgeAll('kyokasho', perfect, 0);
t('ぜんぶ ぴったり → できた', a.done && !a.mixed && !a.dup);
a = L.judgeAll('kyokasho', perfect, 1);
t('カードが のこって いたら まだ', !a.done);
a = L.judgeAll('kyokasho', perfect.concat([{ id: 'x', name: '', cards: [] }]), 0);
t('からの はこが あっても できた', a.done);
const two = perfect.slice(1).concat([
    { id: 'y1', name: 'やさい', cards: ['だいこん', 'きゅうり'] },
    { id: 'y2', name: 'やさい', cards: ['さつまいも', 'トマト'] },
]);
a = L.judgeAll('kyokasho', two, 0);
t('おなじ なかまの はこが 2つ → dup で まだ', !a.done && a.dup && a.results.y1.dup && a.results.y2.dup);
t('dup の しるしは ○', L.boxMessage(a.results.y1, 'やさい').mark === '○');
const noname = perfect.map((b, i) => (i === 0 ? Object.assign({}, b, { name: '' }) : b));
a = L.judgeAll('kyokasho', noname, 0);
t('なまえの ない はこが あれば まだ', !a.done && a.noname === 1);
const trees = perfect.filter(b => b.name !== '花').concat([
    { id: 'k', name: '木', cards: ['さくら', 'うめ'] },
    { id: 'h', name: '花', cards: ['あさがお', 'チューリップ'] },
]);
a = L.judgeAll('kyokasho', trees, 0);
t('さくら・うめを 木に わけても できた', a.done, J(a.results));
t('◎ の ことば', L.boxMessage({ state: 'ok' }, 'やさい').mark === '◎');

/* はじめ・ほぞん */
let d = L.initialData('kyokasho', { example: true });
t('はじめ：れいの はこ＋はこ3つ', d.boxes.length === 4 && d.boxes[0].name === 'くだもの' && d.boxes[0].cards.length === 3);
t('はじめ：カードは 18まい', d.pool.length === 18);
d = L.initialData('kyokasho', { example: false });
t('れい なし：はこ3つ', d.boxes.length === 3 && d.boxes.every(b => !b.cards.length));
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
d = L.initialData('kyokasho', { shuffle: true }, rand);
t('まぜる：ならびが かわる', J(d.pool) !== J(S.order) && J([...d.pool].sort()) === J([...S.order].sort()));
d = L.sanitize({
    pool: ['だいこん', 'だいこん', 'ねこ'],
    boxes: [{ id: 'b7', name: 'やさい', cards: ['きゅうり', 'だいこん'] }, { id: 'b7', name: 'x', cards: [] }, null],
    sentences: [{ text: 'やさいです。', ok: true }, { text: '' }, 3],
    seq: 2,
}, 'kyokasho', { example: false });
const every = d.pool.concat(...d.boxes.map(b => b.cards));
t('ほぞん：どの ことばも 1かいずつ', every.length === 18 && new Set(every).size === 18, J(d));
t('ほぞん：しらない ことばは すてる', !every.includes('ねこ'));
t('ほぞん：おなじ id の はこは 1つ', d.boxes.length === 1);
t('ほぞん：seq は id より 大きい', d.seq === 7);
t('ほぞん：こわれた 文は すてる', d.sentences.length === 1 && d.sentences[0].ok === true);
t('ほぞん：こわれた データは はじめから', L.sanitize(null, 'kotoba', {}).pool.length === 16);

/* 文 */
const T1 = L.TEMPLATES[0], T2 = L.TEMPLATES[1], T3 = L.TEMPLATES[2];
t('文：かた1', L.sentenceText(T1, ['やさい', 'だいこん', 'トマト']) === 'やさいの なかまには、だいこんや トマトが あります。');
t('文：かた2', L.sentenceText(T2, ['とんぼ', '虫']) === 'とんぼは、虫の なかまです。');
t('文：かた3', L.sentenceText(T3, ['ぞう', 'パンダ', 'どうぶつ']) === 'ぞうと パンダは、どちらも どうぶつです。');
t('文：あいて いる ところ', L.sentenceText(T2, ['', '虫']) === '＿＿は、虫の なかまです。');
t('文の たしかめ：ok', L.checkSentence(T1, ['やさい', 'だいこん', 'トマト'], perfect) === 'ok');
t('文の たしかめ：ちがう はこ', L.checkSentence(T1, ['やさい', 'だいこん', 'ぞう'], perfect) === 'ng');
t('文の たしかめ：おなじ ことば', L.checkSentence(T3, ['ぞう', 'ぞう', 'どうぶつ'], perfect) === 'same');
t('文の たしかめ：まだ', L.checkSentence(T2, ['ぞう'], perfect) === 'incomplete');
t('文の たしかめ：はこの ならべかたで きめる', L.checkSentence(T2, ['さくら', '木'], trees) === 'ok');
const sl = L.slotsOf(T1);
t('入れる ところ：いまの ところが あえば そこ', L.pickSlot(sl, [], 1, 'w') === 1);
t('入れる ところ：あわなければ あいて いる ところ', L.pickSlot(sl, ['', 'だいこん'], 1, 'n') === 0);
t('入れる ところ：ことばは つぎの あき', L.pickSlot(sl, ['やさい', 'だいこん'], 0, 'w') === 2);
t('つぎの あき', L.nextEmpty(sl, ['やさい', '', ''], 0) === 1 && L.nextEmpty(sl, ['', 'a', 'b'], 2) === 0);

/* ---------- けっか ---------- */
const ng = rows.filter(x => !x.ok);
for (const x of rows) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.ok || !x.detail ? '' : '  … ' + x.detail));
console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
process.exitCode = ng.length ? 1 : 0;
