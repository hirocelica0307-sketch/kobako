/* テスト用：Google Apps Script のまね（所見メモ作成の Code.gs が使う分だけ）
 * スプレッドシートに文字を書いたときの「自動の型変換」（数値・日付・数式）も再現して、
 * 書式なしテキスト(@)にしていないと化けることを確かめられるようにしてある。 */
'use strict';
const vm = require('vm');
const fs = require('fs');

function parseInput(v) {
  if (typeof v !== 'string' || v === '') return v;
  if (v.charAt(0) === '=') return { formula: v };
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^\d{1,2}\/\d{1,2}$/.test(v)) return new Date(2026, 0, 1);
  return v;
}
function colNo(s) { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

function createWorld() {
  const stats = { putCalls: 0 };
  function Sheet(name) { this.name = name; this.cells = {}; this.fmt = {}; }
  Sheet.prototype = {
    getName() { return this.name; },
    getLastRow() {
      let m = 0;
      for (const k in this.cells) if (this.cells[k] !== '' && this.cells[k] != null) m = Math.max(m, +k.split(',')[0]);
      return m;
    },
    getRange(r, c, nr, nc) {
      if (typeof r === 'string') {
        const m = r.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        const r1 = +m[2], c1 = colNo(m[1]);
        const r2 = m[3] ? +m[4] : r1, c2 = m[3] ? colNo(m[3]) : c1;
        return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
      }
      if (nr == null) nr = 1; if (nc == null) nc = 1;
      if (!(r >= 1 && c >= 1 && nr >= 1 && nc >= 1)) throw new Error('範囲が正しくありません ' + [r, c, nr, nc]);
      return new Range(this, r, c, nr, nc);
    },
    setFrozenRows() { return this; }, setColumnWidth() { return this; },
    clear() { this.cells = {}; this.fmt = {}; return this; },
    dump() {
      const out = [];
      for (let r = 1; r <= this.getLastRow(); r++) {
        const row = [];
        for (let c = 1; c <= 20; c++) row.push(this.cells[r + ',' + c] ?? '');
        out.push(row);
      }
      return out;
    }
  };
  function Range(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  Range.prototype = {
    each(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) f(this.r + i, this.c + j, i, j); },
    setValues(v) {
      if (v.length !== this.nr || v.some(row => row.length !== this.nc)) throw new Error('setValues の大きさが範囲と合いません');
      this.each((r, c, i, j) => {
        const x = v[i][j], k = r + ',' + c;
        this.sh.cells[k] = this.sh.fmt[k] === '@' && typeof x === 'string' ? x : parseInput(x);
      });
      return this;
    },
    setValue(x) { return this.setValues([[x]]); },
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) { const v = this.sh.cells[(this.r + i) + ',' + (this.c + j)]; row.push(v == null ? '' : v); }
        out.push(row);
      }
      return out;
    },
    setNumberFormat(f) { this.each((r, c) => { this.sh.fmt[r + ',' + c] = f; }); return this; },
    clearContent() { this.each((r, c) => { delete this.sh.cells[r + ',' + c]; }); return this; },
    setFontWeight() { return this; }, setWrap() { return this; }
  };
  const book = {
    sheets: [],
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
    insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
    setActiveSheet() {}
  };
  const SpreadsheetApp = { getActive: () => book, getActiveSpreadsheet: () => book, flush() {} };
  const LockService = { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) };
  return { book, stats, SpreadsheetApp, LockService };
}

function loadServer(world, codePath) {
  const ctx = vm.createContext({
    SpreadsheetApp: world.SpreadsheetApp, LockService: world.LockService,
    HtmlService: {}, ScriptApp: {}, console, Date, JSON
  });
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx, { filename: codePath });
  /* 画面との行き来は JSON になるので、ここでも JSON を通して realm をそろえる */
  const wrap = fn => (...args) => JSON.parse(JSON.stringify(ctx[fn](...JSON.parse(JSON.stringify(args))) ?? null));
  return { getState: wrap('getState'), putState: wrap('putState'), exportToSheet: wrap('exportToSheet'), ctx };
}

module.exports = { createWorld, loadServer };
