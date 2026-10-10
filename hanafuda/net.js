/* 友だちとの 対戦の つうしん
   ------------------------------------------------------------------
   ホストが 部屋を つくると 4けたの 番号が でます。もう1人は その 番号で 入ります。
   「かいて あてて」と 同じ Firebase（Realtime Database）を つかい、
   しまう 場所は hanafuda/rooms/{番号}/ です。

   hanafuda/rooms/{番号}/
     meta            部屋の じょうほう（ホスト・ゲスト・ルール・種・何回めの 対局か）
     online/{役わり} いま つながっているか（host / guest）
     log/{n}/{0000}  n 回めの 対局の 手の ならび（1手ずつ、上書き できない）

   対局は「手の ならび」だけを おくりあい、おたがいの 端末で
   同じ ルールエンジン（rules.js）を うごかします。

   URL に ?fake を つけると、Firebase の かわりに この ブラウザの 中だけで
   うごく にせものを つかいます（タブを 2つ ひらいて ためす ため）。
   ------------------------------------------------------------------ */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
const ROOT = 'hanafuda/rooms';
export const ROOM_STALE = 3 * 60 * 60 * 1000;   // 3時間 つかわれて いない 部屋は 番号を つかいまわす

/* ── このタブの ID ─────────────────────────── */

const mem = {};
function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] || null; } }
function sset(k, v) { mem[k] = v; try { sessionStorage.setItem(k, v); } catch (e) { /* むし */ } }
function sdel(k) { delete mem[k]; try { sessionStorage.removeItem(k); } catch (e) { /* むし */ } }

export function memberId() {
    let id = sget('hf_member');
    if (!id) {
        id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        sset('hf_member', id);
    }
    return id;
}
export const savedRoom = () => { try { return JSON.parse(sget('hf_room') || 'null'); } catch (e) { return null; } };
export const saveRoom = v => v ? sset('hf_room', JSON.stringify(v)) : sdel('hf_room');

/* ── つなぎかた（本物 / にせもの） ───────────── */

const useFake = /[?&]fake\b/.test(location.search);
let backend = null;

export function connect() {
    if (!backend) backend = (useFake ? fakeBackend() : firebaseBackend()).catch(e => { backend = null; throw e; });
    return backend;
}

async function firebaseBackend() {
    let appMod, authMod, dbMod;
    try {
        [appMod, authMod, dbMod] = await Promise.all([
            import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')
        ]);
    } catch (e) {
        throw new Error('つうしんの じゅんびが できませんでした（ネットに つながっているか たしかめてください）');
    }
    const app = appMod.initializeApp(FIREBASE_CONFIG, 'hanafuda');
    const auth = authMod.getAuth(app);
    await Promise.race([
        authMod.signInAnonymously(auth),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
    ]).catch(() => { throw new Error('サインインが できませんでした。しばらく してから もう一度 ためしてください'); });
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
    const KEY = 'hanafuda.fakedb';
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
    const lag = () => new Promise(res => setTimeout(res, 30 + Math.random() * 60));
    const presenceKeys = [];
    window.addEventListener('pagehide', () => write(t => presenceKeys.forEach(p => setAt(t, p, null))));
    return {
        now: () => Date.now(),
        async get(p) { await lag(); return getAt(readAll(), p) ?? null; },
        async set(p, v) { await lag(); write(t => setAt(t, p, v)); },
        async update(p, v) { await lag(); write(t => { for (const [k, x] of Object.entries(v)) setAt(t, p + '/' + k, x); }); },
        async remove(p) { await lag(); write(t => setAt(t, p, null)); },
        async transact(p, fn) {
            await lag();
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
            const seen = new Set();
            const f = () => {
                const v = getAt(readAll(), p) || {};
                for (const k of Object.keys(v).sort()) if (!seen.has(k)) { seen.add(k); cb(k, v[k]); }
            };
            listeners.add(f);
            setTimeout(f, 10);
            return () => listeners.delete(f);
        },
        async presence(p) { presenceKeys.push(p); await this.set(p, true); },
        async cancelPresence(p) { /* むし */ }
    };
}

/* ── 部屋 ──────────────────────────────────── */

const roomPath = code => `${ROOT}/${code}`;

/** 部屋を つくって 番号を かえします */
export async function createRoom(name, rules) {
    const db = await connect();
    const me = memberId();
    for (let attempt = 0; attempt < 12; attempt++) {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        const old = await db.get(`${roomPath(code)}/meta`);
        if (old && db.now() - (old.t || 0) < ROOM_STALE) continue;
        if (old) await db.remove(roomPath(code)).catch(() => {});
        const res = await db.transact(`${roomPath(code)}/meta`, cur => {
            if (cur && db.now() - (cur.t || 0) < ROOM_STALE) return undefined;
            return { host: me, hostName: name, guest: '', guestName: '', t: db.now(), rules, status: 'wait', game: 0, seed: '' };
        });
        if (res.committed) {
            await db.presence(`${roomPath(code)}/online/host`);
            saveRoom({ code, role: 'host' });
            return code;
        }
    }
    throw new Error('部屋が つくれませんでした。もう一度 ためしてください');
}

/** 番号の 部屋に 入ります */
export async function joinRoom(code, name) {
    const db = await connect();
    const me = memberId();
    let why = '';
    const res = await db.transact(`${roomPath(code)}/meta`, cur => {
        if (!cur) { why = 'その 番号の 部屋は ありません'; return undefined; }
        if (db.now() - (cur.t || 0) > ROOM_STALE) { why = 'その 部屋は もう おわっています'; return undefined; }
        if (cur.host === me) { why = 'じぶんの 部屋には 入れません'; return undefined; }
        if (cur.guest && cur.guest !== me) { why = 'その 部屋は もう いっぱいです'; return undefined; }
        return { ...cur, guest: me, guestName: name, t: db.now() };
    });
    if (!res.committed) throw new Error(why || '部屋に 入れませんでした');
    await db.presence(`${roomPath(code)}/online/guest`);
    saveRoom({ code, role: 'guest' });
    return res.value;
}

/** もどってきた とき（ページを 読みなおした ときなど）に また 入りなおす */
export async function rejoin(code, role) {
    const db = await connect();
    const meta = await db.get(`${roomPath(code)}/meta`);
    const me = memberId();
    if (!meta || meta[role] !== me) throw new Error('部屋に もどれませんでした');
    await db.presence(`${roomPath(code)}/online/${role}`);
    return meta;
}

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

/** 対局を はじめる（ホストだけ） */
export async function startMatch(code, game) {
    const seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await updateMeta(code, { status: 'play', game, seed });
    return seed;
}

export async function watchLog(code, game, cb) {
    const db = await connect();
    return db.watchChildren(`${roomPath(code)}/log/${game}`, (k, v) => cb(Number(k), v));
}

/** idx ばんめの 手を 書きます。もう だれかが 書いていたら false */
export async function pushMove(code, game, idx, action) {
    const db = await connect();
    const key = String(idx).padStart(4, '0');
    try {
        const res = await db.transact(`${roomPath(code)}/log/${game}/${key}`, cur => (cur === null ? action : undefined));
        return res.committed;
    } catch (e) {
        return false;
    }
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
            await db.update(`${roomPath(code)}/meta`, { left: 'guest', t: db.now() });
        }
    } catch (e) { /* むし */ }
}
