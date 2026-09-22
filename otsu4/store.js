/* おつよん ― 保存のしくみ
   端末の中（localStorage）だけに保存します。ログインも通信もありません。
   書き出し／読み込みボタンで JSON を退避できます（機種変更用）。 */

var O4Store = (function(){
'use strict';

var K = 'otsu4/progress';
var KS= 'otsu4/settings';
var KE= 'otsu4/exams';

function todayStr(d){
  d = d || new Date();
  var m = ('0'+(d.getMonth()+1)).slice(-2), day = ('0'+d.getDate()).slice(-2);
  return d.getFullYear()+'-'+m+'-'+day;
}
function addDays(n, from){
  var d = from ? new Date(from) : new Date();
  d.setDate(d.getDate()+n);
  return todayStr(d);
}
function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }

var P = null;

function blank(){
  return { cards:{}, qs:{}, day:{ date: todayStr(), cards:0, qs:0 }, hist:{}, started: todayStr() };
}

function load(){
  if (P) return P;
  P = lsGet(K, null) || blank();
  if (!P.cards) P.cards = {};
  if (!P.qs)    P.qs    = {};
  if (!P.hist)  P.hist  = {};
  if (!P.started) P.started = todayStr();
  if (!P.day || P.day.date !== todayStr()) P.day = { date: todayStr(), cards:0, qs:0 };
  return P;
}
function save(){ lsSet(K, load()); }

/* ---- 1枚／1問の状態 ---- */
function state(kind, id){
  var p = load(), bag = (kind === 'card') ? p.cards : p.qs;
  if (!bag[id]) bag[id] = { box:0, due: todayStr(), streak:0, wrong:0, conf:'', seen:0, flag:false, lastAt:0 };
  return bag[id];
}
function put(kind, id, st){
  var p = load(), bag = (kind === 'card') ? p.cards : p.qs;
  bag[id] = st; save();
}

/* ---- 今日やった数 ＋ 日ごとの きろく ---- */
function countUp(kind, correct){
  var p = load(), t = todayStr();
  if (p.day.date !== t) p.day = { date: t, cards:0, qs:0 };
  if (kind === 'card') p.day.cards++; else p.day.qs++;

  if (!p.hist[t]) p.hist[t] = { c:0, q:0, ok:0 };
  if (kind === 'card') p.hist[t].c++;
  else { p.hist[t].q++; if (correct) p.hist[t].ok++; }

  var keys = Object.keys(p.hist).sort();
  while (keys.length > 120) delete p.hist[keys.shift()];
  save();
}

/* ---- きろくの 取り出し（直近 days 日ぶん、空の日も ならべる） ---- */
function history(days){
  var p = load(), out = [], base = new Date();
  days = days || 14;
  for (var i = days - 1; i >= 0; i--){
    var day = new Date(base); day.setDate(base.getDate() - i);
    var k = todayStr(day), h = p.hist[k] || { c:0, q:0, ok:0 };
    out.push({ date:k, cards:h.c, qs:h.q, ok:h.ok });
  }
  return out;
}

/* 連続で 学習した 日数（きょう まだなら きのうまでで 数える） */
function streak(){
  var p = load(), n = 0, d = new Date(), t = todayStr();
  if (!p.hist[t] || (p.hist[t].c + p.hist[t].q) === 0) d.setDate(d.getDate() - 1);
  for (var i = 0; i < 200; i++){
    var k = todayStr(d), h = p.hist[k];
    if (!h || (h.c + h.q) === 0) break;
    n++; d.setDate(d.getDate() - 1);
  }
  return n;
}

/* まちがえた テーマの 知識カードを きょう もう一度 出す（自動で もどす） */
function reviveCards(ids){
  var p = load(), t = todayStr(), n = 0;
  (ids || []).forEach(function(id){
    var st = state('card', id);
    if (st.due > t){ st.due = t; st.flag = true; p.cards[id] = st; n++; }
  });
  if (n) save();
  return n;
}
function todayCount(){ var p = load(); return { cards:p.day.cards, qs:p.day.qs, date:p.day.date }; }

/* ---- 設定 ---- */
var DEF_SET = { cardsPerDay:20, qsPerDay:10, shuffleChoices:false };
function settings(){ var s = lsGet(KS, null) || {}; for (var k in DEF_SET) if (s[k] === undefined) s[k] = DEF_SET[k]; return s; }
function setSettings(s){ lsSet(KS, s); }

/* ---- 模試の記録 ---- */
function exams(){ return lsGet(KE, []); }
function addExam(rec){ var a = exams(); a.unshift(rec); if (a.length > 50) a.length = 50; lsSet(KE, a); }

/* ---- 書き出し・読み込み ---- */
function exportAll(){
  return JSON.stringify({ v:1, progress: load(), settings: settings(), exams: exams() }, null, 1);
}
function importAll(text){
  var o = JSON.parse(text);
  if (!o || !o.progress) throw new Error('形式がちがいます');
  P = o.progress; save();
  if (o.settings) setSettings(o.settings);
  if (o.exams) lsSet(KE, o.exams);
  return true;
}
function resetAll(){ P = blank(); save(); lsSet(KE, []); }

return {
  todayStr:todayStr, addDays:addDays,
  load:load, save:save, state:state, put:put,
  countUp:countUp, todayCount:todayCount,
  history:history, streak:streak, reviveCards:reviveCards,
  settings:settings, setSettings:setSettings,
  exams:exams, addExam:addExam,
  exportAll:exportAll, importAll:importAll, resetAll:resetAll
};
})();

if (typeof module !== 'undefined') module.exports = O4Store;
