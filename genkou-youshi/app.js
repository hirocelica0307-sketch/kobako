/* 原稿用紙ツール ― 画面の うごき */

(function(){
'use strict';

const $ = id => document.getElementById(id);
const el = {
  title:$('inTitle'), name:$('inName'), body:$('inBody'),
  sheets:$('sheets'), count:$('count'), fixes:$('fixes'),
  note:$('note'), save:$('save'), preset:$('preset'),
  rowTitle:$('rowTitle'), rowName:$('rowName'),
  btnPrint:$('btnPrint'), btnFix:$('btnFix'), btnSet:$('btnSet'),
  printSize:$('printSize'),

  panel:$('settings'), btnCloseSet:$('btnCloseSet'),
  setPreset:$('setPreset'),
  btnNewPreset:$('btnNewPreset'), btnRenamePreset:$('btnRenamePreset'), btnDelPreset:$('btnDelPreset'),
  setChars:$('setChars'), setCols:$('setCols'), setPages:$('setPages'),
  setTitleOn:$('setTitleOn'), setTitleAlign:$('setTitleAlign'), setTitleIndent:$('setTitleIndent'),
  setNameOn:$('setNameOn'), setNameBottom:$('setNameBottom'), setNameGap:$('setNameGap'),
  setBodyStart:$('setBodyStart'), setParaIndent:$('setParaIndent'),
  setNumbers:$('setNumbers'), setHang:$('setHang'), setKuten:$('setKuten'),
  setDialogue:$('setDialogue'), setSmallKana:$('setSmallKana'),
  setBangSpace:$('setBangSpace'), setEllipsis:$('setEllipsis'), setPushOpen:$('setPushOpen'),
  setCode:$('setCode'), btnCodeOut:$('btnCodeOut'), btnCodeIn:$('btnCodeIn'),
  btnReset:$('btnReset'), setMsg:$('setMsg')
};

let kadai   = [];      // かだいの 一覧（1つ1つが きまり まるごと）
let current = null;    // いま えらんでいる かだい
let raf     = null;
let chars   = 0;       // いまの 字数（先生の シートにも のせる）

/* ================= かだい ================= */
function kadaiById(id){ return kadai.find(k => k.id === id) || kadai[0]; }

function fillSelect(sel, keep){
  sel.innerHTML = '';
  for(const k of kadai){
    const o = document.createElement('option');
    o.value = k.id;
    o.textContent = k.label + '（' + (k.charsPerColumn * k.columnsPerPage) + '字' +
                    (k.pages > 1 ? '×' + k.pages + 'まい' : '') + '）';
    sel.appendChild(o);
  }
  if(keep) sel.value = keep;
}
function refreshSelects(){
  fillSelect(el.preset, current.id);
  fillSelect(el.setPreset, current.id);
}

function selectKadai(id, keepText){
  if(!keepText && current) saveDoc();
  current = kadaiById(id);
  el.rowTitle.style.display = current.title.enabled ? '' : 'none';
  el.rowName .style.display = current.name.enabled  ? '' : 'none';
  const d = gyStore.getDoc(current.id);
  el.title.value = d.title || '';
  el.name .value = d.name  || (gyStore.user ? '' : '');
  el.body .value = d.body  || '';
  try{ localStorage.setItem('genkou-youshi/last', current.id); }catch(e){}
  refreshSelects();
  loadSettingsForm();
  render();
}

/* ================= ほぞん ================= */
let saveTimer = null;
function saveDoc(){
  if(!current) return;
  gyStore.setDoc(current.id, {
    title:el.title.value, name:el.name.value, body:el.body.value, chars:chars
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
  const N = current.charsPerColumn, M = current.columnsPerPage;
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
   ・ふつうの マス            … 1字を まんなかに
   ・詰めた マス（「た。」）   … もとの 字は そのままの 大きさ、句読点だけ 小さく 右下に
   ・句読点だけの マス（「。」」）… 2つとも 小さく たてに ならべる   */
function fillCell(d, text){
  const chars = Array.from(text);
  const mkSpan = ch => {
    const s = document.createElement('span');
    s.textContent = ch;
    const k = gyCharClass(ch);
    if(k) s.className = k;
    return s;
  };
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
  for(let i = 1; i < chars.length; i++) tail.appendChild(mkSpan(chars[i]));
  d.appendChild(tail);
}

function render(){
  const res = gyCompose({ title:el.title.value, name:el.name.value, body:el.body.value }, current);
  sizeCells();

  const frag = document.createDocumentFragment();
  for(const pg of res.pages){
    const sheet = document.createElement('div');
    sheet.className = 'sheet' + (pg.over ? ' over' : '');
    for(const col of pg.columns){
      const c = document.createElement('div');
      c.className = 'col';
      for(const cell of col.cells){
        const d = document.createElement('div');
        d.className = 'cell'
          + (cell && cell.fix  ? ' fix'  : '')
          + (cell && cell.note ? ' note' : '');
        if(cell){
          fillCell(d, cell.text);
          const why = [];
          if(cell.note) why.push(cell.note);
          if(cell.fix && GY_FIX_LABEL[cell.fix]) why.push(GY_FIX_LABEL[cell.fix]);
          if(why.length) d.title = why.join(' / ');
        }
        c.appendChild(d);
      }
      sheet.appendChild(c);
    }
    frag.appendChild(sheet);
  }
  el.sheets.innerHTML = '';
  el.sheets.appendChild(frag);

  chars = res.chars;
  const cap = current.charsPerColumn * current.columnsPerPage * current.pages;
  el.count.textContent = res.chars + '字／' + cap + '字';
  el.count.className = 'count' + (res.over > 0 ? ' over' : '');
  el.note.textContent = res.over > 0
    ? 'あと ' + res.over + '行 ぶん はみ出しています'
    : (current.pages > 1 ? current.pages + 'まいまで 書けます' : '');

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
function loadSettingsForm(){
  const c = current;
  el.setChars.value       = c.charsPerColumn;
  el.setCols.value        = c.columnsPerPage;
  el.setPages.value       = c.pages;
  el.setTitleOn.checked   = !!c.title.enabled;
  el.setTitleAlign.value  = c.title.align;
  el.setTitleIndent.value = c.title.indent;
  el.setNameOn.checked    = !!c.name.enabled;
  el.setNameBottom.value  = c.name.bottomGap;
  el.setNameGap.value     = c.name.gapBetween;
  el.setBodyStart.value   = c.bodyStartColumn;
  el.setParaIndent.value  = c.paragraphIndent;
  el.setNumbers.value     = c.numbers;
  el.setHang.checked      = !!c.hangPunctuation;
  el.setKuten.checked     = !!c.combineKutenBracket;
  el.setDialogue.checked  = !!c.dialogueNewline;
  el.setSmallKana.checked = !!c.smallKanaAtLineStart;
  el.setBangSpace.checked = !!c.spaceAfterBangQuestion;
  el.setEllipsis.checked  = !!c.ellipsisTwoCells;
  el.setPushOpen.checked  = !!c.pushOpenBracket;
}

function num(input, min, max, now){
  const v = parseInt(input.value, 10);
  if(!isFinite(v)) return now;
  return Math.min(max, Math.max(min, v));
}

function applySettingsForm(){
  const c = current;
  c.charsPerColumn = num(el.setChars, 4, 40, c.charsPerColumn);
  c.columnsPerPage = num(el.setCols,  2, 40, c.columnsPerPage);
  c.pages          = num(el.setPages, 1, 10, c.pages);
  c.title.enabled  = el.setTitleOn.checked;
  c.title.align    = el.setTitleAlign.value;
  c.title.indent   = num(el.setTitleIndent, 0, c.charsPerColumn, c.title.indent);
  c.name.enabled   = el.setNameOn.checked;
  c.name.bottomGap = num(el.setNameBottom, 0, c.charsPerColumn, c.name.bottomGap);
  c.name.gapBetween= num(el.setNameGap, 0, 5, c.name.gapBetween);
  c.paragraphIndent= num(el.setParaIndent, 0, 3, c.paragraphIndent);

  /* 本文の はじまりは 題名・名前を 使うぶんより 前には できない */
  const least = (c.title.enabled ? 1 : 0) + (c.name.enabled ? 1 : 0) + 1;
  c.bodyStartColumn = Math.max(least, num(el.setBodyStart, 1, 10, c.bodyStartColumn));
  el.setBodyStart.value = c.bodyStartColumn;

  c.numbers               = el.setNumbers.value;
  c.hangPunctuation       = el.setHang.checked;
  c.combineKutenBracket   = el.setKuten.checked;
  c.dialogueNewline       = el.setDialogue.checked;
  c.smallKanaAtLineStart  = el.setSmallKana.checked;
  c.spaceAfterBangQuestion= el.setBangSpace.checked;
  c.ellipsisTwoCells      = el.setEllipsis.checked;
  c.pushOpenBracket       = el.setPushOpen.checked;

  el.rowTitle.style.display = c.title.enabled ? '' : 'none';
  el.rowName .style.display = c.name.enabled  ? '' : 'none';

  gyStore.setKadai(kadai);
  refreshSelects();
  renderSoon();
}

function newId(){ return 'k' + Date.now().toString(36); }

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
el.preset.addEventListener('change', () => selectKadai(el.preset.value));
el.setPreset.addEventListener('change', () => selectKadai(el.setPreset.value));

el.btnPrint.addEventListener('click', () => window.print());
el.btnFix.addEventListener('click', () => {
  const on = el.btnFix.getAttribute('aria-pressed') === 'true';
  el.btnFix.setAttribute('aria-pressed', on ? 'false' : 'true');
  document.body.classList.toggle('nofix', on);
});
el.btnSet.addEventListener('click', () => { el.panel.hidden = false; loadSettingsForm(); renderSoon(); });
el.btnCloseSet.addEventListener('click', () => { el.panel.hidden = true; renderSoon(); });

[ el.setChars, el.setCols, el.setPages, el.setTitleOn, el.setTitleAlign, el.setTitleIndent,
  el.setNameOn, el.setNameBottom, el.setNameGap, el.setBodyStart, el.setParaIndent,
  el.setNumbers, el.setHang, el.setKuten, el.setDialogue, el.setSmallKana,
  el.setBangSpace, el.setEllipsis, el.setPushOpen
].forEach(x => x.addEventListener('change', applySettingsForm));

el.btnNewPreset.addEventListener('click', () => {
  const label = prompt('あたらしい かだいの なまえ', 'あたらしい かだい');
  if(!label) return;
  const k = JSON.parse(JSON.stringify(current));
  k.id = newId(); k.label = label;
  kadai.push(k);
  gyStore.setKadai(kadai);
  selectKadai(k.id);
  msg('「' + label + '」を つくりました');
});
el.btnRenamePreset.addEventListener('click', () => {
  const label = prompt('かだいの なまえ', current.label);
  if(!label) return;
  current.label = label;
  gyStore.setKadai(kadai);
  refreshSelects();
  msg('なまえを かえました');
});
el.btnDelPreset.addEventListener('click', () => {
  if(kadai.length <= 1){ msg('かだいが 1つだけの ときは けせません'); return; }
  if(!confirm('「' + current.label + '」を けしますか。書いた 文章は のこります。')) return;
  kadai = kadai.filter(k => k.id !== current.id);
  gyStore.setKadai(kadai);
  selectKadai(kadai[0].id);
  msg('けしました');
});

el.btnCodeOut.addEventListener('click', () => {
  try{
    el.setCode.value = b64enc(JSON.stringify(kadai));
    el.setCode.select();
    msg('このコードを 児童の 端末で 貼りつけて「読みこむ」を おします');
  }catch(e){ msg('コードを 作れませんでした'); }
});
el.btnCodeIn.addEventListener('click', () => {
  try{
    const list = JSON.parse(b64dec(el.setCode.value));
    if(!Array.isArray(list) || !list.length || !list[0].charsPerColumn) throw new Error('形が ちがいます');
    kadai = list;
    gyStore.setKadai(kadai);
    selectKadai(kadai[0].id);
    msg('読みこみました（かだい ' + kadai.length + 'つ）');
  }catch(e){ msg('コードが ちがうようです'); }
});
el.btnReset.addEventListener('click', () => {
  if(!confirm('かだいと きまりを はじめの ものに もどしますか。')) return;
  kadai = gyStore.resetKadai();
  selectKadai(kadai[0].id);
  msg('もどしました');
});

window.addEventListener('resize', renderSoon);
window.addEventListener('beforeunload', saveDoc);

/* ================= はじまり ================= */
gyStore.onStatus = t => { el.save.textContent = t || '　'; };
gyStore.init(function(){
  kadai = gyStore.getKadai();
  /* Apps Script 版では、かだいを かえられるのは 先生だけ */
  if(!gyStore.isTeacher){ el.btnSet.hidden = true; el.panel.hidden = true; }
  let last = null;
  try{ last = localStorage.getItem('genkou-youshi/last'); }catch(e){}
  selectKadai((last && kadai.some(k => k.id === last)) ? last : kadai[0].id, true);
});

})();
