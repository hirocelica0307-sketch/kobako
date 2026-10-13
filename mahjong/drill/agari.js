/* 麻雀ドリル：画面に よらない 部分（drill.js・tests.js から つかう）
   ・'123m0p' の 書きかたを 読む（0 は 赤5）
   ・あがりの 問題の データ → evaluateWin の 入力（牌の id の わりあては drill/gen.mjs と 同じ）
   ・「翻と 符」の 早見表の 問題の 一覧 */
import { evaluateWin } from '../score.js';
import { DEFAULT_RULES, makeRng } from '../engine.js';

/** '123m0p' → [{k, red}] */
export function parse(str) {
    const out = [];
    let nums = [];
    for (const ch of str) {
        if (/[0-9]/.test(ch)) { nums.push(ch); continue; }
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const n of nums) out.push(n === '0' ? { k: base + 4, red: true } : { k: base + Number(n) - 1, red: false });
        nums = [];
    }
    return out;
}
export const countsOf = str => { const c = new Array(34).fill(0); for (const t of parse(str)) c[t.k]++; return c; };

/* ── あがりの 手（gen.mjs と 同じ わりあて） ── */
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

/** 問題の データ → evaluateWin の 入力と 画面用の 牌 */
export function agariOf(q) {
    const tiles = parse(q.c);
    const closed = new Array(34).fill(0), red = new Array(34).fill(0);
    for (const t of tiles) { closed[t.k]++; if (t.red) red[t.k] = 1; }
    const take = allocator(red);
    const closedIds = [];
    for (let k = 0; k < 34; k++) for (let n = 0; n < closed[k]; n++) closedIds.push(take(k, true));
    const winId = closedIds.filter(id => (id >> 2) === q.w).sort((a, b) => (a % 4 === 0) - (b % 4 === 0))[0];
    const melds = q.m.map(([type, k]) => {
        const ks = type === 'chi' ? [k, k + 1, k + 2] : new Array(type === 'pon' ? 3 : 4).fill(k);
        const ts = ks.map(x => take(x, false));
        return { type, tiles: ts, called: ts[0], from: 3 };
    });
    const ctx = {
        closed: closedIds, melds, winTile: winId, tsumo: !!q.t, seatWind: q.s, roundWind: q.r,
        riichi: !!q.q, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
        tenhou: false, chiihou: false, doraInd: q.d || [], uraInd: [], rules: DEFAULT_RULES
    };
    return { ctx, closedIds, winId, melds, result: evaluateWin(ctx) };
}


/* 早見表の 問題（翻・符・親子・ロンツモ・本場 の くみあわせを ぜんぶ） */
export function tableItems() {
    const out = [];
    for (const han of [1, 2, 3, 4]) for (const fu of [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110]) for (const dealer of [false, true]) for (const tsumo of [false, true]) {
        if (fu === 20 && (!tsumo || han < 2)) continue;              // 20符は 平和ツモ（2翻〜）だけ
        if (fu === 25 && (han < 2 || (tsumo && han < 3))) continue;   // 25符は 七対子（ツモは 3翻〜）
        if (fu * Math.pow(2, han + 2) >= 2000 && !(han === 4 && fu === 40) && !(han === 3 && fu === 70)) continue;
        out.push({ han, fu, dealer, tsumo, honba: 0 });
    }
    // 満貫いじょう
    for (const han of [5, 6, 8, 11, 13]) for (const dealer of [false, true]) for (const tsumo of [false, true]) out.push({ han, fu: 30, dealer, tsumo, honba: 0 });
    // 本場つき
    const rng = makeRng('tb-honba');
    const base = out.filter(x => x.han <= 4).slice();
    for (let i = 0; i < 40; i++) { const b = base[Math.floor(rng() * base.length)]; out.push({ ...b, honba: 1 + Math.floor(rng() * 3) }); }
    return out;
}
