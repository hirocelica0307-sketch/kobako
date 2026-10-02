'use strict';
/* =========================================================
   がめん（カテゴリ → 学年 → デザイン → いんさつ）
   ========================================================= */
const $ = id => document.getElementById(id);
const GRADE_NAME = { low: '低学年', mid: '中学年', high: '高学年' };
const CAT_GROUPS = [
  ['めあて・ふりかえり', ['jiko', 'g1', 'g2', 'g3', 'matome', 'shoujou']],
  ['ぎょうじ', ['undo', 'ongaku', 'ensoku', 'natsu']],
  ['がくしゅう・きろく', ['dokusho', 'ganbari', 'nawa']],
  ['メッセージ・おいわい', ['arigato', 'tanjoubi', 'seicho', 'sotsugyo']],
  ['かかり', ['kakari', 'ichiran']],
];
const CAT_ORDER = CAT_GROUPS.flatMap(g => g[1]);

function saveOpts() {
  try { localStorage.setItem('mokuhyou-card', JSON.stringify({ nen: S.nen, kumi: S.kumi, term: S.term, ruby: S.ruby, wobble: S.wobble, cat: S.cat, cur: S.cur, grade: S.grade, kk: S.kk, ichiran: S.ichiran })); } catch (e) { /* なくても うごく */ }
}
function loadOpts() {
  try {
    const o = JSON.parse(localStorage.getItem('mokuhyou-card') || '{}');
    const kk = o.kk || {}, ic = o.ichiran || {};
    delete o.kk; delete o.ichiran;
    if (typeof o.ruby === 'boolean') o.ruby = o.ruby ? 'auto' : 'off';
    Object.assign(S, o);
    Object.assign(S.kk, kk, { items: { ...S.kk.items, ...(kk.items || {}) } });
    Object.assign(S.ichiran, ic);
  } catch (e) { /* なくても うごく */ }
  const h = location.hash.slice(1);
  if (h && designById(h)) { S.cur = h; S.cat = designById(h).cat; }
  else if (h && CATS[h]) S.cat = h;
  if (!CATS[S.cat]) S.cat = 'g1';
  const cur = designById(S.cur);
  if (!cur || cur.cat !== S.cat) S.cur = DESIGNS.find(d => d.cat === S.cat).id;
}

const visible = () => DESIGNS.filter(d => d.cat === S.cat && (S.grade === 'all' || d.grade === S.grade));

function renderCats() {
  $('cats').innerHTML = CAT_GROUPS.map(([gname, keys]) => `<h3 class="cgroup">${esc(gname)}</h3>` + keys.map(k => {
    const c = CATS[k], cnt = DESIGNS.filter(d => d.cat === k).length;
    return `<button type="button" class="cat${k === S.cat ? ' on' : ''}" data-cat="${k}"><b>${esc(c.name)}</b><small>${esc(c.when)}・${cnt}しゅるい</small></button>`;
  }).join('')).join('');
}
function renderStrip() {
  const hasMid = DESIGNS.some(d => d.cat === S.cat && d.grade === 'mid');
  $('gMid').hidden = !hasMid;
  if (!hasMid && S.grade === 'mid') S.grade = 'all';
  const list = visible();
  $('strip').innerHTML = list.map(ds =>
    `<button type="button" class="item${ds.id === S.cur ? ' on' : ''}" data-id="${ds.id}">
      <div class="thumb">${renderDesign(ds)}</div>
      <span class="gr gr-${ds.grade}">${GRADE_NAME[ds.grade]}</span><b>${esc(ds.name)}</b>
    </button>`).join('') || '<p class="empty">この 学年むけの デザインは ありません</p>';
  document.querySelectorAll('.gbtn').forEach(b => b.classList.toggle('on', b.dataset.grade === S.grade));
}
function renderMain() {
  const ds = designById(S.cur);
  const c = CATS[ds.cat];
  $('pTitle').textContent = `${c.name} ― ${ds.name}`;
  $('pWhen').textContent = `${c.when}・${GRADE_NAME[ds.grade]}むけ`;
  $('termWrap').hidden = ds.cat !== 'shoujou';
  $('kakariOpts').hidden = ds.cat !== 'kakari';
  $('ichiranOpts').hidden = ds.cat !== 'ichiran';
  $('kTobanWrap').hidden = !S.kk.items.toban;
  $('btnCat').textContent = `🖨️ 「${c.name}」${DESIGNS.filter(d => d.cat === ds.cat).length}しゅるいを 1まいずつ`;
  $('view').innerHTML = renderDesign(ds);
}
function renderAll() { renderCats(); renderStrip(); renderMain(); }

function doPrint(list) {
  $('print').innerHTML = list.map(ds => `<div class="sheet">${renderDesign(ds)}</div>`).join('');
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 60));
}
window.addEventListener('afterprint', () => { $('print').innerHTML = ''; });

function init() {
  loadOpts();
  $('optNen').value = S.nen; $('optKumi').value = S.kumi; $('optTerm').value = S.term;
  $('optRuby').value = S.ruby; $('optWobble').checked = S.wobble;
  $('kToban').innerHTML = K_TOBAN.map(o => `<option value="${o.k}">${esc(o.lab)}</option>`).join('');
  $('kItems').insertAdjacentHTML('beforeend', K_ITEMS.map(it =>
    `<label class="check"><input type="checkbox" data-item="${it.k}"> ${esc(it.ui)}</label>`).join(''));
  const syncK = () => {
    $('kMem').value = String(S.kk.mem); $('kToban').value = S.kk.toban; $('kName').value = S.kk.name;
    document.querySelectorAll('[data-item]').forEach(cb => { cb.checked = !!S.kk.items[cb.dataset.item]; });
    $('iRows').value = String(S.ichiran.rows); $('iCols').value = String(S.ichiran.cols);
  };
  syncK();
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    S.kk.items = { ...K_PRESETS[b.dataset.preset] };
    syncK(); saveOpts(); renderStrip(); renderMain();
  }));

  $('cats').addEventListener('click', e => {
    const b = e.target.closest('.cat');
    if (!b) return;
    S.cat = b.dataset.cat;
    const v = visible();
    S.cur = (v[0] || DESIGNS.find(d => d.cat === S.cat)).id;
    history.replaceState(null, '', '#' + S.cur);
    saveOpts(); renderAll();
  });
  document.querySelectorAll('.gbtn').forEach(b => b.addEventListener('click', () => {
    S.grade = b.dataset.grade;
    const v = visible();
    if (v.length && !v.some(d => d.id === S.cur)) S.cur = v[0].id;
    saveOpts(); renderStrip(); renderMain();
  }));
  $('strip').addEventListener('click', e => {
    const b = e.target.closest('.item');
    if (!b) return;
    S.cur = b.dataset.id;
    history.replaceState(null, '', '#' + S.cur);
    document.querySelectorAll('.item').forEach(x => x.classList.toggle('on', x === b));
    renderMain(); saveOpts();
    if (window.innerWidth <= 760) $('view').scrollIntoView({ behavior: 'smooth' });
  });
  const onOpt = () => {
    S.nen = $('optNen').value; S.kumi = $('optKumi').value.trim(); S.term = $('optTerm').value;
    S.ruby = $('optRuby').value; S.wobble = $('optWobble').checked;
    S.kk.mem = +$('kMem').value; S.kk.toban = $('kToban').value; S.kk.name = $('kName').value.trim();
    document.querySelectorAll('[data-item]').forEach(cb => { S.kk.items[cb.dataset.item] = cb.checked ? 1 : 0; });
    S.ichiran.rows = +$('iRows').value; S.ichiran.cols = +$('iCols').value;
    saveOpts(); renderStrip(); renderMain();
  };
  $('opts').addEventListener('change', onOpt);
  $('optKumi').addEventListener('input', onOpt);
  $('kName').addEventListener('input', onOpt);
  $('btnPrint').addEventListener('click', () => {
    const k = +$('copies').value || 1, ds = designById(S.cur);
    doPrint(Array.from({ length: k }, () => ds));
  });
  $('btnCat').addEventListener('click', () => doPrint(DESIGNS.filter(d => d.cat === S.cat)));

  renderAll();
  if (document.fonts && document.fonts.load) {
    const fams = ['700 10px "Zen Maru Gothic"', '10px "Mochiy Pop One"', '600 10px "Klee One"'];
    Promise.all(fams.map(f => document.fonts.load(f, 'あ亜A').catch(() => null)))
      .then(() => document.fonts.ready)
      .then(() => { MC.clear(); renderAll(); });
  }
}
init();
