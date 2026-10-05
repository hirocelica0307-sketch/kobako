import { getFareRule, SHINKANSEN_SURCHARGE, type FareBand, type FareRule } from '../../data/fareTable';

function lookup(bands: readonly FareBand[], km: number): number {
  for (const band of bands) {
    if (km <= band.maxKm) return band.yen;
  }
  const last = bands[bands.length - 1]!;
  return last.yen + Math.ceil((km - last.maxKm) / 10) * 200;
}

/**
 * 発駅からの累計営業キロに対する通し運賃。
 * 実際のきっぷと同じく、区間ごとの足し算ではなく通しで計算する。
 */
export function calcFare(rule: FareRule, km: number, stops = 0): number {
  if (km <= 0 && rule.perRideYen === undefined) return 0;
  // 均一運賃の路線は距離ではなく乗った回数で決まる
  if (rule.perRideYen !== undefined) return rule.perRideYen * Math.max(0, stops);
  const capped = rule.maxKm === undefined ? km : Math.min(km, rule.maxKm);
  return lookup(rule.bands, capped * (rule.localSurchargeRate ?? 1));
}

/** 新幹線の自由席特急料金。運賃に上乗せする。 */
export function calcSurcharge(surchargeRule: string | undefined, km: number): number {
  if (surchargeRule !== 'shinkansen' || km <= 0) return 0;
  return lookup(SHINKANSEN_SURCHARGE, km);
}

export function calcFareById(ruleId: string, km: number, stops = 0): number {
  return calcFare(getFareRule(ruleId), km, stops);
}
