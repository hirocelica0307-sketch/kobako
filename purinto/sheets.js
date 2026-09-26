/* たのしい プリント ── プリントの かたち（A4 1まい ぶんの HTML を つくる）
   ------------------------------------------------------------------
   SHEETS の 1つ ＝ プリントの しゅるい 1つ。
     options … せっていの ならび（select / check / text）
     build(opt, rng) → { page: 'HTML', answer: 'HTML' | null }
   CATALOG は メニューに ならぶ もの（おなじ しゅるいを べつの 教科に
   べつの はじめの せっていで ならべる ことも できる）。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';
    const G = root.PurintoGen || require('./gen.js');
    const D = root.PurintoData || require('./data.js');
    const K = root.PurintoSakubun || require('./sakubun.js');

    const SUBJECTS = {
        kokugo: { label: 'こくご', icon: '📖' },
        sansu: { label: 'さんすう', icon: '🔢' },
        seikatsu: { label: 'せいかつ', icon: '🌱' },
        dotoku: { label: 'どうとく', icon: '💖' },
        taiiku: { label: 'たいいく', icon: '🤸' },
        zuko: { label: 'ずこう', icon: '🎨' },
        cog: { label: 'あたまの たいそう', icon: '🧠' },
    };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const MARU = '①②③④⑤⑥⑦⑧⑨⑩';
    const range = n => Array.from({ length: n }, (_, i) => i);

    /* ---------- どの プリントにも つく わく ---------- */

    function page(o) {
        const S = SUBJECTS[o.subject] || SUBJECTS.kokugo;
        const rules = (!o.answer && o.rules && o.rules.length)
            ? `<div class="rules"><b class="rules-h">やりかた</b><ol>${o.rules.map((r, i) => `<li><span class="rn">${MARU[i]}</span><span>${r}</span></li>`).join('')}</ol></div>`
            : '';
        return `<section class="page subj-${o.subject}${o.answer ? ' is-answer' : ''}">
  <header class="ph">
    <div class="ph-text">
      <div class="catch">${esc(o.catchline || '')}</div>
      <h1 class="ttl">${esc(o.title)}</h1>
    </div>
    <div class="ph-icon">${o.icon || ''}</div>
  </header>
  <div class="namebar">
    <span class="subj-badge">${S.icon} ${esc(S.label)}</span>
    ${o.answer ? '<span class="ans-badge">こたえ</span>' : `<span class="date">がつ</span><span class="date">にち</span><span class="name">なまえ</span>`}
  </div>
  ${rules}
  <div class="pbody">${o.body}</div>
</section>`;
    }

    /** 2まい（もんだい・こたえ）を おなじ つくりで */
    function both(base, bodyQ, bodyA) {
        return {
            page: page({ ...base, body: bodyQ }),
            answer: bodyA == null ? null : page({ ...base, answer: true, body: bodyA }),
        };
    }

    /** マス目の なかに ならべた ものを、中心どうし 線で むすぶ SVG（こたえ用） */
    function pathSvg(cells, W, H, cls) {
        const pts = cells.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ');
        return `<svg class="overlay ${cls || ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" /></svg>`;
    }

    /* ================================================================
       こくご
       ================================================================ */

    /* ---------- ことば かいだん ---------- */
    const KAIDAN_START = 'あいうかきくこさしすたてとなのはひふまみもやらり'.split('');

    const kaidan = {
        id: 'kaidan', title: 'ことば かいだん', icon: '🪜',
        desc: '1だんめは 1もじ、2だんめは 2もじ…。おなじ もじから はじまる ことばで かいだんを のぼろう。',
        options: [
            { key: 'dan', label: 'だんの かず', type: 'select', def: '10', choices: [['6', '6だん'], ['8', '8だん'], ['10', '10だん']] },
            { key: 'moji', label: 'はじめの もじ', type: 'select', def: '', choices: [['', 'じぶんで きめる'], ['random', 'くじで きめる'], ...KAIDAN_START.map(c => [c, `「${c}」`])] },
            { key: 'genkai', label: 'げんかいに ちょうせん らん', type: 'check', def: true },
        ],
        build(opt, rng) {
            const dan = +opt.dan || 10;
            let moji = opt.moji === 'random' ? rng.pick(KAIDAN_START) : (opt.moji || '');
            moji = G.chars(moji)[0] || '';
            const cell = dan <= 6 ? 20 : dan <= 8 ? 17 : 15;
            const rows = range(dan).map(r => {
                const cs = range(r + 1).map(c => `<div class="kc${c === 0 ? ' kc-head' : ''}" style="width:${cell}mm;height:${cell}mm">${c === 0 && moji ? `<span class="kmoji">${esc(moji)}</span>` : ''}</div>`).join('');
                return `<div class="krow"><span class="kno">${String(r + 1).padStart(2, '0')}</span>${cs}</div>`;
            }).join('');
            const ex = [['き'], ['き', 'く'], ['き', 'つ', 'ね'], ['きょ', 'う', 'りゅ', 'う']];
            const exHtml = ex.map((w, r) => `<div class="krow"><span class="kno">${String(r + 1).padStart(2, '0')}</span>${w.map((c, i) => `<div class="kc kc-ex${i === 0 ? ' kc-head' : ''}${c.length > 1 ? ' two' : ''}">${c}</div>`).join('')}</div>`).join('');
            const genkai = opt.genkai ? `<div class="genkai"><div class="sub-h">げんかいに ちょうせん！ なんもじの ことばが あるかな？</div>
              ${range(2).map(() => `<div class="krow">${range(10).map(c => `<div class="kc${c === 0 ? ' kc-head' : ''}" style="width:15mm;height:15mm">${c === 0 && moji ? `<span class="kmoji">${esc(moji)}</span>` : ''}</div>`).join('')}</div>`).join('')}</div>` : '';
            const body = `<div class="kaidan">
                <div class="kaidan-steps">${rows}</div>
                <div class="kaidan-ex"><div class="ex-h">れい</div>${exHtml}<div class="ex-icon">📚💡</div></div>
              </div>
              ${genkai}
              <div class="notes">👉 <b>ちいさい「っ」は 1もじ</b>。ほかの ちいさい もじ（ゃゅょ など）は まえの もじと セットで 1もじ。<br>
              　 れい：ら・っ・こ ＝ 3もじ　ティ・ッ・シュ ＝ 3もじ　パ・ー・ティ・ー ＝ 4もじ<br>
              👉 「゛」「゜」を つけても OK！（「は」は「ば」でも「ぱ」でも OK）</div>`;
            return both({
                subject: 'kokugo', catchline: 'たくさんの ことばを あつめよう！', title: 'ことば かいだん プリント', icon: '🪜',
                rules: [moji ? `ふとい マスの もじ「<b>${esc(moji)}</b>」から はじまる ことばを さがそう。` : 'ふとい マスに もじを 1もじずつ かこう（ぜんぶ おなじ もじ）。',
                    'その もじから はじまる ことばを、マスの かずに あわせて かいて いこう。',
                    'なんだんまで いけるかな？ ぜんぶ かけたら すごい！'],
            }, body, null);
        },
    };

    /* ---------- ものがたり めいろ ---------- */
    const storyMaze = {
        id: 'storymaze', title: 'ものがたり めいろ', icon: '🗺️',
        desc: '1マスずつ よんで すすむと おはなしに なる めいろ。まちがった みちに すすむと、へんな おはなしに…！',
        options: [
            { key: 'story', label: 'おはなし', type: 'select', def: 'random', choices: [['random', 'くじで きめる'], ['lv1', 'やさしい おはなしから'], ...D.STORIES.map(s => [s.id, `${s.icon} ${s.title}（${'★'.repeat(s.level)}）`])] },
            { key: 'kabe', label: 'かべにも もじを いれる（むずかしい）', type: 'check', def: false },
            { key: 'copy', label: 'かきうつす らんを つける', type: 'check', def: true },
        ],
        build(opt, rng) {
            let pool = D.STORIES;
            if (opt.story === 'lv1') pool = D.STORIES.filter(s => s.level === 1);
            const story = D.STORIES.find(s => s.id === opt.story) || rng.pick(pool);
            let total = 0;
            for (const p of story.parts) total += typeof p === 'string' ? G.chars(p).length : G.chars(p.ok).length + G.chars(p.ng).length;
            const availH = opt.copy ? 148 : 184;
            let [W, H] = G.mazeDims(total, 186 / availH), m = null;
            while (!m && H < W + 8) { m = G.storyMaze(story, W, H, rng, 300); if (!m) H++; }
            if (!m) return both({ subject: 'kokugo', title: 'ものがたり めいろ' }, '<p>めいろが つくれませんでした。「べつの もんだい」を おして ください。</p>', null);

            const cell = Math.min(16, 186 / W, availH / H);
            const fill = G.chars(m.text).filter(c => !'、。「」'.includes(c));
            const kabe = range(W * H).map(() => rng.pick(fill));
            const grid = (answer) => {
                let h = '';
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const c = m.cells.get(x + ',' + y);
                    if (c) {
                        const isStart = c.kind === 'main' && c.idx === 0, isGoal = c.kind === 'main' && c.idx === m.main.length - 1;
                        const cls = ['sm', answer && c.kind === 'main' ? 'sm-ok' : '', answer && c.kind === 'ng' ? 'sm-ng' : '', isStart ? 'sm-start' : '', isGoal ? 'sm-goal' : ''].join(' ');
                        h += `<div class="${cls}">${esc(c.ch)}${isStart ? '<i class="flag">スタート</i>' : ''}${isGoal ? '<i class="flag">ゴール</i>' : ''}</div>`;
                    } else if (opt.kabe) {
                        h += `<div class="sm sm-kabe-moji">${esc(kabe[y * W + x])}</div>`;
                    } else h += '<div class="sm sm-wall"></div>';
                }
                const svg = answer ? pathSvg(m.main, W, H, 'ov-ok') : '';
                return `<div class="smaze" style="grid-template-columns:repeat(${W},${cell}mm);grid-auto-rows:${cell}mm;font-size:${(cell * 0.62).toFixed(1)}mm">${h}${svg}</div>`;
            };
            const copy = opt.copy ? `<div class="copy-box"><div class="sub-h small">ただしい おはなしを かきうつそう</div>${range(2).map(() => '<div class="wline"></div>').join('')}
               <div class="sub-h small" style="margin-top:2mm">へんな おはなしで いちばん おもしろかったのは？</div><div class="wline"></div></div>` : '';
            const texts = [];
            for (const p of story.parts) if (typeof p !== 'string') texts.push(`<span class="ok">${esc(p.ok)}</span> ／ <span class="ng">${esc(p.ng)}</span>`);
            const ans = `${grid(true)}<div class="ans-text"><b>こたえ：</b>${esc(m.text)}</div><div class="ans-text small"><b>わかれみち：</b>${texts.join('　')}</div>`;
            return both({
                subject: 'kokugo', catchline: `おはなし「${story.title}」を よみながら ゴールを めざそう！`, title: 'ものがたり めいろ', icon: story.icon,
                rules: ['<b>スタート</b>の もじから、となりの マスへ 1もじずつ よんで すすもう（ななめは ×）。',
                    'みちが わかれて いたら、<b>おはなしが ただしく つながる ほう</b>へ すすもう。',
                    'へんな おはなしに なったら もどって やりなおそう。'],
            }, grid(false) + copy, ans);
        },
    };

    /* ---------- ことば さがし ---------- */
    const WS_LEVELS = { easy: { W: 6, H: 6, n: 5, dirs: 'easy', label: 'かんたん（→ ↓）' }, mid: { W: 8, H: 8, n: 8, dirs: 'mid', label: 'ふつう（→ ↓ ↘）' }, hard: { W: 10, H: 10, n: 10, dirs: 'hard', label: 'むずかしい（ぎゃくも あり）' } };
    const wordSearch = {
        id: 'wordsearch', title: 'ことば さがし', icon: '🔍',
        desc: 'もじの なかに かくれた ことばを みつけて かこもう。テーマごとに ことばが かわるよ。',
        options: [
            { key: 'theme', label: 'テーマ', type: 'select', def: 'doubutsu', choices: D.WS_THEMES.map(t => [t.id, `${t.icon} ${t.title}`]) },
            { key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(WS_LEVELS).map(([k, v]) => [k, v.label]) },
        ],
        build(opt, rng) {
            const th = D.WS_THEMES.find(t => t.id === opt.theme) || D.WS_THEMES[0];
            const lv = WS_LEVELS[opt.level] || WS_LEVELS.easy;
            const cand = th.words.filter(w => G.chars(w).length <= Math.min(lv.W, lv.H));
            const words = rng.sample(cand, lv.n).map(w => ({ word: w, emoji: (D.WORDS.find(d => G.toHira(d.word) === G.toHira(w)) || {}).emoji || '' }));
            const filler = th.script === 'kata' ? D.KATA_FILL : D.HIRA_FILL;
            const ws = G.wordSearch(words, lv.W, lv.H, lv.dirs, filler, rng);
            if (!ws) return both({ subject: 'kokugo', title: 'ことば さがし' }, '<p>つくれませんでした。「べつの もんだい」を おして ください。</p>', null);
            const cell = Math.min(17, 150 / lv.W);
            const gridHtml = (answer) => {
                const cells = ws.grid.map(r => r.map(c => `<div class="wc">${esc(c)}</div>`).join('')).join('');
                const lines = answer ? `<svg class="overlay ov-ws" viewBox="0 0 ${lv.W} ${lv.H}">${ws.placed.map(p =>
                    `<line x1="${p.x + 0.5}" y1="${p.y + 0.5}" x2="${p.x + p.dx * (p.len - 1) + 0.5}" y2="${p.y + p.dy * (p.len - 1) + 0.5}" />`).join('')}</svg>` : '';
                return `<div class="wsgrid" style="grid-template-columns:repeat(${lv.W},${cell}mm);grid-auto-rows:${cell}mm;font-size:${(cell * 0.6).toFixed(1)}mm">${cells}${lines}</div>`;
            };
            const list = `<div class="wlist"><div class="sub-h">みつける ことば（${words.length}こ）</div>${ws.placed.sort((a, b) => a.word.localeCompare(b.word, 'ja')).map(p =>
                `<span class="wchip"><span class="box"></span>${p.emoji ? `<span class="em">${p.emoji}</span>` : ''}${esc(p.word)}</span>`).join('')}</div>`;
            const extra = `<div class="copy-box"><div class="sub-h small">ほかにも ことばが かくれて いたかな？ みつけたら かこう。</div><div class="wline"></div></div>`;
            return both({
                subject: 'kokugo', catchline: `${th.icon} ${th.title}が かくれて いるよ！`, title: 'ことば さがし', icon: '🔍',
                rules: [`したの ことばを もじの なかから さがして、<b>○で かこもう</b>。`,
                    lv.dirs === 'easy' ? 'ことばは <b>よこ（→）</b>か <b>たて（↓）</b>に ならんで いるよ。'
                        : lv.dirs === 'mid' ? 'ことばは <b>よこ（→）・たて（↓）・ななめ（↘）</b>に ならんで いるよ。'
                            : 'ことばは <b>よこ・たて・ななめ</b>。ぎゃくむきに ならんで いる ことばも あるよ！',
                    'みつけたら リストの □ に ✓ を つけよう。'],
            }, gridHtml(false) + list + extra, gridHtml(true) + list);
        },
    };

    /* ---------- かんじ たしざん ---------- */
    const kanjiAdd = {
        id: 'kanjiadd', title: 'かんじ たしざん', icon: '➕',
        desc: '「木＋木＝林」のように、ぶぶんを たして かんじを つくる パズル。',
        options: [
            { key: 'grade', label: 'がくねん', type: 'select', def: '1', choices: [['1', '1ねんせいの かんじ'], ['2', '2ねんせいまで'], ['3', '3ねんせいまで'], ['only2', '2ねんせいの かんじ だけ'], ['only3', '3ねんせいの かんじ だけ']] },
            { key: 'yomi', label: 'よみがなの ヒントを だす', type: 'check', def: true },
        ],
        build(opt, rng) {
            const g = opt.grade || '1';
            const pool = D.KANJI_ADD.filter(k => g === 'only2' ? k.grade === 2 : g === 'only3' ? k.grade === 3 : k.grade <= +g);
            const qs = rng.sample(pool, Math.min(10, pool.length));
            const row = (q, i, answer) => {
                const parts = q.parts.map(p => `<span class="kp">${esc(p)}${D.RADICAL_NAMES[p] ? `<small>${D.RADICAL_NAMES[p]}</small>` : ''}</span>`).join('<span class="op">＋</span>');
                return `<div class="kq${q.parts.length > 2 ? ' three' : ''}"><span class="qn">${i + 1}</span>${parts}<span class="op">＝</span>
                  <span class="kbox">${answer ? `<b>${esc(q.kanji)}</b>` : ''}</span>
                  <span class="kyomi">${opt.yomi || answer ? `（${esc(q.yomi)}）` : '（　　　　）'}</span></div>`;
            };
            const make = answer => `<div class="kq-list">${qs.map((q, i) => row(q, i, answer)).join('')}</div>
                ${answer ? '' : `<div class="copy-box"><div class="sub-h">じぶんで もんだいを つくろう！</div>
                  ${range(2).map(() => '<div class="kq kq-own"><span class="kbox sm"></span><span class="op">＋</span><span class="kbox sm"></span><span class="op">＝</span><span class="kbox sm"></span></div>').join('')}</div>`}`;
            return both({
                subject: 'kokugo', catchline: 'かんじは くみたて パズル！', title: 'かんじ たしざん', icon: '🧩',
                rules: ['ひだりの ぶぶんを あわせると どんな かんじに なるかな？', '□ に かんじを かこう。' + (opt.yomi ? '（　）は よみかたの ヒントだよ。' : '（　）に よみかたも かこう。'), 'さいごに じぶんで もんだいを つくって ともだちと だしあおう。'],
            }, make(false), make(true));
        },
    };

    /* ---------- ならびかえ ことば ---------- */
    const anagram = {
        id: 'anagram', title: 'ならびかえ ことば', icon: '🔀',
        desc: 'バラバラに なった もじを ならべかえて ことばに しよう。えが ヒント。',
        options: [
            { key: 'cat', label: 'なかま', type: 'select', def: 'all', choices: [['all', 'ぜんぶ'], ...Object.entries(D.WORD_CATS)] },
            { key: 'len', label: 'ながさ', type: 'select', def: '3', choices: [['3', '3〜4もじ'], ['5', '4〜6もじ']] },
            { key: 'hint', label: 'えの ヒントを だす', type: 'check', def: true },
        ],
        build(opt, rng) {
            const [lo, hi] = opt.len === '5' ? [4, 7] : [3, 4];
            const pool = D.WORDS.filter(w => (opt.cat === 'all' || !opt.cat || w.cat === opt.cat)).filter(w => {
                const n = G.moraSplit(w.word).length; return n >= lo && n <= hi && new Set(G.moraSplit(w.word)).size > 1;
            });
            const qs = rng.sample(pool, Math.min(10, pool.length)).map(w => ({ ...w, tiles: G.scramble(w.word, rng), ms: G.moraSplit(w.word) }));
            const make = answer => `<div class="ana-list">${qs.map((q, i) => `<div class="ana">
                <span class="qn">${i + 1}</span>
                ${opt.hint || answer ? `<span class="ana-em">${q.emoji}</span>` : ''}
                <span class="tiles">${q.tiles.map(t => `<span class="tile${t.length > 1 ? ' two' : ''}">${esc(t)}</span>`).join('')}</span>
                <span class="arrow">➡</span>
                <span class="boxes">${q.ms.map(c => `<span class="abox${c.length > 1 ? ' two' : ''}">${answer ? esc(c) : ''}</span>`).join('')}</span></div>`).join('')}</div>`;
            return both({
                subject: 'kokugo', catchline: 'もじが バラバラに なっちゃった！', title: 'ならびかえ ことば', icon: '🔀',
                rules: ['まるの なかの もじを ならべかえて、ことばを つくろう。', opt.hint ? 'えが ヒントだよ。' : 'なんの ことばかな？ よく かんがえよう。', 'ちいさい ゃ・ゅ・ょ は まえの もじと 1マスに かこう。'],
            }, make(false), make(true));
        },
    };

    /* ---------- あたまの もじ クイズ ---------- */
    const headQuiz = {
        id: 'headquiz', title: 'あたまの もじ クイズ', icon: '🔤',
        desc: 'えの なまえの 1もじめを あつめると、ひみつの ことばが できあがる。',
        options: [
            { key: 'n', label: 'もんだいの かず', type: 'select', def: '6', choices: [['4', '4もん'], ['6', '6もん']] },
        ],
        build(opt, rng) {
            const n = +opt.n || 6;
            const qs = [];
            for (const t of rng.shuffle(D.HEAD_TARGETS)) {
                if (qs.length >= n) break;
                const pics = G.headQuiz(D.WORDS, t, rng);
                if (pics) qs.push({ word: t, pics });
            }
            const make = answer => `<div class="hq-list">${qs.map((q, i) => `<div class="hq">
                <span class="qn">${i + 1}</span>
                <span class="hq-pics">${q.pics.map(p => `<span class="hq-pic"><span class="em">${p.emoji}</span><span class="abox">${answer ? esc(G.toHira(p.word)[0]) : ''}</span>${answer ? `<small>${esc(p.word)}</small>` : ''}</span>`).join('')}</span>
                <span class="arrow">➡</span>
                <span class="boxes">${G.chars(q.word).map(c => `<span class="abox big">${answer ? esc(c) : ''}</span>`).join('')}</span></div>`).join('')}</div>`;
            return both({
                subject: 'kokugo', catchline: 'ひみつの ことばを みつけよう！', title: 'あたまの もじ クイズ', icon: '🕵️',
                rules: ['えの なまえを かんがえよう。', 'なまえの <b>1もじめ</b>を えの したの □ に かこう。', '1もじめを じゅんばんに ならべると、ひみつの ことばが できるよ！'],
            }, make(false), make(true));
        },
    };

    /* ---------- あいうえお さくぶん ---------- */
    const acrostic = {
        id: 'acrostic', title: 'あいうえお さくぶん', icon: '✍️',
        desc: 'おだいの ことばの 1もじずつから はじまる ぶんを つくる ことばあそび。',
        options: [
            { key: 'word', label: 'おだい', type: 'select', def: 'random', choices: [['random', 'くじで きめる'], ...D.ACROSTIC_WORDS.map(w => [w, w])] },
            { key: 'custom', label: 'じぶんで おだいを いれる（6もじ まで）', type: 'text', def: '', placeholder: 'れい：なまえ' },
        ],
        build(opt, rng) {
            const word = (opt.custom || '').trim() || (opt.word && opt.word !== 'random' ? opt.word : rng.pick(D.ACROSTIC_WORDS));
            const ms = G.moraSplit(word).slice(0, 6);
            const lines = ms.map(c => `<div class="acr"><span class="acr-head">${esc(c)}</span><span class="acr-line"></span></div>`).join('');
            const body = `<div class="acr-odai">おだい：<b>「${esc(ms.join(''))}」</b></div>
              <div class="acr-ex">れい「いぬ」→ <b>い</b>つも しっぽを ふって／<b>ぬ</b>くぬく ねむる ぼくの いぬ</div>
              ${lines}
              <div class="pic-frame"><span>えも かいて みよう</span></div>`;
            return both({
                subject: 'kokugo', catchline: 'あたまの もじで ぶんを つくろう！', title: 'あいうえお さくぶん', icon: '✍️',
                rules: ['ふとい マスの もじから はじまる ぶんを かこう。', 'ぜんぶ つなげると 1つの おはなしや しに なると すてき！', 'かけたら こえに だして よんで みよう。'],
            }, body, null);
        },
    };

    /* ---------- へんてこ ぶんづくり ---------- */
    const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const diceStory = {
        id: 'dicestory', title: 'へんてこ ぶんづくり', icon: '🎲',
        desc: 'サイコロで「いつ・どこで・だれが・なにを した」を きめて、へんてこな ぶんと えを かく。',
        options: [],
        build(opt, rng) {
            const cols = D.DICE_COLS.map(c => ({ ...c, six: rng.sample(c.pool, 6) }));
            const table = `<table class="dice-table"><thead><tr><th></th>${cols.map(c => `<th>${c.icon}<br>${esc(c.head)}</th>`).join('')}</tr></thead>
              <tbody>${range(6).map(i => `<tr><th class="dice">${DICE[i]}</th>${cols.map(c => `<td>${esc(c.six[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            const body = `${table}
              <div class="copy-box"><div class="sub-h">できた ぶん</div>
                <div class="dice-roll">${cols.map(c => `<span>${esc(c.head)} <span class="dbox"></span></span>`).join('')}</div>
                <div class="wline"></div><div class="wline"></div></div>
              <div class="pic-frame tall"><span>ぶんの えを かこう</span></div>`;
            return both({
                subject: 'kokugo', catchline: 'サイコロで おはなしを つくろう！', title: 'へんてこ ぶんづくり', icon: '🎲',
                rules: ['サイコロを 4かい ふって、でた めを □ に かこう。', 'でた めの ことばを じゅんばんに つなげて ぶんを つくろう。', 'へんてこな ぶんが できたら、えに かいて みよう！'],
            }, body, null);
        },
    };

    /* ================================================================
       さんすう
       ================================================================ */

    const CALC_LEVELS = {
        add1: { label: '1ねん たしざん', ops: ['+'], min: 0, max: 10, maxA: 20, targets: [8, 9, 10] },
        sub1: { label: '1ねん ひきざん', ops: ['-'], min: 1, max: 9, maxA: 18, targets: [3, 4, 5, 6] },
        mix2: { label: '2ねん たしざん・ひきざん', ops: ['+', '-'], min: 2, max: 30, maxA: 50, targets: [15, 18, 20, 24] },
        mul2: { label: '2ねん かけざん（九九）', ops: ['×'], min: 1, max: 9, maxA: 81, targets: [12, 18, 24, 36] },
        mix3: { label: '3ねん ＋－×÷ まぜこぜ', ops: ['+', '-', '×', '÷'], min: 1, max: 9, maxA: 18, targets: [6, 8] },
    };
    const calcMaze = {
        id: 'calcmaze', title: 'けいさん めいろ', icon: '🧮',
        desc: 'こたえが おなじ かずに なる マスだけを たどって ゴールへ。けいさんが みちしるべ。',
        options: [
            { key: 'level', label: 'けいさん', type: 'select', def: 'add1', choices: Object.entries(CALC_LEVELS).map(([k, v]) => [k, v.label]) },
        ],
        build(opt, rng) {
            const lv = CALC_LEVELS[opt.level] || CALC_LEVELS.add1;
            const target = rng.pick(lv.targets);
            const W = 6, H = 8;
            const path = G.cornerPath(W, H, W + H + 3, rng);
            const onPath = new Set(path.map(([x, y]) => x + ',' + y));
            const cells = [];
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const on = onPath.has(x + ',' + y);
                const e = on ? G.makeExpr(lv, target, rng) : G.makeDecoy(lv, target, rng);
                cells.push({ x, y, on, e });
            }
            const grid = answer => `<div class="cmaze-wrap"><div class="cm-start">スタート ➡</div>
              <div class="cmaze" style="grid-template-columns:repeat(${W},29mm);grid-auto-rows:21mm">
              ${cells.map(c => `<div class="cm${answer && c.on ? ' cm-ok' : ''}${c.x === 0 && c.y === 0 ? ' cm-s' : ''}${c.x === W - 1 && c.y === H - 1 ? ' cm-g' : ''}">${esc(c.e.text)}${answer ? `<small>＝${c.e.value}</small>` : ''}</div>`).join('')}
              ${answer ? pathSvg(path, W, H, 'ov-ok') : ''}</div><div class="cm-goal">➡ ゴール 🏁</div></div>`;
            return both({
                subject: 'sansu', catchline: 'けいさんで みちを ひらこう！', title: 'けいさん めいろ', icon: '🧮',
                rules: [`こたえが <b class="big">${target}</b> に なる マスだけ すすめるよ。`,
                    'スタートから となりの マスへ（たて・よこ）すすもう。ななめは ×。', 'ゴールまで せんで つないで いこう！'],
            }, grid(false), grid(true));
        },
    };

    /* ---------- まほうじん ---------- */
    const MAGIC_LEVELS = { easy: { blanks: 3, off: [0], label: 'かんたん（あな 3こ）' }, mid: { blanks: 5, off: [0], label: 'ふつう（あな 5こ）' }, hard: { blanks: 6, off: [1, 2, 3, 5, 10], label: 'むずかしい（あな 6こ・いろいろな かず）' } };
    const magic = {
        id: 'magic', title: 'まほうじん', icon: '🔮',
        desc: 'たて・よこ・ななめ、どこを たしても おなじ かずに なる ふしぎな ほうじん。',
        options: [{ key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(MAGIC_LEVELS).map(([k, v]) => [k, v.label]) }],
        build(opt, rng) {
            const lv = MAGIC_LEVELS[opt.level] || MAGIC_LEVELS.easy;
            const qs = range(6).map(() => G.magicSquare(lv.blanks, rng.pick(lv.off), rng));
            const one = (q, i, answer) => `<div class="mg">
                <div class="mg-h"><span class="qn">${i + 1}</span>どこを たしても <b>${q.sum}</b></div>
                <div class="mg-grid">${q.answer.map((r, y) => r.map((v, x) => {
                    const hole = q.puzzle[y][x] == null;
                    return `<div class="mgc${hole ? ' hole' : ''}">${hole ? (answer ? `<b class="red">${v}</b>` : '') : v}</div>`;
                }).join('')).join('')}</div>
                <div class="mg-use">つかう かず：${q.holes.map(([x, y]) => q.answer[y][x]).sort((a, b) => a - b).join('・')}</div></div>`;
            const make = answer => `<div class="mg-list">${qs.map((q, i) => one(q, i, answer)).join('')}</div>`;
            return both({
                subject: 'sansu', catchline: 'ふしぎな かずの ほうじん！', title: 'まほうじん', icon: '🔮',
                rules: ['あいて いる □ に かずを いれよう。', '<b>たて・よこ・ななめ</b>の 3つの かずを たすと、どこも おなじ こたえに なるよ。', '「つかう かず」を 1かいずつ つかおう。'],
            }, make(false), make(true));
        },
    };

    /* ---------- かずの ピラミッド ---------- */
    const PYR_LEVELS = {
        p1: { n: 3, lo: 1, hi: 5, mode: 'add', count: 6, label: '1ねん（3だん・たしざん）' },
        p2: { n: 4, lo: 1, hi: 9, mode: 'add', count: 4, label: '2ねん（4だん・たしざん）' },
        p3: { n: 4, lo: 1, hi: 12, mode: 'mid', count: 4, label: '3ねん（ひきざんも つかう）' },
        p4: { n: 5, lo: 1, hi: 9, mode: 'hard', count: 4, label: 'むずかしい（5だん）' },
    };
    const pyramid = {
        id: 'pyramid', title: 'かずの ピラミッド', icon: '🔺',
        desc: 'したの 2つの かずを たすと うえの かずに なる。ブロックを つんで ピラミッドを かんせい させよう。',
        options: [{ key: 'level', label: 'むずかしさ', type: 'select', def: 'p1', choices: Object.entries(PYR_LEVELS).map(([k, v]) => [k, v.label]) }],
        build(opt, rng) {
            const lv = PYR_LEVELS[opt.level] || PYR_LEVELS.p1;
            const qs = range(lv.count).map(() => G.pyramid(lv.n, lv.lo, lv.hi, lv.mode, rng));
            const bw = lv.n >= 5 ? 16 : lv.n === 4 ? 19 : 25;
            const one = (q, i, answer) => {
                const rowsHtml = q.rows.slice().reverse().map((r, rr) => {
                    const ri = q.rows.length - 1 - rr;
                    return `<div class="pyr-row">${r.map((v, x) => `<div class="brick" style="width:${bw}mm">${q.known[ri][x] ? v : answer ? `<b class="red">${v}</b>` : ''}</div>`).join('')}</div>`;
                }).join('');
                return `<div class="pyr"><span class="qn">${i + 1}</span>${rowsHtml}</div>`;
            };
            const make = answer => `<div class="pyr-list n${lv.count}">${qs.map((q, i) => one(q, i, answer)).join('')}</div>`;
            return both({
                subject: 'sansu', catchline: 'かずを つんで ピラミッドを つくろう！', title: 'かずの ピラミッド', icon: '🔺',
                rules: ['<b>したの 2つの ブロックの かずを たす</b>と、その うえの ブロックの かずに なるよ。',
                    lv.mode === 'add' ? 'したから じゅんばんに たして いこう。' : 'うえの かずが わかって いたら、ひきざんで したの かずも わかるよ。',
                    'てっぺんまで ぜんぶ うめよう！'],
            }, make(false), make(true));
        },
    };

    /* ---------- ナンプレ ---------- */
    const SHAPES = ['', '○', '△', '□', '☆'];
    const sudoku = {
        id: 'sudoku', title: 'ナンプレ', icon: '🔢',
        desc: 'たて・よこ・ふとい わくの なかに おなじ かずが 1つずつ。4×4 は 1ねんせいから。',
        options: [
            { key: 'size', label: 'おおきさ', type: 'select', def: '4', choices: [['4', '4×4（1〜4）'], ['4s', '4×4（○△□☆ の かたち）'], ['6', '6×6（1〜6）']] },
            { key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: [['easy', 'かんたん'], ['mid', 'ふつう'], ['hard', 'むずかしい']] },
        ],
        build(opt, rng) {
            const n = opt.size === '6' ? 6 : 4;
            const shapes = opt.size === '4s';
            const clues = n === 4 ? { easy: 9, mid: 7, hard: 5 }[opt.level || 'easy'] : { easy: 22, mid: 18, hard: 14 }[opt.level || 'easy'];
            const count = n === 4 ? 6 : 4;
            const qs = range(count).map(() => G.sudoku(n, clues, rng));
            const [bw, bh] = G.sudokuDims(n);
            const cell = n === 4 ? 15 : 14;
            const sym = v => shapes ? SHAPES[v] : v;
            const one = (q, i, answer) => `<div class="sd"><span class="qn">${i + 1}</span><div class="sd-grid" style="grid-template-columns:repeat(${n},${cell}mm);grid-auto-rows:${cell}mm">
                ${q.answer.map((r, y) => r.map((v, x) => {
                    const given = q.puzzle[y][x];
                    const cls = ['sdc', x % bw === bw - 1 && x < n - 1 ? 'br' : '', y % bh === bh - 1 && y < n - 1 ? 'bb' : ''].join(' ');
                    return `<div class="${cls}">${given ? sym(v) : answer ? `<b class="red">${sym(v)}</b>` : ''}</div>`;
                }).join('')).join('')}</div></div>`;
            const make = answer => `<div class="sd-list n${count}">${qs.map((q, i) => one(q, i, answer)).join('')}</div>`;
            const items = shapes ? '○・△・□・☆' : `1〜${n}`;
            return both({
                subject: 'sansu', catchline: 'かずの パズルに ちょうせん！', title: shapes ? 'かたち ナンプレ' : `ナンプレ ${n}×${n}`, icon: '🔢',
                rules: [`あいて いる マスに <b>${items}</b> を いれよう。`, 'たての れつ・よこの れつ・ふとい せんの わくの なかに、おなじ ものは 1つずつ しか はいらないよ。', 'はいる ものが 1つしか ない マスから さがすのが コツ！'],
            }, make(false), make(true));
        },
    };

    /* ================================================================
       あたまの たいそう（コグトレふう）
       ================================================================ */

    /* ---------- きごう さがし ---------- */
    const symbolSearch = {
        id: 'symbols', title: 'きごう さがし', icon: '🍎',
        desc: 'ならんだ えの なかから きめられた えだけ かぞえる。「かぞえる」ちからの トレーニング。',
        options: [
            { key: 'set', label: 'え', type: 'select', def: 'fruits', choices: Object.entries(D.PIC_SET_NAMES) },
            { key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: [['easy', 'かんたん（かぞえる だけ）'], ['hard', 'むずかしい（かぞえない きまり つき）']] },
        ],
        build(opt, rng) {
            const set = D.PIC_SETS[opt.set] || D.PIC_SETS.fruits;
            const pool = rng.sample(set, 5);
            const target = pool[0], skip = opt.level === 'hard' ? pool[1] : null;
            const rows = range(10).map(() => G.symbolRow(12, pool.slice(1), target, rng, skip));
            const make = answer => `<div class="sym-list">${rows.map((r, i) => `<div class="sym-row"><span class="qn">${i + 1}</span>
                <span class="syms">${r.row.map((s, j) => {
                    const counted = s === target && !(skip && r.row[j - 1] === skip);
                    return `<span class="sym${answer && counted ? ' hit' : ''}">${s}</span>`;
                }).join('')}</span><span class="cnt">${answer ? `<b class="red">${r.count}</b>` : ''}</span><span class="ko">こ</span></div>`).join('')}</div>
                <div class="timer">かかった じかん：　　　ふん　　　びょう</div>`;
            return both({
                subject: 'cog', catchline: 'よーく みて かぞえよう！', title: 'きごう さがし', icon: '👀',
                rules: [`<span class="big">${target}</span> の かずを かぞえて、みぎの □ に かこう。`,
                    skip ? `ただし <span class="big">${skip}</span> の <b>すぐ みぎ</b>に ある <span class="big">${target}</span> は かぞえないよ！` : `かぞえた ${target} に ✓ を つけながら すすもう。`,
                    'はやく せいかくに できるかな？ じかんも はかろう。'],
            }, make(false), make(true));
        },
    };

    /* ---------- てん つなぎ（うつす） ---------- */
    const DOT_MODES = { same: 'そのまま うつす', mirror: 'かがみに うつす（さゆう はんてん）', rotate: 'さかさまに うつす（180ど）' };
    const dotCopy = {
        id: 'dotcopy', title: 'てん つなぎ', icon: '✳️',
        desc: 'おてほんと おなじ かたちを てんを つないで うつす。「うつす」ちからの トレーニング。',
        options: [
            { key: 'size', label: 'てんの かず', type: 'select', def: '4', choices: [['3', '3×3'], ['4', '4×4'], ['5', '5×5']] },
            { key: 'diag', label: 'ななめの せんも つかう', type: 'check', def: false },
            { key: 'mode', label: 'うつしかた', type: 'select', def: 'same', choices: Object.entries(DOT_MODES) },
        ],
        build(opt, rng) {
            const n = +opt.size || 4;
            const segs = n === 3 ? 4 : n === 4 ? 7 : 10;
            const figs = range(4).map(() => G.dotFigure(n, segs + rng.int(-1, 1), !!opt.diag, rng));
            const side = 44;
            const dots = (lines) => {
                const pad = 0.5, sz = n - 1 + pad * 2;
                let s = `<svg class="dots" viewBox="${-pad} ${-pad} ${sz} ${sz}" style="width:${side}mm;height:${side}mm">`;
                if (lines) s += lines.map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" />`).join('');
                for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s += `<circle cx="${x}" cy="${y}" r="${0.07 + (n - 3) * 0.005}" />`;
                return s + '</svg>';
            };
            const mode = DOT_MODES[opt.mode] ? opt.mode : 'same';
            const mid = mode === 'mirror' ? '<div class="dc-mid mirror">かがみ</div>' : mode === 'rotate' ? '<div class="dc-mid">🙃<br>さかさま</div>' : '<div class="dc-mid">➡</div>';
            const make = answer => `<div class="dc-list">${figs.map((f, i) => `<div class="dc"><span class="qn">${i + 1}</span>
                <div class="dc-box">${dots(f)}<small>おてほん</small></div>${mid}<div class="dc-box">${dots(answer ? G.transformLines(f, n, mode) : null)}<small>${answer ? 'こたえ' : 'ここに かこう'}</small></div></div>`).join('')}</div>`;
            return both({
                subject: 'cog', catchline: 'おなじ かたちを うつそう！', title: mode === 'mirror' ? 'かがみ てんつなぎ' : mode === 'rotate' ? 'さかさま てんつなぎ' : 'てん つなぎ', icon: '✏️',
                rules: ['ひだりの おてほんを よく みよう。',
                    mode === 'same' ? 'みぎの てんを じょうぎで つないで、<b>おなじ かたち</b>を かこう。'
                        : mode === 'mirror' ? 'まんなかに かがみが あると おもって、<b>はんたいむき</b>の かたちを かこう。'
                            : 'おてほんを <b>さかさま</b>（ぐるっと はんぶん まわした かたち）に して かこう。',
                    'かけたら てんの かずを かぞえて たしかめよう。'],
            }, make(false), make(true));
        },
    };

    /* ---------- まちがい さがし ---------- */
    const DIFF_LEVELS = { easy: { W: 4, H: 4, k: 3, label: 'かんたん（3こ）' }, mid: { W: 5, H: 5, k: 5, label: 'ふつう（5こ）' }, hard: { W: 6, H: 7, k: 7, label: 'むずかしい（7こ）' } };
    const diffs = {
        id: 'diffs', title: 'まちがい さがし', icon: '🔎',
        desc: '2つの えを くらべて ちがう ところを みつける。「みつける」ちからの トレーニング。',
        options: [
            { key: 'set', label: 'え', type: 'select', def: 'animals', choices: Object.entries(D.PIC_SET_NAMES) },
            { key: 'level', label: 'むずかしさ', type: 'select', def: 'easy', choices: Object.entries(DIFF_LEVELS).map(([k, v]) => [k, v.label]) },
        ],
        build(opt, rng) {
            const lv = DIFF_LEVELS[opt.level] || DIFF_LEVELS.easy;
            const set = D.PIC_SETS[opt.set] || D.PIC_SETS.animals;
            const q = G.differences(lv.W, lv.H, set, lv.k, rng);
            const cell = Math.min(20, 84 / lv.W);
            const spots = new Set(q.spots.map(([x, y]) => x + ',' + y));
            const grid = (g, mark) => `<div class="dfgrid" style="grid-template-columns:repeat(${lv.W},${cell}mm);grid-auto-rows:${cell}mm;font-size:${(cell * 0.62).toFixed(1)}mm">
                ${g.map((r, y) => r.map((v, x) => `<div class="dfc${mark && spots.has(x + ',' + y) ? ' hit' : ''}">${v}</div>`).join('')).join('')}</div>`;
            const make = answer => `<div class="df-pair"><div><div class="sub-h">ひだり</div>${grid(q.left, false)}</div><div><div class="sub-h">みぎ</div>${grid(q.right, answer)}</div></div>
                <div class="df-check">みつけたら ぬろう：${range(lv.k).map(() => '<span class="ck"></span>').join('')}</div>`;
            return both({
                subject: 'cog', catchline: 'よーく くらべて みよう！', title: 'まちがい さがし', icon: '🔎',
                rules: ['ひだりと みぎの えを くらべよう。', `みぎの えで ちがう ところに ○を つけよう。ぜんぶで <b>${lv.k}こ</b> あるよ。`, 'みつけたら したの ○ を 1つずつ ぬろう。'],
            }, make(false), make(true));
        },
    };

    /* ================================================================
       ずこう
       ================================================================ */

    const halfPic = {
        id: 'halfpic', title: 'はんぶんの え', icon: '🦋',
        desc: 'はんぶん だけ ぬられた ドットえの のこりを かがみの ように ぬって かんせい させる。',
        options: [
            { key: 'pic', label: 'え', type: 'select', def: 'random', choices: [['random', 'くじで きめる'], ...D.HALF_PICS.map(p => [p.id, p.title]), ['shape', 'ふしぎな かたち（ランダム）']] },
            { key: 'color', label: 'いろ つき', type: 'check', def: true },
        ],
        build(opt, rng) {
            let pic = D.HALF_PICS.find(p => p.id === opt.pic);
            if (opt.pic === 'shape') pic = { id: 'shape', title: 'ふしぎな かたち', rows: G.randomHalfPicture(10, 10, rng, 0.45) };
            if (!pic) pic = rng.pick(D.HALF_PICS);
            const W = pic.rows[0].length, H = pic.rows.length, half = W / 2;
            const cell = 15;
            const color = ch => opt.color ? D.HALF_COLORS[ch] : '#555';
            const grid = answer => `<div class="hp" style="grid-template-columns:repeat(${W},${cell}mm);grid-auto-rows:${cell}mm">
                ${pic.rows.map(r => r.split('').map((ch, x) => {
                    const show = ch !== '.' && (x < half || answer);
                    return `<div class="hpc${x === half - 1 ? ' axis' : ''}"${show ? ` style="background:${color(ch)}"` : ''}></div>`;
                }).join('')).join('')}</div>`;
            const used = [...new Set(pic.rows.join('').replace(/\./g, ''))];
            const legend = opt.color ? `<div class="hp-legend">つかう いろ：${used.map(c => `<span class="lg"><i style="background:${D.HALF_COLORS[c]}"></i>${D.HALF_COLOR_NAMES[c]}</span>`).join('')}</div>` : '';
            const name = `<div class="copy-box"><div class="sub-h small">なんの えに なったかな？</div><div class="wline"></div></div>`;
            return both({
                subject: 'zuko', catchline: 'かがみの まほうで えを かんせい させよう！', title: 'はんぶんの え', icon: '🪞',
                rules: ['まんなかの <b>ふとい せん</b>が かがみだよ。', 'ひだりと おなじ ように、みぎがわの マスを ぬろう（むきは はんたい）。', 'かんせい したら なんの えか かこう。'],
            }, grid(false) + legend + name, grid(true) + `<div class="ans-text">こたえ：${esc(pic.title)}</div>`);
        },
    };

    const doodle = {
        id: 'doodle', title: 'つづきを かこう', icon: '🖍️',
        desc: 'わくの なかの ふしぎな せんから、なにかを かんがえて えを かんせい させる。',
        options: [],
        build(opt, rng) {
            const kinds = rng.shuffle(range(G.SQUIGGLE_KINDS)).slice(0, 6);
            const frames = kinds.map(k => ({ d: G.squiggle(rng, k), rot: rng.pick([0, 0, 90, 180, 270]), p: rng.pick(D.DOODLE_PROMPTS) }));
            const body = `<div class="doodle-list">${frames.map((f, i) => `<div class="doodle"><div class="dd-h"><span class="qn">${i + 1}</span>${esc(f.p)}</div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><path d="${f.d}" transform="rotate(${f.rot} 50 50)" /></svg>
                <div class="dd-name">これは <span class="u"></span> だよ</div></div>`).join('')}</div>`;
            return both({
                subject: 'zuko', catchline: 'この せん、なにに みえる？', title: 'つづきを かこう', icon: '🖍️',
                rules: ['わくの なかの せんを よく みよう。', 'せんを つかって、すきな えに かえて いこう。むきを かえても いいよ。', 'できたら なまえを つけて、いろも ぬろう！'],
            }, body, null);
        },
    };

    /* ================================================================
       せいかつ・どうとく・たいいく
       ================================================================ */

    const bingo = {
        id: 'bingo', title: 'みつけた ビンゴ', icon: '🎯',
        desc: 'たんけん・きせつ・やさしさ・うんどう など、テーマの ミッションで ビンゴ。1まいずつ ならびが かわる。',
        options: [
            { key: 'theme', label: 'テーマ', type: 'select', def: 'gakkou', choices: D.BINGO_THEMES.map(t => [t.id, `${t.icon} ${t.title}`]) },
            { key: 'size', label: 'おおきさ', type: 'select', def: '3', choices: [['3', '3×3'], ['4', '4×4'], ['5', '5×5']] },
            { key: 'free', label: 'まんなかを「フリー」に する（3×3・5×5）', type: 'check', def: false },
            { key: 'memo', label: 'きづいた こと らんを つける', type: 'check', def: true },
        ],
        build(opt, rng) {
            const th = D.BINGO_THEMES.find(t => t.id === opt.theme) || D.BINGO_THEMES[0];
            let n = +opt.size || 3;
            const free = opt.free && n % 2 === 1;
            while (n * n - (free ? 1 : 0) > th.items.length) n--;
            const items = rng.sample(th.items, n * n - (free ? 1 : 0));
            if (free) items.splice(Math.floor(n * n / 2), 0, ['⭐', 'フリー']);
            const cell = Math.min(58, (opt.memo ? 170 : 200) / n, 186 / n);
            const grid = `<div class="bingo" style="grid-template-columns:repeat(${n},${cell}mm);grid-auto-rows:${cell}mm">
                ${items.map(([em, lab]) => `<div class="bc${lab === 'フリー' ? ' free' : ''}"><span class="em" style="font-size:${(cell * 0.36).toFixed(1)}mm">${em}</span><span class="lab" style="font-size:${Math.max(3.4, Math.min(5.5, cell * 0.11)).toFixed(1)}mm">${esc(lab)}</span></div>`).join('')}</div>`;
            const memo = opt.memo ? `<div class="copy-box"><div class="sub-h small">きづいた こと・がんばった こと</div><div class="wline"></div><div class="wline"></div></div>` : '';
            return both({
                subject: th.subject, catchline: th.catch, title: th.title, icon: th.icon,
                rules: [th.rule, 'たて・よこ・ななめ の どれか 1れつ そろったら <b>ビンゴ！</b>', 'ぜんぶ そろえる「パーフェクト」を めざそう！'],
            }, grid + memo, null);
        },
    };

    const feelings = {
        id: 'feelings', title: 'きもちの かお', icon: '😊',
        desc: 'いろいろな ばめんで どんな きもちに なるか、かおの えと ことばで あらわす。',
        options: [{ key: 'n', label: 'ばめんの かず', type: 'select', def: '5', choices: [['4', '4つ'], ['5', '5つ']] }],
        build(opt, rng) {
            const scenes = rng.sample(D.FEEL_SCENES, +opt.n || 5);
            const bank = `<div class="feel-bank">${D.FEELINGS.map(([e, w]) => `<span class="fchip">${e} ${esc(w)}</span>`).join('')}</div>`;
            const rows = scenes.map((s, i) => `<div class="feel"><div class="feel-face"></div><div class="feel-txt">
                <div class="feel-scene"><span class="qn">${i + 1}</span>${esc(s)}</div>
                <div class="feel-line">どんな きもち？ <span class="u"></span></div>
                <div class="feel-line">どうして？ <span class="u"></span></div></div></div>`).join('');
            return both({
                subject: 'dotoku', catchline: 'こころの なかを のぞいて みよう', title: 'きもちの かお', icon: '💭',
                rules: ['こんな とき、あなたは どんな きもちに なるかな？', 'まるの なかに かおを かこう。うえの ことばを つかっても いいよ。', 'ともだちと くらべて みよう。おなじかな？ ちがうかな？'],
            }, bank + rows, null);
        },
    };

    const sugoroku = {
        id: 'sugoroku', title: 'うんどう すごろく', icon: '🎲',
        desc: 'とまった マスの うんどうを して すすむ すごろく。1まいずつ マスの ならびが かわる。',
        options: [{ key: 'special', label: 'すすむ・もどる・やすみ マスを いれる', type: 'check', def: true }],
        build(opt, rng) {
            const C = 5, R = 7, N = C * R;
            const tasks = rng.shuffle(D.SUGOROKU_TASKS);
            const special = rng.shuffle(D.SUGOROKU_SPECIAL);
            const squares = [];
            let ti = 0, si = 0;
            for (let i = 0; i < N; i++) {
                if (i === 0) squares.push(['🚩', 'スタート', 'start']);
                else if (i === N - 1) squares.push(['🏆', 'ゴール！', 'goal']);
                else if (opt.special && i % 5 === 3 && i < N - 3) squares.push([...special[si++ % special.length], 'sp']);
                else squares.push([...tasks[ti++ % tasks.length], '']);
            }
            /* ヘビの ように おりかえす */
            let cells = '';
            for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
                const i = r * C + (r % 2 ? C - 1 - c : c);
                const [em, lab, k] = squares[i];
                const last = r % 2 ? c === 0 : c === C - 1;
                const arrow = i === N - 1 ? '' : last ? '<i class="ar dn">⬇</i>' : r % 2 ? '<i class="ar lf">⬅</i>' : '<i class="ar rt">➡</i>';
                cells += `<div class="sq ${k}"><span class="no">${i === 0 || i === N - 1 ? '' : i}</span><span class="em">${em}</span><span class="lab">${esc(lab)}</span>${arrow}</div>`;
            }
            const body = `<div class="sugo" style="grid-template-columns:repeat(${C},35.5mm);grid-auto-rows:30mm">${cells}</div>`;
            return both({
                subject: 'taiiku', catchline: 'サイコロを ふって からだを うごかそう！', title: 'うんどう すごろく', icon: '🎲',
                rules: ['じゅんばんに サイコロを ふって、でた かずだけ すすもう。', 'とまった マスの うんどうを みんなで やろう！', 'さきに ゴールに ついた ひとが かち！ （ぴったり でなくても OK）'],
            }, body, null);
        },
    };

    /* ================================================================
       さくぶん（あのね にっき）・お題 いちらん
       ================================================================ */

    /** {漢字|かんじ} → ふりがな（on が false なら 漢字だけ） */
    const ruby = (s, on = true) => esc(s).replace(/\{([^|{}]+)\|([^{}]*)\}/g, (_, k, r) => on && r ? `<ruby>${k}<rt>${r}</rt></ruby>` : k);
    const plain = s => String(s).replace(/\{([^|{}]+)\|[^{}]*\}/g, '$1');
    const ALL_ODAI = K.CATEGORIES.flatMap(c => c.items.map(it => ({ ...it, cat: c })));
    const FEEL_WORDS = ['うれしい', 'たのしい', 'わくわく', 'どきどき', 'びっくり', 'ほっと した', 'くやしい', 'かなしい', 'はずかしい', 'おもしろい', 'こわい', 'がんばろう'];
    const KATA_TYPES = { diary: 'あのね（いつ・どこで・だれと）', order: 'じゅんばん', compare: 'くらべる', teach: 'おしえる', reason: 'わけ', group: 'なかま分け', ifthen: 'もしも', solve: 'かいけつ', explain: 'せつめい', senses: '5つの かんかく' };

    /** 記号の みほん（できごと・おと・セリフ・きもち） */
    function symbolLegend() {
        const sv = inner => `<svg viewBox="0 0 40 20" class="an-sym">${inner}</svg>`;
        return `<div class="an-legend">
          <span>できごと… ${sv('<rect x="3" y="3" width="34" height="14" />')}</span>
          <span>おと… ${sv('<path d="M8 15 a5 5 0 0 1 2-9 a6 6 0 0 1 11-2 a6 6 0 0 1 11 3 a4 4 0 0 1 -2 8 z" />')}</span>
          <span>セリフ… ${sv('<ellipse cx="20" cy="10" rx="17" ry="7" />')}</span>
          <span>きもち… ${sv('<path d="M20 18 C 4 9, 8 1, 20 7 C 32 1, 36 9, 20 18 z" />')}</span></div>`;
    }

    /** ① かんがえを ひろげる（まんなかに お題、まわりに ふきだし） */
    function ideaWeb(type, center, fz, R) {
        if (type === 'group') {
            const spots = [[14, 16], [42, 13], [70, 16], [88, 30], [13, 38], [88, 52], [14, 62], [86, 74], [28, 86], [54, 88], [78, 90], [40, 30]];
            return `<div class="an-web group"><div class="an-hint">${R('{思|おも}いつく ものを どんどん {書|か}こう（10〜20こ）')}</div>
              ${spots.map(([x, y]) => `<span class="an-dot" style="left:${x}%;top:${y}%"></span>`).join('')}
              <div class="an-center" style="font-size:${fz}mm">${center}</div></div>`;
        }
        const prompts = K.WEB_PROMPTS[type] || K.WEB_PROMPTS.diary;
        const pos = [[50, 11], [82, 29], [82, 71], [50, 89], [18, 71], [18, 29]];
        const lines = pos.map(([x, y]) => `<line x1="50" y1="50" x2="${x}" y2="${y}" />`).join('');
        return `<div class="an-web"><svg class="an-web-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
          ${prompts.map((p, i) => `<div class="an-bub b${i}"><small>${R(p)}</small></div>`).join('')}
          <div class="an-center" style="font-size:${fz}mm">${center}</div></div>`;
    }

    /** ② 考えを 図にする（組み立て図） */
    function organizer(type, R) {
        const rows = K.ORGANIZERS[type] || K.ORGANIZERS.diary;
        return `<div class="an-org">${rows.map((r, i) => `${i ? '<div class="an-down">▼</div>' : ''}<div class="an-orow">${r.map(b => `<div class="an-obox"><small>${R(b)}</small></div>`).join('')}</div>`).join('')}</div>`;
    }

    function genkou(wmm, hmm, cell, guide) {
        const cols = Math.max(4, Math.floor((wmm - 1) / cell)), rows = Math.max(4, Math.floor((hmm - 1) / cell));
        return `<div class="gk${guide ? ' guide' : ''}" style="grid-template-columns:repeat(${cols},${cell}mm);grid-template-rows:repeat(${rows},${cell}mm)">${'<i></i>'.repeat(cols * rows)}</div>`;
    }

    function pickOdai(opt, rng) {
        const v = opt.odai || '';
        if (!v) return null;
        if (v === 'random') return rng.pick(ALL_ODAI);
        if (v.startsWith('cat:')) return rng.pick(ALL_ODAI.filter(o => o.cat.id === v.slice(4)));
        return ALL_ODAI.find(o => o.id === v) || null;
    }

    const anone = {
        id: 'anone', title: 'あのね にっき（さくぶん）', icon: '📔',
        desc: '① かんがえを ひろげる → ② (図にする) → かいてみる → ふりかえる。お題に あわせた ヒントと たて書きの マス。',
        options: [
            { key: 'grade', label: 'かたち', type: 'select', def: 'low', choices: [['low', '1・2ねん（3ステップ）'], ['mid', '3・4ねん（4ステップ・図にする つき）']] },
            { key: 'odai', label: 'お題', type: 'select', def: '', choices: [['', 'じぶんで きめる（かく らん）'], ['random', 'くじ（ぜんぶ から）'],
                ...K.CATEGORIES.map(c => ['cat:' + c.id, `くじ：${c.id} ${plain(c.short)}`]), ...ALL_ODAI.map(o => [o.id, `${o.id} ${plain(o.text)}`])] },
            { key: 'kata', label: 'ヒントの かたち', type: 'select', def: 'auto', choices: [['auto', 'お題に あわせる'], ...Object.entries(KATA_TYPES)] },
            { key: 'masu', label: 'マスの おおきさ', type: 'select', def: 'm', choices: [['l', 'おおきい'], ['m', 'ふつう'], ['s', 'ちいさい']] },
            { key: 'guide', label: 'マスに 十字の 点線', type: 'check', def: true },
            { key: 'furi', label: 'ふりがな', type: 'check', def: true },
        ],
        build(opt, rng) {
            const mid = opt.grade === 'mid';
            const o = pickOdai(opt, rng);
            const type = opt.kata !== 'auto' && KATA_TYPES[opt.kata] ? opt.kata : o ? o.cat.type : 'diary';
            const cat = o ? o.cat : K.CATEGORIES.find(c => c.type === type) || K.CATEGORIES[0];
            const R = s => ruby(s, opt.furi);
            const odaiText = o ? R(o.text) : '';
            const odaiBox = `<div class="an-odai"><b>${R('お{題|だい}')}</b>${o ? `<span class="an-odai-t">${odaiText}</span><small class="an-id">${o.id}${o.research ? ' 📚' : ''}</small>` : '<span class="an-odai-line"></span>'}</div>`;
            const center = o ? `<span>${odaiText}</span>` : '';
            const words = `<div class="an-words"><b>つかえる ことば</b>${cat.words.map(w => `<span>${R(w)}</span>`).join('')}</div>`;
            const feel = `<div class="an-feel"><b>きもちの ことば</b>${FEEL_WORDS.map(w => `<span>${w}</span>`).join('')}</div>`;
            const wordsTsunagi = plain(cat.words.filter(w => !w.startsWith('〜')).slice(0, 2).join('・'));
            const cellL = { l: 15, m: 12, s: 10 }[opt.masu] || 12, cellM = { l: 11, m: 10, s: 9 }[opt.masu] || 10;
            const pill = (n, t) => `<div class="an-pill"><span>${n}</span><span class="t">${R(t)}</span></div>`;
            const strip = `<div class="an-strip"><div class="an-title">${mid ? R('あのね{日記|にっき}') : 'あのね にっき'}</div>
              ${mid ? '<div>（　　）' + R('{回目|かいめ}') + '</div>' : ''}<div>（　　）${R(mid ? '{月|がつ}' : 'がつ')}（　　）${R(mid ? '{日|にち}' : 'にち')}</div>
              <div>${R(mid ? '{名前|なまえ}' : 'なまえ')}（　　　　　　　　）</div></div>`;

            let body;
            if (!mid) {
                const pts = K.POINTS_LOW;
                const points = `<div class="an-points"><div class="an-ph">〈ポイント〉</div>
                    ${pts.list.map((p, i) => `<div class="an-pt">${MARU[i]}□ ${R(p)}</div>`).join('')}
                    <div class="an-sp"></div>${[...pts.special, `「${wordsTsunagi}」を つかう`].map(p => `<div class="an-pt">★□ ${R(p)}</div>`).join('')}</div>
                  <div class="an-stars"><div class="an-sh">ほしの かず</div>${pts.stars.map((s, i) => `<div>${'★'.repeat(i + 1)}…${R(s)}</div>`).join('')}</div>
                  <div class="an-starbox">${'<i></i>'.repeat(pts.stars.length)}</div>${feel}`;
                body = `<div class="an low">
                  <div class="an-col c3">${pill('③', 'ふりかえる')}${points}</div>
                  <div class="an-col c2">${pill('②', 'かいてみる')}${genkou(120, 184, cellL, opt.guide)}</div>
                  <div class="an-col c1">${pill('①', 'かんがえを ひろげる')}${odaiBox}${ideaWeb(type, center, 3.4, R)}${symbolLegend()}${words}</div>
                  ${strip}</div>`;
            } else {
                const pts = K.POINTS_MID;
                let n = 0;
                const points = `<div class="an-points mid"><div class="an-ph">【ポイント】</div>
                    ${pts.steps.map(([h, list]) => `<div class="an-step">${R(h)}</div>${list.map(p => `<div class="an-pt">□${MARU[n++]} ${R(p)}</div>`).join('')}`).join('')}
                    <div class="an-step">スペシャル</div>${[...pts.special, `「${wordsTsunagi}」を つかう`].map(p => `<div class="an-pt">□ ${R(p)}</div>`).join('')}</div>
                  <div class="an-stars"><div class="an-sh">〈${R('{結果|けっか}')}〉</div>${pts.stars.map((s, i) => `<div>☆${i + 1}こ…${R(s)}</div>`).join('')}</div>
                  <div class="an-result"></div>`;
                body = `<div class="an mid">
                  <div class="an-col c4">${pill('④', 'ふりかえる')}${points}</div>
                  <div class="an-main">
                    <div class="an-col c2">${pill('②', '{考|かんが}えを {図|ず}にする')}${organizer(type, R)}${words}</div>
                    <div class="an-col c1">${pill('①', '{考|かんが}えを {広|ひろ}げる')}${odaiBox}${ideaWeb(type, center, 2.9, R)}${symbolLegend()}</div>
                    <div class="an-col c3">${pill('③', '{書|か}いてみる')}${genkou(206, 100, cellM, opt.guide)}</div>
                  </div>
                  ${strip}</div>`;
            }
            return { page: `<section class="page subj-kokugo land">${body}</section>`, answer: null };
        },
    };

    /* ---------- お題 いちらん ---------- */
    const odaiList = {
        id: 'odailist', title: 'さくぶん お題 いちらん', icon: '📋',
        desc: 'あのね にっきの お題 200こを、10の なかま（じゅんばん・くらべる・もしも など）に わけた 一覧。ばんごうで えらべる。',
        options: [
            { key: 'mode', label: 'だれ むけ', type: 'select', def: 'child', choices: [['child', 'こども むけ（✓ らん つき）'], ['teacher', 'せんせい むけ（ねらい つき）']] },
            { key: 'cat', label: 'なかま', type: 'select', def: 'all', choices: [['all', 'ぜんぶ'], ...K.CATEGORIES.map(c => [c.id, `${c.id} ${plain(c.short)}`])] },
            { key: 'furi', label: 'ふりがな', type: 'check', def: true },
        ],
        build(opt) {
            const teacher = opt.mode === 'teacher';
            const R = s => ruby(s, opt.furi);
            const cats = opt.cat && opt.cat !== 'all' ? K.CATEGORIES.filter(c => c.id === opt.cat) : K.CATEGORIES;
            const lh = 7.1, perLine = 20;
            const lines = s => Math.max(1, Math.ceil(plain(s).length / perLine));
            /* ぎょう（見出し・ねらい・お題）に ばらして、たかさを みつもって だんに つめる */
            const rows = [];
            for (const c of cats) {
                rows.push({ h: 11, head: true, html: `<div class="ol-head" style="--cc:${c.color}"><span class="ol-id">${c.id}</span>${c.icon} ${R(c.title)}</div>` });
                if (teacher) rows.push({ h: lines(c.nerai) * (lh - .6) + 2, html: `<div class="ol-nerai">${R(c.nerai)}</div>` });
                rows.push({ h: lh + 1, html: `<div class="ol-words">つかえる ことば：${c.words.map(w => R(w)).join('・')}</div>` });
                for (const it of c.items) {
                    rows.push({ h: lines(it.text) * lh, cat: c, html: `<div class="ol-item">${teacher ? '' : '<span class="ol-ck"></span>'}<span class="ol-no">${it.id}</span><span class="ol-t">${R(it.text)}${it.research ? ' 📚' : ''}${teacher && it.new ? ' <em>ふやした</em>' : ''}</span></div>` });
                }
            }
            const cap1 = teacher ? 184 : 190, cap = 232;
            const pages = [[[]]];
            let used = 0;
            const capOf = () => (pages.length === 1 ? cap1 : cap);
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const need = r.head ? r.h + (rows[i + 1] ? rows[i + 1].h : 0) + (rows[i + 2] ? rows[i + 2].h : 0) : r.h;
                if (used + need > capOf() && used > 0) {
                    const pg = pages[pages.length - 1];
                    if (pg.length < 2) pg.push([]); else pages.push([[]]);
                    used = 0;
                    if (!r.head && r.cat) {    /* とちゅうから つづく とき */
                        const cc = r.cat;
                        pages[pages.length - 1].slice(-1)[0].push(`<div class="ol-head cont" style="--cc:${cc.color}"><span class="ol-id">${cc.id}</span>${R(cc.title)}（つづき）</div>`);
                        used += 9;
                    }
                }
                pages[pages.length - 1].slice(-1)[0].push(r.html);
                used += r.h;
            }
            const howto = teacher
                ? `<div class="rules"><b class="rules-h">${R('お{題|だい}を えらぶ 3つの きまり')}</b><ol>${K.RULES_OF_ODAI.map((r, i) => `<li><span class="rn">${MARU[i]}</span><span>${R(r)}</span></li>`).join('')}</ol></div>`
                : '';
            const out = pages.map((cols, pi) => page({
                subject: 'kokugo', catchline: pi ? `つづき（${pi + 1}まいめ）` : 'かきたい お題を えらぼう！', title: 'さくぶん お題 いちらん', icon: '📋',
                rules: pi || teacher ? null : ['すきな お{題|だい}を えらんで、あのね にっきに {書|か}こう。', 'ばんごう（A1 など）を せんせいに つたえよう。', '{書|か}いた お{題|だい}には □に ✓ を つけよう。'].map(R),
                body: (pi ? '' : howto) + `<div class="ol-cols">${cols.map(c => `<div class="ol-col">${c.join('')}</div>`).join('')}</div>`,
            }));
            return { page: out.join(''), answer: null };
        },
    };

    /* ---------- ならび ---------- */

    const SHEETS = { kaidan, storymaze: storyMaze, wordsearch: wordSearch, kanjiadd: kanjiAdd, anagram, headquiz: headQuiz, acrostic, dicestory: diceStory,
        calcmaze: calcMaze, magic, pyramid, sudoku, symbols: symbolSearch, dotcopy: dotCopy, diffs, halfpic: halfPic, doodle, bingo, feelings, sugoroku, anone, odailist: odaiList };

    /** メニュー（id は URL に のる ので かえない） */
    const CATALOG = [
        { id: 'kaidan', sheet: 'kaidan', subject: 'kokugo' },
        { id: 'storymaze', sheet: 'storymaze', subject: 'kokugo' },
        { id: 'wordsearch', sheet: 'wordsearch', subject: 'kokugo' },
        { id: 'headquiz', sheet: 'headquiz', subject: 'kokugo' },
        { id: 'anagram', sheet: 'anagram', subject: 'kokugo' },
        { id: 'kanjiadd', sheet: 'kanjiadd', subject: 'kokugo' },
        { id: 'acrostic', sheet: 'acrostic', subject: 'kokugo' },
        { id: 'dicestory', sheet: 'dicestory', subject: 'kokugo' },
        { id: 'anone', sheet: 'anone', subject: 'kokugo', title: 'あのね にっき（1・2ねん）', desc: '① かんがえを ひろげる → ② かいてみる → ③ ふりかえる。お題に あわせた ヒントと たて書きの マス。' },
        { id: 'anone-mid', sheet: 'anone', subject: 'kokugo', title: 'あのね日記（3・4ねん）', desc: '① 考えを広げる → ② 図にする → ③ 書いてみる → ④ ふりかえる。お題の なかまごとに 組み立て図が かわる。', defaults: { grade: 'mid', guide: false } },
        { id: 'odailist', sheet: 'odailist', subject: 'kokugo' },
        { id: 'calcmaze', sheet: 'calcmaze', subject: 'sansu' },
        { id: 'pyramid', sheet: 'pyramid', subject: 'sansu' },
        { id: 'magic', sheet: 'magic', subject: 'sansu' },
        { id: 'sudoku', sheet: 'sudoku', subject: 'sansu' },
        { id: 'bingo-tanken', sheet: 'bingo', subject: 'seikatsu', title: 'たんけん ビンゴ', icon: '🏫', desc: 'がっこう・まち たんけんで みつけた ものに まる。ひとり ずつ ならびが ちがう。', defaults: { theme: 'gakkou' } },
        { id: 'bingo-kisetsu', sheet: 'bingo', subject: 'seikatsu', title: 'きせつ みつけ ビンゴ', icon: '🍁', desc: 'はる・なつ・あき・ふゆの しぜんを さがして ビンゴ。', defaults: { theme: 'aki' } },
        { id: 'bingo-otetsudai', sheet: 'bingo', subject: 'seikatsu', title: 'おてつだい ビンゴ', icon: '🧺', desc: 'おうちの おてつだいで ビンゴ。ながやすみの しゅくだいにも。', defaults: { theme: 'otetsudai', size: '4' } },
        { id: 'bingo-yasashisa', sheet: 'bingo', subject: 'dotoku', title: 'やさしさ ミッション ビンゴ', icon: '💖', desc: 'あいさつ・ありがとう・てつだう…。1しゅうかんの やさしさ ミッション。', defaults: { theme: 'yasashisa', size: '4' } },
        { id: 'bingo-arigatou', sheet: 'bingo', subject: 'dotoku', title: 'ありがとう さがし ビンゴ', icon: '🌼', desc: 'ささえて くれる ひとを さがして「ありがとう」を つたえよう。', defaults: { theme: 'arigatou' } },
        { id: 'feelings', sheet: 'feelings', subject: 'dotoku' },
        { id: 'sugoroku', sheet: 'sugoroku', subject: 'taiiku' },
        { id: 'bingo-undou', sheet: 'bingo', subject: 'taiiku', title: 'うんどう ビンゴ', icon: '🤸', desc: 'ジャンプ・ケンケン・くまあるき…。できた うんどうで ビンゴ。', defaults: { theme: 'undou', size: '4' } },
        { id: 'halfpic', sheet: 'halfpic', subject: 'zuko' },
        { id: 'doodle', sheet: 'doodle', subject: 'zuko' },
        { id: 'dicestory-zuko', sheet: 'dicestory', subject: 'zuko', title: 'へんてこ ぶんと え', icon: '🎲' },
        { id: 'symbols', sheet: 'symbols', subject: 'cog' },
        { id: 'dotcopy', sheet: 'dotcopy', subject: 'cog' },
        { id: 'dotmirror', sheet: 'dotcopy', subject: 'cog', title: 'かがみ てんつなぎ', icon: '🪞', desc: 'おてほんを かがみに うつした かたちを かく。さゆうの かんかくを きたえる。', defaults: { mode: 'mirror' } },
        { id: 'diffs', sheet: 'diffs', subject: 'cog' },
        { id: 'halfpic-cog', sheet: 'halfpic', subject: 'cog', title: 'かがみ ぬりえ', icon: '🦋', desc: 'はんぶんの えを かがみの ように ぬる。「うつす」「そうぞう する」ちから。', defaults: { pic: 'shape', color: false } },
    ].map(c => {
        const s = SHEETS[c.sheet];
        return { title: s.title, icon: s.icon, desc: s.desc, defaults: {}, ...c };
    });

    /** せっていの はじめの あたい ＋ メニューの きまり ＋ opt */
    function resolveOptions(entry, opt) {
        const s = SHEETS[entry.sheet], out = {};
        for (const o of s.options) out[o.key] = o.def;
        Object.assign(out, entry.defaults);
        for (const o of s.options) {
            if (!opt || !(o.key in opt)) continue;
            const v = opt[o.key];
            if (o.type === 'check') out[o.key] = v === true || v === '1' || v === 'true';
            else if (o.type === 'select') { if (o.choices.some(([k]) => String(k) === String(v))) out[o.key] = String(v); }
            else out[o.key] = String(v).slice(0, 12);
        }
        return out;
    }

    /** 1まい つくる。subject は メニューの ものに そろえる */
    function buildSheet(entry, opt, seed) {
        const s = SHEETS[entry.sheet];
        const rng = G.makeRng(seed);
        const r = s.build(resolveOptions(entry, opt), rng);
        const fix = h => h && h.replace(/class="page subj-\w+/g, `class="page subj-${entry.subject}`).replace(/<span class="subj-badge">[^<]*<\/span>/g, `<span class="subj-badge">${SUBJECTS[entry.subject].icon} ${SUBJECTS[entry.subject].label}</span>`);
        return { page: fix(r.page), answer: fix(r.answer) };
    }

    const api = { SUBJECTS, SHEETS, CATALOG, resolveOptions, buildSheet, esc };
    root.PurintoSheets = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
