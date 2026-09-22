/* おつよん ― にがてノート
   まちがえた問題＋正解でも自信がなかった問題を あつめ、
   同じテーマの 類似問題も まぜて 出します。 */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var lastMode = 'mix';

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderPick(){
  var weak = O4Engine.weakList();
  var wrong = weak.filter(function(q){ return O4Store.state('q', q.id).wrong > 0; }).length;
  var unsure = weak.length - wrong;

  $('summary').innerHTML =
    '<div class="row" style="margin-bottom:10px">' +
    box('ぜんぶ', weak.length) + box('まちがい', wrong) + box('自信なし', unsure) + '</div>';

  if (!weak.length){
    $('summary').innerHTML += '<div class="muted">いまは にがてが ありません。れんしゅうや ほんばんを 解くと、ここに たまっていきます。</div>';
    $('btnStart').disabled = true; $('btnOnlyWeak').disabled = true;
  }

  var th = O4Engine.weakThemes();
  $('themes').innerHTML = th.length ? th.map(function(t){
    var name = (OTSU4_THEME_MAP[t.theme] || {}).name || t.theme;
    var cards = OTSU4_CARDS.filter(function(c){ return c.theme === t.theme; }).length;
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">' +
      '<span class="tag ' + t.subject + '">' + OTSU4_SUBJECTS[t.subject].name + '</span>' +
      '<span style="flex:1">' + name + '<br><span class="muted">にがて ' + t.n + ' 問</span></span>' +
      '<a class="btn ghost sm" href="oboeru.html">カード' + (cards ? '(' + cards + ')' : '') + '</a>' +
      '<a class="btn sm" href="renshuu.html?theme=' + t.theme + '">問題</a></div>';
  }).join('') : '<div class="muted">まだ ありません。</div>';

  $('list').innerHTML = weak.length ? weak.map(function(q){
    var st = O4Store.state('q', q.id);
    var why = st.wrong > 0 ? 'まちがい ' + st.wrong + '回' : '正解したが 自信なし';
    return '<div style="padding:8px 0;border-bottom:1px solid var(--line)">' +
      '<span class="tag ' + q.subject + '">' + OTSU4_SUBJECTS[q.subject].name + '</span>' +
      '<span class="tag">' + ((OTSU4_THEME_MAP[q.theme] || {}).name || '') + '</span>' +
      (q.src === 'official' ? '<span class="tag">公式</span>' : '') +
      '<span class="muted">' + why + '</span><br>' +
      esc(q.q.split('\n')[0]).slice(0, 70) + '…</div>';
  }).join('') : '<div class="muted">まだ ありません。</div>';
}

function box(t, n){
  return '<div style="border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">' +
         '<div class="muted">' + t + '</div><div style="font-size:22px;font-weight:800">' + n + '</div></div>';
}

function start(mode){
  lastMode = mode;
  var list = (mode === 'weak')
    ? O4Engine.shuffle(O4Engine.weakList()).slice(0, 10)
    : O4Engine.weakDrill(10);
  if (!list.length){ alert('にがては ありません。'); return; }
  $('pick').style.display = 'none';
  $('done').style.display = 'none';
  $('quiz').style.display = '';
  O4Quiz.run({
    questions: list,
    root: $('quiz'),
    label: (mode === 'weak' ? 'にがてのみ' : 'にがて＋類似'),
    onAnswer: O4Quiz.record,
    onDone: finish
  });
}

function finish(log){
  $('quiz').style.display = 'none';
  $('done').style.display = '';
  var ok = log.filter(function(x){ return x.correct; }).length;
  var grad = log.filter(function(x){ return !O4Store.state('q', x.id).flag; }).length;
  var left = O4Engine.weakList().length;
  $('doneMsg').innerHTML =
    '<div class="result ' + (ok / log.length >= 0.6 ? 'pass' : 'fail') + '">' + ok + ' / ' + log.length + '</div>' +
    '<div>このうち <b>' + grad + ' 問</b> が 卒業しました。</div>' +
    '<div class="muted" style="margin-top:6px">のこりの にがて：' + left + ' 問</div>' +
    '<div class="muted" style="margin-top:8px">卒業の条件は「自信あり で 2回続けて 正解」。まぐれ正解では 卒業しません。</div>';
  $('btnMore').onclick = function(){ start(lastMode); };
  renderPick();
}

$('btnStart').onclick    = function(){ start('mix'); };
$('btnOnlyWeak').onclick = function(){ start('weak'); };
renderPick();
})();
