/* 麻雀ドリルの こたえを たしかめる「もう1つの 計算」
   ------------------------------------------------------------------
   アプリの エンジン（hand.js・score.js）とは べつに、いちから 書いた 計算です。
   問題の こたえは「エンジン」と「この 計算」の 2つが 一致した ものだけを つかいます。
   （tests.js と drill/gen.mjs から つかう。画面では つかわない）
     ・シャンテン数（一般手は 色ごとに 面子・塔子を さがす／七対子／国士無双）
     ・待ち（1枚 たして あがりに なる 牌）
     ・あがりの 分けかた・符（待ちの 形も ふくめて）
     ・かんたんな 役の 翻（立直・門前ツモ・平和・断么九・役牌・一盃口・混一色・対々和）
     ・点数の 早見表（本や サイトに のって いる 表を そのまま 書いた もの）
   牌の 種類：0〜8 萬子・9〜17 筒子・18〜26 索子・27〜30 東南西北・31 白・32 發・33 中
   ------------------------------------------------------------------ */

const YAO = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
export const isYao = k => YAO.has(k);

/* ── シャンテン数 ── */

// 1つの 色（9種類）で とれる（面子, 塔子, 雀頭）の くみあわせを ぜんぶ
const suitMemo = new Map();
function suitCombos(a) {
    const key = a.join('');
    if (suitMemo.has(key)) return suitMemo.get(key);
    const out = new Set();
    const c = a.slice();
    const walk = (i, m, t, h) => {
        while (i < 9 && c[i] === 0) i++;
        if (i >= 9) { out.add(`${m},${t},${h}`); return; }
        // 刻子
        if (c[i] >= 3) { c[i] -= 3; walk(i, m + 1, t, h); c[i] += 3; }
        // 順子
        if (i <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; walk(i, m + 1, t, h); c[i]++; c[i + 1]++; c[i + 2]++; }
        // 雀頭
        if (c[i] >= 2 && !h) { c[i] -= 2; walk(i, m, t, 1); c[i] += 2; }
        // 対子（塔子として）
        if (c[i] >= 2) { c[i] -= 2; walk(i, m, t + 1, h); c[i] += 2; }
        // 両面・辺張
        if (i <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; walk(i, m, t + 1, h); c[i]++; c[i + 1]++; }
        // 嵌張
        if (i <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; walk(i, m, t + 1, h); c[i]++; c[i + 2]++; }
        // つかわない（浮き牌）
        c[i]--; walk(i, m, t, h); c[i]++;
    };
    walk(0, 0, 0, 0);
    const res = [...out].map(s => s.split(',').map(Number));
    suitMemo.set(key, res);
    return res;
}

function honorCombos(n) {
    // 字牌 1種類の 枚数 n から（面子, 塔子, 雀頭）
    const out = [[0, 0, 0]];
    if (n >= 2) out.push([0, 1, 0], [0, 0, 1]);
    if (n >= 3) out.push([1, 0, 0]);
    if (n === 4) out.push([1, 0, 0], [0, 1, 1]);
    return out;
}

/** 一般手の シャンテン数（melds：鳴いた 面子の 数） */
export function shantenRegular(c, melds = 0) {
    let lists = [];
    for (const s of [0, 9, 18]) lists.push(suitCombos(c.slice(s, s + 9)));
    for (let k = 27; k < 34; k++) lists.push(honorCombos(c[k]));
    // 色ごとの くみあわせを あわせる（雀頭は 1つまで）
    let acc = new Map([['0,0,0', [0, 0, 0]]]);
    for (const L of lists) {
        const next = new Map();
        for (const [, [m, t, h]] of acc) {
            for (const [m2, t2, h2] of L) {
                if (h + h2 > 1) continue;
                const v = [Math.min(m + m2, 4), Math.min(t + t2, 8), h + h2];
                next.set(v.join(','), v);
            }
        }
        acc = next;
    }
    let best = 99;
    for (const [, [m0, t0, h]] of acc) {
        const m = m0 + melds;
        const t = Math.min(t0, Math.max(0, 4 - m));
        best = Math.min(best, 8 - 2 * m - t - h);
    }
    return best;
}

export function shantenChiitoi(c) {
    let pairs = 0, kinds = 0;
    for (let k = 0; k < 34; k++) { if (c[k] >= 1) kinds++; if (c[k] >= 2) pairs++; }
    return 6 - pairs + Math.max(0, 7 - kinds);
}

export function shantenKokushi(c) {
    let kinds = 0, pair = 0;
    for (const k of YAO) { if (c[k] >= 1) kinds++; if (c[k] >= 2) pair = 1; }
    return 13 - kinds - pair;
}

/** シャンテン数（一般手・七対子・国士の いちばん 小さい もの）。-1 は あがり */
export function shanten(c, melds = 0) {
    let s = shantenRegular(c, melds);
    if (melds === 0) s = Math.min(s, shantenChiitoi(c), shantenKokushi(c));
    return s;
}

/** 待ち：1枚 たして あがり（-1）に なる 牌。自分で 4枚 もって いる 牌は のぞく */
export function waitsOf(c, melds = 0) {
    const out = [];
    for (let k = 0; k < 34; k++) {
        if (c[k] >= 4) continue;
        c[k]++;
        if (shanten(c, melds) === -1) out.push(k);
        c[k]--;
    }
    return out;
}

/** 何切るの 表：14枚から 1枚 切った ときの シャンテン数と 受け入れ（のこり枚数は 14枚を 見えて いる 牌と して かぞえる） */
export function discardTable(c14, melds = 0) {
    const rows = [];
    for (let d = 0; d < 34; d++) {
        if (!c14[d]) continue;
        const c = c14.slice(); c[d]--;
        const s = shanten(c, melds);
        let total = 0;
        const kinds = [];
        for (let k = 0; k < 34; k++) {
            const left = 4 - c14[k];
            if (left <= 0) continue;
            c[k]++;
            if (shanten(c, melds) < s) { total += left; kinds.push(k); }
            c[k]--;
        }
        rows.push({ d, s, total, kinds });
    }
    return rows;
}

/* ── あがりの 分けかた ── */

/** 4面子1雀頭（鳴きを のぞいた 部分）の 分けかたを ぜんぶ */
export function decomps(c, setsNeeded) {
    const res = [];
    for (let h = 0; h < 34; h++) {
        if (c[h] < 2) continue;
        const cc = c.slice(); cc[h] -= 2;
        const sets = [];
        const walk = () => {
            let k = 0;
            while (k < 34 && cc[k] === 0) k++;
            if (k === 34) { if (sets.length === setsNeeded) res.push({ head: h, sets: sets.map(s => ({ ...s })) }); return; }
            if (cc[k] >= 3) { cc[k] -= 3; sets.push({ type: 'kou', k }); walk(); sets.pop(); cc[k] += 3; }
            if (k < 27 && k % 9 <= 6 && cc[k + 1] && cc[k + 2]) { cc[k]--; cc[k + 1]--; cc[k + 2]--; sets.push({ type: 'shun', k }); walk(); sets.pop(); cc[k]++; cc[k + 1]++; cc[k + 2]++; }
        };
        walk();
    }
    // 同じ ものを まとめる
    const seen = new Set();
    return res.filter(d => { const key = d.head + ':' + d.sets.map(s => s.type + s.k).sort().join(','); if (seen.has(key)) return false; seen.add(key); return true; });
}

/**
 * あがりの 読みかた（分けかた × あがり牌の 入った 場所）を ぜんぶ かえす
 * h：{ closed:counts(あがり牌 こみ), win:k, melds:[{type:'chi'|'pon'|'minkan'|'ankan', k}], tsumo, seat, round }
 */
export function readings(h) {
    const need = 4 - h.melds.length;
    const out = [];
    for (const d of decomps(h.closed, need)) {
        const its = [];
        if (d.head === h.win) its.push({ wait: 'tanki', idx: -1 });
        d.sets.forEach((s, i) => {
            if (s.type === 'kou' && s.k === h.win) its.push({ wait: 'shanpon', idx: i });
            if (s.type === 'shun' && h.win >= s.k && h.win <= s.k + 2) {
                const p = h.win - s.k;
                let w;
                if (p === 1) w = 'kanchan';
                else if (p === 0) w = s.k % 9 === 6 ? 'penchan' : 'ryanmen';
                else w = s.k % 9 === 0 ? 'penchan' : 'ryanmen';
                its.push({ wait: w, idx: i });
            }
        });
        for (const it of its) out.push({ head: d.head, sets: d.sets, wait: it.wait, idx: it.idx });
    }
    return out;
}

/** 1つの 読みかたの 符 */
export function fuOf(h, r) {
    const menzen = h.melds.every(m => m.type === 'ankan');
    const valueHead = r.head >= 31 || r.head === 27 + h.seat || r.head === 27 + h.round;
    const allShun = r.sets.every(s => s.type === 'shun') && h.melds.length === 0;
    const pinfu = menzen && allShun && !valueHead && r.wait === 'ryanmen';
    if (pinfu) return { fu: h.tsumo ? 20 : 30, pinfu: true };
    let fu = 20;
    if (menzen && !h.tsumo) fu += 10;
    if (h.tsumo) fu += 2;
    const tri = (k, closed, kan) => { let f = 2; if (isYao(k)) f *= 2; if (closed) f *= 2; if (kan) f *= 4; return f; };
    r.sets.forEach((s, i) => {
        if (s.type !== 'kou') return;
        const ronMade = i === r.idx && r.wait === 'shanpon' && !h.tsumo;
        fu += tri(s.k, !ronMade, false);
    });
    for (const m of h.melds) {
        if (m.type === 'pon') fu += tri(m.k, false, false);
        if (m.type === 'minkan') fu += tri(m.k, false, true);
        if (m.type === 'ankan') fu += tri(m.k, true, true);
    }
    if (r.head >= 31) fu += 2;
    if (r.head === 27 + h.seat) fu += 2;
    if (r.head === 27 + h.round) fu += 2;
    if (r.wait === 'kanchan' || r.wait === 'penchan' || r.wait === 'tanki') fu += 2;
    let up = Math.ceil(fu / 10) * 10;
    if (up === 20) up = 30;
    return { fu: up, raw: fu, pinfu: false };
}

/** 七対子か */
export function isChiitoiShape(c) {
    let pairs = 0;
    for (let k = 0; k < 34; k++) { if (c[k] === 2) pairs++; else if (c[k] !== 0) return false; }
    return pairs === 7;
}

/* ── かんたんな 役（この 範囲の 役だけで できた 手に つかう） ── */

/** 読みかた r の 役と 翻（ドラは べつ）。この 計算で あつかえない 役が ありそうなら null */
export function simpleYaku(h, r) {
    const menzen = h.melds.every(m => m.type === 'ankan');
    const sets = [...r.sets.map((s, i) => ({ type: s.type, k: s.k, open: s.type === 'kou' && i === r.idx && r.wait === 'shanpon' && !h.tsumo })),
        ...h.melds.map(m => ({ type: m.type === 'chi' ? 'shun' : 'kou', k: m.k, open: m.type !== 'ankan' }))];
    const kinds = new Set([r.head]);
    for (const s of sets) { if (s.type === 'shun') { kinds.add(s.k); kinds.add(s.k + 1); kinds.add(s.k + 2); } else kinds.add(s.k); }
    const y = [];
    if (h.riichi) y.push(['立直', 1]);
    if (menzen && h.tsumo) y.push(['門前清自摸和', 1]);
    const f = fuOf(h, r);
    if (f.pinfu) y.push(['平和', 1]);
    if ([...kinds].every(k => !isYao(k))) y.push(['断么九', 1]);
    if (menzen) {
        const sh = r.sets.filter(s => s.type === 'shun').map(s => s.k).sort((a, b) => a - b);
        let p = 0;
        for (let i = 0; i + 1 < sh.length; i++) if (sh[i] === sh[i + 1]) { p++; i++; }
        if (p >= 2) return null;            // 二盃口は あつかわない
        if (p === 1) y.push(['一盃口', 1]);
    }
    for (const s of sets) {
        if (s.type !== 'kou') continue;
        if (s.k >= 31) y.push(['役牌', 1]);
        if (s.k === 27 + h.seat) y.push(['自風', 1]);
        if (s.k === 27 + h.round) y.push(['場風', 1]);
    }
    const suits = new Set([...kinds].filter(k => k < 27).map(k => Math.floor(k / 9)));
    const honors = [...kinds].some(k => k >= 27);
    if (suits.size === 1 && honors) y.push(['混一色', menzen ? 3 : 2]);
    if (suits.size === 1 && !honors) return null;                 // 清一色は あつかわない
    if (suits.size === 0) return null;                            // 字一色は あつかわない
    const kou = sets.filter(s => s.type === 'kou');
    if (kou.length === 4) y.push(['対々和', 2]);
    if (kou.filter(s => !s.open).length >= 3) return null;       // 三暗刻・四暗刻は あつかわない
    // この 計算で 見て いない 役（三色・一通・チャンタ・小三元・混老頭 など）が ありそうな 形は のぞく
    const shK = new Set(sets.filter(s => s.type === 'shun').map(s => s.k));
    for (let n = 0; n < 7; n++) if (shK.has(n) && shK.has(n + 9) && shK.has(n + 18)) return null;
    for (const b of [0, 9, 18]) if (shK.has(b) && shK.has(b + 3) && shK.has(b + 6)) return null;
    const hasYao = s => (s.type === 'shun' ? s.k % 9 === 0 || s.k % 9 === 6 : isYao(s.k));
    if (sets.every(hasYao) && isYao(r.head)) return null;
    const trK = new Set(kou.map(s => s.k));
    for (let n = 0; n < 9; n++) if (trK.has(n) && trK.has(n + 9) && trK.has(n + 18)) return null;
    if (kou.filter(s => s.k >= 31).length >= 2) return null;
    if (kou.filter(s => s.k >= 27 && s.k <= 30).length >= 3) return null;
    if (h.melds.filter(m => m.type === 'minkan' || m.type === 'ankan').length >= 3) return null;
    return { yaku: y, han: y.reduce((s, [, n]) => s + n, 0) };
}

/* ── 点数の 早見表（ふつうの 表を そのまま。切り上げ満貫 なし） ── */
// [符][翻1..4]：子ロン / 親ロン / 子ツモ「子・親」/ 親ツモ「オール」。null は ない くみあわせ、'M' は 満貫
export const REF = {
    koRon: {
        20: [null, null, null, null], 25: [null, 1600, 3200, 6400], 30: [1000, 2000, 3900, 7700], 40: [1300, 2600, 5200, 'M'],
        50: [1600, 3200, 6400, 'M'], 60: [2000, 3900, 7700, 'M'], 70: [2300, 4500, 'M', 'M'], 80: [2600, 5200, 'M', 'M'],
        90: [2900, 5800, 'M', 'M'], 100: [3200, 6400, 'M', 'M'], 110: [3600, 7100, 'M', 'M']
    },
    oyaRon: {
        20: [null, null, null, null], 25: [null, 2400, 4800, 9600], 30: [1500, 2900, 5800, 11600], 40: [2000, 3900, 7700, 'M'],
        50: [2400, 4800, 9600, 'M'], 60: [2900, 5800, 11600, 'M'], 70: [3400, 6800, 'M', 'M'], 80: [3900, 7700, 'M', 'M'],
        90: [4400, 8700, 'M', 'M'], 100: [4800, 9600, 'M', 'M'], 110: [5300, 10600, 'M', 'M']
    },
    koTsumo: {
        20: [null, '400・700', '700・1300', '1300・2600'], 25: [null, null, '800・1600', '1600・3200'],
        30: ['300・500', '500・1000', '1000・2000', '2000・3900'], 40: ['400・700', '700・1300', '1300・2600', 'M'],
        50: ['400・800', '800・1600', '1600・3200', 'M'], 60: ['500・1000', '1000・2000', '2000・3900', 'M'],
        70: ['600・1200', '1200・2300', 'M', 'M'], 80: ['700・1300', '1300・2600', 'M', 'M'], 90: ['800・1500', '1500・2900', 'M', 'M'],
        100: ['800・1600', '1600・3200', 'M', 'M'], 110: ['900・1800', '1800・3600', 'M', 'M']
    },
    oyaTsumo: {
        20: [null, 700, 1300, 2600], 25: [null, null, 1600, 3200], 30: [500, 1000, 2000, 3900], 40: [700, 1300, 2600, 'M'],
        50: [800, 1600, 3200, 'M'], 60: [1000, 2000, 3900, 'M'], 70: [1200, 2300, 'M', 'M'], 80: [1300, 2600, 'M', 'M'],
        90: [1500, 2900, 'M', 'M'], 100: [1600, 3200, 'M', 'M'], 110: [1800, 3600, 'M', 'M']
    }
};
// 満貫いじょう：[子ロン, 親ロン, 子ツモ, 親ツモ]
export const REF_BIG = {
    満貫: [8000, 12000, '2000・4000', 4000], 跳満: [12000, 18000, '3000・6000', 6000], 倍満: [16000, 24000, '4000・8000', 8000],
    三倍満: [24000, 36000, '6000・12000', 12000], 役満: [32000, 48000, '8000・16000', 16000]
};
export const tierOfHan = han => (han >= 13 ? '役満' : han >= 11 ? '三倍満' : han >= 8 ? '倍満' : han >= 6 ? '跳満' : '満貫');

/** 表から 点数の 言いかた（3900／1300・2600／2600オール） */
export function refLabel(han, fu, dealer, tsumo) {
    const fmt = n => n.toLocaleString('ja-JP');
    if (han >= 5) {
        const row = REF_BIG[tierOfHan(han)];
        const v = row[(dealer ? 1 : 0) + (tsumo ? 2 : 0)];
        return typeof v === 'number' ? (tsumo ? `${fmt(v)}オール` : fmt(v)) : v.split('・').map(x => fmt(Number(x))).join('・');
    }
    const tab = REF[(dealer ? 'oya' : 'ko') + (tsumo ? 'Tsumo' : 'Ron')];
    let v = tab[fu] ? tab[fu][han - 1] : undefined;
    if (v === undefined || v === null) return null;
    if (v === 'M') return refLabel(5, 0, dealer, tsumo);
    if (typeof v === 'number') return tsumo ? `${fmt(v)}オール` : fmt(v);
    return v.split('・').map(x => fmt(Number(x))).join('・');
}
