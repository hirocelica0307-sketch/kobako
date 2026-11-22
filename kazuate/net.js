/* ふたりの つうしん
   ------------------------------------------------------------------
   ホストが 部屋を つくると 4けたの 番号が でます。もう1人は その 番号
   （または 招待リンク）で 入ります。
   「花札 こいこい」「なみ麻雀」と 同じ Firebase（Realtime Database）を つかい、
   しまう 場所は kazuate/rooms/{番号}/ です。

   kazuate/rooms/{番号}/
     meta            部屋の じょうほう（ホスト・ゲスト・名まえ・けた数・何回めの 勝負か・先攻・結果）
     online/{役わり} いま つながっているか（host / guest）
     log/{n}/{0000}  n 回めの 勝負の ログ（1つずつ。いちど 書いたら 上書き できない）

   ひみつの 数字は 自分の 端末の 中だけに あり、つうしんでは ハッシュ（数字が わからない 形）
   だけを おくります。数字を おくるのは 勝負が おわった あとです。

   URL に ?fake を つけると、Firebase の かわりに この ブラウザの 中だけで
   うごく にせものを つかいます（タブを 2つ ひらいて ためす ため）。
   ------------------------------------------------------------------ */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
const ROOT = 'kazuate/rooms';
export const ROOM_STALE = 6 * 60 * 60 * 1000;   // 6時間 つかわれて いない 部屋は 番号を つかいまわす

export const useFake = /[?&]fake\b/.test(location.search);

/* ── この 端末の ID と、入って いる 部屋 ──────────────
   スマホで アプリを とじても もどれるように localStorage に のこす。
   ?fake の ときは タブごとに べつの 人に したいので sessionStorage。 */
const mem = {};
const box = () => (useFake ? sessionStorage : localStorage);
function sget(k) { try { return box().getItem(k); } catch (e) { return mem[k] || null; } }
function sset(k, v) { mem[k] = v; try { box().setItem(k, v); } catch (e) { /* むし */ } }
function sdel(k) { delete mem[k]; try { box().removeItem(k); } catch (e) { /* むし */ } }

export function memberId() {
    let id = sget('kz_member');
    if (!id) {
        id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        sset('kz_member', id);
    }
    return id;
}
export const savedRoom = () => { try { return JSON.parse(sget('kz_room') || 'null'); } catch (e) { return null; } };
export const saveRoom = v => (v ? sset('kz_room', JSON.stringify(v)) : sdel('kz_room'));

/** ひみつの 数字（この 端末だけに のこす） */
const secretKey = (code, game) => `kz_secret_${code}_${game}`;
export const loadSecret = (code, game) => { try { return JSON.parse(sget(secretKey(code, game)) || 'null'); } catch (e) { return null; } };
export function saveSecret(code, game, v) {
    // ふるい 勝負の 数字は もう いらないので けす
    try {
        const b = box();
        for (let i = b.length - 1; i >= 0; i--) {
            const k = b.key(i);
            if (k && k.startsWith('kz_secret_') && k !== secretKey(code, game)) b.removeItem(k);
        }
    } catch (e) { /* むし */ }
    sset(secretKey(code, game), JSON.stringify(v));
}

/* ── つなぎかた（本物 / にせもの） ───────────── */

let backend = null;

export function connect() {
    if (!backend) {
        backend = (useFake ? fakeBackend() : firebaseBackend())
            .then(async db => { await detectPath(db); return db; })
            .catch(e => { backend = null; throw e; });
    }
    return backend;
}

/* ── しまう 場所 ─────────────────────────────
   ふつうは kazuate/rooms/{番号}。
   Firebase の ルールを まだ はりかえて いない（kazuate の 場所が ことわられる）ときは、
   どの 版の ルールにも ある rooms/{番号}/kazuate に しまう（「花札」と 同じ やりかた）。 */
let pathMode = 'main';
const isDenied = e => /permission|denied/i.test(String(e && (e.code || e.message || e)));

async function detectPath(db) {
    try {
        await db.get(`${ROOT}/0000/meta`);
        pathMode = 'main';
        return;
    } catch (e) {
        if (!isDenied(e)) throw new Error(explainError(e));
    }
    try {
        await db.get('rooms/0000/kazuate/meta');
        pathMode = 'shared';
    } catch (e) {
        throw new Error(explainError(e));
    }
}

/** つうしんの エラーを 日本語の 説明に */
export function explainError(e) {
    const s = String(e && (e.code || e.message || e));
    if (/permission|denied/i.test(s)) return 'Firebase のルールでことわられました。README の「Firebase の設定」のとおりに、Realtime Database のルールを database.rules.json の中身にはりかえてください';
    if (/network|offline|failed to fetch|timeout|unavailable/i.test(s)) return 'つうしんできませんでした。ネットにつながっているか確かめて、もう一度ためしてください';
    return s;
}

async function firebaseBackend() {
    let appMod, authMod, dbMod;
    try {
        [appMod, authMod, dbMod] = await Promise.all([
            import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')
        ]);
    } catch (e) {
        throw new Error('つうしんの準備ができませんでした（ネットにつながっているか確かめてください）');
    }
    const app = appMod.initializeApp(FIREBASE_CONFIG, 'kazuate');
    const auth = authMod.getAuth(app);
    await Promise.race([
        authMod.signInAnonymously(auth),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
    ]).catch(() => { throw new Error('サインインできませんでした。しばらくしてからもう一度ためしてください'); });
    const db = dbMod.getDatabase(app);
    const fb = dbMod;
    let offset = 0;
    fb.onValue(fb.ref(db, '.info/serverTimeOffset'), s => { offset = Number(s.val()) || 0; });
    const r = p => fb.ref(db, p);
    return {
        now: () => Date.now() + offset,
        async get(p) { return (await fb.get(r(p))).val(); },
        set: (p, v) => fb.set(r(p), v),
        update: (p, v) => fb.update(r(p), v),
        remove: p => fb.remove(r(p)),
        async transact(p, fn) {
            const res = await fb.runTransaction(r(p), fn);
            return { committed: res.committed, value: res.snapshot.val() };
        },
        watch(p, cb) { return fb.onValue(r(p), s => cb(s.val()), () => cb(undefined)); },
        watchChildren(p, cb) { return fb.onChildAdded(r(p), s => cb(s.key, s.val())); },
        async presence(p) {
            await fb.onDisconnect(r(p)).remove();
            await fb.set(r(p), true);
            // つながりなおした ときにも もういちど 立てる
            fb.onValue(r('.info/connected'), s => {
                if (s.val() === true) {
                    fb.onDisconnect(r(p)).remove();
                    fb.set(r(p), true).catch(() => {});
                }
            });
        },
        cancelPresence(p) { return fb.onDisconnect(r(p)).cancel().catch(() => {}); }
    };
}

/* にせもの：localStorage を データベースに みたてる（同じ ブラウザの タブどうしで つうしん） */
async function fakeBackend() {
    const KEY = 'kazuate.fakedb';
    const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const split = p => p.split('/').filter(Boolean);
    const getAt = (tree, p) => split(p).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
    const setAt = (tree, p, v) => {
        const ks = split(p);
        let n = tree;
        for (let i = 0; i < ks.length - 1; i++) {
            if (!n[ks[i]] || typeof n[ks[i]] !== 'object') n[ks[i]] = {};
            n = n[ks[i]];
        }
        if (v === null || v === undefined) delete n[ks[ks.length - 1]];
        else n[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
    };
    const listeners = new Set();
    const write = mutate => {
        const tree = readAll();
        mutate(tree);
        localStorage.setItem(KEY, JSON.stringify(tree));
        setTimeout(() => listeners.forEach(f => f()), 0);
    };
    window.addEventListener('storage', e => { if (e.key === KEY) listeners.forEach(f => f()); });
    // ?fake&deny=kazuate で「ルールを はりかえて いない」ときを まねる
    const denyM = location.search.match(/[?&]deny=([a-z]+)/);
    const guard = p => { if (denyM && p.startsWith(denyM[1] + '/')) throw new Error('PERMISSION_DENIED: Permission denied'); };
    const lag = () => new Promise(res => setTimeout(res, 30 + Math.random() * 60));
    const seen = new Set();
    const presenceKeys = [];
    window.addEventListener('pagehide', () => write(t => presenceKeys.forEach(p => setAt(t, p, null))));
    return {
        now: () => Date.now(),
        async get(p) { await lag(); guard(p); return getAt(readAll(), p) ?? null; },
        async set(p, v) { await lag(); guard(p); write(t => setAt(t, p, v)); },
        async update(p, v) { await lag(); guard(p); write(t => { for (const [k, x] of Object.entries(v)) setAt(t, p + '/' + k, x); }); },
        async remove(p) { await lag(); guard(p); write(t => setAt(t, p, null)); },
        async transact(p, fn) {
            await lag(); guard(p);
            // 本物の Firebase と 同じく、まだ 見て いない 場所は さいしょに null で よぶ
            if (!seen.has(p)) {
                seen.add(p);
                if (fn(null) === undefined) return { committed: false, value: null };
            }
            let committed = false, value;
            write(t => {
                const cur = getAt(t, p) ?? null;
                const nv = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
                if (nv === undefined) { value = cur; return; }
                setAt(t, p, nv);
                committed = true;
                value = nv;
            });
            return { committed, value };
        },
        watch(p, cb) {
            let last;
            const f = () => {
                const v = getAt(readAll(), p) ?? null;
                const js = JSON.stringify(v);
                if (js !== last) { last = js; cb(v); }
            };
            listeners.add(f);
            setTimeout(f, 10);
            return () => listeners.delete(f);
        },
        watchChildren(p, cb) {
            const seenK = new Set();
            const f = () => {
                const v = getAt(readAll(), p) || {};
                for (const k of Object.keys(v).sort()) if (!seenK.has(k)) { seenK.add(k); cb(k, v[k]); }
            };
            listeners.add(f);
            setTimeout(f, 10);
            return () => listeners.delete(f);
        },
        async presence(p) { presenceKeys.push(p); await this.set(p, true); },
        async cancelPresence() { /* むし */ }
    };
}

/* ── 部屋 ──────────────────────────────────── */

const roomPath = code => (pathMode === 'shared' ? `rooms/${code}/kazuate` : `${ROOT}/${code}`);
const wrap = fn => async (...a) => { try { return await fn(...a); } catch (e) { throw new Error(explainError(e)); } };

/** 部屋を つくって 番号を かえします */
export const createRoom = wrap(async (name, digits) => {
    const db = await connect();
    const me = memberId();
    for (let attempt = 0; attempt < 12; attempt++) {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        const old = await db.get(`${roomPath(code)}/meta`);
        if (old && db.now() - (old.t || 0) < ROOM_STALE) continue;
        if (old) await db.remove(roomPath(code)).catch(() => {});
        const res = await db.transact(`${roomPath(code)}/meta`, cur => {
            if (cur && db.now() - (cur.t || 0) < ROOM_STALE) return undefined;
            return { host: me, hostName: name, guest: '', guestName: '', t: db.now(), digits, status: 'wait', game: 0, gd: digits, first: 'guest' };   // 1回目の 先攻が host に なるように
        });
        if (res.committed) {
            await db.presence(`${roomPath(code)}/online/host`);
            saveRoom({ code, role: 'host' });
            return code;
        }
    }
    throw new Error('部屋をつくれませんでした。もう一度ためしてください');
});

/** 番号の 部屋に 入ります */
export const joinRoom = wrap(async (code, name) => {
    const db = await connect();
    const me = memberId();
    let why = '';
    const meta = await db.get(`${roomPath(code)}/meta`);
    if (!meta) throw new Error('その番号の部屋はありません。相手の画面の4けたの番号を確かめてください');
    if (db.now() - (meta.t || 0) > ROOM_STALE) throw new Error('その部屋はもう終わっています');
    if (meta.host === me) throw new Error('自分の部屋には入れません');
    if (meta.guest && meta.guest !== me) throw new Error('その部屋はもういっぱいです');
    // 手もとに まだ 値が ない ときの null は そのまま かえして、サーバーの 値で もう一度 よんで もらう
    const res = await db.transact(`${roomPath(code)}/meta`, cur => {
        if (cur === null) return null;
        if (cur.guest && cur.guest !== me) { why = 'その部屋はもういっぱいです'; return undefined; }
        return { ...cur, guest: me, guestName: name, t: db.now() };
    });
    if (!res.committed || !res.value || res.value.guest !== me) throw new Error(why || '部屋に入れませんでした。もう一度ためしてください');
    await db.presence(`${roomPath(code)}/online/guest`);
    saveRoom({ code, role: 'guest' });
    return res.value;
});

/** もどってきた とき（ページを 読みなおした ときなど）に また 入りなおす */
export const rejoin = wrap(async (code, role) => {
    const db = await connect();
    const meta = await db.get(`${roomPath(code)}/meta`);
    if (!meta || meta[role] !== memberId()) throw new Error('部屋にもどれませんでした');
    await db.presence(`${roomPath(code)}/online/${role}`);
    return meta;
});

export async function watchMeta(code, cb) {
    const db = await connect();
    return db.watch(`${roomPath(code)}/meta`, cb);
}
export async function watchOnline(code, cb) {
    const db = await connect();
    return db.watch(`${roomPath(code)}/online`, v => cb(v || {}));
}
export async function updateMeta(code, patch) {
    const db = await connect();
    return db.update(`${roomPath(code)}/meta`, { ...patch, t: db.now() });
}
export async function serverNow() {
    const db = await connect();
    return db.now();
}

/**
 * つぎの 勝負を はじめる（どちらが おしても よい）。勝負の 番号は 1, 2, 3 …
 * いまの 勝負が prevGame の ときだけ すすめるので、ふたり同時に おしても 1回分しか すすまない。
 */
export const startGame = wrap(async (code, prevGame) => {
    const db = await connect();
    await db.transact(`${roomPath(code)}/meta`, cur => {
        if (cur === null) return null;
        if (cur.game !== prevGame) return undefined;   // もう だれかが すすめた
        const first = cur.first === 'host' ? 'guest' : 'host';   // 先攻は 1回ごとに こうたい
        return { ...cur, status: 'play', game: cur.game + 1, gd: cur.digits, first, t: db.now() };
    });
});

export async function watchLog(code, game, cb) {
    const db = await connect();
    return db.watchChildren(`${roomPath(code)}/log/${game}`, (k, v) => cb(Number(k), v));
}

/**
 * ログに 1つ たす。from ばんめから あいて いる ところを さがして 書く
 * （ふたりが 同じ ばんごうに 同時に 書こうと したら、おそい ほうが つぎへ ずれる）
 */
export async function appendLog(code, game, from, entry) {
    const db = await connect();
    for (let i = from; i < from + 30; i++) {
        const key = String(i).padStart(4, '0');
        try {
            const res = await db.transact(`${roomPath(code)}/log/${game}/${key}`, cur => (cur === null ? entry : undefined));
            if (res.committed) return i;
        } catch (e) {
            throw new Error(explainError(e));
        }
    }
    throw new Error('送れませんでした。もう一度ためしてください');
}

/** 部屋を 出ます（ホストが 出たら 部屋ごと けします） */
export async function leaveRoom(code, role) {
    saveRoom(null);
    try {
        const db = await connect();
        await db.cancelPresence(`${roomPath(code)}/online/${role}`);
        if (role === 'host') await db.remove(roomPath(code));
        else {
            await db.remove(`${roomPath(code)}/online/${role}`);
            await db.update(`${roomPath(code)}/meta`, { guest: '', guestName: '', status: 'wait', t: db.now() });
        }
    } catch (e) { /* むし */ }
}
