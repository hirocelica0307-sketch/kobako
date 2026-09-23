/* ローマ字の はんてい
   ------------------------------------------------------------------
   日本語入力（IME）は つかいません。キーを 1つ おすたびに
   「いま 打っている かなに あっているか」を ここで しらべます。

   ・打ちかたが いくつも ある 字は、どれでも 正解に します
       し → si / shi / ci     ち → ti / chi     つ → tu / tsu
       ふ → hu / fu           じ → zi / ji      しゃ → sya / sha / sixya …
   ・っ は つぎの 字の 子音を 2つ（kka）でも、xtu / ltu でも よい
   ・ん は nn / xn でも、つぎが 子音なら n 1つでも よい
     （つぎが あいうえお・や行・な行 の ときは n 1つだと 区別が つかないので nn）

   かなを「かたまり（チャンク）」に 分けて、かたまりごとに
   正解の 打ちかたの リストを もちます。
   ------------------------------------------------------------------ */

/* 1文字の かなの 打ちかた。さいしょに 書いたものを「おてほん」に 出します
   （小学校で ならう 訓令式を 先に しています）。 */
const SINGLE = {
    'あ':['a'], 'い':['i','yi'], 'う':['u','wu','whu'], 'え':['e'], 'お':['o'],
    'か':['ka','ca'], 'き':['ki'], 'く':['ku','cu','qu'], 'け':['ke'], 'こ':['ko','co'],
    'さ':['sa'], 'し':['si','shi','ci'], 'す':['su'], 'せ':['se','ce'], 'そ':['so'],
    'た':['ta'], 'ち':['ti','chi'], 'つ':['tu','tsu'], 'て':['te'], 'と':['to'],
    'な':['na'], 'に':['ni'], 'ぬ':['nu'], 'ね':['ne'], 'の':['no'],
    'は':['ha'], 'ひ':['hi'], 'ふ':['hu','fu'], 'へ':['he'], 'ほ':['ho'],
    'ま':['ma'], 'み':['mi'], 'む':['mu'], 'め':['me'], 'も':['mo'],
    'や':['ya'], 'ゆ':['yu'], 'よ':['yo'],
    'ら':['ra'], 'り':['ri'], 'る':['ru'], 'れ':['re'], 'ろ':['ro'],
    'わ':['wa'], 'を':['wo'],
    'が':['ga'], 'ぎ':['gi'], 'ぐ':['gu'], 'げ':['ge'], 'ご':['go'],
    'ざ':['za'], 'じ':['zi','ji'], 'ず':['zu'], 'ぜ':['ze'], 'ぞ':['zo'],
    'だ':['da'], 'ぢ':['di'], 'づ':['du'], 'で':['de'], 'ど':['do'],
    'ば':['ba'], 'び':['bi'], 'ぶ':['bu'], 'べ':['be'], 'ぼ':['bo'],
    'ぱ':['pa'], 'ぴ':['pi'], 'ぷ':['pu'], 'ぺ':['pe'], 'ぽ':['po'],
    'ぁ':['xa','la'], 'ぃ':['xi','li','xyi','lyi'], 'ぅ':['xu','lu'],
    'ぇ':['xe','le','xye','lye'], 'ぉ':['xo','lo'],
    'ゃ':['xya','lya'], 'ゅ':['xyu','lyu'], 'ょ':['xyo','lyo'], 'ゎ':['xwa','lwa'],
    'っ':['xtu','ltu','xtsu','ltsu'],
    'ゔ':['vu'], 'ー':['-']
};

/* 小さい 字と くっつく 2文字の かな（きゃ・しゅ・ちょ など）*/
const PAIR = {};
/* き＋ゃ → kya の ように、そのまま つなげる もの */
const Y_ROW = { 'き':'ky', 'ぎ':'gy', 'に':'ny', 'ひ':'hy', 'び':'by', 'ぴ':'py', 'み':'my', 'り':'ry', 'ぢ':'dy' };
for (const [base, p] of Object.entries(Y_ROW)) {
    PAIR[base + 'ゃ'] = [p + 'a'];
    PAIR[base + 'ぃ'] = [p + 'i'];
    PAIR[base + 'ゅ'] = [p + 'u'];
    PAIR[base + 'ぇ'] = [p + 'e'];
    PAIR[base + 'ょ'] = [p + 'o'];
}
Object.assign(PAIR, {
    'しゃ':['sya','sha'], 'しぃ':['syi'], 'しゅ':['syu','shu'], 'しぇ':['sye','she'], 'しょ':['syo','sho'],
    'じゃ':['zya','ja','jya'], 'じぃ':['zyi','jyi'], 'じゅ':['zyu','ju','jyu'],
    'じぇ':['zye','je','jye'], 'じょ':['zyo','jo','jyo'],
    'ちゃ':['tya','cha','cya'], 'ちぃ':['tyi','cyi'], 'ちゅ':['tyu','chu','cyu'],
    'ちぇ':['tye','che','cye'], 'ちょ':['tyo','cho','cyo'],
    'てぃ':['thi'], 'てゅ':['thu'], 'でぃ':['dhi'], 'でゅ':['dhu'],
    'とぅ':['twu'], 'どぅ':['dwu'],
    'つぁ':['tsa'], 'つぃ':['tsi'], 'つぇ':['tse'], 'つぉ':['tso'],
    'ふぁ':['fa','fwa'], 'ふぃ':['fi','fyi','fwi'], 'ふぇ':['fe','fye','fwe'],
    'ふぉ':['fo','fwo'], 'ふゅ':['fyu'],
    'うぃ':['wi','whi'], 'うぇ':['we','whe'], 'うぉ':['who']
});

const SMALL = new Set(['ぁ','ぃ','ぅ','ぇ','ぉ','ゃ','ゅ','ょ','ゎ']);
const VOWEL_START = /^[aiueoyn]/;    // ん の あとに きたら n 1つでは 区別できない 字

/** つかえる 文字か（ことばの リストを たしかめる ときに つかいます）*/
export function isTypable(word) {
    try { splitChunks(word); return true; } catch (e) { return false; }
}

const uniq = a => [...new Set(a)];

/** 1つの かたまり（っ・ん を のぞく）の 打ちかた */
function plainCands(text) {
    if (text.length === 1) {
        if (!SINGLE[text]) throw new Error('打てない 字です: ' + text);
        return SINGLE[text].slice();
    }
    /* 2文字：くっつけた 打ちかた ＋ 1文字ずつ 打つ やりかた（ki + xya など）*/
    const joined = PAIR[text] || [];
    const split = [];
    for (const a of SINGLE[text[0]]) for (const b of SINGLE[text[1]]) split.push(a + b);
    return uniq(joined.concat(split));
}

/**
 * ことばを かたまりに 分けます。
 * @returns {{kana:string, cands:string[]}[]}
 */
export function splitChunks(word) {
    /* まず っ・ん いがいを 分けます */
    const raw = [];
    for (let i = 0; i < word.length; i++) {
        const c = word[i], next = word[i + 1];
        if (c === 'っ' || c === 'ん') { raw.push({ kana: c }); continue; }
        if (next && SMALL.has(next) && PAIR[c + next]) {
            raw.push({ kana: c + next, cands: plainCands(c + next) });
            i++;
            continue;
        }
        raw.push({ kana: c, cands: plainCands(c) });
    }

    /* うしろから 見ていきます（っ・ん は つぎの かたまりで 打ちかたが かわるため）*/
    const out = [];
    for (let i = raw.length - 1; i >= 0; i--) {
        const r = raw[i];
        const after = out[0];               // すぐ うしろの かたまり（もう 決まっている）
        if (r.kana === 'ん') {
            const cands = ['nn', 'xn', "n'"];
            /* つぎが 子音で はじまる ときだけ n 1つで よい */
            if (after && !after.cands.some(c => VOWEL_START.test(c))) cands.push('n');
            out.unshift({ kana: 'ん', cands });
        } else if (r.kana === 'っ') {
            const small = SINGLE['っ'];
            /* つぎの かたまりが 子音で はじまるなら、その 子音を かさねて よい。
               っ は つぎの かたまりと ひとつに まとめます（kka で「っか」）*/
            const canDouble = after && after.kana !== 'っ' && after.kana !== 'ん' &&
                after.cands.some(c => /^[bcdfghjklmpqrstvwxyz]/.test(c) && c[0] !== 'n');
            if (!canDouble) {
                out.unshift({ kana: 'っ', cands: small.slice() });
                continue;
            }
            const next = out.shift();
            const cands = [];
            for (const c of next.cands) {
                if (/^[bcdfghjklmpqrstvwxyz]/.test(c) && c[0] !== 'n') cands.push(c[0] + c);
            }
            for (const c of next.cands) if (c.startsWith('ch')) cands.push('t' + c);   // っち → tchi
            for (const s of small) for (const c of next.cands) cands.push(s + c);
            out.unshift({ kana: 'っ' + next.kana, cands: uniq(cands) });
        } else {
            out.unshift({ kana: r.kana, cands: r.cands });
        }
    }
    return out;
}

/**
 * 1つの ことばを 打つ ための はんてい係 を 作ります。
 * @param {string} word  ひらがなの ことば
 * @param {object} prefs このこが まえに えらんだ 打ちかた（{し:'shi'} など）。おてほんに つかいます
 */
export function createTyper(word, prefs = {}) {
    const chunks = splitChunks(word);
    let ci = 0;          // いま 打っている かたまり
    let buf = '';        // いまの かたまりで 打った キー
    const used = [];     // 打ちおわった かたまりの 打ちかた

    const done = () => ci >= chunks.length;

    /* いま 打っている かたまりを おわりに します */
    function finish() {
        const ch = chunks[ci];
        used.push(buf);
        if (ch.kana.length >= 1) prefs[ch.kana] = buf;
        ci++;
        buf = '';
        return ch.kana.length;
    }

    /* おてほんに 出す 打ちかた */
    function guideFor(i) {
        const ch = chunks[i];
        if (i === ci && buf) return ch.cands.find(c => c.startsWith(buf)) || buf;
        const liked = prefs[ch.kana];
        return liked && ch.cands.includes(liked) ? liked : ch.cands[0];
    }

    /**
     * キーを 1つ 入れます。
     * @returns {{ok:boolean, kana:number, carry:string|null}}
     *   ok    あっていたか
     *   kana  この キーで 打ちおわった かなの 数（つなを 引っぱる 数）
     *   carry ことばが おわって、つぎの ことばへ まわす キー（ふつうは null）
     */
    function input(key) {
        if (done()) return { ok: false, kana: 0, carry: key };
        const ch = chunks[ci];
        const nb = buf + key;
        const hits = ch.cands.filter(c => c.startsWith(nb));
        if (hits.length) {
            buf = nb;
            /* ぴったりで、それより 長い 打ちかたが なければ おわり */
            if (hits.includes(nb) && !hits.some(c => c.length > nb.length)) {
                return { ok: true, kana: finish(), carry: null };
            }
            return { ok: true, kana: 0, carry: null };
        }
        /* ん を n 1つで 打って、もう つぎの 字に すすんだ とき */
        if (buf && ch.cands.includes(buf)) {
            const got = finish();
            if (done()) return { ok: true, kana: got, carry: key };
            const again = input(key);
            return { ok: again.ok, kana: got + again.kana, carry: again.carry };
        }
        return { ok: false, kana: 0, carry: null };
    }

    return {
        word,
        done,
        input,

        /** 画面に 出すための いまの ようす */
        view() {
            let doneKana = '', restKana = '', rest = '';
            const typed = used.join('') + buf;
            chunks.forEach((c, i) => {
                if (i < ci) doneKana += c.kana;
                else restKana += c.kana;
                if (i === ci) rest += guideFor(i).slice(buf.length);
                else if (i > ci) rest += guideFor(i);
            });
            return { doneKana, restKana, typed, rest, buf };
        },

        /** この ことばの 中で 打ちおわった かなの 数 */
        kanaDone() { return chunks.slice(0, ci).reduce((s, c) => s + c.kana.length, 0); },

        /** いま 打っている とちゅうの キー */
        buffer: () => buf
    };
}
