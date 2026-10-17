/* 速読ラボ ── 画面の動き
   画面を使わない処理は logic.js（SokuLogic）、入っている文章の目録は texts/catalog.js（SokuCatalog）、
   本文と問題は texts/<id>.txt にあります。
   保存先はこのブラウザの localStorage だけ（サーバーなし）。 */
(function () {
    'use strict';
    const L = window.SokuLogic;
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    /* ---------- 保存 ---------- */
    const KEY = { set: 'sokudoku-settings', rec: 'sokudoku-records', txt: 'sokudoku-texts', seen: 'sokudoku-seen' };
    function load(key, def) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    }
    function save(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); return true; }
        catch (e) { toast('保存できませんでした（ブラウザの保存領域がいっぱいかもしれません）'); return false; }
    }
    const DEFAULTS = {
        fontSize: 19, lineHeight: 1.9, font: 'gothic', vertical: false, sep: 'none', ruby: true,
        theme: 'auto', guide: 'hl', pace: null, showTimer: true, rest: 20, sectionSize: 2000,
        guideIn: { check: false, repeat: false, skim: false }, // ペース読み以外でも色づけを使うか
    };
    let settings = Object.assign({}, DEFAULTS, load(KEY.set, {}));
    let records = load(KEY.rec, []);
    let userTexts = load(KEY.txt, []); // [{ id, title, author, credit, source, sections: [本文], bookmark, added }]
    const saveSettings = () => save(KEY.set, settings);
    const saveRecords = () => save(KEY.rec, records);
    const saveTexts = () => save(KEY.txt, userTexts);

    /* ---------- モード ---------- */
    const MODES = {
        check: { name: '速さチェック', desc: 'ふだんどおりに読んで、今の速さと理解度を測る' },
        pace: { name: 'ペース読み', desc: '読む場所の色づけに合わせて、少し速いペースで読む' },
        repeat: { name: 'くり返し読み', desc: '同じ文章を3回読んで、なめらかに読めるようにする' },
        skim: { name: '要点読み', desc: 'ふだんの40%の時間で、要点だけをつかむ' },
    };
    const REPEAT_ROUNDS = 3;

    const baseline = () => L.baseline(records);
    const currentPace = () => settings.pace || L.startPace(baseline());

    /* ---------- 画面の切りかえ ---------- */
    let screen = 'home';
    function show(id) {
        document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
        screen = id;
        window.scrollTo(0, 0);
        if (id === 'home') renderHome();
        if (id === 'library') renderLibrary();
        if (id === 'records') renderRecords();
        if (id === 'settings') renderSettings();
    }
    document.addEventListener('click', e => {
        const go = e.target.closest('[data-go]');
        if (go) show(go.dataset.go);
    });

    let toastTimer = 0;
    function toast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
    }

    /* ---------- 見た目の設定を反映 ---------- */
    function applyTheme() {
        document.documentElement.dataset.theme = settings.theme;
        document.documentElement.style.setProperty('--fs', settings.fontSize + 'px');
        document.documentElement.style.setProperty('--lh', settings.lineHeight.toFixed(1));
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        document.querySelector('meta[name="theme-color"]').setAttribute('content', bg || '#f7f6f2');
    }
    function pageClasses(el, free) {
        el.className = 'page';
        if (settings.font === 'mincho') el.classList.add('mincho');
        if (settings.vertical) el.classList.add('vertical');
        if (!settings.ruby) el.classList.add('noruby');
        if (settings.sep !== 'none') el.classList.add('sep-' + settings.sep);
        if (settings.guide === 'dim') el.classList.add('dim');
        if (free) el.classList.add('free');
    }

    /* ---------- 本文を画面に組む ---------- */
    /** 本文を <p> と文節の <span class="c"> にして el に入れる。返り値：各まとまりの文字数の配列 */
    function renderText(el, text, head) {
        const lay = L.layout(text);
        const lens = [];
        let html = '';
        if (head) html += `<h2 class="ttl">${esc(head.title)}</h2>` + (head.author ? `<p class="by">${esc(head.author)}</p>` : '');
        for (const para of lay) {
            if (para.blank) { html += '<p class="blank"></p>'; continue; }
            html += '<p>';
            for (const ch of para.chunks) {
                html += `<span class="c" data-i="${lens.length}">`;
                for (const u of ch.units) html += u.r ? `<ruby>${esc(u.t)}<rt>${esc(u.r)}</rt></ruby>` : esc(u.t);
                html += '</span>';
                lens.push(ch.len);
            }
            html += '</p>';
        }
        el.innerHTML = html;
        return lens;
    }

    /* ---------- ホーム ---------- */
    function renderHome() {
        const base = baseline();
        const today = new Date().toDateString();
        const todayMs = records.filter(r => new Date(r.ts).toDateString() === today).reduce((s, r) => s + (r.ms || 0), 0);
        const lastEff = [...records].reverse().find(r => r.eff != null);
        let html = '';
        if (!records.length) {
            html = `<div class="full">まずは<b>「速さチェック」</b>で、今の読む速さと理解度を測りましょう。その結果から、ペース読みの目標を決めます。</div>`;
        } else {
            html = `<div class="st"><small>ふだんの速さ</small><b>${base ?? '―'}</b><span>字/分</span></div>
                <div class="st"><small>実効速度</small><b>${lastEff ? lastEff.eff : '―'}</b><span>字/分（前回）</span></div>
                <div class="st"><small>きょうの練習</small><b>${Math.round(todayMs / 60000)}</b><span>分</span></div>`;
        }
        $('homeStats').innerHTML = html;
        const rec = !records.length ? 'check' : null;
        $('modeList').innerHTML = Object.entries(MODES).map(([k, m]) => {
            const st = poolStat(k);
            let extra = `<span class="pool">専用の文章 ${st.all}区間・まだ読んでいない ${st.unread}区間</span>`;
            if (k === 'pace') extra += `<span>目標 ${currentPace()} 字/分</span>`;
            return `<button class="mode${rec === k ? ' rec' : ''}" data-mode="${k}"><b>${m.name}${rec === k ? '<em class="tag">はじめに</em>' : ''}</b><span>${m.desc}</span>${extra}<i>›</i></button>`;
        }).join('');
    }
    $('modeList').addEventListener('click', e => {
        const b = e.target.closest('[data-mode]');
        if (b) openPick(b.dataset.mode);
    });

    /* ---------- 入っている文章 ---------- */
    // 目録（texts/catalog.js）には一覧に出すことだけがある。本文と問題は読むときに texts/<id>.txt から読む
    const CATALOG = window.SokuCatalog || [];
    const workById = id => CATALOG.find(w => w.id === id);
    const textCache = {};
    async function loadText(id) {
        if (textCache[id]) return textCache[id];
        const res = await fetch(`texts/${id}.txt`);
        if (!res.ok) throw new Error('文章を読みこめませんでした（' + res.status + '）');
        const t = L.parseTextFile(await res.text());
        textCache[id] = t;
        return t;
    }

    /* ---------- 読んだ区間の記録 ---------- */
    // seen：{ "作品id#区間番号": { m: 練習の種類, ts: 時刻 } }。前の版の { 作品id: 回数 } は #0 として読む
    function loadSeen() {
        const s = load(KEY.seen, {});
        for (const k of Object.keys(s)) if (!k.includes('#')) { s[k + '#0'] = { m: 'check', ts: 0 }; delete s[k]; }
        return s;
    }
    let seenMap = loadSeen();
    const isSeen = (id, sec) => !!seenMap[id + '#' + sec];
    function markSeen(id, sec, mode) { seenMap[id + '#' + sec] = { m: mode, ts: Date.now() }; save(KEY.seen, seenMap); }
    const readCount = w => w.secs.reduce((n, _, i) => n + (isSeen(w.id, i) ? 1 : 0), 0);
    const nextUnread = w => w.secs.findIndex((_, i) => !isSeen(w.id, i));
    const poolOf = mode => CATALOG.filter(w => w.mode === mode);
    function poolStat(mode) {
        let all = 0, unread = 0;
        for (const w of poolOf(mode)) { all += w.secs.length; unread += w.secs.length - readCount(w); }
        return { all, unread };
    }
    /** その練習の文章のうち、まだ読んでいない区間を順に1つ（読みかけの作品があればその続き） */
    function nextNew(mode) {
        const pool = poolOf(mode);
        const started = pool.find(w => readCount(w) > 0 && nextUnread(w) >= 0);
        const w = started || pool.find(w => nextUnread(w) >= 0);
        return w ? { work: w, sec: nextUnread(w) } : null;
    }

    /* ---------- 文章をえらぶ ---------- */
    let pickMode = 'check', pickTab = 'pool', pickKind = 'all';
    const PICK_NOTE = {
        check: '速さを正しく測るために、この練習には、ほかの練習では出てこない専用の文章が入っています。',
        pace: '色づけが文節ごとに進みます。おくれても大丈夫。前に戻りたいときは文字をタップします。',
        repeat: '同じ文章を3回読みます。この練習専用の文章です。',
        skim: '時間内に全体へ目を通し、要点だけをつかみます。この練習専用の文章です。',
    };
    const KINDS = [['all', 'すべて'], ['小説', '小説'], ['説明文', '説明文・随筆'], ['名作', '日本の名作'], ['海外名作', '海外の名作']];
    const kindOf = w => (w.kind === '随筆' ? '説明文' : w.kind);
    function openPick(mode) {
        pickMode = mode;
        if (pickTab !== 'long' && pickTab !== 'user') pickTab = 'pool';
        $('pickTitle').textContent = MODES[mode].name;
        $('pickNote').textContent = PICK_NOTE[mode];
        renderPick();
        show('pick');
    }
    $('pickTabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        pickTab = b.dataset.tab;
        renderPick();
    });
    const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const LEVEL = { 1: 'やさしめ', 2: 'ふつう', 3: 'むずかしめ' };
    const byLine = w => [w.author, w.translator, w.style ? '' : ''].filter(Boolean).join('・');

    /** 作品の行：区間ボタンつき */
    function workItem(w) {
        const n = w.secs.reduce((a, b) => a + b, 0);
        const done = readCount(w), next = nextUnread(w);
        const meta = [
            byLine(w) ? `<span>${esc(byLine(w))}</span>` : '',
            w.style ? `<span class="sty">${esc(w.style.replace('の書きぶりをまねたオリジナル', 'の書きぶりで（オリジナル）'))}</span>` : '',
            `<span>${stars(w.level)}</span>`,
            `<span>${n}字${w.secs.length > 1 ? `・${w.secs.length}区間` : ''}</span>`,
            done ? `<span class="done">${done === w.secs.length ? '読了' : `${done}/${w.secs.length}区間 読んだ`}</span>` : '',
        ].join('');
        const secs = w.secs.length > 1
            ? `<div class="secs">${w.secs.map((c, i) => `<button data-w="${w.id}" data-sec="${i}" class="${isSeen(w.id, i) ? 'read' : ''}${i === next ? ' next' : ''}" title="${c}字">${i + 1}</button>`).join('')}</div>`
            : '';
        return `<div class="item${done === w.secs.length ? ' all-read' : ''}"><button class="item-main" data-w="${w.id}"><span class="kind">${esc(w.kind)}</span><h3>${esc(w.title)}</h3><div class="meta">${meta}</div></button>${secs}</div>`;
    }

    function renderPick() {
        document.querySelectorAll('#pickTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === pickTab));
        let html = '';
        if (pickTab === 'pool') {
            const st = poolStat(pickMode);
            const nx = nextNew(pickMode);
            html += `<div class="card new-card"><div><b>${st.unread}</b><span> / ${st.all}区間がまだ読んでいない文章</span></div>
                ${nx ? `<button class="big-btn" id="pickNew">新しい文章で始める</button><p class="note small">次は「${esc(nx.work.title)}」${nx.work.secs.length > 1 ? `の${nx.sec + 1}区間め` : ''}（${nx.work.secs[nx.sec]}字）</p>`
                    : '<p class="note">この練習の文章はすべて読みました。もう一度読むこともできますが、内容を覚えているため、速さと理解度は参考の記録になります。「長編」や「自分の文章」も使えます。</p>'}</div>
                <div class="chips" id="pickKinds">${KINDS.map(([k, n]) => `<button data-kind="${k}" class="${pickKind === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
            const list = poolOf(pickMode).filter(w => pickKind === 'all' || kindOf(w) === pickKind);
            const unread = list.filter(w => readCount(w) < w.secs.length), read = list.filter(w => readCount(w) === w.secs.length);
            html += unread.map(workItem).join('') || '<div class="empty">この種類の、まだ読んでいない文章はありません</div>';
            if (read.length) html += `<details class="read-box"><summary>読み終えた文章（${read.length}）</summary>${read.map(workItem).join('')}</details>`;
        } else if (pickTab === 'long') {
            html += `<p class="note">青空文庫の長い作品を、約3000字ずつの区間に分けて読みます。どの練習からでも読めます（確認問題はなく、思い出しチェックをします）。読んだ区間は、ほかの練習でも「読んだ」になります。</p>`;
            html += poolOf('long').map(workItem).join('');
        } else if (!userTexts.length) {
            html = `<div class="empty">まだありません。<br>ホームの「文章を追加・管理」から、青空文庫のファイルや自分の文章を読みこめます。</div>
                <button class="big-btn sub" data-go="library">文章を追加する</button>`;
        } else {
            html = userTexts.map(t => {
                const total = t.sections.reduce((a, x) => a + L.countChars(x), 0);
                const next = Math.min(t.bookmark || 0, t.sections.length - 1);
                const secs = t.sections.length > 1
                    ? `<div class="secs">${t.sections.map((_, i) => `<button data-user="${t.id}" data-sec="${i}" class="${i < (t.bookmark || 0) ? 'read' : ''}${i === next ? ' next' : ''}">${i + 1}</button>`).join('')}</div>`
                    : `<div class="acts"><button class="pri" data-user="${t.id}" data-sec="0">読む</button></div>`;
                return `<div class="item"><h3>${esc(t.title)}</h3>
                    <div class="meta">${t.author ? `<span>${esc(t.author)}</span>` : ''}<span>${total}字</span>${t.sections.length > 1 ? `<span>${t.sections.length}区間・次は ${next + 1}</span>` : ''}${t.source === 'aozora' ? '<span>青空文庫</span>' : ''}</div>${secs}</div>`;
            }).join('');
        }
        $('pickList').innerHTML = html;
    }
    $('pickList').addEventListener('click', e => {
        if (e.target.closest('#pickNew')) {
            const nx = nextNew(pickMode);
            if (nx) startWork(pickMode, nx.work, nx.sec);
            return;
        }
        const k = e.target.closest('[data-kind]');
        if (k) { pickKind = k.dataset.kind; renderPick(); return; }
        const b = e.target.closest('[data-w]');
        if (b) {
            const w = workById(b.dataset.w);
            let sec = b.dataset.sec != null ? +b.dataset.sec : nextUnread(w);
            if (sec < 0) sec = 0;
            if (isSeen(w.id, sec) && !confirm('読んだことのある区間です。内容を覚えているので、速さと理解度は参考の記録になります（ふだんの速さには入れません）。読みますか？')) return;
            startWork(pickMode, w, sec);
            return;
        }
        const u = e.target.closest('[data-user]');
        if (u) {
            const t = userTexts.find(x => x.id === u.dataset.user);
            const i = +u.dataset.sec;
            startSession(pickMode, userSection(t, i));
        }
    });
    const userSection = (t, i) => ({
        id: t.id, sec: i, secCount: t.sections.length, userId: t.id,
        title: t.title + (t.sections.length > 1 ? `（${i + 1}/${t.sections.length}）` : ''), author: t.author,
        body: t.sections[i], questions: null, source: t.source, credit: t.credit,
    });

    /** 入っている作品の1区間で練習を始める（本文を読みこんでから） */
    async function startWork(mode, w, sec) {
        let t;
        try { t = await loadText(w.id); } catch (err) { toast(navigator.onLine === false ? 'インターネットにつながっていないため、まだ読んでいない文章を開けません' : err.message); return; }
        const multi = t.sections.length > 1;
        const qs = t.questions[sec] && t.questions[sec].length ? t.questions[sec] : null;
        startSession(mode, {
            id: w.id, sec, secCount: t.sections.length, work: w,
            title: w.title + (multi ? `（${sec + 1}/${t.sections.length}）` : ''),
            author: [w.author, w.translator].filter(Boolean).join('・'),
            body: t.sections[sec], questions: qs, source: w.source, credit: t.credit, style: w.style,
        });
    }

    /* ---------- 練習の流れ ---------- */
    let S = null; // いまの練習 { mode, text, chars, round, rounds:[ms], guide, pace, answers, ... }

    function startSession(mode, text) {
        S = {
            mode, text, chars: L.countChars(text.body), round: 1, rounds: [], pace: currentPace(),
            reread: isSeen(text.id, text.sec),
            guide: mode === 'pace' || !!(settings.guideIn && settings.guideIn[mode]),
        };
        if (mode === 'skim') {
            S.limit = L.skimLimitMs(S.chars, baseline());
            S.skimPace = L.clampPace(S.chars / (S.limit / 60000));
        }
        openReader();
    }
    /** 色づけの速さ（要点読みは制限時間に合わせる） */
    const guidePace = () => (S.mode === 'skim' ? S.skimPace : S.pace);

    /* ---------- 読む画面 ---------- */
    const reader = $('reader'), page = $('page');
    let lens = [], times = [], chunkEls = [];
    let running = false, activeMs = 0, lastTick = 0, raf = 0;
    let pacerMs = 0, curIdx = -1;
    let wakeLock = null;
    let sessionReadMs = 0; // この画面を開いてから読んだ時間（休けいの合図用）

    function openReader() {
        pageClasses(page, !S.guide);
        reader.classList.toggle('vertical', settings.vertical);
        lens = renderText(page, S.text.body, S.round === 1 ? { title: S.text.title, author: S.text.author } : { title: S.text.title });
        chunkEls = Array.from(page.querySelectorAll('.c'));
        times = L.schedule(lens, guidePace());
        activeMs = 0; pacerMs = 0; curIdx = -1; running = false;
        $('readInfo').textContent = MODES[S.mode].name + (S.mode === 'repeat' ? `　${S.round}/${REPEAT_ROUNDS}回め` : '');
        $('readClock').textContent = '';
        $('skimBar').hidden = S.mode !== 'skim';
        if (S.mode === 'skim') $('skimBar').firstElementChild.style.transform = 'scaleX(1)';
        renderCtrl();
        showCover();
        show('read');
        // 画面を出してから先頭へ（かくれている間は位置を変えられない）
        reader.scrollTop = 0;
        reader.scrollLeft = 0;
        requestAnimationFrame(() => { reader.scrollTop = 0; reader.scrollLeft = 0; });
    }

    /** スタート前の案内にのせる「色づけ」の切りかえ（ペース読み以外） */
    function guideBox() {
        if (S.mode === 'pace' || S.round > 1) return '';
        const on = S.guide;
        let detail = '';
        if (on && S.mode === 'skim') detail = `<p class="note small">制限時間に合わせて <b>${S.skimPace}字/分</b> で進みます。</p>`;
        else if (on) {
            detail = `<div class="pace-big"><button class="round-btn" data-pace="-20">−</button><b id="coverPace">${S.pace}<small> 字/分</small></b><button class="round-btn" data-pace="20">＋</button></div>`;
            if (S.mode === 'check') detail += '<p class="note small">色づけを使うと、測る速さは色づけの速さに近くなります。この回は「ふだんの速さ」には入れません。</p>';
        }
        return `<div class="guide-box"><div class="set"><span>読む場所の色づけ</span><div class="seg" id="guideSeg"><button data-g="0" class="${on ? '' : 'on'}">なし</button><button data-g="1" class="${on ? 'on' : ''}">あり</button></div></div>${detail}</div>`;
    }

    function showCover() {
        const m = S.mode;
        let body = '';
        if (m === 'check') {
            body = `<p>「スタート」で時間を測りはじめます。ふだんどおりに読み、読み終わったら下の<b>「読み終わった」</b>を押してください。</p>
                <p>${S.chars}字・読んだあとに${S.text.questions ? '確認問題' : '思い出しチェック'}があります。</p>`;
        } else if (m === 'pace') {
            body = `<p>読む場所が色づけされて進みます。色に合わせて目を進めましょう。</p>
                <ul><li>前に戻りたいときは、その文字をタップ</li><li>速さは下の − ＋ でいつでも変えられます</li></ul>
                <div class="pace-big"><button class="round-btn" data-pace="-20">−</button><b id="coverPace">${S.pace}<small> 字/分</small></b><button class="round-btn" data-pace="20">＋</button></div>
                <p class="note small" style="text-align:center">${baseline() ? `ふだんの速さ ${baseline()}字/分` : 'まだ速さチェックをしていません'}・この文章は約${L.fmtTime(S.chars / S.pace * 60000)}</p>`;
        } else if (m === 'repeat') {
            const prev = S.rounds.length ? `<p>${S.round - 1}回め：<b>${L.cpm(S.chars, S.rounds[S.rounds.length - 1])}字/分</b>（${L.fmtTime(S.rounds[S.rounds.length - 1])}）</p>` : '';
            body = prev + (S.round === 1
                ? `<p>同じ文章を${REPEAT_ROUNDS}回読みます。1回めはふつうに読み、読み終わったら「読み終わった」を押してください。</p>`
                : `<p>${S.round}回めです。2回め以降は、内容がわかっている分、なめらかに読めるはずです。意味を追いながら、少しだけテンポよく読んでみましょう。</p>`
                    + (S.guide ? `<div class="pace-big"><button class="round-btn" data-pace="-20">−</button><b id="coverPace">${S.pace}<small> 字/分</small></b><button class="round-btn" data-pace="20">＋</button></div>` : ''));
        } else if (m === 'skim') {
            body = `<p>制限時間は<b>${L.fmtTime(S.limit)}</b>（ふだんの約40%）。すべてを読むのではなく、要点をつかみます。</p>
                <ul><li>はじめの段落と最後の段落はしっかり読む</li><li>各段落の最初の文を拾う</li><li>「しかし」「つまり」「だからこそ」のあとに注目</li></ul>
                <p>時間になると本文がかくれて、要点の問題に進みます。</p>`;
        }
        if (S.reread) body += '<p class="note small">読んだことのある区間なので、この回は参考の記録になります。</p>';
        $('coverTitle').textContent = S.mode === 'repeat' && S.round > 1 ? `${S.round}回め` : S.text.title;
        $('coverBody').innerHTML = body + guideBox();
        $('coverGo').textContent = S.round > 1 ? `${S.round}回めをスタート` : 'スタート';
        $('readCover').hidden = false;
    }
    $('coverBody').addEventListener('click', e => {
        const g = e.target.closest('[data-g]');
        if (g) {
            S.guide = g.dataset.g === '1';
            settings.guideIn = Object.assign({}, settings.guideIn, { [S.mode]: S.guide });
            saveSettings();
            pageClasses(page, !S.guide);
            renderCtrl();
            showCover();
            return;
        }
        const b = e.target.closest('[data-pace]');
        if (!b) return;
        S.pace = L.clampPace(S.pace + +b.dataset.pace);
        $('coverPace').innerHTML = `${S.pace}<small> 字/分</small>`;
    });
    $('coverGo').addEventListener('click', () => {
        $('readCover').hidden = true;
        if (S.guide) {
            times = L.schedule(lens, guidePace());
            if (S.mode === 'pace') { settings.pace = S.pace; saveSettings(); }
        }
        resume();
    });

    function renderCtrl() {
        const c = $('readCtrl');
        const done = S.mode === 'pace' || (S.guide && S.mode !== 'skim') ? '終わる' : '読み終わった';
        if (S.guide && S.mode !== 'skim') {
            c.innerHTML = `<button id="cPause">停止</button>
                <div class="pace-ctl"><button data-pd="-20">−</button><b id="cPace">${S.pace}<small>字/分</small></b><button data-pd="20">＋</button></div>
                <button id="cDone" class="pri grow">${done}</button>`;
        } else {
            c.innerHTML = `<button id="cPause">一時停止</button><button id="cDone" class="pri grow">${done}</button>`;
        }
    }
    $('readCtrl').addEventListener('click', e => {
        if (e.target.closest('#cPause')) return running ? pause(true) : resume();
        if (e.target.closest('#cDone')) return finishReading();
        const pd = e.target.closest('[data-pd]');
        if (pd) setPace(S.pace + +pd.dataset.pd);
    });

    function setPace(v) {
        const nv = L.clampPace(v);
        if (nv === S.pace) return;
        // いま読んでいるまとまりの中の進み具合をたもったまま、時間割を作りなおす
        const i = Math.max(0, Math.min(curIdx, lens.length - 1));
        const frac = times[i + 1] > times[i] ? (pacerMs - times[i]) / (times[i + 1] - times[i]) : 0;
        S.pace = nv;
        times = L.schedule(lens, guidePace());
        pacerMs = times[i] + Math.max(0, Math.min(1, frac)) * (times[i + 1] - times[i]);
        const el = $('cPace');
        if (el) el.innerHTML = `${S.pace}<small>字/分</small>`;
        if (S.mode === 'pace') { settings.pace = S.pace; saveSettings(); }
    }

    // 文字をタップ → 色づけがあるときは、そこから
    page.addEventListener('click', e => {
        if (!S || !S.guide) return;
        const c = e.target.closest('.c');
        if (!c) return;
        const i = +c.dataset.i;
        pacerMs = times[i];
        highlight(i);
        if (!running && $('readCover').hidden) resume();
    });

    function resume() {
        if (running) return;
        running = true;
        lastTick = performance.now();
        const b = $('cPause');
        if (b) b.textContent = S.guide && S.mode !== 'skim' ? '停止' : '一時停止';
        requestWake();
        raf = requestAnimationFrame(tick);
    }
    function pause(byUser) {
        if (!running) return;
        tick(performance.now(), true);
        running = false;
        cancelAnimationFrame(raf);
        const b = $('cPause');
        if (b) b.textContent = '再開';
        releaseWake();
        if (!byUser) toast('一時停止しました（画面からはなれたため）');
    }

    function tick(now, once) {
        const dt = Math.min(1000, now - lastTick); // 端末が止まっていた分は数えない
        lastTick = now;
        activeMs += dt;
        sessionReadMs += dt;
        if (settings.showTimer) $('readClock').textContent = L.fmtTime(activeMs);
        if (S.guide) {
            pacerMs += dt;
            const i = L.indexAt(times, pacerMs);
            if (i >= lens.length) { highlight(-1); if (!once) { running = false; finishReading(S.mode === 'skim'); } return; }
            if (i !== curIdx) highlight(i);
        }
        if (S.mode === 'skim') {
            const left = Math.max(0, S.limit - activeMs);
            $('skimBar').firstElementChild.style.transform = `scaleX(${left / S.limit})`;
            $('readClock').textContent = 'のこり ' + L.fmtTime(left); // 要点読みは時計をかくす設定でものこり時間を出す
            if (left <= 0 && !once) { running = false; finishReading(true); return; }
        }
        if (!once && running) raf = requestAnimationFrame(tick);
    }

    function highlight(i) {
        if (curIdx >= 0 && chunkEls[curIdx]) chunkEls[curIdx].classList.remove('now');
        if (settings.guide === 'dim') chunkEls.forEach((el, k) => el.classList.toggle('done', i >= 0 && k < i));
        curIdx = i;
        if (i < 0) return;
        const el = chunkEls[i];
        el.classList.add('now');
        follow(el);
    }

    /** 色づけしている所が画面の見やすい位置にくるように動かす */
    function follow(el) {
        const r = reader.getBoundingClientRect(), e = el.getBoundingClientRect();
        if (settings.vertical) {
            // 縦書きは右から左へ進む：読んでいる行が右から 30% あたりにくるように
            if (e.left < r.left + r.width * 0.2 || e.right > r.right - r.width * 0.04)
                reader.scrollBy({ left: e.right - (r.left + r.width * 0.72), behavior: 'smooth' });
        } else if (e.top < r.top + r.height * 0.08 || e.bottom > r.top + r.height * 0.6) {
            reader.scrollBy({ top: e.top - (r.top + r.height * 0.28), behavior: 'smooth' });
        }
    }

    async function requestWake() {
        try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    }
    function releaseWake() {
        try { wakeLock?.release(); } catch (e) { /* なにもしない */ }
        wakeLock = null;
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && screen === 'read' && running) pause(false);
    });

    $('readQuit').addEventListener('click', () => {
        const was = running;
        pause(true);
        if (activeMs > 3000 && !confirm('練習をやめますか？（この回の記録は残りません）')) { if (was) resume(); return; }
        releaseWake();
        S = null;
        show('pick');
        renderPick();
    });

    function finishReading(timeUp) {
        if (running) { tick(performance.now(), true); running = false; cancelAnimationFrame(raf); }
        releaseWake();
        if (activeMs < 2000) { toast('もう少し読んでから押してください'); if (!timeUp) resume(); return; }
        S.ms = Math.round(activeMs);
        if (S.mode === 'repeat') {
            S.rounds.push(S.ms);
            if (S.round < REPEAT_ROUNDS) { S.round++; openReader(); return; }
        }
        if (S.mode === 'skim') S.timeUp = !!timeUp;
        markSeen(S.text.id, S.text.sec, S.mode);
        if (S.text.questions) openQuiz(); else openRecall();
    }

    /* ---------- 確認問題 ---------- */
    function quizFor(text, mode) {
        let qs = text.questions;
        if (mode === 'skim') {
            const main = qs.filter(q => q.type === 'main');
            qs = main.length >= 2 ? main : main.concat(qs.filter(q => q.type !== 'main')).slice(0, 2);
        }
        return qs.map(q => L.shuffleQuestion(q));
    }
    const TYPE_NAME = { main: '要点', detail: 'くわしく', infer: '読みとり' };
    function openQuiz() {
        S.questions = quizFor(S.text, S.mode);
        S.answers = S.questions.map(() => -1);
        $('quizNote').textContent = S.mode === 'skim'
            ? '要点についての問題です。本文は見ずに答えます。'
            : '本文は見ずに答えます。わからないときは、いちばん近いと思うものを選んでください。';
        $('quizList').innerHTML = S.questions.map((q, i) => `<div class="q"><h3><small>問${i + 1}・${TYPE_NAME[q.type]}</small>${esc(q.q)}</h3>
            ${q.choices.map((c, k) => `<button class="ch" data-q="${i}" data-k="${k}">${esc(c)}</button>`).join('')}</div>`).join('');
        $('quizDone').disabled = true;
        show('quiz');
    }
    $('quizList').addEventListener('click', e => {
        const b = e.target.closest('.ch');
        if (!b) return;
        const i = +b.dataset.q;
        S.answers[i] = +b.dataset.k;
        b.parentNode.querySelectorAll('.ch').forEach(x => x.classList.toggle('sel', x === b));
        $('quizDone').disabled = S.answers.some(a => a < 0);
    });
    $('quizDone').addEventListener('click', () => {
        S.comp = L.score(S.answers, S.questions);
        S.compType = 'quiz';
        finishSession();
    });

    /* ---------- 思い出しチェック ---------- */
    const RATES = ['ほとんど<br>わからない', 'あまり', '半分くらい', 'だいたい', 'よく<br>わかった'];
    function openRecall() {
        $('recallText').value = '';
        $('recallRate').innerHTML = RATES.map((r, i) => `<button data-r="${i + 1}"><b>${i + 1}</b>${r}</button>`).join('');
        $('recallDone').disabled = true;
        S.rating = null;
        show('recall');
    }
    $('recallRate').addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        S.rating = +b.dataset.r;
        $('recallRate').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
        $('recallDone').disabled = false;
    });
    $('recallDone').addEventListener('click', () => {
        S.comp = L.selfComp(S.rating);
        S.compType = 'self';
        S.summary = $('recallText').value.trim().slice(0, 400);
        finishSession();
    });

    /* ---------- 結果 ---------- */
    function finishSession() {
        const base = baseline(); // この回を入れる前のふだんの速さ
        const speed = L.cpm(S.chars, S.mode === 'repeat' ? S.rounds[S.rounds.length - 1] : S.ms);
        const rec = {
            ts: Date.now(), mode: S.mode, textId: S.text.id, sec: S.text.sec, title: S.text.title, chars: S.chars,
            ms: S.mode === 'repeat' ? S.rounds.reduce((a, b) => a + b, 0) : S.ms,
            cpm: speed, comp: S.comp, compType: S.compType, eff: L.effective(speed, S.comp),
        };
        if (S.mode === 'repeat') rec.rounds = S.rounds.map(ms => L.cpm(S.chars, ms));
        if (S.guide) rec.pace = guidePace();
        if (S.guide && S.mode !== 'pace') rec.guided = true;
        if (S.reread) rec.reread = true;
        if (S.mode === 'skim') { rec.limit = S.limit; rec.timeUp = S.timeUp; }
        if (S.summary) rec.summary = S.summary;
        records.push(rec);
        saveRecords();

        // しおり：区間のある作品は、読んだ区間の次へ
        if (S.text.userId) {
            const t = userTexts.find(x => x.id === S.text.userId);
            if (t && (t.bookmark || 0) <= S.text.sec) { t.bookmark = S.text.sec + 1; saveTexts(); }
        }

        // ペースの調整
        let paceMsg = '';
        if (S.mode === 'pace') {
            const np = L.nextPace(S.pace, S.comp);
            S.oldPace = S.pace;
            settings.pace = np; saveSettings();
            if (np > S.pace) paceMsg = `理解度が80%以上だったので、次のペースを <b>${S.pace} → ${np}字/分</b> に上げました。`;
            else if (np < S.pace) paceMsg = `理解度が60%に届かなかったので、次のペースを <b>${S.pace} → ${np}字/分</b> に下げました。速さより、まず理解を優先しましょう。`;
            else paceMsg = `次も <b>${np}字/分</b> で。理解度が80%以上になったら、少しずつ上げていきます。`;
        } else if (S.mode === 'check' && (!settings.pace || records.filter(r => r.mode === 'check').length === 1)) {
            settings.pace = L.startPace(baseline());
            saveSettings();
            paceMsg = `この結果から、ペース読みの目標を <b>${settings.pace}字/分</b>（ふだんの約1.1倍）にしました。`;
        }
        renderResult(rec, base, paceMsg);
        show('result');
        if (settings.rest && sessionReadMs >= settings.rest * 60000) openRest();
    }

    function renderResult(rec, base, paceMsg) {
        const compLabel = rec.compType === 'self' ? '理解度（自己評価）' : (rec.mode === 'skim' ? '要点の正答率' : '理解度');
        let diff = '';
        if (base && rec.mode !== 'skim') {
            const d = Math.round((rec.cpm / base - 1) * 100);
            diff = `ふだん（${base}字/分）より <span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d}%</span>`;
        }
        let html = `<div class="card res-main"><div class="lbl">${esc(MODES[rec.mode].name)}・${esc(rec.title)}</div>
            <div class="num">${rec.cpm}<small>字/分</small></div><div class="sub">${rec.mode === 'repeat' ? '3回めの速さ・' : ''}${rec.chars}字を ${L.fmtTime(rec.mode === 'repeat' ? S.rounds[S.rounds.length - 1] : rec.ms)}${diff ? '・' + diff : ''}</div></div>
            <div class="res-grid"><div class="card"><b>${rec.comp}%</b><span>${compLabel}</span></div>
            <div class="card"><b>${rec.eff}</b><span>実効速度（字/分）<br>＝ 速さ × 理解度</span></div></div>`;

        if (rec.mode === 'repeat') {
            const max = Math.max(...rec.rounds);
            const gain = Math.round((rec.rounds[rec.rounds.length - 1] / rec.rounds[0] - 1) * 100);
            html += `<div class="card"><h2 class="card-h">回ごとの速さ</h2><div class="rounds">${rec.rounds.map((v, i) => `<div class="rr"><span>${i + 1}回め</span><i style="width:${Math.max(4, v / max * 100)}%"></i><span>${v}字/分</span></div>`).join('')}</div>
                <p class="note small">1回めから <span class="${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : ''}${gain}%</span>。くり返し読むと、ことばのまとまりが早く目に入るようになります。</p></div>`;
        }

        const adv = [];
        if (paceMsg) adv.push(paceMsg);
        if (rec.mode === 'skim') {
            adv.push(rec.timeUp ? '時間内に最後まで目を通せたかどうかをふり返ってみましょう。' : '時間内に読み終えました。');
            adv.push(rec.comp >= 80 ? '要点をしっかりつかめています。急いで読む必要があるときは、この読み方が使えます。'
                : '要点を拾うには、はじめと終わりの段落、各段落の最初の文に目を向けるのがこつです。細かいところは落ちてもかまいません。');
        } else if (rec.mode !== 'pace') {
            if (rec.cpm > 2000) adv.push('とても速い記録です。読み終わる前に「読み終わった」を押していませんか？ 速さチェックを何回かくり返すと、ふだんの速さ（新しい5回の真ん中の値）がより正確になります。');
            if (rec.comp != null && rec.comp < 60) adv.push('理解度が低めです。速さよりも、内容をつかめる速さで読むことを優先しましょう。');
            else if (rec.comp != null && rec.comp >= 80) adv.push('よく理解できています。ペース読みで少し速いペースに慣れていきましょう。');
        }
        if (rec.compType === 'self') adv.push('自分の文章や青空文庫の作品には確認問題がないので、理解度は自己評価です。速さの記録はほかと同じように残ります。');
        if (adv.length) html += `<div class="card advice">${adv.map(a => `<p>${a}</p>`).join('')}</div>`;

        if (S.questions) {
            html += `<div class="card review"><h2 class="card-h">答え合わせ</h2>${S.questions.map((q, i) => {
                const ok = S.answers[i] === q.answer;
                return `<div class="rv"><span class="mk ${ok ? 'ok' : 'ng'}">${ok ? '○' : '×'}</span>${esc(q.q)}
                    ${ok ? '' : `<div class="ans">正解：${esc(q.choices[q.answer])}</div>`}</div>`;
            }).join('')}</div>`;
        }
        if (rec.summary) html += `<div class="card"><h2 class="card-h">あなたのまとめ</h2><p>${esc(rec.summary)}</p></div>`;

        const nx = nextNew(rec.mode);
        const inPool = S.text.work && S.text.work.mode === rec.mode;
        if (nx) html += `<button class="big-btn" id="resNew">次の新しい文章で${MODES[rec.mode].name}</button><p class="note small center">次は「${esc(nx.work.title)}」${nx.work.secs.length > 1 ? `の${nx.sec + 1}区間め` : ''}・この練習のまだ読んでいない文章は あと${poolStat(rec.mode).unread}区間</p>`;
        if (!inPool && S.text.sec + 1 < S.text.secCount) html += `<button class="big-btn sub" id="resNextSec">続き（${S.text.sec + 2}区間め）を${MODES[rec.mode].name}</button>`;
        html += `<button class="big-btn sub" id="resAgain">文章をえらぶ</button>`;
        if (rec.mode === 'pace') html += `<button class="big-btn sub" id="resSame">同じ文章をもう一度（${settings.pace}字/分）</button>`;
        html += `<button class="big-btn sub" data-go="home">ホームへ</button>`;
        if (S.text.credit) html += `<details class="credit-box"><summary class="note small">この作品について（底本・入力者など）</summary><div class="credit">${esc(S.text.credit)}</div></details>`;
        else if (S.text.style) html += `<p class="note small center">この文章は、${esc(S.text.style.replace('の書きぶりをまねたオリジナル', ''))}の書きぶりをまねて、このアプリのために書いたオリジナルです。</p>`;
        $('resultBody').innerHTML = html;
    }
    $('resultBody').addEventListener('click', e => {
        if (e.target.closest('#resAgain')) { openPick(S.mode); return; }
        if (e.target.closest('#resNew')) { const nx = nextNew(S.mode); if (nx) startWork(S.mode, nx.work, nx.sec); return; }
        if (e.target.closest('#resSame')) { const t = S.text; startSession('pace', t); return; }
        if (e.target.closest('#resNextSec')) {
            const i = S.text.sec + 1;
            if (S.text.userId) { const t = userTexts.find(x => x.id === S.text.userId); if (t) startSession(S.mode, userSection(t, i)); }
            else if (S.text.work) startWork(S.mode, S.text.work, i);
        }
    });

    /* ---------- 休けい ---------- */
    let restTimer = 0;
    function openRest() {
        sessionReadMs = 0;
        let n = 20;
        $('restCount').textContent = n;
        $('rest').hidden = false;
        clearInterval(restTimer);
        restTimer = setInterval(() => {
            n--;
            $('restCount').textContent = n;
            if (n <= 0) { clearInterval(restTimer); $('rest').hidden = true; toast('おつかれさまでした'); }
        }, 1000);
    }
    $('restSkip').addEventListener('click', () => { clearInterval(restTimer); $('rest').hidden = true; });

    /* ---------- 文章の追加 ---------- */
    let pending = null; // 確認中の文章 { title, author, body, credit, source }
    const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    $('fileIn').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const buf = await f.arrayBuffer();
            let bytes = new Uint8Array(buf);
            if (/\.zip$/i.test(f.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
                bytes = await L.unzipFirstText(buf, inflateRaw);
            }
            const raw = L.decodeText(bytes);
            const c = L.cleanAozora(raw);
            if (!c.body.trim()) throw new Error('本文が見つかりませんでした');
            pending = { title: c.title || f.name.replace(/\.(zip|txt)$/i, ''), author: c.author, body: c.body, credit: c.credit, source: L.looksAozora(raw) ? 'aozora' : 'user' };
            renderPreview();
        } catch (err) {
            toast('読みこめませんでした：' + err.message);
        }
    });
    async function inflateRaw(data) {
        if (typeof DecompressionStream === 'undefined') throw new Error('このブラウザは zip に対応していません。zip を開いて .txt を選んでください');
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    $('pasteAdd').addEventListener('click', () => {
        const raw = $('pasteBody').value;
        if (!raw.trim()) { toast('本文を貼りつけてください'); return; }
        const isAoz = L.looksAozora(raw);
        const c = isAoz ? L.cleanAozora(raw) : { body: raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), title: '', author: '', credit: '' };
        pending = {
            title: $('pasteTitle').value.trim() || c.title || '（題名なし）',
            author: $('pasteAuthor').value.trim() || c.author || '',
            body: c.body, credit: c.credit, source: isAoz ? 'aozora' : 'user',
        };
        renderPreview();
    });

    function renderPreview() {
        const secs = L.splitSections(pending.body, settings.sectionSize);
        pending.sections = secs;
        const n = L.countChars(pending.body);
        const head = L.plainText(secs[0] || '').replace(/\s+/g, ' ').slice(0, 120);
        const el = $('impPreview');
        el.hidden = false;
        el.innerHTML = `<h2 class="card-h">この内容で追加しますか？</h2>
            <label class="field"><span>題名</span><input id="pvTitle" type="text" maxlength="80" value="${esc(pending.title)}"></label>
            <label class="field"><span>著者</span><input id="pvAuthor" type="text" maxlength="60" value="${esc(pending.author)}"></label>
            <p class="note">${n}字${secs.length > 1 ? `・約${settings.sectionSize}字ずつ <b>${secs.length}区間</b> に分けます` : ''}${pending.source === 'aozora' ? '・青空文庫の形式として整えました' : ''}</p>
            <p class="note small">はじめの部分：${esc(head)}…</p>
            ${pending.credit ? `<details><summary class="note small">底本・入力者などの情報</summary><div class="credit">${esc(pending.credit)}</div></details>` : ''}
            <div class="btn-row"><button class="big-btn sub" id="pvCancel">やめる</button><button class="big-btn" id="pvOk">追加する</button></div>`;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    $('impPreview').addEventListener('click', e => {
        if (e.target.closest('#pvCancel')) { pending = null; $('impPreview').hidden = true; return; }
        if (e.target.closest('#pvOk')) {
            const t = {
                id: uid(), title: $('pvTitle').value.trim() || pending.title, author: $('pvAuthor').value.trim(),
                credit: pending.credit, source: pending.source, sections: pending.sections, bookmark: 0, added: Date.now(),
            };
            userTexts.unshift(t);
            if (!saveTexts()) { userTexts.shift(); return; }
            pending = null;
            $('impPreview').hidden = true;
            $('pasteTitle').value = $('pasteAuthor').value = $('pasteBody').value = '';
            renderLibrary();
            toast('追加しました。練習をえらぶと「青空文庫・自分の文章」から読めます');
        }
    });

    function renderLibrary() {
        $('libList').innerHTML = userTexts.length ? userTexts.map(t => {
            const n = t.sections.reduce((a, x) => a + L.countChars(x), 0);
            return `<div class="item"><h3>${esc(t.title)}</h3>
                <div class="meta">${t.author ? `<span>${esc(t.author)}</span>` : ''}<span>${n}字</span>${t.sections.length > 1 ? `<span>${t.sections.length}区間・${t.bookmark || 0}区間読了</span>` : ''}${t.source === 'aozora' ? '<span>青空文庫</span>' : ''}</div>
                <div class="acts">${t.credit ? `<button data-info="${t.id}">情報</button>` : ''}${t.bookmark ? `<button data-reset="${t.id}">しおりを最初に</button>` : ''}<button class="del" data-del="${t.id}">削除</button></div>
                <div class="credit" id="cr-${t.id}" hidden>${esc(t.credit || '')}</div></div>`;
        }).join('') : '<div class="empty">まだありません</div>';
    }
    $('libList').addEventListener('click', e => {
        const info = e.target.closest('[data-info]');
        if (info) { const c = $('cr-' + info.dataset.info); c.hidden = !c.hidden; return; }
        const rs = e.target.closest('[data-reset]');
        if (rs) { const t = userTexts.find(x => x.id === rs.dataset.reset); t.bookmark = 0; saveTexts(); renderLibrary(); return; }
        const del = e.target.closest('[data-del]');
        if (del) {
            const t = userTexts.find(x => x.id === del.dataset.del);
            if (!confirm(`「${t.title}」を削除しますか？（記録は残ります）`)) return;
            userTexts = userTexts.filter(x => x !== t);
            saveTexts();
            renderLibrary();
        }
    });

    /* ---------- 記録 ---------- */
    let recMode = 'check';
    $('recTabs').addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        recMode = b.dataset.m;
        renderRecords();
    });
    function renderRecords() {
        document.querySelectorAll('#recTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === recMode));
        const base = baseline();
        const effs = records.filter(r => r.eff != null && r.mode !== 'skim');
        const best = effs.length ? Math.max(...effs.map(r => r.eff)) : null;
        const total = records.reduce((s, r) => s + (r.ms || 0), 0);
        $('recSummary').innerHTML = `<div class="st"><small>ふだんの速さ</small><b>${base ?? '―'}</b><span>字/分</span></div>
            <div class="st"><small>実効速度</small><b>${best ?? '―'}</b><span>字/分（最高）</span></div>
            <div class="st"><small>練習した時間</small><b>${Math.round(total / 60000)}</b><span>分・${records.length}回</span></div>`;
        const list = records.filter(r => r.mode === recMode);
        drawChart($('recChart'), list.slice(-30));
        $('recList').innerHTML = list.length ? list.slice().reverse().map(r => `<div class="rec"><span class="t">${esc(r.title)}</span>
            <span class="d">${L.fmtDate(r.ts)}${r.pace ? `・ペース ${r.pace}` : ''}${r.rounds ? `・${r.rounds.join(' → ')}` : ''}</span>
            <span class="v"><b>${r.cpm}</b> 字/分<small>理解 ${r.comp ?? '―'}%${r.compType === 'self' ? '（自己）' : ''}・実効 ${r.eff ?? '―'}</small></span></div>`).join('')
            : `<div class="empty">「${MODES[recMode].name}」の記録はまだありません</div>`;
    }

    /** 速さと実効速度の折れ線グラフ（同じ単位なので1つの軸） */
    function drawChart(box, list) {
        if (list.length < 2) {
            box.innerHTML = `<div class="empty">${list.length ? 'あと1回練習すると、グラフが出ます' : 'グラフは記録が2回以上になると出ます'}</div>`;
            return;
        }
        const W = 340, H = 190, pl = 40, pr = 12, pt = 10, pb = 24;
        const vals = list.flatMap(r => [r.cpm, r.eff ?? r.cpm]);
        let max = Math.max(...vals), min = Math.min(...vals);
        const span = Math.max(50, max - min);
        min = Math.max(0, Math.floor((min - span * 0.15) / 50) * 50);
        max = Math.ceil((max + span * 0.1) / 50) * 50;
        const x = i => pl + (W - pl - pr) * (list.length === 1 ? 0.5 : i / (list.length - 1));
        const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
        const step = Math.max(50, Math.ceil((max - min) / 4 / 50) * 50);
        let grid = '';
        for (let v = min; v <= max; v += step) grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
        const line = (key, color) => {
            const pts = list.map((r, i) => (r[key] == null ? null : [x(i), y(r[key])])).filter(Boolean);
            return `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p.join(',')).join(' ')}"/>`
                + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`).join('');
        };
        const first = L.fmtDate(list[0].ts).slice(5, 10), last = L.fmtDate(list[list.length - 1].ts).slice(5, 10);
        box.innerHTML = `<div class="legend"><span><i style="background:var(--s1)"></i>速さ</span><span><i style="background:var(--s2)"></i>実効速度（速さ×理解度）</span><span style="margin-left:auto">字/分</span></div>
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="速さと実効速度の移り変わり">
              <g class="axis">${grid}<text x="${pl}" y="${H - 6}">${first}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${last}</text></g>
              ${line('cpm', 'var(--s1)')}${line('eff', 'var(--s2)')}
              <line class="cross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/>
              <rect x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent" class="hit"/>
            </svg><div class="tip" hidden></div>`;
        const svg = box.querySelector('svg'), tip = box.querySelector('.tip'), cross = box.querySelector('.cross');
        const at = ev => {
            const r = svg.getBoundingClientRect();
            const px = (ev.clientX - r.left) / r.width * W;
            const i = Math.max(0, Math.min(list.length - 1, Math.round((px - pl) / (W - pl - pr) * (list.length - 1))));
            const rec = list[i];
            cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
            tip.hidden = false;
            tip.innerHTML = `${L.fmtDate(rec.ts)}<br><i style="background:var(--s1)"></i>速さ ${rec.cpm}<br><i style="background:var(--s2)"></i>実効速度 ${rec.eff ?? '―'}（理解 ${rec.comp ?? '―'}%）`;
            const bx = box.getBoundingClientRect();
            const left = x(i) / W * r.width + (r.left - bx.left);
            tip.style.left = Math.min(bx.width - tip.offsetWidth - 4, Math.max(4, left - tip.offsetWidth / 2)) + 'px';
            tip.style.top = '4px';
        };
        svg.addEventListener('pointermove', at);
        svg.addEventListener('pointerdown', at);
        svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
    }

    /* ---------- 設定 ---------- */
    const PREVIEW = '　メロスは激怒した。必ず、かの｜邪智暴虐《じゃちぼうぎゃく》の王を除かなければならぬと決意した。\n　読む速さは、ことばを見て意味をつかむ処理の速さで決まります。';
    function renderSettings() {
        $('vFontSize').textContent = settings.fontSize + 'px';
        $('vLineHeight').textContent = settings.lineHeight.toFixed(1);
        $('vPace').textContent = currentPace() + '字/分';
        document.querySelectorAll('[data-set]').forEach(seg => {
            const v = String(settings[seg.dataset.set]);
            seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
        });
        const pv = $('setPreview');
        pageClasses(pv, true);
        pv.classList.remove('vertical');
        pv.classList.add('preview-page');
        renderText(pv, PREVIEW);
        const cs = pv.querySelectorAll('.c');
        if (cs[6]) cs[6].classList.add('now');
        if (settings.guide === 'dim') for (let i = 0; i < 6; i++) cs[i]?.classList.add('done');
    }
    document.querySelectorAll('[data-set]').forEach(seg => seg.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        const k = seg.dataset.set, d = DEFAULTS[k];
        let v = b.dataset.v;
        if (typeof d === 'boolean') v = v === 'true';
        else if (typeof d === 'number') v = +v;
        settings[k] = v;
        saveSettings();
        applyTheme();
        renderSettings();
    }));
    document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.step, d = +b.dataset.d;
        if (k === 'fontSize') settings.fontSize = Math.max(14, Math.min(30, settings.fontSize + d));
        if (k === 'lineHeight') settings.lineHeight = Math.round(Math.max(1.4, Math.min(2.6, settings.lineHeight + d)) * 10) / 10;
        if (k === 'pace') settings.pace = L.clampPace(currentPace() + d);
        saveSettings();
        applyTheme();
        renderSettings();
    }));

    $('dataExport').addEventListener('click', () => {
        const data = { app: 'sokudoku', version: 1, exported: new Date().toISOString(), settings, records, texts: userTexts, seen: seenMap };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sokudoku-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('dataImport').addEventListener('change', async e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const d = JSON.parse(await f.text());
            if (d.app !== 'sokudoku' || !Array.isArray(d.records)) throw new Error('速読ラボのデータではありません');
            if (!confirm(`記録 ${d.records.length}件・文章 ${(d.texts || []).length}件を読みこみます。今のデータは置きかわります。よろしいですか？`)) return;
            settings = Object.assign({}, DEFAULTS, d.settings || {});
            records = d.records;
            userTexts = d.texts || [];
            saveSettings(); saveRecords(); saveTexts(); save(KEY.seen, d.seen || {});
            seenMap = loadSeen();
            applyTheme();
            renderSettings();
            toast('読みこみました');
        } catch (err) {
            toast('読みこめませんでした：' + err.message);
        }
    });
    $('dataClear').addEventListener('click', () => {
        if (!confirm('記録をすべて消しますか？（読みこんだ文章と設定は残ります）')) return;
        records = [];
        saveRecords();
        seenMap = {};
        save(KEY.seen, seenMap);
        settings.pace = null;
        saveSettings();
        renderSettings();
        toast('記録を消しました');
    });

    $('dataOffline').addEventListener('click', async () => {
        const btn = $('dataOffline');
        btn.disabled = true;
        let ok = 0;
        for (const w of CATALOG) {
            try { await loadText(w.id); ok++; } catch (e) { /* 取れなかったものは数えない */ }
            btn.textContent = `保存しています… ${ok}/${CATALOG.length}`;
        }
        btn.disabled = false;
        btn.textContent = 'すべての文章をこの端末に保存';
        toast(ok === CATALOG.length ? `${ok}作品を保存しました` : `${ok}/${CATALOG.length}作品を保存しました（つながりを確かめて、もう一度おしてください）`);
    });

    /* ---------- はじめ ---------- */
    applyTheme();
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
    show('home');
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
