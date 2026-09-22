/* おえかきの 画面
   あつまる → はじめる → おえかき。
   かく人には おだいが 見え、ほかの人は ひらがなで こたえます。 */
import { connect, watchMembers, enterRoom, leaveRoom, myMemberId, readStore, writeStore, clearStore,
         sendLive, clearLive, clearLiveOnDisconnect, commitStroke, removeStroke,
         clearBoard, watchStrokes, watchLive, watchInfo, setPhase,
         startRound, watchRound, markAnswered, revealWord } from './firebase.js';
import { createBoard, ERASER } from './board.js';
import { createHiraganaKeypad } from './keypad.js';
import { LEVELS, pickWord, hashWord, normalize } from './odai.js';

const $ = id => document.getElementById(id);

const code = readStore('ka_room');
const myName = readStore('ka_name');
const isHost = readStore('ka_host') === '1';
const myId = myMemberId();

if (!code || !myName) location.replace('index.html');
$('code').textContent = code;

let conn = null;
let board = null;
let round = null;            // いまの おだい（みんなが 見られる ぶん）
let myWord = null;           // かく人だけが もつ ことば
let level = LEVELS[0].key;
let recent = [];             // さっき 出た おだい（つづけて 出ないように）
let members = [];
const myStrokes = [];

function say(text, bad) {
    const n = $('notice');
    n.textContent = text;
    n.className = 'notice ' + (bad ? 'bad' : 'wait');
}
const hideSay = () => { $('notice').className = 'notice wait hidden'; };

/* ── あつまった人 ─────────────────────────── */
function chip(m) {
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
    if (round && round.drawer === m.id) tags.push('かく人');
    else if (round && round.answered && round.answered[m.id]) tags.push('せいかい');
    else if (m.isHost) tags.push('ぬし');
    if (tags.length) {
        const t = document.createElement('span');
        t.className = 'tag';
        t.textContent = tags.join('・');
        el.appendChild(t);
    }
    return el;
}

function drawMembers() {
    for (const id of ['members', 'membersBig']) {
        const box = $(id);
        box.textContent = '';
        for (const m of members) box.appendChild(chip(m));
    }
    const here = members.filter(m => m.online !== false).length;
    $('count').textContent = here === 0 ? 'まだ だれも いません' : here + ' にん あつまりました';
}

/* ── どうぐ（色・ふとさ）───────────────────── */
const PEN_COLORS = ['#33291f','#e8503a','#f0872a','#f2c12e','#3b86d4','#46a83c','#d45ea0'];
const PEN_WIDTHS = [8, 16, 30];

function buildTools() {
    const sw = $('swatches');
    const pick = (btn, group) => {
        for (const b of group.children) b.classList.remove('on');
        btn.classList.add('on');
    };
    for (const c of PEN_COLORS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'swatch'; b.style.background = c;
        b.addEventListener('click', () => { board.setColor(c); pick(b, sw); });
        sw.appendChild(b);
    }
    const er = document.createElement('button');
    er.type = 'button'; er.className = 'swatch eraser'; er.textContent = 'けし';
    er.addEventListener('click', () => { board.setColor(ERASER); pick(er, sw); });
    sw.appendChild(er);
    sw.firstChild.classList.add('on');

    const pens = $('pens');
    for (const w of PEN_WIDTHS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pen';
        const dot = document.createElement('span');
        /* 実さいの ふとさは w のまま。ボタンの 中の まるは 見た目だけ おさえます */
        dot.style.width = dot.style.height = Math.min(26, Math.round(w * 0.9)) + 'px';
        b.appendChild(dot);
        b.addEventListener('click', () => { board.setWidth(w); pick(b, pens); });
        pens.appendChild(b);
    }
    pens.children[1].classList.add('on');
}

/* ── むずかしさ えらび（ぬしだけ）─────────────── */
function buildLevels() {
    const box = $('levels');
    for (const lv of LEVELS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'level';
        b.innerHTML = '';
        const big = document.createElement('b'); big.textContent = lv.label;
        const small = document.createElement('span'); small.textContent = lv.note;
        b.append(big, small);
        b.addEventListener('click', () => {
            level = lv.key;
            for (const x of box.children) x.classList.remove('on');
            b.classList.add('on');
        });
        box.appendChild(b);
    }
    box.firstChild.classList.add('on');
    box.classList.toggle('hidden', !isHost);
}

/* ── こたえる ための キーボード ────────────────── */
const ansPad = createHiraganaKeypad({
    max: 8,
    onChange(v) {
        $('ansOut').textContent = v;
        if (!v) $('ansOut').innerHTML = '<span class="placeholder">こたえを いれてね</span>';
        $('ansGo').disabled = v.length === 0;
    }
});

/* ── 場面と やくわりの きりかえ ─────────────── */
let phase = null;

function amDrawer() { return !!round && round.drawer === myId; }
function iAnswered() { return !!round && !!round.answered && !!round.answered[myId]; }

function applyPhase(next) {
    phase = next;
    const playing = (next === 'playing');

    $('waiting').classList.toggle('hidden', playing);
    $('play').classList.toggle('hidden', !playing);
    $('start').classList.toggle('hidden', playing || !isHost);
    $('waitMsg').classList.toggle('hidden', playing || isHost);
    $('backToWait').classList.toggle('hidden', !playing || !isHost);

    applyRole();
    if (playing) requestAnimationFrame(() => board.refit());
}

/* かく人か、こたえる人か で 見せる ものを かえます */
function applyRole() {
    const playing = (phase === 'playing');
    const drawer = playing && amDrawer();
    const answerer = playing && !amDrawer();

    $('drawerPanel').classList.toggle('hidden', !drawer);
    $('answerPanel').classList.toggle('hidden', !answerer);
    $('tools').classList.toggle('hidden', !drawer);
    $('clear').classList.toggle('hidden', !drawer);
    $('nextOdai').classList.toggle('hidden', !drawer);
    document.body.classList.toggle('answering', answerer);

    if (board) board.setEnabled(drawer);

    /* かく人には ことばを 見せます。画面を 読みこみ なおしても、
       おだいが 同じ ものなら おぼえている ことばを つかいます。 */
    if (drawer) {
        if (!myWord || hashWord(myWord) !== (round && round.hash)) {
            const kept = readStore('ka_word');
            myWord = (kept && round && hashWord(kept) === round.hash) ? kept : null;
        }
        $('odai').textContent = myWord || '（おだいを よみこめません。つぎの おだいを おしてください）';
        const n = round && round.answered ? Object.keys(round.answered).length : 0;
        $('answeredCount').textContent = n === 0 ? 'まだ だれも あてていません' : n + ' にん あてました';
    }

    if (answerer) {
        const done = iAnswered();
        $('ansSlot').classList.toggle('hidden', done);
        $('ansGo').classList.toggle('hidden', done);
        $('judge').classList.toggle('hidden', !done && !$('judge').dataset.wrong);
        if (done) {
            $('judge').className = 'judge ok';
            $('judge').textContent = 'せいかい！';
            $('ansOut').textContent = readStore('ka_myans') || '';
        }
    }

    /* おわった おだいの ことばが みんなに 見えたら 出します */
    if (playing && round && round.word) {
        $('judge').classList.remove('hidden');
        $('judge').className = 'judge reveal';
        $('judge').textContent = 'こたえは「' + round.word + '」でした';
    }
}

/* おだいが かわったら、こたえの 入力や 「ちがうみたい」を まっさらに もどします。
   これを しないと、まえの おだいの こたえが のこったままに なります。 */
let lastRoundId = null;
function onRound(r) {
    const id = r ? (r.hash + ':' + r.startedAt) : null;
    if (id !== lastRoundId) {
        lastRoundId = id;
        ansPad.clear();
        $('judge').dataset.wrong = '';
        $('judge').classList.add('hidden');
        clearStore('ka_myans');
    }
    round = r;
    applyRole();
    drawMembers();
}

/* ── はじめる ─────────────────────────────── */
board = createBoard({
    base: $('base'),
    overlay: $('overlay'),
    onProgress(stroke) {
        if (!conn) return;
        sendLive(conn, code, myId, stroke).catch(() => {});
    },
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
buildLevels();
board.setWidth(PEN_WIDTHS[1]);
$('ansSlot').appendChild(ansPad.el);
applyPhase('waiting');

(async () => {
    try {
        const c = await connect();
        await enterRoom(c, code, myId, myName, isHost);
        clearLiveOnDisconnect(c, code, myId);
        conn = c;

        watchMembers(c, code, list => { members = list; drawMembers(); });
        watchInfo(c, code, info => applyPhase(info.phase || 'waiting'));
        watchRound(c, code, onRound);
        watchStrokes(c, code,
            (id, stroke) => board.addStroke(id, stroke),
            id => board.dropStroke(id));
        watchLive(c, code, map => board.setLive(map, myId));

        hideSay();
    } catch (e) {
        say((e.message || 'つうしんが できませんでした'), true);
    }
})();

/* ── おだいを くばる ─────────────────────── */
async function newRound() {
    const word = pickWord(level, recent);
    recent = [word, ...recent].slice(0, 20);
    myWord = word;
    writeStore('ka_word', word);
    clearStore('ka_myans');
    $('judge').dataset.wrong = '';
    ansPad.clear();
    await clearBoard(conn, code);
    myStrokes.length = 0;
    await startRound(conn, code, { drawer: myId, level, hash: hashWord(word) });
}

$('start').addEventListener('click', async () => {
    if (!conn) return;
    $('start').disabled = true;
    try {
        await newRound();
        await setPhase(conn, code, 'playing');
    } catch (e) {
        say('はじめられませんでした', true);
    } finally {
        $('start').disabled = false;
    }
});

$('nextOdai').addEventListener('click', async () => {
    if (!conn) return;
    $('nextOdai').disabled = true;
    try {
        if (myWord) await revealWord(conn, code, myWord);   // こたえを みんなに 見せてから
        await new Promise(r => setTimeout(r, 1200));
        await newRound();
    } catch (e) {
        say('つぎに いけませんでした', true);
    } finally {
        $('nextOdai').disabled = false;
    }
});

$('backToWait').addEventListener('click', async () => {
    if (!conn) return;
    try { await setPhase(conn, code, 'waiting'); }
    catch (e) { say('もどれませんでした', true); }
});

/* ── こたえる ─────────────────────────────── */
$('ansGo').addEventListener('click', async () => {
    const guess = ansPad.getValue();
    if (!guess || !round || !conn) return;

    if (hashWord(guess) === round.hash) {
        writeStore('ka_myans', normalize(guess));
        try { await markAnswered(conn, code, myId); } catch (e) {}
        $('judge').dataset.wrong = '';
        applyRole();
    } else {
        $('judge').dataset.wrong = '1';
        $('judge').className = 'judge ng';
        $('judge').textContent = 'ちがうみたい。もういちど！';
        $('judge').classList.remove('hidden');
        ansPad.clear();
    }
});

/* ── ボタン ───────────────────────────────── */
$('undo').addEventListener('click', async () => {
    const id = myStrokes.pop();
    if (!id || !conn) return;
    try { await removeStroke(conn, code, id); } catch (e) { myStrokes.push(id); }
});

$('clear').addEventListener('click', async () => {
    if (!conn || !confirm('ぜんぶ けしますか？')) return;
    try { await clearBoard(conn, code); myStrokes.length = 0; }
    catch (e) { say('けせませんでした', true); }
});

$('leave').addEventListener('click', async () => {
    $('leave').disabled = true;
    try {
        if (conn) { await clearLive(conn, code, myId); await leaveRoom(conn, code, myId); }
    } catch (e) {}
    clearStore('ka_room'); clearStore('ka_host'); clearStore('ka_word');
    location.href = 'index.html';
});
