// 週案ノート
//
// 学校の先生が、公務のためにご自由にお使いいただけます。
// ・そのまま使う、同僚に渡す、学校内で共有する … いずれも自由です
// ・使いやすいように書きかえていただいてもかまいません
// ・作者への連絡や許諾はいりません
//
// お願いとおことわり
// ・販売など、営利を目的とした利用はご遠慮ください
// ・このソフトは無保証です。利用によって生じた損害の責任は負いかねます
// ・児童生徒の情報を扱います。各校の規定に従ってお使いください

const ATTACHMENT_FOLDER_NAME = "週案アプリ_添付ファイル";
const DAILY_FOLDER_NAME = "週案アプリ_毎日の控え";

const DATA_FILE_ID_KEY = "WEEKLY_PLAN_FILE_ID";
const BACKUP_FILE_ID_KEY = "WEEKLY_PLAN_BACKUP_FILE_ID";
const ATTACHMENT_FOLDER_ID_KEY = "WEEKLY_PLAN_ATTACH_FOLDER_ID";
const DAILY_FOLDER_ID_KEY = "WEEKLY_PLAN_DAILY_FOLDER_ID";
const DAILY_DATE_KEY = "WEEKLY_PLAN_DAILY_DATE";
const REV_KEY = "WEEKLY_PLAN_REV";

const DAILY_KEEP = 14;   // 毎日の控えを何日分残すか
const SHRINK_MIN = 20;   // 件数がこれより少ないうちは、大きく減っても確認しない

// 画面の部品（index から読み込む）
const INCLUDE_FILES = ['style', 'help', 'script'];

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('週案ノート')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  if (INCLUDE_FILES.indexOf(name) === -1) throw new Error("読み込めないファイルです: " + name);
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// ===== 利用者・ファイル名・ファイルIDの管理 =====

function getActiveEmail_() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    // デプロイ設定が「実行するユーザー: 自分」だとここに来ることがある。
    // 全員のデータが1ファイルに混ざるのを防ぐため、進めずに止める。
    throw new Error(
      "利用者のアカウントを取得できませんでした。\n" +
      "デプロイの設定で「次のユーザーとして実行: ウェブアプリケーションにアクセスしているユーザー」" +
      "を選び、再デプロイしてください。"
    );
  }
  return email;
}

function getUserDataFileName_() {
  return "weekly_plan_data_" + getActiveEmail_().replace(/[@.]/g, '_') + ".json";
}

function getBackupFileName_() {
  return getUserDataFileName_().replace(/\.json$/, "_bak.json");
}

function dailyPrefix_() {
  return getUserDataFileName_().replace(/\.json$/, "_daily_");
}

// 本人が持ち主のファイル・フォルダか。
// 同じ名前のものを人から共有されていても、そちらを使わないようにするため。
function isMine_(item) {
  try {
    const owner = item.getOwner();
    return !!owner && owner.getEmail() === getActiveEmail_();
  } catch (e) {
    return false;
  }
}

// 同名ファイルが複数あってもぶれないよう、IDを覚えて使う
function findDataFile_(fileName, propKey) {
  const props = PropertiesService.getUserProperties();
  const savedId = props.getProperty(propKey);
  if (savedId) {
    try {
      const file = DriveApp.getFileById(savedId);
      if (!file.isTrashed()) return file;
    } catch (e) {
      // ID が無効になっていた場合は名前で探し直す
    }
  }
  const files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    props.setProperty(propKey, file.getId());
    return file;
  }
  return null;
}

function createDataFile_(fileName, content, propKey) {
  const file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);
  PropertiesService.getUserProperties().setProperty(propKey, file.getId());
  return file;
}

// 本人のフォルダだけを使う。IDを覚えておき、名前で探すときも持ち主を確かめる。
// create が false のときは、見つからなければ null を返す。
function getOwnedFolder_(folderName, propKey, create) {
  const props = PropertiesService.getUserProperties();
  const savedId = props.getProperty(propKey);
  if (savedId) {
    try {
      const folder = DriveApp.getFolderById(savedId);
      if (!folder.isTrashed() && isMine_(folder)) return folder;
    } catch (e) {
      // ID が無効になっていた場合は名前で探し直す
    }
  }
  const folders = DriveApp.getFoldersByName(folderName);
  while (folders.hasNext()) {
    const folder = folders.next();
    if (!folder.isTrashed() && isMine_(folder)) {
      props.setProperty(propKey, folder.getId());
      return folder;
    }
  }
  if (!create) return null;
  const created = DriveApp.createFolder(folderName);
  props.setProperty(propKey, created.getId());
  return created;
}

// ===== 読み込み =====

// rev は「これまでに何回保存したか」の番号。
// 学校と自宅など複数の端末で同時に開いたとき、後から保存した側が
// 相手の内容を黙って消してしまうのを防ぐために使う。
function normalizeRev_(v) {
  const n = Number(v);
  return (isFinite(n) && n >= 0) ? Math.floor(n) : 0;
}

// rev を軽く確かめられるよう、ファイルとは別にも覚えておく
function rememberRev_(rev) {
  try {
    PropertiesService.getUserProperties().setProperty(REV_KEY, String(rev));
  } catch (e) {
    console.warn("rev を覚えられませんでした: " + e.message);
  }
}

function formatStamp_(dt) {
  try {
    return Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm");
  } catch (e) {
    return "";
  }
}

function loadDataFromServer() {
  const fileName = getUserDataFileName_();
  const file = findDataFile_(fileName, DATA_FILE_ID_KEY);
  if (file) {
    const parsed = JSON.parse(file.getBlob().getDataAsString());
    parsed.isNewUser = false;
    parsed.rev = normalizeRev_(parsed.rev);
    parsed.savedAt = formatStamp_(file.getLastUpdated());
    rememberRev_(parsed.rev);
    return parsed;
  }

  // 旧形式（固定ファイル名）のデータがあれば移行する。
  // 人から共有された同名ファイルを取り込まないよう、本人のものだけを見る。
  const legacy = DriveApp.getFilesByName("weekly_plan_data.json");
  while (legacy.hasNext()) {
    const lf = legacy.next();
    if (lf.isTrashed() || !isMine_(lf)) continue;
    const parsed = JSON.parse(lf.getBlob().getDataAsString());
    parsed.rev = normalizeRev_(parsed.rev);
    createDataFile_(fileName, JSON.stringify(parsed), DATA_FILE_ID_KEY);
    rememberRev_(parsed.rev);
    parsed.isNewUser = false;
    return parsed;
  }

  return { settings: {}, data: {}, notes: [], rev: 0, isNewUser: true };
}

// 別の端末が保存したかどうかを、ファイルを開かずに確かめる
function getServerRev() {
  const v = PropertiesService.getUserProperties().getProperty(REV_KEY);
  if (v !== null) return normalizeRev_(v);
  const file = findDataFile_(getUserDataFileName_(), DATA_FILE_ID_KEY);
  if (!file) return 0;
  try {
    const rev = normalizeRev_(JSON.parse(file.getBlob().getDataAsString()).rev);
    rememberRev_(rev);
    return rev;
  } catch (e) {
    return -1;
  }
}

// ===== 自動の控え =====

// 復元できる控えの一覧（設定画面の「自動控えから復元」用）
function listBackupsFromServer() {
  try {
    const out = [];
    const last = findDataFile_(getBackupFileName_(), BACKUP_FILE_ID_KEY);
    if (last) out.push({ id: last.getId(), kind: 'last', savedAt: formatStamp_(last.getLastUpdated()) });
    const folder = getOwnedFolder_(DAILY_FOLDER_NAME, DAILY_FOLDER_ID_KEY, false);
    if (folder) {
      listDailyFiles_(folder, dailyPrefix_()).forEach(function(x) {
        out.push({ id: x.file.getId(), kind: 'daily', date: x.date, savedAt: formatStamp_(x.file.getDateCreated()) });
      });
    }
    return out;
  } catch (e) {
    return { error: "控えの一覧を読み取れませんでした: " + e.message };
  }
}

// 控えを読み出す。id がなければ直前の控え。
// id は本人の控え（直前の控えか、毎日の控えフォルダの中）に限る。
function loadBackupFromServer(id) {
  try {
    const file = id ? findOwnedBackupFile_(id) : findDataFile_(getBackupFileName_(), BACKUP_FILE_ID_KEY);
    if (!file) return { error: "この控えは見つかりませんでした。" };
    const parsed = JSON.parse(file.getBlob().getDataAsString());
    parsed.savedAt = formatStamp_(file.getLastUpdated());
    return parsed;
  } catch (e) {
    return { error: "控えのファイルを読み取れませんでした: " + e.message };
  }
}

function findOwnedBackupFile_(id) {
  const last = findDataFile_(getBackupFileName_(), BACKUP_FILE_ID_KEY);
  if (last && last.getId() === id) return last;
  const folder = getOwnedFolder_(DAILY_FOLDER_NAME, DAILY_FOLDER_ID_KEY, false);
  if (!folder) return null;
  const list = listDailyFiles_(folder, dailyPrefix_());
  for (let i = 0; i < list.length; i++) {
    if (list[i].file.getId() === id) return list[i].file;
  }
  return null;
}

// 毎日の控えを新しい順に返す
function listDailyFiles_(folder, prefix) {
  const out = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    if (name.indexOf(prefix) !== 0 || f.isTrashed()) continue;
    const m = name.slice(prefix.length).match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (m) out.push({ file: f, date: m[1] });
  }
  out.sort(function(a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  return out;
}

// ===== 保存 =====

// baseRev には「クライアントが読み込んだときの rev」を渡す。
// サーバー側の rev と食い違っていたら、別の端末が先に保存したということなので書き込まない。
// allowShrink は、件数が大きく減る保存を本人が確かめたときだけ true にする。
function saveDataToServer(settings, data, notes, baseRev, allowShrink) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: "他のタブで保存中です。少し待ってからもう一度保存してください。" };
  }

  try {
    const fileName = getUserDataFileName_();
    const file = findDataFile_(fileName, DATA_FILE_ID_KEY);

    if (!file) {
      const firstRev = 1;
      createDataFile_(fileName,
        JSON.stringify({ settings: settings, data: data, notes: notes, rev: firstRev }),
        DATA_FILE_ID_KEY);
      rememberRev_(firstRev);
      return { ok: true, rev: firstRev };
    }

    const oldContent = file.getBlob().getDataAsString();
    let oldObj = null;
    try {
      oldObj = JSON.parse(oldContent);
    } catch (e) {
      oldObj = null;
    }

    // 別の端末が先に保存していないか確かめる。
    // ここを通さないと、学校と自宅で二重に開いたとき後から保存した側が相手の内容を消してしまう。
    const serverRev = normalizeRev_(oldObj && oldObj.rev);
    if (baseRev !== undefined && baseRev !== null && normalizeRev_(baseRev) !== serverRev) {
      return {
        ok: false,
        conflict: true,
        serverRev: serverRev,
        serverSavedAt: formatStamp_(file.getLastUpdated()),
        error: "別の端末またはタブで、より新しい内容が保存されています。"
      };
    }

    // 空データによる全消しを拒否する
    const newCount = countRecords_({ data: data, notes: notes });
    const oldCount = oldObj ? countRecords_(oldObj) : 0;
    if (oldCount > 0 && newCount === 0) {
      return {
        ok: false,
        error: "保存内容が空のため中止しました。\n保存済みのデータは残っています。ページを再読み込みしてください。"
      };
    }

    // 半分より少なくなる保存は、本人に確かめてから
    if (!allowShrink && oldCount >= SHRINK_MIN && newCount < oldCount * 0.5) {
      return {
        ok: false,
        shrink: true,
        oldCount: oldCount,
        newCount: newCount,
        error: "保存する内容の件数が大きく減っています。"
      };
    }

    // 上書き前に退避しておく（直前の1回分と、その日はじめての保存の前の分）
    saveBackupSnapshot_(oldContent);
    saveDailySnapshot_(oldContent);

    const nextRev = serverRev + 1;
    file.setContent(JSON.stringify({ settings: settings, data: data, notes: notes, rev: nextRev }));
    rememberRev_(nextRev);
    return { ok: true, rev: nextRev };

  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function countRecords_(obj) {
  if (!obj) return 0;
  const dataCount = obj.data ? Object.keys(obj.data).length : 0;
  const noteCount = (obj.notes && obj.notes.length) ? obj.notes.length : 0;
  return dataCount + noteCount;
}

function saveBackupSnapshot_(content) {
  try {
    const backupName = getBackupFileName_();
    const backup = findDataFile_(backupName, BACKUP_FILE_ID_KEY);
    if (backup) {
      backup.setContent(content);
    } else {
      createDataFile_(backupName, content, BACKUP_FILE_ID_KEY);
    }
  } catch (e) {
    // バックアップに失敗しても本体の保存は続行する
    console.warn("バックアップの作成に失敗: " + e.message);
  }
}

// その日はじめて保存する前の状態を、日付ごとに残す（DAILY_KEEP 日分）。
// 直前の控えは保存のたびに上書きされるので、消したことに気づくのが遅れると戻せない。そのための控え。
function saveDailySnapshot_(content) {
  try {
    const props = PropertiesService.getUserProperties();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (props.getProperty(DAILY_DATE_KEY) === today) return;
    const folder = getOwnedFolder_(DAILY_FOLDER_NAME, DAILY_FOLDER_ID_KEY, true);
    const prefix = dailyPrefix_();
    folder.createFile(prefix + today + ".json", content, MimeType.PLAIN_TEXT);
    props.setProperty(DAILY_DATE_KEY, today);
    listDailyFiles_(folder, prefix).slice(DAILY_KEEP).forEach(function(x) { x.file.setTrashed(true); });
  } catch (e) {
    // 控えに失敗しても本体の保存は続行する
    console.warn("毎日の控えの作成に失敗: " + e.message);
  }
}

// ===== 添付ファイル =====

function uploadFileFromForm(formObject) {
  try {
    const fileBlob = formObject.myFile;
    const folder = getOwnedFolder_(ATTACHMENT_FOLDER_NAME, ATTACHMENT_FOLDER_ID_KEY, true);
    const file = folder.createFile(fileBlob);
    // 共有設定は変更しない（本人のみ閲覧可のまま）。
    // 児童の情報を含むファイルが URL だけで公開されるのを防ぐため。
    // 学校のドメイン内で共有したい場合のみ、次の1行を有効にする:
    // file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    return { url: file.getUrl(), name: file.getName() };
  } catch (error) {
    return { error: "アップロードに失敗しました: " + error.message };
  }
}

function searchDriveFiles(keyword) {
  const result = [];
  if (!keyword || keyword.trim() === "") return result;
  try {
    // 検索式が壊れないよう引用符とバックスラッシュを退避する
    const safe = keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const files = DriveApp.searchFiles('title contains "' + safe + '" and trashed = false');
    let count = 0;
    while (files.hasNext() && count < 30) {
      const f = files.next();
      result.push({ name: f.getName(), url: f.getUrl() });
      count++;
    }
    return result;
  } catch (e) {
    return { error: "検索に失敗しました: " + e.message };
  }
}
