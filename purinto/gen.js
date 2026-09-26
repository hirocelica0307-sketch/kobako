/* たのしい プリント ── もんだいを つくる きまり（画面を つかわない ところ）
   ------------------------------------------------------------------
   めいろの みち・ことばさがし・まほうじん・ピラミッド・ナンプレ・
   てんつなぎ・まちがいさがし などの「もんだい」と「こたえ」を つくります。
   おなじ たね（seed）からは いつも おなじ もんだいが できるので、
   URL を くばれば クラス ぜんいんが おなじ プリントに なります。
   ふつうの <script> で 読みこむので、ファイルとして ひらいても 動きます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    /* ---------- たね つきの さいころ ---------- */

    /** mulberry32。seed が おなじなら おなじ ならびに なる */
    function makeRng(seed) {
        let a = (seed >>> 0) || 1;
        const next = () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
        const pick = arr => arr[Math.floor(next() * arr.length)];
        const shuffle = arr => {
            const a2 = arr.slice();
            for (let i = a2.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [a2[i], a2[j]] = [a2[j], a2[i]];
            }
            return a2;
        };
        const sample = (arr, n) => shuffle(arr).slice(0, n);
        return { next, int, pick, shuffle, sample };
    }

    /** もじれつから たねを つくる（「くまの おつかい」→ かず） */
    function hashSeed(str) {
        let h = 2166136261;
        for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    /* ---------- もじの かぞえかた ---------- */

    const SMALL = 'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ';

    /** 「ことばかいだん」の かぞえかた。小さい ゃゅょ などは まえの もじと セットで 1マス、
        小さい「っ」と「ー」は 1マス。 */
    function moraSplit(s) {
        const out = [];
        for (const ch of String(s).replace(/[\s　]/g, '')) {
            if (SMALL.includes(ch) && out.length) out[out.length - 1] += ch;
            else out.push(ch);
        }
        return out;
    }

    /** カタカナ → ひらがな（ー は そのまま） */
    function toHira(s) {
        return String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    }

    /** 1もじ（または 1マス）に わける。ことばさがし・めいろ用（小さい もじも 1マス） */
    function chars(s) { return Array.from(String(s).replace(/[\s　]/g, '')); }

    /* ---------- めいろの みち ---------- */

    const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const key = (x, y) => x + ',' + y;

    /** c を parent の つぎに おけるか。
        みちどうしが よこ・たてで くっつかない（まちがえて となりの みちへ 行けない）ように、
        c の となりで つかわれて いるのは parent だけ、と きめる。 */
    function canPlace(W, H, occ, x, y, px, py) {
        if (x < 0 || y < 0 || x >= W || y >= H || occ.has(key(x, y))) return false;
        for (const [dx, dy] of DIR4) {
            const nx = x + dx, ny = y + dy;
            if (nx === px && ny === py) continue;
            if (occ.has(key(nx, ny))) return false;
        }
        return true;
    }

    /**
     * from（すでに ある マス、または null）から len マスの みちを のばす。
     * start … from が null の ときの 1マスめ
     * end   … ここで おわる（len は「さいてい」の ながさ になる）
     * もどり ながら さがす（バックトラック）。budget を こえたら null。
     */
    function growPath(W, H, occ, opt, rng) {
        const { from = null, start = null, len, end = null, maxLen = Infinity, budget = 30000 } = opt;
        const path = [];
        let steps = 0;
        const endKey = end ? key(end[0], end[1]) : null;

        const firsts = from ? rng.shuffle(DIR4).map(([dx, dy]) => [from[0] + dx, from[1] + dy]) : [start];
        const pf = from || [-99, -99];

        function dfs(x, y, px, py) {
            if (++steps > budget) return false;
            occ.add(key(x, y)); path.push([x, y]);
            const n = path.length;
            if (end) {
                if (key(x, y) === endKey) {
                    if (n >= len) return true;
                    occ.delete(key(x, y)); path.pop(); return false;
                }
            } else if (n === len) return true;
            if (n < maxLen) {
                let dirs = rng.shuffle(DIR4);
                /* ゴールが きまって いる ときは すこしだけ ゴールの ほうへ */
                if (end && n >= len && rng.next() < 0.6) {
                    dirs = dirs.slice().sort((a, b) =>
                        (Math.abs(x + a[0] - end[0]) + Math.abs(y + a[1] - end[1])) -
                        (Math.abs(x + b[0] - end[0]) + Math.abs(y + b[1] - end[1])));
                }
                for (const [dx, dy] of dirs) {
                    const nx = x + dx, ny = y + dy;
                    /* ゴールの マスは ほかの となりを ゆるさない きまりだけ みる */
                    if (canPlace(W, H, occ, nx, ny, x, y) && dfs(nx, ny, x, y)) return true;
                }
            }
            occ.delete(key(x, y)); path.pop();
            return false;
        }

        for (const [fx, fy] of firsts) {
            if (!canPlace(W, H, occ, fx, fy, pf[0], pf[1])) continue;
            if (dfs(fx, fy, pf[0], pf[1])) return path;
            if (steps > budget) break;
        }
        return null;
    }

    /**
     * ものがたり めいろ。
     * story … { parts: [ 'もじ', { ok: 'ただしい', ng: 'まちがい' }, ... ] }
     * かえす … { W, H, cells: Map('x,y' → {ch, kind:'main'|'ng', idx}), main:[[x,y]], branches:[{at, cells, text}] }
     */
    function storyMaze(story, W, H, rng, tries = 400) {
        const main = [];          /* ただしい もじ */
        const forks = [];         /* { at: main の なんばんめの あとで わかれるか, text } */
        for (const p of story.parts) {
            if (typeof p === 'string') main.push(...chars(p));
            else {
                forks.push({ at: main.length - 1, text: chars(p.ng) });
                main.push(...chars(p.ok));
            }
        }
        for (let t = 0; t < tries; t++) {
            const occ = new Set();
            const path = growPath(W, H, occ, { start: [0, 0], len: main.length, budget: 4000 }, rng);
            if (!path) continue;
            const branches = [];
            let ok = true;
            for (const f of forks) {
                const b = growPath(W, H, occ, { from: path[f.at], len: f.text.length, budget: 3000 }, rng);
                if (!b) { ok = false; break; }
                branches.push({ at: f.at, cells: b, text: f.text });
            }
            if (!ok) continue;
            const cells = new Map();
            path.forEach(([x, y], i) => cells.set(key(x, y), { ch: main[i], kind: 'main', idx: i }));
            branches.forEach((b, bi) => b.cells.forEach(([x, y], i) =>
                cells.set(key(x, y), { ch: b.text[i], kind: 'ng', idx: i, branch: bi })));
            return { W, H, cells, main: path, branches, text: main.join('') };
        }
        return null;
    }

    /** おはなし めいろの マスの かず（よこ・たて）。aspect は つかえる ところの よこ÷たて */
    function mazeDims(total, aspect) {
        const area = total * 2.6;
        const W = Math.max(9, Math.min(14, Math.round(Math.sqrt(area * aspect))));
        return [W, Math.max(7, Math.ceil(area / W))];
    }

    /** けいさん めいろ の みち（ひだりうえ → みぎした） */
    function cornerPath(W, H, minLen, rng, tries = 300) {
        for (let t = 0; t < tries; t++) {
            const occ = new Set();
            const p = growPath(W, H, occ, { start: [0, 0], end: [W - 1, H - 1], len: minLen, maxLen: minLen + 12, budget: 6000 }, rng);
            if (p) return p;
        }
        return null;
    }

    /* ---------- けいさん めいろ の しき ---------- */

    /** こたえが ans に なる しき（a ＋ b など）を 1つ */
    function makeExpr(level, ans, rng) {
        const ops = level.ops;
        for (let t = 0; t < 60; t++) {
            const op = rng.pick(ops);
            if (op === '+') {
                const a = rng.int(Math.max(0, ans - level.max), Math.min(ans, level.max));
                const b = ans - a;
                if (a < level.min || b < level.min || b > level.max) continue;
                return { text: `${a}＋${b}`, value: ans };
            }
            if (op === '-') {
                const b = rng.int(level.min, level.max);
                const a = ans + b;
                if (a > level.maxA) continue;
                return { text: `${a}－${b}`, value: ans };
            }
            if (op === '×') {
                const fs = [];
                for (let a = 1; a <= 9; a++) if (ans % a === 0 && ans / a >= 1 && ans / a <= 9) fs.push(a);
                if (!fs.length) continue;
                const a = rng.pick(fs);
                return { text: `${a}×${ans / a}`, value: ans };
            }
            if (op === '÷') {
                const b = rng.int(2, 9);
                if (ans < 1 || ans > 9) continue;
                return { text: `${ans * b}÷${b}`, value: ans };
            }
        }
        return null;
    }

    /** まよわせる しき（こたえが target に ちかいけど ちがう） */
    function makeDecoy(level, target, rng) {
        for (let t = 0; t < 60; t++) {
            let v = target + rng.pick([-3, -2, -1, 1, 2, 3, -1, 1]);
            if (level.ops.includes('×') && rng.next() < 0.5) v = rng.int(2, 9) * rng.int(2, 9);
            if (v < 0 || v === target) continue;
            const e = makeExpr(level, v, rng);
            if (e) return e;
        }
        return { text: `${target + 1}＋0`, value: target + 1 };
    }

    /* ---------- ことば さがし ---------- */

    const WS_DIRS = { easy: [[1, 0], [0, 1]], mid: [[1, 0], [0, 1], [1, 1]], hard: [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1]] };

    function wordSearch(words, W, H, dirsName, filler, rng, tries = 200) {
        const dirs = WS_DIRS[dirsName] || WS_DIRS.easy;
        for (let t = 0; t < tries; t++) {
            const grid = Array.from({ length: H }, () => Array(W).fill(''));
            const placed = [];
            let ok = true;
            /* ながい ことばから おく */
            const order = rng.shuffle(words).sort((a, b) => chars(b.word).length - chars(a.word).length);
            for (const w of order) {
                const cs = chars(w.word);
                let done = false;
                for (let k = 0; k < 200 && !done; k++) {
                    const [dx, dy] = rng.pick(dirs);
                    const x0 = rng.int(0, W - 1), y0 = rng.int(0, H - 1);
                    const xe = x0 + dx * (cs.length - 1), ye = y0 + dy * (cs.length - 1);
                    if (xe < 0 || ye < 0 || xe >= W || ye >= H) continue;
                    let fit = true;
                    for (let i = 0; i < cs.length; i++) {
                        const g = grid[y0 + dy * i][x0 + dx * i];
                        if (g && g !== cs[i]) { fit = false; break; }
                    }
                    if (!fit) continue;
                    for (let i = 0; i < cs.length; i++) grid[y0 + dy * i][x0 + dx * i] = cs[i];
                    placed.push({ ...w, x: x0, y: y0, dx, dy, len: cs.length });
                    done = true;
                }
                if (!done) { ok = false; break; }
            }
            if (!ok) continue;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!grid[y][x]) grid[y][x] = rng.pick(filler);
            /* ぐうぜん おなじ ことばが 2かい できて いないか */
            if (placed.some(p => countWord(grid, p.word, dirs) !== 1)) continue;
            return { grid, placed };
        }
        return null;
    }

    /** grid の 中に word が いくつ あるか（おなじ マスの ならびを ぎゃくから よんだ ものは 1つと かぞえる） */
    function countWord(grid, word, dirs) {
        const cs = chars(word), H = grid.length, W = grid[0].length;
        const found = new Set();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of dirs) {
            let ok = true;
            for (let i = 0; i < cs.length && ok; i++) {
                const xx = x + dx * i, yy = y + dy * i;
                if (xx < 0 || yy < 0 || xx >= W || yy >= H || grid[yy][xx] !== cs[i]) ok = false;
            }
            if (ok) {
                const a = key(x, y), b = key(x + dx * (cs.length - 1), y + dy * (cs.length - 1));
                found.add([a, b].sort().join('|'));
            }
        }
        return found.size;
    }

    /* ---------- まほうじん ---------- */

    const LO_SHU = [[2, 7, 6], [9, 5, 1], [4, 3, 8]];

    function symmetries(g) {
        const n = g.length, out = [];
        let cur = g;
        for (let r = 0; r < 4; r++) {
            cur = cur.map((row, y) => row.map((_, x) => cur[n - 1 - x][y]));
            out.push(cur, cur.map(row => row.slice().reverse()));
        }
        return out;
    }

    function isMagic(g) {
        const n = g.length, s = g[0].reduce((a, b) => a + b, 0);
        for (let i = 0; i < n; i++) {
            if (g[i].reduce((a, b) => a + b, 0) !== s) return false;
            if (g.reduce((a, r) => a + r[i], 0) !== s) return false;
        }
        let d1 = 0, d2 = 0;
        for (let i = 0; i < n; i++) { d1 += g[i][i]; d2 += g[i][n - 1 - i]; }
        return d1 === s && d2 === s;
    }

    function permutations(arr) {
        if (arr.length <= 1) return [arr.slice()];
        const out = [];
        arr.forEach((v, i) => {
            for (const p of permutations(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([v, ...p]);
        });
        return out;
    }

    /** あなあきの まほうじんの こたえの かず（つかう かずは きまって いる） */
    function magicSolutions(grid, holes, values) {
        let n = 0;
        for (const p of permutations(values)) {
            const g = grid.map(r => r.slice());
            holes.forEach(([x, y], i) => { g[y][x] = p[i]; });
            if (isMagic(g)) n++;
            if (n > 1) break;
        }
        return n;
    }

    function magicSquare(blanks, offset, rng) {
        const base = rng.pick(symmetries(LO_SHU)).map(r => r.map(v => v + offset));
        for (let t = 0; t < 200; t++) {
            const cellsAll = [];
            for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cellsAll.push([x, y]);
            const holes = rng.sample(cellsAll, blanks);
            const vals = holes.map(([x, y]) => base[y][x]);
            const g = base.map(r => r.slice());
            holes.forEach(([x, y]) => { g[y][x] = null; });
            if (magicSolutions(g, holes, vals) === 1) {
                return { answer: base, puzzle: g, holes, sum: base[0].reduce((a, b) => a + b, 0), values: base.flat().sort((a, b) => a - b) };
            }
        }
        return null;
    }

    /* ---------- かずの ピラミッド ---------- */

    /** rows[0] が いちばん した。rows[r][i] = rows[r-1][i] + rows[r-1][i+1] */
    function pyramidFrom(base) {
        const rows = [base.slice()];
        while (rows[rows.length - 1].length > 1) {
            const p = rows[rows.length - 1];
            rows.push(p.slice(1).map((v, i) => p[i] + v));
        }
        return rows;
    }

    /** わかって いる マスから たし算・ひき算で ぜんぶ うめられるか */
    function pyramidSolvable(rows, known) {
        const k = known.map(r => r.slice());
        let changed = true;
        while (changed) {
            changed = false;
            for (let r = 1; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) {
                const c = k[r][i], a = k[r - 1][i], b = k[r - 1][i + 1];
                const cnt = (c ? 1 : 0) + (a ? 1 : 0) + (b ? 1 : 0);
                if (cnt === 2) { k[r][i] = k[r - 1][i] = k[r - 1][i + 1] = true; changed = true; }
            }
        }
        return k.every(r => r.every(Boolean));
    }

    function pyramid(n, lo, hi, mode, rng) {
        const base = Array.from({ length: n }, () => rng.int(lo, hi));
        const rows = pyramidFrom(base);
        let known = rows.map(r => r.map(() => true));
        if (mode === 'add') {
            known = rows.map((r, ri) => r.map(() => ri === 0));
        } else {
            const all = [];
            rows.forEach((r, ri) => r.forEach((_, i) => all.push([ri, i])));
            const target = Math.ceil(all.length * (mode === 'hard' ? 0.72 : 0.6));
            let hidden = 0;
            for (const [ri, i] of rng.shuffle(all)) {
                if (hidden >= target) break;
                known[ri][i] = false;
                if (pyramidSolvable(rows, known)) hidden++;
                else known[ri][i] = true;
            }
        }
        return { rows, known };
    }

    /* ---------- ナンプレ（4×4・6×6） ---------- */

    function sudokuDims(n) { return n === 6 ? [3, 2] : n === 9 ? [3, 3] : [2, 2]; }   /* [よこ, たて] */

    function sudokuCandidates(g, n, x, y) {
        const [bw, bh] = sudokuDims(n);
        const used = new Set();
        for (let i = 0; i < n; i++) { used.add(g[y][i]); used.add(g[i][x]); }
        const bx = x - x % bw, by = y - y % bh;
        for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) used.add(g[yy][xx]);
        const c = [];
        for (let v = 1; v <= n; v++) if (!used.has(v)) c.push(v);
        return c;
    }

    function sudokuCount(g0, n, limit = 2) {
        const g = g0.map(r => r.slice());
        let count = 0;
        (function solve() {
            if (count >= limit) return;
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!g[y][x]) {
                for (const v of sudokuCandidates(g, n, x, y)) { g[y][x] = v; solve(); g[y][x] = 0; }
                return;
            }
            count++;
        })();
        return count;
    }

    function sudokuFull(n, rng) {
        const g = Array.from({ length: n }, () => Array(n).fill(0));
        (function fill(i) {
            if (i === n * n) return true;
            const x = i % n, y = Math.floor(i / n);
            for (const v of rng.shuffle(sudokuCandidates(g, n, x, y))) {
                g[y][x] = v;
                if (fill(i + 1)) return true;
            }
            g[y][x] = 0;
            return false;
        })(0);
        return g;
    }

    function sudoku(n, clues, rng) {
        const answer = sudokuFull(n, rng);
        const puzzle = answer.map(r => r.slice());
        const all = [];
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) all.push([x, y]);
        let left = n * n;
        for (const [x, y] of rng.shuffle(all)) {
            if (left <= clues) break;
            const v = puzzle[y][x];
            puzzle[y][x] = 0;
            if (sudokuCount(puzzle, n) === 1) left--;
            else puzzle[y][x] = v;
        }
        return { answer, puzzle };
    }

    /* ---------- てん つなぎ（うつす） ---------- */

    function dotFigure(n, segs, diag, rng) {
        const dirs = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : DIR4;
        for (let t = 0; t < 100; t++) {
            const used = new Set(), lines = [];
            let x = rng.int(0, n - 1), y = rng.int(0, n - 1);
            for (let k = 0; k < segs * 4 && lines.length < segs; k++) {
                const [dx, dy] = rng.pick(dirs);
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
                const s = [key(x, y), key(nx, ny)].sort().join('|');
                /* ななめどうしが まじわる（×）のは みにくいので さける */
                if (used.has(s)) { x = nx; y = ny; continue; }
                if (dx && dy) {
                    const cross = [key(x + dx, y), key(x, y + dy)].sort().join('|');
                    if (used.has(cross)) continue;
                }
                used.add(s);
                lines.push([x, y, nx, ny]);
                x = nx; y = ny;
                /* ときどき べつの てんから はじめる（ひと ふでで ない かたち） */
                if (rng.next() < 0.12) { const e = rng.pick(lines); x = e[0]; y = e[1]; }
            }
            if (lines.length === segs) return lines;
        }
        return [];
    }

    function transformLines(lines, n, mode) {
        const f = mode === 'mirror' ? (x, y) => [n - 1 - x, y]
            : mode === 'rotate' ? (x, y) => [n - 1 - x, n - 1 - y]
                : mode === 'flip' ? (x, y) => [x, n - 1 - y]
                    : (x, y) => [x, y];
        return lines.map(([a, b, c, d]) => [...f(a, b), ...f(c, d)]);
    }

    /* ---------- まちがい さがし ---------- */

    function differences(W, H, pool, k, rng) {
        const left = Array.from({ length: H }, () => Array.from({ length: W }, () => rng.pick(pool)));
        const right = left.map(r => r.slice());
        const all = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push([x, y]);
        const spots = [];
        for (const [x, y] of rng.shuffle(all)) {
            if (spots.length >= k) break;
            /* となりあわない ように */
            if (spots.some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1)) continue;
            const others = pool.filter(p => p !== left[y][x]);
            right[y][x] = rng.pick(others);
            spots.push([x, y]);
        }
        return { left, right, spots };
    }

    /* ---------- きごう さがし ---------- */

    /** 1ぎょうの ならびと こたえ。skipAfter が あると「その きごうの すぐ みぎの target は かぞえない」 */
    function symbolRow(len, pool, target, rng, skipAfter) {
        for (let t = 0; t < 50; t++) {
            const row = Array.from({ length: len }, () => rng.next() < 0.3 ? target : rng.pick(pool));
            const count = countSymbols(row, target, skipAfter);
            if (count >= 2 && count <= len / 2) return { row, count };
        }
        const row = Array.from({ length: len }, (_, i) => i % 3 === 0 ? target : pool[0]);
        return { row, count: countSymbols(row, target, skipAfter) };
    }

    function countSymbols(row, target, skipAfter) {
        let n = 0;
        row.forEach((s, i) => { if (s === target && !(skipAfter && row[i - 1] === skipAfter)) n++; });
        return n;
    }

    /* ---------- はんぶんの え ---------- */

    function isSymmetric(rows) {
        return rows.every(r => r === r.split('').reverse().join(''));
    }

    /** ランダムな さゆう たいしょうの かたち（1つながり） */
    function randomHalfPicture(W, H, rng, fill = 0.5) {
        const half = Math.ceil(W / 2);
        for (let t = 0; t < 50; t++) {
            const g = Array.from({ length: H }, () => Array(half).fill(false));
            /* まん中から そだてる */
            const q = [[half - 1, Math.floor(H / 2)]];
            g[q[0][1]][q[0][0]] = true;
            let n = 1;
            const goal = Math.floor(half * H * fill);
            while (n < goal) {
                const [x, y] = rng.pick(q);
                const [dx, dy] = rng.pick(DIR4);
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 1 || nx >= half || ny >= H - 1 || g[ny][nx]) continue;
                g[ny][nx] = true; q.push([nx, ny]); n++;
            }
            const rows = g.map(r => {
                const left = r.map(v => v ? 'k' : '.').join('');
                const right = left.split('').reverse().join('');
                return W % 2 ? left + right.slice(1) : left + right;
            });
            return rows;
        }
        return null;
    }

    /* ---------- あたまの もじ ---------- */

    /** そのもじで はじまる ことば（word 自身は のぞく） */
    function headWords(dict, ch, except) {
        return dict.filter(d => d.word !== except && moraSplit(toHira(d.word))[0][0] === ch && !SMALL.includes(ch));
    }

    /** word を「あたまの もじ」で つくれるか。できれば えらんだ ことばを かえす */
    function headQuiz(dict, word, rng) {
        const cs = chars(toHira(word));
        const out = [];
        for (const c of cs) {
            if (SMALL.includes(c) || c === 'ー' || c === 'ん' || c === 'っ') return null;
            const cand = headWords(dict, c, word).filter(d => !out.includes(d));
            if (!cand.length) return null;
            out.push(rng.pick(cand));
        }
        return out;
    }

    /* ---------- ならびかえ ---------- */

    function scramble(word, rng) {
        const ms = moraSplit(word);
        if (ms.length < 2 || new Set(ms).size < 2) return ms;
        for (let t = 0; t < 30; t++) {
            const s = rng.shuffle(ms);
            if (s.join('') !== ms.join('')) return s;
        }
        return ms.slice().reverse();
    }

    /* ---------- つづきを かこう ---------- */

    /** つづきを かこう 用の くねくね せん（0〜100 の はこの 中）。kind を きめると その かたち */
    const SQUIGGLE_KINDS = 8;
    function squiggle(rng, kind = rng.int(0, SQUIGGLE_KINDS - 1)) {
        const y = rng.int(40, 60), a = rng.int(14, 22);
        switch (kind) {
            case 0: return `M10 ${y} q 10 ${-a} 20 0 t 20 0 t 20 0 t 20 0`;                         /* なみ */
            case 1: { const r = rng.int(22, 30); return `M${50 - r} 55 a ${r} ${r} 0 1 1 ${r} ${r}`; }   /* まるの いちぶ */
            case 2: return `M12 ${y + 10} l 13 -22 l 13 22 l 13 -22 l 13 22 l 13 -22`;             /* ぎざぎざ */
            case 3: return 'M22 82 C 18 18, 82 82, 78 18';                                        /* S の じ */
            case 4: return 'M50 50 a 4 4 0 0 1 8 0 a 8 8 0 0 1 -16 0 a 12 12 0 0 1 24 0 a 16 16 0 0 1 -32 0 a 20 20 0 0 1 40 0'; /* うずまき */
            case 5: return `M14 ${y + 8} a 12 12 0 0 1 24 0 a 12 12 0 0 1 24 0 a 12 12 0 0 1 24 0`; /* もこもこ */
            case 6: return 'M22 76 L50 22 L78 76';                                                /* やま */
            default: return 'M32 44 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 M68 44 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'; /* まる 2つ */
        }
    }

    const api = {
        makeRng, hashSeed, moraSplit, toHira, chars, SMALL,
        canPlace, growPath, storyMaze, mazeDims, cornerPath, makeExpr, makeDecoy,
        wordSearch, countWord, WS_DIRS,
        LO_SHU, symmetries, isMagic, magicSolutions, magicSquare,
        pyramidFrom, pyramidSolvable, pyramid,
        sudokuCandidates, sudokuCount, sudokuFull, sudoku, sudokuDims,
        dotFigure, transformLines, differences, symbolRow, countSymbols,
        isSymmetric, randomHalfPicture, headWords, headQuiz, scramble, squiggle, SQUIGGLE_KINDS,
    };
    root.PurintoGen = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
