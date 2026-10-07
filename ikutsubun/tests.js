/* いくつ分 しきづくり ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面を つかわない ところ（scenes.js・logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.IkutsuLogic && typeof require === 'function') {
        require('./art.js');
        require('./scenes.js');
        require('./logic.js');
        require('./levelup.js');
    }
    const L = root.IkutsuLogic;
    const SCENES = root.IkutsuScenes;
    const ART = root.IkutsuArt;
    const V = root.IkutsuLevel;

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


        /* ================= レベルアップ（levelup.js） ================= */
        t('レベルアップは 8しゅるい（ミニテスト つき）', V.LV_IDS.join() === 'kotae,iranai,enzan,kimari,bai,zu,tsukuru,test');
        t('URL で レベルアップを ひらける', L.parseHash('#m=kimari').m === 'kimari' && L.parseHash('#m=test').m === 'test');
        t('2けたの よみ：13ひき・20ひき', L.fixReading('13ひき 20ひき 16ひき') === '13びき 20ぴき 16ぴき');
        const sg = V.renderLv('(#Cこ)[#Aこずつ]{#B人}<のこりは>', { A: 3, B: 4, C: 7 });
        t('文：いらない 文は x、合図の ことばは w', sg.map(s => s.k + ':' + s.text).join('|') === 'x:7こ|a:3こずつ|b:4人|w:のこりは');
        t('問いの ことば', V.askWord('りんごは ぜんぶで 何こ ありますか。') === '何こ' && V.askWord('耳は ぜんぶで いくつ ですか。') === 'いくつ');
        const noEx = SCENES.filter(s => !V.extrasFor(s).length);
        t('どの ばめんにも いらない 文が つかえる', !noEx.length, noEx.map(s => s.id).join(','));
        const exBad = [];
        SCENES.forEach(s => V.extrasFor(s).forEach(x => {
            if (x.u === s.ua || x.u === s.ub || ((s.ua === '人' || s.ub === '人') && x.u === '人')) exBad.push(s.id + '/' + x.u);
        }));
        t('いらない 文の たんいは 問いと まぎらわしく ない', !exBad.length, exBad.join(','));
        const lvKanji = [];
        [...V.EXTRA.map(x => x.t), ...V.ADD, ...V.SUB, ...V.BAI_TEXT.map(x => x.t), ...V.LV_TYPES.map(x => x.name + x.sub)].forEach(x => {
            [...x].forEach(ch => { if (!okChar(ch) && !/[＋−×○□＝（）<>()●]/.test(ch)) lvKanji.push(ch); });
        });
        t('レベルアップの 文も 2年生までの 漢字', !lvKanji.length, [...new Set(lvKanji)].join(''));
        const tplBad = [...V.ADD, ...V.SUB].filter(x => !x.includes('#X') || !x.includes('#Y') || !/<[^>]+>/.test(x));
        t('たし算・ひき算の 文に #X・#Y・合図の ことば', !tplBad.length, tplBad.join(' / '));

        /* 出題 */
        const lg = V.makeLvGen(SCENES, seeded(21));
        let ko = 0, koBad = [];
        for (let i = 0; i < 400; i++) {
            const p = lg.next(i % 2 ? 'kotae' : 'iranai');
            const sc = SCENES.find(s => s.id === p.sid);
            const txt = L.plain(p.segs);
            if (p.ans.p !== p.a * p.b || p.ans.n !== p.a * p.b || p.ans.u !== sc.ua) koBad.push('ans ' + p.sid);
            if (new Set(p.units).size !== 3 || !p.units.includes(sc.ua)) koBad.push('units ' + p.sid);
            if (!sc.a && (p.a < 2 || p.b < 2)) koBad.push('x1 ' + p.sid);
            if (/[#[\]{}()<>]/.test(txt)) koBad.push('mark ' + txt);
            if (p.type === 'iranai') {
                if (p.c === p.a || p.c === p.b || !p.segs.some(s => s.k === 'x')) koBad.push('extra ' + p.sid);
                ko++;
            }
        }
        t('しきと 答え・いらない 数：答えと たんいが あう（400もん）', !koBad.length, koBad.slice(0, 5).join(' / '));
        const ops = { '×': 0, '＋': 0, '−': 0 }, enBad = [];
        for (let i = 0; i < 400; i++) {
            const p = lg.next('enzan');
            ops[p.op]++;
            if (p.op === '−' && !(p.X > p.Y)) enBad.push('sub ' + p.X + '-' + p.Y);
            if (p.op !== '×' && (p.X > 99 || p.Y > 99)) enBad.push('2けた');
            if (/[#[\]{}()<>]/.test(L.plain(p.segs))) enBad.push('mark');
            if (p.op !== '×' && !p.segs.some(s => s.k === 'w')) enBad.push('w');
        }
        t('＋−×：3つとも 出る・ひき算は 大きい 数から', !enBad.length && ops['×'] > 100 && ops['＋'] > 50 && ops['−'] > 50, JSON.stringify(ops) + enBad.slice(0, 3));

        /* かけ算の きまり：□に せいかいを 入れると ほんとうに なりたつ */
        const evalSide = s => s.replace(/×/g, '*').replace(/＋/g, '+').replace(/\s/g, '');
        const kmBad = [], subsSeen = new Set();
        for (let i = 0; i < 700; i++) {
            const p = lg.next('kimari');
            subsSeen.add(p.sub);
            if (p.sub === 'same') {
                const opts = p.rows[0][0].opts;
                const prod = s => s.split(' × ').reduce((x, y) => x * y, 1);
                if (!p.ans.m.every(s => prod(s) === p.P) || opts.filter(s => prod(s) === p.P).length !== p.ans.m.length
                    || p.ans.m.length !== V.pairsOf(p.P).length || opts.length < 6 || new Set(opts).size !== opts.length) kmBad.push('same ' + p.P);
                continue;
            }
            const vals = p.rows.flat().filter(x => x.box).map(x => p.ans[x.box]);
            let k = 0;
            const s = V.rowsText(p).replace(/□/g, () => vals[k++]);
            let ok;
            if (s.includes('＝')) {
                const [l, r] = s.split('＝');
                ok = Function('return ' + evalSide(l))() === Function('return ' + evalSide(r))();
            } else if (p.sub === 'up' || p.sub === 'down') {
                const m = s.match(/(\d) × (\d) の 答えは、 (\d) × (\d) の 答えより (\d) (大きい|小さい)/);
                ok = m && (m[6] === '大きい' ? m[1] * m[2] - m[3] * m[4] : m[3] * m[4] - m[1] * m[2]) === Number(m[5]);
            } else if (p.sub === 'words') ok = p.ans.x === p.a && p.ans.y === p.b && p.a !== p.b;
            if (!ok) kmBad.push(p.sub + ':' + s);
            if (vals.some(v => v < 1 || v > 9)) kmBad.push('1〜9 ' + s);
        }
        t('かけ算の きまり：□に 入る 数で しきが なりたつ（700もん）', !kmBad.length, kmBad.slice(0, 4).join(' / '));
        t('かけ算の きまり：7しゅるい ぜんぶ 出る', subsSeen.size === 7, [...subsSeen].join(','));

        /* はんてい・点数 */
        const kp = { type: 'kotae', a: 3, b: 4, ans: { s1: 3, s2: 4, p: 12, n: 12, u: 'こ' } };
        let lr = V.checkLv(kp, { s1: 3, s2: 4, p: 12, n: 12, u: 'こ' });
        t('しきと 答え：せいかいは 10点', lr.ok && lr.score === 10);
        lr = V.checkLv(kp, { s1: 4, s2: 3, p: 12, n: 12, u: 'こ' });
        t('しきの じゅんばんが ぎゃく：しきは 0点・答えは 5点', !lr.ok && lr.why === 'order' && lr.score === 5);
        lr = V.checkLv(kp, { s1: 3, s2: 4, p: 12, n: 12, u: 'さら' });
        t('たんいが ちがう：5点', !lr.ok && lr.why === 'unit' && lr.score === 5 && lr.bad.join() === 'u');
        lr = V.checkLv(kp, { s1: 3, s2: 4, p: 14, n: 14, u: 'こ' });
        t('九九の 答えが ちがう', !lr.ok && lr.why === 'prod' && lr.score === 0);
        lr = V.checkLv(Object.assign({}, kp, { type: 'iranai', c: 7 }), { s1: 3, s2: 7, p: 21, n: 21, u: 'こ' });
        t('いらない 数を つかった', !lr.ok && lr.why === 'extra');
        const ep = { type: 'enzan', ans: { x: 12, y: 5, op: '＋' } };
        t('たし算は 入れかえても せいかい', V.checkLv(ep, { x: 5, op: '＋', y: 12 }).ok && V.checkLv(ep, { x: 12, op: '＋', y: 5 }).ok);
        t('計算の しゅるいが ちがう', V.checkLv(ep, { x: 12, op: '×', y: 5 }).why === 'op');
        t('ひき算の じゅんばんが ぎゃく', V.checkLv({ type: 'enzan', ans: { x: 12, y: 5, op: '−' } }, { x: 5, op: '−', y: 12 }).why === 'subOrder');
        t('かけ算の じゅんばんが ぎゃく', V.checkLv({ type: 'enzan', ans: { x: 3, y: 5, op: '×' } }, { x: 5, op: '×', y: 3 }).why === 'order');
        const sp = { type: 'kimari', sub: 'same', P: 12, ans: { m: ['2 × 6', '3 × 4', '4 × 3', '6 × 2'] } };
        t('おなじ 答え：ぜんぶ えらぶと せいかい', V.checkLv(sp, { m: ['6 × 2', '2 × 6', '4 × 3', '3 × 4'] }).ok);
        t('おなじ 答え：たりない', V.checkLv(sp, { m: ['2 × 6', '3 × 4'] }).why === 'fewer');
        t('おなじ 答え：ちがう ものを えらんだ', V.checkLv(sp, { m: ['2 × 6', '3 × 4', '4 × 3', '6 × 2', '3 × 5'] }).why === 'wrongPick');
        const wp = { type: 'kimari', sub: 'words', a: 7, b: 3, ans: { x: 7, y: 3 } };
        t('かけられる数・かける数を 入れかえた', V.checkLv(wp, { x: 3, y: 7 }).why === 'order');
        t('うまって いるか', !V.filled({ rows: [[{ box: 'x', d: 1 }, { chips: 'u', opts: ['こ'] }]] }, { x: 3 })
            && V.filled({ rows: [[{ box: 'x', d: 1 }, { chips: 'u', opts: ['こ'] }]] }, { x: 3, u: 'こ' }));


        /* ④ なんばい */
        const bg = V.makeLvGen(SCENES, seeded(33));
        const baiBad = [], baiSub = new Set();
        for (let i = 0; i < 300; i++) {
            const p = bg.next('bai');
            baiSub.add(p.sub);
            if (p.ans.p !== p.a * p.b || p.ans.n !== p.a * p.b || p.ans.s1 !== p.a || p.ans.s2 !== p.b) baiBad.push('ans');
            if (p.a < 2 || p.b < 2 || p.a > 9 || p.b > 9) baiBad.push('2〜9');
            if (/#|undefined/.test(p.text + V.rowsText(p))) baiBad.push('text ' + p.text);
            if (p.sub === 'tape' && p.ans.k !== p.b) baiBad.push('k');
            if (!p.text.includes(p.a + (p.u === 'cm' ? 'cm' : ''))) baiBad.push('a ' + p.text);
            if (!V.checkLv(p, JSON.parse(JSON.stringify(p.ans))).ok) baiBad.push('ok');
        }
        t('なんばい：答えが あう・テープの 図と 文の 2しゅるい（300もん）', !baiBad.length && baiSub.size === 2, baiBad.slice(0, 3).join(' / '));
        const bp = V.makeBai(seeded(1), 'tape');
        let br = V.checkLv(bp, Object.assign({}, bp.ans, { k: bp.b === 9 ? 8 : bp.b + 1 }));
        t('なんばい：ばいの 数が ちがう', !br.ok && br.why === 'kai' && br.score === 5);
        br = V.checkLv(bp, Object.assign({}, bp.ans, { s1: bp.ans.s2, s2: bp.ans.s1 }));
        t('なんばい：しきの じゅんばん', bp.a === bp.b || (!br.ok && br.why === 'order'));

        /* ⑥ ●の 図 */
        const zBad = [], zSub = new Set();
        for (let i = 0; i < 400; i++) {
            const p = bg.next('zu');
            zSub.add(p.sub);
            const cells = new Set(p.cells.map(c => c.join(',')));
            if (p.n !== p.cells.length || p.n > 99 || p.n < 5) zBad.push('n ' + p.n);
            const goods = p.opts.filter(o => o.ok), bads = p.opts.filter(o => !o.ok);
            if (goods.length !== 2 || bads.length !== 2 || p.opts.length !== 4 || new Set(p.opts.map(o => o.text)).size !== 4) zBad.push('opts');
            if (p.ans.m.join() !== goods.map(o => o.text).sort().join()) zBad.push('ans');
            /* ただしい もとめかた：四角の ●を たす・ひく と、図の ●と ぴったり おなじに なる */
            goods.forEach(o => {
                const cnt = {};
                o.parts.forEach(r => {
                    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cnt[x + ',' + y] = (cnt[x + ',' + y] || 0) + (r.s || 1);
                });
                const keys = Object.keys(cnt).filter(k => cnt[k] !== 0);
                if (keys.length !== cells.size || keys.some(k => cnt[k] !== 1 || !cells.has(k))) zBad.push('parts ' + o.text);
                const val = o.parts.reduce((s, r) => s + (r.s || 1) * r.w * r.h, 0);
                const nums = o.text.match(/\d+×\d+/g).map(m => m.split('×').map(Number));
                if (val !== p.n || nums.length !== o.parts.length || nums.some(([w, h], j) => w !== o.parts[j].w || h !== o.parts[j].h)) zBad.push('text ' + o.text);
            });
            /* まちがいの もとめかたは 答えが ちがう */
            bads.forEach(o => {
                const nums = o.text.match(/\d+×\d+/g).map(m => m.split('×').reduce((x, y) => x * y, 1));
                const v = o.text.includes('ひく') ? nums[0] - nums[1] : nums.reduce((x, y) => x + y, 0);
                if (v === p.n) zBad.push('bad=n ' + o.text);
            });
        }
        t('●の 図：ただしい もとめかたは 図と ぴったり・まちがいは 数が ちがう（400もん）', !zBad.length && zSub.size === 2, zBad.slice(0, 3).join(' / '));
        const zp = V.makeZu(seeded(2), 'L');
        let zr = V.checkLv(zp, { m: zp.ans.m.slice(0, 1), n: zp.n });
        t('●の 図：もとめかたが たりない（5点）', !zr.ok && zr.why === 'fewer' && zr.score === 5);
        zr = V.checkLv(zp, { m: zp.ans.m.slice(), n: zp.n + 1 });
        t('●の 図：●の 数が ちがう（5点）', !zr.ok && zr.why === 'count' && zr.score === 5);
        zr = V.checkLv(zp, { m: zp.opts.map(o => o.text), n: zp.n });
        t('●の 図：まちがいも えらんだ', !zr.ok && zr.why === 'wrongPick');

        /* ⑦ もんだいづくり */
        const tBad = [];
        for (let i = 0; i < 300; i++) {
            const p = bg.next('tsukuru');
            const sc = SCENES.find(s => s.id === p.sid);
            if (p.a === p.b) tBad.push('a=b');
            if (sc.a) tBad.push('fixed ' + sc.id);
            ['A', 'B', 'Q'].forEach(k => {
                if (!p.cards[k].includes(p.ans[k]) || new Set(p.cards[k]).size !== p.cards[k].length) tBad.push('cards ' + k + ' ' + p.sid);
            });
            const full = V.tsukuruText(p, p.ans);
            const direct = L.plain(L.render(sc.t[p.ti], p.a, p.b)) + sc.q;
            if (full !== direct) tBad.push('text ' + full + ' ≠ ' + direct);
            if (!V.tsukuruText(p, {}).includes('［ア］') || !V.tsukuruText(p, {}).includes('［ウ］')) tBad.push('slots');
        }
        t('もんだいづくり：せいかいの カードで もとの 文に もどる（300もん）', !tBad.length, tBad.slice(0, 3).join(' / '));
        const tp = V.makeTsukuru(SCENES.find(s => s.id === 'ringo'), 0, 3, 4, seeded(4));
        t('もんだいづくり：ア・イ を いれかえた', V.checkLv(tp, { A: '4こずつ', B: '3さら分', Q: tp.ans.Q }).why === 'swap');
        t('もんだいづくり：問いが ちがう', V.checkLv(tp, { A: '3こずつ', B: '4さら分', Q: 'のこりは 何こ ですか。' }).why === 'Q');
        t('もんだいづくり：せいかい', V.checkLv(tp, { A: '3こずつ', B: '4さら分', Q: tp.ans.Q }).ok);

        /* ミニテスト */
        const tl = V.makeTest(V.makeLvGen(SCENES, seeded(5)));
        t('ミニテストは 10もん（しきと答え2・いらない1・ばい1・計算えらび2・きまり2・図1・もんだいづくり1）', tl.map(p => p.type).join() === V.TEST_PLAN.join()
            && V.TEST_PLAN.length === 10 && new Set(V.TEST_PLAN).size === 7);
        const full = tl.map(p => V.checkLv(p, JSON.parse(JSON.stringify(p.ans))));
        t('ぜんぶ せいかいで 100点', V.testScore(full) === 100, V.testScore(full));
        t('にがてな しゅるいを かぞえる', JSON.stringify(V.weakTypes(tl, full.map((r, i) => i < 3 ? { ok: false } : r))) === '{"kotae":2,"iranai":1}');

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
