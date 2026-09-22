/* おつよん ― 間隔反復（かんかくはんぷく）のしくみ
   忘れかけた ころに もう一度 出す、という やり方です。
   箱（box）が 1つ 上がるごとに、つぎに 出る 日が 先に のびます。 */

var O4Srs = (function(){
'use strict';

/* 箱 → つぎに出すまでの日数 */
var INTERVAL = [0, 1, 3, 7, 16, 35];
var MAXBOX = 5;

function nextDays(box){
  if (box < 0) box = 0;
  if (box > MAXBOX) box = MAXBOX;
  return INTERVAL[box];
}

/* ---- 知識カードの採点 ----
   grade: 'again'（わからない）/ 'hard'（あやしい）/ 'good'（まあまあ）/ 'easy'（ばっちり） */
function gradeCard(st, grade){
  var s = { box:st.box|0, due:st.due, streak:st.streak|0, wrong:st.wrong|0, conf:st.conf, seen:(st.seen|0)+1, flag:!!st.flag, lastAt:Date.now() };
  if (grade === 'again'){
    s.box = 0; s.streak = 0; s.wrong++; s.flag = true; s.conf = 'low';
  } else if (grade === 'hard'){
    s.box = Math.max(0, s.box - 1); s.streak = 0; s.flag = true; s.conf = 'low';
  } else if (grade === 'good'){
    s.box = Math.min(MAXBOX, s.box + 1); s.streak++; s.conf = 'mid';
    if (s.streak >= 2) s.flag = false;
  } else { /* easy */
    s.box = Math.min(MAXBOX, s.box + 2); s.streak++; s.conf = 'high'; s.flag = false;
  }
  s.due = addDays(nextDays(s.box));
  return s;
}

/* ---- 問題の採点 ----
   correct: true / false
   conf: 'high'（自信あり）/ 'mid'（なんとなく）/ 'low'（あてずっぽう）
   ★ユーザーの要望：正解でも自信がなければ「にがて」に入れる */
function gradeQuestion(st, correct, conf){
  var s = { box:st.box|0, due:st.due, streak:st.streak|0, wrong:st.wrong|0, conf:conf, seen:(st.seen|0)+1, flag:!!st.flag, lastAt:Date.now() };
  if (!correct){
    s.box = 0; s.streak = 0; s.wrong++; s.flag = true;
  } else if (conf === 'high'){
    s.box = Math.min(MAXBOX, s.box + 1); s.streak++;
    if (s.streak >= 2) s.flag = false;      /* 自信ありで2回続けて正解したら卒業 */
  } else {
    /* 正解したが自信がない → 箱は上げるが「にがて」に入れておく */
    s.box = Math.min(MAXBOX, s.box + 1); s.streak = 0; s.flag = true;
  }
  s.due = addDays(nextDays(s.box));
  return s;
}

function addDays(n){
  var d = new Date(); d.setDate(d.getDate() + n);
  var m = ('0'+(d.getMonth()+1)).slice(-2), day = ('0'+d.getDate()).slice(-2);
  return d.getFullYear()+'-'+m+'-'+day;
}

function isDue(st, today){
  if (!st || !st.due) return true;
  return st.due <= today;
}

/* 定着度（0〜1）。ホームのメーターに使う */
function mastery(st){
  if (!st) return 0;
  return Math.min(1, (st.box|0) / MAXBOX);
}

return { INTERVAL:INTERVAL, MAXBOX:MAXBOX, nextDays:nextDays,
         gradeCard:gradeCard, gradeQuestion:gradeQuestion, isDue:isDue, mastery:mastery };
})();

if (typeof module !== 'undefined') module.exports = O4Srs;
