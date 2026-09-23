/* たいせん画面（人とでも コンピューターとでも 同じ 画面を つかいます）
   ------------------------------------------------------------------
   ・3・2・1 → 打つ → じかん ぎれ／引ききり → けっか
   ・つぎに おす キーを 画面の キーボードで 光らせ、どの ゆびで おすかも 出します
   ・つなの ようすに あわせて「がんばれ」「あぶない」などの おうえんを 出します
   かちまけを きめるのは よびだした がわ（app.js）です。
   ここは「引ききった」「じかんに なった」を しらせるだけ です。
   ------------------------------------------------------------------ */
import { createTyper } from './romaji.js';
import { createKeyboard, fingerOf, FINGER_NAMES } from './keyboard.js';
import { sound } from './audio.js';

const $ = id => document.getElementById(id);
const ROPE_RANGE = 170;          // つなが うごく はば（ゴールの 線まで）

let kbd = null;
let cur = null;                  // いまの たいせん
let prefs = {};
try { prefs = JSON.parse(localStorage.getItem('tt_prefs') || '{}') || {}; } catch (e) { prefs = {}; }
const savePrefs = () => { try { localStorage.setItem('tt_prefs', JSON.stringify(prefs)); } catch (e) {} };

/** 画面の キーボードを 1回だけ 作ります */
export function setupGameScreen() {
    if (!kbd) kbd = createKeyboard($('kbdBox'));
}

/* ことばを 入れものの はばに おさまる 大きさに します */
function fitText(el, maxPx, minPx) {
    let size = maxPx;
    el.style.fontSize = size + 'px';
    const box = el.parentElement;
    while (size > minPx && el.scrollWidth > box.clientWidth - 12) {
        size -= 2;
        el.style.fontSize = size + 'px';
    }
}
/* たての 大きさも 見て、いちばん 大きい 字の 大きさを きめます */
const wordMax = () => Math.max(26, Math.min(64, $('word').parentElement.clientHeight * 0.42));

/**
 * たいせんを はじめます。
 * @param {object} o
 *   o.words     ことばの ならび
 *   o.goal      かつための さ（かな）
 *   o.startsAt  はじまる 時こく（o.now と 同じ 時計）
 *   o.endsAt    おわる 時こく
 *   o.now       いまの 時こくを 返す
 *   o.meName／o.foeName／o.levelText
 *   o.restore   とちゅうから つづける ときの じぶんの すすみ（なければ null）
 *   o.onProg(p) じぶんの すすみが かわった（あいてに 送る）
 *   o.onGoal()  あいてより goal 多く 打てた
 *   o.onTimeUp() じかんに なった
 */
export function startGame(o) {
    stopGame();
    setupGameScreen();
    const g = {
        o, wi: 0, n: 0, miss: 0, keys: 0, typer: null,
        foe: {}, live: false, timeUp: false, goalSent: false, ended: false,
        lastCd: null, lastTick: null, cheer: '', lastSign: 0, flipUntil: 0,
        timer: null
    };
    if (o.restore) {
        g.wi = o.restore.w || 0;
        g.n = Math.max(0, (o.restore.n || 0) - (o.restore.k || 0));
        g.miss = o.restore.miss || 0;
        g.keys = o.restore.keys || 0;
    }
    g.typer = createTyper(o.words[g.wi % o.words.length], prefs);
    cur = g;

    $('gMe').textContent = o.meName;
    $('gFoe').textContent = o.foeName;
    $('gLevel').textContent = o.levelText || '';
    $('cdVs').textContent = `${o.meName}（あか） たい ${o.foeName}（しろ）`;
    $('resultBox').classList.add('hidden');
    $('countdown').classList.add('hidden');
    setCheer('');
    paintMine(true);
    paintFoe();
    paintRope();
    g.timer = setInterval(tick, 100);
    tick();
    if (o.restore) o.onProg(progOf(g));
    return {
        setFoe(p) { if (cur === g) { g.foe = p || {}; paintFoe(); paintRope(); checkGoal(); } },
        showResult: r => { if (cur === g) showResult(g, r); },
        myStats: () => ({ n: g.n, miss: g.miss, keys: g.keys }),
        myN: () => g.n,
        stop: () => { if (cur === g) stopGame(); }
    };
}

export function stopGame() {
    if (!cur) return;
    clearInterval(cur.timer);
    cur.live = false;
    cur = null;
    if (kbd) kbd.light(null);
    $('imeWarn').classList.add('hidden');
}

const progOf = g => ({
    n: g.n, w: g.wi, k: g.typer.kanaDone(), buf: g.typer.buffer(), miss: g.miss, keys: g.keys
});

/* ── じぶんの ことば ───────────────────────── */
function paintMine(newWord) {
    const g = cur;
    const v = g.typer.view();
    $('wordDone').textContent = v.doneKana;
    $('wordRest').textContent = v.restKana;
    $('romaTyped').textContent = v.typed;
    $('romaNext').textContent = v.rest.slice(0, 1);
    $('romaGuide').textContent = v.rest.slice(1);
    const nx = g.o.words[(g.wi + 1) % g.o.words.length];
    $('nextWord').textContent = nx ? 'つぎ： ' + nx : '';
    $('gMeN').textContent = g.n + 'もじ';
    if (newWord) {
        fitText($('word'), wordMax(), 20);
        fitText($('roma'), Math.round(wordMax() * 0.55), 13);
    }
    /* つぎに おす キー */
    const next = v.rest[0] || null;
    kbd.light(next);
    const f = next ? fingerOf(next) : null;
    $('fingerHint').innerHTML = '&nbsp;';
    if (next) {
        const k = document.createElement('b');
        k.textContent = next.toUpperCase();
        $('fingerHint').replaceChildren('つぎは ', k, f != null ? ` ・ ${FINGER_NAMES[f]}` : '');
    }
}

/* ── あいての ようす ───────────────────────── */
function paintFoe() {
    const g = cur;
    const p = g.foe;
    const w = g.o.words[(p.w || 0) % g.o.words.length] || '';
    const k = Math.min(p.k || 0, w.length);
    $('foeDone').textContent = w.slice(0, k);
    $('foeRest').textContent = w.slice(k);
    $('foeBuf').textContent = p.buf || ' ';
    $('foeMiss').textContent = 'まちがい ' + (p.miss || 0);
    $('gFoeN').textContent = (p.n || 0) + 'もじ';
    fitText($('foeWord'), 34, 14);
}

/* ── つなと おうえん ───────────────────────── */
function paintRope() {
    const g = cur;
    const goal = g.o.goal;
    const diff = g.n - (g.foe.n || 0);
    const r = Math.max(-1, Math.min(1, diff / goal));
    $('ropeG').style.transform = `translateX(${-r * ROPE_RANGE}px)`;
    if (!g.live) return;

    const t = Date.now();
    const sign = Math.sign(diff);
    /* まけていたのに ぬいた */
    if (g.lastSign < 0 && sign > 0) g.flipUntil = t + 1800;
    if (sign !== 0) g.lastSign = sign;

    let msg, mood;
    if (t < g.flipUntil)   { msg = 'ぎゃくてん！';        mood = 'good'; }
    else if (r >= 0.75)    { msg = `もうちょっと！ あと ${goal - diff}もじ`; mood = 'good'; }
    else if (r >= 0.4)     { msg = 'いいぞ！ その ちょうし！'; mood = 'good'; }
    else if (r > 0)        { msg = 'がんばれ！';          mood = 'good'; }
    else if (r === 0)      { msg = 'がんばれ！ いい しょうぶ！'; mood = 'even'; }
    else if (r > -0.4)     { msg = 'まけるな！';          mood = 'bad'; }
    else if (r > -0.75)    { msg = 'ふんばれ！ まだ いける！'; mood = 'bad'; }
    else                   { msg = 'あぶない！';          mood = 'bad'; }
    setCheer(msg, mood);
}

function setCheer(msg, mood) {
    const el = $('cheer');
    if (!cur || cur.cheer === msg) return;
    cur.cheer = msg;
    el.textContent = msg;
    el.className = 'cheer' + (msg ? ' show ' + (mood || '') : '');
    /* ことばが かわるたびに ぽんっと 出す */
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
}

/* ── キー ───────────────────────────────────── */
window.addEventListener('keydown', e => {
    const g = cur;
    if (!g || g.ended) return;
    if (e.key === 'Process' || e.isComposing || e.keyCode === 229) {
        $('imeWarn').classList.remove('hidden');
        e.preventDefault();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    /* スペースや エンターで ボタンが おされない ように */
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!g.live) return;
    const key = e.key.toLowerCase();
    if (!/^[a-z\-',.!?]$/.test(key)) return;
    $('imeWarn').classList.add('hidden');
    const before = g.wi;
    const ok = typeKey(g, key);
    kbd.press(key, ok);
    paintMine(g.wi !== before);
    paintRope();
    g.o.onProg(progOf(g));
    checkGoal();
});

function typeKey(g, key) {
    const r = g.typer.input(key);
    if (!r.ok) {
        g.miss++;
        sound.miss();
        const w = $('word');
        w.classList.remove('shake');
        void w.offsetWidth;
        w.classList.add('shake');
        return false;
    }
    g.n += r.kana;
    if (!r.carry) g.keys++;
    if (g.typer.done()) {
        savePrefs();
        g.wi++;
        g.typer = createTyper(g.o.words[g.wi % g.o.words.length], prefs);
        sound.word();
        if (r.carry) typeKey(g, r.carry);
    }
    return true;
}

function checkGoal() {
    const g = cur;
    if (!g || !g.live || g.goalSent) return;
    if (g.n - (g.foe.n || 0) >= g.o.goal) {
        g.goalSent = true;
        g.o.onGoal();
    }
}

/* ── じかん ─────────────────────────────────── */
function tick() {
    const g = cur;
    if (!g || g.ended) return;
    const o = g.o;
    const t = o.now();
    const cd = $('countdown');
    if (t < o.startsAt) {
        const n = Math.ceil((o.startsAt - t) / 1000);
        cd.classList.remove('hidden');
        $('cdNum').textContent = n > 3 ? 'よーい' : n;
        if (n <= 3 && n !== g.lastCd) { g.lastCd = n; sound.count(); }
    } else if (!g.live && !g.timeUp) {
        g.live = true;
        cd.classList.add('hidden');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        sound.go();
        setCheer('よーい どん！', 'even');
        setTimeout(() => { if (cur === g) paintRope(); }, 1200);
    }

    const left = Math.max(0, Math.ceil((o.endsAt - Math.max(t, o.startsAt)) / 1000));
    $('gTimer').textContent = left;
    $('gTimer').classList.toggle('hurry', left <= 10);
    if (g.live && left <= 5 && left > 0 && left !== g.lastTick) { g.lastTick = left; sound.tick(); }

    if (t >= o.endsAt && !g.timeUp) {
        g.timeUp = true;
        g.live = false;
        setCheer('そこまで！', 'even');
        o.onProg(progOf(g));            // さいごの すすみを 送ってから
        o.onTimeUp();
    }
}

/* ── けっか ─────────────────────────────────── */
/**
 * @param r {won, draw, reason, foe:{n, miss}, buttons:[{label, cls, onClick}]}
 */
function showResult(g, r) {
    if (g.ended) return;
    g.ended = true;
    g.live = false;
    clearInterval(g.timer);
    kbd.light(null);
    $('countdown').classList.add('hidden');

    $('resMedal').textContent = r.draw ? '🤝' : r.won ? '🥇' : '💪';
    $('resTitle').textContent = r.draw ? 'ひきわけ' : r.won ? 'かち！' : 'まけ… くやしい！';
    $('resTitle').className = r.draw ? '' : r.won ? 'win' : 'lose';
    const why = {
        goal: r.won ? 'つなを ひっぱりきったよ！' : 'つなを ひっぱられちゃった。つぎは まけないぞ！',
        time: r.draw ? 'じかん ぎれ。打った もじが おなじ だったよ'
            : r.won ? 'じかん ぎれ。あなたの ほうが たくさん 打てたよ！' : 'じかん ぎれ。あいての ほうが すこし 多かったね',
        left: r.won ? 'あいてが いなく なったので、あなたの かちです' : 'つうしんが きれてしまいました'
    };
    $('resWhy').textContent = why[r.reason] || '';

    const o = g.o;
    const mins = Math.max(1000, Math.min(r.endedAt || o.endsAt, o.endsAt) - o.startsAt) / 60000;
    $('resMe').textContent = o.meName;
    $('resFoe').textContent = o.foeName;
    $('resN1').textContent = g.n;
    $('resN2').textContent = r.foe.n || 0;
    $('resS1').textContent = Math.round(g.n / mins) + 'もじ';
    $('resS2').textContent = Math.round((r.foe.n || 0) / mins) + 'もじ';
    $('resM1').textContent = g.miss;
    $('resM2').textContent = r.foe.miss || 0;

    const row = $('resButtons');
    row.textContent = '';
    for (const b of r.buttons) {
        const el = document.createElement('button');
        el.className = 'btn ' + (b.cls || '');
        el.textContent = b.label;
        el.addEventListener('click', b.onClick);
        row.appendChild(el);
    }
    $('resultBox').classList.remove('hidden');
    setCheer(r.draw ? '' : r.won ? 'やったね！' : 'よく がんばった！', r.won ? 'good' : 'even');
    if (r.draw) sound.draw(); else if (r.won) sound.win(); else sound.lose();
}
