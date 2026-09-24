/* おえかきの ばん（canvas）
   ------------------------------------------------------------------
   ・下の canvas … かき おわった線。線が 1本 ふえるたびに 足して かきます。
   ・上の canvas … いま だれかが かいている とちゅうの線。まいかい かきなおします。
     2まい 重ねることで、線が ふえても おそくなりません。

   点は 0〜1000 の 整数で もちます。画面の 大きさが ちがっても
   同じ かたちに なります（たて よこの 比は 4:3 に そろえています）。

   線の ほかに、こんな ものも「1本の 線」と 同じように やりとりします。
     ・にじいろ … color が 'rainbow'。すすむ ほど 色が かわります
     ・スタンプ … kind:'stamp'、shape は 'star'（ほし）か 'heart'（ハート）
     ・バケツ   … kind:'fill'。おした ところと つながった 同じ色の ところを ぬります
   ------------------------------------------------------------------ */

const UNIT = 1000;            // 点の めもり
const MIN_GAP = 4;            // これより 近い点は 記録しない（むだな データを へらす）
export const ERASER = '#ffffff';
export const RAINBOW = 'rainbow';

/** 色あい（0〜360）から「#rrggbb」を 作ります（にじいろの スタンプ・バケツ用）*/
export function hueHex(h) {
    const f = n => {
        const k = (n + h / 30) % 12;
        const c = 0.5 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
}
const hexRGB = hex => {
    const n = parseInt(String(hex).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

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
    let tool = 'pen';            // 'pen'（ペン）／'fill'（バケツ）／'star'・'heart'（スタンプ）
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
    /* canvas の 大きさを かえると 中身が 消えて、ぜんぶ かきなおしに なります
       （バケツが 多いと 重い）。大きさが かわらない ときは なにも しません。 */
    function fit() {
        layout();
        const rect = base.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = Math.max(1, Math.round(rect.width * dpr));
        const H = Math.max(1, Math.round(rect.height * dpr));
        if (base.width === W && base.height === H && overlay.width === W && overlay.height === H) return;
        for (const c of [base, overlay]) {
            c.width = W;
            c.height = H;
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
        if (stroke.kind === 'fill') { if (ctx === bctx) floodFill(stroke); return; }
        if (stroke.kind === 'stamp') { paintStamp(ctx, stroke); return; }
        if (stroke.color === RAINBOW) { paintRainbow(ctx, stroke); return; }
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

    /* にじいろの 線。すこしずつ 色を かえながら つないで いきます */
    function paintRainbow(ctx, stroke) {
        const pts = stroke.pts;
        const { w, h } = size();
        const lw = Math.max(1, (stroke.w || width) / UNIT * w);
        const X = i => pts[i] / UNIT * w;
        const Y = i => pts[i] / UNIT * h;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (pts.length === 2) {
            ctx.fillStyle = hueHex(0);
            ctx.beginPath(); ctx.arc(X(0), Y(1), lw / 2, 0, Math.PI * 2); ctx.fill();
            return;
        }
        for (let i = 2; i < pts.length; i += 2) {
            ctx.strokeStyle = hueHex((i * 6) % 360);
            ctx.beginPath();
            ctx.moveTo(X(i - 2), Y(i - 1));
            ctx.lineTo(X(i), Y(i + 1));
            ctx.stroke();
        }
    }

    /* スタンプ（ほし・ハート）。大きさは ペンの ふとさで かわります */
    function paintStamp(ctx, stroke) {
        const { w, h } = size();
        const cx = stroke.pts[0] / UNIT * w, cy = stroke.pts[1] / UNIT * h;
        const r = Math.max(6, (stroke.w || width) * 1.8 / UNIT * w);
        ctx.fillStyle = stroke.color || '#000';
        ctx.beginPath();
        if (stroke.shape === 'heart') {
            ctx.moveTo(cx, cy + r * 0.9);
            ctx.bezierCurveTo(cx - r * 1.3, cy + r * 0.05, cx - r * 0.95, cy - r * 1.05, cx, cy - r * 0.45);
            ctx.bezierCurveTo(cx + r * 0.95, cy - r * 1.05, cx + r * 1.3, cy + r * 0.05, cx, cy + r * 0.9);
        } else {
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * Math.PI / 5;
                const rr = i % 2 === 0 ? r : r * 0.45;
                const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
        ctx.fill();
    }

    /* バケツ。おした ところと つながった「だいたい 同じ色」の ところを ぬります。
       線の ふちは 色が うすく まざって いるので、ぬった あと 1ドット ひろげて
       すきまが 白く のこらない ように します。
       （画面の こまかさは 人ごとに ちがうので、ぬれる はんいは ほぼ 同じ に なります）*/
    function floodFill(stroke) {
        const W = base.width, H = base.height;
        if (!W || !H) return;
        const px = Math.min(W - 1, Math.max(0, Math.floor(stroke.pts[0] / UNIT * W)));
        const py = Math.min(H - 1, Math.max(0, Math.floor(stroke.pts[1] / UNIT * H)));
        const img = bctx.getImageData(0, 0, W, H);
        const d = img.data;
        /* すきとおった ところは 白（ばんの 地の 色）として あつかいます。
           1ドットごとに よばれるので、配列を 作らずに 計算します（はやさの ため）*/
        const ch = (i, k) => { const a = d[i + 3]; return (d[i + k] * a + 255 * (255 - a)) / 255; };
        const s0 = (py * W + px) * 4;
        const tr = ch(s0, 0), tg = ch(s0, 1), tb = ch(s0, 2);
        const [fr, fg, fb] = hexRGB(stroke.color || '#000');
        if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 12) return;   // もう その色
        const TOL = 90;
        const same = p => {
            const i = p * 4;
            return Math.abs(ch(i, 0) - tr) + Math.abs(ch(i, 1) - tg) + Math.abs(ch(i, 2) - tb) <= TOL;
        };
        const mask = new Uint8Array(W * H);
        const stack = [py * W + px];
        mask[py * W + px] = 1;
        while (stack.length) {
            const p = stack.pop();
            const x = p % W;
            if (x > 0 && !mask[p - 1] && same(p - 1)) { mask[p - 1] = 1; stack.push(p - 1); }
            if (x < W - 1 && !mask[p + 1] && same(p + 1)) { mask[p + 1] = 1; stack.push(p + 1); }
            if (p >= W && !mask[p - W] && same(p - W)) { mask[p - W] = 1; stack.push(p - W); }
            if (p < W * (H - 1) && !mask[p + W] && same(p + W)) { mask[p + W] = 1; stack.push(p + W); }
        }
        const paintAt = p => { const i = p * 4; d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255; };
        for (let p = 0; p < W * H; p++) {
            if (mask[p] === 1) {
                paintAt(p);
                const x = p % W;
                if (x > 0 && !mask[p - 1]) { mask[p - 1] = 2; paintAt(p - 1); }
                if (x < W - 1 && !mask[p + 1]) { mask[p + 1] = 2; paintAt(p + 1); }
                if (p >= W && !mask[p - W]) { mask[p - W] = 2; paintAt(p - W); }
                if (p < W * (H - 1) && !mask[p + W]) { mask[p + W] = 2; paintAt(p + W); }
            }
        }
        bctx.putImageData(img, 0, 0);
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
        /* バケツ・スタンプは おした しゅんかんに できあがり */
        if (tool !== 'pen') {
            const c = color === RAINBOW ? hueHex(Math.floor(Math.random() * 360)) : color;
            onFinish(tool === 'fill'
                ? { kind: 'fill', color: c, pts: [x, y] }
                : { kind: 'stamp', shape: tool, color: c, w: width, pts: [x, y] });
            return;
        }
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
        /** 'pen'／'fill'／'star'／'heart' */
        setTool(t) { tool = t; },
        getColor: () => color,
        setEnabled(v) { canDraw = !!v; overlay.style.cursor = v ? 'crosshair' : 'default'; },
        /** よこに ならぶ はこ（どうぐ／キーボード）に のこす 最低の はば */
        setSideMin(px) { if (px !== sideMin) { sideMin = px; fit(); } },

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
        /** かき おわった線を ぜんぶ わすれます（でんごんで、じぶんだけの 絵を かく とき）*/
        clearAll() { strokes.clear(); liveOthers = {}; drawing = null; redrawAll(); },
        /** いま 何本 あるか */
        count: () => strokes.size,
        /**
         * いまの 絵を 小さな 画像（JPEG の data URL）に します。
         * ギャラリーや でんごんで つかいます。白い 地を しいてから うつします。
         */
        snapshot(w = 360, quality = 0.72) {
            const h = Math.round(w * 3 / 4);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const x = c.getContext('2d');
            x.fillStyle = '#fff';
            x.fillRect(0, 0, w, h);
            if (base.width && base.height) x.drawImage(base, 0, 0, w, h);
            return c.toDataURL('image/jpeg', quality);
        },
        refit: fit
    };
}
