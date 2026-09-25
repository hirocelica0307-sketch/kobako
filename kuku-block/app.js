/* くく ブロック ── アプリ本体
   ------------------------------------------------------------------
   ・つくえ（キャンバス）に ブロック・かこみ・かいた 線・はいけいの しゃしん を かきます
   ・ドラッグ ちゅうの ものは いちばん うえの キャンバス（dragLayer）に かくので、
     ブロックばこ や ごみばこ の うえでも 見えます
   ・かわった ときは ぜんぶ JSON に して「もどす」の れきしに つみます
   ・つくえの ようすは localStorage、しゃしんは IndexedDB（photos.js）に のこります
   ------------------------------------------------------------------ */
(function () {
    'use strict';

    const L = window.KukuLogic;
    const P = window.KukuPhotos;
    const SND = window.KukuSound;
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];

    const BLOCK_COLORS = { b: '#2f6fdc', r: '#e5413a' };
    const LOOP_COLORS = ['#f08a2c', '#2fa84f', '#8a5cd6', '#e0529c', '#1f9fb5', '#c9a100'];
    const PEN_COLORS = { k: '#2b2b2b', r: '#e5413a', b: '#2f6fdc', g: '#2fa84f' };
    const STATE_KEY = 'kuku-block/v1/state';
    const SET_KEY = 'kuku-block/v1/settings';

    /* ================================================================
       じょうたい・ほぞん・もどす
       ================================================================ */

    const emptyState = () => ({ size: 48, blocks: [], loops: [], strokes: [], bg: null, loopColor: 0, dan: null, card: null });

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* のこせなくても うごく */ } }

    function loadState() {
        try {
            const s = JSON.parse(lsGet(STATE_KEY));
            if (s && Array.isArray(s.blocks) && Array.isArray(s.loops) && Array.isArray(s.strokes)) {
                return Object.assign(emptyState(), s);
            }
        } catch (e) { /* こわれていたら あたらしく */ }
        return emptyState();
    }

    const settings = Object.assign(
        {
            snap: true, count: true, expr: false, sound: true, voice: true,
            rows: 4, cols: 3, arrC: 'b', penC: 'k', penW: 4, countMode: 'one',
            danLoops: true, danC: 'b', sceneKind: 'plate', sceneN: 4,
        },
        (() => { try { return JSON.parse(lsGet(SET_KEY)) || {}; } catch (e) { return {}; } })()
    );
    const saveSettings = () => lsSet(SET_KEY, JSON.stringify(settings));
    SND.setEnabled(settings.sound);

    let state = loadState();
    let saved = JSON.stringify(state);
    const undoStack = [];
    const redoStack = [];
    let persistTimer = 0;

    function persist() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => lsSet(STATE_KEY, saved), 250);
    }
    window.addEventListener('pagehide', () => lsSet(STATE_KEY, saved));

    /** いまの じょうたいを れきしに のこす（かわっていなければ なにも しない） */
    function commit() {
        const now = JSON.stringify(state);
        if (now === saved) return;
        undoStack.push(saved);
        if (undoStack.length > 120) undoStack.shift();
        redoStack.length = 0;
        saved = now;
        persist();
        updateUndoButtons();
    }

    function restore(json) {
        drags.clear();
        bgPointers.clear();
        state = JSON.parse(json);
        saved = json;
        persist();
        syncBg();
        updateUndoButtons();
        updateSizeUI();
        if (tool === 'photo' && !state.bg) setTool('move');
        resetCount();
        hideBubble();
        updateCard();
        requestRender();
    }

    function undo() {
        if (!undoStack.length || drags.size) return;
        redoStack.push(saved);
        restore(undoStack.pop());
    }

    function redo() {
        if (!redoStack.length || drags.size) return;
        undoStack.push(saved);
        restore(redoStack.pop());
    }

    function updateUndoButtons() {
        $('#btnUndo').disabled = !undoStack.length;
        $('#btnRedo').disabled = !redoStack.length;
    }

    let seq = 0;
    const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36);

    const blockById = (id) => state.blocks.find(b => b.id === id);
    const loopById = (id) => state.loops.find(l => l.id === id);

    /* ================================================================
       キャンバス
       ================================================================ */

    const wrap = $('#boardWrap');
    const canvas = $('#board');
    const ctx = canvas.getContext('2d');
    const layer = $('#dragLayer');
    const lctx = layer.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let rect = wrap.getBoundingClientRect();

    function resize() {
        rect = wrap.getBoundingClientRect();
        dpr = window.devicePixelRatio || 1;
        W = rect.width;
        H = rect.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        layer.width = Math.round(window.innerWidth * dpr);
        layer.height = Math.round(window.innerHeight * dpr);
        requestRender();
    }
    new ResizeObserver(resize).observe(wrap);
    window.addEventListener('resize', resize);

    const toBoard = (e) => [e.clientX - rect.left, e.clientY - rect.top];

    let dirty = false;
    function requestRender() {
        if (dirty) return;
        dirty = true;
        requestAnimationFrame(render);
    }

    function render() {
        dirty = false;
        const hide = hiddenIds();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawScene(ctx, W, H, { grid: true, hide, live: true });
        drawLayer(hide);
        updateExpr();
    }

    /* ---------- え を かく ---------- */

    let bgImage = null;
    let bgImageId = null;

    function imgSize(img) {
        return [img.naturalWidth || img.width, img.naturalHeight || img.height];
    }

    function drawScene(g, w, h, opts) {
        const S = state.size;
        g.fillStyle = '#fffdf8';
        g.fillRect(0, 0, w, h);

        if (state.bg && bgImage && bgImageId === state.bg.id) {
            const b = state.bg;
            const [iw, ih] = imgSize(bgImage);
            g.save();
            g.globalAlpha = b.alpha;
            g.translate(b.x, b.y);
            g.rotate(b.rot * Math.PI / 2);
            g.scale(b.s, b.s);
            g.imageSmoothingQuality = 'high';
            g.drawImage(bgImage, -iw / 2, -ih / 2, iw, ih);
            g.restore();
        }

        if (opts.grid && settings.snap) {
            g.beginPath();
            for (let x = S; x < w; x += S) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, h); }
            for (let y = S; y < h; y += S) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); }
            g.strokeStyle = state.bg ? 'rgba(0,0,0,.07)' : 'rgba(47,111,220,.09)';
            g.lineWidth = 1;
            g.stroke();
        }

        for (const l of state.loops) if (!opts.hide.has(l.id)) drawLoopFill(g, l);
        for (const b of state.blocks) if (!opts.hide.has(b.id)) drawBlock(g, b.x, b.y, S, b.c, false);
        for (const l of state.loops) if (!opts.hide.has(l.id)) drawLoopLine(g, l);
        drawCountMarks(g, opts.hide);
        for (const s of state.strokes) if (!opts.hide.has(s.id)) drawStroke(g, s);
        if (settings.count) {
            for (const l of state.loops) if (!opts.hide.has(l.id)) drawBadge(g, l);
        }

        if (opts.live) {
            for (const d of drags.values()) {
                if (d.type === 'lasso') drawLasso(g, d.pts);
                if (d.type === 'erase' && d.cur) drawEraser(g, d.cur);
            }
        }
    }

    function drawLayer(hide) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.clearRect(0, 0, layer.width, layer.height);
        if (!hide.size) return;
        lctx.translate(rect.left, rect.top);
        const S = state.size;
        for (const l of state.loops) if (hide.has(l.id)) drawLoopFill(lctx, l);
        for (const b of state.blocks) if (hide.has(b.id)) drawBlock(lctx, b.x, b.y, S, b.c, true);
        for (const l of state.loops) if (hide.has(l.id)) drawLoopLine(lctx, l);
        if (settings.count) for (const l of state.loops) if (hide.has(l.id)) drawBadge(lctx, l);
    }

    function roundRectPath(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function drawBlock(g, x, y, S, c, lift) {
        const inset = Math.max(1, S * 0.03);
        const s = S - inset * 2;
        x += inset; y += inset;
        g.save();
        roundRectPath(g, x, y, s, s, S * 0.12);
        if (lift) {
            g.shadowColor = 'rgba(0,0,0,.28)';
            g.shadowBlur = 12;
            g.shadowOffsetY = 5;
        }
        g.fillStyle = '#fdfdfb';
        g.fill();
        g.shadowColor = 'transparent';
        g.lineWidth = Math.max(1.2, S * 0.035);
        g.strokeStyle = '#9aa3b5';
        g.stroke();
        const cx = x + s / 2, cy = y + s / 2, r = s * 0.36;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = BLOCK_COLORS[c] || BLOCK_COLORS.b;
        g.fill();
        g.beginPath();
        g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.fill();
        g.restore();
    }

    function loopPath(g, pts) {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
    }

    function drawLoopFill(g, l) {
        loopPath(g, l.pts);
        g.fillStyle = l.color + '1c';
        g.fill();
    }

    function drawLoopLine(g, l) {
        loopPath(g, l.pts);
        g.lineJoin = 'round';
        g.lineWidth = 4;
        g.strokeStyle = l.color;
        g.stroke();
    }

    function loopCount(l) {
        return L.blocksInLoop(state.blocks, l.pts, state.size).length;
    }

    function badgePos(l) {
        const b = L.bbox(l.pts);
        return [b.x1 - 8, b.y0 + 8];
    }

    function drawBadge(g, l) {
        const n = loopCount(l);
        const [x, y] = badgePos(l);
        const r = 17;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = '#fff';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = l.color;
        g.stroke();
        g.fillStyle = l.color;
        g.font = '800 19px "M PLUS Rounded 1c", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(n), x, y + 1);
    }

    function drawStroke(g, s) {
        const p = s.pts;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = s.w;
        g.strokeStyle = s.color;
        g.beginPath();
        g.moveTo(p[0][0], p[0][1]);
        if (p.length === 1) {
            g.lineTo(p[0][0] + 0.1, p[0][1]);
        } else {
            for (let i = 1; i < p.length - 1; i++) {
                const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
                g.quadraticCurveTo(p[i][0], p[i][1], mx, my);
            }
            g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        }
        g.stroke();
    }

    function drawLasso(g, pts) {
        if (pts.length < 2) return;
        g.save();
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) g.lineTo(x, y);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 4;
        g.setLineDash([10, 8]);
        g.strokeStyle = LOOP_COLORS[state.loopColor % LOOP_COLORS.length];
        g.stroke();
        g.restore();
    }

    function drawCountMarks(g, hide) {
        const S = state.size;
        g.save();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        count.order.forEach((id, i) => {
            const b = blockById(id);
            if (!b || hide.has(id)) return;
            roundRectPath(g, b.x + 2, b.y + 2, S - 4, S - 4, S * 0.12);
            g.lineWidth = 4;
            g.strokeStyle = '#f5b800';
            g.stroke();
            const t = String(i + 1);
            g.font = `800 ${Math.round(S * (t.length > 2 ? 0.34 : 0.44))}px "M PLUS Rounded 1c", sans-serif`;
            g.lineWidth = Math.max(3, S * 0.08);
            g.strokeStyle = 'rgba(0,0,0,.55)';
            g.strokeText(t, b.x + S / 2, b.y + S / 2 + 1);
            g.fillStyle = '#fff';
            g.fillText(t, b.x + S / 2, b.y + S / 2 + 1);
        });
        for (const gr of count.groups) {
            const l = loopById(gr.loopId);
            if (!l || hide.has(l.id)) continue;
            const bb = L.bbox(l.pts);
            const t = String(gr.total);
            g.font = '400 26px "Mochiy Pop One", "M PLUS Rounded 1c", sans-serif';
            const w = Math.max(44, g.measureText(t).width + 24), h = 38;
            /* かこみの ひだり（はいらない ときは 右）に 出す */
            let x = bb.x0 - w - 6;
            if (x < 2) x = Math.min(W - w - 2, bb.x1 + 26);
            const y = (bb.y0 + bb.y1) / 2 - h / 2;
            roundRectPath(g, x, y, w, h, 12);
            g.fillStyle = '#2fa84f';
            g.fill();
            g.lineWidth = 3;
            g.strokeStyle = '#fff';
            g.stroke();
            g.fillStyle = '#fff';
            g.fillText(t, x + w / 2, y + h / 2 + 1);
        }
        g.restore();
    }

    const ERASE_R = 16;
    function drawEraser(g, [x, y]) {
        g.beginPath();
        g.arc(x, y, ERASE_R, 0, Math.PI * 2);
        g.fillStyle = 'rgba(247,165,184,.35)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = '#d9788f';
        g.stroke();
    }

    /* ---------- しき ---------- */

    const exprEl = $('#expr');
    let lastExpr = '';
    function updateExpr() {
        updateDanBar();
        let html = '';
        if (settings.expr && state.blocks.length && !state.dan) {
            const counts = state.loops.map(loopCount);
            const inAny = new Set();
            for (const l of state.loops) for (const b of L.blocksInLoop(state.blocks, l.pts, state.size)) inAny.add(b.id);
            const d = L.describe(counts, state.blocks.length - inAny.size);
            html = d
                ? `<b>${d.expr}</b><small>${d.words}</small>`
                : `<b>${state.blocks.length}こ</b><small>かこむと しきが 出るよ</small>`;
        }
        if (html === lastExpr) return;
        lastExpr = html;
        exprEl.innerHTML = html;
        exprEl.hidden = !html;
    }

    /* ================================================================
       ゆび・マウスの うごき
       ================================================================ */

    const drags = new Map();      /* pointerId → いま うごかしている もの */
    const bgPointers = new Map(); /* しゃしんを うごかしている ゆび */
    let tool = 'move';
    let count = { order: [], groups: [] };  /* かぞえる（れきしには のこさない） */

    function hiddenIds() {
        const s = new Set();
        for (const d of drags.values()) {
            if (d.type === 'blocks') d.ids.forEach(i => s.add(i));
            else if (d.type === 'loop') [d.loopId, ...d.blockIds, ...d.loopIds].forEach(i => s.add(i));
        }
        return s;
    }

    function hitBlock(x, y) {
        const S = state.size, hide = hiddenIds();
        for (let i = state.blocks.length - 1; i >= 0; i--) {
            const b = state.blocks[i];
            if (!hide.has(b.id) && x >= b.x && x <= b.x + S && y >= b.y && y <= b.y + S) return b;
        }
        return null;
    }

    function hitLoop(x, y) {
        const hide = hiddenIds();
        let best = null, bestArea = Infinity;
        for (const l of state.loops) {
            if (hide.has(l.id)) continue;
            const [bx, by] = badgePos(l);
            const onBadge = settings.count && Math.hypot(x - bx, y - by) <= 20;
            if (onBadge || L.pointInPolygon(x, y, l.pts) || L.distToPolyline(x, y, l.pts, true) <= 14) {
                const a = L.polygonArea(l.pts);
                if (a < bestArea) { bestArea = a; best = l; }
            }
        }
        return best;
    }

    function toFront(ids) {
        const set = new Set(ids);
        state.blocks = state.blocks.filter(b => !set.has(b.id)).concat(state.blocks.filter(b => set.has(b.id)));
    }

    const trashEl = $('#trash');
    function overTrash(e) {
        const r = trashEl.getBoundingClientRect();
        return e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
    }
    function insideBoard(e) {
        return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    function startBlockDrag(e, ids, x, y, opts) {
        toFront(ids);
        const d = {
            type: 'blocks', ids, start: [x, y],
            orig: new Map(ids.map(id => { const b = blockById(id); return [id, [b.x, b.y]]; })),
            moved: false, fromPalette: !!opts.fromPalette, tapFlip: !!opts.tapFlip,
        };
        if (opts.allowCluster) {
            /* ながおし → くっついている ブロックを まとめて もつ */
            d.timer = setTimeout(() => {
                if (d.moved || !drags.has(e.pointerId)) return;
                const busy = hiddenIds();
                const ids2 = L.clusterOf(state.blocks.filter(b => !busy.has(b.id) || ids.includes(b.id)), ids[0], state.size);
                if (ids2.length < 2) return;
                d.ids = ids2;
                d.orig = new Map(ids2.map(id => { const b = blockById(id); return [id, [b.x, b.y]]; }));
                d.tapFlip = false;
                toFront(ids2);
                toast(`${ids2.length}こ まとめて もったよ`);
                if (navigator.vibrate) navigator.vibrate(25);
                requestRender();
            }, 450);
        }
        drags.set(e.pointerId, d);
        requestRender();
    }

    function startLoopDrag(e, l, x, y) {
        const busy = hiddenIds();
        const blocks = L.blocksInLoop(state.blocks.filter(b => !busy.has(b.id)), l.pts, state.size);
        const inner = L.loopsInLoop(state.loops.filter(o => !busy.has(o.id)), l);
        const loops = [l, ...inner];
        toFront(blocks.map(b => b.id));
        drags.set(e.pointerId, {
            type: 'loop', loopId: l.id, blockIds: blocks.map(b => b.id), loopIds: inner.map(o => o.id),
            start: [x, y], moved: false,
            origBlocks: new Map(blocks.map(b => [b.id, [b.x, b.y]])),
            origLoops: new Map(loops.map(o => [o.id, o.pts.map(p => p.slice())])),
        });
        requestRender();
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        rect = wrap.getBoundingClientRect();
        const [x, y] = toBoard(e);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* なくても よい */ }
        hideBubble();

        if (tool === 'move') {
            const b = hitBlock(x, y);
            if (b) { startBlockDrag(e, [b.id], x, y, { tapFlip: true, allowCluster: true }); return; }
            const l = hitLoop(x, y);
            if (l) startLoopDrag(e, l, x, y);
        } else if (tool === 'loop') {
            drags.set(e.pointerId, { type: 'lasso', pts: [[x, y]] });
        } else if (tool === 'pen') {
            const s = { id: uid('s'), color: PEN_COLORS[settings.penC], w: settings.penW, pts: [[r1(x), r1(y)]] };
            state.strokes.push(s);
            drags.set(e.pointerId, { type: 'pen', stroke: s });
            requestRender();
        } else if (tool === 'erase') {
            const d = { type: 'erase', last: [x, y], cur: [x, y] };
            drags.set(e.pointerId, d);
            eraseAt(x, y);
            requestRender();
        } else if (tool === 'count') {
            drags.set(e.pointerId, { type: 'count', last: [x, y] });
            countAt(x, y, true);
        } else if (tool === 'photo') {
            bgPointers.set(e.pointerId, [x, y]);
        }
    });

    const r1 = (v) => Math.round(v * 10) / 10;

    function pointsOf(e) {
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        return (list.length ? list : [e]).map(toBoard);
    }

    window.addEventListener('pointermove', (e) => {
        if (bgPointers.has(e.pointerId)) { moveBg(e); return; }
        const d = drags.get(e.pointerId);
        if (!d) return;
        const [x, y] = toBoard(e);

        if (d.type === 'blocks' || d.type === 'loop') {
            const dx = x - d.start[0], dy = y - d.start[1];
            if (!d.moved) {
                if (Math.hypot(dx, dy) < (e.pointerType === 'mouse' ? 3 : 8)) return;
                d.moved = true;
                clearTimeout(d.timer);
            }
            if (d.type === 'blocks') {
                for (const id of d.ids) {
                    const b = blockById(id), o = d.orig.get(id);
                    if (b) { b.x = o[0] + dx; b.y = o[1] + dy; }
                }
            } else {
                moveLoopGroup(d, dx, dy);
            }
            trashEl.classList.toggle('hot', overTrash(e));
        } else if (d.type === 'lasso') {
            for (const p of pointsOf(e)) d.pts.push(p);
        } else if (d.type === 'pen') {
            const pts = d.stroke.pts;
            for (const [px, py] of pointsOf(e)) {
                const q = pts[pts.length - 1];
                if (Math.hypot(px - q[0], py - q[1]) >= 1.5) pts.push([r1(px), r1(py)]);
            }
        } else if (d.type === 'count') {
            const [lx, ly] = d.last;
            const steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / 8));
            for (let i = 1; i <= steps; i++) countAt(lx + (x - lx) * i / steps, ly + (y - ly) * i / steps, false);
            d.last = [x, y];
        } else if (d.type === 'erase') {
            const [lx, ly] = d.last;
            const steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / 6));
            for (let i = 1; i <= steps; i++) eraseAt(lx + (x - lx) * i / steps, ly + (y - ly) * i / steps);
            d.last = [x, y];
            d.cur = [x, y];
        }
        requestRender();
    });

    function moveLoopGroup(d, dx, dy) {
        for (const [id, o] of d.origBlocks) {
            const b = blockById(id);
            if (b) { b.x = o[0] + dx; b.y = o[1] + dy; }
        }
        for (const [id, pts] of d.origLoops) {
            const l = loopById(id);
            if (l) l.pts = pts.map(([px, py]) => [r1(px + dx), r1(py + dy)]);
        }
    }

    function endPointer(e, cancelled) {
        if (bgPointers.has(e.pointerId)) {
            bgPointers.delete(e.pointerId);
            if (!bgPointers.size) commit();
            return;
        }
        const d = drags.get(e.pointerId);
        if (!d) return;
        drags.delete(e.pointerId);
        clearTimeout(d.timer);
        trashEl.classList.remove('hot');

        if (d.type === 'blocks') endBlockDrag(e, d, cancelled);
        else if (d.type === 'loop') endLoopDrag(e, d, cancelled);
        else if (d.type === 'lasso') endLasso(d);
        commit();
        requestRender();
    }
    window.addEventListener('pointerup', (e) => endPointer(e, false));
    window.addEventListener('pointercancel', (e) => endPointer(e, true));

    function removeBlocks(ids) {
        const set = new Set(ids);
        state.blocks = state.blocks.filter(b => !set.has(b.id));
    }

    function endBlockDrag(e, d, cancelled) {
        const S = state.size;
        if (!d.moved) {
            if (cancelled && d.fromPalette) { removeBlocks(d.ids); return; }
            if (d.fromPalette) {
                /* ブロックばこを タップ → ひだり うえから じゅんに ならべる */
                const b = blockById(d.ids[0]);
                const occ = occupiedCells(d.ids);
                const x1 = Math.min(W, 11 * S + S / 2);
                const pos = L.findFreeRect(1, 1, S, occ, { x0: 0, y0: 0, x1, y1: H }, 0)
                         || L.findFreeRect(1, 1, S, occ, { x0: 0, y0: 0, x1: W, y1: H }, 0)
                         || [S, S];
                b.x = pos[0]; b.y = pos[1];
                SND.pop();
            } else if (d.tapFlip && !cancelled) {
                const b = blockById(d.ids[0]);
                if (b) { b.c = b.c === 'b' ? 'r' : 'b'; SND.flip(); }  /* タップで うらがえす */
            }
            return;
        }
        if (overTrash(e) && !cancelled) { removeBlocks(d.ids); SND.trash(); return; }
        if (d.fromPalette && (cancelled || !insideBoard(e))) { removeBlocks(d.ids); return; }
        settle(d.ids.map(blockById).filter(Boolean));
        SND.pop();
    }

    function occupiedCells(exceptIds) {
        const ex = new Set(exceptIds);
        const S = state.size;
        return new Set(state.blocks.filter(b => !ex.has(b.id)).map(b => L.cellKey(b.x, b.y, S)));
    }

    function groupBox(blocks) {
        const S = state.size;
        return L.bbox(blocks.flatMap(b => [[b.x, b.y], [b.x + S, b.y + S]]));
    }

    function shiftBlocks(blocks, dx, dy) { for (const b of blocks) { b.x += dx; b.y += dy; } }

    /** つくえの 中に おさめる ための ずらし */
    function clampShift(box) {
        let dx = 0, dy = 0;
        if (box.x1 - box.x0 <= W) { if (box.x0 < 0) dx = -box.x0; else if (box.x1 > W) dx = W - box.x1; } else dx = -box.x0;
        if (box.y1 - box.y0 <= H) { if (box.y0 < 0) dy = -box.y0; else if (box.y1 > H) dy = H - box.y1; } else dy = -box.y0;
        return [dx, dy];
    }

    /** はなした ブロックを おちつかせる：つくえの 中へ・マス目に・かさならない ように */
    function settle(blocks) {
        if (!blocks.length) return;
        const S = state.size;
        shiftBlocks(blocks, ...clampShift(groupBox(blocks)));
        if (!settings.snap) return;
        const f = blocks[0];
        shiftBlocks(blocks, L.snap(f.x, S) - f.x, L.snap(f.y, S) - f.y);
        const box = groupBox(blocks);
        const [cx, cy] = clampShift(box);
        shiftBlocks(blocks, Math.sign(cx) * Math.ceil(Math.abs(cx) / S - 1e-6) * S, Math.sign(cy) * Math.ceil(Math.abs(cy) / S - 1e-6) * S);
        resolveOverlaps(blocks);
    }

    function resolveOverlaps(blocks) {
        const S = state.size;
        const occ = occupiedCells(blocks.map(b => b.id));
        for (const b of blocks) {
            if (occ.has(L.cellKey(b.x, b.y, S))) {
                [b.x, b.y] = L.findFreeCell(b.x, b.y, S, occ, { x0: 0, y0: 0, x1: W, y1: H });
            } else {
                b.x = L.snap(b.x, S); b.y = L.snap(b.y, S);
            }
            occ.add(L.cellKey(b.x, b.y, S));
        }
    }

    function endLoopDrag(e, d, cancelled) {
        if (!d.moved) {
            if (!cancelled) showBubble(d.loopId);   /* タップ → まわす・ふやす・けす */
            return;
        }
        if (overTrash(e) && !cancelled) {
            SND.trash();
            /* かこみを すてると、中の ブロックも いっしょに すてる */
            const gone = new Set([d.loopId, ...d.loopIds]);
            state.loops = state.loops.filter(l => !gone.has(l.id));
            removeBlocks(d.blockIds);
            return;
        }
        const S = state.size;
        const [x, y] = toBoard(e);
        let dx = x - d.start[0], dy = y - d.start[1];
        /* つくえから はみださない ように */
        const pts = [];
        for (const o of d.origLoops.values()) for (const p of o) pts.push(p);
        for (const o of d.origBlocks.values()) pts.push(o, [o[0] + S, o[1] + S]);
        const b0 = L.bbox(pts);
        const [cx, cy] = clampShift({ x0: b0.x0 + dx, y0: b0.y0 + dy, x1: b0.x1 + dx, y1: b0.y1 + dy });
        dx += cx; dy += cy;
        if (settings.snap && d.origBlocks.size) { dx = L.snap(dx, S); dy = L.snap(dy, S); }
        moveLoopGroup(d, dx, dy);
        if (settings.snap) resolveOverlaps(d.blockIds.map(blockById).filter(Boolean));
    }

    function endLasso(d) {
        const pts = L.makeLoop(d.pts);
        if (!pts) {
            if (d.pts.length < 6) toast('ゆびで ぐるっと かこんでね');
            return;
        }
        const color = LOOP_COLORS[state.loopColor % LOOP_COLORS.length];
        state.loopColor = (state.loopColor + 1) % LOOP_COLORS.length;
        state.loops.push({ id: uid('l'), pts, color });
        SND.loop();
    }

    function eraseAt(x, y) {
        const before = state.strokes.length + state.loops.length;
        state.strokes = state.strokes.filter(s => L.distToPolyline(x, y, s.pts, false) > ERASE_R + s.w / 2);
        state.loops = state.loops.filter(l => L.distToPolyline(x, y, l.pts, true) > ERASE_R + 2);
        return before !== state.strokes.length + state.loops.length;
    }

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    $('.side').addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---------- かぞえる ---------- */

    function resetCount() {
        count = { order: [], groups: [] };
        updateCountBar();
        requestRender();
    }

    function updateCountBar() {
        for (const b of $$('.seg-b')) b.classList.toggle('on', b.dataset.cm === settings.countMode);
        const n = settings.countMode === 'one'
            ? count.order.length
            : (count.groups.length ? count.groups[count.groups.length - 1].total : 0);
        $('#countNow').textContent = n;
        $('#countVoice').classList.toggle('off', !settings.voice);
        $('#countVoice').textContent = settings.voice ? '🔈' : '🔇';
    }

    function sayNumber(n) {
        if (settings.voice) SND.speak(String(n));
        else SND.count();
    }

    /** tap … おした とき（さいごの ものを もう一度 おすと とりけし）。なぞって いる ときは false */
    function countAt(x, y, tap) {
        if (settings.countMode === 'one') {
            const b = hitBlock(x, y);
            if (!b) return;
            const i = count.order.indexOf(b.id);
            if (i >= 0) {
                if (tap && i === count.order.length - 1) count.order.pop();
                else return;
            } else {
                count.order.push(b.id);
                sayNumber(count.order.length);
            }
        } else {
            const l = hitLoop(x, y);
            if (!l) return;
            const i = count.groups.findIndex(g => g.loopId === l.id);
            if (i >= 0) {
                if (tap && i === count.groups.length - 1) count.groups.pop();
                else return;
            } else {
                const n = loopCount(l);
                if (!n) { if (tap) toast('この かこみは からっぽだよ'); return; }
                const total = (count.groups.length ? count.groups[count.groups.length - 1].total : 0) + n;
                count.groups.push({ loopId: l.id, total });
                sayNumber(total);
            }
        }
        updateCountBar();
        requestRender();
    }

    for (const b of $$('.seg-b')) {
        b.addEventListener('click', () => { settings.countMode = b.dataset.cm; saveSettings(); resetCount(); });
    }
    $('#countReset').addEventListener('click', resetCount);
    $('#countVoice').addEventListener('click', () => { settings.voice = !settings.voice; saveSettings(); updateCountBar(); });

    /* ---------- かこみの メニュー（まわす・ふやす・けす） ---------- */

    const bubble = $('#loopBubble');
    let bubbleLoop = null;

    function showBubble(id) {
        const l = loopById(id);
        if (!l) return hideBubble();
        bubbleLoop = id;
        bubble.hidden = false;
        const bb = L.bbox(l.pts);
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        const left = Math.max(6, Math.min(W - bw - 6, (bb.x0 + bb.x1) / 2 - bw / 2));
        let top = bb.y0 - bh - 12;
        if (top < 6) top = Math.min(H - bh - 6, bb.y1 + 12);
        bubble.style.left = left + 'px';
        bubble.style.top = top + 'px';
    }

    function hideBubble() {
        bubbleLoop = null;
        bubble.hidden = true;
    }

    function loopGroup(l) {
        const S = state.size;
        const blocks = L.blocksInLoop(state.blocks, l.pts, S);
        const loops = [l, ...L.loopsInLoop(state.loops, l)];
        const grp = { blocks, loops };
        grp.box = groupBoxOf(grp);
        return grp;
    }

    /** まとまり（ブロックと かこみ）ぜんたいの はこ */
    function groupBoxOf(grp) {
        const S = state.size;
        const pts = grp.loops.flatMap(o => o.pts);
        for (const b of grp.blocks) pts.push([b.x, b.y], [b.x + S, b.y + S]);
        return L.bbox(pts);
    }

    /** まとまり いがいの ブロックと かこみの はこ */
    function othersBoxes(grp) {
        const S = state.size;
        const mine = new Set([...grp.blocks.map(b => b.id), ...grp.loops.map(o => o.id)]);
        const out = [];
        for (const o of state.loops) if (!mine.has(o.id)) out.push(L.bbox(o.pts));
        for (const b of state.blocks) if (!mine.has(b.id)) out.push({ x0: b.x, y0: b.y, x1: b.x + S, y1: b.y + S });
        return out;
    }

    function shiftGroup(grp, dx, dy) {
        shiftBlocks(grp.blocks, dx, dy);
        for (const o of grp.loops) o.pts = o.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
    }

    /** 90° まわす（3 × 4 ⇔ 4 × 3） */
    function rotateLoop(id) {
        const l = loopById(id);
        if (!l) return;
        const S = state.size;
        const grp = loopGroup(l);
        const pb = grp.blocks.length ? groupBox(grp.blocks) : L.bbox(l.pts);
        const px = (pb.x0 + pb.x1) / 2, py = (pb.y0 + pb.y1) / 2;
        for (const b of grp.blocks) {
            const [cx, cy] = L.rotate90(b.x + S / 2, b.y + S / 2, px, py);
            b.x = cx - S / 2;
            b.y = cy - S / 2;
        }
        for (const o of grp.loops) o.pts = o.pts.map(([x, y]) => L.rotate90(x, y, px, py).map(r1));
        if (settings.snap && grp.blocks.length) {
            const f = grp.blocks[0];
            shiftGroup(grp, L.snap(f.x, S) - f.x, L.snap(f.y, S) - f.y);
        }
        let [dx, dy] = clampShift(groupBoxOf(grp));
        if (settings.snap) { dx = Math.sign(dx) * Math.ceil(Math.abs(dx) / S - 1e-6) * S; dy = Math.sign(dy) * Math.ceil(Math.abs(dy) / S - 1e-6) * S; }
        shiftGroup(grp, dx, dy);
        /* まわした ら ほかの ものに かさなる ときは、まとまりごと あいている ところへ */
        const box = groupBoxOf(grp);
        const obstacles = othersBoxes(grp);
        const inner = { x0: box.x0 + 2, y0: box.y0 + 2, x1: box.x1 - 2, y1: box.y1 - 2 };
        if (obstacles.some(o => L.boxesOverlap(inner, o))) {
            const off = L.findSpot(box, obstacles, { x0: 0, y0: 0, x1: W, y1: H }, S, 2);
            if (off) shiftGroup(grp, off[0], off[1]);
        }
        if (settings.snap) resolveOverlaps(grp.blocks);
        SND.flip();
        commit();
        requestRender();
        showBubble(id);
    }

    /** おなじ まとまりを もう 1つ つくる（あいている ところへ） */
    function copyLoop(id) {
        const l = loopById(id);
        if (!l) return;
        const S = state.size;
        const grp = loopGroup(l);
        const obstacles = [grp.box, ...othersBoxes(grp)];
        const off = L.findSpot(grp.box, obstacles, { x0: 0, y0: 0, x1: W, y1: H }, S, 4);
        if (!off) { toast('あいている ばしょが ないよ'); return; }
        const [dx, dy] = off;
        for (const o of grp.loops) {
            const color = LOOP_COLORS[state.loopColor % LOOP_COLORS.length];
            state.loopColor = (state.loopColor + 1) % LOOP_COLORS.length;
            state.loops.push({ id: uid('l'), pts: o.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]), color });
        }
        for (const b of grp.blocks) state.blocks.push({ id: uid('b'), x: b.x + dx, y: b.y + dy, c: b.c });
        SND.pop();
        commit();
        requestRender();
    }

    bubble.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !bubbleLoop) return;
        const id = bubbleLoop;
        if (btn.dataset.act === 'rotate') rotateLoop(id);
        else if (btn.dataset.act === 'copy') copyLoop(id);
        else if (btn.dataset.act === 'unloop') {
            state.loops = state.loops.filter(l => l.id !== id);
            commit();
            hideBubble();
            requestRender();
        }
    });

    /* ---------- ブロックばこ ---------- */

    for (const src of $$('.src')) {
        src.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            e.preventDefault();
            if (tool === 'photo') setTool('move');
            rect = wrap.getBoundingClientRect();
            try { src.setPointerCapture(e.pointerId); } catch (err) { /* なくても よい */ }
            const S = state.size;
            const [x, y] = toBoard(e);
            const b = { id: uid('b'), x: x - S / 2, y: y - S / 2, c: src.dataset.c };
            state.blocks.push(b);
            startBlockDrag(e, [b.id], x, y, { fromPalette: true });
        });
    }

    trashEl.addEventListener('click', () => {
        if (state.blocks.length || state.loops.length || state.strokes.length) openSheet('clearSheet');
        else toast('ごみばこに ブロックを もってくると すてられるよ');
    });

    function clearAll() {
        state.blocks = [];
        state.loops = [];
        state.strokes = [];
        state.dan = null;
        commit();
        SND.trash();
        closeSheets();
        requestRender();
        toast('「もどす」で もとに もどせるよ');
    }
    $('#clearYes').addEventListener('click', clearAll);
    $('#btnClear').addEventListener('click', clearAll);

    /* ---------- どうぐ ---------- */

    const hinted = new Set();
    function setTool(t) {
        tool = t;
        for (const b of $$('.tool')) b.classList.toggle('on', b.dataset.tool === t);
        wrap.className = 'board-wrap t-' + t;
        $('#penBar').hidden = t !== 'pen';
        $('#bgBar').hidden = t !== 'photo';
        $('#countBar').hidden = t !== 'count';
        hideBubble();
        resetCount();
        if (t === 'photo') $('#bgAlpha').value = state.bg ? state.bg.alpha : 1;
        if (!hinted.has(t)) {
            hinted.add(t);
            if (t === 'loop') toast('ゆびで ぐるっと かこもう');
            if (t === 'erase') toast('かいた 線と かこみを けせるよ（ブロックは ごみばこへ）');
            if (t === 'count') toast('ブロックを じゅんに タップしよう');
        }
        requestRender();
    }
    for (const b of $$('.tool')) b.addEventListener('click', () => setTool(b.dataset.tool));

    function syncPenBar() {
        for (const b of $$('.pen-c')) b.classList.toggle('on', b.dataset.c === settings.penC);
        for (const b of $$('.pen-w')) b.classList.toggle('on', +b.dataset.w === settings.penW);
    }
    for (const b of $$('.pen-c')) b.addEventListener('click', () => { settings.penC = b.dataset.c; saveSettings(); syncPenBar(); });
    for (const b of $$('.pen-w')) b.addEventListener('click', () => { settings.penW = +b.dataset.w; saveSettings(); syncPenBar(); });

    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);

    /* ================================================================
       はいけいの しゃしん
       ================================================================ */

    async function syncBg() {
        const id = state.bg ? state.bg.id : null;
        if (id === bgImageId) return;
        bgImageId = id;
        bgImage = null;
        requestRender();
        if (!id) return;
        const img = await P.load(id);
        if (bgImageId !== id) return;
        bgImage = img;
        if (!img) toast('しゃしんが みつかりませんでした');
        requestRender();
    }

    function fitScale(img, rot) {
        const [iw, ih] = imgSize(img);
        const [w, h] = rot % 2 ? [ih, iw] : [iw, ih];
        return Math.min(W / w, H / h);
    }

    function setBackground(id, image) {
        bgImageId = id;
        bgImage = image;
        state.bg = { id, x: W / 2, y: H / 2, s: fitScale(image, 0), rot: 0, alpha: 1 };
        commit();
        requestRender();
        const keep = new Set([id]);
        for (const s of [...undoStack, ...redoStack]) {
            for (const m of s.matchAll(/"bg":\{"id":"([^"]+)"/g)) keep.add(m[1]);
        }
        P.prune([...keep]);
    }

    let importing = false;
    async function importAndUse(src) {
        if (importing) return;
        importing = true;
        toast('よみこみちゅう…', 20000);
        try {
            const { id, image } = await P.importSource(src);
            closeSheets();
            setBackground(id, image);
            toast('はいけいに しました');
        } catch (err) {
            toast('がぞうを よみこめませんでした');
        } finally {
            importing = false;
        }
    }

    /* 2本ゆびで 大きく・小さく、1本ゆびで うごかす */
    function moveBg(e) {
        const b = state.bg;
        const prev = new Map(bgPointers);
        const cur = toBoard(e);
        bgPointers.set(e.pointerId, cur);
        if (!b) return;
        if (bgPointers.size === 1) {
            const p = prev.get(e.pointerId);
            b.x += cur[0] - p[0];
            b.y += cur[1] - p[1];
        } else {
            const ids = [...bgPointers.keys()].slice(0, 2);
            if (!ids.includes(e.pointerId)) return;
            const [a0, b0] = ids.map(i => prev.get(i));
            const [a1, b1] = ids.map(i => bgPointers.get(i));
            const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1;
            const d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) || 1;
            const c0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
            const c1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
            zoomBg(d1 / d0, c0, c1);
        }
        requestRender();
    }

    /** from を 中心に f ばいして、from を to へ うごかす */
    function zoomBg(f, from, to) {
        const b = state.bg;
        const ns = Math.max(0.03, Math.min(30, b.s * f));
        f = ns / b.s;
        b.s = ns;
        b.x = to[0] + (b.x - from[0]) * f;
        b.y = to[1] + (b.y - from[1]) * f;
    }

    let wheelTimer = 0;
    canvas.addEventListener('wheel', (e) => {
        if (tool !== 'photo' || !state.bg) return;
        e.preventDefault();
        const p = toBoard(e);
        zoomBg(Math.exp(-e.deltaY * 0.0015), p, p);
        requestRender();
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(commit, 400);
    }, { passive: false });

    $('#bgPlus').addEventListener('click', () => { zoomBg(1.15, [W / 2, H / 2], [W / 2, H / 2]); commit(); requestRender(); });
    $('#bgMinus').addEventListener('click', () => { zoomBg(1 / 1.15, [W / 2, H / 2], [W / 2, H / 2]); commit(); requestRender(); });
    $('#bgRot').addEventListener('click', () => {
        const b = state.bg;
        if (!b) return;
        b.rot = (b.rot + 1) % 4;
        if (bgImage) { b.s = fitScale(bgImage, b.rot); b.x = W / 2; b.y = H / 2; }
        commit();
        requestRender();
    });
    $('#bgFit').addEventListener('click', () => {
        const b = state.bg;
        if (!b || !bgImage) return;
        b.s = fitScale(bgImage, b.rot);
        b.x = W / 2;
        b.y = H / 2;
        commit();
        requestRender();
    });
    for (const id of ['#bgAlpha', '#bgAlpha2']) {
        const el = $(id);
        el.addEventListener('input', () => { if (state.bg) { state.bg.alpha = +el.value; requestRender(); } });
        el.addEventListener('change', commit);
    }
    $('#bgDone').addEventListener('click', () => setTool('move'));

    /* ---------- しゃしんの まど ---------- */

    $('#btnPhoto').addEventListener('click', openPhotoSheet);

    async function openPhotoSheet() {
        $('#curBg').hidden = !state.bg;
        $('#bgAlpha2').value = state.bg ? state.bg.alpha : 1;
        renderScenes();
        openSheet('photoSheet');
        const box = $('#thumbs');
        box.innerHTML = '';
        const list = await P.list();
        box.innerHTML = '';
        for (const p of list) {
            const btn = document.createElement('button');
            btn.className = 'thumb' + (state.bg && state.bg.id === p.id ? ' on' : '');
            btn.innerHTML = `<img alt="" src="${p.thumb}"><span class="del" role="button" aria-label="けす">✕</span>`;
            btn.addEventListener('click', async (ev) => {
                if (ev.target.classList.contains('del')) {
                    if (!confirm('この しゃしんを けしますか？')) return;
                    await P.remove(p.id);
                    if (state.bg && state.bg.id === p.id) { state.bg = null; commit(); syncBg(); }
                    openPhotoSheet();
                    return;
                }
                const img = await P.load(p.id);
                if (!img) { toast('しゃしんが みつかりませんでした'); return; }
                closeSheets();
                setBackground(p.id, img);
            });
            box.appendChild(btn);
        }
    }

    const fileInput = $('#fileInput');
    $('#btnFile').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (f) importAndUse(f);
    });

    $('#btnPaste').addEventListener('click', async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const it of items) {
                const type = it.types.find(t => t.startsWith('image/'));
                if (type) { importAndUse(await it.getType(type)); return; }
            }
            toast('コピーした がぞうが ありません');
        } catch (err) {
            toast('Ctrl + V で はりつけてね');
        }
    });

    document.addEventListener('paste', (e) => {
        const items = e.clipboardData ? [...e.clipboardData.items] : [];
        const it = items.find(i => i.kind === 'file' && i.type.startsWith('image/'));
        if (!it) return;
        e.preventDefault();
        importAndUse(it.getAsFile());
    });

    $('#btnBgMove').addEventListener('click', () => { closeSheets(); setTool('photo'); });
    $('#btnBgOff').addEventListener('click', () => {
        state.bg = null;
        commit();
        syncBg();
        closeSheets();
        if (tool === 'photo') setTool('move');
    });

    /* ファイルを ドラッグ して きた とき */
    const dropHint = $('#dropHint');
    let dragDepth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; dropHint.hidden = false; } });
    window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropHint.hidden = true; } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth = 0;
        dropHint.hidden = true;
        const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
        if (f) importAndUse(f);
        else toast('がぞうの ファイルを いれてね');
    });

    /* ---------- カメラ ---------- */

    const cam = $('#camera');
    const video = $('#camVideo');
    const camMsg = $('#camMsg');

    async function openCamera() {
        closeSheets();
        cam.hidden = false;
        camMsg.hidden = true;
        $('#camFlip').hidden = true;
        if (!P.camera.available()) { cameraError('この ブラウザでは カメラが つかえません。'); return; }
        try {
            await P.camera.start(video);
            $('#camFlip').hidden = (await P.camera.count()) < 2;
        } catch (err) {
            const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
            cameraError(denied
                ? 'カメラを つかう ことが ゆるされていません。<br>アドレスバーの 🔒 から カメラを「許可」してね。'
                : 'カメラが みつかりませんでした。');
        }
    }

    function cameraError(msg) {
        camMsg.innerHTML = `${msg}<br><button class="chip" id="camToFile">🖼️ ファイルから えらぶ</button>`;
        camMsg.hidden = false;
        $('#camToFile').addEventListener('click', () => { closeCamera(); fileInput.click(); });
    }

    function closeCamera() {
        P.camera.stop();
        video.srcObject = null;
        cam.hidden = true;
    }

    $('#btnCamera').addEventListener('click', openCamera);
    $('#camClose').addEventListener('click', closeCamera);
    $('#camFlip').addEventListener('click', () => P.camera.flip(video).catch(() => toast('カメラを かえられませんでした')));
    $('#camShot').addEventListener('click', () => {
        if (!P.camera.stream || !video.videoWidth) return;
        const flash = $('#camFlash');
        flash.classList.remove('go-flash');
        void flash.offsetWidth;
        flash.classList.add('go-flash');
        const shot = P.camera.grab(video);
        setTimeout(() => { closeCamera(); importAndUse(shot); }, 150);
    });

    /* ================================================================
       ならべる
       ================================================================ */

    function renderArrayPreview() {
        $('#arrRows').textContent = settings.rows;
        $('#arrCols').textContent = settings.cols;
        for (const b of $$('.arr-c')) b.classList.toggle('on', b.dataset.c === settings.arrC);
        const n = Math.max(settings.rows, settings.cols);
        const ps = Math.min(36, Math.floor(200 / n));
        const box = document.createElement('div');
        box.className = 'arr-grid';
        box.style.gridTemplateColumns = `repeat(${settings.cols}, ${ps}px)`;
        box.style.setProperty('--ps', ps + 'px');
        const cls = 'blk blk-' + settings.arrC;
        box.innerHTML = `<span class="${cls}"></span>`.repeat(settings.rows * settings.cols);
        const pv = $('#arrPreview');
        pv.innerHTML = '';
        pv.appendChild(box);
    }

    $('#btnArray').addEventListener('click', () => { renderArrayPreview(); openSheet('arraySheet'); });
    for (const b of $$('.st')) {
        b.addEventListener('click', () => {
            const k = b.dataset.k;
            settings[k] = Math.max(1, Math.min(10, settings[k] + +b.dataset.d));
            saveSettings();
            renderArrayPreview();
        });
    }
    for (const b of $$('.arr-c')) b.addEventListener('click', () => { settings.arrC = b.dataset.c; saveSettings(); renderArrayPreview(); });

    $('#arrGo').addEventListener('click', () => {
        const S = state.size, { rows, cols } = settings;
        const occ = occupiedCells([]);
        let pos = L.findFreeRect(rows, cols, S, occ, { x0: 0, y0: 0, x1: W, y1: H });
        if (!pos) {
            pos = [S, S];
            toast('ばしょが たりないので かさねて おいたよ');
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                state.blocks.push({ id: uid('b'), x: pos[0] + c * S, y: pos[1] + r * S, c: settings.arrC });
            }
        }
        SND.pop();
        commit();
        closeSheets();
        if (tool !== 'move') setTool('move');
        requestRender();
    });

    /* ================================================================
       くくの だん
       ================================================================ */

    /** ブロック 1だんを かこむ、かどの まるい 長方形 */
    function stadium(x0, y0, x1, y1) {
        const r = (y1 - y0) / 2, pts = [];
        for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + Math.PI * i / 8; pts.push([x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a)]); }
        for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + Math.PI * i / 8; pts.push([x0 + r + r * Math.cos(a), y0 + r + r * Math.sin(a)]); }
        return pts.map(([x, y]) => [r1(x), r1(y)]);
    }

    function renderDanSheet() {
        const grid = $('#danGrid');
        if (!grid.children.length) {
            for (let n = 1; n <= 9; n++) {
                const b = document.createElement('button');
                b.innerHTML = `${n}<small>の だん</small>`;
                b.addEventListener('click', () => startDan(n));
                grid.appendChild(b);
            }
        }
        $('#danLoops').checked = settings.danLoops;
        for (const b of $$('.dan-c')) b.classList.toggle('on', b.dataset.c === settings.danC);
    }

    $('#btnDan').addEventListener('click', () => { renderDanSheet(); openSheet('danSheet'); });
    $('#danLoops').addEventListener('change', () => { settings.danLoops = $('#danLoops').checked; saveSettings(); });
    for (const b of $$('.dan-c')) b.addEventListener('click', () => { settings.danC = b.dataset.c; saveSettings(); renderDanSheet(); });

    function startDan(n) {
        closeSheets();
        if (tool !== 'move') setTool('move');
        const S = state.size;
        const pitch = settings.danLoops ? Math.round(S * 1.3) : S;
        const occ = occupiedCells([]);
        const b = { x0: 0, y0: state.card ? 2 * S : 0, x1: W, y1: H };
        const pos = L.findFreeRect(Math.ceil(9 * pitch / S), n, S, occ, b)
                 || L.findFreeRect(Math.ceil(9 * pitch / S), n, S, occ, { x0: 0, y0: 0, x1: W, y1: H })
                 || L.findFreeRect(Math.ceil(5 * pitch / S), n, S, occ, { x0: 0, y0: 0, x1: W, y1: H })
                 || [S, S];
        state.dan = { n, c: settings.danC, loops: settings.danLoops, pitch, x: pos[0], y: pos[1], rows: [] };
        danAdd();
    }

    function danAdd() {
        const d = state.dan;
        if (!d || d.rows.length >= 9) return;
        const S = state.size, k = d.rows.length, y = d.y + k * d.pitch;
        if (y + S > H + 2) { toast('つくえが いっぱいだよ'); return; }
        const color = d.c === 'x' ? (k % 2 ? 'r' : 'b') : d.c;
        const ids = [];
        for (let c = 0; c < d.n; c++) {
            const id = uid('b');
            ids.push(id);
            state.blocks.push({ id, x: d.x + c * S, y, c: color });
        }
        let loopId = null;
        if (d.loops) {
            loopId = uid('l');
            const pad = Math.max(4, Math.round(S * 0.1));
            state.loops.push({ id: loopId, pts: stadium(d.x - pad, y - pad, d.x + d.n * S + pad, y + S + pad), color: LOOP_COLORS[k % LOOP_COLORS.length] });
        }
        d.rows.push({ ids, loopId });
        commit();
        sayDan();
        requestRender();
    }

    function danRemove() {
        const d = state.dan;
        if (!d || d.rows.length <= 1) return;
        const row = d.rows.pop();
        removeBlocks(row.ids);
        if (row.loopId) state.loops = state.loops.filter(l => l.id !== row.loopId);
        commit();
        sayDan();
        requestRender();
    }

    function sayDan() {
        const d = state.dan;
        if (!d) return;
        const k = d.rows.length;
        if (settings.voice) SND.speak(L.kukuReading(d.n, k));
        else SND.up();
    }

    let lastDan = '';
    function updateDanBar() {
        const d = state.dan;
        const key = d ? d.n + ':' + d.rows.length : '';
        if (key === lastDan) return;
        lastDan = key;
        $('#danBar').hidden = !d;
        if (!d) return;
        const k = d.rows.length;
        $('#danExpr').textContent = `${d.n} × ${k} = ${d.n * k}`;
        $('#danRead').textContent = L.kukuReading(d.n, k);
        const seq = [];
        for (let i = 1; i <= k; i++) seq.push(i === k ? `<em>${d.n * i}</em>` : String(d.n * i));
        $('#danSeq').innerHTML = seq.join(' → ') + (k >= 2 ? `（${d.n}ずつ ふえる）` : '');
        $('#danMinus').disabled = k <= 1;
        $('#danPlus').disabled = k >= 9;
    }

    $('#danPlus').addEventListener('click', danAdd);
    $('#danMinus').addEventListener('click', danRemove);
    $('#danEnd').addEventListener('click', () => { state.dan = null; commit(); requestRender(); });

    /* ================================================================
       おだい
       ================================================================ */

    function setupLabel(su) {
        if (!su) return '';
        if (su.loose) return `ブロック ${su.loose}こ`;
        if (su.array) return `${su.array[1]}こ × ${su.array[0]}だん の ならび`;
        if (su.scene) {
            const k = window.KukuScenes.KINDS.find(x => x.key === su.scene[0]);
            return `イラスト：${k.name} ${su.scene[1]}${k.unit}`;
        }
        return '';
    }

    function renderCards() {
        const box = $('#cardList');
        if (box.children.length) return;
        for (const grp of window.KukuCards) {
            const sec = document.createElement('div');
            sec.className = 'card-group';
            sec.innerHTML = `<h3></h3><div class="cards"></div>`;
            sec.querySelector('h3').textContent = grp.group;
            for (const c of grp.cards) {
                const b = document.createElement('button');
                b.className = 'card';
                b.textContent = c.text;
                const lbl = setupLabel(c.setup);
                if (lbl) { const sm = document.createElement('small'); sm.textContent = '＋ ' + lbl; b.appendChild(sm); }
                b.addEventListener('click', () => useCard(c));
                sec.querySelector('.cards').appendChild(b);
            }
            box.appendChild(sec);
        }
    }

    function useCard(c) {
        closeSheets();
        if (tool !== 'move') setTool('move');
        state.card = { text: c.text };
        const su = c.setup;
        if (su) {
            state.blocks = [];
            state.loops = [];
            state.strokes = [];
            state.dan = null;
            const S = state.size;
            const top = Math.max(2 * S, L.snap(110, S));
            if (su.loose) {
                const per = Math.min(10, Math.floor(W / S) - 2);
                for (let i = 0; i < su.loose; i++) {
                    state.blocks.push({ id: uid('b'), x: S + (i % per) * S, y: top + Math.floor(i / per) * S, c: 'b' });
                }
            } else if (su.array) {
                const [rows, cols] = su.array;
                for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
                    state.blocks.push({ id: uid('b'), x: S + q * S, y: top + r * S, c: 'b' });
                }
            }
        }
        commit();
        updateCard();
        requestRender();
        if (su && su.scene) {
            importAndUse(window.KukuScenes.make(su.scene[0], su.scene[1], W / H));
        } else if (su) {
            toast('「もどす」で まえの つくえに もどせるよ');
        }
    }

    function updateCard() {
        $('#cardBanner').hidden = !state.card;
        if (state.card) $('#cardText').textContent = state.card.text;
    }

    $('#btnCards').addEventListener('click', () => { renderCards(); openSheet('cardSheet'); });
    $('#cardClose').addEventListener('click', () => { state.card = null; commit(); updateCard(); });
    function ownCard() {
        const t = $('#ownCard').value.trim();
        if (!t) { $('#ownCard').focus(); return; }
        $('#ownCard').value = '';
        useCard({ text: t });
    }
    $('#ownCardGo').addEventListener('click', ownCard);
    $('#ownCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) ownCard(); });

    /* ================================================================
       イラストの はいけい
       ================================================================ */

    const SC = window.KukuScenes;
    function renderScenes() {
        const box = $('#sceneKinds');
        if (!box.children.length) {
            for (const k of SC.KINDS) {
                const b = document.createElement('button');
                b.className = 'scene-k';
                b.dataset.k = k.key;
                const mini = document.createElement('canvas');
                mini.width = 120;
                mini.height = 72;
                mini.getContext('2d').drawImage(SC.make(k.key, 2, 1.67), 0, 0, 120, 72);
                b.appendChild(mini);
                b.appendChild(document.createTextNode(k.name));
                b.addEventListener('click', () => { settings.sceneKind = k.key; saveSettings(); renderScenes(); });
                box.appendChild(b);
            }
        }
        for (const b of $$('.scene-k')) b.classList.toggle('on', b.dataset.k === settings.sceneKind);
        $('#sceneN').textContent = settings.sceneN;
        const kind = SC.KINDS.find(x => x.key === settings.sceneKind) || SC.KINDS[0];
        $('#sceneUnit').textContent = kind.unit;
    }
    $('#sceneMinus').addEventListener('click', () => { settings.sceneN = Math.max(1, settings.sceneN - 1); saveSettings(); renderScenes(); });
    $('#scenePlus').addEventListener('click', () => { settings.sceneN = Math.min(9, settings.sceneN + 1); saveSettings(); renderScenes(); });
    $('#sceneGo').addEventListener('click', () => importAndUse(SC.make(settings.sceneKind, settings.sceneN, W / H)));

    /* ================================================================
       せってい
       ================================================================ */

    const setSnap = $('#setSnap'), setCount = $('#setCount'), setExpr = $('#setExpr'), setSize = $('#setSize');
    const setSound = $('#setSound');

    function updateSizeUI() {
        setSize.value = state.size;
        $('#sizeSample').style.setProperty('--s', Math.min(60, state.size) + 'px');
    }

    $('#btnMenu').addEventListener('click', () => {
        setSnap.checked = settings.snap;
        setCount.checked = settings.count;
        setExpr.checked = settings.expr;
        setSound.checked = settings.sound;
        updateSizeUI();
        openSheet('menuSheet');
    });
    setSnap.addEventListener('change', () => {
        settings.snap = setSnap.checked;
        saveSettings();
        if (settings.snap) { resolveOverlaps(state.blocks); commit(); }
        requestRender();
    });
    setCount.addEventListener('change', () => { settings.count = setCount.checked; saveSettings(); requestRender(); });
    setExpr.addEventListener('change', () => { settings.expr = setExpr.checked; saveSettings(); requestRender(); });
    setSound.addEventListener('change', () => { settings.sound = setSound.checked; saveSettings(); SND.setEnabled(settings.sound); });

    $('#btnHelp').addEventListener('click', () => openSheet('helpSheet'));
    $('#btnFull').addEventListener('click', () => {
        closeSheets();
        try {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        } catch (e) { toast('ぜんがめんに できませんでした'); }
    });
    document.addEventListener('fullscreenchange', () => {
        $('#fullLbl').textContent = document.fullscreenElement ? 'ぜんがめんを やめる' : 'ぜんがめん';
    });

    /* 大きさを かえても ならびかたは そのまま（ひだり うえを きじゅんに のびちぢみ） */
    let sizeBase = null;
    setSize.addEventListener('input', () => {
        if (!sizeBase) sizeBase = JSON.parse(JSON.stringify({ size: state.size, blocks: state.blocks, loops: state.loops }));
        const ns = +setSize.value, k = ns / sizeBase.size;
        state.dan = null;
        let ax = 0, ay = 0;
        if (sizeBase.blocks.length) {
            const b = L.bbox(sizeBase.blocks.map(o => [o.x, o.y]));
            ax = b.x0; ay = b.y0;
        }
        const nax = settings.snap ? L.snap(ax, ns) : ax, nay = settings.snap ? L.snap(ay, ns) : ay;
        state.size = ns;
        state.blocks = sizeBase.blocks.map(o => Object.assign({}, o, { x: nax + (o.x - ax) * k, y: nay + (o.y - ay) * k }));
        state.loops = sizeBase.loops.map(l => Object.assign({}, l, { pts: l.pts.map(([x, y]) => [r1(nax + (x - ax) * k), r1(nay + (y - ay) * k)]) }));
        $('#sizeSample').style.setProperty('--s', Math.min(60, ns) + 'px');
        requestRender();
    });
    setSize.addEventListener('change', () => { sizeBase = null; commit(); });

    $('#btnSave').addEventListener('click', () => {
        const k = 2;
        const c = document.createElement('canvas');
        c.width = Math.round(W * k);
        c.height = Math.round(H * k);
        const g = c.getContext('2d');
        g.scale(k, k);
        drawScene(g, W, H, { grid: false, hide: new Set(), live: false });
        if (!exprEl.hidden) {
            const t = exprEl.querySelector('b').textContent;
            g.font = '400 30px "Mochiy Pop One", "M PLUS Rounded 1c", sans-serif';
            const tw = g.measureText(t).width + 44;
            g.fillStyle = 'rgba(255,255,255,.95)';
            roundRectPath(g, (W - tw) / 2, H - 70, tw, 54, 16);
            g.fill();
            g.lineWidth = 3;
            g.strokeStyle = '#2f6fdc';
            g.stroke();
            g.fillStyle = '#33291f';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(t, W / 2, H - 42);
        }
        c.toBlob((blob) => {
            if (!blob) { toast('ほぞん できませんでした'); return; }
            const d = new Date(), p = (n) => String(n).padStart(2, '0');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `くくブロック-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            closeSheets();
            toast('「ダウンロード」に ほぞんしました');
        }, 'image/png');
    });

    /* ================================================================
       まど・おしらせ・キーボード
       ================================================================ */

    function openSheet(id) {
        closeSheets();
        hideBubble();
        $('#' + id).hidden = false;
    }
    function closeSheets() {
        for (const s of $$('.sheet-back')) s.hidden = true;
    }
    for (const s of $$('.sheet-back')) {
        s.addEventListener('click', (e) => { if (e.target === s) closeSheets(); });
    }
    for (const b of $$('[data-close]')) b.addEventListener('click', closeSheets);

    const toastEl = $('#toast');
    let toastTimer = 0;
    function toast(msg, ms) {
        toastEl.textContent = msg;
        toastEl.hidden = false;
        toastEl.style.animation = 'none';
        void toastEl.offsetWidth;
        toastEl.style.animation = '';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms || 2200);
    }

    window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
        else if (e.key === 'Escape') {
            if (!cam.hidden) closeCamera();
            else if ($$('.sheet-back').some(s => !s.hidden)) closeSheets();
            else if (tool === 'photo') setTool('move');
        }
    });

    /* ================================================================
       はじめ
       ================================================================ */

    resize();
    syncPenBar();
    updateUndoButtons();
    updateSizeUI();
    setTool('move');
    updateCard();
    syncBg();
    if (document.fonts) document.fonts.ready.then(requestRender);

    /* たしかめ用（テストから よぶ） */
    window.KukuApp = {
        get state() { return state; },
        settings, commit, undo, redo, setTool, importAndUse,
    };
})();
