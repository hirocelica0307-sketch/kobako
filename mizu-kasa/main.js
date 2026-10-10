/* かさ はかせ ── 画面の うごき（はじめの 画面・一問一答・おわりの 画面） */
(function () {
    'use strict';
    const K = window.KasaLogic, SC = window.KasaScene, IC = window.KasaIcons;
    const $ = id => document.getElementById(id);
    const EMOJI = SC.EMOJI;

    /* ---------- きろく（ブラウザに のこす。つかえない ときは のこさない） ---------- */
    const store = {
        get(k, d) {
            try { const v = localStorage.getItem('mizu-kasa:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
        },
        set(k, v) { try { localStorage.setItem('mizu-kasa:' + k, JSON.stringify(v)); } catch (e) { /* のこせなくても あそべる */ } },
    };
    const settings = Object.assign({ n: 10, useMl: true, sound: false }, store.get('settings', {}));

    /* ---------- おと（Web Audio で つくる。はじめは なし） ---------- */
    let actx = null;
    function audio() {
        if (!settings.sound) return null;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === 'suspended') actx.resume();
            return actx;
        } catch (e) { return null; }
    }
    function tones(list, type, vol) {
        const a = audio();
        if (!a) return;
        let t = a.currentTime;
        for (const [f, d] of list) {
            const o = a.createOscillator(), g = a.createGain();
            o.type = type || 'sine';
            o.frequency.value = f;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol || 0.15, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + d);
            o.connect(g).connect(a.destination);
            o.start(t); o.stop(t + d + 0.02);
            t += d * 0.8;
        }
    }
    function pourSound(ms) {
        const a = audio();
        if (!a) return;
        const sec = Math.max(0.15, ms / 1000);
        const buf = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 900));
        const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
        src.buffer = buf;
        bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
        const t = a.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.05);
        g.gain.setValueAtTime(0.12, t + sec - 0.08);
        g.gain.linearRampToValueAtTime(0, t + sec);
        src.connect(bp).connect(g).connect(a.destination);
        src.start(t);
    }
    SC.onSound((kind, ms) => { if (kind === 'pour') pourSound(ms); });
    const sfx = {
        good: () => tones([[784, 0.14], [1047, 0.28]], 'triangle', 0.16),
        bad: () => tones([[330, 0.18], [262, 0.26]], 'sine', 0.12),
        end: () => tones([[523, 0.14], [659, 0.14], [784, 0.14], [1047, 0.4]], 'triangle', 0.16),
    };

    /* ---------- ことばの 見た目（L・dL・mL に いろ） ---------- */
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const uhtml = s => esc(s).replace(/(\d)(mL|dL|L)/g, (m, n, u) => `${n}<span class="u${u}">${u}</span>`);

    function answerText(q) {
        if (q.ask === 'fields') return q.fields.map(f => f.v + f.u).join('');
        if (q.ask === 'choice') return (q.choices.find(c => c.id === q.answer) || {}).label;
        return q.targetLabel;
    }

    /* ==================== はじめの 画面 ==================== */
    function bestOf(modeId) { return store.get(`best:${modeId}:${settings.n}`, null); }

    function drawMenu() {
        const box = $('modes');
        box.innerHTML = '';
        for (const m of K.MODES) {
            const b = document.createElement('button');
            b.className = 'mode' + (m.id === 'mix' ? ' mix' : '');
            const best = bestOf(m.id);
            b.innerHTML = `<img src="${EMOJI(m.emoji)}" alt=""><span><b>${esc(m.name)}</b><small>${uhtml(m.sub)}</small>` +
                (best !== null ? `<span class="best">さいこう ほし ${best} / ${settings.n}</span>` : '') + '</span>';
            b.addEventListener('click', () => startGame(m.id));
            box.appendChild(b);
        }
        seg('setN', String(settings.n));
        seg('setMl', settings.useMl ? '1' : '0');
        seg('setSound', settings.sound ? '1' : '0');
    }
    function seg(id, v) {
        $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    }
    function bindSeg(id, fn) {
        $(id).addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            fn(b.dataset.v);
            store.set('settings', settings);
            drawMenu();
        });
    }
    bindSeg('setN', v => { settings.n = Number(v); });
    bindSeg('setMl', v => { settings.useMl = v === '1'; });
    bindSeg('setSound', v => { settings.sound = v === '1'; if (settings.sound) sfx.good(); });

    function screen(name) { document.body.dataset.scr = name; }

    /* ==================== あそぶ ==================== */
    let G = null;       /* 1かい分 */
    let C = null;       /* いまの 1もん */
    let ctl = null;     /* いまの 図 */

    const panel = document.querySelector('.panel');

    function startGame(modeId) {
        const qs = K.makeRound(modeId, settings.n, Math.random, { useMl: settings.useMl });
        G = { mode: modeId, queue: qs.map(q => ({ q, retry: false, result: null })), idx: 0, stars: 0, n: qs.length, miss: [], seenAsk: {} };
        $('modeName').textContent = K.modeById(modeId).name;
        $('starNum').textContent = '0';
        screen('game');
        showQuestion();
    }

    function drawDots() {
        const box = $('dots');
        box.innerHTML = '';
        G.queue.forEach((it, i) => {
            const d = document.createElement('span');
            d.className = 'dot' + (it.retry ? ' extra' : '') + (i === G.idx ? ' now' : '') +
                (it.result === 'ok' ? ' ok' : it.result === 'ng' ? ' ng' : '');
            box.appendChild(d);
        });
    }

    function say(html, mood) {
        $('bubble').innerHTML = html;
        const f = $('frog');
        f.classList.remove('jump', 'shake');
        if (mood) { void f.offsetWidth; f.classList.add(mood); }
        /* ひくい 画面では ことばが 下に かくれる ので 見える ところへ */
        if (html) $('bubble').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function setLocked(on) {
        C.locked = on;
        panel.querySelectorAll('.pad button, .choices button, .build button').forEach(b => {
            if (b.dataset.keep) return;
            b.disabled = on || (b.classList.contains('bad'));
        });
        $('hintBtn').disabled = on && C.q.ask !== 'build';
    }

    async function showQuestion() {
        const item = G.queue[G.idx];
        const q = item.q;
        const me = C = { q, item, tries: 0, vals: null, active: 0, done: false, locked: true, spec: q.scene };
        drawDots();
        panel.dataset.ask = q.ask;
        panel.classList.remove('done');
        $('qTag').hidden = !item.retry;
        $('qText').innerHTML = uhtml(q.text);
        $('qSub').innerHTML = q.sub ? uhtml(q.sub) : '';
        $('nextBtn').hidden = true;
        $('hintBtn').hidden = false;

        const ans = $('answer');
        ans.innerHTML = '';
        if (q.ask === 'fields') {
            C.vals = q.fields.map(() => '');
            q.fields.forEach((f, i) => {
                const b = document.createElement('button');
                b.className = 'field';
                b.dataset.i = i;
                b.setAttribute('aria-label', f.u + ' の 数');
                b.addEventListener('click', () => { if (!C.done) { C.active = i; drawFields(); } });
                ans.appendChild(b);
                const u = document.createElement('span');
                u.className = 'unit';
                u.innerHTML = f.u === 'はい分' ? 'はい分' : `<span class="u${f.u}">${f.u}</span>`;
                ans.appendChild(u);
            });
            drawFields();
        } else if (q.ask === 'choice') {
            const box = $('choices');
            box.innerHTML = '';
            q.choices.forEach(c => {
                const b = document.createElement('button');
                b.dataset.id = c.id;
                b.innerHTML = uhtml(c.label);
                if (c.label.length > 6) b.classList.add('small');
                b.addEventListener('click', () => submit(c.id));
                box.appendChild(b);
            });
        }

        /* はじめて の こたえかた の ときだけ つかいかたを いう */
        const first = !G.seenAsk[q.ask];
        G.seenAsk[q.ask] = true;
        say(!first ? '' :
            q.ask === 'fields' ? 'すうじを 入れて「こたえる」を おしてね。' :
            q.ask === 'choice' ? 'こたえを えらんでね。' :
            '1Lます・1dLます を おして 水を 入れよう。ぴったりに なったら「できた！」。');

        SC.setSpeed(1);
        ctl = SC.render($('stage'), q.scene);
        setLocked(true);
        await ctl.play();
        if (C !== me) return;
        setLocked(false);
    }

    function drawFields() {
        $('answer').querySelectorAll('.field').forEach((b, i) => {
            b.textContent = C.vals[i];
            b.classList.toggle('on', !C.done && i === C.active);
        });
    }

    function typeKey(k) {
        if (!C || C.done || C.locked || C.q.ask !== 'fields') return;
        const f = $('answer').querySelectorAll('.field')[C.active];
        if (k === 'del') {
            if (C.vals[C.active] === '' && C.active > 0) C.active--;
            C.vals[C.active] = C.vals[C.active].slice(0, -1);
            $('answer').querySelectorAll('.field')[C.active].classList.remove('bad');
        } else if (k === 'ok') {
            submit();
            return;
        } else {
            if (f.classList.contains('bad')) { C.vals[C.active] = ''; f.classList.remove('bad'); }
            if (C.vals[C.active].length >= 4) return;
            C.vals[C.active] = (C.vals[C.active] === '0' ? '' : C.vals[C.active]) + k;
            /* L は 1けた なので つぎの わくへ すすむ */
            if (C.q.fields[C.active].u === 'L' && C.active < C.q.fields.length - 1) C.active++;
        }
        drawFields();
    }

    async function submit(choiceId) {
        if (!C || C.done || C.locked) return;
        const q = C.q;
        let res;
        if (q.ask === 'fields') {
            const ans = C.vals.map(v => v === '' ? null : parseInt(v, 10));
            if (ans.some(v => v === null)) {
                C.active = ans.findIndex(v => v === null);
                drawFields();
                say('まだ 入って いない わくが あるよ。');
                return;
            }
            res = K.check(q, ans);
        } else if (q.ask === 'choice') {
            res = K.check(q, choiceId);
        } else {
            if (ctl.busy) return;
            res = K.check(q, ctl.total);
            if (res.empty) { say(res.msg); return; }
        }
        if (res.ok) await correct(); else await wrong(res, choiceId);
    }

    function markRetry() {
        /* はじめて まちがえた もんだいは、3もん あとに もういちど 出す */
        if (C.item.retry || C.item.queued) return;
        C.item.queued = true;
        G.miss.push(C.q);
        const at = Math.min(G.queue.length, G.idx + 3);
        G.queue.splice(at, 0, { q: C.q, retry: true, result: null });
    }

    async function correct() {
        const me = C;
        C.done = true;
        const first = C.tries === 0;
        C.item.result = first ? 'ok' : 'ng';
        if (first && !C.item.retry) {
            G.stars++;
            $('starNum').textContent = G.stars;
            const sb = document.querySelector('.starbox');
            sb.classList.remove('pop'); void sb.offsetWidth; sb.classList.add('pop');
        }
        markGood();
        panel.classList.add('done');
        sfx.good();
        say(`<b class="good">${esc(K.praise(Math.random))}</b><span class="ex">${uhtml(C.q.explain)}</span>`, 'jump');
        drawDots();
        $('hintBtn').hidden = true;
        await playAfter(me);
        if (C === me) showNext();
    }

    async function wrong(res, choiceId) {
        const me = C;
        C.tries++;
        C.item.result = 'ng';
        markRetry();
        drawDots();
        sfx.bad();
        if (C.q.ask === 'fields') {
            const fs = $('answer').querySelectorAll('.field');
            res.bad.forEach(i => fs[i].classList.add('bad'));
            C.active = res.bad[0] || 0;
            drawFields();
        } else if (C.q.ask === 'choice') {
            const b = $('choices').querySelector(`[data-id="${choiceId}"]`);
            if (b) { b.classList.add('bad'); b.disabled = true; }
        }
        const limit = C.q.ask === 'build' ? 3 : 2;
        if (C.tries >= limit) { await reveal(res.msg); return; }
        say(`<b class="bad">${uhtml(res.msg)}</b>` + (C.tries === 1 && C.q.hint && C.q.hint !== res.msg ? `<span class="ex">${uhtml(C.q.hint)}</span>` : ''), 'shake');
        if (C === me && C.q.ask === 'fields') drawFields();
    }

    function markGood() {
        if (C.q.ask === 'fields') {
            C.vals = C.q.fields.map(f => String(f.v));
            drawFields();
            $('answer').querySelectorAll('.field').forEach(b => { b.classList.remove('bad'); b.classList.add('good'); });
        } else if (C.q.ask === 'choice') {
            $('choices').querySelectorAll('button').forEach(b => {
                if (b.dataset.id === C.q.answer) b.classList.add('good');
                b.disabled = true;
            });
        }
    }

    async function reveal(msg) {
        const me = C;
        C.done = true;
        markGood();
        panel.classList.add('done');
        $('hintBtn').hidden = true;
        say(`<b class="bad">${uhtml(msg)}</b><br>こたえは <span class="ans">${uhtml(answerText(C.q))}</span>` +
            `<span class="ex">${uhtml(C.q.explain)}</span>`, 'shake');
        if (C.q.ask === 'build') {
            setLocked(true);
            await ctl.show(C.q.target);
        } else {
            await playAfter(me, true);
        }
        if (C === me) showNext();
    }

    /** こたえた あとの 図（ない ときは、まちがえた ときだけ もういちど そそぐ） */
    async function playAfter(me, replay) {
        const q = me.q;
        if (q.after) {
            me.spec = q.after;
            ctl = SC.render($('stage'), q.after);
            await ctl.play();
        } else if (replay && q.ask !== 'build') {
            ctl = SC.render($('stage'), q.scene);
            await ctl.play();
        }
    }

    function showNext() {
        const b = $('nextBtn');
        b.hidden = false;
        b.focus({ preventScroll: true });
    }

    function next() {
        if (!C || !C.done) return;
        G.idx++;
        if (G.idx >= G.queue.length) finish();
        else showQuestion();
    }

    function hint() {
        if (!C || C.done) return;
        say(`<b>ヒント</b><span class="ex">${uhtml(C.q.hint)}</span>`);
    }

    /* ==================== おわり ==================== */
    function finish() {
        C = null;
        SC.clear($('stage'));
        screen('result');
        sfx.end();
        const n = G.n;
        const box = $('resStars');
        box.innerHTML = '';
        for (let i = 0; i < n; i++) {
            const img = document.createElement('img');
            img.src = EMOJI('star');
            img.alt = '';
            if (i >= G.stars) img.className = 'off';
            img.style.animationDelay = (i * 0.07) + 's';
            box.appendChild(img);
        }
        $('resScore').textContent = `ほし ${G.stars} / ${n}`;
        $('resWord').textContent = K.resultWord(G.stars, n);
        const key = `best:${G.mode}:${settings.n}`;
        const best = store.get(key, null);
        if (best === null || G.stars > best) {
            store.set(key, G.stars);
            $('resBest').textContent = best === null ? '' : `さいこう きろく こうしん！（まえは ${best}）`;
        } else {
            $('resBest').textContent = `さいこう きろく：ほし ${best}`;
        }
        const miss = $('resMiss');
        if (G.miss.length) {
            miss.innerHTML = '<h3>まちがえた もんだい（見なおそう）</h3><ul></ul>';
            const ul = miss.querySelector('ul');
            for (const q of G.miss) {
                const li = document.createElement('li');
                li.innerHTML = `${uhtml(q.text)}${q.sub ? '　' + uhtml(q.sub) : ''} → <b>${uhtml(answerText(q))}</b>`;
                ul.appendChild(li);
            }
        } else miss.innerHTML = '';
    }

    /* ==================== たんいの ひょう ==================== */
    function openTable() {
        const fig = $('tableFig');
        fig.innerHTML = '';
        const a = document.createElement('div');
        a.className = 'tf';
        const mL = SC.makeMasu('L', 0.9);
        mL.set(1000);
        a.appendChild(mL.svg);
        a.insertAdjacentHTML('beforeend', '1Lます');
        const eq = document.createElement('div');
        eq.className = 'lrow';
        eq.innerHTML = '<span class="eq">＝</span>';
        const b = document.createElement('div');
        b.className = 'tf';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,auto);gap:4px';
        for (let i = 0; i < 10; i++) { const m = SC.makeMasu('dL', 0.9); m.set(100); grid.appendChild(m.svg); }
        b.appendChild(grid);
        b.insertAdjacentHTML('beforeend', '1dLます 10ぱい');
        fig.append(a, eq, b);
        $('table').hidden = false;
    }

    /* ==================== ボタン・キー ==================== */
    $('pad').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (b) typeKey(b.dataset.k);
    });
    $('build').addEventListener('click', async e => {
        const b = e.target.closest('button');
        if (!b || !C || C.done || C.locked || C.q.ask !== 'build') return;
        const v = b.dataset.b;
        if (v === 'ok') { submit(); return; }
        if (v === 'reset') { await ctl.reset(); return; }
        const ml = Number(v);
        if (!ctl.canAdd(ml)) { say('これいじょう 入れると あふれちゃう！「やりなおし」を おしてね。'); return; }
        await ctl.add(ml);
    });
    $('hintBtn').addEventListener('click', hint);
    $('nextBtn').addEventListener('click', next);
    $('homeBtn').addEventListener('click', () => {
        if (G && C && !window.confirm('とちゅうで やめて、はじめの 画面に もどる？')) return;
        C = null;
        SC.clear($('stage'));
        drawMenu();
        screen('menu');
    });
    $('againBtn').addEventListener('click', () => startGame(G.mode));
    $('menuBtn').addEventListener('click', () => { drawMenu(); screen('menu'); });
    $('tableBtn').addEventListener('click', openTable);
    $('tableClose').addEventListener('click', () => { $('table').hidden = true; });
    $('table').addEventListener('click', e => { if (e.target.id === 'table') $('table').hidden = true; });
    $('stage').addEventListener('pointerdown', () => { if ($('stage').classList.contains('busy')) SC.setSpeed(4); });

    document.addEventListener('keydown', e => {
        if (document.body.dataset.scr !== 'game' || !C) return;
        if (C.done) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
            return;
        }
        if (C.q.ask === 'fields') {
            if (/^[0-9]$/.test(e.key)) typeKey(e.key);
            else if (e.key === 'Backspace') { e.preventDefault(); typeKey('del'); }
            else if (e.key === 'Enter') { e.preventDefault(); typeKey('ok'); }
            else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                e.preventDefault();
                C.active = (C.active + 1) % C.q.fields.length;
                drawFields();
            } else if (e.key === 'ArrowLeft') {
                C.active = (C.active + C.q.fields.length - 1) % C.q.fields.length;
                drawFields();
            }
        }
    });

    /* 画面の 大きさが かわったら 図を かきなおす（つくる の とちゅうは そのまま） */
    let rt = 0;
    window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
            if (!C || !C.spec || C.q.ask === 'build' || $('stage').classList.contains('busy')) return;
            ctl = SC.render($('stage'), C.spec, { instant: true });
        }, 200);
    });

    /* たしかめ用（tests や 自動の うごかしで つかう） */
    window.KasaApp = { state: () => ({ G, C, ctl }) };

    IC.fill(document);
    drawMenu();
})();
