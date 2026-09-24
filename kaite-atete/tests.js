/* きまりの たしかめ（ブラウザで tests.html を ひらくと 動きます）
   通信や 画面を つかわない ところ（おだい・ヒント・おしい・チーム・でんごん）を しらべます。 */
import { ODAI, TOPICS, pickWord, hashWord, hintFor, nearHashes, isNear, seasonKey } from './odai.js';
import { scoreRound, teamRoundPoints } from './scoring.js';
import { makeTeams, telSteps, chainFor, holderOf } from './tel.js';

export function runTests() {
    const rows = [];
    const t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });

    /* おだい */
    for (const [key, list] of Object.entries(ODAI)) {
        const dup = list.filter((w, i) => list.indexOf(w) !== i);
        t(`おだい「${key}」に 同じ ことばが ない`, dup.length === 0, dup.join('、'));
        const bad = list.filter(w => !/^[ぁ-んー]+$/.test(w) || [...w].length > 6);
        t(`おだい「${key}」は ひらがな 6文字 いない`, bad.length === 0, bad.join('、'));
    }
    t('えらべる おだいは ぜんぶ リストが ある',
      TOPICS.every(x => ODAI[x.key === 'season' ? seasonKey() : x.key]));
    t('きせつ：10月は あき・1月は ふゆ・4月は はる・7月は なつ',
      seasonKey(new Date(2026, 9, 1)) === 'autumn' && seasonKey(new Date(2026, 0, 1)) === 'winter'
      && seasonKey(new Date(2026, 3, 1)) === 'spring' && seasonKey(new Date(2026, 6, 1)) === 'summer');
    t('「きせつ」で えらぶと いまの きせつの ことばが 出る', ODAI[seasonKey()].includes(pickWord('season')));

    /* ヒント */
    t('はじめは 文字の 数だけ ○', hintFor('りんご', 0) === '○○○');
    t('とちゅうから 1文字 見える', [...hintFor('りんご', 0.6)].filter(c => c !== '○').length === 1);
    t('さいごまで ぜんぶは 見せない', ['いぬ', 'りんご', 'かたつむり'].every(w => hintFor(w, 1).includes('○')));
    t('ヒントは なんど 作っても 同じ', hintFor('らーめん', 0.7) === hintFor('らーめん', 0.7));

    /* おしい */
    const h = hashWord('りんご'), n = nearHashes('りんご');
    t('1文字 ちがう（りんこ）→ おしい', isNear('りんこ', h, n));
    t('1文字 たりない（りご）→ おしい', isNear('りご', h, n));
    t('1文字 おおい（りんごう）→ おしい', isNear('りんごう', h, n));
    t('あたり は おしい では ない', !isNear('りんご', h, n));
    t('ぜんぜん ちがう（みかん）→ おしくない', !isNear('みかん', h, n));
    t('小さい 字の ちがい（ちよこ／ちょこ）→ おしい', isNear('ちよこ', hashWord('ちょこ'), nearHashes('ちょこ')));

    /* とくてん */
    const d = scoreRound({ a: 1, b: 2, c: 3, e: 4 }, 'x');
    t('こたえた 人は 5・4・3・2てん', d.a === 5 && d.b === 4 && d.c === 3 && d.e === 2);
    t('かいた 人は 1人に つき 2てん', d.x === 8);
    t('チームの てんすうは あてた わりあい（ぜんいん 10・半分 5・0人 0）',
      teamRoundPoints(3, 3) === 10 && teamRoundPoints(1, 2) === 5 && teamRoundPoints(0, 2) === 0);

    /* チームわけ */
    const tm = makeTeams(['a', 'b', 'c', 'd', 'e']);
    const reds = Object.values(tm.teams).filter(x => x === 'red').length;
    t('5人 → 3人と 2人に わかれる', reds === 3);
    t('どちらの チームも かく 回数が 同じ',
      tm.order.filter(id => tm.teams[id] === 'red').length === tm.order.filter(id => tm.teams[id] === 'blue').length);
    t('あか・あお こうたいに かく', tm.order.every((id, i) => tm.teams[id] === (i % 2 ? 'blue' : 'red')));

    /* でんごん */
    t('だんの 数は 偶数で、人数より 多くない（さいごは ことば）',
      [2, 3, 4, 5, 6, 7, 8, 9, 12].every(p => telSteps(p) % 2 === 0 && telSteps(p) <= p && telSteps(p) >= 2));
    let chainsOk = true;
    for (let p = 2; p <= 9; p++) {
        for (let c = 0; c < p; c++) {
            const seen = new Set();
            for (let s = 0; s < telSteps(p); s++) {
                const who = holderOf(c, s, p);
                if (chainFor(who, s, p) !== c) chainsOk = false;
                seen.add(who);
            }
            if (seen.size !== telSteps(p)) chainsOk = false;   /* 同じ 人に 2回 まわらない */
        }
    }
    t('でんごんの すじは 同じ 人に 2回 まわらない', chainsOk);

    return rows;
}
