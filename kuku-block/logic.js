/* ブロック おはじき ── 計算の きまり（画面を つかわない ところ）
   ------------------------------------------------------------------
   かこみの 中に ある ブロックを しらべる・マス目に そろえる・
   あいている ばしょを さがす・しきを つくる、など。
   ふつうの <script> で 読みこむので、index.html を ファイルとして
   ひらいても（file://）動きます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    /* ---------- かたち ---------- */

    /** 点が 多角形の 中に あるか（レイキャスティング） */
    function pointInPolygon(x, y, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    function polygonArea(pts) {
        let a = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
        }
        return Math.abs(a / 2);
    }

    function bbox(pts) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of pts) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        return { x0, y0, x1, y1 };
    }

    function centroid(pts) {
        let sx = 0, sy = 0;
        for (const [x, y] of pts) { sx += x; sy += y; }
        return [sx / pts.length, sy / pts.length];
    }

    function distToSeg(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    /** 線（closed なら とじた 線）までの いちばん ちかい きょり */
    function distToPolyline(px, py, pts, closed) {
        if (pts.length === 1) return Math.hypot(px - pts[0][0], py - pts[0][1]);
        let d = Infinity;
        const n = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < n; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            d = Math.min(d, distToSeg(px, py, a[0], a[1], b[0], b[1]));
        }
        return d;
    }

    /** ちかすぎる 点を まびく */
    function simplify(pts, minDist) {
        if (!pts.length) return [];
        const out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i], q = out[out.length - 1];
            if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist) out.push(p);
        }
        return out;
    }

    /** かどを まるく する（チャイキン法） */
    function chaikin(pts, iterations, closed) {
        let cur = pts;
        for (let k = 0; k < iterations; k++) {
            const out = [];
            const n = closed ? cur.length : cur.length - 1;
            if (!closed) out.push(cur[0]);
            for (let i = 0; i < n; i++) {
                const a = cur[i], b = cur[(i + 1) % cur.length];
                out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
                out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
            }
            if (!closed) out.push(cur[cur.length - 1]);
            cur = out;
        }
        return cur;
    }

    /** ゆびで かいた 線を「かこみ」に する。小さすぎる ときは null。
        はじめと おわりが はなれていても、むすんで とじます。 */
    function makeLoop(raw) {
        const pts = simplify(raw, 4);
        if (pts.length < 5) return null;
        const b = bbox(pts);
        if (b.x1 - b.x0 < 24 && b.y1 - b.y0 < 24) return null;
        const smooth = chaikin(pts, 2, true);
        if (polygonArea(smooth) < 300) return null;
        return simplify(smooth, 3).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }

    /* ---------- ブロック ---------- */

    function blockCenter(b, size) { return [b.x + size / 2, b.y + size / 2]; }

    /** かこみの 中に まん中が ある ブロック */
    function blocksInLoop(blocks, loopPts, size) {
        const b = bbox(loopPts);
        return blocks.filter(bl => {
            const [cx, cy] = blockCenter(bl, size);
            return cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1 && pointInPolygon(cx, cy, loopPts);
        });
    }

    /** かこみの 中に まるごと 入っている 小さい かこみ */
    function loopsInLoop(loops, outer) {
        const area = polygonArea(outer.pts);
        return loops.filter(l => l !== outer && polygonArea(l.pts) < area &&
            l.pts.every(([x, y]) => pointInPolygon(x, y, outer.pts)));
    }

    function snap(v, size) { return Math.round(v / size) * size; }

    function cellKey(x, y, size) { return Math.round(x / size) + ',' + Math.round(y / size); }

    /** (x, y) に いちばん ちかい、あいている マス。bounds の 外は えらばない */
    function findFreeCell(x, y, size, occupied, bounds) {
        const c0 = Math.round(x / size), r0 = Math.round(y / size);
        const cMax = Math.floor((bounds.x1 - size) / size), rMax = Math.floor((bounds.y1 - size) / size);
        const cMin = Math.ceil(bounds.x0 / size), rMin = Math.ceil(bounds.y0 / size);
        for (let ring = 0; ring < 60; ring++) {
            let best = null, bestD = Infinity;
            for (let dr = -ring; dr <= ring; dr++) {
                for (let dc = -ring; dc <= ring; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
                    const c = c0 + dc, r = r0 + dr;
                    if (c < cMin || c > cMax || r < rMin || r > rMax) continue;
                    if (occupied.has(c + ',' + r)) continue;
                    const d = dc * dc + dr * dr;
                    if (d < bestD) { bestD = d; best = [c * size, r * size]; }
                }
            }
            if (best) return best;
        }
        return [snap(x, size), snap(y, size)];
    }

    /** rows × cols が まるごと 入る あいた ばしょ（左上から さがす）。なければ null。
        margin マス（はじめは 1）だけ まわりも あけておくと、ほかの ブロックと くっつかない */
    function findFreeRect(rows, cols, size, occupied, bounds, margin) {
        const m = margin === undefined ? 1 : margin;
        const cMin = Math.ceil(bounds.x0 / size) + 1, rMin = Math.ceil(bounds.y0 / size) + 1;
        const cMax = Math.floor(bounds.x1 / size) - cols - (m ? 1 : 0), rMax = Math.floor(bounds.y1 / size) - rows - (m ? 1 : 0);
        for (let r = rMin; r <= rMax; r++) {
            for (let c = cMin; c <= cMax; c++) {
                let ok = true;
                for (let dr = -m; dr < rows + m && ok; dr++) {
                    for (let dc = -m; dc < cols + m && ok; dc++) {
                        if (occupied.has((c + dc) + ',' + (r + dr))) ok = false;
                    }
                }
                if (ok) return [c * size, r * size];
            }
        }
        return null;
    }

    /** となりあって くっついている ブロックを ぜんぶ あつめる（ななめは べつ） */
    function clusterOf(blocks, startId, size) {
        const byId = new Map(blocks.map(b => [b.id, b]));
        if (!byId.has(startId)) return [];
        const near = size * 1.15, side = size * 0.6;
        const seen = new Set([startId]);
        const queue = [startId];
        while (queue.length) {
            const a = byId.get(queue.shift());
            for (const b of blocks) {
                if (seen.has(b.id)) continue;
                const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
                if (dx <= near && dy <= near && (dx < side || dy < side)) {
                    seen.add(b.id);
                    queue.push(b.id);
                }
            }
        }
        return [...seen];
    }

    /* ---------- しき ---------- */

    /** かこみごとの かず（0 の かこみは のぞく）と、かこみの 外の かずから しきを つくる */
    function describe(counts, loose) {
        const used = counts.filter(n => n > 0);
        if (!used.length) return null;
        const sum = used.reduce((a, b) => a + b, 0);
        const same = used.every(n => n === used[0]);
        const rest = loose > 0 ? `（のこり ${loose}こ）` : '';
        if (same) {
            return {
                kind: 'mul',
                expr: `${used[0]} × ${used.length} = ${sum}`,
                words: `${used[0]}こずつ ${used.length}つぶん で ${sum}こ${rest}`,
            };
        }
        return { kind: 'add', expr: `${used.join(' + ')} = ${sum}`, words: `ぜんぶで ${sum}こ${rest}` };
    }

    /* ---------- 九九の となえかた ---------- */

    const KUKU = [
        null,
        ['いんいちが いち', 'いんにが に', 'いんさんが さん', 'いんしが し', 'いんごが ご', 'いんろくが ろく', 'いんしちが しち', 'いんはちが はち', 'いんくが く'],
        ['にいちが に', 'ににんが し', 'にさんが ろく', 'にしが はち', 'にご じゅう', 'にろく じゅうに', 'にしち じゅうし', 'にはち じゅうろく', 'にく じゅうはち'],
        ['さんいちが さん', 'さんにが ろく', 'さざんが く', 'さんし じゅうに', 'さんご じゅうご', 'さぶろく じゅうはち', 'さんしち にじゅういち', 'さんぱ にじゅうし', 'さんく にじゅうしち'],
        ['しいちが し', 'しにが はち', 'しさん じゅうに', 'しし じゅうろく', 'しご にじゅう', 'しろく にじゅうし', 'ししち にじゅうはち', 'しは さんじゅうに', 'しく さんじゅうろく'],
        ['ごいちが ご', 'ごに じゅう', 'ごさん じゅうご', 'ごし にじゅう', 'ごご にじゅうご', 'ごろく さんじゅう', 'ごしち さんじゅうご', 'ごは しじゅう', 'ごっく しじゅうご'],
        ['ろくいちが ろく', 'ろくに じゅうに', 'ろくさん じゅうはち', 'ろくし にじゅうし', 'ろくご さんじゅう', 'ろくろく さんじゅうろく', 'ろくしち しじゅうに', 'ろくは しじゅうはち', 'ろっく ごじゅうし'],
        ['しちいちが しち', 'しちに じゅうし', 'しちさん にじゅういち', 'しちし にじゅうはち', 'しちご さんじゅうご', 'しちろく しじゅうに', 'しちしち しじゅうく', 'しちは ごじゅうろく', 'しちく ろくじゅうさん'],
        ['はちいちが はち', 'はちに じゅうろく', 'はちさん にじゅうし', 'はちし さんじゅうに', 'はちご しじゅう', 'はちろく しじゅうはち', 'はちしち ごじゅうろく', 'はっぱ ろくじゅうし', 'はっく しちじゅうに'],
        ['くいちが く', 'くに じゅうはち', 'くさん にじゅうしち', 'くし さんじゅうろく', 'くご しじゅうご', 'くろく ごじゅうし', 'くしち ろくじゅうさん', 'くは しちじゅうに', 'くく はちじゅういち'],
    ];

    /** n × k の となえかた（1〜9 の とき だけ） */
    function kukuReading(n, k) {
        return (KUKU[n] && KUKU[n][k - 1]) || '';
    }

    /* ---------- まわす・ふやす ---------- */

    /** (px, py) を 中心に 時計まわりに 90° まわす（画面は y が 下むき） */
    function rotate90(x, y, px, py) {
        return [px - (y - py), py + (x - px)];
    }

    /** (px, py) を 中心に a ラジアン まわす（画面は y が 下むきなので、+ は 時計まわり） */
    function rotateAround(x, y, px, py, a) {
        const c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
        return [px + dx * c - dy * s, py + dx * s + dy * c];
    }

    /** 90° の ばいすうに ちかければ（tol ラジアン いない）その かどに、ちがえば そのまま */
    function snapAngle(a, tol) {
        const q = Math.PI / 2, k = Math.round(a / q);
        return Math.abs(a - k * q) <= tol ? k * q : a;
    }

    /** 90° の ばいすう か（ブロックの むきが もとに もどったか） */
    function isRightAngle(a) {
        const q = Math.PI / 2, r = ((a % q) + q) % q;
        return r < 1e-6 || q - r < 1e-6;
    }

    /* ---------- ブロックと おはじき ---------- */

    const PIECES = ['b', 'r', 'sb', 'sr'];   /* あおブロック・あかブロック・さくら（あお）・さくら（あか） */
    const FLIP = { b: 'r', r: 'b', sb: 'sr', sr: 'sb' };
    const isOhajiki = (c) => c === 'sb' || c === 'sr';
    const flipColor = (c) => FLIP[c] || 'b';

    /** 「こうたい」の いろ（x／sx）を k だんめ の いろに */
    function danColor(c, k) {
        if (c === 'x') return k % 2 ? 'r' : 'b';
        if (c === 'sx') return k % 2 ? 'sr' : 'sb';
        return PIECES.includes(c) ? c : 'b';
    }

    /* ---------- 見る ところ（ズーム） ---------- */

    /** box が 見える ところ（inset を のぞいた がめん）に おさまる 見かた {ox, oy, z}。
        いまより 大きくは しない（maxZ）。 */
    function fitView(box, W, H, inset, minZ, maxZ) {
        const aw = Math.max(40, W - inset.l - inset.r), ah = Math.max(40, H - inset.t - inset.b);
        const bw = Math.max(1, box.x1 - box.x0), bh = Math.max(1, box.y1 - box.y0);
        const z = Math.max(minZ, Math.min(maxZ, aw / bw, ah / bh));
        const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
        return { z, ox: inset.l + aw / 2 - cx * z, oy: inset.t + ah / 2 - cy * z };
    }

    /* ---------- よみこんだ データを たしかめる ---------- */

    const num = (v) => typeof v === 'number' && isFinite(v);
    const pts2 = (p) => Array.isArray(p) && p.length >= 1 && p.length <= 20000 && p.every(q => Array.isArray(q) && num(q[0]) && num(q[1]));
    const str = (v, n) => typeof v === 'string' && v.length <= n;

    /** ほかの 人から きた ページを、つかえる かたちに なおす（おかしな ものは すてる）。だめなら null */
    function sanitizeState(s, empty) {
        if (!s || typeof s !== 'object' || !Array.isArray(s.blocks)) return null;
        const out = Object.assign({}, empty);
        out.size = num(s.size) ? Math.max(16, Math.min(128, s.size)) : empty.size;
        out.blocks = s.blocks.filter(b => b && str(b.id, 40) && num(b.x) && num(b.y) && PIECES.includes(b.c))
            .slice(0, 3000).map(b => (num(b.a) && b.a ? { id: b.id, x: b.x, y: b.y, c: b.c, a: b.a } : { id: b.id, x: b.x, y: b.y, c: b.c }));
        out.loops = (Array.isArray(s.loops) ? s.loops : []).filter(l => l && str(l.id, 40) && pts2(l.pts) && l.pts.length >= 3 && str(l.color, 30) && /^#[0-9a-f]{6}$/i.test(l.color))
            .slice(0, 500).map(l => ({ id: l.id, pts: l.pts, color: l.color }));
        out.strokes = (Array.isArray(s.strokes) ? s.strokes : []).filter(t => t && str(t.id, 40) && pts2(t.pts) && str(t.color, 30) && /^#[0-9a-f]{6}$/i.test(t.color) && num(t.w))
            .slice(0, 2000).map(t => ({ id: t.id, pts: t.pts, color: t.color, w: Math.max(1, Math.min(40, t.w)) }));
        const b = s.bg;
        out.bg = b && str(b.id, 60) && num(b.x) && num(b.y) && num(b.s) && b.s > 0 && [0, 1, 2, 3].includes(b.rot) && num(b.alpha)
            ? Object.assign({ id: b.id, x: b.x, y: b.y, s: b.s, rot: b.rot, alpha: Math.max(0.1, Math.min(1, b.alpha)), label: str(b.label, 40) ? b.label : 'しゃしん' },
                str(b.o, 60) ? { o: b.o } : {})
            : null;
        out.loopColor = num(s.loopColor) ? Math.abs(Math.round(s.loopColor)) % 6 : 0;
        /* イラストの はいけい（1こずつ うごかせる。絵ではなく ばしょ だけ もつ） */
        const sc = s.scene;
        const items = sc && Array.isArray(sc.items) ? sc.items.filter(it => it && str(it.id, 40) && /^[a-z]{2,12}$/.test(it.k)
            && num(it.x) && num(it.y) && num(it.w) && num(it.h) && it.w > 4 && it.h > 4 && it.w < 20000 && it.h < 20000).slice(0, 60)
            .map(it => ({ id: it.id, k: it.k, x: it.x, y: it.y, w: it.w, h: it.h, c: num(it.c) ? Math.abs(Math.round(it.c)) % 50 : 0 })) : [];
        out.scene = items.length ? { kind: str(sc.kind, 20) ? sc.kind : items[0].k, label: str(sc.label, 40) ? sc.label : 'イラスト', items } : null;
        out.card = s.card && str(s.card.text, 200) ? { text: s.card.text } : null;
        out.dan = null;   /* だんの とちゅうは ひきつがない（ブロックは のこる） */
        return out;
    }

    /* ---------- クラス（せんせいの せってい） ---------- */

    /** せんせいが こどもに つかわせるか えらべる きのう（キー・なまえ） */
    const FEATURES = [
        ['block', 'ブロック'], ['ohajiki', 'おはじき'],
        ['loop', 'かこむ'], ['pen', 'かく'], ['erase', 'けす'], ['count', 'かぞえる'],
        ['rotate', 'まわす・ふやす'], ['array', 'ならべる'], ['dan', 'くくの だん'], ['cards', 'おだい'],
        ['photo', 'しゃしん・はいけい'], ['tabs', 'ページを ふやす・とじる'], ['zoom', 'ズーム'], ['clear', 'ぜんぶ けす'],
    ];

    /** あいことば（4けた）を そのまま のこさない ための かんたんな ハッシュ（FNV-1a）。
        こどもが せんせいの 画面を あけない ための もので、ひみつを まもる ほどの つよさは ない */
    function pinHash(pin) {
        let h = 0x811c9dc5;
        const t = 'ohajiki:' + pin;
        for (let i = 0; i < t.length; i++) {
            h ^= t.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ('0000000' + h.toString(16)).slice(-8);
    }

    /** とどいた クラスの せっていを つかえる かたちに（ない ものは「つかえる」に する） */
    function sanitizeCfg(c) {
        if (!c || typeof c !== 'object') return null;
        const allow = {};
        for (const [k] of FEATURES) allow[k] = !(c.allow && c.allow[k] === false);
        const st = c.set || {};
        return {
            name: str(c.name, 40) && c.name.trim() ? c.name.trim() : 'クラス',
            pin: str(c.pin, 8) && /^[0-9a-f]{8}$/.test(c.pin) ? c.pin : '',
            allow,
            set: {
                snap: st.snap !== false, count: st.count !== false, expr: st.expr !== false, sound: st.sound !== false,
                size: num(st.size) ? Math.max(24, Math.min(96, Math.round(st.size))) : 48,
            },
            live: c.live !== false,
            pv: num(c.pv) ? Math.max(0, Math.round(c.pv)) : 0,
        };
    }

    /** 出席番号（1〜99） */
    const isSeatNo = (n) => Number.isInteger(n) && n >= 1 && n <= 99;

    function boxesOverlap(a, b) {
        return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    }

    /** box（x0,y0,x1,y1）を step ずつ ずらして、obstacles と かさならない ばしょを さがす。
        もとの だんの 右 → 下の だん … の じゅんに ちかい ところ。ずらす りょう [dx, dy] か null */
    function findSpot(box, obstacles, bounds, step, gap) {
        const w = box.x1 - box.x0, h = box.y1 - box.y0;
        const iMin = Math.ceil((bounds.x0 - box.x0) / step), iMax = Math.floor((bounds.x1 - box.x1) / step);
        const jMin = Math.ceil((bounds.y0 - box.y0) / step), jMax = Math.floor((bounds.y1 - box.y1) / step);
        let best = null, bestScore = Infinity;
        for (let j = jMin; j <= jMax; j++) {
            for (let i = iMin; i <= iMax; i++) {
                if (i === 0 && j === 0) continue;
                const x0 = box.x0 + i * step, y0 = box.y0 + j * step;
                const cand = { x0: x0 - gap, y0: y0 - gap, x1: x0 + w + gap, y1: y0 + h + gap };
                if (obstacles.some(o => boxesOverlap(cand, o))) continue;
                const score = Math.abs(j) * 10000 + (i < 0 ? 5000 : 0) + Math.abs(i);
                if (score < bestScore) { bestScore = score; best = [i * step, j * step]; }
            }
        }
        return best;
    }

    const api = {
        pointInPolygon, polygonArea, bbox, centroid, distToSeg, distToPolyline,
        simplify, chaikin, makeLoop, blockCenter, blocksInLoop, loopsInLoop,
        snap, cellKey, findFreeCell, findFreeRect, clusterOf, describe,
        kukuReading, rotate90, boxesOverlap, findSpot,
        rotateAround, snapAngle, isRightAngle, PIECES, isOhajiki, flipColor, danColor,
        fitView, sanitizeState, FEATURES, pinHash, sanitizeCfg, isSeatNo,
    };
    root.KukuLogic = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
