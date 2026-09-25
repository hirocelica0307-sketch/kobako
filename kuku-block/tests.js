/* きまりの たしかめ（ブラウザで tests.html を ひらくと 動きます。node tests.js でも 動きます）
   画面を つかわない ところ（かこみ・マス目・あいている ばしょ・しき）を しらべます。 */
(function (root) {
    'use strict';
    const L = root.KukuLogic || require('./logic.js');

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* かたち */
        const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
        t('しかくの 中の 点は 中', L.pointInPolygon(50, 50, sq));
        t('しかくの 外の 点は 外', !L.pointInPolygon(150, 50, sq));
        t('めんせき 100×100 ＝ 10000', L.polygonArea(sq) === 10000);
        t('線までの きょり', Math.abs(L.distToPolyline(50, 110, sq, true) - 10) < 1e-9);

        /* かこみ */
        const circle = [];
        for (let i = 0; i < 60; i++) circle.push([200 + 80 * Math.cos(i / 60 * 6.283), 200 + 80 * Math.sin(i / 60 * 6.283)]);
        const loop = L.makeLoop(circle);
        t('ぐるっと かいた 線は かこみに なる', loop && loop.length > 10);
        t('かこみの まん中は 中', loop && L.pointInPolygon(200, 200, loop));
        const open = circle.slice(0, 45);   /* 3/4 しか かいていない */
        const loop2 = L.makeLoop(open);
        t('とじていない 線も むすんで かこみに する', loop2 && L.pointInPolygon(210, 200, loop2));
        t('ちいさな 点（タップ）は かこみに しない', L.makeLoop([[10, 10], [11, 11], [12, 10]]) === null);
        t('みじかい 線は かこみに しない', L.makeLoop([[0, 0], [5, 0], [10, 0], [15, 0], [20, 1], [25, 0]]) === null);

        /* かこみの 中の ブロック */
        const S = 40;
        const blocks = [
            { id: 'a', x: 160, y: 160 }, { id: 'b', x: 200, y: 160 },   /* 中 */
            { id: 'c', x: 400, y: 400 },                                /* 外 */
            { id: 'd', x: 260, y: 260 },                                /* まん中 (280,280) は 外 */
        ];
        const inside = L.blocksInLoop(blocks, loop, S).map(b => b.id).sort().join(',');
        t('まん中が かこみの 中の ブロックだけ かぞえる', inside === 'a,b', inside);

        const outer = { id: 'o', pts: loop };
        const small = { id: 's', pts: sq.map(([x, y]) => [x / 5 + 190, y / 5 + 190]) };
        const far = { id: 'f', pts: sq.map(([x, y]) => [x + 500, y]) };
        const inner = L.loopsInLoop([outer, small, far], outer).map(l => l.id).join(',');
        t('かこみの 中の 小さい かこみを 見つける', inner === 's', inner);

        /* マス目 */
        t('マス目に そろえる', L.snap(61, 40) === 80 && L.snap(59, 40) === 40);
        t('マスの なまえ', L.cellKey(80, 120, 40) === '2,3');
        const occ = new Set(['2,2', '3,2']);
        const b = { x0: 0, y0: 0, x1: 400, y1: 400 };
        const fc = L.findFreeCell(80, 80, 40, occ, b);
        t('うまっている マスの となりを さがす', fc && !occ.has(L.cellKey(fc[0], fc[1], 40)) && Math.hypot(fc[0] - 80, fc[1] - 80) <= 40, String(fc));
        const edge = L.findFreeCell(390, 390, 40, new Set(), b);
        t('つくえの 外の マスは えらばない', edge[0] + 40 <= 400 && edge[1] + 40 <= 400, String(edge));

        /* あいている ばしょ */
        const r1 = L.findFreeRect(3, 4, 40, new Set(), b);
        t('からの つくえでは ひだり うえ（1マス あけて）', r1 && r1[0] === 40 && r1[1] === 40, String(r1));
        const occ2 = new Set();
        for (let c = 1; c <= 4; c++) for (let r = 1; r <= 3; r++) occ2.add(c + ',' + r);
        const r2 = L.findFreeRect(3, 4, 40, occ2, b);
        let clash = false;
        if (r2) for (let c = -1; c <= 4; c++) for (let r = -1; r <= 3; r++) if (occ2.has((r2[0] / 40 + c) + ',' + (r2[1] / 40 + r))) clash = true;
        t('ほかの ブロックと くっつかない ところに おく', r2 && !clash, String(r2));
        t('はいらない ときは null', L.findFreeRect(20, 20, 40, new Set(), b) === null);
        const r3 = L.findFreeRect(1, 1, 40, new Set(['1,1', '2,1']), b, 0);
        t('すきま なしで つぎの マス（タップで ならべる）', r3 && r3[0] === 120 && r3[1] === 40, String(r3));
        const r4 = L.findFreeRect(1, 1, 40, new Set(), { x0: 0, y0: 0, x1: 11 * 40 + 20, y1: 400 }, 0);
        const row = new Set();
        let p = r4;
        for (let i = 0; i < 10 && p; i++) { row.add(L.cellKey(p[0], p[1], 40)); p = L.findFreeRect(1, 1, 40, row, { x0: 0, y0: 0, x1: 11 * 40 + 20, y1: 400 }, 0); }
        t('タップで ならべると 1だん 10こで つぎの だんへ', p && p[0] === 40 && p[1] === 80, String(p));

        /* くっついている ブロック */
        const cl = [
            { id: '1', x: 0, y: 0 }, { id: '2', x: 40, y: 0 }, { id: '3', x: 40, y: 40 },
            { id: '4', x: 80, y: 80 },              /* 3 と ななめ → べつ */
            { id: '5', x: 200, y: 0 },
        ];
        const got = L.clusterOf(cl, '1', 40).sort().join(',');
        t('くっついている ブロックを あつめる（ななめは べつ）', got === '1,2,3', got);

        /* しき */
        const d1 = L.describe([3, 3, 3, 3], 0);
        t('3こずつ 4つ → 3 × 4 = 12', d1 && d1.kind === 'mul' && d1.expr === '3 × 4 = 12', d1 && d1.expr);
        t('ことばでも 3こずつ 4つぶん', d1 && d1.words.startsWith('3こずつ 4つぶん'), d1 && d1.words);
        const d2 = L.describe([3, 2, 3], 0);
        t('かずが ちがう ときは たしざん', d2 && d2.kind === 'add' && d2.expr === '3 + 2 + 3 = 8', d2 && d2.expr);
        const d3 = L.describe([4, 4, 0], 2);
        t('からの かこみは かぞえない・のこりも 出す', d3 && d3.expr === '4 × 2 = 8' && d3.words.includes('のこり 2こ'), d3 && d3.words);
        t('かこみが ない ときは しき なし', L.describe([], 5) === null && L.describe([0, 0], 5) === null);

        /* 九九の となえかた */
        let allRead = true;
        for (let n = 1; n <= 9; n++) for (let k = 1; k <= 9; k++) if (!L.kukuReading(n, k)) allRead = false;
        t('九九 81こ ぜんぶに となえかたが ある', allRead);
        t('3 × 3 は「さざんが く」', L.kukuReading(3, 3) === 'さざんが く');
        t('8 × 8 は「はっぱ ろくじゅうし」', L.kukuReading(8, 8) === 'はっぱ ろくじゅうし');
        t('9 × 9 は「くく はちじゅういち」', L.kukuReading(9, 9) === 'くく はちじゅういち');
        t('かけ算が こえたら から', L.kukuReading(3, 10) === '' && L.kukuReading(10, 1) === '');

        /* まわす */
        const r90 = L.rotate90(10, 0, 0, 0);
        t('時計まわりに 90°（右 → 下）', Math.abs(r90[0]) < 1e-9 && r90[1] === 10, String(r90));
        /* 3こ × 4だん（まん中 (60,80)）を まわすと 4こ × 3だん */
        const arr34 = [];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) arr34.push([c * 40 + 20, r * 40 + 20]);
        const rot = arr34.map(([x, y]) => L.rotate90(x, y, 60, 80));
        const xs = new Set(rot.map(p => Math.round(p[0]))), ys = new Set(rot.map(p => Math.round(p[1])));
        t('3 × 4 の ならびを まわすと よこ 4・たて 3', xs.size === 4 && ys.size === 3, `よこ${xs.size} たて${ys.size}`);

        /* ふやす ばしょ */
        const box = { x0: 40, y0: 40, x1: 160, y1: 80 };
        const sp = L.findSpot(box, [box], { x0: 0, y0: 0, x1: 600, y1: 400 }, 40, 4);
        t('ふやすと おなじ だんの 右に おく', sp && sp[1] === 0 && sp[0] > 0, String(sp));
        const wall = { x0: 160, y0: 0, x1: 600, y1: 100 };
        const sp2 = L.findSpot(box, [box, wall], { x0: 0, y0: 0, x1: 600, y1: 400 }, 40, 4);
        const moved = sp2 && { x0: box.x0 + sp2[0], y0: box.y0 + sp2[1], x1: box.x1 + sp2[0], y1: box.y1 + sp2[1] };
        t('右が ふさがって いたら ほかの ばしょ（かさならない）', moved && !L.boxesOverlap(moved, wall) && !L.boxesOverlap(moved, box), String(sp2));
        t('どこにも はいらない ときは null', L.findSpot(box, [{ x0: 0, y0: 0, x1: 600, y1: 400 }], { x0: 0, y0: 0, x1: 600, y1: 400 }, 40, 4) === null);

        /* じゆうに まわす */
        const ra = L.rotateAround(10, 0, 0, 0, Math.PI / 2);
        t('rotateAround 90° は rotate90 と おなじ', Math.abs(ra[0]) < 1e-9 && Math.abs(ra[1] - 10) < 1e-9, String(ra));
        const r45 = L.rotateAround(10, 0, 0, 0, Math.PI / 4);
        t('45° まわすと ななめ', Math.abs(r45[0] - r45[1]) < 1e-9 && r45[0] > 0);
        const tol = 12 * Math.PI / 180;
        t('85° は 90° に ぴたっ', L.snapAngle(85 * Math.PI / 180, tol) === Math.PI / 2);
        t('-178° は -180° に ぴたっ', L.snapAngle(-178 * Math.PI / 180, tol) === -Math.PI);
        t('45° は そのまま', Math.abs(L.snapAngle(Math.PI / 4, tol) - Math.PI / 4) < 1e-12);
        t('90°・180°・0° は まっすぐ、30° は ちがう', L.isRightAngle(Math.PI / 2) && L.isRightAngle(-Math.PI) && L.isRightAngle(0) && !L.isRightAngle(Math.PI / 6));

        /* おはじき */
        t('うらがえす：あお ⇔ あか、さくら あお ⇔ さくら あか', L.flipColor('b') === 'r' && L.flipColor('r') === 'b' && L.flipColor('sb') === 'sr' && L.flipColor('sr') === 'sb');
        t('さくら は おはじき', L.isOhajiki('sb') && L.isOhajiki('sr') && !L.isOhajiki('b'));
        t('こうたい：ブロックは あお→あか、さくらは さくらあお→さくらあか',
            L.danColor('x', 0) === 'b' && L.danColor('x', 1) === 'r' && L.danColor('sx', 0) === 'sb' && L.danColor('sx', 3) === 'sr' && L.danColor('sb', 5) === 'sb');

        /* ズーム：だんの 9だん ぶんが 見える ところに はいる */
        const tall = { x0: 40, y0: 40, x1: 40 + 9 * 48, y1: 40 + 8 * 62 + 48 };
        const inset = { l: 8, r: 8, t: 8, b: 120 };
        const fv = L.fitView(tall, 1270, 460, inset, 0.3, 1);
        const top = tall.y0 * fv.z + fv.oy, bottom = tall.y1 * fv.z + fv.oy;
        t('9だん ぶんが がめんに はいる ように 小さく する', fv.z < 1 && top >= 8 - 1e-6 && bottom <= 460 - 120 + 1e-6, `z=${fv.z.toFixed(2)} ${top.toFixed(0)}〜${bottom.toFixed(0)}`);
        const fv2 = L.fitView({ x0: 0, y0: 0, x1: 100, y1: 100 }, 1270, 700, inset, 0.3, 1);
        t('はいる ときは 大きく しない（1ばい まで）', fv2.z === 1);

        /* よみこんだ データを たしかめる */
        const empty = { size: 48, blocks: [], loops: [], strokes: [], bg: null, loopColor: 0, dan: null, card: null };
        const junk = {
            size: 'x', blocks: [{ id: 'a', x: 1, y: 2, c: 'b' }, { id: 'b', x: 'NaN', y: 0, c: 'b' }, { id: 'c', x: 0, y: 0, c: 'zzz' }, null],
            loops: [{ id: 'l', pts: [[0, 0], [1, 0], [1, 1]], color: '#ff0000' }, { id: 'm', pts: 'no', color: '#fff' }],
            strokes: [{ id: 's', pts: [[0, 0]], color: 'red', w: 3 }],
            bg: { id: 'p1', x: 0, y: 0, s: 1, rot: 5, alpha: 1 }, card: { text: 'おだい' },
        };
        const sn = L.sanitizeState(junk, empty);
        t('おかしな データは すてる（ブロック・かこみ・線・はいけい）',
            sn && sn.size === 48 && sn.blocks.length === 1 && sn.loops.length === 1 && sn.strokes.length === 0 && sn.bg === null && sn.card.text === 'おだい',
            sn && `b${sn.blocks.length} l${sn.loops.length} s${sn.strokes.length}`);
        t('ページで ない ものは null', L.sanitizeState(null, empty) === null && L.sanitizeState({ blocks: 3 }, empty) === null);

        return rows;
    }

    root.runTests = runTests;
    if (typeof module !== 'undefined' && require.main === module) {
        const r = runTests();
        for (const x of r) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.detail ? '  (' + x.detail + ')' : ''));
        const ng = r.filter(x => !x.ok).length;
        console.log(ng ? `${ng}こ まちがい / ${r.length}` : `ぜんぶ OK (${r.length})`);
        process.exit(ng ? 1 : 0);
    }
})(typeof window !== 'undefined' ? window : globalThis);
