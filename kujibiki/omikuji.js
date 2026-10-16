/* くじびき ひろば ── ④ おみくじ
   六角の 箱を 指で こすると シャカシャカ ふれる。じゅうぶん ふると 箱が さかさに なり、棒が 1本 出る。
   なにが 出るかは KujiLogic（本数を きめる → drawFromStock、かぎりなし → weightedPick）で きめる。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const PRESETS = {
        atari: [{ label: 'あたり', n: 3, lv: 'win' }, { label: 'はずれ', n: 27, lv: 'lose' }],
        unsei: [{ label: '大吉', n: 2, lv: 'super' }, { label: '中吉', n: 4, lv: 'win' }, { label: '小吉', n: 4, lv: 'win' },
            { label: '吉', n: 6, lv: 'win' }, { label: '末吉', n: 3, lv: 'normal' }, { label: '凶', n: 1, lv: 'lose' }],
        tou: [{ label: '1等', n: 1, lv: 'super' }, { label: '2等', n: 2, lv: 'win' }, { label: '3等', n: 5, lv: 'win' }, { label: 'はずれ', n: 12, lv: 'lose' }],
    };
    const DEF = { items: PRESETS.atari, limit: 'stock', stock: null, showLeft: true, motion: false };
    const NEED = 6;   // これだけ ふると 出る

    let sec, box, st, tbl;
    let phase = 'idle';           // idle → shaking → out → paper
    let energy = 0, drag = null, lastDir = 0, autoT = 0;
    let motionOn = false;
    let lastIdx = -1;     // いま 出て いる 棒の しゅるい

    function init(el) {
        sec = el;
        st = load('omikuji', DEF);
        box = $('.om-box', sec);
        tbl = root.KujiPrizes.table($('.pz', sec), { mode: () => (($('[name="omLimit"]:checked', sec) || {}).value || 'stock') });
        $$('[name="omLimit"]', sec).forEach(r => r.addEventListener('change', () => tbl.refresh()));
        $$('[data-preset]', sec).forEach(b => b.addEventListener('click', () => tbl.set(PRESETS[b.dataset.preset])));
        $('[data-act="refill"]', sec).addEventListener('click', () => { st.stock = null; persist(); root.Kuji.closeSheets(); renderLeft(); });
        $('[data-act="refillStage"]', sec).addEventListener('click', () => { if (phase === 'idle') { st.stock = null; persist(); renderLeft(); } });
        $('[data-act="shake"]', sec).addEventListener('click', autoShake);
        $('[data-act="motion"]', sec).addEventListener('click', toggleMotion);
        // つぎを どう ひくか：棒を のぞく ／ もどす（とじる も もどす）
        $('[data-act="takeAgain"]', sec).addEventListener('click', () => { takeOut(); closePaper(); setTimeout(autoShake, 200); });
        $('[data-act="again"]', sec).addEventListener('click', () => { closePaper(); setTimeout(autoShake, 200); });
        $('[data-act="closePaper"]', sec).addEventListener('click', () => closePaper());
        box.addEventListener('pointerdown', onDown);
        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerup', onUp);
        root.addEventListener('pointercancel', onUp);
    }
    function enter() { closePaper(true); renderLeft(); }
    function leave() {
        stopMotion();
        clearInterval(autoT); autoT = 0;
        if (phase !== 'idle') { phase = 'idle'; root.Kuji.setBusy(false); }
        resetBox();
    }
    function persist() { save('omikuji', st); }
    const stock = () => st.stock || st.items.map(x => Object.assign({}, x));

    function onSheetOpen() {
        tbl.set(st.items);
        $$('[name="omLimit"]', sec).forEach(r => { r.checked = r.value === st.limit; });
        $('[name="omShowLeft"]', sec).checked = st.showLeft;
        tbl.refresh();
    }
    function onSheetClose() {
        const items = tbl.get();
        const limit = ($('[name="omLimit"]:checked', sec) || {}).value || 'stock';
        if (JSON.stringify(items) !== JSON.stringify(st.items) || limit !== st.limit) st.stock = null;
        st.items = items; st.limit = limit;
        st.showLeft = $('[name="omShowLeft"]', sec).checked;
        persist(); renderLeft();
    }

    function renderLeft() {
        const el = $('.om-left', sec);
        if (st.limit === 'inf') {
            el.innerHTML = '<b>かぎりなし</b>';
            $('[data-act="refillStage"]', sec).hidden = true;
            $('[data-act="shake"]', sec).disabled = false;
            sec.classList.remove('empty');
            return;
        }
        const s = stock();
        const tot = L.stockTotal(s);
        el.innerHTML = `のこり <b>${tot}</b> 本` + (st.showLeft ? '<small>' + s.map(x => `${esc(x.label)} ${x.n}`).join('・') + '</small>' : '');
        $('[data-act="shake"]', sec).disabled = tot <= 0;
        $('[data-act="refillStage"]', sec).hidden = !st.stock || tot === L.stockTotal(st.items);
        sec.classList.toggle('empty', tot <= 0);
    }

    /* ---------- ふる ---------- */
    function canShake() {
        if (phase !== 'idle' && phase !== 'shaking') return false;
        if (!$('#result').hidden) return false;
        if (st.limit === 'stock' && L.stockTotal(stock()) <= 0) {
            root.Kuji.showResult({ level: 'normal', img: 'shinto-shrine', sub: 'おみくじ', title: 'ぼうが ありません', note: '「中身・せってい」の「ぼうを ぜんぶ もどす」で もどせます', quiet: true });
            return false;
        }
        return true;
    }
    function onDown(e) {
        if (!canShake()) return;
        S.unlock();
        drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, id: e.pointerId };
        box.setPointerCapture && box.setPointerCapture(e.pointerId);
        e.preventDefault();
    }
    function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        const tx = L.clamp(e.clientX - drag.sx, -120, 120), ty = L.clamp(e.clientY - drag.sy, -80, 80);
        box.style.transform = `translate(${tx * 0.5}px, ${ty * 0.5}px) rotate(${tx * 0.18}deg)`;
        const dir = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * 1 : Math.sign(dy) * 2;
        if (dir && dir !== lastDir && (Math.abs(dx) + Math.abs(dy)) > 4) {
            lastDir = dir;
            bump(Math.min(1.4, (Math.abs(dx) + Math.abs(dy)) / 25));
        }
    }
    function onUp(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const tap = drag.moved < 12;
        drag = null;
        if (phase === 'shaking' && energy < NEED) box.style.transform = '';
        if (tap) autoShake();
    }
    /* 1回 ふれた */
    let idleT = 0;
    function bump(s) {
        if (phase === 'idle') { phase = 'shaking'; root.Kuji.setBusy(true); }
        if (phase !== 'shaking') return;
        energy += 1;
        // ふるのを やめたら もとに もどる
        clearTimeout(idleT);
        idleT = setTimeout(() => {
            if (phase !== 'shaking' || autoT) return;
            phase = 'idle'; resetBox(); root.Kuji.setBusy(false);
        }, 2500);
        S.play('shaka', s || 1);
        box.classList.remove('rattle'); void box.offsetWidth; box.classList.add('rattle');
        $('.om-meter i', sec).style.width = Math.min(100, energy / NEED * 100) + '%';
        if (energy >= NEED) draw();
    }
    /* タップ・ボタン：じどうで シャカシャカ */
    function autoShake() {
        if (autoT || !canShake()) return;
        S.unlock();
        box.classList.add('auto');
        let k = 0;
        autoT = setInterval(() => {
            if (phase !== 'idle' && phase !== 'shaking') { clearInterval(autoT); autoT = 0; return; }
            bump(1 + (k++ % 2) * 0.3);
        }, 190);
    }

    /* ---------- 棒が 出る ---------- */
    function draw() {
        phase = 'out';
        clearInterval(autoT); autoT = 0;
        drag = null;
        box.classList.remove('auto', 'rattle');
        box.style.transform = '';
        let idx, label, lv;
        // ひいた だけでは へらさない（へらすのは「棒を のぞいて」を えらんだ とき）
        idx = L.weightedPick(st.limit === 'stock' ? stock() : st.items);
        lastIdx = idx;
        const it = st.items[idx] || { label: '？', lv: 'normal' };
        label = it.label; lv = it.lv || 'normal';
        const num = 1 + Math.floor(Math.random() * (st.limit === 'stock' ? Math.max(1, L.stockTotal(st.items)) : 100));
        $('.om-stick b', sec).textContent = num;
        box.classList.add('flip');
        S.play('whoosh');
        setTimeout(() => {
            box.classList.add('out');
            S.play('karan');
        }, 650);
        setTimeout(() => showPaper(num, label, lv), 1700);
        renderLeft();
    }

    function showPaper(num, label, lv) {
        if (root.Kuji.current() !== 'omikuji') return;
        phase = 'paper';
        const p = $('.om-paper', sec);
        p.className = 'om-paper lv-' + lv + (st.limit === 'stock' ? ' stock' : '');
        $('[data-act="again"] .lbl', p).textContent = st.limit === 'stock' ? '棒を もどして もういちど' : 'もういちど ひく';
        $('[data-act="takeAgain"]', p).disabled = L.stockTotal(stock()) <= 1;
        $('.om-num', p).textContent = num + ' ばん';
        const t = $('.om-word', p);
        t.textContent = label;
        t.style.setProperty('--len', Array.from(label).length);
        p.hidden = false;
        void p.offsetWidth;
        p.classList.add('show');
        root.Kuji.celebrate(lv);
        if (lv === 'super' || lv === 'win') {
            const r = p.getBoundingClientRect();
            FX.confettiBurst(r.left + r.width / 2, r.top + r.height * 0.3, lv === 'super' ? 160 : 80);
        }
        root.Kuji.setBusy(false);
    }
    /** 出た 棒を のぞく（本数を きめる とき） */
    function takeOut() {
        if (st.limit !== 'stock' || lastIdx < 0) return;
        const s = stock();
        if (s[lastIdx] && s[lastIdx].n > 0) { s[lastIdx] = Object.assign({}, s[lastIdx], { n: s[lastIdx].n - 1 }); st.stock = s; persist(); }
        lastIdx = -1;
    }
    function closePaper(silent) {
        const p = $('.om-paper', sec);
        p.hidden = true; p.classList.remove('show');
        resetBox();
        phase = 'idle';
        if (!silent) renderLeft();
    }
    function resetBox() {
        energy = 0; lastDir = 0;
        box.classList.remove('flip', 'out', 'auto', 'rattle');
        box.style.transform = '';
        $('.om-meter i', sec).style.width = '0%';
    }

    /* ---------- 端末を ふる ---------- */
    let lastMag = 0, lastShakeAt = 0;
    function onMotion(e) {
        const a = e.accelerationIncludingGravity || e.acceleration;
        if (!a) return;
        const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        const now = performance.now();
        if (Math.abs(mag - lastMag) > 9 && now - lastShakeAt > 140) {
            lastShakeAt = now;
            if (phase === 'idle' && !canShake()) return;
            bump(1.2);
        }
        lastMag = mag;
    }
    async function toggleMotion() {
        if (motionOn) { stopMotion(); return; }
        try {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                const r = await DeviceMotionEvent.requestPermission();
                if (r !== 'granted') return;
            }
            if (typeof DeviceMotionEvent === 'undefined') {
                root.Kuji.showResult({ level: 'normal', img: 'shinto-shrine', sub: 'ふって ひく', title: 'この 端末は ふれません', note: '箱を 指で こするか、ボタンで ふってね', quiet: true });
                return;
            }
            root.addEventListener('devicemotion', onMotion);
            motionOn = true;
            $('[data-act="motion"]', sec).classList.add('on');
        } catch (e) { /* つかえない 端末 */ }
    }
    function stopMotion() {
        root.removeEventListener('devicemotion', onMotion);
        motionOn = false;
        const b = sec && $('[data-act="motion"]', sec);
        if (b) b.classList.remove('on');
    }

    root.Kuji.register('omikuji', {
        title: 'おみくじ', emoji: 'shinto-shrine',
        init, enter, leave, onSheetOpen, onSheetClose,
    });
})(window);
