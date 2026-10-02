'use strict';
/* =========================================================
   うごく 子どもの え（かおは てんせんの まる ＝ 子どもが かく）
   ローカル座標：こし（hip）が (0,0)、みぎむき。せの たかさ およそ 92。
   角度：0 ＝ まっすぐ 下、＋ ＝ まえ（みぎ）、180 ＝ 上
   ========================================================= */
const dv = (a, len) => [len * Math.sin(a * Math.PI / 180), len * Math.cos(a * Math.PI / 180)];
const addv = (p, v) => [p[0] + v[0], p[1] + v[1]];

// ふちどり つきの ふとい 線（うで・あし）
function limb(pts, w) {
  const d = 'M' + pts.map(p => n(p[0]) + ',' + n(p[1])).join(' L');
  return `<path d="${d}" fill="none" stroke="#000" stroke-width="${n(w + 1.3 / SC)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ふちどり なしの 白い 線（つなぎめを かくす）
function limbIn(pts, w) {
  const d = 'M' + pts.map(p => n(p[0]) + ',' + n(p[1])).join(' L');
  return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${n(w)}" stroke-linecap="round"/>`;
}

const POSES = {
  stand: { lean: 0, aF: [12, 8], aB: [-12, 8], lF: [6, 0], lB: [-6, 0] },
  wave: { lean: 0, aF: [140, 35], aB: [-14, 10], lF: [6, 0], lB: [-6, 0] },
  run: { lean: 18, aF: [70, 80], aB: [-55, 90], lF: [65, 75], lB: [-20, 90] },
  climb: { lean: 14, aF: [60, 70], aB: [-45, 80], lF: [95, 95], lB: [-10, 30] },
  cheer: { lean: -4, aF: [158, 8], aB: [-158, -8], lF: [10, 0], lB: [-10, 0] },
  jumpCheer: { lean: -4, aF: [160, 6], aB: [-160, -6], lF: [30, 60], lB: [-5, 55] },
  sprint: { lean: 6, aF: [155, 10], aB: [-150, -10], lF: [65, 75], lB: [-20, 90] },
  recorder: { lean: 0, aF: [35, 105], aB: [28, 115], lF: [6, 0], lB: [-6, 0] },
  keyboard: { lean: 6, aF: [72, 22], aB: [62, 30], lF: [6, 0], lB: [-6, 0] },
  drum: { lean: 4, aF: [70, 60], aB: [52, 75], lF: [10, 0], lB: [-8, 0] },
  sing: { lean: -3, aF: [30, 118], aB: [-75, -25], lF: [8, 0], lB: [-8, 0] },
  read: { lean: 4, aF: [40, 80], aB: [34, 88], lF: [6, 0], lB: [-6, 0] },
  jump: { lean: 0, aF: [42, -18], aB: [-42, 18], lF: [35, 65], lB: [15, 60] },
  point: { lean: 6, aF: [96, -2], aB: [-28, 50], lF: [24, 0], lB: [-22, 0] },
  think: { lean: 0, aF: [40, 128], aB: [-28, -60], lF: [6, 0], lB: [-6, 0] },
  flag: { lean: -2, aF: [172, 0], aB: [-30, 25], lF: [14, 0], lB: [-12, 0] },
  water: { lean: 8, aF: [62, 25], aB: [-12, 10], lF: [10, 0], lB: [-10, 0] },
  walk: { lean: 4, aF: [32, 22], aB: [-32, 22], lF: [24, 15], lB: [-20, 28] },
  throw: { lean: -6, aF: [165, 25], aB: [-40, 30], lF: [20, 0], lB: [-18, 0] },
  pull: { lean: -22, aF: [100, 0], aB: [92, 6], lF: [35, 0], lB: [-25, 0] },
};

// 子ども 1にん。o: { pose, flip, headband, bag, cap }
function kid(x, y, s, o = {}) {
  const p = typeof o.pose === 'object' ? o.pose : POSES[o.pose || 'stand'];
  const old = SC; SC = old * s;
  try {
    const hip = [0, 0];
    const dn = dv(-p.lean, 1), up = dv(180 - p.lean, 1);                   // からだの 下むき・上むき
    const ux = Math.cos(p.lean * Math.PI / 180), uy = Math.sin(p.lean * Math.PI / 180); // からだの よこむき（まえが ＋）
    const at = (base, a, b) => [base[0] + a * ux + b * dn[0], base[1] + a * uy + b * dn[1]];
    const sh = addv(hip, dv(180 - p.lean, 28));          // かた（まんなか）
    const neckTop = addv(sh, dv(180 - p.lean, 4));
    const head = addv(neckTop, dv(180 - p.lean, 12));
    const rootF = at(sh, 6.5, 3.5), rootB = at(sh, -6.5, 3.5);
    const arm = (a, r) => { const e = addv(r, dv(a[0], 14)); return [r, e, addv(e, dv(a[0] + a[1], 13))]; };
    const hipF = at(hip, 4.5, 0), hipB = at(hip, -4.5, 0);
    const leg = (l, r) => { const k = addv(r, dv(l[0], 18)); return [r, k, addv(k, dv(l[0] - l[1], 18))]; };
    const AF = arm(p.aF, rootF), AB = arm(p.aB, rootB), LF = leg(p.lF, hipF), LB = leg(p.lB, hipB);
    const shoe = (L) => { const f = L[2]; return P(`M${n(f[0] - 3.5)},${n(f[1] + 2.6)} Q${n(f[0] - 4)},${n(f[1] - 2.6)} ${n(f[0] + 1)},${n(f[1] - 2.2)} Q${n(f[0] + 7.5)},${n(f[1] - 0.6)} ${n(f[0] + 7.5)},${n(f[1] + 2.6)} Z`, { w: 0.6 }); };
    let d = '';
    if (o.bag) d += RR(sh[0] - 17, sh[1] + 2, 10, 18, 3, { w: 0.7 });
    // うしろの うで・あし
    d += limb(AB, 5.4) + C(AB[2][0], AB[2][1], 3, { w: 0.6 });
    d += limb(LB, 6.6) + shoe(LB);
    d += limb(LF, 6.6) + shoe(LF);
    // ズボン（こし ＋ ふともも）
    const kB = addv(hipB, dv(p.lB[0], 10)), kF = addv(hipF, dv(p.lF[0], 10));
    d += limb([hipB, kB], 9.6) + limb([hipF, kF], 9.6);
    const w1 = at(hip, -10, -2), w2 = at(hip, 10, -2), w3 = at(hip, 9.5, 4), w4 = at(hip, -9.5, 4);
    d += P(`M${n(w1[0])},${n(w1[1])} L${n(w2[0])},${n(w2[1])} L${n(w3[0])},${n(w3[1])} L${n(w4[0])},${n(w4[1])} Z`, { w: 0.7 });
    d += limbIn([hipB, addv(hipB, dv(p.lB[0], 9))], 8.4) + limbIn([hipF, addv(hipF, dv(p.lF[0], 9))], 8.4);
    // シャツ
    const nL = at(sh, -4.5, -0.5), nR = at(sh, 4.5, -0.5), cL = at(sh, -10.5, 0), cR = at(sh, 10.5, 0);
    const sL = at(sh, -10.5, 5), sR = at(sh, 10.5, 5), hL = at(hip, -11, 1.5), hR = at(hip, 11, 1.5), hM = at(hip, 0, 2.6);
    d += P(`M${n(nL[0])},${n(nL[1])} Q${n(cL[0])},${n(cL[1])} ${n(sL[0])},${n(sL[1])} L${n(hL[0])},${n(hL[1])} Q${n(hM[0])},${n(hM[1])} ${n(hR[0])},${n(hR[1])} L${n(sR[0])},${n(sR[1])} Q${n(cR[0])},${n(cR[1])} ${n(nR[0])},${n(nR[1])} Z`, { w: 0.8 });
    const v1 = at(sh, -3.5, -0.4), v2 = at(sh, 0, 4.5), v3 = at(sh, 3.5, -0.4);
    d += P(`M${n(v1[0])},${n(v1[1])} L${n(v2[0])},${n(v2[1])} L${n(v3[0])},${n(v3[1])}`, { fill: 'none', w: 0.55 });
    // くび・あたま
    d += limb([at(sh, 0, 1), neckTop], 5.2);
    d += C(head[0], head[1], 12, { w: 0, fill: '#fff' }) + C(head[0], head[1], 12, { fill: 'none', w: 0.75, dash: '2 1.6' });
    if (o.headband) {
      d += P(`M${n(head[0] - 12)},${n(head[1] - 3)} Q${n(head[0])},${n(head[1] - 6)} ${n(head[0] + 12)},${n(head[1] - 3)} L${n(head[0] + 12)},${n(head[1] + 1)} Q${n(head[0])},${n(head[1] - 2)} ${n(head[0] - 12)},${n(head[1] + 1)} Z`, { w: 0.6 });
      d += P(`M${n(head[0] - 11)},${n(head[1] - 1)} l-9,-4 l1,5 Z M${n(head[0] - 11)},${n(head[1])} l-8,5 l3,2 Z`, { w: 0.5 });
    }
    if (o.cap) d += P(`M${n(head[0] - 12)},${n(head[1] - 2)} A12,12 0 0 1 ${n(head[0] + 12)},${n(head[1] - 2)} L${n(head[0] + 19)},${n(head[1] - 1)} L${n(head[0] + 19)},${n(head[1] + 1)} L${n(head[0] - 12)},${n(head[1] + 1)} Z`, { w: 0.6 });
    // そで と まえの うで
    d += limb([rootB, addv(rootB, dv(p.aB[0], 5))], 8.6);
    d += limb(AF, 5.4) + C(AF[2][0], AF[2][1], 3, { w: 0.6 });
    d += limb([rootF, addv(rootF, dv(p.aF[0], 5))], 8.6);
    d += limb(AF.slice(1), 5.4) + C(AF[2][0], AF[2][1], 3, { w: 0.6 });
    const J = { hip, sh, head, handF: AF[2], handB: AB[2], footF: LF[2], footB: LB[2], elbowF: AF[1] };
    const tf = `translate(${n(x)} ${n(y)}) scale(${o.flip ? -s : s} ${s})`;
    const extra = o.prop ? o.prop(J) : '';
    return { d: `<g transform="${tf}">${d}${extra}</g>`, J: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [x + (o.flip ? -1 : 1) * v[0] * s, y + v[1] * s]])) };
  } finally { SC = old; }
}
const kidD = (x, y, s, o) => kid(x, y, s, o).d;

/* ---------- もちもの（J は ローカル座標） ---------- */
const PROPS = {
  recorder: J => P(`M${n(J.head[0] + 6)},${n(J.head[1] + 9)} L${n(J.handF[0] + 9)},${n(J.handF[1] + 14)}`, { fill: 'none', w: 3.4 }) + P(`M${n(J.head[0] + 6)},${n(J.head[1] + 9)} L${n(J.handF[0] + 9)},${n(J.handF[1] + 14)}`, { fill: 'none', w: 2.2, stroke: '#fff' }) +
    E(J.handF[0] + 9.5, J.handF[1] + 15, 3, 2.2, { w: 0.5 }),
  keyboard: J => RR(J.handF[0] - 8, J.handF[1] + 1, 34, 8, 1.2, { w: 0.8 }) + [0, 1, 2, 3, 4, 5].map(i => L(J.handF[0] - 4 + i * 5, J.handF[1] + 2, J.handF[0] - 4 + i * 5, J.handF[1] + 8, 0.35)).join('') +
    L(J.handF[0], J.handF[1] + 9, J.handF[0] - 4, J.handF[1] + 34, 1) + L(J.handF[0] + 20, J.handF[1] + 9, J.handF[0] + 24, J.handF[1] + 34, 1),
  drum: J => P(`M${n(J.hip[0] + 14)},${n(J.hip[1] - 2)} v14 q12,5 24,0 v-14`, { w: 0.8 }) + E(J.hip[0] + 26, J.hip[1] - 2, 12, 3.6, { w: 0.8 }) +
    L(J.handF[0], J.handF[1], J.handF[0] + 9, J.handF[1] + 9, 1.2) + L(J.handB[0], J.handB[1], J.handB[0] + 11, J.handB[1] + 6, 1.2),
  mic: J => L(J.handF[0], J.handF[1], J.handF[0] + 3, J.handF[1] + 7, 1.6) + C(J.handF[0] - 0.6, J.handF[1] - 2.4, 2.8, { w: 0.6 }),
  book: J => P(`M${n(J.handF[0] - 2)},${n(J.handF[1] - 8)} l12,-3 v16 l-12,3 Z M${n(J.handF[0] - 2)},${n(J.handF[1] - 8)} l-10,-3 v16 l10,3 Z`, { w: 0.7 }),
  flag: J => L(J.handF[0], J.handF[1] + 8, J.handF[0], J.handF[1] - 26, 1) + P(`M${n(J.handF[0])},${n(J.handF[1] - 26)} l18,4 l-18,6 Z`, { w: 0.7 }),
  can: J => RR(J.handF[0], J.handF[1] - 4, 12, 10, 2, { w: 0.7 }) + P(`M${n(J.handF[0] + 12)},${n(J.handF[1])} l10,-6`, { fill: 'none', w: 1.4 }) +
    P(`M${n(J.handF[0] + 24)},${n(J.handF[1] - 4)} l3,8 M${n(J.handF[0] + 22)},${n(J.handF[1] - 3)} l1,9`, { fill: 'none', w: 0.5, dash: '1 1.2' }),
  ball: J => C(J.handF[0] + 2, J.handF[1] - 4, 4, { w: 0.7 }),
  rope: J => P(`M${n(J.handF[0])},${n(J.handF[1])} C${n(J.handF[0] + 26)},${n(J.handF[1] - 90)} ${n(J.handB[0] - 26)},${n(J.handB[1] - 90)} ${n(J.handB[0])},${n(J.handB[1])}`, { fill: 'none', w: 1.3 }),
  ropeLow: J => P(`M${n(J.handF[0])},${n(J.handF[1])} C${n(J.handF[0] + 14)},${n(J.handF[1] + 34)} ${n(J.handB[0] - 14)},${n(J.handB[1] + 34)} ${n(J.handB[0])},${n(J.handB[1])}`, { fill: 'none', w: 1.3 }),
  pencil: J => P(`M${n(J.handF[0] - 2)},${n(J.handF[1] + 2)} l4,-14 l3,1 l-4,14 Z`, { w: 0.5 }),
};
