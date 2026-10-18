/* 毎日教養 ── 画面の 動き
   ホーム（今日の セット）・問題・おわり・教養ノート・記録・設定。
   記録は この 端末の localStorage だけに 保存する（サーバーなし）。 */
(function () {
    'use strict';
    const L = window.MKLogic;
    const D = window.MKData;
    const I = window.MKIcons;
    // 読みこみに 失敗した ファイルが あると 画面が 空の まま 動かなく なるので、そのことを 知らせる
    if (!L || !D || !I || !D.GENRES || !Object.keys(D.rows || {}).length) {
        const box = document.getElementById('todayCard');
        const msg = '<p style="margin:0 0 12px">アプリのファイルを読みこめませんでした。電波のよい場所で、ページを読みこみ直してください。</p>' +
            '<button class="btn main wide" type="button" onclick="location.reload()">読みこみ直す</button>';
        if (box) box.innerHTML = msg; else document.body.insertAdjacentHTML('afterbegin', msg);
        return;
    }
    const KEY = 'mainichi-kyouyou-v1';
    const VERSION = '1.0.0';

    const Q = L.buildQuestions(D);
    const GM = {};
    D.GENRES.forEach(function (g) { GM[g.id] = g; });

    const $ = function (s, el) { return (el || document).querySelector(s); };
    const $$ = function (s, el) { return Array.from((el || document).querySelectorAll(s)); };
    const esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    const ic = function (n, cls) { return '<span class="ic' + (cls ? ' ' + cls : '') + '">' + I.svg(n) + '</span>'; };
    const gimg = function (g, size) {
        return '<img src="assets/genre/' + g + '.webp" alt="" width="' + (size || 36) + '" height="' + (size || 36) + '" loading="lazy">';
    };
    const LETTERS = ['A', 'B', 'C', 'D'];

    /* ---------- 保存 ---------- */

    let storageOk = true;
    function load() {
        try { return L.normalizeState(JSON.parse(localStorage.getItem(KEY) || 'null')); }
        catch (e) { storageOk = false; return L.emptyState(); }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }
        catch (e) {
            if (storageOk) toast('記録を保存できませんでした（ブラウザの設定を確かめてください）');
            storageOk = false;
        }
    }

    let S = load();
    let today = L.dayNum();

    /* ---------- 画面の 切りかえ（スマホの「戻る」にも 合わせる） ---------- */

    const TABS = ['home', 'note', 'record', 'settings'];
    let cur = 'home';
    const RENDER = {
        home: renderHome, genres: renderGenres, note: renderNote, record: renderRecord, settings: renderSettings
    };

    function show(id, how) {
        $$('.screen').forEach(function (s) { s.hidden = s.id !== id; });
        cur = id;
        const tabbed = TABS.indexOf(id) >= 0;
        document.body.classList.toggle('no-tab', !tabbed);
        $$('#tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tabto === id); });
        if (RENDER[id] && how !== 'keep') RENDER[id]();
        if (how === 'push') history.pushState({ s: id }, '');
        else if (how === 'replace') history.replaceState({ s: id }, '');
        window.scrollTo(0, 0);
        I.fill(document.getElementById(id));
    }

    function go(id) { show(id, 'push'); }

    window.addEventListener('popstate', function (e) {
        const to = (e.state && e.state.s) || 'home';
        if (cur === 'play') {
            // 問題の 途中で「戻る」→ やめるか たずねる
            history.pushState({ s: 'play' }, '');
            askQuit();
            return;
        }
        if (cur === 'result') { show('home', 'replace'); return; }
        if (to === 'result' && resultReady) { show('result', 'keep'); return; }
        if (to === 'play' || to === 'result') { show('home', 'replace'); return; }
        if (to === 'noteItem' && !noteItemId) { show('note', 'replace'); return; }
        show(to);
    });

    document.addEventListener('click', function (e) {
        const b = e.target.closest('[data-back]');
        if (b) { history.back(); return; }
        const t = e.target.closest('[data-tabto]');
        if (t) {
            const to = t.dataset.tabto;
            if (to === cur) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            if (to === 'home') { show('home', 'replace'); return; }
            show(to, cur === 'home' ? 'push' : 'replace');
        }
    });

    /* ---------- 小窓・おしらせ ---------- */

    let toastTimer = 0;
    function toast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    }

    function confirmBox(text, yes, no) {
        return new Promise(function (res) {
            $('#dialogText').textContent = text;
            $('#dialogYes').textContent = yes || 'はい';
            $('#dialogNo').textContent = no || 'やめる';
            $('#dialog').hidden = false;
            const done = function (v) {
                $('#dialog').hidden = true;
                $('#dialogYes').onclick = $('#dialogNo').onclick = null;
                res(v);
            };
            $('#dialogYes').onclick = function () { done(true); };
            $('#dialogNo').onclick = function () { done(false); };
            $('#dialogYes').focus();
        });
    }

    /* ---------- 音と ふるえ ---------- */

    let resultReady = false;
    let ac = null;
    function audio() {
        if (!S.settings.sound) return null;
        try {
            if (navigator.audioSession) navigator.audioSession.type = 'ambient';   // iPhone の 消音スイッチに したがう
            ac = ac || new (window.AudioContext || window.webkitAudioContext)();
            if (ac.state === 'suspended') ac.resume();
            return ac;
        } catch (e) { return null; }
    }
    function tone(freqs, type, len, vol) {
        const a = audio();
        if (!a) return;
        const t0 = a.currentTime + 0.01;
        freqs.forEach(function (f, i) {
            const o = a.createOscillator();
            const g = a.createGain();
            o.type = type;
            o.frequency.value = f;
            const st = t0 + i * len * 0.7;
            g.gain.setValueAtTime(0.0001, st);
            g.gain.exponentialRampToValueAtTime(vol, st + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, st + len);
            o.connect(g); g.connect(a.destination);
            o.start(st); o.stop(st + len + 0.02);
        });
    }
    const sfx = {
        ok: function () { tone([659.3, 987.8], 'sine', 0.22, 0.16); },
        ng: function () { tone([233.1, 207.7], 'triangle', 0.24, 0.14); },
        done: function () { tone([523.3, 659.3, 784, 1046.5], 'sine', 0.26, 0.13); },
        tap: function () { tone([880], 'sine', 0.05, 0.04); }
    };
    function buzz(p) { if (S.settings.vibe && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* なし */ } } }

    /* ---------- 今日の セット ---------- */

    function enabledGenres() {
        const off = S.settings.off || [];
        return D.GENRES.map(function (g) { return g.id; }).filter(function (g) { return off.indexOf(g) < 0; });
    }

    function newSession(kind, ids, title) {
        return { kind: kind, title: title, date: today, ids: ids, i: 0, ans: [], retry: [], phase: 'main', ri: 0, order: null, pick: null, answered: null };
    }

    /** 今日の セットを 用意する（日が かわったら 作りなおす） */
    function ensureDaily() {
        const d = S.daily;
        if (d && d.date === today) return d;
        S.daily = newSession('daily', L.buildSet(Q, S.cards, today, { size: S.settings.size, genres: enabledGenres() }), '今日の' + S.settings.size + '問');
        if (S.cur === 'daily') S.cur = null;
        save();
        return S.daily;
    }
    /** 設定を かえた とき、まだ 手を つけて いない 今日の セットは 作りなおす */
    function refreshDailyIfUntouched() {
        const d = S.daily;
        if (d && d.date === today && d.i === 0 && !d.ans.length && !d.answered && !(S.days[today] && S.days[today].done)) {
            S.daily = null;
            ensureDaily();
        }
    }

    function sess() { return S.cur === 'daily' ? S.daily : S.cur === 'other' ? S.other : null; }

    function startDaily() {
        const d = ensureDaily();
        if (!d.ids.length) { toast('出題できる問題がありません'); return; }
        S.cur = 'daily';
        save();
        go('play');
        renderQ();
    }
    function startOther(kind, opt, title) {
        const ids = L.buildSet(Q, S.cards, today, Object.assign({ size: S.settings.size, genres: enabledGenres(), seed: Date.now() % 2147483647 }, opt));
        if (!ids.length) { toast('いま出せる問題はありません'); return; }
        S.other = newSession(kind, ids, title);
        S.cur = 'other';
        save();
        go('play');
        renderQ();
    }

    /* ---------- ホーム ---------- */

    function greeting() {
        const h = new Date().getHours();
        return h < 5 ? 'こんばんは' : h < 11 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'こんばんは';
    }

    function renderHome() {
        const d = ensureDaily();
        const st = L.streak(S.days, today);
        const doneToday = !!(S.days[today] && S.days[today].done);
        const T = L.totals(Q, S.cards, today);

        $('#homeStreak').innerHTML = '<img src="assets/emoji/fire.webp" alt="" width="26" height="26">' + st + '日' +
            (S.tickets ? '<span class="tk">おやすみ券 ' + S.tickets + '</span>' : '');
        $('#homeStreak').setAttribute('aria-label', '連続 ' + st + '日');

        let msg;
        if (!T.seen) msg = 'はじめまして。1日' + S.settings.size + '問、5分ほどで教養が身につきます。知らない問題は<b>勘でOK</b>。答えたあとの解説がいちばん大事です。';
        else if (doneToday) msg = '今日の分はおしまい。おつかれさまでした。解説はノートからいつでも読み返せます。';
        else if (st > 0) msg = greeting() + '。連続 <b>' + st + '日</b>。今日も続けましょう。';
        else msg = greeting() + '。今日の' + S.settings.size + '問を解いてみましょう。';
        $('#helloText').innerHTML = msg;

        const card = $('#todayCard');
        const nNew = d.ids.filter(function (id) { const c = S.cards[id]; return !c || !c.n; }).length;
        const nRev = d.ids.length - nNew;
        const gs = [];
        d.ids.forEach(function (id) { const g = Q.byId[id] && Q.byId[id].g; if (g && gs.indexOf(g) < 0) gs.push(g); });
        // 途中で やめた ほかの セット（ジャンル・復習 など）の 続き
        const resume = S.other && S.other.date === today && !atEnd(S.other) ?
            '<button class="btn sub wide" id="resumeOther">' + ic('arrow-right') + '「' + esc(S.other.title) + '」の続き</button>' : '';
        if (doneToday) {
            card.innerHTML = '<div class="done-mark">' + ic('check-circle') + '今日の' + d.ids.length + '問は完了</div>' +
                '<button class="btn main wide" id="extraBtn">' + ic('play') + 'もう1セット解く</button>' + resume;
        } else {
            const started = d.i > 0 || d.ans.length || d.answered;
            card.innerHTML = '<h2>今日の' + d.ids.length + '問</h2>' +
                '<p class="meta">' + (started ? 'あと ' + (d.ids.length - d.i) + '問' + (d.phase === 'retry' ? '（間違えた問題をもう一度）' : '') :
                    (nNew ? '新しい問題 ' + nNew : '') + (nNew && nRev ? '・' : '') + (nRev ? '復習 ' + nRev : '') + '／約' + Math.max(1, Math.round(d.ids.length / 2)) + '分') + '</p>' +
                '<div class="mix">' + gs.map(function (g) { return '<span>' + esc(GM[g].short) + '</span>'; }).join('') + '</div>' +
                '<button class="btn main wide" id="dailyBtn">' + ic('play') + (started ? '続きから' : 'はじめる') + '</button>' + resume;
        }
        const db = $('#dailyBtn'); if (db) db.onclick = startDaily;
        const eb = $('#extraBtn'); if (eb) eb.onclick = function () { startOther('extra', { seed: (today * 131 + Date.now()) % 2147483647 }, 'もう1セット'); };
        const ro = $('#resumeOther'); if (ro) ro.onclick = function () { S.cur = 'other'; save(); go('play'); renderQ(); };

        const starN = Object.keys(S.star).filter(function (id) { return Q.byId[id]; }).length;
        const modes = [
            { id: 'genre', icon: 'squares-four', t: 'ジャンルを選ぶ', d: '好きなジャンルだけ解く' },
            { id: 'review', icon: 'arrow-counter-clockwise', t: '復習だけ', d: '忘れかけた問題を思い出す', n: T.due },
            { id: 'over', icon: 'target', t: '思い込みを直す', d: '自信があったのに間違えた問題', n: T.overOpen },
            { id: 'star', icon: 'star', t: '★の問題', d: '印を付けた問題', n: starN },
            { id: 'random', icon: 'shuffle', t: 'おまかせ', d: '全ジャンルから' + S.settings.size + '問' },
            { id: 'about', icon: 'lightbulb', t: 'このアプリの考え方', d: 'なぜ身につくのか' }
        ];
        $('#modeList').innerHTML = modes.map(function (m) {
            const dis = (m.id === 'review' || m.id === 'over' || m.id === 'star') && !m.n;
            return '<button class="mode" data-mode="' + m.id + '"' + (dis ? ' disabled' : '') + '>' + ic(m.icon) +
                '<b>' + m.t + (m.n ? '<span class="badge">' + m.n + '</span>' : '') + '</b><span class="d">' + m.d + '</span></button>';
        }).join('');
        $$('#modeList .mode').forEach(function (b) {
            b.onclick = function () {
                const m = b.dataset.mode;
                if (m === 'genre') go('genres');
                else if (m === 'about') go('about');
                else if (m === 'review') startOther('review', { mode: 'review', genres: null }, '復習');
                else if (m === 'over') startOther('over', { mode: 'over', genres: null }, '思い込みを直す');
                else if (m === 'star') startOther('star', { mode: 'star', star: S.star, genres: null }, '★の問題');
                else if (m === 'random') startOther('random', { mode: 'random' }, 'おまかせ');
            };
        });

        $('#homeProgress').innerHTML = '<h3>これまでに出会った問題　' + T.seen + ' / ' + T.total + '</h3>' +
            '<div class="bar"><i class="m" style="width:' + L.pct(T.mastered, T.total) + '%"></i><i class="s" style="width:' + L.pct(T.seen - T.mastered, T.total) + '%"></i></div>' +
            '<div class="legend"><span><i style="background:var(--ok)"></i>覚えた ' + T.mastered + '</span><span><i style="background:var(--accent);opacity:.55"></i>学習中 ' + (T.seen - T.mastered) + '</span><span>復習待ち ' + T.due + '</span></div>';
        I.fill($('#home'));
    }

    /* ---------- ジャンルを 選ぶ ---------- */

    function renderGenres() {
        const gst = L.genreStats(Q, S.cards, today, D.GENRES);
        $('#genreGrid').innerHTML = D.GENRES.map(function (g) {
            const s = gst[g.id] || { total: 0, seen: 0, due: 0 };
            return '<button class="genre" data-g="' + g.id + '">' + gimg(g.id, 40) + '<div><b>' + esc(g.name) + '</b><span>' + s.seen + ' / ' + s.total +
                (s.due ? '・復習 ' + s.due : '') + '</span></div><div class="gbar"><i style="width:' + L.pct(s.seen, s.total) + '%"></i></div></button>';
        }).join('');
        $$('#genreGrid .genre').forEach(function (b) {
            b.onclick = function () { startOther('genre', { only: b.dataset.g }, GM[b.dataset.g].name); };
        });
    }

    /* ---------- 問題 ---------- */

    function curId(s) { return s.phase === 'retry' ? s.retry[s.ri] : s.ids[s.i]; }

    function renderQ() {
        const s = sess();
        if (!s) { show('home', 'replace'); return; }
        const id = curId(s);
        const q = Q.byId[id];
        if (!q) {
            // 問題が けされた 時の ための 保険：とばす
            if (s.phase === 'retry') s.ri++; else s.i++;
            s.order = null; s.answered = null;
            save();
            if (atEnd(s)) finish(); else renderQ();
            return;
        }
        const total = s.ids.length;
        if (s.phase === 'retry') {
            $('#pbarFill').style.width = '100%';
            $('#playCount').textContent = 'もう一度 ' + (s.ri + 1) + '/' + s.retry.length;
        } else {
            $('#pbarFill').style.width = (s.i * 100 / total) + '%';
            $('#playCount').textContent = (s.i + 1) + ' / ' + total;
        }
        const card = S.cards[id];
        let tag = '';
        if (s.phase === 'retry') tag = '<span class="q-tag retry">もう一度</span>';
        else if (card && card.overOpen) tag = '<span class="q-tag over">思い込み</span>';
        else if (card && card.n) tag = '<span class="q-tag review">復習</span>';
        $('#qGenre').innerHTML = gimg(q.g, 26) + esc(GM[q.g].name);
        $('#qTag').outerHTML = '<span id="qTag" class="q-tag-wrap">' + tag + '</span>';
        $('#qText').textContent = q.q;

        if (!s.order) { s.order = L.choiceOrder(); save(); }
        const answered = s.answered && s.answered.id === id ? s.answered : null;
        const box = $('#choices');
        box.className = 'choices' + (answered ? ' answered' : '');
        box.innerHTML = s.order.map(function (k, pos) {
            return '<button class="choice" data-k="' + k + '"><span class="row"><span class="mk">' + LETTERS[pos] + '</span><span class="t">' + esc(q.c[k]) + '</span></span></button>';
        }).join('');
        $$('.choice', box).forEach(function (b) { b.onclick = function () { onChoice(Number(b.dataset.k)); }; });

        const hideChoices = S.settings.recall && !answered && !s.shown;
        $('#recallBox').hidden = !hideChoices;
        box.hidden = hideChoices;
        $('#confSheet').hidden = true;
        $('#feedback').hidden = true;
        $('#nextBar').hidden = true;
        pendingK = null;
        if (answered) renderFeedback(q, answered, false);
        window.scrollTo(0, 0);
    }

    $('#recallShow').onclick = function () {
        const s = sess();
        if (!s) return;
        s.shown = true;
        $('#recallBox').hidden = true;
        $('#choices').hidden = false;
        sfx.tap();
    };

    let pendingK = null;
    function onChoice(k) {
        const s = sess();
        if (!s || s.answered) return;
        if (S.settings.conf && s.phase === 'main') {
            pendingK = k;
            $$('#choices .choice').forEach(function (b) { b.classList.toggle('sel', Number(b.dataset.k) === k); });
            $('#confSheet').hidden = false;
            buzz(8);
            const sel = $('#choices .choice.sel');
            // えらんだ 選択肢が 下の 小窓に かくれない ように
            setTimeout(function () {
                const r = sel.getBoundingClientRect();
                const sh = $('#confSheet').getBoundingClientRect();
                if (r.bottom > sh.top - 8) window.scrollBy({ top: r.bottom - sh.top + 16, behavior: 'smooth' });
            }, 30);
        } else commit(k, null);
    }
    $$('#confSheet .conf').forEach(function (b) {
        b.onclick = function () { if (pendingK != null) commit(pendingK, b.dataset.conf); };
    });
    $('#confCancel').onclick = function () {
        pendingK = null;
        $('#confSheet').hidden = true;
        $$('#choices .choice').forEach(function (b) { b.classList.remove('sel'); });
    };

    function commit(k, conf) {
        const s = sess();
        if (!s || s.answered) return;
        const id = curId(s);
        const q = Q.byId[id];
        const ok = k === 0;
        if (s.phase === 'main') {
            const before = S.cards[id];
            const wasOver = !!(before && before.overOpen);
            S.cards[id] = L.review(before, ok, conf, today);
            const d = S.days[today] = S.days[today] || { n: 0, ok: 0 };
            d.n++; if (ok) d.ok++;
            s.ans.push({ id: id, ok: ok, conf: conf, fixed: wasOver && ok && !S.cards[id].overOpen });
            if (!ok) s.retry.push(id);
        }
        s.answered = { id: id, k: k, conf: conf, ok: ok };
        pendingK = null;
        save();
        $('#confSheet').hidden = true;
        if (ok) { sfx.ok(); buzz(12); } else { sfx.ng(); buzz([25, 40, 25]); }
        renderFeedback(q, s.answered, true);
    }

    function renderFeedback(q, a, fresh) {
        const s = sess();
        const box = $('#choices');
        box.classList.add('answered');
        box.hidden = false;
        $('#recallBox').hidden = true;
        $$('.choice', box).forEach(function (b) {
            const k = Number(b.dataset.k);
            b.classList.remove('sel');
            const mk = $('.mk', b);
            if (k === 0) { b.classList.add('ok'); mk.innerHTML = ic('check'); }
            else if (k === a.k) { b.classList.add('ng'); mk.innerHTML = ic('x'); }
            else b.classList.add('dim');
            if (k !== 0) b.insertAdjacentHTML('beforeend', '<span class="why">' + esc(q.notes[k - 1]) + '</span>');
        });

        let v;
        if (a.ok) {
            const sub = a.conf === 'sure' ? '自信どおり。解説で知識を広げましょう。'
                : a.conf === 'guess' ? '勘で当たり！ 解説を読めば、本当の知識になります。'
                : a.conf === 'maybe' ? 'たぶん、で当たり。解説で確かめておきましょう。' : '解説で知識を広げましょう。';
            v = '<div class="verdict ok">' + ic('check-circle') + '<div>正解！<small>' + sub + '</small></div></div>';
        } else {
            v = '<div class="verdict ng">' + ic('x-circle') + '<div>残念…<small>正解は「' + esc(q.c[0]) + '」</small></div></div>';
            if (a.conf === 'sure' && s && s.phase === 'main') {
                v += '<p class="verdict-note"><b>思い込みを発見！</b> 自信があった間違いは、正しい答えを知るといちばん覚えやすいときです。明日もう一度出します。</p>';
            }
        }
        if (a.ok && s && s.phase === 'main' && s.ans.length && s.ans[s.ans.length - 1].fixed) {
            v += '<p class="verdict-note"><b>思い込みを直せました！</b> 前に自信をもって間違えた問題です。</p>';
        }
        const starOn = !!S.star[q.id];
        const flagOn = !!S.flag[q.id];
        const fb = $('#feedback');
        fb.innerHTML = '<div class="ex"><h4>' + ic('info') + 'なぜ？</h4><p class="ans">正解：' + esc(q.c[0]) + '</p><p>' + esc(q.exp) + '</p></div>' +
            '<div class="ex point"><h4><img src="assets/emoji/bulb.webp" alt="" width="26" height="26">ワンポイント</h4><p>' + esc(q.point) + '</p></div>' +
            '<div class="ex-actions"><button id="starBtn" class="' + (starOn ? 'on' : '') + '">' + ic(starOn ? 'star-fill' : 'star') + (starOn ? '★を外す' : '★印を付ける') + '</button>' +
            '<button id="flagBtn" class="' + (flagOn ? 'on' : '') + '">' + ic('flag') + (flagOn ? 'あやしい（印あり）' : 'あやしい？') + '</button></div>';
        fb.hidden = false;
        const vs = document.createElement('div');
        vs.id = 'verdictSlot';
        vs.innerHTML = v;
        const old = $('#verdictSlot'); if (old) old.remove();
        box.parentNode.insertBefore(vs, box);
        $('#starBtn').onclick = function () { toggleStar(q.id); renderFeedbackButtons(q); };
        $('#flagBtn').onclick = function () { toggleFlag(q.id).then(function () { renderFeedbackButtons(q); }); };

        const last = s && (s.phase === 'retry' ? s.ri >= s.retry.length - 1 : (s.i >= s.ids.length - 1 && !s.retry.length));
        $('#nextBtn').innerHTML = (last ? '結果を見る' : (s && s.phase === 'main' && s.i >= s.ids.length - 1 ? '間違えた問題をもう一度' : '次へ')) + ic('arrow-right');
        $('#nextBar').hidden = false;
        if (fresh) {
            const top = vs.getBoundingClientRect().top + window.scrollY - 70;
            if (top > window.scrollY + window.innerHeight * 0.35 || top < window.scrollY) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    }
    function renderFeedbackButtons(q) {
        const sb = $('#starBtn'), fb = $('#flagBtn');
        const st = !!S.star[q.id], fl = !!S.flag[q.id];
        if (sb) { sb.className = st ? 'on' : ''; sb.innerHTML = ic(st ? 'star-fill' : 'star') + (st ? '★を外す' : '★印を付ける'); }
        if (fb) { fb.className = fl ? 'on' : ''; fb.innerHTML = ic('flag') + (fl ? 'あやしい（印あり）' : 'あやしい？'); }
    }

    function toggleStar(id) {
        if (S.star[id]) delete S.star[id]; else S.star[id] = today;
        save();
        toast(S.star[id] ? '★印を付けました（ホームの「★の問題」で解けます）' : '★印を外しました');
    }
    function toggleFlag(id) {
        if (S.flag[id]) { delete S.flag[id]; save(); toast('「あやしい」の印を外しました'); return Promise.resolve(); }
        return confirmBox('この問題の内容があやしいと思ったら印を付けておきます。\n設定の「あやしい印の問題」から一覧をコピーして、作った人に知らせることができます。', '印を付ける').then(function (y) {
            if (y) { S.flag[id] = today; save(); toast('「あやしい」の印を付けました'); }
        });
    }

    function atEnd(s) { return s.phase === 'retry' ? s.ri >= s.retry.length : s.i >= s.ids.length && !s.retry.length; }

    $('#nextBtn').onclick = function () {
        const s = sess();
        if (!s) return;
        s.answered = null; s.order = null; s.shown = false;
        if (s.phase === 'main') {
            s.i++;
            if (s.i >= s.ids.length) {
                if (s.retry.length) { s.phase = 'retry'; s.ri = 0; }
                else { save(); finish(); return; }
            }
        } else {
            s.ri++;
            if (s.ri >= s.retry.length) { save(); finish(); return; }
        }
        save();
        sfx.tap();
        renderQ();
    };

    function askQuit() {
        const s = sess();
        const daily = S.cur === 'daily';
        confirmBox(daily ? '途中でやめますか？\nここまでの答えは記録されています。続きはホームから再開できます。' : '途中でやめますか？\nここまでの答えは記録されています。', 'やめる', '続ける').then(function (y) {
            if (!y) return;
            if (s) { s.answered = s.answered && s.answered.id === curId(s) ? s.answered : null; }
            if (!daily) { S.other = s && s.ans.length ? s : null; }
            if (!daily && s) {
                // 答え おわった 問題の 次から 再開できる ように 進めておく
                if (s.answered) { s.answered = null; s.order = null; if (s.phase === 'main') s.i++; else s.ri++; }
                if (atEnd(s)) { S.other = null; }
            }
            S.cur = null;
            save();
            show('home', 'replace');
        });
    }
    $('#playQuit').onclick = askQuit;

    /* ---------- おわり ---------- */

    function finish() {
        const s = sess();
        if (!s) { show('home', 'replace'); return; }
        let newTicket = false;
        if (s.kind === 'daily' && s.date === today) newTicket = L.finishDay(S, today);
        if (S.cur === 'other') S.other = null;
        S.cur = null;
        const r = { kind: s.kind, title: s.title, ans: s.ans, newTicket: newTicket };
        save();
        sfx.done();
        renderResult(r);
        resultReady = true;
        show('result', 'replace');
        I.fill($('#result'));
    }

    function renderResult(r) {
        const n = r.ans.length;
        const ok = r.ans.filter(function (a) { return a.ok; }).length;
        const rate = L.pct(ok, n);
        const st = L.streak(S.days, today);
        const T = L.totals(Q, S.cards, today);
        const fixed = r.ans.filter(function (a) { return a.fixed; }).length;
        const over = r.ans.filter(function (a) { return !a.ok && a.conf === 'sure'; }).length;
        const head = rate >= 90 ? 'お見事！' : rate >= 60 ? 'いい調子です' : rate >= 30 ? 'おつかれさまでした' : '新しい発見がたくさん';
        const sub = r.kind === 'daily' ? '今日の分は完了です。' : esc(r.title) + ' 完了。';
        let notes = '';
        if (r.newTicket) notes += '<p class="verdict-note"><b>おやすみ券を1枚もらいました。</b> 1日休んでも、連続記録が切れません（最大' + L.TICKET_MAX + '枚）。</p>';
        if (over) notes += '<p class="verdict-note"><b>思い込みを' + over + 'つ発見。</b> 明日もう一度出します。</p>';
        if (fixed) notes += '<p class="verdict-note"><b>思い込みを' + fixed + 'つ直せました。</b></p>';
        $('#resultMain').innerHTML =
            '<div class="result-hero"><img src="assets/emoji/' + (rate >= 80 ? 'trophy' : 'owl') + '.webp" alt="" width="84" height="84"><h2>' + head + '</h2><p>' + sub + '</p>' +
            '<div class="score">' + ok + '<small> / ' + n + ' 正解</small></div></div>' + notes +
            '<div class="card"><div class="res-stats"><div><b>' + st + '日</b><span>連続</span></div><div><b>' + T.seen + '</b><span>出会った問題</span></div><div><b>' + T.mastered + '</b><span>覚えた</span></div></div></div>' +
            '<h2 class="sec">今回の問題（タップで解説）</h2><div class="card"><ul class="res-list">' +
            r.ans.map(function (a) {
                const q = Q.byId[a.id];
                if (!q) return '';
                return '<li><button data-id="' + esc(a.id) + '">' + ic(a.ok ? 'check-circle' : 'x-circle', a.ok ? 'ok' : 'ng') +
                    '<span class="t">' + esc(q.topic) + '<small>' + esc(GM[q.g].name) + (!a.ok && a.conf === 'sure' ? '・思い込み' : '') + '</small></span>' + ic('caret-right', 'go') + '</button></li>';
            }).join('') + '</ul></div>' +
            '<div class="result-btns"><button class="btn main wide" id="resHome">' + ic('house') + 'ホームへ</button>' +
            '<button class="btn sub wide" id="resMore">' + ic('play') + 'もう1セット解く</button></div>';
        $('#resHome').onclick = function () { show('home', 'replace'); };
        $('#resMore').onclick = function () {
            history.replaceState({ s: 'home' }, '');
            cur = 'home';
            startOther('extra', { seed: (today * 131 + Date.now()) % 2147483647 }, 'もう1セット');
        };
        $$('#resultMain .res-list button').forEach(function (b) { b.onclick = function () { openItem(b.dataset.id); }; });
    }

    /* ---------- 教養ノート ---------- */

    let noteFilter = 'all';
    let noteGenre = null;
    let noteItemId = null;
    let noteLimit = 60;

    function seenList() {
        return Q.list.filter(function (q) { const c = S.cards[q.id]; return c && c.n; });
    }
    function matchFilter(q) {
        const c = S.cards[q.id];
        if (noteFilter === 'star') return !!S.star[q.id];
        if (noteFilter === 'over') return !!(c && c.over);
        if (noteFilter === 'ng') return !!(c && c.ng);
        return true;
    }
    function statusIcon(q) {
        const c = S.cards[q.id];
        if (!c || !c.n) return '';
        if (L.isMastered(c)) return ic('seal-check', 'st m');
        return c.last && c.last.ok ? ic('check-circle', 'st ok') : ic('x-circle', 'st ng');
    }
    function itemRow(q, withGenre) {
        return '<button data-id="' + esc(q.id) + '">' + (withGenre ? gimg(q.g, 36) : '') + '<span class="t"><b>' + esc(q.topic) + '</b><small>' + esc(q.q) + '</small></span>' +
            statusIcon(q) + (S.star[q.id] ? ic('star-fill', 'st m') : '') + '</button>';
    }

    function renderNote() {
        $$('#noteFilter button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === noteFilter); });
        const word = $('#noteSearch').value.trim();
        const seen = seenList();
        const body = $('#noteBody');
        if (!seen.length) {
            body.innerHTML = '<div class="empty"><img src="assets/emoji/owl.webp" alt="" width="64" height="64">まだノートは空です。<br>クイズで出会った問題と解説が、ここにたまっていきます。</div>';
            return;
        }
        if (!word && noteFilter === 'all') {
            const gst = L.genreStats(Q, S.cards, today, D.GENRES);
            body.innerHTML = '<p class="note">クイズで出会った ' + seen.length + '問の解説を、ジャンルごとに読み返せます。</p><div class="list">' +
                D.GENRES.map(function (g) {
                    const s = gst[g.id];
                    return '<button data-g="' + g.id + '"' + (s.seen ? '' : ' disabled') + '>' + gimg(g.id, 36) + '<span class="t"><b>' + esc(g.name) + '</b><small>' + s.seen + ' / ' + s.total + '問' +
                        (s.mastered ? '・覚えた ' + s.mastered : '') + '</small></span>' + ic('caret-right') + '</button>';
                }).join('') + '</div>';
            $$('#noteBody .list button[data-g]').forEach(function (b) {
                b.onclick = function () { noteGenre = b.dataset.g; noteLimit = 200; go('noteList'); renderNoteList(); I.fill($('#noteList')); };
            });
            return;
        }
        const words = word.toLowerCase().split(/[\s　]+/).filter(Boolean);
        const hit = seen.filter(function (q) {
            if (!matchFilter(q)) return false;
            if (!words.length) return true;
            const text = (q.topic + ' ' + q.q + ' ' + q.c.join(' ') + ' ' + q.exp + ' ' + q.notes.join(' ') + ' ' + q.point).toLowerCase();
            return words.every(function (w) { return text.indexOf(w) >= 0; });
        });
        body.innerHTML = hit.length ?
            '<p class="note">' + hit.length + '問</p><div class="list">' + hit.slice(0, noteLimit).map(function (q) { return itemRow(q, true); }).join('') + '</div>' +
            (hit.length > noteLimit ? '<button class="btn sub more" id="noteMore">もっと見る</button>' : '') :
            '<div class="empty">' + (noteFilter === 'star' ? '★印を付けた問題はまだありません。' : noteFilter === 'over' ? '思い込みの問題はまだありません。' : noteFilter === 'ng' ? '間違えた問題はまだありません。' : '見つかりませんでした。') + '</div>';
        $$('#noteBody .list button').forEach(function (b) { b.onclick = function () { openItem(b.dataset.id); }; });
        const m = $('#noteMore'); if (m) m.onclick = function () { noteLimit += 60; renderNote(); I.fill($('#note')); };
    }
    $$('#noteFilter button').forEach(function (b) {
        b.onclick = function () { noteFilter = b.dataset.f; noteLimit = 60; renderNote(); I.fill($('#note')); };
    });
    let searchTimer = 0;
    $('#noteSearch').addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { noteLimit = 60; renderNote(); I.fill($('#note')); }, 200);
    });
    $('#noteSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });

    function renderNoteList() {
        const g = GM[noteGenre];
        if (!g) return;
        $('#noteListTitle').textContent = g.name;
        const all = Q.list.filter(function (q) { return q.g === noteGenre; });
        const seen = all.filter(function (q) { const c = S.cards[q.id]; return c && c.n; });
        $('#noteListBody').innerHTML = '<p class="note">' + seen.length + ' / ' + all.length + '問。まだ出ていない問題は、クイズで出会うとここに増えます。</p>' +
            (seen.length ? '<div class="list">' + seen.map(function (q) { return itemRow(q, false); }).join('') + '</div>' : '<div class="empty">まだありません</div>');
        $$('#noteListBody .list button').forEach(function (b) { b.onclick = function () { openItem(b.dataset.id); }; });
    }

    function openItem(id) {
        noteItemId = id;
        renderItem();
        go('noteItem');
        I.fill($('#noteItem'));
    }
    function renderItem() {
        const q = Q.byId[noteItemId];
        if (!q) return;
        const c = S.cards[q.id];
        let meta = '';
        if (c && c.n) {
            meta = c.n + '回中 ' + c.ok + '回正解';
            if (L.isMastered(c)) meta += '・覚えた';
            meta += '・次の復習 ' + (c.due <= today ? '今日' : L.dayLabel(c.due));
            if (c.over) meta += '・思い込み ' + c.over + '回' + (c.overOpen ? '' : '（直した）');
        }
        const starOn = !!S.star[q.id], flagOn = !!S.flag[q.id];
        $('#noteItemBody').innerHTML =
            '<div class="q-head"><span class="chip">' + gimg(q.g, 26) + esc(GM[q.g].name) + '</span></div>' +
            '<p class="item-q">' + esc(q.q) + '</p>' + (meta ? '<p class="item-meta">' + meta + '</p>' : '') +
            '<div class="choices answered">' + q.c.map(function (t, k) {
                return '<div class="choice ' + (k === 0 ? 'ok' : 'dim') + '"><span class="row"><span class="mk">' + (k === 0 ? ic('check') : LETTERS[k]) + '</span><span class="t">' + esc(t) + '</span></span>' +
                    (k ? '<span class="why">' + esc(q.notes[k - 1]) + '</span>' : '') + '</div>';
            }).join('') + '</div>' +
            '<div class="feedback"><div class="ex"><h4>' + ic('info') + 'なぜ？</h4><p>' + esc(q.exp) + '</p></div>' +
            '<div class="ex point"><h4><img src="assets/emoji/bulb.webp" alt="" width="26" height="26">ワンポイント</h4><p>' + esc(q.point) + '</p></div>' +
            '<div class="ex-actions"><button id="itStar" class="' + (starOn ? 'on' : '') + '">' + ic(starOn ? 'star-fill' : 'star') + (starOn ? '★を外す' : '★印を付ける') + '</button>' +
            '<button id="itFlag" class="' + (flagOn ? 'on' : '') + '">' + ic('flag') + (flagOn ? 'あやしい（印あり）' : 'あやしい？') + '</button></div></div>';
        $('#itStar').onclick = function () { toggleStar(q.id); renderItem(); I.fill($('#noteItem')); };
        $('#itFlag').onclick = function () { toggleFlag(q.id).then(function () { renderItem(); I.fill($('#noteItem')); }); };
    }
    RENDER.noteList = renderNoteList;
    RENDER.noteItem = renderItem;

    /* ---------- 記録 ---------- */

    function renderRecord() {
        const T = L.totals(Q, S.cards, today);
        const st = L.streak(S.days, today);
        const fixedOver = Q.list.filter(function (q) { const c = S.cards[q.id]; return c && c.over && !c.overOpen; }).length;
        const W = ['日', '月', '火', '水', '木', '金', '土'];
        const weeks = 6;
        const todayDow = L.dayToDate(today).getDay();
        const start = today - todayDow - (weeks - 1) * 7;
        let cal = '';
        for (let d = start; d < start + weeks * 7; d++) {
            if (d > today) { cal += '<span class="pad"></span>'; continue; }
            const x = S.days[d];
            let cls = '';
            if (x && x.done) cls = 'l3';
            else if (x && x.rest && !x.n) cls = 'rest';
            else if (x && x.n >= 5) cls = 'l2';
            else if (x && x.n) cls = 'l1';
            if (d === today) cls += ' today';
            cal += '<span class="' + cls + '" title="' + L.dayLabel(d) + '">' + L.dayToDate(d).getDate() + '</span>';
        }
        const gst = L.genreStats(Q, S.cards, today, D.GENRES);
        $('#recordBody').innerHTML =
            '<div class="big-stats">' +
            '<div class="card"><img src="assets/emoji/fire.webp" alt="" width="26" height="26"><b>' + st + '日</b><span>連続（最長 ' + Math.max(S.best || 0, st) + '日）</span></div>' +
            '<div class="card"><img src="assets/emoji/trophy.webp" alt="" width="26" height="26"><b>' + T.mastered + '</b><span>覚えた問題</span></div>' +
            '<div class="card"><b>' + T.seen + '<small style="font-size:.5em;color:var(--sub)"> / ' + T.total + '</small></b><span>出会った問題</span></div>' +
            '<div class="card"><b>' + L.pct(T.ok, T.n) + '%</b><span>正解率（' + T.n + '回答えた）</span></div>' +
            '<div class="card"><b>' + T.overOpen + '</b><span>直したい思い込み</span></div>' +
            '<div class="card"><b>' + fixedOver + '</b><span>直した思い込み</span></div>' +
            '</div>' +
            '<h2 class="sec">この6週間</h2><div class="card"><div class="cal-head">' + W.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="cal">' + cal + '</div>' +
            '<div class="legend"><span><i style="background:var(--ok)"></i>今日の分を完了</span><span><i style="background:color-mix(in srgb,var(--ok) 35%,var(--card2))"></i>少し解いた</span><span><i style="background:var(--warn-soft)"></i>おやすみ券</span></div>' +
            '<p class="small" style="margin:8px 0 0">おやすみ券 ' + (S.tickets || 0) + '枚（' + L.TICKET_EVERY + '日続けるごとに1枚・最大' + L.TICKET_MAX + '枚）</p></div>' +
            '<h2 class="sec">ジャンル別</h2><div class="card"><div class="g-rows">' + D.GENRES.map(function (g) {
                const s = gst[g.id];
                return '<div class="g-row">' + gimg(g.id, 30) + '<b>' + esc(g.name) + '</b><span class="num">' + s.seen + '/' + s.total + (s.n ? '・正解率 ' + L.pct(s.ok, s.n) + '%' : '') + '</span>' +
                    '<div class="bar"><i class="m" style="width:' + L.pct(s.mastered, s.total) + '%"></i><i class="s" style="width:' + L.pct(s.seen - s.mastered, s.total) + '%"></i></div></div>';
            }).join('') + '</div><div class="legend"><span><i style="background:var(--ok)"></i>覚えた</span><span><i style="background:var(--accent);opacity:.55"></i>学習中</span></div></div>';
    }

    /* ---------- 設定 ---------- */

    function toggleRow(key, title, sub) {
        return '<div class="set-row"><span class="t"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
            '<label class="toggle"><input type="checkbox" data-set="' + key + '"' + (S.settings[key] ? ' checked' : '') + ' aria-label="' + title + '"><i></i></label></div>';
    }
    function pickRow(key, title, opts, sub) {
        return '<div class="set-row"><span class="t"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><div class="pick" data-pick="' + key + '">' +
            opts.map(function (o) { return '<button data-v="' + o[0] + '"' + (String(S.settings[key]) === String(o[0]) ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div></div>';
    }

    function renderSettings() {
        const flagN = Object.keys(S.flag).filter(function (id) { return Q.byId[id]; }).length;
        const off = S.settings.off || [];
        $('#settingsBody').innerHTML =
            '<h2 class="sec">解き方</h2><div class="set-group">' +
            pickRow('size', '1セットの問題数', [[5, '5'], [10, '10'], [15, '15'], [20, '20']], '10問で約5分') +
            toggleRow('conf', '自信を尋ねる', '答えたあとに「自信あり・たぶん・勘」を選ぶ。思い込みを見つけて復習に生かします') +
            toggleRow('recall', '思い出してから選ぶ', '選択肢をかくしておき、先に答えを思い浮かべる（よく覚えられるが、少し大変）') +
            '</div>' +
            '<h2 class="sec">画面と音</h2><div class="set-group">' +
            pickRow('font', '文字の大きさ', [['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']]) +
            pickRow('theme', '画面の色', [['auto', '自動'], ['light', '明るい'], ['dark', '暗い']]) +
            toggleRow('sound', '効果音', '正解・不正解の小さな音（iPhone はマナーモードで鳴りません）') +
            (navigator.vibrate ? toggleRow('vibe', '振動', '答えたときに短くふるえる') : '') +
            '</div>' +
            '<h2 class="sec">出題するジャンル</h2><p class="note">外したジャンルは「今日の' + S.settings.size + '問」と「おまかせ」に出ません。</p><div class="set-genres">' +
            D.GENRES.map(function (g) {
                return '<label>' + gimg(g.id, 26) + '<span style="flex:1">' + esc(g.name) + '</span><input type="checkbox" data-genre="' + g.id + '"' + (off.indexOf(g.id) < 0 ? ' checked' : '') + '></label>';
            }).join('') + '</div>' +
            '<h2 class="sec">データ</h2><div class="set-group">' +
            '<button class="set-row btnrow" id="setFlags"><span class="t"><b>あやしい印の問題（' + flagN + '）</b><small>一覧をコピーして、作った人に知らせる</small></span>' + ic('copy') + '</button>' +
            '<button class="set-row btnrow" id="setExport"><span class="t"><b>記録を書き出す</b><small>機種変更のときに。JSON ファイルを保存します</small></span>' + ic('download-simple') + '</button>' +
            '<button class="set-row btnrow" id="setImport"><span class="t"><b>記録を読み込む</b><small>書き出したファイルから戻す（今の記録は置きかわります）</small></span>' + ic('upload-simple') + '</button>' +
            '<button class="set-row btnrow danger" id="setReset"><span class="t"><b>記録をすべて消す</b><small>はじめからやり直す</small></span>' + ic('trash') + '</button>' +
            '</div><input type="file" id="importFile" accept="application/json,.json" hidden>' +
            '<h2 class="sec">このアプリについて</h2><div class="set-group">' +
            '<button class="set-row btnrow" id="setAbout"><span class="t"><b>このアプリの考え方</b><small>なぜ身につくのか（学びの研究のまとめ）</small></span>' + ic('caret-right') + '</button>' +
            '</div><p class="ver">毎日教養 ' + VERSION + '・問題 ' + Q.list.length + '問・20ジャンル<br>記録はこの端末の中だけに保存されます</p>';

        $$('#settingsBody [data-set]').forEach(function (inp) {
            inp.onchange = function () {
                S.settings[inp.dataset.set] = inp.checked;
                save();
                if (inp.dataset.set === 'sound' && inp.checked) sfx.ok();
                if (inp.dataset.set === 'vibe' && inp.checked) buzz(20);
            };
        });
        $$('#settingsBody [data-pick]').forEach(function (p) {
            $$('button', p).forEach(function (b) {
                b.onclick = function () {
                    const key = p.dataset.pick;
                    S.settings[key] = key === 'size' ? Number(b.dataset.v) : b.dataset.v;
                    save();
                    applyLook();
                    if (key === 'size') refreshDailyIfUntouched();
                    renderSettings();
                    I.fill($('#settings'));
                };
            });
        });
        $$('#settingsBody [data-genre]').forEach(function (inp) {
            inp.onchange = function () {
                const g = inp.dataset.genre;
                let o = (S.settings.off || []).filter(function (x) { return x !== g; });
                if (!inp.checked) o.push(g);
                if (o.length >= D.GENRES.length) { inp.checked = true; toast('1つ以上のジャンルを選んでください'); return; }
                S.settings.off = o;
                save();
                refreshDailyIfUntouched();
            };
        });
        $('#setFlags').onclick = copyFlags;
        $('#setExport').onclick = exportData;
        $('#setImport').onclick = function () { $('#importFile').click(); };
        $('#importFile').onchange = importData;
        $('#setReset').onclick = resetAll;
        $('#setAbout').onclick = function () { go('about'); };
    }

    function applyLook() {
        const r = document.documentElement;
        r.setAttribute('data-font', S.settings.font || 'm');
        if (S.settings.theme && S.settings.theme !== 'auto') r.setAttribute('data-theme', S.settings.theme);
        else r.removeAttribute('data-theme');
        const dark = S.settings.theme === 'dark' || (S.settings.theme !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
        $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', dark ? '#16181d' : '#f5f1e8'); m.removeAttribute('media'); });
    }

    function copyFlags() {
        const ids = Object.keys(S.flag).filter(function (id) { return Q.byId[id]; });
        if (!ids.length) { toast('「あやしい」の印を付けた問題はありません'); return; }
        const text = '毎日教養：あやしい印の問題\n' + ids.map(function (id) {
            const q = Q.byId[id];
            return '・' + GM[q.g].name + '／' + q.topic + '：' + q.q + '（正解：' + q.c[0] + '）';
        }).join('\n');
        const done = function () { toast(ids.length + '問の一覧をコピーしました'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        else { fallbackCopy(text); done(); }
    }
    function fallbackCopy(text) {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', '');
        t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); } catch (e) { /* なし */ }
        t.remove();
    }

    function exportData() {
        const data = JSON.stringify({ app: 'mainichi-kyouyou', exported: new Date().toISOString(), state: S });
        const name = 'mainichi-kyouyou-' + new Date().toISOString().slice(0, 10) + '.json';
        const blob = new Blob([data], { type: 'application/json' });
        try {
            const file = new File([blob], name, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({ files: [file], title: '毎日教養の記録' }).catch(function () { /* やめた */ });
                return;
            }
        } catch (e) { /* 共有できない ときは ダウンロード */ }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast('記録を書き出しました');
    }
    function importData(e) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        const rd = new FileReader();
        rd.onload = function () {
            let obj;
            try { obj = JSON.parse(rd.result); } catch (err) { toast('読み込めませんでした（形がちがいます）'); return; }
            if (!obj || obj.app !== 'mainichi-kyouyou' || !obj.state) { toast('毎日教養の記録ファイルではありません'); return; }
            confirmBox('今の記録を、このファイルの記録に置きかえますか？', '置きかえる').then(function (y) {
                if (!y) return;
                S = L.normalizeState(obj.state);
                S.cur = null;
                save(); applyLook();
                toast('記録を読み込みました');
                renderSettings(); I.fill($('#settings'));
            });
        };
        rd.readAsText(f);
    }
    function resetAll() {
        confirmBox('記録をすべて消しますか？\n解いた問題・連続日数・★印もなくなります。', '消す').then(function (y) {
            if (!y) return;
            return confirmBox('本当に消しますか？ 元には戻せません。', 'すべて消す').then(function (y2) {
                if (!y2) return;
                const keep = S.settings;
                S = L.emptyState();
                S.settings = keep;
                save();
                toast('記録を消しました');
                renderSettings(); I.fill($('#settings'));
            });
        });
    }

    /* ---------- はじまり ---------- */

    function dayCheck() {
        const t = L.dayNum();
        if (t === today) return false;
        today = t;
        const used = L.applyRest(S, today);
        save();
        if (used) toast('おやすみ券を' + used + '枚使って、連続記録を守りました');
        return true;
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        if (dayCheck() && cur === 'home') renderHome();
    });
    if (window.matchMedia) {
        const mq = matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', applyLook);
    }

    function boot() {
        applyLook();
        const used = L.applyRest(S, today);
        if (S.cur === 'daily' && (!S.daily || S.daily.date !== today)) S.cur = null;
        save();
        I.fill(document);
        history.replaceState({ s: 'home' }, '');
        show('home');
        if (used) toast('おやすみ券を' + used + '枚使って、連続記録を守りました');
        const errs = L.validate(D);
        if (errs.length && window.console) console.warn('問題データ:', errs);
        if ('serviceWorker' in navigator && location.protocol === 'https:') {
            navigator.serviceWorker.register('sw.js').catch(function () { /* なくても 動く */ });
        }
    }

    // テストから さわれる ように
    window.MKApp = {
        get state() { return S; },
        setToday: function (n) { today = n; },
        reload: function () { S = load(); show('home', 'replace'); },
        Q: Q
    };

    boot();
})();
