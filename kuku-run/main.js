/* 九九ラン ── ゲームの すすみかた
   画面の きりかえ・ゲートに 問題を はる・正解かどうか・いのち・はやさ・きろくを あつかいます。
   3D の 見た目は world3d.js、きまりの 計算は logic.js、音は sound.js。 */
(function () {
    'use strict';
    const L = window.KukuRunLogic, S = window.KukuRunSound, W = window.KukuRunWorld;
    const $ = id => document.getElementById(id);

    /* ---------- 大きさ・はやさ ---------- */
    const KMH_TO_U = 0.16;       /* km/h → 1びょうに すすむ 長さ */
    const GATE_GAP = 64;         /* ゲートと ゲートの あいだ */
    const FIRST_Z = -66;         /* さいしょの ゲート */
    const RECYCLE_Z = 14;        /* カメラの うしろへ ぬけたら つかいまわす */
    const ACCEL = 150;           /* 1びょうで ふえる km/h（ぐんぐん 速く なる 感じ） */
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
    S.setSound(st.sound);
    S.setVoice(st.voice);

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
    function bestText(courseId, mode) {
        const v = saved.best[L.bestKey(courseId, mode)];
        if (!v) return '';
        return mode === 'time' ? `ベスト ${v}もん` : `ベスト ${v}れんぞく`;
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
            b.lastChild.textContent = bestText(c.id, st.mode) || ' ';
            b.addEventListener('click', () => { st.course = c.id; save(); refreshMenu(); });
            box.appendChild(b);
        }
    }

    function refreshMenu() {
        document.querySelectorAll('#courses button').forEach(b => {
            b.classList.toggle('sel', b.dataset.id === st.course);
            b.lastChild.textContent = bestText(b.dataset.id, st.mode) || ' ';
        });
        document.querySelectorAll('.seg').forEach(seg => {
            const key = seg.dataset.key;
            seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', String(st[key]) === b.dataset.v));
        });
        document.body.classList.toggle('timeMode', st.mode === 'time');
        const course = L.courseById(st.course);
        const bt = bestText(st.course, st.mode);
        $('bestLine').textContent = `${course.name}${st.mode === 'time' ? '・タイムアタック' : ''}　${bt || 'まだ きろく なし'}`;
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
            else if (/^\d+$/.test(v)) v = Number(v);
            st[key] = v;
            S.setSound(st.sound);
            S.setVoice(st.voice);
            if (key === 'lite' && world) world.setLite(st.lite);
            if (key === 'voice' && st.voice) { S.unlock(); S.speak('しちし'); }
            save();
            refreshMenu();
        });
    });

    $('startBtn').addEventListener('click', () => { S.unlock(); startRun(null); });
    $('nigateBtn').addEventListener('click', () => {
        S.unlock();
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
        const cfg = L.speedOf(st.speed);
        let problems, required = null, mode = st.mode;
        if (nigateList && nigateList.length) {
            mode = 'nigate';
            required = nigateList;
            const dans = Array.from(new Set(nigateList.map(p => p.a))).sort();
            problems = L.problemsOf({ dans });
        } else {
            problems = L.problemsOf(course);
        }
        R = {
            mode, course, cfg, nigateList: nigateList || null,
            deck: L.createDeck({ problems, stats: saved.stats, required }),
            lives: st.miss, maxLives: st.miss,
            combo: 0, maxCombo: 0, correct: 0, total: 0, wrongs: [],
            kmh: 0, targetKmh: 0, maxKmh: 0,
            timeLeft: L.TIME_LIMIT,
            slow: 0, missShow: 0, speakWait: 0, pendingSpeak: '',
            ended: false, endTimer: 0, countT: 0, countStep: -1,
        };
        S.hush();
        world.reset();
        world.setLanes(st.panels);
        world.resize();
        for (let i = 0; i < world.gates.length; i++) assignGate(world.gates[i], FIRST_Z - i * GATE_GAP);
        curGate = null;
        refreshCurrent();
        updateHud(true);
        updateButtons();
        $('praise').style.opacity = 0;
        $('missBox').style.opacity = 0;
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
        $('qText').animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
        const text = L.kukuQuestionPart(g.q.a, g.q.b);
        if (R.speakWait > 0) R.pendingSpeak = text;
        else S.speak(text, 1.15);
    }

    /* ---------- 表示 ---------- */
    let lastKmhShown = -1;
    function updateHud(force) {
        const life = $('hLife');
        if (R.mode === 'renzoku') {
            life.textContent = 'のこり ' + '♥'.repeat(Math.max(0, R.lives)) + '♡'.repeat(Math.max(0, R.maxLives - R.lives));
        } else if (R.mode === 'time') {
            life.textContent = `のこり ${Math.max(0, Math.ceil(R.timeLeft))}びょう`;
        } else {
            life.textContent = `のこり ${R.deck.left()}もん`;
        }
        $('hScore').lastElementChild.textContent = R.correct;
        $('combo').textContent = R.combo >= 2 ? `${R.combo} れんぞく！` : '';
        if (force) lastKmhShown = -1;
    }
    function updateSpeedText() {
        const k = Math.round(R.kmh);
        if (k !== lastKmhShown) {
            lastKmhShown = k;
            $('hSpeed').firstElementChild.textContent = k;
        }
    }
    function updateButtons() {
        const n = world.laneCount, l = world.lane;
        $('btnL').classList.toggle('on', l === 0 && n > 1);
        $('btnR').classList.toggle('on', l === n - 1 && n > 1);
    }

    function pop(el, text, color) {
        el.textContent = text;
        if (color) el.style.color = color; else el.style.color = '';
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
        const before = world.lane;
        world.setLane(before + d);
        if (world.lane !== before) S.sfx.move();
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
            R.targetKmh = L.speedUp(R.targetKmh, R.cfg);
            if (R.missShow <= 0) pop($('praise'), q.review ? 'おぼえたね！' : L.praiseOf(R.combo), q.review ? '#ffd1e3' : '');
            S.sfx.good(R.combo);
            if (L.isFlash(R.combo)) { flash('flash', 0.6, 450); S.sfx.flash(); }
        } else {
            s.ng++;
            R.combo = 0;
            R.wrongs.push({ a: q.a, b: q.b, ans: q.ans, key: q.key });
            world.breakPanel(g, lane, false);
            world.showCorrect(g);
            world.crash();
            R.kmh = Math.min(R.kmh, R.cfg.start * 0.5);
            R.targetKmh = R.cfg.start;
            R.slow = MISS_SLOW;
            R.missShow = MISS_SHOW;
            showMiss(q);
            flash('redflash', 1, 600);
            S.sfx.miss();
            /* 正しい となえかたを よむ。つぎの 問題の よみあげは その あと */
            S.speak(L.kukuReading(q.a, q.b), 0.95);
            R.speakWait = 2.0;
            if (R.mode === 'renzoku') {
                R.lives--;
                if (R.lives <= 0) { R.ended = true; R.endTimer = 2.2; }
            }
        }
        if (R.mode === 'nigate' && R.deck.done()) { R.ended = true; R.endTimer = 1.2; }
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
        if (R.kmh < R.targetKmh) R.kmh = Math.min(R.targetKmh, R.kmh + ACCEL * dt);
        else R.kmh = R.targetKmh;
        R.maxKmh = Math.max(R.maxKmh, R.kmh);
        let k = 1;
        if (R.slow > 0) { R.slow -= dt; k = 0.35; }
        if (R.ended) k = 0.25;
        if (R.missShow > 0) R.missShow -= dt;
        if (R.speakWait > 0) {
            R.speakWait -= dt;
            if (R.speakWait <= 0 && R.pendingSpeak) {
                if (curGate && L.kukuQuestionPart(curGate.q.a, curGate.q.b) === R.pendingSpeak) S.speak(R.pendingSpeak, 1.15);
                R.pendingSpeak = '';
            }
        }
        world.step(dt, R.kmh * KMH_TO_U * k, Math.min(1, R.kmh / 460));
        for (const g of world.gates) if (g.active && !g.resolved && g.z >= 0) resolve(g);
        for (const g of world.gates) if (g.active && g.resolved && g.z > RECYCLE_Z) recycle(g);
        updateSpeedText();
        if (R.mode === 'time' && !R.ended) {
            const before = Math.ceil(R.timeLeft);
            R.timeLeft -= dt;
            if (Math.ceil(R.timeLeft) !== before) updateHud();
            if (R.timeLeft <= 0) { R.timeLeft = 0; R.ended = true; R.endTimer = 0.6; updateHud(); }
        }
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
            if (i < 3) S.sfx.count(); else S.sfx.go();
            if (i === 3) {
                R.targetKmh = R.cfg.start;
                setScreen('play');
            }
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
        S.hush();
        let title = 'おしまい！', num = R.maxCombo, unit = 'れんぞく', key = null;
        if (R.mode === 'time') { title = 'タイムアップ！'; num = R.correct; unit = 'もん せいかい'; key = L.bestKey(R.course.id, 'time'); }
        else if (R.mode === 'renzoku') key = L.bestKey(R.course.id, 'renzoku');
        else { title = R.deck.done() ? 'にがて クリア！' : 'おしまい！'; num = R.correct; unit = 'もん せいかい'; }
        let isNew = false;
        if (key) {
            const old = saved.best[key] || 0;
            if (num > old) { saved.best[key] = num; isNew = old > 0 || num >= 3; }
        }
        save();

        $('rTitle').textContent = title;
        $('rNum').textContent = num;
        $('rUnit').textContent = unit;
        const name = R.mode === 'nigate' ? 'にがて れんしゅう' : R.course.name;
        $('rStats').innerHTML = '<span></span><br><span></span>';
        $('rStats').firstChild.textContent = `${name}　せいかい ${R.correct}もん ／ ${R.total}もん`;
        $('rStats').lastChild.textContent = `さいこう ${Math.round(R.maxKmh)}km/h`;
        const rb = $('rBest');
        if (key) {
            rb.textContent = isNew ? 'しんきろく！' : `ベスト ${saved.best[key] || 0}${R.mode === 'time' ? 'もん' : ' れんぞく'}`;
            rb.classList.toggle('new', isNew);
        } else {
            rb.textContent = R.deck.done() ? 'まちがえた 九九を ぜんぶ 2かい せいかい できたよ！' : '';
            rb.classList.toggle('new', R.deck.done());
        }

        /* おさらい（まちがえた 九九。おなじ ものは 1つに） */
        const uniq = [];
        for (const w of R.wrongs) if (!uniq.some(u => u.key === w.key)) uniq.push(w);
        R.uniqWrongs = uniq;
        const chips = $('rChips');
        chips.textContent = '';
        const rv = $('rReview');
        rv.classList.toggle('none', uniq.length === 0);
        rv.querySelector('h3').firstChild.textContent = uniq.length ? 'おさらい ' : 'まちがい なし！ すごい！';
        rv.querySelector('h3 small').hidden = uniq.length === 0;
        for (const w of uniq) {
            const b = document.createElement('button');
            b.innerHTML = '<b></b><small></small>';
            b.firstChild.textContent = `${w.a}×${w.b}=${w.ans}`;
            b.lastChild.textContent = L.kukuReading(w.a, w.b);
            b.addEventListener('click', () => { S.unlock(); S.speak(L.kukuReading(w.a, w.b), 0.95); });
            chips.appendChild(b);
        }
        $('practiceBtn').hidden = uniq.length === 0;
        setScreen('result');
        if (R.mode === 'nigate' && R.deck.done()) S.sfx.clear(); else S.sfx.end();
        world.reset();
        buildCourses();
        refreshMenu();
    }

    $('againBtn').addEventListener('click', () => { S.unlock(); startRun(R && R.mode === 'nigate' ? R.nigateList : null); });
    $('practiceBtn').addEventListener('click', () => {
        S.unlock();
        if (R && R.uniqWrongs && R.uniqWrongs.length) startRun(R.uniqWrongs.map(w => ({ a: w.a, b: w.b })));
    });
    $('menuBtn').addEventListener('click', () => { S.hush(); setScreen('menu'); refreshMenu(); });

    /* ---------- ひとやすみ ---------- */
    let pausedFrom = 'play';
    function pause() {
        if (scr !== 'play' && scr !== 'count') return;
        pausedFrom = scr;
        S.hush();
        setScreen('pause');
    }
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', () => { last = 0; setScreen(pausedFrom); });
    $('quitBtn').addEventListener('click', () => { R.ended = true; scr = 'play'; finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

    /* ---------- そうさ ---------- */
    function bindHold(el, d) {
        el.addEventListener('pointerdown', ev => { ev.preventDefault(); S.unlock(); move(d); });
    }
    bindHold($('btnL'), -1);
    bindHold($('btnR'), 1);
    window.addEventListener('keydown', ev => {
        if (ev.repeat) return;
        const k = ev.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { move(-1); ev.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { move(1); ev.preventDefault(); }
        else if (k === 'Escape' || k === 'p') pause();
        else if ((k === 'Enter' || k === ' ') && scr === 'menu' && document.activeElement === document.body) { S.unlock(); startRun(null); }
    });
    /* スワイプ（画面を 左右に なでる） */
    let sx = null, sy = null;
    const surface = $('world');
    surface.addEventListener('pointerdown', ev => { sx = ev.clientX; sy = ev.clientY; S.unlock(); });
    surface.addEventListener('pointerup', ev => {
        if (sx == null) return;
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        sx = null;
        if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    });

    window.addEventListener('resize', () => { if (world) world.resize(); });

    /* 字の かたちが 読みこまれたら、パネルの 字も その かたちで かく */
    if (document.fonts && document.fonts.load) {
        document.fonts.load('800 80px "M PLUS Rounded 1c"').catch(() => {});
    }

    /* たしかめ用（テストの 自動プレイで つかう。ゲームは かわらない） */
    window.KukuRunPeek = () => (R ? {
        scr, lane: world.lane, lanes: world.laneCount,
        gate: curGate ? { a: curGate.q.a, b: curGate.q.b, correct: curGate.correct, z: curGate.z, review: curGate.q.review } : null,
        combo: R.combo, correct: R.correct, lives: R.lives, kmh: R.kmh, pixelRatio: world.pixelRatio,
    } : { scr });

    buildCourses();
    refreshMenu();
})();
