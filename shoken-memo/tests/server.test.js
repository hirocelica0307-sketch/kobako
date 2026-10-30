/* サーバー（gas/Code.gs）のテスト
 * 実行: node --test shoken-memo/tests/server.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createWorld, loadServer } = require('./gas-mock');

const CODE = path.join(__dirname, '..', 'gas', 'Code.gs');
const fresh = () => { const w = createWorld(); return { w, srv: loadServer(w, CODE) }; };

function stateWith(srv, fn) { const s = srv.getState(); fn(s); return s; }
const kid = (memo, draft) => ({ memos: { subject: memo }, drafts: draft ? { shoken: draft } : {}, cands: {}, pick: {} });

test('はじめての読み込みでシートができ、保存番号は 0', () => {
  const { w, srv } = fresh();
  const s = srv.getState();
  assert.equal(s.rev, 0);
  assert.deepEqual(['設定', '所見データ', '案', '記録メモ帳'].map(n => !!w.book.getSheetByName(n)), [true, true, true, true]);
});

test('保存すると保存番号が1つ進み、読み込み直すと同じ内容に戻る', () => {
  const { srv } = fresh();
  const s = stateWith(srv, s => {
    s.write = { 1: ['shoken'], 2: ['shoken', 'sogo'], 3: ['shoken', 'doutoku'] };
    s.data['2'][3] = kid('国語科で音読', '国語科「ごんぎつね」の学習では…');
    s.data['2'][3].cands = { shoken: [{ text: '案A', note: '工夫A' }, { text: '案B', note: '' }] };
    s.data['2'][3].pick = { shoken: 1 };
  });
  const r = srv.putState(s, 0);
  assert.deepEqual(r, { ok: true, rev: 1 });
  const back = srv.getState();
  assert.equal(back.rev, 1);
  assert.deepEqual(back.write['2'], ['shoken', 'sogo']);
  assert.equal(back.data['2'][3].memos.subject, '国語科で音読');
  assert.equal(back.data['2'][3].cands.shoken[1].text, '案B');
  assert.equal(back.data['2'][3].pick.shoken, 1);
});

test('ほかの端末が先に保存していたら、上書きしない（食い違いを返す）', () => {
  const { srv } = fresh();
  const a = stateWith(srv, s => { s.data['2'][1] = kid('端末Aのメモ'); });
  const b = stateWith(srv, s => { s.data['2'][2] = kid('端末Bのメモ'); });
  assert.deepEqual(srv.putState(a, a.rev), { ok: true, rev: 1 });
  /* B は古い保存番号(0)のまま送ってくる */
  assert.deepEqual(srv.putState(b, b.rev), { conflict: true, rev: 1 });
  const now = srv.getState();
  assert.equal(now.data['2'][1].memos.subject, '端末Aのメモ', 'A の内容が残っている');
  assert.ok(!now.data['2'][2], 'B の内容で上書きされていない');
  /* 先生が「この画面の内容で上書きする」を選んだときだけ上書きする */
  assert.deepEqual(srv.putState(b, b.rev, true), { ok: true, rev: 2 });
  assert.equal(srv.getState().data['2'][2].memos.subject, '端末Bのメモ');
});

test('人数を減らしても、大きい番号のデータは消えない', () => {
  const { srv } = fresh();
  let s = stateWith(srv, s => { s.meta.count = 35; s.data['2'][34] = kid('34番のメモ', '34番の所見'); });
  srv.putState(s, 0);
  s = srv.getState();
  s.meta.count = 30;
  srv.putState(s, s.rev);
  const back = srv.getState();
  assert.equal(back.meta.count, 30);
  assert.equal(back.data['2'][34].drafts.shoken, '34番の所見');
});

test('「=」で始まるメモや「10/5」のようなメモが、数式や日付に化けない', () => {
  const { w, srv } = fresh();
  const s = stateWith(srv, s => {
    s.data['1'][5] = kid('=SUM(A1)を使った');
    s.data['1'][6] = kid('10/5');
    s.data['1'][7] = kid('12');
    s.stock['1'] = '=メモ';
  });
  srv.putState(s, 0);
  const back = srv.getState();
  assert.equal(back.data['1'][5].memos.subject, '=SUM(A1)を使った');
  assert.equal(back.data['1'][6].memos.subject, '10/5');
  assert.equal(back.data['1'][7].memos.subject, '12');
  assert.equal(back.stock['1'], '=メモ');
  const cells = w.book.getSheetByName('所見データ').dump().flat();
  assert.ok(!cells.some(v => v && typeof v === 'object' && !(v instanceof Date)), '数式になったセルがある');
});

test('前の版のシート（保存番号の行が無い）もそのまま読めて、保存できる', () => {
  const { w, srv } = fresh();
  srv.getState();
  const st = w.book.getSheetByName('設定');
  st.getRange('A1:B5').setValues([['項目', '値'], ['年度', 'R7'], ['学年', 4], ['人数', 30], ['学期', '3']]);
  st.getRange('A7').setValue('※ この画面で直接直しても…');
  const s = srv.getState();
  assert.equal(s.rev, 0);
  assert.equal(s.meta.grade, '4');
  assert.equal(s.write, null, '書く種類は画面が学年の初期値で埋める');
  assert.deepEqual(srv.putState(s, 0), { ok: true, rev: 1 });
});
