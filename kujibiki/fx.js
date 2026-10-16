/* くじびき ひろば ── 演出（紙ふぶき・花火・火花・フラッシュ・画面ゆれ）
   Particles は どの canvas にも つかえる 小さな つぶの しくみ。
   KujiFX は 画面 いっぱいの canvas（#fx）に 出す ときの 入り口。
   つぶが 1つも ない ときは 絵を かきなおさない（電池に やさしく）。 */
(function (root) {
    'use strict';

    const CONFETTI = ['#ff3b6b', '#ffd23f', '#3bd6ff', '#7cff6b', '#b46bff', '#ff8a3b', '#ffffff', '#ff6bd6'];
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];

    class Particles {
        constructor() { this.list = []; }
        get alive() { return this.list.length > 0; }
        add(p) {
            p.age = 0;
            p.life = p.life || 1;
            this.list.push(p);
            if (this.list.length > 2500) this.list.splice(0, this.list.length - 2500);
            return p;
        }
        /* 紙ふぶき：上から ふる（w,h は canvas の 大きさ） */
        confetti(w, h, n) {
            for (let i = 0; i < n; i++) {
                this.add({
                    k: 'c', x: rand(0, w), y: rand(-h * 0.6, -10), vx: rand(-60, 60), vy: rand(80, 220),
                    rot: rand(0, 6.3), vr: rand(-8, 8), flip: rand(0, 6.3), vf: rand(6, 14),
                    size: rand(7, 14), color: pick(CONFETTI), life: rand(3.5, 6), g: 120, drag: 0.6,
                });
            }
        }
        /* 紙ふぶき：1点から はじける */
        confettiBurst(x, y, n, power) {
            power = power || 1;
            for (let i = 0; i < n; i++) {
                const a = rand(-Math.PI, 0) + rand(-0.4, 0.4);
                const s = rand(250, 900) * power;
                this.add({
                    k: 'c', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                    rot: rand(0, 6.3), vr: rand(-10, 10), flip: rand(0, 6.3), vf: rand(6, 14),
                    size: rand(7, 13), color: pick(CONFETTI), life: rand(2.5, 4.5), g: 520, drag: 1.8,
                });
            }
        }
        /* 火花：x,y から ちる。opts.dir（向き・ラジアン）と spread で かたよらせる */
        sparks(x, y, n, opts) {
            opts = opts || {};
            const colors = opts.colors || ['#fff7c2', '#ffd23f', '#ff9a2e', '#ff5a1f'];
            for (let i = 0; i < n; i++) {
                const a = opts.dir == null ? rand(0, Math.PI * 2) : opts.dir + rand(-1, 1) * (opts.spread || 1);
                const s = rand(opts.min || 60, opts.max || 320);
                this.add({
                    k: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: pick(colors),
                    life: rand(opts.lifeMin || 0.2, opts.lifeMax || 0.6), g: opts.g == null ? 500 : opts.g, drag: 2.2,
                    width: opts.width || rand(1.2, 2.6),
                });
            }
        }
        /* 花火：まるく ひろがって おちる */
        firework(x, y, color, n) {
            n = n || 70;
            const cols = color ? [color, '#ffffff'] : [pick(CONFETTI), pick(CONFETTI), '#ffffff'];
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
                const s = rand(220, 420);
                this.add({ k: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: pick(cols), life: rand(0.9, 1.5), g: 160, drag: 1.6, width: rand(2, 3.4), twinkle: true });
            }
            this.add({ k: 'ring', x, y, r: 10, vr: 600, color: cols[0], life: 0.45, width: 6 });
        }
        /* 光の わ（衝撃波） */
        ring(x, y, color, speed, width) {
            this.add({ k: 'ring', x, y, r: 6, vr: speed || 700, color: color || '#ffffff', life: 0.55, width: width || 8 });
        }
        /* キラキラの ほし */
        stars(x, y, n, radius) {
            for (let i = 0; i < n; i++) {
                const a = rand(0, 6.3), d = rand(0, radius || 60);
                this.add({ k: 'star', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-30, 30), vy: rand(-80, -10), size: rand(4, 10), color: pick(['#ffffff', '#fff3a0', '#9ef3ff']), life: rand(0.5, 1.2), g: 0, drag: 1 });
            }
        }
        /* けむり */
        smoke(x, y, n, size) {
            for (let i = 0; i < n; i++) {
                this.add({ k: 'smoke', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-25, 25), vy: rand(-70, -25), r: rand(3, 6) * (size || 1), vr: rand(14, 30) * (size || 1), life: rand(0.6, 1.3), g: -10, drag: 1, shade: rand(70, 140) });
            }
        }
        update(dt) {
            const L = this.list;
            for (let i = L.length - 1; i >= 0; i--) {
                const p = L[i];
                p.age += dt;
                if (p.age >= p.life) { L.splice(i, 1); continue; }
                if (p.k === 'ring') { p.r += p.vr * dt; continue; }
                const d = Math.exp(-(p.drag || 0) * dt);
                p.vx *= d; p.vy *= d;
                p.vy += (p.g || 0) * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.k === 'c') { p.rot += p.vr * dt; p.flip += p.vf * dt; p.vx += Math.sin(p.flip * 0.7) * 40 * dt; }
                if (p.k === 'smoke') p.r += p.vr * dt;
            }
        }
        draw(c) {
            const L = this.list;
            // けむり → 紙ふぶき → ひかる もの（たしざん）
            for (const p of L) {
                if (p.k !== 'smoke') continue;
                const t = p.age / p.life;
                c.globalAlpha = 0.35 * (1 - t);
                c.fillStyle = `rgb(${p.shade},${p.shade},${p.shade})`;
                c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
            }
            for (const p of L) {
                if (p.k !== 'c') continue;
                const t = p.age / p.life;
                c.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
                c.save();
                c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.flip));
                c.fillStyle = p.color;
                c.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
                c.restore();
            }
            c.globalCompositeOperation = 'lighter';
            for (const p of L) {
                const t = p.age / p.life;
                if (p.k === 's') {
                    let a = 1 - t;
                    if (p.twinkle && t > 0.5) a *= 0.5 + 0.5 * Math.sin(p.age * 40);
                    c.globalAlpha = Math.max(0, a);
                    c.strokeStyle = p.color; c.lineWidth = p.width; c.lineCap = 'round';
                    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
                } else if (p.k === 'ring') {
                    c.globalAlpha = 1 - t;
                    c.strokeStyle = p.color; c.lineWidth = p.width * (1 - t) + 1;
                    c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.stroke();
                } else if (p.k === 'star') {
                    c.globalAlpha = Math.sin(t * Math.PI);
                    c.fillStyle = p.color;
                    const s = p.size;
                    c.beginPath();
                    c.moveTo(p.x, p.y - s); c.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
                    c.quadraticCurveTo(p.x, p.y, p.x, p.y + s); c.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
                    c.quadraticCurveTo(p.x, p.y, p.x, p.y - s); c.fill();
                }
            }
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = 1;
        }
    }

    /* ---------- 画面 いっぱいの 演出 ---------- */
    let cv = null, cx = null, dpr = 1, W = 0, H = 0, raf = 0, last = 0;
    const P = new Particles();

    function setup() {
        cv = document.getElementById('fx');
        if (!cv) return;
        cx = cv.getContext('2d');
        resize();
        root.addEventListener('resize', resize);
    }
    function resize() {
        if (!cv) return;
        dpr = Math.min(2, root.devicePixelRatio || 1);
        W = root.innerWidth; H = root.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    function kick() {
        if (raf || !cx) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }
    function frame(t) {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        P.update(dt);
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, cv.width, cv.height);
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        P.draw(cx);
        if (P.alive || pending.length) raf = requestAnimationFrame(frame);
        else { raf = 0; cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); }
    }
    /* あとから 出す 花火など */
    const pending = [];
    function later(ms, fn) {
        const id = setTimeout(() => { pending.splice(pending.indexOf(id), 1); fn(); kick(); }, ms);
        pending.push(id);
    }
    function clearAll() {
        pending.splice(0).forEach(clearTimeout);
        P.list.length = 0;
    }

    const FX = {
        P,
        confetti(n) { P.confetti(W, H, n || 160); kick(); },
        confettiBurst(x, y, n, power) { P.confettiBurst(x, y, n || 120, power); kick(); },
        sparks(x, y, n, opts) { P.sparks(x, y, n || 40, opts); kick(); },
        stars(x, y, n, r) { P.stars(x, y, n || 20, r); kick(); },
        ring(x, y, color, speed, width) { P.ring(x, y, color, speed, width); kick(); },
        firework(x, y, color, n) { P.firework(x == null ? rand(W * 0.15, W * 0.85) : x, y == null ? rand(H * 0.12, H * 0.45) : y, color, n); kick(); },
        /* 花火を count 発、ms の あいだに */
        fireworks(count, ms) {
            for (let i = 0; i < count; i++) later(rand(0, ms || 1500), () => P.firework(rand(W * 0.12, W * 0.88), rand(H * 0.1, H * 0.5)));
            kick();
        },
        /* 画面が ぴかっと 光る */
        flash(color, ms) {
            const el = document.getElementById('flash');
            if (!el) return;
            el.style.background = color || '#fff';
            el.classList.remove('on'); void el.offsetWidth;
            el.style.animationDuration = (ms || 500) + 'ms';
            el.classList.add('on');
        },
        /* 画面が ゆれる */
        shake(strength, ms) {
            const el = document.getElementById('app');
            if (!el) return;
            el.style.setProperty('--shake', (strength || 10) + 'px');
            el.classList.remove('shake'); void el.offsetWidth;
            el.style.animationDuration = (ms || 500) + 'ms';
            el.classList.add('shake');
        },
        clear: clearAll,
        size: () => ({ w: W, h: H }),
    };

    root.KujiParticles = Particles;
    root.KujiFX = FX;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})(window);
