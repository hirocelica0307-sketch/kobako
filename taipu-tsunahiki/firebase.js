/* Firebase への つなぎ こみ
   ------------------------------------------------------------------
   「かいて あてて」と 同じ Firebase を つかいますが、
   しまう 場所は tsuna/（へやばんごう） です（rooms/ とは 別なので ぶつかりません）。

   ・読みこみは 後まわし（dynamic import）。つうしんが できない 場所でも 画面は 出ます。
   ・サインインは 匿名です。
   ・だれかを あらわす ID（メンバーID）は タブごとに 作ります。
   ・時こくは ぜんぶ「サーバーの 時計」で そろえます。
     タブレットごとに 時計が ずれていても、2人の よーい・どん が そろいます。
   ------------------------------------------------------------------ */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.6.1/';
const SIGNIN_TIMEOUT = 20000;   // サインインを これ以上 待たない（ミリ秒）
const ROOT = 'tsuna';

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

    await Promise.race([
        authMod.signInAnonymously(auth),
        new Promise((_, reject) => setTimeout(
            () => reject(new Error('サインインに 時間が かかりすぎました')), SIGNIN_TIMEOUT))
    ]).catch(() => {
        throw new Error('サインインが できませんでした（Firebase の「匿名」ログインが 有効か かくにんしてください）');
    });

    const conn = { db: dbMod.getDatabase(app), fb: dbMod, offset: 0 };

    /* サーバーの 時計との ずれを おぼえておきます */
    dbMod.onValue(dbMod.ref(conn.db, '.info/serverTimeOffset'), snap => {
        conn.offset = Number(snap.val()) || 0;
    });
    return conn;
}

/** サーバーの 時計で いまの 時こく */
export const serverNow = conn => Date.now() + ((conn && conn.offset) || 0);

const path = (code, rest) => `${ROOT}/${code}` + (rest ? '/' + rest : '');

/* ── このタブを あらわす ID ────────────────────── */

export function myMemberId() {
    let id = readStore('tt_member');
    if (!id) {
        id = 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        writeStore('tt_member', id);
    }
    return id;
}

/* sessionStorage は タブごとに 別なので、同じ ブラウザの 別タブは 別の人に なります。 */
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

export const COLORS = [
    '#e8503a','#3b86d4','#f0872a','#2fa8a0','#d45ea0','#6fbf4a',
    '#7a6bd0','#f2c12e','#8a6a4a','#5a6b7a','#c0534f','#2f8f5b'
];

const ROOM_LIFETIME = 6 * 60 * 60 * 1000;   // 6時間 たった 部屋は つかいまわします

/** 4けたの あいている 部屋番号を とって、部屋を 作ります。 */
export async function createRoom(conn, hostId) {
    const { db, fb } = conn;
    for (let tries = 0; tries < 30; tries++) {
        const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const info = { createdAt: serverNow(conn), hostId, phase: 'waiting' };
        const result = await fb.runTransaction(fb.ref(db, path(code, 'info')), current => {
            if (current && serverNow(conn) - (current.createdAt || 0) < ROOM_LIFETIME) return;
            return info;
        });
        if (result.committed) {
            /* 前の 部屋の のこりを 消します */
            await fb.update(fb.ref(db, path(code)), {
                members: null, settings: null, matches: null, prog: null
            });
            return code;
        }
    }
    throw new Error('あいている 部屋番号が 見つかりませんでした。もう一度 おしてください');
}

/** 部屋が あるか しらべます（なければ null）。 */
export async function findRoom(conn, code) {
    const { db, fb } = conn;
    const snap = await fb.get(fb.ref(db, path(code, 'info')));
    return snap.exists() ? snap.val() : null;
}

/**
 * 部屋に 自分を 入れます。
 * もう 席が あれば、たいせんの とちゅう（state・match）や かち数は そのまま のこします
 * （まちがえて 画面を 開きなおしても、つづきから できる ように）。
 */
export async function enterRoom(conn, code, memberId, name, isHost) {
    const { db, fb } = conn;
    const meRef = fb.ref(db, path(code, `members/${memberId}`));
    const already = await fb.get(meRef);
    const old = already.exists() ? already.val() : null;

    let color = old && old.color;
    if (!color) {
        const all = await fb.get(fb.ref(db, path(code, 'members')));
        const used = new Set(Object.values(all.val() || {}).map(m => m.color));
        color = COLORS.find(c => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    const patch = { name, color, isHost: !!isHost, online: true };
    if (!old) Object.assign(patch, {
        joinedAt: serverNow(conn),
        state: 'wait',          // wait（まっている）／play（たいせん中）／rest（やすみ）／admin（かんり）
        since: serverNow(conn), // まちはじめた 時こく
        wins: 0, games: 0
    });
    await fb.update(meRef, patch);

    /* つうしんが 切れたら「いない」印を つけます（席は のこします）*/
    fb.onDisconnect(fb.ref(db, path(code, `members/${memberId}/online`))).set(false);
    return color;
}

/** 部屋の 人たちを 見はります。 */
export function watchMembers(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, 'members')), snap => {
        const raw = snap.val() || {};
        const list = Object.entries(raw)
            .map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        cb(list);
    });
}

/** 自分の 席の 一部を 書きかえます（まつ・やすむ など）。 */
export function updateMe(conn, code, memberId, patch) {
    const { db, fb } = conn;
    return fb.update(fb.ref(db, path(code, `members/${memberId}`)), patch);
}

/** かち数・たいせん数を 1つ ふやします。 */
export async function addRecord(conn, code, memberId, won) {
    const { db, fb } = conn;
    const bump = n => (n || 0) + 1;
    await fb.runTransaction(fb.ref(db, path(code, `members/${memberId}/games`)), bump);
    if (won) await fb.runTransaction(fb.ref(db, path(code, `members/${memberId}/wins`)), bump);
}

/** 自分の 席を かたづけて 部屋を 出ます。 */
export async function leaveRoom(conn, code, memberId) {
    const { db, fb } = conn;
    await fb.remove(fb.ref(db, path(code, `members/${memberId}`)));
}

/* ── 場面と せってい ──────────────────────────
   phase … 'waiting'（あつまる）／'open'（たいせん できる）
   ぬしが「はじめる」を おすと open に なり、2人 そろった 組から はじまります。
   ------------------------------------------------------------------ */

export function watchInfo(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, 'info')), snap => cb(snap.val() || {}));
}

export function setPhase(conn, code, phase) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, path(code, 'info/phase')), phase);
}

export function watchSettings(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, 'settings')), snap => cb(snap.val() || null));
}

export function saveSettings(conn, code, settings) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, path(code, 'settings')), settings);
}

/* ── たいせん ────────────────────────────────
   matches/{たいせんID} … だれと だれか・ことばの たね・はじまる 時こく・かった人
   prog/{たいせんID}/{メンバーID} … いま どこまで 打ったか（1キー ごとに 上書き）
       n    打ちおわった かなの 数（つなを 引っぱった 数）
       w    いま 何こめの ことばか
       k    その ことばの 何文字めまで 打ったか
       buf  打っている とちゅうの ローマ字（ky など）
       miss まちがえた キーの 数
       keys あっていた キーの 数
   ------------------------------------------------------------------ */

/**
 * 2人を 組にして たいせんを 作ります。
 * たいせんの 中身と、2人の「たいせん中」の しるしを 1回で 書きこみます。
 */
export async function createMatch(conn, code, match) {
    const { db, fb } = conn;
    const mid = fb.push(fb.ref(db, path(code, 'matches'))).key;
    await fb.update(fb.ref(db, path(code)), {
        [`matches/${mid}`]: match,
        [`members/${match.a}/state`]: 'play',
        [`members/${match.a}/match`]: mid,
        [`members/${match.b}/state`]: 'play',
        [`members/${match.b}/match`]: mid
    });
    return mid;
}

export function watchMatch(conn, code, mid, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, `matches/${mid}`)), snap => cb(snap.val()));
}

/** ぜんぶの たいせんを 見はります（ぬしの「みんなの ようす」）。 */
export function watchMatches(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, 'matches')), snap => cb(snap.val() || {}));
}

export function sendProg(conn, code, mid, memberId, prog) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, path(code, `prog/${mid}/${memberId}`)), prog);
}

export function watchProg(conn, code, mid, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, `prog/${mid}`)), snap => cb(snap.val() || {}));
}

/** ぜんぶの たいせんの すすみぐあい（ぬしだけが 見ます）。 */
export function watchAllProg(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, path(code, 'prog')), snap => cb(snap.val() || {}));
}

/**
 * かちまけを きめます。さきに 書いた ほうが 勝ちです（あとから 書いても かわりません）。
 * @param decide いまの たいせんを うけとって {winner, reason} を 返す。まだ きめない ときは null
 */
export async function settleMatch(conn, code, mid, decide) {
    const { db, fb } = conn;
    const res = await fb.runTransaction(fb.ref(db, path(code, `matches/${mid}`)), cur => {
        /* 手もとに まだ 読みこんでいない ときは、そのまま 返して サーバーに たしかめて もらいます */
        if (!cur) return cur;
        if (cur.winner) return;               // もう きまっている
        const d = decide(cur);
        if (!d) return;
        return { ...cur, winner: d.winner, reason: d.reason, done: true, endedAt: serverNow(conn) };
    });
    return res.committed;
}
