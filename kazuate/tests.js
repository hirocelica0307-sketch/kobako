/* 数字あての きまりの たしかめ（ブラウザで tests.html、または node kazuate/tests.js） */
import { isValid, judge, randomSecret, reduce, verify, hashSecret, other } from './logic.js';

export async function runTests() {
    const out = [];
    const t = async (name, fn) => {
        try { const d = await fn(); out.push({ name, ok: true, detail: d || '' }); }
        catch (e) { out.push({ name, ok: false, detail: e.message }); }
    };
    const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

    /** 2人の 対戦を ログで うごかす：secrets と コールの ならびから ログを つくる */
    const play = async (first, secrets, calls, digits = 3) => {
        const log = [];
        const salts = { host: 'a1', guest: 'b2' };
        log.push({ k: 'c', by: 'host', h: await hashSecret(secrets.host, salts.host) });
        log.push({ k: 'c', by: 'guest', h: await hashSecret(secrets.guest, salts.guest) });
        let turn = first;
        for (const g of calls) {
            const st = reduce(log, { first, digits });
            if (st.phase !== 'play') break;
            turn = st.turn;
            log.push({ k: 'g', by: turn, g });
            const j = judge(secrets[other(turn)], g);
            log.push({ k: 'r', by: other(turn), h: j.h, b: j.b });
        }
        let st = reduce(log, { first, digits });
        if (st.phase === 'end') {
            for (const r of ['host', 'guest']) log.push({ k: 'v', by: r, s: secrets[r], salt: salts[r] });
            st = reduce(log, { first, digits });
        }
        return { log, st };
    };

    await t('正しい 数字の きまり（けた数・ちがう 数字・0 から はじまる）', () => {
        eq(isValid('427', 3), true); eq(isValid('042', 3), true); eq(isValid('0427', 4), true);
        eq(isValid('447', 3), false, '同じ数字'); eq(isValid('42', 3), false, 'みじかい'); eq(isValid('42a', 3), false); eq(isValid('4271', 3), false);
    });
    await t('ヒットと ブロー（例：427 に 472 → 1ヒット 2ブロー）', () => {
        eq(judge('427', '472'), { h: 1, b: 2 });
        eq(judge('427', '427'), { h: 3, b: 0 });
        eq(judge('427', '135'), { h: 0, b: 0 });
        eq(judge('0123', '3210'), { h: 0, b: 4 });
        eq(judge('0123', '0145'), { h: 2, b: 0 });
    });
    await t('ランダムな 数字は いつも 正しい（3・4けた 各2000回）', () => {
        for (const n of [3, 4]) for (let i = 0; i < 2000; i++) if (!isValid(randomSecret(n), n)) throw new Error('だめな 数字');
    });
    await t('ふたりが 決めるまでは はじまらない', async () => {
        const st = reduce([{ k: 'c', by: 'host', h: 'x' }], { first: 'host', digits: 3 });
        eq(st.phase, 'secret');
        eq(reduce([{ k: 'c', by: 'host', h: 'x' }, { k: 'c', by: 'guest', h: 'y' }], { first: 'host', digits: 3 }).phase, 'play');
    });
    await t('先攻だけが さいしょに コールできる・番でない コールは むし', () => {
        const base = [{ k: 'c', by: 'host', h: 'x' }, { k: 'c', by: 'guest', h: 'y' }];
        const st = reduce([...base, { k: 'g', by: 'guest', g: '123' }], { first: 'host', digits: 3 });
        eq(st.pending, null);
        const st2 = reduce([...base, { k: 'g', by: 'host', g: '123' }, { k: 'g', by: 'host', g: '456' }], { first: 'host', digits: 3 });
        eq(st2.pending.g, '123', '答えを まつ あいだの 2つめは むし');
    });
    await t('答えは コールされた 人しか 書けない', () => {
        const base = [{ k: 'c', by: 'host', h: 'x' }, { k: 'c', by: 'guest', h: 'y' }, { k: 'g', by: 'host', g: '123' }];
        const st = reduce([...base, { k: 'r', by: 'host', h: 3, b: 0 }], { first: 'host', digits: 3 });
        eq(st.guesses.host.length, 0);
        const st2 = reduce([...base, { k: 'r', by: 'guest', h: 1, b: 1 }], { first: 'host', digits: 3 });
        eq(st2.guesses.host, [{ g: '123', h: 1, b: 1 }]); eq(st2.turn, 'guest');
    });
    await t('後攻が 先に 当てたら すぐ 後攻の 勝ち', async () => {
        const { st } = await play('host', { host: '427', guest: '159' }, ['012', '427']);
        eq(st.winner, 'guest'); eq(st.solved.guest, 1);
    });
    await t('先攻が 当てたら 後攻に 最後の 1回 → 外したら 先攻の 勝ち', async () => {
        const { st } = await play('host', { host: '427', guest: '159' }, ['159', '012']);
        eq(st.winner, 'host'); eq(st.guesses.guest.length, 1);
    });
    await t('先攻が 当てて、後攻も 最後に 当てたら 引き分け', async () => {
        const { st } = await play('guest', { host: '427', guest: '159' }, ['427', '159']);
        eq(st.winner, 'draw'); eq(st.solved, { host: 1, guest: 1 });
    });
    await t('こうさん → 相手の 勝ち・そのあとの コールは むし', () => {
        const log = [{ k: 'c', by: 'host', h: 'x' }, { k: 'c', by: 'guest', h: 'y' }, { k: 's', by: 'host' }, { k: 'g', by: 'host', g: '123' }];
        const st = reduce(log, { first: 'host', digits: 3 });
        eq(st.winner, 'guest'); eq(st.surrender, 'host'); eq(st.pending, null);
    });
    await t('ログに ぬけが あったら そこで とまる（とどいた じゅんに よむ）', () => {
        const log = [{ k: 'c', by: 'host', h: 'x' }, undefined, { k: 'c', by: 'guest', h: 'y' }];
        const st = reduce(log, { first: 'host', digits: 3 });
        eq(st.phase, 'secret'); eq(st.length, 1);
    });
    await t('おわった あと 数字を 見せて、ハッシュと 答えが あえば OK', async () => {
        const { st } = await play('host', { host: '0427', guest: '1593' }, ['1234', '5678', '1593', '0427'], 4);
        eq(await verify(st, 'host'), 'ok'); eq(await verify(st, 'guest'), 'ok');
        eq(st.winner, 'draw');
    });
    await t('答えを ごまかしたら 見つかる（ちがう 数字を 見せる・答えを まちがえる）', async () => {
        const { log } = await play('host', { host: '427', guest: '159' }, ['159', '012']);
        const fake = log.map(e => (e.k === 'v' && e.by === 'guest' ? { ...e, s: '158' } : e));
        eq(await verify(reduce(fake, { first: 'host', digits: 3 }), 'guest'), 'bad', 'ちがう数字');
        const lie = log.map(e => (e.k === 'r' && e.by === 'host' ? { ...e, h: 0, b: 0 } : e));
        eq(await verify(reduce(lie, { first: 'host', digits: 3 }), 'host'), 'bad', 'うその答え');
    });
    await t('ランダムな 対戦 300回：かならず おわり、結果が ルールどおり', async () => {
        for (let i = 0; i < 300; i++) {
            const n = i % 2 ? 4 : 3;
            const secrets = { host: randomSecret(n), guest: randomSecret(n) };
            // あてずっぽう（ときどき 正解を まぜる）
            const calls = [];
            for (let k = 0; k < 60; k++) calls.push(Math.random() < 0.08 ? null : randomSecret(n));
            const log = [];
            log.push({ k: 'c', by: 'host', h: 'x' }, { k: 'c', by: 'guest', h: 'y' });
            const first = i % 3 ? 'host' : 'guest';
            for (const c of calls) {
                const st = reduce(log, { first, digits: n });
                if (st.phase !== 'play') break;
                const g = c || secrets[other(st.turn)];
                log.push({ k: 'g', by: st.turn, g });
                const j = judge(secrets[other(st.turn)], g);
                log.push({ k: 'r', by: other(st.turn), ...j });
            }
            let st = reduce(log, { first, digits: n });
            if (st.phase !== 'end') {   // おわらなかったら 正解を 入れて おわらせる
                for (let k = 0; k < 4 && st.phase !== 'end'; k++) {
                    const g = secrets[other(st.turn)];
                    log.push({ k: 'g', by: st.turn, g }, { k: 'r', by: other(st.turn), h: n, b: 0 });
                    st = reduce(log, { first, digits: n });
                }
            }
            if (st.phase !== 'end') throw new Error('おわらない');
            const f = first, s = other(first);
            const diff = st.guesses[f].length - st.guesses[s].length;
            if (diff !== 0 && diff !== 1) throw new Error('回数が おかしい ' + diff);
            if (st.winner === 'draw' && !(st.solved[f] && st.solved[s])) throw new Error('引き分けが おかしい');
            if (st.winner === f && st.guesses[s].length !== st.guesses[f].length) throw new Error('後攻の 最後の 1回が ない');
        }
        return '300回';
    });
    return out;
}

// node で うごかした とき
if (typeof window === 'undefined') {
    runTests().then(r => {
        for (const x of r) console.log(`${x.ok ? 'OK ' : 'NG '} ${x.name}${x.detail ? '（' + x.detail + '）' : ''}`);
        const ng = r.filter(x => !x.ok).length;
        console.log(ng ? `${ng}こ だめ / ${r.length}こ` : `ぜんぶ OK（${r.length}こ）`);
        if (ng && typeof process !== 'undefined') process.exitCode = 1;
    });
}
