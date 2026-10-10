/* かさ はかせ ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面を つかわない ところ（logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.KasaLogic && typeof require === 'function') require('./logic.js');
    const K = root.KasaLogic;

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

    /** ますの ならびに 入って いる 水の ごうけい */
    const sumRows = rows => rows.reduce((s, r) => s + r.reduce((t, it) => t + it.ml, 0), 0);
    const CAP = { L: 1000, Lml: 1000, dL: 100 };

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* ---------- たんい ---------- */
        t('1L ＝ 10dL ＝ 1000mL・1dL ＝ 100mL', K.UNIT_ML.L === 1000 && K.UNIT_ML.dL === 100 && K.UNIT_ML.mL === 1);
        t('ldl：1300 → 1L3dL・2000 → 2L・300 → 3dL',
            K.ldl(1300) === '1L3dL' && K.ldl(2000) === '2L' && K.ldl(300) === '3dL', [K.ldl(1300), K.ldl(2000), K.ldl(300)].join(' '));
        t('inUnit：1300 を dL → 13dL・mL → 1300mL・L&dL → 1L3dL',
            K.inUnit(1300, 'dL') === '13dL' && K.inUnit(1300, 'mL') === '1300mL' && K.inUnit(1300, 'L&dL') === '1L3dL');
        t('fieldsOf：2300 を L・dL → 2 と 3', JSON.stringify(K.fieldsOf(2300, ['L', 'dL'])) === '[{"u":"L","v":2},{"u":"dL","v":3}]');

        /* ---------- ますの ならび ---------- */
        t('rowL：2300 → 1Lます 3つ（1000・1000・300）', K.rowL(2300).map(i => i.ml).join() === '1000,1000,300');
        t('rowLdLcups：2300 → 1Lます 2つ と 1dLます 3つ',
            K.rowLdLcups(2300).map(i => i.cap).join() === 'L,L,dL,dL,dL' && sumRows([K.rowLdLcups(2300)]) === 2300);
        const ch = K.rowChange(2600, 1400);
        t('rowChange：2600 → 1400（うしろから へる）', ch.map(i => i.from + '>' + i.ml).join() === '1000>1000,1000>400,600>0', ch.map(i => i.from + '>' + i.ml).join());
        t('rowDLChange：3dL → 7dL', K.rowDLChange(300, 700).map(i => i.from + '>' + i.ml).join() === '100>100,100>100,100>100,0>100,0>100,0>100,0>100');

        /* ---------- モード ---------- */
        t('モードは 7つ（6しゅるい ＋ ぜんぶ まぜる）', K.MODES.length === 7 && K.modeById('mix') && K.modeById('nai') === null);

        /* ---------- たくさん つくって しらべる ---------- */
        const problems = [];
        const kindsSeen = new Set();
        for (const useMl of [true, false]) {
            for (const m of K.MODES) {
                for (let s = 1; s <= 60; s++) {
                    const qs = K.makeRound(m.id, 10, seeded(s * 97 + (useMl ? 1 : 2)), { useMl });
                    if (qs.length !== 10) problems.push(`${m.id}: ${qs.length}もん`);
                    if (new Set(qs.map(q => q.key)).size !== qs.length) problems.push(`${m.id}: おなじ もんだい`);
                    for (const q of qs) {
                        kindsSeen.add(q.kind);
                        const where = `${q.kind} 「${q.text}」`;
                        if (!useMl && /mL/.test(q.text + (q.sub || '') + JSON.stringify(q.choices || '') + (q.targetLabel || '')))
                            problems.push('mL なし なのに mL：' + where);
                        if (!q.hint || !q.explain) problems.push('ヒント・せつめい が ない：' + where);
                        /* こたえが あって いる と OK・ちがう と NG */
                        if (q.ask === 'fields') {
                            if (!K.check(q, q.fields.map(f => f.v)).ok) problems.push('こたえが OK に ならない：' + where);
                            if (K.check(q, q.fields.map(f => f.v + 1)).ok) problems.push('まちがいが OK：' + where);
                            if (q.fields.some(f => !Number.isInteger(f.v) || f.v < 0)) problems.push('こたえが 整数で ない：' + where);
                            if (q.fields.length === 2 && (q.fields[0].v < 1 || q.fields[1].v < 1 || q.fields[1].v > 9))
                                problems.push('L と dL の こたえが へん：' + where + JSON.stringify(q.fields));
                        } else if (q.ask === 'choice') {
                            if (!q.choices.some(c => c.id === q.answer)) problems.push('せいかいが せんたくしに ない：' + where);
                            if (new Set(q.choices.map(c => c.id)).size !== q.choices.length) problems.push('せんたくしが かさなる：' + where);
                            if (!K.check(q, q.answer).ok) problems.push('こたえが OK に ならない：' + where);
                            const w = q.choices.find(c => c.id !== q.answer);
                            if (K.check(q, w.id).ok) problems.push('まちがいが OK：' + where);
                        } else if (q.ask === 'build') {
                            if (!K.check(q, q.target).ok || K.check(q, q.target + 100).ok) problems.push('つくる の はんてい：' + where);
                            if (q.target % 100) problems.push('ますで つくれない かさ：' + where);
                            if (q.scene.capL * 1000 < q.target + 1000) problems.push('水そうが ちいさい：' + where);
                        }
                        /* 図の ますに 水が 入りすぎて いない */
                        for (const sc of [q.scene, q.after]) {
                            if (sc && sc.type === 'masu') {
                                for (const r of sc.rows) for (const it of r) {
                                    if (!(it.cap in CAP) || it.ml < 0 || it.ml > CAP[it.cap] || (it.from !== undefined && (it.from < 0 || it.from > CAP[it.cap])))
                                        problems.push('ますの 水が へん：' + where);
                                }
                            }
                        }
                    }
                }
            }
        }
        t('どの モードも 10もん・おなじ もんだい なし・こたえ・図が ただしい（1440かい）', problems.length === 0, problems.slice(0, 4).join(' / '));
        const allKinds = K.MODES.filter(m => m.kinds).flatMap(m => m.kinds.map(k => k.id));
        t('ぜんぶの しゅるいが 出る', allKinds.every(k => kindsSeen.has(k)), allKinds.filter(k => !kindsSeen.has(k)).join(','));

        /* ---------- はかろう：図の 水と こたえが おなじ ---------- */
        let bad = 0;
        for (let s = 1; s <= 200; s++) {
            const q = K.makeQuestion('hakaru', seeded(s), { useMl: true });
            const total = q.fields.reduce((a, f) => a + f.v * K.UNIT_ML[f.u], 0);
            if (sumRows(q.scene.rows) !== total) bad++;
        }
        t('はかろう：ますの 水の ごうけい ＝ こたえ', bad === 0, bad + 'こ');

        /* ---------- たんいを かえよう ---------- */
        bad = 0;
        for (let s = 1; s <= 200; s++) {
            const q = K.makeQuestion('kaeru', seeded(s), { useMl: true });
            const total = q.fields.reduce((a, f) => a + f.v * K.UNIT_ML[f.u], 0);
            if (sumRows(q.scene.rows) !== total) bad++;
        }
        t('たんいを かえよう：図の 水 ＝ こたえの かさ', bad === 0, bad + 'こ');

        /* まちがいかたに あわせた ことば */
        const find = (mode, kind, opt) => {
            for (let s = 1; s < 5000; s++) {
                const q = K.makeQuestion(mode, seeded(s), opt || { useMl: true });
                if (q.kind === kind) return q;
            }
            return null;
        };
        const q1 = find('kaeru', 'k-ldl2dl');
        const [a1, b1] = q1.text.match(/\d+/g).map(Number);
        t('2L3dL → 5dL と した ときは「1L は 1dL では ない」', /1dL では ない/.test(K.check(q1, [a1 + b1]).msg), q1.text);
        t('2L3dL → 20dL と した ときは「のこりの dL」', /のこり/.test(K.check(q1, [a1 * 10]).msg));
        const q2 = find('kaeru', 'k-dl2ldl');
        const n2 = Number(q2.text.match(/\d+/)[0]);
        t('23dL → 3L2dL（いれかえ）の ときは「いれかわって」', /いれかわって/.test(K.check(q2, [n2 % 10, Math.floor(n2 / 10)]).msg), q2.text);
        const q3 = find('kaeru', 'k-dl2ml');
        const n3 = Number(q3.text.match(/\d+/)[0]);
        t('3dL → 30mL と した ときは「1dL は 100mL」', /100mL/.test(K.check(q3, [n3 * 10]).msg));
        t('入れて いない わくが ある ときは empty', K.check(q2, [null, 3]).empty === true);

        /* ---------- どっちが 多い ---------- */
        bad = 0;
        let same = 0;
        for (let s = 1; s <= 400; s++) {
            const q = K.makeQuestion('kuraberu', seeded(s), { useMl: true });
            const sc = q.scene;
            const want = sc.left > sc.right ? 'left' : sc.left < sc.right ? 'right' : 'same';
            if (q.answer !== want) bad++;
            if (q.answer === 'same') same++;
            if (sc.leftLabel.replace(/\d/g, '') === sc.rightLabel.replace(/\d/g, '')) bad++;   /* たんいが ちがう こと */
            if (sc.capL * 1000 < Math.max(sc.left, sc.right)) bad++;
        }
        t('どっちが 多い：せいかい・たんいが ちがう・ますが たりる', bad === 0, bad + 'こ');
        t('どっちが 多い：「おなじ」も ときどき 出る（5〜35%）', same > 20 && same < 140, same + '/400');
        const qc = (() => {
            for (let s = 1; s < 3000; s++) {
                const q = K.makeQuestion('kuraberu', seeded(s), { useMl: true });
                if (q.kind === 'c-dl-ml' && q.answer !== 'same') {
                    const ln = parseInt(q.scene.leftLabel, 10), rn = parseInt(q.scene.rightLabel, 10);
                    const bigNum = ln > rn ? 'left' : 'right';
                    if (bigNum !== q.answer) return { q, bigNum };
                }
            }
            return null;
        })();
        t('3dL と 280mL で 280mL を えらぶと「数が 大きい ほうが 多い とは かぎらない」',
            qc && /かぎらない/.test(K.check(qc.q, qc.bigNum).msg));

        /* ---------- どれくらい ---------- */
        t('みのまわりの もの：かさと たんいが あう',
            K.THINGS.every(x => Number.isInteger(x.ml / K.UNIT_ML[x.unit]) && x.ml / K.UNIT_ML[x.unit] >= 1));
        t('どれくらい：L・dL・mL が どれも ある', ['L', 'dL', 'mL'].every(u => K.THINGS.some(x => x.unit === u)));
        bad = 0;
        for (let s = 1; s <= 300; s++) {
            const q = K.makeQuestion('ryoukan', seeded(s), { useMl: s % 2 === 0 });
            if (q.kind === 'r-cups') {
                if (q.after.n * q.after.cup !== q.after.target || q.fields[0].v !== q.after.n) bad++;
            } else if (q.after.type !== 'masu') bad++;
        }
        t('どれくらい：コップ なんばい分 × コップ ＝ かさ', bad === 0, bad + 'こ');

        /* ---------- 計算 ---------- */
        bad = 0;
        const calcProblems = [];
        for (let s = 1; s <= 400; s++) {
            const q = K.makeQuestion('keisan', seeded(s), { useMl: true });
            const [A, B] = q.scene.rows.map(r => r.reduce((a, it) => a + it.ml, 0));
            const res = q.fields.reduce((a, f) => a + f.v * K.UNIT_ML[f.u], 0);
            const want = q.sub.includes('＋') ? A + B : A - B;
            if (res !== want) { bad++; calcProblems.push(q.sub); }
            if (q.fields.length === 2) {
                const a = K.fieldsOf(A, ['L', 'dL']), b = K.fieldsOf(B, ['L', 'dL']);
                /* くりあがり・くりさがり なし（2年の 教科書の はんい） */
                if (q.sub.includes('＋') && a[1].v + b[1].v > 9) { bad++; calcProblems.push('くりあがり ' + q.sub); }
                if (q.sub.includes('−') && a[1].v < b[1].v) { bad++; calcProblems.push('くりさがり ' + q.sub); }
            }
            const after = sumRows(q.after.rows);
            if (after !== res) { bad++; calcProblems.push('あとの 図 ' + q.sub); }
        }
        t('計算：こたえ・くりあがり なし・あとの 図 が ただしい', bad === 0, calcProblems.slice(0, 3).join(' / '));
        const q5 = find('keisan', 'p-ldl-l');
        const [a5, b5, c5] = q5.sub.match(/\d+/g).map(Number);
        t('3L5dL ＋ 2L ＝ 3L7dL の まちがいには「L の ところで」', /L の ところ/.test(K.check(q5, [a5, b5 + c5]).msg), q5.sub);

        /* ---------- つくる ---------- */
        const q6 = find('tsukuru', 't-ldl');
        t('つくる：たりない・多い を つたえる',
            /たりない/.test(K.check(q6, q6.target - 100).msg) && /多い/.test(K.check(q6, q6.target + 200).msg) &&
            K.check(q6, 0).empty === true);
        const q7 = find('tsukuru', 't-ml');
        t('つくる（mL）：100mL たりない と mL で いう', K.check(q7, q7.target - 100).msg === '100mL たりないよ。', K.check(q7, q7.target - 100).msg);

        /* ---------- ほめことば・おわり ---------- */
        t('おわりの ことば：全問 せいかい は パーフェクト', /パーフェクト/.test(K.resultWord(10, 10)) && !/パーフェクト！ かさ/.test(K.resultWord(3, 10)));

        return rows;
    }

    root.runKasaTests = runTests;

    if (typeof module !== 'undefined' && require.main === module) {
        const r = runTests();
        let ng = 0;
        for (const x of r) {
            if (!x.ok) ng++;
            console.log((x.ok ? 'OK  ' : 'NG  ') + x.name + (x.detail && !x.ok ? '  … ' + x.detail : ''));
        }
        console.log(ng ? `\n${ng}こ まちがい（ぜんぶで ${r.length}こ）` : `\nぜんぶ OK（${r.length}こ）`);
        process.exit(ng ? 1 : 0);
    }
})(typeof window !== 'undefined' ? window : globalThis);
