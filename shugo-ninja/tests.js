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
const L = box.NinjaLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

const KANJI = /[一-鿿々]/;
const ROLES = ['s', 'p', 'o', 't', 'd', 'a', 'h', 'w', 'x'];
const outsideRuby = str => str.replace(L.RB, '');
const allSentences = [];
for (const st of L.STAGES) {
    if (st.kind === 'sent') st.items.forEach((s, i) => allSentences.push({ st, s, label: `その${st.id}-${i + 1}` }));
    if (st.kind === 'pass') st.items.forEach((it, i) => it.sents.forEach((s, j) => allSentences.push({ st, s, label: `その${st.id}-${i + 1}-${j + 1}` })));
}
const plain = s => s.w.map(g => L.P(g.t)).join(' ');

/* ---------- データ ---------- */
t('しゅぎょうは その0〜その7 の 8つ', L.STAGES.length === 8 && L.STAGES.every((st, i) => st.id === i));
const count = allSentences.length + L.STAGES[7].items.length;
t('もんだいは 60もん いじょう', count >= 60, count);
for (const { st, s, label } of allSentences) {
    const subj = s.w.filter(g => g.r === 's').length;
    const pred = s.w.filter(g => g.r === 'p').length;
    t(`${label}「${plain(s)}」：主語と じゅつ語が 1つずつ`, subj === 1 && pred === 1, `主語${subj} じゅつ語${pred}`);
    t(`${label}：じゅつ語は 文の さいご`, s.w[s.w.length - 1].r === 'p' && /。$/.test(s.w[s.w.length - 1].t));
    t(`${label}：やくわりの しるしが ただしい`, s.w.every(g => ROLES.includes(g.r)), s.w.map(g => g.r).join(''));
    t(`${label}：漢字には ぜんぶ ふりがな`, s.w.every(g => !KANJI.test(outsideRuby(g.t))), s.w.map(g => g.t).join(' '));
    if (st.steps.includes('k')) t(`${label}：じゅつ語の なかまが きまって いる`, Object.keys(L.KN).includes(s.k), s.k);
}
const kinds = L.STAGES[5].items.map(s => s.k);
t('その5：どうする・どんなだ・なんだ が ぜんぶ 3もん いじょう', ['dou', 'donna', 'nanda'].every(k => kinds.filter(x => x === k).length >= 3), kinds.join(','));
t('その3：主語は ぜんぶ「は」か「も」', L.STAGES[3].items.every(s => /[はも]$/.test(s.w.find(g => g.r === 's').t)));
t('その4：主語が 文の はじめに ない', L.STAGES[4].items.every(s => s.w[0].r !== 's'));
t('その6：文しょうは 3つの 文が 4つ', L.STAGES[6].items.length === 4 && L.STAGES[6].items.every(it => it.sents.length === 3));
for (const [i, it] of L.STAGES[7].items.entries()) {
    t(`その7-${i + 1}：こたえの ばんごうが ある`, it.ans >= 0 && it.ans < it.opts.length);
    t(`その7-${i + 1}：えらぶ カードに だぶりが ない`, new Set(it.opts).size === it.opts.length);
    t(`その7-${i + 1}：漢字には ぜんぶ ふりがな`, [it.text, ...it.opts].every(x => !KANJI.test(outsideRuby(x))));
    t(`その7-${i + 1}：主語は「が・は」、じゅつ語は「。」で おわる`,
        it.fix === 's' ? /[がは]$/.test(it.text) && it.opts.every(o => /。$/.test(o)) : /。$/.test(it.text) && it.opts.every(o => /[がは]$/.test(o)));
}
const readings = [];
JSON.stringify(L.STAGES).replace(/\{([^|}]+)\|([^}]+)\}/g, (m, k, y) => { readings.push(y); return m; });
t('ふりがなは ひらがなだけ', readings.every(y => /^[ぁ-ゖー]+$/.test(y)), readings.filter(y => !/^[ぁ-ゖー]+$/.test(y)).join(','));

/* ---------- きまり ---------- */
t('ふりがな：ルビに なる', L.R('{空|そら}が') === '<ruby>空<rt>そら</rt></ruby>が');
t('ふりがな：漢字だけ', L.P('{空|そら}が') === '空が');
t('ふりがな：よみだけ', L.Y('{空|そら}が') === 'そらが');
t('ほし：90% いじょうで 3つ', L.starsOf(1) === 3 && L.starsOf(0.9) === 3);
t('ほし：70% いじょうで 2つ', L.starsOf(0.89) === 2 && L.starsOf(0.7) === 2);
t('ほし：それより したは 1つ', L.starsOf(0.69) === 1 && L.starsOf(0) === 1);
t('ランク：はじめは みならい', L.rankOf(0) === 'みならい にんじゃ');
t('ランク：ほし 21こで マスター', L.rankOf(L.MAXSTARS) === 'ことばにんじゃ マスター' && L.MAXSTARS === 21);
t('ランク：ほしが ふえると 上がる', L.RANKS.every((r, i) => i === 0 || r[0] > L.RANKS[i - 1][0]));
const stu = { stages: { 0: { plays: 1, bestStars: 0 }, 1: { plays: 2, bestStars: 3 }, 2: { plays: 1, bestStars: 2 } } };
t('ほしの かず：その0 は かぞえない', L.totalStars(stu) === 5);
const g = (r, t2) => ({ r, t: t2 });
t('ことばかけ：えらんだ ことばが 入る', L.wrongMsg('s', g('o', 'ボールを')).includes('「ボールを」') && L.wrongMsg('s', g('o', 'ボールを')).includes('なにを'));
t('ことばかけ：じゅつ語で 主語を えらぶと 主語と おしえる', L.wrongMsg('p', g('s', 'ねこが')).includes(L.SHUGO));
t('ことばかけ：「。」は 入れない', !L.wrongMsg('p', g('x', 'ねる。')).includes('。」'));

/* ---------- だれでも つかえる（きろくを のこさない） ---------- */
const appSrc = html.split('// ==/LOGIC==')[1];
t('きろくを ほぞん しない（localStorage などを つかわない）', !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(html));
t('出席番号・名前の 入力が ない', !/<input|data-act="num"|loginName/.test(appSrc));
t('先生用の 画面が ない', !/data-act="gate"|vTeacher|暗証番号/.test(appSrc));

/* ---------- ファイル ---------- */
const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(m => m[1]);
const imgs = [...html.matchAll(/IMG\('([a-z-]+)'\)/g)].map(m => 'assets/emoji/' + m[1] + '.webp');
const chars = [...html.matchAll(/img:'([a-z-]+)'/g)].map(m => 'assets/emoji/' + m[1] + '.webp');
const files = [...new Set([...refs, ...imgs, ...chars])];
t('よみこむ ファイルが ぜんぶ ある', files.every(f => fs.existsSync(path.join(__dirname, f))), files.filter(f => !fs.existsSync(path.join(__dirname, f))).join(','));
t('ファイル名が「_」「.」で はじまらない', files.every(f => f.split('/').every(seg => !/^[_.]/.test(seg))));
require('./assets/icons.js');
const usedIcons = [...html.matchAll(/ICON\('([a-z-]+)'\)/g)].map(m => m[1]);
const IC = globalThis.NinjaIcons.ICONS;
t('つかう アイコンが ぜんぶ icons.js に ある', usedIcons.every(n => IC[n]), usedIcons.filter(n => !IC[n]).join(','));

/* ---------- けっか ---------- */
const ng = rows.filter(x => !x.ok);
for (const x of rows) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.ok || !x.detail ? '' : '  … ' + x.detail));
console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
process.exitCode = ng.length ? 1 : 0;
