/* 役を おぼえる：お手本の 手の うごき（データ と 再生の 計算）
   ------------------------------------------------------------------
   1つの 役ごとに「配牌（さいしょの 13枚）→ ツモ・捨てる・鳴く・カン → あがり」の 流れを 書いて あります。
   画面（yaku-player.js）は これを 1コマずつ 再生して、妖精が 説明します。
   さいごの あがりは score.js の evaluateWin で 計算して、その 役が ほんとうに つく ことを
   tests.js で ぜんぶ たしかめて います（とちゅうの ツモ・捨て・鳴きが ルールどおり かも）。

   書きかた
     start：さいしょの 手牌（'123m456p789s11z'。z は 1東 2南 3西 4北 5白 6發 7中）
     seat / round：自風・場風（0東 1南 2西 3北）。親は seat 0
     steps：
       { s }                    … 説明だけ（hl：光らせる 牌）
       { d, s }                 … 1枚 ツモる
       { x, s, riichi }         … 1枚 捨てる（riichi：リーチ宣言）
       { d, x, s }              … ツモって すぐ 捨てる（2コマ）
       { pon:'5z', s }          … 人の 捨てた 牌を ポン（つぎに x で 捨てる）
       { chi:'3m', use:'12m', s } … 上家の 捨てた 牌を チー
       { ankan:'7z', s }        … 暗槓（つぎに d で 嶺上牌を ツモる）
       { other:'5p', s }        … 相手の うごき（槍槓の 加槓・流し満貫 など）を 見せる
       { win:'3m', tsumo, s, flags } … あがり（flags：riichi・ippatsu・rinshan・chankan・haitei・houtei・doubleRiichi・tenhou・chiihou）
     expect：あがりで かならず つく 役（evaluateWin の 名まえ。[a, b] は どちらか）
     文の 中の [5m] は 牌の 絵に なる（読みあげでは「ごマン」）
   ------------------------------------------------------------------ */

export const LESSONS = [
    /* ── はじめに ── */
    {
        id: 'katachi', group: 'はじめに', name: 'あがりの かたち', reading: 'アガリノ カタチ', han: '',
        point: '麻雀は 14枚で「3枚の くみ（面子）× 4つ ＋ 同じ 牌 2枚（雀頭）」を 作ると あがれる。さらに 役が 1つ 以上 いる。',
        start: '123m456p78s99s13p3z', seat: 1, round: 0,
        steps: [
            { s: 'これが さいしょの 手牌（13枚）。自分の 番が 来たら 山から 1枚 ひいて（ツモ）、1枚 捨てるよ。' },
            { s: '[1m][2m][3m] のように 数が つづく 3枚を「順子（シュンツ）」と いうよ。', hl: '123m' },
            { s: '同じ 牌 3枚は「刻子（コーツ）」、同じ 牌 2枚は「雀頭（ジャントウ）」。[9s][9s] が 雀頭に なる。', hl: '99s' },
            { d: '6s', s: '[6s] を ツモ！ [6s][7s][8s] の 順子が できた。', hl: '678s' },
            { x: '3z', s: 'つかわない [3z] を 捨てる。これで あと 1枚で あがりの「テンパイ」。[1p][3p] の あいだの [2p] 待ち。', hl: '13p' },
            { d: '1z', x: '1z', s: 'いらない 牌は そのまま 捨てて 待つ。' },
            { win: '2p', tsumo: true, s: '[2p] を ツモって あがり！ 面子 4つ ＋ 雀頭 1つ。鳴かずに ツモったので「門前清自摸和（メンゼンツモ）」の 役が つく。' }
        ],
        expect: ['門前清自摸和']
    },
    /* ── 1翻 ── */
    {
        id: 'riichi', group: '1翻', name: '立直', reading: 'リーチ', han: '1翻', tag: '門前のみ',
        point: '鳴かずに（門前で）テンパイしたら「リーチ」と 言って 1000点を 出す。あとは 手を かえられないが、それだけで 役に なる。',
        start: '123m24m456p7p789s4z', seat: 1, round: 0,
        steps: [
            { s: 'リーチは いちばん よく つかう 役。役が ない 手でも、鳴かずに テンパイすれば あがれる ように なる。' },
            { d: '7p', s: '[7p] を ツモ。[7p][7p] の 雀頭が できて、のこりは [2m][4m] だけ。', hl: '77p' },
            { x: '4z', riichi: true, s: '[4z] を 横に して 捨てて「リーチ！」。[3m] が 来たら あがり。' },
            { d: '9p', x: '9p', s: 'リーチの あとは ツモった 牌を そのまま 捨てる（手を かえられない）。' },
            { win: '3m', tsumo: false, flags: { riichi: true }, s: '相手が 捨てた [3m] で「ロン」！ 立直の 1翻。リーチの 人は 裏ドラも 見られるよ。' }
        ],
        expect: ['立直']
    },
    {
        id: 'ippatsu', group: '1翻', name: '一発', reading: 'イッパツ', han: '1翻', tag: 'リーチの おまけ',
        point: 'リーチして から 1巡の あいだ（次の 自分の ツモまで）に あがると つく。間に だれかが 鳴くと 消える。',
        start: '345m68m234p9p456s5z', seat: 1, round: 0,
        steps: [
            { d: '9p', s: '[9p] を ツモ。[9p][9p] で 雀頭。[6m][8m] の あいだの [7m] 待ち。', hl: '99p' },
            { x: '5z', riichi: true, s: '[5z] を 捨てて リーチ！' },
            { s: 'リーチして から 1周する までに あがれたら「一発」。' },
            { win: '7m', tsumo: false, flags: { riichi: true, ippatsu: true }, s: 'すぐに 相手が [7m] を 捨てた！ ロン！ 立直＋一発 で 2翻。' }
        ],
        expect: ['立直', '一発']
    },
    {
        id: 'tsumo', group: '1翻', name: '門前清自摸和', reading: 'メンゼンツモ', han: '1翻', tag: '門前のみ',
        point: '鳴かずに（門前で）自分で ツモって あがると つく。リーチを しなくても OK。',
        start: '123p456p79s9m345m3z', seat: 1, round: 0,
        steps: [
            { d: '9m', s: '[9m] を ツモ。[9m][9m] で 雀頭。', hl: '99m' },
            { x: '3z', s: '[3z] を 捨てて テンパイ。[7s][9s] の あいだの [8s] 待ち。' },
            { win: '8s', tsumo: true, s: '[8s] を 自分で ツモ！ 鳴いて いないので 門前清自摸和（メンゼンツモ）1翻。' }
        ],
        expect: ['門前清自摸和']
    },
    {
        id: 'pinfu', group: '1翻', name: '平和', reading: 'ピンフ', han: '1翻', tag: '門前のみ',
        point: '①面子が ぜんぶ 順子 ②雀頭が 役牌で ない ③待ちが 両面（りょうめん）④鳴いて いない。点数は 低いが あがりやすい。',
        start: '123m567p345s78s4p5z', seat: 1, round: 0,
        steps: [
            { s: '平和は「刻子を つかわず、順子だけで 作る」役。' },
            { d: '4p', s: '[4p] を ツモ。[4p][4p] が 雀頭（役牌では ない 数牌）。', hl: '44p' },
            { x: '5z', s: '[5z] を 捨てる。のこりの [7s][8s] は [6s] でも [9s] でも 順子に なる「両面待ち」。', hl: '78s' },
            { win: '9s', tsumo: false, s: '[9s] で ロン！ ぜんぶ 順子・両面待ち なので 平和（ピンフ）1翻。' }
        ],
        expect: ['平和']
    },
    {
        id: 'tanyao', group: '1翻', name: '断么九', reading: 'タンヤオ', han: '1翻', tag: '鳴いても OK',
        point: '2〜8の 数牌だけで 作る。1・9・字牌（東南西北白發中）を 1枚も つかわない。鳴いても つく（喰いタン）。',
        start: '234m345p66s567s1m9p', seat: 1, round: 0,
        steps: [
            { s: 'タンヤオは「まん中の 数字（2〜8）だけ」の 役。[1m] と [9p] が じゃま。', hl: '1m9p' },
            { d: '6p', x: '1m', s: '[6p] を ツモって、[1m] を 捨てる。1は タンヤオに つかえない。' },
            { d: '7p', x: '9p', s: '[7p] を ツモって、[9p] を 捨てる。これで 2〜8だけに なった！' },
            { win: '8p', tsumo: false, s: '[8p] で ロン！ ぜんぶ 2〜8 なので 断么九（タンヤオ）。順子だけで 両面待ち なので 平和も ついた。' }
        ],
        expect: ['断么九']
    },
    {
        id: 'iipeiko', group: '1翻', name: '一盃口', reading: 'イーペーコー', han: '1翻', tag: '門前のみ',
        point: '鳴かずに、まったく 同じ 順子を 2つ 作る（例：[2m][3m][4m] ＋ [2m][3m][4m]）。',
        start: '22334m567p789s1p4z', seat: 1, round: 0,
        steps: [
            { s: '[2m][2m][3m][3m][4m] … あと [4m] が あれば 同じ 順子が 2つ に なる。', hl: '22334m' },
            { d: '4m', s: '[4m] を ツモ！ [2m][3m][4m] が 2つ そろった。', hl: '223344m' },
            { x: '4z', s: '[4z] を 捨てる。[1p] の 単騎待ち（雀頭を 待つ）。' },
            { win: '1p', tsumo: true, s: '[1p] を ツモ！ 同じ 順子 2つで 一盃口（イーペーコー）。メンゼンツモも ついて 2翻。' }
        ],
        expect: ['一盃口']
    },
    {
        id: 'yakuhai', group: '1翻', name: '役牌（三元牌）', reading: 'ヤクハイ', han: '1翻', tag: '鳴いても OK',
        point: '[5z] 白・[6z] 發・[7z] 中 の どれかを 3枚 そろえると 1翻。ポンしても つくので、いちばん かんたんな 役。',
        start: '55z123m456p78s99s4z', seat: 1, round: 0,
        steps: [
            { s: '[5z][5z] が 2枚 ある。もう 1枚 で 役牌（ヤクハイ）に なる。', hl: '55z' },
            { pon: '5z', s: '相手が [5z] を 捨てた！「ポン」して もらう。これで 役が かくてい。ポンした 牌は 右に さらす（人から もらった 牌は 横むき）。' },
            { x: '4z', s: 'ポンしたら 1枚 捨てる。[4z] を 捨てて、[7s][8s] の 両面待ち。' },
            { win: '6s', tsumo: false, s: '[6s] で ロン！ 白（ハク）の 刻子で 役牌 1翻。發（ハツ）・中（チュン）でも 同じ。' }
        ],
        expect: ['役牌 白']
    },
    {
        id: 'bakaze', group: '1翻', name: '場風', reading: 'バカゼ', han: '1翻', tag: '鳴いても OK',
        point: 'その 局の 場の 風（東場なら [1z] 東、南場なら [2z] 南）を 3枚 そろえると 1翻。',
        start: '11z234p567s34m88m9p', seat: 1, round: 0,
        steps: [
            { s: 'いまは「東場（トンば）」。場風は [1z] 東。[1z][1z] を もって いる。', hl: '11z' },
            { pon: '1z', s: '[1z] を ポン！' },
            { x: '9p', s: '[9p] を 捨てて テンパイ。[3m][4m] の 両面待ち。' },
            { win: '5m', tsumo: true, s: '[5m] を ツモ！ 場風の 東で 1翻。（鳴いて いるので メンゼンツモは つかない）' }
        ],
        expect: ['場風 東']
    },
    {
        id: 'jikaze', group: '1翻', name: '自風', reading: 'ジカゼ', han: '1翻', tag: '鳴いても OK',
        point: '自分の 席の 風（親は 東、その右から 南・西・北）を 3枚 そろえると 1翻。',
        start: '33z345m678p11s23s2z', seat: 2, round: 0,
        steps: [
            { s: 'あなたの 席は「西家（シャーチャ）」。自風は [3z] 西。', hl: '33z' },
            { pon: '3z', s: '[3z] を ポン！' },
            { x: '2z', s: '[2z] を 捨てる（南は あなたの 風でも 場の 風でも ない）。' },
            { win: '4s', tsumo: false, s: '[4s] で ロン！ 自風の 西で 1翻。親なら 東が 自風で、東場なら 場風と あわせて 2翻（ダブ東）。' }
        ],
        expect: ['自風 西']
    },
    {
        id: 'rinshan', group: '1翻', name: '嶺上開花', reading: 'リンシャン カイホー', han: '1翻', tag: 'カンの あと',
        point: 'カンを すると 王牌（ワンパイ）から 1枚 もらえる（嶺上牌）。その 牌で あがると つく。',
        start: '777z234m567m34s66p', seat: 1, round: 0,
        steps: [
            { s: 'テンパイ中。[3s][4s] の 両面待ち で、[7z] 中 を 3枚 もって いる。', hl: '777z' },
            { d: '7z', s: '4枚めの [7z] を ツモ！' },
            { ankan: '7z', s: '「カン」！ 4枚 そろえて 両はしを うらに 置く（暗槓）。カンを すると もう 1枚 ひける。' },
            { win: '5s', tsumo: true, flags: { rinshan: true }, s: 'カンの あとに ひいた 牌（嶺上牌）が [5s] で あがり！ 嶺上開花（リンシャンカイホー）。' }
        ],
        expect: ['嶺上開花']
    },
    {
        id: 'chankan', group: '1翻', name: '槍槓', reading: 'チャンカン', han: '1翻', tag: '人の 加槓で ロン',
        point: '相手が ポンして いる 牌に 4枚めを たす「加槓（カカン）」を した とき、その 牌で ロン できる。',
        start: '123m789m46p234s88s', seat: 1, round: 0,
        steps: [
            { s: 'テンパイ中。[4p][6p] の あいだの [5p] 待ち。でも [5p] は のこり 1枚…', hl: '46p' },
            { other: '5p', s: '相手が ポンして いた [5p] に、4枚めを たして 加槓（カカン）しようと した！' },
            { win: '5p', tsumo: false, flags: { chankan: true }, s: 'その [5p] を うばって「ロン」！ 槍槓（チャンカン）1翻。' }
        ],
        expect: ['槍槓']
    },
    {
        id: 'haitei', group: '1翻', name: '海底摸月', reading: 'ハイテイ', han: '1翻', tag: 'さいごの ツモ',
        point: '山の さいごの 1枚を ツモって あがると つく。役が ない 手でも あがれる ことが ある。',
        start: '12m456p789s22s56m4z', seat: 1, round: 0,
        steps: [
            { chi: '3m', use: '12m', s: '上家の [3m] を チー。[1m][2m][3m] を さらす。' },
            { x: '4z', s: '[4z] を 捨てて テンパイ（[5m][6m] の 両面）。でも 鳴いて いて 役が ない…' },
            { s: 'このままだと あがれない。でも 山が のこり 1枚に なった！' },
            { win: '7m', tsumo: true, flags: { haitei: true }, s: 'さいごの 1枚で [7m] を ツモ！ 海底摸月（ハイテイ）1翻で あがれた。' }
        ],
        expect: ['海底摸月']
    },
    {
        id: 'houtei', group: '1翻', name: '河底撈魚', reading: 'ホーテイ', han: '1翻', tag: 'さいごの 捨て牌',
        point: 'さいごの ツモの 人が 捨てた 牌で ロンすると つく。',
        start: '345m234p78p66s78s4z', seat: 1, round: 0,
        steps: [
            { chi: '6s', use: '78s', s: '[6s] を チー。' },
            { x: '4z', s: '[4z] を 捨てて テンパイ（[7p][8p] で [6p] か [9p]）。役は ない…' },
            { s: '山が なくなり、さいごの 人が 牌を 捨てる…' },
            { win: '9p', tsumo: false, flags: { houtei: true }, s: 'さいごの 捨て牌 [9p] で ロン！ 河底撈魚（ホーテイ）1翻。' }
        ],
        expect: ['河底撈魚']
    },
    /* ── 2翻 ── */
    {
        id: 'wriichi', group: '2翻', name: 'ダブル立直', reading: 'ダブルリーチ', han: '2翻', tag: '門前のみ',
        point: 'さいしょの ツモ（第1巡）で、だれも 鳴いて いない うちに リーチすると 2翻。',
        start: '234m567m123p45s9p4z', seat: 1, round: 0,
        steps: [
            { s: '配牌が とても いい！ あと 1枚で テンパイ。' },
            { d: '9p', s: 'さいしょの ツモで [9p]。雀頭が できて テンパイ！', hl: '99p' },
            { x: '4z', riichi: true, s: '1巡め なので「ダブルリーチ」！ ふつうの リーチより 1翻 高い。' },
            { win: '6s', tsumo: false, flags: { riichi: true, doubleRiichi: true }, s: '[6s] で ロン！ ダブル立直 2翻（平和も ついた）。' }
        ],
        expect: ['ダブル立直']
    },
    {
        id: 'chiitoi', group: '2翻', name: '七対子', reading: 'チートイツ', han: '2翻', tag: '門前のみ・25符',
        point: '同じ 牌の ペア（対子）を 7つ あつめる とくべつな 形。同じ 牌 4枚は 2ペアに ならない。',
        start: '11m44m77p99p22s6s1z8s', seat: 1, round: 0,
        steps: [
            { s: 'ペアが 5つ ある！ 七対子（チートイツ）を ねらおう。', hl: '11m44m77p99p22s' },
            { d: '6s', s: '[6s] を ツモ。ペアが 6つ に なった。', hl: '66s' },
            { x: '8s', s: '[8s] を 捨てる。のこりの [1z] と 同じ 牌を 待つ（単騎待ち）。' },
            { win: '1z', tsumo: false, s: '[1z] で ロン！ ペア 7つで 七対子 2翻。点数の 符は 25符と きまって いる。' }
        ],
        expect: ['七対子']
    },
    {
        id: 'sanshoku', group: '2翻', name: '三色同順', reading: 'サンショク', han: '2翻', tag: '鳴くと 1翻',
        point: '萬子・筒子・索子で 同じ 数の 順子を 作る（例：[2m][3m][4m]・[2p][3p][4p]・[2s][3s][4s]）。',
        start: '234m2p234s789m55s4z', seat: 1, round: 0,
        steps: [
            { s: '[2m][3m][4m] と [2s][3s][4s] が ある。筒子でも 234 を 作ろう。', hl: '234m234s' },
            { d: '3p', x: '4z', s: '[3p] を ツモ、[4z] を 捨てる。[2p][3p] で [1p] か [4p] 待ち。' },
            { s: '[4p] なら 三色、[1p] だと 三色に ならない。' },
            { win: '4p', tsumo: false, s: '[4p] で ロン！ 3つの 色で 234 が そろって 三色同順 2翻。' }
        ],
        expect: ['三色同順']
    },
    {
        id: 'ittsu', group: '2翻', name: '一気通貫', reading: 'イッツー', han: '2翻', tag: '鳴くと 1翻',
        point: '同じ 色で 1〜9を つなげる（[1p][2p][3p]・[4p][5p][6p]・[7p][8p][9p]）。',
        start: '123p456p7p345m11s4z', seat: 1, round: 0,
        steps: [
            { s: '筒子で 123 と 456 が ある。789 が できれば 一気通貫！', hl: '123456p' },
            { d: '9p', x: '4z', s: '[9p] を ツモ、[4z] を 捨てる。[7p][9p] の あいだの [8p] 待ち。' },
            { win: '8p', tsumo: true, s: '[8p] を ツモ！ 1から 9まで つながって 一気通貫（イッツー）2翻。' }
        ],
        expect: ['一気通貫']
    },
    {
        id: 'chanta', group: '2翻', name: '混全帯么九', reading: 'チャンタ', han: '2翻', tag: '鳴くと 1翻',
        point: 'すべての 面子と 雀頭に 1・9・字牌が 入る（[1m][2m][3m]・[7p][8p][9p]・字牌 など）。',
        start: '123m789p12s999s4z5p', seat: 1, round: 0,
        steps: [
            { s: 'どの くみにも 1か 9か 字牌が 入る ように する。[5p] は つかえない。', hl: '5p' },
            { d: '4z', x: '5p', s: '[4z] を ツモ、[5p] を 捨てる。[4z][4z] が 雀頭に なった。' },
            { s: '[1s][2s] で [3s] を 待つ（辺張待ち）。', hl: '12s' },
            { win: '3s', tsumo: false, s: '[3s] で ロン！ ぜんぶの くみに 1・9・字牌が 入って 混全帯么九（チャンタ）2翻。' }
        ],
        expect: ['混全帯么九']
    },
    {
        id: 'toitoi', group: '2翻', name: '対々和', reading: 'トイトイ', han: '2翻', tag: '鳴いても OK',
        point: '4つの 面子を ぜんぶ 刻子（同じ 牌 3枚）に する。ポンを たくさん して よい。',
        start: '22m55p88s99m44z3p7m1s', seat: 1, round: 0,
        steps: [
            { s: '同じ 牌の ペアが 5つ。ポンして 刻子に していこう。', hl: '22m55p88s99m44z' },
            { pon: '5p', s: '[5p] を ポン！' },
            { x: '3p', s: '[3p] を 捨てる。' },
            { pon: '8s', s: '[8s] も ポン！' },
            { x: '7m', s: '[7m] を 捨てる。' },
            { pon: '2m', s: '[2m] も ポン！' },
            { x: '1s', s: '[1s] を 捨てる。[9m] か [4z] が 来たら あがり（シャンポン待ち）。' },
            { win: '4z', tsumo: false, s: '[4z] で ロン！ 4つ ぜんぶ 刻子で 対々和（トイトイ）2翻。' }
        ],
        expect: ['対々和']
    },
    {
        id: 'sanankou', group: '2翻', name: '三暗刻', reading: 'サンアンコー', han: '2翻', tag: '鳴いても OK',
        point: '自分で そろえた 刻子（暗刻）を 3つ 作る。ポンした 刻子は 暗刻に ならない。',
        start: '111m555p777s23p9s5z', seat: 1, round: 0,
        steps: [
            { s: '自分で そろえた 刻子（暗刻）が もう 3つ ある！', hl: '111m555p777s' },
            { d: '9s', x: '5z', s: '[9s] を ツモ、[5z] を 捨てる。[2p][3p] の 両面待ち。' },
            { win: '4p', tsumo: false, s: '[4p] で ロン！ 暗刻 3つで 三暗刻 2翻。（順子で ロンしたので 暗刻は くずれない）' }
        ],
        expect: ['三暗刻']
    },
    {
        id: 'doukou', group: '2翻', name: '三色同刻', reading: 'サンショク ドーコー', han: '2翻', tag: '鳴いても OK',
        point: '萬子・筒子・索子で 同じ 数の 刻子を 作る（例：[3m]×3・[3p]×3・[3s]×3）。',
        start: '33m33p333s789m11p4z', seat: 1, round: 0,
        steps: [
            { s: '[3s] が 3枚、[3m] と [3p] が 2枚ずつ。', hl: '33m33p333s' },
            { pon: '3m', s: '[3m] を ポン！' },
            { x: '4z', s: '[4z] を 捨てる。' },
            { pon: '3p', s: '[3p] も ポン！' },
            { x: '1p', s: '[1p] を 1枚 捨てて、のこりの [1p] で 単騎待ち。' },
            { win: '1p', tsumo: false, s: '[1p] で ロン！ 3色の 3が そろって 三色同刻 2翻。' }
        ],
        expect: ['三色同刻']
    },
    {
        id: 'sankantsu', group: '2翻', name: '三槓子', reading: 'サンカンツ', han: '2翻', tag: '鳴いても OK',
        point: 'カンを 3回 する。とても めずらしい 役。',
        start: '222m666p888s345m9p', seat: 1, round: 0,
        steps: [
            { d: '2m', s: '[2m] の 4枚め！' },
            { ankan: '2m', s: 'カン！' },
            { d: '1s', x: '1s', s: '嶺上牌は いらない 牌。捨てる。' },
            { d: '6p', s: '[6p] の 4枚め！' },
            { ankan: '6p', s: '2回めの カン！' },
            { d: '5z', x: '5z', s: '捨てる。' },
            { d: '8s', s: '[8s] の 4枚め！' },
            { ankan: '8s', s: '3回めの カン！' },
            { d: '4z', x: '4z', s: '[9p] の 単騎待ち。' },
            { win: '9p', tsumo: true, s: '[9p] を ツモ！ カン 3つで 三槓子 2翻。自分で そろえたので 三暗刻も ついた。' }
        ],
        expect: ['三槓子']
    },
    {
        id: 'shousangen', group: '2翻', name: '小三元', reading: 'ショーサンゲン', han: '2翻', tag: '鳴いても OK',
        point: '白・發・中の うち 2つを 刻子、のこり 1つを 雀頭に する。役牌 2つも つくので じっさいは 4翻。',
        start: '55z66z77z123p456s9m', seat: 1, round: 0,
        steps: [
            { s: '三元牌（白・發・中）が 2枚ずつ ある！', hl: '556677z' },
            { pon: '5z', s: '[5z] を ポン！' },
            { x: '9m', s: '[9m] を 捨てる。[6z] か [7z] が 来たら あがり。' },
            { win: '6z', tsumo: false, s: '[6z] で ロン！ 白と 發が 刻子、中が 雀頭で 小三元 2翻。役牌 白・發も ついて 4翻。' }
        ],
        expect: ['小三元']
    },
    {
        id: 'honroutou', group: '2翻', name: '混老頭', reading: 'ホンロートー', han: '2翻', tag: '鳴いても OK',
        point: '1・9・字牌だけで 作る。対々和か 七対子と いっしょに なる。',
        start: '11m999p11s444z99s5m', seat: 1, round: 0,
        steps: [
            { s: '1・9・字牌ばかり！', hl: '11m999p11s444z99s' },
            { pon: '1m', s: '[1m] を ポン！' },
            { x: '5m', s: '[5m] を 捨てる。[1s] か [9s] で あがり。' },
            { win: '9s', tsumo: false, s: '[9s] で ロン！ ぜんぶ 1・9・字牌 で 混老頭 2翻。対々和も ついた。' }
        ],
        expect: ['混老頭']
    },
    /* ── 3翻 ── */
    {
        id: 'ryanpeikou', group: '3翻', name: '二盃口', reading: 'リャンペーコー', han: '3翻', tag: '門前のみ',
        point: '一盃口（同じ 順子 2つ）を 2組 作る。七対子の 形にも 見えるが、二盃口として 数える。',
        start: '223344m5566p7p9s4z', seat: 1, round: 0,
        steps: [
            { s: '[2m][3m][4m] が 2つ。筒子でも 同じ 順子を 2つ 作りたい。', hl: '223344m' },
            { d: '9s', x: '4z', s: '[9s] を ツモ、[4z] を 捨てる。[9s][9s] が 雀頭。' },
            { win: '7p', tsumo: true, s: '[7p] を ツモ！ [5p][6p][7p] も 2つ。二盃口 3翻。' }
        ],
        expect: ['二盃口']
    },
    {
        id: 'junchan', group: '3翻', name: '純全帯么九', reading: 'ジュンチャン', han: '3翻', tag: '鳴くと 2翻',
        point: 'チャンタの 字牌なし版。すべての 面子と 雀頭に 1か 9が 入る。',
        start: '123m789m12p789s1s5s', seat: 1, round: 0,
        steps: [
            { s: '字牌を つかわず、どの くみにも 1か 9を 入れる。[5s] が じゃま。', hl: '5s' },
            { d: '1s', x: '5s', s: '[1s] を ツモ、[5s] を 捨てる。[1s][1s] が 雀頭。' },
            { win: '3p', tsumo: false, s: '[3p] で ロン！ ぜんぶの くみに 1か 9。純全帯么九（ジュンチャン）3翻。' }
        ],
        expect: ['純全帯么九']
    },
    {
        id: 'honitsu', group: '3翻', name: '混一色', reading: 'ホンイツ', han: '3翻', tag: '鳴くと 2翻',
        point: '1つの 色（萬子・筒子・索子の どれか）と 字牌だけで 作る。',
        start: '234s567s88s44z11s5m', seat: 1, round: 0,
        steps: [
            { s: '索子と 字牌が 多い。[5m] は いらない。', hl: '5m' },
            { d: '8s', x: '5m', s: '[8s] を ツモ、[5m] を 捨てる。索子と 字牌だけに なった。' },
            { win: '4z', tsumo: true, s: '[4z] を ツモ！ 索子と 字牌だけで 混一色（ホンイツ）3翻。' }
        ],
        expect: ['混一色']
    },
    /* ── 6翻 ── */
    {
        id: 'chinitsu', group: '6翻', name: '清一色', reading: 'チンイツ', han: '6翻', tag: '鳴くと 5翻',
        point: '1つの 色だけ（字牌も なし）で 作る。待ちが ふくざつに なりやすい。',
        start: '123p345p66p78p99p4z', seat: 1, round: 0,
        steps: [
            { s: 'ほとんど 筒子！ 筒子だけで そろえよう。', hl: '123345667899p' },
            { d: '9p', x: '4z', s: '[9p] を ツモ、[4z] を 捨てる。筒子だけ！' },
            { win: '6p', tsumo: true, s: '[6p] を ツモ！ 筒子だけで 清一色（チンイツ）6翻。跳満（ハネマン）に なる。' }
        ],
        expect: ['清一色']
    },
    /* ── 役満 ── */
    {
        id: 'kokushi', group: '役満', name: '国士無双', reading: 'コクシムソウ', han: '役満', tag: '門前のみ',
        point: '1・9・字牌の 13種類を 1枚ずつ ＋ どれか 1枚。面子を 作らない とくべつな 形。',
        start: '119m19p19s1234z5z5m', seat: 1, round: 0,
        steps: [
            { s: '1・9・字牌が たくさん！ 13種類を そろえる 国士無双を ねらう。' },
            { d: '6z', x: '5m', s: '[6z] を ツモ、[5m] を 捨てる。のこりは [7z] だけ。' },
            { win: '7z', tsumo: false, s: '[7z] で ロン！ 13種類 そろって 国士無双（役満）。' }
        ],
        expect: ['国士無双']
    },
    {
        id: 'suuankou', group: '役満', name: '四暗刻', reading: 'スーアンコー', han: '役満', tag: '門前のみ',
        point: '自分で そろえた 刻子（暗刻）を 4つ。ロンで 刻子が できると 暗刻に ならないので 注意。',
        start: '222m555p888s3s44z9m', seat: 1, round: 0,
        steps: [
            { s: '暗刻が 3つ！', hl: '222m555p888s' },
            { d: '3s', x: '9m', s: '[3s] を ツモ、[9m] を 捨てる。[3s] か [4z] の シャンポン待ち。' },
            { win: '4z', tsumo: true, s: '[4z] を ツモ！ 暗刻 4つで 四暗刻（役満）。ロンだと 三暗刻＋対々和に なって しまう。' }
        ],
        expect: ['四暗刻']
    },
    {
        id: 'daisangen', group: '役満', name: '大三元', reading: 'ダイサンゲン', han: '役満', tag: '鳴いても OK',
        point: '白・發・中を ぜんぶ 刻子に する。',
        start: '55z66z777z234m55p4z', seat: 1, round: 0,
        steps: [
            { s: '三元牌が いっぱい！ 3種類 ぜんぶ 刻子に したい。', hl: '5566777z' },
            { pon: '5z', s: '[5z] を ポン！' },
            { x: '4z', s: '[4z] を 捨てる。[6z] か [5p] で あがり。' },
            { win: '6z', tsumo: false, s: '[6z] で ロン！ 白・發・中 ぜんぶ 刻子で 大三元（役満）。' }
        ],
        expect: ['大三元']
    },
    {
        id: 'shousuushii', group: '役満', name: '小四喜', reading: 'ショースーシー', han: '役満', tag: '鳴いても OK',
        point: '風牌（東南西北）の うち 3つを 刻子、のこり 1つを 雀頭に する。',
        start: '111z22z333z4z234m5p', seat: 1, round: 0,
        steps: [
            { s: '風牌が たくさん！', hl: '1112233344z' },
            { d: '4z', x: '5p', s: '[4z] を ツモ、[5p] を 捨てる。[2z] か [4z] の シャンポン待ち。' },
            { win: '2z', tsumo: true, s: '[2z] を ツモ！ 東・南・西が 刻子、北が 雀頭で 小四喜（役満）。' }
        ],
        expect: ['小四喜']
    },
    {
        id: 'daisuushii', group: '役満', name: '大四喜', reading: 'ダイスーシー', han: '役満', tag: '鳴いても OK',
        point: '風牌（東南西北）を 4つ ぜんぶ 刻子に する。',
        start: '111z222z333z44z5m1p', seat: 1, round: 0,
        steps: [
            { s: '東・南・西が 刻子、北が 2枚！', hl: '11122233344z' },
            { d: '5m', x: '1p', s: '[5m] を ツモ、[1p] を 捨てる。[4z] か [5m] の シャンポン待ち。' },
            { win: '4z', tsumo: false, s: '[4z] で ロン！ 4つの 風 ぜんぶ 刻子で 大四喜（役満）。' }
        ],
        expect: ['大四喜']
    },
    {
        id: 'tsuuiisou', group: '役満', name: '字一色', reading: 'ツーイーソー', han: '役満', tag: '鳴いても OK',
        point: '字牌（東南西北白發中）だけで 作る。',
        start: '111z222z444z55z7z5m', seat: 1, round: 0,
        steps: [
            { s: 'ほとんど 字牌！', hl: '11122244455z' },
            { d: '7z', x: '5m', s: '[7z] を ツモ、[5m] を 捨てる。字牌だけ！' },
            { win: '5z', tsumo: false, s: '[5z] で ロン！ 字牌だけで 字一色（役満）。' }
        ],
        expect: ['字一色']
    },
    {
        id: 'ryuuiisou', group: '役満', name: '緑一色', reading: 'リューイーソー', han: '役満', tag: '鳴いても OK',
        point: '緑色の 牌（[2s][3s][4s][6s][8s] と [6z] 發）だけで 作る。',
        start: '234s666s8s666z22s5m', seat: 1, round: 0,
        steps: [
            { s: '緑の 牌が いっぱい！ [5m] は 緑じゃない。', hl: '5m' },
            { d: '8s', x: '5m', s: '[8s] を ツモ、[5m] を 捨てる。' },
            { win: '8s', tsumo: true, s: '[8s] を ツモ！ 緑の 牌だけで 緑一色（役満）。' }
        ],
        expect: ['緑一色']
    },
    {
        id: 'chinroutou', group: '役満', name: '清老頭', reading: 'チンロートー', han: '役満', tag: '鳴いても OK',
        point: '1と 9の 数牌だけで 作る（字牌も なし）。',
        start: '111m999m111p99s9p5m', seat: 1, round: 0,
        steps: [
            { s: '1と 9ばかり！', hl: '111m999m111p99s' },
            { d: '9p', x: '5m', s: '[9p] を ツモ、[5m] を 捨てる。[9s] か [9p] で あがり。' },
            { win: '9s', tsumo: false, s: '[9s] で ロン！ 1と 9だけで 清老頭（役満）。' }
        ],
        expect: ['清老頭']
    },
    {
        id: 'chuuren', group: '役満', name: '九蓮宝燈', reading: 'チューレンポートー', han: '役満', tag: '門前のみ',
        point: '1つの 色で [1]×3・2〜8 を 1枚ずつ・[9]×3 ＋ どれか 1枚。',
        start: '111234567899m4z', seat: 1, round: 0,
        steps: [
            { s: '萬子だけで 1112345678 99 …', hl: '111234567899m' },
            { d: '5m', x: '4z', s: '[5m] を ツモ、[4z] を 捨てる。' },
            { win: '9m', tsumo: true, s: '[9m] を ツモ！ 1112345678999 ＋ [5m] で 九蓮宝燈（役満）。' }
        ],
        expect: [['九蓮宝燈', '純正九蓮宝燈']]
    },
    {
        id: 'suukantsu', group: '役満', name: '四槓子', reading: 'スーカンツ', han: '役満', tag: 'カン 4回',
        point: 'カンを 4回 して、のこり 1枚の 単騎待ちで あがる。いちばん めずらしい 役の 1つ。',
        start: '222m555p888s444z9m', seat: 1, round: 0,
        steps: [
            { d: '2m', s: '[2m] の 4枚め！' }, { ankan: '2m', s: 'カン 1回め！' }, { d: '5z', x: '5z', s: '捨てる。' },
            { d: '5p', s: '[5p] の 4枚め！' }, { ankan: '5p', s: 'カン 2回め！' }, { d: '6z', x: '6z', s: '捨てる。' },
            { d: '8s', s: '[8s] の 4枚め！' }, { ankan: '8s', s: 'カン 3回め！' }, { d: '7z', x: '7z', s: '捨てる。' },
            { d: '4z', s: '[4z] の 4枚め！' }, { ankan: '4z', s: 'カン 4回め！ のこりは [9m] 1枚。' },
            { win: '9m', tsumo: true, flags: { rinshan: true }, s: '嶺上牌が [9m]！ 四槓子（役満）。四暗刻も ついた。' }
        ],
        expect: ['四槓子']
    },
    {
        id: 'tenhou', group: '役満', name: '天和', reading: 'テンホー', han: '役満', tag: '親だけ',
        point: '親が さいしょに くばられた 14枚で もう あがって いる。',
        start: '123m456p789s234s5m', seat: 0, round: 0,
        steps: [
            { s: 'あなたは 親。配牌は 14枚…' },
            { win: '5m', tsumo: true, flags: { tenhou: true }, s: 'くばられた ときに もう あがりの 形！ 天和（役満）。' }
        ],
        expect: ['天和']
    },
    {
        id: 'chiihou', group: '役満', name: '地和', reading: 'チーホー', han: '役満', tag: '子だけ',
        point: '子が さいしょの ツモで あがる（その 前に だれも 鳴いて いない）。',
        start: '123m456p789s23s55z', seat: 1, round: 0,
        steps: [
            { s: '配牌で もう テンパイ！ [1s] か [4s] が 来れば…' },
            { win: '4s', tsumo: true, flags: { chiihou: true }, s: 'さいしょの ツモで [4s]！ 地和（役満）。' }
        ],
        expect: ['地和']
    },
    {
        id: 'nagashi', group: 'とくべつ', name: '流し満貫', reading: 'ナガシマンガン', han: '満貫', tag: '流局の とき',
        point: '流局（だれも あがらず 山が なくなる）の とき、自分の 捨て牌が ぜんぶ 1・9・字牌で、1枚も 鳴かれて いなければ 満貫。',
        special: 'river', start: '', seat: 1, round: 0,
        steps: [
            { other: '1m', s: '捨てる 牌を ぜんぶ 1・9・字牌に する 作戦。' },
            { other: '9p', s: '[9p]…' },
            { other: '1z', s: '[1z]…' },
            { other: '9s', s: '[9s]…' },
            { other: '5z', s: '[5z]…' },
            { other: '1p', s: '[1p]…' },
            { other: '7z', s: 'だれにも 鳴かれず、ずっと 1・9・字牌を 捨てつづけた…' },
            { s: '山が なくなって 流局！ 捨て牌が ぜんぶ 1・9・字牌 なので 流し満貫（満貫と 同じ 点数）。' }
        ],
        expect: []
    }
];

/* ── 牌の 書きかた ── */
export function parseKinds(str) {
    const out = [];
    let nums = [];
    for (const ch of str) {
        if (/[0-9]/.test(ch)) { nums.push(ch); continue; }
        const base = { m: 0, p: 9, s: 18, z: 27 }[ch];
        for (const n of nums) out.push(base + Number(n) - 1);
        nums = [];
    }
    return out;
}
const one = s => parseKinds(s)[0];
const sortK = a => a.slice().sort((x, y) => x - y);

/**
 * 再生の コマを つくる。
 * かえす もの：{ frames, final } … final は evaluateWin の 入力（ctx）
 * コマ：{ hand, drawn, melds, river, riichiAt, cap, hl, ev, tile, other }
 * まちがった 手（ない 牌を 捨てる など）は Error を なげる（tests.js で たしかめる）
 */
export function replay(lesson) {
    let hand = sortK(parseKinds(lesson.start || ''));
    let drawn = null;
    const melds = [], river = [], others = [];
    let riichiAt = null;
    const frames = [];
    const push = (ev, cap, extra = {}) => frames.push({ hand: hand.slice(), drawn, melds: melds.map(m => ({ ...m, kinds: m.kinds.slice() })), river: river.slice(), riichiAt, others: others.slice(), cap, ev, ...extra });
    const take = k => {
        if (drawn === k) { drawn = null; return; }
        const i = hand.indexOf(k);
        if (i < 0) throw new Error(`${lesson.id}: 手に ない 牌 ${k}`);
        hand.splice(i, 1);
        if (drawn !== null) { hand.push(drawn); drawn = null; }
        hand = sortK(hand);
    };
    const absorb = () => { if (drawn !== null) { hand.push(drawn); drawn = null; hand = sortK(hand); } };
    push('start', lesson.point ? `【${lesson.name}】${lesson.point}` : lesson.name, { hl: [] });
    let final = null;
    for (const st of lesson.steps) {
        const hl = st.hl ? parseKinds(st.hl) : [];
        if (st.win) {
            const w = one(st.win);
            absorb();
            const closed = sortK([...hand, w]);
            final = { closed, win: w, melds: melds.map(m => ({ ...m })), tsumo: !!st.tsumo, flags: st.flags || {}, seat: lesson.seat, round: lesson.round, riichi: riichiAt !== null || !!(st.flags && st.flags.riichi) };
            push('win', st.s, { tile: w, tsumo: !!st.tsumo, hl: [] });
            continue;
        }
        if (st.d && st.x) {
            if (drawn !== null) absorb();
            drawn = one(st.d);
            push('draw', st.s, { tile: drawn, hl });
            const x = one(st.x);
            take(x);
            river.push(x);
            if (st.riichi) riichiAt = river.length - 1;
            push('discard', st.s, { tile: x, hl });
            continue;
        }
        if (st.d) {
            if (drawn !== null) absorb();
            drawn = one(st.d);
            push('draw', st.s, { tile: drawn, hl });
            continue;
        }
        if (st.x) {
            const x = one(st.x);
            take(x);
            river.push(x);
            if (st.riichi) riichiAt = river.length - 1;
            push('discard', st.s, { tile: x, hl });
            continue;
        }
        if (st.pon) {
            const k = one(st.pon);
            absorb();
            take(k); take(k);
            melds.push({ type: 'pon', kinds: [k, k, k] });
            push('call', st.s, { tile: k, word: 'ポン', hl });
            continue;
        }
        if (st.chi) {
            const k = one(st.chi);
            absorb();
            const use = parseKinds(st.use);
            for (const u of use) take(u);
            melds.push({ type: 'chi', kinds: sortK([k, ...use]), called: k });
            push('call', st.s, { tile: k, word: 'チー', hl });
            continue;
        }
        if (st.ankan) {
            const k = one(st.ankan);
            absorb();
            for (let i = 0; i < 4; i++) take(k);
            melds.push({ type: 'ankan', kinds: [k, k, k, k] });
            push('call', st.s, { tile: k, word: 'カン', hl });
            continue;
        }
        if (st.other) {
            const k = one(st.other);
            if (lesson.special === 'river') river.push(k); else others.push(k);
            push('other', st.s, { tile: k, hl });
            continue;
        }
        push('text', st.s, { hl });
    }
    return { frames, final };
}

/** あがりの 入力（evaluateWin 用）。牌の id は 赤でない ものを つかう */
export function finalCtx(final, rules) {
    const used = {};
    const id = k => { const five = k === 4 || k === 13 || k === 22; used[k] = used[k] || 0; return k * 4 + (five ? 1 : 0) + used[k]++; };
    const melds = final.melds.map(m => {
        const tiles = m.kinds.map(id);
        const type = m.type;
        return { type, tiles, called: m.called !== undefined ? tiles[m.kinds.indexOf(m.called)] : tiles[0], from: 3 };
    });
    const closed = [];
    let winId = null;
    for (const k of final.closed) { const i = id(k); closed.push(i); if (k === final.win && winId === null) winId = i; }
    // あがり牌は 手の 中の 同じ 種類の さいごの 1枚に する
    winId = closed.filter(i => (i >> 2) === final.win).pop();
    const f = final.flags || {};
    return {
        closed, melds, winTile: winId, tsumo: final.tsumo, seatWind: final.seat, roundWind: final.round,
        riichi: !!(final.riichi || f.riichi || f.doubleRiichi), doubleRiichi: !!f.doubleRiichi, ippatsu: !!f.ippatsu,
        rinshan: !!f.rinshan, chankan: !!f.chankan, haitei: !!f.haitei, houtei: !!f.houtei, tenhou: !!f.tenhou, chiihou: !!f.chiihou,
        doraInd: [], uraInd: [], rules
    };
}

/* 読みあげ用：[5m] → ごマン */
const NUM = ['いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HON = ['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン'];
export function tileReading(k) { return k >= 27 ? HON[k - 27] : NUM[k % 9] + ['マン', 'ピン', 'ソー'][Math.floor(k / 9)]; }
export function speechText(s) {
    return s.replace(/\[([0-9]+[mpsz])\]/g, (_, t) => parseKinds(t).map(tileReading).join(' '))
        .replace(/【[^】]*】/g, '')
        // 漢字（カタカナ）は 読みかたの カタカナだけ 読む
        .replace(/[^\s、。！？「」（）]+（([ァ-ヶー・\s]+)）/g, '$1')
        .replace(/[（）]/g, '、');
}
