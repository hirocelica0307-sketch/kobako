/* かさ はかせ ── 画面を つかわない きまり
   もんだいの つくりかた・こたえの たしかめ・まちがいかたに あわせた ことば を ここに まとめます。
   かさは すべて mL の 整数で もちます（1L ＝ 1000mL・1dL ＝ 100mL）。
   tests.js が この ファイルだけを 読みこんで たしかめます（ブラウザでも node でも うごく）。 */
(function (root) {
    'use strict';

    const L = 1000, DL = 100;

    /* ---------- べんり ---------- */
    const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
    function shuffle(rng, arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function pickWeighted(rng, list) {
        const sum = list.reduce((s, x) => s + x.w, 0);
        let r = rng() * sum;
        for (const x of list) { if ((r -= x.w) < 0) return x; }
        return list[list.length - 1];
    }

    /** 1300 → "1L3dL"・2000 → "2L"・300 → "3dL"（100mL の ばいすう だけ） */
    function ldl(ml) {
        const a = Math.floor(ml / L), b = Math.round((ml % L) / DL);
        if (a && b) return a + 'L' + b + 'dL';
        if (a) return a + 'L';
        return b + 'dL';
    }
    /** ml を えらんだ たんいで あらわす（"13dL"・"1300mL"・"2L"） */
    function inUnit(ml, u) {
        if (u === 'L&dL') return ldl(ml);
        return (ml / UNIT_ML[u]) + u;
    }
    const UNIT_ML = { L: L, dL: DL, mL: 1 };


    /* ---------- ますの ならび（画面で えがく もと） ----------
       item ＝ { cap: 'L' | 'Lml' | 'dL', ml: 入って いる 水, from?: はじめの 水 }
       'L' は 1Lます（目もりは dL）、'Lml' は 1Lます（目もりを mL で よむ）、'dL' は 1dLます。 */
    /** 1Lますを つかって ならべる（いっぱいの ます ＋ のこりの ます） */
    function rowL(ml, cap) {
        const items = [];
        let rest = ml;
        while (rest > 0) { const v = Math.min(L, rest); items.push({ cap: cap || 'L', ml: v }); rest -= v; }
        if (!items.length) items.push({ cap: cap || 'L', ml: 0 });
        return items;
    }
    /** 1Lますで いっぱいの 分 ＋ 1dLます の ならび */
    function rowLdLcups(ml) {
        const a = Math.floor(ml / L), b = Math.round((ml % L) / DL);
        const items = [];
        for (let i = 0; i < a; i++) items.push({ cap: 'L', ml: L });
        for (let i = 0; i < b; i++) items.push({ cap: 'dL', ml: DL });
        return items;
    }
    /** from → to に かわる 1Lますの ならび（ふやす・へらす ときに つかう） */
    function rowChange(from, to) {
        const n = Math.max(1, Math.ceil(Math.max(from, to) / L));
        const items = [];
        for (let i = 0; i < n; i++) {
            const f = Math.max(0, Math.min(L, from - i * L));
            const t = Math.max(0, Math.min(L, to - i * L));
            items.push({ cap: 'L', ml: t, from: f });
        }
        return items;
    }
    function rowDLChange(from, to) {
        const n = Math.max(from, to) / DL;
        const items = [];
        for (let i = 0; i < n; i++) items.push({ cap: 'dL', ml: i * DL < to ? DL : 0, from: i * DL < from ? DL : 0 });
        return items;
    }

    /* ==================== もんだいの しゅるい ==================== */
    /* 1つの もんだい（q）の かたち
       { mode, kind, key, text, sub?, ask: 'fields'|'choice'|'build'|'count',
         fields?: [{u, v}]   … □ に 入れる 数（u は たんい）
         choices?: [{id, label}], answer?: id
         target?: ml（つくる）
         scene  … はじめに 見せる 図（そそぐ アニメーション）
         after  … こたえた あとに 見せる 図
         hint, explain } */

    function fieldsOf(ml, units) {
        let rest = ml;
        return units.map(u => {
            const v = Math.floor(rest / UNIT_ML[u]);
            rest -= v * UNIT_ML[u];
            return { u, v };
        });
    }

    /* ---------- ① はかろう（よみとり） ---------- */
    const HAKARU = [
        { id: 'h-dl', w: 2, make(rng) {
            const n = rint(rng, 2, 9);
            return {
                key: 'h-dl:' + n,
                text: '水の かさは 何dL ですか。',
                ask: 'fields', fields: [{ u: 'dL', v: n }],
                scene: { type: 'masu', rows: [rowLdLcups(n * DL)] },
                hint: '1dLますで 何ばい分かな？ 1つずつ かぞえて みよう。',
                explain: `1dLますで ${n}はい分 だから ${n}dL。`,
            };
        } },
        { id: 'h-ldl-cups', w: 2, make(rng) {
            const a = rint(rng, 1, 3), b = rint(rng, 1, 8), ml = a * L + b * DL;
            return {
                key: 'h-ldl-cups:' + ml,
                text: '水の かさは 何L何dL ですか。',
                ask: 'fields', fields: fieldsOf(ml, ['L', 'dL']),
                scene: { type: 'masu', rows: [rowLdLcups(ml)] },
                hint: '大きい ますは 1Lます、小さい ますは 1dLます だよ。',
                explain: `1Lますで ${a}はい、1dLますで ${b}はい だから ${ldl(ml)}。`,
            };
        } },
        { id: 'h-ldl-scale', w: 3, make(rng) {
            const a = rint(rng, 1, 3), b = rint(rng, 1, 9), ml = a * L + b * DL;
            return {
                key: 'h-ldl-scale:' + ml,
                text: '水の かさは 何L何dL ですか。',
                ask: 'fields', fields: fieldsOf(ml, ['L', 'dL']),
                scene: { type: 'masu', rows: [rowL(ml)] },
                hint: '1Lますの 小さい 目もり 1つ分は 1dL。目もりは 10こで 1L だよ。',
                explain: `いっぱいの 1Lますが ${a}はい（${a}L）、のこりが 目もり ${b}こ分（${b}dL）で ${ldl(ml)}。`,
            };
        } },
        { id: 'h-ml', w: 2, ml: true, make(rng) {
            const k = rint(rng, 1, 9), ml = k * DL;
            return {
                key: 'h-ml:' + ml,
                text: '水の かさは 何mL ですか。',
                ask: 'fields', fields: [{ u: 'mL', v: ml }],
                scene: { type: 'masu', rows: [[{ cap: 'Lml', ml }]] },
                hint: '1L ＝ 1000mL。目もり 10こで 1000mL だから、目もり 1つは 100mL だよ。',
                explain: `目もり 1つは 100mL。目もり ${k}こ分 だから ${ml}mL。`,
            };
        } },
    ];

    /* ---------- ② たんいを かえよう（1L＝10dL・1L＝1000mL・1dL＝100mL） ---------- */
    const KAERU = [
        { id: 'k-l2dl', w: 2, make(rng) {
            const a = rint(rng, 1, 4), ml = a * L;
            return {
                key: 'k-l2dl:' + a,
                text: `${a}L は 何dL ですか。`,
                ask: 'fields', fields: [{ u: 'dL', v: a * 10 }],
                scene: { type: 'masu', rows: [rowL(ml)] },
                hint: '1L ＝ 10dL。1Lますには 目もりが 10こ あるね。',
                explain: `1L ＝ 10dL。${a}L は 10dL の ${a}こ分で ${a * 10}dL。`,
                diag(ans) {
                    if (ans[0] === a * 100) return '1L は 10dL だよ（1000 に なるのは mL の とき）。';
                    if (ans[0] === a) return 'L と dL では 数が かわるよ。1L ＝ 10dL だね。';
                    return null;
                },
            };
        } },
        { id: 'k-ldl2dl', w: 3, make(rng) {
            const a = rint(rng, 1, 4), b = rint(rng, 1, 9), ml = a * L + b * DL;
            return {
                key: 'k-ldl2dl:' + ml,
                text: `${ldl(ml)} は 何dL ですか。`,
                ask: 'fields', fields: [{ u: 'dL', v: a * 10 + b }],
                scene: { type: 'masu', rows: [rowL(ml)] },
                hint: `まず ${a}L が 何dL か かんがえよう。1L ＝ 10dL だよ。`,
                explain: `${a}L ＝ ${a * 10}dL。${a * 10}dL と ${b}dL で ${a * 10 + b}dL。`,
                diag(ans) {
                    const v = ans[0];
                    if (v === a + b) return `1L は 1dL では ないよ。1L ＝ 10dL だから ${a}L ＝ ${a * 10}dL。`;
                    if (v === a * 10) return `のこりの ${b}dL も わすれずに たそう。`;
                    if (v === a * 100 + b || v === Number(String(a) + '0' + b)) return '1L ＝ 10dL だよ。10dL の まとまりが いくつ あるかな。';
                    return null;
                },
            };
        } },
        { id: 'k-dl2ldl', w: 3, make(rng) {
            const a = rint(rng, 1, 4), b = rint(rng, 1, 9), n = a * 10 + b, ml = n * DL;
            return {
                key: 'k-dl2ldl:' + n,
                text: `${n}dL は 何L何dL ですか。`,
                ask: 'fields', fields: fieldsOf(ml, ['L', 'dL']),
                scene: { type: 'masu', rows: [rowL(ml)] },
                hint: '10dL で 1L。10dL の まとまりは いくつ できるかな。',
                explain: `${n}dL は 10dL（＝1L）が ${a}こ と ${b}dL。だから ${ldl(ml)}。`,
                diag(ans) {
                    if (ans[0] === b && ans[1] === a) return 'L と dL が いれかわって いるよ。10dL の まとまりが L に なるよ。';
                    if (ans[0] === n) return `${n}L は とても 多いよ。10dL で 1L だね。`;
                    return null;
                },
            };
        } },
        { id: 'k-dl2l', w: 1, make(rng) {
            const a = rint(rng, 1, 5);
            return {
                key: 'k-dl2l:' + a,
                text: `${a * 10}dL は 何L ですか。`,
                ask: 'fields', fields: [{ u: 'L', v: a }],
                scene: { type: 'masu', rows: [rowL(a * L)] },
                hint: '10dL で 1L だよ。',
                explain: `10dL ＝ 1L。${a * 10}dL は 10dL の ${a}こ分で ${a}L。`,
                diag: ans => ans[0] === a * 10 ? `1L ＝ 10dL だから、${a * 10}dL は ${a * 10}L より ずっと すくないよ。` : null,
            };
        } },
        { id: 'k-l2ml', w: 2, ml: true, make(rng) {
            const a = rint(rng, 1, 3);
            return {
                key: 'k-l2ml:' + a,
                text: `${a}L は 何mL ですか。`,
                ask: 'fields', fields: [{ u: 'mL', v: a * 1000 }],
                scene: { type: 'masu', rows: [rowL(a * L, 'Lml')] },
                hint: '1L ＝ 1000mL だよ。',
                explain: `1L ＝ 1000mL。${a}L は ${a * 1000}mL。`,
                diag(ans) {
                    if (ans[0] === a * 100) return '1L は 1000mL だよ（100mL は 1dL）。';
                    if (ans[0] === a * 10) return '1L ＝ 10dL、1L ＝ 1000mL。mL の ときは 1000 だね。';
                    return null;
                },
            };
        } },
        { id: 'k-dl2ml', w: 2, ml: true, make(rng) {
            const n = rint(rng, 1, 9);
            return {
                key: 'k-dl2ml:' + n,
                text: `${n}dL は 何mL ですか。`,
                ask: 'fields', fields: [{ u: 'mL', v: n * 100 }],
                scene: { type: 'masu', rows: [rowLdLcups(n * DL)] },
                hint: '1dL ＝ 100mL。1dLます 1ぱいは 100mL だよ。',
                explain: `1dL ＝ 100mL。1dLます ${n}はい分で ${n * 100}mL。`,
                diag(ans) {
                    if (ans[0] === n * 10) return '1dL は 100mL だよ。';
                    if (ans[0] === n * 1000) return `1000mL は 1L。${n}dL は そんなに 多くないよ。1dL ＝ 100mL。`;
                    return null;
                },
            };
        } },
        { id: 'k-ml2dl', w: 2, ml: true, make(rng) {
            const n = rint(rng, 1, 9);
            return {
                key: 'k-ml2dl:' + n,
                text: `${n * 100}mL は 何dL ですか。`,
                ask: 'fields', fields: [{ u: 'dL', v: n }],
                scene: { type: 'masu', rows: [rowLdLcups(n * DL)] },
                hint: '100mL で 1dL だよ。100mL の まとまりは いくつかな。',
                explain: `100mL ＝ 1dL。${n * 100}mL は 100mL の ${n}こ分で ${n}dL。`,
                diag: ans => ans[0] === n * 100 ? '数は そのまま では ないよ。100mL で 1dL だね。' : null,
            };
        } },
        { id: 'k-ml2l', w: 1, ml: true, make(rng) {
            const a = rint(rng, 1, 2);
            return {
                key: 'k-ml2l:' + a,
                text: `${a * 1000}mL は 何L ですか。`,
                ask: 'fields', fields: [{ u: 'L', v: a }],
                scene: { type: 'masu', rows: [rowL(a * L, 'Lml')] },
                hint: '1000mL で 1L だよ。',
                explain: `1000mL ＝ 1L。${a * 1000}mL は ${a}L。`,
                diag: ans => ans[0] === a * 10 ? '10dL で 1L、1000mL で 1L だよ。' : null,
            };
        } },
    ];

    /* ---------- ③ どっちが おおい？（たんいを そろえて くらべる） ---------- */
    function compareQuestion(left, right, lu, ru) {
        const lt = inUnit(left, lu), rt = inUnit(right, ru);
        const answer = left > right ? 'left' : left < right ? 'right' : 'same';
        /* くらべる ための たんい（小さい ほう） */
        const order = ['L', 'L&dL', 'dL', 'mL'];
        const common = order.indexOf(lu) > order.indexOf(ru) ? lu : ru;
        const cu = common === 'L&dL' ? 'dL' : common === 'L' ? 'dL' : common;
        const lc = inUnit(left, cu), rc = inUnit(right, cu);
        const same = answer === 'same';
        const bigger = answer === 'left' ? lt : rt;
        const capL = Math.max(1, Math.ceil(Math.max(left, right) / L));
        const numL = parseInt(lt, 10), numR = parseInt(rt, 10);
        return {
            key: 'c:' + lt + '|' + rt,
            text: 'どちらが 多い ですか。',
            ask: 'choice',
            choices: [{ id: 'left', label: lt }, { id: 'same', label: 'おなじ' }, { id: 'right', label: rt }],
            answer,
            scene: { type: 'compare', left, right, leftLabel: lt, rightLabel: rt, capL, pour: false },
            after: { type: 'compare', left, right, leftLabel: lt, rightLabel: rt, capL, pour: true },
            hint: `たんいが ちがうね。どちらも ${cu} に そろえて くらべよう。`,
            explain: [lc !== lt ? `${lt} ＝ ${lc}` : '', rc !== rt ? `${rt} ＝ ${rc}` : ''].filter(Boolean).join('、') +
                (lc !== lt || rc !== rt ? '。' : '') +
                (same ? 'おなじ かさ だね。' : `${bigger} の ほうが 多い。`),
            diag(id) {
                const pickedBigNum = (id === 'left' && numL > numR) || (id === 'right' && numR > numL);
                if (pickedBigNum) return '数が 大きい ほうが 多い とは かぎらないよ。たんいを そろえて くらべよう。';
                if (id === 'same' || same) return `たんいを そろえると ${lc} と ${rc} だよ。`;
                return null;
            },
        };
    }
    const KURABERU = [
        { id: 'c-dl-ml', w: 3, ml: true, make(rng) {
            const x = rint(rng, 2, 9) * DL;
            const y = x + pick(rng, [0, 0, -50, -20, 20, 50, -100, 100, -10, 30]);
            const sw = rng() < 0.5;
            return sw ? compareQuestion(y, x, 'mL', 'dL') : compareQuestion(x, y, 'dL', 'mL');
        } },
        { id: 'c-ldl-dl', w: 3, make(rng) {
            const v = rint(rng, 1, 2) * L + rint(rng, 0, 9) * DL;
            const w = v + pick(rng, [0, 0, -300, -200, -100, 100, 200, 300, 500]);
            const sw = rng() < 0.5;
            const vu = v % L ? 'L&dL' : 'L';
            return sw ? compareQuestion(w, v, 'dL', vu) : compareQuestion(v, w, vu, 'dL');
        } },
        { id: 'c-l-ml', w: 2, ml: true, make(rng) {
            const a = rint(rng, 1, 2) * L;
            const w = a + pick(rng, [0, -100, -200, 100, -50]);
            const sw = rng() < 0.5;
            return sw ? compareQuestion(w, a, 'mL', 'L') : compareQuestion(a, w, 'L', 'mL');
        } },
        { id: 'c-dl-ml-big', w: 1, ml: true, make(rng) {
            /* 8dL と 1000mL ・ 12dL と 1100mL など */
            const x = rint(rng, 7, 13) * DL;
            const y = pick(rng, [900, 1000, 1100, 1200]);
            const sw = rng() < 0.5;
            return sw ? compareQuestion(y, x, 'mL', 'dL') : compareQuestion(x, y, 'dL', 'mL');
        } },
    ];

    /* ---------- ④ どれくらい？（みのまわりの かさ・量感） ---------- */
    const THINGS = [
        { emoji: 'bathtub', name: 'おふろ', ml: 200 * L, unit: 'L' },
        { emoji: 'bucket', name: 'バケツ', ml: 8 * L, unit: 'L' },
        { emoji: 'pot-of-food', name: 'おなべ', ml: 3 * L, unit: 'L' },
        { emoji: 'teapot', name: 'ポット', ml: 1 * L, unit: 'L' },
        { emoji: 'glass-of-milk', name: 'コップ', ml: 2 * DL, unit: 'dL' },
        { emoji: 'hot-beverage', name: 'マグカップ', ml: 2 * DL, unit: 'dL' },
        { emoji: 'cup-with-straw', name: 'ジュースの カップ', ml: 3 * DL, unit: 'dL' },
        { emoji: 'bowl-with-spoon', name: 'おわん', ml: 2 * DL, unit: 'dL' },
        { emoji: 'teacup-without-handle', name: 'ゆのみ', ml: 1 * DL, unit: 'dL' },
        { emoji: 'beverage-box', name: 'ジュースの パック', ml: 200, unit: 'mL' },
        { emoji: 'baby-bottle', name: 'ほにゅうびん', ml: 200, unit: 'mL' },
        { emoji: 'spoon', name: 'スプーン', ml: 5, unit: 'mL', ask: 'スプーン 1ぱいの 水の かさは どれくらい？' },
    ];
    /** その かさを ますで 見せる 図 */
    function showAmount(ml, unit) {
        if (ml > 10 * L) {
            return { type: 'masu', rows: [rowL(10 * L)], caption: `1Lます 10ぱい。${ml / L}L は この ${ml / (10 * L)}ばい！` };
        }
        if (ml >= L) return { type: 'masu', rows: [rowL(ml)], caption: `1Lます ${ml / L}はい分` };
        if (ml >= DL) {
            return { type: 'masu', rows: [rowLdLcups(ml)],
                caption: unit === 'mL' ? `${ml}mL ＝ ${ml / DL}dL（1dLます ${ml / DL}はい分）` : `1dLます ${ml / DL}はい分` };
        }
        return { type: 'masu', rows: [[{ cap: 'dL', ml }]], caption: `1dLます（100mL）の ほんの すこし` };
    }
    const RYOUKAN = [
        { id: 'r-unit', w: 3, make(rng, opt) {
            const pool = THINGS.filter(t => opt.useMl || t.unit !== 'mL');
            const t = pick(rng, pool);
            const num = t.ml / UNIT_ML[t.unit];
            const units = opt.useMl ? ['L', 'dL', 'mL'] : ['L', 'dL'];
            const right = num + t.unit;
            return {
                key: 'r-unit:' + t.emoji,
                text: t.ask || `${t.name}に 入る 水の かさは どれくらい？`,
                ask: 'choice',
                choices: units.map(u => ({ id: num + u, label: num + u })),
                answer: right,
                scene: { type: 'thing', emoji: t.emoji, name: t.name },
                after: Object.assign(showAmount(t.ml, t.unit), { thing: t.emoji }),
                hint: '1Lます・1dLます を おもいだそう。1dLます は コップ 半分 くらい だよ。',
                explain: `${t.name}は ${right} くらい。`,
                diag(id) {
                    const u = id.replace(/^[0-9]+/, '');
                    if (u === 'L') return `${num}L は 1Lますで ${num}はい分 だよ。そんなに 入るかな？`;
                    if (u === 'dL') return `${num}dL は 1dLますで ${num}はい分 だよ。`;
                    if (u === 'mL') return `${num}mL は とても すこし。1dL が 100mL だよ。`;
                    return null;
                },
            };
        } },
        { id: 'r-cups', w: 2, make(rng, opt) {
            const pool = [
                { emoji: 'glass-of-milk', name: 'コップ', cup: 2 * DL, label: '2dL', target: L },
                { emoji: 'glass-of-milk', name: 'コップ', cup: 2 * DL, label: '2dL', target: 2 * L },
                { emoji: 'glass-of-milk', name: 'コップ', cup: 2 * DL, label: '2dL', target: 6 * DL },
                { emoji: 'teacup-without-handle', name: 'ゆのみ', cup: DL, label: '1dL', target: L },
                { emoji: 'cup-with-straw', name: 'ジュースの カップ', cup: 3 * DL, label: '3dL', target: 9 * DL },
                { emoji: 'masu-dl', name: '1dLます', cup: DL, label: '1dL', target: L },
                { emoji: 'masu-dl', name: '1dLます', cup: DL, label: '1dL', target: 2 * L },
                { emoji: 'beverage-box', name: 'ジュースの パック', cup: 200, label: '200mL', target: L, ml: true },
                { emoji: 'masu-dl', name: '1dLます', cup: DL, label: '1dL（100mL）', target: 5 * DL, tgtLabel: '500mL', ml: true },
            ].filter(p => opt.useMl || !p.ml);
            const p = pick(rng, pool);
            const n = p.target / p.cup;
            const tgt = p.tgtLabel || ldl(p.target);
            return {
                key: 'r-cups:' + p.name + p.target,
                text: `${tgt} の 水は、${p.name}（${p.label}）で 何ばい分 ですか。`,
                ask: 'fields', fields: [{ u: 'はい分', v: n }],
                scene: { type: 'thing', emoji: p.emoji, name: `${p.name}（${p.label}）`, target: p.target },
                after: { type: 'cupfill', emoji: p.emoji, cup: p.cup, n, target: p.target },
                hint: p.cup === 2 * DL ? '2dL ＋ 2dL ＋ 2dL … と たして いこう。1L ＝ 10dL だよ。'
                    : p.cup === 200 ? '200mL ＝ 2dL だよ。1L ＝ 10dL。' : '1L ＝ 10dL、1dL ＝ 100mL だよ。',
                explain: `${p.label} の ${n}はい分で ${tgt}。`,
            };
        } },
    ];

    /* ---------- ⑤ かさの けいさん（L は L どうし、dL は dL どうし） ---------- */
    function calcQuestion(a, b, op, units, key, rng) {
        const res = op === '+' ? a + b : a - b;
        const sym = op === '+' ? '＋' : '−';
        const show = v => units[0] === 'mL' ? v + 'mL' : ldl(v);
        const A = show(a), B = show(b), R = show(res);
        const story = op === '+'
            ? pick(rng, [`バケツに 水が ${A} あります。${B} 入れると、ぜんぶで 何${units.join('何')} ですか。`,
                `水そうに 水が ${A} あります。${B} たすと、何${units.join('何')} に なりますか。`])
            : pick(rng, [`やかんに 水が ${A} あります。${B} つかうと、のこりは 何${units.join('何')} ですか。`,
                `水とうに 水が ${A} あります。${B} のむと、のこりは 何${units.join('何')} ですか。`]);
        const A_ = fieldsOf(a, ['L', 'dL']), B_ = fieldsOf(b, ['L', 'dL']);
        const isDLcups = units.length === 1 && units[0] === 'dL';
        const isMl = units[0] === 'mL';
        let explain;
        if (units.length === 2) {
            const l = op === '+' ? A_[0].v + B_[0].v : A_[0].v - B_[0].v;
            const d = op === '+' ? A_[1].v + B_[1].v : A_[1].v - B_[1].v;
            explain = `L どうし ${A_[0].v}${sym}${B_[0].v}＝${l}、dL どうし ${A_[1].v}${sym}${B_[1].v}＝${d}。こたえは ${R}。`;
        } else {
            explain = `${A} ${sym} ${B} ＝ ${R}。`;
        }
        const scene = isDLcups
            ? { type: 'masu', rows: [rowLdLcups(a), rowLdLcups(b)], labels: [A, B], op: sym }
            : isMl ? { type: 'masu', rows: [[{ cap: 'Lml', ml: a }], [{ cap: 'Lml', ml: b }]], labels: [A, B], op: sym }
                : { type: 'masu', rows: [rowL(a), rowL(b)], labels: [A, B], op: sym };
        const after = isDLcups
            ? { type: 'masu', rows: [rowDLChange(a, res)], caption: (op === '+' ? 'あわせると ' : 'のこりは ') + R }
            : isMl ? { type: 'masu', rows: [[{ cap: 'Lml', ml: res, from: a }]], caption: (op === '+' ? 'あわせると ' : 'のこりは ') + R }
                : { type: 'masu', rows: [rowChange(a, res)], caption: (op === '+' ? 'あわせると ' : 'のこりは ') + R };
        return {
            key, text: story, sub: `${A} ${sym} ${B}`,
            ask: 'fields', fields: fieldsOf(res, units),
            scene, after,
            hint: units.length === 2 ? 'L は L どうし、dL は dL どうしで 計算しよう。' : 'おなじ たんい どうしだから、数を そのまま 計算できるよ。',
            explain,
            diag(ans) {
                if (units.length !== 2) return null;
                /* 3L5dL ＋ 2L を 3L7dL と する まちがい */
                if (B_[1].v === 0 && ans[0] === A_[0].v && ans[1] === (op === '+' ? A_[1].v + B_[0].v : A_[1].v - B_[0].v))
                    return `${B} は L だよ。L の ところで 計算しよう。`;
                if (B_[0].v === 0 && ans[1] === A_[1].v && ans[0] === (op === '+' ? A_[0].v + B_[1].v : A_[0].v - B_[1].v))
                    return `${B} は dL だよ。dL の ところで 計算しよう。`;
                return 'L は L どうし、dL は dL どうしで 計算しよう。';
            },
        };
    }
    const KEISAN = [
        { id: 'p-ldl-ldl', w: 3, make(rng) {
            const a = rint(rng, 1, 3), c = rint(rng, 1, 3), b = rint(rng, 1, 8), d = rint(rng, 1, 9 - b);
            return calcQuestion(a * L + b * DL, c * L + d * DL, '+', ['L', 'dL'], `p1:${a}${b}${c}${d}`, rng);
        } },
        { id: 'p-ldl-l', w: 2, make(rng) {
            const a = rint(rng, 1, 3), b = rint(rng, 1, 9), c = rint(rng, 1, 3);
            return calcQuestion(a * L + b * DL, c * L, '+', ['L', 'dL'], `p2:${a}${b}${c}`, rng);
        } },
        { id: 'p-ldl-dl', w: 2, make(rng) {
            const a = rint(rng, 1, 3), b = rint(rng, 1, 8), d = rint(rng, 1, 9 - b);
            return calcQuestion(a * L + b * DL, d * DL, '+', ['L', 'dL'], `p3:${a}${b}${d}`, rng);
        } },
        { id: 'p-dl-dl', w: 1, make(rng) {
            const b = rint(rng, 1, 7), d = rint(rng, 1, 9 - b);
            return calcQuestion(b * DL, d * DL, '+', ['dL'], `p4:${b}${d}`, rng);
        } },
        { id: 'm-ldl-ldl', w: 3, make(rng) {
            const a = rint(rng, 2, 4), c = rint(rng, 1, a - 1), b = rint(rng, 2, 9), d = rint(rng, 1, b - 1);
            return calcQuestion(a * L + b * DL, c * L + d * DL, '-', ['L', 'dL'], `m1:${a}${b}${c}${d}`, rng);
        } },
        { id: 'm-ldl-l', w: 2, make(rng) {
            const a = rint(rng, 2, 4), c = rint(rng, 1, a - 1), b = rint(rng, 1, 9);
            return calcQuestion(a * L + b * DL, c * L, '-', ['L', 'dL'], `m2:${a}${b}${c}`, rng);
        } },
        { id: 'm-ldl-dl', w: 2, make(rng) {
            const a = rint(rng, 1, 3), b = rint(rng, 2, 9), d = rint(rng, 1, b - 1);
            return calcQuestion(a * L + b * DL, d * DL, '-', ['L', 'dL'], `m3:${a}${b}${d}`, rng);
        } },
        { id: 'p-ml', w: 1, ml: true, make(rng) {
            const x = rint(rng, 1, 7), y = rint(rng, 1, 9 - x);
            return rng() < 0.5
                ? calcQuestion(x * 100, y * 100, '+', ['mL'], `p5:${x}${y}`, rng)
                : calcQuestion((x + y) * 100, y * 100, '-', ['mL'], `m5:${x}${y}`, rng);
        } },
    ];

    /* ---------- ⑥ ぴったり つくろう（1Lます・1dLますで 入れる） ---------- */
    /** 1300 → ['1Lます 1ぱい', '1dLます 3ばい'] */
    function buildParts(target) {
        const a = Math.floor(target / L), b = Math.round((target % L) / DL), parts = [];
        if (a) parts.push(`1Lます ${a}はい`);
        if (b) parts.push(`1dLます ${b}はい`);
        return parts;
    }
    function buildQuestion(target, label, key, hint) {
        const capL = Math.min(4, Math.max(2, Math.ceil(target / L) + 1));
        return {
            key, text: `水を ぴったり ${label} に しよう。`,
            ask: 'build', target, targetLabel: label,
            scene: { type: 'build', capL },
            hint,
            explain: (label !== ldl(target) ? `${label} ＝ ${ldl(target)}。` : '') + buildParts(target).join(' と ') + ` で ${label}。`,
        };
    }
    const TSUKURU = [
        { id: 't-ldl', w: 3, make(rng) {
            const ml = rint(rng, 1, 2) * L + rint(rng, 1, 9) * DL;
            return buildQuestion(ml, ldl(ml), 't1:' + ml, '1Lます で L の 分、1dLます で dL の 分を 入れよう。');
        } },
        { id: 't-dl', w: 1, make(rng) {
            const n = rint(rng, 3, 9);
            return buildQuestion(n * DL, n + 'dL', 't2:' + n, '1dLます で 入れよう。');
        } },
        { id: 't-dl-big', w: 2, make(rng) {
            const n = rint(rng, 11, 19);
            return buildQuestion(n * DL, n + 'dL', 't3:' + n, `10dL ＝ 1L。${n}dL は 何L何dL かな？`);
        } },
        { id: 't-ml', w: 2, ml: true, make(rng) {
            const n = rint(rng, 2, 9);
            return buildQuestion(n * 100, n * 100 + 'mL', 't4:' + n, '1dL ＝ 100mL。1dLます 1ぱいで 100mL だよ。');
        } },
    ];

    /* ==================== モード ==================== */
    const MODES = [
        { id: 'hakaru', name: 'はかろう', sub: 'ますで よみとる', emoji: 'pouring-liquid', kinds: HAKARU },
        { id: 'kaeru', name: 'たんいを かえよう', sub: '1L ＝ 10dL ＝ 1000mL', emoji: 'droplet', kinds: KAERU },
        { id: 'kuraberu', name: 'どっちが 多い？', sub: 'たんいを そろえて くらべる', emoji: 'glass-of-milk', kinds: KURABERU },
        { id: 'ryoukan', name: 'どれくらい？', sub: 'みのまわりの かさ', emoji: 'bathtub', kinds: RYOUKAN },
        { id: 'keisan', name: 'かさの 計算', sub: 'たし算・ひき算', emoji: 'teapot', kinds: KEISAN },
        { id: 'tsukuru', name: 'ぴったり つくろう', sub: 'ますで 水を 入れる', emoji: 'bucket', kinds: TSUKURU },
        { id: 'mix', name: 'ぜんぶ まぜる', sub: 'おすすめ', emoji: 'sparkles', kinds: null },
    ];
    const MIX_WEIGHTS = { hakaru: 2, kaeru: 3, kuraberu: 2, ryoukan: 2, keisan: 2, tsukuru: 1 };

    const modeById = id => MODES.find(m => m.id === id) || null;

    function kindsFor(mode, opt) {
        return mode.kinds.filter(k => opt.useMl || !k.ml);
    }

    /** 1もん つくる */
    function makeQuestion(modeId, rng, opt) {
        opt = Object.assign({ useMl: true }, opt);
        let mode = modeById(modeId);
        if (!mode) throw new Error('mode ' + modeId);
        if (mode.id === 'mix') {
            const ms = MODES.filter(m => m.kinds).map(m => ({ m, w: MIX_WEIGHTS[m.id] || 1 }));
            mode = pickWeighted(rng, ms).m;
        }
        const kind = pickWeighted(rng, kindsFor(mode, opt));
        const q = kind.make(rng, opt);
        q.mode = mode.id;
        q.kind = kind.id;
        return q;
    }

    /** 1かい分（n もん）。おなじ もんだいは 出さない */
    function makeRound(modeId, n, rng, opt) {
        const list = [], seen = new Set();
        let guard = 0;
        while (list.length < n && guard++ < n * 40) {
            const q = makeQuestion(modeId, rng, opt);
            if (seen.has(q.key)) continue;
            /* となりどうしで おなじ しゅるいが つづかない ように（できるだけ） */
            if (list.length && list[list.length - 1].kind === q.kind && guard < n * 20 && rng() < 0.6) continue;
            seen.add(q.key);
            list.push(q);
        }
        return list;
    }

    /* ==================== こたえの たしかめ ==================== */
    /** ans: fields → 数の 配列（入れて いない ところは null）・choice → id・build → 入れた mL
        → { ok, bad: [まちがえた わくの 番号], msg } */
    function check(q, ans) {
        if (q.ask === 'fields') {
            const bad = [];
            q.fields.forEach((f, i) => { if (ans[i] !== f.v) bad.push(i); });
            if (!bad.length) return { ok: true, bad, msg: '' };
            if (ans.some(v => v === null || v === undefined)) return { ok: false, bad, msg: 'まだ 入って いない ところが あるよ。', empty: true };
            return { ok: false, bad, msg: (q.diag && q.diag(ans)) || pick(Math.random, ['おしい！ もういちど 見て みよう。', 'ちがうよ。図を よく 見て みよう。']) };
        }
        if (q.ask === 'choice') {
            if (ans === q.answer) return { ok: true, bad: [], msg: '' };
            return { ok: false, bad: [ans], msg: (q.diag && q.diag(ans)) || 'ちがうよ。' };
        }
        if (q.ask === 'build') {
            if (ans === q.target) return { ok: true, bad: [], msg: '' };
            if (ans === 0) return { ok: false, bad: [], msg: 'まだ 水が 入って いないよ。', empty: true };
            const diff = Math.abs(ans - q.target);
            const d = q.targetLabel.endsWith('mL') && diff < L ? diff + 'mL' : ldl(diff);
            return { ok: false, bad: [], msg: ans > q.target ? `${d} 多いよ。` : `${d} たりないよ。` };
        }
        throw new Error('ask ' + q.ask);
    }

    /* ---------- ほめことば ---------- */
    const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！', 'かさ はかせ！', 'その ちょうし！'];
    const praise = rng => pick(rng, PRAISE);

    /** ほし の 数（はじめて こたえて あたった もんだい）から ひとこと */
    function resultWord(stars, n) {
        const r = n ? stars / n : 0;
        if (r === 1) return 'パーフェクト！ かさ はかせ だね！';
        if (r >= 0.8) return 'すごい！ もう すこしで パーフェクト！';
        if (r >= 0.5) return 'よく がんばったね！ もう 1かい やって みよう。';
        return 'まちがえた もんだいを 見なおして、もう 1かい！';
    }

    root.KasaLogic = {
        L, DL, UNIT_ML, MODES, THINGS, modeById, kindsFor,
        ldl, inUnit, fieldsOf, rowL, rowLdLcups, rowChange, rowDLChange,
        makeQuestion, makeRound, check, praise, resultWord, shuffle, rint, pick,
    };
})(typeof window !== 'undefined' ? window : globalThis);
