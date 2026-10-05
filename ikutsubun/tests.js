/* いくつ分 しきづくり ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面を つかわない ところ（scenes.js・logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.IkutsuLogic && typeof require === 'function') {
        require('./art.js');
        require('./scenes.js');
        require('./logic.js');
    }
    const L = root.IkutsuLogic;
    const SCENES = root.IkutsuScenes;
    const ART = root.IkutsuArt;

    /** 毎回 おなじ ならびの 乱数（たしかめを くりかえせる ように） */
    function seeded(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* 1・2年生で ならう 漢字（これ いがいは 文に つかわない） */
    const KANJI =
        '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六' +
        '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';
    const okChar = ch => /[぀-ゟ゠-ヿ0-9a-zA-Z #\[\]{}、。？！「」・]/.test(ch) || KANJI.includes(ch);

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

        /* ---------- ばめん ---------- */
        t('ばめんは 60 いじょう', SCENES.length >= 60, SCENES.length);
        t('ばめんの id は ぜんぶ ちがう', new Set(SCENES.map(s => s.id)).size === SCENES.length);
        const need = ['id', 'name', 'ua', 'ub', 'one', 'bn', 't', 'q'];
        const lack = SCENES.filter(s => need.some(k => s[k] === undefined || s[k] === ''));
        t('ばめんに ひつような こうもくが ある', !lack.length, lack.map(s => s.id).join(','));
        const badTpl = [];
        SCENES.forEach(s => s.t.forEach(tpl => {
            const a = tpl.match(/\[[^\]]*\]/g) || [], b = tpl.match(/\{[^}]*\}/g) || [];
            if (a.length !== 1 || b.length !== 1 || !a[0].includes('#A') || !b[0].includes('#B')
                || (tpl.match(/#A/g) || []).length !== 1 || (tpl.match(/#B/g) || []).length !== 1) badTpl.push(s.id + '：' + tpl);
        }));
        t('どの 文も [#A] と {#B} が 1つずつ', !badTpl.length, badTpl.join(' / '));
        const badQ = SCENES.filter(s => !/[。？]$/.test(s.q));
        t('問いは 「。」か「？」で おわる', !badQ.length, badQ.map(s => s.id).join(','));
        const fixA = SCENES.filter(s => s.a && (!Array.isArray(s.a) || s.a.some(n => n < 1 || n > 9)));
        t('きまった 1つ分の 数は 1〜9', !fixA.length, fixA.map(s => s.id).join(','));
        const badKanji = [];
        SCENES.forEach(s => [s.name, s.one, s.bn, s.q, ...s.t].forEach(x => {
            [...x].forEach(ch => { if (!okChar(ch)) badKanji.push(s.id + '「' + ch + '」'); });
        }));
        t('漢字は 2年生までに ならう ものだけ', !badKanji.length, [...new Set(badKanji)].join(' '));

        /* ---------- 絵 ---------- */
        const noArt = SCENES.filter(s => !ART.ART[s.e] || (s.box && !ART.ART[s.box]));
        t('どの ばめんにも もの と まとまりの 絵が ある', !noArt.length, noArt.map(s => s.id).join(','));
        const badK = SCENES.filter(s => s.k && !['plate', 'tank', 'skewer', 'shelf', 'soil'].includes(s.k));
        t('まとまりの かたちは 5しゅるいの どれか', !badK.length, badK.map(s => s.id).join(','));
        const badSvg = Object.keys(ART.ART).filter(k => [].concat(ART.ART[k]).some(s => !/^<svg [^>]*viewBox='0 0 100 100'>[\s\S]*<\/svg>$/.test(s)));
        t('絵は ぜんぶ 100×100 の SVG', !badSvg.length, badSvg.join(','));
        t('絵の data URL', ART.artUrl('apple').startsWith('data:image/svg+xml,') && ART.artUrl('nai') === '');
        t('色ちがいは じゅんに まわる', ART.artUrl('kid', 0) === ART.artUrl('kid', 4) && ART.artUrl('kid', 0) !== ART.artUrl('kid', 1));

        /* ---------- よみかた ---------- */
        t('3ひき → 3びき', L.fixReading('3ひき') === '3びき');
        t('1ひき・6ひき・8ひき → ぴき', L.fixReading('1ひき 6ひき 8ひき') === '1ぴき 6ぴき 8ぴき');
        t('2ひき・4ひき は そのまま', L.fixReading('2ひき 4ひき') === '2ひき 4ひき');
        t('何ひき → 何びき', L.fixReading('何ひき') === '何びき');
        t('3はい → 3ばい', L.fixReading('3はい') === '3ばい');
        t('「入って います」の はい は かえない', L.fixReading('はいって います') === 'はいって います');

        /* ---------- 文の くみたて ---------- */
        const segs = L.render('1さらに りんごが [#Aこずつ] のって います。{#Bさら分}では、', 3, 4);
        t('[ ] は 1つ分、{ } は いくつ分', segs.some(s => s.k === 'a' && s.text === '3こずつ') && segs.some(s => s.k === 'b' && s.text === '4さら分'));
        t('文に もどすと もとどおり', L.plain(segs) === '1さらに りんごが 3こずつ のって います。4さら分では、');
        t('ぎゃくの 文は r', L.order('{#B人}に あめを [#Aこずつ]') === 'r' && L.order('[#Aこずつ] {#B人}') === 'f');
        const tk = L.render('たこが {#Bひき} います。1ぴきの 足は [#A本] です。', 8, 3);
        t('いくつ分の よみも なおす（3びき）', tk.find(s => s.k === 'b').text === '3びき');
        let left = 0;
        SCENES.forEach(s => s.t.forEach(tpl => {
            for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
                if (/[#[\]{}]/.test(L.plain(L.render(tpl, a, b)))) left++;
            }
        }));
        t('どの 文・どの 数でも 記号が のこらない', left === 0, left);

        /* ---------- わくの ことば・ヒント ---------- */
        const tako = SCENES.find(s => s.id === 'tako'), ringo = SCENES.find(s => s.id === 'ringo');
        t('わく：こずつ・さら分', L.unitA(ringo) === 'こずつ' && L.unitB(ringo) === 'さら分');
        t('わく：3ひき分 → びき分', L.unitB(tako, 3) === 'びき分' && L.unitB(tako, 2) === 'ひき分');
        t('ヒント：1さらに 何こ？', L.hintA(ringo) === '1さらに 何こ？');
        t('ことば：3こずつ の 4さら分', L.phrase(ringo, 3, 4) === '3こずつ の 4さら分');
        t('えらぶ 文：1さらに 3こずつ、4さら分', L.cardText(ringo, { kind: 'ok', a: 3, b: 4 }) === '1さらに 3こずつ、4さら分');
        t('えらぶ 文（たし算）', L.cardText(ringo, { kind: 'tasu', a: 3, b: 4 }) === '1さらに 3こ、もう 1さらに 4こ');

        /* ---------- 問題の かず ---------- */
        const pk = L.poolOf(SCENES, 'kihon'), pg = L.poolOf(SCENES, 'gyaku');
        const pe = L.poolOf(SCENES, 'e'), pr = L.poolOf(SCENES, 'erabu');
        t('きほんの 文は 70 いじょう', pk.length >= 70, pk.length);
        t('ぎゃくの 文は 70 いじょう', pg.length >= 70, pg.length);
        t('えの ばめんは 40 いじょう', pe.length >= 40, pe.length);
        t('えの ばめんは 1つ分が きまって いない ものだけ', pe.every(x => SCENES[x.si].pic && !SCENES[x.si].a));
        t('えらぶ と えは おなじ ばめん', pr.length === pe.length);
        const variety = SCENES.reduce((s, sc) => s + sc.t.length * (sc.a ? sc.a.length : 9) * 9, 0);
        t('文の 問題は 5000 とおり いじょう', variety >= 5000, variety);

        /* ---------- 出題 ---------- */
        ['kihon', 'gyaku', 'e', 'erabu', 'mix'].forEach(type => {
            const g = L.makeGen(SCENES, seeded(7));
            let prev = '', same = 0, range = 0, fixed = 0, kinds = new Set(), seen = new Set();
            for (let i = 0; i < 600; i++) {
                const p = g.next(type);
                const sc = SCENES.find(s => s.id === p.sid);
                if (p.sid === prev) same++;
                prev = p.sid;
                if (p.a < 1 || p.a > 9 || p.b < 1 || p.b > 9) range++;
                if (sc.a && !sc.a.includes(p.a)) fixed++;
                kinds.add(p.type);
                seen.add(p.sid);
                if (type === 'erabu' && (p.a === 1 || p.b === 1)) fixed++;
                if (type === 'kihon' && L.order(sc.t[p.ti]) !== 'f') fixed++;
                if (type === 'gyaku' && L.order(sc.t[p.ti]) !== 'r') fixed++;
            }
            t(type + '：つづけて おなじ ばめんに ならない', same === 0, same);
            t(type + '：数は 1〜9・きまりを まもる', range === 0 && fixed === 0, range + '/' + fixed);
            if (type === 'mix') t('mix：4しゅるい ぜんぶ 出る', kinds.size === 4, [...kinds].join(','));
            else t(type + '：ばめんが ひととおり 出る', seen.size === new Set(L.poolOf(SCENES, type).map(x => SCENES[x.si].id)).size, seen.size);
        });
        const cnt = Array(10).fill(0), rnd = seeded(3);
        for (let i = 0; i < 9000; i++) cnt[L.pickNum(rnd)]++;
        t('1〜9 が ぜんぶ 出る（1 は すくなめ）', cnt.slice(1).every(c => c > 200) && cnt[1] < cnt[5], cnt.slice(1).join(','));

        /* ---------- はんてい ---------- */
        const P = { a: 3, b: 4 };
        t('せいかい', L.check(P, { one: 3, many: 4, s1: 3, s2: 4 }).ok);
        let r = L.check(P, { one: 4, many: 3, s1: 4, s2: 3 });
        t('1つ分と いくつ分の いれかわり', !r.ok && r.why === 'swap' && r.bad.join() === 'one,many');
        r = L.check(P, { one: 1, many: 4, s1: 3, s2: 4 });
        t('「1さらに」の 1 を 入れた', !r.ok && r.why === 'one1' && r.bad.join() === 'one');
        r = L.check(P, { one: 3, many: 5, s1: 3, s2: 5 });
        t('いくつ分が ちがう', !r.ok && r.why === 'many' && r.bad.join() === 'many');
        r = L.check(P, { one: 3, many: 4, s1: 4, s2: 3 });
        t('しきの じゅんばんが ぎゃく', !r.ok && r.why === 'order' && r.bad.join() === 's1,s2');
        r = L.check(P, { one: 3, many: 4, s1: 3, s2: 5 });
        t('しきの 数が ちがう', !r.ok && r.why === 'shiki' && r.bad.join() === 's2');
        t('しきだけ：せいかい', L.check(P, { s1: 3, s2: 4 }, 'shiki').ok);
        r = L.check(P, { s1: 4, s2: 3 }, 'shiki');
        t('しきだけ：ぎゃく', !r.ok && r.why === 'order');
        r = L.check({ a: 5, b: 5 }, { one: 5, many: 5, s1: 5, s2: 5 });
        t('おなじ 数（5×5）', r.ok);

        /* ---------- えらぶ ---------- */
        let badC = 0, noSwap = 0;
        const crnd = seeded(11);
        for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let k = 0; k < 5; k++) {
            const cs = L.makeChoices(a, b, crnd);
            const ids = cs.map(c => c.kind + c.a + 'x' + c.b);
            const oks = cs.filter(c => c.kind === 'ok');
            const wrongSame = cs.filter(c => c.kind !== 'ok' && c.kind !== 'tasu' && c.a === a && c.b === b);
            if (cs.length !== 3 || new Set(ids).size !== 3 || oks.length !== 1 || wrongSame.length) badC++;
            if (cs.some(c => c.kind !== 'tasu' && (c.a < 1 || c.a > 9 || c.b < 1 || c.b > 9))) badC++;
            if (a !== b && !cs.some(c => c.kind === 'swap')) noSwap++;
        }
        t('せんたくしは 3つ・せいかいは 1つ・ぜんぶ ちがう', badC === 0, badC);
        t('a と b が ちがう ときは いれかえを かならず 入れる', noSwap === 0, noSwap);

        /* ---------- きろく・URL ---------- */
        t('日の キー', L.dayKey(new Date(2026, 9, 2)) === '2026-10-02');
        const h = L.parseHash('#m=gyaku&s=shiki&c=1');
        t('URL を 読む', h.m === 'gyaku' && h.steps === 'shiki' && h.color === true);
        t('URL を つくる', L.makeHash({ m: 'gyaku', steps: 'shiki', color: true }) === '#m=gyaku&s=shiki&c=1');
        t('しらない モードは つかわない', L.parseHash('#m=xxx').m === '');
        t('なにも ない ときは はじめの せってい', L.parseHash('').steps === 'full' && L.makeHash({ steps: 'full' }) === '');

        return rows;
    }

    root.IkutsuTests = runTests;
    if (typeof module === 'object' && module.exports && require.main === module) {
        const rows = runTests();
        const ng = rows.filter(r => !r.ok);
        rows.forEach(r => console.log((r.ok ? 'OK ' : 'NG ') + r.name + (r.ok || !r.detail ? '' : '  … ' + r.detail)));
        console.log('\n' + (rows.length - ng.length) + ' / ' + rows.length + ' OK');
        process.exit(ng.length ? 1 : 0);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
