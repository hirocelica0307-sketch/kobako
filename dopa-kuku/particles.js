/* ドパ九九 ── 粒子エンジン（紙吹雪・星・花火・光の粒・メダル・衝撃波・火の粉・宝石・カミナリ）と 場面（シーン）
   場面：流星群・ぎんが・王冠の きらめき・星の雨・レーザー・花火大会・ネオンの 床・ワープ・回転灯。
   この canvas 1まいに 細い 線や 点で かくので かるい（広い 光の オーロラ・スーパーノヴァは CSS の 層。同時に 出す 場面の 数は effects.js が きめる）
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
    let scenes = [];          /* いま 出して いる 場面 */
    let sceneT = 0;           /* 場面の 時計（びょう） */
    const acc = {};           /* 場面ごとの 出す タイミング */

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

    const GEMS = ['#ff4d8d', '#4de1ff', '#7dff6b', '#ffe14d', '#b48cff', '#ffffff'];

    /** 宝石。x, y から ふきあげる（なければ 上から ふらせる） */
    function gems(o) {
        o = o || {};
        const c = n(o.count || 16);
        for (let i = 0; i < c; i++) {
            const burst = o.x != null, a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), sp = rnd(380, 820);
            if (!add({
                k: 'd', x: burst ? o.x + rnd(-30, 30) : rnd(0, W), y: burst ? o.y : rnd(-H * 0.4, -10),
                vx: burst ? Math.cos(a) * sp : rnd(-30, 30), vy: burst ? Math.sin(a) * sp : rnd(120, 300),
                g: 520, drag: 1.2, size: rnd(9, 16), rot: rnd(-0.4, 0.4), vr: rnd(-3, 3),
                life: 0, max: rnd(1.4, 2.2), color: pick(GEMS),
            })) break;
        }
    }

    /** カミナリ。上の ふちから ギザギザに おりる（画面ぜんたいは 光らせない） */
    function lightning(o) {
        o = o || {};
        const x0 = o.x != null ? o.x : rnd(W * 0.05, W * 0.95), y1 = o.y != null ? o.y : rnd(H * 0.35, H * 0.7);
        const pts = [[x0, -10]];
        const steps = 10;
        let x = x0;
        for (let i = 1; i <= steps; i++) {
            x += rnd(-W * 0.035, W * 0.035);
            pts.push([x, -10 + (y1 + 10) * i / steps]);
        }
        add({ k: 'z', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0, max: o.life || 0.28, pts });
    }

    /** 流れ星を まとめて 出す */
    function meteors(count) {
        const c = n(count || 12);
        for (let i = 0; i < c; i++) {
            if (!add({
                k: 'k', x: rnd(W * 0.2, W * 1.3), y: rnd(-H * 0.3, H * 0.25), vx: -rnd(800, 1200), vy: rnd(420, 640),
                g: 0, drag: 0, size: rnd(18, 26), life: 0, max: rnd(0.8, 1.2), color: pick(['#ffffff', '#bfe6ff', '#fff3b0']), tr: true, tl: 0.16,
            })) break;
        }
    }

    /* ---------- 場面（シーン） ---------- */
    /** 出す 場面を きめる（例：['ryusei', 'aurora']） */
    function setScenes(list) {
        scenes = (list || []).slice();
        if (scenes.length) run();
    }

    /** 場面が 出す 粒（流星・星の雨・王冠の きらめき・花火大会） */
    function spawnScenes(dt) {
        const k = scale * budget;
        const tick = (id, rate, fn) => {
            acc[id] = (acc[id] || 0) + dt * rate * k;
            while (acc[id] >= 1) { acc[id] -= 1; fn(); }
        };
        for (const id of scenes) {
            if (id === 'ryusei') tick(id, 3, () => add({
                k: 'k', x: rnd(W * 0.3, W * 1.2), y: rnd(-40, H * 0.3), vx: -rnd(700, 1000), vy: rnd(380, 560),
                g: 0, drag: 0, size: rnd(16, 24), life: 0, max: rnd(0.7, 1.0), color: pick(['#ffffff', '#bfe6ff', '#fff3b0']), tr: true, tl: 0.14,
            }));
            else if (id === 'hoshi') tick(id, 4, () => add({
                k: 's', x: rnd(0, W), y: -20, vx: rnd(-30, 30), vy: rnd(120, 220), g: 60, drag: 0, size: rnd(12, 22),
                rot: rnd(0, 6.28), vr: rnd(-3, 3), life: 0, max: rnd(2.5, 3.5), color: pick(['#fff27a', '#ffd23f', '#ffb3e6', '#b3e5ff']),
            }));
            else if (id === 'crown') tick(id, 10, () => {
                const side = Math.floor(Math.random() * 4);
                const x = side === 1 ? W - 6 : side === 3 ? 6 : rnd(0, W), y = side === 0 ? 6 : side === 2 ? H - 6 : rnd(0, H);
                add({ k: 'g', x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), g: 0, drag: 0, size: rnd(14, 26), life: 0, max: rnd(0.6, 1.0), color: pick(GOLD), tw: 0 });
            });
            else if (id === 'hanabi') tick(id, 1.3, () => firework({ type: ['peony', 'ring', 'willow'][Math.floor(sceneT * 1.3) % 3], trail: true }));
        }
    }

    /* 場面の 絵（線と 点だけ。粒の うしろに かく） */
    const SEED = Array.from({ length: 90 }, (_, i) => [(Math.sin(i * 12.9898) * 43758.5453) % 1, (Math.sin(i * 78.233) * 12543.123) % 1].map(v => Math.abs(v)));
    function drawScenes() {
        const t = sceneT, d = dpr;
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.globalCompositeOperation = 'lighter';
        for (const id of scenes) {
            if (id === 'ginga') {
                /* ぎんが：まん中で まわる うずまきの 星 */
                const R = Math.min(W, H) * 0.48, x0 = W / 2, y0 = H / 2;
                for (let arm = 0; arm < 2; arm++) {
                    for (let i = 0; i < 70; i++) {
                        const a = i * 0.16 + t * 0.35 + arm * Math.PI, r = (i / 70) * R;
                        cx.globalAlpha = 0.25 + 0.6 * (1 - i / 70);
                        cx.fillStyle = i % 3 ? '#cfe3ff' : '#ffe9a8';
                        const sz = (i % 5 ? 2 : 3.5) * d;
                        cx.fillRect((x0 + Math.cos(a) * r) * d - sz / 2, (y0 + Math.sin(a) * r * 0.6) * d - sz / 2, sz, sz);
                    }
                }
            } else if (id === 'laser') {
                /* レーザー：下の 両すみから 色の 光線が ゆれる */
                const L = Math.hypot(W, H);
                for (let i = 0; i < 6; i++) {
                    const left = i < 3, a = -Math.PI / 2 + (left ? 1 : -1) * (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1.1 + i * 0.23) + i)));
                    const x0 = left ? 0 : W, y0 = H;
                    cx.strokeStyle = HUES[(i * 2 + Math.floor(t * 2)) % 12];
                    cx.beginPath();
                    cx.moveTo(x0 * d, y0 * d);
                    cx.lineTo((x0 + Math.cos(a) * L) * d, (y0 + Math.sin(a) * L) * d);
                    cx.globalAlpha = 0.2; cx.lineWidth = 8 * d; cx.stroke();
                    cx.globalAlpha = 0.8; cx.lineWidth = 3 * d; cx.stroke();
                }
            } else if (id === 'neon') {
                /* ネオンの 床：おくに むかって ながれる マス目 */
                const y0 = H * 0.66, vx = W / 2;
                cx.globalAlpha = 0.5;
                cx.lineWidth = 2 * d;
                cx.strokeStyle = '#ff4df0';
                cx.beginPath();
                for (let i = -10; i <= 10; i++) { cx.moveTo((vx + i * W * 0.02) * d, y0 * d); cx.lineTo((vx + i * W * 0.16) * d, H * d); }
                cx.stroke();
                cx.strokeStyle = '#4df3ff';
                cx.beginPath();
                for (let i = 0; i < 9; i++) {
                    const k = ((i + (t * 1.2) % 1) / 9), y = y0 + (H - y0) * k * k;
                    cx.moveTo(0, y * d); cx.lineTo(W * d, y * d);
                }
                cx.stroke();
            } else if (id === 'warp') {
                /* ワープ：まん中から 外へ とびだす 星の すじ */
                const R = Math.hypot(W, H) * 0.6, x0 = W / 2, y0 = H / 2;
                cx.strokeStyle = '#dff1ff';
                cx.lineWidth = 2 * d;
                cx.globalAlpha = 0.75;
                cx.beginPath();
                for (let i = 0; i < SEED.length; i++) {
                    const ang = SEED[i][0] * Math.PI * 2, ph = (t * 0.9 + SEED[i][1]) % 1, r1 = ph * ph * R, r0 = r1 * 0.75;
                    cx.moveTo((x0 + Math.cos(ang) * r0) * d, (y0 + Math.sin(ang) * r0) * d);
                    cx.lineTo((x0 + Math.cos(ang) * r1) * d, (y0 + Math.sin(ang) * r1) * d);
                }
                cx.stroke();
            } else if (id === 'last') {
                /* 回転灯：上の 両すみで 赤い 光が まわる */
                const L = Math.hypot(W, H) * 0.7;
                for (let i = 0; i < 2; i++) {
                    const x0 = i ? W : 0, a = t * 3.2 + i * Math.PI;
                    cx.strokeStyle = '#ff2438';
                    cx.beginPath();
                    cx.moveTo(x0 * d, 0);
                    cx.lineTo((x0 + Math.cos(a) * L) * d, Math.abs(Math.sin(a)) * L * d);
                    cx.globalAlpha = 0.18; cx.lineWidth = 26 * d; cx.stroke();
                    cx.globalAlpha = 0.5; cx.lineWidth = 6 * d; cx.stroke();
                }
            }
        }
        cx.globalAlpha = 1;
        cx.globalCompositeOperation = 'source-over';
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
        sceneT += dt;
        if (scenes.length) spawnScenes(dt);

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

        raf = list.length || ambient || scenes.length ? requestAnimationFrame(frame) : 0;
    }

    function draw() {
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, cv.width, cv.height);
        if (scenes.length) drawScenes();
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
            } else if (p.k === 'z') {
                /* カミナリ：ギザギザの 線（太い うすい 線 ＋ 細い しろい 線） */
                cx.globalCompositeOperation = 'lighter';
                cx.setTransform(1, 0, 0, 1, 0, 0);
                cx.beginPath();
                p.pts.forEach(([x, y], i) => (i ? cx.lineTo(dpr * x, dpr * y) : cx.moveTo(dpr * x, dpr * y)));
                cx.globalAlpha = fade * 0.45;
                cx.strokeStyle = '#7ab8ff';
                cx.lineWidth = 12 * dpr;
                cx.stroke();
                cx.globalAlpha = fade;
                cx.strokeStyle = '#ffffff';
                cx.lineWidth = 3 * dpr;
                cx.stroke();
            } else if (p.k === 'd') {
                /* 宝石：ひしがた ＋ しろい ひかり */
                const c = Math.cos(p.rot) * p.size * dpr, sn = Math.sin(p.rot) * p.size * dpr;
                cx.globalCompositeOperation = 'source-over';
                cx.globalAlpha = Math.min(1, fade * 1.5) * (0.7 + 0.3 * Math.sin(p.life * 12));
                cx.setTransform(c, sn, -sn, c, dpr * p.x, dpr * p.y);
                cx.fillStyle = p.color;
                cx.beginPath(); cx.moveTo(0, -1); cx.lineTo(0.62, 0); cx.lineTo(0, 1); cx.lineTo(-0.62, 0); cx.closePath(); cx.fill();
                cx.fillStyle = 'rgba(255,255,255,.8)';
                cx.beginPath(); cx.moveTo(0, -1); cx.lineTo(0.25, -0.2); cx.lineTo(-0.2, -0.1); cx.closePath(); cx.fill();
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
                    const tl = p.tl || 0.06;
                    cx.moveTo(dpr * (p.x - p.vx * tl), dpr * (p.y - p.vy * tl));
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
        scenes = [];
        if (cx) {
            cx.setTransform(1, 0, 0, 1, 0, 0);
            cx.clearRect(0, 0, cv.width, cv.height);
        }
    }

    root.DopaParticles = {
        init, resize, confetti, stars, firework, coins, shockwave, gems, lightning, meteors, setAmbient, setScenes, clear,
        setScale(k) { scale = k; },
        setBudget(k) { budget = k; limit = Math.round(LIMIT * k); },
        setTimeScale(k) { timeScale = k; },
        count() { return list.length; },
        get limit() { return limit; },
        get mobile() { return mobile; },
    };
})(window);
