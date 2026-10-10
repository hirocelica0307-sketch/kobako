/* コンピューターの 考え（つよさ 1〜10）
   ------------------------------------------------------------------
   コンピューターは じぶんの 手札・場・おたがいが とった 札 しか 見ません
   （山の じゅんばんや あいての 手札は 見ない＝ズル なし）。

   レベルの ちがい
     1      … でたらめ
     2      … とれる ときは とる。あとは でたらめ
     3〜7   … 札の ねうち・役の すすみぐあい・あいての じゃま・
                とられる きけん を 点数に して えらぶ。レベルが 上がるほど
                見る ことが ふえ、まよい（でたらめ）が へる
     8〜10  … 見えない 札を なんども ならべなおして さいごまで
                ためしてみる（モンテカルロ）。レベルが 上がるほど ためす 回数が ふえる
   こいこいするか どうかも レベルで かわります。
   ------------------------------------------------------------------ */
import { CARDS, monthOf, kindOf } from './cards.js';
import {
    legalActions, applyAction, clone, calcYaku, scoreOf, yakuProgress, roundPoints,
    fieldMatches, shuffle, makeRng
} from './rules.js';

export const LEVELS = [
    null,
    { name: 'はじめて',   desc: 'でたらめに 出します' },
    { name: 'のんびり',   desc: 'とれる 札は とります' },
    { name: 'みならい',   desc: '光や 役を すこし 気にします' },
    { name: 'ふつう',     desc: '役を ねらい はじめます' },
    { name: 'しっかり',   desc: 'あいての 役も じゃまします' },
    { name: 'つよい',     desc: 'とられる きけんも 考えます' },
    { name: 'たつじん',   desc: 'まよわず いちばん よい 手を 打ちます' },
    { name: 'めいじん',   desc: '先を 読んで 打ちます' },
    { name: 'ちょうじん', desc: 'もっと 先を 読みます' },
    { name: '花札の神',   desc: 'とことん 読みます' }
];

const CFG = [
    null,
    { rand: 1,    yaku: 0,   deny: 0,   risk: 0,   noise: 0,   koi: 'random' },
    { rand: 0.45, yaku: 0,   deny: 0,   risk: 0,   noise: 0,   koi: 'stop', greedy: true },
    { rand: 0.25, yaku: 0.5, deny: 0.1, risk: 0.1, noise: 0.3, koi: 'stop' },
    { rand: 0.12, yaku: 1,   deny: 0.3, risk: 0.3, noise: 0.8, koi: 'heur', bold: 0.2 },
    { rand: 0.07, yaku: 1,   deny: 0.6, risk: 0.6, noise: 0.4, koi: 'heur', bold: 0.3 },
    { rand: 0.06, yaku: 1,   deny: 0.8, risk: 0.8, noise: 0.3, koi: 'heur', bold: 0.4 },
    { rand: 0,    yaku: 1,   deny: 1,   risk: 1,   noise: 0.05, koi: 'heur', bold: 0.35 },
    { rand: 0,    yaku: 1,   deny: 1,   risk: 1,   noise: 0,   koi: 'mc', mc: 36 },
    { rand: 0,    yaku: 1,   deny: 1,   risk: 1,   noise: 0,   koi: 'mc', mc: 70 },
    { rand: 0,    yaku: 1,   deny: 1,   risk: 1,   noise: 0,   koi: 'mc', mc: 140 }
];

const KIND_VALUE = { hikari: 3, tane: 1.2, tan: 1.2, kasu: 0.4 };

/* ── 見えない 札 ─────────────────────────────── */

export function unknownCards(s, p) {
    const seen = new Set([...s.hands[p], ...s.field, ...s.caps[0], ...s.caps[1]]);
    if (s.pending !== null && s.pending !== undefined) seen.add(s.pending);
    return CARDS.map(c => c.id).filter(id => !seen.has(id));
}

/* ── 札の ねうち ─────────────────────────────── */

/** p から 見た 札 id の ねうち（役の すすみぐあいで かわる） */
function makeValuer(s, p, w) {
    const prog = yakuProgress(s.caps[p], s.caps[1 - p], s.rules);
    const val = new Map();
    const valueOf = id => {
        if (val.has(id)) return val.get(id);
        let v = KIND_VALUE[kindOf(id)];
        if (w.yaku) {
            for (const e of prog) {
                if (!e.possible || !e.missing.includes(id)) continue;
                const after = (e.have + 1) / e.need;
                const complete = e.have + 1 >= e.need;
                v += w.yaku * (complete ? e.pts * 1.2 : e.pts * after * after * 0.8);
            }
        }
        val.set(id, v);
        return v;
    };
    return valueOf;
}

/** あいてが その 月の 札を 手札に もっている かくりつ（だいたい） */
function oppHasMonth(s, p, month, unknown) {
    const h = s.hands[1 - p].length;
    const U = unknown.length;
    const k = unknown.filter(id => monthOf(id) === month).length;
    if (k === 0 || h === 0) return 0;
    // 1 - C(U-k, h) / C(U, h)
    let q = 1;
    for (let i = 0; i < h; i++) q *= Math.max(0, U - k - i) / (U - i);
    // 山から めくった 札でも とられる ことが あるので すこし たす
    return Math.min(1, 1 - q + 0.12 * k / Math.max(1, U));
}

/** 1手の よさ（ヒューリスティック） */
function scoreAction(s, a, w, ctx) {
    const p = a.p;
    if (a.t === 'ready') return 0;
    if (a.t === 'pick') return ctx.mine(a.target) + w.deny * ctx.theirs(a.target);
    const card = a.card;
    const m = fieldMatches(s, card);
    let v = 0;
    if (m.length === 0) {
        // 場に のこす：あいてに とられる きけん
        const risk = oppHasMonth(s, p, monthOf(card), ctx.unknown);
        v -= w.risk * risk * (ctx.theirs(card) + ctx.mine(card) * 0.5);
        // 同じ 月を もう1枚 手札に もっていれば、あとで とれる かもしれない
        const pair = s.hands[p].some(c => c !== card && monthOf(c) === monthOf(card));
        if (pair) v += 0.3 * ctx.mine(card);
        // ねうちの ない 札から すてる
        v -= 0.25 * ctx.mine(card);
    } else {
        const taken = m.length === 2 ? [a.target] : m;
        for (const id of [card, ...taken]) v += ctx.mine(id) + w.deny * ctx.theirs(id);
        if (m.length === 2) {
            // のこした ほうの 札を あいてに とられる かも
            const left = m.find(x => x !== a.target);
            const risk = oppHasMonth(s, p, monthOf(left), ctx.unknown);
            v -= w.risk * risk * ctx.theirs(left) * 0.6;
        }
        if (m.length === 1) {
            // 同じ 月の 3枚目が 手札に あるなら、いま 出さずに まつ 手も ある
            const sameInHand = s.hands[p].filter(c => monthOf(c) === monthOf(card)).length;
            if (sameInHand >= 2 && w.risk) v -= 0.2;
        }
    }
    return v;
}

function heuristicChoice(s, p, w, rng) {
    const acts = legalActions(s, p);
    if (acts.length === 1) return acts[0];
    const ctx = {
        mine: makeValuer(s, p, w),
        theirs: (() => { const f = makeValuer(s, 1 - p, w); return id => f(id); })(),
        unknown: unknownCards(s, p)
    };
    let best = null, bestV = -Infinity;
    for (const a of acts) {
        const v = scoreAction(s, a, w, ctx) + (w.noise ? (rng() - 0.5) * 2 * w.noise : 0);
        if (v > bestV) { bestV = v; best = a; }
    }
    return best;
}

/* ── こいこい する？ ─────────────────────────── */

function threatOf(s, p) {
    // あいて（1-p）の 役が どれくらい ちかいか 0〜1
    const prog = yakuProgress(s.caps[1 - p], s.caps[p], s.rules);
    let t = 0;
    for (const e of prog) {
        if (!e.possible || e.done) continue;
        const r = e.have / e.need;
        const near = e.need - e.have === 1 ? 0.6 + 0.08 * e.pts : r * r * 0.5;
        t = Math.max(t, near);
    }
    if (scoreOf(s.caps[1 - p], s.rules) > 0) t = Math.max(t, 0.9);
    return Math.min(1, t);
}

function heuristicKoikoi(s, p, cfg) {
    const hand = s.hands[p].length;
    if (hand <= 1) return false;
    const pts = scoreOf(s.caps[p], s.rules);
    const last = s.round >= s.rules.rounds;
    const lead = s.scores[p] - s.scores[1 - p];
    if (last && lead + pts > 0) return false;               // さいごの 局で 勝てるなら あがる
    if (s.koi[1 - p] > 0) return false;                     // あいてが こいこい中なら すぐ あがる
    const threat = threatOf(s, p);
    const prog = yakuProgress(s.caps[p], s.caps[1 - p], s.rules);
    let upside = 0;
    for (const e of prog) {
        if (e.done || !e.possible) continue;
        if (e.need - e.have === 1) upside += e.pts * 0.5;
    }
    const want = upside * (hand / 8) * (1 + cfg.bold) - threat * 4 - pts * 0.25;
    return want > 0.6;
}

/* ── モンテカルロ ─────────────────────────────── */

/** 先読み用の すばやい きめかた（とれる 中で いちばん ねうちの ある 札） */
function quickPolicy(s, rng) {
    const acts = legalActions(s, s.phase === 'roundEnd' ? 0 : s.turn);
    if (s.phase === 'decide') return acts.find(a => a.t === 'stop');
    if (acts.length === 1) return acts[0];
    let best = acts[0], bestV = -Infinity;
    const p = s.turn;
    const caps = s.caps[p];
    for (const a of acts) {
        let v = rng() * 0.3;
        if (a.t === 'pick') {
            v += quickCardValue(a.target, caps);
        } else {
            const m = fieldMatches(s, a.card);
            if (m.length) {
                const taken = m.length === 2 ? [a.target] : m;
                v += 1 + quickCardValue(a.card, caps);
                for (const id of taken) v += quickCardValue(id, caps);
            } else {
                v -= quickCardValue(a.card, s.caps[1 - p]) * 0.5;
            }
        }
        if (v > bestV) { bestV = v; best = a; }
    }
    return best;
}
function quickCardValue(id, caps) {
    const before = scoreOf(caps, DEFAULT_QUICK);
    const after = scoreOf(caps.concat([id]), DEFAULT_QUICK);
    return KIND_VALUE[kindOf(id)] + (after - before) * 2;
}
const DEFAULT_QUICK = { hanami: true, sakeKasu: true };

function determinize(s, p, rng) {
    const t = clone(s);
    const unk = shuffle(unknownCards(s, p), rng);
    const h = s.hands[1 - p].length;
    t.hands[1 - p] = unk.slice(0, h);
    t.deck = unk.slice(h);
    t.rules = { ...t.rules, rounds: t.round };   // この 局で おわりに する
    return t;
}

/** 局の おわりまで すすめて、p から 見た 点の さ を かえす */
function rollout(t, p, rng) {
    let guard = 0;
    while (t.phase !== 'roundEnd' && t.phase !== 'gameEnd' && guard++ < 80) {
        const a = quickPolicy(t, rng);
        applyAction(t, a);
    }
    const r = t.result;
    if (!r || r.winner === null) return 0;
    return r.winner === p ? r.total : -r.total;
}

function mcChoice(s, p, cfg, rng) {
    const acts = legalActions(s, p);
    if (acts.length === 1) return acts[0];
    const w = { yaku: 1, deny: 1, risk: 1 };
    const ctx = { mine: makeValuer(s, p, w), theirs: makeValuer(s, 1 - p, w), unknown: unknownCards(s, p) };
    const N = cfg.mc;
    let best = null, bestV = -Infinity;
    // 同じ ならびで くらべる（ばらつきを へらす）
    const seeds = Array.from({ length: N }, () => Math.floor(rng() * 2 ** 31));
    for (const a of acts) {
        let total = 0;
        for (let i = 0; i < N; i++) {
            const r2 = makeRng(seeds[i]);
            const t = determinize(s, p, r2);
            applyAction(t, a);
            total += rollout(t, p, r2);
        }
        const v = total / N + 0.15 * scoreAction(s, a, w, ctx);
        if (v > bestV) { bestV = v; best = a; }
    }
    return best;
}

function mcKoikoi(s, p, cfg, rng) {
    if (s.hands[p].length <= 1) return false;
    const stopNow = roundPoints(s, p).total;
    const last = s.round >= s.rules.rounds;
    if (last && s.scores[p] + stopNow > s.scores[1 - p]) return false;
    const N = cfg.mc;
    let total = 0;
    for (let i = 0; i < N; i++) {
        const r2 = makeRng(Math.floor(rng() * 2 ** 31));
        const t = determinize(s, p, r2);
        applyAction(t, { t: 'koikoi', p });
        total += rollout(t, p, r2);
    }
    return total / N > stopNow + 0.5;
}

/* ── そとから よぶ ところ ─────────────────────── */

/**
 * レベル level の コンピューター（プレイヤー p）が えらぶ 手。
 * rng を わたさなければ Math.random を つかいます。
 */
export function chooseAction(s, p, level, rng = Math.random) {
    const cfg = CFG[Math.max(1, Math.min(10, level))];
    const acts = legalActions(s, p);
    if (!acts.length) return null;
    if (s.phase === 'roundEnd') return acts[0];
    if (s.phase === 'decide') {
        let koi;
        if (cfg.koi === 'random') koi = rng() < 0.5;
        else if (cfg.koi === 'stop') koi = false;
        else if (cfg.koi === 'mc') koi = mcKoikoi(s, p, cfg, rng);
        else koi = heuristicKoikoi(s, p, cfg);
        return { t: koi ? 'koikoi' : 'stop', p };
    }
    if (rng() < cfg.rand) {
        if (cfg.greedy) {
            const caps = acts.filter(a => a.t === 'pick' || fieldMatches(s, a.card).length > 0);
            if (caps.length) return caps[Math.floor(rng() * caps.length)];
        }
        return acts[Math.floor(rng() * acts.length)];
    }
    if (cfg.greedy) {
        const caps = acts.filter(a => a.t === 'pick' || fieldMatches(s, a.card).length > 0);
        const pool = caps.length ? caps : acts;
        return pool[Math.floor(rng() * pool.length)];
    }
    if (cfg.mc) return mcChoice(s, p, cfg, rng);
    return heuristicChoice(s, p, cfg, rng);
}

/* ── おすすめ（はじめての 人むけ） ──────────────── */

/**
 * プレイヤー p への おすすめの 手と、その わけ。
 * かえす もの：{ action, reason }
 */
export function recommend(s, p) {
    const acts = legalActions(s, p);
    if (!acts.length) return null;
    if (s.phase === 'decide') {
        const koi = heuristicKoikoi(s, p, CFG[7]);
        const threat = threatOf(s, p);
        let reason;
        if (koi) reason = 'あいての 役は まだ とおそうです。もう少し 点を ふやせそうなので、こいこいも ありです。';
        else if (s.hands[p].length <= 1) reason = 'もう 手札が のこり少ないので、あがって 点を もらいましょう。';
        else if (s.koi[1 - p] > 0) reason = 'あいては こいこい中です。あがれば あいてに 点を わたさずに すみます。';
        else if (threat > 0.55) reason = 'あいても 役に ちかづいています。あがって 点を まもりましょう。';
        else reason = 'まよったら あがるのが あんぜんです。';
        return { action: { t: koi ? 'koikoi' : 'stop', p }, reason };
    }
    const w = CFG[7];
    const action = heuristicChoice(s, p, { ...w, noise: 0 }, Math.random);
    return { action, reason: explain(s, p, action) };
}

function explain(s, p, a) {
    const name = id => CARDS[id].name;
    if (a.t === 'pick') return `「${name(a.target)}」を とると よさそうです。`;
    const m = fieldMatches(s, a.card);
    if (!m.length) {
        const anyCatch = s.hands[p].some(c => fieldMatches(s, c).length);
        return anyCatch
            ? `「${name(a.card)}」は 場に 出しても とられにくい 札です。`
            : `とれる 札が ないので、とられても こまらない「${name(a.card)}」を 出しましょう。`;
    }
    const taken = m.length === 2 ? [a.target] : m;
    const after = s.caps[p].concat([a.card, ...taken]);
    const before = calcYaku(s.caps[p], s.rules).map(y => y.id);
    const made = calcYaku(after, s.rules).filter(y => !before.includes(y.id));
    if (made.length) return `「${name(a.card)}」で とると「${made.map(y => y.name).join('・')}」が できます！`;
    const prog = yakuProgress(after, s.caps[1 - p], s.rules)
        .filter(e => !e.done && e.possible && e.need - e.have === 1 && e.need <= 4);
    const best = [a.card, ...taken].find(id => kindOf(id) !== 'kasu') ?? a.card;
    if (prog.length) return `「${name(a.card)}」で とると「${prog[0].name}」まで あと 1枚です。`;
    if (kindOf(best) === 'hikari') return `光の 札「${name(best)}」が とれます。光は とても 大事です。`;
    const theirProg = yakuProgress(s.caps[1 - p], s.caps[p], s.rules)
        .filter(e => !e.done && e.possible && e.missing.some(id => taken.includes(id) || id === a.card) && e.have >= 1 && e.need <= 4);
    if (theirProg.length) return `あいての「${theirProg[0].name}」を じゃまできます。`;
    return `「${name(a.card)}」で「${name(taken[0])}」が とれます。`;
}


