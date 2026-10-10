/* こいこいの ルール（エンジン）
   ------------------------------------------------------------------
   画面とは きりはなした「ルールだけ」の ぶぶんです。
   ・同じ 種（seed）と 同じ 手（action）の ならびなら、どの 端末でも
     かならず 同じ 結果に なります。友だちとの 対戦では、手の ならびだけを
     おくりあって、おたがいの 端末で この エンジンを うごかします。
   ・applyAction は state を その場で かきかえ、画面で うごかす ための
     できごと（events）の ならびを かえします。
   ・コンピューターが 先を 読む ときは clone() した コピーで ためします。

   1局の ながれ
     配る（手札 8枚ずつ・場に 8枚）→ 親から じゅんばんに
     手札を 1枚 出す（同じ 月の 札が 場に あれば とる）→ 山から 1枚 めくる（同じ）
     → 役が できたら「こいこい（つづける）」か「あがり（勝負）」を えらぶ
     → 2人とも 手札が なくなったら 流局（だれも 点が 入らない）
   ------------------------------------------------------------------ */
import { CARDS, monthOf, kindOf, idByTag } from './cards.js';

export const DEFAULT_RULES = {
    rounds: 12,          // 何局 あそぶか（1・3・6・12）
    hanami: true,        // 花見で一杯・月見で一杯を みとめる
    sakeKasu: true,      // 菊に盃を かすにも かぞえる
    double7: true,       // 7点以上で 2倍
    koiBonus: 'opponent',// 'none'：なし / 'opponent'：相手が こいこい していたら 2倍 / 'self'：自分の こいこい 1回ごとに +1倍
    teyaku: true         // 手役（手四・くっつき）
};

export const TAG = {
    tsuru: idByTag('tsuru'), maku: idByTag('maku'), tsuki: idByTag('tsuki'),
    ame: idByTag('ame'), houou: idByTag('houou'), sake: idByTag('sake'),
    ino: idByTag('ino'), shika: idByTag('shika'), cho: idByTag('cho')
};
export const HIKARI = CARDS.filter(c => c.k === 'hikari').map(c => c.id);
export const AKATAN = CARDS.filter(c => c.tags.includes('akatan')).map(c => c.id);
export const AOTAN = CARDS.filter(c => c.tags.includes('aotan')).map(c => c.id);
export const INOSHIKACHO = [TAG.ino, TAG.shika, TAG.cho];

/* 役の 一覧（表示の じゅんばん） */
export const YAKU_DEFS = [
    { id: 'goko',     name: '五光',       yomi: 'ごこう',         pts: 10, cards: HIKARI,
      desc: '光の 札 5枚 ぜんぶ' },
    { id: 'shiko',    name: '四光',       yomi: 'しこう',         pts: 8,  cards: HIKARI.filter(i => i !== TAG.ame),
      desc: '「柳に小野道風（雨）」いがいの 光 4枚' },
    { id: 'ameshiko', name: '雨四光',     yomi: 'あめしこう',     pts: 7,  cards: HIKARI,
      desc: '「柳に小野道風（雨）」を ふくむ 光 4枚' },
    { id: 'sanko',    name: '三光',       yomi: 'さんこう',       pts: 5,  cards: HIKARI.filter(i => i !== TAG.ame),
      desc: '「柳に小野道風（雨）」いがいの 光 3枚' },
    { id: 'hanami',   name: '花見で一杯', yomi: 'はなみで いっぱい', pts: 5, cards: [TAG.maku, TAG.sake], opt: 'hanami',
      desc: '「桜に幕」と「菊に盃」' },
    { id: 'tsukimi',  name: '月見で一杯', yomi: 'つきみで いっぱい', pts: 5, cards: [TAG.tsuki, TAG.sake], opt: 'hanami',
      desc: '「芒に月」と「菊に盃」' },
    { id: 'inoshikacho', name: '猪鹿蝶',  yomi: 'いのしかちょう', pts: 5,  cards: INOSHIKACHO,
      desc: '「萩に猪」「紅葉に鹿」「牡丹に蝶」の 3枚' },
    { id: 'akatan',   name: '赤短',       yomi: 'あかたん',       pts: 5,  cards: AKATAN,
      desc: '文字の 書いた 赤い 短冊 3枚（松・梅・桜）' },
    { id: 'aotan',    name: '青短',       yomi: 'あおたん',       pts: 5,  cards: AOTAN,
      desc: '青い 短冊 3枚（牡丹・菊・紅葉）' },
    { id: 'tane',     name: 'たね',       yomi: 'たね',           pts: 1,  need: 5, kind: 'tane',
      desc: 'たね札 5枚で 1点。1枚 ふえるごとに +1点' },
    { id: 'tan',      name: 'たん',       yomi: 'たん',           pts: 1,  need: 5, kind: 'tan',
      desc: '短冊 5枚で 1点。1枚 ふえるごとに +1点' },
    { id: 'kasu',     name: 'かす',       yomi: 'かす',           pts: 1,  need: 10, kind: 'kasu',
      desc: 'かす札 10枚で 1点。1枚 ふえるごとに +1点' }
];
export const YAKU_BY_ID = Object.fromEntries(YAKU_DEFS.map(y => [y.id, y]));

export const TEYAKU_POINTS = 6;

/* ── 乱数（種から 毎回 同じ ならびを つくる） ─────────────── */

function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
}
export function makeRng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ── 役 ─────────────────────────────────────── */

/** とった 札（ids）で できている 役の 一覧 [{id, name, pts, cards}] */
export function calcYaku(caps, rules = DEFAULT_RULES) {
    const set = new Set(caps);
    const out = [];
    const add = (id, pts, cards) => out.push({ id, name: YAKU_BY_ID[id].name, pts, cards });

    const hik = caps.filter(i => kindOf(i) === 'hikari');
    const rain = set.has(TAG.ame);
    if (hik.length === 5) add('goko', 10, hik);
    else if (hik.length === 4) add(rain ? 'ameshiko' : 'shiko', rain ? 7 : 8, hik);
    else if (hik.length === 3 && !rain) add('sanko', 5, hik);

    if (rules.hanami) {
        if (set.has(TAG.maku) && set.has(TAG.sake)) add('hanami', 5, [TAG.maku, TAG.sake]);
        if (set.has(TAG.tsuki) && set.has(TAG.sake)) add('tsukimi', 5, [TAG.tsuki, TAG.sake]);
    }
    if (INOSHIKACHO.every(i => set.has(i))) add('inoshikacho', 5, INOSHIKACHO);
    if (AKATAN.every(i => set.has(i))) add('akatan', 5, AKATAN);
    if (AOTAN.every(i => set.has(i))) add('aotan', 5, AOTAN);

    const tane = caps.filter(i => kindOf(i) === 'tane');
    if (tane.length >= 5) add('tane', tane.length - 4, tane);
    const tan = caps.filter(i => kindOf(i) === 'tan');
    if (tan.length >= 5) add('tan', tan.length - 4, tan);
    const kasu = caps.filter(i => kindOf(i) === 'kasu' || (rules.sakeKasu && i === TAG.sake));
    if (kasu.length >= 10) add('kasu', kasu.length - 9, kasu);
    return out;
}

export const sumYaku = list => list.reduce((s, y) => s + y.pts, 0);
export const scoreOf = (caps, rules) => sumYaku(calcYaku(caps, rules));

/** かす札として かぞえる 札か */
export const countsAsKasu = (id, rules) => kindOf(id) === 'kasu' || (rules.sakeKasu && id === TAG.sake);

/**
 * 役の すすみぐあい（画面の「あと 1枚！」や コンピューターの 考えに つかいます）
 * mine：じぶんが とった 札 / theirs：あいてが とった 札
 * かえす もの：[{ id, name, have, need, done, possible, missing:[ids], pts }]
 */
export function yakuProgress(mine, theirs, rules = DEFAULT_RULES) {
    const my = new Set(mine), op = new Set(theirs);
    const res = [];
    const setYaku = (id, cards, need = cards.length) => {
        const have = cards.filter(i => my.has(i));
        const missing = cards.filter(i => !my.has(i));
        const free = missing.filter(i => !op.has(i));
        res.push({ id, name: YAKU_BY_ID[id].name, pts: YAKU_BY_ID[id].pts, have: have.length, need,
            done: have.length >= need, possible: have.length + free.length >= need, missing: free });
    };
    // 光は「三光」を めあてに（雨は 三光に 入らない）
    const hikHave = HIKARI.filter(i => my.has(i));
    const noRain = hikHave.filter(i => i !== TAG.ame).length;
    const hikFree = HIKARI.filter(i => !my.has(i) && !op.has(i));
    res.push({ id: 'hikari', name: '光', pts: 5, have: hikHave.length, need: hikHave.length >= 3 ? hikHave.length + 1 : 3,
        done: noRain >= 3 || hikHave.length >= 4, possible: hikHave.length + hikFree.length >= 3 &&
            (noRain + hikFree.filter(i => i !== TAG.ame).length >= 3 || hikHave.length + hikFree.length >= 4),
        missing: hikFree });
    if (rules.hanami) {
        setYaku('hanami', [TAG.maku, TAG.sake]);
        setYaku('tsukimi', [TAG.tsuki, TAG.sake]);
    }
    setYaku('inoshikacho', INOSHIKACHO);
    setYaku('akatan', AKATAN);
    setYaku('aotan', AOTAN);
    for (const y of YAKU_DEFS.filter(y => y.kind)) {
        const all = CARDS.filter(c => y.kind === 'kasu' ? countsAsKasu(c.id, rules) : c.k === y.kind).map(c => c.id);
        const have = all.filter(i => my.has(i)).length;
        const free = all.filter(i => !my.has(i) && !op.has(i));
        res.push({ id: y.id, name: y.name, pts: 1, have, need: Math.max(y.need, have >= y.need ? have + 1 : y.need),
            done: have >= y.need, possible: have + free.length >= y.need, missing: free });
    }
    return res;
}

/* ── 手役（配ったときの 手札で きまる 役） ─────────────── */

export function teyakuOf(hand) {
    const cnt = {};
    for (const id of hand) cnt[monthOf(id)] = (cnt[monthOf(id)] || 0) + 1;
    const vals = Object.values(cnt);
    if (vals.some(v => v === 4)) return { id: 'teshi', name: '手四', pts: TEYAKU_POINTS,
        desc: '配られた 手札に 同じ 月の 札が 4枚' };
    if (vals.length === 4 && vals.every(v => v === 2)) return { id: 'kuttsuki', name: 'くっつき', pts: TEYAKU_POINTS,
        desc: '配られた 手札が 同じ 月の 2枚ずつ 4組' };
    return null;
}

/* ── ゲームの 状態 ──────────────────────────────── */

/**
 * あたらしい ゲーム。
 * rules：ルール / seed：乱数の 種（文字列） / firstDealer：さいしょの 親（0か1。なければ 種で きめる）
 */
export function newGame(rules, seed, firstDealer) {
    const r = { ...DEFAULT_RULES, ...rules };
    const s = {
        rules: r, seed: String(seed),
        round: 0, scores: [0, 0],
        dealer: firstDealer === 0 || firstDealer === 1 ? firstDealer : (makeRng(seed + ':oya')() < 0.5 ? 0 : 1),
        history: [], phase: 'idle',
        deck: [], hands: [[], []], field: [], caps: [[], []],
        turn: 0, koi: [0, 0], lastPts: [0, 0], pending: null, ready: [false, false], result: null,
        moves: 0
    };
    const events = [];
    startRound(s, events);
    return { state: s, events };
}

export function clone(s) {
    return {
        ...s,
        scores: s.scores.slice(), deck: s.deck.slice(),
        hands: [s.hands[0].slice(), s.hands[1].slice()], field: s.field.slice(),
        caps: [s.caps[0].slice(), s.caps[1].slice()],
        koi: s.koi.slice(), lastPts: s.lastPts.slice(), ready: s.ready.slice()
    };
}

function startRound(s, events) {
    s.round += 1;
    let tries = 0, deck;
    for (;;) {
        deck = shuffle(CARDS.map(c => c.id), makeRng(`${s.seed}:${s.round}:${tries}`));
        const field = deck.slice(16, 24);
        const cnt = {};
        for (const id of field) cnt[monthOf(id)] = (cnt[monthOf(id)] || 0) + 1;
        if (!Object.values(cnt).some(v => v === 4)) break;   // 場に 同じ 月が 4枚 → 配りなおし
        tries++;
    }
    const d = s.dealer, o = 1 - d;
    s.hands = [[], []];
    s.hands[d] = deck.slice(0, 8);
    s.hands[o] = deck.slice(8, 16);
    s.field = deck.slice(16, 24);
    s.deck = deck.slice(24);
    s.caps = [[], []];
    s.turn = d;
    s.koi = [0, 0];
    s.lastPts = [0, 0];
    s.pending = null;
    s.ready = [false, false];
    s.result = null;
    s.phase = 'play';
    events.push({ type: 'deal', round: s.round, dealer: d, redeals: tries });

    if (s.rules.teyaku) {
        for (const p of [d, o]) {
            const t = teyakuOf(s.hands[p]);
            if (t) {
                events.push({ type: 'teyaku', p, teyaku: t });
                finishRound(s, p, events, t);
                return;
            }
        }
    }
}

const matchesOf = (s, card) => s.field.filter(f => monthOf(f) === monthOf(card));

/* 札を 場に おく（同じ 月が あれば とる）。from は 'hand' か 'deck' */
function place(s, p, card, target, from, events) {
    const m = matchesOf(s, card);
    if (m.length === 0) {
        s.field.push(card);
        events.push({ type: 'place', p, card, from, onto: null });
        return;
    }
    let taken;
    if (m.length === 2) {
        if (!m.includes(target)) throw new Error('とる 札を えらんでください');
        taken = [target];
    } else {
        taken = m;          // 1枚 または 3枚（3枚なら ぜんぶ とれる）
    }
    events.push({ type: 'place', p, card, from, onto: taken[0] });
    s.field = s.field.filter(f => !taken.includes(f));
    s.caps[p].push(card, ...taken);
    events.push({ type: 'capture', p, cards: [card, ...taken] });
}

function drawStep(s, p, events) {
    const card = s.deck.shift();
    events.push({ type: 'flip', p, card });
    const m = matchesOf(s, card);
    if (m.length === 2) {
        s.phase = 'pick';
        s.pending = card;
        events.push({ type: 'needPick', p, card, options: m });
        return;
    }
    place(s, p, card, null, 'deck', events);
    endTurn(s, p, events);
}

function endTurn(s, p, events) {
    const list = calcYaku(s.caps[p], s.rules);
    const pts = sumYaku(list);
    if (pts > s.lastPts[p]) {
        events.push({ type: 'yaku', p, yaku: list, pts, prev: s.lastPts[p] });
        if (s.hands[p].length === 0) {
            finishRound(s, p, events);     // もう 出す 札が ないので そのまま あがり
        } else {
            s.phase = 'decide';
        }
        return;
    }
    nextTurn(s, p, events);
}

function nextTurn(s, p, events) {
    if (s.hands[0].length === 0 && s.hands[1].length === 0) {
        finishRound(s, null, events);
        return;
    }
    s.turn = 1 - p;
    s.phase = 'play';
    events.push({ type: 'turn', p: s.turn });
}

/** 局の 点数を けいさんします（あがった 人 p、手役なら teyaku） */
export function roundPoints(s, p, teyaku) {
    if (teyaku) return { base: teyaku.pts, mult: 1, total: teyaku.pts, yaku: [teyaku], reasons: [] };
    const yaku = calcYaku(s.caps[p], s.rules);
    const base = sumYaku(yaku);
    let mult = 1;
    const reasons = [];
    if (s.rules.double7 && base >= 7) { mult *= 2; reasons.push('7点以上で 2倍'); }
    if (s.rules.koiBonus === 'opponent' && s.koi[1 - p] > 0) { mult *= 2; reasons.push('あいての こいこいを 返して 2倍'); }
    if (s.rules.koiBonus === 'self' && s.koi[p] > 0) {
        mult *= s.koi[p] + 1;
        reasons.push(`こいこい ${s.koi[p]}回で ${s.koi[p] + 1}倍`);
    }
    return { base, mult, total: base * mult, yaku, reasons };
}

function finishRound(s, winner, events, teyaku) {
    let result;
    if (winner === null) {
        result = { round: s.round, winner: null, total: 0, base: 0, mult: 1, yaku: [], reasons: [], dealer: s.dealer };
    } else {
        result = { round: s.round, winner, dealer: s.dealer, teyaku: !!teyaku, ...roundPoints(s, winner, teyaku) };
        s.scores[winner] += result.total;
        s.dealer = winner;        // 勝った 人が つぎの 親
    }
    s.result = result;
    s.history = s.history.concat([result]);
    s.phase = 'roundEnd';
    s.ready = [false, false];
    events.push({ type: 'roundEnd', result });
}

/** その 場面で できる 手の 一覧 */
export function legalActions(s, p = s.turn) {
    const acts = [];
    if (s.phase === 'play' && p === s.turn) {
        for (const card of s.hands[p]) {
            const m = matchesOf(s, card);
            if (m.length === 2) for (const t of m) acts.push({ t: 'play', p, card, target: t });
            else acts.push({ t: 'play', p, card });
        }
    } else if (s.phase === 'pick' && p === s.turn) {
        for (const t of matchesOf(s, s.pending)) acts.push({ t: 'pick', p, target: t });
    } else if (s.phase === 'decide' && p === s.turn) {
        acts.push({ t: 'koikoi', p }, { t: 'stop', p });
    } else if (s.phase === 'roundEnd' && !s.ready[p]) {
        acts.push({ t: 'ready', p });
    }
    return acts;
}

/** 手を すすめます。まちがった 手なら Error を なげます（state は かわりません）。 */
export function applyAction(s, a) {
    const events = [];
    const p = a.p;
    if (p !== 0 && p !== 1) throw new Error('だれの 手か わかりません');
    switch (a.t) {
        case 'play': {
            if (s.phase !== 'play' || s.turn !== p) throw new Error('いまは 出せません');
            if (!s.hands[p].includes(a.card)) throw new Error('その 札は 手札に ありません');
            const m = matchesOf(s, a.card);
            if (m.length === 2 && !m.includes(a.target)) throw new Error('とる 札を えらんでください');
            s.hands[p] = s.hands[p].filter(c => c !== a.card);
            place(s, p, a.card, a.target, 'hand', events);
            drawStep(s, p, events);
            break;
        }
        case 'pick': {
            if (s.phase !== 'pick' || s.turn !== p) throw new Error('いまは えらべません');
            const m = matchesOf(s, s.pending);
            if (!m.includes(a.target)) throw new Error('その 札は とれません');
            const card = s.pending;
            s.pending = null;
            s.phase = 'play';
            place(s, p, card, a.target, 'deck', events);
            endTurn(s, p, events);
            break;
        }
        case 'koikoi': {
            if (s.phase !== 'decide' || s.turn !== p) throw new Error('いまは えらべません');
            s.koi[p] += 1;
            s.lastPts[p] = scoreOf(s.caps[p], s.rules);
            events.push({ type: 'koikoi', p, count: s.koi[p] });
            nextTurn(s, p, events);
            break;
        }
        case 'stop': {
            if (s.phase !== 'decide' || s.turn !== p) throw new Error('いまは えらべません');
            events.push({ type: 'stop', p });
            finishRound(s, p, events);
            break;
        }
        case 'ready': {
            if (s.phase !== 'roundEnd') throw new Error('まだ 局の とちゅうです');
            s.ready[p] = true;
            if (s.ready[0] && s.ready[1]) {
                if (s.round >= s.rules.rounds) {
                    s.phase = 'gameEnd';
                    events.push({ type: 'gameEnd', scores: s.scores.slice() });
                } else {
                    startRound(s, events);
                }
            }
            break;
        }
        default:
            throw new Error('しらない 手です');
    }
    s.moves += 1;
    return events;
}

/** 手札の その 札で 場の どれが とれるか */
export const fieldMatches = (s, card) => matchesOf(s, card);
