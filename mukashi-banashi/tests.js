/* むかしばなし文庫 ── 本文の たしかめ（node tests.js）
   ・漢字は 1年・2年で ならう 漢字だけ（学年別漢字配当表）
   ・漢字には ぜんぶ よみがなが ついて いる
   ・むかしの ことば〔 〕は ぜんぶ じてん（kotoba.js）に のって いる
   ・絵の なまえは ぜんぶ assets に ある                                     */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./parse.js');

const G1 = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
const G2 = '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';
const OK = new Set([...G1, ...G2, '々']);

const stories = [];
global.MB = { add: s => stories.push(s) };
const dir = path.join(__dirname, 'stories');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) require(path.join(dir, f));
let KOTOBA = null;
if (fs.existsSync(path.join(__dirname, 'kotoba.js'))) {
    global.window = global; require('./kotoba.js'); KOTOBA = global.MB_KOTOBA;
}
let IMAGES = null;
if (fs.existsSync(path.join(__dirname, 'assets/images.js'))) {
    global.window = global; require('./assets/images.js'); IMAGES = global.MB_IMAGES;
}

let errors = 0;
const err = (s, m) => { errors++; console.log('✗', s, m); };
const keys = new Map();
const imgs = new Set();

function walk(parts, where, cb) {
    for (const p of parts) {
        if (p.t === 'c') cb('c', p, where);
        else if (p.t === 'r') cb('r', p, where);
        else { cb('k', p, where); walk(p.parts, where, cb); }
    }
}
function checkParts(parts, where) {
    walk(parts, where, (t, p) => {
        if (t === 'c' && P.KANJI.test(p.s)) err(where, 'よみがなの ない 漢字「' + p.s + '」');
        if (t === 'r') {
            for (const ch of p.base) if (P.KANJI.test(ch) && !OK.has(ch)) err(where, '2年までに ならわない 漢字「' + ch + '」（' + p.base + '）');
            if (!p.rt || /[^ぁ-んー]/.test(p.rt)) err(where, 'よみがなが へん「' + p.base + '《' + p.rt + '》」');
        }
        if (t === 'k') { if (!keys.has(p.key)) keys.set(p.key, new Set()); keys.get(p.key).add(where.split(' ')[0]); }
    });
}

const ids = new Set();
let total = 0;
for (const s of stories) {
    if (ids.has(s.id)) err(s.id, 'id が かさなって いる');
    ids.add(s.id);
    try {
        checkParts(P.inline(s.title), s.id + ' だい');
        imgs.add(s.cover);
        s.ehon.forEach((pg, i) => { checkParts(P.inline(pg.t), s.id + ' えほん' + (i + 1)); pg.i.split(/\s+/).forEach(x => imgs.add(x)); });
        const sc = P.parseYomimono(s.text);
        let n = 0;
        sc.forEach((c, i) => {
            if (c.img) c.img.split(/\s+/).forEach(x => imgs.add(x));
            c.paras.forEach(pp => { checkParts(pp, s.id + ' ばめん' + (i + 1)); n += P.plain(pp).length; });
        });
        total += n;
        const en = s.ehon.reduce((a, pg) => a + P.plain(P.inline(pg.t)).replace(/\s/g, '').length, 0);
        if (process.argv.includes('-v')) console.log(s.id.padEnd(14), 'よみもの', n, '字 / えほん', en, '字', sc.length, 'ばめん');
    } catch (e) { err(s.id, e.message); }
}
if (KOTOBA) {
    for (const [k, w] of keys) if (!KOTOBA[k]) err('じてん', 'のって いない ことば〔' + k + '〕（' + [...w].join('・') + '）');
    const kinds = new Set(global.MB_KOTOBA_KINDS.map(x => x.id));
    for (const [k, e] of Object.entries(KOTOBA)) {
        if (!kinds.has(e.k)) err('じてん', k + ' の なかまが へん');
        if (e.see && !KOTOBA[e.see]) err('じてん', k + ' の see が ない');
        if (!e.see && !keys.has(k)) err('じてん', '本文で つかって いない ことば「' + k + '」');
        try { checkParts(P.inline(e.m), 'じてん ' + k); if (e.n) checkParts(P.inline(e.n), 'じてん ' + k); } catch (x) { err('じてん', k + ' ' + x.message); }
    }
    global.MB_KOTOBA_KINDS.forEach(x => checkParts(P.inline(x.name), 'じてん なかま'));
} else console.log('（kotoba.js が まだ ない。〔 〕の ことば', keys.size, 'こ）');
if (IMAGES) {
    for (const k of imgs) if (!IMAGES[k]) err('え', 'ない 絵「' + k + '」');
} else console.log('（assets/images.js が まだ ない。絵の なまえ', imgs.size, 'こ）');
if (process.argv.includes('--keys')) console.log([...keys.keys()].join('\n'));
if (process.argv.includes('--imgs')) console.log([...imgs].sort().join('\n'));
console.log(stories.length, 'わ・よみもの ぜんぶで', total, '字');
if (errors) { console.log('まちがい', errors, 'こ'); process.exit(1); }
console.log('OK');
