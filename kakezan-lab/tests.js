/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までの 計算の ぶぶんを とりだして しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box, window: undefined });
const L = box.NarabeLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const texts = ls => ls.map(l => l.text).join(' / ');

/* 九九 */
t('さんし じゅうに', L.kukuReading(3, 4) === 'さんし じゅうに');
t('九九に ない ときは から', L.kukuReading(4, 12) === '');
t('よみあげ：九九に ない ときは かける・は', L.sayMul(4, 12) === '4 かける 12 は 48');

/* ならべ方 */
const g1 = L.gridSize(7, 3, 'yoko'), g2 = L.gridSize(7, 3, 'tate');
t('よこ：1つ分 7 は よこに 7こ', g1.cols === 7 && g1.rows === 3);
t('たて：1つ分 7 は たてに 7こ', g2.cols === 3 && g2.rows === 7);
t('しき：よこ 5・たて 3 は よこなら 5 × 3', L.rectExpr(5, 3, 'yoko').join() === '5,3');
t('しき：よこ 3・たて 5 は たてなら 5 × 3', L.rectExpr(3, 5, 'tate').join() === '5,3');

/* せん */
let r = L.toggleCut([], { ax: 'v', at: 5 }, 2);
t('せんを 入れる', r.did === 'add' && r.cuts.length === 1);
r = L.toggleCut(r.cuts, { ax: 'h', at: 1 }, 2);
r = L.toggleCut(r.cuts, { ax: 'v', at: 2 }, 2);
t('せんは 2本まで', r.did === 'full' && r.cuts.length === 2);
r = L.toggleCut(r.cuts, { ax: 'v', at: 5 }, 2);
t('もう いちど タップで けす', r.did === 'del' && r.cuts.length === 1 && r.cuts[0].ax === 'h');
r = L.moveCut([{ ax: 'v', at: 5 }], { ax: 'v', at: 5 }, { ax: 'v', at: 3 });
t('せんを うごかす', r.did === 'move' && r.cuts[0].at === 3);
t('ちがう むきには うごかさない', L.moveCut([{ ax: 'v', at: 5 }], { ax: 'v', at: 5 }, { ax: 'h', at: 1 }).did === 'none');
t('はみ出した せんを おとす', L.fitCuts([{ ax: 'v', at: 6 }, { ax: 'h', at: 2 }], 5, 3).length === 1);

/* 7 × 3 を 5 × 3 と 2 × 3 に */
const s73 = L.splitArray(7, 3, 'yoko', [{ ax: 'v', at: 5 }]);
t('7 × 3 を 5 と 2 に わける', texts(s73.lines) === '5 × 3 ＝ 15 / 2 × 3 ＝ 6 / 15 ＋ 6 ＝ 21 / 7 × 3 ＝ 21', texts(s73.lines));
const s73t = L.splitArray(7, 3, 'tate', [{ ax: 'h', at: 5 }]);
t('たてに ならべても おなじ しき', texts(s73t.lines) === texts(s73.lines), texts(s73t.lines));
const s6 = L.splitArray(6, 4, 'yoko', [{ ax: 'v', at: 5 }]);
t('6のだん ＝ 5のだん ＋ 1のだん', texts(s6.lines) === '5 × 4 ＝ 20 / 1 × 4 ＝ 4 / 20 ＋ 4 ＝ 24 / 6 × 4 ＝ 24', texts(s6.lines));
const s412 = L.splitArray(4, 12, 'yoko', [{ ax: 'h', at: 10 }]);
t('4 × 12 を 4 × 10 と 4 × 2 に', texts(s412.lines) === '4 × 10 ＝ 40 / 4 × 2 ＝ 8 / 40 ＋ 8 ＝ 48 / 4 × 12 ＝ 48', texts(s412.lines));
const s4 = L.splitArray(7, 6, 'yoko', [{ ax: 'v', at: 5 }, { ax: 'h', at: 3 }]);
t('たて・よこ 1本ずつで 4つに', s4.parts.length === 4 && s4.lines[4].text === '15 ＋ 6 ＋ 15 ＋ 6 ＝ 42', texts(s4.lines));
t('せんが ない ときは しきを 出さない', L.splitArray(7, 3, 'yoko', []).lines.length === 0);

/* ゆびの いち */
const lay = L.layout(7, 3, [], { pad: 80 });
t('●と ●の あいだ（たて）', L.sameCut(L.nearestGap(580, 230, lay), { ax: 'v', at: 5 }));
t('●と ●の あいだ（よこ）', L.sameCut(L.nearestGap(330, 181, lay), { ax: 'h', at: 1 }));
t('●の まん中は なにも しない', L.nearestGap(130, 130, lay) === null);
t('●の うえの そとは たての せん', L.sameCut(L.nearestGap(378, 30, lay), { ax: 'v', at: 3 }));
t('●の ひだりの そとは よこの せん', L.sameCut(L.nearestGap(20, 285, lay), { ax: 'h', at: 2 }));
t('とおく はなれた ところは なにも しない', L.nearestGap(-400, 100, lay) === null);
const lay2 = L.layout(7, 3, [{ ax: 'v', at: 5 }], { pad: 80, G: 40 });
t('せんの ところは すきまが あく', lay2.colX(5) - lay2.colX(4) === 140 && lay2.vb[4].x === lay2.colX(5) - 20);
t('せんを うごかす ときは おなじ むきだけ', L.nearestGap(130, 181, lay, 'v').ax === 'v');
t('マスを 見つける', JSON.stringify(L.cellAt(250, 150, lay)) === '{"r":0,"c":1}');

/* かたちの● */
const Lsh = L.makeShape(L.SHAPES[0].rows);
t('Lの かたちは 24こ', L.shapeCount(Lsh) === 24);
const lw = L.shapeSplit(Lsh, [{ ax: 'h', at: 2 }], 'yoko');
t('Lの かたちを よこに わける', lw.ok && texts(lw.lines) === '3 × 2 ＝ 6 / 6 × 3 ＝ 18 / 6 ＋ 18 ＝ 24 / ●は ぜんぶで 24こ', texts(lw.lines));
const lv = L.shapeSplit(Lsh, [{ ax: 'v', at: 3 }], 'yoko');
t('Lの かたちを たてに わける', lv.ok && texts(lv.lines) === '3 × 5 ＝ 15 / 3 × 3 ＝ 9 / 15 ＋ 9 ＝ 24 / ●は ぜんぶで 24こ', texts(lv.lines));
const lbad = L.shapeSplit(Lsh, [{ ax: 'h', at: 3 }], 'yoko');
t('長方形に ならない わけかたは だめ', !lbad.ok && lbad.bad.length === 1 && lbad.lines.length === 0);
t('せんが ない ときは だめ', !L.shapeSplit(Lsh, [], 'yoko').ok);
const holes = new Set(['0,3', '0,4', '0,5', '1,3', '1,4', '1,5']);
const og = L.oginau(Lsh, holes, 'yoko');
t('Lの かたちを おぎなう', og.complete && texts(og.lines) === '6 × 5 ＝ 30 / 3 × 2 ＝ 6 / 30 − 6 ＝ 24 / ●は ぜんぶで 24こ', texts(og.lines));
t('たりない ときは まだ', !L.oginau(Lsh, new Set(['0,3']), 'yoko').complete);
const cross = L.makeShape(L.SHAPES[5].rows), cf = new Set();
for (let r = 0; r < cross.h; r++) for (let c = 0; c < cross.w; c++) if (!cross.cells[r][c]) cf.add(r + ',' + c);
const oc = L.oginau(cross, cf, 'yoko');
t('十字を おぎなう（4つの かど）', oc.holes.length === 4 && oc.lines[5].text === '36 − 4 − 4 − 4 − 4 ＝ 20', texts(oc.lines));
const stairs = L.makeShape(L.SHAPES[1].rows), sf = new Set();
for (let r = 0; r < stairs.h; r++) for (let c = 0; c < stairs.w; c++) if (!stairs.cells[r][c]) sf.add(r + ',' + c);
const os = L.oginau(stairs, sf, 'yoko');
t('かいだんの たりない ところ（Lの かたち）を 2つの 長方形に', os.holes.length === 2 && os.lines[3].text === '36 − 8 − 4 ＝ 24', texts(os.lines));

/* どの もんだいも、せん 2本 いないで わけられる・おぎなえる */
for (const p of L.SHAPES) {
    const sh = L.makeShape(p.rows);
    const cands = [];
    for (let k = 1; k < sh.w; k++) cands.push({ ax: 'v', at: k });
    for (let k = 1; k < sh.h; k++) cands.push({ ax: 'h', at: k });
    let found = null;
    for (let i = 0; i < cands.length && !found; i++) {
        if (L.shapeSplit(sh, [cands[i]], 'yoko').ok) found = [cands[i]];
        for (let j = i + 1; j < cands.length && !found; j++) if (L.shapeSplit(sh, [cands[i], cands[j]], 'yoko').ok) found = [cands[i], cands[j]];
    }
    const all = new Set();
    for (let r = 0; r < sh.h; r++) for (let c = 0; c < sh.w; c++) if (!sh.cells[r][c]) all.add(r + ',' + c);
    const o2 = L.oginau(sh, all, 'yoko');
    const sum = found ? L.shapeSplit(sh, found, 'yoko').total : -1;
    t(`もんだい「${p.name}」`, found && o2.complete && o2.lines[o2.lines.length - 2].n === L.shapeCount(sh) && sum === L.shapeCount(sh), JSON.stringify(found));
}

/* じぶんの かたち */
const enc = L.encodeShape(Lsh);
t('かたちを 文字に する', enc === '6x5-1k.1k.1r.1r.1r', enc);
t('文字から かたちに もどす', JSON.stringify(L.decodeShape(enc)) === JSON.stringify(Lsh));
t('こわれた 文字は つかわない', L.decodeShape('6x5-zz.1') === null && L.decodeShape('99x1-1') === null && L.decodeShape('') === null);
const tr = L.trimShape({ w: 4, h: 3, cells: [[false, false, false, false], [false, true, true, false], [false, false, false, false]] });
t('まわりの あいた ところを けずる', tr.w === 2 && tr.h === 1);

/* URL */
const h = L.toHash({ m: 'wakeru', a: 7, b: 3, x: '' });
t('URL に かく', h === 'm=wakeru&a=7&b=3', h);
const o = L.fromHash('#' + h + '&bad=%E0%A4%A');
t('URL を よむ（こわれた ところは すてる）', o.m === 'wakeru' && o.a === '7' && !('bad' in o));
t('数の はんい', L.clamp('15', 1, 9) === 9 && L.clamp('x', 1, 9) === 1);

/* ---------- けっか ---------- */
const ng = rows.filter(x => !x.ok);
for (const x of rows) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.ok || !x.detail ? '' : '  … ' + x.detail));
console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
process.exitCode = ng.length ? 1 : 0;
