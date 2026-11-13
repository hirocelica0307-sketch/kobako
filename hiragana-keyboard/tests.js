/* ひらがなキーボード：辞書と へんかんの テスト
   つかいかた：  node hiragana-keyboard/tests.js
   （-v を つけると 変換の けっかを ぜんぶ 見せます） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const ctx = {};
vm.createContext(ctx);
function run(file) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error(file + ' に <script> が ありません');
  vm.runInContext(m[1], ctx, { filename: file });
}
run('辞書.html');
run('henkan.html');
vm.runInContext('HENKAN.load(JISHO); this.H = HENKAN; this.J = JISHO;', ctx);
const H = ctx.H, J = ctx.J;
const verbose = process.argv.includes('-v');

let fail = 0;
function ng(msg) { fail++; console.log('  ✗ ' + msg); }

/* ---- 1. 学年別漢字配当表 ---- */
const want = { 1: 80, 2: 160, 3: 200, 4: 202, 5: 193, 6: 191 };
const allK = new Set();
for (const g in want) {
  const n = [...H.GRADE_KANJI[g]].length;
  if (n !== want[g]) ng(`${g}年の 漢字が ${n}字（${want[g]}字の はず）`);
  for (const c of H.GRADE_KANJI[g]) { if (allK.has(c)) ng('2回 でてくる 漢字：' + c); allK.add(c); }
}
if (allK.size !== 1026) ng('漢字の ごうけいが ' + allK.size);

/* ---- 2. 辞書の 書きかた ---- */
if (H.errors.length) ng('よめない ことば：' + H.errors.join(' '));
const outside = new Set();
for (const key of ['W', 'V5', 'V1', 'A']) {
  for (const c of J[key]) if (/[一-鿿]/.test(c) && !allK.has(c)) outside.add(c);
}
if (outside.size) ng('配当表に ない 漢字（ひらがなで 書く）：' + [...outside].join(''));

/* ---- 3. 文の 変換 ---- */
function conv(s, grade, maze) {
  return H.convert(s, { grade, maze: maze !== false }) || s;
}
const CASES = [
  // [入力, 学年, 期待]
  ['きょうはてんきがいい。', 2, '今日は天気がいい。'],
  ['きょうはてんきがいい。', 1, 'きょうは天気がいい。'],
  ['がっこうでともだちとあそびました。', 6, '学校で友達と遊びました。'],
  ['がっこうでともだちとあそびました。', 2, '学校で友だちとあそびました。'],
  ['きのうはあめがふったので、いえでほんをよみました。', 6, '昨日は雨が降ったので、家で本を読みました。'],
  ['きのうはあめがふったので、いえでほんをよみました。', 2, 'きのうは雨がふったので、家で本を読みました。'],
  ['うんどうかいでいっしょうけんめいはしりました。', 3, '運動会でいっしょうけんめい走りました。'],
  ['うんどうかいでいっしょうけんめいはしりました。', 2, 'うんどう会でいっしょうけんめい走りました。'],
  ['わたしはさんすうがすきです。', 6, '私は算数が好きです。'],
  ['わたしはさんすうがすきです。', 2, 'わたしは算数がすきです。'],
  ['おかあさんとかいものにいきました。', 2, 'お母さんと買いものに行きました。'],
  ['おかあさんとかいものにいきました。', 3, 'お母さんと買い物に行きました。'],
  ['なつやすみにうみへいきたいです。', 2, '夏休みに海へ行きたいです。'],
  ['あしたはえんそくです。', 2, '明日は遠足です。'],
  ['にわにはなをうえました。', 3, '庭に花を植えました。'],
  ['ともだちといっしょにかえりました。', 2, '友だちといっしょに帰りました。'],
  ['きょうしつでしゅくだいをしました。', 3, '教室で宿題をしました。'],
  ['とてもたのしかったです。', 3, 'とても楽しかったです。'],
  ['いっぱいべんきょうした。', 3, 'いっぱい勉強した。'],
  ['せんせいのはなしをききました。', 2, '先生の話を聞きました。'],
  ['いぬとさんぽにいった。', 1, '犬とさんぽにいった。'],
  ['いぬとさんぽにいった。', 2, '犬とさんぽに行った。'],
  ['きゅうしょくのカレーがおいしかった。', 4, '給食のカレーがおいしかった。'],
  ['ぼくはサッカーがだいすきです。', 2, 'ぼくはサッカーが大すきです。'],
  ['あさごはんをたべてからがっこうへいきます。', 2, '朝ごはんを食べてから学校へ行きます。'],
  ['こうえんでおにごっこをしてあそんだ。', 3, '公園でおにごっこをして遊んだ。'],
  ['はやくおおきくなりたい。', 1, '早く大きくなりたい。'],
  ['みんなでうたをうたいました。', 2, 'みんなで歌を歌いました。'],
  ['でんしゃにのってえきまでいきました。', 3, '電車に乗って駅まで行きました。'],
  ['おとうとがないていました。', 4, '弟が泣いていました。'],
  ['ほんをかりてよみたい。', 4, '本を借りて読みたい。'],
  ['あめがやんで、そらがあかるくなった。', 3, '雨がやんで、空が明るくなった。'],
  ['ともだちがきてくれました。', 2, '友だちが来てくれました。'],
  ['なまえをかいてください。', 2, '名前を書いてください。'],
  ['なつやすみにかぞくでうみにいって、たくさんおよぎました。', 6, '夏休みに家族で海に行って、たくさん泳ぎました。'],
  ['こくごのじかんにさくぶんをかきました。', 2, '国語の時間に作文を書きました。'],
  ['あさがおのたねをまきました。', 4, '朝がおの種をまきました。'],
  ['はじめててつぼうでさかあがりができました。', 6, '初めて鉄棒で逆上がりができました。'],
  ['おおきなさかなをつりました。', 2, '大きな魚をつりました。'],
  ['きのうのよる、ほしがきれいでした。', 4, '昨日の夜、星がきれいでした。'],
  ['きょうはあさからあめがふっていました。', 2, '今日は朝から雨がふっていました。'],
  ['あたらしいくつをかってもらいました。', 2, '新しいくつを買ってもらいました。'],
  ['ともだちとけんかをしたけど、すぐなかなおりしました。', 4, '友達とけんかをしたけど、すぐ仲直りしました。'],
  ['えきまえのほんやさんでまんがをかった。', 3, '駅前の本屋さんでまんがを買った。'],
  ['みんなのまえでうたをうたうのはどきどきしました。', 2, 'みんなの前で歌を歌うのはどきどきしました。'],
];
let ok = 0;
for (const [inp, g, exp] of CASES) {
  const got = conv(inp, g);
  if (got === exp) { ok++; if (verbose) console.log(`  ○ ${g}年 ${got}`); }
  else ng(`${g}年「${inp}」→「${got}」（ほしいのは「${exp}」）`);
}

/* ---- 4. 学年：ならっていない 漢字が 出ない ---- */
for (let g = 1; g <= 6; g++) {
  const opt = { grade: g, maze: true };
  for (const r in H.FORMS) for (const e of H.FORMS[r]) {
    const s = H.surface(e, opt);
    for (const c of s) if (/[一-鿿]/.test(c) && !(H.gradeOf(c) && H.gradeOf(c) <= g)) { ng(`${g}年で「${s}」に ${c}`); break; }
  }
}
/* まぜがき しない ときは、ならっていない 字が ある ことばは ぜんぶ ひらがな */
{
  const e = H.FORMS['かぞく'][0];
  const a = H.surface(e, { grade: 2, maze: true }), b = H.surface(e, { grade: 2, maze: false }), c = H.surface(e, { grade: 3, maze: false });
  if (a !== '家ぞく' || b !== 'かぞく' || c !== '家族') ng(`まぜがき：${a} ${b} ${c}`);
}

/* ---- 5. 1語ずつの こうほ ---- */
{
  const p = H.predict('かようし', { grade: 6, maze: true });
  if (p.some(x => x.k.includes('画用紙'))) ng('かようし で 画用紙が でる');
  const q = H.predict('のーと', { grade: 6, maze: true });
  if (!q.some(x => x.k.includes('ノート'))) ng('のーと で ノートが でない');
  const r = H.predict('じゅんばん', { grade: 6, maze: true });
  if (!r.some(x => x.k.includes('順番'))) ng('じゅんばん で 順番が でない');
  const s = H.predict('きた', { grade: 2, maze: true });
  if (!s.length || s[0].k[0] !== '来た') ng('きた の さいしょが 来た でない：' + JSON.stringify(s[0]));
}

/* ---- 6. こえ ---- */
{
  const o2 = { grade: 2, maze: true };
  const pairs = [
    ['家族で動物園に行きました', '家ぞくでどうぶつ園に行きました'],
    ['体温をはかった', '体温をはかった'],
    ['体重をはかった', '体じゅうをはかった'],
    ['運動会', 'うんどう会'],
  ];
  for (const [a, b] of pairs) { const got = H.soften(a, o2); if (got !== b) ng(`こえ「${a}」→「${got}」（「${b}」）`); }
}

/* ---- 7. 大きさ ---- */
const sizes = ['辞書.html', 'henkan.html', 'index.html'].filter(f => fs.existsSync(path.join(dir, f)))
  .map(f => `${f} ${(fs.statSync(path.join(dir, f)).size / 1024).toFixed(1)}KB`);
const st = H.stats();
console.log(`辞書：よみ ${st.readings}・かたち ${st.forms}（${sizes.join('・')}）`);
console.log(`文の 変換：${ok}/${CASES.length}`);
console.log(fail ? `✗ ${fail}こ まちがい` : '○ ぜんぶ OK');
process.exit(fail ? 1 : 0);
