/* プリント＆カード こうぼう ── 九九・かけ算の プリント 10しゅるい
   ------------------------------------------------------------------
   sheets.js から make(h) で よばれて、SHEETS に くわわる。
   h … { both, esc, range, pathSvg, G（gen.js）, D（data.js） }
   どれも 1まいずつ ちがう もんだい（たね＝seed）・こたえの ページ つき（ゲームの ものは のぞく）。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    /* ---------- だんの えらびかた ---------- */
    const DAN_SETS = {
        '25': { label: '2〜5の だん', dans: [2, 3, 4, 5] },
        '69': { label: '6〜9の だん', dans: [6, 7, 8, 9] },
        'all': { label: 'ぜんぶの だん（1〜9）', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    };
    for (let n = 2; n <= 9; n++) DAN_SETS[String(n)] = { label: `${n}の だん だけ`, dans: [n] };
    const RANGE_KEYS = ['25', '69', 'all'];
    const danChoices = (keys = Object.keys(DAN_SETS)) => keys.map(k => [k, DAN_SETS[k].label]);
    const dansOf = k => (DAN_SETS[k] || DAN_SETS['25']).dans;

    /** だんの しき ぜんぶ（a の だん × 1〜9） */
    function exprsOf(dans) {
        const out = [];
        for (const a of dans) for (let b = 1; b <= 9; b++) out.push({ a, b, p: a * b, text: `${a}×${b}` });
        return out;
    }
    const uniq = arr => [...new Set(arr)];
    const productsOf = ex => uniq(ex.map(e => e.p)).sort((x, y) => x - y);
    /** 九九の こたえに でて くる かず（1〜81 の 36こ） */
    const KUKU_SET = new Set(productsOf(exprsOf([1, 2, 3, 4, 5, 6, 7, 8, 9])));

    /* ---------- あんごうの なぞなぞ（こたえは ひらがな） ---------- */
    const RIDDLES = [
        ['パンは パンでも たべられない パンは？', 'ふらいぱん'],
        ['うえから よんでも したから よんでも おなじ、あかい やさいは？', 'とまと'],
        ['かばんの なかに いる どうぶつは？', 'かば'],
        ['いすは いすでも つめたくて たべられる いすは？', 'あいす'],
        ['かいは かいでも のぼったり おりたり する かいは？', 'かいだん'],
        ['とりは とりでも ごみを あつめる とりは？', 'ちりとり'],
        ['たいは たいでも たたくと ドンドン なる たいは？', 'たいこ'],
        ['うしは うしでも あたまに かぶる うしは？', 'ぼうし'],
        ['いかは いかでも みずに うかべて のる いかは？', 'いかだ'],
        ['はちは はちでも はなを うえる はちは？', 'うえきばち'],
        ['くまは くまでも おちばを あつめる くまは？', 'くまで'],
        ['ふくは ふくでも よるに ホーホー なく ふくは？', 'ふくろう'],
        ['しろと くろの しましまの うまは？', 'しまうま'],
        ['かみは かみでも そらで ゴロゴロ なる かみは？', 'かみなり'],
        ['はなは はなでも よぞらに ドーンと さく はなは？', 'はなび'],
        ['さかなは さかなでも そらを およぐ さかなは？', 'こいのぼり'],
        ['くつは くつでも くつの まえに はく くつは？', 'くつした'],
        ['なつに なると ミーンミーンと なく むしは？', 'せみ'],
        ['あしが 8ぽん ある うみの いきものは？', 'たこ'],
        ['ねる ときに あたまの したに しく ものは？', 'まくら'],
        ['いつも あしもとに ついて くる、くろい もう ひとりの じぶんは？', 'かげ'],
        ['あめが やんだ あと、そらに かかる 7いろの はしは？', 'にじ'],
    ];
    const MESSAGES = ['くくのたつじん', 'よくできました', 'かけざんめいじん', 'がんばったね', 'きょうもにこにこ', 'そのちょうし', 'くくはともだち', 'すごいぞ'];
    /** ひょうに まぜる ダミーの もじ */
    const DUMMY_KANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん'.split('');

    function make(h) {
        const { both, esc, range, pathSvg, G, D } = h;

        /* ================================================================
           ① 九九 ぬりえ（かくれた え）
           ================================================================ */
        const nurie = {
            id: 'kuku-nurie', title: '九九 ぬりえ', icon: '🖍️',
            desc: 'マスの 九九を といて、こたえが きまった かずの マスだけ ぬると、かくれた えが でて くる。',
            options: [
                { key: 'dan', label: 'つかう だん', type: 'select', def: '25', choices: danChoices() },
                { key: 'rule', label: 'ぬる きまり', type: 'select', def: 'list', choices: [['list', 'ひょうの かずに なったら ぬる'], ['big', 'こたえが ○ いじょうなら ぬる']] },
                { key: 'pic', label: 'かくれる え', type: 'select', def: 'random', choices: [['random', 'くじで きめる'], ...D.HALF_PICS.map(p => [p.id, p.title]), ['shape', 'ふしぎな もよう']] },
            ],
            build(opt, rng) {
                const ex = exprsOf(dansOf(opt.dan));
                const ps = productsOf(ex);
                let pic = D.HALF_PICS.find(p => p.id === opt.pic);
                if (opt.pic === 'shape') pic = { title: 'ふしぎな もよう', rows: G.randomHalfPicture(10, 10, rng, 0.45) };
                if (!pic) pic = rng.pick(D.HALF_PICS);
                /* ぬる かず と ぬらない かず に わける（どちらも 2こ いじょう） */
                let paint, ruleText, key;
                if (opt.rule === 'big') {
                    const i = Math.max(1, Math.min(ps.length - 1, Math.floor(ps.length * (0.4 + rng.next() * 0.2))));
                    const t = ps[i];
                    paint = new Set(ps.filter(p => p >= t));
                    ruleText = `こたえが <b class="big">${t}</b> いじょうの マスを ぬろう。`;
                    key = `<div class="kn-key">ぬる マス：こたえが <b>${t}</b> いじょう</div>`;
                } else {
                    const n = Math.max(2, Math.min(ps.length - 2, Math.round(ps.length * 0.45)));
                    paint = new Set(rng.sample(ps, n));
                    ruleText = 'こたえが <b>したの ひょうの かず</b>に なったら、その マスを ぬろう。';
                    key = `<div class="kn-key">ぬる かず：${[...paint].sort((a, b) => a - b).map(p => `<span class="kn-chip">${p}</span>`).join('')}</div>`;
                }
                const yes = ex.filter(e => paint.has(e.p)), no = ex.filter(e => !paint.has(e.p));
                const W = pic.rows[0].length, H = pic.rows.length, cell = 17;
                const cells = pic.rows.map(r => r.split('').map(ch => {
                    const ink = ch !== '.';
                    return { ink, e: rng.pick(ink ? yes : no) };
                }));
                const grid = answer => `<div class="kn" style="grid-template-columns:repeat(${W},${cell}mm);grid-auto-rows:${cell}mm">
                    ${cells.map(r => r.map(c => `<div class="knc${answer && c.ink ? ' on' : ''}">${esc(c.e.text)}${answer ? `<small>${c.e.p}</small>` : ''}</div>`).join('')).join('')}</div>`;
                const name = '<div class="kn-name">なんの えが でて きたかな？ <span class="u"></span></div>';
                return both({
                    subject: 'sansu', catchline: '九九を といて えを さがそう！', title: '九九 ぬりえ', icon: '🖍️',
                    rules: [ruleText, 'ちがう こたえの マスは ぬらない（しろの まま）。', 'ぜんぶ ぬれたら、なんの えか かこう。'],
                }, key + grid(false) + name, key + grid(true) + `<div class="ans-text">こたえ：${esc(pic.title)}</div>`);
            },
        };

        /* ================================================================
           ② 九九 あんごう
           ================================================================ */
        const angou = {
            id: 'kuku-angou', title: '九九 あんごう', icon: '🔑',
            desc: '九九の こたえを あんごうひょうで もじに かえると、なぞなぞの こたえや ひみつの ことばが あらわれる。',
            options: [
                { key: 'dan', label: 'つかう だん', type: 'select', def: '25', choices: danChoices(RANGE_KEYS) },
            ],
            build(opt, rng) {
                const ex = exprsOf(dansOf(opt.dan));
                const ps = productsOf(ex);
                /* 3もん ＋ ひみつの ことば。もじの しゅるいが ひょうに おさまる くみあわせ */
                let qs = null;
                for (let t = 0; t < 300 && !qs; t++) {
                    const pick = [...rng.sample(RIDDLES, 3), ['さいごの ひみつの ことばは？', rng.pick(MESSAGES)]];
                    if (uniq(pick.flatMap(q => G.chars(q[1]))).length <= ps.length - 4) qs = pick;
                }
                if (!qs) qs = rng.sample(RIDDLES, 2);
                const chars = uniq(qs.flatMap(q => G.chars(q[1])));
                const nums = rng.shuffle(ps);
                const code = new Map(chars.map((c, i) => [c, nums[i]]));
                /* ダミーを まぜて ひょうを つくる */
                const extra = Math.min(nums.length - chars.length, Math.max(4, 20 - chars.length));
                const dummy = rng.shuffle(DUMMY_KANA.filter(k => !chars.includes(k)));
                const table = [...chars.map(c => [code.get(c), c]), ...range(extra).map(i => [nums[chars.length + i], dummy[i]])].sort((a, b) => a[0] - b[0]);
                const tableHtml = `<div class="ag-table"><div class="sub-h small">🔑 あんごう ひょう（こたえ → もじ）</div><div class="ag-codes">${table.map(([n, c]) => `<span class="ag-code"><b>${n}</b><i>${esc(c)}</i></span>`).join('')}</div></div>`;
                const byP = p => ex.filter(e => e.p === p);
                const prob = qs.map(([q, a]) => ({ q, a, cs: G.chars(a).map(c => ({ c, e: rng.pick(byP(code.get(c))) })) }));
                const block = answer => prob.map((pr, i) => `<div class="ag-q"><div class="ag-qt"><span class="qn">${i + 1}</span>${esc(pr.q)}</div>
                    <div class="ag-row">${pr.cs.map(x => `<div class="ag-box"><div class="ag-ex">${esc(x.e.text)}</div><div class="ag-num">${answer ? `<b class="red">${x.e.p}</b>` : ''}</div><div class="ag-ch">${answer ? `<b class="red">${esc(x.c)}</b>` : ''}</div></div>`).join('')}</div></div>`).join('');
                return both({
                    subject: 'sansu', catchline: '九九で ひみつの ことばを とこう！', title: '九九 あんごう', icon: '🔑',
                    rules: ['しきの こたえを まんなかの はこに かこう。', 'その かずを <b>あんごう ひょう</b>で さがして、もじを したの はこに かこう。', 'よこに よむと こたえが でて くるよ！'],
                }, tableHtml + block(false), tableHtml + block(true));
            },
        };

        /* ================================================================
           ③ 九九 ビンゴ
           ================================================================ */
        const bingo = {
            id: 'kuku-bingo', title: '九九 ビンゴ', icon: '🎯',
            desc: 'せんせいが よみあげた 九九の こたえに ○。ビンゴ カードと、せんせい よう よみあげ リスト（こたえの ページ）。',
            options: [
                { key: 'dan', label: 'つかう だん', type: 'select', def: '25', choices: danChoices() },
                { key: 'size', label: 'おおきさ', type: 'select', def: '4', choices: [['3', '3×3'], ['4', '4×4'], ['5', '5×5']] },
                { key: 'fill', label: 'カード', type: 'select', def: 'auto', choices: [['auto', 'かずが 入った カード（1まいずつ ちがう）'], ['self', 'かずを じぶんで かきこむ']] },
            ],
            build(opt, rng) {
                const ex = exprsOf(dansOf(opt.dan));
                const ps = productsOf(ex);
                let n = +opt.size || 4;
                while (n > 2 && n * n > ps.length) n--;
                const self = opt.fill === 'self';
                const nums = self ? [] : rng.sample(ps, n * n);
                const cell = Math.min(self ? 30 : 36, (self ? 115 : 150) / n);
                const card = `<div class="kb" style="grid-template-columns:repeat(${n},${cell}mm);grid-auto-rows:${cell}mm">${range(n * n).map(i => `<div class="kbc" style="font-size:${(cell * 0.42).toFixed(1)}mm">${self ? '' : nums[i]}</div>`).join('')}</div>`;
                const pool = self ? `<div class="kb-pool"><div class="sub-h small">この なかから ${n * n}こ えらんで、すきな ばしょに かこう</div>${ps.map(p => `<span class="kn-chip">${p}</span>`).join('')}</div>` : '';
                const memoN = self ? 6 : n >= 5 ? 9 : 12;
                const memo = `<div class="kb-memo"><div class="sub-h small">よみあげた 九九を かこう</div><div class="kb-lines">${range(memoN).map(i => `<div class="kb-line"><span class="kb-no">${i + 1}</span><span class="bx"></span>×<span class="bx"></span>＝<span class="bx w"></span></div>`).join('')}</div></div>`;
                const calls = rng.shuffle(ex);
                const list = `<div class="kb-calls"><div class="sub-h">📣 せんせい よう よみあげ リスト（${calls.length}こ・うえから じゅんに）</div>
                    <div class="kb-call-grid">${calls.map((e, i) => `<div class="kb-call"><span class="kb-no">${i + 1}</span><b>${e.text}</b><span>＝ ${e.p}</span><i>□</i></div>`).join('')}</div>
                    <p class="kb-note">よみあげたら □ に ✓。おなじ こたえ（3×4 と 2×6 など）が また でたら「もう ○が ついて いるね」と たしかめよう。</p></div>`;
                return both({
                    subject: 'sansu', catchline: 'よみあげた 九九の こたえを さがせ！', title: '九九 ビンゴ', icon: '🎯',
                    rules: [self ? 'したの かずから えらんで、カードの マスに かこう。' : 'カードの かずを よく みよう。',
                        'せんせいが「しち はち」の ように 九九を よむよ。こたえが カードに あったら ○を つけよう。',
                        'たて・よこ・ななめ、1れつ そろったら <b>ビンゴ！</b> よみあげた しきは したに かいて おこう。'],
                }, card + pool + memo, list);
            },
        };

        /* ================================================================
           ④ かけ算 じんとり（2人で あそぶ）
           ================================================================ */
        const JT_SIZES = { s: { w: 12, h: 9, cell: 13, label: 'ちいさい（12×9マス・みじかい じかん）' }, m: { w: 18, h: 12, cell: 9.2, label: 'ふつう（18×12マス）' } };
        const jintori = {
            id: 'kake-jintori', title: 'かけ算 じんとり', icon: '🚩',
            desc: 'サイコロ 2こで「たて×よこ」の ながしかくを かいて じんちを ひろげる、2人で あそぶ ゲーム。',
            options: [
                { key: 'size', label: 'ばんの おおきさ', type: 'select', def: 'm', choices: Object.entries(JT_SIZES).map(([k, v]) => [k, v.label]) },
                { key: 'dice', label: 'つかう もの', type: 'select', def: '6', choices: [['6', 'サイコロ 2こ（1〜6）'], ['9', '1〜9の カード 2まい（九九 ぜんぶ）']] },
                { key: 'rock', label: 'いわ（おけない マス）を おく', type: 'check', def: true },
            ],
            build(opt, rng) {
                const sz = JT_SIZES[opt.size] || JT_SIZES.m;
                const rocks = new Set();
                if (opt.rock) {
                    const n = opt.size === 's' ? 4 : 7;
                    for (let t = 0; t < 200 && rocks.size < n; t++) {
                        const x = rng.int(1, sz.w - 2), y = rng.int(1, sz.h - 2);
                        if (![...rocks].some(k => { const [a, b] = k.split(',').map(Number); return Math.abs(a - x) + Math.abs(b - y) < 4; })) rocks.add(x + ',' + y);
                    }
                }
                const board = `<div class="jt" style="grid-template-columns:repeat(${sz.w},${sz.cell}mm);grid-auto-rows:${sz.cell}mm">${range(sz.h).map(y => range(sz.w).map(x => `<div class="jtc${rocks.has(x + ',' + y) ? ' rock' : ''}">${rocks.has(x + ',' + y) ? '★' : ''}</div>`).join('')).join('')}</div>`;
                const rows = opt.size === 's' ? 6 : 7;
                const score = who => `<div class="jt-score"><div class="jt-who">${who} <span class="u"></span></div>${range(rows).map(i => `<div class="kb-line"><span class="kb-no">${i + 1}</span><span class="bx"></span>×<span class="bx"></span>＝<span class="bx w"></span></div>`).join('')}<div class="jt-total">ごうけい <span class="bx w2"></span> マス</div></div>`;
                const tool = opt.dice === '9' ? '1〜9の カードを 2まい ひく' : 'サイコロを 2こ ふる';
                return both({
                    subject: 'sansu', catchline: '九九で じんちを ひろげよう！（2人で あそぶ）', title: 'かけ算 じんとり', icon: '🚩',
                    rules: [`じゃんけんで じゅんばんを きめる。${tool}（3と4 なら「たて3×よこ4」でも「たて4×よこ3」でも よい）。`,
                        'その おおきさの ながしかくを マスの せんに そって かこみ、なかに じぶんの しるし（○ か ×）と しきを かく。',
                        'ほかの ながしかくや いわ（★）に かさなったり、ばんから はみ出したら だめ。おけない ときは パス。',
                        '2人とも つづけて パスに なったら おわり。こたえ（マスの かず）を たして、おおい ほうが かち！'],
                }, board + `<div class="jt-scores">${score('○ の ひと')}${score('× の ひと')}</div>`, null);
            },
        };

        /* ================================================================
           ⑤ 九九ひょうの ひみつ（いろを ぬって もようを さがす）
           ================================================================ */
        const HY_RULES = [
            ...range(10).map(d => ({ k: 'd' + d, t: `一の くらいが ${d}`, f: p => p % 10 === d, ichi: true })),
            { k: 'even', t: 'ぐうすう（2で わりきれる）', f: p => p % 2 === 0 },
            { k: 'odd', t: 'きすう（2で わりきれない）', f: p => p % 2 === 1 },
            { k: 'sq', t: 'おなじ かずどうしの かけ算の こたえ（1・4・9・16…）', f: p => [1, 4, 9, 16, 25, 36, 49, 64, 81].includes(p) },
            { k: 'big', t: 'こたえが 40より 大きい', f: p => p > 40 },
            { k: 'twice', t: 'ひょうに 2かい いじょう でて くる かず', f: p => KUKU_COUNT[p] >= 2 },
        ];
        const KUKU_COUNT = {};
        for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) KUKU_COUNT[a * b] = (KUKU_COUNT[a * b] || 0) + 1;
        const hyou = {
            id: 'kuku-hyou', title: '九九ひょうの ひみつ', icon: '🌈',
            desc: '九九ひょうの「一の くらい」や「ぐうすう」の マスに いろを ぬると、ふしぎな もようが あらわれる。きづいた ことを かこう。',
            options: [
                { key: 'kind', label: 'ぬる きまり', type: 'select', def: 'ichi', choices: [['ichi', '一の くらいで ぬる'], ['mix', 'いろいろな きまり（ぐうすう・おなじ かず など）']] },
                { key: 'fill', label: 'かずを じぶんで かきこむ（ひょうは からっぽ）', type: 'check', def: false },
            ],
            build(opt, rng) {
                const pool = opt.kind === 'mix' ? HY_RULES.filter(r => !r.ichi || r.k === 'd5' || r.k === 'd0') : HY_RULES.filter(r => r.ichi && r.k !== 'd0');
                const rules = rng.sample(pool, 4);
                const table = (r, answer) => `<div class="hy"><div class="hy-h">${'①②③④'[rules.indexOf(r)]} ${esc(r.t)}</div>
                    <div class="hy-grid"><div class="hyc hd">×</div>${range(9).map(b => `<div class="hyc hd">${b + 1}</div>`).join('')}
                    ${range(9).map(a => `<div class="hyc hd">${a + 1}</div>${range(9).map(b => { const p = (a + 1) * (b + 1); const on = answer && r.f(p); return `<div class="hyc${on ? ' on' : ''}">${opt.fill && !answer ? '' : p}</div>`; }).join('')}`).join('')}</div>
                    <div class="hy-note">きづいた こと：<span class="u"></span></div></div>`;
                const body = answer => `<div class="hy-wrap">${rules.map(r => table(r, answer)).join('')}</div>`;
                return both({
                    subject: 'sansu', catchline: 'いろを ぬると もようが でて くる！', title: '九九ひょうの ひみつ', icon: '🌈',
                    rules: [opt.fill ? 'まず 九九ひょうに こたえを ぜんぶ かきこもう。' : '4つの 九九ひょうが あるよ。',
                        'うえに かいて ある きまりに あう マスに いろを ぬろう。',
                        'どんな もようが できたかな？ ななめの せんで おりかえすと…？ きづいた ことを かこう。'],
                }, body(false), body(true));
            },
        };

        /* ================================================================
           ⑥ 九九ひょう パズル（かずあて）
           ================================================================ */
        const PZ_LEVELS = {
            easy: { label: 'かんたん（あな 20こ）', holes: 20 },
            mid: { label: 'ふつう（あな 40こ）', holes: 40 },
            hard: { label: 'ばらばら 九九ひょう（ならびが ばらばら・あな 35こ）', holes: 35, shuffle: true },
            oni: { label: 'おに（ばらばら＋ふちの かずも かくれる）', holes: 30, shuffle: true, hide: 3 },
        };
        const puzzle = {
            id: 'kuku-puzzle', title: '九九ひょう パズル', icon: '🧩',
            desc: '九九ひょうの あいた ところに 入る かずを あてる。ならびが ばらばらの ひょうや、ふちの かずが かくれた「おに」も。',
            options: [{ key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(PZ_LEVELS).map(([k, v]) => [k, v.label]) }],
            build(opt, rng) {
                const lv = PZ_LEVELS[opt.level] || PZ_LEVELS.easy;
                const nine = range(9).map(i => i + 1);
                let rows, cols, holes, hr, hc;
                for (let t = 0; t < 400; t++) {
                    rows = lv.shuffle ? rng.shuffle(nine) : nine;
                    cols = lv.shuffle ? rng.shuffle(nine) : nine;
                    const all = [];
                    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) all.push(y * 9 + x);
                    holes = new Set(rng.sample(all, lv.holes));
                    hr = new Set(lv.hide ? rng.sample(range(9), lv.hide) : []);
                    hc = new Set(lv.hide ? rng.sample(range(9), lv.hide) : []);
                    /* かくれた ふちは、みえて いる ふちと みえて いる マスから わかる こと */
                    const okR = [...hr].every(y => range(9).some(x => !hc.has(x) && !holes.has(y * 9 + x)));
                    const okC = [...hc].every(x => range(9).some(y => !hr.has(y) && !holes.has(y * 9 + x)));
                    if (okR && okC) break;
                }
                const cell = 15.5;
                const grid = answer => `<div class="pz" style="grid-template-columns:repeat(10,${cell}mm);grid-auto-rows:${cell}mm">
                    <div class="pzc hd corner">×</div>${cols.map((c, x) => `<div class="pzc hd${hc.has(x) ? ' hole' : ''}">${hc.has(x) ? (answer ? `<b class="red">${c}</b>` : '') : c}</div>`).join('')}
                    ${rows.map((r, y) => `<div class="pzc hd${hr.has(y) ? ' hole' : ''}">${hr.has(y) ? (answer ? `<b class="red">${r}</b>` : '') : r}</div>${cols.map((c, x) => {
                        const hole = holes.has(y * 9 + x);
                        return `<div class="pzc${hole ? ' hole' : ''}">${hole ? (answer ? `<b class="red">${r * c}</b>` : '') : r * c}</div>`;
                    }).join('')}`).join('')}</div>`;
                const tips = lv.hide ? 'ふち（いちばん うえと ひだり）の かずも かくれて いるよ。わかって いる マスから かんがえよう。' : lv.shuffle ? 'ふちの かずの ならびが ばらばら！ よこの かず × たての かず を よく みよう。' : 'ひだりの かず × うえの かず が マスの かずだよ。';
                return both({
                    subject: 'sansu', catchline: '九九ひょうの あなを うめよう！', title: '九九ひょう パズル', icon: '🧩',
                    rules: ['あいて いる マスに 入る かずを かこう。', tips, 'できたら、おなじ かずが どこに あるか さがして みよう。'],
                }, grid(false), grid(true));
            },
        };

        /* ================================================================
           ⑦ ○の だん めいろ
           ================================================================ */
        const meiro = {
            id: 'kuku-meiro', title: '○の だん めいろ', icon: '🐸',
            desc: 'えらんだ だんの こたえ（6の だん なら 6・12・18…）の マスだけ とおって ゴールへ。',
            options: [{ key: 'dan', label: 'だん', type: 'select', def: 'random', choices: [['random', 'くじで きめる'], ...range(8).map(i => [String(i + 2), `${i + 2}の だん`])] }],
            build(opt, rng) {
                const n = +opt.dan || rng.int(2, 9);
                const W = 6, H = 8;
                const path = G.cornerPath(W, H, W + H + 3, rng);
                const on = new Set(path.map(([x, y]) => x + ',' + y));
                const mults = range(9).map(k => n * (k + 1));
                const decoy = () => {
                    for (let t = 0; t < 50; t++) {
                        const v = rng.next() < 0.75 ? n * rng.int(1, 9) + rng.pick([-2, -1, 1, 2, 3]) : rng.int(2, n * 9 + 3);
                        if (v > 1 && v % n !== 0) return v;
                    }
                    return n * 9 + 1;
                };
                let prev = 0;
                const cells = [];
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const isOn = on.has(x + ',' + y);
                    let v = isOn ? rng.pick(mults) : decoy();
                    if (isOn && v === prev) v = rng.pick(mults);
                    if (isOn) prev = v;
                    cells.push({ x, y, on: isOn, v });
                }
                const grid = answer => `<div class="cmaze-wrap"><div class="cm-start">スタート ➡</div>
                    <div class="cmaze" style="grid-template-columns:repeat(${W},29mm);grid-auto-rows:21mm">
                    ${cells.map(c => `<div class="cm km${answer && c.on ? ' cm-ok' : ''}${c.x === 0 && c.y === 0 ? ' cm-s' : ''}${c.x === W - 1 && c.y === H - 1 ? ' cm-g' : ''}">${c.v}${answer && c.on ? `<small>${n}×${c.v / n}</small>` : ''}</div>`).join('')}
                    ${answer ? pathSvg(path, W, H, 'ov-ok') : ''}</div><div class="cm-goal">➡ ゴール 🏁</div></div>`;
                return both({
                    subject: 'sansu', catchline: `${n}の だんを となえながら すすもう！`, title: `${n}の だん めいろ`, icon: '🐸',
                    rules: [`<b class="big">${n}の だん</b>の こたえ（${n}×1〜${n}×9）の マスだけ すすめるよ。`,
                        'スタートから となりの マスへ（たて・よこ）すすもう。ななめは ×。', `ゴールまで せんで つなごう。「${n}×いくつ？」と いえたら たつじん！`],
                }, grid(false), grid(true));
            },
        };

        /* ================================================================
           ⑧ アレイず クイズ（●の ならびを しきに）
           ================================================================ */
        const AR_LEVELS = { easy: { label: 'かんたん（2〜5）', lo: 2, hi: 5 }, mid: { label: 'ふつう（2〜9）', lo: 2, hi: 9 }, hard: { label: '2つに わけて かんがえる', lo: 2, hi: 6, split: true } };
        const array = {
            id: 'kuku-array', title: 'アレイず クイズ', icon: '🐞',
            desc: '●の ならび（アレイず）を みて、「1つ分の かず × いくつ分」の しきに する。むきを かえた しきや、2つに わけて かんがえる もんだいも。',
            options: [{ key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(AR_LEVELS).map(([k, v]) => [k, v.label]) }],
            build(opt, rng) {
                const lv = AR_LEVELS[opt.level] || AR_LEVELS.easy;
                const seen = new Set();
                const qs = [];
                for (let t = 0; t < 200 && qs.length < 6; t++) {
                    const r = rng.int(lv.lo, lv.split ? 5 : lv.hi), c1 = rng.int(lv.lo, lv.hi), c2 = lv.split ? rng.int(1, 4) : 0;
                    const k = `${r},${c1},${c2}`;
                    if (seen.has(k) || (!lv.split && r === c1 && qs.some(q => q.r === q.c1))) continue;
                    seen.add(k); qs.push({ r, c1, c2 });
                }
                const dots = q => {
                    const gap = q.c2 ? 1.6 : 0, cols = q.c1 + q.c2, sp = 1;
                    const w = cols * sp + gap, hgt = q.r * sp;
                    const circles = [];
                    for (let y = 0; y < q.r; y++) for (let x = 0; x < cols; x++) circles.push(`<circle cx="${(x + 0.5) * sp + (x >= q.c1 ? gap : 0)}" cy="${(y + 0.5) * sp}" r="0.36" />`);
                    return `<svg class="arq-dots" viewBox="0 0 ${w} ${hgt}" style="width:${Math.min(70, w * 7)}mm">${circles.join('')}</svg>`;
                };
                const bx = (v, answer, wide) => `<span class="bx${wide ? ' w' : ''}">${answer ? `<b class="red">${v}</b>` : ''}</span>`;
                const one = (q, i, answer) => {
                    const total = q.r * (q.c1 + q.c2);
                    const lines = q.c2
                        ? `<div class="arq-l">ひだり：${bx(q.c1, answer)}×${bx(q.r, answer)}＝${bx(q.c1 * q.r, answer, 1)}</div>
                           <div class="arq-l">みぎ：${bx(q.c2, answer)}×${bx(q.r, answer)}＝${bx(q.c2 * q.r, answer, 1)}</div>
                           <div class="arq-l">1つの しきで：${bx(q.c1 + q.c2, answer)}×${bx(q.r, answer)}＝${bx(total, answer, 1)}</div>`
                        : `<div class="arq-l">よこ 1れつを 1つ分：${bx(q.c1, answer)}×${bx(q.r, answer)}＝${bx(total, answer, 1)}</div>
                           <div class="arq-l">たて 1れつを 1つ分：${bx(q.r, answer)}×${bx(q.c1, answer)}＝${bx(total, answer, 1)}</div>`;
                    return `<div class="arq"><div class="arq-h"><span class="qn">${i + 1}</span>●は ぜんぶで なんこ？</div><div class="arq-in">${dots(q)}<div class="arq-ls">${lines}</div></div></div>`;
                };
                const body = answer => `<div class="arq-list">${qs.map((q, i) => one(q, i, answer)).join('')}</div>`;
                return both({
                    subject: 'sansu', catchline: '●の ならびを かけ算の しきに しよう！', title: 'アレイず クイズ', icon: '🐞',
                    rules: lv.split
                        ? ['●の まとまりが 2つ あるよ。ひだりと みぎを べつべつに かぞえよう。', 'よこ 1れつの かず × れつの かず で しきに しよう。', 'さいごに 1つの しきに まとめよう（あわせた かずと おなじに なるかな？）。']
                        : ['よこに ならんだ ●（1れつ）を「1つ分」と すると、なんれつ あるかな？', 'たてに ならんだ ●を「1つ分」に すると、しきは どう かわる？', 'どちらの しきでも、こたえは おなじに なるかな？'],
                }, body(false), body(true));
            },
        };

        /* ================================================================
           ⑨ かけ算 カードバトル（きりとって あそぶ）
           ================================================================ */
        const cards = {
            id: 'kuku-cards', title: 'かけ算 カードバトル', icon: '⚡',
            desc: 'きりとって つかう 九九カード 20まい。「こたえが 大きい ほうが かち」や「おなじ こたえ あつめ」で あそぶ。',
            options: [
                { key: 'dan', label: 'つかう だん', type: 'select', def: 'all', choices: danChoices() },
                { key: 'ans', label: 'カードの したに こたえを さかさまに 小さく のせる', type: 'check', def: true },
            ],
            build(opt, rng) {
                const dans = dansOf(opt.dan);
                let pool = exprsOf(dans);
                /* 1つの だんの ときは 6×3 の ような いれかえた しきも まぜる（おなじ こたえ あつめが できる） */
                if (dans.length === 1) pool = pool.concat(pool.filter(e => e.a !== e.b).map(e => ({ a: e.b, b: e.a, p: e.p, text: `${e.b}×${e.a}` })));
                /* おなじ こたえの ペアを 6くみ ＋ のこり */
                const byP = {};
                for (const e of pool) (byP[e.p] = byP[e.p] || []).push(e);
                const pairPs = rng.shuffle(Object.keys(byP).filter(p => byP[p].length >= 2)).slice(0, 6);
                const chosen = pairPs.flatMap(p => rng.sample(byP[p], 2));
                const rest = rng.shuffle(pool.filter(e => !chosen.includes(e)));
                while (chosen.length < 20 && rest.length) chosen.push(rest.pop());
                while (chosen.length < 20) chosen.push(rng.pick(pool));
                const deck = rng.shuffle(chosen);
                const body = `<div class="kcd-grid">${deck.map(e => `<div class="kcard"><span class="kcd-corner">${e.a}の だん</span><b class="kcd-ex">${e.a}<i>×</i>${e.b}</b>${opt.ans ? `<span class="kcd-ans">${e.p}</span>` : ''}</div>`).join('')}</div>`;
                return both({
                    subject: 'sansu', catchline: 'きりとって 2人で あそぼう！', title: 'かけ算 カードバトル', icon: '⚡',
                    rules: ['<b>たたかい</b>：カードを うらがえして 1まいずつ だす。こたえを いって、大きい ほうが 2まい もらえる。',
                        '<b>おなじ こたえ あつめ</b>：ぜんぶ ふせて 2まい めくる。こたえが おなじ（3×4 と 2×6 など）なら もらえる。'],
                }, body, null);
            },
        };

        /* ================================================================
           ⑩ 九九に でて こない かず さがし
           ================================================================ */
        const SG_LEVELS = { easy: { label: 'かんたん（40まで・かくれた かず 4こ）', max: 40, n: 56, odd: 4, cols: 8 }, mid: { label: 'ふつう（60まで・6こ）', max: 60, n: 70, odd: 6, cols: 10 }, hard: { label: 'むずかしい（81まで・9こ）', max: 81, n: 90, odd: 9, cols: 10 } };
        const sagashi = {
            id: 'kuku-sagashi', title: '九九に でて こない かず さがし', icon: '🦉',
            desc: 'ならんだ かずの なかから、九九の こたえに でて こない かず（11・13・17 など）を みつけて ○で かこむ。',
            options: [{ key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(SG_LEVELS).map(([k, v]) => [k, v.label]) }],
            build(opt, rng) {
                const lv = SG_LEVELS[opt.level] || SG_LEVELS.easy;
                const inK = range(lv.max).map(i => i + 1).filter(v => KUKU_SET.has(v) && v > 1);
                const outK = range(lv.max).map(i => i + 1).filter(v => !KUKU_SET.has(v) && v > 10);
                const odds = rng.sample(outK, lv.odd);
                const nums = rng.shuffle([...odds, ...range(lv.n - lv.odd).map(() => rng.pick(inK))]);
                const cell = Math.min(22, 180 / lv.cols);
                const grid = answer => `<div class="sg" style="grid-template-columns:repeat(${lv.cols},${cell}mm);grid-auto-rows:${cell * 0.85}mm">${nums.map(v => `<div class="sgc${answer && odds.includes(v) ? ' on' : ''}">${v}</div>`).join('')}</div>`;
                const found = `<div class="sg-found">みつけた かず：${range(lv.odd).map(() => '<span class="bx w"></span>').join('')}</div>`;
                return both({
                    subject: 'sansu', catchline: 'にせものの かずを みやぶれ！', title: '九九に でて こない かず さがし', icon: '🦉',
                    rules: [`この なかに、<b>九九の こたえに でて こない かず</b>が <b class="big">${lv.odd}こ</b> かくれて いるよ。`,
                        'みつけたら ○で かこもう。こまったら「なんの だんに ある かな？」と かんがえよう。', 'みつけた かずを したに かこう。'],
                }, grid(false) + found, grid(true) + `<div class="ans-text">こたえ：${[...odds].sort((a, b) => a - b).join('・')}</div>`);
            },
        };

        return { 'kuku-nurie': nurie, 'kuku-angou': angou, 'kuku-bingo': bingo, 'kake-jintori': jintori, 'kuku-hyou': hyou,
            'kuku-puzzle': puzzle, 'kuku-meiro': meiro, 'kuku-array': array, 'kuku-cards': cards, 'kuku-sagashi': sagashi };
    }

    const api = { make, DAN_SETS, RIDDLES, MESSAGES, KUKU_SET, exprsOf, productsOf };
    root.PurintoKuku = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
