/* ふたりで 数字あて ― 画面
   ------------------------------------------------------------------
   画面： home（はじめ）・join（番号で 入る）・rules（遊び方）
          lobby（部屋）・secret（ひみつの 数字を きめる）・play（コール）・result（結果）
          solo（ひとりで 練習）・soloEnd
   友だちと 遊ぶ ときの 画面は、部屋の meta と ログ（logic.js の reduce）から 決まります。
   ------------------------------------------------------------------ */
import * as L from './logic.js';
import * as N from './net.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (name, cls = '') => `<img class="emo ${cls}" src="assets/emoji/${name}.webp" alt="" draggable="false">`;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* むし */ } };

const STAMPS = ['むずかしい…', 'いい感じ！', 'やるね！', 'ちょっと待って', 'はやく〜', 'ぜったい当てる'];

/* ── この 端末に のこす もの ──────────────── */
const PREF_KEY = 'kz_prefs';
const prefs = (() => {
    const d = { name: '', best: {} };
    try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch (e) { return d; }
})();
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* むし */ } };

/* ── じょうたい ─────────────────────────── */
const S = {
    screen: 'home',
    err: '', busy: false,
    joinCode: '',
    rulesBack: 'home',
    // 友だちと
    online: false, code: '', role: '', meta: null, presence: {},
    game: -1, log: [], st: null,
    unsubs: [], logUnsub: null,
    answered: new Set(), revealSent: false, resultSent: false,
    verify: { host: 'wait', guest: 'wait' },
    prevTurn: null,
    // コール・メモ（勝負ごとに リセット）
    input: '', memo: {}, tab: 'mine',
    secretDraft: '',
    sheet: null,           // 'menu' | 'stamp' | null
    toasts: [], shownStamps: new Set(),
    showLog: false,
    // ひとりで
    solo: null
};

const me = () => S.role;
const op = () => L.other(S.role);
const nameOf = r => {
    if (!S.meta) return '';
    const n = S.meta[r + 'Name'];
    return n || (r === S.role ? 'あなた' : 'あいて');
};
const opName = () => nameOf(op()) + (S.meta && S.meta[op() + 'Name'] ? 'さん' : '');

/* ── 描画 ──────────────────────────────── */
let raf = 0;
function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
}

function currentScreen() {
    if (!S.online) return S.screen;
    if (S.screen === 'rules') return 'rules';
    if (!S.meta) return 'connecting';
    if (S.meta.status !== 'play') return 'lobby';
    if (!S.st || S.game !== S.meta.game) return 'connecting';
    return { secret: 'secret', play: 'play', end: 'result' }[S.st.phase];
}

function draw() {
    const scr = currentScreen();
    const list = app.querySelector('.history');
    const keep = list ? { top: list.scrollTop, atEnd: list.scrollTop + list.clientHeight >= list.scrollHeight - 8, n: list.children.length } : null;
    const html = ({
        home: vHome, join: vJoin, rules: vRules, connecting: vConnecting,
        lobby: vLobby, secret: vSecret, play: vPlay, result: vResult,
        solo: vPlay, soloEnd: vSoloEnd
    }[scr] || vHome)();
    app.innerHTML = html + vSheet() + vToasts();
    app.dataset.screen = scr;
    const nl = app.querySelector('.history');
    if (nl) {
        if (!keep || keep.atEnd || nl.children.length !== keep.n) nl.scrollTop = nl.scrollHeight;
        else nl.scrollTop = keep.top;
    }
    const nameIn = app.querySelector('#name');
    if (nameIn) nameIn.value = prefs.name;
}

/* ── 部品 ──────────────────────────────── */
const digitsBoxes = (s, n, cls = '') => {
    let h = '';
    for (let i = 0; i < n; i++) h += `<span class="dg ${cls}">${s[i] !== undefined ? esc(s[i]) : ''}</span>`;
    return `<span class="dgs">${h}</span>`;
};
const errBox = () => (S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : '');

function keypad(value, n, { action = 'call', actionLabel = 'コール', actionOk = true, memo = false } = {}) {
    const k = d => {
        const used = value.includes(d);
        const m = memo ? (S.memo[d] || 0) : 0;
        return `<button class="key ${m === 1 ? 'm-no' : m === 2 ? 'm-yes' : ''}" data-act="key" data-d="${d}" ${used || value.length >= n ? 'disabled' : ''}>${d}</button>`;
    };
    return `<div class="keypad">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k).join('')}
      <button class="key sub" data-act="back" ${value ? '' : 'disabled'}>けす</button>
      ${k('0')}
      <button class="key go" data-act="${action}" ${value.length === n && actionOk ? '' : 'disabled'}>${actionLabel}</button>
    </div>`;
}

function memoStrip() {
    let h = '';
    for (let d = 0; d <= 9; d++) {
        const m = S.memo[d] || 0;
        h += `<button class="memo m${m}" data-act="memo" data-d="${d}" aria-label="${d} のメモ">${d}</button>`;
    }
    return `<div class="memo-row"><span class="memo-lbl">メモ</span><div class="memo-btns">${h}</div></div>`;
}

const hb = (h, b) => `<span class="hb"><b class="hit">${h}</b><small>ヒット</small><b class="blow">${b}</b><small>ブロー</small></span>`;

/** 自分の 数字に たいする コール（どこが あたったか 色で 見せる） */
function coloredGuess(g, secret) {
    return `<span class="dgs">${g.split('').map((d, i) => {
        const c = secret ? (secret[i] === d ? 'c-hit' : secret.includes(d) ? 'c-blow' : 'c-miss') : '';
        return `<span class="dg sm ${c}">${d}</span>`;
    }).join('')}</span>`;
}

function scoreText() {
    const r = (S.meta && S.meta.results) || {};
    const t = { host: 0, guest: 0, draw: 0 };
    for (const v of Object.values(r)) if (t[v] !== undefined) t[v]++;
    return t;
}

/* ── ホーム ─────────────────────────────── */
function vHome() {
    return `<div class="page home">
      ${img('detective', 'hero')}
      <h1>ふたりで<br>数字あて</h1>
      <p class="lead">相手のひみつの数字を、先に当てた方の勝ち。<br>それぞれのスマホで遊べます。</p>
      <label class="field">あなたの名前
        <input id="name" maxlength="8" autocomplete="nickname" placeholder="例：ひろ">
      </label>
      <button class="btn primary" data-act="create" ${S.busy ? 'disabled' : ''}>部屋をつくる</button>
      <button class="btn" data-act="goJoin">番号で入る</button>
      <div class="row2">
        <button class="btn ghost" data-act="solo">ひとりで練習</button>
        <button class="btn ghost" data-act="rules">遊び方</button>
      </div>
      ${S.busy ? '<p class="note">つないでいます…</p>' : ''}
      ${errBox()}
      ${N.useFake ? '<p class="note">ためしモード（?fake）：同じブラウザのタブどうしでつながります</p>' : ''}
    </div>`;
}

function vJoin() {
    return `<div class="page join">
      <div class="top"><button class="link" data-act="home">もどる</button></div>
      <label class="field">あなたの名前
        <input id="name" maxlength="8" autocomplete="nickname" placeholder="例：あい">
      </label>
      <h2>部屋の番号を入れてください</h2>
      <p class="note">相手の画面に出ている4けたの番号です</p>
      <div class="code-in">${digitsBoxes(S.joinCode, 4, 'big')}</div>
      ${keypadJoin()}
      ${S.busy ? '<p class="note">つないでいます…</p>' : ''}
      ${errBox()}
    </div>`;
}
function keypadJoin() {
    const v = S.joinCode;
    const k = d => `<button class="key" data-act="jkey" data-d="${d}" ${v.length >= 4 ? 'disabled' : ''}>${d}</button>`;
    return `<div class="keypad">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k).join('')}
      <button class="key sub" data-act="jback" ${v ? '' : 'disabled'}>けす</button>
      ${k('0')}
      <button class="key go" data-act="join" ${v.length === 4 && !S.busy ? '' : 'disabled'}>入る</button>
    </div>`;
}

function vRules() {
    return `<div class="page rules">
      <div class="top"><button class="link" data-act="rulesBack">もどる</button></div>
      <h2>遊び方</h2>
      <ol class="rule-list">
        <li>ふたりとも、<b>0〜9のちがう数字</b>で3けた（または4けた）の<b>ひみつの数字</b>を決めます。0から始まってもOKです。</li>
        <li>交互に、相手の数字を予想して<b>コール</b>します。</li>
        <li>コールすると、相手のスマホが自動で答えます。
          <div class="ex"><span><b class="hit">ヒット</b>…数字も場所も合っている</span><span><b class="blow">ブロー</b>…数字はあるけど場所がちがう</span></div>
          <div class="ex2">例：ひみつ ${digitsBoxes('427', 3, 'sm')} にコール ${digitsBoxes('472', 3, 'sm')} → ${hb(1, 2)}</div>
        </li>
        <li>先に全部ヒットにした方の勝ち。<br>先攻が当てたら、後攻にも<b>最後の1回</b>があり、後攻も当てたら引き分けです。</li>
        <li>先攻は1回ごとに交代します。</li>
      </ol>
      <h3>メモ</h3>
      <p>画面の「メモ」の数字をタップすると、<span class="memo m1 inline">✕</span>（ない）→ <span class="memo m2 inline">○</span>（ある）→ なし と切りかわります。キーの色にも出ます。</p>
      <h3>ずるはできません</h3>
      <p>ひみつの数字は自分のスマホの中だけにあり、相手には送りません。勝負が終わったら数字を見せ合い、答えがまちがっていなかったかを自動で確かめます。</p>
    </div>`;
}

function vConnecting() {
    return `<div class="page center"><p class="note">つないでいます…</p>${errBox()}
      <button class="btn ghost" data-act="leave">やめる</button></div>`;
}

/* ── 部屋 ──────────────────────────────── */
function digitSeg() {
    const d = S.meta ? S.meta.digits : 3;
    return `<div class="seg" role="group" aria-label="けた数">
      <button class="${d === 3 ? 'on' : ''}" data-act="digits" data-n="3">3けた<small>かんたん</small></button>
      <button class="${d === 4 ? 'on' : ''}" data-act="digits" data-n="4">4けた<small>じっくり</small></button>
    </div>`;
}

function vLobby() {
    const m = S.meta;
    const guestIn = !!m.guest;
    const onl = r => (S.presence[r] ? '<i class="dot on"></i>' : '<i class="dot"></i>');
    return `<div class="page lobby">
      <div class="top"><button class="link" data-act="leaveAsk">部屋を出る</button></div>
      ${S.role === 'host' ? `
        <p class="note">この番号を相手に伝えてください</p>
        <div class="room-code">${digitsBoxes(S.code, 4, 'big')}</div>
        <button class="btn" data-act="share">招待リンクを送る</button>
      ` : `<p class="note">部屋 ${esc(S.code)} に入りました</p>`}
      <ul class="members">
        <li>${onl('host')}${esc(nameOf('host'))}${S.role === 'host' ? '（あなた）' : ''}</li>
        <li>${guestIn ? `${onl('guest')}${esc(nameOf('guest'))}${S.role === 'guest' ? '（あなた）' : ''}` : '<i class="dot wait"></i><span class="muted">相手を待っています…</span>'}</li>
      </ul>
      <h3>けた数</h3>
      ${digitSeg()}
      <button class="btn primary" data-act="start" ${guestIn ? '' : 'disabled'}>はじめる</button>
      ${errBox()}
    </div>`;
}

/* ── 勝負の 上の 帯 ───────────────────────── */
function gameBar() {
    if (S.screen === 'solo' && !S.online) {
        return `<div class="bar"><button class="link" data-act="soloQuit">やめる</button>
          <span class="bar-mid">ひとりで練習・${S.solo.digits}けた</span><span class="bar-r">${S.solo.guesses.length}回</span></div>`;
    }
    const t = scoreText();
    const dot = S.presence[op()] ? '' : '<i class="dot off" title="接続が切れています"></i>';
    return `<div class="bar"><button class="link" data-act="menu">メニュー</button>
      <span class="bar-mid">第${S.meta.game}戦・${S.meta.gd}けた</span>
      <span class="bar-r">${t[me()]} - ${t[op()]} ${dot}${esc(nameOf(op()))}</span></div>`;
}

function offlineNote() {
    if (!S.online || S.presence[op()]) return '';
    return `<p class="warn">${esc(opName())}の接続が切れています。もどってくるのを待っています…</p>`;
}

/* ── ひみつの 数字 ─────────────────────────── */
function vSecret() {
    const st = S.st, n = st.digits;
    const mine = N.loadSecret(S.code, S.game);
    const done = !!st.commits[me()];
    const opDone = !!st.commits[op()];
    if (done) {
        return `<div class="page game">${gameBar()}
          <div class="secret-done">
            ${img('locked', 'mid')}
            ${mine ? `<p>あなたの数字</p><div>${digitsBoxes(mine.s, n, 'big')}</div>` : '<p class="warn">この端末にあなたの数字が残っていません。メニューから「こうさん」してください。</p>'}
            <p class="wait-msg">${opDone ? 'はじまります…' : `${esc(opName())}が数字を決めるのを待っています…`}</p>
          </div>
          ${offlineNote()}${errBox()}
        </div>${''}`;
    }
    return `<div class="page game">${gameBar()}
      <div class="secret-head">
        ${img('locked', 'sm')}
        <div><h2>ひみつの数字を決めてください</h2>
        <p class="note">0〜9のちがう数字を${n}つ。相手には送りません。</p></div>
      </div>
      <div class="input-line">${digitsBoxes(S.secretDraft, n, 'big')}</div>
      <p class="note center">${S.st.first === me() ? 'この勝負はあなたが先攻です' : `この勝負は${esc(opName())}が先攻です`}・${opDone ? `${esc(opName())}は決めました` : `${esc(opName())}は考え中`}</p>
      <div class="spacer"></div>
      <button class="btn ghost slim" data-act="randomSecret">おまかせで決める</button>
      ${keypad(S.secretDraft, n, { action: 'commit', actionLabel: '決定', actionOk: !S.busy })}
      ${offlineNote()}${errBox()}
    </div>`;
}

/* ── コール ─────────────────────────────── */
function vPlay() {
    const solo = !S.online;
    let n, myGuesses, theirGuesses = [], status, canCall, pendingMine = null, mySecret = null;
    if (solo) {
        n = S.solo.digits;
        myGuesses = S.solo.guesses;
        status = `${img('thinking-face', 'xs')}<span>数字をえらんでコール！</span>`;
        canCall = true;
    } else {
        const st = S.st;
        n = st.digits;
        myGuesses = st.guesses[me()];
        theirGuesses = st.guesses[op()];
        const sec = N.loadSecret(S.code, S.game);
        mySecret = sec && sec.s;
        const myTurn = st.turn === me() && !st.pending;
        canCall = myTurn && !S.busy;
        if (st.pending && st.pending.by === me()) pendingMine = st.pending.g;
        if (st.pending) status = `<span class="spin"></span><span>${st.pending.by === me() ? `${esc(opName())}のスマホが答えています…` : `${esc(opName())}が「${esc(st.pending.g)}」をコール`}</span>`;
        else if (myTurn) status = `${img('thinking-face', 'xs')}<span>${st.lastChance ? `<b>最後のチャンス！</b> ${esc(opName())}は当てました` : '<b>あなたの番</b>です。コールしてください'}</span>`;
        else status = `<span class="spin"></span><span>${esc(opName())}が考えています…${st.lastChance ? '（最後のチャンス）' : ''}</span>`;
    }
    const mineRows = myGuesses.map((x, i) => `<li class="${x.h === n ? 'win' : ''}"><span class="no">${i + 1}</span>${digitsBoxes(x.g, n, 'sm')}${hb(x.h, x.b)}</li>`).join('')
        + (pendingMine ? `<li class="pending"><span class="no">${myGuesses.length + 1}</span>${digitsBoxes(pendingMine, n, 'sm')}<span class="hb muted">確認中…</span></li>` : '');
    const theirRows = theirGuesses.map((x, i) => `<li class="${x.h === n ? 'win' : ''}"><span class="no">${i + 1}</span>${coloredGuess(x.g, mySecret)}${hb(x.h, x.b)}</li>`).join('');
    const tab = solo ? 'mine' : S.tab;
    const empty = tab === 'mine' ? '<li class="empty">まだコールしていません</li>' : '<li class="empty">まだコールされていません</li>';
    return `<div class="page game">${gameBar()}
      <div class="status ${canCall && !solo ? 'mine' : ''}">${status}</div>
      ${solo ? '' : `<div class="tabs" role="tablist">
        <button class="${tab === 'mine' ? 'on' : ''}" data-act="tab" data-t="mine">あなたのコール<small>${myGuesses.length}</small></button>
        <button class="${tab === 'theirs' ? 'on' : ''}" data-act="tab" data-t="theirs">${esc(nameOf(op()))}のコール<small>${theirGuesses.length}</small></button>
      </div>`}
      ${tab === 'theirs' ? `<div class="my-secret">あなたの数字 ${digitsBoxes(mySecret || '', n, 'sm mine')}</div>` : ''}
      <ul class="history">${(tab === 'mine' ? mineRows : theirRows) || empty}</ul>
      ${memoStrip()}
      <div class="input-row">
        <div class="input-line">${digitsBoxes(S.input, n, 'big')}</div>
        ${solo ? '' : '<button class="btn ghost slim" data-act="stamp">ひとこと</button>'}
      </div>
      ${keypad(S.input, n, { actionOk: canCall, memo: true })}
      ${solo ? '' : offlineNote()}${errBox()}
    </div>`;
}

/* ── 結果 ──────────────────────────────── */
function vResult() {
    const st = S.st, n = st.digits;
    const w = st.winner;
    const t = scoreText();
    let head, pic;
    if (w === 'draw') { pic = 'two-hearts'; head = '引き分け！'; }
    else if (w === me()) { pic = 'trophy'; head = 'あなたの勝ち！'; }
    else { pic = 'trophy'; head = `${esc(opName())}の勝ち`; }
    const sub = st.surrender
        ? (st.surrender === me() ? 'あなたがこうさんしました' : `${esc(opName())}がこうさんしました`)
        : [me(), op()].map(r => `${r === me() ? 'あなた' : esc(opName())}：${st.solved[r] ? `${st.solved[r]}回で当てた` : '当てられず'}`).join('　');
    const sec = r => {
        const rv = r === me() ? (N.loadSecret(S.code, S.game) || st.reveals[r]) : st.reveals[r];
        const v = S.verify[r];
        const mark = r === op() && rv ? (v === 'ok' ? '<span class="ok">答えに まちがいなし</span>' : v === 'bad' ? '<span class="ng">答えにまちがいがありました</span>' : '') : '';
        return `<div class="reveal-row"><span>${r === me() ? 'あなたの数字' : `${esc(nameOf(op()))}の数字`}</span>${rv ? digitsBoxes(rv.s, n, 'sm') : '<span class="muted">待っています…</span>'}${mark}</div>`;
    };
    const nextFirst = st.first === 'host' ? 'guest' : 'host';
    const logs = S.showLog ? `<div class="replay">
        <div><h4>あなたのコール</h4><ul>${st.guesses[me()].map((x, i) => `<li><span class="no">${i + 1}</span>${coloredGuess(x.g, st.reveals[op()] && st.reveals[op()].s)}${hb(x.h, x.b)}</li>`).join('') || '<li class="muted">なし</li>'}</ul></div>
        <div><h4>${esc(nameOf(op()))}のコール</h4><ul>${st.guesses[op()].map((x, i) => `<li><span class="no">${i + 1}</span>${coloredGuess(x.g, (N.loadSecret(S.code, S.game) || {}).s)}${hb(x.h, x.b)}</li>`).join('') || '<li class="muted">なし</li>'}</ul></div>
      </div>` : '';
    return `<div class="page game result">${gameBar()}
      <div class="result-head">${img(pic, 'big')}<h2>${head}</h2><p class="note">${sub}</p></div>
      <div class="reveal">${sec(me())}${sec(op())}</div>
      <div class="tally">通算　あなた <b>${t[me()]}</b> − <b>${t[op()]}</b> ${esc(nameOf(op()))}${t.draw ? `（引き分け ${t.draw}）` : ''}</div>
      <button class="btn ghost slim" data-act="toggleLog">${S.showLog ? 'ふりかえりを閉じる' : 'ふりかえりを見る'}</button>
      ${logs}
      <h3>つぎの勝負</h3>
      ${digitSeg()}
      <button class="btn primary" data-act="again">もう1回（先攻：${nextFirst === me() ? 'あなた' : esc(opName())}）</button>
      ${offlineNote()}${errBox()}
    </div>`;
}

/* ── ひとりで 練習の 結果 ─────────────────────── */
function vSoloEnd() {
    const s = S.solo, n = s.digits;
    const cnt = s.guesses.length;
    const best = prefs.best[n];
    return `<div class="page result">
      <div class="result-head">${img('trophy', 'big')}<h2>${cnt}回で当てました！</h2>
      <p class="note">${s.newBest ? 'じこベスト更新！' : best ? `じこベスト：${best}回` : ''}</p></div>
      <div class="reveal"><div class="reveal-row"><span>ひみつの数字</span>${digitsBoxes(s.secret, n, 'sm')}</div></div>
      <ul class="history static">${s.guesses.map((x, i) => `<li><span class="no">${i + 1}</span>${coloredGuess(x.g, s.secret)}${hb(x.h, x.b)}</li>`).join('')}</ul>
      <div class="seg">
        <button data-act="soloStart" data-n="3">3けたでもう1回</button>
        <button data-act="soloStart" data-n="4">4けたでもう1回</button>
      </div>
      <button class="btn ghost" data-act="home">はじめの画面へ</button>
    </div>`;
}

/* ── シート（メニュー・ひとこと）・トースト ────────── */
function vSheet() {
    if (!S.sheet) return '';
    let body = '';
    if (S.sheet === 'menu') {
        const playing = S.st && S.st.phase !== 'end';
        body = `<button class="btn" data-act="rulesFromGame">遊び方</button>
          ${playing ? '<button class="btn" data-act="surrender">こうさんする</button>' : ''}
          <button class="btn danger" data-act="leave">部屋を出る</button>`;
    } else if (S.sheet === 'leave') {
        body = `<p>${S.role === 'host' ? '部屋を出ると、部屋がなくなります。' : '部屋を出ます。'}よろしいですか？</p>
          <button class="btn danger" data-act="leave">部屋を出る</button>`;
    } else if (S.sheet === 'surrender') {
        body = `<p>こうさんすると、この勝負は${esc(opName())}の勝ちになります。</p>
          <button class="btn danger" data-act="surrenderYes">こうさんする</button>`;
    } else if (S.sheet === 'stamp') {
        body = `<div class="stamps">${STAMPS.map((m, i) => `<button class="stamp" data-act="sendStamp" data-i="${i}">${esc(m)}</button>`).join('')}</div>`;
    }
    return `<div class="sheet-bg" data-act="closeSheet"></div>
      <div class="sheet" role="dialog">${body}<button class="btn ghost" data-act="closeSheet">とじる</button></div>`;
}
function vToasts() {
    return `<div class="toasts">${S.toasts.map(t => `<div class="toast ${t.mine ? 'mine' : ''}">${esc(t.text)}</div>`).join('')}</div>`;
}
function toast(text, mine = false) {
    const t = { text, mine, id: Math.random() };
    S.toasts.push(t);
    render();
    setTimeout(() => { S.toasts = S.toasts.filter(x => x !== t); render(); }, 2600);
}

/* ── 友だちと：つなぐ ───────────────────────── */
async function enterRoom(code, role) {
    S.online = true; S.code = code; S.role = role; S.meta = null; S.presence = {};
    S.game = -1; S.log = []; S.st = null; S.err = ''; S.sheet = null;
    S.screen = 'room';
    history.replaceState(null, '', location.pathname + (N.useFake ? '?fake' : ''));
    render();
    S.unsubs.push(await N.watchMeta(code, onMeta));
    S.unsubs.push(await N.watchOnline(code, v => { S.presence = v; render(); }));
}

function exitRoom(msg = '') {
    S.unsubs.forEach(f => { try { f(); } catch (e) { /* むし */ } });
    S.unsubs = [];
    if (S.logUnsub) { try { S.logUnsub(); } catch (e) { /* むし */ } S.logUnsub = null; }
    S.online = false; S.meta = null; S.st = null; S.code = ''; S.role = '';
    S.screen = 'home'; S.sheet = null; S.err = msg;
    render();
}

function onMeta(m) {
    if (m === undefined) return;   // 読めなかった（つうしん）。そのまま 待つ
    if (!m) { N.saveRoom(null); exitRoom(S.role === 'guest' ? '相手が部屋を出たので、部屋がなくなりました' : ''); return; }
    if (S.role === 'guest' && m.guest !== N.memberId()) { N.saveRoom(null); exitRoom('部屋から出ました'); return; }
    const prev = S.meta;
    S.meta = m;
    if (S.role === 'host' && prev && !prev.guest && m.guest) { buzz(80); toast(`${m.guestName || 'あいて'}さんが入りました`); }
    if (prev && prev.guest && !m.guest && S.role === 'host') toast('相手が部屋を出ました');
    if (m.status === 'play' && m.game !== S.game) newGame(m.game);
    else if (S.st) recompute();
    render();
}

function newGame(game) {
    if (S.logUnsub) { try { S.logUnsub(); } catch (e) { /* むし */ } S.logUnsub = null; }
    S.game = game; S.log = [];
    S.answered = new Set(); S.revealSent = false; S.resultSent = false;
    S.verify = { host: 'wait', guest: 'wait' };
    S.input = ''; S.memo = {}; S.tab = 'mine'; S.secretDraft = ''; S.showLog = false; S.prevTurn = null;
    S.sheet = null; S.err = '';
    recompute();
    const code = S.code;
    N.watchLog(code, game, (i, v) => {
        if (S.code !== code || S.game !== game) return;
        S.log[i] = v;
        recompute();
        render();
    }).then(un => { if (S.game === game) S.logUnsub = un; else un(); });
}

function recompute() {
    if (!S.meta) return;
    S.st = L.reduce(S.log, { first: S.meta.first, digits: S.meta.gd || S.meta.digits });
    afterLog();
}

/** ログが かわった あとに、自分の 端末が する こと（自動で 答える・数字を 見せる・結果を のこす） */
function afterLog() {
    const st = S.st, code = S.code, game = S.game;
    const mine = N.loadSecret(code, game);
    // 相手の コールに 答える
    if (st.phase === 'play' && st.pending && st.pending.by === op() && !S.answered.has(st.pending.i) && mine) {
        S.answered.add(st.pending.i);
        const j = L.judge(mine.s, st.pending.g);
        N.appendLog(code, game, st.length, { k: 'r', by: me(), h: j.h, b: j.b })
            .catch(e => { S.answered.delete(st.pending && st.pending.i); S.err = e.message; render(); });
    }
    // 自分の 番に なったら ふるえる
    const turnKey = st.phase === 'play' && st.turn === me() && !st.pending ? 'me' + st.guesses[me()].length : '';
    if (turnKey && turnKey !== S.prevTurn) buzz(40);
    S.prevTurn = turnKey;
    // ひとこと
    for (const s of st.stamps) {
        if (S.shownStamps.has(game + ':' + s.i)) continue;
        S.shownStamps.add(game + ':' + s.i);
        if (s.by !== me() && Date.now() - s.t < 20000) toast(`${nameOf(s.by)}：${s.m}`);
    }
    if (st.phase === 'end') {
        if (!S.revealSent && mine && !st.reveals[me()]) {
            S.revealSent = true;
            N.appendLog(code, game, st.length, { k: 'v', by: me(), s: mine.s, salt: mine.salt }).catch(() => { S.revealSent = false; });
        }
        if (S.role === 'host' && !S.resultSent && !(S.meta.results && S.meta.results['g' + game])) {
            S.resultSent = true;
            N.updateMeta(code, { ['results/g' + game]: st.winner }).catch(() => { S.resultSent = false; });
        }
        for (const r of L.ROLES) {
            if (st.reveals[r] && S.verify[r] === 'wait') {
                S.verify[r] = 'checking';
                L.verify(st, r).then(v => { if (S.game === game) { S.verify[r] = v; render(); } });
            }
        }
    }
}

/* ── ひとりで 練習 ─────────────────────────── */
function soloStart(n) {
    S.online = false;
    S.solo = { digits: n, secret: L.randomSecret(n), guesses: [], newBest: false };
    S.input = ''; S.memo = {}; S.err = '';
    S.screen = 'solo';
    render();
}

/* ── さわった とき ───────────────────────── */
const actions = {
    async create() {
        if (S.busy) return;
        S.busy = true; S.err = ''; render();
        try {
            const code = await N.createRoom(prefs.name, 3);
            await enterRoom(code, 'host');
        } catch (e) { S.err = e.message; }
        S.busy = false; render();
    },
    goJoin() { S.screen = 'join'; S.err = ''; render(); },
    home() { S.screen = 'home'; S.err = ''; S.joinCode = ''; render(); },
    jkey(el) { if (S.joinCode.length < 4) S.joinCode += el.dataset.d; S.err = ''; render(); },
    jback() { S.joinCode = S.joinCode.slice(0, -1); render(); },
    async join() {
        if (S.busy || S.joinCode.length !== 4) return;
        S.busy = true; S.err = ''; render();
        try {
            await N.joinRoom(S.joinCode, prefs.name);
            await enterRoom(S.joinCode, 'guest');
            S.joinCode = '';
        } catch (e) { S.err = e.message; }
        S.busy = false; render();
    },
    rules() { S.rulesBack = 'home'; S.screen = 'rules'; render(); },
    rulesFromGame() { S.rulesBack = 'room'; S.sheet = null; S.screen = 'rules'; render(); },
    rulesBack() { S.screen = S.online ? 'room' : S.rulesBack; render(); },
    solo() { soloStart(3); },
    soloStart(el) { soloStart(Number(el.dataset.n)); },
    soloQuit() { S.screen = 'home'; S.solo = null; render(); },
    async share() {
        const url = new URL(location.href);
        url.search = (N.useFake ? '?fake&' : '?') + 'room=' + S.code;
        const text = `数字あてで遊ぼう！ 部屋の番号は ${S.code} です`;
        try {
            if (navigator.share) { await navigator.share({ title: 'ふたりで数字あて', text, url: url.href }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(`${text}\n${url.href}`); toast('リンクをコピーしました', true); } catch (e) { toast('コピーできませんでした。番号を伝えてください', true); }
    },
    digits(el) {
        const n = Number(el.dataset.n);
        if (S.meta && S.meta.digits !== n) N.updateMeta(S.code, { digits: n }).catch(e => { S.err = e.message; render(); });
    },
    async start() {
        S.err = '';
        try { await N.startGame(S.code, S.meta.game); } catch (e) { S.err = e.message; render(); }
    },
    again() { actions.start(); },
    leaveAsk() { S.sheet = 'leave'; render(); },
    menu() { S.sheet = 'menu'; render(); },
    closeSheet() { S.sheet = null; render(); },
    async leave() {
        const { code, role } = S;
        exitRoom();
        await N.leaveRoom(code, role);
    },
    surrender() { S.sheet = 'surrender'; render(); },
    async surrenderYes() {
        S.sheet = null; render();
        try { await N.appendLog(S.code, S.game, S.st.length, { k: 's', by: me() }); } catch (e) { S.err = e.message; render(); }
    },
    stamp() { S.sheet = 'stamp'; render(); },
    async sendStamp(el) {
        const m = STAMPS[Number(el.dataset.i)];
        S.sheet = null;
        toast(`あなた：${m}`, true);
        try { await N.appendLog(S.code, S.game, S.st.length, { k: 'm', by: me(), m, t: await N.serverNow() }); } catch (e) { /* むし */ }
    },
    tab(el) { S.tab = el.dataset.t; render(); },
    toggleLog() { S.showLog = !S.showLog; render(); },
    memo(el) { const d = el.dataset.d; S.memo[d] = ((S.memo[d] || 0) + 1) % 3; render(); },
    key(el) {
        const scr = currentScreen();
        const n = scr === 'solo' ? S.solo.digits : S.st.digits;
        if (scr === 'secret') { if (S.secretDraft.length < n && !S.secretDraft.includes(el.dataset.d)) S.secretDraft += el.dataset.d; }
        else if (S.input.length < n && !S.input.includes(el.dataset.d)) S.input += el.dataset.d;
        S.err = ''; render();
    },
    back() {
        if (currentScreen() === 'secret') S.secretDraft = S.secretDraft.slice(0, -1);
        else S.input = S.input.slice(0, -1);
        render();
    },
    randomSecret() { S.secretDraft = L.randomSecret(S.st.digits); render(); },
    async commit() {
        const n = S.st.digits;
        if (S.busy || !L.isValid(S.secretDraft, n)) return;
        S.busy = true; S.err = ''; render();
        const code = S.code, game = S.game, s = S.secretDraft;
        try {
            const salt = L.makeSalt();
            const h = await L.hashSecret(s, salt);
            N.saveSecret(code, game, { s, salt });
            await N.appendLog(code, game, S.st.length, { k: 'c', by: me(), h });
        } catch (e) {
            S.err = (e && e.message) || String(e);
            if (!(window.crypto && crypto.subtle)) S.err = 'このページは https で開いてください（ひみつの数字をかくす計算が使えません）';
        }
        S.busy = false; render();
    },
    async call() {
        if (currentScreen() === 'solo') {
            const s = S.solo, n = s.digits;
            if (!L.isValid(S.input, n)) return;
            const j = L.judge(s.secret, S.input);
            s.guesses.push({ g: S.input, ...j });
            S.input = '';
            if (j.h === n) {
                const cnt = s.guesses.length;
                if (!prefs.best[n] || cnt < prefs.best[n]) { prefs.best[n] = cnt; s.newBest = true; savePrefs(); }
                buzz(120);
                S.screen = 'soloEnd';
            }
            render();
            return;
        }
        const st = S.st;
        if (S.busy || st.phase !== 'play' || st.turn !== me() || st.pending || !L.isValid(S.input, st.digits)) return;
        S.busy = true; S.err = ''; render();
        const g = S.input;
        try {
            await N.appendLog(S.code, S.game, st.length, { k: 'g', by: me(), g });
            S.input = '';
            S.tab = 'mine';
        } catch (e) { S.err = e.message; }
        S.busy = false; render();
    }
};

app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = actions[el.dataset.act];
    if (f) f(el);
});
app.addEventListener('input', e => {
    if (e.target.id === 'name') { prefs.name = e.target.value.trim().slice(0, 8); savePrefs(); }
});

/* ── はじめ ──────────────────────────────── */
(async function boot() {
    const q = new URLSearchParams(location.search);
    const invited = (q.get('room') || '').replace(/\D/g, '').slice(0, 4);
    const saved = N.savedRoom();
    if (saved && (!invited || invited === saved.code)) {
        S.screen = 'connecting'; S.online = false;
        render();
        try {
            await N.rejoin(saved.code, saved.role);
            await enterRoom(saved.code, saved.role);
            return;
        } catch (e) {
            N.saveRoom(null);
        }
    }
    if (invited.length === 4) { S.joinCode = invited; S.screen = 'join'; }
    else S.screen = 'home';
    render();
})();
