/* 原稿用紙ツール ― きまりの たしかめ
   tests.html を ブラウザで ひらくと、きまりが 正しく はたらくか 一覧で 見られます。
   （node でも うごきます） */

/* 1つの行を 文字列に する。␣＝あきマス、{ }＝1マスに 2字以上 */
function gyColStr(col){
  return col.cells.map(c => !c ? '␣'
    : (Array.from(c.text).length > 1 ? '{' + c.text + '}' : c.text)).join('');
}

function gyTestCases(){
  const C = o => gyMergeConfig(GY_DEFAULTS, Object.assign({
    charsPerColumn:10, columnsPerPage:10, pages:1,
    title:{enabled:false}, name:{enabled:false}, bodyGapColumns:0
  }, o));

  return [
    { rule:'② 句点が 行のはじめに 来たら 前のマスに 入れる',
      cfg:C({}), input:{body:'あいうえおかきくけ。'},
      col:0, want:'␣あいうえおかきく{け。}' },

    { rule:'② とじかぎ 「」」も 前のマスに 入れる',
      cfg:C({}), input:{body:'「あいうえおかきくけ」'},
      col:0, want:'「あいうえおかきく{け」}' },

    { rule:'③ 「。」」は 1マスに まとめる',
      cfg:C({}), input:{body:'「おはよう。」'},
      col:0, want:'「おはよう{。」}␣␣␣␣' },

    { rule:'④ 会話文は 改行して 1マス目から',
      cfg:C({}), input:{body:'ぼくは言った。「おはよう。」'},
      col:1, want:'「おはよう{。」}␣␣␣␣' },

    { rule:'④ 会話文の 前の 文は そのまま 1マスあけ',
      cfg:C({}), input:{body:'ぼくは言った。「おはよう。」'},
      col:0, want:'␣ぼくは言った。␣␣' },

    { rule:'段落の はじめは 1マス あける',
      cfg:C({}), input:{body:'あい\nうえ'},
      col:1, want:'␣うえ␣␣␣␣␣␣␣' },

    { rule:'① 数量は 位取り（十二人）',
      cfg:C({}), input:{body:'12人'},
      col:0, want:'␣十二人␣␣␣␣␣␣' },

    { rule:'① 年は 並べ（二〇二六年）',
      cfg:C({}), input:{body:'2026年'},
      col:0, want:'␣二〇二六年␣␣␣␣' },

    { rule:'⑨ ！ の あとは 1マス あける',
      cfg:C({}), input:{body:'あ！い'},
      col:0, want:'␣あ！␣い␣␣␣␣␣' },

    { rule:'⑨ ！ の つぎが 」 なら あけない',
      cfg:C({}), input:{body:'「あ！」'},
      col:0, want:'「あ！」␣␣␣␣␣␣' },

    { rule:'⑩ …… は 2マス つかう',
      cfg:C({}), input:{body:'あ…い'},
      col:0, want:'␣あ……い␣␣␣␣␣' },

    { rule:'⑪ 行のおわりの 「 は つぎの行へ おくる',
      cfg:C({charsPerColumn:5}), input:{body:'あいう「え」'},
      col:0, want:'␣あいう␣' },
    { rule:'⑪ おくられた 「 は つぎの行の はじめから',
      cfg:C({charsPerColumn:5}), input:{body:'あいう「え」'},
      col:1, want:'「え」␣␣' },

    { rule:'小さい字（っ）は 既定では そのまま 行の はじめに 書く',
      cfg:C({charsPerColumn:5}), input:{body:'あいうえっお'},
      col:1, want:'っお␣␣␣' },
    { rule:'設定で 小さい字も 前のマスに 詰められる',
      cfg:C({charsPerColumn:5, hangSmallKana:true}), input:{body:'あいうえっお'},
      col:0, want:'␣あいう{えっ}' },
    { rule:'設定で 長音（ー）も 前のマスに 詰められる',
      cfg:C({charsPerColumn:5, hangSmallKana:true}), input:{body:'あいうえーお'},
      col:0, want:'␣あいう{えー}' },

    { rule:'段落が 会話から はじまる とき、設定で 1マス あけられる',
      cfg:C({dialogueParagraphIndent:true}), input:{body:'「おはよう。」と言った。'},
      col:0, want:'␣「おはよう{。」}␣␣␣' },
    { rule:'その ときも とじた あとは 1マス目から',
      cfg:C({dialogueParagraphIndent:true}), input:{body:'「おはよう。」と言った。'},
      col:1, want:'と言った。␣␣␣␣␣' },
    { rule:'文の 途中から はじまる 会話は 1マス あけない',
      cfg:C({dialogueParagraphIndent:true}), input:{body:'ぼくは言った。「おはよう。」'},
      col:1, want:'「おはよう{。」}␣␣␣␣' },

    { rule:'会話文の 「」を とじたら 改行して つぎも 1マス目から',
      cfg:C({}), input:{body:'「おはよう。」と言った。'},
      col:1, want:'と言った。␣␣␣␣␣' },
    { rule:'とじた あとの 会話も 1マス目から',
      cfg:C({}), input:{body:'「あ。」「い。」'},
      col:1, want:'「い{。」}␣␣␣␣␣␣␣' },
    { rule:'文の 途中の 「」（思ったこと）は 改行しない',
      cfg:C({charsPerColumn:20}), input:{body:'ぼくは「がんばろう」と思った。'},
      col:0, want:'␣ぼくは「がんばろう」と思った。␣␣␣␣' },
    { rule:'設定で どの「」でも 改行できる',
      cfg:C({charsPerColumn:20, quoteNewline:'always'}), input:{body:'ぼくは「がんばろう」と思った。'},
      col:1, want:'と思った。␣␣␣␣␣␣␣␣␣␣␣␣␣␣␣' },

    { rule:'小数点は 中黒に する',
      cfg:C({}), input:{body:'32.5度'},
      col:0, want:'␣三十二・五度␣␣␣' },
    { rule:'大文字だけの ことばは 1マス1字',
      cfg:C({}), input:{body:'NHK'},
      col:0, want:'␣NHK␣␣␣␣␣␣' },
    { rule:'小文字を ふくむ ことばは 1マス2字',
      cfg:C({}), input:{body:'Tokyo'},
      col:0, want:'␣{To}{ky}o␣␣␣␣␣␣' },
    { rule:'設定で アルファベットを ぜんぶ 1マス1字に できる',
      cfg:C({latinStyle:'perCell'}), input:{body:'Tokyo'},
      col:0, want:'␣Tokyo␣␣␣␣' },
    { rule:'…… の 2マス目は 行の はじめに 置かない',
      cfg:C({charsPerColumn:5}), input:{body:'あいう…え'},
      col:0, want:'␣あいう{……}' },
    { rule:'長い 題名は つぎの行へ 分ける',
      cfg:C({charsPerColumn:5, title:{enabled:true, align:'indent', indent:1}}),
      input:{title:'あいうえおかきく', body:'ほ'},
      col:1, want:'␣おかきく' },

    { rule:'本文の はじまりを 1行 あけられる',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3},
             name:{enabled:true, bottomGap:1, gapBetween:1}, bodyGapColumns:1}),
      input:{title:'あ', name:'い', body:'う'},
      col:3, want:'␣う␣␣␣␣␣␣␣␣' },
    { rule:'あけない ときは すぐ つぎの行から',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3},
             name:{enabled:true, bottomGap:1, gapBetween:1}, bodyGapColumns:0}),
      input:{title:'あ', name:'い', body:'う'},
      col:2, want:'␣う␣␣␣␣␣␣␣␣' },

    { rule:'まい数は 書いた ぶんだけ ふえる',
      cfg:C({charsPerColumn:5, columnsPerPage:2}), input:{body:'あ'.repeat(30)},
      pages:4 },

    { rule:'題名は 1行目・上を 3マス あける',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3}}),
      input:{title:'思い出', body:'あ'},
      col:0, want:'␣␣␣思い出␣␣␣␣' },

    { rule:'題名を まんなかに そろえる ことも できる',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'center'}}),
      input:{title:'思い出です', body:'あ'},
      col:0, want:'␣␣思い出です␣␣␣' },

    { rule:'名前は 下を 1マス あけて 下づめ・姓と名の あいだ 1マス',
      cfg:C({charsPerColumn:10, name:{enabled:true, bottomGap:1, gapBetween:1}}),
      input:{name:'山田 太郎', body:'あ'},
      col:0, want:'␣␣␣␣山田␣太郎␣' },

    { rule:'本文は 題名・名前の つぎの 行から はじまる',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3},
             name:{enabled:true, bottomGap:1, gapBetween:1}}),
      input:{title:'あ', name:'い', body:'う'},
      col:2, want:'␣う␣␣␣␣␣␣␣␣' },

    { rule:'半角の 記号は 全角に なおす',
      cfg:C({}), input:{body:'あ!い'},
      col:0, want:'␣あ！␣い␣␣␣␣␣' },

    { rule:'よけいな 空白は とる',
      cfg:C({}), input:{body:'　　あ い'},
      col:0, want:'␣あい␣␣␣␣␣␣␣' }
  ];
}

function gyRunTests(){
  const out = [];
  for(const t of gyTestCases()){
    let got = '', ok = false, err = '';
    try{
      const res = gyCompose(Object.assign({title:'', name:'', body:''}, t.input), t.cfg);
      if(t.pages !== undefined){
        got = res.pages.length + 'まい';
        ok  = (res.pages.length === t.pages);
      }else{
        const cols = [];
        for(const pg of res.pages) for(const c of pg.columns) cols.push(c);
        got = cols[t.col] ? gyColStr(cols[t.col]) : '（行が ありません）';
        ok = (got === t.want);
      }
    }catch(e){ err = String(e && e.message || e); }
    out.push({ rule:t.rule, want:(t.pages !== undefined ? t.pages + 'まい' : t.want), got, ok, err });
  }
  return out;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { gyRunTests, gyColStr };
