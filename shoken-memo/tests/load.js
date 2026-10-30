/* テスト用：rules/*.js と engine.js を Node で読み込む */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function load() {
  const win = {};
  const ctx = vm.createContext({ window: win, globalThis: win, console });
  ['rules/course-of-study.js', 'rules/shoken-rules.js', 'engine.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  const R = win.SHOKEN_RULES, CS = win.COURSE_OF_STUDY;
  return { R, CS, E: win.ShokenEngine.create(R, CS) };
}

module.exports = { load, ROOT };
