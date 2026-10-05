export interface FareBand { readonly maxKm: number; readonly yen: number }

export interface FareRule {
  readonly id: string;
  readonly label: string;
  /** 営業キロの帯ごとの運賃。 */
  readonly bands: readonly FareBand[];
  /**
   * 地方交通線の擬制キロ係数。
   * 同じ距離でも幹線より運賃が高くなるぶんを、距離を割り増して表現する。
   */
  readonly localSurchargeRate?: number;
  /** 均一運賃の路線（路面電車）。1回乗るごとにこの額。 */
  readonly perRideYen?: number;
  /** 折り返しでキロが伸びすぎたときの頭打ち。 */
  readonly maxKm?: number;
}

/**
 * 運賃表。
 *
 * **実際の運賃に近づけてはいるが、完全に一致することは保証しない。**
 * 運賃は改定されるうえ、特定区間運賃・幹線と地方交通線をまたぐ計算など
 * 細かい規則があるため、ここでは「営業キロの帯 × 事業者ごとの水準」で近似している。
 * 正確な額は各事業者の案内で確認してほしい。
 */

/** JR本州 幹線。山陽本線・伯備線・赤穂線・宇野線・本四備讃線など。 */
const JR_MAIN: FareRule = {
  id: 'jr-main',
  label: 'JR西日本 幹線',
  maxKm: 400,
  bands: [
    { maxKm: 3, yen: 150 }, { maxKm: 6, yen: 190 }, { maxKm: 10, yen: 200 },
    { maxKm: 15, yen: 240 }, { maxKm: 20, yen: 330 }, { maxKm: 25, yen: 420 },
    { maxKm: 30, yen: 510 }, { maxKm: 35, yen: 590 }, { maxKm: 40, yen: 680 },
    { maxKm: 45, yen: 770 }, { maxKm: 50, yen: 860 }, { maxKm: 60, yen: 990 },
    { maxKm: 70, yen: 1170 }, { maxKm: 80, yen: 1340 }, { maxKm: 90, yen: 1520 },
    { maxKm: 100, yen: 1690 }, { maxKm: 120, yen: 1980 }, { maxKm: 140, yen: 2310 },
    { maxKm: 160, yen: 2640 }, { maxKm: 180, yen: 2970 }, { maxKm: 200, yen: 3300 },
    { maxKm: 220, yen: 3740 }, { maxKm: 240, yen: 4070 }, { maxKm: 260, yen: 4510 },
    { maxKm: 280, yen: 4840 }, { maxKm: 300, yen: 5170 },
  ],
};

/**
 * JR本州 地方交通線。吉備線・津山線・姫新線・因美線・芸備線。
 * 同じ距離でも幹線より高いので、距離を1割増しで引く（擬制キロの考え方）。
 */
const JR_LOCAL: FareRule = {
  ...JR_MAIN,
  id: 'jr-local',
  label: 'JR西日本 地方交通線',
  localSurchargeRate: 1.1,
};

/** 岡山電気軌道。均一運賃。1回乗るごとに同じ額。 */
const OKADEN_FLAT: FareRule = {
  id: 'okaden-flat',
  label: '岡山電気軌道',
  perRideYen: 140,
  bands: [{ maxKm: Infinity, yen: 140 }],
};

/** 水島臨海鉄道。 */
const MIZURIN_FARE: FareRule = {
  id: 'mizurin',
  label: '水島臨海鉄道',
  maxKm: 60,
  bands: [
    { maxKm: 1.5, yen: 200 }, { maxKm: 3, yen: 240 }, { maxKm: 5, yen: 290 },
    { maxKm: 7, yen: 340 }, { maxKm: 9, yen: 390 }, { maxKm: 11, yen: 420 },
  ],
};

/** 井原鉄道。 */
const IBARA_FARE: FareRule = {
  id: 'ibara-fare',
  label: '井原鉄道',
  maxKm: 120,
  bands: [
    { maxKm: 3, yen: 220 }, { maxKm: 6, yen: 300 }, { maxKm: 9, yen: 390 },
    { maxKm: 12, yen: 480 }, { maxKm: 16, yen: 580 }, { maxKm: 20, yen: 680 },
    { maxKm: 24, yen: 780 }, { maxKm: 28, yen: 870 }, { maxKm: 32, yen: 960 },
    { maxKm: 36, yen: 1050 }, { maxKm: 42, yen: 1150 },
  ],
};

/** 智頭急行。 */
const CHIZU_FARE: FareRule = {
  id: 'chizu-fare',
  label: '智頭急行',
  maxKm: 140,
  bands: [
    { maxKm: 3, yen: 200 }, { maxKm: 6, yen: 280 }, { maxKm: 10, yen: 380 },
    { maxKm: 15, yen: 500 }, { maxKm: 20, yen: 620 }, { maxKm: 25, yen: 740 },
    { maxKm: 30, yen: 860 }, { maxKm: 35, yen: 980 }, { maxKm: 40, yen: 1100 },
    { maxKm: 48, yen: 1250 }, { maxKm: 57, yen: 1400 },
  ],
};

/** 新幹線の自由席特急料金（運賃に上乗せする）。 */
export const SHINKANSEN_SURCHARGE: readonly FareBand[] = [
  { maxKm: 50, yen: 880 }, { maxKm: 100, yen: 1760 }, { maxKm: 150, yen: 2530 },
  { maxKm: 200, yen: 2730 }, { maxKm: 300, yen: 3040 }, { maxKm: 400, yen: 3600 },
];

export const FARE_RULES: ReadonlyMap<string, FareRule> = new Map(
  [JR_MAIN, JR_LOCAL, OKADEN_FLAT, MIZURIN_FARE, IBARA_FARE, CHIZU_FARE].map((r) => [r.id, r]),
);

export function getFareRule(id: string): FareRule {
  const r = FARE_RULES.get(id);
  if (r === undefined) throw new Error(`unknown fare rule: ${id}`);
  return r;
}
