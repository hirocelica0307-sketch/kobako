/* Firebase への つなぎ こみ
   ------------------------------------------------------------------
   「かいて あてて」と 同じ Firebase を つかい、しまう 場所は tsunahiki/ です。
   へやばんごうは ありません。「たいせん あいてを さがす」を おした 子は
   みんな 1つの ならび（lobby/queue）に ならび、そこから 2人ずつ 組に なります。

   tsunahiki/
     lobby/queue/{ID}   さがしている 子（name・t＝さいごに 生きている しるしを 出した 時こく）
     lobby/assign/{ID}  「あなたの あいてが きまったよ」の しらせ（mid・t）
     matches/{mid}      たいせん 1つぶん
     prog/{mid}/{ID}    どこまで 打ったか

   ・読みこみは 後まわし（dynamic import）。つうしんが できなくても 画面は 出ます
     （コンピューターとの たいせんは つうしん なしで できます）。
   ・サインインは 匿名です。
   ・時こくは ぜんぶ「サーバーの 時計」で そろえます。
   ------------------------------------------------------------------ */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
const SIGNIN_TIMEOUT = 20000;
const ROOT = 'tsunahiki';
export const QUEUE_ALIVE = 15000;     // これより 古い「生きている しるし」の 子は いない ものと します
const ASSIGN_ALIVE = 60000;

let connecting = null;

/** Firebase に つなぎます。しっぱい したら、つぎに よばれた とき やりなおします。 */
export function connect() {
    if (!connecting) connecting = openConnection().catch(e => { connecting = null; throw e; });
    return connecting;
}

async function openConnection() {
    let appMod, authMod, dbMod;
    try {
        [appMod, authMod, dbMod] = await Promise.all([
            import(SDK + 'firebase-app.js'),
            import(SDK + 'firebase-auth.js'),
            import(SDK + 'firebase-database.js')
        ]);
    } catch (e) {
        throw new Error('つうしんの じゅんびが できませんでした（ネットに つながっているか かくにんしてね）');
    }
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    await Promise.race([
        authMod.signInAnonymously(auth),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), SIGNIN_TIMEOUT))
    ]).catch(() => {
        throw new Error('サインインが できませんでした（Firebase の「匿名」ログインが 有効か かくにんしてください）');
    });
    const conn = { db: dbMod.getDatabase(app), fb: dbMod, offset: 0 };
    dbMod.onValue(dbMod.ref(conn.db, '.info/serverTimeOffset'), snap => {
        conn.offset = Number(snap.val()) || 0;
    });
    return conn;
}

/** サーバーの 時計で いまの 時こく */
export const serverNow = conn => Date.now() + ((conn && conn.offset) || 0);

const at = (conn, p) => conn.fb.ref(conn.db, `${ROOT}/${p}`);

/* ── このタブを あらわす ID と、おぼえておく もの ─────────── */

/* ID は タブごと（sessionStorage）。先生が 1台で タブを 2つ 開いて ためせます */
export function myMemberId() {
    let id = readStore('tt_member');
    if (!id) {
        id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        writeStore('tt_member', id);
    }
    return id;
}
const memory = {};
export function readStore(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return memory[key] || null; }
}
export function writeStore(key, value) {
    memory[key] = value;
    try { sessionStorage.setItem(key, value); } catch (e) {}
}
/* なまえ・せいせき は 端末に のこします（つぎの 日も そのまま つかえる ように）*/
export function readLocal(key) {
    try { return localStorage.getItem(key); } catch (e) { return memory['L' + key] || null; }
}
export function writeLocal(key, value) {
    memory['L' + key] = value;
    try { localStorage.setItem(key, value); } catch (e) {}
}

/* ── あいてを さがす ──────────────────────────── */

/**
 * さがしている 子の ならびを 見て、だれか いれば その子と 組みます。
 * だれも いなければ、じぶんが ならびます。
 * ならびの 読みと 書きを 1回の トランザクションで するので、
 * 同じ 子が 2人に とられる ことは ありません。
 * @returns {Promise<{mid:string, foe:string, foeName:string}|null>} 組めたら その たいせん、ならんだら null
 */
export async function findOrQueue(conn, myId, name, lastFoe) {
    const { fb } = conn;
    const mid = fb.push(at(conn, 'matches')).key;
    let decided = null;
    const res = await fb.runTransaction(at(conn, 'lobby'), lobby => {
        lobby = lobby || {};
        const t = serverNow(conn);
        const queue = { ...(lobby.queue || {}) };
        const assign = { ...(lobby.assign || {}) };
        /* もう いない 子・古い しらせ を かたづけます */
        for (const [id, q] of Object.entries(queue)) {
            if (!q || !q.name || t - (q.t || 0) > QUEUE_ALIVE) delete queue[id];
        }
        for (const [id, a] of Object.entries(assign)) {
            if (!a || t - (a.t || 0) > ASSIGN_ALIVE) delete assign[id];
        }
        delete queue[myId];
        delete assign[myId];

        const others = Object.keys(queue);
        /* さっきの あいては、ほかに だれも いない ときだけ */
        const fresh = others.filter(id => id !== lastFoe);
        const pool = fresh.length ? fresh : others;
        decided = null;
        if (pool.length) {
            const foe = pool[Math.floor(Math.random() * pool.length)];
            decided = { mid, foe, foeName: queue[foe].name };
            delete queue[foe];
            assign[foe] = { mid, t };
        } else {
            queue[myId] = { name, t };
        }
        return { queue, assign };
    });
    if (!res.committed) throw new Error('うまく さがせませんでした。もう一度 おしてね');
    if (!decided) {
        /* ならんだ まま タブを とじたら、ならびから 消えます */
        fb.onDisconnect(at(conn, `lobby/queue/${myId}`)).remove();
    }
    return decided;
}

/** ならんでいる あいだ「まだ いるよ」の しるしを 出します（もう ならびに いなければ 何も しません）*/
export function heartbeat(conn, myId) {
    const { fb } = conn;
    return fb.runTransaction(at(conn, `lobby/queue/${myId}`), cur => {
        if (!cur) return;                       // もう 組まれた（ならびから 消えた）
        return { ...cur, t: serverNow(conn) };
    }).catch(() => {});
}

/** 「あいてが きまったよ」の しらせを まちます。 */
export function watchAssign(conn, myId, cb) {
    return conn.fb.onValue(at(conn, `lobby/assign/${myId}`), snap => cb(snap.val()));
}

/** さがすのを やめます（ならびと しらせを 消します）。 */
export async function leaveQueue(conn, myId) {
    const { fb } = conn;
    await fb.update(at(conn, 'lobby'), { [`queue/${myId}`]: null, [`assign/${myId}`]: null });
}

/* ── たいせん ────────────────────────────────
   matches/{mid}
     a／b・na／nb       2人の ID と なまえ（a が ならんで いた 子）
     createdAt           組んだ 時こく
     here/{ID}           画面に きている しるし（タブを とじると 消えます）
     choice/{ID}         えらんだ むずかしさ（1〜5）
     janken              じゃんけんの てん（hands・winner・at）
     level／seed         じっさいの むずかしさ・ことばの たね
     startsAt／endsAt    はじまる・おわる 時こく
     winner／reason／done／endedAt   かちまけ
     cancel              あいてが こなかった などで とりやめ
     left/{ID}           けっかを 見おわって ぬけた しるし
   ------------------------------------------------------------------ */

/* set では なく update に します。あいてが 先に「きたよ」の しるし（here）を
   書いていても、消さない ように */
export function createMatch(conn, mid, data) {
    return conn.fb.update(at(conn, `matches/${mid}`), data);
}

export function watchMatch(conn, mid, cb) {
    return conn.fb.onValue(at(conn, `matches/${mid}`), snap => cb(snap.val()));
}

/** 画面に きている しるしを 出します（タブを とじたら 消えます）。 */
export async function markHere(conn, mid, myId) {
    const { fb } = conn;
    const r = at(conn, `matches/${mid}/here/${myId}`);
    await fb.set(r, true);
    fb.onDisconnect(r).remove();
}

export function chooseLevel(conn, mid, myId, n) {
    return conn.fb.set(at(conn, `matches/${mid}/choice/${myId}`), n);
}

/**
 * たいせんの 中身を 1回だけ 書きかえます（先に 書いた ほうが かち）。
 * @param change いまの たいせんを うけとって、書きかえる ところを 返す。書かない ときは null
 */
export async function changeMatchOnce(conn, mid, change) {
    const res = await conn.fb.runTransaction(at(conn, `matches/${mid}`), cur => {
        if (!cur) return cur;                   // 手もとに まだ ない ときは サーバーに たしかめて もらう
        const patch = change(cur);
        if (!patch) return;
        return { ...cur, ...patch };
    });
    return res.committed;
}

export function sendProg(conn, mid, myId, prog) {
    return conn.fb.set(at(conn, `prog/${mid}/${myId}`), prog);
}

export function watchProg(conn, mid, cb) {
    return conn.fb.onValue(at(conn, `prog/${mid}`), snap => cb(snap.val() || {}));
}

/**
 * たいせんから ぬけます。2人とも ぬけたら、たいせんの データを かたづけます。
 */
export async function leaveMatch(conn, mid, myId) {
    const { fb } = conn;
    const hereRef = at(conn, `matches/${mid}/here/${myId}`);
    try { await fb.onDisconnect(hereRef).cancel(); } catch (e) {}
    let gone = false;
    await fb.runTransaction(at(conn, `matches/${mid}`), cur => {
        if (!cur) return cur;
        const left = { ...(cur.left || {}), [myId]: true };
        const here = { ...(cur.here || {}) };
        delete here[myId];
        const other = cur.a === myId ? cur.b : cur.a;
        gone = !!left[other] || !here[other];
        return gone ? null : { ...cur, left, here };
    }).catch(() => {});
    if (gone) await fb.remove(at(conn, `prog/${mid}`)).catch(() => {});
}
