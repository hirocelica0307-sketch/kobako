/* 毎日教養 ── 画面を 使わない 処理
   問題の 整理・復習の 予定（間を あけて くり返す）・今日の セットの 組み立て・つづけた 日数・記録の 集計。
   node でも ブラウザでも 動く（tests.js から ためす）。 */
(function (root) {
    'use strict';

    /* ---------- 問題 ---------- */

    /** MKData の 行を、あつかいやすい 形に する */
    function buildQuestions(data) {
        const list = [];
        const byId = {};
        data.GENRES.forEach(function (g) {
            (data.rows[g.id] || []).forEach(function (r, i) {
                const q = {
                    id: g.id + '/' + r[0], g: g.id, n: i, topic: r[0], q: r[1],
                    c: r[2].slice(), exp: r[3], notes: r[4].slice(), point: r[5]
                };
                list.push(q);
                byId[q.id] = q;
            });
        });
        return { list: list, byId: byId };
    }

    /** 問題データの 形を たしかめて、見つかった まちがいを 文の 配列で かえす */
    function validate(data) {
        const errs = [];
        const ids = {};
        const texts = {};
        const norm = function (s) { return String(s).replace(/[\s　、。・「」『』（）()？?！!]/g, ''); };
        data.GENRES.forEach(function (g) {
            (data.rows[g.id] || []).forEach(function (r, i) {
                const at = g.id + ' ' + (i + 1) + '問目（' + (r && r[0]) + '）';
                if (!Array.isArray(r) || r.length !== 6) { errs.push(at + '：要素が 6つ でない'); return; }
                const [topic, q, c, exp, notes, point] = r;
                [['テーマ', topic], ['問題文', q], ['解説', exp], ['ワンポイント', point]].forEach(function (p) {
                    if (typeof p[1] !== 'string' || !p[1].trim()) errs.push(at + '：' + p[0] + 'が 空');
                });
                if (!Array.isArray(c) || c.length !== 4) errs.push(at + '：選択肢が 4つ でない');
                else {
                    c.forEach(function (x, k) { if (typeof x !== 'string' || !x.trim()) errs.push(at + '：選択肢' + (k + 1) + 'が 空'); });
                    if (new Set(c.map(norm)).size !== 4) errs.push(at + '：同じ 選択肢が ある');
                }
                if (!Array.isArray(notes) || notes.length !== 3) errs.push(at + '：選択肢の 説明が 3つ でない');
                else notes.forEach(function (x, k) { if (typeof x !== 'string' || !x.trim()) errs.push(at + '：説明' + (k + 1) + 'が 空'); });
                const id = g.id + '/' + topic;
                if (ids[id]) errs.push(at + '：テーマが 重なって いる');
                ids[id] = 1;
                const nq = norm(q);
                if (texts[nq]) errs.push(at + '：同じ 問題文が ' + texts[nq] + ' に ある');
                texts[nq] = id;
            });
        });
        return errs;
    }

    /* ---------- 日付 ---------- */

    /** その日の 番号（1970-01-01 から 何日目か。端末の 時計の 日付で 数える） */
    function dayNum(date) {
        const d = date || new Date();
        return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    }
    function dayToDate(n) {
        const d = new Date(n * 86400000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    function dayLabel(n) {
        const d = dayToDate(n);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    /* ---------- 乱数（日ごとに きまる ものにも 使える） ---------- */

    function rng(seed) {
        let s = (seed >>> 0) || 1;
        return function () {
            s ^= s << 13; s >>>= 0;
            s ^= s >>> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    }
    function shuffle(arr, rand) {
        const a = arr.slice();
        const r = rand || Math.random;
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* ---------- 復習の 予定（ライトナー方式） ----------
       箱 1〜6。正解すると 1つ 上の 箱へ、まちがえると 箱1へ。
       箱ごとに 次に 出す までの 日数が のびていく。箱6 は「覚えた」。 */

    const INTERVALS = [0, 1, 3, 7, 21, 60, 150];
    const MASTER_BOX = 5;

    function newCard(today) {
        return { box: 0, due: today, n: 0, ok: 0, ng: 0, over: 0, last: null, first: today };
    }

    /**
     * 1問 こたえた ときの 予定の 更新
     * @param card  いまの 記録（なければ null）
     * @param ok    正解か
     * @param conf  自信  'sure' | 'maybe' | 'guess' | null（たずねない 設定）
     * @param today 日の 番号
     */
    function review(card, ok, conf, today) {
        const c = Object.assign(newCard(today), card || {});
        const isNew = c.n === 0;
        c.n += 1;
        let box;
        if (ok) {
            c.ok += 1;
            if (conf === 'guess') box = Math.max(1, c.box - 1);          // 勘で 当たった → 知って いた とは いえない
            else if (isNew && conf === 'sure') box = 2;                    // はじめから 自信を もって 正解 → 少し 先へ
            else box = Math.min(6, Math.max(1, c.box + 1));
        } else {
            c.ng += 1;
            box = 1;
            if (conf === 'sure') { c.over += 1; c.overOpen = true; }      // 自信が あった まちがい ＝ 思いこみ
        }
        if (ok && c.overOpen && conf !== 'guess') c.overOpen = false;     // 思いこみを 正しく 直せた
        c.box = box;
        c.due = today + INTERVALS[box];
        c.last = { d: today, ok: !!ok, conf: conf || null };
        return c;
    }

    function isDue(card, today) { return !!card && card.n > 0 && card.due <= today; }
    function isMastered(card) { return !!card && card.box >= MASTER_BOX; }

    /* ---------- セットの 組み立て ---------- */

    /** ジャンルが となりあわない ように ならべる（できる かぎり） */
    function spreadGenres(qs, rand) {
        const groups = {};
        qs.forEach(function (q) { (groups[q.g] = groups[q.g] || []).push(q); });
        const out = [];
        let prev = null;
        while (out.length < qs.length) {
            const keys = Object.keys(groups).filter(function (k) { return groups[k].length; });
            keys.sort(function (a, b) { return groups[b].length - groups[a].length; });
            const pick = keys.find(function (k) { return k !== prev; }) || keys[0];
            const cand = keys.filter(function (k) { return k !== prev && groups[k].length === groups[pick].length; });
            const k = cand.length ? cand[Math.floor(rand() * cand.length)] : pick;
            out.push(groups[k].shift());
            prev = k;
        }
        return out;
    }

    /**
     * 今日の セット（新しい 問題と 復習を まぜる。ジャンルも まぜる）
     * @param Q      buildQuestions の 結果
     * @param cards  { id: card }
     * @param today  日の 番号
     * @param opt    { size, genres: [使う ジャンル id]（なければ 全部）, only: ジャンル id, mode, seed }
     *   mode: 'daily'（ふつう）| 'review'（復習だけ）| 'over'（思いこみだけ）| 'star'（★だけ, opt.star）| 'random'
     */
    function buildSet(Q, cards, today, opt) {
        const o = opt || {};
        const size = o.size || 10;
        const rand = rng(o.seed != null ? o.seed : (today * 7919 + 17));
        const allow = o.only ? [o.only] : (o.genres && o.genres.length ? o.genres : null);
        const pool = Q.list.filter(function (q) { return !allow || allow.indexOf(q.g) >= 0; });
        const due = pool.filter(function (q) { return isDue(cards[q.id], today); });
        // 早く 出す べき ものから：思いこみ → 予定日が 古い → 箱が 低い
        due.sort(function (a, b) {
            const x = cards[a.id], y = cards[b.id];
            return (y.overOpen ? 1 : 0) - (x.overOpen ? 1 : 0) || x.due - y.due || x.box - y.box;
        });
        const unseen = pool.filter(function (q) { return !cards[q.id] || !cards[q.id].n; });
        const mode = o.mode || 'daily';

        let picked = [];
        if (mode === 'review') picked = due.slice(0, size);
        else if (mode === 'over') {
            picked = shuffle(pool.filter(function (q) { return cards[q.id] && cards[q.id].overOpen; }), rand).slice(0, size);
        } else if (mode === 'star') {
            const st = o.star || {};
            picked = shuffle(pool.filter(function (q) { return st[q.id]; }), rand).slice(0, size);
        } else if (mode === 'random') {
            picked = shuffle(pool, rand).slice(0, size);
        } else {
            // ふつう：復習は 半分まで。のこりは 新しい 問題を ジャンルを まわしながら 選ぶ
            const reviewN = Math.min(due.length, Math.floor(size / 2));
            picked = due.slice(0, reviewN);
            const byG = {};
            shuffle(unseen, rand).forEach(function (q) { (byG[q.g] = byG[q.g] || []).push(q); });
            let gs = shuffle(Object.keys(byG), rand);
            while (picked.length < size && gs.length) {
                const next = [];
                for (let i = 0; i < gs.length && picked.length < size; i++) {
                    picked.push(byG[gs[i]].shift());
                    if (byG[gs[i]].length) next.push(gs[i]);
                }
                gs = shuffle(next, rand);
            }
            // 新しい 問題が もう ない → 復習を ふやす → それでも たりなければ 前に 解いた 問題
            for (let i = reviewN; picked.length < size && i < due.length; i++) picked.push(due[i]);
            if (picked.length < size) {
                const have = {};
                picked.forEach(function (q) { have[q.id] = 1; });
                const rest = pool.filter(function (q) { return !have[q.id]; });
                rest.sort(function (a, b) {
                    const x = cards[a.id], y = cards[b.id];
                    return ((x && x.last && x.last.d) || 0) - ((y && y.last && y.last.d) || 0);
                });
                for (let i = 0; picked.length < size && i < rest.length; i++) picked.push(rest[i]);
            }
        }
        return spreadGenres(picked, rand).map(function (q) { return q.id; });
    }

    /** 選択肢の ならび（画面に 出す 順に、もとの 番号を ならべた もの。0 が 正解） */
    function choiceOrder(rand) { return shuffle([0, 1, 2, 3], rand); }

    /* ---------- つづけた 日数・おやすみ券 ---------- */

    const TICKET_MAX = 2;
    const TICKET_EVERY = 7;

    /** days: { 日の番号: { n, ok, done, rest } } から、今日 まで つづいて いる 日数 */
    function streak(days, today) {
        const on = function (d) { return days[d] && (days[d].done || days[d].rest); };
        let d = on(today) ? today : today - 1;
        let n = 0;
        while (on(d)) { if (days[d].done) n++; d--; }
        return n;
    }

    /**
     * 休んだ 日を おやすみ券で うめる（アプリを ひらいた ときに 呼ぶ）
     * @return 使った 券の 枚数
     */
    function applyRest(state, today) {
        const days = state.days;
        const doneDays = Object.keys(days).filter(function (k) { return days[k].done || days[k].rest; }).map(Number);
        if (!doneDays.length) return 0;
        const last = Math.max.apply(null, doneDays);
        const missed = today - last - 1;
        if (missed <= 0 || missed > (state.tickets || 0)) return 0;
        for (let d = last + 1; d < today; d++) days[d] = Object.assign(days[d] || { n: 0, ok: 0 }, { rest: true });
        state.tickets -= missed;
        return missed;
    }

    /** 今日の セットを おえた ときに 呼ぶ。券が ふえたら true */
    function finishDay(state, today) {
        const d = state.days[today] = state.days[today] || { n: 0, ok: 0 };
        if (d.done) return false;
        d.done = true;
        const s = streak(state.days, today);
        state.best = Math.max(state.best || 0, s);
        if (s > 0 && s % TICKET_EVERY === 0 && (state.tickets || 0) < TICKET_MAX) {
            state.tickets = (state.tickets || 0) + 1;
            return true;
        }
        return false;
    }

    /* ---------- 集計 ---------- */

    function genreStats(Q, cards, today, genres) {
        const out = {};
        (genres || []).forEach(function (g) { out[g.id || g] = { total: 0, seen: 0, mastered: 0, due: 0, n: 0, ok: 0 }; });
        Q.list.forEach(function (q) {
            const s = out[q.g] = out[q.g] || { total: 0, seen: 0, mastered: 0, due: 0, n: 0, ok: 0 };
            const c = cards[q.id];
            s.total++;
            if (c && c.n) {
                s.seen++; s.n += c.n; s.ok += c.ok;
                if (isMastered(c)) s.mastered++;
                if (isDue(c, today)) s.due++;
            }
        });
        return out;
    }

    function totals(Q, cards, today) {
        const t = { total: Q.list.length, seen: 0, mastered: 0, due: 0, over: 0, overOpen: 0, n: 0, ok: 0 };
        Q.list.forEach(function (q) {
            const c = cards[q.id];
            if (!c || !c.n) return;
            t.seen++; t.n += c.n; t.ok += c.ok; t.over += c.over || 0;
            if (c.overOpen) t.overOpen++;
            if (isMastered(c)) t.mastered++;
            if (isDue(c, today)) t.due++;
        });
        return t;
    }

    function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }

    /* ---------- 保存データ ---------- */

    const DEFAULT_SETTINGS = {
        size: 10, conf: true, recall: false, sound: true, vibe: true,
        font: 'm', theme: 'auto', off: []
    };

    function emptyState() {
        return { v: 1, cards: {}, days: {}, star: {}, flag: {}, tickets: 0, best: 0,
            settings: Object.assign({}, DEFAULT_SETTINGS, { off: [] }), daily: null, other: null, cur: null };
    }

    /** 読みこんだ データを 今の 形に そろえる（こわれて いても 落ちない） */
    function normalizeState(s) {
        const e = emptyState();
        if (!s || typeof s !== 'object') return e;
        const obj = function (x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; };
        e.cards = obj(s.cards);
        e.days = obj(s.days);
        e.star = obj(s.star);
        e.flag = obj(s.flag);
        e.tickets = Math.max(0, Math.min(TICKET_MAX, Number(s.tickets) || 0));
        e.best = Number(s.best) || 0;
        e.settings = Object.assign({}, DEFAULT_SETTINGS, obj(s.settings));
        if (!Array.isArray(e.settings.off)) e.settings.off = [];
        if ([5, 10, 15, 20].indexOf(Number(e.settings.size)) < 0) e.settings.size = 10;
        e.settings.size = Number(e.settings.size);
        const sess = function (x) {
            return x && typeof x === 'object' && Array.isArray(x.ids) && Array.isArray(x.ans) && Array.isArray(x.retry) ? x : null;
        };
        e.daily = sess(s.daily);
        e.other = sess(s.other);
        e.cur = (s.cur === 'daily' && e.daily) || (s.cur === 'other' && e.other) ? s.cur : null;
        return e;
    }

    root.MKLogic = {
        buildQuestions, validate, dayNum, dayToDate, dayLabel, rng, shuffle,
        INTERVALS, MASTER_BOX, newCard, review, isDue, isMastered,
        spreadGenres, buildSet, choiceOrder,
        TICKET_MAX, TICKET_EVERY, streak, applyRest, finishDay,
        genreStats, totals, pct, DEFAULT_SETTINGS, emptyState, normalizeState
    };
})(typeof window !== 'undefined' ? window : globalThis);
