import { getAudio } from './context';
import { playNoise, playTone } from './synth';
import { trackFor, type Drum, type Step, type TrackDef } from './tracks';

/**
 * BGM の再生。
 *
 * 先読みスケジューラ方式: 25ms ごとに「次の 0.15 秒に鳴る音」を
 * AudioContext の時刻で予約しておく。rAF に依存しないので、
 * 描画が重くなってもテンポが崩れない。
 */
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.15;

let timer: ReturnType<typeof setInterval> | null = null;
let track: TrackDef | null = null;
let step = 0;
let nextNoteTime = 0;
let currentId: string | null = null;

function stepDuration(t: TrackDef): number {
  return 60 / t.bpm / 2; // 8分音符
}

/** '-' は直前の音を伸ばすので、その分だけ長さを足す。 */
function noteLength(seq: readonly Step[], index: number, unit: number): number {
  let n = 1;
  for (let i = index + 1; i < seq.length && seq[i] === '-'; i++) n++;
  return n * unit * 0.92;
}

function scheduleStep(t: TrackDef, i: number, when: number): void {
  const a = getAudio();
  if (a === null) return;
  const unit = stepDuration(t);

  const lead = t.lead[i];
  if (lead !== null && lead !== undefined && lead !== '-') {
    playTone(a.ctx, a.bgm, lead, when, {
      wave: 'square', duration: noteLength(t.lead, i, unit),
      gain: 0.12, attack: 0.008, release: 0.05,
    });
  }

  const bass = t.bass[i];
  if (bass !== null && bass !== undefined && bass !== '-') {
    playTone(a.ctx, a.bgm, bass, when, {
      wave: 'triangle', duration: noteLength(t.bass, i, unit),
      gain: 0.2, attack: 0.006, release: 0.05,
    });
  }

  const drum: Drum = t.drums[i] ?? null;
  if (drum === 'k') {
    playTone(a.ctx, a.bgm, 110, when, { wave: 'sine', duration: 0.1, gain: 0.3, glideTo: 42 });
  } else if (drum === 's') {
    playNoise(a.ctx, a.bgm, when, { duration: 0.09, gain: 0.12, from: 2200, to: 900, q: 1.2 });
  } else if (drum === 'h') {
    playNoise(a.ctx, a.bgm, when, { duration: 0.035, gain: 0.05, from: 7000, to: 5200, q: 2 });
  }
}

function tick(): void {
  const a = getAudio();
  if (a === null || track === null) return;
  const unit = stepDuration(track);
  while (nextNoteTime < a.ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(track, step, nextNoteTime);
    nextNoteTime += unit;
    step = (step + 1) % track.lead.length;
  }
}

/** 路線の曲を流す。同じ曲なら何もしない（駅ごとに鳴り直さない）。 */
export function playBgm(lineId: string): void {
  const a = getAudio();
  if (a === null) return;
  if (currentId === lineId && timer !== null) return;
  stopBgm();
  currentId = lineId;
  track = trackFor(lineId);
  step = 0;
  nextNoteTime = a.ctx.currentTime + 0.08;
  timer = setInterval(tick, LOOKAHEAD_MS);
  tick();
}

export function stopBgm(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
  track = null;
  currentId = null;
}

export function bgmPlaying(): boolean {
  return timer !== null;
}

/** テストと外部からの確認用。 */
export function currentTrackId(): string | null {
  return currentId;
}
