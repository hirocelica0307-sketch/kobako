/* 九九ラン ── 画面を つかわない きまり
   コース・出題（まちがえた 九九の くりかえし・にがての 重みづけ）・こたえの パネル・ほめことば・
   はやさ・きろくの 計算だけを ここに まとめます。
   tests.js が この ファイルだけを 読みこんで たしかめます（ブラウザでも node でも うごく）。 */
(function (root) {
    'use strict';

    /* ---------- コース（12しゅるい） ---------- */
    const COURSES = [
        { id: 'dan1', name: '1のだん', dans: [1] },
        { id: 'dan2', name: '2のだん', dans: [2] },
        { id: 'dan3', name: '3のだん', dans: [3] },
        { id: 'dan4', name: '4のだん', dans: [4] },
        { id: 'dan5', name: '5のだん', dans: [5] },
        { id: 'dan6', name: '6のだん', dans: [6] },
        { id: 'dan7', name: '7のだん', dans: [7] },
        { id: 'dan8', name: '8のだん', dans: [8] },
        { id: 'dan9', name: '9のだん', dans: [9] },
        { id: 'zenhan', name: '2〜5のだん', dans: [2, 3, 4, 5] },
        { id: 'kouhan', name: '6〜9のだん', dans: [6, 7, 8, 9] },
        { id: 'zenbu', name: 'ぜんぶ', sub: '1〜9のだん', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];

    /* あそびかた */
    const MODES = ['renzoku', 'time'];
    const TIME_LIMIT = 60;          /* タイムアタックの びょう数 */
    const MISS_OPTIONS = [1, 3, 5]; /* ゆるせる ミス */
    const PANEL_OPTIONS = [2, 3];   /* パネルの まい数（＝ レーンの 数） */

    /* はやさ（km/h）。start＝スタートと まちがえた あと・step＝正解 1つで ふえる 分・max＝さいこう */
    const SPEEDS = {
        yukkuri: { start: 70, step: 6, max: 190 },
        futsuu: { start: 95, step: 9, max: 320 },
        hayai: { start: 120, step: 13, max: 460 },
    };

    /* まちがえた 九九を もういちど 出す まで（出題の 回数）。
       ゲートは 3つ さきまで 問題が きまっているので、じっさいは「3もん あと」と「さらに 6もん あと」くらい */
    const REVIEW_GAPS = [1, 3];
    const REVIEW_CLEAR = 2;         /* 何回 つづけて 正解したら おさらい おわり */

    function courseById(id) {
        return COURSES.find(c => c.id === id) || null;
    }

    const keyOf = q => q.a + 'x' + q.b;

    function parseKey(k) {
        const m = /^([1-9])x([1-9])$/.exec(String(k));
        return m ? { a: Number(m[1]), b: Number(m[2]) } : null;
    }

    /** コースの 問題 ぜんぶ（[{a, b}]） */
    function problemsOf(course) {
        const out = [];
        for (const a of course.dans) for (let b = 1; b <= 9; b++) out.push({ a, b });
        return out;
    }

    /** 直前の 何問と ちがう 問題に するか（段の コースは 3問・ほかは 6問） */
    function avoidCount(n) {
        return n <= 9 ? 3 : 6;
    }

    /* ---------- にがての 強さ ----------
       まちがい 1回で 2・正解 1回で 1 へる。0〜6。
       まちがえても、あとで 何回も 正解すれば 0 に もどる */
    function weakScore(s) {
        if (!s) return 0;
        const v = (Number(s.ng) || 0) * 2 - (Number(s.ok) || 0);
        return Math.max(0, Math.min(6, v));
    }

    /** にがてな 九九（つよい じゅん。おなじ ときは まちがい 回数・段・かける数の じゅん） */
    function weakList(stats, n) {
        return Object.keys(stats || {})
            .map(k => {
                const p = parseKey(k);
                return p ? { key: k, a: p.a, b: p.b, score: weakScore(stats[k]), ng: Number(stats[k].ng) || 0 } : null;
            })
            .filter(x => x && x.score > 0)
            .sort((p, q) => q.score - p.score || q.ng - p.ng || p.a - q.a || p.b - q.b)
            .slice(0, n == null ? 9 : n);
    }

    /* 重みつきで 1つ えらぶ */
    function weightedPick(list, weightOf, rand) {
        let total = 0;
        for (const x of list) total += weightOf(x);
        let r = rand() * total;
        for (const x of list) {
            r -= weightOf(x);
            if (r < 0) return x;
        }
        return list[list.length - 1];
    }

    /* ---------- 出題の 山（デッキ） ----------
       opts.problems：出す 問題（[{a, b}]）
       opts.stats：これまでの きろく（{ '7x8': { ok, ng } }）。にがてほど よく 出る
       opts.required：「にがて れんしゅう」で かならず クリアする 問題（[{a, b}]）。ない ときは おわりの ない コース
       opts.rand：乱数（たしかめ用）

       まちがえた 九九は「おさらい」に なって、すこし あとに もういちど 出る。
       REVIEW_CLEAR 回 つづけて 正解すると おさらい おわり。とちゅうで まちがえたら やりなおし。 */
    function createDeck(opts) {
        const rand = opts.rand || Math.random;
        const problems = (opts.problems || []).map(p => ({ a: p.a, b: p.b }));
        const stats = opts.stats || {};
        const required = opts.required ? opts.required.map(p => ({ a: p.a, b: p.b })) : null;
        const avoidN = Math.min(avoidCount(problems.length), Math.max(0, problems.length - 2));

        let idx = 0;                 /* 何問 出したか */
        const recent = [];           /* 出した 問題の キー（ふるい じゅん） */
        const reviews = [];          /* { a, b, stage, due } */
        const inflight = {};         /* 出したけれど まだ こたえて いない（キー → 数） */
        const okRow = {};            /* この あそびで つづけて 正解した 回数 */

        const isIn = k => (inflight[k] || 0) > 0;
        const reviewOf = k => reviews.find(r => keyOf(r) === k) || null;

        function make(p, review) {
            const k = keyOf(p);
            inflight[k] = (inflight[k] || 0) + 1;
            recent.push(k);
            if (recent.length > 12) recent.shift();
            return { a: p.a, b: p.b, ans: p.a * p.b, key: k, review: !!review };
        }

        function next() {
            idx++;
            /* 1. 時間が きた おさらい（いちばん まえから） */
            const due = reviews
                .filter(r => r.due <= idx && !isIn(keyOf(r)))
                .sort((p, q) => p.due - q.due)[0];
            if (due) {
                due.due = Infinity;   /* こたえが くるまで まつ */
                return make(due, true);
            }
            const last = recent.slice(-avoidN);
            const okFresh = p => {
                const k = keyOf(p);
                return !isIn(k) && !reviewOf(k) && last.indexOf(k) < 0;
            };
            /* 2. にがて れんしゅう：まだ クリアして いない 問題 */
            if (required) {
                const left = required.filter(p => (okRow[keyOf(p)] || 0) < REVIEW_CLEAR && okFresh(p));
                if (left.length) return make(left[Math.floor(rand() * left.length) % left.length], false);
            }
            /* 3. ふつうの 問題（にがてほど 出やすい） */
            let list = problems.filter(okFresh);
            if (!list.length) list = problems.filter(p => !isIn(keyOf(p)) && keyOf(p) !== recent[recent.length - 1]);
            if (!list.length) list = problems;
            if (!list.length) return null;
            const p = weightedPick(list, x => 1 + weakScore(stats[keyOf(x)]), rand);
            return make(p, false);
        }

        /** こたえの けっか。q は next() が かえした もの */
        function report(q, ok) {
            const k = keyOf(q);
            if (inflight[k] > 0) inflight[k]--;
            let r = reviewOf(k);
            if (ok) {
                okRow[k] = (okRow[k] || 0) + 1;
                if (r && q.review) {
                    r.stage++;
                    if (r.stage >= REVIEW_CLEAR) reviews.splice(reviews.indexOf(r), 1);
                    else r.due = idx + REVIEW_GAPS[Math.min(r.stage, REVIEW_GAPS.length - 1)];
                }
            } else {
                okRow[k] = 0;
                if (!r) {
                    r = { a: q.a, b: q.b, stage: 0, due: 0 };
                    reviews.push(r);
                }
                r.stage = 0;
                r.due = idx + REVIEW_GAPS[0];
            }
        }

        /** にがて れんしゅうが ぜんぶ おわったか（おわりの ない コースは いつも false） */
        function done() {
            if (!required) return false;
            return required.every(p => (okRow[keyOf(p)] || 0) >= REVIEW_CLEAR && !reviewOf(keyOf(p)));
        }

        /** にがて れんしゅうの のこり（まだ クリアして いない 問題の 数） */
        function left() {
            if (!required) return 0;
            return required.filter(p => (okRow[keyOf(p)] || 0) < REVIEW_CLEAR || reviewOf(keyOf(p))).length;
        }

        return {
            next, report, done, left,
            get count() { return idx; },
            get reviews() { return reviews.map(r => ({ a: r.a, b: r.b, stage: r.stage, due: r.due })); },
        };
    }

    /* ---------- こたえの パネル ----------
       まちがいの パネルは「ありがちな まちがい」から えらぶ：
       おなじ だんの となり（7×8 → 49・63）＞ となりの だん（6×8・8×8）＞
       数字の いれかえ（56 → 65）＞ 1・2・10 ちがい */
    function choicesFor(a, b, n, rand) {
        rand = rand || Math.random;
        const ans = a * b;
        const cand = new Map();
        const add = (v, w) => {
            if (!(v > 0 && v <= 99) || v === ans) return;
            cand.set(v, Math.max(cand.get(v) || 0, w));
        };
        if (b < 9) add(a * (b + 1), 6);
        if (b > 1) add(a * (b - 1), 6);
        if (a < 9) add((a + 1) * b, 3);
        if (a > 1) add((a - 1) * b, 3);
        if (ans >= 10 && ans % 10 !== 0) add((ans % 10) * 10 + Math.floor(ans / 10), 3);
        add(ans + 1, 2); add(ans - 1, 2);
        add(ans + 2, 1); add(ans - 2, 1);
        if (ans >= 10) { add(ans + 10, 1); add(ans - 10, 1); }

        let pool = Array.from(cand.entries()).map(([v, w]) => ({ v, w }));
        const wrong = [];
        while (wrong.length < n - 1 && pool.length) {
            const x = weightedPick(pool, y => y.w, rand);
            wrong.push(x.v);
            pool = pool.filter(y => y !== x);
        }
        const correct = Math.floor(rand() * n) % n;
        const answers = wrong.slice();
        answers.splice(correct, 0, ans);
        return { answers, correct };
    }

    /* ---------- ほめことば・節目 ---------- */
    function praiseOf(combo) {
        if (combo >= 30) return 'でんせつ！！';
        if (combo >= 20) return 'ちょうはやい！';
        if (combo >= 10) return 'すごい！';
        if (combo >= 5) return 'いいね！';
        return 'せいかい！';
    }

    /** 画面が ひかる 節目（5れんぞく ごと） */
    function isFlash(combo) {
        return combo > 0 && combo % 5 === 0;
    }

    /* ---------- はやさ ---------- */
    function speedOf(name) {
        return SPEEDS[name] || SPEEDS.futsuu;
    }

    /** 正解 → すこし はやく（さいこうで とまる） */
    function speedUp(kmh, cfg) {
        return Math.min(cfg.max, kmh + cfg.step);
    }

    /* ---------- きろく ---------- */
    const bestKey = (courseId, mode) => courseId + '_' + mode;

    /** 保存されていた せっていを たしかめる（こわれて いたら 初期値） */
    function sanitizeSettings(o) {
        o = o && typeof o === 'object' ? o : {};
        return {
            course: courseById(o.course) ? o.course : 'dan2',
            mode: MODES.includes(o.mode) ? o.mode : 'renzoku',
            miss: MISS_OPTIONS.includes(Number(o.miss)) ? Number(o.miss) : 3,
            panels: PANEL_OPTIONS.includes(Number(o.panels)) ? Number(o.panels) : 2,
            speed: SPEEDS[o.speed] ? o.speed : 'futsuu',
            voice: o.voice !== false,
            sound: o.sound !== false,
            lite: o.lite === true,
        };
    }

    /** 九九ごとの きろく（{ '7x8': { ok, ng } }）の こわれた ところを すてる */
    function sanitizeStats(o) {
        const out = {};
        if (!o || typeof o !== 'object') return out;
        for (const k of Object.keys(o)) {
            if (!parseKey(k) || !o[k] || typeof o[k] !== 'object') continue;
            const ok = Math.floor(Number(o[k].ok)), ng = Math.floor(Number(o[k].ng));
            const s = { ok: isFinite(ok) && ok > 0 ? ok : 0, ng: isFinite(ng) && ng > 0 ? ng : 0 };
            if (s.ok || s.ng) out[k] = s;
        }
        return out;
    }

    /** ベスト（{ キー: 数 }）の こわれた ところを すてる */
    function sanitizeBest(o) {
        const out = {};
        if (!o || typeof o !== 'object') return out;
        for (const k of Object.keys(o)) {
            const v = Math.floor(Number(o[k]));
            if (isFinite(v) && v > 0) out[k] = v;
        }
        return out;
    }

    /* ---------- 九九の となえかた ---------- */
    const KUKU = [
        null,
        ['いんいちが いち', 'いんにが に', 'いんさんが さん', 'いんしが し', 'いんごが ご', 'いんろくが ろく', 'いんしちが しち', 'いんはちが はち', 'いんくが く'],
        ['にいちが に', 'ににんが し', 'にさんが ろく', 'にしが はち', 'にご じゅう', 'にろく じゅうに', 'にしち じゅうし', 'にはち じゅうろく', 'にく じゅうはち'],
        ['さんいちが さん', 'さんにが ろく', 'さざんが く', 'さんし じゅうに', 'さんご じゅうご', 'さぶろく じゅうはち', 'さんしち にじゅういち', 'さんぱ にじゅうし', 'さんく にじゅうしち'],
        ['しいちが し', 'しにが はち', 'しさん じゅうに', 'しし じゅうろく', 'しご にじゅう', 'しろく にじゅうし', 'ししち にじゅうはち', 'しは さんじゅうに', 'しく さんじゅうろく'],
        ['ごいちが ご', 'ごに じゅう', 'ごさん じゅうご', 'ごし にじゅう', 'ごご にじゅうご', 'ごろく さんじゅう', 'ごしち さんじゅうご', 'ごは しじゅう', 'ごっく しじゅうご'],
        ['ろくいちが ろく', 'ろくに じゅうに', 'ろくさん じゅうはち', 'ろくし にじゅうし', 'ろくご さんじゅう', 'ろくろく さんじゅうろく', 'ろくしち しじゅうに', 'ろくは しじゅうはち', 'ろっく ごじゅうし'],
        ['しちいちが しち', 'しちに じゅうし', 'しちさん にじゅういち', 'しちし にじゅうはち', 'しちご さんじゅうご', 'しちろく しじゅうに', 'しちしち しじゅうく', 'しちは ごじゅうろく', 'しちく ろくじゅうさん'],
        ['はちいちが はち', 'はちに じゅうろく', 'はちさん にじゅうし', 'はちし さんじゅうに', 'はちご しじゅう', 'はちろく しじゅうはち', 'はちしち ごじゅうろく', 'はっぱ ろくじゅうし', 'はっく しちじゅうに'],
        ['くいちが く', 'くに じゅうはち', 'くさん にじゅうしち', 'くし さんじゅうろく', 'くご しじゅうご', 'くろく ごじゅうし', 'くしち ろくじゅうさん', 'くは しちじゅうに', 'くく はちじゅういち'],
    ];

    function kukuReading(a, b) {
        return (KUKU[a] && KUKU[a][b - 1]) || '';
    }

    /** となえかたの 前半（問題の ところ。「しちし にじゅうはち」→「しちし」・「ににんが し」→「ににん」） */
    function kukuQuestionPart(a, b) {
        const s = kukuReading(a, b);
        const i = s.lastIndexOf(' ');
        const head = i < 0 ? s : s.slice(0, i);
        return head.replace(/が$/, '');
    }

    root.KukuRunLogic = {
        COURSES, MODES, TIME_LIMIT, MISS_OPTIONS, PANEL_OPTIONS, SPEEDS, REVIEW_GAPS, REVIEW_CLEAR,
        courseById, keyOf, parseKey, problemsOf, avoidCount, weakScore, weakList, createDeck,
        choicesFor, praiseOf, isFlash, speedOf, speedUp, bestKey,
        sanitizeSettings, sanitizeStats, sanitizeBest, kukuReading, kukuQuestionPart,
    };
})(typeof window !== 'undefined' ? window : globalThis);
