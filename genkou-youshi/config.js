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
  hangPunctuation      : true,  // 行頭に 来る 句読点・とじかぎを 前のマスに 入れる
  hangStyle            : 'inside', // 'inside'=前のマスに 一緒に / 'outside'=マスの 外に ぶら下げる
  hangSmallKana        : false, // 小さい字（っ ゃ ー）も 同じく 前のマスに 入れるか
                                //   false … そのまま 行の はじめに 書く（一般的）
                                //   true  … 句読点と 同じく 前のマスに 詰める
  combineKutenBracket  : true,  // 「。」」を 1マスに まとめる
  dialogueNewline      : true,  // 会話文は 改行して 1マス目から
  quoteNewline         : 'dialogue', // 「」を とじた あとの 改行
                                //   'dialogue' … 文の はじめの「」＝会話文だけ 改行する。
                                //                文の 途中の「」（思ったこと・引用）は 改行しない
                                //   'always'   … どの「」でも 改行する
                                //   'never'    … 改行しない
  numbers              : 'mixed', // 'mixed'=使い分け / 'positional'=位取り / 'serial'=並べ / 'keep'=算用数字のまま
  decimalNakaguro      : true,  // 小数点を 中黒に する（三十二・五）
  latinStyle           : 'rule',// 'rule'=大文字は 1マス1字・小文字は 1マス2字（よこ向き）
                                // 'perCell'=ぜんぶ 1マス1字
  spaceAfterBangQuestion: true, // ！ ？ の あとを 1マス あける
  ellipsisTwoCells     : true,  // …… —— は 2マス つかう
  keepPairTogether     : true,  // …… —— の 2マス目が 行頭に 来ないように する
  pushOpenBracket      : true,  // 行の おわりに 来た 「 は つぎの行へ おくる
  wrapLongTitle        : true   // 1行に 入りきらない 題名は つぎの行へ 分ける
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
  if(s.newlineAfterQuote !== undefined && s.quoteNewline === undefined){
    out.quoteNewline = s.newlineAfterQuote ? 'dialogue' : 'never';
  }
  delete out.bodyStartColumn;
  delete out.smallKanaAtLineStart;
  delete out.pages;
  delete out.newlineAfterQuote;
  delete out.id;
  delete out.label;
  return out;
}
