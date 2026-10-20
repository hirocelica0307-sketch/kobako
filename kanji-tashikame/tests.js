/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までを とりだして、
   お手本データと はんていを、まねして 書いた 線で しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box, window: undefined });
const L = box.KanjiLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

/* ---------- 書いた 線を まねる ----------
   お手本の 線に、大きさ・ばしょ・かたむき・1画ずつの ずれ・ゆれ を くわえて、ゆびで 書いた ような 線を つくる */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function dense(pts, step) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function write(ch, o = {}) {
  const r = rng(o.seed || 1), ref = L.getRef(ch);
  const sc = 0.65 + r() * 0.3, asp = 0.9 + r() * 0.2, rot = (4 * (2 * r() - 1)) * Math.PI / 180;
  const cx = 50 + (r() - 0.5) * (100 - 100 * sc) * 0.8, cy = 50 + (r() - 0.5) * (100 - 100 * sc) * 0.8;
  const G = p => { const x = (p[0] - 50) * sc * asp, y = (p[1] - 50) * sc / asp; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; };
  const jit = o.jit == null ? 2.5 : o.jit;
  let st = ref.strokes.map((s, k) => {
    let pts = s.pts.map(p => p.slice());
    if (o.startExt && o.startExt[k]) { const a = pts[0], b = pts[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); pts.unshift([a[0] - (b[0] - a[0]) / l * o.startExt[k], a[1] - (b[1] - a[1]) / l * o.startExt[k]]); }
    const c = pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length], [0, 0]);
    const f = (o.stretch && o.stretch[k]) || (0.92 + r() * 0.16);
    pts = pts.map(p => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f]);
    const mv = (o.move && o.move[k]) || [0, 0], dx = (2 * r() - 1) * jit + mv[0], dy = (2 * r() - 1) * jit + mv[1];
    pts = pts.map(p => [p[0] + dx, p[1] + dy]);
    if (s.end === 'h' && !(o.noHook || []).includes(k)) { const e = pts[pts.length - 1]; pts.push([e[0] + s.dir[0] * 7, e[1] + s.dir[1] * 7]); }
    let d = dense(pts, 1.5).map(p => [p[0] + (2 * r() - 1) * 0.5, p[1] + (2 * r() - 1) * 0.5]);
    if ((o.reverse || []).includes(k)) d.reverse();
    return { d, end: s.end, k };
  });
  if (o.split) for (const k of o.split) { const d = st[k].d, h = Math.floor(d.length / 2); st.splice(k, 1, { d: d.slice(0, h), end: 't', k }, { d: d.slice(h), end: st[k].end, k }); }
  if (o.omit) st = st.filter(s => !o.omit.includes(s.k));
  if (o.order) st = o.order.map(i => st[i]);
  let time = 1000;
  return st.map(s => {
    const style = o.style || s.end, n = s.d.length, pts = s.d.map((p, i) => {
      time += 1.5 / (0.12 * (i / n > 0.8 ? (style === 'p' ? 1.6 : style === 't' ? 0.35 : 1) : 1));
      const g = G(p); return { x: g[0], y: g[1], t: time, p: 0.5 };
    });
    const up = time + (style === 't' ? 160 : 10); time = up + 300;
    return { pts, up, type: 'touch' };
  });
}
const sev = r => (r.issues.some(i => i.sev === 'x') ? 'x' : r.issues.length ? 'tip' : 'ok');
const has = (r, re) => r.issues.some(i => re.test(i.msg));

/* ---------- データ ---------- */
const COUNT = { 合: 6, 雪: 11, 顔: 18, 弟: 7, 妹: 8, 台: 5, 絵: 12, 工: 3, 北: 5, 引: 4, 形: 7, 内: 4, 海: 9, 大: 3, 切: 4, 天: 4, 才: 3, 国: 8, 語: 14, 地: 6, 図: 7, 一: 1, 万: 3, 円: 4, 楽: 13, 食: 9, 歩: 8, 走: 7, 止: 4, 広: 5, 近: 7 };
t('もんだいは 25もん', L.QUESTIONS.length === 25, L.QUESTIONS.length);
t('書く 字は 31字', L.KANJI.length === 31, L.KANJI.join(''));
for (const ch of L.KANJI) {
  const ref = L.getRef(ch);
  t(`${ch}：お手本データが ある`, !!ref);
  if (!ref) continue;
  t(`${ch}：画数は ${COUNT[ch]}`, ref.strokes.length === COUNT[ch], ref.strokes.length);
  t(`${ch}：点は わくの 中`, ref.strokes.every(s => s.pts.every(p => p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100)));
  t(`${ch}：おわりかたの しるしが ただしい`, ref.strokes.every(s => 'tphn'.includes(s.end) && (s.end !== 'h' || s.dir)));
}
for (const q of L.QUESTIONS) {
  const ys = L.qKanji(q).map(w => w[1]).concat(q.o ? [q.o[2]] : []);
  t(`「${L.qKanji(q).map(w => w[0]).join('')}」：よみと おくりがなは ひらがな`, ys.every(y => /^[ぁ-ゖー]+$/.test(y)), ys.join(','));
  t(`「${L.qKanji(q).map(w => w[0]).join('')}」：例文に 漢字は 入れない`, !/[一-鿿]/.test(q.pre + q.post + (q.oku || '')), q.pre + q.post);
}

/* ---------- ていねいに 書いた 字は 〇（ふつう） ---------- */
let bad = [];
for (const ch of L.KANJI) for (let seed = 1; seed <= 12; seed++) {
  const r = L.judge(ch, write(ch, { seed }), 'normal');
  if (!r.ok) bad.push(`${ch}#${seed}:${r.issues[0].msg}`);
}
t('ていねいな 字（31字×12）は ふつうで ぜんぶ 〇', !bad.length, bad.slice(0, 5).join(' / '));
bad = [];
for (const ch of L.KANJI) for (let seed = 1; seed <= 6; seed++) {
  const r = L.judge(ch, write(ch, { seed, jit: 1.2 }), 'strict');
  if (!r.ok) bad.push(`${ch}#${seed}:${r.issues[0].msg}`);
}
t('とても ていねいな 字は きびしいでも 〇（9わり いじょう）', bad.length <= 31 * 6 * 0.1, `${bad.length}こ ${bad.slice(0, 3).join(' / ')}`);

/* ---------- まちがいを 見つける ---------- */
const expect = (name, ch, o, lv, want, re) => {
  const r = L.judge(ch, write(ch, o), lv);
  t(`${name}（${ch}・${L.LEVELS[lv].name}）`, sev(r) === want && (!re || has(r, re)), `${sev(r)} ${r.issues.map(i => i.msg).join(' / ')}`);
};
expect('はねない → ×', '才', { seed: 3, noHook: [1] }, 'normal', 'x', /はねる/);
expect('はねない → ポイント', '才', { seed: 3, noHook: [1] }, 'easy', 'tip', /はねる/);
expect('はねない → ×', '引', { seed: 2, noHook: [2] }, 'normal', 'x', /はねる/);
expect('1画 たりない → ×', '語', { seed: 1, omit: [6] }, 'normal', 'x', /14かくで/);
expect('1画 たりない → ×', '国', { seed: 4, omit: [7] }, 'normal', 'x', /8かくで/);
expect('1画を ずらす → ×', '合', { seed: 2, move: { 2: [0, 22] } }, 'normal', 'x', /3かくめ/);
expect('書きじゅん → ポイント', '北', { seed: 1, order: [1, 0, 2, 3, 4] }, 'normal', 'tip', /書きじゅん/);
expect('書きじゅん → ×', '北', { seed: 1, order: [1, 0, 2, 3, 4] }, 'strict', 'x', /書きじゅん/);
expect('むきが はんたい → ポイント', '工', { seed: 1, reverse: [2] }, 'normal', 'tip', /ひだりから みぎへ/);
expect('むきが はんたい → ×', '工', { seed: 1, reverse: [2] }, 'strict', 'x', /ひだりから みぎへ/);
expect('1画を とちゅうで はなす → ポイント', '大', { seed: 1, split: [0], jit: 1.5 }, 'normal', 'tip', /はなして/);
expect('はらいを とめる → ×', '大', { seed: 1, style: 't', jit: 1.5 }, 'strict', 'x', /はらう/);
expect('天の ノが 上に 出る（夫）→ ×', '天', { seed: 1, startExt: { 2: 12 }, jit: 1.5 }, 'normal', 'x', /出ないように/);
expect('妹の 未が 末に なる → ×', '妹', { seed: 1, stretch: { 3: 1.35, 4: 0.8 }, jit: 1.5 }, 'normal', 'x', /ながく/);
expect('工の 上が ながい → ×', '工', { seed: 1, stretch: { 0: 1.5, 2: 0.75 }, jit: 1 }, 'normal', 'x');
expect('大の ノが 一と まじわらない → ×', '大', { seed: 1, move: { 1: [0, 31] }, jit: 1 }, 'normal', 'x');
expect('才の ノの 上が 出ない（許容）→ 〇', '才', { seed: 1, move: { 2: [-6, 6] }, jit: 1 }, 'normal', 'ok');
t('なにも 書かない → ×', !L.judge('合', [], 'normal').ok);

/* ---------- けっか ---------- */
const ng = rows.filter(r => !r.ok);
for (const r of ng) console.log(`NG  ${r.name}  ${r.detail}`);
console.log(`${rows.length - ng.length} / ${rows.length} OK`);
process.exit(ng.length ? 1 : 0);
