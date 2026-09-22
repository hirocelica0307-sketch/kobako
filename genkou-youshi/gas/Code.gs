/**
 * げんこうようし  ―  Google Apps Script（サーバー側）
 *
 * 児童が 学校の Google アカウントで ウェブアプリを ひらくと、
 * そのメールアドレスを キーに して 書いた 原稿を スプレッドシートに 保存します。
 * 端末が かわっても、電源を 切っても、前回の つづきから 書けます。
 *
 * ・児童は スプレッドシートを 直接 見ることは できません
 *   （ウェブアプリを「自分（先生）として実行」で デプロイするため）
 * ・原稿用紙の「きまり」を 書きかえられるのは 先生だけです
 * ・1人の 児童の 原稿は「だいめい」ごとに 1行です。
 *   だいめいを かえると 別の 行に なるので、前に 書いた ものは のこります。
 *
 * くわしい 手順は docs/SETUP-GAS.md を 見てください。
 */

const SHEET_DOC = 'げんこう';
const SHEET_SET = 'きまり';

const HEAD_DOC = ['メールアドレス','なまえ','だいめい','字数','まい数','さいごに 書いた 日時','本文'];

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

/* ---------- 行を さがす（メールアドレス ＋ だいめい）---------- */
function findDocRow_(sh, email, title){
  const last = sh.getLastRow();
  if(last < 2) return 0;
  const v = sh.getRange(2, 1, last - 1, 3).getValues();
  for(let i = 0; i < v.length; i++){
    if(String(v[i][0]).toLowerCase() === email && String(v[i][2]) === title) return i + 2;
  }
  return 0;
}

/* ---------- クライアントから よばれる ---------- */

/** はじめに 1回。先生が きめた きまりと、その児童が さいごに 書いた 原稿を かえします。 */
function gyLoad(){
  const email = currentEmail_();
  const out = { user: email, isTeacher: isTeacher_(email), settings: null, doc: null };

  const kd  = getSheet_(SHEET_SET, ['きまり（さわらないで ください）']);
  const raw = kd.getRange(2, 1).getValue();
  if(raw){
    try{ out.settings = JSON.parse(raw); }catch(e){ out.settings = null; }
  }

  const sh   = getSheet_(SHEET_DOC, HEAD_DOC);
  const last = sh.getLastRow();
  if(last >= 2 && email){
    const v = sh.getRange(2, 1, last - 1, HEAD_DOC.length).getValues();
    let newest = null;
    for(const r of v){
      if(String(r[0]).toLowerCase() !== email) continue;
      const at = r[5] ? new Date(r[5]).getTime() : 0;
      if(!newest || at > newest.t){
        newest = { t: at, doc: {
          name : String(r[1] || ''),
          title: String(r[2] || ''),
          chars: Number(r[3] || 0),
          pages: Number(r[4] || 1),
          at   : r[5] ? new Date(r[5]).toISOString() : '',
          body : String(r[6] || '')
        } };
      }
    }
    if(newest) out.doc = newest.doc;
  }
  return out;
}

/** 書いた 原稿を 保存します（メールアドレス ＋ だいめい ごとに 1行）。 */
function gySaveDoc(doc){
  const email = currentEmail_();
  if(!email) throw new Error('だれが つかっているか わかりません。学校の アカウントで ひらいて ください。');
  doc = doc || {};

  const title = String(doc.title || '');
  const sh  = getSheet_(SHEET_DOC, HEAD_DOC);
  const row = [ email, String(doc.name || ''), title,
                Number(doc.chars || 0), Number(doc.pages || 1),
                new Date(), String(doc.body || '') ];
  const at  = findDocRow_(sh, email, title);
  if(at) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else   sh.appendRow(row);
  return true;
}

/** 原稿用紙の きまりを 保存します。先生だけ。 */
function gySaveSettings(obj){
  const email = currentEmail_();
  if(!isTeacher_(email)) throw new Error('きまりを かえられるのは 先生だけです。');
  const kd = getSheet_(SHEET_SET, ['きまり（さわらないで ください）']);
  kd.getRange(2, 1).setValue(JSON.stringify(obj));
  return true;
}
