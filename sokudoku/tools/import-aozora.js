/* 速読ラボ ── 青空文庫の作品（UTF-8 にしたもの）を texts/<id>.txt の形にする
   使いかた：node tools/import-aozora.js <作品.txt（UTF-8）> <id> <mode> <level> [区間の字数=2600]
     mode：check・pace・repeat・skim（問題を書く短編）／long（問題なしの長編）
   区間は段落の切れ目で分ける。章の見出し（漢数字だけの行・「第一夜」など）の前で区切れるときは、そこを優先する。
   問題（@@問題）は、できたファイルの本文を読んで手で書きたす。 */
const fs = require('fs');
const path = require('path');
require('../logic.js');
const L = globalThis.SokuLogic;

const [src, id, mode, level, size] = process.argv.slice(2);
if (!src || !id || !mode) { console.error('node tools/import-aozora.js <作品.txt> <id> <mode> <level> [区間の字数]'); process.exit(2); }
const target = +(size || 2600);
const c = L.cleanAozora(fs.readFileSync(src, 'utf8'));

/** 見出しの行（章の番号など） */
const isHead = line => /^[\s　]*(第?[一二三四五六七八九十百]+[夜章回]?|[〇一二三四五六七八九十]+|[0-9０-９]+)[\s　]*$/.test(line);

/** 段落ごとにためていき、target 字をこえたら区切る。target の 70% をこえていて次が見出しなら、そこで区切る。
    最後の区間が短すぎるときは前にまぜる */
function sections(body) {
    const lines = body.split('\n');
    const out = [];
    let cur = [], n = 0;
    lines.forEach(l => {
        if (cur.length && isHead(l) && n >= target * 0.7) { out.push(cur.join('\n')); cur = []; n = 0; }
        cur.push(l);
        n += L.countChars(l);
        if (n >= target && !isHead(l)) { out.push(cur.join('\n')); cur = []; n = 0; }
    });
    if (cur.join('').trim()) {
        if (out.length && n < target * 0.4) out[out.length - 1] += '\n' + cur.join('\n');
        else out.push(cur.join('\n'));
    }
    return out.map(s => s.replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')).filter(s => s.trim());
}

const secs = sections(c.body.replace(/※［＃[^］]*］/g, '〓'));
const kind = c.translator ? '海外名作' : '名作';
let s = `title: ${c.title}\nauthor: ${c.author}\n` + (c.translator ? `translator: ${c.translator}\n` : '')
    + `kind: ${kind}\nlevel: ${level || 2}\nmode: ${mode}\nsource: 青空文庫\n@@本文\n` + secs.join('\n@@区切り\n') + '\n';
if (mode !== 'long') s += '@@問題\n' + secs.map((_, i) => `[${i + 1}]\n`).join('');
s += '@@底本\n' + c.credit + '\n';
fs.writeFileSync(path.join(__dirname, '..', 'texts', id + '.txt'), s);
console.log(id, c.title, '/', c.author, c.translator || '', secs.map(x => L.countChars(x)).join(','));
