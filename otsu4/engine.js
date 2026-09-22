/* おつよん ― 何を出すかを決めるところ
   ・きょう出すカード（間隔反復）
   ・ドリルの問題（テーマを混ぜる＝交互練習）
   ・にがてノート（まちがい＋自信なし）と、その類似問題
   ・本番形式（公式35問／ランダム35問） */

var O4Engine = (function(){
'use strict';

function shuffle(a, rnd){
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--){
    var j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* 同じテーマが続かないように 並べかえる（交互練習） */
function interleave(list){
  var out = [], pool = list.slice(), lastTheme = '';
  while (pool.length){
    var idx = 0;
    for (var i = 0; i < pool.length; i++){
      if (pool[i].theme !== lastTheme){ idx = i; break; }
    }
    var picked = pool.splice(idx, 1)[0];
    out.push(picked);
    lastTheme = picked.theme;
  }
  return out;
}

/* ---------- 知識カード ---------- */
function dueCards(opts){
  opts = opts || {};
  var today = O4Store.todayStr();
  var limit = opts.limit || O4Store.settings().cardsPerDay;
  var list = OTSU4_CARDS.filter(function(c){
    if (opts.subject && c.subject !== opts.subject) return false;
    if (opts.theme   && c.theme   !== opts.theme)   return false;
    var st = O4Store.state('card', c.id);
    if (opts.includeDone) return true;
    return O4Srs.isDue(st, today);          /* 覚えたカードは 表示から消える */
  });
  list.sort(function(a, b){
    var sa = O4Store.state('card', a.id), sb = O4Store.state('card', b.id);
    if (sa.flag !== sb.flag) return sa.flag ? -1 : 1;   /* あやしいものから */
    if (sa.box !== sb.box)   return sa.box - sb.box;    /* 箱が小さいものから */
    return (b.star || 0) - (a.star || 0);               /* 出やすいものから */
  });
  return interleave(list).slice(0, limit);
}

function cardStats(subject){
  var all = OTSU4_CARDS.filter(function(c){ return !subject || c.subject === subject; });
  var done = 0, sum = 0, due = 0, today = O4Store.todayStr();
  all.forEach(function(c){
    var st = O4Store.state('card', c.id);
    sum += O4Srs.mastery(st);
    if ((st.box|0) >= O4Srs.MAXBOX) done++;
    if (O4Srs.isDue(st, today)) due++;
  });
  return { total: all.length, done: done, due: due, rate: all.length ? sum / all.length : 0 };
}

/* ---------- 問題 ---------- */
function pickQuestions(opts){
  opts = opts || {};
  var today = O4Store.todayStr();
  var limit = opts.limit || O4Store.settings().qsPerDay;
  var list = OTSU4_QUESTIONS.filter(function(q){
    if (opts.subject && q.subject !== opts.subject) return false;
    if (opts.theme   && q.theme   !== opts.theme)   return false;
    if (opts.src     && q.src     !== opts.src)     return false;
    if (opts.onlyDue){
      var st = O4Store.state('q', q.id);
      if (!O4Srs.isDue(st, today)) return false;
    }
    return true;
  });
  list.sort(function(a, b){
    var sa = O4Store.state('q', a.id), sb = O4Store.state('q', b.id);
    if (sa.flag !== sb.flag) return sa.flag ? -1 : 1;
    if (sa.seen !== sb.seen) return sa.seen - sb.seen;   /* まだ解いていないものから */
    return (b.star || 0) - (a.star || 0);
  });
  return interleave(list).slice(0, limit);
}

/* ---------- にがてノート ---------- */
function weakList(){
  return OTSU4_QUESTIONS.filter(function(q){
    var st = O4Store.state('q', q.id);
    return st.flag && st.seen > 0;
  });
}

/* にがてなテーマ（まちがい・自信なしが多い順） */
function weakThemes(){
  var m = {};
  weakList().forEach(function(q){
    if (!m[q.theme]) m[q.theme] = { theme:q.theme, n:0, subject:q.subject };
    m[q.theme].n++;
  });
  var arr = [];
  for (var k in m) arr.push(m[k]);
  arr.sort(function(a, b){ return b.n - a.n; });
  return arr;
}

/* にがてな問題 ＋ 同じテーマの「類似問題」を混ぜて出す */
function weakDrill(limit){
  limit = limit || 10;
  var weak = weakList();
  var themes = {};
  weak.forEach(function(q){ themes[q.theme] = true; });

  var similar = OTSU4_QUESTIONS.filter(function(q){
    if (!themes[q.theme]) return false;
    var st = O4Store.state('q', q.id);
    return !st.flag;                       /* まだ にがてに入っていない 同テーマの問題 */
  });
  similar.sort(function(a, b){
    var sa = O4Store.state('q', a.id), sb = O4Store.state('q', b.id);
    return sa.seen - sb.seen;
  });

  /* にがて本体 6割、類似問題 4割 くらいで混ぜる */
  var nWeak = Math.min(weak.length, Math.ceil(limit * 0.6));
  var nSim  = limit - nWeak;
  var out = shuffle(weak).slice(0, nWeak).concat(similar.slice(0, nSim));
  return interleave(shuffle(out)).slice(0, limit);
}

/* ---------- 本番形式 ---------- */
function examOfficial(){
  return OTSU4_QUESTIONS
    .filter(function(q){ return q.src === 'official'; })
    .slice()
    .sort(function(a, b){ return a.no - b.no; });
}

function examRandom(){
  var need = { law:15, phys:10, prop:10 };
  var out = [];
  ['law','phys','prop'].forEach(function(sub){
    var pool = OTSU4_QUESTIONS.filter(function(q){ return q.subject === sub; });
    /* 出やすい（★が多い）ものが えらばれやすいように 重みをつける */
    var weighted = [];
    pool.forEach(function(q){
      var w = Math.max(1, q.star || 3);
      for (var i = 0; i < w; i++) weighted.push(q);
    });
    var picked = [], used = {};
    var guard = 0;
    while (picked.length < need[sub] && guard++ < 5000){
      var q = weighted[Math.floor(Math.random() * weighted.length)];
      if (used[q.id]) continue;
      used[q.id] = true; picked.push(q);
    }
    /* 足りなければ 残りから 補う */
    if (picked.length < need[sub]){
      pool.forEach(function(q){ if (!used[q.id] && picked.length < need[sub]){ used[q.id] = true; picked.push(q); } });
    }
    out = out.concat(picked);
  });
  return out;
}

/* 模試の採点（科目ごとに6割） */
function scoreExam(questions, answers){
  var r = { law:{ok:0,n:0,pass:9}, phys:{ok:0,n:0,pass:6}, prop:{ok:0,n:0,pass:6} };
  questions.forEach(function(q, i){
    var s = r[q.subject]; if (!s) return;
    s.n++;
    if (answers[i] === q.a) s.ok++;
  });
  var all = true;
  ['law','phys','prop'].forEach(function(k){
    r[k].rate = r[k].n ? r[k].ok / r[k].n : 0;
    r[k].ok60 = r[k].n ? (r[k].ok / r[k].n >= 0.6) : false;
    if (!r[k].ok60) all = false;
  });
  r.total = r.law.ok + r.phys.ok + r.prop.ok;
  r.n = r.law.n + r.phys.n + r.prop.n;
  r.pass = all;
  return r;
}

/* 選択肢のならびを まぜる（まる暗記ふせぎ＝望ましい困難） */
function shuffleChoices(q){
  if (!O4Store.settings().shuffleChoices){
    return { choices:q.choices, a:q.a, order:[0,1,2,3,4] };
  }
  var order = shuffle([0,1,2,3,4]);
  var choices = order.map(function(i){ return q.choices[i]; });
  return { choices:choices, a:order.indexOf(q.a), order:order };
}

return {
  shuffle:shuffle, interleave:interleave,
  dueCards:dueCards, cardStats:cardStats,
  pickQuestions:pickQuestions,
  weakList:weakList, weakThemes:weakThemes, weakDrill:weakDrill,
  examOfficial:examOfficial, examRandom:examRandom, scoreExam:scoreExam,
  shuffleChoices:shuffleChoices
};
})();

if (typeof module !== 'undefined') module.exports = O4Engine;
