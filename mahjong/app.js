/* 雷鳴麻雀 ── 画面の きりかえ
   ------------------------------------------------------------------
   画面：ホーム / コンピューターと 対戦 / 友だちと 対戦（部屋）/ ルール設定 / 役の 一覧 / 設定 / 対局
   ------------------------------------------------------------------ */
import { Mahjong, DEFAULT_RULES, makeRng, shuffle } from './engine.js';
import { LEVELS } from './ai.js';
import { store, save, addRecord } from './store.js';
import { sfx, unlockAudio, say } from './sound.js';
import { GameView, rulesSummary } from './game.js';
import { icon } from './assets/icons.js';
import { tileImage } from './tiles.js';
import * as net from './net.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CPU_CHARS = [
    { name: 'ハル', avatar: 'assets/avatars/cpu1.svg' },
    { name: 'ミオ', avatar: 'assets/avatars/cpu2.svg' },
    { name: 'ソラ', avatar: 'assets/avatars/cpu3.svg' },
    { name: 'ジン', avatar: 'assets/avatars/cpu4.svg' },
    { name: 'リン', avatar: 'assets/avatars/cpu5.svg' },
    { name: 'ケイ', avatar: 'assets/avatars/cpu6.svg' }
];

let view = null;
let current = '';

/* ── 画面の きりかえ（スマホの「もどる」でも もどれる ように #で きりかえる） ── */

const SCREENS = ['home', 'cpu', 'online', 'rules', 'yakuref', 'settings', 'game'];

function show(name, push = true) {
    if (!SCREENS.includes(name)) name = 'home';
    if (name === 'game' && !view) name = 'home';
    if (current === 'game' && name !== 'game' && view) { view.dispose(); view = null; leaveOnlineGame(); }
    current = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
    document.body.classList.toggle('in-game', name === 'game');
    if (push && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
    const r = RENDER[name];
    if (r) r($('#s-' + name));
    window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
    const name = location.hash.slice(1) || 'home';
    if (current === 'game' && view) {
        history.pushState(null, '', '#game');
        view.showMenu();
        return;
    }
    show(name, false);
});

document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { sfx.button(); show(b.dataset.go); }
});
document.addEventListener('pointerdown', unlockAudio, { once: true });

const back = (to = 'home') => `<button class="back" data-go="${to}">${icon('arrow-left')}<span>もどる</span></button>`;

/* ── ホーム ─────────────────────────────────── */

function renderHome(root) {
    const saved = net.savedRoom();
    const deco = [27 * 4, 31 * 4, 16, 33 * 4, 32 * 4].map((id, i) => `<div class="t deco" style="--i:${i}"><i style="background-image:url(${tileImage(id, true)})"></i></div>`).join('');
    const rec = Object.entries(store.record).filter(([k]) => k.startsWith('lv'));
    const recHTML = rec.length ? `<div class="home-rec">${rec.map(([k, r]) => `<div><b>${LEVELS[Number(k.slice(2)) - 1].short}</b> ${r.games}戦 1位${r.ranks[0]} 2位${r.ranks[1]} 3位${r.ranks[2]} 4位${r.ranks[3]}</div>`).join('')}</div>` : '';
    root.innerHTML = `<div class="home">
<div class="title-deco">${deco}</div>
<h1 class="title"><span class="t1">雷鳴</span><span class="t2">麻雀</span></h1>
<p class="subtitle">${icon('lightning')} ロン！ツモ！ 雷が おちる 4人麻雀</p>
<div class="home-btns">
  ${saved ? `<button class="btn primary big" data-rejoin>合言葉 ${esc(saved.code)} の 部屋に もどる</button>` : ''}
  <button class="btn big primary" data-go="cpu">${icon('robot')}<span>コンピューターと 対戦<small>つよさ 3段階</small></span></button>
  <button class="btn big" data-go="online">${icon('users-three')}<span>友だちと 対戦<small>合言葉で 部屋に 入る（2人＋コンピューター2人）</small></span></button>
  <div class="home-row">
    <button class="btn" data-go="rules">${icon('gear-six')}ルール</button>
    <button class="btn" data-go="yakuref">${icon('book-open-text')}役の 一覧</button>
    <button class="btn" data-go="settings">${icon('speaker-high')}設定</button>
  </div>
</div>
${recHTML}
</div>`;
    const rj = root.querySelector('[data-rejoin]');
    if (rj) rj.addEventListener('click', () => { sfx.button(); rejoinRoom(saved); });
}

/* ── コンピューターと 対戦 ───────────────────── */

function renderCpu(root) {
    const r = store.rules;
    root.innerHTML = `<div class="page">
${back()}
<h2>コンピューターと 対戦</h2>
<h3>コンピューターの つよさ</h3>
<div class="levels">${LEVELS.map(l => `<button class="lv-card${store.level === l.id ? ' on' : ''}" data-lv="${l.id}"><b>${'★'.repeat(l.id)}<span>${'☆'.repeat(3 - l.id)}</span></b><span class="lv-name">${l.name}</span><small>${l.desc}</small></button>`).join('')}</div>
<h3>対局の 長さ</h3>
<div class="seg" data-key="length">
  <button data-v="tonpu" class="${r.length === 'tonpu' ? 'on' : ''}">東風戦<small>東場のみ</small></button>
  <button data-v="hanchan" class="${r.length === 'hanchan' ? 'on' : ''}">半荘戦<small>東場＋南場</small></button>
</div>
<h3>あなたの 名まえ</h3>
<input class="name-in" maxlength="8" placeholder="あなた" value="${esc(store.name)}">
<p class="note">持ち点 ${r.startPoints.toLocaleString()} 点。座席は 毎回 ランダムで、サイコロで 親を きめます。<br>こまかい ルールは <button class="link" data-go="rules">ルール設定</button> で かえられます。</p>
<button class="btn primary big start">${icon('play')}<span>対局 開始</span></button>
</div>`;
    root.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => {
        sfx.button(); store.level = Number(b.dataset.lv); save();
        root.querySelectorAll('[data-lv]').forEach(x => x.classList.toggle('on', x === b));
    }));
    bindSeg(root);
    root.querySelector('.name-in').addEventListener('change', e => { store.name = e.target.value.trim().slice(0, 8); save(); });
    root.querySelector('.start').addEventListener('click', () => {
        sfx.button();
        store.name = root.querySelector('.name-in').value.trim().slice(0, 8); save();
        startCpuGame();
    });
}

function bindSeg(root) {
    root.querySelectorAll('.seg').forEach(seg => {
        seg.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            sfx.button();
            let v = b.dataset.v;
            if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = Number(v);
            store.rules[seg.dataset.key] = v;
            save();
            seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        });
    });
}

function cpuPlayers(seed, n) {
    const rng = makeRng(seed + ':chars');
    return shuffle(CPU_CHARS.slice(), rng).slice(0, n);
}

function startCpuGame() {
    const seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const g = new Mahjong(store.rules, seed);
    const chars = cpuPlayers(seed, 3);
    const parts = [
        { name: store.name || 'あなた', avatar: 'assets/avatars/you.svg', kind: 'me' },
        ...chars.map(c => ({ ...c, kind: 'cpu', level: store.level }))
    ];
    const players = [];
    parts.forEach((p, i) => { players[g.seatOrder[i]] = p; });
    const mySeat = g.seatOrder[0];
    openGame({
        engine: g, mySeat, players, role: 'solo',
        onExit: () => show('home'),
        onFinish: final => {
            const row = final.rows.find(r => r.seat === mySeat);
            if (row) addRecord('lv' + store.level, row.rank);
        },
        onRematch: () => startCpuGame()
    });
}

function openGame(cfg) {
    if (view) { view.dispose(); view = null; }
    current = 'game';
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-game'));
    document.body.classList.add('in-game');
    if (location.hash !== '#game') history.pushState(null, '', '#game');
    view = new GameView($('#s-game'), cfg);
    view.step();
    return view;
}

/* ── 友だちと 対戦 ───────────────────────────── */

const online = { code: '', role: '', unsub: [], meta: null, gameNo: -1, ready: {}, reqSeen: new Set() };

function cleanupOnline() {
    online.unsub.forEach(f => { try { f(); } catch (e) { /* むし */ } });
    online.unsub = [];
}

function leaveOnlineGame() {
    // 対局画面を ぬけた だけでは 部屋は のこす（ホームから もどれる）
    online.inGame = false;
}

function renderOnline(root) {
    if (online.code) { renderRoom(root); return; }
    root.innerHTML = `<div class="page">
${back()}
<h2>友だちと 対戦</h2>
<p class="note">あなたと ともだち、それに コンピューター 2人の 4人で 打ちます。座席は ランダムです。</p>
<h3>名まえ</h3>
<input class="name-in" maxlength="8" placeholder="あなた" value="${esc(store.name)}">
<div class="on-cards">
  <div class="on-card">
    <h3>${icon('plus-circle')} 部屋を つくる</h3>
    <p>合言葉（4けたの 数字）が でます。ともだちに つたえてください。</p>
    <div class="mini">コンピューターの つよさ
      <div class="seg small" data-lv>${LEVELS.map(l => `<button data-v="${l.id}" class="${store.level === l.id ? 'on' : ''}">${l.short}</button>`).join('')}</div>
    </div>
    <div class="mini">長さ
      <div class="seg small" data-key="length"><button data-v="tonpu" class="${store.rules.length === 'tonpu' ? 'on' : ''}">東風戦</button><button data-v="hanchan" class="${store.rules.length === 'hanchan' ? 'on' : ''}">半荘戦</button></div>
    </div>
    <button class="btn primary create">部屋を つくる</button>
  </div>
  <div class="on-card">
    <h3>${icon('door-open')} 部屋に 入る</h3>
    <p>ともだちに おしえて もらった 合言葉を 入れてください。</p>
    <div class="code-in"><span></span><span></span><span></span><span></span></div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del">${icon('backspace')}</button><button data-k="0">0</button><button data-k="ok" class="ok">入る</button></div>
  </div>
</div>
<p class="msg"></p>
</div>`;
    bindSeg(root);
    root.querySelector('[data-lv]').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        store.level = Number(b.dataset.v); save();
        root.querySelectorAll('[data-lv] button').forEach(x => x.classList.toggle('on', x === b));
    });
    const nameIn = root.querySelector('.name-in');
    const getName = () => { store.name = nameIn.value.trim().slice(0, 8); save(); return store.name || 'あなた'; };
    const msg = root.querySelector('.msg');
    let code = '';
    const cells = root.querySelectorAll('.code-in span');
    const paint = () => cells.forEach((c, i) => { c.textContent = code[i] || ''; });
    root.querySelector('.keypad').addEventListener('click', async e => {
        const b = e.target.closest('[data-k]');
        if (!b) return;
        sfx.button();
        const k = b.dataset.k;
        if (k === 'del') code = code.slice(0, -1);
        else if (k === 'ok') {
            if (code.length !== 4) { msg.textContent = '4けたの 合言葉を 入れてください'; return; }
            msg.textContent = 'つないでいます…';
            try {
                const meta = await net.joinRoom(code, getName());
                online.code = code; online.role = 'guest'; online.meta = meta;
                watchRoom();
                renderRoom(root);
            } catch (err) { msg.textContent = err.message; }
            return;
        } else if (code.length < 4) code += k;
        paint();
    });
    root.querySelector('.create').addEventListener('click', async () => {
        sfx.button();
        msg.textContent = '部屋を つくっています…';
        try {
            const c = await net.createRoom(getName(), store.rules, store.level);
            online.code = c; online.role = 'host'; online.meta = null;
            watchRoom();
            renderRoom(root);
        } catch (err) { msg.textContent = err.message; }
    });
}

function watchRoom() {
    cleanupOnline();
    online.ready = {};
    net.watchMeta(online.code, meta => {
        if (meta === undefined) return;
        if (meta === null) {
            // 部屋が きえた（ホストが 出た）
            const wasGuest = online.role === 'guest';
            exitRoom(false);
            if (wasGuest) { alert('ホストが 部屋を 出ました'); show('home'); }
            return;
        }
        const prev = online.meta;
        online.meta = meta;
        if (current === 'online') renderRoom($('#s-online'));
        // 対局 開始（ゲスト）／ もう一度
        if (meta.status === 'play' && meta.seed && (!prev || prev.game !== meta.game || prev.status !== 'play' || !online.inGame) && online.gameNo !== meta.game) {
            startOnlineGame(meta);
        }
        if (online.role === 'host' && meta.left === 'guest' && view && online.inGame) {
            view.$('.g-status').textContent = 'ともだちが 部屋を 出ました';
        }
    }).then(f => online.unsub.push(f));
    net.watchOnline(online.code, on => {
        online.onlineState = on;
        const other = online.role === 'host' ? 'guest' : 'host';
        if (view && online.inGame) {
            document.body.classList.toggle('peer-off', !on[other] && !!(online.meta && online.meta[other]));
        }
        if (current === 'online') renderRoom($('#s-online'));
    }).then(f => online.unsub.push(f));
}

function renderRoom(root) {
    const m = online.meta;
    const host = online.role === 'host';
    const on = online.onlineState || {};
    const guestIn = m && m.guest;
    root.innerHTML = `<div class="page room">
<button class="back" data-leave>${icon('sign-out')}<span>部屋を 出る</span></button>
<h2>部屋</h2>
<div class="pass"><small>合言葉</small><b>${esc(online.code)}</b>${host ? '<span>ともだちに つたえてください</span>' : ''}</div>
<div class="members">
  <div class="mem"><img src="assets/avatars/you.svg" alt=""><b>${esc(m ? m.hostName : store.name || 'あなた')}</b><small>ホスト${on.host ? '' : '（つながっていない）'}</small></div>
  <div class="mem ${guestIn ? '' : 'empty'}"><img src="assets/avatars/friend.svg" alt=""><b>${guestIn ? esc(m.guestName) : 'まっています…'}</b><small>${guestIn ? (on.guest ? 'ゲスト' : 'ゲスト（つながっていない）') : ''}</small></div>
  <div class="mem cpu">${icon('robot')}<b>コンピューター ×2</b><small>${m ? LEVELS[(m.level || 2) - 1].name : ''}</small></div>
</div>
${m ? `<details class="rule-sum"><summary>ルール（ホストの 設定）</summary>${rulesSummary({ ...DEFAULT_RULES, ...m.rules })}</details>` : ''}
${host ? `<button class="btn primary big start" ${guestIn ? '' : 'disabled'}>${icon('play')}<span>対局を はじめる</span></button>` : '<p class="note">ホストが はじめるのを まっています…</p>'}
${m && m.status === 'play' && !online.inGame ? '<button class="btn primary big back-game">対局に もどる</button>' : ''}
</div>`;
    root.querySelector('[data-leave]').addEventListener('click', () => {
        sfx.button();
        if (confirm('部屋を 出ますか？')) { exitRoom(true); show('home'); }
    });
    const st = root.querySelector('.start');
    if (st) st.addEventListener('click', async () => {
        sfx.button();
        st.disabled = true;
        const game = (m.game || 0) + 1;
        await net.startMatch(online.code, game);
    });
    const bg = root.querySelector('.back-game');
    if (bg) bg.addEventListener('click', () => { sfx.button(); startOnlineGame(online.meta); });
}

async function exitRoom(notify) {
    const { code, role } = online;
    cleanupOnline();
    online.code = ''; online.role = ''; online.meta = null; online.gameNo = -1; online.inGame = false;
    if (view) { view.dispose(); view = null; }
    if (notify && code) await net.leaveRoom(code, role);
    else net.saveRoom(null);
}

async function startOnlineGame(meta) {
    online.gameNo = meta.game;
    online.inGame = true;
    online.ready = {};
    online.reqSeen = new Set();
    const g = new Mahjong(meta.rules, meta.seed);
    const isHost = online.role === 'host';
    const chars = cpuPlayers(meta.seed, 2);
    const parts = [
        { name: meta.hostName || 'ホスト', avatar: 'assets/avatars/you.svg', kind: isHost ? 'me' : 'remote' },
        { name: meta.guestName || 'ゲスト', avatar: 'assets/avatars/friend.svg', kind: isHost ? 'remote' : 'me' },
        ...chars.map(c => ({ ...c, kind: 'cpu', level: meta.level || 2 }))
    ];
    const players = [];
    parts.forEach((p, i) => { players[g.seatOrder[i]] = p; });
    const mySeat = g.seatOrder[isHost ? 0 : 1];
    const code = online.code;
    const game = meta.game;
    // いままでの 手（もどってきた とき）
    let past = [];
    try { past = await net.readLog(code, game); } catch (e) { past = []; }
    const v = openGame({
        engine: g, mySeat, players, role: isHost ? 'host' : 'guest',
        log: (i, a) => net.pushMove(code, game, i, JSON.parse(JSON.stringify(a))),
        send: (a, key) => net.sendRequest(code, game, key, a),
        onReady: hand => net.sendReady(code, game, hand),
        peerReady: hand => !!(online.ready && online.ready[hand]),
        onExit: () => { exitRoom(true); show('home'); },
        onFinish: final => {
            const row = final.rows.find(r => r.seat === mySeat);
            if (row) addRecord('online', row.rank);
        },
        onRematch: async () => {
            if (isHost) {
                await net.startMatch(code, game + 1);
            }
        }
    });
    v.catchUp(past);
    // 新しい 手（ゲストは ホストの 手を、ホストは ゲストの ねがいを）
    net.watchLog(code, game, (i, a) => {
        if (!view || view !== v) return;
        if (!isHost) v.receive(i, a);
    }).then(f => online.unsub.push(f));
    if (isHost) {
        net.watchRequests(code, game, req => {
            if (!view || view !== v) return;
            v.handleRequest(req.action, req.n);     // ちがう 場面の ねがいは すてる
        }).then(f => online.unsub.push(f));
        net.watchReady(code, game, r => { online.ready = r || {}; }).then(f => online.unsub.push(f));
    }
    net.saveRoom({ code, role: online.role });
}

async function rejoinRoom(saved) {
    try {
        const meta = await net.rejoin(saved.code, saved.role);
        online.code = saved.code; online.role = saved.role; online.meta = meta;
        watchRoom();
        if (meta.status === 'play') await startOnlineGame(meta);
        else show('online');
    } catch (e) {
        net.saveRoom(null);
        alert(e.message);
        show('home');
    }
}

/* ── ルール設定 ───────────────────────────── */

const RULE_ITEMS = [
    ['length', '対局の 長さ', [['tonpu', '東風戦'], ['hanchan', '半荘戦']]],
    ['startPoints', '持ち点', [[25000, '25000'], [30000, '30000']]],
    ['returnPoints', '返し点', [[25000, '25000'], [30000, '30000']]],
    ['uma', 'ウマ（さいごの ポイント）', [['none', 'なし'], ['5-10', '5-10'], ['10-20', '10-20'], ['10-30', '10-30']]],
    ['aka', '赤ドラ（赤5 3枚）', [[true, 'あり'], [false, 'なし']]],
    ['kuitan', '喰いタン（鳴いて 断么九）', [[true, 'あり'], [false, 'なし']]],
    ['ippatsu', '一発', [[true, 'あり'], [false, 'なし']]],
    ['ura', '裏ドラ', [[true, 'あり'], [false, 'なし']]],
    ['kandora', 'カンドラ', [[true, 'あり'], [false, 'なし']]],
    ['tobi', '飛び（0点 未満で 終了）', [[true, 'あり'], [false, 'なし']]],
    ['agariyame', 'オーラスの あがりやめ', [[true, 'あり'], [false, 'なし']]],
    ['westRound', '延長（返し点に とどかなければ 西入）', [[false, 'なし'], [true, 'あり']]],
    ['doubleRon', 'ダブロン', [[true, 'あり'], [false, '頭ハネ']]],
    ['sanchahou', '3人 同時ロン', [[true, '流局'], [false, 'あがり']]],
    ['abortive', '途中流局（九種九牌・四風連打・四家立直・四槓散了）', [[true, 'あり'], [false, 'なし']]],
    ['nagashi', '流し満貫', [[true, 'あり'], [false, 'なし']]],
    ['kazoe', '数え役満（13翻 以上）', [[true, 'あり'], [false, '三倍満 どまり']]],
    ['kiriage', '切り上げ満貫（30符4翻・60符3翻）', [[false, 'なし'], [true, 'あり']]],
    ['doubleYakuman', 'ダブル役満（国士十三面・四暗刻単騎 など）', [[false, 'なし'], [true, 'あり']]],
    ['pao', '責任払い（大三元・大四喜）', [[true, 'あり'], [false, 'なし']]],
    ['timer', '持ち時間', [['none', 'なし'], ['wait', '5秒＋30秒（切れても まつ）'], ['auto', '5秒＋30秒（切れたら ツモ切り）']]]
];

function renderRules(root) {
    const r = store.rules;
    root.innerHTML = `<div class="page">
${back()}
<h2>ルール設定</h2>
<p class="note">対局を はじめる まえに えらびます。友だちと 対戦では ホストの ルールに なります。</p>
<div class="rules-list">${RULE_ITEMS.map(([key, label, opts]) => `
  <div class="rule-item"><div class="ri-label">${label}</div>
  <div class="seg small" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${r[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join('')}
</div>
<button class="btn reset">はじめの ルールに もどす</button>
</div>`;
    bindSeg(root);
    root.querySelector('.reset').addEventListener('click', () => {
        sfx.button();
        store.rules = { ...DEFAULT_RULES }; save();
        renderRules(root);
    });
}

/* ── 役の 一覧 ───────────────────────────── */

const YAKU_LIST = [
    ['1翻', [['立直', 'リーチ', '門前で テンパイして 宣言（1000点）'], ['一発', 'イッパツ', 'リーチ後 1巡以内に あがる'], ['門前清自摸和', 'メンゼンツモ', '鳴かずに ツモで あがる'],
        ['平和', 'ピンフ', '門前・4面子が 順子・雀頭が 役牌で ない・両面待ち'], ['断么九', 'タンヤオ', '2〜8の 数牌だけ'], ['一盃口', 'イーペーコー', '門前で 同じ 順子 2つ'],
        ['役牌', 'ヤクハイ', '白・發・中・場風・自風の 刻子'], ['嶺上開花', 'リンシャンカイホー', 'カンの あとの 嶺上牌で ツモ'], ['槍槓', 'チャンカン', '加槓した 牌で ロン'],
        ['海底摸月', 'ハイテイ', 'さいごの 牌で ツモ'], ['河底撈魚', 'ホーテイ', 'さいごの 捨て牌で ロン']]],
    ['2翻', [['ダブル立直', 'ダブルリーチ', '第1巡で リーチ'], ['七対子', 'チートイツ', '対子 7つ（25符）'], ['三色同順', 'サンショク', '萬・筒・索で 同じ 数の 順子（鳴き 1翻）'],
        ['一気通貫', 'イッツー', '同じ 色で 123・456・789（鳴き 1翻）'], ['混全帯么九', 'チャンタ', 'すべての 面子と 雀頭に 么九牌（鳴き 1翻）'], ['対々和', 'トイトイ', '4面子が ぜんぶ 刻子'],
        ['三暗刻', 'サンアンコー', '暗刻 3つ'], ['三色同刻', 'サンショクドーコー', '3色で 同じ 数の 刻子'], ['三槓子', 'サンカンツ', 'カン 3つ'], ['小三元', 'ショーサンゲン', '三元牌の 刻子 2つ＋雀頭'],
        ['混老頭', 'ホンロートー', '么九牌だけ']]],
    ['3翻', [['二盃口', 'リャンペーコー', '一盃口 2つ'], ['純全帯么九', 'ジュンチャン', 'すべてに 1・9（字牌なし。鳴き 2翻）'], ['混一色', 'ホンイツ', '1色＋字牌（鳴き 2翻）']]],
    ['6翻', [['清一色', 'チンイツ', '1色だけ（鳴き 5翻）']]],
    ['役満', [['国士無双', 'コクシムソウ', '么九牌 13種 ぜんぶ＋どれか 1つ'], ['四暗刻', 'スーアンコー', '暗刻 4つ'], ['大三元', 'ダイサンゲン', '白・發・中の 刻子'],
        ['小四喜', 'ショースーシー', '風牌の 刻子 3つ＋雀頭'], ['大四喜', 'ダイスーシー', '風牌の 刻子 4つ'], ['字一色', 'ツーイーソー', '字牌だけ'], ['緑一色', 'リューイーソー', '2・3・4・6・8索と 發だけ'],
        ['清老頭', 'チンロートー', '1・9の 数牌だけ'], ['九蓮宝燈', 'チューレンポートー', '1色で 1112345678999＋1枚'], ['四槓子', 'スーカンツ', 'カン 4つ'],
        ['天和', 'テンホー', '親の 配牌で あがり'], ['地和', 'チーホー', '子の 第1ツモで あがり']]]
];

function renderYakuref(root) {
    root.innerHTML = `<div class="page">
${back()}
<h2>役の 一覧</h2>
<p class="note">点数の めやす：満貫 8000（親 12000）・跳満 12000・倍満 16000・三倍満 24000・役満 32000（親は 1.5倍）</p>
${YAKU_LIST.map(([h, list]) => `<h3 class="yk-h">${h}</h3><div class="yk-list">${list.map(([n, r, d]) => `<div class="yk"><b>${n}</b><small>${r}</small><p>${d}</p></div>`).join('')}</div>`).join('')}
</div>`;
}

/* ── 設定 ───────────────────────────────── */

function renderSettings(root) {
    const s = store.settings;
    const item = (key, label, opts) => `<div class="rule-item"><div class="ri-label">${label}</div><div class="seg small" data-skey="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${s[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    root.innerHTML = `<div class="page">
${back()}
<h2>設定</h2>
<div class="rules-list">
${item('sound', '効果音', [[true, 'あり'], [false, 'なし']])}
${item('voice', 'こえ（ポン・ロン など）', [[true, 'あり'], [false, 'なし']])}
${item('yakuVoice', 'あがりの 役を 読みあげる', [[true, 'あり'], [false, 'なし']])}
${item('fx', '演出（雷・光・ゆれ）', [['full', 'はでに'], ['lite', 'ひかえめ']])}
${item('speed', 'うごきの はやさ', [['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']])}
${item('showWaits', 'テンパイの とき 待ちを 出す', [[true, 'あり'], [false, 'なし']])}
${item('hint', 'おすすめの 牌に しるし', [[false, 'なし'], [true, 'あり']])}
${item('sortHand', '手牌を ならべる', [[true, 'あり'], [false, 'なし']])}
</div>
<button class="btn test-sound">${icon('speaker-high')} 音と こえを ためす</button>
</div>`;
    root.querySelectorAll('[data-skey]').forEach(seg => seg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        let v = b.dataset.v;
        if (v === 'true') v = true; else if (v === 'false') v = false;
        s[seg.dataset.skey] = v; save();
        sfx.button();
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    }));
    root.querySelector('.test-sound').addEventListener('click', () => {
        unlockAudio();
        sfx.select();
        setTimeout(() => sfx.discard(), 250);
        setTimeout(() => { sfx.call(); say('ポン', 1); }, 700);
        setTimeout(() => { sfx.thunder(2); say('ロン', 0); }, 1500);
    });
}

const RENDER = { home: renderHome, cpu: renderCpu, online: renderOnline, rules: renderRules, yakuref: renderYakuref, settings: renderSettings };

// ためす とき 用（?debug）
if (/[?&]debug\b/.test(location.search)) window.__mj = { get view() { return view; }, startCpuGame };

show((location.hash.slice(1) || 'home').replace('game', 'home'), false);
