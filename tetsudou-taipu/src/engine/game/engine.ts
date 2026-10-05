import type { Line } from '../../data/types';
import { expectedChars, feedKey } from '../typing/matcher';
import { renderRomaji, furiganaSplit } from '../typing/hint';
import { getStation } from '../../data/stations';
import { RunContext } from './run';
import { RunTimer } from './timer';
import { buildSummary, type RunSummary } from './scoring';
import { renderScene, type SceneState, type Spark } from '../../render/scene';
import type { LandmarkId } from '../../data/types';
import {
  sfxArrive, sfxBrake, sfxCombo, sfxDepartureBell, sfxDepartureMelody,
  sfxFanfare, sfxKey, sfxMiss, sfxNodeDone, sfxWhistle,
} from '../../audio/sfx';
import { playBgm, stopBgm } from '../../audio/music';
import { rollWeather, WEATHER_LABEL } from '../../render/weather';
import type { RomajiDisplay } from '../typing/types';

export type TimeLimit = 60 | 120 | 180;
export type Phase =
  | 'title' | 'lineSelect' | 'config' | 'countdown'
  | 'atStation' | 'departing' | 'turnaround' | 'result';

/** 一時停止メニューの項目。 */
export const PAUSE_ITEMS = [
  { id: 'resume', label: 'つづける', key: 'Esc' },
  { id: 'restart', label: 'さいしょから', key: 'R' },
  { id: 'keyboard', label: 'キーボードを だす / けす', key: 'K' },
  { id: 'mute', label: 'おとの ON / OFF', key: 'M' },
  { id: 'title', label: 'タイトルへ もどる', key: 'T' },
] as const;
export type PauseItemId = (typeof PAUSE_ITEMS)[number]['id'];

export const TIME_LIMITS = [60, 120, 180] as const;

/** 走行アニメーションで1区間に費やす見かけの距離（論理px）。 */
const SEGMENT_PIXELS = 240;
const COUNTDOWN_SEC = 3;
const TURNAROUND_SEC = 1.5;

export interface Toast { id: number; text: string; life: number; kind: 'penalty' | 'gain' | 'info' }

export interface Snapshot {
  phase: Phase;
  paused: boolean;
  imeOn: boolean;
  countdown: number;
  /** カウントダウンの最後。「出発進行！」を出す区間。 */
  departureCall: boolean;
  remainSec: number;
  timeLimit: TimeLimit;
  lineId: string;
  lineName: string;
  /** その回の天気（ひらがな表記）。 */
  weatherLabel: string;
  lineIndex: number;
  trainType: string;
  destination: string;
  lineColor: string;
  /** 現在打っている駅。 */
  stationKanji: string;
  stationKana: string;
  stationNote: string | null;
  romaji: RomajiDisplay;
  furigana: { done: number; active: number };
  showRomaji: boolean;
  /** 駅名帯のスロット。[後方の駅, 現在の駅, 前方の駅]。 */
  prevStationKanji: string | null;
  nextStationKanji: string | null;
  /** 名所のキャプション。 */
  landmarkLabels: readonly string[];
  /** 発車で帯を1つずらすためのスライド量 0..1 と向き。 */
  slide: number;
  slideDir: 1 | -1;
  nextSegmentKm: number;
  pauseIndex: number;
  /** 運賃とボーナスの合計（スコア）。 */
  fare: number;
  /** 実際のきっぷと同じ計算の運賃。ボーナスは含まない。 */
  baseFare: number;
  /** ノーミスなどのボーナス。運賃とは分けて見せる。 */
  bonus: number;
  /** 直前の1駅で増えた運賃。 */
  fareIncrease: number;
  /** 次の駅に着いたら増える運賃。打つ前から見せる。 */
  nextFareIncrease: number;
  /** いまの駅をどれだけ打てたか 0..1。 */
  stationProgress: number;
  /** 次に押せるキー。画面下のキーボードを光らせるのに使う。 */
  expectedKeys: readonly string[];
  /** いま車内にいる人数。 */
  onboard: number;
  /** のべ何人乗ったか。 */
  passengersTotal: number;
  combo: number;
  toasts: readonly Toast[];
  missFlash: boolean;
  summary: RunSummary | null;
  isNewRecord: boolean;
}

export interface EngineOptions {
  line: Line;
  timeLimit: TimeLimit;
  showRomaji: boolean;
  onFinish?: (summary: RunSummary) => boolean;
}

export class GameEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastFrame = 0;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot;
  private notifyAccum = 0;

  private phase: Phase = 'title';
  private paused = false;
  private imeOn = false;
  private run: RunContext;
  private timer = new RunTimer();
  private options: EngineOptions;

  private phaseElapsed = 0;
  private travelSec = 0;
  private segmentStartDistance = 0;
  private toasts: Toast[] = [];
  private toastId = 0;
  private missFlash = 0;
  private summary: RunSummary | null = null;
  private isNewRecord = false;
  private pauseIndex = 0;
  private lineIndex = 0;
  private bellRung = false;
  private whistleBlown = false;

  private scene: SceneState = {
    distance: 0, speed: 0, scene: 'suburb', vehicle: '115-yellow',
    stoppedAt: null, direction: 1, shake: 0, sparks: [], time: 0, showSpeed: false,
    landmarks: [], stationRomaji: '', idleTime: 0, doorOpen: 1,
    signalGreen: false, reduceMotion: false, weather: 'sunny',
  };

  constructor(options: EngineOptions) {
    this.options = options;
    this.run = new RunContext(options.line);
    this.scene.vehicle = options.line.vehicle;
    this.scene.scene = this.run.currentSegment().scene;
    this.snapshot = this.buildSnapshot();
  }

  // ---- React 連携 ----

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  /** 変化が無ければ同じ参照を返す（React の無限ループ検知を避ける）。 */
  getSnapshot = (): Snapshot => this.snapshot;

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const fn of this.listeners) fn();
  }

  // ---- ライフサイクル ----

  attach(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      this.update(dt);
      if (this.ctx !== null) {
        // 路線選択中は地図（SVG）が画面全体を覆うので Canvas は描かない。
        // ドット絵の地図は拡大すると線がギザギザで読み取れなかったため、
        // この画面だけ SVG に置き換えてある。
        if (this.phase !== 'lineSelect') renderScene(this.ctx, this.scene);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.ctx = null;
    this.listeners.clear();
  }

  /** タイトル → 路線を選ぶ。 */
  openLineSelect(): void {
    this.phase = 'lineSelect';
    this.phaseElapsed = 0;
    this.emit();
  }

  moveLineCursor(delta: number, total: number): void {
    this.lineIndex = (this.lineIndex + delta + total) % total;
    this.emit();
  }

  get lineCursor(): number {
    return this.lineIndex;
  }

  /** 選んだ路線に差し替える。RunContext を作り直す。 */
  setLine(line: Line, index: number): void {
    this.options = { ...this.options, line };
    this.lineIndex = index;
    this.run = new RunContext(line);
    this.scene.vehicle = line.vehicle;
    this.scene.scene = this.run.currentSegment().scene;
    this.scene.direction = 1;
    this.scene.distance = 0;
    this.rollSceneWeather();
    this.emit();
  }

  /** タイトル → 制限時間の選択へ。 */
  openConfig(): void {
    this.phase = 'config';
    this.phaseElapsed = 0;
    this.emit();
  }

  setTimeLimit(timeLimit: TimeLimit): void {
    this.options = { ...this.options, timeLimit };
    this.emit();
  }

  backToTitle(): void {
    this.run = new RunContext(this.options.line);
    this.timer.reset();
    this.paused = false;
    this.pauseIndex = 0;
    this.summary = null;
    this.isNewRecord = false;
    this.scene.speed = 0;
    this.scene.stoppedAt = null;
    this.scene.landmarks = [];
    this.scene.direction = 1;
    this.scene.showSpeed = false;
    this.scene.sparks = [];
    this.toasts = [];
    this.phase = 'title';
    this.phaseElapsed = 0;
    playBgm('__title');
    this.emit();
  }

  /** プレイのたびに天気を引き直す。同じ路線でも毎回ちがう景色になる。 */
  private rollSceneWeather(): void {
    this.scene.weather = rollWeather(this.options.line.id);
  }

  start(): void {
    this.rollSceneWeather();
    this.phase = 'countdown';
    this.phaseElapsed = 0;
    this.bellRung = false;
    this.whistleBlown = false;
    this.scene.showSpeed = true;
    playBgm(this.options.line.id);
    this.emit();
  }

  restart(): void {
    this.rollSceneWeather();
    this.run = new RunContext(this.options.line);
    this.timer.reset();
    this.scene.distance = 0;
    this.scene.speed = 0;
    this.scene.direction = 1;
    this.scene.stoppedAt = null;
    this.scene.sparks = [];
    this.toasts = [];
    this.summary = null;
    this.isNewRecord = false;
    this.phase = 'countdown';
    this.phaseElapsed = 0;
    this.paused = false;
    this.pauseIndex = 0;
    this.bellRung = false;
    this.whistleBlown = false;
    this.scene.showSpeed = true;
    playBgm(this.options.line.id);
    this.emit();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.timer.pause();
    else if (this.phase === 'atStation' || this.phase === 'departing') this.timer.start();
    this.emit();
  }

  movePauseCursor(delta: number): void {
    const n = PAUSE_ITEMS.length;
    this.pauseIndex = (this.pauseIndex + delta + n) % n;
    this.emit();
  }

  get pauseSelection(): PauseItemId {
    return PAUSE_ITEMS[this.pauseIndex]!.id;
  }

  setImeOn(on: boolean): void {
    if (this.imeOn === on) return;
    this.imeOn = on;
    // IME が ON の間はタイマーを止める（打てないのに時間だけ減るのを防ぐ）
    if (on) this.timer.pause();
    else if (!this.paused && (this.phase === 'atStation' || this.phase === 'departing')) this.timer.start();
    this.emit();
  }

  setShowRomaji(show: boolean): void {
    this.options = { ...this.options, showRomaji: show };
    this.emit();
  }

  get currentPhase(): Phase { return this.phase; }
  get isPaused(): boolean { return this.paused; }
  get currentLineId(): string { return this.options.line.id; }
  get currentTimeLimit(): TimeLimit { return this.options.timeLimit; }

  // ---- 入力 ----

  handleChar(key: string): void {
    if (this.phase !== 'atStation' || this.paused || this.imeOn) return;
    const result = feedKey(this.run.typing, key);
    if (result.type === 'ignore') return;

    if (result.type === 'miss') {
      this.run.recordMiss();
      sfxMiss();
      sfxBrake();
      this.missFlash = 0.12;
      this.scene.shake = 0.16;
      const cost = this.run.lastBrakeCost();
      this.pushToast(cost > 0 ? `制動 -${cost.toFixed(1)}秒` : '制動 上限');
      this.spawnSparks();
      this.emit();
      return;
    }

    this.run.recordHit();
    this.run.typing = result.state;
    if (result.nodeCompleted) sfxNodeDone(); else sfxKey();
    if (result.finished) this.departStation();
    this.emit();
  }

  // ---- 進行 ----

  private departStation(): void {
    const comboBefore = this.run.combo;
    this.run.completeStation();
    sfxDepartureMelody();
    if (this.run.combo > comboBefore && this.run.combo > 1) sfxCombo(this.run.combo);
    // 1駅ごとに「いくら増えて、何人乗ったか」を必ず見せる
    const parts: string[] = [];
    if (this.run.lastFareIncrease > 0) parts.push(`+¥${this.run.lastFareIncrease.toLocaleString('ja-JP')}`);
    if (this.run.lastBoardedOn > 0) parts.push(`+${this.run.lastBoardedOn}にん`);
    if (parts.length > 0) this.pushToast(parts.join('　'), 'gain');
    this.travelSec = this.run.travelSeconds();
    this.segmentStartDistance = this.scene.distance;
    this.phase = 'departing';
    this.phaseElapsed = 0;
    this.scene.stoppedAt = null;
    this.scene.doorOpen = 0;
    this.scene.signalGreen = true;
    this.scene.scene = this.run.currentSegment().scene;
  }

  private arriveStation(): void {
    const { turnaround } = this.run.advance();
    this.scene.speed = 0;
    if (turnaround) {
      this.scene.direction = this.run.direction;
      this.phase = 'turnaround';
      this.phaseElapsed = 0;
      this.timer.pause();
      sfxArrive();
      this.pushToast('終点 — 折り返します', 'info');
      return;
    }
    this.enterStation();
  }

  private enterStation(): void {
    const station = this.run.currentStation();
    this.phase = 'atStation';
    this.phaseElapsed = 0;
    this.scene.stoppedAt = station.kanji;
    this.scene.landmarks = (station.landmarks ?? []).map((l) => l.sprite) as LandmarkId[];
    this.scene.stationRomaji = this.run.typing.suffixHint[0] ?? '';
    this.scene.scene = this.run.currentSegment().scene;
    this.scene.doorOpen = 1;      // 停車でドアが開く
    this.scene.signalGreen = false; // 出発信号は赤に戻る
    if (!this.paused && !this.imeOn) this.timer.start();
  }

  private finish(): void {
    this.timer.pause();
    const origin = this.run.originStation();
    const reached = this.run.previousStation();
    this.summary = buildSummary({
      lineId: this.options.line.id,
      lineName: this.options.line.nameJp,
      trainType: this.options.line.trainType,
      originKanji: origin.kanji,
      originKana: origin.kana,
      reachedKanji: reached.kanji,
      reachedKana: reached.kana,
      reachedCount: this.run.reachedCount,
      km: Number(this.run.km.toFixed(1)),
      timeLimit: this.options.timeLimit,
      elapsedSec: this.timer.elapsedSec(),
      baseFare: this.run.baseFare,
      bonus: this.run.bonus,
      stats: this.run.stats,
      maxCombo: this.run.maxCombo,
      laps: this.run.laps,
      passengers: this.run.passengersTotal,
    });
    this.isNewRecord = this.options.onFinish?.(this.summary) ?? false;
    stopBgm();
    sfxFanfare();
    this.phase = 'result';
    this.scene.speed = 0;
    this.emit();
  }

  private update(dt: number): void {
    // 列車が止まっていても進む時間。雲・乗客・信号はこれで動かす。
    this.scene.idleTime += dt;
    this.scene.time += dt;
    if (this.scene.shake > 0) this.scene.shake = Math.max(0, this.scene.shake - dt);
    if (this.missFlash > 0) this.missFlash = Math.max(0, this.missFlash - dt);
    this.stepSparks(dt);
    this.stepToasts(dt);

    if (this.paused || this.imeOn) {
      this.scene.speed = 0;
      return;
    }

    // フェーズの経過時間は止めている間は進めない。
    // ここより前で足すと、一時停止中にカウントダウンが進み、
    // 走行中なら再開した瞬間に列車が飛ぶ。
    this.phaseElapsed += dt;

    switch (this.phase) {
      case 'title':
      case 'lineSelect':
      case 'config':
        // タイトル・設定中も景色を流しておく（静止画に見せない）
        this.scene.speed = 34;
        this.scene.distance += 34 * dt;
        break;
      case 'countdown':
        // 3・2・1 のあと、発車ベル → 笛 →「出発進行！」で発車
        if (!this.bellRung && this.phaseElapsed >= COUNTDOWN_SEC - 1.6) {
          this.bellRung = true;
          sfxDepartureBell();
        }
        if (!this.whistleBlown && this.phaseElapsed >= COUNTDOWN_SEC - 0.75) {
          this.whistleBlown = true;
          sfxWhistle();
        }
        if (this.phaseElapsed >= COUNTDOWN_SEC) this.enterStation();
        break;
      case 'turnaround':
        if (this.phaseElapsed >= TURNAROUND_SEC) this.enterStation();
        break;
      case 'departing': {
        const t = Math.min(this.phaseElapsed / this.travelSec, 1);
        // 折り返すと距離が減る向きに動く。
        // これで背景・枕木・架線柱のスクロールも車輪の回転も自動的に逆になる
        // （scene.ts は mod() を使っており、負の値も正しく折り返す）。
        this.scene.distance = this.segmentStartDistance + SEGMENT_PIXELS * t * this.run.direction;
        this.scene.speed = SEGMENT_PIXELS / this.travelSec;
        if (t >= 1) this.arriveStation();
        break;
      }
      default:
        this.scene.speed = 0;
    }

    if (this.phase === 'atStation' || this.phase === 'departing') {
      if (this.remaining() <= 0) { this.finish(); return; }
    }

    // 毎フレーム React を起こさない。100ms ごとに時間表示だけ更新する。
    this.notifyAccum += dt;
    if (this.notifyAccum >= 0.1) {
      this.notifyAccum = 0;
      this.emit();
    }
  }

  private remaining(): number {
    return Math.max(0, this.options.timeLimit - this.timer.elapsedSec());
  }

  private pushToast(text: string, kind: Toast['kind'] = 'penalty'): void {
    this.toasts = [...this.toasts, { id: ++this.toastId, text, life: 1.4, kind }].slice(-3);
  }

  private stepToasts(dt: number): void {
    if (this.toasts.length === 0) return;
    this.toasts = this.toasts
      .map((t) => ({ ...t, life: t.life - dt }))
      .filter((t) => t.life > 0);
  }

  private spawnSparks(): void {
    const made: Spark[] = [];
    for (let i = 0; i < 5; i++) {
      made.push({
        x: 100 + i * 9, y: 119,
        vx: -30 - Math.random() * 40, vy: -40 - Math.random() * 30,
        life: 0.4 + Math.random() * 0.2,
      });
    }
    this.scene.sparks = [...this.scene.sparks, ...made].slice(-30);
  }

  private stepSparks(dt: number): void {
    if (this.scene.sparks.length === 0) return;
    this.scene.sparks = this.scene.sparks
      .map((s) => ({ ...s, x: s.x + s.vx * dt, y: s.y + s.vy * dt, vy: s.vy + 260 * dt, life: s.life - dt }))
      .filter((s) => s.life > 0);
  }

  private buildSnapshot(): Snapshot {
    const line = this.options.line;
    const station = this.run.currentStation();
    const dir = this.run.direction;
    const prevId = line.stops[this.run.stopIndex - dir];
    const nextId = line.stops[this.run.stopIndex + dir];

    // 発車したら帯を1つ分ずらす。走行の進捗をそのままスライド量にする。
    const slide = this.phase === 'departing'
      ? Math.min(this.phaseElapsed / this.travelSec, 1)
      : 0;

    return {
      phase: this.phase,
      paused: this.paused,
      imeOn: this.imeOn,
      countdown: Math.max(0, Math.ceil(COUNTDOWN_SEC - this.phaseElapsed)),
      departureCall: this.phase === 'countdown' && this.phaseElapsed >= COUNTDOWN_SEC - 0.75,
      remainSec: this.remaining(),
      timeLimit: this.options.timeLimit,
      lineId: line.id,
      lineName: line.nameJp,
      weatherLabel: WEATHER_LABEL[this.scene.weather],
      lineIndex: this.lineIndex,
      trainType: line.trainType,
      destination: dir === 1 ? line.destination : line.originName,
      lineColor: line.lineColor,
      stationKanji: station.kanji,
      stationKana: station.kana,
      stationNote: station.note ?? null,
      romaji: renderRomaji(this.run.typing),
      furigana: furiganaSplit(this.run.typing),
      showRomaji: this.options.showRomaji,
      prevStationKanji: prevId === undefined ? null : getStation(prevId).kanji,
      nextStationKanji: nextId === undefined ? null : getStation(nextId).kanji,
      landmarkLabels: (station.landmarks ?? []).map((l) => l.label),
      slide,
      slideDir: dir,
      nextSegmentKm: this.run.currentSegment().km,
      pauseIndex: this.pauseIndex,
      fare: this.run.fare,
      baseFare: this.run.baseFare,
      bonus: this.run.bonus,
      fareIncrease: this.run.lastFareIncrease,
      nextFareIncrease: this.run.nextFareIncrease,
      stationProgress: this.run.stationProgress,
      // 打てるのは停車中だけ。走行中も光らせると次の駅の文字を先に押してしまう。
      expectedKeys: this.phase === 'atStation' && !this.paused && !this.imeOn
        ? expectedChars(this.run.typing)
        : [],
      onboard: this.run.onboard,
      passengersTotal: this.run.passengersTotal,
      combo: this.run.combo,
      toasts: this.toasts,
      missFlash: this.missFlash > 0,
      summary: this.summary,
      isNewRecord: this.isNewRecord,
    };
  }
}
