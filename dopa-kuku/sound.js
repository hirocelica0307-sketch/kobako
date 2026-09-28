/* ドパ九九 ── おと（効果音・BGM）
   音声ファイルは つかわず、Web Audio API で その場で 合成します。
   iPhone は 画面を さわるまで 音が 出ないので、「はじめる」を おした ときに unlock() を よびます。 */
(function (root) {
    'use strict';

    let ctx = null, out = null, sfx = null, bgmBus = null, noiseBuf = null;
    let soundOn = true, bgmOn = true;

    /* ドレミファソラシド（C6 から） */
    const C6 = 1046.5;
    const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    function unlock() {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        try {
            if (!ctx) {
                ctx = new AC();
                const comp = ctx.createDynamicsCompressor();
                comp.threshold.value = -14;
                comp.ratio.value = 6;
                out = ctx.createGain();
                out.gain.value = 0.9;
                sfx = ctx.createGain();
                sfx.gain.value = 0.7;
                bgmBus = ctx.createGain();
                bgmBus.gain.value = 0.3;
                sfx.connect(out);
                bgmBus.connect(out);
                out.connect(comp);
                comp.connect(ctx.destination);
                noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (ctx.state === 'suspended') ctx.resume();
            /* iPhone：音の ない 音を 1回 ならすと、そのあと 鳴るように なる */
            const s = ctx.createBufferSource();
            s.buffer = ctx.createBuffer(1, 1, 22050);
            s.connect(ctx.destination);
            s.start(0);
        } catch (e) { ctx = null; }
    }

    const ready = () => !!ctx && soundOn && ctx.state !== 'closed';
    const now = () => ctx.currentTime + 0.01;

    /* ---------- ぶひん ---------- */
    function tone(type, f, t, dur, vol, opt) {
        opt = opt || {};
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.glide || dur));
        if (opt.detune) o.detune.value = opt.detune;
        if (opt.vib) {
            const l = ctx.createOscillator(), lg = ctx.createGain();
            l.frequency.value = opt.vib[0];
            lg.gain.value = opt.vib[1];
            l.connect(lg);
            lg.connect(o.frequency);
            l.start(t);
            l.stop(t + dur + 0.05);
        }
        const a = opt.attack || 0.004;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + a);
        if (opt.hold) g.gain.setValueAtTime(vol, t + a + opt.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = o;
        if (opt.lp) {
            const f2 = ctx.createBiquadFilter();
            f2.type = 'lowpass';
            f2.frequency.setValueAtTime(opt.lp, t);
            if (opt.lpTo) f2.frequency.exponentialRampToValueAtTime(opt.lpTo, t + dur);
            o.connect(f2);
            node = f2;
        }
        node.connect(g);
        g.connect(opt.dest || sfx);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    function noise(t, dur, vol, type, freq, dest) {
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf;
        f.type = type;
        f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f);
        f.connect(g);
        g.connect(dest || sfx);
        s.start(t);
        s.stop(t + dur + 0.02);
    }

    /* ---------- 効果音 ---------- */
    /** ピッ（Lv0） */
    function pi() {
        if (!ready()) return;
        const t = now();
        tone('square', 1760, t, 0.08, 0.12);
        tone('sine', 3520, t, 0.06, 0.05);
    }

    /** ピコン（Lv1〜）：コンボごとに ドレミファソラシドと 上がる。chord で 和音「ピコーン」 */
    function pikon(step, chord) {
        if (!ready()) return;
        const t = now(), f = C6 * SCALE[((step % 8) + 8) % 8];
        tone('square', f, t, 0.06, 0.1);
        tone('square', f * 1.5, t + 0.06, chord ? 0.1 : 0.14, 0.1);
        if (chord) {
            [1, 1.26, 1.5, 2].forEach((k, i) => tone(i === 3 ? 'triangle' : 'sine', f * k, t + 0.07, 0.42, 0.06));
        }
    }

    /** キュイン（高速で 音程が かけあがる 電子音） */
    function kyuin(delay) {
        if (!ready()) return;
        const t = now() + (delay || 0);
        tone('sawtooth', 520, t, 0.3, 0.07, { to: 3400, glide: 0.15, vib: [28, 90], hold: 0.08 });
        tone('square', 1040, t, 0.3, 0.05, { to: 6800, glide: 0.15, vib: [28, 180], hold: 0.08 });
    }

    /** キュインキュイン（n 回 つづけて） */
    function kyuinKyuin(n) {
        for (let i = 0; i < (n || 2); i++) kyuin(i * 0.13);
    }

    /** ギュイーン（低い 音から 高い 音へ 長く 上がる） */
    function gyuin() {
        if (!ready()) return;
        const t = now();
        tone('sawtooth', 70, t, 0.95, 0.13, { to: 1900, glide: 0.8, lp: 400, lpTo: 6000, hold: 0.5 });
        tone('sawtooth', 72, t, 0.95, 0.1, { to: 1950, glide: 0.8, detune: 12, lp: 400, lpTo: 6000, hold: 0.5 });
    }

    /** ドンッ（重い 低音の 一撃） */
    function don(vol) {
        if (!ready()) return;
        const t = now(), v = vol == null ? 1 : vol;
        tone('sine', 150, t, 0.35, 0.55 * v, { to: 38, glide: 0.3 });
        tone('triangle', 90, t, 0.2, 0.25 * v, { to: 40, glide: 0.18 });
        noise(t, 0.14, 0.25 * v, 'lowpass', 900);
    }

    /** ファンファーレ（和音の 上がる フレーズ）。big で 長く はでに */
    function fanfare(big, delay) {
        if (!ready()) return;
        const t = now() + (delay || 0);
        const run = big ? [72, 76, 79, 84, 88, 91] : [72, 76, 79, 84];
        run.forEach((m, i) => {
            tone('square', mtof(m), t + i * 0.085, 0.14, 0.07);
            tone('triangle', mtof(m), t + i * 0.085, 0.16, 0.08);
        });
        const t2 = t + run.length * 0.085;
        const top = big ? [84, 88, 91, 96] : [84, 88, 91];
        const len = big ? 1.1 : 0.7;
        top.forEach(m => {
            tone('square', mtof(m), t2, len, 0.05, { hold: len * 0.5, detune: 6 });
            tone('triangle', mtof(m), t2, len, 0.07, { hold: len * 0.5 });
        });
        noise(t2, 0.5, 0.06, 'highpass', 6000);
    }

    /** ポン（ゲームオーバー。こわくない 短い 音） */
    function pon() {
        if (!ready()) return;
        const t = now();
        tone('triangle', 700, t, 0.22, 0.16, { to: 480, glide: 0.18 });
        tone('sine', 350, t, 0.25, 0.1, { to: 240, glide: 0.2 });
    }

    /** カウントダウン（3・2・1 と スタート） */
    function count(final) {
        if (!ready()) return;
        const t = now();
        if (final) {
            tone('square', 1320, t, 0.32, 0.1, { hold: 0.12 });
            tone('square', 1980, t, 0.32, 0.05, { hold: 0.12 });
        } else {
            tone('square', 880, t, 0.12, 0.09);
        }
    }

    /* ---------- BGM（Lv3 で ビート・Lv4 で メロディ・Lv5 で アップテンポ・Lv8 で キラキラ） ---------- */
    const ROOTS = [45, 41, 43, 40];                                   /* Am F G E */
    const CHORDS = [[69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 68, 71]];
    const BASS = [0, 0, 12, 0, 0, 12, 7, 12];
    const MELO = [
        { 0: 81, 2: 84, 4: 88, 6: 86, 7: 84, 8: 83, 10: 84, 12: 81 },
        { 0: 77, 2: 81, 4: 84, 6: 81, 8: 84, 10: 86, 12: 84, 14: 81 },
        { 0: 79, 2: 83, 4: 86, 6: 83, 8: 86, 10: 88, 12: 86, 14: 83 },
        { 0: 80, 2: 83, 4: 88, 6: 83, 8: 86, 10: 84, 12: 83, 14: 80 },
    ];
    const bgm = { on: false, timer: 0, next: 0, step: 0, lv: 0 };

    function bgmStep(t, step, dur) {
        const bar = Math.floor(step / 16) % 4, s = step % 16, lv = bgm.lv, fast = lv >= 5;
        const B = bgmBus;
        /* キック */
        if (s % 4 === 0) {
            tone('sine', 140, t, 0.22, 0.5, { to: 42, glide: 0.16, dest: B });
        }
        /* ハイハット */
        if (s % 4 === 2) noise(t, 0.05, 0.12, 'highpass', 7000, B);
        else if (fast && s % 2 === 1) noise(t, 0.03, 0.05, 'highpass', 8000, B);
        /* クラップ（アップテンポ から） */
        if (fast && (s === 4 || s === 12)) noise(t, 0.12, 0.2, 'bandpass', 1500, B);
        /* ベース */
        if (s % 2 === 0) {
            tone('sawtooth', mtof(ROOTS[bar] + BASS[s / 2]), t, dur * 1.8, 0.1, { lp: 900, dest: B });
        }
        /* メロディ */
        if (lv >= 4) {
            const m = MELO[bar][s];
            if (m) {
                tone('square', mtof(m), t, dur * 1.7, 0.05, { dest: B, hold: dur * 0.8 });
                tone('triangle', mtof(m - 12), t, dur * 1.7, 0.04, { dest: B });
            }
        }
        /* キラキラ（虹ドパ） */
        if (lv >= 8) {
            const c = CHORDS[bar];
            tone('triangle', mtof(c[s % 3] + 24), t, dur * 0.9, 0.035, { dest: B });
        }
    }

    function bgmLoop() {
        if (!bgm.on || !ctx) return;
        const bpm = bgm.lv >= 5 ? 152 : 124;
        const dur = 60 / bpm / 4;
        while (bgm.next < ctx.currentTime + 0.12) {
            if (soundOn && bgmOn) bgmStep(bgm.next, bgm.step, dur);
            bgm.next += dur;
            bgm.step = (bgm.step + 1) % 64;
        }
    }

    /** レベルに あわせて BGM を かえる（Lv3 未満は 止める） */
    function bgmLevel(lv) {
        bgm.lv = lv;
        if (lv < 3) { bgmStop(); return; }
        if (!ctx || bgm.on) return;
        bgm.on = true;
        bgm.step = 0;
        bgm.next = ctx.currentTime + 0.05;
        bgmBus.gain.cancelScheduledValues(ctx.currentTime);
        bgmBus.gain.setValueAtTime(0.3, ctx.currentTime);
        bgm.timer = setInterval(bgmLoop, 25);
        bgmLoop();
    }

    function bgmStop() {
        bgm.on = false;
        clearInterval(bgm.timer);
        bgm.timer = 0;
    }

    /** ため（BGM だけ ms の あいだ 無音に） */
    function hush(ms) {
        if (!ctx) return;
        const t = ctx.currentTime;
        bgmBus.gain.cancelScheduledValues(t);
        bgmBus.gain.setValueAtTime(0.0001, t);
        bgmBus.gain.setValueAtTime(0.0001, t + ms / 1000);
        bgmBus.gain.linearRampToValueAtTime(0.3, t + ms / 1000 + 0.08);
    }

    /** タブを かくした ときは 止める */
    function pause(hidden) {
        if (!ctx) return;
        try { if (hidden) ctx.suspend(); else ctx.resume(); } catch (e) { /* なにも しない */ }
    }

    function setSound(on) { soundOn = !!on; }
    function setBgm(on) { bgmOn = !!on; }

    root.DopaSound = {
        unlock, setSound, setBgm, pause,
        pi, pikon, kyuin, kyuinKyuin, gyuin, don, fanfare, pon, count,
        bgmLevel, bgmStop, hush,
    };
})(window);
