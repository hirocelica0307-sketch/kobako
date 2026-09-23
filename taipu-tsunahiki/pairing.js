/* 2人組の つくりかた
   ------------------------------------------------------------------
   「まっている人」が 2人 そろったら、すぐに 組にして たいせんを はじめます。
   組を 作るのは へやの ぬしの タブ だけです（みんなで 作ると ぶつかるため）。

   ・まっている人が 3人 いじょう いれば、くじびきで 組みます
   ・さっき たいせんした 相手とは、なるべく 組みません
     ただし ほかに だれも こないまま REMATCH_WAIT たったら、同じ 相手でも 組みます
     （2人しか いない へやで ずっと 待たされない ように）
   ------------------------------------------------------------------ */

export const REMATCH_WAIT = 8000;   // 同じ 相手と もう一度 組むまでの 待ち時間（ミリ秒）

/**
 * @param {{id:string, foe?:string|null, since?:number}[]} pool まっている人
 * @param {number} now   いまの 時こく（サーバーの 時計）
 * @param {() => number} rand くじびき（ためす ときに かえられる ように）
 * @returns {[string, string][]} 作った 組
 */
export function makePairs(pool, now, rand = Math.random) {
    const left = pool.slice();
    for (let i = left.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [left[i], left[j]] = [left[j], left[i]];
    }

    const waited = p => now - (p.since || 0) >= REMATCH_WAIT;
    const pairs = [];
    while (left.length >= 2) {
        const p = left.shift();
        /* さっきの 相手 では ない 人を さがします */
        let k = left.findIndex(q => q.id !== p.foe && q.foe !== p.id);
        /* いなければ、2人とも じゅうぶん 待った ときだけ 同じ 相手と 組みます */
        if (k < 0) k = left.findIndex(q => waited(p) && waited(q));
        if (k < 0) continue;              // この 人は もうすこし 待ちます
        const q = left.splice(k, 1)[0];
        pairs.push([p.id, q.id]);
    }
    return pairs;
}
