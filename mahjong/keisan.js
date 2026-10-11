/* 点数計算を おぼえる（やりかた・練習・早見表）
   ------------------------------------------------------------------
   練習の 問題は、コンピューターどうしで じっさいに 打った 対局の あがりから つくります。
   （ありえない 手は 出ません。ドラ・場風・自風・リーチなども 本物の じょうきょう）
   ------------------------------------------------------------------ */
import { Mahjong, makeRng } from './engine.js';
import { decide } from './ai.js';
import { evaluateWin, basePoints } from './score.js';
import { explainHTML, pointsLabel, quickTableHTML } from './calc.js';
import { tileImage, kindOf, sortTiles, WIND_NAMES, toCounts } from './tiles.js';
import { store, save } from './store.js';
import { sfx } from './sound.js';
import { icon } from './assets/icons.js';
import { DEFAULT_RULES } from './engine.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffleArr = (a, rng = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let tab = 'guide';
let mode = 'fu';
const pool = [];

/* ── 牌の 絵 ── */

const T = (id, { side = false, back = false, cls = '' } = {}) => back
    ? `<div class="t back ${side ? 'side' : ''} ${cls}"></div>`
    : `<div class="t ${side ? 'side' : ''} ${cls}"><i style="background-image:url(${tileImage(id, true)})"></i></div>`;

/** '123m456p' → 牌の id（例の 手 用。同じ 種類は つぎの id を つかう） */
function P(str) {
    const used = {};
    const out = [];
    let nums = [];
    for (const ch of str) {
        if (/[0-9]/.test(ch)) { nums.push(ch); continue; }
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const n of nums) {
            if (n === '0') { out.push((base + 4) * 4); continue; }
            const k = base + Number(n) - 1;
            used[k] = used[k] || 0;
            const five = k === 4 || k === 13 || k === 22;
            out.push(k * 4 + (five ? 1 : 0) + used[k]++);
        }
        nums = [];
    }
    return out;
}

function meldHTML(seat, m) {
    if (m.type === 'ankan') return `<div class="meld">${m.tiles.map((t, i) => T(t, { back: i === 0 || i === 3 })).join('')}</div>`;
    const rel = (m.from - seat + 4) % 4;
    const own = sortTiles(m.tiles.filter(t => t !== m.called && t !== m.added));
    const side = { id: m.called, side: true };
    let order;
    if (m.type === 'chi' || rel === 3) order = [side, ...own.map(id => ({ id }))];
    else if (rel === 2) order = [{ id: own[0] }, side, ...own.slice(1).map(id => ({ id }))];
    else order = [...own.map(id => ({ id })), side];
    return `<div class="meld">${order.map(o => (o.side && m.type === 'kakan')
        ? `<div class="kstack">${T(m.added, { side: true })}${T(o.id, { side: true })}</div>`
        : T(o.id, { side: !!o.side })).join('')}</div>`;
}

function handHTML(q) {
    const n = q.hand.length + 1 + q.melds.length * 3.4;
    const W = Math.min(window.innerWidth, 560) - 56;
    const tw = Math.max(16, Math.min(34, Math.floor(W / (n + 0.8))));
    return `<div class="tiles-row" style="--qtw:${tw}px">${sortTiles(q.hand).map(t => T(t)).join('')}<span class="gap"></span>${T(q.tile, { cls: 'win-tile' })}${q.melds.length ? '<span class="gap"></span>' + q.melds.map(m => meldHTML(q.seat, m)).join('') : ''}</div>`;
}

/* ── 問題づくり（コンピューターの 対局から あがりを あつめる） ── */

function harvest(minCount = 6) {
    let tries = 0;
    while (pool.length < minCount && tries++ < 6) {
        const seed = 'ks' + Math.random().toString(36).slice(2);
        const g = new Mahjong({ ...DEFAULT_RULES, length: 'tonpu' }, seed);
        g.noSnap = true;
        const rng = makeRng(seed + 'ai');
        const levels = [3, 3, 2, 2];
        let n = 0;
        while (g.phase !== 'over' && n++ < 6000) {
            const p = g.prompt();
            let ev;
            if (p.type === 'ready' || p.type === 'handEnd') ev = g.act({ a: 'next' });
            else {
                const s = p.type === 'turn' ? p.seat : p.pending[0];
                ev = g.act(decide(g, s, p, levels[s], rng));
            }
            for (const e of ev) {
                if (e.type !== 'agari') continue;
                for (const w of e.wins) {
                    if (!w.result || w.result.yakuman) continue;
                    pool.push({ ...w, tsumo: w.from === null });
                }
            }
        }
    }
    shuffleArr(pool);
}

function nextQuestion() {
    if (mode === 'table') return tableQuestion();
    for (let i = 0; i < 3 && !pool.length; i++) harvest();
    // 符の 問題は 4翻 以下（符が 点数に かかわる 手）
    let idx = pool.findIndex(q => (mode === 'fu' ? q.result.han <= 4 : true));
    if (idx < 0) { harvest(10); idx = pool.findIndex(q => (mode === 'fu' ? q.result.han <= 4 : true)); }
    if (idx < 0) idx = 0;
    return pool.splice(idx, 1)[0];
}

/** 早見表の 練習：翻・符・親子・ロンツモ から 点数 */
function tableQuestion() {
    const combos = [];
    for (const han of [1, 2, 3, 4]) {
        for (const fu of [20, 25, 30, 40, 50, 60, 70]) {
            for (const tsumo of [false, true]) {
                if (fu === 20 && (!tsumo || han < 2)) continue;
                if (fu === 25 && (han < 2 || (tsumo && han < 3))) continue;
                if (fu * Math.pow(2, han + 2) >= 2000 && Math.random() < 0.6) continue;
                combos.push({ han, fu, tsumo });
            }
        }
    }
    const c = combos[Math.floor(Math.random() * combos.length)];
    return { table: true, ...c, isDealer: Math.random() < 0.35 };
}

/* ── 選択肢 ── */

function fuChoices(fu) {
    const all = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    const near = all.filter(x => x !== fu).sort((a, b) => Math.abs(a - fu) - Math.abs(b - fu)).slice(0, 5);
    return shuffleArr([fu, ...shuffleArr(near).slice(0, 3)]);
}

function pointChoices(han, fu, isDealer, tsumo, correct) {
    const set = new Set([correct]);
    const variants = [];
    for (const dh of [-1, 0, 1, 2]) for (const df of [-20, -10, 0, 10, 20]) {
        const h = han + dh, f = fu + df;
        if (h < 1 || f < 20 || (dh === 0 && df === 0)) continue;
        const b = basePoints(h, f, 0, DEFAULT_RULES);
        variants.push(pointsLabel(b, isDealer, tsumo));
    }
    // 親と 子を とりちがえた まちがい
    variants.push(pointsLabel(basePoints(han, fu, 0, DEFAULT_RULES), !isDealer, tsumo));
    for (const v of shuffleArr(variants)) { if (set.size >= 4) break; set.add(v); }
    return shuffleArr([...set]);
}

/* ── 画面 ── */

export function renderKeisan(root, back) {
    root.innerHTML = `<div class="page">
${back}
<h2>点数計算</h2>
<div class="ks-tabs">
  <button data-tab="guide" class="${tab === 'guide' ? 'on' : ''}">やりかた</button>
  <button data-tab="practice" class="${tab === 'practice' ? 'on' : ''}">練習</button>
  <button data-tab="table" class="${tab === 'table' ? 'on' : ''}">早見表</button>
</div>
<div class="ks-body"></div>
</div>`;
    root.querySelector('.ks-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        sfx.button();
        tab = b.dataset.tab;
        renderKeisan(root, back);
    });
    const body = root.querySelector('.ks-body');
    if (tab === 'guide') renderGuide(body);
    else if (tab === 'table') renderTable(body);
    else renderPractice(body);
}

function renderTable(body) {
    body.innerHTML = `<div class="seg small qt-tab"><button class="on" data-d="0">子</button><button data-d="1">親</button></div><div class="qt-box">${quickTableHTML(false)}</div>
<p class="note">満貫は 5翻（または 4翻40符・3翻70符 以上）。30符4翻・60符3翻は 7700（親 11600）。「切り上げ満貫」ルールなら 満貫に します。</p>`;
    body.querySelector('.qt-tab').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        sfx.button();
        body.querySelectorAll('.qt-tab button').forEach(x => x.classList.toggle('on', x === b));
        body.querySelector('.qt-box').innerHTML = quickTableHTML(b.dataset.d === '1');
    });
}

/* やりかた */
function example(closed, win, opt) {
    const w = P(win)[0];
    const ids = P(closed).map(id => (id === w ? (id ^ 3) : id));
    const melds = (opt.melds || []).map(m => ({ ...m, tiles: P(m.str), called: P(m.str)[0], from: 3 }));
    const r = evaluateWin({
        closed: [...ids, w], melds, winTile: w, tsumo: !!opt.tsumo, seatWind: opt.seat ?? 1, roundWind: 0,
        riichi: !!opt.riichi, doubleRiichi: false, ippatsu: false, rinshan: false, chankan: false, haitei: false, houtei: false,
        tenhou: false, chiihou: false, doraInd: opt.dora ? P(opt.dora).map(kindOf) : [], uraInd: [], rules: DEFAULT_RULES
    });
    const q = { hand: ids, tile: w, melds, seat: 0 };
    return `<div class="box"><p><b>${esc(opt.title)}</b></p>${handHTML(q)}<p class="note">${esc(opt.note)}</p>${r ? explainHTML(r, { isDealer: !!opt.dealer, tsumo: !!opt.tsumo }) : ''}</div>`;
}

function renderGuide(body) {
    body.innerHTML = `<div class="guide">
<p>麻雀の 点数は <b>「翻（はん）」</b> と <b>「符（ふ）」</b> の 2つで きまります。<br>翻は「役の 強さ」、符は「手の 形の こまかい 点」です。</p>

<h3>① 翻を かぞえる</h3>
<div class="box"><p>あがった 手の <b>役の 翻を ぜんぶ たす</b>。そこに <b>ドラ・赤ドラ・裏ドラ</b> を 1枚 1翻で たします（ドラは 役では ないので、ドラだけでは あがれません）。</p>
<p>三色・一気通貫・チャンタ・ホンイツ などは <b>鳴くと 1翻 さがります</b>（食い下がり）。くわしくは「役の 一覧」。</p></div>

<h3>② 符を かぞえる</h3>
<div class="box">
<table>
<tr><th>なにが</th><th></th><th>符</th></tr>
<tr><td>副底（だれでも）</td><td></td><td>20</td></tr>
<tr><td>門前（鳴いていない）で ロン</td><td></td><td>＋10</td></tr>
<tr><td>ツモ（平和ツモ では つけない）</td><td></td><td>＋2</td></tr>
<tr><td colspan="2">刻子（同じ 牌 3枚）：中張牌（2〜8）／么九牌（1・9・字牌）</td><td></td></tr>
<tr><td>　明刻（ポンした）</td><td></td><td>2 ／ 4</td></tr>
<tr><td>　暗刻（自分で そろえた）</td><td></td><td>4 ／ 8</td></tr>
<tr><td>　明槓（鳴いて カン）</td><td></td><td>8 ／ 16</td></tr>
<tr><td>　暗槓（自分で カン）</td><td></td><td>16 ／ 32</td></tr>
<tr><td>雀頭が 三元牌・自風・場風（ダブ風は 4）</td><td></td><td>＋2</td></tr>
<tr><td>待ちが 嵌張・辺張・単騎（両面・シャボは 0）</td><td></td><td>＋2</td></tr>
</table>
<p>ぜんぶ たしたら <b>1の位を 切り上げ</b>（32符 → 40符）。</p>
<p>とくべつ：<b>平和ツモ 20符</b>・<b>平和ロン 30符</b>・<b>七対子 25符</b>・鳴いて 20符に なったら <b>30符</b>。<br>
シャボ待ちを ロンで あがった 刻子は <b>明刻</b> あつかい（ツモなら 暗刻）。順子（123 など）は 0符。</p>
</div>

<h3>③ 基本点を だす</h3>
<div class="formula">基本点 ＝ 符 × 2<sup>（翻＋2）</sup></div>
<div class="box"><p>例：30符 3翻 → 30 × 2<sup>5</sup> ＝ 30 × 32 ＝ 960</p>
<p><b>2000 を こえたら 満貫（2000）</b> で とめます。5翻 以上は 符に 関係なく きまります。</p>
<table>
<tr><td>満貫</td><td>5翻（4翻40符・3翻70符 以上も）</td><td>2000</td></tr>
<tr><td>跳満（ハネマン）</td><td>6〜7翻</td><td>3000</td></tr>
<tr><td>倍満（バイマン）</td><td>8〜10翻</td><td>4000</td></tr>
<tr><td>三倍満</td><td>11〜12翻</td><td>6000</td></tr>
<tr><td>役満・数え役満</td><td>役満／13翻 以上</td><td>8000</td></tr>
</table></div>

<h3>④ はらう 点数に する</h3>
<div class="box">
<table>
<tr><td>子が ロン</td><td>ふりこんだ 人が 基本点 × 4</td><td></td></tr>
<tr><td>親が ロン</td><td>ふりこんだ 人が 基本点 × 6</td><td></td></tr>
<tr><td>子が ツモ</td><td>親は 基本点 × 2、子は 基本点 × 1</td><td></td></tr>
<tr><td>親が ツモ</td><td>子 3人が 基本点 × 2（〇〇オール）</td><td></td></tr>
</table>
<p>どれも <b>100点 未満は 切り上げ</b>（960 × 4 ＝ 3840 → 3900）。<br>
本場（つみ棒）は 1本 300点（ツモなら 1人 100点）を たす。供託（リーチ棒）は あがった 人が もらう。</p></div>

<h3>⑤ 例で やってみよう</h3>
${example('23m456p678s345s99p', '1m', { title: '例1：子が ロン（リーチ・平和・ドラ1）', note: '待ちは 2・3萬 の 両面（1萬 と 4萬）。ドラ表示 三索 → ドラは 四索（手に 1枚）。', riichi: true, dora: '3s' })}
${example('234m77p345s88s', '7p', { title: '例2：子が ツモ（中 ポン・シャボ待ち）', note: '7筒 と 8索 の シャボ待ちを 7筒で ツモ → 7筒は 暗刻（ロンなら 明刻）。中は ポンしたので 明刻。', tsumo: true, melds: [{ type: 'pon', str: '777z' }] })}
${example('1133m5599p22s667z', '7z', { title: '例3：親が ロン（七対子・ドラ2）', note: '七対子は 25符 きまり。ドラ表示 四筒 → ドラは 五筒（手に 2枚）。', dealer: true, dora: '4p' })}

<p class="note">ほかの 例は「練習」で どんどん 出ます。対局中も、テンパイすると「ロン ○○点／ツモ ○○点」が 出て、押すと 計算の しかたが 見られます。あがった ときの 結果画面でも「点数の 計算を 見る」で 見られます。</p>
</div>`;
}

/* 練習 */
function renderPractice(body) {
    const rec = store.keisan;
    body.innerHTML = `<div class="q-modes">
  <button data-mode="fu" class="${mode === 'fu' ? 'on' : ''}"><b>① 符を かぞえる</b><small>あがった 手を 見て 何符か えらぶ</small></button>
  <button data-mode="table" class="${mode === 'table' ? 'on' : ''}"><b>② 翻と 符から 点数</b><small>早見表を おぼえる（親・子・ロン・ツモ）</small></button>
  <button data-mode="full" class="${mode === 'full' ? 'on' : ''}"><b>③ 実戦問題</b><small>あがった 手の 点数を ぜんぶ 計算する</small></button>
</div>
<div class="q-score">これまで ${rec.done}問 中 ${rec.ok}問 せいかい</div>
<div class="q-area"><p class="note">問題を つくっています…</p></div>`;
    body.querySelector('.q-modes').addEventListener('click', e => {
        const b = e.target.closest('[data-mode]');
        if (!b) return;
        sfx.button();
        mode = b.dataset.mode;
        renderPractice(body);
    });
    setTimeout(() => showQuestion(body.querySelector('.q-area'), body), 30);
}

function infoChips(q) {
    const chips = [];
    chips.push(`<span class="hl">${q.isDealer ? '親' : '子'}</span>`);
    chips.push(`<span class="hl">${q.tsumo ? 'ツモ' : 'ロン'}</span>`);
    if (!q.table) {
        chips.push(`<span>場風 ${WIND_NAMES[q.roundWind]}</span>`, `<span>自風 ${WIND_NAMES[q.seatWind]}</span>`);
        if (q.riichi) chips.push('<span class="hl">リーチ</span>');
    }
    return `<div class="q-info">${chips.join('')}</div>`;
}

function doraHTML(q) {
    if (q.table) return '';
    const d = `<div class="tiles-row" style="--qtw:22px"><span class="note" style="margin-right:6px">ドラ表示</span>${q.doraInd.map(t => T(t)).join('')}${q.riichi && q.uraInd.length ? `<span class="note" style="margin:0 6px 0 12px">裏ドラ表示</span>${q.uraInd.map(t => T(t)).join('')}` : ''}</div>`;
    return d;
}

function showQuestion(area, body) {
    const q = nextQuestion();
    if (!q) { area.innerHTML = '<p class="note">問題が つくれませんでした。もう一度 えらんでください。</p>'; return; }
    let ask, choices, correct, explain;
    if (q.table) {
        const base = basePoints(q.han, q.fu, 0, DEFAULT_RULES);
        correct = pointsLabel(base, q.isDealer, q.tsumo);
        choices = pointChoices(q.han, q.fu, q.isDealer, q.tsumo, correct);
        ask = `<b>${q.fu}符 ${q.han}翻</b>、${q.isDealer ? '親' : '子'}の ${q.tsumo ? 'ツモ' : 'ロン'}は 何点？`;
        const r = { yaku: [{ name: '（役は 省略）', han: q.han }], han: q.han, fu: q.fu, yakuman: 0, base, dora: 0, aka: 0, ura: 0 };
        explain = explainHTML(r, { isDealer: q.isDealer, tsumo: q.tsumo }).replace(/<div class="cx-step"><h4>① [\s\S]*?<\/div>/, '').replace(/<div class="cx-step"><h4>② [\s\S]*?<\/div>/, '');
    } else if (mode === 'fu') {
        correct = `${q.result.fu}符`;
        choices = fuChoices(q.result.fu).map(f => `${f}符`);
        ask = 'この あがりは 何符？';
        explain = explainHTML(q.result, { isDealer: q.isDealer, tsumo: q.tsumo });
    } else {
        correct = pointsLabel(q.result.base, q.isDealer, q.tsumo);
        choices = pointChoices(q.result.han, q.result.fu, q.isDealer, q.tsumo, correct);
        ask = 'この あがりは 何点？（本場・供託は なし）';
        explain = explainHTML(q.result, { isDealer: q.isDealer, tsumo: q.tsumo });
    }
    const yakuHint = !q.table && mode === 'full' ? `<details class="pv-d"><summary>ヒント：役を 見る</summary><p>${q.result.yaku.map(y => `${esc(y.name)} ${y.han}翻`).join('・')}${q.result.dora ? `・ドラ${q.result.dora}` : ''}${q.result.aka ? `・赤${q.result.aka}` : ''}${q.result.ura ? `・裏${q.result.ura}` : ''}</p></details>` : '';
    area.innerHTML = `<div class="q-card">
${infoChips(q)}
${q.table ? '' : handHTML(q)}
${doraHTML(q)}
${yakuHint}
<div class="q-ask">${ask}</div>
<div class="q-choices">${choices.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
<div class="q-result"></div>
</div>`;
    const res = area.querySelector('.q-result');
    area.querySelector('.q-choices').addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (!b || area.dataset.answered) return;
        area.dataset.answered = '1';
        const ok = b.dataset.c === correct;
        store.keisan.done++;
        if (ok) store.keisan.ok++;
        save();
        ok ? sfx.yaku(2) : sfx.ryuukyoku();
        area.querySelectorAll('.q-choices button').forEach(x => {
            if (x.dataset.c === correct) x.classList.add('ok');
            else if (x === b) x.classList.add('ng');
        });
        res.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? 'せいかい！' : `ざんねん … こたえは ${esc(correct)}`}</div>${explain}<div class="rs-btns"><button class="btn primary next-q">${icon('arrow-clockwise')} つぎの 問題</button></div>`;
        const sc = body.querySelector('.q-score');
        if (sc) sc.textContent = `これまで ${store.keisan.done}問 中 ${store.keisan.ok}問 せいかい`;
        res.querySelector('.next-q').addEventListener('click', () => {
            sfx.button();
            delete area.dataset.answered;
            showQuestion(area, body);
            area.scrollIntoView({ block: 'start' });
        });
    });
    void toCounts;
}
