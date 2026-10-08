/* 九九ラン ── 音と よみあげ
   効果音は Web Audio で その場で つくります（音の ファイルは ありません）。
   よみあげは ブラウザの 音声合成（日本語の 声）を つかいます。 */
(function (root) {
    'use strict';

    let ctx = null, master = null, noiseBuf = null;
    let soundOn = true, voiceOn = true;

    /** さいしょの タップで よぶ（スマホは タップの 中でないと 音が 出ない） */
    function unlock() {
        if (!ctx) {
            const AC = root.AudioContext || root.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.55;
            master.connect(ctx.destination);
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        pickVoice();
    }

    function tone(freq, start, dur, type, vol, slideTo) {
        if (!ctx || !soundOn) return;
        const t0 = ctx.currentTime + (start || 0);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.02);
    }

    function noise(start, dur, vol, freq, q) {
        if (!ctx || !soundOn) return;
        const t0 = ctx.currentTime + (start || 0);
        const s = ctx.createBufferSource();
        s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq || 1200;
        f.Q.value = q || 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol || 0.3, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(master);
        s.start(t0); s.stop(t0 + dur + 0.02);
    }

    const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319, 1397, 1568];

    const sfx = {
        move() { tone(880, 0, 0.05, 'triangle', 0.08); },
        count() { tone(660, 0, 0.12, 'square', 0.12); },
        go() { tone(990, 0, 0.25, 'square', 0.14); tone(1320, 0.05, 0.25, 'square', 0.08); },
        /** 正解（れんぞくで 音が 上がる） */
        good(combo) {
            noise(0, 0.12, 0.25, 2200, 0.7);
            const f = SCALE[Math.min(SCALE.length - 1, Math.max(0, combo - 1) % SCALE.length)];
            tone(f, 0.01, 0.16, 'square', 0.12);
            tone(f * 1.5, 0.06, 0.18, 'triangle', 0.1);
        },
        flash() {
            [0, 0.07, 0.14, 0.21].forEach((s, i) => tone(784 * Math.pow(1.26, i), s, 0.16, 'square', 0.1));
        },
        miss() {
            noise(0, 0.45, 0.5, 300, 0.6);
            tone(330, 0.02, 0.5, 'sawtooth', 0.16, 90);
        },
        end() {
            [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.14));
        },
        clear() {
            [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.35, 'square', 0.1));
        },
    };

    /* ---------- よみあげ ---------- */
    let voice = null;
    function pickVoice() {
        const ss = root.speechSynthesis;
        if (!ss || voice) return;
        const vs = ss.getVoices() || [];
        voice = vs.find(v => /^ja/i.test(v.lang) && /Kyoko|O-ren|Google/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
    }
    if (root.speechSynthesis && 'onvoiceschanged' in root.speechSynthesis) {
        root.speechSynthesis.addEventListener('voiceschanged', () => { voice = null; pickVoice(); });
    }

    /** text を よむ（まえの よみあげは とめる） */
    function speak(text, rate) {
        const ss = root.speechSynthesis;
        if (!ss || !voiceOn || !text) return;
        try {
            ss.cancel();
            const u = new root.SpeechSynthesisUtterance(text);
            u.lang = 'ja-JP';
            if (voice) u.voice = voice;
            u.rate = rate || 1.1;
            u.pitch = 1.1;
            ss.speak(u);
        } catch (e) { /* よめない ブラウザでは なにも しない */ }
    }
    function hush() {
        try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) { /* なし */ }
    }

    root.KukuRunSound = {
        unlock, sfx, speak, hush,
        setSound(v) { soundOn = !!v; },
        setVoice(v) { voiceOn = !!v; if (!v) hush(); },
    };
})(window);
