/* 原稿用紙ツール ― 保存のしくみ
   ・ファイルを そのまま ひらいた とき   … 端末の 中（localStorage）に 保存します
   ・Apps Script の ウェブアプリの とき   … Google スプレッドシートに 保存し、
     端末の 中にも 下書きを のこします（通信が 切れても 消えないように）。
     つながった ときに 自動で 送りなおします。 */

var gyStore = (function(){
'use strict';

const K_KADAI = 'genkou-youshi/kadai';
const K_DOC   = 'genkou-youshi/doc/';
const K_PEND  = 'genkou-youshi/pending';

function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }

const hasGas = (typeof google !== 'undefined' && google.script && google.script.run);

const S = {
  mode    : hasGas ? 'gas' : 'local',
  user    : '',
  isTeacher: !hasGas,      /* ファイルを そのまま ひらいた ときは だれでも 設定できる。
                              Apps Script の ときは サーバーが 先生かどうかを かえす */
  status  : '',
  onStatus: null,
  _kadai  : null,
  _docs   : {},
  _pend   : {},
  _timer  : null,
  _sending: false
};

function say(t){ S.status = t; if(S.onStatus) S.onStatus(t); }

/* ---------- かだい ---------- */
S.getKadai = function(){
  if(!S._kadai) S._kadai = lsGet(K_KADAI, null) || gyDefaultKadai();
  return S._kadai;
};
S.setKadai = function(list){
  S._kadai = list;
  lsSet(K_KADAI, list);
  if(S.mode === 'gas'){
    try{
      google.script.run
        .withSuccessHandler(() => say('かだいを ほぞんしました'))
        .withFailureHandler(() => say('かだいを 送れませんでした'))
        .gySaveKadai(list);
    }catch(e){ say('かだいを 送れませんでした'); }
  }
};
S.resetKadai = function(){ S.setKadai(gyDefaultKadai()); return S._kadai; };

/* ---------- 書いた もの ---------- */
S.getDoc = function(id){
  if(S._docs[id]) return S._docs[id];
  const d = lsGet(K_DOC + id, null) || { title:'', name:'', body:'', at:'' };
  S._docs[id] = d;
  return d;
};
S.setDoc = function(id, doc){
  doc.at = new Date().toISOString();
  S._docs[id] = doc;
  const okLocal = lsSet(K_DOC + id, doc);
  if(S.mode === 'local'){
    say(okLocal ? 'この たんまつに ほぞん' : 'ほぞんできません');
    return;
  }
  S._pend[id] = doc;
  lsSet(K_PEND, S._pend);
  say('ほぞん中…');
  flushSoon();
};

/* ---------- Apps Script へ 送る ---------- */
function flushSoon(){
  clearTimeout(S._timer);
  S._timer = setTimeout(flush, 800);
}
function flush(){
  if(S.mode !== 'gas' || S._sending) return;
  const ids = Object.keys(S._pend);
  if(!ids.length){ return; }
  const id = ids[0], doc = S._pend[id];
  S._sending = true;
  try{
    google.script.run
      .withSuccessHandler(() => {
        S._sending = false;
        if(S._pend[id] === doc){ delete S._pend[id]; lsSet(K_PEND, S._pend); }
        if(Object.keys(S._pend).length){ flushSoon(); }
        else say('ほぞんしました');
      })
      .withFailureHandler(() => {
        S._sending = false;
        say('ほぞんまち（つながったら 送ります）');
        setTimeout(flush, 15000);
      })
      .gySaveDoc(id, doc);
  }catch(e){
    S._sending = false;
    say('ほぞんまち（つながったら 送ります）');
    setTimeout(flush, 15000);
  }
}

/* ---------- はじめに 1回 ---------- */
S.init = function(done){
  S._pend = lsGet(K_PEND, {}) || {};
  S.getKadai();
  if(S.mode !== 'gas'){ say(''); done(); return; }

  say('よみこみ中…');
  try{
    google.script.run
      .withSuccessHandler(function(res){
        if(res){
          S.user = res.user || '';
          S.isTeacher = !!res.isTeacher;
          if(res.kadai && res.kadai.length){ S._kadai = res.kadai; lsSet(K_KADAI, res.kadai); }
          if(res.docs) for(const id in res.docs){
            /* 端末に 新しい 下書きが あれば そちらを のこす */
            const mine = lsGet(K_DOC + id, null);
            const theirs = res.docs[id];
            const use = (mine && theirs && mine.at > theirs.at) ? mine : theirs;
            S._docs[id] = use; lsSet(K_DOC + id, use);
          }
        }
        say('');
        flush();
        done();
      })
      .withFailureHandler(function(){
        say('つながりません（この たんまつに ほぞんします）');
        done();
      })
      .gyLoad();
  }catch(e){
    say('つながりません（この たんまつに ほぞんします）');
    done();
  }
};

return S;
})();
