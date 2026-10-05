import { getAudio } from './context';
import { playNoise, playTone } from './synth';

/**
 * 効果音。すべて合成で作る。
 * 打鍵音は毎秒何回も鳴るので、短く・小さく・耳に刺さらない音にしてある。
 */

export function sfxKey(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  playTone(a.ctx, a.se, 1180, t, { wave: 'square', duration: 0.032, gain: 0.055, release: 0.02 });
}

/** ノード（かな1文字）を打ち切ったとき。少し高く鳴らして達成感を出す。 */
export function sfxNodeDone(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  playTone(a.ctx, a.se, 1580, t, { wave: 'square', duration: 0.045, gain: 0.06, release: 0.03 });
}

export function sfxMiss(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  playTone(a.ctx, a.se, 180, t, { wave: 'sawtooth', duration: 0.13, gain: 0.16, glideTo: 90 });
  playNoise(a.ctx, a.se, t, { duration: 0.1, gain: 0.1, from: 1200, to: 200, q: 0.7 });
}

/** ブレーキ。ミスで減速したことを音でも伝える。 */
export function sfxBrake(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  playNoise(a.ctx, a.se, t, { duration: 0.42, gain: 0.13, from: 2600, to: 320, q: 6 });
}

/** 発車メロディ風のジングル。駅を打ち終えて発車するときに鳴らす。 */
export function sfxDepartureMelody(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  const melody: Array<[string, number]> = [
    ['E5', 0], ['G5', 0.11], ['C6', 0.22], ['B5', 0.33], ['G5', 0.44], ['E5', 0.55],
  ];
  for (const [note, offset] of melody) {
    playTone(a.ctx, a.se, note, t + offset, {
      wave: 'triangle', duration: 0.22, gain: 0.17, attack: 0.008, release: 0.14,
    });
  }
}

/** 発車ベル。カウントダウンの最後に鳴らす。 */
export function sfxDepartureBell(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  for (let i = 0; i < 6; i++) {
    const at = t + i * 0.09;
    playTone(a.ctx, a.se, i % 2 === 0 ? 'A5' : 'E5', at, {
      wave: 'sine', duration: 0.1, gain: 0.14, release: 0.07,
    });
  }
}

/**
 * 出発の笛。駅員が吹く「ピーッ」。
 * 高い音に少しノイズを混ぜ、細かく揺らすと笛らしくなる。
 */
export function sfxWhistle(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  const dur = 0.62;

  // 芯になる高い音を2つ重ねて、わずかにずらして唸りを作る
  playTone(a.ctx, a.se, 2350, t, {
    wave: 'sine', duration: dur, gain: 0.2, attack: 0.02, release: 0.14,
  });
  playTone(a.ctx, a.se, 2362, t, {
    wave: 'sine', duration: dur, gain: 0.15, attack: 0.03, release: 0.14, detune: 8,
  });
  // 息の音
  playNoise(a.ctx, a.se, t, { duration: dur, gain: 0.05, from: 3200, to: 2600, q: 12 });
  // 吹き終わりの落ち
  playTone(a.ctx, a.se, 2350, t + dur - 0.05, {
    wave: 'sine', duration: 0.12, gain: 0.12, glideTo: 1500, release: 0.1,
  });
}

/** 到着チャイム。終点に着いたとき。 */
export function sfxArrive(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  const notes = ['C5', 'E5', 'G5', 'C6'];
  notes.forEach((n, i) => {
    playTone(a.ctx, a.se, n, t + i * 0.14, {
      wave: 'triangle', duration: 0.45, gain: 0.16, attack: 0.01, release: 0.32,
    });
  });
}

/** リザルトのファンファーレ。 */
export function sfxFanfare(): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  const seq: Array<[string, number, number]> = [
    ['C5', 0, 0.13], ['E5', 0.13, 0.13], ['G5', 0.26, 0.13],
    ['C6', 0.39, 0.4], ['G5', 0.39, 0.4], ['E5', 0.39, 0.4],
  ];
  for (const [note, offset, dur] of seq) {
    playTone(a.ctx, a.se, note, t + offset, {
      wave: 'square', duration: dur, gain: 0.13, release: dur * 0.6,
    });
  }
}

/** コンボが伸びたときの小さな加点音。 */
export function sfxCombo(step: number): void {
  const a = getAudio();
  if (a === null) return;
  const t = a.ctx.currentTime;
  const freq = 880 * Math.pow(2, Math.min(step, 12) / 24);
  playTone(a.ctx, a.se, freq, t, { wave: 'triangle', duration: 0.09, gain: 0.09, release: 0.06 });
}
