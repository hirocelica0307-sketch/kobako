/* ホーム画面
   こども … なまえを 入れて、せんせいに おしえて もらった 4けたの 番号で 入ります。
   せんせい … 下の「せんせい」から あいことば（4けた）を 入れて、へやを つくります。
   入力は すべて 画面の キーボードです（物理キーボードは つかいません）。 */
import { createHiraganaKeypad, createNumberKeypad } from './keypad.js';
import { connect, createRoom, findRoom, enterRoom, myMemberId, writeStore, readStore } from './firebase.js';
import { hashWord } from './odai.js';

const $ = id => document.getElementById(id);
const NAME_MAX = 6;
const SENSEI_NAME = 'せんせい';

const stepName = $('stepName'), stepCode = $('stepCode'), stepSensei = $('stepSensei');
const notice = $('notice');

let busy = false;

/* ── しらせ ───────────────────────────────── */
function say(text, bad) {
    notice.textContent = text;
    notice.className = 'notice ' + (bad ? 'bad' : 'wait');
}
function clearSay() { notice.className = 'notice wait hidden'; }

function show(step) {
    for (const s of [stepName, stepCode, stepSensei]) s.classList.toggle('hidden', s !== step);
    $('senseiBtn').classList.toggle('hidden', step !== stepName);
    clearSay();
}

/* 4つの ます（ばんごう・あいことば）を 作ります */
function makeDigits(boxId, mask) {
    const boxes = [];
    for (let i = 0; i < 4; i++) {
        const d = document.createElement('div');
        d.className = 'digit';
        $(boxId).appendChild(d);
        boxes.push(d);
    }
    return value => boxes.forEach((box, i) => {
        box.textContent = value[i] ? (mask ? '●' : value[i]) : '';
        box.classList.toggle('filled', !!value[i]);
    });
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
    $('codeName').textContent = hira.getValue();
    num.clear();
    show(stepCode);
});
$('backToName').addEventListener('click', () => show(stepName));

/* ── ② へやばんごう ───────────────────────── */
const paintCode = makeDigits('digits', false);
const num = createNumberKeypad({
    digits: 4,
    onChange(value) {
        paintCode(value);
        $('codeGo').disabled = value.length !== 4;
    }
});
$('numSlot').appendChild(num.el);

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

/* ── せんせい ─────────────────────────────────
   へやを つくれるのは せんせい だけです。
   はじめて つかう 端末では あいことば（4けた）を 2かい 入れて きめます。
   あいことばは そのまま のこさず、数字に かえて この 端末（ブラウザ）に のこします。
   いちど あっていれば、タブを とじるまで もう ききません。
   （こどもが まちがって へやを つくらない ための もので、かぎ では ありません）*/
const PIN_KEY = 'ka_sensei_pin';
const pinHash = pin => hashWord('kaite-atete-sensei:' + pin);
const savedPin = () => { try { return localStorage.getItem(PIN_KEY); } catch (e) { return null; } };
let firstPin = null;          // あいことばを きめる とき、1かいめに 入れた もの

const paintPin = makeDigits('pinDigits', true);
const pinPad = createNumberKeypad({
    digits: 4,
    onChange(value) {
        paintPin(value);
        $('pinGo').disabled = value.length !== 4;
    }
});
$('pinSlot').appendChild(pinPad.el);

function senseiStep() {
    pinPad.clear();
    if (!savedPin()) {
        $('senseiMsg').textContent = firstPin === null
            ? 'はじめて つかう 端末です。せんせいの あいことば（4けた）を きめてください'
            : 'たしかめの ため、もう一度 おなじ あいことばを いれてください';
        $('pinGo').textContent = firstPin === null ? 'つぎへ' : 'きめて へやを つくる';
    } else {
        $('senseiMsg').textContent = 'せんせいの あいことば（4けた）';
        $('pinGo').textContent = 'へやを つくる';
    }
    show(stepSensei);
}

$('senseiBtn').addEventListener('click', () => {
    firstPin = null;
    if (readStore('ka_sensei_ok') === '1') { makeRoomAsSensei(); return; }
    senseiStep();
});
$('pinBack').addEventListener('click', () => { firstPin = null; show(stepName); });

$('pinGo').addEventListener('click', () => {
    const pin = pinPad.getValue();
    if (pin.length !== 4) return;
    if (!savedPin()) {
        if (firstPin === null) { firstPin = pin; senseiStep(); return; }
        if (pin !== firstPin) {
            firstPin = null;
            senseiStep();
            say('1かいめと ちがいました。はじめから きめなおしてください', true);
            return;
        }
        try { localStorage.setItem(PIN_KEY, pinHash(pin)); } catch (e) {}
    } else if (pinHash(pin) !== savedPin()) {
        pinPad.clear();
        say('あいことばが ちがいます', true);
        return;
    }
    writeStore('ka_sensei_ok', '1');
    makeRoomAsSensei();
});

function makeRoomAsSensei() {
    const button = stepSensei.classList.contains('hidden') ? $('senseiBtn') : $('pinGo');
    withBusy(button, 'へやを つくっています…', async () => {
        const conn = await connect();
        const id = myMemberId();
        const code = await createRoom(conn, id);
        await enterRoom(conn, code, id, SENSEI_NAME, true);
        goToRoom(code, SENSEI_NAME, true);
    });
}
