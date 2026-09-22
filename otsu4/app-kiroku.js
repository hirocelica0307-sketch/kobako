/* おつよん ― きろく（学習の 見える化） */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var C = function(name){ return O4Viz.css(name); };
var COL = { law:C('--law'), phys:C('--phys'), prop:C('--prop') };
var hist = O4Store.history(14);
var md = function(d){ return d.slice(5).replace('-', '/'); };

function drawAll(){

/* ---------- 数字タイル ---------- */
(function tiles(){
  var all = O4Engine.cardStats();
  var weak = O4Engine.weakList().length;
  var seen = OTSU4_QUESTIONS.filter(function(q){ return O4Store.state('q', q.id).seen > 0; }).length;
  var st = O4Store.streak();
  var sum = hist.reduce(function(a, h){ return { c:a.c + h.cards, q:a.q + h.qs, ok:a.ok + h.ok }; }, { c:0, q:0, ok:0 });
  var rate = sum.q ? Math.round(sum.ok / sum.q * 100) : null;

  $('tiles').innerHTML =
    tile('つづけて 学習した日', st + ' 日', st >= 3 ? 'この調子です' : '毎日 少しずつが いちばん強い') +
    tile('14日の 正答率', rate === null ? '—' : rate + ' ％', rate === null ? 'まだ 解いていません' : (rate >= 60 ? '合格ラインの 上' : '合格ラインは 60％')) +
    tile('卒業した カード', all.done + ' / ' + all.total, '箱5まで 上がった枚数') +
    tile('解いた 問題', seen + ' / ' + OTSU4_QUESTIONS.length, 'にがて のこり ' + weak + ' 問');
})();
function tile(lab, val, sub){
  return '<div class="tile"><div class="lab">' + lab + '</div><div class="val">' + val + '</div><div class="sub">' + sub + '</div></div>';
}

/* ---------- 毎日の 学習量 ---------- */
O4Viz.columns($('cVolume'), {
  labels: hist.map(function(h){ return md(h.date); }),
  series: [
    { name:'カード（枚）', color:COL.law,  values:hist.map(function(h){ return h.cards; }) },
    { name:'問題（問）',   color:COL.prop, values:hist.map(function(h){ return h.qs; }) }
  ],
  unit:''
});

/* ---------- 正答率 ---------- */
O4Viz.lines($('cRate'), {
  labels: hist.map(function(h){ return md(h.date); }),
  series: [{ name:'正答率', color:COL.law,
             values: hist.map(function(h){ return h.qs ? Math.round(h.ok / h.qs * 100) : null; }) }],
  max:100, unit:'％', endLabel:true,
  ref:{ v:60, label:'合格ライン 60％' }
});

/* ---------- 科目ごとの おぼえ具合 ---------- */
O4Viz.hbars($('cSubject'), {
  rows: ['law','phys','prop'].map(function(k){
    var s = O4Engine.cardStats(k);
    return { label:OTSU4_SUBJECTS[k].name, value:Math.round(s.rate * 100), color:COL[k],
             note:'卒業 ' + s.done + '/' + s.total + '枚' };
  }),
  max:100, unit:'％'
});

/* ---------- 箱の分布 ---------- */
(function box(){
  var n = [0,0,0,0,0,0];
  OTSU4_CARDS.forEach(function(c){ n[O4Store.state('card', c.id).box | 0]++; });
  O4Viz.stack($('cBox'), {
    segs: n.map(function(v, i){
      return { label:'箱' + i + (i === 0 ? '（未学習）' : i === 5 ? '（卒業）' : ''), value:v,
               color:C('--seq' + (i + 1)), ink: i <= 1 ? '#0b0b0b' : '#fff' };
    }),
    unit:'枚'
  });
})();

/* ---------- 模試の うつりかわり ---------- */
(function exams(){
  var ex = O4Store.exams().slice(0, 10).reverse();
  if (!ex.length){
    $('cExam').innerHTML = '<div class="muted">まだ 模試を 受けていません。「ほんばん」から 35問2時間の 模試が できます。</div>';
    return;
  }
  O4Viz.lines($('cExam'), {
    labels: ex.map(function(e){ return md(e.at); }),
    series: [
      { name:'法令',   color:COL.law,  values:ex.map(function(e){ return Math.round(e.law / 15 * 100); }) },
      { name:'物理化学', color:COL.phys, values:ex.map(function(e){ return Math.round(e.phys / 10 * 100); }) },
      { name:'性質消火', color:COL.prop, values:ex.map(function(e){ return Math.round(e.prop / 10 * 100); }) }
    ],
    max:100, unit:'％', ref:{ v:60, label:'合格ライン 60％' }
  });
})();

/* ---------- にがてテーマ ---------- */
(function weak(){
  var th = O4Engine.weakThemes().slice(0, 8);
  if (!th.length){ $('cWeak').innerHTML = '<div class="muted">いまは にがてが ありません。</div>'; return; }
  O4Viz.hbars($('cWeak'), {
    rows: th.map(function(t){
      return { label:(OTSU4_THEME_MAP[t.theme] || {}).name || t.theme, value:t.n, color:COL[t.subject],
               note:OTSU4_SUBJECTS[t.subject].name };
    }),
    unit:'問'
  });
})();

}
drawAll();

/* 画面の幅が 変わったら 描きなおす（実寸で 描いているため） */
var rt = 0, lastW = window.innerWidth;
window.addEventListener('resize', function(){
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(rt);
  rt = setTimeout(drawAll, 200);
});

/* ---------- 表で見る ---------- */
$('btnTable').onclick = function(){
  var box = $('tables');
  if (box.style.display === 'none'){
    box.style.display = '';
    $('tableOut').innerHTML = buildTables();
    box.scrollIntoView({ behavior:'smooth' });
    $('btnTable').textContent = '表を とじる';
  } else {
    box.style.display = 'none';
    $('btnTable').textContent = '表で見る';
  }
};

function buildTables(){
  var h = '<h3>毎日の 学習量と 正答率</h3><table class="sc"><tr><th>日</th><th class="num">カード</th><th class="num">問題</th><th class="num">正解</th><th class="num">正答率</th></tr>';
  hist.forEach(function(d){
    h += '<tr><td>' + md(d.date) + '</td><td class="num">' + d.cards + '</td><td class="num">' + d.qs + '</td>' +
         '<td class="num">' + d.ok + '</td><td class="num">' + (d.qs ? Math.round(d.ok / d.qs * 100) + '％' : '—') + '</td></tr>';
  });
  h += '</table>';

  h += '<h3>科目ごとの おぼえ具合</h3><table class="sc"><tr><th>科目</th><th class="num">到達度</th><th class="num">卒業</th><th class="num">きょう出る</th></tr>';
  ['law','phys','prop'].forEach(function(k){
    var s = O4Engine.cardStats(k);
    h += '<tr><td>' + OTSU4_SUBJECTS[k].name + '</td><td class="num">' + Math.round(s.rate * 100) + '％</td>' +
         '<td class="num">' + s.done + '/' + s.total + '</td><td class="num">' + s.due + '枚</td></tr>';
  });
  h += '</table>';

  var ex = O4Store.exams();
  if (ex.length){
    h += '<h3>模試</h3><table class="sc"><tr><th>日</th><th>種類</th><th class="num">法令</th><th class="num">物化</th><th class="num">性消</th><th>判定</th></tr>';
    ex.forEach(function(e){
      h += '<tr><td>' + md(e.at) + '</td><td>' + (e.mode === 'official' ? '公式' : 'ランダム') + '</td>' +
           '<td class="num">' + e.law + '/15</td><td class="num">' + e.phys + '/10</td><td class="num">' + e.prop + '/10</td>' +
           '<td>' + (e.pass ? '合格' : '不合格') + '</td></tr>';
    });
    h += '</table>';
  }

  var th = O4Engine.weakThemes();
  if (th.length){
    h += '<h3>にがてテーマ</h3><table class="sc"><tr><th>テーマ</th><th>科目</th><th class="num">問題数</th></tr>';
    th.forEach(function(t){
      h += '<tr><td>' + ((OTSU4_THEME_MAP[t.theme] || {}).name || t.theme) + '</td><td>' +
           OTSU4_SUBJECTS[t.subject].name + '</td><td class="num">' + t.n + '</td></tr>';
    });
    h += '</table>';
  }
  return h;
}
})();
