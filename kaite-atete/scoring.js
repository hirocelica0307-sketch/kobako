/* とくてんの つけかた
   ------------------------------------------------------------------
   こたえた 人 … はやい 順に 5てん・4てん・3てん、そのあとは 2てん
   かいた 人   … あてて もらえた 人 1人に つき 2てん
   （かいた人も がんばりが てんすうに なるように しています）
   ------------------------------------------------------------------ */

export const ANSWER_POINTS = [5, 4, 3];
export const LATE_POINT = 2;
export const DRAW_POINT_PER_PERSON = 2;

/**
 * この かいの とくてんを 出します。
 * @param {object} answered  { メンバーID: あてた 時こく }
 * @param {string} drawerId  かいた 人
 * @returns {object} { メンバーID: たす てんすう }
 */
export function scoreRound(answered, drawerId) {
    const order = Object.entries(answered || {})
        .sort((a, b) => a[1] - b[1])
        .map(e => e[0])
        .filter(id => id !== drawerId);      // かいた人が まざっても 数えない

    const deltas = {};
    order.forEach((id, i) => { deltas[id] = ANSWER_POINTS[i] || LATE_POINT; });
    if (order.length && drawerId) {
        deltas[drawerId] = (deltas[drawerId] || 0) + order.length * DRAW_POINT_PER_PERSON;
    }
    return deltas;
}
