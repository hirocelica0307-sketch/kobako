/* 数字あて（ヒット＆ブロー）の きまり
   ------------------------------------------------------------------
   ・おたがい 0〜9 の ちがう 数字で できた 3けた か 4けたの「ひみつの 数字」を きめる
   ・こうたいで 相手の 数字を コールし、ヒット（数字も 場所も あう）と
     ブロー（数字は あるが 場所が ちがう）の 数を 教えてもらう
   ・先に ぜんぶ ヒットに した 人の 勝ち。先攻が 当てたら、後攻にも
     最後の 1回が あり、後攻も 当てたら 引き分け

   対戦の ようすは「ログ」（おこった ことの ならび）だけで あらわし、
   reduce() で いまの じょうたいを くみたてます。ふたりの 端末は 同じ ログから
   同じ じょうたいを つくるので、くいちがいが おきません。

   ログの 1つ分（k が しゅるい）
     { k:'c', by, h }        ひみつの 数字を きめた（h は 数字と 塩の ハッシュ。数字そのものは 送らない）
     { k:'g', by, g }        コールした（g は '0427' のような 文字）
     { k:'r', by, h, b }     コールされた 人の 端末が 自動で こたえた（ヒット・ブローの 数）
     { k:'s', by }           こうさん
     { k:'v', by, s, salt }  おわった あとに ひみつの 数字を 見せる（ずるが ないか たしかめる ため）
     { k:'m', by, m, t }     ひとこと（スタンプ）
   ------------------------------------------------------------------ */

export const ROLES = ['host', 'guest'];
export const other = r => (r === 'host' ? 'guest' : 'host');

/** 正しい ひみつの 数字・コールか（n けた・0〜9・同じ 数字なし） */
export function isValid(s, n) {
    if (typeof s !== 'string' || s.length !== n || !/^[0-9]+$/.test(s)) return false;
    return new Set(s).size === n;
}

/** ヒットと ブローを かぞえる */
export function judge(secret, guess) {
    let h = 0, b = 0;
    for (let i = 0; i < guess.length; i++) {
        if (secret[i] === guess[i]) h++;
        else if (secret.includes(guess[i])) b++;
    }
    return { h, b };
}

/** ランダムな ひみつの 数字 */
export function randomSecret(n, rnd = Math.random) {
    const d = '0123456789'.split('');
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d.slice(0, n).join('');
}

export function makeSalt() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
}

/** 数字と 塩の ハッシュ（SHA-256 の 16進）。https か localhost で うごきます */
export async function hashSecret(s, salt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + s));
    return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * ログから いまの じょうたいを つくる
 * @param {Array} log   ならんだ ログ（ぬけが ある ところは undefined）
 * @param {{first:string, digits:number}} opt  先攻（'host'|'guest'）と けた数
 */
export function reduce(log, { first, digits }) {
    const st = {
        digits, first,
        phase: 'secret',              // secret → play → end
        commits: { host: null, guest: null },
        turn: first,                  // つぎに コールする 人
        pending: null,                // こたえ まちの コール { by, g, i（ログの 何ばんめか） }
        guesses: { host: [], guest: [] }, // その 人が した コール { g, h, b }
        solved: { host: 0, guest: 0 }, // 何回目で 当てたか（0 は まだ）
        lastChance: false,            // 先攻が 当てて、後攻の 最後の 1回
        winner: null,                 // 'host' | 'guest' | 'draw'
        surrender: null,
        reveals: { host: null, guest: null },
        stamps: []
    };
    // とどいた ところまで（ぬけが あったら そこで とめる）
    let i = 0;
    for (; i < log.length; i++) {
        const e = log[i];
        if (!e) break;
        if (ROLES.includes(e.by)) apply(st, e, i);
    }
    st.length = i;   // つぎに 書く ばんごう
    return st;
}

function apply(st, e, i) {
    const n = st.digits;
    switch (e.k) {
    case 'c':
        if (st.phase !== 'secret' || st.commits[e.by] || typeof e.h !== 'string') return;
        st.commits[e.by] = e.h;
        if (st.commits.host && st.commits.guest) st.phase = 'play';
        return;
    case 'g':
        if (st.phase !== 'play' || st.pending || e.by !== st.turn || !isValid(e.g, n)) return;
        st.pending = { by: e.by, g: e.g, i };
        return;
    case 'r': {
        const p = st.pending;
        if (st.phase !== 'play' || !p || e.by !== other(p.by)) return;
        const h = Number(e.h), b = Number(e.b);
        if (!(h >= 0 && b >= 0 && h + b <= n)) return;
        st.guesses[p.by].push({ g: p.g, h, b });
        st.pending = null;
        const o = other(p.by);
        if (h === n) {
            st.solved[p.by] = st.guesses[p.by].length;
            if (p.by === st.first) {
                // 先攻が 当てた：後攻に 最後の 1回
                st.turn = o;
                st.lastChance = true;
            } else {
                st.phase = 'end';
                st.winner = st.solved[o] ? 'draw' : p.by;
            }
        } else if (st.lastChance) {
            st.phase = 'end';
            st.winner = o;
        } else {
            st.turn = o;
        }
        return;
    }
    case 's':
        if (st.phase === 'end') return;
        st.phase = 'end';
        st.surrender = e.by;
        st.winner = other(e.by);
        st.pending = null;
        return;
    case 'v':
        if (st.phase !== 'end' || st.reveals[e.by]) return;
        if (typeof e.s !== 'string' || typeof e.salt !== 'string') return;
        st.reveals[e.by] = { s: e.s, salt: e.salt };
        return;
    case 'm':
        if (typeof e.m === 'string') st.stamps.push({ i, by: e.by, m: e.m.slice(0, 20), t: Number(e.t) || 0 });
        return;
    default:
    }
}

/**
 * 見せてもらった ひみつの 数字が、さいしょの ハッシュと これまでの こたえに あっているか
 * @returns {Promise<'ok'|'bad'|'wait'>}
 */
export async function verify(st, role) {
    const rv = st.reveals[role];
    if (!rv) return 'wait';
    if (!isValid(rv.s, st.digits)) return 'bad';
    if (st.commits[role] && (await hashSecret(rv.s, rv.salt)) !== st.commits[role]) return 'bad';
    for (const x of st.guesses[other(role)]) {
        const j = judge(rv.s, x.g);
        if (j.h !== x.h || j.b !== x.b) return 'bad';
    }
    return 'ok';
}
