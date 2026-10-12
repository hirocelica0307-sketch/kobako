/* 妖精の アドバイス（はじめての 人 むけ）
   ------------------------------------------------------------------
   対局中、画面の すみの 妖精が 吹き出しで 教えて くれます。
     ・どれを 捨てると よいか（あと 何枚で テンパイ・何種類で 手が すすむ）
     ・作れそうな 役（タンヤオ・役牌・ホンイツ・七対子・トイトイ など）
     ・だれかが リーチした とき：あんぜんな 牌（現物・スジ・字牌・壁）
     ・鳴くか どうか・リーチするか どうか・フリテン・役が ない ときの 注意
   考えかたは コンピューター「よく考えて打つ」と 同じ（ai.js の analyzeTurn / analyzeClaim）。
   見えて いる 牌（自分の 手牌・捨て牌・鳴き・ドラ表示牌）だけで 考えます。
   妖精の 絵：Microsoft Fluent Emoji 3D「Man fairy」（assets/fx/fairy.webp・MIT）
   ------------------------------------------------------------------ */
import { kindOf, isRedId, isYaochu, isHonor, tileName, toCounts, KINDS } from './tiles.js';
import { analyzeTurn, analyzeClaim, safetyLabel, yakuhaiKinds } from './ai.js';

const tn = id => tileName(kindOf(id), isRedId(id));
const kn = k => tileName(k);
const SUIT = ['萬子', '筒子', '索子'];

/** 作れそうな 役（だいじな もの 1つか 2つ） */
export function yakuHints(g, seat) {
    const h = g.h;
    const hand = h.hands[seat];
    const melds = h.melds[seat];
    const c = toCounts(hand);
    for (const m of melds) for (const t of m.tiles) c[kindOf(t)]++;
    const menzen = melds.every(m => m.type === 'ankan');
    const yh = yakuhaiKinds(g, seat);
    const out = [];
    // 役牌
    const yhHave = [...new Set(yh)].filter(k => c[k] >= 2);
    for (const k of yhHave) {
        if (c[k] >= 3) out.push({ key: 'yakuhai3-' + k, text: `${kn(k)}が 3枚 そろって いるので、もう 役（役牌）が あるよ！` });
        else out.push({ key: 'yakuhai2-' + k, text: `${kn(k)}が 2枚。もう1枚 来たら（ポンでも OK）役牌の 役が つくよ` });
    }
    // 染め手
    const suitN = [0, 1, 2].map(s => { let n = 0; for (let k = s * 9; k < s * 9 + 9; k++) n += c[k]; return n; });
    let honors = 0; for (let k = 27; k < KINDS; k++) honors += c[k];
    const total = hand.length + melds.reduce((s, m) => s + m.tiles.length, 0);
    const top = suitN.indexOf(Math.max(...suitN));
    if (suitN[top] + honors >= total - 2 && suitN[top] >= 7) {
        out.push({ key: 'flush-' + top, text: honors ? `${SUIT[top]}と 字牌ばかり！ ホンイツ（${SUIT[top]}と 字牌だけで そろえる）を ねらえるよ。ほかの 色を 切っていこう` : `${SUIT[top]}ばかり！ チンイツ（1つの 色だけ）を ねらえるかも` });
    }
    // タンヤオ
    let yao = 0; for (let k = 0; k < KINDS; k++) if (isYaochu(k)) yao += c[k];
    if (yao <= 2 && (menzen || g.rules.kuitan)) out.push({ key: 'tanyao', text: yao ? '2〜8の 牌が 多いね。1・9・字牌を 切ると タンヤオ（2〜8だけ）の 役に なるよ' : '2〜8の 牌だけ！ このまま タンヤオ（2〜8だけ）の 役が つくよ' });
    // 七対子
    let pairs = 0; for (let k = 0; k < KINDS; k++) if (c[k] >= 2) pairs++;
    if (menzen && pairs >= 5) out.push({ key: 'chiitoi', text: `同じ 牌の ペアが ${pairs}つ！ 七対子（ペアを 7つ あつめる）を ねらえるよ` });
    // 対々和
    let trip = 0; for (let k = 0; k < KINDS; k++) if (c[k] >= 3) trip++;
    if (trip >= 2 && trip + pairs >= 5 && melds.every(m => m.type !== 'chi')) out.push({ key: 'toitoi', text: '同じ 牌の 3枚組が 多いね。トイトイ（ぜんぶ 3枚組）も ねらえるよ' });
    if (!out.length && menzen) out.push({ key: 'riichi', text: '鳴かないで（門前で）テンパイしたら「リーチ」で 役が つくよ。まずは 手を すすめよう' });
    return out;
}

/** 鳴いて いて 役が なさそうか */
function noYakuWarning(g, seat) {
    const h = g.h;
    if (h.melds[seat].every(m => m.type === 'ankan')) return null;
    const hints = yakuHints(g, seat).filter(x => !x.key.startsWith('riichi'));
    if (hints.length) return null;
    return '鳴いて いて 役が ないと、テンパイしても あがれないよ！ 役牌・タンヤオ・ホンイツ などを 考えよう';
}

/** 自分の 番の アドバイス */
export function turnAdvice(g, seat, opt, nameOf) {
    const ana = analyzeTurn(g, seat, opt);
    const lines = [];
    let title, mood = 'normal';
    const t = ana.tile;
    if (opt.tsumo) {
        return { ana, mood: 'happy', title: 'ツモ できるよ！', lines: ['「ツモ」ボタンを おして あがろう！'], tile: null };
    }
    if (ana.riichiSeats.length) {
        // リーチが かかって いる
        const q = ana.riichiSeats[0];
        const s = safetyLabel(g, seat, kindOf(t), q);
        if (ana.fold) {
            mood = 'worry';
            title = `まもろう！ ${tn(t)} を 切るのが おすすめ`;
            lines.push(`${nameOf(q)}が リーチ中。いまの 手は まだ とおいので、あたらない 牌を 切ろう`);
            lines.push(`${tn(t)} は【${s.label}】：${s.why}`);
        } else {
            title = `${tn(t)} を 切ろう`;
            lines.push(`${nameOf(q)}が リーチ中だけど、手が いいので すすめよう`);
            lines.push(`${tn(t)} は【${s.label}】${s.rank <= 2 ? '：' + s.why : '。すこし どきどきするね'}`);
        }
        // 手の 中の あんぜんな 牌 ベスト3
        const safeList = [...new Set(opt.discard.map(kindOf))].map(k => ({ k, s: safetyLabel(g, seat, k, q) })).sort((a, b) => a.s.rank - b.s.rank).slice(0, 3);
        lines.push('あんぜんな じゅん：' + safeList.map(x => `${kn(x.k)}（${x.s.label}）`).join('・'));
    } else {
        title = `${tn(t)} を 切ろう`;
        const r = ana.after;
        if (r.shanten === 0) {
            const left = ana.wait.reduce((s, w) => s + w.left, 0);
            mood = 'happy';
            title = ana.riichi ? `テンパイ！ ${tn(t)} を 切って リーチ しよう` : `テンパイ！ ${tn(t)} を 切ろう`;
            lines.push(`待ちは ${ana.wait.map(w => `${kn(w.k)}（のこり ${w.left}枚）`).join('・')}　ぜんぶで ${left}枚`);
            if (opt.riichi.length) {
                if (ana.riichi) lines.push('リーチ すると 役が 1つ ふえて、裏ドラも のるかも！ リーチボタン → 光った 牌を タップ 2回');
                else if (left === 0) lines.push('待ちの 牌が もう のこって いないよ。リーチは しないで 手を かえよう');
                else lines.push('リーチ しないで（ダマで）あがっても 点数が 高いので、このまま 待とう');
            }
            const disc = new Set(g.h.discards[seat].map(d => kindOf(d.tile)));
            if (ana.wait.some(w => disc.has(w.k))) lines.push('⚠ 待ちの 牌を 自分で 捨てて いるので フリテン。ロンは できないよ（ツモなら OK）');
        } else {
            lines.push(r.shanten === 1 ? 'あと 1枚 いい 牌が 来たら テンパイ！' : `テンパイまで あと ${r.shanten}まい`);
            lines.push(`${tn(t)} を 切ると、${r.kinds.length}種類 ${r.total}枚で 手が すすむよ`);
            const k = kindOf(t), cc = toCounts(g.h.hands[seat]);
            if (isHonor(k) && cc[k] === 1) lines.push(`${kn(k)}は 1枚だけで つかいにくい 字牌だから 先に 切ろう`);
            else if (isYaochu(k) && cc[k] === 1) lines.push('1・9 は 順子（れんぞくした 3枚）を 作りにくいので 先に 切りやすい');
        }
        const ny = noYakuWarning(g, seat);
        if (ny) { lines.push('⚠ ' + ny); mood = 'worry'; }
    }
    return { ana, mood, title, lines, tile: t };
}

/** 鳴ける ときの アドバイス */
export function claimAdvice(g, seat, opt, tile, from, nameOf) {
    if (opt.ron) return { mood: 'happy', title: 'ロン できるよ！', lines: [`${nameOf(from)}の ${tn(tile)} で あがれる！「ロン」ボタンを おそう`] };
    const a = analyzeClaim(g, seat, opt, tile, from);
    const word = { pon: 'ポン', chi: 'チー', minkan: 'カン' };
    if (a.act.a === 'pass') {
        const why = [];
        if (a.riichiSeats.length && a.after >= 1) why.push('リーチの 人が いるのに 手が まだ とおいので、鳴かずに まもろう');
        else if (a.after >= a.now) why.push('鳴いても 手が すすまないよ');
        else if (!a.path) why.push('鳴くと 役が なくなって あがれなく なるかも');
        else if (a.menzen) why.push('鳴かないで リーチを めざした ほうが 点数が 高く なりそう');
        else why.push('いまは 鳴かなくても だいじょうぶ');
        return { mood: 'normal', title: 'スキップが おすすめ', lines: why };
    }
    const lines = [];
    if (a.yakuhai && a.act.a === 'pon') lines.push(`${tn(tile)}は 役牌！ ポンすると 役が つくよ`);
    else if (a.path === 'tanyao') lines.push('鳴いても タンヤオ（2〜8だけ）の 役が あるので OK');
    else if (a.path === 'flush') lines.push('同じ 色で そろえて いるから、鳴いても ホンイツの 役が あるよ');
    else if (a.path === 'toitoi') lines.push('3枚組を あつめて トイトイを ねらおう');
    else if (a.path === 'yakuhai') lines.push('もう 役牌が あるので、鳴いて はやく あがろう');
    lines.push(a.after === 0 ? '鳴くと テンパイ！' : `鳴くと テンパイまで あと ${a.after}まい`);
    return { mood: 'happy', title: `${word[a.act.a] || '鳴き'} しよう！`, lines };
}

/** だれかが リーチした とき */
export function riichiAlert(g, seat, q, nameOf) {
    return {
        mood: 'worry', title: `${nameOf(q)}が リーチ！`,
        lines: ['テンパイ（あと1枚で あがり）の 合図だよ。あぶない 牌に 気を つけよう',
            'あんぜんな じゅん：①現物（その 人が 捨てた 牌）②壁・3枚 見えた 字牌 ③スジ（4が 捨てて あれば 1と7 など）',
            '手が いい ときは すすめても いいけど、とおい ときは まもろう']
    };
}
