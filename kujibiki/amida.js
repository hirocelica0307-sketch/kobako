/* くじびき ひろば ── ② あみだくじ
   上の 名前を タップすると、その 人の 線を 火（導火線）か 光の 玉が つたって おりていく。
   ゆきさきは KujiLogic.amidaTrace で きまる（よこ線を みれば だれでも たしかめられる ふつうの あみだ）。
   よこ線は 線の あいだを タップして たせる。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc, img } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const PCOL = ['#ff4d6d', '#3a86ff', '#ffd23f', '#2ec4b6', '#ff9f1c', '#b46bff', '#7bd84a', '#ff5dc8', '#00b4d8', '#f72585', '#a3e635', '#ff6b3d'];
    const SPEED = { slow: 0.55, normal: 1, fast: 1.8 };
    const DEF = {
        names: L.numberList(1, 5).map(v => v + 'ばん').join('\n'),
        results: 'あたり\nはずれ\nはずれ\nはずれ\nはずれ',
        fx: 'fuse', speed: 'normal', hideRes: true, hideRungs: false, rungs: null, n: 0,
    };
    const MAXN = 20;

    let sec, cv, cx, wrap, dpr = 1, W = 0, H = 0;
    let st, edTop, edBot;
    let names = [], results = [], n = 0;
    let runs = {};         // start → {end, pts, color, done}
    let active = null;     // いま おりて いる 人
    let queue = [];        // ぜんいん の じゅんばん
    let all = false, boost = 1;
    let raf = 0, lastT = 0, stopSound = null;
    let seen = new Set();  // よこ線を かくす とき：通った よこ線
    const P = new root.KujiParticles();

    function init(el) {
        sec = el;
        st = load('amida', DEF);
        cv = $('.am-cv', sec); cx = cv.getContext('2d');
        wrap = $('.am-mid', sec);
        edTop = root.Kuji.listEditor($('.listed.top', sec), { max: MAXN, unit: '人', suffix: true, onChange: countInfo });
        edBot = root.Kuji.listEditor($('.listed.bot', sec), { max: MAXN, onChange: countInfo });
        $('[data-act="mkAtari"]', sec).addEventListener('click', () => {
            const k = Number($('[name="amAtariN"]', sec).value) || 1;
            const nn = Math.max(2, L.parseList(edTop.get()).length);
            edBot.set(L.amidaAtariList(nn, k, $('[name="amAtariW"]', sec).value || 'あたり', $('[name="amHazW"]', sec).value || 'はずれ').join('\n'));
        });
        $('[data-act="mixBot"]', sec).addEventListener('click', () => edBot.set(L.shuffle(L.parseList(edBot.get())).join('\n')));
        $('[data-act="newRungs"]', sec).addEventListener('click', () => { newLadder(); root.Kuji.closeSheets(); });
        $('[data-act="all"]', sec).addEventListener('click', startAll);
        $('[data-act="again"]', sec).addEventListener('click', async () => {
            if (active) return;
            if (Object.keys(runs).length && !(await root.Kuji.confirm('あたらしい あみだに しますか？（よこ線が かわります）', 'あたらしく する'))) return;
            newLadder();
        });
        $('[data-act="replay"]', sec).addEventListener('click', () => { if (!active) { resetRuns(); } });
        $('.am-top', sec).addEventListener('click', e => {
            const b = e.target.closest('button[data-i]');
            if (b) startOne(Number(b.dataset.i));
        });
        cv.addEventListener('pointerdown', onTap);
        new ResizeObserver(resize).observe(wrap);
    }

    function enter() { apply(); resize(); loop(); }
    function leave() {
        cancelAnimationFrame(raf); raf = 0;
        if (stopSound) { stopSound(); stopSound = null; }
        if (active) { active = null; queue = []; all = false; root.Kuji.setBusy(false); }
        P.list.length = 0;
    }

    /* 中身を よみなおす。人数が かわったら よこ線を つくりなおす */
    function apply() {
        names = L.parseList(st.names).slice(0, MAXN);
        if (names.length < 2) names = names.concat(['1ばん', '2ばん']).slice(0, 2);
        n = names.length;
        results = L.amidaFitResults(L.parseList(st.results), n);
        if (!st.rungs || st.n !== n) { st.rungs = L.amidaMakeRungs(n); st.n = n; persist(); }
        resetRuns();
    }
    function persist() { save('amida', st); }
    function newLadder() {
        st.rungs = L.amidaMakeRungs(n); st.n = n; persist();
        resetRuns();
    }
    function resetRuns() {
        runs = {}; active = null; queue = []; all = false; seen = new Set();
        P.list.length = 0;
        renderLabels();
        draw();
    }

    function countInfo() {
        const a = L.parseList(edTop.get()).length, b = L.parseList(edBot.get()).length;
        const el = $('.am-count', sec);
        let msg = `上 ${a}人 ・ 下 ${b}こ`;
        if (a > MAXN) msg += `（上は ${MAXN}人 まで）`;
        else if (a < 2) msg += '（上は 2人 いじょう）';
        else if (b < a) msg += `（たりない ${a - b}こ は「はずれ」に なります）`;
        else if (b > a) msg += `（下の さいごの ${b - a}こ は つかいません）`;
        el.textContent = msg;
        el.classList.toggle('warn', a !== b || a < 2 || a > MAXN);
    }

    function onSheetOpen() {
        edTop.set(st.names); edBot.set(st.results);
        $$('[name="amFx"]', sec).forEach(r => { r.checked = r.value === st.fx; });
        $$('[name="amSpeed"]', sec).forEach(r => { r.checked = r.value === st.speed; });
        $('[name="amHideRes"]', sec).checked = st.hideRes;
        $('[name="amHideRungs"]', sec).checked = st.hideRungs;
        countInfo();
    }
    function onSheetClose() {
        const nm = edTop.get(), rs = edBot.get();
        const changed = nm !== st.names || rs !== st.results;
        st.names = nm; st.results = rs;
        const f = $('[name="amFx"]:checked', sec); st.fx = f ? f.value : 'fuse';
        const sp = $('[name="amSpeed"]:checked', sec); st.speed = sp ? sp.value : 'normal';
        const hr = $('[name="amHideRes"]', sec).checked, hg = $('[name="amHideRungs"]', sec).checked;
        const visChanged = hr !== st.hideRes || hg !== st.hideRungs;
        st.hideRes = hr; st.hideRungs = hg;
        persist();
        if (changed) apply();
        else if (visChanged) { renderLabels(); draw(); }
        else draw();
        sec.dataset.fx = st.fx;
    }

    /* ---------- 上と 下の ことば ---------- */
    function renderLabels() {
        sec.dataset.fx = st.fx;
        const top = $('.am-top', sec), bot = $('.am-bot', sec);
        sec.style.setProperty('--n', n);
        sec.classList.toggle('vert', n >= 6);
        top.innerHTML = names.map((nm, i) => {
            const r = runs[i];
            return `<button class="am-name${r ? ' used' : ''}" data-i="${i}" style="--c:${PCOL[i % PCOL.length]}"><span>${esc(nm)}</span></button>`;
        }).join('');
        const byEnd = {};
        Object.keys(runs).forEach(k => { if (runs[k].done) byEnd[runs[k].end] = Number(k); });
        bot.innerHTML = results.map((rs, j) => {
            const who = byEnd[j];
            const open = !st.hideRes || who != null;
            const lv = L.levelOfLabel(rs, 'normal');
            return `<div class="am-res lv-${lv}${open ? ' open' : ''}${who != null ? ' got' : ''}" data-j="${j}" ${who != null ? `style="--c:${PCOL[who % PCOL.length]}"` : ''}>
                <div class="flip"><div class="face back"><span>？</span></div><div class="face front"><span>${esc(rs)}</span></div></div>
                ${who != null ? `<div class="who">${esc(names[who])}</div>` : ''}
            </div>`;
        }).join('');
        const left = n - Object.keys(runs).length;
        $('[data-act="all"]', sec).disabled = left <= 0;
        $('[data-act="replay"]', sec).hidden = Object.keys(runs).length === 0;
    }

    /* ---------- 大きさ・ざひょう ---------- */
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        draw();
    }
    const colX = c => (c + 0.5) * W / n;
    const yPx = y => 8 + y * (H - 16);

    function pixPath(pts) {
        const p = pts.map(q => ({ x: colX(q.c), y: yPx(q.y) }));
        const cum = [0];
        for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
        return { p, cum, total: cum[cum.length - 1] };
    }
    /** 道の d0〜d1 の ぶんを path に たす。さいごの 点を かえす */
    function subPath(pp, d0, d1) {
        const { p, cum } = pp;
        let started = false, last = p[0];
        for (let i = 1; i < p.length; i++) {
            const a = cum[i - 1], b = cum[i];
            if (b < d0) continue;
            if (a > d1) break;
            const s = Math.max(0, (d0 - a) / (b - a || 1)), e = Math.min(1, (d1 - a) / (b - a || 1));
            const x0 = p[i - 1].x + (p[i].x - p[i - 1].x) * s, y0 = p[i - 1].y + (p[i].y - p[i - 1].y) * s;
            const x1 = p[i - 1].x + (p[i].x - p[i - 1].x) * e, y1 = p[i - 1].y + (p[i].y - p[i - 1].y) * e;
            if (!started) { cx.moveTo(x0, y0); started = true; }
            cx.lineTo(x1, y1);
            last = { x: x1, y: y1, dx: p[i].x - p[i - 1].x, dy: p[i].y - p[i - 1].y };
        }
        return last;
    }

    /* ---------- タップで よこ線を たす ---------- */
    function onTap(e) {
        if (active) { boost = boost === 1 ? 3 : 1; return; }   // おりて いる ときは はやおくり
        if (Object.keys(runs).length) return;                  // はじまったら かえない
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const g = Math.floor(x / (W / n) - 0.5);
        if (g < 0 || g > n - 2) return;
        const yy = (y - 8) / (H - 16);
        if (yy < 0.03 || yy > 0.97) return;
        const ny = Math.round(yy * 10000) / 10000;
        if (L.amidaConflict(st.rungs, g, ny)) { S.play('kachi'); return; }
        st.rungs.push({ g, y: ny, u: 1 });
        persist();
        S.play('pop', 1.2);
        P.stars(colX(g + 0.5), yPx(ny), 10, 20);
        draw();
    }

    /* ---------- おりる ---------- */
    function startOne(i) {
        if (active || runs[i] || !$('#result').hidden) return;
        S.unlock();
        all = false;
        go(i);
    }
    function startAll() {
        if (active) return;
        S.unlock();
        queue = [];
        for (let i = 0; i < n; i++) if (!runs[i]) queue.push(i);
        if (!queue.length) return;
        all = true;
        go(queue.shift());
    }
    function go(i) {
        const tr = L.amidaTrace(n, st.rungs, i);
        runs[i] = { end: tr.end, pts: tr.points, color: PCOL[i % PCOL.length], done: false, prog: 0 };
        active = i;
        boost = 1;
        root.Kuji.setBusy(true);
        renderLabels();
        const b = $(`.am-name[data-i="${i}"]`, sec);
        if (b) b.classList.add('go');
        S.play(st.fx === 'fuse' ? 'kachi' : 'sparkle');
        if (stopSound) stopSound();
        stopSound = st.fx === 'fuse' ? S.startCrackle() : S.startShimmer();
        const pp = pixPath(runs[i].pts);
        if (st.fx === 'fuse') P.sparks(pp.p[0].x, pp.p[0].y, 40, { max: 300 });
        else P.ring(pp.p[0].x, pp.p[0].y, runs[i].color, 300, 6);
    }

    function arrive(i) {
        const r = runs[i];
        r.done = true;
        active = null;
        if (stopSound) { stopSound(); stopSound = null; }
        const pp = pixPath(r.pts);
        const end = pp.p[pp.p.length - 1];
        const label = results[r.end];
        const lv = L.levelOfLabel(label, 'normal');
        const cr = cv.getBoundingClientRect();
        const gx = cr.left + end.x, gy = cr.top + end.y;
        if (st.fx === 'fuse') {
            S.play('boom');
            FX.flash('#ffb347', 380); FX.shake(12, 500);
            FX.sparks(gx, gy, 120, { max: 700, lifeMax: 0.9 });
            P.smoke(end.x, end.y, 18, 2.2);
            boomAt(r.end);
        } else {
            S.play('reveal');
            FX.ring(gx, gy, r.color, 800, 10);
            FX.stars(gx, gy, 30, 50);
        }
        renderLabels();
        const card = $(`.am-res[data-j="${r.end}"]`, sec);
        if (card && st.hideRes) { card.classList.remove('open'); void card.offsetWidth; card.classList.add('open', 'flipping'); }
        if (lv === 'super' || lv === 'win') {
            const br = card ? card.getBoundingClientRect() : { left: gx, top: gy, width: 0 };
            FX.confettiBurst(br.left + br.width / 2, br.top, lv === 'super' ? 120 : 60, 0.8);
        }
        if (all && queue.length) {
            setTimeout(() => { if (root.Kuji.current() === 'amida' && all) go(queue.shift()); }, 900);
            return;
        }
        root.Kuji.setBusy(false);
        const wasAll = all;
        all = false;
        setTimeout(() => {
            if (root.Kuji.current() !== 'amida') return;
            if (wasAll) {
                const lines = names.map((nm, k) => runs[k] ? `${nm} → ${results[runs[k].end]}` : null).filter(Boolean);
                root.Kuji.showResult({ level: 'win', img: 'party-popper', sub: 'あみだくじ', title: 'ぜんいん ゴール！', note: lines.join('\n'), buttons: [{ label: 'とじる', ic: 'check-circle', primary: true }] });
            } else {
                root.Kuji.showResult({
                    level: lv === 'normal' ? 'win' : lv,
                    img: lv === 'lose' ? 'ghost' : lv === 'super' ? 'trophy' : 'party-popper',
                    sub: names[i] + ' は …', title: label,
                    buttons: [{ label: 'とじる', ic: 'check-circle', primary: true }],
                });
            }
        }, st.fx === 'fuse' ? 900 : 600);
    }
    /* ドカン！の 絵 */
    function boomAt(j) {
        const card = $(`.am-res[data-j="${j}"]`, sec);
        if (!card) return;
        const im = document.createElement('img');
        im.src = root.Kuji.imgSrc('collision');
        im.className = 'am-boom';
        im.alt = '';
        card.appendChild(im);
        setTimeout(() => im.remove(), 1200);
    }

    /* ---------- かく ---------- */
    function draw() {
        if (!W || !n) return;
        const c = cx, fuse = st.fx === 'fuse';
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, W, H);
        const lw = Math.max(3, Math.min(8, W / n * 0.06));
        c.lineCap = 'round'; c.lineJoin = 'round';

        // よこ線を かくす とき、見える よこ線
        const showRung = (r) => !st.hideRungs || r.u || seen.has(r.g + ':' + r.y);

        // 線（導火線 ＝ なわ、光 ＝ くらい ネオン）
        c.beginPath();
        for (let i = 0; i < n; i++) { c.moveTo(colX(i), yPx(0)); c.lineTo(colX(i), yPx(1)); }
        for (const r of st.rungs) if (showRung(r)) { c.moveTo(colX(r.g), yPx(r.y)); c.lineTo(colX(r.g + 1), yPx(r.y)); }
        if (fuse) {
            c.strokeStyle = '#c99a5b'; c.lineWidth = lw; c.stroke();
            c.setLineDash([lw * 0.7, lw * 0.9]); c.strokeStyle = '#8a5f2c'; c.lineWidth = lw * 0.6; c.stroke();
            c.setLineDash([]);
        } else {
            c.strokeStyle = 'rgba(120,140,255,0.35)'; c.lineWidth = lw * 1.8; c.stroke();
            c.strokeStyle = '#4b5bb5'; c.lineWidth = lw * 0.7; c.stroke();
        }
        // よこ線を かくして いる とき：まんなかに うすい まく
        if (st.hideRungs && !Object.keys(runs).length) {
            c.fillStyle = fuse ? 'rgba(60,30,10,0.25)' : 'rgba(20,20,60,0.3)';
            c.fillRect(0, yPx(0.03), W, yPx(0.97) - yPx(0.03));
        }

        // 通った 道
        const t = performance.now();
        Object.keys(runs).forEach(k => {
            const r = runs[k];
            const pp = pixPath(r.pts);
            const d = r.done ? pp.total : r.prog * pp.total;
            if (fuse) {
                c.beginPath(); subPath(pp, 0, d);
                c.strokeStyle = '#2a1a12'; c.lineWidth = lw * 1.25; c.stroke();
                c.strokeStyle = 'rgba(80,60,50,0.9)'; c.lineWidth = lw * 0.5; c.stroke();
                // まだ あつい ところ（火の すぐ うしろ）
                if (!r.done) {
                    const tail = Math.min(d, 140);
                    const steps = 6;
                    for (let s = 0; s < steps; s++) {
                        const a = d - tail * (s + 1) / steps, b = d - tail * s / steps;
                        c.beginPath(); subPath(pp, Math.max(0, a), b);
                        c.strokeStyle = `rgba(255,${120 + s * 15},40,${0.9 - s * 0.14})`;
                        c.lineWidth = lw * (1.1 - s * 0.08);
                        c.stroke();
                    }
                }
            } else {
                c.save();
                c.shadowColor = r.color; c.shadowBlur = 18;
                c.beginPath(); subPath(pp, 0, d);
                c.strokeStyle = r.color; c.lineWidth = lw * 1.6; c.stroke();
                c.restore();
                c.beginPath(); subPath(pp, 0, d);
                c.strokeStyle = 'rgba(255,255,255,' + (r.done ? 0.55 : 0.75 + 0.25 * Math.sin(t / 90)) + ')';
                c.lineWidth = lw * 0.5; c.stroke();
            }
        });

        P.draw(c);

        // 先頭（火 / 光の 玉）
        if (active != null) {
            const r = runs[active];
            const pp = pixPath(r.pts);
            c.beginPath();
            const h = subPath(pp, 0, r.prog * pp.total);
            if (h) {
                if (fuse) {
                    const fi = img('fire');
                    const s = Math.max(30, Math.min(70, W / n * 0.55)) * (0.9 + 0.15 * Math.sin(t / 45) + 0.08 * Math.random());
                    const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, s * 0.9);
                    g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.3, 'rgba(255,150,40,0.5)'); g.addColorStop(1, 'rgba(255,80,0,0)');
                    c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, s * 0.9, 0, Math.PI * 2); c.fill();
                    if (fi.complete && fi.naturalWidth) c.drawImage(fi, h.x - s / 2, h.y - s * 0.85, s, s);
                } else {
                    const s = Math.max(14, Math.min(30, W / n * 0.22));
                    const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, s * 2.2);
                    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#ffffff'); g.addColorStop(0.45, r.color); g.addColorStop(1, 'rgba(0,0,0,0)');
                    c.globalCompositeOperation = 'lighter';
                    c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, s * 2.2, 0, Math.PI * 2); c.fill();
                    c.globalCompositeOperation = 'source-over';
                }
            }
        }
    }

    function loop() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        let lastCorner = -1, smokeT = 0;
        const step = t => {
            const dt = Math.min(0.05, (t - lastT) / 1000);
            lastT = t;
            if (active != null) {
                const r = runs[active];
                const pp = pixPath(r.pts);
                const pxPerSec = Math.max(220, H * 0.6) * (SPEED[st.speed] || 1) * boost * (all ? 1.7 : 1);
                r.prog = Math.min(1, r.prog + pxPerSec * dt / pp.total);
                const d = r.prog * pp.total;
                // どの 角を すぎたか
                let k = 0; while (k < pp.cum.length - 1 && pp.cum[k + 1] <= d) k++;
                // 通った よこ線を 見える ように
                for (let q = 1; q + 1 < r.pts.length; q += 2) {
                    if (pp.cum[q] <= d) {
                        const a = r.pts[q], b = r.pts[q + 1];
                        seen.add(Math.min(a.c, b.c) + ':' + a.y);
                    }
                }
                const pos = (() => { cx.beginPath(); return subPath(pp, 0, d); })();
                if (pos) {
                    if (st.fx === 'fuse') {
                        P.sparks(pos.x, pos.y, 4 + Math.floor(Math.random() * 4), { max: 260, min: 60, lifeMax: 0.45, g: 420 });
                        if (Math.random() < 0.07) P.sparks(pos.x, pos.y, 18, { max: 380, colors: ['#ffffff', '#fff3a0', '#ffd23f'] });
                        smokeT += dt;
                        if (smokeT > 0.07) { smokeT = 0; P.smoke(pos.x, pos.y - 6, 1, 1); }
                    } else {
                        if (Math.random() < 0.6) P.stars(pos.x, pos.y, 1, 6);
                        P.sparks(pos.x, pos.y, 1, { colors: [r.color, '#ffffff'], max: 80, min: 20, g: 0, lifeMax: 0.5 });
                    }
                    if (k !== lastCorner && k > 0) {
                        lastCorner = k;
                        if (st.fx === 'fuse') P.sparks(pos.x, pos.y, 26, { max: 420, colors: ['#ffffff', '#ffe14d', '#ff9a2e'] });
                        else P.ring(pos.x, pos.y, r.color, 260, 4);
                    }
                }
                if (r.prog >= 1) { lastCorner = -1; arrive(active); }
            }
            P.update(dt);
            draw();
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    root.Kuji.register('amida', {
        title: 'あみだくじ', emoji: 'fire',
        init, enter, leave, onSheetOpen, onSheetClose, redraw: draw,
    });
})(window);
