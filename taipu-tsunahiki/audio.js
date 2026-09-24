/* 音
   ------------------------------------------------------------------
   音の ファイルは つかいません。ブラウザに その場で 音を つくらせます。
   （ファイルが ないので 読みこみを 待たずに 鳴り、通信も つかいません）

   ・音を 出すには「人が 画面を さわったあと」で ないと いけない
     きまりが ブラウザに あるので、さいしょの タッチで 目ざめさせます。
   ・音の 入り／切りは この 端末だけの せっていです（先生が きょうしつで
     切っても、子どもの 端末には ひびきません）。
   ・30台が いっせいに 鳴るので、キーを おすたびの 音は 出しません。
     ことばを 1つ 打ちおわった とき・まちがえた とき だけ、小さく 鳴らします。
   ・「じゃんけん ぽん」の 声は、ブラウザの 読みあげ（speechSynthesis）で 出します。
     日本語の 声が ない 端末では、声の かわりに 「ポン」の 音だけ 鳴ります。
   ------------------------------------------------------------------ */

const KEY = 'tt_sound';
let ctx = null;
let on = true;

try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}

/* 読みあげの 声の リストは あとから とどくので、さきに よびだして おきます */
try { if (window.speechSynthesis) window.speechSynthesis.getVoices(); } catch (e) {}

function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    return ctx;
}

/* さいしょの タッチで 音を つかえるように します */
for (const ev of ['pointerdown', 'keydown']) {
    window.addEventListener(ev, () => wake(), { once: false, passive: true });
}

/** ひとつの 音を 鳴らします。 */
function note(freq, start, dur, type, vol) {
    const c = wake();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    const t0 = c.currentTime + start;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol == null ? 0.18 : vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function play(fn) {
    if (!on) return;
    try { fn(); } catch (e) {}
}

export const sound = {
    isOn: () => on,
    toggle() {
        on = !on;
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
        if (on) play(() => note(880, 0, 0.12));
        return on;
    },

    /** あいてが きまった */
    matched() { play(() => { note(523, 0, 0.12); note(659, 0.1, 0.12); note(784, 0.2, 0.24); }); },

    /** 3・2・1 */
    count() { play(() => note(660, 0, 0.12, 'sine', 0.14)); },

    /** はじめ！ */
    go() { play(() => note(1047, 0, 0.35, 'triangle', 0.2)); },

    /** ことばを 1つ 打ちおわった */
    word() { play(() => note(1175, 0, 0.07, 'sine', 0.07)); },

    /** まちがえた（みじかく、きつくない 音）*/
    miss() { play(() => note(196, 0, 0.09, 'sine', 0.06)); },

    /** のこり わずか（1びょうごと）*/
    tick() { play(() => note(880, 0, 0.05, 'sine', 0.06)); },

    /** かち */
    win() {
        play(() => {
            [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.11, 0.3));
            note(1319, 0.44, 0.5, 'triangle', 0.2);
        });
    },

    /** まけ（しずみすぎない 音）*/
    lose() { play(() => { note(659, 0, 0.16); note(587, 0.14, 0.16); note(523, 0.28, 0.3); }); },

    /** じゃんけんの 手を 出した しゅんかん */
    pon() { play(() => { note(784, 0, 0.08, 'square', 0.08); note(1175, 0.06, 0.18, 'triangle', 0.14); }); },

    /** 声で 言います（じゃんけん ぽん・かち など）*/
    speak(text) {
        if (!on) return;
        try {
            const ss = window.speechSynthesis;
            if (!ss) return;
            ss.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ja-JP';
            u.rate = 1.15;
            u.pitch = 1.2;
            const v = ss.getVoices().find(x => /^ja/i.test(x.lang));
            if (v) u.voice = v;
            ss.speak(u);
        } catch (e) {}
    },

    /** ひきわけ */
    draw() { play(() => { note(659, 0, 0.16); note(659, 0.16, 0.26); }); }
};

/* ── 音楽（うんどうかいの 定番「天国と地獄」）─────────────────
   オッフェンバック（1880年に なくなった 人）の 曲なので、作曲の 著作権は きれています。
   ろくおんした 音は つかわず、ここに 書いた 音ぷを その場で 鳴らします。
   ・たいせんが はじまったら 流し、のこり 10びょうで はやく します
   ・🎵 ボタンで その 端末だけ 止められます（こうかおんの 🔊 とは べつ）
   ------------------------------------------------------------------ */
const MUSIC_KEY = 'tt_music';
let musicOn = true;
try { musicOn = localStorage.getItem(MUSIC_KEY) !== '0'; } catch (e) {}

/* 8ぶん音ぷ 1つずつ。「.」は まえの 音を のばす */
const PHRASE_A = 'C4 . C4 D4 F4 E4 D4 G4 . G4 . G4 A4 E4 F4 D4 . D4 . D4 F4 E4 D4 C4 C5 B4 A4 G4 F4 E4 D4 .';
const PHRASE_B = 'C4 . C4 D4 F4 E4 D4 G4 . G4 . G4 A4 E4 F4 D4 . D4 . D4 F4 E4 D4 C4 G4 D4 E4 C4 . . .';
/* 4つ（2はく）ごとの ベースの 音（ド＝C、ソ＝G）*/
const BASS_A = ['C', 'C', 'C', 'C', 'G', 'G', 'C', 'G'];
const BASS_B = ['C', 'C', 'C', 'C', 'G', 'G', 'C', 'C'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freq = name => {
    const m = /^([A-G])(\d)$/.exec(name);
    return 440 * Math.pow(2, (SEMI[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
};
const SONG = [];
for (const [ph, bass] of [[PHRASE_A, BASS_A], [PHRASE_B, BASS_B]]) {
    ph.split(/\s+/).forEach((tok, i) => {
        const root = bass[Math.floor(i / 4)];
        SONG.push({ note: tok === '.' ? null : tok, bass: (i % 2 === 0 ? root + '2' : (root === 'C' ? 'G2' : 'D3')) });
    });
}
const EIGHTH = 0.2;          // 8ぶん音ぷの ながさ（びょう）

let mGain = null, mTimer = null, mStep = 0, mNext = 0, mSpeed = 1, noiseBuf = null;

function voice(c, f, t, dur, type, vol, dest) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
}
function hat(c, t, vol, dest) {
    if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(), g = c.createGain(), hp = c.createBiquadFilter();
    s.buffer = noiseBuf;
    hp.type = 'highpass'; hp.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(hp).connect(g).connect(dest);
    s.start(t);
}

/* すこし さきまで 音を よやくして おく（ずれない ように）*/
function schedule() {
    const c = ctx;
    if (!c || !mGain) return;
    const step = EIGHTH / mSpeed;
    while (mNext < c.currentTime + 0.15) {
        const s = SONG[mStep % SONG.length];
        /* メロディは のばす 音も ふくめた 長さで 鳴らします */
        if (s.note) {
            let len = 1;
            while (!SONG[(mStep + len) % SONG.length].note && len < 4) len++;
            voice(c, freq(s.note), mNext, step * len * 0.95, 'square', 0.05, mGain);
            voice(c, freq(s.note) * 2, mNext, step * 0.6, 'triangle', 0.025, mGain);
        }
        voice(c, freq(s.bass), mNext, step * 0.8, 'triangle', 0.11, mGain);
        hat(c, mNext, mStep % 2 ? 0.05 : 0.02, mGain);
        mNext += step;
        mStep++;
    }
}

export const music = {
    isOn: () => musicOn,
    toggle() {
        musicOn = !musicOn;
        try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0'); } catch (e) {}
        if (!musicOn) music.stop();
        return musicOn;
    },
    /** 流します（speed … 1 が ふつう。1.25 で はやく）。もう 流れていれば はやさだけ かえます */
    play(speed = 1) {
        mSpeed = speed;
        if (!musicOn || mTimer) return;
        const c = wake();
        if (!c) return;
        mGain = c.createGain();
        mGain.gain.value = 0.7;
        mGain.connect(c.destination);
        mStep = 0;
        mNext = c.currentTime + 0.05;
        schedule();
        mTimer = setInterval(schedule, 40);
    },
    stop() {
        clearInterval(mTimer);
        mTimer = null;
        if (mGain && ctx) {
            const g = mGain;
            try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.08); } catch (e) {}
            setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 500);
        }
        mGain = null;
    }
};
