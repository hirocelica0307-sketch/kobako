/* 手牌の しらべかた
   ------------------------------------------------------------------
   ・シャンテン数（あと 何枚で テンパイ か。-1 = あがり、0 = テンパイ）
   ・待ち（何が くれば あがれるか）
   ・あがり形の 分けかた（点数計算で つかう）
   手牌は「種類ごとの 数（34こ）」で あつかいます。
   meldCount は ポン・チー・カンで さらした 面子の 数です。
   ------------------------------------------------------------------ */
import { KINDS, YAOCHU } from './tiles.js';

/* ── シャンテン数 ─────────────────────────── */

// 数牌 1色ぶん（9こ）の ならびごとに「面子・塔子」の くみあわせを おぼえておく
const suitMemo = new Map();

function suitKey(c, base) {
    let k = 0;
    for (let i = 0; i < 9; i++) k = k * 5 + c[base + i];
    return k;
}

// 1色の 中で できる（面子 m, 塔子 t）の くみあわせ（よい ものだけ）
function suitOptions(a) {
    const out = [];
    const seen = new Set();
    const rec = (i, m, t) => {
        while (i < 9 && a[i] === 0) i++;
        if (i >= 9) {
            const key = m * 16 + t;
            if (!seen.has(key)) { seen.add(key); out.push([m, t]); }
            return;
        }
        if (a[i] >= 3) { a[i] -= 3; rec(i, m + 1, t); a[i] += 3; }
        if (i <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; rec(i, m + 1, t); a[i]++; a[i + 1]++; a[i + 2]++; }
        if (a[i] >= 2) { a[i] -= 2; rec(i, m, t + 1); a[i] += 2; }
        if (i <= 7 && a[i + 1]) { a[i]--; a[i + 1]--; rec(i, m, t + 1); a[i]++; a[i + 1]++; }
        if (i <= 6 && a[i + 2]) { a[i]--; a[i + 2]--; rec(i, m, t + 1); a[i]++; a[i + 2]++; }
        a[i]--; rec(i, m, t); a[i]++;
    };
    rec(0, 0, 0);
    // パレート（m も t も まけている ものは すてる）
    return out.filter(([m, t]) => !out.some(([m2, t2]) => (m2 >= m && t2 >= t) && (m2 > m || t2 > t)));
}

function suitInfo(c, base) {
    const key = suitKey(c, base);
    let v = suitMemo.get(key);
    if (v) return v;
    const a = c.slice(base, base + 9);
    const noHead = suitOptions(a);
    const withHead = [];
    for (let i = 0; i < 9; i++) {
        if (a[i] >= 2) {
            a[i] -= 2;
            for (const o of suitOptions(a)) withHead.push(o);
            a[i] += 2;
        }
    }
    v = { noHead, withHead };
    suitMemo.set(key, v);
    return v;
}

/** ふつうの 形（4面子1雀頭）の シャンテン数 */
export function shantenNormal(c, meldCount = 0) {
    const groups = [suitInfo(c, 0), suitInfo(c, 9), suitInfo(c, 18)];
    // 字牌
    let hm = 0, ht = 0, hasHonorPair = false;
    for (let k = 27; k < 34; k++) {
        if (c[k] >= 3) hm++;
        else if (c[k] === 2) { ht++; hasHonorPair = true; }
    }
    const honor = {
        noHead: [[hm, ht]],
        withHead: hasHonorPair ? [[hm, ht - 1]] : []
    };
    // 字牌の 刻子 + 対子(雀頭) の ばあい（3枚ある 字牌を 雀頭に するのは そん なので いらない）
    groups.push(honor);
    let best = 8;
    const evalMT = (m, t, p) => {
        m += meldCount;
        if (m > 4) m = 4;
        const tt = Math.min(t, 4 - m);
        const s = 8 - 2 * m - tt - p;
        if (s < best) best = s;
    };
    // 雀頭なし
    const combine = (gi, m, t, headUsed) => {
        if (gi === groups.length) { evalMT(m, t, headUsed ? 1 : 0); return; }
        for (const [gm, gt] of groups[gi].noHead) combine(gi + 1, m + gm, t + gt, headUsed);
        if (!headUsed) for (const [gm, gt] of groups[gi].withHead) combine(gi + 1, m + gm, t + gt, true);
    };
    combine(0, 0, 0, false);
    return best;
}

export function shantenChiitoi(c) {
    let pairs = 0, kinds = 0;
    for (let k = 0; k < KINDS; k++) {
        if (c[k] >= 1) kinds++;
        if (c[k] >= 2) pairs++;
    }
    return 6 - pairs + Math.max(0, 7 - kinds);
}

export function shantenKokushi(c) {
    let kinds = 0, pair = 0;
    for (const k of YAOCHU) {
        if (c[k] >= 1) kinds++;
        if (c[k] >= 2) pair = 1;
    }
    return 13 - kinds - pair;
}

/** シャンテン数（ふつう・七対子・国士の いちばん 小さい もの） */
export function shanten(c, meldCount = 0) {
    let s = shantenNormal(c, meldCount);
    if (meldCount === 0) {
        s = Math.min(s, shantenChiitoi(c), shantenKokushi(c));
    }
    return s;
}

/* ── あがり形 ─────────────────────────────── */

function isSetsOnly(c) {
    // c を ぜんぶ 面子に わけられるか（こわしても よい）
    for (let k = 0; k < KINDS; k++) {
        if (c[k] === 0) continue;
        if (c[k] >= 3) {
            c[k] -= 3;
            const ok = isSetsOnly(c);
            c[k] += 3;
            if (ok) return true;
        }
        if (k < 27 && k % 9 <= 6 && c[k + 1] && c[k + 2]) {
            c[k]--; c[k + 1]--; c[k + 2]--;
            const ok = isSetsOnly(c);
            c[k]++; c[k + 1]++; c[k + 2]++;
            if (ok) return true;
        }
        return false;
    }
    return true;
}

function isNormalAgari(c) {
    for (let k = 0; k < KINDS; k++) {
        if (c[k] >= 2) {
            c[k] -= 2;
            const ok = isSetsOnly(c);
            c[k] += 2;
            if (ok) return true;
        }
    }
    return false;
}

export function isChiitoi(c) {
    let pairs = 0;
    for (let k = 0; k < KINDS; k++) {
        if (c[k] === 2) pairs++;
        else if (c[k] !== 0) return false;
    }
    return pairs === 7;
}

export function isKokushi(c) {
    let pair = false;
    for (const k of YAOCHU) {
        if (c[k] === 0) return false;
        if (c[k] === 2) pair = true;
    }
    let total = 0;
    for (let k = 0; k < KINDS; k++) total += c[k];
    return pair && total === 14;
}

/** あがり形か（14 - 3×さらした 面子 の 枚数で よぶ） */
export function isAgari(c, meldCount = 0) {
    let total = 0;
    for (let k = 0; k < KINDS; k++) total += c[k];
    if (total % 3 !== 2) return false;
    if (isNormalAgari(c)) return true;
    if (meldCount === 0 && (isChiitoi(c) || isKokushi(c))) return true;
    return false;
}

/** 待ちの 種類（13枚などで よぶ）。自分で 4枚 つかっている 牌も ふくむ */
export function waits(c, meldCount = 0) {
    const out = [];
    for (let k = 0; k < KINDS; k++) {
        if (c[k] >= 4) continue;
        c[k]++;
        if (isAgari(c, meldCount)) out.push(k);
        c[k]--;
    }
    return out;
}

/** テンパイか（待ちの 牌を 自分で 4枚 もっている だけの 待ちは テンパイに しない） */
export function isTenpai(c, meldCount = 0, meldKindsCount = null) {
    const w = waits(c, meldCount);
    return w.some(k => c[k] + (meldKindsCount ? meldKindsCount[k] : 0) < 4);
}

/* ── あがり形の 分けかた（点数計算 用） ──── */

/**
 * 4面子1雀頭の 分けかたを ぜんぶ かえします。
 * 面子は { type: 'shuntsu' | 'koutsu', k: いちばん 小さい 牌 }、雀頭は 種類。
 */
export function decompositions(c) {
    const res = [];
    const sets = [];
    const rec = () => {
        let k = 0;
        while (k < KINDS && c[k] === 0) k++;
        if (k >= KINDS) { res.push(sets.slice()); return; }
        if (c[k] >= 3) {
            c[k] -= 3; sets.push({ type: 'koutsu', k }); rec(); sets.pop(); c[k] += 3;
        }
        if (k < 27 && k % 9 <= 6 && c[k + 1] && c[k + 2]) {
            c[k]--; c[k + 1]--; c[k + 2]--; sets.push({ type: 'shuntsu', k }); rec(); sets.pop(); c[k]++; c[k + 1]++; c[k + 2]++;
        }
    };
    const out = [];
    for (let h = 0; h < KINDS; h++) {
        if (c[h] < 2) continue;
        c[h] -= 2;
        res.length = 0;
        rec();
        for (const s of res) out.push({ head: h, sets: s });
        c[h] += 2;
    }
    // 同じ 分けかたを 1つに
    const seen = new Set();
    return out.filter(d => {
        const key = d.head + '|' + d.sets.map(s => s.type[0] + s.k).sort().join(',');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/* ── 受け入れ（AI 用） ─────────────────────── */

/**
 * 13枚（など）で、シャンテン数が へる 牌の 種類と その こり枚数。
 * visible は 見えている 枚数（自分の 手牌を ふくむ）。
 */
export function ukeire(c, meldCount, visible) {
    const base = shanten(c, meldCount);
    let total = 0;
    const kinds = [];
    for (let k = 0; k < KINDS; k++) {
        if (c[k] >= 4) continue;
        const left = 4 - (visible ? visible[k] : c[k]);
        if (left <= 0) continue;
        c[k]++;
        const s = shanten(c, meldCount);
        c[k]--;
        if (s < base) { total += left; kinds.push(k); }
    }
    return { shanten: base, total, kinds };
}
