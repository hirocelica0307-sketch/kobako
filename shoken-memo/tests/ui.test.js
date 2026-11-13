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

test('名簿のチェックは先生がつける（教科・生活などの項目ごと）', async () => {
  const { page, errors, ctx } = await openLocal();
  await shot(page, '01-memo');
  /* 3年2学期の初期値は「所見・総合」→ チェック項目は 教科・生活・総合 */
  assert.match(await page.textContent('#ctx-btn'), /所見・総合的な学習の記録/);
  assert.deepEqual(await page.$$eval('#kid-checks [data-ck]', els => els.map(e => e.dataset.ck)), ['subject', 'life', 'sogo']);
  /* 本文を書いても、名簿の状態は自動では変わらない */
  await page.click('nav [data-tab="pick"]');
  await page.fill('.draftbox textarea', DRAFT_OK);
  await page.waitForTimeout(100);
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-none/);
  /* 教科と生活にチェック → チェック途中 */
  await page.click('#kid-checks [data-ck="subject"]');
  await page.click('#kid-checks [data-ck="life"]');
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-part/);
  assert.equal(await page.locator('.rbtn[data-no="1"] .pips i.on').count(), 2);
  await shot(page, '02-pick');
  /* 総合も付ける → すべてチェック済み */
  await page.click('#kid-checks [data-ck="sogo"]');
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-done/);
  assert.match(await page.textContent('[data-badge="pick"]'), /チェック 1\/32/);
  /* 設定で「行事」もチェック項目にすると、まだの項目が増えてチェック途中に戻る */
  await page.click('#btn-settings');
  await page.check('#s-checks input[data-ck="event"]');
  await page.click('.dlg .btn.primary');
  await page.waitForTimeout(100);
  assert.match(await page.getAttribute('.rbtn[data-no="1"]', 'class'), /st-part/);
  /* 読み込み直してもチェックが残っている */
  await page.reload();
  await page.waitForSelector('.rbtn');
  assert.equal(await page.locator('.rbtn[data-no="1"] .pips i.on').count(), 3);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('要修正・注意の指摘は「確認した」で消せて、仕上げの数にも入らない', async () => {
  const { page, errors, ctx } = await openLocal();
  await page.click('nav [data-tab="pick"]');
  /* 字数が少ない（注意）＋「上手に」（要修正） */
  await page.fill('.draftbox textarea', '国語科「音読」の学習では、上手に音読することができました。掃除の時間には、床をふきました。');
  await page.waitForTimeout(100);
  assert.equal(await page.textContent('.draftbox [data-lv]'), '要修正');
  const n0 = await page.locator('.draftbox .issue').count();
  await page.locator('.draftbox .issue', { hasText: '上手に' }).locator('button:has-text("確認した")').click();
  assert.equal(await page.locator('.draftbox .issue').count(), n0 - 1);
  assert.notEqual(await page.textContent('.draftbox [data-lv]'), '要修正');
  assert.match(await page.textContent('.draftbox .dismissed'), /確認済みにした指摘：1件/);
  /* すべて確認済みにする → 残りなし */
  if (await page.locator('[data-dismiss-all]').count()) await page.click('[data-dismiss-all]');
  else await page.locator('.draftbox .issue button:has-text("確認した")').first().click();
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.draftbox .issue').count(), 0);
  assert.equal(await page.textContent('.draftbox [data-lv]'), 'OK');
  await shot(page, '12-dismiss');
  /* 仕上げでも数えない */
  await page.click('nav [data-tab="finish"]');
  assert.match(await page.textContent('.sumbox.err'), /^0/);
  assert.match(await page.textContent('.sumbox.ok'), /^1/);
  /* 表示に戻せる */
  await page.click('nav [data-tab="pick"]');
  await page.click('[data-undo-dismiss]');
  assert.equal(await page.textContent('.draftbox [data-lv]'), '要修正');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('名前を入れられる（AIへのプロンプトには入らない）', async () => {
  const { page, errors, ctx } = await openLocal({ count: 4 });
  await page.click('#btn-names');
  await page.click('.dlg details.more > summary');
  await page.fill('#nm-paste', '山田 花子\n佐藤 太郎\n\n鈴木 一郎');
  await page.click('#nm-fill');
  await page.click('.dlg .btn.primary');
  await page.waitForTimeout(100);
  /* 名簿に名前が出る（3番は空のまま） */
  assert.match(await page.textContent('.rbtn[data-no="1"]'), /山田 花子/);
  assert.match(await page.textContent('.rbtn[data-no="4"]'), /鈴木 一郎/);
  assert.match(await page.textContent('.kid'), /山田 花子/);
  await shot(page, '13-names');
  /* メモに名前が入っていても、プロンプトでは消える */
  await page.fill('#memo-subject', '国語科で山田さんが佐藤と音読を練習した');
  await page.click('nav [data-tab="ai"]');
  await page.click('#btn-build');
  const prompt = await page.textContent('#promptout');
  assert.ok(!/山田|佐藤|花子|太郎/.test(prompt), '名前がプロンプトに入っている');
  assert.match(prompt, /（名前）さんが（名前）と音読/);
  assert.match(await page.textContent('#p-names'), /#1 のメモに名簿の名前/);
  /* 所見に名簿の名前が入ると要修正 */
  await page.click('nav [data-tab="pick"]');
  await page.fill('.draftbox textarea', '国語科では、佐藤と音読を練習しました。');
  await page.waitForTimeout(100);
  assert.match(await page.textContent('.draftbox .issues'), /名簿の名前が入っています/);
  /* 仕上げ：名前を入れて書き出せる */
  await page.click('nav [data-tab="finish"]');
  assert.match(await page.textContent('#listbody'), /山田 花子/);
  await page.check('#l-name');
  assert.ok(await page.isChecked('#l-name'));
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
  assert.match(await page.textContent('[data-badge="memo"]'), /1\/32/, 'メモの数が入力に合わせて変わる');
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

test('クラス全体の書き分け：プロンプト・案の話題・偏りの表と切りかえ', async () => {
  const { page, errors, ctx } = await openLocal({ count: 8 });
  /* 6人が国語科・掃除の所見（案2は算数科・給食）、7・8番はメモだけ */
  await page.evaluate(() => {
    const key = 'shoken.v1.R7-3';
    const st = JSON.parse(localStorage.getItem(key));
    for (let n = 1; n <= 6; n++) {
      const k = `国語科「ごんぎつね」の学習では、${n}番は文章の言葉をもとに考えを書きました。掃除の時間には、床をふきました。`;
      const s = `算数科「わり算」では、${n}番は図に表して考え方を説明しました。給食の時間には、配ぜんを手伝いました。`;
      st.write = { 1: ['shoken'], 2: ['shoken'], 3: ['shoken'] };
      st.variety = { share: 0.25 };
      st.data['2'][n] = { memos: { subject: '国語科「ごんぎつね」で考えを書いた。算数科のわり算', life: '掃除と給食' },
        drafts: { shoken: k }, cands: { shoken: [{ text: k, note: '' }, { text: s, note: '' }] }, pick: { shoken: 0 } };
    }
    st.data['2'][7] = { memos: { subject: '国語科「ごんぎつね」の音読', life: '掃除' }, drafts: {}, cands: {}, pick: {} };
    st.data['2'][8] = { memos: { subject: '国語科「ごんぎつね」の音読をした', life: '掃除をした' }, drafts: {}, cands: {}, pick: {} };
    st.rev = (st.rev || 0);
    localStorage.setItem(key, JSON.stringify(st));
  });
  await page.reload();
  await page.waitForSelector('.rbtn');

  /* メモ画面：材料の表示 */
  assert.match(await page.textContent('#material'), /国語科.*ごんぎつね.*掃除/);

  /* プロンプト：配分と、似たメモの子 */
  await page.click('nav [data-tab="ai"]');
  await page.selectOption('#p-scope', 'todo');
  await page.click('#btn-build');
  const prompt = await page.textContent('#promptout');
  assert.match(prompt, /# クラス全体での書き分け/);
  assert.match(prompt, /同じ教科は、クラス全体で3人までを目安/);
  assert.match(prompt, /8人）で5人まで。必ず守る/);
  assert.match(prompt, /「ごんぎつね」 6人（上限に達しています。取り上げない）/);
  assert.match(prompt, /国語科 6人（目安に達しています/);
  assert.match(prompt, /同じ単元・教材「ごんぎつね」：#7・#8/);
  assert.match(prompt, /メモがよく似ている：#7・#8/);
  assert.match(prompt, /各児童の案1には、下の配分とこの回のほかの児童の案1を見て/);

  /* 案を選ぶ：各案の話題と「多い」 */
  await page.click('nav [data-tab="pick"]');
  assert.match(await page.textContent('.cand .tchip.hot'), /国語科/);
  await shot(page, '09-pick-topics');

  /* 仕上げ：偏りの表と切りかえ */
  await page.click('nav [data-tab="finish"]');
  assert.match(await page.textContent('#variety'), /上限・目安を超えているもの：.*国語科.*6人.*「ごんぎつね」.*6人（5人まで）/);
  assert.equal(await page.locator('[data-swap]').count(), 3);
  await shot(page, '10-variety');
  await page.click('#swap-all');
  await page.waitForTimeout(100);
  assert.match(await page.textContent('#variety'), /上限・目安を超えている単元・項目・教科・書き出しはありません/);
  assert.equal(await page.locator('[data-swap]').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('道徳・総合・外国語：ほかの学期に書いたメモも案づくりに使える', async () => {
  const { page, errors, ctx } = await openLocal();
  /* 3年2学期は「所見・総合」。道徳の欄は「ほかの欄」にたたまれている */
  await page.click('details.more > summary');
  await page.fill('#memo-doutoku', '教材「バスの中で」。相手の立場を考えて発言した');
  await page.fill('#memo-sogo', '福祉についてアンケートを取り、表に整理した');
  await page.click('.rbtn[data-no="2"]');
  await page.click('details.more > summary');
  await page.fill('#memo-doutoku', '2番の道徳のメモ');
  await page.waitForTimeout(500);

  /* 3学期に切りかえる（3年3学期は「所見・道徳所見」） */
  await page.click('#term-seg button[data-term="3"]');
  await page.click('.rbtn[data-no="1"]');
  assert.match(await page.textContent('[data-badge="memo"]'), /2\/32/, '2学期の道徳メモも「メモあり」に数える');
  assert.match(await page.textContent('.othermemo'), /2学期.*バスの中で/);
  await shot(page, '11-other-term-memo');

  await page.click('nav [data-tab="ai"]');
  await page.selectOption('#p-type', 'doutoku');
  await page.click('#btn-build');
  const prompt = await page.textContent('#promptout');
  assert.match(prompt, /人数：2人（出席番号 1・2）/);
  assert.match(prompt, /【道徳の姿（2学期）】教材「バスの中で」/);
  assert.match(prompt, /1学期〜3学期に書いたメモを合わせて/);
  assert.ok(!/福祉/.test(prompt), '道徳所見のプロンプトに総合のメモは入らない');

  /* 所見のもと（教科での姿）は、これまでどおりその学期のメモだけ */
  await page.click('nav [data-tab="memo"]');
  await page.fill('#memo-subject', '3学期の国語のメモ');
  await page.click('#term-seg button[data-term="2"]');
  assert.equal(await page.inputValue('#memo-subject'), '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('所見のプロンプト：書き出しの形を必ず守らせる・チェック済みの子は外せる・前の学期の所見を見られる', async () => {
  const { page, errors, ctx } = await openLocal({ count: 3 });
  await page.fill('#memo-subject', '国語科「ごんぎつね」で、ごんの気持ちを考えた');
  await page.fill('#memo-life', '掃除をだまって行った');
  await page.click('.rbtn[data-no="2"]');
  await page.fill('#memo-subject', '算数のわり算で図を使って説明した');
  await page.click('.rbtn[data-no="3"]');
  await page.fill('#memo-subject', '体育科「ハードル走」でリズムよく跳んだ');
  /* 3番は全部チェック済みにする */
  for (const ck of ['subject', 'life', 'sogo']) await page.click(`#kid-checks [data-ck="${ck}"]`);
  await page.waitForTimeout(300);

  await page.click('nav [data-tab="ai"]');
  await page.click('#btn-build');
  let prompt = await page.textContent('#promptout');
  assert.match(prompt, /書き出し：どの案も必ず「〇〇科「単元名」では、」で始める/);
  assert.match(prompt, /# 所見の形（厳守/);
  assert.match(prompt, /1\) 国語科「ごんぎつね」では、/);
  assert.match(prompt, /単元名：「ごんぎつね」（書き出しは、その案に割り当てた教科と単元名で「〇〇科「単元名」では、」の形にする）/);
  assert.match(prompt, /- 案1：国語科「ごんぎつね」 ＋ 生活：掃除/);
  assert.match(prompt, /## #2\n[^\n]*\n単元名：メモにありません/);
  assert.match(prompt, /# 出力する前の確認/);
  assert.match(prompt, /もう一度：どの案も、必ず「〇〇科「単元名」では、」で書き始めてください。/);
  assert.ok(!/学期のはじめは〜でしたが/.test(prompt), '所見に、書き出しを変える例が入っている');
  assert.ok(!/同じ書き出しは、クラス全体で/.test(prompt), '所見に、書き出しを変えるお願いが入っている');
  assert.match(prompt, /出席番号 1・2・3/);

  /* 名簿のチェックが済んでいない子だけ */
  await page.selectOption('#p-scope', 'unchecked');
  await page.click('#btn-build');
  prompt = await page.textContent('#promptout');
  assert.match(prompt, /人数：2人（出席番号 1・2）/);

  /* 書き出しの形が違う案は要修正 */
  await page.click('nav [data-tab="pick"]');
  await page.click('.rbtn[data-no="1"]');
  await page.fill('.draftbox textarea', '音読に進んで取り組み、気持ちを考えることができました。掃除の時間には、床をふきました。');
  await page.waitForTimeout(100);
  assert.match(await page.textContent('.draftbox .issues'), /「〇〇科「単元名」では、」の形で書き始めます/);
  await page.fill('.draftbox textarea', DRAFT_OK);
  await page.waitForTimeout(100);
  assert.ok(!/形で書き始めます/.test(await page.textContent('.draftbox .issues')));

  /* 3学期にすると、2学期の所見が並んで見える */
  await page.click('#term-seg button[data-term="3"]');
  await page.click('.rbtn[data-no="1"]');
  assert.match(await page.textContent('.draftbox .pastterm'), /2学期.*国語科.*ごんぎつね/);
  await shot(page, '14-past-term');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('所見のプロンプト：メモの教科と生活を、案ごとに違う組み合わせで割り当てる', async () => {
  const { page, errors, ctx } = await openLocal({ count: 3 });
  /* 3人とも同じ材料（国語・算数・体育 × 掃除・給食当番・廊下） */
  for (const n of [1, 2, 3]) {
    await page.click(`.rbtn[data-no="${n}"]`);
    await page.fill('#memo-subject', '国語科「ごんぎつね」で、ごんの気持ちを考えた。算数科「わり算」で図を使って説明した。体育科「ハードル走」でリズムよく跳んだ');
    await page.fill('#memo-life', '掃除をだまって行った。給食当番を最後まで行った。廊下を静かに歩いた');
  }
  assert.match(await page.textContent('#material'), /国語科「ごんぎつね」、算数科「わり算」、体育科「ハードル走」[\s\S]*掃除、給食・当番・日直、廊下歩行[\s\S]*9通り/);
  await page.click('nav [data-tab="ai"]');
  await page.click('#btn-build');
  const prompt = await page.textContent('#promptout');
  assert.match(prompt, /# 案ごとの組み合わせ（厳守）/);
  const kid = n => prompt.split(`## #${n}\n`)[1].split('\n## #')[0];
  const combos = n => (kid(n).match(/- 案\d：[^\n]+/g) || []);
  /* 1人の5案は、教科も生活もばらける */
  const c1 = combos(1);
  assert.equal(c1.length, 5);
  assert.ok(new Set(c1.map(x => x.split('＋')[0].replace(/- 案\d：/, '').trim())).size >= 3, c1.join('\n'));
  assert.ok(new Set(c1.map(x => x.split('生活：')[1])).size >= 3, c1.join('\n'));
  assert.equal(new Set(c1.map(x => x.replace(/- 案\d：/, ''))).size, 5, '同じ組み合わせが続いている');
  /* 3人の案1は、それぞれ違う教科・生活になる */
  const first = [1, 2, 3].map(n => combos(n)[0].replace('- 案1：', ''));
  assert.equal(new Set(first.map(x => x.split('＋')[0].trim())).size, 3, first.join('\n'));
  assert.equal(new Set(first.map(x => x.split('生活：')[1])).size, 3, first.join('\n'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('メモ画面：書き方のきまりと、アプリの読み取り結果が見える', async () => {
  const { page, errors, ctx } = await openLocal();
  assert.ok(await page.isVisible('details.guide[open]'));
  assert.match(await page.textContent('details.guide'), /1行に1教科/);
  await page.fill('#memo-subject', '国語科「ごんぎつね」：ごんの気持ちを考えた\nわり算で図を使った');
  await page.fill('#memo-life', '掃除や給食当番を最後まで行った');
  await page.waitForTimeout(50);
  const parsed = await page.textContent('#parsed-subject');
  assert.match(parsed, /1行目 国語科「ごんぎつね」/);
  assert.match(parsed, /2行目 算数科（単元名なし）内容から/);
  assert.match(parsed, /2行目：教科名が無いので、内容から「算数科」と読みました/);
  assert.match(await page.textContent('#parsed-life'), /1行に1場面/);
  await shot(page, '15-memo-guide');
  /* ガイドを閉じると、次に開いたときも閉じたまま */
  await page.click('details.guide > summary');
  await page.waitForTimeout(100);
  await page.reload(); await page.waitForSelector('.rbtn');
  assert.ok(!(await page.isVisible('details.guide[open]')));
  /* 入力補助の「」はかっこの間にカーソルが入る */
  await page.click('details.guide > summary');
  await page.fill('#memo-event', '学習発表会');
  await page.click('#memo-event');
  await page.keyboard.press('End');
  await page.click('.chip:text-is("「」")');
  await page.keyboard.type('リコーダー');
  assert.equal(await page.inputValue('#memo-event'), '学習発表会「リコーダー」');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('4 AIで見直す：全員分をコピーし、直した文を1人ずつ確かめて使い、仕上げへ進む', async () => {
  const { page, errors, ctx } = await openLocal({ count: 3 });
  /* 1番と2番に本文を入れる */
  await page.click('nav [data-tab="pick"]');
  await page.fill('.draftbox textarea', DRAFT_OK);
  await page.click('.rbtn[data-no="2"]');
  await page.fill('.draftbox textarea', DRAFT_OK.replace('掃除の時間', '給食の時間'));
  await page.waitForTimeout(500);
  await page.click('nav [data-tab="review"]');
  await page.click('#r-build');
  const prompt = await page.textContent('#r-out');
  assert.match(prompt, /ベテラン教師/);
  assert.match(prompt, /# 変えてはいけないこと（厳守）/);
  assert.match(prompt, /書き出しの形「〇〇科「単元名」では、」は変えない/);
  assert.match(prompt, /人数：2人（出席番号 1・2）/);
  assert.match(prompt, new RegExp('#1\\n' + DRAFT_OK.slice(0, 10)));
  /* 直した文を貼り戻す（1番は直しあり、2番は直しなし） */
  const fixed = DRAFT_OK.replace('理由を示して自分の考えを発表する', '理由を示しながら自分の考えを発表する');
  await page.fill('#r-paste', `#1\n${fixed}\n※ 「示して」を「示しながら」に直しました。\n\n#2\n${DRAFT_OK.replace('掃除の時間', '給食の時間')}\n※ 直しなし`);
  await page.click('#r-parse');
  assert.match(await page.textContent('#r-msg'), /2人分を取り込みました。直しがあるのは1人/);
  assert.match(await page.innerHTML('.rvrow'), /<ins>ながら<\/ins>/);
  await shot(page, '16-review');
  await page.click('[data-ruse="0"]');
  assert.match(await page.textContent('.rvrow'), /使った/);
  /* 3 で見ると直した文になっている */
  await page.click('[data-rlook="1"]');
  assert.equal(await page.inputValue('.draftbox textarea'), fixed);
  /* 元に戻せる */
  await page.click('nav [data-tab="review"]');
  await page.click('[data-rundo="0"]');
  await page.click('nav [data-tab="pick"]');
  assert.equal(await page.inputValue('.draftbox textarea'), DRAFT_OK);
  /* まとめて使って、仕上げへ */
  await page.click('nav [data-tab="review"]');
  await page.click('#r-use-all');
  await page.click('#r-go-finish');
  assert.equal(await page.getAttribute('nav [data-tab="finish"]', 'class'), 'on');
  assert.match(await page.textContent('#listbody'), /示しながら/);
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
