/* おえかきの 画面
   あつまる → じゅんばんに かく → けっか はっぴょう。
   かく人には おだいが 見え、ほかの人は ひらがなで こたえます。 */
import { connect, watchMembers, enterRoom, leaveRoom, myMemberId, readStore, writeStore, clearStore,
         sendLive, clearLive, clearLiveOnDisconnect, commitStroke, removeStroke,
         clearBoard, watchStrokes, watchLive, watchInfo, setPhase,
         setupRound, armRound, finishRound, watchRound, markAnswered,
         startGame, watchGame, setTurn, watchScores, addScores,
         removeMember, cancelMyDisconnect, writeSecret, watchSecret,
         updateRound, updateGame, bumpMiss,
         addTeamScore, watchTeamScores,
         sendReact, saveGallery, loadGallery,
         setTelWords, getTel, submitTel, watchTelDone, loadTel } from './firebase.js';
import { createBoard, ERASER, RAINBOW } from './board.js';
import { createHiraganaKeypad } from './keypad.js';
import { TOPICS, pickWord, hashWord, normalize, hintFor, nearHashes, isNear } from './odai.js';
import { scoreRound, teamRoundPoints, TEAMS } from './scoring.js';
import { makeTeams, telSteps, isDrawStep, chainFor } from './tel.js';
import { confetti, toast, floatEmoji } from './effects.js';
import { createStepper } from './stepper.js';
import { sound } from './audio.js';

const $ = id => document.getElementById(id);

/* あそびかたは 2つ。
   じゅんばん … みんなが おなじ かいすう かきます（なんしゅうで きめます）
   ランダム   … つぎに かく人を くじびきで きめます（ぜんたいの 時間で おわります） */
const MODES = [
    { key: 'order',  label: 'じゅんばん', note: 'みんな おなじ かいすう' },
    { key: 'random', label: 'ランダム',   note: 'つぎの 人は くじびき' },
    { key: 'team',   label: 'チームせん', note: 'あか・あおで たいけつ' },
    { key: 'tel',    label: 'でんごん',   note: '絵と ことばを つなぐ' }
];
/* チームせんは 1チーム 2人 いじょう いないと、あてる 人が いなく なります */
const TEAM_MIN = 4;
/* でんごんで「この 絵は なに？」に こたえる 時間（びょう）*/
const TEL_GUESS_SECONDS = 40;
/* リアクション。つづけて おせる 間かく（ミリ秒）*/
const REACTIONS = ['👍', '😂', '😮', '❤️', '👏'];
const REACT_GAP = 600;
/* せんせいが ＋ボタンで のばす 時間（びょう）*/
const ADD_SECONDS = 15;
/* のこり時間の 目立たせかた（のこりの わりあい・びょう）*/
const TIME_HALF = 0.5;        // 半分を きったら きいろ
const TIME_LOW = 0.25;        // 4分の1 か 15びょう で 赤
const TIME_LOW_SEC = 15;
const TIME_CRIT_SEC = 5;      // さいごの 5びょうは 大きな かずで
/* せんせいも 絵を かくか（じゅんばん・ランダムの とき）。
   せんせいは おだいを ぜんぶ 見られるので、こたえる 人には 入りません */
const TEACHER_DRAW = [
    { key: false, label: 'かかない', note: 'こどもだけ かく' },
    { key: true,  label: 'かく',     note: 'じゅんばんに 入る' }
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
$('meName').textContent = isHost ? 'せんせい' : (myName || '');

let conn = null, board = null;
let members = [], game = null, round = null, scores = {}, teamScores = {};
let phase = 'waiting';
/* へやを つくれるのは せんせい だけ。せんせいは ゲームに 入らず、すすめる 役です */
let level = TOPICS[0].key, mode = 'order', laps = 1, teacherDraws = false;
let minutes = DEFAULT_MINUTES, seconds = DEFAULT_SECONDS;
let myWord = null, recent = [];
let arming = false, finishing = false, advancing = false;
/* 音を 二重に 鳴らさない ための おぼえ */
let wasDone = false, wasMyTurn = false, lastTick = -1, resultPlayed = false;
let lastReroll = 0;   /* ぬしから「おだいを かえて」と たのまれた しるし */
let hintWriting = false;
/* もりあげ：もう 見せた せいかい・リアクション */
let seenAnswered = new Set(), seenReacts = new Set(), allCheered = false, lastReactAt = 0;
/* けっかで 見せる 絵（ギャラリー）と でんごんの すじ */
let galleryData = null, telData = null, resultTab = 'rank';
/* でんごん：いまの だんの ようす */
let telDone = {};
let tel = { step: -1, chain: null, prompt: '', img: null, submitted: false, loading: false };
let localN = 0;
/* せんせいの 画面：おだい（せんせい だけ 読める ところ）*/
let secret = null, secretDenied = false;
let tWordHidden = false;
try { tWordHidden = localStorage.getItem('ka_twordhide') === '1'; } catch (e) {}
/* へやから 出された ことに 気づく ため */
let joined = false, kicked = false;
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
const isTeam = () => !!game && game.mode === 'team';
const isTel = () => !!game && game.mode === 'tel';
const teamOf = id => (game && game.teams && game.teams[id]) || null;
const teamInfo = key => TEAMS.find(t => t.key === key) || null;
const colorOf = id => (members.find(m => m.id === id) || {}).color || '#ccc';
const isHostId = id => !!(members.find(m => m.id === id) || {}).isHost;
/* 「はなこ さん」「せんせい」（せんせいには さん を つけません）*/
const whoName = id => isHostId(id) ? 'せんせい' : nameOf(id) + ' さん';
/* この かいで あてる 人（チームせんでは かく人と 同じ チームの 人だけ）*/
const answerTargets = () => {
    if (!round) return [];
    return playerIds().filter(id => id !== round.drawer
        && (!isTeam() || (teamOf(id) && teamOf(id) === teamOf(round.drawer))));
};
const canAnswer = () => !!round && !amDrawer() && !amAdmin()
    && (!isTeam() || (!!teamOf(myId) && teamOf(myId) === teamOf(round.drawer)));
/* せいかいした じゅんばん（1から）。まだなら 0 */
const answerRank = id => {
    const a = (round && round.answered) || {};
    if (!a[id]) return 0;
    return Object.entries(a).sort((x, y) => x[1] - y[1]).findIndex(e => e[0] === id) + 1;
};
/* でんごん：じぶんが なんばんめか（さんか していなければ -1）*/
const telIndex = () => (isTel() && game.order ? game.order.indexOf(myId) : -1);
const telSecondsFor = s => isDrawStep(s) ? ((game && game.seconds) || DEFAULT_SECONDS) : TEL_GUESS_SECONDS;

function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

/* ── あつまった人 ─────────────────────────── */
/* あつまる 画面の 名まえ。あそんで いる あいだは、ほかの 人の ようす（だれが あてたか など）は
   こどもの 画面に 出しません（せんせいの 画面にだけ 出します）*/
function chip(m) {
    const el = document.createElement('div');
    el.className = 'member' + (m.id === myId ? ' me' : '') + (m.online === false ? ' off' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.color || '#ccc';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(m.name || 'だれか'));
    if (m.isHost) {
        const t = document.createElement('span');
        t.className = 'tag';
        t.textContent = 'へやを つくった 人';
        el.appendChild(t);
    }
    return el;
}

function drawMembers() {
    const box = $('membersBig');
    box.textContent = '';
    for (const m of members) box.appendChild(chip(m));
    const here = members.filter(m => m.online !== false && !m.isHost).length;
    $('count').textContent = here === 0 ? 'まだ だれも いません' : here + ' にん あつまりました';
}

/* ── どうぐ ───────────────────────────────── */
const PEN_COLORS = ['#33291f','#e8503a','#f0872a','#f2c12e','#3b86d4','#46a83c','#d45ea0'];
const PEN_WIDTHS = [8, 16, 30];

function buildTools() {
    const sw = $('swatches');
    const pick = (b, g) => { for (const x of g.children) x.classList.remove('on'); b.classList.add('on'); };

    /* どうぐの しゅるい（ペン・バケツ・スタンプ）*/
    const kinds = $('kinds');
    for (const k of [
        { key: 'pen',   icon: '✎', label: 'ペン' },
        { key: 'fill',  icon: '🪣', label: 'ぬる' },
        { key: 'star',  icon: '★', label: 'ほし' },
        { key: 'heart', icon: '♥', label: 'ハート' }
    ]) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'kind'; b.title = k.label;
        const i = document.createElement('b'); i.textContent = k.icon;
        const t = document.createElement('span'); t.textContent = k.label;
        b.append(i, t);
        b.addEventListener('click', () => { board.setTool(k.key); pick(b, kinds); });
        kinds.appendChild(b);
    }
    kinds.firstChild.classList.add('on');

    for (const c of PEN_COLORS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'swatch'; b.style.background = c;
        b.addEventListener('click', () => { board.setColor(c); pick(b, sw); });
        sw.appendChild(b);
    }
    /* にじいろ（ペンは すすむほど 色が かわり、スタンプ・バケツは おすたびに ちがう 色）*/
    const rb = document.createElement('button');
    rb.type = 'button'; rb.className = 'swatch rainbow'; rb.title = 'にじいろ';
    rb.addEventListener('click', () => { board.setColor(RAINBOW); pick(rb, sw); });
    sw.appendChild(rb);

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
    if (!playing) hideTimeFx();

    if (playing && isTel()) { renderTel(); return; }
    $('telImg').classList.add('hidden');
    $('telDoneRow').classList.add('hidden');
    $('answeredCount').classList.add('hidden');
    $('drawerHead').textContent = 'あなたが かく ばんです';
    $('ansHead').textContent = 'なにを かいて いるのかな？';

    const admin = playing && (amAdmin() || isHost);
    const drawer = playing && amDrawer();
    const answerer = playing && !drawer && !admin && canAnswer();
    /* チームせんで あいての チームの ばん／あとから 来た 人は 見て おうえん */
    const watcher = playing && !!round && !drawer && !admin && !answerer;
    const done = !!(round && round.done);

    $('drawerPanel').classList.toggle('hidden', !drawer);
    $('answerPanel').classList.toggle('hidden', !answerer || done || iAnswered() || paused());
    $('adminPanel').classList.toggle('hidden', !admin);
    $('watchPanel').classList.toggle('hidden', !watcher);
    if (watcher) {
        const t = teamInfo(teamOf(round && round.drawer));
        $('watchMsg').textContent = t ? t.label + 'の ばんです' : 'みんなの 絵を 見よう';
        $('watchSub').textContent = teamOf(myId) ? 'おうえんしよう！ 👍 で もりあげてね' : 'みているよ（つぎの ゲームから さんか できます）';
    }
    $('tools').classList.toggle('hidden', !drawer || done);
    $('clear').classList.toggle('hidden', !drawer);
    document.body.classList.toggle('answering', answerer);
    document.body.classList.toggle('teacher', admin);
    document.body.classList.toggle('paused', playing && paused());
    if (board) {
        board.setEnabled(drawer && !done && !paused());
        /* こたえる人は ひらがなキーボード、せんせいは みんなの ようすが 出るので、広めに のこします */
        board.setSideMin(answerer || admin ? 520 : 400);
    }

    /* ヒント（文字の 数と、時間が たつと 見える 文字）*/
    const showHint = playing && round && round.hint && !done;
    $('hint').classList.toggle('hidden', !showHint);
    if (showHint) {
        $('hint').textContent = '';
        const lab = document.createElement('span'); lab.className = 'hintlab'; lab.textContent = 'ヒント';
        const w = document.createElement('b'); w.textContent = [...round.hint].join(' ');
        const n = document.createElement('span'); n.className = 'hintlen'; n.textContent = [...round.hint].length + 'もじ';
        $('hint').append(lab, w, n);
    }

    /* リアクションは 絵を 見ている こどもだけ（かく人・せんせいは おせません）*/
    $('reactBar').classList.toggle('hidden', !playing || drawer || admin || !round || !round.hash);

    /* チームせんの てんすう */
    $('teamBar').classList.toggle('hidden', !playing || !isTeam());
    if (playing && isTeam()) drawTeamBar($('teamBar'));

    /* ボタンは ぜんぶ せんせいが おします */
    const live = playing && isHost && round && round.hash && !done;
    $('nextTurn').classList.toggle('hidden', !playing || !isHost);
    $('nextTurn').textContent = done ? 'つぎの 人へ' : 'つぎの 人に かわる';
    $('changeOdai').classList.toggle('hidden', !live);
    $('addTime').classList.toggle('hidden', !live || paused());
    $('pauseBtn').classList.toggle('hidden', !playing || !isHost);
    $('pauseBtn').textContent = paused() ? 'さいかい' : 'いちじ ていし';
    $('endGame').classList.toggle('hidden', !playing || !isHost);

    if (admin) drawTeacher();

    if (playing && game) {
        const name = round && round.drawer ? nameOf(round.drawer) : '';
        $('turnNo').textContent = isRandom() ? (game.turn + 1) + 'かいめ' : (game.turn + 1) + ' / ' + totalTurns() + 'かいめ';
        $('turnLabel').textContent = drawer ? 'あなたが かく ばん' : name ? whoName(round.drawer) + 'が かく ばん' : 'じゅんびちゅう';
        /* せんせいは 下の はこに 出るので、ここには 出しません */
        $('turnLabel').classList.toggle('hidden', admin);
    }

    /* かく人の ばんは 上の 帯に 出るので、チームせんの ときだけ「だれが あてるか」を 出します */
    $('drawerHead').classList.toggle('hidden', !(drawer && isTeam()));
    if (drawer) {
        /* おだいは 小さく、下の 左はしに。「かくす」を えらんで いれば ● に します
           （まわりの 席から 見えて しまわない ように）*/
        $('odai').textContent = myWord || '…';
        $('odai').classList.toggle('hidden', odaiHidden);
        $('odaiMask').classList.toggle('hidden', !odaiHidden);
        $('hideOdai').textContent = odaiHidden ? 'みる' : 'かくす';
        if (isTeam()) $('drawerHead').textContent = (teamInfo(teamOf(myId)) || {}).label + 'が あてるよ';
    }

    /* せいかいの 人数（だれが あてたかは 出しません）。せんせいは じぶんの はこで 見ます */
    const showCorr = playing && round && round.hash && !admin;
    $('corrStat').classList.toggle('hidden', !showCorr);
    if (showCorr) {
        const n = correctCount();
        $('corrStat').textContent = n === 0 ? 'まだ だれも あてていないよ' : 'せいかい ' + n + 'にん';
    }

    /* しらせ（せいかい・ちがう・こたえの はっぴょう）*/
    const j = $('judge');
    if (playing && done) {
        j.className = 'judge reveal';
        j.textContent = round.word ? 'こたえは「' + round.word + '」でした' : 'この かいは おしまいです';
    } else if (answerer && iAnswered()) {
        j.className = 'judge ok';
        j.textContent = 'せいかい！ ' + (readStore('ka_myans') || '') + '　あなたは ' + answerRank(myId) + 'ばんめ';
    } else if (j.dataset.wrong === 'near') {
        j.className = 'judge near';
        j.textContent = 'おしい！ もうすこし！';
    } else if (j.dataset.wrong === '1') {
        j.className = 'judge ng';
        j.textContent = 'ちがうみたい。もういちど！';
    } else {
        j.className = 'judge hidden';
        j.textContent = '';
    }

    if (result) renderResult();
}

/* この かいの せいかいの 人数（あてる はずの 人の うち）*/
function correctCount() {
    const a = (round && round.answered) || {};
    return Object.keys(a).filter(id => id !== (round && round.drawer)).length;
}

/* チームの てんすうを ならべます（あそんでいる とき・けっか）*/
function drawTeamBar(box) {
    const tot = { red: teamScores.red || 0, blue: teamScores.blue || 0 };
    box.textContent = '';
    TEAMS.forEach((t, i) => {
        if (i) { const vs = document.createElement('span'); vs.className = 'teamvs'; vs.textContent = 'VS'; box.appendChild(vs); }
        const el = document.createElement('span');
        el.className = 'teamscore' + (round && teamOf(round.drawer) === t.key && phase === 'playing' ? ' now' : '');
        el.style.setProperty('--c', t.color);
        const nm = document.createElement('span'); nm.textContent = t.label;
        const sc = document.createElement('b'); sc.textContent = tot[t.key];
        el.append(nm, sc);
        box.appendChild(el);
    });
}

/* ── せんせいの 画面 ───────────────────────────
   いま かいている 人・おだい・せいかいの 人数・つぎの 人と、
   一人ひとりの ようす（だれが あてて、だれが こまっているか）を 出します。
   ここは せんせいの 画面だけ です（こどもの 画面には 出しません）。 */
function drawTeacher() {
    const telMode = isTel();
    const s = telMode ? (game.step || 0) : 0;
    $('tWord').parentElement.classList.toggle('hidden', telMode);
    if (telMode) {
        const doneNow = telDone[s] || {};
        $('tDrawer').previousElementSibling.textContent = 'でんごん';
        $('tDrawer').textContent = (s + 1) + 'だんめ（' + (isDrawStep(s) ? '絵を かく' : 'ことばを いれる') + '）';
        $('tCount').previousElementSibling.textContent = 'できた 人';
        $('tCount').textContent = game.order.filter(id => doneNow[id]).length + ' / ' + game.order.length + 'にん';
        $('tNextRow').classList.add('hidden');
        $('tRuleNote').classList.add('hidden');
    } else {
        const done = !!(round && round.done);
        $('tDrawer').previousElementSibling.textContent = 'かいている 人';
        $('tDrawer').textContent = !round || !round.drawer ? '－' : amDrawer() ? 'せんせい（あなた）' : whoName(round.drawer);
        /* おだい：かく人の タブが せんせい だけ 読める ところに おいた ことば */
        const ok = secret && round && secret.drawer === round.drawer && secret.hash === round.hash;
        const word = ok ? secret.word : (round && round.word) || null;
        let shown;
        /* せんせいが かいて いる ときは、大きく 出さない（テレビに うつして いても 見えない ように）*/
        if (amDrawer() && word) shown = '左下を 見てね';
        else if (tWordHidden && word) shown = '● ● ●';
        else if (word) shown = word;
        else if (round && !round.hash) shown = '（えらんでいます…）';
        else shown = secretDenied ? '？' : '（とどくのを まっています）';
        $('tWord').textContent = shown;
        $('tWordHide').textContent = tWordHidden ? 'みる' : 'かくす';
        $('tWordHide').classList.toggle('hidden', !word || amDrawer());
        $('tRuleNote').classList.toggle('hidden', !secretDenied || !!word);
        $('tCount').previousElementSibling.textContent = 'せいかい';
        const targets = answerTargets();
        $('tCount').textContent = round && round.hash
            ? correctCount() + ' / ' + targets.length + 'にん' + (done ? '（おしまい）' : '')
            : '－';
        /* つぎに かく 人（じゅんばん・チームせん）*/
        const next = nextDrawerPreview();
        $('tNextRow').classList.toggle('hidden', !next);
        if (next) $('tNext').textContent = next;
    }
    $('tListHead').textContent = telMode ? 'みんなの ようす' : 'みんなの ようす（「かく」で かく人を かえられます）';
    drawWatchlist();
}

/* つぎに かく 人の 名まえ（わからない ときは 空）*/
function nextDrawerPreview() {
    if (!game || !game.order || isRandom() || isTel()) return isRandom() ? 'くじびきで きめます' : '';
    const next = game.turn + 1;
    if (next >= totalTurns()) return 'これで さいご';
    const id = game.order[next % game.order.length];
    return id === myId ? 'せんせい（あなた）' : whoName(id);
}

function drawWatchlist() {
    const box = $('watchlist');
    box.textContent = '';
    const answered = (round && round.answered) || {};
    const misses = (round && round.misses) || {};
    const order = Object.entries(answered).sort((a, b) => a[1] - b[1]).map(e => e[0]);
    const telNow = isTel() ? (telDone[game.step] || {}) : null;

    /* せんせい じしん（じゅんばん・ランダムでは「かく」で じぶんが かける）*/
    if (isHost && !telNow && !isTeam()) {
        const row = document.createElement('div');
        const drawingNow = round && round.drawer === myId;
        row.className = 'watchrow self' + (drawingNow ? ' draw' : '');
        const nm = document.createElement('span');
        nm.className = 'nm'; nm.textContent = 'せんせい（あなた）';
        const st = document.createElement('span');
        st.className = 'st'; st.textContent = drawingNow ? 'かいています' : (game && game.teacherDraws ? 'じゅんばんに 入って います' : '');
        row.append(nm, st);
        if (!drawingNow) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'rowbtn'; b.textContent = 'かく';
            b.title = 'せんせいが かく';
            b.addEventListener('click', () => changeDrawer(myId));
            row.appendChild(b);
        }
        box.appendChild(row);
    }

    for (const m of members) {
        if (m.id === adminId() || m.isHost) continue;
        const row = document.createElement('div');
        let cls = 'watchrow';
        let st = 'まだ';
        if (telNow) {
            if (!game.order.includes(m.id)) st = 'みている';
            else if (telNow[m.id]) { cls += ' ok'; st = 'できた！'; }
            else st = isDrawStep(game.step) ? 'かいています' : 'かんがえています';
        }
        else if (round && round.drawer === m.id) { cls += ' draw'; st = 'かいています'; }
        else if (isTeam() && round && teamOf(m.id) !== teamOf(round.drawer)) { st = teamOf(m.id) ? 'おうえん中' : 'みている'; }
        else if (answered[m.id]) { cls += ' ok'; st = (order.indexOf(m.id) + 1) + 'ばんめに せいかい'; }
        if (m.online === false) { cls += ' off'; st = 'はなれて います'; }
        row.className = cls;

        const dot = document.createElement('span');
        dot.className = 'dot'; dot.style.background = m.color || '#ccc';
        const nm = document.createElement('span');
        nm.className = 'nm'; nm.textContent = m.name || 'だれか';
        const tm = teamInfo(teamOf(m.id));
        if (tm) nm.style.color = tm.color;
        const stt = document.createElement('span');
        stt.className = 'st'; stt.textContent = st;
        row.append(dot, nm, stt);

        if (misses[m.id]) {
            const ms = document.createElement('span');
            ms.className = 'miss';
            ms.textContent = '✕' + misses[m.id];
            row.appendChild(ms);
        }
        /* かく人を この 人に かえる（でんごん では つかいません）*/
        /* チームせんでは、チームに 入って いる 人だけ（あとから 来た 人が かくと、あてる 人が いなく なる）*/
        if (!telNow && isHost && m.online !== false && (!round || round.drawer !== m.id) && (!isTeam() || teamOf(m.id))) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'rowbtn'; b.textContent = 'かく';
            b.title = m.name + ' さんに かいて もらう';
            b.addEventListener('click', () => changeDrawer(m.id));
            row.appendChild(b);
        }
        /* へやから 出す（まちがえて 入った 人・のこった 席の かたづけ）*/
        if (isHost) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'rowbtn out'; b.textContent = 'だす';
            b.title = m.name + ' さんを へやから 出す';
            b.addEventListener('click', () => kickMember(m.id));
            row.appendChild(b);
        }
        box.appendChild(row);
    }
    if (!box.querySelector('.watchrow:not(.self)')) {
        const empty = document.createElement('p');
        empty.className = 'count'; empty.textContent = 'まだ だれも いません';
        box.appendChild(empty);
    }
}

/* ── けっか はっぴょう ──────────────────────────
   じゅんい（チームせんは チームの かちまけも）／みんなの 絵／でんごんの すじ */
function renderResult() {
    const telMode = isTel();
    $('resultTitle').textContent = telMode ? 'でんごん はっぴょう' : 'けっか はっぴょう';
    $('resTabs').classList.toggle('hidden', telMode);
    $('tabRank').classList.toggle('on', resultTab === 'rank');
    $('tabGallery').classList.toggle('on', resultTab === 'gallery');
    const showRank = !telMode && resultTab === 'rank';
    $('ranking').classList.toggle('hidden', !showRank);
    $('teamResult').classList.toggle('hidden', !showRank || !isTeam());
    $('gallery').classList.toggle('hidden', telMode || resultTab !== 'gallery');
    $('chains').classList.toggle('hidden', !telMode);
    if (telMode) { renderChains(); return; }
    if (showRank) {
        renderRanking();
        if (isTeam()) renderTeamResult();
    } else {
        renderGallery();
    }
}

function renderTeamResult() {
    const box = $('teamResult');
    const tot = { red: teamScores.red || 0, blue: teamScores.blue || 0 };
    box.textContent = '';
    const win = tot.red === tot.blue ? null : (tot.red > tot.blue ? 'red' : 'blue');
    const msg = document.createElement('p');
    msg.className = 'teamwin';
    msg.textContent = win ? '🏆 ' + teamInfo(win).label + 'の かち！' : 'ひきわけ！ どちらも すごい！';
    if (win) msg.style.color = teamInfo(win).color;
    const bar = document.createElement('div');
    bar.className = 'teambar';
    drawTeamBar(bar);
    box.append(msg, bar);
}

/* みんなの 絵。おすと 大きく 見られます */
let viewerList = [], viewerAt = 0;
function renderGallery() {
    const box = $('gallery');
    box.textContent = '';
    if (!galleryData) { box.textContent = 'よみこみ中…'; return; }
    const list = Object.entries(galleryData)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(e => e[1]).filter(g => g && g.img);
    if (!list.length) { box.textContent = 'のこっている 絵が ありません'; return; }
    viewerList = list;
    list.forEach((g, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'gcard';
        const t = teamInfo(g.team);
        if (t) card.style.borderColor = t.color;
        const img = document.createElement('img');
        img.src = g.img; img.alt = g.word || 'え';
        const w = document.createElement('b');
        w.textContent = g.word || '？';
        const who = document.createElement('span');
        who.className = 'gwho';
        const dot = document.createElement('span');
        dot.className = 'dot'; dot.style.background = colorOf(g.drawer);
        who.append(dot, document.createTextNode(nameOf(g.drawer)));
        card.append(img, w, who);
        const r = reactText(g.reacts);
        if (r) { const re = document.createElement('span'); re.className = 'greact'; re.textContent = r; card.appendChild(re); }
        card.addEventListener('click', () => openViewer(i));
        box.appendChild(card);
    });
}
const reactText = map => Object.entries(map || {}).sort((a, b) => b[1] - a[1]).map(([e, n]) => e + n).join(' ');

function openViewer(i) {
    if (!viewerList.length) return;
    viewerAt = (i + viewerList.length) % viewerList.length;
    const g = viewerList[viewerAt];
    $('viewerImg').src = g.img;
    $('viewerCap').textContent = (g.word ? '「' + g.word + '」' : '') + '　かいた人：' + nameOf(g.drawer)
        + (reactText(g.reacts) ? '　' + reactText(g.reacts) : '');
    $('viewerPrev').classList.toggle('hidden', viewerList.length < 2);
    $('viewerNext').classList.toggle('hidden', viewerList.length < 2);
    $('viewer').classList.remove('hidden');
}

/* でんごんの すじを 1本ずつ ならべます。
   さいごの ことばが はじめの おだいに もどって いれば 大せいこう！ */
function renderChains() {
    const box = $('chains');
    box.textContent = '';
    if (!telData || !game || !game.order) { box.textContent = 'よみこみ中…'; return; }
    const order = game.order, steps = game.steps || 0;
    let back = 0;
    order.forEach((ownerId, c) => {
        const ch = telData[c] || {};
        const row = document.createElement('div');
        row.className = 'chain';
        const head = document.createElement('div');
        head.className = 'chainhead';
        const dot = document.createElement('span');
        dot.className = 'dot'; dot.style.background = colorOf(ownerId);
        head.append(dot, document.createTextNode(nameOf(ownerId) + ' さんから スタート'));
        const line = document.createElement('div');
        line.className = 'chainline';
        const word = document.createElement('div');
        word.className = 'cword start';
        word.textContent = ch.word || '？';
        line.appendChild(word);
        let lastText = null;
        for (let st = 0; st < steps; st++) {
            const e = (ch.steps && ch.steps[st]) || {};
            const arrow = document.createElement('span');
            arrow.className = 'carrow'; arrow.textContent = '→';
            line.appendChild(arrow);
            const cell = document.createElement('div');
            if (isDrawStep(st)) {
                cell.className = 'cimg';
                if (e.img) { const im = document.createElement('img'); im.src = e.img; im.alt = 'え'; cell.appendChild(im); }
                else cell.textContent = '（まにあわなかった）';
            } else {
                cell.className = 'cword';
                cell.textContent = e.text || '？';
                lastText = e.text || '';
            }
            const by = document.createElement('small');
            by.textContent = nameOf(e.by);
            cell.appendChild(by);
            line.appendChild(cell);
        }
        const ok = lastText !== null && ch.word && normalize(lastText) === normalize(ch.word);
        if (ok) back++;
        const res = document.createElement('div');
        res.className = 'cresult' + (ok ? ' ok' : '');
        res.textContent = ok ? '🎉 もどった！' : '🤔 どこで かわった かな？';
        head.appendChild(res);
        row.append(head, line);
        box.appendChild(row);
    });
    const sum = document.createElement('p');
    sum.className = 'chainsum';
    sum.textContent = order.length + 'ほんの うち ' + back + 'ほんが もとの ことばに もどりました';
    box.prepend(sum);
}

/* ── でんごんの 画面 ─────────────────────────── */
function renderTel() {
    const s = game.step || 0;
    const me = telIndex();
    const admin = amAdmin() || isHost;
    const drawStep = isDrawStep(s);
    const doing = me >= 0 && !tel.submitted && tel.step === s && !tel.loading;
    const drawing = doing && drawStep;
    const guessing = doing && !drawStep;
    const doneNow = telDone[s] || {};
    const doneN = game.order.filter(id => doneNow[id]).length;

    $('turnNo').textContent = 'でんごん ' + (s + 1) + ' / ' + (game.steps || 0) + 'だん';
    $('turnLabel').textContent = drawStep ? '絵を かく' : 'なにかな？';
    $('turnLabel').classList.toggle('hidden', admin);     /* せんせいは 下の はこに 出ます */
    $('drawerHead').classList.remove('hidden');
    $('drawerPanel').classList.toggle('hidden', !drawing);
    $('telDoneRow').classList.toggle('hidden', !drawing);
    $('drawerHead').textContent = s === 0 ? 'おだいを 絵に しよう！' : 'まわってきた ことばを 絵に しよう！';
    $('answeredCount').classList.remove('hidden');
    $('answeredCount').textContent = 'できた 人 ' + doneN + ' / ' + game.order.length;
    $('corrStat').classList.add('hidden');
    $('answerPanel').classList.toggle('hidden', !guessing || paused());
    $('ansHead').textContent = 'この 絵は なにかな？';
    $('adminPanel').classList.toggle('hidden', !admin);
    const waitingMe = !admin && !drawing && !guessing;
    $('watchPanel').classList.toggle('hidden', !waitingMe);
    if (waitingMe) {
        $('watchMsg').textContent = me < 0 ? 'でんごん ちゅう…' : tel.loading ? 'じゅんび ちゅう…' : 'できた！ みんなを まってね';
        $('watchSub').textContent = 'できた 人 ' + doneN + ' / ' + game.order.length;
    }
    $('tools').classList.toggle('hidden', !drawing);
    $('clear').classList.toggle('hidden', !drawing);
    $('hint').classList.add('hidden');
    $('reactBar').classList.add('hidden');
    $('teamBar').classList.add('hidden');
    $('judge').className = 'judge hidden';
    document.body.classList.toggle('answering', guessing);
    document.body.classList.toggle('teacher', admin);
    document.body.classList.toggle('paused', paused());

    /* 「この 絵は なに？」の ときは、まわってきた 絵を 上に かさねます */
    const showImg = guessing;
    $('telImg').classList.toggle('hidden', !showImg);
    if (showImg && tel.img && $('telImg').getAttribute('src') !== tel.img) $('telImg').src = tel.img;
    if (showImg && !tel.img) {
        $('hint').classList.remove('hidden');
        $('hint').textContent = '絵が とどかなかったよ。すきな ことばを いれてね';
    }
    if (board) {
        board.setEnabled(drawing && !paused());
        board.setSideMin(guessing || admin ? 520 : 400);
    }
    if (drawing) {
        $('odai').textContent = tel.prompt || '（じゅんびちゅう…）';
        $('odai').classList.toggle('hidden', odaiHidden);
        $('odaiMask').classList.toggle('hidden', !odaiHidden);
        $('hideOdai').textContent = odaiHidden ? 'みる' : 'かくす';
    }

    /* せんせいの ボタン */
    $('nextTurn').classList.toggle('hidden', !isHost);
    $('nextTurn').textContent = 'つぎの だんへ';
    $('changeOdai').classList.add('hidden');
    $('addTime').classList.toggle('hidden', !isHost || paused());
    $('pauseBtn').classList.toggle('hidden', !isHost);
    $('pauseBtn').textContent = paused() ? 'さいかい' : 'いちじ ていし';
    $('endGame').classList.toggle('hidden', !isHost);

    if (admin) drawTeacher();
}

function renderRanking() {
    const box = $('ranking');
    box.textContent = '';
    const list = members
        .filter(m => !m.isHost && m.id !== adminId())
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

/* ── のこり時間 ───────────────────────────────
   のこりが すくなく なるほど 目立たせます。
     ふつう → 半分を きると きいろ → 4分の1（か 15びょう）で 赤・大きく
     → さいごの 5びょうは 絵の 上に 大きな かず ＋ 音
   絵の 上の バーも、へるにつれて みどり → きいろ → 赤 に かわります。 */
function paintTime(leftMs, totalMs) {
    const left = Math.max(0, Math.ceil(leftMs / 1000));
    const ratio = Math.max(0, Math.min(1, leftMs / Math.max(totalMs, leftMs, 1)));
    const stage = left <= TIME_CRIT_SEC ? 'crit'
        : (ratio <= TIME_LOW || left <= TIME_LOW_SEC) ? 'low'
        : ratio <= TIME_HALF ? 'half' : 'ok';
    $('timer').textContent = 'のこり ' + left + 'びょう';
    $('timer').className = 'timer t-' + stage;
    $('timebar').className = 'timebar t-' + stage;
    $('timebarFill').style.width = (ratio * 100).toFixed(1) + '%';
    const big = stage === 'crit' && left > 0;
    $('bigCount').classList.toggle('hidden', !big);
    if (big && $('bigCount').textContent !== String(left)) {
        $('bigCount').textContent = left;
        /* かずが かわる たびに ぽんと 大きく */
        $('bigCount').classList.remove('pop'); void $('bigCount').offsetWidth; $('bigCount').classList.add('pop');
    }
    /* のこり 5びょうから、1びょうごとに 小さく 鳴らします */
    if (left <= TIME_CRIT_SEC && left > 0 && left !== lastTick) { lastTick = left; sound.tick(); }
    if (left > TIME_CRIT_SEC) lastTick = -1;
    return left;
}
function hideTimeFx() {
    $('timebar').classList.add('hidden');
    $('bigCount').classList.add('hidden');
    $('timer').className = 'timer';
}

setInterval(() => {
    if (phase !== 'playing') { $('timer').textContent = '－'; $('clock').textContent = ''; hideTimeFx(); return; }

    /* いちじ ていし中は 時間を 止めます */
    if (paused()) {
        $('timer').textContent = 'いちじ ていし';
        $('timer').className = 'timer';
        $('bigCount').classList.add('hidden');
        $('clock').textContent = '';
        return;
    }

    /* でんごんは みんな 同時に すすむので、だんごとの 時間だけ です */
    if (isTel()) { telTick(); return; }

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
                archiveRound().then(() => setPhase(conn, code, 'result')).catch(() => {}).finally(() => { advancing = false; });
            } catch (e) {
                advancing = false;
            }
        }
    } else {
        $('clock').textContent = '';
    }

    /* 1かいの のこり時間 */
    if (!round || !round.endsAt) { $('timer').textContent = '－'; hideTimeFx(); return; }
    if (round.done) { $('timer').textContent = 'おしまい'; hideTimeFx(); return; }
    const left = paintTime(round.endsAt - Date.now(), ((game && game.seconds) || DEFAULT_SECONDS) * 1000);
    if (left === 0 && amDrawer()) endRound();

    writeHint();
    watchdog();
}, 300);

/* ── ヒント（かく人の タブだけが 書きます）─────────────
   ことばを 知って いるのは かく人の タブだけ なので、ここで 作って くばります。
   いちじ ていしで 時間が のびても、のこり時間から 計算するので ずれません。 */
function writeHint() {
    if (!conn || !amDrawer() || !myWord || !round || !round.hash || round.done || hintWriting) return;
    const total = ((game && game.seconds) || DEFAULT_SECONDS) * 1000;
    const frac = 1 - Math.max(0, round.endsAt - Date.now()) / total;
    const h = hintFor(myWord, frac);
    if (h === round.hint) return;
    hintWriting = true;
    updateRound(conn, code, { hint: h }).catch(() => {}).finally(() => { hintWriting = false; });
}

/* ── ギャラリーに のこす（ぬしの タブだけ）───────────
   つぎの かいに すすむ まえに、ぬしが じぶんの 画面の 絵を 小さな 画像に して のこします。
   ぬしは かならず いて、みんなと 同じ 絵を 見て いるからです。 */
async function archiveRound() {
    if (!conn || !isHost || !game || isTel() || !round || !round.hash || !board || board.count() === 0) return;
    /* かく人を とちゅうで かえても 上書き しない ように、時こくを 名まえに します */
    const key = Date.now();
    try {
        const tally = {};
        for (const r of Object.values(round.reacts || {})) if (r && r.e) tally[r.e] = (tally[r.e] || 0) + 1;
        await saveGallery(conn, code, key, {
            drawer: round.drawer,
            word: round.word || null,
            img: board.snapshot(),
            reacts: Object.keys(tally).length ? tally : null,
            team: teamOf(round.drawer)
        });
    } catch (e) { /* のこせなくても ゲームは つづけます */ }
}

/* ── でんごんの 時計（みんなの タブ）──────────────── */
function telTick() {
    const s = game.step || 0;
    $('clock').textContent = '';
    const left = paintTime((game.stepEndsAt || Date.now()) - Date.now(), telSecondsFor(s) * 1000);

    /* じぶんの だんが かわったら、まわってきた ものを とりに いきます */
    if (tel.step !== s) telEnter(s);

    /* 時間に なったら、そこまでの 絵や ことばを だします */
    if (left === 0 && telIndex() >= 0 && !tel.submitted && !tel.loading && tel.step === s) telSubmit(true);

    /* ぬし：ぜんいん できたか、時間が すぎたら つぎの だんへ */
    if (isHost && !advancing) {
        /* はなれて いる 人は まちません（その 人の ぶんは telAdvance が うめます）*/
        const doneNow = telDone[s] || {};
        const here = game.order.filter(id => onlineIds().includes(id));
        const all = here.length > 0 && here.every(id => doneNow[id]);
        const late = Date.now() > (game.stepEndsAt || 0) + STUCK_END_MS;
        if (all || late) telAdvance();
    }
}

/* あたらしい だんに なった ときの じゅんび */
async function telEnter(s) {
    tel = { step: s, chain: null, prompt: '', img: null, submitted: false, loading: true };
    board.clearAll();
    myStrokes.length = 0;
    ansPad.clear();
    const i = telIndex();
    render();
    if (i < 0 || !conn) { tel.loading = false; render(); return; }
    const c = chainFor(i, s, game.order.length);
    tel.chain = c;
    tel.submitted = !!(telDone[s] && telDone[s][myId]);
    try {
        if (s === 0) tel.prompt = (await getTel(conn, code, c + '/word')) || '？';
        else {
            const prev = (await getTel(conn, code, c + '/steps/' + (s - 1))) || {};
            if (isDrawStep(s)) tel.prompt = prev.text || '？';
            else tel.img = prev.img || null;
        }
    } catch (e) {
        say('まわってきた ものを よみこめませんでした', true);
    }
    if (tel.step !== s) return;          /* とちゅうで つぎの だんに なった */
    tel.loading = false;
    if (isDrawStep(s)) sound.yourTurn();
    render();
}

/* 絵 または ことばを だします（auto は 時間ぎれで じどうで だす とき）*/
async function telSubmit(auto) {
    if (!conn || tel.submitted || tel.loading || tel.chain === null || tel.step !== game.step) return;
    const s = tel.step;
    let entry;
    if (isDrawStep(s)) entry = { img: board.count() ? board.snapshot(480) : null };
    else entry = { text: normalize(ansPad.getValue()) || '？' };
    tel.submitted = true;
    render();
    try {
        await submitTel(conn, code, tel.chain, s, myId, entry);
        if (!auto) sound.ok();
    } catch (e) {
        tel.submitted = false;
        say('だせませんでした。もう一度 おしてください', true);
        render();
    }
}

/* ぬし：まだの 人の ぶんを うめて、つぎの だんへ（さいごなら はっぴょう）*/
async function telAdvance() {
    if (!conn || !isTel() || advancing) return;
    advancing = true;
    try {
        const s = game.step || 0, n = game.order.length;
        const doneNow = telDone[s] || {};
        for (let i = 0; i < n; i++) {
            const id = game.order[i];
            if (doneNow[id]) continue;
            await submitTel(conn, code, chainFor(i, s, n), s, id, isDrawStep(s) ? { img: null } : { text: '？' });
        }
        if (s + 1 >= (game.steps || 0)) await setPhase(conn, code, 'result');
        else await updateGame(conn, code, { step: s + 1, stepEndsAt: Date.now() + telSecondsFor(s + 1) * 1000 });
    } catch (e) {
        say('つぎの だんに いけませんでした', true);
    } finally {
        advancing = false;
    }
}

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
        const hash = hashWord(word);
        await armRound(conn, code, hash, (game && game.seconds) || DEFAULT_SECONDS,
                       nearHashes(word), hintFor(word, 0));
        /* せんせい だけが 読める ところに ことばを おきます（ルールが まだなら ことわられるだけ）*/
        writeSecret(conn, code, { word, drawer: myId, hash, at: Date.now() }).catch(() => {});
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
        await addTeamPoints();
        await finishRound(conn, code, myWord);
    } catch (e) {
        say('てんすうを つけられませんでした', true);
    } finally {
        finishing = false;
    }
}

/* チームせん：かいた人の チームに、あてた 人の わりあいで てんすうを たします */
async function addTeamPoints() {
    const team = teamOf(round && round.drawer);
    if (!isTeam() || !team) return;
    const targets = answerTargets();
    const answered = (round && round.answered) || {};
    const pts = teamRoundPoints(targets.filter(id => answered[id]).length, targets.length);
    if (pts) await addTeamScore(conn, code, team, pts);
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
        await addTeamPoints();
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
        await archiveRound();
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
    /* せんせいも かく ときは、くじに せんせいも 入れます */
    const here = playerIds().concat(game && game.teacherDraws && onlineIds().includes(adminId()) ? [adminId()] : []);
    const now = round ? round.drawer : null;
    const pool = here.length > 1 ? here.filter(id => id !== now) : here;
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ぜんいんが あてたら、かく人の タブが この かいを おわらせます */
function checkAllAnswered() {
    if (!amDrawer() || !round || round.done || !round.hash) return;
    const others = answerTargets();
    if (!others.length) return;
    const answered = round.answered || {};
    if (others.every(id => answered[id])) endRound();
}

/* ── くみたて ─────────────────────────────── */
board = createBoard({
    base: $('base'),
    overlay: $('overlay'),
    onProgress(stroke) { if (conn && !isTel()) sendLive(conn, code, myId, stroke).catch(() => {}); },
    async onFinish(stroke) {
        /* でんごんの 絵は じぶんだけの もの。できた！ まで だれにも 送りません */
        if (isTel()) {
            const id = 'L' + (++localN);
            board.addStroke(id, stroke);
            myStrokes.push(id);
            return;
        }
        if (!conn) return;
        try { myStrokes.push(await commitStroke(conn, code, stroke)); }
        catch (e) { say('線を おくれませんでした', true); }
        finally { clearLive(conn, code, myId).catch(() => {}); }
    }
});
buildTools();
buildReactions();
buildChooser('levels', TOPICS, it => { level = it.key; });
buildChooser('modes', MODES, it => {
    mode = it.key;
    /* じゅんばんなら「なんしゅう」、ランダムなら「ぜんたいの じかん」*/
    $('lapRow').classList.toggle('hidden', mode !== 'order' && mode !== 'team');
    $('minRow').classList.toggle('hidden', mode !== 'random');
    /* せんせいが かけるのは じゅんばん・ランダムだけ（チームせん・でんごんは こどもだけ）*/
    $('tDrawRow').classList.toggle('hidden', mode !== 'order' && mode !== 'random');
});
buildChooser('laps', LAP_CHOICES, it => { laps = it.n; });
buildChooser('tDraws', TEACHER_DRAW, it => { teacherDraws = it.key; });
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

/* リアクションの ボタン（絵の 右下に かさねます）*/
function buildReactions() {
    const bar = $('reactBar');
    for (const e of REACTIONS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'react'; b.textContent = e;
        b.addEventListener('click', () => {
            const now = Date.now();
            if (!conn || !round || now - lastReactAt < REACT_GAP) return;
            lastReactAt = now;
            sendReact(conn, code, myId, e).catch(() => {});
        });
        bar.appendChild(b);
    }
}

/* せいかい・リアクションの もりあげ。
   さいしょに 見た ときに もう あった ものは 出しません（読みこみ なおした とき など）*/
function cheer(r, fresh) {
    const box = document.querySelector('.board-wrap');
    const answered = (r && r.answered) || {};
    const order = Object.entries(answered).sort((a, b) => a[1] - b[1]).map(e => e[0]);
    for (const id of order) {
        if (seenAnswered.has(id)) continue;
        seenAnswered.add(id);
        if (fresh || phase !== 'playing') continue;
        const rank = order.indexOf(id) + 1;
        if (id === myId) {
            confetti({ from: 'center' });
        } else {
            /* だれが あてたかは 出さず、なんにんめ かだけ しらせます */
            toast(box, rank + 'にんめの せいかい！', '#46a83c');
            if (r.drawer === myId) sound.ok();
        }
    }
    for (const [k, v] of Object.entries((r && r.reacts) || {})) {
        if (seenReacts.has(k)) continue;
        seenReacts.add(k);
        if (!fresh && v && v.e && phase === 'playing') floatEmoji(box, v.e);
    }
    /* ぜんいん あてたら みんなで おいわい */
    const targets = answerTargets();
    if (r && r.done && !allCheered && targets.length && targets.every(id => answered[id])) {
        allCheered = true;
        if (!fresh) { toast(box, 'ぜんいん せいかい！ 🎉', '#46a83c'); confetti({ count: 70 }); }
    }
}

/* おだいが かわったら、こたえの 入力を まっさらに もどします */
let lastRoundId = null;
function onRound(r) {
    const id = r ? (r.drawer + ':' + (r.startedAt || 0)) : null;
    const fresh = id !== lastRoundId;
    if (fresh) {
        lastRoundId = id;
        ansPad.clear();
        $('judge').dataset.wrong = '';
        clearStore('ka_myans');
        if (r && r.drawer !== myId) myWord = null;
        seenAnswered = new Set(); seenReacts = new Set(); allCheered = false;
    }
    /* ── 音 ──────────────────────────────── */
    const nowDone = !!(r && r.done);
    if (nowDone && !wasDone) sound.roundEnd();
    wasDone = nowDone;

    const myTurn = !!(r && r.drawer === myId && r.hash && !r.done);
    if (myTurn && !wasMyTurn) sound.yourTurn();
    wasMyTurn = myTurn;

    round = r;
    cheer(r, fresh && !!(r && r.startedAt) && Date.now() - r.startedAt > 4000);
    /* 画面を 読みこみ なおしたときは、おぼえている ことばを つかいます */
    if (round && round.drawer === myId && round.hash && !myWord) {
        const kept = readStore('ka_word');
        if (kept && hashWord(kept) === round.hash) {
            myWord = kept;
            writeSecret(conn, code, { word: kept, drawer: myId, hash: round.hash, at: Date.now() }).catch(() => {});
        }
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

        watchMembers(c, code, list => {
            members = list;
            /* せんせいに へやから 出された */
            if (list.some(m => m.id === myId)) joined = true;
            else if (joined && !kicked) { kicked = true; onKicked(); return; }
            drawMembers(); render();
        });
        if (isHost) {
            watchSecret(c, code, v => { secret = v; secretDenied = false; render(); },
                        () => { secretDenied = true; render(); });
        }
        watchInfo(c, code, info => {
            phase = info.phase || 'waiting';
            if (phase === 'result' && !resultPlayed) {
                resultPlayed = true; sound.fanfare(); confetti();
                resultTab = 'rank'; galleryData = null; telData = null;
                loadResultData();
            }
            if (phase !== 'result') { resultPlayed = false; $('viewer').classList.add('hidden'); }
            if (phase !== 'playing') {
                /* でんごんの とちゅうで おわった ときの じぶんだけの 絵を のこさない */
                if (tel.step >= 0) { board.clearAll(); myStrokes.length = 0; }
                tel.step = -1;
            }
            render();
            if (phase === 'playing') requestAnimationFrame(() => board.refit());
        });
        watchGame(c, code, g => {
            game = g;
            /* けっかの 画面で 読みこみ なおした とき、game が あとから とどく ことが あります */
            if (phase === 'result' && (isTel() ? !telData : !galleryData)) loadResultData();
            render(); armIfMine();
        });
        watchTelDone(c, code, d => { telDone = d; render(); drawMembers(); });
        watchRound(c, code, onRound);
        watchScores(c, code, s => { scores = s; drawMembers(); render(); });
        watchTeamScores(c, code, t => { teamScores = t; render(); });
        watchStrokes(c, code, (id, st) => board.addStroke(id, st), id => board.dropStroke(id));
        watchLive(c, code, map => board.setLive(map, myId));

        hideSay();
    } catch (e) {
        say(e.message || 'つうしんが できませんでした', true);
    }
})();

/* けっかで 見せる 絵を とりに いきます（大きいので、けっかに なった ときだけ）*/
let resultLoading = false;
async function loadResultData() {
    if (!conn || !game || resultLoading) return;      /* game が まだなら、とどいた ときに もう一度 よばれます */
    resultLoading = true;
    try {
        if (isTel()) telData = await loadTel(conn, code);
        else galleryData = await loadGallery(conn, code);
    } catch (e) {
        galleryData = galleryData || {}; telData = telData || {};
    } finally {
        resultLoading = false;
    }
    render();
}

/* ── ボタン ───────────────────────────────── */
$('start').addEventListener('click', async () => {
    if (!conn) return;
    $('start').disabled = true;
    try {
        const admin = myId;          /* へやを つくった せんせいは ゲームに 入りません */
        const players = shuffle(onlineIds().filter(id => id !== admin));
        if (!players.length) {
            throw new Error('まだ だれも 入って いません');
        }
        if (mode === 'tel') {
            /* でんごん：1人 1つずつ おだいを くばって、みんな 同時に かきはじめます */
            if (players.length < 2) throw new Error('でんごんは 2にん いじょう で あそべます');
            const words = {};
            let used = [];
            players.forEach((id, c) => { const w = pickWord(level, used); used.push(w); words[c] = w; });
            await startGame(conn, code, {
                mode, order: players, seconds, admin, steps: telSteps(players.length),
                stepEndsAt: Date.now() + seconds * 1000
            });
            await setTelWords(conn, code, words);
            await clearBoard(conn, code);
            await setPhase(conn, code, 'playing');
            return;
        }
        let order = players, teams = null;
        const withTeacher = teacherDraws && (mode === 'order' || mode === 'random');
        if (withTeacher) order = shuffle([...players, admin]);
        if (mode === 'team') {
            if (players.length < TEAM_MIN) throw new Error('チームせんは ' + TEAM_MIN + 'にん いじょう で あそべます');
            ({ order, teams } = makeTeams(players));
        }
        await startGame(conn, code, {
            mode, order, seconds, admin, teams, teacherDraws: withTeacher,
            laps: mode === 'order' || mode === 'team' ? laps : null,
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
    (isTel() ? telHurry() : advance()).finally(() => { $('nextTurn').disabled = false; }); });

/* でんごん：ぬしが「つぎの だんへ」を おしたら、時間を いま おわりに します。
   まだの 人の 画面が とちゅうまでの 絵や ことばを だしてから、つぎへ すすみます。 */
async function telHurry() {
    if (!conn || !game) return;
    if ((game.stepEndsAt || 0) <= Date.now()) { await telAdvance(); return; }   /* 2回目は すぐ すすむ */
    try { await updateGame(conn, code, { stepEndsAt: Date.now() }); } catch (e) { say('できませんでした', true); }
}

$('endGame').addEventListener('click', async () => {
    if (!conn || !confirm('ここで おわりに しますか？')) return;
    try { await archiveRound(); await setPhase(conn, code, 'result'); } catch (e) { say('おわれませんでした', true); }
});

/* けっかの タブ（じゅんい ／ みんなの え）*/
$('tabRank').addEventListener('click', () => { resultTab = 'rank'; render(); });
$('tabGallery').addEventListener('click', () => { resultTab = 'gallery'; render(); });
$('viewerClose').addEventListener('click', () => $('viewer').classList.add('hidden'));
$('viewerPrev').addEventListener('click', () => openViewer(viewerAt - 1));
$('viewerNext').addEventListener('click', () => openViewer(viewerAt + 1));
$('viewer').addEventListener('click', e => { if (e.target === $('viewer')) $('viewer').classList.add('hidden'); });

/* でんごん：絵が できた */
$('telDone').addEventListener('click', () => telSubmit(false));

$('again').addEventListener('click', async () => {
    if (!conn) return;
    try { await setPhase(conn, code, 'waiting'); } catch (e) { say('もどれませんでした', true); }
});

$('ansGo').addEventListener('click', async () => {
    const guess = ansPad.getValue();
    if (isTel()) { if (guess) telSubmit(false); return; }
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
        $('judge').dataset.wrong = isNear(guess, round.hash, round.near) ? 'near' : '1';
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
            if (round && round.endsAt && !isTel()) await updateRound(conn, code, { endsAt: round.endsAt + delta });
            const patch = { pausedAt: null };
            if (game.endsAt) patch.endsAt = game.endsAt + delta;
            if (game.stepEndsAt) patch.stepEndsAt = game.stepEndsAt + delta;
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
    if (id && isTel()) { board.dropStroke(id); return; }
    if (!id || !conn) return;
    try { await removeStroke(conn, code, id); } catch (e) { myStrokes.push(id); }
});

$('clear').addEventListener('click', async () => {
    if (isTel()) { if (confirm('ぜんぶ けしますか？')) { board.clearAll(); myStrokes.length = 0; } return; }
    if (!conn || !confirm('ぜんぶ けしますか？')) return;
    try { await clearBoard(conn, code); myStrokes.length = 0; }
    catch (e) { say('けせませんでした', true); }
});

$('leave').addEventListener('click', async () => {
    /* せんせいが でると、だれも すすめられなく なります */
    if (isHost && phase !== 'waiting' && !confirm('せんせいが でると、ゲームが すすまなく なります。でますか？')) return;
    $('leave').disabled = true;
    try { if (conn) { await clearLive(conn, code, myId); await leaveRoom(conn, code, myId); } } catch (e) {}
    clearStore('ka_room'); clearStore('ka_host'); clearStore('ka_word');
    location.href = 'index.html';
});

/* ── せんせいの そうさ ───────────────────────── */

/* かく人を いま すぐ この 人に かえます（いまの 絵は ギャラリーに のこします）*/
async function changeDrawer(id) {
    if (!conn || !isHost || !game || isTel() || advancing) return;
    if (!confirm(id === myId ? 'せんせいが かきますか？' : whoName(id) + 'に かいて もらいますか？')) return;
    advancing = true;
    try {
        await archiveRound();
        await setupRound(conn, code, id, round ? round.level : level);
    } catch (e) {
        say('かく人を かえられませんでした', true);
    } finally {
        advancing = false;
    }
}

/* のこり時間を ふやします（でんごんは いまの だん）*/
$('addTime').addEventListener('click', async () => {
    if (!conn || !game) return;
    $('addTime').disabled = true;
    try {
        if (isTel()) await updateGame(conn, code, { stepEndsAt: Math.max(game.stepEndsAt || 0, Date.now()) + ADD_SECONDS * 1000 });
        else if (round && round.endsAt && !round.done) {
            await updateRound(conn, code, { endsAt: Math.max(round.endsAt, Date.now()) + ADD_SECONDS * 1000 });
        }
    } catch (e) {
        say('のばせませんでした', true);
    } finally {
        $('addTime').disabled = false;
    }
});

/* へやから 出します。出された 人の 画面は はじめの 画面に もどります */
async function kickMember(id) {
    if (!conn || !isHost) return;
    if (!confirm(nameOf(id) + ' さんを へやから 出しますか？')) return;
    try { await removeMember(conn, code, id); }
    catch (e) { say('だせませんでした', true); }
}

/* せんせいの おだいを かくす ／ みる（テレビに うつして いる ときの ため）*/
$('tWordHide').addEventListener('click', () => {
    tWordHidden = !tWordHidden;
    try { localStorage.setItem('ka_twordhide', tWordHidden ? '1' : '0'); } catch (e) {}
    render();
});

/* じぶんが へやから 出された とき */
async function onKicked() {
    say('せんせいが へやから 出しました。はじめの 画面に もどります', true);
    try { if (conn) { await cancelMyDisconnect(conn, code, myId); await clearLive(conn, code, myId); } } catch (e) {}
    clearStore('ka_room'); clearStore('ka_host'); clearStore('ka_word');
    setTimeout(() => { location.href = 'index.html'; }, 2500);
}
