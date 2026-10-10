/* ルールを 1から おぼえる（入門）
   ------------------------------------------------------------------
   レッスンは 8つ。読む ページと、さわって こたえる ページ（クイズ・
   札を とる れんしゅう）が まざっています。おわった レッスンには
   しるしが つき、この 端末に のこります。
   さいごの レッスンは「コーチつき 対局」（よわい コンピューターと、
   ヒントを ぜんぶ 出して あそぶ）です。
   ------------------------------------------------------------------ */
import { CARDS, MONTHS, KIND_NAME, KIND_ORDER, monthOf, kindOf } from './cards.js';
import { cardURL } from './art.js';
import { YAKU_DEFS, calcYaku, DEFAULT_RULES, shuffle } from './rules.js';
import { store, save } from './store.js';
import { sfx } from './sound.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (id, cls = '') => `<img class="lc ${cls}" src="${cardURL(id)}" alt="${esc(CARDS[id].name)}" data-id="${id}" draggable="false">`;
const rnd = n => Math.floor(Math.random() * n);
const pick = arr => arr[rnd(arr.length)];
const monthCards = m => [0, 1, 2, 3].map(i => (m - 1) * 4 + i);
const byKind = k => CARDS.filter(c => c.k === k).map(c => c.id);

function rulesNow() { return { ...DEFAULT_RULES, ...store.rules }; }

/* ── レッスンの なかみ ─────────────────────── */

export const LESSONS = [
    {
        id: 'intro', title: '花札って なに？', sub: '48枚・12か月',
        pages: [
            { type: 'text', title: '花札（はなふだ）', body: () => `
<p>花札は 日本で むかしから あそばれている カードです。</p>
<p>ぜんぶで <b>48枚</b>。1年の <b>12か月</b> それぞれに 花や 草木が きまっていて、<b>1か月に 4枚ずつ</b> あります。</p>
<div class="lrow">${monthCards(1).map(id => img(id)).join('')}</div>
<p class="cap">1月は「松（まつ）」の 4枚</p>` },
            { type: 'months' },
            { type: 'text', title: 'いちばん 大事な きまり', body: () => `
<p><b>同じ 月の 札どうしは なかま</b> です。</p>
<p>花札（こいこい）では、手札の 札と 場の 札が <b>同じ 月</b> なら、2枚 いっしょに とる ことが できます。</p>
<div class="lrow pair">${img(8)}<span class="plus">＋</span>${img(10)}<span class="plus">→</span><span class="get">とれる！</span></div>
<p class="cap">どちらも 3月（桜）なので とれます</p>
<div class="lrow pair">${img(8)}<span class="plus">＋</span>${img(6)}<span class="plus">→</span><span class="get ng">とれない</span></div>
<p class="cap">3月（桜）と 2月（梅）は ちがう 月</p>` }
        ]
    },
    {
        id: 'kinds', title: '札の しゅるい', sub: '光・たね・短冊・かす',
        pages: [
            { type: 'text', title: '4つの しゅるい', body: () => `
<p>48枚の 札は、ねうちに よって 4つの しゅるいに わかれます。</p>
<dl class="kinds">
<dt><span class="kind-pill k-hikari">光</span> 5枚</dt><dd>いちばん ねうちが 高い 札。鶴・幕・月・雨・鳳凰。</dd>
<dt><span class="kind-pill k-tane">たね</span> 9枚</dt><dd>動物や 道具が かかれた 札。</dd>
<dt><span class="kind-pill k-tan">短冊</span> 10枚</dt><dd>細長い 紙（たんざく）が かかれた 札。</dd>
<dt><span class="kind-pill k-kasu">かす</span> 24枚</dt><dd>植物だけの 札。ねうちは ひくいけれど、たくさん あつめると 点に なります。</dd>
</dl>` },
            { type: 'kinds' },
            { type: 'text', title: '短冊の 見わけかた', body: () => `
<p>短冊は 3つの なかまが あります。役（やく）に かかわるので 見わけられると べんりです。</p>
<p><b>赤短（あかたん）</b>：文字が 書いてある 赤い 短冊</p>
<div class="lrow">${[1, 5, 9].map(id => img(id)).join('')}</div>
<p><b>青短（あおたん）</b>：青い 短冊</p>
<div class="lrow">${[21, 33, 37].map(id => img(id)).join('')}</div>
<p><b>ふつうの 短冊</b>：文字の ない 赤い 短冊</p>
<div class="lrow">${[13, 17, 25, 42].map(id => img(id)).join('')}</div>` },
            { type: 'quizKind', n: 6 }
        ]
    },
    {
        id: 'months', title: '月を おぼえよう', sub: 'クイズで れんしゅう',
        pages: [
            { type: 'text', title: 'おぼえかたの こつ', body: () => `
<ul class="tips">
<li><b>1月 松</b>：お正月の 門松</li><li><b>2月 梅</b>：春いちばんに さく</li>
<li><b>3月 桜</b>：お花見</li><li><b>4月 藤</b>：むらさきの 花が たれさがる</li>
<li><b>5月 菖蒲</b>：こどもの日の しょうぶ</li><li><b>6月 牡丹</b>：大きな 赤い 花</li>
<li><b>7月 萩</b>：小さな 赤い 葉っぱが いっぱい</li><li><b>8月 芒</b>：お月見の すすき（黒い 山）</li>
<li><b>9月 菊</b>：黄色い まるい 花</li><li><b>10月 紅葉</b>：赤い もみじの 葉</li>
<li><b>11月 柳</b>：たれさがる 柳と 雨</li><li><b>12月 桐</b>：大きな 緑の 葉っぱ</li>
</ul>
<p class="cap">対局中も 札を <b>長おし</b>すると、何月の どんな 札か 見られます。</p>` },
            { type: 'quizMonth', n: 8 },
            { type: 'quizPair', n: 6 }
        ]
    },
    {
        id: 'flow', title: 'あそびかた', sub: 'こいこいの ながれ',
        pages: [
            { type: 'text', title: 'はじめる まえ', body: () => `
<p>「こいこい」は 2人で あそぶ 花札です。</p>
<ol class="steps">
<li>2人に <b>手札を 8枚ずつ</b> くばり、<b>場に 8枚</b> 表を 上に して ならべます。</li>
<li>のこりは うらに して つみ、<b>山（やま）</b> に します。</li>
<li><b>親（おや）</b> から はじめます。</li>
</ol>` },
            { type: 'text', title: 'じぶんの 番で する こと', body: () => `
<ol class="steps">
<li><b>手札から 1枚 出す</b><br>場に 同じ 月の 札が あれば、2枚 いっしょに とります。なければ 出した 札を 場に おきます。</li>
<li><b>山から 1枚 めくる</b><br>めくった 札も 同じように、同じ 月が 場に あれば とり、なければ 場に おきます。</li>
</ol>
<div class="lrow pair">${img(4)}<span class="plus">→</span>${img(6)}<span class="plus">＝</span><span class="get">2枚 とる</span></div>
<p class="cap">これを 2人で こうたいに くりかえします。</p>` },
            { type: 'text', title: '場に 同じ 月が 2枚・3枚', body: () => `
<p>場に 同じ 月の 札が <b>2枚</b> あるときは、<b>どちらか 1枚を えらんで</b> とります。ねうちの 高い ほうを えらびましょう。</p>
<div class="lrow">${img(30)}${img(28)}<span class="plus">←</span>${img(31)}</div>
<p class="cap">芒の かすで、「芒に月」を えらんで とる</p>
<p>場に <b>3枚</b> あるときは、4枚目を 出すと <b>3枚 まとめて</b> とれます。</p>` },
            { type: 'text', title: '役（やく）と こいこい', body: () => `
<p>とった 札が きまった くみあわせに なると <b>役（やく）</b> が できて 点に なります。</p>
<p>役が できたら、つぎの どちらかを えらびます。</p>
<ul class="tips">
<li><b>あがり</b>：ここで おわりにして 点を もらう</li>
<li><b>こいこい</b>：つづけて、もっと 大きな 点を ねらう（でも あいてが 先に 役を つくると、あいての 勝ちに なる）</li>
</ul>` },
            { type: 'text', title: '勝ち負け', body: () => `
<p>どちらも 役が できないまま 手札が なくなったら <b>流局（ひきわけ）</b>です。</p>
<p>これを 何回か（たとえば 12回＝12か月）くりかえして、<b>点の 合計が 多い ほうが 勝ち</b>です。</p>
<p>勝った 人が つぎの 局の 親に なります。</p>` }
        ]
    },
    {
        id: 'match', title: 'とってみよう', sub: '札を あわせる れんしゅう',
        pages: [
            { type: 'text', title: 'れんしゅうの しかた', body: () => `
<p>手札の 札と <b>同じ 月</b>の 札を、場から さがして タップしましょう。</p>
<p>同じ 月の 札が ないときは「とれる 札は ない」を おします。</p>` },
            { type: 'match', n: 8 }
        ]
    },
    {
        id: 'yaku', title: '役を おぼえよう', sub: 'どう あつめると 点に なる？',
        pages: [
            { type: 'yaku', group: ['goko', 'shiko', 'ameshiko', 'sanko'], title: '光の 役', note: '光を 3枚 あつめると 役に なります。ただし「柳に小野道風（雨）」は 三光には 入りません。' },
            { type: 'yaku', group: ['hanami', 'tsukimi'], title: '一杯（いっぱい）の 役', note: '「菊に盃」と、桜に幕 または 芒に月 の 2枚だけで できる 役です。菊に盃は とても 大事！' },
            { type: 'yaku', group: ['inoshikacho', 'akatan', 'aotan'], title: '3枚で できる 役', note: 'きまった 3枚を あつめる 役です。あいてに 1枚でも とられると できなく なります。' },
            { type: 'yaku', group: ['tane', 'tan', 'kasu'], title: 'かずの 役', note: 'しゅるいごとに 枚数を あつめる 役です。1枚 ふえるたびに 1点 ふえます。' },
            { type: 'quizYaku', n: 6 }
        ]
    },
    {
        id: 'points', title: 'こいこいと 点数', sub: 'いつ あがる？',
        pages: [
            { type: 'text', title: '点数の きまり', body: () => {
                const r = rulesNow();
                return `<p>あがった 人は、できた 役の 点を ぜんぶ たした ものを もらいます。</p>
<ul class="tips">
${r.double7 ? '<li>合計が <b>7点以上</b>なら <b>2倍</b>。</li>' : ''}
${r.koiBonus === 'opponent' ? '<li>あいてが <b>こいこい</b> した あとに あがると <b>2倍</b>。</li>' : ''}
${r.koiBonus === 'self' ? '<li>じぶんが こいこい した 回数ぶん 倍が ふえる（1回で 2倍、2回で 3倍…）。</li>' : ''}
${r.teyaku ? '<li>くばられた 手札に 同じ 月が 4枚（<b>手四</b>）、または 同じ 月の 2枚ずつが 4組（<b>くっつき</b>）あれば、すぐに 6点で 勝ち。</li>' : ''}
</ul>
<p class="cap">（いまの 設定の ルールです。設定で かえられます）</p>`;
            } },
            { type: 'text', title: 'こいこい する？ あがる？', body: () => `
<ul class="tips">
<li><b>はじめは「あがる」が おすすめ。</b> こいこいは 点が ふえる かわりに、あいてに 点を わたす きけんも あります。</li>
<li>あいての とった 札を 見て、<b>あいての 役が ちかい</b>ときは あがりましょう。</li>
<li>手札が まだ 多くて、<b>あと 1枚で 大きな 役</b>が できそうなら こいこいも あり。</li>
</ul>` },
            { type: 'text', title: '強く なる こつ', body: () => `
<ul class="tips">
<li>とれる 札が いくつか あるときは、<b>光 → たね・短冊 → かす</b> の じゅんに ねらう。</li>
<li>「菊に盃」は 2つの 一杯の 役に つかえる 大事な 札。</li>
<li><b>あいての 役の じゃま</b>も だいじ。あいてが 赤短を 2枚 もっていたら、のこりの 1枚を 先に とる。</li>
<li>とれる 札が ないときは、<b>あいてに とられても こまらない 札</b>（かすなど）を 出す。</li>
</ul>` }
        ]
    },
    {
        id: 'practice', title: 'コーチと 対局', sub: 'ヒントつきで あそんでみよう',
        pages: [
            { type: 'text', title: 'コーチつき 対局', body: () => `
<p>いちばん やさしい コンピューターと、ヒントを ぜんぶ 出して 3局 あそびます。</p>
<ul class="tips">
<li>手札で <b>とれる 札には 光る しるし</b>が つきます。</li>
<li>札を タップすると、場の とれる 札が 光ります。もう一度 タップで 出します。</li>
<li>下の <b>💡 おすすめ</b> で、どの 札を 出すと よいか おしえて もらえます。</li>
<li>上の <b>役</b> ボタンで、いま どの 役に ちかいか 見られます。</li>
<li>札を <b>長おし</b>すると、なんの 札か わかります。</li>
</ul>` },
            { type: 'practice' }
        ]
    }
];

/* ── 画面 ──────────────────────────────────── */

export function renderLessonList(root, open) {
    const done = store.lessons;
    const n = LESSONS.filter(l => done[l.id]).length;
    root.innerHTML = `<header class="bar"><button class="back" data-go="home">‹</button><h1>ルールを おぼえる</h1></header>
<div class="scroll"><p class="lead">上から じゅんに すすめると、花札（こいこい）の ルールが ひととおり わかります。<br><small>おわった レッスン ${n} / ${LESSONS.length}</small></p>
<ol class="lesson-list">${LESSONS.map((l, i) => `<li><button class="lesson${done[l.id] ? ' done' : ''}" data-lesson="${l.id}">
<span class="no">${done[l.id] ? '✓' : i + 1}</span><span class="lt"><b>${esc(l.title)}</b><small>${esc(l.sub)}</small></span></button></li>`).join('')}</ol></div>`;
    root.querySelectorAll('[data-lesson]').forEach(b => b.addEventListener('click', () => open(b.dataset.lesson)));
}

export function runLesson(root, id, { onDone, onPractice }) {
    const lesson = LESSONS.find(l => l.id === id);
    let pageNo = 0;
    const show = () => {
        const page = lesson.pages[pageNo];
        root.innerHTML = `<header class="bar"><button class="back" data-go="learn">‹</button><h1>${esc(lesson.title)}</h1>
<span class="pg">${pageNo + 1}/${lesson.pages.length}</span></header>
<div class="scroll lesson-body"></div>
<footer class="lesson-nav"><button class="btn" data-nav="prev" ${pageNo ? '' : 'disabled'}>もどる</button>
<button class="btn primary" data-nav="next">${pageNo === lesson.pages.length - 1 ? 'おわり' : 'つぎへ'}</button></footer>`;
        const body = root.querySelector('.lesson-body');
        const next = root.querySelector('[data-nav="next"]');
        const finish = () => {
            if (pageNo < lesson.pages.length - 1) { pageNo++; show(); }
            else { store.lessons[id] = true; save(); onDone(); }
        };
        root.querySelector('[data-nav="prev"]').addEventListener('click', () => { if (pageNo) { pageNo--; show(); } });
        next.addEventListener('click', () => { sfx.tap(); finish(); });
        renderPage(page, body, next, { finish, onPractice: () => { store.lessons[id] = true; save(); onPractice(); } });
        body.scrollTop = 0;
    };
    show();
}

function renderPage(page, body, next, ctx) {
    switch (page.type) {
        case 'text':
            body.innerHTML = `<h2>${esc(page.title)}</h2>${page.body()}`;
            break;
        case 'months':
            body.innerHTML = `<h2>12か月の 札</h2><p>月ごとに 4枚ずつ。左の ほうが ねうちの 高い 札です。</p>
<div class="month-table">${MONTHS.slice(1).map((m, i) => `<div class="mt-row"><div class="mt-name"><b>${i + 1}月</b><span>${m.flower}</span><small>${m.yomi}</small></div>
<div class="mt-cards">${monthCards(i + 1).map(id => img(id)).join('')}</div></div>`).join('')}</div>`;
            break;
        case 'kinds':
            body.innerHTML = `<h2>しゅるいごとの 札</h2>${KIND_ORDER.map(k => `<h3><span class="kind-pill k-${k}">${KIND_NAME[k]}</span> ${byKind(k).length}枚</h3>
<div class="lgrid">${byKind(k).map(id => img(id)).join('')}</div>`).join('')}`;
            break;
        case 'yaku': {
            const r = rulesNow();
            const list = YAKU_DEFS.filter(y => page.group.includes(y.id));
            body.innerHTML = `<h2>${esc(page.title)}</h2><p>${esc(page.note)}</p>${yakuCards(list, r)}`;
            break;
        }
        case 'quizKind':
        case 'quizMonth':
        case 'quizPair':
        case 'quizYaku':
            quiz(page, body, next, ctx);
            break;
        case 'match':
            matchPractice(page, body, next, ctx);
            break;
        case 'practice':
            body.innerHTML = `<h2>さあ、やってみよう！</h2><p>こまったら いつでも ☰ メニューから 役の 一覧や ルールを 見られます。</p>
<button class="btn primary big" data-start>コーチつき 対局を はじめる</button>`;
            body.querySelector('[data-start]').addEventListener('click', ctx.onPractice);
            break;
    }
}

/** 役の せつめいと 札 */
export function yakuCards(list, r) {
    return list.filter(y => !y.opt || r[y.opt]).map(y => {
        let cards;
        if (y.id === 'sanko') cards = y.cards.slice(0, 3);
        else if (y.id === 'shiko') cards = y.cards;
        else if (y.id === 'ameshiko') cards = [0, 8, 28, 40];
        else if (y.cards) cards = y.cards;
        else if (y.kind === 'tane') cards = byKind('tane').slice(0, 5);
        else if (y.kind === 'tan') cards = [1, 13, 21, 25, 42];
        else cards = byKind('kasu').filter((_, i) => i % 2 === 0).slice(0, 10);
        return `<div class="ycard"><div class="yc-head"><b>${esc(y.name)}</b><small>${esc(y.yomi)}</small><span class="yc-pts">${y.pts}点${y.kind ? '〜' : ''}</span></div>
<div class="yc-desc">${esc(y.desc)}${y.id === 'kasu' && r.sakeKasu ? '（菊に盃も かすに かぞえる）' : ''}</div>
<div class="lrow small">${cards.map(id => img(id)).join('')}</div></div>`;
    }).join('');
}

/* ── クイズ ─────────────────────────────────── */

function makeQuestion(type) {
    if (type === 'quizKind') {
        const k = pick(KIND_ORDER);
        const id = pick(byKind(k));
        return { prompt: 'この 札の しゅるいは？', cards: [id],
            options: KIND_ORDER.map(x => ({ label: KIND_NAME[x], ok: x === k })),
            explain: `${CARDS[id].name}は「${KIND_NAME[k]}」です。` };
    }
    if (type === 'quizMonth') {
        const id = rnd(48);
        const m = monthOf(id);
        const others = shuffle([...Array(12).keys()].map(i => i + 1).filter(x => x !== m), Math.random).slice(0, 3);
        const opts = shuffle([m, ...others], Math.random);
        return { prompt: 'この 札は 何月？', cards: [id],
            options: opts.map(x => ({ label: `${x}月 ${MONTHS[x].flower}`, ok: x === m })),
            explain: `${CARDS[id].name}は ${m}月（${MONTHS[m].flower}）の 札です。` };
    }
    if (type === 'quizPair') {
        const id = rnd(48);
        const m = monthOf(id);
        const right = pick(monthCards(m).filter(x => x !== id));
        const wrongs = [];
        while (wrongs.length < 3) {
            const w = rnd(48);
            if (monthOf(w) !== m && !wrongs.some(x => monthOf(x) === monthOf(w))) wrongs.push(w);
        }
        const opts = shuffle([right, ...wrongs], Math.random);
        return { prompt: 'この 札と いっしょに とれる（同じ 月の）札は どれ？', cards: [id],
            options: opts.map(x => ({ card: x, ok: x === right })),
            explain: `どちらも ${m}月（${MONTHS[m].flower}）です。` };
    }
    // quizYaku
    const r = rulesNow();
    const targets = YAKU_DEFS.filter(y => !y.opt || r[y.opt]).map(y => y.id).concat(['none', 'none']);
    for (let tries = 0; tries < 200; tries++) {
        const t = pick(targets);
        let set = [];
        if (t === 'none') set = [];
        else if (t === 'goko') set = YAKU_DEFS[0].cards.slice();
        else if (t === 'shiko') set = YAKU_DEFS[1].cards.slice();
        else if (t === 'ameshiko') set = [0, 8, 28, 40];
        else if (t === 'sanko') set = shuffle(YAKU_DEFS[3].cards.slice(), Math.random).slice(0, 3);
        else {
            const y = YAKU_DEFS.find(x => x.id === t);
            if (y.cards) set = y.cards.slice();
            else {
                const pool = CARDS.filter(c => c.k === y.kind).map(c => c.id);
                set = shuffle(pool, Math.random).slice(0, y.need);
            }
        }
        const fill = t === 'kasu' ? 1 : 2 + rnd(3);
        const all = new Set(set);
        while (all.size < set.length + fill) all.add(rnd(48));
        const cards = shuffle([...all], Math.random).sort((a, b) => KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || a - b);
        const made = calcYaku(cards, r);
        if (made.length > 1) continue;
        const answer = made.length ? made[0].id : 'none';
        if (t !== 'none' && answer !== t) continue;
        if (t === 'none' && answer !== 'none') continue;
        const names = YAKU_DEFS.filter(y => (!y.opt || r[y.opt]) && y.id !== answer).map(y => y.id);
        const opts = shuffle([answer, ...shuffle(names, Math.random).slice(0, answer === 'none' ? 3 : 2), ...(answer === 'none' ? [] : ['none'])], Math.random);
        const label = id => id === 'none' ? '役は ない' : YAKU_DEFS.find(y => y.id === id).name;
        return { prompt: 'この 札を とったとき、できている 役は？', cards, many: true,
            options: opts.map(x => ({ label: label(x), ok: x === answer })),
            explain: answer === 'none' ? 'まだ 役は できていません。' : `「${label(answer)}」（${made[0].pts}点）が できています。` };
    }
    return makeQuestion('quizKind');
}

function quiz(page, body, next, ctx) {
    let q = 0, right = 0;
    next.disabled = true;
    const title = { quizKind: 'しゅるい クイズ', quizMonth: '月 クイズ', quizPair: 'なかま さがし', quizYaku: '役 クイズ' }[page.type];
    const ask = () => {
        const Q = makeQuestion(page.type);
        body.innerHTML = `<h2>${title} <small>${q + 1} / ${page.n}</small></h2><p class="qp">${esc(Q.prompt)}</p>
<div class="lrow ${Q.many ? 'small wrap' : 'big'}">${Q.cards.map(id => img(id)).join('')}</div>
<div class="opts ${Q.options[0].card !== undefined ? 'card-opts' : ''}">${Q.options.map((o, i) =>
            `<button class="opt" data-i="${i}">${o.card !== undefined ? img(o.card) : esc(o.label)}</button>`).join('')}</div>
<p class="qa" aria-live="polite"></p>`;
        body.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
            if (body.dataset.answered) return;
            body.dataset.answered = '1';
            const o = Q.options[+b.dataset.i];
            body.querySelectorAll('.opt').forEach((x, i) => { if (Q.options[i].ok) x.classList.add('ok'); x.disabled = true; });
            if (o.ok) { right++; sfx.ok(); } else { b.classList.add('ng', 'chosen'); sfx.ng(); }
            const qa = body.querySelector('.qa');
            qa.innerHTML = `${o.ok ? '<b class="good">せいかい！</b>' : '<b class="bad">ざんねん</b>'} ${esc(Q.explain)}
<button class="btn primary qnext">${q + 1 < page.n ? 'つぎの もんだい' : 'けっかを 見る'}</button>`;
            qa.querySelector('.qnext').addEventListener('click', () => {
                delete body.dataset.answered;
                q++;
                if (q < page.n) ask();
                else {
                    body.innerHTML = `<h2>${title}</h2><div class="qresult"><b>${right}</b> / ${page.n} もん せいかい</div>
<p>${right === page.n ? 'かんぺき！ すごい！' : right >= page.n * 0.6 ? 'よく できました！' : 'もう一度 ためすと おぼえられます。'}</p>
<button class="btn" data-retry>もう一度</button>`;
                    body.querySelector('[data-retry]').addEventListener('click', () => { q = 0; right = 0; ask(); });
                    next.disabled = false;
                }
            });
        }));
    };
    ask();
}

/* ── 札を とる れんしゅう ─────────────────────── */

function matchPractice(page, body, next) {
    const kinds = shuffle([1, 1, 0, 2, 1, 3, 0, 2], Math.random).slice(0, page.n);
    let q = 0, right = 0;
    next.disabled = true;
    const ask = () => {
        const type = kinds[q];
        const hand = rnd(48);
        const m = monthOf(hand);
        const same = shuffle(monthCards(m).filter(x => x !== hand), Math.random).slice(0, type);
        const used = new Set([m]);
        const fill = [];
        const nField = 6;
        while (fill.length < nField - same.length) {
            const c = rnd(48);
            if (used.has(monthOf(c))) continue;
            used.add(monthOf(c));
            fill.push(c);
        }
        const field = shuffle([...same, ...fill], Math.random);
        body.innerHTML = `<h2>とってみよう <small>${q + 1} / ${page.n}</small></h2>
<p class="qp">手札の 札で とれる 場の 札を タップ</p>
<div class="mp"><div class="mp-label">場</div><div class="mp-field">${field.map(id => img(id, 'tap')).join('')}</div>
<div class="mp-label">手札</div><div class="mp-hand">${img(hand, 'hand')}</div></div>
<button class="btn none-btn">とれる 札は ない</button><p class="qa" aria-live="polite"></p>`;
        let answered = false;
        const result = (ok, msg) => {
            if (answered) return;
            answered = true;
            if (ok) { right++; sfx.ok(); } else sfx.ng();
            body.querySelectorAll('.mp-field .lc').forEach(e => {
                if (same.includes(+e.dataset.id)) e.classList.add('right');
            });
            const qa = body.querySelector('.qa');
            qa.innerHTML = `${ok ? '<b class="good">せいかい！</b>' : '<b class="bad">ざんねん</b>'} ${msg}
<button class="btn primary qnext">${q + 1 < page.n ? 'つぎへ' : 'けっかを 見る'}</button>`;
            qa.querySelector('.qnext').addEventListener('click', () => {
                q++;
                if (q < page.n) ask();
                else {
                    body.innerHTML = `<h2>とってみよう</h2><div class="qresult"><b>${right}</b> / ${page.n} もん せいかい</div>
<p>${right === page.n ? 'かんぺき！ もう 対局が できます！' : 'まちがえた ところは、月を たしかめて みましょう。'}</p><button class="btn" data-retry>もう一度</button>`;
                    body.querySelector('[data-retry]').addEventListener('click', () => { q = 0; right = 0; ask(); });
                    next.disabled = false;
                }
            });
        };
        const fm = `${m}月（${MONTHS[m].flower}）`;
        body.querySelectorAll('.mp-field .lc').forEach(e => e.addEventListener('click', () => {
            const id = +e.dataset.id;
            if (answered) return;
            if (monthOf(id) === m) {
                e.classList.add('taken');
                body.querySelector('.mp-hand .lc').classList.add('fly');
                if (type === 3) result(true, `場に ${fm}が 3枚 あるので、手札と あわせて 4枚 まとめて とれます！`);
                else if (type === 2) result(true, `${fm}が 2枚 あるので、どちらか 1枚を えらんで とります。ねうちの 高い ほうを えらぶと いいです。`);
                else result(true, `どちらも ${fm}です。2枚 いっしょに とれます。`);
            } else {
                e.classList.add('wrong');
                result(false, `${CARDS[id].name}は ${monthOf(id)}月です。手札は ${fm}の 札でした。`);
            }
        }));
        body.querySelector('.none-btn').addEventListener('click', () => {
            if (type === 0) result(true, `場に ${fm}の 札は ありません。手札の 札は 場に おきます。`);
            else result(false, `場に ${fm}の 札が あります（光っている 札）。`);
        });
    };
    ask();
}
