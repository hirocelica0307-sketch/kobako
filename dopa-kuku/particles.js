/* ドパ九九 ── 粒子エンジン（紙吹雪・星・花火・光の粒・メダル・衝撃波・火の粉）
   画面いっぱいの canvas 1まいに requestAnimationFrame で かきます。
   canvas は 問題・テンキーの「うしろ」に あるので、粒子が 問題に かさなる ことは ありません。
   同時に 出せるのは 800こ まで（スマホは 400こ）。粒子が ない ときは ループを 止めます。 */
(function (root) {
    'use strict';

    const mobile = (navigator.maxTouchPoints || 0) > 0 && Math.min(screen.width, screen.height) < 700;

    let cv = null, cx = null, W = 0, H = 0, dpr = 1;
    let list = [];
    let raf = 0, last = 0;
    const LIMIT = mobile ? 400 : 800;
    let limit = LIMIT;
    let scale = 1;            /* ひかえめ → 1/3 */
    let budget = 1;           /* 端末が おもい ときの 自動の かるさ（1・0.5・0.25） */
    let timeScale = 1;        /* ゲームオーバーの スロー */
    let ambient = null;       /* つねに まう 光の粒（'ember' 火の粉 | 'gold' | 'rainbow'） */
    let ambientAcc = 0;

    const CONFETTI = ['#ff3b6b', '#ffb300', '#ffe14d', '#34d27b', '#29b6ff', '#7c5cff', '#ff5ce1', '#ffffff'];
    const GOLD = ['#fff4b0', '#ffe066', '#ffd23f', '#f5b700', '#e09a00', '#fffbe6'];
    const EMBER = ['#ffb020', '#ff7a00', '#ff4a1a', '#ffd060'];

    /* 虹色は 12色に まとめる（色ごとに ぼかし玉を 1つ だけ 作る。ランダムな 色で 毎回 作ると どんどん おもく なる） */
    const HUES = Array.from({ length: 12 }, (_, i) => `hsl(${i * 30},100%,68%)`);
    const hueColor = h => HUES[((Math.round(h / 30) % 12) + 12) % 12];

    /* 光の粒は 先に かいておいた ぼかし玉を はる（shadowBlur は おもい） */
    const sprites = {};
    function glow(color) {
        if (sprites[color]) return sprites[color];
        const s = document.createElement('canvas');
        s.width = s.height = 64;
        const g = s.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.18, color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        sprites[color] = s;
        return s;
    }

    /* メダル（金貨）の 絵も 先に 1まい かいて おく */
    let COIN = null;
    function coinSprite() {
        if (COIN) return COIN;
        const s = document.createElement('canvas');
        s.width = s.height = 48;
        const g = s.getContext('2d');
        const gr = g.createRadialGradient(18, 16, 2, 24, 24, 24);
        gr.addColorStop(0, '#fffbe0');
        gr.addColorStop(0.35, '#ffd84a');
        gr.addColorStop(0.85, '#e0a000');
        gr.addColorStop(1, '#a86d00');
        g.fillStyle = gr;
        g.beginPath(); g.arc(24, 24, 23, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff1a8'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(24, 24, 16, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#b37800'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('★', 24, 25);
        COIN = s;
        return s;
    }

    let STAR = null;
    function starPath() {
        if (STAR) return STAR;
        STAR = new Path2D();
        for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 0.45 : 1, a = -Math.PI / 2 + i * Math.PI / 5;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (i) STAR.lineTo(x, y); else STAR.moveTo(x, y);
        }
        STAR.closePath();
        return STAR;
    }

    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    function init(canvas) {
        cv = canvas;
        cx = cv.getContext('2d');
        resize();
        root.addEventListener('resize', resize);
    }

    function resize() {
        if (!cv) return;
        /* 紙吹雪は こまかさより かるさ。スマホは 1倍、パソコンも 1.25倍 まで */
        dpr = Math.min(root.devicePixelRatio || 1, mobile ? 1 : 1.25);
        W = root.innerWidth;
        H = root.innerHeight;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
    }

    const n = c => Math.max(1, Math.round(c * scale * budget));

    function add(p) {
        if (list.length >= limit) return false;
        list.push(p);
        run();
        return true;
    }

    /* ---------- 出す ---------- */

    /** 紙吹雪。x, y が あれば そこから 上に ふきあげる。なければ 上から ふらせる */
    function confetti(o) {
        o = o || {};
        const colors = o.gold ? GOLD : (o.colors || CONFETTI);
        const c = n(o.count || 30);
        for (let i = 0; i < c; i++) {
            const burst = o.x != null;
            const a = burst ? rnd(-Math.PI * 0.85, -Math.PI * 0.15) : 0;
            const sp = burst ? rnd(380, 900) * (o.power || 1) : 0;
            const size = rnd(7, 13);
            if (!add({
                k: 'c',
                x: burst ? o.x + rnd(-(o.spread || 30), o.spread || 30) : rnd(0, W),
                y: burst ? o.y : rnd(-H * 0.35, -10),
                vx: burst ? Math.cos(a) * sp : rnd(-60, 60),
                vy: burst ? Math.sin(a) * sp : rnd(80, 260),
                g: 620, drag: 1.9,
                w: size, h: size * rnd(0.45, 0.7),
                rot: rnd(0, 6.28), vr: rnd(-9, 9),
                fl: rnd(0, 6.28), vf: rnd(7, 14),
                life: 0, max: o.life || rnd(1.6, 2.6),
                color: pick(colors),
            })) break;
        }
    }

    /** 星（Lv1 の 正解）。x, y の まわりから 外へ とぶ */
    function stars(o) {
        const c = n(o.count || 5);
        for (let i = 0; i < c; i++) {
            const a = rnd(0, Math.PI * 2), sp = rnd(260, 520);
            if (!add({
                k: 's', x: o.x + Math.cos(a) * (o.r || 0), y: o.y + Math.sin(a) * (o.r || 0) * 0.6,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
                g: 300, drag: 2.2, size: rnd(9, 16), rot: rnd(0, 6.28), vr: rnd(-6, 6),
                life: 0, max: rnd(0.55, 0.8), color: pick(o.colors || ['#fff27a', '#ffffff', '#ffd23f']),
            })) break;
        }
    }

    /** メダル（金貨）。x, y が あれば ふきあげる。なければ 上から ジャラジャラ ふらせる。下で 1回 はねる */
    function coins(o) {
        o = o || {};
        const c = n(o.count || 20);
        for (let i = 0; i < c; i++) {
            const burst = o.x != null;
            const a = burst ? rnd(-Math.PI * 0.8, -Math.PI * 0.2) : 0, sp = burst ? rnd(500, 1000) : 0;
            if (!add({
                k: 'm', x: burst ? o.x + rnd(-40, 40) : rnd(0, W), y: burst ? o.y : rnd(-H * 0.5, -20),
                vx: burst ? Math.cos(a) * sp : rnd(-40, 40), vy: burst ? Math.sin(a) * sp : rnd(150, 420),
                g: 900, drag: 0.6, size: rnd(18, 28), fl: rnd(0, 6.28), vf: rnd(8, 16),
                life: 0, max: rnd(1.8, 2.6), bounce: 1,
            })) break;
        }
    }

    /** 衝撃波（広がる 光の 輪）。問題の うしろから 外へ 広がる */
    function shockwave(o) {
        add({
            k: 'w', x: o.x, y: o.y, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: o.life || 0.55,
            r0: o.r0 || 40, r1: o.r1 || 420, lw: o.width || 14, color: o.color || '#ffffff',
        });
    }

    /** 花火。下から 打ちあがって ひらく（ぜんぶで 0.8びょう くらい）。
        type：'peony'（ふつう）・'ring'（きれいな 輪）・'willow'（金の しだれ柳。尾を ひいて ゆっくり おちる） */
    function firework(o) {
        o = o || {};
        const tx = o.x != null ? o.x : rnd(W * 0.15, W * 0.85);
        const ty = o.y != null ? o.y : rnd(H * 0.12, H * 0.4);
        const hue = o.hue != null ? o.hue : Math.floor(rnd(0, 360));
        const up = 0.32;
        add({
            k: 'r', x: tx + rnd(-30, 30), y: H + 10, tx, ty,
            vx: 0, vy: 0, g: 0, drag: 0, size: 10, life: 0, max: up,
            color: hueColor(hue), hue, sparks: o.sparks || 40, gold: o.gold || o.type === 'willow',
            type: o.type || 'peony', trail: !!o.trail || o.type === 'willow',
        });
    }

    function burstAt(p) {
        const c = n(p.sparks);
        const willow = p.type === 'willow', ringT = p.type === 'ring';
        for (let i = 0; i < c; i++) {
            const a = (i / c) * Math.PI * 2 + rnd(-0.05, 0.05);
            const sp = ringT ? 330 : willow ? rnd(150, 300) : rnd(180, 420);
            const col = p.gold ? pick(GOLD) : hueColor(p.hue + (ringT ? 0 : rnd(-30, 30)));
            if (!add({
                k: 'k', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                g: willow ? 130 : 240, drag: willow ? 0.9 : 1.6, size: rnd(14, 22), life: 0,
                max: willow ? rnd(1.5, 2.1) : rnd(0.7, 1.1), color: col, tr: p.trail,
            })) break;
        }
    }

    /** つねに まう 光の粒（Lv7 は 金・Lv8 は 虹）。null で 止める */
    function setAmbient(kind) {
        ambient = kind || null;
        if (ambient) run();
    }

    function spawnAmbient(dt) {
        ambientAcc += dt * (ambient === 'ember' ? 30 : 22) * scale * budget;
        while (ambientAcc >= 1) {
            ambientAcc -= 1;
            if (ambient === 'ember') {
                /* 炎の 火の粉：下から ゆらゆら のぼる 小さな 火 */
                add({
                    k: 'g', x: rnd(0, W), y: H + 10, vx: rnd(-40, 40), vy: rnd(-320, -160),
                    g: -40, drag: 0.3, size: rnd(8, 16), life: 0, max: rnd(1.2, 2.2), color: pick(EMBER), tw: rnd(0, 6.28),
                });
                continue;
            }
            const col = ambient === 'rainbow' ? pick(HUES) : pick(GOLD);
            add({
                k: 'g', x: rnd(0, W), y: H + 10, vx: rnd(-20, 20), vy: rnd(-160, -70),
                g: 0, drag: 0, size: rnd(10, 26), life: 0, max: rnd(2.5, 4.5), color: col, tw: rnd(0, 6.28),
            });
        }
    }

    /* ---------- うごかす・かく ---------- */
    function run() {
        if (raf || !cv) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function frame(t) {
        /* raf は ここでは 0 に しない（うごかしている とちゅうで 粒を 足しても、ループが 2本に ふえない ように） */
        const dt = Math.min(0.05, (t - last) / 1000) * timeScale;
        last = t;
        if (ambient) spawnAmbient(dt);

        const next = [];
        for (const p of list) {
            p.life += dt;
            if (p.k === 'r') {
                /* 打ちあげ：目的の たかさまで いったら ひらく */
                const k = Math.min(1, p.life / p.max);
                p.y = (H + 10) + (p.ty - (H + 10)) * (1 - Math.pow(1 - k, 2));
                p.x += (p.tx - p.x) * Math.min(1, dt * 10);
                if (k >= 1) { burstAt(p); continue; }
                next.push(p);
                continue;
            }
            if (p.life >= p.max) continue;
            const dr = Math.exp(-p.drag * dt);
            p.vx *= dr;
            p.vy = p.vy * dr + p.g * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.vr) p.rot += p.vr * dt;
            if (p.vf) p.fl += p.vf * dt;
            if (p.bounce && p.y > H - 14 && p.vy > 0) { p.vy *= -0.42; p.vx *= 0.7; p.bounce--; }   /* メダルは 下で 1回 はねる */
            if (p.y > H + 40 && p.vy > 0) continue;
            next.push(p);
        }
        list = next;
        draw();

        raf = list.length || ambient ? requestAnimationFrame(frame) : 0;
    }

    function draw() {
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, cv.width, cv.height);
        const star = starPath();
        for (const p of list) {
            const fade = p.k === 'c' || p.k === 'm' ? Math.min(1, (p.max - p.life) * 2.5) : 1 - p.life / p.max;
            if (fade <= 0) continue;
            if (p.k === 'm') {
                const f = Math.cos(p.fl), sz = p.size * dpr;
                cx.globalCompositeOperation = 'source-over';
                cx.globalAlpha = fade;
                cx.setTransform(f, 0, 0, 1, dpr * p.x, dpr * p.y);
                cx.drawImage(coinSprite(), -sz / 2, -sz / 2, sz, sz);
            } else if (p.k === 'w') {
                const k = p.life / p.max, r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3));
                cx.globalCompositeOperation = 'lighter';
                cx.globalAlpha = (1 - k) * 0.9;
                cx.setTransform(1, 0, 0, 1, 0, 0);
                cx.strokeStyle = p.color;
                cx.lineWidth = Math.max(1, p.lw * (1 - k)) * dpr;
                cx.beginPath();
                cx.arc(dpr * p.x, dpr * p.y, r * dpr, 0, Math.PI * 2);
                cx.stroke();
            } else if (p.k === 'c') {
                const c = Math.cos(p.rot), s = Math.sin(p.rot), f = Math.cos(p.fl);
                cx.globalCompositeOperation = 'source-over';
                cx.globalAlpha = fade;
                cx.fillStyle = p.color;
                cx.setTransform(dpr * c * f, dpr * s * f, -dpr * s, dpr * c, dpr * p.x, dpr * p.y);
                cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            } else if (p.k === 's') {
                const c = Math.cos(p.rot) * p.size * dpr, s = Math.sin(p.rot) * p.size * dpr;
                cx.globalCompositeOperation = 'source-over';
                cx.globalAlpha = Math.min(1, fade * 1.6);
                cx.fillStyle = p.color;
                cx.setTransform(c, s, -s, c, dpr * p.x, dpr * p.y);
                cx.fill(star);
            } else {
                /* 花火の 火花・打ちあげ・光の粒 */
                let a = fade;
                if (p.k === 'g') a = Math.min(1, p.life * 2, (p.max - p.life)) * (0.55 + 0.45 * Math.sin(p.life * 5 + p.tw));
                if (p.k === 'r') a = 1;
                const sz = p.size * dpr * (p.k === 'k' ? 0.6 + fade * 0.6 : 1);
                cx.globalCompositeOperation = 'lighter';
                cx.globalAlpha = Math.max(0, a);
                cx.setTransform(1, 0, 0, 1, 0, 0);
                if (p.tr) {
                    /* 尾を ひく 火花（すすむ むきの うしろに 線） */
                    cx.strokeStyle = p.color;
                    cx.lineWidth = 2.2 * dpr;
                    cx.beginPath();
                    cx.moveTo(dpr * (p.x - p.vx * 0.06), dpr * (p.y - p.vy * 0.06));
                    cx.lineTo(dpr * p.x, dpr * p.y);
                    cx.stroke();
                }
                cx.drawImage(glow(p.color), dpr * p.x - sz / 2, dpr * p.y - sz / 2, sz, sz);
            }
        }
        cx.globalAlpha = 1;
        cx.globalCompositeOperation = 'source-over';
        cx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function clear() {
        list = [];
        ambient = null;
        if (cx) {
            cx.setTransform(1, 0, 0, 1, 0, 0);
            cx.clearRect(0, 0, cv.width, cv.height);
        }
    }

    root.DopaParticles = {
        init, resize, confetti, stars, firework, coins, shockwave, setAmbient, clear,
        setScale(k) { scale = k; },
        setBudget(k) { budget = k; limit = Math.round(LIMIT * k); },
        setTimeScale(k) { timeScale = k; },
        count() { return list.length; },
        get limit() { return limit; },
        get mobile() { return mobile; },
    };
})(window);
