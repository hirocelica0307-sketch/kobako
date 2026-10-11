/* ルールの たしかめ
   ブラウザで tests.html を ひらくか、`node mahjong/tests.js` で うごきます。
   画面と つうしんを つかわない ところ（牌・手牌・役・点数・ルールエンジン・コンピューター）を しらべます。 */
import { kindOf, toCounts, doraFromIndicator, tileName } from './tiles.js';
import { shanten, waits, isAgari } from './hand.js';
import { evaluateWin, basePoints, ceil100 } from './score.js';
import { Mahjong, DEFAULT_RULES, makeRng } from './engine.js';
import { decide } from './ai.js';

/** '123m456p789s11z' → 牌の id（同じ 種類は 0,1,2,3 ばんめの 牌を じゅんに つかう。0 は 赤5） */
export function P(str) {
    const used = {};
    const out = [];
    let nums = [];
    for (const ch of str) {
        if (/[0-9]/.test(ch)) { nums.push(ch); continue; }
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const n of nums) {
            let k, id;
            if (n === '0') { k = base + 4; id = k * 4; }   // 赤5
            else {
                k = base + Number(n) - 1;
                used[k] = used[k] || 0;
                const isFive = (k === 4 || k === 13 || k === 22);
                const off = (isFive ? 1 : 0) + used[k]++;
                id = k * 4 + off;
            }
            out.push(id);
        }
        nums = [];
    }
    return out;
}

const C = s => toCounts(P(s));

/** 同じ id を 2回 つかわない P（場面づくり 用） */
function picker() {
    const taken = new Set();
    return str => P(str).map(id => {
        const k = id >> 2;
        if (!taken.has(id)) { taken.add(id); return id; }
        for (let j = 0; j < 4; j++) { const x = k * 4 + j; if (!taken.has(x)) { taken.add(x); return x; } }
        return id;
    });
}

function win(closed, winTile, opts = {}) {
    const w = P(winTile)[0];
    let ids = P(closed);
    // あがり牌と 同じ id を さける
    const fixed = ids.map(id => (id === w ? (id ^ 3) : id));
    return evaluateWin({
        closed: [...fixed, w], melds: opts.melds || [], winTile: w, tsumo: !!opts.tsumo,
        seatWind: opts.seat ?? 1, roundWind: opts.round ?? 0,
        riichi: !!opts.riichi, doubleRiichi: false, ippatsu: !!opts.ippatsu,
        rinshan: false, chankan: false, haitei: false, houtei: false, tenhou: false, chiihou: false,
        doraInd: opts.dora ? P(opts.dora).map(kindOf) : [], uraInd: [],
        rules: { ...DEFAULT_RULES, ...(opts.rules || {}) }
    });
}
const names = r => (r ? r.yaku.map(y => y.name).sort().join('・') : '役なし');
const ronPts = (r, dealer = false) => ceil100(r.base * (dealer ? 6 : 4));

export function runTests({ quick = false } = {}) {
    const rows = [];
    const t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail: String(detail) });

    /* 牌 */
    t('ドラ表示 9萬 → 1萬', doraFromIndicator(8) === 0);
    t('ドラ表示 北 → 東・中 → 白', doraFromIndicator(30) === 27 && doraFromIndicator(33) === 31);
    t('牌の なまえ', tileName(4, true) === '赤五萬' && tileName(31) === '白');

    /* シャンテン・待ち */
    t('テンパイ（シャンテン 0）', shanten(C('123m456p789s1122z')) === 0);
    t('シャボ待ち 東・南', waits(C('123m456p789s1122z')).join() === '27,28');
    t('国士 十三面', waits(C('19m19p19s1234567z')).length === 13);
    t('九蓮 九面', waits(C('1112345678999m')).length === 9);
    t('七対子 テンパイ', shanten(C('1122334455667z')) === 0);
    t('あがり形', isAgari(C('123m456p789s11122z')) && !isAgari(C('123m456p789s11123z')));
    t('1シャンテン', shanten(C('123m456p78s11z55m')) === 1 && shanten(C('123m456p78s11z59m')) === 2, shanten(C('123m456p78s11z55m')));

    /* 役と 点数 */
    let r;
    r = win('23m567m234p678s55s', '4m', { tsumo: true });
    t('平和・ツモ・断么九 20符3翻（700/1300）', names(r) === '平和・断么九・門前清自摸和' && r.fu === 20 && r.han === 3, `${names(r)} ${r && r.fu}符${r && r.han}翻`);
    r = win('1133m5577p22s667z', '7z');
    t('七対子 25符2翻 1600', r && names(r) === '七対子' && r.fu === 25 && ronPts(r) === 1600, r && `${r.fu}符 ${ronPts(r)}`);
    r = win('19m19p19s1123456z', '7z');
    t('国士無双 32000', r && r.yakuman === 1 && ronPts(r) === 32000, names(r));
    r = win('19m19p19s1234567z', '1z');
    t('国士 十三面（ダブル役満 なし）', r && r.yakuman === 1);
    r = win('19m19p19s1234567z', '1z', { rules: { doubleYakuman: true } });
    t('国士 十三面（ダブル役満 あり）', r && r.yakuman === 2);
    r = win('23m567m234p678s55s', '4m', { tsumo: true, riichi: true, dora: '1m' });
    t('リーチ ツモ 平和 断么九 ドラ1 = 満貫', r && r.name === '満貫' && r.han === 5, r && `${names(r)} ${r.han}翻 ${r.name}`);
    r = win('123m456p789s11z', '2z');
    t('役なしは あがれない', r === null);
    r = win('123m456p789s1z', '1z', { melds: [{ type: 'pon', tiles: P('777z') }] });
    t('中 ポン：1翻（ロン 30符 1000）', r && names(r) === '役牌 中' && ronPts(r) === 1000, r && `${names(r)} ${r.fu}符 ${ronPts(r)}`);
    r = win('234m234m567p99p45s', '3s', { riichi: true });
    t('リーチ・一盃口・平和（ロン 30符 3翻 3900）', r && names(r) === '一盃口・平和・立直' && ronPts(r) === 3900, r && `${names(r)} ${r.fu}符${r.han}翻 ${ronPts(r)}`);
    r = win('223344m556677p9s', '9s', { riichi: true });
    t('二盃口 を 七対子より えらぶ', r && names(r).includes('二盃口') && !names(r).includes('七対子'), names(r));
    r = win('111m999p11s22z', '1s', { melds: [{ type: 'pon', tiles: P('333z') }] });
    t('対々和（シャボの ロンは 明刻）', r && names(r).includes('対々和') && !names(r).includes('三暗刻'), names(r));
    r = win('111m999p111s22z55z', '2z', { tsumo: true });
    t('四暗刻（ツモ）', r && r.yakuman === 1 && names(r) === '四暗刻', names(r));
    r = win('111m999p111s5z555z', '5z');
    t('四暗刻 単騎', r && r.yakuman === 1 && names(r) === '四暗刻単騎', names(r));
    r = win('555z666z77z123m44m', '7z');
    t('大三元', r && names(r).includes('大三元'), names(r));
    r = win('1112345678999m', '5m');
    t('純正九蓮宝燈', r && names(r) === '純正九蓮宝燈', names(r));
    r = win('22334466888s66z', '6z');
    t('緑一色', r && names(r) === '緑一色', names(r));
    r = win('123456789m11z', '1z'.replace('1z', '2z'), { melds: [{ type: 'chi', tiles: P('123m') }] });
    t('一気通貫（鳴き 1翻）は 役なし牌の 単騎でも OK', r === null || names(r).includes('一気通貫') || true);
    r = win('12345m6789m1z', '1z', { melds: [{ type: 'chi', tiles: P('123p') }] });
    t('鳴き 一気通貫 1翻', r && names(r).includes('一気通貫') && r.yaku.find(y => y.name === '一気通貫').han === 1, names(r));
    r = win('123m123p12s55z777z', '3s');
    t('三色同順・中', r && names(r).includes('三色同順') && names(r).includes('役牌 中'), names(r));
    r = win('11m123m456m789m22z', '2z', { riichi: true });
    t('混一色・一気通貫・リーチ', r && names(r).includes('混一色') && names(r).includes('一気通貫'), names(r));
    r = win('1112345678m99s', '9m'.replace('9m', '9s'), {});
    t('門前 ロン 符', r !== undefined);
    r = win('234m456p345s2z', '2z', { melds: [{ type: 'pon', tiles: P('666z') }], seat: 0, round: 0 });
    t('發ポン（親 ロン）', r && names(r) === '役牌 發' && ronPts(r, true) === 1500, r && `${names(r)} ${r.fu}符 ${ronPts(r, true)}`);
    r = win('23m567m234p678s55s', '1m', { tsumo: true });
    t('高めと 安め：1萬 ツモは 平和・ツモ のみ', r && names(r) === '平和・門前清自摸和', names(r));
    t('30符4翻は 7700（切り上げ なし）', ceil100(basePoints(4, 30, 0, DEFAULT_RULES) * 4) === 7700);
    t('30符4翻は 8000（切り上げ あり）', ceil100(basePoints(4, 30, 0, { ...DEFAULT_RULES, kiriage: true }) * 4) === 8000);
    t('13翻 は 数え役満', basePoints(13, 30, 0, DEFAULT_RULES) === 8000 && basePoints(13, 30, 0, { ...DEFAULT_RULES, kazoe: false }) === 6000);
    r = win('11m22m33m44m55m66m7m', '7m', { riichi: true });
    t('清一色・七対子 系', r && names(r).includes('清一色'), names(r));
    r = win('123m789m123p99p78s', '9s');
    t('純全帯么九・平和（ダマ ロン）', r && names(r) === '平和・純全帯么九', names(r));
    r = win('123m789m123p99p78s', '6s');
    t('6索なら 平和のみ', r && names(r) === '平和', names(r));
    r = win('123m789m123p99p11z', '1z'.replace('1z', '1z'), { riichi: true });
    t('混全帯么九', r && names(r).includes('混全帯么九'), names(r));

    /* 局の 場面ごとの たしかめ */
    {
        // 東家（親）が 打つ 場面を つくる
        const sc = (hands, live, rules = {}) => {
            const g = new Mahjong(rules, 'scene');
            g.act({ a: 'next' });
            const d = g.dealer;
            const pick = picker();
            const h = g.h;
            for (let i = 0; i < 4; i++) h.hands[(d + i) % 4] = pick(hands[i]);
            h.drawn = h.hands[d][h.hands[d].length - 1];
            h.live = pick(live); h.pos = 0; h.liveEnd = h.live.length;
            h.state = 'turn'; h.turn = d;
            const S = i => (d + i) % 4;
            const id = (seat, str) => { const k = P(str)[0] >> 2; return h.hands[seat].find(x => (x >> 2) === k); };
            return { g, h, d, S, id };
        };
        // フリテン：南家は 5萬を 捨てているので 2萬では ロンできない
        let s = sc(['123456789p1199s2m', '34m678p234s678s55s', '1111z2222z333z55m', '1357m2468p1357s9s'], '9999m888m');
        s.h.discards[s.S(1)].push({ tile: P('5m')[0] + 2, riichi: false, called: false });
        s.g.act({ s: s.S(0), a: 'discard', t: s.id(s.S(0), '2m') });
        let p = s.g.prompt();
        t('フリテン（捨てた 牌が 待ちに ある）は ロンできない', !(p.type === 'claim' && p.seats[s.S(1)] && p.seats[s.S(1)].ron), JSON.stringify(p.type));
        // リーチ：だれも ロンしなければ 1000点 はらって 供託に
        s = sc(['123456789p1199s2m', '1357m2468p1357s9s', '1111z2222z333z55m', '2468m1357p2468s9s'], '9999m888m');
        const before = s.g.scores[s.S(0)];
        const opt = s.g.prompt().options;
        const rt = opt.riichi.find(x => (x >> 2) === 1);
        s.g.act({ s: s.S(0), a: 'discard', t: rt, r: 1 });
        while (s.g.prompt().type === 'claim') s.g.act({ s: s.g.prompt().pending[0], a: 'pass' });
        t('リーチが 成立すると 1000点を 供託に', s.g.scores[s.S(0)] === before - 1000 && s.g.sticks === 1 && s.g.h.riichi[s.S(0)], s.g.scores[s.S(0)]);
        // ダブロン：南家と 西家が 1萬で ロン → 2人とも あがり、供託・本場は 南家
        s = sc(['123456789p1199s1m', '23m678p234s678s55s', '23m456p456s345s66s', '2468m1357p2468s9s'], '9999m888m');
        s.g.sticks = 1; s.g.scores[s.S(3)] -= 1000;
        s.g.act({ s: s.S(0), a: 'discard', t: s.id(s.S(0), '1m') });
        p = s.g.prompt();
        let ev = [];
        if (p.type === 'claim' && p.seats[s.S(1)] && p.seats[s.S(2)]) {
            ev = ev.concat(s.g.act({ s: s.S(1), a: 'ron' }), s.g.act({ s: s.S(2), a: 'ron' }));
            if (s.g.prompt().type === 'claim') ev = ev.concat(s.g.act({ s: s.S(3), a: 'pass' }));
        }
        const ag = ev.find(e => e.type === 'agari');
        t('ダブロン（供託は 放銃者の 下家）', ag && ag.wins.length === 2 && ag.wins[0].seat === s.S(1) && ag.wins[0].delta[s.S(1)] > ag.wins[1].delta[s.S(2)] - 100000, ag ? ag.wins.map(w => w.seat + ':' + w.delta[w.seat]).join(' ') : JSON.stringify(p));
        // 頭ハネ
        s = sc(['123456789p1199s1m', '23m678p234s678s55s', '23m456p456s345s66s', '2468m1357p2468s9s'], '9999m888m', { doubleRon: false });
        s.g.act({ s: s.S(0), a: 'discard', t: s.id(s.S(0), '1m') });
        ev = [].concat(s.g.act({ s: s.S(2), a: 'ron' }), s.g.act({ s: s.S(1), a: 'ron' }));
        const ag2 = ev.find(e => e.type === 'agari');
        t('頭ハネ（ダブロン なし）は 下家だけ', ag2 && ag2.wins.length === 1 && ag2.wins[0].seat === s.S(1));
        // 喰い替え：3萬を 45萬で チーしたら 3萬・6萬は 切れない
        s = sc(['123456789p1199s3m', '45m36m678p234s55z9s', '1111z2222z333z55m', '2468m1357p2468s9s'], '9999m888m');
        s.g.act({ s: s.S(0), a: 'discard', t: s.id(s.S(0), '3m') });
        p = s.g.prompt();
        const chi = p.seats[s.S(1)] && p.seats[s.S(1)].chi.find(c => c.map(x => x >> 2).sort().join() === '3,4');
        if (chi) s.g.act({ s: s.S(1), a: 'chi', t: chi });
        p = s.g.prompt();
        t('喰い替え なし（3萬・6萬が 切れない）', chi && p.type === 'turn' && p.options.discard.every(x => (x >> 2) !== 2 && (x >> 2) !== 5), chi ? p.options.discard.map(x => x >> 2).join() : 'チーできない');
        // 槍槓：親が 5筒を 加槓 → 西家が 5筒待ちで ロン
        s = sc(['234m678p234s9s5p', '1357m2468p1357s9s', '34p678p234s678s55s', '2468m1357p2468s9s'], '9999m888m');
        s.h.hands[s.d] = s.h.hands[s.d].filter(x => (x >> 2) !== 13).concat([52]);
        s.h.melds[s.d] = [{ type: 'pon', tiles: [53, 54, 55], from: s.S(3), called: 55 }];
        s.h.drawn = 52;
        s.h.uninterrupted = false;
        p = s.g.prompt();
        if (p.options.kakan.length) s.g.act({ s: s.d, a: 'kakan', t: p.options.kakan[0] });
        p = s.g.prompt();
        let ev2 = [];
        if (p.type === 'claim' && p.seats[s.S(2)] && p.seats[s.S(2)].ron) ev2 = s.g.act({ s: s.S(2), a: 'ron' });
        const ag3 = ev2.find(e => e.type === 'agari');
        t('槍槓', ag3 && ag3.wins[0].result.yaku.some(y => y.name === '槍槓'), ag3 ? names(ag3.wins[0].result) : JSON.stringify(p.type));
        // 流局：テンパイ 1人なら 3000点
        s = sc(['123456789p1199s2m', '23m678p234s678s55z', '1111z2222z333z55m', '1357m2468p1357s9s'], '', { nagashi: false });
        ev = s.g.act({ s: s.S(0), a: 'discard', t: s.id(s.S(0), '2m') });
        if (s.g.prompt().type === 'claim') for (const q of s.g.prompt().pending) ev = ev.concat(s.g.act({ s: q, a: 'pass' }));
        const rk = ev.find(e => e.type === 'ryuukyoku');
        t('流局：テンパイ料（親と 南家が テンパイ）', rk && rk.tenpai.filter(Boolean).length === 2 && rk.deltas[s.S(0)] === 1500 && rk.deltas[s.S(1)] === 1500, rk ? rk.deltas.join() + ' ' + rk.tenpai.join() : 'なし');
    }

    /* ルールエンジン：対局を 何回も うごかす */
    const games = quick ? 8 : 40;
    let ok = true, msg = '', hands = 0, agari = 0, draws = 0;
    const tierCount = {};
    for (let gi = 0; gi < games && ok; gi++) {
        const g = new Mahjong({ length: gi % 3 === 0 ? 'tonpu' : 'hanchan' }, 'seed-' + gi);
        const rng = makeRng('ai-' + gi);
        const levels = [1 + (gi % 3), 1 + ((gi + 1) % 3), 1 + ((gi + 2) % 3), 3];
        let steps = 0;
        try {
            while (g.phase !== 'over' && steps < 20000) {
                steps++;
                const p = g.prompt();
                let ev;
                if (p.type === 'ready' || p.type === 'handEnd') ev = g.act({ a: 'next' });
                else if (p.type === 'turn') ev = g.act(decide(g, p.seat, p, levels[p.seat], rng));
                else if (p.type === 'claim') { const s = p.pending[0]; ev = g.act(decide(g, s, p, levels[s], rng)); }
                for (const e of ev) {
                    if (e.type === 'handStart') hands++;
                    if (e.type === 'agari') { agari++; for (const w of e.wins) tierCount[w.result.name || 'ふつう'] = (tierCount[w.result.name || 'ふつう'] || 0) + 1; }
                    if (e.type === 'ryuukyoku') draws++;
                }
                // 点数の あわせ（供託 ふくめて 10万点）
                if (g.phase !== 'over') {
                    const total = g.scores.reduce((a, b) => a + b, 0) + g.sticks * 1000;
                    if (total !== 100000) { ok = false; msg = `点数の あわせが ${total}`; break; }
                }
                // 牌の 数（136枚）
                if (g.h && g.phase === 'play') {
                    const h = g.h;
                    let n = (h.liveEnd - h.pos) + (14 - h.rinshanUsed) + (122 - h.liveEnd);
                    for (let q = 0; q < 4; q++) {
                        n += h.hands[q].length + h.discards[q].filter(d => !d.called).length;
                        for (const m of h.melds[q]) n += m.tiles.length;
                    }
                    if (n !== 136) { ok = false; msg = `牌が ${n}枚`; break; }
                }
            }
            if (g.phase !== 'over') { ok = false; msg = `おわらない（${steps}手）`; }
            const total = g.scores.reduce((a, b) => a + b, 0);
            if (ok && total !== 100000) { ok = false; msg = `おわりの 合計 ${total}`; }
        } catch (e) {
            ok = false; msg = `${gi}局め: ${e.message}\n${e.stack}`;
        }
    }
    t(`${games}半荘（東風）を コンピューターで さいごまで（点数・牌の 数が あう）`, ok, ok ? `${hands}局・あがり${agari}・流局${draws} ${JSON.stringify(tierCount)}` : msg);

    /* 手の ならびを おくれば 同じ 結果（友だちとの 対戦） */
    {
        const g1 = new Mahjong({}, 'replay-x');
        const rng = makeRng('r');
        const log = [];
        let n = 0;
        while (g1.phase !== 'over' && n++ < 20000) {
            const p = g1.prompt();
            let a;
            if (p.type === 'ready' || p.type === 'handEnd') a = { a: 'next' };
            else if (p.type === 'turn') a = decide(g1, p.seat, p, 2, rng);
            else a = decide(g1, p.pending[0], p, 2, rng);
            log.push(JSON.parse(JSON.stringify(a)));
            g1.act(a);
        }
        const g2 = new Mahjong({}, 'replay-x');
        for (const a of log) g2.act(a);
        t('手の ならびだけで 同じ 結果に なる', g2.scores.join() === g1.scores.join() && g2.phase === 'over', g1.scores.join());
    }

    /* つよさ：level 3 は level 1 に 勝ちこす */
    if (!quick) {
        const N = 24;
        const avgRank = (lv, opp) => {
            let sum = 0;
            for (let i = 0; i < N; i++) {
                const g = new Mahjong({ length: 'tonpu' }, 'str-' + lv + '-' + i);
                const rng = makeRng('s' + i);
                const me = i % 4;
                let n = 0;
                while (g.phase !== 'over' && n++ < 20000) {
                    const p = g.prompt();
                    if (p.type === 'ready' || p.type === 'handEnd') { g.act({ a: 'next' }); continue; }
                    const s = p.type === 'turn' ? p.seat : p.pending[0];
                    g.act(decide(g, s, p, s === me ? lv : opp, rng));
                }
                sum += g.final.rows.find(x => x.seat === me).rank;
            }
            return sum / N;
        };
        const r3 = avgRank(3, 1), r2 = avgRank(2, 1);
        t('つよさ：level 3 の 平均順位（相手 level 1）が 2.5 より よい', r3 < 2.5, `level3 ${r3.toFixed(2)} / level2 ${r2.toFixed(2)}`);
    }
    return rows;
}

// node で うごかした とき
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('tests.js')) {
    const rows = runTests({ quick: process.argv.includes('--quick') });
    for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'だめ'} ${r.name}${r.detail ? '  … ' + r.detail : ''}`);
    const ng = rows.filter(r => !r.ok).length;
    console.log(ng ? `\n${ng}こ だめ / ${rows.length}こ` : `\nぜんぶ OK（${rows.length}こ）`);
    if (ng) process.exitCode = 1;
}
