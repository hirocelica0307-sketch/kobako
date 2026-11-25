/* むかしばなし文庫 ── 本文の 書き方を よみとる（アプリと テストで つかう）
   書き方：
     漢字《よみ》 … よみがな（すぐ前の 漢字の ならびに つく）
     ｜文字《よみ》 … ｜から《までに よみがなを つける（ひらがなまじりの ことばなど）
     〔ことば〕 / 〔見せる 文字=じてんの みだし〕 … むかしの ことば（おすと じてんが 出る）
     空の 行 … だんらくの くぎり
     #え なまえ … ここに 絵を 入れる（よみもの）                                  */
(function (root) {
    'use strict';
    const KANJI = /[㐀-鿿豈-﫿々〆]/;

    /* 1つの だんらくを 部品の ならびに する。
       部品： {t:'c', s:'あ'} 1文字 / {t:'r', base:'山', rt:'やま'} / {t:'k', key, parts:[…]} */
    function inline(src) {
        const out = [];
        let i = 0;
        while (i < src.length) {
            const ch = src[i];
            if (ch === '〔') {
                const end = src.indexOf('〕', i);
                if (end < 0) throw new Error('〔 の とじが ない: ' + src.slice(i, i + 20));
                const body = src.slice(i + 1, end);
                const eq = body.indexOf('=');
                const shown = eq >= 0 ? body.slice(0, eq) : body;
                const parts = inline(shown);
                const key = eq >= 0 ? body.slice(eq + 1) : plain(parts);
                out.push({ t: 'k', key, parts });
                i = end + 1;
                continue;
            }
            if (ch === '｜') {
                const op = src.indexOf('《', i), cl = src.indexOf('》', i);
                if (op < 0 || cl < op) throw new Error('｜ の あとに 《》 が ない: ' + src.slice(i, i + 20));
                out.push({ t: 'r', base: src.slice(i + 1, op), rt: src.slice(op + 1, cl) });
                i = cl + 1;
                continue;
            }
            if (ch === '《') {
                const cl = src.indexOf('》', i);
                if (cl < 0) throw new Error('《 の とじが ない');
                const rt = src.slice(i + 1, cl);
                // すぐ前の 漢字の ならびを とりだす
                let base = '';
                while (out.length && out[out.length - 1].t === 'c' && KANJI.test(out[out.length - 1].s)) {
                    base = out.pop().s + base;
                }
                if (!base) throw new Error('《' + rt + '》 の 前に 漢字が ない');
                out.push({ t: 'r', base, rt });
                i = cl + 1;
                continue;
            }
            out.push({ t: 'c', s: ch });
            i++;
        }
        return out;
    }
    function plain(parts) {
        return parts.map(p => p.t === 'c' ? p.s : p.t === 'r' ? p.base : plain(p.parts)).join('');
    }
    function reading(parts) {
        return parts.map(p => p.t === 'c' ? p.s : p.t === 'r' ? p.rt : reading(p.parts)).join('');
    }

    /* よみもの：ばめん（絵で 区切る）の ならびに する */
    function parseYomimono(src) {
        const scenes = [];
        let cur = null;
        const blocks = src.replace(/\r/g, '').split('\n');
        let para = [];
        const flush = () => {
            if (para.length) {
                if (!cur) { cur = { img: null, paras: [] }; scenes.push(cur); }
                cur.paras.push(inline(para.join('')));
                para = [];
            }
        };
        for (const raw of blocks) {
            const line = raw.trim();
            if (!line) { flush(); continue; }
            const m = line.match(/^#え\s+(.+)$/);
            if (m) { flush(); cur = { img: m[1].trim(), paras: [] }; scenes.push(cur); continue; }
            para.push(line);
        }
        flush();
        return scenes;
    }

    const api = { inline, plain, reading, parseYomimono, KANJI };
    if (typeof module !== 'undefined') module.exports = api;
    root.MBParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
