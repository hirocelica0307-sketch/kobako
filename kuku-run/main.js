/* 九九ラン ── ゲームの すすみかた
   画面の きりかえ・ゲートに 問題を はる・正解かどうか・いのち・はやさ・きろくを あつかいます。
   3D の 見た目は world3d.js、きまりの 計算は logic.js。
   授業で ひとりずつ しずかに つかう ため、音は いっさい 出しません。 */
(function () {
    'use strict';
    const L = window.KukuRunLogic, W = window.KukuRunWorld;
    const $ = id => document.getElementById(id);

    /* ---------- 大きさ・はやさ ---------- */
    const KMH_TO_U = 0.16;       /* km/h → 1びょうに すすむ 長さ（表示用） */
    const GATE_GAP = 64;         /* ゲートと ゲートの あいだ */
    const FIRST_Z = -66;         /* さいしょの ゲート */
    const RECYCLE_Z = 14;        /* カメラの うしろへ ぬけたら つかいまわす */
    const MISS_SLOW = 1.3;       /* まちがえた あと ゆっくりに なる びょう数 */
    const MISS_SHOW = 2.4;       /* 正しい 九九を 見せる びょう数 */

    /* ---------- きろく（この 端末の ブラウザだけ） ---------- */
    const STORE = 'kuku-run-v1';
    const saved = (() => {
        let o = {};
        try { o = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { o = {}; }
        return { settings: L.sanitizeSettings(o.settings), best: L.sanitizeBest(o.best), stats: L.sanitizeStats(o.stats) };
    })();
    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) { /* ほぞん できなくても あそべる */ }
    }
    const st = saved.settings;

    /* ---------- 3D ---------- */
    let world = null;
    try {
        world = W.createWorld($('world'), { lite: st.lite });
    } catch (e) {
        $('noGL').hidden = false;
        $('startBtn').disabled = true;
    }

    /* ---------- 画面 ---------- */
    let scr = 'menu';
    function setScreen(s) {
        scr = s;
        document.body.dataset.scr = s === 'count' ? 'play' : s;
    }

    /* ======================================================================
       はじめの 画面
       ====================================================================== */
    function bestText(courseId) {
        const v = saved.best[courseId];
        return v ? `ベスト ${v}れんぞく` : '';
    }

    function buildCourses() {
        const box = $('courses');
        box.textContent = '';
        for (const c of L.COURSES) {
            const b = document.createElement('button');
            b.dataset.id = c.id;
            b.className = c.id === 'zenbu' ? 'wide' : c.dans.length > 1 ? 'half' : '';
            b.innerHTML = '<span></span><small></small>';
            b.firstChild.textContent = c.id === 'zenbu' ? 'ぜんぶ（1〜9のだん まぜこぜ）' : c.name;
            b.addEventListener('click', () => { st.course = c.id; save(); refreshMenu(); });
            box.appendChild(b);
        }
    }

    function refreshMenu() {
        document.querySelectorAll('#courses button').forEach(b => {
            b.classList.toggle('sel', b.dataset.id === st.course);
            b.lastChild.textContent = bestText(b.dataset.id) || ' ';
        });
        document.querySelectorAll('.seg').forEach(seg => {
            const key = seg.dataset.key;
            seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', String(st[key]) === b.dataset.v));
        });
        const course = L.courseById(st.course);
        $('bestLine').textContent = `${course.name}　${bestText(st.course) || 'まだ きろく なし'}`;
        const weak = L.weakList(saved.stats, 9);
        $('nigateBtn').hidden = weak.length === 0;
        $('nigateList').textContent = weak.map(w => `${w.a}×${w.b}`).join('・');
    }

    document.querySelectorAll('.seg').forEach(seg => {
        seg.addEventListener('click', ev => {
            const b = ev.target.closest('button');
            if (!b) return;
            const key = seg.dataset.key;
            let v = b.dataset.v;
            if (v === 'true' || v === 'false') v = v === 'true';
            st[key] = v;
            if (key === 'lite' && world) world.setLite(st.lite);
            save();
            refreshMenu();
        });
    });

    $('startBtn').addEventListener('click', () => startRun(null));
    $('nigateBtn').addEventListener('click', () => {
        startRun(L.weakList(saved.stats, 9).map(w => ({ a: w.a, b: w.b })));
    });
    $('resetBtn').addEventListener('click', () => {
        if (!window.confirm('ベストと にがての きろくを けしますか？')) return;
        saved.best = {}; saved.stats = {};
        save();
        refreshMenu();
    });

    /* ======================================================================
       あそぶ
       ====================================================================== */
    let R = null;            /* いまの あそびの ようす */
    let curGate = null;      /* いちばん ちかい まだ とおって いない ゲート */

    function startRun(nigateList) {
        if (!world) return;
        const course = L.courseById(st.course);
        let problems, required = null, nigate = false;
        if (nigateList && nigateList.length) {
            nigate = true;
            required = nigateList;
            const dans = Array.from(new Set(nigateList.map(p => p.a))).sort();
            problems = L.problemsOf({ dans });
        } else {
            problems = L.problemsOf(course);
        }
        R = {
            nigate, course, nigateList: nigateList || null,
            deck: L.createDeck({ problems, stats: saved.stats, required }),
            lives: L.LIVES,
            combo: 0, maxCombo: 0, correct: 0, total: 0, wrongs: [],
            runT: 0,            /* さいごに まちがえてから 走った 時間（はやさは これで きまる） */
            playT: 0,           /* ぜんぶで 走った 時間 */
            kmh: 0, maxKmh: 0,
            slow: 0, missShow: 0,
            ended: false, endTimer: 0, countT: 0, countStep: -1,
        };
        world.reset();
        world.setLanes(L.PANELS);
        world.resize();
        for (let i = 0; i < world.gates.length; i++) assignGate(world.gates[i], FIRST_Z - i * GATE_GAP);
        curGate = null;
        refreshCurrent();
        updateHud();
        updateButtons();
        lastKmhShown = -1;
        $('hSpeed').firstElementChild.textContent = 0;
        setScreen('count');
    }

    function assignGate(g, z) {
        const q = R.deck.next();
        if (!q) { world.hideGate(g); return; }
        const c = L.choicesFor(q.a, q.b, world.laneCount);
        world.assignGate(g, q, c.answers, c.correct, z);
    }

    /** いま こたえる ゲート（まだ とおって いない うちで いちばん ちかい） */
    function nearestGate() {
        let best = null;
        for (const g of world.gates) if (g.active && !g.resolved && (!best || g.z > best.z)) best = g;
        return best;
    }

    function refreshCurrent() {
        const g = nearestGate();
        if (g === curGate) return;
        curGate = g;
        const qb = $('qbox');
        if (!g) { $('qText').textContent = ''; qb.classList.remove('review'); return; }
        $('qText').textContent = `${g.q.a} × ${g.q.b} = ?`;
        qb.classList.toggle('review', !!g.q.review);
    }

    /* ---------- 表示 ---------- */
    let lastKmhShown = -1;
    function updateHud() {
        $('hLife').textContent = 'のこり ' + '♥'.repeat(Math.max(0, R.lives)) + '♡'.repeat(Math.max(0, L.LIVES - R.lives));
        const sc = $('hScore');
        if (R.nigate) {
            sc.firstChild.textContent = 'あと ';
            sc.lastElementChild.textContent = `${R.deck.left()}こ`;
        } else {
            sc.firstChild.textContent = 'せいかい ';
            sc.lastElementChild.textContent = R.correct;
        }
        $('combo').textContent = R.combo >= 2 ? `${R.combo} れんぞく！` : '';
    }
    function updateSpeedText() {
        const k = Math.round(R.kmh);
        if (k !== lastKmhShown) {
            lastKmhShown = k;
            $('hSpeed').firstElementChild.textContent = k;
        }
    }
    function updateButtons() {
        const l = world.lane;
        $('btnL').classList.toggle('on', l === 0);
        $('btnR').classList.toggle('on', l === world.laneCount - 1);
    }

    function pop(el, text, color) {
        el.textContent = text;
        el.style.color = color || '';
        el.animate([
            { opacity: 0, transform: 'scale(.6)' },
            { opacity: 1, transform: 'scale(1.12)', offset: 0.18 },
            { opacity: 1, transform: 'scale(1)', offset: 0.7 },
            { opacity: 0, transform: 'scale(1)' },
        ], { duration: 800, easing: 'ease-out' });
    }

    function flash(id, peak, ms) {
        $(id).animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
    }

    function showMiss(q) {
        const box = $('missBox');
        box.querySelector('.mx').textContent = `${q.a} × ${q.b} = ${q.ans}`;
        box.querySelector('.my').textContent = L.kukuReading(q.a, q.b);
        box.animate([
            { opacity: 0, transform: 'translateX(-50%) scale(.7)' },
            { opacity: 1, transform: 'translateX(-50%) scale(1.06)', offset: 0.1 },
            { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.85 },
            { opacity: 0, transform: 'translateX(-50%) scale(1)' },
        ], { duration: MISS_SHOW * 1000, easing: 'ease-out' });
    }

    /* ---------- うごかす ---------- */
    function move(d) {
        if (!(scr === 'play' || scr === 'count') || !R || R.ended) return;
        world.setLane(world.lane + d);
        updateButtons();
    }

    /* ---------- ゲートを とおった ---------- */
    function resolve(g) {
        g.resolved = true;
        if (R.ended) return;
        const q = g.q;
        const lane = world.lane;
        const ok = lane === g.correct;
        R.deck.report(q, ok);
        R.total++;
        const s = saved.stats[q.key] || (saved.stats[q.key] = { ok: 0, ng: 0 });
        if (ok) {
            s.ok++;
            R.combo++;
            R.correct++;
            R.maxCombo = Math.max(R.maxCombo, R.combo);
            world.breakPanel(g, lane, true);
            if (R.missShow <= 0) pop($('praise'), q.review ? 'おぼえたね！' : L.praiseOf(R.combo), q.review ? '#ffd1e3' : '');
            if (L.isFlash(R.combo)) flash('flash', 0.6, 450);
        } else {
            s.ng++;
            R.combo = 0;
            R.wrongs.push({ a: q.a, b: q.b, ans: q.ans, key: q.key });
            world.breakPanel(g, lane, false);
            world.showCorrect(g);
            world.crash();
            R.runT = 0;                 /* また ゆっくりから */
            R.slow = MISS_SLOW;
            R.missShow = MISS_SHOW;
            showMiss(q);
            flash('redflash', 1, 600);
            R.lives--;
            if (R.lives <= 0) { R.ended = true; R.endTimer = 2.2; }
        }
        if (R.nigate && R.deck.done()) { R.ended = true; R.endTimer = 1.2; }
        updateHud();
        refreshCurrent();
    }

    function recycle(g) {
        let minZ = Infinity;
        for (const o of world.gates) if (o !== g && o.active) minZ = Math.min(minZ, o.z);
        const z = isFinite(minZ) ? minZ - GATE_GAP : FIRST_Z;
        if (R.ended) { world.hideGate(g); return; }
        assignGate(g, z);
        refreshCurrent();
    }

    /* ---------- まいフレーム ---------- */
    function updatePlay(dt) {
        let k = 1;
        if (R.slow > 0) { R.slow -= dt; k = 0.35; }
        else if (!R.ended) R.runT += dt;     /* まちがえた あとの ゆっくりの 間は 時間を すすめない */
        if (R.ended) k = 0.25;
        if (R.missShow > 0) R.missShow -= dt;
        R.playT += dt;
        const u = L.speedAt(R.runT, GATE_GAP);
        R.kmh = u / KMH_TO_U;
        R.maxKmh = Math.max(R.maxKmh, R.kmh);
        world.step(dt, u * k, Math.min(1, Math.max(0, (R.kmh - 100) / 450)));
        for (const g of world.gates) if (g.active && !g.resolved && g.z >= 0) resolve(g);
        for (const g of world.gates) if (g.active && g.resolved && g.z > RECYCLE_Z) recycle(g);
        updateSpeedText();
        if (R.ended) {
            R.endTimer -= dt;
            if (R.endTimer <= 0) finish();
        }
    }

    const COUNT_WORDS = ['3', '2', '1', 'GO!'];
    function updateCount(dt) {
        R.countT += dt;
        const i = Math.floor(R.countT / 0.7);
        if (i !== R.countStep && i < COUNT_WORDS.length) {
            R.countStep = i;
            const el = $('count');
            el.textContent = COUNT_WORDS[i];
            el.animate([
                { opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.25 }, { opacity: 0, transform: 'scale(.9)' },
            ], { duration: 680, easing: 'ease-out' });
            if (i === 3) setScreen('play');
        }
        world.step(dt, 0, 0);
    }

    let last = 0, menuTick = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (!world) return;
        let dt = last ? (now - last) / 1000 : 0;
        last = now;
        if (dt > 0.05) dt = 0.05;
        if (dt < 0) dt = 0;
        if (scr === 'menu' || scr === 'result') {
            /* うしろで ゆっくり 走る（30コマで かるく） */
            menuTick += dt;
            if (menuTick < 1 / 30) return;
            world.step(menuTick, 9, 0);
            world.render(0);
            menuTick = 0;
            return;
        }
        if (scr === 'pause') return;
        if (scr === 'count') updateCount(dt);
        else if (scr === 'play') updatePlay(dt);
        world.render(dt);
    }
    requestAnimationFrame(frame);

    /* ======================================================================
       おしまい
       ====================================================================== */
    function finish() {
        if (!R || scr === 'result') return;
        const cleared = R.nigate && R.deck.done();
        let title = 'おしまい！', num = R.maxCombo, unit = 'れんぞく', key = null;
        if (R.nigate) { title = cleared ? 'にがて クリア！' : 'おしまい！'; num = R.correct; unit = 'もん せいかい'; }
        else key = R.course.id;
        let isNew = false;
        if (key) {
            const old = saved.best[key] || 0;
            if (num > old) { saved.best[key] = num; isNew = old > 0 || num >= 3; }
        }
        save();

        $('rTitle').textContent = title;
        $('rNum').textContent = num;
        $('rUnit').textContent = unit;
        const name = R.nigate ? 'にがて れんしゅう' : R.course.name;
        $('rStats').innerHTML = '<span></span><br><span></span>';
        $('rStats').firstChild.textContent = `${name}　せいかい ${R.correct}もん ／ ${R.total}もん`;
        $('rStats').lastChild.textContent = `${Math.round(R.playT)}びょう 走った　さいこう ${Math.round(R.maxKmh)}km/h`;
        const rb = $('rBest');
        if (key) {
            rb.textContent = isNew ? 'しんきろく！' : `ベスト ${saved.best[key] || 0} れんぞく`;
            rb.classList.toggle('new', isNew);
        } else {
            rb.textContent = cleared ? 'まちがえた 九九を ぜんぶ 2かい せいかい できたよ！' : '';
            rb.classList.toggle('new', cleared);
        }

        /* おさらい（まちがえた 九九。おなじ ものは 1つに） */
        const uniq = [];
        for (const w of R.wrongs) if (!uniq.some(u => u.key === w.key)) uniq.push(w);
        R.uniqWrongs = uniq;
        const chips = $('rChips');
        chips.textContent = '';
        const rv = $('rReview');
        rv.classList.toggle('none', uniq.length === 0);
        rv.querySelector('h3').textContent = uniq.length ? 'おさらい（まちがえた 九九）' : 'まちがい なし！ すごい！';
        for (const w of uniq) {
            const b = document.createElement('div');
            b.className = 'chip';
            b.innerHTML = '<b></b><small></small>';
            b.firstChild.textContent = `${w.a}×${w.b}=${w.ans}`;
            b.lastChild.textContent = L.kukuReading(w.a, w.b);
            chips.appendChild(b);
        }
        $('practiceBtn').hidden = uniq.length === 0;
        setScreen('result');
        world.reset();
        refreshMenu();
    }

    $('againBtn').addEventListener('click', () => startRun(R && R.nigate ? R.nigateList : null));
    $('practiceBtn').addEventListener('click', () => {
        if (R && R.uniqWrongs && R.uniqWrongs.length) startRun(R.uniqWrongs.map(w => ({ a: w.a, b: w.b })));
    });
    $('menuBtn').addEventListener('click', () => { setScreen('menu'); refreshMenu(); });

    /* ---------- ひとやすみ ---------- */
    let pausedFrom = 'play';
    function pause() {
        if (scr !== 'play' && scr !== 'count') return;
        pausedFrom = scr;
        setScreen('pause');
    }
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', () => { last = 0; setScreen(pausedFrom); });
    $('quitBtn').addEventListener('click', () => { R.ended = true; scr = 'play'; finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

    /* ---------- そうさ ---------- */
    function bindPress(el, d) {
        el.addEventListener('pointerdown', ev => { ev.preventDefault(); move(d); });
    }
    bindPress($('btnL'), -1);
    bindPress($('btnR'), 1);
    window.addEventListener('keydown', ev => {
        if (ev.repeat) return;
        const k = ev.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { move(-1); ev.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { move(1); ev.preventDefault(); }
        else if (k === 'Escape' || k === 'p') pause();
        else if ((k === 'Enter' || k === ' ') && scr === 'menu' && document.activeElement === document.body) startRun(null);
    });
    /* スワイプ（画面を 左右に なでる） */
    let sx = null, sy = null;
    const surface = $('world');
    surface.addEventListener('pointerdown', ev => { sx = ev.clientX; sy = ev.clientY; });
    surface.addEventListener('pointerup', ev => {
        if (sx == null) return;
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        sx = null;
        if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    });

    window.addEventListener('resize', () => { if (world) world.resize(); });

    /* 字の かたちが 読みこまれたら、ゲートの 字の 絵を 1回だけ かきなおす（はじめの 画面の うちに） */
    if (document.fonts && document.fonts.load && world) {
        document.fonts.load('800 80px "M PLUS Rounded 1c"').then(f => { if (f && f.length && scr === 'menu') world.refreshGlyphs(); }).catch(() => {});
    }

    /* たしかめ用（テストの 自動プレイで つかう。ゲームは かわらない） */
    window.KukuRunPeek = () => (R ? {
        scr, lane: world.lane, lanes: world.laneCount,
        gate: curGate ? { a: curGate.q.a, b: curGate.q.b, correct: curGate.correct, z: curGate.z, review: curGate.q.review } : null,
        combo: R.combo, correct: R.correct, lives: R.lives, kmh: R.kmh, runT: R.runT, pixelRatio: world.pixelRatio,
    } : { scr });

    buildCourses();
    refreshMenu();
})();
