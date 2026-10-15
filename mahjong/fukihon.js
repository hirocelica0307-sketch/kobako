/* 符と 役を いちから（点数計算 ＞ いちから）の 画面
   ステップの 一覧 → せつめい → 問題 8問 → けっか。問題と こたえは fu-course.js。 */
import { STEPS, PASS, PER_STEP, makeSession, kindsOf } from './fu-course.js';
import { tileImage, sortTiles } from './tiles.js';
import { store, save } from './store.js';
import { sfx } from './sound.js';
import { icon } from './assets/icons.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let view = { name: 'list', step: 0 };
export function resetKihonView() { view = { name: 'list', step: 0 }; }

const prog = () => store.kihon || (store.kihon = { best: {} });
const best = i => prog().best[STEPS[i].id] || 0;
const cleared = i => best(i) >= PASS;
const unlocked = i => i === 0 || cleared(i - 1) || cleared(i);
const nowStep = () => { const i = STEPS.findIndex((_, j) => !cleared(j)); return i < 0 ? STEPS.length : i; };

/* ── 牌の 絵 ── */
// <p> の 中でも つかえる ように span で つくる（div だと 段落が きれる）
const T = (id, cls = '') => `<span class="t ${cls}"><i style="background-image:url(${tileImage(id, true)})"></i></span>`;
const B = (cls = '') => `<span class="t back ${cls}"></span>`;
const kid = k => k * 4 + 1;   // 絵だけの 牌（赤5に ならない id）

/** 面子 1つ（種類 or id の ならび） */
function groupHTML(kind, ids, win = -1) {
    const one = (id, i, extra = '') => T(id, `${i === win ? 'fk-win' : ''} ${extra}`);
    if (kind === 'pon' || kind === 'chi' || kind === 'minkan') return `<span class="meld">${ids.map((id, i) => one(id, i, i === 0 ? 'side' : '')).join('')}</span>`;
    if (kind === 'ankan') return `<span class="meld">${ids.map((id, i) => (i === 0 || i === 3 ? B() : one(id, i))).join('')}</span>`;
    if (kind === 'win') return `<span class="fk-g">${ids.map((id, i) => one(id, 0)).join('')}</span>`;
    return `<span class="fk-g">${ids.map((id, i) => one(id, i)).join('')}</span>`;
}

/** せつめいの {{t:123m}} などを 牌の 絵に */
function lessonHTML(html) {
    return html.replace(/\{\{(t|pon|chi|kan|ankan|w):([0-9mpsz]+)\}\}/g, (_, kind, str) => {
        const ids = kindsOf(str).map(kid);
        const k = { t: 'closed', pon: 'pon', chi: 'chi', kan: 'minkan', ankan: 'ankan', w: 'win' }[kind];
        return `<span class="fk-in">${groupHTML(k, ids, kind === 'w' ? 0 : -1)}</span>`;
    });
}

function twFor(n) {
    const W = Math.min(window.innerWidth, 560) - 64;
    return Math.max(16, Math.min(40, Math.floor(W / (n + 0.6))));
}

/** 問題の 絵（面子の ならび） */
function showHTML(show) {
    const n = show.reduce((s, g) => s + g.tiles.length + 1, 0);
    const tw = Math.min(46, twFor(n + 2));
    return `<div class="fk-show" style="--qtw:${tw}px">${show.map(g => `<div class="fk-sg ${g.kind === 'win' ? 'is-win' : ''}">${groupHTML(g.kind, g.tiles.map(kid), g.win)}${g.label ? `<small>${esc(g.label)}</small>` : ''}</div>`).join('')}</div>`;
}

/** あがった 手（grouped：面子ごとに 分けて 見せる） */
function handHTML(h, grouped) {
    if (grouped || h.chiitoi) {
        const n = h.groups.reduce((s, g) => s + g.ids.length, 0) + h.groups.length * 0.5;
        return `<div class="tiles-row fk-hand grouped" style="--qtw:${twFor(n)}px">${h.groups.map(g => groupHTML(g.kind === 'pair' ? 'closed' : g.kind, g.ids, g.win)).join('<span class="gap"></span>')}</div>`;
    }
    const closed = h.ctx.closed.filter(id => id !== h.ctx.winTile);
    const melds = h.ctx.melds;
    const n = closed.length + 1 + melds.reduce((s, m) => s + m.tiles.length + 0.4, 0) + 1;
    return `<div class="tiles-row fk-hand" style="--qtw:${twFor(n)}px">${sortTiles(closed).map(id => T(id)).join('')}<span class="gap"></span>${T(h.ctx.winTile, 'fk-win')}${melds.length ? '<span class="gap"></span>' + melds.map(m => groupHTML(m.type, m.tiles)).join('<span class="gap"></span>') : ''}</div>`;
}

/** 符の 内わけ（表） */
function partsHTML(parts, r, hideTotal = false) {
    const rows = parts.map(p => `<tr><td>${esc(p.name)}</td><td>${p.v}符</td></tr>`).join('');
    if (hideTotal) return `<table class="cx-t fk-parts">${rows}<tr class="sum"><td>合計</td><td>？</td></tr></table>`;
    const raw = r && r.fuParts && r.fuParts.raw;
    const sum = raw != null ? `<tr class="sum"><td>合計</td><td>${raw}符</td></tr>` : '';
    const round = r && r.fuParts && r.fuParts.round ? `<tr><td colspan="2" class="cx-note">${esc(r.fuParts.round)}</td></tr>` : '';
    return `<table class="cx-t fk-parts">${rows}${sum}${round}<tr class="sum"><td>こたえ</td><td>${r.fu}符</td></tr></table>`;
}

/* ── 画面 ── */

export function renderKihon(body) {
    if (view.name === 'lesson') return renderLesson(body);
    if (view.name === 'quiz') return renderQuiz(body);
    if (view.name === 'result') return renderResult(body);
    renderList(body);
}

function go(body, v) { sfx.button(); view = v; renderKihon(body); window.scrollTo(0, 0); }

function renderList(body) {
    const done = STEPS.filter((_, i) => cleared(i)).length;
    const now = nowStep();
    body.innerHTML = `<div class="fk">
<p class="fk-lead">符（ふ）と 役を <b>いちから じゅんばんに</b> おぼえる コースです。<br>ステップごとに せつめいを 読んで、問題 ${PER_STEP}問。<b>${PASS}問 いじょう せいかい</b>で つぎの ステップが ひらきます。</p>
<div class="fk-total"><div class="fk-bar"><i style="width:${Math.round(done / STEPS.length * 100)}%"></i></div><span>${done} / ${STEPS.length} クリア</span></div>
<div class="fk-steps">${STEPS.map((s, i) => {
        const st = cleared(i) ? 'done' : unlocked(i) ? 'open' : 'lock';
        const tag = st === 'done' ? `${icon('check')} クリア（${best(i)}/${PER_STEP}）` : st === 'open' ? (i === now ? 'いま ここ' : 'ちょうせん できる') : 'まだ';
        return `<button class="fk-step ${st} ${i === now ? 'now' : ''}" data-step="${i}" ${st === 'lock' ? 'disabled' : ''}><span class="fk-no">${i + 1}</span><span class="fk-tx"><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span><span class="fk-st">${tag}</span></button>`;
    }).join('')}</div>
${done === STEPS.length ? `<div class="fk-fin">${icon('trophy')} ぜんぶ クリア！ つぎは 上の「練習」で <b>② 翻と 符から 点数</b> と <b>③ 実戦問題</b>、ホームの「麻雀ドリル」の 何符・何点に ちょうせん しよう。</div>` : '<p class="note">まだ ひらいて いない ステップは、ひとつ まえを クリアすると ひらきます。</p>'}
</div>`;
    body.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => go(body, { name: 'lesson', step: Number(b.dataset.step) })));
}

function renderLesson(body) {
    const i = view.step, s = STEPS[i];
    body.innerHTML = `<div class="fk">
<button class="link fk-back">${icon('arrow-left')} ステップの 一覧</button>
<div class="fk-head"><span class="fk-no big">${i + 1}</span><div><h3>${esc(s.title)}</h3><small>${esc(s.sub)}</small></div></div>
<div class="fk-lesson guide">${lessonHTML(s.lesson)}</div>
<div class="rs-btns"><button class="btn primary fk-start">${icon('play')} 問題に ちょうせん（${PER_STEP}問）</button></div>
${s.id === 'yaku' ? '<div class="rs-btns"><button class="btn" data-go="yakuref">役を おぼえる（動画）を 見る</button></div>' : ''}
</div>`;
    body.querySelector('.fk-back').addEventListener('click', () => go(body, { name: 'list' }));
    body.querySelector('.fk-start').addEventListener('click', () => go(body, { name: 'quiz', step: i, qs: makeSession(i), qi: 0, ok: 0 }));
}

function renderQuiz(body) {
    const i = view.step, s = STEPS[i], q = view.qs[view.qi];
    const dots = view.qs.map((_, j) => `<i class="${j < view.qi ? (view.marks[j] ? 'ok' : 'ng') : j === view.qi ? 'cur' : ''}"></i>`).join('');
    const chips = (q.chips || []).map(c => `<span class="hl">${esc(c)}</span>`).join('');
    const visual = q.hand ? handHTML(q.hand, q.grouped) : q.show ? showHTML(q.show) : '';
    const partsQ = !q.hand && q.parts ? partsHTML(q.parts, null, true) : '';
    body.innerHTML = `<div class="fk">
<div class="fk-qtop"><button class="link fk-back">${icon('arrow-left')} ${i + 1}. ${esc(s.title)}</button><span>${view.qi + 1} / ${view.qs.length}</span></div>
<div class="fk-dots">${dots}</div>
<div class="q-card">
${chips ? `<div class="q-info">${chips}</div>` : ''}
${visual}${partsQ}
<div class="q-ask">${esc(q.ask)}</div>
<div class="q-choices ${q.choices.length === 2 ? 'two' : ''}">${q.choices.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
<div class="q-result"></div>
</div>
<details class="pv-d fk-recap"><summary>せつめいを もう一度 見る</summary><div class="guide">${lessonHTML(s.lesson)}</div></details>
</div>`;
    body.querySelector('.fk-back').addEventListener('click', () => go(body, { name: 'lesson', step: i }));
    const area = body.querySelector('.q-card');
    area.querySelector('.q-choices').addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (!b || area.dataset.answered) return;
        area.dataset.answered = '1';
        const ok = b.dataset.c === q.answer;
        view.marks = view.marks || [];
        view.marks[view.qi] = ok;
        if (ok) view.ok++;
        ok ? sfx.yaku(1) : sfx.ryuukyoku();
        area.querySelectorAll('.q-choices button').forEach(x => {
            if (x.dataset.c === q.answer) x.classList.add('ok');
            else if (x === b) x.classList.add('ng');
        });
        const last = view.qi + 1 >= view.qs.length;
        const ex = `${q.explain ? `<p class="fk-ex">${esc(q.explain)}</p>` : ''}${q.hand ? partsHTML(q.parts, q.hand.result) : ''}`;
        area.querySelector('.q-result').innerHTML = `<div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? 'せいかい！' : `ざんねん … こたえは ${esc(q.answer)}`}</div>${ex}
<div class="rs-btns"><button class="btn primary fk-next">${last ? 'けっかを 見る' : 'つぎの 問題'}</button></div>`;
        area.querySelector('.fk-next').addEventListener('click', () => {
            if (last) {
                const id = STEPS[i].id;
                const was = cleared(i);
                prog().best[id] = Math.max(best(i), view.ok);
                save();
                go(body, { name: 'result', step: i, ok: view.ok, newly: !was && cleared(i) });
            } else { view.qi++; sfx.button(); renderQuiz(body); window.scrollTo(0, 0); }
        });
        area.querySelector('.q-result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

function renderResult(body) {
    const i = view.step, s = STEPS[i], pass = view.ok >= PASS;
    const next = STEPS[i + 1];
    if (pass) sfx.yaku(3);
    body.innerHTML = `<div class="fk">
<div class="fk-res ${pass ? 'ok' : 'ng'}">
  <div class="fk-score">${view.ok} <small>/ ${PER_STEP}</small></div>
  <p>${pass ? (view.newly ? `${icon('check')} ステップ ${i + 1}「${esc(s.title)}」 クリア！${next ? `<br>ステップ ${i + 2}「${esc(next.title)}」が ひらきました。` : '<br>ぜんぶの ステップを クリアしました！'}` : `クリア！ よく おぼえて います。`)
        : `あと ${PASS - view.ok}問 で クリア。<br>せつめいを もう一度 見てから ちょうせん しよう。`}</p>
</div>
<div class="rs-btns">
${pass && next ? `<button class="btn primary fk-go-next">${icon('play')} つぎの ステップへ</button>` : ''}
${pass ? '' : `<button class="btn primary fk-lesson">${icon('book-open-text')} せつめいを 見る</button>`}
<button class="btn fk-retry">${icon('arrow-clockwise')} もう一度</button>
<button class="btn fk-list">ステップの 一覧</button>
</div>
${pass && !next ? '<div class="fk-fin">つぎは 上の「練習」の <b>② 翻と 符から 点数</b> ➜ <b>③ 実戦問題</b>、ホームの「麻雀ドリル」の 何符・何点 に ちょうせん しよう！</div>' : ''}
</div>`;
    const on = (sel, fn) => { const el = body.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('.fk-go-next', () => go(body, { name: 'lesson', step: i + 1 }));
    on('.fk-lesson', () => go(body, { name: 'lesson', step: i }));
    on('.fk-retry', () => go(body, { name: 'quiz', step: i, qs: makeSession(i), qi: 0, ok: 0 }));
    on('.fk-list', () => go(body, { name: 'list' }));
}
