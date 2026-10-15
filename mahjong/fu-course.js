/* 符と 役を いちから おぼえる コース（点数計算 ＞ いちから）
   ------------------------------------------------------------------
   ステップごとに「せつめい」→「問題 8問」。6問 いじょう せいかいで つぎの ステップが ひらきます。
   問題は その場で つくります。手（あがりの 形）を つかう 問題の こたえは アプリの 点数エンジン
   （score.js の evaluateWin）で だし、さらに この ファイルの 「自分で 分けた 形」から 数えた 符と
   一致した ものだけを 出します（tests.js でも たしかめて います）。
   画面（DOM）は つかいません。画面は fukihon.js。
   せつめいの 中の {{…}} は 牌の 絵に なります：
     {{t:123m}} 手の 中の 牌 ／ {{pon:555p}} ポン（1枚 よこ） ／ {{chi:345s}} チー
     {{kan:5555p}} 明槓 ／ {{ankan:5555p}} 暗槓（はしを うら） ／ {{w:3m}} あがり牌（光る）
   ------------------------------------------------------------------ */
import { evaluateWin } from './score.js';
import { DEFAULT_RULES } from './engine.js';
import { isYaochu, WIND_NAMES } from './tiles.js';
import { LESSONS } from './yaku-lessons.js';

export const PASS = 6;      // 8問 中 これだけ せいかいで クリア
export const PER_STEP = 8;

const SHORT = ['一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬', '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
    '一索', '二索', '三索', '四索', '五索', '六索', '七索', '八索', '九索', '東', '南', '西', '北', '白', '發', '中'];
export const kName = k => SHORT[k];
const SUIT = 'mps';
/** 牌の 種類（0〜33）→ '5p' の ような 書き方 */
const code = k => (k < 27 ? `${k % 9 + 1}${SUIT[Math.floor(k / 9)]}` : `${k - 26}z`);
const codes = ks => ks.map(code).join(' ');

const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const isValuePair = (k, seat, round) => k >= 31 || k === 27 + seat || k === 27 + round;
const yaochuWord = k => (isYaochu(k) ? '么九牌' : '中張牌');

/** こたえ ＋ ほかの 選択肢（かさならない ように） */
function choicesOf(answer, pool, rng, n = 4) {
    const others = shuffle(pool.filter(x => x !== answer), rng).slice(0, n - 1);
    const out = [answer, ...others];
    // 数の 選択肢は 小さい じゅん（えらびやすい）
    if (out.every(x => /^\+?\d+符?$/.test(x))) return out.sort((a, b) => parseInt(a.replace('+', '')) - parseInt(b.replace('+', '')));
    return shuffle(out, rng);
}

/* ── 刻子・槓子の 符（エンジンと 同じ きまり。tests.js で エンジンと くらべて います） ── */
export function setFu(k, { open = false, kan = false } = {}) {
    let f = 2;
    if (isYaochu(k)) f *= 2;
    if (!open) f *= 2;
    if (kan) f *= 4;
    return f;
}
export function pairFu(k, seat, round) {
    return (k >= 31 ? 2 : 0) + (k === 27 + seat ? 2 : 0) + (k === 27 + round ? 2 : 0);
}

/* ────────────────────────────────────────────────
   あがりの 手を つくる（分けた 形 → id → エンジンで 点数）
   ──────────────────────────────────────────────── */

/**
 * o.wait    'ryanmen'|'kanchan'|'penchan'|'tanki'|'shanpon'|null（null は ランダム）
 * o.tsumo   true/false/null
 * o.open    鳴いた 面子の 数（0〜2）
 * o.kan     槓子に する 確率
 * o.trips   刻子に する 確率（ほかの 面子）
 * o.pinfu   平和の 形に する
 * o.simples 2〜8 だけ（喰いタンで 役を つける）
 * o.honors  字牌を つかう 確率
 */
export function makeHand(rng, o = {}) {
    for (let tries = 0; tries < 400; tries++) {
        const h = tryHand(rng, o);
        if (h) return h;
    }
    return null;
}

function tryHand(rng, o) {
    const cnt = new Array(34).fill(0);
    const add = (k, n) => { cnt[k] += n; };
    const seat = Math.floor(rng() * 4), round = rng() < 0.6 ? 0 : 1;
    const tsumo = o.tsumo ?? rng() < 0.4;
    const wait = o.pinfu ? 'ryanmen' : (o.wait || pick(rng, ['ryanmen', 'ryanmen', 'kanchan', 'penchan', 'tanki', 'shanpon']));
    const numK = (lo = 1, hi = 9) => Math.floor(rng() * 3) * 9 + lo - 1 + Math.floor(rng() * (hi - lo + 1));
    const anyK = () => (!o.simples && !o.pinfu && rng() < (o.honors ?? 0.3) ? 27 + Math.floor(rng() * 7) : (o.simples ? numK(2, 8) : numK()));
    const sets = [];
    let pair = null, winK, winSet = -1;

    // あがりの 形
    if (wait === 'ryanmen') {
        const s = Math.floor(rng() * 3) * 9;
        const a = o.simples ? 3 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 6);   // 待ちの 2枚の 小さい ほう（2〜7）
        const low = rng() < 0.5;
        winK = s + (low ? a - 2 : a + 1);
        if (o.simples && (winK % 9 === 0 || winK % 9 === 8)) return null;
        sets.push({ type: 'seq', k: s + (low ? a - 2 : a - 1), open: false });
    } else if (wait === 'kanchan') {
        const st = o.simples ? numK(2, 6) : numK(1, 7);
        winK = st + 1;
        sets.push({ type: 'seq', k: st, open: false });
    } else if (wait === 'penchan') {
        if (o.simples) return null;
        const s = Math.floor(rng() * 3) * 9;
        const lowSide = rng() < 0.5;
        sets.push({ type: 'seq', k: s + (lowSide ? 0 : 6), open: false });
        winK = s + (lowSide ? 2 : 6);
    } else if (wait === 'tanki') {
        pair = anyK(); winK = pair;
    } else {   // shanpon
        winK = anyK();
        sets.push({ type: 'trip', k: winK, open: false, ron: !tsumo });   // ロンなら 符は 明刻（門前は そのまま）
    }
    if (sets.length) winSet = 0;

    // のこりの 面子
    const nOpen = o.pinfu ? 0 : (o.open || 0);
    while (sets.length < 4) {
        const trip = !o.pinfu && rng() < (o.trips ?? 0.35);
        if (trip) {
            const k = anyK();
            const kan = rng() < (o.kan || 0);
            sets.push({ type: kan ? 'kan' : 'trip', k, open: false });
        } else {
            const st = o.simples ? numK(2, 6) : numK(1, 7);
            sets.push({ type: 'seq', k: st, open: false });
        }
    }
    // 鳴いた 面子（あがりの 面子 いがい）
    const others = shuffle([1, 2, 3], rng);
    for (let i = 0; i < nOpen; i++) sets[others[i]].open = true;
    if (pair === null) {
        for (let i = 0; i < 20 && pair === null; i++) {
            const k = anyK();
            if (o.pinfu && isValuePair(k, seat, round)) continue;
            pair = k;
        }
        if (pair === null) return null;
    }
    for (const s of sets) {
        if (s.type === 'seq') { add(s.k, 1); add(s.k + 1, 1); add(s.k + 2, 1); } else add(s.k, s.type === 'kan' ? 4 : 3);
    }
    add(pair, 2);
    if (cnt.some(c => c > 4)) return null;
    if (o.simples && cnt.some((c, k) => c && (k >= 27 || k % 9 === 0 || k % 9 === 8))) return null;

    // id を わりあてる（赤5は 4枚目 だけ → 符には 関係なし）
    const nextId = new Array(34).fill(0);
    const ORDER = [1, 2, 3, 0];
    const idOf = k => k * 4 + ORDER[nextId[k]++];
    const closed = [], melds = [], groups = [];
    let winTile = null;
    sets.forEach((s, i) => {
        const ks = s.type === 'seq' ? [s.k, s.k + 1, s.k + 2] : new Array(s.type === 'kan' ? 4 : 3).fill(s.k);
        const ids = ks.map(idOf);
        let w = -1;
        if (i === winSet) { w = ks.indexOf(winK); winTile = ids[w]; }
        if (s.type === 'kan') {
            if (s.open) melds.push({ type: 'minkan', tiles: ids, called: ids[0], from: (seat + 3) % 4 });
            else melds.push({ type: 'ankan', tiles: ids, from: seat });
        } else if (s.open) {
            melds.push({ type: s.type === 'seq' ? 'chi' : 'pon', tiles: ids, called: ids[0], from: (seat + 3) % 4 });
        } else closed.push(...ids);
        groups.push({ ids, kind: s.type === 'kan' ? (s.open ? 'minkan' : 'ankan') : s.open ? (s.type === 'seq' ? 'chi' : 'pon') : 'closed', win: w });
    });
    const pIds = [idOf(pair), idOf(pair)];
    closed.push(...pIds);
    groups.push({ ids: pIds, kind: 'pair', win: pair === winK && wait === 'tanki' ? 0 : -1 });
    if (wait === 'tanki') winTile = pIds[0];

    const menzen = melds.every(m => m.type === 'ankan');
    const ctx = {
        closed, melds, winTile, tsumo, seatWind: seat, roundWind: round,
        riichi: menzen, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
        tenhou: false, chiihou: false, doraInd: [], uraInd: [], rules: DEFAULT_RULES
    };
    const r = evaluateWin(ctx);
    if (!r || r.yakuman || !r.fuParts) return null;
    const mine = countFu({ sets, pair, wait, tsumo, seat, round });
    // エンジンが ちがう 分け方を えらんだ 手は つかわない（せつめいと 絵が くいちがう ため）
    if (r.fu !== mine.fu || (r.fuParts.raw ?? r.fu) !== mine.raw) return null;
    if (!mine.pinfu && (r.wait || null) !== wait) return null;
    if (o.pinfu && !mine.pinfu) return null;
    return { ctx, result: r, mine, groups, sets, pair, wait, winK, tsumo, seat, round, menzen };
}

/** 分けた 形から 符を 数える（エンジンとは べつに 書いた もの） */
export function countFu({ sets, pair, wait, tsumo, seat, round }) {
    const menzen = sets.every(s => !s.open);
    const pinfu = menzen && sets.every(s => s.type === 'seq') && !isValuePair(pair, seat, round) && wait === 'ryanmen';
    if (pinfu) return { pinfu, fu: tsumo ? 20 : 30, raw: tsumo ? 20 : 30 };
    let raw = 20 + (menzen && !tsumo ? 10 : 0) + (tsumo ? 2 : 0);
    for (const s of sets) if (s.type !== 'seq') raw += setFu(s.k, { open: s.open || !!s.ron, kan: s.type === 'kan' });
    raw += pairFu(pair, seat, round);
    if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') raw += 2;
    let fu = Math.ceil(raw / 10) * 10;
    if (fu === 20) fu = 30;
    return { pinfu, fu, raw };
}

/** 七対子 */
export function makeChiitoi(rng) {
    for (let t = 0; t < 100; t++) {
        const ks = new Set();
        while (ks.size < 7) ks.add(rng() < 0.25 ? 27 + Math.floor(rng() * 7) : Math.floor(rng() * 27));
        const list = [...ks].sort((a, b) => a - b);
        const closed = list.flatMap(k => [k * 4 + 1, k * 4 + 2]);
        const winTile = pick(rng, closed);
        const tsumo = rng() < 0.4;
        const ctx = {
            closed, melds: [], winTile, tsumo, seatWind: Math.floor(rng() * 4), roundWind: 0,
            riichi: true, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
            tenhou: false, chiihou: false, doraInd: [], uraInd: [], rules: DEFAULT_RULES
        };
        const r = evaluateWin(ctx);
        if (r && !r.yakuman && r.fu === 25) {
            return { ctx, result: r, groups: list.map(k => ({ ids: [k * 4 + 1, k * 4 + 2], kind: 'pair', win: kindOfId(winTile) === k ? (winTile === k * 4 + 1 ? 0 : 1) : -1 })), tsumo, seat: ctx.seatWind, round: 0, chiitoi: true };
        }
    }
    return null;
}
const kindOfId = id => id >> 2;

/* ────────────────────────────────────────────────
   問題の かたち（画面は fukihon.js）
   { ask, chips:[…], show:[{ tiles:'5p 5p 5p', kind:'pon'|'closed'|…, label, win:i }] | hand, choices, answer, explain }
   ──────────────────────────────────────────────── */

const g = (kind, ks, label = '', win = -1) => ({ kind, tiles: ks, label, win });

/* ステップ 1：役と 翻 */
const YAKU_POOL = LESSONS.filter(l => ['1翻', '2翻', '3翻', '6翻'].includes(l.group) && !['ippatsu', 'rinshan', 'chankan', 'haitei', 'houtei', 'wriichi', 'sankantsu', 'doukou', 'honroutou'].includes(l.id));
const CONCEPTS = [
    { ask: 'あがるために ぜったいに ひつような ものは？', answer: '役が 1つ いじょう', pool: ['役が 1つ いじょう', 'ドラが 1枚 いじょう', '赤ドラ', '符が 30 いじょう'], explain: 'あがるには 役が 1つ いじょう ひつようです。ドラ・赤ドラは 役では ありません（あがった ときに 翻が ふえる おまけ）。' },
    { ask: 'ドラを 3枚 もって いるけど、役は ない。あがれる？', answer: 'あがれない', pool: ['あがれない', 'あがれる', 'ツモなら あがれる'], explain: 'ドラは 役では ないので、ドラが 何枚 あっても 役が なければ あがれません。' },
    { ask: 'ドラ 1枚は 何翻？', answer: '1翻', pool: ['1翻', '2翻', '0翻'], explain: 'ドラ・赤ドラ・裏ドラは 1枚 1翻。役の 翻に たします。' },
    { ask: '翻が 1つ ふえると、点数は だいたい どうなる？', answer: 'だいたい 2倍', pool: ['だいたい 2倍', '1000点 ふえる', 'かわらない', '半分'], explain: '点数の もとは「符 × 2の（翻＋2）乗」。翻が 1つ ふえると 2倍に なります（満貫で 止まるまで）。' },
    { ask: 'ポンや チーを すると つかなく なる 役は？', answer: '立直（リーチ）', pool: ['立直（リーチ）', '断么九（タンヤオ）', '役牌', '対々和（トイトイ）'], explain: 'リーチ・平和・一盃口・門前ツモ などは「門前（鳴いて いない）」だけの 役です。タンヤオ・役牌・トイトイは 鳴いても つきます。' },
    { ask: '翻と 符、点数に 符が かかわるのは？', answer: '4翻 まで', pool: ['4翻 まで', '5翻 いじょう', 'いつも かかわらない'], explain: '5翻 いじょう（満貫・跳満…）は 符に 関係なく 点数が きまります。符を 数えるのは 4翻 までの とき。' },
    { ask: '「門前（メンゼン）」って どういう こと？', answer: 'ポン・チー・明槓を して いない', pool: ['ポン・チー・明槓を して いない', 'リーチを して いる', 'ツモで あがった', '字牌が ない'], explain: '門前は 人の 捨て牌で 面子を つくって いない（ポン・チー・明槓 なし）こと。自分で 4枚 そろえた 暗槓は 門前の まま です。' }
];
function genYaku(rng, i) {
    if (i % 3 === 2) {
        const c = CONCEPTS[Math.floor(rng() * CONCEPTS.length)];
        return { ask: c.ask, choices: choicesOf(c.answer, c.pool, rng), answer: c.answer, explain: c.explain, key: 'c' + c.ask };
    }
    const l = pick(rng, YAKU_POOL);
    return {
        ask: `「${l.name}（${l.reading}）」は 鳴いて いない とき 何翻？`,
        choices: choicesOf(l.han, ['1翻', '2翻', '3翻', '6翻'], rng), answer: l.han,
        explain: `${l.name}（${l.reading}）は ${l.han}。${l.tag ? `【${l.tag}】` : ''}くわしい 形は「役を おぼえる」で 見られます。`, key: 'y' + l.id
    };
}

/* ステップ 2：副底と あがりかた */
function genFutei(rng, i) {
    const t = i % 4;
    if (t === 0 && rng() < 0.5) return { ask: 'あがったら まず だれでも もらえる 符（副底）は 何符？', choices: choicesOf('20符', ['0符', '10符', '20符', '30符'], rng), answer: '20符', explain: '副底（ふうてい）は 20符。どんな あがりでも ここから スタートします。', key: 'futei' };
    if (t === 1) {
        const menzen = rng() < 0.5, tsumo = rng() < 0.5;
        const add = tsumo ? '+2' : menzen ? '+10' : '+0';
        return {
            ask: `${menzen ? '門前（鳴いて いない）' : '鳴いた 手'}で ${tsumo ? 'ツモ' : 'ロン'}。あがりかたで 足す 符は？`,
            chips: [menzen ? '門前' : '鳴いた 手', tsumo ? 'ツモ' : 'ロン'],
            choices: choicesOf(add, ['+0', '+2', '+10', '+20'], rng), answer: add,
            explain: tsumo ? 'ツモは ＋2符（門前でも 鳴いて いても 同じ）。' : menzen ? '門前で ロンは ＋10符（門前加符）。' : '鳴いた 手の ロンは ＋0符。',
            key: `add${menzen}${tsumo}`
        };
    }
    const menzen = rng() < 0.5, tsumo = rng() < 0.5;
    const v = 20 + (tsumo ? 2 : menzen ? 10 : 0);
    return {
        ask: `${menzen ? '門前' : '鳴いた 手'}で ${tsumo ? 'ツモ' : 'ロン'}。ほかに 符が ない とき、副底と あがりかたで 何符？（切り上げる まえ）`,
        chips: [menzen ? '門前' : '鳴いた 手', tsumo ? 'ツモ' : 'ロン'],
        choices: choicesOf(`${v}符`, ['20符', '22符', '30符', '32符'], rng), answer: `${v}符`,
        explain: `副底 20符 ${tsumo ? '＋ ツモ 2符' : menzen ? '＋ 門前ロン 10符' : '（鳴いて ロンは ＋0）'} ＝ ${v}符。`,
        key: `sum${menzen}${tsumo}`
    };
}

/* ステップ 3：牌の なかま */
function genNakama(rng, i) {
    if (i % 4 === 3) {
        const k = 27 + Math.floor(rng() * 7);
        const ans = k >= 31 ? '三元牌' : '風牌';
        return { ask: 'この 字牌は 三元牌？ 風牌？', show: [g('closed', [k])], choices: choicesOf(ans, ['三元牌', '風牌'], rng, 2), answer: ans, explain: `${kName(k)}は ${ans}。三元牌は 白・發・中、風牌は 東・南・西・北。`, key: 'h' + k };
    }
    const k = rng() < 0.5 ? pick(rng, [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]) : pick(rng, [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25]);
    const ans = yaochuWord(k);
    return {
        ask: 'この 牌は 中張牌（チュンチャンパイ）？ 么九牌（ヤオチューパイ）？', show: [g('closed', [k])],
        choices: ['中張牌', '么九牌'], answer: ans,
        explain: k >= 27 ? `${kName(k)}は 字牌 → 么九牌。` : (isYaochu(k) ? `${kName(k)}は 1か9 → 么九牌。` : `${kName(k)}は 2〜8 → 中張牌。`), key: 'n' + k
    };
}

/* ステップ 4：刻子 */
function genKotsu(rng, i) {
    const k = rng() < 0.5 ? pick(rng, [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]) : Math.floor(rng() * 27);
    const r = rng();
    if (r < 0.15 && k < 27 && k % 9 < 7) {
        const st = k - (k % 9 > 6 ? 2 : 0);
        const chi = rng() < 0.5;
        return {
            ask: 'この 面子は 何符？', show: [g(chi ? 'chi' : 'closed', [st, st + 1, st + 2], chi ? 'チーした' : '手の 中')],
            choices: choicesOf('0符', ['0符', '2符', '4符', '8符'], rng), answer: '0符', explain: '順子（123 の ような ならび）は 0符。鳴いても 鳴かなくても 0符です。', key: 's' + st + chi
        };
    }
    const open = r < 0.55;
    const f = setFu(k, { open });
    return {
        ask: 'この 刻子は 何符？', show: [g(open ? 'pon' : 'closed', [k, k, k], open ? 'ポンした' : '手の 中')],
        choices: choicesOf(`${f}符`, ['0符', '2符', '4符', '8符'], rng), answer: `${f}符`,
        explain: `${open ? '明刻（ポン）' : '暗刻（手の 中）'} × ${yaochuWord(k)}（${kName(k)}）→ 2符${isYaochu(k) ? ' ×2（么九）' : ''}${open ? '' : ' ×2（暗刻）'} ＝ ${f}符。`,
        key: `k${k}${open}`
    };
}

/* ステップ 5：槓子 */
function genKantsu(rng, i) {
    const k = rng() < 0.5 ? pick(rng, [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]) : Math.floor(rng() * 27);
    if (i % 4 === 3) {   // 刻子も まぜる
        const open = rng() < 0.5;
        const f = setFu(k, { open });
        return { ask: 'これは 刻子（3枚）。何符？', show: [g(open ? 'pon' : 'closed', [k, k, k], open ? 'ポンした' : '手の 中')], choices: choicesOf(`${f}符`, ['2符', '4符', '8符', '16符'], rng), answer: `${f}符`, explain: `${open ? '明刻' : '暗刻'} × ${yaochuWord(k)} ＝ ${f}符（カンでは ないので ×4 しない）。`, key: `k${k}${open}` };
    }
    const type = pick(rng, ['minkan', 'ankan', 'ankan', 'kakan']);
    const open = type !== 'ankan';
    const f = setFu(k, { open, kan: true });
    const label = { minkan: '人の 牌で カン（明槓）', ankan: '自分で 4枚（暗槓）', kakan: 'ポンに 1枚 たした（加槓）' }[type];
    return {
        ask: 'この 槓子は 何符？', show: [g(type === 'ankan' ? 'ankan' : 'minkan', [k, k, k, k], label)],
        choices: choicesOf(`${f}符`, ['4符', '8符', '16符', '32符'], rng), answer: `${f}符`,
        explain: `${type === 'kakan' ? '加槓は 明槓と 同じ。' : ''}3枚の ${open ? '明刻' : '暗刻'}なら ${setFu(k, { open })}符（${yaochuWord(k)}）→ カンは その ×4 ＝ ${f}符。`,
        key: `q${k}${type}`
    };
}

/* ステップ 6：雀頭 */
function genAtama(rng, i) {
    const seat = Math.floor(rng() * 4), round = rng() < 0.6 ? 0 : 1;
    const r = rng();
    const otherWinds = [0, 1, 2, 3].filter(w => w !== seat && w !== round);
    const k = r < 0.15 ? Math.floor(rng() * 27)
        : r < 0.4 ? 31 + Math.floor(rng() * 3)
            : r < 0.6 ? 27 + seat
                : r < 0.8 ? 27 + round
                    : 27 + pick(rng, otherWinds.length ? otherWinds : [0, 1, 2, 3]);
    const f = pairFu(k, seat, round);
    const why = [];
    if (k >= 31) why.push('三元牌');
    if (k === 27 + seat) why.push('自風');
    if (k === 27 + round) why.push('場風');
    return {
        ask: 'この 雀頭（あたま）は 何符？', show: [g('closed', [k, k], '雀頭')],
        chips: [`場風 ${WIND_NAMES[round]}`, `自風 ${WIND_NAMES[seat]}`],
        choices: choicesOf(`${f}符`, ['0符', '2符', '4符'], rng, 3), answer: `${f}符`,
        explain: why.length === 2 ? `${kName(k)}は 場風で 自風（連風牌）→ 2＋2 ＝ 4符。` : why.length ? `${kName(k)}は ${why[0]} → 2符。` : (k >= 27 ? `${kName(k)}は 場風でも 自風でも ない 風（客風牌）→ 0符。` : '数牌の 雀頭は 0符。'),
        key: `a${k}${seat}${round}`
    };
}

/* ステップ 7：待ち */
const WAITS = { ryanmen: '両面（0符）', kanchan: '嵌張（2符）', penchan: '辺張（2符）', tanki: '単騎（2符）', shanpon: 'シャンポン（0符）' };
function genMachi(rng, i) {
    if (i % 4 === 3) {   // シャンポンの 刻子
        const k = rng() < 0.5 ? Math.floor(rng() * 27) : 27 + Math.floor(rng() * 7);
        const tsumo = rng() < 0.5;
        const f = setFu(k, { open: !tsumo });
        const y = k === 4 ? 13 : 4;
        return {
            ask: `シャンポン待ちを ${tsumo ? 'ツモ' : 'ロン'}で あがった。できた 刻子（${kName(k)}）は 何符？`,
            show: [g('closed', [k, k, y, y], '待ちの 形'), g('win', [k], tsumo ? 'ツモ' : 'ロン', 0)], chips: [tsumo ? 'ツモ' : 'ロン'],
            choices: choicesOf(`${f}符`, ['2符', '4符', '8符', '16符'], rng), answer: `${f}符`,
            explain: `シャンポン待ちを ${tsumo ? 'ツモ → 暗刻' : 'ロン → 人の 牌で できたので 明刻'} あつかい。${yaochuWord(k)}なので ${f}符。`,
            key: `sp${k}${tsumo}`
        };
    }
    const w = pick(rng, ['ryanmen', 'kanchan', 'penchan', 'tanki', 'shanpon']);
    const s = Math.floor(rng() * 3) * 9;
    let shape, win;
    if (w === 'ryanmen') { const a = 2 + Math.floor(rng() * 6); shape = [s + a - 1, s + a]; win = rng() < 0.5 ? s + a - 2 : s + a + 1; }
    else if (w === 'kanchan') { const a = Math.floor(rng() * 7); shape = [s + a, s + a + 2]; win = s + a + 1; }
    else if (w === 'penchan') { const lo = rng() < 0.5; shape = lo ? [s, s + 1] : [s + 7, s + 8]; win = lo ? s + 2 : s + 6; }
    else if (w === 'tanki') { const k = rng() < 0.4 ? 27 + Math.floor(rng() * 7) : s + Math.floor(rng() * 9); shape = [k]; win = k; }
    else { const a = s + Math.floor(rng() * 9), b = 27 + Math.floor(rng() * 7); shape = [a, a, b, b]; win = rng() < 0.5 ? a : b; }
    const ans = WAITS[w];
    const pool = Object.values(WAITS);
    const desc = {
        ryanmen: `${codes(shape).replace(/ /g, '')} の 両がわ どちらでも あがれる → 両面。0符。`,
        kanchan: 'まん中の 1枚を まつ → 嵌張（カンチャン）。2符。',
        penchan: '12 の 3、89 の 7 だけを まつ → 辺張（ペンチャン）。2符。',
        tanki: '1枚だけで あたまを まつ → 単騎（タンキ）。2符。',
        shanpon: '2つの 対子の どちらかが 刻子に なる → シャンポン。0符（できた 刻子の 符は べつに 数える）。'
    }[w];
    return {
        ask: 'この 待ちは なに？ 何符？', show: [g('closed', shape, '待ちの 形'), g('win', [win], 'で あがり', 0)],
        choices: choicesOf(ans, pool, rng, 4), answer: ans, explain: desc, key: `w${w}${shape.join(',')}${win}`
    };
}

/* ステップ 8：ぜんぶ たして 切り上げ */
function partsList(r) {
    return r.fuParts.map(([name, v]) => ({ name, v }));
}
function genKiriage(rng, i) {
    if (i % 3 === 0) {
        const raw = 22 + 2 * Math.floor(rng() * 20);
        if (raw % 10 === 0) return genKiriage(rng, i);
        const fu = Math.ceil(raw / 10) * 10;
        return { ask: `ぜんぶ たしたら ${raw}符。さいごは 何符？`, choices: choicesOf(`${fu}符`, [`${fu - 10}符`, `${fu}符`, `${fu + 10}符`, `${raw}符`], rng), answer: `${fu}符`, explain: `1の位を 切り上げます（四捨五入では ない）。${raw}符 → ${fu}符。`, key: 'r' + raw };
    }
    const h = makeHand(rng, { open: rng() < 0.3 ? 1 : 0, kan: 0.15, trips: 0.45 });
    if (!h || h.mine.pinfu || (h.result.fuParts.raw ?? 0) <= 20) return genKiriage(rng, i + 1);
    const fu = h.result.fu, raw = h.result.fuParts.raw;
    return {
        ask: '符の 内わけが こう なった。さいごは 何符？', parts: partsList(h.result),
        choices: choicesOf(`${fu}符`, [`${fu - 10}符`, `${fu}符`, `${fu + 10}符`, `${fu + 20}符`].filter(x => parseInt(x) >= 20), rng), answer: `${fu}符`,
        explain: `ぜんぶ たすと ${raw}符 → 1の位を 切り上げて ${fu}符。`, key: 'p' + h.result.fuParts.map(x => x[1]).join(',')
    };
}

/* ステップ 9：とくべつな 形 */
function genTokubetsu(rng, i) {
    const t = i % 4;
    let h, ask, explain;
    if (t === 0) { h = makeHand(rng, { pinfu: true, tsumo: true }); explain = '平和（順子だけ・あたまに 符なし・両面待ち）の ツモは 20符 きまり（ツモの 2符も つけない）。'; }
    else if (t === 1) { h = makeHand(rng, { pinfu: true, tsumo: false }); explain = '平和の ロンは 30符 きまり（副底20 ＋ 門前ロン10）。'; }
    else if (t === 2) { h = makeChiitoi(rng); explain = '七対子（あたま 7つ）は いつでも 25符 きまり。切り上げも しません。'; }
    else { h = makeHand(rng, { simples: true, open: 1 + Math.floor(rng() * 2), tsumo: false, wait: 'ryanmen', trips: 0 }); explain = '鳴いた 手で 符が 副底の 20符 だけの ときは 30符に します。'; }
    if (!h) return genTokubetsu(rng, i + 1);
    ask = 'この あがりは 何符？';
    const fu = h.result.fu;
    return { ask, hand: h, chips: [h.menzen === false ? '鳴いた 手' : '門前', h.tsumo ? 'ツモ' : 'ロン'], choices: choicesOf(`${fu}符`, ['20符', '25符', '30符', '40符'], rng), answer: `${fu}符`, explain, parts: partsList(h.result), key: 't' + t + h.ctx.closed.join(',') };
}

/* ステップ 10・11：手を 見て 数える */
function fullHandQ(h, grouped, rng) {
    const fu = h.result.fu;
    const near = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110].filter(x => x !== fu && x !== 25).sort((a, b) => Math.abs(a - fu) - Math.abs(b - fu)).slice(0, 4);
    return {
        ask: grouped ? '面子ごとに 分けて あります。この あがりは 何符？' : 'この あがりは 何符？', hand: h, grouped,
        chips: [h.menzen ? '門前' : '鳴いた 手', h.tsumo ? 'ツモ' : 'ロン', `場風 ${WIND_NAMES[h.round]}`, `自風 ${WIND_NAMES[h.seat]}`],
        choices: choicesOf(`${fu}符`, [`${fu}符`, ...shuffle(near, rng).slice(0, 3).map(x => `${x}符`)], rng), answer: `${fu}符`,
        explain: '', parts: partsList(h.result), key: 'h' + h.ctx.closed.join(',') + '|' + h.ctx.melds.map(m => m.tiles.join(',')).join('|')
    };
}
function genEasy(rng) {
    const h = makeHand(rng, { open: 0, trips: 0.45, honors: 0.35, kan: 0 });
    return h ? fullHandQ(h, true, rng) : null;
}
function genHard(rng, i) {
    const h = makeHand(rng, { open: i % 3 === 0 ? 1 + Math.floor(rng() * 2) : 0, trips: 0.45, honors: 0.35, kan: 0.2 });
    return h ? fullHandQ(h, false, rng) : null;
}

/* ────────────────────────────────────────────────
   ステップの 一覧（せつめい ＋ 問題）
   ──────────────────────────────────────────────── */
export const STEPS = [
    {
        id: 'yaku', title: '役と 翻（はん）', sub: '点数の もとは「翻」と「符」',
        lesson: `<p>麻雀の 点数は <b>翻（はん）</b> と <b>符（ふ）</b> の 2つで きまります。</p>
<div class="fk-2"><div><b>翻</b><br>役の 強さ。<br>役の 翻を ぜんぶ たす ＋ ドラ 1枚 1翻</div><div><b>符</b><br>手の 形の こまかい 点。<br>20符・30符・40符…</div></div>
<p><b>あがるには 役が 1つ いじょう ひつよう</b>。ドラは 役では ないので ドラだけでは あがれません。</p>
<table class="fk-t"><tr><th>よく出る 役</th><th>翻</th></tr>
<tr><td>立直（リーチ）・門前ツモ・平和・断么九（タンヤオ）・役牌・一盃口</td><td>1翻</td></tr>
<tr><td>七対子・三色・一気通貫・対々和（トイトイ）・三暗刻・チャンタ</td><td>2翻</td></tr>
<tr><td>混一色（ホンイツ）・純チャン・二盃口</td><td>3翻</td></tr>
<tr><td>清一色（チンイツ）</td><td>6翻</td></tr></table>
<p>翻が 1つ ふえると 点数は だいたい <b>2倍</b>。5翻 いじょう（満貫）は 符に 関係なく きまるので、<b>符を 数えるのは 4翻 までの とき</b> です。</p>
<p class="note">役の 形は ホームの「役を おぼえる」で 動画で 見られます。</p>`,
        gen: genYaku
    },
    {
        id: 'futei', title: 'スタートは 20符', sub: '副底（ふうてい）と あがりかた',
        lesson: `<p>符は かならず <b>20符（副底・ふうてい）</b> から スタート。そこに あがりかたの 符を 足します。</p>
<table class="fk-t"><tr><th>あがりかた</th><th>足す 符</th></tr>
<tr><td><b>門前</b>（ポン・チー していない）で <b>ロン</b></td><td>＋10</td></tr>
<tr><td><b>ツモ</b>（門前でも 鳴いて いても）</td><td>＋2</td></tr>
<tr><td>鳴いた 手で ロン</td><td>＋0</td></tr></table>
<p>例：門前で ロン → 20 ＋ 10 ＝ <b>30符</b>。　鳴いて ツモ → 20 ＋ 2 ＝ <b>22符</b>。</p>
<p class="note">「門前（メンゼン）」は ポン・チー・明槓を して いない こと。自分だけで 4枚 そろえる 暗槓は 門前の まま。</p>`,
        gen: genFutei
    },
    {
        id: 'nakama', title: '牌の なかま', sub: '中張牌（2〜8）と 么九牌（1・9・字牌）',
        lesson: `<p>符を 数える ときは 牌を 2つの なかまに 分けます。</p>
<div class="fk-row"><div><b>中張牌（チュンチャンパイ）</b><br>数牌の 2〜8<br>{{t:2m}}{{t:5p}}{{t:8s}}</div></div>
<div class="fk-row"><div><b>么九牌（ヤオチューパイ）</b><br>1・9 と 字牌 ぜんぶ<br>{{t:1m}}{{t:9p}}{{t:1s}}{{t:1z}}{{t:5z}}{{t:7z}}</div></div>
<p><b>么九牌の ほうが 符が 2倍</b> に なります（つぎの ステップ）。</p>
<p>字牌の なかま：<b>三元牌</b> は 白・發・中 {{t:567z}}、<b>風牌</b> は 東・南・西・北 {{t:1234z}}。</p>`,
        gen: genNakama
    },
    {
        id: 'kotsu', title: '刻子の 符', sub: '同じ 牌 3枚',
        lesson: `<p>同じ 牌 3枚の 組を <b>刻子（コーツ）</b> と いいます。<b>順子（123 の ならび）は 0符</b>。符が つくのは 刻子です。</p>
<p><b>基本は 2符</b>。そこから 2倍に なる ルールが 2つ：</p>
<ul><li><b>么九牌</b>（1・9・字牌）なら ×2</li><li><b>暗刻</b>（自分で そろえた・手の 中）なら ×2</li></ul>
<table class="fk-t"><tr><th></th><th>中張牌</th><th>么九牌</th></tr>
<tr><td>明刻（ポン）{{pon:555p}}</td><td>2</td><td>4</td></tr>
<tr><td>暗刻（手の 中）{{t:999s}}</td><td>4</td><td>8</td></tr></table>
<p>例：{{pon:777z}} 中を ポン → 么九の 明刻 → <b>4符</b>。<br>例：{{t:111m}} 手の 中に 一萬 3枚 → 么九の 暗刻 → <b>8符</b>。</p>`,
        gen: genKotsu
    },
    {
        id: 'kantsu', title: '槓子（カン）の 符', sub: '同じ 牌 4枚は 刻子の 4倍',
        lesson: `<p>同じ 牌 4枚で カンした 組が <b>槓子（カンツ）</b>。<b>刻子の 符の 4倍</b> です。</p>
<table class="fk-t"><tr><th></th><th>中張牌</th><th>么九牌</th></tr>
<tr><td>明槓（人の 牌で カン）{{kan:5555p}}</td><td>8</td><td>16</td></tr>
<tr><td>暗槓（自分で 4枚）{{ankan:1111z}}</td><td>16</td><td>32</td></tr></table>
<p>ポンした 刻子に 1枚 たす <b>加槓</b> は 明槓と 同じ（8 ／ 16）。</p>
<p class="note">おぼえかた：2 → 4 → 8 → 16 → 32 と 2倍ずつ。中張の 明刻 2符が スタート。</p>`,
        gen: genKantsu
    },
    {
        id: 'atama', title: '雀頭（あたま）の 符', sub: '役牌の あたまは 2符',
        lesson: `<p>あたま（同じ 牌 2枚）は ふつう 0符。<b>役に なる 字牌</b> の ときだけ 2符 つきます。</p>
<table class="fk-t"><tr><th>あたま</th><th>符</th></tr>
<tr><td>三元牌（白・發・中）{{t:66z}}</td><td>2</td></tr>
<tr><td>場風（東場なら 東）</td><td>2</td></tr>
<tr><td>自風（自分の 席の 風）</td><td>2</td></tr>
<tr><td>場風で 自風（連風牌：東場の 東家の 東 など）</td><td>4</td></tr>
<tr><td>数牌・ほかの 風（客風牌）</td><td>0</td></tr></table>
<p class="note">場風と 自風は 対局画面の まん中に 出て います。東場の 南家なら、東も 南も 2符。</p>`,
        gen: genAtama
    },
    {
        id: 'machi', title: '待ちの 符', sub: '1つの 牌しか まてない 待ちは 2符',
        lesson: `<p>あがる 直前の 待ちの 形でも 符が きまります。<b>まてる 牌が 1種類だけの 形は 2符</b>。</p>
<table class="fk-t"><tr><th>待ち</th><th>形</th><th>符</th></tr>
<tr><td>両面（リャンメン）</td><td>{{t:34m}} → 2か5</td><td>0</td></tr>
<tr><td>シャンポン</td><td>{{t:5577p}} → 5か7</td><td>0</td></tr>
<tr><td>嵌張（カンチャン）</td><td>{{t:46s}} → 5だけ</td><td>2</td></tr>
<tr><td>辺張（ペンチャン）</td><td>{{t:12m}} → 3だけ</td><td>2</td></tr>
<tr><td>単騎（タンキ）</td><td>{{t:7z}} → 中だけ</td><td>2</td></tr></table>
<p><b>シャンポンを ロン</b> で あがると、できた 刻子は 人の 牌で できたので <b>明刻</b> あつかい（ツモなら 暗刻）。</p>
<p class="note">2とおりに 見える 形は、符が 高く なる ほうで 数えます。</p>`,
        gen: genMachi
    },
    {
        id: 'kiriage', title: 'ぜんぶ たして 切り上げ', sub: '1の位は かならず 切り上げ',
        lesson: `<p>ここまでの 符を <b>ぜんぶ たして</b>、さいごに <b>1の位を 切り上げ</b> ます（四捨五入では ない）。</p>
<div class="fk-flow">副底 20 ＋ あがりかた ＋ 刻子・槓子 ＋ あたま ＋ 待ち ＝ ○○符 → 切り上げ</div>
<p>例：門前ロン（20＋10）＋ 中の 暗刻 8 ＋ 嵌張 2 ＝ 40符 → <b>40符</b><br>
例：鳴いて ツモ（20＋2）＋ 五筒 ポン 2 ＋ 東 ポン 4 ＝ 28符 → <b>30符</b><br>
例：門前ロン 30 ＋ 九索 暗刻 8 ＋ 単騎 2 ＋ 中の あたま 2 ＝ 42符 → <b>50符</b></p>`,
        gen: genKiriage
    },
    {
        id: 'tokubetsu', title: 'とくべつな 形', sub: '平和・七対子・鳴いて 20符',
        lesson: `<p>数えなくても きまって いる 形が 4つ あります。</p>
<table class="fk-t"><tr><th>形</th><th>符</th></tr>
<tr><td><b>平和（ピンフ）の ツモ</b><br><small>順子だけ・あたまに 符なし・両面待ち・門前</small></td><td>20</td></tr>
<tr><td><b>平和の ロン</b>（20＋門前ロン10）</td><td>30</td></tr>
<tr><td><b>七対子</b>（あたま 7つ）</td><td>25</td></tr>
<tr><td><b>鳴いた 手で 20符</b> しか ない とき</td><td>30</td></tr></table>
<p>平和の ツモは ツモの 2符を つけません（つけると 平和で なくなる ため 20符 ちょうど）。</p>`,
        gen: genTokubetsu
    },
    {
        id: 'easy', title: '手を 見て 数える（分けて ある）', sub: 'ここまでの まとめ ①',
        lesson: `<p>いよいよ あがった 手 ぜんぶで 数えます。この ステップは <b>面子ごとに 分けて</b> あります。</p>
<ol><li>とくべつな 形（平和・七対子）か 見る</li><li>副底 20 ＋ あがりかた（門前ロン10・ツモ2）</li><li>刻子・槓子を 1つずつ（中張 2/4、么九 4/8、カンは ×4）</li><li>あたま（役牌 2）</li><li>待ち（嵌張・辺張・単騎 2）</li><li>ぜんぶ たして 切り上げ</li></ol>
<p class="note">光って いる 牌が あがり牌です。待ちの 形は あがり牌が 入った 面子を 見ます。</p>`,
        gen: genEasy
    },
    {
        id: 'hard', title: '手を 見て 数える（本番）', sub: 'ここまでの まとめ ②',
        lesson: `<p>さいごは じっさいの 対局と 同じ 見え方。<b>自分で 面子に 分けて</b> 数えます。鳴いた 面子・カンも 出ます。</p>
<p>手の 右に ある 横向きの 牌は 鳴いた 面子、はしが うらの 4枚は 暗槓です。</p>
<p class="note">これが できたら「練習」の ② 翻と 符から 点数 ➜ ③ 実戦問題、「麻雀ドリル」の 何符・何点 に すすもう！</p>`,
        gen: genHard
    }
];

/** 1ステップぶんの 問題（同じ 問題が つづかない ように） */
export function makeSession(stepIdx, rng = Math.random) {
    const st = STEPS[stepIdx];
    const out = [], seen = new Set();
    for (let i = 0, tries = 0; out.length < PER_STEP && tries < 200; tries++) {
        const q = st.gen(rng, i);
        if (!q || (seen.has(q.key) && tries < 120)) continue;
        seen.add(q.key);
        out.push(q);
        i++;
    }
    return out;
}

/** 牌の 書き方 '123m' → 種類の ならび（せつめいの {{…}} 用） */
export function kindsOf(str) {
    const out = [];
    let nums = [];
    for (const ch of str) {
        if (/\d/.test(ch)) { nums.push(Number(ch)); continue; }
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const n of nums) out.push(base + n - 1);
        nums = [];
    }
    return out;
}
export { code };
