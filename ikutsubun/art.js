/* いくつ分 しきづくり ── 絵（ぜんぶ この アプリ用に かいた SVG）
   ------------------------------------------------------------------
   こげ茶の ふちどり ＋ やさしい 色の、手がき ふうの 絵です。外の 素材は つかって いません。
   ART[名前] は SVG の 文字列、または 色ちがいの 配列（[0] から じゅんに つかう）。
   scenes.js の e（もの）・box（まとまり）に この 名前を かきます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    const OL = '#4d3b32';
    const svg = body =>
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
        "<g stroke='" + OL + "' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'>" + body + '</g></svg>';
    /* てかり */
    const hl = (x, y, rx, ry, r) => `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' fill='#fff' opacity='.6' stroke='none'${r ? ` transform='rotate(${r} ${x} ${y})'` : ''}/>`;
    /* かお（目・口・ほっぺ） */
    const face = (x, y, s, mouth) => {
        s = s || 1;
        const e = 2.8 * s, d = 9 * s;
        return `<ellipse cx='${x - d}' cy='${y}' rx='${e}' ry='${e * 1.2}' fill='${OL}' stroke='none'/>` +
            `<ellipse cx='${x + d}' cy='${y}' rx='${e}' ry='${e * 1.2}' fill='${OL}' stroke='none'/>` +
            (mouth === false ? '' : `<path d='M${x - 4 * s} ${y + 7 * s} Q${x} ${y + 11 * s} ${x + 4 * s} ${y + 7 * s}' fill='none' stroke-width='${2.4 * s}'/>`) +
            `<ellipse cx='${x - d - 5 * s}' cy='${y + 7 * s}' rx='${4.5 * s}' ry='${3 * s}' fill='#f59a9a' opacity='.75' stroke='none'/>` +
            `<ellipse cx='${x + d + 5 * s}' cy='${y + 7 * s}' rx='${4.5 * s}' ry='${3 * s}' fill='#f59a9a' opacity='.75' stroke='none'/>`;
    };
    const many = (fn, list) => list.map(fn);

    /* ===== 子ども（4にん） ===== */
    const SKIN = '#ffe2c8';
    const kid = (hair, shirt, style) => {
        const hairs = {
            boy: `<path d='M25 42 Q22 13 50 13 Q78 13 75 42 Q70 28 56 27 Q52 33 44 29 Q34 30 25 42 Z' fill='${hair}'/>`,
            twin: `<circle cx='21' cy='40' r='8' fill='${hair}'/><circle cx='79' cy='40' r='8' fill='${hair}'/>` +
                `<path d='M25 44 Q22 13 50 13 Q78 13 75 44 Q72 30 62 28 Q50 34 38 28 Q28 30 25 44 Z' fill='${hair}'/>`,
            spiky: `<path d='M25 42 L24 26 L33 28 L36 16 L45 23 L52 12 L58 23 L67 16 L69 28 L77 27 L75 42 Q66 30 50 30 Q34 30 25 42 Z' fill='${hair}'/>`,
            bob: `<path d='M23 54 Q18 13 50 13 Q82 13 77 54 L70 54 Q71 33 60 30 Q50 36 36 31 Q29 36 30 54 Z' fill='${hair}'/>`,
        };
        return svg(
            `<path d='M22 99 Q24 68 50 66 Q76 68 78 99 Z' fill='${shirt}'/>` +
            `<circle cx='50' cy='42' r='25' fill='${SKIN}'/>` + hairs[style] + face(50, 45, .95)
        );
    };
    const KIDS = [
        kid('#3b2f2a', '#6aa6e0', 'boy'),
        kid('#7a4a2e', '#f39ab8', 'twin'),
        kid('#8a5a33', '#7cc47a', 'spiky'),
        kid('#2f2a2a', '#f5c84c', 'bob'),
    ];

    const ART = {
        /* ===================== たべもの ===================== */
        apple: svg(
            `<path d='M50 30 C38 21 15 25 15 50 C15 75 34 91 50 84 C66 91 85 75 85 50 C85 25 62 21 50 30 Z' fill='#e8473b'/>` +
            `<path d='M50 30 Q50 19 56 11' fill='none'/>` +
            `<path d='M54 22 Q66 9 80 15 Q69 29 54 22 Z' fill='#79c150'/>` + hl(31, 45, 6, 11, 15)
        ),
        strawberry: svg(
            `<path d='M50 90 C28 82 14 58 18 42 C22 28 78 28 82 42 C86 58 72 82 50 90 Z' fill='#ef4b57'/>` +
            many(([x, y]) => `<ellipse cx='${x}' cy='${y}' rx='2' ry='3' fill='#ffe39a' stroke='none'/>`,
                [[34, 48], [50, 46], [66, 48], [28, 60], [42, 60], [58, 60], [72, 60], [36, 72], [50, 73], [64, 72], [50, 84]]).join('') +
            `<path d='M28 36 L38 27 L45 33 L50 21 L55 33 L62 27 L72 36 Q50 45 28 36 Z' fill='#5fae46'/>`
        ),
        dango: [
            svg(`<circle cx='50' cy='50' r='34' fill='#f7b7c6'/>` + hl(38, 38, 7, 10, 30)),
            svg(`<circle cx='50' cy='50' r='34' fill='#fff8ee'/>` + hl(38, 38, 7, 10, 30)),
            svg(`<circle cx='50' cy='50' r='34' fill='#a5d27d'/>` + hl(38, 38, 7, 10, 30)),
        ],
        cake: svg(
            `<path d='M16 46 L84 46 L84 80 Q84 86 78 86 L22 86 Q16 86 16 80 Z' fill='#fff1d6'/>` +
            `<rect x='16' y='60' width='68' height='8' fill='#f7a8b6' stroke='none'/>` +
            `<path d='M16 60 L84 60 M16 68 L84 68' fill='none' stroke-width='2'/>` +
            `<ellipse cx='50' cy='46' rx='34' ry='9' fill='#ffffff'/>` +
            `<path d='M41 41 C38 30 46 22 50 22 C54 22 62 30 59 41 Q50 46 41 41 Z' fill='#ef4b57'/>` +
            `<path d='M45 24 L50 18 L55 24' fill='#5fae46'/>`
        ),
        mikan: svg(
            `<circle cx='50' cy='54' r='34' fill='#f8a23a'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.4' fill='#d9822a' stroke='none'/>`,
                [[38, 46], [62, 44], [56, 64], [40, 66], [70, 58], [30, 58], [50, 76]]).join('') +
            `<path d='M50 21 Q60 10 72 14 Q64 25 50 21 Z' fill='#6cb84a'/><circle cx='50' cy='21' r='3' fill='#6b8f3a'/>` + hl(34, 42, 6, 10, 30)
        ),
        egg: svg(`<path d='M50 12 C70 12 82 46 82 62 C82 80 68 90 50 90 C32 90 18 80 18 62 C18 46 30 12 50 12 Z' fill='#fff6e6'/>` + hl(36, 40, 6, 12, 15)),
        donut: svg(
            `<circle cx='50' cy='50' r='36' fill='#e6ad63'/>` +
            `<path d='M50 18 Q60 16 66 22 Q76 22 79 32 Q86 40 82 50 Q86 62 76 68 Q72 80 60 80 Q50 86 40 80 Q28 80 24 68 Q14 60 18 50 Q14 38 24 32 Q28 22 38 22 Q42 16 50 18 Z' fill='#f69bb7'/>` +
            `<circle cx='50' cy='50' r='11' fill='#fffdf7'/>` +
            many(([x, y, r, c]) => `<rect x='${x}' y='${y}' width='7' height='2.6' rx='1.3' fill='${c}' stroke='none' transform='rotate(${r} ${x} ${y})'/>`,
                [[34, 30, 20, '#fff'], [58, 28, -30, '#7cc7f0'], [70, 44, 70, '#ffe36b'], [64, 66, 10, '#fff'], [36, 66, -40, '#7cc47a'], [26, 46, 80, '#ffe36b']]).join('')
        ),
        onigiri: svg(
            `<path d='M50 12 C62 12 88 60 88 74 C88 86 80 89 50 89 C20 89 12 86 12 74 C12 60 38 12 50 12 Z' fill='#ffffff'/>` +
            `<rect x='34' y='58' width='32' height='31' rx='2' fill='#2e3a33'/>` +
            many(([x, y]) => `<ellipse cx='${x}' cy='${y}' rx='1.6' ry='2.6' fill='#e8e2d6' stroke='none'/>`, [[40, 34], [58, 30], [30, 54], [70, 52], [50, 46]]).join('')
        ),
        cookie: svg(
            `<path d='M50 15 Q64 14 74 24 Q86 34 85 50 Q86 66 74 76 Q64 86 50 85 Q34 86 25 76 Q14 66 15 50 Q14 34 26 24 Q36 14 50 15 Z' fill='#e3a95f'/>` +
            many(([x, y]) => `<ellipse cx='${x}' cy='${y}' rx='4.5' ry='3.6' fill='#6b4228' stroke='none'/>`,
                [[36, 36], [60, 32], [50, 52], [30, 58], [68, 56], [44, 72], [64, 72]]).join('')
        ),
        choco: svg(
            `<rect x='22' y='14' width='56' height='72' rx='5' fill='#7a4a2e'/>` +
            `<path d='M22 32 L78 32 M22 50 L78 50 M50 14 L50 50' fill='none' stroke='#5a3420' stroke-width='2.4'/>` +
            `<path d='M20 56 L80 56 L80 82 Q80 88 74 88 L26 88 Q20 88 20 82 Z' fill='#e4473f'/>` +
            `<rect x='20' y='62' width='60' height='6' fill='#f7cf4a' stroke='none'/>`
        ),
        sushi: svg(
            `<path d='M16 62 Q16 48 30 48 L70 48 Q84 48 84 62 L84 70 Q84 82 70 82 L30 82 Q16 82 16 70 Z' fill='#ffffff'/>` +
            `<path d='M10 52 Q46 26 90 44 Q90 60 50 62 Q18 64 10 52 Z' fill='#ef6a5a'/>` +
            `<path d='M30 46 Q36 52 32 60 M48 40 Q54 48 50 60 M66 40 Q72 48 68 58' fill='none' stroke='#ffd0c8' stroke-width='2.4'/>`
        ),
        banana: svg(
            `<path d='M22 22 Q20 72 70 82 Q84 84 86 74 Q50 70 36 22 Z' fill='#f7d84a'/>` +
            `<path d='M20 22 L22 14 L34 14 L36 22 Z' fill='#8a6a2e'/>` +
            `<path d='M30 30 Q34 62 70 76' fill='none' stroke='#d9b52e' stroke-width='2.4'/>`
        ),
        candy: [
            ...['#f06b8f', '#6cbcf0', '#f7c948', '#86cf6a'].map(c => svg(
                `<path d='M30 50 L10 34 L14 50 L10 66 Z' fill='${c}' opacity='.7'/><path d='M70 50 L90 34 L86 50 L90 66 Z' fill='${c}' opacity='.7'/>` +
                `<circle cx='50' cy='50' r='22' fill='${c}'/>` + hl(43, 42, 5, 7, 30)
            )),
        ],
        cherry: svg(
            `<path d='M50 50 Q50 20 70 12' fill='none' stroke='#5a8a2e'/>` +
            `<circle cx='46' cy='66' r='22' fill='#e0303f'/>` + hl(38, 58, 5, 7, 30)
        ),
        tomato: svg(
            `<circle cx='50' cy='54' r='34' fill='#ec4335'/>` +
            `<path d='M30 28 L42 30 L44 20 L50 28 L56 20 L58 30 L70 28 L58 36 Q50 40 42 36 Z' fill='#5fae46'/>` + hl(34, 50, 6, 11, 20)
        ),
        kuri: svg(
            `<path d='M50 12 Q84 40 85 64 Q85 88 50 88 Q15 88 15 64 Q16 40 50 12 Z' fill='#8a4f2a'/>` +
            `<path d='M17 70 Q50 60 83 70 Q84 88 50 88 Q16 88 17 70 Z' fill='#e2c08f'/>` + hl(36, 40, 5, 10, 25)
        ),
        acorn: svg(
            `<ellipse cx='50' cy='60' rx='24' ry='28' fill='#c07a3c'/>` +
            `<path d='M22 46 Q22 24 50 24 Q78 24 78 46 Q64 52 50 52 Q36 52 22 46 Z' fill='#8a5a2e'/>` +
            `<path d='M50 24 L50 12' fill='none'/>` + hl(40, 66, 4, 9, 20)
        ),
        milk: svg(
            `<path d='M28 36 L50 16 L72 36 Z' fill='#ffffff'/>` +
            `<rect x='28' y='36' width='44' height='52' fill='#ffffff'/>` +
            `<rect x='28' y='54' width='44' height='18' fill='#5aa0dc'/>` +
            `<path d='M42 22 L50 16 L58 22' fill='none'/>`
        ),
        juice: svg(
            `<path d='M24 18 L76 18 L70 88 L30 88 Z' fill='#eef8fc'/>` +
            `<path d='M27 40 L73 40 L70 86 L30 86 Z' fill='#f8a23a' stroke='none'/>` +
            `<path d='M24 18 L76 18 L70 88 L30 88 Z' fill='none'/>` +
            `<path d='M58 6 L54 60' fill='none' stroke='#e9473f' stroke-width='5'/>` + hl(34, 56, 3, 14)
        ),
        takoyaki: svg(
            `<circle cx='50' cy='52' r='34' fill='#d98a3d'/>` +
            `<path d='M20 44 Q30 30 50 30 Q72 30 80 44 Q68 54 50 52 Q30 54 20 44 Z' fill='#6b3a1e' stroke='none'/>` +
            `<path d='M26 42 L34 36 L40 44 L48 34 L56 44 L64 34 L72 42' fill='none' stroke='#fffbe8' stroke-width='3'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.8' fill='#4f9a3a' stroke='none'/>`, [[36, 40], [52, 38], [66, 42], [44, 46]]).join('')
        ),

        /* ===================== ひと・いきもの ===================== */
        kid: KIDS,
        fish: svg(
            `<path d='M70 50 L90 32 L86 50 L90 68 Z' fill='#6aa6d8'/>` +
            `<ellipse cx='44' cy='50' rx='30' ry='19' fill='#6aa6d8'/>` +
            `<path d='M40 32 Q48 24 56 33' fill='#4f8cc0'/>` +
            `<circle cx='28' cy='46' r='3.6' fill='${OL}' stroke='none'/>` + hl(40, 42, 10, 3, -10)
        ),
        kingyo: svg(
            `<path d='M66 50 Q86 24 92 36 Q82 50 92 64 Q86 76 66 50 Z' fill='#f6855a'/>` +
            `<ellipse cx='42' cy='50' rx='26' ry='19' fill='#f26b3a'/>` +
            `<circle cx='28' cy='45' r='3.6' fill='${OL}' stroke='none'/>` +
            `<path d='M44 66 Q48 78 56 70' fill='#f6855a'/>` + hl(42, 40, 9, 3, -10)
        ),
        chick: svg(
            `<ellipse cx='50' cy='56' rx='32' ry='30' fill='#ffd84d'/>` +
            `<path d='M18 46 Q12 40 14 34' fill='none'/>` +
            `<path d='M60 58 Q76 58 72 70 Q62 70 60 58 Z' fill='#f6c23a'/>` +
            face(48, 48, .85, false) + `<path d='M44 56 L52 56 L48 62 Z' fill='#f59a3a'/>`
        ),
        octopus: svg(
            many(x => `<path d='M${x} 62 Q${x - 4} 82 ${x + 6} 88' fill='none' stroke='#e65c6b' stroke-width='9'/>`, [24, 40, 56, 72]).join('') +
            many(x => `<path d='M${x} 62 Q${x - 4} 82 ${x + 6} 88' fill='none' stroke='#f78a95' stroke-width='4' />`, [24, 40, 56, 72]).join('') +
            `<ellipse cx='50' cy='44' rx='32' ry='30' fill='#f78a95'/>` + face(50, 48, 1) +
            `<ellipse cx='50' cy='22' rx='8' ry='4' fill='#fff' opacity='.5' stroke='none'/>`
        ),
        spider: svg(
            many(([a, b, c, d]) => `<path d='M${a} ${b} L${c} ${d}' fill='none'/>`,
                [[34, 46, 10, 34], [34, 54, 8, 54], [36, 62, 12, 76], [40, 68, 22, 90], [66, 46, 90, 34], [66, 54, 92, 54], [64, 62, 88, 76], [60, 68, 78, 90]]).join('') +
            `<ellipse cx='50' cy='56' rx='20' ry='18' fill='#6a5a7a'/>` + face(50, 54, .7)
        ),
        ladybug: svg(
            `<circle cx='50' cy='28' r='14' fill='#3a3236'/>` +
            `<path d='M14 66 Q14 30 50 30 Q86 30 86 66 Q86 86 50 86 Q14 86 14 66 Z' fill='#ef3b3b'/>` +
            `<path d='M50 32 L50 86' fill='none'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='6' fill='#3a3236' stroke='none'/>`, [[32, 50], [68, 50], [30, 72], [70, 72], [44, 64], [56, 64]]).join('') +
            `<circle cx='44' cy='26' r='2.4' fill='#fff' stroke='none'/><circle cx='56' cy='26' r='2.4' fill='#fff' stroke='none'/>`
        ),
        beetle: svg(
            `<path d='M50 34 Q46 14 38 8 M50 34 Q58 20 66 18' fill='none' stroke-width='5'/>` +
            `<ellipse cx='50' cy='38' rx='16' ry='10' fill='#6b3d22'/>` +
            `<ellipse cx='50' cy='66' rx='26' ry='24' fill='#7d4a2a'/>` +
            `<path d='M50 44 L50 90' fill='none'/>` + hl(40, 58, 4, 10, 20)
        ),
        ant: svg(
            `<path d='M40 52 L24 40 M42 58 L22 64 M58 52 L76 40 M58 58 L78 64 M48 62 L40 82 M52 62 L60 82' fill='none'/>` +
            `<circle cx='50' cy='28' r='13' fill='#4a3a3a'/>` +
            `<ellipse cx='50' cy='52' rx='9' ry='10' fill='#4a3a3a'/>` +
            `<ellipse cx='50' cy='74' rx='15' ry='14' fill='#4a3a3a'/>` +
            `<path d='M44 18 Q38 8 32 8 M56 18 Q62 8 68 8' fill='none'/>` +
            `<circle cx='45' cy='27' r='2.4' fill='#fff' stroke='none'/><circle cx='55' cy='27' r='2.4' fill='#fff' stroke='none'/>`
        ),
        dog: svg(
            `<path d='M22 30 L18 10 L40 22 Z' fill='#d9914a'/><path d='M78 30 L82 10 L60 22 Z' fill='#d9914a'/>` +
            `<ellipse cx='50' cy='50' rx='34' ry='30' fill='#e8a35c'/>` +
            `<ellipse cx='50' cy='64' rx='18' ry='13' fill='#fff4e4'/>` +
            face(50, 46, .95, false) + `<ellipse cx='50' cy='58' rx='5' ry='3.6' fill='${OL}' stroke='none'/>` +
            `<path d='M45 64 Q50 69 55 64' fill='none' stroke-width='2.4'/>`
        ),
        hen: svg(
            `<path d='M40 18 Q42 8 48 14 Q52 6 56 14 Q62 8 62 20 Z' fill='#e9473f'/>` +
            `<path d='M24 50 Q22 20 50 20 Q72 20 74 44 Q92 40 88 64 Q84 88 52 88 Q24 88 24 50 Z' fill='#ffffff'/>` +
            `<path d='M22 40 L12 44 L22 48 Z' fill='#f6b23a'/><path d='M28 50 Q26 58 32 60 Q36 54 32 48 Z' fill='#e9473f'/>` +
            `<circle cx='36' cy='36' r='3.4' fill='${OL}' stroke='none'/>` +
            `<path d='M50 60 Q64 56 70 70' fill='none' stroke='#d8d0c4'/>`
        ),
        rabbit: svg(
            `<ellipse cx='36' cy='26' rx='9' ry='22' fill='#ffffff'/><ellipse cx='64' cy='26' rx='9' ry='22' fill='#ffffff'/>` +
            `<ellipse cx='36' cy='28' rx='4' ry='14' fill='#f7b7c6' stroke='none'/><ellipse cx='64' cy='28' rx='4' ry='14' fill='#f7b7c6' stroke='none'/>` +
            `<ellipse cx='50' cy='62' rx='30' ry='26' fill='#ffffff'/>` + face(50, 60, .95)
        ),
        butterfly: svg(
            `<path d='M50 46 Q30 10 14 22 Q6 40 48 52 Z' fill='#f7a8c8'/><path d='M50 46 Q70 10 86 22 Q94 40 52 52 Z' fill='#f7a8c8'/>` +
            `<path d='M48 54 Q20 60 22 78 Q34 88 48 60 Z' fill='#9ad0f0'/><path d='M52 54 Q80 60 78 78 Q66 88 52 60 Z' fill='#9ad0f0'/>` +
            `<ellipse cx='50' cy='54' rx='5' ry='20' fill='#5a4636'/>` +
            `<path d='M48 36 Q42 24 38 22 M52 36 Q58 24 62 22' fill='none'/>`
        ),
        starfish: svg(
            `<path d='M50 8 Q56 30 62 34 Q84 32 90 38 Q74 52 72 58 Q80 80 76 88 Q58 76 50 74 Q42 76 24 88 Q20 80 28 58 Q26 52 10 38 Q16 32 38 34 Q44 30 50 8 Z' fill='#f8a23a'/>` +
            face(50, 50, .8)
        ),
        stararm: svg(`<path d='M50 10 Q62 50 64 86 Q50 92 36 86 Q38 50 50 10 Z' fill='#f8a23a'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='2' fill='#e07b1f' stroke='none'/>`, [[50, 40], [48, 56], [52, 70]]).join('')),

        /* ===================== がっこう・もの ===================== */
        pencil: svg(
            `<g transform='rotate(25 50 50)'><rect x='40' y='16' width='20' height='54' fill='#f6c445'/>` +
            `<path d='M40 70 L60 70 L50 92 Z' fill='#f3dbb5'/><path d='M46 83 L54 83 L50 92 Z' fill='${OL}'/>` +
            `<rect x='40' y='8' width='20' height='9' rx='2' fill='#f39ab8'/>` +
            `<path d='M50 18 L50 68' fill='none' stroke='#e0a92e' stroke-width='2'/></g>`
        ),
        crayon: ['#e9473f', '#3f86d9', '#4fb35a', '#f6c23a', '#9a60c6', '#f08a2e'].map(c => svg(
            `<g transform='rotate(25 50 50)'><path d='M38 26 L50 8 L62 26 Z' fill='${c}'/>` +
            `<rect x='38' y='26' width='24' height='62' rx='3' fill='${c}'/>` +
            `<rect x='38' y='40' width='24' height='32' fill='#fffaf0'/>` +
            `<path d='M42 50 L58 50 M42 60 L58 60' fill='none' stroke='${c}' stroke-width='2.4'/></g>`
        )),
        origami: ['#e9473f', '#3f86d9', '#f6c23a', '#4fb35a', '#f39ab8', '#9a60c6'].map(c => svg(
            `<rect x='18' y='18' width='64' height='64' rx='2' fill='${c}'/>` +
            `<path d='M18 18 L82 82' fill='none' stroke='#ffffff' stroke-width='2' opacity='.8'/>` +
            `<path d='M82 18 L82 50 L58 18 Z' fill='#fffaf0'/>`
        )),
        book: ['#e9473f', '#3f86d9', '#4fb35a', '#f6c23a', '#9a60c6', '#f08a2e'].map(c => svg(
            `<rect x='24' y='12' width='54' height='76' rx='4' fill='#fffaf0'/>` +
            `<rect x='20' y='12' width='52' height='76' rx='4' fill='${c}'/>` +
            `<rect x='20' y='12' width='9' height='76' rx='3' fill='#00000022' stroke='none'/>` +
            `<rect x='36' y='26' width='26' height='12' rx='2' fill='#fffaf0'/>`
        )),
        desk: svg(
            `<path d='M22 50 L22 92 M78 50 L78 92' fill='none' stroke='#8a8f99' stroke-width='5'/>` +
            `<rect x='24' y='50' width='52' height='18' fill='#c9ccd2'/>` +
            `<rect x='12' y='34' width='76' height='16' rx='3' fill='#e0ab68'/>` + hl(30, 40, 10, 2)
        ),
        notebook: ['#5aa0dc', '#f39ab8', '#86cf6a', '#f6c23a'].map(c => svg(
            `<rect x='22' y='10' width='56' height='80' rx='4' fill='${c}'/>` +
            `<rect x='32' y='26' width='36' height='22' rx='3' fill='#ffffff'/>` +
            `<path d='M36 34 L64 34 M36 41 L56 41' fill='none' stroke-width='2'/>`
        )),
        tamaire: [
            svg(`<circle cx='50' cy='50' r='32' fill='#e9473f'/>` + hl(40, 40, 6, 9, 30)),
            svg(`<circle cx='50' cy='50' r='32' fill='#ffffff'/>` + hl(40, 40, 6, 9, 30)),
        ],
        tanzaku: ['#f7a8c8', '#9ad0f0', '#fff08a', '#a8e09a', '#d6b8f0'].map(c => svg(
            `<path d='M50 2 L50 10' fill='none'/>` +
            `<rect x='34' y='10' width='32' height='84' rx='2' fill='${c}'/>` +
            `<circle cx='50' cy='17' r='2.4' fill='${OL}' stroke='none'/>` +
            `<path d='M46 30 L46 76 M54 30 L54 60' fill='none' stroke-width='2.4' opacity='.55'/>`
        )),
        block: ['#3f86d9', '#e9473f', '#f6c23a', '#4fb35a'].map(c => svg(
            `<rect x='26' y='22' width='16' height='12' rx='3' fill='${c}'/><rect x='58' y='22' width='16' height='12' rx='3' fill='${c}'/>` +
            `<rect x='16' y='32' width='68' height='52' rx='6' fill='${c}'/>` + hl(28, 44, 4, 8)
        )),
        flower: ['#f7a8c8', '#fff08a', '#c9a8f0', '#ffffff'].map(c => svg(
            `<path d='M50 46 L50 96' fill='none' stroke='#5fae46' stroke-width='4'/>` +
            `<path d='M50 76 Q66 62 76 70 Q64 82 50 76 Z' fill='#79c150'/>` +
            many(a => `<ellipse cx='50' cy='16' rx='9' ry='13' fill='${c}' transform='rotate(${a} 50 32)'/>`, [0, 60, 120, 180, 240, 300]).join('') +
            `<circle cx='50' cy='32' r='9' fill='#f7c948'/>`
        )),
        tulip: ['#e9473f', '#f6c23a', '#f39ab8', '#ffffff'].map(c => svg(
            `<path d='M50 50 L50 96' fill='none' stroke='#5fae46' stroke-width='4'/>` +
            `<path d='M50 90 Q30 70 30 56 Q44 64 50 82 Z' fill='#79c150'/>` +
            `<path d='M30 12 L40 24 L50 8 L60 24 L70 12 Q76 48 50 52 Q24 48 30 12 Z' fill='${c}'/>`
        )),
        card: [['♥', '#e2453a'], ['♠', '#3a3236'], ['♦', '#e2453a'], ['♣', '#3a3236']].map(([s, c]) => svg(
            `<rect x='22' y='10' width='56' height='80' rx='7' fill='#ffffff'/>` +
            `<text x='50' y='64' font-size='40' text-anchor='middle' fill='${c}' stroke='none' font-family='sans-serif'>${s}</text>` +
            `<text x='31' y='28' font-size='14' text-anchor='middle' fill='${c}' stroke='none' font-family='sans-serif'>${s}</text>`
        )),
        balloon: ['#e9473f', '#3f86d9', '#f6c23a', '#4fb35a', '#f39ab8'].map(c => svg(
            `<path d='M50 70 Q42 80 52 88 Q60 94 50 100' fill='none' stroke-width='2'/>` +
            `<ellipse cx='50' cy='38' rx='27' ry='32' fill='${c}'/>` +
            `<path d='M45 72 L55 72 L50 66 Z' fill='${c}'/>` + hl(39, 26, 5, 9, 25)
        )),
        sticker: ['#f7c948', '#f39ab8', '#7cc7f0', '#86cf6a'].map(c => svg(
            `<path d='M50 8 L61 36 L91 37 L67 56 L76 86 L50 68 L24 86 L33 56 L9 37 L39 36 Z' fill='${c}'/>` + face(50, 48, .7)
        )),
        ohajiki: ['#7cc7f0', '#f7a3c4', '#a3e0a0', '#ffe07a'].map(c => svg(
            `<circle cx='50' cy='50' r='32' fill='${c}' opacity='.9'/>` +
            `<path d='M28 44 Q32 28 46 24' fill='none' stroke='#ffffff' stroke-width='5' opacity='.8'/>` +
            `<circle cx='50' cy='50' r='20' fill='none' stroke='#ffffff' stroke-width='2' opacity='.6'/>`
        )),
        soccer: svg(
            `<circle cx='50' cy='50' r='36' fill='#ffffff'/>` +
            `<path d='M50 36 L63 45 L58 60 L42 60 L37 45 Z' fill='#3a3236'/>` +
            `<path d='M50 36 L50 16 M63 45 L82 38 M58 60 L70 76 M42 60 L30 76 M37 45 L18 38' fill='none' stroke-width='2.4'/>` +
            `<path d='M40 15 L50 16 L60 15 Q50 13 40 15 Z M84 46 L82 38 L78 30 Q85 38 84 46 Z M16 46 L18 38 L22 30 Q15 38 16 46 Z' fill='#3a3236'/>`
        ),
        tsumiki: [
            svg(`<rect x='18' y='22' width='64' height='60' rx='3' fill='#f6c23a'/>` + hl(30, 34, 6, 3)),
            svg(`<rect x='18' y='22' width='64' height='60' rx='3' fill='#e9473f'/>` + hl(30, 34, 6, 3)),
            svg(`<rect x='18' y='22' width='64' height='60' rx='3' fill='#3f86d9'/>` + hl(30, 34, 6, 3)),
            svg(`<rect x='18' y='22' width='64' height='60' rx='3' fill='#4fb35a'/>` + hl(30, 34, 6, 3)),
        ],
        window: svg(
            `<rect x='16' y='14' width='68' height='72' rx='4' fill='#bfe6f7'/>` +
            `<path d='M50 14 L50 86 M16 50 L84 50' fill='none' stroke-width='4'/>` +
            `<path d='M24 26 L36 20 M60 26 L72 20' fill='none' stroke='#ffffff' stroke-width='3'/>`
        ),
        candle: ['#f7a8c8', '#9ad0f0', '#fff08a', '#a8e09a'].map(c => svg(
            `<path d='M50 6 Q62 22 50 30 Q38 22 50 6 Z' fill='#ffb22e'/><path d='M50 14 Q55 22 50 26 Q45 22 50 14 Z' fill='#ffe36b' stroke='none'/>` +
            `<path d='M50 30 L50 36' fill='none'/>` +
            `<rect x='40' y='36' width='20' height='56' rx='3' fill='${c}'/>` +
            `<path d='M40 50 L60 44 M40 64 L60 58 M40 78 L60 72' fill='none' stroke='#ffffff' stroke-width='3' opacity='.8'/>`
        )),
        paper: svg(
            `<path d='M20 10 L66 10 L80 24 L80 90 L20 90 Z' fill='#ffffff'/>` +
            `<path d='M66 10 L66 24 L80 24' fill='#ece6da'/>`
        ),

        /* ===================== 足・はね など（1つ分が きまって いる ばめん） ===================== */
        tire: svg(`<circle cx='50' cy='50' r='34' fill='#3a3a3a'/><circle cx='50' cy='50' r='15' fill='#c9ccd2'/><circle cx='50' cy='50' r='4' fill='#8a8f99' stroke='none'/>`),
        tentacle: svg(
            `<path d='M40 10 Q20 50 44 74 Q60 88 74 76 Q78 66 66 66 Q56 70 52 60 Q44 40 60 10 Z' fill='#f78a95'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='3' fill='#fff1f2' stroke='none'/>`, [[52, 24], [50, 38], [50, 52]]).join('')
        ),
        bugleg: svg(`<path d='M28 14 L50 46 L36 86' fill='none' stroke='#5a4636' stroke-width='7'/><path d='M36 86 L48 88' fill='none' stroke='#5a4636' stroke-width='5'/>`),
        paw: svg(
            `<ellipse cx='50' cy='62' rx='20' ry='17' fill='#e8a35c'/>` +
            many(([x, y]) => `<ellipse cx='${x}' cy='${y}' rx='8' ry='10' fill='#e8a35c'/>`, [[26, 36], [42, 24], [58, 24], [74, 36]]).join('')
        ),
        henfoot: svg(`<path d='M50 12 L50 60 M50 60 L26 86 M50 60 L50 90 M50 60 L74 86 M50 60 L34 50' fill='none' stroke='#f6b23a' stroke-width='7'/>`),
        ear: svg(`<ellipse cx='50' cy='50' rx='17' ry='40' fill='#ffffff'/><ellipse cx='50' cy='52' rx='8' ry='28' fill='#f7b7c6' stroke='none'/>`),
        wing: ['#f7a8c8', '#9ad0f0'].map(c => svg(`<path d='M20 84 Q10 20 50 12 Q92 10 82 46 Q76 74 20 84 Z' fill='${c}'/><circle cx='56' cy='38' r='8' fill='#ffffff' opacity='.7' stroke='none'/>`)),
        petal: svg(`<path d='M50 90 Q16 60 26 26 Q34 10 44 22 L50 30 L56 22 Q66 10 74 26 Q84 60 50 90 Z' fill='#f9c2d2'/><path d='M50 86 L50 52' fill='none' stroke='#f08aa8' stroke-width='2'/>`),
        leaf: svg(`<path d='M50 88 Q10 60 16 30 Q24 12 40 18 Q48 22 50 30 Q52 22 60 18 Q76 12 84 30 Q90 60 50 88 Z' fill='#6cbf4f'/><path d='M50 84 L50 34' fill='none' stroke='#4c9a36' stroke-width='2.4'/>`),
        finger: svg(`<rect x='34' y='10' width='32' height='82' rx='16' fill='${SKIN}'/><rect x='40' y='16' width='20' height='18' rx='8' fill='#ffd2d6'/>`),
        isuleg: svg(`<rect x='40' y='8' width='20' height='84' rx='5' fill='#c9874a'/>` + hl(46, 30, 2, 12)),
        page: svg(`<path d='M18 14 L82 14 L82 86 L18 86 Z' fill='#ffffff'/><path d='M28 30 L72 30 M28 42 L72 42 M28 54 L72 54 M28 66 L58 66' fill='none' stroke-width='2.2' opacity='.5'/>`),
        day: svg(
            `<rect x='16' y='18' width='68' height='68' rx='6' fill='#ffffff'/>` +
            `<path d='M16 24 Q16 18 22 18 L78 18 Q84 18 84 24 L84 36 L16 36 Z' fill='#e9473f'/>` +
            `<circle cx='50' cy='62' r='9' fill='#f7c948'/>`
        ),
        yen1: svg(`<circle cx='50' cy='50' r='34' fill='#e7e9ee'/><circle cx='50' cy='50' r='26' fill='none' stroke='#b6bac4' stroke-width='2'/>` +
            `<text x='50' y='63' font-size='34' text-anchor='middle' fill='#8a8f99' stroke='none' font-family='sans-serif' font-weight='bold'>1</text>`),
        yen5: svg(`<circle cx='50' cy='50' r='34' fill='#e9c45a'/><circle cx='50' cy='50' r='9' fill='#fffdf7'/>` +
            `<path d='M30 72 Q50 84 70 72' fill='none' stroke='#b88f2a' stroke-width='3'/>`),

        /* ===================== まとまり（入れもの・のりもの など） ===================== */
        plate: svg(`<ellipse cx='50' cy='60' rx='44' ry='22' fill='#ffffff'/><ellipse cx='50' cy='58' rx='30' ry='12' fill='#f3f0ea' stroke='#d8d0c4' stroke-width='2'/>`),
        box: svg(
            `<path d='M14 40 L4 26 L36 26 L42 40 Z M86 40 L96 26 L64 26 L58 40 Z' fill='#cf9a5c'/>` +
            `<rect x='14' y='40' width='72' height='46' rx='3' fill='#e0b47a'/>` +
            `<rect x='38' y='40' width='24' height='10' fill='#f6e3c2'/>`
        ),
        bag: svg(
            `<path d='M34 34 Q34 12 50 12 Q66 12 66 34' fill='none' stroke-width='4'/>` +
            `<path d='M18 32 L82 32 L78 90 L22 90 Z' fill='#f3e3c3'/>` +
            `<path d='M18 32 L82 32 L80 44 L20 44 Z' fill='#e2c99a'/>`
        ),
        basket: svg(
            `<path d='M22 46 Q50 0 78 46' fill='none' stroke='#b0783e' stroke-width='6'/>` +
            `<path d='M10 44 L90 44 L80 88 L20 88 Z' fill='#d9a35f'/>` +
            `<path d='M16 58 L84 58 M18 72 L82 72 M34 44 L36 88 M50 44 L50 88 M66 44 L64 88' fill='none' stroke='#b0783e' stroke-width='2.4'/>`
        ),
        stem: svg(`<path d='M30 90 Q40 40 50 30 Q60 40 70 90' fill='none' stroke='#5a8a2e' stroke-width='4'/><path d='M50 30 Q62 10 80 14 Q70 30 50 30 Z' fill='#79c150'/>`),
        flag: ['#e9473f', '#3f86d9', '#f6c23a', '#4fb35a', '#f39ab8', '#9a60c6', '#f08a2e', '#5ac8c8', '#8a5a33'].map(c => svg(
            `<path d='M26 92 L26 10' fill='none' stroke-width='5'/>` +
            `<path d='M28 12 L84 24 L28 50 Z' fill='${c}'/><circle cx='26' cy='9' r='5' fill='#f7c948'/>`
        )),
        teacup: svg(
            `<ellipse cx='50' cy='84' rx='42' ry='10' fill='#9ad0f0'/>` +
            `<path d='M12 40 L88 40 Q86 84 50 84 Q14 84 12 40 Z' fill='#f7a8c8'/>` +
            `<ellipse cx='50' cy='40' rx='38' ry='9' fill='#fce1ea'/>` +
            many(([x, y]) => `<circle cx='${x}' cy='${y}' r='4' fill='#ffffff' stroke='none'/>`, [[28, 58], [50, 66], [72, 58], [40, 74], [62, 74]]).join('')
        ),
        coaster: svg(
            `<path d='M8 74 L92 74' fill='none' stroke='#8a8f99' stroke-width='4'/>` +
            `<path d='M14 66 L14 40 Q14 32 24 32 L84 32 Q90 32 90 40 L90 66 Z' fill='#e9473f'/>` +
            `<path d='M22 42 L82 42' fill='none' stroke='#ffffff' stroke-width='4'/>` +
            `<circle cx='28' cy='70' r='8' fill='#3a3a3a'/><circle cx='76' cy='70' r='8' fill='#3a3a3a'/>`
        ),
        gondola: svg(
            `<path d='M50 4 L50 18' fill='none' stroke-width='4'/>` +
            `<path d='M20 30 Q20 18 32 18 L68 18 Q80 18 80 30 L80 74 Q80 88 66 88 L34 88 Q20 88 20 74 Z' fill='#f6c23a'/>` +
            `<rect x='28' y='28' width='44' height='26' rx='6' fill='#bfe6f7'/>`
        ),
        boat: svg(
            `<path d='M4 50 L96 50 L82 78 L18 78 Z' fill='#f6c23a'/>` +
            `<path d='M8 58 L92 58' fill='none' stroke='#e9473f' stroke-width='4'/>` +
            `<path d='M6 86 Q18 80 30 86 Q42 92 54 86 Q66 80 78 86 Q88 92 96 86' fill='none' stroke='#6aa6d8' stroke-width='3'/>`
        ),
        car: ['#e9473f', '#3f86d9', '#f6c23a', '#4fb35a', '#f39ab8'].map(c => svg(
            `<path d='M8 72 L8 52 Q8 46 16 44 L28 42 L38 26 Q40 22 46 22 L68 22 Q74 22 78 28 L86 42 Q94 44 94 52 L94 72 Z' fill='${c}'/>` +
            `<path d='M42 30 L46 42 L60 42 L60 30 Z M64 30 L64 42 L80 42 L74 30 Z' fill='#bfe6f7'/>` +
            `<circle cx='28' cy='74' r='10' fill='#3a3a3a'/><circle cx='74' cy='74' r='10' fill='#3a3a3a'/>` +
            `<circle cx='28' cy='74' r='4' fill='#c9ccd2' stroke='none'/><circle cx='74' cy='74' r='4' fill='#c9ccd2' stroke='none'/>`
        )),
        train: svg(
            `<rect x='6' y='22' width='88' height='54' rx='8' fill='#86cf6a'/>` +
            `<rect x='6' y='56' width='88' height='8' fill='#f6c23a' stroke='none'/>` +
            many(x => `<rect x='${x}' y='30' width='18' height='18' rx='3' fill='#bfe6f7'/>`, [14, 41, 68]).join('') +
            `<circle cx='26' cy='80' r='7' fill='#3a3a3a'/><circle cx='74' cy='80' r='7' fill='#3a3a3a'/>`
        ),
        bench: svg(
            `<path d='M14 60 L14 90 M86 60 L86 90' fill='none' stroke='#8a5a33' stroke-width='6'/>` +
            `<rect x='4' y='28' width='92' height='12' rx='3' fill='#d9a35f'/>` +
            `<rect x='4' y='50' width='92' height='12' rx='3' fill='#e0ab68'/>` +
            `<path d='M14 40 L14 50 M86 40 L86 50' fill='none' stroke='#8a5a33' stroke-width='5'/>`
        ),
        elevator: svg(
            `<rect x='14' y='8' width='72' height='84' rx='4' fill='#c9ccd2'/>` +
            `<rect x='22' y='20' width='56' height='72' fill='#e7e9ee'/><path d='M50 20 L50 92' fill='none'/>` +
            `<path d='M42 8 L50 2 L58 8 Z' fill='#f6c23a'/>`
        ),
        tricycle: svg(
            `<circle cx='32' cy='64' r='22' fill='none' stroke-width='5'/>` +
            `<path d='M32 64 L58 50 L78 78 M58 50 L54 34 M48 34 L60 34 M58 50 L72 50 M66 80 L92 80' fill='none' stroke='#e9473f' stroke-width='5'/>` +
            `<circle cx='70' cy='80' r='9' fill='#ffffff' stroke-width='4'/><circle cx='88' cy='80' r='9' fill='#ffffff' stroke-width='4'/>` +
            `<ellipse cx='72' cy='48' rx='9' ry='4' fill='#3a3a3a'/>`
        ),
        bicycle: svg(
            `<circle cx='24' cy='64' r='18' fill='none' stroke-width='5'/><circle cx='76' cy='64' r='18' fill='none' stroke-width='5'/>` +
            `<path d='M24 64 L44 40 L68 40 L76 64 M44 40 L50 64 L68 40 M68 40 L64 26 L74 26' fill='none' stroke='#3f86d9' stroke-width='5'/>` +
            `<ellipse cx='42' cy='36' rx='8' ry='3.6' fill='#3a3a3a'/>`
        ),
        unicycle: svg(
            `<circle cx='50' cy='70' r='22' fill='none' stroke-width='5'/>` +
            `<path d='M50 70 L50 20' fill='none' stroke='#9a60c6' stroke-width='5'/>` +
            `<ellipse cx='50' cy='16' rx='14' ry='6' fill='#3a3a3a'/>`
        ),
        chair: svg(
            `<path d='M26 50 L26 92 M74 50 L74 92 M26 8 L26 50 M74 8 L74 50' fill='none' stroke='#8a5a33' stroke-width='6'/>` +
            `<rect x='22' y='10' width='56' height='22' rx='4' fill='#e0ab68'/>` +
            `<rect x='16' y='48' width='68' height='12' rx='3' fill='#d9a35f'/>`
        ),
        tank: svg(
            `<rect x='10' y='22' width='80' height='66' rx='6' fill='#cfeefa'/>` +
            `<rect x='12' y='34' width='76' height='52' fill='#9ad6f0' stroke='none'/>` +
            `<path d='M24 82 Q30 66 26 54 M76 82 Q70 70 74 58' fill='none' stroke='#5fae46' stroke-width='3'/>`
        ),
        nest: svg(
            `<path d='M8 48 Q50 70 92 48 Q88 88 50 88 Q12 88 8 48 Z' fill='#b98552'/>` +
            `<path d='M14 58 Q50 76 86 58 M18 70 Q50 84 82 70' fill='none' stroke='#8a5a33' stroke-width='2.4'/>` +
            `<path d='M8 48 Q50 30 92 48' fill='none' stroke='#8a5a33'/>`
        ),
        shelf: svg(`<rect x='6' y='10' width='88' height='80' rx='3' fill='#d9a35f'/><rect x='14' y='18' width='72' height='28' fill='#8a5a33'/><rect x='14' y='54' width='72' height='28' fill='#8a5a33'/>`),
        openbook: svg(
            `<path d='M50 24 Q30 14 8 20 L8 82 Q30 76 50 86 Q70 76 92 82 L92 20 Q70 14 50 24 Z' fill='#ffffff'/>` +
            `<path d='M50 24 L50 86' fill='none'/>` +
            `<path d='M18 36 L40 38 M18 48 L40 50 M18 60 L40 62 M60 38 L82 36 M60 50 L82 48 M60 62 L82 60' fill='none' stroke-width='2' opacity='.5'/>`
        ),
        vase: svg(
            `<path d='M36 10 L64 10 L60 24 Q84 40 80 66 Q76 92 50 92 Q24 92 20 66 Q16 40 40 24 Z' fill='#6aa6d8'/>` +
            `<path d='M26 56 Q50 66 74 56' fill='none' stroke='#ffffff' stroke-width='4' opacity='.8'/>`
        ),
        sakura: svg(
            many(a => `<path d='M50 50 Q30 30 38 12 Q44 8 50 18 Q56 8 62 12 Q70 30 50 50 Z' fill='#f9c2d2' transform='rotate(${a} 50 50)'/>`, [0, 72, 144, 216, 288]).join('') +
            `<circle cx='50' cy='50' r='7' fill='#f08aa8'/>`
        ),
        clover4: svg(
            `<path d='M50 50 Q60 74 54 96' fill='none' stroke='#4c9a36' stroke-width='4'/>` +
            many(a => `<path d='M50 50 Q26 44 26 28 Q28 16 40 18 Q46 20 50 26 Q54 20 60 18 Q72 16 74 28 Q74 44 50 50 Z' fill='#6cbf4f' transform='rotate(${a} 50 50) translate(0 -2) scale(1) translate(0 0)'/>`, [0, 90, 180, 270].map(a => a + 45)).join('')
        ),
        clover3: svg(
            `<path d='M50 50 Q60 74 54 96' fill='none' stroke='#4c9a36' stroke-width='4'/>` +
            many(a => `<path d='M50 50 Q26 44 26 28 Q28 16 40 18 Q46 20 50 26 Q54 20 60 18 Q72 16 74 28 Q74 44 50 50 Z' fill='#6cbf4f' transform='rotate(${a} 50 50)'/>`, [0, 120, 240]).join('')
        ),
        hand: svg(
            many(([x, y, r]) => `<rect x='${x}' y='${y}' width='14' height='36' rx='7' fill='${SKIN}' transform='rotate(${r} ${x + 7} ${y + 30})'/>`,
                [[22, 34, -40], [32, 14, -12], [44, 8, 0], [56, 12, 12], [66, 22, 26]]).join('') +
            `<path d='M24 56 Q24 40 40 40 L66 40 Q80 44 76 64 Q72 90 50 90 Q28 90 24 56 Z' fill='${SKIN}'/>`
        ),
        calendar: svg(
            `<rect x='12' y='16' width='76' height='74' rx='6' fill='#ffffff'/>` +
            `<path d='M12 22 Q12 16 18 16 L82 16 Q88 16 88 22 L88 34 L12 34 Z' fill='#e9473f'/>` +
            many(i => `<rect x='${18 + (i % 4) * 17}' y='${42 + Math.floor(i / 4) * 15}' width='11' height='9' rx='2' fill='#e7e9ee' stroke='none'/>`, [0, 1, 2, 3, 4, 5, 6]).join('') +
            `<path d='M30 8 L30 22 M70 8 L70 22' fill='none' stroke-width='5'/>`
        ),
        gum: svg(
            `<rect x='10' y='30' width='80' height='40' rx='6' fill='#7cd0b0'/>` +
            `<rect x='10' y='42' width='80' height='16' fill='#ffffff' stroke='none'/>` +
            `<path d='M10 42 L90 42 M10 58 L90 58' fill='none' stroke-width='2'/>`
        ),
        purse: svg(
            `<path d='M14 44 Q14 32 26 32 L74 32 Q86 32 86 44 L86 78 Q86 88 74 88 L26 88 Q14 88 14 78 Z' fill='#f39ab8'/>` +
            `<path d='M14 44 Q50 52 86 44' fill='none'/>` +
            `<circle cx='42' cy='28' r='6' fill='#f7c948'/><circle cx='58' cy='28' r='6' fill='#f7c948'/>`
        ),
        house: svg(
            `<path d='M8 46 L50 12 L92 46 Z' fill='#e9473f'/>` +
            `<rect x='18' y='46' width='64' height='44' fill='#fff1d6'/>` +
            `<rect x='42' y='62' width='16' height='28' rx='2' fill='#c9874a'/>`
        ),
        bdcake: svg(
            `<path d='M14 50 L86 50 L86 82 Q86 90 78 90 L22 90 Q14 90 14 82 Z' fill='#fff1d6'/>` +
            `<ellipse cx='50' cy='50' rx='36' ry='11' fill='#ffffff'/>` +
            `<path d='M14 66 Q24 72 32 66 Q41 72 50 66 Q59 72 68 66 Q77 72 86 66' fill='none' stroke='#f7a8b6' stroke-width='4'/>` +
            many(x => `<circle cx='${x}' cy='48' r='5' fill='#ef4b57'/>`, [30, 50, 70]).join('')
        ),
    };

    /* SVG の 文字列 → <img> に つかう data URL（いちど つくったら おぼえておく） */
    const cache = {};
    function artUrl(name, i) {
        const v = ART[name];
        if (!v) return '';
        const s = Array.isArray(v) ? v[(i || 0) % v.length] : v;
        const key = name + '#' + (Array.isArray(v) ? (i || 0) % v.length : 0);
        if (!cache[key]) cache[key] = 'data:image/svg+xml,' + encodeURIComponent(s);
        return cache[key];
    }
    const variants = name => (Array.isArray(ART[name]) ? ART[name].length : ART[name] ? 1 : 0);

    root.IkutsuArt = { ART, artUrl, variants };
    if (typeof module === 'object' && module.exports) module.exports = root.IkutsuArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
