'use strict';
/* =========================================================
   カテゴリ（なにを 書くか）と デザイン いちらん
   1カテゴリ ＝ 低学年 5 ＋ 高学年 5
   ========================================================= */
const Ln = (lab, n, o = {}) => ({ t: 'lines', lab, n, ...o });
const Dr = (lab, o = {}) => ({ t: 'draw', lab, ...o });
const Nm = (lab, n, o = {}) => ({ t: 'num', lab, n, ...o });
const St = (lab, n, o = {}) => ({ t: 'stars', lab, n, ...o });
const Ch = (lab, list, o = {}) => ({ t: 'chips', lab, list, ...o });
const Fi = (lab, segs, o = {}) => ({ t: 'fill', lab, segs, ...o });
const Mo = (lab, list, o = {}) => ({ t: 'months', lab, list, ...o });
const Me = (lab, list, o = {}) => ({ t: 'meter', lab, list, ...o });
const Le = (lab, n, o = {}) => ({ t: 'letter', lab, n, ...o });
const BD = ['', '{月|がつ}', '', '{日|にち}'];

const CATS = {
  jiko: {
    name: 'じこしょうかい', when: '新学期の はじめ', en: 'MY PROFILE',
    title: { low: 'じこしょうかい カード', high: '{自己紹介|じこしょうかい}カード' },
    sec: {
      low: [Dr('じぶんの かおを かこう', { face: true }), Fi('たんじょうび', BD), Ln('すきな たべもの', 1), Ln('すきな あそび', 1), Ln('とくいな こと', 1), Ln('みんなへ ひとこと', 2)],
      high: [Dr('{似顔絵|にがおえ}', { face: true }), Fi('{誕生日|たんじょうび}', BD), Ln('{好|す}きな こと・もの', 2), Ln('{得意|とくい}な こと', 1), Ln('{最近|さいきん} はまって いる こと', 1, { half: true }), Ln('{自分|じぶん}を ひとことで', 1, { half: true, end: 'な{人|ひと}' }), Ln('{今年|ことし} がんばりたい こと', 2), Ln('みんなへ ひとこと', 2)],
    },
  },
  g1: {
    name: '1学期の めあて', when: '1学期の はじめ', en: 'GOALS 1st TERM',
    title: { low: '{1学期|いちがっき}の めあて', high: '{1学期|いちがっき}の{目標|もくひょう}' },
    sec: {
      low: [Dr('1がっきの じぶん'), Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ln('ともだち', 1, { half: true }), Ln('たのしみな こと', 1, { half: true }), Ln('いちばんの めあて', 1, { end: 'です！' })],
      high: [Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ln('{運動|うんどう}・{健康|けんこう}', 2, { half: true }), Ln('{友達|ともだち}・クラス', 2, { half: true }), Nm('{目標|もくひょう}に{向|む}けて {毎日|まいにち} する こと', 3), Ln('{1学期|いちがっき}の{終|お}わりに なりたい{自分|じぶん}', 2)],
    },
  },
  g2: {
    name: '2学期の めあて', when: '2学期の はじめ', en: 'GOALS 2nd TERM',
    title: { low: '{2学期|にがっき}の めあて', high: '{2学期|にがっき}の{目標|もくひょう}' },
    sec: {
      low: [Dr('がんばる じぶん'), Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ch('がんばりたい ぎょうじ', ['うんどう{会|かい}', 'はっぴょう{会|かい}', 'えんそく']), Ln('たのしみな こと', 1)],
      high: [Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ch('{力|ちから}を{入|い}れたい{行事|ぎょうじ}', ['{運動会|うんどうかい}', '{発表会|はっぴょうかい}', '{遠足|えんそく}', '{校外学習|こうがいがくしゅう}']), Ln('{1学期|いちがっき}の ふり{返|かえ}りを{生|い}かして', 2), Mo('{毎月|まいつき}の ふり{返|かえ}り', ['9{月|がつ}', '10{月|がつ}', '11{月|がつ}', '12{月|がつ}'])],
    },
  },
  undo: {
    name: '運動会', when: '運動会の まえ・あと', en: 'SPORTS DAY',
    title: { low: 'うんどう{会|かい} めあてカード', high: '{運動会|うんどうかい} {目標|もくひょう}カード' },
    sec: {
      low: [Dr('がんばる じぶん'), Ch('でる しゅもく', ['かけっこ', 'リレー', 'ダンス', 'つなひき', 'たまいれ']), Ln('めあて', 2), Ln('おうえんの ことば', 1), St('ふりかえり（おわったら）', 1)],
      high: [Ch('{出場|しゅつじょう}{種目|しゅもく}', ['{徒競走|ときょうそう}', 'リレー', 'ダンス', '{綱引|つなひ}き', '{騎馬戦|きばせん}', '{組体操|くみたいそう}']), Ln('{個人|こじん}の{目標|もくひょう}', 2), Ln('チーム・{団|だん}の{目標|もくひょう}', 2, { half: true }), Ln('{自分|じぶん}の{役割|やくわり}', 2, { half: true }), Nm('{本番|ほんばん}までの{練習|れんしゅう}{計画|けいかく}', 3), St('ふり{返|かえ}り（{終|お}わったら）', 1)],
    },
  },
  ongaku: {
    name: '音楽発表会', when: '音楽・学習発表会', en: 'CONCERT',
    title: { low: 'おんがく はっぴょう{会|かい}', high: '{音楽発表会|おんがくはっぴょうかい} カード' },
    sec: {
      low: [Dr('ステージの じぶん'), Ln('{曲名|きょくめい}', 1), Ln('がっき・パート', 1), Ln('めあて', 2), Ln('ここを きいてね！', 1)],
      high: [Ln('{曲名|きょくめい}', 1, { half: true }), Ln('{担当|たんとう}パート・{楽器|がっき}', 1, { half: true }), Ln('{目標|もくひょう}', 2), Nm('{練習|れんしゅう}で{工夫|くふう}する こと', 3), Ln('{聴|き}いて ほしい ポイント', 2), St('ふり{返|かえ}り（{終|お}わったら）', 1)],
    },
  },
  g3: {
    name: '3学期の めあて', when: '3学期の はじめ', en: 'GOALS 3rd TERM',
    title: { low: '{3学期|さんがっき}の めあて', high: '{3学期|さんがっき}の{目標|もくひょう}' },
    sec: {
      low: [Dr('がんばる じぶん'), Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ln('つぎの {学年|がくねん}へ', 2)],
      high: [Ln('{学習|がくしゅう}', 2), Ln('{生活|せいかつ}', 2), Ln('1{年|ねん}の しめくくりに したい こと', 2), Ln('{進級|しんきゅう}・{進学|しんがく}に{向|む}けて', 2), Nm('{具体的|ぐたいてき}に する こと', 3)],
    },
  },
  matome: {
    name: '1年の ふりかえり', when: '3学期の おわり', en: 'MY YEAR',
    title: { low: '1{年間|ねんかん}の おもいで', high: '1{年間|ねんかん}の ふり{返|かえ}り' },
    sec: {
      low: [Dr('{1学期|いちがっき}', { boxed: true, half: true }), Dr('{2学期|にがっき}', { boxed: true, half: true }), Dr('{3学期|さんがっき}', { boxed: true, half: true }), Ln('できるように なった こと', 2, { half: true }), Ln('つぎの {学年|がくねん}で やりたい こと', 2)],
      high: [Ln('{1学期|いちがっき}の{思|おも}い{出|で}', 2), Ln('{2学期|にがっき}の{思|おも}い{出|で}', 2), Ln('{3学期|さんがっき}の{思|おも}い{出|で}', 2), Nm('{成長|せいちょう}した こと ベスト3', 3, { medal: true }), Le('{未来|みらい}の{自分|じぶん}へ', 3, { to: '{来年|らいねん}の わたしへ', from: '{今|いま}の わたしより' })],
    },
  },
  shoujou: {
    name: 'しょうじょう', when: '各学期の おわり', en: 'AWARD', cert: true,
    title: { low: 'しょうじょう', high: '表彰状' },
  },
  kakari: {
    name: '係カード', when: '係を きめた とき', en: 'TEAM', kakari: true,
    title: { low: '', high: '' },
  },
  ichiran: {
    name: '係 いちらん表', when: '係を きめた とき', en: 'TEAMS',
    title: { low: 'みんなの かかり', high: 'みんなの かかり' },
  },
};

// デザイン： grade（low/high）・theme・layout・hero ／ draw（とくべつ デザイン）
const DESIGN_SRC = {
  jiko: [
    { grade: 'low', draw: () => cardJiko(), name: 'じぶん ずかん' },
    { grade: 'low', theme: 'animals', layout: 'side', sideN: 3, title: 'よろしくね カード' },
    { grade: 'low', theme: 'balloon', layout: 'side', sideN: 3, flip: true, title: 'わたしの こと しってね！' },
    { grade: 'low', theme: 'sweets', layout: 'grid', hero: 'nameTag' },
    { grade: 'low', theme: 'rainbow', layout: 'hero', hero: 'kidWave', drop: ['draw'], title: 'はじめまして！' },
    { grade: 'high', theme: 'passport', layout: 'side', sideN: 3, title: '{自己紹介|じこしょうかい}パスポート' },
    { grade: 'high', theme: 'sns', layout: 'side', sideN: 3, flip: true, title: '#わたしの プロフィール' },
    { grade: 'high', theme: 'magazine', layout: 'side', sideN: 3, title: '{自己紹介|じこしょうかい}{特集号|とくしゅうごう}' },
    { grade: 'high', theme: 'notebook', layout: 'grid', hero: 'mirror', title: 'わたしの トリセツ' },
    { grade: 'high', theme: 'rpg', layout: 'side', sideN: 3, title: 'キャラクター しょうかい',
      secs: [Dr('キャラクター', { face: true }), Ln('とくい わざ（{得意|とくい}な こと）', 1), Ln('すきな アイテム（{好|す}きな もの）', 1), Ln('{今|いま} ハマって いる こと', 1), Me('ステータス', ['{元気|げんき}', 'やさしさ', 'おもしろさ', '{集中力|しゅうちゅうりょく}', '']), Ln('なかまへ ひとこと', 2)] },
  ],
  g1: [
    { grade: 'low', draw: () => cardSakura(), name: 'さくらの はなびら' },
    { grade: 'low', theme: 'sakura', layout: 'side', sideN: 2 },
    { grade: 'low', theme: 'garden', layout: 'around', hero: 'tulips',
      secs: [Ln('{学習|がくしゅう}', 3), Ln('ともだち', 2), Ln('{生活|せいかつ}', 3), Ln('たのしみな こと', 2), Ln('いちばんの めあて', 1, { end: 'です！' })] },
    { grade: 'low', theme: 'animals', layout: 'stack', hero: 'randoseru', drop: ['draw'] },
    { grade: 'low', theme: 'train', layout: 'hero', hero: 'school', drop: ['draw'], title: 'しゅっぱつ！ 1がっき' },
    { grade: 'high', theme: 'notebook', layout: 'stack', hero: 'sakuraBranch' },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'school', title: '{1学期|いちがっき} {目標|もくひょう}{新聞|しんぶん}' },
    { grade: 'high', theme: 'lab', layout: 'stack', hero: 'calendar', title: '{1学期|いちがっき} {目標|もくひょう}{計画書|けいかくしょ}' },
    { grade: 'high', theme: 'board', layout: 'side', hero: 'school', sideN: 2 },
    { grade: 'high', theme: 'manga', layout: 'grid', hero: 'randoseru', title: '{1学期|いちがっき}、はじまる！' },
  ],
  g2: [
    { grade: 'low', theme: 'forest', layout: 'side', sideN: 2, hero: 'momiji' },
    { grade: 'low', theme: 'rainbow', layout: 'around', hero: 'tsukimi',
      secs: [Ln('{学習|がくしゅう}', 3), Ln('{生活|せいかつ}', 3), Ln('がんばりたい ぎょうじ', 2), Ln('たのしみな こと', 2), Ln('いちばんの めあて', 1, { end: 'です！' })] },
    { grade: 'low', theme: 'sea', layout: 'stack', hero: 'dragonfly', drop: ['draw'] },
    { grade: 'low', theme: 'dino', layout: 'side', sideN: 2, flip: true },
    { grade: 'low', theme: 'space', layout: 'hero', hero: 'chest', drop: ['draw'], title: '2がっき たんけんたい' },
    { grade: 'high', draw: () => cardQuest(), name: 'たからの ちず クエスト' },
    { grade: 'high', theme: 'rpg', layout: 'stack', hero: 'chest', title: '{2学期|にがっき} クエスト' },
    { grade: 'high', theme: 'magazine', layout: 'grid', hero: 'momiji' },
    { grade: 'high', theme: 'sns', layout: 'side', hero: 'tsukimi', sideN: 2, title: '#{2学期|にがっき}の{目標|もくひょう}' },
    { grade: 'high', theme: 'lab', layout: 'around', hero: 'acorn',
      secs: [Ln('{学習|がくしゅう}', 3), Ln('{生活|せいかつ}', 3), Ln('{行事|ぎょうじ}', 3), Ln('{友達|ともだち}・クラス', 3), Nm('{具体的|ぐたいてき}に する こと', 3), Mo('{毎月|まいつき}の ふり{返|かえ}り', ['9{月|がつ}', '10{月|がつ}', '11{月|がつ}', '12{月|がつ}'])] },
  ],
  undo: [
    { grade: 'low', draw: () => cardUndo(), name: 'メダルと ガーランド' },
    { grade: 'low', theme: 'balloon', layout: 'side', sideN: 2, hero: 'medal' },
    { grade: 'low', theme: 'dino', layout: 'hero', hero: 'tamaire', drop: ['draw'] },
    { grade: 'low', theme: 'train', layout: 'stack', hero: 'goal', drop: ['draw'], title: 'めざせ ゴール！' },
    { grade: 'low', theme: 'animals', layout: 'around', hero: 'trophy',
      secs: [Ln('でる しゅもく', 2), Ln('めあて', 3), Ln('おうえんの ことば', 2), Ln('れんしゅうで がんばる こと', 3), St('ふりかえり（おわったら）', 1)] },
    { grade: 'high', theme: 'stadium', layout: 'stack', hero: 'medal' },
    { grade: 'high', theme: 'newspaper', layout: 'side', hero: 'goal', sideN: 2, title: '{運動会|うんどうかい} スポーツ{新聞|しんぶん}' },
    { grade: 'high', theme: 'manga', layout: 'grid', hero: 'tsunahiki', title: '{勝負|しょうぶ}の{日|ひ}！ {運動会|うんどうかい}' },
    { grade: 'high', theme: 'rpg', layout: 'side', hero: 'trophy', sideN: 2, title: '{運動会|うんどうかい} クエスト' },
    { grade: 'high', theme: 'board', layout: 'around', hero: 'medal',
      secs: [Ln('{個人|こじん}の{目標|もくひょう}', 3), Ln('チームの{目標|もくひょう}', 3), Ln('{自分|じぶん}の{役割|やくわり}', 3), Ln('{練習|れんしゅう}で{意識|いしき}する こと', 3), St('ふり{返|かえ}り（{終|お}わったら）', 2)] },
  ],
  ongaku: [
    { grade: 'low', draw: () => cardOngaku(), name: 'ステージと チケット' },
    { grade: 'low', theme: 'garden', layout: 'side', sideN: 2, hero: 'notes' },
    { grade: 'low', theme: 'rainbow', layout: 'hero', hero: 'keys', drop: ['draw'], title: 'ドレミの めあてカード' },
    { grade: 'low', theme: 'animals', layout: 'around', hero: 'drum',
      secs: [Ln('{曲名|きょくめい}', 2), Ln('がっき・パート', 2), Ln('めあて', 3), Ln('ここを きいてね！', 3)] },
    { grade: 'low', theme: 'space', layout: 'stack', hero: 'recorder', drop: ['draw'] },
    { grade: 'high', theme: 'score', layout: 'stack', hero: 'notes' },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'stage', title: '{音楽発表会|おんがくはっぴょうかい} {特集|とくしゅう}' },
    { grade: 'high', theme: 'sns', layout: 'grid', hero: 'keys', title: '#{音楽発表会|おんがくはっぴょうかい}' },
    { grade: 'high', theme: 'notebook', layout: 'around', hero: 'recorder',
      secs: [Ln('{曲名|きょくめい}', 2), Ln('{担当|たんとう}パート', 2), Ln('{目標|もくひょう}', 3), Ln('{聴|き}いて ほしい ポイント', 3), Nm('{練習|れんしゅう}で{工夫|くふう}する こと', 3), St('ふり{返|かえ}り（{終|お}わったら）', 1)] },
    { grade: 'high', theme: 'passport', layout: 'side', hero: 'drum', sideN: 2, title: 'ステージ パス' },
  ],
  g3: [
    { grade: 'low', draw: () => cardDaruma(), name: 'だるま' },
    { grade: 'low', theme: 'snow', layout: 'side', sideN: 2, hero: 'snowman' },
    { grade: 'low', theme: 'animals', layout: 'around', hero: 'kite',
      secs: [Ln('{学習|がくしゅう}', 3), Ln('{生活|せいかつ}', 3), Ln('ともだち', 3), Ln('つぎの {学年|がくねん}へ', 3)] },
    { grade: 'low', theme: 'train', layout: 'hero', hero: 'hinode', drop: ['draw'], title: 'さいごの 3がっき' },
    { grade: 'low', theme: 'sweets', layout: 'stack', hero: 'koma', drop: ['draw'] },
    { grade: 'high', theme: 'wa', layout: 'stack', hero: 'hinode' },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'daruma', title: '{3学期|さんがっき} {決意|けつい}{新聞|しんぶん}' },
    { grade: 'high', theme: 'notebook', layout: 'side', hero: 'kite', sideN: 2 },
    { grade: 'high', theme: 'rpg', layout: 'around', hero: 'koma', title: 'ラストステージ',
      secs: [Ln('{学習|がくしゅう}', 3), Ln('{生活|せいかつ}', 3), Ln('しめくくり', 3), Ln('{進級|しんきゅう}・{進学|しんがく}へ', 3), Nm('{具体的|ぐたいてき}に する こと', 3)] },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'snowman' },
  ],
  matome: [
    { grade: 'low', theme: 'rainbow', layout: 'stack' },
    { grade: 'low', theme: 'sweets', layout: 'stack', title: 'がんばったね 1ねんかん' },
    { grade: 'low', theme: 'train', layout: 'stack', title: 'おもいで れっしゃ' },
    { grade: 'low', theme: 'garden', layout: 'stack' },
    { grade: 'low', theme: 'balloon', layout: 'stack', title: 'ありがとう 1ねんかん' },
    { grade: 'high', draw: () => cardAlbum(), name: 'フィルムの アルバム' },
    { grade: 'high', theme: 'magazine', layout: 'stack', hero: 'camera', title: '1{年間|ねんかん}の{思|おも}い{出|で} {総集編|そうしゅうへん}' },
    { grade: 'high', theme: 'newspaper', layout: 'grid', hero: 'film', title: '1{年間|ねんかん} ふり{返|かえ}り{新聞|しんぶん}' },
    { grade: 'high', theme: 'sns', layout: 'side', hero: 'calendar', sideN: 2, title: '#1{年間|ねんかん}の ふり{返|かえ}り' },
    { grade: 'high', theme: 'lab', layout: 'stack', hero: 'stairs', title: '{成長|せいちょう}の{記録|きろく}' },
  ],
  shoujou: [
    { grade: 'low', draw: () => cardShoujou(), name: 'てんてんの わく' },
    { grade: 'low', frame: 'stars', hero: 'trophy', name: 'ほしの わく' },
    { grade: 'low', frame: 'flower', hero: 'crown', name: 'はなの わく' },
    { grade: 'low', frame: 'ribbon', hero: 'medal', laurel: false, name: 'リボンの わく' },
    { grade: 'low', frame: 'animals', hero: 'rosette', name: 'どうぶつの わく' },
    { grade: 'high', frame: 'classic', hero: 'rosette', name: 'クラシック' },
    { grade: 'high', frame: 'wa', hero: 'crown', name: 'わがら（せいがいは）' },
    { grade: 'high', frame: 'guilloche', hero: 'medal', laurel: false, name: 'しょうけん ふう' },
    { grade: 'high', frame: 'modern', hero: 'trophy', name: 'モダン' },
    { grade: 'high', frame: 'crest', hero: 'rosette', name: 'エンブレム' },
  ],
  kakari: [
    { grade: 'low', theme: 'shop' }, { grade: 'low', theme: 'train' }, { grade: 'low', theme: 'space' }, { grade: 'low', theme: 'animals' }, { grade: 'low', theme: 'forest' },
    { grade: 'high', theme: 'company' }, { grade: 'high', theme: 'board' }, { grade: 'high', theme: 'newspaper' }, { grade: 'high', theme: 'notebook' }, { grade: 'high', theme: 'rpg' },
  ],
  ichiran: [
    { grade: 'low', draw: () => cardIchiran(), name: 'はたと えんぴつ' },
  ],
};

// id と なまえを つける
const DESIGNS = [];
const DCOUNT = {};
function addDesigns(cat, list) {
  const cnt = DCOUNT[cat] || (DCOUNT[cat] = { low: 0, high: 0 });
  list.forEach(ds => {
    cnt[ds.grade]++;
    ds.cat = cat;
    ds.id = `${cat}-${ds.grade === 'low' ? 'L' : 'H'}${cnt[ds.grade]}`;
    if (!ds.name) ds.name = ds.theme ? THEMES[ds.theme].name : (CERT[ds.frame] ? ds.frame : '');
    DESIGNS.push(ds);
  });
}
for (const [cat, list] of Object.entries(DESIGN_SRC)) addDesigns(cat, list);
const designById = id => DESIGNS.find(d => d.id === id);

function renderDesign(ds) {
  G = ds.grade;
  LBL = G === 'low' ? 4.5 : 4;
  const cat = CATS[ds.cat];
  if (ds.draw) return ds.draw();
  if (ds.multi) return renderMulti(ds);
  if (cat.cert) return renderCert(ds);
  let use = ds;
  if (ds.drop) use = { ...ds, secs: (ds.secs || cat.sec[G]).filter(s => !ds.drop.includes(s.t)) };
  return renderGeneric(use);
}
