/* 画面に 出す キーボード
   ------------------------------------------------------------------
   なまえは 画面の ひらがなキーで 入れます。
   Chromebook の キーボードで ひらがなを 打つには 日本語入力の
   切りかえが いるので、小さい子でも まよわない ように こちらに しています。
   （テンキーの createNumberKeypad は いまは つかっていません）
   ------------------------------------------------------------------ */

/* 五十音表。たて1れつが 「あかさたなはまやらわ」の 1行ぶんです。
   空文字は 「そこに 文字が ない」ところ（や行の い・え など）。 */
const KANA_GRID = [
    ['あ','か','さ','た','な','は','ま','や','ら','わ'],
    ['い','き','し','ち','に','ひ','み','' ,'り','を'],
    ['う','く','す','つ','ぬ','ふ','む','ゆ','る','ん'],
    ['え','け','せ','て','ね','へ','め','' ,'れ','ー'],
    ['お','こ','そ','と','の','ほ','も','よ','ろ','' ]
];

/* 「゛」「゜」「小」を おしたとき、最後の 1文字を 何に 変えるか */
const DAKUTEN = {
    か:'が', き:'ぎ', く:'ぐ', け:'げ', こ:'ご',
    さ:'ざ', し:'じ', す:'ず', せ:'ぜ', そ:'ぞ',
    た:'だ', ち:'ぢ', つ:'づ', て:'で', と:'ど',
    は:'ば', ひ:'び', ふ:'ぶ', へ:'べ', ほ:'ぼ'
};
const HANDAKUTEN = { は:'ぱ', ひ:'ぴ', ふ:'ぷ', へ:'ぺ', ほ:'ぽ' };
const KOGAKI = {
    あ:'ぁ', い:'ぃ', う:'ぅ', え:'ぇ', お:'ぉ',
    つ:'っ', や:'ゃ', ゆ:'ゅ', よ:'ょ', わ:'ゎ'
};
/* 「゛」を もう一度 おしたら 元に もどせるように、逆引きも 作っておきます */
const UNDO = {};
for (const map of [DAKUTEN, HANDAKUTEN, KOGAKI]) {
    for (const [from, to] of Object.entries(map)) UNDO[to] = from;
}

/** ボタンの 上に 出す しるしを つくります（線や まるで えがきます）。 */
function makeGlyph(kind) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'glyph');
    svg.setAttribute('aria-hidden', 'true');

    const add = (tag, attrs) => {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        svg.appendChild(el);
        return el;
    };
    const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' };

    if (kind === 'dakuten') {                 /* ゛ ＝ みじかい 線 2ほん */
        add('line', { ...stroke, x1: 7,  y1: 6, x2: 4,  y2: 15 });
        add('line', { ...stroke, x1: 15, y1: 6, x2: 12, y2: 15 });
    } else if (kind === 'handakuten') {       /* ゜ ＝ まる */
        add('circle', { ...stroke, cx: 12, cy: 11, r: 6 });
    } else if (kind === 'small') {            /* 小さい字 ＝ 大小の しかく */
        add('rect', { ...stroke, x: 3,  y: 4,  width: 11, height: 11, rx: 2 });
        add('rect', { ...stroke, x: 15, y: 11, width: 6,  height: 6,  rx: 1.5 });
    } else if (kind === 'back') {             /* けす ＝ もどる やじるし */
        add('path', { ...stroke, d: 'M20 12H6' });
        add('path', { ...stroke, d: 'M11 7l-5 5 5 5' });
    } else {                                  /* ぜんぶけす ＝ ばつ */
        add('line', { ...stroke, x1: 6,  y1: 6,  x2: 18, y2: 18 });
        add('line', { ...stroke, x1: 18, y1: 6,  x2: 6,  y2: 18 });
    }
    return svg;
}

function makeKey(label, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key' + (cls ? ' ' + cls : '');
    b.textContent = label;
    return b;
}

/**
 * ひらがなの キーボードを 作ります。
 * @param {object} opt
 *   opt.max      いれられる 文字数（既定 6）
 *   opt.onChange 文字が 変わるたびに よばれる（いまの 文字列を わたします）
 * @returns {{el:HTMLElement, getValue:()=>string, clear:()=>void}}
 */
export function createHiraganaKeypad(opt = {}) {
    const max = opt.max || 6;
    const onChange = opt.onChange || (() => {});
    let value = '';

    const el = document.createElement('div');
    el.className = 'padbox';          /* あまった たての 場所に 合わせて のびます */

    const pad = document.createElement('div');
    pad.className = 'keypad hira';
    el.appendChild(pad);

    const tell = () => onChange(value);

    const put = ch => {
        if (value.length >= max) return;
        value += ch;
        tell();
    };

    /* 最後の 1文字に 「゛」「゜」「小」を つけたり はずしたり します */
    const mark = map => {
        if (!value) return;
        const last = value.slice(-1);
        const next = map[last] || (UNDO[last] && map[UNDO[last]] === last ? UNDO[last] : null);
        if (next) value = value.slice(0, -1) + next;
        tell();
    };

    /* 五十音表は「行（あいうえお）」がたての ならびに なるように 置きます。
       よこの ならび（あ・か・さ…）ごとに 色を かえると、
       ぜんぶ 同じ色より 文字が 見つけやすく なります。 */
    for (const row of KANA_GRID) {
        row.forEach((ch, col) => {
            if (!ch) { pad.appendChild(makeKey('', 'blank')); return; }
            const k = makeKey(ch, 'g' + col);     /* g0＝あ行、g1＝か行 … */
            k.addEventListener('click', () => put(ch));
            pad.appendChild(k);
        });
    }

    const tools = document.createElement('div');
    tools.className = 'keyrow';
    /* ことばだけでなく、しるしも いっしょに 出します。
       ゛や ゜は 1文字で 出すと とても 小さく なって 見えないので、
       じぶんで 線と まるを ひいて 大きく 見せます。 */
    const toolDefs = [
        ['てんてん',  'dakuten',    'mark wide', () => mark(DAKUTEN)],
        ['まる',      'handakuten', 'mark wide', () => mark(HANDAKUTEN)],
        ['ちいさく',  'small',      'mark wide', () => mark(KOGAKI)],
        ['けす',      'back',       'wide',      () => { value = value.slice(0, -1); tell(); }],
        ['ぜんぶけす','clear',      'wide',      () => { value = ''; tell(); }]
    ];
    for (const [label, kind, cls, fn] of toolDefs) {
        const k = makeKey('', cls);
        k.append(makeGlyph(kind));
        const t = document.createElement('span');
        t.className = 'label';
        t.textContent = label;
        k.appendChild(t);
        k.addEventListener('click', fn);
        tools.appendChild(k);
    }
    el.appendChild(tools);

    /* あまった ばしょに 合わせて キーボードの 大きさを きめます。
       10れつ×5だん なので、よこ:たて ＝ 2:1 なら キーが 正方形に なります。
       CSS の のびちぢみ だけでは 正しく 決まらないので、ここで 計算します。 */
    fitPad(el, pad, tools, 760, 2);

    return {
        el,
        getValue: () => value,
        clear() { value = ''; tell(); }
    };
}

/**
 * キーボードの 大きさを、入れものの あきに 合わせて きめます。
 * @param box   入れもの（.padbox）
 * @param pad   キーの ます目
 * @param extra 下に つく ボタンの れつ（なければ null）
 * @param maxW  いちばん 大きい はば
 * @param ratio よこ ÷ たて（2 なら 10れつ×5だん）
 */
function fitPad(box, pad, extra, maxW, ratio) {
    const relayout = () => {
        /* よこはばは「入れものの 親」から はかります。
           box じしんを はかると、キーボードを 大きく した ぶんだけ
           box も 大きく なって しまい、一度 はみ出すと 元に もどれません。 */
        const host = box.parentElement || box;
        const hostStyle = host === box ? null : getComputedStyle(host);
        const padX = hostStyle
            ? (parseFloat(hostStyle.paddingLeft) || 0) + (parseFloat(hostStyle.paddingRight) || 0)
            : 0;
        const availW = Math.max(0, host.clientWidth - padX);
        const extraH = extra ? extra.offsetHeight + 6 : 0;
        const availH = box.clientHeight - extraH;
        if (availW <= 0 || availH <= 0) return;
        /* よこは あいている はばいっぱい、たては あいている 高さまで。
           たてが たりない ときは キーが よこ長に なります。
           （たて よこ 両方を ちぢめると、キーが 小さすぎて 押せなく なります）*/
        const w = Math.max(180, Math.min(maxW, availW));
        const h = Math.max(120, Math.min(w / ratio, availH));
        pad.style.width = Math.floor(w) + 'px';
        pad.style.height = Math.floor(h) + 'px';
        /* 下の ボタンの れつも 同じ はばに して、2だんに 折りかえさない ように します
           （折りかえすと たての ばしょを とられて、キーが 小さく なります）*/
        if (extra) extra.style.width = Math.floor(w) + 'px';
    };
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(relayout);
        ro.observe(box);
        if (box.parentElement) ro.observe(box.parentElement);
        if (box.parentElement && box.parentElement.parentElement) {
            ro.observe(box.parentElement.parentElement);
        }
    }
    window.addEventListener('resize', relayout);
    /* 画面が できあがる 前に はかると 小さく 出ます。
       すこし 時間を あけて 何回か はかりなおします。 */
    relayout();
    requestAnimationFrame(relayout);
    for (const ms of [60, 200, 600]) setTimeout(relayout, ms);
}

/**
 * 数字の キーボード（テンキー）を 作ります。部屋番号を 入れるのに つかいます。
 * @param {object} opt
 *   opt.digits   けた数（既定 4）
 *   opt.onChange 数字が 変わるたびに よばれる
 *   opt.onFull   けた数が そろったときに よばれる
 */
export function createNumberKeypad(opt = {}) {
    const digits = opt.digits || 4;
    const onChange = opt.onChange || (() => {});
    const onFull = opt.onFull || (() => {});
    let value = '';

    const el = document.createElement('div');
    el.className = 'padbox';
    const pad = document.createElement('div');
    pad.className = 'keypad num';
    el.appendChild(pad);

    const tell = () => {
        onChange(value);
        if (value.length === digits) onFull(value);
    };

    const put = n => {
        if (value.length >= digits) return;
        value += n;
        tell();
    };

    for (const n of ['1','2','3','4','5','6','7','8','9']) {
        const k = makeKey(n);
        k.addEventListener('click', () => put(n));
        pad.appendChild(k);
    }
    pad.appendChild(makeKey('', 'blank'));
    const zero = makeKey('0');
    zero.addEventListener('click', () => put('0'));
    pad.appendChild(zero);
    const del = makeKey('けす', 'mark');
    del.addEventListener('click', () => { value = value.slice(0, -1); tell(); });
    pad.appendChild(del);

    /* 3れつ×4だん なので よこ:たて ＝ 3:4 */
    fitPad(el, pad, null, 300, 3 / 4);

    return {
        el,
        getValue: () => value,
        clear() { value = ''; tell(); },
        /** キーボードの 数字でも 入れられる ように */
        type(n) { put(n); },
        back() { value = value.slice(0, -1); tell(); }
    };
}
