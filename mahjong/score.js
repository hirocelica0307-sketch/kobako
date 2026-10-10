/* 役と 点数の 計算
   ------------------------------------------------------------------
   evaluateWin(ctx) に あがった ときの 手牌と じょうきょうを わたすと、
   いちばん 高く なる 分けかたで 役・翻・符・点数を かえします。
   ------------------------------------------------------------------ */
import { KINDS, isYaochu, isHonor, isTerminal, GREEN, toCounts, kindOf, isRedId, doraFromIndicator } from './tiles.js';
import { decompositions, isChiitoi, isKokushi } from './hand.js';

export const ceil100 = x => Math.ceil(x / 100) * 100;

/** 基本点（子の ロンは ×4、親の ロンは ×6） */
export function basePoints(han, fu, yakuman, rules) {
    if (yakuman > 0) return 8000 * yakuman;
    if (han >= 13) return rules.kazoe ? 8000 : 6000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    if (han >= 5) return 2000;
    let b = fu * Math.pow(2, han + 2);
    if (b >= 2000) b = 2000;
    if (rules.kiriage && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) b = 2000;
    return b;
}

/** 点数の 名まえ（満貫・跳満…）。ないときは '' */
export function tierName(han, base, yakuman, kazoeOk) {
    if (yakuman >= 2) return ['', '', 'ダブル役満', 'トリプル役満', '四倍役満', '五倍役満', '六倍役満'][yakuman] || '役満';
    if (yakuman === 1) return '役満';
    if (han >= 13 && kazoeOk) return '数え役満';
    if (base >= 6000) return '三倍満';
    if (base >= 4000) return '倍満';
    if (base >= 3000) return '跳満';
    if (base >= 2000) return '満貫';
    return '';
}

/** 演出の 段階（0：ふつう 1：満貫 2：跳満 3：倍満 4：三倍満 5：役満） */
export function tierLevel(name) {
    return { '満貫': 1, '跳満': 2, '倍満': 3, '三倍満': 4 }[name] || (name.includes('役満') ? 5 : 0);
}

/* ── ここから 役の しらべかた ─────────────────────────── */

function yakuhaiKinds(seatWind, roundWind) {
    return { seat: 27 + seatWind, round: 27 + roundWind };
}

/**
 * ctx:
 *   closed      手の中の 牌（id、あがり牌を ふくむ 14 - 3×面子 枚）
 *   melds       さらした 面子 [{ type: 'chi'|'pon'|'minkan'|'ankan'|'kakan', tiles: [id…] }]
 *   winTile     あがり牌の id
 *   tsumo       ツモか
 *   seatWind / roundWind  0東 1南 2西 3北
 *   riichi / doubleRiichi / ippatsu / rinshan / chankan / haitei / houtei / tenhou / chiihou
 *   doraInd     ドラ表示牌の 種類（カンドラ ふくむ）
 *   uraInd      裏ドラ表示牌の 種類（リーチの ときだけ）
 *   rules
 * かえす もの：null（役なし） または { yaku, han, fu, yakuman, base, name, dora, aka, ura }
 */
export function evaluateWin(ctx) {
    const { rules } = ctx;
    const closedCounts = toCounts(ctx.closed);
    const winK = kindOf(ctx.winTile);
    const menzen = ctx.melds.every(m => m.type === 'ankan');
    const allIds = [...ctx.closed, ...ctx.melds.flatMap(m => m.tiles)];
    const allCounts = toCounts(allIds);

    // ドラ
    let dora = 0, aka = 0, ura = 0;
    for (const ind of ctx.doraInd || []) dora += allCounts[doraFromIndicator(ind)];
    if (rules.aka) aka = allIds.filter(isRedId).length;
    if (ctx.riichi && rules.ura) for (const ind of ctx.uraInd || []) ura += allCounts[doraFromIndicator(ind)];

    const meldSets = ctx.melds.map(m => {
        const k = Math.min(...m.tiles.map(kindOf));
        if (m.type === 'chi') return { type: 'shuntsu', k, open: true };
        if (m.type === 'pon') return { type: 'koutsu', k, open: true };
        return { type: 'kantsu', k, open: m.type !== 'ankan' };
    });

    const candidates = [];

    // 状況役（どの 形でも 同じ）
    const situational = [];
    if (ctx.doubleRiichi) situational.push(['ダブル立直', 2]);
    else if (ctx.riichi) situational.push(['立直', 1]);
    if (ctx.riichi && ctx.ippatsu && rules.ippatsu) situational.push(['一発', 1]);
    if (menzen && ctx.tsumo) situational.push(['門前清自摸和', 1]);
    if (ctx.rinshan) situational.push(['嶺上開花', 1]);
    if (ctx.chankan) situational.push(['槍槓', 1]);
    if (ctx.haitei) situational.push(['海底摸月', 1]);
    if (ctx.houtei) situational.push(['河底撈魚', 1]);

    const situationalYakuman = [];
    if (ctx.tenhou) situationalYakuman.push(['天和', 1]);
    if (ctx.chiihou) situationalYakuman.push(['地和', 1]);

    const yw = yakuhaiKinds(ctx.seatWind, ctx.roundWind);
    const double = rules.doubleYakuman ? 2 : 1;

    // 国士無双
    if (ctx.melds.length === 0 && isKokushi(closedCounts)) {
        const before = closedCounts.slice();
        before[winK]--;
        const thirteen = before.every((v, k) => (isYaochu(k) ? v === 1 : v === 0));
        const y = [...situationalYakuman, [thirteen ? '国士無双十三面待ち' : '国士無双', thirteen ? double : 1]];
        candidates.push(finishYakuman(y));
    }

    // 七対子
    if (ctx.melds.length === 0 && isChiitoi(closedCounts)) {
        const yaku = [...situational];
        const ym = [...situationalYakuman];
        yaku.push(['七対子', 2]);
        const tiles = closedCounts;
        const kinds = [];
        for (let k = 0; k < KINDS; k++) if (tiles[k]) kinds.push(k);
        if (kinds.every(k => !isYaochu(k))) yaku.push(['断么九', 1]);
        if (kinds.every(isYaochu)) yaku.push(['混老頭', 2]);
        addFlush(yaku, ym, kinds, true);
        if (kinds.every(isHonor)) ym.push(['字一色', 1]);
        if (ym.length) candidates.push(finishYakuman(ym));
        else candidates.push({ yaku, fu: 25 });
    }

    // ふつうの 形
    for (const d of decompositions(closedCounts.slice())) {
        // あがり牌が どこに 入ったか（待ちの かたち）を 1つずつ ためす
        const interps = [];
        if (d.head === winK) interps.push({ wait: 'tanki', idx: -1 });
        d.sets.forEach((s, i) => {
            if (s.type === 'koutsu' && s.k === winK) interps.push({ wait: 'shanpon', idx: i });
            if (s.type === 'shuntsu' && winK >= s.k && winK <= s.k + 2) {
                const pos = winK - s.k;
                let wait;
                if (pos === 1) wait = 'kanchan';
                else if (pos === 0) wait = (s.k % 9 === 6) ? 'penchan' : 'ryanmen';
                else wait = (s.k % 9 === 0) ? 'penchan' : 'ryanmen';
                interps.push({ wait, idx: i });
            }
        });
        for (const it of interps) {
            const sets = d.sets.map((s, i) => ({
                type: s.type, k: s.k,
                open: (s.type === 'koutsu' && i === it.idx && !ctx.tsumo)   // ロンで できた 刻子は 明刻
            }));
            const all = [...sets, ...meldSets];
            candidates.push(evalNormal(ctx, d.head, all, sets, it.wait, menzen, situational, situationalYakuman, yw, closedCounts, winK, double));
        }
    }

    // 天和・地和だけ（ふつうの 形の なかで 計算ずみ）
    let best = null;
    for (const c of candidates) {
        if (!c) continue;
        const r = c.yakuman ? c : scoreNormal(c, menzen, dora, aka, ura, rules);
        if (!r) continue;
        if (!best || compare(r, best, rules) > 0) best = r;
    }
    if (!best) return null;
    if (!best.yakuman) {
        best.dora = dora; best.aka = aka; best.ura = ura;
    } else {
        best.dora = 0; best.aka = 0; best.ura = 0;
    }
    best.base = basePoints(best.han, best.fu, best.yakuman, rules);
    best.name = tierName(best.han, best.base, best.yakuman, rules.kazoe);
    return best;
}

function compare(a, b, rules) {
    const pa = basePoints(a.han, a.fu, a.yakuman, rules), pb = basePoints(b.han, b.fu, b.yakuman, rules);
    if (pa !== pb) return pa - pb;
    if (a.han !== b.han) return a.han - b.han;
    return a.fu - b.fu;
}

function finishYakuman(list) {
    const yakuman = list.reduce((s, [, n]) => s + n, 0);
    return { yaku: list.map(([name, n]) => ({ name, han: 13 * n, yakuman: n })), han: 13 * yakuman, fu: 0, yakuman };
}

function addFlush(yaku, ym, kinds, menzen) {
    const suits = new Set(kinds.filter(k => k < 27).map(k => Math.floor(k / 9)));
    const honors = kinds.some(isHonor);
    if (suits.size === 1 && !honors) yaku.push(['清一色', menzen ? 6 : 5]);
    else if (suits.size === 1 && honors) yaku.push(['混一色', menzen ? 3 : 2]);
}

function evalNormal(ctx, head, all, closedSets, wait, menzen, situational, situationalYakuman, yw, closedCounts, winK, double) {
    const { rules } = ctx;
    const yaku = [...situational];
    const ym = [...situationalYakuman];
    const shuntsu = all.filter(s => s.type === 'shuntsu');
    const triplets = all.filter(s => s.type !== 'shuntsu');
    const kinds = new Set([head]);
    for (const s of all) {
        if (s.type === 'shuntsu') { kinds.add(s.k); kinds.add(s.k + 1); kinds.add(s.k + 2); }
        else kinds.add(s.k);
    }
    const kindList = [...kinds];
    const isYakuhaiHead = head >= 31 || head === yw.seat || head === yw.round;
    const ankou = triplets.filter(s => !s.open).length;
    const kantsu = triplets.filter(s => s.type === 'kantsu').length;

    // 役満
    const dragonTrip = triplets.filter(s => s.k >= 31).length;
    const windTrip = triplets.filter(s => s.k >= 27 && s.k <= 30).length;
    if (dragonTrip === 3) ym.push(['大三元', 1]);
    if (windTrip === 4) ym.push(['大四喜', double]);
    else if (windTrip === 3 && head >= 27 && head <= 30) ym.push(['小四喜', 1]);
    if (kindList.every(isHonor)) ym.push(['字一色', 1]);
    if (kindList.every(k => GREEN.has(k))) ym.push(['緑一色', 1]);
    if (kindList.every(isTerminal)) ym.push(['清老頭', 1]);
    if (ankou === 4) ym.push([wait === 'tanki' ? '四暗刻単騎' : '四暗刻', wait === 'tanki' ? double : 1]);
    if (kantsu === 4) ym.push(['四槓子', 1]);
    if (menzen && ctx.melds.length === 0) {
        // 九蓮宝燈
        const suits = new Set(kindList.map(k => (k < 27 ? Math.floor(k / 9) : 3)));
        if (suits.size === 1 && !suits.has(3)) {
            const base = [...suits][0] * 9;
            const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
            const ok = need.every((n, i) => closedCounts[base + i] >= n);
            if (ok) {
                const before = closedCounts.slice();
                before[winK]--;
                const pure = need.every((n, i) => before[base + i] === n);
                ym.push([pure ? '純正九蓮宝燈' : '九蓮宝燈', pure ? double : 1]);
            }
        }
    }
    if (ym.length) return finishYakuman(ym);

    // 1翻〜
    const pinfu = menzen && shuntsu.length === 4 && !isYakuhaiHead && wait === 'ryanmen';
    if (pinfu) yaku.push(['平和', 1]);
    if (kindList.every(k => !isYaochu(k)) && (menzen || rules.kuitan)) yaku.push(['断么九', 1]);
    // 一盃口・二盃口（門前のみ。鳴いた 面子は ふくめない）
    if (menzen) {
        const cs = closedSets.filter(s => s.type === 'shuntsu').map(s => s.k).sort((a, b) => a - b);
        let pairs = 0;
        for (let i = 0; i + 1 < cs.length; i++) if (cs[i] === cs[i + 1]) { pairs++; i++; }
        if (pairs === 2) yaku.push(['二盃口', 3]);
        else if (pairs === 1) yaku.push(['一盃口', 1]);
    }
    // 役牌
    for (const s of triplets) {
        if (s.k === 31) yaku.push(['役牌 白', 1]);
        if (s.k === 32) yaku.push(['役牌 發', 1]);
        if (s.k === 33) yaku.push(['役牌 中', 1]);
        if (s.k === yw.seat) yaku.push(['自風 ' + '東南西北'[s.k - 27], 1]);
        if (s.k === yw.round) yaku.push(['場風 ' + '東南西北'[s.k - 27], 1]);
    }
    // 全帯么九
    const setHasYaochu = s => (s.type === 'shuntsu' ? (s.k % 9 === 0 || s.k % 9 === 6) : isYaochu(s.k));
    const setHasTerminal = s => (s.type === 'shuntsu' ? (s.k % 9 === 0 || s.k % 9 === 6) : isTerminal(s.k));
    if (shuntsu.length > 0) {
        if (all.every(setHasTerminal) && isTerminal(head)) yaku.push(['純全帯么九', menzen ? 3 : 2]);
        else if (all.every(setHasYaochu) && isYaochu(head)) yaku.push(['混全帯么九', menzen ? 2 : 1]);
    }
    // 一気通貫
    const shK = new Set(shuntsu.map(s => s.k));
    for (const b of [0, 9, 18]) {
        if (shK.has(b) && shK.has(b + 3) && shK.has(b + 6)) yaku.push(['一気通貫', menzen ? 2 : 1]);
    }
    // 三色同順・三色同刻
    for (let n = 0; n < 7; n++) {
        if (shK.has(n) && shK.has(n + 9) && shK.has(n + 18)) { yaku.push(['三色同順', menzen ? 2 : 1]); break; }
    }
    const trK = new Set(triplets.map(s => s.k));
    for (let n = 0; n < 9; n++) {
        if (trK.has(n) && trK.has(n + 9) && trK.has(n + 18)) { yaku.push(['三色同刻', 2]); break; }
    }
    if (triplets.length === 4) yaku.push(['対々和', 2]);
    if (ankou === 3) yaku.push(['三暗刻', 2]);
    if (kantsu === 3) yaku.push(['三槓子', 2]);
    if (dragonTrip === 2 && head >= 31) yaku.push(['小三元', 2]);
    if (kindList.every(isYaochu)) yaku.push(['混老頭', 2]);
    addFlush(yaku, ym, kindList, menzen);

    // 符
    let fu;
    if (pinfu) {
        fu = ctx.tsumo ? 20 : 30;
    } else {
        fu = 20;
        if (menzen && !ctx.tsumo) fu += 10;
        if (ctx.tsumo) fu += 2;
        for (const s of triplets) {
            let f = 2;
            if (isYaochu(s.k)) f *= 2;
            if (!s.open) f *= 2;
            if (s.type === 'kantsu') f *= 4;
            fu += f;
        }
        if (head >= 31) fu += 2;
        if (head === yw.seat) fu += 2;
        if (head === yw.round) fu += 2;
        if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') fu += 2;
        fu = Math.ceil(fu / 10) * 10;
        if (fu === 20) fu = 30;   // 鳴いて 符が ない ときは 30符
    }
    return { yaku, fu };
}

function scoreNormal(c, menzen, dora, aka, ura, rules) {
    if (!c.yaku.length) return null;
    const yaku = c.yaku.map(([name, han]) => ({ name, han }));
    let han = yaku.reduce((s, y) => s + y.han, 0);
    han += dora + aka + ura;
    return { yaku, han, fu: c.fu, yakuman: 0 };
}

/** 役が 1つでも あるか（ドラを のぞく）。あがれるか しらべる とき 用 */
export function hasYaku(ctx) {
    const r = evaluateWin(ctx);
    return !!r;
}
