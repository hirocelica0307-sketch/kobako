/**
 * 席替えアプリ — スプレッドシートの読み書き
 *
 * シート構成
 *   設定       … キー / 値 の 2 列。複雑なものは JSON 文字列で保存。
 *   名簿       … 児童 1 人 1 行。
 *   配慮_距離  … 「近づけない」関係を 1 件 1 行。
 *   履歴       … 書き出した席替えを 1 回 1 行（機械可読）。
 *   席替え_日付 … 書き出しのたびに作る、人が読むための座席表。
 */

const SH_SETTINGS = '設定';
const SH_ROSTER = '名簿';
const SH_SEPARATIONS = '配慮_距離';
const SH_HISTORY = '履歴';
const CHART_SHEET_PREFIX = '席替え_';

const MAX_ROWS = 7;   // 黒板側から 1〜7
const MAX_COLS = 6;   // 左から A〜F
const MAX_STUDENTS = 42;

const ROSTER_HEADERS = [
  '出席番号', '氏名', 'ひらがな', '性別', '固定席',
  '前後の指定', '前後の値', '左右の指定', '左右の値', 'メモ'
];
const SEPARATION_HEADERS = ['児童Aの出席番号', '児童Aの氏名', '児童Bの出席番号', '児童Bの氏名', '種類'];
const HISTORY_HEADERS = ['ID', '実施日時', 'ラベル', 'モード', '行数', '列数', 'シート名', '座席割当JSON', '名簿JSON'];
const HISTORY_LIMIT = 30;   // 画面に渡す記録の件数（回避に使うのはこのうち新しい 2 件）

/** 前後（黒板からの距離）の指定。シートには日本語で書き、内部ではコードで扱う。 */
const ROW_RULE_LABELS = {
  none: 'なし',
  exact: 'ちょうどこの列',
  frontWithin: '前からこの列数以内',
  backWithin: '後ろからこの列数以内'
};
/** 左右（窓側・廊下側）の指定。 */
const COL_RULE_LABELS = {
  none: 'なし',
  exact: 'ちょうどこの列',
  leftWithin: '左からこの列数以内',
  rightWithin: '右からこの列数以内'
};
/** 「近づけない」の強さ。 */
const SEPARATION_LABELS = {
  adjacent: '周囲のマスに入れない',
  pair: '同じペアにしない',
  group: '同じ班にしない'
};

/* ------------------------------------------------------------------ *
 * シートの用意
 * API の入口で ensureAllSheets_() を 1 回だけ呼ぶ。
 * そのあとの読み書きは getSheetByName() で取るだけにする（毎回の確認・書式設定はしない）。
 * ------------------------------------------------------------------ */

function ensureAllSheets_(ss) {
  ensureSettingsSheet_(ss);
  ensureTableSheet_(ss, SH_ROSTER, ROSTER_HEADERS);
  ensureTableSheet_(ss, SH_SEPARATIONS, SEPARATION_HEADERS);
  ensureTableSheet_(ss, SH_HISTORY, HISTORY_HEADERS);
}

function ensureTableSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  const head = sh.getRange(1, 1, 1, headers.length);
  if (head.getValues()[0].every(function (v) { return v === '' || v === null; })) {
    head.setValues([headers]).setFontWeight('bold').setBackground('#eef2f7');
    sh.setFrozenRows(1);
  }
}

function ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName(SH_SETTINGS);
  if (!sh) {
    sh = ss.insertSheet(SH_SETTINGS);
  }
  const first = sh.getRange(1, 1, 1, 3).getValues()[0];
  if (first.every(function (v) { return v === '' || v === null; })) {
    sh.getRange(1, 1, 1, 3).setValues([['キー', '値', '説明']]);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#eef2f7');
    sh.setFrozenRows(1);
    writeSettings_(ss, defaultSettings_());
  }
}

function defaultSettings_() {
  return {
    className: '',
    rows: 6,
    cols: 6,
    unusedSeats: [],
    seatStyle: 'pair',
    pairsAuto: true,
    pairs: [],
    groups: [],
    mode: 'random',
    genderStart: 'M',
    avoidSameSeatPrev: true,
    avoidSameSeatPrev2: true,
    avoidSamePairPrev: true,
    avoidSamePairPrev2: false,
    flipped: false,
    printNameStyle: 'kanji',
    printShowNumber: true
  };
}

/* ------------------------------------------------------------------ *
 * 設定
 * ------------------------------------------------------------------ */

const SETTING_DESCRIPTIONS = {
  className: 'クラス名（印刷の見出しに使います）',
  rows: '前後の席数（黒板側から。1〜7）',
  cols: '左右の席数（左から。1〜6）',
  unusedSeats: '使わない席（例 ["F7","E7"]）',
  seatStyle: '席の形 pair（隣の人と2人1組）/ single（1人ずつ）',
  pairsAuto: 'true なら横2席ずつを自動でペアにします',
  pairs: '手動で決めたペア（pairsAuto が false のときに使います）',
  groups: '班の区切り',
  mode: '席替えの方法 random / genderColumn / checker',
  genderStart: '男女交互のとき、左端または最前列をどちらから始めるか M / F',
  avoidSameSeatPrev: '前回と同じ席を避ける',
  avoidSameSeatPrev2: '前々回と同じ席を避ける',
  avoidSamePairPrev: '前回と同じペアを避ける',
  avoidSamePairPrev2: '前々回と同じペアを避ける',
  flipped: '座席表を反転して表示する',
  printNameStyle: '印刷する名前 kanji / kana / both',
  printShowNumber: '印刷に出席番号を入れる'
};

function readSettings_(ss) {
  const sh = ss.getSheetByName(SH_SETTINGS);
  const last = sh.getLastRow();
  const raw = {};
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, 2).getValues();
    values.forEach(function (r) {
      const key = String(r[0]).trim();
      if (key) raw[key] = r[1];
    });
  }

  const d = defaultSettings_();
  return {
    className: raw.className !== undefined ? String(raw.className) : d.className,
    rows: clampInt_(raw.rows, 1, MAX_ROWS, d.rows),
    cols: clampInt_(raw.cols, 1, MAX_COLS, d.cols),
    unusedSeats: parseJson_(raw.unusedSeats, d.unusedSeats),
    seatStyle: String(raw.seatStyle) === 'single' ? 'single' : 'pair',
    pairsAuto: parseBool_(raw.pairsAuto, d.pairsAuto),
    pairs: parseJson_(raw.pairs, d.pairs),
    groups: parseJson_(raw.groups, d.groups),
    mode: ['random', 'genderColumn', 'checker'].indexOf(String(raw.mode)) >= 0 ? String(raw.mode) : d.mode,
    genderStart: String(raw.genderStart) === 'F' ? 'F' : 'M',
    avoidSameSeatPrev: parseBool_(raw.avoidSameSeatPrev, d.avoidSameSeatPrev),
    avoidSameSeatPrev2: parseBool_(raw.avoidSameSeatPrev2, d.avoidSameSeatPrev2),
    avoidSamePairPrev: parseBool_(raw.avoidSamePairPrev, d.avoidSamePairPrev),
    avoidSamePairPrev2: parseBool_(raw.avoidSamePairPrev2, d.avoidSamePairPrev2),
    flipped: parseBool_(raw.flipped, d.flipped),
    printNameStyle: ['kanji', 'kana', 'both'].indexOf(String(raw.printNameStyle)) >= 0
      ? String(raw.printNameStyle) : d.printNameStyle,
    printShowNumber: parseBool_(raw.printShowNumber, d.printShowNumber)
  };
}

function writeSettings_(ss, settings) {
  const sh = ss.getSheetByName(SH_SETTINGS);
  const d = defaultSettings_();
  const merged = {};
  Object.keys(d).forEach(function (k) {
    merged[k] = (settings && settings[k] !== undefined) ? settings[k] : d[k];
  });

  const rows = Object.keys(d).map(function (k) {
    let v = merged[k];
    if (typeof v === 'object') v = JSON.stringify(v);
    else if (typeof v === 'boolean') v = v ? 'true' : 'false';
    return [k, v, SETTING_DESCRIPTIONS[k] || ''];
  });

  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 3).clearContent();
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.autoResizeColumn(1);
}

/* ------------------------------------------------------------------ *
 * 名簿
 * ------------------------------------------------------------------ */

function readRoster_(ss) {
  const sh = ss.getSheetByName(SH_ROSTER);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, ROSTER_HEADERS.length).getValues();
  const out = [];
  values.forEach(function (r) {
    const name = String(r[1] || '').trim();
    if (!name) return;
    out.push({
      no: out.length + 1,
      name: name,
      kana: String(r[2] || '').trim(),
      gender: normalizeGender_(r[3]),
      fixedSeat: normalizeSeatId_(r[4]),
      rowRule: { type: labelToCode_(ROW_RULE_LABELS, r[5]), value: clampInt_(r[6], 1, MAX_ROWS, 1) },
      colRule: { type: labelToCode_(COL_RULE_LABELS, r[7]), value: clampInt_(r[8], 1, MAX_COLS, 1) },
      note: String(r[9] || '').trim()
    });
  });
  return out.slice(0, MAX_STUDENTS);
}

function writeRoster_(ss, roster) {
  const sh = ss.getSheetByName(SH_ROSTER);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, ROSTER_HEADERS.length).clearContent();

  const list = (roster || []).slice(0, MAX_STUDENTS);
  if (!list.length) return;

  const rows = list.map(function (s, i) {
    const rr = s.rowRule || { type: 'none', value: 1 };
    const cr = s.colRule || { type: 'none', value: 1 };
    return [
      i + 1,
      s.name || '',
      s.kana || '',
      s.gender === 'M' ? '男' : (s.gender === 'F' ? '女' : ''),
      s.fixedSeat || '',
      ROW_RULE_LABELS[rr.type] || ROW_RULE_LABELS.none,
      rr.type === 'none' ? '' : (rr.value || 1),
      COL_RULE_LABELS[cr.type] || COL_RULE_LABELS.none,
      cr.type === 'none' ? '' : (cr.value || 1),
      s.note || ''
    ];
  });
  sh.getRange(2, 1, rows.length, ROSTER_HEADERS.length).setValues(rows);
}

/* ------------------------------------------------------------------ *
 * 配慮事項（近づけない関係）
 * ------------------------------------------------------------------ */

function readSeparations_(ss) {
  const sh = ss.getSheetByName(SH_SEPARATIONS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, SEPARATION_HEADERS.length).getValues();
  const out = [];
  values.forEach(function (r) {
    const a = parseInt(r[0], 10);
    const b = parseInt(r[2], 10);
    if (!a || !b || a === b) return;
    out.push({ a: a, b: b, level: labelToCode_(SEPARATION_LABELS, r[4]) || 'adjacent' });
  });
  return out;
}

function writeSeparations_(ss, separations, roster) {
  const sh = ss.getSheetByName(SH_SEPARATIONS);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, SEPARATION_HEADERS.length).clearContent();

  const list = separations || [];
  if (!list.length) return;

  const names = {};
  (roster || []).forEach(function (s) { names[s.no] = s.name; });

  const rows = list.map(function (s) {
    return [
      s.a, names[s.a] || '',
      s.b, names[s.b] || '',
      SEPARATION_LABELS[s.level] || SEPARATION_LABELS.adjacent
    ];
  });
  sh.getRange(2, 1, rows.length, SEPARATION_HEADERS.length).setValues(rows);
}

/* ------------------------------------------------------------------ *
 * 履歴
 * ------------------------------------------------------------------ */

function readHistory_(ss) {
  const sh = ss.getSheetByName(SH_HISTORY);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HISTORY_HEADERS.length).getValues();
  const out = [];
  values.forEach(function (r) {
    if (!r[0]) return;
    out.push({
      id: String(r[0]),
      at: formatCell_(r[1]),
      label: String(r[2] || ''),
      mode: String(r[3] || ''),
      rows: clampInt_(r[4], 1, MAX_ROWS, 6),
      cols: clampInt_(r[5], 1, MAX_COLS, 6),
      sheetName: String(r[6] || ''),
      assign: parseJson_(r[7], {}),
      roster: parseJson_(r[8], [])
    });
  });
  out.reverse(); // 新しい順
  return out.slice(0, HISTORY_LIMIT);
}

function historyRowValues_(id, at, entry) {
  // 呼び戻し・前回との照合に使うのは番号と氏名だけ
  const snapshot = (entry.roster || []).map(function (s) {
    return { no: s.no, name: s.name };
  });
  return [
    id,
    at,
    entry.label || '',
    entry.mode || '',
    clampInt_(entry.rows, 1, MAX_ROWS, 6),
    clampInt_(entry.cols, 1, MAX_COLS, 6),
    entry.sheetName || '',
    JSON.stringify(entry.assign || {}),
    JSON.stringify(snapshot)
  ];
}

function appendHistory_(ss, entry) {
  const sh = ss.getSheetByName(SH_HISTORY);
  const id = 'H' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  sh.appendRow(historyRowValues_(id, nowString_(), entry));
}

/** 履歴シートで ID の行番号を探す（見つからなければ 0） */
function findHistoryRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

/**
 * 既存の記録を書き換える（呼び戻して直したときの上書き保存）。
 * 実施日時はそのまま残すので、前回・前々回の並び順は変わらない。
 */
function updateHistory_(ss, id, entry) {
  const sh = ss.getSheetByName(SH_HISTORY);
  const row = findHistoryRow_(sh, id);
  if (!row) return false;
  const at = formatCell_(sh.getRange(row, 2).getValue()) || nowString_();
  sh.getRange(row, 1, 1, HISTORY_HEADERS.length).setValues([historyRowValues_(id, at, entry)]);
  return true;
}

/** その記録が作った座席表シートの名前 */
function historySheetName_(ss, id) {
  const sh = ss.getSheetByName(SH_HISTORY);
  const row = findHistoryRow_(sh, id);
  return row ? String(sh.getRange(row, 7).getValue() || '') : '';
}

/** 座席表シートを消す（記録の上書き・削除にともなう掃除） */
function deleteChartSheet_(ss, name) {
  if (!name) return;
  const target = ss.getSheetByName(name);
  if (target) ss.deleteSheet(target);
}

function deleteHistoryRow_(ss, id) {
  const sh = ss.getSheetByName(SH_HISTORY);
  const row = findHistoryRow_(sh, id);
  if (!row) return;
  deleteChartSheet_(ss, String(sh.getRange(row, 7).getValue() || ''));
  sh.deleteRow(row);
}

/* ------------------------------------------------------------------ *
 * 人が読むための座席表シート
 * ------------------------------------------------------------------ */

/**
 * 「席替え_YYYY-MM-DD」シートに座席表を書き出す。
 * 黒板を上にした向きで固定して記録する（配慮事項は書かない）。
 */
function writeSeatingChartSheet_(ss, payload) {
  const settings = payload.settings || defaultSettings_();
  const roster = payload.roster || [];
  const assign = payload.assign || {};
  const rows = clampInt_(settings.rows, 1, MAX_ROWS, 6);
  const cols = clampInt_(settings.cols, 1, MAX_COLS, 6);

  const byNo = {};
  roster.forEach(function (s) { byNo[s.no] = s; });

  const base = CHART_SHEET_PREFIX + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  let name = base;
  let n = 2;
  while (ss.getSheetByName(name)) {
    name = base + '(' + n + ')';
    n++;
  }
  const sh = ss.insertSheet(name);

  const header = [
    [(settings.className || '') + ' 座席表'],
    ['作成: ' + nowString_() + (payload.label ? '　/　' + payload.label : '')]
  ];
  sh.getRange(1, 1, 2, 1).setValues(header);
  sh.getRange(1, 1).setFontSize(14).setFontWeight('bold');

  const top = 4;
  sh.getRange(top, 1, 1, cols).merge()
    .setValue('黒 板')
    .setHorizontalAlignment('center')
    .setBackground('#333333')
    .setFontColor('#ffffff');

  const grid = [];
  for (let r = 1; r <= rows; r++) {
    const line = [];
    for (let c = 1; c <= cols; c++) {
      const seat = seatId_(c, r);
      if ((settings.unusedSeats || []).indexOf(seat) >= 0) {
        line.push(seat + '\n（使わない席）');
        continue;
      }
      const no = assign[seat];
      const st = no ? byNo[no] : null;
      if (!st) {
        line.push(seat + '\n—');
      } else {
        const kana = st.kana ? '\n' + st.kana : '';
        line.push(seat + '\n' + st.no + '　' + st.name + kana);
      }
    }
    grid.push(line);
  }
  sh.getRange(top + 1, 1, rows, cols).setValues(grid)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true);

  for (let c = 1; c <= cols; c++) sh.setColumnWidth(c, 130);
  for (let r = 0; r < rows; r++) sh.setRowHeight(top + 1 + r, 52);

  return name;
}

/* ------------------------------------------------------------------ *
 * 小さなヘルパー
 * ------------------------------------------------------------------ */

/** 列番号(1..6)と行番号(1..7)から座席 ID（例 C2）を作る */
function seatId_(col, row) {
  return String.fromCharCode(64 + col) + row;
}

function normalizeSeatId_(v) {
  const s = String(v || '').trim().toUpperCase();
  return /^[A-F][1-7]$/.test(s) ? s : '';
}

function normalizeGender_(v) {
  const s = String(v || '').trim();
  if (s === '男' || s === 'M' || s === 'm' || s === '男子' || s === '1') return 'M';
  if (s === '女' || s === 'F' || s === 'f' || s === '女子' || s === '2') return 'F';
  return '';
}

function labelToCode_(map, label) {
  const s = String(label || '').trim();
  let found = '';
  Object.keys(map).forEach(function (code) {
    if (map[code] === s) found = code;
  });
  return found || 'none';
}

function clampInt_(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseBool_(v, fallback) {
  if (v === true || v === false) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'はい' || s === '1') return true;
  if (s === 'false' || s === 'いいえ' || s === '0') return false;
  return fallback;
}

function parseJson_(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try {
    const parsed = JSON.parse(String(v));
    return (parsed === null) ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  return String(v || '');
}
