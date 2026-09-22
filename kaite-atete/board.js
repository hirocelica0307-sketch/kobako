/* おえかきの ばん（canvas）
   ------------------------------------------------------------------
   ・下の canvas … かき おわった線。線が 1本 ふえるたびに 足して かきます。
   ・上の canvas … いま だれかが かいている とちゅうの線。まいかい かきなおします。
     2まい 重ねることで、線が ふえても おそくなりません。

   点は 0〜1000 の 整数で もちます。画面の 大きさが ちがっても
   同じ かたちに なります（たて よこの 比は 4:3 に そろえています）。
   ------------------------------------------------------------------ */

const UNIT = 1000;            // 点の めもり
const MIN_GAP = 4;            // これより 近い点は 記録しない（むだな データを へらす）
export const ERASER = '#ffffff';

/**
 * @param {object} opt
 *   opt.base     下の canvas（かき おわった線）
 *   opt.overlay  上の canvas（かいている とちゅう）
 *   opt.onProgress(stroke) かいている とちゅうに ときどき よばれる
 *   opt.onFinish(stroke)   ふでを はなした ときに よばれる
 */
export function createBoard(opt) {
    const { base, overlay } = opt;
    const onProgress = opt.onProgress || (() => {});
    const onFinish = opt.onFinish || (() => {});
    /* ?? を つかうのは、0（毎回 送る）を わたされたときに
       70 に 化けてしまうのを ふせぐためです */
    const sendEvery = opt.sendEvery ?? 70;      // とちゅう経過を 送る 間かく（ミリ秒）

    const bctx = base.getContext('2d');
    const octx = overlay.getContext('2d');

    const strokes = new Map();   // かき おわった線（ID → 線）
    let liveOthers = {};         // ほかの人が かいている とちゅうの線
    let drawing = null;          // 自分が いま かいている線
    let canDraw = true;
    let color = '#33291f';
    let width = 16;
    let lastSent = 0;
    let redrawWanted = false;

    /* ── 外わくの 大きさを きめる ─────────────────
       よこに キーボードが ならぶので、絵が ばしょを とりすぎると
       キーが つぶれます。のこりの ばしょから 絵の 大きさを 計算します。
       （CSS の aspect-ratio だけでは よこはばからの 上限が かけられません）*/
    let sideMin = opt.sideMin || 330;

    function layout() {
        const wrap = base.parentElement;
        const area = wrap && wrap.parentElement;
        if (!wrap || !area) return;
        const areaW = area.clientWidth, areaH = area.clientHeight;
        if (!areaW || !areaH) return;

        const cs = getComputedStyle(area);
        const gap = parseFloat(cs.columnGap || cs.gap) || 10;
        const stacked = cs.flexDirection === 'column';

        let w;
        if (stacked) {
            /* たてに つむ ときは、絵に 半分ほど わたします */
            w = Math.min(areaW, areaH * 0.38 * 4 / 3);
        } else {
            w = Math.min(areaW - sideMin - gap, areaH * 4 / 3);
        }
        w = Math.max(160, Math.floor(w));
        wrap.style.width = w + 'px';
        wrap.style.height = Math.floor(w * 3 / 4) + 'px';
    }

    /* ── 大きさを そろえる ───────────────────── */
    function fit() {
        layout();
        const rect = base.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (const c of [base, overlay]) {
            c.width = Math.max(1, Math.round(rect.width * dpr));
            c.height = Math.max(1, Math.round(rect.height * dpr));
        }
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redrawAll();
    }

    const size = () => {
        const r = base.getBoundingClientRect();
        return { w: r.width, h: r.height };
    };

    /* ── 1本の線を かく ─────────────────────── */
    function paint(ctx, stroke) {
        const pts = stroke && stroke.pts;
        if (!pts || pts.length < 2) return;
        const { w, h } = size();
        const lw = Math.max(1, (stroke.w || width) / UNIT * w);
        const X = i => pts[i] / UNIT * w;
        const Y = i => pts[i] / UNIT * h;

        ctx.strokeStyle = stroke.color || '#000';
        ctx.fillStyle = stroke.color || '#000';
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (pts.length === 2) {                      // ちょんと おしただけ → まる
            ctx.beginPath();
            ctx.arc(X(0), Y(1), lw / 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(X(i), Y(i + 1));
        ctx.stroke();
    }

    function clearCtx(ctx, canvas) {
        const dpr = canvas.width / Math.max(1, size().w);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        void dpr;
    }

    /* かき おわった線を ぜんぶ かきなおします（消したときなど）。
       1回の 画面こうしんに まとめるので、いっぺんに 何本 消えても 平気です。 */
    function redrawAll() {
        if (redrawWanted) return;
        redrawWanted = true;
        requestAnimationFrame(() => {
            redrawWanted = false;
            clearCtx(bctx, base);
            for (const s of strokes.values()) paint(bctx, s);
            paintOverlay();
        });
    }

    function paintOverlay() {
        clearCtx(octx, overlay);
        for (const s of Object.values(liveOthers)) paint(octx, s);
        if (drawing) paint(octx, drawing);
    }

    /* ── 指・マウス・ペンの うごき ──────────────── */
    function posOf(e) {
        const r = base.getBoundingClientRect();
        const x = Math.round((e.clientX - r.left) / r.width * UNIT);
        const y = Math.round((e.clientY - r.top) / r.height * UNIT);
        return [Math.min(UNIT, Math.max(0, x)), Math.min(UNIT, Math.max(0, y))];
    }

    function pushPoint(x, y, force) {
        const p = drawing.pts;
        if (!force && p.length >= 2) {
            const dx = x - p[p.length - 2], dy = y - p[p.length - 1];
            if (dx * dx + dy * dy < MIN_GAP * MIN_GAP) return false;
        }
        p.push(x, y);
        return true;
    }

    overlay.addEventListener('pointerdown', e => {
        if (!canDraw) return;
        e.preventDefault();
        /* 端末に よっては 捕そくに 失敗します。できなくても かけるので 止めません */
        try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
        const [x, y] = posOf(e);
        drawing = { color, w: width, pts: [x, y] };
        lastSent = 0;
        paintOverlay();
    });

    overlay.addEventListener('pointermove', e => {
        if (!drawing) return;
        e.preventDefault();
        const [x, y] = posOf(e);
        if (!pushPoint(x, y)) return;
        paintOverlay();
        const now = Date.now();
        if (now - lastSent >= sendEvery) {
            lastSent = now;
            onProgress({ ...drawing, pts: drawing.pts.slice() });
        }
    });

    function finish(e) {
        if (!drawing) return;
        if (e) {
            const [x, y] = posOf(e);
            pushPoint(x, y, true);
        }
        const done = { ...drawing, pts: drawing.pts.slice() };
        drawing = null;
        paintOverlay();
        onFinish(done);
    }
    overlay.addEventListener('pointerup', finish);
    overlay.addEventListener('pointercancel', () => finish(null));
    overlay.addEventListener('pointerleave', e => { if (drawing) finish(e); });

    window.addEventListener('resize', fit);
    fit();

    return {
        setColor(c) { color = c; },
        setWidth(w) { width = w; },
        getColor: () => color,
        setEnabled(v) { canDraw = !!v; overlay.style.cursor = v ? 'crosshair' : 'default'; },
        /** よこに ならぶ はこ（どうぐ／キーボード）に のこす 最低の はば */
        setSideMin(px) { sideMin = px; fit(); },

        /** かき おわった線が 1本 ふえた */
        addStroke(id, stroke) {
            if (strokes.has(id)) return;
            strokes.set(id, stroke);
            paint(bctx, stroke);        // 1本 足すだけなので 速い
        },
        /** かき おわった線が 消えた（もどす・ぜんぶけす）*/
        dropStroke(id) {
            if (strokes.delete(id)) redrawAll();
        },
        /** ほかの人の とちゅう経過が 変わった */
        setLive(map, exceptId) {
            liveOthers = {};
            for (const [who, s] of Object.entries(map || {})) {
                if (who !== exceptId) liveOthers[who] = s;
            }
            paintOverlay();
        },
        refit: fit
    };
}
