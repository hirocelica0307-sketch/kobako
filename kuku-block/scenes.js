/* くく ブロック ── イラストの はいけい
   ------------------------------------------------------------------
   おさら・ながいす・くるま・はこ を、えらんだ かずだけ ならべた 絵を
   canvas に かきます（がぞうファイルは つかいません）。
   できた canvas は しゃしんと おなじ ように はいけいに なります。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const KINDS = [
        { key: 'plate', name: 'おさら', unit: 'まい' },
        { key: 'bench', name: 'ながいす', unit: 'つ' },
        { key: 'car', name: 'くるま', unit: 'だい' },
        { key: 'box', name: 'はこ', unit: 'はこ' },
    ];

    const CAR_COLORS = ['#f2a33a', '#5aa9e6', '#7bc96f', '#e87a9a', '#b28ddb', '#f2d03a'];

    function rr(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function plate(g, cx, cy, w, h) {
        const rx = w / 2, ry = Math.min(h / 2, w * 0.32);
        g.beginPath();
        g.ellipse(cx, cy + ry * 0.08, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(120,90,60,.12)';
        g.fill();
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
        g.lineWidth = Math.max(4, w * 0.02);
        g.strokeStyle = '#d4b3a2';
        g.stroke();
        g.beginPath();
        g.ellipse(cx, cy, rx * 0.72, ry * 0.68, 0, 0, Math.PI * 2);
        g.lineWidth = Math.max(2, w * 0.008);
        g.strokeStyle = '#eadbd2';
        g.stroke();
    }

    function bench(g, cx, cy, w, h) {
        const bw = w, sh = Math.min(h * 0.22, w * 0.14);
        const x = cx - bw / 2, seatY = cy;
        g.fillStyle = '#8a5a2f';
        const leg = Math.max(8, bw * 0.04);
        for (const lx of [x + bw * 0.08, x + bw * 0.92 - leg]) g.fillRect(lx, seatY, leg, h * 0.32);
        rr(g, x + bw * 0.03, seatY - sh * 2.6, bw * 0.94, sh * 0.9, sh * 0.3);
        g.fillStyle = '#c98b4f';
        g.fill();
        g.fillStyle = '#8a5a2f';
        for (const lx of [x + bw * 0.12, x + bw * 0.88 - leg * 0.8]) g.fillRect(lx, seatY - sh * 1.8, leg * 0.8, sh * 1.9);
        rr(g, x, seatY - sh * 0.1, bw, sh, sh * 0.3);
        g.fillStyle = '#d99a5b';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#8a5a2f';
        g.stroke();
    }

    function car(g, cx, cy, w, h, i) {
        const cw = w, ch = Math.min(h * 0.45, w * 0.36);
        const x = cx - cw / 2, y = cy - ch * 0.2;
        const col = CAR_COLORS[i % CAR_COLORS.length];
        g.beginPath();
        g.moveTo(x + cw * 0.2, y);
        g.lineTo(x + cw * 0.3, y - ch * 0.62);
        g.lineTo(x + cw * 0.72, y - ch * 0.62);
        g.lineTo(x + cw * 0.84, y);
        g.closePath();
        g.fillStyle = col;
        g.fill();
        g.fillStyle = '#dff1ff';
        rr(g, x + cw * 0.31, y - ch * 0.52, cw * 0.18, ch * 0.44, 6); g.fill();
        rr(g, x + cw * 0.53, y - ch * 0.52, cw * 0.19, ch * 0.44, 6); g.fill();
        rr(g, x, y, cw, ch * 0.62, ch * 0.2);
        g.fillStyle = col;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
        for (const wx of [x + cw * 0.22, x + cw * 0.78]) {
            g.beginPath();
            g.arc(wx, y + ch * 0.62, ch * 0.2, 0, Math.PI * 2);
            g.fillStyle = '#3a3a3a';
            g.fill();
            g.beginPath();
            g.arc(wx, y + ch * 0.62, ch * 0.08, 0, Math.PI * 2);
            g.fillStyle = '#bbb';
            g.fill();
        }
    }

    function box(g, cx, cy, w, h) {
        const bw = w * 0.82, bh = Math.min(h * 0.62, bw * 0.62);
        const x = cx - bw / 2, y = cy - bh * 0.35;
        g.fillStyle = '#c48d52';
        g.beginPath();
        g.moveTo(x, y); g.lineTo(x - bw * 0.08, y - bh * 0.25); g.lineTo(x + bw * 0.36, y - bh * 0.25); g.lineTo(x + bw * 0.45, y);
        g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(x + bw, y); g.lineTo(x + bw * 1.08, y - bh * 0.25); g.lineTo(x + bw * 0.64, y - bh * 0.25); g.lineTo(x + bw * 0.55, y);
        g.closePath(); g.fill();
        rr(g, x, y, bw, bh, 8);
        g.fillStyle = '#e0ac6e';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#a8743f';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(x + bw * 0.42, y, bw * 0.16, bh);
    }

    const DRAW = { plate, bench, car, box };

    /** kind の 絵を n こ ならべた canvas。w × h は つくえと おなじ よこたて比 に する */
    function make(kind, n, aspect) {
        const W = 1600, H = Math.round(W / Math.max(0.8, Math.min(2.6, aspect || 1.8)));
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#fffdf8';
        g.fillRect(0, 0, W, H);
        const cols = n <= 5 ? n : Math.ceil(n / 2);
        const rows = Math.ceil(n / cols);
        const padX = W * 0.04, padY = H * 0.08;
        const cellW = (W - padX * 2) / cols, cellH = (H - padY * 2) / rows;
        const iw = Math.min(cellW * 0.86, cellH * 1.5), ih = Math.min(cellH * 0.8, iw);
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / cols), col = i % cols;
            const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
            const offset = (cols - inRow) * cellW / 2;
            const cx = padX + offset + cellW * (col + 0.5), cy = padY + cellH * (r + 0.55);
            DRAW[kind](g, cx, cy, iw, ih, i);
        }
        return c;
    }

    root.KukuScenes = { KINDS, make };
})(window);
