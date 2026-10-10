/* 効果音と こえ
   ------------------------------------------------------------------
   音は ファイルを つかわず Web Audio で その場で つくります。
   こえは ブラウザの 読みあげ（speechSynthesis）を つかいます。
   どちらも つかえない 端末では だまって なにも しません。
   ------------------------------------------------------------------ */
import { store } from './store.js';

let ctx = null;
function ac() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

/** 画面を はじめて さわった ときに 音の じゅんびを します（スマホの きまり） */
export function unlockAudio() {
    if (!store.display.sound) return;
    try { ac(); } catch (e) { /* むし */ }
}

function noiseBurst(t0, dur, freq, gain) {
    const a = ac();
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const gn = a.createGain();
    gn.gain.value = gain;
    src.connect(f).connect(gn).connect(a.destination);
    src.start(t0);
}

function tone(t0, freq, dur, gain = 0.12, type = 'triangle') {
    const a = ac();
    const o = a.createOscillator();
    const gn = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(gn).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
}

function play(fn) {
    if (!store.display.sound) return;
    try {
        const a = ac();
        if (!a) return;
        fn(a.currentTime + 0.01);
    } catch (e) { /* むし */ }
}

export const sfx = {
    /** 札を 場に おく「パチッ」 */
    place: () => play(t => { noiseBurst(t, 0.07, 2400, 0.9); noiseBurst(t, 0.05, 900, 0.5); }),
    /** 札を とる */
    capture: () => play(t => { noiseBurst(t, 0.08, 2000, 0.8); tone(t + 0.02, 880, 0.12, 0.05); }),
    /** 札を めくる */
    flip: () => play(t => noiseBurst(t, 0.05, 3800, 0.35)),
    /** えらぶ */
    tap: () => play(t => tone(t, 660, 0.06, 0.05, 'sine')),
    /** 配る */
    deal: () => play(t => noiseBurst(t, 0.04, 3000, 0.25)),
    /** 役が できた */
    yaku: () => play(t => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.35, 0.09))),
    /** こいこい */
    koikoi: () => play(t => [784, 988, 784, 988].forEach((f, i) => tone(t + i * 0.08, f, 0.16, 0.08, 'square'))),
    /** かち */
    win: () => play(t => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, 0.4, 0.09))),
    /** まけ */
    lose: () => play(t => [440, 392, 349, 294].forEach((f, i) => tone(t + i * 0.16, f, 0.4, 0.08))),
    /** まちがい */
    ng: () => play(t => tone(t, 180, 0.15, 0.08, 'sawtooth')),
    ok: () => play(t => { tone(t, 880, 0.1, 0.08); tone(t + 0.08, 1320, 0.18, 0.08); })
};

let voices = null;
function jaVoice() {
    if (!('speechSynthesis' in window)) return null;
    if (!voices || !voices.length) voices = speechSynthesis.getVoices();
    return voices.find(v => /ja/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
    try { speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); }; } catch (e) { /* むし */ }
}

/** 日本語で 読みあげます（日本語の こえが ない 端末では 読みません） */
export function say(text) {
    if (!store.display.sound || !store.display.voice) return;
    try {
        const v = jaVoice();
        if (!v) return;
        const u = new SpeechSynthesisUtterance(text);
        u.voice = v;
        u.lang = 'ja-JP';
        u.rate = 1.05;
        u.pitch = 1.1;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    } catch (e) { /* むし */ }
}
