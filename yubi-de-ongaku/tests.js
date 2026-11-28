/* きまりの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までと、譜面（song-tengoku.js）を よみこんで しらべます。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box });
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'song-tengoku.js'), 'utf8'), { globalThis: box });
const L = box.YubiLogic, SONG = box.SONG_TENGOKU;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/* ---------- はくの 時間 ---------- */
const bt = [1, 1.5, 2.2, 2.8];
t('はく 0 は さいしょの 時間', near(L.beatTime(bt, 0), 1));
t('はく 1.5 は 1と2の まんなか', near(L.beatTime(bt, 1.5), 1.85));
t('さいごより さきは さいごの はやさで のばす', near(L.beatTime(bt, 4), 3.4));
t('はじめより まえも のばせる', near(L.beatTime(bt, -1), 0.5));

/* ---------- かたち ---------- */
const sample = {
    zigzag: { x0: 100, y0: 300, x1: 900, y1: 300, amp: 60 },
    loops: { x0: 100, y0: 300, x1: 900, y1: 300, r: 60 },
    wave: { x0: 100, y0: 300, x1: 900, y1: 300, amp: 60 },
    hops: { x0: 100, y0: 300, x1: 900, y1: 300, h: 100 },
    arc: { x0: 100, y0: 600, x1: 900, y1: 600, bend: 300 },
    line: { x0: 100, y0: 600, x1: 900, y1: 200 },
    spiral: { cx: 800, cy: 450, r0: 300, r1: 30, turns: 3 },
    pop: { x: 800, y: 450 }
};
for (const k of Object.keys(L.SHAPES)) {
    t(`かたち「${k}」の ためしが ある`, sample[k]);
    const n = k === 'pop' ? 1 : 6;
    const segs = L.SHAPES[k](sample[k], n);
    t(`かたち「${k}」：くぎりが ${n}こ`, segs.length === n, segs.length);
    t(`かたち「${k}」：点が ぜんぶ すうじ`, segs.every(sg => sg.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))));
    let joined = true;
    for (let i = 1; i < segs.length; i++) if (dist(segs[i - 1][segs[i - 1].length - 1], segs[i][0]) > 0.01) joined = false;
    t(`かたち「${k}」：くぎりと くぎりが つながって いる`, joined);
}
const zz = L.SHAPES.zigzag(sample.zigzag, 4);
t('ギザギザ：かど（はく）が うえ・した こうごに くる', near(zz[0][0][1], 240) && near(zz[1][0][1], 360) && near(zz[2][0][1], 240));
const lp = L.SHAPES.loops(sample.loops, 4);
t('くるくる：はくの ところは わの いちばん うえ', lp.every(sg => near(sg[0][1], 300 - 120)));

/* ---------- 線の すすみかた ---------- */
const beats = []; for (let i = 0; i < 40; i++) beats.push(2 + i * 0.5);
const st = L.buildStroke({ k: 'zigzag', b: [4, 12], per: 1, c: 'orange', ...sample.zigzag }, beats, 'normal');
t('ふつう：1はくで 1くぎり（8はく → 8くぎり）', st.segs.length === 8, st.segs.length);
t('はじまりは 4はくめの 時間', near(st.t0, 4) && near(st.t1, 8));
t('くぎりの 時間が ならんで いる', st.times.every((x, i) => i === 0 || x > st.times[i - 1]));
t('はじまる まえは まち', L.progressAt(st, 3.9).state === 'wait');
t('おわった あとは おしまい', L.progressAt(st, 8.1).state === 'done');
const mid = L.progressAt(st, 5.25);
t('とちゅうは 何くぎりめの どこまでか わかる', mid.state === 'run' && mid.seg === 2 && near(mid.f, 0.5), JSON.stringify(mid));
const h = L.pointOn(st, 2, 0);
t('くぎりの はじめ（はく）は かどの ばしょ', near(h[0], st.segs[2][0][0], 0.01) && near(h[1], st.segs[2][0][1], 0.01));
const easy = L.buildStroke({ k: 'zigzag', b: [4, 12], per: 1, c: 'orange', ...sample.zigzag }, beats, 'easy');
t('かんたん：くぎりが はんぶん（大きく うごく）', easy.segs.length === 4, easy.segs.length);
t('かんたん でも はじまりと おわりは おなじ', near(easy.t0, st.t0) && near(easy.t1, st.t1));
const arcE = L.buildStroke({ k: 'arc', b: [0, 4], c: 'lime', ...sample.arc }, beats, 'easy');
t('弧は かんたん でも かわらない', arcE.segs.length === 1);

/* ---------- 録音から つくった 線（path） ---------- */
const P = [[1, 100, 500], [1.5, 300, 300, 'L'], [2, 500, 500, 'C'], [2.4, 700, 500, 'H', 120], [3, 900, 500, 'O', 60], [3.5, 1100, 400, 'C']];
const ps = L.buildPath({ k: 'path', p: P, c: 'pink' }, 'normal');
t('path：くぎりは 点の かず − 1', ps.segs.length === P.length - 1);
t('path：くぎりの おわりは つぎの 点', ps.segs.every((sg, i) => dist(sg[sg.length - 1], [P[i + 1][1], P[i + 1][2]]) < 0.5));
t('path：くぎりの はじめは まえの 点', ps.segs.every((sg, i) => dist(sg[0], [P[i][1], P[i][2]]) < 0.5));
t('path：時間は 点の 時間', ps.times.every((x, i) => x === P[i][0]));
const hop = ps.segs[2];
t('path：ぴょん（H）は 上に はねる', Math.min(...hop.map(q => q[1])) < 500 - 100);
const curl = ps.segs[3];
t('path：くるっと（O）は わを かく（いちど もどる）', curl.some((q, i) => i > 0 && q[0] < curl[i - 1][0]));
const at2 = L.progressAt(ps, 2.4);
t('path：音が なった 瞬間に 玉は 点に いる', near(L.pointOn(ps, at2.seg, at2.f)[0], 700, 0.5) || (at2.seg === 3 && near(at2.f, 0)));
const pse = L.buildPath({ k: 'path', p: P, pe: [P[0], P[5]], c: 'pink' }, 'easy');
t('path：かんたん は pe を つかう', pse.segs.length === 1);

/* ---------- 音の 大きさ・音が なった 瞬間 ---------- */
const fake = { env: [0, 100, 50], onsets: [[0.5, 0.8], [1.0, 0.3]] };
t('大きさ：0.05秒の あいだは つなぐ', near(L.loudAt(fake, 0.025), 0.5) && near(L.loudAt(fake, 0.05), 1));
t('音が なった 瞬間：0.2秒 まえ なら みつかる', L.lastOnset(fake, 0.7, 0.32) && near(L.lastOnset(fake, 0.7, 0.32).t, 0.5));
t('音が なった 瞬間：ふるい ものは なし', L.lastOnset(fake, 0.9, 0.32) === null);
t('音が なった 瞬間：さいしょより まえは なし', L.lastOnset(fake, 0.2, 0.32) === null);

/* ---------- 譜面（天国と地獄） ---------- */
t('譜面が ある', SONG && Array.isArray(SONG.beats) && Array.isArray(SONG.scenes));
const B = SONG.beats;
t('はくの 時間が じゅんに ならんで いる', B.every((x, i) => i === 0 || x > B[i - 1]));
t('はくは 曲の 長さの なか', B[0] >= 0 && B[B.length - 1] <= SONG.duration + 0.01, `${B[0]}〜${B[B.length - 1]} / ${SONG.duration}`);
t('音の 大きさが 曲の 長さぶん ある（0.05秒ごと）', Math.abs(SONG.env.length * 0.05 - SONG.duration) < 0.1 && SONG.env.every(v => v >= 0 && v <= 100), SONG.env.length);
t('音が なった 瞬間が じゅんに ならんで いる', SONG.onsets.length > 200 && SONG.onsets.every((o, i) => o[1] >= 0 && o[1] <= 1 && (i === 0 || o[0] > SONG.onsets[i - 1][0])), SONG.onsets.length);
const COLORS = ['orange', 'yellow', 'lime', 'lavender', 'pink', 'cyan', 'purple', 'red', 'white'];
const onsetTimes = SONG.onsets.map(o => o[0]);
const nearOnset = x => onsetTimes.some(o => Math.abs(o - x) < 0.002);
const nearBeat = x => B.some(b => Math.abs(b - x) < 0.002);
const names = new Set();
let prevEnd = -Infinity;
SONG.scenes.forEach((sc, i) => {
    const name = `がめん${i + 1}`;
    t(`${name}：線が 1〜6本`, sc.strokes.length >= 1 && sc.strokes.length <= 6, sc.strokes.length);
    sc.strokes.forEach((s, j) => {
        const label = `${name}-${j + 1}（${s.name || s.k}）`;
        if (s.name) names.add(s.name);
        t(`${label}：かたちが ある`, s.k === 'path' || L.SHAPES[s.k]);
        t(`${label}：いろが きまって いる`, COLORS.includes(s.c), s.c);
        if (s.k === 'path') {
            for (const [key, lv, gap] of [['p', 'normal', 0.18], ['pe', 'easy', 0.38]]) {
                const pp = s[key];
                t(`${label}（${lv}）：点が 2つ いじょう`, Array.isArray(pp) && pp.length >= 2);
                // 点の 時間：はじまりと おわりは はく、あいだは「音が なった 瞬間」（かいだんの まがりかどは べつ）
                const inner = pp.slice(1, -1).filter((q, k) => q[3] !== 'c' && !(s.name === 'stairs' && pp[k + 2] && pp[k + 2][1] !== q[1] && pp[k][1] === q[1]));
                t(`${label}（${lv}）：はじまりと おわりは はく`, nearBeat(pp[0][0]) && nearBeat(pp[pp.length - 1][0]));
                t(`${label}（${lv}）：あいだの 点は 音が なった 瞬間`, inner.every(q => nearOnset(q[0])), inner.filter(q => !nearOnset(q[0])).map(q => q[0]).join(','));
                const tms = pp.map(q => q[0]);
                t(`${label}（${lv}）：時間が じゅんに ならぶ`, tms.every((x, k) => k === 0 || x > tms[k - 1]));
                if (s.name !== 'stairs' && !pp.some(q => q[3] === 'c')) t(`${label}（${lv}）：点と 点は ${gap}秒 いじょう はなれる`, tms.every((x, k) => k === 0 || x - tms[k - 1] >= gap - 0.02), Math.min(...tms.slice(1).map((x, k) => x - tms[k])).toFixed(3));
                t(`${label}（${lv}）：つなぎかたが わかる`, pp.slice(1).every(q => ['L', 'C', 'c', 'H', 'O', undefined].includes(q[3])));
            }
        } else {
            t(`${label}：はくの はんい`, s.b[0] >= 0 && s.b[1] <= B.length - 1 && (s.k === 'pop' ? s.b[1] === s.b[0] : s.b[1] > s.b[0]), s.b.join('〜'));
        }
        for (const lv of ['normal', 'easy']) {
            const bs = L.buildStroke(s, B, lv);
            const pts = bs.segs.flat();
            const inside = pts.every(p => p[0] >= 40 && p[0] <= L.W - 40 && p[1] >= 40 && p[1] <= L.H - 40);
            t(`${label}（${lv}）：画面の なかに おさまる`, inside, inside ? '' : JSON.stringify(pts.find(p => !(p[0] >= 40 && p[0] <= L.W - 40 && p[1] >= 40 && p[1] <= L.H - 40))));
        }
    });
    const built = L.buildSong({ ...SONG, scenes: [sc] }, 'normal').scenes[0];
    t(`${name}：まえの がめんの あとに はじまる`, built.start >= prevEnd - 1e-6, `${built.start.toFixed(2)} >= ${prevEnd.toFixed(2)}`);
    prevEnd = built.end;
});
t('うごきかたが 12しゅるい いじょう', names.size >= 12, [...names].join(' '));
/* おなじ がめんの なかで、2本の 線が どうじに すすまない（ゆびは 1本） */
SONG.scenes.forEach((sc, i) => {
    const ss = sc.strokes.map(s => L.buildStroke(s, B, 'normal')).sort((a, b) => a.t0 - b.t0);
    let ok = true;
    for (let j = 1; j < ss.length; j++) if (ss[j].t0 < ss[j - 1].t1 - 1e-6) ok = false;
    t(`がめん${i + 1}：線は 1本ずつ じゅんばんに すすむ`, ok);
});
const song = L.buildSong(SONG, 'normal');
t('がめんの でる 時間は はじまる 時間より まえ', song.scenes.every(sc => sc.show <= sc.start));
t('がめんの こさは 0〜1', song.scenes.every(sc => [sc.show - 1, sc.show + 0.1, sc.start, sc.end, sc.hide + 0.2, sc.hide + 1].every(x => {
    const a = L.sceneAlpha(sc, x); return a >= 0 && a <= 1;
})));

/* ---------- けっか ---------- */
const bad = rows.filter(r => !r.ok);
for (const r of bad) console.log('✗ ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
console.log(`${rows.length - bad.length} / ${rows.length} OK`);
process.exit(bad.length ? 1 : 0);
