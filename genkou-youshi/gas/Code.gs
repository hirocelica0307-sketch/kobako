/**
 * げんこうようし  ―  Google Apps Script（サーバー側）
 *
 * 児童が 学校の Google アカウントで ウェブアプリを ひらくと、
 * そのメールアドレスを キーに して 書いた 原稿を スプレッドシートに 保存します。
 * 端末が かわっても、電源を 切っても、前回の つづきから 書けます。
 *
 * ・児童は スプレッドシートを 直接 見ることは できません
 *   （ウェブアプリを「自分（先生）として実行」で デプロイするため）
 * ・「かだい」（原稿用紙の きまり）を 書きかえられるのは 先生だけです
 *
 * くわしい 手順は docs/SETUP-GAS.md を 見てください。
 */

const SHEET_DOC   = 'げんこう';
const SHEET_KADAI = 'かだい';

const HEAD_DOC = ['メールアドレス','なまえ','かだい','だいめい','字数','さいごに 書いた 日時','本文'];

/* ---------- ウェブアプリ ---------- */
function doGet(){
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('げんこうようし')
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
    if(header){
      sh.appendRow(header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
      sh.setColumnWidth(header.length, 420);   // 本文の 列は ひろく
    }
  }
  return sh;
}

/* ---------- だれが つかっているか ---------- */
function currentEmail_(){
  try{ return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
  catch(e){ return ''; }
}
/** 先生か どうか。
 *  「自分（先生）として実行」で デプロイすると、実行者＝先生に なります。
 *  ほかにも 先生を ふやしたい ときは スクリプトプロパティ TEACHERS に
 *  メールアドレスを カンマ区切りで 入れてください。 */
function isTeacher_(email){
  if(!email) return false;
  try{
    const owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if(owner && owner === email) return true;
  }catch(e){}
  const extra = PropertiesService.getScriptProperties().getProperty('TEACHERS') || '';
  return extra.toLowerCase().split(/[,\s]+/).filter(String).indexOf(email) >= 0;
}

/* ---------- 行を さがす ---------- */
function findDocRow_(sh, email, kadaiId){
  const last = sh.getLastRow();
  if(last < 2) return 0;
  const v = sh.getRange(2, 1, last - 1, 3).getValues();
  for(let i = 0; i < v.length; i++){
    if(String(v[i][0]).toLowerCase() === email && String(v[i][2]) === kadaiId) return i + 2;
  }
  return 0;
}

/* ---------- クライアントから よばれる ---------- */

/** はじめに 1回。その児童の 原稿ぜんぶと、先生が きめた かだいを かえします。 */
function gyLoad(){
  const email = currentEmail_();
  const out = { user: email, isTeacher: isTeacher_(email), kadai: null, docs: {} };

  const kd = getSheet_(SHEET_KADAI, ['かだい（さわらないで ください）']);
  const raw = kd.getRange(2, 1).getValue();
  if(raw){
    try{ out.kadai = JSON.parse(raw); }catch(e){ out.kadai = null; }
  }

  const sh = getSheet_(SHEET_DOC, HEAD_DOC);
  const last = sh.getLastRow();
  if(last >= 2 && email){
    const v = sh.getRange(2, 1, last - 1, HEAD_DOC.length).getValues();
    for(const r of v){
      if(String(r[0]).toLowerCase() !== email) continue;
      out.docs[String(r[2])] = {
        name : String(r[1] || ''),
        title: String(r[3] || ''),
        at   : r[5] ? new Date(r[5]).toISOString() : '',
        body : String(r[6] || '')
      };
    }
  }
  return out;
}

/** 書いた 原稿を 保存します（かだい 1つに つき 1行）。 */
function gySaveDoc(kadaiId, doc){
  const email = currentEmail_();
  if(!email) throw new Error('だれが つかっているか わかりません。学校の アカウントで ひらいて ください。');
  if(!kadaiId) throw new Error('かだいが わかりません。');
  doc = doc || {};

  const sh  = getSheet_(SHEET_DOC, HEAD_DOC);
  const row = [ email, String(doc.name || ''), String(kadaiId), String(doc.title || ''),
                Number(doc.chars || 0), new Date(), String(doc.body || '') ];
  const at  = findDocRow_(sh, email, String(kadaiId));
  if(at) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else   sh.appendRow(row);
  return true;
}

/** かだい（原稿用紙の きまり）を 保存します。先生だけ。 */
function gySaveKadai(list){
  const email = currentEmail_();
  if(!isTeacher_(email)) throw new Error('かだいを かえられるのは 先生だけです。');
  const kd = getSheet_(SHEET_KADAI, ['かだい（さわらないで ください）']);
  kd.getRange(2, 1).setValue(JSON.stringify(list));
  return true;
}
