/* いくつ分 しきづくり ── レベルアップ（テストに むけて）の きまり
   ------------------------------------------------------------------
   画面を つかわない ところ だけ（出題・はんてい・点数・ミニテストの くみたて）。
   tests.js が この ファイルも 読みこんで たしかめます。

   問題の しゅるい
     kotae   しきと 答え（しき □×□＝□、答え □ と たんい）
     iranai  いらない 数が まじった 文章題（kotae と おなじ こたえかた）
     enzan   ＋・−・× の どれかを えらんで しきを つくる
     kimari  かけ算の きまり（啓林館「かけ算の きまり」の ことばに あわせて います）
     bai     なんばい（テープの 図。「2cm の 3つ分を 2cm の 3ばい と いいます」）
     zu      ●の 図を くふうして（L・凸の 形。わけかたを えらんで、ぜんぶの 数を 書く）
     tsukuru しきに あう もんだいを つくろう（ア・イ・ウに ことばカードを 入れる）
     test    ミニテスト（上の 7つから 10もん・100点）

   こたえる ところ（rows）は 画面に たよらない 形で かえします。
     { t:'文字' } / { box:'名前', d:けた数 } / { chips:'名前', opts:[…] } / { multi:'名前', opts:[…] }
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';
    const L = root.IkutsuLogic || (typeof require === 'function' ? require('./logic.js') : null);

    const LV_TYPES = [
        { id: 'kotae', name: 'しきと 答え', sub: 'たんいも わすれずに', icon: '🧮' },
        { id: 'iranai', name: 'いらない 数に 気をつけて', sub: 'つかう 数は どれ？', icon: '🚫' },
        { id: 'enzan', name: '＋ − × どれかな？', sub: 'たし算・ひき算・かけ算', icon: '➕' },
        { id: 'kimari', name: 'かけ算の きまり', sub: '□に 入る 数', icon: '📏' },
        { id: 'bai', name: 'なんばい', sub: 'テープの 図で 考えよう', icon: '📐' },
        { id: 'zu', name: '●の 図を くふうして', sub: 'わけて・ひいて 数えよう', icon: '🔷' },
        { id: 'tsukuru', name: 'しきに あう もんだいを つくろう', sub: 'ことばカードを 入れよう', icon: '🧩' },
        { id: 'test', name: 'ミニテスト', sub: '10もん・100点', icon: '📝' },
    ];
    const LV_IDS = LV_TYPES.map(t => t.id);
    /* ミニテストの ならび（テストと おなじ ように しゅるいごとに まとめる） */
    const TEST_PLAN = ['kotae', 'kotae', 'iranai', 'bai', 'enzan', 'enzan', 'kimari', 'kimari', 'zu', 'tsukuru'];

    const ri = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

    /* ---------- 文の くみたて（[ ] 1つ分・{ } いくつ分・( ) いらない 文・< > 合図の ことば） ---------- */
    function renderLv(tpl, v) {
        const segs = [];
        const re = /\[([^\]]*)\]|\{([^}]*)\}|\(([^)]*)\)|<([^>]*)>|([^[{(<]+)/g;
        let m;
        while ((m = re.exec(tpl))) {
            const k = m[1] !== undefined ? 'a' : m[2] !== undefined ? 'b' : m[3] !== undefined ? 'x' : m[4] !== undefined ? 'w' : '';
            const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
            const text = L.fixReading(raw.replace(/#([ABCXY])/g, (s, c) => String(v[c])));
            if (text) segs.push({ k, text });
        }
        return segs;
    }

    /** 問いの「何こ」「何人」「いくつ」 */
    function askWord(q) {
        const m = String(q).match(/何[^\s。？]+|いくつ/);
        return m ? m[0] : '';
    }

    /* ---------- ① しきと 答え ---------- */
    const UNIT_POOL = ['こ', '本', 'まい', '人', 'さつ', '台', 'ひき', 'つ'];
    function unitOpts(sc, rnd) {
        const third = L.shuffle(UNIT_POOL.filter(u => u !== sc.ua && u !== sc.ub), rnd)[0];
        return L.shuffle([sc.ua, sc.ub, third], rnd);
    }
    function kotaeRows(p) {
        return [
            [{ t: 'しき' }, { box: 's1', d: 1 }, { t: '×' }, { box: 's2', d: 1 }, { t: '＝' }, { box: 'p', d: 2 }],
            [{ t: '答え' }, { box: 'n', d: 2 }, { chips: 'u', opts: p.units }],
        ];
    }

    /* ---------- ② いらない 数 ---------- */
    const EXTRA = [
        { t: 'ほかに みかんが #Cこ あります。', u: 'こ', n: 'みかん' },
        { t: 'つくえの 上に ノートが #Cさつ あります。', u: 'さつ', n: 'ノート' },
        { t: '空に 鳥が #C羽 とんで います。', u: '羽', n: '鳥' },
        { t: 'こうえんに 犬が #Cひき います。', u: 'ひき', n: '犬' },
        { t: 'えんぴつが #C本 おちて います。', u: '本', n: 'えんぴつ' },
        { t: 'きょうは #C人が 休みです。', u: '人', n: '' },
        { t: 'おりがみが #Cまい あまって います。', u: 'まい', n: 'おりがみ' },
        { t: 'ちゅう車場に 車が #C台 とまって います。', u: '台', n: '車' },
        { t: 'いまは #C時 です。', u: '時', n: '' },
        { t: 'きのうは 本を #Cページ 読みました。', u: 'ページ', n: '' },
        { t: 'ボールが #Cこ ころがって います。', u: 'こ', n: 'ボール' },
        { t: 'ふうせんが #Cこ うかんで います。', u: 'こ', n: 'ふうせん' },
    ];
    /** その ばめんに まぜても まぎらわしく ない いらない 文 */
    function extrasFor(sc) {
        const people = sc.ua === '人' || sc.ub === '人';
        return EXTRA.filter(x => x.u !== sc.ua && x.u !== sc.ub && !(people && x.u === '人')
            && !(x.n && (sc.name.includes(x.n) || sc.q.includes(x.n) || sc.t.some(t => t.includes(x.n)))));
    }

    /* ---------- ③ ＋ − × ---------- */
    /* < > が 合図の ことば。#X・#Y が 数（ひき算は #X が 大きい 数） */
    const ADD = [
        'こうえんで 子どもが #X人 あそんで います。そこへ #Y人 <来ました>。<みんなで> 何人に なりましたか。',
        '赤い 花が #X本、白い 花が #Y本 さいて います。花は <あわせて> 何本 ですか。',
        'クッキーを #Xまい やきました。<あとから> #Yまい やきました。<ぜんぶで> 何まい やきましたか。',
        'えんぴつを #X本 もって います。おにいさんから #Y本 <もらいました>。えんぴつは 何本に なりましたか。',
        'バスに #X人 のって います。つぎの バスていで #Y人 <のって きました>。バスには 何人 のって いますか。',
        'みかんが はこに #Xこ、かごに #Yこ あります。みかんは <ぜんぶで> 何こ ありますか。',
        'シールを #Xまい もって います。#Yまい <もらうと>、何まいに なりますか。',
        '金魚が #Xひき います。#Yひき <ふえると>、何びきに なりますか。',
    ];
    const SUB = [
        'あめが #Xこ あります。#Yこ <たべました>。<のこりは> 何こ ですか。',
        'おりがみが #Xまい あります。#Yまい <つかうと>、<のこりは> 何まい ですか。',
        'こうえんで 子どもが #X人 あそんで います。#Y人 <帰りました>。<のこりは> 何人 ですか。',
        'りんごが #Xこ、みかんが #Yこ あります。<ちがいは> 何こ ですか。',
        '赤い ふうせんが #Xこ、青い ふうせんが #Yこ あります。赤い ふうせんは 青い ふうせんより 何こ <多い>ですか。',
        'バスに #X人 のって います。#Y人 <おりました>。バスには 何人 <のこって> いますか。',
        'シールを #Xまい もって います。いもうとに #Yまい <あげました>。<のこりは> 何まい ですか。',
        'えんぴつが #X本 あります。#Y人に 1本ずつ <くばると>、<のこりは> 何本 ですか。',
    ];
    const OPS = ['＋', '−', '×'];
    function enzanRows() {
        return [[{ t: 'しき' }, { box: 'x', d: 2 }, { chips: 'op', opts: OPS, inline: true }, { box: 'y', d: 2 }]];
    }

    /* ---------- ⑤ かけ算の きまり ---------- */
    /* 答えが 2つ いじょうの 九九に なる 数 */
    const SAME_P = [4, 6, 8, 9, 12, 16, 18, 24, 36];
    const pairsOf = P => {
        const out = [];
        for (let x = 1; x <= 9; x++) if (P % x === 0 && P / x <= 9) out.push(x + ' × ' + (P / x));
        return out;
    };
    function makeKimari(rnd, sub) {
        const subs = ['up', 'eq', 'down', 'swap', 'blank', 'same', 'words'];
        sub = sub || pick(rnd, subs);
        let a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
        const p = { type: 'kimari', sub, a, b };
        const B = (k) => ({ box: k, d: 1 });
        switch (sub) {
            case 'up':      /* かける数が 1 ふえると */
                p.text = '□に あてはまる 数を 書きましょう。';
                p.rows = [[{ t: a + ' × ' + b + ' の 答えは、' }], [{ t: a + ' × ' + (b - 1) + ' の 答えより' }, B('x'), { t: '大きい。' }]];
                p.ans = { x: a };
                break;
            case 'eq':
                p.text = '□に あてはまる 数を 書きましょう。';
                p.rows = [[{ t: a + ' × ' + b + ' ＝ ' + a + ' × ' + (b - 1) + ' ＋' }, B('x')]];
                p.ans = { x: a };
                break;
            case 'down':    /* かける数が 1 へると */
                if (b === 9) b = p.b = ri(rnd, 2, 8);
                p.text = '□に あてはまる 数を 書きましょう。';
                p.rows = [[{ t: a + ' × ' + b + ' の 答えは、' }], [{ t: a + ' × ' + (b + 1) + ' の 答えより' }, B('x'), { t: '小さい。' }]];
                p.ans = { x: a };
                break;
            case 'swap':    /* 入れかえても 答えは おなじ */
                while (a === b) b = p.b = ri(rnd, 2, 9);
                p.text = '□に あてはまる 数を 書きましょう。';
                if (rnd() < .5) {
                    p.rows = [[{ t: a + ' × ' + b + ' ＝ ' + b + ' ×' }, B('x')]];
                    p.ans = { x: a };
                } else {
                    p.rows = [[B('x'), { t: '× ' + a + ' ＝ ' + a + ' × ' + b }]];
                    p.ans = { x: b };
                }
                break;
            case 'blank':   /* □を もとめる */
                p.text = '□に あてはまる 数を 書きましょう。';
                if (rnd() < .5) {
                    p.rows = [[{ t: a + ' ×' }, B('x'), { t: '＝ ' + a * b }]];
                    p.ans = { x: b };
                } else {
                    p.rows = [[B('x'), { t: '× ' + b + ' ＝ ' + a * b }]];
                    p.ans = { x: a };
                }
                break;
            case 'same': {  /* 答えが おなじに なる 九九 */
                const P = pick(rnd, SAME_P);
                p.P = P;
                const good = pairsOf(P);
                const bad = new Set();
                good.forEach(s => {
                    const [x, y] = s.split(' × ').map(Number);
                    [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]].forEach(([u, w]) => {
                        if (u >= 1 && u <= 9 && w >= 1 && w <= 9 && u * w !== P) bad.add(u + ' × ' + w);
                    });
                });
                const need = Math.max(6, good.length + 2) - good.length;
                const opts = good.concat(L.shuffle([...bad], rnd).slice(0, need));
                p.text = '答えが ' + P + ' に なる 九九を ぜんぶ えらびましょう。';
                p.rows = [[{ multi: 'm', opts: L.shuffle(opts, rnd) }]];
                p.ans = { m: good.slice().sort() };
                break;
            }
            default: {      /* かけられる数・かける数 */
                p.sub = 'words';
                while (a === b) b = p.b = ri(rnd, 2, 9);
                p.text = '□に あてはまる 数を 書きましょう。';
                p.rows = [[{ t: a + ' × ' + b + ' で、' }], [{ t: 'かけられる数は' }, B('x'), { t: '、' }], [{ t: 'かける数は' }, B('y'), { t: 'です。' }]];
                p.ans = { x: a, y: b };
            }
        }
        return p;
    }

    /* ---------- ④ なんばい ---------- */
    /* テープの 長さ（cm）・もの の 数。#A が もとの 数、#B が 何ばい */
    const BAI_TEXT = [
        { t: '#Acm の #Bばいの 長さは 何cm ですか。', u: 'cm' },
        { t: '赤い テープの 長さは #Acm です。青い テープの 長さは、赤い テープの #Bばい です。青い テープは 何cm ですか。', u: 'cm' },
        { t: 'ひもを #Acm ずつ #B本 つなぎます。ぜんぶの 長さは、#Acm の 何ばい ですか。また、何cm ですか。', u: 'cm', k: 1 },
        { t: 'みかんが #Aこ あります。りんごは みかんの #Bばい あります。りんごは 何こ ありますか。', u: 'こ' },
        { t: 'わたしは シールを #Aまい もって います。おねえさんは わたしの #Bばい もって います。おねえさんの シールは 何まい ですか。', u: 'まい' },
        { t: '1年生が かだんに 花を #A本 うえました。2年生は その #Bばい うえました。2年生が うえた 花は 何本 ですか。', u: '本' },
    ];
    function makeBai(rnd, sub) {
        const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
        sub = sub || (rnd() < .45 ? 'tape' : 'text');
        const p = { type: 'bai', sub, a, b, u: 'cm' };
        const shiki = [{ t: 'しき' }, { box: 's1', d: 1 }, { t: '×' }, { box: 's2', d: 1 }, { t: '＝' }, { box: 'p', d: 2 }];
        if (sub === 'tape') {
            p.text = '下の テープの 長さは、' + a + 'cm の 何ばい ですか。また、何cm ですか。';
            p.rows = [[{ t: a + 'cm の' }, { box: 'k', d: 1 }, { t: 'ばい' }], shiki, [{ t: '答え' }, { box: 'n', d: 2 }, { t: 'cm' }]];
            p.ans = { k: b, s1: a, s2: b, p: a * b, n: a * b };
        } else {
            const x = pick(rnd, BAI_TEXT);
            p.u = x.u;
            p.text = L.fixReading(x.t.replace(/#A/g, a).replace(/#B/g, b));
            p.rows = (x.k ? [[{ t: a + 'cm の' }, { box: 'k', d: 1 }, { t: 'ばい' }]] : []).concat([shiki, [{ t: '答え' }, { box: 'n', d: 2 }, { t: x.u }]]);
            p.ans = { s1: a, s2: b, p: a * b, n: a * b };
            if (x.k) p.ans.k = b;
        }
        return p;
    }

    /* ---------- ⑥ ●の 図を くふうして ----------
       図は よこ W・たて H の ます。1つ分は よこ 1れつ（「よこに 4こずつ 3れつ」→ 4×3）。
       わけかた（opts）は ことばと、図に 色を つける 四角（x,y,w,h, -1 は ひく）を もつ。 */
    const mul = (w, h) => w + '×' + h;
    function shapeCells(W, H, holes) {
        const cells = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (!holes.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) cells.push([x, y]);
        }
        return cells;
    }
    function makeZu(rnd, sub) {
        sub = sub || (rnd() < .6 ? 'L' : 'totsu');
        let W, H, holes, good, badOpts;
        if (sub === 'L') {
            /* 右上（か 左上）が かけた 形 */
            W = ri(rnd, 4, 7); H = ri(rnd, 3, 6);
            const w = ri(rnd, 1, W - 2), h = ri(rnd, 1, H - 2);
            const left = rnd() < .5;           // かけて いるのが 左上
            const cx = left ? 0 : W - w;       // かけた ところの x
            const keepX = left ? w : 0;        // 上の だんで のこる ところの x
            holes = [{ x: cx, y: 0, w, h }];
            good = [
                { text: '上の ' + mul(W - w, h) + ' と 下の ' + mul(W, H - h) + ' を たす', parts: [{ x: keepX, y: 0, w: W - w, h }, { x: 0, y: h, w: W, h: H - h }] },
                { text: (left ? '右の ' : '左の ') + mul(W - w, H) + ' と ' + (left ? '左の ' : '右の ') + mul(w, H - h) + ' を たす', parts: [{ x: keepX, y: 0, w: W - w, h: H }, { x: cx, y: h, w, h: H - h }] },
                { text: mul(W, H) + ' から ' + mul(w, h) + ' を ひく', parts: [{ x: 0, y: 0, w: W, h: H }, { x: cx, y: 0, w, h, s: -1 }] },
            ];
            badOpts = [
                { text: mul(W, H) + ' と ' + mul(w, h) + ' を たす', v: W * H + w * h, parts: [{ x: 0, y: 0, w: W, h: H }, { x: cx, y: 0, w, h }] },
                { text: '上の ' + mul(W - w, h) + ' と 下の ' + mul(W, H) + ' を たす', v: (W - w) * h + W * H },
                { text: mul(W, H) + ' から ' + mul(w, H - h) + ' を ひく', v: W * H - w * (H - h), parts: [{ x: 0, y: 0, w: W, h: H }, { x: cx, y: 0, w, h: H - h, s: -1 }] },
                { text: '上の ' + mul(W, h) + ' と 下の ' + mul(W, H - h) + ' を たす', v: W * H, parts: [{ x: 0, y: 0, w: W, h }, { x: 0, y: h, w: W, h: H - h }] },
            ];
        } else {
            /* 凸：下の 長方形の 上に でっぱり */
            W = ri(rnd, 5, 7);
            const H1 = ri(rnd, 2, 4), hb = ri(rnd, 1, 3), wb = ri(rnd, 1, W - 3), ox = ri(rnd, 1, W - wb - 1);
            H = H1 + hb;
            holes = [{ x: 0, y: 0, w: ox, h: hb }, { x: ox + wb, y: 0, w: W - ox - wb, h: hb }];
            good = [
                { text: '上の ' + mul(wb, hb) + ' と 下の ' + mul(W, H1) + ' を たす', parts: [{ x: ox, y: 0, w: wb, h: hb }, { x: 0, y: hb, w: W, h: H1 }] },
                { text: '左の ' + mul(ox, H1) + ' と まん中の ' + mul(wb, H) + ' と 右の ' + mul(W - ox - wb, H1) + ' を たす',
                    parts: [{ x: 0, y: hb, w: ox, h: H1 }, { x: ox, y: 0, w: wb, h: H }, { x: ox + wb, y: hb, w: W - ox - wb, h: H1 }] },
            ];
            badOpts = [
                { text: '上の ' + mul(wb, hb) + ' と 下の ' + mul(W, H) + ' を たす', v: wb * hb + W * H },
                { text: mul(W, H) + ' と ' + mul(wb, hb) + ' を たす', v: W * H + wb * hb, parts: [{ x: 0, y: 0, w: W, h: H }, { x: ox, y: 0, w: wb, h: hb }] },
                { text: '上の ' + mul(wb, H1) + ' と 下の ' + mul(W, H1) + ' を たす', v: wb * H1 + W * H1 },
                { text: mul(W, H) + ' を 計算する', v: W * H, parts: [{ x: 0, y: 0, w: W, h: H }] },
            ];
        }
        const cells = shapeCells(W, H, holes);
        const n = cells.length;
        const goods = L.shuffle(good, rnd).slice(0, 2).map(o => Object.assign(o, { ok: true }));
        const bads = L.shuffle(badOpts.filter(o => o.v !== n), rnd).slice(0, 2).map(o => ({ text: o.text, parts: o.parts }));
        const opts = L.shuffle(goods.concat(bads), rnd);
        const p = {
            type: 'zu', sub, W, H, cells, opts, n,
            text: '●は ぜんぶで 何こ ありますか。くふうして もとめましょう。',
            rows: [
                [{ t: 'あって いる もとめかたを ぜんぶ えらぼう' }],
                [{ multi: 'm', opts: opts.map(o => o.text), wide: true }],
                [{ t: '●は ぜんぶで' }, { box: 'n', d: 2 }, { t: 'こ' }],
            ],
        };
        p.ans = { m: goods.map(o => o.text).sort(), n };
        return p;
    }

    /* ---------- ⑦ しきに あう もんだいを つくろう ---------- */
    /** 文の [ ] と { } を ア・イ に、問いを ウ に して、ことばカードを つくる */
    function makeTsukuru(scene, ti, a, b, rnd) {
        const tpl = scene.t[ti];
        const segOf = (k, x, y) => renderLv(tpl, { A: x, B: y }).find(s => s.k === k).text;
        const w = askWord(scene.q) || '何こ';
        const parts = renderLv(tpl, { A: a, B: b }).map(s => (s.k ? { slot: s.k === 'a' ? 'A' : 'B' } : { text: s.text }));
        parts.push({ slot: 'Q' });
        const qs = [scene.q, 'のこりは ' + w + ' ですか。', 'ちがいは ' + w + ' ですか。'];
        const p = {
            type: 'tsukuru', sid: scene.id, ti, a, b, parts,
            text: 'しきが ' + a + ' × ' + b + ' に なる もんだいを つくろう。ア・イ・ウに 入る ことばを えらびましょう。',
            cards: { A: L.shuffle([segOf('a', a, b), segOf('a', b, a)], rnd), B: L.shuffle([segOf('b', a, b), segOf('b', b, a)], rnd), Q: L.shuffle(qs, rnd) },
        };
        p.rows = [
            [{ t: 'ア' }, { chips: 'A', opts: p.cards.A }],
            [{ t: 'イ' }, { chips: 'B', opts: p.cards.B }],
            [{ t: 'ウ' }, { chips: 'Q', opts: p.cards.Q, wide: true }],
        ];
        p.ans = { A: segOf('a', a, b), B: segOf('b', a, b), Q: scene.q };
        return p;
    }
    /** ア・イ・ウに 入れた 文（入って いない ところは ［ア］など） */
    function tsukuruText(p, ans) {
        return p.parts.map(x => (x.text !== undefined ? x.text : ans && ans[x.slot] ? ans[x.slot] : '［' + { A: 'ア', B: 'イ', Q: 'ウ' }[x.slot] + '］')).join('');
    }

    /* ---------- 出題 ---------- */
    function makeLvGen(scenes, rnd) {
        rnd = rnd || Math.random;
        const bags = {};
        let lastSid = '', lastKey = '';
        const textPool = () => {
            const out = [];
            scenes.forEach((sc, si) => sc.t.forEach((tpl, ti) => out.push({ si, ti })));
            return out;
        };
        function draw(name, filter) {
            if (!bags[name] || !bags[name].length) bags[name] = L.shuffle(textPool().filter(filter || (() => true)), rnd);
            const bag = bags[name];
            let i = bag.length - 1;
            for (let j = bag.length - 1; j >= 0; j--) if (scenes[bag[j].si].id !== lastSid) { i = j; break; }
            const r = bag.splice(i, 1)[0];
            lastSid = scenes[r.si].id;
            return r;
        }
        const nums = (sc, min) => {
            let a, b, n = 0;
            do {
                a = sc.a ? pick(rnd, sc.a) : L.pickNum(rnd);
                b = L.pickNum(rnd);
            } while ((a + 'x' + b === lastKey || (!sc.a && a < min) || b < min) && ++n < 50);
            lastKey = a + 'x' + b;
            return [a, b];
        };

        function kotae(type) {
            const iranai = type === 'iranai';
            /* いらない 数の 問題は、1つ分が 1 に きまって いる ばめん（一りん車）を のぞく */
            const d = draw(type, iranai ? x => extrasFor(scenes[x.si]).length > 0 && !(scenes[x.si].a || []).includes(1) : null);
            const sc = scenes[d.si];
            const [a, b] = nums(sc, 2);
            let tpl = sc.t[d.ti];
            const p = { type, sid: sc.id, ti: d.ti, a, b, units: unitOpts(sc, rnd) };
            if (iranai) {
                let c;
                do c = ri(rnd, 2, 9); while (c === a || c === b);
                const x = pick(rnd, extrasFor(sc));
                p.c = c;
                p.extra = x.t;
                const ex = '(' + x.t + ')';
                /* 「〜では、」で 問いに つづく 文の ときは 前に 入れる */
                tpl = /。$/.test(tpl) && rnd() < .5 ? tpl + ex : ex + tpl;
            }
            p.segs = renderLv(tpl, { A: a, B: b, C: p.c });
            p.q = sc.q;
            p.rows = kotaeRows(p);
            p.ans = { s1: a, s2: b, p: a * b, n: a * b, u: sc.ua };
            return p;
        }

        function enzan() {
            const r = rnd();
            const op = r < .5 ? '×' : r < .75 ? '＋' : '−';
            const p = { type: 'enzan', op, rows: enzanRows() };
            if (op === '×') {
                const d = draw('enzan');
                const sc = scenes[d.si];
                const [a, b] = nums(sc, 2);
                Object.assign(p, { sid: sc.id, ti: d.ti, a, b, segs: renderLv(sc.t[d.ti], { A: a, B: b }), q: sc.q });
                p.ans = { x: a, y: b, op };
            } else {
                const add = op === '＋';
                const X = add ? ri(rnd, 3, 29) : ri(rnd, 10, 30);
                const Y = add ? ri(rnd, 2, 9) : ri(rnd, 2, Math.min(9, X - 1));
                const tpl = pick(rnd, add ? ADD : SUB);
                Object.assign(p, { X, Y, segs: renderLv(tpl, { X, Y }), q: '' });
                p.ans = { x: X, y: Y, op };
            }
            return p;
        }

        function tsukuru() {
            /* 1つ分が きまって いる ばめん（たこの 足・5円玉 など）は「3本」「4円玉」の ような カードに なるので のぞく */
            const d = draw('tsukuru', x => !scenes[x.si].a);
            const sc = scenes[d.si];
            let a, b, n = 0;
            do {
                a = sc.a ? pick(rnd, sc.a) : ri(rnd, 2, 9);
                b = ri(rnd, 2, 9);
            } while ((a === b || a + 'x' + b === lastKey) && ++n < 50);
            if (a === b) b = a === 9 ? 8 : a + 1;
            lastKey = a + 'x' + b;
            return makeTsukuru(sc, d.ti, a, b, rnd);
        }

        function next(type) {
            if (type === 'kotae' || type === 'iranai') return kotae(type);
            if (type === 'enzan') return enzan();
            if (type === 'bai') return makeBai(rnd);
            if (type === 'zu') return makeZu(rnd);
            if (type === 'tsukuru') return tsukuru();
            return makeKimari(rnd);
        }
        return { next };
    }

    function makeTest(gen) {
        return TEST_PLAN.map(t => gen.next(t));
    }

    /* ---------- はんてい ----------
       ans は 子どもの こたえ（数 か 文字）。{ ok, bad:[名前], why, score（10点まんてん） } */
    function checkLv(p, ans) {
        const bad = [];
        let why = '';
        const eq = (k, v) => ans[k] === v;
        if (p.type === 'kotae' || p.type === 'iranai') {
            const A = p.ans;
            let shikiOk = true;
            if (!eq('s1', A.s1) || !eq('s2', A.s2)) {
                shikiOk = false;
                if (A.s1 !== A.s2 && eq('s1', A.s2) && eq('s2', A.s1)) { bad.push('s1', 's2'); why = 'order'; }
                else {
                    if (!eq('s1', A.s1)) bad.push('s1');
                    if (!eq('s2', A.s2)) bad.push('s2');
                    why = p.c && (ans.s1 === p.c || ans.s2 === p.c) ? 'extra' : 'shiki';
                }
            }
            if (!eq('p', A.p)) { bad.push('p'); shikiOk = false; why = why || 'prod'; }
            let kotaeOk = true;
            if (!eq('n', A.n)) { bad.push('n'); kotaeOk = false; why = why || 'n'; }
            if (!eq('u', A.u)) { bad.push('u'); kotaeOk = false; why = why || 'unit'; }
            return { ok: !bad.length, bad, why, score: (shikiOk ? 5 : 0) + (kotaeOk ? 5 : 0) };
        }
        if (p.type === 'enzan') {
            const A = p.ans;
            if (ans.op !== A.op) {
                bad.push('op');
                why = 'op';
            } else if (A.op === '＋' ? !((eq('x', A.x) && eq('y', A.y)) || (eq('x', A.y) && eq('y', A.x)))
                : !(eq('x', A.x) && eq('y', A.y))) {
                if (A.x !== A.y && eq('x', A.y) && eq('y', A.x)) { bad.push('x', 'y'); why = A.op === '×' ? 'order' : 'subOrder'; }
                else {
                    if (!eq('x', A.x) && !(A.op === '＋' && eq('x', A.y))) bad.push('x');
                    if (!eq('y', A.y) && !(A.op === '＋' && eq('y', A.x))) bad.push('y');
                    if (!bad.length) bad.push('x', 'y');
                    why = 'nums';
                }
            }
            return { ok: !bad.length, bad, why, score: bad.length ? 0 : 10 };
        }
        if (p.type === 'bai') {
            const A = p.ans;
            let shikiOk = true, kotaeOk = true;
            if (A.k !== undefined && !eq('k', A.k)) { bad.push('k'); shikiOk = false; why = 'kai'; }
            if (!eq('s1', A.s1) || !eq('s2', A.s2)) {
                shikiOk = false;
                if (eq('s1', A.s2) && eq('s2', A.s1) && A.s1 !== A.s2) { bad.push('s1', 's2'); why = why || 'order'; }
                else {
                    if (!eq('s1', A.s1)) bad.push('s1');
                    if (!eq('s2', A.s2)) bad.push('s2');
                    why = why || 'shiki';
                }
            }
            if (!eq('p', A.p)) { bad.push('p'); shikiOk = false; why = why || 'prod'; }
            if (!eq('n', A.n)) { bad.push('n'); kotaeOk = false; why = why || 'n'; }
            return { ok: !bad.length, bad, why, score: (shikiOk ? 5 : 0) + (kotaeOk ? 5 : 0) };
        }
        if (p.type === 'zu') {
            const got = (ans.m || []).slice().sort();
            const mOk = got.length === p.ans.m.length && got.every((v, i) => v === p.ans.m[i]);
            if (!mOk) { bad.push('m'); why = got.some(v => !p.ans.m.includes(v)) ? 'wrongPick' : 'fewer'; }
            if (!eq('n', p.ans.n)) { bad.push('n'); why = why || 'count'; }
            return { ok: !bad.length, bad, why, score: (mOk ? 5 : 0) + (eq('n', p.ans.n) ? 5 : 0) };
        }
        if (p.type === 'tsukuru') {
            ['A', 'B', 'Q'].forEach(k => { if (!eq(k, p.ans[k])) bad.push(k); });
            why = bad.includes('A') && bad.includes('B') ? 'swap' : bad.includes('A') ? 'A' : bad.includes('B') ? 'B' : bad.length ? 'Q' : '';
            return { ok: !bad.length, bad, why, score: bad.length ? 0 : 10 };
        }
        /* kimari */
        if (p.sub === 'same') {
            const got = (ans.m || []).slice().sort();
            const ok = got.length === p.ans.m.length && got.every((v, i) => v === p.ans.m[i]);
            return { ok, bad: ok ? [] : ['m'], why: ok ? '' : (got.length < p.ans.m.length ? 'fewer' : 'wrongPick'), score: ok ? 10 : 0 };
        }
        Object.keys(p.ans).forEach(k => { if (!eq(k, p.ans[k])) bad.push(k); });
        if (p.sub === 'words' && bad.length === 2 && eq('x', p.ans.y) && eq('y', p.ans.x)) why = 'order';
        else why = bad.length ? p.sub : '';
        return { ok: !bad.length, bad, why, score: bad.length ? 0 : 10 };
    }

    /** こたえる ところが ぜんぶ うまって いるか */
    function filled(p, ans) {
        return p.rows.every(r => r.every(tk => {
            if (tk.box) return ans[tk.box] !== undefined && ans[tk.box] !== '';
            if (tk.chips) return !!ans[tk.chips];
            if (tk.multi) return (ans[tk.multi] || []).length > 0;
            return true;
        }));
    }

    /** せいかいの 形（「3 × 4 ＝ 12　答え 12こ」など） */
    function answerText(p, sc) {
        const A = p.ans;
        if (p.type === 'kotae' || p.type === 'iranai') {
            return 'しき ' + A.s1 + ' × ' + A.s2 + ' ＝ ' + A.p + '　答え ' + L.fixReading(A.n + A.u);
        }
        if (p.type === 'enzan') return 'しき ' + A.x + ' ' + A.op + ' ' + A.y;
        if (p.type === 'bai') {
            return (A.k !== undefined ? p.a + 'cm の ' + A.k + 'ばい　' : '') + 'しき ' + A.s1 + ' × ' + A.s2 + ' ＝ ' + A.p + '　答え ' + A.n + p.u;
        }
        if (p.type === 'zu') return A.m.join('／') + '　→　' + A.n + 'こ';
        if (p.type === 'tsukuru') return tsukuruText(p, A);
        if (p.sub === 'same') return A.m.join('、');
        return p.rows.map(r => r.map(tk => tk.t !== undefined ? tk.t : tk.box ? '［' + A[tk.box] + '］' : '').join(' ')).join(' ');
    }

    /** よみあげ・プリント用の 文（□は「□」の まま） */
    function rowsText(p) {
        return p.rows.map(r => r.map(tk => tk.t !== undefined ? tk.t : tk.box ? '□' : tk.chips ? (tk.inline ? '○' : '') : '').join(' ')).join(' ');
    }

    /* ---------- 点数 ---------- */
    function testScore(results) {
        return results.reduce((s, r) => s + (r ? r.score : 0), 0);
    }
    /** まちがえた しゅるいの かず（やりなおしで 多めに 出す） */
    function weakTypes(problems, results) {
        const w = {};
        problems.forEach((p, i) => { if (!results[i] || !results[i].ok) w[p.type] = (w[p.type] || 0) + 1; });
        return w;
    }

    const api = {
        LV_TYPES, LV_IDS, TEST_PLAN, EXTRA, ADD, SUB, OPS, SAME_P, UNIT_POOL, BAI_TEXT,
        renderLv, askWord, unitOpts, extrasFor, pairsOf, makeKimari, makeBai, makeZu, makeTsukuru, tsukuruText, makeLvGen, makeTest,
        checkLv, filled, answerText, rowsText, testScore, weakTypes,
    };
    root.IkutsuLevel = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
