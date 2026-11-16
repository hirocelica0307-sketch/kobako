/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までの 計算の ぶぶんを とりだして しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const L = ctx.MoyouLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const P = (t, r, x, y, id) => ({ id: id || 0, t, r, x, y });
const C = 24, R = 14;

/* いろがみ */
t('色紙は 6しゅるい', L.TYPES.length === 6);
t('正方形・長方形・直角三角形が 2しゅるいずつ', ['sq', 're', 'tr'].every(s => L.TYPES.filter(T => T.shape === s).length === 2));

/* 大きさ（よすみの 三角の 数：1ます ＝ 4） */
t('正方形は 4ます ぶん', L.quarters(P(0, 0, 0, 0)).length === 16);
t('長方形は 2ます ぶん（正方形の 半分）', L.quarters(P(2, 0, 0, 0)).length === 8 && L.quarters(P(2, 1, 0, 0)).length === 8);
t('直角三角形は 2ます ぶん（正方形の 半分）', [0, 1, 2, 3].every(r => L.quarters(P(4, r, 0, 0)).length === 8));
t('長方形を まわすと たてながに なる', L.size('re', 1).w === 1 && L.size('re', 1).h === 2);
t('まわす 数：正方形 1・長方形 2・直角三角形 4', L.SHAPES.sq.turns === 1 && L.SHAPES.re.turns === 2 && L.SHAPES.tr.turns === 4);

/* しきつめ */
const a = P(4, 0, 0, 0, 1);
t('直角三角形 2まいで 正方形に なる（むきが ぎゃく）', L.fits(P(5, 2, 0, 0), [a], C, R));
t('おなじ むきの 直角三角形は かさなる', !L.fits(P(5, 0, 0, 0), [a], C, R));
t('となりの むきの 直角三角形も かさなる', !L.fits(P(5, 1, 0, 0), [a], C, R));
t('正方形の 上には おけない', !L.fits(P(2, 0, 1, 1), [P(0, 0, 0, 0, 1)], C, R));
t('正方形の となりには おける', L.fits(P(0, 0, 2, 0), [P(0, 0, 0, 0, 1)], C, R));
t('長方形の れんが（半分 ずらし）', L.fits(P(2, 0, 1, 1), [P(2, 0, 0, 0, 1), P(3, 0, 2, 0, 2)], C, R));
t('長方形 2まいで 正方形の ところが うまる', (() => {
    const two = [P(2, 0, 0, 0, 1), P(3, 0, 0, 1, 2)];
    return !L.fits(P(4, 0, 0, 0), two, C, R) && !L.fits(P(4, 2, 0, 0), two, C, R);
})());
t('だいしから はみでると おけない', !L.fits(P(0, 0, C - 1, 0), [], C, R) && !L.fits(P(0, 0, -1, 0), [], C, R));
t('じぶん じしんとは かさならない（うごかす とき）', L.fits(P(0, 0, 1, 0, 7), [P(0, 0, 0, 0, 7)], C, R, 7));

/* ゆびの いち */
const an = L.anchorAt('sq', 0, 3.4, 5.9);
t('ゆびの ところが まんなかに くる', an.x === 2 && an.y === 5, JSON.stringify(an));
const an2 = L.anchorAt('re', 1, 3.4, 5.9);
t('たての 長方形も ゆびの ところに', an2.x === 3 && an2.y === 5, JSON.stringify(an2));
t('ゆびの 下の いろがみ', L.pieceAt([a], 0.3, 0.3) === a);
t('直角三角形の あいている ほうは 何も ない', L.pieceAt([a], 1.7, 1.7) === null);

/* すいつき */
const tri = [P(4, 0, 0, 0, 1)];
const sn = L.snapAtPointer(5, 2, 1.6, 1.6, tri, C, R);
t('三角の すきまを タップすると ぴたっと 入る', sn.ok && sn.p.x === 0 && sn.p.y === 0, JSON.stringify(sn.p));
const sn2 = L.snapAtPointer(0, 0, 2.2, 1.0, [P(0, 0, 0, 0, 1)], C, R);
t('ちょっと かさなる ところを タップしても となりに 入る', sn2.ok && sn2.p.x === 2 && sn2.p.y === 0, JSON.stringify(sn2.p));
const sn3 = L.snapAtPointer(0, 0, 1, 1, [P(0, 0, 0, 0, 1)], C, R);
t('いろがみの まんなかでは おかない', !sn3.ok);
const sn4 = L.snapNear({ id: 0, t: 0, r: 0 }, 1.6, 0.2, [P(0, 0, 0, 0, 1)], C, R, undefined, 0.85);
t('ドラッグで はなすと ちかくの あいている ところへ', sn4.ok && sn4.p.x === 2 && sn4.p.y === 0, JSON.stringify(sn4.p));
t('直角三角形の まんなかは 2/3 の ところ', Math.abs(L.center('tr', 0).x - 2 / 3) < 1e-9 && Math.abs(L.center('tr', 2).y - 4 / 3) < 1e-9);

const oz = [P(4, 0, 0, 4, 1)];
const sz = L.snapAtPointer(5, 2, 1.6, 4.6, oz, C, R);
t('ななめの さかいめでも 三角どうしが 正方形に なる ほうへ', sz.ok && sz.p.x === 0 && sz.p.y === 4, JSON.stringify(sz.p));
const row = [];
for (let x = 0.3; x < 9; x += 0.3) { const r = L.snapAtPointer(2, 0, x, 0.5, row, C, R); if (r.ok) row.push(Object.assign(r.p, { id: row.length + 1 })); }
t('よこに なぞると 長方形が まっすぐ すきまなく ならぶ', row.length >= 4 && row.every(p => p.y === 0) && row.every((p, i) => i === 0 || p.x === row[i - 1].x + 2), JSON.stringify(row.map(p => [p.x, p.y])));

/* まわす */
const rr = L.rotateInPlace(P(2, 0, C - 2, 0, 1), [P(2, 0, C - 2, 0, 1)], C, R);
t('長方形を その場で まわす', rr && rr.r === 1 && rr.x === C - 2);
const rb = L.rotateInPlace(P(2, 0, 0, 0, 1), [P(2, 0, 0, 0, 1), P(0, 0, 0, 1, 2)], C, R);
t('まわすと かさなる ときは まわさない', rb === null);
t('正方形は まわさない', L.rotateInPlace(P(0, 0, 0, 0, 1), [P(0, 0, 0, 0, 1)], C, R) === null);
const ru = L.rotateInPlace(P(2, 1, 0, R - 2, 1), [P(2, 1, 0, R - 2, 1)], C, R);
t('はしでも はみださない ように まわす', ru && L.inBounds(ru, C, R));

/* ひろさ */
t('ひろさ 3しゅるい（正方形が はいる 偶数の ます）', L.SIZES.length === 3 && L.SIZES.every(s => s.cols % 2 === 0 && s.rows % 2 === 0));
t('せまく できるか', L.allInBounds([P(0, 0, 10, 4)], 16, 10) && !L.allInBounds([P(0, 0, 20, 4)], 16, 10));

const bad = rows.filter(r => !r.ok);
for (const r of rows) console.log((r.ok ? '○ ' : '× ') + r.name + (r.ok || !r.detail ? '' : '  … ' + r.detail));
console.log(`\n${rows.length - bad.length} / ${rows.length} OK`);
process.exit(bad.length ? 1 : 0);
