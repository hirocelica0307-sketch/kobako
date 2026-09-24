/* もりあげる 見ため（かみふぶき・ふきだし・リアクション）
   ------------------------------------------------------------------
   ・どれも 画面の 上に かさねて 出すだけで、ならびかたは かえません
     （キーボードや 絵の 大きさが ずれない ように）。
   ・「うごきを へらす」設定の 端末では、かみふぶきは 出しません。
   ------------------------------------------------------------------ */

const reduced = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

const CONFETTI_COLORS = ['#f0624d', '#f5a524', '#f2c12e', '#46a83c', '#2f9bd6', '#8a63d2', '#e0569b'];

/**
 * かみふぶきを ふらせます。
 * @param {object} opt
 *   opt.count  かみの 数（既定 110）
 *   opt.from   'top'（上から ふる）／'center'（まんなかから はじける）
 */
export function confetti(opt = {}) {
    if (reduced()) return;
    const count = opt.count || 110;
    const cv = document.createElement('canvas');
    cv.className = 'fx-confetti';
    document.body.appendChild(cv);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    const burst = opt.from === 'center';
    const parts = [];
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
        parts.push({
            x: burst ? W / 2 : Math.random() * W,
            y: burst ? H / 2.4 : -20 - Math.random() * H * 0.3,
            vx: burst ? Math.cos(a) * sp : (Math.random() - 0.5) * 2,
            vy: burst ? Math.sin(a) * sp - 4 : 2 + Math.random() * 3,
            r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
            w: 7 + Math.random() * 7, h: 4 + Math.random() * 5,
            c: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        });
    }
    const t0 = performance.now(), LIFE = 2600;
    function step(t) {
        const age = t - t0;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = age > LIFE - 600 ? Math.max(0, (LIFE - age) / 600) : 1;
        for (const p of parts) {
            p.vy += 0.18; p.vx *= 0.99; p.vy = Math.min(p.vy, 6);
            p.x += p.vx; p.y += p.vy; p.r += p.vr;
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.r);
            ctx.fillStyle = p.c;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (age < LIFE) requestAnimationFrame(step);
        else cv.remove();
    }
    requestAnimationFrame(step);
}

/**
 * 絵の 上に ふきだしを 出します（すこし たつと 消えます）。
 * @param {HTMLElement} box  出す ところ（position:relative の はこ）
 * @param {string} text
 * @param {string} [color]  ふちの 色
 */
export function toast(box, text, color) {
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'fx-toast';
    el.textContent = text;
    if (color) el.style.setProperty('--c', color);
    /* 前の ふきだしが のこって いれば、下に ずらして かさならない ように */
    const n = box.querySelectorAll('.fx-toast').length;
    el.style.top = (62 + n * 46) + 'px';   /* 上は ヒントの ぶん あけます */
    box.appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

/**
 * リアクション（👍 など）を 絵の 下から ふわっと うかべます。
 * @param {HTMLElement} box
 * @param {string} emoji
 */
export function floatEmoji(box, emoji) {
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'fx-float';
    el.textContent = emoji;
    el.style.left = (12 + Math.random() * 76) + '%';
    el.style.setProperty('--drift', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
    box.appendChild(el);
    setTimeout(() => el.remove(), 2200);
}
