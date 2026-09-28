/* ドパ九九 ── 粒子エンジン（紙吹雪・星・花火・光の粒）
   画面いっぱいの canvas 1まいに requestAnimationFrame で かきます。
   canvas は 問題・テンキーの「うしろ」に あるので、粒子が 問題に かさなる ことは ありません。
   同時に 出せるのは 800こ まで（スマホは 400こ）。粒子が ない ときは ループを 止めます。 */
(function (root) {
    'use strict';

    const mobile = (navigator.maxTouchPoints || 0) > 0 && Math.min(screen.width, screen.height) < 700;

    let cv = null, cx = null, W = 0, H = 0, dpr = 1;
    let list = [];
    let raf = 0, last = 0;
    let limit = mobile ? 400 : 800;
    let scale = 1;            /* ひかえめ → 1/3 */
    let timeScale = 1;        /* ゲームオーバーの スロー */
    let ambient = null;       /* つねに まう 光の粒（'gold' | 'rainbow'） */
    let ambientAcc = 0;

    const CONFETTI = ['#ff3b6b', '#ffb300', '#ffe14d', '#34d27b', '#29b6ff', '#7c5cff', '#ff5ce1', '#ffffff'];
    const GOLD = ['#fff4b0', '#ffe066', '#ffd23f', '#f5b700', '#e09a00', '#fffbe6'];

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
        dpr = Math.min(root.devicePixelRatio || 1, mobile ? 1.5 : 2);
        W = root.innerWidth;
        H = root.innerHeight;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
    }

    const n = c => Math.max(1, Math.round(c * scale));

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

    /** 花火。下から 打ちあがって ひらく（ぜんぶで 0.8びょう くらい） */
    function firework(o) {
        o = o || {};
        const tx = o.x != null ? o.x : rnd(W * 0.15, W * 0.85);
        const ty = o.y != null ? o.y : rnd(H * 0.12, H * 0.4);
        const hue = o.hue != null ? o.hue : Math.floor(rnd(0, 360));
        const up = 0.32;
        add({
            k: 'r', x: tx + rnd(-30, 30), y: H + 10, tx, ty,
            vx: 0, vy: 0, g: 0, drag: 0, size: 10, life: 0, max: up,
            color: `hsl(${hue},100%,70%)`, hue, sparks: o.sparks || 56, gold: o.gold,
        });
    }

    function burstAt(p) {
        const c = n(p.sparks);
        for (let i = 0; i < c; i++) {
            const a = (i / c) * Math.PI * 2 + rnd(-0.05, 0.05), sp = rnd(180, 420);
            const col = p.gold ? pick(GOLD) : `hsl(${(p.hue + rnd(-25, 25) + 360) % 360},100%,${Math.floor(rnd(55, 75))}%)`;
            if (!add({
                k: 'k', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                g: 240, drag: 1.6, size: rnd(14, 22), life: 0, max: rnd(0.7, 1.1), color: col,
            })) break;
        }
    }

    /** つねに まう 光の粒（Lv7 は 金・Lv8 は 虹）。null で 止める */
    function setAmbient(kind) {
        ambient = kind || null;
        if (ambient) run();
    }

    function spawnAmbient(dt) {
        ambientAcc += dt * 26 * scale;
        while (ambientAcc >= 1) {
            ambientAcc -= 1;
            const col = ambient === 'rainbow' ? `hsl(${Math.floor(rnd(0, 360))},100%,70%)` : pick(GOLD);
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
        raf = 0;
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
            if (p.y > H + 40 && p.vy > 0) continue;
            next.push(p);
        }
        list = next;
        draw();

        if (list.length || ambient) raf = requestAnimationFrame(frame);
    }

    function draw() {
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, cv.width, cv.height);
        const star = starPath();
        for (const p of list) {
            const fade = p.k === 'c' ? Math.min(1, (p.max - p.life) * 2.5) : 1 - p.life / p.max;
            if (fade <= 0) continue;
            if (p.k === 'c') {
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
        init, resize, confetti, stars, firework, setAmbient, clear,
        setScale(k) { scale = k; },
        setTimeScale(k) { timeScale = k; },
        count() { return list.length; },
        get limit() { return limit; },
        get mobile() { return mobile; },
    };
})(window);
