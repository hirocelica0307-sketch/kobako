/* ルールの たしかめ（node tests.js で 動きます）
   index.html の「// ==LOGIC==」から「// ==/LOGIC==」までを とりだして、計画書「6-2 テスト項目」の うち
   判定に かかわる ものを しらべます（画面の 大きさ・タッチ／マウスは ブラウザで たしかめます）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = html.split('// ==LOGIC==')[1].split('// ==/LOGIC==')[0];
const box = {};
vm.runInNewContext(src, { globalThis: box });
const L = box.SenLogic;

const rows = [];
const t = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
const P = (x, y) => ({ x, y });

/* 盤面を 手で 作る：red・blue は [[x,y],…]。turn の チームが サイコロ n を ふった ところから */
function setup(red, blue, o = {}) {
    const s = L.newState(o.size || 'm', {}, () => 0.1);
    s.teams.red.planes = red.map(([x, y]) => ({ x, y, alive: true }));
    s.teams.blue.planes = blue.map(([x, y]) => ({ x, y, alive: true }));
    s.first = o.turn || 'red';
    L.beginPlay(s);
    return s;
}
/* 線を 引いた ことに する（辺を 登録） */
function draw(s, team, pts) {
    for (let i = 1; i < pts.length; i++) {
        const k = L.edgeKey(P(...pts[i - 1]), P(...pts[i]));
        if (!s.edges.has(k)) s.edges.set(k, new Set());
        s.edges.get(k).add(team);
    }
}
const walk = (s, pts) => pts.map(([x, y]) => L.step(s, P(x, y)));

/* ── きほん ── */
t('辺の キーは 小さい じゅん "3,4|4,4"', L.edgeKey(P(4, 4), P(3, 4)) === '3,4|4,4' && L.edgeKey(P(3, 4), P(4, 4)) === '3,4|4,4');
t('たての 辺の キー "5,2|5,3"', L.edgeKey(P(5, 3), P(5, 2)) === '5,2|5,3');
{
    const s = L.newState('m', { red: '', blue: 'たろう' });
    t('名前が 空なら「あか」、入れれば その名前', s.teams.red.name === 'あか' && s.teams.blue.name === 'たろう');
    t('中 は 16×10（はじめ）', s.size.cols === 16 && s.size.rows === 10);
    t('小 12×8・大 20×12', L.newState('s').size.cols === 12 && L.newState('s').size.rows === 8 && L.newState('l').size.cols === 20 && L.newState('l').size.rows === 12);
}

/* ── はいち（2-1・4-6） ── */
{
    const s = L.newState('m', {});
    t('はいち：外周は だめ', !L.placeValid(s, 'red', P(0, 5)) && !L.placeValid(s, 'red', P(3, 0)) && !L.placeValid(s, 'red', P(3, 10)));
    t('はいち：まん中の 線の 上は だめ', !L.placeValid(s, 'red', P(8, 5)) && !L.placeValid(s, 'blue', P(8, 5)));
    t('はいち：あいての じんちは だめ', !L.placeValid(s, 'red', P(9, 5)) && !L.placeValid(s, 'blue', P(7, 5)));
    t('はいち：じぶんの じんちなら おける', L.placePlane(s, 'red', P(7, 5)));
    t('はいち：2目盛り いないは だめ（ななめ 1+1）', !L.placeValid(s, 'red', P(6, 4)));
    t('はいち：3目盛りなら おける', L.placeValid(s, 'red', P(4, 5)));
    t('はいち：あいての チームとも 3目盛り はなす', !L.placeValid(s, 'blue', P(9, 5)) && L.placeValid(s, 'blue', P(10, 5)));
    L.placePlane(s, 'red', P(4, 5)); L.placePlane(s, 'red', P(2, 2));
    t('はいち：4き目は おけない', !L.placePlane(s, 'red', P(2, 8)) && s.teams.red.planes.length === 3);
    let allOk = true;
    for (const size of ['s', 'm', 'l']) for (let n = 0; n < 200; n++) {
        const u = L.newState(size, {});
        const ok = L.autoPlace(u, 'red') && L.autoPlace(u, 'blue');
        const ps = [...u.teams.red.planes.map(p => ['red', p]), ...u.teams.blue.planes.map(p => ['blue', p])];
        const cols = u.size.cols, rows = u.size.rows;
        const good = ok && ps.length === 6 && ps.every(([tm, p], i) =>
            p.x > 0 && p.x < cols && p.y > 0 && p.y < rows && (tm === 'red' ? p.x < cols / 2 : p.x > cols / 2) &&
            ps.every(([, q], j) => i === j || L.dist(p, q) >= 3));
        if (!good) allOk = false;
    }
    t('おまかせ：3しゅるいの 大きさで 600回 きまりどおり', allOk);
}

/* ── 6-2 テスト項目 ── */
const RED = [[3, 5], [5, 2], [2, 8]], BLUE = [[12, 5], [13, 2], [11, 8]];

{   // 相手の線と同じ道はタップしても進めない
    const s = setup(RED, BLUE);
    draw(s, 'blue', [[12, 5], [11, 5], [10, 5], [9, 5], [8, 5], [7, 5], [6, 5], [5, 5]]);
    t('6-2 あいての 線と 同じ 道は 通れない（canMove）', !L.canMove(s, 'red', P(5, 5), P(6, 5)) && !L.canMove(s, 'red', P(6, 5), P(5, 5)));
    L.applyRoll(s, 4);
    L.selectPlane(s, 0);                         // (3,5) から
    const r1 = L.step(s, P(4, 5)), r2 = L.step(s, P(5, 5)), r3 = L.step(s, P(6, 5));
    t('6-2 あいての 線の 上へ すすもうと しても すすまない', r1.ok && r2.ok && !r3.ok && s.stepsLeft === 2 && L.tipOf(s, 'red').x === 5);
}
{   // 相手の線と交点で交わるだけなら進める
    const s = setup(RED, BLUE);
    draw(s, 'blue', [[12, 5], [11, 5], [10, 5], [10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [6, 5], [6, 6], [6, 7]]);
    L.applyRoll(s, 5); L.selectPlane(s, 0);
    const rs = walk(s, [[4, 5], [5, 5], [6, 5], [7, 5]]);    // (6,5) で 青い 線と 交わって 通りぬける
    t('6-2 あいての 線と 点で 交わる だけなら 通れる', rs.every(r => r.ok) && L.tipOf(s, 'red').x === 7 && s.stepsLeft === 1);
}
{   // 自分の線の上は戻って進める（歩数も減る）
    const s = setup(RED, BLUE);
    L.applyRoll(s, 6); L.selectPlane(s, 0);
    walk(s, [[4, 5], [5, 5], [6, 5]]);
    const before = s.edges.size;
    const back = walk(s, [[5, 5], [4, 5]]);
    t('6-2 じぶんの 線の 上を もどれる・歩数も へる', back.every(r => r.ok) && s.stepsLeft === 1 && s.edges.size === before);
    t('6-2 もどった 辺は あたらしく 登録しない（turnEdges は null）', s.turnEdges[3] === null && s.turnEdges[4] === null);
    t('6-2 出発した じぶんの ひこうきの 点へは もどれない', !L.canMove(s, 'red', P(4, 5), P(3, 5)));
    const s2 = setup(RED, BLUE);
    draw(s2, 'red', [[5, 2], [5, 3], [5, 4], [6, 4]]);      // 前の ターンの 線
    s2.teams.red.activeLine = null;
    L.applyRoll(s2, 3); L.selectPlane(s2, 0);
    const rs = walk(s2, [[4, 5], [4, 4], [5, 4]]);
    t('6-2 前の 線（じぶん）とも かさなって 通れる', rs.every(r => r.ok));
}
{   // 自分の飛行機・撃墜された飛行機の交点には入れない
    const s = setup([[3, 5], [5, 5], [2, 8]], BLUE);
    t('6-2 じぶんの ひこうきの 点には 入れない', !L.canMove(s, 'red', P(4, 5), P(5, 5)));
    s.teams.blue.planes[0] = { x: 6, y: 3, alive: false };
    t('6-2 げきつい された ひこうき（あいて）の 点には 入れない', !L.canMove(s, 'red', P(6, 4), P(6, 3)));
    s.teams.red.planes[2].alive = false;
    t('6-2 げきつい された ひこうき（じぶん）の 点にも 入れない', !L.canMove(s, 'red', P(2, 7), P(2, 8)));
    t('盤面の 外へは 出られない', !L.canMove(s, 'red', P(0, 0), P(-1, 0)) && !L.canMove(s, 'red', P(16, 10), P(16, 11)));
    t('ななめ・2つ先へは すすめない', !L.canMove(s, 'red', P(3, 3), P(4, 4)) && !L.canMove(s, 'red', P(3, 3), P(5, 3)));
}
{   // 相手の機体に入ると撃墜され、残り歩数があってもターンが終わる
    const s = setup(RED, [[6, 5], [13, 2], [11, 8]]);
    L.applyRoll(s, 6); L.selectPlane(s, 0);
    walk(s, [[4, 5], [5, 5]]);
    const r = L.step(s, P(6, 5));
    t('6-2 あいての ひこうきに 入ると げきつい', r.ok && r.shot && !s.teams.blue.planes[0].alive && s.shots.red === 1);
    t('6-2 のこり 3歩 あっても ターンが おわる（stepsLeft 0・phase shot）', s.stepsLeft === 0 && s.phase === 'shot' && !r.win);
    t('げきつい した 線は そこで おわり・辺は のこる', s.teams.red.activeLine === null && s.edges.has('5,5|6,5'));
    t('げきつい した あとは 1歩 もどせない', !L.canUndo(s) && !L.undoStep(s));
    t('げきつい した あとは すすめない', !L.step(s, P(6, 6)).ok);
    L.endTurn(s);
    t('げきつい された 点は あおも 入れない', !L.canMove(s, 'blue', P(7, 5), P(6, 5)));
    // 撃墜後の次のターンは、生き残った自分の機体からしか出発できない
    L.endTurn(s);                                   // 赤の ばんに もどす
    L.beginTurn(s);
    const ph = L.applyRoll(s, 2);
    t('6-2 げきつい後の つぎの ターンは ひこうきを えらぶ ところから', ph === 'select' && s.teams.red.activeLine === null);
    t('6-2 えらべるのは 生きている じぶんの ひこうき だけ', L.selectPlane(s, 1) && L.tipOf(s, 'red').x === 5 && L.tipOf(s, 'red').y === 2);
}
{   // 自分の線の出発元の機体が撃墜されても、その線は先っぽから続けてよい
    const s = setup(RED, BLUE);
    L.applyRoll(s, 2); L.selectPlane(s, 0); walk(s, [[4, 5], [4, 6]]);
    L.commit(s);
    s.teams.red.planes[0].alive = false;             // あおに やられた ことに する
    L.endTurn(s); L.beginTurn(s);
    t('2-4 出発した ひこうきが やられても 線は つづけられる', L.applyRoll(s, 1) === 'move' && L.step(s, P(4, 7)).ok);
}
{   // 行き止まりの線は次のターンの始めにあきらめて、別の機体から出直せる
    const s = setup(RED, BLUE);
    s.teams.red.activeLine = [P(7, 1)];                                   // 先っぽ (7,1)
    draw(s, 'blue', [[7, 0], [7, 1], [7, 2]]); draw(s, 'blue', [[6, 1], [7, 1], [8, 1]]);   // まわりを ぜんぶ あおが ふさぐ
    const r = L.beginTurn(s);
    t('6-2 ターンの はじめに 先っぽが 行き止まりなら あきらめる', r.deadEnd && s.teams.red.activeLine === null);
    t('6-2 あきらめた あとは 別の ひこうきから 出なおせる', L.applyRoll(s, 2) === 'select' && L.selectPlane(s, 2));
    const s2 = setup(RED, BLUE);
    s2.teams.red.activeLine = [P(3, 5), P(4, 5), P(4, 6)];
    draw(s2, 'red', [[3, 5], [4, 5], [4, 6]]);
    draw(s2, 'blue', [[3, 6], [4, 6], [5, 6]]); draw(s2, 'blue', [[4, 6], [4, 7]]);
    t('先っぽの となりに じぶんの 線が あれば もどれるので 行き止まりに ならない', !L.beginTurn(s2).deadEnd && L.applyRoll(s2, 2) === 'move');
}
{   // ターンの 途中で 行き止まり（ちょくせつ）
    const s = setup([[3, 5], [5, 2], [2, 8]], BLUE);
    // (4,5) の まわり：上 (4,4)-(4,5) あお、下 (4,5)-(4,6) あお、右 (4,5)-(5,5) あお、左 は じぶんの ひこうき (3,5)
    draw(s, 'blue', [[4, 4], [4, 5], [4, 6]]); draw(s, 'blue', [[4, 5], [5, 5]]);
    L.applyRoll(s, 4); L.selectPlane(s, 0);
    const r = L.step(s, P(4, 5));
    t('6-2 途中で すすめなく なったら けってい まち', r.ok && r.stuck && s.phase === 'done' && s.stepsLeft === 3);
    t('けってい で あいての ばん', L.commit(s) && s.turn === 'blue' && s.phase === 'roll');
    L.endTurn(s);
    const d = L.beginTurn(s);
    t('つぎの じぶんの ターンの はじめに 行き止まり → あきらめる', d.deadEnd && s.teams.red.activeLine === null);
}
{   // 出発できる機体がないときはパスになり、2人続けてパスで引き分け
    const s = setup([[1, 1], [5, 2], [2, 8]], [[12, 5], [13, 2], [11, 8]], { size: 'm' });
    s.teams.red.planes[1].alive = false; s.teams.red.planes[2].alive = false;
    draw(s, 'blue', [[0, 1], [1, 1], [2, 1]]); draw(s, 'blue', [[1, 0], [1, 1], [1, 2]]);
    t('6-2 出発できる ひこうきが なければ パス', L.applyRoll(s, 3) === 'pass');
    t('パス 1回目は まだ つづく', !L.doPass(s).draw && s.passCount === 1);
    L.endTurn(s);
    t('あおが すすめば パスの 数は 0 に もどる', L.applyRoll(s, 1) === 'select' && L.selectPlane(s, 0) && L.step(s, P(12, 6)).ok && s.passCount === 0);
    L.commit(s);
    t('ふたたび 赤が パス', L.applyRoll(s, 2) === 'pass' && !L.doPass(s).draw);
    L.endTurn(s);
    // 青も うごけない ように する
    for (const p of s.teams.blue.planes) p.alive = false;
    s.teams.blue.planes.push({ x: 15, y: 9, alive: true });
    draw(s, 'red', [[14, 9], [15, 9], [16, 9]]); draw(s, 'red', [[15, 8], [15, 9], [15, 10]]);
    s.teams.blue.activeLine = null;
    t('あおも パス', L.applyRoll(s, 5) === 'pass');
    const d = L.doPass(s);
    t('6-2 2人 つづけて パスで ひきわけ', d.draw && s.phase === 'over' && s.winner === null && s.screen === 'result');
}
{   // 3機目を撃墜した瞬間に結果画面になる
    const s = setup(RED, [[6, 5], [13, 2], [11, 8]]);
    s.teams.blue.planes[1].alive = false; s.teams.blue.planes[2].alive = false;
    L.applyRoll(s, 6); L.selectPlane(s, 0);
    walk(s, [[4, 5], [5, 5]]);
    const r = L.step(s, P(6, 5));
    t('6-2 3き目を げきつい した しゅんかんに けっか（けってい いらない）', r.win && s.winner === 'red' && s.phase === 'over' && s.screen === 'result');
}
{   // 1歩もどすで、線・歩数・辺の登録がきちんと元に戻る
    const s = setup(RED, BLUE);
    L.applyRoll(s, 2); L.selectPlane(s, 0); walk(s, [[4, 5], [5, 5]]); L.commit(s);
    L.endTurn(s); L.beginTurn(s);
    const edgesBefore = JSON.stringify([...s.edges].map(([k, v]) => [k, [...v]]));
    const lineBefore = JSON.stringify(s.teams.red.activeLine);
    L.applyRoll(s, 6);
    walk(s, [[6, 5], [6, 4], [6, 5], [5, 5], [4, 5], [4, 4]]);   // 行って もどって、前の 線の 上も 通る
    t('6-2 6歩 すすんだ', s.stepsLeft === 0 && s.phase === 'done');
    for (let i = 0; i < 6; i++) L.undoStep(s);
    const edgesAfter = JSON.stringify([...s.edges].map(([k, v]) => [k, [...v]]));
    t('6-2 1歩 もどす ×6 で 辺の 登録が もとどおり', edgesAfter === edgesBefore, edgesAfter);
    t('6-2 1歩 もどす ×6 で 線が もとどおり', JSON.stringify(s.teams.red.activeLine) === lineBefore);
    t('6-2 1歩 もどす ×6 で 歩数が もとどおり', s.stepsLeft === 6 && s.turnPath.length === 0 && s.turnEdges.length === 0);
    t('前の ターンの 線までは もどせない', !L.undoStep(s) && s.phase === 'move');
    // 行って もどる とき、あとで 通った ほうを もどしても 辺は けさない
    const u = setup(RED, BLUE);
    L.applyRoll(u, 3); L.selectPlane(u, 0);
    walk(u, [[4, 5], [4, 4], [4, 5]]);
    L.undoStep(u);
    t('同じ 辺を 行き来した とき、もどしても 辺は のこる', u.edges.has('4,4|4,5') && u.edges.has('3,5|4,5'));
    L.undoStep(u);
    t('さいしょに 通った 歩を もどすと 辺が きえる', !u.edges.has('4,4|4,5'));
    L.undoStep(u);
    t('ぜんぶ もどすと ひこうきを えらびなおせる', u.edges.size === 0 && L.canReselect(u) && L.selectPlane(u, 1) && L.tipOf(u, 'red').y === 2);
    L.undoStep(u);
    t('さらに もどすと えらぶ ところへ', u.phase === 'select' && u.teams.red.activeLine === null);
}
{   // 出た目の数だけ必ず進む
    const s = setup(RED, BLUE);
    L.applyRoll(s, 3); L.selectPlane(s, 0);
    walk(s, [[4, 5], [5, 5]]);
    t('出た 目を つかいきるまで けってい できない', !L.commit(s) && s.phase === 'move');
    L.step(s, P(6, 5));
    t('つかいきったら けってい できる', s.phase === 'done' && !L.step(s, P(7, 5)).ok && L.commit(s));
    t('ターン数が ふえる', s.turnCount === 2 && s.turn === 'blue');
}
{   // 先攻は ランダム
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(L.newState('m').first);
    t('先攻は あか・あお どちらにも なる', seen.has('red') && seen.has('blue'));
}

let ng = 0;
for (const r of rows) {
    if (!r.ok) ng++;
    console.log((r.ok ? '✅ ' : '❌ ') + r.name + (r.ok || !r.detail ? '' : '  → ' + r.detail));
}
console.log(`\n${rows.length - ng} / ${rows.length} OK`);
process.exit(ng ? 1 : 0);
