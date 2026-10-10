/* ルールの たしかめ
   ブラウザで tests.html を ひらくか、`node hanafuda/tests.js` で うごきます。
   画面と つうしんを つかわない ところ（札・役・点数・ルールエンジン・コンピューター）を しらべます。 */
import { CARDS, monthOf } from './cards.js';
import {
    calcYaku, sumYaku, teyakuOf, newGame, applyAction, legalActions, clone, roundPoints, DEFAULT_RULES,
    yakuProgress, makeRng, TAG
} from './rules.js';
import { chooseAction, recommend } from './ai.js';

export function runTests() {
    const rows = [];
    const t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail: String(detail) });
    const R = DEFAULT_RULES;
    const ids = list => calcYaku(list, R).map(y => `${y.id}:${y.pts}`).sort().join(',');

    /* 札 */
    t('札は 48枚', CARDS.length === 48);
    const cnt = k => CARDS.filter(c => c.k === k).length;
    t('光5・たね9・短冊10・かす24', cnt('hikari') === 5 && cnt('tane') === 9 && cnt('tan') === 10 && cnt('kasu') === 24,
        ['hikari', 'tane', 'tan', 'kasu'].map(cnt).join('/'));
    t('どの 月も 4枚', [...Array(12).keys()].every(m => CARDS.filter(c => c.m === m + 1).length === 4));
    t('id と 月が あっている', CARDS.every(c => monthOf(c.id) === c.m));

    /* 役 */
    t('五光', ids([0, 8, 28, 40, 44]) === 'goko:10', ids([0, 8, 28, 40, 44]));
    t('四光（雨なし）', ids([0, 8, 28, 44]) === 'shiko:8');
    t('雨四光', ids([0, 8, 28, 40]) === 'ameshiko:7');
    t('三光（雨なし）', ids([0, 8, 44]) === 'sanko:5');
    t('雨を ふくむ 光3枚は 役なし', ids([0, 8, 40]) === '');
    t('花見で一杯', ids([TAG.maku, TAG.sake]) === 'hanami:5');
    t('月見で一杯', ids([TAG.tsuki, TAG.sake]) === 'tsukimi:5');
    t('花見・月見なしの ルール', calcYaku([TAG.maku, TAG.sake, TAG.tsuki], { ...R, hanami: false }).length === 0);
    t('猪鹿蝶', ids([24, 36, 20]) === 'inoshikacho:5');
    t('赤短', ids([1, 5, 9]) === 'akatan:5');
    t('青短', ids([21, 33, 37]) === 'aotan:5');
    t('赤短と 青短で 10点（＋たん）', sumYaku(calcYaku([1, 5, 9, 21, 33, 37], R)) === 12, ids([1, 5, 9, 21, 33, 37]));
    t('たね 5枚で 1点・6枚で 2点', ids([4, 12, 16, 29, 41]) === 'tane:1' && ids([4, 12, 16, 29, 41, 20]) === 'tane:2');
    t('たん 5枚で 1点', ids([1, 13, 17, 25, 42]) === 'tan:1');
    const kasu10 = CARDS.filter(c => c.k === 'kasu').slice(0, 10).map(c => c.id);
    t('かす 10枚で 1点', ids(kasu10) === 'kasu:1');
    t('菊に盃は かすにも なる（設定あり）', ids(kasu10.slice(0, 9).concat([TAG.sake])) === 'kasu:1');
    t('菊に盃を かすに しない 設定', calcYaku(kasu10.slice(0, 9).concat([TAG.sake]), { ...R, sakeKasu: false }).length === 0);

    /* 手役 */
    t('手四', teyakuOf([0, 1, 2, 3, 4, 8, 12, 16])?.id === 'teshi');
    t('くっつき', teyakuOf([0, 1, 4, 5, 8, 9, 12, 13])?.id === 'kuttsuki');
    t('ふつうの 手は 手役なし', teyakuOf([0, 4, 8, 12, 16, 20, 24, 28]) === null);

    /* くばる */
    const g1 = newGame({}, 'abc').state, g2 = newGame({}, 'abc').state;
    t('同じ 種なら 同じ くばりかた', JSON.stringify(g1.hands) === JSON.stringify(g2.hands) && JSON.stringify(g1.field) === JSON.stringify(g2.field));
    t('手札 8・8、場 8、山 24', g1.hands[0].length === 8 && g1.hands[1].length === 8 && g1.field.length === 8 && g1.deck.length === 24);
    let fieldOk = true;
    for (let i = 0; i < 300; i++) {
        const s = newGame({ teyaku: false }, 'f' + i).state;
        const c = {};
        s.field.forEach(id => { c[monthOf(id)] = (c[monthOf(id)] || 0) + 1; });
        if (Object.values(c).some(v => v === 4)) fieldOk = false;
    }
    t('場に 同じ 月 4枚は くばりなおし', fieldOk);

    /* 札を とる */
    const base = () => {
        const s = newGame({ teyaku: false }, 'x').state;
        s.turn = 0; s.phase = 'play';
        return s;
    };
    {
        const s = base();
        s.hands = [[0, 4, 8], [12, 16, 20]]; s.field = [2, 30, 45]; s.deck = [46, 47, 44, 31];
        applyAction(s, { t: 'play', p: 0, card: 0 });
        t('1枚 あう：2枚 とる', s.caps[0].includes(0) && s.caps[0].includes(2));
        t('めくった 札も あえば とる（桐）', s.caps[0].includes(46) && s.caps[0].includes(45));
    }
    {
        const s = base();
        s.hands = [[0, 4], [12, 16]]; s.field = [2, 3, 30]; s.deck = [20, 47];
        let threw = false;
        try { applyAction(s, { t: 'play', p: 0, card: 0 }); } catch (e) { threw = true; }
        t('2枚 あう ときは とる 札を えらばないと だめ', threw && s.hands[0].length === 2);
        applyAction(s, { t: 'play', p: 0, card: 0, target: 3 });
        t('えらんだ 1枚だけ とる', s.caps[0].includes(3) && s.field.includes(2));
    }
    {
        const s = base();
        s.hands = [[0, 4], [12, 16]]; s.field = [1, 2, 3, 30]; s.deck = [20, 47];
        applyAction(s, { t: 'play', p: 0, card: 0 });
        t('3枚 あう：4枚 まとめて とる', [0, 1, 2, 3].every(i => s.caps[0].includes(i)));
    }
    {
        const s = base();
        s.hands = [[0, 4], [12, 16]]; s.field = [30]; s.deck = [3, 47];
        applyAction(s, { t: 'play', p: 0, card: 0 });
        t('あわない 札は 場に おく → めくった 札で とれる', s.caps[0].includes(0) && s.caps[0].includes(3));
    }
    {
        const s = base();
        s.hands = [[0, 4], [12, 16]]; s.field = [5, 6, 30]; s.deck = [7, 47];
        applyAction(s, { t: 'play', p: 0, card: 0 });
        t('めくった 札が 2枚に あう → えらぶ 番', s.phase === 'pick' && s.pending === 7);
        applyAction(s, { t: 'pick', p: 0, target: 5 });
        t('えらんで とる', s.caps[0].includes(5) && s.caps[0].includes(7) && s.field.includes(6));
    }
    {
        const s = base();
        s.hands = [[0], [12]]; s.field = [30];
        let threw = false;
        try { applyAction(s, { t: 'play', p: 1, card: 12 }); } catch (e) { threw = true; }
        t('じぶんの 番 いがいは 出せない', threw);
    }

    /* こいこい・点数 */
    {
        const s = base();
        s.hands = [[9, 47, 46], [12, 16, 20]]; s.caps[0] = [1, 5]; s.field = [10, 30]; s.deck = [31, 44, 45];
        applyAction(s, { t: 'play', p: 0, card: 9 });
        t('役が できたら こいこいか えらぶ', s.phase === 'decide');
        applyAction(s, { t: 'koikoi', p: 0 });
        t('こいこい したら あいての 番', s.turn === 1 && s.koi[0] === 1 && s.phase === 'play');
    }
    {
        const s = base();
        s.caps[0] = [0, 8, 28, 44]; s.koi = [0, 1];
        const r = roundPoints(s, 0);
        t('7点以上 2倍 ＋ あいての こいこいで 2倍', r.base === 8 && r.mult === 4 && r.total === 32, JSON.stringify(r));
        s.rules = { ...s.rules, koiBonus: 'self' }; s.koi = [2, 0];
        const r2 = roundPoints(s, 0);
        t('じぶんの こいこい 2回で 3倍（＋7点で 2倍）', r2.total === 8 * 2 * 3, JSON.stringify(r2));
    }
    {
        const s = base();
        s.hands = [[0, 4], [12, 16]];
        s.caps[0] = [];
        const p = yakuProgress([1, 5], [], R).find(e => e.id === 'akatan');
        t('すすみぐあい：赤短 2/3', p.have === 2 && p.need === 3 && p.possible);
        const q = yakuProgress([1, 5], [9], R).find(e => e.id === 'akatan');
        t('あいてが 1枚 とると できない', !q.possible);
        void s;
    }

    /* 1局を さいごまで（でたらめな 手） */
    let conserve = true, ended = 0;
    for (let i = 0; i < 300; i++) {
        const rng = makeRng(i + 1);
        const { state: s } = newGame({ rounds: 2 }, 'r' + i);
        let guard = 0;
        while (s.phase !== 'gameEnd' && guard++ < 500) {
            const acts = s.phase === 'roundEnd' ? [...legalActions(s, 0), ...legalActions(s, 1)] : legalActions(s);
            applyAction(s, acts[Math.floor(rng() * acts.length)]);
            const all = [...s.deck, ...s.hands[0], ...s.hands[1], ...s.field, ...s.caps[0], ...s.caps[1], ...(s.pending !== null ? [s.pending] : [])];
            if (s.phase !== 'gameEnd' && (all.length !== 48 || new Set(all).size !== 48)) conserve = false;
        }
        if (s.phase === 'gameEnd') ended++;
    }
    t('札が へったり ふえたり しない（300ゲーム）', conserve);
    t('どの ゲームも かならず おわる', ended === 300, ended);

    /* 同じ 手の ならびなら 同じ 結果（友だちとの 対戦の しくみ） */
    {
        const { state: a } = newGame({ rounds: 3 }, 'sync');
        const log = [];
        const rng = makeRng(99);
        while (a.phase !== 'gameEnd') {
            const acts = a.phase === 'roundEnd' ? [...legalActions(a, 0), ...legalActions(a, 1)] : legalActions(a);
            const act = acts[Math.floor(rng() * acts.length)];
            log.push(JSON.parse(JSON.stringify(act)));
            applyAction(a, act);
        }
        const { state: b } = newGame({ rounds: 3 }, 'sync');
        for (const act of log) applyAction(b, act);
        t('手の ならびを おくれば 2台で 同じ 結果', JSON.stringify(a.scores) === JSON.stringify(b.scores) && a.moves === b.moves);
    }

    /* コンピューター */
    {
        let legalOk = true;
        for (let lv = 1; lv <= 10; lv++) {
            const { state: s } = newGame({ rounds: 1 }, 'ai' + lv);
            const rng = makeRng(lv);
            let guard = 0;
            while (s.phase !== 'roundEnd' && s.phase !== 'gameEnd' && guard++ < 60) {
                const a = chooseAction(clone(s), s.turn, lv, rng);
                const ok = legalActions(s).some(x => JSON.stringify(x) === JSON.stringify(a));
                if (!ok) legalOk = false;
                applyAction(s, a);
            }
        }
        t('どの レベルも ルールどおりの 手を 打つ', legalOk);
    }
    {
        const { state: s } = newGame({}, 'rec');
        const r = recommend(s, s.turn);
        t('おすすめは 手と わけを かえす', r && r.action && typeof r.reason === 'string' && r.reason.length > 0);
    }
    {
        // つよさ：レベル7 と レベル1 を 40回（種は きまっているので 毎回 同じ 結果）
        let w7 = 0, w1 = 0;
        for (let g = 0; g < 40; g++) {
            const { state: s } = newGame({ rounds: 1 }, 'lv' + g);
            const rng = makeRng(1000 + g);
            const lv = g % 2 ? [7, 1] : [1, 7];
            while (s.phase !== 'gameEnd') {
                if (s.phase === 'roundEnd') { applyAction(s, { t: 'ready', p: 0 }); applyAction(s, { t: 'ready', p: 1 }); continue; }
                applyAction(s, chooseAction(s, s.turn, lv[s.turn], rng));
            }
            const p7 = g % 2 ? 0 : 1;
            if (s.scores[p7] > s.scores[1 - p7]) w7++;
            else if (s.scores[p7] < s.scores[1 - p7]) w1++;
        }
        t('レベル7 は レベル1 に 多く 勝つ', w7 > w1 * 2, `${w7}勝 ${w1}敗`);
    }

    return rows;
}

// node で うごかした とき
if (typeof window === 'undefined') {
    const rows = runTests();
    const ng = rows.filter(r => !r.ok);
    for (const r of rows) console.log(`${r.ok ? 'OK ' : 'NG '} ${r.name}${r.detail && !r.ok ? '  (' + r.detail + ')' : ''}`);
    console.log(`\n${rows.length - ng.length} / ${rows.length} OK`);
    if (ng.length && typeof process !== 'undefined') process.exitCode = 1;
}
