/* ブロック おはじき ── アプリ本体
   ------------------------------------------------------------------
   ・つくえ（キャンバス）に ブロック・おはじき・かこみ・かいた 線・はいけいの しゃしん を かきます
   ・つくえは「ページ」ごとに べつ。いちばん うえの タブで きりかえます
   ・つくえは ひろく、2本ゆびの ピンチで 大きく・小さく できます（view）。
     ブロックの ばしょは ぜんぶ「つくえの ざひょう」で もち、がめんへは view で うつします
   ・ドラッグ ちゅうの ものは いちばん うえの キャンバス（dragLayer）に かくので、
     ブロックばこ や ごみばこ の うえでも 見えます
   ・かわった ときは ぜんぶ JSON に して「もどす」の れきしに つみます（ページごと）
   ・ページは localStorage、しゃしんは IndexedDB（photos.js）に のこります
   ------------------------------------------------------------------ */
(function () {
    'use strict';

    const L = window.KukuLogic;
    const P = window.KukuPhotos;
    const SND = window.KukuSound;
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];

    const BLOCK_COLORS = { b: '#2f6fdc', r: '#e5413a' };
    const OHAJIKI = {
        sb: ['#a9c8ff', '#2f6fdc', '#1d4a9e'],
        sr: ['#ffb8b0', '#e5413a', '#a8261f'],
    };
    const LOOP_COLORS = ['#f08a2c', '#2fa84f', '#8a5cd6', '#e0529c', '#1f9fb5', '#c9a100'];
    const PEN_COLORS = { k: '#2b2b2b', r: '#e5413a', b: '#2f6fdc', g: '#2fa84f' };
    const PAGES_KEY = 'kuku-block/v2/pages';
    const OLD_STATE_KEY = 'kuku-block/v1/state';   /* まえの はん（1ページだけ）の ほぞん */
    const SET_KEY = 'kuku-block/v1/settings';
    const MAX_PAGES = 20;
    const ZMIN = 0.3, ZMAX = 3;

    let seq = 0;
    const uid = (p) => p + Date.now().toString(36) + (seq++).toString(36);

    /* ================================================================
       ページ・ほぞん・もどす
       ================================================================ */

    const emptyState = (size) => ({ size: size || 48, blocks: [], loops: [], strokes: [], bg: null, loopColor: 0, dan: null, card: null });

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

    function normalize(s) {
        if (s && Array.isArray(s.blocks) && Array.isArray(s.loops) && Array.isArray(s.strokes)) {
            return Object.assign(emptyState(), s);
        }
        return null;
    }

    function newPage(st, view) {
        return {
            id: uid('g'),
            saved: JSON.stringify(st || emptyState()),
            undo: [], redo: [],
            view: view && [view.ox, view.oy, view.z].every(Number.isFinite) ? { ox: view.ox, oy: view.oy, z: Math.max(ZMIN, Math.min(ZMAX, view.z)) } : { ox: 0, oy: 0, z: 1 },
        };
    }

    function loadPages() {
        try {
            const d = JSON.parse(lsGet(PAGES_KEY));
            if (d && Array.isArray(d.pages)) {
                const ps = d.pages.map(p => {
                    const st = normalize(p && p.s);
                    if (!st) return null;
                    const pg = newPage(st, p.v);
                    if (typeof p.id === 'string') pg.id = p.id;
                    return pg;
                }).filter(Boolean);
                if (ps.length) return { list: ps, cur: Math.min(ps.length - 1, Math.max(0, d.cur | 0)) };
            }
        } catch (e) { /* こわれていたら あたらしく */ }
        let old = null;
        try { old = normalize(JSON.parse(lsGet(OLD_STATE_KEY))); } catch (e) { /* なければ よい */ }
        return { list: [newPage(old || emptyState())], cur: 0 };
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

    const loaded = loadPages();
    const pages = loaded.list;
    let curIdx = loaded.cur;
    let page = pages[curIdx];
    let state = JSON.parse(page.saved);
    let persistTimer = 0;

    function persistNow() {
        clearTimeout(persistTimer);
        const body = pages.map(p => '{"id":' + JSON.stringify(p.id) + ',"v":' + JSON.stringify(p.view) + ',"s":' + p.saved + '}').join(',');
        if (!lsSet(PAGES_KEY, '{"cur":' + curIdx + ',"pages":[' + body + ']}')) {
            toast('ブラウザに のこせません でした（ページが おおすぎるかも）');
        }
    }
    function persist() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persistNow, 250);
    }
    window.addEventListener('pagehide', persistNow);

    /** いまの じょうたいを れきしに のこす（かわっていなければ なにも しない） */
    function commit() {
        const now = JSON.stringify(state);
        if (now === page.saved) return;
        page.undo.push(page.saved);
        if (page.undo.length > 120) page.undo.shift();
        page.redo.length = 0;
        page.saved = now;
        persist();
        updateUndoButtons();
        renderTabs();
    }

    function restore(json) {
        cancelDrags();
        state = JSON.parse(json);
        page.saved = json;
        persist();
        afterPageChange();
    }

    /** ページの なかみが がらっと かわった あとの かたづけ */
    function afterPageChange() {
        bgPointers.clear();
        syncBg();
        updateUndoButtons();
        updateSizeUI();
        if (tool === 'photo' && !state.bg) setTool('move');
        resetCount();
        hideBubble();
        updateCard();
        updateZoomUI();
        renderTabs();
        requestRender();
    }

    function undo() {
        if (!page.undo.length || drags.size) return;
        page.redo.push(page.saved);
        restore(page.undo.pop());
    }

    function redo() {
        if (!page.redo.length || drags.size) return;
        page.undo.push(page.saved);
        restore(page.redo.pop());
    }

    function updateUndoButtons() {
        $('#btnUndo').disabled = !page.undo.length;
        $('#btnRedo').disabled = !page.redo.length;
    }

    /* ---------- ページ（タブ） ---------- */

    function switchPage(i) {
        if (i === curIdx || !pages[i]) return;
        commit();
        cancelDrags();
        curIdx = i;
        page = pages[i];
        state = JSON.parse(page.saved);
        persist();
        afterPageChange();
        scrollTabIntoView();
    }

    /** あたらしい ページを いまの ページの つぎに つくって ひらく */
    function addPage(st, view) {
        if (pages.length >= MAX_PAGES) { toast(`ページは ${MAX_PAGES}まい までです`); return false; }
        commit();
        pages.splice(curIdx + 1, 0, newPage(st || emptyState(state.size), view));
        curIdx = curIdx + 1;
        page = pages[curIdx];
        state = JSON.parse(page.saved);
        persist();
        afterPageChange();
        scrollTabIntoView();
        return true;
    }

    function closePage(i) {
        if (!pages[i]) return;
        cancelDrags();
        if (pages.length === 1) {
            pages[0] = newPage(emptyState(state.size));
            curIdx = 0;
        } else {
            pages.splice(i, 1);
            if (i < curIdx) curIdx--;
            curIdx = Math.min(curIdx, pages.length - 1);
        }
        page = pages[curIdx];
        state = JSON.parse(page.saved);
        persistNow();
        afterPageChange();
    }

    const isEmptyState = (s) => !s.bg && !s.blocks.length && !s.loops.length && !s.strokes.length && !s.card;

    const photoThumbs = new Map();   /* しゃしんの id → 小さな がぞう（タブに 出す） */
    async function refreshThumbs() {
        for (const p of await P.list()) photoThumbs.set(p.id, p.thumb);
        renderTabs();
    }

    function pageLabel(s) {
        if (s.bg) return s.bg.label || 'しゃしん';
        if (s.card) return 'おだい';
        return s.blocks.length || s.loops.length || s.strokes.length ? 'つくえ' : 'まっしろ';
    }

    /* タブの なまえ・しゃしんは ほぞんした 中身が かわった ときだけ しらべなおす */
    const tabInfo = new Map();
    function pageInfo(p, i) {
        if (i === curIdx) return { label: pageLabel(state), bgId: state.bg && state.bg.id, empty: isEmptyState(state) };
        const c = tabInfo.get(p.id);
        if (c && c.saved === p.saved) return c;
        const s = JSON.parse(p.saved);
        const info = { saved: p.saved, label: pageLabel(s), bgId: s.bg && s.bg.id, empty: isEmptyState(s) };
        tabInfo.set(p.id, info);
        return info;
    }

    const tabsEl = $('#tabs');
    let closingTab = -1;
    function renderTabs() {
        tabsEl.innerHTML = '';
        pages.forEach((p, i) => {
            const info = pageInfo(p, i);
            const tab = document.createElement('div');
            tab.className = 'tab' + (i === curIdx ? ' on' : '');
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', i === curIdx ? 'true' : 'false');
            tab.tabIndex = 0;
            const thumb = info.bgId && photoThumbs.get(info.bgId);
            const img = document.createElement(thumb ? 'img' : 'span');
            img.className = 'tab-thumb';
            if (thumb) { img.src = thumb; img.alt = ''; }
            const name = document.createElement('span');
            name.className = 'tab-name';
            name.textContent = `${i + 1}  ${info.label}`;
            const x = document.createElement('button');
            x.className = 'tab-x';
            x.setAttribute('aria-label', `${i + 1}ページを とじる`);
            x.textContent = '✕';
            x.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pageInfo(pages[i], i).empty) { closePage(i); return; }
                closingTab = i;
                openSheet('tabCloseSheet');
            });
            tab.append(img, name, x);
            tab.addEventListener('click', () => switchPage(i));
            tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchPage(i); } });
            tabsEl.appendChild(tab);
        });
        $('#tabAdd').disabled = pages.length >= MAX_PAGES;
        const n = $('#sharePages');
        if (n) n.textContent = pages.length;
    }
    function scrollTabIntoView() {
        const t = tabsEl.children[curIdx];
        if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    $('#tabAdd').addEventListener('click', () => { if (addPage()) toast('あたらしい ページ'); });
    $('#tabCloseYes').addEventListener('click', () => { closeSheets(); closePage(closingTab); });

    const blockById = (id) => state.blocks.find(b => b.id === id);
    const loopById = (id) => state.loops.find(l => l.id === id);

    /* ================================================================
       キャンバス・見る ところ（ズーム）
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

    /** がめん（つくえの 左上から）→ つくえの ざひょう */
    function toWorld(sx, sy) {
        const v = page.view;
        return [(sx - v.ox) / v.z, (sy - v.oy) / v.z];
    }
    const toScreen = (x, y) => [x * page.view.z + page.view.ox, y * page.view.z + page.view.oy];
    const toBoard = (e) => toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const screenPt = (e) => [e.clientX - rect.left, e.clientY - rect.top];

    /** いま 見えている ところ（つくえの ざひょう）。inset で したの バーなどを のぞく */
    function viewRect(inset) {
        const i = inset || { l: 0, r: 0, t: 0, b: 0 };
        const [x0, y0] = toWorld(i.l, i.t), [x1, y1] = toWorld(W - i.r, H - i.b);
        return { x0, y0, x1, y1 };
    }
    /** ブロックを おく ときに つかう ところ（したの バーの ぶん あける） */
    const placeRect = () => viewRect({ l: 0, r: 0, t: state.card ? 90 : 0, b: state.dan ? 120 : 64 });

    let viewTimer = 0;
    function viewChanged() {
        updateZoomUI();
        hideBubble();
        requestRender();
        clearTimeout(viewTimer);
        viewTimer = setTimeout(persistNow, 400);
    }

    /** がめんの (sx, sy) を 中心に f ばい */
    function zoomView(f, sx, sy) {
        const v = page.view;
        const nz = Math.max(ZMIN, Math.min(ZMAX, v.z * f));
        f = nz / v.z;
        v.ox = sx - (sx - v.ox) * f;
        v.oy = sy - (sy - v.oy) * f;
        v.z = nz;
        viewChanged();
    }

    function setView(nv) {
        Object.assign(page.view, nv);
        page.view.z = Math.max(ZMIN, Math.min(ZMAX, page.view.z));
        viewChanged();
    }

    /** box（つくえの ざひょう）が 見える ように する。はいって いれば なにも しない。
        いまの 大きさで はいる ときは すこし ずらすだけ、はいらない ときは 小さく する */
    function ensureVisible(box, inset) {
        const i = inset || { l: 8, r: 8, t: 8, b: 8 };
        const v = page.view;
        const [sx0, sy0] = toScreen(box.x0, box.y0), [sx1, sy1] = toScreen(box.x1, box.y1);
        if (sx0 >= i.l - 1 && sy0 >= i.t - 1 && sx1 <= W - i.r + 1 && sy1 <= H - i.b + 1) return false;
        if (sx1 - sx0 <= W - i.l - i.r && sy1 - sy0 <= H - i.t - i.b) {
            let dx = 0, dy = 0;
            if (sx0 < i.l) dx = i.l - sx0; else if (sx1 > W - i.r) dx = W - i.r - sx1;
            if (sy0 < i.t) dy = i.t - sy0; else if (sy1 > H - i.b) dy = H - i.b - sy1;
            setView({ ox: v.ox + dx, oy: v.oy + dy, z: v.z });
            return true;
        }
        setView(L.fitView(box, W, H, i, ZMIN, v.z));
        return true;
    }

    function contentBox() {
        const S = state.size, pts = [];
        for (const b of state.blocks) pts.push([b.x, b.y], [b.x + S, b.y + S]);
        for (const l of state.loops) pts.push(...l.pts);
        for (const t of state.strokes) pts.push(...t.pts);
        if (state.bg && bgImage) {
            const [iw, ih] = imgSize(bgImage);
            const [w, h] = state.bg.rot % 2 ? [ih, iw] : [iw, ih];
            pts.push([state.bg.x - w * state.bg.s / 2, state.bg.y - h * state.bg.s / 2], [state.bg.x + w * state.bg.s / 2, state.bg.y + h * state.bg.s / 2]);
        }
        return pts.length ? L.bbox(pts) : null;
    }

    function updateZoomUI() {
        $('#zoomPct').textContent = Math.round(page.view.z * 100) + '%';
    }
    $('#zoomIn').addEventListener('click', () => zoomView(1.25, W / 2, H / 2));
    $('#zoomOut').addEventListener('click', () => zoomView(1 / 1.25, W / 2, H / 2));
    $('#zoomPct').addEventListener('click', () => setView({ ox: 0, oy: 0, z: 1 }));
    $('#zoomFit').addEventListener('click', () => {
        const box = contentBox();
        if (!box) { setView({ ox: 0, oy: 0, z: 1 }); return; }
        const pad = state.size;
        setView(L.fitView({ x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad }, W, H, { l: 8, r: 8, t: 8, b: 70 }, ZMIN, ZMAX));
    });

    let dirty = false;
    function requestRender() {
        if (dirty) return;
        dirty = true;
        requestAnimationFrame(render);
    }

    function render() {
        dirty = false;
        const hide = hiddenIds();
        const v = page.view;
        ctx.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.ox, dpr * v.oy);
        drawScene(ctx, viewRect(), { grid: true, hide, live: true, z: v.z });
        drawLayer(hide);
        updateExpr();
    }

    /* ---------- え を かく ---------- */

    let bgImage = null;
    let bgImageId = null;

    function imgSize(img) {
        return [img.naturalWidth || img.width, img.naturalHeight || img.height];
    }

    /** vr … かく ところ（つくえの ざひょう）。g には もう view の へんかんが かかっている */
    function drawScene(g, vr, opts) {
        const S = state.size, z = opts.z || 1;
        g.fillStyle = '#fffdf8';
        g.fillRect(vr.x0 - 2, vr.y0 - 2, vr.x1 - vr.x0 + 4, vr.y1 - vr.y0 + 4);

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
            const off = 0.5 / z;
            for (let x = Math.floor(vr.x0 / S) * S; x < vr.x1; x += S) { g.moveTo(x + off, vr.y0); g.lineTo(x + off, vr.y1); }
            for (let y = Math.floor(vr.y0 / S) * S; y < vr.y1; y += S) { g.moveTo(vr.x0, y + off); g.lineTo(vr.x1, y + off); }
            g.strokeStyle = state.bg ? 'rgba(0,0,0,.07)' : 'rgba(47,111,220,.09)';
            g.lineWidth = 1 / z;
            g.stroke();
        }

        for (const l of state.loops) if (!opts.hide.has(l.id)) drawLoopFill(g, l);
        for (const b of state.blocks) if (!opts.hide.has(b.id)) drawPiece(g, b, S, false);
        for (const l of state.loops) if (!opts.hide.has(l.id)) drawLoopLine(g, l);
        drawCountMarks(g, opts.hide);
        for (const s of state.strokes) if (!opts.hide.has(s.id)) drawStroke(g, s);
        if (settings.count) {
            for (const l of state.loops) if (!opts.hide.has(l.id)) drawBadge(g, l);
        }

        if (opts.live) {
            if (tool === 'move') {
                for (const l of state.loops) if (!opts.hide.has(l.id) || rotating(l.id)) drawHandle(g, l, rotating(l.id));
            }
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
        const v = page.view;
        lctx.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * (rect.left + v.ox), dpr * (rect.top + v.oy));
        const S = state.size;
        for (const l of state.loops) if (hide.has(l.id)) drawLoopFill(lctx, l);
        for (const b of state.blocks) if (hide.has(b.id)) drawPiece(lctx, b, S, true);
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

    /** ブロック か おはじき を 1こ かく（b.a が あれば かたむける） */
    function drawPiece(g, b, S, lift) {
        const cx = b.x + S / 2, cy = b.y + S / 2;
        g.save();
        g.translate(cx, cy);
        if (b.a) g.rotate(b.a);
        if (L.isOhajiki(b.c)) drawOhajiki(g, S, b.c, lift);
        else drawBlock(g, S, b.c, lift);
        g.restore();
    }

    /** まん中が (0, 0) の ブロック */
    function drawBlock(g, S, c, lift) {
        const inset = Math.max(1, S * 0.03);
        const s = S - inset * 2;
        roundRectPath(g, -s / 2, -s / 2, s, s, S * 0.12);
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
        const r = s * 0.36;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fillStyle = BLOCK_COLORS[c] || BLOCK_COLORS.b;
        g.fill();
        g.beginPath();
        g.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.fill();
    }

    /** さくらの 花の かたち（まるい はなびら 5まい）の みち。r … いちばん そとまでの 大きさ */
    function flowerPath(g, R) {
        const d = R * 0.52, pr = R * 0.48;
        g.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
            const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
            g.moveTo(cx + pr, cy);
            g.arc(cx, cy, pr, 0, Math.PI * 2);
        }
        g.moveTo(R * 0.6, 0);
        g.arc(0, 0, R * 0.6, 0, Math.PI * 2);
    }

    /** まん中が (0, 0) の さくらの おはじき（まるい はなびら 5まい・まん中に くろい じしゃく） */
    function drawOhajiki(g, S, c, lift) {
        const [light, base, dark] = OHAJIKI[c] || OHAJIKI.sb;
        const R = S * 0.48;
        /* ふち（そとがわ だけ 見える ように、さきに ふとく かいて うえから ぬる） */
        flowerPath(g, R);
        if (lift) {
            g.shadowColor = 'rgba(0,0,0,.3)';
            g.shadowBlur = 12;
            g.shadowOffsetY = 5;
        } else {
            g.shadowColor = 'rgba(0,0,0,.2)';
            g.shadowBlur = S * 0.06;
            g.shadowOffsetY = S * 0.03;
        }
        g.lineWidth = Math.max(1.5, S * 0.05);
        g.lineJoin = 'round';
        g.strokeStyle = dark;
        g.stroke();
        g.shadowColor = 'transparent';
        const grad = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.05, 0, 0, R);
        grad.addColorStop(0, light);
        grad.addColorStop(0.6, base);
        grad.addColorStop(1, dark);
        g.fillStyle = grad;
        g.fill();
        /* はなびらの すじ と つや */
        g.lineWidth = Math.max(1, S * 0.025);
        g.strokeStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + Math.PI / 5 + i * Math.PI * 2 / 5;
            g.beginPath();
            g.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
            g.lineTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
            g.stroke();
        }
        g.beginPath();
        g.ellipse(-R * 0.3, -R * 0.62, R * 0.2, R * 0.1, -0.4, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.fill();
        /* まん中の くろい じしゃく */
        const mr = R * 0.24;
        const mg = g.createRadialGradient(-mr * 0.35, -mr * 0.35, mr * 0.1, 0, 0, mr);
        mg.addColorStop(0, '#5a5a5a');
        mg.addColorStop(0.5, '#1c1c1c');
        mg.addColorStop(1, '#000');
        g.beginPath();
        g.arc(0, 0, mr, 0, Math.PI * 2);
        g.fillStyle = mg;
        g.fill();
        g.lineWidth = Math.max(1, S * 0.02);
        g.strokeStyle = 'rgba(255,255,255,.35)';
        g.stroke();
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

    /* くるくる まわす ための つまみ（かこみの 数字の よこ） */
    const handleR = () => 14 / Math.min(1, page.view.z);
    function handlePos(l) {
        const b = L.bbox(l.pts);
        return [b.x1 + 12 + handleR(), b.y0 + 8];   /* 数字（badgePos）の すぐ 右 */
    }
    function drawHandle(g, l, active) {
        const [x, y] = handlePos(l);
        const r = handleR();
        g.save();
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = l.color;
        g.shadowColor = 'rgba(0,0,0,.25)';
        g.shadowBlur = active ? 10 : 4;
        g.fill();
        g.shadowColor = 'transparent';
        g.lineWidth = r * 0.16;
        g.strokeStyle = '#fff';
        g.stroke();
        /* ↻ の しるし */
        const a = r * 0.5;
        g.beginPath();
        g.arc(x, y, a, -Math.PI * 0.9, Math.PI * 0.45);
        g.lineWidth = r * 0.18;
        g.lineCap = 'round';
        g.stroke();
        const ex = x + a * Math.cos(Math.PI * 0.45), ey = y + a * Math.sin(Math.PI * 0.45);
        g.beginPath();
        g.moveTo(ex + r * 0.28, ey - r * 0.05);
        g.lineTo(ex - r * 0.05, ey + r * 0.02);
        g.lineTo(ex + r * 0.12, ey - r * 0.32);
        g.closePath();
        g.fillStyle = '#fff';
        g.fill();
        g.restore();
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
            const cx = b.x + S / 2, cy = b.y + S / 2;
            g.beginPath();
            g.arc(cx, cy, S * 0.47, 0, Math.PI * 2);
            g.lineWidth = 4;
            g.strokeStyle = '#f5b800';
            g.stroke();
            const t = String(i + 1);
            g.font = `800 ${Math.round(S * (t.length > 2 ? 0.34 : 0.44))}px "M PLUS Rounded 1c", sans-serif`;
            g.lineWidth = Math.max(3, S * 0.08);
            g.strokeStyle = 'rgba(0,0,0,.55)';
            g.strokeText(t, cx, cy + 1);
            g.fillStyle = '#fff';
            g.fillText(t, cx, cy + 1);
        });
        const vr = viewRect();
        for (const gr of count.groups) {
            const l = loopById(gr.loopId);
            if (!l || hide.has(l.id)) continue;
            const bb = L.bbox(l.pts);
            const t = String(gr.total);
            g.font = '400 26px "Mochiy Pop One", "M PLUS Rounded 1c", sans-serif';
            const w = Math.max(44, g.measureText(t).width + 24), h = 38;
            /* かこみの ひだり（はいらない ときは 右）に 出す */
            let x = bb.x0 - w - 6;
            if (x < vr.x0 + 2) x = bb.x1 + 26;
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
    const touches = new Map();    /* つくえに ふれている ゆび（がめんの ざひょう） */
    let pinch = null;             /* 2本ゆびで つくえを 大きく・小さく している とき */
    let tool = 'move';
    let count = { order: [], groups: [] };  /* かぞえる（れきしには のこさない） */

    function hiddenIds() {
        const s = new Set();
        for (const d of drags.values()) {
            if (d.type === 'blocks') d.ids.forEach(i => s.add(i));
            else if (d.type === 'loop' || d.type === 'rot') [d.loopId, ...d.blockIds, ...d.loopIds].forEach(i => s.add(i));
        }
        return s;
    }
    const rotating = (id) => [...drags.values()].some(d => d.type === 'rot' && d.loopId === id);

    /** やりかけの ドラッグを ぜんぶ やめて、さいごに のこした ところに もどす */
    function cancelDrags() {
        if (!drags.size) return;
        for (const d of drags.values()) clearTimeout(d.timer);
        drags.clear();
        state = JSON.parse(page.saved);
        trashEl.classList.remove('hot');
        requestRender();
    }

    function inPiece(b, x, y, S) {
        let dx = x - (b.x + S / 2), dy = y - (b.y + S / 2);
        if (b.a) [dx, dy] = L.rotateAround(dx, dy, 0, 0, -b.a);
        return Math.abs(dx) <= S / 2 && Math.abs(dy) <= S / 2;
    }

    function hitBlock(x, y) {
        const S = state.size, hide = hiddenIds();
        for (let i = state.blocks.length - 1; i >= 0; i--) {
            const b = state.blocks[i];
            if (!hide.has(b.id) && inPiece(b, x, y, S)) return b;
        }
        return null;
    }

    function hitHandle(x, y) {
        const hide = hiddenIds(), r = handleR() + 8;
        for (let i = state.loops.length - 1; i >= 0; i--) {
            const l = state.loops[i];
            if (hide.has(l.id)) continue;
            const [hx, hy] = handlePos(l);
            if (Math.hypot(x - hx, y - hy) <= r) return l;
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

    function startLoopDrag(e, l, x, y, type) {
        const busy = hiddenIds();
        const blocks = L.blocksInLoop(state.blocks.filter(b => !busy.has(b.id)), l.pts, state.size);
        const inner = L.loopsInLoop(state.loops.filter(o => !busy.has(o.id)), l);
        const loops = [l, ...inner];
        toFront(blocks.map(b => b.id));
        const d = {
            type, loopId: l.id, blockIds: blocks.map(b => b.id), loopIds: inner.map(o => o.id),
            start: [x, y], moved: false,
            origBlocks: new Map(blocks.map(b => [b.id, { x: b.x, y: b.y, a: b.a || 0 }])),
            origLoops: new Map(loops.map(o => [o.id, o.pts.map(p => p.slice())])),
        };
        if (type === 'rot') {
            const S = state.size;
            const pb = blocks.length ? groupBox(blocks) : L.bbox(l.pts);
            d.pivot = [(pb.x0 + pb.x1) / 2, (pb.y0 + pb.y1) / 2];
            d.a0 = Math.atan2(y - d.pivot[1], x - d.pivot[0]);
            d.delta = 0;
            void S;
        }
        drags.set(e.pointerId, d);
        requestRender();
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        rect = wrap.getBoundingClientRect();
        const [x, y] = toBoard(e);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* なくても よい */ }
        hideBubble();

        /* 2本め の ゆび → つくえを 大きく・小さく（しゃしんを うごかす とき いがい） */
        if (e.pointerType === 'touch') touches.set(e.pointerId, screenPt(e));
        if (tool !== 'photo' && e.pointerType === 'touch' && touches.size >= 2) {
            if (!pinch) {
                cancelDrags();
                pinch = { ids: [...touches.keys()].slice(-2) };
            }
            return;
        }
        if (pinch) return;

        if (tool === 'move') {
            const h = hitHandle(x, y);
            if (h) { startLoopDrag(e, h, x, y, 'rot'); return; }
            const b = hitBlock(x, y);
            if (b) { startBlockDrag(e, [b.id], x, y, { tapFlip: true, allowCluster: true }); return; }
            const l = hitLoop(x, y);
            if (l) startLoopDrag(e, l, x, y, 'loop');
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

    function movePinch(e) {
        const prev = new Map(touches);
        touches.set(e.pointerId, screenPt(e));
        const [a, b] = pinch.ids;
        const a0 = prev.get(a), b0 = prev.get(b), a1 = touches.get(a), b1 = touches.get(b);
        if (!a0 || !b0 || !a1 || !b1) return;
        const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1;
        const d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) || 1;
        const c0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
        const c1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
        const v = page.view;
        const nz = Math.max(ZMIN, Math.min(ZMAX, v.z * d1 / d0));
        const f = nz / v.z;
        v.ox = c1[0] - (c0[0] - v.ox) * f;
        v.oy = c1[1] - (c0[1] - v.oy) * f;
        v.z = nz;
        viewChanged();
    }

    window.addEventListener('pointermove', (e) => {
        if (pinch && pinch.ids.includes(e.pointerId)) { movePinch(e); return; }
        if (touches.has(e.pointerId)) touches.set(e.pointerId, screenPt(e));
        if (bgPointers.has(e.pointerId)) { moveBg(e); return; }
        const d = drags.get(e.pointerId);
        if (!d) return;
        const [x, y] = toBoard(e);

        if (d.type === 'blocks' || d.type === 'loop' || d.type === 'rot') {
            const dx = x - d.start[0], dy = y - d.start[1];
            if (!d.moved) {
                if (Math.hypot(dx, dy) * page.view.z < (e.pointerType === 'mouse' ? 3 : 8)) return;
                d.moved = true;
                clearTimeout(d.timer);
            }
            if (d.type === 'blocks') {
                for (const id of d.ids) {
                    const b = blockById(id), o = d.orig.get(id);
                    if (b) { b.x = o[0] + dx; b.y = o[1] + dy; }
                }
            } else if (d.type === 'loop') {
                moveLoopGroup(d, dx, dy);
            } else {
                let delta = Math.atan2(y - d.pivot[1], x - d.pivot[0]) - d.a0;
                /* -180°〜180° を こえても つづけて まわせる ように */
                while (delta - d.delta > Math.PI) delta -= Math.PI * 2;
                while (delta - d.delta < -Math.PI) delta += Math.PI * 2;
                d.delta = delta;
                rotateGroup(d, L.snapAngle(delta, 5 * Math.PI / 180));
            }
            if (d.type !== 'rot') trashEl.classList.toggle('hot', overTrash(e));
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
            if (b) { b.x = o.x + dx; b.y = o.y + dy; }
        }
        for (const [id, pts] of d.origLoops) {
            const l = loopById(id);
            if (l) l.pts = pts.map(([px, py]) => [r1(px + dx), r1(py + dy)]);
        }
    }

    /** もとの いち から ang だけ まわした ところに おく */
    function rotateGroup(d, ang) {
        const S = state.size, [px, py] = d.pivot;
        for (const [id, o] of d.origBlocks) {
            const b = blockById(id);
            if (!b) continue;
            const [cx, cy] = L.rotateAround(o.x + S / 2, o.y + S / 2, px, py, ang);
            b.x = cx - S / 2;
            b.y = cy - S / 2;
            const a = o.a + ang;
            if (L.isRightAngle(a)) delete b.a; else b.a = Math.round(a * 1e4) / 1e4;
        }
        for (const [id, pts] of d.origLoops) {
            const l = loopById(id);
            if (l) l.pts = pts.map(([x, y]) => L.rotateAround(x, y, px, py, ang).map(r1));
        }
    }

    function endPointer(e, cancelled) {
        touches.delete(e.pointerId);
        if (pinch) {
            /* ゆびが ぜんぶ はなれるまで、のこった ゆびでは なにも しない */
            if (!touches.size) pinch = null;
            return;
        }
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
        else if (d.type === 'rot') endRotate(d);
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
                /* ブロックばこを タップ → 見えている ところの ひだり うえから じゅんに ならべる */
                const b = blockById(d.ids[0]);
                const occ = occupiedCells(d.ids);
                const pr = placeRect();
                const x1 = Math.min(pr.x1, L.snap(pr.x0, S) + 11 * S + S / 2);
                const pos = L.findFreeRect(1, 1, S, occ, { x0: pr.x0, y0: pr.y0, x1, y1: pr.y1 }, 0)
                         || L.findFreeRect(1, 1, S, occ, pr, 0)
                         || [L.snap(pr.x0, S) + S, L.snap(pr.y0, S) + S];
                b.x = pos[0]; b.y = pos[1];
                SND.pop();
            } else if (d.tapFlip && !cancelled) {
                const b = blockById(d.ids[0]);
                if (b) { b.c = L.flipColor(b.c); SND.flip(); }  /* タップで うらがえす */
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

    /** 見えている ところ（bounds）に おさめる ための ずらし */
    function clampShift(box, bounds) {
        const v = bounds || viewRect();
        const W2 = v.x1 - v.x0, H2 = v.y1 - v.y0;
        let dx = 0, dy = 0;
        if (box.x1 - box.x0 <= W2) { if (box.x0 < v.x0) dx = v.x0 - box.x0; else if (box.x1 > v.x1) dx = v.x1 - box.x1; } else dx = v.x0 - box.x0;
        if (box.y1 - box.y0 <= H2) { if (box.y0 < v.y0) dy = v.y0 - box.y0; else if (box.y1 > v.y1) dy = v.y1 - box.y1; } else dy = v.y0 - box.y0;
        return [dx, dy];
    }
    const snapUp = (v, S) => Math.sign(v) * Math.ceil(Math.abs(v) / S - 1e-6) * S;

    /** はなした ブロックを おちつかせる：見えている ところへ・マス目に・かさならない ように */
    function settle(blocks) {
        if (!blocks.length) return;
        const S = state.size;
        shiftBlocks(blocks, ...clampShift(groupBox(blocks)));
        if (!settings.snap) return;
        const f = blocks[0];
        shiftBlocks(blocks, L.snap(f.x, S) - f.x, L.snap(f.y, S) - f.y);
        const [cx, cy] = clampShift(groupBox(blocks));
        shiftBlocks(blocks, snapUp(cx, S), snapUp(cy, S));
        resolveOverlaps(blocks);
    }

    function resolveOverlaps(blocks) {
        const S = state.size;
        const occ = occupiedCells(blocks.map(b => b.id));
        const vr = viewRect();
        const bounds = { x0: Math.min(vr.x0, ...blocks.map(b => b.x)), y0: Math.min(vr.y0, ...blocks.map(b => b.y)),
                         x1: Math.max(vr.x1, ...blocks.map(b => b.x + S)), y1: Math.max(vr.y1, ...blocks.map(b => b.y + S)) };
        for (const b of blocks) {
            if (occ.has(L.cellKey(b.x, b.y, S))) {
                [b.x, b.y] = L.findFreeCell(b.x, b.y, S, occ, bounds);
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
        /* 見えている ところから はみださない ように */
        const pts = [];
        for (const o of d.origLoops.values()) for (const p of o) pts.push(p);
        for (const o of d.origBlocks.values()) pts.push([o.x, o.y], [o.x + S, o.y + S]);
        const b0 = L.bbox(pts);
        const [cx, cy] = clampShift({ x0: b0.x0 + dx, y0: b0.y0 + dy, x1: b0.x1 + dx, y1: b0.y1 + dy });
        dx += cx; dy += cy;
        if (settings.snap && d.origBlocks.size) { dx = L.snap(dx, S); dy = L.snap(dy, S); }
        moveLoopGroup(d, dx, dy);
        if (settings.snap) resolveOverlaps(d.blockIds.map(blockById).filter(Boolean).filter(b => !b.a));
    }

    /** つまみを はなした：90° ちかくなら ぴたっと とめて マス目に そろえる */
    function endRotate(d) {
        if (!d.moved) { toast('つまんで ぐるっと まわしてね'); return; }
        const ang = L.snapAngle(d.delta, 12 * Math.PI / 180);
        rotateGroup(d, ang);
        const grp = { blocks: d.blockIds.map(blockById).filter(Boolean), loops: [d.loopId, ...d.loopIds].map(loopById).filter(Boolean) };
        if (grp.blocks.every(b => !b.a)) settleGroup(grp);
        SND.flip();
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
        const [sx0, sy0] = toScreen(bb.x0, bb.y0), [sx1, sy1] = toScreen(bb.x1, bb.y1);
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        const left = Math.max(6, Math.min(W - bw - 6, (sx0 + sx1) / 2 - bw / 2));
        let top = sy0 - bh - 16;
        if (top < 6) top = Math.min(H - bh - 6, sy1 + 12);
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

    /** まっすぐに もどった まとまりを マス目に そろえ、ほかと かさなる ときは あいている ところへ */
    function settleGroup(grp) {
        const S = state.size;
        if (settings.snap && grp.blocks.length) {
            const f = grp.blocks[0];
            shiftGroup(grp, L.snap(f.x, S) - f.x, L.snap(f.y, S) - f.y);
        }
        let [dx, dy] = clampShift(groupBoxOf(grp));
        if (settings.snap) { dx = snapUp(dx, S); dy = snapUp(dy, S); }
        shiftGroup(grp, dx, dy);
        const box = groupBoxOf(grp);
        const obstacles = othersBoxes(grp);
        const inner = { x0: box.x0 + 2, y0: box.y0 + 2, x1: box.x1 - 2, y1: box.y1 - 2 };
        if (obstacles.some(o => L.boxesOverlap(inner, o))) {
            const off = L.findSpot(box, obstacles, viewRect(), S, 2);
            if (off) shiftGroup(grp, off[0], off[1]);
        }
        if (settings.snap) resolveOverlaps(grp.blocks);
    }

    /** 90° まわす（3 × 4 ⇔ 4 × 3） */
    function rotateLoop(id) {
        const l = loopById(id);
        if (!l) return;
        const grp = loopGroup(l);
        const S = state.size;
        const pb = grp.blocks.length ? groupBox(grp.blocks) : L.bbox(l.pts);
        const d = {
            pivot: [(pb.x0 + pb.x1) / 2, (pb.y0 + pb.y1) / 2],
            origBlocks: new Map(grp.blocks.map(b => [b.id, { x: b.x, y: b.y, a: b.a || 0 }])),
            origLoops: new Map(grp.loops.map(o => [o.id, o.pts.map(p => p.slice())])),
        };
        rotateGroup(d, Math.PI / 2);
        if (grp.blocks.every(b => !b.a)) settleGroup(grp);
        void S;
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
        const off = L.findSpot(grp.box, obstacles, viewRect(), S, 4)
                 || L.findSpot(grp.box, obstacles, { x0: grp.box.x0 - 4 * S, y0: grp.box.y0, x1: grp.box.x1 + 40 * S, y1: grp.box.y1 + 40 * S }, S, 4);
        if (!off) { toast('あいている ばしょが ないよ'); return; }
        const [dx, dy] = off;
        for (const o of grp.loops) {
            const color = LOOP_COLORS[state.loopColor % LOOP_COLORS.length];
            state.loopColor = (state.loopColor + 1) % LOOP_COLORS.length;
            state.loops.push({ id: uid('l'), pts: o.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]), color });
        }
        for (const b of grp.blocks) {
            const nb = { id: uid('b'), x: b.x + dx, y: b.y + dy, c: b.c };
            if (b.a) nb.a = b.a;
            state.blocks.push(nb);
        }
        const nbox = { x0: grp.box.x0 + dx, y0: grp.box.y0 + dy, x1: grp.box.x1 + dx, y1: grp.box.y1 + dy };
        ensureVisible(nbox, { l: 8, r: 8, t: 8, b: 70 });
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

    /** 見えている ところに ぴったり はいる 大きさ */
    function fitScale(img, rot) {
        const [iw, ih] = imgSize(img);
        const [w, h] = rot % 2 ? [ih, iw] : [iw, ih];
        const v = viewRect();
        return Math.min((v.x1 - v.x0) / w, (v.y1 - v.y0) / h);
    }
    function viewCenter() {
        const v = viewRect();
        return [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2];
    }

    /** つかっている しゃしん（どの ページ・もどす の れきし も）は のこして、ふるい ものを けす */
    function pruneBg() {
        const keep = new Set();
        const strs = [JSON.stringify(state)];
        for (const p of pages) strs.push(p.saved, ...p.undo, ...p.redo);
        for (const t of strs) for (const m of t.matchAll(/"bg":\{"id":"([^"]+)"/g)) keep.add(m[1]);
        P.prune([...keep]);
    }

    /** はいけいを きめる。この ページに もう はいけいが あれば、あたらしい タブに する */
    function useBackground(id, image, label, inPlace) {
        let newTab = false;
        if (!inPlace && state.bg) newTab = addPage();
        bgImageId = id;
        bgImage = image;
        const [cx, cy] = viewCenter();
        state.bg = { id, x: cx, y: cy, s: fitScale(image, 0), rot: 0, alpha: 1, label: label || 'しゃしん' };
        commit();
        requestRender();
        pruneBg();
        refreshThumbs();
        return newTab;
    }

    let importing = false;
    /** がぞうを とりこんで はいけいに する。opts.label … タブの なまえ、opts.inPlace … いまの ページに */
    async function importAndUse(src, opts) {
        const o = opts || {};
        if (importing) return;
        importing = true;
        toast('よみこみちゅう…', 20000);
        try {
            const { id, image } = await P.importSource(src);
            closeSheets();
            const newTab = useBackground(id, image, o.label, o.inPlace);
            toast(newTab ? 'あたらしい ページ（タブ）に しました' : 'はいけいに しました');
        } catch (err) {
            toast('がぞうを よみこめませんでした');
        } finally {
            importing = false;
        }
    }
    const fileLabel = (f) => (f && f.name ? f.name.replace(/\.[^.]+$/, '').slice(0, 16) : '') || 'しゃしん';

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
        e.preventDefault();
        if (tool === 'photo' && state.bg) {
            const p = toBoard(e);
            zoomBg(Math.exp(-e.deltaY * 0.0015), p, p);
            requestRender();
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(commit, 400);
            return;
        }
        /* Ctrl＋ホイール・タッチパッドの ピンチ → 大きさ、ふつうの ホイール → うごかす */
        if (e.ctrlKey || e.metaKey) {
            const f = Math.max(0.8, Math.min(1.25, Math.exp(-e.deltaY * 0.01)));
            zoomView(f, e.clientX - rect.left, e.clientY - rect.top);
        } else {
            page.view.ox -= e.deltaX;
            page.view.oy -= e.deltaY;
            viewChanged();
        }
    }, { passive: false });

    $('#bgPlus').addEventListener('click', () => { const c = viewCenter(); zoomBg(1.15, c, c); commit(); requestRender(); });
    $('#bgMinus').addEventListener('click', () => { const c = viewCenter(); zoomBg(1 / 1.15, c, c); commit(); requestRender(); });
    $('#bgRot').addEventListener('click', () => {
        const b = state.bg;
        if (!b) return;
        b.rot = (b.rot + 1) % 4;
        if (bgImage) { b.s = fitScale(bgImage, b.rot); [b.x, b.y] = viewCenter(); }
        commit();
        requestRender();
    });
    $('#bgFit').addEventListener('click', () => {
        const b = state.bg;
        if (!b || !bgImage) return;
        b.s = fitScale(bgImage, b.rot);
        [b.x, b.y] = viewCenter();
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
                if (useBackground(p.id, img, 'しゃしん')) toast('あたらしい ページ（タブ）に しました');
            });
            box.appendChild(btn);
        }
    }

    const fileInput = $('#fileInput');
    $('#btnFile').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (f) importAndUse(f, { label: fileLabel(f) });
    });

    $('#btnPaste').addEventListener('click', async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const it of items) {
                const type = it.types.find(t => t.startsWith('image/'));
                if (type) { importAndUse(await it.getType(type), { label: 'はりつけ' }); return; }
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
        importAndUse(it.getAsFile(), { label: 'はりつけ' });
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
        const files = [...e.dataTransfer.files];
        const f = files.find(x => x.type.startsWith('image/'));
        const j = files.find(x => /\.json$/i.test(x.name) || x.type === 'application/json');
        if (f) importAndUse(f, { label: fileLabel(f) });
        else if (j) loadShareFile(j);
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
        setTimeout(() => { closeCamera(); importAndUse(shot, { label: 'カメラ' }); }, 150);
    });

    /* ================================================================
       ならべる
       ================================================================ */

    function renderArrayPreview() {
        $('#arrRows').textContent = settings.rows;
        $('#arrCols').textContent = settings.cols;
        for (const b of $$('.arr-pick')) b.classList.toggle('on', b.dataset.c === settings.arrC);
        const n = Math.max(settings.rows, settings.cols);
        const ps = Math.min(36, Math.floor(200 / n));
        const box = document.createElement('div');
        box.className = 'arr-grid';
        box.style.gridTemplateColumns = `repeat(${settings.cols}, ${ps}px)`;
        box.style.setProperty('--ps', ps + 'px');
        const cls = L.isOhajiki(settings.arrC) ? 'ohj ohj-' + settings.arrC.slice(1) : 'blk blk-' + settings.arrC;
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
    for (const b of $$('.arr-pick')) b.addEventListener('click', () => { settings.arrC = b.dataset.c; saveSettings(); renderArrayPreview(); });

    $('#arrGo').addEventListener('click', () => {
        const S = state.size, { rows, cols } = settings;
        const occ = occupiedCells([]);
        const pr = placeRect();
        let pos = L.findFreeRect(rows, cols, S, occ, pr);
        if (!pos) {
            /* 見えている ところに はいらない ときは、もの の 右に おいて 見える ように する */
            const cb = contentBox() || pr;
            pos = [L.snap(cb.x1, S) + S, L.snap(pr.y0, S) + S];
        }
        ensureVisible({ x0: pos[0] - 8, y0: pos[1] - 8, x1: pos[0] + cols * S + 8, y1: pos[1] + rows * S + 8 }, { l: 8, r: 8, t: 8, b: 70 });
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
        const rowsNeeded = Math.ceil((8 * pitch + S) / S);
        const occ = occupiedCells([]);
        state.dan = { n, c: settings.danC, loops: settings.danLoops, pitch, x: 0, y: 0, rows: [] };
        const pr = placeRect();
        /* 9だん ぶん（× 9 まで）の ばしょを さきに とって おく。見えている ところに なければ、もの の 右に */
        let pos = L.findFreeRect(rowsNeeded, n, S, occ, { x0: pr.x0, y0: pr.y0, x1: pr.x1, y1: Math.max(pr.y1, pr.y0 + (rowsNeeded + 2) * S) });
        if (!pos) {
            const cb = contentBox() || pr;
            pos = [L.snap(cb.x1, S) + S, L.snap(pr.y0, S) + S];
        }
        state.dan.x = pos[0];
        state.dan.y = pos[1];
        const full = danBox(state.dan, 9);
        if (ensureVisible(full, danInset())) toast('9だん ぶん 見える ように 小さく したよ');
        danAdd();
    }
    const danInset = () => ({ l: 8, r: 8, t: state.card ? 90 : 8, b: 118 });
    /** だんの 1〜k だんめ（かこみ・つまみ・かず も ふくめた）はこ */
    function danBox(d, k) {
        const S = state.size;
        return { x0: d.x - 24, y0: d.y - 32, x1: d.x + d.n * S + 44, y1: d.y + (k - 1) * d.pitch + S + 24 };
    }

    function danAdd() {
        const d = state.dan;
        if (!d || d.rows.length >= 9) return;
        const S = state.size, k = d.rows.length, y = d.y + k * d.pitch;
        const color = L.danColor(d.c, k);
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
        ensureVisible(danBox(d, d.rows.length), danInset());
        commit();
        sayDan();
        updateDanBar();
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
        updateDanBar();
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
            setView({ ox: 0, oy: 0, z: 1 });
            const S = state.size;
            const top = Math.max(2 * S, L.snap(110, S));
            if (su.loose) {
                const per = Math.max(3, Math.min(10, Math.floor(W / S) - 2));
                for (let i = 0; i < su.loose; i++) {
                    state.blocks.push({ id: uid('b'), x: S + (i % per) * S, y: top + Math.floor(i / per) * S, c: 'b' });
                }
            } else if (su.array) {
                const [rows, cols] = su.array;
                for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
                    state.blocks.push({ id: uid('b'), x: S + q * S, y: top + r * S, c: 'b' });
                }
            }
            const cb = contentBox();
            if (cb) ensureVisible({ x0: cb.x0 - 8, y0: cb.y0 - 8, x1: cb.x1 + 8, y1: cb.y1 + 8 }, { l: 8, r: 8, t: 90, b: 70 });
        }
        commit();
        updateCard();
        requestRender();
        if (su && su.scene) {
            importAndUse(window.KukuScenes.make(su.scene[0], su.scene[1], W / H), { label: sceneLabel(su.scene[0], su.scene[1]), inPlace: true });
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
    function sceneLabel(kind, n) {
        const k = SC.KINDS.find(x => x.key === kind) || SC.KINDS[0];
        return `${k.name} ${n}${k.unit}`;
    }
    $('#sceneGo').addEventListener('click', () => importAndUse(SC.make(settings.sceneKind, settings.sceneN, W / H), { label: sceneLabel(settings.sceneKind, settings.sceneN) }));

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
        const v = page.view;
        g.setTransform(k * v.z, 0, 0, k * v.z, k * v.ox, k * v.oy);
        drawScene(g, viewRect(), { grid: false, hide: new Set(), live: false, z: v.z });
        g.setTransform(k, 0, 0, k, 0, 0);
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
            a.download = `block-ohajiki-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            closeSheets();
            toast('「ダウンロード」に ほぞんしました');
        }, 'image/png');
    });

    /* ================================================================
       きょうゆう（せんせい → こども）
       ================================================================ */

    const SH = window.KukuShare;

    function imageToDataURL(img, max, q) {
        const [w0, h0] = imgSize(img);
        const k = Math.min(1, max / Math.max(w0, h0));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * k));
        c.height = Math.max(1, Math.round(h0 * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
    }

    /** くばる データ：ページ（つくえ・見かた）と、はいけいの しゃしん（小さく した もの） */
    async function buildPayload(all) {
        commit();
        const out = { app: 'block-ohajiki', v: 1, t: Date.now(), pages: [], images: {} };
        for (const p of (all ? pages : [page])) {
            const st = JSON.parse(p.saved);
            st.dan = null;
            if (st.bg && !out.images[st.bg.id]) {
                const img = await P.load(st.bg.id);
                if (img) out.images[st.bg.id] = imageToDataURL(img, 1600, 0.82);
            }
            if (st.bg && !out.images[st.bg.id]) st.bg = null;
            out.pages.push({ s: st, v: p.view });
        }
        return out;
    }

    /** くばられた データを あたらしい タブに する。いくつ よみこんだか を かえす */
    async function applyPayload(pl) {
        if (!pl || pl.app !== 'block-ohajiki' || !Array.isArray(pl.pages)) throw new Error('ブロック おはじき の データでは ありません');
        const idMap = new Map();
        for (const [oid, url] of Object.entries(pl.images || {})) {
            if (typeof url !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(url)) continue;
            try {
                const blob = await (await fetch(url)).blob();
                const { id } = await P.importSource(blob);
                idMap.set(oid, id);
            } catch (e) { /* この しゃしんは とばす */ }
        }
        commit();
        cancelDrags();
        const replaceBlank = pages.length === 1 && isEmptyState(state);
        const first = replaceBlank ? 0 : pages.length;
        let added = 0;
        for (const item of pl.pages) {
            const st = L.sanitizeState(item && item.s, emptyState());
            if (!st) continue;
            if (st.bg) {
                const nid = idMap.get(st.bg.id);
                if (nid) st.bg.id = nid; else st.bg = null;
            }
            const pg = newPage(st, item.v);
            if (replaceBlank && added === 0) pages[0] = pg;
            else if (pages.length < MAX_PAGES) pages.push(pg);
            else { toast(`ページは ${MAX_PAGES}まい までなので、のこりは よみこめませんでした`, 4000); break; }
            added++;
        }
        if (!added) throw new Error('よみこめる ページが ありませんでした');
        curIdx = first;
        page = pages[curIdx];
        state = JSON.parse(page.saved);
        persistNow();
        afterPageChange();
        await refreshThumbs();
        scrollTabIntoView();
        return added;
    }

    $('#btnShare').addEventListener('click', () => {
        $('#shareOut').hidden = true;
        $('#sharePages').textContent = pages.length;
        openSheet('shareSheet');
    });

    let sharing = false;
    async function doShare(all) {
        if (sharing) return;
        sharing = true;
        toast('くばる じゅんびを しています…', 60000);
        try {
            const pl = await buildPayload(all);
            const json = JSON.stringify(pl);
            if (json.length > 8500000) {
                throw new Error('しゃしんが おおくて おくれません。「いまの ページだけ」か「ファイルに ほぞん」を つかってください');
            }
            const code = await SH.upload(json);
            $('#shareCode').textContent = code.slice(0, 3) + ' ' + code.slice(3);
            const link = location.href.split('#')[0].split('?')[0] + '?code=' + code;
            $('#shareLink').value = link;
            $('#shareLinkRow').hidden = location.protocol === 'file:';
            $('#shareOut').hidden = false;
            toast(`コード ${code} が できました`);
        } catch (e) {
            toast((e && e.message) || 'くばれませんでした', 6000);
        } finally {
            sharing = false;
        }
    }
    $('#shareAll').addEventListener('click', () => doShare(true));
    $('#shareOne').addEventListener('click', () => doShare(false));
    $('#shareCopy').addEventListener('click', async () => {
        const inp = $('#shareLink');
        try { await navigator.clipboard.writeText(inp.value); toast('リンクを コピーしました'); }
        catch (e) { inp.select(); document.execCommand('copy'); toast('リンクを コピーしました'); }
    });

    async function loadCode(raw) {
        const code = String(raw || '').replace(/\D/g, '');
        if (!SH.isCode(code)) { toast('6けたの コードを いれてね'); return; }
        toast('よみこみちゅう…', 60000);
        try {
            const data = await SH.download(code);
            if (!data) { toast('その コードは みつかりません'); return; }
            const n = await applyPayload(JSON.parse(data));
            closeSheets();
            toast(`せんせいの ページを ${n}まい よみこみました`);
        } catch (e) {
            toast((e && e.message) || 'よみこめませんでした', 6000);
        }
    }
    $('#codeGo').addEventListener('click', () => loadCode($('#codeIn').value));
    $('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) loadCode($('#codeIn').value); });

    /* ファイルで やりとり */
    $('#fileSave').addEventListener('click', async () => {
        const pl = await buildPayload(true);
        const blob = new Blob([JSON.stringify(pl)], { type: 'application/json' });
        const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `block-ohajiki-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast('「ダウンロード」に ほぞんしました（Google ドライブ などで くばれます）', 4000);
    });
    const shareFile = $('#shareFile');
    $('#fileLoad').addEventListener('click', () => shareFile.click());
    shareFile.addEventListener('change', () => {
        const f = shareFile.files && shareFile.files[0];
        shareFile.value = '';
        if (f) loadShareFile(f);
    });
    async function loadShareFile(f) {
        toast('よみこみちゅう…', 60000);
        try {
            const n = await applyPayload(JSON.parse(await f.text()));
            closeSheets();
            toast(`${n}ページ よみこみました`);
        } catch (e) {
            toast((e && e.message && !/JSON/.test(e.message)) ? e.message : 'この ファイルは よみこめません', 5000);
        }
    }

    /* ?code=123456 つきの リンクで ひらいた とき */
    function checkCodeInUrl() {
        let code = null;
        try { code = new URLSearchParams(location.search).get('code'); } catch (e) { /* なし */ }
        if (!code || !SH.isCode(code)) return;
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* のこっても よい */ }
        $('#codeSheetCode').textContent = `コード ${code}`;
        openSheet('codeSheet');
        $('#codeYes').onclick = () => { closeSheets(); loadCode(code); };
    }

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
    updateZoomUI();
    setTool('move');
    updateCard();
    syncBg();
    renderTabs();
    refreshThumbs();
    scrollTabIntoView();
    checkCodeInUrl();
    if (document.fonts) document.fonts.ready.then(requestRender);

    /* たしかめ用（テストから よぶ） */
    window.KukuApp = {
        get state() { return state; },
        get view() { return page.view; },
        get pages() { return pages; },
        get cur() { return curIdx; },
        settings, commit, undo, redo, setTool, importAndUse, switchPage, addPage,
    };
})();
