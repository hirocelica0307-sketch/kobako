/* 原稿用紙ツール ― きまり（設定）の既定値
   ここの値は 先生が 設定画面で かえられます。
   きまりの くわしい 説明は docs/RULES.md を 見てください。 */

const GY_DEFAULTS = {
  /* ---- マスの かたち ---- */
  charsPerColumn : 20,   // 1行に 入る 字数（たてに ならぶ マスの 数）
  columnsPerPage : 20,   // 1まいの 行数（よこに ならぶ 行の 数）
  pages          : 1,    // なんまい まで 書けるか

  /* ---- 題名 ---- */
  title: {
    enabled : true,
    align   : 'indent',  // 'indent' = 上を あける / 'center' = まんなか
    indent  : 3          // 上を あける マスの 数
  },

  /* ---- 名前 ---- */
  name: {
    enabled   : true,
    bottomGap : 1,       // 下を あける マスの 数
    gapBetween: 1        // 姓と名の あいだの マスの 数
  },

  /* ---- 本文 ---- */
  bodyStartColumn : 3,   // 本文が はじまる 行（1から かぞえる）
  paragraphIndent : 1,   // 段落の はじめに あける マスの 数

  /* ---- 原稿用紙の きまり ---- */
  hangPunctuation      : true,  // ② 行のはじめに来る 句読点・とじかぎを 前のマスに 入れる
  combineKutenBracket  : true,  // ③ 「。」」を 1マスに まとめる
  dialogueNewline      : true,  // ④ 会話文は 改行して 1マス目から
  numbers              : 'mixed', // ① 'mixed'=使い分け / 'positional'=位取り / 'serial'=並べ / 'keep'=算用数字のまま
  smallKanaAtLineStart : true,  // ⑧ 小さい字（っ ゃ ー）は 行のはじめに 来てもよい
  spaceAfterBangQuestion: true, // ⑨ ！ ？ の あとを 1マス あける
  ellipsisTwoCells     : true,  // ⑩ …… —— は 2マス つかう
  pushOpenBracket      : true   // ⑪ 行の おわりに 来た 「 は つぎの行へ おくる
};

/* ---- かだい（先生が つくる 課題の ひな型）---- */
const GY_PRESETS = [
  { id:'bunshu',  label:'そつぎょう文集', charsPerColumn:20, columnsPerPage:20, pages:2,
    title:{enabled:true, align:'indent', indent:3}, name:{enabled:true, bottomGap:1, gapBetween:1} },
  { id:'kansou',  label:'読書かんそう文', charsPerColumn:20, columnsPerPage:20, pages:1,
    title:{enabled:true, align:'indent', indent:3}, name:{enabled:true, bottomGap:1, gapBetween:1} },
  { id:'furikaeri', label:'今日の ふりかえり', charsPerColumn:20, columnsPerPage:10, pages:1,
    title:{enabled:false, align:'indent', indent:3}, name:{enabled:true, bottomGap:1, gapBetween:1} }
];

/* 設定を 1つに まぜあわせる（あさい ものだけ 上書き） */
function gyMergeConfig(base, over){
  const out = JSON.parse(JSON.stringify(base));
  for(const k in (over || {})){
    if(over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])){
      out[k] = Object.assign({}, out[k] || {}, over[k]);
    }else if(over[k] !== undefined && k !== 'id' && k !== 'label'){
      out[k] = over[k];
    }
  }
  return out;
}
