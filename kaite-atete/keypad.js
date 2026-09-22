/* 画面に 出す キーボード
   ------------------------------------------------------------------
   このアプリは 物理キーボードを つかいません。
   なまえも 部屋番号も、画面の キーを タッチして 入れます。
   Chromebook・タブレット・パソコンの どれでも 同じ 操作に なります。
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

    /* 五十音表は「行（あいうえお）」がたての ならびに なるように 置きます */
    for (const row of KANA_GRID) {
        for (const ch of row) {
            if (!ch) { pad.appendChild(makeKey('', 'blank')); continue; }
            const k = makeKey(ch);
            k.addEventListener('click', () => put(ch));
            pad.appendChild(k);
        }
    }

    const tools = document.createElement('div');
    tools.className = 'keyrow';
    /* 記号だけだと 低学年には 伝わりにくいので、ふだん つかう 言葉で 出します。
       「てんてん」＝濁点、「まる」＝半濁点、「ちいさく」＝小さい字 */
    const toolDefs = [
        ['てんてん',  'mark wide', () => mark(DAKUTEN)],
        ['まる',      'mark wide', () => mark(HANDAKUTEN)],
        ['ちいさく',  'mark wide', () => mark(KOGAKI)],
        ['けす',      'wide',      () => { value = value.slice(0, -1); tell(); }],
        ['ぜんぶけす','wide',      () => { value = ''; tell(); }]
    ];
    for (const [label, cls, fn] of toolDefs) {
        const k = makeKey(label, cls);
        k.addEventListener('click', fn);
        tools.appendChild(k);
    }
    el.appendChild(tools);

    return {
        el,
        getValue: () => value,
        clear() { value = ''; tell(); }
    };
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

    return {
        el,
        getValue: () => value,
        clear() { value = ''; tell(); }
    };
}
