/* くじびき ひろば ── 画面の きりかえ・せっていの 保存・けっかの 表示など、どの くじでも つかう もの */
(function (root) {
    'use strict';

    const $ = (s, el) => (el || document).querySelector(s);
    const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
    const FX = root.KujiFX, S = root.KujiSound;
    const KEY = 'kujibiki.v1.';

    /* ---------- 保存（この 端末の ブラウザ だけ。どこにも おくらない） ---------- */
    function load(name, def) {
        try {
            const v = root.localStorage.getItem(KEY + name);
            if (v == null) return def;
            const o = JSON.parse(v);
            return (def && typeof def === 'object' && !Array.isArray(def)) ? Object.assign({}, def, o) : o;
        } catch (e) { return def; }
    }
    function save(name, val) {
        try { root.localStorage.setItem(KEY + name, JSON.stringify(val)); } catch (e) { /* 保存 できなくても 動く */ }
    }

    /* ---------- 絵（Fluent Emoji 3D） ---------- */
    const imgCache = {};
    function img(name) {
        if (!imgCache[name]) {
            const im = new Image();
            im.decoding = 'async';
            im.src = 'assets/emoji/' + name + '.webp';
            imgCache[name] = im;
        }
        return imgCache[name];
    }
    const imgSrc = name => 'assets/emoji/' + name + '.webp';

    /** ながい ことばを n 文字で きる */
    function short(s, n) {
        const a = Array.from(String(s));
        return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('');
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* ---------- 画面の きりかえ（#roulette など） ---------- */
    const modes = {};
    let current = 'menu';
    function register(name, mod) { modes[name] = mod; }

    function go(name) {
        if (!modes[name] && name !== 'menu') name = 'menu';
        if (name === current && document.body.dataset.mode === name) return;
        const prev = modes[current];
        if (prev && prev.leave) prev.leave();
        closeResult(true);
        closeSheets();
        FX.clear();
        setBusy(false);
        current = name;
        document.body.dataset.mode = name;
        $$('.scr').forEach(s => { s.hidden = s.dataset.scr !== name; });
        const m = modes[name];
        $('#barTitle span').textContent = m ? m.title : 'くじびき ひろば';
        $('#barTitle img').src = imgSrc(m ? m.emoji : 'admission-tickets');
        if (m) {
            const sec = $('[data-scr="' + name + '"]');
            if (!m._inited) { m._inited = true; m.init(sec); }
            if (m.enter) m.enter();
        }
    }

    /* うごいて いる あいだは 中身を かえられない */
    let busy = false;
    function setBusy(v) {
        busy = !!v;
        document.body.classList.toggle('busy', busy);
        const b = $('#btnEdit');
        if (b) b.disabled = busy;
    }

    /* ---------- 中身・せっていの シート ---------- */
    function openSheet() {
        const m = modes[current];
        if (!m || busy) return;
        const sh = $('[data-scr="' + current + '"] .sheet-wrap');
        if (!sh) return;
        if (m.onSheetOpen) m.onSheetOpen();
        sh.hidden = false;
        requestAnimationFrame(() => sh.classList.add('open'));
    }
    function closeSheets() {
        $$('.sheet-wrap').forEach(sh => {
            if (sh.hidden) return;
            sh.classList.remove('open');
            sh.hidden = true;
            const m = modes[sh.closest('.scr').dataset.scr];
            if (m && m.onSheetClose) m.onSheetClose();
        });
    }

    /* ---------- リストの 入力（1行 1こ ＋ 番号で つくる） ----------
       <div class="listed"><textarea></textarea><div class="gen">…</div><span class="count"></span></div> */
    function listEditor(el, opts) {
        const ta = $('textarea', el);
        const cnt = $('.count', el);
        const upd = () => {
            const n = root.KujiLogic.parseList(ta.value).length;
            if (cnt) cnt.textContent = n + (opts && opts.unit || 'こ');
            if (opts && opts.onChange) opts.onChange(ta.value);
        };
        ta.addEventListener('input', upd);
        const gen = $('[data-gen]', el);
        if (gen) gen.addEventListener('click', () => {
            const a = $('[data-from]', el).value, b = $('[data-to]', el).value;
            const list = root.KujiLogic.numberList(a, b, 1, (opts && opts.max) || 300);
            if (!list.length) return;
            ta.value = list.map(v => v + ((opts && opts.suffix) ? $('[data-suffix]', el).value : '')).join('\n');
            upd();
        });
        const clr = $('[data-clear]', el);
        if (clr) clr.addEventListener('click', () => { ta.value = ''; upd(); ta.focus(); });
        return {
            get: () => ta.value,
            set: v => { ta.value = v; upd(); },
            list: () => root.KujiLogic.parseList(ta.value),
        };
    }

    /* ---------- けっかの 表示 ----------
       level: 'super'（大あたり）| 'win'（あたり）| 'normal' | 'lose'（はずれ） */
    let resultBtns = null, resultClose = null;
    function showResult(o) {
        const box = $('#result');
        const lv = o.level || 'normal';
        box.className = 'lv-' + lv;
        $('.res-img', box).src = imgSrc(o.img || (lv === 'lose' ? 'ghost' : lv === 'super' ? 'trophy' : 'party-popper'));
        $('.res-sub', box).textContent = o.sub || '';
        const t = $('.res-title', box);
        t.textContent = o.title || '';
        const len = Array.from(o.title || '').length;
        t.style.setProperty('--len', Math.max(1, len));
        $('.res-note', box).textContent = o.note || '';
        const bw = $('.res-btns', box);
        bw.innerHTML = '';
        resultBtns = o.buttons || [{ label: 'OK', primary: true }];
        resultBtns.forEach((b, i) => {
            const el = document.createElement('button');
            el.className = 'btn big' + (b.primary ? ' primary' : ' ghost') + (b.cls ? ' ' + b.cls : '');
            el.innerHTML = (b.ic ? '<span class="ic" data-ic="' + b.ic + '"></span>' : '') + '<span>' + esc(b.label) + '</span>';
            el.addEventListener('click', () => { closeResult(); if (b.act) b.act(); });
            bw.appendChild(el);
            if (i === resultBtns.length - 1) setTimeout(() => el.focus({ preventScroll: true }), 50);
        });
        root.KujiIcons.fill(bw);
        resultClose = o.onClose || null;
        box.hidden = false;
        void box.offsetWidth;
        box.classList.add('show');
        if (!o.quiet) celebrate(lv);
    }
    function closeResult(silent) {
        const box = $('#result');
        if (!box || box.hidden) return;
        box.hidden = true;
        box.classList.remove('show');
        const f = resultClose;
        resultClose = null;
        if (!silent && f) f();
    }
    /* 演出の つよさ */
    function celebrate(lv) {
        const { w, h } = FX.size();
        if (lv === 'super') {
            S.play('crash'); S.play('fanfare', true);
            FX.flash('#fff6c0', 700); FX.shake(14, 600);
            FX.confettiBurst(w * 0.1, h, 140, 1.2); FX.confettiBurst(w * 0.9, h, 140, 1.2);
            FX.confetti(220); FX.fireworks(9, 2600);
        } else if (lv === 'win') {
            S.play('crash'); S.play('fanfare', false);
            FX.flash('#ffffff', 450);
            FX.confettiBurst(w * 0.15, h, 90); FX.confettiBurst(w * 0.85, h, 90);
            FX.confetti(120); FX.fireworks(3, 1200);
        } else if (lv === 'lose') {
            S.play('lose');
        } else {
            S.play('ding'); S.play('sparkle');
            FX.stars(w / 2, h * 0.45, 40, Math.min(w, h) * 0.35);
            FX.confetti(50);
        }
    }

    /* ---------- たしかめ（はい／いいえ） ---------- */
    function confirmBox(msg, okLabel) {
        return new Promise(res => {
            const box = $('#confirm');
            $('.cf-msg', box).textContent = msg;
            $('.cf-ok', box).textContent = okLabel || 'はい';
            box.hidden = false;
            const done = v => { box.hidden = true; box.onclick = null; res(v); };
            box.onclick = e => {
                if (e.target.closest('.cf-ok')) done(true);
                else if (e.target.closest('.cf-no') || e.target === box) done(false);
            };
        });
    }

    /* ---------- 画面の スリープを ふせぐ（テレビに うつす とき） ---------- */
    let wake = null;
    async function keepAwake() {
        try {
            if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') {
                wake = await navigator.wakeLock.request('screen');
                wake.addEventListener('release', () => { wake = null; });
            }
        } catch (e) { wake = null; }
    }

    /* ---------- はじまり ---------- */
    function start() {
        root.KujiIcons.fill(document);
        // 音：ひらく たびに「あり」から はじめる（まえに けした ままで 音が 出ない ことが ない ように）
        S.setOn(true);
        const sb = $('#btnSound');
        const showSnd = () => {
            sb.innerHTML = '<span class="ic" data-ic="' + (S.isOn() ? 'speaker-high' : 'speaker-slash') + '"></span>';
            sb.setAttribute('aria-label', S.isOn() ? 'おと：あり' : 'おと：なし');
            sb.classList.toggle('off', !S.isOn());
            root.KujiIcons.fill(sb);
        };
        showSnd();
        sb.addEventListener('click', () => { S.setOn(!S.isOn()); showSnd(); });
        // 大きく 表示
        const fb = $('#btnFull');
        const showFull = () => {
            const f = !!document.fullscreenElement;
            fb.innerHTML = '<span class="ic" data-ic="' + (f ? 'corners-in' : 'corners-out') + '"></span>';
            root.KujiIcons.fill(fb);
        };
        if (!document.documentElement.requestFullscreen) fb.hidden = true;
        fb.addEventListener('click', () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen().catch(() => {});
        });
        document.addEventListener('fullscreenchange', showFull);
        showFull();

        $('#btnHome').addEventListener('click', () => go('menu'));
        $('#btnEdit').addEventListener('click', openSheet);
        $$('.sheet-wrap').forEach(sh => {
            sh.addEventListener('click', e => {
                if (e.target === sh || e.target.closest('[data-close]')) closeSheets();
            });
        });
        $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { if (!$('#result').hidden) closeResult(); else closeSheets(); }
        });
        // さわる たびに 音を つかえる ように（くわしくは sound.js の はじめ）。
        // capture で よぶので、ボタンの 処理より さきに 音が 再開する
        const unlock = () => { S.unlock(); keepAwake(); };
        ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev =>
            document.addEventListener(ev, unlock, { capture: true, passive: true }));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') { keepAwake(); if (S.state() !== 'none') S.unlock(); }
        });

        // ひらく たびに かならず メニュー（トップページ）から。
        // まえの URL に #roulette などが のこって いても つかわない
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
        go('menu');
        // 「もどる」で ページに もどって きた とき（ブラウザが まえの 画面を おぼえて いる とき）も メニューへ
        root.addEventListener('pageshow', e => { if (e.persisted) go('menu'); });
        // フォントが そろったら canvas を かきなおす
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
            const m = modes[current];
            if (m && m.redraw) m.redraw();
        });
    }

    root.Kuji = {
        $, $$, load, save, img, imgSrc, esc, short, register, go, setBusy, isBusy: () => busy,
        listEditor, showResult, closeResult, celebrate, confirm: confirmBox, closeSheets,
        current: () => current, start,
    };
})(window);
