const APP_NAME  = '評価ノート';
const SETUP_KEY = 'hyokanote_setup_v3';   // 構成を変えたらここを上げる(上げると、次に開いたとき移行が1回走る)

const SHEET_DEFS = {
  'クラス':   ['クラスID','クラス名','年度','学期制','作成日'],
  '名簿':     ['児童ID','クラスID','出席番号','名前'],
  '教科':     ['教科ID','クラスID','教科名','表示順','A閾値','B閾値','有効'],
  '単元':     ['単元ID','クラスID','教科ID','単元名','学期','表示順'],
  '評価機会': ['機会ID','クラスID','教科ID','単元ID','機会名','種別','学期','日付','観点構成','表示順'],
  '記録':     ['キー','クラスID','機会ID','児童ID','観点','素点','メモ','更新日時','状態','満点','記録者'],
  '設定':     ['クラスID','キー','値'],
  '確定評価': ['キー','クラスID','児童ID','教科ID','観点','学期','評価','理由','更新日時','自動値'],
  '所見':     ['キー','クラスID','児童ID','学期','本文','更新日時'],
  // その教科を一緒に学習しない児童(支援学級など)。ここに入っている組み合わせは全画面から外す
  '履修除外': ['キー','クラスID','児童ID','教科ID','更新日時']
};

const PRESET_SUBJECTS = ['国語','社会','算数','理科','生活','音楽','図画工作','家庭','体育','外国語','道徳','総合'];

// IDの先頭に付ける英字。これがあるおかげでシートが数字と誤解しない
const ID_PREFIX = { 'クラス':'c', '名簿':'s', '教科':'k', '単元':'u', '評価機会':'o' };

/* ================= 合言葉(入口の鍵) =================
 * ・合言葉そのものはどこにも保存しない。変換した値(ハッシュ)だけを持つ
 * ・置き場所は非表示の「端末設定」シート(これまでの版と同じ形なので、決めた合言葉はそのまま使える)
 * ・最初の合言葉は、このスプレッドシートの持ち主のアカウントで開いたときだけ決められる
 * ・間違えた回数はアカウントごとに数える。ほかの人が何度間違えても、持ち主は締め出されない
 * ・合言葉を忘れたら、このエディタから resetPin を実行すると入口の鍵を外せる
 * ==================================================== */

const AUTH_SHEET = '端末設定';
const AUTH_HEAD  = ['項目', '値', '備考'];
const K_HASH = '端末コード';     // 実体はハッシュ
const K_SALT = '同期キー';       // 実体は混ぜ物(ソルト)
// 変換の繰り返し回数。増やすほど総当たりに強くなるが、開くのが少し遅くなる
const AUTH_ROUNDS = 1500;
const TOKEN_LIFE = 21600;        // 通行証の有効時間(秒)。使っているあいだは自動でのびる
const FAIL_LIMIT = 5;            // この回数まちがえると待ち時間
const FAIL_WAIT_MS = 5 * 60 * 1000;

// 見せかけの設定行。本物の2行は最初からこの並びの中に置いておく
const DECOY_ROWS = [
  ['用紙サイズ',  'A4',       '印刷の既定'],
  ['余白mm',     '13',       '印刷の既定'],
  ['同期キー',    '',         '同期用'],
  ['既定倍率',    '100',      '印刷の既定'],
  ['更新間隔',    '30',       '秒'],
  ['端末コード',  '',         '端末識別'],
  ['表示密度',    'standard', ''],
  ['ログ保持',    '90',       '日']
];

function authSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(AUTH_SHEET);
  if (!sh) {
    sh = ss.insertSheet(AUTH_SHEET);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
    sh.getRange(1, 1, 1, AUTH_HEAD.length).setValues([AUTH_HEAD]).setFontWeight('bold');
    sh.getRange(2, 1, DECOY_ROWS.length, 3).setValues(DECOY_ROWS);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}
// 端末設定シートを1回で読む
function authRead_() {
  const sh = authSheet_();
  const last = sh.getLastRow();
  const out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function(r) { out[String(r[0])] = String(r[1]); });
  return out;
}
function authSet_(key, val, note) {
  const sh = authSheet_();
  const last = sh.getLastRow();
  const v = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]) === key) {
      sh.getRange(i + 2, 2, 1, 2).setNumberFormat('@').setValues([[val, note || '']]);
      return;
    }
  }
  sh.getRange(last + 1, 1, 1, 3).setNumberFormat('@').setValues([[key, val, note || '']]);
}

function randHex_() { return '0123456789abcdef'.charAt(Math.floor(Math.random() * 16)); }
// keep(i) が true の位置に本体を順に置き、残りは意味のない文字で埋める(これまでの版と同じ形)
function weave_(secret, total, keep) {
  let out = '', k = 0;
  for (let i = 0; i < total; i++) out += keep(i) ? secret.charAt(k++) : randHex_();
  return out;
}
function unweave_(carrier, keep) {
  let out = '';
  for (let i = 0; i < carrier.length; i++) if (keep(i)) out += carrier.charAt(i);
  return out;
}
// 96文字のうち64文字が本体 / 64文字のうち32文字が本体
function keepHash_(i) { return i % 3 !== 1; }
function keepSalt_(i) { return i % 2 === 1; }

function toHex_(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = (bytes[i] + 256) % 256;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}
function sha_(s) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}
function pinHash_(pin, salt) {
  let v = salt + '|' + pin + '|' + APP_NAME;
  for (let i = 0; i < AUTH_ROUNDS; i++) v = sha_(v);
  return v;
}
function pinState_() {
  const a = authRead_();
  const hash = a[K_HASH] || '', salt = a[K_SALT] || '';
  return { has: !!hash && !!salt, hash: unweave_(hash, keepHash_), salt: unweave_(salt, keepSalt_) };
}

/* --- だれが開いているか --- */
function activeEmail_() { try { return String(Session.getActiveUser().getEmail() || ''); } catch (e) { return ''; } }
function ownerEmail_()  { try { return String(Session.getEffectiveUser().getEmail() || ''); } catch (e) { return ''; } }
function isOwner_() { const a = activeEmail_(); return !!a && a === ownerEmail_(); }
// 間違えた回数を数える単位。メールアドレスそのものは残さない
function whoKey_() { const a = activeEmail_(); return a ? sha_(a).slice(0, 12) : 'anon'; }

/* --- 何度も間違えたときの待ち時間(アカウントごと) --- */
function failState_(id) {
  const pr = PropertiesService.getScriptProperties();
  return { count: parseInt(pr.getProperty('auth_fail_' + id) || '0', 10),
           until: parseInt(pr.getProperty('auth_until_' + id) || '0', 10) };
}
function failAdd_(id) {
  const pr = PropertiesService.getScriptProperties();
  const c = failState_(id).count + 1;
  pr.setProperty('auth_fail_' + id, String(c));
  if (c >= FAIL_LIMIT) pr.setProperty('auth_until_' + id, String(Date.now() + FAIL_WAIT_MS));
  return c;
}
function failClear_(id) {
  const pr = PropertiesService.getScriptProperties();
  pr.deleteProperty('auth_fail_' + id);
  pr.deleteProperty('auth_until_' + id);
}
function failClearAll_() {
  const pr = PropertiesService.getScriptProperties();
  Object.keys(pr.getProperties()).forEach(function(k) {
    if (k.indexOf('auth_fail') === 0 || k.indexOf('auth_until') === 0) pr.deleteProperty(k);
  });
}
function waitLeft_(id) {
  const left = failState_(id).until - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}
function failMessage_(c) {
  const left = FAIL_LIMIT - c;
  return left > 0 ? '合言葉がちがいます(あと' + left + '回)' : '間違いが続いたため5分間お待ちください';
}

/* --- 通行証。合言葉を変えると、それまでの通行証はすべて使えなくなる --- */
function pinGen_() { return PropertiesService.getScriptProperties().getProperty('pin_gen') || '0'; }
function issueToken_(gen) {
  const t = Utilities.getUuid();
  CacheService.getScriptCache().put('tk_' + t, String(gen), TOKEN_LIFE);
  return t;
}
function checkToken_(t, gen) {
  if (!t) throw new Error('__AUTH__');
  const cache = CacheService.getScriptCache();
  const k = 'tk_' + String(t);
  if (cache.get(k) !== String(gen)) throw new Error('__AUTH__');
  cache.put(k, String(gen), TOKEN_LIFE);   // 使っているあいだは期限をのばす
}

// 最初の合言葉を決めてよいか(持ち主か、エディタから allowPinSetup を実行した直後)
function canFirstSetup_() {
  if (isOwner_()) return true;
  const until = parseInt(PropertiesService.getScriptProperties().getProperty('pin_setup_open') || '0', 10);
  return until > Date.now();
}

/* --- クライアントから呼ぶ --- */
function authState_() {
  const has = pinState_().has;
  return { hasPin: has, wait: waitLeft_(whoKey_()), canSetup: has || canFirstSetup_() };
}
function login_(p) {
  const id = whoKey_();
  const w = waitLeft_(id);
  if (w > 0) throw new Error('間違いが続いたため、あと' + w + '秒お待ちください');
  const ps = pinState_();
  if (!ps.has) throw new Error('合言葉がまだ設定されていません');
  if (pinHash_(String(p.pin || ''), ps.salt) !== ps.hash) throw new Error(failMessage_(failAdd_(id)));
  failClear_(id);
  return { token: issueToken_(pinGen_()) };
}
function setPin_(p, token) {
  const pin = String(p.newPin || '');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('合言葉は数字4〜6桁で決めてください');
  const id = whoKey_();
  const ps = pinState_();
  if (ps.has) {
    // 変更するときは、中に入っていること(通行証)と、今の合言葉の両方を確かめる
    checkToken_(token, pinGen_());
    const w = waitLeft_(id);
    if (w > 0) throw new Error('間違いが続いたため、あと' + w + '秒お待ちください');
    if (pinHash_(String(p.oldPin || ''), ps.salt) !== ps.hash) {
      const c = failAdd_(id);
      throw new Error(FAIL_LIMIT - c > 0 ? '今の合言葉がちがいます(あと' + (FAIL_LIMIT - c) + '回)' : failMessage_(c));
    }
  } else if (!canFirstSetup_()) {
    throw new Error('最初の合言葉は、このスプレッドシートの持ち主のGoogleアカウントで開いて決めてください。' +
      '持ち主のアカウントでも決められないときは、Apps Script のエディタで allowPinSetup を実行してから、15分以内にもう一度開いてください。');
  }
  const salt = weave_(sha_(Utilities.getUuid()).slice(0, 32), 64, keepSalt_);
  const realSalt = unweave_(salt, keepSalt_);
  authSet_(K_SALT, salt, '同期用');
  authSet_(K_HASH, weave_(pinHash_(pin, realSalt), 96, keepHash_), '端末識別');
  const pr = PropertiesService.getScriptProperties();
  const gen = String((parseInt(pinGen_(), 10) || 0) + 1);
  pr.setProperty('pin_gen', gen);
  pr.deleteProperty('pin_setup_open');
  failClear_(id);
  return { token: issueToken_(gen) };
}

/**
 * 合言葉を忘れたとき、このエディタから実行してください。
 * 実行後に持ち主のアカウントでアプリを開くと、合言葉を決め直す画面が出ます(記録は消えません)。
 */
function resetPin() {
  authSet_(K_HASH, '', '端末識別');
  authSet_(K_SALT, '', '同期用');
  failClearAll_();
  const pr = PropertiesService.getScriptProperties();
  pr.setProperty('pin_gen', String((parseInt(pinGen_(), 10) || 0) + 1));
  SpreadsheetApp.getActiveSpreadsheet().toast('合言葉を外しました。持ち主のアカウントでアプリを開いて決め直してください。', APP_NAME, 8);
}

/**
 * 持ち主のアカウントで開いても「最初の合言葉」が決められないときだけ、エディタから実行してください。
 * 15分のあいだ、アプリの画面から合言葉を決められるようになります。
 */
function allowPinSetup() {
  PropertiesService.getScriptProperties().setProperty('pin_setup_open', String(Date.now() + 15 * 60 * 1000));
  SpreadsheetApp.getActiveSpreadsheet().toast('15分のあいだ、アプリから合言葉を決められます。', APP_NAME, 8);
}

/* ================= 基本 ================= */

function doGet() {
  ensureSetup_();
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sh_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function id_(kind) {
  const p = ID_PREFIX[kind] || 'x';
  return p + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}

// シートの値を文字列にそろえる(日付になってしまっている値は年月日に)
function cellStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function blankRow_(w) { const r = []; for (let i = 0; i < w; i++) r.push(''); return r; }

/* ================= セットアップと移行 ================= */

// 必要なシート・見出し・書式をそろえ、古い形式のデータを新しい形式へ移す。
// スプレッドシートをコピーするとスクリプトプロパティは引き継がれないため、
// 「シートは既にある」場合でも書式と移行は必ず通す。
function ensureSetup_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(SETUP_KEY) === '1') return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props.getProperty(SETUP_KEY) === '1') return;   // 待っている間に他が終えた場合
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(SHEET_DEFS).forEach(function(name) {
      const head = SHEET_DEFS[name];
      let sh = ss.getSheetByName(name);
      if (!sh) {
        try { sh = ss.insertSheet(name); }
        catch (e) { sh = ss.getSheetByName(name); if (!sh) throw e; }
      }
      if (sh.getMaxColumns() < head.length) {
        sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
      }
      // 全体を文字列書式に。コピーで作られたファイルでもここを必ず通す
      sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      sh.setFrozenRows(1);
    });
    migrate_();
    const auth = authSheet_();   // 合言葉の置き場所(非表示)
    try { if (!auth.isSheetHidden()) auth.hideSheet(); } catch (e) {}
    props.setProperty(SETUP_KEY, '1');
  } finally {
    lock.releaseLock();
  }
}

// 旧形式からの引っ越し。何度走っても同じ結果になるように書いてある
function migrate_() {
  // 1) 記録: 素点に入っていた「欠」を状態列へ移し、満点を埋める
  const oppMax = {};   // 機会ID|面ID -> 満点
  rows_('評価機会').forEach(function(o) {
    let ks = [];
    try { ks = JSON.parse(o['観点構成']) || []; } catch (e) {}
    ks.forEach(function(kk) { oppMax[o['機会ID'] + '|' + (kk.id || kk.k)] = String(kk.max); });
  });
  const recSh = sh_('記録');
  const head = SHEET_DEFS['記録'];
  const last = recSh.getLastRow();
  if (last >= 2) {
    const w = head.length;
    const rng = recSh.getRange(2, 1, last - 1, w);
    const v = rng.getValues();
    let touched = false;
    for (let i = 0; i < v.length; i++) {
      if (String(v[i][0]) === '') continue;
      const raw = String(v[i][5]);
      if (raw === '欠' || raw === '欠席') { v[i][5] = ''; v[i][8] = '欠'; touched = true; }
      if (String(v[i][9]) === '') {
        const mx = oppMax[String(v[i][2]) + '|' + String(v[i][4])];
        if (mx) { v[i][9] = mx; touched = true; }
      }
    }
    if (touched) rng.setNumberFormat('@').setValues(v.map(function(r) { return r.map(cellStr_); }));
  }

  // 2) 教科の「有効」列を埋める(旧: 設定の「非表示教科」JSON)
  let hidden = [];
  const hid = rows_('設定').filter(function(r) { return r['キー'] === '非表示教科'; })[0];
  if (hid) { try { hidden = JSON.parse(hid['値']) || []; } catch (e) {} }
  const subjSh = sh_('教科');
  const sLast = subjSh.getLastRow();
  if (sLast >= 2) {
    const sw = SHEET_DEFS['教科'].length;
    const srng = subjSh.getRange(2, 1, sLast - 1, sw);
    const sv = srng.getValues();
    let st = false;
    for (let i = 0; i < sv.length; i++) {
      if (String(sv[i][0]) === '') continue;
      if (String(sv[i][6]) === '') {
        sv[i][6] = hidden.indexOf(String(sv[i][0])) >= 0 ? '0' : '1';
        st = true;
      }
    }
    if (st) srng.setNumberFormat('@').setValues(sv.map(function(r) { return r.map(cellStr_); }));
  }

  // 3) 設定に紛れていた所見を専用シートへ
  const shokenRows = rows_('設定').filter(function(r) { return r['キー'].indexOf('所見|') === 0; });
  if (shokenRows.length) {
    const have = {};
    rows_('所見').forEach(function(r) { have[r['キー']] = 1; });
    const add = [];
    shokenRows.forEach(function(r) {
      const p = r['キー'].split('|');
      const key = p[1] + '|' + p[2];
      if (!have[key]) { have[key] = 1; add.push([key, r['クラスID'], p[1], p[2], r['値'], now_()]); }
    });
    appendRows_('所見', add);
    deleteWhereFn_('設定', function(row) { return String(row[1]).indexOf('所見|') === 0; });
  }

  // 4) 教科ごとの対象児童(旧: 設定の「教科対象外」JSON)を「履修除外」シートへ。置き場所を1つにする
  const exRow = rows_('設定').filter(function(r) { return r['キー'] === '教科対象外'; })[0];
  if (exRow) {
    let o = {};
    try { o = JSON.parse(exRow['値']) || {}; } catch (e) {}
    const have = {};
    rows_('履修除外').forEach(function(r) { have[r['キー']] = 1; });
    const add = [];
    Object.keys(o).forEach(function(sid) {
      (o[sid] || []).forEach(function(stu) {
        const key = stu + '|' + sid;
        if (have[key]) return;
        have[key] = 1;
        add.push([key, exRow['クラスID'], String(stu), sid, now_()]);
      });
    });
    appendRows_('履修除外', add);
    deleteWhereFn_('設定', function(row) { return String(row[1]) === '教科対象外'; });
  }

  // 5) 間違えた回数の古い置き場所(全員で1つ)を片づける
  const pr = PropertiesService.getScriptProperties();
  pr.deleteProperty('auth_fail');
  pr.deleteProperty('auth_until');
}

/* ================= 行の読み書き ================= */

// 見出し定義の幅で読む。値はすべて文字列に正規化する
function rows_(name) {
  const sh = sh_(name);
  if (!sh) return [];
  const head = SHEET_DEFS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, head.length).getValues();
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]) === '') continue;
    const o = { _row: i + 2 };
    for (let j = 0; j < head.length; j++) o[head[j]] = cellStr_(v[i][j]);
    out.push(o);
  }
  return out;
}

function appendRows_(name, rows2d) {
  if (!rows2d || !rows2d.length) return;
  const sh = sh_(name);
  const w = SHEET_DEFS[name].length;
  const start = sh.getLastRow() + 1;
  const need = start + rows2d.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 200);
  const rng = sh.getRange(start, 1, rows2d.length, w);
  rng.setNumberFormat('@');
  rng.setValues(rows2d.map(function(r) {
    const c = r.slice();
    while (c.length < w) c.push('');
    return c.slice(0, w).map(function(x) { return x == null ? '' : String(x); });
  }));
}

function append_(name, obj) {
  appendRows_(name, [SHEET_DEFS[name].map(function(h) { return obj[h] != null ? String(obj[h]) : ''; })]);
}

function updateRow_(name, rowIndex, obj) {
  const head = SHEET_DEFS[name];
  const sh = sh_(name);
  const cur = sh.getRange(rowIndex, 1, 1, head.length).getValues()[0].map(cellStr_);
  head.forEach(function(h, j) { if (obj[h] != null) cur[j] = String(obj[h]); });
  sh.getRange(rowIndex, 1, 1, head.length).setNumberFormat('@').setValues([cur]);
}

// 何行もまとめて書きかえる。changes = { ID: {列名: 値} }。読むのも書くのも1回ずつ
function updateMany_(name, idCol, changes) {
  const sh = sh_(name);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const head = SHEET_DEFS[name];
  const ci = head.indexOf(idCol);
  const rng = sh.getRange(2, 1, last - 1, head.length);
  const v = rng.getValues().map(function(r) { return r.map(cellStr_); });
  let n = 0;
  v.forEach(function(row) {
    const ch = changes[row[ci]];
    if (!ch) return;
    Object.keys(ch).forEach(function(h) { const j = head.indexOf(h); if (j >= 0 && ch[h] != null) row[j] = String(ch[h]); });
    n++;
  });
  if (n) rng.setNumberFormat('@').setValues(v);
  return n;
}

// 条件に合う行をまとめて消す。
// 残す行と空行を「1回の書き込み」で上から書き直すので、途中で止まっても記録がまとめて消えることがない
function deleteWhereFn_(name, pred) {
  const sh = sh_(name);
  if (!sh) return 0;
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const w = Math.max(SHEET_DEFS[name].length, sh.getLastColumn());
  const rng = sh.getRange(2, 1, last - 1, w);
  const v = rng.getValues();
  const keep = [];
  let removed = 0;
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]) === '') continue;
    if (pred(v[i])) { removed++; continue; }
    keep.push(v[i].map(cellStr_));
  }
  if (!removed) return 0;
  while (keep.length < v.length) keep.push(blankRow_(w));
  rng.setNumberFormat('@').setValues(keep);
  return removed;
}

function deleteWhereIn_(name, col, values) {
  const set = {};
  (values || []).forEach(function(v) { set[String(v)] = 1; });
  if (!Object.keys(set).length) return 0;
  const ci = SHEET_DEFS[name].indexOf(col);
  return deleteWhereFn_(name, function(row) { return !!set[String(row[ci])]; });
}

function deleteWhere_(name, col, val) { return deleteWhereIn_(name, col, [val]); }

/* ================= APIディスパッチャ ================= */

const WRITE_ACTIONS = [
  'setupClass','updateClass','saveStudent','deleteStudent','addStudentsBulk','renumberStudents',
  'saveSubject','saveSubjectsBulk','deleteSubject','setSubjectVisible','setRoster',
  'saveUnit','deleteUnit','saveUnitOrder','duplicateUnit','createUnitsBulk',
  'saveOpp','deleteOpp','saveOppOrder','saveRecords','saveSettings','saveOverride','saveShoken',
  'createExample','clearRecords','resetAll','createBackup','restoreBackup',
  'exportSeiseki','exportTests','exportKojin'   // シートを作って書くので排他が要る
];

// 返すときに、行番号(サーバーだけで使う)を落として軽くする
function dropRow_(k, v) { return k === '_row' ? undefined : v; }

function api(reqJson) {
  try {
    // プロパティは1回で読む(毎回シートを開かないので速い)
    const pv = PropertiesService.getScriptProperties().getProperties();
    if (pv[SETUP_KEY] !== '1') ensureSetup_();
    const req = JSON.parse(reqJson);
    const p = req.payload || {};
    let data = null;
    if (req.action === 'authState') data = authState_();
    else if (req.action === 'login') data = login_(p);
    else if (req.action === 'setPin') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { data = setPin_(p, req.token); }
      finally { lock.releaseLock(); }
    } else {
      // 合言葉を確かめるまでは、どのデータも返さない
      checkToken_(req.token, pv['pin_gen'] || '0');
      if (WRITE_ACTIONS.indexOf(req.action) >= 0) {
        const lock = LockService.getScriptLock();
        lock.waitLock(20000);
        try { data = dispatch_(req.action, p); }
        finally { lock.releaseLock(); }
      } else {
        data = dispatch_(req.action, p);
      }
    }
    return JSON.stringify({ ok: true, data: data }, dropRow_);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg === '__AUTH__') return JSON.stringify({ ok: false, auth: true, error: '合言葉を入力してください' });
    return JSON.stringify({ ok: false, error: msg });
  }
}

function dispatch_(action, p) {
  switch (action) {
    case 'bundle':          return getBundle_();
    case 'setupClass':      return setupClass_(p);
    case 'updateClass':     return updateClass_(p);
    case 'saveStudent':     return saveStudent_(p);
    case 'deleteStudent':   return deleteEntity_('名簿', '児童ID', p.id);
    case 'addStudentsBulk': return addStudentsBulk_(p);
    case 'renumberStudents':return renumberStudents_();
    case 'saveSubject':     return saveSubject_(p);
    case 'saveSubjectsBulk':return saveSubjectsBulk_(p);
    case 'setSubjectVisible': return setSubjectVisible_(p);
    case 'setRoster':       return setRoster_(p);
    case 'deleteSubject':   return deleteEntity_('教科', '教科ID', p.id);
    case 'saveUnit':        return saveUnit_(p);
    case 'saveUnitOrder':   return saveOrder_('単元', '単元ID', p.orders);
    case 'duplicateUnit':   return duplicateUnit_(p);
    case 'createUnitsBulk': return createUnitsBulk_(p);
    case 'deleteUnit':      return deleteEntity_('単元', '単元ID', p.id);
    case 'saveOppOrder':    return saveOrder_('評価機会', '機会ID', p.orders);
    case 'saveOpp':         return saveOpp_(p);
    case 'deleteOpp':       return deleteOpp_(p);
    case 'saveRecords':     return saveRecords_(p);
    case 'saveSettings':    return saveSettings_(p);
    case 'saveOverride':    return saveOverride_(p);
    case 'saveShoken':      return saveShoken_(p);
    case 'createExample':   return createExample_();
    case 'createBackup':    return createBackup_();
    case 'restoreBackup':   return restoreBackup_(p);
    case 'clearRecords':    return clearRecords_();
    case 'resetAll':        return resetAll_();
    case 'exportSeiseki':   return exportTable_('出力_観点別一覧', p);
    case 'exportTests':     return exportTable_('出力_テスト別一覧', p);
    case 'exportKojin':     return exportKojin_(p);
    default: throw new Error('不明なアクション: ' + action);
  }
}

/* ================= 読み込み ================= */

function theClass_() { return rows_('クラス')[0] || null; }
function needClass_() {
  const c = theClass_();
  if (!c) throw new Error('先にクラスを作ってください');
  return c;
}

function getBundle_() {
  const c = theClass_();
  if (!c) return { cls: null };
  return {
    cls: c,
    students:  rows_('名簿'),
    subjects:  rows_('教科'),
    units:     rows_('単元'),
    opps:      rows_('評価機会'),
    // 記録はいちばん多いので、使う列だけを配列で送る [キー, 素点, メモ, 状態, 満点]
    recs:      rows_('記録').map(function(r) { return [r['キー'], r['素点'], r['メモ'], r['状態'], r['満点']]; }),
    settings:  rows_('設定'),
    overrides: rows_('確定評価'),
    shoken:    rows_('所見'),
    exempt:    rows_('履修除外')
  };
}

/* ================= クラス ================= */

const DEFAULT_SETTINGS = {
  // テストと見取りはそれぞれ100%で評価する。最終評価をどちらから引き継ぐかの既定
  '既定評価': 'test',
  '段階数値': '{"A":[100,95,90],"B":[80,70,60],"C":[55,50,45]}'
};

function setupClass_(p) {
  if (theClass_()) throw new Error('このファイルにはすでにクラスがあります');
  const name = String(p.name || '').trim();
  if (!name) throw new Error('クラス名を入力してください');
  const cid = id_('クラス');
  append_('クラス', {
    'クラスID': cid, 'クラス名': name, '年度': p.nendo || '',
    '学期制': '3', '作成日': now_()
  });
  appendRows_('教科', PRESET_SUBJECTS.map(function(s, i) {
    return [id_('教科'), cid, s, String(i + 1), '90', '60', '1'];
  }));
  appendRows_('設定', Object.keys(DEFAULT_SETTINGS).map(function(k) {
    return [cid, k, DEFAULT_SETTINGS[k]];
  }));
  return { classId: cid };
}

function updateClass_(p) {
  const c = needClass_();
  updateRow_('クラス', c._row, { 'クラス名': p.name, '年度': p.nendo, '学期制': '3' });
  return {};
}

// 記録だけ消して単元・テストの枠を残す(次の年度で同じ構成を使いたいとき)
function clearRecords_() {
  const c = theClass_();
  if (!c) return {};
  ['記録', '確定評価', '所見'].forEach(function(n) { deleteWhere_(n, 'クラスID', c['クラスID']); });
  return {};
}

// すべて消して最初からやり直す
function resetAll_() {
  const c = theClass_();
  if (!c) return {};
  ['名簿','教科','単元','評価機会','記録','設定','確定評価','所見','履修除外','クラス'].forEach(function(n) {
    deleteWhere_(n, 'クラスID', c['クラスID']);
  });
  return {};
}

function deleteEntity_(name, idCol, id) {
  if (!id) throw new Error('消すものが指定されていません');
  if (name === '教科') {
    const oppIds = rows_('評価機会').filter(function(o) { return o['教科ID'] === id; })
                    .map(function(o) { return o['機会ID']; });
    deleteWhereIn_('記録', '機会ID', oppIds);
    deleteWhere_('評価機会', '教科ID', id);
    deleteWhere_('単元', '教科ID', id);
    deleteWhere_('確定評価', '教科ID', id);
    deleteWhere_('履修除外', '教科ID', id);
  }
  if (name === '単元') {
    const oppIds = rows_('評価機会').filter(function(o) { return o['単元ID'] === id; })
                    .map(function(o) { return o['機会ID']; });
    deleteWhereIn_('記録', '機会ID', oppIds);
    deleteWhere_('評価機会', '単元ID', id);
  }
  if (name === '名簿') {
    deleteWhere_('記録', '児童ID', id);
    deleteWhere_('確定評価', '児童ID', id);
    deleteWhere_('所見', '児童ID', id);
    deleteWhere_('履修除外', '児童ID', id);
  }
  deleteWhere_(name, idCol, id);
  return {};
}

/* ================= 名簿 ================= */

function saveStudent_(p) {
  if (p.id) {
    const r = rows_('名簿').filter(function(s) { return s['児童ID'] === p.id; })[0];
    if (!r) throw new Error('児童が見つかりません');
    updateRow_('名簿', r._row, { '出席番号': p.no, '名前': p.name });
    return { id: p.id };
  }
  const c = needClass_();
  const nid = id_('名簿');
  append_('名簿', { '児童ID': nid, 'クラスID': c['クラスID'], '出席番号': p.no, '名前': p.name });
  return { id: nid };
}

function addStudentsBulk_(p) {
  const c = needClass_();
  const list = (p.list || []).filter(function(s) { return s && String(s.name || '').trim(); });
  appendRows_('名簿', list.map(function(s) {
    return [id_('名簿'), c['クラスID'], String(s.no), String(s.name).trim()];
  }));
  return { count: list.length };
}

function renumberStudents_() {
  const sts = rows_('名簿').slice().sort(function(a, b) {
    return (parseFloat(a['出席番号']) || 0) - (parseFloat(b['出席番号']) || 0);
  });
  const ch = {};
  sts.forEach(function(s, i) { ch[s['児童ID']] = { '出席番号': String(i + 1) }; });
  updateMany_('名簿', '児童ID', ch);
  return {};
}

/* ================= 教科・単元・評価機会 ================= */

function saveSubject_(p) {
  if (p.id) {
    const r = rows_('教科').filter(function(s) { return s['教科ID'] === p.id; })[0];
    if (!r) throw new Error('教科が見つかりません');
    updateRow_('教科', r._row, { '教科名': p.name, '表示順': p.order, 'A閾値': p.a, 'B閾値': p.b });
    return { id: p.id };
  }
  const c = needClass_();
  const nid = id_('教科');
  append_('教科', {
    '教科ID': nid, 'クラスID': c['クラスID'], '教科名': p.name,
    '表示順': p.order || '99', 'A閾値': p.a || '90', 'B閾値': p.b || '60', '有効': '1'
  });
  return { id: nid };
}

function saveSubjectsBulk_(p) {
  const ch = {};
  rows_('教科').forEach(function(r) { ch[r['教科ID']] = { 'A閾値': String(p.a), 'B閾値': String(p.b) }; });
  updateMany_('教科', '教科ID', ch);
  return {};
}

// その教科を受けない児童をまとめて決める。offIds 以外の児童は「受ける」になる
function setRoster_(p) {
  const c = needClass_();
  const sid = String(p.subjId || '');
  if (!rows_('教科').some(function(s) { return s['教科ID'] === sid; })) throw new Error('教科が見つかりません');
  const valid = {};
  rows_('名簿').forEach(function(s) { valid[s['児童ID']] = 1; });
  const seen = {};
  const off = (p.offIds || []).map(String).filter(function(id) {
    if (!valid[id] || seen[id]) return false;
    seen[id] = 1; return true;
  });
  deleteWhere_('履修除外', '教科ID', sid);
  const stamp = now_();
  appendRows_('履修除外', off.map(function(id) { return [id + '|' + sid, c['クラスID'], id, sid, stamp]; }));
  return { off: off.length };
}

function setSubjectVisible_(p) {
  const r = rows_('教科').filter(function(s) { return s['教科ID'] === p.id; })[0];
  if (!r) throw new Error('教科が見つかりません');
  updateRow_('教科', r._row, { '有効': p.on ? '1' : '0' });
  return {};
}

function saveUnit_(p) {
  if (p.id) {
    const r = rows_('単元').filter(function(u) { return u['単元ID'] === p.id; })[0];
    if (!r) throw new Error('単元が見つかりません');
    updateRow_('単元', r._row, { '単元名': p.name, '学期': p.term, '表示順': p.order });
    return { id: p.id };
  }
  const c = needClass_();
  const nid = id_('単元');
  append_('単元', {
    '単元ID': nid, 'クラスID': c['クラスID'], '教科ID': p.subjectId,
    '単元名': p.name, '学期': p.term || '', '表示順': p.order || '99'
  });
  return { id: nid };
}

function saveOrder_(name, idCol, orders) {
  const ch = {};
  (orders || []).forEach(function(o) { ch[String(o.id)] = { '表示順': String(o.order) }; });
  updateMany_(name, idCol, ch);
  return {};
}

function duplicateUnit_(p) {
  const u = rows_('単元').filter(function(x) { return x['単元ID'] === p.unitId; })[0];
  if (!u) throw new Error('単元が見つかりません');
  const nid = id_('単元');
  append_('単元', {
    '単元ID': nid, 'クラスID': u['クラスID'], '教科ID': u['教科ID'],
    '単元名': p.newName, '学期': p.term != null ? p.term : u['学期'], '表示順': String(p.order || 99)
  });
  const src = rows_('評価機会').filter(function(o) { return o['単元ID'] === p.unitId; });
  appendRows_('評価機会', src.map(function(o, i) {
    // 面の単元が元の単元を指していたら、新しい単元に付けかえる
    let kanten = o['観点構成'];
    try {
      kanten = JSON.stringify((JSON.parse(kanten) || []).map(function(f) {
        if (f.unit === p.unitId) f.unit = nid;
        return f;
      }));
    } catch (e) {}
    return [id_('評価機会'), o['クラスID'], o['教科ID'], nid, o['機会名'], o['種別'],
            p.term != null ? p.term : o['学期'], p.date || '', kanten, String(i + 1)];
  }));
  return { unitId: nid };
}

function createUnitsBulk_(p) {
  const c = needClass_();
  const units = [], opps = [];
  (p.units || []).forEach(function(u) {
    const uid = id_('単元');
    units.push([uid, c['クラスID'], p.subjectId, u.name, u.term || '', String(u.order || 99)]);
    (u.opps || []).forEach(function(o, i) {
      opps.push([id_('評価機会'), c['クラスID'], p.subjectId, uid, o.name, o.type,
                 o.term || u.term || '', o.date || u.date || '', o.kanten, String(i + 1)]);
    });
  });
  appendRows_('単元', units);
  appendRows_('評価機会', opps);
  return { units: units.length, opps: opps.length };
}

// 面のID。ふつうは観点(知・思・主)そのもの。同じ観点の面が2つ以上あるときだけ「知2」のような id を持つ
function faceIds_(kantenJson) {
  let ks = [];
  try { ks = JSON.parse(kantenJson) || []; } catch (e) { return null; }
  const out = {};
  ks.forEach(function(f) { out[String(f.id || f.k)] = String(f.max); });
  return out;
}

function saveOpp_(p) {
  const ids = faceIds_(p.kanten);
  if (!ids || !Object.keys(ids).length) throw new Error('観点を1つ以上選んでください');
  if (p.id) {
    const r = rows_('評価機会').filter(function(o) { return o['機会ID'] === p.id; })[0];
    if (!r) throw new Error('評価機会が見つかりません');
    updateRow_('評価機会', r._row, {
      '機会名': p.name, '単元ID': p.unitId, '学期': p.term, '日付': p.date, '観点構成': p.kanten
    });
    syncRecords_(p.id, ids);
    return { id: p.id };
  }
  const c = needClass_();
  const nid = id_('評価機会');
  append_('評価機会', {
    '機会ID': nid, 'クラスID': c['クラスID'], '教科ID': p.subjectId, '単元ID': p.unitId || '',
    '機会名': p.name, '種別': p.type, '学期': p.term, '日付': p.date || '',
    '観点構成': p.kanten, '表示順': String(p.order || 99)
  });
  return { id: nid };
}

// 満点を変えたとき、既に入っている記録の満点も追従させる。外した面の記録は消す
// (追従させないと、同じテストの中で子どもごとに満点が違うことになる)
function syncRecords_(oppId, ids) {
  const sh = sh_('記録');
  const last = sh.getLastRow();
  if (last < 2) return;
  const w = SHEET_DEFS['記録'].length;
  const rng = sh.getRange(2, 1, last - 1, w);
  const v = rng.getValues().map(function(r) { return r.map(cellStr_); });
  let touched = false, gone = false;
  for (let i = 0; i < v.length; i++) {
    if (v[i][2] !== oppId) continue;
    const m = ids[v[i][4]];
    if (m == null) { gone = true; continue; }
    if (v[i][9] !== m) { v[i][9] = m; touched = true; }
  }
  if (touched) rng.setNumberFormat('@').setValues(v);
  if (gone) deleteWhereFn_('記録', function(r) { return String(r[2]) === oppId && ids[String(r[4])] == null; });
}

function deleteOpp_(p) {
  deleteWhere_('記録', '機会ID', p.id);
  deleteWhere_('評価機会', '機会ID', p.id);
  return {};
}

/* ================= 記録(バッチ保存) ================= */

// p.records = [{oppId, stuId, kan, raw, memo, state, max}]  kan は面のID(ふつうは観点)
// raw も state も memo も空なら、その記録は消す
function saveRecords_(p) {
  const c = needClass_();
  const list = Array.isArray(p.records) ? p.records : [];
  if (!list.length) return { saved: 0 };
  const sh = sh_('記録');
  const w = SHEET_DEFS['記録'].length;
  const last = sh.getLastRow();
  const v = last >= 2 ? sh.getRange(2, 1, last - 1, w).getValues() : [];
  const map = {};
  for (let i = 0; i < v.length; i++) map[String(v[i][0])] = i;

  const who = activeEmail_();
  const stamp = now_();
  const toAppend = [], appendAt = {};
  const dead = {};
  let lo = Infinity, hi = -1;   // 変わった行だけ書き戻す

  list.forEach(function(rec) {
    const key = rec.oppId + '|' + rec.stuId + '|' + rec.kan;
    const raw = String(rec.raw == null ? '' : rec.raw);
    const state = String(rec.state || '');
    const memo = String(rec.memo || '');
    if (raw === '' && state === '' && memo === '') { dead[key] = 1; return; }
    delete dead[key];
    const row = [key, c['クラスID'], String(rec.oppId), String(rec.stuId), String(rec.kan), raw, memo, stamp,
                 state, String(rec.max == null ? '' : rec.max), who];
    if (map[key] != null) {
      const i = map[key];
      v[i] = row;
      if (i < lo) lo = i;
      if (i > hi) hi = i;
    } else if (appendAt[key] != null) {
      toAppend[appendAt[key]] = row;   // 同じ送信の中で同じキーが2回来たら、あとのほうを使う
    } else {
      appendAt[key] = toAppend.length;
      toAppend.push(row);
    }
  });

  if (hi >= 0) {
    sh.getRange(2 + lo, 1, hi - lo + 1, w).setNumberFormat('@')
      .setValues(v.slice(lo, hi + 1).map(function(r) { return r.map(cellStr_); }));
  }
  if (toAppend.length) appendRows_('記録', toAppend);
  if (Object.keys(dead).length) deleteWhereFn_('記録', function(r) { return !!dead[String(r[0])]; });
  return { saved: list.length };
}

/* ================= 設定・確定評価・所見 ================= */

function saveSettings_(p) {
  const c = needClass_();
  const all = rows_('設定');
  const add = [];
  Object.keys(p.kv || {}).forEach(function(k) {
    const r = all.filter(function(s) { return s['キー'] === k; })[0];
    if (r) updateRow_('設定', r._row, { '値': String(p.kv[k]) });
    else add.push([c['クラスID'], k, String(p.kv[k])]);
  });
  appendRows_('設定', add);
  return {};
}

// grade が空なら確定を解除して自動計算に戻す。
// 確定した時点の自動値も一緒に残すので、後から根拠を確認できる
function saveOverride_(p) {
  const c = needClass_();
  const key = p.stuId + '|' + p.subjId + '|' + p.kan + '|' + p.term;
  if (!p.grade) { deleteWhere_('確定評価', 'キー', key); return {}; }
  const r = rows_('確定評価').filter(function(x) { return x['キー'] === key; })[0];
  const vals = {
    'キー': key, 'クラスID': c['クラスID'], '児童ID': p.stuId, '教科ID': p.subjId,
    '観点': p.kan, '学期': p.term, '評価': p.grade, '理由': p.reason || '',
    '更新日時': now_(), '自動値': p.autoValue == null ? '' : String(p.autoValue)
  };
  if (r) updateRow_('確定評価', r._row, vals);
  else append_('確定評価', vals);
  return {};
}

function saveShoken_(p) {
  const c = needClass_();
  const key = p.stuId + '|' + p.term;
  if (!p.text) { deleteWhere_('所見', 'キー', key); return {}; }
  const r = rows_('所見').filter(function(x) { return x['キー'] === key; })[0];
  const vals = {
    'キー': key, 'クラスID': c['クラスID'], '児童ID': p.stuId,
    '学期': p.term, '本文': p.text, '更新日時': now_()
  };
  if (r) updateRow_('所見', r._row, vals);
  else append_('所見', vals);
  return {};
}

/* ================= 記入例 ================= */

// 国語に単元を2つ作り、表が思・判・表、裏が知・技のテストと、見取りを1つ入れる
function createExample_() {
  const c = needClass_();
  const kokugo = rows_('教科').filter(function(s) { return s['教科名'] === '国語'; })[0]
              || rows_('教科')[0];
  if (!kokugo) throw new Error('先に教科を登録してください');
  const uid = id_('単元'), uid2 = id_('単元');
  appendRows_('単元', [
    [uid,  c['クラスID'], kokugo['教科ID'], 'スイミー(記入例)', '1学期', '1'],
    [uid2, c['クラスID'], kokugo['教科ID'], '漢字の広場(記入例)', '1学期', '2']
  ]);
  appendRows_('評価機会', [
    // 表と裏で単元が違うテストの例。面ごとに名前と単元を持てる
    [id_('評価機会'), c['クラスID'], kokugo['教科ID'], uid, 'ワークテスト(記入例)', 'テスト', '1学期', '',
     JSON.stringify([{ k: '思', max: 100, label: 'スイミー', unit: uid },
                     { k: '知', max: 100, label: '漢字の広場', unit: uid2 }]), '1'],
    [id_('評価機会'), c['クラスID'], kokugo['教科ID'], uid, 'ノートの見取り(記入例)', '見取り', '1学期', '',
     JSON.stringify([{ k: '主', max: 100 }]), '2']
  ]);
  return {};
}

/* ================= バックアップと読み込み ================= */

// 今のデータを、別のスプレッドシートとしてまるごと控える。
// ファイル名は「評価ノート_バックアップ_日付」。マイドライブの直下にできる
function createBackup_(suffix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd_HHmm');
  const name = APP_NAME + '_バックアップ_' + stamp + (suffix ? '_' + suffix : '');
  const dest = SpreadsheetApp.create(name);
  const keep = {};
  Object.keys(SHEET_DEFS).forEach(function(n) {
    const sh = ss.getSheetByName(n);
    if (!sh) return;
    const copied = sh.copyTo(dest);
    copied.setName(n);
    keep[n] = 1;
  });
  // 新規作成時にできる空シートを片づける
  dest.getSheets().forEach(function(sh) {
    if (!keep[sh.getName()] && dest.getSheets().length > 1) dest.deleteSheet(sh);
  });
  const at = now_();
  if (theClass_()) {
    saveSettings_({ kv: { '最終バックアップ': at, '最終バックアップ名': name, '最終バックアップURL': dest.getUrl() } });
  }
  return { url: dest.getUrl(), name: name, at: at };
}

function parseSheetId_(v) {
  const s = String(v || '').trim();
  const m = s.match(/\/d\/([-\w]{25,})/) || s.match(/[-\w]{25,}/);
  if (!m) throw new Error('バックアップのURLまたはIDを貼り付けてください');
  return m[1] || m[0];
}

// バックアップから今のファイルへ書き戻す。今のデータはすべて置き換わる。
// 1) バックアップを先に全部読む → 2) 今の状態を自動で控える → 3) シートごとに1回で書く → 4) 古い形式なら移行
function restoreBackup_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const id = parseSheetId_(p.url);
  if (id === ss.getId()) throw new Error('いま開いているファイル自身のURLです。バックアップのファイルのURLを貼り付けてください');
  const src = SpreadsheetApp.openById(id);
  const names = Object.keys(SHEET_DEFS);
  const need = ['クラス', '名簿', '教科', '評価機会', '記録'];
  const missing = need.filter(function(n) { return !src.getSheetByName(n); });
  if (missing.length) {
    throw new Error(APP_NAME + 'のバックアップではないようです(' + missing.join('・') + ' が見つかりません)');
  }
  const data = {};
  names.forEach(function(n) {
    const w = SHEET_DEFS[n].length;
    const from = src.getSheetByName(n);
    data[n] = [];
    if (!from) return;   // 古いバックアップにないシートは空にする
    const last = from.getLastRow();
    if (last < 2) return;
    const rw = Math.min(w, from.getMaxColumns());
    from.getRange(2, 1, last - 1, rw).getValues().forEach(function(r) {
      if (String(r[0]) === '') return;
      const row = r.map(cellStr_);
      while (row.length < w) row.push('');
      data[n].push(row);
    });
  });
  if (!data['クラス'].length) throw new Error('このバックアップにはクラスの情報がありません');

  const pre = theClass_() ? createBackup_('読み込み前') : null;

  let rows = 0;
  names.forEach(function(n) {
    const to = sh_(n);
    const w = SHEET_DEFS[n].length;
    const body = data[n].slice();
    const total = Math.max(body.length, to.getLastRow() - 1);
    rows += body.length;
    if (total <= 0) return;
    while (body.length < total) body.push(blankRow_(w));
    if (to.getMaxRows() < total + 1) to.insertRowsAfter(to.getMaxRows(), total + 1 - to.getMaxRows() + 50);
    to.getRange(2, 1, total, w).setNumberFormat('@').setValues(body);
  });
  migrate_();
  if (pre) saveSettings_({ kv: { '最終バックアップ': pre.at, '最終バックアップ名': pre.name, '最終バックアップURL': pre.url } });
  return { name: src.getName(), rows: rows, pre: pre };
}

/* ================= Excel出力 ================= */

// 出力シートは毎回新しく作り、古いものは2枚だけ残して片づける。
// 同じ名前を上書きしないので、いつの出力かが必ず分かる
function outSheet_(prefix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const olds = ss.getSheets().filter(function(s) { return s.getName().indexOf(prefix) === 0; })
                 .sort(function(a, b) { return a.getName() < b.getName() ? -1 : 1; });
  while (olds.length > 2) { ss.deleteSheet(olds.shift()); }
  const base = prefix + Utilities.formatDate(new Date(), 'Asia/Tokyo', '_yyyyMMdd_HHmmss');
  let name = base, n = 2;
  while (ss.getSheetByName(name)) name = base + '_' + (n++);
  return ss.insertSheet(name);
}

function xlsxUrl_(sh) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx&gid=' + sh.getSheetId();
}

// 出力のセル。数だけのものは数として、それ以外は「'」を付けて文字のまま書く。
// (「45/50」が日付に、「=」で始まる名前が数式に化けるのを防ぐ)
function outCell_(x) {
  if (x == null) return '';
  if (typeof x === 'number') return isFinite(x) ? x : '';
  const s = String(x);
  if (s === '') return '';
  if (/^-?(0|[1-9]\d{0,13})(\.\d+)?$/.test(s)) return Number(s);
  return "'" + s;
}

function writeOut_(sh, all, headRows) {
  const width = Math.max.apply(null, all.map(function(r) { return Math.max(r.length, 1); }));
  const norm = all.map(function(r) {
    const c = r.map(outCell_);
    while (c.length < width) c.push('');
    return c;
  });
  // 新しいシートは26列・1000行しかない。教科が多いと列が足りなくなるので先に広げる
  if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  if (sh.getMaxRows() < norm.length) sh.insertRowsAfter(sh.getMaxRows(), norm.length - sh.getMaxRows());
  sh.getRange(1, 1, norm.length, width).setValues(norm);
  sh.getRange(1, 1, 1, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1, 1, 1).setFontColor('#6E6E73');
  if (headRows) {
    sh.getRange(4, 1, headRows, width).setFontWeight('bold');
    sh.setFrozenRows(3 + headRows);
  }
  sh.autoResizeColumns(1, Math.min(width, 30));
  return { url: xlsxUrl_(sh) };
}

// p.title, p.note(集計条件の説明), p.header(見出しの行の配列), p.rows
function exportTable_(prefix, p) {
  const sh = outSheet_(prefix);
  const meta = [[p.title || ''], ['出力日時 ' + now_() + '  /  ' + (p.note || '')], []];
  const all = meta.concat(p.header || []).concat(p.rows || []);
  return writeOut_(sh, all, (p.header || []).length);
}

function exportKojin_(p) {
  const sh = outSheet_('出力_個人シート');
  let all = [[p.title || ''], ['出力日時 ' + now_() + '  /  ' + (p.note || '')], []];
  (p.blocks || []).forEach(function(b) {
    all.push([b.heading]);
    if (b.header) all.push(b.header);
    all = all.concat(b.rows || []);
    all.push([]);
  });
  return writeOut_(sh, all, 0);
}

// ===== ここが最終行です(貼り付け確認用: HYOKANOTE-GS-END) =====
