/* おつよん ― ほんばん（35問・2時間の 本番形式） */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); };

var Q = [], mixes = [], answers = [], cur = 0, mode = '', t0 = 0, timerId = 0, useTimer = true;
var LIMIT = 120 * 60 * 1000;

function start(m){
  mode = m;
  Q = (m === 'official') ? O4Engine.examOfficial() : O4Engine.examRandom();
  /* 本番形式は 公式・ランダムとも もとの ならびで 出します。
     （解説が「1は…」のように 番号で 説明しているため、見なおしで ずれないように） */
  mixes = Q.map(function(q){ return { choices:q.choices, a:q.a, order:[0,1,2,3,4] }; });
  answers = Q.map(function(){ return -1; });
  cur = 0;
  useTimer = $('useTimer').checked;
  $('pick').style.display = 'none';
  $('result').style.display = 'none';
  $('exam').style.display = '';
  if (useTimer){ t0 = Date.now(); tick(); timerId = setInterval(tick, 1000); }
  drawNav(); draw();
}

function tick(){
  var left = LIMIT - (Date.now() - t0);
  if (left <= 0){ clearInterval(timerId); $('timer').textContent = '0:00'; alert('2時間が たちました。採点します。'); finish(); return; }
  var h = Math.floor(left / 3600000),
      m = Math.floor(left % 3600000 / 60000),
      s = Math.floor(left % 60000 / 1000);
  $('timer').textContent = '残り ' + (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2);
  $('timer').className = 'timer' + (left < 10 * 60000 ? ' warn' : '');
}

function drawNav(){
  var h = '';
  for (var i = 0; i < Q.length; i++){
    h += '<button data-i="' + i + '" class="' + (answers[i] >= 0 ? 'done' : '') + (i === cur ? ' now' : '') + '">' + (i + 1) + '</button>';
  }
  $('nav').innerHTML = h;
  Array.prototype.forEach.call($('nav').querySelectorAll('button'), function(b){
    b.onclick = function(){ cur = +b.dataset.i; drawNav(); draw(); };
  });
}

function draw(){
  var q = Q[cur], mix = mixes[cur];
  var sub = OTSU4_SUBJECTS[q.subject];
  var h = '<div class="progress">問' + (cur + 1) + ' / ' + Q.length + '　<span class="tag ' + q.subject + '">' + sub.name + '</span></div>';
  h += '<div class="card"><div class="qtext">' + esc(q.q) + '</div><ul class="choices">';
  mix.choices.forEach(function(c, n){
    h += '<li><button class="choice' + (answers[cur] === n ? ' sel' : '') + '" data-n="' + n + '">' +
         '<span class="n">' + (n + 1) + '</span><span>' + esc(c) + '</span></button></li>';
  });
  h += '</ul></div>';
  $('quiz').innerHTML = h;
  Array.prototype.forEach.call($('quiz').querySelectorAll('.choice'), function(b){
    b.onclick = function(){
      answers[cur] = +b.dataset.n;
      drawNav(); draw();
      if (cur < Q.length - 1){ cur++; drawNav(); draw(); }
    };
  });
  window.scrollTo(0, 0);
}

$('btnPrev').onclick = function(){ if (cur > 0){ cur--; drawNav(); draw(); } };
$('btnNext').onclick = function(){ if (cur < Q.length - 1){ cur++; drawNav(); draw(); } };
$('btnFinish').onclick = function(){
  var blank = answers.filter(function(a){ return a < 0; }).length;
  if (blank && !confirm('まだ ' + blank + ' 問 答えていません。採点しますか？')) return;
  finish();
};

function finish(){
  if (timerId) clearInterval(timerId);
  /* 採点：選択肢を まぜている場合は 並べかえ後の 正解位置で くらべる */
  var norm = Q.map(function(q, i){ return { subject:q.subject, a:mixes[i].a }; });
  var r = O4Engine.scoreExam(norm, answers);

  /* 学習記録にも 反映（自信は 本番なので mid あつかい） */
  Q.forEach(function(q, i){
    var correct = (answers[i] === mixes[i].a);
    var st = O4Store.state('q', q.id);
    O4Store.put('q', q.id, O4Srs.gradeQuestion(st, correct, correct ? 'mid' : 'low'));
    O4Store.countUp('q', correct);
    if (!correct) O4Store.reviveCards(O4Engine.relatedCards(q, 3).map(function(c){ return c.id; }));
  });
  O4Store.addExam({ at:O4Store.todayStr(), mode:mode, law:r.law.ok, phys:r.phys.ok, prop:r.prop.ok, pass:r.pass });

  $('exam').style.display = 'none';
  $('result').style.display = '';
  $('timer').textContent = '';
  $('resultBig').className = 'result ' + (r.pass ? 'pass' : 'fail');
  $('resultBig').textContent = (r.pass ? '合格ライン クリア' : '不合格') + '　' + r.total + '/' + r.n;

  var rows = '<tr><th>科目</th><th class="num">正解</th><th class="num">必要</th><th>判定</th></tr>';
  [['law','法令',15,9],['phys','物理・化学',10,6],['prop','性質・消火',10,6]].forEach(function(p){
    var s = r[p[0]];
    rows += '<tr><td>' + p[1] + '</td><td class="num">' + s.ok + '/' + s.n + '</td><td class="num">' + p[3] + '</td>' +
            '<td style="color:' + (s.ok60 ? 'var(--ok)' : 'var(--ng)') + ';font-weight:700">' + (s.ok60 ? '○' : '×') + '</td></tr>';
  });
  $('scTable').innerHTML = rows;

  var weakSub = ['law','phys','prop'].filter(function(k){ return !r[k].ok60; });
  var adv = '';
  if (r.pass){
    adv = '<b>3科目とも6割を こえています。</b>この状態を 本番まで たもつため、にがてノートと カードを 毎日 少しだけ 続けてください。';
  } else {
    adv = '<b>' + weakSub.map(function(k){ return OTSU4_SUBJECTS[k].name; }).join('・') + '</b> が 6割に とどきませんでした。' +
          '合計点ではなく <b>科目ごと</b>に 6割 必要なので、ここを 先に つぶします。';
  }
  /* まちがえたテーマの 集計 */
  var tm = {};
  Q.forEach(function(q, i){ if (answers[i] !== mixes[i].a) tm[q.theme] = (tm[q.theme] || 0) + 1; });
  var list = Object.keys(tm).sort(function(a, b){ return tm[b] - tm[a]; }).slice(0, 5);
  if (list.length){
    adv += '<div style="margin-top:10px"><b>とくに 落としたテーマ</b><br>' +
      list.map(function(k){
        return '<a href="renshuu.html?theme=' + k + '">' + (OTSU4_THEME_MAP[k] || {}).name + '（' + tm[k] + '問）</a>';
      }).join('　／　') + '</div>';
  }
  $('advice').innerHTML = adv;

  $('btnReview').onclick = function(){ review(); };
  window.scrollTo(0, 0);
}

function stepsHtml(q){
  var h = q.steps.map(function(st){
    return '<div class="step"><b>' + esc(st.t) + '</b><span>' + esc(st.d) + '</span></div>';
  }).join('');
  if (q.trick) h += '<div class="trick"><b>いちばん ラクな 解き方</b>' + esc(q.trick) + '</div>';
  return h;
}

function review(){
  var h = '';
  Q.forEach(function(q, i){
    if (answers[i] === mixes[i].a) return;
    h += '<div class="card"><div class="progress">問' + (i + 1) + '　<span class="tag ' + q.subject + '">' +
         OTSU4_SUBJECTS[q.subject].name + '</span><span class="tag">' + (OTSU4_THEME_MAP[q.theme] || {}).name + '</span></div>';
    h += '<div class="qtext">' + esc(q.q) + '</div>';
    h += '<div class="judge ng">あなたの答え：' + (answers[i] < 0 ? '未回答' : (answers[i] + 1) + '番') +
         '　／　正解：' + (mixes[i].a + 1) + '番</div>';
    h += '<div class="explain"><p><b>正解の選択肢</b>' + esc(mixes[i].choices[mixes[i].a]) + '</p>' +
         '<p><b>なぜ そうなる？</b>' + esc(q.why) + '</p>' +
         (q.others ? '<p><b>ほかの選択肢・ポイント</b>' + esc(q.others) + '</p>' : '') + '</div>';
    if (q.steps && q.steps.length){
      h += '<div class="steps" style="margin-top:10px">' +
        stepsHtml(q) + '</div>';
    }
    h += '<div class="row" style="margin-top:10px">' +
         '<a class="btn ghost sm" href="renshuu.html?theme=' + q.theme + '">類似問題を 解く</a>' +
         '<a class="btn ghost sm" href="oboeru.html?theme=' + q.theme + '">カードで おぼえ直す</a></div>';
    h += '</div>';
  });
  $('review').innerHTML = h || '<div class="card center">まちがいは ありませんでした。</div>';
  $('review').scrollIntoView();
}

$('btnOfficial').onclick = function(){ start('official'); };
$('btnRandom').onclick   = function(){ start('random'); };
$('back').onclick = function(e){
  if ($('exam').style.display === '' && !confirm('試験を やめて もどりますか？（記録は のこりません）')) e.preventDefault();
};
})();
