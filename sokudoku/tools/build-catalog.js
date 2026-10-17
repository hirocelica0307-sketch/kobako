/* 速読ラボ ── texts/*.txt から目録 texts/catalog.js を作る
   使いかた：sokudoku フォルダで  node tools/build-catalog.js
   文章ファイルを足したり直したりしたら、かならず実行する（tests.js が目録と中身がそろっているか確かめる）。
   目録には一覧に出すことだけを入れ、本文と問題は読むときに texts/<id>.txt から読みこむ。 */
const fs = require('fs');
const path = require('path');
require('../logic.js');
const L = globalThis.SokuLogic;

const DIR = path.join(__dirname, '..', 'texts');

/** 目録を作る（tests.js からも呼ぶ） */
function buildCatalog() {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith('.txt')).sort();
    const items = [];
    for (const f of files) {
        const id = f.replace(/\.txt$/, '');
        const t = L.parseTextFile(fs.readFileSync(path.join(DIR, f), 'utf8'));
        const bad = L.checkTextFile(t);
        if (bad.length) throw new Error(`${f}: ${bad.join(' / ')}`);
        const m = t.meta;
        items.push({
            id, title: m.title, author: m.author || '', translator: m.translator || '',
            kind: m.kind || '', genre: m.genre || '', style: m.style || '', level: m.level || 2,
            mode: m.mode, order: +(m.order || 999), source: m.source || '',
            secs: t.sections.map(s => L.countChars(s)),
        });
    }
    items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return items;
}

function catalogSource(items) {
    return '/* 速読ラボ ── 入っている文章の目録（tools/build-catalog.js が texts/*.txt から作る。手で直さない） */\n'
        + '(function (root) {\n    \'use strict\';\n    root.SokuCatalog = [\n'
        + items.map(x => '        ' + JSON.stringify(x) + ',').join('\n')
        + '\n    ];\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
}

if (require.main === module) {
    const items = buildCatalog();
    fs.writeFileSync(path.join(DIR, 'catalog.js'), catalogSource(items));
    const by = {};
    for (const x of items) { by[x.mode] = by[x.mode] || { works: 0, secs: 0, chars: 0 }; by[x.mode].works++; by[x.mode].secs += x.secs.length; by[x.mode].chars += x.secs.reduce((a, b) => a + b, 0); }
    console.log(`${items.length}作品`);
    for (const [k, v] of Object.entries(by)) console.log(`  ${k}: ${v.works}作品・${v.secs}区間・${v.chars}字`);
}

module.exports = { buildCatalog, catalogSource };
