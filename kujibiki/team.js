/* くじびき ひろば ── ⑥ チームわけ・席がえ
   チームわけ：名前の カードが 1まいずつ チームの はこへ とんでいく。
   席がえ　　：「？」の 席が 1つずつ めくれて 名前が 出る。つかわない 席は タップで ×。
   だれが どこか は さきに KujiLogic（splitTeams / assignSeats）で きめる。 */
(function (root) {
    'use strict';
    const { $, $$, load, save, esc } = root.Kuji;
    const L = root.KujiLogic, S = root.KujiSound, FX = root.KujiFX;

    const TCOL = ['#ff4d6d', '#3a86ff', '#ffd23f', '#2ec4b6', '#b46bff', '#ff9f1c', '#7bd84a', '#ff5dc8', '#00b4d8', '#f72585', '#a3e635', '#ff6b3d'];
    const DEF = {
        tab: 'team',
        names: L.numberList(1, 30).map(v => v + 'ばん').join('\n'),
        by: 'count', count: 4, size: 4, teamNames: '',
        rows: 5, cols: 6, off: [], view: 'front', speed: 'normal',
        lastTeams: null, lastSeats: null,
    };
    const SPEED = { slow: 1.6, normal: 1, fast: 0.45 };

    let sec, st, ed, timers = [], running = false;

    function init(el) {
        sec = el;
        st = load('team', DEF);
        ed = root.Kuji.listEditor($('.listed', sec), { max: 60, unit: '人', suffix: true });
        $$('.tm-tabs button', sec).forEach(b => b.addEventListener('click', () => { if (!running) { st.tab = b.dataset.tab; persist(); render(); } }));
        $('[data-act="team"]', sec).addEventListener('click', runTeams);
        $('[data-act="seat"]', sec).addEventListener('click', runSeats);
        $('[data-act="skip"]', sec).addEventListener('click', skip);
        $('[data-act="print"]', sec).addEventListener('click', () => root.print());
        $('[data-act="flipView"]', sec).addEventListener('click', () => { st.view = st.view === 'front' ? 'back' : 'front'; persist(); renderSeats(); });
        $('.tm-seats', sec).addEventListener('click', e => {
            const s = e.target.closest('.seat');
            if (!s || running) return;
            const i = Number(s.dataset.i);
            const k = st.off.indexOf(i);
            if (k >= 0) st.off.splice(k, 1); else st.off.push(i);
            st.lastSeats = null;
            persist(); renderSeats();
            S.play('kachi');
        });
        $$('[name="tmBy"]', sec).forEach(r => r.addEventListener('change', byUi));
    }
    function enter() { render(); }
    function leave() { stopAll(); }
    function persist() { save('team', st); }
    const names = () => L.parseList(st.names).slice(0, 60);

    function byUi() {
        const v = ($('[name="tmBy"]:checked', sec) || {}).value || 'count';
        $('.tm-by-count', sec).hidden = v !== 'count';
        $('.tm-by-size', sec).hidden = v !== 'size';
    }
    function onSheetOpen() {
        ed.set(st.names);
        $$('[name="tmBy"]', sec).forEach(r => { r.checked = r.value === st.by; });
        $('[name="tmCount"]', sec).value = st.count;
        $('[name="tmSize"]', sec).value = st.size;
        $('[name="tmTeamNames"]', sec).value = st.teamNames;
        $('[name="tmRows"]', sec).value = st.rows;
        $('[name="tmCols"]', sec).value = st.cols;
        $$('[name="tmSpeed"]', sec).forEach(r => { r.checked = r.value === st.speed; });
        byUi();
    }
    function onSheetClose() {
        const nm = ed.get();
        if (nm !== st.names) { st.lastTeams = null; st.lastSeats = null; }
        st.names = nm;
        st.by = ($('[name="tmBy"]:checked', sec) || {}).value || 'count';
        st.count = L.clamp(Math.round($('[name="tmCount"]', sec).value), 2, 12);
        st.size = L.clamp(Math.round($('[name="tmSize"]', sec).value), 1, 30);
        st.teamNames = $('[name="tmTeamNames"]', sec).value;
        const rows = L.clamp(Math.round($('[name="tmRows"]', sec).value), 1, 10);
        const cols = L.clamp(Math.round($('[name="tmCols"]', sec).value), 1, 10);
        if (rows !== st.rows || cols !== st.cols) { st.off = []; st.lastSeats = null; }
        st.rows = rows; st.cols = cols;
        st.speed = ($('[name="tmSpeed"]:checked', sec) || {}).value || 'normal';
        persist(); render();
    }

    function render() {
        sec.dataset.tab = st.tab;
        $$('.tm-tabs button', sec).forEach(b => b.classList.toggle('on', b.dataset.tab === st.tab));
        $('.tm-team', sec).hidden = st.tab !== 'team';
        $('.tm-seat', sec).hidden = st.tab !== 'seat';
        if (st.tab === 'team') renderTeams(st.lastTeams, true);
        else renderSeats(st.lastSeats ? st.lastSeats.map : null, true);
    }

    /* ---------- チームわけ ---------- */
    function teamCount() {
        const n = names().length;
        const k = st.by === 'size' ? L.teamCountBySize(n, st.size) : st.count;
        return Math.max(1, Math.min(12, k, Math.max(1, n)));
    }
    function teamLabel(i) {
        const custom = L.parseList(st.teamNames);
        return custom[i] || (i + 1) + ' はん';
    }
    function renderTeams(teams, full) {
        const k = teams ? teams.length : teamCount();
        const box = $('.tm-teams', sec);
        box.style.setProperty('--k', k);
        box.innerHTML = Array.from({ length: k }, (_, i) => `
            <div class="tbox" style="--c:${TCOL[i % TCOL.length]}" data-t="${i}">
              <h3>${esc(teamLabel(i))}<small>${teams ? teams[i].length + '人' : ''}</small></h3>
              <div class="tcards">${full && teams ? teams[i].map(nm => `<span class="tcard">${esc(nm)}</span>`).join('') : ''}</div>
            </div>`).join('');
        $('.tm-info', sec).textContent = `${names().length}人 を ${k}チーム に わけます`;
    }
    function runTeams() {
        if (running) return;
        const list = names();
        if (list.length < 2) return;
        S.unlock();
        const teams = L.splitTeams(list, teamCount());
        st.lastTeams = teams; persist();
        renderTeams(teams, false);
        running = true;
        root.Kuji.setBusy(true);
        sec.classList.add('running');
        // くばる じゅん：1はん → 2はん → … を くりかえす（トランプを くばる ように）
        const order = [];
        const mx = Math.max(...teams.map(t => t.length));
        for (let r = 0; r < mx; r++) teams.forEach((t, i) => { if (t[r] != null) order.push([i, t[r]]); });
        const gap = L.clamp(9000 / order.length, 140, 650) * (SPEED[st.speed] || 1);
        const stopDrum = S.startDrumroll();
        timers.push(() => stopDrum());
        const deck = $('.tm-deck', sec);
        deck.hidden = false;
        order.forEach(([ti, nm], k) => {
            timers.push(clearTimeout.bind(null, setTimeout(() => dealCard(ti, nm, k, order.length), 500 + k * gap)));
        });
        timers.push(clearTimeout.bind(null, setTimeout(() => {
            stopDrum();
            finish(() => {
                S.play('crash'); S.play('fanfare', false);
                FX.confetti(140);
                renderTeams(teams, true);
            });
        }, 500 + order.length * gap + 500)));
    }
    function dealCard(ti, nm, k, total) {
        const deck = $('.tm-deck', sec);
        const target = $(`.tbox[data-t="${ti}"] .tcards`, sec);
        if (!deck || !target) return;
        const d = deck.getBoundingClientRect();
        const card = document.createElement('span');
        card.className = 'tcard flying';
        card.textContent = nm;
        card.style.setProperty('--c', TCOL[ti % TCOL.length]);
        document.body.appendChild(card);
        const cw = card.offsetWidth, ch = card.offsetHeight;
        card.style.left = (d.left + d.width / 2 - cw / 2) + 'px';
        card.style.top = (d.top + d.height / 2 - ch / 2) + 'px';
        // 着地する ところ
        const ph = document.createElement('span');
        ph.className = 'tcard ph';
        ph.textContent = nm;
        target.appendChild(ph);
        const t = ph.getBoundingClientRect();
        requestAnimationFrame(() => {
            card.style.transform = `translate(${t.left - (d.left + d.width / 2 - cw / 2)}px, ${t.top - (d.top + d.height / 2 - ch / 2)}px) rotate(${(Math.random() - 0.5) * 20}deg)`;
        });
        S.play('pop', 0.8 + (ti % 6) * 0.12);
        const cnt = $('.tm-deck b', sec);
        if (cnt) cnt.textContent = total - k - 1;
        setTimeout(() => {
            card.remove();
            ph.classList.remove('ph');
            ph.classList.add('land');
            const h = $(`.tbox[data-t="${ti}"] small`, sec);
            if (h) h.textContent = target.children.length + '人';
        }, 420);
    }

    /* ---------- 席がえ ---------- */
    function seatIds() {
        const a = [];
        for (let i = 0; i < st.rows * st.cols; i++) if (!st.off.includes(i)) a.push(i);
        return a;
    }
    function renderSeats(map, full) {
        const g = $('.tm-seats', sec);
        g.style.setProperty('--cols', st.cols);
        g.style.setProperty('--rows', st.rows);
        let html = '';
        // 先生から 見る むきは 上下・左右 ぎゃく
        const back = st.view === 'back';
        for (let rr = 0; rr < st.rows; rr++) for (let cc = 0; cc < st.cols; cc++) {
            const r = back ? st.rows - 1 - rr : rr, c = back ? st.cols - 1 - cc : cc;
            const i = r * st.cols + c;
            const off = st.off.includes(i);
            const nm = map ? map[i] : null;
            html += `<button class="seat${off ? ' off' : ''}${full && nm ? ' open' : ''}" data-i="${i}" ${off ? 'aria-label="つかわない 席"' : ''}>
                <span class="flip"><span class="face back">${off ? '×' : '？'}</span><span class="face front">${nm ? esc(nm) : ''}</span></span></button>`;
        }
        g.innerHTML = html;
        const n = names().length, s = seatIds().length;
        const info = $('.tm-seatinfo', sec);
        info.textContent = `${n}人 ・ 席 ${s}こ` + (n > s ? `（${n - s}人 すわれません。席を ふやしてね）` : '');
        info.classList.toggle('warn', n > s);
        $('.tm-front', sec).textContent = st.view === 'back' ? 'うしろ（先生から 見た むき：こくばんは 下）' : 'こくばん（まえ）';
        sec.classList.toggle('seat-back', st.view === 'back');
    }
    function runSeats() {
        if (running) return;
        const list = names();
        const ids = seatIds();
        if (!list.length || !ids.length) return;
        S.unlock();
        const res = L.assignSeats(list, ids);
        st.lastSeats = res; persist();
        renderSeats(res.map, false);
        running = true;
        root.Kuji.setBusy(true);
        sec.classList.add('running');
        const order = L.shuffle(Object.keys(res.map).map(Number));
        const gap = L.clamp(9000 / order.length, 120, 600) * (SPEED[st.speed] || 1);
        const stopDrum = S.startDrumroll();
        timers.push(() => stopDrum());
        order.forEach((i, k) => {
            timers.push(clearTimeout.bind(null, setTimeout(() => {
                const s = $(`.seat[data-i="${i}"]`, sec);
                if (!s) return;
                s.classList.add('open', 'pop');
                S.play('pop', 0.9 + Math.random() * 0.5);
                const r = s.getBoundingClientRect();
                FX.stars(r.left + r.width / 2, r.top + r.height / 2, 6, r.width * 0.4);
            }, 500 + k * gap)));
        });
        timers.push(clearTimeout.bind(null, setTimeout(() => {
            stopDrum();
            finish(() => {
                S.play('crash'); S.play('fanfare', false);
                FX.confetti(140);
                renderSeats(res.map, true);
                if (res.over.length) root.Kuji.showResult({ level: 'normal', img: 'glowing-star', sub: '席が たりません', title: res.over.join('・'), note: '席を ふやして もういちど', quiet: true });
            });
        }, 500 + order.length * gap + 400)));
    }

    /* ---------- おわり・とばす ---------- */
    function finish(fn) {
        stopAll();
        $('.tm-deck', sec).hidden = true;
        fn();
    }
    function skip() {
        if (!running) return;
        if (st.tab === 'team' && st.lastTeams) finish(() => { S.play('crash'); FX.confetti(100); renderTeams(st.lastTeams, true); });
        else if (st.lastSeats) finish(() => { S.play('crash'); FX.confetti(100); renderSeats(st.lastSeats.map, true); });
    }
    function stopAll() {
        timers.splice(0).forEach(f => f());
        $$('.tcard.flying').forEach(c => c.remove());
        running = false;
        if (sec) sec.classList.remove('running');
        root.Kuji.setBusy(false);
    }

    root.Kuji.register('team', {
        title: 'チームわけ・席がえ', emoji: 'glowing-star',
        init, enter, leave, onSheetOpen, onSheetClose,
    });
})(window);
