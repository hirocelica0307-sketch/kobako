/* 麻雀ドリルの 問題を つくる（node mahjong/drill/gen.mjs → mahjong/drill-data.js）
   ------------------------------------------------------------------
   こたえは 2とおりで 計算して、一致した 問題だけを のこします。
     ① アプリの エンジン（hand.js の shanten / waits / ukeire、score.js の evaluateWin、calc.js の pointsLabel）
     ② drill/check.js（エンジンとは べつに いちから 書いた 計算・点数は 早見表を そのまま 書いた もの）
   2つが ちがったら その場で とめます（どちらかに まちがいが ある しるしなので）。
   同じ 形の 問題（色を 入れかえた・数字を 逆に した だけの もの）は 1つに します。
   乱数の 種が 同じなら 何度 つくっても 同じ 問題に なります。
   ------------------------------------------------------------------ */
import { writeFileSync } from 'fs';
import { makeRng, DEFAULT_RULES } from '../engine.js';
import { shanten as eShanten, waits as eWaits, ukeire as eUkeire } from '../hand.js';
import { evaluateWin } from '../score.js';
import { pointsLabel } from '../calc.js';
import * as C from './check.js';

const rng = makeRng('nami-drill-v1');
const R = n => Math.floor(rng() * n);
const pick = a => a[R(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const zeros = () => new Array(34).fill(0);
const SUITS = ['m', 'p', 's', 'z'];

/** counts → '123m456p11z' */
export function str(c, red = null) {
    let out = '';
    for (let s = 0; s < 4; s++) {
        let part = '';
        for (let i = 0; i < 9; i++) {
            const k = s * 9 + i;
            if (k >= 34) break;
            for (let n = 0; n < c[k]; n++) part += (red && red[k] && n === 0) ? '0' : String(i + 1);
        }
        if (part) out += part + SUITS[s];
    }
    return out;
}
const kstr = k => `${(k % 9) + 1}${SUITS[Math.floor(k / 9)]}`;

/* ── 同じ 形を 見つける ── */
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
function canonical(c, honorsFree = true) {
    let best = null;
    for (const p of PERMS) for (let mir = 0; mir < 8; mir++) {
        let s = '';
        for (let i = 0; i < 3; i++) {
            const src = p[i] * 9;
            const flip = (mir >> i) & 1;
            for (let n = 0; n < 9; n++) s += c[src + (flip ? 8 - n : n)];
            s += '|';
        }
        const hon = c.slice(27);
        s += honorsFree ? hon.slice().sort().join('') : hon.join('');
        if (best === null || s < best) best = s;
    }
    return best;
}

/* ── 手を つくる ── */
function completeHand({ honor = 0.25, maxCopy = 3, suitOnly = -1 } = {}) {
    for (;;) {
        const c = zeros();
        const randKind = () => {
            if (suitOnly >= 0) return suitOnly * 9 + R(9);
            return rng() < honor ? 27 + R(7) : R(27);
        };
        const head = randKind();
        c[head] += 2;
        let ok = true;
        for (let i = 0; i < 4; i++) {
            const k = randKind();
            if (k < 27 && k % 9 <= 6 && rng() < 0.65) { c[k]++; c[k + 1]++; c[k + 2]++; }
            else c[k] += 3;
        }
        for (let k = 0; k < 34; k++) if (c[k] > maxCopy) ok = false;
        if (ok) return c;
    }
}

function perturb(c0, r, { honor = 0.25, maxCopy = 3, suitOnly = -1 } = {}) {
    for (let tries = 0; tries < 50; tries++) {
        const c = c0.slice();
        for (let i = 0; i < r; i++) {
            const have = []; for (let k = 0; k < 34; k++) for (let n = 0; n < c[k]; n++) have.push(k);
            c[pick(have)]--;
        }
        let ok = true;
        for (let i = 0; i < r; i++) {
            const k = suitOnly >= 0 ? suitOnly * 9 + R(9) : (rng() < honor ? 27 + R(7) : R(27));
            c[k]++;
            if (c[k] > maxCopy) ok = false;
        }
        if (ok) return c;
    }
    return null;
}

const sum = c => c.reduce((a, b) => a + b, 0);
function fail(msg, data) { console.error('一致しない！', msg, JSON.stringify(data)); process.exit(1); }

/* ── 何切る ── */
function engineTable(c14) {
    const rows = [];
    for (let d = 0; d < 34; d++) {
        if (!c14[d]) continue;
        const c = c14.slice(); c[d]--;
        const u = eUkeire(c, 0, c14);
        rows.push({ d, s: u.shanten, total: u.total });
    }
    return rows;
}

function nanikiruOK(c14, want, minChoices = 3) {
    const er = engineTable(c14), cr = C.discardTable(c14);
    for (let i = 0; i < er.length; i++) if (er[i].d !== cr[i].d || er[i].s !== cr[i].s || er[i].total !== cr[i].total) fail('何切る', { c14: str(c14), e: er[i], c: cr[i] });
    const minS = Math.min(...cr.map(r => r.s));
    if (!want(minS)) return null;
    const keep = cr.filter(r => r.s === minS).sort((a, b) => b.total - a.total);
    if (keep.length < minChoices) return null;
    if (keep[0].total - keep[1].total < 2) return null;      // こたえが 1つに きまる（2枚 以上の 差）
    return { ans: keep[0].d, minS, best: keep[0].total, second: keep[1].total };
}

function makeNanikiru(count, gen, want, opt = {}) {
    const out = [], seen = new Set();
    let honorAns = 0, tries = 0;
    while (out.length < count && tries++ < 400000) {
        const c = gen();
        if (!c || sum(c) !== 14) continue;
        const key = canonical(c);
        if (seen.has(key)) continue;
        const r = nanikiruOK(c, want, opt.minChoices ?? 3);
        if (!r) continue;
        if (r.ans >= 27 && opt.maxHonorShare !== undefined && honorAns >= count * opt.maxHonorShare) continue;
        if (r.ans >= 27) honorAns++;
        seen.add(key);
        out.push([str(c), r.ans]);
    }
    return out;
}

/* ── 待ち ── */
function waitsBoth(c13) {
    const e = eWaits(c13.slice(), 0).filter(k => c13[k] < 4);
    const w = C.waitsOf(c13.slice(), 0);
    if (e.join() !== w.join()) fail('待ち', { c13: str(c13), e, w });
    return w;
}

function distractors(waits, pool) {
    const ws = new Set(waits);
    const opts = new Map();
    const add = s => { const a = [...new Set(s)].sort((x, y) => x - y); if (!a.length) return; const key = a.join(','); if (key !== waits.join(',')) opts.set(key, a); };
    const non = pool.filter(k => !ws.has(k));
    if (waits.length > 1) for (const w of waits) add(waits.filter(x => x !== w));          // 1つ 足りない
    for (const n of non) add([...waits, n]);                                                // 1つ 多い
    for (const w of waits) for (const n of non) add([...waits.filter(x => x !== w), n]);    // 1つ ちがう
    const all = shuffle([...opts.values()]);
    // 近い ものを 優先（枚数が 同じ くらい）
    all.sort((a, b) => Math.abs(a.length - waits.length) - Math.abs(b.length - waits.length));
    return all.slice(0, 8).sort(() => rng() - 0.5).slice(0, 3);
}

function makeWaits(count, gen, minWaits) {
    const out = [], seen = new Set();
    let tries = 0;
    while (out.length < count && tries++ < 400000) {
        const c = gen();
        if (!c || sum(c) !== 13) continue;
        const key = canonical(c);
        if (seen.has(key)) continue;
        if (C.shanten(c.slice()) !== 0 || eShanten(c.slice(), 0) !== 0) continue;
        const w = waitsBoth(c);
        if (w.length < minWaits) continue;
        // 待ちの 牌が 手の 中に 4枚 ない（のこりが ある）こと
        if (w.some(k => c[k] >= 4)) continue;
        const pool = [];
        const suitsUsed = new Set(w.map(k => Math.floor(k / 9)));
        for (const s of suitsUsed) for (let i = 0; i < 9; i++) if (s < 3) pool.push(s * 9 + i);
        if (!pool.length) for (let k = 0; k < 34; k++) if (c[k]) pool.push(k);
        const ds = distractors(w, pool.filter(k => c[k] < 4));
        if (ds.length < 3) continue;
        seen.add(key);
        out.push([str(c), w, ds]);
    }
    return out;
}

/* ── シャンテン数 ── */
function makeShanten(perValue) {
    const out = [], seen = new Set();
    const got = [0, 0, 0, 0, 0];
    let tries = 0;
    while (got.some(n => n < perValue) && tries++ < 600000) {
        const base = completeHand({ honor: 0.25 });
        const r = 1 + R(6);
        const c = perturb(base, r);
        if (!c) continue;
        // 13枚に する
        const have = []; for (let k = 0; k < 34; k++) for (let n = 0; n < c[k]; n++) have.push(k);
        c[pick(have)]--;
        const key = canonical(c);
        if (seen.has(key)) continue;
        const e = eShanten(c.slice(), 0), m = C.shanten(c.slice());
        if (e !== m) fail('シャンテン', { c: str(c), e, m });
        if (m < 0 || m > 4 || got[m] >= perValue) continue;
        seen.add(key);
        got[m]++;
        out.push([str(c), m]);
    }
    return shuffle(out);
}

/* ── あがりの 手（符・点数） ── */
/** 牌の id を わりあてる（同じ 牌を 2回 つかわない。赤5は 手の 中で red の ときだけ id k*4） */
function allocator(red) {
    const used = {};
    return (k, closed) => {
        const five = k === 4 || k === 13 || k === 22;
        if (five && closed && red && red[k] && !used['r' + k]) { used['r' + k] = 1; return k * 4; }
        const order = five ? [1, 2, 3, 0] : [0, 1, 2, 3];
        used[k] = used[k] || 0;
        for (;;) {
            const id = k * 4 + order[used[k]++];
            if (five && id === k * 4 && used['r' + k]) continue;
            return id;
        }
    };
}

function makeAgari({ openRate, kanRate, honor, doraN, redRate, riichiRate }) {
    for (;;) {
        const all = zeros();
        const closed = zeros();
        const melds = [];
        const randKind = () => (rng() < honor ? 27 + R(7) : R(27));
        const head = randKind();
        closed[head] += 2; all[head] += 2;
        const open = rng() < openRate;
        let bad = false;
        for (let i = 0; i < 4; i++) {
            const k = randKind();
            const seq = k < 27 && k % 9 <= 6 && rng() < 0.55;
            const asMeld = open && i < 3 && rng() < 0.6;
            const kan = !seq && rng() < kanRate;
            if (seq) {
                for (const x of [k, k + 1, k + 2]) all[x]++;
                if (asMeld) melds.push({ type: 'chi', k });
                else for (const x of [k, k + 1, k + 2]) closed[x]++;
            } else if (kan) {
                all[k] += 4;
                if (asMeld) melds.push({ type: 'minkan', k });
                else melds.push({ type: 'ankan', k });
            } else {
                all[k] += 3;
                if (asMeld) melds.push({ type: 'pon', k });
                else closed[k] += 3;
            }
        }
        for (let k = 0; k < 34; k++) if (all[k] > 4) bad = true;
        if (bad) continue;
        const closedKinds = []; for (let k = 0; k < 34; k++) if (closed[k]) closedKinds.push(k);
        const win = pick(closedKinds);
        const tsumo = rng() < 0.45;
        const seat = R(4), round = R(2);
        const menzen = melds.every(m => m.type === 'ankan');
        const riichi = menzen && rng() < riichiRate;
        const red = zeros();
        for (const f of [4, 13, 22]) if (closed[f] && rng() < redRate) red[f] = 1;
        const dora = [];
        for (let i = 0; i < doraN; i++) dora.push(R(34));
        if (dora.some(d => all[d] + dora.filter(x => x === d).length > 4)) continue;
        return { closed, all, melds, win, tsumo, seat, round, riichi, red, dora };
    }
}

function engineEval(h) {
    const take = allocator(h.red);
    const closedIds = [];
    for (let k = 0; k < 34; k++) for (let n = 0; n < h.closed[k]; n++) closedIds.push(take(k, true));
    // あがり牌の id（赤でない ものを 優先）
    const winId = closedIds.filter(id => (id >> 2) === h.win).sort((a, b) => (a % 4 === 0) - (b % 4 === 0))[0];
    const melds = h.melds.map(m => {
        const ks = m.type === 'chi' ? [m.k, m.k + 1, m.k + 2] : new Array(m.type === 'pon' ? 3 : 4).fill(m.k);
        const tiles = ks.map(k => take(k, false));
        return { type: m.type, tiles, called: tiles[0], from: 3 };
    });
    const ids = [...closedIds, ...melds.flatMap(m => m.tiles)];
    if (new Set(ids).size !== ids.length || ids.some(id => id < 0 || id > 135)) fail('id', { h: packAgari(h, {}), ids });
    const ctx = {
        closed: closedIds, melds, winTile: winId, tsumo: h.tsumo, seatWind: h.seat, roundWind: h.round,
        riichi: h.riichi, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
        tenhou: false, chiihou: false, doraInd: h.dora, uraInd: [], rules: DEFAULT_RULES
    };
    const r = evaluateWin(ctx);
    if (r) r.redCount = ids.filter(id => id === 16 || id === 52 || id === 88).length;
    return r;
}

function checkerReadings(h) {
    const ch = { closed: h.closed, win: h.win, melds: h.melds, tsumo: h.tsumo, seat: h.seat, round: h.round, riichi: h.riichi };
    if (C.isChiitoiShape(h.closed)) return { chiitoi: true, list: [] , ch };
    return { chiitoi: false, list: C.readings(ch), ch };
}

function packAgari(h, extra) {
    return {
        c: str(h.closed, h.red), w: h.win, m: h.melds.map(m => [m.type, m.k]), t: h.tsumo ? 1 : 0, s: h.seat, r: h.round,
        q: h.riichi ? 1 : 0, d: h.dora, ...extra
    };
}

function makeFu(target) {
    const out = [], seen = new Set();
    const got = {};
    let tries = 0;
    const presets = [
        { openRate: 0, kanRate: 0, honor: 0.15, riichiRate: 0.6 },
        { openRate: 0.6, kanRate: 0.05, honor: 0.3, riichiRate: 0 },
        { openRate: 0.3, kanRate: 0.35, honor: 0.4, riichiRate: 0.4 },
        { openRate: 0, kanRate: 0.15, honor: 0.45, riichiRate: 0.5 }
    ];
    while (Object.keys(target).some(f => (got[f] || 0) < target[f]) && tries++ < 3000000) {
        const p = pick(presets);
        let h;
        if (rng() < 0.08) {
            // 七対子
            const c = zeros(); const kinds = shuffle([...Array(34).keys()]).slice(0, 7);
            for (const k of kinds) c[k] = 2;
            h = { closed: c, all: c, melds: [], win: pick(kinds), tsumo: rng() < 0.45, seat: R(4), round: R(2), riichi: rng() < 0.5, red: zeros(), dora: [] };
        } else h = makeAgari({ ...p, doraN: 0, redRate: 0 });
        const r = engineEval(h);
        if (!r || r.yakuman) continue;
        const cr = checkerReadings(h);
        let fu;
        if (cr.chiitoi) {
            if (C.decomps(h.closed, 4).length) continue;   // 二盃口と かさなる 形は のぞく
            fu = 25;
        } else {
            if (!cr.list.length) fail('分けかた なし', { h: packAgari(h, {}) });
            const fus = new Set(cr.list.map(x => C.fuOf(cr.ch, x).fu));
            if (fus.size !== 1) continue;                    // 読みかたで 符が かわる 手は のぞく
            fu = [...fus][0];
        }
        if (fu !== r.fu) fail('符', { h: packAgari(h, {}), engine: r.fu, checker: fu });
        if (!target[fu] || (got[fu] || 0) >= target[fu]) continue;
        const key = JSON.stringify([h.closed, h.win, h.melds, h.tsumo, h.seat === 0, (27 + h.seat), 27 + h.round]);
        if (seen.has(key)) continue;
        seen.add(key);
        got[fu] = (got[fu] || 0) + 1;
        out.push(packAgari(h, { f: fu }));
    }
    console.log('符の 問題', got);
    return shuffle(out);
}

const SIMPLE_NAMES = new Set(['立直', '門前清自摸和', '平和', '断么九', '一盃口', '役牌 白', '役牌 發', '役牌 中', '自風 東', '自風 南', '自風 西', '自風 北', '場風 東', '場風 南', '混一色', '対々和']);

function makePoints(count) {
    const out = [], seen = new Set();
    const byHan = {};
    let tries = 0;
    const presets = [
        { openRate: 0, kanRate: 0, honor: 0.12, riichiRate: 0.7, doraN: 1, redRate: 0.3 },
        { openRate: 0.6, kanRate: 0.05, honor: 0.35, riichiRate: 0, doraN: 1, redRate: 0.3 },
        { openRate: 0.2, kanRate: 0.2, honor: 0.3, riichiRate: 0.5, doraN: 2, redRate: 0.4 },
        { openRate: 0, kanRate: 0.05, honor: 0.25, riichiRate: 0.5, doraN: 1, redRate: 0.5 }
    ];
    while (out.length < count && tries++ < 3000000) {
        const h = makeAgari(pick(presets));
        const r = engineEval(h);
        if (!r || r.yakuman) continue;
        if (!r.yaku.every(y => SIMPLE_NAMES.has(y.name))) continue;
        const cr = checkerReadings(h);
        if (cr.chiitoi || cr.list.length !== 1) continue;    // 読みかたが 1とおりの 手だけ
        const rd = cr.list[0];
        const sy = C.simpleYaku(cr.ch, rd);
        if (!sy) continue;
        const f = C.fuOf(cr.ch, rd).fu;
        // ドラ・赤
        let dora = 0;
        const allC = h.all;
        for (const ind of h.dora) {
            const k = ind < 27 ? Math.floor(ind / 9) * 9 + ((ind % 9) + 1) % 9 : ind <= 30 ? 27 + ((ind - 27) + 1) % 4 : 31 + ((ind - 31) + 1) % 3;
            dora += allC[k];
        }
        if ([4, 13, 22].some(k => h.all[k] === 4)) continue;      // 5の 4枚目（赤）が 鳴きに 入る 形は のぞく
        const aka = [4, 13, 22].filter(k => h.red[k]).length;
        if (aka !== r.redCount) fail('赤', { h: packAgari(h, {}), aka, eng: r.redCount });
        const han = sy.han + dora + aka;
        if (sy.han === 0) continue;
        if (han !== r.han || f !== r.fu) fail('点数', { h: packAgari(h, {}), engine: [r.han, r.fu, r.yaku], checker: [han, f, sy.yaku, dora, aka] });
        const dealer = h.seat === 0;
        const label = pointsLabel(r.base, dealer, h.tsumo);
        const ref = C.refLabel(han, f, dealer, h.tsumo);
        if (label !== ref) fail('点数の 表', { h: packAgari(h, {}), label, ref, han, f });
        const hk = Math.min(han, 7);
        if ((byHan[hk] || 0) >= count / 5) continue;          // 翻が かたよらない ように
        const key = JSON.stringify([h.closed, h.red, h.win, h.melds, h.tsumo, h.seat, h.round, h.riichi, h.dora]);
        if (seen.has(key)) continue;
        seen.add(key);
        byHan[hk] = (byHan[hk] || 0) + 1;
        out.push(packAgari(h, { f, h: han, l: label }));
    }
    console.log('点数の 問題（翻ごと）', byHan);
    return shuffle(out);
}

/* ── リーチへの 安全牌 ── */
function riverOf(n) {
    const v = [];
    const c = zeros();
    while (v.length < n) {
        const k = rng() < 0.3 ? 27 + R(7) : R(27);
        if (c[k] >= 2) continue;
        c[k]++; v.push(k);
    }
    return v;
}
const isSuji = (k, river) => {
    if (k >= 27) return false;
    const n = k % 9, s = k - n;
    const has = x => river.includes(s + x);
    if (n <= 2) return has(n + 3);
    if (n >= 6) return has(n - 3);
    return has(n - 3) && has(n + 3);
};
const halfSuji = (k, river) => { if (k >= 27) return false; const n = k % 9, s = k - n; return (n - 3 >= 0 && river.includes(s + n - 3)) || (n + 3 <= 8 && river.includes(s + n + 3)); };

function makeGenbutsu(count) {
    const out = [], seen = new Set();
    let tries = 0;
    while (out.length < count && tries++ < 200000) {
        const river = riverOf(6 + R(9));
        const ri = Math.max(1, river.length - 1 - R(4));
        const base = completeHand({ honor: 0.25 });
        const c = perturb(base, 2 + R(3));
        if (!c) continue;
        const inHand = []; for (let k = 0; k < 34; k++) if (c[k]) inHand.push(k);
        const safe = inHand.filter(k => river.includes(k));
        // 2つめの たしかめ：捨て牌を 1枚ずつ 見て 手の 中に あるか
        const safe2 = []; for (const k of river) if (c[k] && !safe2.includes(k)) safe2.push(k);
        if (safe.length !== safe2.length) fail('現物', { river, c: str(c) });
        if (safe.length !== 1) continue;
        const key = str(c) + '|' + river.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ v: river, i: ri, h: str(c), a: safe[0] });
    }
    return out;
}

function makeSuji(count) {
    const out = [], seen = new Set();
    let tries = 0;
    while (out.length < count && tries++ < 200000) {
        const river = riverOf(7 + R(8));
        const ri = Math.max(1, river.length - 1 - R(4));
        const nums = [...Array(27).keys()].filter(k => !river.includes(k));
        const sujiTiles = nums.filter(k => isSuji(k, river));
        const bad = nums.filter(k => !isSuji(k, river) && !halfSuji(k, river));
        if (!sujiTiles.length || bad.length < 3) continue;
        const a = pick(sujiTiles);
        const ds = shuffle(bad.slice()).slice(0, 3);
        // 2つめの たしかめ：スジの 一覧を べつの 書きかたで つくる
        const list = new Set();
        for (const d of river) { if (d >= 27) continue; const n = d % 9, s = d - n; if (n >= 3 && n <= 5) { } if (n + 3 <= 8) list.add(`${s}:${n}+`); if (n - 3 >= 0) list.add(`${s}:${n}-`); }
        const suji2 = k => { const n = k % 9, s = k - n; if (n <= 2) return list.has(`${s}:${n + 3}-`); if (n >= 6) return list.has(`${s}:${n - 3}+`); return list.has(`${s}:${n - 3}+`) && list.has(`${s}:${n + 3}-`); };
        if (!suji2(a) || ds.some(suji2)) fail('スジ', { river, a, ds });
        const key = river.join(',') + '|' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ v: river, i: ri, c: shuffle([a, ...ds]), a });
    }
    return out;
}

/* ── つくる ── */
const t0 = Date.now();
const D = {};
D.nk1 = makeNanikiru(160, () => perturb(completeHand({ honor: 0.3 }), 3 + R(2), { honor: 0.3 }), s => s >= 2 && s <= 3, { maxHonorShare: 0.3 });
console.log('何切る 基本', D.nk1.length);
D.nk2 = makeNanikiru(160, () => perturb(completeHand({ honor: 0.2 }), 2 + R(2), { honor: 0.2 }), s => s === 1, { maxHonorShare: 0.2 });
console.log('何切る 1シャンテン', D.nk2.length);
D.nk3 = makeNanikiru(130, () => perturb(completeHand({ honor: 0.15 }), 1 + R(2), { honor: 0.15 }), s => s === 0, { minChoices: 2, maxHonorShare: 0.1 });
console.log('何切る テンパイ取り', D.nk3.length);
D.nk4 = makeNanikiru(150, () => { const s = R(3); return perturb(completeHand({ suitOnly: s }), 1 + R(3), { suitOnly: s }); }, s => s <= 1, { minChoices: 3 });
console.log('何切る 清一色', D.nk4.length);
D.wt1 = makeWaits(140, () => { const s = R(3); const c = perturb(completeHand({ suitOnly: s }), R(2), { suitOnly: s }); if (!c) return null; const have = []; for (let k = 0; k < 34; k++) for (let n = 0; n < c[k]; n++) have.push(k); c[pick(have)]--; return c; }, 2);
console.log('待ち 清一色', D.wt1.length);
D.wt2 = makeWaits(100, () => { const c = completeHand({ honor: 0.25 }); const have = []; for (let k = 0; k < 34; k++) for (let n = 0; n < c[k]; n++) have.push(k); c[pick(have)]--; return c; }, 1);
console.log('待ち いろいろ', D.wt2.length);
D.sh = makeShanten(30);
console.log('シャンテン', D.sh.length);
D.fu = makeFu({ 20: 30, 25: 25, 30: 60, 40: 60, 50: 45, 60: 35, 70: 25, 80: 20, 90: 15, 100: 10, 110: 8 });
D.pt = makePoints(260);
console.log('点数', D.pt.length);
D.gb = makeGenbutsu(90);
D.sj = makeSuji(90);
console.log('現物', D.gb.length, 'スジ', D.sj.length);

const total = Object.values(D).reduce((s, a) => s + a.length, 0);
const body = `/* 麻雀ドリルの 問題（drill/gen.mjs で 自動で つくった もの。手で なおさない）
   ぜんぶで ${total}問。こたえは アプリの エンジンと drill/check.js の 2とおりで 一致を たしかめて あります。
   nk1 何切る（基本）・nk2 何切る（1シャンテン）・nk3 何切る（テンパイ取り）・nk4 何切る（清一色）
   wt1 待ち（清一色）・wt2 待ち（いろいろ）・sh シャンテン数・fu 符・pt 点数・gb 現物・sj スジ */
export const DRILL = ${JSON.stringify(D)};
`;
writeFileSync(new URL('../drill-data.js', import.meta.url), body);
console.log('ぜんぶで', total, '問', `${Math.round((Date.now() - t0) / 1000)}秒`, `${Math.round(body.length / 1024)}KB`);
