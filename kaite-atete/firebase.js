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

/* ── おえかき ──────────────────────────────────
   線（ストローク）の やりとりです。
   ・かいている とちゅう … rooms/{code}/live/{メンバーID}
       すこしずつ 上書きします。見ている人は 線が のびていくのが わかります。
   ・かき おわった線  … rooms/{code}/strokes/{線のID}
       ふでを はなした ときに ここへ うつします。
   点は 0〜1000 の 整数で もちます。画面の 大きさが ちがっても
   同じ かたちに なるようにするためです。
   ------------------------------------------------------------------ */

/** かいている とちゅうの 線を 送ります（とちゅう経過）。 */
export function sendLive(conn, code, memberId, stroke) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/live/${memberId}`), stroke);
}

/** とちゅう経過を 消します。 */
export function clearLive(conn, code, memberId) {
    const { db, fb } = conn;
    return fb.remove(fb.ref(db, `rooms/${code}/live/${memberId}`));
}

/** かき おわった線を くわえます。線の ID を 返します。 */
export async function commitStroke(conn, code, stroke) {
    const { db, fb } = conn;
    const ref = await fb.push(fb.ref(db, `rooms/${code}/strokes`), stroke);
    return ref.key;
}

/** 線を 1本 消します（もどす）。 */
export function removeStroke(conn, code, strokeId) {
    const { db, fb } = conn;
    return fb.remove(fb.ref(db, `rooms/${code}/strokes/${strokeId}`));
}

/** ぜんぶ 消します。 */
export async function clearBoard(conn, code) {
    const { db, fb } = conn;
    await fb.remove(fb.ref(db, `rooms/${code}/strokes`));
    await fb.remove(fb.ref(db, `rooms/${code}/live`));
}

/** つうしんが 切れたら、自分の とちゅう経過を 消す よやくを します。 */
export function clearLiveOnDisconnect(conn, code, memberId) {
    const { db, fb } = conn;
    fb.onDisconnect(fb.ref(db, `rooms/${code}/live/${memberId}`)).remove();
}

/**
 * かき おわった線を 見はります。
 * すでに ある線も さいしょに ぜんぶ とどきます（あとから 入った人も 同じ絵に なります）。
 */
export function watchStrokes(conn, code, onAdd, onRemove) {
    const { db, fb } = conn;
    const ref = fb.ref(db, `rooms/${code}/strokes`);
    fb.onChildAdded(ref, snap => onAdd(snap.key, snap.val()));
    fb.onChildRemoved(ref, snap => onRemove(snap.key));
}

/** かいている とちゅうの 線を 見はります。 */
export function watchLive(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/live`), snap => cb(snap.val() || {}));
}

/* ── 部屋の 場面（あつまる／おえかき）──────────────
   へやの ぬしが「はじめる」を おすと、みんなの 画面が いっせいに 変わります。
   ------------------------------------------------------------------ */

/** いまの 場面を 見はります。 */
export function watchInfo(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/info`), snap => cb(snap.val() || {}));
}

/** 場面を かえます（'waiting' ＝ あつまる ／ 'playing' ＝ おえかき）。 */
export function setPhase(conn, code, phase) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/info/phase`), phase);
}

/* ── おだい（ラウンド）──────────────────────────
   おだいの ことばは そのまま 入れません。数字に かえた もの（hash）だけを
   おきます。こうすると、こたえる人の 画面から ことばが 見えません。
   ことばは かく人の タブだけが おぼえていて、おわりに みんなへ 見せます。
   ------------------------------------------------------------------ */

/** つぎの 人の 番に します。ことばは まだ きまっていません
    （かく人の タブが じぶんで えらんで、そのあと armRound で 入れます）。 */
export function setupRound(conn, code, drawer, level) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/round`), {
        drawer, level,
        setupAt: Date.now(),          /* かく人が おだいを 出さないまま 止まるのを 見つける ため */
        hash: null, startedAt: null, endsAt: null,
        answered: null, word: null, done: false
    });
}

/** かく人の タブが、えらんだ ことばの hash と 時間を 入れます。
    near は「おしい」ことばの hash です（odai.js の nearHashes）。
    ヒントは はじめ「○○○」（文字の 数）だけ 出します。 */
export function armRound(conn, code, hash, seconds, near, hint) {
    const { db, fb } = conn;
    const now = Date.now();
    return fb.update(fb.ref(db, `rooms/${code}/round`), {
        hash, startedAt: now, endsAt: now + seconds * 1000,
        near: near || null, hint: hint || null, reacts: null, misses: null,
        answered: null        /* おだいを かえた ときは、まえの ことばの せいかいを のこしません */
    });
}

/** この 回を おわりに します（こたえを みんなに 見せます）。 */
export function finishRound(conn, code, word) {
    const { db, fb } = conn;
    return fb.update(fb.ref(db, `rooms/${code}/round`), { word: word || null, done: true });
}

/** いまの おだいを 見はります。 */
export function watchRound(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/round`), snap => cb(snap.val()));
}

/** せいかいした 人を しるします（はやい 順に ならべられるよう 時こくで）。 */
export function markAnswered(conn, code, memberId) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/round/answered/${memberId}`), Date.now());
}

/** おだいの ことばを みんなに 見せます（おわった とき）。 */
export function revealWord(conn, code, word) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/round/word`), word);
}

/* ── ゲーム（じゅんばんと とくてん）───────────────
   だれが どの 順で かくかを きめ、とくてんを ためます。
   ------------------------------------------------------------------ */

/** ゲームを はじめます（あそびかた・じゅんばん・とくてんの リセット）。 */
export async function startGame(conn, code, game) {
    const { db, fb } = conn;
    await fb.set(fb.ref(db, `rooms/${code}/game`), {
        mode: game.mode,
        order: game.order,
        admin: game.admin || null,        /* かんりする ぬし（あそぶ ときは なし）*/
        teams: game.teams || null,        /* チームせん … { メンバーID: 'red'／'blue' } */
        steps: game.steps || null,        /* でんごん … 何だん あそぶか */
        step: game.mode === 'tel' ? 0 : null,
        stepEndsAt: game.stepEndsAt || null,
        laps: game.laps || null,
        seconds: game.seconds,
        endsAt: game.endsAt || null,
        turn: 0,
        startedAt: Date.now()
    });
    await fb.remove(fb.ref(db, `rooms/${code}/scores`));
    await fb.remove(fb.ref(db, `rooms/${code}/round`));      /* まえの ゲームの のこり */
    await fb.remove(fb.ref(db, `rooms/${code}/teamScores`));
    await fb.remove(fb.ref(db, `rooms/${code}/gallery`));
    await fb.remove(fb.ref(db, `rooms/${code}/tel`));
    await fb.remove(fb.ref(db, `rooms/${code}/telDone`));
}

/** ランダムの ときは、つぎの かく人を そのつど 入れかえます。 */
export function setGameTurn(conn, code, turn) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/game/turn`), turn);
}

/** いまの じゅんばんを 見はります。 */
export function watchGame(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/game`), snap => cb(snap.val()));
}

/** つぎの 番に すすめます。 */
export function setTurn(conn, code, turn) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/game/turn`), turn);
}

/** とくてんを 見はります。 */
export function watchScores(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/scores`), snap => cb(snap.val() || {}));
}

/** とくてんを たします。{メンバーID: たす数} を わたします。 */
export async function addScores(conn, code, deltas) {
    const { db, fb } = conn;
    const ref = fb.ref(db, `rooms/${code}/scores`);
    const snap = await fb.get(ref);
    const now = snap.val() || {};
    const next = { ...now };
    for (const [id, add] of Object.entries(deltas)) next[id] = (now[id] || 0) + add;
    return fb.set(ref, next);
}

/* チームせんの てんすう（teamScores/red・blue）*/
export function addTeamScore(conn, code, team, add) {
    const { db, fb } = conn;
    return fb.runTransaction(fb.ref(db, `rooms/${code}/teamScores/${team}`), n => (n || 0) + add);
}
export function watchTeamScores(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/teamScores`), snap => cb(snap.val() || {}));
}

/* ── ぬし（先生）の そうさ ──────────────────────
   ボタンは ぜんぶ ぬしが おします。ぬしは おだいの ことばを
   知らないので、「かえて」と たのむ しるしだけ おいて、
   かく人の タブに えらびなおして もらいます。
   ------------------------------------------------------------------ */

/** いまの かいの 一部だけを 書きかえます。 */
export function updateRound(conn, code, patch) {
    const { db, fb } = conn;
    return fb.update(fb.ref(db, `rooms/${code}/round`), patch);
}

/** ゲームの 一部だけを 書きかえます。 */
export function updateGame(conn, code, patch) {
    const { db, fb } = conn;
    return fb.update(fb.ref(db, `rooms/${code}/game`), patch);
}

/** まちがえた 回数を 1つ ふやします（先生が「だれが こまっているか」を 見る ため）。 */
export function bumpMiss(conn, code, memberId) {
    const { db, fb } = conn;
    return fb.runTransaction(
        fb.ref(db, `rooms/${code}/round/misses/${memberId}`),
        n => (n || 0) + 1
    );
}

/* ── リアクション ───────────────────────────────
   絵を 見ている 人が 👍 などを おくります。みんなの 絵の 上に うかびます。
   その かいの 中に ためるので、つぎの かいに なると 消えます。 */
export function sendReact(conn, code, memberId, emoji) {
    const { db, fb } = conn;
    return Promise.resolve(fb.push(fb.ref(db, `rooms/${code}/round/reacts`), { by: memberId, e: emoji, at: Date.now() }));
}

/* ── ギャラリー ────────────────────────────────
   1かい おわるごとに、ぬしの タブが 絵を 小さな 画像に して のこします。
   けっか はっぴょうで みんなの 絵を ならべて 見せます。
   gallery/{なんかいめ} … drawer（かいた人）／word（おだい）／img（画像）／reacts（{👍:3}）／team */
export function saveGallery(conn, code, key, entry) {
    const { db, fb } = conn;
    return fb.set(fb.ref(db, `rooms/${code}/gallery/${key}`), entry);
}
export async function loadGallery(conn, code) {
    const { db, fb } = conn;
    const snap = await fb.get(fb.ref(db, `rooms/${code}/gallery`));
    return snap.val() || {};
}

/* ── おえかき でんごん ─────────────────────────
   tel/{すじ}/word          … はじめの おだい
   tel/{すじ}/steps/{だん}   … { by: かいた人, img: 絵 } か { by, text: ことば }
   telDone/{だん}/{メンバーID} … できた しるし（小さいので、ぬしが これだけ 見はります）
   画像は 大きいので、ひつような ものだけ get で とりに いきます。 */
export function setTelWords(conn, code, words) {
    const { db, fb } = conn;
    const tel = {};
    for (const [c, word] of Object.entries(words)) tel[c] = { word };
    return fb.set(fb.ref(db, `rooms/${code}/tel`), tel);
}
export async function getTel(conn, code, path) {
    const { db, fb } = conn;
    return (await fb.get(fb.ref(db, `rooms/${code}/tel/${path}`))).val();
}
export async function submitTel(conn, code, chain, step, memberId, entry) {
    const { db, fb } = conn;
    await fb.set(fb.ref(db, `rooms/${code}/tel/${chain}/steps/${step}`), { by: memberId, ...entry });
    await fb.set(fb.ref(db, `rooms/${code}/telDone/${step}/${memberId}`), true);
}
export function watchTelDone(conn, code, cb) {
    const { db, fb } = conn;
    return fb.onValue(fb.ref(db, `rooms/${code}/telDone`), snap => cb(snap.val() || {}));
}
export async function loadTel(conn, code) {
    const { db, fb } = conn;
    return (await fb.get(fb.ref(db, `rooms/${code}/tel`))).val() || {};
}
