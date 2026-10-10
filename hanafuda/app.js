/* 花札 こいこい ── 画面の きりかえ
   ------------------------------------------------------------------
   はじめて ひらいた ときは「設定」から はじまり、表示（ヒントなど）と
   ルールを えらびます。あとから いつでも「設定」で かえられます。
   画面：ホーム / はじめの 設定 / コンピューター / 友だち / 入門 / 役の 一覧 / 設定 / 対局
   ------------------------------------------------------------------ */
import { CARDS } from './cards.js';
import { cardURL } from './art.js';
import { DEFAULT_RULES, YAKU_DEFS } from './rules.js';
import { LEVELS } from './ai.js';
import { store, save, isFirstRun, finishSetup, addRecord, PRESETS } from './store.js';
import { sfx, unlockAudio } from './sound.js';
import { Game } from './game.js';
import { renderLessonList, runLesson, yakuCards } from './lessons.js';
import * as net from './net.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let game = null;
let current = '';

/* ── 画面の きりかえ（スマホの「もどる」でも もどれる ように #で きりかえる） ── */

const SCREENS = ['home', 'setup', 'cpu', 'online', 'learn', 'lesson', 'yakuref', 'settings', 'game'];

function show(name, push = true) {
    if (!SCREENS.includes(name)) name = 'home';
    if (current === 'game' && name !== 'game' && game) { game.dispose(); game = null; }
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
    if (current === 'game' && game) {
        // 対局中の「もどる」は すぐ ぬけずに メニューを 出す
        history.pushState(null, '', '#game');
        game.showMenu();
        return;
    }
    if (current === 'online' && onlineState.code && name !== 'online') {
        history.pushState(null, '', '#online');
        return;
    }
    show(name, false);
});

document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { sfx.tap(); show(b.dataset.go); }
});
document.addEventListener('pointerdown', unlockAudio, { once: true });

/* ── ホーム ─────────────────────────────────── */

function renderHome(root) {
    const back = net.savedRoom();
    const deco = [0, 8, 28, 40, 44].map((id, i) => `<img src="${cardURL(id)}" style="--i:${i}" alt="">`).join('');
    const rec = Object.entries(store.record).filter(([k]) => k.startsWith('cpu')).reduce((a, [, r]) => (a.w += r.w, a.l += r.l, a.d += r.d, a), { w: 0, l: 0, d: 0 });
    root.innerHTML = `<div class="home">
<div class="title-deco">${deco}</div>
<h1 class="title">花札<span>こいこい</span></h1>
<div class="home-btns">
  ${back ? `<button class="btn primary big" data-rejoin>部屋 ${esc(back.code)} に もどる</button>` : ''}
  <button class="btn big learn" data-go="learn"><span class="ic">📖</span>ルールを おぼえる<small>はじめての 人は ここから</small></button>
  <button class="btn big primary" data-go="cpu"><span class="ic">🤖</span>コンピューターと 対戦<small>つよさ 10段階</small></button>
  <button class="btn big" data-go="online"><span class="ic">👥</span>友だちと 対戦<small>4けたの 番号で 部屋に 入る</small></button>
  <div class="home-row">
    <button class="btn" data-go="yakuref">役の 一覧</button>
    <button class="btn" data-go="settings">設定</button>
  </div>
</div>
${rec.w + rec.l + rec.d ? `<p class="home-rec">コンピューターとの せいせき：${rec.w}勝 ${rec.l}敗 ${rec.d}分</p>` : ''}
</div>`;
    const rj = root.querySelector('[data-rejoin]');
    if (rj) rj.addEventListener('click', () => rejoinRoom(back));
}

/* ── はじめの 設定 ─────────────────────────── */

function renderSetup(root) {
    let step = 0;
    const draw = () => {
        if (step === 0) {
            root.innerHTML = `<div class="setup"><h1 class="title small">花札<span>こいこい</span></h1>
<h2>ようこそ！</h2><p>はじめに、あなたに あった 表示を えらびます。<br>あとから「設定」で いつでも かえられます。</p>
<div class="preset-list">${Object.entries(PRESETS).map(([k, p]) => `<button class="preset" data-preset="${k}"><b>${p.label}</b><small>${p.desc}</small></button>`).join('')}</div></div>`;
            root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
                sfx.tap();
                Object.assign(store.display, PRESETS[b.dataset.preset].display);
                store.preset = b.dataset.preset;
                save();
                step = 1;
                draw();
            }));
        } else {
            root.innerHTML = `<header class="bar"><button class="back" data-step-back>‹</button><h1>表示と ルール</h1></header>
<div class="scroll"><p class="lead">このままで よければ「はじめる」を おしてください。</p>
<h2 class="sec">表示</h2><div class="displays"></div>
<h2 class="sec">ルール</h2><div class="rules"></div>
<button class="btn primary big" data-finish>はじめる</button></div>`;
            displayToggles(root.querySelector('.displays'));
            ruleControls(root.querySelector('.rules'));
            root.querySelector('[data-step-back]').addEventListener('click', () => { step = 0; draw(); });
            root.querySelector('[data-finish]').addEventListener('click', () => {
                finishSetup();
                show(store.preset === 'beginner' ? 'learn' : 'home');
            });
        }
    };
    draw();
}

const DISPLAY_ITEMS = [
    ['yakuButton', '「役」ボタン', '対局中に 役の 一覧と すすみぐあいを 見られる'],
    ['progress', 'できそうな 役', '「赤短 2/3」の ように あと 何枚か 出す'],
    ['hint', 'とれる 札を 光らせる', '手札で とれる 札に しるし・場の とれる 札が 光る'],
    ['labels', '札の 名札', '札の すみに 月の 数字と しゅるいを 出す'],
    ['recommend', '「おすすめ」ボタン', 'どの 札を 出すと よいか おしえて もらえる'],
    ['coach', 'ひとこと アドバイス', '番が くるたびに おすすめの わけを 出す'],
    ['oneTap', '1回 タップで 出す', 'えらばずに すぐ 出す（なれた 人むけ）'],
    ['sound', '効果音', ''],
    ['voice', 'こえ', '「こいこい！」などを 読みあげる']
];

function displayToggles(root) {
    const d = store.display;
    root.innerHTML = `<div class="toggles">${DISPLAY_ITEMS.map(([k, label, sub]) => `<label class="tg"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
<input type="checkbox" data-k="${k}" ${d[k] ? 'checked' : ''}><i></i></label>`).join('')}
<div class="seg-row"><span>うごきの はやさ</span><div class="seg">${[['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']].map(([v, l]) =>
        `<button data-speed="${v}" class="${d.speed === v ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>`;
    root.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => { d[inp.dataset.k] = inp.checked; save(); }));
    root.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
        d.speed = b.dataset.speed;
        root.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
        save();
    }));
}

function ruleControls(root) {
    const r = store.rules;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-rk="${key}" data-v="${v}" class="${String(r[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const tg = (key, label, sub) => `<label class="tg"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-rk="${key}" ${r[key] ? 'checked' : ''}><i></i></label>`;
    root.innerHTML = `<div class="toggles">
<div class="seg-row col"><span>局数<small>12局＝1年（1月〜12月）</small></span>${seg('rounds', [[1, '1局'], [3, '3局'], [6, '6局'], [12, '12局']])}</div>
${tg('hanami', '花見で一杯・月見で一杯', '「菊に盃」を つかう 2つの 役')}
${tg('sakeKasu', '菊に盃を かすにも かぞえる', 'たねと かすの 両方に かぞえる')}
${tg('double7', '7点以上で 2倍', '')}
<div class="seg-row col"><span>こいこいの 倍</span>${seg('koiBonus', [['none', 'なし'], ['opponent', 'あいてが こいこい中なら 2倍'], ['self', 'こいこい 回数で 倍']])}</div>
${tg('teyaku', '手役（手四・くっつき）', 'くばった とき すぐ 6点で 勝ち')}
</div>`;
    root.querySelectorAll('button[data-rk]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.rk;
        r[k] = k === 'rounds' ? Number(b.dataset.v) : b.dataset.v;
        root.querySelectorAll(`button[data-rk="${k}"]`).forEach(x => x.classList.toggle('on', x === b));
        save();
    }));
    root.querySelectorAll('input[data-rk]').forEach(inp => inp.addEventListener('change', () => { r[inp.dataset.rk] = inp.checked; save(); }));
}

/* ── 設定 ─────────────────────────────────── */

function renderSettings(root) {
    root.innerHTML = `<header class="bar"><button class="back" data-go="home">‹</button><h1>設定</h1></header>
<div class="scroll">
<h2 class="sec">まとめて えらぶ</h2>
<div class="preset-list row">${Object.entries(PRESETS).map(([k, p]) => `<button class="preset sm" data-preset="${k}"><b>${p.label}</b></button>`).join('')}</div>
<h2 class="sec">表示</h2><div class="displays"></div>
<h2 class="sec">ルール</h2><p class="note">コンピューターとの 対戦と、あなたが ホストの ときの 友だちとの 対戦で つかいます。</p><div class="rules"></div>
<h2 class="sec">そのほか</h2>
<div class="stack-btns"><button class="btn" data-reset-rules>ルールを はじめに もどす</button>
<button class="btn" data-reset-lessons>入門の しるしを けす</button>
<button class="btn danger" data-reset-record>せいせきを けす</button></div>
</div>`;
    displayToggles(root.querySelector('.displays'));
    ruleControls(root.querySelector('.rules'));
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
        Object.assign(store.display, PRESETS[b.dataset.preset].display);
        save();
        displayToggles(root.querySelector('.displays'));
    }));
    root.querySelector('[data-reset-rules]').addEventListener('click', () => {
        store.rules = { ...DEFAULT_RULES };
        save();
        ruleControls(root.querySelector('.rules'));
    });
    root.querySelector('[data-reset-lessons]').addEventListener('click', () => { store.lessons = {}; save(); });
    root.querySelector('[data-reset-record]').addEventListener('click', () => {
        if (confirm('せいせきを ぜんぶ けしますか？')) { store.record = {}; save(); }
    });
}

/* ── コンピューターと 対戦 ─────────────────── */

function renderCpu(root) {
    const sel = store.lastLevel;
    root.innerHTML = `<header class="bar"><button class="back" data-go="home">‹</button><h1>コンピューターと 対戦</h1></header>
<div class="scroll"><h2 class="sec">つよさを えらぶ</h2>
<div class="levels">${LEVELS.slice(1).map((L, i) => {
        const lv = i + 1, r = store.record['cpu' + lv];
        return `<button class="lv${lv === sel ? ' on' : ''}" data-lv="${lv}"><span class="lv-no">${lv}</span>
<span class="lv-t"><b>${L.name}</b><small>${L.desc}</small></span>${r ? `<span class="lv-rec">${r.w}勝${r.l}敗</span>` : ''}</button>`;
    }).join('')}</div>
<div class="seg-row col"><span>局数</span><div class="seg">${[1, 3, 6, 12].map(n => `<button data-rounds="${n}" class="${store.rules.rounds === n ? 'on' : ''}">${n}局</button>`).join('')}</div></div>
<button class="btn primary big" data-start>対局を はじめる</button>
<p class="note">ほかの ルールは「設定」で かえられます。</p></div>`;
    root.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => {
        sfx.tap();
        store.lastLevel = +b.dataset.lv;
        save();
        root.querySelectorAll('[data-lv]').forEach(x => x.classList.toggle('on', x === b));
    }));
    root.querySelectorAll('[data-rounds]').forEach(b => b.addEventListener('click', () => {
        store.rules.rounds = +b.dataset.rounds;
        save();
        root.querySelectorAll('[data-rounds]').forEach(x => x.classList.toggle('on', x === b));
    }));
    root.querySelector('[data-start]').addEventListener('click', () => startCpu(store.lastLevel));
}

function startCpu(level, mode = 'cpu') {
    show('game');
    const rules = mode === 'practice' ? { ...store.rules, rounds: 3 } : { ...store.rules };
    const seed = Math.random().toString(36).slice(2) + Date.now();
    game = new Game($('#s-game'), {
        mode, me: 0, level, rules, seed,
        names: [store.name || 'あなた', 'コンピューター'],
        onFinish: res => { if (mode === 'cpu') addRecord('cpu' + level, res); },
        onAgain: () => startCpu(level, mode),
        onExit: () => show(mode === 'practice' ? 'learn' : 'cpu')
    });
}

/* ── 役の 一覧 ─────────────────────────────── */

function renderYakuRef(root) {
    const r = { ...DEFAULT_RULES, ...store.rules };
    root.innerHTML = `<header class="bar"><button class="back" data-go="home">‹</button><h1>役の 一覧</h1></header>
<div class="scroll"><p class="lead">いまの 設定の ルールでの 点数です。</p>${yakuCards(YAKU_DEFS, r)}
${r.teyaku ? `<div class="ycard"><div class="yc-head"><b>手四・くっつき</b><small>てし・くっつき</small><span class="yc-pts">6点</span></div>
<div class="yc-desc">くばられた 手札に 同じ 月が 4枚（手四）、または 同じ 月の 2枚ずつが 4組（くっつき）。すぐに 勝ち。</div></div>` : ''}
<div class="ycard"><div class="yc-head"><b>点の 倍</b></div><div class="yc-desc">${r.double7 ? '合計 7点以上で 2倍。' : ''}
${r.koiBonus === 'opponent' ? 'あいてが こいこい した あとに あがると 2倍。' : r.koiBonus === 'self' ? 'じぶんが こいこい した 回数ぶん 倍が ふえる。' : ''}</div></div></div>`;
}

/* ── 入門 ─────────────────────────────────── */

let lessonId = null;
function renderLearn(root) {
    renderLessonList(root, id => { lessonId = id; show('lesson'); });
}
function renderLesson(root) {
    if (!lessonId) { show('learn'); return; }
    runLesson(root, lessonId, {
        onDone: () => show('learn'),
        onPractice: () => startCpu(1, 'practice')
    });
}

/* ── 友だちと 対戦 ─────────────────────────── */

const onlineState = { code: null, role: null, meta: null, unsub: [], view: 'entry', digits: '', err: '' };

function resetOnline() {
    onlineState.unsub.forEach(f => { try { f(); } catch (e) { /* むし */ } });
    Object.assign(onlineState, { code: null, role: null, meta: null, unsub: [], view: 'entry', digits: '', err: '' });
}

function renderOnline(root) {
    const st = onlineState;
    const name = esc(store.name || '');
    const head = `<header class="bar"><button class="back" data-online-back>‹</button><h1>友だちと 対戦</h1></header>`;
    let body = '';
    if (st.view === 'entry') {
        body = `<div class="scroll online">
<label class="field"><span>あなたの 名まえ</span><input type="text" maxlength="8" value="${name}" placeholder="なまえ（8文字まで）" data-name></label>
<div class="big-choice">
<button class="btn primary big" data-create><span class="ic">🏠</span>部屋を つくる<small>4けたの 番号が でます</small></button>
<button class="btn big" data-join><span class="ic">🔑</span>部屋に 入る<small>友だちの 番号を 入れる</small></button>
</div>
<p class="note">ルールは 部屋を つくった 人（ホスト）の 設定に なります。<br>2人とも ネットに つながっている ひつようが あります。</p>
${st.err ? `<p class="err">${esc(st.err)}</p>` : ''}</div>`;
    } else if (st.view === 'busy') {
        body = `<div class="scroll online center"><div class="spinner"></div><p>${esc(st.busyText || 'つうしん中…')}</p></div>`;
    } else if (st.view === 'host') {
        const m = st.meta || {};
        body = `<div class="scroll online center">
<p>友だちに この 番号を つたえてください</p>
<div class="room-code">${esc(st.code).split('').map(d => `<span>${d}</span>`).join('')}</div>
${m.guest ? `<p class="joined">✓ <b>${esc(m.guestName || 'ゲスト')}</b> さんが 入りました</p>
<button class="btn primary big" data-begin>対局を はじめる</button>`
        : '<div class="spinner"></div><p>友だちが 入るのを 待っています…</p>'}
${rulesSummary(m.rules || store.rules)}
<button class="btn" data-leave>部屋を とじる</button></div>`;
    } else if (st.view === 'join') {
        const d = st.digits.padEnd(4, ' ');
        body = `<div class="scroll online center">
<p>友だちの 部屋の 番号（4けた）</p>
<div class="room-code input">${d.split('').map(c => `<span>${c === ' ' ? '' : c}</span>`).join('')}</div>
${st.err ? `<p class="err">${esc(st.err)}</p>` : ''}
<div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'けす', 0, '入る'].map(k => `<button class="key${k === '入る' ? ' go' : ''}" data-key="${k}" ${k === '入る' && st.digits.length < 4 ? 'disabled' : ''}>${k}</button>`).join('')}</div>
</div>`;
    } else if (st.view === 'guest') {
        const m = st.meta || {};
        body = `<div class="scroll online center">
<p>部屋 <b>${esc(st.code)}</b> に 入りました</p>
<p class="joined">ホスト：<b>${esc(m.hostName || 'ホスト')}</b> さん</p>
<div class="spinner"></div><p>ホストが 対局を はじめるのを 待っています…</p>
${rulesSummary(m.rules || {})}
<button class="btn" data-leave>部屋を 出る</button></div>`;
    }
    root.innerHTML = head + body;

    const nameInp = root.querySelector('[data-name]');
    if (nameInp) nameInp.addEventListener('input', () => { store.name = nameInp.value.trim().slice(0, 8); save(); });
    root.querySelector('[data-online-back]').addEventListener('click', async () => {
        if (st.view === 'join') { st.view = 'entry'; st.err = ''; renderOnline(root); return; }
        if (st.code) await leaveOnline();
        show('home');
    });
    const on = (sel, fn) => { const e = root.querySelector(sel); if (e) e.addEventListener('click', fn); };
    on('[data-create]', () => createOnline(root));
    on('[data-join]', () => { st.view = 'join'; st.digits = ''; st.err = ''; renderOnline(root); });
    on('[data-leave]', async () => { await leaveOnline(); renderOnline(root); });
    on('[data-begin]', async () => {
        const m = st.meta;
        await net.startMatch(st.code, (m.game || 0) + 1);
    });
    root.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.key;
        sfx.tap();
        if (k === 'けす') st.digits = st.digits.slice(0, -1);
        else if (k === '入る') { joinOnline(root); return; }
        else if (st.digits.length < 4) st.digits += k;
        st.err = '';
        renderOnline(root);
    }));
}

function rulesSummary(r) {
    if (!r || !r.rounds) return '';
    const koi = { none: 'こいこい倍なし', opponent: 'こいこい返し2倍', self: 'こいこい回数で倍' }[r.koiBonus] || '';
    return `<p class="rule-sum">ルール：${r.rounds}局・${r.hanami ? '花見/月見あり' : '花見/月見なし'}・${r.double7 ? '7点以上2倍' : '7点倍なし'}・${koi}${r.teyaku ? '・手役あり' : ''}</p>`;
}

function playerName() { return store.name || 'プレイヤー'; }

async function createOnline(root) {
    const st = onlineState;
    st.view = 'busy'; st.busyText = '部屋を つくっています…'; st.err = '';
    renderOnline(root);
    try {
        st.code = await net.createRoom(playerName(), { ...DEFAULT_RULES, ...store.rules });
        st.role = 'host';
        st.view = 'host';
        await watchRoom();
    } catch (e) {
        st.view = 'entry';
        st.err = e.message || '部屋が つくれませんでした';
    }
    if (current === 'online') renderOnline($('#s-online'));
}

async function joinOnline(root) {
    const st = onlineState;
    const code = st.digits;
    st.view = 'busy'; st.busyText = '部屋に 入っています…';
    renderOnline(root);
    try {
        st.meta = await net.joinRoom(code, playerName());
        st.code = code;
        st.role = 'guest';
        st.view = 'guest';
        await watchRoom();
    } catch (e) {
        st.view = 'join';
        st.err = e.message || '入れませんでした';
    }
    if (current === 'online') renderOnline($('#s-online'));
}

async function rejoinRoom(saved) {
    const st = onlineState;
    resetOnline();
    show('online');
    st.view = 'busy'; st.busyText = '部屋に もどっています…';
    renderOnline($('#s-online'));
    try {
        st.meta = await net.rejoin(saved.code, saved.role);
        st.code = saved.code;
        st.role = saved.role;
        st.view = saved.role;
        await watchRoom();
    } catch (e) {
        net.saveRoom(null);
        st.view = 'entry';
        st.err = e.message;
    }
    if (current === 'online') renderOnline($('#s-online'));
}

async function leaveOnline() {
    const st = onlineState;
    if (game) { game.dispose(); game = null; }
    if (st.code) await net.leaveRoom(st.code, st.role);
    resetOnline();
}

async function watchRoom() {
    const st = onlineState;
    let playingGame = 0;
    const unsub = await net.watchMeta(st.code, meta => {
        if (meta === undefined) return;          // よみこみ エラー
        const prev = st.meta;
        st.meta = meta;
        if (!meta) {
            // ホストが 部屋を とじた
            const was = st.role;
            if (game) { game.dispose(); game = null; }
            resetOnline();
            net.saveRoom(null);
            if (was === 'guest') { onlineState.err = 'ホストが 部屋を とじました'; show('online'); }
            return;
        }
        if (st.role === 'host' && meta.left === 'guest') {
            net.updateMeta(st.code, { guest: '', guestName: '', left: null, status: 'wait' });
            if (game) { game.dispose(); game = null; alertSoon('あいてが 部屋を 出ました'); }
            st.view = 'host';
            if (current !== 'online') show('online'); else renderOnline($('#s-online'));
            return;
        }
        if (meta.status === 'play' && meta.game && meta.game !== playingGame && meta.seed) {
            playingGame = meta.game;
            startOnlineGame(meta);
            return;
        }
        if (current === 'online' && JSON.stringify(prev) !== JSON.stringify(meta)) renderOnline($('#s-online'));
    });
    st.unsub.push(unsub);
}

function alertSoon(msg) { setTimeout(() => alert(msg), 50); }

function startOnlineGame(meta) {
    const st = onlineState;
    if (game) { game.dispose(); game = null; }
    show('game');
    const me = st.role === 'host' ? 0 : 1;
    game = new Game($('#s-game'), {
        mode: 'online', me, rules: meta.rules, seed: meta.seed,
        names: [meta.hostName || 'ホスト', meta.guestName || 'ゲスト'],
        room: { code: st.code, role: st.role, game: meta.game },
        onFinish: res => addRecord('online', res),
        onAgain: () => net.startMatch(st.code, (st.meta.game || 0) + 1),
        onExit: async () => { await leaveOnline(); show('home'); }
    });
}

/* ── はじまり ─────────────────────────────── */

const RENDER = {
    home: renderHome, setup: renderSetup, cpu: renderCpu, online: renderOnline, learn: renderLearn,
    lesson: renderLesson, yakuref: renderYakuRef, settings: renderSettings, game: null
};

if (isFirstRun()) show('setup', true);
else {
    const h = location.hash.slice(1);
    show(['cpu', 'online', 'learn', 'yakuref', 'settings'].includes(h) ? h : 'home', false);
    history.replaceState(null, '', '#' + current);
}

// テスト用
window.__hanafuda = { store, get game() { return game; }, show, startCpu, CARDS };
