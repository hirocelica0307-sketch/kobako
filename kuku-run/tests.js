/* 九九ラン ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面や 音を つかわない ところ（logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.KukuRunLogic && typeof require === 'function') require('./logic.js');
    const L = root.KukuRunLogic;

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

    function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* ---------- コース ---------- */
        const C = L.COURSES;
        t('コースは 12しゅるい', C.length === 12, String(C.length));
        t('コースの id は ぜんぶ ちがう', new Set(C.map(c => c.id)).size === C.length);
        t('1〜9の だんは 1つずつ・問題は 9しゅるい',
            [1, 2, 3, 4, 5, 6, 7, 8, 9].every(d => {
                const c = C.find(x => x.dans.length === 1 && x.dans[0] === d);
                return c && L.problemsOf(c).length === 9 && c.name === d + 'のだん';
            }));
        t('2〜5のだん は 2・3・4・5の だん・36しゅるい',
            L.courseById('zenhan').dans.join() === '2,3,4,5' && L.problemsOf(L.courseById('zenhan')).length === 36);
        t('6〜9のだん は 6・7・8・9の だん・36しゅるい',
            L.courseById('kouhan').dans.join() === '6,7,8,9' && L.problemsOf(L.courseById('kouhan')).length === 36);
        t('ぜんぶ は 1〜9の だん・81しゅるい', L.problemsOf(L.courseById('zenbu')).length === 81);
        t('ない コースは null', L.courseById('dan10') === null);

        /* ---------- こたえの パネル ---------- */
        {
            const r = seeded(1);
            let bad = '';
            for (const n of [2, 3]) {
                for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
                    for (let k = 0; k < 8; k++) {
                        const c = L.choicesFor(a, b, n, r);
                        const okLen = c.answers.length === n;
                        const okAns = c.answers[c.correct] === a * b;
                        const uniq = new Set(c.answers).size === n;
                        const pos = c.answers.every(v => v > 0 && v <= 99 && Number.isInteger(v));
                        const once = c.answers.filter(v => v === a * b).length === 1;
                        if (!(okLen && okAns && uniq && pos && once)) bad = `${a}×${b} (${n}まい) → ${c.answers}`;
                    }
                }
            }
            t('パネルは 2まい・3まい とも、正解が 1まいだけ・数が ぜんぶ ちがう（1×1〜9×9）', !bad, bad);
        }
        {
            const r = seeded(2);
            let near = 0, total = 0;
            for (let i = 0; i < 400; i++) {
                const c = L.choicesFor(7, 8, 2, r);
                const w = c.answers[1 - c.correct];
                total++;
                if (w === 49 || w === 63) near++;
            }
            t('7×8 の まちがいパネルは「おなじ だんの となり（49・63）」が いちばん 多い', near / total > 0.4, `${near}/${total}`);
        }
        {
            const r = seeded(3);
            const cnt = [0, 0, 0];
            for (let i = 0; i < 3000; i++) cnt[L.choicesFor(6, 7, 3, r).correct]++;
            t('正解の ばしょは 左・まんなか・右に ばらける', cnt.every(x => x > 800), cnt.join(' / '));
        }

        /* ---------- 出題の 山 ---------- */
        {
            const course = L.courseById('dan7');
            const d = L.createDeck({ problems: L.problemsOf(course), rand: seeded(4) });
            const seen = [];
            let rep = '';
            for (let i = 0; i < 300; i++) {
                const q = d.next();
                if (q.a !== 7) rep = '7の だん いがい ' + q.key;
                const last3 = seen.slice(-3);
                if (last3.includes(q.key)) rep = `${i}問め ${q.key} が 3問いないに 2回`;
                seen.push(q.key);
                d.report(q, true);
            }
            t('だんの コースは その だん だけ・直前 3問と おなじ 問題は 出ない', !rep, rep);
            const kinds = new Set(seen).size;
            t('だんの コースは 9しゅるい ぜんぶ 出る', kinds === 9, String(kinds));
        }
        {
            /* ゲートは 3つ さきまで きまっている：next を 3回 してから こたえる ながれを まねる */
            const d = L.createDeck({ problems: L.problemsOf(L.courseById('zenbu')), rand: seeded(5) });
            const queue = [d.next(), d.next(), d.next()];
            let missKey = null, missAt = -1;
            const order = [];
            const appear = [];
            for (let i = 0; i < 40; i++) {
                const q = queue.shift();
                order.push(q);
                const isMiss = i === 5;
                if (isMiss) { missKey = q.key; missAt = i; }
                d.report(q, !isMiss);
                if (q.key === missKey && i > missAt) appear.push({ i, review: q.review });
                queue.push(d.next());
            }
            t('まちがえた 九九は 3〜5問 あとに「もういちど」で 出る',
                appear.length >= 1 && appear[0].i - missAt >= 3 && appear[0].i - missAt <= 5 && appear[0].review,
                JSON.stringify(appear));
            t('おさらいで 正解したら、もう1回 あとで 出て（2回め）、それで おわり',
                appear.length === 2 && appear[1].review && appear[1].i - appear[0].i >= 4 && appear[1].i - appear[0].i <= 8,
                JSON.stringify(appear));
            t('おさらいが おわったら のこりの おさらいは 0', d.reviews.length === 0, JSON.stringify(d.reviews));
        }
        {
            /* おさらいで また まちがえたら やりなおし */
            const d = L.createDeck({ problems: L.problemsOf(L.courseById('kouhan')), rand: seeded(6) });
            const queue = [d.next(), d.next(), d.next()];
            let target = null, fails = 0;
            const appear = [];
            for (let i = 0; i < 60; i++) {
                const q = queue.shift();
                let ok = true;
                if (i === 2) { target = q.key; ok = false; }
                else if (q.key === target) {
                    appear.push(i);
                    if (fails === 0) { ok = false; fails++; }
                }
                d.report(q, ok);
                queue.push(d.next());
            }
            t('おさらいで また まちがえると、正解 2回 まで くりかえし 出る', appear.length === 3, appear.join(','));
        }
        {
            /* にがてほど よく 出る */
            const stats = { '8x7': { ok: 0, ng: 5 } };
            const d = L.createDeck({ problems: L.problemsOf(L.courseById('dan8')), stats, rand: seeded(7) });
            let n = 0;
            for (let i = 0; i < 900; i++) { const q = d.next(); if (q.key === '8x7') n++; d.report(q, true); }
            t('にがての 九九（8×7）は ほかより よく 出る', n > 900 / 9 * 1.3, `${n}/900`);
        }
        {
            /* にがて れんしゅう：きめた 問題を 2回ずつ 正解したら おわり */
            const req = [{ a: 8, b: 9 }, { a: 7, b: 3 }];
            const probs = L.problemsOf({ dans: [7, 8] });
            const d = L.createDeck({ problems: probs, required: req, rand: seeded(8) });
            const queue = [d.next(), d.next(), d.next()];
            let steps = 0, reqSeen = 0;
            while (!d.done() && steps < 100) {
                const q = queue.shift();
                if (q.key === '8x9' || q.key === '7x3') reqSeen++;
                d.report(q, true);
                queue.push(d.next());
                steps++;
            }
            t('にがて れんしゅうは きめた 九九を 2回ずつ 正解すると おわる', d.done() && reqSeen >= 4 && steps < 40, `${steps}問・きめた 九九 ${reqSeen}回`);
            t('にがて れんしゅうの のこりは 0', d.left() === 0, String(d.left()));
        }
        {
            const d = L.createDeck({ problems: L.problemsOf({ dans: [5] }), required: [{ a: 5, b: 3 }], rand: seeded(9) });
            t('にがて れんしゅうの はじめは のこり 1・おわって いない', !d.done() && d.left() === 1);
        }

        /* ---------- にがて ---------- */
        t('にがての つよさ：まちがい 2回・正解 1回 → 3', L.weakScore({ ok: 1, ng: 2 }) === 3);
        t('にがての つよさ：正解が 多いと 0', L.weakScore({ ok: 9, ng: 2 }) === 0);
        t('にがての つよさは 6 まで', L.weakScore({ ok: 0, ng: 20 }) === 6);
        {
            const w = L.weakList({ '7x8': { ok: 0, ng: 3 }, '6x9': { ok: 1, ng: 1 }, '2x2': { ok: 5, ng: 0 }, 'bad': { ok: 1, ng: 9 } });
            t('にがての いちらんは つよい じゅん・にがてで ない ものと こわれた キーは 入らない',
                w.map(x => x.key).join() === '7x8,6x9', w.map(x => x.key).join());
        }

        /* ---------- ほめことば・はやさ ---------- */
        t('ほめことば：1→せいかい・5→いいね・10→すごい・20→ちょうはやい・30→でんせつ',
            [1, 5, 10, 20, 30, 99].map(L.praiseOf).join() === 'せいかい！,いいね！,すごい！,ちょうはやい！,でんせつ！！,でんせつ！！');
        t('5れんぞく ごとに 画面が ひかる', L.isFlash(5) && L.isFlash(10) && !L.isFlash(0) && !L.isFlash(7));
        {
            const cfg = L.speedOf('futsuu');
            let v = cfg.start;
            for (let i = 0; i < 100; i++) v = L.speedUp(v, cfg);
            t('はやさは さいこうで とまる', v === cfg.max, String(v));
            t('はやさ：ゆっくり＜ふつう＜はやい', L.SPEEDS.yukkuri.max < L.SPEEDS.futsuu.max && L.SPEEDS.futsuu.max < L.SPEEDS.hayai.max);
            t('しらない はやさは ふつう', L.speedOf('zzz') === L.SPEEDS.futsuu);
        }

        /* ---------- きろく ---------- */
        {
            const s = L.sanitizeSettings({ course: 'zzz', mode: 'x', miss: 7, panels: 4, speed: 'q', voice: false });
            t('こわれた せっていは 初期値（コース 2のだん・れんぞく・ミス 3・パネル 2・ふつう）',
                s.course === 'dan2' && s.mode === 'renzoku' && s.miss === 3 && s.panels === 2 && s.speed === 'futsuu' && s.voice === false && s.sound === true);
            const s2 = L.sanitizeSettings({ course: 'kouhan', mode: 'time', miss: 5, panels: 3, speed: 'hayai', lite: true });
            t('ただしい せっていは そのまま', s2.course === 'kouhan' && s2.mode === 'time' && s2.miss === 5 && s2.panels === 3 && s2.speed === 'hayai' && s2.lite);
        }
        {
            const st = L.sanitizeStats({ '7x8': { ok: 2, ng: '3' }, '0x1': { ok: 1 }, '6x6': null, '5x5': { ok: -1, ng: 0 } });
            t('九九の きろくの こわれた ところを すてる', JSON.stringify(st) === '{"7x8":{"ok":2,"ng":3}}', JSON.stringify(st));
            const b = L.sanitizeBest({ a: 3, b: -1, c: 'x', d: 2.7 });
            t('ベストの こわれた ところを すてる', JSON.stringify(b) === '{"a":3,"d":2}', JSON.stringify(b));
        }

        /* ---------- となえかた ---------- */
        {
            let all = true;
            for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (!L.kukuReading(a, b)) all = false;
            t('81この となえかたが ぜんぶ ある', all);
        }
        t('となえかた：8×9 は「はっく しちじゅうに」', L.kukuReading(8, 9) === 'はっく しちじゅうに');
        t('もんだいの ところ：7×4 →「しちし」・2×2 →「ににん」・1×1 →「いんいち」',
            L.kukuQuestionPart(7, 4) === 'しちし' && L.kukuQuestionPart(2, 2) === 'ににん' && L.kukuQuestionPart(1, 1) === 'いんいち',
            [L.kukuQuestionPart(7, 4), L.kukuQuestionPart(2, 2), L.kukuQuestionPart(1, 1)].join());

        return rows;
    }

    root.runKukuRunTests = runTests;

    if (typeof module !== 'undefined' && require.main === module) {
        const r = runTests();
        const ng = r.filter(x => !x.ok);
        for (const x of r) console.log((x.ok ? 'OK ' : 'NG ') + x.name + (x.ok ? '' : '  … ' + x.detail));
        console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${r.length}こ）` : `\nぜんぶ OK（${r.length}こ）`);
        process.exitCode = ng.length ? 1 : 0;
    }
})(typeof window !== 'undefined' ? window : globalThis);
