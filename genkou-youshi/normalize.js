/* 原稿用紙ツール ― 入力を 原稿用紙の 書き方に なおす
   よこ書きで 打った 文章を、たて書きの 原稿用紙に 入れられる 形に そろえます。
   なおした ところには しるし（fix）を つけて、あとで 色を つけられる ように します。 */

/* なおした りゆう（画面に 出す ことば） */
const GY_FIX_LABEL = {
  num   : '数字を 漢数字に なおしました',
  zen   : '半角の 字を 全角に なおしました',
  punct : '読点・句点・記号を 全角に なおしました',
  dots  : '「…」を 2マスの 「……」に なおしました',
  dash  : '「—」を 2マスの 「——」に なおしました',
  space : 'よけいな 空白を とりました'
};

const GY_D_KANJI = '〇一二三四五六七八九';

/* 位取り（十二 / 三百五十 / 二千二十六） */
function gyKanjiPositional(digits){
  let n = parseInt(digits, 10);
  if(!isFinite(n)) return digits;
  if(n === 0) return '〇';
  const big = ['', '万', '億', '兆'];
  const small = ['', '十', '百', '千'];
  let out = '', gi = 0;
  while(n > 0){
    const g = n % 10000;
    if(g > 0){
      let s = '', gg = g, i = 0;
      while(gg > 0){
        const d = gg % 10;
        if(d > 0) s = ((d === 1 && i > 0) ? '' : GY_D_KANJI[d]) + small[i] + s;
        gg = Math.floor(gg / 10); i++;
      }
      out = s + big[gi] + out;
    }
    n = Math.floor(n / 10000); gi++;
  }
  return out;
}

/* 並べ（二〇二六 / 三五〇） */
function gyKanjiSerial(digits){
  let out = '';
  for(const d of digits) out += GY_D_KANJI[Number(d)];
  return out;
}

/* 数字の ならびを 漢数字に する。after は そのすぐ あとの 字 */
function gyDigitsToKanji(digits, after, mode, before){
  if(mode === 'keep') return digits;
  if(mode === 'positional') return gyKanjiPositional(digits);
  if(mode === 'serial')     return gyKanjiSerial(digits);
  /* mixed（使い分け）*/
  if(/[-−－ー]/.test(before || '') || /[-−－]/.test(after || ''))
    return gyKanjiSerial(digits);          // 電話番号などの つながった 数字
  if(digits.length >= 7)               return gyKanjiSerial(digits);  // けたの とても 多い 番号
  if(digits.length > 1 && digits[0] === '0') return gyKanjiSerial(digits);  // 0で はじまる 番号
  if(digits.length === 4 && after === '年')  return gyKanjiSerial(digits);  // 二〇二六年
  if(after === '組' || after === '番' || after === '号') return gyKanjiSerial(digits);
  return gyKanjiPositional(digits);
}

/* 半角 → 全角（数字は べつに あつかうので ここでは ふくめない） */
function gyToZenkaku(ch){
  const code = ch.charCodeAt(0);
  if(code >= 0x21 && code <= 0x7e) return String.fromCharCode(code + 0xfee0);
  return ch;
}

const GY_PUNCT_MAP = { ',':'、', '.':'。', '!':'！', '?':'？', '，':'、', '．':'。' };

/* --- 本体 ---
   src : 児童が 打った 文章（よこ書き・改行は \n）
   cfg : きまり
   もどり値 : { paragraphs:[{units:[{c,fix}], dialogue:bool}], fixes:{りゆう:かず} } */
function gyNormalize(src, cfg){
  cfg = cfg || GY_DEFAULTS;
  const fixes = {};
  const addFix = k => { if(k) fixes[k] = (fixes[k] || 0) + 1; };

  const rawParas = String(src == null ? '' : src)
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const paragraphs = [];
  for(const raw of rawParas){
    const line = raw.replace(/^[ 　\t]+/, m => { if(m) addFix('space'); return ''; })
                    .replace(/[ 　\t]+$/, '');
    if(line === ''){ continue; }                 // 空行は とばす
    const chars = Array.from(line);
    const units = [];
    for(let i = 0; i < chars.length; i++){
      const c = chars[i];

      /* 数字の ならび */
      if(/[0-9０-９]/.test(c)){
        const before = chars[i-1] || '';
        let run = '';
        while(i < chars.length && /[0-9０-９]/.test(chars[i])){
          run += chars[i].replace(/[０-９]/, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
          i++;
        }
        const after = chars[i] || '';
        const conv = gyDigitsToKanji(run, after, cfg.numbers, before);
        i--;
        const changed = (conv !== run);
        for(const k of Array.from(conv)) units.push({ c:k, fix: changed ? 'num' : '' });
        if(changed) addFix('num');
        continue;
      }

      /* 三点リーダ … / ... / 。。。 */
      if(cfg.ellipsisTwoCells && (c === '…' || (c === '.' && chars[i+1] === '.' && chars[i+2] === '.'))){
        let n = 0;
        if(c === '…'){ while(chars[i+n] === '…') n++; i += n - 1; }
        else { while(chars[i+n] === '.') n++; i += n - 1; }
        units.push({ c:'…', fix:'dots' }); units.push({ c:'…', fix:'dots' });
        addFix('dots');
        continue;
      }

      /* ダッシュ ― / — / -- */
      if(cfg.ellipsisTwoCells && (c === '—' || c === '―' || (c === '-' && chars[i+1] === '-'))){
        let n = 0;
        while(chars[i+n] === c) n++;
        i += n - 1;
        units.push({ c:'—', fix:'dash' }); units.push({ c:'—', fix:'dash' });
        addFix('dash');
        continue;
      }

      /* 空白 ― 原稿用紙では ことばの あいだを あけないので とる */
      if(c === ' ' || c === '　' || c === '\t'){
        addFix('space');
        continue;
      }

      /* 句読点の なおし */
      if(GY_PUNCT_MAP[c]){
        const to = GY_PUNCT_MAP[c];
        units.push({ c:to, fix: to === c ? '' : 'punct' });
        if(to !== c) addFix('punct');
        continue;
      }

      /* 半角 → 全角 */
      const z = gyToZenkaku(c);
      units.push({ c:z, fix: z === c ? '' : 'zen' });
      if(z !== c) addFix('zen');
    }
    if(units.length) paragraphs.push({ units, dialogue:false });
  }

  /* 会話文を わける（「 で はじまる 段落 ／ 。「 の ところ） */
  const out = [];
  for(const p of paragraphs){
    if(!cfg.dialogueNewline){ out.push(p); continue; }
    let cur = [];
    for(let i = 0; i < p.units.length; i++){
      const u = p.units[i], nx = p.units[i+1];
      cur.push(u);
      if(u.c === '。' && nx && nx.c === '「'){
        out.push({ units:cur, dialogue: cur[0].c === '「' });
        cur = [];
      }
    }
    if(cur.length) out.push({ units:cur, dialogue: cur[0].c === '「' });
  }

  return { paragraphs: cfg.dialogueNewline ? out : paragraphs, fixes };
}
