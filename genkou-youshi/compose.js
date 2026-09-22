/* 原稿用紙ツール ― 文章を マスに わりつける
   なおした 文章を うけとり、原稿用紙の きまりに そって
   「どの行の どのマスに なにを 書くか」を きめます。 */

const GY_CLOSE         = '」』）〕】〉》｝］';
const GY_NO_LINE_START = '。、，．」』）〕】〉》｝］？！ゝゞヽヾ';
const GY_NO_LINE_END   = '「『（〔【〈《｛［';
const GY_SMALL_KANA    = 'ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー';

/* なぜ そう なったかの 説明（マスに さわると 出ます） */
const GY_NOTE = {
  hang : '行の はじめに 来るので、前のマスに 一緒に 入れました',
  push : '「 が 行の おわりに 来るので、つぎの行へ おくりました',
  kuten: '「。」を 1マスに まとめました'
};

/* たて書きに したとき、字を どう 置くか
   rot = 90どまわす（かぎかっこ・長音・ダッシュ・リーダ）
   tr  = マスの 右上に 置く（句読点）
   sk  = 少し 右上に よせる（小さい字）            */
const GY_ROT_OPEN  = '「『（〔【〈《｛［';   // 90どまわして マスの 上へ
const GY_ROT_CLOSE = '」』）〕】〉》｝］';   // 90どまわして マスの 下へ
const GY_ROT_MID   = 'ー—―〜～…‥＝';      // 90どまわして まんなかに
const GY_TOPRIGHT  = '、。，．';            // マスの 右上に
function gyCharClass(c){
  if(GY_ROT_OPEN .indexOf(c) >= 0) return 'rot ro';
  if(GY_ROT_CLOSE.indexOf(c) >= 0) return 'rot rc';
  if(GY_ROT_MID  .indexOf(c) >= 0) return 'rot';
  if(GY_TOPRIGHT .indexOf(c) >= 0) return 'tr';
  if(GY_SMALL_KANA.indexOf(c) >= 0) return 'sk';
  return '';
}

function gyIsLatin(c){ return /[Ａ-Ｚａ-ｚA-Za-z]/.test(c); }
function gyCls(c){ return gyIsLatin(c) ? 'latin' : ''; }

function gyNoLineStart(text, cfg){
  const c = Array.from(text)[0];
  if(GY_NO_LINE_START.indexOf(c) >= 0) return true;
  if(cfg.hangSmallKana && GY_SMALL_KANA.indexOf(c) >= 0) return true;
  return false;
}

/* 段落を マス1つぶんずつの ならびに する */
function gyBuildItems(paragraphs, cfg){
  const items = [];
  for(const p of paragraphs){
    items.push({ t:'newpara', indent: p.dialogue ? 0 : cfg.paragraphIndent });
    const u = p.units;
    for(let i = 0; i < u.length; i++){
      const c = u[i].c, nx = u[i+1];
      /* 「。」」を 1マスに */
      if(cfg.combineKutenBracket && (c === '。' || c === '、') && nx && GY_CLOSE.indexOf(nx.c) >= 0){
        items.push({ t:'cell', text: c + nx.c, fix: u[i].fix || nx.fix || '', cls:'multi', note: GY_NOTE.kuten });
        i++; continue;
      }
      items.push({ t:'cell', text:c, fix:u[i].fix || '', cls: gyCls(c) });
      /* ！ ？ の あとは 1マス あける */
      if(cfg.spaceAfterBangQuestion && (c === '！' || c === '？')){
        const after = nx ? nx.c : '';
        if(after && GY_NO_LINE_START.indexOf(after) < 0) items.push({ t:'blank' });
      }
    }
  }
  return items;
}

/* マスの ならびを 行に つめる（ここで 禁則処理を する） */
function gyPlace(items, cfg){
  const N = cfg.charsPerColumn;
  const cols = [];
  let cur = null, pos = N;

  const startCol = () => { cur = { cells: new Array(N).fill(null) }; cols.push(cur); pos = 0; return cur; };
  const lastCell = () => {
    for(let ci = cols.length - 1; ci >= 0; ci--){
      const cc = cols[ci].cells;
      for(let i = N - 1; i >= 0; i--) if(cc[i]) return cc[i];
    }
    return null;
  };

  for(const it of items){
    if(it.t === 'newpara'){ startCol(); pos = Math.min(it.indent, N); continue; }
    if(it.t === 'blank'){ if(pos < N - 1) pos++; continue; }

    if(pos >= N){
      const prev = lastCell();
      const room = prev ? (Array.from(prev.text).length + Array.from(it.text).length) : 99;
      if(cfg.hangPunctuation && prev && gyNoLineStart(it.text, cfg) && room <= 3){
        prev.text += it.text;
        prev.cls = 'multi';
        prev.note = GY_NOTE.hang;
        if(it.fix && !prev.fix) prev.fix = it.fix;
        continue;
      }
      startCol();
    }

    if(cfg.pushOpenBracket && pos === N - 1 && GY_NO_LINE_END.indexOf(it.text) >= 0){
      startCol();
      cur.cells[pos] = null;
      if(cols.length >= 2){
        const prevCol = cols[cols.length - 2];
        prevCol.note = GY_NOTE.push;
      }
    }

    cur.cells[pos++] = { text: it.text, fix: it.fix || '', cls: it.cls || '', note: it.note || '' };
  }
  return cols;
}

/* 題名・名前の 行を つくる */
function gyHeadColumns(title, name, cfg){
  const N = cfg.charsPerColumn;
  const blank = () => ({ cells: new Array(N).fill(null) });
  const cols = [];

  if(cfg.title.enabled){
    const col = blank();
    const norm = gyNormalize(title || '', cfg).paragraphs[0];
    const chars = norm ? norm.units.map(u => u.c) : [];
    const start = (cfg.title.align === 'center')
      ? Math.max(0, Math.floor((N - chars.length) / 2))
      : Math.min(cfg.title.indent, Math.max(0, N - chars.length));
    for(let i = 0; i < chars.length && start + i < N; i++){
      col.cells[start + i] = { text: chars[i], cls: gyCls(chars[i]), role:'title', fix:'', note:'' };
    }
    col.role = 'title';
    cols.push(col);
  }

  if(cfg.name.enabled){
    const col = blank();
    const parts = String(name || '').split(/[\s　]+/).filter(Boolean);
    const seq = [];
    parts.forEach((part, pi) => {
      if(pi > 0) for(let k = 0; k < cfg.name.gapBetween; k++) seq.push(null);
      const norm = gyNormalize(part, cfg).paragraphs[0];
      const chars = norm ? norm.units.map(u => u.c) : [];
      for(const ch of chars) seq.push(ch);
    });
    let start = N - cfg.name.bottomGap - seq.length;
    if(start < 0) start = 0;
    for(let i = 0; i < seq.length && start + i < N; i++){
      if(seq[i] !== null) col.cells[start + i] = { text: seq[i], cls: gyCls(seq[i]), role:'name', fix:'', note:'' };
    }
    col.role = 'name';
    cols.push(col);
  }

  for(let i = 0; i < (cfg.bodyGapColumns || 0); i++) cols.push(blank());
  return cols;
}

/* --- 本体 ---
   input : { title, name, body }
   cfg   : きまり
   もどり値 : { pages, columns, chars, fixes }
   まい数は きめません。書いた ぶんだけ 1まいずつ ふえます。 */
function gyCompose(input, cfg){
  cfg = cfg || GY_DEFAULTS;
  const norm  = gyNormalize(input.body || '', cfg);
  const items = gyBuildItems(norm.paragraphs, cfg);
  const body  = gyPlace(items, cfg);
  const head  = gyHeadColumns(input.title, input.name, cfg);
  const all   = head.concat(body);

  const per   = cfg.columnsPerPage;
  const nPage = Math.max(1, Math.ceil(all.length / per));
  const pages = [];
  for(let i = 0; i < nPage; i++){
    const columns = all.slice(i * per, (i + 1) * per);
    while(columns.length < per) columns.push({ cells: new Array(cfg.charsPerColumn).fill(null) });
    pages.push({ columns });
  }

  let chars = 0;
  for(const col of body) for(const cell of col.cells) if(cell) chars += Array.from(cell.text).length;

  return { pages, columns: all.length, chars, fixes: norm.fixes };
}
