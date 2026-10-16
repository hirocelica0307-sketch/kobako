/* くじびき ひろば ── ③ ビンゴ（ガラガラ 抽選機）
   すきとおった 球の 中で 玉が ころがる（かんたんな 物理）。ボタンで 球が まわり、玉が 1こ 出てくる。
   出る 玉は まわしはじめた ときに KujiLogic.drawOne で きめる（どの 玉も おなじ 確率）。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const LETTER_COL = { B: '#2f7bff', I: '#ff3b5c', N: '#f2f2f2', G: '#21c26b', O: '#ffbf1f' };
    const PAL = ['#ff3b5c', '#2f7bff', '#ffbf1f', '#21c26b', '#b46bff', '#ff8a3b', '#00b4d8', '#ff5dc8'];
    const DUR = { short: 1600, normal: 2800, long: 4600 };
    const DEF = { kind: 'num', from: 1, to: 75, letters: true, text: 'りんご\nみかん\nぶどう\nいちご\nメロン\nもも\nバナナ\nスイカ', dur: 'normal', called: [] };
    const VISIBLE_MAX = 90;

    let sec, cv, cx, wrap, dpr = 1, W = 0, H = 0;
    let st, ed, items = [];       // items = [{id, v, letter, color}]
    let balls = [];               // 球の 中の 玉 {id, x, y, vx, vy, r}
    let G = null;                 // 機械の 大きさ
    let ang = 0, omega = 0;       // 球の 回転
    let phase = 'idle', phaseT = 0, spinDur = 2800, chosen = null, exitBall = null, stopRattle = null;
    let raf = 0, lastT = 0;

    function init(el) {
        sec = el;
        st = load('bingo', DEF);
        cv = $('.bg-cv', sec); cx = cv.getContext('2d');
        wrap = $('.bg-machine', sec);
        ed = root.Kuji.listEditor($('.listed', sec), { max: 300 });
        $('[data-act="spin"]', sec).addEventListener('click', spin);
        cv.addEventListener('click', spin);
        $('[data-act="reach"]', sec).addEventListener('click', reach);
        $('[data-act="bingo"]', sec).addEventListener('click', bingoCall);
        $('[data-act="reset"]', sec).addEventListener('click', async () => {
            if (phase !== 'idle') return;
            if (st.called.length && !(await root.Kuji.confirm('玉を ぜんぶ もどして さいしょから に しますか？', 'さいしょから'))) return;
            st.called = []; persist(); root.Kuji.closeSheets(); rebuild();
        });
        $$('[name="bgKind"]', sec).forEach(r => r.addEventListener('change', kindUi));
        $('#bgPop').addEventListener('click', () => endPop());
        new ResizeObserver(resize).observe(wrap);
    }
    function enter() { rebuild(); resize(); loop(); }
    function leave() {
        cancelAnimationFrame(raf); raf = 0;
        if (stopRattle) { stopRattle(); stopRattle = null; }
        if (phase !== 'idle') {
            // とちゅうで ぬけた ときは、出る はずの 玉を 出た ことに する
            if (chosen && !st.called.includes(chosen.id)) { st.called.push(chosen.id); persist(); }
            phase = 'idle'; chosen = null; exitBall = null; omega = 0;
            balls = balls.filter(b => !b.guide);
            root.Kuji.setBusy(false);
        }
        endPop(true);
    }
    function persist() { save('bingo', st); }

    /* ---------- 中身 ---------- */
    function makeItems() {
        let vals;
        if (st.kind === 'num') vals = L.numberList(st.from, st.to, 1, 300);
        else vals = L.parseList(st.text).slice(0, 300);
        const std = st.kind === 'num' && st.letters && Number(st.from) >= 1 && Number(st.to) <= 75;
        return vals.map((v, i) => {
            const letter = std ? L.bingoLetter(v) : '';
            return { id: i, v, letter, color: letter ? LETTER_COL[letter] : PAL[i % PAL.length] };
        });
    }
    const rest = () => items.filter(it => !st.called.includes(it.id));

    function rebuild() {
        items = makeItems();
        st.called = st.called.filter(id => id < items.length);
        if (G) fillBalls();
        renderBoard();
    }

    function kindUi() {
        const k = ($('[name="bgKind"]:checked', sec) || {}).value || 'num';
        $('.bg-num', sec).hidden = k !== 'num';
        $('.bg-list', sec).hidden = k !== 'list';
    }
    function onSheetOpen() {
        $$('[name="bgKind"]', sec).forEach(r => { r.checked = r.value === st.kind; });
        $('[name="bgFrom"]', sec).value = st.from;
        $('[name="bgTo"]', sec).value = st.to;
        $('[name="bgLetters"]', sec).checked = st.letters;
        $$('[name="bgDur"]', sec).forEach(r => { r.checked = r.value === st.dur; });
        ed.set(st.text);
        kindUi();
    }
    function onSheetClose() {
        const before = JSON.stringify([st.kind, st.from, st.to, st.letters, st.text]);
        st.kind = ($('[name="bgKind"]:checked', sec) || {}).value || 'num';
        st.from = L.clamp(Math.round($('[name="bgFrom"]', sec).value), -999, 9999);
        st.to = L.clamp(Math.round($('[name="bgTo"]', sec).value), -999, 9999);
        if (Math.abs(st.to - st.from) > 299) st.to = st.from + 299 * Math.sign(st.to - st.from || 1);
        st.letters = $('[name="bgLetters"]', sec).checked;
        st.text = ed.get();
        st.dur = ($('[name="bgDur"]:checked', sec) || {}).value || 'normal';
        if (before !== JSON.stringify([st.kind, st.from, st.to, st.letters, st.text])) st.called = [];
        persist();
        rebuild();
    }

    /* ---------- 機械の 大きさ ---------- */
    function resize() {
        const r = wrap.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        const R = Math.min(W * 0.36, H * 0.37);
        const gx = W * 0.44, gy = H * 0.42;
        const ha = 0.85;   // 出口の 角度（右下）
        G = {
            R, gx, gy,
            hole: { a: ha, x: gx + Math.cos(ha) * R, y: gy + Math.sin(ha) * R },
            tray: { x: Math.min(W - R * 0.25, gx + R * 1.45), y: Math.min(H - R * 0.18, gy + R * 1.32) },
            base: Math.min(H - 6, gy + R * 1.5),
        };
        fillBalls();
    }

    function ballR(count) {
        const R = G.R;
        return L.clamp(R * Math.sqrt(0.36 / Math.max(1, count)), R * 0.055, R * 0.15);
    }
    /** 球の 中に 玉を ならべる（まえの いちは できるだけ そのまま） */
    function fillBalls() {
        if (!G) return;
        let rs = rest();
        if (rs.length > VISIBLE_MAX) rs = rs.slice(0, VISIBLE_MAX);
        const r = ballR(rs.length);
        const old = {};
        balls.forEach(b => { old[b.id] = b; });
        balls = rs.map((it, k) => {
            const o = old[it.id];
            if (o) return Object.assign(o, { r });
            // 下の ほうに つみあげる
            const a = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            const d = (G.R - r * 1.2) * (0.3 + 0.7 * Math.random());
            return { id: it.id, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, r, spin: Math.random() * 6 };
        });
    }

    /* ---------- 物理 ---------- */
    const FINS = 4;
    function physics(dt) {
        const R = G.R, wall = R * 0.965;
        const grav = R * 5.2;
        const sub = 3, h = dt / sub;
        for (let s = 0; s < sub; s++) {
            for (const b of balls) {
                b.vy += grav * h;
                b.vx *= 0.999; b.vy *= 0.999;
                if (b.guide) guideStep(b, h, wall, grav);
                b.x += b.vx * h; b.y += b.vy * h;
                // かべ
                const d = Math.hypot(b.x, b.y), lim = wall - b.r;
                if (d > lim) {
                    const nx = b.x / d, ny = b.y / d;
                    b.x = nx * lim; b.y = ny * lim;
                    const vn = b.vx * nx + b.vy * ny;
                    if (b.guide) {
                        // 出口へ むかう 玉は かべを すべる（まさつで おそく ならない）
                        if (vn > 0) { b.vx -= vn * nx; b.vy -= vn * ny; }
                    } else {
                        // かべの うごき（まわって いる）
                        const wx = -omega * ny * wall, wy = omega * nx * wall;
                        const tx = -ny, ty = nx;
                        const vt = b.vx * tx + b.vy * ty, wt = wx * tx + wy * ty;
                        const nvt = vt + (wt - vt) * Math.min(1, 0.35 + Math.abs(omega) * 0.04);
                        const nvn = vn > 0 ? -vn * 0.35 : vn;
                        b.vx = nx * nvn + tx * nvt; b.vy = ny * nvn + ty * nvt;
                    }
                }
                // ひれ（玉を もちあげる）。出口へ むかう 玉は ひれの 手前を ころがる
                for (let f = 0; f < FINS && !b.guide; f++) {
                    const fa = ang + f * Math.PI * 2 / FINS;
                    const ux = Math.cos(fa), uy = Math.sin(fa);
                    const t = b.x * ux + b.y * uy;
                    if (t < R * 0.6 || t > wall) continue;
                    const px = ux * t, py = uy * t;
                    const dx = b.x - px, dy = b.y - py, dd = Math.hypot(dx, dy);
                    const lim2 = b.r + R * 0.02;
                    if (dd < lim2 && dd > 1e-6) {
                        const nx = dx / dd, ny = dy / dd;
                        b.x = px + nx * lim2; b.y = py + ny * lim2;
                        const sx = -omega * py, sy = omega * px;     // ひれの その 点の はやさ
                        const rv = (b.vx - sx) * nx + (b.vy - sy) * ny;
                        if (rv < 0) { b.vx -= rv * nx * 1.3; b.vy -= rv * ny * 1.3; }
                    }
                }
                b.spin += (b.vx / b.r) * h * 0.5;
            }
            // 玉どうし
            for (let i = 0; i < balls.length; i++) {
                const a = balls[i];
                for (let j = i + 1; j < balls.length; j++) {
                    const b = balls[j];
                    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
                    if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
                    const d2 = dx * dx + dy * dy;
                    if (d2 >= rr * rr || d2 < 1e-9) continue;
                    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = rr - d;
                    // 出口へ むかう 玉は じぶんの 道を すすみ、まわりの 玉だけ おしのける
                    const wa = a.guide ? 0 : b.guide ? 1 : 0.5, wb = 1 - wa;
                    a.x -= nx * over * wa; a.y -= ny * over * wa; b.x += nx * over * wb; b.y += ny * over * wb;
                    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                    if (rv < 0) {
                        const j2 = -(1 + 0.5) * rv;
                        a.vx -= j2 * nx * wa; a.vy -= j2 * ny * wa; b.vx += j2 * nx * wb; b.vy += j2 * ny * wb;
                    }
                }
            }
        }
    }

    /* ---------- まわす ---------- */
    function spin() {
        if (phase !== 'idle' || !$('#result').hidden || !$('#bgPop').hidden) return;
        const rs = rest();
        if (!rs.length) {
            root.Kuji.showResult({ level: 'normal', img: 'crystal-ball', sub: 'ビンゴ', title: 'ぜんぶ 出ました', note: '「中身・せってい」の「さいしょから」で もどせます', quiet: true });
            return;
        }
        S.unlock();
        const d = L.drawOne(rs.map(it => it.id));
        chosen = items[d.ball];
        // 見えて いない 玉が えらばれた ときは、見えて いる 玉と いれかえる
        if (!balls.some(b => b.id === chosen.id) && balls.length) balls[Math.floor(Math.random() * balls.length)].id = chosen.id;
        phase = 'spin'; phaseT = 0; spinDur = DUR[st.dur] || DUR.normal;
        root.Kuji.setBusy(true);
        sec.classList.add('spinning');
        const sp = () => Math.min(1, Math.abs(omega) / 9);
        if (stopRattle) stopRattle();
        stopRattle = S.startRattle(sp);
        S.play('kachi');
    }

    function update(dt) {
        if (!G) return;
        phaseT += dt * 1000;
        if (phase === 'spin') {
            const up = 450, down = 1000;
            const target = 9;
            if (phaseT < up) omega = target * (phaseT / up);
            else if (phaseT < spinDur - down) omega = target * (1 + 0.08 * Math.sin(phaseT / 120));
            else if (phaseT < spinDur) {
                // ゆっくり とまる（さいごは なめらかに 0 へ）
                const u = (spinDur - phaseT) / down;
                omega = target * u * u;
            } else {
                omega = 0;
                if (stopRattle) { stopRattle(); stopRattle = null; }
                startGuide();
            }
        } else {
            omega *= Math.exp(-3 * dt);
        }
        ang += omega * dt;
        physics(dt);
        if (phase === 'guide') checkGuide();
        if (phase === 'exit') moveExit(dt);
        if (sec.dataset.phase !== phase) sec.dataset.phase = phase;   // いまの だんかい（たしかめ用）
    }

    /* ---------- えらばれた 玉が 出てくる ----------
       1) guide：えらばれた 玉が 光り、球の 中を ころがって 出口へ むかう（まわりの 玉は おしのけられる）
       2) exit ：出口から すべり台へ。さかを ころがって だんだん はやく なり、トレイで ポンポン はねて とまる */
    function startGuide() {
        const b = balls.find(x => x.id === chosen.id);
        if (!b) { phase = 'guide'; phaseT = 0; return; }
        b.guide = true;
        b.gt = 0;
        phase = 'guide'; phaseT = 0;
        S.play('sparkle');
    }
    /** 出口の すぐ 内がわ（玉の 中心が くる ところ） */
    function holeInside(r) {
        const lim = G.R * 0.965 - r;
        return { x: Math.cos(G.hole.a) * lim, y: Math.sin(G.hole.a) * lim };
    }
    /** 出口へ ひっぱる 力（だんだん つよく、ちかづくと ゆっくり） */
    function guideStep(b, h, wall, grav) {
        b.gt += h;
        const T = holeInside(b.r);
        const dx = T.x - b.x, dy = T.y - b.y, dist = Math.hypot(dx, dy) || 1;
        // はじめの 0.3びょうは その場で 光るだけ（どの 玉か 見えるように）→ うごきだす
        const ramp = Math.min(1, Math.max(0, (b.gt - 0.3) / 0.4));
        // とおい ときは はやく、ちかづくと ゆっくり。でも とまらない（かならず 出口へ とどく）
        const speed = L.clamp(dist * 4.5, G.R * 0.7, G.R * 2.2) * ramp + (b.gt > 1.7 ? G.R * 0.8 : 0);
        const tvx = dx / dist * speed, tvy = dy / dist * speed;
        const k = Math.min(1, h * (4 + 10 * ramp));
        // 重力を うちけしつつ、めあての はやさへ すこしずつ ちかづける
        b.vy -= grav * h * ramp;
        b.vx += (tvx - b.vx) * k; b.vy += (tvy - b.vy) * k;
    }
    function checkGuide() {
        const b = balls.find(x => x.guide);
        if (!b) { startExit(null); return; }
        const T = holeInside(b.r);
        if ((phaseT > 600 && Math.hypot(T.x - b.x, T.y - b.y) < b.r * 0.5) || phaseT > 2800) startExit(b);
    }
    function startExit(b) {
        balls = balls.filter(x => x !== b);
        const h = G.hole, tr = G.tray;
        const len = Math.hypot(tr.x - h.x, tr.y - h.y);
        const ux = (tr.x - h.x) / len, uy = (tr.y - h.y) / len;
        const r = b ? b.r : ballR(1);
        // 出口の 内がわ → 出口 → すべり台（s は すべり台の 上の 長さ。マイナスは 球の 中）
        const T = holeInside(r);
        const s0 = -Math.hypot(h.x - (G.gx + T.x), h.y - (G.gy + T.y));
        const v0 = b ? Math.max(G.R * 0.6, b.vx * ux + b.vy * uy) : G.R * 0.6;
        exitBall = { s: s0, s0, p0x: G.gx + T.x, p0y: G.gy + T.y, v: v0, len, ux, uy, r, spin: b ? b.spin : 0, x: G.gx + T.x, y: G.gy + T.y, bounce: 0, landed: false };
        phase = 'exit'; phaseT = 0;
        S.play('kachi');
    }
    function moveExit(dt) {
        const e = exitBall, h = G.hole, tr = G.tray;
        if (!e.landed) {
            // さかを ころがる：重力の さかの むきの ぶんだけ はやく なる
            const acc = G.R * 5.2 * Math.max(0.35, e.uy) * 0.7;
            e.v += acc * dt;
            e.s += e.v * dt;
            e.spin += (e.v * dt) / e.r;
            if (e.s < 0) {
                // まだ 球の 中：出口の 内がわ から 出口へ
                const f = e.s / e.s0;
                e.x = h.x + (e.p0x - h.x) * f; e.y = h.y + (e.p0y - h.y) * f;
            } else {
                e.x = h.x + e.ux * e.s; e.y = h.y + e.uy * e.s;
            }
            if (e.s >= e.len) {
                e.landed = true; e.t = 0;
                e.x = tr.x; e.y = tr.y;
                S.play('pop', 1);
                const r = cv.getBoundingClientRect();
                FX.sparks(r.left + tr.x, r.top + tr.y, 40, { colors: ['#ffffff', '#ffe14d'], max: 360 });
            }
        } else {
            // トレイで ポン、ポン、と 小さく はねて とまる
            e.t += dt;
            const k = e.t / 0.55;
            e.bounce = k < 1 ? Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * e.r * 1.1 : 0;
            e.spin += dt * 4 * Math.max(0, 1 - k);
            e.x = tr.x; e.y = tr.y - e.bounce;
            if (k >= 1 && !e.shown) { e.shown = true; setTimeout(() => showPop(), 150); }
        }
    }

    /* 大きく 見せる */
    function showPop() {
        if (!chosen || root.Kuji.current() !== 'bingo') return;
        const pop = $('#bgPop');
        pop.innerHTML = ballHtml(chosen, 'huge');
        pop.hidden = false;
        pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
        S.play('reveal');
        setTimeout(() => { S.play('ding'); const { w, h } = FX.size(); FX.stars(w / 2, h / 2, 40, Math.min(w, h) * 0.3); FX.ring(w / 2, h / 2, chosen.color, 900, 12); }, 350);
        st.called.push(chosen.id);
        persist();
        clearTimeout(showPop.t);
        showPop.t = setTimeout(() => endPop(), 2600);
    }
    function endPop(silent) {
        clearTimeout(showPop.t);
        const pop = $('#bgPop');
        if (pop.hidden) return;
        pop.hidden = true;
        pop.classList.remove('show');
        exitBall = null; chosen = null;
        phase = 'idle';
        sec.classList.remove('spinning');
        root.Kuji.setBusy(false);
        if (!silent) { renderBoard(true); }
    }

    function ballHtml(it, cls) {
        return `<div class="ball ${cls || ''}" style="--bc:${it.color}">${it.letter ? `<i>${it.letter}</i>` : ''}<b>${esc(it.v)}</b></div>`;
    }

    /* ---------- 出た 玉の 表 ---------- */
    function renderBoard(fresh) {
        const called = st.called.map(id => items[id]).filter(Boolean);
        const last = called[called.length - 1];
        $('.bg-now', sec).innerHTML = last ? ballHtml(last, 'big' + (fresh ? ' fresh' : '')) : '<div class="bg-empty">ボタンを おして まわそう！</div>';
        $('.bg-cnt', sec).textContent = `でた かず ${called.length} / ${items.length}`;
        $('.bg-recent', sec).innerHTML = called.slice(-7, -1).reverse().map(it => ballHtml(it, 'mini')).join('');
        const allNum = items.every(it => /^-?\d+$/.test(it.v));
        const board = $('.bg-board', sec);
        const set = new Set(st.called);
        const lastId = last ? last.id : -1;
        if (allNum && items.length <= 100) {
            const std = items.length === 75 && items[0].letter === 'B';
            board.className = 'bg-board grid' + (std ? ' std' : '');
            if (std) {
                board.innerHTML = 'BINGO'.split('').map((ch, r) =>
                    `<div class="row"><span class="hd" style="--bc:${LETTER_COL[ch]}">${ch}</span>` +
                    items.slice(r * 15, r * 15 + 15).map(it => `<span class="cell${set.has(it.id) ? ' on' : ''}${it.id === lastId ? ' last' : ''}" style="--bc:${it.color}">${esc(it.v)}</span>`).join('') + '</div>').join('');
            } else {
                board.style.setProperty('--cols', Math.min(10, Math.ceil(Math.sqrt(items.length * 1.6))));
                board.innerHTML = items.map(it => `<span class="cell${set.has(it.id) ? ' on' : ''}${it.id === lastId ? ' last' : ''}" style="--bc:${it.color}">${esc(it.v)}</span>`).join('');
            }
        } else {
            board.className = 'bg-board list';
            board.innerHTML = called.length
                ? called.map((it, i) => `<span class="chip${it.id === lastId ? ' last' : ''}" style="--bc:${it.color}"><small>${i + 1}</small>${esc(it.v)}</span>`).join('')
                : '<span class="bg-empty">まだ 出て いません</span>';
        }
        $('[data-act="spin"]', sec).disabled = false;
        $('[data-act="spin"] .lbl', sec).textContent = rest().length ? 'ガラガラ まわす' : 'ぜんぶ 出ました';
    }

    function reach() {
        S.play('reach');
        FX.flash('#ff3b6b', 500);
        banner('リーチ！');
    }
    function bingoCall() {
        root.Kuji.showResult({ level: 'super', img: 'trophy', sub: 'おめでとう！', title: 'ビンゴ！', buttons: [{ label: 'つづける', ic: 'play', primary: true }] });
    }
    function banner(text) {
        const b = $('.bg-banner', sec);
        b.textContent = text;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    }

    /* ---------- かく ---------- */
    function draw() {
        if (!G) return;
        const c = cx, { R, gx, gy } = G;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, W, H);
        const shakeX = phase === 'spin' ? (Math.random() - 0.5) * Math.min(3, Math.abs(omega) * 0.3) : 0;
        c.save();
        c.translate(shakeX, 0);

        // 台（うしろ）
        c.fillStyle = '#7a3b12';
        c.beginPath();
        c.moveTo(gx - R * 0.1, gy); c.lineTo(gx - R * 0.75, G.base); c.lineTo(gx - R * 0.55, G.base); c.lineTo(gx, gy + R * 0.2);
        c.lineTo(gx + R * 0.55, G.base); c.lineTo(gx + R * 0.75, G.base); c.lineTo(gx + R * 0.1, gy); c.closePath(); c.fill();
        const bg = c.createLinearGradient(0, G.base - R * 0.12, 0, G.base);
        bg.addColorStop(0, '#c0682a'); bg.addColorStop(1, '#6b2f0c');
        c.fillStyle = bg;
        roundRect(c, gx - R * 1.0, G.base - R * 0.12, R * 2.0, R * 0.12, R * 0.04); c.fill();

        // 球（ガラス）
        const gl = c.createRadialGradient(gx - R * 0.35, gy - R * 0.4, R * 0.1, gx, gy, R);
        gl.addColorStop(0, 'rgba(220,240,255,0.22)'); gl.addColorStop(0.7, 'rgba(120,170,255,0.10)'); gl.addColorStop(1, 'rgba(150,200,255,0.35)');
        c.fillStyle = gl;
        c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.fill();

        // うしろの 針金（まわる）
        c.save();
        c.translate(gx, gy);
        c.strokeStyle = 'rgba(200,220,255,0.18)'; c.lineWidth = 1.5;
        for (let k = 0; k < 12; k++) {
            const a = ang + k * Math.PI / 6;
            c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.stroke();
        }
        c.beginPath(); c.arc(0, 0, R * 0.6, 0, Math.PI * 2); c.stroke();
        c.restore();

        // 玉
        c.save();
        c.translate(gx, gy);
        for (const b of balls) if (!b.guide) drawBall(c, b.x, b.y, b.r, items[b.id], b.spin);
        // ひれ
        c.strokeStyle = 'rgba(230,240,255,0.75)'; c.lineWidth = Math.max(3, R * 0.035); c.lineCap = 'round';
        for (let f = 0; f < FINS; f++) {
            const fa = ang + f * Math.PI * 2 / FINS;
            c.beginPath(); c.moveTo(Math.cos(fa) * R * 0.6, Math.sin(fa) * R * 0.6); c.lineTo(Math.cos(fa) * R * 0.97, Math.sin(fa) * R * 0.97); c.stroke();
        }
        // えらばれた 玉（光りながら 出口へ）
        for (const b of balls) if (b.guide) {
            const pulse = 1 + 0.12 * Math.sin(performance.now() / 70);
            const big = 1 + 0.25 * Math.min(1, (b.gt || 0) / 0.3);   // すこしずつ 大きく して 目立たせる
            c.strokeStyle = 'rgba(255,240,150,0.9)'; c.lineWidth = Math.max(2, b.r * 0.18);
            c.beginPath(); c.arc(b.x, b.y, b.r * big * 1.35 * pulse, 0, Math.PI * 2); c.stroke();
            drawBall(c, b.x, b.y, b.r * big, items[b.id], b.spin, true);
        }
        c.restore();

        // 球の ふち・光
        c.strokeStyle = '#d8e4ff'; c.lineWidth = Math.max(4, R * 0.045);
        c.beginPath(); c.arc(gx, gy, R, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(80,110,170,0.9)'; c.lineWidth = Math.max(1.5, R * 0.012);
        c.beginPath(); c.arc(gx, gy, R * 1.02, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = R * 0.05; c.lineCap = 'round';
        c.beginPath(); c.arc(gx, gy, R * 0.85, Math.PI * 1.1, Math.PI * 1.35); c.stroke();
        c.lineWidth = R * 0.025;
        c.beginPath(); c.arc(gx, gy, R * 0.85, Math.PI * 1.42, Math.PI * 1.5); c.stroke();

        // 出口と すべり台
        const h = G.hole, tr = G.tray;
        const cw = R * 0.24;
        c.save();
        const ang2 = Math.atan2(tr.y - h.y, tr.x - h.x);
        c.translate(h.x, h.y); c.rotate(ang2);
        const len = Math.hypot(tr.x - h.x, tr.y - h.y);
        const cg = c.createLinearGradient(0, -cw / 2, 0, cw / 2);
        cg.addColorStop(0, '#f0c040'); cg.addColorStop(0.5, '#b07800'); cg.addColorStop(1, '#f0c040');
        c.fillStyle = cg;
        roundRect(c, -cw * 0.2, -cw / 2, len + cw * 0.3, cw, cw * 0.3); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(c, 0, -cw * 0.28, len, cw * 0.56, cw * 0.25); c.fill();
        c.restore();
        c.fillStyle = '#2a1a40';
        c.beginPath(); c.arc(h.x, h.y, cw * 0.55, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ffd23f'; c.lineWidth = 3;
        c.stroke();
        // トレイ
        c.fillStyle = '#c0182f';
        c.beginPath(); c.ellipse(tr.x, tr.y + cw * 0.35, cw * 0.95, cw * 0.4, 0, 0, Math.PI * 2); c.fill();

        // ころがる 玉
        if (exitBall) {
            const e = exitBall;
            // すべり台に 出たら すこしずつ 大きく 見せる
            const grow = e.landed ? 1.5 : 1.25 + 0.25 * Math.max(0, Math.min(1, e.s / e.len));
            drawBall(c, e.x, e.y, e.r * grow, chosen, e.spin, true);
        }

        // まんなかの 軸と ハンドル
        c.fillStyle = '#ffd23f';
        c.beginPath(); c.arc(gx, gy, R * 0.1, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#b07800';
        c.beginPath(); c.arc(gx, gy, R * 0.05, 0, Math.PI * 2); c.fill();
        const ha = ang * 1.0 - Math.PI / 4;
        const hx = gx + Math.cos(ha) * R * 1.12, hy = gy + Math.sin(ha) * R * 1.12;
        c.strokeStyle = '#e8b400'; c.lineWidth = Math.max(5, R * 0.06); c.lineCap = 'round';
        c.beginPath(); c.moveTo(gx, gy); c.lineTo(hx, hy); c.stroke();
        const kg = c.createRadialGradient(hx - R * 0.03, hy - R * 0.03, 1, hx, hy, R * 0.1);
        kg.addColorStop(0, '#ff8aa0'); kg.addColorStop(1, '#b0001e');
        c.fillStyle = kg;
        c.beginPath(); c.arc(hx, hy, R * 0.09, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    function drawBall(c, x, y, r, it, spin, glow) {
        if (!it) return;
        if (glow) {
            const gg = c.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
            gg.addColorStop(0, 'rgba(255,240,150,0.7)'); gg.addColorStop(1, 'rgba(255,240,150,0)');
            c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
        }
        const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, it.color); g.addColorStop(1, shadeOf(it.color));
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        if (r * dpr < 9) return;
        // 白い まる と 文字（すこし まわる）
        c.save();
        c.translate(x, y); c.rotate(Math.sin(spin || 0) * 0.5);
        c.fillStyle = 'rgba(255,255,255,0.92)';
        c.beginPath(); c.arc(0, 0, r * 0.62, 0, Math.PI * 2); c.fill();
        const t = String(it.v);
        const ch = Array.from(t);
        const shown = ch.length > 3 ? ch.slice(0, 2).join('') + '…' : t;
        const fs = r * (Array.from(shown).length <= 1 ? 0.85 : Array.from(shown).length === 2 ? 0.72 : 0.52);
        c.fillStyle = '#1d1d35';
        c.font = `${Math.round(fs)}px "Mochiy Pop One","M PLUS Rounded 1c",sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(shown, 0, r * 0.04);
        c.restore();
    }
    function shadeOf(hex) {
        if (hex[0] !== '#') return hex;
        const n = parseInt(hex.slice(1), 16);
        const f = v => Math.round(v * 0.55);
        return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }
    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    }

    function loop() {
        cancelAnimationFrame(raf);
        lastT = performance.now();
        const step = t => {
            const dt = Math.min(0.033, (t - lastT) / 1000);
            lastT = t;
            update(dt);
            draw();
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    root.Kuji.register('bingo', {
        title: 'ビンゴ', emoji: 'crystal-ball',
        init, enter, leave, onSheetOpen, onSheetClose, redraw: draw,
    });
})(window);
