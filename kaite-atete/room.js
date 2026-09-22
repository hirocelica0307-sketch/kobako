/* あつまる画面
   いま 部屋に いる 人を ならべます。あとの 段階で、ここに
   「はじめる」ボタンや 先生用の 進行画面が つきます。 */
import { connect, watchMembers, enterRoom, leaveRoom,
         myMemberId, readStore, clearStore } from './firebase.js';

const $ = id => document.getElementById(id);

const code = readStore('ka_room');
const myName = readStore('ka_name');
const isHost = readStore('ka_host') === '1';
const myId = myMemberId();

/* 部屋を 通らずに 直接 開かれたときは ホームに もどします */
if (!code || !myName) location.replace('index.html');

$('code').textContent = code;

function say(text, bad) {
    const n = $('notice');
    n.textContent = text;
    n.className = 'notice ' + (bad ? 'bad' : 'wait');
}
function hideSay() { $('notice').className = 'notice wait hidden'; }

function draw(list) {
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

        const tags = [];
        if (m.isHost) tags.push('へやの ぬし');
        if (m.id === myId) tags.push('じぶん');
        if (m.online === false) tags.push('はなれて います');
        if (tags.length) {
            const t = document.createElement('span');
            t.className = 'tag';
            t.textContent = tags.join('・');
            el.appendChild(t);
        }
        box.appendChild(el);
    }

    const here = list.filter(m => m.online !== false).length;
    $('count').textContent = here === 0 ? 'まだ だれも いません' : here + ' にん あつまりました';
}

let conn = null;

(async () => {
    try {
        conn = await connect();
        /* 画面を 読みこみ なおしたときのために、席に 入りなおします */
        await enterRoom(conn, code, myId, myName, isHost);
        watchMembers(conn, code, draw);
        hideSay();
    } catch (e) {
        say(e.message || 'つうしんが できませんでした', true);
    }
})();

$('leave').addEventListener('click', async () => {
    $('leave').disabled = true;
    try { if (conn) await leaveRoom(conn, code, myId); } catch (e) {}
    clearStore('ka_room');
    clearStore('ka_host');
    location.href = 'index.html';
});
