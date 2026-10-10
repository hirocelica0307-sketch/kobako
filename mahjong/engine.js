/* 麻雀の ルールエンジン
   ------------------------------------------------------------------
   画面とは きりはなした「対局の すすみかた」です。
   ・おなじ 種（seed）と おなじ 手の ならびなら、どの 端末でも まったく 同じに すすみます
     （友だちとの 対戦は 手の ならびだけ おくりあいます）
   ・prompt() で「いま だれが 何を きめる 番か」がわかり、act(action) で すすめます
   ・act() は 画面の うごきの ための できごと（events）を かえします

   席（seat）0〜3 は 反時計まわりの じゅん（東→南→西→北 の 向き）。
   さいしょに サイコロで 仮親・起家（さいしょの 親）を きめます。
   ------------------------------------------------------------------ */
import { kindOf, isYaochu, isRedId, toCounts, isWind, YAOCHU, doraFromIndicator } from './tiles.js';
import { isAgari, waits, shanten } from './hand.js';
import { evaluateWin, ceil100 } from './score.js';

export const DEFAULT_RULES = {
    length: 'hanchan',     // 'tonpu' 東風戦 / 'hanchan' 半荘戦
    startPoints: 25000,
    returnPoints: 30000,
    uma: '10-20',          // 'none' / '5-10' / '10-20' / '10-30'
    aka: true,             // 赤ドラ（5萬・5筒・5索 1枚ずつ）
    kuitan: true,          // 喰いタン
    ippatsu: true,
    ura: true,             // 裏ドラ
    kandora: true,         // カンドラ
    tobi: true,            // 0点 未満で おわり
    agariyame: true,       // オーラスの 親が トップなら おわり
    westRound: false,      // 返し点に だれも とどかなければ 西入
    doubleRon: true,       // ダブロン（false：頭ハネ）
    sanchahou: true,       // 3人 ロンは 流局
    abortive: true,        // 途中流局（九種九牌・四風連打・四家立直・四槓散了）
    nagashi: true,         // 流し満貫
    kazoe: true,           // 数え役満
    kiriage: false,        // 切り上げ満貫
    doubleYakuman: false,  // ダブル役満（国士十三面・四暗刻単騎・純正九蓮・大四喜）
    pao: true,             // 責任払い（大三元・大四喜）
    timer: 'none'          // 'none' / 'wait'（5秒＋30秒 → まつ）/ 'auto'（5秒＋30秒 → ツモ切り）
};

/* ── 種から つくる ランダム（どの 端末でも 同じ ならび） ── */

export function makeRng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    const seedFn = () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
    let a = seedFn(), b = seedFn(), c = seedFn(), d = seedFn();
    const next = () => {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 12; i++) next();
    return next;
}

const die = rng => 1 + Math.floor(rng() * 6);

export function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ── 対局 ─────────────────────────────────── */

export class Mahjong {
    /**
     * @param rules ルール
     * @param seed  種（文字）
     */
    constructor(rules, seed) {
        this.rules = { ...DEFAULT_RULES, ...rules };
        this.seed = String(seed);
        const rng = makeRng(this.seed + ':setup');
        // 場所決め：風牌を 1枚ずつ ひいて 席を きめる（seatOrder[i] = i ばんめの 参加者が すわる 席）
        this.seatOrder = shuffle([0, 1, 2, 3], rng);
        // 仮東（東を ひいた 席 = 0）が サイコロを ふって 仮親を きめる
        this.dice1 = [die(rng), die(rng)];
        this.kariOya = (this.dice1[0] + this.dice1[1] - 1) % 4;
        // 仮親が もういちど ふって 起家（さいしょの 親）を きめる
        this.dice2 = [die(rng), die(rng)];
        this.startDealer = (this.kariOya + this.dice2[0] + this.dice2[1] - 1) % 4;

        this.scores = [0, 1, 2, 3].map(() => this.rules.startPoints);
        this.roundWind = 0;       // 0東 1南 2西
        this.kyoku = 0;           // その 場の 何局め（0〜3）
        this.honba = 0;
        this.sticks = 0;          // 供託（リーチ棒）
        this.handNo = 0;
        this.h = null;            // いまの 局
        this.phase = 'ready';     // ready / play / handEnd / over
        this.lastResult = null;
        this.final = null;
        this.history = [];        // 局ごとの けっか
    }

    get dealer() { return (this.startDealer + this.kyoku) % 4; }
    seatWind(seat) { return (seat - this.dealer + 4) % 4; }
    isAllLast() {
        const lastRound = this.rules.length === 'tonpu' ? 0 : 1;
        return this.roundWind >= lastRound && this.kyoku === 3;
    }

    /* ── 局の はじまり ── */

    startHand() {
        const ev = [];
        const rng = makeRng(this.seed + ':hand:' + this.handNo);
        const tiles = shuffle([...Array(136).keys()], rng);
        const dice = [die(rng), die(rng)];
        const sum = dice[0] + dice[1];
        const dealer = this.dealer;
        // 山：4つの 壁（17×2）を 反時計まわりに かぞえて わかれ目を きめる
        const wallOwner = (dealer + sum - 1) % 4;
        const ringOf = (w, i) => ((3 - w) * 17 + i) % 68;      // 右から i ばんめの 山（時計まわりの 輪）
        const g0 = (ringOf(wallOwner, 0) + sum) % 68;           // とりはじめる 山
        const stackTiles = g => [tiles[2 * g], tiles[2 * g + 1]];
        const live = [];
        for (let i = 0; i < 61; i++) live.push(...stackTiles((g0 + i) % 68));
        const dg = n => stackTiles(((g0 - n) % 68 + 68) % 68);   // わかれ目から n ばんめの 王牌の 山
        const rinshan = [...dg(1), ...dg(2)];
        const doraInd = [3, 4, 5, 6, 7].map(n => dg(n)[0]);
        const uraInd = [3, 4, 5, 6, 7].map(n => dg(n)[1]);

        const h = {
            dice, wallOwner, breakStack: sum,
            live, pos: 0, liveEnd: 122, rinshan, rinshanUsed: 0, doraInd, uraInd,
            doraShown: 1, pendingDora: 0,
            hands: [[], [], [], []], melds: [[], [], [], []], discards: [[], [], [], []],
            riichi: [false, false, false, false], riichiDeclared: [false, false, false, false],
            doubleRiichi: [false, false, false, false], ippatsu: [false, false, false, false],
            furitenTemp: [false, false, false, false], furitenRiichi: [false, false, false, false],
            discardCount: [0, 0, 0, 0],
            uninterrupted: true,       // まだ だれも 鳴いていない（第1巡の 判定）
            turn: dealer, drawn: null, rinshanDraw: false,
            state: 'turn', claim: null, kuikae: [],
            kans: [0, 0, 0, 0], totalKans: 0,
            pao: [null, null, null, null],   // 大三元・大四喜の 責任払いの 相手
            firstWinds: [],
            lastDiscard: null,
            justKakan: null
        };
        this.h = h;
        this.phase = 'play';
        this.emit(ev, {
            type: 'handStart', handNo: this.handNo, roundWind: this.roundWind, kyoku: this.kyoku, honba: this.honba,
            sticks: this.sticks, dealer, dice, wallOwner, breakStack: sum, doraInd: [kindOf(doraInd[0])], doraIds: [doraInd[0]]
        });
        // 配牌：4枚ずつ 3回、さいごに 1枚ずつ（親から 反時計まわり）
        for (let r = 0; r < 3; r++) {
            for (let p = 0; p < 4; p++) {
                const s = (dealer + p) % 4;
                for (let i = 0; i < 4; i++) h.hands[s].push(live[h.pos++]);
            }
        }
        for (let p = 0; p < 4; p++) h.hands[(dealer + p) % 4].push(live[h.pos++]);
        this.emit(ev, { type: 'deal' });
        this.drawFor(dealer, ev, false);
        return ev;
    }

    /** できごとに その ときの ようすを そえて つみます（画面は これを 1つずつ えがく） */
    emit(ev, e) {
        if (!this.noSnap) e.snap = this.snap();
        ev.push(e);
    }

    /** 画面 用の ようす（コピー） */
    snap() {
        const h = this.h;
        const base = {
            scores: this.scores.slice(), sticks: this.sticks, honba: this.honba, roundWind: this.roundWind, kyoku: this.kyoku,
            dealer: this.dealer
        };
        if (!h) return base;
        return {
            ...base,
            hands: h.hands.map(x => x.slice()),
            melds: h.melds.map(ms => ms.map(m => ({ type: m.type, tiles: m.tiles.slice(), from: m.from, called: m.called, added: m.added }))),
            discards: h.discards.map(ds => ds.map(d => ({ ...d }))),
            riichi: h.riichi.slice(), riichiDeclared: h.riichiDeclared.slice(),
            doraIds: this.doraIndicatorIds(), remaining: this.remaining(), turn: h.turn, drawn: h.drawn
        };
    }

    remaining() { return this.h ? this.h.liveEnd - this.h.pos : 0; }
    doraIndicators() { return this.h.doraInd.slice(0, this.h.doraShown).map(kindOf); }
    doraIndicatorIds() { return this.h.doraInd.slice(0, this.h.doraShown); }
    doraKinds() { return this.doraIndicators().map(doraFromIndicator); }

    drawFor(seat, ev, rinshan) {
        const h = this.h;
        let tile;
        if (rinshan) {
            tile = h.rinshan[h.rinshanUsed++];
            h.liveEnd--;           // 王牌を 14枚に たもつため 海底が 1つ まえに
        } else {
            if (this.remaining() <= 0) { this.exhaustiveDraw(ev); return; }
            tile = h.live[h.pos++];
        }
        h.hands[seat].push(tile);
        h.turn = seat;
        h.drawn = tile;
        h.rinshanDraw = rinshan;
        h.state = 'turn';
        h.claim = null;
        h.kuikae = [];
        this.emit(ev, { type: 'draw', seat, tile, rinshan, remaining: this.remaining() });
    }

    /* ── いま きめる こと ── */

    /**
     * { type: 'turn', seat, options } または { type: 'claim', seats: {seat: options}, pending: [seat…] }
     * または { type: 'handEnd' } / { type: 'over' } / { type: 'ready' }
     */
    prompt() {
        if (this.phase === 'ready') return { type: 'ready' };
        if (this.phase === 'handEnd') return { type: 'handEnd' };
        if (this.phase === 'over') return { type: 'over' };
        const h = this.h;
        if (h.state === 'turn') return { type: 'turn', seat: h.turn, options: this.turnOptions(h.turn) };
        if (h.state === 'afterCall') return { type: 'turn', seat: h.turn, options: this.turnOptions(h.turn) };
        if (h.state === 'claim') {
            const pending = Object.keys(h.claim.options).map(Number).filter(s => !(s in h.claim.decisions));
            return { type: 'claim', seats: h.claim.options, pending, tile: h.claim.tile, from: h.claim.from, kind: h.claim.kind };
        }
        return { type: 'none' };
    }

    closedMeldCount(seat) { return this.h.melds[seat].length; }

    winContext(seat, closed, winTile, tsumo, extra = {}) {
        const h = this.h;
        return {
            closed, melds: h.melds[seat], winTile, tsumo,
            seatWind: this.seatWind(seat), roundWind: this.roundWind,
            riichi: h.riichi[seat], doubleRiichi: h.doubleRiichi[seat], ippatsu: h.ippatsu[seat],
            doraInd: this.rules.kandora ? this.doraIndicators() : this.doraIndicators().slice(0, 1),
            uraInd: h.uraInd.slice(0, this.rules.kandora ? h.doraShown : 1).map(kindOf),
            rules: this.rules,
            ...extra
        };
    }

    isMenzen(seat) { return this.h.melds[seat].every(m => m.type === 'ankan'); }

    /** 手番の とき できる こと */
    turnOptions(seat) {
        const h = this.h;
        const hand = h.hands[seat];
        const c = toCounts(hand);
        const mc = h.melds[seat].length;
        const opt = { discard: [], riichi: [], tsumo: false, ankan: [], kakan: [], kyuushu: false };
        const afterCall = h.state === 'afterCall';

        // ツモ
        if (!afterCall && isAgari(c, mc)) {
            const r = evaluateWin(this.winContext(seat, hand, h.drawn, true, this.tsumoFlags(seat)));
            if (r) opt.tsumo = true;
        }
        // 打牌
        if (h.riichi[seat]) {
            opt.discard = [h.drawn];
        } else {
            const forbid = new Set(h.kuikae);
            let ds = hand.filter(t => !forbid.has(kindOf(t)));
            if (!ds.length) ds = hand.slice();
            opt.discard = ds;
        }
        // リーチ
        if (!afterCall && !h.riichi[seat] && this.isMenzen(seat) && this.scores[seat] >= 1000 && this.remaining() >= 4) {
            const seen = new Set();
            for (const t of hand) {
                const k = kindOf(t);
                if (seen.has(t)) continue;
                c[k]--;
                if (shanten(c, mc) === 0 && waits(c, mc).length) opt.riichi.push(t);
                c[k]++;
                seen.add(t);
            }
        }
        // カン（王牌に 嶺上牌が のこっていて、海底では ない とき）
        if (!afterCall && h.totalKans < 4 && this.remaining() > 0) {
            for (let k = 0; k < 34; k++) {
                if (c[k] !== 4) continue;
                if (h.riichi[seat]) {
                    if (kindOf(h.drawn) !== k) continue;
                    // 待ちが かわらない ときだけ
                    const before = c.slice(); before[kindOf(h.drawn)]--;
                    const w1 = waits(before, mc).join(',');
                    const after = c.slice(); after[k] = 0;
                    const w2 = waits(after, mc + 1).join(',');
                    if (w1 !== w2 || !w1) continue;
                }
                opt.ankan.push(k);
            }
            if (!h.riichi[seat]) {
                for (const m of h.melds[seat]) {
                    if (m.type !== 'pon') continue;
                    const k = kindOf(m.tiles[0]);
                    const t = hand.find(x => kindOf(x) === k);
                    if (t !== undefined) opt.kakan.push(t);
                }
            }
        }
        // 九種九牌
        if (!afterCall && this.rules.abortive && h.uninterrupted && h.discardCount[seat] === 0) {
            const kinds = YAOCHU.filter(k => c[k] > 0).length;
            if (kinds >= 9) opt.kyuushu = true;
        }
        return opt;
    }

    tsumoFlags(seat) {
        const h = this.h;
        const first = h.uninterrupted && h.discardCount[seat] === 0;
        return {
            rinshan: h.rinshanDraw,
            haitei: !h.rinshanDraw && this.remaining() === 0,
            tenhou: first && seat === this.dealer,
            chiihou: first && seat !== this.dealer
        };
    }

    isFuriten(seat) {
        const h = this.h;
        if (h.furitenTemp[seat] || h.furitenRiichi[seat]) return true;
        const c = toCounts(h.hands[seat]);
        const w = waits(c, h.melds[seat].length);
        const disc = new Set(h.discards[seat].map(d => kindOf(d.tile)));
        return w.some(k => disc.has(k));
    }

    canRon(seat, tile, extra) {
        const h = this.h;
        const hand = [...h.hands[seat], tile];
        const c = toCounts(hand);
        if (!isAgari(c, h.melds[seat].length)) return false;
        if (this.isFuriten(seat)) return false;
        return !!evaluateWin(this.winContext(seat, hand, tile, false, extra));
    }

    /** 捨て牌に たいして できる こと */
    claimOptionsFor(seat, tile, from) {
        const h = this.h;
        const k = kindOf(tile);
        const hand = h.hands[seat];
        const o = { ron: false, pon: [], minkan: false, chi: [] };
        const last = this.remaining() === 0;
        o.ron = this.canRon(seat, tile, { houtei: last });
        if (!h.riichi[seat] && !last) {
            const same = hand.filter(t => kindOf(t) === k);
            if (same.length >= 2) {
                // 赤が ある ときは 赤を つかう／つかわない を えらべる
                const reds = same.filter(isRedId), plain = same.filter(t => !isRedId(t));
                const combos = [];
                if (plain.length >= 2) combos.push([plain[0], plain[1]]);
                if (reds.length >= 1 && plain.length >= 1) combos.push([reds[0], plain[0]]);
                for (const cmb of combos) if (this.hasDiscardAfterCall(seat, cmb, 'pon', tile)) o.pon.push(cmb);
            }
            if (same.length >= 3 && h.totalKans < 4) o.minkan = true;
            if (seat === (from + 1) % 4 && k < 27) {
                const n = k % 9;
                const pick = kk => {
                    const ts = hand.filter(t => kindOf(t) === kk);
                    if (!ts.length) return null;
                    return ts;
                };
                const patterns = [];
                if (n >= 2) patterns.push([k - 2, k - 1]);
                if (n >= 1 && n <= 7) patterns.push([k - 1, k + 1]);
                if (n <= 6) patterns.push([k + 1, k + 2]);
                for (const [a, b] of patterns) {
                    const ta = pick(a), tb = pick(b);
                    if (!ta || !tb) continue;
                    const va = uniqRed(ta), vb = uniqRed(tb);
                    for (const x of va) for (const y of vb) {
                        if (this.hasDiscardAfterCall(seat, [x, y], 'chi', tile)) o.chi.push([x, y]);
                    }
                }
            }
        }
        const any = o.ron || o.pon.length || o.minkan || o.chi.length;
        return any ? o : null;
    }

    kuikaeKinds(type, used, tile) {
        const k = kindOf(tile);
        const out = [k];
        if (type === 'chi') {
            const ks = used.map(kindOf).sort((a, b) => a - b);
            if (ks[0] === k + 1 && ks[1] === k + 2 && (k + 3) % 9 !== 0 && k + 3 < 27) out.push(k + 3);
            if (ks[0] === k - 2 && ks[1] === k - 1 && k % 9 !== 0) out.push(k - 3);
        }
        return out;
    }

    hasDiscardAfterCall(seat, used, type, tile) {
        const rest = this.h.hands[seat].filter(t => !used.includes(t));
        const forbid = new Set(this.kuikaeKinds(type, used, tile));
        return rest.some(t => !forbid.has(kindOf(t)));
    }

    /* ── すすめる ── */

    /**
     * action:
     *   { a: 'next' }                         つぎの 局へ（さいしょは 第1局）
     *   { s, a: 'discard', t, r? }            打牌（r: 1 で リーチ）
     *   { s, a: 'tsumo' } / { s, a: 'kyuushu' }
     *   { s, a: 'ankan', k } / { s, a: 'kakan', t }
     *   { s, a: 'pass' } / { s, a: 'ron' } / { s, a: 'pon', t: [id,id] } / { s, a: 'chi', t: [id,id] } / { s, a: 'minkan' }
     */
    act(action) {
        const ev = [];
        const a = action.a;
        if (a === 'next') {
            if (this.phase === 'ready') return this.startHand();
            if (this.phase === 'handEnd') {
                this.handNo++;
                return this.startHand();
            }
            throw new Error('いまは つぎへ すすめません');
        }
        if (this.phase !== 'play') throw new Error('対局中では ありません');
        const h = this.h;
        const p = this.prompt();
        if (p.type === 'turn') {
            if (action.s !== p.seat) throw new Error('手番では ありません');
            this.doTurn(action, p.options, ev);
        } else if (p.type === 'claim') {
            if (!p.pending.includes(action.s)) throw new Error('きめる 番では ありません');
            this.doClaim(action, p, ev);
        } else {
            throw new Error('すすめられません');
        }
        return ev;
    }

    doTurn(action, opt, ev) {
        const h = this.h;
        const s = action.s;
        switch (action.a) {
        case 'discard': {
            const t = action.t;
            const riichi = !!action.r;
            if (riichi ? !opt.riichi.includes(t) : !opt.discard.includes(t)) throw new Error('その 牌は すてられません');
            this.discard(s, t, riichi, ev);
            return;
        }
        case 'tsumo': {
            if (!opt.tsumo) throw new Error('ツモ できません');
            const hand = h.hands[s];
            const result = evaluateWin(this.winContext(s, hand, h.drawn, true, this.tsumoFlags(s)));
            this.finishAgari([{ seat: s, from: null, tile: h.drawn, result }], ev);
            return;
        }
        case 'kyuushu': {
            if (!opt.kyuushu) throw new Error('九種九牌 では ありません');
            this.abortiveDraw('kyuushu', ev, s);
            return;
        }
        case 'ankan': {
            if (!opt.ankan.includes(action.k)) throw new Error('カン できません');
            const tiles = h.hands[s].filter(t => kindOf(t) === action.k);
            h.hands[s] = h.hands[s].filter(t => kindOf(t) !== action.k);
            h.melds[s].push({ type: 'ankan', tiles, from: s });
            h.kans[s]++; h.totalKans++;
            this.breakFirstTurn();
            this.emit(ev, { type: 'ankan', seat: s, tiles });
            // カンドラは すぐ めくる（まえの 明槓の ぶんも）
            this.revealPendingDora(ev);
            this.revealDora(ev);
            // 国士無双の 槍槓（暗槓）
            const claims = {};
            for (let o = 1; o < 4; o++) {
                const q = (s + o) % 4;
                const hand = [...h.hands[q], tiles[0]];
                const c = toCounts(hand);
                if (h.melds[q].length === 0 && isAgari(c, 0) && !this.isFuriten(q)) {
                    const r = evaluateWin(this.winContext(q, hand, tiles[0], false, { chankan: true }));
                    if (r && r.yaku.some(y => y.name.startsWith('国士'))) claims[q] = { ron: true, pon: [], minkan: false, chi: [] };
                }
            }
            if (Object.keys(claims).length) {
                h.state = 'claim';
                h.claim = { tile: tiles[0], from: s, kind: 'ankan', options: claims, decisions: {} };
                return;
            }
            this.afterKan(s, ev);
            return;
        }
        case 'kakan': {
            if (!opt.kakan.includes(action.t)) throw new Error('カン できません');
            const t = action.t;
            const k = kindOf(t);
            const m = h.melds[s].find(x => x.type === 'pon' && kindOf(x.tiles[0]) === k);
            h.hands[s] = h.hands[s].filter(x => x !== t);
            m.type = 'kakan';
            m.tiles = [...m.tiles, t];
            m.added = t;
            h.kans[s]++; h.totalKans++;
            this.breakFirstTurn();
            this.emit(ev, { type: 'kakan', seat: s, tile: t });
            this.revealPendingDora(ev);
            // 槍槓
            const claims = {};
            for (let o = 1; o < 4; o++) {
                const q = (s + o) % 4;
                if (this.canRon(q, t, { chankan: true })) claims[q] = { ron: true, pon: [], minkan: false, chi: [] };
            }
            if (Object.keys(claims).length) {
                h.state = 'claim';
                h.claim = { tile: t, from: s, kind: 'kakan', options: claims, decisions: {} };
                return;
            }
            h.pendingDora++;
            this.afterKan(s, ev);
            return;
        }
        default:
            throw new Error('その 手は できません');
        }
    }

    breakFirstTurn() {
        const h = this.h;
        h.uninterrupted = false;
        h.ippatsu = [false, false, false, false];
    }

    revealDora(ev) {
        const h = this.h;
        if (!this.rules.kandora) return;
        if (h.doraShown < 5) {
            h.doraShown++;
            this.emit(ev, { type: 'dora', indicator: kindOf(h.doraInd[h.doraShown - 1]), id: h.doraInd[h.doraShown - 1] });
        }
    }
    revealPendingDora(ev) {
        while (this.h.pendingDora > 0) { this.h.pendingDora--; this.revealDora(ev); }
    }

    afterKan(s, ev) {
        this.drawFor(s, ev, true);
    }

    discard(s, t, riichi, ev) {
        const h = this.h;
        const tsumogiri = t === h.drawn;
        h.hands[s] = h.hands[s].filter(x => x !== t);
        const first = h.uninterrupted && h.discardCount[s] === 0;
        if (h.ippatsu[s]) h.ippatsu[s] = false;   // じぶんの つぎの 打牌で 一発は きえる
        h.furitenTemp[s] = false;
        h.discards[s].push({ tile: t, riichi, called: false, tsumogiri });
        h.discardCount[s]++;
        h.drawn = null;
        h.kuikae = [];
        if (riichi) {
            h.riichiDeclared[s] = true;
            h.pendingRiichi = { seat: s, double: first };
        }
        if (h.uninterrupted && isWind(kindOf(t)) && h.firstWinds.length < 4) h.firstWinds.push(kindOf(t));
        else if (h.firstWinds.length < 4) h.firstWinds.push(-1);
        h.lastDiscard = { seat: s, tile: t };
        this.emit(ev, { type: 'discard', seat: s, tile: t, riichi, tsumogiri });
        // 明槓の カンドラは 打牌の あとで めくる
        this.revealPendingDora(ev);

        // ほかの 人が 鳴けるか
        const options = {};
        for (let o = 1; o < 4; o++) {
            const q = (s + o) % 4;
            const op = this.claimOptionsFor(q, t, s);
            if (op) options[q] = op;
        }
        if (Object.keys(options).length) {
            h.state = 'claim';
            h.claim = { tile: t, from: s, kind: 'discard', options, decisions: {} };
            return;
        }
        this.afterDiscardNoClaim(ev);
    }

    /** だれも 鳴かなかった あと：リーチ成立・同巡フリテン・途中流局・つぎの ツモ */
    afterDiscardNoClaim(ev) {
        const h = this.h;
        const { seat: s, tile: t } = h.lastDiscard;
        this.markMissed(s, t, null);
        this.establishRiichi(ev);
        // 途中流局
        if (this.rules.abortive) {
            if (h.uninterrupted && h.firstWinds.length === 4 && h.firstWinds[0] >= 0 && h.firstWinds.every(w => w === h.firstWinds[0])) {
                return this.abortiveDraw('suufon', ev);
            }
            if (h.riichi.every(Boolean)) return this.abortiveDraw('suucha', ev);
            if (h.totalKans === 4 && h.kans.filter(n => n > 0).length > 1) return this.abortiveDraw('suukan', ev);
        }
        if (this.remaining() <= 0) return this.exhaustiveDraw(ev);
        this.drawFor((s + 1) % 4, ev, false);
    }

    /** ロンできたのに しなかった 人を フリテンに する */
    markMissed(from, tile, ronners) {
        const h = this.h;
        const k = kindOf(tile);
        for (let o = 1; o < 4; o++) {
            const q = (from + o) % 4;
            if (ronners && ronners.includes(q)) continue;
            const c = toCounts(h.hands[q]);
            if (waits(c, h.melds[q].length).includes(k)) {
                if (h.riichi[q]) h.furitenRiichi[q] = true;
                else h.furitenTemp[q] = true;
            }
        }
    }

    establishRiichi(ev) {
        const h = this.h;
        if (!h.pendingRiichi) return;
        const { seat, double } = h.pendingRiichi;
        h.pendingRiichi = null;
        h.riichi[seat] = true;
        h.doubleRiichi[seat] = double;
        h.ippatsu[seat] = true;
        this.scores[seat] -= 1000;
        this.sticks++;
        this.emit(ev, { type: 'riichiStick', seat, sticks: this.sticks, scores: this.scores.slice() });
    }

    doClaim(action, p, ev) {
        const h = this.h;
        const s = action.s;
        const opt = h.claim.options[s];
        const a = action.a;
        if (a === 'pass') { /* ok */ }
        else if (a === 'ron') { if (!opt.ron) throw new Error('ロン できません'); }
        else if (a === 'pon') { if (!opt.pon.some(c => sameSet(c, action.t))) throw new Error('ポン できません'); }
        else if (a === 'chi') { if (!opt.chi.some(c => sameSet(c, action.t))) throw new Error('チー できません'); }
        else if (a === 'minkan') { if (!opt.minkan) throw new Error('カン できません'); }
        else throw new Error('その 手は できません');
        h.claim.decisions[s] = action;
        this.tryResolveClaim(ev);
    }

    tryResolveClaim(ev) {
        const h = this.h;
        const cl = h.claim;
        const rank = d => (d.a === 'ron' ? 3 : d.a === 'pon' || d.a === 'minkan' ? 2 : d.a === 'chi' ? 1 : 0);
        const optRank = o => (o.ron ? 3 : (o.pon.length || o.minkan) ? 2 : o.chi.length ? 1 : 0);
        const seats = Object.keys(cl.options).map(Number);
        const pending = seats.filter(q => !(q in cl.decisions));
        const decided = seats.filter(q => q in cl.decisions);
        const bestDecided = decided.reduce((m, q) => Math.max(m, rank(cl.decisions[q])), 0);
        // ロンは みんなの 返事を まつ（ダブロンの ため）。それ以外は 上の 人が まだ きめていない ときは まつ
        const blocking = pending.some(q => {
            const r = optRank(cl.options[q]);
            return r > bestDecided || (r === 3 && bestDecided === 3);
        });
        if (blocking) return;

        const from = cl.from;
        const order = [1, 2, 3].map(o => (from + o) % 4);
        const rons = order.filter(q => cl.decisions[q] && cl.decisions[q].a === 'ron');
        if (rons.length) {
            if (rons.length === 3 && this.rules.sanchahou) {
                h.claim = null;
                return this.abortiveDraw('sancha', ev);
            }
            const winners = this.rules.doubleRon ? rons : [rons[0]];
            const extra = cl.kind === 'discard' ? { houtei: this.remaining() === 0 } : { chankan: true };
            const wins = winners.map(q => {
                const hand = [...h.hands[q], cl.tile];
                return { seat: q, from, tile: cl.tile, result: evaluateWin(this.winContext(q, hand, cl.tile, false, extra)) };
            });
            h.claim = null;
            return this.finishAgari(wins, ev);
        }
        // ロンが なかった：見のがした 人は フリテン
        const kind = cl.kind;
        if (kind !== 'discard') {
            // 槍槓を 見のがした：カンを つづける
            this.markMissed(from, cl.tile, null);
            h.claim = null;
            h.state = 'turn';
            if (kind === 'kakan') h.pendingDora++;
            return this.afterKan(from, ev);
        }
        const caller = order.find(q => cl.decisions[q] && (cl.decisions[q].a === 'pon' || cl.decisions[q].a === 'minkan'))
            ?? order.find(q => cl.decisions[q] && cl.decisions[q].a === 'chi');
        if (caller === undefined) {
            h.claim = null;
            h.state = 'turn';
            return this.afterDiscardNoClaim(ev);
        }
        this.markMissed(from, cl.tile, null);
        // リーチ宣言牌が 鳴かれても リーチは 成立
        this.establishRiichi(ev);
        const d = cl.decisions[caller];
        const tile = cl.tile;
        h.claim = null;
        const disc = h.discards[from];
        disc[disc.length - 1].called = true;
        this.breakFirstTurn();
        let used;
        if (d.a === 'minkan') used = h.hands[caller].filter(t => kindOf(t) === kindOf(tile)).slice(0, 3);
        else used = d.t;
        h.hands[caller] = h.hands[caller].filter(t => !used.includes(t));
        const type = d.a === 'minkan' ? 'minkan' : d.a;
        const meld = { type, tiles: [...used, tile], from, called: tile };
        h.melds[caller].push(meld);
        this.checkPao(caller, from, kindOf(tile), type);
        this.emit(ev, { type: 'call', seat: caller, call: type, from, tile, tiles: meld.tiles });
        if (type === 'minkan') {
            h.kans[caller]++; h.totalKans++;
            h.pendingDora++;
            return this.afterKan(caller, ev);
        }
        h.turn = caller;
        h.state = 'afterCall';
        h.drawn = null;
        h.rinshanDraw = false;
        h.kuikae = this.kuikaeKinds(type, used, tile);
    }

    checkPao(caller, from, k, type) {
        if (!this.rules.pao) return;
        const h = this.h;
        const trip = h.melds[caller].filter(m => m.type !== 'chi').map(m => kindOf(m.tiles[0]));
        if (k >= 31 && trip.filter(x => x >= 31).length === 3) h.pao[caller] = { from, yaku: '大三元' };
        if (k >= 27 && k <= 30 && trip.filter(x => x >= 27 && x <= 30).length === 4) h.pao[caller] = { from, yaku: '大四喜' };
    }

    /* ── あがり ── */

    finishAgari(wins, ev) {
        const h = this.h;
        const deltas = [0, 0, 0, 0];
        const dealer = this.dealer;
        const honba = this.honba;
        const details = [];
        // 供託は 放銃者から 見て 近い あがり人へ
        const stickTaker = wins[0].seat;
        wins.forEach((w, i) => {
            const r = w.result;
            const isDealer = w.seat === dealer;
            const base = r.base;
            const d = [0, 0, 0, 0];
            const hb = i === 0 ? honba : 0;   // 本場と 供託は 放銃者に 近い あがり人だけ（上家取り）
            const pao = h.pao[w.seat] && r.yakuman && r.yaku.some(y => y.name === h.pao[w.seat].yaku) ? h.pao[w.seat].from : null;
            if (w.from === null) {
                if (pao !== null) {
                    const total = ceil100(base * (isDealer ? 6 : 4)) + hb * 300;
                    d[pao] -= total; d[w.seat] += total;
                } else {
                    for (let q = 0; q < 4; q++) {
                        if (q === w.seat) continue;
                        const pay = isDealer ? ceil100(base * 2) : ceil100(base * (q === dealer ? 2 : 1));
                        d[q] -= pay + hb * 100;
                        d[w.seat] += pay + hb * 100;
                    }
                }
            } else {
                const total = ceil100(base * (isDealer ? 6 : 4)) + hb * 300;
                if (pao !== null && pao !== w.from) {
                    const half = ceil100(base * (isDealer ? 6 : 4) / 2);
                    d[w.from] -= total - half; d[pao] -= half;
                } else {
                    d[w.from] -= total;
                }
                d[w.seat] += total;
            }
            if (w.seat === stickTaker && this.sticks > 0) d[w.seat] += this.sticks * 1000;
            for (let q = 0; q < 4; q++) deltas[q] += d[q];
            details.push({
                seat: w.seat, from: w.from, tile: w.tile, result: r, delta: d, pao,
                hand: w.from === null ? h.hands[w.seat].filter(t => t !== w.tile) : h.hands[w.seat].slice(),
                melds: h.melds[w.seat].map(m => ({ ...m, tiles: m.tiles.slice() })),
                uraInd: h.riichi[w.seat] && this.rules.ura ? h.uraInd.slice(0, this.rules.kandora ? h.doraShown : 1) : [],
                doraInd: this.doraIndicatorIds(),
                riichi: h.riichi[w.seat]
            });
        });
        const before = this.scores.slice();
        for (let q = 0; q < 4; q++) this.scores[q] += deltas[q];
        this.sticks = 0;
        const dealerWon = wins.some(w => w.seat === dealer);
        const res = { type: 'agari', wins: details, deltas, before, scores: this.scores.slice(), tsumo: wins[0].from === null };
        this.emit(ev, res);
        this.endHand(dealerWon, res, ev);
    }

    /* ── 流局 ── */

    exhaustiveDraw(ev) {
        const h = this.h;
        const tenpai = [0, 1, 2, 3].map(q => {
            const c = toCounts(h.hands[q]);
            const mk = new Array(34).fill(0);
            for (const m of h.melds[q]) for (const t of m.tiles) mk[kindOf(t)]++;
            const w = waits(c, h.melds[q].length);
            return w.some(k => c[k] + mk[k] < 4);
        });
        const deltas = [0, 0, 0, 0];
        const nagashi = [];
        if (this.rules.nagashi) {
            for (let q = 0; q < 4; q++) {
                const ds = h.discards[q];
                if (ds.length && ds.every(d => isYaochu(kindOf(d.tile)) && !d.called)) nagashi.push(q);
            }
        }
        if (nagashi.length) {
            for (const q of nagashi) {
                const isDealer = q === this.dealer;
                for (let o = 0; o < 4; o++) {
                    if (o === q) continue;
                    const pay = isDealer ? 4000 : (o === this.dealer ? 4000 : 2000);
                    deltas[o] -= pay; deltas[q] += pay;
                }
            }
        } else {
            const n = tenpai.filter(Boolean).length;
            if (n > 0 && n < 4) {
                for (let q = 0; q < 4; q++) deltas[q] = tenpai[q] ? 3000 / n : -3000 / (4 - n);
            }
        }
        const before = this.scores.slice();
        for (let q = 0; q < 4; q++) this.scores[q] += deltas[q];
        const res = {
            type: 'ryuukyoku', reason: nagashi.length ? 'nagashi' : 'exhaust', tenpai, nagashi, deltas, before, scores: this.scores.slice(),
            hands: h.hands.map(x => x.slice())
        };
        this.emit(ev, res);
        const dealerTenpai = tenpai[this.dealer];
        this.endHand(dealerTenpai, res, ev, true);
    }

    abortiveDraw(reason, ev, seat = null) {
        const h = this.h;
        h.pendingRiichi = null;
        const res = {
            type: 'ryuukyoku', reason, seat, tenpai: [false, false, false, false], nagashi: [], deltas: [0, 0, 0, 0],
            before: this.scores.slice(), scores: this.scores.slice(), hands: h.hands.map(x => x.slice())
        };
        this.emit(ev, res);
        this.endHand(true, res, ev, true);
    }

    /** 局の おわり：つぎの 局の じゅんび と 対局の おわりの 判定 */
    endHand(renchan, res, ev, isDraw = false) {
        const r = this.rules;
        const lastRound = r.length === 'tonpu' ? 0 : 1;
        const dealer = this.dealer;
        this.history.push({ roundWind: this.roundWind, kyoku: this.kyoku, honba: this.honba, result: res });
        this.lastResult = res;
        const top = Math.max(...this.scores);
        const dealerIsTop = this.scores[dealer] === top && this.scores.filter(x => x === top).length === 1;
        const inExtra = this.roundWind > lastRound;
        const allLast = this.kyoku === 3 && this.roundWind >= lastRound;
        let over = false, reason = '';
        if (r.tobi && this.scores.some(x => x < 0)) { over = true; reason = 'tobi'; }
        if (!over) {
            if (renchan) {
                this.honba++;
                const realEnd = res.type === 'agari' || res.reason === 'exhaust' || res.reason === 'nagashi';
                if (allLast && r.agariyame && dealerIsTop && realEnd && (!r.westRound || top >= r.returnPoints)) {
                    over = true; reason = 'agariyame';
                }
            } else {
                this.honba = isDraw ? this.honba + 1 : 0;
                let k = this.kyoku + 1, rw = this.roundWind;
                if (k >= 4) { k = 0; rw++; }
                if (rw > lastRound) {
                    if (!r.westRound || rw > lastRound + 1 || top >= r.returnPoints) { over = true; reason = 'end'; }
                }
                if (!over) { this.roundWind = rw; this.kyoku = k; }
            }
            // 延長戦は だれかが 返し点に とどいたら おわり
            if (!over && inExtra && top >= r.returnPoints) { over = true; reason = 'end'; }
        }
        if (over) {
            this.finishMatch(reason);
            this.phase = 'over';
            this.emit(ev, { type: 'matchEnd', final: this.final });
        } else {
            this.phase = 'handEnd';
        }
        this.emit(ev, { type: 'handEnd', over });
    }

    finishMatch(reason) {
        const r = this.rules;
        // のこった 供託は トップへ
        const order = [0, 1, 2, 3].map(i => (this.startDealer + i) % 4);
        const ranked = order.slice().sort((a, b) => this.scores[b] - this.scores[a] || order.indexOf(a) - order.indexOf(b));
        if (this.sticks > 0) { this.scores[ranked[0]] += this.sticks * 1000; this.sticks = 0; }
        const uma = { 'none': [0, 0, 0, 0], '5-10': [10, 5, -5, -10], '10-20': [20, 10, -10, -20], '10-30': [30, 10, -10, -30] }[r.uma] || [0, 0, 0, 0];
        const oka = (r.returnPoints - r.startPoints) * 4 / 1000;
        const rows = ranked.map((seat, i) => {
            const pt = (this.scores[seat] - r.returnPoints) / 1000 + uma[i] + (i === 0 ? oka : 0);
            return { seat, rank: i + 1, score: this.scores[seat], point: Math.round(pt * 10) / 10 };
        });
        this.final = { reason, rows };
    }
}

function uniqRed(ts) {
    const reds = ts.filter(isRedId), plain = ts.filter(t => !isRedId(t));
    const out = [];
    if (plain.length) out.push(plain[0]);
    if (reds.length) out.push(reds[0]);
    return out;
}

function sameSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const x = a.slice().sort((p, q) => p - q), y = b.slice().sort((p, q) => p - q);
    return x.every((v, i) => v === y[i]);
}
