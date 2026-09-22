/* おつよん ― おぼえる（知識カード）
   想起練習（思い出してから めくる）＋ 間隔反復（覚えたカードは 先の日に のびる） */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };

var queue = [], idx = 0, curTheme = '';

function stars(n){ return '★★★★★'.slice(0, n || 0) + '☆☆☆☆☆'.slice(0, 5 - (n || 0)); }

/* ---------- えらぶ画面 ---------- */
function renderPick(){
  $('dueAll').textContent = O4Engine.dueCards({ limit:999 }).length;

  var h = '<div class="row" style="margin-top:8px">';
  ['law','phys','prop'].forEach(function(k){
    var n = O4Engine.dueCards({ subject:k, limit:999 }).length;
    h += '<button class="btn ghost sm" data-sub="' + k + '">' + OTSU4_SUBJECTS[k].name + '<br><b>' + n + '</b>枚</button>';
  });
  h += '</div>';
  $('subjects').innerHTML = h;
  Array.prototype.forEach.call($('subjects').querySelectorAll('button'), function(b){
    b.onclick = function(){ start({ subject: b.dataset.sub }); };
  });

  var t = '';
  OTSU4_THEMES.forEach(function(th){
    var all = OTSU4_CARDS.filter(function(c){ return c.theme === th.key; });
    if (!all.length) return;
    var due = O4Engine.dueCards({ theme: th.key, limit:999 }).length;
    var doneN = all.filter(function(c){ return O4Store.state('card', c.id).box >= O4Srs.MAXBOX; }).length;
    t += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">' +
         '<span class="tag ' + th.subject + '">' + OTSU4_SUBJECTS[th.subject].name + '</span>' +
         '<span style="flex:1">' + th.name + '<br><span class="star">' + stars(th.star) + '</span> ' +
         '<span class="muted">卒業 ' + doneN + '/' + all.length + '</span></span>' +
         (due ? '<button class="btn sm" data-th="' + th.key + '">' + due + '枚</button>'
              : '<span class="muted">きょうは なし</span>') +
         '</div>';
  });
  $('themes').innerHTML = t;
  Array.prototype.forEach.call($('themes').querySelectorAll('button'), function(b){
    b.onclick = function(){ start({ theme: b.dataset.th }); };
  });
}

/* ---------- 学習 ---------- */
function start(opts){
  opts = opts || {};
  curTheme = opts.theme || '';
  queue = O4Engine.dueCards(opts);
  if (!queue.length){ alert('きょう 出すカードは ありません。よく できています！'); return; }
  idx = 0;
  $('pick').style.display = 'none';
  $('done').style.display = 'none';
  $('study').style.display = '';
  show();
}

function show(){
  var c = queue[idx];
  var th = OTSU4_THEME_MAP[c.theme] || { name:'', star:0 };
  $('prog').textContent = (idx + 1) + ' / ' + queue.length + ' 枚';
  $('count').textContent = (idx + 1) + '/' + queue.length;
  $('tags').innerHTML = '<span class="tag ' + c.subject + '">' + OTSU4_SUBJECTS[c.subject].name + '</span>' +
                        '<span class="tag">' + th.name + '</span>' +
                        '<span class="star">' + stars(c.star) + '</span>';
  $('front').textContent = c.front;
  $('back').textContent  = c.back;
  $('hint').textContent  = c.hint ? '💡 ' + c.hint : '';
  $('note').textContent  = c.note ? '⚠️ ' + c.note : '';
  $('why').style.display = 'none';
  $('why').innerHTML = c.why ? '<b>なぜ そうなるの？</b>' + esc(c.why) : '';
  $('themeNote').innerHTML = '';
  $('backArea').style.display = 'none';
  $('beforeFlip').style.display = '';
  $('afterFlip').style.display = 'none';
  window.scrollTo(0, 0);
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

$('btnFlip').onclick = function(){
  var cc = queue[idx];
  $('backArea').style.display = '';
  if (cc.why) $('why').style.display = '';
  var nb = O4Note.block(cc.theme);
  if (nb){ $('themeNote').innerHTML = ''; $('themeNote').appendChild(nb); }
  $('beforeFlip').style.display = 'none';
  $('afterFlip').style.display = '';
  var c = queue[idx], st = O4Store.state('card', c.id);
  var d = function(n){ return n === 0 ? 'きょう また' : n + '日後'; };
  var info = ['わからない→きょう また',
              'あやしい→' + d(O4Srs.nextDays(Math.max(0, st.box - 1))),
              'まあまあ→' + d(O4Srs.nextDays(Math.min(5, st.box + 1))),
              'ばっちり→' + d(O4Srs.nextDays(Math.min(5, st.box + 2)))];
  $('nextInfo').textContent = 'つぎに 出る日：' + info.join(' ／ ');
};

Array.prototype.forEach.call(document.querySelectorAll('#afterFlip [data-g]'), function(b){
  b.onclick = function(){
    var c = queue[idx], st = O4Store.state('card', c.id);
    O4Store.put('card', c.id, O4Srs.gradeCard(st, b.dataset.g));
    O4Store.countUp('card');
    idx++;
    if (idx >= queue.length) finish(); else show();
  };
});

function finish(){
  $('study').style.display = 'none';
  $('done').style.display = '';
  $('count').textContent = '';
  var again = queue.filter(function(c){ return O4Store.state('card', c.id).flag; }).length;
  $('doneMsg').innerHTML = queue.length + ' 枚 やりました。<br>' +
    (again ? 'そのうち <b>' + again + ' 枚</b> は あやしいので、また 近いうちに 出てきます。'
           : 'ぜんぶ しっかり 思い出せました。') +
    '<div class="muted" style="margin-top:8px">覚えたつもりを なくすには、このあと 問題を 解いて たしかめるのが いちばん 確実です。</div>';
  $('btnTest').href = curTheme ? ('renshuu.html?theme=' + curTheme) : 'renshuu.html';
}

$('btnAll').onclick = function(){ start({}); };

renderPick();

/* 問題ページから「おぼえ直す」で 来たときは、その テーマを すぐ 始める */
(function(){
  var m = /[?&]theme=([^&]+)/.exec(location.search);
  if (!m) return;
  var t = decodeURIComponent(m[1]);
  if (!OTSU4_THEME_MAP[t]) return;
  var list = O4Engine.dueCards({ theme:t, limit:999 });
  start(list.length ? { theme:t } : { theme:t, includeDone:true, limit:10 });
})();
})();
