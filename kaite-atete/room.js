/* おえかきの 画面
   あつまる → じゅんばんに かく → けっか はっぴょう。
   かく人には おだいが 見え、ほかの人は ひらがなで こたえます。 */
import { connect, watchMembers, enterRoom, leaveRoom, myMemberId, readStore, writeStore, clearStore,
         sendLive, clearLive, clearLiveOnDisconnect, commitStroke, removeStroke,
         clearBoard, watchStrokes, watchLive, watchInfo, setPhase,
         setupRound, armRound, finishRound, watchRound, markAnswered,
         startGame, watchGame, setTurn, watchScores, addScores } from './firebase.js';
import { createBoard, ERASER } from './board.js';
import { createHiraganaKeypad } from './keypad.js';
import { LEVELS, pickWord, hashWord, normalize } from './odai.js';
import { scoreRound } from './scoring.js';

const $ = id => document.getElementById(id);

const ROUND_SECONDS = 90;     // 1かいの 時間
const LAP_CHOICES = [
    { n: 1, label: '1しゅう', note: 'ぜんいん 1かいずつ' },
    { n: 2, label: '2しゅう', note: 'ぜんいん 2かいずつ' }
];

const code = readStore('ka_room');
const myName = readStore('ka_name');
const isHost = readStore('ka_host') === '1';
const myId = myMemberId();

if (!code || !myName) location.replace('index.html');
$('code').textContent = code;

let conn = null, board = null;
let members = [], game = null, round = null, scores = {};
let phase = 'waiting';
let level = LEVELS[0].key, laps = 1;
let myWord = null, recent = [];
let arming = false, finishing = false, advancing = false;
const myStrokes = [];

function say(t, bad) {
    const n = $('notice');
    n.textContent = t;
    n.className = 'notice ' + (bad ? 'bad' : 'wait');
}
const hideSay = () => { $('notice').className = 'notice wait hidden'; };

/* ── 小さな ことば ───────────────────────── */
const nameOf = id => (members.find(m => m.id === id) || {}).name || 'だれか';
const onlineIds = () => members.filter(m => m.online !== false).map(m => m.id);
const amDrawer = () => !!round && round.drawer === myId;
const iAnswered = () => !!round && !!round.answered && !!round.answered[myId];
const totalTurns = () => (game && game.order ? game.order.length * (game.laps || 1) : 0);

function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

/* ── あつまった人 ─────────────────────────── */
function chip(m) {
    const el = document.createElement('div');
    el.className = 'member' + (m.id === myId ? ' me' : '') + (m.online === false ? ' off' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.color || '#ccc';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(m.name || 'だれか'));

    const tags = [];
    if (phase === 'playing' && round && round.drawer === m.id) tags.push('かく人');
    else if (phase === 'playing' && round && round.answered && round.answered[m.id]) tags.push('せいかい');
    else if (phase === 'waiting' && m.isHost) tags.push('ぬし');
    if (scores[m.id]) tags.push(scores[m.id] + 'てん');
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
    const here = onlineIds().length;
    $('count').textContent = here === 0 ? 'まだ だれも いません' : here + ' にん あつまりました';
}

/* ── どうぐ ───────────────────────────────── */
const PEN_COLORS = ['#33291f','#e8503a','#f0872a','#f2c12e','#3b86d4','#46a83c','#d45ea0'];
const PEN_WIDTHS = [8, 16, 30];

function buildTools() {
    const sw = $('swatches');
    const pick = (b, g) => { for (const x of g.children) x.classList.remove('on'); b.classList.add('on'); };
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
        dot.style.width = dot.style.height = Math.min(26, Math.round(w * 0.9)) + 'px';
        b.appendChild(dot);
        b.addEventListener('click', () => { board.setWidth(w); pick(b, pens); });
        pens.appendChild(b);
    }
    pens.children[1].classList.add('on');
}

function buildChooser(boxId, items, onPick) {
    const box = $(boxId);
    for (const it of items) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'level';
        const big = document.createElement('b'); big.textContent = it.label;
        const small = document.createElement('span'); small.textContent = it.note;
        b.append(big, small);
        b.addEventListener('click', () => {
            for (const x of box.children) x.classList.remove('on');
            b.classList.add('on');
            onPick(it);
        });
        box.appendChild(b);
    }
    box.firstChild.classList.add('on');
    box.classList.toggle('hidden', !isHost);
}

const ansPad = createHiraganaKeypad({
    max: 8,
    onChange(v) {
        $('ansOut').textContent = v;
        if (!v) $('ansOut').innerHTML = '<span class="placeholder">こたえを いれてね</span>';
        $('ansGo').disabled = v.length === 0;
    }
});

/* ── 画面の ぬりかえ ─────────────────────── */
function render() {
    const playing = phase === 'playing';
    const result = phase === 'result';
    const waiting = !playing && !result;

    $('waiting').classList.toggle('hidden', !waiting);
    $('play').classList.toggle('hidden', !playing);
    $('result').classList.toggle('hidden', !result);
    $('start').classList.toggle('hidden', !waiting || !isHost);
    $('waitMsg').classList.toggle('hidden', !waiting || isHost);
    $('again').classList.toggle('hidden', !result || !isHost);
    $('againMsg').classList.toggle('hidden', !result || isHost);

    const drawer = playing && amDrawer();
    const answerer = playing && !amDrawer();
    const done = !!(round && round.done);

    $('drawerPanel').classList.toggle('hidden', !drawer);
    $('answerPanel').classList.toggle('hidden', !answerer || done || iAnswered());
    $('tools').classList.toggle('hidden', !drawer || done);
    $('clear').classList.toggle('hidden', !drawer);
    document.body.classList.toggle('answering', answerer);
    if (board) board.setEnabled(drawer && !done);

    /* つぎへ すすめられるのは、かいた人 と ぬし */
    $('nextTurn').classList.toggle('hidden', !playing || !done || !(drawer || isHost));
    $('endGame').classList.toggle('hidden', !playing || !isHost);

    if (playing && game) {
        $('turnLabel').textContent = (game.turn + 1) + ' / ' + totalTurns() + ' かいめ　'
            + nameOf(round ? round.drawer : null) + ' さんの ばん';
    }

    if (drawer) {
        $('odai').textContent = myWord || '（じゅんびちゅう…）';
        const n = round && round.answered ? Object.keys(round.answered).length : 0;
        $('answeredCount').textContent = n === 0 ? 'まだ だれも あてていません' : n + ' にん あてました';
    }

    /* しらせ（せいかい・ちがう・こたえの はっぴょう）*/
    const j = $('judge');
    if (playing && done) {
        j.className = 'judge reveal';
        j.textContent = round.word ? 'こたえは「' + round.word + '」でした' : 'この かいは おしまいです';
    } else if (answerer && iAnswered()) {
        j.className = 'judge ok';
        j.textContent = 'せいかい！　' + (readStore('ka_myans') || '');
    } else if (j.dataset.wrong === '1') {
        j.className = 'judge ng';
        j.textContent = 'ちがうみたい。もういちど！';
    } else {
        j.className = 'judge hidden';
        j.textContent = '';
    }

    if (result) renderRanking();
}

function renderRanking() {
    const box = $('ranking');
    box.textContent = '';
    const list = members
        .map(m => ({ ...m, score: scores[m.id] || 0 }))
        .sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    let rank = 0, lastScore = null;
    list.forEach((m, i) => {
        if (m.score !== lastScore) { rank = i; lastScore = m.score; }
        const row = document.createElement('div');
        row.className = 'rankrow' + (m.id === myId ? ' me' : '');
        const pos = document.createElement('span');
        pos.className = 'pos';
        pos.textContent = medals[rank] || (rank + 1) + 'い';
        const dot = document.createElement('span');
        dot.className = 'dot'; dot.style.background = m.color || '#ccc';
        const nm = document.createElement('span');
        nm.className = 'nm'; nm.textContent = m.name || 'だれか';
        const sc = document.createElement('b');
        sc.textContent = m.score + ' てん';
        row.append(pos, dot, nm, sc);
        box.appendChild(row);
    });
}

/* ── のこり時間 ───────────────────────────── */
setInterval(() => {
    if (phase !== 'playing' || !round || !round.endsAt) { $('timer').textContent = '－'; return; }
    if (round.done) { $('timer').textContent = 'おしまい'; return; }
    const left = Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000));
    $('timer').textContent = 'のこり ' + left + ' びょう';
    $('timer').classList.toggle('hurry', left <= 15);
    if (left === 0 && amDrawer()) endRound();
}, 300);

/* ── おだいの じゅんび（かく人の タブだけ）──────── */
async function armIfMine() {
    if (!conn || !round || round.done || round.hash || arming) return;
    if (round.drawer !== myId) return;
    arming = true;
    try {
        const word = pickWord(round.level || level, recent);
        recent = [word, ...recent].slice(0, 30);
        myWord = word;
        writeStore('ka_word', word);
        await clearBoard(conn, code);
        myStrokes.length = 0;
        await armRound(conn, code, hashWord(word), ROUND_SECONDS);
    } catch (e) {
        say('おだいを くばれませんでした', true);
    } finally {
        arming = false;
    }
}

/* ── この かいを おわる（かく人の タブが とくてんを つける）── */
async function endRound() {
    if (!conn || !round || round.done || finishing || !amDrawer()) return;
    finishing = true;
    try {
        const deltas = scoreRound(round.answered, myId);
        if (Object.keys(deltas).length) await addScores(conn, code, deltas);
        await finishRound(conn, code, myWord);
    } catch (e) {
        say('てんすうを つけられませんでした', true);
    } finally {
        finishing = false;
    }
}

/* ── つぎの 人へ ─────────────────────────── */
async function advance() {
    if (!conn || !game || advancing) return;
    advancing = true;
    try {
        const next = game.turn + 1;
        if (next >= totalTurns()) {
            await setPhase(conn, code, 'result');
        } else {
            const drawer = game.order[next % game.order.length];
            await setTurn(conn, code, next);
            await setupRound(conn, code, drawer, round ? round.level : level);
        }
    } catch (e) {
        say('つぎに いけませんでした', true);
    } finally {
        advancing = false;
    }
}

/* ぜんいんが あてたら、かく人の タブが この かいを おわらせます */
function checkAllAnswered() {
    if (!amDrawer() || !round || round.done || !round.hash) return;
    const others = onlineIds().filter(id => id !== myId);
    if (!others.length) return;
    const answered = round.answered || {};
    if (others.every(id => answered[id])) endRound();
}

/* ── くみたて ─────────────────────────────── */
board = createBoard({
    base: $('base'),
    overlay: $('overlay'),
    onProgress(stroke) { if (conn) sendLive(conn, code, myId, stroke).catch(() => {}); },
    async onFinish(stroke) {
        if (!conn) return;
        try { myStrokes.push(await commitStroke(conn, code, stroke)); }
        catch (e) { say('線を おくれませんでした', true); }
        finally { clearLive(conn, code, myId).catch(() => {}); }
    }
});
buildTools();
buildChooser('levels', LEVELS.map(l => ({ ...l, n: l.key })), it => { level = it.key; });
buildChooser('laps', LAP_CHOICES, it => { laps = it.n; });
board.setWidth(PEN_WIDTHS[1]);
$('ansSlot').appendChild(ansPad.el);
render();

/* おだいが かわったら、こたえの 入力を まっさらに もどします */
let lastRoundId = null;
function onRound(r) {
    const id = r ? (r.drawer + ':' + (r.startedAt || 0)) : null;
    if (id !== lastRoundId) {
        lastRoundId = id;
        ansPad.clear();
        $('judge').dataset.wrong = '';
        clearStore('ka_myans');
        if (r && r.drawer !== myId) myWord = null;
    }
    round = r;
    /* 画面を 読みこみ なおしたときは、おぼえている ことばを つかいます */
    if (round && round.drawer === myId && round.hash && !myWord) {
        const kept = readStore('ka_word');
        if (kept && hashWord(kept) === round.hash) myWord = kept;
    }
    render();
    drawMembers();
    armIfMine();
    checkAllAnswered();
}

(async () => {
    try {
        const c = await connect();
        await enterRoom(c, code, myId, myName, isHost);
        clearLiveOnDisconnect(c, code, myId);
        conn = c;

        watchMembers(c, code, list => { members = list; drawMembers(); render(); });
        watchInfo(c, code, info => { phase = info.phase || 'waiting'; render();
            if (phase === 'playing') requestAnimationFrame(() => board.refit()); });
        watchGame(c, code, g => { game = g; render(); armIfMine(); });
        watchRound(c, code, onRound);
        watchScores(c, code, s => { scores = s; drawMembers(); render(); });
        watchStrokes(c, code, (id, st) => board.addStroke(id, st), id => board.dropStroke(id));
        watchLive(c, code, map => board.setLive(map, myId));

        hideSay();
    } catch (e) {
        say(e.message || 'つうしんが できませんでした', true);
    }
})();

/* ── ボタン ───────────────────────────────── */
$('start').addEventListener('click', async () => {
    if (!conn) return;
    $('start').disabled = true;
    try {
        const order = shuffle(onlineIds());
        if (!order.length) throw new Error('だれも いません');
        await startGame(conn, code, order, laps);
        await setupRound(conn, code, order[0], level);
        await setPhase(conn, code, 'playing');
    } catch (e) {
        say(e.message || 'はじめられませんでした', true);
    } finally {
        $('start').disabled = false;
    }
});

$('nextTurn').addEventListener('click', () => { $('nextTurn').disabled = true;
    advance().finally(() => { $('nextTurn').disabled = false; }); });

$('endGame').addEventListener('click', async () => {
    if (!conn || !confirm('ここで おわりに しますか？')) return;
    try { await setPhase(conn, code, 'result'); } catch (e) { say('おわれませんでした', true); }
});

$('again').addEventListener('click', async () => {
    if (!conn) return;
    try { await setPhase(conn, code, 'waiting'); } catch (e) { say('もどれませんでした', true); }
});

$('ansGo').addEventListener('click', async () => {
    const guess = ansPad.getValue();
    if (!guess || !round || !round.hash || !conn) return;
    if (hashWord(guess) === round.hash) {
        writeStore('ka_myans', normalize(guess));
        $('judge').dataset.wrong = '';
        try { await markAnswered(conn, code, myId); } catch (e) {}
        render();
    } else {
        $('judge').dataset.wrong = '1';
        ansPad.clear();
        render();
    }
});

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
    try { if (conn) { await clearLive(conn, code, myId); await leaveRoom(conn, code, myId); } } catch (e) {}
    clearStore('ka_room'); clearStore('ka_host'); clearStore('ka_word');
    location.href = 'index.html';
});
