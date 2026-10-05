import type { LineId } from './types';

/**
 * 路線選択の地図。
 *
 * 実際の地形をなぞるのではなく、**JR の路線図のような模式図**にしてある。
 * 320×180 のドットでは実際のルートを描くと線が重なって選べなくなるため、
 * 岡山駅を中心に放射状へ伸ばし、角度と本数を優先して読み取りやすくしている。
 *
 * 座標は 320×180 の論理ピクセル。
 */
export interface MapPoint { x: number; y: number }

export interface MapLine {
  id: LineId;
  /** 折れ線の通過点。始点が起点、終点が行先。 */
  path: readonly MapPoint[];
  /** 路線名を置く位置。 */
  label: MapPoint;
  /** ラベルを線のどちら側に出すか。 */
  align: 'left' | 'right' | 'center';
}

/** 岡山駅。ほとんどの路線がここから伸びる。 */
export const OKAYAMA: MapPoint = { x: 168, y: 118 };

/**
 * 県の輪郭（模式）。
 * 北は中国山地のゆるい県境、南は瀬戸内海の海岸線。
 * 南に張り出しているのが児島半島で、その東の入り込みが児島湾。
 * 正確な地形ではなく「岡山らしく見える」ことを優先している。
 */
export const PREF_OUTLINE: readonly MapPoint[] = [
  // 北（鳥取との県境）
  { x: 44, y: 36 }, { x: 78, y: 28 }, { x: 116, y: 23 }, { x: 158, y: 21 },
  { x: 198, y: 24 }, { x: 238, y: 29 }, { x: 274, y: 38 },
  // 東（兵庫との県境）
  { x: 284, y: 62 }, { x: 281, y: 90 }, { x: 270, y: 112 },
  // 南（瀬戸内海の海岸線）
  { x: 248, y: 124 }, { x: 222, y: 127 },
  // 児島湾の入り込み
  { x: 200, y: 133 }, { x: 186, y: 128 },
  // 児島半島
  { x: 178, y: 142 }, { x: 166, y: 152 }, { x: 150, y: 153 }, { x: 138, y: 144 },
  { x: 133, y: 131 },
  // 西へ戻る海岸
  { x: 112, y: 130 }, { x: 86, y: 127 }, { x: 62, y: 120 },
  // 西（広島との県境）
  { x: 42, y: 104 }, { x: 33, y: 74 }, { x: 35, y: 52 },
];

/** 瀬戸内海の島影（飾り）。 */
export const ISLANDS: readonly MapPoint[] = [
  { x: 108, y: 146 }, { x: 206, y: 150 }, { x: 240, y: 142 }, { x: 78, y: 138 },
  { x: 268, y: 158 },
];

export const MAP_LINES: readonly MapLine[] = [
  // --- 岡山から西へ ---
  { id: 'sanyo-main-down',
    path: [{ x: 262, y: 104 }, { x: 226, y: 112 }, { x: 168, y: 118 }, { x: 118, y: 120 }, { x: 62, y: 122 }],
    label: { x: 62, y: 128 }, align: 'left' },
  { id: 'hakubi',
    path: [{ x: 168, y: 118 }, { x: 120, y: 118 }, { x: 108, y: 96 }, { x: 96, y: 62 }, { x: 88, y: 40 }],
    label: { x: 88, y: 34 }, align: 'center' },
  { id: 'ibara',
    path: [{ x: 108, y: 96 }, { x: 80, y: 100 }, { x: 52, y: 112 }, { x: 38, y: 126 }],
    label: { x: 34, y: 134 }, align: 'left' },
  { id: 'geibi',
    path: [{ x: 88, y: 40 }, { x: 62, y: 44 }, { x: 40, y: 52 }],
    label: { x: 34, y: 46 }, align: 'left' },
  { id: 'kishin',
    path: [{ x: 88, y: 40 }, { x: 130, y: 44 }, { x: 176, y: 48 }, { x: 222, y: 44 }, { x: 258, y: 40 }],
    label: { x: 258, y: 34 }, align: 'right' },
  // --- 岡山から北へ ---
  { id: 'tsuyama',
    path: [{ x: 168, y: 118 }, { x: 172, y: 92 }, { x: 176, y: 68 }, { x: 176, y: 48 }],
    label: { x: 182, y: 60 }, align: 'right' },
  { id: 'inbi',
    path: [{ x: 176, y: 48 }, { x: 196, y: 40 }, { x: 208, y: 28 }],
    label: { x: 212, y: 26 }, align: 'right' },
  { id: 'chizu',
    path: [{ x: 258, y: 40 }, { x: 250, y: 30 }, { x: 240, y: 22 }],
    label: { x: 244, y: 18 }, align: 'right' },
  // --- 岡山から南・西へ ---
  { id: 'kibi',
    path: [{ x: 168, y: 118 }, { x: 146, y: 108 }, { x: 122, y: 102 }, { x: 108, y: 96 }],
    label: { x: 128, y: 94 }, align: 'center' },
  { id: 'uno',
    path: [{ x: 168, y: 118 }, { x: 166, y: 128 }, { x: 172, y: 138 }, { x: 176, y: 146 }],
    label: { x: 182, y: 146 }, align: 'right' },
  { id: 'seto-ohashi',
    path: [{ x: 168, y: 118 }, { x: 158, y: 128 }, { x: 148, y: 142 }, { x: 145, y: 156 }, { x: 143, y: 166 }],
    label: { x: 137, y: 160 }, align: 'left' },
  { id: 'mizurin',
    path: [{ x: 118, y: 120 }, { x: 114, y: 128 }, { x: 110, y: 137 }],
    label: { x: 104, y: 143 }, align: 'left' },
  // --- 岡山から東へ ---
  { id: 'ako',
    path: [{ x: 194, y: 116 }, { x: 222, y: 126 }, { x: 250, y: 124 }, { x: 274, y: 116 }],
    label: { x: 278, y: 124 }, align: 'right' },
  { id: 'okaden',
    path: [{ x: 168, y: 118 }, { x: 182, y: 112 }, { x: 194, y: 108 }],
    label: { x: 198, y: 102 }, align: 'right' },
  { id: 'shinkansen',
    path: [{ x: 56, y: 108 }, { x: 110, y: 106 }, { x: 168, y: 110 }, { x: 226, y: 98 }, { x: 280, y: 88 }],
    label: { x: 284, y: 82 }, align: 'right' },
];

export const MAP_LINE_MAP: ReadonlyMap<LineId, MapLine> = new Map(
  MAP_LINES.map((l) => [l.id, l]),
);
