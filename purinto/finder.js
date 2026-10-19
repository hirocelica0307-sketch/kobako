/* プリント＆カード こうぼう ── さがす（目的・教科・学年・時期・ことば）
   ------------------------------------------------------------------
   ぜんぶの プリントと めあてカードを 1つの いちらんに まとめて、
   目的（入り口）で わけ、教科・学年・時期で しぼりこみ、ことばで さがす。
   ・sheet … プリント（index.html#p=ID で ひらく）
   ・meate … めあてカードの カテゴリ（meate.html#CAT で ひらく）
   ・おなじ プリントを べつの 教科にも 出して いた もの（けんてい・へんてこ ぶん）は 1つに まとめた
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    /** 目的（さいしょの 入り口） */
    const PURPOSES = [
        { k: 'asobu', icon: '🧩', label: 'あそんで まなぶ', sub: 'パズル・めいろ・クイズ' },
        { k: 'kaku', icon: '✏️', label: '書く・作文', sub: 'にっき・お題・げんこうようし' },
        { k: 'atama', icon: '🧠', label: 'あたまの たいそう', sub: 'みる・かぞえる・うつす（コグトレふう）' },
        { k: 'e', icon: '🎨', label: 'えを かく・ぬる', sub: 'かがみの え・つづきの え' },
        { k: 'bingo', icon: '🎯', label: 'ビンゴ・すごろく', sub: 'さがして・うごいて・みんなで' },
        { k: 'challenge', icon: '🏅', label: 'けんてい・チャレンジ', sub: '音読・九九・てつぼう・なわとび・読書の きろく' },
        { k: 'meate', icon: '🌸', label: 'めあて・ふりかえり', sub: '自己紹介・学期の めあて・1年の まとめ' },
        { k: 'gyoji', icon: '🎈', label: '行事・おいわい', sub: '運動会・遠足・たんじょうび・しょうじょう・卒業' },
        { k: 'gakkyu', icon: '🤝', label: '学級づくり・こころ', sub: '係・きもち・やさしさ' },
    ];

    /** 教科（しぼりこみ）。gakkatsu は めあてカードなど 学級活動の もの */
    const SUBJECTS = [
        { k: 'kokugo', label: 'こくご' }, { k: 'sansu', label: 'さんすう' }, { k: 'seikatsu', label: 'せいかつ' },
        { k: 'dotoku', label: 'どうとく' }, { k: 'taiiku', label: 'たいいく' }, { k: 'zuko', label: 'ずこう' },
        { k: 'cog', label: 'あたまの たいそう' }, { k: 'gakkatsu', label: '学級活動' },
    ];

    const GRADES = [{ k: 'low', label: '1・2年' }, { k: 'mid', label: '3・4年' }, { k: 'high', label: '5・6年' }];
    const ALLG = ['low', 'mid', 'high'], LM = ['low', 'mid'];

    /** よみかえ（かんじ ⇔ かな・べつの いいかた）。どちらで さがしても 見つかる */
    const YOMI = [
        ['九九', 'くく'], ['鉄棒', 'てつぼう'], ['作文', 'さくぶん'], ['目標', 'もくひょう'], ['目当て', 'めあて'], ['めあて', 'もくひょう'],
        ['漢字', 'かんじ'], ['計算', 'けいさん'], ['迷路', 'めいろ'], ['日記', 'にっき'], ['原稿用紙', 'げんこうようし'],
        ['音読', 'おんどく'], ['検定', 'けんてい'], ['運動会', 'うんどうかい'], ['自己紹介', 'じこしょうかい'], ['係', 'かかり'],
        ['賞状', 'しょうじょう'], ['誕生日', 'たんじょうび'], ['卒業', 'そつぎょう'], ['読書', 'どくしょ'], ['縄跳び', 'なわとび'],
        ['遠足', 'えんそく'], ['音楽', 'おんがく'], ['発表会', 'はっぴょうかい'], ['夏休み', 'なつやすみ'], ['季節', 'きせつ'],
        ['道徳', 'どうとく'], ['算数', 'さんすう'], ['国語', 'こくご'], ['生活', 'せいかつ'], ['体育', 'たいいく'], ['図工', 'ずこう'],
        ['学期', 'がっき'], ['振り返り', 'ふりかえり'], ['ふりかえり', 'まとめ'], ['数独', 'なんぷれ'], ['すうどく', 'なんぷれ'],
        ['言葉', 'ことば'], ['昔話', 'むかしばなし'], ['物語', 'ものがたり'], ['間違い', 'まちがい'], ['探し', 'さがし'],
        ['塗り絵', 'ぬりえ'], ['気持ち', 'きもち'], ['優しさ', 'やさしさ'], ['手伝い', 'おてつだい'],
        ['探検', 'たんけん'], ['お題', 'おだい'], ['視写', 'ししゃ'], ['書き写し', 'ししゃ'], ['当番', 'とうばん'],
        ['成長', 'せいちょう'], ['二分の一成人式', 'にぶんのいちせいじんしき'], ['1/2成人式', 'にぶんのいちせいじんしき'],
        ['修学旅行', 'しゅうがくりょこう'], ['社会科見学', 'しゃかいかけんがく'], ['足し算', 'たしざん'], ['引き算', 'ひきざん'],
        ['掛け算', 'かけざん'], ['コグトレ', 'あたまのたいそう'], ['宿題', 'しゅくだい'], ['新学期', 'しんがっき'], ['お祝い', 'おいわい'],
    ];

    /* sheet: プリントの id。p＝目的・s＝教科・g＝学年・m＝ぴったりの 月（なければ いつでも）・kw＝さがす ことば */
    const SHEET_TAGS = [
        { id: 'kaidan', p: 'asobu', s: ['kokugo'], g: LM, kw: 'ことばあそび しりとり ごい' },
        { id: 'storymaze', p: 'asobu', s: ['kokugo'], g: LM, kw: 'むかしばなし 昔話 よみとり 音読 ももたろう' },
        { id: 'wordsearch', p: 'asobu', s: ['kokugo'], g: LM, kw: 'ワードサーチ カタカナ' },
        { id: 'headquiz', p: 'asobu', s: ['kokugo'], g: LM, kw: 'クイズ なぞなぞ' },
        { id: 'anagram', p: 'asobu', s: ['kokugo'], g: LM, kw: 'アナグラム' },
        { id: 'kanjiadd', p: 'asobu', s: ['kokugo'], g: LM, kw: '漢字パズル ぶしゅ 部首' },
        { id: 'calcmaze', p: 'asobu', s: ['sansu'], g: LM, kw: '計算 たしざん ひきざん かけざん わりざん 九九' },
        { id: 'pyramid', p: 'asobu', s: ['sansu'], g: LM, kw: 'たしざん ひきざん' },
        { id: 'magic', p: 'asobu', s: ['sansu'], g: ALLG, kw: '魔方陣 たしざん' },
        { id: 'sudoku', p: 'asobu', s: ['sansu', 'cog'], g: ALLG, kw: '数独 すうどく パズル' },

        { id: 'acrostic', p: 'kaku', s: ['kokugo'], g: ALLG, kw: 'あいうえお作文 ことばあそび' },
        { id: 'dicestory', p: 'kaku', s: ['kokugo', 'zuko'], g: ALLG, kw: 'サイコロ 文づくり いつどこでだれが 主語 じゅつ語 へんてこ ぶんと え', also: ['dicestory-zuko'] },
        { id: 'anone', p: 'kaku', s: ['kokugo'], g: ['low'], kw: 'あのね にっき 日記 作文 たて書き 1年 2年' },
        { id: 'anone-mid', p: 'kaku', s: ['kokugo'], g: ['mid'], kw: 'あのね日記 作文 組み立て 3年 4年' },
        { id: 'odailist', p: 'kaku', s: ['kokugo'], g: LM, kw: '作文 お題 テーマ 一覧' },
        { id: 'genkou-machigai', p: 'kaku', s: ['kokugo'], g: LM, kw: '原稿用紙 書き方 きまり まちがいさがし' },
        { id: 'genkou-shisha', p: 'kaku', s: ['kokugo'], g: LM, kw: '原稿用紙 視写 書き写し うつす' },
        { id: 'genkou-check', p: 'kaku', s: ['kokugo'], g: ALLG, kw: '原稿用紙 作文 チェック 見直し 推敲' },

        { id: 'symbols', p: 'atama', s: ['cog'], g: LM, kw: 'コグトレ かぞえる 数える' },
        { id: 'dotcopy', p: 'atama', s: ['cog'], g: LM, kw: 'コグトレ 点つなぎ うつす 図形' },
        { id: 'dotmirror', p: 'atama', s: ['cog'], g: LM, kw: 'コグトレ 点つなぎ 鏡 さゆう 図形' },
        { id: 'diffs', p: 'atama', s: ['cog'], g: LM, kw: 'コグトレ 間違い探し 見つける' },
        { id: 'halfpic-cog', p: 'atama', s: ['cog', 'zuko'], g: LM, kw: 'コグトレ 鏡 塗り絵 対称 シンメトリー' },

        { id: 'halfpic', p: 'e', s: ['zuko'], g: LM, kw: '塗り絵 ドット絵 鏡 対称 シンメトリー' },
        { id: 'doodle', p: 'e', s: ['zuko'], g: ALLG, kw: 'お絵かき 想像 そうぞう らくがき' },

        { id: 'bingo-tanken', p: 'bingo', s: ['seikatsu'], g: ['low'], m: [4, 5, 6], kw: '学校たんけん まちたんけん 生活科' },
        { id: 'bingo-kisetsu', p: 'bingo', s: ['seikatsu'], g: ['low'], m: [4, 5, 6, 7, 9, 10, 11, 12, 1, 2], kw: '季節 春 夏 秋 冬 自然 しぜん' },
        { id: 'bingo-otetsudai', p: 'bingo', s: ['seikatsu'], g: ALLG, m: [7, 8, 12, 1], kw: 'お手伝い 夏休み 冬休み 宿題 家庭' },
        { id: 'bingo-yasashisa', p: 'bingo', s: ['dotoku'], g: LM, kw: '優しさ 思いやり あいさつ ミッション' },
        { id: 'bingo-arigatou', p: 'bingo', s: ['dotoku'], g: LM, kw: '感謝 ありがとう' },
        { id: 'bingo-undou', p: 'bingo', s: ['taiiku'], g: LM, kw: '運動 体つくり 雨の日' },
        { id: 'sugoroku', p: 'bingo', s: ['taiiku'], g: LM, kw: '運動 体つくり 雨の日 すごろく' },

        { id: 'kentei', p: 'challenge', s: ['kokugo', 'sansu'], g: LM, kw: '音読検定 九九検定 合格 カード 両面', also: ['kentei-sansu'] },
        { id: 'tetsubou', p: 'challenge', s: ['taiiku'], g: ALLG, kw: '鉄棒 技 わざ 逆上がり さかあがり 前回り' },
        { id: 'tetsubou-list', p: 'challenge', s: ['taiiku'], g: ALLG, kw: '鉄棒 技 わざ 逆上がり チャレンジ 記録' },

        { id: 'feelings', p: 'gakkyu', s: ['dotoku'], g: LM, kw: '気持ち 感情 表情 かお' },
    ];

    /* meate: めあてカードの カテゴリ */
    const MEATE_TAGS = [
        { cat: 'jiko', title: 'じこしょうかい カード', icon: '🙋', p: 'meate', m: [4], desc: '新学期の はじめに 書く 自己紹介。先生の カードも あります。', kw: '自己紹介 プロフィール 新学期 クラスがえ' },
        { cat: 'g1', title: '1学期の めあて', icon: '🌸', p: 'meate', m: [4, 5], desc: '1学期の はじめに 書く めあての カード。', kw: '目標 目当て 1学期 新学期' },
        { cat: 'g2', title: '2学期の めあて', icon: '🍁', p: 'meate', m: [8, 9], desc: '夏休み あけ、2学期の はじめに 書く カード。', kw: '目標 目当て 2学期' },
        { cat: 'g3', title: '3学期の めあて', icon: '⛄', p: 'meate', m: [1], desc: '3学期の はじめに 書く カード。', kw: '目標 目当て 3学期 新年' },
        { cat: 'matome', title: '1年の ふりかえり', icon: '📔', p: 'meate', m: [2, 3], desc: '3学期の おわりに 1年を ふりかえる カード。', kw: '振り返り まとめ 1年間 学年末' },
        { cat: 'seicho', title: '成長・未来の 自分', icon: '🌱', p: 'meate', m: [1, 2, 3], g: ['mid', 'high'], desc: '二分の一成人式や 3学期に、じぶんの 成長と 未来を 書く。', kw: '成長 二分の一成人式 1/2成人式 未来 将来の夢' },
        { cat: 'undo', title: '運動会 カード', icon: '🏃', p: 'gyoji', m: [5, 6, 9, 10], desc: '運動会の まえの めあて・あとの ふりかえり。', kw: '運動会 体育大会 目標 ふりかえり' },
        { cat: 'ongaku', title: '音楽発表会 カード', icon: '🎵', p: 'gyoji', m: [10, 11, 12, 2], desc: '音楽会・学習発表会の めあてと ふりかえり。', kw: '音楽会 学習発表会 学芸会 発表会' },
        { cat: 'ensoku', title: '遠足・見学・旅行 カード', icon: '🚌', p: 'gyoji', m: [4, 5, 6, 9, 10, 11], desc: '遠足・社会科見学・宿泊学習の あとに 書く。', kw: '遠足 社会科見学 修学旅行 宿泊学習 林間学校' },
        { cat: 'natsu', title: '夏休みの 思い出', icon: '🌻', p: 'gyoji', m: [8, 9], desc: '夏休み あけに 思い出を 書く カード。', kw: '夏休み 思い出 絵日記' },
        { cat: 'shoujou', title: 'しょうじょう', icon: '🏅', p: 'gyoji', m: [7, 12, 3], desc: '学期の おわりに わたす 賞状。', kw: '賞状 表彰 がんばったで賞' },
        { cat: 'tanjoubi', title: 'おたんじょうび カード', icon: '🎂', p: 'gyoji', desc: 'クラスの おたんじょうびに おくる カード。', kw: '誕生日 バースデー お祝い' },
        { cat: 'sotsugyo', title: '6年生へ・卒業 カード', icon: '🎓', p: 'gyoji', m: [2, 3], desc: '6年生を 送る会・卒業式の メッセージ。', kw: '卒業 6年生を送る会 メッセージ お祝い' },
        { cat: 'dokusho', title: '読書カード', icon: '📚', p: 'challenge', m: [10, 11], desc: '読んだ 本を きろくする カード。', kw: '読書 本 読書週間 記録 図書' },
        { cat: 'ganbari', title: 'がんばりカード', icon: '💪', p: 'challenge', desc: 'なわとび・音読・九九 などの がんばりを きろく。', kw: 'がんばり 記録 音読 九九 スタンプ' },
        { cat: 'nawa', title: 'なわとびカード', icon: '🪢', p: 'challenge', m: [12, 1, 2], desc: 'なわとびの わざと 回数を きろくする カード。', kw: '縄跳び なわとび 二重跳び 冬 記録 体育', s: ['taiiku', 'gakkatsu'] },
        { cat: 'arigato', title: 'ありがとう・いいところ', icon: '💌', p: 'gakkyu', m: [2, 3], desc: 'ともだちに ありがとう・いいところを つたえる きりとり カード。', kw: '感謝 ありがとう いいところ見つけ メッセージ', s: ['gakkatsu', 'dotoku'] },
        { cat: 'kakari', title: '係カード', icon: '🧹', p: 'gakkyu', m: [4, 9, 1], desc: '係の なまえ・メンバー・しごとを 書く カード。', kw: '係 係活動 当番 掲示' },
        { cat: 'ichiran', title: '係 いちらん表', icon: '📋', p: 'gakkyu', m: [4, 9, 1], desc: 'クラスの 係を 1まいに まとめた 表。', kw: '係 一覧 当番表 掲示' },
    ];

    /* ---------- ことばを そろえる ---------- */

    /** カタカナ→ひらがな・ぜんかく→はんかく・すきまや「・」を とる・小文字に */
    function norm(s) {
        return String(s || '').normalize('NFKC').toLowerCase()
            .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
            .replace(/[\s・、。,.!！?？「」『』（）()〜~ー-]/g, '')
            .replace(/\p{Extended_Pictographic}/gu, '');
    }
    const YOMI_N = YOMI.map(([a, b]) => [norm(a), norm(b)]);
    /** さがす ことばの よみかえ（「くく」→「九九」、「2がっきの めあて」→「2学期の 目標」など）を ぜんぶ */
    function variants(w) {
        const set = new Set([w]);
        for (let i = 0; i < 2; i++) for (const v of [...set]) for (const [a, b] of YOMI_N) {
            if (set.size > 64) return [...set];
            if (v.includes(a)) set.add(v.split(a).join(b));
            if (v.includes(b)) set.add(v.split(b).join(a));
        }
        return [...set];
    }

    /* ---------- いちらんを つくる ---------- */

    const purposeOf = k => PURPOSES.find(p => p.k === k);
    const subjLabel = k => (SUBJECTS.find(s => s.k === k) || {}).label || '';

    /** catalog … PurintoSheets.CATALOG（プリントの なまえ・え・せつめい） */
    function build(catalog) {
        const items = [];
        for (const t of SHEET_TAGS) {
            const c = catalog.find(x => x.id === t.id);
            if (!c) continue;
            items.push({ kind: 'sheet', id: t.id, href: 'index.html#p=' + t.id, title: c.title, icon: c.icon, desc: c.desc,
                purpose: t.p, subjects: t.s, grades: t.g, months: t.m || [], kw: t.kw || '', also: t.also || [] });
        }
        for (const t of MEATE_TAGS) {
            items.push({ kind: 'meate', id: 'meate:' + t.cat, cat: t.cat, href: 'meate.html#' + t.cat, title: t.title, icon: t.icon, desc: t.desc,
                purpose: t.p, subjects: t.s || ['gakkatsu'], grades: t.g || ALLG, months: t.m || [], kw: 'めあてカード カード ' + (t.kw || ''), also: [] });
        }
        for (const it of items) {
            const p = purposeOf(it.purpose);
            it.hay = norm([it.title, it.desc, it.kw, p.label, ...it.subjects.map(subjLabel)].join(' '));
        }
        return items;
    }

    /** ことばで さがす。すきまで くぎった ことばが ぜんぶ ふくまれる もの */
    function matchQuery(it, q) {
        const words = String(q || '').trim().split(/[\s　]+/).map(norm).filter(Boolean);
        return words.every(w => variants(w).some(v => it.hay.includes(v)));
    }

    /** f = { q, purpose, subject, grade, month }（から＝しぼらない） */
    function filter(items, f) {
        return items.filter(it =>
            (!f.purpose || it.purpose === f.purpose) &&
            (!f.subject || it.subjects.includes(f.subject)) &&
            (!f.grade || it.grades.includes(f.grade)) &&
            (!f.month || it.months.includes(+f.month)) &&
            matchQuery(it, f.q));
    }

    /** 今月の おすすめ（月が きまって いる ものだけ） */
    const forMonth = (items, month) => items.filter(it => it.months.includes(month));

    /** URL の プリント id → いちらんの もの（まとめた もの も） */
    const itemOfSheet = (items, id) => items.find(it => it.kind === 'sheet' && (it.id === id || it.also.includes(id)));

    const api = { PURPOSES, SUBJECTS, GRADES, SHEET_TAGS, MEATE_TAGS, norm, variants, build, filter, forMonth, itemOfSheet, purposeOf, subjLabel };
    root.PurintoFinder = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
