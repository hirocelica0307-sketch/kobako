/* 原稿用紙ツール ― 画面の うごき */

(function(){
'use strict';

const $ = id => document.getElementById(id);
const el = {
  title:$('inTitle'), name:$('inName'), body:$('inBody'),
  sheets:$('sheets'), count:$('count'), fixes:$('fixes'),
  note:$('note'), save:$('save'),
  rowTitle:$('rowTitle'), rowName:$('rowName'),
  btnPrint:$('btnPrint'), btnFix:$('btnFix'), btnSet:$('btnSet'),
  printSize:$('printSize'),

  panel:$('settings'), btnCloseSet:$('btnCloseSet'),
  setChars:$('setChars'), setCols:$('setCols'),
  setTitleOn:$('setTitleOn'), setTitleAlign:$('setTitleAlign'), setTitleIndent:$('setTitleIndent'),
  setNameOn:$('setNameOn'), setNameBottom:$('setNameBottom'), setNameGap:$('setNameGap'),
  setBodyGap:$('setBodyGap'), bodyGapHint:$('bodyGapHint'), setParaIndent:$('setParaIndent'),
  setNumbers:$('setNumbers'), setDecimal:$('setDecimal'), setLatin:$('setLatin'),
  setHang:$('setHang'), setHangStyle:$('setHangStyle'), setSmallKana:$('setSmallKana'),
  setKuten:$('setKuten'), setDialogue:$('setDialogue'), setAfterQuote:$('setAfterQuote'),
  setBangSpace:$('setBangSpace'), setEllipsis:$('setEllipsis'), setPair:$('setPair'),
  setPushOpen:$('setPushOpen'), setWrapTitle:$('setWrapTitle'),
  setCode:$('setCode'), btnCodeOut:$('btnCodeOut'), btnCodeIn:$('btnCodeIn'),
  btnReset:$('btnReset'), setMsg:$('setMsg')
};

let cfg   = null;   // いまの きまり
let raf   = null;
let chars = 0;      // いまの 字数（先生の シートにも のせる）
let pages = 1;      // いまの まい数

/* ================= ほぞん ================= */
let saveTimer = null;
function saveDoc(){
  if(!cfg) return;
  gyStore.setDoc({
    title:el.title.value, name:el.name.value, body:el.body.value,
    chars:chars, pages:pages
  });
}
function saveSoon(){
  clearTimeout(saveTimer);
  el.save.textContent = 'ほぞん中…';
  saveTimer = setTimeout(saveDoc, 600);
}

/* ================= 原稿用紙を 出す ================= */

/* マスの 大きさを きめる。
   行の わく線（左右 1.5px ずつ）と マスの しきり線（1px）も 数に 入れないと
   A4 から はみ出して しまうので、そのぶんを ひいてから わりつけます。 */
function fitCell(w, h, M, N, bCol, bCell){
  const byW = (w - M * bCol * 2)               / (M * 1.18 - 0.18 + 1.4);
  const byH = (h - (N - 1) * bCell - bCol * 2) / (N + 1.4);
  return Math.min(byW, byH);
}

function sizeCells(){
  const N = cfg.charsPerColumn, M = cfg.columnsPerPage;
  const box  = el.sheets.getBoundingClientRect();
  const w    = Math.max(240, box.width  - 40);
  const h    = Math.max(240, box.height - 40);
  const cell = Math.max(11, Math.min(fitCell(w, h, M, N, 1.5, 1), 34));
  /* いんさつ：A4（よゆうを みて 182mm × 252mm）／ 1.5px=0.397mm、1px=0.265mm */
  const mm = fitCell(182, 252, M, N, 0.397, 0.265);
  el.printSize.textContent =
    ':root{ --cell:' + cell.toFixed(2) + 'px; }\n' +
    '@media print{ :root{ --cell:' + mm.toFixed(3) + 'mm; } }';
}

/* 1つの マスに 字を 入れる。
   ・ふつうの マス                … 1字を まんなかに
   ・アルファベット（小文字）       … 1マスに 2字、よこ向きに
   ・詰めた マス（「た。」「けっ」） … もとの 字は そのままの 大きさ、あとの 字は 小さく 右下に
   ・句読点だけの マス（「。」」）   … 2つとも 小さく たてに ならべる   */
function fillCell(d, cell){
  const text  = cell.text;
  const chars = Array.from(text);
  const mkSpan = ch => {
    const s = document.createElement('span');
    s.textContent = ch;
    const k = gyCharClass(ch);
    if(k) s.className = k;
    return s;
  };

  if(cell.cls === 'lat2'){            // 小文字は 1マスに 2字（よこ向き）
    d.classList.add('lat2');
    const s = document.createElement('span');
    s.className = 'latpair';
    s.textContent = text;
    d.appendChild(s);
    return;
  }
  if(cell.cls === 'lat1'){            // 大文字は 1マスに 1字
    d.classList.add('lat1');
    const s = document.createElement('span');
    s.textContent = text;
    d.appendChild(s);
    return;
  }

  if(chars.length === 1){ d.appendChild(mkSpan(chars[0])); return; }

  if(GY_NO_LINE_START.indexOf(chars[0]) >= 0){   // 「。」」のような 句読点だけの マス
    d.classList.add('stack');
    for(const ch of chars) d.appendChild(mkSpan(ch));
    return;
  }
  d.classList.add('hang');                        // 「た。」のような 詰めた マス
  const main = mkSpan(chars[0]);
  main.classList.add('main');
  d.appendChild(main);
  const tail = document.createElement('div');
  tail.className = 'tail';
  for(let i = 1; i < chars.length; i++){
    const s = mkSpan(chars[i]);
    /* 小さい字は 句読点より 大きめに（読めるように） */
    if(GY_SMALL_KANA.indexOf(chars[i]) >= 0) s.classList.add('tk');
    tail.appendChild(s);
  }
  d.appendChild(tail);
}

function render(){
  const res = gyCompose({ title:el.title.value, name:el.name.value, body:el.body.value }, cfg);
  sizeCells();

  const frag = document.createDocumentFragment();
  res.pages.forEach((pg, i) => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet' + (cfg.hangStyle === 'outside' ? ' hang-out' : '');
    const label = document.createElement('div');
    label.className = 'sheet-no';
    label.textContent = (i + 1) + ' / ' + res.pages.length + ' まい目';
    for(const col of pg.columns){
      const c = document.createElement('div');
      c.className = 'col';
      for(const cell of col.cells){
        const d = document.createElement('div');
        d.className = 'cell'
          + (cell && cell.fix  ? ' fix'  : '')
          + (cell && cell.note ? ' note' : '');
        if(cell){
          fillCell(d, cell);
          const why = [];
          if(cell.note) why.push(cell.note);
          if(cell.fix && GY_FIX_LABEL[cell.fix]) why.push(GY_FIX_LABEL[cell.fix]);
          if(why.length) d.title = why.join(' / ');
        }
        c.appendChild(d);
      }
      sheet.appendChild(c);
    }
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.appendChild(sheet);
    wrap.appendChild(label);
    frag.appendChild(wrap);
  });
  el.sheets.innerHTML = '';
  el.sheets.appendChild(frag);

  chars = res.chars;
  pages = res.pages.length;
  el.count.textContent = res.chars + '字・' + pages + 'まい';
  el.note.textContent  = '1まい ' + (cfg.charsPerColumn * cfg.columnsPerPage) + '字（' +
                         cfg.charsPerColumn + '字 × ' + cfg.columnsPerPage + '行）';
  el.fixes.innerHTML = '';
  for(const k in res.fixes){
    if(!GY_FIX_LABEL[k]) continue;
    const d = document.createElement('div');
    d.className = 'fix-item';
    d.textContent = GY_FIX_LABEL[k] + '（' + res.fixes[k] + 'か所）';
    el.fixes.appendChild(d);
  }
}

function renderSoon(){
  if(raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
}

/* ================= 先生用の せってい ================= */
function headColumns(){
  return (cfg.title.enabled ? 1 : 0) + (cfg.name.enabled ? 1 : 0);
}
function bodyGapHint(){
  const start = headColumns() + (cfg.bodyGapColumns || 0) + 1;
  el.bodyGapHint.textContent = '本文は ' + start + '行目から はじまります。';
}

function loadSettingsForm(){
  el.setChars.value       = cfg.charsPerColumn;
  el.setCols.value        = cfg.columnsPerPage;
  el.setTitleOn.checked   = !!cfg.title.enabled;
  el.setTitleAlign.value  = cfg.title.align;
  el.setTitleIndent.value = cfg.title.indent;
  el.setNameOn.checked    = !!cfg.name.enabled;
  el.setNameBottom.value  = cfg.name.bottomGap;
  el.setNameGap.value     = cfg.name.gapBetween;
  el.setBodyGap.value     = String(cfg.bodyGapColumns || 0);
  el.setParaIndent.value  = cfg.paragraphIndent;
  el.setNumbers.value     = cfg.numbers;
  el.setDecimal.checked   = !!cfg.decimalNakaguro;
  el.setLatin.value       = cfg.latinStyle;
  el.setHang.checked      = !!cfg.hangPunctuation;
  el.setHangStyle.value   = cfg.hangStyle;
  el.setSmallKana.checked = !!cfg.hangSmallKana;
  el.setKuten.checked     = !!cfg.combineKutenBracket;
  el.setDialogue.checked  = !!cfg.dialogueNewline;
  el.setAfterQuote.value  = cfg.quoteNewline;
  el.setBangSpace.checked = !!cfg.spaceAfterBangQuestion;
  el.setEllipsis.checked  = !!cfg.ellipsisTwoCells;
  el.setPair.checked      = !!cfg.keepPairTogether;
  el.setPushOpen.checked  = !!cfg.pushOpenBracket;
  el.setWrapTitle.checked = !!cfg.wrapLongTitle;
  bodyGapHint();
}

function num(input, min, max, now){
  const v = parseInt(input.value, 10);
  if(!isFinite(v)) return now;
  return Math.min(max, Math.max(min, v));
}

function applySettingsForm(){
  cfg.charsPerColumn = num(el.setChars, 4, 40, cfg.charsPerColumn);
  cfg.columnsPerPage = num(el.setCols,  2, 40, cfg.columnsPerPage);
  cfg.title.enabled  = el.setTitleOn.checked;
  cfg.title.align    = el.setTitleAlign.value;
  cfg.title.indent   = num(el.setTitleIndent, 0, cfg.charsPerColumn, cfg.title.indent);
  cfg.name.enabled   = el.setNameOn.checked;
  cfg.name.bottomGap = num(el.setNameBottom, 0, cfg.charsPerColumn, cfg.name.bottomGap);
  cfg.name.gapBetween= num(el.setNameGap, 0, 5, cfg.name.gapBetween);
  cfg.bodyGapColumns = parseInt(el.setBodyGap.value, 10) || 0;
  cfg.paragraphIndent= num(el.setParaIndent, 0, 3, cfg.paragraphIndent);

  cfg.numbers               = el.setNumbers.value;
  cfg.decimalNakaguro       = el.setDecimal.checked;
  cfg.latinStyle            = el.setLatin.value;
  cfg.hangPunctuation       = el.setHang.checked;
  cfg.hangStyle             = el.setHangStyle.value;
  cfg.hangSmallKana         = el.setSmallKana.checked;
  cfg.combineKutenBracket   = el.setKuten.checked;
  cfg.dialogueNewline       = el.setDialogue.checked;
  cfg.quoteNewline          = el.setAfterQuote.value;
  cfg.spaceAfterBangQuestion= el.setBangSpace.checked;
  cfg.ellipsisTwoCells      = el.setEllipsis.checked;
  cfg.keepPairTogether      = el.setPair.checked;
  cfg.pushOpenBracket       = el.setPushOpen.checked;
  cfg.wrapLongTitle         = el.setWrapTitle.checked;

  el.rowTitle.style.display = cfg.title.enabled ? '' : 'none';
  el.rowName .style.display = cfg.name.enabled  ? '' : 'none';

  bodyGapHint();
  gyStore.setSettings(cfg);
  renderSoon();
}

function msg(t){ el.setMsg.textContent = t; }

/* ---- せっていコード（ほかの 端末に くばる）---- */
function b64enc(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for(const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64dec(b64){
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ================= できごと ================= */
['input','change'].forEach(ev => {
  el.title.addEventListener(ev, () => { renderSoon(); saveSoon(); });
  el.name .addEventListener(ev, () => { renderSoon(); saveSoon(); });
  el.body .addEventListener(ev, () => { renderSoon(); saveSoon(); });
});

el.btnPrint.addEventListener('click', () => window.print());
el.btnFix.addEventListener('click', () => {
  const on = el.btnFix.getAttribute('aria-pressed') === 'true';
  el.btnFix.setAttribute('aria-pressed', on ? 'false' : 'true');
  document.body.classList.toggle('nofix', on);
});
el.btnSet.addEventListener('click', () => { el.panel.hidden = false; loadSettingsForm(); renderSoon(); });
el.btnCloseSet.addEventListener('click', () => { el.panel.hidden = true; renderSoon(); });

[ el.setChars, el.setCols, el.setTitleOn, el.setTitleAlign, el.setTitleIndent,
  el.setNameOn, el.setNameBottom, el.setNameGap, el.setBodyGap, el.setParaIndent,
  el.setNumbers, el.setDecimal, el.setLatin, el.setHang, el.setHangStyle,
  el.setSmallKana, el.setKuten, el.setDialogue, el.setAfterQuote,
  el.setBangSpace, el.setEllipsis, el.setPair, el.setPushOpen, el.setWrapTitle
].forEach(x => x.addEventListener('change', applySettingsForm));

el.btnCodeOut.addEventListener('click', () => {
  try{
    el.setCode.value = b64enc(JSON.stringify(cfg));
    el.setCode.select();
    msg('このコードを 児童の 端末で 貼りつけて「読みこむ」を おします');
  }catch(e){ msg('コードを 作れませんでした'); }
});
el.btnCodeIn.addEventListener('click', () => {
  try{
    const obj = JSON.parse(b64dec(el.setCode.value));
    if(!obj || !obj.charsPerColumn) throw new Error('形が ちがいます');
    cfg = gyUpgradeSettings(obj);
    gyStore.setSettings(cfg);
    loadSettingsForm();
    el.rowTitle.style.display = cfg.title.enabled ? '' : 'none';
    el.rowName .style.display = cfg.name.enabled  ? '' : 'none';
    renderSoon();
    msg('読みこみました');
  }catch(e){ msg('コードが ちがうようです'); }
});
el.btnReset.addEventListener('click', () => {
  if(!confirm('きまりを はじめの ものに もどしますか。書いた 文章は のこります。')) return;
  cfg = gyStore.resetSettings();
  loadSettingsForm();
  el.rowTitle.style.display = cfg.title.enabled ? '' : 'none';
  el.rowName .style.display = cfg.name.enabled  ? '' : 'none';
  renderSoon();
  msg('もどしました');
});

window.addEventListener('resize', renderSoon);
window.addEventListener('beforeunload', saveDoc);

/* ================= はじまり ================= */
gyStore.onStatus = t => { el.save.textContent = t || '　'; };
gyStore.init(function(){
  cfg = gyStore.getSettings();
  if(!gyStore.isTeacher){ el.btnSet.hidden = true; el.panel.hidden = true; }
  const d = gyStore.getDoc();
  el.title.value = d.title || '';
  el.name .value = d.name  || '';
  el.body .value = d.body  || '';
  el.rowTitle.style.display = cfg.title.enabled ? '' : 'none';
  el.rowName .style.display = cfg.name.enabled  ? '' : 'none';
  loadSettingsForm();
  render();
});

})();
