/* ドパ九九 ── おと（効果音・BGM）
   音声ファイルは つかわず、Web Audio API で 合成します。
   ------------------------------------------------------------------
   音が とぎれない ための しくみ
   - さいしょに ボタンを おした とき（unlock）、効果音と BGM を ぜんぶ OfflineAudioContext で
     「音の データ（AudioBuffer）」に して おく（prerender）
   - 鳴らす ときは その データを 1つ 流すだけ。1回の 音で 何十こも 部品を 作らないので かるい
   - BGM は 4小節の データを ループ再生する。ループは 音の 専用スレッドが うけもつので、
     画面の 処理が いそがしくても BGM は とぎれない
   - データが まだ できて いない さいしょの 数びょうだけ、その場で 合成して 鳴らす
   iPhone は 画面を さわるまで 音が 出ないので、「はじめる」を おした ときに unlock() を よびます。
   ------------------------------------------------------------------ */
(function (root) {
    'use strict';

    let ctx = null, out = null, sfx = null, bgmBus = null;
    let soundOn = true, bgmOn = true;
    const BGM_VOL = 0.3;

    /* ドレミファソラシド（C6 から） */
    const C6 = 1046.5;
    const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    /* いま 音を かきこむ 先（本番の ctx か、データ作りの OfflineAudioContext） */
    const R = { c: null, dest: null, noise: null };

    function makeNoise(c) {
        const b = c.createBuffer(1, Math.round(c.sampleRate * 0.6), c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

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
                bgmBus.gain.value = BGM_VOL;
                sfx.connect(out);
                bgmBus.connect(out);
                out.connect(comp);
                comp.connect(ctx.destination);
                R.c = ctx;
                R.dest = sfx;
                R.noise = makeNoise(ctx);
                applyBgmVol();
                setTimeout(prerender, 0);
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

    /* ---------- 合成の ぶひん（R.c に かきこむ） ---------- */
    function tone(type, f, t, dur, vol, opt) {
        opt = opt || {};
        const c = R.c;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.glide || dur));
        if (opt.detune) o.detune.value = opt.detune;
        if (opt.vib) {
            const l = c.createOscillator(), lg = c.createGain();
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
            const f2 = c.createBiquadFilter();
            f2.type = 'lowpass';
            f2.frequency.setValueAtTime(opt.lp, t);
            if (opt.lpTo) f2.frequency.exponentialRampToValueAtTime(opt.lpTo, t + dur);
            o.connect(f2);
            node = f2;
        }
        node.connect(g);
        g.connect(R.dest);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    function noise(t, dur, vol, type, freq) {
        const c = R.c;
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = R.noise;
        f.type = type;
        f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f);
        f.connect(g);
        g.connect(R.dest);
        s.start(t);
        s.stop(t + dur + 0.02);
    }

    /* ---------- 効果音の レシピ（t から 鳴らす） ---------- */
    const RECIPE = {
        /* ピッ（Lv0） */
        pi(t) {
            tone('square', 1760, t, 0.08, 0.12);
            tone('sine', 3520, t, 0.06, 0.05);
        },
        /* キュイン（高速で 音程が かけあがる 電子音） */
        kyuin(t) {
            tone('sawtooth', 520, t, 0.3, 0.07, { to: 3400, glide: 0.15, vib: [28, 90], hold: 0.08 });
            tone('square', 1040, t, 0.3, 0.05, { to: 6800, glide: 0.15, vib: [28, 180], hold: 0.08 });
        },
        /* ギュイーン（低い 音から 高い 音へ 長く 上がる） */
        gyuin(t) {
            tone('sawtooth', 70, t, 0.95, 0.13, { to: 1900, glide: 0.8, lp: 400, lpTo: 6000, hold: 0.5 });
            tone('sawtooth', 72, t, 0.95, 0.1, { to: 1950, glide: 0.8, detune: 12, lp: 400, lpTo: 6000, hold: 0.5 });
        },
        /* ドンッ（重い 低音の 一撃） */
        don(t) {
            tone('sine', 150, t, 0.35, 0.55, { to: 38, glide: 0.3 });
            tone('triangle', 90, t, 0.2, 0.25, { to: 40, glide: 0.18 });
            noise(t, 0.14, 0.25, 'lowpass', 900);
        },
        /* ファンファーレ（和音の 上がる フレーズ） */
        fanfare(t) { fanfareAt(t, false); },
        fanfareBig(t) { fanfareAt(t, true); },
        /* ポン（ゲームオーバー。こわくない 短い 音） */
        pon(t) {
            tone('triangle', 700, t, 0.22, 0.16, { to: 480, glide: 0.18 });
            tone('sine', 350, t, 0.25, 0.1, { to: 240, glide: 0.2 });
        },
        count(t) { tone('square', 880, t, 0.12, 0.09); },
        countGo(t) {
            tone('square', 1320, t, 0.32, 0.1, { hold: 0.12 });
            tone('square', 1980, t, 0.32, 0.05, { hold: 0.12 });
        },
    };
    /* ピコン（Lv1〜）：ドレミファソラシドの 8だん × 和音 なし／あり */
    for (let s = 0; s < 8; s++) {
        RECIPE['pikon' + s] = t => pikonAt(t, s, false);
        RECIPE['pikonC' + s] = t => pikonAt(t, s, true);
    }

    function pikonAt(t, step, chord) {
        const f = C6 * SCALE[step];
        tone('square', f, t, 0.06, 0.1);
        tone('square', f * 1.5, t + 0.06, chord ? 0.1 : 0.14, 0.1);
        if (chord) [1, 1.26, 1.5, 2].forEach((k, i) => tone(i === 3 ? 'triangle' : 'sine', f * k, t + 0.07, 0.42, 0.06));
    }

    function fanfareAt(t, big) {
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

    /* ---------- BGM の レシピ（4小節。Lv3 ビート・Lv4 メロディ・Lv5 アップテンポ・Lv8 キラキラ） ---------- */
    const ROOTS = [45, 41, 43, 40];                                   /* Am F G E */
    const CHORDS = [[69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 68, 71]];
    const BASS = [0, 0, 12, 0, 0, 12, 7, 12];
    const MELO = [
        { 0: 81, 2: 84, 4: 88, 6: 86, 7: 84, 8: 83, 10: 84, 12: 81 },
        { 0: 77, 2: 81, 4: 84, 6: 81, 8: 84, 10: 86, 12: 84, 14: 81 },
        { 0: 79, 2: 83, 4: 86, 6: 83, 8: 86, 10: 88, 12: 86, 14: 83 },
        { 0: 80, 2: 83, 4: 88, 6: 83, 8: 86, 10: 84, 12: 83, 14: 80 },
    ];
    const BGM = {
        b3: { lv: 3, bpm: 124 },
        b4: { lv: 4, bpm: 124 },
        b5: { lv: 5, bpm: 152 },
        b8: { lv: 8, bpm: 152 },
    };
    const bgmKeyOf = lv => (lv >= 8 ? 'b8' : lv >= 5 ? 'b5' : lv >= 4 ? 'b4' : 'b3');
    const stepDur = key => 60 / BGM[key].bpm / 4;

    function bgmStep(t, step, dur, lv) {
        const bar = Math.floor(step / 16) % 4, s = step % 16, fast = lv >= 5;
        if (s % 4 === 0) tone('sine', 140, t, 0.22, 0.5, { to: 42, glide: 0.16 });            /* キック */
        if (s % 4 === 2) noise(t, 0.05, 0.12, 'highpass', 7000);                            /* ハイハット */
        else if (fast && s % 2 === 1) noise(t, 0.03, 0.05, 'highpass', 8000);
        if (fast && (s === 4 || s === 12)) noise(t, 0.12, 0.2, 'bandpass', 1500);           /* クラップ */
        if (s % 2 === 0) tone('sawtooth', mtof(ROOTS[bar] + BASS[s / 2]), t, dur * 1.8, 0.1, { lp: 900 });   /* ベース */
        if (lv >= 4) {                                                                     /* メロディ */
            const m = MELO[bar][s];
            if (m) {
                tone('square', mtof(m), t, dur * 1.7, 0.05, { hold: dur * 0.8 });
                tone('triangle', mtof(m - 12), t, dur * 1.7, 0.04);
            }
        }
        if (lv >= 8) tone('triangle', mtof(CHORDS[bar][s % 3] + 24), t, dur * 0.9, 0.035);     /* キラキラ */
    }

    /* ---------- データ作り（OfflineAudioContext） ---------- */
    const buf = {};
    const LEN = { gyuin: 1.1, fanfare: 1.2, fanfareBig: 1.9, don: 0.45, kyuin: 0.4 };

    /** recipe を seconds びょうぶんの 音の データに する */
    function renderBuffer(seconds, recipe) {
        const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
        if (!OAC || !ctx) return Promise.resolve(null);
        const sr = ctx.sampleRate;
        const off = new OAC(1, Math.ceil(seconds * sr), sr);
        const saved = { c: R.c, dest: R.dest, noise: R.noise };
        R.c = off;
        R.dest = off.destination;                  /* 雑音の データは 本番と おなじ ものを つかいまわす */
        try { recipe(0); } finally { Object.assign(R, saved); }
        return new Promise(resolve => {
            try {
                const p = off.startRendering();
                if (p && p.then) p.then(resolve, () => resolve(null));
                else off.oncomplete = e => resolve(e.renderedBuffer);
            } catch (e) { resolve(null); }
        });
    }

    const pauseTick = () => new Promise(r => setTimeout(r, 0));

    /** BGM は 1小節ずつ 作って（1回の 処理を みじかく して 画面を とめない）、4小節の ループに つなぐ。
        小節の さいごから はみ出した ひびきは つぎの 小節（4小節めは あたま）に かさねる */
    async function renderBgm(key) {
        const dur = stepDur(key), bar = dur * 16, loopLen = bar * 4;
        const n = Math.round(loopLen * ctx.sampleRate);
        const o = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = o.getChannelData(0);
        for (let b = 0; b < 4; b++) {
            const part = await renderBuffer(bar + 0.6, t => {
                for (let i = 0; i < 16; i++) bgmStep(t + i * dur, b * 16 + i, dur, BGM[key].lv);
            });
            if (!part) return;
            const src = part.getChannelData(0), at = Math.round(b * bar * ctx.sampleRate);
            for (let i = 0; i < src.length; i++) d[(at + i) % n] += src[i];
            await pauseTick();
        }
        buf[key] = o;
    }

    let prerendered = false;
    async function prerender() {
        if (prerendered || !ctx) return;
        prerendered = true;
        for (const name of Object.keys(RECIPE)) {
            const b = await renderBuffer(LEN[name.replace(/\d+$/, '')] || 0.7, RECIPE[name]);
            if (b) buf[name] = b;
            await pauseTick();
        }
        for (const key of Object.keys(BGM)) {
            await renderBgm(key);
            if (bgm.want === key) bgmLevel(bgm.lv, true);
        }
    }

    /* ---------- 鳴らす ---------- */
    let voices = 0;
    const MAX_VOICES = 12;

    /** データが あれば それを 流す。なければ その場で 合成（さいしょの 数びょうだけ） */
    function play(name, delay, vol, important) {
        if (!ready()) return;
        if (!important && voices >= MAX_VOICES) return;     /* 重なりすぎる ときは 小さい 音を はぶく */
        const t = now() + (delay || 0);
        const b = buf[name];
        const g = ctx.createGain();
        g.gain.value = vol == null ? 1 : vol;
        g.connect(sfx);
        if (b) {
            const s = ctx.createBufferSource();
            s.buffer = b;
            s.connect(g);
            voices++;
            s.onended = () => { voices--; g.disconnect(); };
            s.start(t);
        } else {
            R.dest = g;
            try { RECIPE[name](t); } finally { R.dest = sfx; }
        }
    }

    const pi = () => play('pi');
    /** ピコン：コンボごとに ドレミファソラシドと 上がる。chord で 和音「ピコーン」 */
    const pikon = (step, chord) => play((chord ? 'pikonC' : 'pikon') + (((step % 8) + 8) % 8));
    const kyuin = delay => play('kyuin', delay);
    const kyuinKyuin = n => { for (let i = 0; i < (n || 2); i++) play('kyuin', i * 0.13, 1, i === 0); };
    const gyuin = () => play('gyuin', 0, 1, true);
    const don = vol => play('don', 0, vol == null ? 1 : vol);
    const fanfare = (big, delay) => play(big ? 'fanfareBig' : 'fanfare', delay, 1, true);
    const pon = () => play('pon', 0, 1, true);
    const count = final => play(final ? 'countGo' : 'count', 0, 1, true);

    /* ---------- BGM（データを ループ再生） ---------- */
    const bgm = { src: null, key: null, startAt: 0, lv: 0, want: null };

    function bgmLevel(lv, retry) {
        bgm.lv = lv;
        if (lv < 3) { bgmStop(); return; }
        const key = bgmKeyOf(lv);
        if (!ctx || (bgm.key === key && bgm.src && !retry)) return;
        const b = buf[key];
        if (!b) { bgm.want = key; return; }               /* まだ できて いない → できたら 鳴らす */
        bgm.want = null;
        const t = ctx.currentTime + 0.03;
        /* おなじ テンポなら いまの 位置から つづける（メロディが 足されても 拍が ずれない） */
        let offset = 0;
        if (bgm.src && BGM[bgm.key].bpm === BGM[key].bpm) offset = (t - bgm.startAt) % b.duration;
        stopSrc(t);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.loop = true;
        s.connect(bgmBus);
        s.start(t, offset);
        bgm.src = s;
        bgm.key = key;
        bgm.startAt = t - offset;
    }

    function stopSrc(t) {
        if (!bgm.src) return;
        try { bgm.src.stop(t); } catch (e) { /* もう とまって いる */ }
        bgm.src = null;
    }

    function bgmStop() {
        bgm.want = null;
        bgm.key = null;
        if (ctx) stopSrc(ctx.currentTime);
    }

    const bgmTarget = () => (soundOn && bgmOn ? BGM_VOL : 0);
    function applyBgmVol() {
        if (!ctx) return;
        const t = ctx.currentTime;
        bgmBus.gain.cancelScheduledValues(t);
        bgmBus.gain.setValueAtTime(bgmTarget(), t);
    }

    /** ため（BGM だけ ms の あいだ 無音に） */
    function hush(ms) {
        if (!ctx) return;
        const t = ctx.currentTime;
        bgmBus.gain.cancelScheduledValues(t);
        bgmBus.gain.setValueAtTime(0, t);
        bgmBus.gain.setValueAtTime(0, t + ms / 1000);
        bgmBus.gain.linearRampToValueAtTime(bgmTarget(), t + ms / 1000 + 0.08);
    }

    /** タブを かくした ときは 止める */
    function pause(hidden) {
        if (!ctx) return;
        try { if (hidden) ctx.suspend(); else ctx.resume(); } catch (e) { /* なにも しない */ }
    }

    function setSound(on) { soundOn = !!on; applyBgmVol(); }
    function setBgm(on) { bgmOn = !!on; applyBgmVol(); }

    root.DopaSound = {
        unlock, setSound, setBgm, pause,
        pi, pikon, kyuin, kyuinKyuin, gyuin, don, fanfare, pon, count,
        bgmLevel, bgmStop, hush,
        get ready() { return Object.keys(buf).length; },
        /** たしかめ用：作った 音の データの いちばん 大きい 音と 長さ */
        peek(name) {
            const b = buf[name];
            if (!b) return null;
            const d = b.getChannelData(0);
            let m = 0;
            for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
            return { peak: Math.round(m * 1000) / 1000, sec: Math.round(b.duration * 1000) / 1000 };
        },
    };
})(window);
