/* ホーム画面
   なまえを 入れて、部屋を つくる か、4けたの 番号で 入ります。
   入力は すべて 画面の キーボードです（物理キーボードは つかいません）。 */
import { createHiraganaKeypad, createNumberKeypad } from './keypad.js';
import { connect, createRoom, findRoom, enterRoom, myMemberId, writeStore } from './firebase.js';

const $ = id => document.getElementById(id);
const NAME_MAX = 6;

const stepName = $('stepName'), stepPick = $('stepPick'), stepCode = $('stepCode');
const notice = $('notice');

let busy = false;

/* ── しらせ ───────────────────────────────── */
function say(text, bad) {
    notice.textContent = text;
    notice.className = 'notice ' + (bad ? 'bad' : 'wait');
}
function clearSay() { notice.className = 'notice wait hidden'; }

function show(step) {
    for (const s of [stepName, stepPick, stepCode]) s.classList.toggle('hidden', s !== step);
    clearSay();
}

/* ── ① なまえ ─────────────────────────────── */
const nameOut = $('nameOut');
const hira = createHiraganaKeypad({
    max: NAME_MAX,
    onChange(value) {
        nameOut.textContent = value;
        if (!value) nameOut.innerHTML = '<span class="placeholder">なまえを いれてね</span>';
        $('nameNext').disabled = value.length === 0;
    }
});
$('hiraSlot').appendChild(hira.el);

$('nameNext').addEventListener('click', () => {
    $('pickName').textContent = hira.getValue();
    show(stepPick);
});
$('backToName').addEventListener('click', () => show(stepName));

/* ── ③ へやばんごう ───────────────────────── */
const digitBoxes = [];
for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'digit';
    $('digits').appendChild(d);
    digitBoxes.push(d);
}
const num = createNumberKeypad({
    digits: 4,
    onChange(value) {
        digitBoxes.forEach((box, i) => {
            box.textContent = value[i] || '';
            box.classList.toggle('filled', !!value[i]);
        });
        $('codeGo').disabled = value.length !== 4;
    }
});
$('numSlot').appendChild(num.el);

$('btnJoin').addEventListener('click', () => { num.clear(); show(stepCode); });
$('backToPick').addEventListener('click', () => show(stepPick));

/* ── 部屋に 進む ──────────────────────────── */

/** 部屋が きまったら、名前と 番号を おぼえて あつまる画面へ */
function goToRoom(code, name, isHost) {
    writeStore('ka_room', code);
    writeStore('ka_name', name);
    writeStore('ka_host', isHost ? '1' : '0');
    location.href = 'room.html';
}

async function withBusy(button, waitText, job) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    say(waitText);
    try {
        await job();
    } catch (e) {
        say(e.message || 'うまく いきませんでした。もう一度 おしてください', true);
        button.disabled = false;
    } finally {
        busy = false;
    }
}

$('btnCreate').addEventListener('click', () => {
    const name = hira.getValue();
    withBusy($('btnCreate'), 'へやを つくっています…', async () => {
        const conn = await connect();
        const id = myMemberId();
        const code = await createRoom(conn, id);
        await enterRoom(conn, code, id, name, true);
        goToRoom(code, name, true);
    });
});

$('codeGo').addEventListener('click', () => {
    const name = hira.getValue();
    const code = num.getValue();
    withBusy($('codeGo'), 'へやを さがしています…', async () => {
        const conn = await connect();
        const info = await findRoom(conn, code);
        if (!info) {
            $('codeGo').disabled = false;
            throw new Error('その ばんごうの へやは ありません。ばんごうを たしかめてね');
        }
        const id = myMemberId();
        await enterRoom(conn, code, id, name, false);
        goToRoom(code, name, false);
    });
});
