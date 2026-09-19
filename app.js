/* ===================================================================
   ひっさんモンスター  —  小学2年生のための たし算・ひき算 ひっ算アプリ
   くり上がり / くり下がり の数も じっさいに 入力します。
   入力する場所は じゅんばん に 自動で えらばれるので、
   子どもは テンキーを ポチポチ おすだけで 正しい手順を なぞれます。
   =================================================================== */
'use strict';

/* ---------------- ステージ定義 ---------------- */
const QUESTIONS_PER_STAGE = 5;

const LEVELS = [
  { id:1, ico:'🌱', name:'たしざん①', sub:'くり上がり なし',   op:'+', dA:2, dB:2, mode:'none' },
  { id:2, ico:'🔥', name:'たしざん②', sub:'くり上がり あり',   op:'+', dA:2, dB:2, mode:'some' },
  { id:3, ico:'🎈', name:'たしざん③', sub:'ミックス',          op:'+', dA:2, dB:2, mode:'mix'  },
  { id:4, ico:'🍀', name:'ひきざん①', sub:'くり下がり なし',   op:'-', dA:2, dB:2, mode:'none' },
  { id:5, ico:'⚡', name:'ひきざん②', sub:'くり下がり あり',   op:'-', dA:2, dB:2, mode:'some' },
  { id:6, ico:'🎏', name:'ひきざん③', sub:'ミックス',          op:'-', dA:2, dB:2, mode:'mix'  },
  { id:7, ico:'🚀', name:'たしざん④', sub:'3けたの たしざん', op:'+', dA:3, dB:3, mode:'mix'  },
  { id:8, ico:'🛸', name:'ひきざん④', sub:'3けたの ひきざん', op:'-', dA:3, dB:3, mode:'mix'  },
  { id:9, ico:'👑', name:'ちょうせん', sub:'ぜんぶ ミックス',   op:'?', dA:3, dB:3, mode:'mix'  }
];

const MONSTERS = [
  ['🐣','ヒヨピー'],   ['🐸','ケロタン'],   ['🐙','タコリン'],   ['🦊','キツネン'],
  ['🐢','カメゴロウ'], ['🦕','ノッシー'],   ['🦄','ユニポン'],   ['🐝','ブンブン'],
  ['🐧','ペンタ'],     ['🐼','パンダフ'],   ['🦉','ホーホー'],   ['🐬','イルピョン'],
  ['🐉','ドラゴー'],   ['🦁','ガオライ'],   ['🐨','コアラン'],   ['🦋','チョウリン'],
  ['🐳','クジラード'], ['🦔','ハリン'],     ['🐺','ウルフィ'],   ['🦩','フラミー'],
  ['🐰','ピョンタ'],   ['🦜','オウムン'],   ['🐥','ピヨマル'],   ['🌟','キラリン']
];

const PLACE = ['いち','じゅう','ひゃく','せん'];
const CHEER = ['すごい！','やったね！','せいかい！','バッチリ！','てんさい！','かんぺき！'];

/* ---------------- セーブデータ ---------------- */
const SAVE_KEY = 'hissan-monster-v1';
const defaultSave = () => ({
  stars:{}, monsters:[], totalQ:0, totalMiss:0, totalStage:0,
  settings:{ hint:true, sound:true, unlock:false }
});
let save = defaultSave();

function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){ save = Object.assign(defaultSave(), JSON.parse(raw)); save.settings = Object.assign(defaultSave().settings, save.settings); }
  }catch(e){ save = defaultSave(); }
}
function store(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){}
}

/* ---------------- おと ---------------- */
const Sound = {
  ctx:null,
  ready(){
    if(!save.settings.sound) return null;
    if(!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      this.ctx = new AC();
    }
    if(this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone(freq, start, dur, vol=0.18, type='sine'){
    const c = this.ready(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  tap(){ this.tone(880, 0, 0.09, 0.14, 'triangle'); },
  ok(){ this.tone(1046, 0, 0.12, 0.16, 'triangle'); this.tone(1568, 0.08, 0.14, 0.12, 'triangle'); },
  ng(){ this.tone(220, 0, 0.18, 0.16, 'sawtooth'); },
  clearQ(){ [784,988,1319].forEach((f,i)=> this.tone(f, i*0.09, 0.22, 0.15, 'triangle')); },
  fanfare(){ [523,659,784,1046,1319].forEach((f,i)=> this.tone(f, i*0.13, 0.45, 0.16, 'triangle')); }
};

/* ---------------- 問題づくり ---------------- */
const rnd = n => Math.floor(Math.random() * n);
const randRange = (lo, hi) => lo + rnd(hi - lo + 1);
const digitsOf = n => String(n).split('').reverse().map(Number); // [一の位, 十の位, ...]

function countCarries(a, b){
  const A = digitsOf(a), B = digitsOf(b);
  let carry = 0, n = 0;
  for(let i = 0; i < Math.max(A.length, B.length); i++){
    const s = (A[i]||0) + (B[i]||0) + carry;
    carry = s >= 10 ? 1 : 0;
    n += carry;
  }
  return n;
}
function countBorrows(a, b){
  const A = digitsOf(a), B = digitsOf(b);
  const eff = A.slice();
  let n = 0;
  for(let i = 0; i < A.length; i++){
    const y = B[i] || 0;
    if((eff[i]||0) < y){
      let j = i + 1;
      while((eff[j]||0) === 0 && j < eff.length) j++;
      if(j >= eff.length) return 99;          // ひけない
      eff[j] -= 1;
      for(let k = j - 1; k > i; k--) eff[k] = 9;
      eff[i] += 10;
      n++;
    }
  }
  return n;
}

function makeProblem(level){
  let op = level.op;
  if(op === '?') op = Math.random() < 0.5 ? '+' : '-';

  const loA = level.dA === 3 ? 100 : 10, hiA = level.dA === 3 ? 999 : 99;
  for(let tries = 0; tries < 4000; tries++){
    let a, b;
    if(op === '+'){
      a = randRange(loA, hiA);
      b = level.dA === 3 ? randRange(10, 999) : randRange(10, 99);
      if(a + b > 999) continue;                     // こたえは 3けた まで
      const c = countCarries(a, b);
      if(level.mode === 'none' && c !== 0) continue;
      if(level.mode === 'some' && c === 0) continue;
      if(level.mode === 'mix' && Math.random() < 0.65 && c === 0) continue;
    }else{
      a = randRange(loA, hiA);
      b = level.dA === 3 ? randRange(10, a) : randRange(10, a);
      if(b >= a) continue;
      if(a - b < 1) continue;
      const c = countBorrows(a, b);
      if(c === 99) continue;
      if(level.mode === 'none' && c !== 0) continue;
      if(level.mode === 'some' && c === 0) continue;
      if(level.mode === 'mix' && Math.random() < 0.65 && c === 0) continue;
      if(level.dA === 2 && c > 1) continue;
    }
    return { a, b, op };
  }
  return op === '+' ? { a:27, b:48, op:'+' } : { a:52, b:38, op:'-' };
}

/* ---------------- ひっ算の手順づくり ----------------
   steps は「入力する順番」。kind:
     'ans'    … こたえのマス
     'carry'  … くり上がりの 1
     'borrow' … くり下がりで へらした 数
------------------------------------------------------ */
function buildPlan(a, b, op){
  const A = digitsOf(a), B = digitsOf(b);
  const result = op === '+' ? a + b : a - b;
  const R = digitsOf(result);
  let nCols = op === '+' ? Math.max(A.length, B.length) + 1 : A.length;
  nCols = Math.max(nCols, R.length, 2);

  const marks = new Array(nCols).fill(null);
  const ans   = new Array(nCols).fill(null);
  const steps = [];

  if(op === '+'){
    let carry = 0;
    for(let i = 0; i < nCols; i++){
      const x = A[i] || 0, y = B[i] || 0;
      const sum = x + y + carry;
      const d = sum % 10;
      if(i < R.length){
        ans[i] = d;
        steps.push({ kind:'ans', col:i, value:d, x, y, carryIn:carry, sum });
      }
      if(sum >= 10 && i + 1 < nCols){
        marks[i + 1] = 1;
        steps.push({ kind:'carry', col:i + 1, value:1, sum });
      }
      carry = sum >= 10 ? 1 : 0;
    }
  }else{
    const eff = A.slice();
    for(let i = 0; i < nCols; i++){
      const y = B[i] || 0;
      const before = eff[i] || 0;
      if(before < y){
        let j = i + 1;
        while((eff[j] || 0) === 0) j++;
        eff[j] -= 1;
        marks[j] = eff[j];
        steps.push({ kind:'borrow', col:j, value:eff[j], orig:eff[j] + 1, forCol:i, x:before, y });
        for(let k = j - 1; k > i; k--){
          eff[k] = 9;
          marks[k] = 9;
          steps.push({ kind:'borrow', col:k, value:9, orig:0, forCol:i, x:before, y });
        }
        eff[i] += 10;
      }
      const d = (eff[i] || 0) - y;
      if(i < R.length){
        ans[i] = d;
        steps.push({ kind:'ans', col:i, value:d, x:(eff[i] || 0), y, borrowed:before < y });
      }
    }
  }
  return { a, b, op, A, B, nCols, marks, ans, steps, result };
}

/* ---------------- ゲームの じょうたい ---------------- */
const G = {
  level:null, qIndex:0, missInStage:0, streak:0,
  plan:null, stepIndex:0, wrongOnStep:0, helpOnStep:0, locked:false, qMiss:false
};

/* ---------------- DOM ---------------- */
const $ = id => document.getElementById(id);
const screens = ['screen-home','screen-game','screen-clear','screen-dex','screen-stats'];
function show(id){
  screens.forEach(s => $(s).classList.toggle('is-active', s === id));
  window.scrollTo(0, 0);
}

/* ---------------- ホーム ---------------- */
function isUnlocked(level){
  if(save.settings.unlock || level.id === 1) return true;
  return (save.stars[level.id - 1] || 0) >= 1;
}
function renderHome(){
  const list = $('stageList');
  list.innerHTML = '';
  LEVELS.forEach(lv => {
    const open = isUnlocked(lv);
    const st = save.stars[lv.id] || 0;
    const el = document.createElement('button');
    el.className = 'stage' + (open ? '' : ' locked');
    el.innerHTML =
      `<div class="stage-ico">${open ? lv.ico : '🔒'}</div>
       <div>
         <div class="stage-name">${lv.name}</div>
         <div class="stage-sub">${lv.sub}</div>
         <div class="stage-stars">${[1,2,3].map(i => `<span class="${i <= st ? 'on' : ''}">★</span>`).join('')}</div>
       </div>`;
    el.addEventListener('click', () => {
      Sound.tap();
      if(!open){ flash('まえの ステージを クリアしてね！'); return; }
      startStage(lv);
    });
    list.appendChild(el);
  });
  $('totalStars').textContent = Object.values(save.stars).reduce((s, v) => s + v, 0);
  $('dexCount').textContent = save.monsters.length;
  $('homeMascot').textContent = save.monsters.length ? MONSTERS[save.monsters[save.monsters.length - 1]][0] : '🐣';
}
function flash(msg){
  const p = $('praise');
  p.innerHTML = `<div class="praise-pill">${msg}</div>`;
  p.classList.add('show');
  setTimeout(() => p.classList.remove('show'), 1300);
}

/* ---------------- ステージ開始 ---------------- */
function startStage(level){
  G.level = level; G.qIndex = 0; G.missInStage = 0; G.streak = 0;
  $('gameTitle').textContent = `${level.name}　${level.sub}`;
  show('screen-game');
  nextQuestion();
}
function renderDots(){
  const d = $('qdots');
  d.innerHTML = '';
  for(let i = 0; i < QUESTIONS_PER_STAGE; i++){
    const s = document.createElement('div');
    s.className = 'qdot' + (i < G.qIndex ? ' done' : (i === G.qIndex ? ' now' : ''));
    d.appendChild(s);
  }
}
function nextQuestion(){
  const p = makeProblem(G.level);
  G.plan = buildPlan(p.a, p.b, p.op);
  G.stepIndex = 0; G.wrongOnStep = 0; G.helpOnStep = 0; G.locked = false; G.qMiss = false;
  renderDots();
  renderCalc();
  focusStep();
}

/* ---------------- ひっ算の びょうが ---------------- */
function renderCalc(){
  const { A, B, nCols, op } = G.plan;
  const calc = $('calc');
  calc.style.setProperty('--cols', nCols);
  let h = '';

  // くり上がり・くり下がりの 行
  h += '<div class="crow marks"><div class="cell"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell" data-col="${c}">${c > 0 ? `<div class="mark-box" id="mk${c}"></div>` : ''}</div>`;
  }
  h += '</div>';

  // 1つめの かず
  h += '<div class="crow"><div class="cell op"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><span id="da${c}">${A[c] != null ? A[c] : ''}</span></div>`;
  }
  h += '</div>';

  // 2つめの かず と きごう
  h += `<div class="crow"><div class="cell op">${op === '+' ? '＋' : '−'}</div>`;
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><span>${B[c] != null ? B[c] : ''}</span></div>`;
  }
  h += '</div>';

  h += '<div class="rule"></div>';

  // こたえ
  h += '<div class="crow"><div class="cell op"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><div class="ans-box" id="an${c}"></div></div>`;
  }
  h += '</div>';

  calc.innerHTML = h;
}

function cellOf(step){
  return step.kind === 'ans' ? $('an' + step.col) : $('mk' + step.col);
}
function clearHighlights(){
  document.querySelectorAll('.colhi').forEach(e => e.classList.remove('colhi'));
  document.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.key.hintkey').forEach(e => e.classList.remove('hintkey'));
}
function focusStep(){
  clearHighlights();
  const step = G.plan.steps[G.stepIndex];
  if(!step) return;
  cellOf(step).classList.add('active');
  document.querySelectorAll(`[data-col="${step.col}"]`).forEach(e => e.classList.add('colhi'));
  setBubble(hintFor(step, false), false);
}

/* ---------------- ヒントの ことば ---------------- */
function hintFor(step, detail){
  const place = PLACE[step.col] || '';
  if(!save.settings.hint && !detail){
    if(step.kind === 'ans')    return `${place}の くらいの こたえを かこう`;
    if(step.kind === 'carry')  return `${place}の くらいの うえに かこう`;
    return `${place}の くらいの うえに かこう`;
  }
  if(G.plan.op === '+'){
    if(step.kind === 'carry'){
      return `10 の たばが 1こ できたね！ ${place}の くらいの うえに 小さく 1 と かこう。`;
    }
    if(step.carryIn > 0){
      return `くり上がりの 1 も わすれずに。 1 ＋ ${step.x} ＋ ${step.y} は？ ${place}の くらいに かこう。`;
    }
    if(step.x === 0 && step.y === 0) return `のこった 1 を そのまま かこう。`;
    return `${step.x} ＋ ${step.y} は？ ${place}の くらいに かこう。`;
  }
  // ひき算
  if(step.kind === 'borrow'){
    if(step.orig === 0){
      return `${place}の くらいは 0 だね。となりから かりて 9 に なるよ。9 と かこう。`;
    }
    return `${step.x} から ${step.y} は ひけない！ ${place}の くらいの ${step.orig} から 1 かりて、うえに 小さく かこう。`;
  }
  if(step.borrowed){
    return `1 かりたので ${step.x} だね。 ${step.x} − ${step.y} は？`;
  }
  return `${step.x} − ${step.y} は？ ${place}の くらいに かこう。`;
}
function setBubble(text, cheer){
  const b = $('bubble');
  b.textContent = text;
  b.classList.toggle('cheer', !!cheer);
}

/* ---------------- 入力 ---------------- */
function handleDigit(d){
  if(G.locked) return;
  const step = G.plan.steps[G.stepIndex];
  if(!step) return;
  const cell = cellOf(step);

  if(d === step.value){
    Sound.ok();
    cell.textContent = String(d);
    cell.classList.add('filled', 'pop');
    cell.classList.remove('active');
    setTimeout(() => cell.classList.remove('pop'), 340);
    if(step.kind === 'borrow'){
      const dg = $('da' + step.col);
      if(dg) dg.parentElement.classList.add('struck');
    }
    G.stepIndex++; G.wrongOnStep = 0; G.helpOnStep = 0;
    if(G.stepIndex >= G.plan.steps.length) finishQuestion();
    else focusStep();
  }else{
    Sound.ng();
    if(navigator.vibrate) navigator.vibrate(60);
    cell.classList.add('shake');
    setTimeout(() => cell.classList.remove('shake'), 400);
    G.wrongOnStep++; G.qMiss = true;
    if(G.wrongOnStep === 1) G.missInStage++;
    if(G.wrongOnStep === 1){
      setBubble('おしい！ もういちど かんがえてみよう。', false);
    }else if(G.wrongOnStep === 2){
      setBubble(hintFor(step, true), false);
    }else{
      setBubble(hintFor(step, true) + '　→ ひかっている ボタンを おしてね。', false);
      const key = document.querySelector(`.key[data-d="${step.value}"]`);
      if(key) key.classList.add('hintkey');
    }
  }
}

function finishQuestion(){
  G.locked = true;
  Sound.clearQ();
  // つかわない こたえのマスは けす
  G.plan.ans.forEach((v, i) => { if(v == null) $('an' + i).classList.add('ghost'); });
  clearHighlights();

  const { a, b, op, result } = G.plan;
  setBubble(`${a} ${op === '+' ? '＋' : '−'} ${b} ＝ ${result}　せいかい！`, true);
  $('teacherFace').textContent = '🤩';

  const noMiss = !G.qMiss;
  if(noMiss) G.streak++; else G.streak = 0;
  if(G.streak >= 2){
    const c = $('combo');
    c.textContent = `🔥 れんぞく ${G.streak}もん！`;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }else{
    $('combo').textContent = '';
  }

  const p = $('praise');
  p.innerHTML = `<div class="praise-pill">${CHEER[rnd(CHEER.length)]} 🎉</div>`;
  p.classList.add('show');
  sparkle(8);

  save.totalQ++;
  store();

  setTimeout(() => {
    p.classList.remove('show');
    $('teacherFace').textContent = '🐥';
    G.qIndex++;
    if(G.qIndex >= QUESTIONS_PER_STAGE) finishStage();
    else nextQuestion();
  }, 1250);
}

function sparkle(n){
  const marks = ['⭐','✨','🌟','💫'];
  for(let i = 0; i < n; i++){
    const s = document.createElement('div');
    s.className = 'fall';
    s.textContent = marks[rnd(marks.length)];
    s.style.left = rnd(100) + 'vw';
    s.style.animationDuration = (1.1 + Math.random()) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 2400);
  }
}

/* ---------------- ステージ クリア ---------------- */
function finishStage(){
  const stars = G.missInStage === 0 ? 3 : (G.missInStage <= 2 ? 2 : 1);
  const lv = G.level;
  save.stars[lv.id] = Math.max(save.stars[lv.id] || 0, stars);
  save.totalMiss += G.missInStage;
  save.totalStage++;

  // モンスターを ゲット
  const own = new Set(save.monsters);
  const rest = MONSTERS.map((m, i) => i).filter(i => !own.has(i));
  let gotIndex, isNew = false;
  if(rest.length){ gotIndex = rest[rnd(rest.length)]; save.monsters.push(gotIndex); isNew = true; }
  else { gotIndex = rnd(MONSTERS.length); }
  store();

  $('clearTitle').textContent = 'ステージ クリア！';
  $('clearStars').innerHTML = [1,2,3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
  $('clearMsg').textContent = G.missInStage === 0 ? 'ぜんもん いっぱつ せいかい！ すばらしい！' : `まちがえた かず：${G.missInStage}　つぎは ノーミスを ねらおう！`;
  $('clearName').textContent = '';
  const egg = $('egg'), hatched = $('hatched');
  egg.classList.remove('gone'); hatched.classList.remove('show'); hatched.textContent = '';
  show('screen-clear');
  Sound.fanfare();

  setTimeout(() => {
    egg.classList.add('gone');
    hatched.textContent = MONSTERS[gotIndex][0];
    hatched.classList.add('show');
    $('clearName').textContent = (isNew ? '' : 'また あえたね！ ') + MONSTERS[gotIndex][1] + (isNew ? ' が うまれた！' : '');
    sparkle(14);
  }, 1400);

  const nextLv = LEVELS.find(l => l.id === lv.id + 1);
  $('btnNext').style.display = nextLv ? '' : 'none';
  $('btnNext').onclick = () => { Sound.tap(); if(nextLv) startStage(nextLv); };
  $('btnRetry').onclick = () => { Sound.tap(); startStage(lv); };
  $('btnClearHome').onclick = () => { Sound.tap(); renderHome(); show('screen-home'); };
}

/* ---------------- ずかん / せいせき ---------------- */
function renderDex(){
  const g = $('dexGrid');
  g.innerHTML = '';
  const own = new Set(save.monsters);
  MONSTERS.forEach((m, i) => {
    const c = document.createElement('div');
    c.className = 'dex-cell' + (own.has(i) ? '' : ' locked');
    c.innerHTML = `<div class="face">${own.has(i) ? m[0] : '❔'}</div><div class="nm">${own.has(i) ? m[1] : '？？？'}</div>`;
    g.appendChild(c);
  });
  $('dexRatio').textContent = `${own.size} / ${MONSTERS.length}`;
}
function renderStats(){
  const stars = Object.values(save.stars).reduce((s, v) => s + v, 0);
  const rate = save.totalQ ? Math.round(100 * save.totalQ / (save.totalQ + save.totalMiss)) : 100;
  $('statsWrap').innerHTML = `
    <div class="stat-card"><span>といた もんだい</span><b>${save.totalQ} もん</b></div>
    <div class="stat-card"><span>クリアした ステージ</span><b>${save.totalStage} かい</b></div>
    <div class="stat-card"><span>あつめた ★</span><b>${stars} こ</b></div>
    <div class="stat-card"><span>モンスター</span><b>${save.monsters.length} / ${MONSTERS.length}</b></div>
    <div class="stat-card"><span>いっぱつ せいかい どあい</span><b>${rate} %</b></div>`;
}

/* ---------------- テンキー ---------------- */
function buildPad(){
  const pad = $('pad');
  pad.innerHTML = '';
  [1,2,3,4,5,6,7,8,9,0].forEach(d => {
    const k = document.createElement('button');
    k.className = 'key'; k.dataset.d = d; k.textContent = d;
    k.addEventListener('click', () => { Sound.tap(); handleDigit(d); });
    pad.appendChild(k);
  });
  const help = document.createElement('button');
  help.className = 'key help';
  help.style.gridColumn = 'span 5';
  help.textContent = '💡 ヒント';
  help.addEventListener('click', () => {
    Sound.tap();
    const step = G.plan && G.plan.steps[G.stepIndex];
    if(!step || G.locked) return;
    G.helpOnStep++;
    setBubble(hintFor(step, true), false);
    if(G.helpOnStep >= 2){
      const key = document.querySelector(`.key[data-d="${step.value}"]`);
      if(key) key.classList.add('hintkey');
    }
  });
  pad.appendChild(help);
}

/* ---------------- せってい ---------------- */
function syncSettings(){
  $('setHint').checked = save.settings.hint;
  $('setSound').checked = save.settings.sound;
  $('setUnlock').checked = save.settings.unlock;
}

/* ---------------- 起動 ---------------- */
function init(){
  load();
  buildPad();
  renderHome();
  syncSettings();

  $('btnBackHome').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });
  $('btnDex').addEventListener('click', () => { Sound.tap(); renderDex(); show('screen-dex'); });
  $('btnDexBack').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });
  $('btnStats').addEventListener('click', () => { Sound.tap(); renderStats(); show('screen-stats'); });
  $('btnStatsBack').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });

  $('btnSettings').addEventListener('click', () => { Sound.tap(); syncSettings(); $('modalSettings').hidden = false; });
  $('btnCloseSettings').addEventListener('click', () => { Sound.tap(); $('modalSettings').hidden = true; renderHome(); });
  $('setHint').addEventListener('change', e => { save.settings.hint = e.target.checked; store(); });
  $('setSound').addEventListener('change', e => { save.settings.sound = e.target.checked; store(); if(e.target.checked) Sound.tap(); });
  $('setUnlock').addEventListener('change', e => { save.settings.unlock = e.target.checked; store(); renderHome(); });
  $('btnReset').addEventListener('click', () => {
    if(confirm('きろく（★・モンスター・せいせき）を ぜんぶ けします。よろしいですか？')){
      save = defaultSave(); store(); syncSettings(); renderHome();
      $('modalSettings').hidden = true;
    }
  });

  // キーボードでも あそべる（おうちの人・タブレット以外むけ）
  window.addEventListener('keydown', e => {
    if(!$('screen-game').classList.contains('is-active')) return;
    if(e.key >= '0' && e.key <= '9') handleDigit(Number(e.key));
  });
}
document.addEventListener('DOMContentLoaded', init);
