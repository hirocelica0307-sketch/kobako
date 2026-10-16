/* くじびき ひろば ── ⑦ 発表の じゅんばん きめ
   スロットの ように 名前が くるくる かわって、だんだん ゆっくりに なり、1人 とまる。
   とまる 人は さきに KujiLogic.pickIndex で きめる。 */
(function (root) {
    'use strict';
    const { $, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const DEF = { names: L.numberList(1, 30).map(v => v + 'ばん').join('\n'), done: [], dur: 'normal' };
    const DUR = { short: 1500, normal: 3000, long: 5000 };

    let sec, st, ed, reel = null, raf = 0, fast = false;

    function init(el) {
        sec = el;
        st = load('order', DEF);
        ed = root.Kuji.listEditor($('.listed', sec), { max: 60, unit: '人', suffix: true });
        $('[data-act="next"]', sec).addEventListener('click', () => next(false));
        $('[data-act="all"]', sec).addEventListener('click', all);
        $('[data-act="reset"]', sec).addEventListener('click', async () => {
            if (reel) return;
            if (st.done.length && !(await root.Kuji.confirm('じゅんばんを けして、さいしょから に しますか？', 'さいしょから'))) return;
            st.done = []; persist(); render();
        });
        $('.od-reel', sec).addEventListener('click', () => next(false));
    }
    function enter() { render(); }
    function leave() { stop(); }
    function persist() { save('order', st); }
    const names = () => L.parseList(st.names).slice(0, 60);
    const left = () => { const d = st.done.slice(); return names().filter(n => { const k = d.indexOf(n); if (k >= 0) { d.splice(k, 1); return false; } return true; }); };

    function onSheetOpen() {
        ed.set(st.names);
        root.Kuji.$$('[name="odDur"]', sec).forEach(r => { r.checked = r.value === st.dur; });
    }
    function onSheetClose() {
        const nm = ed.get();
        if (nm !== st.names) st.done = [];
        st.names = nm;
        st.dur = (root.Kuji.$('[name="odDur"]:checked', sec) || {}).value || 'normal';
        persist(); render();
    }

    function render(lastFresh) {
        const lf = left();
        $('.od-list', sec).innerHTML = st.done.map((nm, i) =>
            `<li class="${lastFresh && i === st.done.length - 1 ? 'fresh' : ''}"><b>${i + 1}</b><span>${esc(nm)}</span></li>`).join('')
            + lf.map((nm, i) => `<li class="wait"><b>${st.done.length + i + 1}</b><span>？</span></li>`).join('');
        $('.od-left', sec).textContent = `のこり ${lf.length}人 ／ ${names().length}人`;
        $('[data-act="next"]', sec).disabled = !lf.length;
        $('[data-act="all"]', sec).disabled = !lf.length;
        if (!reel) {
            const rank = $('.od-rank', sec), nm = $('.od-name', sec);
            if (!lf.length) { rank.textContent = 'ぜんいん きまりました！'; nm.textContent = st.done.length ? st.done[st.done.length - 1] : ''; }
            else if (!st.done.length) { rank.textContent = '1ばん め は …'; nm.textContent = 'だれかな？'; }
            else { rank.textContent = st.done.length + 'ばん め'; nm.textContent = st.done[st.done.length - 1]; }
        }
        const fresh = $('.od-list li.fresh', sec);
        if (fresh) fresh.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /* 1人 きめる。quick なら みじかく */
    function next(quick, after) {
        if (reel) { fast = true; return; }   // まわって いる ときに おすと はやく とまる
        const lf = left();
        if (!lf.length) return;
        S.unlock();
        const pick = lf[L.pickIndex(lf.length)];
        if (lf.length === 1) { decide(pick, quick, after); return; }
        const dur = quick ? 450 : (DUR[st.dur] || DUR.normal);
        // とまる まで に 出す 名前の ならび（さいごが pick）
        const seq = [];
        let tt = 0, gap = 45;
        while (tt < dur) {
            const u = tt / dur;
            gap = 45 + Math.pow(u, 3) * 420;
            seq.push({ t: tt, v: lf[Math.floor(Math.random() * lf.length)] });
            tt += gap;
        }
        // おなじ 名前が つづかない ように して、さいごを pick に
        for (let i = 1; i < seq.length; i++) if (seq[i].v === seq[i - 1].v && lf.length > 1) seq[i].v = lf[(lf.indexOf(seq[i].v) + 1) % lf.length];
        seq[seq.length - 1].v = pick;
        if (seq.length > 1 && seq[seq.length - 2].v === pick) seq[seq.length - 2].v = lf.find(x => x !== pick);
        reel = { seq, i: -1, t0: performance.now(), pick, quick, after, stopDrum: quick ? () => {} : S.startDrumroll() };
        fast = false;
        root.Kuji.setBusy(true);
        sec.classList.add('rolling');
        $('.od-rank', sec).textContent = (st.done.length + 1) + 'ばん め は …';
        const step = t => {
            if (!reel) return;
            let el = t - reel.t0;
            if (fast) { reel.t0 -= 120; el += 120; }
            let k = reel.i;
            while (k + 1 < reel.seq.length && reel.seq[k + 1].t <= el) k++;
            if (k !== reel.i) {
                reel.i = k;
                const nm = $('.od-name', sec);
                nm.textContent = reel.seq[k].v;
                nm.classList.remove('roll'); void nm.offsetWidth; nm.classList.add('roll');
                if (!reel.quick) S.play('tick', { vol: 0.9 });
            }
            if (reel.i >= reel.seq.length - 1 && el > reel.seq[reel.seq.length - 1].t + 80) {
                const r = reel;
                r.stopDrum();
                reel = null;
                sec.classList.remove('rolling');
                decide(r.pick, r.quick, r.after);
                return;
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    function decide(pick, quick, after) {
        st.done.push(pick); persist();
        const nm = $('.od-name', sec);
        nm.textContent = pick;
        nm.classList.remove('roll', 'hit'); void nm.offsetWidth; nm.classList.add('hit');
        const r = nm.getBoundingClientRect();
        if (quick) { S.play('pop', 1.1); FX.stars(r.left + r.width / 2, r.top + r.height / 2, 12, r.width * 0.4); }
        else {
            S.play('crash'); S.play('ding');
            FX.ring(r.left + r.width / 2, r.top + r.height / 2, '#ffe14d', 800, 10);
            FX.confettiBurst(r.left + r.width / 2, r.bottom, 70, 0.8);
            if (st.done.length === 1) FX.flash('#fff6c0', 400);
        }
        root.Kuji.setBusy(false);
        render(true);
        $('.od-rank', sec).textContent = st.done.length + 'ばん め';
        $('.od-name', sec).textContent = pick;
        if (after) after();
        else if (!left().length) setTimeout(() => { S.play('fanfare', false); FX.confetti(140); }, 500);
    }

    /* のこり ぜんぶを つぎつぎに */
    function all() {
        if (reel) return;
        const go = () => {
            if (root.Kuji.current() !== 'order') return;
            if (!left().length) { S.play('fanfare', false); FX.confetti(140); return; }
            next(true, () => setTimeout(go, 220));
        };
        go();
    }

    function stop() {
        cancelAnimationFrame(raf);
        if (reel) { reel.stopDrum(); reel = null; }
        if (sec) sec.classList.remove('rolling');
        root.Kuji.setBusy(false);
    }

    root.Kuji.register('order', {
        title: '発表の じゅんばん', emoji: 'trophy',
        init, enter, leave, onSheetOpen, onSheetClose,
    });
})(window);
