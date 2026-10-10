'use strict';
/* =========================================================
   ばめんの ある デザインを カテゴリに ついか ＋
   いままでの デザインの かざりを「うごく 子ども」に かえる
   ========================================================= */
const sl = (...labs) => labs.map(l => typeof l === 'string' ? { lab: l } : l);

const SCENE_DESIGNS = {
  jiko: [
    { grade: 'low', scene: 'wave', name: 'てを ふる 子', title: 'よろしくね！',
      slots: sl('すきな もの', 'すきな あそび', 'とくいな こと', 'たんじょうび', 'みんなへ ひとこと') },
    { grade: 'high', scene: 'manga', name: 'マンガの コマ', title: '{自己紹介|じこしょうかい}マンガ', intro: '{新|あたら}しい クラスで…', shout: 'よろしく！',
      slots: sl({ lab: 'わたしの{得意|とくい}な ことは、', end: 'です！' }, '{好|す}きな こと', 'ハマって いる こと') },
  ],
  g1: [
    { grade: 'low', scene: 'stairs', name: 'かいだんを のぼる 子', step: 1,
      slots: sl('いちばんの めあて', 'たのしみな こと', '{学習|がくしゅう}', '{生活|せいかつ}') },
    { grade: 'low', scene: 'balloon', name: 'ききゅう', shout: 'がんばるぞ！',
      slots: sl('{学習|がくしゅう}', '{生活|せいかつ}', 'ともだち', 'クラスの みんなへ') },
    { grade: 'high', scene: 'rocket', name: 'ロケット（まどに 顔）', title: '{1学期|いちがっき} {発射|はっしゃ}！',
      slots: sl('{1学期|いちがっき}の{目標|もくひょう}', '{学習|がくしゅう}', '{生活|せいかつ}', 'みんなへ') },
  ],
  g2: [
    { grade: 'low', scene: 'ship', name: 'ふねの ほ', title: '{2学期|にがっき} しゅっこう！',
      slots: sl('めあて', 'たのしみな こと', 'クラスの みんなへ') },
    { grade: 'high', scene: 'manga', name: 'マンガの コマ', title: '{2学期|にがっき}、はじまる！', intro: '{夏休|なつやす}みが{終|お}わって…', shout: 'やってやるぞ！',
      slots: sl('{2学期|にがっき} がんばりたい ことは、', '{楽|たの}しみな{行事|ぎょうじ}', '{学習|がくしゅう}の{目標|もくひょう}') },
    { grade: 'high', scene: 'balloon', name: 'ききゅう',
      slots: sl('{学習|がくしゅう}', '{生活|せいかつ}', '{行事|ぎょうじ}', 'クラスの みんなへ') },
  ],
  g3: [
    { grade: 'low', scene: 'finish', name: 'ラストスパート', title: '{3学期|さんがっき} ラストスパート',
      slots: sl('{3学期|さんがっき}の めあて', 'さいごまで がんばる こと', 'つぎの {学年|がくねん}へ') },
    { grade: 'high', scene: 'stairs', name: 'ゴール ちかくの かいだん', title: 'ゴールは もうすぐ！', step: 4, headband: true,
      slots: sl('{3学期|さんがっき}の{目標|もくひょう}', '{進級|しんきゅう}に{向|む}けて', '{学習|がくしゅう}', '{生活|せいかつ}') },
    { grade: 'high', scene: 'mountain', name: '山の ちょうじょうへ', title: '1{年|ねん}の{山|やま}の てっぺんへ',
      slots: sl('1{月|がつ}', '2{月|がつ}', '3{月|がつ}', '{3学期|さんがっき}の{目標|もくひょう}') },
  ],
  undo: [
    { grade: 'low', scene: 'finish', name: 'ゴールテープ', shout: 'ゴールまで はしるぞ！',
      slots: sl('めあて', 'でる しゅもく', 'おうえんの ことば') },
    { grade: 'high', scene: 'manga', name: 'マンガの コマ', title: '{運動会|うんどうかい}への{道|みち}', intro: '{練習|れんしゅう}が はじまった…', shout: '勝つぞ！', headband: true,
      slots: sl('{本番|ほんばん}で がんばりたい ことは、', '{出場|しゅつじょう}{種目|しゅもく}', 'チームの{目標|もくひょう}') },
    { grade: 'high', scene: 'finish', name: 'ゴールテープ',
      slots: sl('{個人|こじん}の{目標|もくひょう}', '{自分|じぶん}の{役割|やくわり}', 'ふり{返|かえ}り（{終|お}わったら）') },
  ],
  ongaku: [
    { grade: 'low', scene: 'stage', inst: 'recorder', name: 'リコーダーを ふく 子',
      slots: sl('{曲名|きょくめい}', 'がっき・パート', 'めあて', 'ここを きいてね！') },
    { grade: 'low', scene: 'stage', inst: 'keyboard', name: 'けんばんハーモニカの 子',
      slots: sl('{曲名|きょくめい}', 'がっき・パート', 'めあて', 'ここを きいてね！') },
    { grade: 'high', scene: 'stage', inst: 'drum', name: 'たいこを たたく 子',
      slots: sl('{曲名|きょくめい}・{担当|たんとう}パート', '{目標|もくひょう}', '{聴|き}いて ほしい ポイント', 'ふり{返|かえ}り（{終|お}わったら）') },
    { grade: 'high', scene: 'stage', inst: 'sing', name: 'うたう 子', title: '{合唱|がっしょう}・{合奏|がっそう} カード',
      slots: sl('{曲名|きょくめい}・パート', '{目標|もくひょう}', '{聴|き}いて ほしい ポイント', 'ふり{返|かえ}り（{終|お}わったら）') },
  ],
  matome: [
    { grade: 'low', scene: 'tree', name: 'せいちょうの き', title: '1ねんかんの せいちょうの き',
      slots: sl('{1学期|いちがっき}', '{2学期|にがっき}', '{3学期|さんがっき}', 'できるように なった', 'うれしかった こと', 'つぎの がくねんで') },
    { grade: 'high', scene: 'mountain', name: '山のぼりの ふりかえり', title: '1{年間|ねんかん}の{山|やま}のぼり', shout: 'やったー！',
      slots: sl('{1学期|いちがっき}', '{2学期|にがっき}', '{3学期|さんがっき}', '1{年間|ねんかん}で{成長|せいちょう}した こと') },
  ],
  natsu: [
    { grade: 'low', scene: 'ship', name: 'なつの ぼうけん', title: 'なつの ぼうけん',
      slots: sl('いちばんの おもいで', 'いった ところ', '2がっきに がんばる こと') },
    { grade: 'high', scene: 'balloon', name: 'ききゅう',
      slots: sl('{楽|たの}しかった こと', 'がんばった こと', '{新|あたら}しい{発見|はっけん}', '{2学期|にがっき}に{生|い}かす こと') },
  ],
  ensoku: [
    { grade: 'low', scene: 'bus', name: 'バスで しゅっぱつ',
      slots: sl('いった ところ', 'たのしかった こと', 'みつけた もの', 'ありがとう') },
    { grade: 'low', scene: 'mountain', name: 'やまのぼり', title: 'えんそく やまのぼり', shout: 'ついた！',
      slots: sl('いった ところ', 'みつけた もの', 'たのしかった こと', 'ありがとうを つたえたい ひと') },
    { grade: 'high', scene: 'bus', name: 'バスで しゅっぱつ',
      slots: sl('{見学先|けんがくさき}', 'わかった こと・{学|まな}んだ こと', '{疑問|ぎもん}に{思|おも}った こと', 'これから{調|しら}べたい こと') },
  ],
  dokusho: [
    { grade: 'low', scene: 'reading', name: 'ほんを よむ 子',
      slots: sl('おもしろかった ところ', 'ほんの だいめい・かいた ひと', 'すきな ばめん', 'おすすめ ど') },
    { grade: 'high', scene: 'reading', name: '本を 読む 子',
      slots: sl('{感想|かんそう}', '{書名|しょめい}・{作者|さくしゃ}', '{名場面|めいばめん}', 'おすすめ{度|ど}') },
  ],
  ganbari: [
    { grade: 'low', scene: 'jump', name: 'なわとびを する 子',
      slots: sl('チャレンジ する こと', 'できたら スタンプ', 'まだまだ スタンプ', 'おうちの ひとから') },
    { grade: 'high', scene: 'stairs', name: '目標への 階段', title: '{目標|もくひょう}への{階段|かいだん}', step: 3,
      slots: sl('{目標|もくひょう}', '{今|いま}の{記録|きろく}', '{毎日|まいにち} する こと', 'ふり{返|かえ}り') },
  ],
  nawa: [
    { grade: 'low', scene: 'jump', name: 'とぶ 子 ＋ スタンプ', title: 'なわとび カード',
      slots: sl('めあての わざ', 'とべたら スタンプ', 'がんばった ひの スタンプ', 'おうちの ひとから') },
    { grade: 'mid', scene: 'jump', name: 'とぶ子 ＋ スタンプ', title: 'なわとびカード',
      slots: sl('{目標|もくひょう}の{技|わざ}と{回数|かいすう}', 'とべたら スタンプ', '{練習|れんしゅう}した{日|ひ}の スタンプ', 'ふり{返|かえ}り') },
  ],
  seicho: [
    { grade: 'low', scene: 'tree', name: 'せいちょうの き',
      slots: sl('あかちゃんの とき', 'ようちえん', 'いま', 'できるように なった', 'すきな こと', 'おうちの ひとへ') },
    { grade: 'high', scene: 'stairs', name: '未来への 階段', title: '{未来|みらい}への{階段|かいだん}', step: 3,
      slots: sl('10{年後|ねんご}の{自分|じぶん}', '{将来|しょうらい}の{夢|ゆめ}', '{夢|ゆめ}を かなえる ために すること', '{家族|かぞく}への ありがとう') },
  ],
  sotsugyo: [
    { grade: 'low', scene: 'balloon', name: 'ききゅう', shout: 'ありがとう！',
      slots: sl('6ねんせいとの おもいで', 'ありがとう', 'おうえん して いるよ', '6ねんせいへ ひとこと') },
    { grade: 'high', scene: 'stairs', name: '中学校への 階段', title: '{中学校|ちゅうがっこう}への{階段|かいだん}', step: 5,
      slots: sl('{小学校|しょうがっこう}の{思|おも}い{出|で}', '{中学校|ちゅうがっこう}で がんばる こと', '{成長|せいちょう}した こと', '{先生|せんせい}・{家族|かぞく}へ') },
  ],
  tanjoubi: [
    { grade: 'low', scene: 'cake', name: 'ケーキに かく',
      slots: sl('なまえ', 'おたんじょうび おめでとう！', 'これからも よろしくね', 'みんなから ひとこと') },
    { grade: 'high', scene: 'cake', name: 'ケーキに 書く',
      slots: sl('{名前|なまえ}', 'おめでとう メッセージ', 'これからも よろしく', 'みんなから メッセージ') },
  ],
};
for (const [cat, list] of Object.entries(SCENE_DESIGNS)) addDesigns(cat, list);

// いままでの デザインの かざりを「うごく 子ども」に
const HERO_SWAP = {
  'ongaku-L2': 'kidSing', 'ongaku-L3': 'kidKeyboard', 'ongaku-L4': 'kidDrum', 'ongaku-L5': 'kidRecorder',
  'ongaku-H1': 'kidSing', 'ongaku-H3': 'kidKeyboard', 'ongaku-H4': 'kidRecorder', 'ongaku-H5': 'kidDrum',
  'undo-L2': 'kidCheer', 'undo-L3': 'kidThrow', 'undo-L4': 'kidSprint', 'undo-L5': 'kidCheer',
  'undo-H1': 'kidRun', 'undo-H2': 'kidSprint', 'undo-H3': 'kidPull', 'undo-H4': 'kidCheer', 'undo-H5': 'kidRun',
  'g3-L3': 'kidRun', 'g3-L4': 'kidSprint', 'g3-L5': 'kidSprint', 'g3-H3': 'kidRun', 'g3-H4': 'kidClimb',
  'g1-L4': 'kidWalk', 'g1-L5': 'kidWalk', 'g1-H1': 'kidWave', 'g1-H3': 'kidThink', 'g1-H4': 'kidPoint', 'g1-H5': 'kidPoint',
  'g2-L5': 'kidPoint', 'g2-H2': 'kidPoint', 'g2-H5': 'kidThink',
  'jiko-L4': 'kidWave', 'matome-H5': 'kidClimb', 'natsu-L5': 'kidWater',
  'dokusho-L1': 'kidRead', 'dokusho-L2': 'kidRead', 'dokusho-H1': 'kidRead', 'dokusho-H4': 'kidRead',
  'ganbari-L2': 'kidJump', 'ensoku-L4': 'kidWalk', 'ensoku-H1': 'kidWalk', 'seicho-L1': 'kidWater',
};
for (const [id, h] of Object.entries(HERO_SWAP)) { const ds = designById(id); if (ds && ds.hero) ds.hero = h; }
