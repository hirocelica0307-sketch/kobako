/* ==========================================================================
   所見メモ作成 ─ サーバー側（Google Apps Script）
   --------------------------------------------------------------------------
   このスクリプトは1つのスプレッドシートに結び付いています。
   スプレッドシート1つ ＝ 1学年分（1年度）です。

   シート構成（なければ自動で作ります）
     設定       … 年度・学年・人数・学期・今回書く種類・保存番号
     所見データ … 学期 × 出席番号 の1行ずつ。メモと所見文。
     案         … Claude が作った案（採用しなかった案も残す）
     記録メモ帳 … 学期ごとの自由メモ
     書き出し_… … 「書き出しシートに出す」を押したときに作られる

   ※ 児童の氏名は保存しません。出席番号だけで扱います。

   保存のしくみ
     画面は、いま持っている「保存番号」を添えて保存を頼みます。
     シートの保存番号と違えば（＝ほかの端末・タブが先に保存していれば）、
     上書きせずに「食い違い」を返します。画面は、読み込み直すか、
     この画面の内容で上書きするかを先生にたずねます。
   ========================================================================== */

var SHEET_SETTING = '設定';
var SHEET_DATA    = '所見データ';
var SHEET_CAND    = '案';
var SHEET_STOCK   = '記録メモ帳';

var CAND_HEADERS = ['学期', '出席番号', '種別', '案', '採用', '本文', '工夫した点'];

/* メモ欄と所見欄の並び。index.html の memoFields / types と対応します */
var MEMO_KEYS  = ['subject', 'life', 'event', 'growth', 'doutoku', 'sogo', 'gaikokugo', 'free'];
var MEMO_HEAD  = ['教科での姿', '生活・当番・係', '行事・特別活動', '伸びた点・期待',
                  '道徳', '総合的な学習', '外国語', 'その他メモ'];
var DRAFT_KEYS = ['shoken', 'doutoku', 'sogo', 'gaikokugo'];
var DRAFT_HEAD = ['所見', '道徳所見', '総合的な学習の記録', '外国語活動の記録'];

var HEADERS = ['学期', '出席番号'].concat(MEMO_HEAD).concat(DRAFT_HEAD).concat(['更新']);

/* 出席番号の上限。人数を減らしても、この番号までのデータは消さずに残す */
var MAX_NO = 45;

/* -------------------------------------------------------------------------
   Webアプリとして開いたときの入口
   ------------------------------------------------------------------------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('画面')
    .setTitle('所見メモ作成')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* スプレッドシートを開いたときのメニュー */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('所見')
    .addItem('所見作成の画面を開く', 'showSidebarHint')
    .addItem('シートを準備する（足りないシートを作る）', 'setupSheets')
    .addToUi();
}

function showSidebarHint() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p style="font-family:sans-serif;line-height:1.8">' +
      '<a href="' + url + '" target="_blank">所見作成の画面を開く</a></p>'
    : '<p style="font-family:sans-serif;line-height:1.8">' +
      'まだデプロイされていません。<br>エディタの「デプロイ」→「新しいデプロイ」→種類「ウェブアプリ」で公開してください。</p>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(360).setHeight(120), '所見作成');
}

/* -------------------------------------------------------------------------
   シートの準備
   ------------------------------------------------------------------------- */
function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  var st = ss.getSheetByName(SHEET_SETTING);
  if (!st) {
    st = ss.insertSheet(SHEET_SETTING, 0);
    st.getRange('A1:B4').setValues([
      ['項目', '値'],
      ['年度', 'R7'],
      ['学年', '3'],
      ['人数', 32]
    ]);
    st.getRange('A1:B1').setFontWeight('bold');
    st.setColumnWidth(1, 120);
    st.getRange('A10').setValue('※ この画面で直接直しても、所見作成の画面を開き直せば反映されます。');
  }

  var dt = ss.getSheetByName(SHEET_DATA);
  if (!dt) {
    dt = ss.insertSheet(SHEET_DATA, 1);
    dt.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    dt.setFrozenRows(1);
    dt.setColumnWidth(1, 55);
    dt.setColumnWidth(2, 75);
    for (var i = 0; i < MEMO_HEAD.length; i++) dt.setColumnWidth(3 + i, 200);
    for (var j = 0; j < DRAFT_HEAD.length; j++) dt.setColumnWidth(3 + MEMO_HEAD.length + j, 320);
  }

  var cd = ss.getSheetByName(SHEET_CAND);
  if (!cd) {
    cd = ss.insertSheet(SHEET_CAND, 2);
    cd.getRange(1, 1, 1, CAND_HEADERS.length).setValues([CAND_HEADERS]).setFontWeight('bold');
    cd.setFrozenRows(1);
    cd.setColumnWidth(1, 55);   // 学期
    cd.setColumnWidth(2, 75);   // 出席番号
    cd.setColumnWidth(3, 150);  // 種別
    cd.setColumnWidth(4, 50);   // 案
    cd.setColumnWidth(5, 55);   // 採用
    cd.setColumnWidth(6, 420);  // 本文
    cd.setColumnWidth(7, 300);  // 工夫した点
  }

  var sk = ss.getSheetByName(SHEET_STOCK);
  if (!sk) {
    sk = ss.insertSheet(SHEET_STOCK, 3);
    sk.getRange(1, 1, 1, 2).setValues([['学期', 'メモ']]).setFontWeight('bold');
    sk.setFrozenRows(1);
    sk.setColumnWidth(1, 60);
    sk.setColumnWidth(2, 700);
    sk.getRange(2, 1, 3, 1).setValues([['1'], ['2'], ['3']]);
    sk.getRange(2, 2, 3, 1).setWrap(true);
  }
  return true;
}

/* 種別キー（shoken など）と、シートに書く見出し（所見 など）を行き来する */
function draftLabel(key) {
  var i = DRAFT_KEYS.indexOf(key);
  return i < 0 ? key : DRAFT_HEAD[i];
}
function draftKey(label) {
  var i = DRAFT_HEAD.indexOf(String(label).trim());
  return i < 0 ? String(label).trim() : DRAFT_KEYS[i];
}

/* 設定シートを {項目: 値} で読む */
function readConf_(st) {
  var conf = {};
  var last = st.getLastRow();
  if (last < 2) return conf;
  var cv = st.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < cv.length; i++) {
    var k = String(cv[i][0]).trim();
    if (k && !(k in conf)) conf[k] = cv[i][1];
  }
  return conf;
}
function revOf_(conf) { return Number(conf['保存番号'] || 0) || 0; }

/* -------------------------------------------------------------------------
   読み込み
   index.html が持っている状態オブジェクトと同じ形で返します。
     { version, rev, meta:{year,grade,count}, term, write:{"1":[…],…},
       data:{ "1":{no:rec}, ... }, stock:{…} }
   ------------------------------------------------------------------------- */
function getState() {
  setupSheets();
  var ss = SpreadsheetApp.getActive();
  var st = ss.getSheetByName(SHEET_SETTING);
  var dt = ss.getSheetByName(SHEET_DATA);

  var conf = readConf_(st);

  var write = null;
  try { write = conf['書く種類'] ? JSON.parse(String(conf['書く種類'])) : null; } catch (e) { write = null; }

  var state = {
    version: 2,
    rev: revOf_(conf),
    meta: {
      year:  String(conf['年度'] || 'R7'),
      grade: String(conf['学年'] || '3'),
      count: Number(conf['人数'] || 32)
    },
    term: String(conf['学期'] || '2'),
    write: write,
    data: { '1': {}, '2': {}, '3': {} },
    stock: { '1': '', '2': '', '3': '' }
  };

  /* --- 記録メモ帳 --- */
  var sk = ss.getSheetByName(SHEET_STOCK);
  var sklast = sk.getLastRow();
  if (sklast > 1) {
    var skrows = sk.getRange(2, 1, sklast - 1, 2).getValues();
    for (var s = 0; s < skrows.length; s++) {
      var stTerm = String(skrows[s][0]).trim();
      if (stTerm) state.stock[stTerm] = String(skrows[s][1] || '');
    }
  }

  var last = dt.getLastRow();
  if (last > 1) {
    var rows = dt.getRange(2, 1, last - 1, HEADERS.length).getValues();
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var term = String(row[0]).trim();
      var no   = Number(row[1]);
      if (!term || !no) continue;
      if (!state.data[term]) state.data[term] = {};

      var recd = { memos: {}, drafts: {}, cands: {}, pick: {}, done: {} };
      for (var m = 0; m < MEMO_KEYS.length; m++) {
        var mv = String(row[2 + m] || '');
        if (mv) recd.memos[MEMO_KEYS[m]] = mv;
      }
      for (var d = 0; d < DRAFT_KEYS.length; d++) {
        var dv = String(row[2 + MEMO_KEYS.length + d] || '');
        if (dv) recd.drafts[DRAFT_KEYS[d]] = dv;
      }
      state.data[term][no] = recd;
    }
  }

  /* --- 案 --- */
  var cd = ss.getSheetByName(SHEET_CAND);
  var clast = cd.getLastRow();
  if (clast > 1) {
    var crows = cd.getRange(2, 1, clast - 1, CAND_HEADERS.length).getValues();
    for (var i = 0; i < crows.length; i++) {
      var cr = crows[i];
      var cterm = String(cr[0]).trim();
      var cno   = Number(cr[1]);
      var ckey  = draftKey(cr[2]);
      var cidx  = Number(cr[3]) - 1;
      var used  = String(cr[4]).trim();
      var ctext = String(cr[5] || '');
      var cnote = String(cr[6] || '');
      if (!cterm || !cno || !ckey || cidx < 0 || !ctext) continue;

      if (!state.data[cterm]) state.data[cterm] = {};
      var target = state.data[cterm][cno];
      if (!target) {
        target = { memos: {}, drafts: {}, cands: {}, pick: {}, done: {} };
        state.data[cterm][cno] = target;
      }
      if (!target.cands) target.cands = {};
      if (!target.pick)  target.pick  = {};
      if (!target.cands[ckey]) target.cands[ckey] = [];
      target.cands[ckey][cidx] = { text: ctext, note: cnote };
      if (used === '○' || used === '〇') target.pick[ckey] = cidx;
    }
    /* 抜け番があっても配列が穴あきにならないよう詰める */
    var terms2 = Object.keys(state.data);
    for (var t2 = 0; t2 < terms2.length; t2++) {
      var bucket2 = state.data[terms2[t2]];
      var nos = Object.keys(bucket2);
      for (var n2 = 0; n2 < nos.length; n2++) {
        var rr = bucket2[nos[n2]];
        if (!rr.cands) continue;
        var keys = Object.keys(rr.cands);
        for (var k2 = 0; k2 < keys.length; k2++) {
          var before = rr.cands[keys[k2]];
          var picked = rr.pick[keys[k2]];
          var compact = [], newPick = 0;
          for (var b = 0; b < before.length; b++) {
            if (!before[b]) continue;
            if (b === picked) newPick = compact.length;
            compact.push(before[b]);
          }
          rr.cands[keys[k2]] = compact;
          rr.pick[keys[k2]]  = newPick;
        }
      }
    }
  }
  return state;
}

/* -------------------------------------------------------------------------
   保存
   行数は多くても 3学期 × 45人 = 135 行なので、毎回まとめて書き直します。
   （部分更新より、途中で壊れる余地がなく確実です）

   baseRev … 画面が読み込んだとき（または前回保存したとき）の保存番号
   force   … true なら、食い違っていても上書きする（先生が選んだときだけ）
   戻り値   … { ok:true, rev } または { conflict:true, rev }
   ------------------------------------------------------------------------- */
function putState(state, baseRev, force) {
  if (!state || !state.data) throw new Error('保存するデータがありません');
  setupSheets();

  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();

    /* --- 食い違いの確認（ほかの端末・タブが先に保存していないか） --- */
    var st = ss.getSheetByName(SHEET_SETTING);
    var cur = revOf_(readConf_(st));
    if (!force && Number(baseRev || 0) !== cur) {
      return { conflict: true, rev: cur };
    }
    var next = cur + 1;

    /* --- 設定 --- */
    st.getRange('A1:B7').setNumberFormat('@').setValues([
      ['項目', '値'],
      ['年度', String(state.meta.year)],
      ['学年', String(state.meta.grade)],
      ['人数', String(Number(state.meta.count))],
      ['学期', String(state.term)],
      ['書く種類', JSON.stringify(state.write || {})],
      ['保存番号', String(next)]
    ]);
    st.getRange('A1:B1').setFontWeight('bold');

    /* --- 所見データ ---
       人数より大きい番号のデータも、消さずに書き残す（人数を戻せばまた出てくる） */
    var now  = new Date();
    var out  = [];
    var cout = [];
    var terms = ['1', '2', '3'];
    for (var t = 0; t < terms.length; t++) {
      var term = terms[t];
      var bucket = state.data[term] || {};
      for (var no = 1; no <= MAX_NO; no++) {
        var recd = bucket[no] || bucket[String(no)];
        if (!recd) continue;
        var memos  = recd.memos  || {};
        var drafts = recd.drafts || {};
        var cands  = recd.cands  || {};
        var pick   = recd.pick   || {};
        var any = false;
        var line = [term, String(no)];
        for (var m = 0; m < MEMO_KEYS.length; m++) {
          var mv = memos[MEMO_KEYS[m]] || '';
          if (mv) any = true;
          line.push(String(mv));
        }
        for (var d = 0; d < DRAFT_KEYS.length; d++) {
          var dv = drafts[DRAFT_KEYS[d]] || '';
          if (dv) any = true;
          line.push(String(dv));
        }
        line.push(now);
        if (any) out.push(line);

        /* 採用しなかった案も含めて全部残す */
        for (var d2 = 0; d2 < DRAFT_KEYS.length; d2++) {
          var key = DRAFT_KEYS[d2];
          var list = cands[key] || [];
          var sel  = (typeof pick[key] === 'number') ? pick[key] : 0;
          for (var c = 0; c < list.length; c++) {
            if (!list[c] || !list[c].text) continue;
            cout.push([term, String(no), draftLabel(key), String(c + 1),
                       c === sel ? '○' : '', String(list[c].text), String(list[c].note || '')]);
          }
        }
      }
    }

    /* 文字は「書式なしテキスト」で書く。「=」で始まるメモが数式に、
       「10/5」のようなメモが日付に化けるのを防ぐ */
    var dt = ss.getSheetByName(SHEET_DATA);
    var last = dt.getLastRow();
    if (last > 1) dt.getRange(2, 1, last - 1, HEADERS.length).clearContent();
    if (out.length) {
      dt.getRange(2, 1, out.length, HEADERS.length - 1).setNumberFormat('@');
      dt.getRange(2, 1, out.length, HEADERS.length).setValues(out);
      dt.getRange(2, HEADERS.length, out.length, 1).setNumberFormat('yyyy/MM/dd HH:mm');
    }

    var cd = ss.getSheetByName(SHEET_CAND);
    var clast = cd.getLastRow();
    if (clast > 1) cd.getRange(2, 1, clast - 1, CAND_HEADERS.length).clearContent();
    if (cout.length) {
      cd.getRange(2, 1, cout.length, CAND_HEADERS.length).setNumberFormat('@').setValues(cout);
    }

    /* --- 記録メモ帳 --- */
    var stock = state.stock || {};
    var sk = ss.getSheetByName(SHEET_STOCK);
    sk.getRange(2, 1, 3, 2).setNumberFormat('@').setValues([
      ['1', String(stock['1'] || '')],
      ['2', String(stock['2'] || '')],
      ['3', String(stock['3'] || '')]
    ]);

    SpreadsheetApp.flush();
    return { ok: true, rev: next };
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------------------
   書き出しシート
   rows は [[番号, 本文, 字数], ...]
   ------------------------------------------------------------------------- */
function exportToSheet(sheetName, label, rows) {
  var ss = SpreadsheetApp.getActive();
  var name = ('書き出し_' + sheetName).slice(0, 90);
  var sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name);

  var values = [['出席番号', label, '字数']].concat(rows);
  sh.getRange(2, 2, Math.max(1, values.length - 1), 1).setNumberFormat('@');
  sh.getRange(1, 1, values.length, 3).setValues(values);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 80);
  sh.setColumnWidth(2, 520);
  sh.setColumnWidth(3, 70);
  sh.getRange(2, 2, Math.max(1, values.length - 1), 1).setWrap(true);
  ss.setActiveSheet(sh);
  return name;
}

// ===== ここが最終行です(貼り付け確認用: SHOKEN-GS-END) =====
