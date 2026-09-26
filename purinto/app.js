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
            `<button type="button" class="subj subj-${k}${state.subject === k ? ' on' : ''}" data-s="${k}">${ic} ${S.esc(lb)}</button>`).join('');
        nav.querySelectorAll('button').forEach(b => b.onclick = () => { state.subject = b.dataset.s; renderSubjects(); renderCards(); });
    }

    function renderCards() {
        const box = $('cards');
        const list = S.CATALOG.filter(c => state.subject === 'all' || c.subject === state.subject);
        box.innerHTML = list.map(c => `<button type="button" class="card subj-${c.subject}${c.id === state.entry.id ? ' on' : ''}" data-id="${c.id}">
            <span class="c-icon">${c.icon}</span><span class="c-text"><b>${S.esc(c.title)}</b><small>${S.SUBJECTS[c.subject].icon} ${S.esc(S.SUBJECTS[c.subject].label)}</small><span>${S.esc(c.desc)}</span></span></button>`).join('');
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
        $('pTitle').textContent = e.title;
        $('pDesc').textContent = e.desc;
        const opt = S.resolveOptions(e, state.opt);
        const form = $('opts');
        form.innerHTML = sheet.options.map(o => {
            if (o.type === 'select') return `<label class="field">${S.esc(o.label)}<select data-k="${o.key}">${o.choices.map(([k, lb]) =>
                `<option value="${S.esc(k)}"${String(opt[o.key]) === String(k) ? ' selected' : ''}>${S.esc(lb)}</option>`).join('')}</select></label>`;
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
            + (!withAns && as.length ? `<div class="ans-peek no-print"><button type="button" class="btn btn-sub" id="peek">👀 こたえを みる</button><div id="peekBox" hidden>${as[0]}</div></div>` : '');
        const peek = $('peek');
        if (peek) peek.onclick = () => { $('peekBox').hidden = !$('peekBox').hidden; peek.textContent = $('peekBox').hidden ? '👀 こたえを みる' : '🙈 こたえを かくす'; fit(); };
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
    $('btnPrint').onclick = () => {
        /* いんさつ の ときは ちぢめない */
        $('pages').style.zoom = 1;
        window.print();
    };
    window.addEventListener('afterprint', fit);
    $('btnLink').onclick = async () => {
        writeHash();
        try { await navigator.clipboard.writeText(location.href); toast('URL を コピーしました'); }
        catch (e) { prompt('この URL を コピーして ください', location.href); }
    };
    window.addEventListener('resize', fit);

    readHash();
    renderSubjects();
    renderCards();
    renderPanel();
    render();
    /* フォントが よみこまれたら もういちど はかる */
    if (document.fonts) document.fonts.ready.then(fit);
})();
