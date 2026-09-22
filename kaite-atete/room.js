/* おえかきの 画面
   いま 部屋に いる人を ならべ、みんなで 1まいの ばんに 絵を かきます。
   （だれが かくかの 順番や、お題・とくてんは このあとの 段階で つけます） */
import { connect, watchMembers, enterRoom, leaveRoom, myMemberId, readStore, clearStore,
         sendLive, clearLive, clearLiveOnDisconnect, commitStroke, removeStroke,
         clearBoard, watchStrokes, watchLive } from './firebase.js';
import { createBoard, ERASER } from './board.js';

const $ = id => document.getElementById(id);

const code = readStore('ka_room');
const myName = readStore('ka_name');
const isHost = readStore('ka_host') === '1';
const myId = myMemberId();

if (!code || !myName) location.replace('index.html');
$('code').textContent = code;
if (isHost) $('clear').classList.remove('hidden');

function say(text, bad) {
    const n = $('notice');
    n.textContent = text;
    n.className = 'notice ' + (bad ? 'bad' : 'wait');
}
const hideSay = () => { $('notice').className = 'notice wait hidden'; };

/* ── あつまった人 ─────────────────────────── */
function drawMembers(list) {
    const box = $('members');
    box.textContent = '';
    for (const m of list) {
        const el = document.createElement('div');
        el.className = 'member'
            + (m.id === myId ? ' me' : '')
            + (m.online === false ? ' off' : '');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = m.color || '#ccc';
        el.appendChild(dot);
        el.appendChild(document.createTextNode(m.name || 'だれか'));
        if (m.isHost) {
            const t = document.createElement('span');
            t.className = 'tag';
            t.textContent = 'ぬし';
            el.appendChild(t);
        }
        box.appendChild(el);
    }
}

/* ── どうぐ（色・ふとさ）───────────────────── */
const PEN_COLORS = ['#33291f','#e8503a','#f0872a','#f2c12e','#3b86d4','#46a83c','#d45ea0'];
const PEN_WIDTHS = [8, 16, 30];

let board = null;
const myStrokes = [];   // 自分が かいた線（もどす ための ならび）

function buildTools() {
    const sw = $('swatches');
    const pick = (btn, group) => {
        for (const b of group.children) b.classList.remove('on');
        btn.classList.add('on');
    };
    for (const c of PEN_COLORS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = c;
        b.title = 'この いろで かく';
        b.addEventListener('click', () => { board.setColor(c); pick(b, sw); });
        sw.appendChild(b);
    }
    const er = document.createElement('button');
    er.type = 'button';
    er.className = 'swatch eraser';
    er.textContent = 'けし';
    er.addEventListener('click', () => { board.setColor(ERASER); pick(er, sw); });
    sw.appendChild(er);
    sw.firstChild.classList.add('on');

    const pens = $('pens');
    for (const w of PEN_WIDTHS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pen';
        const dot = document.createElement('span');
        /* 実さいの ふとさは w のまま。ボタンの 中の まるは 見た目だけ おさえます */
        dot.style.width = dot.style.height = Math.min(26, Math.round(w * 0.9)) + 'px';
        b.appendChild(dot);
        b.addEventListener('click', () => { board.setWidth(w); pick(b, pens); });
        pens.appendChild(b);
    }
    pens.children[1].classList.add('on');
}

/* ── はじめる ─────────────────────────────── */
let conn = null;

/* ばんと どうぐは、つうしんを 待たずに さきに 組み立てます。
   こうすると ネットが つながらない ときでも、じぶんの 画面では
   絵が かけます（送れないだけ）。道具ごと 消えることが ありません。 */
board = createBoard({
    base: $('base'),
    overlay: $('overlay'),
    /* かいている とちゅう … ときどき 送る */
    onProgress(stroke) {
        if (!conn) return;
        sendLive(conn, code, myId, stroke).catch(() => {});
    },
    /* ふでを はなした … かき おわった線に うつす */
    async onFinish(stroke) {
        if (!conn) return;
        try {
            const id = await commitStroke(conn, code, stroke);
            myStrokes.push(id);
        } catch (e) {
            say('線を おくれませんでした', true);
        } finally {
            clearLive(conn, code, myId).catch(() => {});
        }
    }
});
buildTools();
board.setWidth(PEN_WIDTHS[1]);

(async () => {
    try {
        const c = await connect();
        await enterRoom(c, code, myId, myName, isHost);
        clearLiveOnDisconnect(c, code, myId);
        conn = c;

        watchMembers(c, code, drawMembers);
        watchStrokes(c, code,
            (id, stroke) => board.addStroke(id, stroke),
            id => board.dropStroke(id));
        watchLive(c, code, map => board.setLive(map, myId));

        hideSay();
    } catch (e) {
        say((e.message || 'つうしんが できませんでした') + '／じぶんの 画面には かけます', true);
    }
})();

/* ── ボタン ───────────────────────────────── */
$('undo').addEventListener('click', async () => {
    const id = myStrokes.pop();
    if (!id) return;
    try { await removeStroke(conn, code, id); } catch (e) { myStrokes.push(id); }
});

$('clear').addEventListener('click', async () => {
    if (!confirm('ぜんぶ けしますか？')) return;
    try {
        await clearBoard(conn, code);
        myStrokes.length = 0;
    } catch (e) { say('けせませんでした', true); }
});

$('leave').addEventListener('click', async () => {
    $('leave').disabled = true;
    try {
        if (conn) {
            await clearLive(conn, code, myId);
            await leaveRoom(conn, code, myId);
        }
    } catch (e) {}
    clearStore('ka_room');
    clearStore('ka_host');
    location.href = 'index.html';
});
