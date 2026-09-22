/* おつよん ― 自動テスト
   ブラウザ（tests.html）でも node でも 動きます。 */
(function(root){
'use strict';

var results = [];
function ok(name, cond, detail){ results.push({ name:name, pass:!!cond, detail:detail || '' }); }
function eq(name, a, b){ ok(name, a === b, 'えられた値=' + JSON.stringify(a) + ' / 期待=' + JSON.stringify(b)); }

function runAll(env){
  var T = env.themes, Q = env.questions, C = env.cards, Store = env.store, Srs = env.srs, Eng = env.engine;
  results = [];

  /* ---- データの形 ---- */
  var ids = {}, dup = [];
  Q.forEach(function(q){ if (ids[q.id]) dup.push(q.id); ids[q.id] = 1; });
  eq('問題IDに 重複がない', dup.length, 0);

  var bad = Q.filter(function(q){
    return !q.q || !q.choices || q.choices.length !== 5 ||
           typeof q.a !== 'number' || q.a < 0 || q.a > 4 ||
           !q.why || !env.themeMap[q.theme] || !env.subjects[q.subject];
  });
  eq('すべての問題が 正しい形（5択・正解番号・テーマ）', bad.length, 0);

  var cbad = C.filter(function(c){ return !c.front || !c.back || !env.themeMap[c.theme]; });
  eq('すべてのカードが 正しい形', cbad.length, 0);

  var cids = {}, cdup = [];
  C.forEach(function(c){ if (cids[c.id]) cdup.push(c.id); cids[c.id] = 1; });
  eq('カードIDに 重複がない', cdup.length, 0);

  /* ---- 公式過去問の 解答キー ---- */
  var official = Q.filter(function(q){ return q.src === 'official'; })
                  .sort(function(a, b){ return a.no - b.no; });
  eq('公式過去問は 35問', official.length, 35);
  var KEY = [4,1,4,1,4,3,2,2,5,4,2,2,2,3,2, 1,1,4,5,5,4,1,2,5,3, 5,3,1,4,5,5,1,4,4,1];
  var mism = official.filter(function(q, i){ return q.a + 1 !== KEY[i]; }).map(function(q){ return q.no; });
  eq('公式の 解答キーと 一致する', mism.length, 0);
  eq('公式の 科目わけ（法令15）', official.filter(function(q){ return q.subject === 'law'; }).length, 15);
  eq('公式の 科目わけ（物理化学10）', official.filter(function(q){ return q.subject === 'phys'; }).length, 10);
  eq('公式の 科目わけ（性質消火10）', official.filter(function(q){ return q.subject === 'prop'; }).length, 10);

  /* ---- すべてのテーマに 問題がある（類似問題が 出せる） ---- */
  var empty = T.filter(function(th){
    return !Q.some(function(q){ return q.theme === th.key; });
  }).map(function(th){ return th.key; });
  eq('問題が 0問の テーマがない', empty.length, 0, empty.join(','));

  /* ---- テーマごとの 問題数（★5は5問以上、★4は3問以上、★3以下は2問以上）---- */
  var cnt = {};
  Q.forEach(function(q){ cnt[q.theme] = (cnt[q.theme] || 0) + 1; });
  var need = function(star){ return star === 5 ? 5 : star === 4 ? 3 : 2; };
  var thin = T.filter(function(th){ return (cnt[th.key] || 0) < need(th.star); })
              .map(function(th){ return th.key + '(' + (cnt[th.key] || 0) + ')'; });
  eq('出やすさに 見あう 問題数が そろっている', thin.length, 0, thin.join(','));

  /* ---- 計算問題の 途中式 ---- */
  var calc = Q.filter(function(q){ return q.steps && q.steps.length; });
  ok('計算問題に 途中式が ついている（10問以上）', calc.length >= 10, '計算問題=' + calc.length);
  var badStep = calc.filter(function(q){
    if (!q.trick) return true;
    return q.steps.some(function(st){ return !st.t || !st.d; });
  }).map(function(q){ return q.id; });
  eq('途中式は すべて 見出しと 中身と ラクな解き方が そろっている', badStep.length, 0, badStep.join(','));
  var calcSub = {};
  calc.forEach(function(q){ calcSub[q.subject] = true; });
  ok('計算問題は 法令にも 物理化学にも ある', calcSub.law && calcSub.phys);

  /* ---- 計算問題だけを しぼれる ---- */
  var onlyCalc = Eng.pickQuestions({ calcOnly:true, limit:99 });
  ok('calcOnly で 計算問題だけに しぼれる',
     onlyCalc.length > 0 && onlyCalc.every(function(q){ return q.steps && q.steps.length; }));

  /* ---- 「なぜ そうなるか」が そろっているか ---- */
  var noWhy = C.filter(function(c){ return !c.why || c.why.length < 15; }).map(function(c){ return c.id; });
  eq('すべての カードに 理由（why）が ついている', noWhy.length, 0, noWhy.slice(0, 5).join(','));

  var thin = Q.filter(function(q){ return (q.why || '').length < 45 && !q.deep; }).map(function(q){ return q.id; });
  eq('解説が 薄い問題が のこっていない', thin.length, 0, thin.slice(0, 5).join(','));

  var noNote = T.filter(function(th){
    var n = env.notes[th.key];
    return !n || !n.title || !n.body || n.body.length < 80;
  }).map(function(th){ return th.key; });
  eq('すべての テーマに 全体像の 解説が ついている', noNote.length, 0, noNote.join(','));

  var deepN = Q.filter(function(q){ return q.deep; }).length;
  ok('ふみこんだ解説が 100問以上に ついている', deepN >= 100, 'deep=' + deepN);

  /* ---- 講義ページの 中身 ---- */
  var noGoro = T.filter(function(th){
    var g = env.goro[th.key];
    return !g || !g.length;
  }).map(function(th){ return th.key; });
  eq('すべての テーマに おぼえ方が ついている', noGoro.length, 0, noGoro.join(','));

  var TYPES = { goro:1, uta:1, image:1, kotsu:1 };
  var badGoro = [];
  T.forEach(function(th){
    (env.goro[th.key] || []).forEach(function(g){
      if (!TYPES[g.type] || !g.t || !g.d || g.d.length < 10) badGoro.push(th.key + '/' + g.t);
    });
  });
  eq('おぼえ方は すべて 種類・見出し・説明が そろっている', badGoro.length, 0, badGoro.slice(0, 3).join(','));

  var goroN = 0, utaN = 0;
  T.forEach(function(th){
    (env.goro[th.key] || []).forEach(function(g){ goroN++; if (g.type === 'uta') utaN++; });
  });
  ok('おぼえ方が 100個以上 ある', goroN >= 100, 'goro=' + goroN);
  ok('となえ歌も 用意されている', utaN >= 3, 'uta=' + utaN);

  /* ---- 読んだ しるし ---- */
  Store.resetAll();
  eq('はじめは どれも 読んでいない', Object.keys(Store.readMap()).length, 0);
  Store.readMark('shiteisuryo');
  ok('読んだ しるしが つく', !!Store.readMap()['shiteisuryo']);
  Store.readMark('shiteisuryo', false);
  eq('読んだ しるしを 外せる', Object.keys(Store.readMap()).length, 0);

  /* ---- 間隔反復 ---- */
  eq('箱0の つぎは きょう', Srs.nextDays(0), 0);
  eq('箱1の つぎは 1日後', Srs.nextDays(1), 1);
  eq('箱5の つぎは 35日後', Srs.nextDays(5), 35);

  var st = { box:0, due:'', streak:0, wrong:0, conf:'', seen:0, flag:false };
  var s1 = Srs.gradeQuestion(st, false, 'mid');
  ok('まちがえたら 箱は0に もどり にがてに入る', s1.box === 0 && s1.flag === true && s1.wrong === 1);

  var s2 = Srs.gradeQuestion(st, true, 'low');
  ok('正解でも 自信なしなら にがてに入る', s2.flag === true && s2.box === 1);

  var s3 = Srs.gradeQuestion(st, true, 'high');
  ok('正解＋自信ありの 1回目では まだ卒業しない', s3.flag === false || s3.streak === 1);
  var s4 = Srs.gradeQuestion(s3, true, 'high');
  ok('正解＋自信ありが 2回続くと 卒業する', s4.flag === false && s4.streak === 2);

  var s5 = Srs.gradeCard({ box:2, streak:1, wrong:0, seen:1, flag:false }, 'again');
  ok('カードで わからないと 箱0に もどる', s5.box === 0 && s5.flag === true);
  var s6 = Srs.gradeCard({ box:1, streak:0, wrong:0, seen:1, flag:false }, 'easy');
  eq('カードで ばっちりなら 箱が2つ すすむ', s6.box, 3);

  /* ---- 採点（科目ごとに6割） ---- */
  var fake = [], ans = [];
  for (var i = 0; i < 15; i++){ fake.push({ subject:'law',  a:0 }); ans.push(i < 9 ? 0 : 1); }   /* 法令 9/15 */
  for (i = 0; i < 10; i++){ fake.push({ subject:'phys', a:0 }); ans.push(i < 6 ? 0 : 1); }        /* 物化 6/10 */
  for (i = 0; i < 10; i++){ fake.push({ subject:'prop', a:0 }); ans.push(i < 6 ? 0 : 1); }        /* 性消 6/10 */
  var r = Eng.scoreExam(fake, ans);
  ok('9・6・6 ちょうどで 合格になる', r.pass === true && r.total === 21);

  ans[0] = 1;                       /* 法令を 8問に 減らす */
  var r2 = Eng.scoreExam(fake, ans);
  ok('1科目でも 6割を 切ると 不合格', r2.pass === false && r2.law.ok === 8);

  /* 合計点では 判定しないことの 確認：法令15点・物化10点・性消2点 */
  var fake2 = [], ans2 = [];
  for (i = 0; i < 15; i++){ fake2.push({ subject:'law',  a:0 }); ans2.push(0); }
  for (i = 0; i < 10; i++){ fake2.push({ subject:'phys', a:0 }); ans2.push(0); }
  for (i = 0; i < 10; i++){ fake2.push({ subject:'prop', a:0 }); ans2.push(i < 2 ? 0 : 1); }
  var r3 = Eng.scoreExam(fake2, ans2);
  ok('合計27点でも 1科目が 6割未満なら 不合格', r3.total === 27 && r3.pass === false);

  /* ---- 選択肢シャッフル ---- */
  var q0 = Q[0];
  var okShuffle = true;
  for (i = 0; i < 50; i++){
    var mix = Eng.shuffleChoices(q0);
    if (mix.choices[mix.a] !== q0.choices[q0.a]) okShuffle = false;
    if (mix.choices.length !== 5) okShuffle = false;
  }
  ok('選択肢を まぜても 正解の中身は 変わらない', okShuffle);

  /* ---- ランダム模試の 構成 ---- */
  var ex = Eng.examRandom();
  eq('ランダム模試は 35問', ex.length, 35);
  eq('ランダム模試の 法令は 15問', ex.filter(function(q){ return q.subject === 'law'; }).length, 15);
  eq('ランダム模試の 物理化学は 10問', ex.filter(function(q){ return q.subject === 'phys'; }).length, 10);
  eq('ランダム模試の 性質消火は 10問', ex.filter(function(q){ return q.subject === 'prop'; }).length, 10);
  var exIds = {}, exDup = 0;
  ex.forEach(function(q){ if (exIds[q.id]) exDup++; exIds[q.id] = 1; });
  eq('ランダム模試に 同じ問題が 2回出ない', exDup, 0);

  /* ---- 交互練習（同じテーマが つづかない） ---- */
  var mixList = Eng.interleave(Q.slice(0, 20));
  var run = 0;
  for (i = 1; i < mixList.length; i++) if (mixList[i].theme === mixList[i-1].theme) run++;
  ok('ならべかえで 同テーマの 連続が 減る', run <= 3, '連続=' + run);

  /* ---- にがて → 類似問題 ---- */
  Store.resetAll();
  var target = Q.filter(function(q){ return q.theme === 'shiteisuryo'; })[0];
  Store.put('q', target.id, Srs.gradeQuestion(Store.state('q', target.id), false, 'low'));
  var weak = Eng.weakList();
  ok('まちがえた問題が にがて一覧に 入る', weak.some(function(q){ return q.id === target.id; }));
  var drill = Eng.weakDrill(8);
  ok('にがてドリルに 同じテーマの 別問題（類似問題）が 混ざる',
     drill.some(function(q){ return q.theme === target.theme && q.id !== target.id; }));

  /* ---- まちがえたら 知識カードへ もどる ---- */
  Store.resetAll();
  var q2 = Q.filter(function(x){ return x.theme === 'hoankyori'; })[0];
  var rel = Eng.relatedCards(q2, 3);
  ok('問題から 同じテーマの 知識カードが 引ける',
     rel.length > 0 && rel.every(function(c){ return c.theme === q2.theme; }));

  /* さきに 覚えた ことにして、先の日に とばす */
  var rid = rel[0].id;
  Store.put('card', rid, Srs.gradeCard(Store.state('card', rid), 'easy'));
  var farDue = Store.state('card', rid).due;
  ok('覚えた カードは 先の日に とぶ', farDue > Store.todayStr(), 'due=' + farDue);

  var revived = Store.reviveCards([rid]);
  eq('まちがえた テーマの カードを きょうに もどせる', revived, 1);
  eq('もどした カードの 日づけは きょう', Store.state('card', rid).due, Store.todayStr());
  ok('もどした カードは きょうの 出題に 入る',
     Eng.dueCards({ theme:q2.theme, limit:999 }).some(function(c){ return c.id === rid; }));

  /* ---- 日ごとの きろく ---- */
  Store.resetAll();
  Store.countUp('q', true); Store.countUp('q', false); Store.countUp('card');
  var h = Store.history(7);
  eq('きろくは 7日ぶん ならぶ', h.length, 7);
  var today = h[h.length - 1];
  ok('きょうの きろくが 正しい', today.qs === 2 && today.ok === 1 && today.cards === 1,
     JSON.stringify(today));
  eq('学習した日は 連続1日と 数える', Store.streak(), 1);

  Store.resetAll();
  eq('なにも していなければ 連続0日', Store.streak(), 0);
  var h2 = Store.history(14);
  ok('やっていない日も 0として ならぶ', h2.length === 14 && h2.every(function(d){ return d.qs === 0; }));

  /* ---- カードは 覚えると 出なくなる ---- */
  Store.resetAll();
  var c0 = C[0];
  var before = Eng.dueCards({ limit:999 }).some(function(c){ return c.id === c0.id; });
  Store.put('card', c0.id, Srs.gradeCard(Store.state('card', c0.id), 'easy'));
  var after = Eng.dueCards({ limit:999 }).some(function(c){ return c.id === c0.id; });
  ok('ばっちりと答えた カードは きょうは もう出ない', before === true && after === false);
  Store.resetAll();

  return results;
}

root.O4Tests = { runAll:runAll };

/* ---- node で そのまま 走らせる ---- */
if (typeof module !== 'undefined' && require.main === module){
  var fs = require('fs'), path = require('path'), dir = __dirname;
  global.localStorage = { _d:{}, getItem:function(k){ return this._d[k] || null; },
                          setItem:function(k, v){ this._d[k] = v; },
                          removeItem:function(k){ delete this._d[k]; } };
  ['data/themes.js','data/questions-official.js','data/questions-extra.js','data/questions-extra2.js',
   'data/questions-deep.js','data/knowledge.js','data/knowledge-why.js','data/notes.js','data/goro.js',
   'store.js','srs.js','engine.js'].forEach(function(f){
    (0, eval)(fs.readFileSync(path.join(dir, f), 'utf8'));
  });
  var res = runAll({
    themes: OTSU4_THEMES, themeMap: OTSU4_THEME_MAP, subjects: OTSU4_SUBJECTS,
    questions: OTSU4_QUESTIONS, cards: OTSU4_CARDS, notes: OTSU4_NOTES, goro: OTSU4_GORO,
    store: O4Store, srs: O4Srs, engine: O4Engine
  });
  var ng = res.filter(function(r){ return !r.pass; });
  res.forEach(function(r){ console.log((r.pass ? '  OK  ' : '  NG  ') + r.name + (r.pass ? '' : '   ' + r.detail)); });
  console.log('\n' + (res.length - ng.length) + ' / ' + res.length + ' 通過');
  process.exit(ng.length ? 1 : 0);
}
})(typeof window !== 'undefined' ? window : globalThis);
