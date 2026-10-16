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

    /* ---------- リーチ（つぎの 大演出の 予告） ----------
       大演出まで「あと 3問」から リーチに なる。運では なく、あと 何問かが はっきり 見える。
       もとに なる 大演出：10問ごとの 大演出（下の TIERS）・しんきろく（いままでの さいこう＋1。さいこうが 5 いじょうの とき） */
    const REACH_LEN = 3;
    /* ---------- 10問ごとの 大演出（200問まで だんだん 派手に） ----------
       60〜190 は 毎回 ちがう 演出（tier）。200 は「でんせつ」。200 より 先は 10問ごとに 確定演出 */
    const TIERS = {
        10: { id: 'ten', name: '10れんぞく', icon: '' },
        20: { id: 'dopa', name: 'ドパタイム', icon: '🔥' },
        30: { id: 'chodopa', name: '超ドパ', icon: '🔥' },
        40: { id: 'atsu', name: '激アツ', icon: '🔥' },
        50: { id: 'niji', name: 'にじドパ', icon: '🌈' },
        60: { id: 'ryusei', name: '流星群', icon: '🌠' },
        70: { id: 'kaminari', name: 'カミナリ', icon: '⚡' },
        80: { id: 'aurora', name: 'オーロラ', icon: '🌌' },
        90: { id: 'ginga', name: 'ぎんが', icon: '🌀' },
        100: { id: 'hyaku', name: '100れんぞく', icon: '👑' },
        110: { id: 'hoshi', name: '星の雨', icon: '⭐' },
        120: { id: 'laser', name: 'レーザー', icon: '🔆' },
        130: { id: 'hanabi', name: '花火大会', icon: '🎆' },
        140: { id: 'houseki', name: '宝石', icon: '💎' },
        150: { id: 'chouniji', name: '超にじドパ', icon: '🌈' },
        160: { id: 'neon', name: 'ネオン', icon: '🌃' },
        170: { id: 'nova', name: 'スーパーノヴァ', icon: '💥' },
        180: { id: 'warp', name: 'ワープ', icon: '🚀' },
        190: { id: 'last', name: 'ラストスパート', icon: '🚨' },
        200: { id: 'legend', name: 'でんせつ', icon: '🏆' },
    };
    const MAX_TIER = 200;

    /** n れんぞく めの 大演出（10問ごと。ない ときは null）。200 より 先は 確定演出 */
    function tierAt(n) {
        if (n <= 0 || n % 10) return null;
        if (TIERS[n]) return Object.assign({ n }, TIERS[n]);
        return { n, id: 'kakutei', name: `${n}れんぞく`, icon: '🏆' };
    }

    /** いまの だんかい（いちばん 近く 通りすぎた 10問ごとの 大演出。200 で とまる） */
    function tierOf(combo) {
        const t = Math.min(MAX_TIER, Math.floor(combo / 10) * 10);
        return t >= 10 ? tierAt(t) : null;
    }

    /** n れんぞく めに 起きる 大演出（10問ごと ＋ しんきろく）。かさなった ときは 大演出が 先 */
    function bigEventsAt(n, best) {
        const out = [];
        const t = tierAt(n);
        if (t) out.push(t.id);
        if (best >= 5 && n === best + 1) out.push('newrec');
        return out;
    }

    /** いま combo れんぞく。つぎの 大演出まで あと REACH_LEN 問 いないなら リーチ（ちがえば null） */
    function reachOf(combo, best) {
        for (let left = 1; left <= REACH_LEN; left++) {
            const kinds = bigEventsAt(combo + left, best || 0);
            if (!kinds.length) continue;
            const n = combo + left, kind = kinds[0];
            const names = kinds.map(k => (k === 'newrec' ? 'しんきろく' : tierAt(n).name));
            return { left, target: n, kind, kinds, label: names.join('＆') };
        }
        return null;
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
        levelOf, kakuteiOf, isMilestone, REACH_LEN, TIERS, MAX_TIER, tierAt, tierOf, bigEventsAt, reachOf,
        bestKey, topMiss, sanitizeSettings, sanitizeCounts, kukuReading,
    };
})(typeof window !== 'undefined' ? window : globalThis);
