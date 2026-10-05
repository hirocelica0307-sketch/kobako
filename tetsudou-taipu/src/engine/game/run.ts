import type { Line } from '../../data/types';
import { getStation } from '../../data/stations';
import { createTypingState } from '../typing/matcher';
import type { TypingState } from '../typing/types';
import { emptyStats, type RunStats } from '../typing/stats';
import { calcFare, calcSurcharge } from './fare';
import { getFareRule } from '../../data/fareTable';
import { boardingAt } from './passengers';
import { COMBO_BONUS_PER_STATION, TERMINAL_BONUS_RATE } from './scoring';

/**
 * 車種ごとの1kmあたり走行秒数。速さの体感を作る。
 * 岡山近郊は駅間 2〜6km が中心なので、この係数で 0.45〜1.0 秒程度に収まる。
 */
export const SEC_PER_KM: Record<string, number> = {
  '115-yellow': 0.16, '213-marine': 0.11, '105-red': 0.16,
  'kiha40-orange': 0.21, 'kiha120-mizurin': 0.21, 'hot7000': 0.11,
  ibara: 0.21, 'momo-tram': 0.6, 'n700-shinkansen': 0.06,
};

/**
 * ミスのコストは走行時間への固定加算にする。
 * 率で掛けると駅間が短い区間で 0.1 秒未満になり、ペナルティとして体感できない。
 */
export const BRAKE_SEC_PER_MISS = 0.3;
export const MAX_BRAKE_SEC = 2.0;

export class RunContext {
  readonly line: Line;
  /** stops のインデックス。次に打つ駅を指す。 */
  stopIndex = 1;
  direction: 1 | -1 = 1;
  laps = 0;
  /** 発駅からの累計営業キロ。折り返しても加算し続ける。 */
  km = 0;
  typing: TypingState;
  stats: RunStats = emptyStats();
  combo = 0;
  maxCombo = 0;
  comboStations = 0;
  missesAtStation = 0;
  reachedCount = 0;
  /** いま車内にいる人数。 */
  onboard = 0;
  /** この走行でのべ何人が乗ったか。記録に残す値。 */
  passengersTotal = 0;
  /** 直前の駅での乗り降り。HUD に出す。 */
  lastBoardedOn = 0;
  lastBoardedOff = 0;

  constructor(line: Line) {
    this.line = line;
    this.typing = createTypingState(this.currentStation().kana);
  }

  /** いま打っている駅。 */
  currentStation() {
    return getStation(this.line.stops[this.stopIndex]!);
  }

  originStation() {
    return getStation(this.line.stops[0]!);
  }

  /** 直前に通過した駅（走行中の出発駅）。 */
  previousStation() {
    const i = this.stopIndex - this.direction;
    const clamped = Math.min(Math.max(i, 0), this.line.stops.length - 1);
    return getStation(this.line.stops[clamped]!);
  }

  /** いま向かっている区間。 */
  currentSegment() {
    const i = this.direction === 1 ? this.stopIndex - 1 : this.stopIndex;
    return this.line.segments[Math.min(Math.max(i, 0), this.line.segments.length - 1)]!;
  }

  /** 運賃（新幹線は自由席特急料金を含む）。実際のきっぷと同じ通し計算。 */
  get baseFare(): number {
    const rule = getFareRule(this.line.fareRule);
    return calcFare(rule, this.km, this.reachedCount)
      + calcSurcharge(this.line.surchargeRule, this.km);
  }

  /** 直前の1駅で増えた額。「1駅ごとにいくら増えたか」を見せるために使う。 */
  lastFareIncrease = 0;

  /**
   * いま打っている駅を打ち終えたら増える額。
   * 「打つとお金が増える」を**打つ前から**見せるために使う。
   * completeStation() と同じ式で先に計算しているだけなので、
   * 実際に着いたときの増加額と必ず一致する。
   */
  get nextFareIncrease(): number {
    const rule = getFareRule(this.line.fareRule);
    const km = this.km + this.currentSegment().km;
    const after = calcFare(rule, km, this.reachedCount + 1)
      + calcSurcharge(this.line.surchargeRule, km);
    return Math.max(0, after - this.baseFare);
  }

  /**
   * いまの駅をどれだけ打てたか 0..1。
   * 確定した綴りの長さ ÷ 駅名全体の綴りの長さ。
   * 綴り方（shi / si）で分母が変わるが、ゲージの見た目にしか使わない。
   */
  get stationProgress(): number {
    const total = (this.typing.suffixHint[0] ?? '').length;
    if (total === 0) return 0;
    const typed = this.typing.committed.length + this.typing.typed.length;
    return Math.min(1, typed / total);
  }

  get bonus(): number {
    const combo = this.comboStations * COMBO_BONUS_PER_STATION;
    const terminal = Math.round(this.baseFare * TERMINAL_BONUS_RATE * this.laps);
    return combo + terminal;
  }

  get fare(): number {
    return this.baseFare + this.bonus;
  }

  /** 終点（または起点まで戻った）か。 */
  atTerminal(): boolean {
    return this.direction === 1
      ? this.stopIndex >= this.line.stops.length - 1
      : this.stopIndex <= 0;
  }

  /** 区間の基本走行秒数（ミスなしの場合）。 */
  private baseTravelSeconds(): number {
    const perKm = SEC_PER_KM[this.line.vehicle] ?? 0.16;
    return Math.min(Math.max(this.currentSegment().km * perKm, 0.45), 2.4);
  }

  /** 現区間の走行秒数。ミスした分だけ延びる。 */
  travelSeconds(): number {
    return this.baseTravelSeconds() + this.brakePenalty(this.missesAtStation);
  }

  private brakePenalty(misses: number): number {
    return Math.min(misses * BRAKE_SEC_PER_MISS, MAX_BRAKE_SEC);
  }

  /**
   * いま起きたミスで実際に増えた秒数。
   * HUD に「制動 -0.3秒」と数値で出す。見えないペナルティは学習に繋がらない。
   */
  lastBrakeCost(): number {
    return this.brakePenalty(this.missesAtStation) - this.brakePenalty(this.missesAtStation - 1);
  }

  recordMiss(): void {
    this.stats.misses++;
    this.missesAtStation++;
    this.combo = 0;
    const kana = this.typing.nodes[this.typing.nodeIndex]?.kana;
    if (kana !== undefined) {
      this.stats.missByKana[kana] = (this.stats.missByKana[kana] ?? 0) + 1;
    }
  }

  recordHit(): void {
    this.stats.correct++;
  }

  /** 駅を打ち終えた。運賃を加算し、次の駅へ進める。 */
  completeStation(): void {
    const before = this.baseFare;
    this.km += this.currentSegment().km;
    this.reachedCount++;
    this.lastFareIncrease = this.baseFare - before;

    // 乗客の乗り降り
    const { on, off } = boardingAt(this.currentStation(), this.onboard, this.missesAtStation === 0);
    this.onboard = this.onboard - off + on;
    this.passengersTotal += on;
    this.lastBoardedOn = on;
    this.lastBoardedOff = off;
    if (this.missesAtStation === 0) {
      this.combo++;
      this.comboStations++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    this.missesAtStation = 0;
  }

  /** 次の駅へ。終点なら折り返す。 */
  advance(): { turnaround: boolean } {
    if (this.atTerminal()) {
      this.direction = this.direction === 1 ? -1 : 1;
      this.laps++;
      this.stopIndex += this.direction;
      this.typing = createTypingState(this.currentStation().kana);
      return { turnaround: true };
    }
    this.stopIndex += this.direction;
    this.typing = createTypingState(this.currentStation().kana);
    return { turnaround: false };
  }
}
