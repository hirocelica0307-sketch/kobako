/* ブロック おはじき ── イラストの はいけい
   ------------------------------------------------------------------
   おさら・ふくろ・のりもの など 18しゅるいを、えらんだ かずだけ ならべた 絵を
   canvas に かきます（がぞうファイルは つかいません。どれも この アプリの ための オリジナルの 絵です）。
   1だんに 4つ まで。5つ いじょうは 2だん・3だんに なります。
   教科書（啓林館 2年 かけ算）で よく 出る「ゆうえんちの のりもの（○人ずつ）」
   「あめの ふくろ」「いちごの パック」「だんご」などの ばめんを えらんで います。
   できた canvas は しゃしんと おなじ ように はいけいに なります。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const KINDS = [
        { key: 'plate', name: 'おさら', unit: 'まい', group: 'いれもの・たべもの' },
        { key: 'bag', name: 'ふくろ', unit: 'ふくろ', group: 'いれもの・たべもの' },
        { key: 'box', name: 'はこ', unit: 'はこ', group: 'いれもの・たべもの' },
        { key: 'basket', name: 'かご', unit: 'こ', group: 'いれもの・たべもの' },
        { key: 'pack', name: 'パック', unit: 'パック', group: 'いれもの・たべもの' },
        { key: 'dango', name: 'だんご', unit: 'ほん', group: 'いれもの・たべもの' },
        { key: 'fishbowl', name: 'きんぎょばち', unit: 'こ', group: 'いれもの・たべもの' },
        { key: 'vase', name: 'かびん', unit: 'こ', group: 'いれもの・たべもの' },
        { key: 'tree', name: 'りんごの き', unit: 'ほん', group: 'いれもの・たべもの' },
        { key: 'table', name: 'テーブル', unit: 'だい', group: 'いれもの・たべもの' },
        { key: 'coaster', name: 'ジェットコースター', unit: 'だい', group: 'のりもの・ゆうえんち' },
        { key: 'cup', name: 'コーヒーカップ', unit: 'こ', group: 'のりもの・ゆうえんち' },
        { key: 'gondola', name: 'かんらんしゃ', unit: 'こ', group: 'のりもの・ゆうえんち' },
        { key: 'boat', name: 'ボート', unit: 'そう', group: 'のりもの・ゆうえんち' },
        { key: 'bench', name: 'ながいす', unit: 'つ', group: 'のりもの・ゆうえんち' },
        { key: 'car', name: 'くるま', unit: 'だい', group: 'のりもの・ゆうえんち' },
        { key: 'bus', name: 'バス', unit: 'だい', group: 'のりもの・ゆうえんち' },
        { key: 'train', name: 'でんしゃ', unit: 'りょう', group: 'のりもの・ゆうえんち' },
    ];
    const PALETTE = ['#f2a33a', '#5aa9e6', '#7bc96f', '#e87a9a', '#b28ddb', '#f2d03a', '#4fc1c9', '#f07a52', '#8fbf4d'];
    const pick = (i) => PALETTE[i % PALETTE.length];

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

    /* ---------- いれもの・たべもの ---------- */

    /** あめなどが はいる とうめいな ふくろ（くちを リボンで しばって いる） */
    function bag(g, cx, cy, w, h, i) {
        const bw = Math.min(w * 0.7, h * 0.72), bh = Math.min(h * 0.95, bw * 1.25);
        const x0 = cx - bw / 2, y0 = cy - bh * 0.45, y1 = cy + bh * 0.55;
        g.beginPath();
        g.moveTo(cx - bw * 0.16, y0 + bh * 0.12);
        g.bezierCurveTo(x0 - bw * 0.06, y0 + bh * 0.3, x0 - bw * 0.02, y1 - bh * 0.05, x0 + bw * 0.1, y1);
        g.lineTo(x0 + bw * 0.9, y1);
        g.bezierCurveTo(x0 + bw * 1.02, y1 - bh * 0.05, x0 + bw * 1.06, y0 + bh * 0.3, cx + bw * 0.16, y0 + bh * 0.12);
        g.closePath();
        g.fillStyle = 'rgba(190,225,255,.35)';
        g.fill();
        g.lineWidth = Math.max(3, bw * 0.02);
        g.strokeStyle = '#8fb3d9';
        g.stroke();
        /* しばった ところ と リボン */
        g.beginPath();
        g.moveTo(cx - bw * 0.16, y0 + bh * 0.12);
        g.lineTo(cx - bw * 0.2, y0);
        g.lineTo(cx + bw * 0.2, y0);
        g.lineTo(cx + bw * 0.16, y0 + bh * 0.12);
        g.fillStyle = 'rgba(190,225,255,.45)';
        g.fill();
        g.stroke();
        const rc = pick(i + 3);
        g.fillStyle = rc;
        rr(g, cx - bw * 0.19, y0 + bh * 0.08, bw * 0.38, bh * 0.05, 4);
        g.fill();
        for (const sgn of [-1, 1]) {
            g.beginPath();
            g.ellipse(cx + sgn * bw * 0.12, y0 + bh * 0.07, bw * 0.1, bh * 0.045, sgn * 0.5, 0, Math.PI * 2);
            g.fill();
        }
        /* つや */
        g.strokeStyle = 'rgba(255,255,255,.8)';
        g.lineWidth = Math.max(3, bw * 0.03);
        g.beginPath();
        g.moveTo(x0 + bw * 0.12, y0 + bh * 0.4);
        g.quadraticCurveTo(x0 + bw * 0.08, y0 + bh * 0.62, x0 + bw * 0.14, y1 - bh * 0.12);
        g.stroke();
    }

    /** あみの かご（とって つき） */
    function basket(g, cx, cy, w, h) {
        const bw = Math.min(w * 0.9, h * 1.5), bh = bw * 0.42;
        const x0 = cx - bw / 2, y0 = cy - bh * 0.1;
        g.lineWidth = Math.max(6, bw * 0.035);
        g.strokeStyle = '#a8743f';
        g.beginPath();
        g.ellipse(cx, y0, bw * 0.38, bh * 1.2, 0, Math.PI, 0);
        g.stroke();
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + bw, y0);
        g.lineTo(x0 + bw * 0.88, y0 + bh);
        g.lineTo(x0 + bw * 0.12, y0 + bh);
        g.closePath();
        g.fillStyle = '#e0ac6e';
        g.fill();
        g.lineWidth = Math.max(3, bw * 0.012);
        g.strokeStyle = '#a8743f';
        g.stroke();
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(140,90,40,.45)';
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0, y0 + bh * k / 4); g.lineTo(x0 + bw, y0 + bh * k / 4); g.stroke(); }
        for (let k = 1; k < 10; k++) { g.beginPath(); g.moveTo(x0 + bw * k / 10, y0); g.lineTo(x0 + bw * (0.12 + 0.76 * k / 10), y0 + bh); g.stroke(); }
        g.restore();
        rr(g, x0 - bw * 0.02, y0 - bh * 0.08, bw * 1.04, bh * 0.16, bh * 0.08);
        g.fillStyle = '#c48d52';
        g.fill();
    }

    /** いちごの パック（とうめいで ふちが ある） */
    function pack(g, cx, cy, w, h) {
        const pw = Math.min(w * 0.88, h * 1.5), ph = pw * 0.55;
        const x = cx - pw / 2, y = cy - ph / 2;
        rr(g, x, y, pw, ph, ph * 0.12);
        g.fillStyle = 'rgba(210,240,215,.55)';
        g.fill();
        g.lineWidth = Math.max(4, pw * 0.02);
        g.strokeStyle = '#8cc79a';
        g.stroke();
        rr(g, x + pw * 0.06, y + ph * 0.1, pw * 0.88, ph * 0.8, ph * 0.08);
        g.lineWidth = Math.max(2, pw * 0.008);
        g.strokeStyle = 'rgba(120,180,135,.7)';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)';
        g.fillRect(x + pw * 0.08, y + ph * 0.14, pw * 0.05, ph * 0.72);
    }

    /** だんごの くし（ブロックを だんごに して ならべる） */
    function dango(g, cx, cy, w, h) {
        const len = Math.min(w * 0.95, h * 1.8);
        const x0 = cx - len / 2, x1 = cx + len / 2;
        g.lineCap = 'round';
        g.lineWidth = Math.max(8, len * 0.03);
        g.strokeStyle = '#d8b27a';
        g.beginPath();
        g.moveTo(x0, cy);
        g.lineTo(x1, cy);
        g.stroke();
        g.lineWidth = Math.max(2, len * 0.006);
        g.strokeStyle = '#b8894c';
        g.stroke();
        g.lineCap = 'butt';
        /* もつ ところ の しるし */
        g.fillStyle = '#b8894c';
        g.beginPath();
        g.arc(x1, cy, Math.max(5, len * 0.018), 0, Math.PI * 2);
        g.fill();
    }

    /** きんぎょばち（水が はいって いる） */
    function fishbowl(g, cx, cy, w, h) {
        const r = Math.min(w * 0.42, h * 0.48);
        g.save();
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = 'rgba(210,235,255,.5)';
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
        g.fillStyle = 'rgba(120,190,240,.45)';
        g.fillRect(cx - r, cy - r * 0.35, r * 2, r * 2);
        g.restore();
        g.beginPath();
        g.arc(cx, cy, r, -Math.PI * 0.32, Math.PI * 1.32);
        g.lineWidth = Math.max(4, r * 0.04);
        g.strokeStyle = '#7fa9cc';
        g.stroke();
        g.beginPath();
        g.ellipse(cx, cy - r * 0.84, r * 0.56, r * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.85)';
        g.beginPath();
        g.arc(cx, cy, r * 0.8, Math.PI * 1.05, Math.PI * 1.3);
        g.lineWidth = Math.max(4, r * 0.05);
        g.stroke();
        rr(g, cx - r * 0.5, cy + r * 0.9, r, r * 0.14, r * 0.05);
        g.fillStyle = '#9fc3e0';
        g.fill();
    }

    /** かびん（上に 花を さす） */
    function vase(g, cx, cy, w, h, i) {
        const vh = Math.min(h * 0.55, w * 0.7), vw = vh * 0.62;
        const top = cy + h * 0.45 - vh;
        g.lineWidth = Math.max(4, vw * 0.05);
        g.strokeStyle = '#5ea35a';
        g.lineCap = 'round';
        for (const [dx, hh] of [[-0.35, 0.55], [0, 0.7], [0.35, 0.55]]) {
            g.beginPath();
            g.moveTo(cx, top + vh * 0.1);
            g.quadraticCurveTo(cx + dx * vw * 0.5, top - vh * hh * 0.5, cx + dx * vw * 1.4, top - vh * hh);
            g.stroke();
        }
        g.lineCap = 'butt';
        g.beginPath();
        g.moveTo(cx - vw * 0.22, top);
        g.bezierCurveTo(cx - vw * 0.2, top + vh * 0.2, cx - vw * 0.62, top + vh * 0.35, cx - vw * 0.5, top + vh * 0.75);
        g.quadraticCurveTo(cx - vw * 0.42, top + vh, cx, top + vh);
        g.quadraticCurveTo(cx + vw * 0.42, top + vh, cx + vw * 0.5, top + vh * 0.75);
        g.bezierCurveTo(cx + vw * 0.62, top + vh * 0.35, cx + vw * 0.2, top + vh * 0.2, cx + vw * 0.22, top);
        g.closePath();
        g.fillStyle = pick(i + 1);
        g.fill();
        g.lineWidth = Math.max(3, vw * 0.03);
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
    }

    /** りんごの き（はっぱの 上に りんごを おく） */
    function tree(g, cx, cy, w, h) {
        const r = Math.min(w * 0.4, h * 0.36);
        const tw = r * 0.3;
        g.fillStyle = '#9a6a3c';
        rr(g, cx - tw / 2, cy, tw, h * 0.48, tw * 0.2);
        g.fill();
        g.fillStyle = '#7cc46a';
        for (const [dx, dy, k] of [[0, -0.45, 0.75], [-0.55, -0.05, 0.6], [0.55, -0.05, 0.6], [-0.25, 0.25, 0.55], [0.25, 0.25, 0.55]]) {
            g.beginPath();
            g.arc(cx + dx * r, cy - r * 0.2 + dy * r, r * k, 0, Math.PI * 2);
            g.fill();
        }
        g.strokeStyle = 'rgba(60,120,50,.35)';
        g.lineWidth = Math.max(3, r * 0.03);
        g.beginPath();
        g.arc(cx, cy - r * 0.35, r * 0.95, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
    }

    /** テーブル（上に ものを おく） */
    function table(g, cx, cy, w, h) {
        const tw = Math.min(w * 0.92, h * 1.6), th = tw * 0.36;
        const x = cx - tw / 2, y = cy - th / 2;
        g.fillStyle = '#9a6a3c';
        const leg = Math.max(8, tw * 0.04);
        for (const lx of [x + tw * 0.08, x + tw * 0.92 - leg]) g.fillRect(lx, y + th * 0.8, leg, th * 0.9);
        g.beginPath();
        g.moveTo(x + tw * 0.08, y);
        g.lineTo(x + tw * 0.92, y);
        g.lineTo(x + tw, y + th * 0.85);
        g.lineTo(x, y + th * 0.85);
        g.closePath();
        g.fillStyle = '#e6b77f';
        g.fill();
        g.lineWidth = Math.max(3, tw * 0.01);
        g.strokeStyle = '#a8743f';
        g.stroke();
        g.fillStyle = '#c48d52';
        g.fillRect(x, y + th * 0.85, tw, th * 0.12);
    }

    /* ---------- のりもの・ゆうえんち ---------- */

    /** ジェットコースターの 1だい（2人がけ の せき） */
    function coaster(g, cx, cy, w, h, i) {
        const cw = Math.min(w * 0.92, h * 1.7), ch = cw * 0.34;
        const x = cx - cw / 2, y = cy - ch * 0.3;
        const col = pick(i);
        g.strokeStyle = '#8a8f99';
        g.lineWidth = Math.max(4, cw * 0.015);
        g.beginPath();
        g.moveTo(x - cw * 0.05, y + ch + ch * 0.28);
        g.lineTo(x + cw * 1.05, y + ch + ch * 0.28);
        g.stroke();
        /* 2人ぶんの せもたれ（ひくくて まるい） */
        for (const bx of [0.26, 0.6]) {
            rr(g, x + cw * bx, y - ch * 0.42, cw * 0.17, ch * 0.62, cw * 0.06);
            g.fillStyle = '#5b5f6b';
            g.fill();
            g.fillStyle = 'rgba(255,255,255,.18)';
            g.fillRect(x + cw * (bx + 0.03), y - ch * 0.32, cw * 0.11, ch * 0.08);
        }
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x, y + ch * 0.1);
        g.lineTo(x + cw * 0.14, y - ch * 0.2);
        g.lineTo(x + cw, y - ch * 0.05);
        g.lineTo(x + cw, y + ch);
        g.lineTo(x + cw * 0.05, y + ch);
        g.closePath();
        g.fill();
        g.lineWidth = Math.max(3, cw * 0.01);
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(x + cw * 0.15, y + ch * 0.35, cw * 0.8, ch * 0.12);
        for (const wx of [x + cw * 0.2, x + cw * 0.82]) {
            g.beginPath();
            g.arc(wx, y + ch + ch * 0.1, ch * 0.18, 0, Math.PI * 2);
            g.fillStyle = '#3a3a3a';
            g.fill();
        }
    }

    /** コーヒーカップ（ゆうえんちの のりもの） */
    function cup(g, cx, cy, w, h, i) {
        const cw = Math.min(w * 0.82, h * 1.1), ch = cw * 0.62;
        const col = pick(i + 2);
        g.beginPath();
        g.ellipse(cx, cy + ch * 0.55, cw * 0.62, ch * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = '#e8e2d6';
        g.fill();
        g.lineWidth = Math.max(3, cw * 0.012);
        g.strokeStyle = '#b9ae9c';
        g.stroke();
        g.lineWidth = Math.max(8, cw * 0.05);
        g.strokeStyle = col;
        g.beginPath();
        g.arc(cx + cw * 0.5, cy + ch * 0.05, ch * 0.22, -Math.PI * 0.5, Math.PI * 0.5);
        g.stroke();
        g.beginPath();
        g.moveTo(cx - cw * 0.5, cy - ch * 0.35);
        g.quadraticCurveTo(cx - cw * 0.46, cy + ch * 0.52, cx, cy + ch * 0.52);
        g.quadraticCurveTo(cx + cw * 0.46, cy + ch * 0.52, cx + cw * 0.5, cy - ch * 0.35);
        g.closePath();
        g.fillStyle = col;
        g.fill();
        g.beginPath();
        g.ellipse(cx, cy - ch * 0.35, cw * 0.5, ch * 0.13, 0, 0, Math.PI * 2);
        g.fillStyle = '#fff7ee';
        g.fill();
        g.lineWidth = Math.max(3, cw * 0.012);
        g.strokeStyle = 'rgba(0,0,0,.2)';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)';
        for (const [dx, dy] of [[-0.3, 0], [0, 0.18], [0.3, 0], [-0.15, 0.32], [0.15, 0.32]]) {
            g.beginPath();
            g.arc(cx + dx * cw, cy + dy * ch, cw * 0.035, 0, Math.PI * 2);
            g.fill();
        }
    }

    /** かんらんしゃの ゴンドラ（上の ぼうから つりさがる） */
    function gondola(g, cx, cy, w, h, i) {
        const gw = Math.min(w * 0.62, h * 0.72), gh = gw * 0.9;
        const col = pick(i + 4);
        g.strokeStyle = '#8a8f99';
        g.lineWidth = Math.max(4, gw * 0.03);
        g.beginPath();
        g.moveTo(cx, cy - gh * 0.72);
        g.lineTo(cx, cy - gh * 0.45);
        g.stroke();
        g.beginPath();
        g.arc(cx, cy - gh * 0.75, gw * 0.05, 0, Math.PI * 2);
        g.fillStyle = '#8a8f99';
        g.fill();
        g.beginPath();
        g.ellipse(cx, cy - gh * 0.42, gw * 0.46, gh * 0.12, 0, Math.PI, 0);
        g.fillStyle = col;
        g.fill();
        rr(g, cx - gw / 2, cy - gh * 0.42, gw, gh * 0.9, gw * 0.2);
        g.fillStyle = col;
        g.fill();
        rr(g, cx - gw * 0.4, cy - gh * 0.3, gw * 0.8, gh * 0.45, gw * 0.1);
        g.fillStyle = '#e2f2ff';
        g.fill();
        g.lineWidth = Math.max(3, gw * 0.015);
        g.strokeStyle = 'rgba(0,0,0,.2)';
        g.stroke();
    }

    /** ボート（水の 上） */
    function boat(g, cx, cy, w, h) {
        const bw = Math.min(w * 0.9, h * 1.7), bh = bw * 0.26;
        const x = cx - bw / 2, y = cy - bh * 0.2;
        g.strokeStyle = '#7fb8e6';
        g.lineWidth = Math.max(4, bw * 0.012);
        for (let k = 0; k < 2; k++) {
            g.beginPath();
            for (let t = 0; t <= 8; t++) {
                const px = x - bw * 0.05 + (bw * 1.1) * t / 8, py = y + bh * (1.15 + k * 0.28) + Math.sin(t * Math.PI / 2) * bh * 0.08;
                if (t === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.stroke();
        }
        g.beginPath();
        g.moveTo(x - bw * 0.04, y);
        g.lineTo(x + bw * 1.04, y);
        g.quadraticCurveTo(x + bw * 0.95, y + bh, x + bw * 0.8, y + bh);
        g.lineTo(x + bw * 0.2, y + bh);
        g.quadraticCurveTo(x + bw * 0.05, y + bh, x - bw * 0.04, y);
        g.closePath();
        g.fillStyle = '#c98b4f';
        g.fill();
        g.lineWidth = Math.max(3, bw * 0.01);
        g.strokeStyle = '#8a5a2f';
        g.stroke();
        g.fillStyle = '#e8b27a';
        g.fillRect(x + bw * 0.02, y - bh * 0.06, bw * 0.96, bh * 0.14);
    }

    /** バス（まどが ならぶ） */
    function bus(g, cx, cy, w, h, i) {
        const bw = Math.min(w * 0.94, h * 1.8), bh = bw * 0.4;
        const x = cx - bw / 2, y = cy - bh * 0.5;
        rr(g, x, y, bw, bh, bh * 0.16);
        g.fillStyle = pick(i + 5);
        g.fill();
        g.lineWidth = Math.max(3, bw * 0.008);
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
        g.fillStyle = '#e2f2ff';
        for (let k = 0; k < 4; k++) { rr(g, x + bw * (0.05 + k * 0.2), y + bh * 0.14, bw * 0.16, bh * 0.36, 6); g.fill(); }
        rr(g, x + bw * 0.86, y + bh * 0.14, bw * 0.1, bh * 0.56, 6);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.fillRect(x, y + bh * 0.6, bw * 0.84, bh * 0.08);
        for (const wx of [x + bw * 0.18, x + bw * 0.78]) {
            g.beginPath();
            g.arc(wx, y + bh, bh * 0.17, 0, Math.PI * 2);
            g.fillStyle = '#3a3a3a';
            g.fill();
            g.beginPath();
            g.arc(wx, y + bh, bh * 0.07, 0, Math.PI * 2);
            g.fillStyle = '#bbb';
            g.fill();
        }
    }

    /** でんしゃの 1りょう */
    function train(g, cx, cy, w, h, i) {
        const tw = Math.min(w * 0.96, h * 1.9), th = tw * 0.36;
        const x = cx - tw / 2, y = cy - th * 0.5;
        g.strokeStyle = '#8a8f99';
        g.lineWidth = Math.max(4, tw * 0.012);
        g.beginPath();
        g.moveTo(x - tw * 0.03, y + th * 1.16);
        g.lineTo(x + tw * 1.03, y + th * 1.16);
        g.stroke();
        rr(g, x, y, tw, th, th * 0.12);
        g.fillStyle = '#f3f3ef';
        g.fill();
        g.lineWidth = Math.max(3, tw * 0.008);
        g.strokeStyle = 'rgba(0,0,0,.3)';
        g.stroke();
        g.fillStyle = pick(i + 1);
        g.fillRect(x, y + th * 0.62, tw, th * 0.12);
        g.fillStyle = '#cfe6f7';
        for (let k = 0; k < 5; k++) { rr(g, x + tw * (0.04 + k * 0.19), y + th * 0.14, tw * 0.15, th * 0.38, 5); g.fill(); }
        g.fillStyle = '#555';
        for (const wx of [0.15, 0.27, 0.73, 0.85]) {
            g.beginPath();
            g.arc(x + tw * wx, y + th * 1.02, th * 0.1, 0, Math.PI * 2);
            g.fill();
        }
    }

    const DRAW = { plate, bench, car, box, bag, basket, pack, dango, fishbowl, vase, tree, table, coaster, cup, gondola, boat, bus, train };

    /** n こを box（x0,y0,x1,y1）の 中に 1だん 4つ まで ならべた ときの 1こずつの まん中と 大きさ */
    function layout(n, box) {
        const W = box.x1 - box.x0, H = box.y1 - box.y0;
        const cols = Math.max(1, Math.min(n, 4));
        const rows = Math.max(1, Math.ceil(n / cols));
        const padX = W * 0.04, padY = H * 0.06;
        const cellW = (W - padX * 2) / cols, cellH = (H - padY * 2) / rows;
        const iw = Math.min(cellW * 0.86, cellH * 1.5), ih = Math.min(cellH * 0.8, iw);
        const out = [];
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / cols), col = i % cols;
            const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols;
            const offset = (cols - inRow) * cellW / 2;
            out.push({ x: box.x0 + padX + offset + cellW * (col + 0.5), y: box.y0 + padY + cellH * (r + 0.55), w: iw, h: ih });
        }
        return out;
    }

    /** 1こ かく。(cx, cy) が まん中、w × h の 中に おさまる。i … いろの ばんごう */
    function drawItem(g, kind, cx, cy, w, h, i) {
        g.save();
        (DRAW[kind] || plate)(g, cx, cy, w, h, i || 0);
        g.restore();
    }

    /** kind の 絵を n こ ならべた canvas（1だんに 4つ まで）。よこたて比は つくえに あわせる。W … よこの 大きさ */
    function make(kind, n, aspect, Wopt) {
        const W = Wopt || 1600, H = Math.round(W / Math.max(0.8, Math.min(2.6, aspect || 1.8)));
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#fffdf8';
        g.fillRect(0, 0, W, H);
        layout(n, { x0: 0, y0: 0, x1: W, y1: H }).forEach((it, i) => drawItem(g, kind, it.x, it.y, it.w, it.h, i));
        return c;
    }

    root.KukuScenes = { KINDS, make, layout, drawItem, has: (k) => !!DRAW[k] };
})(window);
