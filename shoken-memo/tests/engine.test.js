/* 校正エンジンのテスト（誤検出・「 」の中・直すボタン・取り込み）
 * 実行: node --test shoken-memo/tests/engine.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');
const { E } = load();

const kinds = (t, type, ctx) => E.checkText(t, type || 'shoken', ctx || { stage: '中' });
const ngs = (t, type) => kinds(t, type).filter(i => i.level !== 'info').map(i => i.ng || i.kind);
const fixOf = (t, ng) => {
  const i = kinds(t).find(x => x.ng === ng && x.fixable);
  return i ? t.slice(0, i.index) + i.ok + t.slice(i.index + i.length) : null;
};

test('正しい言葉を誤りと判定しない', () => {
  ['話し方を工夫し', '表し方を考え', '過ごし方を振り返り', '暮らし方', '増やし方',
   '学習発表会の出来事を', '作品の出来栄えを', '自分の目で見ることが', '友達と話し合い、',
   'たくさんの言葉を', '地域社会のよさ', '体育大会'].forEach(t => {
    const bad = ngs(t).filter(n => ['し方', '出来', 'て見る', '話し合い', '社会', '体育'].includes(n) || /さん/.test(n));
    assert.equal(bad.length, 0, `${t} → ${bad.join(',')}`);
  });
});

test('直したい言葉は、これまでどおり見つける', () => {
  assert.ok(ngs('計算のし方を説明し').includes('し方'));
  assert.ok(ngs('出来るようになりました。').includes('出来'));
  assert.ok(ngs('試して見る').includes('て見る'));
  assert.ok(ngs('話し合いを進め').includes('話し合い'));
  assert.ok(ngs('体育のハードル走').includes('体育'));
  assert.ok(ngs('田中さんと').some(n => /さん/.test(n)));
});

test('「直す」ボタンで文が壊れない', () => {
  assert.equal(fixOf('計算のし方を説明し', 'し方'), '計算の仕方を説明し');
  assert.equal(fixOf('出来るようになりました。', '出来'), 'できるようになりました。');
  assert.equal(fixOf('試して見る', 'て見る'), '試してみる');
  assert.equal(fixOf('話し方を工夫し', 'し方'), null);           // そもそも指摘しない
  assert.equal(fixOf('学習発表会の出来事', '出来'), null);
  /* 見つかった文字が ng と違うとき（３つ位 → 人くらい にしてしまう）は「直す」を出さない */
  const i = kinds('３つ位の').find(x => x.ng === '人位');
  assert.ok(i && !i.fixable);
});

test('「 」の中（子どもの言葉）は、表記・文末・表現を見ない', () => {
  const t = '登場人物の気持ちに寄り添い、自分ならどうするか考えることができました。' +
            '特に「規則の尊重」の学習では、きまりの大切さに気付き、' +
            '「これからは、少しぐらいいいかなと思っても、きまりを守ります。」と道徳ノートに記述していました。';
  const list = kinds(t, 'doutoku', { stage: '低' }).filter(i => i.level !== 'info' && i.kind !== '字数');
  assert.equal(list.length, 0, list.map(i => i.kind + ':' + i.ng).join(','));
  /* かっこの外なら見る */
  assert.ok(ngs('少しぐらいいいかなと思いました。').includes('いい'));
  assert.ok(kinds('きまりを守ります。').some(i => i.kind === '文末'));
});

test('「 」の中でも、氏名らしい表記は見る', () => {
  const t = '「田中さんに教えてもらった。」と書きました。';
  assert.ok(kinds(t).some(i => i.kind === '個人情報'));
});

test('道徳所見：かっこの中の「。」は文の数に入れない', () => {
  const t = '前向きな姿勢で考えることができました。特に「善悪の判断」の学習では、正しいことを行う大切さに気付き、「自分なら、正直に言う。けんかはしない。」と発言していました。';
  assert.ok(!kinds(t, 'doutoku', { stage: '中' }).some(i => i.kind === '道徳の型'));
  const t3 = '考えました。考えました。特に「礼儀」の学習では、気付きました。';
  assert.ok(kinds(t3, 'doutoku', { stage: '中' }).some(i => i.kind === '道徳の型' && /3文/.test(i.msg)));
});

test('道徳所見：内容項目の一部（自由と責任）も正式名称として認める', () => {
  const t = '考えることができました。特に「自由と責任」の学習では、きまりの大切さに気付きました。';
  assert.ok(!kinds(t, 'doutoku', { stage: '高' }).some(i => i.kind === '内容項目'));
  const bad = '考えることができました。特に「やさしさ」の学習では、気付きました。';
  assert.ok(kinds(bad, 'doutoku', { stage: '高' }).some(i => i.kind === '内容項目'));
});

test('4桁の数字の桁区切り（4,217）は読点の誤りにしない', () => {
  assert.ok(!kinds('4,217人').some(i => i.kind === '書式'));
  assert.ok(kinds('調べ,まとめ').some(i => i.kind === '書式'));
});

test('所見：教科 → 生活 の順序を見る', () => {
  const good = '国語科「ごんぎつね」の学習では、叙述をもとに考えることができました。掃除の時間には、だまって取り組みました。';
  const bad  = '掃除の時間には、だまって取り組みました。国語科「ごんぎつね」の学習では、叙述をもとに考えることができました。';
  assert.ok(!kinds(good).some(i => i.kind === '順序'));
  assert.ok(kinds(bad).some(i => i.kind === '順序'));
});

test('同じ文を2回校正すると、覚えた結果を返す', () => {
  const t = '国語科の学習で、出来るようになりました。';
  assert.equal(E.checkCached(t, 'shoken', { stage: '中' }), E.checkCached(t, 'shoken', { stage: '中' }));
});

test('取り込み：#番号・案・※ を読み分ける', () => {
  const r = E.parsePasted('#1\n1) 一つ目の案です。\n※ 工夫A\n2) 二つ目の\n案です。\n※ 工夫B\n\n＃2\n案1：ただ一つの案\n【3】\n本文だけ');
  assert.deepEqual(Object.keys(r.blocks).map(Number), [1, 2, 3]);
  assert.equal(r.blocks[1].length, 2);
  assert.equal(r.blocks[1][1].text, '二つ目の案です。');
  assert.equal(r.blocks[1][0].note, '工夫A');
  assert.equal(r.blocks[2][0].text, 'ただ一つの案');
  assert.equal(r.blocks[3][0].text, '本文だけ');
});

test('似ている所見を見つける', () => {
  const a = '国語科「ごんぎつね」の学習では、叙述をもとに登場人物の気持ちを考えることができました。';
  const d = E.findDuplicates([{ no: 1, text: a }, { no: 2, text: a.replace('ごんぎつね', 'スイミー') }, { no: 3, text: '算数科のわり算では、図を使って説明しました。' }]);
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].a, d[0].b], [1, 2]);
});
