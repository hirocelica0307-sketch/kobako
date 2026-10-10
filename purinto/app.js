/* たのしい プリント ── 画面（えらぶ・せってい・プレビュー・いんさつ）
   ------------------------------------------------------------------
   じょうたいは URL の # に のせる：
     #p=storymaze&seed=1234&n=1&ans=0&o.story=kuma
   おなじ URL を ひらけば、おなじ プリントが でる。
   ------------------------------------------------------------------ */
(function () {
    'use strict';
    const S = window.PurintoSheets;
    const $ = id => document.getElementById(id);

    /* きょうかの ボタンの アイコン（Phosphor duotone） */
    const SUBJ_IC = { all: 'sparkle', kokugo: 'book', sansu: 'calculator', seikatsu: 'plant', dotoku: 'heart', taiiku: 'run', zuko: 'palette', cog: 'brain' };
    const icons = el => { if (window.PurintoIcons) window.PurintoIcons.fill(el); };
    const emojify = el => { if (window.PurintoEmoji) window.PurintoEmoji.inDom(el); };
    const noEmoji = s => window.PurintoEmoji ? window.PurintoEmoji.strip(s) : s;

    const state = { subject: 'all', entry: S.CATALOG[0], opt: {}, seed: newSeed(), copies: 1, answer: false, showAnswer: true };

    function newSeed() { return 1 + Math.floor(Math.random() * 999999); }

    /* ---------- URL ---------- */

    function readHash() {
        const h = new URLSearchParams(location.hash.slice(1));
        const e = S.CATALOG.find(c => c.id === h.get('p'));
        if (!e) return;
        state.entry = e;
        state.seed = Math.max(1, parseInt(h.get('seed'), 10) || newSeed());
        state.copies = Math.min(40, Math.max(1, parseInt(h.get('n'), 10) || 1));
        state.answer = h.get('ans') === '1';
        state.opt = {};
        for (const [k, v] of h) if (k.startsWith('o.')) state.opt[k.slice(2)] = v;
    }

    function writeHash() {
        const h = new URLSearchParams();
        h.set('p', state.entry.id);
        h.set('seed', state.seed);
        if (state.copies > 1) h.set('n', state.copies);
        if (state.answer) h.set('ans', '1');
        const opt = S.resolveOptions(state.entry, state.opt);
        const def = S.resolveOptions(state.entry, {});
        for (const k of Object.keys(opt)) if (opt[k] !== def[k]) h.set('o.' + k, opt[k] === true ? '1' : opt[k] === false ? '0' : opt[k]);
        history.replaceState(null, '', '#' + h.toString());
    }

    /* ---------- メニュー ---------- */

    function renderSubjects() {
        const nav = $('subjects');
        const list = [['all', '✨', 'ぜんぶ'], ...Object.entries(S.SUBJECTS).map(([k, v]) => [k, v.icon, v.label])];
        nav.innerHTML = list.map(([k, ic, lb]) =>
            `<button type="button" class="subj subj-${k}${state.subject === k ? ' on' : ''}" data-s="${k}"><span class="ui-ic" data-ic="${SUBJ_IC[k] || 'star'}"></span> ${S.esc(lb)}</button>`).join('');
        /* めあてカード（となりの ページ） */
        nav.insertAdjacentHTML('beforeend', '<a class="subj subj-meate" href="meate.html" title="めあてカード の ページへ"><span class="ui-ic" data-ic="pencil"></span> めあてカード</a>');
        icons(nav);
        nav.querySelectorAll('button').forEach(b => b.onclick = () => { state.subject = b.dataset.s; renderSubjects(); renderCards(); });
    }

    function renderCards() {
        const box = $('cards');
        const list = S.CATALOG.filter(c => state.subject === 'all' || c.subject === state.subject);
        box.innerHTML = list.map(c => `<button type="button" class="card subj-${c.subject}${c.id === state.entry.id ? ' on' : ''}" data-id="${c.id}">
            <span class="c-icon">${c.icon}</span><span class="c-text"><b>${S.esc(c.title)}</b><small><span class="ui-ic" data-ic="${SUBJ_IC[c.subject]}"></span> ${S.esc(S.SUBJECTS[c.subject].label)}</small><span>${S.esc(noEmoji(c.desc))}</span></span></button>`).join('');
        emojify(box); icons(box);
        box.querySelectorAll('.card').forEach(b => b.onclick = () => {
            state.entry = S.CATALOG.find(c => c.id === b.dataset.id);
            state.opt = {};
            state.seed = newSeed();
            renderCards(); renderPanel(); render();
            if (window.innerWidth < 900) $('panel').scrollIntoView({ behavior: 'smooth' });
        });
    }

    /* ---------- せってい ---------- */

    function renderPanel() {
        const e = state.entry, sheet = S.SHEETS[e.sheet];
        $('pIcon').textContent = e.icon;
        emojify($('pIcon'));
        $('pTitle').textContent = e.title;
        $('pDesc').textContent = noEmoji(e.desc);
        const opt = S.resolveOptions(e, state.opt);
        const form = $('opts');
        form.innerHTML = sheet.options.map(o => {
            if (o.type === 'select') return `<label class="field">${S.esc(o.label)}<select data-k="${o.key}">${o.choices.map(([k, lb]) =>
                `<option value="${S.esc(k)}"${String(opt[o.key]) === String(k) ? ' selected' : ''}>${S.esc(noEmoji(lb))}</option>`).join('')}</select></label>`;
            if (o.type === 'check') return `<label class="check"><input type="checkbox" data-k="${o.key}"${opt[o.key] ? ' checked' : ''}> ${S.esc(o.label)}</label>`;
            return `<label class="field">${S.esc(o.label)}<input type="text" maxlength="12" data-k="${o.key}" value="${S.esc(opt[o.key] || '')}" placeholder="${S.esc(o.placeholder || '')}"></label>`;
        }).join('') || '<p class="noopt">せっていは ありません。「べつの もんだい」で なかみが かわります。</p>';
        form.querySelectorAll('[data-k]').forEach(el => {
            const ev = el.type === 'text' ? 'input' : 'change';
            el.addEventListener(ev, () => {
                state.opt[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
                render();
            });
        });
        $('copies').value = String(state.copies);
        if (!$('copies').value) { $('copies').value = '1'; state.copies = 1; }
        $('withAnswer').checked = state.answer;
        const hasAnswer = !!S.buildSheet(e, state.opt, 1).answer;
        $('withAnswer').parentElement.hidden = !hasAnswer;
    }

    /* ---------- プレビュー ---------- */

    let timer = 0;
    function render() {
        clearTimeout(timer);
        timer = setTimeout(renderNow, 30);
    }

    function renderNow() {
        const qs = [], as = [];
        for (let i = 0; i < state.copies; i++) {
            const r = S.buildSheet(state.entry, state.opt, state.seed + i * 1013);
            qs.push(r.page);
            if (r.answer) as.push(r.answer);
        }
        /* こたえは さいごに まとめる（くばる ときに ぬきやすい） */
        const withAns = state.answer && as.length;
        $('pages').innerHTML = qs.join('') + (withAns ? as.join('') : '')
            + (!withAns && as.length ? `<div class="ans-peek no-print"><button type="button" class="btn btn-sub" id="peek"></button><div id="peekBox" hidden>${as[0]}</div></div>` : '');
        const peek = $('peek');
        const peekLabel = () => { peek.innerHTML = $('peekBox').hidden ? '<span class="ui-ic" data-ic="eye"></span> こたえを みる' : '<span class="ui-ic" data-ic="eyeOff"></span> こたえを かくす'; icons(peek); };
        if (peek) { peekLabel(); peek.onclick = () => { $('peekBox').hidden = !$('peekBox').hidden; peekLabel(); fit(); }; }
        emojify($('pages'));
        writeHash();
        fit();
    }

    /** A4（210mm ≒ 794px）を よこはばに あわせて ちぢめる */
    function fit() {
        const w = $('previewWrap').clientWidth - 24;
        const base = $('pages').querySelector('.page.land') ? 1140 : 800;
        const z = Math.min(1, w / base);
        $('pages').style.zoom = z;
    }

    /* ---------- ボタン ---------- */

    function toast(msg) {
        const t = $('toast');
        t.textContent = msg; t.hidden = false;
        clearTimeout(toast.t);
        toast.t = setTimeout(() => { t.hidden = true; }, 2200);
    }

    $('btnNew').onclick = () => { state.seed = newSeed(); render(); };
    $('copies').onchange = () => { state.copies = +$('copies').value || 1; render(); };
    $('withAnswer').onchange = () => { state.answer = $('withAnswer').checked; render(); };
    $('btnPrint').onclick = async () => {
        /* いんさつ の ときは ちぢめない。え（がぞう）が ぜんぶ よみこまれてから */
        $('pages').style.zoom = 1;
        await Promise.all([...$('pages').querySelectorAll('img')].map(im => im.complete ? 0 : im.decode().catch(() => 0)));
        window.print();
    };
    window.addEventListener('afterprint', fit);
    $('btnLink').onclick = async () => {
        writeHash();
        try { await navigator.clipboard.writeText(location.href); toast('URL を コピーしました'); }
        catch (e) { prompt('この URL を コピーして ください', location.href); }
    };
    window.addEventListener('resize', fit);

    emojify(document.querySelector('.top'));
    icons(document);
    readHash();
    renderSubjects();
    renderCards();
    renderPanel();
    render();
    /* フォントが よみこまれたら もういちど はかる */
    if (document.fonts) document.fonts.ready.then(fit);
    /* げんこうようしの プリント：句読点・小さい字を フォントに あわせて マスの 右上へ */
    function fitMarks() {
        const GK = window.PurintoGenkou;
        if (!GK) return;
        let el = document.getElementById('markCss');
        if (!el) { el = document.createElement('style'); el.id = 'markCss'; document.head.appendChild(el); }
        try { el.textContent = GK.G.markCss(getComputedStyle(document.documentElement).getPropertyValue('--page-font'), 600, .72); } catch (e) { /* むりなら CSS の ばしょの まま */ }
    }
    fitMarks();
    if (document.fonts && document.fonts.load) document.fonts.load('600 40px "Klee One"', 'あ。、っ').then(fitMarks, () => {});
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMarks);
})();
