/* ルール同士の食い違いのテスト
 * 実行: node --test shoken-memo/tests/rules.test.js
 *
 * 勤務校のお手本・道徳の型・言い換え先・学習指導要領の「使える言い方」・入力補助の語を、
 * 実際の校正（checkText）にかけて、error / warn が1件も出ないことを確かめる。
 * ルールを直したときに、お手本が「要修正」と言われる食い違いを見つけるためのもの。
 * （字数・構成・道徳の型のように、文の一部だけでは判定できないものは除く） */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');
const { R, CS, E } = load();

/* 文の一部（フレーズ）にもかけられる指摘だけを見る */
const PHRASE_KINDS = new Set(['表記', '表現', '教科名', '性格', '文末', '書式', '数字', '個人情報']);

function problems(text, typeKey, kinds) {
  return E.checkText(text, typeKey || 'shoken', { stage: '中' })
    .filter(i => i.level !== 'info')
    .filter(i => !kinds || kinds.has(i.kind))
    .map(i => `${i.kind}「${i.ng || ''}」→「${i.ok || ''}」 ${i.msg}`);
}

function expectClean(label, items, typeKey, kinds) {
  const bad = [];
  items.forEach(t => {
    const p = problems(t, typeKey, kinds);
    if (p.length) bad.push(`  ${t}\n    ${p.join('\n    ')}`);
  });
  assert.equal(bad.length, 0, `${label} が校正で指摘されます:\n${bad.join('\n')}`);
}

test('所見のお手本（○の文）は指摘されない', () => {
  expectClean('お手本', R.examples.map(e => e.good), 'shoken', PHRASE_KINDS);
});

test('所見のお手本（×の文）は、ちゃんと指摘される', () => {
  const missed = R.examples.map(e => e.bad).filter(t => !problems(t, 'shoken', PHRASE_KINDS).length);
  assert.equal(missed.length, 0, '×の文なのに何も指摘されません:\n' + missed.join('\n'));
});

test('道徳所見の例文（学年別）は、字数以外で指摘されない', () => {
  Object.entries(R.doutokuFormat.examples).forEach(([st, list]) => {
    list.forEach(t => {
      const p = E.checkText(t, 'doutoku', { stage: st })
        .filter(i => i.level !== 'info' && i.kind !== '字数')
        .map(i => `${i.kind}「${i.ng || ''}」 ${i.msg}`);
      assert.equal(p.length, 0, `${st}学年の例文:\n${t}\n${p.join('\n')}`);
    });
  });
});

test('道徳の1文目の型・2文目の締め方は指摘されない', () => {
  expectClean('道徳の1文目の型', R.doutokuFormat.opening, 'doutoku', PHRASE_KINDS);
  expectClean('道徳の締め方', R.doutokuFormat.closing.map(s => s.replace(/〜/g, '')), 'doutoku', PHRASE_KINDS);
});

test('「避ける表現」の言い換え先は、ほかのルールに引っかからない', () => {
  const oks = R.vague.map(v => v.ok).filter(ok => !/^（/.test(ok))
    .flatMap(ok => ok.split('／')).map(s => s.replace(/〜/g, ''));
  expectClean('言い換え先', oks, 'shoken', new Set(['表記', '教科名', '性格', '文末', '書式']));
});

test('表記ルールの「正しい表記」は、ほかの表記ルールに引っかからない', () => {
  const oks = R.hyoki.map(h => h.ok).filter(ok => !/^（/.test(ok)).flatMap(ok => ok.split('／'));
  expectClean('正しい表記', oks, 'shoken', new Set(['表記']));
});

test('学習指導要領の「使える言い方」は指摘されない', () => {
  const ws = [];
  Object.values(CS.subjects).forEach(sub => Object.values(sub.areas).forEach(list =>
    list.forEach(it => (it.w || []).forEach(w => ws.push(w)))));
  assert.ok(ws.length > 150, '言い方の数: ' + ws.length);
  expectClean('使える言い方', ws, 'shoken', PHRASE_KINDS);
  expectClean('やさしい言いかえ', CS.notation.softening.map(s => s.plain), 'shoken', PHRASE_KINDS);
});

test('入力補助の語は指摘されない', () => {
  expectClean('入力補助', Object.values(R.chips).flat(), 'shoken', PHRASE_KINDS);
});

test('どの学年・学期にも「今回書く」初期値があり、書ける項目の中にある', () => {
  for (let g = 1; g <= 6; g++) for (let t = 1; t <= 3; t++) {
    const w = R.defaultWrite[g][t];
    assert.ok(Array.isArray(w) && w.length, `${g}年${t}学期`);
    w.forEach(k => assert.ok(R.termMatrix[g][t].includes(k) && R.types[k], `${g}年${t}学期 ${k}`));
  }
});

test('ルールの正規表現は、どれもこのブラウザで使える', () => {
  const res = [];
  R.hyoki.forEach(h => h.re && res.push(h.re));
  R.subjects.checks.forEach(c => c.re && res.push(c.re));
  R.format.forEach(f => res.push(f.re));
  R.numberFormat.rules.forEach(f => res.push(f.re));
  res.push(R.privacy.honorific.re);
  res.forEach(re => assert.doesNotThrow(() => new RegExp(re, 'g'), re));
});

test('re を書いた表記ルールは、見つける文字が ng と同じ（「直す」で文が壊れない）', () => {
  R.hyoki.filter(h => h.re).forEach(h => {
    const m = ('xx' + h.ng + 'xx').match(new RegExp(h.re));
    if (!m) return;   // 前後の文字によっては当たらない（それで正しい）ものがある
    assert.ok(m[0] === h.ng || !E.checkText('「」' + h.ng, 'shoken', {}).some(i => i.ng === h.ng && i.fixable && i.hit !== h.ng),
      `${h.ng}: 見つかった文字「${m[0]}」`);
  });
});
