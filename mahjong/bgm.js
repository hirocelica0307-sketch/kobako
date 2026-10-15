/* BGM（音楽）
   ------------------------------------------------------------------
   音の ファイルは つかわず、Web Audio で その場で 演奏します（効果音と 同じ しくみ）。
     menu   … メニュー画面：あかるく ゆったり（ハ長調・ペンタトニック）
     game   … 対局中：おちついた テンポ（イ短調）
     riichi … だれかが リーチした とき：テンポが あがって すこし ドキドキ
     oorasu … オーラス（さいごの 局）：ニ短調。時計の ように きざむ ベースと 太鼓で はりつめた 感じ
   曲は 下の 楽譜（コード・メロディー）を 16分音符の マスで ならべて くりかえします。
   音量は 設定の「BGM」で かえられます（効果音・こえとは べつ）。
   ------------------------------------------------------------------ */
import { store, save } from './store.js';
import { audioParts, applyVolumes } from './sound.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = n => { const m = /^([A-G]#?)(\d)$/.exec(n); return 12 * (Number(m[2]) + 1) + NOTE[m[1]]; };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

/** "E5:4 G5:4 -:8" → [{ at, len, m }]（16分音符 いくつぶん） */
function phrase(str) {
    const out = [];
    let at = 0;
    for (const tok of str.trim().split(/\s+/)) {
        const [n, l] = tok.split(':');
        const len = Number(l);
        if (n !== '-') out.push({ at, len, m: midi(n) });
        at += len;
    }
    return out;
}
const chord = (...ns) => ns.map(midi);

/* ── 曲 ── */
const SONGS = {
    menu: {
        bpm: 96,
        chords: [chord('C3', 'E4', 'G4', 'B4'), chord('A2', 'C4', 'E4', 'G4'), chord('F2', 'A3', 'C4', 'E4'), chord('G2', 'B3', 'D4', 'E4'),
            chord('E2', 'G3', 'B3', 'D4'), chord('A2', 'C4', 'E4', 'G4'), chord('D3', 'F3', 'A3', 'C4'), chord('G2', 'C4', 'D4', 'F4')],
        melody: [
            'E5:4 G5:4 A5:6 G5:2 | E5:4 D5:4 C5:8 | A4:4 C5:4 D5:4 E5:4 | D5:12 -:4 | E5:4 G5:4 B5:4 A5:4 | G5:4 E5:4 C5:8 | D5:4 E5:4 F5:4 A5:4 | G5:12 -:4',
            'C6:6 B5:2 G5:8 | A5:4 G5:4 E5:8 | F5:4 A5:4 C6:4 A5:4 | G5:16 | E5:2 G5:2 B5:4 D6:8 | C6:4 A5:4 E5:8 | F5:4 E5:4 D5:4 C5:4 | D5:8 G4:8'
        ],
        lead: 'pluck', arp: [0, 2, 1, 3, 2, 1, 3, 2], arpVel: 0.35, bassPat: [[0, 6, 0], [8, 6, 7]], drums: 'soft', bells: true
    },
    game: {
        bpm: 84,
        chords: [chord('A2', 'C4', 'E4', 'G4', 'B4'), chord('F2', 'A3', 'C4', 'E4'), chord('D3', 'F3', 'A3', 'C4'), chord('E2', 'G3', 'B3', 'D4'),
            chord('A2', 'C4', 'E4', 'G4', 'B4'), chord('F2', 'A3', 'C4', 'E4'), chord('G2', 'B3', 'D4', 'E4'), chord('E2', 'A3', 'B3', 'D4')],
        melody: [
            'E5:6 D5:2 C5:8 | A4:4 C5:4 E5:8 | D5:4 F5:4 E5:4 D5:4 | B4:16 | E5:4 G5:4 A5:8 | G5:4 E5:4 C5:8 | D5:6 E5:2 G5:8 | E5:16',
            '-:8 A5:4 G5:4 | E5:16 | -:8 F5:4 E5:4 | D5:16 | -:8 C6:4 B5:4 | A5:16 | G5:4 A5:4 B5:4 D6:4 | B5:16'
        ],
        lead: 'pluck', leadVel: 0.75, arp: [0, 1, 2, 3, 2, 1, 0, 2], arpVel: 0.28, bassPat: [[0, 8, 0], [10, 4, 0]], drums: 'calm'
    },
    riichi: {
        bpm: 108,
        chords: [chord('A2', 'C4', 'E4'), chord('A2', 'C4', 'E4'), chord('F2', 'A3', 'C4'), chord('E2', 'G#3', 'B3', 'D4')],
        melody: [
            'E5:2 -:2 E5:2 -:2 F5:4 E5:4 | C5:8 B4:8 | A4:2 -:2 C5:2 -:2 F5:4 A5:4 | G#5:16',
            'A5:2 -:2 A5:2 -:2 C6:4 B5:4 | A5:8 E5:8 | F5:2 -:2 A5:2 -:2 C6:4 D6:4 | B5:8 G#5:8'
        ],
        lead: 'bell', leadVel: 0.6, arp: null, ostinato: true, bassPat: null, drums: 'tense'
    },
    oorasu: {
        bpm: 100,
        chords: [chord('D2', 'D4', 'F4', 'A4'), chord('D2', 'D4', 'F4', 'A4'), chord('G2', 'D4', 'G4', 'A#4'), chord('A2', 'C#4', 'E4', 'G4'),
            chord('D2', 'D4', 'F4', 'A4'), chord('G2', 'D4', 'G4', 'A#4'), chord('E2', 'E4', 'G4', 'A#4'), chord('A2', 'C#4', 'E4', 'G4')],
        melody: [
            'D5:6 E5:2 F5:8 | E5:4 D5:4 A4:8 | A#4:4 A4:4 G4:4 A#4:4 | A4:16 | D5:6 E5:2 F5:8 | G5:4 F5:4 E5:4 D5:4 | E5:4 F5:4 G5:4 A#5:4 | A5:12 -:4',
            'A5:4 -:2 A5:2 A#5:4 A5:4 | F5:8 D5:8 | G5:4 -:2 G5:2 A5:4 G5:4 | E5:8 C#5:8 | D5:4 F5:4 A5:4 D6:4 | C6:4 A#5:4 A5:4 G5:4 | G5:4 E5:4 D5:4 E5:4 | C#5:16'
        ],
        lead: 'pluck', leadVel: 0.85, arp: null, ostinato: 'pulse', bassPat: null, drums: 'oorasu', bells: true
    }
};

for (const s of Object.values(SONGS)) {
    s.bars = s.chords.length * s.melody.length;
    s.notes = [];
    s.melody.forEach((m, k) => {
        m.split('|').forEach((bar, i) => phrase(bar).forEach(n => s.notes.push({ ...n, at: n.at + (k * s.chords.length + i) * 16 })));
    });
}

/* ── 楽器 ── */
let noiseBuf = null;
function noise(a) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
}

function env(a, out, t, { attack = 0.005, peak = 0.1, decay = 0.4, sustain = 0, hold = 0, release = 0.2 }) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (sustain > 0) {
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay);
        g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + hold + release);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return { g, end: t + attack + decay + hold + release + 0.05 };
}

function osc(a, type, f, t, end, dest, detune = 0) {
    const o = a.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end);
}

const INST = {
    /** 琴・カリンバの ような はじく 音 */
    pluck(a, out, t, m, len, vel, spb) {
        const e = env(a, out, t, { attack: 0.004, peak: 0.1 * vel, decay: Math.min(1.2, 0.25 + len * spb * 0.6) });
        const lp = a.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.35);
        lp.connect(e.g);
        osc(a, 'triangle', hz(m), t, e.end, lp);
        osc(a, 'sawtooth', hz(m), t, e.end, lp, 4);
        const e2 = env(a, out, t, { attack: 0.002, peak: 0.03 * vel, decay: 0.08 });
        osc(a, 'sine', hz(m + 12), t, e2.end, e2.g);
    },
    /** 鈴の ような 音 */
    bell(a, out, t, m, len, vel) {
        const e = env(a, out, t, { attack: 0.003, peak: 0.07 * vel, decay: 1.1 });
        osc(a, 'sine', hz(m), t, e.end, e.g);
        const e2 = env(a, out, t, { attack: 0.002, peak: 0.025 * vel, decay: 0.4 });
        osc(a, 'sine', hz(m) * 2.76, t, e2.end, e2.g);
    },
    /** やわらかい 和音 */
    pad(a, out, t, ms, dur, vel = 1) {
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
        const e = env(a, out, t, { attack: 0.35, peak: 0.022 * vel, decay: 0.3, sustain: 0.8, hold: Math.max(0, dur - 0.9), release: 0.6 });
        lp.connect(e.g);
        for (const m of ms) { osc(a, 'sawtooth', hz(m), t, e.end, lp, -6); osc(a, 'triangle', hz(m), t, e.end, lp, 5); }
    },
    bass(a, out, t, m, dur, vel = 1) {
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
        const e = env(a, out, t, { attack: 0.01, peak: 0.16 * vel, decay: 0.15, sustain: 0.6, hold: Math.max(0, dur - 0.3), release: 0.12 });
        lp.connect(e.g);
        osc(a, 'triangle', hz(m), t, e.end, lp);
        osc(a, 'sine', hz(m), t, e.end, lp);
    },
    hat(a, out, t, vel = 1) {
        const s = a.createBufferSource(); s.buffer = noise(a);
        const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
        const e = env(a, out, t, { attack: 0.001, peak: 0.05 * vel, decay: 0.04 });
        s.connect(hp).connect(e.g); s.start(t); s.stop(e.end);
    },
    kick(a, out, t, vel = 1) {
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        g.connect(out);
        const o = a.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        o.connect(g); o.start(t); o.stop(t + 0.25);
    },
    shaker(a, out, t, vel = 1) {
        const s = a.createBufferSource(); s.buffer = noise(a);
        const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.4;
        const e = env(a, out, t, { attack: 0.008, peak: 0.035 * vel, decay: 0.07 });
        s.connect(bp).connect(e.g); s.start(t); s.stop(e.end);
    }
};

/* ── 演奏 ── */
class Player {
    constructor() {
        this.name = null;
        this.track = null;   // いま 鳴って いる 曲の 音量（切りかえで フェード）
        this.timer = null;
        this.duckLevel = 1;
        document.addEventListener('visibilitychange', () => {
            const p = audioParts && this.name ? audioParts() : null;
            if (!p) return;
            if (document.hidden) p.ctx.suspend().catch(() => {});
            else p.ctx.resume().catch(() => {});
        });
    }

    /** 曲を かえる（同じ 曲なら なにも しない） */
    play(name) {
        if (this.name === name && this.timer) return;
        this.name = name;
        if (!store.settings.bgm || !store.settings.sound) { this.halt(); return; }
        const p = audioParts();
        if (!p) return;
        const a = p.ctx;
        this.fadeOut(0.8);
        const song = SONGS[name];
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, a.currentTime);
        g.gain.exponentialRampToValueAtTime(this.duckLevel, a.currentTime + 1.2);
        g.connect(p.out);
        const wet = a.createGain(); wet.gain.value = 0.5; g.connect(wet); wet.connect(p.verbIn);
        this.track = g;
        const spb = 60 / song.bpm / 4;   // 16分音符 1つの 秒
        let step = 0, next = a.currentTime + 0.12;
        const total = song.bars * 16;
        clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (a.state !== 'running') return;
            if (next < a.currentTime - 0.5) next = a.currentTime + 0.05;   // しばらく 止まって いた
            while (next < a.currentTime + 0.25) {
                this.stepAt(a, g, song, step % total, next, spb);
                step++; next += spb;
            }
        }, 40);
    }

    stepAt(a, out, song, step, t, spb) {
        const bar = Math.floor(step / 16) % song.chords.length, s = step % 16;
        const ch = song.chords[bar];
        const barDur = spb * 16;
        // 和音・ベース
        if (s === 0) {
            INST.pad(a, out, t, ch.slice(1), barDur, song.name === 'riichi' ? 0.9 : song.name === 'oorasu' ? 1.15 : 1);
            if (song.bells && step % 64 === 0) INST.bell(a, out, t + spb * 2, ch[ch.length - 1] + 24, 4, 0.5);
        }
        if (song.bassPat) for (const [at, len, iv] of song.bassPat) if (s === at) INST.bass(a, out, t, ch[0] + (iv === 7 ? 7 : 0), len * spb);
        if (song.ostinato === 'pulse' && s % 2 === 0) INST.bass(a, out, t, ch[0] + (s % 4 ? 12 : 0), spb * 1.4, s % 4 ? 0.5 : 0.8);
        else if (song.ostinato && s % 2 === 0) {
            const pat = [0, 0, 12, 0, 10, 0, 12, 7];
            INST.bass(a, out, t, ch[0] + pat[(s / 2) % 8], spb * 1.6, 0.75);
        }
        // 分散和音（8分音符）
        if (song.arp && s % 2 === 0) {
            const tones = ch.slice(1);
            INST.pluck(a, out, t, tones[song.arp[(s / 2) % song.arp.length] % tones.length], 2, song.arpVel, spb);
        }
        // メロディー
        for (const n of song.notes) if (n.at === step) INST[song.lead](a, out, t, n.m, n.len, song.leadVel ?? 1, spb);
        // リズム
        if (song.drums === 'soft') { if (s === 0 || s === 8) INST.kick(a, out, t, 0.6); if (s % 4 === 2) INST.shaker(a, out, t, 0.8); }
        if (song.drums === 'calm') { if (s === 0) INST.kick(a, out, t, 0.45); if (s % 4 === 2) INST.hat(a, out, t, 0.6); }
        if (song.drums === 'oorasu') {
            // 太鼓：ドン・・ドン・ドン（3+3+2）、時計の チクタク、4小節ごとに たたみかける
            if (s === 0) INST.kick(a, out, t, 1); else if (s === 6) INST.kick(a, out, t, 0.6); else if (s === 10) INST.kick(a, out, t, 0.75);
            if (bar % 4 === 3 && s >= 12) INST.kick(a, out, t, 0.5 + (s - 12) * 0.15);
            if (s % 4 === 0) INST.hat(a, out, t, 0.7); else if (s % 2 === 0) INST.hat(a, out, t, 0.25);
        }
        if (song.drums === 'tense') { if (s % 8 === 0) INST.kick(a, out, t, 0.8); INST.hat(a, out, t, s % 4 === 2 ? 0.9 : 0.4); }
    }

    fadeOut(sec = 0.6) {
        if (!this.track) return;
        const g = this.track, a = g.context;
        g.gain.cancelScheduledValues(a.currentTime);
        g.gain.setTargetAtTime(0.0001, a.currentTime, sec / 4);
        setTimeout(() => { try { g.disconnect(); } catch (e) { /* むし */ } }, sec * 1000 + 600);
        this.track = null;
    }

    halt() {
        clearInterval(this.timer); this.timer = null;
        this.fadeOut(0.4);
    }

    /** 演出・読みあげの あいだ 小さく する（1 で もどる） */
    duck(level = 0.3) {
        this.duckLevel = level;
        if (!this.track) return;
        const a = this.track.context;
        this.track.gain.cancelScheduledValues(a.currentTime);
        this.track.gain.setTargetAtTime(Math.max(0.0001, level), a.currentTime, 0.15);
    }

    /** 設定が かわった とき */
    refresh() {
        applyVolumes();
        const n = this.name;
        if (!store.settings.bgm || !store.settings.sound) { this.halt(); return; }
        if (n && !this.timer) { this.name = null; this.play(n); }
    }
}

for (const [k, s] of Object.entries(SONGS)) s.name = k;

export const bgm = new Player();

/* ── 音量の 画面（設定・対局中の メニューで つかう） ── */

export function volumeHTML() {
    const s = store.settings;
    const row = (key, label, onKey) => `<div class="vol-row"><label>${label}</label>
${onKey ? `<button class="vol-on ${s[onKey] ? 'on' : ''}" data-von="${onKey}">${s[onKey] ? 'あり' : 'なし'}</button>` : '<span></span>'}
<input type="range" min="0" max="100" step="5" value="${Math.round(s[key] * 100)}" data-vol="${key}" aria-label="${label}の 音量"></div>`;
    return `<div class="vol-box">
${row('bgmVol', 'BGM', 'bgm')}
${row('seVol', '効果音', null)}
${row('voiceVol', 'こえ', 'voice')}
</div>`;
}

export function bindVolume(root, onChange = () => {}) {
    const box = root.querySelector('.vol-box');
    if (!box) return;
    box.addEventListener('input', e => {
        const r = e.target.closest('[data-vol]');
        if (!r) return;
        store.settings[r.dataset.vol] = Number(r.value) / 100;
        applyVolumes();
    });
    box.addEventListener('change', e => { if (e.target.closest('[data-vol]')) { save(); onChange(); } });
    box.addEventListener('click', e => {
        const b = e.target.closest('[data-von]');
        if (!b) return;
        const k = b.dataset.von;
        store.settings[k] = !store.settings[k];
        save();
        b.classList.toggle('on', store.settings[k]);
        b.textContent = store.settings[k] ? 'あり' : 'なし';
        bgm.refresh();
        onChange();
    });
}
