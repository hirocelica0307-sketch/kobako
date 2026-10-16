/* 速読ラボ ── 自動テスト
   node tests.js でも、tests.html をブラウザで開いても動きます。
   画面を使わない処理（logic.js）と、練習用の文章（texts.js）を確かめます。 */
(function (root) {
    'use strict';
    if (!root.SokuLogic && typeof require === 'function') { require('./logic.js'); require('./texts.js'); }
    const L = root.SokuLogic;
    const TEXTS = root.SokuTexts.TEXTS;

    const chunksOf = s => L.chunkLine(s).map(c => c.map(u => u.t).join(''));

    /** テスト用の青空文庫形式のテキスト（このテストのために書いたもの） */
    const AOZORA = [
        '小さな｜試験《しけん》',
        '速読ラボ',
        '',
        '-------------------------------------------------------',
        '【テキスト中に現れる記号について】',
        '',
        '《》：ルビ',
        '（例）試験《しけん》',
        '-------------------------------------------------------',
        '',
        '［＃３字下げ］一［＃「一」は中見出し］',
        '',
        '　朝の駅は静寂《せいじゃく》につつまれていた。［＃「静寂」に傍点］',
        '　彼は※［＃「土へん＋竒」、U+57FC、12-3］玉から来たという。',
        '　ときどき／＼空を見あげた。',
        '',
        '［＃改ページ］',
        '　おわり。',
        '',
        '',
        '底本：「テスト全集」テスト出版',
        '入力：だれか',
        '校正：だれか',
    ].join('\r\n');

    /** 1ファイルだけ入った zip を作る（method 0 = 圧縮なし・8 = deflate） */
    function makeZip(name, data, method) {
        const enc = new TextEncoder();
        const nm = enc.encode(name);
        const local = new Uint8Array(30 + nm.length + data.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, method, true);
        lv.setUint32(18, data.length, true); lv.setUint16(26, nm.length, true);
        local.set(nm, 30); local.set(data, 30 + nm.length);
        const cen = new Uint8Array(46 + nm.length);
        const cv = new DataView(cen.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, method, true);
        cv.setUint32(20, data.length, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, 0, true);
        cen.set(nm, 46);
        const end = new Uint8Array(22);
        const ev = new DataView(end.buffer);
        ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true);
        ev.setUint32(12, cen.length, true); ev.setUint32(16, local.length, true);
        const all = new Uint8Array(local.length + cen.length + end.length);
        all.set(local, 0); all.set(cen, local.length); all.set(end, local.length + cen.length);
        return all.buffer;
    }

    async function runTests() {
        const rows = [];
        const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

        /* ---------- 文字の種類と数え方 ---------- */
        t('charClass：漢・か・カ・A・、・「・空白', ['漢', 'か', 'カ', 'A', '、', '「', '　'].map(L.charClass).join('') === 'KHTACOS');
        t('countChars：空白と改行は数えない', L.countChars('あい う\n　え') === 4, L.countChars('あい う\n　え'));
        t('countChars：ルビのよみは数えない', L.countChars('｜邪智暴虐《じゃちぼうぎゃく》の王') === 6, L.countChars('｜邪智暴虐《じゃちぼうぎゃく》の王'));
        t('countChars：句読点・かぎかっこは数える', L.countChars('「はい。」') === 5);

        /* ---------- ルビ ---------- */
        const p1 = L.parseInline('｜東京《とうきょう》の空');
        t('parseInline：｜親文字《よみ》', p1[0].t === '東京' && p1[0].r === 'とうきょう' && p1.length === 3, JSON.stringify(p1));
        const p2 = L.parseInline('かの邪智暴虐《じゃちぼうぎゃく》の王');
        t('parseInline：｜の無いルビは直前の漢字の続きにかかる', p2[2].t === '邪智暴虐' && p2[2].r === 'じゃちぼうぎゃく' && p2[1].t === 'の', JSON.stringify(p2.slice(0, 4)));
        t('parseInline：閉じていない《 はそのまま文字', L.parseInline('あ《い').map(u => u.t).join('') === 'あ《い');
        t('plainText：ルビを外す', L.plainText('｜試験《しけん》に出る') === '試験に出る');

        /* ---------- 文節の区切り ---------- */
        const c1 = chunksOf('読書速度を上げるには、語彙を増やすことが大切だ。');
        t('chunkLine：ひらがなの後の漢字で区切る', c1.join('|') === '読書速度を|上げるには、|語彙を|増やすことが|大切だ。', c1.join('|'));
        const c2 = chunksOf('「東京タワーに行こう」と彼は言った。');
        t('chunkLine：かぎかっこは前後で区切る', c2[0] === '「東京タワーに' && c2[1] === '行こう」', c2.join('|'));
        const c3 = chunksOf('　メロスは激怒した。');
        t('chunkLine：段落のはじめの全角空白は最初のまとまりに入る', c3[0] === '　メロスは' && c3.length === 2, c3.join('|'));
        const c4 = L.chunkLine('かの｜邪智暴虐《じゃちぼうぎゃく》の王');
        t('chunkLine：ルビつきの親文字は分けない', c4.some(c => c.length === 2 && c[0].r === 'じゃちぼうぎゃく' && c[1].t === 'の'), JSON.stringify(c4.map(c => c.map(u => u.t).join(''))));
        const long = 'それはまったくもってどうしようもないことだったのかもしれないとおもった。';
        const c5 = chunksOf(long);
        t('chunkLine：長いひらがなの並びも短く分ける（文字は1つも失わない）', c5.length >= 3 && c5.join('') === long, c5.join('|'));
        const all = TEXTS.map(x => x.body).join('\n');
        const lay = L.layout(all);
        const joined = lay.map(p => p.chunks.map(c => c.units.map(u => u.t).join('')).join('')).join('\n');
        t('layout：オリジナル全文で、区切ったあとも文字がそのまま', joined === L.plainText(all).split('\n').map(l => (l.trim() ? l : '')).join('\n'));
        const lensSum = lay.reduce((s, p) => s + p.chunks.reduce((a, c) => a + c.len, 0), 0);
        t('layout：まとまりの文字数の合計 ＝ countChars', lensSum === L.countChars(all), lensSum + ' / ' + L.countChars(all));
        const maxChunk = Math.max(...lay.flatMap(p => p.chunks.map(c => c.len)));
        t('layout：オリジナル全文で、いちばん長いまとまりも16字以下', maxChunk <= 16, String(maxChunk));

        /* ---------- 青空文庫 ---------- */
        const a = L.cleanAozora(AOZORA);
        t('cleanAozora：題名と著者（ルビは外す）', a.title === '小さな試験' && a.author === '速読ラボ', a.title + ' / ' + a.author);
        t('cleanAozora：記号の説明を除く', !/テキスト中に現れる記号/.test(a.body) && !/-----/.test(a.body));
        t('cleanAozora：注記［＃…］を除く', !/［＃/.test(a.body), a.body);
        t('cleanAozora：ルビは｜つきの形でそろえる', a.body.includes('｜静寂《せいじゃく》'), a.body);
        t('cleanAozora：U+ のある外字はその字にする', a.body.includes('埼玉'), a.body);
        t('cleanAozora：くの字点 ／＼ を 〱 にする', a.body.includes('ときどき〱'), a.body);
        t('cleanAozora：底本からあとは credit に分ける', a.credit.startsWith('底本：') && a.credit.includes('校正：') && !a.body.includes('底本'), a.credit);
        t('cleanAozora：改行は \\n だけ・3つ以上続く空行はつめる', !/\r/.test(a.body) && !/\n{3,}/.test(a.body));
        t('cleanAozora：U+ の無い外字は〓', L.cleanAozora('あ※［＃「てへん＋劣」、第3水準1-84-77］い').body === 'あ〓い');
        t('cleanAozora：記号の説明の無いふつうの文章は、そのまま本文', L.cleanAozora('一行め\n二行め').body === '一行め\n二行め');
        t('looksAozora：ルビ・注記・底本のどれかで判定', L.looksAozora('漢字《かんじ》') && L.looksAozora('［＃改ページ］') && !L.looksAozora('ふつうの文章です。'));

        /* ---------- 区間 ---------- */
        const paras = Array.from({ length: 30 }, (_, i) => 'あ'.repeat(200) + i).join('\n');
        const secs = L.splitSections(paras, 2000);
        t('splitSections：約2000字ずつ・文字を失わない', secs.length === 3 && secs.join('\n') === paras, secs.map(s => L.countChars(s)).join(','));
        const secs2 = L.splitSections('あ'.repeat(2100) + '\n' + 'い'.repeat(100), 2000);
        t('splitSections：残りが短いときは前にまぜる', secs2.length === 1, String(secs2.length));
        t('splitSections：短い文章は1区間', L.splitSections('みじかい。', 2000).length === 1);

        /* ---------- zip ---------- */
        const sjis = new Uint8Array([0x82, 0xa0, 0x82, 0xa2]); // Shift_JIS の「あい」
        const z0 = await L.unzipFirstText(makeZip('test.txt', sjis, 0), () => { throw new Error('inflate は呼ばない'); });
        t('unzipFirstText：圧縮なしの zip から .txt を取り出す', z0.length === 4 && z0[0] === 0x82);
        t('decodeText：Shift_JIS を読む', L.decodeText(sjis) === 'あい');
        t('decodeText：UTF-8 はそのまま', L.decodeText(new TextEncoder().encode('速読')) === '速読');
        if (typeof require === 'function') {
            const zlib = require('zlib');
            const raw = new TextEncoder().encode('deflate のテスト');
            const def = new Uint8Array(zlib.deflateRawSync(raw));
            const z8 = await L.unzipFirstText(makeZip('a/b.txt', def, 8), async d => new Uint8Array(zlib.inflateRawSync(d)));
            t('unzipFirstText：deflate の zip（node の zlib で確かめる）', new TextDecoder().decode(z8) === 'deflate のテスト');
        }
        let zerr = '';
        try { await L.unzipFirstText(new Uint8Array([1, 2, 3]).buffer, null); } catch (e) { zerr = e.message; }
        t('unzipFirstText：zip でないものはエラー', /zip/.test(zerr), zerr);

        /* ---------- 速さと理解度 ---------- */
        t('cpm：900字を2分 → 450字/分', L.cpm(900, 120000) === 450);
        t('cpm：時間0 → 0', L.cpm(900, 0) === 0);
        t('effective：500字/分 × 80% → 400', L.effective(500, 80) === 400 && L.effective(500, null) === null);
        t('score：4問中3問 → 75%', L.score([0, 1, 2, 0], [{ answer: 0 }, { answer: 1 }, { answer: 2 }, { answer: 3 }]) === 75);
        t('selfComp：1〜5 → 20〜100%', [1, 2, 3, 4, 5].map(L.selfComp).join() === '20,40,60,80,100' && L.selfComp(0) === null);
        t('nextPace：80%以上で5%上げる', L.nextPace(500, 80) === 530 && L.nextPace(500, 100) === 530, String(L.nextPace(500, 80)));
        t('nextPace：60%未満で10%下げる', L.nextPace(500, 50) === 450);
        t('nextPace：60〜79%はそのまま', L.nextPace(500, 75) === 500 && L.nextPace(500, 60) === 500);
        t('nextPace：下限と上限', L.nextPace(150, 0) === L.PACE_MIN && L.nextPace(3000, 100) === L.PACE_MAX);
        t('startPace：ふだんの1.1倍・記録なしは450の1.1倍', L.startPace(500) === 550 && L.startPace(null) === 500, L.startPace(null));
        t('skimLimitMs：900字・450字/分 → 48秒（2分の40%）', L.skimLimitMs(900, 450) === 48000);
        t('skimLimitMs：最短15秒', L.skimLimitMs(10, 450) === 15000);

        /* ---------- ペースガイドの時間割 ---------- */
        const sch = L.schedule([5, 5, 10], 600); // 1字 100ms
        t('schedule：字数に比例した開始時刻', sch.join() === '0,500,1000,2000', sch.join());
        t('indexAt：時刻から読んでいるまとまり', L.indexAt(sch, 0) === 0 && L.indexAt(sch, 499) === 0 && L.indexAt(sch, 500) === 1 && L.indexAt(sch, 1999) === 2);
        t('indexAt：最後をこえたら長さ（読み終わり）', L.indexAt(sch, 2000) === 3 && L.indexAt(sch, 99999) === 3);

        /* ---------- 記録のまとめ ---------- */
        const recs = [
            { mode: 'check', cpm: 400 }, { mode: 'pace', cpm: 900 }, { mode: 'check', cpm: 500 },
            { mode: 'repeat', cpm: 700, rounds: [450, 600, 700] }, { mode: 'skim', cpm: 1500 },
        ];
        t('baseline：速さチェックとくり返し1回めの中央値（ペース・要点は入れない）', L.baseline(recs) === 450, String(L.baseline(recs)));
        t('baseline：記録なし → null', L.baseline([]) === null);

        /* ---------- 問題 ---------- */
        let seed = 7;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const q = { q: 'x', choices: ['正', 'a', 'b', 'c'], answer: 0 };
        const sq = L.shuffleQuestion(q, rng);
        t('shuffleQuestion：並べかえても正解の中身は同じ', sq.choices[sq.answer] === '正' && sq.choices.length === 4);

        /* ---------- 練習用の文章 ---------- */
        const ids = new Set();
        let bad = [];
        for (const x of TEXTS) {
            if (ids.has(x.id)) bad.push(x.id + ' id がかぶる');
            ids.add(x.id);
            if (!x.title || !x.body || ![1, 2, 3].includes(x.level)) bad.push(x.id + ' 題名・本文・level');
            if (x.questions.length < 4) bad.push(x.id + ' 問題が4問より少ない');
            if (!x.questions.some(q => q.type === 'main')) bad.push(x.id + ' 要点の問題がない');
            for (const q of x.questions) {
                if (q.choices.length !== 4) bad.push(x.id + ' 選択肢が4つでない');
                if (!(q.answer >= 0 && q.answer < q.choices.length)) bad.push(x.id + ' answer の番号');
                if (!['main', 'detail', 'infer'].includes(q.type)) bad.push(x.id + ' type');
                if (new Set(q.choices).size !== q.choices.length) bad.push(x.id + ' 同じ選択肢');
            }
            const n = L.countChars(x.body);
            if (n < 600 || n > 1400) bad.push(x.id + ' 字数 ' + n);
        }
        t('練習用の文章：' + TEXTS.length + '本・形が正しい（4問以上・4択・要点の問題あり・600〜1400字）', !bad.length && TEXTS.length >= 8, bad.join(' / '));

        /* ---------- 表示 ---------- */
        t('fmtTime：65秒 → 1分05秒・42秒', L.fmtTime(65000) === '1分05秒' && L.fmtTime(42000) === '42秒');
        return rows;
    }

    root.runSokuTests = runTests;

    if (typeof module !== 'undefined' && require.main === module) {
        runTests().then(rows => {
            for (const r of rows) console.log((r.ok ? 'OK  ' : 'NG  ') + r.name + (r.ok || !r.detail ? '' : '\n      ' + r.detail));
            const ng = rows.filter(r => !r.ok).length;
            console.log(ng ? `\n${ng}こ まちがい（ぜんぶで ${rows.length}こ）` : `\nぜんぶ OK（${rows.length}こ）`);
            process.exit(ng ? 1 : 0);
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
