/* スプレッドシート（Google Apps Script）用の画面を作る
 *   node shoken-memo/build-gas.js
 *
 * index.html が読み込んでいる rules/*.js と engine.js を、中に埋め込んだ
 * gas/画面.html を作ります。Apps Script のエディタには、
 *   gas/Code.gs   → 「コード.gs」
 *   gas/画面.html → 「画面」（HTMLファイル）
 * を貼り付けます。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let count = 0;
const out = src.replace(/<script src="([^"]+)"><\/script>/g, (all, file) => {
  const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (/<\/script/i.test(body)) throw new Error(file + ' の中に </script> があるため埋め込めません');
  count++;
  return `<script>\n/* ${file} を埋め込んだもの */\n${body}\n</script>`;
});
if (count !== 3) throw new Error('埋め込むファイルが3つ見つかりません（' + count + '）');

const stamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const head = `<!-- ============================================================
     このファイルは自動生成です。直接編集しないでください。
     直すのは index.html / engine.js / rules/shoken-rules.js /
     rules/course-of-study.js のほうです。
     直したら  node build-gas.js  を実行して作り直します。
     生成日時: ${stamp}
     ============================================================ -->
`;
fs.mkdirSync(path.join(ROOT, 'gas'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'gas', '画面.html'), head + out);
console.log('gas/画面.html を作りました（' + Math.round((head + out).length / 1024) + 'KB）');
