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

/* ---------- クラス全体の書き分け ---------- */
const A1 = '国語科「ごんぎつね」の学習では、文章の言葉をもとに考えることができました。掃除の時間には、だまって床をふきました。';

test('書き分け：教科・単元・生活の話題・書き出しを見分ける', () => {
  const tp = E.topicsOf(A1, 'shoken');
  assert.deepEqual([...tp.subjects], ['国語科']);
  assert.deepEqual([...tp.units], ['ごんぎつね']);
  assert.deepEqual([...tp.life], ['掃除']);
  assert.equal(tp.opening, '〈教科〉「…」の学習では');
  /* 「科」の抜けた教科名も数える。「関係」は係活動にしない。子どもの言葉は単元にしない */
  const t2 = E.topicsOf('体育のハードル走で、関係を考え、「これからはきまりを守ります。」と書きました。', 'shoken');
  assert.deepEqual([...t2.subjects], ['体育科']);
  assert.deepEqual([...t2.units], []);
  assert.ok(!t2.life.includes('係活動'));
  /* 道徳所見は1文目を書き出しとして比べ、教科・話題は数えない */
  const keys = E.keysOf('登場人物の気持ちに寄り添い、考えることができました。特に「礼儀」の学習では、気付きました。', 'doutoku');
  assert.deepEqual([...keys], ['書き出し|登場人物の気持ちに寄り添い、考えることができました。']);
});

test('書き分け：目安の人数', () => {
  assert.equal(E.limitOf(32, 0.34), 11);
  assert.equal(E.limitOf(6, 0.25), 3);       // 下限は3人
  assert.equal(E.limitOf(32, 1), Infinity);  // 目安を使わない
});

test('書き分け：似ているメモの子をまとめる', () => {
  const g = E.groupSimilar([
    { no: 1, text: '国語科「ごんぎつね」で、ごんの気持ちを叙述をもとに考えて発表した' },
    { no: 2, text: '算数科のわり算で、図を使って説明した。給食当番を最後まで行った' },
    { no: 3, text: '国語科「ごんぎつね」で、ごんの気持ちを叙述をもとに考えた' },
    { no: 4, text: '' }
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual([...g[0]], [1, 3]);
});

test('書き分け：何人にも出てくる言い回しを見つける（「 」の中は数えない）', () => {
  const r = E.repeatedPhrases([
    '最後まで粘り強く取り組むことができました。「最後まで粘り強く取り組む」',
    '算数科では、最後まで粘り強く取り組むことができました。',
    '体育科では、最後まで粘り強く取り組むことができました。'
  ], 3);
  assert.equal(r.length, 1);
  assert.equal(r[0].phrase, '最後まで粘り強く取り組むことができました');
});

test('書き分け：目安を超えた話題が減るように、案の切りかえを提案する', () => {
  const kokugo = n => `国語科「ごんぎつね」の学習では、${n}番は考えを書きました。掃除の時間には、床をふきました。`;
  const sansu = n => `算数科のわり算では、${n}番は図に表して説明しました。給食の時間には、配ぜんを手伝いました。`;
  const entries = [1, 2, 3, 4, 5, 6].map(n => ({
    no: n, text: kokugo(n), pick: 0,
    cands: [{ text: kokugo(n), usable: true }, { text: sansu(n), usable: n !== 6 }]
  }));
  const plan = E.planSwaps(entries, 'shoken', 3);
  /* 6人とも国語科・掃除。目安3人なので3人を算数科に切りかえる（#6 の案2は要修正なので選ばない） */
  assert.equal(plan.swaps.length, 3);
  assert.ok(plan.swaps.every(w => w.to === 1 && w.no !== 6));
  assert.equal(plan.counts['教科|国語科'], 3);
  assert.equal(plan.counts['教科|算数科'], 3);
  /* 目安を超えていなければ何も提案しない */
  assert.equal(E.planSwaps(entries, 'shoken', 10).swaps.length, 0);
});

test('生活・当番・係のメモに書いた内容が所見にあれば「教科以外が見あたりません」と言わない', () => {
  const t = '国語科「ごんぎつね」の学習では、叙述をもとに考えることができました。廊下を静かに右側通行することができました。';
  assert.ok(!E.checkText(t, 'shoken', { stage: '中' }).some(i => i.kind === '構成'), '廊下歩行');
  /* 一覧に無い語でも、その子の生活のメモに書いた語なら認める */
  const t2 = '国語科「ごんぎつね」の学習では、叙述をもとに考えることができました。黒板をきれいにする仕事を続けました。';
  assert.ok(E.checkText(t2, 'shoken', { stage: '中' }).some(i => i.kind === '構成'));
  const hints = E.lifeHintsOf('毎朝、黒板をきれいにしていた。国語の音読');
  assert.ok(hints.includes('黒板') && !hints.some(h => /国語/.test(h)));
  assert.ok(!E.checkText(t2, 'shoken', { stage: '中', lifeHints: hints }).some(i => i.kind === '構成'));
});

test('名簿の名前が入っていたら要修正', () => {
  const list = E.checkText('国語科では、佐藤と音読しました。', 'shoken', { names: ['佐藤', '佐藤太郎'] });
  assert.ok(list.some(i => i.kind === '個人情報' && i.ng === '佐藤' && i.level === 'error'));
});

test('書き分け：単元・生活の項目と、教科で、別々の上限を使える', () => {
  const kokugo = n => `国語科「ごんぎつね」の学習では、${n}番は考えを書きました。掃除の時間には、床をふきました。`;
  const sansu = n => `国語科「漢字の広場」の学習では、${n}番は漢字を使いました。給食の時間には、配ぜんを手伝いました。`;
  const entries = [1, 2, 3, 4, 5, 6, 7].map(n => ({
    no: n, text: kokugo(n), pick: 0, cands: [{ text: kokugo(n), usable: true }, { text: sansu(n), usable: true }]
  }));
  /* 単元・項目は5人まで、教科は上限なし → 国語科のまま、単元と生活の項目だけを5人以下にする */
  const lim = key => (key.startsWith('単元|') || key.startsWith('生活・行事|')) ? 5 : Infinity;
  const plan = E.planSwaps(entries, 'shoken', lim);
  assert.equal(plan.swaps.length, 2);
  assert.equal(plan.counts['単元|ごんぎつね'], 5);
  assert.equal(plan.counts['生活・行事|掃除'], 5);
  assert.equal(plan.counts['教科|国語科'], 7);
});

test('「確認した」の見分けは、字数が変わっても同じ', () => {
  const a = E.checkText('短い。', 'shoken', {}).find(i => i.kind === '字数');
  const b = E.checkText('もう少しだけ短い。', 'shoken', {}).find(i => i.kind === '字数');
  assert.equal(E.issueSig(a), E.issueSig(b));
});
