/* くじびき ひろば ── ⑧ ばくだん リレー
   まわして あそぶ：端末（や ボール）を となりへ わたしていき、ばくはつした ときに もっていた 人の まけ。
   画面で まわす：名前の まるの 上を ばくだんが ぴょんぴょん うつり、ばくはつ した ところの 人に きまる。
   ばくはつ までの 時間は 見えない（KujiLogic.randomBetween で min〜max びょう）。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const DEF = { mode: 'pass', min: 10, max: 30, names: L.numberList(1, 8).map(v => v + 'ばん').join('\n') };

    let sec, st, ed, cv, cx, wrap, dpr = 1, W = 0, H = 0;
    let run = null, raf = 0, lastT = 0, holder = 0, exploded = null, stopFuse = null;
    const P = new root.KujiParticles();

    function init(el) {
        sec = el;
        st = load('bomb', DEF);
        ed = root.Kuji.listEditor($('.listed', sec), { max: 30, unit: '人', suffix: true });
        cv = $('.bm-cv', sec); cx = cv.getContext('2d');
        wrap = $('.bm-wrap', sec);
        $('[data-act="start"]', sec).addEventListener('click', toggle);
        cv.addEventListener('click', () => { if (!run && !exploded) toggle(); });
        $$('[name="bmMode"]', sec).forEach(r => r.addEventListener('change', modeUi));
        new ResizeObserver(resize).observe(wrap);
    }
    function enter() { exploded = null; holder = 0; resize(); setBtn(); loop(); }
    function leave() { stopRun(); cancelAnimationFrame(raf); raf = 0; P.list.length = 0; }
    function persist() { save('bomb', st); }
    const names = () => L.parseList(st.names).slice(0, 30);

    function modeUi() {
        const m = ($('[name="bmMode"]:checked', sec) || {}).value || 'pass';
        $('.bm-names', sec).hidden = m !== 'circle';
    }
    function onSheetOpen() {
        $$('[name="bmMode"]', sec).forEach(r => { r.checked = r.value === st.mode; });
        $('[name="bmMin"]', sec).value = st.min;
        $('[name="bmMax"]', sec).value = st.max;
        ed.set(st.names);
        modeUi();
    }
    function onSheetClose() {
        st.mode = ($('[name="bmMode"]:checked', sec) || {}).value || 'pass';
        st.min = L.clamp(Math.round($('[name="bmMin"]', sec).value), 3, 300);
        st.max = L.clamp(Math.round($('[name="bmMax"]', sec).value), 3, 300);
        if (st.max < st.min) { const t = st.min; st.min = st.max; st.max = t; }
        st.names = ed.get();
        persist(); exploded = null; holder = 0; setBtn();
    }
    function setBtn() {
        const b = $('[data-act="start"]', sec);
        $('.lbl', b).textContent = run ? (st.mode === 'pass' ? 'とめる' : 'とめる') : exploded ? 'もういちど' : 'スタート！';
        b.classList.toggle('stop', !!run);
        $('.bm-hint', sec).textContent = st.mode === 'pass'
            ? (run ? 'はやく となりへ わたして！' : `${st.min}〜${st.max}びょう の どこかで ばくはつ！ 端末を となりへ わたそう`)
            : (run ? 'ばくだんが まわって いるよ …' : `${names().length}人 の 中で ばくだんが まわるよ`);
    }

    /* ---------- 大きさ ---------- */
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }

    /* ---------- スタート・ばくはつ ---------- */
    function toggle() {
        if (run) { stopRun(); exploded = null; setBtn(); return; }
        if (!$('#result').hidden) return;
        if (st.mode === 'circle' && names().length < 2) return;
        S.unlock();
        exploded = null;
        const dur = L.randomBetween(st.min, st.max) * 1000;
        run = { t0: performance.now(), dur, nextTick: 0, tempo: 0.5, tick: 0, hopAt: 0 };
        if (st.mode === 'circle') holder = L.pickIndex(names().length);
        root.Kuji.setBusy(true);
        stopFuse = S.startCrackle();
        S.play('kachi');
        setBtn();
    }
    function stopRun() {
        if (stopFuse) { stopFuse(); stopFuse = null; }
        run = null;
        root.Kuji.setBusy(false);
    }
    function explode() {
        const pos = bombPos();
        stopRun();
        exploded = { t: performance.now(), x: pos.x, y: pos.y };
        S.play('boom');
        FX.flash('#ffffff', 600); FX.shake(22, 800);
        const r = cv.getBoundingClientRect();
        FX.sparks(r.left + pos.x, r.top + pos.y, 200, { max: 1100, lifeMax: 1.1, colors: ['#ffffff', '#fff3a0', '#ffd23f', '#ff9a2e', '#ff4d1f'] });
        FX.ring(r.left + pos.x, r.top + pos.y, '#ffd23f', 1400, 20);
        P.smoke(pos.x, pos.y, 40, 4);
        setBtn();
        const who = st.mode === 'circle' ? names()[holder] : null;
        setTimeout(() => {
            if (root.Kuji.current() !== 'bomb') return;
            root.Kuji.showResult({
                level: 'normal', img: 'collision', quiet: true,
                sub: 'ドッカーン！', title: who || 'ばくはつ！',
                note: who ? 'の ところで ばくはつ しました' : 'いま もっている 人の ばん！',
                buttons: [{ label: 'もういちど', ic: 'play', primary: true, act: () => setTimeout(toggle, 150) }, { label: 'とじる', ic: 'check-circle' }],
            });
            S.play('reveal');
        }, 1100);
    }

    function bombPos() {
        if (st.mode === 'circle') {
            const n = names().length;
            const a = -Math.PI / 2 + holder / n * Math.PI * 2;
            const R = Math.min(W, H) * 0.36 * 0.6;   // 名前の まるの すこし 内がわ
            return { x: W / 2 + Math.cos(a) * R, y: H / 2 + Math.sin(a) * R };
        }
        return { x: W / 2, y: H * 0.55 };
    }

    function update(dt, t) {
        P.update(dt);
        if (!run) return;
        const el = t - run.t0;
        // チクタク：はやさが ときどき かわる（のこり時間は わからない）
        if (el >= run.nextTick) {
            run.tick++;
            S.play('tickTock', run.tick % 2 === 0);
            if (Math.random() < 0.15) run.tempo = 0.25 + Math.random() * 0.45;
            run.nextTick = el + run.tempo * 1000;
        }
        if (st.mode === 'circle' && el >= run.hopAt) {
            const n = names().length;
            holder = (holder + 1) % n;
            run.hopAt = el + 150 + Math.random() * 450;
            S.play('pop', 0.9 + Math.random() * 0.3);
        }
        const fp = fusePoint(t);
        P.sparks(fp.x, fp.y, 4, { max: 240, lifeMax: 0.45, g: 380 });
        if (Math.random() < 0.1) P.sparks(fp.x, fp.y, 14, { max: 340, colors: ['#ffffff', '#ffe14d'] });
        if (Math.random() < 0.3) P.smoke(fp.x, fp.y - 4, 1, 0.8);
        if (el >= run.dur) explode();
    }

    function bombSize() { return st.mode === 'circle' ? Math.min(W, H) * 0.17 : Math.min(W * 0.5, H * 0.55); }
    function fusePoint(t) {
        const p = bombPos(), s = bombSize();
        const wob = Math.sin(t / 90) * s * 0.01;
        return { x: p.x + s * 0.3 + wob, y: p.y - s * 0.42 };
    }

    /* ---------- かく ---------- */
    function draw(t) {
        if (!W) return;
        const c = cx;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, W, H);
        if (st.mode === 'circle') {
            const nm = names(), n = nm.length;
            const R = Math.min(W, H) * 0.36;
            const fs = Math.max(12, Math.min(28, R * 2.4 / Math.max(6, n)));
            for (let i = 0; i < n; i++) {
                const a = -Math.PI / 2 + i / n * Math.PI * 2;
                const x = W / 2 + Math.cos(a) * R, y = H / 2 + Math.sin(a) * R;
                const on = i === holder && (run || exploded);
                c.fillStyle = on ? (exploded ? '#ff4d1f' : '#ffd23f') : 'rgba(255,255,255,0.12)';
                c.beginPath(); c.arc(x, y, fs * 1.6, 0, Math.PI * 2); c.fill();
                c.fillStyle = on ? '#1d1d35' : '#ffffff';
                c.font = `${Math.round(fs)}px "Mochiy Pop One","M PLUS Rounded 1c",sans-serif`;
                c.textAlign = 'center'; c.textBaseline = 'middle';
                const label = Array.from(nm[i]).length > 5 ? Array.from(nm[i]).slice(0, 4).join('') + '…' : nm[i];
                c.fillText(label, x, y);
            }
        }
        P.draw(c);
        if (exploded) {
            const k = (t - exploded.t) / 1000;
            const im = root.Kuji.img('collision');
            const s = bombSize() * (1.1 + Math.min(0.6, k * 2)) * (1 + 0.04 * Math.sin(t / 50));
            if (im.complete && im.naturalWidth) { c.globalAlpha = Math.max(0.25, 1 - k * 0.3); c.drawImage(im, exploded.x - s / 2, exploded.y - s / 2, s, s); c.globalAlpha = 1; }
            return;
        }
        const p = bombPos(), s = bombSize();
        let pulse = 1;
        if (run) pulse = 1 + 0.05 * Math.sin(t / 70) + (Math.random() - 0.5) * 0.02;
        const im = root.Kuji.img('bomb');
        const ss = s * pulse;
        if (run) {
            const g = c.createRadialGradient(p.x, p.y, ss * 0.3, p.x, p.y, ss * 0.9);
            g.addColorStop(0, 'rgba(255,60,60,0.35)'); g.addColorStop(1, 'rgba(255,60,60,0)');
            c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, ss * 0.9, 0, Math.PI * 2); c.fill();
        }
        if (im.complete && im.naturalWidth) c.drawImage(im, p.x - ss / 2, p.y - ss / 2, ss, ss);
        if (run) {
            const fp = fusePoint(t);
            const fi = root.Kuji.img('fire');
            const fsz = s * 0.28 * (0.9 + 0.2 * Math.random());
            const g = c.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, fsz);
            g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(1, 'rgba(255,120,0,0)');
            c.fillStyle = g; c.beginPath(); c.arc(fp.x, fp.y, fsz, 0, Math.PI * 2); c.fill();
            if (fi.complete && fi.naturalWidth) c.drawImage(fi, fp.x - fsz / 2, fp.y - fsz * 0.85, fsz, fsz);
        }
    }

    function loop() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        const step = t => {
            const dt = Math.min(0.05, (t - lastT) / 1000);
            lastT = t;
            update(dt, t);
            draw(t);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    root.Kuji.register('bomb', {
        title: 'ばくだん リレー', emoji: 'bomb',
        init, enter, leave, onSheetOpen, onSheetClose, redraw: () => draw(performance.now()),
    });
})(window);
