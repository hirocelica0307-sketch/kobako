/* ===================================================================
   ひっさんモンスター  —  小学2年生のための たし算・ひき算 ひっ算アプリ
     ・くり上がり / くり下がり の数も じっさいに 入力する
     ・入力する場所は 正しい手順で 自動的に 選ばれる
     ・「じぶんで えらぶ」モードでは くり上がりの 有無も 子どもが 判断する
     ・記録は Google スプレッドシート（Apps Script）か localStorage に 保存
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
  { id:7, ico:'🚀', name:'たしざん④', sub:'3けたの たしざん',  op:'+', dA:3, dB:3, mode:'mix'  },
  { id:8, ico:'🛸', name:'ひきざん④', sub:'3けたの ひきざん',  op:'-', dA:3, dB:3, mode:'mix'  },
  { id:9, ico:'👑', name:'ちょうせん', sub:'ぜんぶ ミックス',   op:'?', dA:3, dB:3, mode:'mix'  }
];

const PLACE = ['いち','じゅう','ひゃく','せん'];
const CHEER = ['すごい！','やったね！','せいかい！','バッチリ！','てんさい！','かんぺき！'];

/* ---------------- セーブデータ ---------------- */
const SAVE_KEY = 'hissan-monster-v1';
function defaultSave(){
  return {
    stars:{}, monsters:[], totalQ:0, totalMiss:0, totalStage:0,
    settings:{ judge:'self', hint:false, sound:true, bgm:true, unlock:false }
  };
}
function normalize(o){
  const s = Object.assign(defaultSave(), o || {});
  s.settings = Object.assign(defaultSave().settings, (o && o.settings) || {});
  s.stars = s.stars || {};
  s.monsters = Array.isArray(s.monsters) ? s.monsters : [];
  return s;
}
let save = defaultSave();

/* ---------------- 保存（クラウド or この端末） ----------------
   Google Apps Script の ウェブアプリとして ひらいた ときは
   google.script.run が つかえるので、スプレッドシートに 保存します。
------------------------------------------------------------------ */
const Store = {
  mode:'local',        // 'local' | 'cloud'
  user:'', timer:null, sending:false, again:false, dirty:false,

  boot(done){
    this.readLocal();
    const gs = window.google && window.google.script && window.google.script.run;
    if(!gs){ this.mode = 'local'; setSaveState('local'); done(); return; }
    this.mode = 'cloud';
    setSaveState('loading');
    google.script.run
      .withSuccessHandler(r => { this.onLoaded(r); done(); })
      .withFailureHandler(() => { this.mode = 'local'; setSaveState('error'); done(); })
      .loadProgress();
  },
  onLoaded(r){
    if(!r || !r.ok){ this.mode = 'local'; setSaveState('nouser'); return; }
    this.user = r.email || '';
    if(r.data) save = normalize(r.data);
    else this.flush();                       // はじめての 児童 → いまの データを 送る
    setSaveState('ok');
  },
  readLocal(){
    try{ const raw = localStorage.getItem(SAVE_KEY); if(raw) save = normalize(JSON.parse(raw)); }
    catch(e){ save = defaultSave(); }
  },
  writeLocal(){
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){}
  },
  put(immediate){
    this.writeLocal();
    if(this.mode !== 'cloud') return;
    this.dirty = true;
    clearTimeout(this.timer);
    /* サーバーへの 書きこみは ステージ クリア時などに まとめて おこなう
       （通信を へらす ため。とちゅうの 1問ごとは この端末に だけ 記録）  */
    if(immediate) this.flush();
    else this.timer = setTimeout(() => this.flush(), 15000);
  },
  flush(){
    if(this.mode !== 'cloud') return;
    if(this.sending){ this.again = true; return; }
    this.sending = true; this.dirty = false;
    setSaveState('saving');
    google.script.run
      .withSuccessHandler(() => { this.sending = false; setSaveState('ok'); if(this.again){ this.again = false; this.flush(); } })
      .withFailureHandler(() => { this.sending = false; setSaveState('error'); })
      .saveProgress(JSON.stringify(save));
  },
  log(rec){
    if(this.mode !== 'cloud') return;
    try{ google.script.run.withFailureHandler(() => {}).logClear(rec); }catch(e){}
  }
};
function store(immediate){ Store.put(immediate); }

function setSaveState(kind){
  const el = $('saveState');
  if(!el) return;
  const t = {
    local:  ['💾 この パソコンに きろく', 'ok'],
    loading:['☁ よみこみちゅう…', 'wait'],
    saving: ['☁ ほぞんちゅう…', 'wait'],
    ok:     ['☁ ほぞん できました', 'ok'],
    nouser: ['⚠ きろくを ほぞん できません', 'ng'],
    error:  ['⚠ つうしん エラー（あとで もういちど）', 'ng']
  }[kind] || ['', 'ok'];
  el.textContent = t[0];
  el.className = 'save-state ' + t[1];
}

/* ---------------- おと ---------------- */
const Audio2 = {
  ctx:null,
  ac(){
    if(!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{ this.ctx = new AC(); }catch(e){ return null; }
    }
    if(this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
};
const Sound = {
  tone(freq, start, dur, vol, type){
    if(!save.settings.sound) return;
    const c = Audio2.ac(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  },
  tap(){ this.tone(880, 0, 0.08, 0.12, 'triangle'); },
  ok(){ this.tone(1046, 0, 0.11, 0.14, 'triangle'); this.tone(1568, 0.07, 0.13, 0.10, 'triangle'); },
  ng(){ this.tone(196, 0, 0.2, 0.15, 'sawtooth'); },
  /* ピンポン（せいかい） */
  pinpon(){
    this.tone(1318.5, 0,    0.75, 0.22, 'sine'); this.tone(2637, 0,    0.35, 0.06, 'sine');
    this.tone(1046.5, 0.26, 0.95, 0.22, 'sine'); this.tone(2093, 0.26, 0.45, 0.06, 'sine');
  },
  fanfare(){ [523,659,784,1046,1319].forEach((f,i) => this.tone(f, i*0.13, 0.5, 0.16, 'triangle')); }
};

/* かんたんな BGM（音声ファイルは つかわず その場で つくる） */
const Bgm = {
  timer:null, i:0, gain:null,
  mel:[0,4,7,4,9,7,4,2, 0,4,7,12,9,7,4,2],
  start(){
    if(this.timer || !save.settings.bgm) return;
    const c = Audio2.ac(); if(!c) return;
    this.gain = c.createGain();
    this.gain.gain.value = 0.055;
    this.gain.connect(c.destination);
    this.i = 0;
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
  },
  note(freq, dur, type, vol){
    const c = Audio2.ctx; if(!c || !this.gain) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.gain);
    o.start(t); o.stop(t + dur + 0.05);
  },
  tick(){
    const base = 523.25;                       // ド
    const n = this.mel[this.i % this.mel.length];
    this.note(base * Math.pow(2, n / 12), 0.45, 'triangle', 0.5);
    if(this.i % 4 === 0) this.note(base / 4 * Math.pow(2, (this.i % 8 === 0 ? 0 : 7) / 12), 1.1, 'sine', 0.8);
    this.i++;
  },
  stop(){
    clearInterval(this.timer); this.timer = null;
    if(this.gain){ try{ this.gain.disconnect(); }catch(e){} this.gain = null; }
  },
  sync(){ if(save.settings.bgm) this.start(); else this.stop(); }
};

/* ---------------- 問題づくり ---------------- */
const rnd = n => Math.floor(Math.random() * n);
const randRange = (lo, hi) => lo + rnd(hi - lo + 1);
const digitsOf = n => String(n).split('').reverse().map(Number);

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
      if(j >= eff.length) return 99;
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
      if(a + b > 999) continue;
      const c = countCarries(a, b);
      if(level.mode === 'none' && c !== 0) continue;
      if(level.mode === 'some' && c === 0) continue;
      if(level.mode === 'mix' && Math.random() < 0.65 && c === 0) continue;
    }else{
      a = randRange(loA, hiA);
      b = randRange(10, a);
      if(b >= a) continue;
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

/* ---------------- ひっ算の 手順づくり ----------------
   steps は「入力する順番」。kind:
     'ans'    … こたえのマス
     'carry'  … くり上がりの 1
     'borrow' … くり下がりで へらした 数
     'judgeC' … くり上がりは ある？ ない？（じぶんで えらぶ モード）
     'judgeB' … くり下がりは ひつよう？（じぶんで えらぶ モード）
------------------------------------------------------- */
function buildPlan(a, b, op, selfJudge){
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
      const up = sum >= 10 ? 1 : 0;
      if(i < R.length){
        ans[i] = sum % 10;
        steps.push({ kind:'ans', col:i, value:sum % 10, x, y, carryIn:carry, sum });
      }
      if(i + 1 < nCols){
        if(selfJudge) steps.push({ kind:'judgeC', col:i, value:up, x, y, carryIn:carry, sum });
        if(up){
          marks[i + 1] = 1;
          steps.push({ kind:'carry', col:i + 1, value:1, sum });
        }
      }
      carry = up;
    }
  }else{
    const eff = A.slice();
    for(let i = 0; i < nCols; i++){
      const y = B[i] || 0;
      const before = eff[i] || 0;
      const need = before < y ? 1 : 0;
      if(i < R.length && selfJudge && i + 1 < nCols){
        steps.push({ kind:'judgeB', col:i, value:need, x:before, y });
      }
      if(need){
        let j = i + 1;
        while((eff[j] || 0) === 0) j++;
        eff[j] -= 1;
        marks[j] = eff[j];
        steps.push({ kind:'borrow', col:j, value:eff[j], orig:eff[j] + 1, x:before, y });
        for(let k = j - 1; k > i; k--){
          eff[k] = 9;
          marks[k] = 9;
          steps.push({ kind:'borrow', col:k, value:9, orig:0, x:before, y });
        }
        eff[i] += 10;
      }
      if(i < R.length){
        ans[i] = (eff[i] || 0) - y;
        steps.push({ kind:'ans', col:i, value:(eff[i] || 0) - y, x:(eff[i] || 0), y, borrowed:!!need });
      }
    }
  }
  return { a, b, op, A, B, nCols, marks, ans, steps, result };
}

/* ---------------- ゲームの じょうたい ---------------- */
const G = {
  level:null, qIndex:0, missInStage:0, streak:0, qMiss:false,
  plan:null, stepIndex:0, wrongOnStep:0, helpOnStep:0, locked:false
};

/* ---------------- DOM ---------------- */
const $ = id => document.getElementById(id);
const SCREENS = ['screen-home','screen-game','screen-clear','screen-dex','screen-stats'];
function show(id){
  SCREENS.forEach(s => $(s).classList.toggle('is-active', s === id));
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
       <div class="stage-body">
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
  const last = save.monsters.length ? MONSTERS[save.monsters[save.monsters.length - 1]] : MONSTERS[0];
  $('homeMascot').innerHTML = monsterSVG(last, 'mascot');
  $('userName').textContent = Store.user ? Store.user.split('@')[0] + ' さん' : '';
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
  G.plan = buildPlan(p.a, p.b, p.op, save.settings.judge === 'self');
  G.stepIndex = 0; G.wrongOnStep = 0; G.helpOnStep = 0; G.locked = false; G.qMiss = false;
  $('qNo').textContent = `だい ${G.qIndex + 1} もん`;
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
  h += '<div class="crow marks"><div class="cell"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell" data-col="${c}">${c > 0 ? `<div class="mark-box" id="mk${c}"></div>` : ''}</div>`;
  }
  h += '</div>';

  h += '<div class="crow"><div class="cell op"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><span id="da${c}">${A[c] != null ? A[c] : ''}</span></div>`;
  }
  h += '</div>';

  h += `<div class="crow"><div class="cell op">${op === '+' ? '＋' : '−'}</div>`;
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><span>${B[c] != null ? B[c] : ''}</span></div>`;
  }
  h += '</div>';

  h += '<div class="rule"></div>';

  h += '<div class="crow"><div class="cell op"></div>';
  for(let c = nCols - 1; c >= 0; c--){
    h += `<div class="cell digit" data-col="${c}"><div class="ans-box" id="an${c}"></div></div>`;
  }
  h += '</div>';

  calc.innerHTML = h;
}

const isJudge = s => s && (s.kind === 'judgeC' || s.kind === 'judgeB');
function cellOf(step){
  if(isJudge(step)) return null;
  return step.kind === 'ans' ? $('an' + step.col) : $('mk' + step.col);
}
function clearHighlights(){
  document.querySelectorAll('.colhi').forEach(e => e.classList.remove('colhi'));
  document.querySelectorAll('#calc .active').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.hintkey').forEach(e => e.classList.remove('hintkey'));
}
function focusStep(){
  clearHighlights();
  const step = G.plan.steps[G.stepIndex];
  if(!step) return;
  document.querySelectorAll(`[data-col="${step.col}"]`).forEach(e => e.classList.add('colhi'));
  if(isJudge(step)){
    showJudge(true, step);
  }else{
    showJudge(false);
    cellOf(step).classList.add('active');
  }
  setBubble(hintFor(step, false), false);
}
function showJudge(on, step){
  $('pad').hidden = on;
  $('judge').hidden = !on;
  if(on){
    const add = G.plan.op === '+';
    $('jYes').textContent = add ? 'くり上がり　あり' : 'くり下がり　あり';
    $('jNo').textContent  = add ? 'くり上がり　なし' : 'くり下がり　なし';
  }
}

/* ---------------- ヒントの ことば ---------------- */
function hintFor(step, detail){
  const place = PLACE[step.col] || '';
  const quiet = !save.settings.hint && !detail;

  if(step.kind === 'judgeC'){
    if(quiet) return `${place}の くらいの くり上がりは ある？ ない？`;
    return `${step.carryIn ? step.carryIn + ' ＋ ' : ''}${step.x} ＋ ${step.y} は ${step.sum}。10 より 大きいかな？ くり上がりは ある？ ない？`;
  }
  if(step.kind === 'judgeB'){
    if(quiet) return `${place}の くらいは そのまま ひける？`;
    return `${step.x} から ${step.y} は ひけるかな？ ひけないときは となりの くらいから 1 かりるよ。`;
  }
  if(quiet){
    if(step.kind === 'ans')   return `${place}の くらいの こたえを かこう`;
    return `${place}の くらいの うえに かこう`;
  }
  if(G.plan.op === '+'){
    if(step.kind === 'carry') return `10 の たばが 1こ できたね！ ${place}の くらいの うえに 小さく 1 と かこう。`;
    if(step.carryIn > 0)      return `くり上がりの 1 も わすれずに。 1 ＋ ${step.x} ＋ ${step.y} は？ ${place}の くらいに かこう。`;
    if(step.x === 0 && step.y === 0) return `のこった 1 を そのまま かこう。`;
    return `${step.x} ＋ ${step.y} は？ ${place}の くらいに かこう。`;
  }
  if(step.kind === 'borrow'){
    if(step.orig === 0) return `${place}の くらいは 0 だね。となりから かりて 9 に なるよ。9 と かこう。`;
    return `${step.x} から ${step.y} は ひけない！ ${place}の くらいの ${step.orig} から 1 かりて、うえに 小さく かこう。`;
  }
  if(step.borrowed) return `1 かりたので ${step.x} だね。 ${step.x} − ${step.y} は？`;
  return `${step.x} − ${step.y} は？ ${place}の くらいに かこう。`;
}
function setBubble(text, cheer){
  const b = $('bubble');
  b.textContent = text;
  b.classList.toggle('cheer', !!cheer);
}

/* ---------------- 入力 ---------------- */
function wrongFeedback(step, shakeEl){
  Sound.ng();
  if(navigator.vibrate) navigator.vibrate(60);
  if(shakeEl){
    shakeEl.classList.add('shake');
    setTimeout(() => shakeEl.classList.remove('shake'), 400);
  }
  G.wrongOnStep++; G.qMiss = true;
  if(G.wrongOnStep === 1){ G.missInStage++; setBubble('おしい！ もういちど かんがえてみよう。', false); return; }
  if(G.wrongOnStep === 2){ setBubble(hintFor(step, true), false); return; }
  setBubble(hintFor(step, true) + '　→ ひかっている ボタンを おしてね。', false);
  const sel = isJudge(step) ? `.jbtn[data-v="${step.value}"]` : `.key[data-d="${step.value}"]`;
  const k = document.querySelector(sel);
  if(k) k.classList.add('hintkey');
}
function advance(){
  G.stepIndex++; G.wrongOnStep = 0; G.helpOnStep = 0;
  if(G.stepIndex >= G.plan.steps.length) finishQuestion();
  else focusStep();
}
function handleDigit(d){
  if(G.locked) return;
  const step = G.plan.steps[G.stepIndex];
  if(!step || isJudge(step)) return;
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
    advance();
  }else{
    wrongFeedback(step, cell);
  }
}
function handleJudge(v){
  if(G.locked) return;
  const step = G.plan.steps[G.stepIndex];
  if(!isJudge(step)) return;
  if(v === step.value){
    Sound.ok();
    const btn = document.querySelector(`.jbtn[data-v="${v}"]`);
    if(btn){ btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 340); }
    advance();
  }else{
    wrongFeedback(step, $('judge'));
  }
}

/* ---------------- 1もん せいかい ---------------- */
function finishQuestion(){
  G.locked = true;
  showJudge(false);
  clearHighlights();
  G.plan.ans.forEach((v, i) => { if(v == null) $('an' + i).classList.add('ghost'); });

  const { a, b, op, result } = G.plan;
  setBubble(`${a} ${op === '+' ? '＋' : '−'} ${b} ＝ ${result}　${CHEER[rnd(CHEER.length)]}`, true);
  $('teacherFace').classList.add('happy');

  /* はなまる ＋ ピンポン */
  const hm = $('hanamaru');
  hm.innerHTML = hanamaruSVG();
  hm.classList.add('show');
  Sound.pinpon();

  if(!G.qMiss) G.streak++; else G.streak = 0;
  const c = $('combo');
  if(G.streak >= 2){
    c.textContent = `🔥 れんぞく ${G.streak}もん！`;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }else c.textContent = '';

  save.totalQ++;
  store();

  setTimeout(() => {
    hm.classList.remove('show'); hm.innerHTML = '';
    $('teacherFace').classList.remove('happy');
    G.qIndex++;
    if(G.qIndex >= QUESTIONS_PER_STAGE) finishStage();
    else nextQuestion();
  }, 1500);
}

function sparkle(n){
  for(let i = 0; i < n; i++){
    const s = document.createElement('div');
    s.className = 'fall';
    s.textContent = ['⭐','✨','🌟','💫'][rnd(4)];
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

  const own = new Set(save.monsters);
  const rest = MONSTERS.map((m, i) => i).filter(i => !own.has(i));
  let gotIndex, isNew = false;
  if(rest.length){ gotIndex = rest[rnd(rest.length)]; save.monsters.push(gotIndex); isNew = true; }
  else gotIndex = rnd(MONSTERS.length);

  store(true);
  Store.log({ level:lv.id, name:lv.name + ' ' + lv.sub, stars:stars, miss:G.missInStage, q:QUESTIONS_PER_STAGE });

  $('clearStars').innerHTML = [1,2,3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
  $('clearMsg').textContent = G.missInStage === 0
    ? 'ぜんもん いっぱつ せいかい！ すばらしい！'
    : `まちがえた かず：${G.missInStage}　つぎは ノーミスを ねらおう！`;
  $('clearName').textContent = '';
  $('egg').innerHTML = eggSVG('egg-svg');
  $('egg').classList.remove('gone');
  $('hatched').innerHTML = '';
  $('hatched').classList.remove('show');
  show('screen-clear');
  Sound.fanfare();

  setTimeout(() => {
    $('egg').classList.add('gone');
    $('hatched').innerHTML = monsterSVG(MONSTERS[gotIndex], 'big');
    $('hatched').classList.add('show');
    $('clearName').textContent = isNew
      ? MONSTERS[gotIndex].name + ' が うまれた！'
      : 'また あえたね！ ' + MONSTERS[gotIndex].name;
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
  const own = new Set(save.monsters);
  g.innerHTML = MONSTERS.map((m, i) => own.has(i)
    ? `<div class="dex-cell">${monsterSVG(m)}<div class="nm">${m.name}</div></div>`
    : `<div class="dex-cell locked"><div class="q">?</div><div class="nm">？？？</div></div>`
  ).join('');
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
  document.querySelectorAll('.jbtn').forEach(b => {
    b.addEventListener('click', () => { Sound.tap(); handleJudge(Number(b.dataset.v)); });
  });
  $('btnHelp').addEventListener('click', () => {
    Sound.tap();
    const step = G.plan && G.plan.steps[G.stepIndex];
    if(!step || G.locked) return;
    G.helpOnStep++;
    setBubble(hintFor(step, true), false);
    if(G.helpOnStep >= 2){
      const sel = isJudge(step) ? `.jbtn[data-v="${step.value}"]` : `.key[data-d="${step.value}"]`;
      const k = document.querySelector(sel);
      if(k) k.classList.add('hintkey');
    }
  });
}

/* ---------------- せってい ---------------- */
function syncSettings(){
  $('setHint').checked = save.settings.hint;
  $('setSound').checked = save.settings.sound;
  $('setBgm').checked = save.settings.bgm;
  $('setUnlock').checked = save.settings.unlock;
  document.querySelectorAll('#segJudge button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === save.settings.judge);
  });
}

/* ---------------- 起動 ---------------- */
function init(){
  buildPad();
  $('teacherFace').innerHTML = monsterSVG(MONSTERS[0], 'teacher-mon');
  Store.boot(() => {
    syncSettings();
    renderHome();
    $('loading').hidden = true;
    show('screen-home');
  });

  $('btnBackHome').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });
  $('btnDex').addEventListener('click', () => { Sound.tap(); renderDex(); show('screen-dex'); });
  $('btnDexBack').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });
  $('btnStats').addEventListener('click', () => { Sound.tap(); renderStats(); show('screen-stats'); });
  $('btnStatsBack').addEventListener('click', () => { Sound.tap(); renderHome(); show('screen-home'); });

  $('btnSettings').addEventListener('click', () => { Sound.tap(); syncSettings(); $('modalSettings').hidden = false; });
  $('btnCloseSettings').addEventListener('click', () => { Sound.tap(); $('modalSettings').hidden = true; renderHome(); });
  $('setHint').addEventListener('change', e => { save.settings.hint = e.target.checked; store(true); });
  $('setSound').addEventListener('change', e => { save.settings.sound = e.target.checked; store(true); if(e.target.checked) Sound.tap(); });
  $('setBgm').addEventListener('change', e => { save.settings.bgm = e.target.checked; store(true); Bgm.sync(); });
  $('setUnlock').addEventListener('change', e => { save.settings.unlock = e.target.checked; store(true); renderHome(); });
  document.querySelectorAll('#segJudge button').forEach(b => {
    b.addEventListener('click', () => {
      Sound.tap();
      save.settings.judge = b.dataset.v;
      syncSettings(); store(true);
    });
  });
  $('btnReset').addEventListener('click', () => {
    if(confirm('きろく（★・モンスター・せいせき）を ぜんぶ けします。よろしいですか？')){
      const keep = save.settings;
      save = defaultSave();
      save.settings = keep;
      store(true); syncSettings(); renderHome();
      $('modalSettings').hidden = true;
    }
  });

  /* キーボードでも あそべる（Chromebook） */
  window.addEventListener('keydown', e => {
    if(!$('screen-game').classList.contains('is-active')) return;
    if(e.key >= '0' && e.key <= '9'){ handleDigit(Number(e.key)); return; }
    const step = G.plan && G.plan.steps[G.stepIndex];
    if(isJudge(step)){
      if(e.key === 'ArrowLeft'  || e.key === 'a') handleJudge(1);
      if(e.key === 'ArrowRight' || e.key === 'n') handleJudge(0);
    }
  });

  /* タブを とじる / ふたを しめる ときに 書きのこしを 送る */
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden' && Store.dirty) Store.flush();
  });

  /* さいしょの クリックで 音を つかえるように する */
  const wake = () => { Audio2.ac(); Bgm.sync(); };
  document.addEventListener('click', wake, { once:true });
  document.addEventListener('keydown', wake, { once:true });
}
document.addEventListener('DOMContentLoaded', init);
