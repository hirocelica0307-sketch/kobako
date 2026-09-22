/* 原稿用紙ツール ― きまり（設定）
   先生が 設定画面（⚙）で かえられます。
   きまりの くわしい 説明は docs/RULES.md を 見てください。 */

const GY_DEFAULTS = {
  /* ---- マスの かたち ---- */
  charsPerColumn : 20,   // 1行に 入る 字数（たてに ならぶ マスの 数）
  columnsPerPage : 20,   // 1まいの 行数（よこに ならぶ 行の 数）
  /* まい数は きめません。書いた ぶんだけ 1まいずつ ふえます。 */

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
  bodyGapColumns  : 0,   // 名前の つぎに あける 行の 数
                         //   0 … すぐ つぎの行（3行目）から
                         //   1 … 1行 あけて（4行目）から
  paragraphIndent : 1,   // 段落の はじめに あける マスの 数

  /* ---- 原稿用紙の きまり ---- */
  hangPunctuation      : true,  // ② 行頭に 来る 句読点・とじかぎを 前のマスに 入れる
  hangSmallKana        : true,  // ⑧ 小さい字（っ ゃ ー）も 同じく 前のマスに 入れる
  combineKutenBracket  : true,  // ③ 「。」」を 1マスに まとめる
  dialogueNewline      : true,  // ④ 会話文は 改行して 1マス目から
  newlineAfterQuote    : true,  // ⑤ 「」が とじたら 改行して つぎも 1マス目から
  numbers              : 'mixed', // ① 'mixed'=使い分け / 'positional'=位取り / 'serial'=並べ / 'keep'=算用数字のまま
  spaceAfterBangQuestion: true, // ⑩ ！ ？ の あとを 1マス あける
  ellipsisTwoCells     : true,  // ⑪ …… —— は 2マス つかう
  pushOpenBracket      : true   // ⑫ 行の おわりに 来た 「 は つぎの行へ おくる
};

/* 設定を 1つに まぜあわせる（あさい ものだけ 上書き） */
function gyMergeConfig(base, over){
  const out = JSON.parse(JSON.stringify(base));
  for(const k in (over || {})){
    if(over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])){
      out[k] = Object.assign({}, out[k] || {}, over[k]);
    }else if(over[k] !== undefined){
      out[k] = over[k];
    }
  }
  return out;
}

function gyDefaultSettings(){ return gyMergeConfig(GY_DEFAULTS, {}); }

/* 前の かたちで 保存されて いた ものを いまの かたちに なおす */
function gyUpgradeSettings(s){
  if(!s || typeof s !== 'object') return gyDefaultSettings();
  if(Array.isArray(s)) s = s[0] || {};            // むかしは かだいの 一覧だった
  const out = gyMergeConfig(GY_DEFAULTS, s);
  if(s.bodyStartColumn !== undefined && s.bodyGapColumns === undefined){
    const head = (out.title.enabled ? 1 : 0) + (out.name.enabled ? 1 : 0);
    out.bodyGapColumns = Math.max(0, s.bodyStartColumn - 1 - head);
  }
  if(s.smallKanaAtLineStart !== undefined && s.hangSmallKana === undefined){
    out.hangSmallKana = !s.smallKanaAtLineStart;
  }
  delete out.bodyStartColumn;
  delete out.smallKanaAtLineStart;
  delete out.pages;
  delete out.id;
  delete out.label;
  return out;
}
