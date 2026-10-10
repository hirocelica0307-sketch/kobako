/* たのしい プリント ── えもじ を Fluent Emoji 3D の がぞうに かえる
   ------------------------------------------------------------------
   がめんに 出した 文字の なかの えもじ（🍑 など）を、assets/emoji/ の 3D がぞうに
   おきかえます。どの たんまつでも おなじ え に なります。
   ・がぞうが ない きごう（★ ✓ ⚀ など）は 文字の まま
   ・<option>・<title>・<svg> の なかは さわらない（がぞうを 入れられない ため）
   ・やじるし（➡ など）は つなぎの きごう なので 文字の まま
   どの えもじが どの がぞうか は assets/emoji-map.js（つくりかたは assets/README.txt）。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';
    const MAP = root.PURINTO_EMOJI || {};
    const RE = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
    const KEEP = new Set(['➡', '⬅', '⬆', '⬇', '↔', '↕']);
    const SKIP = new Set(['OPTION', 'SELECT', 'TITLE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
    const base = (document.currentScript && document.currentScript.src || '').replace(/emojify\.js(\?.*)?$/, '');

    const keyOf = g => g.replace(/️/g, '');
    const fileOf = g => { const k = keyOf(g); return KEEP.has(k) ? null : MAP[k] || null; };

    /** el の なかの 文字の えもじを がぞうに */
    function inDom(el) {
        if (!el) return;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                for (let p = n.parentNode; p && p !== el.parentNode; p = p.parentNode) {
                    if (SKIP.has(p.nodeName) || p.namespaceURI === 'http://www.w3.org/2000/svg') return NodeFilter.FILTER_REJECT;
                }
                RE.lastIndex = 0;
                return RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            },
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const n of nodes) {
            const text = n.nodeValue, frag = document.createDocumentFragment();
            let last = 0, changed = false;
            text.replace(RE, (g, i) => {
                const f = fileOf(g);
                if (!f) return g;
                if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
                const im = document.createElement('img');
                im.className = 'e3d';
                im.src = base + 'emoji/' + f + '.webp';
                im.alt = g;
                im.draggable = false;
                frag.appendChild(im);
                last = i + g.length;
                changed = true;
                return g;
            });
            if (!changed) continue;
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            n.parentNode.replaceChild(frag, n);
        }
    }

    /** 文字から えもじを とる（<option> など がぞうを 入れられない ところ用） */
    function strip(s) {
        return String(s).replace(RE, g => (fileOf(g) ? '' : g)).replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
    }

    root.PurintoEmoji = { inDom, strip, fileOf, RE };
})(window);
