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
    title:{enabled:false}, name:{enabled:false}, bodyStartColumn:1
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

    { rule:'⑦ 段落の はじめは 1マス あける',
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

    { rule:'⑧ 小さい字（っ）は 行のはじめに 来てもよい',
      cfg:C({charsPerColumn:5}), input:{body:'あいうえっお'},
      col:1, want:'っお␣␣␣' },

    { rule:'⑤ 題名は 1行目・上を 3マス あける',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3}, bodyStartColumn:2}),
      input:{title:'思い出', body:'あ'},
      col:0, want:'␣␣␣思い出␣␣␣␣' },

    { rule:'⑤ 題名を まんなかに そろえる ことも できる',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'center'}, bodyStartColumn:2}),
      input:{title:'思い出です', body:'あ'},
      col:0, want:'␣␣思い出です␣␣␣' },

    { rule:'⑥ 名前は 下を 1マス あけて 下づめ・姓と名の あいだ 1マス',
      cfg:C({charsPerColumn:10, name:{enabled:true, bottomGap:1, gapBetween:1}, bodyStartColumn:2}),
      input:{name:'山田 太郎', body:'あ'},
      col:0, want:'␣␣␣␣山田␣太郎␣' },

    { rule:'本文は 題名・名前の つぎの 行から はじまる',
      cfg:C({charsPerColumn:10, title:{enabled:true, align:'indent', indent:3},
             name:{enabled:true, bottomGap:1, gapBetween:1}, bodyStartColumn:3}),
      input:{title:'あ', name:'い', body:'う'},
      col:2, want:'␣う␣␣␣␣␣␣␣␣' },

    { rule:'⑫ 半角の 字は 全角に なおす',
      cfg:C({}), input:{body:'ABC'},
      col:0, want:'␣ＡＢＣ␣␣␣␣␣␣' },

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
      const cols = res.pages[0].columns;
      got = cols[t.col] ? gyColStr(cols[t.col]) : '（行が ありません）';
      ok = (got === t.want);
    }catch(e){ err = String(e && e.message || e); }
    out.push({ rule:t.rule, want:t.want, got, ok, err });
  }
  return out;
}

if(typeof module !== 'undefined' && module.exports) module.exports = { gyRunTests, gyColStr };
