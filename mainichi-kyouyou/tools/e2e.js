/* 毎日教養 ── スマホの 画面で 通しで 動かして たしかめる（Playwright）
   つかいかた：
     python3 -m http.server 8765 --directory mainichi-kyouyou   （べつの 端末で）
     NODE_PATH=$(npm root -g) node mainichi-kyouyou/tools/e2e.js [出力フォルダー]
   iPhone と Android の 画面の 大きさで、今日の セット → おわり → ノート → 記録 → 設定 → 戻る を とおし、
   画面写真を 出力フォルダーに 保存する。エラーが あれば 終了コード 1。 */
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.env.MK_URL || 'http://localhost:8765/';
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'e2e-shots');
fs.mkdirSync(OUT, { recursive: true });

const PHONES = [
    { name: 'iphone-se', dev: devices['iPhone SE'] },
    { name: 'iphone-15', dev: devices['iPhone 15 Pro'] || devices['iPhone 14 Pro'] },
    { name: 'pixel-7', dev: devices['Pixel 7'] },
    { name: 'galaxy-s9', dev: devices['Galaxy S9+'] }
];

let failures = 0;
function check(ok, msg) {
    if (ok) console.log('  ok   ' + msg);
    else { console.log('  NG   ' + msg); failures++; }
}

async function noHScroll(page, label) {
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(w.sw <= w.cw + 1, label + '：横にはみ出さない（' + w.sw + '/' + w.cw + '）');
}

async function smallTargets(page, label) {
    // 見えて いる ボタンの 高さが 36px 未満の ものを 数える（指で おしにくい）
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => {
        const r = b.getBoundingClientRect();
        const st = getComputedStyle(b);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && b.offsetParent !== null && r.height < 36;
    }).map(b => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 12)));
    check(bad.length === 0, label + '：小さすぎる ボタンが ない' + (bad.length ? ' → ' + bad.join(',') : ''));
}

async function answerOne(page, opts) {
    const o = opts || {};
    await page.waitForSelector('#play:not([hidden]) #qText');
    const q = await page.textContent('#qText');
    if (await page.isVisible('#recallShow')) await page.tap('#recallShow');
    const choices = await page.$$('#choices .choice');
    check(choices.length === 4, '選択肢が 4つ（' + q.slice(0, 18) + '…）');
    // 正解（data-k=0）か まちがい を えらぶ
    const want = o.wrong ? '#choices .choice:not([data-k="0"])' : '#choices .choice[data-k="0"]';
    await page.tap(want);
    if (await page.isVisible('#confSheet')) {
        await page.tap('#confSheet .conf[data-conf="' + (o.conf || 'maybe') + '"]');
    }
    await page.waitForSelector('#feedback:not([hidden])');
    const whys = await page.$$eval('#choices .why', els => els.map(e => e.textContent.trim()));
    check(whys.length === 3 && whys.every(Boolean), '答えた あと 3つの 選択肢に 説明が 出る');
    const exp = await page.textContent('#feedback .ex p:not(.ans)');
    check(exp && exp.length > 40, '解説が 出る');
    return q;
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
    for (const ph of PHONES) {
        console.log('\n■ ' + ph.name);
        const ctx = await browser.newContext(Object.assign({}, ph.dev, { locale: 'ja-JP' }));
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push('pageerror: ' + e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
        page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
        page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

        await page.goto(URL);
        await page.waitForSelector('#todayCard .btn');
        await noHScroll(page, 'ホーム');
        await smallTargets(page, 'ホーム');
        await page.screenshot({ path: path.join(OUT, ph.name + '-01-home.png'), fullPage: true });

        // 今日の セット：1問目は 自信ありで まちがえる（思い込み）、2問目は 正解、あとは 交互
        await page.tap('#dailyBtn');
        const n = await page.evaluate(() => MKApp.state.daily.ids.length);
        check(n === 10, '今日の セットは 10問（' + n + '）');
        const seenQ = new Set();
        for (let i = 0; i < n; i++) {
            const wrong = i % 2 === 0;
            const q = await answerOne(page, { wrong: wrong, conf: i === 0 ? 'sure' : (i % 3 === 0 ? 'guess' : 'maybe') });
            seenQ.add(q);
            if (i === 0) {
                check(await page.isVisible('.verdict-note'), '自信ありで まちがえると「思い込みを発見」が 出る');
                await noHScroll(page, '解説');
                await page.screenshot({ path: path.join(OUT, ph.name + '-02-feedback.png'), fullPage: true });
                // ★印
                await page.tap('#starBtn');
                check(await page.evaluate(() => Object.keys(MKApp.state.star).length === 1), '★印を 付けられる');
            }
            if (i === 3) {
                // 途中で 戻るボタン → やめるか 聞かれる → 続ける
                await page.goBack();
                await page.waitForSelector('#dialog:not([hidden])');
                check(true, '問題の 途中で 戻ると たしかめの 小窓が 出る');
                await page.tap('#dialogNo');
                check(await page.isVisible('#play'), '「続ける」で 問題に もどる');
            }
            await page.tap('#nextBtn');
        }
        check(seenQ.size === n, '同じ 問題が 2回 出ない（' + seenQ.size + '）');
        // 間違えた 問題を もう一度（5問）
        const retry = await page.evaluate(() => MKApp.state.daily.retry.length);
        check(retry === 5, '間違えた 5問が もう一度 出る（' + retry + '）');
        for (let i = 0; i < retry; i++) {
            check(await page.isVisible('.q-tag.retry'), 'もう一度の 印');
            check(!(await page.isVisible('#confSheet')), 'もう一度の ときは 自信を 聞かない');
            await page.tap('#choices .choice[data-k="0"]');
            await page.waitForSelector('#feedback:not([hidden])');
            await page.tap('#nextBtn');
        }
        await page.waitForSelector('#result:not([hidden])');
        const score = await page.textContent('.score');
        check(/5/.test(score), '結果：10問中 5問 正解（' + score.replace(/\s+/g, ' ') + '）');
        await noHScroll(page, '結果');
        await page.screenshot({ path: path.join(OUT, ph.name + '-03-result.png'), fullPage: true });
        const st = await page.evaluate(() => {
            const s = MKApp.state;
            const t = MKLogic.dayNum();
            return { done: !!(s.days[t] && s.days[t].done), n: s.days[t] && s.days[t].n, cards: Object.keys(s.cards).length, over: Object.values(s.cards).filter(c => c.overOpen).length };
        });
        check(st.done && st.n === 10 && st.cards === 10 && st.over === 1, '記録：今日 完了・10回・10問・思い込み 1（' + JSON.stringify(st) + '）');

        // 結果 → 解説を ひらいて 戻る
        await page.tap('#resultMain .res-list button');
        await page.waitForSelector('#noteItem:not([hidden])');
        await page.goBack();
        await page.waitForSelector('#result:not([hidden])');
        check(true, '結果から 解説を ひらいて 戻れる');
        await page.tap('#resHome');
        await page.waitForSelector('#home:not([hidden])');
        check((await page.textContent('#todayCard')).includes('完了'), 'ホームに「完了」');
        check((await page.textContent('#homeStreak')).includes('1日'), '連続 1日');
        await page.screenshot({ path: path.join(OUT, ph.name + '-04-home-done.png'), fullPage: true });

        // ノート
        await page.tap('[data-tabto="note"]');
        await page.waitForSelector('#note:not([hidden])');
        await noHScroll(page, 'ノート');
        await page.screenshot({ path: path.join(OUT, ph.name + '-05-note.png'), fullPage: true });
        await page.tap('#noteFilter [data-f="over"]');
        check((await page.$$('#noteBody .list button')).length === 1, 'ノート：思い込みで 1問');
        await page.tap('#noteFilter [data-f="all"]');
        await page.tap('#noteBody .list button[data-g]:not([disabled])');
        await page.waitForSelector('#noteList:not([hidden])');
        await page.tap('#noteListBody .list button');
        await page.waitForSelector('#noteItem:not([hidden])');
        await noHScroll(page, 'ノートの 1問');
        await page.screenshot({ path: path.join(OUT, ph.name + '-06-note-item.png'), fullPage: true });
        await page.goBack(); await page.waitForSelector('#noteList:not([hidden])');
        await page.goBack(); await page.waitForSelector('#note:not([hidden])');
        check(true, 'ノート：戻るで 一覧 → ノートへ');
        await page.fill('#noteSearch', '憲法');
        await page.waitForTimeout(400);
        check(true, 'ノート：検索できる（' + (await page.$$('#noteBody .list button')).length + '件）');

        // 記録
        await page.tap('[data-tabto="record"]');
        await page.waitForSelector('#record:not([hidden])');
        await noHScroll(page, '記録');
        await page.screenshot({ path: path.join(OUT, ph.name + '-07-record.png'), fullPage: true });

        // 設定：文字 特大・暗い 画面
        await page.tap('[data-tabto="settings"]');
        await page.waitForSelector('#settings:not([hidden])');
        await smallTargets(page, '設定');
        await page.tap('[data-pick="font"] [data-v="xl"]');
        await page.tap('[data-pick="theme"] [data-v="dark"]');
        check(await page.evaluate(() => document.documentElement.dataset.theme === 'dark' && document.documentElement.dataset.font === 'xl'), '設定：暗い 画面・特大の 文字');
        await noHScroll(page, '設定（特大）');
        await page.screenshot({ path: path.join(OUT, ph.name + '-08-settings-dark.png'), fullPage: true });

        // 暗い 画面・特大で もう1セット（思い出してから 選ぶ）
        await page.tap('[data-set="recall"]');
        await page.tap('[data-tabto="home"]');
        await page.tap('#extraBtn');
        await page.waitForSelector('#recallShow');
        check(await page.isVisible('#recallBox'), '思い出してから 選ぶ：選択肢が かくれて いる');
        await page.screenshot({ path: path.join(OUT, ph.name + '-09-recall-dark.png'), fullPage: true });
        await answerOne(page, { conf: 'sure' });
        await noHScroll(page, '解説（暗い・特大）');
        await page.screenshot({ path: path.join(OUT, ph.name + '-10-feedback-dark-xl.png'), fullPage: true });
        await page.tap('#playQuit');
        await page.tap('#dialogYes');
        await page.waitForSelector('#home:not([hidden])');
        check(true, '×で やめて ホームへ');

        // 読み込み直しても 記録が のこる
        await page.reload();
        await page.waitForSelector('#todayCard .btn');
        check(await page.evaluate(() => Object.keys(MKApp.state.cards).length === 11), '読み込み直しても 記録が のこる');

        check(errors.length === 0, 'エラーなし' + (errors.length ? '\n       ' + errors.join('\n       ') : ''));
        await ctx.close();
    }
    await browser.close();
    console.log('\n' + (failures ? failures + ' 件 NG' : 'すべて ok'));
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
