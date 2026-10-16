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
    const D = window.Dopa, S = window.DopaSound, P = window.DopaParticles, L = window.DopaLogic;
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
        P.setAmbient(Q.tier === 0 && level >= 5 ? (level >= 8 ? 'rainbow' : level >= 7 ? 'gold' : 'ember') : null);
        if (combo >= 60) applyTier(combo);
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
        S.bgmLevel(bgmLv());
        syncBeat();
    }

    /* BGM の 段階：100れんぞく から 9、160れんぞく から 10（もっと はやく にぎやかに） */
    let combo = 0;
    const bgmLv = () => (level < 8 ? level : combo >= 160 ? 10 : combo >= 100 ? 9 : 8);

    /* =====================================================================
       10問ごとの だんかい（60〜200）：場面（シーン）と HUD の しるし
       ===================================================================== */
    const SCENE_OF = {
        ryusei: 'ryusei', aurora: 'aurora', ginga: 'ginga', hyaku: 'crown', hoshi: 'hoshi', laser: 'laser',
        hanabi: 'hanabi', neon: 'neon', nova: 'nova', warp: 'warp', last: 'last',
    };
    const hudRank = $('#hudRank');
    function applyTier(c) {
        const t = L.tierOf(c);
        if (hudRank) hudRank.textContent = t && t.icon ? t.icon : '';
        /* 場面は あたらしい ものから じゅんに、端末に あわせた 数だけ 出す（ふつう 4・かるさ1 で 2・かるさ2 で 1） */
        const max = Q.tier >= 2 ? 0 : Q.tier === 1 ? 1 : calm() ? 2 : 3;
        let list = [];
        if (c >= 200) list = ['hanabi', 'laser', 'warp', 'crown'];
        else for (let n = 60; n <= c; n += 10) { const id = SCENE_OF[L.tierAt(n).id]; if (id) list.push(id); }
        list = max ? list.slice(-max) : [];
        /* オーロラ・スーパーノヴァは CSS の 層（stage に しるしを つける） */
        stage.classList.toggle('sc-aurora', list.includes('aurora'));
        stage.classList.toggle('sc-nova', list.includes('nova'));
        P.setScenes(list.filter(id => id !== 'aurora' && id !== 'nova'));
    }

    /* 背景の 光を BGM の 拍に あわせる（BGM が まだ なら テンポだけ あわせる） */
    const beatEl = $('.bg-beat');
    function syncBeat() {
        if (level < 3) return;
        const b = S.beat();
        const bpm = b ? b.bpm : level >= 5 ? 152 : 124, len = 60 / bpm;
        beatEl.style.setProperty('--beat', len.toFixed(3) + 's');
        beatEl.style.setProperty('--beatdelay', b ? (-(b.phase * len)).toFixed(3) + 's' : '0s');
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
        if (lv >= 7) S.jara(0.05);                     /* Lv7〜 正解ごとに ジャラジャラ */
        accent(e.combo);
    }

    /* 60れんぞく から：だんかいごとに ちがう 音を 正解ごとに かさねる（200 から先は ぜんぶ じゅんばんに） */
    const ACCENT = {
        ryusei: 'twinkle', kaminari: 'zap', aurora: 'choirShort', hyaku: 'bellSmall', hoshi: 'harpPluck', laser: 'pew',
        hanabi: 'taiko', houseki: 'glass', chouniji: 'shimmer', neon: 'synth', nova: 'boomSmall', warp: 'zip', last: 'alarm',
    };
    const ACCENT_ALL = Object.values(ACCENT);
    function accent(c) {
        const t = L.tierOf(c);
        if (!t || c < 60 || L.tierAt(c)) return;       /* 大演出の 正解は 大演出の 音だけ */
        if (t.id === 'ginga') { S.music(c); return; }
        const name = c >= 200 ? ACCENT_ALL[c % ACCENT_ALL.length] : ACCENT[t.id];
        if (name) S.play(name, 0.04, t.id === 'hanabi' ? 0.7 : 1);
    }

    /* 衝撃波の 色（レベルごと） */
    const WAVE = ['#5dff9a', '#ffffff', '#5ab8ff', '#ffe14d', '#5dff9a', '#ff8a3d', '#ff4d6d', '#ffd23f', '#ff7ae6'];
    const FW_TYPES = ['peony', 'ring', 'willow'];

    function burst(e) {
        const lv = e.level, r = qRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const big = Math.max(r.width, r.height);
        /* 問題の うしろから 光の 輪が 広がる（Lv0 は 小さく。レベルが 上がるほど 大きく・2重に） */
        P.shockwave({ x: cx, y: cy, r0: big * 0.4, r1: big * (lv >= 1 ? 1.1 + lv * 0.08 : 0.75), width: 8 + lv * 2, color: WAVE[lv] });
        if (lv >= 4) later(() => P.shockwave({ x: cx, y: cy, r0: big * 0.45, r1: big * 1.6, width: 10, color: lv >= 8 ? WAVE[(e.combo % 8) + 1] : '#ffffff', life: 0.65 }), 90);
        /* 50 から 先は 10問ごとに 輪が ふえる（さいだい 3まい 足す） */
        const T = Math.floor(Math.min(e.combo, 200) / 10);
        for (let i = 0; i < Math.min(3, Math.floor((T - 5) / 5) + 1) && T >= 6 && Q.tier === 0; i++) {
            later(() => P.shockwave({ x: cx, y: cy, r0: big * 0.5, r1: big * (1.9 + i * 0.4), width: 8, color: WAVE[(e.combo + i * 3) % 9], life: 0.7 }), 160 + i * 80);
        }
        if (e.combo >= 70 && !calm() && Q.tier < 2) P.lightning();             /* カミナリ から：正解ごとに 1本 */
        if (e.combo >= 140) P.gems({ x: cx, y: r.top + 4, count: 8 });          /* 宝石 から：宝石が ふきだす */
        if (e.combo >= 60 && e.combo % 2 === 0 && Q.tier < 2) P.meteors(2);    /* 流星群 から：流れ星 */
        if (lv >= 1) {
            P.stars({ x: cx, y: r.top + r.height * 0.35, r: r.width * 0.5, count: 5 + Math.min(lv, 6) });
            if (ring.animate) ring.animate([{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.07)' }], { duration: 500, easing: 'ease-out' });
            hudPop(lv);
        }
        if (lv >= 2) {
            P.confetti({ x: cx, y: r.top + 8, count: lv >= 5 ? 50 : 36, spread: r.width * 0.42, gold: lv >= 7 });
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
            const shots = Q.tier > 0 ? 1 : lv >= 6 ? 3 : lv >= 5 ? 2 : 1;
            for (let i = 0; i < shots; i++) {
                /* 花火の しゅるいは じゅんばんに かわる（Lv6 から 尾を ひく・Lv7 から 金の しだれ柳も） */
                const type = lv >= 6 ? FW_TYPES[(e.combo + i) % (lv >= 7 ? 3 : 2)] : 'peony';
                later(() => P.firework({ type, trail: lv >= 6, gold: lv === 7 && i === 1 }), i * 110);
            }
        }
        if (lv >= 6 && Q.tier < 2) spawn(fxl, 'corners', '<i></i><i></i><i></i><i></i>', 650);
        if (lv >= 7) P.coins({ x: cx, y: r.top + 4, count: lv >= 8 ? 12 : 8 });
    }

    /* HUD の れんぞく数が ポンッと はねる */
    const hudN = $('#hudComboN');
    function hudPop(lv) {
        if (!hudN.animate) return;
        const k = 1.25 + Math.min(lv, 8) * 0.06;
        hudN.animate([{ transform: `scale(${k})` }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    }

    /* 正解ごとの かけ声（レベルごとに じゅんばんに かわる。ランダムでは ない） */
    const SHOUT = {
        3: ['ドンッ!', 'バンッ!', 'ズドン!'], 4: ['バーン!', 'ドドン!', 'ズバッ!'],
        5: ['アツい!', 'ドパドパ!', 'ゴォォ!'], 6: ['キュイン!', 'ギュイン!', 'キュイーン!'],
        7: ['激アツ!!', '金ピカ!!', 'ジャラジャラ!!'], 8: ['神!!', '最強!!', '無敵!!', 'ドパドパ!!'],
    };
    function words(e) {
        const lv = e.level;
        if (e.passBest && e.best < 5) sub('きろく こえた！', 'best');
        else if (lv >= 3 && !L.tierAt(e.combo)) {
            const list = SHOUT[lv];
            sub(list[e.combo % list.length], lv === 7 ? 'atsu' : '');
        }
        if (L.tierAt(e.combo)) return;                 /* 大演出は べつの 文字 */
        if (e.milestone) telop(`${e.combo}れんぞく!`, lv >= 5 ? 'hot' : '', 1000);
    }

    /* ---------- 帯（カットイン） ---------- */
    function band(text, cls, rev) {
        S.whoosh();
        spawn(fxl, 'band ' + (cls || '') + (rev ? ' rev' : ''), `<span>${(text + '　').repeat(3)}</span>`, 900);
    }

    /* 確定の はんこ */
    function stamp(text) {
        S.stamp(0.1);
        const old = tz.querySelector('.tz-stamp');
        if (old) old.remove();
        spawn(tz, 'tz-stamp', text || '確定', 1300);
    }

    /* 10・30・40・しんきろく の 大演出（20・50・60〜・100 は 下の 専用の 演出） */
    const BIG = { 10: ten, 30: chodopa, 40: atsu };
    function ten() {
        S.play('pinpon', 0.05, 1, true);
        band('10れんぞく!!', 'blue');
        telop('10れんぞく!!', 'hot', 1000);
        S.don(1);
        const r = qRect();
        P.shockwave({ x: r.left + r.width / 2, y: r.top + r.height / 2, r0: 60, r1: Math.max(innerWidth, innerHeight), width: 22, color: '#5ab8ff', life: 0.8 });
    }
    function chodopa() {
        S.play('airhorn', 0, 1, true);
        band('超ドパ!!', 'purple');
        later(() => band('超ドパ!!', 'purple', true), 120);
        telop('超ドパ!!', 'cutin', 1100);
        S.don(1);
        S.gyuin();
        for (let i = 0; i < 4; i++) later(() => P.firework({ type: FW_TYPES[i % 3], trail: true }), i * 130);
        shake('m');
    }
    function atsu() {
        band('激アツ!!', 'gold');
        telop('激アツ!!', 'atsu', 1100);
        S.jara();
        S.fanfare(false, 0.1);
        P.coins({ count: 70 });
        for (let i = 0; i < 3; i++) later(() => P.firework({ type: 'willow' }), i * 150);
        shake('m');
    }
    /* ---------- 60〜200：10問ごとに ちがう 大演出 ---------- */
    /* 大演出の 光の 輪：端末が おもい ときは 数を へらし、細く する */
    function waves(n, make) {
        const k = Q.tier === 0 ? n : Q.tier === 1 ? Math.min(n, 2) : 1;
        for (let i = 0; i < k; i++) later(() => { const o = make(i); if (Q.tier) o.width = (o.width || 14) * 0.6; P.shockwave(o); }, i * 100);
    }

    function tierCommon(name, cls, wave) {
        band(name + '!!', cls);
        telop(name + '!!', 'tier ' + cls, 1100);
        stamp('確定');
        S.don(1);
        const r = qRect();
        P.shockwave({ x: r.left + r.width / 2, y: r.top + r.height / 2, r0: 60, r1: Math.hypot(innerWidth, innerHeight) * 0.7, width: 24, color: wave || '#ffffff', life: 0.85 });
        P.coins({ count: 30 });
        shake('m');
    }
    const center = () => { const r = qRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
    const TIER_FX = {
        ryusei() { tierCommon('流星群', 'teal', '#9fe8ff'); S.play('kirakira', 0.1, 1, true); S.play('bell', 0.35, 0.8, true); P.meteors(18); },
        kaminari() {
            tierCommon('カミナリ', 'electric', '#7ab8ff'); S.play('thunder', 0.05, 1, true);
            if (!calm()) for (let i = 0; i < 3; i++) later(() => P.lightning({ life: 0.35 }), i * 140);
        },
        aurora() { tierCommon('オーロラ', 'aurora', '#7dffc8'); S.play('choir', 0.05, 1, true); S.play('shimmer', 0.2, 0.8, true); P.confetti({ count: 80, colors: ['#7dffc8', '#9fa8ff', '#ff9ff0', '#ffffff'] }); },
        ginga() {
            tierCommon('ぎんが', 'navy', '#cfe3ff'); S.play('harp', 0.05, 1, true); S.play('kirakira', 0.6, 0.8, true);
            const c = center(); P.stars({ x: c.x, y: c.y, r: c.r.width * 0.5, count: 30, colors: ['#ffffff', '#cfe3ff', '#ffe9a8'] });
        },
        hoshi() { tierCommon('星の雨', 'star', '#fff27a'); S.play('harp', 0.05, 1, true); S.play('twinkle', 0.5, 1, true); const c = center(); P.stars({ x: c.x, y: c.y, r: c.r.width * 0.5, count: 40 }); },
        laser() {
            tierCommon('レーザー', 'cyan', '#4df3ff'); S.play('lasers', 0.05, 1, true);
            const c = center();
            waves(3, i => ({ x: c.x, y: c.y, r0: 40, r1: Math.max(innerWidth, innerHeight), width: 12, color: ['#4df3ff', '#ff4df0', '#7dff6b'][i], life: 0.7 }));
        },
        hanabi() {
            tierCommon('花火大会', 'night', '#ffb347'); S.play('whistle', 0, 1, true); S.play('taiko', 0.8, 1, true);
            for (let i = 0; i < 6; i++) later(() => P.firework({ type: ['peony', 'ring', 'willow'][i % 3], trail: true }), 200 + i * 120);
        },
        houseki() { tierCommon('宝石', 'gem', '#ff9ff0'); S.play('glass', 0.05, 1, true); S.play('kirakira', 0.25, 1, true); const c = center(); P.gems({ x: c.x, y: c.r.top, count: 60 }); },
        chouniji() {
            spawn(fxl, 'niji-burst', null, 1300);
            band('超にじドパ!!', 'rainbow');
            later(() => band('超にじドパ!!', 'rainbow', true), 130);
            telop('超にじドパ!!', 'niji', 1500);
            stamp('確定');
            S.play('gong', 0.05, 1, true);
            S.kyuinKyuin(3);
            S.fanfare(true, 0.3);
            const c = center();
            waves(5, i => ({ x: c.x, y: c.y, r0: 60, r1: Math.hypot(innerWidth, innerHeight) * 0.8, width: 20, color: WAVE[i + 2], life: 0.9 }));
            P.confetti({ count: 200 });
            P.coins({ count: 60 });
            shake('m');
        },
        neon() { tierCommon('ネオン', 'neon', '#ff4df0'); S.play('synth', 0.05, 1, true); S.play('airhorn', 0.25, 1, true); P.confetti({ count: 80, colors: ['#ff4df0', '#4df3ff', '#ffffff', '#b48cff'] }); },
        nova() {
            tierCommon('スーパーノヴァ', 'nova', '#fff3b0'); S.play('boom', 0.05, 1, true);
            const c = center();
            waves(6, i => ({ x: c.x, y: c.y, r0: 30, r1: Math.hypot(innerWidth, innerHeight) * (0.5 + i * 0.12), width: 26 - i * 3, color: i % 2 ? '#ffffff' : '#ffd23f', life: 0.9 }));
            P.coins({ count: 60 });
        },
        warp() { tierCommon('ワープ', 'warp', '#dff1ff'); S.play('warp', 0.05, 1, true); P.meteors(20); },
        last() {
            tierCommon('ラストスパート', 'red', '#ff4d6d');
            S.play('buzzer', 0.05, 1, true); S.play('buzzer', 0.85, 1, true); S.play('alarm', 1.6, 1, true);
            later(() => sub('あと10問で でんせつ!!', 'atsu'), 700);
        },
        legend() {
            spawn(fxl, 'niji-burst', null, 1300);
            band('でんせつ!!', 'gold');
            later(() => band('でんせつ!!', 'rainbow', true), 140);
            later(() => band('でんせつ!!', 'red'), 300);
            telop('🏆でんせつの 九九マスター!!', 'hyaku', 2000);
            stamp('伝説');
            S.fanfare(true, 0.05);
            S.play('bell', 0.1, 1, true);
            S.play('gong', 0.5, 1, true);
            S.play('crowd', 0.2, 1, true);
            S.play('airhorn', 0.9, 1, true);
            S.jara(0.3);
            const c = center();
            waves(6, i => ({ x: c.x, y: c.y, r0: 40, r1: Math.hypot(innerWidth, innerHeight) * 0.9, width: 22, color: WAVE[(i * 2) % 9], life: 0.9 }));
            for (let i = 0; i < 8; i++) later(() => P.firework({ type: ['peony', 'ring', 'willow'][i % 3], trail: true, gold: i % 2 === 0 }), i * 130);
            P.confetti({ count: 300 });
            P.coins({ count: 150 });
            P.gems({ count: 40 });
            shake('m');
        },
    };

    /** 200 より 先の 10問ごと（ぜんぶ のせ の みじかい 版） */
    function kakuteiBig(e) {
        spawn(fxl, 'niji-burst short', null, 900);
        band(`${e.combo}れんぞく!!`, 'rainbow');
        stamp('伝説');
        S.kyuinKyuin(3);
        S.fanfare(false, 0.15);
        S.play('bell', 0.2, 0.8, true);
        P.confetti({ count: 120 });
        P.coins({ count: 50 });
        for (let i = 0; i < 3; i++) later(() => P.firework({ type: ['ring', 'willow', 'peony'][i], trail: true }), i * 130);
        telop(`${e.combo}れんぞく!`, 'niji short', 1000);
    }

    function newRecord() {
        band('しんきろく!!', 'gold');
        telop('👑しんきろく!!', 'atsu', 1200, 7);
        S.fanfare(true);
        P.coins({ count: 40 });
        P.confetti({ count: 80, gold: true });
    }

    /* ---------- 特別演出 ---------- */
    /** ドパタイム突入（20コンボ）：一瞬 暗く → ドンッ → ななめの 帯 → 大文字（0.8びょう） */
    function dopaTime() {
        S.don(1);
        S.gyuin();
        if (!calm()) spawn(fxl, 'dim', null, 800);
        band('ドパタイム突入!!');
        telop('ドパタイム突入!!', 'cutin', 1100);
        shake('m');
        const r = qRect();
        P.shockwave({ x: r.left + r.width / 2, y: r.top + r.height / 2, r0: 60, r1: Math.max(innerWidth, innerHeight) * 1.1, width: 26, color: '#ff8a3d', life: 0.8 });
        for (let i = 0; i < 3; i++) later(() => P.firework({ hue: 20 + i * 15 }), 150 + i * 120);
    }

    /** 虹ドパ（50コンボ）：0.3びょうの ため → ふちから 虹が 広がる → キュイン×3 → にじドパ!! → 大ゆれ＋紙吹雪300（約1.5びょう。タイマーは main.js が とめる） */
    function niji() {
        S.hush(300);
        body.classList.add('tame');
        later(() => {
            body.classList.remove('tame');
            setLevel(8);
            spawn(fxl, 'niji-burst', null, 1300);
            band('にじドパ!!', 'rainbow');
            S.kyuinKyuin(3);
            telop('にじドパ!!', 'niji', 1500);
            const r = qRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            waves(4, i => ({ x, y, r0: 60, r1: Math.max(innerWidth, innerHeight) * 1.2, width: 20, color: WAVE[i * 2 + 1], life: 0.9 }));
        }, 300);
        later(() => {
            shake('l');
            stamp('確定');
            P.confetti({ count: 300 });
            P.coins({ count: 60 });
            for (let i = 0; i < 4; i++) later(() => P.firework({ type: 'ring', hue: i * 90 }), i * 120);
            S.fanfare(true);
            S.jara(0.3);
            S.play('crowd', 0.2, 0.8, true);
        }, 760);
    }

    /** 100れんぞく!!!（専用の 特大演出） */
    function hyaku() {
        S.don(1);
        S.kyuinKyuin(5);
        S.fanfare(true, 0.25);
        spawn(fxl, 'niji-burst', null, 1300);
        spawn(fxl, 'corners', '<i></i><i></i><i></i><i></i>', 650);
        telop('100れんぞく!!!', 'hyaku', 1700);
        band('100れんぞく!!!', 'gold');
        later(() => band('100れんぞく!!!', 'rainbow', true), 150);
        stamp('神');
        S.jara(0.2);
        S.play('bell', 0.1, 1, true);
        S.play('crowd', 0.3, 1, true);
        P.confetti({ count: 250, gold: true });
        P.confetti({ count: 200 });
        P.coins({ count: 120 });
        for (let i = 0; i < 6; i++) later(() => P.firework({ type: FW_TYPES[i % 3], trail: true, gold: i % 2 === 0 }), i * 140);
        shake('m');
    }

    /* =====================================================================
       できごとを うけとる
       ===================================================================== */
    D.bus.on('correct', e => {
        combo = e.combo;
        if (e.combo % 10 === 0) S.prepare(e.combo);   /* あとの だんかいの 音を ちかづいてから 作る */
        sound(e);                                      /* 音は すぐ（できている 音を 流すだけ なので かるい） */
        afterPaint(() => {
            echo(e.answer, e.level);
            burst(e);
            words(e);
            const t = L.tierAt(e.combo);
            if (t) {
                if (t.id === 'niji') niji();
                else if (t.id === 'hyaku') hyaku();
                else if (BIG[e.combo]) BIG[e.combo]();
                else if (TIER_FX[t.id]) TIER_FX[t.id]();
                else if (t.id === 'kakutei') kakuteiBig(e);
                /* 20（ドパタイム）は レベルの かわりめで 出す */
            }
            if (e.combo >= 10) applyTier(e.combo);
            if (e.combo === 100 || e.combo === 160) { S.bgmLevel(bgmLv()); syncBeat(); }
            /* しんきろく（さいこうが 5 いじょうの とき）。ほかの 大演出と かさなる ときは はんこ だけ */
            if (e.passBest && e.best >= 5) {
                if (t) stamp('新');
                else newRecord();
            }
        });
    });

    /* ---------- リーチ（つぎの 大演出まで あと 3・2・1問） ---------- */
    let reachNow = null, reachEl = null;
    function setReach(rc, combo) {
        const was = reachNow;
        reachNow = rc;
        /* クラスは body では なく 背景と 問題の 上の 部分 だけに つける（画面ぜんたいの 計算しなおしを さける） */
        for (const el of [stage, tz]) {
            el.classList.toggle('reach', !!rc);
            for (const n of [1, 2, 3]) el.classList.toggle('reach' + n, !!rc && rc.left === n);
        }
        S.reach(rc ? rc.left : 0);
        if (!rc) {
            if (reachEl) { reachEl.remove(); reachEl = null; }
            return;
        }
        if (!reachEl || !reachEl.isConnected) {
            reachEl = document.createElement('div');
            reachEl.className = 'tz-reach';
            tz.appendChild(reachEl);
        } else if (reachEl.animate) {
            reachEl.animate([{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 400, easing: 'cubic-bezier(.2,1.6,.4,1)' });
        }
        reachEl.innerHTML = `<i>リーチ!</i>あと<b>${rc.left}</b>問で ${rc.label}`;
        const quiet = combo != null && (L.tierAt(combo) || L.isMilestone(combo));
        /* はいった ときは サイレン ＋「リーチ!!」。のこり 1問に なったら 表示が 金わくに なり、心臓の 音が はやく なる */
        if (!was) {
            S.siren();
            if (!quiet) telop('リーチ!!', 'reach', 900);
        }
    }

    D.bus.on('reach', e => {
        const combo = D.game.combo;
        if (!e.reach) { afterPaint(() => setReach(null)); return; }
        afterPaint(() => setReach(e.reach, combo));
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
        combo = 0;
        if (hudRank) hudRank.textContent = '';
        stage.classList.remove('sc-aurora', 'sc-nova');
        clearTimers();
        watch(false);
        setReach(null);
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
        setReach(null);
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
            stage.classList.remove('sc-aurora', 'sc-nova');
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
