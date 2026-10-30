/* かんじプリントの しくみの たしかめ（node tests.js で 動きます） */
'use strict';
const K = require('./logic.js');

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const J = x => JSON.stringify(x);

/* ---------- 漢字の 表 ---------- */
t('1年の 漢字は 80字', [...K.KANJI1].length === 80 && new Set(K.KANJI1).size === 80);
t('2年の 漢字は 160字', [...K.KANJI2].length === 160 && new Set(K.KANJI2).size === 160);
t('1年と 2年に 同じ 字が ない', [...K.KANJI2].every(c => !K.KANJI1.includes(c)));

/* ---------- 例文 ---------- */
const s1 = K.parseSentence('[春](はる)に なると 花が さく');
t('1字の もんだい', !s1.error && s1.target.text === '春' && s1.target.reading === 'はる' && !s1.target.kana && s1.after === 'に なると 花が さく', J(s1));
const s2 = K.parseSentence('[新しい](あたらしい) くつ');
t('送りがなを わける', !s2.error && s2.target.head === '新' && s2.target.okuri === 'しい' && s2.target.headReading === 'あたら' && s2.target.kana, J(s2));
const s3 = K.parseSentence('［電車］（でんしゃ）に　のる');
t('全角の かっこ・空白でも よめる', !s3.error && s3.line === '[電車](でんしゃ)に のる' && J(s3.target.kanji) === J(['電', '車']), J(s3));
t('[ ] が ない → エラー', !!K.parseSentence('はるに なる').error);
t('読みが ない → エラー', !!K.parseSentence('[春]に なる').error);
t('読みが カタカナ → エラー', !!K.parseSentence('[春](ハル)').error);
t('もんだいが 2つ → エラー', !!K.parseSentence('[春](はる)と [夏](なつ)').error);
t('送りがなと 読みが あわない → エラー', !!K.parseSentence('[近く](ちかい)').error);
t('かなから はじまる → エラー', !!K.parseSentence('[お正月](おしょうがつ)').error);

const bank = K.parseBank('# メモ\n[春](はる)が 来る\n\n[春](はる)が 来る\nだめ\n[鉛](なまり)の 先');
t('メモと 空の 行は とばす', bank.length === 4, bank.length);
t('同じ 例文は エラー', bank[1].error && /同じ/.test(bank[1].error));
t('行の 番号', J(bank.map(b => b.lineNo)) === J([2, 4, 5, 6]));
t('1・2年に ない 漢字を 見つける', J(bank[3].unknown) === J(['鉛']), J(bank[3].unknown));

/* ---------- 単元 ---------- */
const U = K.parseUnits('1, たんげんA, 春夏\n１\tたんげんB\t秋冬\n2｜たんげんC｜朝 昼\n4, まちがい, 夜\n1, かんじなし, はる');
t('カンマ・タブ・｜で よめる', U.units.length === 3 && J(U.units.map(u => u.term)) === J([1, 1, 2]) && J(U.units[2].kanji) === J(['朝', '昼']), J(U.units));
t('学期の まちがい・漢字なしは エラー', U.errors.length === 2 && U.errors[0].lineNo === 4, J(U.errors));

/* ---------- はんい ---------- */
const units = U.units;
const rT = K.rangeOf(units, 'term', [2]);
t('学期で えらぶ', J([...rT.R]) === J(['朝', '昼']) && rT.allowed.has('春') && rT.allowed.has('一'));
const rU = K.rangeOf(units, 'unit', [1]);
t('単元で えらぶ（前の 単元は 習った ことに する）', J([...rU.R]) === J(['秋', '冬']) && rU.allowed.has('春') && !rU.allowed.has('朝'));
const rK = K.rangeOf(units, 'kanji', ['朝']);
t('漢字で えらぶ', J([...rK.R]) === J(['朝']) && rK.allowed.has('朝') && !rK.allowed.has('昼'));
const b2 = K.parseBank('[朝](あさ)\n[朝日](あさひ)\n[昼](ひる)\n[朝昼](あさひる)');
t('はんいの 漢字を ふくむ 例文だけ', J(b2.filter(p => K.eligible(p, rK)).map(p => p.target.text)) === J(['朝', '朝日']));
t('習って いない 漢字を ふくむ 熟語は 出さない', !K.eligible(b2[3], rK) && K.eligible(b2[3], rT));

/* ---------- もんだいを えらぶ ---------- */
const many = K.parseBank([...'春夏秋冬朝昼夜'].flatMap(c => [`[${c}](よみ)の 一`, `[${c}](よみ)の 二`, `[${c}](よみ)の 三`]).join('\n'));
const rAll = K.rangeOf([], 'kanji', [...'春夏秋冬朝昼夜']);
const pk = K.pickQuestions(many, rAll, { yomi: 3, kaki: 4 }, 42);
const pkK = pk.questions.map(q => K.parseSentence(q.line).target.text);
t('7もん → 7字 ぜんぶ ちがう 字（かたよりなく）', pk.questions.length === 7 && new Set(pkK).size === 7, J(pkK));
t('読みが さき・書きが あと', J(pk.questions.map(q => q.kind)) === J(['yomi', 'yomi', 'yomi', 'kaki', 'kaki', 'kaki', 'kaki']));
const pk14 = K.pickQuestions(many, rAll, { yomi: 0, kaki: 14 }, 7);
const cnt = {}; pk14.questions.forEach(q => { const c = K.parseSentence(q.line).target.text; cnt[c] = (cnt[c] || 0) + 1; });
t('14もん → 1字 2もんずつ', Object.values(cnt).every(v => v === 2) && Object.keys(cnt).length === 7, J(cnt));
t('同じ 例文は 2かい 出ない', new Set(pk14.questions.map(q => q.line)).size === 14);
t('同じ たね → 同じ もんだい', J(K.pickQuestions(many, rAll, { yomi: 2, kaki: 3 }, 9)) === J(K.pickQuestions(many, rAll, { yomi: 2, kaki: 3 }, 9)));
const few = K.pickQuestions(many.slice(0, 4), rAll, { yomi: 0, kaki: 10 }, 1);
t('例文が たりない ときは 数を おしえる', few.questions.length === 4 && few.short === 6);
const rp = K.replaceOne(pk.questions, 0, many, rAll, 3);
t('入れかえは ちがう 例文・しゅるいは そのまま', rp && !pk.questions.some(q => q.line === rp.line) && rp.kind === pk.questions[0].kind, J(rp));
t('入れかえる 例文が ない → null', K.replaceOne([{ line: many[0].line, kind: 'kaki' }], 0, many.slice(0, 1), rAll, 3) === null);

/* ---------- テストの 紙 ---------- */
const g5 = K.testGeometry(5), g10 = K.testGeometry(10), g15 = K.testGeometry(15), g20 = K.testGeometry(20);
t('5・10もんは A4、15・20もんは B4（よこ）', g5.paper === 'A4L' && g10.paper === 'A4L' && g15.paper === 'B4L' && g20.paper === 'B4L');
t('5もんは 1だん、10もんから 2だん', g5.rows === 1 && g10.rows === 2 && g10.perRow === 5 && g15.perRow === 8 && g20.perRow === 10);
t('れんしゅうの マスは 紙に おさまる', [g5, g10, g15, g20].every(g => g.sq * 10 <= g.h - g.m * 2 && g.qW > 0));
const longS = K.parseSentence('日よう日に 家の 人と [公園](こうえん)へ あそびに 行った');
const cL = K.charSize(longS, 'kaki', g20);
t('ながい 文は 字を 小さく して だんに おさめる', !K.tooLong(longS, 'kaki', g20) && cL < K.charSize(s1, 'kaki', g20), cL);
const tooLongS = K.parseSentence('きのうの ゆうがた みんなで あそんだ あとに [公園](こうえん)の ベンチで すこし やすんでから 家に かえった');
t('入りきらない 文は 見つける', K.tooLong(tooLongS, 'kaki', g20) && !K.tooLong(s1, 'kaki', g20));
t('字と □ と 読みは 列の はばに おさまる', [g5, g10, g15, g20].every(g => K.charSize(s1, 'kaki', g) * (K.BOX + K.SIDE) <= g.colW + 1e-6));

/* ---------- 漢字ノート ---------- */
t('マスは 7しゅるい', J(K.NOTE_SIZES.map(s => s.id)) === J([50, 84, 91, 104, 120, 150, 200]));
t('字数 ＝ 行 × 1行の 字数', K.NOTE_SIZES.every(s => s.cols * s.rows === s.id));
K.NOTE_SIZES.forEach(s => {
  ['B5', 'A4'].forEach(paper => {
    const g = K.noteGeometry(s.id, paper);
    t(`${s.id}字（${paper}）は 紙に おさまる`, g.left >= 6 && g.left + g.gridW <= g.pw - 6 && g.top - g.headH >= 5 && g.top + g.gridH <= g.ph - 5 && g.rubyW >= 2.5,
      `左${g.left.toFixed(1)} 上${(g.top - g.headH).toFixed(1)} 読み${g.rubyW.toFixed(1)}`);
  });
});
t('B5 と A4 で マスの 大きさは 同じ', K.NOTE_SIZES.every(s => J([K.noteGeometry(s.id, 'B5').gridW, K.noteGeometry(s.id, 'B5').gridH]) === J([K.noteGeometry(s.id, 'A4').gridW, K.noteGeometry(s.id, 'A4').gridH])));
t('84字は よこ18mm・たて17mm', (g => g.w === 18 && g.h === 17 && g.gridH === 204)(K.noteGeometry(84, 'B5')));

const w1 = K.parseWord('春の風(はるのかぜ)');
t('かなを 目じるしに 読みを わける', J(w1.rubies) === J([{ start: 0, len: 1, reading: 'はる' }, { start: 2, len: 1, reading: 'かぜ' }]), J(w1.rubies));
const w2 = K.parseWord('花(はな)火(び)');
t('1字ずつの 読み', J(w2.rubies.map(r => r.reading)) === J(['はな', 'び']) && J(w2.chars) === J(['花', '火']));
const w3 = K.parseWord('花火大会(はなびたいかい)');
t('漢字だけの ことばは まとめて', J(w3.rubies) === J([{ start: 0, len: 4, reading: 'はなびたいかい' }]));
const w4 = K.parseWord('春(はる)の風(かぜ)');
t('「の風(かぜ)」は 風だけに', J(w4.rubies) === J([{ start: 0, len: 1, reading: 'はる' }, { start: 2, len: 1, reading: 'かぜ' }]), J(w4.rubies));
t('読みなしも よい', J(K.parseWord('てがみ')) === J({ chars: ['て', 'が', 'み'], rubies: [] }));
t('かっこの まちがい → エラー', !!K.parseWord('春(はる').error);

const L = K.layoutNote('春の風(はるのかぜ)\n\n花火(はなび)', 84);
t('1行に 1つ・空の 行は 1行 あける', L.pages.length === 1 && L.pages[0].length === 3 && L.pages[0][1].cells.length === 0 && J(L.pages[0][2].cells) === J(['花', '火']));
const L2 = K.layoutNote(Array.from({ length: 9 }, (_, i) => '一'.repeat(i + 1)).join('\n'), 84);
t('行が たりなければ 2まいめ', L2.pages.length === 2 && L2.pages[0].length === 7 && L2.pages[1].length === 2);
const L3 = K.layoutNote('一二三四五六七八九十一二三四五(あいうえおかきくけこさしすせそ)', 84);
t('ながい ことばは つぎの 行へ（読みも わける）', L3.pages[0].length === 2 && L3.pages[0][0].cells.length === 12 && L3.pages[0][1].cells.length === 3 &&
  L3.pages[0][0].rubies[0].reading === 'あいうえおかきくけこさし' && L3.pages[0][1].rubies[0].reading === 'すせそ', J(L3.pages[0].map(c => c.rubies)));
t('なにも 入れなければ マス目だけ 1まい', (r => r.pages.length === 1 && r.pages[0].length === 0)(K.layoutNote('', 84)));

/* ---------- けっか ---------- */
const ng = rows.filter(r => !r.ok);
rows.forEach(r => console.log(`${r.ok ? '○' : '×'} ${r.name}${!r.ok && r.detail ? '　' + r.detail : ''}`));
console.log(`\n${rows.length - ng.length} / ${rows.length} OK`);
process.exit(ng.length ? 1 : 0);
