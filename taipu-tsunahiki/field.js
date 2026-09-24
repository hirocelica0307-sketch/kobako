/* つなひきの 場面（アニメーション）
   ------------------------------------------------------------------
   うしろから じゅんに かさねます。
     空（太陽・雲）→ 校舎 → 万国旗 → おうえん席（赤組・白組の お客さん）
     → グラウンド（おくゆきの ある 3D）→ つなと 3人ずつの 棒人間 → ふきだし
   棒人間は「どれだけ リードしているか」で ようすが かわります。
     ふつう   … うしろに たおれて ふんばる（ゆっくり ぐいっ、ぐいっ）
     リード中 … もっと たおれて、足で うしろへ さがる。えがお
     まけ中   … まえに ひっぱられ、足が もつれる。あせと 土ぼこり
     かち     … ぴょんぴょん はねて ばんざい
     まけ     … まえに ばたん（なき顔）
   キーを 打つたびに じぶんの チームが「ぐいっ」と 引き、
   ことばを 打ちおわると「よいしょ！」などの 声が 出ます。
   ------------------------------------------------------------------ */

const NS = 'http://www.w3.org/2000/svg';
export const ROPE_RANGE = 150;        // つなが うごく はば（ゴールの 線まで）
const GROUND_Y = 200;                 // 足の 高さ（つなの 絵の 中）
const SHOUTS = ['よいしょ！', 'えいっ！', 'ぐいっ！', 'それっ！', 'ふんっ！', 'まだまだ！'];

const RED = '#e53935', NAVY = '#33415c', SKIN = '#ffd8b0';

/* ── 棒人間 1人 ─────────────────────────────── */
function puller(team, x, i) {
    const white = team === 'white';
    const shirt = white
        ? `<line x1="0" y1="-62" x2="6" y2="-104" stroke="${NAVY}" stroke-width="19" stroke-linecap="round"/>
           <line x1="0" y1="-62" x2="6" y2="-104" stroke="#fff" stroke-width="13" stroke-linecap="round"/>`
        : `<line x1="0" y1="-62" x2="6" y2="-104" stroke="${RED}" stroke-width="16" stroke-linecap="round"/>`;
    const band = white ? '#fff' : RED;
    const place = white ? `translate(${x} ${GROUND_Y}) scale(-1 1)` : `translate(${x} ${GROUND_Y})`;
    return `
    <g class="pl p${i}" transform="${place}">
      <g class="lean"><g class="heave"><g class="jerk">
        <g class="legs">
          <path class="leg lb" d="M0 -60 L-15 -30 L-25 0" stroke="${NAVY}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="leg lf" d="M0 -60 L11 -31 L15 0" stroke="${NAVY}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <path d="M-10 -68 L10 -68 L11 -54 L-11 -54 Z" fill="${NAVY}"/>
        ${shirt}
        <g class="arms">
          <path d="M5 -99 L27 -89 L46 -80" stroke="${SKIN}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 -96 L24 -83 L40 -78" stroke="#f3c79c" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <g class="head" transform="translate(9 -124)">
          <path class="tail" d="M-17 -6 q-12 -3 -21 3 M-17 -3 q-11 4 -18 11" stroke="${white ? NAVY : RED}" stroke-width="${white ? 3 : 4}" fill="none" stroke-linecap="round"/>
          <circle r="18" fill="${SKIN}" stroke="${NAVY}" stroke-width="2.5"/>
          <rect x="-19" y="-12" width="38" height="8" rx="3" fill="${band}" stroke="${white ? NAVY : 'none'}" stroke-width="1.5"/>
          <g class="face f-focus">
            <path d="M2 -1 l7 2 M12 1 l6 -2" stroke="${NAVY}" stroke-width="3" stroke-linecap="round"/>
            <rect x="5" y="6" width="10" height="6" rx="2" fill="#fff" stroke="${NAVY}" stroke-width="2"/>
          </g>
          <g class="face f-happy">
            <path d="M2 1 q3 -5 6 0 M11 1 q3 -5 6 0" stroke="${NAVY}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M4 6 q6 9 12 0 z" fill="#d84343"/>
            <circle cx="-4" cy="6" r="3.5" fill="#ff9e9e" opacity=".7"/>
          </g>
          <g class="face f-panic">
            <path d="M2 -4 l5 3 l-5 3 M18 -4 l-5 3 l5 3" stroke="${NAVY}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 10 q2 -3 4 0 t4 0 t4 0" stroke="${NAVY}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          </g>
          <g class="face f-cry">
            <path d="M2 -1 q3 4 6 0 M11 -1 q3 4 6 0" stroke="${NAVY}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M4 12 q6 -7 12 0" stroke="${NAVY}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path class="tear" d="M5 3 q-3 6 0 8 q3 -2 0 -8 z" fill="#5ab4ff"/>
          </g>
          <path class="sweat" d="M-10 -20 q-5 8 0 11 q5 -3 0 -11 z" fill="#8fd3ff" stroke="#4aa3e0" stroke-width="1"/>
        </g>
      </g></g></g>
    </g>`;
}

/* ── おうえんの お客さん 1人 ─────────────────── */
function fan(team, k) {
    const cap = team === 'red' ? RED : '#fff';
    const flag = k % 3 === 0;
    const delay = (Math.random() * 0.9).toFixed(2);
    const speed = (0.7 + Math.random() * 0.5).toFixed(2);
    return `<svg class="fan" viewBox="0 0 30 48" style="animation-delay:-${delay}s;animation-duration:${speed}s">
      <g class="fan-arm fl" style="animation-delay:-${delay}s"><path d="M15 27 L5 18" stroke="${SKIN}" stroke-width="3.5" stroke-linecap="round"/>
        ${flag ? `<line x1="5" y1="18" x2="3" y2="4" stroke="#8a6a4a" stroke-width="1.5"/><path d="M3 4 L14 7 L3 11 Z" fill="${team === 'red' ? RED : '#fff'}" stroke="${NAVY}" stroke-width=".8"/>` : ''}</g>
      <g class="fan-arm fr" style="animation-delay:-${delay}s"><path d="M15 27 L25 18" stroke="${SKIN}" stroke-width="3.5" stroke-linecap="round"/></g>
      <line x1="15" y1="24" x2="15" y2="44" stroke="${NAVY}" stroke-width="9" stroke-linecap="round"/>
      <line x1="15" y1="24" x2="15" y2="44" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <circle cx="15" cy="15" r="8" fill="${SKIN}" stroke="${NAVY}" stroke-width="1.2"/>
      <path d="M7 14 a8 8 0 0 1 16 0 z" fill="${cap}" stroke="${NAVY}" stroke-width="1"/>
      <path d="M12 16 v1.5 M18 16 v1.5" stroke="${NAVY}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M12.5 19.5 q2.5 2.5 5 0" stroke="${NAVY}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    </svg>`;
}

/* ── 校舎 ─────────────────────────────────── */
const SCHOOL = `
<svg class="school" viewBox="0 0 300 120" aria-hidden="true">
  <rect x="20" y="40" width="260" height="80" fill="#f4efe6" stroke="#c9bca6" stroke-width="2"/>
  <rect x="120" y="10" width="60" height="110" fill="#fbf7ef" stroke="#c9bca6" stroke-width="2"/>
  <circle cx="150" cy="34" r="14" fill="#fff" stroke="${NAVY}" stroke-width="2.5"/>
  <path class="clock-hand" d="M150 34 L150 24" stroke="${NAVY}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M150 34 L157 34" stroke="${NAVY}" stroke-width="2.5" stroke-linecap="round"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const x = i < 4 ? 32 + i * 22 : 190 + (i - 4) * 22;
        return `<rect x="${x}" y="54" width="14" height="14" fill="#aee0ff" stroke="#c9bca6"/><rect x="${x}" y="84" width="14" height="14" fill="#aee0ff" stroke="#c9bca6"/>`;
    }).join('')}
  <rect x="136" y="92" width="28" height="28" fill="#b98b5e"/>
</svg>`;

/**
 * つなひきの 場面を 作ります。
 * @param {HTMLElement} root .field の 入れもの
 */
export function createField(root) {
    root.innerHTML = `
      <div class="sky">
        <div class="sun"><i></i></div>
        <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
        ${SCHOOL}
      </div>
      <svg class="field-flags" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="stands"><div class="crowd red"></div><div class="crowd white"></div></div>
      <div class="ground3d"><div class="track"></div></div>
      <svg class="tugsvg" viewBox="-60 0 1120 214" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <line x1="350" y1="120" x2="350" y2="212" stroke="${RED}" stroke-width="6" stroke-dasharray="10 8"/>
        <line x1="650" y1="120" x2="650" y2="212" stroke="${NAVY}" stroke-width="6" stroke-dasharray="10 8"/>
        <text x="350" y="112" text-anchor="middle" class="goal-t" fill="${RED}">ゴール</text>
        <text x="650" y="112" text-anchor="middle" class="goal-t" fill="${NAVY}">ゴール</text>
        <line x1="500" y1="150" x2="500" y2="214" stroke="#fff" stroke-width="7"/>
        <g class="ropeG">
          <g class="team red">${puller('red', 112, 3)}${puller('red', 188, 2)}${puller('red', 264, 1)}</g>
          <g class="team white">${puller('white', 736, 1)}${puller('white', 812, 2)}${puller('white', 888, 3)}</g>
          <g class="rope">
            <path d="M60 124 Q300 ${GROUND_Y - 72} 500 ${GROUND_Y - 76} Q700 ${GROUND_Y - 72} 940 124" stroke="#9a6a36" stroke-width="12" fill="none" stroke-linecap="round"/>
            <path d="M60 124 Q300 ${GROUND_Y - 72} 500 ${GROUND_Y - 76} Q700 ${GROUND_Y - 72} 940 124" stroke="#c99a5b" stroke-width="4" stroke-dasharray="12 9" fill="none"/>
            <g class="ribbon"><rect x="494" y="${GROUND_Y - 90}" width="12" height="28" rx="3" fill="${RED}"/>
              <path d="M500 ${GROUND_Y - 70} L486 ${GROUND_Y - 34} L514 ${GROUND_Y - 34} Z" fill="${RED}"/></g>
          </g>
          <g class="dusts"></g>
        </g>
      </svg>
      <div class="shouts"></div>
      <div class="confetti"></div>
      <div class="cheer" id="cheer"></div>`;

    /* 万国旗 */
    const flags = root.querySelector('.field-flags');
    const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff', '#00acc1'];
    let f = '<path d="M0 3 Q250 18 500 4 Q750 18 1000 3" stroke="#7a5a3a" stroke-width="1.2" fill="none"/>';
    for (let i = 0, x = 10; x < 1000; i++, x += 24) {
        const u = (x % 500) / 500, y = (1 - u) * (1 - u) * 3 + 2 * (1 - u) * u * 18 + u * u * 4;
        f += `<path class="flag" style="animation-delay:-${(i % 7) * 0.3}s" d="M${x - 8} ${y} L${x + 8} ${y} L${x} ${y + 20} Z" fill="${colors[i % colors.length]}" stroke="rgba(0,0,0,.15)"/>`;
    }
    flags.innerHTML = f;

    const $q = s => root.querySelector(s);
    const rope = $q('.ropeG');
    const redTeam = $q('.team.red'), whiteTeam = $q('.team.white');
    const crowdRed = $q('.crowd.red'), crowdWhite = $q('.crowd.white');
    const shouts = $q('.shouts'), confetti = $q('.confetti'), dusts = $q('.dusts');

    /* おきゃくさんの 数は はばに あわせます */
    let crowdW = 0;
    const fillCrowd = () => {
        const w = crowdRed.clientWidth;
        if (!w || Math.abs(w - crowdW) < 20) return;
        crowdW = w;
        const n = Math.max(4, Math.floor(w / 24));
        crowdRed.innerHTML = Array.from({ length: n }, (_, k) => fan('red', k)).join('');
        crowdWhite.innerHTML = Array.from({ length: n }, (_, k) => fan('white', k)).join('');
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fillCrowd).observe(root);
    requestAnimationFrame(fillCrowd);

    let state = { me: '', foe: '' }, dustTimer = null, ended = false;

    const setTeam = (el, st) => { el.setAttribute('class', 'team ' + (el === redTeam ? 'red' : 'white') + (st ? ' st-' + st : '')); };
    const pulse = (el, cls, ms) => {
        el.classList.remove(cls);
        void el.getBoundingClientRect();
        el.classList.add(cls);
        clearTimeout(el['_t' + cls]);
        el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms);
    };

    /* 土ぼこり（ひっぱられている チームの 足もと）*/
    function puff() {
        const who = state.me === 'drag' ? 'red' : state.foe === 'drag' ? 'white' : null;
        const strong = state.me === 'strong' ? 'red' : state.foe === 'strong' ? 'white' : null;
        for (const t of [who, strong]) {
            if (!t) continue;
            const x = t === 'red' ? 100 + Math.random() * 170 : 730 + Math.random() * 170;
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', x.toFixed(0));
            c.setAttribute('cy', GROUND_Y - 4);
            c.setAttribute('r', (6 + Math.random() * 6).toFixed(0));
            c.setAttribute('class', 'dust');
            dusts.appendChild(c);
            setTimeout(() => c.remove(), 800);
        }
    }

    function shout(side, text) {
        const el = document.createElement('div');
        el.className = 'shout ' + side;
        el.textContent = text || SHOUTS[Math.floor(Math.random() * SHOUTS.length)];
        el.style.left = (side === 'red' ? 12 + Math.random() * 16 : 66 + Math.random() * 16) + '%';
        shouts.appendChild(el);
        setTimeout(() => el.remove(), 1100);
    }

    function party() {
        const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa'];
        let html = '';
        for (let i = 0; i < 60; i++) {
            html += `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};` +
                `animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(1.6 + Math.random() * 1.4).toFixed(2)}s"></i>`;
        }
        confetti.innerHTML = html;
    }

    return {
        /** はじめの ようすに もどします */
        reset() {
            ended = false;
            state = { me: '', foe: '' };
            setTeam(redTeam, 'ready'); setTeam(whiteTeam, 'ready');
            crowdRed.className = 'crowd red'; crowdWhite.className = 'crowd white';
            rope.style.transform = 'translateX(0px)';
            confetti.innerHTML = '';
            shouts.innerHTML = '';
            root.classList.remove('shake');
            clearInterval(dustTimer);
            dustTimer = setInterval(puff, 260);
        },

        /** つなの いちと、2チームの ようすを きめます */
        setBalance(diff, goal, live) {
            if (ended) return;
            const r = Math.max(-1, Math.min(1, diff / goal));
            rope.style.transform = `translateX(${(-r * ROPE_RANGE).toFixed(1)}px)`;
            const me = !live ? 'ready' : r >= 0.35 ? 'strong' : r <= -0.35 ? 'drag' : 'hold';
            const foe = !live ? 'ready' : r <= -0.35 ? 'strong' : r >= 0.35 ? 'drag' : 'hold';
            if (me !== state.me) setTeam(redTeam, me);
            if (foe !== state.foe) setTeam(whiteTeam, foe);
            state = { me, foe };
            crowdRed.classList.toggle('hype', live && r > 0.25);
            crowdWhite.classList.toggle('hype', live && r < -0.25);
        },

        /** じぶんが 1もじ 打った（ぐいっ）*/
        tugMe() { if (!ended) pulse(redTeam, 'tug', 230); },
        /** あいてが 打った */
        tugFoe() { if (!ended) pulse(whiteTeam, 'tug', 230); },
        /** ことばを 打ちおわった（声）*/
        wordMe() { if (!ended) shout('red'); },
        wordFoe() { if (!ended) shout('white'); },
        /** ぎゃくてん！ … 画面が すこし ゆれます */
        bump() { pulse(root, 'shake', 450); },

        /** おわり：'win' | 'lose' | 'draw' */
        finish(res) {
            ended = true;
            clearInterval(dustTimer);
            const my = res === 'win' ? 'win' : res === 'lose' ? 'lose' : 'hold';
            const their = res === 'win' ? 'lose' : res === 'lose' ? 'win' : 'hold';
            setTeam(redTeam, my);
            setTeam(whiteTeam, their);
            crowdRed.className = 'crowd red' + (res === 'win' ? ' party' : '');
            crowdWhite.className = 'crowd white' + (res === 'lose' ? ' party' : '');
            if (res === 'win') party();
            pulse(root, 'shake', 450);
        },

        stop() { clearInterval(dustTimer); }
    };
}
