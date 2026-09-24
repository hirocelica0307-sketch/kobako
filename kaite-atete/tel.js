/* チームわけ と「おえかき でんごん」の きまり
   ------------------------------------------------------------------
   ここは 画面や 通信を さわらない、計算だけの ところです。
   ------------------------------------------------------------------ */

/* ── チームせん ─────────────────────────────────
   まぜた じゅんに あか・あお・あか・あお … と わけます（人数の 差は 1人まで）。
   かく じゅんばんは あか → あお → あか → あお … と こうたいに します。
   人数が ちがう ときは、少ない チームの 人が もう一度 かいて、
   どちらの チームも かく回数が 同じに なるように します。 */
export function makeTeams(shuffledIds) {
    const teams = {};
    const red = [], blue = [];
    shuffledIds.forEach((id, i) => {
        if (i % 2 === 0) { teams[id] = 'red'; red.push(id); }
        else { teams[id] = 'blue'; blue.push(id); }
    });
    const order = [];
    const n = Math.max(red.length, blue.length);
    if (red.length && blue.length) {
        for (let i = 0; i < n; i++) order.push(red[i % red.length], blue[i % blue.length]);
    }
    return { teams, order };
}

/* ── おえかき でんごん ───────────────────────────
   みんなが 同時に あそびます。1人に 1つずつ「でんごんの すじ」が あり、
   ばんごう（だん）ごとに となりの 人へ まわります。
     だん 0 … じぶんの すじの おだいを 絵に かく
     だん 1 … となりから きた 絵を 見て、ことばで こたえる
     だん 2 … となりから きた ことばを 絵に かく … の くりかえし

   さいごは かならず「ことば」で おわるように、だんの 数を 偶数に します。
   また、じぶんの すじが じぶんに もどって こないように、人数より 多くは しません。 */
export const TEL_MAX_STEPS = 8;

/** 何だん あそぶか（2人・3人 → 2だん、4人・5人 → 4だん … 8だんまで）*/
export function telSteps(n) {
    if (n < 2) return 0;
    return Math.min(n % 2 === 0 ? n : n - 1, TEL_MAX_STEPS);
}

/** その だんが 絵を かく だんか */
export const isDrawStep = s => s % 2 === 0;

/** i ばんめの 人が、s だんめに うけもつ すじ */
export function chainFor(i, s, n) {
    return ((i - s) % n + n) % n;
}

/** すじ c を、s だんめに うけもつ 人の ばんごう */
export function holderOf(c, s, n) {
    return (c + s) % n;
}
