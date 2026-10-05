/* たのしい プリント ── げんこうようしの きまり（たて書きの マスに ならべる）
   ------------------------------------------------------------------
   「げんこうようし まちがい さがし」「げんこうようしに うつそう」「書いたら たしかめ カード」で つかいます。
   マスに ならべる きまり（いちばん 上の ぶぶん）は genkou-renshuu/index.html の ものと おなじです
   （フォルダーの 中だけで うごくように、ここにも おいて います。かえる ときは 両方 かえて ください）。
   ------------------------------------------------------------------ */
/* ===== げんこうようしの きまり（画面を つかわない ぶぶん） =====
   文章を 1字ずつに わけ、たて書きの 原稿用紙の マスに ならべます。
   2年生で ならう きまりだけを あつかいます。
     ・だんらくの はじめは 1マス あける
     ・かいわ（「 」）は 行を かえて 1マス目から。かいわの あとも 行を かえる
     ・「。」「、」「」」は 行の いちばん 上に 書かない（まえの 行の さいごの マスに いっしょに）
     ・「。」」は 1マスに いっしょに
     ・だいめいは 上を 2マス あける／なまえは 2行目の 下（下を 1マス あける）
   mut（わざと まちがえる）を わたすと、クイズや まちがいさがしの「まちがった 書き方」を つくれます。 */
(function (root) {
    'use strict';

    const NO_START = '。、」』）！？';
    const SMALL = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ';
    const ENDS = '。！？';
    const chars = s => Array.from(String(s == null ? '' : s));
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    /* ---------- 文章を わける ----------
       doc = { title, body }  body は 1行＝1だんらく（\n で 区切る）。空白は とる。
       もどり値 { units:[{c, role, p, s, k}], segs:[{kind, p, u:[]}] }
         kind … head（だんらくの はじめ）／ dlg（かいわ）／ after（かいわの あとの 文） */
    function parse(doc) {
        const units = [], segs = [];
        chars(doc.title).filter(c => !/\s/.test(c)).forEach((c, k) => units.push({ c, role: 'title', p: -1, s: -1, k }));
        const paras = String(doc.body || '').replace(/\r\n?/g, '\n').split('\n')
            .map(s => s.replace(/[ 　\t]/g, '')).filter(Boolean);
        paras.forEach((ps, p) => {
            const cs = chars(ps);
            let seg = null, inDlg = false, after = false;
            const start = kind => { seg = { kind, p, u: [] }; segs.push(seg); };
            cs.forEach((c, k) => {
                const prev = k ? cs[k - 1] : '';
                if (k === 0) start(c === '「' ? 'dlg' : 'head');
                else if (c === '「' && (ENDS.includes(prev) || after)) start('dlg');
                else if (after) start('after');
                if (k === 0 || seg.u.length === 0) inDlg = seg.kind === 'dlg';
                after = false;
                units.push({ c, role: 'body', p, s: segs.length - 1, k: seg.u.length });
                seg.u.push(units.length - 1);
                if (c === '」' && inDlg) { inDlg = false; after = true; }
            });
        });
        return { units, segs };
    }

    const has = (set, v) => !!(set && set.has(v));

    /* ---------- マスに ならべる ----------
       N   … 1行の マスの かず
       opt … { name:'やまだ はなこ', titleIndent:2, mut:{…} }
       mut … わざと まちがえる ところ（どれも unit の ばんごう か だんらくの ばんごう の Set）
         noIndent（だんらく）／ bigIndent（だんらく）／ joinDlg（かいわの「）／ joinAfter（かいわの あとの 1字め）
         noHang（行の 上に 来た「。」を まえへ 入れない）／ splitKakko（「。」」を わける ときの 」）
         cram（まえの マスに つめこむ 字）／ blankAfter（この 字の あとに あきマス）
         titleIndent（かず）／ nameTop（true）／ style（Map: unit → 'center' | 'bl' | 'plain'）
       もどり値 [{ role:'title'|'name'|'body', cells:[null | {t, us:[unit], hang, blank, v}] }]   右の 行から じゅんに */
    function layout(P, N, opt) {
        opt = opt || {};
        const m = opt.mut || {};
        const cols = [];
        const addCol = role => { const c = { role, cells: new Array(N).fill(null) }; cols.push(c); return c; };
        const mk = us => ({ t: us.map(i => P.units[i].c).join(''), us: us.slice(), v: m.style ? m.style.get(us[0]) || '' : '' });

        /* だいめい */
        const tu = P.units.map((u, i) => i).filter(i => P.units[i].role === 'title');
        if (tu.length) {
            const ind = Math.min(N - 1, m.titleIndent != null ? m.titleIndent : opt.titleIndent != null ? opt.titleIndent : 2);
            let col = addCol('title'), pos = ind;
            for (const i of tu) {
                if (pos >= N) { col = addCol('title'); pos = ind; }
                col.cells[pos++] = mk([i]);
            }
        }
        /* なまえ（みょうじと なまえの あいだは 1マス、下は 1マス あける） */
        if (opt.name) {
            const seq = [];
            String(opt.name).split(/[\s　]+/).filter(Boolean).forEach((pt, k) => { if (k) seq.push(null); chars(pt).forEach(c => seq.push(c)); });
            const col = addCol('name');
            const st = m.nameTop ? 0 : Math.max(0, N - 1 - seq.length);
            seq.forEach((c, k) => { if (c && st + k < N) col.cells[st + k] = { t: c, us: [], name: true, v: '' }; });
        }

        /* 本文 */
        let cur = null, pos = N;
        const newCol = () => { cur = addCol('body'); pos = 0; };
        const lastCell = () => {
            for (let ci = cols.length - 1; ci >= 0 && cols[ci].role === 'body'; ci--) {
                const cc = cols[ci].cells;
                for (let r = N - 1; r >= 0; r--) if (cc[r] && !cc[r].blank) return cc[r];
            }
            return null;
        };
        for (const seg of P.segs) {
            const join = cur && ((seg.kind === 'dlg' && has(m.joinDlg, seg.u[0])) || (seg.kind === 'after' && has(m.joinAfter, seg.u[0])));
            if (!join) {
                newCol();
                let ind = seg.kind === 'head' ? 1 : 0;
                if (seg.kind === 'head' && has(m.noIndent, seg.p)) ind = 0;
                if (seg.kind === 'head' && has(m.bigIndent, seg.p)) ind = 2;
                pos = Math.min(ind, N - 1);
            }
            const items = [];
            for (let k = 0; k < seg.u.length; k++) {
                const i = seg.u[k], nx = seg.u[k + 1];
                if ((P.units[i].c === '。' || P.units[i].c === '、') && nx != null && P.units[nx].c === '」' && !has(m.splitKakko, nx)) { items.push([i, nx]); k++; }
                else items.push([i]);
                if (has(m.blankAfter, items[items.length - 1].slice(-1)[0])) items.push(null);
            }
            for (const it of items) {
                if (it === null) { if (pos >= N) newCol(); cur.cells[pos++] = { t: '', us: [], blank: true, v: '' }; continue; }
                if (has(m.cram, it[0])) {
                    const prev = lastCell();
                    if (prev) { prev.t += mk(it).t; prev.us.push(...it); prev.hang = true; continue; }
                }
                if (pos >= N) {
                    const prev = cur.cells[N - 1];
                    const t = mk(it).t;
                    if (prev && !prev.blank && NO_START.includes(chars(t)[0]) && !it.some(i => has(m.noHang, i)) && chars(prev.t).length + chars(t).length <= 3) {
                        prev.t += t; prev.us.push(...it); prev.hang = true; continue;
                    }
                    newCol();
                }
                cur.cells[pos++] = mk(it);
            }
        }
        return cols;
    }

    /** unit の ある マス（{c, r, k:マスの 中で なんばんめ, cell}） */
    function where(cols, i) {
        for (let c = 0; c < cols.length; c++) {
            const cc = cols[c].cells;
            for (let r = 0; r < cc.length; r++) {
                if (cc[r] && cc[r].us) { const k = cc[r].us.indexOf(i); if (k >= 0) return { c, r, k, cell: cc[r] }; }
            }
        }
        return null;
    }

    /** 1行を 文字に（たしかめ用）。␣＝あきマス、{ }＝1マスに 2字いじょう */
    function colStr(col) {
        return col.cells.map(x => !x || !x.t ? '␣' : chars(x.t).length > 1 ? '{' + x.t + '}' : x.t).join('');
    }

    /* ---------- 子どもが ならべた マスを しらべる ----------
       actions … 'put'（かく）／ 'together'（まえの マスに いっしょに）／ 'blank'（1マス あける）／ 'newline'（行を かえる）
       replay で マスに もどし、check で きまりに あって いるかを 1字ずつ しらべます。 */
    function replay(P, N, actions) {
        const cols = [{ role: 'body', cells: new Array(N).fill(null) }];
        let col = 0, row = 0, next = 0, last = null;
        const ensure = () => { while (cols.length <= col) cols.push({ role: 'body', cells: new Array(N).fill(null) }); };
        for (const a of actions) {
            if (a === 'put') {
                if (next >= P.units.length) continue;
                if (row >= N) { col++; row = 0; ensure(); }
                last = { t: P.units[next].c, us: [next], v: '' };
                cols[col].cells[row++] = last;
                next++;
            } else if (a === 'together') {
                if (next >= P.units.length || !last) continue;
                last.t += P.units[next].c; last.us.push(next); last.hang = true;
                next++;
            } else if (a === 'blank') {
                if (row >= N) { col++; row = 0; ensure(); }
                row++;
            } else if (a === 'newline') {
                col++; row = 0; ensure();
            }
        }
        return { cols, col, row, next, last, done: next >= P.units.length };
    }

    const MSG = {
        'title-line': 'だいめいは 1行目に 書こう。',
        'title-indent': 'だいめいは 上を 2マス あけて 書こう。',
        'dan-line': 'あたらしい だんらくは、行を かえて 書こう。',
        'dan-indent': 'だんらくの はじめは、1マス あけよう。',
        'dan-many': 'あけるのは 1マスだけ だよ。',
        'kaiwa-line': 'かいわ（「　」）は、行を かえて 書こう。',
        'kaiwa-top': 'かいわの「は、行の いちばん 上の マスから 書こう。',
        'after-line': 'かいわの あとの 文は、行を かえて 書こう。',
        'after-top': 'かいわの あとの 文は、行の いちばん 上の マスから 書こう。',
        'gyoto': '「。」や「、」は 行の いちばん 上に 書かないよ。まえの 行の さいごの マスに いっしょに 書こう。',
        'kakko': '「。」」は 1つの マスに いっしょに 書こう。',
        'together': '1つの マスには 1字ずつ 書こう。',
        'small-together': '小さい「っ」「ゃ」「ゅ」「ょ」も、1マス つかって 書こう。',
        'space': 'ことばの あいだは あけないで、つづけて 書こう。',
        'newline': 'ここでは 行を かえないで、つづけて 書こう。',
    };
    /* まちがいの しゅるい → クイズの きまり */
    const MSG_RULE = {
        'title-line': 'daimei', 'title-indent': 'daimei', 'dan-line': 'dan', 'dan-indent': 'dan', 'dan-many': 'dan',
        'kaiwa-line': 'kaiwa', 'kaiwa-top': 'kaiwa', 'after-line': 'kaiwa', 'after-top': 'kaiwa',
        'gyoto': 'gyoto', 'kakko': 'kakko', 'together': 'chiisai', 'small-together': 'chiisai', 'space': 'dan', 'newline': 'dan',
    };

    /** 1字ずつ しらべる。opt.titleRows … だいめいの 1字めを 書いて よい マス（はじめ [2,3]）
        opt.only … この unit だけ しらべる（ヒント用）
        もどり値 [{u, code, c, r}] */
    function check(P, cols, N, opt) {
        opt = opt || {};
        const titleRows = opt.titleRows || [2, 3];
        const W = new Array(P.units.length).fill(null);
        cols.forEach((col, c) => col.cells.forEach((cell, r) => {
            if (cell && cell.us) cell.us.forEach((u, k) => { W[u] = { c, r, k, cell }; });
        }));
        const errs = [];
        for (let i = 0; i < P.units.length; i++) {
            if (opt.only != null && i !== opt.only) continue;
            const w = W[i];
            if (!w) continue;
            const U = P.units[i], pw = i ? W[i - 1] : null, PU = i ? P.units[i - 1] : null;
            const add = code => errs.push({ u: i, code, c: w.c, r: w.r });

            /* だいめい */
            if (U.role === 'title') {
                if (U.k === 0) {
                    if (w.k > 0 || w.c !== 0) add('title-line');
                    else if (!titleRows.includes(w.r)) add('title-indent');
                } else if (w.k > 0) add('together');
                else if (w.c !== pw.c || w.r !== pw.r + 1) add(w.c !== pw.c ? 'newline' : 'space');
                continue;
            }

            /* だんらく・かいわの はじめの 字 */
            if (U.k === 0) {
                const kind = P.segs[U.s].kind;
                const lineCode = { head: 'dan-line', dlg: 'kaiwa-line', after: 'after-line' }[kind];
                if (w.k > 0 || (pw && w.c <= pw.c)) { add(lineCode); continue; }
                if (kind === 'head') { if (w.r === 0) add('dan-indent'); else if (w.r > 1) add('dan-many'); }
                else if (w.r !== 0) add(kind === 'dlg' ? 'kaiwa-top' : 'after-top');
                continue;
            }

            /* つづきの 字 */
            if (w.k > 0) {   // まえの 字と おなじ マスに 入って いる
                const kakko = U.c === '」' && '。、'.includes(PU.c) && pw.cell === w.cell;
                const hang = NO_START.includes(U.c) && w.r === N - 1 && chars(w.cell.t).length <= 3;
                if (!kakko && !hang) add(SMALL.includes(U.c) ? 'small-together' : 'together');
                continue;
            }
            if (U.c === '」' && '。、'.includes(PU.c)) { add('kakko'); continue; }
            if (NO_START.includes(U.c) && w.r === 0) { add('gyoto'); continue; }
            if (w.c === pw.c) { if (w.r !== pw.r + 1) add('space'); continue; }
            if (w.c === pw.c + 1 && pw.r === N - 1) { if (w.r !== 0) add('space'); continue; }
            add('newline');
        }
        return errs;
    }

    /** つぎに どう すれば よいか（ヒント）。あう ものが なければ null */
    const HINT_TRIES = [['put'], ['together'], ['newline', 'put'], ['newline', 'blank', 'put'], ['blank', 'put'],
        ['blank', 'blank', 'put'], ['blank', 'blank', 'blank', 'put'], ['newline', 'blank', 'blank', 'put']];
    function hint(P, N, actions, opt) {
        const st = replay(P, N, actions);
        if (st.done) return null;
        for (const tr of HINT_TRIES) {
            const r = replay(P, N, actions.concat(tr));
            if (r.next !== st.next + 1) continue;
            if (check(P, r.cols, N, Object.assign({}, opt, { only: st.next })).length === 0) return tr;
        }
        return null;
    }

    /** おてほんどおりに ならべる 手じゅん（たしかめ用・こたえ用） */
    function solve(P, N, opt) {
        let acts = [];
        for (let i = 0; i < P.units.length; i++) {
            const h = hint(P, N, acts, opt);
            if (!h) return null;
            acts = acts.concat(h);
        }
        return acts;
    }

    /* ---------- マスの 中の 字（HTML） ---------- */
    function charClass(c, v) {
        if (v === 'plain' || v === 'big') return '';
        if (v === 'plainKagi' && '「」'.includes(c)) return '';
        if (v === 'center') return 'g-c';
        if (v === 'bl') return 'g-bl';
        if ('「『'.includes(c)) return 'g-rot g-ro';
        if ('」』'.includes(c)) return 'g-rot g-rc';
        if ('ー〜…—'.includes(c)) return 'g-rot';
        if ('。、'.includes(c)) return 'g-tr';
        if (SMALL.includes(c)) return 'g-sk';
        return '';
    }
    const BIG = { 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ッ': 'ツ', 'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ' };
    function cellInner(cell) {
        if (!cell || !cell.t) return '';
        const cs = chars(cell.t).map(c => cell.v === 'big' ? BIG[c] || c : c);
        const sp = (c, more) => { const k = [charClass(c, cell.v), more].filter(Boolean).join(' '); return `<span${k ? ` class="${k}"` : ''}>${esc(c)}</span>`; };
        if (cs.length === 1) return sp(cs[0]);
        if (NO_START.includes(cs[0])) return `<span class="g-stack">${cs.map(c => sp(c)).join('')}</span>`;
        return sp(cs[0], 'g-main') + `<span class="g-tail">${cs.slice(1).map(c => sp(c)).join('')}</span>`;
    }
    /** 原稿用紙（行は 右から 左へ）。o.mark … {'c,r': 'クラス'}、o.badge … {'c,r': '①'}、o.tap … data-c / data-r を つける */
    function gridHtml(cols, N, o) {
        o = o || {};
        const mark = o.mark || {}, badge = o.badge || {};
        return `<div class="g-grid${o.cls ? ' ' + o.cls : ''}">${cols.map((col, c) => `<div class="g-col${col.role ? ' g-' + col.role : ''}">${
            Array.from({ length: N }, (_, r) => {
                const cell = col.cells[r];
                const k = ['g-cell', mark[c + ',' + r] || '', cell && cell.hang ? 'g-hang' : ''].filter(Boolean).join(' ');
                const b = badge[c + ',' + r] ? `<b class="g-badge">${esc(badge[c + ',' + r])}</b>` : '';
                return `<div class="${k}"${o.tap ? ` data-c="${c}" data-r="${r}"` : ''}>${cellInner(cell)}${b}</div>`;
            }).join('')}</div>`).join('')}</div>`;
    }

    const api = { NO_START, SMALL, chars, esc, parse, layout, where, colStr, replay, check, hint, solve, MSG, MSG_RULE, charClass, cellInner, gridHtml };
    root.GenkouRules = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== プリント用：おてほんの 文・まちがい さがし・たしかめ カード ===== */
(function (root) {
    'use strict';
    const G = root.GenkouRules;

    /* おてほんの 文（genkou-renshuu と おなじ もの）。1行＝1だんらく、かいわは そのまま つづけて 書く */
    const TEXTS = [
        { id: 'asagao', title: 'あさがお', body: 'なつやすみに、あさがおの花がさきました。むらさき色の大きな花です。\nつぎの日は、三つもさきました。とてもうれしかったです。' },
        { id: 'zarigani', title: 'ザリガニ', body: '学校のちかくの池で、ザリガニを見つけました。せなかは赤くて、はさみが大きかったです。\nそっとつかまえて、水そうに入れました。毎日、えさをあげています。' },
        { id: 'tomato', title: 'ミニトマト', body: 'ミニトマトの実が、みどり色から赤色にかわりました。さわってみると、つるつるしていました。\nあしたは、たくさんとれるといいな。' },
        { id: 'onigokko', title: 'おにごっこ', body: '中休みに、ともだちとおにごっこをしました。わたしはおにになって、いっしょうけんめい走りました。\nさいごに、ゆうきさんをつかまえました。チャイムがなるまで、たくさんあそびました。' },
        { id: 'kyushoku', title: 'きゅうしょく', body: 'きょうのきゅうしょくは、カレーライスでした。ぼくの大すきなメニューです。\nおかわりをして、ぜんぶたべました。' },
        { id: 'neko', title: 'ねこのミー', body: 'わたしのいえには、ミーというねこがいます。ミーは、ひなたでねるのが大すきです。\nきのう、ボールであそんであげました。ミーは、いっしょうけんめいおいかけていました。' },
        { id: 'pool', title: 'プール', body: 'なつやすみに、プールへ行きました。はじめは、水がつめたくてびっくりしました。\nけのびのれんしゅうをしました。すこしだけ、とおくまですすめるようになりました。' },
        { id: 'otsukai', title: 'おつかい', body: '日よう日に、はじめておつかいに行きました。「にんじんを三本ください。」と、お店の人に言いました。\n「えらいね。」と、ほめてもらいました。とてもうれしかったです。' },
        { id: 'ame', title: '雨の日', body: 'あさから、雨がふっていました。「長ぐつをはいて行きなさい。」と、お母さんが言いました。\n水たまりを、ぴちゃぴちゃあるいて学校へ行きました。' },
        { id: 'ochiba', title: 'おちば', body: 'こうえんで、赤や黄色のおちばをひろいました。\n「きれいだね。」と、ともだちが言いました。\nわたしは、いちばん大きなはっぱを、本にはさんで帰りました。' },
        { id: 'tosho', title: 'としょかん', body: 'としょかんで、きょうりゅうの本をかりました。「この本、おもしろそう。」と、ともだちが言いました。\nいっしょに、さいごまでよみました。' },
        { id: 'undokai', title: 'うんどうかい', body: 'うんどうかいで、つなひきをしました。「がんばれ。」「まけるな。」と、みんなでこえを出しました。\nさいごは、赤ぐみがかちました。みんなで、ばんざいをしました。' },
    ];

    const NAMES = ['やまだ はなこ', 'たなか けん', 'すずき ゆい', 'さとう りく', 'こばやし あい', 'いとう そら'];

    /* まちがいの しゅるい（こたえに 出す ことば） */
    const MISTAKE_TEXT = {
        title: 'だいめいは、上を 2〜3マス あけて 書く。',
        name: 'なまえは、2行目の 下の ほうに 書く。',
        dan: 'だんらくの はじめは、1マス あける。',
        danMany: 'だんらくの はじめに あけるのは、1マスだけ。',
        gyoto: '「。」「、」は 行の いちばん 上に 書かない。まえの 行の さいごの マスに いっしょに 書く。',
        kakko: '「。」」は、1つの マスに いっしょに 書く。',
        kaiwa: 'かいわは、行を かえて 1マス目から 書く。',
        after: 'かいわの あとの 文は、行を かえて 書く。',
        space: 'ことばの あいだは あけない。',
        kuten: '「。」「、」は、マスの 右上に 書く。',
        chiisai: '小さい「っ」「ゃ」「ゅ」「ょ」も 1マス つかう。',
        nobasu: 'たて書きの「ー」は、たての ぼうで 書く。',
    };

    const add = (m, k, v) => { (m[k] = m[k] || new Set()).add(v); };
    const merge = list => {
        const m = { style: new Map() };
        for (const c of list) c.apply(m);
        return m;
    };
    const sig = cols => cols.map(c => c.cells.map(x => x ? x.t + '/' + (x.v || '') : '_').join('')).join('|');

    /** まちがえられる ところを ぜんぶ さがす */
    function candidates(P, N, base, opt) {
        const out = [];
        const U = P.units;
        if (U.some(u => u.role === 'title')) out.push({ type: 'title', u: 0, apply: m => { m.titleIndent = 0; } });
        if (opt.name) out.push({ type: 'name', u: -1, apply: m => { m.nameTop = true; } });
        P.segs.forEach(seg => {
            const i = seg.u[0];
            if (seg.kind === 'head') {
                out.push({ type: 'dan', u: i, apply: m => add(m, 'noIndent', seg.p) });
                out.push({ type: 'danMany', u: i, apply: m => add(m, 'bigIndent', seg.p) });
            }
            if (seg.kind === 'dlg' && U[i].k === 0 && P.segs.indexOf(seg) > 0 && P.segs[P.segs.indexOf(seg) - 1].p === seg.p)
                out.push({ type: 'kaiwa', u: i, apply: m => add(m, 'joinDlg', i) });
            if (seg.kind === 'after') out.push({ type: 'after', u: i, apply: m => add(m, 'joinAfter', i) });
        });
        base.forEach(col => col.cells.forEach(cell => {
            if (cell && cell.hang && cell.us.length > 1) { const i = cell.us[1]; out.push({ type: 'gyoto', u: i, apply: m => add(m, 'noHang', i) }); }
        }));
        U.forEach((u, i) => {
            if (u.role !== 'body') return;
            const nx = U[i + 1];
            if (u.c === '」' && i && '。、'.includes(U[i - 1].c)) out.push({ type: 'kakko', u: i, apply: m => add(m, 'splitKakko', i) });
            /* ことばの あいだを あけて しまう（「を」の あと・ひらがなと 漢字の さかい） */
            const kanji = c => /[\u4e00-\u9fff]/.test(c), hira = c => /[\u3041-\u3096]/.test(c);
            if (nx && nx.s === u.s && u.k > 0 && !G.NO_START.includes(nx.c) && !G.SMALL.includes(nx.c) && nx.c !== 'ー' && (u.c === 'を' || (hira(u.c) && kanji(nx.c))))
                out.push({ type: 'space', u: i, apply: m => add(m, 'blankAfter', i) });
            if ('。、'.includes(u.c) && !(nx && nx.c === '」')) out.push({ type: 'kuten', u: i, apply: m => { m.style.set(i, (i % 2) ? 'center' : 'bl'); } });
            if (G.SMALL.includes(u.c) && u.k > 0) out.push({ type: 'chiisai', u: i, apply: m => add(m, 'cram', i) });
            if (u.c === 'ー') out.push({ type: 'nobasu', u: i, apply: m => { m.style.set(i, 'plain'); } });
        });
        return out;
    }

    /** まちがいの マス（行・マス）。見つからなければ null */
    function locate(cols, N, c, P) {
        if (c.type === 'name') {
            const ci = cols.findIndex(col => col.role === 'name');
            const r = ci >= 0 ? cols[ci].cells.findIndex(Boolean) : -1;
            return r >= 0 ? { c: ci, r } : null;
        }
        const w = G.where(cols, c.u);
        if (!w) return null;
        if (c.type === 'space') {
            const at = w.r + 1 < N ? { c: w.c, r: w.r + 1 } : { c: w.c + 1, r: 0 };
            const cell = cols[at.c] && cols[at.c].cells[at.r];
            return cell && cell.blank ? at : null;
        }
        return { c: w.c, r: w.r };
    }

    /** まちがい さがしを つくる。n … まちがいの かず。
        もどり値 { cols, items:[{type, c, r, text}] } （items は 右の 行から じゅんに） */
    function makeMistakes(doc, N, n, rng, opt) {
        opt = opt || {};
        const P = G.parse(doc);
        const lopt = { name: opt.name, titleIndent: opt.titleIndent || 2 };
        const base = G.layout(P, N, lopt);
        const pool = rng.shuffle(candidates(P, N, base, opt));
        /* いろいろな しゅるいが 出るように、まず 1しゅるい 1つずつ */
        const order = [], seen = new Set();
        for (const c of pool) if (!seen.has(c.type) && !(c.type === 'danMany' && seen.has('dan')) && !(c.type === 'dan' && seen.has('danMany'))) { seen.add(c.type); order.push(c); }
        for (const c of pool) if (!order.includes(c)) order.push(c);
        const chosen = [];
        const usedU = new Set();
        for (const c of order) {
            if (chosen.length >= n) break;
            if (usedU.has(c.u) || usedU.has(c.u - 1) || usedU.has(c.u + 1)) continue;
            if (chosen.some(x => x.type === c.type) && chosen.length < Math.min(n, seen.size)) continue;
            const trial = chosen.concat([c]);
            const cols = G.layout(P, N, Object.assign({ mut: merge(trial) }, lopt));
            /* どの まちがいも ちゃんと 見える（1つ はずすと 形が かわる）か */
            const ok = trial.every((x, k) => sig(G.layout(P, N, Object.assign({ mut: merge(trial.filter((_, j) => j !== k)) }, lopt))) !== sig(cols))
                && trial.every(x => locate(cols, N, x, P));
            if (!ok) continue;
            chosen.push(c);
            usedU.add(c.u);
        }
        const cols = G.layout(P, N, Object.assign({ mut: merge(chosen) }, lopt));
        const items = chosen.map(c => Object.assign({ type: c.type, text: MISTAKE_TEXT[c.type] }, locate(cols, N, c, P)))
            .sort((a, b) => a.c - b.c || a.r - b.r);
        return { cols, items, answer: base };
    }

    /* 書いたら たしかめ カードの こうもく（kaiwa … かいわの ある 作文だけ） */
    const CHECK_ITEMS = [
        { id: 'daimei', text: 'だいめいは、上を 2〜3マス あけて 書いた。' },
        { id: 'namae', text: 'なまえは、2行目の 下の ほうに 書いた。' },
        { id: 'dan', text: 'だんらくの はじめは、1マス あけた。' },
        { id: 'kuten', text: '「。」「、」は、マスの 右上に 書いた。' },
        { id: 'gyoto', text: '行の いちばん 上に「。」「、」を 書いて いない。' },
        { id: 'chiisai', text: '小さい「っ」「ゃ」「ゅ」「ょ」も 1マス つかった。' },
        { id: 'kaiwa', kaiwa: true, text: 'かいわは、行を かえて 1マス目から 書いた。' },
        { id: 'kakko', kaiwa: true, text: '「。」」は、1つの マスに いっしょに 書いた。' },
        { id: 'after', kaiwa: true, text: 'かいわの あとの 文も、行を かえて 書いた。' },
    ];

    /** たしかめ カードの 小さい おてほん（ただしい 書き方） */
    function checkExample(id) {
        const L = (body, N, o) => ({ cols: G.layout(G.parse(Object.assign({ body }, o && o.doc)), N, o && o.opt), N });
        switch (id) {
            case 'daimei': return L('', 6, { doc: { title: 'あさ' } });
            case 'namae': { const g = L('', 6, { opt: { name: 'やま はな' } }); return g; }
            case 'dan': return L('あめだ。', 5);
            case 'kuten': return L('あさ、', 4);
            case 'gyoto': return L('ねこだ。', 4);
            case 'chiisai': return L('きって', 4);
            case 'kaiwa': return L('あさだ。「おはよう。」', 6);
            case 'kakko': return L('「はい。」', 4);
            case 'after': return L('「はい。」と言った。', 5);
        }
        return null;
    }

    const api = { G, TEXTS, NAMES, MISTAKE_TEXT, candidates, makeMistakes, CHECK_ITEMS, checkExample };
    root.PurintoGenkou = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
