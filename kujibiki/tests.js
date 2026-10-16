/* くじびき ひろば ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面や 音を つかわない ところ（logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.KujiLogic && typeof require === 'function') require('./logic.js');
    const L = root.KujiLogic;

    /** 毎回 おなじ ならびの 乱数（たしかめを くりかえせる ように） */
    function seeded(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* リスト */
        t('1行 1こ・空の 行と 前後の 空白（全角も）を すてる',
            L.parseList('  たろう \n\n　はなこ　\r\n3ばん\n   ').join('|') === 'たろう|はなこ|3ばん');
        t('番号 1〜5', L.numberList(1, 5).join() === '1,2,3,4,5');
        t('番号 10〜1（ぎゃく）', L.numberList(10, 1).join() === '10,9,8,7,6,5,4,3,2,1');
        t('番号の 上限', L.numberList(1, 99999, 1, 300).length === 300);
        t('番号が 数で ない ときは 空', L.numberList('a', 3).length === 0);

        /* ならべかえ */
        const base = [...Array(30).keys()];
        const sh = L.shuffle(base, seeded(1));
        t('まぜても 中身は おなじ', sh.slice().sort((a, b) => a - b).join() === base.join());
        t('もとの 配列は かわらない', base[0] === 0 && base[29] === 29);
        {
            // どの 場所にも かたよらず 出るか（10000回・ゆるい はんい）
            const r = seeded(7), cnt = [0, 0, 0, 0];
            for (let i = 0; i < 10000; i++) cnt[L.shuffle([0, 1, 2, 3], r)[0]]++;
            t('まぜかたに かたよりが ない（先頭に 来る 回数 2500±250）', cnt.every(c => Math.abs(c - 2500) < 250), cnt.join());
        }
        {
            const r = seeded(3), cnt = [0, 0, 0, 0, 0];
            for (let i = 0; i < 20000; i++) cnt[L.pickIndex(5, r)]++;
            t('pickIndex は どれも おなじ くらい（4000±300）', cnt.every(c => Math.abs(c - 4000) < 300), cnt.join());
            t('pickIndex(0) は −1', L.pickIndex(0) === -1);
            t('pickIndex は rnd が 1 に ちかくても はみ出さない', L.pickIndex(5, () => 0.9999999999) === 4);
        }

        /* ルーレット */
        {
            let ok = true, detail = '';
            const r = seeded(11);
            for (let k = 0; k < 2000; k++) {
                const n = 2 + Math.floor(r() * 60);
                const idx = Math.floor(r() * n);
                const frac = L.rouletteStopFrac(r);
                const r0 = (r() - 0.5) * 40;
                const fin = L.rouletteFinal(r0, n, idx, frac, 5);
                if (L.rouletteIndexAt(fin, n) !== idx || fin < r0 + 5 * L.TAU - 1e-9 || fin > r0 + 6 * L.TAU + 1e-9) {
                    ok = false; detail = `n=${n} idx=${idx} frac=${frac} r0=${r0} fin=${fin}`; break;
                }
            }
            t('ルーレットは きめた 項目で とまる・5〜6周 まわる（2000回）', ok, detail);
            t('回転 0 で はりの 下は 項目 0', L.rouletteIndexAt(0, 8) === 0);
            t('少し 左に まわすと（−）項目 0 の まま、右に まわすと（＋）さいごの 項目',
                L.rouletteIndexAt(-0.1, 8) === 0 && L.rouletteIndexAt(0.1, 8) === 7);
            const r2 = seeded(5);
            let edge = 0;
            for (let i = 0; i < 5000; i++) { const f = L.rouletteStopFrac(r2); if (f < 0.1) edge++; if (f <= 0 || f >= 1) edge = -1e9; }
            t('「ギリギリ」は 3わり くらい・項目の 線の 上では とまらない', edge > 1300 && edge < 1700, String(edge));
        }

        /* あみだ */
        {
            let ok = true, detail = '';
            for (let s = 1; s <= 300; s++) {
                const r = seeded(s);
                const n = 2 + (s % 14);
                const rungs = L.amidaMakeRungs(n, r);
                const m = L.amidaMapping(n, rungs);
                if (new Set(m).size !== n) { ok = false; detail = `seed ${s}: ${m.join()}`; break; }
                for (let g = 0; g < n - 1; g++) if (rungs.filter(x => x.g === g).length < 2) { ok = false; detail = `seed ${s} gap ${g}`; }
                for (let i = 0; i < rungs.length; i++) for (let j = i + 1; j < rungs.length; j++) {
                    const a = rungs[i], b = rungs[j];
                    if (Math.abs(a.g - b.g) <= 1 && Math.abs(a.y - b.y) < L.AMIDA_MIN_GAP - 1e-9) { ok = false; detail = `seed ${s}: ちかすぎる よこ線`; }
                }
                if (rungs.some(x => x.y <= 0 || x.y >= 1 || x.g < 0 || x.g > n - 2)) { ok = false; detail = `seed ${s}: はみ出し`; }
                if (!ok) break;
            }
            t('あみだは かならず 1人 1つの ゴール・よこ線は どの すきまにも 2本 いじょう・ちかすぎない（300とおり）', ok, detail);
        }
        {
            // 手で つくった あみだ：0-1 を 0.3、1-2 を 0.6
            const rungs = [{ g: 0, y: 0.3 }, { g: 1, y: 0.6 }];
            const a = L.amidaTrace(3, rungs, 0);
            t('たどりかた：0 → 1 → 2', a.end === 2 && a.points.map(p => p.c + '@' + p.y).join(' ') === '0@0 0@0.3 1@0.3 1@0.6 2@0.6 2@1');
            t('たどりかた：2 → 1、1 → 0', L.amidaTrace(3, rungs, 2).end === 1 && L.amidaTrace(3, rungs, 1).end === 0);
            t('よこ線が ない ときは まっすぐ', L.amidaTrace(4, [], 3).end === 3);
            t('ちかい よこ線は「ぶつかる」', L.amidaConflict(rungs, 1, 0.32) && !L.amidaConflict(rungs, 1, 0.45) && !L.amidaConflict([{ g: 0, y: 0.3 }], 2, 0.3));
        }
        t('下の ことばを 人数に そろえる', L.amidaFitResults(['あたり'], 3).join() === 'あたり,はずれ,はずれ'
            && L.amidaFitResults(['a', 'b', 'c'], 2).join() === 'a,b');
        {
            const a = L.amidaAtariList(8, 3, 'あたり', 'はずれ', seeded(2));
            t('あたり 3こ・はずれ 5こ', a.length === 8 && a.filter(x => x === 'あたり').length === 3);
            t('あたりの 数は 人数を こえない', L.amidaAtariList(3, 9).filter(x => x === 'あたり').length === 3);
        }

        /* ビンゴ */
        t('ビンゴの 文字 B・I・N・G・O', ['1', '15', '16', '31', '46', '75'].map(L.bingoLetter).join('') === 'BBINGO');
        t('76・0・ことば は 文字なし', L.bingoLetter('76') + L.bingoLetter('0') + L.bingoLetter('たろう') === '');
        {
            let rest = L.numberList(1, 75), got = [];
            const r = seeded(9);
            while (rest.length) { const d = L.drawOne(rest, r); got.push(d.ball); rest = d.rest; }
            t('ビンゴの 玉は 75こ ぜんぶ 1回ずつ 出る', got.length === 75 && new Set(got).size === 75);
            t('玉が ない ときは null', L.drawOne([], r).ball === null);
        }

        /* おみくじ・ガチャ */
        {
            let stock = [{ label: 'あたり', n: 3, lv: 'win' }, { label: 'はずれ', n: 7, lv: 'lose' }];
            const r = seeded(4), got = [];
            for (let i = 0; i < 12; i++) { const d = L.drawFromStock(stock, r); got.push(d.index); stock = d.stock; }
            t('本数を きめた くじ：あたり 3本・はずれ 7本 で ちょうど なくなる',
                got.slice(0, 10).filter(x => x === 0).length === 3 && got.slice(0, 10).filter(x => x === 1).length === 7
                && got[10] === -1 && got[11] === -1, got.join());
            t('のこりの 本数', L.stockTotal(stock) === 0);
        }
        {
            const items = [{ n: 1 }, { n: 3 }];
            const r = seeded(12), cnt = [0, 0];
            for (let i = 0; i < 20000; i++) cnt[L.weightedPick(items, r)]++;
            t('かぎりなし：1 : 3 の わりあいで 出る（5000±300）', Math.abs(cnt[0] - 5000) < 300, cnt.join());
            t('わりあいの ％', L.percents([{ n: 1 }, { n: 3 }]).join() === '25,75' && L.percents([{ n: 0 }]).join() === '0');
            t('0本 の ものは 出ない', L.weightedPick([{ n: 0 }, { n: 2 }], () => 0) === 1);
            t('ぜんぶ 0 の ときは −1', L.weightedPick([{ n: 0 }], Math.random) === -1);
        }

        /* チームわけ・席がえ */
        {
            const names = L.numberList(1, 31);
            const teams = L.splitTeams(names, 4, seeded(6));
            const sizes = teams.map(x => x.length);
            t('31人を 4チーム：8・8・8・7', sizes.join() === '8,8,8,7', sizes.join());
            t('チームわけで だれも きえない・ふえない', teams.flat().sort().join() === names.slice().sort().join());
            t('4人 まで の はん：30人 → 8はん、8人 → 2はん', L.teamCountBySize(30, 4) === 8 && L.teamCountBySize(8, 4) === 2);
        }
        {
            const res = L.assignSeats(['a', 'b', 'c'], [0, 2, 5, 7], seeded(8));
            const used = Object.keys(res.map).map(Number);
            t('席がえ：つかえる 席に だけ すわる', used.length === 3 && used.every(s => [0, 2, 5, 7].includes(s)) && res.over.length === 0);
            const res2 = L.assignSeats(['a', 'b', 'c'], [1, 2], seeded(8));
            t('席が たりない ときは あまった 人を over に', Object.keys(res2.map).length === 2 && res2.over.length === 1);
        }
        /* 演出の つよさ */
        t('ことばから 演出：大あたり・1等・大吉 → super',
            ['大あたり', '1等', '大吉', 'だいあたり！'].every(x => L.levelOfLabel(x) === 'super'));
        t('ことばから 演出：はずれ・凶・ざんねん → lose',
            ['はずれ', 'ハズレ', '凶', 'ざんねん'].every(x => L.levelOfLabel(x) === 'lose'));
        t('ことばから 演出：あたり・中吉 → win、ほか は きめた もの',
            L.levelOfLabel('あたり') === 'win' && L.levelOfLabel('中吉') === 'win'
            && L.levelOfLabel('たろう', 'normal') === 'normal' && L.levelOfLabel('7') === 'win');
        return rows;
    }

    root.runKujiTests = runTests;

    if (typeof module !== 'undefined' && require.main === module) {
        const r = runTests();
        let ng = 0;
        for (const x of r) {
            if (!x.ok) ng++;
            console.log((x.ok ? 'OK  ' : 'NG  ') + x.name + (x.ok || !x.detail ? '' : '  … ' + x.detail));
        }
        console.log(ng ? `\n${ng}こ まちがい（ぜんぶで ${r.length}こ）` : `\nぜんぶ OK（${r.length}こ）`);
        process.exit(ng ? 1 : 0);
    }
})(typeof window !== 'undefined' ? window : globalThis);
