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
