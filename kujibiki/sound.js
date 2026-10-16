/* くじびき ひろば ── おと
   音声ファイルは つかわず、Web Audio API で その場で 合成します（ネットが なくても 鳴る）。
   iPhone などは 画面を さわるまで 音が 出ないので、さいしょの タップで unlock() します。
   ながく 鳴る 音（ドラムロール・導火線・ガラガラ）は start〜() が「とめる 関数」を かえします。 */
(function (root) {
    'use strict';

    let ctx = null, out = null, noiseBuf = null;
    let on = true;

    function unlock() {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        try {
            if (!ctx) {
                ctx = new AC();
                const comp = ctx.createDynamicsCompressor();
                comp.threshold.value = -12; comp.ratio.value = 5;
                out = ctx.createGain(); out.gain.value = 0.8;
                out.connect(comp); comp.connect(ctx.destination);
                noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) { /* 音が 出なくても くじは 動く */ }
    }
    const ready = () => on && ctx && ctx.state === 'running';
    const now = () => ctx.currentTime;

    /* ---------- 部品 ---------- */
    function tone(freq, t0, dur, o) {
        o = o || {};
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.slide || dur));
        if (o.detune) osc.detune.value = o.detune;
        const v = o.vol == null ? 0.3 : o.vol;
        const a = o.attack || 0.005;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(v, t0 + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        let node = osc;
        if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
        node.connect(g); g.connect(o.dest || out);
        osc.start(t0); osc.stop(t0 + dur + 0.05);
        return osc;
    }
    function noise(t0, dur, o) {
        o = o || {};
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = o.type || 'bandpass';
        f.frequency.setValueAtTime(o.freq || 3000, t0);
        if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
        f.Q.value = o.q == null ? 1 : o.q;
        const g = ctx.createGain();
        const v = o.vol == null ? 0.3 : o.vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(v, t0 + (o.attack || 0.003));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(o.dest || out);
        src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
    }
    /** くりかえし 鳴らす 音。step(t) が つぎの 間かく（びょう）を かえす。とめる 関数を かえす */
    function loop(step) {
        if (!ready()) return () => {};
        let alive = true, next = now() + 0.02;
        const timer = setInterval(() => {
            if (!alive) return;
            if (!on) { next = now() + 0.05; return; }
            while (next < now() + 0.12) {
                const dt = step(next);
                next += Math.max(0.008, dt);
            }
        }, 30);
        return () => { alive = false; clearInterval(timer); };
    }

    const SFX = {
        /* ルーレットの はりが ピンに あたる カチッ */
        tick(o) {
            const t = now();
            tone(1800 + Math.random() * 300, t, 0.035, { type: 'square', vol: 0.08 * ((o && o.vol) || 1), lp: 4000 });
            noise(t, 0.02, { freq: 5000, q: 2, vol: 0.12 * ((o && o.vol) || 1) });
        },
        /* ジャーン（シンバル）＋ 低い ドン */
        crash() {
            const t = now();
            noise(t, 1.6, { type: 'highpass', freq: 5000, q: 0.5, vol: 0.35 });
            noise(t, 0.6, { freq: 2500, q: 0.8, vol: 0.25 });
            tone(90, t, 0.5, { vol: 0.5, to: 45 });
        },
        /* ファンファーレ。big で ながく 豪華に */
        fanfare(big) {
            const t = now();
            const dest = out;
            const notes = big ? [523.3, 659.3, 784, 1046.5, 784, 1046.5] : [523.3, 659.3, 784, 1046.5];
            const dts = big ? [0, 0.12, 0.24, 0.36, 0.56, 0.68] : [0, 0.1, 0.2, 0.3];
            notes.forEach((f, i) => {
                tone(f, t + dts[i], 0.25, { type: 'sawtooth', vol: 0.12, lp: 3000, dest });
                tone(f * 1.003, t + dts[i], 0.25, { type: 'square', vol: 0.05, lp: 2500, dest });
            });
            const end = t + dts[dts.length - 1] + 0.14;
            const chord = big ? [523.3, 659.3, 784, 1046.5, 1318.5] : [523.3, 659.3, 784, 1046.5];
            chord.forEach(f => {
                tone(f, end, big ? 1.8 : 1.1, { type: 'sawtooth', vol: 0.07, lp: 2600, attack: 0.02 });
                tone(f * 2, end, big ? 1.8 : 1.1, { type: 'triangle', vol: 0.05, attack: 0.02 });
            });
            if (big) for (let i = 0; i < 10; i++) tone(2000 + Math.random() * 2500, end + 0.1 + i * 0.07, 0.25, { type: 'triangle', vol: 0.05 });
        },
        /* ピンポーン（ふつうの けっか） */
        ding() {
            const t = now();
            tone(1318.5, t, 0.6, { type: 'triangle', vol: 0.25 });
            tone(1046.5, t + 0.18, 0.9, { type: 'triangle', vol: 0.25 });
        },
        /* ぽわわ〜ん（はずれ） */
        lose() {
            const t = now();
            const o = tone(392, t, 1.1, { type: 'triangle', vol: 0.25, to: 180, slide: 1.0 });
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 7; lg.gain.value = 18;
            lfo.connect(lg); lg.connect(o.frequency);
            lfo.start(t); lfo.stop(t + 1.2);
            tone(196, t, 1.1, { type: 'sine', vol: 0.15, to: 90, slide: 1.0 });
        },
        /* ドカーン */
        boom() {
            const t = now();
            tone(120, t, 1.2, { vol: 0.8, to: 30, slide: 0.9 });
            noise(t, 1.4, { type: 'lowpass', freq: 1800, to: 120, q: 0.7, vol: 0.9 });
            noise(t, 0.25, { freq: 3000, q: 0.6, vol: 0.5 });
            for (let i = 0; i < 12; i++) noise(t + 0.15 + Math.random() * 0.9, 0.03, { freq: 2500 + Math.random() * 3000, q: 3, vol: 0.15 });
        },
        /* ポン（玉・カプセルが 出る / カードが とぶ） */
        pop(pitch) {
            const t = now();
            const f = (pitch || 1) * 520;
            tone(f, t, 0.12, { vol: 0.35, to: f * 2.2, slide: 0.06 });
            noise(t, 0.05, { freq: 1500, q: 1.5, vol: 0.12 });
        },
        /* シュッ */
        whoosh() {
            const t = now();
            noise(t, 0.35, { freq: 600, to: 4000, q: 1.2, vol: 0.25, attack: 0.08 });
        },
        /* キラーン */
        sparkle() {
            const t = now();
            [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, t + i * 0.05, 0.4, { type: 'triangle', vol: 0.08 }));
        },
        /* シャカシャカ（おみくじの 箱を 1回 ふる） */
        shaka(strength) {
            const t = now();
            const s = strength || 1;
            for (let i = 0; i < 7; i++) {
                const tt = t + i * 0.012 + Math.random() * 0.02;
                noise(tt, 0.05 + Math.random() * 0.05, { freq: 1800 + Math.random() * 2500, q: 4, vol: 0.12 * s });
                tone(700 + Math.random() * 900, tt, 0.04, { type: 'triangle', vol: 0.05 * s });
            }
        },
        /* カラン（おみくじの 棒が 出る） */
        karan() {
            const t = now();
            [880, 1320, 990].forEach((f, i) => tone(f, t + i * 0.07, 0.35, { type: 'triangle', vol: 0.18 }));
            noise(t, 0.06, { freq: 2200, q: 3, vol: 0.15 });
        },
        /* カチッ（ガチャの ハンドル） */
        kachi() {
            const t = now();
            tone(300, t, 0.06, { type: 'square', vol: 0.12, lp: 1500 });
            noise(t, 0.04, { freq: 1200, q: 3, vol: 0.25 });
        },
        /* チクタク */
        tickTock(high) {
            const t = now();
            tone(high ? 1500 : 1100, t, 0.05, { type: 'square', vol: 0.09, lp: 3500 });
            noise(t, 0.02, { freq: high ? 4000 : 3000, q: 3, vol: 0.15 });
        },
        /* ジャジャン（めくる） */
        reveal() {
            const t = now();
            [[392, 0], [523.3, 0.13]].forEach(([f, d]) => {
                tone(f, t + d, 0.3, { type: 'sawtooth', vol: 0.12, lp: 2200 });
                tone(f / 2, t + d, 0.3, { type: 'square', vol: 0.06, lp: 1200 });
            });
        },
        /* リーチ！（あがっていく 音） */
        reach() {
            const t = now();
            tone(300, t, 0.9, { type: 'sawtooth', vol: 0.12, to: 1400, slide: 0.8, lp: 3000 });
            tone(302, t, 0.9, { type: 'square', vol: 0.05, to: 1410, slide: 0.8, lp: 2500 });
        },
    };

    /* ---------- ながく 鳴る 音 ---------- */

    /** ドラムロール。とめる 関数を かえす（とめた ときに ジャーンは 鳴らさない） */
    function startDrumroll() {
        let k = 0;
        return loop(t => {
            k++;
            const accent = 0.6 + 0.4 * Math.min(1, k / 60);
            noise(t, 0.07, { freq: 1800 + Math.random() * 400, q: 0.9, vol: 0.18 * accent });
            tone(180, t, 0.05, { vol: 0.08 * accent, to: 120 });
            return 0.045 + Math.random() * 0.006;
        });
    }

    /** 導火線の パチパチ */
    function startCrackle() {
        if (!ready()) return () => {};
        // シューッ（ずっと）
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4500; f.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        g.gain.linearRampToValueAtTime(0.08, now() + 0.2);
        src.connect(f); f.connect(g); g.connect(out); src.start();
        const stopPops = loop(t => {
            const big = Math.random() < 0.18;
            noise(t, big ? 0.03 : 0.012, { freq: 2000 + Math.random() * 5000, q: 2 + Math.random() * 4, vol: big ? 0.35 : 0.12 + Math.random() * 0.12 });
            return 0.015 + Math.random() * 0.07;
        });
        return () => {
            stopPops();
            try { g.gain.cancelScheduledValues(now()); g.gain.setValueAtTime(g.gain.value, now()); g.gain.linearRampToValueAtTime(0.0001, now() + 0.15); src.stop(now() + 0.2); } catch (e) { /* もう とまって いる */ }
        };
    }

    /** 光の 玉の キラキラ */
    function startShimmer() {
        const scale = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349, 2637];
        let i = 0;
        return loop(t => {
            i = (i + 1 + Math.floor(Math.random() * 3)) % scale.length;
            tone(scale[i], t, 0.25, { type: 'triangle', vol: 0.05 });
            return 0.07 + Math.random() * 0.04;
        });
    }

    /** ガラガラ（ビンゴの 機械・ガチャ）。speed() で はやさ 0〜1 を かえせる */
    function startRattle(speed) {
        return loop(t => {
            const s = Math.max(0.15, speed ? speed() : 1);
            const n = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
                const tt = t + Math.random() * 0.02;
                noise(tt, 0.03, { freq: 1200 + Math.random() * 1800, q: 6, vol: 0.13 * s });
                tone(500 + Math.random() * 700, tt, 0.03, { type: 'triangle', vol: 0.05 * s });
            }
            return (0.03 + Math.random() * 0.05) / s;
        });
    }

    function play(name, arg) {
        if (!ready() || !SFX[name]) return;
        try { SFX[name](arg); } catch (e) { /* 音が 出なくても くじは 動く */ }
    }
    function setOn(v) { on = !!v; }

    root.KujiSound = {
        unlock, play, setOn, isOn: () => on,
        startDrumroll, startCrackle, startShimmer, startRattle,
    };
})(typeof window !== 'undefined' ? window : globalThis);
