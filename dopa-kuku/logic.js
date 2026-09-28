/* ドパ九九 ── 画面を つかわない きまり
   コース・出題・はんてい・ドパレベル・きろくの 計算だけを ここに まとめます。
   tests.js が この ファイルだけを 読みこんで たしかめます（ブラウザでも node でも うごく）。 */
(function (root) {
    'use strict';

    /* ---------- コース（11しゅるい） ---------- */
    const COURSES = [
        { id: 'dan2', name: '2のだん', dans: [2] },
        { id: 'dan3', name: '3のだん', dans: [3] },
        { id: 'dan4', name: '4のだん', dans: [4] },
        { id: 'dan5', name: '5のだん', dans: [5] },
        { id: 'dan6', name: '6のだん', dans: [6] },
        { id: 'dan7', name: '7のだん', dans: [7] },
        { id: 'dan8', name: '8のだん', dans: [8] },
        { id: 'dan9', name: '9のだん', dans: [9] },
        { id: 'zenhan', name: 'ぜんはん', sub: '2〜5', dans: [2, 3, 4, 5] },
        { id: 'kouhan', name: 'こうはん', sub: '6〜9', dans: [6, 7, 8, 9] },
        { id: 'zenbu', name: 'ぜんぶ', sub: '1〜9', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];

    /* ドパレベルの しきい値（Lv0〜8） */
    const LEVELS = [0, 3, 6, 10, 15, 20, 30, 40, 50];
    const MAX_LEVEL = LEVELS.length - 1;

    /* せいげんじかん（びょう） */
    const LIMITS = [3, 5, 7];

    /* 虹ドパの ときだけ タイマーを とめる 時間（ミリびょう） */
    const NIJI_HOLD = 1500;

    function courseById(id) {
        return COURSES.find(c => c.id === id) || null;
    }

    /** コースの 問題 ぜんぶ（[{a, b}]） */
    function problemsOf(course) {
        const out = [];
        for (const a of course.dans) for (let b = 1; b <= 9; b++) out.push({ a, b });
        return out;
    }

    const keyOf = q => q.a + 'x' + q.b;

    /** 直前の 何問と ちがう 問題に するか（段の コースは 3問・ほかは 1問） */
    function avoidCount(course) {
        return course.dans.length === 1 ? 3 : 1;
    }

    /** つぎの 問題。recent は これまでに 出した 問題の キー（ふるい じゅん） */
    function pickQuestion(course, recent, rand) {
        rand = rand || Math.random;
        const avoid = new Set((recent || []).slice(-avoidCount(course)));
        const list = problemsOf(course).filter(q => !avoid.has(keyOf(q)));
        const q = list[Math.floor(rand() * list.length) % list.length];
        return { a: q.a, b: q.b, ans: q.a * q.b };
    }

    /** 入力の はんてい。答えの けた数に なった しゅんかんに done */
    function judge(q, input) {
        const want = String(q.a * q.b);
        const s = String(input || '');
        return { done: s.length >= want.length, ok: s === want };
    }

    /** れんぞく正解数 → ドパレベル（0〜8） */
    function levelOf(combo) {
        let lv = 0;
        for (let i = 0; i < LEVELS.length; i++) if (combo >= LEVELS[i]) lv = i;
        return lv;
    }

    /** 確定演出の しゅるい（50＝にじ・100＝ひゃく・60 70 80 …＝かくてい） */
    function kakuteiOf(combo) {
        if (combo === 50) return 'niji';
        if (combo === 100) return 'hyaku';
        if (combo > 50 && combo % 10 === 0) return 'kakutei';
        return null;
    }

    /** 「○れんぞく!」の テロップを 出す 節目（5・10・20・30 …） */
    function isMilestone(combo) {
        return combo === 5 || (combo >= 10 && combo % 10 === 0);
    }

    /* ---------- きろく ---------- */
    const bestKey = (courseId, limit) => courseId + '_' + limit;

    /** にがてな九九（ゲームオーバーに なった 回数が 多い じゅん。おなじ 回数は 段・かける数の じゅん） */
    function topMiss(miss, n) {
        return Object.keys(miss || {})
            .map(k => {
                const m = /^([1-9])x([1-9])$/.exec(k);
                return m ? { key: k, a: Number(m[1]), b: Number(m[2]), n: Number(miss[k]) || 0 } : null;
            })
            .filter(x => x && x.n > 0)
            .sort((p, q) => q.n - p.n || p.a - q.a || p.b - q.b)
            .slice(0, n == null ? 5 : n);
    }

    /** 保存されていた せっていを たしかめる（こわれて いたら 初期値） */
    function sanitizeSettings(o) {
        o = o && typeof o === 'object' ? o : {};
        return {
            limit: LIMITS.includes(Number(o.limit)) ? Number(o.limit) : 5,
            sound: o.sound !== false,
            bgm: o.bgm !== false,
            /* 'hade'・'hikaeme'。まだ えらんで いない ときは null（端末の「視差効果を減らす」で きめる） */
            fx: o.fx === 'hade' || o.fx === 'hikaeme' ? o.fx : null,
        };
    }

    /** きろく（{ キー: 数 }）の こわれた ところを すてる */
    function sanitizeCounts(o) {
        const out = {};
        if (!o || typeof o !== 'object') return out;
        for (const k of Object.keys(o)) {
            const v = Math.floor(Number(o[k]));
            if (isFinite(v) && v > 0) out[k] = v;
        }
        return out;
    }

    /* ---------- 九九の となえかた（ゲームオーバーで 見せる） ---------- */
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

    root.DopaLogic = {
        COURSES, LEVELS, MAX_LEVEL, LIMITS, NIJI_HOLD,
        courseById, problemsOf, keyOf, avoidCount, pickQuestion, judge,
        levelOf, kakuteiOf, isMilestone,
        bestKey, topMiss, sanitizeSettings, sanitizeCounts, kukuReading,
    };
})(typeof window !== 'undefined' ? window : globalThis);
