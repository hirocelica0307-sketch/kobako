/* おつよん ― ホーム */
(function(){
'use strict';

var $ = function(id){ return document.getElementById(id); };
var set = O4Store.settings();

/* ---- きょう やること ---- */
function renderToday(){
  var due   = O4Engine.dueCards({ limit: 999 }).length;
  var weak  = O4Engine.weakList().length;
  var cnt   = O4Store.todayCount();
  var limit = set.cardsPerDay;
  var cards = Math.min(due, limit);

  var h = '';
  h += '<div class="row" style="margin-bottom:10px">';
  h += item('📖 カード', cards + ' 枚', 'oboeru.html', cards ? '' : 'きょうの分は おわり');
  h += item('✏️ 問題', set.qsPerDay + ' 問', 'renshuu.html', '');
  h += item('🔥 にがて', weak + ' 問', 'nigate.html', weak ? '' : 'いまは なし');
  h += '</div>';
  h += '<div class="muted">きょう やった分：カード ' + cnt.cards + ' 枚 ／ 問題 ' + cnt.qs + ' 問</div>';
  h += '<div class="muted">毎日 少しずつ やるほうが、まとめて やるより 記憶に のこります（分散学習）。</div>';
  $('today').innerHTML = h;
}
function item(title, num, href, note){
  return '<a href="' + href + '" style="text-decoration:none;display:block;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">' +
         '<div class="muted">' + title + '</div>' +
         '<div style="font-size:22px;font-weight:800">' + num + '</div>' +
         (note ? '<div class="muted">' + note + '</div>' : '') + '</a>';
}

/* ---- おぼえ具合メーター ---- */
function renderMeters(){
  var h = '';
  ['law','phys','prop'].forEach(function(k){
    var s = O4Engine.cardStats(k);
    var sub = OTSU4_SUBJECTS[k];
    var pct = Math.round(s.rate * 100);
    h += '<div class="mrow"><div class="lab"><span>' + sub.name + '（' + sub.count + '問中 ' + sub.pass + '問で合格）</span>' +
         '<span>' + pct + '％　卒業 ' + s.done + '/' + s.total + '</span></div>' +
         '<div class="meter ' + k + '"><i style="width:' + pct + '%"></i></div>' +
         '<div class="muted">きょう 出るカード：' + s.due + ' 枚</div></div>';
  });
  $('meters').innerHTML = h;
}

/* ---- 模試のきろく ---- */
function renderExams(){
  var ex = O4Store.exams();
  if (!ex.length){ $('exams').innerHTML = '<div class="muted">まだ 受けていません。「ほんばん」から 35問2時間の 模試が できます。</div>'; return; }
  var h = '<table class="sc"><tr><th>日</th><th>種類</th><th>法令</th><th>物化</th><th>性消</th><th>判定</th></tr>';
  ex.slice(0, 8).forEach(function(e){
    h += '<tr><td>' + e.at.slice(5) + '</td><td>' + (e.mode === 'official' ? '公式' : 'ランダム') + '</td>' +
         '<td class="num">' + e.law + '/15</td><td class="num">' + e.phys + '/10</td><td class="num">' + e.prop + '/10</td>' +
         '<td style="color:' + (e.pass ? 'var(--ok)' : 'var(--ng)') + ';font-weight:700">' + (e.pass ? '合格' : '不合格') + '</td></tr>';
  });
  h += '</table>';
  $('exams').innerHTML = h;
}

/* ---- せってい ---- */
function bindSettings(){
  $('setCards').value = set.cardsPerDay;
  $('setQs').value    = set.qsPerDay;
  $('setShuf').checked = !!set.shuffleChoices;
  function upd(){
    set.cardsPerDay = Math.max(5, Math.min(100, parseInt($('setCards').value, 10) || 20));
    set.qsPerDay    = Math.max(3, Math.min(50,  parseInt($('setQs').value, 10) || 10));
    set.shuffleChoices = $('setShuf').checked;
    O4Store.setSettings(set); renderToday();
  }
  $('setCards').onchange = upd; $('setQs').onchange = upd; $('setShuf').onchange = upd;

  $('btnExport').onclick = function(){
    var b = $('ioBox'); b.style.display = 'block'; b.value = O4Store.exportAll(); b.select();
    alert('この文字を ぜんぶ コピーして、安全な ところに 貼りつけて ください。');
  };
  $('btnImport').onclick = function(){
    var b = $('ioBox');
    if (b.style.display === 'none'){ b.style.display = 'block'; b.value = ''; b.focus(); alert('書き出した 文字を ここに 貼りつけて、もう一度「読みこむ」を おしてください。'); return; }
    try{ O4Store.importAll(b.value); alert('読みこみました。'); location.reload(); }
    catch(e){ alert('読みこめませんでした：' + e.message); }
  };
  $('btnReset').onclick = function(){
    if (!confirm('学習データを ぜんぶ 消します。よろしいですか？')) return;
    O4Store.resetAll(); location.reload();
  };
}

$('dayInfo').textContent = O4Store.todayStr();
renderToday(); renderMeters(); renderExams(); bindSettings();
})();
