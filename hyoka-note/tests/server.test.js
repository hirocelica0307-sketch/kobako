/* 評価ノート：サーバー(Code.gs)のテスト
 * 実行: node --test hyoka-note/tests/server.test.js
 * GAS のまね(gas-mock.js)の上で Code.gs をそのまま動かす。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createWorld, loadServer, loadFixture } = require('./gas-mock');

const CODE = process.env.HN_CODE || path.join(__dirname, '..', 'Code.gs');
const OLD = require('./fixtures/old-v2.json');

function ok(r) { if (!r.ok) throw new Error('API エラー: ' + JSON.stringify(r)); return r.data; }
function fresh(opt) {
  const world = createWorld(opt);
  const srv = loadServer(world, CODE);
  return { world, srv };
}
// 合言葉を決めてクラスと名簿を作るところまで
function ready(opt) {
  const { world, srv } = fresh(opt);
  const tk = ok(srv.call('setPin', { newPin: '2468' })).token;
  const C = (a, p) => ok(srv.call(a, p, tk));
  C('setupClass', { name: '3年1組', nendo: '令和8' });
  C('addStudentsBulk', { list: [1, 2, 3, 4].map(i => ({ no: String(i), name: '児童' + i })) });
  return { world, srv, tk, C };
}
function fromOld(opt) {
  const world = createWorld(opt);
  loadFixture(world, OLD);
  const srv = loadServer(world, CODE);
  return { world, srv };
}

/* ---------------- 合言葉 ---------------- */
test('合言葉がないあいだも、データは1つも返さない', () => {
  const { srv } = fresh();
  const st = ok(srv.call('authState'));
  assert.equal(st.hasPin, false);
  assert.equal(st.canSetup, true);
  const r = srv.call('bundle');
  assert.equal(r.ok, false);
  assert.equal(r.auth, true);
});

test('持ち主でない人は、最初の合言葉を決められない', () => {
  const { srv, world } = fresh({ activeUser: '' });
  assert.equal(ok(srv.call('authState')).canSetup, false);
  const r = srv.call('setPin', { newPin: '1111' });
  assert.equal(r.ok, false);
  assert.match(r.error, /持ち主/);
  // エディタから allowPinSetup を実行すると決められる
  srv.allowPinSetup();
  assert.equal(world.active.toasts.length, 1);
  assert.ok(ok(srv.call('setPin', { newPin: '1111' })).token);
  // 1回決めたら、もう開いたままにしない
  assert.equal(world.props['pin_setup_open'], undefined);
});

test('合言葉の変更には、通行証と今の合言葉の両方がいる', () => {
  const { srv, tk } = ready();
  let r = srv.call('setPin', { oldPin: '2468', newPin: '1357' });   // 通行証なし
  assert.equal(r.ok, false); assert.equal(r.auth, true);
  r = srv.call('setPin', { oldPin: '0000', newPin: '1357' }, tk);
  assert.equal(r.ok, false); assert.match(r.error, /今の合言葉がちがいます/);
  const t2 = ok(srv.call('setPin', { oldPin: '2468', newPin: '1357' }, tk)).token;
  // 変えたら、前の通行証は使えなくなる
  assert.equal(srv.call('bundle', {}, tk).auth, true);
  assert.equal(srv.call('bundle', {}, t2).ok, true);
  assert.ok(ok(srv.call('login', { pin: '1357' })).token);
});

test('間違えた回数はアカウントごと。ほかの人が5回まちがえても持ち主は入れる', () => {
  const { srv, world } = ready();
  world.users.active = '';                        // 外の人(名前がわからない)
  for (let i = 0; i < 5; i++) assert.equal(srv.call('login', { pin: '0000' }).ok, false);
  const r = srv.call('login', { pin: '2468' });   // 正しくても待たされる
  assert.equal(r.ok, false); assert.match(r.error, /お待ちください/);
  world.users.active = 'owner@example.com';       // 持ち主
  assert.ok(ok(srv.call('login', { pin: '2468' })).token);
  // メールアドレスはプロパティに残さない
  assert.ok(Object.keys(world.props).every(k => k.indexOf('@') < 0));
});

test('通行証は使っているあいだ のびる。使わずに6時間たつと切れる', () => {
  const { srv, world, tk } = ready();
  world.clock.offset = 5 * 3600 * 1000;
  assert.equal(srv.call('bundle', {}, tk).ok, true);   // 5時間後に使う → のびる
  world.clock.offset = 10 * 3600 * 1000;
  assert.equal(srv.call('bundle', {}, tk).ok, true);   // 前に使ってから5時間
  world.clock.offset = 17 * 3600 * 1000;
  assert.equal(srv.call('bundle', {}, tk).auth, true); // 7時間あいた
});

test('resetPin で鍵を外すと、それまでの通行証も使えなくなる。決め直せるのは持ち主だけ', () => {
  const { srv, tk, world } = ready();
  srv.resetPin();
  assert.equal(srv.call('bundle', {}, tk).auth, true);
  assert.equal(ok(srv.call('authState')).hasPin, false);
  world.users.active = '';
  assert.equal(srv.call('setPin', { newPin: '1111' }).ok, false);
  world.users.active = 'owner@example.com';
  assert.ok(ok(srv.call('setPin', { newPin: '9999' })).token);
});

test('ふだんの1回の保存で、合言葉のシートを読みに行かない(軽い)', () => {
  const { srv, world, tk, C } = ready();
  const b = C('bundle');
  const o = C('createUnitsBulk', { subjectId: b.subjects[0]['教科ID'], units: [{ name: 'u', term: '1学期', opps: [{ name: 't', type: 'テスト', kanten: JSON.stringify([{ k: '知', max: 10 }]) }] }] });
  assert.equal(o.opps, 1);
  const opp = C('bundle').opps[0];
  world.resetStats();
  ok(srv.call('saveRecords', { records: [{ oppId: opp['機会ID'], stuId: b.students[0]['児童ID'], kan: '知', raw: '7', max: '10' }] }, tk));
  assert.equal(world.stats.byName.hideSheet || 0, 0);
  assert.ok(world.stats.calls < 40, '呼び出し回数 ' + world.stats.calls);
});

/* ---------------- これまでのデータ ---------------- */
test('元の版のデータをそのまま読める(合言葉もそのまま)', () => {
  const { srv, world } = fromOld();
  assert.equal(ok(srv.call('authState')).hasPin, true);
  assert.equal(srv.call('login', { pin: '0000' }).ok, false);
  const tk = ok(srv.call('login', { pin: '1234' })).token;
  const b = ok(srv.call('bundle', {}, tk));
  assert.equal(b.cls['クラス名'], '2年D組');
  assert.equal(b.students.length, 6);
  assert.equal(b.students[3]['名前'], '=江口ゆい');   // 「=」で始まる名前も文字のまま
  // 記録の件数は変わらない(古い形式の名残も含めて)
  assert.equal(b.recs.length, OLD.sheets['記録'].length - 1);
  // 古い「欠」は状態の列へ
  const v1 = b.recs.find(r => /\|知x$/.test(r[0]));
  assert.deepEqual([v1[1], v1[3]], ['', '欠']);
  // 教科対象外(設定のJSON) → 履修除外シート
  assert.equal(b.exempt.length, 1);
  assert.ok(!b.settings.some(s => s['キー'] === '教科対象外'));
  // 設定に紛れていた所見 → 所見シート
  assert.equal(b.shoken.length, 2);
  assert.ok(!b.settings.some(s => s['キー'].indexOf('所見|') === 0));
  // 非表示教科 → 有効列
  assert.equal(b.subjects.find(s => s['教科名'] === '道徳')['有効'], '0');
  assert.equal(b.subjects.find(s => s['教科名'] === '家庭')['有効'], '0');
  // 古い「間違えた回数」は片づく
  assert.equal(world.props['auth_fail'], undefined);
  assert.equal(world.props['hyokanote_setup_v3'], '1');
  // 行番号は送らない
  assert.equal(JSON.stringify(b).indexOf('_row'), -1);
});

test('移行は何度走っても同じ結果になる', () => {
  const { srv, world } = fromOld();
  const tk = ok(srv.call('login', { pin: '1234' })).token;
  const b1 = ok(srv.call('bundle', {}, tk));
  delete world.props['hyokanote_setup_v3'];
  const b2 = ok(srv.call('bundle', {}, tk));
  assert.deepEqual(b2.exempt.map(r => r['キー']), b1.exempt.map(r => r['キー']));
  assert.equal(b2.shoken.length, b1.shoken.length);
  assert.equal(b2.recs.length, b1.recs.length);
});

/* ---------------- 記録・面 ---------------- */
test('記録の追加・書きかえ・消去', () => {
  const { C } = ready();
  const b = C('bundle');
  C('createUnitsBulk', { subjectId: b.subjects[2]['教科ID'], units: [{ name: 'たし算', term: '1学期', opps: [{ name: 'テスト', type: 'テスト', kanten: JSON.stringify([{ k: '知', max: 50 }, { k: '思', max: 50 }]) }] }] });
  const opp = C('bundle').opps[0];
  const s = b.students.map(x => x['児童ID']);
  const R = (i, kan, raw, state, memo) => ({ oppId: opp['機会ID'], stuId: s[i], kan, raw, state: state || '', memo: memo || '', max: '50' });
  C('saveRecords', { records: [R(0, '知', '40'), R(1, '知', '', '欠'), R(2, '思', '30', '', 'メモ'), R(3, '知', '10'), R(3, '知', '12')] });
  let recs = C('bundle').recs;
  assert.equal(recs.length, 4);
  assert.equal(recs.find(r => r[0].indexOf(s[3]) > 0)[1], '12');      // 同じ送信で2回 → あと勝ち
  C('saveRecords', { records: [R(0, '知', '45'), R(1, '知', ''), R(2, '思', '')] });
  recs = C('bundle').recs;
  assert.equal(recs.length, 2);
  assert.equal(recs.find(r => r[0].indexOf(s[0]) > 0)[1], '45');
});

test('同じ観点の面を2つ持てる(表も裏も知技)。外した面の記録は消え、満点は追従する', () => {
  const { C } = ready();
  const b = C('bundle');
  const s = b.students.map(x => x['児童ID']);
  const k1 = JSON.stringify([{ k: '知', max: 50, label: '表' }, { k: '知', id: '知2', max: 50, label: '裏' }, { k: '思', max: 20 }]);
  const o = C('saveOpp', { subjectId: b.subjects[0]['教科ID'], unitId: '', name: '漢字', type: 'テスト', term: '1学期', kanten: k1 });
  C('saveRecords', { records: [
    { oppId: o.id, stuId: s[0], kan: '知', raw: '40', max: '50' },
    { oppId: o.id, stuId: s[0], kan: '知2', raw: '30', max: '50' },
    { oppId: o.id, stuId: s[0], kan: '思', raw: '15', max: '20' }] });
  assert.equal(C('bundle').recs.length, 3);
  // 思 の面を外し、裏の満点を 100 に
  const k2 = JSON.stringify([{ k: '知', max: 50, label: '表' }, { k: '知', id: '知2', max: 100, label: '裏' }]);
  C('saveOpp', { id: o.id, name: '漢字', unitId: '', term: '1学期', date: '', kanten: k2 });
  const recs = C('bundle').recs;
  assert.equal(recs.length, 2);
  assert.equal(recs.find(r => /\|知2$/.test(r[0]))[4], '100');
});

test('教科を受けない児童(setRoster)は1か所にまとまる', () => {
  const { C } = ready();
  const b = C('bundle');
  const sid = b.subjects[1]['教科ID'], s = b.students.map(x => x['児童ID']);
  C('setRoster', { subjId: sid, offIds: [s[0], s[1], s[1], 'うそのID'] });
  assert.deepEqual(C('bundle').exempt.map(r => r['児童ID']).sort(), [s[0], s[1]].sort());
  C('setRoster', { subjId: sid, offIds: [s[2]] });
  assert.deepEqual(C('bundle').exempt.map(r => r['児童ID']), [s[2]]);
  C('deleteStudent', { id: s[2] });
  assert.equal(C('bundle').exempt.length, 0);
});

test('まとめて消すとき、書き込みは1回だけ(途中で止まっても全部は消えない)', () => {
  const { C, world, srv, tk } = ready();
  const b = C('bundle');
  const o = C('saveOpp', { subjectId: b.subjects[0]['教科ID'], unitId: '', name: 't', type: 'テスト', term: '1学期', kanten: JSON.stringify([{ k: '知', max: 10 }]) });
  C('saveRecords', { records: b.students.map((st, i) => ({ oppId: o.id, stuId: st['児童ID'], kan: '知', raw: String(i), max: '10' })) });
  world.resetStats();
  ok(srv.call('deleteStudent', { id: b.students[1]['児童ID'] }, tk));
  assert.equal(world.stats.byName.clearContent || 0, 0);
  const recs = C('bundle').recs;
  assert.equal(recs.length, 3);
  // 空いた行は詰められて、最後の行は空になる
  const sh = world.active.getSheetByName('記録');
  assert.equal(sh.getLastRow(), 4);
});

test('並べかえ・番号の振り直し・基準の一括変更は、まとめて1回で書く', () => {
  const { C, world, srv, tk } = ready();
  world.resetStats();
  ok(srv.call('renumberStudents', {}, tk));
  assert.ok((world.stats.byName.setValues || 0) <= 1);
  world.resetStats();
  ok(srv.call('saveSubjectsBulk', { a: '80', b: '50' }, tk));
  assert.ok((world.stats.byName.setValues || 0) <= 1);
  assert.ok(C('bundle').subjects.every(s => s['A閾値'] === '80' && s['B閾値'] === '50'));
});

/* ---------------- 出力 ---------------- */
test('Excel出力で「45/50」が日付に、「=」で始まる名前が数式に化けない', () => {
  const { C, world } = ready();
  const r = C('exportKojin', { title: 't', note: 'n', blocks: [{ heading: '国語', header: ['名前', '点', '%'], rows: [['=江口', '8/10', '80'], ['青山', '45/50', 90]] }] });
  assert.match(r.url, /export\?format=xlsx&gid=/);
  const sh = world.active.sheets.find(s => s.name.indexOf('出力_個人シート') === 0);
  const v = sh.dump();
  const row = v.find(x => x[0] === '=江口');
  assert.ok(row, '名前が文字のまま残る');
  assert.equal(row[1], '8/10');
  assert.equal(row[2], 80);                      // 数は数のまま
  assert.equal(v.find(x => x[0] === '青山')[1], '45/50');
});

test('直す前の版では、Excel出力で「8/10」が日付に化けていた(不具合の再現)', () => {
  // 元の版の Code.gs は git の履歴にある。ここでは同じ書き方(テキスト書式なしで setValues)を再現して確かめる
  const world = createWorld();
  const sh = world.active.insertSheet('x');
  sh.getRange(1, 1, 1, 2).setValues([['8/10', '=江口']]);
  assert.ok(sh.dump()[0][0] instanceof Date);
  assert.ok(sh.dump()[0][1].formula);
});

test('列が26より多い出力(12教科×3観点×7列)でもエラーにならない', () => {
  const { C, world } = ready();
  const wide = []; for (let i = 0; i < 254; i++) wide.push('列' + i);
  const rows = []; for (let i = 0; i < 1200; i++) rows.push([String(i), '名前']);
  C('exportSeiseki', { title: 't', note: '', header: [wide], rows });
  const sh = world.active.sheets.find(s => s.name.indexOf('出力_観点別一覧') === 0);
  assert.equal(sh.dump()[3].length, 254);
  assert.equal(sh.getLastRow(), 3 + 1 + 1200);
});

test('同じ秒に2回出力してもエラーにならない。古い出力は2枚まで', () => {
  const { C, world } = ready();
  for (let i = 0; i < 4; i++) C('exportSeiseki', { title: 't', header: [['a']], rows: [['1']] });
  const outs = world.active.sheets.filter(s => s.name.indexOf('出力_観点別一覧') === 0);
  assert.equal(outs.length, 3);
});

/* ---------------- バックアップ ---------------- */
test('バックアップ → 変更 → 読み込みで元に戻る。読み込む前の状態も自動で控える', () => {
  const { C, world } = ready();
  const b = C('bundle');
  const o = C('saveOpp', { subjectId: b.subjects[0]['教科ID'], unitId: '', name: 't', type: 'テスト', term: '1学期', kanten: JSON.stringify([{ k: '知', max: 10 }]) });
  C('saveRecords', { records: [{ oppId: o.id, stuId: b.students[0]['児童ID'], kan: '知', raw: '9', max: '10' }] });
  const bk = C('createBackup');
  assert.match(bk.name, /^評価ノート_バックアップ_/);
  C('addStudentsBulk', { list: [{ no: '5', name: '転入生' }] });
  C('saveRecords', { records: [{ oppId: o.id, stuId: b.students[0]['児童ID'], kan: '知', raw: '', max: '10' }] });
  const r = C('restoreBackup', { url: bk.url });
  assert.ok(r.pre && /読み込み前/.test(r.pre.name));
  const after = C('bundle');
  assert.equal(after.students.length, 4);
  assert.equal(after.recs.length, 1);
  assert.equal(after.recs[0][1], '9');
  // 読み込み前の控えには転入生が入っている
  const preBook = Object.values(world.books).find(x => x.name === r.pre.name);
  assert.equal(preBook.getSheetByName('名簿').getLastRow(), 6);
});

test('古い形式のバックアップ(履修除外シートなし・設定にJSON)を読み込むと、移行もされる', () => {
  const { C, world } = ready();
  const src = world.SpreadsheetApp.create('評価ノート_バックアップ_古い');
  Object.keys(OLD.sheets).forEach(n => {
    if (n === '履修除外' || n === '端末設定' || n === 'シート1') return;
    const sh = src.insertSheet(n);
    OLD.sheets[n].forEach((row, i) => row.forEach((v, j) => { sh.cells[(i + 1) + ',' + (j + 1)] = v; }));
  });
  C('restoreBackup', { url: src.getUrl() });
  const b = C('bundle');
  assert.equal(b.cls['クラス名'], '2年D組');
  assert.equal(b.exempt.length, 1);
  assert.equal(b.students.length, 6);
});

test('バックアップでないファイル・自分自身のURLは読み込まない', () => {
  const { srv, tk, world } = ready();
  const other = world.SpreadsheetApp.create('ちがうファイル');
  let r = srv.call('restoreBackup', { url: other.getUrl() }, tk);
  assert.equal(r.ok, false); assert.match(r.error, /バックアップではない/);
  r = srv.call('restoreBackup', { url: world.active.getUrl() }, tk);
  assert.equal(r.ok, false); assert.match(r.error, /自身/);
  r = srv.call('restoreBackup', { url: 'てきとう' }, tk);
  assert.equal(r.ok, false); assert.match(r.error, /URL/);
});

/* ---------------- そのほか ---------------- */
test('すべて消すと、クラスが無い状態に戻る', () => {
  const { C } = ready();
  C('resetAll');
  assert.equal(C('bundle').cls, null);
  C('setupClass', { name: '新', nendo: '' });
  assert.equal(C('bundle').students.length, 0);
});

test('単元の複製で、面の単元も新しい単元に付けかわる', () => {
  const { C } = ready();
  C('createExample');
  const b = C('bundle');
  const u = b.units.find(x => x['単元名'] === 'スイミー(記入例)');
  const r = C('duplicateUnit', { unitId: u['単元ID'], newName: 'スイミー2', term: '2学期' });
  const o = C('bundle').opps.find(x => x['単元ID'] === r.unitId && x['機会名'] === 'ワークテスト(記入例)');
  const fs = JSON.parse(o['観点構成']);
  assert.equal(fs[0].unit, r.unitId);
  assert.notEqual(fs[1].unit, r.unitId);   // ちがう単元(漢字の広場)を指していた面はそのまま
});

test('知らないアクションはエラーで返す(落ちない)', () => {
  const { srv, tk } = ready();
  const r = srv.call('nanika', {}, tk);
  assert.equal(r.ok, false);
  assert.match(r.error, /不明なアクション/);
  assert.equal(JSON.parse(srv.api('{こわれたJSON')).ok, false);
});
