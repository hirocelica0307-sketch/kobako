/* ホーム画面
   なまえを 入れて、部屋を つくる か、4けたの 番号で 入ります。
   なまえは 画面の ひらがなキー、へやばんごうは 画面の テンキーか キーボードの 数字で 入れます。 */
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

/* キーボードの 数字でも 入れられます（ばんごうの 画面の ときだけ）*/
window.addEventListener('keydown', e => {
    if (stepCode.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
    if (/^[0-9]$/.test(e.key)) { num.type(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { num.back(); e.preventDefault(); }
    else if (e.key === 'Enter' && !$('codeGo').disabled) { $('codeGo').click(); e.preventDefault(); }
});
$('backToPick').addEventListener('click', () => show(stepPick));

/* ── 部屋に 進む ──────────────────────────── */

/** 部屋が きまったら、名前と 番号を おぼえて あつまる画面へ */
function goToRoom(code, name, isHost) {
    writeStore('tt_room', code);
    writeStore('tt_name', name);
    writeStore('tt_host', isHost ? '1' : '0');
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
