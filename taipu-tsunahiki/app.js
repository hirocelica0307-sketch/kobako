/* タイピング つなひき ── 画面の ながれ
   ------------------------------------------------------------------
   タイトル ─┬─ たいせん あいてを さがす → むずかしさを えらぶ → じゃんけん → たいせん → けっか
             └─ コンピューターと たいせん → つよさを えらぶ → たいせん → けっか

   ・へやばんごうは ありません。「さがす」を おした 子どうしが 2人組に なります
   ・2人とも むずかしさを えらんだら、じゃんけんを して かった 子の むずかしさで たいせん
   ・かちまけは「先に 書きこんだ ほう」で きまります（Firebase の トランザクション）
   ------------------------------------------------------------------ */
import { connect, serverNow, myMemberId, readStore, writeStore, readLocal, writeLocal,
         findOrQueue, heartbeat, watchAssign, leaveQueue,
         createMatch, watchMatch, markHere, chooseLevel, changeMatchOnce,
         sendProg, watchProg, leaveMatch } from './firebase.js';
import { LEVELS, levelOf, CPU_LEVELS, cpuLevelOf, wordList } from './words.js';
import { createHiraganaKeypad } from './keypad.js';
import { startGame, stopGame, setupGameScreen } from './game.js';
import { createCpu } from './cpu.js';
import { sound, music } from './audio.js';

const $ = id => document.getElementById(id);

const GAME_MS = 60000;        // 1かいの じかん
const GOAL = 20;              // あいてより これだけ 多く 打てたら かち
const CHOOSE_MS = 20000;      // むずかしさを えらぶ じかん（すぎたら じどうで えらびます）
const ARRIVE_MS = 10000;      // あいてが 画面に こないまま これだけ たったら とりやめ
const GONE_MS = 5000;         // あいてが いなく なって これだけ たったら
const HEARTBEAT_MS = 5000;
const DECIDE_GRACE = 1500;    // じかん ぎれの あと、さいごの すすみが とどくのを まつ
const JK_ROUND = 2200;        // じゃんけん 1かい（「じゃんけん…」1びょう ＋ 手を 見せる）
const JK_SHOW = 2800;         // かった 人を 見せる じかん
const COUNTDOWN = 3000;
const NAME_MAX = 6;

const myId = myMemberId();
let myName = readLocal('tt_name') || '';
let conn = null;
let lastFoe = null;

/* ── 画面の きりかえ ─────────────────────────── */
const SCREENS = ['sTitle', 'sName', 'sSearch', 'sLevel', 'sJanken', 'sGame'];
function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    document.body.dataset.screen = id;
    if (id === 'sGame') setupGameScreen();
}

function say(text, bad) {
    const n = $('notice');
    n.textContent = text;
    n.className = 'notice ' + (bad ? 'bad' : '');
    clearTimeout(say.t);
    say.t = setTimeout(() => n.classList.add('hidden'), 4000);
}

/* ── 万国旗 ─────────────────────────────────── */
(function bunting() {
    const svg = $('bunting');
    const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff', '#00acc1'];
    const NS = 'http://www.w3.org/2000/svg';
    const rope = document.createElementNS(NS, 'path');
    rope.setAttribute('d', 'M0 6 Q250 26 500 8 Q750 26 1000 6');
    rope.setAttribute('stroke', '#7a5a3a'); rope.setAttribute('stroke-width', '1.5'); rope.setAttribute('fill', 'none');
    svg.appendChild(rope);
    const yAt = x => { const u = (x % 500) / 500; return (1 - u) * (1 - u) * 6 + 2 * (1 - u) * u * 26 + u * u * 8; };
    for (let i = 0, x = 12; x < 1000; i++, x += 28) {
        const y = yAt(x);
        const f = document.createElementNS(NS, 'path');
        f.setAttribute('d', `M${x - 10} ${y} L${x + 10} ${y} L${x} ${y + 26} Z`);
        f.setAttribute('fill', colors[i % colors.length]);
        f.setAttribute('stroke', 'rgba(0,0,0,.15)');
        svg.appendChild(f);
    }
})();

/* ── おと ───────────────────────────────────── */
function paintSound() { $('soundBtn').textContent = sound.isOn() ? '🔊' : '🔇'; }
$('soundBtn').addEventListener('click', () => { sound.toggle(); paintSound(); });
paintSound();
function paintMusic() { $('musicBtn').classList.toggle('off', !music.isOn()); }
$('musicBtn').addEventListener('click', () => { music.toggle(); paintMusic(); });
paintMusic();

/* ── せいせき（この 端末に のこします）────────────── */
function record() {
    try { return JSON.parse(readLocal('tt_record') || '{}') || {}; } catch (e) { return {}; }
}
function addRecord(kind) {
    const r = record();
    r[kind] = (r[kind] || 0) + 1;
    writeLocal('tt_record', JSON.stringify(r));
}

/* ── タイトル ───────────────────────────────── */
function goTitle() {
    stopGame();
    $('tName').textContent = myName || '（まだ ないよ）';
    const r = record();
    const total = (r.win || 0) + (r.lose || 0) + (r.draw || 0);
    $('tRecord').textContent = total ? `これまで ${r.win || 0}かち ${r.lose || 0}まけ ${r.draw || 0}ひきわけ` : '';
    show('sTitle');
}

/* なまえが まだ なければ、さきに 入れて もらいます */
let afterName = null;
function needName(then) {
    if (myName) { then(); return; }
    afterName = then;
    openName();
}

const nameOut = $('nameOut');
const hira = createHiraganaKeypad({
    max: NAME_MAX,
    onChange(v) {
        nameOut.textContent = v;
        if (!v) nameOut.innerHTML = '<span class="placeholder">なまえ</span>';
        $('nameOk').disabled = v.length === 0;
    }
});
$('hiraSlot').appendChild(hira.el);

function openName() {
    hira.clear();
    show('sName');
}
$('tNameEdit').addEventListener('click', () => { afterName = null; openName(); });
$('nameBack').addEventListener('click', () => { afterName = null; goTitle(); });
$('nameOk').addEventListener('click', () => {
    myName = hira.getValue();
    writeLocal('tt_name', myName);
    const then = afterName;
    afterName = null;
    if (then) then(); else goTitle();
});

$('btnFind').addEventListener('click', () => needName(goSearch));
$('btnCpu').addEventListener('click', () => needName(goCpuLevel));

/* ── むずかしさの カード ──────────────────────────
   人との たいせん … ことばの むずかしさ 5つ
   コンピューター … つよさ 10（2だんに ならべます）*/
function card(n, chosen, parts, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lvcard l' + n + (n === chosen ? ' on' : '');
    for (const [cls, text] of parts) {
        const el = document.createElement(cls === 'big' ? 'b' : 'span');
        if (cls !== 'big') el.className = cls;
        el.textContent = text;
        b.appendChild(el);
    }
    b.addEventListener('click', () => onPick(n));
    return b;
}

function buildLevelCards(mode, chosen, onPick) {
    const box = $('levels5');
    box.textContent = '';
    box.classList.toggle('ten', mode === 'cpu');
    if (mode === 'cpu') {
        for (const lv of CPU_LEVELS) {
            box.appendChild(card(lv.n, chosen, [
                ['lv-n', 'レベル' + lv.n],
                ['lv-icon', lv.icon],
                ['big', `${lv.perMin}もじ`],
                ['lv-note', '1ぷんに 打つ はやさ'],
                ['lv-who', 'ことば：' + levelOf(lv.words).label]
            ], onPick));
        }
        return;
    }
    for (const lv of LEVELS) {
        box.appendChild(card(lv.n, chosen, [
            ['lv-n', 'レベル' + lv.n],
            ['big', lv.label],
            ['lv-note', lv.note],
            ['lv-who', lv.who]
        ], onPick));
    }
}

/* ══ コンピューターと たいせん ══════════════════════ */
let cpuRun = null;

function goCpuLevel() {
    stopOnline();
    $('lvMe').textContent = myName;
    $('lvFoe').textContent = 'コンピューター';
    $('lvTitle').textContent = 'コンピューターの つよさを えらんでね';
    $('lvHint').textContent = 'レベルが 1つ 上がるごとに 1ぷんに 5もじ はやく なるよ';
    $('lvStatus').textContent = '';
    $('lvBack').textContent = 'もどる';
    $('lvBack').onclick = goTitle;
    const last = Number(readLocal('tt_cpulv')) || 1;
    buildLevelCards('cpu', last, n => { writeLocal('tt_cpulv', n); startCpu(n); });
    show('sLevel');
}

function startCpu(n) {
    stopCpu();
    const lv = cpuLevelOf(n);
    const words = wordList(lv.words, Math.floor(Math.random() * 2147483647));
    const startsAt = Date.now() + 4000;
    const run = { ended: false };
    cpuRun = run;

    const end = (won, draw, reason) => {
        if (run.ended) return;
        run.ended = true;
        run.cpu.stop();
        addRecord(draw ? 'draw' : won ? 'win' : 'lose');
        run.game.showResult({
            won, draw, reason, foe: run.cpu.stats(), endedAt: Date.now(),
            buttons: [
                { label: 'もういちど', cls: 'go', onClick: () => startCpu(n) },
                { label: 'レベルを かえる', onClick: goCpuLevel },
                { label: 'タイトルへ', onClick: () => { stopCpu(); goTitle(); } }
            ]
        });
    };

    show('sGame');
    run.game = startGame({
        words, goal: GOAL, startsAt, endsAt: startsAt + GAME_MS, now: () => Date.now(),
        meName: myName, foeName: 'コンピューター', levelText: `コンピューター レベル${n}（1ぷんに ${lv.perMin}もじ）`,
        onProg() {},
        onGoal: () => end(true, false, 'goal'),
        onTimeUp: () => {
            const me = run.game.myN(), foe = run.cpu.stats().n;
            end(me > foe, me === foe, 'time');
        }
    });
    run.cpu = createCpu({
        words, perMin: lv.perMin, miss: lv.miss,
        onProg(p) {
            if (run.ended) return;
            run.game.setFoe(p);
            if (p.n - run.game.myN() >= GOAL) end(false, false, 'goal');
        }
    });
    run.startTimer = setTimeout(() => { if (!run.ended) run.cpu.start(); }, startsAt - Date.now());
}

function stopCpu() {
    if (!cpuRun) return;
    cpuRun.ended = true;
    clearTimeout(cpuRun.startTimer);
    if (cpuRun.cpu) cpuRun.cpu.stop();
    cpuRun = null;
    stopGame();
}

/* ══ あいてを さがす ════════════════════════════ */
let search = null;

async function goSearch() {
    stopCpu();
    stopOnline();
    const s = { alive: true, hb: null, unAssign: null };
    search = s;
    $('searchTitle').textContent = 'あいてを さがしています…';
    $('searchSub').textContent = 'だれかが「たいせん あいてを さがす」を おすと はじまるよ';
    show('sSearch');
    try {
        conn = await connect();
        if (!s.alive) return;
        const found = await findOrQueue(conn, myId, myName, lastFoe);
        if (!s.alive) {
            /* まっている あいだに「やめる」が おされた */
            if (!found) leaveQueue(conn, myId);
            return;
        }
        if (found) {
            stopSearch(false);
            await createMatch(conn, found.mid, {
                a: found.foe, b: myId, na: found.foeName, nb: myName, createdAt: serverNow(conn)
            });
            enterMatch(found.mid);
            return;
        }
        /* ならんだ。あいてが 見つけて くれるのを まちます */
        s.hb = setInterval(() => heartbeat(conn, myId), HEARTBEAT_MS);
        s.unAssign = watchAssign(conn, myId, a => {
            if (!s.alive || !a || !a.mid) return;
            stopSearch(false);
            leaveQueue(conn, myId);
            enterMatch(a.mid);
        });
    } catch (e) {
        if (!s.alive) return;
        $('searchTitle').textContent = 'つうしんが できませんでした';
        $('searchSub').textContent = (e && e.message) || 'ネットに つながっているか たしかめてね。コンピューターとは たいせん できるよ';
        $('searchTitle').classList.remove('searching');
    }
}

function stopSearch(tellServer) {
    const s = search;
    if (!s) return;
    s.alive = false;
    clearInterval(s.hb);
    if (s.unAssign) s.unAssign();
    search = null;
    if (tellServer && conn) leaveQueue(conn, myId).catch(() => {});
}

$('searchCancel').addEventListener('click', () => { stopSearch(true); goTitle(); });
$('searchCpu').addEventListener('click', () => { stopSearch(true); goCpuLevel(); });

/* ══ 人との たいせん ═══════════════════════════ */
let on = null;          // いまの たいせん（人と）

function enterMatch(mid) {
    stopOnline();
    writeStore('tt_mid', mid);
    const m = {
        mid, match: null, prog: {}, unsub: [], game: null, shownResult: false,
        foeGoneSince: null, choosing: false, jkSpoken: -1, jkPon: -1, jkWinSpoken: false,
        settling: false, timeUpAt: null, cancelled: false, sawFoe: false
    };
    on = m;
    markHere(conn, mid, myId).catch(() => {});
    m.unsub.push(watchMatch(conn, mid, v => { if (on === m) { m.match = v; update(); } }));
    m.unsub.push(watchProg(conn, mid, v => {
        if (on !== m) return;
        m.prog = v;
        if (m.game) m.game.setFoe(v[foeOf(m)] || {});
        if (m.shownResult) refreshResult();
    }));
    m.timer = setInterval(update, 100);
}

function stopOnline() {
    const m = on;
    if (!m) return;
    on = null;
    clearInterval(m.timer);
    for (const off of m.unsub) { try { off(); } catch (e) {} }
    if (m.game) m.game.stop();
    writeStore('tt_mid', '');
}

const foeOf = m => (m.match ? (m.match.a === myId ? m.match.b : m.match.a) : null);
const foeNameOf = m => (m.match ? (m.match.a === myId ? m.match.nb : m.match.na) : '');
const now = () => serverNow(conn);

/* あいてが いなく なった / こなかった とき */
function backToSearch(text) {
    const m = on;
    if (m) leaveMatch(conn, m.mid, myId);
    stopOnline();
    say(text);
    goSearch();
}

/** たいせんの ようすに あわせて 画面を すすめます（0.1びょうごと ＋ データが かわるたび）*/
function update() {
    const m = on;
    if (!m) return;
    const d = m.match;
    if (!d) {
        /* まだ とどいていない か、もう かたづけられた */
        if (m.seen) { if (!m.shownResult) backToSearch('あいてが いなく なったよ。もう一度 さがすね'); }
        return;
    }
    m.seen = true;
    if (d.cancel) { if (!m.cancelled) { m.cancelled = true; backToSearch('あいてが いなく なったよ。もう一度 さがすね'); } return; }

    const t = now();
    const foe = foeOf(m);
    const foeHere = !!(d.here && d.here[foe]);
    if (foeHere) m.sawFoe = true;

    /* あいてが いない */
    if (!foeHere && !d.done) {
        if (m.foeGoneSince == null) m.foeGoneSince = t;
        const waited = t - m.foeGoneSince;
        const neverCame = !m.sawFoe && t - d.createdAt > ARRIVE_MS;
        if ((m.sawFoe && waited > GONE_MS) || neverCame) {
            if (!d.startsAt || t < d.startsAt) {
                changeMatchOnce(conn, m.mid, cur => (cur.cancel || cur.done ? null : { cancel: true }));
            } else if (!m.settling) {
                m.settling = true;
                changeMatchOnce(conn, m.mid, cur => (cur.winner ? null : finish(myId, 'left')))
                    .finally(() => { m.settling = false; });
            }
        }
    } else {
        m.foeGoneSince = null;
    }

    if (!d.janken) { showChoose(m, d, t); return; }
    if (t < d.startsAt - COUNTDOWN) { showJanken(m, d, t); return; }
    showMatchGame(m, d, t);
}

const finish = (winner, reason) => ({ winner, reason, done: true, endedAt: now() });

/* ── むずかしさを えらぶ ─────────────────────────── */
function showChoose(m, d, t) {
    const mine = d.choice && d.choice[myId];
    const theirs = d.choice && d.choice[foeOf(m)];
    if (!m.choosing) {
        m.choosing = true;
        sound.matched();
        $('lvMe').textContent = myName;
        $('lvFoe').textContent = foeNameOf(m);
        $('lvTitle').textContent = 'あいてが みつかった！ どの むずかしさで たいせん したい？';
        $('lvHint').textContent = '2人が えらんだら じゃんけん！ かった 人の むずかしさで たいせん するよ';
        $('lvBack').textContent = 'やめる';
        $('lvBack').onclick = () => {
            const mm = on;
            if (mm) changeMatchOnce(conn, mm.mid, cur => (cur.janken || cur.cancel ? null : { cancel: true }));
            stopOnline();
            goTitle();
        };
        show('sLevel');
    }
    if (m.cards !== (mine || 0)) {
        m.cards = mine || 0;
        buildLevelCards('vs', mine, n => {
            if (!on || on.match.janken) return;
            writeLocal('tt_vslv', n);
            chooseLevel(conn, m.mid, myId, n);
        });
    }
    const left = Math.max(0, Math.ceil((d.createdAt + CHOOSE_MS - t) / 1000));
    $('lvStatus').textContent = (mine ? 'えらんだよ！ ' : `のこり ${left}びょう ・ `)
        + (theirs ? 'あいても えらんだよ！' : 'あいては えらんでいます…');

    /* じかんに なったら じどうで えらびます（まえに えらんだ レベル）*/
    if (!mine && t > d.createdAt + CHOOSE_MS) {
        chooseLevel(conn, m.mid, myId, Number(readLocal('tt_vslv')) || 1);
    }
    /* 2人とも えらんだら じゃんけん（先に 書いた 1回だけ が のこります）*/
    if (mine && theirs && !m.jkAsked) {
        m.jkAsked = true;
        changeMatchOnce(conn, m.mid, makeJanken).finally(() => { if (on === m) m.jkAsked = false; });
    }
}

/* じゃんけんの 手を きめます：g＝ぐー c＝ちょき p＝ぱー */
const HANDS = ['g', 'c', 'p'];
const HAND_EMOJI = { g: '✊', c: '✌️', p: '✋' };
const HAND_NAME = { g: 'ぐー', c: 'ちょき', p: 'ぱー' };
const beats = (x, y) => (x === 'g' && y === 'c') || (x === 'c' && y === 'p') || (x === 'p' && y === 'g');

function makeJanken(cur) {
    if (cur.janken || cur.cancel) return null;
    const ca = cur.choice && cur.choice[cur.a], cb = cur.choice && cur.choice[cur.b];
    if (!ca || !cb) return null;
    const rounds = [];
    let winner = null;
    while (!winner) {
        const ha = HANDS[Math.floor(Math.random() * 3)];
        let hb = HANDS[Math.floor(Math.random() * 3)];
        /* あいこは 4かいまで（ながすぎると あきるので）*/
        if (rounds.length >= 4 && ha === hb) hb = HANDS[(HANDS.indexOf(ha) + 1 + Math.floor(Math.random() * 2)) % 3];
        rounds.push([ha, hb]);
        winner = beats(ha, hb) ? cur.a : beats(hb, ha) ? cur.b : null;
    }
    const at = now() + 700;
    const startsAt = at + rounds.length * JK_ROUND + JK_SHOW + COUNTDOWN;
    return {
        janken: { rounds, winner, at },
        level: cur.choice[winner],
        seed: Math.floor(Math.random() * 2147483647),
        startsAt,
        endsAt: startsAt + GAME_MS
    };
}

/* ── じゃんけん ─────────────────────────────── */
function showJanken(m, d, t) {
    const j = d.janken;
    const iAmA = d.a === myId;
    if (document.body.dataset.screen !== 'sJanken') {
        $('jkMeName').textContent = myName;
        $('jkFoeName').textContent = foeNameOf(m);
        const lvText = id => { const lv = levelOf(d.choice[id]); return `レベル${lv.n} ${lv.label}`; };
        $('jkMeLv').textContent = lvText(myId);
        $('jkFoeLv').textContent = lvText(foeOf(m));
        $('jkResult').innerHTML = '&nbsp;';
        show('sJanken');
    }
    const el = t - j.at;
    const ri = Math.floor(el / JK_ROUND);
    const hands = $('jkMe'), foeHands = $('jkFoe');
    if (el < 0) { $('jkCall').textContent = 'じゃんけんで きめよう！'; return; }
    if (ri < j.rounds.length) {
        const e = el % JK_ROUND;
        const [ha, hb] = j.rounds[ri];
        const mineH = iAmA ? ha : hb, theirH = iAmA ? hb : ha;
        if (m.jkSpoken !== ri) {
            m.jkSpoken = ri;
            sound.speak(ri === 0 ? 'じゃんけん、ぽん！' : 'あいこで、しょ！');
        }
        if (e < 1000) {
            $('jkCall').textContent = ri === 0 ? 'じゃんけん…' : 'あいこで…';
            hands.textContent = foeHands.textContent = '✊';
            hands.classList.add('shake'); foeHands.classList.add('shake');
            $('jkResult').innerHTML = '&nbsp;';
        } else {
            if (m.jkPon !== ri) { m.jkPon = ri; sound.pon(); }
            $('jkCall').textContent = ri === 0 ? 'ぽん！' : 'しょ！';
            hands.classList.remove('shake'); foeHands.classList.remove('shake');
            hands.textContent = HAND_EMOJI[mineH];
            foeHands.textContent = HAND_EMOJI[theirH];
            $('jkResult').textContent = mineH === theirH ? 'あいこ！'
                : `${HAND_NAME[mineH]} と ${HAND_NAME[theirH]}`;
        }
        return;
    }
    /* かった 人を 見せる */
    const won = j.winner === myId;
    const lv = levelOf(d.level);
    const winnerName = won ? myName : foeNameOf(m);
    $('jkCall').textContent = `${winnerName} さんの かち！`;
    $('jkResult').textContent = `レベル${lv.n}「${lv.label}」で たいせん するよ！`;
    if (!m.jkWinSpoken) {
        m.jkWinSpoken = true;
        sound.speak(`${winnerName}さんの、かち！`);
    }
}

/* ── たいせん ───────────────────────────────── */
function showMatchGame(m, d, t) {
    if (!m.game) {
        const lv = levelOf(d.level);
        const restore = m.prog[myId] || null;
        show('sGame');
        m.game = startGame({
            words: wordList(d.level, d.seed),
            goal: GOAL, startsAt: d.startsAt, endsAt: d.endsAt, now,
            meName: myName, foeName: foeNameOf(m), levelText: `レベル${lv.n} ${lv.label}`,
            restore,
            onProg: p => sendProg(conn, m.mid, myId, p),
            onGoal: () => changeMatchOnce(conn, m.mid, cur => (cur.winner ? null : finish(myId, 'goal'))),
            onTimeUp: () => {
                setTimeout(() => {
                    if (on !== m) return;
                    changeMatchOnce(conn, m.mid, cur => {
                        if (cur.winner) return null;
                        const na = cur.a === myId ? m.game.myN() : ((m.prog[cur.a] || {}).n || 0);
                        const nb = cur.b === myId ? m.game.myN() : ((m.prog[cur.b] || {}).n || 0);
                        return finish(na > nb ? cur.a : nb > na ? cur.b : 'draw', 'time');
                    });
                }, DECIDE_GRACE);
            }
        });
        m.game.setFoe(m.prog[foeOf(m)] || {});
    }
    if (d.done && !m.shownResult) {
        m.shownResult = true;
        lastFoe = foeOf(m);
        const won = d.winner === myId, draw = d.winner === 'draw';
        if (d.reason !== 'left') addRecord(draw ? 'draw' : won ? 'win' : 'lose');
        const leave = then => () => { leaveMatch(conn, m.mid, myId); stopOnline(); then(); };
        m.game.showResult({
            won, draw, reason: d.reason, endedAt: d.endedAt,
            foe: m.prog[foeOf(m)] || {},
            buttons: [
                { label: 'もういちど さがす', cls: 'go', onClick: leave(goSearch) },
                { label: 'タイトルへ', onClick: leave(goTitle) }
            ]
        });
    }
}

/* けっかの あとに あいての さいごの 数が とどいたら 書きなおします */
function refreshResult() {
    const m = on;
    if (!m) return;
    const p = m.prog[foeOf(m)] || {};
    $('resN2').textContent = p.n || 0;
    $('resM2').textContent = p.miss || 0;
}

/* ── はじめる ───────────────────────────────── */
async function resume() {
    /* たいせんの とちゅうで 画面を 開きなおした ときは、つづきから */
    const mid = readStore('tt_mid');
    if (!mid || !myName) return false;
    try {
        conn = await connect();
        const snap = await conn.fb.get(conn.fb.ref(conn.db, `tsunahiki/matches/${mid}`));
        const d = snap.val();
        if (!d || d.done || d.cancel || (d.a !== myId && d.b !== myId)) { writeStore('tt_mid', ''); return false; }
        const p = await conn.fb.get(conn.fb.ref(conn.db, `tsunahiki/prog/${mid}`));
        enterMatch(mid);
        on.prog = p.val() || {};
        return true;
    } catch (e) {
        return false;
    }
}

goTitle();
resume();
