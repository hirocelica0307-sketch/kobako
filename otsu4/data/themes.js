/* おつよん ― テーマの一覧
   問題・知識カードは、この theme キーでつながります。
   同じ theme の問題どうしが「類似問題」になります。 */

var OTSU4_SUBJECTS = {
  law : { key:'law',  name:'法令',     full:'危険物に関する法令',                    count:15, pass:9 },
  phys: { key:'phys', name:'物理化学', full:'基礎的な物理学及び基礎的な化学',        count:10, pass:6 },
  prop: { key:'prop', name:'性質消火', full:'危険物の性質並びにその火災予防及び消火の方法', count:10, pass:6 }
};

var OTSU4_THEMES = [
  /* ---- 法令 ---- */
  { key:'teigi',        subject:'law',  name:'危険物の定義・第1〜6類',   star:3 },
  { key:'shiteisuryo',  subject:'law',  name:'指定数量と倍数計算',       star:5 },
  { key:'kubun',        subject:'law',  name:'製造所等の区分',           star:4 },
  { key:'shinsei',      subject:'law',  name:'許可・承認・届出',         star:5 },
  { key:'menjo',        subject:'law',  name:'免状',                     star:5 },
  { key:'koshu',        subject:'law',  name:'保安講習',                 star:4 },
  { key:'kantokusha',   subject:'law',  name:'保安監督者・保安員',       star:4 },
  { key:'yobo',         subject:'law',  name:'予防規程',                 star:4 },
  { key:'tenken',       subject:'law',  name:'定期点検・保安検査',       star:4 },
  { key:'hoankyori',    subject:'law',  name:'保安距離・保有空地',       star:5 },
  { key:'kouzou',       subject:'law',  name:'位置・構造・設備の基準',   star:3 },
  { key:'tank',         subject:'law',  name:'タンクの基準',             star:4 },
  { key:'kyuyu',        subject:'law',  name:'給油取扱所',               star:3 },
  { key:'chozou',       subject:'law',  name:'貯蔵・取扱いの基準',       star:4 },
  { key:'unpan',        subject:'law',  name:'運搬の基準',               star:5 },
  { key:'isou',         subject:'law',  name:'移送の基準',               star:4 },
  { key:'hyoshiki',     subject:'law',  name:'標識・掲示板',             star:3 },
  { key:'shoukasetsubi',subject:'law',  name:'消火設備・警報設備',       star:4 },
  { key:'meirei',       subject:'law',  name:'命令・許可の取消し',       star:2 },

  /* ---- 物理・化学 ---- */
  { key:'nenshou',      subject:'phys', name:'燃焼の3要素・燃焼の仕方',  star:5 },
  { key:'inkaten',      subject:'phys', name:'引火点・発火点・燃焼範囲', star:5 },
  { key:'shouka',       subject:'phys', name:'消火の4要素と消火剤',      star:5 },
  { key:'seidenki',     subject:'phys', name:'静電気',                   star:5 },
  { key:'netsu',        subject:'phys', name:'熱・比熱・熱の移動',       star:4 },
  { key:'henka',        subject:'phys', name:'物理変化と化学変化',       star:3 },
  { key:'sanka',        subject:'phys', name:'酸化と還元',               star:4 },
  { key:'sanenki',      subject:'phys', name:'酸・塩基・中和',           star:3 },
  { key:'busshitsu',    subject:'phys', name:'単体・化合物・混合物',     star:3 },
  { key:'yuuki',        subject:'phys', name:'有機化合物',               star:3 },
  { key:'kinzoku',      subject:'phys', name:'金属・腐食',               star:3 },
  { key:'hijuu',        subject:'phys', name:'密度・比重・蒸気比重',     star:4 },
  { key:'kitai',        subject:'phys', name:'気体の法則・状態変化',     star:3 },
  { key:'noudo',        subject:'phys', name:'濃度の計算',               star:2 },
  { key:'mol',          subject:'phys', name:'化学反応式・モル・熱化学', star:2 },
  { key:'shizenhakka',  subject:'phys', name:'自然発火',                 star:3 },

  /* ---- 性質・消火 ---- */
  { key:'kyoutsuu',     subject:'prop', name:'第4類に共通する性質',      star:5 },
  { key:'yoboushouka',  subject:'prop', name:'第4類の火災予防・消火',    star:5 },
  { key:'gasoline',     subject:'prop', name:'ガソリン',                 star:5 },
  { key:'touyukeiyu',   subject:'prop', name:'灯油・軽油',               star:5 },
  { key:'juuyu',        subject:'prop', name:'重油',                     star:4 },
  { key:'tokushu',      subject:'prop', name:'特殊引火物',               star:5 },
  { key:'alcohol',      subject:'prop', name:'アルコール類',             star:5 },
  { key:'sek1',         subject:'prop', name:'第1石油類',                star:4 },
  { key:'sek2',         subject:'prop', name:'第2石油類',                star:3 },
  { key:'sek3',         subject:'prop', name:'第3石油類',                star:3 },
  { key:'sek4',         subject:'prop', name:'第4石油類',                star:3 },
  { key:'doushoku',     subject:'prop', name:'動植物油類',               star:4 },
  { key:'tarui',        subject:'prop', name:'第4類以外の類',            star:2 }
];

var OTSU4_THEME_MAP = (function(){
  var m = {};
  for (var i=0; i<OTSU4_THEMES.length; i++) m[OTSU4_THEMES[i].key] = OTSU4_THEMES[i];
  return m;
})();
