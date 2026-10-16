/* くじびき ひろば ── ⑤ ガチャガチャ
   ハンドルを まわすと カプセルが ころがり出て、タップすると パカッと ひらく。
   中身は おみくじと おなじ「しゅるいと 本数の 表」（本数を きめる ／ かぎりなし）。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const CAPS = ['#ff4d6d', '#3a86ff', '#ffd23f', '#2ec4b6', '#b46bff', '#ff9f1c', '#7bd84a', '#ff5dc8'];
    const DEF = {
        items: [{ label: '大あたり', n: 1, lv: 'super' }, { label: 'あたり', n: 5, lv: 'win' }, { label: 'はずれ', n: 14, lv: 'lose' }],
        limit: 'inf', stock: null,
    };

    let sec, cv, cx, wrap, dpr = 1, W = 0, H = 0, M = null;
    let st, tbl, caps = [];
    let phase = 'idle', t = 0, handle = 0, cap = null, raf = 0, lastT = 0, stopRattle = null;

    function init(el) {
        sec = el;
        st = load('gacha', DEF);
        cv = $('.gc-cv', sec); cx = cv.getContext('2d');
        wrap = $('.gc-wrap', sec);
        tbl = root.KujiPrizes.table($('.pz', sec), { unit: 'こ', mode: () => (($('[name="gcLimit"]:checked', sec) || {}).value || 'inf') });
        $$('[name="gcLimit"]', sec).forEach(r => r.addEventListener('change', () => tbl.refresh()));
        $('[data-act="turn"]', sec).addEventListener('click', onAct);
        $('[data-act="refill"]', sec).addEventListener('click', () => { st.stock = null; persist(); root.Kuji.closeSheets(); renderLeft(); });
        $('[data-act="refillStage"]', sec).addEventListener('click', () => { if (phase === 'idle') { st.stock = null; persist(); renderLeft(); } });
        cv.addEventListener('click', onAct);
        new ResizeObserver(resize).observe(wrap);
    }
    function enter() { renderLeft(); resize(); loop(); }
    function leave() {
        cancelAnimationFrame(raf); raf = 0;
        if (stopRattle) { stopRattle(); stopRattle = null; }
        phase = 'idle'; cap = null; root.Kuji.setBusy(false);
    }
    function persist() { save('gacha', st); }
    const stock = () => st.stock || st.items.map(x => Object.assign({}, x));

    function onSheetOpen() {
        tbl.set(st.items);
        $$('[name="gcLimit"]', sec).forEach(r => { r.checked = r.value === st.limit; });
        tbl.refresh();
    }
    function onSheetClose() {
        const items = tbl.get();
        const limit = ($('[name="gcLimit"]:checked', sec) || {}).value || 'inf';
        if (JSON.stringify(items) !== JSON.stringify(st.items) || limit !== st.limit) st.stock = null;
        st.items = items; st.limit = limit;
        persist(); renderLeft();
    }
    function renderLeft() {
        const el = $('.gc-left', sec);
        const rb = $('[data-act="refillStage"]', sec);
        if (st.limit === 'inf') { el.innerHTML = '<b>かぎりなし</b>'; rb.hidden = true; setBtn(); return; }
        const tot = L.stockTotal(stock());
        rb.hidden = !st.stock || tot === L.stockTotal(st.items);
        el.innerHTML = `のこり <b>${tot}</b> こ`;
        setBtn();
    }
    function setBtn() {
        const b = $('[data-act="turn"] .lbl', sec);
        b.textContent = phase === 'ready' ? 'カプセルを あける！' : 'ハンドルを まわす';
        $('[data-act="turn"]', sec).classList.toggle('open-mode', phase === 'ready');
    }

    /* ---------- 大きさ ---------- */
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        const s = Math.min(W * 0.5, H * 0.56);
        M = { s, x: W / 2, domeY: H * 0.06 + s * 0.48, domeR: s * 0.46, bodyY: H * 0.06 + s * 0.86, bodyH: s * 0.62, bodyW: s * 0.9 };
        M.handle = { x: M.x, y: M.bodyY + M.bodyH * 0.52, r: s * 0.1 };
        M.out = { x: M.x, y: M.bodyY + M.bodyH * 0.84 };
        M.front = { x: Math.min(W - s * 0.25, M.x + M.bodyW * 0.95), y: M.bodyY + M.bodyH * 0.72 };
        // 中の カプセル
        const cr = M.domeR * 0.2;
        caps = [];
        let tries = 0;
        while (caps.length < 22 && tries++ < 3000) {
            const a = Math.random() * Math.PI * 2, d = Math.random() * (M.domeR - cr * 1.1);
            const x = Math.cos(a) * d, y = Math.abs(Math.sin(a)) * d * 0.9 + M.domeR * 0.05;
            if (caps.some(c => Math.hypot(c.x - x, c.y - y) < cr * 1.7)) continue;
            caps.push({ x, y, r: cr, col: CAPS[caps.length % CAPS.length], rot: Math.random() * 6.3 });
        }
    }

    /* ---------- うごき ---------- */
    function onAct() {
        if (!$('#result').hidden) return;
        if (phase === 'idle') turn();
        else if (phase === 'ready') open();
    }
    function turn() {
        if (st.limit === 'stock' && L.stockTotal(stock()) <= 0) {
            root.Kuji.showResult({ level: 'normal', img: 'confetti-ball', sub: 'ガチャガチャ', title: 'からっぽ です', note: '「中身・せってい」の「ぜんぶ もどす」で もどせます', quiet: true });
            return;
        }
        S.unlock();
        // ひいた だけでは へらさない（へらすのは「のぞいて もういちど」を えらんだ とき）
        const idx = L.weightedPick(st.limit === 'stock' ? stock() : st.items);
        const it = st.items[idx] || { label: '？', lv: 'normal' };
        cap = { idx, label: it.label, lv: it.lv || 'normal', col: it.lv === 'super' ? 'gold' : CAPS[Math.floor(Math.random() * CAPS.length)], x: 0, y: 0, rot: 0, open: 0, wob: 0 };
        phase = 'crank'; t = 0;
        root.Kuji.setBusy(true);
        stopRattle = S.startRattle(() => 0.6);
        renderLeft();
    }
    /** 出た カプセルを のぞく（こ数を きめる とき） */
    function takeOut(i) {
        const s = stock();
        if (s[i] && s[i].n > 0) { s[i] = Object.assign({}, s[i], { n: s[i].n - 1 }); st.stock = s; persist(); renderLeft(); }
    }
    function open() {
        phase = 'opening'; t = 0;
        S.play('kachi');
    }

    function update(dt) {
        t += dt;
        if (phase === 'crank') {
            // 1/3 まわす ごとに カチッ（3回で 1しゅう）
            const steps = 3, per = 0.42;
            const k = Math.floor(t / per);
            if (k !== cap.click && k < steps) { cap.click = k; S.play('kachi'); }
            handle = Math.min(1, t / (steps * per)) * Math.PI * 2;
            if (t > steps * per + 0.1) {
                if (stopRattle) { stopRattle(); stopRattle = null; }
                handle = 0;
                phase = 'drop'; t = 0;
                S.play('pop', 0.7);
            }
        } else if (phase === 'drop') {
            const T = 1.0;
            const u = Math.min(1, t / T);
            // 出口 → 前へ ころがり、すこし はねる
            const e = 1 - Math.pow(1 - u, 3);
            cap.x = M.out.x + (M.front.x - M.out.x) * e;
            const bounce = Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * M.s * 0.12;
            cap.y = M.out.y + (M.front.y - M.out.y) * e - bounce;
            cap.rot += dt * 9 * (1 - u);
            cap.scale = 0.6 + 0.6 * e;
            if (u >= 1) {
                phase = 'ready'; t = 0; setBtn();
                root.Kuji.setBusy(false);
                S.play('pop', 1.3);
                if (cap.lv === 'super') { S.play('sparkle'); const r = cv.getBoundingClientRect(); FX.stars(r.left + cap.x, r.top + cap.y, 30, M.s * 0.2); }
            }
        } else if (phase === 'ready') {
            cap.wob = Math.sin(t * 6) * 0.12;
        } else if (phase === 'opening') {
            cap.wob = Math.sin(t * 40) * 0.2 * Math.min(1, t * 3);
            if (t > 0.55 && !cap.popped) {
                cap.popped = true;
                S.play('pop', 1.6);
                const r = cv.getBoundingClientRect();
                const x = r.left + cap.x, y = r.top + cap.y;
                FX.ring(x, y, cap.lv === 'super' ? '#ffe14d' : '#ffffff', 900, 14);
                FX.sparks(x, y, 80, { colors: ['#ffffff', '#ffe14d', '#9ef3ff'], max: 600, g: 100 });
            }
            if (cap.popped) cap.open = Math.min(1, cap.open + dt * 3);
            if (t > 1.05) {
                phase = 'shown'; setBtn();
                const c = cap;
                root.Kuji.showResult({
                    level: c.lv, img: c.lv === 'lose' ? 'ghost' : c.lv === 'super' ? 'trophy' : 'confetti-ball',
                    sub: 'カプセルの 中は …', title: c.label,
                    note: st.limit === 'stock' ? `のこり ${L.stockTotal(stock())}こ` : '',
                    buttons: (st.limit === 'stock' && L.stockTotal(stock()) > 1
                        ? [{ label: `「${root.Kuji.short(c.label, 8)}」を のぞいて もういちど`, ic: 'skip-forward', primary: true, act: () => { takeOut(c.idx); setTimeout(turn, 120); } }]
                        : []).concat([
                        { label: st.limit === 'stock' ? 'もどして もういちど' : 'もういちど', ic: 'play', primary: true, cls: 'alt', act: () => setTimeout(turn, 120) },
                        { label: 'とじる', ic: 'check-circle' },
                    ]),
                    onClose: () => { cap = null; phase = 'idle'; setBtn(); renderLeft(); },
                });
            }
        }
    }

    /* ---------- かく ---------- */
    function draw() {
        if (!M) return;
        const c = cx;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, W, H);
        const { x, domeY, domeR, bodyY, bodyH, bodyW, s } = M;
        const shake = phase === 'crank' ? (Math.random() - 0.5) * 3 : 0;

        // あし
        c.fillStyle = '#8a1022';
        rr(c, x - bodyW * 0.45, bodyY + bodyH - 4, bodyW * 0.9, s * 0.06, 8); c.fill();
        // からだ
        const bg = c.createLinearGradient(x - bodyW / 2, 0, x + bodyW / 2, 0);
        bg.addColorStop(0, '#b0001e'); bg.addColorStop(0.3, '#ff4d6d'); bg.addColorStop(0.7, '#e8203f'); bg.addColorStop(1, '#8a0018');
        c.fillStyle = bg;
        rr(c, x - bodyW / 2, bodyY, bodyW, bodyH, s * 0.06); c.fill();
        // 名前の 板
        c.fillStyle = '#fff3c4';
        rr(c, x - bodyW * 0.36, bodyY + bodyH * 0.1, bodyW * 0.72, bodyH * 0.16, 8); c.fill();
        c.fillStyle = '#b0001e';
        c.font = `${Math.round(bodyH * 0.11)}px "Mochiy Pop One","M PLUS Rounded 1c",sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ガチャガチャ', x, bodyY + bodyH * 0.185);
        // 出口
        c.fillStyle = '#2a0a12';
        rr(c, x - s * 0.15, M.out.y - s * 0.07, s * 0.3, s * 0.15, s * 0.05); c.fill();
        c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.stroke();

        // ドーム
        c.save();
        c.translate(shake, 0);
        c.save();
        c.beginPath(); c.arc(x, domeY, domeR, 0, Math.PI * 2); c.clip();
        c.fillStyle = 'rgba(180,220,255,0.16)'; c.fillRect(x - domeR, domeY - domeR, domeR * 2, domeR * 2);
        for (const k of caps) {
            const jx = phase === 'crank' ? (Math.random() - 0.5) * k.r * 0.4 : 0;
            const jy = phase === 'crank' ? (Math.random() - 0.5) * k.r * 0.4 : 0;
            capsule(c, x + k.x + jx, domeY + k.y + jy, k.r, k.col, k.rot + (phase === 'crank' ? t * 3 : 0), 0);
        }
        c.restore();
        c.strokeStyle = 'rgba(230,240,255,0.9)'; c.lineWidth = Math.max(4, s * 0.02);
        c.beginPath(); c.arc(x, domeY, domeR, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = domeR * 0.07; c.lineCap = 'round';
        c.beginPath(); c.arc(x, domeY, domeR * 0.8, Math.PI * 1.15, Math.PI * 1.4); c.stroke();
        c.restore();
        // ドームの 下の わ
        c.fillStyle = '#d8203f';
        rr(c, x - domeR * 0.75, bodyY - s * 0.05, domeR * 1.5, s * 0.07, 6); c.fill();

        // ハンドル
        const h = M.handle;
        const hg = c.createRadialGradient(h.x - h.r * 0.3, h.y - h.r * 0.3, 2, h.x, h.y, h.r);
        hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#c9ccd8');
        c.fillStyle = hg;
        c.beginPath(); c.arc(h.x, h.y, h.r, 0, Math.PI * 2); c.fill();
        c.save();
        c.translate(h.x, h.y); c.rotate(handle);
        c.fillStyle = '#7a7f95';
        rr(c, -h.r * 0.95, -h.r * 0.2, h.r * 1.9, h.r * 0.4, h.r * 0.2); c.fill();
        c.restore();
        if (phase === 'idle') {
            // まわしてね の やじるし
            const a0 = performance.now() / 400;
            c.strokeStyle = 'rgba(255,240,150,0.85)'; c.lineWidth = 4; c.lineCap = 'round';
            c.beginPath(); c.arc(h.x, h.y, h.r * 1.35, a0, a0 + 1.4); c.stroke();
        }

        // ころがり出た カプセル
        if (cap && phase !== 'crank') {
            const sc = (cap.scale || 1.2) * (phase === 'ready' ? 1 + 0.04 * Math.sin(t * 5) : 1);
            const r = s * 0.13 * sc;
            if (cap.lv === 'super' && phase !== 'drop') {
                const g = c.createRadialGradient(cap.x, cap.y, r * 0.5, cap.x, cap.y, r * 2.6);
                const hue = (performance.now() / 8) % 360;
                g.addColorStop(0, `hsla(${hue},100%,70%,0.85)`); g.addColorStop(1, 'rgba(255,255,255,0)');
                c.fillStyle = g; c.beginPath(); c.arc(cap.x, cap.y, r * 2.6, 0, Math.PI * 2); c.fill();
            }
            if (cap.open > 0) {
                const g = c.createRadialGradient(cap.x, cap.y, 0, cap.x, cap.y, r * 3 * cap.open);
                g.addColorStop(0, 'rgba(255,255,230,0.95)'); g.addColorStop(1, 'rgba(255,255,230,0)');
                c.fillStyle = g; c.beginPath(); c.arc(cap.x, cap.y, r * 3 * cap.open, 0, Math.PI * 2); c.fill();
            }
            capsule(c, cap.x, cap.y, r, cap.col, cap.rot + cap.wob, cap.open);
        }
    }

    /** カプセル（上は 色、下は 白）。open で 上下に わかれる */
    function capsule(c, x, y, r, col, rot, open) {
        c.save();
        c.translate(x, y); c.rotate(rot);
        const gap = (open || 0) * r * 1.6;
        // 下（白）
        c.save();
        c.translate(0, gap * 0.6); c.rotate((open || 0) * 0.5);
        const wg = c.createLinearGradient(-r, 0, r, 0);
        wg.addColorStop(0, '#d8dbe6'); wg.addColorStop(0.4, '#ffffff'); wg.addColorStop(1, '#b9bdcc');
        c.fillStyle = wg;
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.closePath(); c.fill();
        c.restore();
        // 上（色）
        c.save();
        c.translate(0, -gap); c.rotate(-(open || 0) * 0.7);
        let fill;
        if (col === 'gold') {
            fill = c.createLinearGradient(-r, -r, r, r);
            fill.addColorStop(0, '#fff3a0'); fill.addColorStop(0.5, '#ffbf1f'); fill.addColorStop(1, '#b07800');
        } else {
            fill = c.createLinearGradient(-r, 0, r, 0);
            fill.addColorStop(0, col); fill.addColorStop(0.4, lighten(col)); fill.addColorStop(1, col);
        }
        c.fillStyle = fill;
        c.globalAlpha = 0.93;
        c.beginPath(); c.arc(0, 0, r, Math.PI, Math.PI * 2); c.closePath(); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.ellipse(-r * 0.35, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); c.fill();
        c.restore();
        // つなぎめ
        if (!open) {
            c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = Math.max(1, r * 0.08);
            c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();
        }
        c.restore();
    }
    function lighten(hex) {
        const n = parseInt(hex.slice(1), 16);
        const f = v => Math.round(v + (255 - v) * 0.45);
        return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }
    function rr(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    }

    function loop() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        const step = tt => {
            const dt = Math.min(0.05, (tt - lastT) / 1000);
            lastT = tt;
            update(dt);
            draw();
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    root.Kuji.register('gacha', {
        title: 'ガチャガチャ', emoji: 'confetti-ball',
        init, enter, leave, onSheetOpen, onSheetClose, redraw: draw,
    });
})(window);
