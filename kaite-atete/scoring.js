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

/* ── チームせん ─────────────────────────────────
   チームの 人数が ちがっても 不公平に ならない ように、
   チームの てんすうは「あてた 人の わりあい」で つけます。
     かいた人の チームの ぜんいんが あてた → 10てん、半分なら 5てん
   （一人ひとりの てんすうは これまでと 同じ つけかたです）*/
export const TEAMS = [
    { key: 'red',  label: 'あかぐみ', color: '#e8503a' },
    { key: 'blue', label: 'あおぐみ', color: '#3b86d4' }
];
export const TEAM_FULL = 10;

/** この かいの チームの てんすう。answered 人 あてた ／ total 人 あてる はず */
export function teamRoundPoints(answered, total) {
    return total > 0 ? Math.round(TEAM_FULL * Math.min(answered, total) / total) : 0;
}
