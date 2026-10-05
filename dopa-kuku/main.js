/* ドパ九九 ── ゲームの しくみ（画面の 切りかえ・出題・はんてい・制限時間・きろく・せってい）
   ------------------------------------------------------------------
   演出は ここには 書きません。できごとを Dopa.bus で 知らせるだけです。
   effects.js が それを うけとって、光・音・紙吹雪を 出します
   （effects.js を 読みこまなくても ゲームは さいごまで 遊べます）。

   できごと（なまえ ─ なかみ）
     screen    { id }                     画面が かわった（title / course / play / over / set）
     settings  { set, fx }                せっていが かわった
     start     { course, limit, best }    カウントダウンの 前
     countdown { text, final }            3・2・1・スタート！
     question  { q, index, hold }         問題を 出した（hold ＝ タイマーを とめる ミリびょう）
     input     { text }                   数字を おした・けした
     correct   { combo, level, prevLevel, q, answer, kakutei, milestone, passBest, best }
     reach     { reach }                  リーチ（つぎの 大演出まで あと 3問 いない）。null で リーチ おわり
     level     { level, prev, combo }     ドパレベルが かわった
     gameover  { reason, q, input, combo, best, newRecord, course, limit, level, reach }
     overShown { gameover と おなじ }      ゲームオーバー画面を 出した
     quit      { combo }                  とちゅうで やめた
   ------------------------------------------------------------------ */
(function () {
    'use strict';
    const L = window.DopaLogic;
    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));
    const Sound = window.DopaSound || null;

    /* ---------- できごと ---------- */
    const handlers = {};
    const bus = {
        on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
        emit(type, data) {
            for (const fn of handlers[type] || []) {
                try { fn(data || {}); } catch (e) { console.error(e); }
            }
        },
    };

    /* ---------- 保存（この 端末の ブラウザ） ---------- */
    const KEY = { best: 'dopakuku_best', miss: 'dopakuku_miss', set: 'dopakuku_settings' };
    function load(k) {
        try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
    }
    function save(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても 遊べる */ }
    }

    const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const store = {
        best: L.sanitizeCounts(load(KEY.best)),     /* { 'zenbu_5': 37, … } */
        miss: L.sanitizeCounts(load(KEY.miss)),     /* { '7x8': 3, … } */
        set: L.sanitizeSettings(load(KEY.set)),
    };
    /** いまの 演出の 強さ。えらんで いなければ 端末の「視差効果を減らす」で きめる */
    const fxMode = () => store.set.fx || (reduceMotion ? 'hikaeme' : 'hade');
    const bestOf = (id, limit) => store.best[L.bestKey(id, limit == null ? store.set.limit : limit)] || 0;

    /* ---------- ゲームの じょうたい ---------- */
    const g = {
        state: 'idle',              /* idle | countdown | play | over */
        course: null, limit: 5, best: 0,
        combo: 0, level: 0, passed: false,
        q: null, input: '', recent: [], index: 0,
        deadline: 0, qTotal: 0, shown: false, toAt: 0,
        raf: 0, toT: 0, timers: [],
        readyAt: 0,                 /* ゲームオーバー画面の ボタンを うけつける 時こく */
    };
    let screen = 'title';
    let setBack = 'title';

    function later(fn, ms) { g.timers.push(setTimeout(fn, ms)); }
    function stopClock() {
        g.timers.forEach(clearTimeout);
        g.timers = [];
        cancelAnimationFrame(g.raf);
        clearTimeout(g.toT);
    }

    /* =====================================================================
       画面
       ===================================================================== */
    const SCR = { title: '#scrTitle', course: '#scrCourse', play: '#scrPlay', over: '#scrOver', set: '#scrSet' };

    function show(id) {
        screen = id;
        for (const k of Object.keys(SCR)) $(SCR[k]).hidden = k !== id;
        document.body.dataset.scr = id;
        if (id === 'title') renderTitle();
        if (id === 'course') renderCourses();
        if (id === 'set') renderSet();
        bus.emit('screen', { id });
    }

    /* 画面A：タイトル */
    function renderTitle() {
        $('#catch').textContent = `1もん ${store.set.limit}びょう いないに こたえつづけろ！`;
        const b = bestOf('zenbu');
        $('#titleBest').textContent = `ぜんぶコース　さいこう ${b ? b + 'れんぞく' : '―'}`;
    }

    /* 画面B：コースえらび */
    function renderCourses() {
        $('#limitChip').innerHTML = `<span class="wide-only">せいげん </span>⏱ ${store.set.limit}びょう`;
        const btn = c => {
            const b = bestOf(c.id);
            return `<button class="course${c.dans.length > 1 ? ' wide' : ''}" data-act="course" data-id="${c.id}">`
                + `<b>${c.name}${c.sub ? `<span class="sub">${c.sub}</span>` : ''}</b>`
                + `<small>${b ? 'さいこう ' + b : '―'}</small></button>`;
        };
        $('#courses').innerHTML = `<div class="dans">${L.COURSES.filter(c => c.dans.length === 1).map(btn).join('')}</div>`
            + `<div class="mix">${L.COURSES.filter(c => c.dans.length > 1).map(btn).join('')}</div>`;
    }

    /* 画面E：せってい */
    function renderSet() {
        const s = store.set;
        const cur = { limit: String(s.limit), sound: s.sound ? '1' : '0', bgm: s.bgm ? '1' : '0', fx: fxMode() };
        for (const seg of $$('.seg')) {
            for (const b of seg.children) {
                const on = b.dataset.v === cur[seg.dataset.key];
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            }
        }
        const base = '「ひかえめ」は 画面の ゆれと ちかちかを とめて、紙吹雪を 3分の1に します。';
        let note = reduceMotion && !s.fx ? base + '（この 端末は「視差効果を減らす」が オンなので、ひかえめに なっています）' : base;
        let lite = 0;
        try { lite = Number(sessionStorage.getItem('dopakuku_lite')) || 0; } catch (e) { /* なくても よい */ }
        if (lite) note += '　この 端末では 操作が おもく ならない ように、紙吹雪や 背景の うごきを 自動で へらしています。';
        $('#fxNote').textContent = note;
        const top = L.topMiss(store.miss, 5);
        $('#nigate').innerHTML = top.length
            ? top.map(x => `<li>${x.a}×${x.b}<small>${x.n}かい</small></li>`).join('')
            : '<li class="none">まだ ありません</li>';
    }

    function setValue(key, v) {
        const s = store.set;
        if (key === 'limit') s.limit = Number(v);
        else if (key === 'sound') s.sound = v === '1';
        else if (key === 'bgm') s.bgm = v === '1';
        else if (key === 'fx') s.fx = v === 'hikaeme' ? 'hikaeme' : 'hade';
        store.set = L.sanitizeSettings(s);
        save(KEY.set, store.set);
        applySettings();
        renderSet();
    }

    function applySettings() {
        if (Sound) {
            Sound.setSound(store.set.sound);
            Sound.setBgm(store.set.bgm);
        }
        document.body.classList.toggle('calm', fxMode() === 'hikaeme');
        bus.emit('settings', { set: store.set, fx: fxMode() });
    }

    function resetRecords() {
        if (!window.confirm('きろく（さいこう れんぞく・にがてな九九）を ぜんぶ けします。いいですか？')) return;
        store.best = {};
        store.miss = {};
        save(KEY.best, store.best);
        save(KEY.miss, store.miss);
        renderSet();
    }

    /* =====================================================================
       ゲーム
       ===================================================================== */
    function startGame(id) {
        const course = L.courseById(id);
        if (!course) return;
        stopClock();
        Object.assign(g, {
            state: 'countdown', course, limit: store.set.limit,
            combo: 0, level: 0, passed: false, q: null, input: '', recent: [], index: 0,
        });
        g.best = bestOf(course.id, g.limit);
        show('play');
        renderHud();
        $('#qwrap').classList.add('wait');
        renderAns();
        setGauge(1, '');
        bus.emit('start', { course, limit: g.limit, best: g.best });
        bus.emit('reach', { reach: null });

        /* 3・2・1・スタート！（各 0.7びょう）の あと すぐ 1問め */
        const el = $('#countdown');
        const steps = ['3', '2', '1', 'スタート！'];
        steps.forEach((text, i) => later(() => {
            el.hidden = false;
            el.textContent = text;
            el.classList.remove('pop');
            void el.offsetWidth;
            el.classList.add('pop');
            el.classList.toggle('final', i === steps.length - 1);
            bus.emit('countdown', { text, final: i === steps.length - 1 });
        }, i * 700));
        later(() => {
            el.hidden = true;
            g.state = 'play';
            $('#qwrap').classList.remove('wait');
            nextQuestion(0);
            tick();
        }, steps.length * 700);
    }

    function nextQuestion(hold) {
        g.q = L.pickQuestion(g.course, g.recent);
        g.recent.push(L.keyOf(g.q));
        if (g.recent.length > 6) g.recent.shift();
        g.index++;
        g.input = '';
        $('#qa').textContent = g.q.a;
        $('#qb').textContent = g.q.b;
        renderAns();
        /* 問題を 出した しゅんかんから 数える。虹ドパの ときだけ hold ぶん とめる。
           じっさいに 画面に 出た ときに tick() が もう一度 数えなおす（端末が もたついても 子どもが 損を しない） */
        g.qTotal = g.limit * 1000 + (hold || 0);
        g.shown = false;
        setDeadline(performance.now() + g.qTotal);
        bus.emit('question', { q: g.q, index: g.index, hold: hold || 0 });
    }

    /* 時間ぎれを きめる ときの ゆとり（ミリびょう）。押した 時こくが しめきり前なら、
       処理が すこし おくれても 正しく うけつける ため。ゲージは しめきりで 0 に なる */
    const GRACE = 120;

    function setDeadline(t) {
        g.deadline = t;
        clearTimeout(g.toT);
        g.toAt = t + GRACE + 20;
        g.toT = setTimeout(checkTime, g.toAt - performance.now());
    }

    /* のこり時間（ゲージ）。時間は performance.now() で はかり、画面の かきかえとは べつに きめる */
    function tick() {
        cancelAnimationFrame(g.raf);
        let lastT = performance.now();
        const step = () => {
            if (g.state !== 'play') return;
            const now = performance.now();
            const gap = now - lastT;
            lastT = now;
            /* 問題が 画面に 出る この しゅんかんから 数えなおす（おそく なる ほうに だけ） */
            if (!g.shown) {
                g.shown = true;
                if (now + g.qTotal > g.deadline) setDeadline(now + g.qTotal);
            }
            const remain = g.deadline - now;
            /* 画面が 固まって いた 直後（前の コマから 0.1びょう いじょう）は、たまって いる 入力を さきに 処理させる */
            if (remain <= -GRACE && gap < 100) { gameOver('time'); return; }
            setGauge(Math.max(0, Math.min(1, remain / (g.limit * 1000))), remain <= 1000 ? 'danger' : remain <= 2000 ? 'warn' : '');
            g.raf = requestAnimationFrame(step);
        };
        g.raf = requestAnimationFrame(step);
    }

    /* タブが うらに ある ときなど、ゲージが うごかなくても 時間ぎれは きちんと きめる */
    function checkTime() {
        if (g.state !== 'play') return;
        const now = performance.now();
        /* 予定より おくれて 動いた ＝ 画面が 固まって いた。たまって いる 入力を さきに 処理させてから きめる */
        if (now - g.toAt > 50) { g.toAt = now + 30; g.toT = setTimeout(checkTime, 30); return; }
        if (now >= g.deadline + GRACE) gameOver('time');
    }

    let gaugeCls = null;
    function setGauge(frac, cls) {
        $('#gaugeBar').style.transform = `scaleX(${frac})`;
        if (cls === gaugeCls) return;
        gaugeCls = cls;
        const el = $('#gauge');
        el.classList.toggle('warn', cls === 'warn');
        el.classList.toggle('danger', cls === 'danger');
    }

    /** k を 押した。at は 指が ふれた 時こく（イベントの timeStamp）。処理の おくれでは 時間ぎれに しない */
    function press(k, at) {
        if (g.state !== 'play') return;
        const now = performance.now();
        if (!(at > 0 && at <= now + 5)) at = now;
        if (at >= g.deadline) { gameOver('time'); return; }
        if (k === 'del') {
            if (!g.input) return;
            g.input = g.input.slice(0, -1);
            renderAns();
            bus.emit('input', { text: g.input });
            return;
        }
        g.input += k;
        renderAns();
        bus.emit('input', { text: g.input });
        /* 答えの けた数に なった しゅんかんに はんてい（「こたえる」ボタンは ない） */
        const r = L.judge(g.q, g.input);
        if (!r.done) return;
        if (r.ok) correct(); else gameOver('miss');
    }

    function correct() {
        const q = g.q, answer = g.input, prev = g.level;
        g.combo++;
        g.level = L.levelOf(g.combo);
        const kakutei = L.kakuteiOf(g.combo);
        const passBest = !g.passed && g.best > 0 && g.combo > g.best;
        if (passBest) g.passed = true;
        /* さきに つぎの 問題を 出す（演出を またない。虹ドパの ときだけ タイマーを 1.5びょう とめる）。
           演出は その あとで 知らせる（effects.js は 画面が 出てから うごく） */
        nextQuestion(kakutei === 'niji' ? L.NIJI_HOLD : 0);
        renderHud();
        bus.emit('correct', {
            combo: g.combo, level: g.level, prevLevel: prev, q, answer,
            kakutei, milestone: L.isMilestone(g.combo), passBest, best: g.best,
        });
        if (g.level !== prev) bus.emit('level', { level: g.level, prev, combo: g.combo });
        bus.emit('reach', { reach: L.reachOf(g.combo, g.best) });
    }

    function gameOver(reason) {
        if (g.state !== 'play') return;
        g.state = 'over';
        stopClock();
        const q = g.q;
        const newRecord = g.combo > g.best;
        if (newRecord) {
            store.best[L.bestKey(g.course.id, g.limit)] = g.combo;
            save(KEY.best, store.best);
        }
        const k = L.keyOf(q);
        store.miss[k] = (store.miss[k] || 0) + 1;
        save(KEY.miss, store.miss);

        const info = {
            reason, q, input: g.input, combo: g.combo, best: g.best, newRecord,
            course: g.course, limit: g.limit, level: g.level, reach: L.reachOf(g.combo, g.best),
        };
        bus.emit('gameover', info);
        /* 0.3びょう スローに なってから ゲームオーバー画面へ */
        later(() => {
            renderOver(info);
            show('over');
            g.readyAt = performance.now() + 900;   /* テンキーの れんだで すぐ 押されない ように */
            bus.emit('overShown', info);
        }, 380);
    }

    function quit() {
        if (g.state !== 'play' && g.state !== 'countdown') return;
        const playing = g.state === 'play';
        stopClock();
        if (playing && g.combo > g.best) {
            store.best[L.bestKey(g.course.id, g.limit)] = g.combo;
            save(KEY.best, store.best);
        }
        g.state = 'idle';
        $('#countdown').hidden = true;
        bus.emit('quit', { combo: g.combo });
        show('course');
    }

    function retry() {
        if (screen !== 'over' || performance.now() < g.readyAt) return;
        startGame(g.course.id);
    }

    /* ---------- かく ---------- */
    function renderHud() {
        $('#hudCourse').textContent = g.course.name;
        $('#hudComboN').textContent = g.combo;
        $('#hudBestN').textContent = g.best || '―';
        $('#hudBest').classList.toggle('passed', g.passed);
    }

    function renderAns() {
        $('#ans').textContent = g.input;
        $('#ansbox').classList.toggle('empty', !g.input);
    }

    function renderOver(o) {
        $('#overTitle').innerHTML = Array.from('ゲームオーバー').map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
        $('#overWhy').textContent = o.reason === 'time' ? 'じかんぎれ！' : 'まちがい！';
        $('#overQ').innerHTML = `${o.q.a} × ${o.q.b} = <b>${o.q.ans}</b>`;
        $('#overYomi').textContent = L.kukuReading(o.q.a, o.q.b);
        $('#overYour').textContent = o.reason === 'miss' ? `（${o.input} と こたえたよ）` : '';
        const bestNow = Math.max(o.best, o.combo);
        $('#overRec').innerHTML = `きろく <b>${o.combo}</b> れんぞく`
            + (o.newRecord ? '' : `<small>（さいこう ${bestNow}）</small>`);
        $('#overNew').hidden = !o.newRecord;
        /* リーチ中に おわったら「おしい！」（もう1回 やりたく なる） */
        const oshii = !o.newRecord && o.reach;
        $('#overOshii').hidden = !oshii;
        if (oshii) $('#overOshii').innerHTML = `おしい！ あと <b>${o.reach.left}</b>問で ${o.reach.label} だった！`;
    }

    /* =====================================================================
       そうさ
       ===================================================================== */
    const ACTS = {
        start() { if (Sound) Sound.unlock(); show('course'); },
        toTitle() { show('title'); },
        course(b) { if (Sound) Sound.unlock(); startGame(b.dataset.id); },
        quit() { quit(); },
        retry() { retry(); },
        toCourse() { if (performance.now() >= g.readyAt) show('course'); },
        openSet() { setBack = screen; show('set'); },
        closeSet() { show(setBack === 'course' ? 'course' : 'title'); },
        reset() { resetRecords(); },
    };

    document.addEventListener('click', e => {
        const seg = e.target.closest('.seg button');
        if (seg) { setValue(seg.parentElement.dataset.key, seg.dataset.v); return; }
        const b = e.target.closest('[data-act]');
        if (b && ACTS[b.dataset.act]) ACTS[b.dataset.act](b);
    });

    /* テンキー：押した しゅんかん（pointerdown）に うけつける */
    function hit(k) {
        const b = $(`.key[data-key="${k}"]`);
        if (!b) return;
        b.classList.add('hit');
        setTimeout(() => b.classList.remove('hit'), 110);
    }
    $('#pad').addEventListener('pointerdown', e => {
        const b = e.target.closest('.key[data-key]');
        if (!b) return;
        e.preventDefault();
        hit(b.dataset.key);
        press(b.dataset.key, e.timeStamp);
    });

    /* キーボード（数字・Backspace）。日本語入力が オンでも 数字キーの 場所で わかる */
    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (Sound) Sound.unlock();
        const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
        const d = /^[0-9]$/.test(e.key) ? e.key : (m ? m[1] : null);
        if (screen === 'play') {
            if (d !== null) {
                e.preventDefault();
                if (e.repeat) return;
                hit(d);
                press(d, e.timeStamp);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                hit('del');
                press('del', e.timeStamp);
            }
        } else if (screen === 'over' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            retry();
        } else if (screen === 'title' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            ACTS.start();
        }
    });

    /* れんだで 画面が 大きく なったり、うごいたり しない ように。
       スクロールは CSS（touch-action・overflow）で とめる。touchmove を JS で とめると、
       画面の 処理が いそがしい ときに タッチ全体が またされて 入力が おくれるので つかわない */
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });

    /* ボタンを さわったら 音の じゅんび（iPhone は さわるまで 音が 出ない） */
    document.addEventListener('pointerdown', e => {
        if (Sound && e.target.closest('button')) Sound.unlock();
    }, { capture: true });

    document.addEventListener('visibilitychange', () => {
        if (Sound) Sound.pause(document.hidden);
    });

    /* ---------- はじめ ---------- */
    window.Dopa = {
        bus, store, fxMode, show, startGame, press,
        get game() { return g; },
        get screen() { return screen; },
    };
    applySettings();
    show('title');
})();
