/* 役を おぼえる（一覧・お手本の 再生・役当てクイズ）
   ------------------------------------------------------------------
   お手本（yaku-lessons.js）を 1コマずつ 動画の ように 再生します。
   ツモ・捨てる・ポン・カン・あがり が うごいて、妖精が 吹き出しで 説明（読みあげも できる）。
   さいごに evaluateWin で 計算した 役・翻・符・点数と、手の 分けかた（順子・刻子・雀頭）を 出します。
   ------------------------------------------------------------------ */
import { LESSONS, replay, finalCtx, parseKinds, speechText } from './yaku-lessons.js';
import { evaluateWin } from './score.js';
import { decompositions, shanten } from './hand.js';
import { pointsLabel } from './calc.js';
import { DEFAULT_RULES } from './engine.js';
import { tileImage } from './tiles.js';
import { store, save } from './store.js';
import { sfx, say, stopVoice } from './sound.js';
import { icon } from './assets/icons.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kid = k => k * 4 + ((k === 4 || k === 13 || k === 22) ? 1 : 0);
const T = (k, { side = false, back = false, cls = '' } = {}) => back
    ? `<div class="t back ${side ? 'side' : ''} ${cls}"></div>`
    : `<div class="t ${side ? 'side' : ''} ${cls}"><i style="background-image:url(${tileImage(kid(k), true)})"></i></div>`;
/** 説明文の [5m] を 牌の 絵に */
const capHTML = s => esc(s).replace(/\[([0-9]+[mpsz])\]/g, (_, t) => `<span class="yl-inl">${parseKinds(t).map(k => T(k)).join('')}</span>`);
const WIND = ['東', '南', '西', '北'];
const QUIZ_SKIP = new Set(['katachi', 'riichi', 'ippatsu', 'wriichi', 'rinshan', 'chankan', 'haitei', 'houtei', 'tenhou', 'chiihou', 'nagashi', 'tsumo']);

let view = { mode: 'list' };   // list / play / quiz
let timer = null;

function seen() { store.yakuSeen = store.yakuSeen || {}; return store.yakuSeen; }
function stop() { if (timer) { clearTimeout(timer); timer = null; } stopVoice(); }

export function resetYakuView() { stop(); view = { mode: 'list' }; }

export function renderYaku(root, back) {
    stop();
    if (view.mode === 'play') return renderPlayer(root, back);
    if (view.mode === 'quiz') return renderQuiz(root, back);
    const groups = [...new Set(LESSONS.map(l => l.group))];
    const sn = seen();
    const done = LESSONS.filter(l => sn[l.id]).length;
    root.innerHTML = `<div class="page">
${back}
<h2>役を おぼえる</h2>
<p class="note">役（ヤク）は「この 形で あがると 点数が つく」という きまり。役が 1つも ないと あがれません。<br>▶ を おすと、お手本の 手が 動画の ように すすんで、妖精が 説明します。見おわった 役には ✓ が つきます（${done} / ${LESSONS.length}）。</p>
<button class="btn primary yl-quiz-btn">${icon('lightbulb')} 役当てクイズ（この あがりの 役は？）</button>
<p class="note">点数の めやす：満貫 8000（親 12000）・跳満 12000・倍満 16000・三倍満 24000・役満 32000（親は 1.5倍）。「鳴くと 1翻」は ポン・チーすると 翻が 1つ さがる（食い下がり）。「門前のみ」は 鳴くと つかない 役。</p>
${groups.map(g => `<h3 class="yk-h">${esc(g)}</h3><div class="yl-list">${LESSONS.filter(l => l.group === g).map(l => `<button class="yl-item${sn[l.id] ? ' seen' : ''}" data-play="${l.id}">
<span class="yl-play">${icon('play')}</span><span class="yl-txt"><b>${esc(l.name)}</b><small>${esc(l.reading)}${l.han ? ' ・ ' + esc(l.han) : ''}${l.tag ? ' ・ ' + esc(l.tag) : ''}</small><span class="yl-pt">${capHTML(l.point)}</span></span>${sn[l.id] ? '<span class="yl-check">✓</span>' : ''}</button>`).join('')}</div>`).join('')}
</div>`;
    root.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => { sfx.button(); view = { mode: 'play', id: b.dataset.play, i: 0, playing: true }; renderYaku(root, back); window.scrollTo(0, 0); }));
    root.querySelector('.yl-quiz-btn').addEventListener('click', () => { sfx.button(); view = { mode: 'quiz' }; renderYaku(root, back); window.scrollTo(0, 0); });
}

/* ── 再生 ── */
const SPEEDS = { slow: 1.5, normal: 1, fast: 0.65 };

function renderPlayer(root, back) {
    const L = LESSONS.find(l => l.id === view.id);
    const { frames, final } = replay(L);
    const result = final ? evaluateWin(finalCtx(final, DEFAULT_RULES)) : null;
    const idx = LESSONS.indexOf(L);
    const next = LESSONS[idx + 1];
    store.settings.lessonSpeed = store.settings.lessonSpeed || 'normal';
    if (store.settings.lessonVoice === undefined) store.settings.lessonVoice = true;
    root.innerHTML = `<div class="page yl-page">
<button class="back yl-back">${icon('arrow-left')}<span>役の 一覧</span></button>
<h2 class="yl-title">${esc(L.name)} <small>${esc(L.reading)}</small></h2>
<div class="q-info">${L.han ? `<span class="hl">${esc(L.han)}</span>` : ''}${L.tag ? `<span>${esc(L.tag)}</span>` : ''}${L.special ? '' : `<span>自風 ${WIND[L.seat]}</span><span>場風 ${WIND[L.round]}</span>`}${L.seat === 0 ? '<span class="hl">親</span>' : ''}</div>
<div class="yl-stage">
  <div class="yl-top"><div class="yl-river-wrap"><small>捨て牌</small><div class="yl-river"></div></div><div class="yl-other"></div></div>
  <div class="yl-cap"><img src="assets/fx/fairy.webp" alt=""><div class="yl-bubble"></div></div>
  <div class="yl-status"></div>
  <div class="yl-handrow"><div class="yl-hand"></div><div class="yl-melds"></div></div>
  <div class="yl-word"></div>
</div>
<div class="yl-bar"><i></i></div>
<div class="yl-ctrl">
  <button class="btn" data-c="first">${icon('arrow-clockwise')}<span>さいしょ</span></button>
  <button class="btn" data-c="prev">${icon('arrow-left')}<span>もどる</span></button>
  <button class="btn primary" data-c="play"></button>
  <button class="btn" data-c="next"><span>つぎへ</span></button>
</div>
<div class="yl-opts">
  <div class="seg small" data-o="speed">${[['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']].map(([v, l]) => `<button data-v="${v}" class="${store.settings.lessonSpeed === v ? 'on' : ''}">${l}</button>`).join('')}</div>
  <button class="btn yl-voice">${icon(store.settings.lessonVoice ? 'speaker-high' : 'speaker-slash')}<span>読みあげ</span></button>
</div>
<div class="yl-result" hidden></div>
</div>`;
    const $ = s => root.querySelector(s);
    $('.yl-back').addEventListener('click', () => { sfx.button(); resetYakuView(); renderYaku(root, back); });
    const playBtn = $('[data-c="play"]');
    const setPlayBtn = () => { playBtn.innerHTML = view.playing ? `<span>とめる</span>` : `${icon('play')}<span>再生</span>`; };

    let prev = null;
    const show = (i, animate) => {
        const f = frames[i];
        view.i = i;
        // 捨て牌
        $('.yl-river').innerHTML = f.river.map((k, j) => T(k, { side: j === f.riichiAt, cls: animate && f.ev === 'discard' && j === f.river.length - 1 ? 'yl-drop' : (f.ev === 'other' && L.special && j === f.river.length - 1 && animate ? 'yl-drop' : '') })).join('');
        // 相手の 牌（鳴き・加槓）
        const ot = $('.yl-other');
        if ((f.ev === 'call' && f.word !== 'カン') || (f.ev === 'other' && !L.special) || (f.ev === 'win' && !f.tsumo)) {
            ot.innerHTML = `<small>${f.ev === 'win' ? '相手の 捨て牌' : f.ev === 'other' ? '相手が 加槓' : '相手の 捨て牌'}</small>${T(f.tile, { cls: animate ? 'yl-fly' : '' })}`;
        } else ot.innerHTML = '';
        // 説明
        $('.yl-bubble').innerHTML = capHTML(f.cap);
        if (animate) { const b = $('.yl-cap'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
        // 手牌
        const hl = new Set(f.hl || []);
        const isNew = f.ev === 'draw';
        let handTiles = f.hand.map(k => T(k, { cls: hl.has(k) ? 'yl-hl' : '' })).join('');
        if (f.drawn !== null) handTiles += `<span class="gap"></span>${T(f.drawn, { cls: (isNew && animate ? 'yl-in ' : '') + (hl.has(f.drawn) ? 'yl-hl' : '') })}`;
        if (f.ev === 'win') handTiles += `<span class="gap"></span>${T(f.tile, { cls: 'yl-win' + (animate ? ' yl-in' : '') })}`;
        $('.yl-hand').innerHTML = handTiles;
        $('.yl-melds').innerHTML = f.melds.map((m, j) => {
            const fresh = animate && f.ev === 'call' && j === f.melds.length - 1 ? ' yl-pop' : '';
            if (m.type === 'ankan') return `<div class="meld${fresh}">${m.kinds.map((k, n) => T(k, { back: n === 0 || n === 3 })).join('')}</div>`;
            const calledAt = m.type === 'chi' ? m.kinds.indexOf(m.called) : 2;
            const order = m.type === 'chi' ? [m.called, ...m.kinds.filter((k, n) => n !== calledAt)] : m.kinds;
            return `<div class="meld${fresh}">${order.map((k, n) => T(k, { side: m.type === 'chi' ? n === 0 : n === 2 })).join('')}</div>`;
        }).join('');
        // テンパイまで
        const st = $('.yl-status');
        if (L.special || f.ev === 'win' || f.ev === 'start' && !f.hand.length) st.textContent = f.ev === 'win' ? (f.tsumo ? 'ツモ！' : 'ロン！') : '';
        else {
            const c = new Array(34).fill(0);
            for (const k of f.hand) c[k]++;
            if (f.drawn !== null) c[f.drawn]++;
            const n = f.hand.length + (f.drawn !== null ? 1 : 0);
            const s = shanten(c, f.melds.length);
            st.textContent = s === -1 ? 'あがりの 形' : n % 3 === 2 ? `（1枚 捨てる ばん）` : s === 0 ? 'テンパイ（あと 1枚で あがり）' : `テンパイまで あと ${s}まい`;
        }
        // 大きな 文字
        const w = $('.yl-word');
        w.textContent = '';
        if (animate && (f.ev === 'call' || f.ev === 'win' || (f.ev === 'discard' && f.riichiAt === f.river.length - 1 && prev && prev.riichiAt !== f.riichiAt))) {
            w.textContent = f.ev === 'win' ? (f.tsumo ? 'ツモ！' : 'ロン！') : f.ev === 'call' ? f.word + '！' : 'リーチ！';
            w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
        }
        if (animate) {
            if (f.ev === 'draw') sfx.draw();
            if (f.ev === 'discard' || f.ev === 'other') sfx.discard();
            if (f.ev === 'call') sfx.call();
            if (f.ev === 'win') { sfx.slam(); setTimeout(() => sfx.stamp(result ? Math.min(5, result.yakuman ? 5 : result.han >= 6 ? 3 : 1) : 1), 250); }
            if (store.settings.lessonVoice) say(speechText(f.cap), null, { rate: 1.1 });
        }
        $('.yl-bar i').style.width = `${Math.round((i + 1) / frames.length * 100)}%`;
        prev = f;
        if (i === frames.length - 1) finish();
    };

    const finish = () => {
        seen()[L.id] = true; save();
        const box = $('.yl-result');
        box.hidden = false;
        let body = '';
        if (result) {
            const groups = groupsHTML(final);
            const dealer = L.seat === 0;
            const label = pointsLabel(result.base, dealer, final.tsumo);
            body = `<h3>あがりの 手</h3>${groups}
<table class="dr-t">${result.yaku.map(y => `<tr class="${L.expect.flat().includes(y.name) ? 'best' : ''}"><td>${esc(y.name)}</td><td>${y.yakuman ? (y.yakuman > 1 ? 'ダブル役満' : '役満') : y.han + '翻'}</td></tr>`).join('')}
<tr><td><b>合計</b></td><td><b>${result.yakuman ? (result.yakuman > 1 ? `${result.yakuman}倍役満` : '役満') : `${result.han}翻 ${result.fu}符`}</b></td></tr></table>
<p>${dealer ? '親' : '子'}の ${final.tsumo ? 'ツモ' : 'ロン'}：<b>${esc(label)}</b>${result.name ? `（${esc(result.name)}）` : ''}</p>`;
        } else body = '<p>流し満貫は 満貫と 同じ 点数（子 8000点・親 12000点を ツモと 同じ はらいかたで もらう）。</p>';
        box.innerHTML = `<div class="yl-sum"><b>${esc(L.name)}の ポイント</b><p>${capHTML(L.point)}</p></div>${body}
<div class="rs-btns">${next ? `<button class="btn primary yl-next">つぎの 役：${esc(next.name)}</button>` : ''}<button class="btn yl-again">${icon('arrow-clockwise')} もう一度</button><button class="btn yl-list">一覧へ</button></div>`;
        box.querySelector('.yl-again').addEventListener('click', () => { sfx.button(); view = { mode: 'play', id: L.id, i: 0, playing: true }; renderYaku(root, back); });
        box.querySelector('.yl-list').addEventListener('click', () => { sfx.button(); resetYakuView(); renderYaku(root, back); });
        const nb = box.querySelector('.yl-next');
        if (nb) nb.addEventListener('click', () => { sfx.button(); view = { mode: 'play', id: next.id, i: 0, playing: true }; renderYaku(root, back); window.scrollTo(0, 0); });
        view.playing = false;
        setPlayBtn();
    };

    const schedule = () => {
        if (timer) clearTimeout(timer);
        if (!view.playing || view.i >= frames.length - 1) return;
        const f = frames[view.i];
        const per = store.settings.lessonVoice ? 125 : 85;
        const ms = Math.max(1800, Math.min(9000, 900 + speechText(f.cap).length * per)) * (SPEEDS[store.settings.lessonSpeed] || 1);
        timer = setTimeout(() => { if (!root.isConnected) return; show(view.i + 1, true); schedule(); }, ms);
    };

    root.querySelector('.yl-ctrl').addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (!b) return;
        sfx.button();
        const c = b.dataset.c;
        if (c === 'play') {
            if (view.i >= frames.length - 1) { $('.yl-result').hidden = true; view.playing = true; show(0, true); }
            else view.playing = !view.playing;
            if (!view.playing) { stop(); }
        }
        if (c === 'first') { view.playing = false; stop(); $('.yl-result').hidden = true; show(0, true); }
        if (c === 'prev') { view.playing = false; stop(); $('.yl-result').hidden = true; show(Math.max(0, view.i - 1), false); }
        if (c === 'next') { view.playing = false; stop(); if (view.i < frames.length - 1) show(view.i + 1, true); }
        setPlayBtn();
        schedule();
    });
    root.querySelector('[data-o="speed"]').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        sfx.button();
        store.settings.lessonSpeed = b.dataset.v; save();
        root.querySelectorAll('[data-o="speed"] button').forEach(x => x.classList.toggle('on', x === b));
        schedule();
    });
    $('.yl-voice').addEventListener('click', () => {
        store.settings.lessonVoice = !store.settings.lessonVoice; save();
        $('.yl-voice').innerHTML = `${icon(store.settings.lessonVoice ? 'speaker-high' : 'speaker-slash')}<span>読みあげ</span>`;
        if (!store.settings.lessonVoice) stopVoice();
        sfx.button();
    });
    setPlayBtn();
    show(view.i || 0, true);
    schedule();
}

/** あがりの 手を 面子ごとに わけて 見せる */
function groupsHTML(final) {
    const c = new Array(34).fill(0);
    for (const k of final.closed) c[k]++;
    const label = g => (g.length === 2 ? '雀頭' : g[0] === g[1] ? (g.length === 4 ? '槓子' : '刻子') : '順子');
    const grp = (g, extra = '') => `<span class="yl-grp"><span class="yl-gt">${g.map(k => T(k, { cls: k === final.win && extra === 'win' ? 'yl-win' : '' })).join('')}</span><small>${label(g)}</small></span>`;
    let parts = [];
    const ds = final.melds.length === 0 && decompositions(c.slice()).length === 0 ? [] : decompositions(c.slice());
    if (ds.length) {
        const d = ds[0];
        parts = d.sets.map(s => (s.type === 'koutsu' ? [s.k, s.k, s.k] : [s.k, s.k + 1, s.k + 2])).map(g => grp(g));
        parts.push(grp([d.head, d.head]));
    } else {
        // 七対子・国士
        const ks = []; c.forEach((n, k) => { if (n) ks.push(k); });
        parts = [`<span class="yl-grp"><span class="yl-gt">${final.closed.map(k => T(k)).join('')}</span><small>${ks.length === 7 ? '対子 7つ' : '么九牌 13種類'}</small></span>`];
    }
    for (const m of final.melds) parts.push(`<span class="yl-grp"><span class="yl-gt">${m.kinds.map((k, n) => T(k, { back: m.type === 'ankan' && (n === 0 || n === 3) })).join('')}</span><small>${m.type === 'ankan' ? '暗槓' : m.type === 'pon' ? 'ポン' : 'チー'}</small></span>`);
    return `<div class="yl-groups">${parts.join('')}</div><p class="note">あがり牌：<span class="yl-inl">${T(final.win)}</span>（${final.tsumo ? 'ツモ' : 'ロン'}）</p>`;
}

/* ── 役当てクイズ ── */
function renderQuiz(root, back) {
    const pool = LESSONS.filter(l => !QUIZ_SKIP.has(l.id) && !l.special);
    const L = pool[Math.floor(Math.random() * pool.length)];
    const { final } = replay(L);
    const r = evaluateWin(finalCtx(final, DEFAULT_RULES));
    const names = r.yaku.map(y => y.name);
    // ほかの えらびは「この 手に つかない 役」だけ
    const others = pool.filter(o => o !== L && !o.expect.flat().some(n => names.includes(n)));
    const distract = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [L, ...distract].sort(() => Math.random() - 0.5);
    store.yakuQuiz = store.yakuQuiz || { done: 0, ok: 0 };
    root.innerHTML = `<div class="page">
<button class="back yl-back">${icon('arrow-left')}<span>役の 一覧</span></button>
<h2>役当てクイズ</h2>
<div class="q-score">${store.yakuQuiz.done}問 中 ${store.yakuQuiz.ok}問 せいかい</div>
<div class="q-card">
<div class="q-info"><span class="hl">${final.tsumo ? 'ツモ' : 'ロン'}</span><span>自風 ${WIND[final.seat]}</span><span>場風 ${WIND[final.round]}</span>${final.melds.length ? '<span>鳴き あり</span>' : '<span>門前（鳴き なし）</span>'}</div>
${groupsHTML(final)}
<div class="q-ask">この あがりに つく 役は どれ？</div>
<div class="q-choices">${choices.map((c, i) => `<button data-i="${i}">${esc(c.name)}</button>`).join('')}</div>
<div class="q-result"></div>
</div></div>`;
    root.querySelector('.yl-back').addEventListener('click', () => { sfx.button(); resetYakuView(); renderYaku(root, back); });
    let answered = false;
    root.querySelector('.q-choices').addEventListener('click', e => {
        const b = e.target.closest('[data-i]');
        if (!b || answered) return;
        answered = true;
        const ok = choices[Number(b.dataset.i)] === L;
        store.yakuQuiz.done++; if (ok) store.yakuQuiz.ok++; save();
        ok ? sfx.yaku(2) : sfx.ryuukyoku();
        root.querySelectorAll('.q-choices button').forEach((x, i) => { if (choices[i] === L) x.classList.add('ok'); else if (x === b) x.classList.add('ng'); });
        const res = root.querySelector('.q-result');
        res.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? 'せいかい！' : `ざんねん … こたえは ${esc(L.name)}`}</div>
<div class="yl-sum"><b>${esc(L.name)}（${esc(L.reading)}）</b><p>${capHTML(L.point)}</p></div>
<p class="note">この 手に つく 役：${r.yaku.map(y => esc(y.name)).join('・')}</p>
<div class="rs-btns"><button class="btn primary yl-qnext">${icon('arrow-clockwise')} つぎの 問題</button><button class="btn yl-watch">${icon('play')} お手本を 見る</button></div>`;
        res.querySelector('.yl-qnext').addEventListener('click', () => { sfx.button(); renderQuiz(root, back); window.scrollTo(0, 0); });
        res.querySelector('.yl-watch').addEventListener('click', () => { sfx.button(); view = { mode: 'play', id: L.id, i: 0, playing: true }; renderYaku(root, back); window.scrollTo(0, 0); });
    });
}
