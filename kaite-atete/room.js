/* おえかきの 画面
   あつまる → じゅんばんに かく → けっか はっぴょう。
   かく人には おだいが 見え、ほかの人は ひらがなで こたえます。 */
import { connect, watchMembers, enterRoom, leaveRoom, myMemberId, readStore, writeStore, clearStore,
         sendLive, clearLive, clearLiveOnDisconnect, commitStroke, removeStroke,
         clearBoard, watchStrokes, watchLive, watchInfo, setPhase,
         setupRound, armRound, finishRound, watchRound, markAnswered,
         startGame, watchGame, setTurn, watchScores, addScores,
         updateRound, updateGame, bumpMiss } from './firebase.js';
import { createBoard, ERASER } from './board.js';
import { createHiraganaKeypad } from './keypad.js';
import { LEVELS, pickWord, hashWord, normalize } from './odai.js';
import { scoreRound } from './scoring.js';
import { createStepper } from './stepper.js';
import { sound } from './audio.js';

const $ = id => document.getElementById(id);

/* あそびかたは 2つ。
   じゅんばん … みんなが おなじ かいすう かきます（なんしゅうで きめます）
   ランダム   … つぎに かく人を くじびきで きめます（ぜんたいの 時間で おわります） */
const MODES = [
    { key: 'order',  label: 'じゅんばん', note: 'みんな おなじ かいすう' },
    { key: 'random', label: 'ランダム',   note: 'つぎの 人は くじびき' }
];
/* ぬしは「あそぶ」か「かんりする（先生）」かを えらべます。
   かんりする ときは ゲームに 入らず、みんなの ようすを 見て すすめます。 */
const HOST_ROLES = [
    { key: 'play',  label: 'あそぶ',     note: 'いっしょに さんか' },
    { key: 'admin', label: 'かんりする', note: 'さんかせず すすめる' }
];
const LAP_CHOICES = [
    { n: 1, label: '1しゅう', note: 'ひとり 1かい' },
    { n: 2, label: '2しゅう', note: 'ひとり 2かい' },
    { n: 3, label: '3しゅう', note: 'ひとり 3かい' }
];
const DEFAULT_MINUTES = 5;    // ランダムの ときの ぜんたいの 時間（ふん）
const MIN_MINUTES = 1, MAX_MINUTES = 99;
const DEFAULT_SECONDS = 60;   // 1かいの 時間（びょう）
const MIN_SECONDS = 30, MAX_SECONDS = 120;
/* かく人が いなく なって 止まったとき、ぬしが すすめるまでの 待ち時間 */
const STUCK_SETUP_MS = 8000;  // おだいが 出ないまま
const STUCK_END_MS = 3000;    // 時間が すぎたのに おわらない

const code = readStore('ka_room');
const myName = readStore('ka_name');
const isHost = readStore('ka_host') === '1';
const myId = myMemberId();

if (!code || !myName) location.replace('index.html');
$('code').textContent = code;

let conn = null, board = null;
let members = [], game = null, round = null, scores = {};
let phase = 'waiting';
let level = LEVELS[0].key, mode = 'order', laps = 1, hostRole = 'play';
let minutes = DEFAULT_MINUTES, seconds = DEFAULT_SECONDS;
let myWord = null, recent = [];
let arming = false, finishing = false, advancing = false;
/* 音を 二重に 鳴らさない ための おぼえ */
let wasDone = false, wasMyTurn = false, lastTick = -1, resultPlayed = false;
let lastReroll = 0;   /* ぬしから「おだいを かえて」と たのまれた しるし */
/* おだいを かくすか。えらんだら おぼえます（この 端末だけ）*/
let odaiHidden = false;
try { odaiHidden = localStorage.getItem('ka_odaihide') === '1'; } catch (e) {}
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
const isRandom = () => !!game && game.mode === 'random';
const adminId = () => (game && game.admin) || null;
const amAdmin = () => adminId() === myId;
/* あそぶ 人だけ（かんりする ぬしは ふくみません）*/
const playerIds = () => onlineIds().filter(id => id !== adminId());
const paused = () => !!(game && game.pausedAt);
const gameLeftMs = () => (game && game.endsAt ? game.endsAt - Date.now() : null);

function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

/* ── あつまった人 ─────────────────────────── */
function chip(m, compact) {
    const el = document.createElement('div');
    el.className = 'member' + (m.id === myId ? ' me' : '') + (m.online === false ? ' off' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.color || '#ccc';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(m.name || 'だれか'));

    /* 人数が 多い ときは、上の帯では 名まえを ゆうせんし、
       てんすうなどは はぶきます（名まえが 切れると 見づらい ため）*/
    if (compact) return el;

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
    const crowded = members.length > 4;
    for (const id of ['members', 'membersBig']) {
        const box = $(id);
        box.textContent = '';
        /* 上の帯は 1れつなので、人数が 多い ときは かんたんな 見せかたに */
        for (const m of members) box.appendChild(chip(m, id === 'members' && crowded));
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

    const admin = playing && amAdmin();
    const drawer = playing && amDrawer();
    const answerer = playing && !drawer && !admin;
    const done = !!(round && round.done);

    $('drawerPanel').classList.toggle('hidden', !drawer);
    $('answerPanel').classList.toggle('hidden', !answerer || done || iAnswered() || paused());
    $('adminPanel').classList.toggle('hidden', !admin);
    $('tools').classList.toggle('hidden', !drawer || done);
    $('clear').classList.toggle('hidden', !drawer);
    document.body.classList.toggle('answering', answerer);
    document.body.classList.toggle('paused', playing && paused());
    if (board) {
        board.setEnabled(drawer && !done && !paused());
        /* こたえる人は よこに ひらがなキーボードが 出るので、広めに のこします */
        board.setSideMin(answerer ? 520 : 330);
    }

    /* ボタンは ぜんぶ ぬし（先生）が おします */
    $('nextTurn').classList.toggle('hidden', !playing || !isHost || (!done && !admin));
    $('nextTurn').textContent = done ? 'つぎの 人へ' : 'つぎの 人に かわる';
    $('changeOdai').classList.toggle('hidden',
        !playing || !isHost || !round || !round.hash || done);
    $('pauseBtn').classList.toggle('hidden', !playing || !isHost);
    $('pauseBtn').textContent = paused() ? 'さいかい' : 'いちじ ていし';
    $('endGame').classList.toggle('hidden', !playing || !isHost);

    if (admin) drawWatchlist();

    if (playing && game) {
        const who = nameOf(round ? round.drawer : null) + ' さんの ばん';
        $('turnLabel').textContent = isRandom()
            ? (game.turn + 1) + ' かいめ　' + who
            : (game.turn + 1) + ' / ' + totalTurns() + ' かいめ　' + who;
    }

    if (drawer) {
        /* おだいは 小さく、下の 左はしに。「かくす」を えらんで いれば ● に します
           （まわりの 席から 見えて しまわない ように）*/
        $('odai').textContent = myWord || '（じゅんびちゅう…）';
        $('odai').classList.toggle('hidden', odaiHidden);
        $('odaiMask').classList.toggle('hidden', !odaiHidden);
        $('hideOdai').textContent = odaiHidden ? 'みる' : 'かくす';
        const n = round && round.answered ? Object.keys(round.answered).length : 0;
        $('answeredCount').textContent = n === 0 ? 'まだ だれも あてていません' : n + ' にん あてました';
    }

    /* 先生（ぬし）と かく人には「まだの 人」を 出します。
       だれを 待っているかが 見えると、つぎに すすめる はんだんが できます。 */
    const showWaiting = playing && round && round.hash && !done && !admin && (isHost || drawer);
    $('waitingFor').classList.toggle('hidden', !showWaiting);
    if (showWaiting) {
        const answered = round.answered || {};
        const yet = playerIds().filter(id => id !== round.drawer && !answered[id]).map(nameOf);
        $('waitingFor').textContent = yet.length === 0
            ? 'ぜんいん あてました！'
            : 'まだの 人 … ' + yet.join('、');
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

/* 先生（かんり）の 画面。だれが あてて、だれが こまっているかが わかります。
   みんなの 画面を そのまま 映す ひつようは ありません。
   絵は みんな 同じ ものを 見ているので、ちがうのは「こたえの ようす」だけです。 */
function drawWatchlist() {
    const box = $('watchlist');
    box.textContent = '';
    const answered = (round && round.answered) || {};
    const misses = (round && round.misses) || {};
    const order = Object.entries(answered).sort((a, b) => a[1] - b[1]).map(e => e[0]);

    for (const m of members) {
        if (m.id === adminId()) continue;
        const row = document.createElement('div');
        let cls = 'watchrow';
        let st = 'まだ こたえていません';
        if (round && round.drawer === m.id) { cls += ' draw'; st = 'かいています'; }
        else if (answered[m.id]) { cls += ' ok'; st = (order.indexOf(m.id) + 1) + ' ばんめに せいかい'; }
        if (m.online === false) { cls += ' off'; st = 'はなれて います'; }
        row.className = cls;

        const dot = document.createElement('span');
        dot.className = 'dot'; dot.style.background = m.color || '#ccc';
        const nm = document.createElement('span');
        nm.className = 'nm'; nm.textContent = m.name || 'だれか';
        const stt = document.createElement('span');
        stt.className = 'st'; stt.textContent = st;
        row.append(dot, nm, stt);

        if (misses[m.id]) {
            const ms = document.createElement('span');
            ms.className = 'miss';
            ms.textContent = '✕' + misses[m.id];
            row.appendChild(ms);
        }
        box.appendChild(row);
    }
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
    if (phase !== 'playing') { $('timer').textContent = '－'; $('clock').textContent = ''; return; }

    /* いちじ ていし中は 時間を 止めます */
    if (paused()) {
        $('timer').textContent = 'いちじ ていし';
        $('timer').classList.remove('hurry');
        $('clock').textContent = '';
        return;
    }

    /* ぜんたいの 時間（ランダムの ときだけ）*/
    const restMs = gameLeftMs();
    if (isRandom() && restMs !== null) {
        const rest = Math.max(0, Math.ceil(restMs / 1000));
        const mm = Math.floor(rest / 60), ss = rest % 60;
        $('clock').textContent = 'ぜんたい ' + mm + ':' + String(ss).padStart(2, '0');
        /* 時間が きたら ぬしが おわりに します（ぬしは かならず いるので）。
           ここで 例外が 出ると advancing が たったままに なり、
           「つぎの 人へ」が 黙って きかなく なるので、かならず 元に もどします。 */
        if (rest === 0 && isHost && conn && !advancing) {
            advancing = true;
            try {
                setPhase(conn, code, 'result').catch(() => {}).finally(() => { advancing = false; });
            } catch (e) {
                advancing = false;
            }
        }
    } else {
        $('clock').textContent = '';
    }

    /* 1かいの のこり時間 */
    if (!round || !round.endsAt) { $('timer').textContent = '－'; return; }
    if (round.done) { $('timer').textContent = 'おしまい'; $('timer').classList.remove('hurry'); return; }
    const left = Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000));
    $('timer').textContent = 'のこり ' + left + ' びょう';
    $('timer').classList.toggle('hurry', left <= Math.max(3, Math.round(((game && game.seconds) || DEFAULT_SECONDS) / 3)));
    if (left === 0 && amDrawer()) endRound();

    /* のこり 3びょうから、1びょうごとに 小さく 鳴らします */
    if (left <= 3 && left > 0 && left !== lastTick) { lastTick = left; sound.tick(); }
    if (left > 3) lastTick = -1;

    watchdog();
}, 300);

/* ── おだいの じゅんび（かく人の タブだけ）──────── */
async function armIfMine(force) {
    if (!conn || !round || round.done || arming) return;
    if (!force && round.hash) return;
    if (round.drawer !== myId) return;
    arming = true;
    try {
        const word = pickWord(round.level || level, recent);
        recent = [word, ...recent].slice(0, 30);
        myWord = word;
        writeStore('ka_word', word);
        await clearBoard(conn, code);
        myStrokes.length = 0;
        await armRound(conn, code, hashWord(word), (game && game.seconds) || DEFAULT_SECONDS);
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

/* ── 進行が 止まっていないか 見はる ───────────────
   かく人の タブが いなく なると、おだいが 出ないまま・
   時間が すぎたのに おわらないまま 止まります。
   その ときは ぬしが かわりに すすめます。 */
function watchdog() {
    if (!conn || phase !== 'playing' || !isHost || !game || !round || advancing || finishing) return;
    if (paused()) return;      /* 止めている あいだは 見はりも 止めます */
    const now = Date.now();
    const drawerHere = onlineIds().includes(round.drawer);

    /* おだいが 出ないまま 止まっている */
    if (!round.hash && !round.done && round.setupAt && now - round.setupAt > STUCK_SETUP_MS) {
        say('かく人が いないので、つぎの 人に すすみます');
        advance();
        return;
    }
    /* 時間が すぎたのに おわっていない（かく人が いない）*/
    if (round.hash && !round.done && round.endsAt && !drawerHere
        && now > round.endsAt + STUCK_END_MS) {
        hostFinish();
    }
}

/* かく人が いなく なった ときに、ぬしが この かいを おわらせます。
   ことばは 知らないので 出せませんが、とくてんは つけられます。 */
async function hostFinish() {
    if (!conn || !round || round.done || finishing) return;
    finishing = true;
    try {
        const deltas = scoreRound(round.answered, round.drawer);
        if (Object.keys(deltas).length) await addScores(conn, code, deltas);
        await finishRound(conn, code, null);
    } catch (e) {
        say('この かいを おわれませんでした', true);
    } finally {
        finishing = false;
    }
}

/* ── つぎの 人へ ─────────────────────────── */
async function advance() {
    /* 黙って 何も しないと「ボタンが きかない」ように 見えるので、
       できない ときは かならず わけを 出します */
    if (!conn) { say('つうしんが できていません。すこし まってから もう一度 おしてください', true); return; }
    if (!game) { say('ゲームの じょうほうが ありません', true); return; }
    if (advancing) return;
    advancing = true;
    try {
        const next = game.turn + 1;
        const over = isRandom()
            ? (gameLeftMs() !== null && gameLeftMs() <= 0)   // 時間ぎれ
            : (next >= totalTurns());                        // ぜんいん かきおわった
        if (over) {
            await setPhase(conn, code, 'result');
        } else {
            const drawer = isRandom() ? drawLots() : game.order[next % game.order.length];
            await setTurn(conn, code, next);
            await setupRound(conn, code, drawer, round ? round.level : level);
        }
    } catch (e) {
        say('つぎに いけませんでした', true);
    } finally {
        advancing = false;
    }
}

/** ランダムの ときの くじびき。いま かいた人は なるべく つづけて ひきません。 */
function drawLots() {
    const here = playerIds();
    const now = round ? round.drawer : null;
    const pool = here.length > 1 ? here.filter(id => id !== now) : here;
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ぜんいんが あてたら、かく人の タブが この かいを おわらせます */
function checkAllAnswered() {
    if (!amDrawer() || !round || round.done || !round.hash) return;
    const others = playerIds().filter(id => id !== myId);
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
buildChooser('hostRoles', HOST_ROLES, it => { hostRole = it.key; });
buildChooser('modes', MODES, it => {
    mode = it.key;
    /* じゅんばんなら「なんしゅう」、ランダムなら「ぜんたいの じかん」*/
    $('lapRow').classList.toggle('hidden', mode !== 'order');
    $('minRow').classList.toggle('hidden', mode !== 'random');
});
buildChooser('laps', LAP_CHOICES, it => { laps = it.n; });
$('settings').classList.toggle('hidden', !isHost);

const minPad = createStepper({ value: DEFAULT_MINUTES, min: MIN_MINUTES, max: MAX_MINUTES,
                               unit: 'ふん', onChange: v => { minutes = v; } });
const secPad = createStepper({ value: DEFAULT_SECONDS, min: MIN_SECONDS, max: MAX_SECONDS,
                               unit: 'びょう', onChange: v => { seconds = v; } });
$('minSlot').appendChild(minPad.el);
$('secSlot').appendChild(secPad.el);
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
    /* ── 音 ──────────────────────────────── */
    const nowDone = !!(r && r.done);
    if (nowDone && !wasDone) sound.roundEnd();
    wasDone = nowDone;

    const myTurn = !!(r && r.drawer === myId && r.hash && !r.done);
    if (myTurn && !wasMyTurn) sound.yourTurn();
    wasMyTurn = myTurn;

    round = r;
    /* 画面を 読みこみ なおしたときは、おぼえている ことばを つかいます */
    if (round && round.drawer === myId && round.hash && !myWord) {
        const kept = readStore('ka_word');
        if (kept && hashWord(kept) === round.hash) myWord = kept;
    }
    render();
    drawMembers();

    /* ぬしが「おだいを かえる」を おしたら、かく人の タブが えらびなおします */
    const reroll = (r && r.reroll) || 0;
    if (reroll > lastReroll) {
        lastReroll = reroll;
        if (r && r.drawer === myId && !r.done) { armIfMine(true); return; }
    }

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
        watchInfo(c, code, info => {
            phase = info.phase || 'waiting';
            if (phase === 'result' && !resultPlayed) { resultPlayed = true; sound.fanfare(); }
            if (phase !== 'result') resultPlayed = false;
            render();
            if (phase === 'playing') requestAnimationFrame(() => board.refit());
        });
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
        const admin = hostRole === 'admin' ? myId : null;
        const order = shuffle(onlineIds().filter(id => id !== admin));
        if (!order.length) {
            throw new Error(admin ? 'あそぶ 人が いません（ぬしは かんり中です）' : 'だれも いません');
        }
        await startGame(conn, code, {
            mode, order, seconds, admin,
            laps: mode === 'order' ? laps : null,
            endsAt: mode === 'random' ? Date.now() + minutes * 60000 : null
        });
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
        sound.ok();
        writeStore('ka_myans', normalize(guess));
        $('judge').dataset.wrong = '';
        try { await markAnswered(conn, code, myId); } catch (e) {}
        render();
    } else {
        sound.ng();
        try { await bumpMiss(conn, code, myId); } catch (e) {}
        $('judge').dataset.wrong = '1';
        ansPad.clear();
        render();
    }
});

/* おだいを かくす ／ みる */
$('hideOdai').addEventListener('click', () => {
    odaiHidden = !odaiHidden;
    try { localStorage.setItem('ka_odaihide', odaiHidden ? '1' : '0'); } catch (e) {}
    render();
});

/* おと の 入り／切り（この 端末だけ）*/
function paintSound() {
    $('soundBtn').textContent = sound.isOn() ? 'おと' : 'おと ✕';
    $('soundBtn').style.opacity = sound.isOn() ? '' : '.55';
}
$('soundBtn').addEventListener('click', () => { sound.toggle(); paintSound(); });
paintSound();

/* おだいを かえる。ぬしは ことばを 知らないので、
   「かえて」と たのむ しるしだけ おき、かく人の タブが えらびなおします。 */
$('changeOdai').addEventListener('click', async () => {
    if (!conn || !round) return;
    $('changeOdai').disabled = true;
    try { await updateRound(conn, code, { reroll: Date.now() }); }
    catch (e) { say('おだいを かえられませんでした', true); }
    finally { $('changeOdai').disabled = false; }
});

/* いちじ ていし ／ さいかい。
   止めている あいだ すすんだ ぶんを、おわる 時こくに たし直します。 */
$('pauseBtn').addEventListener('click', async () => {
    if (!conn || !game) return;
    $('pauseBtn').disabled = true;
    try {
        if (paused()) {
            const delta = Date.now() - game.pausedAt;
            if (round && round.endsAt) await updateRound(conn, code, { endsAt: round.endsAt + delta });
            const patch = { pausedAt: null };
            if (game.endsAt) patch.endsAt = game.endsAt + delta;
            await updateGame(conn, code, patch);
        } else {
            await updateGame(conn, code, { pausedAt: Date.now() });
        }
    } catch (e) {
        say('できませんでした', true);
    } finally {
        $('pauseBtn').disabled = false;
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
