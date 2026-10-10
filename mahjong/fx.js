/* 演出（雷・光・火花・ゆれ・大きな 文字）
   ------------------------------------------------------------------
   画面いっぱいの Canvas に 線と 光を えがく 画面効果です（がぞうファイルは つかいません）。
   あがりの 大きさ（満貫・跳満・倍満・三倍満・役満）で 雷の 本数・光・ゆれが 大きく なります。
   設定の「ひかえめ」や、端末の「視差効果を へらす」では 光と ゆれを おさえます。
   ------------------------------------------------------------------ */
import { store } from './store.js';

const reduceMotion = () => store.settings.fx === 'lite' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export class FX {
    constructor(root) {
        this.root = root;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'fx-canvas';
        this.text = document.createElement('div');
        this.text.className = 'fx-text';
        root.append(this.canvas, this.text);
        this.ctx = this.canvas.getContext('2d');
        this.items = [];
        this.running = false;
        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize);
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this.resize);
        this.items = [];
        this.canvas.remove();
        this.text.remove();
    }

    resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = window.innerWidth, h = window.innerHeight;
        this.w = w; this.h = h; this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    add(item) {
        item.t0 = performance.now();
        this.items.push(item);
        if (!this.running) {
            this.running = true;
            requestAnimationFrame(t => this.frame(t));
        }
    }

    frame(now) {
        const c = this.ctx;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.clearRect(0, 0, this.w, this.h);
        this.items = this.items.filter(it => {
            const t = now - it.t0;
            if (t < 0) return true;
            c.save();
            const alive = it.draw(c, t, this);
            c.restore();
            return alive;
        });
        if (this.items.length) requestAnimationFrame(tt => this.frame(tt));
        else { this.running = false; c.clearRect(0, 0, this.w, this.h); }
    }

    clear() {
        this.items = [];
        this.text.innerHTML = '';
    }

    /* ── 光 ── */

    flash(color = '#ffffff', dur = 220, alpha = 0.85, delay = 0) {
        if (reduceMotion()) alpha *= 0.35;
        const it = {
            draw: (c, t) => {
                const k = t / dur;
                if (k >= 1) return false;
                c.globalAlpha = alpha * (1 - k) * (1 - k);
                c.fillStyle = color;
                c.fillRect(0, 0, this.w, this.h);
                return true;
            }
        };
        setTimeout(() => this.add(it), delay);
    }

    /** 画面を くらく する（演出の まえに） */
    dim(dur = 1200, alpha = 0.55) {
        this.add({
            draw: (c, t) => {
                const k = t / dur;
                if (k >= 1) return false;
                const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
                c.globalAlpha = alpha * a;
                c.fillStyle = '#05070f';
                c.fillRect(0, 0, this.w, this.h);
                return true;
            }
        });
    }

    /* ── 雷 ── */

    /**
     * 雷を おとす
     * level：0〜5（本数と ふとさ）。target：おちる 場所（画面の 座標）
     */
    lightning(level = 1, target = null) {
        const lite = reduceMotion();
        const n = lite ? Math.min(2, 1 + level) : [1, 1, 2, 3, 5, 9][level] || 1;
        const tx = target ? target.x : this.w / 2;
        const ty = target ? target.y : this.h * 0.45;
        for (let i = 0; i < n; i++) {
            const delay = i === 0 ? 0 : 90 + i * (level >= 5 ? 110 : 160) + Math.random() * 80;
            const x1 = i === 0 ? tx : tx + (Math.random() - 0.5) * this.w * 0.9;
            const y1 = i === 0 ? ty : ty + (Math.random() - 0.5) * this.h * 0.3;
            const x0 = x1 + (Math.random() - 0.5) * this.w * 0.5;
            const width = 1.6 + level * 0.5 + (i === 0 ? 1 : 0);
            const bolt = makeBolt(x0, -20, x1, y1, Math.max(this.w, this.h) * 0.12, 0);
            const color = level >= 5 ? `hsl(${(i * 47) % 360} 100% 75%)` : level >= 3 ? '#ffe58a' : '#bcd6ff';
            setTimeout(() => {
                this.add({
                    draw: (c, t) => {
                        // ピカッ・ピカッと 2〜3回 ひかる
                        const pattern = [[0, 70], [110, 190], [240, 420]];
                        let a = 0;
                        for (const [s, e] of pattern) if (t >= s && t < e) a = 1 - (t - s) / (e - s) * 0.4;
                        if (t > 420) a = Math.max(0, 1 - (t - 420) / 260) * 0.5;
                        if (t > 700) return false;
                        if (a <= 0) return true;
                        drawBolt(c, bolt, width, color, a);
                        return true;
                    }
                });
                this.flash(level >= 5 ? '#fff6d0' : '#e8f0ff', 160 + level * 30, lite ? 0.25 : 0.55 + level * 0.07);
                // おちた 場所の 火花
                this.burst(x1, y1, { count: lite ? 8 : 14 + level * 6, colors: level >= 3 ? ['#fff', '#ffe58a', '#ffc94d'] : ['#fff', '#cfe0ff', '#9cc0ff'], speed: 3 + level });
            }, delay);
        }
    }

    /* ── 火花・紙ふぶき ── */

    burst(x, y, { count = 24, colors = ['#fff', '#ffe58a'], speed = 4, gravity = 0.12, life = 900, size = 2.4 } = {}) {
        if (reduceMotion()) count = Math.ceil(count / 3);
        const ps = [];
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const v = speed * (0.4 + Math.random());
            ps.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - speed * 0.4, c: colors[i % colors.length], s: size * (0.6 + Math.random()) });
        }
        this.add({
            draw: (c, t) => {
                if (t > life) return false;
                const k = t / life;
                c.globalCompositeOperation = 'lighter';
                for (const p of ps) {
                    p.x += p.vx; p.y += p.vy; p.vy += gravity; p.vx *= 0.985;
                    c.globalAlpha = 1 - k;
                    c.fillStyle = p.c;
                    c.beginPath();
                    c.arc(p.x, p.y, p.s * (1 - k * 0.5), 0, Math.PI * 2);
                    c.fill();
                }
                return true;
            }
        });
    }

    /** 上から ふる 光の つぶ（役満・トップ） */
    rain(dur = 3000, { colors = ['#fff4b0', '#ffd34d', '#ffffff'], count = 90, rainbow = false } = {}) {
        if (reduceMotion()) count = 25;
        const ps = [];
        for (let i = 0; i < count; i++) {
            ps.push({ x: Math.random() * this.w, y: -Math.random() * this.h, v: 1.5 + Math.random() * 3.5, s: 1.5 + Math.random() * 3, w: Math.random() * Math.PI * 2, c: colors[i % colors.length], hue: Math.random() * 360 });
        }
        this.add({
            draw: (c, t) => {
                if (t > dur) return false;
                const fade = t > dur - 600 ? (dur - t) / 600 : 1;
                c.globalCompositeOperation = 'lighter';
                for (const p of ps) {
                    p.y += p.v; p.w += 0.08; p.x += Math.sin(p.w) * 0.6;
                    if (p.y > this.h + 10) { p.y = -10; p.x = Math.random() * this.w; }
                    c.globalAlpha = fade * 0.9;
                    c.fillStyle = rainbow ? `hsl(${(p.hue + t / 6) % 360} 100% 70%)` : p.c;
                    c.beginPath();
                    c.arc(p.x, p.y, p.s, 0, Math.PI * 2);
                    c.fill();
                }
                return true;
            }
        });
    }

    /** うしろで まわる 光の すじ */
    rays(x, y, dur = 1800, { color = '255,226,120', count = 16, rainbow = false, alpha = 0.16 } = {}) {
        if (reduceMotion()) alpha *= 0.4;
        const r = Math.hypot(this.w, this.h);
        this.add({
            draw: (c, t) => {
                if (t > dur) return false;
                const k = t / dur;
                const a = (k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1) * alpha;
                c.translate(x, y);
                c.rotate(t / 1400);
                c.globalCompositeOperation = 'lighter';
                for (let i = 0; i < count; i++) {
                    const ang = (i / count) * Math.PI * 2;
                    const g = c.createLinearGradient(0, 0, Math.cos(ang) * r, Math.sin(ang) * r);
                    const col = rainbow ? hslToRgb((i / count) * 360 + t / 8) : color;
                    g.addColorStop(0, `rgba(${col},${a})`);
                    g.addColorStop(1, `rgba(${col},0)`);
                    c.fillStyle = g;
                    c.beginPath();
                    c.moveTo(0, 0);
                    c.arc(0, 0, r, ang - 0.035, ang + 0.035);
                    c.closePath();
                    c.fill();
                }
                return true;
            }
        });
    }

    /** 1本の 光の 線（リーチ） */
    beam(y, { color = '255,240,170', dur = 700, height = 120 } = {}) {
        this.add({
            draw: (c, t) => {
                if (t > dur) return false;
                const k = t / dur;
                const a = Math.sin(k * Math.PI);
                const g = c.createLinearGradient(0, y - height / 2, 0, y + height / 2);
                g.addColorStop(0, `rgba(${color},0)`);
                g.addColorStop(0.5, `rgba(${color},${0.75 * a})`);
                g.addColorStop(1, `rgba(${color},0)`);
                c.globalCompositeOperation = 'lighter';
                c.fillStyle = g;
                const x0 = -this.w + k * this.w * 2.2;
                c.fillRect(Math.max(0, x0), y - height / 2, this.w, height);
                c.fillStyle = `rgba(255,255,255,${0.9 * a})`;
                c.fillRect(0, y - 1.5, this.w, 3);
                return true;
            }
        });
    }

    /* ── ゆれ ── */

    shake(el, power = 6, dur = 450) {
        if (reduceMotion() || !el) return;
        const t0 = performance.now();
        const step = now => {
            const t = now - t0;
            if (t > dur) { el.style.transform = ''; return; }
            const k = 1 - t / dur;
            const dx = (Math.random() - 0.5) * 2 * power * k, dy = (Math.random() - 0.5) * 2 * power * k;
            el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /* ── 大きな 文字 ── */

    /**
     * 大きな 文字を 出す（style: 'ron' | 'tsumo' | 'riichi' | 'call' | 'tier' | 'ryuukyoku' | 'info'）
     * at：{x, y} を 中心に（なければ 画面の まんなか）
     */
    bigText(text, { style = 'call', at = null, dur = 1100, level = 0 } = {}) {
        const el = document.createElement('div');
        el.className = `bigtext bt-${style} lv${level}`;
        el.innerHTML = `<span>${text}</span>`;
        if (at) { el.style.left = at.x + 'px'; el.style.top = at.y + 'px'; }
        else { el.style.left = '50%'; el.style.top = '45%'; }
        el.style.setProperty('--dur', dur + 'ms');
        this.text.appendChild(el);
        setTimeout(() => el.remove(), dur + 50);
        return el;
    }
}

/* 稲妻の 形（まんなかを ずらしながら 分けていく） */
function makeBolt(x0, y0, x1, y1, disp, depth) {
    let pts = [[x0, y0], [x1, y1]];
    let d = disp;
    for (let i = 0; i < 7; i++) {
        const np = [pts[0]];
        for (let j = 0; j < pts.length - 1; j++) {
            const [ax, ay] = pts[j], [bx, by] = pts[j + 1];
            const mx = (ax + bx) / 2 + (Math.random() - 0.5) * d;
            const my = (ay + by) / 2 + (Math.random() - 0.5) * d * 0.3;
            np.push([mx, my], pts[j + 1]);
        }
        pts = np;
        d *= 0.55;
    }
    const branches = [];
    if (depth < 2) {
        const nb = depth === 0 ? 2 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2);
        for (let b = 0; b < nb; b++) {
            const idx = Math.floor(pts.length * (0.2 + Math.random() * 0.6));
            const [sx, sy] = pts[idx];
            const len = Math.hypot(x1 - x0, y1 - y0) * (0.2 + Math.random() * 0.25);
            const ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() - 0.5) * 1.6;
            branches.push(makeBolt(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, disp * 0.4, depth + 1));
        }
    }
    return { pts, branches, depth };
}

function drawBolt(c, bolt, width, color, a) {
    const path = () => {
        c.beginPath();
        c.moveTo(bolt.pts[0][0], bolt.pts[0][1]);
        for (const [x, y] of bolt.pts) c.lineTo(x, y);
    };
    const w = width / (bolt.depth + 1);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.globalCompositeOperation = 'lighter';
    // まわりの 光
    c.globalAlpha = a * 0.35;
    c.strokeStyle = color;
    c.lineWidth = w * 7;
    c.shadowColor = color;
    c.shadowBlur = 30;
    path(); c.stroke();
    // しん
    c.shadowBlur = 12;
    c.globalAlpha = a;
    c.strokeStyle = '#ffffff';
    c.lineWidth = w;
    path(); c.stroke();
    for (const b of bolt.branches) drawBolt(c, b, width * 0.7, color, a * 0.8);
}

function hslToRgb(h) {
    h = ((h % 360) + 360) % 360;
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return `${f(0)},${f(8)},${f(4)}`;
}
