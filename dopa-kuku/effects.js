/* ドパ九九 ── 演出（ドパレベル・特別演出・ゲームオーバー演出）
   ------------------------------------------------------------------
   main.js の できごと（Dopa.bus）を うけとって うごきます。
   演出の 強さは「れんぞく正解数（コンボ）」だけで きまります。ランダムに 当たる しくみは ありません。

   おく場所の きまり
   - 問題の 数字・のこり時間ゲージ・テンキー には 演出を かさねない
   - 出すのは 背景（#stage）・画面の ふち（#frame）・問題の まわり（#tz と .qwrap の 光）だけ
   - #stage は #app の うしろ なので、紙吹雪や 光が 問題を かくす ことは ない
   - 1回の 正解演出は 0.8びょう いない。演出中も つぎの 問題が 出て、入力できる

   安全の きまり
   - 画面ぜんたいの 強い 明滅は 1びょうに 3回まで（虹色は 点滅させず、色を なめらかに かえる）
   - 粒子は 同時に 800こ（スマホ 400こ）まで（particles.js）
   - 「ひかえめ」：ゆれ と 明滅を とめ、粒子を 3分の1 に する
   ------------------------------------------------------------------ */
(function () {
    'use strict';
    const D = window.Dopa, S = window.DopaSound, P = window.DopaParticles;
    const $ = s => document.querySelector(s);
    const body = document.body;
    const stage = $('#stage'), fxl = $('#fxl'), tz = $('#tz'), qwrap = $('#qwrap'), echoEl = $('#echo');

    P.init($('#fx'));

    const calm = () => D.fxMode() === 'hikaeme';
    let level = 0;
    let timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function applyMode() { P.setScale(calm() ? 1 / 3 : 1); }

    /* ---------- 小さな 道具 ---------- */
    /** しばらく 出して きえる 要素 */
    function spawn(parent, cls, html, ms) {
        const el = document.createElement('div');
        el.className = cls;
        if (html != null) el.innerHTML = html;
        parent.appendChild(el);
        setTimeout(() => el.remove(), ms || 1000);
        return el;
    }
    /** CSS アニメーションを はじめから もう1回 */
    function replay(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
    }
    const qRect = () => $('#qcard').getBoundingClientRect();

    /* ---------- 画面の ふち（ライト） ---------- */
    const frame = $('#frame');
    const rects = {
        glow: frame.querySelector('.f-glow'), base: frame.querySelector('.f-base'),
        flow: frame.querySelector('.f-flow'), lap: frame.querySelector('.f-lap'),
    };
    let per = 0, flowAnim = null;

    function frameSize() {
        const w = window.innerWidth, h = window.innerHeight, m = 5, r = 18;
        frame.setAttribute('viewBox', `0 0 ${w} ${h}`);
        for (const el of Object.values(rects)) {
            el.setAttribute('x', m);
            el.setAttribute('y', m);
            el.setAttribute('width', Math.max(0, w - m * 2));
            el.setAttribute('height', Math.max(0, h - m * 2));
            el.setAttribute('rx', r);
        }
        per = 2 * (w - m * 2 + h - m * 2) - (8 - 2 * Math.PI) * r;
        frameFlow();
    }

    /** Lv4 から ふちの ライトが ながれる（Lv6 で はやく） */
    function frameFlow() {
        if (flowAnim) { flowAnim.cancel(); flowAnim = null; }
        if (level < 4 || !rects.flow.animate) return;
        const dash = per / 26;
        rects.flow.setAttribute('stroke-dasharray', `${dash * 0.55} ${dash * 0.45}`);
        const cycle = (level >= 6 ? 240 : 650) * (calm() ? 2.5 : 1);
        flowAnim = rects.flow.animate(
            [{ strokeDashoffset: '0px' }, { strokeDashoffset: `${-dash}px` }],
            { duration: cycle, iterations: Infinity });
    }

    /** ふちを ライトが 1周 ながれる（Lv2 からの 正解） */
    function lap() {
        if (!rects.lap.animate) return;
        rects.lap.setAttribute('stroke-dasharray', `${per * 0.14} ${per}`);
        rects.lap.animate(
            [{ strokeDashoffset: '0px', opacity: 1 }, { strokeDashoffset: `${-per}px`, opacity: 0.9 }],
            { duration: 700, easing: 'cubic-bezier(.3,.1,.3,1)' });
    }

    window.addEventListener('resize', frameSize);
    frameSize();

    /* ---------- ドパレベル（つねに 出ている もの） ---------- */
    function setLevel(n) {
        level = n;
        for (let i = 1; i <= 8; i++) body.classList.toggle('lv' + i, i <= n);
        frameFlow();
        P.setAmbient(n >= 8 ? 'rainbow' : n >= 7 ? 'gold' : null);
        S.bgmLevel(n);
    }

    /* ---------- ゆれ ---------- */
    function shake(size) {
        if (calm()) return;
        /* 大きな ゆれ（問題ごと）は タイマーが とまっている 虹ドパの ときだけ */
        const el = size === 'l' ? body : stage;
        replay(el, 'shake-' + size);
        setTimeout(() => el.classList.remove('shake-' + size), size === 'l' ? 700 : 400);
    }

    /* ---------- 問題の まわりの 文字（#tz） ---------- */
    function telop(html, cls, ms, chars) {
        const old = tz.querySelector('.tz-main');
        if (old) old.remove();
        const el = spawn(tz, 'tz-main ' + (cls || ''), `<span>${html}</span>`, ms || 1000);
        el.style.setProperty('--n', chars || String(html).replace(/<[^>]+>/g, '').length);
        return el;
    }
    function sub(text, cls) {
        const old = tz.querySelector('.tz-sub');
        if (old) old.remove();
        spawn(tz, 'tz-sub ' + (cls || ''), text, 650);
    }
    function comboPop(n) {
        const old = tz.querySelector('.tz-combo');
        if (old) old.remove();
        spawn(tz, 'tz-combo', String(n), 600);
    }

    /* ---------- 答えの 数字が 光る（入力欄の 上に 0.45びょう） ---------- */
    function echo(ans, lv) {
        echoEl.textContent = ans;
        echoEl.className = 'echo';
        void echoEl.offsetWidth;
        echoEl.className = 'echo show' + (lv >= 1 ? ' bounce' : '');
    }

    /* =====================================================================
       正解した しゅんかん（前の レベルの 演出も のこして つみあげる）
       ===================================================================== */
    function sound(e) {
        if (e.kakutei === 'niji') return;             /* 虹ドパは「ため」から はじまる */
        const lv = e.level;
        if (lv >= 7) S.kyuinKyuin(2);
        else if (lv >= 6) S.kyuin();
        else if (lv >= 2) S.pikon(e.combo - 3, true);
        else if (lv >= 1) S.pikon(e.combo - 3);
        else S.pi();
        if (lv >= 3 && !(lv === 5 && e.prevLevel < 5)) S.don(0.45);
    }

    function burst(e) {
        const lv = e.level, r = qRect(), cx = r.left + r.width / 2;
        if (lv >= 1) {
            P.stars({ x: cx, y: r.top + r.height * 0.35, r: r.width * 0.5, count: 5 });
            replay(qwrap, 'pulse');
        }
        if (lv >= 2) {
            P.confetti({ x: cx, y: r.top + 8, count: 30, spread: r.width * 0.42, gold: lv >= 7 });
            lap();
        }
        if (lv >= 3) {
            shake('s');
            comboPop(e.combo);
        }
        if (lv >= 4) {
            spawn(fxl, 'beam bl', null, 750);
            spawn(fxl, 'beam br', null, 750);
            const shots = lv >= 6 ? 3 : 1;
            for (let i = 0; i < shots; i++) later(() => P.firework({ gold: lv >= 7 && i === 1 }), i * 110);
        }
        if (lv >= 6) spawn(fxl, 'corners', '<i></i><i></i><i></i><i></i>', 650);
    }

    function words(e) {
        const lv = e.level;
        if (e.passBest) sub('きろく こえた！', 'best');
        else if (lv === 7 && e.combo !== 40) sub('激アツ!!', 'atsu');
        else if (lv >= 6) sub('キュイン！');
        if (e.kakutei || e.combo === 20) return;       /* 確定演出・ドパタイムは べつの 文字 */
        if (e.combo === 40) telop('激アツ!!', 'atsu', 1000);
        else if (e.milestone) telop(`${e.combo}れんぞく!`, lv >= 5 ? 'hot' : '', 1000);
    }

    /* ---------- 特別演出 ---------- */
    /** ドパタイム突入（20コンボ）：一瞬 暗く → ドンッ → ななめの 帯 → 大文字（0.8びょう） */
    function dopaTime() {
        S.don(1);
        S.gyuin();
        if (!calm()) spawn(fxl, 'dim', null, 800);
        spawn(fxl, 'band', '<span>ドパタイム突入!!　ドパタイム突入!!　ドパタイム突入!!</span>', 900);
        telop('ドパタイム突入!!', 'cutin', 1100);
        shake('m');
    }

    /** 虹ドパ（50コンボ）：0.3びょうの ため → ふちから 虹が 広がる → キュイン×3 → にじドパ!! → 大ゆれ＋紙吹雪300（約1.5びょう。タイマーは main.js が とめる） */
    function niji() {
        S.hush(300);
        body.classList.add('tame');
        later(() => {
            body.classList.remove('tame');
            setLevel(8);
            spawn(fxl, 'niji-burst', null, 1300);
            S.kyuinKyuin(3);
            telop('にじドパ!!', 'niji', 1500);
        }, 300);
        later(() => {
            shake('l');
            P.confetti({ count: 300 });
            P.firework({ hue: 320 });
            S.fanfare(true);
        }, 760);
    }

    /** 確定演出（60・70・80 …）：虹ドパの みじかい 版（0.8びょう） */
    function kakutei(e) {
        S.kyuinKyuin(3);
        S.fanfare(false, 0.15);
        spawn(fxl, 'niji-burst short', null, 900);
        P.confetti({ count: 120 });
        telop(`${e.combo}れんぞく!`, 'niji short', 1000);
    }

    /** 100れんぞく!!!（専用の 特大演出） */
    function hyaku() {
        S.don(1);
        S.kyuinKyuin(5);
        S.fanfare(true, 0.25);
        spawn(fxl, 'niji-burst', null, 1300);
        spawn(fxl, 'corners', '<i></i><i></i><i></i><i></i>', 650);
        telop('100れんぞく!!!', 'hyaku', 1700);
        P.confetti({ count: 250, gold: true });
        P.confetti({ count: 200 });
        for (let i = 0; i < 5; i++) later(() => P.firework({ gold: i % 2 === 0 }), i * 140);
        shake('m');
    }

    /* =====================================================================
       できごとを うけとる
       ===================================================================== */
    D.bus.on('correct', e => {
        echo(e.answer, e.level);
        sound(e);
        burst(e);
        words(e);
        if (e.kakutei === 'niji') niji();
        else if (e.kakutei === 'hyaku') hyaku();
        else if (e.kakutei === 'kakutei') kakutei(e);
    });

    D.bus.on('level', e => {
        if (e.level === 8 && e.prev < 8) return;       /* 虹ドパの「ため」の あとで かわる（niji） */
        setLevel(e.level);
        if (e.level === 5 && e.prev < 5) dopaTime();
    });

    D.bus.on('input', () => { echoEl.className = 'echo'; });

    D.bus.on('countdown', e => S.count(e.final));

    D.bus.on('start', () => {
        clearTimers();
        body.classList.remove('over', 'newrec', 'tame');
        tz.innerHTML = '';
        fxl.innerHTML = '';
        P.clear();
        applyMode();
        setLevel(0);
    });

    /* ゲームオーバー：BGM が とまり 0.3びょう スロー → 灰色 → ポン → （新記録なら 虹色に もどる） */
    function slow(rate) {
        if (!document.getAnimations) return;
        for (const a of document.getAnimations()) {
            try { a.playbackRate = rate; } catch (err) { /* とめられない ものは そのまま */ }
        }
    }
    D.bus.on('gameover', () => {
        clearTimers();
        S.bgmStop();
        P.setTimeScale(0.2);
        slow(0.2);
        body.classList.remove('tame');
        body.classList.add('over');
        later(() => {
            P.setTimeScale(1);
            slow(1);
            P.clear();
            tz.innerHTML = '';
            fxl.innerHTML = '';
            setLevel(0);
        }, 330);
    });
    D.bus.on('overShown', e => {
        S.pon();
        if (!e.newRecord) return;
        later(() => {
            body.classList.add('newrec');
            S.fanfare(true);
            P.confetti({ count: 220 });
            later(() => P.firework({ hue: 50 }), 150);
            later(() => P.firework({ hue: 200 }), 380);
        }, 1300);
    });

    D.bus.on('quit', () => {
        clearTimers();
        P.clear();
        setLevel(0);
    });

    D.bus.on('screen', e => {
        if (e.id === 'play' || e.id === 'over') return;
        clearTimers();
        body.classList.remove('over', 'newrec', 'tame');
        tz.innerHTML = '';
        fxl.innerHTML = '';
        P.clear();
        setLevel(0);
    });

    D.bus.on('settings', () => { applyMode(); frameFlow(); });

    applyMode();
})();
