/* かさ はかせ ── ます・水の 図と、水を そそぐ アニメーション
   1Lます・1dLます・水は 算数の 図 なので SVG で えがく（キャラクターや 物の 絵は assets/emoji の Fluent Emoji だけ）。
   1Lます と 1dLます は、図の 面積が 10：1 に なる 大きさに して あります（見た目でも かさの ちがいが わかる ように）。 */
(function (root) {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    const EMOJI = name => `assets/emoji/${name}.webp`;

    /* ---------- ますの かたち（SVG の 単位） ----------
       内がわ（水が 入る ところ）の 大きさ：1Lます 80×140・1dLます 40×28（＝ 1Lます の 1/10） */
    const SHAPES = {
        L: { w: 100, h: 196, ix: 10, iy: 20, iw: 80, ih: 140, cap: 1000, label: '1L' },
        Lml: { w: 100, h: 196, ix: 10, iy: 20, iw: 80, ih: 140, cap: 1000, label: '1000mL' },
        dL: { w: 56, h: 66, ix: 8, iy: 10, iw: 40, ih: 28, cap: 100, label: '1dL' },
    };

    let uid = 0;
    let speed = 1;                       /* タップで はやおくり */
    let soundHook = null;                /* main.js が 音を つなぐ */

    const sleep = ms => new Promise(r => setTimeout(r, ms / speed));
    const el = (tag, attrs, parent) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    };
    const div = (cls, parent, html) => {
        const e = document.createElement('div');
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        if (parent) parent.appendChild(e);
        return e;
    };

    /* ==================== 1つの ます ==================== */
    function makeMasu(cap, scale) {
        const S = SHAPES[cap];
        const id = 'm' + (++uid);
        const svg = el('svg', { viewBox: `0 0 ${S.w} ${S.h}`, width: S.w * scale, height: S.h * scale, class: 'masu masu-' + cap, role: 'img' });
        const defs = el('defs', {}, svg);
        const g = el('linearGradient', { id: id + 'w', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
        el('stop', { offset: 0, 'stop-color': '#5fb4ff' }, g);
        el('stop', { offset: 0.55, 'stop-color': '#3d93f0' }, g);
        el('stop', { offset: 1, 'stop-color': '#2a74d6' }, g);
        const cp = el('clipPath', { id: id + 'c' }, defs);
        el('rect', { x: S.ix, y: S.iy, width: S.iw, height: S.ih }, cp);

        /* うつわ（すきとおった ガラス） */
        el('rect', { x: S.ix - 4, y: S.iy - 4, width: S.iw + 8, height: S.ih + 8, rx: 4, class: 'glass-back' }, svg);
        el('rect', { x: S.ix, y: S.iy, width: S.iw, height: S.ih, class: 'glass-in' }, svg);
        const water = el('rect', { x: S.ix, y: S.iy + S.ih, width: S.iw, height: 0, fill: `url(#${id}w)`, 'clip-path': `url(#${id}c)` }, svg);
        const surf = el('rect', { x: S.ix, y: S.iy + S.ih, width: S.iw, height: cap === 'dL' ? 2 : 3, class: 'surf', opacity: 0 }, svg);

        /* 目もり（1Lます：1dL ずつ 10こ・まんなかは ながく） */
        if (cap !== 'dL') {
            for (let i = 1; i < 10; i++) {
                const y = S.iy + S.ih - S.ih * i / 10;
                const len = i === 5 ? 30 : 16;
                el('line', { x1: S.ix, y1: y, x2: S.ix + len, y2: y, class: 'tick' + (i === 5 ? ' tick5' : '') }, svg);
            }
        }
        /* ふち と ガラスの ひかり */
        el('rect', { x: S.ix - 4, y: S.iy - 4, width: S.iw + 8, height: S.ih + 8, rx: 4, class: 'glass-edge' }, svg);
        el('rect', { x: S.ix + S.iw - (cap === 'dL' ? 7 : 12), y: S.iy + 4, width: cap === 'dL' ? 3 : 5, height: S.ih - 8, rx: 2, class: 'shine' }, svg);
        /* なふだ */
        const fs = cap === 'dL' ? 13 : cap === 'Lml' ? 19 : 24;
        el('text', { x: S.w / 2, y: S.h - (cap === 'dL' ? 6 : 7), 'text-anchor': 'middle', 'font-size': fs, class: 'mlabel' }, svg).textContent = S.label;

        let level = 0;
        function set(ml) {
            level = Math.max(0, Math.min(S.cap, ml));
            const hh = S.ih * level / S.cap;
            water.setAttribute('y', S.iy + S.ih - hh);
            water.setAttribute('height', hh);
            surf.setAttribute('y', S.iy + S.ih - hh);
            surf.setAttribute('opacity', level > 0 && level < S.cap ? 0.9 : 0);
        }
        /** 水面の 位置（ページ上の px） */
        function surfacePx() {
            const r = svg.getBoundingClientRect();
            const k = r.width / S.w;
            return {
                x: r.left + (S.ix + S.iw / 2) * k,
                top: r.top + (S.iy - 4) * k,
                y: r.top + (S.iy + S.ih - S.ih * level / S.cap) * k,
                k,
            };
        }
        return { svg, cap: S.cap, kind: cap, set, get level() { return level; }, surfacePx };
    }

    /* ==================== そそぐ 人（🫗）と 水の ながれ ==================== */
    function makePourer(stage) {
        const wrap = div('pourer', stage);
        const img = document.createElement('img');
        img.src = EMOJI('pouring-liquid');
        img.alt = '';
        wrap.appendChild(img);
        const stream = div('stream', stage);
        return {
            show(m, sizePx) {
                const base = stage.getBoundingClientRect();
                const p = m.surfacePx();
                const size = sizePx || Math.max(46, Math.min(84, 60 * p.k * 1.4));
                /* 🫗 の 口（左下の あたり）から 水が おちる ように ずらす */
                wrap.style.width = size + 'px';
                wrap.style.height = size * 0.6 + 'px';
                wrap.style.left = (p.x - base.left - size * 0.27) + 'px';
                wrap.style.top = (p.top - base.top - size * 0.6 - 4) + 'px';
                wrap.classList.add('on');
                stream.style.left = (p.x - base.left - 3) + 'px';
                stream.style.width = Math.max(4, Math.min(8, 6 * p.k)) + 'px';
                this.track(m);
                stream.classList.add('on');
            },
            track(m) {
                const base = stage.getBoundingClientRect();
                const p = m.surfacePx();
                const top = parseFloat(wrap.style.top) + parseFloat(wrap.style.height) - 2;
                stream.style.top = top + 'px';
                stream.style.height = Math.max(0, p.y - base.top - top) + 'px';
            },
            hide() { wrap.classList.remove('on'); stream.classList.remove('on'); },
            remove() { wrap.remove(); stream.remove(); },
        };
    }

    /** ます m の 水を from → to に（ふえる ときは そそぐ・へる ときは すっと へる） */
    function animateLevel(m, from, to, ms, pourer) {
        return new Promise(resolve => {
            if (from === to) { m.set(to); resolve(); return; }
            const up = to > from;
            if (up && pourer) { m.set(from); pourer.show(m); }
            if (up && soundHook) soundHook('pour', ms / speed);
            const t0 = performance.now();
            const dur = Math.max(120, ms);
            function step(now) {
                const t = Math.min(1, (now - t0) * speed / dur);
                const e = up ? t : 1 - (1 - t) * (1 - t);
                m.set(from + (to - from) * e);
                if (up && pourer) pourer.track(m);
                if (t < 1) requestAnimationFrame(step);
                else { if (pourer) pourer.hide(); resolve(); }
            }
            requestAnimationFrame(step);
        });
    }
    /** そそぐ 時間（ms）：1L で 900ms くらい */
    const pourMs = ml => Math.max(260, Math.min(900, 260 + ml * 0.64));

    /* ==================== 図の 組み立て ==================== */
    /** ならびの 大きさを ステージに あわせる（px / SVG単位） */
    function fitScale(stage, rows, extraH) {
        const r = stage.getBoundingClientRect();
        const W = Math.max(260, r.width - 40), H = Math.max(200, r.height - (extraH || 90));
        let w = 0, h = 0;
        rows.forEach((row, i) => {
            row.forEach(it => { w += SHAPES[it.cap].w + 8; h = Math.max(h, SHAPES[it.cap].h); });
            if (i) w += 60;
        });
        return Math.max(0.35, Math.min(3, W / Math.max(1, w), H / Math.max(1, h)));
    }

    function clear(stage) {
        stage.innerHTML = '';
        stage.classList.remove('busy');
    }

    /** spec を ステージに えがく → { play(): Promise, ... } */
    function render(stage, spec, opt) {
        opt = opt || {};
        clear(stage);
        if (spec.type === 'masu') return renderMasu(stage, spec, opt);
        if (spec.type === 'compare') return renderCompare(stage, spec, opt);
        if (spec.type === 'thing') return renderThing(stage, spec, opt);
        if (spec.type === 'cupfill') return renderCupfill(stage, spec, opt);
        if (spec.type === 'build') return renderBuild(stage, spec, opt);
        throw new Error('scene ' + spec.type);
    }

    function renderMasu(stage, spec, opt) {
        const box = div('scene', stage);
        if (spec.thing) {
            const t = div('thing-mini', box);
            t.innerHTML = `<img src="${EMOJI(spec.thing)}" alt="">`;
        }
        const groups = div('groups', box);
        const extraH = (spec.caption ? 70 : 20) + (spec.labels ? 60 : 0) + (spec.thing ? 70 : 0);
        const scale = fitScale(stage, spec.rows, extraH + 60);
        const masus = [];
        spec.rows.forEach((row, ri) => {
            if (ri && spec.op) div('op', groups, spec.op);
            const g = div('group', groups);
            const line = div('row', g);
            row.forEach(it => {
                const m = makeMasu(it.cap, scale);
                line.appendChild(m.svg);
                m.set(opt.instant ? it.ml : (it.from !== undefined ? it.from : 0));
                masus.push({ m, it });
            });
            if (spec.labels) div('glabel', g).textContent = spec.labels[ri];
        });
        const cap = spec.caption ? div('caption', box) : null;
        if (cap) { cap.textContent = spec.caption; if (!opt.instant) cap.classList.add('wait'); }
        const pourer = makePourer(stage);
        return {
            async play() {
                if (opt.instant) return;
                stage.classList.add('busy');
                await sleep(250);
                const moves = masus.filter(x => (x.it.from !== undefined ? x.it.from : 0) !== x.it.ml);
                const total = moves.reduce((s, x) => s + pourMs(Math.abs(x.it.ml - (x.it.from || 0))), 0);
                const k = total > 5200 ? 5200 / total : 1;          /* ながく なりすぎない ように */
                for (const x of moves) {
                    const from = x.it.from !== undefined ? x.it.from : 0;
                    await animateLevel(x.m, from, x.it.ml, pourMs(Math.abs(x.it.ml - from)) * k, pourer);
                    await sleep(70 * k);
                }
                if (cap) cap.classList.remove('wait');
                stage.classList.remove('busy');
            },
        };
    }

    function renderThing(stage, spec) {
        const box = div('scene thing', stage);
        if (spec.emoji === 'masu-dl') {
            const m = makeMasu('dL', 3);
            m.set(100);
            div('thing-img', box).appendChild(m.svg);
        } else {
            div('thing-img', box, `<img src="${EMOJI(spec.emoji)}" alt="">`);
        }
        div('thing-name', box).textContent = spec.name;
        return { async play() {} };
    }

    function renderCompare(stage, spec, opt) {
        const box = div('scene', stage);
        const groups = div('groups compare', box);
        const rows = [[], []];
        for (let i = 0; i < spec.capL; i++) { rows[0].push({ cap: 'L' }); rows[1].push({ cap: 'L' }); }
        const scale = fitScale(stage, rows, 150);
        const sides = [['left', spec.left, spec.leftLabel], ['right', spec.right, spec.rightLabel]].map(([side, ml, label], i) => {
            if (i) div('op vs', groups, '');
            const g = div('group side-' + side, groups);
            const line = div('row', g);
            const ms = rows[i].map(() => { const m = makeMasu('L', scale); line.appendChild(m.svg); return m; });
            div('glabel big', g).textContent = label;
            const badge = div('badge', g);
            return { side, ml, ms, g, badge };
        });
        const fill = (s, inst) => s.ms.map((m, j) => {
            const to = Math.max(0, Math.min(1000, s.ml - j * 1000));
            if (inst) { m.set(to); return Promise.resolve(); }
            return to;
        });
        if (opt.instant && spec.pour) sides.forEach(s => fill(s, true));
        const pourers = [makePourer(stage), makePourer(stage)];
        return {
            async play() {
                if (!spec.pour || opt.instant) return;
                stage.classList.add('busy');
                await sleep(200);
                await Promise.all(sides.map(async (s, i) => {
                    for (let j = 0; j < s.ms.length; j++) {
                        const to = Math.max(0, Math.min(1000, s.ml - j * 1000));
                        if (to > 0) await animateLevel(s.ms[j], 0, to, pourMs(to) * 1.2, pourers[i]);
                    }
                }));
                await sleep(200);
                const [a, b] = sides;
                if (a.ml === b.ml) { a.badge.textContent = 'おなじ'; b.badge.textContent = 'おなじ'; a.g.classList.add('win'); b.g.classList.add('win'); }
                else { const w = a.ml > b.ml ? a : b; w.badge.textContent = '多い！'; w.g.classList.add('win'); }
                stage.classList.remove('busy');
            },
        };
    }

    /** コップで なんばいも そそぐ（1Lます が いっぱいに なるまで） */
    function renderCupfill(stage, spec) {
        const box = div('scene', stage);
        const n = Math.max(1, Math.ceil(spec.target / 1000));
        const rows = [Array.from({ length: n }, () => ({ cap: 'L' }))];
        const scale = fitScale(stage, rows, 160);
        const top = div('cupfill-top', box);
        const cupIcon = div('cup-icon', top);
        if (spec.emoji === 'masu-dl') { const m = makeMasu('dL', 1.1); m.set(100); cupIcon.appendChild(m.svg); }
        else cupIcon.innerHTML = `<img src="${EMOJI(spec.emoji)}" alt="">`;
        const counter = div('counter', top, '× <b>0</b>');
        const groups = div('groups', box);
        const line = div('row', div('group', groups));
        const ms = rows[0].map(() => { const m = makeMasu(spec.target < 1000 ? 'L' : 'L', scale); line.appendChild(m.svg); return m; });
        const cap = div('caption wait', box);
        cap.textContent = `${spec.n}はい分で いっぱい！`;
        if (spec.target < 1000) cap.textContent = `${spec.n}はい分で ${KasaLogicLdl(spec.target)}`;
        const pourer = makePourer(stage);
        return {
            async play() {
                stage.classList.add('busy');
                let total = 0;
                const step = Math.max(140, Math.min(520, 3600 / spec.n));
                for (let i = 1; i <= spec.n; i++) {
                    const to = total + spec.cup;
                    for (let j = 0; j < ms.length; j++) {
                        const a = Math.max(0, Math.min(1000, total - j * 1000));
                        const b = Math.max(0, Math.min(1000, to - j * 1000));
                        if (b > a) await animateLevel(ms[j], a, b, step * (b - a) / spec.cup, pourer);
                    }
                    total = to;
                    counter.innerHTML = `× <b>${i}</b>`;
                    counter.classList.remove('pop'); void counter.offsetWidth; counter.classList.add('pop');
                    await sleep(90);
                }
                cap.classList.remove('wait');
                stage.classList.remove('busy');
            },
        };
    }
    const KasaLogicLdl = ml => (root.KasaLogic ? root.KasaLogic.ldl(ml) : ml + 'mL');

    /** ぴったり つくろう：1Lます・1dLます で 水そう（1Lます の ならび）に 入れる */
    function renderBuild(stage, spec) {
        const box = div('scene', stage);
        const rows = [Array.from({ length: spec.capL }, () => ({ cap: 'L' }))];
        const scale = fitScale(stage, rows, 140);
        const groups = div('groups', box);
        const line = div('row', div('group', groups));
        const ms = rows[0].map(() => { const m = makeMasu('L', scale); line.appendChild(m.svg); return m; });
        const log = div('buildlog', box);
        const pourer = makePourer(stage);
        let total = 0, busy = false;
        const counts = { L: 0, dL: 0 };
        const capMl = spec.capL * 1000;
        function drawLog() {
            const parts = [];
            if (counts.L) parts.push(`1Lます × ${counts.L}`);
            if (counts.dL) parts.push(`1dLます × ${counts.dL}`);
            log.textContent = parts.length ? parts.join('　') : 'まだ 入れて いないよ';
        }
        drawLog();
        return {
            async play() {},
            get total() { return total; },
            get busy() { return busy; },
            canAdd: ml => total + ml <= capMl,
            async add(ml) {
                if (busy || total + ml > capMl) return false;
                busy = true;
                stage.classList.add('busy');
                const to = total + ml;
                counts[ml >= 1000 ? 'L' : 'dL']++;
                drawLog();
                for (let j = 0; j < ms.length; j++) {
                    const a = Math.max(0, Math.min(1000, total - j * 1000));
                    const b = Math.max(0, Math.min(1000, to - j * 1000));
                    if (b > a) await animateLevel(ms[j], a, b, pourMs(b - a), pourer);
                }
                total = to;
                busy = false;
                stage.classList.remove('busy');
                return true;
            },
            async reset() {
                if (busy) return;
                busy = true;
                await Promise.all(ms.map(m => animateLevel(m, m.level, 0, 380)));
                total = 0; counts.L = 0; counts.dL = 0;
                drawLog();
                busy = false;
            },
            /** こたえを 見せる：いったん からに して ただしい かさを 入れる */
            async show(target) {
                await this.reset();
                const a = Math.floor(target / 1000), b = Math.round((target % 1000) / 100);
                for (let i = 0; i < a; i++) await this.add(1000);
                for (let i = 0; i < b; i++) await this.add(100);
            },
        };
    }

    root.KasaScene = {
        SHAPES, render, clear, makeMasu,
        setSpeed(s) { speed = s; },
        getSpeed: () => speed,
        onSound(fn) { soundHook = fn; },
        EMOJI,
    };
})(typeof window !== 'undefined' ? window : globalThis);
