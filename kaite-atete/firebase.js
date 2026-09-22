/* Firebase への つなぎ こみ
   ------------------------------------------------------------------
   ・読みこみは 後まわし（dynamic import）にしています。
     つうしんが できない 場所でも 画面と キーボードは 出るので、
     「まっしろで 何も 起きない」状態に なりません。
   ・サインインは 匿名です。名前も パスワードも ききません。
   ・だれかを あらわす ID（メンバーID）は タブごとに 作ります。
     こうすると 同じ 名前の子が 何人 いても ぶつからず、
     先生が 1台で いくつも タブを 開いて ためすことも できます。
   ------------------------------------------------------------------ */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
const SIGNIN_TIMEOUT = 20000;   // サインインを これ以上 待たない（ミリ秒）

let connecting = null;

/** Firebase に つなぎます。2回目からは 1回目の 結果を 返します。 */
export function connect() {
    if (!connecting) connecting = openConnection();
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
        throw new Error('つうしんの じゅんびが できませんでした（ネットに つながっているか かくにんしてください）');
    }

    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);

    /* スマホの 一部の ブラウザでは サインインの 返事が こないまま
       止まることが あります。待ちすぎないように 時間を 区切ります。 */
    await Promise.race([
        authMod.signInAnonymously(auth),
        new Promise((_, reject) => setTimeout(
            () => reject(new Error('サインインに 時間が かかりすぎました')), SIGNIN_TIMEOUT))
    ]).catch(() => {
        throw new Error('サインインが できませんでした（Firebase の「匿名」ログインが 有効か かくにんしてください）');
    });

    return { db: dbMod.getDatabase(app), fb: dbMod };
}

/* ── このタブを あらわす ID ────────────────────── */

export function myMemberId() {
    let id = readStore('ka_member');
    if (!id) {
        id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        writeStore('ka_member', id);
    }
    return id;
}

/* sessionStorage は タブごとに 別なので、同じ ブラウザの 別タブは 別の人に なります。
   つかえない 設定の ブラウザでも 落ちないように、読み書きは 包んでおきます。 */
const memory = {};
export function readStore(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return memory[key] || null; }
}
export function writeStore(key, value) {
    memory[key] = value;
    try { sessionStorage.setItem(key, value); } catch (e) {}
}
export function clearStore(key) {
    delete memory[key];
    try { sessionStorage.removeItem(key); } catch (e) {}
}

/* ── 部屋 ──────────────────────────────────── */

/** だれの ものか わかりやすいように、参加した 順で 色を 配ります */
export const COLORS = [
    '#e8503a','#f0872a','#f2c12e','#6fbf4a','#2fa8a0','#3b86d4',
    '#7a6bd0','#d45ea0','#8a6a4a','#5a6b7a','#c0534f','#2f8f5b'
];

const ROOM_LIFETIME = 6 * 60 * 60 * 1000;   // 6時間 たった 部屋は つかいまわします

/** 4けたの あいている 部屋番号を とって、部屋を 作ります。 */
export async function createRoom(conn, hostId) {
    const { db, fb } = conn;
    for (let tries = 0; tries < 30; tries++) {
        const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const info = { createdAt: Date.now(), hostId, phase: 'waiting' };
        const result = await fb.runTransaction(fb.ref(db, `rooms/${code}/info`), current => {
            /* だれかが つかっている 番号は とばします（古い 部屋は つかいまわし）*/
            if (current && Date.now() - (current.createdAt || 0) < ROOM_LIFETIME) return;
            return info;
        });
        if (result.committed) {
            await fb.remove(fb.ref(db, `rooms/${code}/members`));   // 前の 部屋の のこりを 消す
            return code;
        }
    }
    throw new Error('あいている 部屋番号が 見つかりませんでした。もう一度 おしてください');
}

/** 部屋が あるか しらべます（なければ null）。 */
export async function findRoom(conn, code) {
    const { db, fb } = conn;
    const snap = await fb.get(fb.ref(db, `rooms/${code}/info`));
    return snap.exists() ? snap.val() : null;
}

/** 部屋に 自分を 入れます。もう 席が あれば その席に 入りなおします。 */
export async function enterRoom(conn, code, memberId, name, isHost) {
    const { db, fb } = conn;
    const meRef = fb.ref(db, `rooms/${code}/members/${memberId}`);

    const already = await fb.get(meRef);
    let color;
    if (already.exists() && already.val().color) {
        color = already.val().color;
    } else {
        const all = await fb.get(fb.ref(db, `rooms/${code}/members`));
        const used = new Set(Object.values(all.val() || {}).map(m => m.color));
        color = COLORS.find(c => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    await fb.set(meRef, {
        name,
        color,
        isHost: !!isHost,
        online: true,
        joinedAt: already.exists() ? already.val().joinedAt : Date.now()
    });

    /* つうしんが 切れたら「いない」印を つけます（席は のこします）*/
    fb.onDisconnect(fb.ref(db, `rooms/${code}/members/${memberId}/online`)).set(false);
    return color;
}

/** 部屋の 人たちを 見はります。変わるたびに cb が よばれます。 */
export function watchMembers(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/members`), snap => {
        const raw = snap.val() || {};
        const list = Object.entries(raw)
            .map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        cb(list);
    });
}

/** 自分の 席を かたづけて 部屋を 出ます。 */
export async function leaveRoom(conn, code, memberId) {
    const { db, fb } = conn;
    await fb.remove(fb.ref(db, `rooms/${code}/members/${memberId}`));
}
