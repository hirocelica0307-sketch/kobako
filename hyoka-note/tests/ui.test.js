/* 評価ノート：画面(index.html)のテスト。本物のブラウザ(Chromium)で動かす
 * 実行: NODE_PATH=$(npm root -g) node --test hyoka-note/tests/ui.test.js
 * google.script.run を、Node の上で動かした Code.gs(gas-mock.js)につなぐ。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createWorld, loadServer, loadFixture } = require('./gas-mock');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const CODE = path.join(ROOT, 'Code.gs');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const OLD = require('./fixtures/old-v2.json');
const SHOTS = process.env.HN_SHOTS || '';     // 画面写真を保存するフォルダ(空なら保存しない)
const URL = 'https://hyoka.test/';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { if (browser) await browser.close(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// GAS の HtmlService と同じように、index.html を body に入れて開く
async function openApp(world, opt) {
  opt = opt || {};
  const srv = loadServer(world, CODE);
  const ctx = await browser.newContext({ viewport: opt.viewport || { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  ctx.on('page', p => p.close());   // 別タブ(ダウンロード・開く)は閉じる
  await page.exposeFunction('__gas', async json => { await sleep(opt.latency == null ? 25 : opt.latency); return srv.api(json); });
  await page.addInitScript(() => {
    window.google = { script: { get run() {
      const h = {};
      const r = {
        withSuccessHandler(f) { h.ok = f; return r; },
        withFailureHandler(f) { h.ng = f; return r; },
        api(j) { window.__gas(j).then(x => h.ok && h.ok(x), e => h.ng && h.ng(e)); }
      };
      return r;
    } } };
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  });
  await page.route(URL + '**', r => r.fulfill({ contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>評価ノート</title></head><body>' + HTML + '</body></html>' }));
  await page.goto(URL);
  return { page, srv, errors, ctx };
}
async function idle(page) {
  await page.waitForFunction(() => document.getElementById('ovl').style.display !== 'flex', null, { timeout: 15000 });
}
async function saved(page) {
  await page.waitForFunction(() => {
    const c = document.getElementById('saveChip');
    return c && c.textContent === '保存済み';
  }, null, { timeout: 15000 });
}
async function typePin(page, pin) {
  for (const d of pin) await page.keyboard.press(d);
  await page.keyboard.press('Enter');
}
async function shot(page, name, view) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !view });
}
function btn(page, name) { return page.getByRole('button', { name, exact: true }); }
async function noHScroll(page) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(w[0] <= w[1] + 1, '横にはみ出している: ' + w.join(' > '));
}
function recRows(world) {
  return world.active.getSheetByName('記録').dump().slice(1).filter(r => r[0] !== '');
}

/* ------------------------------------------------------------------ */
test('はじめて使う:合言葉 → クラス → 名簿 → 単元とテスト → 入力', async () => {
  const world = createWorld();
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉を決めてください').waitFor();
  await typePin(page, '2580');
  await page.getByText('もう一度入力してください').waitFor();
  await typePin(page, '2580');
  await idle(page);
  await page.getByText('ようこそ、評価ノートへ').waitFor();
  await shot(page, '01-start');

  await btn(page, 'クラスを作る').click();
  await page.fill('#sfName', '2年1組');
  await btn(page, '作成する').click();
  await idle(page);
  await page.getByText('はじめにやること').waitFor();
  await shot(page, '02-home-empty');

  await btn(page, '名簿を登録').click();
  await page.fill('#bulkRoster', '青山はると\n井上さくら\n上田そうた\n7 江口ゆい\n大野りく');
  await btn(page, 'まとめて追加').click();
  await idle(page);
  await page.getByText('名簿(5人)').waitFor();
  assert.equal(await page.inputValue('#rn_' + (await page.evaluate(() => S.b.students.find(s => s['名前'] === '江口ゆい')['児童ID']))), '7');
  await page.getByText('名簿ができました').waitFor();
  await btn(page, 'ホームへ').click();

  await btn(page, 'まとめて作る').click();
  await page.getByText('単元とテストをまとめて作る').first().waitFor();
  await page.fill('input[aria-label="単元1の名前"]', 'たし算');
  // 満点(思判表 / 知技)を 50 に
  const maxes = page.locator('#modalwrap input[type=number]:not([disabled])');
  assert.equal(await maxes.count(), 2);
  await maxes.nth(0).fill('50'); await maxes.nth(1).fill('50');
  await btn(page, 'まとめて保存').click();
  await idle(page);
  await page.locator('.unitbox').filter({ hasText: 'たし算' }).waitFor();
  await shot(page, '03-home-unit');

  await page.locator('.oppline').filter({ hasText: '単元テスト' }).click();
  await page.locator('#padCol .padname').waitFor();
  await shot(page, '04-entry');
  // パッドの 50 を押す → 1番の思判表に入り、次の子へ
  await page.locator('#padCol .numgrid .nbtn', { hasText: /^50$/ }).click();
  await page.waitForFunction(() => document.querySelector('.cell.on').dataset.cell === '1_0');
  // キーボードで 45 → Enter
  await page.keyboard.type('45'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.cell.on').dataset.cell === '2_0');
  await btn(page, '欠席').click();
  await btn(page, '除外する').click();
  await btn(page, '取消').click();   // 除外を取り消す
  assert.equal(await page.locator('[data-cell="3_0"]').textContent(), 'ー');
  // 範囲外はエラーの知らせ
  await page.keyboard.type('80'); await page.keyboard.press('Enter');
  await page.getByText('0〜50点の範囲で入力してください').waitFor();
  // 全員に同じ点(未入力の子だけ)
  await btn(page, '全員に同じ点').click();
  await page.fill('#faVal', '30');
  await btn(page, '入力する').click();
  await page.getByText(/2人に 30点 を入力しました/).waitFor();
  await saved(page);
  let rows = recRows(world);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r[5] || r[8]).sort(), ['30', '30', '45', '50', '欠'].sort());
  // まとめて取消
  await btn(page, '取消').click();
  await page.getByText('2件まとめて取り消しました').waitFor();
  await saved(page);
  rows = recRows(world);
  assert.equal(rows.length, 3);

  // 横に進む・1人ずつ入力
  await btn(page, '横に進む').click();
  await btn(page, '答案の順に1人ずつ').click();
  await page.locator('.numtile').first().click();
  await page.locator('#padCol .numgrid .nbtn', { hasText: /^40$/ }).click();
  await saved(page);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('これまでのデータ(元の版)で、すべての画面がエラーなく開く', async () => {
  const world = createWorld();
  loadFixture(world, OLD);
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉を入力してください').waitFor();
  await typePin(page, '0000');
  await page.getByText(/合言葉がちがいます/).waitFor();
  await typePin(page, '1234');
  await idle(page);
  await page.getByText('はじめにやること').waitFor();   // バックアップだけ残っている
  await page.getByRole('button', { name: 'バックアップを作成' }).waitFor();
  await shot(page, '10-old-home');

  // 算数を選ぶ
  await page.locator('.chip', { hasText: '算数' }).click();
  await page.locator('.unitbox').filter({ hasText: 'たし算' }).waitFor();
  // 成績一覧の4つのタブ
  await page.locator('.navbtn', { hasText: '成績一覧' }).click();
  await page.locator('table.gridtbl').waitFor();
  await shot(page, '11-list-kai');
  await page.selectOption('select.subjsel', { label: '算数' });
  await page.locator('.kaicell').first().waitFor();
  // 3段の見出しが、スクロールしても重ならない位置に固定されている
  const tops = await page.evaluate(() => [...document.querySelector('table.gridtbl').rows].slice(0, 3)
    .map(tr => [parseFloat(tr.querySelector('th:not(.stickL)').style.top || '0'), tr.getBoundingClientRect().height]));
  assert.equal(tops[0][0], 0);
  assert.ok(Math.abs(tops[1][0] - tops[0][1]) < 1 && Math.abs(tops[2][0] - (tops[0][1] + tops[1][1])) < 1, JSON.stringify(tops));
  await btn(page, '見取り').click();
  await btn(page, 'テスト').click();
  await btn(page, '観点別').click();
  for (const m of ['テストと見取り', 'テスト', '見取り', '最終評価']) await btn(page, m).click();
  await shot(page, '12-list-kanten');
  // 算数を受けない子(大野りく)は「—」
  const row = page.locator('tr', { hasText: '大野りく' });
  assert.ok((await row.locator('td.nores[title="この教科の対象外です"]').count()) >= 1);
  await btn(page, 'ボーダー').click();
  await btn(page, '未実施').click();
  await btn(page, '児童から見る').click();
  await btn(page, 'テストから見る').click();
  for (const t of ['1学期', '2学期', '3学期', '年間']) await page.locator('.seg button', { hasText: t }).first().click();

  // 最終評価を手で決める
  await btn(page, '観点別').click();
  await page.locator('tr', { hasText: '青山はると' }).locator('td.fincell').first().click();
  await page.getByText('の最終評価を決めます').waitFor();
  await btn(page, '閉じる').click();
  await btn(page, 'テストと見取り').click();
  await page.locator('tr', { hasText: '青山はると' }).locator('td.kancell').first().click();
  await page.getByText('の最終評価を決めます').waitFor();
  await page.locator('.stepbtn.B').click();
  await idle(page);
  await page.getByText('B で確定しました').waitFor();

  // Excel出力(観点別・単元ごと)
  await page.getByRole('button', { name: /Excel出力/ }).click();
  await idle(page);
  await page.getByText('Excelファイルの準備ができました').waitFor();
  await btn(page, '閉じる').click();
  await btn(page, '単元ごと').click();
  await page.getByRole('button', { name: /Excel出力/ }).click();
  await idle(page);
  await page.getByText('Excelファイルの準備ができました').waitFor();
  await btn(page, '閉じる').click();
  const out = world.active.sheets.filter(s => s.name.indexOf('出力_') === 0);
  assert.equal(out.length, 2);

  // 個人シート
  await page.locator('.jump', { hasText: '江口ゆい' }).first().click();   // 「=」で始まる名前
  await page.getByText('教科ごとの記録').waitFor();
  await btn(page, 'すべて開く').click();
  await btn(page, '懇談会用').click();
  await btn(page, '先生用').click();
  await page.fill('#memoBox', '計算が速くなった');
  await btn(page, 'メモを保存').click();
  await idle(page);
  await page.getByRole('button', { name: /Excel出力/ }).click();
  await idle(page);
  await page.getByText('Excelファイルの準備ができました').waitFor();
  await btn(page, '閉じる').click();
  await btn(page, '次の子 ›').click();
  await btn(page, '載せる項目').click();
  await btn(page, '保存').click();
  await idle(page);
  await shot(page, '13-person');
  // 個人シートの出力で「8/10」のような点が文字のまま
  const kojin = world.active.sheets.find(s => s.name.indexOf('出力_個人シート') === 0);
  const cells = [].concat(...kojin.dump());
  assert.ok(cells.some(v => typeof v === 'string' && /^\d+(\.\d+)?\/\d+$/.test(v)), '点/満点 が文字のまま');
  assert.ok(!cells.some(v => v instanceof Date), '日付に化けていない');

  // 全員印刷・使い方
  await page.goto(URL);   // 同じタブの再読み込み → 合言葉を聞かずに開く
  await page.locator('.navgrid').waitFor();
  await page.locator('.navbtn', { hasText: '成績一覧' }).click();
  await btn(page, '観点別').click();
  await page.getByRole('button', { name: /全員印刷/ }).click();
  await page.getByText('個人シート 一括印刷').waitFor();
  await page.getByRole('button', { name: /人分を印刷/ }).click();
  assert.equal(await page.evaluate(() => window.__printed), 1);
  await page.evaluate(() => go('guide'));
  await btn(page, 'すべて開く').click();
  await shot(page, '14-guide');

  // 設定のタブ
  await page.locator('#gearBtn').click();
  for (const t of ['名簿', '教科と基準', '評価のルール', 'データ', '合言葉']) {
    await page.locator('.seg button', { hasText: t }).click();
    await page.waitForTimeout(50);
  }
  await shot(page, '15-settings-pin');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('入力中に通行証が切れても、点は消えずに元の画面へ戻って保存される', async () => {
  const world = createWorld();
  loadFixture(world, OLD);
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉を入力してください').waitFor();
  await typePin(page, '1234');
  await idle(page);
  await page.locator('.chip', { hasText: '算数' }).click();
  await page.locator('.unitbox').filter({ hasText: 'ひき算' }).locator('.oppline').first().click();
  await page.locator('#padCol .padname').waitFor();
  const before = recRows(world).length;
  // 通行証を消す(6時間たった・キャッシュから消えた のと同じ)
  Object.keys(world.cache).forEach(k => delete world.cache[k]);
  await page.locator('[data-cell="0_0"]').click();
  await page.keyboard.type('77'); await page.keyboard.press('Enter');
  await page.getByText('しばらく使わなかったので、もう一度入力してください').waitFor({ timeout: 8000 });
  await page.getByText('保存していない点が 1件 あります').waitFor();
  await typePin(page, '1234');
  await idle(page);
  await page.locator('#padCol .padname').waitFor();   // 入力画面に戻る
  assert.equal(await page.locator('[data-cell="0_0"]').textContent(), '77');
  await saved(page);
  const r = recRows(world).find(x => x[5] === '77');
  assert.ok(r, '77点が保存されている');
  assert.equal(recRows(world).length, before);   // 既にあった記録の上書き
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('表も裏も同じ観点のテスト:面を足す・面を外すと確認が出る', async () => {
  const world = createWorld();
  loadFixture(world, OLD);
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉を入力してください').waitFor();
  await typePin(page, '1234');
  await idle(page);
  await page.locator('.chip', { hasText: '算数' }).click();
  const line = page.locator('.unitbox').filter({ hasText: 'たし算' }).locator('.oppline', { hasText: '単元テスト' });
  await line.getByRole('button', { name: /を編集/ }).click();
  await page.getByText('面(答案の表・裏)ごとの観点と満点').waitFor();
  await btn(page, '＋ 面を追加').click();
  await page.selectOption('select[aria-label="3枚目の観点"]', '知');
  await page.fill('input[aria-label="3枚目の満点"]', '20');
  await btn(page, '保存').click();
  await idle(page);
  const kanten = JSON.parse(world.active.getSheetByName('評価機会').dump().find(r => r[4] === '単元テスト' && r[6] === '1学期')[8]);
  assert.deepEqual(kanten.map(f => f.id || f.k), ['知', '思', '知2']);
  // 入力画面で3枚目に入れる
  await line.click();
  await page.locator('th', { hasText: '3枚目' }).click();
  await page.locator('#padCol .numgrid .nbtn', { hasText: /^20$/ }).click();
  await saved(page);
  assert.ok(recRows(world).some(r => /\|知2$/.test(r[0]) && r[5] === '20'));
  await shot(page, '20-entry-3faces');
  // 単元ごとの一覧で、同じ観点の面が名前つきで並ぶ
  await page.evaluate(() => { LV.tab = 'kai'; go('list'); });
  await page.selectOption('select.subjsel', { label: '算数' });
  await page.locator('.kaicell .fn', { hasText: '3枚目' }).first().waitFor();
  // 2枚目(思)を外す → 確認 → 記録が消える
  await page.evaluate(() => go('home'));
  await line.getByRole('button', { name: /を編集/ }).click();
  await page.locator('button[aria-label="2枚目を外す"]').click();
  await btn(page, '保存').click();
  await page.getByText('外す面の点が消えます').waitFor();
  await btn(page, '消して保存').click();
  await idle(page);
  const opp = world.active.getSheetByName('評価機会').dump().find(r => r[4] === '単元テスト' && r[6] === '1学期');
  assert.equal(recRows(world).filter(r => r[2] === opp[0] && r[4] === '思').length, 0);
  assert.ok(recRows(world).filter(r => r[2] === opp[0] && r[4] === '知').length > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('スマホの幅でも横にはみ出さない', async () => {
  const world = createWorld();
  loadFixture(world, OLD);
  const { page, errors, ctx } = await openApp(world, { viewport: { width: 390, height: 844 } });
  await page.getByText('合言葉を入力してください').waitFor();
  await noHScroll(page);
  await shot(page, '30-sp-lock');
  await page.locator('.keypad', { hasText: /^1$/ }).click();
  await page.locator('.keypad', { hasText: /^2$/ }).click();
  await page.locator('.keypad', { hasText: /^3$/ }).click();
  await page.locator('.keypad', { hasText: /^4$/ }).click();
  await btn(page, '決定').click();
  await idle(page);
  await page.locator('.navgrid').waitFor();
  await noHScroll(page);
  await shot(page, '31-sp-home');
  await page.locator('.chip', { hasText: '算数' }).click();
  await page.locator('.oppline', { hasText: '単元テスト' }).first().click();
  await page.locator('#padCol .padname').waitFor();
  await noHScroll(page);
  await page.locator('#padCol .numgrid .nbtn', { hasText: /^45$/ }).click();
  await shot(page, '32-sp-entry', true);   // 見えている範囲だけ(パッドに表が隠れていないか)
  // 選んでいるマスが、パッドの上に見えている
  const vis = await page.evaluate(() => {
    const c = document.querySelector('.cell.on').getBoundingClientRect();
    const p = document.getElementById('padCol').getBoundingClientRect();
    return c.bottom <= p.top + 1 && c.top >= 56;
  });
  assert.ok(vis, '選んでいるマスがパッドに隠れている');
  await page.evaluate(() => go('list'));
  await noHScroll(page);
  await shot(page, '33-sp-list');
  await page.evaluate(() => go('settings', 'roster'));
  await noHScroll(page);
  await shot(page, '34-sp-settings');
  await page.evaluate(() => go('person', S.b.students[0]['児童ID']));
  await noHScroll(page);
  await page.evaluate(() => openOppForm(S.b.opps[0]['機会ID']));
  await shot(page, '35-sp-oppform');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('持ち主でない人が最初に開くと、合言葉は決められず説明が出る', async () => {
  const world = createWorld({ activeUser: '' });
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉がまだ決まっていません').waitFor();
  await page.getByText('allowPinSetup').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
test('バックアップ → 読み込みが画面から行える', async () => {
  const world = createWorld();
  loadFixture(world, OLD);
  const { page, errors, ctx } = await openApp(world);
  await page.getByText('合言葉を入力してください').waitFor();
  await typePin(page, '1234');
  await idle(page);
  await btn(page, 'バックアップを作成').click();
  await idle(page);
  await page.getByText('バックアップができました').waitFor();
  await btn(page, '閉じる').click();
  // バックアップの案内(はじめにやること)は消える
  assert.equal(await page.getByText('はじめにやること').count(), 0);
  const bk = Object.values(world.books).find(b => /バックアップ/.test(b.name));
  await page.locator('#gearBtn').click();
  await page.locator('.seg button', { hasText: 'データ' }).click();
  await page.fill('#rsUrl', bk.getUrl());
  await btn(page, 'このバックアップを読み込む').click();
  await btn(page, '読み込む').click();
  await idle(page);
  await page.getByText(/行を読み込みました/).waitFor();
  await page.getByText(/読み込み前/).waitFor();
  await btn(page, 'OK').click();
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ------------------------------------------------------------------ */
// 画面のあちこちをでたらめに押して、エラーが出ないことを確かめる(シードを変えて何回か)
// HN_MONKEY=回数 で、シードの数をふやして長く回せる
const SEEDS = process.env.HN_MONKEY ? Array.from({ length: +process.env.HN_MONKEY }, (_, i) => 101 + i * 7) : [11, 23, 37];
const STEPS = process.env.HN_MONKEY ? 300 : 160;
for (const seed of SEEDS) {
  test('でたらめ操作でもエラーが出ない(seed ' + seed + ')', async () => {
    const world = createWorld();
    loadFixture(world, OLD);
    const { page, errors, ctx } = await openApp(world, { latency: 5 });
    await page.getByText('合言葉を入力してください').waitFor();
    await typePin(page, '1234');
    await idle(page);
    let s = seed;
    const rnd = n => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
    for (let i = 0; i < STEPS; i++) {
      // 危ない操作(すべて消す・名簿の削除など)も含めて押すが、確認の小窓では半分は「キャンセル」
      const handles = await page.$$('#dlgwrap[style*="flex"] button, #modalwrap[style*="flex"] button, #modalwrap[style*="flex"] .numtile');
      let pool = handles;
      if (!pool.length) pool = await page.$$('#app button:not([disabled]), #app .oppline, #app .cell, #app .jump, #app .numtile, #app .headcell, #app td.kancell, #hdr .brand, #gearBtn');
      if (!pool.length) break;
      const el = pool[rnd(pool.length)];
      try { if (await el.isVisible()) await el.click({ timeout: 1500 }); } catch (e) {}
      if (rnd(5) === 0) await page.keyboard.press(String(rnd(10)));
      if (rnd(9) === 0) await page.keyboard.press('Enter');
      await page.waitForTimeout(15);
    }
    await page.waitForTimeout(1500);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

/* ------------------------------------------------------------------ */
test('GAS の外(GitHub など)で開くと、使いかたの案内が出る', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(URL + '**', r => r.fulfill({ contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><head><meta charset="utf-8"></head><body>' + HTML + '</body></html>' }));
  await page.goto(URL);
  await page.getByText('Apps Script に貼り付けて使います').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});
