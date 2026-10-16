/* くじびき ひろば ── ① ルーレット
   当たりは さきに KujiLogic.pickIndex で きめ、ばんは そこへ むかって ゆっくり とまる。
   ばん（色・文字）は 回るたびに かかない ように、べつの canvas に 1回 かいて おいて まわす。 */
(function (root) {
    'use strict';
    const { $, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const COLORS = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#7bd84a', '#2ec4b6', '#3a86ff', '#8f5bff', '#ff5dc8', '#ff6b3d', '#00b4d8', '#a3e635', '#f72585'];
    const DUR = { short: 4200, normal: 7000, long: 11000 };
    const DEF = { text: L.numberList(1, 12).join('\n'), dur: 'normal', remove: false, pool: null, history: [] };

    let sec, cv, cx, wrap, cache = null, size = 0, dpr = 1;
    let st, ed;
    let rot = 0, flap = 0, flapV = 0, lastSeg = 0, lastTick = 0;
    let spin = null, win = -1, raf = 0, lastT = 0, t0 = performance.now();

    const pool = () => st.pool || L.parseList(st.text);

    function init(el) {
        sec = el;
        st = load('roulette', DEF);
        cv = $('.rl-cv', sec); cx = cv.getContext('2d');
        wrap = $('.rl-wrap', sec);
        ed = root.Kuji.listEditor($('.listed', sec), { max: 300 });
        $('[data-act="spin"]', sec).addEventListener('click', startSpin);
        $('.rl-hub', sec).addEventListener('click', startSpin);
        $('[data-act="restore"]', sec).addEventListener('click', () => { st.pool = null; win = -1; persist(); rebuild(); });
        $('[data-act="mix"]', sec).addEventListener('click', () => {
            ed.set(L.shuffle(L.parseList(ed.get())).join('\n'));
        });
        $('[data-act="clearHist"]', sec).addEventListener('click', () => { st.history = []; persist(); renderHist(); });
        new ResizeObserver(() => { resize(); }).observe(wrap);
    }
    function enter() {
        win = -1;
        resize(); rebuild(); renderHist();
        document.addEventListener('keydown', onKey);
        loop();
    }
    function leave() {
        document.removeEventListener('keydown', onKey);
        stopSpin(true);
        cancelAnimationFrame(raf); raf = 0;
    }
    function onKey(e) {
        if (e.key === ' ' && !e.repeat && document.activeElement === document.body && $('#result').hidden) { e.preventDefault(); startSpin(); }
    }

    function persist() { save('roulette', st); }

    /* シート */
    function onSheetOpen() {
        ed.set(st.text);
        sec.querySelectorAll('[name="rlDur"]').forEach(r => { r.checked = r.value === st.dur; });
        $('[name="rlRemove"]', sec).checked = !!st.remove;
    }
    function onSheetClose() {
        const text = ed.get();
        if (text !== st.text) { st.text = text; st.pool = null; win = -1; }
        const d = sec.querySelector('[name="rlDur"]:checked');
        st.dur = d ? d.value : 'normal';
        st.remove = $('[name="rlRemove"]', sec).checked;
        if (!st.remove) st.pool = null;
        persist(); rebuild();
    }

    /* ---------- かく ---------- */
    function resize() {
        const r = wrap.getBoundingClientRect();
        const s = Math.floor(Math.min(r.width, r.height));
        if (s < 10) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        size = s;
        wrap.style.setProperty('--s', s + 'px');
        cv.width = cv.height = Math.round(s * dpr);
        cv.style.width = cv.style.height = s + 'px';
        rebuild();
    }

    function colorOf(i, n) {
        let c = i % COLORS.length;
        // さいごと さいしょが おなじ 色に ならない ように
        if (i === n - 1 && n > 1 && c === 0) c = 5;
        return COLORS[c];
    }

    /** ばん（色と 文字）を べつの canvas に かく */
    function rebuild() {
        const items = pool();
        const n = items.length;
        $('.rl-left', sec).hidden = !st.pool;
        $('.rl-left b', sec).textContent = n + ' / ' + L.parseList(st.text).length;
        $('[data-act="spin"]', sec).disabled = n < 1;
        if (!size) return;
        const S2 = Math.round(size * dpr);
        const c = document.createElement('canvas');
        c.width = c.height = S2;
        const g = c.getContext('2d');
        const R = S2 / 2 * 0.86, cxy = S2 / 2;
        g.translate(cxy, cxy);
        if (n === 0) {
            g.fillStyle = '#2a2f55';
            g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
            cache = { c, n, R };
            draw();
            return;
        }
        const s = Math.PI * 2 / n;
        for (let i = 0; i < n; i++) {
            // 12時 から 時計まわり（canvas では −90°から）
            const a0 = -Math.PI / 2 + i * s, a1 = a0 + s;
            const col = colorOf(i, n);
            const grd = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
            grd.addColorStop(0, shade(col, 40));
            grd.addColorStop(0.75, col);
            grd.addColorStop(1, shade(col, -25));
            g.fillStyle = grd;
            g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fill();
            if (n > 1) {
                g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1, R * 0.008);
                g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); g.stroke();
            }
        }
        // 文字
        for (let i = 0; i < n; i++) {
            const mid = -Math.PI / 2 + (i + 0.5) * s;
            const label = items[i];
            const chars = Array.from(label).length;
            const arc = Math.min(Math.PI * 2 / n, Math.PI / 2) * R * 0.62;
            const maxW = R * 0.66;
            let fs = Math.min(R * 0.15, arc * 0.62, maxW / Math.max(1, chars) * 1.05);
            fs = Math.max(fs, Math.min(R * 0.035, 9 * dpr));
            g.save();
            g.rotate(mid);
            g.font = `${Math.round(fs)}px "Mochiy Pop One","M PLUS Rounded 1c",sans-serif`;
            g.textAlign = 'right'; g.textBaseline = 'middle';
            let txt = label;
            if (g.measureText(txt).width > maxW) {
                while (Array.from(txt).length > 1 && g.measureText(txt + '…').width > maxW) txt = Array.from(txt).slice(0, -1).join('');
                txt += '…';
            }
            g.lineJoin = 'round';
            g.lineWidth = Math.max(2, fs * 0.18);
            g.strokeStyle = 'rgba(40,20,60,0.55)';
            g.strokeText(txt, R * 0.9, 0);
            g.fillStyle = '#fff';
            g.fillText(txt, R * 0.9, 0);
            g.restore();
        }
        // まんなかへの かげ
        const sh = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
        sh.addColorStop(0, 'rgba(255,255,255,0.18)');
        sh.addColorStop(0.6, 'rgba(255,255,255,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.22)');
        g.fillStyle = sh;
        g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
        cache = { c, n, R };
        draw();
    }

    function shade(hex, pct) {
        const n = parseInt(hex.slice(1), 16);
        let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
        const f = v => Math.max(0, Math.min(255, Math.round(pct > 0 ? v + (255 - v) * pct / 100 : v * (1 + pct / 100))));
        return `rgb(${f(r)},${f(g)},${f(b)})`;
    }

    function draw() {
        if (!cache || !size) return;
        const W = cv.width, c = cx;
        const now = performance.now();
        const R = cache.R, cxy = W / 2, n = cache.n;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, W, W);
        c.translate(cxy, cxy);

        // そとの わく（金）
        const rimR = R * 1.1;
        const rg = c.createRadialGradient(0, 0, R * 0.98, 0, 0, rimR);
        rg.addColorStop(0, '#7a4a00'); rg.addColorStop(0.35, '#ffe08a'); rg.addColorStop(0.6, '#e2a300'); rg.addColorStop(1, '#6b3d00');
        c.fillStyle = rg;
        c.beginPath(); c.arc(0, 0, rimR, 0, Math.PI * 2); c.fill();

        // ばん
        c.save();
        c.rotate(rot);
        c.drawImage(cache.c, -cxy, -cxy);
        if (win >= 0 && !spin && n > 0) {
            const s = Math.PI * 2 / n, a0 = -Math.PI / 2 + win * s;
            const pulse = 0.25 + 0.2 * Math.sin(now / 160);
            c.fillStyle = 'rgba(0,0,0,0.45)';
            c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0 + s, a0 + Math.PI * 2); c.closePath(); c.fill();
            c.fillStyle = `rgba(255,255,255,${pulse})`;
            c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a0 + s); c.closePath(); c.fill();
            c.strokeStyle = '#fff6a8'; c.lineWidth = R * 0.03; c.shadowColor = '#ffe14d'; c.shadowBlur = R * 0.08;
            c.stroke(); c.shadowBlur = 0;
        }
        // ピン
        if (n > 1 && n <= 120) {
            const s = Math.PI * 2 / n;
            for (let i = 0; i < n; i++) {
                const a = -Math.PI / 2 + i * s;
                c.fillStyle = '#fffbe8';
                c.beginPath(); c.arc(Math.cos(a) * R * 0.965, Math.sin(a) * R * 0.965, Math.max(1.5, R * (n > 40 ? 0.008 : 0.016)), 0, Math.PI * 2); c.fill();
            }
        }
        c.restore();

        // まわりの 電球
        const bulbs = 28;
        const spinning = !!spin;
        for (let i = 0; i < bulbs; i++) {
            const a = (i / bulbs) * Math.PI * 2;
            let lit;
            if (spinning) lit = ((i + Math.floor(now / 50)) % 4) === 0;
            else if (win >= 0) lit = Math.floor(now / 160) % 2 === 0;
            else lit = ((i + Math.floor(now / 500)) % 2) === 0;
            const x = Math.cos(a) * R * 1.05, y = Math.sin(a) * R * 1.05, br = R * 0.026;
            if (lit) {
                c.fillStyle = 'rgba(255,240,150,0.45)';
                c.beginPath(); c.arc(x, y, br * 2.4, 0, Math.PI * 2); c.fill();
            }
            c.fillStyle = lit ? '#fffbe0' : '#a06a10';
            c.beginPath(); c.arc(x, y, br, 0, Math.PI * 2); c.fill();
        }

        // まんなか（ボタンの うしろ）
        const hubR = R * 0.2;
        const hg = c.createRadialGradient(-hubR * 0.3, -hubR * 0.3, hubR * 0.1, 0, 0, hubR);
        hg.addColorStop(0, '#fff6c8'); hg.addColorStop(0.5, '#ffc93c'); hg.addColorStop(1, '#b26a00');
        c.fillStyle = hg;
        c.beginPath(); c.arc(0, 0, hubR, 0, Math.PI * 2); c.fill();

        // はり（12時）
        c.save();
        c.translate(0, -R * 1.02);
        c.rotate(flap);
        const pw = R * 0.09, ph = R * 0.2;
        c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = R * 0.03; c.shadowOffsetY = R * 0.01;
        const pg = c.createLinearGradient(-pw, 0, pw, 0);
        pg.addColorStop(0, '#b0001e'); pg.addColorStop(0.5, '#ff4d6d'); pg.addColorStop(1, '#8a0018');
        c.fillStyle = pg;
        c.beginPath();
        c.moveTo(-pw, -ph * 0.25); c.lineTo(pw, -ph * 0.25); c.lineTo(0, ph * 0.75); c.closePath(); c.fill();
        c.shadowBlur = 0; c.shadowOffsetY = 0;
        c.fillStyle = '#ffe9a8';
        c.beginPath(); c.arc(0, -ph * 0.08, pw * 0.38, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    /* ---------- 回す ---------- */
    function startSpin() {
        if (spin || !$('#result').hidden) return;
        const items = pool();
        if (!items.length) return;
        S.unlock();
        win = -1;
        const idx = L.pickIndex(items.length);
        const dur = DUR[st.dur] || DUR.normal;
        const turns = Math.round(dur / 1000 * 0.9) + 2;
        const target = L.rouletteFinal(rot, items.length, idx, L.rouletteStopFrac(), turns);
        spin = { from: rot, to: target, t0: performance.now(), dur, idx, items, stopDrum: S.startDrumroll(), tense: false };
        lastSeg = Math.floor(rot / (Math.PI * 2 / items.length));
        root.Kuji.setBusy(true);
        sec.classList.add('spinning');
        S.play('whoosh');
        FX.sparks(...hubPoint(), 30, { colors: ['#fff', '#ffe14d'], max: 500, g: 0 });
    }
    function hubPoint() {
        const r = cv.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
    }
    /* さいごに ゆっくり、ゆっくり … */
    function ease(u) { return 1 - Math.pow(1 - u, 4.2); }

    function stopSpin(cancel) {
        if (!spin) return;
        spin.stopDrum();
        spin = null;
        sec.classList.remove('spinning', 'tense');
        root.Kuji.setBusy(false);
        if (cancel) win = -1;
    }

    function finish() {
        const sp = spin;
        rot = sp.to;
        win = sp.idx;
        stopSpin(false);
        const label = sp.items[sp.idx];
        st.history.unshift({ v: label, t: Date.now() });
        st.history = st.history.slice(0, 100);
        const lv = L.levelOfLabel(label, 'win');
        const [hx, hy] = hubPoint();
        FX.ring(hx, hy, '#fff6a8', 900, 12);
        const rest = st.remove ? sp.items.length - 1 : sp.items.length;
        if (st.remove) {
            const p = sp.items.slice(); p.splice(sp.idx, 1);
            st.pool = p;
        }
        persist(); renderHist();
        const btns = [];
        if (rest > 0) btns.push({ label: 'もういちど まわす', ic: 'play', primary: true, act: () => setTimeout(startSpin, 150) });
        btns.push({ label: 'とじる', ic: 'check-circle' });
        root.Kuji.showResult({
            level: lv, img: lv === 'lose' ? 'ghost' : lv === 'super' ? 'trophy' : 'party-popper',
            sub: 'ルーレットの けっか', title: label,
            note: st.remove ? `のこり ${rest}こ` : '',
            buttons: btns,
            onClose: () => { if (st.remove) { win = -1; rebuild(); } },
        });
    }

    function loop() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        const step = t => {
            const dt = Math.min(0.05, (t - lastT) / 1000);
            lastT = t;
            if (spin) {
                const u = Math.min(1, (t - spin.t0) / spin.dur);
                rot = spin.from + (spin.to - spin.from) * ease(u);
                const n = spin.items.length;
                const seg = Math.floor(rot / (Math.PI * 2 / n));
                if (seg !== lastSeg) {
                    lastSeg = seg;
                    flapV -= 14;
                    if (t - lastTick > 28) { S.play('tick', { vol: u > 0.6 ? 1.4 : 0.8 }); lastTick = t; }
                }
                if (!spin.tense && u > 0.7) { spin.tense = true; sec.classList.add('tense'); }
                if (u >= 1) finish();
            }
            // はりの ばね
            flapV += (-flap * 180 - flapV * 14) * dt;
            flap += flapV * dt;
            flap = Math.max(-0.7, Math.min(0.15, flap));
            draw();
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    function renderHist() {
        const ol = $('.history', sec);
        ol.innerHTML = st.history.length
            ? st.history.map((h, i) => `<li><b>${st.history.length - i}</b><span>${esc(h.v)}</span></li>`).join('')
            : '<li class="empty">まだ ありません</li>';
    }

    root.Kuji.register('roulette', {
        title: 'ルーレット', emoji: 'party-popper',
        init, enter, leave, onSheetOpen, onSheetClose, redraw: rebuild,
    });
})(window);
