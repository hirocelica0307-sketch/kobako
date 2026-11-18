/* フリーボード の しくみの たしかめ（node tests.js で 動きます） */
'use strict';
const B = require('./logic.js');

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const J = x => JSON.stringify(x);
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

/* ---------- 背景 ---------- */
const bgDef = B.sanitizeBg(null);
t('背景の はじめは 白の 無地', bgDef.kind === 'plain' && bgDef.color === 'white' && bgDef.size === 40, J(bgDef));
t('へんな 背景は なおす', (() => { const b = B.sanitizeBg({ kind: 'x', color: 'red', size: 999, strength: 9 }); return b.kind === 'plain' && b.color === 'white' && b.size === 160 && b.strength === 2; })());
t('小さすぎる マスは 16px に', B.sanitizeBg({ size: 2 }).size === 16);
t('黒と 黒板は くらい 地', B.isDarkBg({ color: 'black' }) && B.isDarkBg({ color: 'green' }) && !B.isDarkBg({ color: 'cream' }));
t('くらい 地では 線の 色を あかるく', B.bgLineColor({ color: 'black', lineColor: 'blue' }) === B.LINE_COLORS.blue.dark);

const R = (w, h) => ({ x: 0, y: 0, w: w, h: h });
const plain = B.bgShapes({ kind: 'plain' }, R(400, 300), 400, 1);
t('無地は 線なし', plain.lines.length === 0 && plain.dots.length === 0);

const grid = B.bgShapes({ kind: 'grid', size: 40 }, R(400, 300), 400, 1);
const gv = grid.lines.filter(l => l.x1 === l.x2), gh = grid.lines.filter(l => l.y1 === l.y2);
t('マス目：たて 11本（0〜400）', gv.length === 11 && gv[0].x1 === 0 && gv[10].x1 === 400, gv.map(l => l.x1).join());
t('マス目：よこ 8本（0〜280）', gh.length === 8, gh.length);
t('マス目：点線なし', grid.lines.every(l => !l.dash));

const grid2 = B.bgShapes({ kind: 'grid', size: 40, sub: true, bold5: true }, R(400, 300), 400, 1);
t('十字の 点線は マスの まんなか', grid2.lines.some(l => l.dash && l.x1 === 20 && l.x2 === 20) && grid2.lines.some(l => l.dash && l.y1 === 20));
t('5マスごとに 太い 線', grid2.lines.filter(l => l.x1 === l.x2 && !l.dash && l.w > 2).map(l => l.x1).join() === '0,200,400');
const gNeg = B.bgShapes({ kind: 'grid', size: 40, bold5: true }, { x: -230, y: 0, w: 100, h: 50 }, 400, 1);
t('マイナスの ところ（左に 移動した とき）も 5マスごと', gNeg.lines.filter(l => l.x1 === l.x2 && l.w > 2).map(l => l.x1).join() === '-200', gNeg.lines.filter(l => l.x1 === l.x2).map(l => l.x1 + ':' + l.w).join());
t('見えて いる ところだけ 線を ひく', gNeg.lines.filter(l => l.x1 === l.x2).map(l => l.x1).join() === '-200,-160', gNeg.lines.filter(l => l.x1 === l.x2).map(l => l.x1).join());
t('線の はしは 見えて いる ところ', gNeg.lines[0].y1 === 0 && gNeg.lines[0].y2 === 50);
const gZoom = B.bgShapes({ kind: 'grid', size: 40, sub: true }, R(400, 300), 400, 0.2);
t('ちぢめて マスが 8px（12px より 小さい）→ 点線は はぶく', gZoom.lines.every(l => !l.dash) && gZoom.lines.length > 0);
t('ちぢめて マスが 2px → 線を ひかない', B.bgShapes({ kind: 'grid', size: 40 }, R(400, 300), 400, 0.05).lines.length === 0);

const hl = B.bgShapes({ kind: 'hline', size: 50 }, R(300, 260), 300, 1);
t('横の線：50px ごと', hl.lines.map(l => l.y1).join() === '0,50,100,150,200,250', hl.lines.map(l => l.y1).join());
const hl2 = B.bgShapes({ kind: 'hline', size: 50, sub: true }, R(300, 120), 300, 1);
t('横の線：あいだに 点線', hl2.lines.filter(l => l.dash).map(l => l.y1).join() === '25,75', J(hl2.lines));

const vl = B.bgShapes({ kind: 'vline', size: 100 }, R(350, 200), 350, 1);
t('縦の線：右の はし（350）から 100px ごと', vl.lines.map(l => l.x1).sort((a, b) => a - b).join() === '50,150,250,350', vl.lines.map(l => l.x1).join());

const dots = B.bgShapes({ kind: 'dot', size: 50 }, R(210, 110), 210, 1);
t('点：50px ごと（0,50,100 … 200 × 0,50,100）', dots.dots.length === 5 * 3 && dots.dots[0].x === 0 && dots.dots[0].y === 0, dots.dots.length);

/* ---------- 拡大・移動 ---------- */
const v1 = { s: 2, x: 100, y: 50 };
t('画面 → ボード', J(B.toWorld(v1, 300, 250)) === J([100, 100]));
t('ボード → 画面', J(B.toScreen(v1, 100, 100)) === J([300, 250]));
const vz = B.zoomAt({ s: 1, x: 0, y: 0 }, 2, 200, 100);
t('(200,100) を 中心に 2ばい：その 点は うごかない', J(B.toScreen(vz, 200, 100)) === J([200, 100]) && vz.s === 2, J(vz));
t('拡大は 8ばい まで', B.zoomAt({ s: 1, x: 0, y: 0 }, 99, 0, 0).s === B.ZOOM_MAX && B.zoomAt({ s: 1, x: 0, y: 0 }, 0.01, 0, 0).s === B.ZOOM_MIN);
const pv = B.pinchView({ s: 1, x: 0, y: 0 }, [100, 100], [200, 100], [50, 100], [250, 100]);
t('2本ゆびを 2ばいに ひろげる → 2ばい・まんなかは そのまま', pv.s === 2 && J(B.toScreen(pv, 150, 100)) === J([150, 100]), J(pv));
const pm = B.pinchView({ s: 1, x: 0, y: 0 }, [100, 100], [200, 100], [130, 140], [230, 140]);
t('2本ゆびで うごかす → 移動だけ', pm.s === 1 && pm.x === 30 && pm.y === 40, J(pm));
t('見えて いる ところ', J(B.visibleRect({ s: 2, x: -100, y: 0 }, 400, 300)) === J({ x: 50, y: 0, w: 200, h: 150 }));
t('ビューを たしかめる', J(B.sanitizeView({ s: 'x', x: NaN })) === J({ s: 1, x: 0, y: 0 }) && B.sanitizeView({ s: 100 }).s === B.ZOOM_MAX);

/* ---------- 画像 ---------- */
const fit = B.fitInto(400, 200, { x: 0, y: 0, w: 1000, h: 1000 }, 0.8);
t('画像を おさめる（よこが 長い）', fit.w === 800 && fit.h === 400 && fit.x === 100 && fit.y === 300, J(fit));
const pic = { t: 'image', id: 'i', x: 0, y: 0, w: 200, h: 100, ref: 'abc' };
const rz = B.resizeBox(pic, 2, 300, 120);
t('右下の 角を ひっぱる：左上は そのまま・わりあいも そのまま', rz.x === 0 && rz.y === 0 && rz.w === 300 && rz.h === 150, J(rz));
const rz0 = B.resizeBox(pic, 0, 100, 50);
t('左上の 角を ひっぱる：右下は そのまま', rz0.x + rz0.w === 200 && rz0.y + rz0.h === 100 && rz0.w === 100 && rz0.h === 50, J(rz0));
t('小さく しすぎない', B.resizeBox(pic, 2, 0, 0, 8).w === 8);
t('画像は わくの 中で あたる', B.hitTest(pic, 150, 50, 0) && !B.hitTest(pic, 250, 50, 0));
t('画像を うごかす', B.translate(pic, 5, 6).x === 5 && pic.x === 0);
t('画像の 色は かえない', !B.hasColor(pic));
t('画像の データを たしかめる', !!B.sanitizeObj(pic) && B.sanitizeObj(Object.assign({}, pic, { ref: '../x' })) === null && B.sanitizeObj(Object.assign({}, pic, { w: 0 })) === null);
t('つかって いる 画像の なまえ', J(Array.from(B.imageRefs([{ objs: [pic, { t: 'pen' }] }, { objs: [Object.assign({}, pic, { ref: 'b' }), pic] }]))) === J(['abc', 'b']));

/* ---------- ぴったり あわせる・まっすぐ ---------- */
t('マス目に あわせる', J(B.snapPoint(58, 81, 40)) === J([40, 80]));
t('マス目と 点だけ あわせる', B.canSnap({ kind: 'grid' }) && B.canSnap({ kind: 'dot' }) && !B.canSnap({ kind: 'hline' }) && !B.canSnap({ kind: 'plain' }));
const ca = B.constrainAngle(0, 0, 100, 4);
t('Shift：ほぼ よこ → まよこ', near(ca[1], 0) && near(ca[0], Math.hypot(100, 4), 1e-3), J(ca));
const ca2 = B.constrainAngle(0, 0, 50, 48);
t('Shift：ななめ → 45°', near(ca2[0], ca2[1], 1e-3), J(ca2));
t('Shift：正方形', J(B.constrainSquare(10, 10, 40, -50)) === J([70, -50]));

/* ---------- 当たり判定 ---------- */
const pen = { t: 'pen', pts: [[0, 0], [100, 0]], w: 4, c: '#222222' };
t('線の 上は あたる', B.hitTest(pen, 50, 1, 0));
t('線から はなれると あたらない', !B.hitTest(pen, 50, 10, 0));
t('ゆとりで あたる', B.hitTest(pen, 50, 10, 9));
const rect = { t: 'rect', x1: 0, y1: 0, x2: 100, y2: 50, w: 2, fill: 'none' };
t('四角（ぬらない）：中は あたらない', !B.hitTest(rect, 50, 25, 2));
t('四角（ぬらない）：ふちは あたる', B.hitTest(rect, 100, 25, 2));
t('四角（ぬる）：中も あたる', B.hitTest(Object.assign({}, rect, { fill: 'solid' }), 50, 25, 2));
const circ = { t: 'circle', cx: 0, cy: 0, r: 50, w: 4, fill: 'none' };
t('円：ふちは あたる', B.hitTest(circ, 0, 51, 0) && !B.hitTest(circ, 0, 0, 2));
const tri = { t: 'tri', x1: 0, y1: 0, x2: 100, y2: 100, w: 2, fill: 'light' };
t('三角：中が あたる・そとは あたらない', B.hitTest(tri, 50, 60, 0) && !B.hitTest(tri, 5, 10, 0));
t('三角の 点：上の まんなかが ちょうてん', J(B.shapePolygon(tri)) === J([[50, 0], [100, 100], [0, 100]]));
t('直角三角の 点', J(B.shapePolygon({ t: 'rtri', x1: 0, y1: 0, x2: 80, y2: 60 })) === J([[0, 0], [0, 60], [80, 60]]));
const ell = { t: 'ellipse', x1: 0, y1: 0, x2: 200, y2: 100, w: 2, fill: 'none' };
t('だ円：ふちは あたる', B.hitTest(ell, 200, 50, 2) && B.hitTest(ell, 100, 0, 2) && !B.hitTest(ell, 100, 50, 2));
const txt = { t: 'text', x: 10, y: 10, w: 100, h: 40, text: 'あ', size: 30 };
t('文字：わくの 中で あたる', B.hitTest(txt, 50, 30, 0) && !B.hitTest(txt, 150, 30, 0));
t('消しゴムの あとは えらべない', !B.hitTest({ t: 'erase', pts: [[0, 0]], w: 20 }, 0, 0, 10));

/* ---------- わく・うごかす ---------- */
const bb = B.bbox(pen);
t('線の わく（太さの 半分 ひろい）', bb.x === -2 && bb.y === -2 && bb.w === 104 && bb.h === 4, J(bb));
const bc = B.bbox(circ);
t('円の わく', bc.x === -52 && bc.w === 104, J(bc));
const mv = B.translate(rect, 10, 20);
t('うごかすと あたらしい もの（もとは そのまま）', mv.x1 === 10 && mv.y2 === 70 && rect.x1 === 0 && mv !== rect);
const mp = B.translate(pen, 5, 5);
t('線を うごかす', J(mp.pts) === J([[5, 5], [105, 5]]) && pen.pts[0][0] === 0);
const mc = B.translate(circ, 1, 2);
t('円を うごかす', mc.cx === 1 && mc.cy === 2 && mc.r === 50);
const mt = B.translate(txt, -10, 0);
t('文字を うごかす', mt.x === 0 && mt.y === 10);
const dup = B.duplicate(Object.assign({ id: 'a' }, rect), 24, 24);
t('ふやすと べつの id', dup.id !== 'a' && dup.x1 === 24);
t('かさなり', B.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) && !B.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }));

/* ---------- 矢印 ---------- */
const ah = B.arrowHead(0, 0, 100, 0, 4);
t('矢じりの 先は 終わりの 点', ah[0][0] === 100 && ah[0][1] === 0);
t('矢じりは 左右 たいしょう', near(ah[1][0], ah[2][0]) && near(ah[1][1], -ah[2][1]) && ah[1][0] < 100);

/* ---------- 点を へらす ---------- */
const thin = B.thinPoints([[0, 0], [0.2, 0], [0.4, 0], [3, 0], [3.1, 0]], 1);
t('ちかすぎる 点は すてる（さいごの 点は のこす）', J(thin) === J([[0, 0], [3, 0], [3.1, 0]]), J(thin));

/* ---------- ぬりつぶし ---------- */
/* 10×10 の 中に、□（ふち 1px）を かく。□の 中を おすと 中だけ ぬれる */
function img(W, H) { return new Uint8ClampedArray(W * H * 4); }
function setPx(d, W, x, y, a) { const i = (y * W + x) * 4; d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = a; }
const W = 10, H = 10, d = img(W, H);
for (let i = 2; i <= 7; i++) { setPx(d, W, i, 2, 255); setPx(d, W, i, 7, 255); setPx(d, W, 2, i, 255); setPx(d, W, 7, i, 255); }
const fIn = B.floodFill(d, W, H, 4, 4, 48);
t('□の 中だけ ぬる（4×4）', fIn && fIn.count === 16 && fIn.x === 3 && fIn.y === 3 && fIn.w === 4 && fIn.h === 4, fIn && J({ c: fIn.count, x: fIn.x, y: fIn.y, w: fIn.w }));
const fOut = B.floodFill(d, W, H, 0, 0, 48);
t('□の そとを おすと そとだけ ぬる', fOut && fOut.count === 100 - 36 && !fOut.mask[4 * W + 4], fOut && fOut.count);
const fLine = B.floodFill(d, W, H, 2, 2, 48);
t('線の 上を おすと 線（おなじ 色）を ぬる', fLine && fLine.count === 20, fLine && fLine.count);
t('そとを おすと null', B.floodFill(d, W, H, -1, 3, 48) === null);
/* うすい ふち（alpha 30）は すきまと おなじ あつかい、こい 線（alpha 200）は かべ */
const d2 = img(5, 1);
setPx(d2, 5, 1, 0, 30); setPx(d2, 5, 3, 0, 200);
const f2 = B.floodFill(d2, 5, 1, 0, 0, 48);
t('うすい ふちは こえる・こい 線で とまる', f2.count === 3 && f2.mask[2] === 1 && f2.mask[4] === 0, J(Array.from(f2.mask)));
const dil = B.dilateMask(fIn, W, H, 1);
t('ふとらせる：4×4 → 6×6', dil.w === 6 && dil.h === 6 && dil.mask[2 * W + 2] === 1 && dil.mask[1 * W + 1] === 0 && dil.mask[2 * W + 7] === 1, J({ w: dil.w, h: dil.h }));
let dilCount = 0; for (const v of dil.mask) dilCount += v;
t('ふとらせた 数は 36', dilCount === 36, dilCount);
const dEdge = B.dilateMask(B.floodFill(d, W, H, 0, 0, 48), W, H, 2);
t('はしを こえない', dEdge.x === 0 && dEdge.y === 0 && dEdge.w === 10 && dEdge.h === 10);

/* ---------- 保存した データ ---------- */
t('へんな ものは すてる', B.sanitizeObj({ t: 'virus' }) === null && B.sanitizeObj(null) === null && B.sanitizeObj({ t: 'pen', pts: [], c: '#000000' }) === null);
const sp = B.sanitizeObj({ t: 'pen', pts: [[1, 2], ['x', 3], [4, 5]], c: '#123456', w: 9999, hl: 1 });
t('線：おかしな 点を のぞく・太さを おさえる', sp && J(sp.pts) === J([[1, 2], [4, 5]]) && sp.w === 800 && sp.hl === true, J(sp));
t('色が おかしい 線は すてる', B.sanitizeObj({ t: 'pen', pts: [[1, 2]], c: 'javascript:alert(1)' }) === null);
const sr = B.sanitizeObj({ t: 'rect', x1: 0, y1: 0, x2: 1, y2: 1, c: '#000000', fill: 'bad' });
t('四角：ぬりかたが おかしい → ぬらない', sr && sr.fill === 'none');
t('ぬりつぶしは PNG の dataURL だけ', B.sanitizeObj({ t: 'fill', x: 0, y: 0, w: 1, h: 1, src: 'https://example.com/a.png' }) === null &&
  !!B.sanitizeObj({ t: 'fill', x: 0, y: 0, w: 1, h: 1, src: 'data:image/png;base64,AAAA', under: true }).under);
const st = B.sanitizeObj({ t: 'text', x: 0, y: 0, w: 10, h: 10, text: 'こんにちは', size: 40, c: '#ff0000', font: 'nope' });
t('文字：書体が おかしい → ゴシック', st && st.font === 'gothic' && st.text === 'こんにちは');
t('空の 文字は すてる', B.sanitizeObj({ t: 'text', x: 0, y: 0, w: 10, h: 10, text: '', size: 40, c: '#ff0000' }) === null);
const pg = B.sanitizePage({ bg: { kind: 'grid' }, objs: [{ t: 'pen', pts: [[0, 0]], c: '#000000' }, { t: 'bad' }] });
t('ページ：のこるのは 1つ', pg.objs.length === 1 && pg.bg.kind === 'grid' && pg.bg.size === 40 && pg.view.s === 1);
t('ページが ない → からっぽ', B.sanitizePage(undefined).objs.length === 0);

/* ---------- いろいろ ---------- */
t('id は かぶらない', new Set(Array.from({ length: 500 }, () => B.newId())).size === 500);
t('ファイル名の 日時', B.stamp(new Date(2026, 10, 18, 9, 5)) === '20261118-0905');
t('色を かえられる もの', B.hasColor({ t: 'pen' }) && !B.hasColor({ t: 'erase' }) && !B.hasColor({ t: 'fill' }));

/* ---------- けっか ---------- */
const ng = rows.filter(r => !r.ok);
for (const r of rows) console.log((r.ok ? 'OK  ' : 'NG  ') + r.name + (r.ok || !r.detail ? '' : '  … ' + r.detail));
console.log('\n' + (rows.length - ng.length) + ' / ' + rows.length + ' OK');
if (ng.length) process.exit(1);
