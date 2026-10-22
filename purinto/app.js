/* プリント＆カード こうぼう ── 画面（さがす・えらぶ・せってい・プレビュー・いんさつ）
   ------------------------------------------------------------------
   # が なければ「さがす」画面、#p=… なら その プリントの 画面。
   じょうたいは URL の # に のせる：
     #p=storymaze&seed=1234&n=1&ans=0&o.story=kuma
   おなじ URL を ひらけば、おなじ プリントが でる。
   ------------------------------------------------------------------ */
(function () {
    'use strict';
    const S = window.PurintoSheets;
    const $ = id => document.getElementById(id);

    const F = window.PurintoFinder;
    const ITEMS = F.build(S.CATALOG);
    const icons = el => { if (window.PurintoIcons) window.PurintoIcons.fill(el); };
    const emojify = el => { if (window.PurintoEmoji) window.PurintoEmoji.inDom(el); };
    const noEmoji = s => window.PurintoEmoji ? window.PurintoEmoji.strip(s) : s;

    const state = { entry: S.CATALOG[0], opt: {}, seed: newSeed(), copies: 1, answer: false, showAnswer: true };
    /* さがす 画面の しぼりこみ（ことば いがいは この たんまつに おぼえる） */
    const find = { q: '', purpose: '', subject: '', grade: '', month: '' };
    const NOW_MONTH = new Date().getMonth() + 1;

    function newSeed() { return 1 + Math.floor(Math.random() * 999999); }

    /* ---------- URL ---------- */

    /** # に プリントが あれば よみこんで true */
    function readHash() {
        const h = new URLSearchParams(location.hash.slice(1));
        const e = S.CATALOG.find(c => c.id === h.get('p'));
        if (!e) return false;
        state.entry = e;
        state.seed = Math.max(1, parseInt(h.get('seed'), 10) || newSeed());
        state.copies = Math.min(40, Math.max(1, parseInt(h.get('n'), 10) || 1));
        state.answer = h.get('ans') === '1';
        state.opt = {};
        for (const [k, v] of h) if (k.startsWith('o.')) state.opt[k.slice(2)] = v;
        return true;
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

    /* ---------- さがす 画面 ---------- */

    function loadFind() {
        try { Object.assign(find, JSON.parse(localStorage.getItem('purinto-find') || '{}'), { q: '' }); } catch (e) { /* なくても うごく */ }
    }
    function saveFind() {
        try { localStorage.setItem('purinto-find', JSON.stringify({ purpose: find.purpose, subject: find.subject, grade: find.grade, month: find.month })); } catch (e) { /* なくても うごく */ }
    }

    const chip = (group, k, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-g="${group}" data-k="${S.esc(k)}" aria-pressed="${on}">${label}</button>`;

    function renderFilters() {
        $('purposes').innerHTML = [{ k: '', icon: '✨', label: 'ぜんぶ', sub: `${ITEMS.length}しゅるい から さがす` }, ...F.PURPOSES].map(p => {
            const n = p.k ? ITEMS.filter(it => it.purpose === p.k).length : 0;
            return `<button type="button" class="purpose${find.purpose === p.k ? ' on' : ''}" data-g="purpose" data-k="${p.k}" aria-pressed="${find.purpose === p.k}">
                <span class="pu-ic">${p.icon}</span><span class="pu-t"><b>${S.esc(p.label)}</b><small>${S.esc(p.sub)}${n ? `（${n}）` : ''}</small></span></button>`;
        }).join('');
        $('fSubj').innerHTML = chip('subject', '', 'ぜんぶ', !find.subject) + F.SUBJECTS.map(x => chip('subject', x.k, S.esc(x.label), find.subject === x.k)).join('');
        $('fGrade').innerHTML = chip('grade', '', 'ぜんぶ', !find.grade) + F.GRADES.map(x => chip('grade', x.k, x.label, find.grade === x.k)).join('');
        const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
        $('fMonth').innerHTML = chip('month', '', 'いつでも', !find.month) + chip('month', String(NOW_MONTH), `今月（${NOW_MONTH}月）`, find.month === String(NOW_MONTH))
            + `<select class="chip-sel${find.month && find.month !== String(NOW_MONTH) ? ' on' : ''}" id="fMonthSel" aria-label="月を えらぶ"><option value="">月を えらぶ…</option>${months.map(m => `<option value="${m}"${find.month === String(m) && m !== NOW_MONTH ? ' selected' : ''}>${m}月</option>`).join('')}</select>`;
        emojify($('purposes'));
    }

    function tile(it) {
        const p = F.purposeOf(it.purpose);
        const gr = it.grades.length === 3 ? '<span class="tg tg-all">1〜6年</span>' : it.grades.map(g => `<span class="tg tg-${g}">${F.GRADES.find(x => x.k === g).label}</span>`).join('');
        return `<a class="ftile${it.kind === 'meate' ? ' is-card' : ''}" href="${it.href}" data-id="${S.esc(it.id)}">
            <span class="t-ic">${it.icon}</span>
            <span class="t-body"><b>${S.esc(noEmoji(it.title))}</b><span class="t-desc">${S.esc(noEmoji(it.desc))}</span>
            <span class="t-tags">${it.kind === 'meate' ? '<span class="tg tg-card">めあてカード</span>' : ''}${gr}${it.subjects.map(k => `<span class="tg tg-s">${S.esc(F.subjLabel(k))}</span>`).join('')}</span></span></a>`;
    }

    function renderResults() {
        const list = F.filter(ITEMS, find);
        const narrowed = find.q || find.subject || find.grade || find.month;
        let html = '';
        if (!narrowed && !find.purpose) {
            const rec = F.forMonth(ITEMS, NOW_MONTH);
            if (rec.length) html += `<section class="rsec rec"><h2>🌟 ${NOW_MONTH}月の おすすめ</h2><div class="ftiles">${rec.map(tile).join('')}</div></section>`;
        }
        if (narrowed) html += `<p class="rcount">${list.length ? `${list.length}こ みつかりました` : 'みつかりませんでした。ことばを かえるか、しぼりこみを「ぜんぶ」に もどして ください。'}</p>`;
        for (const p of F.PURPOSES) {
            const its = list.filter(it => it.purpose === p.k);
            if (its.length) html += `<section class="rsec"><h2>${p.icon} ${S.esc(p.label)} <small>${S.esc(p.sub)}</small></h2><div class="ftiles">${its.map(tile).join('')}</div></section>`;
        }
        $('results').innerHTML = html;
        emojify($('results'));
    }

    function initHome() {
        loadFind();
        $('q').addEventListener('input', () => { find.q = $('q').value; renderResults(); });
        $('home').addEventListener('click', e => {
            const b = e.target.closest('button[data-g]');
            if (!b) return;
            const g = b.dataset.g;
            find[g] = g === 'purpose' && find.purpose === b.dataset.k ? '' : b.dataset.k;
            saveFind(); renderFilters(); renderResults();
        });
        $('home').addEventListener('change', e => {
            if (e.target.id !== 'fMonthSel') return;
            find.month = e.target.value;
            saveFind(); renderFilters(); renderResults();
        });
    }

    /* ---------- プリントの 画面の ひだり（おなじ 目的の なかま） ---------- */

    function renderCards() {
        const cur = F.itemOfSheet(ITEMS, state.entry.id);
        const p = F.purposeOf(cur ? cur.purpose : 'asobu');
        $('sideHead').innerHTML = `${p.icon} ${S.esc(p.label)}`;
        const box = $('cards');
        box.innerHTML = ITEMS.filter(it => it.purpose === p.k).map(it => it.kind === 'meate'
            ? `<a class="card card-link" href="${it.href}"><span class="c-icon">${it.icon}</span><span class="c-text"><b>${S.esc(it.title)}</b><small>めあてカード</small></span></a>`
            : `<button type="button" class="card subj-${S.CATALOG.find(c => c.id === it.id).subject}${it === cur ? ' on' : ''}" data-id="${it.id}">
            <span class="c-icon">${it.icon}</span><span class="c-text"><b>${S.esc(noEmoji(it.title))}</b><small>${it.subjects.map(F.subjLabel).join('・')}</small></span></button>`).join('');
        emojify($('sideHead')); emojify(box);
        box.querySelectorAll('button.card').forEach(b => b.onclick = () => {
            state.entry = S.CATALOG.find(c => c.id === b.dataset.id);
            state.opt = {};
            state.seed = newSeed();
            renderCards(); renderPanel(); render();
            if (window.innerWidth < 900) $('panel').scrollIntoView({ behavior: 'smooth' });
        });
    }

    /* ---------- がめんの きりかえ ---------- */

    function route() {
        const edit = readHash();
        $('home').hidden = edit;
        $('editor').hidden = !edit;
        $('toHome').hidden = !edit;
        if (edit) {
            renderCards(); renderPanel(); render();
        } else {
            $('q').value = find.q;
            renderFilters(); renderResults();
        }
        window.scrollTo(0, 0);
    }
    const goHome = e => { e.preventDefault(); location.hash = ''; };
    ['back', 'toHome', 'logoLink'].forEach(id => $(id).addEventListener('click', goHome));

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
        }).join('') || `<p class="noopt">せっていは ありません。${sheet.fixed ? '' : '「べつの もんだい」で なかみが かわります。'}</p>`;
        /* なかみが きまって いる プリントは「べつの もんだい」を かくす */
        $('btnNew').hidden = !!sheet.fixed;
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
        if ($('editor').hidden) return;
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
    initHome();
    route();
    window.addEventListener('hashchange', route);
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
