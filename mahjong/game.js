/* 対局画面
   ------------------------------------------------------------------
   ・卓（緑）を 正方形で 画面に きっちり おさめ、自分は いつも 下
   ・卓の 上には 捨て牌・鳴いた 牌・あいての 手牌（うら）・アバター・まんなかの 点数
   ・自分の 手牌は 卓の 下に、画面の はしから はしまで 大きく ならべる
   ・牌は 1回 タップで 少し 上がって 黄色く かこまれ、もう 1回 タップで 捨てる
   ・あがりの 大きさで 雷・光・ゆれ が 大きく なる 演出
   すすめかたは engine.js の prompt() / act() を つかい、
   友だちとの 対戦では 手を ホストが きめた じゅんに ならべて 2台で 同じに うごかします。
   ------------------------------------------------------------------ */
import { kindOf, tileImage, tileName, sortTiles, toCounts, WIND_NAMES, isRedId, doraFromIndicator } from './tiles.js';
import { waits as waitKinds, shanten } from './hand.js';
import { tierLevel } from './score.js';
import { decide, recommendDiscard } from './ai.js';
import { sfx, say, stopVoice, YAKU_READING } from './sound.js';
import { FX } from './fx.js';
import { store, save, speedFactor } from './store.js';
import { icon } from './assets/icons.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ANGLES = [0, -90, 180, 90];
const KYOKU_NUM = ['一', '二', '三', '四'];
const REASON_NAMES = {
    exhaust: '流局', nagashi: '流し満貫', kyuushu: '九種九牌', suufon: '四風連打', suucha: '四家立直', suukan: '四槓散了', sancha: '三家和'
};

export class GameView {
    /**
     * cfg:
     *   engine     Mahjong
     *   mySeat     自分の 席
     *   players    席ごとの { name, avatar, kind: 'me'|'cpu'|'remote', level }
     *   role       'solo' | 'host' | 'guest'
     *   log(i, a)  ホスト：手を 書く
     *   send(a)    ゲスト：手を ホストへ おくる
     *   onExit()   ホームへ
     *   onFinish(final)  対局の おわり
     *   onReady()  ゲスト：「つぎへ」を おした
     *   peerReady() ホスト：ゲストが「つぎへ」を おしたか
     *   onRematch()     もう一度
     */
    constructor(root, cfg) {
        this.root = root;
        this.cfg = cfg;
        this.g = cfg.engine;
        this.me = cfg.mySeat;
        this.players = cfg.players;
        this.queue = [];
        this.busy = false;
        this.actionCount = 0;
        this.pendingLog = new Map();
        this.snap = this.g.snap();
        this.selected = null;
        this.riichiMode = false;
        this.uiStamp = -1;
        this.timers = new Set();
        this.disposed = false;
        this.skip = false;
        this.fast = false;
        this.auto = { win: false, noCall: false, tsumogiri: false };
        this.lastDiscardKey = null;
        this.result = null;
        this.build();
        this.fx = new FX(this.root.querySelector('.g-fxlayer'));
        this.onResize = () => this.layout();
        window.addEventListener('resize', this.onResize);
        window.addEventListener('orientationchange', this.onResize);
        this.layout();
        this.renderAll();
    }

    dispose() {
        this.disposed = true;
        for (const t of this.timers) clearTimeout(t);
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('orientationchange', this.onResize);
        this.fx.dispose();
        stopVoice();
        this.root.innerHTML = '';
    }

    later(fn, ms) {
        const t = setTimeout(() => { this.timers.delete(t); if (!this.disposed) fn(); }, ms);
        this.timers.add(t);
        return t;
    }
    sleep(ms) {
        if (this.fast || this.skip) return Promise.resolve();
        return new Promise(res => this.later(res, ms * speedFactor()));
    }

    pos(seat) { return (seat - this.me + 4) % 4; }
    seatAt(pos) { return (pos + this.me) % 4; }

    /* ── 画面の わく ───────────────────────── */

    build() {
        this.root.innerHTML = `
<div class="g-wrap">
  <header class="g-top">
    <button class="g-icon" data-act="menu" aria-label="メニュー">${icon('list')}</button>
    <div class="g-round"></div>
    <div class="g-dora"><span class="lbl">ドラ<br>表示</span><div class="dora-tiles"></div></div>
    <button class="g-icon" data-act="sound" aria-label="音">${icon(store.settings.sound ? 'speaker-high' : 'speaker-slash')}</button>
  </header>
  <div class="g-tablebox"><div class="g-table">
    <div class="felt"></div>
    <div class="seats"></div>
    <div class="center">
      <div class="cw cw0"></div><div class="cw cw1"></div><div class="cw cw2"></div><div class="cw cw3"></div>
      <div class="cinfo"></div>
      <div class="dicebox"></div>
    </div>
  </div></div>
  <div class="g-info">
    <div class="g-status"></div>
    <div class="g-autos">
      <button class="auto" data-auto="win">自動和了</button>
      <button class="auto" data-auto="noCall">鳴きなし</button>
      <button class="auto" data-auto="tsumogiri">ツモ切り</button>
    </div>
  </div>
  <div class="g-spacer"></div>
  <div class="g-actions"></div>
  <div class="g-hand"></div>
</div>
<div class="g-fxlayer"></div>
<div class="g-modal" hidden></div>`;
        const seats = this.root.querySelector('.seats');
        seats.innerHTML = [0, 1, 2, 3].map(p => `
<div class="seat pos${p}" style="transform:rotate(${ANGLES[p]}deg)">
  <div class="river"></div>
  <div class="melds"></div>
  <div class="backs"></div>
  <div class="plate"><div class="pl-in" style="transform:rotate(${-ANGLES[p]}deg)"></div></div>
</div>`).join('');
        this.root.addEventListener('click', e => this.onClick(e));
        this.$ = sel => this.root.querySelector(sel);
    }

    layout() {
        const tb = this.$('.g-tablebox');
        const hand = this.$('.g-hand');
        const W = window.innerWidth, H = window.innerHeight;
        const landscape = W > H * 1.15;
        this.root.classList.toggle('landscape', landscape);
        // 手牌の 牌の 大きさ（14枚＋すきまが 画面の はばに おさまる）
        // 14枚 ＋ ツモ牌の すきま（0.45枚）＋ 左右の よはく
        let tw = Math.floor((Math.min(W, 1100) - 12) / 14.5);
        tw = Math.min(tw, landscape ? Math.floor(H * 0.1) : 64);
        this.handTw = Math.max(18, tw);
        this.root.style.setProperty('--htw', this.handTw + 'px');
        // 卓：のこりの 高さと はばの 小さい ほうの 正方形
        const handH = Math.round(this.handTw * 4 / 3) + 16;
        let S;
        if (landscape) {
            // 横向き：上の 行・ボタンは 卓の 左右に おく
            S = Math.floor(Math.min(W - 300, H - handH - 14));
        } else {
            const top = this.$('.g-top').offsetHeight || 46;
            const info = this.$('.g-info').offsetHeight || 28;
            const act = 56;
            S = Math.floor(Math.min(W - 4, H - top - info - act - handH - 8));
        }
        S = Math.max(200, S);
        this.root.style.setProperty('--handH', handH + 'px');
        this.root.style.setProperty('--S', S + 'px');
        this.root.style.setProperty('--u', (S / 100) + 'px');
        tb.style.height = S + 'px';
        hand.style.minHeight = handH + 'px';
        this.S = S;
    }

    /** 席の 画面での まんなか（演出の 場所） */
    seatPoint(seat, r = 0.3) {
        const t = this.$('.g-table').getBoundingClientRect();
        const p = this.pos(seat);
        const dx = [0, r, 0, -r][p], dy = [r, 0, -r, 0][p];
        return { x: t.left + t.width * (0.5 + dx), y: t.top + t.height * (0.5 + dy) };
    }

    /* ── 牌の 部品 ─────────────────────────── */

    tileHTML(id, { side = false, back = false, cls = '', data = '' } = {}) {
        if (back) return `<div class="t back ${side ? 'side' : ''} ${cls}" ${data}></div>`;
        const img = tileImage(id, this.g.rules.aka);
        return `<div class="t ${side ? 'side' : ''} ${cls}" ${data}><i style="background-image:url(${img})"></i></div>`;
    }

    /* ── ぜんぶ えがく ─────────────────────── */

    renderAll() {
        const s = this.snap;
        this.renderTop();
        this.renderCenter();
        for (let seat = 0; seat < 4; seat++) {
            this.renderRiver(seat);
            this.renderMelds(seat);
            this.renderBacks(seat);
            this.renderPlate(seat);
        }
        this.renderHand();
        if (!s.hands) this.$('.g-status').textContent = '';
    }

    renderTop() {
        const s = this.snap;
        const g = this.g;
        const rw = WIND_NAMES[s.roundWind] || '東';
        this.$('.g-round').innerHTML = s.hands
            ? `<b>${rw}${KYOKU_NUM[s.kyoku]}局</b><span>${s.honba}本場${s.sticks ? ` 供託${s.sticks}` : ''}</span>`
            : `<b>${g.rules.length === 'tonpu' ? '東風戦' : '半荘戦'}</b>`;
        const ids = s.doraIds || [];
        let html = '';
        for (let i = 0; i < 5; i++) html += i < ids.length ? this.tileHTML(ids[i], { cls: 'dora-ind' }) : this.tileHTML(0, { back: true, cls: 'dora-ind' });
        this.$('.dora-tiles').innerHTML = html;
    }

    renderCenter() {
        const s = this.snap;
        for (let seat = 0; seat < 4; seat++) {
            const p = this.pos(seat);
            const wind = (seat - s.dealer + 4) % 4;
            const el = this.$('.cw' + p);
            const active = s.hands && s.turn === seat && this.g.phase === 'play';
            el.className = `cw cw${p}${active ? ' active' : ''}${wind === 0 ? ' dealer' : ''}${s.riichi && s.riichi[seat] ? ' riichi' : ''}`;
            el.innerHTML = `${s.riichi && s.riichi[seat] ? '<i class="cstick"></i>' : ''}<span class="wd">${WIND_NAMES[wind]}</span><span class="sc">${s.scores[seat]}</span>`;
        }
        this.$('.cinfo').innerHTML = s.hands
            ? `<div class="ci-round">${WIND_NAMES[s.roundWind]}${KYOKU_NUM[s.kyoku]}局</div>
               <div class="ci-left">残り <b>${s.remaining}</b></div>
               <div class="ci-sub">${s.honba ? `${s.honba}本場 ` : ''}${s.sticks ? `供託${s.sticks}` : ''}</div>`
            : '';
    }

    renderRiver(seat) {
        const s = this.snap;
        const el = this.$(`.seat.pos${this.pos(seat)} .river`);
        if (!s.discards) { el.innerHTML = ''; return; }
        const ds = s.discards[seat];
        const rows = [[], [], []];
        let n = 0;
        let sideNext = false;
        ds.forEach((d, i) => {
            const isLast = i === ds.length - 1;
            let side = d.riichi || sideNext;
            sideNext = false;
            if (d.called) { if (d.riichi) sideNext = true; return; }
            const row = Math.min(2, Math.floor(n / 6));
            const cls = [d.tsumogiri ? 'tg' : '', isLast && this.lastDiscardKey === `${seat}:${i}` ? 'last' : ''].join(' ');
            rows[row].push(this.tileHTML(d.tile, { side, cls }));
            n++;
        });
        el.innerHTML = rows.map(r => `<div class="rrow">${r.join('')}</div>`).join('');
    }

    renderMelds(seat) {
        const s = this.snap;
        const el = this.$(`.seat.pos${this.pos(seat)} .melds`);
        if (!s.melds) { el.innerHTML = ''; return; }
        el.innerHTML = s.melds[seat].map(m => this.meldHTML(seat, m)).join('');
    }

    meldHTML(seat, m) {
        // 鳴いた 牌を 横に する 位置：上家から 左、対面から まんなか、下家から 右
        const rel = (m.from - seat + 4) % 4;   // 1 下家 2 対面 3 上家
        if (m.type === 'ankan') {
            return `<div class="meld">${m.tiles.map((t, i) => this.tileHTML(t, { back: i === 0 || i === 3, cls: 'mt' })).join('')}</div>`;
        }
        const called = m.called;
        const own = m.tiles.filter(t => t !== called && t !== m.added);
        const sorted = sortTiles(own);
        let order;
        const sideTile = { id: called, side: true };
        if (m.type === 'chi') order = [sideTile, ...sorted.map(id => ({ id }))];
        else if (rel === 3) order = [sideTile, ...sorted.map(id => ({ id }))];
        else if (rel === 2) order = [{ id: sorted[0] }, sideTile, ...sorted.slice(1).map(id => ({ id }))];
        else order = [...sorted.map(id => ({ id })), sideTile];
        return `<div class="meld">${order.map(o => {
            if (o.side && m.type === 'kakan') {
                return `<div class="kstack">${this.tileHTML(m.added, { side: true, cls: 'mt' })}${this.tileHTML(o.id, { side: true, cls: 'mt' })}</div>`;
            }
            return this.tileHTML(o.id, { side: !!o.side, cls: 'mt' });
        }).join('')}</div>`;
    }

    renderBacks(seat) {
        const s = this.snap;
        const el = this.$(`.seat.pos${this.pos(seat)} .backs`);
        if (seat === this.me || !s.hands) { el.innerHTML = ''; return; }
        // あがった 人・流局で テンパイの 人は 手を ひらく
        const open = this.revealSeats && this.revealSeats.has(seat);
        const hand = s.hands[seat];
        const n = hand.length;
        const hasDraw = s.turn === seat && n % 3 === 2;
        let html = '';
        if (open) {
            const list = sortTiles(hasDraw ? hand.slice(0, -1) : hand);
            html = list.map(t => this.tileHTML(t, { cls: 'bt open' })).join('');
            if (hasDraw) html += `<span class="gap"></span>` + this.tileHTML(hand[n - 1], { cls: 'bt open' });
        } else {
            for (let i = 0; i < n; i++) {
                if (hasDraw && i === n - 1) html += `<span class="gap"></span>`;
                html += `<div class="t back bt"></div>`;
            }
        }
        el.innerHTML = html;
    }

    renderPlate(seat) {
        const s = this.snap;
        const p = this.pos(seat);
        const pl = this.players[seat];
        const el = this.$(`.seat.pos${p} .plate .pl-in`);
        const riichi = s.riichi && s.riichi[seat];
        const active = s.hands && s.turn === seat && this.g.phase === 'play';
        el.parentElement.className = `plate${active ? ' active' : ''}${riichi ? ' riichi' : ''}`;
        el.innerHTML = `<img src="${pl.avatar}" alt=""><div class="pl-name">${esc(pl.name)}</div>`;
    }

    /* ── 自分の 手牌 ── */

    renderHand() {
        const s = this.snap;
        const el = this.$('.g-hand');
        if (!s.hands) { el.innerHTML = ''; return; }
        const hand = s.hands[this.me].slice();
        const p = this.myPrompt;
        const drawn = (s.turn === this.me && hand.length % 3 === 2 && s.drawn !== null && hand.includes(s.drawn)) ? s.drawn : null;
        const rest = drawn !== null ? hand.filter(t => t !== drawn) : hand;
        const list = store.settings.sortHand ? sortTiles(rest) : rest;
        const canDiscard = p && p.type === 'turn' ? new Set(this.riichiMode ? p.options.riichi : p.options.discard) : null;
        const doras = new Set((s.doraIds || []).map(id => doraFromIndicator(kindOf(id))));
        const rec = this.recommendTile;
        const one = (t, extra = '') => {
            const cls = ['ht'];
            if (this.selected === t) cls.push('sel');
            if (canDiscard && !canDiscard.has(t)) cls.push('dim');
            if (doras.has(kindOf(t)) || (this.g.rules.aka && isRedId(t))) cls.push('dora');
            if (rec === t && store.settings.hint) cls.push('rec');
            return this.tileHTML(t, { cls: cls.join(' ') + extra, data: `data-tile="${t}"` });
        };
        let html = list.map(t => one(t)).join('');
        if (drawn !== null) html += `<span class="gap"></span>` + one(drawn, ' drawn');
        el.innerHTML = `<div class="hand-row">${html}</div>`;
        el.classList.toggle('my-turn', !!(p && p.type === 'turn'));
        el.classList.toggle('riichi-mode', this.riichiMode);
    }

    /* ── クリック ─────────────────────────── */

    onClick(e) {
        const act = e.target.closest('[data-act]');
        if (act) { this.onAct(act.dataset.act, act); return; }
        const au = e.target.closest('[data-auto]');
        if (au) {
            const k = au.dataset.auto;
            this.auto[k] = !this.auto[k];
            au.classList.toggle('on', this.auto[k]);
            sfx.button();
            this.step();
            return;
        }
        const t = e.target.closest('.g-hand [data-tile]');
        if (t) { this.onTile(Number(t.dataset.tile)); return; }
        const m = e.target.closest('.g-modal');
        if (m && this.skippable) { this.skip = true; }
    }

    onTile(id) {
        const p = this.myPrompt;
        if (!p || p.type !== 'turn') {
            // 手番で なくても えらぶ だけ できる（待ちを 見る ため）
            this.selected = this.selected === id ? null : id;
            sfx.select();
            this.renderHand();
            this.updateStatus();
            return;
        }
        const allowed = this.riichiMode ? p.options.riichi : p.options.discard;
        if (!allowed.includes(id)) { sfx.select(); return; }
        if (this.selected === id) {
            // 2回め：捨てる
            this.selected = null;
            const r = this.riichiMode;
            this.riichiMode = false;
            this.clearMyUI();
            this.submit(r ? { s: this.me, a: 'discard', t: id, r: 1 } : { s: this.me, a: 'discard', t: id });
            return;
        }
        this.selected = id;
        sfx.select();
        this.renderHand();
        this.updateStatus();
    }

    onAct(name, el) {
        const p = this.myPrompt;
        sfx.button();
        switch (name) {
        case 'menu': this.showMenu(); return;
        case 'sound':
            store.settings.sound = !store.settings.sound; save();
            el.innerHTML = icon(store.settings.sound ? 'speaker-high' : 'speaker-slash');
            if (!store.settings.sound) stopVoice();
            return;
        case 'tsumo': this.clearMyUI(); this.submit({ s: this.me, a: 'tsumo' }); return;
        case 'ron': this.clearMyUI(); this.submit({ s: this.me, a: 'ron' }); return;
        case 'kyuushu': this.clearMyUI(); this.submit({ s: this.me, a: 'kyuushu' }); return;
        case 'riichi':
            this.riichiMode = !this.riichiMode;
            if (this.riichiMode && p && !p.options.riichi.includes(this.selected)) this.selected = null;
            this.renderActions(); this.renderHand(); this.updateStatus();
            return;
        case 'pass':
            this.clearMyUI();
            if (p.type === 'claim') this.submit({ s: this.me, a: 'pass' });
            else if (p.type === 'turn' && this.snap.riichi[this.me]) this.submit({ s: this.me, a: 'discard', t: p.options.discard[0] });
            return;
        case 'pon': {
            const o = p.seats[this.me];
            this.clearMyUI();
            this.submit({ s: this.me, a: 'pon', t: o.pon[o.pon.length - 1] });
            return;
        }
        case 'chi': {
            const o = p.seats[this.me];
            const pats = uniqueChi(o.chi);
            if (pats.length === 1) { this.clearMyUI(); this.submit({ s: this.me, a: 'chi', t: pats[0] }); return; }
            this.showChoice('チーする 形を えらんでください', pats.map(c => ({
                html: [...sortTiles([...c, p.tile])].map(t => this.tileHTML(t, { cls: t === p.tile ? 'callt' : '' })).join(''),
                fn: () => { this.clearMyUI(); this.submit({ s: this.me, a: 'chi', t: c }); }
            })));
            return;
        }
        case 'kan': {
            if (p.type === 'claim') { this.clearMyUI(); this.submit({ s: this.me, a: 'minkan' }); return; }
            const opts = [
                ...p.options.ankan.map(k => ({ a: 'ankan', k, tiles: [k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 3] })),
                ...p.options.kakan.map(t => ({ a: 'kakan', t, tiles: [t] }))
            ];
            const go = o => { this.clearMyUI(); this.submit(o.a === 'ankan' ? { s: this.me, a: 'ankan', k: o.k } : { s: this.me, a: 'kakan', t: o.t }); };
            if (opts.length === 1) { go(opts[0]); return; }
            this.showChoice('カンする 牌を えらんでください', opts.map(o => ({
                html: this.tileHTML(o.tiles[0]) + `<span class="cap">${o.a === 'ankan' ? '暗槓' : '加槓'}</span>`,
                fn: () => go(o)
            })));
            return;
        }
        default:
        }
    }

    /* ── すすめかた ─────────────────────────── */

    /** 自分の 手を きめた */
    submit(action) {
        this.myPrompt = null;
        this.selected = null;
        this.riichiMode = false;
        this.stopTimer();
        if (this.cfg.role === 'guest') {
            this.sentKey = this.g.decisionKey();
            this.cfg.send(action, this.sentKey);
            this.$('.g-status').textContent = 'おくっています…';
            return;
        }
        this.applyAction(action, true);
    }

    /** 手を エンジンに わたし、できごとを ならべる */
    applyAction(action, fresh) {
        let events;
        try {
            events = this.g.act(action);
        } catch (e) {
            console.warn('うごけない 手', action, e.message);
            return false;
        }
        const idx = this.actionCount++;
        if (fresh && this.cfg.role === 'host') this.cfg.log(idx, action);
        this.myPrompt = null;
        this.clearMyUI(false);
        this.queue.push(...events);
        this.pump();
        return true;
    }

    /** ゲスト／やりなおし：ホストの 手を じゅんに うけとる */
    receive(idx, action) {
        if (idx < this.actionCount) return;
        this.pendingLog.set(idx, action);
        while (this.pendingLog.has(this.actionCount)) {
            const a = this.pendingLog.get(this.actionCount);
            this.pendingLog.delete(this.actionCount);
            // たくさん たまって いる ときは アニメを とばす
            if (!this.fastDrain) this.fast = this.pendingLog.size > 2;
            if (!this.applyAction(a, false)) { this.actionCount++; }
        }
    }

    /** もどってきた とき：いままでの 手を アニメなしで ぜんぶ ならべる */
    catchUp(actions) {
        if (!actions.length) return;
        this.fast = true;
        this.fastDrain = true;
        this.openingDone = true;
        actions.forEach((a, i) => { if (a) this.receive(i, a); });
        if (!this.busy && !this.queue.length) { this.fastDrain = false; this.fast = false; }
    }

    /** ホスト：ゲストから とどいた 手（key：ゲストが 見ていた 場面） */
    handleRequest(action, key) {
        if (this.cfg.role !== 'host') return;
        if (key !== undefined && key !== this.g.decisionKey()) return;
        const p = this.g.prompt();
        const guestSeat = this.players.findIndex(x => x.kind === 'remote');
        if (action.s !== guestSeat) return;
        if (p.type === 'turn' && p.seat !== guestSeat) return;
        if (p.type === 'claim' && !p.pending.includes(guestSeat)) return;
        if (p.type !== 'turn' && p.type !== 'claim') return;
        this.applyAction(action, true);
    }

    async pump() {
        if (this.busy || this.openingRunning) return;
        this.busy = true;
        try {
            while (this.queue.length && !this.disposed) {
                const e = this.queue.shift();
                await this.play(e);
            }
        } finally {
            this.busy = false;
        }
        if (this.fastDrain) { this.fastDrain = false; this.fast = false; }
        if (!this.disposed) this.step();
    }

    /** いま 何を する 番か を 見て、コンピューター・自分・あいて を うごかす */
    step() {
        if (this.busy || this.disposed || this.queue.length) return;
        const g = this.g;
        const p = g.prompt();
        const auth = this.cfg.role !== 'guest';
        const stamp = this.actionCount;
        if (p.type === 'ready') {
            if (this.openingDone) {
                if (auth) this.submitNext();
            } else if (!this.openingRunning) {
                this.opening();
            }
            return;
        }
        if (p.type === 'handEnd' || p.type === 'over') return;   // 結果の 画面で ボタンを まつ
        if (p.type === 'turn') {
            const kind = this.players[p.seat].kind;
            if (kind === 'cpu') {
                this.$('.g-status').textContent = `${this.players[p.seat].name} の 番です`;
                if (!auth) return;
                this.later(() => {
                    if (this.actionCount !== stamp || this.busy) return;
                    const pr = g.prompt();
                    if (pr.type !== 'turn' || pr.seat !== p.seat) return;
                    this.applyAction(decide(g, p.seat, pr, this.players[p.seat].level), true);
                }, this.thinkTime(p));
            } else if (p.seat === this.me) {
                this.askTurn(p, stamp);
            } else {
                this.$('.g-status').textContent = `${this.players[p.seat].name} の 番です`;
            }
            return;
        }
        if (p.type === 'claim') {
            // コンピューターは すぐ きめる
            if (auth) {
                const cpu = p.pending.find(s => this.players[s].kind === 'cpu');
                if (cpu !== undefined) {
                    this.later(() => {
                        if (this.actionCount !== stamp) return;
                        const pr = g.prompt();
                        if (pr.type !== 'claim' || !pr.pending.includes(cpu)) return;
                        this.applyAction(decide(g, cpu, pr, this.players[cpu].level), true);
                    }, 60);
                    return;
                }
            }
            if (p.pending.includes(this.me)) this.askClaim(p, stamp);
            else this.$('.g-status').textContent = '';
        }
    }

    thinkTime(p) {
        const base = this.snap.riichi && this.snap.riichi[p.seat] ? 450 : 650;
        return (base + Math.random() * 450) * speedFactor();
    }

    submitNext() {
        if (this.cfg.role === 'guest') return;
        this.applyAction({ a: 'next' }, true);
    }

    /* ── 自分の 番 ── */

    askTurn(p, stamp) {
        if (this.uiStamp === stamp) return;
        if (this.cfg.role === 'guest' && this.sentKey === this.g.decisionKey()) return;
        this.uiStamp = stamp;
        this.myPrompt = p;
        this.selected = null;
        const o = p.options;
        // 自動
        if (o.tsumo && this.auto.win) { this.submit({ s: this.me, a: 'tsumo' }); return; }
        const riichiNow = this.snap.riichi[this.me];
        if (riichiNow && !o.tsumo && !o.ankan.length) {
            // リーチ中は ツモ切り
            this.later(() => { if (this.myPrompt === p) this.submit({ s: this.me, a: 'discard', t: o.discard[0] }); }, 550 * speedFactor());
            this.renderHand();
            this.$('.g-status').textContent = 'リーチ中（ツモ切り）';
            return;
        }
        if (this.auto.tsumogiri && !o.tsumo && this.snap.drawn !== null && o.discard.includes(this.snap.drawn) && !o.riichi.length && !o.ankan.length && !o.kakan.length) {
            this.later(() => { if (this.myPrompt === p) this.submit({ s: this.me, a: 'discard', t: this.snap.drawn }); }, 350 * speedFactor());
            return;
        }
        if (store.settings.hint) {
            try { this.recommendTile = recommendDiscard(this.g, this.me, o); } catch (e) { this.recommendTile = null; }
        } else this.recommendTile = null;
        sfx.myTurn();
        this.renderHand();
        this.renderActions();
        this.updateStatus();
        this.startTimer(p, 'turn');
    }

    askClaim(p, stamp) {
        if (this.uiStamp === stamp) return;
        if (this.cfg.role === 'guest' && this.sentKey === this.g.decisionKey()) return;
        this.uiStamp = stamp;
        const o = p.seats[this.me];
        if (o.ron && this.auto.win) { this.submit({ s: this.me, a: 'ron' }); return; }
        if (!o.ron && this.auto.noCall) { this.submit({ s: this.me, a: 'pass' }); return; }
        this.myPrompt = p;
        this.renderActions();
        this.updateStatus();
        this.startTimer(p, 'claim');
    }

    renderActions() {
        const el = this.$('.g-actions');
        const p = this.myPrompt;
        let html = '';
        const b = (act, label, cls) => `<button class="ab ${cls}" data-act="${act}">${label}</button>`;
        if (p && p.type === 'turn') {
            const o = p.options;
            if (o.tsumo) html += b('tsumo', 'ツモ', 'win');
            if (o.riichi.length) html += b('riichi', this.riichiMode ? 'やめる' : 'リーチ', 'riichi' + (this.riichiMode ? ' on' : ''));
            if (o.ankan.length || o.kakan.length) html += b('kan', 'カン', 'call');
            if (o.kyuushu) html += b('kyuushu', '九種九牌', 'call');
            if ((o.tsumo || o.ankan.length) && this.snap.riichi[this.me]) html += b('pass', 'ツモ切り', 'pass');
        } else if (p && p.type === 'claim') {
            const o = p.seats[this.me];
            if (o.ron) html += b('ron', 'ロン', 'win');
            if (o.minkan) html += b('kan', 'カン', 'call');
            if (o.pon.length) html += b('pon', 'ポン', 'call');
            if (o.chi.length) html += b('chi', 'チー', 'call');
            html += b('pass', 'スキップ', 'pass');
        }
        el.innerHTML = html;
        el.classList.toggle('show', !!html);
        // 鳴ける 牌を 光らせる
        this.root.querySelectorAll('.river .t.last').forEach(x => x.classList.toggle('claimable', !!(p && p.type === 'claim')));
    }

    clearMyUI(render = true) {
        this.$('.g-actions').innerHTML = '';
        this.$('.g-actions').classList.remove('show');
        this.closeChoice();
        this.stopTimer();
        if (render) { this.renderHand(); }
    }

    updateStatus() {
        const el = this.$('.g-status');
        const p = this.myPrompt;
        const s = this.snap;
        let txt = '';
        if (p && p.type === 'turn') {
            txt = this.riichiMode ? 'リーチ：牌を えらんで もう一度 タップ' : 'あなたの 番：タップで えらび、もう一度 タップで 捨てる';
        } else if (p && p.type === 'claim') {
            const o = p.seats[this.me];
            txt = o.ron ? 'ロン できます！' : `${tileName(kindOf(p.tile))} を 鳴けます`;
        }
        // 待ちの 表示
        if (store.settings.showWaits && s.hands) {
            const hand = s.hands[this.me];
            const mc = s.melds[this.me].length;
            let base = null;
            if (hand.length % 3 === 2 && this.selected !== null) base = hand.filter(t => t !== this.selected);
            else if (hand.length % 3 === 1) base = hand;
            if (base) {
                const c = toCounts(base);
                if (shanten(c, mc) === 0) {
                    const w = waitKinds(c, mc);
                    if (w.length) {
                        const vis = this.visibleCounts();
                        const parts = w.map(k => `${tileName(k)}<small>${Math.max(0, 4 - vis[k] - c[k])}</small>`);
                        let furiten = false;
                        if (hand.length % 3 === 1 && this.g.phase === 'play') {
                            try { furiten = this.g.isFuriten(this.me); } catch (e) { furiten = false; }
                        } else {
                            const disc = new Set(s.discards[this.me].map(d => kindOf(d.tile)));
                            furiten = w.some(k => disc.has(k));
                        }
                        txt = `<span class="waits">${this.selected !== null && hand.length % 3 === 2 ? 'これを 切ると ' : ''}待ち：${parts.join(' ')}</span>${furiten ? '<span class="furiten">フリテン</span>' : ''}`;
                        if (p && p.type === 'claim') txt = (p.seats[this.me].ron ? 'ロン できます！ ' : '') + txt;
                    }
                }
            }
        }
        el.innerHTML = txt;
    }

    visibleCounts() {
        const s = this.snap;
        const v = new Array(34).fill(0);
        for (let q = 0; q < 4; q++) {
            for (const d of s.discards[q]) if (!d.called) v[kindOf(d.tile)]++;
            for (const m of s.melds[q]) for (const t of m.tiles) v[kindOf(t)]++;
        }
        for (const id of s.doraIds) v[kindOf(id)]++;
        return v;
    }

    /* ── 持ち時間（ルールで えらんだ とき） ── */

    startTimer(p, kind) {
        const mode = this.g.rules.timer;
        if (!mode || mode === 'none') return;
        if (this.bank === undefined) this.bank = 30;
        let grace = 5;
        const el = document.createElement('div');
        el.className = 'g-timer';
        this.$('.g-actions').prepend(el);
        const tick = () => {
            if (this.myPrompt !== p) return;
            if (grace > 0) { el.innerHTML = `<b>${grace}</b>`; grace--; }
            else if (this.bank > 0) { el.innerHTML = `<b class="bank">${this.bank}</b><small>持ち時間</small>`; this.bank--; if (this.bank <= 5) sfx.tick(); }
            else {
                el.innerHTML = '<b class="bank">0</b>';
                if (mode === 'auto') {
                    if (kind === 'turn') this.submit({ s: this.me, a: 'discard', t: p.options.discard.includes(this.snap.drawn) ? this.snap.drawn : p.options.discard[p.options.discard.length - 1] });
                    else this.submit({ s: this.me, a: 'pass' });
                }
                return;
            }
            this.timerT = this.later(tick, 1000);
        };
        tick();
    }
    stopTimer() {
        if (this.timerT) { clearTimeout(this.timerT); this.timers.delete(this.timerT); this.timerT = null; }
        this.root.querySelectorAll('.g-timer').forEach(x => x.remove());
    }

    /* ── えらぶ 画面 ── */

    showChoice(title, items) {
        this.closeChoice();
        const box = document.createElement('div');
        box.className = 'g-choice';
        box.innerHTML = `<div class="ch-title">${title}</div><div class="ch-items">${items.map((it, i) => `<button class="ch-item" data-i="${i}">${it.html}</button>`).join('')}</div><button class="ch-cancel">やめる</button>`;
        box.addEventListener('click', e => {
            const b = e.target.closest('.ch-item');
            if (b) { sfx.button(); this.closeChoice(); items[Number(b.dataset.i)].fn(); return; }
            if (e.target.closest('.ch-cancel')) { sfx.button(); this.closeChoice(); }
        });
        this.root.querySelector('.g-wrap').appendChild(box);
    }
    closeChoice() { this.root.querySelectorAll('.g-choice').forEach(x => x.remove()); }

    /* ── できごとの 演出 ─────────────────────── */

    async play(e) {
        const prev = this.snap;
        if (e.snap) this.snap = e.snap;
        const fast = this.fast;
        switch (e.type) {
        case 'handStart': {
            this.revealSeats = null;
            this.closeModal();
            this.bank = 30;
            this.lastDiscardKey = null;
            this.renderAll();
            if (fast) break;
            await this.handIntro(e);
            break;
        }
        case 'deal': {
            if (fast) { this.renderAll(); break; }
            // 4枚ずつ くばる ように 見せる
            const full = this.snap;
            for (let r = 1; r <= 4; r++) {
                const n = r < 4 ? r * 4 : 13;
                this.snap = { ...full, hands: full.hands.map(h => h.slice(0, n)) };
                this.renderBacksAll();
                this.renderHand();
                sfx.deal();
                await this.sleep(170);
            }
            this.snap = full;
            this.renderAll();
            break;
        }
        case 'draw': {
            if (e.seat !== this.me) this.$('.g-status').textContent = `${this.players[e.seat].name} の 番です`;
            this.renderCenter();
            this.renderPlates();
            if (e.seat === this.me) {
                this.renderHand();
                const d = this.$('.g-hand .drawn');
                if (d && !fast) { d.classList.add('in'); sfx.draw(); }
            } else {
                this.renderBacks(e.seat);
                if (!fast) sfx.draw();
            }
            if (e.rinshan) this.renderTop();
            if (!fast) await this.sleep(e.seat === this.me ? 120 : 160);
            break;
        }
        case 'discard': {
            const ds = this.snap.discards[e.seat];
            this.lastDiscardKey = `${e.seat}:${ds.length - 1}`;
            this.renderRiver(e.seat);
            if (e.seat === this.me) this.renderHand(); else this.renderBacks(e.seat);
            this.renderCenter();
            this.renderPlates();
            if (fast) break;
            const t = this.$(`.seat.pos${this.pos(e.seat)} .river .t.last`);
            if (t) t.classList.add(e.riichi ? 'slam' : 'drop');
            if (e.riichi) {
                await this.riichiFx(e.seat);
            } else {
                sfx.discard(e.tsumogiri ? 0.8 : 1);
                await this.sleep(260);
            }
            break;
        }
        case 'riichiStick':
            this.renderCenter();
            this.renderPlates();
            if (!fast) { sfx.stick(); await this.sleep(150); }
            break;
        case 'call': {
            this.lastDiscardKey = null;
            this.renderAll();
            if (fast) break;
            const word = { chi: 'チー', pon: 'ポン', minkan: 'カン' }[e.call];
            this.$('.g-status').textContent = `${this.players[e.seat].name}：${word}`;
            await this.callFx(e.seat, word);
            break;
        }
        case 'ankan':
        case 'kakan':
            this.renderAll();
            if (fast) break;
            await this.callFx(e.seat, 'カン');
            break;
        case 'dora':
            this.renderTop();
            if (!fast) {
                sfx.flip();
                const ds = this.root.querySelectorAll('.dora-tiles .t');
                const t = ds[this.snap.doraIds.length - 1];
                if (t) t.classList.add('flipin');
                await this.sleep(400);
            }
            break;
        case 'agari':
            this.snapBefore = prev;
            this.renderAll();
            await this.agariFx(e, prev);
            break;
        case 'ryuukyoku':
            this.renderAll();
            await this.ryuukyokuFx(e);
            break;
        case 'matchEnd':
            this.finalResult = e.final;
            break;
        case 'handEnd':
            this.showHandEndButton(e.over);
            break;
        default:
        }
    }

    renderPlates() { for (let s = 0; s < 4; s++) this.renderPlate(s); }
    renderBacksAll() { for (let s = 0; s < 4; s++) this.renderBacks(s); }

    /* ── 局の はじまり：サイコロ・山の わかれ目・東一局 ── */

    async handIntro(e) {
        const rw = WIND_NAMES[e.roundWind];
        const dealerName = this.players[e.dealer].name;
        this.fx.bigText(`${rw}${KYOKU_NUM[e.kyoku]}局`, { style: 'round', dur: 1400 });
        if (e.honba) this.fx.bigText(`${e.honba}本場`, { style: 'honba', dur: 1400, at: this.centerPoint(0.12) });
        sfx.shuffle();
        say(`${rw}${KYOKU_NUM[e.kyoku]}局`, null);
        await this.sleep(1300);
        // 親が サイコロを ふって 配牌を とる 山を きめる
        const owner = (e.wallOwner - e.dealer + 4) % 4;
        await this.rollDice(e.dice, `親 ${dealerName}`, `出目 ${e.dice[0] + e.dice[1]}：${WIND_NAMES[owner]}家の 山の 右から ${e.dice[0] + e.dice[1]}つ目で わける`);
    }

    centerPoint(dy = 0) {
        const t = this.$('.g-table').getBoundingClientRect();
        return { x: t.left + t.width / 2, y: t.top + t.height * (0.5 + dy) };
    }

    /** サイコロを ふる（卓の まんなか） */
    async rollDice(dice, who, caption) {
        const box = this.$('.dicebox');
        const faces = ['dice-one', 'dice-two', 'dice-three', 'dice-four', 'dice-five', 'dice-six'];
        box.innerHTML = `<div class="dice-who">${esc(who)}</div><div class="dice-row"><span class="die">${icon('dice-one', 'dico')}</span><span class="die">${icon('dice-one', 'dico')}</span></div><div class="dice-cap"></div>`;
        box.classList.add('show');
        const ds = box.querySelectorAll('.die');
        sfx.dice();
        if (!this.fast) {
            for (let i = 0; i < 10; i++) {
                ds.forEach(d => { d.innerHTML = icon(faces[Math.floor(Math.random() * 6)], 'dico'); d.style.transform = `rotate(${Math.random() * 360}deg) translateY(${-6 + Math.random() * 12}px)`; });
                await this.sleep(65);
            }
        }
        ds.forEach((d, i) => { d.innerHTML = icon(faces[dice[i] - 1], 'dico'); d.style.transform = ''; d.classList.add('land'); });
        box.querySelector('.dice-cap').textContent = caption;
        await this.sleep(1300);
        box.classList.remove('show');
        await this.sleep(150);
        box.innerHTML = '';
    }

    /* ── さいしょ：座席決め・仮親決め・親決め ── */

    async opening() {
        this.openingRunning = true;
        const g = this.g;
        if (this.fast) {
            this.openingDone = true; this.openingRunning = false; this.step(); return;
        }
        const m = this.$('.g-modal');
        m.hidden = false;
        // 参加者ごとの 席（風）
        const seatsOfPlayers = [0, 1, 2, 3];
        const tilesHTML = [0, 1, 2, 3].map(seat => {
            const pl = this.players[seat];
            return `<div class="op-card" data-seat="${seat}"><div class="op-flip"><div class="t back op-t"></div><div class="op-face">${this.tileHTML((27 + seat) * 4, { cls: 'op-t' })}</div></div><img src="${pl.avatar}" alt=""><div class="op-name">${esc(pl.name)}</div><div class="op-wind"></div></div>`;
        });
        // 表示は 自分から 反時計まわり
        const order = [0, 1, 2, 3].map(p => this.seatAt(p));
        m.innerHTML = `<div class="opening">
<h2>座席決め</h2>
<p class="op-msg">風牌を 1枚ずつ ひいて 座る 席を きめます</p>
<div class="op-cards">${order.map(s => tilesHTML[s]).join('')}</div>
<div class="op-dice"></div>
<button class="btn op-skip">とばす</button>
</div>`;
        let skipped = false;
        m.querySelector('.op-skip').addEventListener('click', () => { skipped = true; this.skip = true; sfx.button(); });
        sfx.shuffle();
        await this.sleep(900);
        for (const s of order) {
            const card = m.querySelector(`.op-card[data-seat="${s}"]`);
            card.classList.add('flipped');
            card.querySelector('.op-wind').textContent = s === 0 ? '仮東' : `${WIND_NAMES[s]}`;
            sfx.flip();
            await this.sleep(450);
        }
        await this.sleep(500);
        const kari = 0; // 東を ひいた 人が 仮東
        const kname = this.players[kari].name;
        m.querySelector('h2').textContent = '仮親決め';
        m.querySelector('.op-msg').textContent = `仮東（東を ひいた ${kname}）が サイコロを ふります`;
        await this.opDice(m, g.dice1, `出目 ${g.dice1[0] + g.dice1[1]} → ${this.players[g.kariOya].name} が 仮親`);
        m.querySelector('h2').textContent = '親決め';
        m.querySelector('.op-msg').textContent = `仮親（${this.players[g.kariOya].name}）が もう一度 サイコロを ふります`;
        await this.opDice(m, g.dice2, `出目 ${g.dice2[0] + g.dice2[1]} → ${this.players[g.startDealer].name} が 起家（さいしょの 親）`);
        m.querySelectorAll('.op-card').forEach(c => {
            const s = Number(c.dataset.seat);
            c.classList.toggle('oya', s === g.startDealer);
            const w = (s - g.startDealer + 4) % 4;
            c.querySelector('.op-wind').textContent = w === 0 ? '東家（親）' : `${WIND_NAMES[w]}家`;
        });
        say(`${this.players[g.startDealer].name}が 親です`, null);
        await this.sleep(1400);
        this.skip = false;
        m.hidden = true;
        m.innerHTML = '';
        this.openingDone = true;
        this.openingRunning = false;
        void skipped;
        void seatsOfPlayers;
        if (this.queue.length) this.pump(); else this.step();
    }

    async opDice(m, dice, caption) {
        const faces = ['dice-one', 'dice-two', 'dice-three', 'dice-four', 'dice-five', 'dice-six'];
        const box = m.querySelector('.op-dice');
        box.innerHTML = `<div class="dice-row big"><span class="die">${icon('dice-one', 'dico')}</span><span class="die">${icon('dice-one', 'dico')}</span></div><div class="dice-cap"></div>`;
        const ds = box.querySelectorAll('.die');
        sfx.dice();
        if (!this.skip) {
            for (let i = 0; i < 11; i++) {
                ds.forEach(d => { d.innerHTML = icon(faces[Math.floor(Math.random() * 6)], 'dico'); d.style.transform = `rotate(${Math.random() * 360}deg) translateY(${-8 + Math.random() * 16}px)`; });
                await this.sleep(70);
            }
        }
        ds.forEach((d, i) => { d.innerHTML = icon(faces[dice[i] - 1], 'dico'); d.style.transform = ''; d.classList.add('land'); });
        box.querySelector('.dice-cap').textContent = caption;
        await this.sleep(1500);
    }

    /* ── リーチ・鳴きの 演出 ── */

    async riichiFx(seat) {
        const pt = this.seatPoint(seat, 0.28);
        sfx.slam();
        say('リーチ', this.pos(seat));
        this.fx.beam(pt.y, { height: 90 });
        this.fx.flash('#fff3c0', 260, 0.35);
        this.fx.bigText('リーチ', { style: 'riichi', at: pt, dur: 1150 });
        sfx.riichi();
        this.cutIn(seat, 'リーチ');
        await this.sleep(1050);
    }

    async callFx(seat, word) {
        const pt = this.seatPoint(seat, 0.3);
        sfx.call();
        say(word, this.pos(seat));
        this.fx.bigText(word, { style: 'call', at: pt, dur: 900 });
        this.fx.burst(pt.x, pt.y, { count: 18, colors: ['#fff', '#9be7ff', '#ffe58a'], speed: 4 });
        await this.sleep(700);
    }

    /** アバターの カットイン */
    cutIn(seat, word, level = 0) {
        const pl = this.players[seat];
        const el = document.createElement('div');
        el.className = `cutin lv${level}`;
        el.innerHTML = `<div class="ci-band"><img src="${pl.avatar}" alt=""><div class="ci-txt"><b>${esc(word)}</b><span>${esc(pl.name)}</span></div></div>`;
        this.fx.text.appendChild(el);
        this.later(() => el.remove(), 1400);
    }

    /* ── あがりの 演出 ── */

    async agariFx(e, prev) {
        this.revealSeats = new Set(e.wins.map(w => w.seat));
        this.renderBacksAll();
        const tsumo = e.tsumo;
        const levels = e.wins.map(w => tierLevel(w.result.name || ''));
        const top = Math.max(...levels);
        // 1) 宣言：画面を くらく → 雷 → 大きな「ロン」「ツモ」
        if (!this.fast) {
            const wrap = this.$('.g-wrap');
            this.fx.dim(1500 + top * 250, 0.45 + top * 0.06);
            for (const w of e.wins) {
                const pt = this.seatPoint(w.seat, 0.28);
                say(tsumo ? 'ツモ' : 'ロン', this.pos(w.seat));
                this.fx.bigText(tsumo ? 'ツモ' : 'ロン', { style: tsumo ? 'tsumo' : 'ron', at: pt, dur: 1500 + top * 200, level: levels[e.wins.indexOf(w)] });
            }
            const lv = top;
            const tgt = this.seatPoint(e.wins[0].seat, 0.28);
            this.fx.lightning(lv, tgt);
            sfx.thunder(lv);
            if (store.settings.fx !== 'lite') this.fx.shake(wrap, 3 + lv * 3, 400 + lv * 120);
            if (lv >= 3) this.fx.rays(tgt.x, tgt.y, 1600 + lv * 300, { rainbow: lv >= 5 });
            if (lv >= 5) { this.later(() => { this.fx.lightning(5, null); sfx.thunder(5); }, 900); this.fx.rain(3200, { rainbow: true }); }
            this.cutIn(e.wins[0].seat, tsumo ? 'ツモ' : 'ロン', lv);
            await this.sleep(1500 + top * 250);
        }
        // 2) 結果の 画面（1人ずつ）
        for (const w of e.wins) await this.showWin(w, e);
        // 3) 点数の うごき
        await this.showScoreChange(e.before, e.deltas, e.scores);
    }

    async showWin(w, e) {
        const m = this.$('.g-modal');
        const r = w.result;
        const lv = tierLevel(r.name || '');
        const pl = this.players[w.seat];
        const tsumo = w.from === null;
        m.hidden = false;
        this.skippable = true;
        this.skip = this.fast;
        const handTiles = sortTiles(w.hand).map(t => this.tileHTML(t, { cls: 'rt' })).join('');
        const meldTiles = w.melds.map(mm => `<div class="rmeld">${this.meldHTML(w.seat, mm)}</div>`).join('');
        const doraHTML = [0, 1, 2, 3, 4].map(i => i < w.doraInd.length ? this.tileHTML(w.doraInd[i], { cls: 'rd' }) : this.tileHTML(0, { back: true, cls: 'rd' })).join('');
        const uraHTML = [0, 1, 2, 3, 4].map(i => this.tileHTML(0, { back: true, cls: 'rd ura' + (i < w.uraInd.length ? ' will' : '') })).join('');
        m.innerHTML = `<div class="result win lv${lv}">
  <div class="rs-head"><img src="${pl.avatar}" alt=""><div><b>${esc(pl.name)}</b><span class="rs-how ${tsumo ? 'tsumo' : 'ron'}">${tsumo ? 'ツモ' : 'ロン'}</span>${w.from !== null ? `<small>${esc(this.players[w.from].name)} から</small>` : ''}</div></div>
  <div class="rs-hand" style="--rtw:${this.resultTw(w.hand.length + 1 + w.melds.length * 3.4)}px">${handTiles}<span class="gap"></span>${this.tileHTML(w.tile, { cls: 'rt win-tile' })}${meldTiles ? `<span class="gap"></span>${meldTiles}` : ''}</div>
  <div class="rs-dora"><div><span>ドラ</span>${doraHTML}</div>${w.riichi && w.uraInd.length ? `<div><span>裏ドラ</span>${uraHTML}</div>` : ''}</div>
  <div class="rs-yaku"></div>
  <div class="rs-total"></div>
  <div class="rs-btns"></div>
</div>`;
        await this.sleep(500);
        // 裏ドラを めくる
        if (w.riichi && w.uraInd.length) {
            const uras = m.querySelectorAll('.rd.ura.will');
            for (let i = 0; i < uras.length; i++) {
                uras[i].outerHTML = this.tileHTML(w.uraInd[i], { cls: 'rd ura flipin' });
                sfx.flip();
                await this.sleep(300);
            }
            if (r.ura > 0) { sfx.sparkle(); }
            await this.sleep(300);
        }
        // 役を 1つずつ
        const box = m.querySelector('.rs-yaku');
        const lines = r.yaku.map(y => ({ name: y.name, han: y.yakuman ? (y.yakuman > 1 ? 'ダブル役満' : '役満') : `${y.han}翻` }));
        if (r.dora) lines.push({ name: 'ドラ', han: `${r.dora}翻` });
        if (r.aka) lines.push({ name: '赤ドラ', han: `${r.aka}翻` });
        if (r.ura) lines.push({ name: '裏ドラ', han: `${r.ura}翻` });
        const readList = [];
        for (let i = 0; i < lines.length; i++) {
            const li = document.createElement('div');
            li.className = 'yl';
            li.innerHTML = `<span>${esc(lines[i].name)}</span><b>${lines[i].han}</b>`;
            box.appendChild(li);
            if (!this.skip) {
                sfx.yaku(i);
                if (store.settings.yakuVoice) say(YAKU_READING[lines[i].name] || lines[i].name, null, { interrupt: false, rate: 1.25 });
                readList.push(lines[i].name);
                await this.sleep(r.yakuman ? 700 : 480);
            }
        }
        // 合計と 点数の 名まえ
        const tot = m.querySelector('.rs-total');
        const stickBonus = e.wins[0] === w ? (this.snapBefore && this.snapBefore.sticks ? this.snapBefore.sticks * 1000 : 0) : 0;
        const pts = w.delta[w.seat] - stickBonus;
        const fuhan = r.yakuman ? '' : `${r.fu ? r.fu + '符 ' : ''}${r.han}翻`;
        tot.innerHTML = `<div class="rs-fh">${fuhan}</div>${r.name ? `<div class="stamp lv${lv}">${esc(r.name)}</div>` : ''}<div class="rs-pts"><b>0</b>点</div>`;
        sfx.stamp(lv);
        if (r.name) {
            if (store.settings.voice) say(r.name, null, { interrupt: !store.settings.yakuVoice, rate: 0.95, pitch: 0.9 });
            const st = tot.querySelector('.stamp');
            const rect = st.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            if (!this.skip) {
                if (lv >= 1) { this.fx.lightning(Math.min(5, lv), { x: cx, y: cy }); sfx.thunder(lv); }
                if (lv >= 2) this.fx.shake(m, 2 + lv * 2, 300 + lv * 100);
                this.fx.burst(cx, cy, { count: 20 + lv * 14, colors: lv >= 5 ? ['#ff6b6b', '#ffd93d', '#6bff95', '#6bc8ff', '#c86bff'] : ['#fff', '#ffe58a', '#ffc94d'], speed: 4 + lv });
                if (lv >= 4) this.fx.rays(cx, cy, 2200, { rainbow: lv >= 5, alpha: 0.2 });
                if (lv >= 5) this.fx.rain(3500, { rainbow: true });
            }
        }
        // 点数を かぞえあげる
        const b = tot.querySelector('.rs-pts b');
        const steps = this.skip ? 1 : 18;
        for (let i = 1; i <= steps; i++) {
            b.textContent = Math.round(pts * i / steps).toLocaleString();
            if (i % 3 === 0) sfx.coin();
            await this.sleep(28);
        }
        b.textContent = pts.toLocaleString();
        if (stickBonus) tot.insertAdjacentHTML('beforeend', `<div class="rs-stick">＋ 供託 ${stickBonus.toLocaleString()}</div>`);
        if (w.pao !== null && w.pao !== undefined) tot.insertAdjacentHTML('beforeend', `<div class="rs-pao">責任払い：${esc(this.players[w.pao].name)}</div>`);
        this.skip = false;
        this.skippable = false;
        await this.waitTap(m.querySelector('.rs-btns'), 'つぎへ');
    }

    resultTw(n) {
        const W = Math.min(window.innerWidth * 0.96, 560) - 48;
        return Math.max(14, Math.min(34, Math.floor(W / (n + 0.6))));
    }

    async ryuukyokuFx(e) {
        const m = this.$('.g-modal');
        this.revealSeats = new Set(e.tenpai.map((t, i) => (t ? i : -1)).filter(i => i >= 0));
        if (e.reason === 'kyuushu' && e.seat !== null) this.revealSeats.add(e.seat);
        this.renderBacksAll();
        const name = REASON_NAMES[e.reason] || '流局';
        if (!this.fast) {
            this.fx.bigText(name, { style: 'ryuukyoku', dur: 1300 });
            sfx.ryuukyoku();
            say(name, null);
            await this.sleep(1450);
        }
        m.hidden = false;
        const rows = [0, 1, 2, 3].map(p => this.seatAt(p)).map(seat => {
            const pl = this.players[seat];
            const tp = e.tenpai[seat];
            const nag = e.nagashi.includes(seat);
            const hand = (tp || (e.reason === 'kyuushu' && e.seat === seat)) ? sortTiles(e.hands[seat]).map(t => this.tileHTML(t, { cls: 'rt sm' })).join('') : '';
            const exhaust = e.reason === 'exhaust' || e.reason === 'nagashi';
            return `<div class="rk-row"><img src="${pl.avatar}" alt=""><div class="rk-main"><div><b>${esc(pl.name)}</b>${exhaust ? `<span class="tp ${tp ? 'on' : ''}">${nag ? '流し満貫' : tp ? 'テンパイ' : 'ノーテン'}</span>` : ''}</div><div class="rk-hand">${hand}</div></div></div>`;
        }).join('');
        m.innerHTML = `<div class="result draw"><h2>${name}</h2>${rows}<div class="rs-btns"></div></div>`;
        await this.waitTap(m.querySelector('.rs-btns'), 'つぎへ');
        if (e.deltas.some(d => d !== 0)) await this.showScoreChange(e.before, e.deltas, e.scores);
    }

    async showScoreChange(before, deltas, after) {
        const m = this.$('.g-modal');
        m.hidden = false;
        const rows = [0, 1, 2, 3].map(p => this.seatAt(p)).map(seat => {
            const pl = this.players[seat];
            const d = deltas[seat];
            return `<div class="sc-row" data-seat="${seat}"><img src="${pl.avatar}" alt=""><b class="sc-name">${esc(pl.name)}</b><span class="sc-num">${before[seat].toLocaleString()}</span><span class="sc-d ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d > 0 ? '+' : ''}${d ? d.toLocaleString() : ''}</span></div>`;
        }).join('');
        m.innerHTML = `<div class="result scores"><h2>点数</h2>${rows}<div class="rs-btns"></div></div>`;
        await this.sleep(500);
        sfx.coin();
        const steps = this.fast ? 1 : 16;
        for (let i = 1; i <= steps; i++) {
            m.querySelectorAll('.sc-row').forEach(row => {
                const s = Number(row.dataset.seat);
                row.querySelector('.sc-num').textContent = Math.round(before[s] + deltas[s] * i / steps).toLocaleString();
            });
            await this.sleep(35);
        }
        this.renderCenter();
    }

    /** ボタンを 出して おされるのを まつ */
    waitTap(box, label) {
        return new Promise(res => {
            if (this.fast) { res(); return; }
            box.innerHTML = `<button class="btn primary">${label}</button>`;
            box.querySelector('button').addEventListener('click', () => { sfx.button(); box.innerHTML = ''; res(); }, { once: true });
        });
    }

    /** 局の おわり：「つぎの 局へ」ボタン */
    showHandEndButton(over) {
        const m = this.$('.g-modal');
        m.hidden = false;
        let box = m.querySelector('.rs-btns');
        if (!box) {
            m.innerHTML = `<div class="result scores"><h2>点数</h2><div class="rs-btns"></div></div>`;
            box = m.querySelector('.rs-btns');
        }
        if (over) {
            box.innerHTML = `<button class="btn primary">結果を 見る</button>`;
            box.querySelector('button').addEventListener('click', () => { sfx.button(); this.showFinal(); }, { once: true });
            return;
        }
        if (this.cfg.role === 'guest') {
            box.innerHTML = `<button class="btn primary">OK</button>`;
            box.querySelector('button').addEventListener('click', () => {
                sfx.button();
                this.cfg.onReady && this.cfg.onReady(this.g.handNo);
                box.innerHTML = '<p class="wait">ホストが つぎの 局を はじめるのを まっています…</p>';
            }, { once: true });
            return;
        }
        const go = () => { sfx.button(); this.closeModal(); this.submitNext(); };
        if (this.cfg.role === 'host') {
            box.innerHTML = `<button class="btn primary" disabled>つぎの 局へ</button><p class="wait">ともだちを まっています…</p>`;
            const btn = box.querySelector('button');
            const check = () => {
                if (this.disposed || !btn.isConnected) return;
                if (this.cfg.peerReady(this.g.handNo)) { btn.disabled = false; box.querySelector('.wait').remove(); btn.addEventListener('click', go, { once: true }); }
                else this.later(check, 400);
            };
            check();
            return;
        }
        box.innerHTML = `<button class="btn primary">つぎの 局へ</button>`;
        box.querySelector('button').addEventListener('click', go, { once: true });
    }

    closeModal() {
        const m = this.$('.g-modal');
        m.hidden = true;
        m.innerHTML = '';
    }

    /* ── 対局の おわり ── */

    showFinal() {
        const f = this.finalResult || this.g.final;
        if (!f) return;
        const m = this.$('.g-modal');
        m.hidden = false;
        const myRow = f.rows.find(r => r.seat === this.me);
        const rows = f.rows.map(r => {
            const pl = this.players[r.seat];
            return `<div class="fr-row rank${r.rank}${r.seat === this.me ? ' me' : ''}"><span class="fr-rank">${r.rank}<small>位</small></span><img src="${pl.avatar}" alt=""><b>${esc(pl.name)}</b><span class="fr-score">${r.score.toLocaleString()}</span><span class="fr-pt ${r.point >= 0 ? 'plus' : 'minus'}">${r.point >= 0 ? '+' : ''}${r.point.toFixed(1)}</span></div>`;
        }).join('');
        const reason = { tobi: '飛びで 終了', agariyame: 'あがりやめ', end: '' }[f.reason] || '';
        m.innerHTML = `<div class="result final"><h2>${icon('trophy')} 対局 終了</h2>${reason ? `<p class="fr-reason">${reason}</p>` : ''}${rows}<div class="rs-btns"><button class="btn primary" data-fin="again">もう一度</button><button class="btn" data-fin="home">ホームへ</button></div></div>`;
        if (myRow && myRow.rank === 1) {
            sfx.win(); say('トップです！', null);
            this.fx.rain(3500, {});
            this.fx.burst(window.innerWidth / 2, window.innerHeight * 0.35, { count: 60, speed: 6 });
        } else if (myRow) {
            sfx.lose();
        }
        m.querySelector('[data-fin="again"]').addEventListener('click', () => { sfx.button(); this.cfg.onRematch && this.cfg.onRematch(); });
        m.querySelector('[data-fin="home"]').addEventListener('click', () => { sfx.button(); this.cfg.onExit(); });
        if (!this.finishedReported) { this.finishedReported = true; this.cfg.onFinish && this.cfg.onFinish(f); }
        if (this.cfg.role === 'guest') m.querySelector('[data-fin="again"]').remove();
    }

    /* ── メニュー ── */

    showMenu() {
        const m = this.$('.g-modal');
        if (!m.hidden && !this.menuOpen) return;
        this.menuOpen = true;
        m.hidden = false;
        const r = this.g.rules;
        const st = store.settings;
        m.innerHTML = `<div class="result menu">
<h2>メニュー</h2>
<div class="mn-btns">
  <button class="btn" data-mn="close">${icon('play')} つづける</button>
  <button class="btn" data-mn="voice">${st.voice ? 'こえ：あり' : 'こえ：なし'}</button>
  <button class="btn" data-mn="fx">${st.fx === 'full' ? '演出：はでに' : '演出：ひかえめ'}</button>
  <button class="btn" data-mn="waits">${st.showWaits ? '待ちの 表示：あり' : '待ちの 表示：なし'}</button>
  <button class="btn" data-mn="hint">${st.hint ? 'おすすめ牌：あり' : 'おすすめ牌：なし'}</button>
  <button class="btn" data-mn="speed">はやさ：${{ slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい' }[st.speed]}</button>
  <button class="btn danger" data-mn="quit">${icon('sign-out')} 対局を やめる</button>
</div>
<div class="mn-rules">${rulesSummary(r)}</div>
</div>`;
        m.querySelector('.mn-btns').addEventListener('click', e => {
            const b = e.target.closest('[data-mn]');
            if (!b) return;
            sfx.button();
            const k = b.dataset.mn;
            if (k === 'close') { this.menuOpen = false; m.hidden = true; m.innerHTML = ''; return; }
            if (k === 'quit') {
                if (confirm('対局を やめて ホームに もどりますか？')) { this.menuOpen = false; this.cfg.onExit(); }
                return;
            }
            if (k === 'voice') st.voice = !st.voice;
            if (k === 'fx') st.fx = st.fx === 'full' ? 'lite' : 'full';
            if (k === 'waits') st.showWaits = !st.showWaits;
            if (k === 'hint') st.hint = !st.hint;
            if (k === 'speed') st.speed = { slow: 'normal', normal: 'fast', fast: 'slow' }[st.speed];
            save();
            this.menuOpen = false;
            this.showMenu();
        });
    }
}

function uniqueChi(list) {
    const seen = new Map();
    for (const c of list) {
        const key = c.map(kindOf).sort((a, b) => a - b).join(',');
        // 赤を つかう ほうを のこす（打点は かわらない）
        if (!seen.has(key) || c.some(isRedId)) seen.set(key, c);
    }
    return [...seen.values()];
}

export function rulesSummary(r) {
    const yn = v => (v ? 'あり' : 'なし');
    return `<dl>
<dt>対局</dt><dd>${r.length === 'tonpu' ? '東風戦' : '半荘戦'}・持ち点 ${r.startPoints.toLocaleString()}・返し ${r.returnPoints.toLocaleString()}</dd>
<dt>ウマ</dt><dd>${r.uma === 'none' ? 'なし' : r.uma}</dd>
<dt>赤ドラ</dt><dd>${yn(r.aka)}</dd><dt>喰いタン</dt><dd>${yn(r.kuitan)}</dd>
<dt>一発・裏ドラ・カンドラ</dt><dd>${yn(r.ippatsu)}・${yn(r.ura)}・${yn(r.kandora)}</dd>
<dt>飛び</dt><dd>${yn(r.tobi)}</dd><dt>あがりやめ</dt><dd>${yn(r.agariyame)}</dd><dt>延長（西入）</dt><dd>${yn(r.westRound)}</dd>
<dt>ダブロン</dt><dd>${r.doubleRon ? 'あり' : '頭ハネ'}</dd><dt>途中流局</dt><dd>${yn(r.abortive)}</dd>
<dt>流し満貫</dt><dd>${yn(r.nagashi)}</dd><dt>数え役満</dt><dd>${yn(r.kazoe)}</dd><dt>切り上げ満貫</dt><dd>${yn(r.kiriage)}</dd>
<dt>ダブル役満</dt><dd>${yn(r.doubleYakuman)}</dd><dt>責任払い</dt><dd>${yn(r.pao)}</dd>
<dt>持ち時間</dt><dd>${{ none: 'なし', wait: '5秒＋30秒（切れても まつ）', auto: '5秒＋30秒（切れたら ツモ切り）' }[r.timer]}</dd>
</dl>`;
}
