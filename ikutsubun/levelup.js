/* いくつ分 しきづくり ── レベルアップ（テストに むけて）の きまり
   ------------------------------------------------------------------
   画面を つかわない ところ だけ（出題・はんてい・点数・ミニテストの くみたて）。
   tests.js が この ファイルも 読みこんで たしかめます。

   問題の しゅるい
     kotae   しきと 答え（しき □×□＝□、答え □ と たんい）
     iranai  いらない 数が まじった 文章題（kotae と おなじ こたえかた）
     enzan   ＋・−・× の どれかを えらんで しきを つくる
     kimari  かけ算の きまり（啓林館「かけ算の きまり」の ことばに あわせて います）
     test    ミニテスト（上の 4つから 10もん・100点）

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
        { id: 'test', name: 'ミニテスト', sub: '10もん・100点', icon: '📝' },
    ];
    const LV_IDS = LV_TYPES.map(t => t.id);
    /* ミニテストの ならび（テストと おなじ ように しゅるいごとに まとめる） */
    const TEST_PLAN = ['kotae', 'kotae', 'kotae', 'iranai', 'iranai', 'enzan', 'enzan', 'kimari', 'kimari', 'kimari'];

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

        function next(type) {
            if (type === 'kotae' || type === 'iranai') return kotae(type);
            if (type === 'enzan') return enzan();
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
        LV_TYPES, LV_IDS, TEST_PLAN, EXTRA, ADD, SUB, OPS, SAME_P, UNIT_POOL,
        renderLv, askWord, unitOpts, extrasFor, pairsOf, makeKimari, makeLvGen, makeTest,
        checkLv, filled, answerText, rowsText, testScore, weakTypes,
    };
    root.IkutsuLevel = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
