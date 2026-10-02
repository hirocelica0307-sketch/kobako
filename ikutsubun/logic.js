/* いくつ分 しきづくり ── 画面を つかわない きまり
   文の くみたて・よみかたの なおし・出題・はんてい・えらぶ 問題の せんたくし・URL だけを
   ここに まとめます。tests.js が この ファイルだけを 読みこんで たしかめます（ブラウザでも node でも うごく）。 */
(function (root) {
    'use strict';

    /* ---------- 問題の しゅるい ---------- */
    const TYPES = [
        { id: 'kihon', name: 'ぶんしょう', sub: 'きほん', icon: '📖' },
        { id: 'gyaku', name: 'ぶんしょう', sub: 'じゅんばんが ぎゃく', icon: '🔄' },
        { id: 'e', name: 'えを 見て', sub: 'かぞえて しき', icon: '🖼️' },
        { id: 'erabu', name: 'しきから えらぶ', sub: 'あう ばめんは どれ？', icon: '🔍' },
    ];
    /* 「ぜんぶ まぜる」で 出る わりあい */
    const MIX_WEIGHT = { kihon: 3, gyaku: 3, e: 2, erabu: 2 };

    /* ---------- よみかたの なおし ---------- */
    /* 3びき・6ぴき・1ぱい など、数で よみかたが かわる たんい */
    const SOUND = {
        'ひき': { 1: 'ぴき', 3: 'びき', 6: 'ぴき', 8: 'ぴき', 10: 'ぴき', '何': 'びき' },
        'はい': { 1: 'ぱい', 3: 'ばい', 6: 'ぱい', 8: 'ぱい', 10: 'ぱい', '何': 'ばい' },
    };
    function fixReading(s) {
        return String(s).replace(/(10|[0-9]|何)(ひき|はい)/g, (m, n, u) => n + (SOUND[u][n] || u));
    }

    /* ---------- 文の くみたて ----------
       [ … ] は 1つ分（k:'a'）、{ … } は いくつ分（k:'b'）。#A・#B に 数が 入る。 */
    function render(tpl, a, b) {
        const segs = [];
        const re = /\[([^\]]*)\]|\{([^}]*)\}|([^[{]+)/g;
        let m;
        while ((m = re.exec(tpl))) {
            const k = m[1] !== undefined ? 'a' : m[2] !== undefined ? 'b' : '';
            const raw = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
            const text = fixReading(raw.replace(/#A/g, String(a)).replace(/#B/g, String(b)));
            if (text) segs.push({ k, text });
        }
        return segs;
    }
    const plain = segs => segs.map(s => s.text).join('');

    /** 1つ分（[ ]）が 先なら 'f'（きほん）、いくつ分（{ }）が 先なら 'r'（ぎゃく） */
    function order(tpl) {
        const ia = tpl.indexOf('['), ib = tpl.indexOf('{');
        if (ia < 0 || ib < 0) return '';
        return ia < ib ? 'f' : 'r';
    }

    /* ---------- わくの ことば・ヒント ---------- */
    /** 1つ分の わくの うしろの ことば（「こずつ」。数が 入ったら「3びきずつ」の ように よみを なおす） */
    function unitA(sc, n) {
        return n ? fixReading(n + sc.ua + 'ずつ').slice(String(n).length) : sc.ua + 'ずつ';
    }
    function unitB(sc, n) {
        return n ? fixReading(n + sc.ub + '分').slice(String(n).length) : sc.ub + '分';
    }
    function hintA(sc) { return fixReading(sc.one + 'に 何' + sc.ua + '？'); }
    function hintB(sc) { return sc.bn + 'は いくつ？'; }
    /** 「3こずつ の 4さら分」 */
    function phrase(sc, a, b) {
        return fixReading(a + sc.ua + 'ずつ') + ' の ' + fixReading(b + sc.ub + '分');
    }
    /** えらぶ 問題の みじかい 文（「1さらに 3こずつ、4さら分」） */
    function cardText(sc, c) {
        if (c.kind === 'tasu') {
            return fixReading(sc.one + 'に ' + c.a + sc.ua + '、もう ' + sc.one + 'に ' + c.b + sc.ua);
        }
        return fixReading(sc.one + 'に ' + c.a + sc.ua + 'ずつ、' + c.b + sc.ub + '分');
    }

    /* ---------- 数・らんすう ---------- */
    /** 1〜9（1 は すこし 出にくく する） */
    function pickNum(rnd) {
        const w = [0.35, 1, 1, 1, 1, 1, 1, 1, 1];
        let x = rnd() * w.reduce((s, v) => s + v, 0);
        for (let i = 0; i < 9; i++) {
            x -= w[i];
            if (x < 0) return i + 1;
        }
        return 9;
    }
    function shuffle(arr, rnd) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* ---------- 出題 ---------- */
    /** しゅるいごとに 出せる（ばめん, 文）の くみ */
    function poolOf(scenes, type) {
        const out = [];
        scenes.forEach((sc, si) => {
            if (type === 'e' || type === 'erabu') {
                if (sc.pic && !sc.a) out.push({ si, ti: -1 });
                return;
            }
            sc.t.forEach((tpl, ti) => {
                if (order(tpl) === (type === 'kihon' ? 'f' : 'r')) out.push({ si, ti });
            });
        });
        return out;
    }

    /**
     * 問題を つくる きかい。しゅるいごとに ふくろ（シャッフルした くみ）から じゅんに 出すので、
     * ばめんが かたよらず、すぐ おなじ ばめんに ならない。
     */
    function makeGen(scenes, rnd) {
        rnd = rnd || Math.random;
        const bags = {};
        let lastSid = '', lastAB = '';

        function draw(type) {
            if (!bags[type] || !bags[type].length) bags[type] = shuffle(poolOf(scenes, type), rnd);
            const bag = bags[type];
            /* すぐ まえと おなじ ばめんなら、ちがう ものと いれかえる */
            let i = bag.length - 1;
            for (let j = bag.length - 1; j >= 0; j--) {
                if (scenes[bag[j].si].id !== lastSid) { i = j; break; }
            }
            return bag.splice(i, 1)[0];
        }

        function next(type) {
            if (type === 'mix') type = pickType(rnd);
            const pick = draw(type);
            const sc = scenes[pick.si];
            let a, b, n = 0;
            do {
                a = sc.a ? sc.a[Math.floor(rnd() * sc.a.length)] : pickNum(rnd);
                b = pickNum(rnd);
            } while ((a + 'x' + b === lastAB || (type === 'erabu' && (a === 1 || b === 1))) && ++n < 50);
            lastSid = sc.id;
            lastAB = a + 'x' + b;
            const p = { type, sid: sc.id, a, b };
            if (pick.ti >= 0) {
                p.ti = pick.ti;
                p.segs = render(sc.t[pick.ti], a, b);
            }
            if (type === 'erabu') p.choices = makeChoices(a, b, rnd);
            return p;
        }
        return { next };
    }

    function pickType(rnd) {
        const ids = Object.keys(MIX_WEIGHT);
        let x = rnd() * ids.reduce((s, k) => s + MIX_WEIGHT[k], 0);
        for (const k of ids) {
            x -= MIX_WEIGHT[k];
            if (x < 0) return k;
        }
        return ids[0];
    }

    /**
     * 「しきから えらぶ」の せんたくし 3つ。
     * ok：a ずつ b 分／swap：いれかえ（b ずつ a 分）／near：かずが 1つ ちがう（2〜9）／tasu：おなじ 数ずつ で ない（a と b）
     */
    function makeChoices(a, b, rnd) {
        const ok = { kind: 'ok', a, b };
        const key = c => c.kind === 'tasu' ? 't' + c.a + '+' + c.b : c.a + 'x' + c.b;
        const used = new Set([key(ok)]);
        const out = [ok];
        const add = c => {
            if (out.length >= 3 || used.has(key(c))) return;
            if (c.kind !== 'tasu' && c.a * c.b === a * b && !(c.a === b && c.b === a)) return;
            used.add(key(c));
            out.push(c);
        };
        if (a !== b) add({ kind: 'swap', a: b, b: a });
        const others = [];
        if (a !== b) others.push({ kind: 'tasu', a, b });
        for (let tries = 0; tries < 30; tries++) {
            const c = 2 + Math.floor(rnd() * 8);
            if (c === a || c === b) continue;
            others.push(rnd() < 0.5 ? { kind: 'near', a, b: c } : { kind: 'near', a: c, b });
        }
        shuffle(others.slice(0, 2), rnd).concat(others.slice(2)).forEach(add);
        return shuffle(out, rnd);
    }

    /* ---------- はんてい ----------
       ans = { one, many, s1, s2 }（1つ分・いくつ分・しきの 左・しきの 右）
       steps が 'shiki' の ときは s1・s2 だけ。
       かえす もの：{ ok, bad:[わくの 名前], why } */
    function check(p, ans, steps) {
        const bad = [];
        let why = '';
        const { a, b } = p;
        if (steps !== 'shiki') {
            if (ans.one !== a || ans.many !== b) {
                if (a !== b && ans.one === b && ans.many === a) {
                    bad.push('one', 'many');
                    why = 'swap';
                } else {
                    if (ans.one !== a) bad.push('one');
                    if (ans.many !== b) bad.push('many');
                    why = ans.one !== a && ans.one === 1 && b !== 1 ? 'one1' : ans.one !== a ? 'one' : 'many';
                }
                return { ok: false, bad, why };
            }
        }
        if (ans.s1 !== a || ans.s2 !== b) {
            if (a !== b && ans.s1 === b && ans.s2 === a) {
                bad.push('s1', 's2');
                why = 'order';
            } else {
                if (ans.s1 !== a) bad.push('s1');
                if (ans.s2 !== b) bad.push('s2');
                why = steps === 'shiki' && ans.s1 === 1 && a !== 1 && b !== 1 ? 'one1' : 'shiki';
            }
            return { ok: false, bad, why };
        }
        return { ok: true, bad, why: '' };
    }

    /* ---------- きろく・URL ---------- */
    function dayKey(d) {
        const z = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
    }

    const MODES = ['mix', 'kihon', 'gyaku', 'e', 'erabu'];
    function parseHash(h) {
        const o = {};
        String(h || '').replace(/^#/, '').split('&').forEach(kv => {
            const [k, v] = kv.split('=');
            if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        return {
            m: MODES.includes(o.m) ? o.m : '',
            steps: o.s === 'shiki' ? 'shiki' : 'full',
            color: o.c === '1',
        };
    }
    function makeHash(st) {
        const parts = [];
        if (st.m) parts.push('m=' + st.m);
        if (st.steps === 'shiki') parts.push('s=shiki');
        if (st.color) parts.push('c=1');
        return parts.length ? '#' + parts.join('&') : '';
    }

    root.IkutsuLogic = {
        TYPES, MIX_WEIGHT, MODES,
        fixReading, render, plain, order,
        unitA, unitB, hintA, hintB, phrase, cardText,
        pickNum, shuffle, poolOf, makeGen, pickType, makeChoices,
        check, dayKey, parseHash, makeHash,
    };
    if (typeof module === 'object' && module.exports) module.exports = root.IkutsuLogic;
})(typeof globalThis !== 'undefined' ? globalThis : this);
