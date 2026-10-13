/* なみ麻雀 ── 画面の きりかえ
   ------------------------------------------------------------------
   画面：ホーム / コンピューターと 対戦 / 友だちと 対戦（部屋）/ ルール設定 / 役の 一覧 / 設定 / 対局
   ------------------------------------------------------------------ */
import { Mahjong, DEFAULT_RULES, makeRng, shuffle } from './engine.js';
import { LEVELS } from './ai.js';
import { store, save, addRecord } from './store.js';
import { sfx, unlockAudio, say } from './sound.js';
import { bgm, volumeHTML, bindVolume } from './bgm.js';
import { GameView, rulesSummary } from './game.js';
import { icon } from './assets/icons.js';
import { tileImage } from './tiles.js';
import * as net from './net.js';
import { CHARS, GROUPS, charById, charImg } from './chars.js';
import { renderKeisan } from './keisan.js';
import { renderDrill, resetDrillView } from './drill.js';
import { renderYaku, resetYakuView } from './yaku-player.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** キャラクターを えらぶ 一覧（タップで えらぶ） */
function charPicker() {
    const cur = charById(store.char).id;
    return `<div class="char-picker">${GROUPS.map(g => `<div class="char-group">${g.name}</div><div class="char-pick">${CHARS.filter(c => c.group === g.id).map(c => `<button class="char${c.id === cur ? ' on' : ''}" data-char="${c.id}"><img src="${charImg(c.id)}" alt=""><span>${c.name}</span></button>`).join('')}</div>`).join('')}</div>`;
}

function bindCharPicker(root) {
    const box = root.querySelector('.char-picker');
    if (!box) return;
    box.addEventListener('click', e => {
        const b = e.target.closest('[data-char]');
        if (!b) return;
        sfx.select();
        store.char = b.dataset.char;
        save();
        box.querySelectorAll('.char').forEach(x => x.classList.toggle('on', x === b));
    });
}

let view = null;
let current = '';

/* ── 画面の きりかえ（スマホの「もどる」でも もどれる ように #で きりかえる） ── */

const SCREENS = ['home', 'cpu', 'online', 'rules', 'yakuref', 'keisan', 'drill', 'settings', 'game'];

function show(name, push = true) {
    if (!SCREENS.includes(name)) name = 'home';
    if (name === 'game' && !view) name = 'home';
    if (current === 'game' && name !== 'game' && view) { view.dispose(); view = null; leaveOnlineGame(); }
    if (name !== 'drill') resetDrillView();
    if (name !== 'yakuref') resetYakuView();
    current = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
    document.body.classList.toggle('in-game', name === 'game');
    if (push && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
    const r = RENDER[name];
    if (r) r($('#s-' + name));
    if (name !== 'game') { bgm.duck(1); bgm.play('menu'); }
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
<h1 class="title"><span class="t1">なみ</span><span class="t2">麻雀</span></h1>
<p class="subtitle">${icon('lightning')} ロン！ツモ！ 雷が おちる 4人麻雀</p>
<div class="home-btns">
  ${saved ? `<button class="btn primary big" data-rejoin>合言葉 ${esc(saved.code)} の 部屋に もどる</button>` : ''}
  <button class="btn big primary" data-go="cpu">${icon('robot')}<span>コンピューターと 対戦<small>つよさ 3段階</small></span></button>
  <button class="btn big" data-go="online">${icon('users-three')}<span>友だちと 対戦<small>合言葉で 部屋に 入る（2人＋コンピューター2人）</small></span></button>
  <button class="btn big" data-go="keisan">${icon('lightbulb')}<span>点数計算を おぼえる<small>やりかた・練習問題・早見表</small></span></button>
  <button class="btn big" data-go="yakuref">${icon('play')}<span>役を おぼえる<small>ぜんぶの 役を お手本の 動画と 妖精の 説明・クイズで</small></span></button>
  <button class="btn big" data-go="drill">${icon('book-open-text')}<span>麻雀ドリル<small>何切る・何待ち・何符・何点・リーチへの まもり（1900問 いじょう）</small></span></button>
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
<h3>あなたの キャラクター</h3>
${charPicker()}
<p class="note">持ち点 ${r.startPoints.toLocaleString()} 点。座席は 毎回 ランダムで、サイコロで 親を きめます。<br>こまかい ルールは <button class="link" data-go="rules">ルール設定</button> で かえられます。</p>
<button class="btn primary big start">${icon('play')}<span>対局 開始</span></button>
</div>`;
    root.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => {
        sfx.button(); store.level = Number(b.dataset.lv); save();
        root.querySelectorAll('[data-lv]').forEach(x => x.classList.toggle('on', x === b));
    }));
    bindSeg(root);
    bindCharPicker(root);
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

/** コンピューターの キャラクター（人が えらんだ ものとは かぶらない）。
    卓の 画風が そろう ように、1人めの 人（自分／ホスト）と 同じ なかま（どうぶつ／ひと）から えらぶ */
function cpuPlayers(seed, n, taken = []) {
    const rng = makeRng(seed + ':chars');
    const group = charById(taken[0]).group;
    let pool = CHARS.filter(c => c.group === group && !taken.includes(c.id));
    if (pool.length < n) pool = CHARS.filter(c => !taken.includes(c.id));
    return shuffle(pool, rng).slice(0, n).map(c => ({ name: c.name, avatar: charImg(c.id) }));
}

function startCpuGame() {
    const seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const g = new Mahjong(store.rules, seed);
    const myChar = charById(store.char).id;
    const chars = cpuPlayers(seed, 3, [myChar]);
    const parts = [
        { name: store.name || 'あなた', avatar: charImg(myChar), kind: 'me' },
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

const online = { code: '', role: '', unsub: [], gameUnsub: [], meta: null, gameNo: -1, ready: {}, reqSeen: new Set() };

/** 1回の 対局ぶんの 見はり（手・ねがい・OK）を とめる。つぎの 対局を はじめる ときに かならず よぶ */
function cleanupGameListeners() {
    online.gameUnsub.forEach(f => { try { f(); } catch (e) { /* むし */ } });
    online.gameUnsub = [];
}

/** 「ともだちの つうしんが 切れています」の 表示を いまの ようすに あわせる */
function updatePeerBanner() {
    const on = online.onlineState || {};
    const other = online.role === 'host' ? 'guest' : 'host';
    const off = !!(view && online.inGame && online.meta && online.meta[other] && !on[other]);
    document.body.classList.toggle('peer-off', off);
}

function cleanupOnline() {
    online.unsub.forEach(f => { try { f(); } catch (e) { /* むし */ } });
    online.unsub = [];
}

function leaveOnlineGame() {
    // 対局画面を ぬけた だけでは 部屋は のこす（ホームから もどれる）
    online.inGame = false;
    document.body.classList.remove('peer-off');
}

function renderOnline(root) {
    if (online.code) { renderRoom(root); return; }
    root.innerHTML = `<div class="page">
${back()}
<h2>友だちと 対戦</h2>
<p class="note">あなたと ともだち、それに コンピューター 2人の 4人で 打ちます。座席は ランダムです。</p>
<h3>名まえ</h3>
<input class="name-in" maxlength="8" placeholder="あなた" value="${esc(store.name)}">
<h3>あなたの キャラクター</h3>
${charPicker()}
<p class="msg" role="status"></p>
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
</div>`;
    bindSeg(root);
    bindCharPicker(root);
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
                const meta = await net.joinRoom(code, getName(), charById(store.char).id);
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
            const c = await net.createRoom(getName(), store.rules, store.level, charById(store.char).id);
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
        // 対局 開始／もう一度（status が 'play' の ときだけ。おわった 対局 'done' は はじめない）
        if (meta.status === 'play' && meta.seed && online.gameNo !== meta.game) {
            startOnlineGame(meta);
        }
        updatePeerBanner();
        if (online.role === 'host' && meta.left === 'guest' && view && online.inGame) {
            view.$('.g-status').textContent = 'ともだちが 部屋を 出ました';
        }
    }).then(f => online.unsub.push(f));
    net.watchOnline(online.code, on => {
        online.onlineState = on;
        updatePeerBanner();
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
  <div class="mem"><img src="${charImg(m && m.hostChar ? m.hostChar : store.char)}" alt=""><b>${esc(m ? m.hostName : store.name || 'あなた')}</b><small>ホスト${on.host ? '' : '（つながっていない）'}</small></div>
  <div class="mem ${guestIn ? '' : 'empty'}"><img src="${guestIn ? charImg(m.guestChar || 'rabbit') : charImg('mouse')}" alt=""><b>${guestIn ? esc(m.guestName) : 'まっています…'}</b><small>${guestIn ? (on.guest ? 'ゲスト' : 'ゲスト（つながっていない）') : ''}</small></div>
  <div class="mem cpu">${icon('robot')}<b>コンピューター ×2</b><small>${m ? LEVELS[(m.level || 2) - 1].name : ''}</small></div>
</div>
${m ? `<details class="rule-sum"><summary>ルール（ホストの 設定）</summary>${rulesSummary({ ...DEFAULT_RULES, ...m.rules })}</details>` : ''}
${m && m.status === 'done' ? `<p class="note">${m.game}回めの 対局は おわりました。${host ? '「対局を はじめる」で つぎの 対局です。' : 'ホストが つぎの 対局を はじめるのを まっています…'}</p>` : ''}
${host ? `<button class="btn primary big start" ${guestIn && on.guest ? '' : 'disabled'}>${icon('play')}<span>${m && m.game ? 'つぎの 対局を はじめる' : '対局を はじめる'}</span></button>${guestIn && !on.guest ? '<p class="note">ともだちが つながるのを まっています…</p>' : ''}` : (m && m.status === 'done' ? '' : '<p class="note">ホストが はじめるのを まっています…</p>')}
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
    cleanupGameListeners();
    online.code = ''; online.role = ''; online.meta = null; online.gameNo = -1; online.inGame = false;
    document.body.classList.remove('peer-off');
    if (view) { view.dispose(); view = null; }
    if (notify && code) await net.leaveRoom(code, role);
    else net.saveRoom(null);
}

async function startOnlineGame(meta) {
    // まえの 対局の 見はりは ここで とめる（のこって いると まえの 手が まざる）
    cleanupGameListeners();
    online.gameNo = meta.game;
    online.inGame = true;
    online.ready = {};
    online.reqSeen = new Set();
    const g = new Mahjong(meta.rules, meta.seed);
    const isHost = online.role === 'host';
    const hostChar = charById(meta.hostChar || 'shiba').id;
    const guestChar = charById(meta.guestChar || 'rabbit').id;
    const chars = cpuPlayers(meta.seed, 2, [hostChar, guestChar]);
    const parts = [
        { name: meta.hostName || 'ホスト', avatar: charImg(hostChar), kind: isHost ? 'me' : 'remote' },
        { name: meta.guestName || 'ゲスト', avatar: charImg(guestChar), kind: isHost ? 'remote' : 'me' },
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
        // 対局が おわったら ホストが 部屋を「おわった」に する（あとから 入りなおしても まえの 対局は はじまらない）
        onMatchOver: () => { if (isHost && online.code === code) net.finishMatch(code, game).catch(() => {}); },
        onRematch: async () => {
            if (!isHost) return;
            const on = online.onlineState || {};
            if (!on.guest || !(online.meta && online.meta.guest)) {
                alert('ともだちが 部屋に いません。部屋の 画面で ともだちを まってから はじめてください');
                show('online');
                return;
            }
            await net.startMatch(code, game + 1);
        },
        onBackToRoom: () => show('online')
    });
    v.catchUp(past);
    updatePeerBanner();
    // 新しい 手（ゲストは ホストの 手を、ホストは ゲストの ねがいを）。この 対局が おわったら とめる
    const keep = f => { if (view === v) online.gameUnsub.push(f); else { try { f(); } catch (e) { /* むし */ } } };
    net.watchLog(code, game, (i, a) => {
        if (!view || view !== v) return;
        if (!isHost) v.receive(i, a);
    }).then(keep);
    if (isHost) {
        net.watchRequests(code, game, req => {
            if (!view || view !== v) return;
            v.handleRequest(req.action, req.n);     // ちがう 場面の ねがいは すてる
        }).then(keep);
        net.watchReady(code, game, r => { if (view === v) online.ready = r || {}; }).then(keep);
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

/* ── 設定 ───────────────────────────────── */

function renderSettings(root) {
    const s = store.settings;
    const item = (key, label, opts) => `<div class="rule-item"><div class="ri-label">${label}</div><div class="seg small" data-skey="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${s[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    root.innerHTML = `<div class="page">
${back()}
<h2>設定</h2>
<div class="rules-list">
${item('sound', '音（BGM・効果音・こえ ぜんぶ）', [[true, 'あり'], [false, 'なし']])}
<div class="rule-item vol-item"><div class="ri-label">音量（こえは ポン・ロン などの 読みあげ）</div>${volumeHTML()}</div>
${item('yakuVoice', 'あがりの 役を 読みあげる', [[true, 'あり'], [false, 'なし']])}
${item('advice', '妖精の アドバイス（どれを 切るか・役・リーチの ときの まもりかた）', [[true, 'あり'], [false, 'なし']])}
${item('adviceLevel', 'アドバイスの 多さ', [['often', 'いつも'], ['key', 'だいじな ときだけ']])}
${item('vibe', '自分の 番・鳴ける とき バイブ（iPhone は iOS 18 から・機種に よる）', [[true, 'あり'], [false, 'なし']])}
${item('fx', '演出（雷・光・ゆれ）', [['full', 'はでに'], ['lite', 'ひかえめ']])}
${item('speed', 'うごきの はやさ', [['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']])}
${item('showWaits', 'テンパイの とき 待ちを 出す', [[true, 'あり'], [false, 'なし']])}
${item('hint', 'おすすめの 牌に しるし', [[false, 'なし'], [true, 'あり']])}
${item('handMode', '手牌の ならべかた', [['auto', '自動で ならべる'], ['manual', '自分で ならべる（ドラッグ）']])}
${item('riverStyle', '捨て牌の 置きかた', [['neat', 'きっちり そろえる'], ['natural', '手で 置いたように']])}
${item('showPoints', 'テンパイの とき あがりの 点数を 出す', [[true, 'あり'], [false, 'なし']])}
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
        if (seg.dataset.skey === 'sound') bgm.refresh();
    }));
    bindVolume(root);
    root.querySelector('.test-sound').addEventListener('click', () => {
        unlockAudio();
        sfx.select();
        setTimeout(() => sfx.discard(), 250);
        setTimeout(() => { sfx.call(); say('ポン', 1); }, 700);
        setTimeout(() => { sfx.thunder(2); say('ロン', 0); }, 1500);
    });
}

const RENDER = { home: renderHome, cpu: renderCpu, online: renderOnline, rules: renderRules, yakuref: root => renderYaku(root, back()), keisan: root => renderKeisan(root, back()), drill: root => renderDrill(root, back()), settings: renderSettings };

// ためす とき 用（?debug）
if (/[?&]debug\b/.test(location.search)) window.__mj = { get view() { return view; }, startCpuGame };

show((location.hash.slice(1) || 'home').replace('game', 'home'), false);
