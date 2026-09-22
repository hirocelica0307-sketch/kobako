/* 原稿用紙ツール ― 保存のしくみ
   ・ファイルを そのまま ひらいた とき   … 端末の 中（localStorage）に 保存します
   ・Apps Script の ウェブアプリの とき   … Google スプレッドシートに 保存し、
     端末の 中にも 下書きを のこします（通信が 切れても 消えないように）。
     つながった ときに 自動で 送りなおします。 */

var gyStore = (function(){
'use strict';

const K_SET  = 'genkou-youshi/settings';
const K_DOC  = 'genkou-youshi/doc';
const K_PEND = 'genkou-youshi/pending';

function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }

const hasGas = (typeof google !== 'undefined' && google.script && google.script.run);

const S = {
  mode     : hasGas ? 'gas' : 'local',
  user     : '',
  isTeacher: !hasGas,      /* ファイルを そのまま ひらいた ときは だれでも 設定できる。
                              Apps Script の ときは サーバーが 先生かどうかを かえす */
  status   : '',
  onStatus : null,
  _set     : null,
  _doc     : null,
  _pend    : null,
  _timer   : null,
  _sending : false
};

function say(t){ S.status = t; if(S.onStatus) S.onStatus(t); }

/* ---------- きまり（設定） ---------- */
S.getSettings = function(){
  if(!S._set) S._set = gyUpgradeSettings(lsGet(K_SET, null));
  return S._set;
};
S.setSettings = function(obj){
  S._set = obj;
  lsSet(K_SET, obj);
  if(S.mode === 'gas'){
    try{
      google.script.run
        .withSuccessHandler(() => say('きまりを ほぞんしました'))
        .withFailureHandler(() => say('きまりを 送れませんでした'))
        .gySaveSettings(obj);
    }catch(e){ say('きまりを 送れませんでした'); }
  }
};
S.resetSettings = function(){ S.setSettings(gyDefaultSettings()); return S._set; };

/* ---------- 書いた もの ---------- */
S.getDoc = function(){
  if(!S._doc) S._doc = lsGet(K_DOC, null) || { title:'', name:'', body:'', chars:0, pages:1, at:'' };
  return S._doc;
};
S.setDoc = function(doc){
  doc.at = new Date().toISOString();
  S._doc = doc;
  const okLocal = lsSet(K_DOC, doc);
  if(S.mode === 'local'){
    say(okLocal ? 'この たんまつに ほぞん' : 'ほぞんできません');
    return;
  }
  S._pend = doc;
  lsSet(K_PEND, doc);
  say('ほぞん中…');
  clearTimeout(S._timer);
  S._timer = setTimeout(flush, 800);
};

/* ---------- Apps Script へ 送る ---------- */
function flush(){
  if(S.mode !== 'gas' || S._sending || !S._pend) return;
  const doc = S._pend;
  S._sending = true;
  try{
    google.script.run
      .withSuccessHandler(() => {
        S._sending = false;
        if(S._pend === doc){ S._pend = null; lsSet(K_PEND, null); say('ほぞんしました'); }
        else setTimeout(flush, 100);
      })
      .withFailureHandler(() => {
        S._sending = false;
        say('ほぞんまち（つながったら 送ります）');
        setTimeout(flush, 15000);
      })
      .gySaveDoc(doc);
  }catch(e){
    S._sending = false;
    say('ほぞんまち（つながったら 送ります）');
    setTimeout(flush, 15000);
  }
}

/* ---------- はじめに 1回 ---------- */
S.init = function(done){
  S._pend = lsGet(K_PEND, null);
  S.getSettings();
  S.getDoc();
  if(S.mode !== 'gas'){ say(''); done(); return; }

  say('よみこみ中…');
  try{
    google.script.run
      .withSuccessHandler(function(res){
        if(res){
          S.user = res.user || '';
          S.isTeacher = !!res.isTeacher;
          if(res.settings){ S._set = gyUpgradeSettings(res.settings); lsSet(K_SET, S._set); }
          if(res.doc){
            /* 端末の 下書きの ほうが 新しければ そちらを のこす */
            const mine = lsGet(K_DOC, null);
            const use = (mine && mine.at && mine.at > (res.doc.at || '')) ? mine : res.doc;
            S._doc = use; lsSet(K_DOC, use);
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
