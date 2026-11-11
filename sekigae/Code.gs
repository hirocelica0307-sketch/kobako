/**
 * 席替えアプリ — エントリポイント
 *
 * このファイルは Google Apps Script（コンテナバインド）用です。
 * スプレッドシートの「拡張機能 > Apps Script」から作成したプロジェクトに
 * src/ 以下のファイルをそのまま貼り付けて使います。
 */

const APP_TITLE = '席替えアプリ';
const PROP_SS_ID = 'SEATING_SS_ID';

/** スプレッドシートを開いたときに「席替え」メニューを追加する */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('席替え')
    .addItem('① 初期設定（シートを作る）', 'setupApp')
    .addItem('② Web アプリの URL を表示', 'showWebAppUrl')
    .addToUi();
}

/**
 * 初期設定。必要なシートを作り、スプレッドシート ID をスクリプトプロパティに保存する。
 * Web アプリとして動くときは getActiveSpreadsheet() が使えないことがあるため、
 * ここで保存した ID を openById() で開く。
 */
function setupApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty(PROP_SS_ID, ss.getId());
  ensureAllSheets_(ss);
  SpreadsheetApp.getUi().alert(
    '初期設定が完了しました。\n\n' +
    '「設定」「名簿」「配慮_距離」「履歴」の 4 つのシートを用意しました。\n' +
    '次にメニューの「② Web アプリの URL を表示」で URL を確認してください。'
  );
}

function showWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert(
      'まだデプロイされていません。\n\n' +
      'Apps Script エディタ右上の「デプロイ > 新しいデプロイ」から\n' +
      '種類「ウェブアプリ」、次のユーザーとして実行「自分」、\n' +
      'アクセスできるユーザー「自分のみ」を選んでデプロイしてください。'
    );
    return;
  }
  ui.alert('Web アプリの URL:\n\n' + url + '\n\nこの URL をブックマークしてお使いください。');
}

/** Web アプリの入口 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** index.html から他の HTML ファイルを取り込むためのヘルパー */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ------------------------------------------------------------------ *
 * クライアント（ブラウザ）から呼ばれる API
 * すべて { ok: true, data } / { ok: false, error } の形で返す。
 * ------------------------------------------------------------------ */

/** 画面表示に必要なデータを一括で読み込む */
function apiLoadAll() {
  return wrap_(function () {
    const ss = getSpreadsheet_();
    ensureAllSheets_(ss);
    return {
      settings: readSettings_(ss),
      roster: readRoster_(ss),
      separations: readSeparations_(ss),
      history: readHistory_(ss, HISTORY_LIMIT),
      spreadsheetUrl: ss.getUrl()
    };
  });
}

/** 設定・名簿・配慮事項をまとめて保存する（席替え結果は保存しない） */
function apiSaveMasters(payload) {
  return wrap_(function () {
    const ss = getSpreadsheet_();
    ensureAllSheets_(ss);
    if (payload.settings) writeSettings_(ss, payload.settings);
    if (payload.roster) writeRoster_(ss, payload.roster);
    if (payload.separations) writeSeparations_(ss, payload.separations, payload.roster);
    return { savedAt: nowString_() };
  });
}

/**
 * 確定した座席表を書き出す。
 * ・履歴シートに 1 行追加（payload.overwriteId があれば、その行を書き換える）
 * ・「席替え_YYYY-MM-DD」シートに人が読める座席表を作成
 * ・あわせて設定・名簿・配慮事項も保存する
 */
function apiCommitSeating(payload) {
  return wrap_(function () {
    const ss = getSpreadsheet_();
    ensureAllSheets_(ss);
    if (payload.settings) writeSettings_(ss, payload.settings);
    if (payload.roster) writeRoster_(ss, payload.roster);
    if (payload.separations) writeSeparations_(ss, payload.separations, payload.roster);

    const st = payload.settings || {};
    const overwriteId = payload.overwriteId || '';
    let overwritten = false;

    // 上書きのときは、その記録が前に作った座席表シートを片づけてから作り直す
    if (overwriteId) {
      deleteChartSheet_(ss, historySheetName_(ss, overwriteId));
    }
    const sheetName = writeSeatingChartSheet_(ss, payload);

    const entry = {
      label: payload.label || '',
      mode: payload.mode || '',
      rows: st.rows,
      cols: st.cols,
      sheetName: sheetName,
      assign: payload.assign || {},
      roster: payload.roster || []
    };

    if (overwriteId) overwritten = updateHistory_(ss, overwriteId, entry);
    if (!overwritten) appendHistory_(ss, entry);

    return {
      savedAt: nowString_(),
      sheetName: sheetName,
      overwritten: overwritten,
      history: readHistory_(ss, HISTORY_LIMIT)
    };
  });
}

/** 履歴の 1 件を削除する（その記録が作った座席表シートも一緒に消す） */
function apiDeleteHistory(historyId) {
  return wrap_(function () {
    const ss = getSpreadsheet_();
    ensureAllSheets_(ss);
    deleteHistoryRow_(ss, historyId);
    return { history: readHistory_(ss, HISTORY_LIMIT) };
  });
}

/* ------------------------------------------------------------------ *
 * 内部ヘルパー
 * ------------------------------------------------------------------ */

/** 例外を握って必ず {ok,...} を返す。クライアント側のエラー処理を単純にするため。 */
function wrap_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

/**
 * 対象のスプレッドシートを取得する。
 * Web アプリ実行時は getActiveSpreadsheet() が null になるため、
 * 初期設定で保存した ID を優先して使う。
 */
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SS_ID);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // ID が古い場合は下のフォールバックへ
    }
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    PropertiesService.getScriptProperties().setProperty(PROP_SS_ID, active.getId());
    return active;
  }
  throw new Error(
    'スプレッドシートが見つかりません。スプレッドシートを開き、メニューの「席替え > ① 初期設定（シートを作る）」を先に実行してください。'
  );
}

function nowString_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}
