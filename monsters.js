/* ===================================================================
   モンスターの オリジナル SVG イラスト
   画像ファイルは つかわず、パーツの くみあわせで 24ひきを えがきます。
   （かたち / みみ・つの / め / くち / もよう / いろ の くみあわせ）
   =================================================================== */
'use strict';

const INK = '#2f2a26';

/* からだ */
function mBody(t, c1){
  switch(t){
    case 'round': return `<circle cx="50" cy="55" r="37" fill="${c1}"/>`;
    case 'egg':   return `<ellipse cx="50" cy="57" rx="33" ry="38" fill="${c1}"/>`;
    case 'tall':  return `<rect x="18" y="17" width="64" height="75" rx="30" fill="${c1}"/>`;
    case 'drop':  return `<path d="M50 9C67 31 85 45 85 61c0 19-16 31-35 31S15 80 15 61C15 45 33 31 50 9z" fill="${c1}"/>`;
    case 'bean':  return `<path d="M24 25c17-11 40-9 52 5 13 15 12 42-6 53-18 12-44 6-52-12-8-19-8-39 6-46z" fill="${c1}"/>`;
    default:      return `<path d="M50 11c24 0 38 20 38 45 0 24-16 36-38 36S12 80 12 56c0-25 14-45 38-45z" fill="${c1}"/>`;
  }
}
/* あし */
const mFeet = c => `<ellipse cx="33" cy="92" rx="11" ry="6" fill="${c}"/><ellipse cx="67" cy="92" rx="11" ry="6" fill="${c}"/>`;

/* あたまの パーツ（からだの うしろに かく） */
function mTop(t, c2){
  switch(t){
    case 'horn':  return `<path d="M29 24 22 4l21 12z" fill="${c2}"/><path d="M71 24 78 4 57 16z" fill="${c2}"/>`;
    case 'ears':  return `<circle cx="21" cy="25" r="12" fill="${c2}"/><circle cx="79" cy="25" r="12" fill="${c2}"/>`;
    case 'long':  return `<ellipse cx="33" cy="12" rx="8" ry="18" fill="${c2}" transform="rotate(-13 33 12)"/><ellipse cx="67" cy="12" rx="8" ry="18" fill="${c2}" transform="rotate(13 67 12)"/>`;
    case 'ant':   return `<path d="M42 14 38 3M58 14 62 3" stroke="${c2}" stroke-width="3.5" stroke-linecap="round"/><circle cx="37" cy="2.5" r="4.5" fill="${c2}"/><circle cx="63" cy="2.5" r="4.5" fill="${c2}"/>`;
    case 'fin':   return `<path d="M50 1 63 23H37z" fill="${c2}"/>`;
    case 'tuft':  return `<path d="M42 16q4-13 8 0M50 16q5-15 9-1" stroke="${c2}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    case 'crown': return `<path d="M33 18 39 6l11 8 11-8 6 12z" fill="#ffd34d" stroke="#e0a100" stroke-width="2" stroke-linejoin="round"/>`;
    case 'bolt':  return `<path d="M52 2 38 20h10L44 34 64 14H52z" fill="#ffd34d" stroke="#e0a100" stroke-width="1.5" stroke-linejoin="round"/>`;
    default:      return '';
  }
}
/* せなか（いちばん うしろ） */
function mBack(t, c2){
  switch(t){
    case 'wings': return `<ellipse cx="14" cy="48" rx="14" ry="20" fill="${c2}" opacity=".85" transform="rotate(-18 14 48)"/><ellipse cx="86" cy="48" rx="14" ry="20" fill="${c2}" opacity=".85" transform="rotate(18 86 48)"/>`;
    case 'spike': return `<path d="M18 40 4 52l16 8zM82 40l14 12-16 8z" fill="${c2}"/>`;
    case 'tail':  return `<path d="M84 74c12 2 14-10 8-16" stroke="${c2}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    default:      return '';
  }
}
/* もよう */
function mPat(t, c2){
  switch(t){
    case 'belly':  return `<ellipse cx="50" cy="70" rx="21" ry="16" fill="#fff" opacity=".65"/>`;
    case 'spots':  return `<circle cx="27" cy="64" r="6" fill="${c2}" opacity=".7"/><circle cx="72" cy="72" r="5" fill="${c2}" opacity=".7"/><circle cx="50" cy="84" r="4.5" fill="${c2}" opacity=".7"/>`;
    case 'stripe': return `<path d="M20 66q30 11 60 0M24 78q26 9 52 0" stroke="${c2}" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round"/>`;
    case 'star':   return `<path d="m50 58 4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L50 81.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fff" opacity=".8"/>`;
    case 'swirl':  return `<path d="M50 62c8 0 12 6 12 11s-5 9-9 9-7-3-7-6 2-5 5-5" stroke="#fff" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round"/>`;
    default:       return '';
  }
}
/* め */
function mEye(t){
  switch(t){
    case 'happy':  return `<path d="M30 52q7-9 14 0M56 52q7-9 14 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'big':    return `<ellipse cx="37" cy="50" rx="10" ry="11.5" fill="#fff"/><ellipse cx="63" cy="50" rx="10" ry="11.5" fill="#fff"/><circle cx="38" cy="52" r="5.5" fill="${INK}"/><circle cx="64" cy="52" r="5.5" fill="${INK}"/><circle cx="35.5" cy="48" r="2.2" fill="#fff"/><circle cx="61.5" cy="48" r="2.2" fill="#fff"/>`;
    case 'one':    return `<circle cx="50" cy="48" r="15" fill="#fff"/><circle cx="51" cy="50" r="8" fill="${INK}"/><circle cx="46.5" cy="44.5" r="3" fill="#fff"/>`;
    case 'sleepy': return `<path d="M30 50q7 8 14 0M56 50q7 8 14 0" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    case 'wink':   return `<circle cx="37" cy="50" r="7" fill="${INK}"/><circle cx="35" cy="47.5" r="2.4" fill="#fff"/><path d="M56 51q7-9 14 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    default:       return `<circle cx="37" cy="50" r="7" fill="${INK}"/><circle cx="63" cy="50" r="7" fill="${INK}"/><circle cx="35" cy="47.5" r="2.4" fill="#fff"/><circle cx="61" cy="47.5" r="2.4" fill="#fff"/>`;
  }
}
/* くち */
function mMouth(t){
  switch(t){
    case 'open': return `<path d="M40 64q10 16 20 0z" fill="#b8354f"/><path d="M45 71q5 6 10 0z" fill="#ff8fa6"/>`;
    case 'fang': return `<path d="M40 65q10 10 20 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="m44 66 3 6 3-6z" fill="#fff" stroke="${INK}" stroke-width="1"/>`;
    case 'w':    return `<path d="M39 65q5.5 7 11 0 5.5 7 11 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'beak': return `<path d="M43 63h14l-7 11z" fill="#ffa62b" stroke="#e08600" stroke-width="1.5" stroke-linejoin="round"/>`;
    case 'cat':  return `<path d="M50 63v4M50 67q-5 6-9 1M50 67q5 6 9 1" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    default:     return `<path d="M41 65q9 9 18 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
}
const mCheek = on => on ? `<circle cx="25" cy="61" r="5.5" fill="#ff8fa6" opacity=".6"/><circle cx="75" cy="61" r="5.5" fill="#ff8fa6" opacity=".6"/>` : '';

/* 24ひきの ていぎ */
const MONSTERS = [
  { name:'ヒヨピー',    c1:'#ffd45e', c2:'#f5a623', body:'egg',   top:'tuft',  back:'',      pat:'belly',  eye:'dot',    mouth:'beak', cheek:1 },
  { name:'ケロタン',    c1:'#7ed957', c2:'#43a83a', body:'blob',  top:'ears',  back:'',      pat:'belly',  eye:'big',    mouth:'smile',cheek:1 },
  { name:'タコリン',    c1:'#ff8aa1', c2:'#e05575', body:'round', top:'',      back:'spike', pat:'spots',  eye:'happy',  mouth:'open', cheek:1 },
  { name:'キツネン',    c1:'#ffa552', c2:'#e0762b', body:'bean',  top:'horn',  back:'tail',  pat:'belly',  eye:'wink',   mouth:'cat',  cheek:1 },
  { name:'カメゴロウ',  c1:'#5ec9b7', c2:'#2e9384', body:'round', top:'',      back:'',      pat:'swirl',  eye:'sleepy', mouth:'smile',cheek:0 },
  { name:'ノッシー',    c1:'#9be07a', c2:'#5aa83f', body:'drop',  top:'fin',   back:'spike', pat:'spots',  eye:'dot',    mouth:'fang', cheek:0 },
  { name:'ユニポン',    c1:'#f0a7f5', c2:'#c060d8', body:'bean',  top:'ant',   back:'wings', pat:'star',   eye:'big',    mouth:'smile',cheek:1 },
  { name:'ブンブン',    c1:'#ffd84d', c2:'#4a4239', body:'egg',   top:'ant',   back:'wings', pat:'stripe', eye:'big',    mouth:'w',    cheek:1 },
  { name:'ペンタ',      c1:'#5b7fd4', c2:'#2f4f9e', body:'egg',   top:'',      back:'',      pat:'belly',  eye:'dot',    mouth:'beak', cheek:1 },
  { name:'パンダフ',    c1:'#f2f2f2', c2:'#3b3b3b', body:'round', top:'ears',  back:'',      pat:'belly',  eye:'big',    mouth:'smile',cheek:0 },
  { name:'ホーホー',    c1:'#c9a06a', c2:'#8a6438', body:'blob',  top:'horn',  back:'wings', pat:'stripe', eye:'one',    mouth:'beak', cheek:0 },
  { name:'イルピョン',  c1:'#6ec5f5', c2:'#2f8fd0', body:'drop',  top:'fin',   back:'tail',  pat:'belly',  eye:'happy',  mouth:'smile',cheek:1 },
  { name:'ドラゴー',    c1:'#7bd4c0', c2:'#2f9e86', body:'blob',  top:'horn',  back:'wings', pat:'stripe', eye:'dot',    mouth:'fang', cheek:0 },
  { name:'ガオライ',    c1:'#ffc861', c2:'#d98b1f', body:'round', top:'ears',  back:'spike', pat:'',       eye:'big',    mouth:'fang', cheek:0 },
  { name:'コアラン',    c1:'#b9c3cc', c2:'#7c8894', body:'blob',  top:'ears',  back:'',      pat:'belly',  eye:'dot',    mouth:'smile',cheek:1 },
  { name:'チョウリン',  c1:'#ffa0d0', c2:'#e05aa8', body:'tall',  top:'ant',   back:'wings', pat:'star',   eye:'happy',  mouth:'smile',cheek:1 },
  { name:'クジラード',  c1:'#8fb8f5', c2:'#4571c9', body:'bean',  top:'fin',   back:'tail',  pat:'belly',  eye:'sleepy', mouth:'smile',cheek:0 },
  { name:'ハリン',      c1:'#d7a86e', c2:'#8a5f2e', body:'egg',   top:'',      back:'spike', pat:'spots',  eye:'dot',    mouth:'w',    cheek:1 },
  { name:'ウルフィ',    c1:'#9aa7b5', c2:'#5a6673', body:'bean',  top:'horn',  back:'tail',  pat:'belly',  eye:'wink',   mouth:'fang', cheek:0 },
  { name:'フラミー',    c1:'#ff9fc0', c2:'#e0608f', body:'tall',  top:'tuft',  back:'wings', pat:'',       eye:'happy',  mouth:'beak', cheek:1 },
  { name:'ピョンタ',    c1:'#fff0f3', c2:'#ffb3c6', body:'egg',   top:'long',  back:'',      pat:'belly',  eye:'big',    mouth:'w',    cheek:1 },
  { name:'オウムン',    c1:'#7ee0b0', c2:'#2fae7c', body:'drop',  top:'tuft',  back:'wings', pat:'stripe', eye:'dot',    mouth:'beak', cheek:1 },
  { name:'ピヨマル',    c1:'#ffe27a', c2:'#f2b705', body:'round', top:'tuft',  back:'',      pat:'',       eye:'dot',    mouth:'beak', cheek:1 },
  { name:'キラリン',    c1:'#ffd24d', c2:'#ff8f3d', body:'blob',  top:'crown', back:'wings', pat:'star',   eye:'big',    mouth:'smile',cheek:1 }
];

/* モンスター1ぴきを SVG の 文字列にする */
function monsterSVG(m, cls){
  return `<svg class="mon ${cls || ''}" viewBox="0 0 100 100" role="img" aria-label="${m.name}">`
    + mBack(m.back, m.c2)
    + mFeet(m.c2)
    + mTop(m.top, m.c2)
    + mBody(m.body, m.c1)
    + mPat(m.pat, m.c2)
    + mEye(m.eye)
    + mMouth(m.mouth)
    + mCheek(m.cheek)
    + `</svg>`;
}

/* たまご（クリアの えんしゅつ用） */
function eggSVG(cls){
  return `<svg class="mon ${cls || ''}" viewBox="0 0 100 100" role="img" aria-label="たまご">
    <ellipse cx="50" cy="58" rx="32" ry="38" fill="#fffaf0" stroke="#e6dcc8" stroke-width="3"/>
    <circle cx="36" cy="46" r="7" fill="#ffd9e0"/><circle cx="62" cy="38" r="5" fill="#cfe9ff"/>
    <circle cx="66" cy="62" r="8" fill="#d9f2d2"/><circle cx="40" cy="72" r="6" fill="#ffe8b0"/>
  </svg>`;
}

/* はなまる（せいかいの しるし） */
function hanamaruSVG(){
  const pts = [], n = 7, R = 45, r = 33, cx = 50, cy = 50;
  for(let i = 0; i < n; i++){
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    pts.push({
      c:[cx + Math.cos(a1) * R * 1.32, cy + Math.sin(a1) * R * 1.32],
      p:[cx + Math.cos(a2) * r, cy + Math.sin(a2) * r],
      s:[cx + Math.cos(a0) * r, cy + Math.sin(a0) * r]
    });
  }
  let d = `M${pts[0].s[0].toFixed(1)} ${pts[0].s[1].toFixed(1)}`;
  pts.forEach(p => { d += `Q${p.c[0].toFixed(1)} ${p.c[1].toFixed(1)} ${p.p[0].toFixed(1)} ${p.p[1].toFixed(1)}`; });
  d += 'Z';
  return `<svg class="hanamaru-svg" viewBox="-4 -4 108 108">
    <path class="hm-flower" d="${d}" fill="none" stroke="#e8443a" stroke-width="6" stroke-linecap="round" pathLength="100"/>
    <circle class="hm-core" cx="50" cy="50" r="19" fill="none" stroke="#e8443a" stroke-width="6" pathLength="100"/>
  </svg>`;
}
