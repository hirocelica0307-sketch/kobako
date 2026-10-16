/* くじびき ひろば ── きまり（画面や 音を つかわない ところ）
   どの くじも「だれが・なにが 当たるか」は ここの 関数で きめます。
   演出（回る・光る・燃える）は その けっかに むかって うごく だけ です。
   node tests.js でも、tests.html を ブラウザで ひらいても しらべられます。 */
(function (root) {
    'use strict';

    /* ---------- 乱数・ならべかえ ---------- */

    /** 0 以上 n 未満の 整数を 1つ（どれも おなじ 確率） */
    function pickIndex(n, rnd) {
        rnd = rnd || Math.random;
        if (!(n > 0)) return -1;
        return Math.min(n - 1, Math.floor(rnd() * n));
    }

    /** あたらしい 配列に して まぜる（フィッシャー–イェーツ） */
    function shuffle(arr, rnd) {
        rnd = rnd || Math.random;
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.floor(rnd() * (i + 1)));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /** min〜max（びょう など）の あいだの 数を 1つ */
    function randomBetween(min, max, rnd) {
        rnd = rnd || Math.random;
        if (max < min) { const t = min; min = max; max = t; }
        return min + (max - min) * rnd();
    }

    /* ---------- 中身の リスト ---------- */

    /** 1行 1こ。前後の 空白を とり、空の 行は すてる */
    function parseList(text) {
        return String(text == null ? '' : text)
            .split(/\r?\n/)
            .map(s => s.replace(/^[\s　]+|[\s　]+$/g, ''))
            .filter(s => s.length > 0);
    }

    /** from〜to の 番号（step とび）。多すぎる ときは max こ まで */
    function numberList(from, to, step, max) {
        from = Math.round(Number(from)); to = Math.round(Number(to));
        step = Math.max(1, Math.round(Number(step) || 1));
        max = max || 1000;
        if (!isFinite(from) || !isFinite(to)) return [];
        const out = [];
        if (from <= to) for (let v = from; v <= to && out.length < max; v += step) out.push(String(v));
        else for (let v = from; v >= to && out.length < max; v -= step) out.push(String(v));
        return out;
    }

    /** n の 範囲に おさめる */
    function clamp(v, lo, hi) {
        v = Number(v);
        if (!isFinite(v)) v = lo;
        return Math.max(lo, Math.min(hi, v));
    }

    /* ---------- ルーレット ----------
       ばんの 回転 r（ラジアン・時計まわりが ＋）。項目 i は ばんの 上で
       「12時から 時計まわりに i*s 〜 (i+1)*s」（s = 2π/n）。はりは 12時に ある。
       はりの 下に くるのは ばんの 角度 a = (−r) mod 2π の ところ。 */
    const TAU = Math.PI * 2;
    const mod = (a, m) => ((a % m) + m) % m;

    /** 回転 r の とき はりの 下に ある 項目の 番号 */
    function rouletteIndexAt(r, n) {
        if (n <= 0) return -1;
        const s = TAU / n;
        return Math.min(n - 1, Math.floor(mod(-r, TAU) / s));
    }

    /** いまの 回転 r0 から、項目 idx の 中の frac（0〜1）の ところで とまる 回転 r（r ≥ r0 + minTurns 周） */
    function rouletteFinal(r0, n, idx, frac, minTurns) {
        const s = TAU / n;
        const a = (idx + clamp(frac, 0, 1)) * s;
        const base = r0 + (minTurns || 0) * TAU;
        let r = -a;
        r = r + Math.ceil((base - r) / TAU) * TAU;
        return r;
    }

    /** どこで とまるか（項目の 中の いち）。ときどき「ギリギリ 入った」に する */
    function rouletteStopFrac(rnd) {
        rnd = rnd || Math.random;
        const k = rnd();
        if (k < 0.3) return 0.02 + rnd() * 0.06;      // さいごに やっと 入る（はりが 線の すぐ そば）
        return 0.15 + rnd() * 0.7;
    }

    /* ---------- あみだくじ ----------
       たての 線は 0〜n−1。よこ線は {g, y}：g 番目と g+1 番目を、たかさ y（0〜1）で つなぐ。
       おなじ たての 線に つく よこ線どうしは minGap より ちかく しない。 */
    const AMIDA_MIN_GAP = 0.045;
    const AMIDA_TOP = 0.04, AMIDA_BOTTOM = 0.96;

    function amidaConflict(rungs, g, y, minGap) {
        minGap = minGap || AMIDA_MIN_GAP;
        return rungs.some(r => Math.abs(r.g - g) <= 1 && Math.abs(r.y - y) < minGap);
    }

    /** よこ線を つくる。n 本の たて線、どの すきまにも 2本 いじょう */
    function amidaMakeRungs(n, rnd, opts) {
        rnd = rnd || Math.random;
        opts = opts || {};
        const rungs = [];
        if (n < 2) return rungs;
        const levels = opts.levels || Math.max(10, Math.min(22, 8 + n));
        const p = opts.density == null ? 0.42 : opts.density;
        const span = AMIDA_BOTTOM - AMIDA_TOP;
        for (let L = 0; L < levels; L++) {
            const gaps = shuffle([...Array(n - 1).keys()], rnd);
            for (const g of gaps) {
                if (rnd() > p) continue;
                const y = AMIDA_TOP + span * ((L + 0.5) / levels) + (rnd() - 0.5) * span / levels * 0.5;
                if (!amidaConflict(rungs, g, y)) rungs.push({ g, y: round4(y) });
            }
        }
        // すくない すきまに たす
        for (let g = 0; g < n - 1; g++) {
            let need = 2 - rungs.filter(r => r.g === g).length;
            let tries = 0;
            while (need > 0 && tries++ < 200) {
                const y = AMIDA_TOP + span * (0.05 + 0.9 * rnd());
                if (!amidaConflict(rungs, g, y)) { rungs.push({ g, y: round4(y) }); need--; }
            }
        }
        rungs.sort((a, b) => a.y - b.y || a.g - b.g);
        return rungs;
    }
    function round4(v) { return Math.round(v * 10000) / 10000; }

    /** たて線 start から たどる。points は {c: たて線の 番号（小数も）, y} の 折れ線 */
    function amidaTrace(n, rungs, start) {
        const pts = [{ c: start, y: 0 }];
        let c = start, y = 0;
        const sorted = rungs.slice().sort((a, b) => a.y - b.y);
        for (;;) {
            let next = null;
            for (const r of sorted) {
                if (r.y <= y + 1e-9) continue;
                if (r.g === c || r.g === c - 1) { next = r; break; }
            }
            if (!next) break;
            const to = next.g === c ? c + 1 : c - 1;
            pts.push({ c, y: next.y });
            pts.push({ c: to, y: next.y });
            c = to; y = next.y;
        }
        pts.push({ c, y: 1 });
        return { end: c, points: pts };
    }

    /** ぜんいんの ゆきさき（start → end） */
    function amidaMapping(n, rungs) {
        const m = [];
        for (let i = 0; i < n; i++) m.push(amidaTrace(n, rungs, i).end);
        return m;
    }

    /** 下の ことばを n こに そろえる。たりない ぶんは fill で うめる */
    function amidaFitResults(results, n, fill) {
        const out = results.slice(0, n);
        while (out.length < n) out.push(fill == null ? 'はずれ' : fill);
        return out;
    }

    /** 「あたり」を k こ、のこりを はずれ に した 下の ことば（ならびは まぜる） */
    function amidaAtariList(n, k, atari, hazure, rnd) {
        k = clamp(Math.round(k), 0, n);
        const a = [];
        for (let i = 0; i < n; i++) a.push(i < k ? (atari || 'あたり') : (hazure || 'はずれ'));
        return shuffle(a, rnd);
    }

    /* ---------- ビンゴ ---------- */

    /** 1〜75 の ふつうの ビンゴの 文字（それ いがいは ''） */
    function bingoLetter(v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 75) return '';
        return 'BINGO'[Math.floor((n - 1) / 15)];
    }

    /** のこりの 玉から 1こ ひく。{ball, rest} */
    function drawOne(rest, rnd) {
        if (!rest.length) return { ball: null, rest: [] };
        const i = pickIndex(rest.length, rnd);
        const r = rest.slice();
        const ball = r.splice(i, 1)[0];
        return { ball, rest: r };
    }

    /* ---------- おみくじ・ガチャ（しゅるいと 本数） ----------
       items = [{label, n, lv}]。lv は 演出の つよさ（'super' | 'win' | 'normal' | 'lose'）。
       本数を きめる ときは n が のこりの 本数、かぎりなし の ときは n が 出やすさ（わりあい）。 */
    function weightedPick(items, rnd) {
        rnd = rnd || Math.random;
        const total = items.reduce((s, it) => s + Math.max(0, Number(it.n) || 0), 0);
        if (total <= 0) return -1;
        let x = rnd() * total;
        for (let i = 0; i < items.length; i++) {
            const w = it_n(items[i]);
            if (x < w) return i;
            x -= w;
        }
        // 小数の まるめで はみ出した とき：さいごの 0 で ない もの
        for (let i = items.length - 1; i >= 0; i--) if (it_n(items[i]) > 0) return i;
        return -1;
    }
    function it_n(it) { return Math.max(0, Number(it.n) || 0); }

    /** 本数を きめた くじ：1本 ひいて へらす。{index, stock}（ない ときは index −1） */
    function drawFromStock(stock, rnd) {
        const i = weightedPick(stock, rnd);
        if (i < 0) return { index: -1, stock: stock.slice() };
        const s = stock.map((it, k) => k === i ? Object.assign({}, it, { n: it_n(it) - 1 }) : it);
        return { index: i, stock: s };
    }

    /** わりあい（％・小数 1けた） */
    function percents(items) {
        const total = items.reduce((s, it) => s + it_n(it), 0);
        return items.map(it => total ? Math.round(it_n(it) / total * 1000) / 10 : 0);
    }

    function stockTotal(items) { return items.reduce((s, it) => s + it_n(it), 0); }

    /* ---------- チームわけ・席がえ ---------- */

    /** k こに わける。人数の ちがいは 1人 いない。ならびは まぜる */
    function splitTeams(names, k, rnd) {
        k = Math.max(1, Math.round(k));
        const a = shuffle(names, rnd);
        const teams = [];
        for (let i = 0; i < k; i++) teams.push([]);
        a.forEach((nm, i) => teams[i % k].push(nm));
        return teams;
    }

    /** 1チーム size 人 まで で わける ときの チームの かず */
    function teamCountBySize(count, size) {
        size = Math.max(1, Math.round(size));
        return Math.max(1, Math.ceil(count / size));
    }

    /** 席がえ：つかえる 席（番号の 配列）に 名前を くばる。{seat番号: 名前}・入らない 人は over */
    function assignSeats(names, seats, rnd) {
        const a = shuffle(names, rnd);
        const s = shuffle(seats, rnd);
        const map = {};
        const n = Math.min(a.length, s.length);
        for (let i = 0; i < n; i++) map[s[i]] = a[i];
        return { map, over: a.slice(n) };
    }

    /* ---------- ことばから 演出の つよさを きめる ----------
       「大あたり」「1等」→ super、「はずれ」→ lose、それ いがいは ふつ（dflt）*/
    function levelOfLabel(label, dflt) {
        const s = String(label || '');
        if (/大当|大あた|だいあたり|大アタリ|1等|１等|一等|大吉|特賞|ＳＳＲ|SSR|レア/.test(s)) return 'super';
        if (/はずれ|ハズレ|外れ|ざんねん|残念|凶/.test(s)) return 'lose';
        if (/あたり|当たり|アタリ|当り|吉/.test(s)) return 'win';
        return dflt || 'win';
    }

    const api = {
        levelOfLabel,
        pickIndex, shuffle, randomBetween, parseList, numberList, clamp,
        TAU, rouletteIndexAt, rouletteFinal, rouletteStopFrac,
        AMIDA_MIN_GAP, AMIDA_TOP, AMIDA_BOTTOM, amidaConflict, amidaMakeRungs, amidaTrace, amidaMapping,
        amidaFitResults, amidaAtariList,
        bingoLetter, drawOne,
        weightedPick, drawFromStock, percents, stockTotal,
        splitTeams, teamCountBySize, assignSeats,
    };
    root.KujiLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
