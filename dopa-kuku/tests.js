/* ドパ九九 ── きまりの たしかめ
   node tests.js でも、tests.html を ブラウザで ひらいても 動きます。
   画面や 音を つかわない ところ（logic.js）を しらべます。 */
(function (root) {
    'use strict';
    if (!root.DopaLogic && typeof require === 'function') require('./logic.js');
    const L = root.DopaLogic;

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

        /* コース */
        const C = L.COURSES;
        t('コースは 11しゅるい', C.length === 11, String(C.length));
        t('コースの id は ぜんぶ ちがう', new Set(C.map(c => c.id)).size === C.length);
        t('2〜9の だんは 1つずつ・問題は 9しゅるい',
            [2, 3, 4, 5, 6, 7, 8, 9].every(d => {
                const c = C.find(x => x.dans.length === 1 && x.dans[0] === d);
                return c && L.problemsOf(c).length === 9 && c.name === d + 'のだん';
            }));
        t('ぜんはん は 2〜5の だん・36しゅるい', L.problemsOf(L.courseById('zenhan')).length === 36
            && L.courseById('zenhan').dans.join() === '2,3,4,5');
        t('こうはん は 6〜9の だん・36しゅるい', L.problemsOf(L.courseById('kouhan')).length === 36
            && L.courseById('kouhan').dans.join() === '6,7,8,9');
        t('ぜんぶ は 1〜9の だん・81しゅるい', L.problemsOf(L.courseById('zenbu')).length === 81);
        t('1の だんが 出るのは「ぜんぶ」だけ', C.filter(c => c.dans.includes(1)).map(c => c.id).join() === 'zenbu');
        t('ない コースは null', L.courseById('dan1') === null);

        /* 出題 */
        const rand = seeded(20260928);
        for (const c of C) {
            const avoid = L.avoidCount(c);
            const recent = [];
            const seen = new Set();
            let bad = '';
            for (let i = 0; i < 6000; i++) {
                const q = L.pickQuestion(c, recent, rand);
                const k = L.keyOf(q);
                if (!c.dans.includes(q.a) || q.b < 1 || q.b > 9 || q.ans !== q.a * q.b) { bad = 'はんいの そと ' + k; break; }
                if (recent.slice(-avoid).includes(k)) { bad = `${i}問め ${k} が 直前${avoid}問と おなじ`; break; }
                seen.add(k);
                recent.push(k);
                if (recent.length > 6) recent.shift();
            }
            t(`「${c.name}」：はんいの 中から、直前 ${avoid}問と おなじ 問題を 出さない（6000問）`, !bad, bad);
            t(`「${c.name}」：ぜんぶの 問題が 出てくる`, seen.size === L.problemsOf(c).length, `${seen.size}しゅるい`);
        }
        t('段の コースは 直前3問・ほかは 直前1問を さける',
            C.every(c => L.avoidCount(c) === (c.dans.length === 1 ? 3 : 1)));

        /* はんてい */
        const q78 = { a: 7, b: 8 }, q33 = { a: 3, b: 3 }, q25 = { a: 2, b: 5 };
        t('7×8：1けためでは まだ はんてい しない', !L.judge(q78, '5').done);
        t('7×8：56 で 正解', L.judge(q78, '56').done && L.judge(q78, '56').ok);
        t('7×8：54 で まちがい', L.judge(q78, '54').done && !L.judge(q78, '54').ok);
        t('3×3：1けたで すぐ はんてい（9 は 正解・0 は まちがい）',
            L.judge(q33, '9').ok && L.judge(q33, '0').done && !L.judge(q33, '0').ok);
        t('2×5：1 では まだ・10 で 正解', !L.judge(q25, '1').done && L.judge(q25, '10').ok);
        t('入力が 空なら はんてい しない', !L.judge(q78, '').done);

        /* ドパレベル */
        const lv = [[0, 0], [2, 0], [3, 1], [5, 1], [6, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4],
            [20, 5], [29, 5], [30, 6], [39, 6], [40, 7], [49, 7], [50, 8], [120, 8]];
        const lvBad = lv.filter(([c, v]) => L.levelOf(c) !== v).map(([c]) => c);
        t('ドパレベルの しきい値 0/3/6/10/15/20/30/40/50', !lvBad.length, lvBad.join('、'));
        t('確定演出：50 は 虹ドパ・100 は 特大・60 70 80 90 110 は 確定',
            L.kakuteiOf(50) === 'niji' && L.kakuteiOf(100) === 'hyaku'
            && [60, 70, 80, 90, 110, 150].every(c => L.kakuteiOf(c) === 'kakutei'));
        t('確定演出は 10ごと だけ（40・55・49 は なし）', [0, 10, 40, 49, 55, 101].every(c => L.kakuteiOf(c) === null));
        t('節目の テロップ：5・10・20・30・40・50 …',
            [5, 10, 20, 30, 40, 50, 60, 100].every(L.isMilestone) && ![1, 3, 4, 6, 15, 25, 55].some(L.isMilestone));
        t('虹ドパで タイマーを とめるのは 1.5びょう', L.NIJI_HOLD === 1500);

        /* リーチ */
        const R = (c, b) => L.reachOf(c, b || 0);
        t('リーチ：6れんぞく では まだ（10まで あと4）', R(6) === null);
        t('リーチ：7・8・9れんぞくで 10れんぞく まで あと 3・2・1',
            R(7).left === 3 && R(8).left === 2 && R(9).left === 1 && R(9).label === '10れんぞく');
        t('リーチ：17〜19 は ドパタイム、47〜49 は にじドパ',
            R(17).label === 'ドパタイム' && R(19).left === 1 && R(47).kind === 'niji' && R(49).label === 'にじドパ');
        t('リーチ：27〜29 は 超ドパ、37〜39 は 激アツ', R(27).kind === 'chodopa' && R(39).kind === 'atsu');
        t('リーチ：57〜59 は 60れんぞく（確定）、97〜99 は 100れんぞく',
            R(57).label === '60れんぞく' && R(57).kind === 'kakutei' && R(99).kind === 'hyaku');
        t('リーチ：大演出の すぐ あと（10・11・12）は リーチ なし', R(10) === null && R(11) === null && R(12) === null);
        t('リーチ：さいこう 13 なら 11〜13 で しんきろく まで あと 3〜1',
            R(11, 13).kind === 'newrec' && R(11, 13).left === 3 && R(13, 13).left === 1 && R(13, 13).label === 'しんきろく');
        t('リーチ：さいこう 4 いかは しんきろくの リーチ なし', R(2, 4) === null && R(4, 4) === null);
        t('リーチ：しんきろくと ドパタイムが かさなる ときは 両方 出す',
            R(17, 19).label === 'ドパタイム＆しんきろく' && R(17, 19).kind === 'dopa' && R(7, 9).label === 'しんきろく＆10れんぞく');
        t('リーチ：しんきろくが 先に くる ときは しんきろく', R(15, 15).kind === 'newrec' && R(15, 15).target === 16);
        t('リーチ：0れんぞくでは リーチ なし', R(0) === null && R(0, 30) === null);

        /* きろく */
        t('きろくの キーは コース と 制限時間ごと', L.bestKey('zenbu', 5) === 'zenbu_5' && L.bestKey('dan7', 3) === 'dan7_3');
        const top = L.topMiss({ '7x8': 4, '6x7': 4, '8x4': 2, '3x4': 1, '9x9': 7, '4x6': 3, 'bad': 9, '0x1': 5, '2x2': 0 }, 5);
        t('にがてな九九：回数が 多い じゅんに 上位5問', top.map(x => x.key).join() === '9x9,6x7,7x8,4x6,8x4',
            top.map(x => x.key).join());
        t('にがてな九九：きろくが なければ 空', L.topMiss({}).length === 0 && L.topMiss(null).length === 0);
        const cnt = L.sanitizeCounts({ a: 3, b: -1, c: 'x', d: 2.7 });
        t('こわれた きろくは すてる', cnt.a === 3 && !('b' in cnt) && !('c' in cnt) && cnt.d === 2);

        /* せってい */
        const d = L.sanitizeSettings(null);
        t('せっていの 初期値：5びょう・効果音 オン・BGM オン・演出は 端末しだい',
            d.limit === 5 && d.sound === true && d.bgm === true && d.fx === null);
        t('制限時間は 3・5・7 だけ', L.sanitizeSettings({ limit: 3 }).limit === 3 && L.sanitizeSettings({ limit: 7 }).limit === 7
            && L.sanitizeSettings({ limit: 4 }).limit === 5 && L.sanitizeSettings({ limit: '7' }).limit === 7);
        t('演出は ド派手／ひかえめ', L.sanitizeSettings({ fx: 'hikaeme' }).fx === 'hikaeme'
            && L.sanitizeSettings({ fx: 'hade' }).fx === 'hade' && L.sanitizeSettings({ fx: 'x' }).fx === null);
        t('効果音・BGM の オフが のこる', L.sanitizeSettings({ sound: false, bgm: false }).sound === false
            && L.sanitizeSettings({ sound: false, bgm: false }).bgm === false);

        /* となえかた */
        let kukuOk = true;
        for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (!L.kukuReading(a, b)) kukuOk = false;
        t('81こ ぜんぶ となえかたが ある', kukuOk);
        t('7×8 は「しちは ごじゅうろく」', L.kukuReading(7, 8) === 'しちは ごじゅうろく');

        return rows;
    }

    root.runDopaTests = runTests;

    if (typeof module !== 'undefined' && require.main === module) {
        const rows = runTests();
        const ng = rows.filter(r => !r.ok);
        for (const r of rows) console.log(`${r.ok ? 'OK' : 'NG'}  ${r.name}${r.detail && !r.ok ? '（' + r.detail + '）' : ''}`);
        console.log(ng.length ? `\n${ng.length}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
        process.exit(ng.length ? 1 : 0);
    }
})(typeof window !== 'undefined' ? window : globalThis);
