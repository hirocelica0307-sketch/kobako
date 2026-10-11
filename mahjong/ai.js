/* コンピューターの 考えかた（3段階）
   ------------------------------------------------------------------
   1 あまり考えない：手を すすめる 牌を ざっくり えらぶ。まもらない。鳴きは 役牌だけ ときどき
   2 ふつうに考える：シャンテン数と 受け入れ枚数で えらぶ。リーチが かかると 現物で まもる
   3 よく考える    ：受け入れ・打点（ドラ・役）・あいての 危険度を 点数に して えらぶ。
                     押すか おりるかを 手の 高さと はやさで きめる。リーチと ダマも つかいわける
   コンピューターは 自分の 手牌と 見えている 牌（捨て牌・鳴き・ドラ表示牌）だけで 考えます。
   ------------------------------------------------------------------ */
import { kindOf, isRedId, isYaochu, toCounts, doraFromIndicator, isHonor, KINDS } from './tiles.js';
import { shanten, waits, ukeire } from './hand.js';
import { evaluateWin } from './score.js';

export const LEVELS = [
    { id: 1, name: 'あまり考えない', short: 'よわい', desc: 'すぐに 打つ。まもりは しない' },
    { id: 2, name: 'ふつうに考える', short: 'ふつう', desc: '手の すすめかたを 考え、リーチには まもる' },
    { id: 3, name: 'よく考えて打つ', short: 'つよい', desc: '打点・危険度・押し引きまで 考える' }
];

/* ── 見えている 牌 ── */

function visibleCounts(g, seat) {
    const h = g.h;
    const v = toCounts(h.hands[seat]);
    for (let q = 0; q < 4; q++) {
        for (const d of h.discards[q]) if (!d.called) v[kindOf(d.tile)]++;
        for (const m of h.melds[q]) for (const t of m.tiles) v[kindOf(t)]++;
    }
    for (const k of g.doraIndicators()) v[k]++;
    for (let k = 0; k < KINDS; k++) if (v[k] > 4) v[k] = 4;
    return v;
}

/* ── 危険度（0〜1 くらい） ── */

function threatSeats(g, seat) {
    const h = g.h;
    const out = [];
    for (let q = 0; q < 4; q++) {
        if (q === seat) continue;
        if (h.riichi[q] || h.riichiDeclared[q]) { out.push({ q, w: 1 }); continue; }
        const open = h.melds[q].length;
        if (open >= 3) out.push({ q, w: 0.7 });
        else if (open === 2 && h.discards[q].length >= 8) out.push({ q, w: 0.35 });
    }
    return out;
}

function safeAgainst(g, q) {
    // q に 対しての 現物（q の 捨て牌、q の リーチ後に だれかが 捨てた 牌）
    const h = g.h;
    const safe = new Set(h.discards[q].map(d => kindOf(d.tile)));
    if (h.riichi[q] || h.riichiDeclared[q]) {
        const idx = h.discards[q].findIndex(d => d.riichi);
        const riichiTurn = idx;
        // リーチの あとの 他家の 捨て牌（だいたいの じゅんばんで 見る）
        for (let p = 0; p < 4; p++) {
            if (p === q) continue;
            h.discards[p].forEach((d, i) => { if (i >= riichiTurn) safe.add(kindOf(d.tile)); });
        }
    }
    return safe;
}

function dangerOf(g, seat, k, threats, vis) {
    if (!threats.length) return 0;
    let total = 0;
    for (const { q, w } of threats) {
        const safe = safeAgainst(g, q);
        if (safe.has(k)) continue;
        let d;
        if (isHonor(k)) {
            const left = 4 - vis[k];
            d = left <= 0 ? 0 : left === 1 ? 0.12 : left === 2 ? 0.35 : 0.55;
        } else {
            const n = k % 9;   // 0〜8
            const base = [0.45, 0.6, 0.75, 0.95, 0.95, 0.95, 0.75, 0.6, 0.45][n];
            // 筋
            const s = Math.floor(k / 9) * 9;
            const has = x => x >= 0 && x <= 8 && safe.has(s + x);
            let suji;
            if (n <= 2) suji = has(n + 3);
            else if (n >= 6) suji = has(n - 3);
            else suji = has(n - 3) && has(n + 3);
            const half = n > 2 && n < 6 && (has(n - 3) || has(n + 3));
            d = base;
            if (suji) d *= 0.35;
            else if (half) d *= 0.7;
            // 壁（ノーチャンス）
            const wall = x => x >= 0 && x <= 8 && vis[s + x] >= 4;
            if ((n <= 1 && wall(n + 1)) || (n >= 7 && wall(n - 1))) d *= 0.4;
            else if (wall(n - 1) && wall(n + 1)) d *= 0.4;
        }
        // ドラは 高い
        if (g.doraKinds().includes(k)) d *= 1.3;
        total += d * w;
    }
    return total;
}

/* ── 手の ねうち（ざっくり） ── */

function valueHint(g, seat, c, melds) {
    const doras = g.doraKinds();
    let v = 0;
    for (const k of doras) v += c[k];
    for (const m of melds) for (const t of m.tiles) if (doras.includes(kindOf(t))) v++;
    return v;
}

function yakuhaiKinds(g, seat) {
    return [31, 32, 33, 27 + g.seatWind(seat), 27 + g.roundWind];
}

/** 鳴いた 手に 役が つきそうか */
function openYakuPath(g, seat, c, melds) {
    const yh = yakuhaiKinds(g, seat);
    // 役牌の 刻子
    for (const m of melds) if (m.type !== 'chi' && yh.includes(kindOf(m.tiles[0]))) return 'yakuhai';
    // 役牌の 対子以上（あとで ポンする つもり）
    // タンヤオ
    if (g.rules.kuitan && melds.every(m => m.tiles.every(t => !isYaochu(kindOf(t))))) {
        let y = 0;
        for (let k = 0; k < KINDS; k++) if (isYaochu(k)) y += c[k];
        if (y <= 1) return 'tanyao';
    }
    // 染め手
    const suitsOf = new Set();
    for (const m of melds) for (const t of m.tiles) { const k = kindOf(t); if (k < 27) suitsOf.add(Math.floor(k / 9)); }
    if (suitsOf.size <= 1) {
        let other = 0;
        const s = [...suitsOf][0];
        for (let k = 0; k < 27; k++) if (c[k] && (s === undefined || Math.floor(k / 9) !== s)) other += c[k];
        if (s !== undefined && other <= 1) return 'flush';
    }
    // 対々和
    if (melds.every(m => m.type !== 'chi')) {
        let pairs = 0;
        for (let k = 0; k < KINDS; k++) if (c[k] >= 2) pairs++;
        if (pairs + melds.length >= 4) return 'toitoi';
    }
    // 役牌の 対子が あれば まだ 鳴ける
    if (yh.some(k => c[k] >= 2)) return 'yakuhai-pair';
    return null;
}

/* ── 打牌えらび ── */

function evaluateDiscards(g, seat, candidates, level, rng) {
    const h = g.h;
    const hand = h.hands[seat];
    const c = toCounts(hand);
    const mc = h.melds[seat].length;
    const vis = visibleCounts(g, seat);
    const threats = level >= 2 ? threatSeats(g, seat) : [];
    const doras = g.doraKinds();
    const yh = yakuhaiKinds(g, seat);
    const kinds = [...new Set(candidates.map(kindOf))];
    const rows = [];
    for (const k of kinds) {
        c[k]--;
        const u = ukeire(c, mc, vis);
        let goodness = -u.shanten * 1000 + u.total * 4;
        if (level >= 3) {
            // テンパイなら 待ちの 枚数と 役の あるなし
            if (u.shanten === 0) {
                goodness += u.total * 6;
            }
            // ドラ・赤を のこす
            if (doras.includes(k)) goodness -= 14;
            // 役牌の 対子を のこす
            if (yh.includes(k) && c[k] >= 1) goodness -= 8;
            // 孤立した 字牌・端牌は 先に
            if (isHonor(k) && c[k] === 0) goodness += yh.includes(k) ? 2 : 6;
            else if (isYaochu(k) && c[k] === 0) goodness += 2;
        } else {
            if (isHonor(k) && c[k] === 0) goodness += 3;
            if (doras.includes(k)) goodness -= 6;
        }
        const danger = dangerOf(g, seat, k, threats, vis);
        rows.push({ k, shanten: u.shanten, ukeire: u.total, goodness, danger });
        c[k]++;
    }
    return rows;
}

function pickTileOfKind(candidates, k) {
    // 同じ 種類なら 赤は のこす
    const list = candidates.filter(t => kindOf(t) === k);
    return list.find(t => !isRedId(t)) ?? list[0];
}

/** 押すか おりるか（level 3）：true なら おりる */
function shouldFold(g, seat, bestShanten, threats, valueH) {
    const strong = threats.reduce((s, t) => s + t.w, 0);
    if (strong < 0.9) return false;
    if (bestShanten >= 2) return true;
    if (bestShanten === 1) return valueH < 3;       // 1シャンテンで 高くなければ おりる
    return false;                                     // テンパイは 押す（危険な ときは 打牌で 調整）
}

function chooseDiscard(g, seat, opt, level, rng) {
    const h = g.h;
    const cands = opt.discard;
    if (cands.length === 1) return { t: cands[0], riichi: false };
    const rows = evaluateDiscards(g, seat, cands, level, rng);
    const minS = Math.min(...rows.map(r => r.shanten));
    let chosen;
    if (level === 1) {
        // シャンテンが ふえない 中から てきとうに（字牌から 切りがち）
        const ok = rows.filter(r => r.shanten === minS);
        ok.sort((a, b) => b.goodness - a.goodness);
        chosen = rng() < 0.6 ? ok[0] : ok[Math.floor(rng() * ok.length)];
    } else if (level === 2) {
        const threats = threatSeats(g, seat).filter(t => t.w >= 1);
        if (threats.length && minS >= 2) {
            rows.sort((a, b) => a.danger - b.danger || b.goodness - a.goodness);
            chosen = rows[0];
        } else {
            rows.sort((a, b) => b.goodness - a.goodness);
            chosen = rows[0];
        }
    } else {
        const threats = threatSeats(g, seat);
        const c = toCounts(h.hands[seat]);
        const vh = valueHint(g, seat, c, h.melds[seat]) + (h.melds[seat].length === 0 ? 1 : 0);
        if (shouldFold(g, seat, minS, threats, vh)) {
            rows.sort((a, b) => a.danger - b.danger || b.goodness - a.goodness);
            chosen = rows[0];
        } else {
            const pressure = threats.reduce((s, t) => s + t.w, 0);
            const weight = minS === 0 ? 180 : minS === 1 ? 500 : 900;
            rows.forEach(r => { r.score = r.goodness - r.danger * weight * pressure; });
            rows.sort((a, b) => b.score - a.score);
            chosen = rows[0];
        }
    }
    const t = pickTileOfKind(cands, chosen.k);
    // リーチ するか
    let riichi = false;
    if (opt.riichi.includes(t) || opt.riichi.some(x => kindOf(x) === chosen.k)) {
        const rt = opt.riichi.includes(t) ? t : opt.riichi.find(x => kindOf(x) === chosen.k);
        riichi = decideRiichi(g, seat, rt, level, rng);
        if (riichi) return { t: rt, riichi: true };
    }
    return { t, riichi };
}

function decideRiichi(g, seat, t, level, rng) {
    if (level === 1) return rng() < 0.85;
    if (level === 2) return true;
    // level 3：役が あって 高い・待ちが よい ときは ダマも
    const h = g.h;
    const hand = h.hands[seat].filter(x => x !== t);
    const c = toCounts(hand);
    const w = waits(c, h.melds[seat].length);
    const vis = visibleCounts(g, seat);
    const left = w.reduce((s, k) => s + Math.max(0, 4 - vis[k] - (kindOf(t) === k ? 0 : 0)), 0);
    if (left === 0) return false;     // 空テン
    // ダマで あがれるか（ロンで）
    let damaHan = 0;
    for (const k of w) {
        const winT = k * 4;
        const r = evaluateWin(g.winContext(seat, [...hand, winT], winT, false));
        if (r) damaHan = Math.max(damaHan, r.han);
    }
    if (damaHan >= 5) return false;                    // 満貫 以上なら ダマ
    if (damaHan >= 3 && left >= 5 && g.remaining() > 20) return rng() < 0.4;
    if (g.remaining() < 8 && damaHan >= 1) return false;
    return true;
}

/* ── 手番の こうどう ── */

export function decideTurn(g, seat, opt, level, rng = Math.random) {
    const h = g.h;
    if (opt.tsumo) return { s: seat, a: 'tsumo' };
    if (opt.kyuushu) {
        const c = toCounts(h.hands[seat]);
        const kinds = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].filter(k => c[k]).length;
        if (level === 1 || kinds < 11 || level === 2) return { s: seat, a: 'kyuushu' };
    }
    if (level >= 2) {
        const threats = threatSeats(g, seat).filter(t => t.w >= 1);
        const c = toCounts(h.hands[seat]);
        const mc = h.melds[seat].length;
        // いまの いちばん よい 打牌での シャンテン数
        let bestAfter = 9;
        for (let x = 0; x < KINDS; x++) {
            if (!c[x]) continue;
            c[x]--; bestAfter = Math.min(bestAfter, shanten(c, mc)); c[x]++;
        }
        const careful = level === 3 && threats.length && bestAfter >= 1;
        for (const k of opt.ankan) {
            if (h.riichi[seat]) return { s: seat, a: 'ankan', k };
            const cc = c.slice(); cc[k] = 0;
            if (!careful && shanten(cc, mc + 1) <= bestAfter) return { s: seat, a: 'ankan', k };
        }
        if (!threats.length) {
            for (const t of opt.kakan) {
                const cc = c.slice(); cc[kindOf(t)]--;
                // その 牌を 切るのと 同じ くらい よいなら 加槓（ドラが ふえる）
                if (shanten(cc, mc) <= bestAfter && (level === 3 ? bestAfter <= 1 : rng() < 0.6)) return { s: seat, a: 'kakan', t };
            }
        }
    }
    const d = chooseDiscard(g, seat, opt, level, rng);
    return d.riichi ? { s: seat, a: 'discard', t: d.t, r: 1 } : { s: seat, a: 'discard', t: d.t };
}

/* ── 鳴く／ロン の こうどう ── */

export function decideClaim(g, seat, opt, tile, from, level, rng = Math.random) {
    if (opt.ron) return { s: seat, a: 'ron' };
    const h = g.h;
    const k = kindOf(tile);
    const c = toCounts(h.hands[seat]);
    const mc = h.melds[seat].length;
    const now = shanten(c, mc);
    const yh = yakuhaiKinds(g, seat);
    const threats = threatSeats(g, seat).filter(t => t.w >= 1);

    const tryCall = (type, used) => {
        // 鳴いた あとの いちばん よい 打牌での シャンテン数
        const cc = c.slice();
        for (const t of used) cc[kindOf(t)]--;
        const melds = [...h.melds[seat], { type, tiles: [...used, tile] }];
        let best = 9;
        for (let x = 0; x < KINDS; x++) {
            if (!cc[x] || x === k) continue;
            cc[x]--;
            best = Math.min(best, shanten(cc, mc + 1));
            cc[x]++;
        }
        const path = openYakuPath(g, seat, cc, melds);
        return { after: best, path };
    };

    if (level === 1) {
        if (opt.pon.length && yh.includes(k) && rng() < 0.5) return { s: seat, a: 'pon', t: opt.pon[0] };
        return { s: seat, a: 'pass' };
    }

    // 門前で よい 形なら 鳴かない（level 3）
    const menzen = h.melds[seat].every(m => m.type === 'ankan');
    const doraN = valueHint(g, seat, c, h.melds[seat]);

    const cands = [];
    for (const used of opt.pon) cands.push({ a: 'pon', t: used, ...tryCall('pon', used) });
    for (const used of opt.chi) cands.push({ a: 'chi', t: used, ...tryCall('chi', used) });
    let best = null;
    for (const x of cands) {
        if (x.after >= now) continue;                       // 手が すすまない
        const yakuhaiPon = x.a === 'pon' && yh.includes(k);
        const ok = yakuhaiPon || (x.path && x.path !== 'yakuhai-pair');
        if (!ok) continue;
        if (level === 2) {
            if (!yakuhaiPon && menzen && now >= 3) continue;   // まだ 遠いなら 門前で
        } else {
            if (threats.length && x.after >= 1 && doraN < 2) continue;   // リーチが いるのに 遠い 安手は 鳴かない
            if (!yakuhaiPon && menzen && now >= 2 && doraN === 0 && x.path === 'tanyao' && rng() < 0.5) continue;
        }
        // 赤は つかって さらす（のこすと 打点が かわらないので どちらでも）
        if (!best || x.after < best.after) best = x;
    }
    if (best) return { s: seat, a: best.a, t: best.t };
    if (opt.minkan && level === 3 && !threats.length && yh.includes(k)) return { s: seat, a: 'minkan' };
    return { s: seat, a: 'pass' };
}

/** プロンプトに こたえる（コンピューターの 席だけ） */
export function decide(g, seat, prompt, level, rng = Math.random) {
    if (prompt.type === 'turn') return decideTurn(g, seat, prompt.options, level, rng);
    if (prompt.type === 'claim') return decideClaim(g, seat, prompt.seats[seat], prompt.tile, prompt.from, level, rng);
    return null;
}

/** おすすめの 打牌（ヒント用：level 3 の 考え） */
export function recommendDiscard(g, seat, opt) {
    const r = chooseDiscard(g, seat, opt, 3, () => 0.5);
    return r.t;
}
