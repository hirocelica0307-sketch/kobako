/* いくつ分 しきづくり ── レベルアップ（テストに むけて）の 画面と うごき
   きまり（出題・はんてい・点数）は levelup.js に あります。
   画面の 部品（問題の まど・数字カード・ヒント・よみあげ）は app.js と いっしょに つかいます。 */
(function () {
    'use strict';
    const A = window.IkutsuApp;
    const V = window.IkutsuLevel;
    const L = window.IkutsuLogic;
    const { $, el, SND, drawPic, setMsg, byId } = A;
    const gen = V.makeLvGen(window.IkutsuScenes);
    const DOTS = { e: '', box: '', row: 1 };   // ●の 図（かけ算の きまりの ヒント）

    const lv = {
        mode: '',
        p: null,
        ans: {},          // 子どもの こたえ
        act: '',          // えらんで いる わく
        fresh: true,      // つぎに おした 数で わくを 書きなおす
        bad: [],
        tries: 0,
        hint: 0,
        solved: false,
        test: null,       // ミニテスト { list, i, answers, results, t0 }
        queue: [],        // やりなおす 問題
        preview: '',      // ●の 図で さいごに えらんだ もとめかた
        weak: '',         // やりなおしの あとに 多めに 出す しゅるい
    };
    const info = id => V.LV_TYPES.find(t => t.id === id);
    const tokens = p => p.rows.flat();
    const boxKeys = p => tokens(p).filter(t => t.box).map(t => t.box);
    const tokenOf = (p, k) => tokens(p).find(t => t.box === k || t.chips === k || t.multi === k);
    const dan = (a, upto) => Array.from({ length: Math.min(9, upto) }, (_, i) => a * (i + 1)).join('、');

    /* ---------- はじめる・おわる ---------- */
    function start(mode) {
        lv.mode = mode;
        lv.queue = [];
        lv.weak = '';
        lv.test = null;
        if (mode === 'test') startTest();
        else next();
    }
    function stop() {
        lv.mode = '';
        lv.test = null;
        $('result').hidden = true;
        $('play').classList.remove('testing');
    }

    function next() {
        let p;
        if (lv.test) p = lv.test.list[lv.test.i];
        else if (lv.queue.length) p = lv.queue.shift();
        else p = gen.next(lv.weak && Math.random() < .5 ? lv.weak : lv.mode === 'test' ? pickAny() : lv.mode);
        show(p);
    }
    const pickAny = () => ['kotae', 'iranai', 'enzan', 'kimari'][Math.floor(Math.random() * 4)];

    function show(p) {
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* */ }
        lv.p = p;
        lv.ans = {};
        lv.bad = [];
        lv.tries = A.st.tries = 0;
        lv.hint = 0;
        lv.solved = false;
        lv.fresh = true;
        lv.act = boxKeys(p)[0] || '';
        $('play').hidden = false;
        $('result').hidden = true;
        $('qpane').hidden = false;
        $('apane').hidden = false;
        $('erabu').hidden = true;
        $('frame').hidden = true;
        $('lframe').hidden = false;
        $('pad').classList.add('lv');
        $('apane').classList.remove('solved');
        $('nextBtn').hidden = true;
        $('hintBtn').hidden = !!lv.test;
        $('hintBtn').disabled = false;
        $('play').classList.toggle('testing', !!lv.test);
        const t = info(p.type);
        $('qkind').textContent = lv.test
            ? '📝 ' + (lv.test.i + 1) + ' / ' + lv.test.list.length + '　' + t.name
            : t.icon + ' ' + t.name;
        $('checkBtn').textContent = !lv.test ? '✔ こたえあわせ'
            : lv.test.i + 1 < lv.test.list.length ? 'つぎへ ▶' : 'おわり ✔';
        drawQ();
        drawRows();
        setMsg('', '');
    }

    /* ---------- 問題の 文 ---------- */
    function drawQ() {
        const p = lv.p;
        const q = $('qtext');
        q.textContent = '';
        q.className = 'qtext' + (p.type === 'kimari' ? ' kimari' : '');
        lv.preview = '';
        if (p.type === 'tsukuru') {
            q.append(el('span', 'note', p.text), el('div', 'tsk'));
            drawTsk();
        } else if (p.segs) {
            p.segs.forEach(s => q.append(el('span', s.k ? 'seg ' + s.k : '', s.text)));
            if (p.q) q.append(el('span', 'q', p.q));
            q.append(el('span', 'note', p.type === 'enzan' ? '＋・−・× の どれかを えらんで、しきを 書こう。' : 'しきと 答えを 書こう。'));
        } else {
            q.append(el('span', 'q', p.text));
            if (p.type === 'bai') q.append(el('span', 'note', 'しきと 答えを 書こう。'));
        }
        const pic = $('pic');
        pic.textContent = '';
        pic.className = 'pic';
        if (p.type === 'bai' && p.sub === 'tape') figure(tapeEl(p, false));
        if (p.type === 'zu') figure(zuEl(p, []));
        if (A.set.color && !lv.test && p.segs) lv.hint = 1;
        applyHint();
    }

    function applyHint() {
        const p = lv.p;
        $('qtext').classList.toggle('color', lv.hint >= 1);
        $('qtext').classList.toggle('done', lv.solved);
        const pic = $('pic');
        if (lv.hint >= 2 && p.sid && !pic.childElementCount) {
            drawPic(pic, byId[p.sid], Array(p.b).fill(p.a));
            pic.classList.add('show');
        }
        if (lv.hint >= 1 && p.type === 'kimari' && !pic.childElementCount) drawKimariPic();
        if (p.type === 'bai' && (lv.hint >= 1 || lv.solved)) figure(tapeEl(p, true));
        if (p.type === 'zu') {
            /* こたえた あと・ヒント：あって いる もとめかた ／ れんしゅう中：さいごに えらんだ もとめかた */
            const show = lv.solved || lv.hint >= 1 ? p.opts.find(o => o.ok) : p.opts.find(o => o.text === lv.preview);
            figure(zuEl(p, show && show.parts ? show.parts : []));
        }
        if (p.type === 'tsukuru') drawTsk();
        $('hintBtn').disabled = lv.solved || lv.hint >= maxHint();
    }
    const maxHint = () => (lv.p.type === 'kotae' || lv.p.type === 'iranai') && lv.p.sid ? 2 : 1;

    /* ---------- 図（テープ・●の 図）：画面と いんさつで つかう ---------- */
    function figure(node) {
        const pic = $('pic');
        pic.textContent = '';
        pic.className = 'pic fig';
        pic.append(node);
    }

    /** テープの 図。open：1つ分ごとの ばんごうと ぜんぶの 長さ を 見せる */
    function tapeEl(p, open) {
        const u = p.u || 'cm';
        const t = el('div', 'tape');
        const bar = (cls, n, label) => {
            const row = el('div', 'trow ' + cls);
            row.append(el('span', 'tlab', label));
            const b = el('div', 'tbar');
            for (let i = 0; i < n; i++) {
                const seg = el('div', 'tseg');
                seg.style.width = 'calc(100% / ' + p.b + ')';
                seg.textContent = cls === 'base' ? p.a + u : open ? String(i + 1) : '';
                b.append(seg);
            }
            row.append(b);
            return row;
        };
        t.append(bar('base', 1, '1つ分'), bar('long' + (open ? ' open' : ''), p.b, p.sub === 'tape' && !open ? 'あ' : p.b + 'ばい'));
        const br = el('div', 'trow brace');
        br.append(el('span', 'tlab', ''));
        const bb = el('div', 'tbar');
        bb.append(el('div', 'tbr', open && lv.solved ? p.a * p.b + u : '？' + u));
        br.append(bb);
        t.append(br);
        return t;
    }

    /** ●の 図。parts：色を つける 四角（s:-1 は ひく ところ） */
    function zuEl(p, parts) {
        const wrap = el('div', 'zuwrap');
        const z = el('div', 'zu');
        z.style.setProperty('--w', p.W);
        z.style.setProperty('--h', p.H);
        const on = new Set(p.cells.map(c => c[0] + ',' + c[1]));
        for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) z.append(el('span', on.has(x + ',' + y) ? 'zd' : 'ze'));
        parts.forEach((r, i) => {
            const o = el('div', 'zr c' + i + (r.s < 0 ? ' minus' : ''));
            o.style.left = (r.x / p.W * 100) + '%';
            o.style.top = (r.y / p.H * 100) + '%';
            o.style.width = (r.w / p.W * 100) + '%';
            o.style.height = (r.h / p.H * 100) + '%';
            o.append(el('span', 'zlab', r.w + '×' + r.h));
            z.append(o);
        });
        wrap.append(z);
        return wrap;
    }

    /** もんだいづくりの 文（ア・イ・ウ の ところ） */
    function drawTsk() {
        const box = $('qtext').querySelector('.tsk');
        if (!box) return;
        const p = lv.p;
        box.textContent = '';
        p.parts.forEach(x => {
            if (x.text !== undefined) { box.append(el('span', '', x.text)); return; }
            const v = lv.ans[x.slot];
            const s = el('span', 'slot s' + x.slot + (v ? ' filled' : '') + (lv.bad.includes(x.slot) ? ' bad' : ''),
                v || { A: 'ア', B: 'イ', Q: 'ウ' }[x.slot]);
            box.append(s);
        });
    }

    /** かけ算の きまりの ●の 図（ふえた・へった 1つ分を だいだい色に） */
    function drawKimariPic() {
        const p = lv.p, pic = $('pic');
        let groups = 0, plus = -1;
        if (p.sub === 'up' || p.sub === 'eq') { groups = p.b; plus = p.b - 1; }
        else if (p.sub === 'down') { groups = p.b + 1; plus = p.b; }
        else if (p.sub === 'swap') groups = p.b;
        if (!groups) return;
        drawPic(pic, DOTS, Array(groups).fill(p.a));
        if (plus >= 0) pic.children[plus].classList.add('plus');
    }

    function hintMsg() {
        const p = lv.p, sc = p.sid && byId[p.sid];
        if (p.type === 'kimari') return kimariWhy(p.sub === 'same' ? 'fewer' : p.sub);
        if (p.type === 'bai') {
            return p.a + (p.u || 'cm') + ' の いくつ分 かな？ 「' + p.a + (p.u || 'cm') + ' の □つ分」の ことを 「' + p.a + (p.u || 'cm') + ' の □ばい」と いうよ。テープの ばんごうを 見てみよう。';
        }
        if (p.type === 'zu') return 'もとめかたの 1つを、図に 色で 見せるよ。ほかの もとめかたも あるかな？';
        if (p.type === 'tsukuru') {
            return 'しきの 前の 数（' + p.a + '）は 1つ分の 数で アに、うしろの 数（' + p.b + '）は いくつ分で イに 入るよ。かけ算で もとめるのは ぜんぶの 数 だよ。';
        }
        if (p.type === 'enzan') {
            if (p.op === '×') return '<b class="ca">青い ところ</b>と <b class="cb">だいだいの ところ</b>を 見てみよう。おなじ 数ずつ かな？';
            return '<b class="cw">きいろの ことば</b>が 合図だよ。ふえる？ へる？ ちがいを くらべる？';
        }
        if (lv.hint === 1) {
            return '<b class="ca">青い ところ</b>が 1つ分の 数、<b class="cb">だいだいの ところ</b>が いくつ分 だよ。'
                + (p.type === 'iranai' ? 'せんを ひいた 文は つかわないよ。' : '');
        }
        return '絵で 見てみよう。' + L.hintA(sc) + '　' + L.hintB(sc);
    }

    /* ---------- こたえる ところ ---------- */
    function drawRows() {
        const p = lv.p, box = $('lframe');
        box.textContent = '';
        box.classList.toggle('done', lv.solved);
        box.classList.toggle('big', p.type === 'kimari');
        p.rows.forEach(r => {
            const row = el('div', 'lrow');
            r.forEach(tk => {
                if (tk.t !== undefined) row.append(el('span', 'lt', tk.t));
                else if (tk.box) {
                    const b = el('button', 'box lbox' + (tk.d > 1 ? ' w2' : ''));
                    b.type = 'button';
                    b.dataset.k = tk.box;
                    b.textContent = lv.ans[tk.box] !== undefined ? lv.ans[tk.box] : '';
                    b.classList.toggle('act', !lv.solved && lv.act === tk.box);
                    b.classList.toggle('bad', lv.bad.includes(tk.box));
                    b.classList.toggle('good', lv.solved);
                    row.append(b);
                } else {
                    const k = tk.chips || tk.multi;
                    const g = el('div', 'chips' + (tk.inline ? ' inline' : '') + (tk.multi ? ' multi' : '') + (tk.wide ? ' wide' : ''));
                    g.classList.toggle('bad', lv.bad.includes(k));
                    tk.opts.forEach(o => {
                        const c = el('button', 'chip', o);
                        c.type = 'button';
                        c.dataset.k = k;
                        c.dataset.v = o;
                        const on = tk.multi ? (lv.ans[k] || []).includes(o) : lv.ans[k] === o;
                        c.classList.toggle('on', on);
                        if (lv.solved && tk.multi) c.classList.toggle('right', p.ans[k].includes(o));
                        g.append(c);
                    });
                    if (tk.chips === 'u') row.append(el('span', 'lt small', 'たんい'));
                    row.append(g);
                }
            });
            box.append(row);
        });
        $('checkBtn').disabled = lv.solved;
        /* 数を 書く わくが ない 問題は 数字カードを かくす */
        $('pad').classList.toggle('nobox', !boxKeys(p).length);
    }

    $('lframe').addEventListener('click', ev => {
        if (lv.solved || !lv.p) return;
        const b = ev.target.closest('.lbox');
        if (b) {
            lv.act = b.dataset.k;
            lv.fresh = true;
            drawRows();
            return;
        }
        const c = ev.target.closest('.chip');
        if (!c) return;
        const k = c.dataset.k, v = c.dataset.v, tk = tokenOf(lv.p, k);
        A.SND.tap();
        if (tk.multi) {
            const s = new Set(lv.ans[k] || []);
            if (s.has(v)) { s.delete(v); lv.preview = ''; } else { s.add(v); lv.preview = v; }
            lv.ans[k] = [...s];
            /* ●の 図：えらんだ もとめかたを 図に 色で 見せる（テストの ときは 見せない） */
            if (lv.p.type === 'zu' && !lv.test) applyHint();
        } else {
            lv.ans[k] = v;
            /* ＋−× を えらんだら つぎの わくへ */
            if (tk.inline && lv.ans.y === undefined) { lv.act = 'y'; lv.fresh = true; }
        }
        lv.bad = lv.bad.filter(x => x !== k);
        drawRows();
        if (lv.p.type === 'tsukuru') drawTsk();
    });

    function input(n) {
        if (lv.solved || !lv.act) return;
        const tk = tokenOf(lv.p, lv.act);
        let cur = lv.fresh || lv.bad.includes(lv.act) || lv.ans[lv.act] === undefined ? '' : String(lv.ans[lv.act]);
        if (n === 0 && cur === '') return;
        if (cur.length >= tk.d) cur = '';
        cur += n;
        A.SND.tap();
        lv.ans[lv.act] = Number(cur);
        lv.fresh = false;
        lv.bad = lv.bad.filter(x => x !== lv.act);
        if (cur.length >= tk.d) moveNext();
        drawRows();
        /* 1けたの わくだけの 問題（かけ算の きまり）は うまったら すぐ たしかめる */
        if (!lv.test && autoCheck() && V.filled(lv.p, lv.ans) && !lv.bad.length) setTimeout(check, 200);
    }
    const autoCheck = () => tokens(lv.p).every(t => !t.chips && !t.multi && (!t.box || t.d === 1));

    function moveNext() {
        const ks = boxKeys(lv.p);
        const i = ks.indexOf(lv.act);
        const rest = ks.slice(i + 1).concat(ks.slice(0, i));
        const nxt = rest.find(k => lv.bad.includes(k)) || rest.find(k => lv.ans[k] === undefined);
        if (nxt) lv.act = nxt;
        lv.fresh = true;
    }

    function erase() {
        if (lv.solved || !lv.act) return;
        const k = lv.act;
        if (lv.ans[k] === undefined) {
            const ks = boxKeys(lv.p);
            const i = ks.indexOf(k);
            if (i > 0) lv.act = ks[i - 1];
        } else {
            const s = String(lv.ans[lv.act]).slice(0, -1);
            if (s && !lv.fresh) lv.ans[lv.act] = Number(s);
            else delete lv.ans[lv.act];
        }
        lv.fresh = false;
        lv.bad = lv.bad.filter(x => x !== lv.act);
        drawRows();
    }

    /* ---------- こたえあわせ ---------- */
    function check() {
        if (lv.solved || !lv.p) return;
        const p = lv.p;
        if (!V.filled(p, lv.ans)) {
            setMsg('hint', '<span class="big">✏️</span>まだ 書いて いない ところが あるよ。');
            const empty = boxKeys(p).find(k => lv.ans[k] === undefined);
            if (empty) { lv.act = empty; lv.fresh = true; drawRows(); }
            return;
        }
        const r = V.checkLv(p, lv.ans);
        if (lv.test) {
            const T = lv.test;
            T.answers[T.i] = JSON.parse(JSON.stringify(lv.ans));
            T.results[T.i] = r;
            T.i++;
            A.SND.tap();
            if (T.i < T.list.length) next();
            else finishTest();
            return;
        }
        if (r.ok) return success();
        lv.tries++;
        A.st.tries = lv.tries;
        lv.bad = r.bad;
        const firstBox = r.bad.find(k => boxKeys(p).includes(k));
        if (firstBox) { lv.act = firstBox; lv.fresh = true; }
        A.SND.ng();
        if (lv.tries >= 2 && lv.hint < 1) lv.hint = 1;
        if (lv.tries >= 3 && lv.hint < maxHint()) lv.hint = maxHint();
        applyHint();
        setMsg('ng', '<span class="big">🤔</span>' + whyMsg(r.why));
        drawRows();
    }

    function success() {
        const p = lv.p;
        lv.solved = true;
        lv.bad = [];
        A.countUp();
        applyHint();
        drawRows();
        $('apane').classList.add('solved');
        $('nextBtn').hidden = false;
        setMsg('ok', '<span class="big">⭕</span>' + esc(V.answerText(p)));
        $('nextBtn').focus({ preventScroll: true });
    }
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

    /* ---------- まちがえた ときの ことば ---------- */
    function whyMsg(why) {
        const p = lv.p, sc = p.sid && byId[p.sid];
        const AB = '<b class="ca">1つ分の 数</b> × <b class="cb">いくつ分</b>';
        if (p.type === 'kotae' || p.type === 'iranai') {
            const a = p.ans.s1, b = p.ans.s2;
            const w = V.askWord(p.q);
            return {
                order: 'しきは ' + AB + ' の じゅんばんだよ。',
                extra: p.extra ? '「' + esc(L.fixReading(p.extra.replace('#C', p.c))) + '」は、この もんだいでは つかわない 数だよ。' + L.hintA(sc) : '',
                shiki: '1つ分の 数と いくつ分を さがそう。' + L.hintA(sc) + '　' + L.hintB(sc),
                prod: a + ' × ' + b + ' の 答えを たしかめよう。' + a + 'の だん：' + dan(a, b) + '…',
                n: '答えの 数は、しきの 答えと おなじ だよ。',
                unit: (w && w !== 'いくつ' ? 'きいて いるのは「' + w + '」だから、' : '') + 'たんいは「' + p.ans.u + '」だよ。何を かぞえて いるかな？',
            }[why] || '';
        }
        if (p.type === 'bai') {
            const u = p.u || 'cm', a = p.a, b = p.b;
            return {
                kai: a + u + ' の テープが いくつ分 あるかな？ 1つずつ かぞえよう。',
                order: a + u + ' の ' + b + 'ばい は、' + a + ' × ' + b + ' と 書くよ。（' + a + u + ' の ' + b + 'つ分）',
                shiki: 'もとの 数（' + a + u + '）× 何ばい の しきに なるよ。',
                prod: a + ' × ' + b + ' の 答えを たしかめよう。' + a + 'の だん：' + dan(a, b) + '…',
                n: '答えの 数は、しきの 答えと おなじ だよ。',
            }[why] || '';
        }
        if (p.type === 'zu') {
            return {
                wrongPick: 'えらんだ 中に、図と あわない もとめかたが あるよ。えらぶと 図に 色が つくので、たしかめよう。',
                fewer: 'あって いる もとめかたは 2つ あるよ。',
                count: '●の 数が ちがうよ。えらんだ もとめかたで 計算して、たしかめよう。',
            }[why] || '';
        }
        if (p.type === 'tsukuru') {
            return {
                swap: p.a + ' × ' + p.b + ' の ' + p.a + ' は 1つ分の 数（アに 入る）、' + p.b + ' は いくつ分（イに 入る）だよ。',
                A: 'アには 1つ分の 数（' + p.a + '）が 入るよ。',
                B: 'イには いくつ分（' + p.b + '）が 入るよ。',
                Q: 'かけ算で もとめるのは、ぜんぶの 数 だよ。',
            }[why] || '';
        }
        if (p.type === 'enzan') {
            const w = (p.segs.find(s => s.k === 'w') || {}).text;
            return {
                op: p.op === '×' ? 'おなじ 数ずつ の いくつ分 だから、かけ算 だよ。'
                    : p.op === '＋' ? '「' + w + '」 だから、たし算 だよ。'
                        : '「' + w + '」 だから、ひき算 だよ。',
                order: 'かけ算の しきは ' + AB + ' の じゅんばんだよ。',
                subOrder: 'ひき算は、大きい 数から 小さい 数を ひくよ。',
                nums: 'もんだいの 数を よく 見て、しきを 書こう。',
            }[why] || '';
        }
        return kimariWhy(why);
    }
    function kimariWhy(why) {
        const p = lv.p, a = p.a, b = p.b;
        switch (why) {
            case 'up': case 'eq':
                return 'かける数が 1 ふえると、答えは かけられる数だけ ふえるよ。（' + a + 'の だん：' + dan(a, b) + '）';
            case 'down':
                return 'かける数が 1 へると、答えは かけられる数だけ へるよ。（' + a + 'の だん：' + dan(a, b + 1) + '）';
            case 'swap':
                return 'かけられる数と かける数を 入れかえて 計算しても、答えは おなじ だよ。';
            case 'blank': {
                const fixed = p.ans.x === b ? a : b;
                const list = Array.from({ length: 9 }, (_, i) => (p.ans.x === b ? fixed + '×' + (i + 1) : (i + 1) + '×' + fixed) + '＝' + fixed * (i + 1))
                    .slice(0, Math.min(9, p.ans.x + 1)).join('、');
                return '九九を じゅんに 言って みよう。' + list;
            }
            case 'fewer':
                return p.P + ' に なる 九九は ぜんぶで ' + p.ans.m.length + 'こ あるよ。1の だんから じゅんに たしかめよう。';
            case 'wrongPick':
                return 'えらんだ 中に、答えが ' + p.P + ' に ならない ものが あるよ。';
            case 'order':
            case 'words':
                return '× の 前の 数が かけられる数、× の うしろの 数が かける数 だよ。';
            default:
                return 'もう いちど 考えて みよう。';
        }
    }

    function hint() {
        if (lv.solved || lv.test) return;
        lv.hint = Math.min(maxHint(), lv.hint + 1);
        applyHint();
        setMsg('hint', '<span class="big">💡</span>' + hintMsg());
    }

    /* ---------- ミニテスト ---------- */
    function startTest() {
        lv.test = { list: V.makeTest(gen), i: 0, answers: [], results: [], t0: Date.now() };
        next();
    }

    function myAnswer(p, ans) {
        if (!ans) return '';
        if (p.type === 'kotae' || p.type === 'iranai') return ans.s1 + '×' + ans.s2 + '＝' + ans.p + '　' + L.fixReading(ans.n + (ans.u || ''));
        if (p.type === 'enzan') return ans.x + ' ' + ans.op + ' ' + ans.y;
        if (p.type === 'bai') return (ans.k !== undefined ? ans.k + 'ばい　' : '') + ans.s1 + '×' + ans.s2 + '＝' + ans.p + '　' + ans.n + (p.u || 'cm');
        if (p.type === 'zu') return (ans.m || []).join('／') + '　' + ans.n + 'こ';
        if (p.type === 'tsukuru') return V.tsukuruText(p, ans);
        if (p.sub === 'same') return (ans.m || []).join('、');
        return Object.keys(p.ans).map(k => ans[k]).join('・');
    }
    function qSummary(p) {
        if (p.type === 'tsukuru') return p.text + '　' + V.tsukuruText(p, {});
        if (p.type === 'zu' || p.type === 'bai') return p.text;
        return p.segs ? L.plain(p.segs) + (p.q || '') : p.text + '　' + V.rowsText(p);
    }

    function finishTest() {
        const T = lv.test;
        const score = V.testScore(T.results);
        const sec = Math.round((Date.now() - T.t0) / 1000);
        A.rec.tests.push({ d: Date.now(), s: score });
        A.rec.best = Math.max(A.rec.best || 0, score);
        A.save();
        $('play').hidden = true;
        $('play').classList.remove('testing');
        const R = $('result');
        R.hidden = false;
        R.textContent = '';
        const head = el('div', 'rhead');
        head.append(
            el('div', 'rstamp', score === 100 ? '🎉' : score >= 80 ? '🌟' : '💪'),
            el('div', 'rscore', score + '点'),
            el('div', 'rsub', (score === 100 ? 'まんてん！ すごい！' : score >= 80 ? 'よく できました！' : 'まちがえた ところを れんしゅう しよう！')
                + '　（' + (sec >= 60 ? Math.floor(sec / 60) + '分 ' : '') + (sec % 60) + 'びょう）'),
        );
        const list = el('ol', 'rlist');
        T.list.forEach((p, i) => {
            const r = T.results[i];
            const li = el('li', r.ok ? 'ok' : r.score ? 'half' : 'ng');
            li.append(
                el('span', 'rmark', r.ok ? '⭕' : r.score ? '△' : '❌'),
                el('span', 'rkind', info(p.type).icon + ' ' + info(p.type).name),
                el('span', 'rq', qSummary(p)),
                el('span', 'rmine', 'あなた：' + myAnswer(p, T.answers[i])),
                el('span', 'rright', r.ok ? '' : 'せいかい：' + V.answerText(p)),
                el('span', 'rpt', r.score + '点'),
            );
            list.append(li);
        });
        const btns = el('div', 'rbtns');
        const wrong = T.list.filter((p, i) => !T.results[i].ok);
        if (wrong.length) {
            const b = el('button', 'btn go', '✏️ まちがえた もんだいを れんしゅう（' + wrong.length + 'もん）');
            b.type = 'button';
            b.addEventListener('click', () => {
                const w = V.weakTypes(T.list, T.results);
                lv.weak = Object.keys(w).sort((x, y) => w[y] - w[x])[0] || '';
                lv.queue = wrong.map(p => JSON.parse(JSON.stringify(p)));
                lv.test = null;
                $('modeTag').textContent = '✏️ やりなおし';
                next();
            });
            btns.append(b);
        }
        const again = el('button', 'btn', '📝 もう いちど テスト');
        again.type = 'button';
        again.addEventListener('click', () => { $('modeTag').textContent = '📝 ミニテスト'; startTest(); });
        const pr = el('button', 'btn soft', '🖨️ この テストを いんさつ');
        pr.type = 'button';
        pr.addEventListener('click', () => printTest(T.list));
        btns.append(again, pr);
        R.append(head, btns, list);
        A.SND[score >= 80 ? 'fan' : 'ok']();
    }

    /* ---------- いんさつ ---------- */
    function printTest(list) {
        const P = $('printArea');
        P.textContent = '';
        const sheet = (withAns) => {
            const s = el('section', 'psheet');
            const h = el('div', 'phead');
            h.append(el('h1', '', withAns ? 'かけ算 ミニテスト　答え' : 'かけ算 ミニテスト'),
                el('div', 'pname', withAns ? '' : '2年　　組　名前（　　　　　　　　　　）　　　　／100点'));
            s.append(h);
            list.forEach((p, i) => {
                const q = el('div', 'pq');
                q.append(el('div', 'pno', (i + 1) + '.'), el('div', 'pbody'));
                const body = q.lastChild;
                if (p.segs) {
                    body.append(el('div', 'ptext', L.plain(p.segs) + (p.q || '')));
                    if (withAns) body.append(el('div', 'pans', V.answerText(p)));
                    else if (p.type === 'enzan') body.append(el('div', 'pline', 'しき（　　　　　　　　　　　）'));
                    else body.append(el('div', 'pline', 'しき（　　　　　　　　　　　）　答え（　　　　　　）'));
                } else if (p.type === 'bai') {
                    body.append(el('div', 'ptext', p.text));
                    if (p.sub === 'tape') body.append(tapeEl(p, withAns));
                    if (withAns) body.append(el('div', 'pans', V.answerText(p)));
                    else body.append(el('div', 'pline', (p.ans.k !== undefined ? p.a + 'cm の（　　）ばい　　' : '') + 'しき（　　　　　　　　　　　）　答え（　　　　　　）'));
                } else if (p.type === 'zu') {
                    body.append(el('div', 'ptext', p.text));
                    body.append(zuEl(p, withAns ? p.opts.find(o => o.ok).parts : []));
                    if (withAns) body.append(el('div', 'pans', V.answerText(p)));
                    else {
                        body.append(el('div', 'pline small', 'あって いる もとめかたに ○を つけよう。'));
                        p.opts.forEach(o => body.append(el('div', 'pline small', '（　）' + o.text)));
                        body.append(el('div', 'pline', '●は ぜんぶで（　　　　）こ'));
                    }
                } else if (p.type === 'tsukuru') {
                    body.append(el('div', 'ptext', p.text));
                    body.append(el('div', 'pline', withAns ? V.tsukuruText(p, p.ans) : V.tsukuruText(p, {})));
                    if (!withAns) {
                        ['A', 'B', 'Q'].forEach(k => body.append(el('div', 'pline small', { A: 'ア', B: 'イ', Q: 'ウ' }[k] + '：' + p.cards[k].join('　／　'))));
                    }
                } else {
                    body.append(el('div', 'ptext', p.text));
                    if (p.sub === 'same') {
                        body.append(el('div', 'pline', tokens(p)[0].opts.join('　　') + (withAns ? '' : '　（あてはまる ものに ○）')));
                        if (withAns) body.append(el('div', 'pans', V.answerText(p)));
                    } else if (withAns) body.append(el('div', 'pans', V.answerText(p)));
                    else {
                        /* □は 書きこめる 大きさの ます に する */
                        const line = el('div', 'pline');
                        V.rowsText(p).split('□').forEach((part, i) => {
                            if (i) line.append(el('span', 'pbox'));
                            line.append(document.createTextNode(part));
                        });
                        body.append(line);
                    }
                }
                s.append(q);
            });
            s.append(el('div', 'pfoot', '© Hiroyuki　いくつ分 しきづくり'));
            return s;
        };
        P.append(sheet(false), sheet(true));
        window.print();
    }
    function printNew() {
        printTest(V.makeTest(gen));
    }

    /* ---------- キー・よみあげ ---------- */
    function key(ev) {
        if (!$('result').hidden) return;
        if (/^[0-9]$/.test(ev.key)) input(Number(ev.key));
        else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); erase(); }
        else if (ev.key === 'Enter') {
            ev.preventDefault();
            if (lv.solved) next(); else check();
        } else if (ev.key === 'Tab' && !lv.solved) {
            ev.preventDefault();
            const ks = boxKeys(lv.p);
            if (!ks.length) return;
            lv.act = ks[(ks.indexOf(lv.act) + (ev.shiftKey ? ks.length - 1 : 1)) % ks.length];
            lv.fresh = true;
            drawRows();
        }
    }
    function sayText() {
        const p = lv.p;
        if (p.type === 'tsukuru') return (p.text + '　' + V.tsukuruText(p, lv.ans)).replace(/［ア］/g, ' ア ').replace(/［イ］/g, ' イ ').replace(/［ウ］/g, ' ウ ');
        return (p.segs ? L.plain(p.segs) + (p.q || '') : p.text + '　' + V.rowsText(p))
            .replace(/□/g, ' しかく ').replace(/○/g, ' まる ').replace(/＝/g, ' は ').replace(/＋/g, ' たす ');
    }

    window.IkutsuLvApp = { start, stop, next, input, erase, check, hint, key, sayText, printNew, current: () => lv.p };
})();
