/* きまりの たしかめ（ブラウザで tests.html を ひらくと 動きます。node tests.js でも 動きます）
   もんだいが とける こと・こたえが 1つに きまる こと・データの まちがいを しらべます。 */
(function (root) {
    'use strict';
    const G = root.PurintoGen || require('./gen.js');
    const D = root.PurintoData || require('./data.js');
    const S = root.PurintoSheets || require('./sheets.js');
    const K = root.PurintoSakubun || require('./sakubun.js');

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* さいころ */
        const a = G.makeRng(7), b = G.makeRng(7);
        t('おなじ たねなら おなじ ならび', [1, 2, 3].every(() => a.next() === b.next()));
        t('shuffle は なかみを かえない', G.makeRng(3).shuffle([1, 2, 3, 4, 5]).sort().join() === '1,2,3,4,5');

        /* もじの かぞえかた（ことばかいだん の きまり） */
        const cnt = w => G.moraSplit(w).length;
        t('らっこ ＝ 3もじ', cnt('らっこ') === 3);
        t('ティッシュ ＝ 3もじ', cnt('ティッシュ') === 3);
        t('パーティ ＝ 3もじ', cnt('パーティ') === 3);
        t('パーティー ＝ 4もじ', cnt('パーティー') === 4);
        t('きょうりゅう ＝ 4もじ', cnt('きょうりゅう') === 4, G.moraSplit('きょうりゅう').join('/'));
        t('カタカナ → ひらがな', G.toHira('ライオン') === 'らいおん');

        /* ものがたり めいろ */
        for (const s of D.STORIES) {
            const forks = s.parts.filter(p => typeof p !== 'string');
            t(`おはなし「${s.title}」: わかれみちの 1もじめが ちがう`, forks.every(f => G.chars(f.ok)[0] !== G.chars(f.ng)[0]));
            let total = 0;
            for (const p of s.parts) total += typeof p === 'string' ? G.chars(p).length : G.chars(p.ok).length + G.chars(p.ng).length;
            t(`おはなし「${s.title}」: 1まいに はいる ながさ（${total}マス）`, total <= 66);
            const [mw, mh] = G.mazeDims(total, 186 / 160);
            const m = G.storyMaze(s, mw, mh, G.makeRng(11)) || G.storyMaze(s, mw, mh + 1, G.makeRng(12));
            t(`おはなし「${s.title}」: めいろが できる`, !!m);
            if (!m) continue;
            const main = m.main;
            let adj = true;
            for (let i = 1; i < main.length; i++) if (Math.abs(main[i][0] - main[i - 1][0]) + Math.abs(main[i][1] - main[i - 1][1]) !== 1) adj = false;
            t(`おはなし「${s.title}」: みちは となりへ 1マスずつ`, adj);
            /* みちが となりどうし くっついて いないか（つながって いる マス いがい） */
            const allCells = [...m.cells.keys()].map(k => k.split(',').map(Number));
            const links = new Set();
            const link = (p, q) => links.add([p.join(','), q.join(',')].sort().join('|'));
            for (let i = 1; i < main.length; i++) link(main[i - 1], main[i]);
            m.branches.forEach(br => { link(main[br.at], br.cells[0]); for (let i = 1; i < br.cells.length; i++) link(br.cells[i - 1], br.cells[i]); });
            let touch = 0;
            for (const [x, y] of allCells) for (const [dx, dy] of [[1, 0], [0, 1]]) {
                const k2 = (x + dx) + ',' + (y + dy);
                if (m.cells.has(k2) && !links.has([x + ',' + y, k2].sort().join('|'))) touch++;
            }
            t(`おはなし「${s.title}」: べつの みちと くっつかない`, touch === 0, `${touch}か所`);
            t(`おはなし「${s.title}」: よむと ただしい ぶんに なる`, main.map(([x, y]) => m.cells.get(x + ',' + y).ch).join('') === m.text);
        }

        /* けいさん めいろ */
        for (const lv of ['add1', 'sub1', 'mix2', 'mul2', 'mix3']) {
            const e = S.CATALOG.find(c => c.id === 'calcmaze');
            const html = S.buildSheet(e, { level: lv }, 5).page;
            t(`けいさん めいろ（${lv}）が できる`, html.includes('class="cmaze"'));
        }
        const path = G.cornerPath(6, 8, 17, G.makeRng(9));
        t('けいさん めいろの みちは ゴールまで とどく', path && path[path.length - 1].join() === '5,7' && path.length >= 17);
        const L = { ops: ['+'], min: 0, max: 10, maxA: 20 };
        const r1 = G.makeRng(1);
        let exprOk = true;
        for (let i = 0; i < 50; i++) {
            const e = G.makeExpr(L, 10, r1), d = G.makeDecoy(L, 10, r1);
            if (!e || eval(e.text.replace('＋', '+')) !== 10) exprOk = false;
            if (!d || eval(d.text.replace('＋', '+')) === 10) exprOk = false;
        }
        t('しきの こたえが ただしい・まよわせる しきは ちがう こたえ', exprOk);

        /* ことば さがし */
        for (const th of D.WS_THEMES) {
            const words = th.words.slice(0, 8).map(w => ({ word: w }));
            const ws = G.wordSearch(words, 8, 8, 'mid', th.script === 'kata' ? D.KATA_FILL : D.HIRA_FILL, G.makeRng(3));
            t(`ことばさがし「${th.title}」: ぜんぶ 1かいずつ かくれて いる`, ws && ws.placed.every(p => G.countWord(ws.grid, p.word, G.WS_DIRS.mid) === 1));
        }
        t('まわぶん（トマト）も 1かいと かぞえる', G.countWord([['ト', 'マ', 'ト']], 'トマト', G.WS_DIRS.hard) === 1);

        /* まほうじん */
        t('ロ・シュの まほうじん', G.isMagic(G.LO_SHU));
        t('まわしても うらがえしても まほうじん（8とおり）', G.symmetries(G.LO_SHU).every(G.isMagic) && new Set(G.symmetries(G.LO_SHU).map(g => g.flat().join())).size === 8);
        let magicOk = true;
        for (let i = 0; i < 20; i++) {
            const q = G.magicSquare(6, i % 4, G.makeRng(i + 1));
            if (!q || G.magicSolutions(q.puzzle, q.holes, q.holes.map(([x, y]) => q.answer[y][x])) !== 1) magicOk = false;
        }
        t('あなあき まほうじんの こたえは 1つだけ', magicOk);

        /* ピラミッド */
        const pr = G.pyramidFrom([1, 2, 3]);
        t('ピラミッド 1・2・3 → 3・5 → 8', pr[1].join() === '3,5' && pr[2][0] === 8);
        let pyrOk = true;
        for (let i = 0; i < 20; i++) {
            const q = G.pyramid(5, 1, 9, 'hard', G.makeRng(i + 1));
            if (!G.pyramidSolvable(q.rows, q.known) || q.known.flat().every(Boolean)) pyrOk = false;
        }
        t('あなあき ピラミッドは けいさんで ぜんぶ うまる', pyrOk);

        /* ナンプレ */
        for (const n of [4, 6]) {
            let ok = true;
            for (let i = 0; i < 8; i++) {
                const q = G.sudoku(n, n === 4 ? 5 : 14, G.makeRng(i + 1));
                if (G.sudokuCount(q.puzzle, n) !== 1) ok = false;
                for (let y = 0; y < n; y++) {
                    if (new Set(q.answer[y]).size !== n) ok = false;
                    if (new Set(q.answer.map(r => r[y])).size !== n) ok = false;
                }
            }
            t(`ナンプレ ${n}×${n}: こたえが 1つ・たて よこ そろう`, ok);
        }

        /* きごう さがし */
        t('かぞえない きまり（🍌の すぐ みぎの 🍎）', G.countSymbols(['🍎', '🍌', '🍎', '🍎'], '🍎', '🍌') === 2);

        /* てん つなぎ */
        t('かがみ うつし', G.transformLines([[0, 0, 1, 0]], 4, 'mirror')[0].join() === '3,0,2,0');
        t('さかさま うつし', G.transformLines([[0, 0, 1, 0]], 4, 'rotate')[0].join() === '3,3,2,3');
        const fig = G.dotFigure(4, 7, true, G.makeRng(2));
        t('てんつなぎの せんは となりの てんどうし', fig.length === 7 && fig.every(([x1, y1, x2, y2]) => Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) === 1));

        /* まちがい さがし */
        const df = G.differences(5, 5, D.PIC_SETS.animals, 5, G.makeRng(4));
        let diffCount = 0;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (df.left[y][x] !== df.right[y][x]) diffCount++;
        t('まちがいは きめた かずだけ', diffCount === 5 && df.spots.length === 5);

        /* はんぶんの え */
        for (const p of D.HALF_PICS) {
            t(`はんぶんの え「${p.title}」: さゆう たいしょう`, G.isSymmetric(p.rows) && p.rows.every(r => r.length === p.rows[0].length));
            t(`はんぶんの え「${p.title}」: いろが きまって いる`, p.rows.join('').replace(/\./g, '').split('').every(c => D.HALF_COLORS[c]));
        }
        t('ランダムな かたちも さゆう たいしょう', G.isSymmetric(G.randomHalfPicture(10, 10, G.makeRng(5))));

        /* あたまの もじ */
        for (const w of D.HEAD_TARGETS) {
            const q = G.headQuiz(D.WORDS, w, G.makeRng(1));
            t(`あたまの もじ「${w}」: えが そろう`, q && q.map(d => G.toHira(d.word)[0]).join('') === w);
        }

        /* ならびかえ */
        let scrOk = true;
        for (const w of D.WORDS) {
            const ms = G.moraSplit(w.word);
            if (new Set(ms).size < 2) continue;
            const s = G.scramble(w.word, G.makeRng(ms.length));
            if (s.join('') === ms.join('') || s.slice().sort().join() !== ms.slice().sort().join()) scrOk = false;
        }
        t('ならびかえは もとの ことばと ちがう・もじは おなじ', scrOk);

        /* ビンゴ */
        for (const th of D.BINGO_THEMES) {
            t(`ビンゴ「${th.title}」: 4×4 が つくれる（${th.items.length}こ）`, th.items.length >= 16);
            t(`ビンゴ「${th.title}」: おなじ おだいが ない`, new Set(th.items.map(i => i[1])).size === th.items.length);
        }

        /* かんじ */
        t('かんじ たしざん: おなじ こたえが ない', new Set(D.KANJI_ADD.map(k => k.kanji)).size === D.KANJI_ADD.length);


        /* さくぶん（あのね にっき） */
        const allOdai = K.CATEGORIES.flatMap(c => c.items);
        t(`お題の ばんごうが かぶらない（${allOdai.length}こ）`, new Set(allOdai.map(o => o.id)).size === allOdai.length);
        t('お題が 200こ いじょう', allOdai.length >= 200, String(allOdai.length));
        const kanjiOut = [];
        const textsOf = [...allOdai.map(o => o.text), ...K.CATEGORIES.flatMap(c => [c.title, c.short, c.nerai, ...c.words]), ...K.RULES_OF_ODAI,
            ...Object.values(K.ORGANIZERS).flat(2), ...Object.values(K.WEB_PROMPTS).flat(), ...K.POINTS_LOW.list, ...K.POINTS_LOW.special, ...K.POINTS_LOW.stars,
            ...K.POINTS_MID.steps.flatMap(([h, l]) => [h, ...l]), ...K.POINTS_MID.special, ...K.POINTS_MID.stars];
        for (const x of textsOf) {
            const bare = x.replace(/\{[^|{}]+\|[^{}]+\}/g, '');
            if (/[\u4e00-\u9fff々]/.test(bare)) kanjiOut.push(x);
        }
        t('漢字には ぜんぶ ふりがなが ある', kanjiOut.length === 0, kanjiOut.slice(0, 3).join(' / '));
        t('なかまの かたちに あう 図と ふきだしが ある', K.CATEGORIES.every(c => K.ORGANIZERS[c.type] && K.WEB_PROMPTS[c.type]));
        const an = S.CATALOG.find(c => c.id === 'anone'), anm = S.CATALOG.find(c => c.id === 'anone-mid');
        let anOk = true;
        for (const o of allOdai) for (const e of [an, anm]) {
            const h = S.buildSheet(e, { odai: o.id }, 1).page;
            if (!h.includes('class="gk') || /undefined|NaN|\{[^}]*\|/.test(h) || !h.includes(o.id)) anOk = false;
        }
        t('どの お題でも あのね にっきが できる（1・2ねん・3・4ねん）', anOk);
        t('ふりがな なしでは <ruby> を つかわない', !S.buildSheet(anm, { odai: 'B1', furi: false }, 1).page.includes('<ruby>'));
        const ol = S.buildSheet(S.CATALOG.find(c => c.id === 'odailist'), {}, 1).page;
        t('お題 いちらんに ぜんぶの お題が のる', allOdai.every(o => ol.includes(`>${o.id}<`)));

        /* ぜんぶの プリント */
        for (const e of S.CATALOG) {
            let ok = true, err = '';
            try {
                for (let seed = 1; seed <= 3; seed++) {
                    const r = S.buildSheet(e, {}, seed);
                    if (!r.page || /undefined|NaN/.test(r.page) || (r.answer && /undefined|NaN/.test(r.answer))) ok = false;
                    if (!r.page.includes(`subj-${e.subject}`)) ok = false;
                }
            } catch (ex) { ok = false; err = String(ex); }
            t(`プリント「${e.title}」が できる`, ok, err);
        }
        t('メニューの id が かぶらない', new Set(S.CATALOG.map(c => c.id)).size === S.CATALOG.length);
        t('おなじ たね → おなじ プリント', S.buildSheet(S.CATALOG[1], {}, 99).page === S.buildSheet(S.CATALOG[1], {}, 99).page);
        t('じぶんで いれた もじは エスケープ', !S.buildSheet(S.CATALOG.find(c => c.id === 'acrostic'), { custom: '<b>' }, 1).page.includes('<b>」'));

        return rows;
    }

    root.runTests = runTests;
    if (typeof module !== 'undefined' && require.main === module) {
        const r = runTests();
        const ng = r.filter(x => !x.ok);
        for (const x of ng) console.log('NG', x.name, x.detail);
        console.log(ng.length ? `${ng.length}こ まちがい（ぜんぶで ${r.length}こ）` : `ぜんぶ OK（${r.length}こ）`);
        process.exitCode = ng.length ? 1 : 0;
    }
})(typeof window !== 'undefined' ? window : globalThis);
