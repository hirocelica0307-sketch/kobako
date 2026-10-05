import { useMemo } from 'react';
import { ISLANDS, MAP_LINES, MAP_LINE_MAP, OKAYAMA, PREF_OUTLINE } from '../../data/mapLayout';

/**
 * 路線選択の岡山県地図。**SVG** で描く。
 *
 * もとは 320×180 の Canvas に描いて拡大していたので、県境も路線も
 * ギザギザで、どの線が選ばれているのか分かりにくかった。
 * SVG なら画面をどれだけ拡大しても線が滑らかなまま出る。
 *
 * 座標は Canvas 時代と同じ mapLayout.ts の値をそのまま使う。
 * 地形をなぞった地図ではなく、岡山駅から放射状に伸ばした**路線図風の模式図**。
 */

interface Props {
  selectedId: string;
  /** 路線カラー。選択中の線と車両に使う。 */
  color: string;
}

const pts = (path: readonly { x: number; y: number }[]) =>
  path.map((p) => `${p.x},${p.y}`).join(' ');

const dOf = (path: readonly { x: number; y: number }[]) =>
  path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

/** 折れ線の長さ。走らせる速さを長さに合わせるために使う。 */
function pathLength(path: readonly { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) {
    n += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  return n;
}

export function OkayamaMap({ selectedId, color }: Props) {
  const selected = MAP_LINE_MAP.get(selectedId);
  const others = useMemo(() => MAP_LINES.filter((l) => l.id !== selectedId), [selectedId]);

  // 短い路線をゆっくり、長い路線を速く走らせると不自然なので、
  // 「長さに比例した時間」にして見かけの速度をそろえる。
  const dur = selected === undefined ? 8 : Math.max(5, pathLength(selected.path) / 22);

  return (
    <svg className="okmap" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="okmap-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b6d94" />
          <stop offset="100%" stopColor="#164363" />
        </linearGradient>
        {/*
          陸地は**くすんだ緑**にする。明るい緑にすると、その上に引く路線の
          白い縁取りも路線カラーも沈んでしまい、どれを選んでいるか分からない。
        */}
        <linearGradient id="okmap-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#41543b" />
          <stop offset="100%" stopColor="#54684a" />
        </linearGradient>
        {/* 陸地を少し浮かせる。海との境がはっきりして県の形が読み取れる。 */}
        <filter id="okmap-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor="#07131c" floodOpacity="0.55" />
        </filter>
        <clipPath id="okmap-clip">
          <polygon points={pts(PREF_OUTLINE)} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="320" height="180" fill="url(#okmap-sea)" />

      {/* 瀬戸内海の波。ゆっくり右へ流す。 */}
      <g className="okmap-waves" opacity="0.22">
        {[132, 146, 160, 172].map((y, i) => (
          <path
            key={y}
            d={`M-40 ${y} q 10 -3 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0`}
            fill="none"
            stroke="#cfe9ff"
            strokeWidth="0.8"
            style={{ animationDelay: `${i * -1.7}s`, animationDuration: `${7 + i * 2}s` }}
          />
        ))}
      </g>

      {/*
        地図は左 62% に収める。右側は路線の一覧（DOM）の場所。
        Canvas 版と同じ収め方にして、座標データをそのまま使えるようにしている。
      */}
      <g transform="translate(3.7 34.2) scale(0.62)">

      {/* 島影 */}
      {ISLANDS.map((is) => (
        <ellipse key={`${is.x}-${is.y}`} cx={is.x} cy={is.y} rx="9" ry="4" fill="#3f5a3c" opacity="0.85" />
      ))}

      {/* 岡山県 */}
      <polygon
        points={pts(PREF_OUTLINE)}
        fill="url(#okmap-land)"
        stroke="#d6e8c4"
        strokeWidth="0.9"
        strokeLinejoin="round"
        filter="url(#okmap-shadow)"
      />

      {/* 内陸の山あい。のっぺりした緑の塊に見せない。 */}
      <g clipPath="url(#okmap-clip)" fill="#33432e" opacity="0.5">
        {Array.from({ length: 26 }, (_, i) => (
          <ellipse key={i} cx={30 + (i * 53) % 260} cy={24 + (i * 29) % 46} rx="16" ry="6" />
        ))}
      </g>

      {/*
        選んでいない路線。暗い線で引く。
        白い細線だと明るい陸地に溶けて、そこに線があることすら分からなかった。
      */}
      <g fill="none" stroke="#11200f" strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {others.map((l) => <path key={l.id} d={dOf(l.path)} />)}
      </g>

      {/*
        選択中の路線。白い縁取り → 路線カラー（実線）→ 流れる白い破線 の3枚重ね。
        路線カラーそのものを破線にすると線が途切れて見え、
        どこからどこまでの路線なのか読み取れなかった。
      */}
      {selected !== undefined && (
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={dOf(selected.path)} stroke="#ffffff" strokeWidth="5.6" />
          <path d={dOf(selected.path)} stroke={color} strokeWidth="3.4" />
          <path className="okmap-live" d={dOf(selected.path)} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.2" />
          {selected.path.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.4" fill="#ffffff" stroke="#16242e" strokeWidth="0.9" />
          ))}
        </g>
      )}

      {/* 岡山駅。ほとんどの路線がここから伸びるので、地図の目印にする。 */}
      <g>
        <circle className="okmap-pulse" cx={OKAYAMA.x} cy={OKAYAMA.y} r="5" fill="none" stroke="#ffffff" strokeWidth="1.2" />
        <circle cx={OKAYAMA.x} cy={OKAYAMA.y} r="3.2" fill="#f2c230" stroke="#4a3a00" strokeWidth="0.9" />
        {/* Canvas と違って SVG なら日本語もそのまま出せる */}
        <text
          className="okmap-label"
          x={OKAYAMA.x}
          y={OKAYAMA.y + 11}
          textAnchor="middle"
        >
          おかやま
        </text>
      </g>

      {/* 選んだ路線の上を走る電車。ドット絵ではなくベクタなので拡大しても滑らか。 */}
      {selected !== undefined && (
        <g>
          <animateMotion
            dur={`${dur}s`}
            repeatCount="indefinite"
            keyPoints="0;1;0"
            keyTimes="0;0.5;1"
            calcMode="linear"
            rotate="auto"
            path={dOf(selected.path)}
          />
          <g transform="translate(-10,-5.6)">
            <rect x="0" y="0" width="20" height="9" rx="3.4" fill={color} stroke="#ffffff" strokeWidth="1.1" />
            <rect x="2" y="1.9" width="6.6" height="3.4" rx="1.2" fill="#e7f5ff" opacity="0.95" />
            <rect x="10" y="1.9" width="6.6" height="3.4" rx="1.2" fill="#e7f5ff" opacity="0.95" />
            <circle cx="18" cy="4.4" r="1.2" fill="#fff6c8" />
            <rect x="3" y="8.6" width="3.4" height="1.7" rx="0.8" fill="#1b232c" />
            <rect x="13.6" y="8.6" width="3.4" height="1.7" rx="0.8" fill="#1b232c" />
          </g>
        </g>
      )}

      </g>
    </svg>
  );
}
