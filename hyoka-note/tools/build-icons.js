/* assets/icons/*.svg を index.html の中(ICONS-BEGIN 〜 ICONS-END)に書きこむ。
 * GAS の画面はフォルダのファイルを読みこめないので、中身をそのまま埋めこむ。
 * 実行: node hyoka-note/tools/build-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'assets', 'icons');
const htmlPath = path.join(root, 'index.html');

const icons = {};
fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort().forEach(f => {
  const name = f.replace(/-duotone\.svg$/, '').replace(/\.svg$/, '');
  icons[name] = fs.readFileSync(path.join(dir, f), 'utf8').trim()
    .replace(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /, '<svg ');
});

const block = '/* ICONS-BEGIN : tools/build-icons.js が assets/icons/ から作る。手で書きかえない */\n' +
  'const IC_SVG = {\n' +
  Object.keys(icons).map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(icons[k])).join(',\n') +
  '\n};\n/* ICONS-END */';

const html = fs.readFileSync(htmlPath, 'utf8');
const re = /\/\* ICONS-BEGIN[\s\S]*?\/\* ICONS-END \*\//;
if (!re.test(html)) throw new Error('index.html に ICONS-BEGIN 〜 ICONS-END がありません');
fs.writeFileSync(htmlPath, html.replace(re, () => block));
console.log('アイコン ' + Object.keys(icons).length + ' こ を index.html に書きこみました');
