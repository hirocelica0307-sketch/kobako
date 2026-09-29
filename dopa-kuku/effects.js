/* ドパ九九 ── 演出（ドパレベル・特別演出・ゲームオーバー演出）
   ------------------------------------------------------------------
   main.js の できごと（Dopa.bus）を うけとって うごきます。
   演出の 強さは「れんぞく正解数（コンボ）」だけで きまります。ランダムに 当たる しくみは ありません。

   おく場所の きまり
   - 問題の 数字・のこり時間ゲージ・テンキー には 演出を かさねない
   - 出すのは 背景（#stage）・画面の ふち（#frame）・問題の まわり（#tz と .qwrap の 光）だけ
   - #stage は #app の うしろ なので、紙吹雪や 光が 問題を かくす ことは ない
   - 1回の 正解演出は 0.8びょう いない。演出中も つぎの 問題が 出て、入力できる

   操作が おもく ならない ための きまり
   - 正解の しゅんかんは「音」だけ すぐ 鳴らし、画面の 演出は つぎの 問題が 画面に 出た あとで はじめる（afterPaint）
   - 演出の ために レイアウトを 計算させない（offsetWidth や getBoundingClientRect を 正解ごとに よばない）。
     うごきは Web Animations（transform・opacity）で つける
   - 画面の うごきを 見はって、端末が おいつかない ときは 自動で 演出を かるく する（Q.tier。問題・入力は かわらない）

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
    const stage = $('#stage'), fxl = $('#fxl'), tz = $('#tz'), echoEl = $('#echo'), ring = $('#qring');

    P.init($('#fx'));

    const calm = () => D.fxMode() === 'hikaeme';
    let level = 0;
    let gen = 0;                  /* ゲームが かわったら ふやす（おくれて 出る 演出を すてる ため） */
    let timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    /** つぎの 画面が 出た あとで うごかす（入力と 問題の 表示を さきに すませる） */
    function afterPaint(fn) {
        const g = gen;
        requestAnimationFrame(() => setTimeout(() => { if (g === gen) fn(); }, 0));
    }

    /* =====================================================================
       端末に あわせた かるさ（自動）
       tier 0：ぜんぶ ／ 1：粒子 半分・光の粒なし ／ 2：粒子 4分の1・背景の うごきと 光線を とめる
       ===================================================================== */
    const Q = { tier: 0, raf: 0, last: 0, sum: 0, n: 0, bad: 0 };
    try { Q.tier = Math.min(2, Number(sessionStorage.getItem('dopakuku_lite')) || 0); } catch (e) { /* つかえなくても よい */ }

    function applyMode() {
        P.setScale(calm() ? 1 / 3 : 1);
        P.setBudget(Q.tier === 0 ? 1 : Q.tier === 1 ? 0.5 : 0.25);
        body.classList.toggle('lite1', Q.tier >= 1);
        body.classList.toggle('lite2', Q.tier >= 2);
        P.setAmbient(Q.tier === 0 && level >= 7 ? (level >= 8 ? 'rainbow' : 'gold') : null);
    }

    function setTier(n) {
        Q.tier = n;
        try { sessionStorage.setItem('dopakuku_lite', String(n)); } catch (e) { /* つかえなくても よい */ }
        applyMode();
    }

    /** プレイ中の 画面の うごき（1びょうに 何回 かきかえられたか）を 見はる */
    function watch(on) {
        cancelAnimationFrame(Q.raf);
        Q.raf = 0;
        if (!on) return;
        Q.last = 0; Q.sum = 0; Q.n = 0; Q.bad = 0;
        const f = t => {
            if (Q.last) {
                const d = t - Q.last;
                if (d < 250) { Q.sum += d; Q.n++; }             /* タブを うらに した ときの 大きな すきまは かぞえない */
            }
            Q.last = t;
            if (Q.n >= 45) {
                /* 平均 22ミリびょう いじょう（1びょうに 45回 より 少ない）が 3回（約2びょう）つづいたら 1だん かるく。
                   一瞬の ひっかかりでは かるく しない */
                Q.bad = Q.sum / Q.n > 22 ? Q.bad + 1 : 0;
                Q.sum = 0; Q.n = 0;
                if (Q.bad >= 3 && Q.tier < 2) { Q.bad = 0; setTier(Q.tier + 1); }
            }
            Q.raf = requestAnimationFrame(f);
        };
        Q.raf = requestAnimationFrame(f);
    }

    /* ---------- 小さな 道具 ---------- */
    /** しばらく 出して きえる 要素（CSS アニメーションで うごく） */
    function spawn(parent, cls, html, ms) {
        const el = document.createElement('div');
        el.className = cls;
        if (html != null) el.innerHTML = html;
        parent.appendChild(el);
        setTimeout(() => el.remove(), ms || 1000);
        return el;
    }

    /* 問題カードの いち（ゲームの はじめと 画面の 大きさが かわった ときだけ はかる） */
    let qr = null;
    const qRect = () => qr || (qr = $('#qcard').getBoundingClientRect());

    /* ---------- 画面の ふち：1周 ながれる ライト ---------- */
    const laps = {};
    for (const k of ['t', 'r', 'b', 'l']) laps[k] = $(`.fe-${k} s`);

    function lap() {
        if (!laps.t.animate) return;
        const W = window.innerWidth, H = window.innerHeight, per = 2 * (W + H), total = 700, L = 140;
        let t0 = 0;
        for (const [k, len, ax, dir] of [['t', W, 'X', 1], ['r', H, 'Y', 1], ['b', W, 'X', -1], ['l', H, 'Y', -1]]) {
            const d = total * len / per;
            const from = dir > 0 ? -L : len, to = dir > 0 ? len : -L;
            laps[k].animate(
                [{ opacity: 1, transform: `translate${ax}(${from}px)` }, { opacity: 1, transform: `translate${ax}(${to}px)` }],
                { duration: d, delay: t0 });
            t0 += d;
        }
    }

    window.addEventListener('resize', () => { qr = null; });

    /* ---------- ドパレベル（つねに 出ている もの） ---------- */
    function setLevel(n) {
        level = n;
        for (let i = 1; i <= 8; i++) body.classList.toggle('lv' + i, i <= n);
        applyMode();
        S.bgmLevel(n);
    }

    /* ---------- ゆれ（transform だけ。ひかえめ では 出さない） ---------- */
    const SHAKE = {
        s: [250, [[4, -3], [-4, 3], [3, 2]]],
        m: [350, [[9, -6], [-9, 5], [7, 4], [-5, -3]]],
        l: [600, [[18, -12], [-18, 10], [14, 8], [-12, -8], [8, 5], [-4, -3]]],
    };
    function shake(size) {
        if (calm() || (Q.tier >= 2 && size !== 'l') || !stage.animate) return;
        /* 大きな ゆれ（問題ごと）は タイマーが とまっている 虹ドパの ときだけ */
        const [ms, pts] = SHAKE[size];
        const frames = [{ transform: 'none' }].concat(pts.map(([x, y]) => ({ transform: `translate(${x}px,${y}px)` })), [{ transform: 'none' }]);
        (size === 'l' ? body : stage).animate(frames, { duration: ms });
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

    /* ---------- 答えの 数字が 光る（入力欄の 上に 0.35びょう） ---------- */
    let echoAnim = null;
    function echo(ans, lv) {
        if (!echoEl.animate) return;
        echoEl.textContent = ans;
        if (echoAnim) echoAnim.cancel();
        echoAnim = echoEl.animate(lv >= 1
            ? [{ opacity: 1, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.18)', offset: 0.3 },
                { opacity: 1, transform: 'scale(.96)', offset: 0.55 }, { opacity: 0, transform: 'scale(1)' }]
            : [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0, transform: 'scale(1.06)' }],
        { duration: lv >= 1 ? 380 : 350, easing: 'ease-out' });
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
            if (ring.animate) ring.animate([{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.07)' }], { duration: 500, easing: 'ease-out' });
        }
        if (lv >= 2) {
            P.confetti({ x: cx, y: r.top + 8, count: 30, spread: r.width * 0.42, gold: lv >= 7 });
            lap();
        }
        if (lv >= 3) {
            shake('s');
            comboPop(e.combo);
        }
        if (lv >= 4 && Q.tier < 2) {
            spawn(fxl, 'beam bl', null, 750);
            spawn(fxl, 'beam br', null, 750);
        }
        if (lv >= 4) {
            const shots = lv >= 6 && Q.tier === 0 ? 3 : 1;
            for (let i = 0; i < shots; i++) later(() => P.firework({ gold: lv >= 7 && i === 1 }), i * 110);
        }
        if (lv >= 6 && Q.tier < 2) spawn(fxl, 'corners', '<i></i><i></i><i></i><i></i>', 650);
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
        sound(e);                                      /* 音は すぐ（できている 音を 流すだけ なので かるい） */
        afterPaint(() => {
            echo(e.answer, e.level);
            burst(e);
            words(e);
            if (e.kakutei === 'niji') niji();
            else if (e.kakutei === 'hyaku') hyaku();
            else if (e.kakutei === 'kakutei') kakutei(e);
        });
    });

    D.bus.on('level', e => {
        if (e.level === 8 && e.prev < 8) return;       /* 虹ドパの「ため」の あとで かわる（niji） */
        afterPaint(() => {
            setLevel(e.level);
            if (e.level === 5 && e.prev < 5) dopaTime();
        });
    });

    D.bus.on('input', () => { if (echoAnim) { echoAnim.cancel(); echoAnim = null; } });

    D.bus.on('countdown', e => S.count(e.final));

    D.bus.on('question', e => { if (e.index === 1) watch(true); });

    function reset() {
        gen++;
        clearTimers();
        watch(false);
        body.classList.remove('over', 'newrec', 'tame');
        tz.innerHTML = '';
        fxl.innerHTML = '';
        P.clear();
        setLevel(0);
    }

    D.bus.on('start', () => { reset(); qr = null; qRect(); });

    /* ゲームオーバー：BGM が とまり 0.3びょう スロー → 灰色 → ポン → （新記録なら 虹色に もどる） */
    function slow(rate) {
        if (!document.getAnimations) return;
        for (const a of document.getAnimations()) {
            try { a.playbackRate = rate; } catch (err) { /* とめられない ものは そのまま */ }
        }
    }
    D.bus.on('gameover', () => {
        gen++;
        clearTimers();
        watch(false);
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

    D.bus.on('quit', reset);

    D.bus.on('screen', e => {
        if (e.id === 'play' || e.id === 'over') return;
        reset();
    });

    D.bus.on('settings', applyMode);

    applyMode();
})();
