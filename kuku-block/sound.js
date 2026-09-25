/* ブロック おはじき ── おと と よみあげ
   ------------------------------------------------------------------
   こうかおんは その場で つくります（おとの ファイルは いりません）。
   よみあげは ブラウザの 音声（speechSynthesis・日本語）を つかいます。
   せっていの「おと」が オフの ときは なにも ならしません。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    let enabled = true;
    let ac = null;

    function audio() {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ac = new AC();
        }
        if (ac.state === 'suspended') ac.resume();
        return ac;
    }

    function tone(freq, dur, type, vol, when, slide) {
        const a = audio();
        if (!a) return;
        const t = a.currentTime + (when || 0);
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(a.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    const fx = {
        pop() { tone(660, 0.08, 'sine', 0.1, 0, 880); },
        flip() { tone(520, 0.06, 'triangle', 0.08); tone(780, 0.06, 'triangle', 0.08, 0.05); },
        loop() { tone(523, 0.1, 'sine', 0.09); tone(784, 0.14, 'sine', 0.09, 0.08); },
        trash() { tone(300, 0.18, 'triangle', 0.1, 0, 120); },
        count() { tone(880, 0.07, 'sine', 0.08); },
        up() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'sine', 0.08, i * 0.07)); },
    };

    let jaVoice = null;
    function pickVoice() {
        try {
            const vs = speechSynthesis.getVoices();
            jaVoice = vs.find(v => /^ja/i.test(v.lang) && /google/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
        } catch (e) { jaVoice = null; }
    }
    if ('speechSynthesis' in window) {
        pickVoice();
        speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice);
    }

    function speak(text) {
        if (!enabled || !('speechSynthesis' in window)) return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ja-JP';
            if (jaVoice) u.voice = jaVoice;
            u.rate = 1;
            speechSynthesis.speak(u);
        } catch (e) { /* よめなくても うごく */ }
    }

    const api = { speak, setEnabled(v) { enabled = !!v; if (!enabled && 'speechSynthesis' in window) speechSynthesis.cancel(); } };
    for (const k of Object.keys(fx)) api[k] = () => { if (enabled) { try { fx[k](); } catch (e) { /* むおんでも よい */ } } };
    root.KukuSound = api;
})(window);
