/* index.html / style.css / monsters.js / app.js を 1つの HTML に まとめて
   gas/Index.html を つくります（Apps Script は 外部ファイルを よみこめないため）。

   つかいかた:  node tools/build-gas.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
const parts = [
  ['<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}\n</style>`],
  ['<script src="monsters.js"></script>',      () => `<script>\n${read('monsters.js')}\n</script>`],
  ['<script src="app.js"></script>',           () => `<script>\n${read('app.js')}\n</script>`]
];
for(const [marker, make] of parts){
  if(!html.includes(marker)){
    console.error('ビルド失敗: index.html に ' + marker + ' が ありません');
    process.exit(1);
  }
  html = html.replace(marker, make());
}
if(html.includes('</script>\n</script>')){ console.error('ビルド失敗: script の いれこ'); process.exit(1); }

html = html.replace('<head>',
  '<head>\n<!-- このファイルは tools/build-gas.mjs が 自動生成します。直接 編集しないでください。 -->');

fs.mkdirSync(path.join(root, 'gas'), { recursive:true });
fs.writeFileSync(path.join(root, 'gas', 'Index.html'), html);
console.log('gas/Index.html を つくりました（' + Math.round(html.length / 1024) + ' KB）');
