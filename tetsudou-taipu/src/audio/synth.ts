import { noteToFreq } from './context';

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export interface ToneOptions {
  wave?: Wave;
  /** 秒。 */
  duration?: number;
  gain?: number;
  attack?: number;
  release?: number;
  /** 終了時に向かって周波数を滑らせる（ブレーキ音などに使う）。 */
  glideTo?: number;
  detune?: number;
}

/**
 * 1音を鳴らす。ADSR を単純化した attack → sustain → release。
 * ノードは終了時に自動で破棄される（積み上がるとメモリを食うため）。
 */
export function playTone(
  ctx: AudioContext,
  bus: GainNode,
  note: string | number,
  at: number,
  opts: ToneOptions = {},
): void {
  const {
    wave = 'square', duration = 0.16, gain = 0.25,
    attack = 0.005, release = 0.06, glideTo, detune = 0,
  } = opts;

  const freq = typeof note === 'number' ? note : noteToFreq(note);
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, at);
  if (detune !== 0) osc.detune.setValueAtTime(detune, at);
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), at + duration);

  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
  amp.gain.setValueAtTime(Math.max(0.0002, gain), at + Math.max(attack, duration - release));
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(amp).connect(bus);
  osc.start(at);
  osc.stop(at + duration + 0.02);
  osc.onended = () => { osc.disconnect(); amp.disconnect(); };
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer !== null) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** ノイズ。打楽器とブレーキ音に使う。 */
export function playNoise(
  ctx: AudioContext,
  bus: GainNode,
  at: number,
  opts: { duration?: number; gain?: number; from?: number; to?: number; q?: number } = {},
): void {
  const { duration = 0.12, gain = 0.2, from = 4000, to = 400, q = 1 } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + duration);
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  src.connect(filter).connect(amp).connect(bus);
  src.start(at);
  src.stop(at + duration + 0.02);
  src.onended = () => { src.disconnect(); filter.disconnect(); amp.disconnect(); };
}
