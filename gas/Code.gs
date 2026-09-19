/**
 * ひっさんモンスター  ―  Google Apps Script（サーバー側）
 *
 * 児童が 学校の Google アカウントで ウェブアプリを ひらくと、
 * そのメールアドレスを キーに して プレイ記録を スプレッドシートに 保存します。
 * 児童は スプレッドシートを 直接 見ることは できません
 * （ウェブアプリを「自分（先生）として実行」で デプロイするため）。
 *
 * くわしい 手順は docs/SETUP-GAS.md を 見てください。
 */

const SHEET_PROGRESS = 'progress';
const SHEET_LOG      = 'log';

const HEAD_PROGRESS = ['メールアドレス','なまえ','さいごに あそんだ日時','★ごうけい','モンスター',
                       'といた もんだい','まちがい','いっぱつ正解率(%)','ステージ別★(1〜9)','data(JSON)'];
const HEAD_LOG      = ['日時','メールアドレス','なまえ','ステージ','★','まちがい','もんだい数'];

/* ---------- ウェブアプリ ---------- */
function doGet(){
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ひっさんモンスター')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- スプレッドシート ---------- */
function getSpreadsheet_(){
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if(ss) return ss;
  throw new Error('スプレッドシートが 見つかりません。スクリプトプロパティ SHEET_ID を 設定してください。');
}
function getSheet_(name, header){
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.setColumnWidth(header.length, 120);   // JSON列は せまく
  }
  return sh;
}
function currentEmail_(){
  try{ return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
  catch(e){ return ''; }
}
function findRow_(sh, email){
  const last = sh.getLastRow();
  if(last < 2) return 0;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  for(let i = 0; i < col.length; i++){
    if(String(col[i][0]).toLowerCase() === email) return i + 2;
  }
  return 0;
}

/* ---------- クライアントから よばれる ---------- */
function loadProgress(){
  const email = currentEmail_();
  if(!email) return { ok:false, reason:'no-user' };
  const sh = getSheet_(SHEET_PROGRESS, HEAD_PROGRESS);
  const row = findRow_(sh, email);
  let data = null;
  if(row){
    const raw = sh.getRange(row, HEAD_PROGRESS.length).getValue();
    if(raw){ try{ data = JSON.parse(raw); }catch(e){ data = null; } }
  }
  return { ok:true, email:email, data:data };
}

function saveProgress(json){
  const email = currentEmail_();
  if(!email) return { ok:false, reason:'no-user' };
  let data;
  try{ data = JSON.parse(json); }catch(e){ return { ok:false, reason:'bad-json' }; }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const sh = getSheet_(SHEET_PROGRESS, HEAD_PROGRESS);
    let row = findRow_(sh, email);
    if(!row) row = Math.max(sh.getLastRow() + 1, 2);

    const stars = Object.keys(data.stars || {}).reduce((s, k) => s + Number(data.stars[k] || 0), 0);
    const q = Number(data.totalQ || 0), miss = Number(data.totalMiss || 0);
    const rate = q ? Math.round(100 * q / (q + miss)) : '';
    const perStage = [];
    for(let i = 1; i <= 9; i++) perStage.push((data.stars && data.stars[i]) || 0);

    sh.getRange(row, 1, 1, HEAD_PROGRESS.length).setValues([[
      email, email.split('@')[0], new Date(), stars,
      (data.monsters || []).length, q, miss, rate, perStage.join(' '), json
    ]]);
  } finally {
    lock.releaseLock();
  }
  return { ok:true };
}

function logClear(rec){
  const email = currentEmail_();
  if(!email) return { ok:false };
  const sh = getSheet_(SHEET_LOG, HEAD_LOG);
  sh.appendRow([ new Date(), email, email.split('@')[0],
                 (rec && rec.name) || '', (rec && rec.stars) || '',
                 (rec && rec.miss) || 0, (rec && rec.q) || 0 ]);
  return { ok:true };
}

/* ---------- 先生用：うごきの かくにん ----------
   スクリプトエディタで この関数を 実行すると、
   じぶんの メールアドレスが とれるか ログで かくにん できます。 */
function checkMe(){
  const e = currentEmail_();
  Logger.log(e ? ('OK: ' + e) : 'NG: メールアドレスが とれません（デプロイ設定を 見なおしてください）');
  return e;
}
