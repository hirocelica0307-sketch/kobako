/* いくつ分 しきづくり ── 画面と うごき
   きまり（出題・はんてい）は logic.js、ばめんは scenes.js に あります。 */
(function () {
    'use strict';
    const L = window.IkutsuLogic;
    const SCENES = window.IkutsuScenes;
    const byId = Object.fromEntries(SCENES.map(s => [s.id, s]));
    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };

    /* ---------- きろく・せってい（この ブラウザに だけ のこす） ---------- */
    const STORE = 'ikutsubun.v1';
    const saved = (() => {
        try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
    })();
    const rec = { total: saved.total || 0, days: saved.days || {} };
    const set = {
        steps: saved.steps === 'shiki' ? 'shiki' : 'full',
        color: !!saved.color,
        sound: saved.sound !== false,
    };
    function save() {
        try {
            /* 日の きろくは さいきんの 60日分 だけ */
            const keys = Object.keys(rec.days).sort();
            keys.slice(0, Math.max(0, keys.length - 60)).forEach(k => delete rec.days[k]);
            localStorage.setItem(STORE, JSON.stringify({ total: rec.total, days: rec.days, ...set }));
        } catch (e) { /* のこせなくても つづける */ }
    }
    const today = () => L.dayKey(new Date());

    /* URL の せっていが あれば そちらを つかう（Classroom で くばる とき） */
    const fromHash = L.parseHash(location.hash);
    if (/[#&]s=/.test(location.hash)) set.steps = fromHash.steps;
    if (/[#&]c=/.test(location.hash)) set.color = fromHash.color;

    /* ---------- おと ---------- */
    let actx = null;
    function beep(notes) {
        if (!set.sound) return;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            let t = actx.currentTime + .01;
            notes.forEach(([f, d, type]) => {
                const o = actx.createOscillator(), g = actx.createGain();
                o.type = type || 'sine';
                o.frequency.value = f;
                g.gain.setValueAtTime(.0001, t);
                g.gain.exponentialRampToValueAtTime(.18, t + .015);
                g.gain.exponentialRampToValueAtTime(.0001, t + d);
                o.connect(g).connect(actx.destination);
                o.start(t);
                o.stop(t + d + .02);
                t += d * .85;
            });
        } catch (e) { /* おとが 出なくても つづける */ }
    }
    const SND = {
        tap: () => beep([[660, .05, 'triangle']]),
        ok: () => beep([[880, .14], [1175, .26]]),
        ng: () => beep([[220, .18, 'triangle']]),
        fan: () => beep([[784, .12], [988, .12], [1175, .12], [1568, .35]]),
    };

    /* ---------- よみあげ ---------- */
    function say(text) {
        try {
            const ss = window.speechSynthesis;
            if (!ss) return;
            ss.cancel();
            const u = new SpeechSynthesisUtterance(text.replace(/×/g, ' かける ').replace(/dL/g, 'デシリットル'));
            u.lang = 'ja-JP';
            u.rate = .9;
            const v = ss.getVoices().find(v => /^ja/i.test(v.lang));
            if (v) u.voice = v;
            ss.speak(u);
        } catch (e) { /* よめなくても つづける */ }
    }

    /* ---------- じょうたい ---------- */
    const gen = L.makeGen(SCENES);
    const st = {
        mode: '',        // mix / kihon / gyaku / e / erabu
        p: null,         // いまの 問題
        ans: {},         // わくに 入れた 数
        act: '',         // えらんで いる わく
        bad: [],         // まちがえた わく
        tries: 0,
        hint: 0,         // 0：なし 1：色 2：絵
        solved: false,
        cardMode: 'pic', // えらぶ 問題の せんたくし（pic / text）
        n: 0, first: 0,  // この かいで とけた 数・1かいで せいかいした 数
    };
    const keys = () => set.steps === 'shiki' ? ['s1', 's2'] : ['one', 'many', 's1', 's2'];

    /* ---------- はじめの 画面 ---------- */
    const MODE_INFO = {
        mix: { icon: '🌈', name: 'ぜんぶ まぜる', sub: 'いろいろな 問題が まざって 出るよ（おすすめ）' },
    };
    L.TYPES.forEach(t => { MODE_INFO[t.id] = { icon: t.icon, name: t.name, sub: t.sub }; });

    function buildHome() {
        const box = $('modes');
        box.textContent = '';
        ['mix', 'kihon', 'gyaku', 'e', 'erabu'].forEach(id => {
            const m = MODE_INFO[id];
            const b = el('button', 'btn mode' + (id === 'mix' ? ' rec' : ''));
            b.type = 'button';
            b.append(el('span', 'i', m.icon), el('span', '', m.name), el('small', '', m.sub));
            b.addEventListener('click', () => start(id));
            box.append(b);
        });
        showRecord();
    }
    function showRecord() {
        const d = rec.days[today()] || 0;
        $('record').textContent = rec.total
            ? 'きょう ' + d + 'もん ／ これまで ぜんぶで ' + rec.total + 'もん'
            : '';
    }

    function goHome() {
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* */ }
        st.mode = '';
        $('home').hidden = false;
        $('play').hidden = true;
        $('homeBtn').hidden = true;
        $('modeTag').hidden = true;
        $('count').hidden = true;
        $('barTitle').hidden = false;
        if (st.n) toast('🌟 ' + st.n + 'もん できたね！', st.first ? '1かいで せいかい ' + st.first + 'もん' : '');
        st.n = 0;
        st.first = 0;
        showRecord();
        writeHash();
    }

    function start(mode) {
        st.mode = mode;
        st.n = 0;
        st.first = 0;
        $('home').hidden = true;
        $('play').hidden = false;
        $('homeBtn').hidden = false;
        $('count').hidden = false;
        $('barTitle').hidden = window.innerWidth < 900;
        $('modeTag').hidden = false;
        $('modeTag').textContent = MODE_INFO[mode].icon + ' ' + MODE_INFO[mode].name;
        updateCount();
        writeHash();
        nextProblem();
    }

    function writeHash() {
        const h = L.makeHash({ m: st.mode, steps: set.steps, color: set.color });
        try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { /* */ }
    }

    function updateCount() {
        $('solved').textContent = st.n;
        const s = Math.floor(st.n / 10);
        $('stars').textContent = s > 5 ? '⭐×' + s : '⭐'.repeat(s);
    }

    /* ---------- 問題を 出す ---------- */
    function nextProblem() {
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* */ }
        const p = gen.next(st.mode);
        st.p = p;
        st.ans = {};
        st.bad = [];
        st.tries = 0;
        st.hint = 0;
        st.solved = false;
        st.act = keys()[0];
        if (p.type === 'erabu') return showErabu();
        $('qpane').hidden = false;
        $('apane').hidden = false;
        $('erabu').hidden = true;
        $('apane').classList.remove('solved');
        $('nextBtn').hidden = true;
        showQuestion();
        drawFrame();
        setMsg('', '');
    }

    function showQuestion() {
        const p = st.p, sc = byId[p.sid];
        const q = $('qtext');
        q.textContent = '';
        q.className = 'qtext';
        $('qkind').textContent = MODE_INFO[p.type].icon + ' ' + MODE_INFO[p.type].name;
        if (p.type === 'e') {
            q.append(el('span', 'note', 'えを 見て、しきを つくろう。'), el('span', 'q', sc.q));
            drawPic($('pic'), sc, Array(p.b).fill(p.a));
        } else {
            p.segs.forEach(s => q.append(el('span', s.k ? 'seg ' + s.k : '', s.text)));
            q.append(el('span', 'q', sc.q));
            $('pic').textContent = '';
            $('pic').className = 'pic';
        }
        if (set.color && p.type !== 'e') st.hint = 1;
        applyHint();
    }

    /* ---------- 絵 ---------- */
    /** groups：まとまりごとの 数（[3, 3, 3, 3] など） */
    function drawPic(box, sc, groups, mini) {
        box.textContent = '';
        box.className = 'pic' + (sc.row ? ' rows' : '');
        groups.forEach((n, gi) => {
            const g = el('div', 'grp' + (gi === 0 ? ' first' : ''));
            if (sc.box && !sc.row) g.append(el('div', 'hd', sc.box));
            const its = el('div', 'its');
            const cols = sc.row ? n : n <= 3 ? n : n === 4 ? 2 : 3;
            its.style.setProperty('--cols', Math.max(1, cols));
            for (let i = 0; i < n; i++) {
                const it = el('span', 'it' + (sc.e ? '' : ' dot'), sc.e || '');
                its.append(it);
            }
            g.append(its, el('span', 'no', String(gi + 1)), el('span', 'one', '1つ分'));
            box.append(g);
        });
        fitPic(box, mini);
    }
    /** 絵が はみ出さない 大きさに する */
    function fitPic(box, mini) {
        requestAnimationFrame(() => {
            let size = mini ? 2.2 : 3.2;
            const min = mini ? .7 : .9;
            box.style.setProperty('--isz', size + 'rem');
            while (size > min && (box.scrollHeight > box.clientHeight + 2 || box.scrollWidth > box.clientWidth + 2)) {
                size = Math.round((size - .1) * 100) / 100;
                box.style.setProperty('--isz', size + 'rem');
            }
        });
    }
    let fitTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(fitTimer);
        fitTimer = setTimeout(() => {
            document.querySelectorAll('.pic').forEach(b => { if (b.childElementCount) fitPic(b, !!b.closest('.card')); });
        }, 120);
    });

    /* ---------- ヒント ---------- */
    function applyHint() {
        const p = st.p, sc = byId[p.sid];
        const q = $('qtext'), pic = $('pic');
        q.classList.toggle('color', st.hint >= 1);
        q.classList.toggle('done', st.solved);
        if (p.type === 'e') {
            pic.classList.toggle('show', st.hint >= 1 || st.solved);
        } else if (st.hint >= 2 || (st.solved && st.hint >= 2)) {
            if (!pic.childElementCount) drawPic(pic, sc, Array(p.b).fill(p.a));
            pic.classList.add('show');
        }
        $('hintBtn').disabled = st.solved || st.hint >= 2 || (p.type === 'e' && st.hint >= 1);
    }
    function hintMsg() {
        const p = st.p, sc = byId[p.sid];
        if (p.type === 'e') return '青い わくが 1つ分。' + L.hintA(sc) + '　まとまりの 数（だいだいの 数字）が いくつ分。';
        if (st.hint === 1) return '<b class="ca">青い ところ</b>が 1つ分の 数、<b class="cb">だいだいの ところ</b>が いくつ分 だよ。';
        return '絵で 見てみよう。' + L.hintA(sc) + '　' + L.hintB(sc);
    }

    /* ---------- わく ---------- */
    function drawFrame() {
        const p = st.p, sc = byId[p.sid];
        const fr = $('frame');
        fr.classList.toggle('shiki-only', set.steps === 'shiki');
        fr.classList.toggle('done', st.solved);
        fr.querySelectorAll('.box').forEach(b => {
            const k = b.dataset.k;
            b.textContent = st.ans[k] || '';
            b.classList.toggle('act', !st.solved && st.act === k);
            b.classList.toggle('bad', st.bad.includes(k));
            b.classList.toggle('good', st.solved);
        });
        $('unitA').textContent = L.unitA(sc, st.ans.one);
        $('unitB').textContent = L.unitB(sc, st.ans.many);
    }

    function setMsg(cls, html) {
        const m = $('msg');
        m.className = 'msg' + (cls ? ' ' + cls : '');
        m.innerHTML = html;
    }

    function input(n) {
        if (st.solved || !st.p || st.p.type === 'erabu') return;
        const ks = keys();
        if (!ks.includes(st.act)) st.act = ks[0];
        SND.tap();
        st.ans[st.act] = n;
        st.bad = st.bad.filter(k => k !== st.act);
        /* つぎの わくへ（まちがえた わくが あれば そこへ） */
        const i = ks.indexOf(st.act);
        const rest = ks.slice(i + 1).concat(ks.slice(0, i));
        const nxt = rest.find(k => st.bad.includes(k)) || rest.find(k => !st.ans[k]);
        if (nxt) st.act = nxt;
        drawFrame();
        if (ks.every(k => st.ans[k]) && !st.bad.length) setTimeout(judge, 180);
    }

    function erase() {
        if (st.solved || !st.p || st.p.type === 'erabu') return;
        const ks = keys();
        if (!st.ans[st.act]) {
            const i = ks.indexOf(st.act);
            if (i > 0) st.act = ks[i - 1];
        }
        delete st.ans[st.act];
        st.bad = st.bad.filter(k => k !== st.act);
        drawFrame();
    }

    function judge() {
        if (st.solved) return;
        const p = st.p, sc = byId[p.sid];
        const ks = keys();
        if (!ks.every(k => st.ans[k])) return;
        const r = L.check(p, st.ans, set.steps);
        if (r.ok) return success();
        st.tries++;
        st.bad = r.bad;
        st.act = r.bad[0];
        SND.ng();
        const isE = p.type === 'e';
        const A = isE ? '1つの まとまりを かぞえてみよう。' : L.hintA(sc);
        const B = isE ? 'まとまりは いくつ あるかな？' : L.hintB(sc);
        const MSG = {
            swap: '1つ分の 数と いくつ分が いれかわって いるよ。' + A,
            one1: '「' + sc.one + '」の 1 では ないよ。' + A,
            one: '1つ分の 数が ちがうよ。' + A,
            many: 'いくつ分が ちがうよ。' + B,
            order: 'しきは <b class="ca">1つ分の 数</b> × <b class="cb">いくつ分</b> の じゅんばんだよ。',
            shiki: set.steps === 'shiki'
                ? 'しきは <b class="ca">1つ分の 数</b> × <b class="cb">いくつ分</b>。' + A
                : 'しきには 上の 2つの 数を 入れるよ。<b class="ca">1つ分の 数</b> × <b class="cb">いくつ分</b>。',
        };
        /* 2かい まちがえたら 色の ヒントを 出す */
        if (st.tries >= 2 && st.hint < 1) st.hint = 1;
        if (st.tries >= 3 && st.hint < 2 && !isE) st.hint = 2;
        applyHint();
        setMsg('ng', '<span class="big">🤔</span>' + MSG[r.why]);
        drawFrame();
    }

    function success() {
        const p = st.p, sc = byId[p.sid];
        st.solved = true;
        st.bad = [];
        countUp();
        applyHint();
        drawFrame();
        $('apane').classList.add('solved');
        $('nextBtn').hidden = false;
        setMsg('ok', '<span class="big">⭕</span>' + L.phrase(sc, p.a, p.b) + ' → ' + p.a + ' × ' + p.b);
        $('nextBtn').focus({ preventScroll: true });
    }

    function countUp() {
        st.n++;
        if (st.tries === 0) st.first++;
        rec.total++;
        rec.days[today()] = (rec.days[today()] || 0) + 1;
        save();
        updateCount();
        if (st.n % 10 === 0) {
            SND.fan();
            toast('🌟 ' + st.n + 'もん クリア！', 'その ちょうし！');
        } else {
            SND.ok();
        }
    }

    let toastTimer = 0;
    function toast(big, small) {
        const t = $('toast');
        t.textContent = big;
        if (small) t.append(el('small', '', small));
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
    }

    /* ---------- しきから えらぶ ---------- */
    function showErabu() {
        const p = st.p, sc = byId[p.sid];
        $('qpane').hidden = true;
        $('apane').hidden = true;
        $('erabu').hidden = false;
        $('enextBtn').hidden = true;
        st.cardMode = Math.random() < .5 ? 'pic' : 'text';
        const eq = $('eq');
        eq.textContent = '';
        eq.append(
            el('span', '', 'しきが '),
            el('span', 'shiki', p.a + ' × ' + p.b),
            el('span', '', ' に なる のは どれ？'),
            el('div', 'note', '（' + sc.name + 'の ばめん）'),
        );
        const cards = $('cards');
        cards.textContent = '';
        p.choices.forEach((c, i) => {
            const b = el('button', 'card');
            b.type = 'button';
            b.append(el('span', 'cno', ['ア', 'イ', 'ウ'][i]));
            if (st.cardMode === 'pic') {
                const pic = el('div', 'pic');
                b.append(pic);
                b.append(el('span', 'cshiki', ''));
                cards.append(b);
                drawPic(pic, sc, c.kind === 'tasu' ? [c.a, c.b] : Array(c.b).fill(c.a), true);
            } else {
                b.append(el('span', 'ctext', L.cardText(sc, c)), el('span', 'cshiki', ''));
                cards.append(b);
            }
            b.addEventListener('click', () => pickCard(i));
        });
        $('emsg').className = 'msg';
        $('emsg').textContent = '';
    }

    function shikiOf(c) {
        return c.kind === 'tasu' ? c.a + ' ＋ ' + c.b : c.a + ' × ' + c.b;
    }

    function pickCard(i) {
        if (st.solved) return;
        const p = st.p, sc = byId[p.sid];
        const c = p.choices[i];
        const card = $('cards').children[i];
        if (card.classList.contains('ng')) return;
        const m = $('emsg');
        if (c.kind === 'ok') {
            st.solved = true;
            card.classList.add('ok');
            card.querySelector('.cshiki').textContent = shikiOf(c);
            const pic = card.querySelector('.pic');
            if (pic) pic.classList.add('show');
            countUp();
            m.className = 'msg ok';
            m.innerHTML = '<span class="big">⭕</span>' + L.phrase(sc, p.a, p.b) + ' → ' + p.a + ' × ' + p.b;
            $('enextBtn').hidden = false;
            $('enextBtn').focus({ preventScroll: true });
            return;
        }
        st.tries++;
        SND.ng();
        card.classList.add('ng');
        card.querySelector('.cshiki').textContent = shikiOf(c);
        m.className = 'msg ng';
        m.innerHTML = '<span class="big">🤔</span>' + (c.kind === 'tasu'
            ? 'これは おなじ 数ずつ では ないね。' + shikiOf(c) + ' に なるよ。'
            : 'これは ' + L.phrase(sc, c.a, c.b) + ' だから ' + shikiOf(c) + ' だよ。');
    }

    /* ---------- せってい ---------- */
    function syncSettings() {
        document.querySelectorAll('.sopts[data-set]').forEach(g => {
            const k = g.dataset.set;
            const v = k === 'steps' ? set.steps : set[k] ? '1' : '0';
            g.querySelectorAll('.btn').forEach(b => b.classList.toggle('on', b.value === v));
        });
        $('soundIcon').textContent = set.sound ? '🔔' : '🔕';
    }
    document.querySelectorAll('.sopts[data-set]').forEach(g => {
        g.addEventListener('click', ev => {
            const b = ev.target.closest('.btn');
            if (!b) return;
            const k = g.dataset.set;
            const before = set.steps;
            if (k === 'steps') set.steps = b.value;
            else set[k] = b.value === '1';
            save();
            syncSettings();
            writeHash();
            if (st.mode && st.p && st.p.type !== 'erabu' && !st.solved) {
                if (k === 'steps' && before !== set.steps) {
                    st.ans = {};
                    st.bad = [];
                    st.act = keys()[0];
                    drawFrame();
                    setMsg('', '');
                }
                if (k === 'color' && set.color && st.hint < 1 && st.p.type !== 'e') {
                    st.hint = 1;
                    applyHint();
                }
            }
        });
    });
    $('setBtn').addEventListener('click', () => {
        syncSettings();
        $('setDlg').showModal();
    });
    $('soundBtn').addEventListener('click', () => {
        set.sound = !set.sound;
        save();
        syncSettings();
        if (set.sound) SND.tap();
    });
    $('copyBtn').addEventListener('click', async () => {
        const url = location.href.split('#')[0] + L.makeHash({ m: st.mode, steps: set.steps, color: set.color });
        try {
            await navigator.clipboard.writeText(url);
            $('copyBtn').textContent = 'コピー しました';
        } catch (e) {
            prompt('この リンクを コピー して ください', url);
        }
        setTimeout(() => { $('copyBtn').textContent = 'いまの せっていの リンクを コピー'; }, 1800);
    });

    /* ---------- ボタン・キー ---------- */
    function buildPad() {
        const pad = $('pad');
        for (let n = 1; n <= 9; n++) {
            const b = el('button', 'btn', String(n));
            b.type = 'button';
            b.addEventListener('click', () => input(n));
            pad.append(b);
        }
        const d = el('button', 'btn soft del', '⌫ けす');
        d.type = 'button';
        d.addEventListener('click', erase);
        pad.append(d);
    }
    $('frame').addEventListener('click', ev => {
        const b = ev.target.closest('.box');
        if (!b || st.solved) return;
        st.act = b.dataset.k;
        drawFrame();
    });
    $('nextBtn').addEventListener('click', nextProblem);
    $('enextBtn').addEventListener('click', nextProblem);
    $('homeBtn').addEventListener('click', goHome);
    $('hintBtn').addEventListener('click', () => {
        if (st.solved) return;
        st.hint = Math.min(st.p.type === 'e' ? 1 : 2, st.hint + 1);
        applyHint();
        setMsg('hint', '<span class="big">💡</span>' + hintMsg());
    });
    $('sayBtn').addEventListener('click', () => {
        const p = st.p, sc = byId[p.sid];
        say(p.type === 'e' ? 'えを 見て、しきを つくろう。' + sc.q : L.plain(p.segs) + sc.q);
    });

    document.addEventListener('keydown', ev => {
        if (!st.mode || $('setDlg').open || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const p = st.p;
        if (st.solved && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            nextProblem();
            return;
        }
        if (p && p.type === 'erabu') {
            const i = ['1', '2', '3'].indexOf(ev.key);
            if (i >= 0) pickCard(i);
            return;
        }
        if (/^[1-9]$/.test(ev.key)) input(Number(ev.key));
        else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); erase(); }
        else if (ev.key === 'Tab' && !st.solved) {
            ev.preventDefault();
            const ks = keys();
            st.act = ks[(ks.indexOf(st.act) + (ev.shiftKey ? ks.length - 1 : 1)) % ks.length];
            drawFrame();
        }
    });

    /* ---------- はじめる ---------- */
    buildPad();
    buildHome();
    syncSettings();
    if (fromHash.m) start(fromHash.m);
})();
