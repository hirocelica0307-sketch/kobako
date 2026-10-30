/* 画面のテスト。本物のブラウザ(Chromium)で動かす
 * 実行: NODE_PATH=$(npm root -g) node --test shoken-memo/tests/ui.test.js
 * スプレッドシート版は gas/画面.html を開き、google.script.run を Node の上の Code.gs につなぐ。
 * 先に node shoken-memo/build-gas.js で gas/画面.html を作っておくこと。
 * SM_SHOTS=フォルダ を付けると、画面写真をそこに保存する。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const { createWorld, loadServer } = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SM_SHOTS || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let browser, server, base;
test.before(async () => {
  browser = await chromium.launch();
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(p));
  }).listen(0);
  base = 'http://127.0.0.1:' + server.address().port + '/';
});
test.after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }

/* ブラウザ保存版を開く（はじめての設定を済ませる） */
async function openLocal(opt) {
  const t = await newPage(opt && opt.viewport);
  await t.page.goto(base + 'index.html');
  await t.page.waitForSelector('.dlg');                // はじめては設定が開く
  await t.page.fill('#s-count', String((opt && opt.count) || 32));
  await t.page.click('.dlg .btn.primary');
  await t.page.waitForSelector('.rbtn');
  return t;
}

/* スプレッドシート版を開く。latency で通信の遅さをまねる */
async function openSheet(world, opt) {
  opt = opt || {};
  const srv = loadServer(world, path.join(ROOT, 'gas', 'Code.gs'));
  const t = await newPage();
  const track = { inflight: 0, max: 0, puts: 0 };
  await t.page.exposeFunction('__gas', async (fn, args) => {
    if (fn === 'putState') { track.inflight++; track.max = Math.max(track.max, track.inflight); track.puts++; }
    await sleep(opt.latency == null ? 30 : opt.latency);
    try { return { ok: srv[fn](...args) }; }
    catch (e) { return { err: e.message }; }
    finally { if (fn === 'putState') track.inflight--; }
  });
  await t.page.addInitScript(() => {
    window.google = { script: { get run() {
      const h = {};
      const r = new Proxy({}, { get(_, name) {
        if (name === 'withSuccessHandler') return f => { h.ok = f; return r; };
        if (name === 'withFailureHandler') return f => { h.ng = f; return r; };
        return (...args) => window.__gas(name, args).then(x => x.err ? h.ng && h.ng(new Error(x.err)) : h.ok && h.ok(x.ok));
      } });
      return r;
    } } };
  });
  const html = fs.readFileSync(path.join(ROOT, 'gas', '画面.html'), 'utf8');
  await t.page.route('https://shoken.test/', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await t.page.goto('https://shoken.test/');
  await t.page.waitForSelector('.rbtn');
  return Object.assign(t, { srv, track });
}

const DRAFT_OK = '国語科「ごんぎつね」の学習では、文章の言葉をもとに登場人物の気持ちを考え、理由を示して自分の考えを発表することができました。掃除の時間には、だまって隅々まで床をふき、最後まで当番の仕事をやりとげることができました。';

test('ブラウザ保存版：今回書く種類だけで「完成」を数える', async () => {
  const { page, errors, ctx } = await openLocal();
  await shot(page, '01-memo');
  /* 3年2学期の初期値は「所見・総合」 */
  assert.match(await page.textContent('#ctx-btn'), /所見・総合的な学習の記録/);
  await page.click('nav [data-tab="pick"]');
  await page.fill('.draftbox textarea', DRAFT_OK);
  await page.waitForTimeout(100);
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-part/, '総合がまだなので書きかけ');
  await shot(page, '02-pick');
  /* 設定で「所見」だけにすると完成になる */
  await page.click('#btn-settings');
  await page.uncheck('#s-types input[data-type="sogo"]');
  await page.click('.dlg .btn.primary');
  await page.waitForTimeout(100);
  const cls = await page.getAttribute('.rbtn[data-no="1"]', 'class');
  assert.match(cls, /st-(ok|warn)/, cls);
  assert.match(await page.textContent('[data-badge="pick"]'), /完成 1\/32/);
  /* 読み込み直しても設定と本文が残っている */
  await page.reload();
  await page.waitForSelector('.rbtn');
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-(ok|warn)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('ブラウザ保存版：人数を減らすと、入力済みの番号を知らせ、データは消さない', async () => {
  const { page, errors, ctx } = await openLocal({ count: 32 });
  await page.click('.rbtn[data-no="31"]');
  await page.fill('#memo-subject', '31番のメモ');
  await page.waitForTimeout(600);
  await page.click('#btn-settings');
  await page.fill('#s-count', '30');
  await page.click('.dlg .btn.primary');
  assert.match(await page.textContent('.side .counts'), /メモだけ\s*1/, '名簿の下の集計が入力に合わせて変わる');
  await page.waitForSelector('.dlg h3:has-text("人数を30人にします")');
  assert.match(await page.textContent('.dlg .body'), /31番/);
  await shot(page, '03-count-warning');
  await page.click('.dlg .btn.primary');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.rbtn').count(), 30);
  /* 人数を戻すとまた出てくる */
  await page.click('#btn-settings');
  await page.fill('#s-count', '32');
  await page.click('.dlg .btn.primary');
  await page.click('.rbtn[data-no="31"]');
  assert.equal(await page.inputValue('#memo-subject'), '31番のメモ');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('ブラウザ保存版：別のタブが先に保存していたら、上書きせずにたずねる', async () => {
  const { page, errors, ctx } = await openLocal();
  const other = await ctx.newPage();
  await other.goto(base + 'index.html');
  await other.waitForSelector('.rbtn');
  await other.fill('#memo-subject', '別のタブで書いた');
  await other.waitForTimeout(700);
  await page.fill('#memo-subject', 'こちらで書いた');
  await page.waitForSelector('.dlg h3:has-text("先に保存されています")', { timeout: 3000 });
  await shot(page, '04-conflict');
  await page.click('.dlg .btn.primary');      // 向こうの内容を読み込む
  await page.waitForTimeout(200);
  assert.equal(await page.inputValue('#memo-subject'), '別のタブで書いた');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('スプレッドシート版：保存は常に1件ずつ送り、最後の内容が残る', async () => {
  const world = createWorld();
  const t = await openSheet(world, { latency: 400 });
  const { page, errors } = t;
  for (let i = 1; i <= 6; i++) {
    await page.click(`.rbtn[data-no="${i}"]`);
    await page.fill('#memo-subject', `${i}番のメモ`);
    await page.click('#term-seg button[data-term="2"]');   // ボタン操作ですぐ保存も混ぜる
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => /保存済み/.test(document.querySelector('#savestate').textContent), null, { timeout: 8000 });
  assert.equal(t.track.max, 1, '保存が同時に2件以上送られた');
  const s = t.srv.getState();
  for (let i = 1; i <= 6; i++) assert.equal(s.data['2'][i].memos.subject, `${i}番のメモ`);
  assert.deepEqual(errors, []);
  await t.ctx.close();
});

test('スプレッドシート版：ほかの端末が先に保存していたら止めてたずね、上書きも選べる', async () => {
  const world = createWorld();
  const t = await openSheet(world);
  const { page } = t;
  /* ほかの端末が保存したことにする */
  const other = t.srv.getState();
  other.data['2'][9] = { memos: { subject: 'ほかの端末' }, drafts: {}, cands: {}, pick: {} };
  t.srv.putState(other, other.rev);
  await page.fill('#memo-subject', 'この画面');
  await page.waitForSelector('.dlg h3:has-text("先に保存されています")', { timeout: 4000 });
  assert.match(await page.textContent('#savestate'), /ほかの画面/);
  assert.ok(!t.srv.getState().data['2'][1], 'まだ上書きしていない');
  await page.click('.dlg .btn.danger');        // この画面の内容で上書きする
  await page.waitForFunction(() => /保存済み/.test(document.querySelector('#savestate').textContent));
  assert.equal(t.srv.getState().data['2'][1].memos.subject, 'この画面');
  await t.ctx.close();
});

test('取り込み → 案を選ぶ → 仕上げ の流れ（すでに本文がある子はたずねる）', async () => {
  const { page, errors, ctx } = await openLocal();
  await page.fill('#memo-subject', '国語科で音読');
  await page.click('nav [data-tab="ai"]');
  await page.click('#btn-build');
  assert.match(await page.textContent('#promptout'), /#1/);
  await shot(page, '05-ai');
  const reply = `#1\n1) ${DRAFT_OK}\n※ 国語科C読むことをもとにしました\n2) ${DRAFT_OK.replace('掃除', '給食')}\n※ 生活面を給食に\n#2\n1) ${DRAFT_OK}\n※ x`;
  await page.fill('#pastearea', reply);
  await page.click('#btn-parse');
  await page.waitForSelector('#go-pick');
  /* もう一度取り込むと、すでに本文がある子についてたずねる */
  await page.click('#btn-parse');
  await page.waitForSelector('.dlg h3:has-text("すでに本文がある")');
  await page.click('.dlg .btn.primary');       // 新しい案を後ろに足す
  await page.click('#go-pick');
  assert.equal(await page.locator('.cand').count(), 4);
  await page.locator('.cand').nth(1).click();
  assert.match(await page.inputValue('.draftbox textarea'), /給食/);
  await shot(page, '06-pick-cands');
  await page.click('nav [data-tab="finish"]');
  await shot(page, '07-finish');
  await page.click('[data-open="2"]');
  assert.match(await page.textContent('.kid .num'), /2$/);
  assert.equal(await page.getAttribute('nav [data-tab="pick"]', 'class'), 'on', '仕上げの「直す」は案を選ぶ画面に行く');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('スマホの幅でも横にはみ出さない', async () => {
  const { page, errors, ctx } = await openLocal({ viewport: { width: 390, height: 800 } });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, '横にはみ出し: ' + over + 'px');
  await shot(page, '08-phone');
  assert.deepEqual(errors, []);
  await ctx.close();
});
