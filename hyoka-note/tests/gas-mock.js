/* 評価ノートのテスト用：Google Apps Script の まねをする部品
 * SpreadsheetApp / PropertiesService / CacheService / LockService / Utilities / Session / HtmlService を
 * メモリの上で再現し、Code.gs をそのまま Node の vm で動かせるようにする。
 * スプレッドシートに文字を書いたときの「自動の型変換」(日付・数式・数値) も再現して、
 * 書式なしテキスト(@)にしていないと化けることを確かめられるようにしてある。 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');

const DEFAULT_ROWS = 1000, DEFAULT_COLS = 26;

function createWorld(opt) {
  opt = opt || {};
  const stats = { calls: 0, byName: {} };
  function hit(name) { stats.calls++; stats.byName[name] = (stats.byName[name] || 0) + 1; }
  const books = {};          // id -> Spreadsheet
  let nextBookNo = 1, nextGid = 100;

  /* ---------- スプレッドシートへ書くときの型変換 ---------- */
  function parseInput(v) {
    if (typeof v !== 'string') return v;
    if (v === '') return '';
    if (v.charAt(0) === "'") return v.slice(1);                 // 先頭の ' は「文字として」の印
    if (v.charAt(0) === '=') return { formula: v };              // 数式になってしまう
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^\d{1,2}\/\d{1,2}$/.test(v) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) return new Date(2026, 0, 1); // 日付に化ける
    return v;
  }

  function Sheet(book, name) {
    this.book = book; this.name = name; this.gid = nextGid++;
    this.maxRows = DEFAULT_ROWS; this.maxCols = DEFAULT_COLS;
    this.cells = {};   // "r,c" -> value
    this.fmt = {};     // "r,c" -> '@'
    this.hidden = false; this.frozen = 0;
  }
  Sheet.prototype = {
    getName() { hit('getName'); return this.name; },
    setName(n) { hit('setName'); this.name = n; return this; },
    getSheetId() { return this.gid; },
    getMaxRows() { hit('getMaxRows'); return this.maxRows; },
    getMaxColumns() { hit('getMaxColumns'); return this.maxCols; },
    getLastRow() {
      hit('getLastRow');
      let m = 0;
      for (const k in this.cells) { if (this.cells[k] !== '' && this.cells[k] != null) { const r = +k.split(',')[0]; if (r > m) m = r; } }
      return m;
    },
    getLastColumn() {
      hit('getLastColumn');
      let m = 0;
      for (const k in this.cells) { if (this.cells[k] !== '' && this.cells[k] != null) { const c = +k.split(',')[1]; if (c > m) m = c; } }
      return m;
    },
    getRange(r, c, nr, nc) {
      hit('getRange');
      if (nr == null) nr = 1; if (nc == null) nc = 1;
      if (!(r >= 1 && c >= 1)) throw new Error('範囲の開始位置が正しくありません: ' + r + ',' + c);
      if (nr < 1) throw new Error('The number of rows in the range must be at least 1.');
      if (nc < 1) throw new Error('The number of columns in the range must be at least 1.');
      if (r + nr - 1 > this.maxRows || c + nc - 1 > this.maxCols) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      return new Range(this, r, c, nr, nc);
    },
    insertRowsAfter(after, n) { hit('insertRowsAfter'); this.maxRows += n; return this; },
    insertColumnsAfter(after, n) { hit('insertColumnsAfter'); this.maxCols += n; return this; },
    deleteRow(r) {
      hit('deleteRow');
      const cells = {}, fmt = {};
      for (const k in this.cells) {
        const p = k.split(','), rr = +p[0];
        if (rr === r) continue;
        cells[(rr > r ? rr - 1 : rr) + ',' + p[1]] = this.cells[k];
      }
      for (const k in this.fmt) {
        const p = k.split(','), rr = +p[0];
        if (rr === r) continue;
        fmt[(rr > r ? rr - 1 : rr) + ',' + p[1]] = this.fmt[k];
      }
      this.cells = cells; this.fmt = fmt; this.maxRows--;
      return this;
    },
    hideSheet() { hit('hideSheet'); this.hidden = true; return this; },
    showSheet() { this.hidden = false; return this; },
    isSheetHidden() { hit('isSheetHidden'); return this.hidden; },
    setFrozenRows(n) { hit('setFrozenRows'); this.frozen = n; return this; },
    autoResizeColumns() { hit('autoResizeColumns'); return this; },
    clear() { this.cells = {}; this.fmt = {}; return this; },
    copyTo(book) {
      hit('copyTo');
      const sh = book.insertSheet('Copy of ' + this.name);
      sh.cells = Object.assign({}, this.cells); sh.fmt = Object.assign({}, this.fmt);
      sh.maxRows = this.maxRows; sh.maxCols = this.maxCols;
      return sh;
    },
    // テスト用：見たままの2次元配列
    dump() {
      const lr = this.getLastRow(), lc = this.getLastColumn();
      const out = [];
      for (let r = 1; r <= lr; r++) {
        const row = [];
        for (let c = 1; c <= lc; c++) { const v = this.cells[r + ',' + c]; row.push(v == null ? '' : v); }
        out.push(row);
      }
      return out;
    }
  };

  function Range(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype = {
    getValues() {
      hit('getValues');
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = this.sheet.cells[(this.r + i) + ',' + (this.c + j)];
          row.push(v == null ? '' : (v && v.formula ? 0 : v));
        }
        out.push(row);
      }
      return out;
    },
    setValues(v) {
      hit('setValues');
      if (!Array.isArray(v) || v.length !== this.nr) throw new Error('行の数が範囲と合いません: ' + (v && v.length) + ' / ' + this.nr);
      for (let i = 0; i < this.nr; i++) {
        if (!Array.isArray(v[i]) || v[i].length !== this.nc) throw new Error('列の数が範囲と合いません: ' + (v[i] && v[i].length) + ' / ' + this.nc);
        for (let j = 0; j < this.nc; j++) {
          const key = (this.r + i) + ',' + (this.c + j);
          let x = v[i][j];
          if (x === undefined) throw new Error('undefined は書けません');
          if (x === null) x = '';
          if (typeof x === 'string' && this.sheet.fmt[key] === '@') { this.sheet.cells[key] = x; continue; }
          this.sheet.cells[key] = parseInput(x);
        }
      }
      return this;
    },
    setValue(x) { return this.setValues([[x]]); },
    setNumberFormat(f) {
      hit('setNumberFormat');
      for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.fmt[(this.r + i) + ',' + (this.c + j)] = f;
      return this;
    },
    clearContent() {
      hit('clearContent');
      for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) delete this.sheet.cells[(this.r + i) + ',' + (this.c + j)];
      return this;
    },
    setFontWeight() { hit('setFontWeight'); return this; },
    setFontSize() { hit('setFontSize'); return this; },
    setFontColor() { hit('setFontColor'); return this; },
    setBackground() { return this; },
    getNumRows() { return this.nr; },
    getNumColumns() { return this.nc; }
  };

  function Spreadsheet(name) {
    this.id = 'book' + (nextBookNo++) + 'abcdefghijklmnopqrstuvwxyz0123';
    this.name = name; this.sheets = []; this.toasts = [];
    books[this.id] = this;
  }
  Spreadsheet.prototype = {
    getId() { return this.id; },
    getName() { return this.name; },
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; },
    getSheetByName(n) { hit('getSheetByName'); return this.sheets.find(s => s.name === n) || null; },
    getSheets() { hit('getSheets'); return this.sheets.slice(); },
    insertSheet(n) {
      hit('insertSheet');
      if (this.sheets.some(s => s.name === n)) throw new Error('A sheet with the name "' + n + '" already exists.');
      const sh = new Sheet(this, n); this.sheets.push(sh); return sh;
    },
    deleteSheet(sh) {
      hit('deleteSheet');
      if (this.sheets.length <= 1) throw new Error('最後のシートは消せません');
      this.sheets = this.sheets.filter(s => s !== sh);
    },
    toast(msg) { this.toasts.push(msg); }
  };

  const active = new Spreadsheet(opt.name || '評価ノート');
  active.insertSheet('シート1');

  const SpreadsheetApp = {
    getActiveSpreadsheet() { hit('getActiveSpreadsheet'); return active; },
    create(name) { hit('create'); const b = new Spreadsheet(name); b.insertSheet('シート1'); return b; },
    openById(id) {
      hit('openById');
      if (!books[id]) throw new Error('ファイルが見つからないか、アクセス権がありません: ' + id);
      return books[id];
    }
  };

  /* ---------- プロパティ・キャッシュ・ロック ---------- */
  const props = {};
  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty(k) { hit('getProperty'); return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
        setProperty(k, v) { hit('setProperty'); props[k] = String(v); return this; },
        deleteProperty(k) { hit('deleteProperty'); delete props[k]; return this; },
        getProperties() { return Object.assign({}, props); },
        getKeys() { return Object.keys(props); }
      };
    }
  };
  const cache = {};
  const clock = { offset: 0, now() { return Date.now() + this.offset; } };
  const CacheService = {
    getScriptCache() {
      return {
        get(k) { hit('cacheGet'); const e = cache[k]; if (!e) return null; if (e.until < clock.now()) { delete cache[k]; return null; } return e.v; },
        put(k, v, ttl) { hit('cachePut'); cache[k] = { v: String(v), until: clock.now() + (ttl || 600) * 1000 }; },
        remove(k) { delete cache[k]; }
      };
    }
  };
  const lockState = { held: false, waits: 0 };
  const LockService = {
    getScriptLock() {
      return {
        waitLock() { hit('waitLock'); lockState.waits++; lockState.held = true; },
        tryLock() { hit('tryLock'); lockState.held = true; return true; },
        releaseLock() { lockState.held = false; },
        hasLock() { return lockState.held; }
      };
    }
  };

  /* ---------- そのほか ---------- */
  const users = { active: opt.activeUser == null ? 'owner@example.com' : opt.activeUser, effective: opt.owner || 'owner@example.com' };
  const Session = {
    getActiveUser() { return { getEmail() { return users.active; } }; },
    getEffectiveUser() { return { getEmail() { return users.effective; } }; }
  };

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid() { return crypto.randomUUID(); },
    computeDigest(alg, value) {
      hit('computeDigest');
      const buf = crypto.createHash('sha256').update(String(value), 'utf8').digest();
      return Array.from(buf).map(b => (b > 127 ? b - 256 : b));
    },
    formatDate(d, tz, pattern) {
      const t = new Date(d.getTime() + 9 * 3600 * 1000);   // Asia/Tokyo
      const map = {
        yyyy: String(t.getUTCFullYear()), yy: String(t.getUTCFullYear()).slice(2),
        MM: pad(t.getUTCMonth() + 1), dd: pad(t.getUTCDate()),
        HH: pad(t.getUTCHours()), mm: pad(t.getUTCMinutes()), ss: pad(t.getUTCSeconds())
      };
      return pattern.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, m => map[m]);
    }
  };
  const HtmlService = {
    XFrameOptionsMode: { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' },
    createHtmlOutputFromFile(name) {
      const out = { file: name, title: '', setTitle(t) { this.title = t; return this; },
        addMetaTag() { return this; }, setXFrameOptionsMode() { return this; }, setFaviconUrl() { return this; } };
      return out;
    }
  };

  return { SpreadsheetApp, PropertiesService, CacheService, LockService, Session, Utilities, HtmlService,
           active, books, props, cache, clock, users, stats, lockState,
           resetStats() { stats.calls = 0; stats.byName = {}; } };
}

// Code.gs を読み込んで、関数を呼べる入れものを返す
function loadServer(world, codePath) {
  const code = fs.readFileSync(codePath, 'utf8');
  const ctx = vm.createContext({
    SpreadsheetApp: world.SpreadsheetApp, PropertiesService: world.PropertiesService,
    CacheService: world.CacheService, LockService: world.LockService, Session: world.Session,
    Utilities: world.Utilities, HtmlService: world.HtmlService, console,
    Date: makeDate(world.clock)
  });
  vm.runInContext(code, ctx, { filename: codePath });
  ctx.__eval = src => vm.runInContext(src, ctx);
  ctx.call = function(action, payload, token) {
    const res = JSON.parse(ctx.api(JSON.stringify({ action, payload: payload || {}, token: token || null })));
    return res;
  };
  return ctx;
}

// テストで時計を進められる Date
function makeDate(clock) {
  const Real = Date;
  function FakeDate(...a) {
    if (!(this instanceof FakeDate)) return new Real(clock.now()).toString();
    return a.length ? new Real(...a) : new Real(clock.now());
  }
  FakeDate.prototype = Real.prototype;
  FakeDate.now = () => clock.now();
  FakeDate.UTC = Real.UTC; FakeDate.parse = Real.parse;
  return FakeDate;
}

// 保存しておいたシートの中身(フィクスチャ)を、まねのスプレッドシートに書き込む
function loadFixture(world, fx) {
  const ss = world.active;
  Object.keys(fx.sheets).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.cells = {}; sh.fmt = {};
    // 本物のシートと同じく、データが入る分の行・列はある
    sh.maxRows = Math.max(DEFAULT_ROWS, fx.sheets[name].length + 1);
    sh.maxCols = Math.max(DEFAULT_COLS, ...fx.sheets[name].map(r => r.length));
    fx.sheets[name].forEach((row, i) => row.forEach((v, j) => {
      sh.cells[(i + 1) + ',' + (j + 1)] = v;
      sh.fmt[(i + 1) + ',' + (j + 1)] = '@';
    }));
    if (fx.hidden && fx.hidden.indexOf(name) >= 0) sh.hidden = true;
  });
  Object.assign(world.props, fx.props || {});
}

function dumpWorld(world) {
  const out = { sheets: {}, hidden: [], props: Object.assign({}, world.props) };
  world.active.sheets.forEach(sh => {
    out.sheets[sh.name] = sh.dump().map(r => r.map(v => (v instanceof Date ? v.toISOString() : v)));
    if (sh.hidden) out.hidden.push(sh.name);
  });
  return out;
}

module.exports = { createWorld, loadServer, loadFixture, dumpWorld };
