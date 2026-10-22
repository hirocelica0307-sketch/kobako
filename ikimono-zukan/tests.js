/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までの ぶぶんを とりだして しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box, window: undefined, Intl });
const L = box.ZukanLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

/* 1年・2年で ならう 漢字（学習指導要領の 学年別漢字配当表） */
const G1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
const G2 = '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';
const OK_KANJI = new Set([...G1, ...G2]);
const KANJI = /[一-鿿々]/;
const KANJI_ALL = /[一-鿿々]/g;
const outsideRuby = s => s.replace(L.RB, '');

/* 子どもが 読む 文を ぜんぶ あつめる */
const texts = [];
const add = (label, s) => texts.push({ label, s });
L.GROUPS.forEach(g => { add(`なかま ${g.id}`, g.name); add(`なかま ${g.id} せつめい`, g.sub); });
L.CATS.forEach(c => add(`ひみつの しゅるい ${c.id}`, c.name));
L.DATA_LABELS.forEach((d, i) => add(`データ ${i}`, d.name));
for (const a of L.ANIMALS) {
    add(`${a.n} せつめい`, a.lead);
    add(`${a.n} しゃしん`, a.cap);
    a.d.forEach((x, i) => add(`${a.n} データ${i + 1}`, x));
    for (const s of L.secretsOf(a)) {
        add(`${a.n} ひみつ${s.no} 見出し`, s.q);
        add(`${a.n} ひみつ${s.no} 文`, s.t);
        if (s.c) add(`${a.n} ひみつ${s.no} しゃしん`, s.c);
    }
}

/* ---------- いきもの ---------- */
t('いきものは 30しゅるい', L.ANIMALS.length === 30, L.ANIMALS.length);
t('いきものの キーに だぶりが ない', new Set(L.ANIMALS.map(a => a.k)).size === L.ANIMALS.length);
t('いきものの なまえに だぶりが ない', new Set(L.ANIMALS.map(a => a.n)).size === L.ANIMALS.length);
t('なまえは カタカナ', L.ANIMALS.every(a => /^[ァ-ヶー]+$/.test(a.n)), L.ANIMALS.filter(a => !/^[ァ-ヶー]+$/.test(a.n)).map(a => a.n).join(','));
t('どの いきものも なかまが きまって いる', L.ANIMALS.every(a => L.GROUPS.some(g => g.id === a.g)));
t('どの なかまにも いきものが いる', L.GROUPS.every(g => L.ANIMALS.some(a => a.g === g.id)));
t('なかまごとに ならんで いる（もくじと ページが おなじ じゅん）',
    L.ANIMALS.every((a, i) => i === 0 || L.GROUPS.findIndex(g => g.id === a.g) >= L.GROUPS.findIndex(g => g.id === L.ANIMALS[i - 1].g)));
t('虫・小さな いきものと 海の いきものが 入って いる', L.ANIMALS.some(a => a.g === 'mushi') && L.ANIMALS.some(a => a.g === 'umi'));
for (const a of L.ANIMALS) {
    const ss = L.secretsOf(a);
    t(`${a.n}：データは 大きさ・すむ ところ・たべもの の 3つ`, a.d.length === 3 && a.d.every(x => x.length > 0));
    t(`${a.n}：ひみつは 4〜5こ`, ss.length >= 4 && ss.length <= 5, ss.length);
    t(`${a.n}：ひみつの しゅるいが きまって いる`, ss.every(s => L.CATS.some(c => c.id === s.cat)), ss.map(s => s.cat).join(','));
    t(`${a.n}：見出しは「？」で おわる 問いの 形`, ss.every(s => /？$/.test(s.q)), ss.filter(s => !/？$/.test(s.q)).map(s => L.P(s.q)).join(' / '));
    t(`${a.n}：見出しに だぶりが ない`, new Set(ss.map(s => L.P(s.q))).size === ss.length);
    t(`${a.n}：文は「。」で おわる`, ss.every(s => /。$/.test(s.t)) && /。$/.test(a.lead) && /。$/.test(a.cap));
    t(`${a.n}：しゃしんが あれば せつめいも ある`, ss.every(s => !s.p === !s.c));
    t(`${a.n}：ひみつの しゃしんは その いきものの もの`, ss.every(s => !s.p || s.p.startsWith(a.k + '-s')), ss.map(s => s.p).filter(Boolean).join(','));
}
const usedPhotos = L.ANIMALS.flatMap(a => L.secretsOf(a).map(s => s.p).filter(Boolean));
t('ひみつの しゃしんは 1まいずつ 1かいだけ つかう', new Set(usedPhotos).size === usedPhotos.length);

/* ---------- 文字 ---------- */
for (const { label, s } of texts) {
    const naked = outsideRuby(s).match(KANJI_ALL) || [];
    if (naked.length) t(`${label}：漢字には ぜんぶ ふりがな`, false, naked.join(''));
}
t('漢字には ぜんぶ ふりがな', texts.every(({ s }) => !KANJI.test(outsideRuby(s))));
const bad = [];
for (const { label, s } of texts) s.replace(L.RB, (m, k, y) => {
    if ([...k].some(c => !OK_KANJI.has(c))) bad.push(`${label}「${k}」`);
    if (!/^[ぁ-ゖー]+$/.test(y)) bad.push(`${label}「${k}」の よみ「${y}」`);
    return m;
});
t('漢字は 2年生までに ならう 字だけ・ふりがなは ひらがなだけ', bad.length === 0, bad.join(' / '));
t('ふりがなの {} が とじて いる', texts.every(({ s }) => !/[{}|]/.test(s.replace(L.RB, ''))), texts.filter(({ s }) => /[{}|]/.test(s.replace(L.RB, ''))).map(x => x.label).join(','));
t('分かち書き：「、」「。」の まえに すきまが ない', texts.every(({ s }) => !/ [、。]/.test(s)));
t('分かち書き：すきまが 2つ つづかない', texts.every(({ s }) => !/  /.test(s)));

/* ---------- きまり ---------- */
t('ふりがな：ルビに なる', L.R('{海|うみ}の') === '<ruby>海<rt>うみ</rt></ruby>の');
t('ふりがな：漢字だけ', L.P('{海|うみ}の') === '海の');
t('ふりがな：よみだけ', L.Y('{海|うみ}の') === 'うみの');
t('よみあげ：すきまを とって よみがなに する', L.speechText('{大|おお}きな {目|め}') === 'おおきなめ');
t('よみあげ：「〜」は「から」と よむ', L.speechText('2cm〜4cm') === '2cmから4cm');
t('ページ：いきものは 4ページから じゅんばん', L.ANIMALS.every((a, i) => a.page === L.FIRST_PAGE + i) && L.FIRST_PAGE === 4);
t('ページ：もくじは 2ページ・さくいんは いきものの つぎ', L.MOKUJI_PAGE === 2 && L.SAKUIN_PAGE === L.ANIMALS[L.ANIMALS.length - 1].page + 1);
t('ページ：ひょうし → もくじ → いきもの → さくいん', L.ROUTES[0] === 'cover' && L.ROUTES[1] === 'mokuji' && L.ROUTES[L.ROUTES.length - 1] === 'sakuin' && L.ROUTES.length === L.ANIMALS.length + 3);
t('ページ：つぎ・まえ', L.step('cover', 1) === 'mokuji' && L.step('mokuji', 1) === 'p4' && L.step('p4', -1) === 'mokuji' && L.step('sakuin', 1) === null && L.step('cover', -1) === null);
t('ページ：しらない ページは ひょうしに', L.normalize('#p99') === 'cover' && L.normalize('') === 'cover' && L.normalize('#p5') === 'p5');
t('ページ：ページから いきもの', L.animalByRoute('p4') === L.ANIMALS[0] && L.animalByRoute('mokuji') === null);
t('ページ番号：もくじ 2・さくいん・いきもの', L.pageOfRoute('mokuji') === 2 && L.pageOfRoute('sakuin') === L.SAKUIN_PAGE && L.pageOfRoute('p10') === 10 && L.pageOfRoute('cover') === 0);
t('さくいん：カタカナを ひらがなに', L.toHira('ラッコ') === 'らっこ');
t('さくいん：行わけ', L.rowOf('アリ') === 'あ' && L.rowOf('ゾウ') === 'さ' && L.rowOf('パンダ') === 'は' && L.rowOf('ラッコ') === 'ら');
const kana = L.kanaIndex();
t('さくいん（なまえ）：30しゅるい ぜんぶ 1かいずつ', kana.flatMap(r => r.items).length === 30 && new Set(kana.flatMap(r => r.items.map(a => a.k))).size === 30);
t('さくいん（なまえ）：行の じゅん', kana.every((r, i) => i === 0 || L.KANA_ROWS.findIndex(x => x[0] === r.row) > L.KANA_ROWS.findIndex(x => x[0] === kana[i - 1].row)));
const flat = kana.flatMap(r => r.items.map(a => L.toHira(a.n)));
t('さくいん（なまえ）：あいうえお じゅん', flat.every((n, i) => i === 0 || new Intl.Collator('ja').compare(flat[i - 1], n) <= 0), flat.join(','));
const cats = L.catIndex();
t('さくいん（知りたい こと）：ひみつが ぜんぶ 入る', cats.reduce((n, c) => n + c.items.length, 0) === L.ANIMALS.reduce((n, a) => n + a.s.length, 0));
t('さくいん（知りたい こと）：どの しゅるいにも ひみつが 3こ いじょう', cats.every(c => c.items.length >= 3), cats.map(c => c.cat.id + c.items.length).join(','));

/* ---------- ファイル ---------- */
const need = new Set();
for (const a of L.ANIMALS) {
    need.add(L.photo(a, 'main')); need.add(L.photo(a, 'thumb'));
    L.secretsOf(a).forEach(s => s.p && need.add('assets/photos/' + s.p + '.jpg'));
}
[...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].forEach(m => need.add(m[1]));
const missing = [...need].filter(f => !fs.existsSync(path.join(__dirname, f)));
t('よみこむ ファイルが ぜんぶ ある', missing.length === 0, missing.join(', '));
const photoDir = path.join(__dirname, 'assets/photos');
const extra = fs.existsSync(photoDir) ? fs.readdirSync(photoDir).filter(f => !need.has('assets/photos/' + f)) : [];
t('つかわない しゃしんが のこって いない', extra.length === 0, extra.join(', '));
const readmePath = path.join(__dirname, 'assets/README.txt');
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
const unlisted = [...need].filter(f => f.startsWith('assets/photos/') && !f.endsWith('-thumb.jpg') && !readme.includes(f.replace('assets/', '')));
t('しゃしんは ぜんぶ assets/README.txt に 出どころが ある', unlisted.length === 0, unlisted.join(', '));
global.window = undefined;
require('./assets/icons.js');
const used = [...new Set([...html.matchAll(/data-ic="([a-z-]+)"/g), ...html.matchAll(/IC\('([a-z-]+)'\)/g), ...html.matchAll(/\bic: '([a-z-]+)'/g)].map(m => m[1]))];
t('つかう アイコンが ぜんぶ icons.js に ある', used.every(n => globalThis.ZukanIcons.ICONS[n]), used.filter(n => !globalThis.ZukanIcons.ICONS[n]).join(','));

/* ---------- けっか ---------- */
const ng = rows.filter(x => !x.ok);
for (const x of rows) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.ok || !x.detail ? '' : '  … ' + x.detail));
console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
process.exitCode = ng.length ? 1 : 0;
