/* 対局の 画面
   ------------------------------------------------------------------
   ・札 48枚は ずっと 同じ <div> を つかい、いる 場所（山・手札・場・とった 札）が
     かわる たびに transform で すべらせます。だから 札は 画面の 中を
     とびとびに ならず、なめらかに うごきます。
   ・ルールの 計算は rules.js、コンピューターは ai.js、つうしんは net.js です。
     ここは「見せる」「さわる」だけを うけもちます。
   ・座標は よこ 390 の 画面を もとに した「ろんり座標」で 計算し、
     じっさいの 画面の 大きさに あわせて 拡大します（縦長の スマホ むけ）。
   ------------------------------------------------------------------ */
import { CARDS, MONTHS, KIND_NAME, KIND_ORDER, monthOf, kindOf } from './cards.js';
import { cardURL, backURL } from './art.js';
import {
    newGame, applyAction, legalActions, calcYaku, sumYaku, yakuProgress, roundPoints, fieldMatches,
    YAKU_DEFS, TAG
} from './rules.js';
import { chooseAction, recommend } from './ai.js';
import { store, save, speedFactor } from './store.js';
import { sfx, say } from './sound.js';
import * as net from './net.js';

const LW = 390;          // ろんり座標の よこはば
const MIN_H = 640;       // これより ひくい 画面では 高さに あわせて ちぢめる
const CW = 44, CH = 70;  // 札の 大きさ（ろんり座標）
const CAP_K = 0.56;      // とった 札の ちぢめかた
const OPP_K = 0.42;      // あいての 手札の ちぢめかた

const wait = ms => new Promise(res => setTimeout(res, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND_SHORT = { hikari: '光', tane: 'たね', tan: 'たん', kasu: 'かす' };

/** 札の 小さい 絵（モーダルなどで つかう） */
export function cardImg(id, cls = '') {
    return `<img class="mini ${cls}" src="${cardURL(id)}" alt="${esc(CARDS[id].name)}" draggable="false">`;
}

/** その 札が かかわる 役の 名まえ */
export function yakuNamesFor(id, rules) {
    const names = [];
    for (const y of YAKU_DEFS) {
        if (y.opt && !rules[y.opt]) continue;
        if (y.cards && y.cards.includes(id)) names.push(y.name);
        else if (y.kind && (kindOf(id) === y.kind || (y.kind === 'kasu' && rules.sakeKasu && id === TAG.sake))) names.push(y.name);
    }
    return [...new Set(names)];
}

export class Game {
    /**
     * opts:
     *   mode     'cpu' | 'practice' | 'online'
     *   me       じぶんの 席（0 か 1）
     *   level    コンピューターの つよさ（cpu / practice）
     *   rules    ルール
     *   seed     乱数の 種
     *   names    [席0の 名まえ, 席1の 名まえ]
     *   room     オンラインの とき { code, role, game }
     *   onExit   画面を ぬける とき よぶ（result を わたす）
     *   onRematch オンラインで「もう一度」を おした とき
     */
    constructor(root, opts) {
        this.root = root;
        this.o = opts;
        this.me = opts.me;
        this.opp = 1 - opts.me;
        this.queue = [];
        this.running = false;
        this.selected = null;
        this.disposed = false;
        this.vm = null;
        this.logCount = 0;
        this.shownRound = 0;
        this.unsubs = [];
        this.display = opts.mode === 'practice'
            ? { ...store.display, yakuButton: true, progress: true, hint: true, labels: true, recommend: true, coach: true }
            : store.display;
        this.build();
        const { state, events } = newGame(opts.rules, opts.seed);
        this.s = state;
        this.onResize = () => { this.measure(); this.layout(false); this.hud(); };
        window.addEventListener('resize', this.onResize);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize);
        this.measure();
        this.running = true;
        this.run(events).then(() => {
            this.running = false;
            if (opts.mode === 'online') this.connectOnline();
            if (!this.disposed) this.pump();
        });
    }

    dispose() {
        this.disposed = true;
        window.removeEventListener('resize', this.onResize);
        if (window.visualViewport) window.visualViewport.removeEventListener('resize', this.onResize);
        this.unsubs.forEach(f => { try { f(); } catch (e) { /* むし */ } });
        clearTimeout(this.cpuTimer);
        clearTimeout(this.zTimer);
        this.root.innerHTML = '';
    }

    /* ── 画面の くみたて ─────────────────────── */

    build() {
        const o = this.o;
        const lvl = o.level ? `Lv.${o.level}` : '';
        this.root.innerHTML = `
<div class="stage" id="stage">
  <div class="g-head">
    <button class="icon-btn" data-act="menu" aria-label="メニュー">☰</button>
    <div class="g-round"></div>
    <button class="pill-btn yaku-btn" data-act="yaku">役</button>
  </div>
  <div class="pl pl-opp"><span class="pl-name"></span><span class="pl-lv">${esc(lvl)}</span><span class="pl-badges"></span><span class="pl-score"></span></div>
  <div class="chips chips-opp"></div>
  <div class="cap-badges cap-opp"></div>
  <div class="cap-hit cap-hit-opp" data-act="yaku-opp"></div>
  <div class="deck-count"></div>
  <div class="cards"></div>
  <div class="cap-badges cap-me"></div>
  <div class="cap-hit cap-hit-me" data-act="yaku-me"></div>
  <div class="chips chips-me"></div>
  <div class="msg" aria-live="polite"></div>
  <div class="pl pl-me"><span class="pl-name"></span><span class="pl-badges"></span><span class="pl-score"></span>
    <button class="pill-btn rec-btn" data-act="recommend">💡 おすすめ</button></div>
  <div class="net-warn" hidden></div>
  <div class="banner" aria-live="assertive"></div>
</div>
<div class="modal-layer" hidden></div>
<div class="zoom-layer" hidden></div>`;
        this.stage = this.root.querySelector('.stage');
        this.layer = this.root.querySelector('.cards');
        this.modalLayer = this.root.querySelector('.modal-layer');
        this.zoomLayer = this.root.querySelector('.zoom-layer');
        this.q = sel => this.root.querySelector(sel);
        this.els = [];
        const back = backURL();
        for (const c of CARDS) {
            const el = document.createElement('div');
            el.className = 'card';
            el.dataset.id = c.id;
            el.innerHTML = `<div class="inner"><div class="face front"><img src="${cardURL(c.id)}" alt="" draggable="false">` +
                `<span class="tag-m">${c.m}</span><span class="tag-k k-${c.k}">${KIND_SHORT[c.k]}</span></div>` +
                `<div class="face back"><img src="${back}" alt="" draggable="false"></div></div>`;
            this.layer.appendChild(el);
            this.els.push(el);
        }
        this.stage.classList.toggle('labels', !!this.display.labels);
        this.q('.yaku-btn').hidden = !this.display.yakuButton;
        this.q('.rec-btn').hidden = !this.display.recommend;
        this.bindInput();
    }

    /** 画面の 大きさを はかる */
    measure() {
        const vw = window.innerWidth, vh = window.innerHeight;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top)';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const safeB = parseFloat(cs.paddingBottom) || 0, safeT = parseFloat(cs.paddingTop) || 0;
        probe.remove();
        let u = vw / LW;
        let LH = (vh - safeB - safeT) / u;
        if (LH < MIN_H) { u = (vh - safeB - safeT) / MIN_H; LH = MIN_H; }
        u = Math.min(u, 2.4);
        LH = (vh - safeB - safeT) / u;
        this.u = u;
        this.LH = LH;
        const st = this.stage.style;
        st.width = LW * u + 'px';
        st.height = LH * u + 'px';
        st.left = Math.max(0, (vw - LW * u) / 2) + 'px';
        st.top = safeT + 'px';
        st.setProperty('--u', u + 'px');
        for (const el of this.els) { el.style.width = CW * u + 'px'; el.style.height = CH * u + 'px'; }
        this.geo = this.geometry();
        // 文字や ボタンの 場所
        const G = this.geo, put = (sel, y, h) => { const e = this.q(sel); e.style.top = y * u + 'px'; e.style.height = h * u + 'px'; };
        put('.pl-opp', G.oppRowY, 30);
        put('.chips-opp', G.oppChipsY, 18);
        put('.cap-opp', G.oppCapY + CH * CAP_K - 12, 14);
        put('.cap-hit-opp', G.oppCapY - 2, CH * CAP_K + 4);
        put('.cap-me', G.myCapY + CH * CAP_K - 12, 14);
        put('.cap-hit-me', G.myCapY - 2, CH * CAP_K + 4);
        put('.chips-me', G.myChipsY, 18);
        put('.msg', G.msgY, 32);
        put('.pl-me', G.myRowY, 38);
        st.setProperty('--mat-top', (G.fieldTop - 4) * u + 'px');
        st.setProperty('--mat-h', (G.fieldBottom - G.fieldTop + 8) * u + 'px');
        const dc = this.q('.deck-count');
        dc.style.left = G.deckX * u + 'px';
        dc.style.top = (G.deckY + CH + 3) * u + 'px';
        dc.style.width = CW * u + 'px';
    }

    geometry() {
        const LH = this.LH;
        const G = {};
        G.headH = 40;
        G.oppRowY = 42;
        G.oppHandY = 44;
        G.oppCapY = 78;
        G.oppChipsY = G.oppCapY + CH * CAP_K + 4;
        G.myRowY = LH - 44;
        G.handY = G.myRowY - CH - 8;
        G.msgY = G.handY - 16 - 32;
        G.myCapY = G.msgY - 4 - CH * CAP_K;
        G.myChipsY = G.myCapY - 20;
        G.fieldTop = G.oppChipsY + 22;
        G.fieldBottom = G.myChipsY - 4;
        G.deckX = 8;
        G.fieldX = 62;
        G.cols = 6;
        G.colW = (LW - 8 - G.fieldX) / G.cols;
        G.deckY = (G.fieldTop + G.fieldBottom) / 2 - CH / 2;
        // とった 札の グループ（光・たね・たん・かす）
        const widths = [66, 90, 90, 124];
        let x = 7;
        G.groups = {};
        KIND_ORDER.forEach((k, i) => { G.groups[k] = { x, w: widths[i] }; x += widths[i] + 2; });
        return G;
    }

    /** 場の 札の 置き場（slot 番号）の 座標と 大きさ */
    slotPos(slot) {
        const G = this.geo;
        const maxSlot = Math.max(11, ...[...this.vm.slots.values()]);
        const rows = Math.max(2, Math.ceil((maxSlot + 1) / G.cols));
        const avail = G.fieldBottom - G.fieldTop;
        // 場に よゆうが あれば 札を すこし 大きく する
        const k = Math.min((G.colW - 4) / CW, (avail - 10 * (rows - 1)) / rows / CH, 1.12);
        const fk = Math.max(0.8, k);
        const h = CH * fk;
        const rowH = Math.min(h + 14, (avail - h) / Math.max(1, rows - 1));
        const total = rowH * (rows - 1) + h;
        const top = G.fieldTop + Math.max(0, (avail - total) / 2);
        const r = Math.floor(slot / G.cols), c = slot % G.cols;
        return { x: G.fieldX + c * G.colW + (G.colW - CW * fk) / 2, y: top + r * rowH, k: fk };
    }

    /* ── 札の 置き場所を 計算して うごかす ─────── */

    resetVM() {
        this.vm = {
            deck: CARDS.map(c => c.id),
            hands: [[], []],
            slots: new Map(),
            stack: new Map(),
            caps: [[], []],
            drawn: null,
            up: new Set(),
            reveal: false
        };
    }

    freeSlot() {
        const used = new Set(this.vm.slots.values());
        let i = 0;
        while (used.has(i)) i++;
        return i;
    }

    /** 札 1枚ぶんの 置き場所 { x, y, k, up, z } */
    placeOf(id) {
        const G = this.geo, vm = this.vm;
        const me = this.me, opp = this.opp;
        let i;
        if ((i = vm.hands[me].indexOf(id)) >= 0) {
            const hand = vm.hands[me];
            const n = hand.length;
            const step = n > 1 ? Math.min(CW + 3, (LW - 16 - CW) / (n - 1)) : 0;
            const x0 = (LW - (CW + step * (n - 1))) / 2;
            return { x: x0 + i * step, y: G.handY - (this.selected === id ? 14 : 0), k: 1, up: true, z: 300 + i };
        }
        if ((i = vm.hands[opp].indexOf(id)) >= 0) {
            const n = vm.hands[opp].length;
            const w = CW * OPP_K;
            const step = w + 2;
            const x0 = LW - 8 - (w + step * (n - 1));
            return { x: x0 + i * step, y: G.oppHandY, k: OPP_K, up: vm.reveal || vm.up.has(id), z: 300 + i };
        }
        if (vm.drawn === id) return { x: G.deckX + 4, y: G.deckY - 14, k: 1.08, up: true, z: 600 };
        if (vm.stack.has(id)) {
            const t = vm.stack.get(id);
            const base = this.placeOf(t);
            return { x: base.x + 7, y: base.y + 9, k: base.k, up: true, z: 190 };
        }
        if (vm.slots.has(id)) {
            const p = this.slotPos(vm.slots.get(id));
            return { ...p, up: true, z: 100 + vm.slots.get(id) };
        }
        for (const p of [0, 1]) {
            if ((i = vm.caps[p].indexOf(id)) < 0) continue;
            const k = kindOf(id);
            const group = vm.caps[p].filter(c => kindOf(c) === k).sort((a, b) => a - b);
            const j = group.indexOf(id);
            const g = G.groups[k];
            const w = CW * CAP_K;
            const n = group.length;
            const step = n > 1 ? Math.min(w + 1, (g.w - w) / (n - 1)) : 0;
            const y = p === me ? G.myCapY : G.oppCapY;
            return { x: g.x + j * step, y, k: CAP_K, up: true, z: 200 + j };
        }
        i = vm.deck.indexOf(id);
        const d = Math.min(i, 12);
        return { x: G.deckX - d * 0.18, y: G.deckY - d * 0.25, k: 1, up: false, z: 10 + i };
    }

    /**
     * ぜんぶの 札を いまの 置き場所へ。
     * animate：すべらせるか / delays：札ごとに 出発を おくらせる（配る とき）
     */
    layout(animate = true, delays = null) {
        if (!this.vm) return;
        const u = this.u;
        let seq = 0;
        let maxDelay = 0;
        for (const el of this.els) {
            const id = +el.dataset.id;
            const p = this.placeOf(id);
            const tf = `translate3d(${(p.x * u).toFixed(1)}px,${(p.y * u).toFixed(1)}px,0) scale(${p.k})`;
            const moved = el._tf !== tf;
            if (!animate) {
                el.style.transition = 'none';
                el.style.transitionDelay = '0ms';
            } else {
                el.style.transition = '';
                const d = delays && delays.has(id) ? delays.get(id) : 0;
                el.style.transitionDelay = d + 'ms';
                maxDelay = Math.max(maxDelay, d);
            }
            el.style.transform = tf;
            el._tf = tf;
            el.classList.toggle('up', p.up);
            el._z = p.z;
            el.style.zIndex = animate && moved ? 1000 + (delays && delays.has(id) ? delays.get(id) : seq++) : p.z;
            if (!animate) void el.offsetWidth;
        }
        if (!animate) for (const el of this.els) el.style.transition = '';
        clearTimeout(this.zTimer);
        const settle = () => this.els.forEach(el => { el.style.zIndex = el._z; });
        if (animate) this.zTimer = setTimeout(settle, this.dur('move') + maxDelay + 30);
        else settle();
        this.applyGlow();
    }

    dur(kind) {
        const f = speedFactor();
        const base = { move: 380, flip: 300, pause: 260, banner: 1300, cpu: 650 }[kind];
        return Math.round(base * f);
    }

    /* ── できごとを じゅんに うごかす ─────────── */

    async run(events, fast = false) {
        this.fast = fast;
        for (const ev of events) {
            if (this.disposed) return;
            await this.animate(ev);
        }
        if (fast) this.layout(false);
        this.fast = false;
        this.hud();
    }

    /** まつ（おいつき中は またない） */
    w(ms) { return this.fast ? Promise.resolve() : wait(ms); }
    lay(delays) { if (!this.fast) this.layout(true, delays); }

    async animate(ev) {
        let vm = this.vm;
        const s = this.s;
        this.stage.style.setProperty('--move', this.dur('move') + 'ms');
        this.stage.style.setProperty('--flip', this.dur('flip') + 'ms');
        switch (ev.type) {
            case 'deal': {
                this.selected = null;
                this.resetVM();
                vm = this.vm;
                if (this.dealtOnce && !this.fast) {
                    this.layout(true);          // 前の 局の 札を 山に あつめる
                    await this.w(this.dur('move') + 120);
                } else {
                    this.layout(false);
                    await this.w(120);
                }
                this.dealtOnce = true;
                this.hud();
                // じっさいの 配りかた：あいて 2枚 → 場 2枚 → じぶん 2枚 を 4回
                const order = [];
                const d = s.dealer, o = 1 - d;
                const handO = s.hands[o].slice(), handD = s.hands[d].slice(), field = s.field.slice();
                for (let r = 0; r < 4; r++) {
                    order.push(...handO.slice(r * 2, r * 2 + 2).map(id => ['h', o, id]));
                    order.push(...field.slice(r * 2, r * 2 + 2).map(id => ['f', 0, id]));
                    order.push(...handD.slice(r * 2, r * 2 + 2).map(id => ['h', d, id]));
                }
                const delays = new Map();
                const stagger = Math.round(55 * speedFactor());
                order.forEach(([t, p, id], i) => {
                    vm.deck = vm.deck.filter(c => c !== id);
                    if (t === 'h') vm.hands[p].push(id);
                    else vm.slots.set(id, this.freeSlot());
                    delays.set(id, i * stagger);
                });
                // じぶんの 手札は 月の じゅんに ならべる
                vm.hands[this.me].sort((a, b) => a - b);
                // 山は のこりの じゅんばん（めくる 札が いちばん 上）
                vm.deck = s.deck.slice().reverse();
                this.hideMyHand = true;
                this.lay(delays);
                if (!this.fast) sfx.deal();
                await this.w(order.length * stagger + this.dur('move'));
                this.hideMyHand = false;
                this.lay();
                await this.w(this.dur('flip'));
                this.hud();
                if (ev.redeals) this.toast('場に 同じ 月が 4枚 そろったので 配りなおしました');
                break;
            }
            case 'teyaku': {
                vm.hands[ev.p].forEach(id => vm.up.add(id));
                if (ev.p === this.opp) vm.reveal = true;
                this.lay();
                await this.banner(`${ev.teyaku.name}！`, `${this.nameOf(ev.p)}の 手役（${ev.teyaku.pts}点）`);
                break;
            }
            case 'place': {
                if (ev.from === 'hand') {
                    vm.hands[ev.p] = vm.hands[ev.p].filter(c => c !== ev.card);
                } else {
                    vm.drawn = null;
                }
                if (this.selected === ev.card) this.selected = null;
                vm.up.add(ev.card);
                if (ev.onto !== null && ev.onto !== undefined) vm.stack.set(ev.card, ev.onto);
                else vm.slots.set(ev.card, this.freeSlot());
                this.lay();
                await this.w(this.dur('move'));
                if (!this.fast) sfx.place();
                await this.w(this.dur('pause') * (ev.onto !== null && ev.onto !== undefined ? 1 : 0.5));
                break;
            }
            case 'capture': {
                for (const id of ev.cards) { vm.slots.delete(id); vm.stack.delete(id); }
                vm.caps[ev.p].push(...ev.cards);
                this.lay();
                if (!this.fast) sfx.capture();
                await this.w(this.dur('move'));
                this.hud();
                break;
            }
            case 'flip': {
                vm.deck = vm.deck.filter(c => c !== ev.card);
                vm.drawn = ev.card;
                vm.up.add(ev.card);
                this.lay();
                if (!this.fast) sfx.flip();
                await this.w(Math.max(this.dur('move'), this.dur('flip')) + this.dur('pause'));
                this.hud();
                break;
            }
            case 'needPick':
                this.hud();
                break;
            case 'yaku': {
                const prevIds = calcYakuIds(this.capsBefore || [], s.rules);
                const fresh = ev.yaku.filter(y => !prevIds.has(y.id + ':' + y.pts));
                const names = (fresh.length ? fresh : ev.yaku).map(y => y.name).join('・');
                if (!this.fast) sfx.yaku();
                if (!this.fast) say(names);
                this.hud();
                await this.banner(names, `${this.nameOf(ev.p)}　${ev.pts}点`, 'yaku');
                break;
            }
            case 'koikoi':
                if (!this.fast) sfx.koikoi();
                if (!this.fast) say('こいこい');
                this.hud();
                await this.banner('こいこい！', `${this.nameOf(ev.p)}は 勝負を つづけます`, 'koi');
                break;
            case 'stop':
                if (!this.fast) say('あがり');
                await this.banner('あがり！', `${this.nameOf(ev.p)}が 勝負に でました`, 'stop');
                break;
            case 'turn':
                this.hud();
                break;
            case 'roundEnd':
                vm.reveal = true;
                this.lay();
                this.hud();
                break;
            case 'gameEnd':
                break;
        }
    }

    /* ── 手を うけとって すすめる ─────────────── */

    /** じぶんの 手を おくる */
    submit(a) {
        this.selected = null;
        this.applyGlow();
        if (this.o.mode === 'online') this.submitOnline(a);
        else this.enqueue(a);
    }

    enqueue(a) {
        this.queue.push(a);
        this.pump();
    }

    async pump() {
        if (this.running || this.disposed) return;
        this.running = true;
        this.hud();
        while (this.queue.length && !this.disposed) {
            const a = this.queue.shift();
            if (a.t === 'play') this.capsBefore = this.s.caps[a.p].slice();
            // たまっている 手が 多い（入りなおした ときの おいつき）なら うごきを はぶく
            const fast = this.queue.length >= 2;
            let events;
            try {
                events = applyAction(this.s, a);
            } catch (e) {
                console.warn('うけつけない 手', a, e.message);
                if (this.o.mode === 'online') this.netError('対局の じょうほうが くいちがいました。部屋に 入りなおしてください');
                continue;
            }
            await this.run(events, fast);
        }
        this.running = false;
        if (!this.disposed) this.afterIdle();
    }

    isLocalCPU(p) {
        return this.o.mode !== 'online' && p === this.opp;
    }

    afterIdle() {
        const s = this.s;
        this.hud();
        if (s.phase === 'roundEnd') {
            if (this.shownRound !== s.round) {
                this.shownRound = s.round;
                if (this.o.mode !== 'online') this.enqueueLater({ t: 'ready', p: this.opp }, 0);
                this.showRoundResult();
            }
            return;
        }
        if (s.phase === 'gameEnd') {
            this.showGameResult();
            return;
        }
        const p = s.turn;
        if (this.isLocalCPU(p)) {
            const think = this.dur('cpu') * (s.phase === 'decide' ? 1.4 : 1);
            this.cpuTimer = setTimeout(() => {
                if (this.disposed) return;
                const a = chooseAction(this.s, p, this.o.level);
                if (a) this.enqueue(a);
            }, think);
            return;
        }
        if (p === this.me && s.phase === 'decide') this.showDecide();
        if (p === this.me && this.display.coach && (s.phase === 'play' || s.phase === 'pick')) this.coach();
    }

    enqueueLater(a, ms) {
        setTimeout(() => { if (!this.disposed) this.enqueue(a); }, ms);
    }

    /* ── さわる ──────────────────────────────── */

    bindInput() {
        let pressTimer = null, pressed = null, longFired = false, startXY = null;
        this.layer.addEventListener('pointerdown', e => {
            const el = e.target.closest('.card');
            if (!el) return;
            pressed = el;
            longFired = false;
            startXY = [e.clientX, e.clientY];
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                if (pressed && pressed.classList.contains('up')) {
                    longFired = true;
                    this.zoom(+pressed.dataset.id);
                }
            }, 480);
        });
        const cancel = () => { clearTimeout(pressTimer); };
        this.layer.addEventListener('pointermove', e => {
            if (startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 12) cancel();
        });
        this.layer.addEventListener('pointerup', cancel);
        this.layer.addEventListener('pointercancel', cancel);
        this.layer.addEventListener('contextmenu', e => e.preventDefault());
        this.layer.addEventListener('click', e => {
            const el = e.target.closest('.card');
            if (!el || longFired) { longFired = false; return; }
            this.tapCard(+el.dataset.id);
        });
        this.stage.addEventListener('click', e => {
            const b = e.target.closest('[data-act]');
            if (!b) return;
            const act = b.dataset.act;
            if (act === 'menu') this.showMenu();
            else if (act === 'yaku') this.showYakuSheet(this.me);
            else if (act === 'yaku-me') this.showYakuSheet(this.me);
            else if (act === 'yaku-opp') this.showYakuSheet(this.opp);
            else if (act === 'recommend') this.showRecommend();
        });
        this.zoomLayer.addEventListener('click', () => { this.zoomLayer.hidden = true; });
    }

    canAct() {
        const s = this.s;
        return !this.running && !this.waitingNet && s.turn === this.me && (s.phase === 'play' || s.phase === 'pick')
            && this.modalLayer.hidden;
    }

    tapCard(id) {
        const s = this.s, vm = this.vm;
        if (!this.canAct()) {
            if (s.phase === 'play' && s.turn !== this.me && vm.hands[this.me].includes(id)) this.say('いまは あいての 番です');
            return;
        }
        if (s.phase === 'pick') {
            const opts = fieldMatches(s, s.pending);
            if (opts.includes(id)) { sfx.tap(); this.submit({ t: 'pick', p: this.me, target: id }); }
            else this.say('光っている 札の どちらかを えらんでください');
            return;
        }
        const inHand = s.hands[this.me].includes(id);
        if (inHand) {
            if (this.selected === id || this.display.oneTap) {
                this.tryPlay(id, null);
            } else {
                sfx.tap();
                this.selected = id;
                this.layout(true);
                this.hud();
            }
            return;
        }
        if (vm.slots.has(id)) {
            if (this.selected !== null && fieldMatches(s, this.selected).includes(id)) {
                this.tryPlay(this.selected, id);
            } else if (this.selected !== null) {
                this.say(`「${CARDS[this.selected].name}」と「${CARDS[id].name}」は 月が ちがうので とれません`);
                sfx.ng();
            } else {
                const mine = s.hands[this.me].filter(c => monthOf(c) === monthOf(id));
                if (mine.length) this.say(`手札の「${CARDS[mine[0]].name}」で とれます`);
                else this.say(`${monthOf(id)}月（${MONTHS[monthOf(id)].flower}）の 札は 手札に ありません`);
            }
        }
    }

    tryPlay(card, target) {
        const m = fieldMatches(this.s, card);
        if (m.length === 2 && target === null) {
            if (this.selected !== card) { this.selected = card; this.layout(true); }
            this.say('同じ 月の 札が 2枚 あります。とる ほうを 場から えらんでください');
            sfx.tap();
            return;
        }
        const a = { t: 'play', p: this.me, card };
        if (m.length === 2) a.target = target;
        this.submit(a);
    }

    /** 光らせる 札 */
    applyGlow() {
        if (!this.vm) return;
        const s = this.s;
        const glow = new Set(), cue = new Set();
        if (this.s && this.canActQuiet()) {
            if (s.phase === 'pick') {
                fieldMatches(s, s.pending).forEach(id => glow.add(id));
            } else if (this.selected !== null) {
                fieldMatches(s, this.selected).forEach(id => glow.add(id));
            } else if (this.display.hint) {
                for (const c of s.hands[this.me]) if (fieldMatches(s, c).length) cue.add(c);
            }
        }
        if (this.recCard !== undefined && this.recCard !== null) cue.add(this.recCard);
        for (const el of this.els) {
            const id = +el.dataset.id;
            el.classList.toggle('glow', glow.has(id) && (this.display.hint || s.phase === 'pick' || fieldMatches(s, this.selected ?? -1).length === 2));
            el.classList.toggle('cue', cue.has(id));
            el.classList.toggle('rec', this.recCard === id);
        }
        if (this.hideMyHand) this.vm.hands[this.me].forEach(id => this.els[id].classList.remove('up'));
    }

    canActQuiet() {
        const s = this.s;
        return !this.running && s.turn === this.me && (s.phase === 'play' || s.phase === 'pick');
    }

    /* ── 文字の 表示 ─────────────────────────── */

    nameOf(p) {
        if (p === this.me) return this.o.names[p] || 'あなた';
        return this.o.names[p] || 'あいて';
    }

    hud() {
        if (!this.vm) return;
        const s = this.s, me = this.me, opp = this.opp;
        this.q('.g-round').innerHTML = `第${s.round}局 <small>/ ${s.rules.rounds}</small>` +
            (this.o.room ? ` <small class="room-no">部屋 ${esc(this.o.room.code)}</small>` : '');
        const fill = (sel, p) => {
            const row = this.q(sel);
            row.querySelector('.pl-name').textContent = this.nameOf(p);
            row.querySelector('.pl-score').textContent = `${s.scores[p]}点`;
            let b = '';
            if (s.dealer === p && s.phase !== 'roundEnd' && s.phase !== 'gameEnd') b += '<span class="badge oya">親</span>';
            if (s.koi[p]) b += `<span class="badge koi">こいこい${s.koi[p] > 1 ? '×' + s.koi[p] : ''}</span>`;
            row.querySelector('.pl-badges').innerHTML = b;
            row.classList.toggle('active', s.turn === p && (s.phase === 'play' || s.phase === 'pick' || s.phase === 'decide'));
        };
        fill('.pl-me', me);
        fill('.pl-opp', opp);
        this.q('.deck-count').textContent = this.vm.deck.length ? `山 ${this.vm.deck.length}` : '';
        // とった 札の 枚数
        const badges = (sel, p) => {
            const G = this.geo;
            this.q(sel).innerHTML = KIND_ORDER.map(k => {
                const n = this.vm.caps[p].filter(c => kindOf(c) === k).length;
                return `<span class="cb k-${k}${n ? '' : ' zero'}" style="left:${G.groups[k].x * this.u}px">${KIND_SHORT[k]} ${n}</span>`;
            }).join('');
        };
        badges('.cap-me', me);
        badges('.cap-opp', opp);
        this.chips();
        this.message();
        this.q('.rec-btn').disabled = !this.canActQuiet() && !(s.phase === 'decide' && s.turn === me);
        this.applyGlow();
    }

    chips() {
        const s = this.s, show = this.display.progress;
        const vm = this.vm;
        const mk = (p, mine) => {
            if (!show) return '';
            const list = calcYaku(vm.caps[p], s.rules);
            let html = list.map(y => `<span class="chip done">${esc(y.name)} ${y.pts}点</span>`).join('');
            const prog = yakuProgress(vm.caps[p], vm.caps[1 - p], s.rules)
                .filter(e => !e.done && e.possible && e.have > 0)
                .map(e => ({ ...e, left: e.need - e.have }))
                .filter(e => mine ? true : e.left <= 1 || e.have / e.need >= 0.6)
                .sort((a, b) => a.left - b.left || b.pts - a.pts)
                .slice(0, mine ? 5 : 3);
            html += prog.map(e => `<span class="chip${e.left === 1 ? ' near' : ''}${mine ? '' : ' warn'}">${esc(e.name)} ${e.have}/${e.need}</span>`).join('');
            return html;
        };
        this.q('.chips-me').innerHTML = mk(this.me, true);
        this.q('.chips-opp').innerHTML = mk(this.opp, false);
    }

    message() {
        if (this.msgLock && Date.now() < this.msgLock) return;
        const s = this.s, me = this.me;
        let t = '';
        if (this.waitingNet) t = 'つうしん中…';
        else if (this.running) t = '';
        else if (s.phase === 'play' && s.turn === me) {
            if (this.selected !== null) {
                const m = fieldMatches(s, this.selected);
                const c = CARDS[this.selected];
                if (m.length === 0) t = `「${c.name}」：とれる 札が ありません。もう一度 タップで 場に 出します`;
                else if (m.length === 2) t = `「${c.name}」：とる 札を 場から えらんでください`;
                else t = `「${c.name}」：もう一度 タップ（または 光る 札を タップ）で とります`;
            } else t = this.display.coach && this.coachText ? '💡 ' + this.coachText : 'あなたの 番です。手札から 1枚 えらんでください';
        } else if (s.phase === 'pick' && s.turn === me) t = 'めくった 札で とる 札を えらんでください';
        else if (s.phase === 'decide' && s.turn === me) t = 'こいこい しますか？';
        else if ((s.phase === 'play' || s.phase === 'pick' || s.phase === 'decide') && s.turn !== me) t = `${this.nameOf(s.turn)}の 番です…`;
        this.q('.msg').textContent = t;
    }

    say(text) {
        this.q('.msg').textContent = text;
        this.msgLock = Date.now() + 2500;
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => { this.msgLock = 0; this.message(); }, 2600);
    }

    toast(text) {
        this.say(text);
    }

    async banner(title, sub = '', kind = '') {
        if (this.fast) return;
        const b = this.q('.banner');
        b.className = 'banner ' + kind;
        b.innerHTML = `<div class="b-title">${esc(title)}</div>${sub ? `<div class="b-sub">${esc(sub)}</div>` : ''}`;
        void b.offsetWidth;
        b.classList.add('show');
        await wait(this.dur('banner'));
        b.classList.remove('show');
        await wait(200);
    }

    coach() {
        const r = recommend(this.s, this.me);
        this.coachText = r ? r.reason : '';
        this.message();
    }

    showRecommend() {
        const s = this.s;
        if (s.phase === 'decide' && s.turn === this.me) { this.showDecide(true); return; }
        if (!this.canAct()) return;
        const r = recommend(s, this.me);
        if (!r) return;
        const a = r.action;
        this.recCard = a.t === 'play' ? a.card : a.target;
        this.selected = null;
        this.layout(true);
        this.say('💡 ' + r.reason);
        clearTimeout(this.recTimer);
        this.recTimer = setTimeout(() => { this.recCard = null; this.applyGlow(); }, 4000);
    }

    zoom(id) {
        const c = CARDS[id];
        const yaku = yakuNamesFor(id, this.s.rules);
        this.zoomLayer.innerHTML = `<div class="zoom-card"><img src="${cardURL(id)}" alt="">
<div class="z-name">${esc(c.name)}</div><div class="z-yomi">${esc(c.yomi)}</div>
<div class="z-info"><span class="kind-pill k-${c.k}">${KIND_NAME[c.k]}</span> ${c.m}月（${MONTHS[c.m].flower}・${MONTHS[c.m].yomi}）</div>
${yaku.length ? `<div class="z-yaku">つかう 役：${yaku.map(esc).join('・')}</div>` : ''}
<div class="z-close">タップで とじる</div></div>`;
        this.zoomLayer.hidden = false;
    }

    /* ── モーダル ───────────────────────────── */

    modal(html, buttons, opts = {}) {
        return new Promise(resolve => {
            const L = this.modalLayer;
            L.innerHTML = `<div class="sheet ${opts.cls || ''}">${html}<div class="sheet-btns">${buttons.map((b, i) =>
                `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
            L.hidden = false;
            const done = v => { L.hidden = true; L.innerHTML = ''; resolve(v); };
            L.querySelectorAll('.sheet-btns .btn').forEach(btn => btn.addEventListener('click', () => {
                sfx.tap();
                done(buttons[+btn.dataset.i].value);
            }));
            if (opts.dismiss) L.onclick = e => { if (e.target === L) done(null); };
            else L.onclick = null;
            this.closeModal = () => done(null);
        });
    }

    async showDecide(withAdvice = false) {
        const s = this.s, me = this.me;
        if (this.decideOpen) return;
        this.decideOpen = true;
        const yaku = calcYaku(s.caps[me], s.rules);
        const rp = roundPoints(s, me);
        const adv = (this.display.coach || withAdvice) ? recommend(s, me) : null;
        const html = `<h2 class="sheet-title">役が できました！</h2>
<div class="yaku-made">${yaku.map(y => `<div class="ym"><span>${esc(y.name)}</span><b>${y.pts}点</b></div>`).join('')}</div>
<p class="now-pts">いま あがると <b>${rp.total}点</b>${rp.reasons.length ? `<small>（${rp.reasons.map(esc).join('・')}）</small>` : ''}</p>
<p class="explain"><b>こいこい</b>：つづけて もっと 点を ねらいます。ただし あいてが 先に 役を つくると、あいての 点に なります。<br>
<b>あがり</b>：ここで 勝負を おわらせて 点を もらいます。</p>
${adv ? `<p class="advice">💡 ${esc(adv.reason)}<br>おすすめ：<b>${adv.action.t === 'koikoi' ? 'こいこい' : 'あがり'}</b></p>` : ''}`;
        const v = await this.modal(html, [
            { label: 'こいこい<small>つづける</small>', value: 'koikoi', cls: 'koi' },
            { label: 'あがる<small>勝負</small>', value: 'stop', cls: 'primary' }
        ], { cls: 'decide' });
        this.decideOpen = false;
        if (v === null) return;
        this.submit({ t: v, p: me });
    }

    async showRoundResult() {
        const s = this.s, r = s.result, me = this.me;
        let title, cls;
        if (r.winner === null) { title = '流局（引き分け）'; cls = 'draw'; }
        else if (r.winner === me) { title = 'あなたの 勝ち！'; cls = 'win'; sfx.win(); }
        else { title = `${esc(this.nameOf(r.winner))}の 勝ち`; cls = 'lose'; sfx.lose(); }
        await wait(this.dur('pause'));
        let body = '';
        if (r.winner === null) body = '<p class="explain">どちらも 役を つくれないまま 手札が なくなりました。点は 入りません。親は そのままです。</p>';
        else {
            body = `<div class="yaku-made">${r.yaku.map(y => `<div class="ym"><span>${esc(y.name)}</span><b>${y.pts}点</b></div>
<div class="ym-cards">${(y.cards || []).slice(0, 12).map(id => cardImg(id)).join('')}</div>`).join('')}</div>`;
            if (r.reasons.length) body += `<p class="mult">${r.reasons.map(esc).join('<br>')}</p>`;
            body += `<p class="gain">${esc(this.nameOf(r.winner))}に <b>＋${r.total}点</b></p>`;
        }
        body += this.scoreTable();
        const last = s.round >= s.rules.rounds;
        const v = await this.modal(`<h2 class="sheet-title ${cls}">${title}</h2>${body}`,
            [{ label: last ? '結果を 見る' : 'つぎの 局へ', value: 'next', cls: 'primary' }], { cls: 'result' });
        if (v === 'next') {
            this.submit({ t: 'ready', p: me });
            if (this.o.mode === 'online' && !this.s.ready[this.opp]) this.say('あいてを 待っています…');
        }
    }

    scoreTable() {
        const s = this.s, me = this.me;
        const rows = s.history.map(h => {
            const w = h.winner;
            return `<tr><td>${h.round}</td><td>${w === me ? '+' + h.total : ''}</td><td>${w === this.opp ? '+' + h.total : ''}</td></tr>`;
        }).join('');
        return `<table class="score-table"><thead><tr><th>局</th><th>${esc(this.nameOf(me))}</th><th>${esc(this.nameOf(this.opp))}</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td>計</td><td>${s.scores[me]}</td><td>${s.scores[this.opp]}</td></tr></tfoot></table>`;
    }

    async showGameResult() {
        if (this.finalShown) return;
        this.finalShown = true;
        const s = this.s, me = this.me;
        const a = s.scores[me], b = s.scores[this.opp];
        const res = a > b ? 'w' : a < b ? 'l' : 'd';
        const title = { w: 'あなたの 勝ち！', l: '負けました…', d: '引き分け' }[res];
        if (res === 'w') sfx.win();
        if (this.o.onFinish) this.o.onFinish(res, s.scores.slice());
        const buttons = [];
        if (this.o.mode === 'online') {
            if (this.o.room.role === 'host') buttons.push({ label: 'もう一度 たいせん', value: 'again', cls: 'primary' });
            buttons.push({ label: '部屋を 出る', value: 'exit' });
        } else {
            buttons.push({ label: 'もう一度', value: 'again', cls: 'primary' }, { label: 'メニューへ', value: 'exit' });
        }
        const v = await this.modal(`<h2 class="sheet-title ${res === 'w' ? 'win' : res === 'l' ? 'lose' : 'draw'}">${title}</h2>
<p class="final">${esc(this.nameOf(me))} <b>${a}</b> 点 ／ ${esc(this.nameOf(this.opp))} <b>${b}</b> 点</p>
${this.scoreTable()}
${this.o.mode === 'online' && this.o.room.role !== 'host' ? '<p class="explain">ホストが「もう一度」を おすと、つぎの 対局が はじまります。</p>' : ''}`, buttons, { cls: 'result' });
        if (v === 'again') this.o.onAgain && this.o.onAgain();
        else this.o.onExit && this.o.onExit();
    }

    async showMenu() {
        const v = await this.modal(`<h2 class="sheet-title">メニュー</h2>`, [
            { label: '役の 一覧と すすみぐあい', value: 'yaku' },
            { label: '表示の 設定', value: 'display' },
            { label: 'ルールの かくにん', value: 'rules' },
            { label: this.o.mode === 'online' ? '部屋を 出る' : '対局を やめる', value: 'quit', cls: 'danger' },
            { label: 'とじる', value: null }
        ], { cls: 'menu', dismiss: true });
        if (v === 'yaku') this.showYakuSheet(this.me);
        else if (v === 'display') this.showDisplaySettings();
        else if (v === 'rules') this.showRules();
        else if (v === 'quit') {
            const ok = await this.modal('<h2 class="sheet-title">ほんとうに やめますか？</h2>', [
                { label: 'やめる', value: true, cls: 'danger' }, { label: 'つづける', value: false }]);
            if (ok) this.o.onExit && this.o.onExit(true);
        }
    }

    showRules() {
        const r = this.s.rules;
        const koi = { none: 'なし', opponent: 'あいてが こいこい中に あがると 2倍', self: 'じぶんの こいこい 1回ごとに +1倍' }[r.koiBonus];
        this.modal(`<h2 class="sheet-title">この 対局の ルール</h2>
<ul class="rule-list">
<li>局数：<b>${r.rounds}局</b></li>
<li>花見で一杯・月見で一杯：<b>${r.hanami ? 'あり' : 'なし'}</b></li>
<li>菊に盃を かすにも かぞえる：<b>${r.sakeKasu ? 'はい' : 'いいえ'}</b></li>
<li>7点以上で 2倍：<b>${r.double7 ? 'あり' : 'なし'}</b></li>
<li>こいこいの 倍：<b>${koi}</b></li>
<li>手役（手四・くっつき 6点）：<b>${r.teyaku ? 'あり' : 'なし'}</b></li>
</ul>`, [{ label: 'とじる', value: null }], { dismiss: true });
    }

    async showDisplaySettings() {
        const d = store.display;
        const items = [
            ['yakuButton', '「役」ボタンを 出す'], ['progress', 'できそうな 役を 出す'], ['hint', 'とれる 札を 光らせる'],
            ['labels', '札に 月と 種類の 名札'], ['recommend', '「おすすめ」ボタン'], ['coach', 'ひとこと アドバイス'],
            ['oneTap', '1回 タップで 札を 出す'], ['sound', '効果音'], ['voice', 'こえ（こいこい！など）']
        ];
        const html = `<h2 class="sheet-title">表示の 設定</h2>${this.o.mode === 'practice' ? '<p class="explain">コーチつき 対局では ヒントは いつも 出ます。</p>' : ''}
<div class="toggles">${items.map(([k, label]) => `<label class="tg"><span>${label}</span><input type="checkbox" data-k="${k}" ${d[k] ? 'checked' : ''}><i></i></label>`).join('')}
<div class="seg-row"><span>うごきの はやさ</span><div class="seg">${[['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']].map(([v, l]) =>
            `<button data-speed="${v}" class="${d.speed === v ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>`;
        const p = this.modal(html, [{ label: 'とじる', value: null, cls: 'primary' }], { dismiss: true });
        const L = this.modalLayer;
        L.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => {
            d[inp.dataset.k] = inp.checked;
            save();
        }));
        L.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
            d.speed = b.dataset.speed;
            L.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
            save();
        }));
        await p;
        if (this.o.mode !== 'practice') this.display = store.display;
        this.stage.classList.toggle('labels', !!this.display.labels);
        this.q('.yaku-btn').hidden = !this.display.yakuButton;
        this.q('.rec-btn').hidden = !this.display.recommend;
        this.hud();
    }

    showYakuSheet(p0) {
        const s = this.s;
        const render = p => {
            const mine = this.vm.caps[p], theirs = this.vm.caps[1 - p];
            const have = new Set(mine), gone = new Set(theirs);
            const made = calcYaku(mine, s.rules);
            const madeIds = new Set(made.map(y => y.id));
            const total = sumYaku(made);
            const rows = YAKU_DEFS.filter(y => !y.opt || s.rules[y.opt]).map(y => {
                let cards, count = '';
                if (y.cards) {
                    cards = y.cards.map(id => cardImg(id, have.has(id) ? 'have' : gone.has(id) ? 'gone' : 'yet')).join('');
                    const n = y.cards.filter(id => have.has(id)).length;
                    const need = y.id === 'goko' ? 5 : y.id === 'sanko' ? 3 : y.id === 'shiko' || y.id === 'ameshiko' ? 4 : y.cards.length;
                    count = `${Math.min(n, need)}/${need}`;
                } else {
                    const list = mine.filter(id => y.kind === 'kasu' ? (kindOf(id) === 'kasu' || (s.rules.sakeKasu && id === TAG.sake)) : kindOf(id) === y.kind);
                    cards = list.map(id => cardImg(id, 'have')).join('') || '<span class="none">まだ ありません</span>';
                    count = `${list.length}/${y.need}`;
                }
                const pts = madeIds.has(y.id) ? made.find(m => m.id === y.id).pts : y.pts;
                return `<div class="yrow${madeIds.has(y.id) ? ' made' : ''}"><div class="yhead"><b>${esc(y.name)}</b><span class="ycount">${count}</span><span class="ypts">${pts}点${y.kind ? '〜' : ''}</span></div>
<div class="ydesc">${esc(y.desc)}</div><div class="ycards">${cards}</div></div>`;
            }).join('');
            return `<div class="ysum">${esc(this.nameOf(p))}：いま <b>${total}点</b>${made.length ? '（' + made.map(y => esc(y.name)).join('・') + '）' : ''}</div>
<div class="legend">${cardImg(0, 'have')}とった　${cardImg(0, 'yet')}まだ　${cardImg(0, 'gone')}あいてが とった</div>${rows}`;
        };
        const html = `<div class="tabs"><button data-p="${this.me}">${esc(this.nameOf(this.me))}</button><button data-p="${this.opp}">${esc(this.nameOf(this.opp))}</button></div>
<div class="ylist"></div>`;
        this.modal(html, [{ label: 'とじる', value: null, cls: 'primary' }], { cls: 'yaku-sheet', dismiss: true });
        const L = this.modalLayer;
        const show = p => {
            L.querySelector('.ylist').innerHTML = render(p);
            L.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', +b.dataset.p === p));
        };
        L.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(+b.dataset.p)));
        show(p0);
    }

    /* ── オンライン ─────────────────────────── */

    async connectOnline() {
        const { code, game } = this.o.room;
        try {
            this.unsubs.push(await net.watchLog(code, game, (idx, a) => {
                if (idx !== this.logCount) {
                    // じゅんばんが とんだ（ふつうは おきない）
                    if (idx < this.logCount) return;
                }
                this.logCount = idx + 1;
                this.waitingNet = false;
                this.enqueue(a);
            }));
            this.unsubs.push(await net.watchOnline(code, on => {
                const role = this.o.room.role === 'host' ? 'guest' : 'host';
                const w = this.q('.net-warn');
                if (!on[role]) {
                    clearTimeout(this.offTimer);
                    this.offTimer = setTimeout(() => {
                        w.textContent = 'あいての つうしんが 切れています。もどるのを 待っています…';
                        w.hidden = false;
                    }, 2500);
                } else {
                    clearTimeout(this.offTimer);
                    w.hidden = true;
                }
            }));
        } catch (e) {
            this.netError(e.message);
        }
    }

    async submitOnline(a) {
        const { code, game } = this.o.room;
        this.waitingNet = true;
        this.hud();
        for (let tries = 0; tries < 6; tries++) {
            const ok = await net.pushMove(code, game, this.logCount, a);
            if (ok) return;
            // だれかが 先に 書いた：その 手が とどくのを 待って、まだ 打てる 手なら もう一度
            await wait(400);
            await this.untilIdle();
            const legal = legalActions(this.s, this.me).some(x => x.t === a.t && x.card === a.card && x.target === a.target);
            if (!legal) { this.waitingNet = false; this.hud(); return; }
        }
        this.waitingNet = false;
        this.netError('手を おくれませんでした。つうしんを たしかめてください');
    }

    untilIdle() {
        return new Promise(res => {
            const tick = () => (this.running || this.queue.length ? setTimeout(tick, 100) : res());
            tick();
        });
    }

    netError(msg) {
        const w = this.q('.net-warn');
        w.textContent = msg;
        w.hidden = false;
    }
}

function calcYakuIds(caps, rules) {
    return new Set(calcYaku(caps, rules).map(y => y.id + ':' + y.pts));
}
