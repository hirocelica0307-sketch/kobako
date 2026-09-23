/* たいせんの 画面
   ------------------------------------------------------------------
   あつまる → ぬしが「はじめる」→ まっている人が 2人 そろったら すぐ たいせん
   → けっか → また まつ（つぎの 相手と 組まれる）… を くりかえします。

   ・組を 作るのは へやの ぬしの タブ だけです（みんなで 作ると ぶつかるため）
   ・かちまけは「さきに 書きこんだ ほう」で きまります（Firebase の トランザクション）
   ・よーい・どん と のこり時間は サーバーの 時計で そろえます
   ------------------------------------------------------------------ */
import { connect, serverNow, watchMembers, enterRoom, leaveRoom, myMemberId,
         readStore, writeStore, updateMe, addRecord,
         watchInfo, setPhase, watchSettings, saveSettings,
         createMatch, watchMatch, watchMatches, sendProg, watchProg, watchAllProg,
         settleMatch } from './firebase.js';
import { createTyper } from './romaji.js';
import { LEVELS, wordList } from './words.js';
import { makePairs } from './pairing.js';
import { createStepper } from './stepper.js';
import { sound } from './audio.js';

const $ = id => document.getElementById(id);

const START_DELAY = 4000;    // 組が できてから はじまるまで（3・2・1）
const DECIDE_GRACE = 1500;   // じかん ぎれの あと、さいごの すすみが とどくのを まつ
const GONE_MS = 5000;        // あいてが いなく なって これだけ たったら かち
const STALE_MS = 6000;       // じかんが すぎても きまらない たいせんを ぬしが きめるまで
const AUTO_NEXT = 15;        // けっかの あと、じどうで つぎへ すすむまで（びょう）
const PROG_EVERY = 80;       // すすみを 送る 間かく（ミリ秒）
const PAIR_EVERY = 1000;     // ぬしが 組を さがす 間かく（ミリ秒）
const ROPE_RANGE = 170;      // つなが うごく はば（かちの 線まで）
const WORDS_PER_MATCH = 300;

const DEFAULTS = { level: 'easy', seconds: 60, goal: 20, guide: true, hostRole: 'play' };
const GUIDES = [
    { key: true,  label: 'みせる',   note: 'はじめての 子に' },
    { key: false, label: 'みせない', note: 'なれてきたら' }
];
const HOST_ROLES = [
    { key: 'play',  label: 'あそぶ',     note: 'いっしょに たいせん' },
    { key: 'admin', label: 'かんりする', note: 'たいせんせず 見まもる' }
];

const code = readStore('tt_room');
const myName = readStore('tt_name');
const isHost = readStore('tt_host') === '1';
const myId = myMemberId();

if (!code || !myName) location.replace('index.html');
$('code').textContent = code;

let conn = null;
let info = {}, settings = null, members = [];
let allMatches = {}, allProg = {};      // ぬしだけが 見はります
let game = null;                         // いまの たいせん（なければ null）
let pairing = false;
let ticks = 0;

/* このこが えらんだ 打ちかた（shi か si か など）。おてほんを それに あわせます */
let prefs = {};
try { prefs = JSON.parse(readStore('tt_prefs') || '{}') || {}; } catch (e) { prefs = {}; }
const savePrefs = () => writeStore('tt_prefs', JSON.stringify(prefs));

/* ── 小さな ことば ───────────────────────── */
const now = () => serverNow(conn);
const me = () => members.find(m => m.id === myId) || null;
const memberOf = id => members.find(m => m.id === id) || null;
const nameOf = id => (memberOf(id) || {}).name || 'だれか';
const colorOf = id => (memberOf(id) || {}).color || '#bbb';
const isOnline = m => !!m && m.online !== false;
const hostAdmin = () => isHost && settings && settings.hostRole === 'admin';
const levelLabel = key => (LEVELS.find(l => l.key === key) || LEVELS[0]).label;

function say(t, bad) {
    const n = $('notice');
    n.textContent = t;
    n.className = 'notice ' + (bad ? 'bad' : 'wait');
}
const hideSay = () => { $('notice').className = 'notice wait hidden'; };

/* ことばを 入れものの はばに おさまる 大きさに します */
function fitText(el, maxPx, minPx) {
    let size = maxPx;
    el.style.fontSize = size + 'px';
    const box = el.parentElement;
    while (size > minPx && el.scrollWidth > box.clientWidth - 8) {
        size -= 2;
        el.style.fontSize = size + 'px';
    }
}

/* ── あつまった人 ─────────────────────────── */
const STATE_TAG = { wait: 'まっている', play: 'たいせん中', rest: 'やすみ', admin: 'かんり' };

function chip(m, compact) {
    const el = document.createElement('div');
    el.className = 'member' + (m.id === myId ? ' me' : '') + (isOnline(m) ? '' : ' off')
        + (m.state === 'play' ? ' busy' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.color || '#ccc';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(m.name || 'だれか'));
    if (compact) return el;

    const tags = [];
    if (!isOnline(m)) tags.push('はなれています');
    else if (info.phase === 'open' || m.state !== 'wait') tags.push(STATE_TAG[m.state] || '');
    if (m.isHost) tags.push('ぬし');
    if (m.wins) tags.push(m.wins + 'かち');
    if (tags.filter(Boolean).length) {
        const t = document.createElement('span');
        t.className = 'tag';
        t.textContent = tags.filter(Boolean).join('・');
        el.appendChild(t);
    }
    return el;
}

function drawMembers() {
    const crowded = members.length > 4;
    for (const id of ['members', 'membersBig']) {
        const box = $(id);
        box.textContent = '';
        for (const m of members) box.appendChild(chip(m, id === 'members' && crowded));
    }
    const here = members.filter(isOnline);
    const counts = { wait: 0, play: 0, rest: 0 };
    for (const m of here) if (counts[m.state] != null) counts[m.state]++;
    $('count').textContent = here.length === 0 ? 'まだ だれも いません'
        : info.phase === 'open'
            ? `${here.length}にん（たいせん中 ${counts.play}・まっている ${counts.wait}・やすみ ${counts.rest}）`
            : `${here.length}にん あつまりました`;
}

/* ── ぬしの せってい ─────────────────────── */
function buildChooser(boxId, items, current, onPick) {
    const box = $(boxId);
    box.textContent = '';
    for (const it of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level' + (it.key === current ? ' on' : '');
        const big = document.createElement('b'); big.textContent = it.label;
        const small = document.createElement('span'); small.textContent = it.note;
        b.append(big, small);
        b.addEventListener('click', () => {
            for (const x of box.children) x.classList.remove('on');
            b.classList.add('on');
            onPick(it.key);
        });
        box.appendChild(b);
    }
}

let secStepper = null, goalStepper = null;

function buildSettings() {
    const s = settings || DEFAULTS;
    const change = patch => {
        settings = { ...(settings || DEFAULTS), ...patch };
        saveSettings(conn, code, settings);
        applyHostRole();
        render();
    };
    buildChooser('levels', LEVELS, s.level, key => change({ level: key }));
    buildChooser('guides', GUIDES, s.guide !== false, key => change({ guide: key }));
    buildChooser('hostRoles', HOST_ROLES, s.hostRole, key => change({ hostRole: key }));
    secStepper = createStepper({ value: s.seconds, unit: 'びょう', min: 20, max: 180,
        onChange: v => { if (settings && settings.seconds !== v) change({ seconds: v }); } });
    goalStepper = createStepper({ value: s.goal, unit: 'もじ', min: 5, max: 60,
        onChange: v => { if (settings && settings.goal !== v) change({ goal: v }); } });
    $('secSlot').appendChild(secStepper.el);
    $('goalSlot').appendChild(goalStepper.el);
}

/* ぬしが「かんりする」なら、組を 作る ときに 自分を 入れません */
function applyHostRole() {
    const m = me();
    if (!isHost || !m || m.state === 'play') return;
    if (hostAdmin() && m.state !== 'admin') updateMe(conn, code, myId, { state: 'admin' });
    if (!hostAdmin() && m.state === 'admin') updateMe(conn, code, myId, { state: 'wait', since: now() });
}

function ruleText(s) {
    if (!s) return '';
    return `${levelLabel(s.level)}・${s.seconds}びょう・あいてより ${s.goal}もじ 多く 打てたら かち`
        + (s.guide === false ? '・おてほん なし' : '');
}

/* ── 組を 作る（ぬしの タブ だけ）──────────────── */
/* 組に した 人と その 時こく。書きこみが 手もとに とどく 前に
   もう一度 さがしても、同じ 人を 2つの 組に 入れない ための おぼえです。
   その人が たいせんを おえて また まちはじめたら（since が あたらしく なったら）また 組めます。 */
const claimed = new Map();

async function tryPair() {
    if (!isHost || !conn || info.phase !== 'open' || !settings || pairing) return;
    const pool = members.filter(m => isOnline(m) && m.state === 'wait' && !m.match
        && !(claimed.has(m.id) && (m.since || 0) <= claimed.get(m.id)));
    if (pool.length < 2) return;
    const pairs = makePairs(pool.map(m => ({ id: m.id, foe: m.foe || null, since: m.since || 0 })), now());
    if (!pairs.length) return;
    pairing = true;
    try {
        for (const [a, b] of pairs) {
            claimed.set(a, now());
            claimed.set(b, now());
            const startsAt = now() + START_DELAY;
            await createMatch(conn, code, {
                a, b,
                level: settings.level,
                goal: settings.goal,
                guide: settings.guide !== false,
                seed: Math.floor(Math.random() * 2147483647),
                createdAt: now(),
                startsAt,
                endsAt: startsAt + settings.seconds * 1000,
                done: false
            }).catch(e => {
                claimed.delete(a);        // つくれなかったら、つぎに また 組めるように
                claimed.delete(b);
                throw e;
            });
        }
    } catch (e) {
        say('組を つくれませんでした。つうしんを たしかめてください', true);
    } finally {
        pairing = false;
    }
}

/* じかんが すぎても きまらない たいせん（2人とも いなく なった など）を ぬしが きめます */
function settleStale() {
    if (!isHost || !conn) return;
    const t = now();
    for (const [mid, m] of Object.entries(allMatches)) {
        if (m.done || t < m.endsAt + STALE_MS) continue;
        settleMatch(conn, code, mid, cur => decideByCount(cur, allProg[mid] || {}, 'time'));
    }
}

/* 打った 数で かちまけを きめます */
function decideByCount(cur, prog, reason) {
    const na = (prog[cur.a] || {}).n || 0;
    const nb = (prog[cur.b] || {}).n || 0;
    return { winner: na > nb ? cur.a : nb > na ? cur.b : 'draw', reason };
}

/* ── ぬしの「たいせんの ようす」──────────────── */
function drawWatch() {
    const grid = $('matchGrid');
    grid.textContent = '';
    const t = now();
    const list = Object.entries(allMatches)
        .filter(([, m]) => !m.done || t - (m.endedAt || 0) < 10000)
        .sort((x, y) => (x[1].createdAt || 0) - (y[1].createdAt || 0));
    if (!list.length) {
        const p = document.createElement('p');
        p.className = 'count';
        p.textContent = info.phase === 'open' ? 'いまは たいせんして いる 組は ありません' : 'まだ はじまっていません';
        grid.appendChild(p);
        return;
    }
    for (const [mid, m] of list) {
        const pa = (allProg[mid] || {})[m.a] || {}, pb = (allProg[mid] || {})[m.b] || {};
        const na = pa.n || 0, nb = pb.n || 0;
        const card = document.createElement('div');
        card.className = 'matchcard' + (m.done ? ' done' : '');

        const names = document.createElement('div');
        names.className = 'mc-names';
        const dot = id => {
            const i = document.createElement('i');
            i.style.background = colorOf(id);
            return i;
        };
        const left = document.createElement('span');
        left.append(dot(m.a), `${nameOf(m.a)} ${na}`);
        const right = document.createElement('span');
        right.append(`${nb} ${nameOf(m.b)}`, dot(m.b));
        names.append(left, right);

        const bar = document.createElement('div');
        bar.className = 'mc-bar';
        const knot = document.createElement('b');
        const r = Math.max(-1, Math.min(1, (na - nb) / (m.goal || 20)));
        knot.style.left = (50 - r * 45) + '%';
        bar.appendChild(knot);

        const st = document.createElement('div');
        st.className = 'mc-st';
        if (m.done) {
            st.textContent = m.winner === 'draw' ? 'ひきわけ' : nameOf(m.winner) + ' の かち';
        } else if (t < m.startsAt) {
            st.textContent = 'まもなく はじまります';
        } else {
            st.textContent = 'のこり ' + Math.max(0, Math.ceil((m.endsAt - t) / 1000)) + 'びょう';
        }
        card.append(names, bar, st);
        grid.appendChild(card);
    }
}

/* ── あつまる画面 ─────────────────────────── */
function renderLobby() {
    const m = me();
    const open = info.phase === 'open';
    const title = $('lobbyTitle'), sub = $('lobbySub');
    const hostHere = members.some(x => x.isHost && isOnline(x));

    if (!m) { title.textContent = 'つないでいます…'; sub.textContent = ''; }
    else if (hostAdmin()) {
        title.textContent = open ? 'たいせん できます' : 'せっていを えらんで「はじめる」を おしてね';
        sub.textContent = open ? '2人 そろった 組から どんどん はじまります' : 'あつまった 人を 2人ずつ 組にします';
    } else if (m.state === 'rest') {
        title.textContent = 'やすんでいます';
        sub.textContent = '「たいせんに でる」を おすと、また あいてを さがします';
    } else if (!open) {
        title.textContent = isHost ? 'せっていを えらんで「はじめる」を おしてね' : 'へやの ぬしが はじめるのを まっています…';
        sub.textContent = isHost ? 'あつまった 人を 2人ずつ 組にします' : '';
    } else {
        const waiting = members.filter(x => isOnline(x) && x.state === 'wait').length;
        title.textContent = 'あいてを さがしています…';
        sub.textContent = !hostHere ? 'へやの ぬしが いないので、組が つくれません'
            : waiting <= 1 ? 'もう 1人 まつ人が くると はじまります'
            : 'まもなく あいてが きまります';
    }
    $('lobbyMsg').classList.toggle('searching', !!m && open && m.state === 'wait' && !hostAdmin());

    $('ruleLine').textContent = settings ? 'ルール： ' + ruleText(settings) : '';
    /* たいせん中は せっていを たたんで、ようすに 場所を ゆずります
       （かえる ときは「あたらしい 組を とめる」を おすと また 出ます）*/
    $('settings').classList.toggle('hidden', !isHost || open);
    $('lobby').classList.toggle('hostopen', isHost && open);
    $('watchBox').classList.toggle('hidden', !isHost || !open);
    $('start').classList.toggle('hidden', !isHost || open);
    $('stop').classList.toggle('hidden', !isHost || !open);
    const canRest = !!m && !hostAdmin() && m.state === 'wait';
    $('rest').classList.toggle('hidden', !canRest);
    $('join').classList.toggle('hidden', !m || hostAdmin() || m.state !== 'rest');
    if (isHost && open) drawWatch();
}

function render() {
    drawMembers();
    const inGame = !!game;
    $('lobby').classList.toggle('hidden', inGame);
    $('game').classList.toggle('hidden', !inGame);
    document.body.classList.toggle('ingame', inGame);
    if (!inGame) renderLobby();
}

/* ── たいせん ────────────────────────────────── */

/** たいせんに 入ります（組が できた とき・画面を 開きなおした とき）。 */
function enterGame(mid) {
    leaveGame();
    game = {
        mid, match: null, prog: {}, progLoaded: false, unsub: [],
        words: null, wi: 0, typer: null, n: 0, miss: 0, keys: 0,
        ready: false, live: false, timeUp: false, claiming: false,
        sendTimer: null, lastSent: 0, foeGoneSince: null,
        shown: false, autoTimer: null, lastCd: null, lastTick: null
    };
    game.unsub.push(watchMatch(conn, code, mid, m => {
        if (!game || game.mid !== mid) return;
        game.match = m;
        setupGame();
        paintGame();
    }));
    game.unsub.push(watchProg(conn, code, mid, p => {
        if (!game || game.mid !== mid) return;
        game.prog = p;
        game.progLoaded = true;
        setupGame();
        paintFoe();
        paintRope();
        checkGoal();
        fillStats();
    }));
    $('resultBox').classList.add('hidden');
    $('countdown').classList.add('hidden');
    render();
}

function leaveGame() {
    if (!game) return;
    for (const off of game.unsub) { try { off(); } catch (e) {} }
    clearTimeout(game.sendTimer);
    clearInterval(game.autoTimer);
    game = null;
    $('imeWarn').classList.add('hidden');
}

const foeId = () => game && game.match ? (game.match.a === myId ? game.match.b : game.match.a) : null;
const foeProg = () => (game && game.prog[foeId()]) || {};

/* たいせんの 中身と、じぶんの すすみが そろったら じゅんびします */
function setupGame() {
    if (!game || game.ready || !game.match || !game.progLoaded) return;
    const m = game.match;
    game.words = wordList(m.level, m.seed, WORDS_PER_MATCH);

    /* 画面を 開きなおした ときは、とちゅうから つづけます（打ちかけの ことばは さいしょから）*/
    const mine = game.prog[myId];
    if (mine) {
        game.wi = mine.w || 0;
        game.n = Math.max(0, (mine.n || 0) - (mine.k || 0));
        game.miss = mine.miss || 0;
        game.keys = mine.keys || 0;
    }
    game.typer = createTyper(game.words[game.wi], prefs);
    game.ready = true;

    const f = foeId();
    $('meName').textContent = myName;
    $('foeName').textContent = nameOf(f);
    $('meDot').style.background = colorOf(myId);
    $('foeDot').style.background = colorOf(f);
    for (const id of ['meHead', 'winMe', 'winMeText']) paintColor($(id), colorOf(myId));
    for (const id of ['foeHead', 'winFoe', 'winFoeText']) paintColor($(id), colorOf(f));
    $('meBody').setAttribute('stroke', colorOf(myId));
    $('foeBody').setAttribute('stroke', colorOf(f));
    $('roma').classList.toggle('noguide', m.guide === false);
    $('cdVs').textContent = `${myName} たい ${nameOf(f)}`;

    if (now() < m.startsAt) sound.matched();
    if (mine) sendNow();
    paintMine();
    paintFoe();
    paintRope();
}

function paintColor(el, color) {
    if (el.tagName === 'line') el.setAttribute('stroke', color);
    else el.setAttribute('fill', color);
}

/* じぶんの ことば */
function paintMine() {
    if (!game || !game.ready) return;
    const v = game.typer.view();
    $('wordDone').textContent = v.doneKana;
    $('wordRest').textContent = v.restKana;
    $('romaTyped').textContent = v.typed;
    $('romaGuide').textContent = v.rest;
    const nx = game.words[game.wi + 1];
    $('nextWord').textContent = nx ? 'つぎ： ' + nx : '';
    $('meCount').textContent = game.n + 'もじ';
}

/* ことばが かわった ときだけ 大きさを はかりなおします */
function fitWord() {
    fitText($('word'), 64, 22);
    fitText($('roma'), 34, 14);
}

/* あいての ようす */
function paintFoe() {
    if (!game || !game.ready) return;
    const p = foeProg();
    const w = game.words[p.w || 0] || '';
    const k = Math.min(p.k || 0, w.length);
    $('foeDone').textContent = w.slice(0, k);
    $('foeRest').textContent = w.slice(k);
    $('foeBuf').textContent = p.buf || ' ';
    $('foeMiss').textContent = 'まちがい ' + (p.miss || 0);
    $('foeCount').textContent = (p.n || 0) + 'もじ';
    fitText($('foeWord'), 34, 14);
}

/* つな */
function paintRope() {
    if (!game || !game.ready) return;
    const goal = game.match.goal || 20;
    const diff = game.n - (foeProg().n || 0);
    const r = Math.max(-1, Math.min(1, diff / goal));
    $('ropeG').style.transform = `translateX(${-r * ROPE_RANGE}px)`;
    const lab = $('leadLabel');
    if (diff > 0) lab.textContent = `あと ${goal - diff}もじ で かち！`;
    else if (diff < 0) lab.textContent = `あいては あと ${goal + diff}もじ で かち`;
    else lab.textContent = 'おなじ ところ';
    lab.className = diff > 0 ? 'ahead' : diff < 0 ? 'behind' : '';
}

function paintGame() {
    if (!game || !game.ready) return;
    paintMine();
    fitWord();
    paintFoe();
    paintRope();
    tick();
}

/* ── キーを おした とき ─────────────────────── */
window.addEventListener('keydown', e => {
    if (!game || !game.ready || game.match.done) return;
    /* 日本語入力が オンの ときは ローマ字が とどかないので、おしえます */
    if (e.key === 'Process' || e.isComposing || e.keyCode === 229) {
        $('imeWarn').classList.remove('hidden');
        e.preventDefault();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    /* スペースや エンターで ボタンが おされない ように */
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab') {
        e.preventDefault();
        return;
    }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!game.live) return;
    const key = e.key.toLowerCase();
    if (!/^[a-z\-',.!?]$/.test(key)) return;       // 数字などは かぞえません
    $('imeWarn').classList.add('hidden');
    typeKey(key);
    paintMine();
    paintRope();
    queueProg();
    checkGoal();
});

function typeKey(key) {
    const r = game.typer.input(key);
    if (!r.ok) {
        game.miss++;
        sound.miss();
        const w = $('word');
        w.classList.remove('shake');
        void w.offsetWidth;            // アニメーションを もう一度 うごかす ため
        w.classList.add('shake');
        return;
    }
    game.n += r.kana;
    if (!r.carry) game.keys++;
    if (game.typer.done()) {
        savePrefs();
        game.wi++;
        game.typer = createTyper(game.words[game.wi % game.words.length], prefs);
        sound.word();
        fitWord();
        if (r.carry) typeKey(r.carry);
    }
}

/* すすみを 送ります（たくさん おしても 送りすぎない ように まとめます）*/
function queueProg() {
    if (!game || game.sendTimer) return;
    const wait = Math.max(0, PROG_EVERY - (Date.now() - game.lastSent));
    game.sendTimer = setTimeout(sendNow, wait);
}

function sendNow() {
    if (!game || !game.typer) return;
    clearTimeout(game.sendTimer);
    game.sendTimer = null;
    game.lastSent = Date.now();
    return sendProg(conn, code, game.mid, myId, {
        n: game.n, w: game.wi, k: game.typer.kanaDone(), buf: game.typer.buffer(),
        miss: game.miss, keys: game.keys, t: now()
    });
}

/* つなを 引ききったら かち */
function checkGoal() {
    if (!game || !game.ready || game.claiming || game.match.done || !game.live) return;
    const diff = game.n - (foeProg().n || 0);
    if (diff < (game.match.goal || 20)) return;
    game.claiming = true;
    sendNow();
    settleMatch(conn, code, game.mid, () => ({ winner: myId, reason: 'goal' }))
        .finally(() => { if (game) game.claiming = false; });
}

/* ── じかんの すすみ ────────────────────────── */
function tick() {
    if (isHost && info.phase === 'open') {
        settleStale();
        if (!game && ++ticks % 5 === 0) drawWatch();     // 0.5びょうごとに 書きなおす
    }
    if (!game || !game.ready) return;
    const m = game.match;
    if (m.done) { showResult(); return; }
    const t = now();

    /* 3・2・1 */
    const cd = $('countdown');
    if (t < m.startsAt) {
        const n = Math.ceil((m.startsAt - t) / 1000);
        cd.classList.remove('hidden');
        $('cdNum').textContent = n > 3 ? 'よーい' : n;
        if (n <= 3 && n !== game.lastCd) { game.lastCd = n; sound.count(); }
    } else if (!game.live && !game.timeUp) {
        game.live = true;
        cd.classList.add('hidden');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        sound.go();
    }

    /* のこり時間 */
    const left = Math.max(0, Math.ceil((m.endsAt - Math.max(t, m.startsAt)) / 1000));
    $('timer').textContent = 'のこり ' + left + 'びょう';
    $('timer').classList.toggle('hurry', left <= 10);
    if (game.live && left <= 5 && left > 0 && left !== game.lastTick) { game.lastTick = left; sound.tick(); }

    /* じかん ぎれ … さいごの すすみを 送って、すこし まってから 数で きめます */
    if (t >= m.endsAt && !game.timeUp) {
        game.timeUp = true;
        game.live = false;
        sendNow();
        const mid = game.mid;
        setTimeout(() => {
            if (!game || game.mid !== mid) return;
            settleMatch(conn, code, mid, cur => decideByCount(cur, game.prog, 'time'));
        }, DECIDE_GRACE);
    }

    /* あいてが いなく なった */
    const foe = memberOf(foeId());
    if (!isOnline(foe)) {
        if (game.foeGoneSince == null) game.foeGoneSince = t;
        else if (t - game.foeGoneSince > GONE_MS && !game.claiming) {
            game.claiming = true;
            settleMatch(conn, code, game.mid, () => ({ winner: myId, reason: 'left' }))
                .finally(() => { if (game) game.claiming = false; });
        }
    } else {
        game.foeGoneSince = null;
    }
}

/* ── けっか ─────────────────────────────────── */
function showResult() {
    if (!game || game.shown) return;
    game.shown = true;
    game.live = false;
    const m = game.match;
    const f = foeId();
    const won = m.winner === myId, draw = m.winner === 'draw';

    $('countdown').classList.add('hidden');
    $('resTitle').textContent = draw ? 'ひきわけ' : won ? 'かち！' : 'まけ';
    $('resTitle').className = draw ? '' : won ? 'win' : 'lose';
    const why = {
        goal: won ? 'つなを ひっぱりきったよ！' : 'あいてに ひっぱりきられたよ',
        time: draw ? 'じかん ぎれ。打った もじが おなじ だったよ'
            : won ? 'じかん ぎれ。あなたの ほうが たくさん 打てたよ' : 'じかん ぎれ。あいての ほうが たくさん 打てたよ',
        left: won ? 'あいてが いなく なったので、あなたの かちです' : 'つうしんが きれたので、あいての かちに なりました'
    };
    $('resWhy').textContent = why[m.reason] || '';

    fillStats();
    $('resultBox').classList.remove('hidden');

    if (draw) sound.draw(); else if (won) sound.win(); else sound.lose();
    sendNow();

    /* かち数を 1回だけ つけます（いなく なった ときの かちは かぞえません）*/
    const key = 'tt_rec_' + game.mid;
    if (m.reason !== 'left' && !readStore(key)) {
        writeStore(key, '1');
        addRecord(conn, code, myId, won);
    }

    /* しばらく したら じどうで つぎへ */
    let left = AUTO_NEXT;
    const btn = $('nextBtn');
    const label = () => { btn.textContent = `つぎの たいせんへ（${left}）`; };
    label();
    game.autoTimer = setInterval(() => {
        left--;
        if (left <= 0) goNext(); else label();
    }, 1000);
}

/* けっかの 数（あいての さいごの すすみが あとから とどいても 書きなおします）*/
function fillStats() {
    if (!game || !game.shown) return;
    const m = game.match;
    const f = foeId();
    const theirs = game.prog[f] || {};
    /* じかん ぎれの ときは、きめるまでの 待ち時間を ふくめません */
    const mins = Math.max(1000, Math.min(m.endedAt || m.endsAt, m.endsAt) - m.startsAt) / 60000;
    $('resMe').textContent = myName;
    $('resFoe').textContent = nameOf(f);
    $('resN1').textContent = game.n;
    $('resN2').textContent = theirs.n || 0;
    $('resS1').textContent = Math.round(game.n / mins) + 'もじ';
    $('resS2').textContent = Math.round((theirs.n || 0) / mins) + 'もじ';
    $('resM1').textContent = game.miss;
    $('resM2').textContent = theirs.miss || 0;
}

function goNext() {
    const f = foeId();
    leaveGame();
    updateMe(conn, code, myId, {
        state: hostAdmin() ? 'admin' : 'wait', match: null, foe: f || null, since: now()
    });
    render();
}

function goRest() {
    const f = foeId();
    leaveGame();
    updateMe(conn, code, myId, { state: 'rest', match: null, foe: f || null });
    render();
}

/* ── ボタン ─────────────────────────────────── */
$('nextBtn').addEventListener('click', goNext);
$('restBtn').addEventListener('click', goRest);
$('rest').addEventListener('click', () => updateMe(conn, code, myId, { state: 'rest' }));
$('join').addEventListener('click', () => updateMe(conn, code, myId, { state: 'wait', since: now() }));
$('start').addEventListener('click', async () => {
    await saveSettings(conn, code, settings || DEFAULTS);
    await setPhase(conn, code, 'open');
});
$('stop').addEventListener('click', () => setPhase(conn, code, 'waiting'));

$('soundBtn').addEventListener('click', () => {
    const on = sound.toggle();
    $('soundBtn').classList.toggle('muted', !on);
});
$('soundBtn').classList.toggle('muted', !sound.isOn());

$('leave').addEventListener('click', async () => {
    if (game && game.live && !confirm('たいせんの とちゅうです。でると まけに なります。でますか？')) return;
    try { if (conn) await leaveRoom(conn, code, myId); } catch (e) {}
    location.href = 'index.html';
});

/* ── はじめる ───────────────────────────────── */
async function main() {
    try {
        conn = await connect();
    } catch (e) {
        say(e.message, true);
        return;
    }
    try {
        await enterRoom(conn, code, myId, myName, isHost);
    } catch (e) {
        say('へやに はいれませんでした。もう一度 ためしてください', true);
        return;
    }
    hideSay();

    watchInfo(conn, code, v => { info = v; render(); tryPair(); });
    watchSettings(conn, code, v => {
        if (!v && isHost) { saveSettings(conn, code, DEFAULTS); return; }
        const first = !settings;
        settings = v;
        if (isHost && first) { buildSettings(); applyHostRole(); }
        render();
    });
    watchMembers(conn, code, list => {
        members = list;
        const m = me();
        if (m && m.state === 'play' && m.match) {
            if (!game || game.mid !== m.match) enterGame(m.match);
        } else if (game && game.shown === false && m && m.state !== 'play') {
            leaveGame();
        }
        render();
        tryPair();
    });
    if (isHost) {
        watchMatches(conn, code, v => { allMatches = v; if (!game) renderLobby(); });
        watchAllProg(conn, code, v => { allProg = v; });
        setInterval(tryPair, PAIR_EVERY);
    }
    setInterval(tick, 100);
}

main();
