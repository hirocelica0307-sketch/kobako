/* おつよん ― れんしゅう（ドリル） */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var set = O4Store.settings();
var lastOpts = null;

function stars(n){ return '★★★★★'.slice(0, n || 0) + '☆☆☆☆☆'.slice(0, 5 - (n || 0)); }
function qs(name){
  var m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}

function renderPick(){
  $('nToday').textContent = set.qsPerDay;

  var h = '';
  ['law','phys','prop'].forEach(function(k){
    var n = OTSU4_QUESTIONS.filter(function(q){ return q.subject === k; }).length;
    h += '<button class="btn ghost sm" data-sub="' + k + '">' + OTSU4_SUBJECTS[k].name + '<br><span class="muted">' + n + '問</span></button>';
  });
  $('subjects').innerHTML = h;
  Array.prototype.forEach.call($('subjects').querySelectorAll('button'), function(b){
    b.onclick = function(){ start({ subject:b.dataset.sub, limit:set.qsPerDay }); };
  });

  var t = '';
  OTSU4_THEMES.forEach(function(th){
    var all = OTSU4_QUESTIONS.filter(function(q){ return q.theme === th.key; });
    if (!all.length) return;
    var seen = all.filter(function(q){ return O4Store.state('q', q.id).seen > 0; }).length;
    var flag = all.filter(function(q){ return O4Store.state('q', q.id).flag; }).length;
    t += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">' +
         '<span class="tag ' + th.subject + '">' + OTSU4_SUBJECTS[th.subject].name + '</span>' +
         '<span style="flex:1">' + th.name + '<br><span class="star">' + stars(th.star) + '</span> ' +
         '<span class="muted">済 ' + seen + '/' + all.length + (flag ? '　にがて ' + flag : '') + '</span></span>' +
         '<button class="btn sm" data-th="' + th.key + '">解く</button></div>';
  });
  $('themes').innerHTML = t;
  Array.prototype.forEach.call($('themes').querySelectorAll('button'), function(b){
    b.onclick = function(){ start({ theme:b.dataset.th, limit:10 }); };
  });
}

function start(opts){
  lastOpts = opts;
  var list = O4Engine.pickQuestions(opts);
  if (!list.length){ alert('出せる問題が ありません。'); return; }
  $('pick').style.display = 'none';
  $('done').style.display = 'none';
  $('quiz').style.display = '';
  O4Quiz.run({
    questions: list,
    root: $('quiz'),
    label: opts.theme ? (OTSU4_THEME_MAP[opts.theme] || {}).name : '',
    onAnswer: O4Quiz.record,
    onDone: finish
  });
}

function finish(log){
  $('quiz').style.display = 'none';
  $('done').style.display = '';
  var ok = log.filter(function(x){ return x.correct; }).length;
  var unsure = log.filter(function(x){ return x.correct && x.conf !== 'high'; }).length;
  var ng = log.length - ok;
  var h = '<div class="result ' + (ok / log.length >= 0.6 ? 'pass' : 'fail') + '">' + ok + ' / ' + log.length + '</div>';
  h += '<div class="muted">まちがい ' + ng + ' 問　／　正解したが 自信なし ' + unsure + ' 問</div>';
  if (ng + unsure > 0){
    h += '<div style="margin-top:10px">この <b>' + (ng + unsure) + ' 問</b> は にがてノートに 入りました。' +
         '同じテーマの <b>類似問題</b> を 出して つぶしていきます。</div>';
  } else {
    h += '<div style="margin-top:10px">ぜんぶ 自信をもって 正解。この調子です。</div>';
  }
  $('doneMsg').innerHTML = h;
  $('btnMore').onclick = function(){ start(lastOpts || { limit:set.qsPerDay }); };
}

renderPick();
var t = qs('theme');
if (t && OTSU4_THEME_MAP[t]) start({ theme:t, limit:10 });
$('btnToday').onclick = function(){ start({ limit:set.qsPerDay }); };
})();
