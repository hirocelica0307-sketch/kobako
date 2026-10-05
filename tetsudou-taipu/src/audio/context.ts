/**
 * Web Audio の入り口。音声ファイルは一切持たず、すべて合成する。
 *
 * ブラウザはユーザー操作なしに音を鳴らせないので、
 * 最初のキー入力で resume() を呼ぶ必要がある（unlock()）。
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let seBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let muted = false;

export interface AudioBuses {
  ctx: AudioContext;
  se: GainNode;
  bgm: GainNode;
}

/** 生成済みなら返す。まだ操作されていなければ null（音は鳴らさない）。 */
export function getAudio(): AudioBuses | null {
  if (ctx === null || master === null || seBus === null || bgmBus === null) return null;
  return { ctx, se: seBus, bgm: bgmBus };
}

/** 最初のユーザー操作で呼ぶ。以降は何度呼んでも安全。 */
export function unlock(): AudioBuses | null {
  try {
    if (ctx === null) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor === undefined) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      seBus = ctx.createGain();
      seBus.gain.value = 0.5;
      seBus.connect(master);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = 0.28;
      bgmBus.connect(master);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return getAudio();
  } catch {
    // 音が出せない環境でもゲームは動かす
    return null;
  }
}

export function setMuted(next: boolean): void {
  muted = next;
  if (master !== null && ctx !== null) {
    master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setVolumes(seVolume: number, bgmVolume: number): void {
  if (seBus !== null) seBus.gain.value = seVolume;
  if (bgmBus !== null) bgmBus.gain.value = bgmVolume;
}

/** 音名 → 周波数。'C4' / 'F#3' / 'FS3' / 'Bb5' に対応（S は # の別表記）。 */
const SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export function noteToFreq(note: string): number {
  const m = /^([A-G])([#Sb]?)(-?\d)$/.exec(note);
  if (m === null) throw new Error(`bad note name: ${note}`);
  const base = SEMITONES[m[1]!]!;
  const accidental = m[2] === '#' || m[2] === 'S' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  const midi = (octave + 1) * 12 + base + accidental;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
