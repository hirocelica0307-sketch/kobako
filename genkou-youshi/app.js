/* 原稿用紙ツール ― 画面の うごき */

(function(){
'use strict';

const $ = id => document.getElementById(id);
const el = { title:$('inTitle'), name:$('inName'), body:$('inBody'),
             sheets:$('sheets'), count:$('count'), fixes:$('fixes'),
             note:$('note'), save:$('save'), preset:$('preset'),
             rowTitle:$('rowTitle'), rowName:$('rowName'),
             btnPrint:$('btnPrint'), btnFix:$('btnFix'), printSize:$('printSize') };

const STORE = 'genkou-youshi/v1';
let cfg = gyMergeConfig(GY_DEFAULTS, GY_PRESETS[0]);
let presetId = GY_PRESETS[0].id;

/* ---------- 保存（段階1は 端末の中だけ。段階3で スプレッドシートに つなぎます）---------- */
let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  el.save.textContent = 'ほぞん中…';
  saveTimer = setTimeout(() => {
    try{
      localStorage.setItem(STORE, JSON.stringify({
        presetId, title:el.title.value, name:el.name.value, body:el.body.value,
        at: new Date().toISOString()
      }));
      el.save.textContent = 'ほぞんしました';
    }catch(e){
      el.save.textContent = 'ほぞんできません';
    }
  }, 500);
}
function load(){
  try{
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if(!d) return;
    el.title.value = d.title || '';
    el.name.value  = d.name  || '';
    el.body.value  = d.body  || '';
    if(d.presetId) presetId = d.presetId;
  }catch(e){}
}

/* ---------- かだいの えらびかた ---------- */
function buildPresets(){
  el.preset.innerHTML = '';
  for(const p of GY_PRESETS){
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label + '（' + (p.charsPerColumn * p.columnsPerPage) + '字' +
                    (p.pages > 1 ? '×' + p.pages + 'まい' : '') + '）';
    el.preset.appendChild(o);
  }
  el.preset.value = presetId;
}
function applyPreset(){
  const p = GY_PRESETS.find(x => x.id === el.preset.value) || GY_PRESETS[0];
  presetId = p.id;
  cfg = gyMergeConfig(GY_DEFAULTS, p);
  el.rowTitle.style.display = cfg.title.enabled ? '' : 'none';
  el.rowName.style.display  = cfg.name.enabled  ? '' : 'none';
}

/* ---------- 原稿用紙を 画面に 出す ---------- */
/* マスの 大きさを きめる。
   行の わく線（左右 1.5px ずつ）と マスの しきり線（1px）も 数に 入れないと
   A4 から はみ出して しまうので、そのぶんを ひいてから わりつけます。 */
function fitCell(w, h, M, N, bCol, bCell){
  const byW = (w - M * bCol * 2)                    / (M * 1.18 - 0.18 + 1.4);
  const byH = (h - (N - 1) * bCell - bCol * 2)      / (N + 1.4);
  return Math.min(byW, byH);
}

function sizeCells(){
  const N = cfg.charsPerColumn, M = cfg.columnsPerPage;

  /* 画面：右がわの はばと 高さに おさまる 大きさ */
  const box  = el.sheets.getBoundingClientRect();
  const w    = Math.max(240, box.width  - 40);
  const h    = Math.max(240, box.height - 40);
  const cell = Math.max(11, Math.min(fitCell(w, h, M, N, 1.5, 1), 34));

  /* いんさつ：A4（よゆうを みて 182mm × 252mm）に おさまる 大きさ
     1.5px = 0.397mm ／ 1px = 0.265mm（96dpi） */
  const mm = fitCell(182, 252, M, N, 0.397, 0.265);

  /* 画面用と いんさつ用を 1つの スタイルに まとめて 書く
     （html の style= に 直接 書くと いんさつ用が 勝てない ため） */
  el.printSize.textContent =
    ':root{ --cell:' + cell.toFixed(2) + 'px; }\n' +
    '@media print{ :root{ --cell:' + mm.toFixed(3) + 'mm; } }';
}

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

  const headIsPunct = GY_NO_LINE_START.indexOf(chars[0]) >= 0;
  if(headIsPunct){           // 「。」」のような 句読点だけの マス
    d.classList.add('stack');
    for(const ch of chars) d.appendChild(mkSpan(ch));
    return;
  }
  d.classList.add('hang');   // 「た。」のような 詰めた マス
  const main = mkSpan(chars[0]);
  main.classList.add('main');
  d.appendChild(main);
  const tail = document.createElement('div');
  tail.className = 'tail';
  for(let i = 1; i < chars.length; i++) tail.appendChild(mkSpan(chars[i]));
  d.appendChild(tail);
}

function render(){
  const res = gyCompose({ title:el.title.value, name:el.name.value, body:el.body.value }, cfg);
  sizeCells();

  const frag = document.createDocumentFragment();
  res.pages.forEach((pg, pi) => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet' + (pg.over ? ' over' : '');
    for(const col of pg.columns){
      const c = document.createElement('div');
      c.className = 'col';
      for(const cell of col.cells){
        const d = document.createElement('div');
        d.className = 'cell'
          + (cell && Array.from(cell.text).length > 1 ? ' multi' : '')
          + (cell && cell.fix ? ' fix' : '')
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
  });
  el.sheets.innerHTML = '';
  el.sheets.appendChild(frag);

  /* 字数と はみ出し */
  const cap = cfg.charsPerColumn * cfg.columnsPerPage * cfg.pages;
  el.count.textContent = res.chars + '字／' + cap + '字';
  el.count.className = 'count' + (res.over > 0 ? ' over' : '');
  el.note.textContent = res.over > 0
    ? 'あと ' + res.over + '行 ぶん はみ出しています'
    : (cfg.pages > 1 ? cfg.pages + 'まいまで 書けます' : '');

  /* なおした ところの 説明 */
  el.fixes.innerHTML = '';
  const keys = Object.keys(res.fixes);
  if(keys.length){
    for(const k of keys){
      if(!GY_FIX_LABEL[k]) continue;
      const d = document.createElement('div');
      d.className = 'fix-item';
      d.textContent = GY_FIX_LABEL[k] + '（' + res.fixes[k] + 'か所）';
      el.fixes.appendChild(d);
    }
  }
}

/* ---------- できごと ---------- */
let raf = null;
function onInput(){
  if(raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
  save();
}
['input','change'].forEach(ev => {
  el.title.addEventListener(ev, onInput);
  el.name .addEventListener(ev, onInput);
  el.body .addEventListener(ev, onInput);
});
el.preset.addEventListener('change', () => { applyPreset(); render(); save(); });
el.btnPrint.addEventListener('click', () => window.print());
el.btnFix.addEventListener('click', () => {
  const on = el.btnFix.getAttribute('aria-pressed') === 'true';
  el.btnFix.setAttribute('aria-pressed', on ? 'false' : 'true');
  document.body.classList.toggle('nofix', on);
});
window.addEventListener('resize', () => { if(raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });

/* ---------- はじまり ---------- */
load();
buildPresets();
applyPreset();
el.preset.value = presetId;
applyPreset();
render();
el.save.textContent = '　';

})();
