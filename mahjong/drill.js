/* 麻雀ドリル（何切る・待ち・シャンテン数・符・点数・安全牌）
   ------------------------------------------------------------------
   問題は drill-data.js（drill/gen.mjs で つくった もの）。こたえは アプリの エンジンと
   drill/check.js の 2とおりで 一致を たしかめて あります（tests.js でも 毎回 たしかめる）。
   「翻と 符の 早見表」の 問題だけは ここで ぜんぶの くみあわせを ならべて 出します。
   すすみぐあい（どこまで 解いたか・まちがえた 問題）は この 端末に のこします。
   ------------------------------------------------------------------ */
import { DRILL } from './drill-data.js';
import { tileImage, tileName } from './tiles.js';
import { basePoints } from './score.js';
import { explainHTML, pointsLabel } from './calc.js';
import { DEFAULT_RULES, makeRng } from './engine.js';
import { discardTable, decomps, shantenRegular, shantenChiitoi, shantenKokushi } from './drill/check.js';
import { parse, countsOf, agariOf, tableItems } from './drill/agari.js';
import { store, save } from './store.js';
import { sfx } from './sound.js';
import { icon } from './assets/icons.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WIND = ['東', '南', '西', '北'];
const kn = k => tileName(k);

/* ── 問題の しゅるい ── */
export const CATS = [
    { id: 'nk1', type: 'nk', group: '何切る', name: '何切る（基本）', desc: '2〜3シャンテン。受け入れが いちばん 多く なる 1枚を 切る' },
    { id: 'nk2', type: 'nk', group: '何切る', name: '何切る（1シャンテン）', desc: 'テンパイまで あと 1枚。いちばん テンパイしやすい 1枚' },
    { id: 'nk3', type: 'nk', group: '何切る', name: '何切る（テンパイ取り）', desc: 'テンパイに とる。待ちの 枚数が いちばん 多く なる 1枚' },
    { id: 'nk4', type: 'nk', group: '何切る', name: '何切る（清一色）', desc: '1つの 色だけの 手。牌効率の とっくん' },
    { id: 'wt1', type: 'wt', group: '待ち・シャンテン', name: '何待ち？（清一色）', desc: '多面張の 待ちを ぜんぶ 見つける' },
    { id: 'wt2', type: 'wt', group: '待ち・シャンテン', name: '何待ち？（いろいろ）', desc: 'ふつうの 手の 待ち' },
    { id: 'sh', type: 'sh', group: '待ち・シャンテン', name: '何シャンテン？', desc: 'テンパイまで あと 何枚か' },
    { id: 'fu', type: 'fu', group: '符・点数', name: '何符？', desc: 'あがった 手の 符を かぞえる（20符〜110符）' },
    { id: 'pt', type: 'pt', group: '符・点数', name: '何点？（あがった 手）', desc: '役・ドラ・符から 点数を だす' },
    { id: 'tb', type: 'tb', group: '符・点数', name: '何点？（翻と 符）', desc: '早見表を おぼえる（親・子・ロン・ツモ・本場）' },
    { id: 'gb', type: 'gb', group: 'リーチへの まもり', name: '現物は どれ？', desc: 'リーチの 人に ぜったい あたらない 牌' },
    { id: 'sj', type: 'sj', group: 'リーチへの まもり', name: 'スジは どれ？', desc: '両面待ちに あたらない 牌（スジ）を 見つける' }
];

const TB = tableItems();
const itemsOf = id => (id === 'tb' ? TB : DRILL[id]);

/* ── 牌 ── */
const T = (id, { side = false, back = false, cls = '' } = {}) => back
    ? `<div class="t back ${side ? 'side' : ''} ${cls}"></div>`
    : `<div class="t ${side ? 'side' : ''} ${cls}"><i style="background-image:url(${tileImage(id, true)})"></i></div>`;
const kid = k => k * 4 + ((k === 4 || k === 13 || k === 22) ? 1 : 0);   // 絵を 出す ための id（赤でない）

const tilesOfCounts = c => { const a = []; c.forEach((n, k) => { for (let i = 0; i < n; i++) a.push(k); }); return a; };
const rowHTML = (ids, tw, extra = '') => `<div class="tiles-row" style="--qtw:${tw}px">${ids}${extra}</div>`;
const fitTw = n => Math.max(16, Math.min(40, Math.floor((Math.min(window.innerWidth, 560) - 70) / (n + 0.4))));

function meldHTML(m) {
    if (m.type === 'ankan') return `<div class="meld">${m.tiles.map((t, i) => T(t, { back: i === 0 || i === 3 })).join('')}</div>`;
    // 上家から 鳴いた ことに して いちばん 左を 横に
    return `<div class="meld">${m.tiles.map((t, i) => T(t, { side: i === 0 })).join('')}</div>`;
}

function agariHTML(a) {
    const hand = a.closedIds.filter(id => id !== a.winId).sort((x, y) => (x >> 2) - (y >> 2) || (x % 4) - (y % 4));
    const n = hand.length + 1 + a.melds.length * 3.4;
    const tw = Math.max(16, Math.min(34, Math.floor((Math.min(window.innerWidth, 560) - 56) / (n + 0.8))));
    return rowHTML(hand.map(id => T(id)).join(''), tw, `<span class="gap"></span>${T(a.winId, { cls: 'win-tile' })}${a.melds.length ? '<span class="gap"></span>' + a.melds.map(meldHTML).join('') : ''}`);
}

function chips(q, a) {
    const dealer = q.s === 0;
    const c = [`<span class="hl">${dealer ? '親' : '子'}</span>`, `<span class="hl">${q.t ? 'ツモ' : 'ロン'}</span>`, `<span>場風 ${WIND[q.r]}</span>`, `<span>自風 ${WIND[q.s]}</span>`];
    if (q.q) c.push('<span class="hl">リーチ</span>');
    let dora = '';
    if (q.d && q.d.length) dora = `<div class="tiles-row" style="--qtw:22px"><span class="note" style="margin-right:6px">ドラ表示</span>${q.d.map(k => T(kid(k))).join('')}</div>`;
    return `<div class="q-info">${c.join('')}</div>${dora}`;
}

/* ── 選択肢 ── */
const shuffle = (arr, rng = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function fuChoices(fu) {
    const all = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
    const near = all.filter(x => x !== fu).sort((a, b) => Math.abs(a - fu) - Math.abs(b - fu)).slice(0, 5);
    return shuffle([fu, ...shuffle(near).slice(0, 3)]);
}
function pointChoices(han, fu, dealer, tsumo, honba, correct) {
    const set = new Set([correct]);
    const lab = (h, f, d) => withHonba(pointsLabel(basePoints(h, f, 0, DEFAULT_RULES), d, tsumo), honba, tsumo, d);
    const vs = [];
    for (const dh of [-1, 0, 1, 2]) for (const df of [-20, -10, 0, 10, 20]) {
        const h = han + dh, f = fu + df;
        if (h < 1 || f < 20 || (dh === 0 && df === 0)) continue;
        vs.push(lab(h, f, dealer));
    }
    vs.push(lab(han, fu, !dealer));
    if (honba) vs.push(withHonba(pointsLabel(basePoints(han, fu, 0, DEFAULT_RULES), dealer, tsumo), 0, tsumo, dealer));
    for (const v of shuffle(vs)) { if (set.size >= 4) break; set.add(v); }
    return shuffle([...set]);
}
/** 本場を たした 言いかた */
function withHonba(label, honba, tsumo, dealer) {
    if (!honba) return label;
    const nums = label.replace(/オール/, '').split('・').map(s => Number(s.replace(/,/g, '')));
    const add = tsumo ? 100 * honba : 300 * honba;
    const out = nums.map(n => (n + add).toLocaleString());
    if (label.includes('オール')) return `${out[0]}オール`;
    return out.join('・');
}

/* ── すすみぐあい ── */
function prog(id) {
    store.drill = store.drill || {};
    if (!store.drill[id]) store.drill[id] = { seed: Math.floor(Math.random() * 1e9), pos: 0, done: 0, ok: 0, wrong: [] };
    return store.drill[id];
}
function orderOf(id) {
    const p = prog(id);
    const n = itemsOf(id).length;
    return shuffle([...Array(n).keys()], makeRng('d' + p.seed));
}

/* ── 画面 ── */
let cur = null;      // { id, review }

export function renderDrill(root, back) {
    if (cur) return renderQuestion(root, back);
    const groups = [...new Set(CATS.map(c => c.group))];
    const total = CATS.reduce((s, c) => s + itemsOf(c.id).length, 0);
    root.innerHTML = `<div class="page">
${back}
<h2>麻雀ドリル</h2>
<p class="note">何切る・待ち・シャンテン数・符・点数・リーチへの まもり の 問題が ぜんぶで <b>${total}問</b>。こたえは 2とおりの 計算で たしかめて あります。</p>
${groups.map(g => `<h3>${esc(g)}</h3><div class="dr-cats">${CATS.filter(c => c.group === g).map(c => {
        const p = prog(c.id), n = itemsOf(c.id).length;
        return `<button class="dr-cat" data-cat="${c.id}"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><span class="dr-meta">${n}問 ・ といた ${p.done} ・ せいかい ${p.ok}${p.wrong.length ? ` ・ <em>まちがい ${p.wrong.length}</em>` : ''}</span></button>${p.wrong.length ? `<button class="dr-wrong" data-review="${c.id}">${icon('arrow-clockwise')} まちがえた ${p.wrong.length}問を もう一度</button>` : ''}`;
    }).join('')}</div>`).join('')}
<p class="note">何切るの こたえは「牌効率」（シャンテン数が すすむ 牌の のこり枚数が いちばん 多い 打牌）で きめて います。のこり枚数は 自分の 手牌 14枚を 見えて いる 牌と して かぞえます。役や 点数・まもりを 考えると かわる ことも あります。</p>
</div>`;
    root.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { sfx.button(); cur = { id: b.dataset.cat, review: false }; renderDrill(root, back); }));
    root.querySelectorAll('[data-review]').forEach(b => b.addEventListener('click', () => { sfx.button(); cur = { id: b.dataset.review, review: true }; renderDrill(root, back); }));
}

function nextIndex() {
    const p = prog(cur.id);
    if (cur.review) return p.wrong.length ? p.wrong[0] : null;
    const order = orderOf(cur.id);
    if (p.pos >= order.length) { p.seed = Math.floor(Math.random() * 1e9); p.pos = 0; save(); return orderOf(cur.id)[0]; }
    return order[p.pos];
}

function renderQuestion(root, back) {
    const cat = CATS.find(c => c.id === cur.id);
    const p = prog(cur.id);
    const idx = nextIndex();
    const head = `<div class="page dr-page">
<button class="back dr-back">${icon('arrow-left')}<span>ドリルの 一覧</span></button>
<h2>${esc(cat.name)}${cur.review ? '（まちがえた 問題）' : ''}</h2>
<div class="q-score">${cur.review ? `のこり ${p.wrong.length}問` : `${(p.pos % itemsOf(cur.id).length) + 1} / ${itemsOf(cur.id).length}問め`} ・ せいかい ${p.ok} / ${p.done}</div>`;
    if (idx === null) {
        root.innerHTML = `${head}<div class="q-card"><p>まちがえた 問題は もう ありません。すごい！</p></div></div>`;
        root.querySelector('.dr-back').addEventListener('click', () => { sfx.button(); cur = null; renderDrill(root, back); });
        return;
    }
    const q = itemsOf(cur.id)[idx];
    const built = build(cat.type, q);
    root.innerHTML = `${head}<div class="q-card">${built.html}<div class="q-ask">${built.ask}</div>${built.choices ? `<div class="q-choices${built.tileChoices ? ' tiles' : ''}">${built.choices.map((c, i) => `<button data-i="${i}">${c.html}</button>`).join('')}</div>` : ''}<div class="q-result"></div></div></div>`;
    root.querySelector('.dr-back').addEventListener('click', () => { sfx.button(); cur = null; renderDrill(root, back); });
    const card = root.querySelector('.q-card');
    let answered = false;
    const finish = (ok, chosenEl) => {
        if (answered) return;
        answered = true;
        p.done++;
        if (ok) p.ok++;
        if (cur.review) { p.wrong = p.wrong.filter(x => x !== idx); if (!ok) p.wrong.push(idx); }
        else { p.pos++; if (!ok && !p.wrong.includes(idx)) p.wrong.push(idx); }
        save();
        ok ? sfx.yaku(2) : sfx.ryuukyoku();
        built.mark(card, chosenEl);
        const res = card.querySelector('.q-result');
        res.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? 'せいかい！' : `ざんねん … こたえは ${built.answerText}`}</div>${built.explain()}<div class="rs-btns"><button class="btn primary next-q">${icon('arrow-clockwise')} つぎの 問題</button></div>`;
        res.querySelector('.next-q').addEventListener('click', () => { sfx.button(); renderQuestion(root, back); root.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); });
    };
    if (built.choices) {
        card.querySelector('.q-choices').addEventListener('click', e => {
            const b = e.target.closest('[data-i]');
            if (!b || answered) return;
            finish(built.choices[Number(b.dataset.i)].ok, b);
        });
    }
    if (built.tapHand) {
        // 手牌を タップ → 上がる → もう一度 タップで こたえる
        let sel = null;
        card.querySelector('.dr-hand').addEventListener('click', e => {
            const t = e.target.closest('[data-k]');
            if (!t || answered) return;
            if (sel !== t) { sfx.select(); card.querySelectorAll('.dr-hand .t.sel').forEach(x => x.classList.remove('sel')); t.classList.add('sel'); sel = t; return; }
            finish(built.isRight(Number(t.dataset.k)), t);
        });
    }
}

/* ── 問題ごとの 画面 ── */
function handTap(c, extraCls = '') {
    const ks = tilesOfCounts(c);
    const tw = fitTw(ks.length);
    return `<div class="tiles-row dr-hand ${extraCls}" style="--qtw:${tw}px">${ks.map(k => `<div class="t ht" data-k="${k}"><i style="background-image:url(${tileImage(kid(k), true)})"></i></div>`).join('')}</div>`;
}
const mini = (k, tw = 22) => `<span class="dr-mini" style="--qtw:${tw}px">${T(kid(k))}</span>`;
const minis = (ks, tw = 22) => `<span class="dr-minis">${ks.map(k => mini(k, tw)).join('')}</span>`;
const markTap = (card, chosen, rightK) => {
    card.querySelectorAll('.dr-hand .t').forEach(t => { const k = Number(t.dataset.k); if (k === rightK) t.classList.add('dr-ok'); });
    if (chosen && Number(chosen.dataset.k) !== rightK) chosen.classList.add('dr-ng');
};

function build(type, q) {
    if (type === 'nk') {
        const [hs, ans] = q;
        const c = countsOf(hs);
        return {
            html: handTap(c), ask: '何を 切る？（タップで えらんで、もう一度 タップで 切る）', tapHand: true,
            isRight: k => k === ans, answerText: kn(ans),
            mark: (card, el) => markTap(card, el, ans),
            explain: () => {
                const rows = discardTable(c).sort((a, b) => a.s - b.s || b.total - a.total);
                const minS = rows[0].s;
                const sname = s => (s === 0 ? 'テンパイ' : `${s}シャンテン`);
                return `<div class="dr-ex"><p>${kn(ans)} を 切ると <b>${sname(minS)}</b> の まま、${minS === 0 ? '待ち' : '手が すすむ 牌'}が <b>${rows[0].kinds.length}種類 ${rows[0].total}枚</b> で いちばん 多い。</p>
<table class="dr-t"><tr><th>切る</th><th></th><th>${minS === 0 ? '待ち' : '受け入れ'}</th><th>枚</th></tr>${rows.map(r => `<tr class="${r.d === ans ? 'best' : ''}${r.s > minS ? ' worse' : ''}"><td>${mini(r.d, 24)}</td><td>${sname(r.s)}</td><td>${minis(r.kinds, 16)}</td><td>${r.total}</td></tr>`).join('')}</table>
<p class="note">シャンテン数が ふえる（うすい 行）打牌は テンパイから とおざかる。のこり枚数は 手牌 14枚を 見えて いる 牌と して かぞえた もの。</p></div>`;
            }
        };
    }
    if (type === 'wt') {
        const [hs, waits, ds] = q;
        const c = countsOf(hs);
        const opts = shuffle([{ ks: waits, ok: true }, ...ds.map(d => ({ ks: d, ok: false }))]);
        return {
            html: rowHTML(tilesOfCounts(c).map(k => T(kid(k))).join(''), fitTw(13)), ask: 'この 手の 待ちは？（ぜんぶ ふくむ もの）',
            choices: opts.map(o => ({ ok: o.ok, html: minis(o.ks, 26) })), tileChoices: true,
            answerText: waits.map(kn).join('・'),
            mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (opts[i].ok) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
            explain: () => {
                const lines = waits.map(w => {
                    const cc = c.slice(); cc[w]++;
                    const d = decomps(cc, 4)[0];
                    let shape;
                    if (d) shape = [...d.sets.map(s => s.type === 'kou' ? [s.k, s.k, s.k] : [s.k, s.k + 1, s.k + 2]), [d.head, d.head]].map(g => `<span class="dr-grp">${g.map(k => mini(k, 18)).join('')}</span>`).join('');
                    else shape = '七対子・国士の 形';
                    return `<div class="dr-wline">${mini(w, 26)} が 来たら → ${shape}</div>`;
                }).join('');
                return `<div class="dr-ex"><p>待ちは <b>${waits.map(kn).join('・')}</b>（${waits.length}種類）。</p>${lines}</div>`;
            }
        };
    }
    if (type === 'sh') {
        const [hs, ans] = q;
        const c = countsOf(hs);
        const labels = ['テンパイ', '1シャンテン', '2シャンテン', '3シャンテン', '4シャンテン'];
        return {
            html: rowHTML(tilesOfCounts(c).map(k => T(kid(k))).join(''), fitTw(13)), ask: 'この 手は 何シャンテン？',
            choices: labels.map((l, i) => ({ ok: i === ans, html: l })),
            answerText: labels[ans],
            mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (i === ans) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
            explain: () => {
                const r = shantenRegular(c), ch = shantenChiitoi(c), ko = shantenKokushi(c);
                const nm = s => (s === 0 ? 'テンパイ' : `${s}シャンテン`);
                return `<div class="dr-ex"><p>シャンテン数は「あと 何枚 そろえば テンパイか」。3つの 形で いちばん 小さい ものが こたえ。</p>
<table class="dr-t"><tr><td>ふつうの 形（4面子1雀頭）</td><td>${nm(r)}</td></tr><tr><td>七対子</td><td>${nm(ch)}</td></tr><tr><td>国士無双</td><td>${nm(ko)}</td></tr></table>
<p class="note">ふつうの 形：8 −（面子×2）−（塔子の 数）−（雀頭 1つ）。面子と 塔子は あわせて 4つまで。</p></div>`;
            }
        };
    }
    if (type === 'fu' || type === 'pt') {
        const a = agariOf(q);
        const r = a.result;
        const dealer = q.s === 0;
        const html = `${chips(q, a)}${agariHTML(a)}`;
        if (type === 'fu') {
            const ch = fuChoices(q.f);
            return {
                html, ask: 'この あがりは 何符？', choices: ch.map(f => ({ ok: f === q.f, html: `${f}符` })), answerText: `${q.f}符`,
                mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (ch[i] === q.f) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
                explain: () => explainHTML(r, { isDealer: dealer, tsumo: !!q.t }).replace(/<div class="cx-step"><h4>③[\s\S]*$/, '</div>')
            };
        }
        const label = pointsLabel(r.base, dealer, !!q.t);   // q.l と 同じ（tests.js で たしかめて いる）
        const ch = pointChoices(q.h, q.f, dealer, !!q.t, 0, label);
        return {
            html: `${html}<details class="pv-d"><summary>ヒント：役を 見る</summary><p>${r.yaku.map(y => `${esc(y.name)} ${y.han}翻`).join('・')}${r.dora ? `・ドラ${r.dora}` : ''}${r.aka ? `・赤ドラ${r.aka}` : ''}</p></details>`,
            ask: 'この あがりは 何点？（本場・供託は なし）', choices: ch.map(l => ({ ok: l === label, html: esc(l) })), answerText: label,
            mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (ch[i] === label) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
            explain: () => explainHTML(r, { isDealer: dealer, tsumo: !!q.t })
        };
    }
    if (type === 'tb') {
        const base = basePoints(q.han, q.fu, 0, DEFAULT_RULES);
        const correct = withHonba(pointsLabel(base, q.dealer, q.tsumo), q.honba, q.tsumo, q.dealer);
        const ch = pointChoices(q.han, q.fu, q.dealer, q.tsumo, q.honba, correct);
        const big = q.han >= 5;
        const hanText = big ? `${q.han}翻（${q.han >= 13 ? '数え役満' : q.han >= 11 ? '三倍満' : q.han >= 8 ? '倍満' : q.han >= 6 ? '跳満' : '満貫'}）` : `${q.fu}符 ${q.han}翻`;
        return {
            html: `<div class="q-info"><span class="hl">${q.dealer ? '親' : '子'}</span><span class="hl">${q.tsumo ? 'ツモ' : 'ロン'}</span>${q.honba ? `<span class="hl">${q.honba}本場</span>` : ''}</div>`,
            ask: `<b>${hanText}</b>、${q.dealer ? '親' : '子'}の ${q.tsumo ? 'ツモ' : 'ロン'}${q.honba ? `（${q.honba}本場）` : ''}は 何点？`,
            choices: ch.map(l => ({ ok: l === correct, html: esc(l) })), answerText: correct,
            mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (ch[i] === correct) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
            explain: () => {
                const r = { yaku: [{ name: '（役は 省略）', han: q.han }], han: q.han, fu: q.fu, yakuman: 0, base, dora: 0, aka: 0, ura: 0 };
                return explainHTML(r, { isDealer: q.dealer, tsumo: q.tsumo, honba: q.honba }).replace(/<div class="cx-step"><h4>① [\s\S]*?<\/div>/, '').replace(/<div class="cx-step"><h4>② [\s\S]*?<\/div>/, '');
            }
        };
    }
    if (type === 'gb' || type === 'sj') {
        const river = q.v;
        const tw = Math.max(18, Math.min(30, Math.floor((Math.min(window.innerWidth, 560) - 48) / 7)));
        const rv = `<div class="dr-river-l">リーチの 人の 捨て牌（横の 牌で リーチ）</div><div class="dr-river" style="--qtw:${tw}px">${river.map((k, i) => T(kid(k), { side: i === q.i })).join('')}</div>`;
        if (type === 'gb') {
            const c = countsOf(q.h);
            return {
                html: `${rv}<div class="dr-river-l">あなたの 手牌</div>${handTap(c)}`, ask: 'リーチの 人に ぜったい あたらない 牌は？（タップ 2回で 切る）', tapHand: true,
                isRight: k => k === q.a, answerText: kn(q.a), mark: (card, el) => markTap(card, el, q.a),
                explain: () => `<div class="dr-ex"><p><b>${kn(q.a)}</b> は リーチの 人が もう 捨てて いる 牌（<b>現物</b>）。自分で 捨てた 牌では ロン できない（フリテン）ので、ぜったいに あたらない。</p><p class="note">手の 中で 捨て牌に ある 牌は ${kn(q.a)} だけ。ほかの 牌は あたる かもしれない。</p></div>`
            };
        }
        const opts = q.c;
        const sujiWhy = k => { const n = k % 9, s = k - n; if (n <= 2) return `${kn(s + n + 3)} が 捨てて ある`; if (n >= 6) return `${kn(s + n - 3)} が 捨てて ある`; return `${kn(s + n - 3)} と ${kn(s + n + 3)} が 両方 捨てて ある`; };
        return {
            html: rv, ask: 'この 中で スジ（両面待ちには あたらない 牌）は どれ？',
            choices: opts.map(k => ({ ok: k === q.a, html: mini(k, 34) })), tileChoices: true, answerText: kn(q.a),
            mark: (card, el) => card.querySelectorAll('.q-choices button').forEach((b, i) => { if (opts[i] === q.a) b.classList.add('ok'); else if (b === el) b.classList.add('ng'); }),
            explain: () => `<div class="dr-ex"><p><b>${kn(q.a)}</b> は ${sujiWhy(q.a)} ので スジ。リーチの 人が 両面待ちなら ${kn(q.a)} では あたらない（自分の 捨て牌で ロン できないので）。</p>
<p class="note">スジ：1-4-7・2-5-8・3-6-9 の くみ。4・5・6 は 両がわ（例：5 なら 2 と 8）が 捨てて あって はじめて スジ。スジでも 嵌張・単騎・シャボ待ちには あたる ことが ある。ほかの えらびは スジでも 現物でも ない。</p></div>`
        };
    }
    return { html: '', ask: '', choices: [], answerText: '', mark() {}, explain: () => '' };
}

export function resetDrillView() { cur = null; }
