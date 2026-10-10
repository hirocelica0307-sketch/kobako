/* 札の 絵（SVG を その場で えがく）
   ------------------------------------------------------------------
   がぞうファイルは つかわず、48枚 ぜんぶを ここで えがきます。
   むかしからの 花札の 図がら（松に鶴・桜に幕・芒に月 など）を
   かんたんな 形に して えがいています。
   座標は よこ 100 × たて 160（花札の たて よこの わりあい）。
   ------------------------------------------------------------------ */
import { CARDS } from './cards.js';

const W = 100, H = 160;
const C = {
    paper: '#f7f1e3', edge: '#efe4cc', ink: '#1b1a17', red: '#c9282d', deepRed: '#8e1b1f',
    pine: '#22713f', pineDark: '#11472a', bark: '#5b3a24', plum: '#d3283a', sakura: '#f3a7bd',
    sakuraDark: '#d9708f', fuji: '#7b58b8', fujiLight: '#a98ae0', iris: '#3d4fb8', leaf: '#2f7d3b',
    leafDark: '#1d5a2a', botan: '#d52f58', hagi: '#b8433a', gold: '#e3b234', blue: '#2b3f9e',
    momiji: '#d2451e', yanagi: '#6aa03c', kiri: '#6b5aa0', sky: '#c9282d'
};

let uid = 0;

/* ── 小さな 部品 ──────────────────────────────── */

const g = (inner, t = '') => `<g${t ? ` transform="${t}"` : ''}>${inner}</g>`;
const circ = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const ell = (cx, cy, rx, ry, fill, rot = 0, extra = '') =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (d, stroke, w, extra = '') =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

/** 5まいの 花びらの 花 */
function flower5(cx, cy, r, fill, center = '#f7e27a', notch = false, rot = 0) {
    let s = '';
    for (let i = 0; i < 5; i++) {
        const a = (rot + i * 72 - 90) * Math.PI / 180;
        const px = cx + Math.cos(a) * r * 0.52, py = cy + Math.sin(a) * r * 0.52;
        s += ell(px.toFixed(2), py.toFixed(2), (r * 0.5).toFixed(2), (r * 0.42).toFixed(2), fill, (rot + i * 72).toFixed(1),
            `stroke="${C.ink}" stroke-width="0.5" stroke-opacity="0.35"`);
        if (notch) s += circ((cx + Math.cos(a) * r * 0.98).toFixed(2), (cy + Math.sin(a) * r * 0.98).toFixed(2), (r * 0.14).toFixed(2), C.paper);
    }
    s += circ(cx, cy, r * 0.22, center);
    return s;
}

/** 葉っぱ（x,y から 角度 ang の むきに 長さ len） */
function leaf(x, y, len, ang, fill = C.leaf, wid = 0.36) {
    const w = len * wid;
    return g(path(`M0,0 Q${len * 0.45},${-w} ${len},0 Q${len * 0.45},${w} 0,0Z`, fill,
        `stroke="${C.ink}" stroke-width="0.5" stroke-opacity="0.5"`) +
        line(`M1,0 L${len * 0.85},0`, C.ink, 0.4, 'stroke-opacity="0.35"'), `translate(${x} ${y}) rotate(${ang})`);
}

/** もみじの 葉 */
function maple(x, y, r, rot = 0, fill = C.momiji) {
    let d = '';
    const n = 7;
    for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * (i % 2 === 0 && (i === 6 || i === 8) ? 0.7 : 1);
        d += (i ? 'L' : 'M') + px.toFixed(2) + ',' + py.toFixed(2);
    }
    return g(path(d + 'Z', fill, `stroke="${C.deepRed}" stroke-width="0.6"`) +
        line(`M0,0 L0,${r * 0.9}`, C.deepRed, 0.8), `translate(${x} ${y}) rotate(${rot})`);
}

/** 菊の 花 */
function kiku(cx, cy, r, fill = C.gold, center = '#b5651d', petals = 18) {
    let s = '';
    const ring = (n, dist, rx, ry, off) => {
        for (let i = 0; i < n; i++) {
            const a = off + i * 360 / n;
            s += `<ellipse cx="${cx}" cy="${(cy - dist).toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${fill}" ` +
                `stroke="${C.ink}" stroke-width="0.35" stroke-opacity="0.4" transform="rotate(${a.toFixed(1)} ${cx} ${cy})"/>`;
        }
    };
    ring(petals, r * 0.55, r * 0.16, r * 0.48, 0);
    ring(petals - 4, r * 0.3, r * 0.12, r * 0.3, 10);
    s += circ(cx, cy, r * 0.18, center);
    return s;
}

/** 牡丹の 花 */
function peony(cx, cy, r, fill = C.botan) {
    let s = '';
    for (let ring = 0; ring < 3; ring++) {
        const n = 8 - ring * 2, rr = r * (1 - ring * 0.28);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + ring * 0.4;
            s += ell((cx + Math.cos(a) * rr * 0.55).toFixed(2), (cy + Math.sin(a) * rr * 0.45).toFixed(2),
                (rr * 0.5).toFixed(2), (rr * 0.38).toFixed(2), ring === 2 ? '#f07a98' : fill, (a * 180 / Math.PI).toFixed(0),
                `stroke="${C.deepRed}" stroke-width="0.5"`);
        }
    }
    s += circ(cx, cy, r * 0.16, C.gold);
    return s;
}

/** 松の 葉の かたまり */
function pineClump(cx, cy, rx, ry) {
    let s = ell(cx, cy, rx, ry, C.pine, 0, `stroke="${C.pineDark}" stroke-width="1"`);
    const n = Math.max(4, Math.round(rx / 2.2));
    for (let i = 0; i < n; i++) {
        const x = cx - rx * 0.8 + (i / (n - 1)) * rx * 1.6;
        s += line(`M${x.toFixed(1)},${(cy + ry * 0.55).toFixed(1)} L${(x + 1.5).toFixed(1)},${(cy - ry * 0.6).toFixed(1)}`, C.pineDark, 0.7);
    }
    return s;
}

function pine(dx = 0, dy = 0, mirror = false) {
    const body =
        line('M10,158 C20,135 30,128 26,110 C24,98 34,90 48,88', C.bark, 7) +
        line('M30,118 C44,116 58,112 72,104', C.bark, 4) +
        line('M28,104 C20,96 16,90 12,80', C.bark, 3) +
        pineClump(52, 86, 22, 9) + pineClump(76, 102, 18, 8) + pineClump(14, 78, 12, 7) +
        pineClump(40, 74, 14, 6) + pineClump(62, 72, 12, 5);
    return g(body, `translate(${dx} ${dy})${mirror ? ' translate(100 0) scale(-1 1)' : ''}`);
}

/** 短冊 */
function ribbon(color, text = '', x = 36, y = 14, rot = -4) {
    const w = 24, h = 92;
    let s = path(`M0,0 L${w},0 L${w},${h} L0,${h}Z`, color, `stroke="${C.ink}" stroke-width="1"`);
    s += path(`M2,2 L${w - 2},2 L${w - 2},${h - 2} L2,${h - 2}Z`, 'none', `stroke="#ffffff" stroke-opacity="0.35" stroke-width="0.8"`);
    s += circ(w / 2, 5, 1.4, C.ink);
    if (text) {
        const chars = [...text];
        const step = Math.min(15, (h - 14) / chars.length);
        chars.forEach((ch, i) => {
            s += `<text x="${w / 2}" y="${16 + i * step + step * 0.5}" font-size="${Math.min(14, step * 0.95)}" text-anchor="middle" dominant-baseline="middle" font-family="'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP','Noto Serif CJK JP',serif" font-weight="700" fill="${C.ink}">${ch}</text>`;
        });
    }
    return g(s, `translate(${x} ${y}) rotate(${rot} ${w / 2} 0)`);
}

/* ── 鳥や 道具 ─────────────────────────────── */

function crane() {
    return g(
        line('M44,128 L42,150 M52,128 L56,150', C.ink, 1.4) +
        path('M28,112 C30,96 50,90 66,98 C74,103 76,114 68,122 C58,130 38,130 28,112Z', '#ffffff', `stroke="${C.ink}" stroke-width="1.2"`) +
        path('M28,112 C22,118 18,126 16,132 C24,126 30,124 36,122Z', C.ink) +
        path('M40,108 C48,104 58,104 64,110', 'none', `stroke="${C.ink}" stroke-width="0.8"`) +
        line('M64,100 C70,86 66,74 62,62 C60,54 64,46 70,46', C.ink, 4) +
        circ(71, 46, 4.5, '#ffffff', `stroke="${C.ink}" stroke-width="0.8"`) +
        circ(71, 43.5, 2.2, C.red) +
        path('M75,46 L86,49 L75,48Z', '#d9b24a', `stroke="${C.ink}" stroke-width="0.4"`)
    );
}

function warbler(x, y, s = 1, flip = false) {
    return g(
        path('M-14,4 C-10,-6 6,-8 12,-2 C16,2 14,8 6,10 C-2,12 -10,10 -14,4Z', '#7e9b2e', `stroke="${C.ink}" stroke-width="0.7"`) +
        path('M-14,4 L-24,10 L-12,8Z', '#5c7420', `stroke="${C.ink}" stroke-width="0.5"`) +
        path('M-4,0 C2,-2 8,2 6,6 C2,8 -4,6 -4,0Z', '#5c7420') +
        circ(9, -1, 1.3, C.ink) + path('M13,0 L18,1 L13,2Z', C.ink) +
        line('M0,10 L-1,15 M4,10 L5,15', C.ink, 0.8),
        `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`);
}

function curtain() {
    let s = path('M4,96 L96,96 L96,140 Q85,152 73,140 Q62,152 50,140 Q38,152 27,140 Q15,152 4,140Z', '#ffffff',
        `stroke="${C.ink}" stroke-width="1"`);
    for (let i = 0; i < 4; i++) s += path(`M${4 + i * 23},96 L${15.5 + i * 23},96 L${15.5 + i * 23},${146} Q${10 + i * 23},${150} ${4 + i * 23},${143}Z`, C.red, `opacity="0.92"`);
    s += circ(50, 116, 10, C.paper, `stroke="${C.ink}" stroke-width="1"`) + flower5(50, 116, 8, C.sakuraDark, C.gold, true);
    s += circ(20, 116, 7, C.paper, `stroke="${C.ink}" stroke-width="0.8"`) + flower5(20, 116, 5.5, C.sakuraDark, C.gold, true);
    s += circ(80, 116, 7, C.paper, `stroke="${C.ink}" stroke-width="0.8"`) + flower5(80, 116, 5.5, C.sakuraDark, C.gold, true);
    s += line('M4,96 L96,96', C.ink, 2.5);
    for (let x = 10; x < 96; x += 14) s += circ(x, 96, 1.8, C.gold, `stroke="${C.ink}" stroke-width="0.4"`);
    return s;
}

function cuckoo() {
    return g(
        path('M-22,-2 C-10,-10 6,-8 16,-2 C10,2 0,4 -10,4Z', '#3b3346', `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M-6,-4 C-2,-22 10,-30 22,-30 C14,-20 10,-10 6,-4Z', '#2a2433', `stroke="${C.ink}" stroke-width="0.5"`) +
        path('M-6,0 C-10,10 -18,18 -26,20 C-18,12 -14,6 -12,2Z', '#2a2433') +
        circ(16, -3, 4, '#3b3346') + circ(17, -4, 1, '#fff') + path('M20,-3 L26,-1 L20,-1Z', C.gold) +
        path('M-24,-1 L-34,-6 L-32,2Z', '#2a2433'),
        'translate(54 52) rotate(-12)');
}

function bridge() {
    const plank = (x, y, w, h, rot) =>
        g(path(`M0,0 L${w},0 L${w},${h} L0,${h}Z`, '#8a5a32', `stroke="${C.ink}" stroke-width="1"`) +
            line(`M0,${h / 2} L${w},${h / 2}`, C.ink, 0.4, 'stroke-opacity="0.5"'),
        `translate(${x} ${y}) rotate(${rot})`);
    return path('M4,118 L96,104 L96,156 L4,156Z', '#7fa7c9', 'opacity="0.55"') +
        plank(2, 128, 50, 9, -22) + plank(40, 112, 52, 9, 24) + plank(52, 140, 46, 9, -26) +
        line('M14,126 L14,148 M48,118 L48,144 M88,126 L88,152', '#5a3a1e', 2);
}

function butterfly(x, y, s, c1, c2) {
    return g(
        ell(-7, -5, 8, 6, c1, -30, `stroke="${C.ink}" stroke-width="0.6"`) + ell(7, -5, 8, 6, c1, 30, `stroke="${C.ink}" stroke-width="0.6"`) +
        ell(-5, 5, 5, 4, c2, 30, `stroke="${C.ink}" stroke-width="0.6"`) + ell(5, 5, 5, 4, c2, -30, `stroke="${C.ink}" stroke-width="0.6"`) +
        circ(-7, -6, 1.6, '#ffffff', 'opacity="0.8"') + circ(7, -6, 1.6, '#ffffff', 'opacity="0.8"') +
        ell(0, 0, 1.4, 7, C.ink) + line('M0,-6 L-4,-12 M0,-6 L4,-12', C.ink, 0.6),
        `translate(${x} ${y}) scale(${s})`);
}

function boar() {
    return g(
        path('M-30,0 C-30,-16 -10,-22 10,-18 C22,-16 30,-8 34,0 L40,2 L38,8 L30,8 C24,14 -20,16 -30,0Z', '#6b3a22', `stroke="${C.ink}" stroke-width="1"`) +
        path('M-24,-10 L-20,-18 L-14,-12 L-8,-20 L-2,-14 L4,-21 L8,-15', 'none', `stroke="${C.ink}" stroke-width="1"`) +
        circ(28, -4, 1.4, '#fff') + path('M36,4 L44,0 L40,6Z', '#f2e3c0') + path('M18,-14 L22,-22 L24,-14Z', '#4a2716') +
        line('M-22,10 L-28,22 M-12,12 L-10,24 M14,10 L10,22 M22,8 L28,20', C.ink, 2.6),
        'translate(50 128)');
}

function moon(cx, cy, r) {
    return circ(cx, cy, r, '#fbf6e4', `stroke="${C.ink}" stroke-width="0.8"`);
}

function susukiHill(top = 92, sky = null) {
    let s = sky ? path(`M4,4 L96,4 L96,${top + 20} L4,${top + 20}Z`, sky) : '';
    s += path(`M4,${top + 10} C24,${top - 6} 50,${top - 8} 70,${top} C82,${top + 4} 90,${top + 2} 96,${top - 2} L96,156 L4,156Z`, C.ink);
    for (let i = 0; i < 16; i++) {
        const x = 8 + i * 5.6, y0 = 150, y1 = top + 6 + (i % 3) * 6;
        s += line(`M${x},${y0} Q${x + 4},${(y0 + y1) / 2} ${x + 7},${y1}`, '#f4ecd6', 0.7, 'stroke-opacity="0.85"');
    }
    return s;
}

function geese() {
    const goose = (x, y, s) => g(path('M-10,0 Q-4,-6 0,0 Q4,-6 10,0 Q4,-2 0,3 Q-4,-2 -10,0Z', C.ink), `translate(${x} ${y}) scale(${s})`);
    return goose(30, 30, 1.6) + goose(56, 22, 1.4) + goose(76, 38, 1.2);
}

function sakeCup() {
    return g(
        path('M-26,-4 Q0,12 26,-4 Q24,14 0,18 Q-24,14 -26,-4Z', C.red, `stroke="${C.ink}" stroke-width="1"`) +
        ell(0, -4, 26, 6, '#e0453f', 0, `stroke="${C.ink}" stroke-width="1"`) +
        ell(0, -4, 21, 4, '#b81c1f') +
        path('M-10,16 L-14,24 L14,24 L10,16Z', '#9b1b1e', `stroke="${C.ink}" stroke-width="0.8"`) +
        `<text x="0" y="-3" font-size="9" text-anchor="middle" dominant-baseline="middle" font-family="'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP',serif" font-weight="700" fill="${C.gold}">寿</text>`,
        'translate(50 122)');
}

function deer() {
    return g(
        path('M-24,0 C-24,-12 -4,-14 14,-12 C22,-12 24,-4 22,4 C18,10 -18,10 -24,0Z', '#a8672e', `stroke="${C.ink}" stroke-width="1"`) +
        circ(-14, -4, 1.3, '#f6e7c8') + circ(-6, -6, 1.3, '#f6e7c8') + circ(4, -5, 1.3, '#f6e7c8') + circ(-10, 2, 1.2, '#f6e7c8') +
        path('M14,-10 C18,-22 22,-30 26,-34 L32,-30 C28,-24 24,-16 22,-8Z', '#a8672e', `stroke="${C.ink}" stroke-width="1"`) +
        path('M24,-34 C28,-40 36,-38 38,-32 L32,-28 C28,-28 24,-30 24,-34Z', '#a8672e', `stroke="${C.ink}" stroke-width="1"`) +
        circ(30, -34, 1, C.ink) +
        line('M26,-38 L22,-50 L18,-56 M22,-50 L28,-56 M30,-38 L34,-50 L32,-58 M34,-50 L40,-54', '#6e4220', 1.4) +
        line('M-18,6 L-20,24 M-10,8 L-8,24 M10,8 L8,24 M18,6 L22,22', C.ink, 2),
        'translate(46 120)');
}

function rainMan() {
    return g(
        // 柳と 雨
        line('M70,4 C64,30 72,50 66,80 M80,4 C78,30 86,52 82,90 M90,4 C88,26 94,46 92,70', C.yanagi, 2) +
        Array.from({ length: 14 }, (_, i) => line(`M${8 + i * 6.5},${10 + (i % 3) * 8} L${4 + i * 6.5},${30 + (i % 3) * 8}`, '#6c7a8a', 0.9)).join('') +
        // 川
        path('M4,138 C30,130 60,142 96,134 L96,156 L4,156Z', '#4f7fae', 'opacity="0.7"') +
        // 人
        path('M30,148 L36,96 L54,96 L62,148Z', '#2c4a8c', `stroke="${C.ink}" stroke-width="1"`) +
        path('M36,110 L50,112 L48,120 L36,118Z', '#e9d6b2') +
        circ(44, 88, 7, '#f1dcc0', `stroke="${C.ink}" stroke-width="0.8"`) +
        path('M37,84 C38,76 50,76 51,84Z', C.ink) +
        // かさ
        path('M14,72 C20,48 66,44 78,66 Z', C.gold, `stroke="${C.ink}" stroke-width="1"`) +
        line('M46,52 L46,108 M14,72 L46,52 M30,62 L46,52 M62,58 L46,52 M78,66 L46,52', '#8b6a20', 0.8) +
        // かえる
        g(ell(0, 0, 8, 5, '#4f9a3c', 0, `stroke="${C.ink}" stroke-width="0.8"`) + circ(-4, -4, 2.2, '#4f9a3c', `stroke="${C.ink}" stroke-width="0.6"`) +
            circ(3, -4, 2.2, '#4f9a3c', `stroke="${C.ink}" stroke-width="0.6"`) + circ(-4, -4.4, 0.8, C.ink) + circ(3, -4.4, 0.8, C.ink) +
            line('M-7,3 L-12,7 M7,3 L12,7', '#4f9a3c', 1.6), 'translate(78 130) rotate(-20)')
    );
}

function swallow() {
    return g(
        path('M-18,0 C-8,-6 8,-6 16,-2 C10,2 0,6 -10,6Z', '#1f2a5a', `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M-4,-2 C0,-18 14,-26 26,-24 C16,-16 10,-8 6,-2Z', '#1f2a5a', `stroke="${C.ink}" stroke-width="0.5"`) +
        path('M-4,4 C-6,16 -2,26 8,32 C2,22 0,12 4,4Z', '#1f2a5a') +
        path('M-18,0 L-34,-8 L-24,2 L-34,10Z', '#1f2a5a') +
        circ(14, -1, 3.6, '#1f2a5a') + path('M10,1 C12,4 16,4 18,1Z', C.red) + circ(15, -2, 0.9, '#fff') +
        path('M17,-1 L22,0 L17,1Z', C.ink),
        'translate(50 92) rotate(18)');
}

function willowStrands(color = C.yanagi, x0 = 0) {
    let s = line(`M${x0 + 4},6 C${x0 + 30},12 ${x0 + 60},10 ${x0 + 96},20`, C.bark, 2.4);
    for (let i = 0; i < 7; i++) {
        const x = x0 + 12 + i * 12;
        s += line(`M${x},${8 + i * 1.5} C${x - 6},40 ${x + 6},70 ${x - 2},${100 + (i % 3) * 14}`, color, 1.6);
        for (let k = 0; k < 6; k++) s += leaf(x - 2 + (k % 2 ? 3 : -3), 24 + k * 13 + (i % 3) * 4, 7, k % 2 ? 70 : 110, color, 0.3);
    }
    return s;
}

function phoenix() {
    let tail = '';
    const cols = [C.red, '#2f8a4a', C.gold, '#3a4fb0', C.red];
    for (let i = 0; i < 5; i++) {
        tail += line(`M44,66 C${30 - i * 4},${80 + i * 6} ${18 + i * 6},${110 + i * 6} ${10 + i * 12},${140 - i * 2}`, cols[i], 3.4);
        tail += circ(10 + i * 12, 140 - i * 2, 3, C.gold, `stroke="${C.ink}" stroke-width="0.5"`);
    }
    return g(
        circ(58, 40, 22, C.red, 'opacity="0.9"') +
        tail +
        path('M36,62 C40,48 56,44 66,50 C70,56 64,66 52,70 C46,72 40,70 36,62Z', '#e8a33a', `stroke="${C.ink}" stroke-width="1"`) +
        path('M50,54 C58,34 76,24 92,26 C80,34 72,44 64,56Z', '#2f8a4a', `stroke="${C.ink}" stroke-width="0.8"`) +
        path('M54,56 C66,44 80,40 90,44 C80,48 70,54 62,62Z', C.red, `stroke="${C.ink}" stroke-width="0.6"`) +
        line('M62,48 C64,40 70,34 74,30', C.ink, 0) +
        path('M64,50 C66,40 70,32 74,30 C78,30 80,34 78,38 C74,40 70,46 68,52Z', '#e8a33a', `stroke="${C.ink}" stroke-width="0.8"`) +
        circ(76, 33, 1, C.ink) + path('M79,34 L86,36 L79,37Z', C.gold, `stroke="${C.ink}" stroke-width="0.4"`) +
        line('M72,30 C70,24 74,20 78,22 M74,30 C76,24 80,22 82,26', C.red, 1.4)
    );
}

function kiriLeaves(dy = 0, withFlowers = true) {
    const big = (x, y, s, rot) => g(
        path('M0,0 C-14,-4 -22,-18 -14,-30 C-8,-38 0,-34 0,-28 C0,-34 8,-38 14,-30 C22,-18 14,-4 0,0Z', '#2e5e36',
            `stroke="${C.ink}" stroke-width="1"`) + line('M0,0 L0,-28 M0,-10 L-10,-20 M0,-10 L10,-20', '#183a1e', 0.8),
        `translate(${x} ${y}) scale(${s}) rotate(${rot})`);
    let flowers = '';
    for (const [x, top, n] of [[50, 14, 11], [26, 30, 8], [74, 26, 9]]) {
        flowers += line(`M${x},${top} L${x},${top + n * 5 + 8}`, '#4a3a2a', 1.4);
        for (let i = 0; i < n; i++) {
            const w = 3.2 + Math.min(i, n - i) * 0.5;
            flowers += ell(x - w * 0.6, top + 4 + i * 5, w * 0.7, 2.4, i % 2 ? C.kiri : '#9a86cc', -20, `stroke="${C.ink}" stroke-width="0.4"`) +
                ell(x + w * 0.6, top + 6 + i * 5, w * 0.7, 2.4, i % 2 ? '#9a86cc' : C.kiri, 20, `stroke="${C.ink}" stroke-width="0.4"`);
        }
    }
    return g(big(26, 154, 1.7, -16) + big(74, 156, 1.7, 16) + big(50, 140, 1.4, 0) + (withFlowers ? flowers : ''), `translate(0 ${dy})`);
}

/* ── 月ごとの 植物 ─────────────────────────── */

function plumBranch(mirror = false, withBlossoms = true) {
    let s = line('M8,156 C14,130 24,118 34,100 C42,86 48,70 70,56 C80,50 88,40 94,30', '#3a2618', 5) +
        line('M34,100 C48,96 60,98 74,90', '#3a2618', 3) + line('M48,70 C40,56 34,44 32,30', '#3a2618', 2.6);
    if (withBlossoms) {
        const pts = [[70, 56, 7], [90, 32, 6], [74, 90, 7], [32, 30, 6], [26, 112, 6], [54, 68, 5], [60, 96, 5], [40, 48, 5], [16, 136, 5]];
        for (const [x, y, r] of pts) s += flower5(x, y, r, C.plum, '#ffd86b', false, x);
        s += circ(84, 44, 2, C.plum) + circ(36, 40, 2, C.plum) + circ(46, 98, 2, C.plum);
    }
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function sakuraTree(mirror = false, low = false) {
    const dy = low ? 0 : 0;
    let s = path('M4,4 L96,4 L96,30 C70,40 30,26 4,36Z', '#f6d3dc', 'opacity="0.8"');
    s += line(`M4,${60 + dy} C30,50 60,44 96,30`, '#4a2f20', 3);
    const pts = [[20, 52], [36, 44], [52, 40], [68, 34], [84, 28], [28, 66], [46, 58], [62, 52], [78, 46], [14, 76], [38, 76], [56, 70], [90, 44], [72, 64]];
    pts.forEach(([x, y], i) => { s += flower5(x, y + dy, 7.5 - (i % 3), C.sakura, '#f7d36b', true, i * 13); });
    s += path('M4,118 C30,104 64,124 96,108 L96,124 C64,140 30,120 4,134Z', C.red, 'opacity="0.85"');
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function wisteria(mirror = false) {
    let s = line('M4,10 C30,6 60,14 96,8', '#3a2618', 3);
    for (let k = 0; k < 4; k++) {
        const x = 16 + k * 22, len = 84 + (k % 2) * 34;
        s += line(`M${x},10 C${x - 3},${30} ${x + 3},${len - 20} ${x},${len}`, '#3a2618', 1);
        for (let i = 0; i < 15; i++) {
            const y = 16 + i * (len - 14) / 15, w = 8 - i * 0.4;
            s += ell(x - w / 2 + (i % 2) * w, y, Math.max(2, w * 0.5), 2.4, i % 3 ? C.fuji : C.fujiLight, 0, `stroke="${C.ink}" stroke-width="0.4"`);
        }
    }
    s += leaf(8, 14, 14, 70, C.leafDark) + leaf(40, 12, 14, 100, C.leafDark) + leaf(62, 14, 14, 70, C.leafDark) + leaf(90, 10, 14, 110, C.leafDark);
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function irises(mirror = false, low = true) {
    let s = '';
    for (let i = 0; i < 7; i++) {
        const x = 10 + i * 13;
        s += path(`M${x},156 Q${x + 3},${100 - (i % 3) * 14} ${x + 6 + (i % 2) * 4},${60 + (i % 3) * 16} Q${x + 4},${110} ${x + 5},156Z`, C.leaf,
            `stroke="${C.leafDark}" stroke-width="0.6"`);
    }
    const flower = (x, y) => g(
        path('M0,0 C-10,-6 -12,-18 -2,-20 C0,-12 2,-6 0,0Z', C.iris, `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M0,0 C10,-6 12,-18 2,-20 C0,-12 -2,-6 0,0Z', '#5568d0', `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M0,0 C-12,2 -16,10 -10,14 C-6,10 -2,4 0,0Z', C.iris, `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M0,0 C12,2 16,10 10,14 C6,10 2,4 0,0Z', C.iris, `stroke="${C.ink}" stroke-width="0.6"`) +
        path('M-2,2 L0,8 L2,2Z', C.gold), `translate(${x} ${y})`);
    s += low ? flower(30, 72) + flower(66, 60) + flower(50, 90) : flower(28, 50) + flower(70, 40) + flower(52, 68);
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function peonyPlant(mirror = false) {
    let s = leaf(20, 120, 26, -30, C.leafDark, 0.5) + leaf(80, 124, 26, -150, C.leafDark, 0.5) + leaf(30, 96, 22, -70, C.leaf, 0.5) +
        leaf(70, 96, 22, -110, C.leaf, 0.5) + leaf(50, 150, 26, -90, C.leafDark, 0.5) + leaf(12, 150, 22, -20, C.leaf, 0.5) + leaf(88, 150, 22, -160, C.leaf, 0.5);
    s += peony(50, 112, 22) + peony(24, 76, 12, '#e8557a') + peony(78, 70, 12, '#e8557a');
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function hagiBush(mirror = false, low = false) {
    let s = '';
    const stems = [['M8,156 C20,110 40,70 80,34', 1], ['M30,156 C40,120 60,90 94,72', 1], ['M6,120 C20,90 30,60 42,20', 1]];
    for (const [d] of stems) s += line(d, '#3a2618', 1.4);
    const dots = [];
    for (let i = 0; i < 46; i++) {
        const t = i / 46;
        const which = i % 3;
        let x, y;
        if (which === 0) { x = 8 + t * 72; y = 156 - t * 122; }
        else if (which === 1) { x = 30 + t * 64; y = 156 - t * 84; }
        else { x = 6 + t * 36; y = 120 - t * 100; }
        dots.push([x + (i % 2 ? 5 : -5), y + (i % 4 - 2) * 2]);
    }
    dots.forEach(([x, y], i) => { s += ell(x.toFixed(1), y.toFixed(1), 3.2, 2, i % 4 === 0 ? '#c86d9a' : C.hagi, (i * 37) % 180, `stroke="${C.ink}" stroke-width="0.35"`); });
    if (low) s = g(s, 'translate(0 20) scale(1 0.9)');
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function kikuPlant(mirror = false, variant = 0) {
    let s = line('M30,156 C32,130 40,110 44,86 M60,156 C60,130 70,110 76,90 M44,120 C34,110 24,108 16,96', C.leafDark, 1.6) +
        leaf(36, 130, 14, -150, C.leaf, 0.5) + leaf(62, 130, 14, -30, C.leaf, 0.5) + leaf(48, 108, 12, -150, C.leaf, 0.5) + leaf(72, 112, 12, -30, C.leaf, 0.5);
    s += variant ? kiku(44, 72, 14) + kiku(78, 80, 11, '#e2533a') + kiku(16, 88, 9, '#f7f1e3')
                 : kiku(44, 78, 13) + kiku(76, 84, 10, '#f7f1e3') + kiku(18, 92, 10, '#e2533a');
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

function momijiTree(mirror = false) {
    let s = line('M4,40 C30,44 60,30 96,18', '#3a2618', 3) + line('M40,38 C44,60 40,80 46,100', '#3a2618', 1.6) + line('M70,28 C74,50 80,70 76,90', '#3a2618', 1.6);
    const pts = [[14, 40, 9, 10], [32, 30, 8, -10], [52, 30, 9, 20], [74, 20, 8, 0], [90, 26, 7, 30], [42, 60, 8, 10], [46, 86, 9, -20],
        [76, 56, 8, 30], [78, 86, 9, 0], [24, 64, 7, 40], [60, 70, 7, -30], [88, 72, 6, 10]];
    for (const [x, y, r, rot] of pts) s += maple(x, y, r, rot, rot % 20 ? C.momiji : '#e2702c');
    return mirror ? g(s, 'translate(100 0) scale(-1 1)') : s;
}

/* ── 48枚 ───────────────────────────────────── */

function art(id) {
    const m = Math.floor(id / 4) + 1, i = id % 4;
    switch (m) {
        case 1:
            if (i === 0) return circ(64, 42, 24, C.sky) + pine(0, 30, false) + crane();
            if (i === 1) return pine(0, 30) + ribbon(C.red, 'あかよろし');
            return (i === 3 ? path('M4,4 L96,4 L96,60 L4,60Z', C.sky, 'opacity="0.9"') : '') + pine(0, 20, i === 3) + pine(0, -50, i !== 3);
        case 2:
            if (i === 0) return plumBranch(false) + warbler(44, 86, 1.2, true);
            if (i === 1) return plumBranch(true) + ribbon(C.red, 'あかよろし', 38, 22, 6);
            return (i === 3 ? path('M4,4 L96,4 L96,156 L4,156Z', '#fbe5e5') : '') + plumBranch(i === 3);
        case 3:
            if (i === 0) return sakuraTree(false) + curtain();
            if (i === 1) return sakuraTree(true) + ribbon(C.red, 'みよしの', 38, 46, -4);
            return sakuraTree(i === 3);
        case 4:
            if (i === 0) return wisteria(false) + circ(74, 130, 14, C.gold, `stroke="${C.ink}" stroke-width="0.6"`) + circ(81, 125, 12.5, C.paper) + cuckoo();
            if (i === 1) return wisteria(true) + ribbon(C.red, '', 40, 52, 8);
            return wisteria(i === 3);
        case 5:
            if (i === 0) return irises(false, false) + bridge();
            if (i === 1) return irises(true) + ribbon(C.red, '', 36, 10, -6);
            return irises(i === 3);
        case 6:
            if (i === 0) return peonyPlant(false) + butterfly(30, 34, 1.3, '#3a6fd0', C.gold) + butterfly(70, 26, 1.1, C.gold, '#e36a2c');
            if (i === 1) return peonyPlant(true) + ribbon(C.blue, '', 38, 8, 4);
            return peonyPlant(i === 3);
        case 7:
            if (i === 0) return hagiBush(false, true) + boar();
            if (i === 1) return hagiBush(true) + ribbon(C.red, '', 38, 10, -6);
            return hagiBush(i === 3);
        case 8:
            if (i === 0) return path('M4,4 L96,4 L96,156 L4,156Z', C.sky) + moon(50, 52, 28) + susukiHill(100);
            if (i === 1) return path('M4,4 L96,4 L96,156 L4,156Z', C.sky) + geese() + susukiHill(84);
            return (i === 2 ? path('M4,4 L96,4 L96,70 L4,70Z', C.sky, 'opacity="0.9"') : '') + susukiHill(i === 2 ? 74 : 60);
        case 9:
            if (i === 0) return kikuPlant(false, 1) + sakeCup();
            if (i === 1) return kikuPlant(true) + ribbon(C.blue, '', 38, 6, -4);
            return kikuPlant(i === 3, i === 3 ? 1 : 0);
        case 10:
            if (i === 0) return momijiTree(false) + deer();
            if (i === 1) return momijiTree(true) + ribbon(C.blue, '', 38, 40, 6);
            return momijiTree(i === 3) + (i === 3 ? maple(30, 130, 10, 20) + maple(66, 140, 8, -20) : maple(60, 128, 10, 0));
        case 11:
            if (i === 0) return path('M4,4 L96,4 L96,156 L4,156Z', '#d9dde0') + rainMan();
            if (i === 1) return willowStrands() + swallow();
            if (i === 2) return willowStrands() + ribbon(C.red, '', 40, 48, 4);
            return path('M4,4 L96,4 L96,156 L4,156Z', C.ink) +
                g(willowStrands('#c9282d'), 'translate(0 -2)') +
                path('M20,92 C10,82 24,70 34,78 C38,66 56,66 58,78 C68,70 84,78 76,92 C84,100 72,112 62,106 C56,116 40,116 36,106 C24,112 12,102 20,92Z', '#c9282d',
                    `stroke="#f2d16b" stroke-width="1"`) +
                path('M52,96 L40,120 L50,120 L42,146 L66,112 L54,112 L62,96Z', C.gold, `stroke="${C.ink}" stroke-width="0.8"`);
        case 12:
            if (i === 0) return kiriLeaves(4, false) + phoenix();
            return (i === 3 ? path('M4,4 L96,4 L96,156 L4,156Z', '#efd27a') : '') + kiriLeaves(i === 2 ? -6 : 0) +
                (i === 2 ? '' : line('M50,24 L50,62', '#4a3a2a', 0));
    }
    return '';
}

/** 札 id の SVG（文字列） */
export function cardSVG(id) {
    const card = CARDS[id];
    const clip = `cl${uid++}`;
    let bg = C.paper;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
        `<defs><clipPath id="${clip}"><rect x="4" y="4" width="92" height="152" rx="3"/></clipPath></defs>` +
        `<rect x="0.5" y="0.5" width="99" height="159" rx="7" fill="${C.edge}" stroke="#b9a785" stroke-width="1"/>` +
        `<rect x="4" y="4" width="92" height="152" rx="3" fill="${bg}"/>` +
        `<g clip-path="url(#${clip})">${art(card.id)}</g>` +
        `<rect x="4" y="4" width="92" height="152" rx="3" fill="none" stroke="#3b2a1a" stroke-opacity="0.35" stroke-width="0.8"/>` +
        `</svg>`;
}

/** 札の うら */
export function backSVG() {
    let pat = '';
    for (let y = 14; y < 150; y += 12) for (let x = (y / 12) % 2 ? 14 : 20; x < 92; x += 12)
        pat += path(`M${x},${y - 4} L${x + 4},${y} L${x},${y + 4} L${x - 4},${y}Z`, '#7a2a1c', 'opacity="0.55"');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
        `<rect x="0.5" y="0.5" width="99" height="159" rx="7" fill="#3a120c" stroke="#1d0805" stroke-width="1"/>` +
        `<rect x="5" y="5" width="90" height="150" rx="4" fill="#5b1d12"/>` + pat +
        `<rect x="5" y="5" width="90" height="150" rx="4" fill="none" stroke="#c7953a" stroke-opacity="0.6" stroke-width="1"/>` +
        `<circle cx="50" cy="80" r="15" fill="#3a120c" stroke="#c7953a" stroke-width="1.2"/>` +
        `<text x="50" y="81" font-size="14" text-anchor="middle" dominant-baseline="middle" font-family="'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP',serif" font-weight="700" fill="#e3b85a">花</text>` +
        `</svg>`;
}

const urlCache = new Map();
const toURL = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** <img> に つかう URL（いちど つくったら おぼえておく） */
export function cardURL(id) {
    if (!urlCache.has(id)) urlCache.set(id, toURL(cardSVG(id)));
    return urlCache.get(id);
}
export function backURL() {
    if (!urlCache.has('back')) urlCache.set('back', toURL(backSVG()));
    return urlCache.get('back');
}
