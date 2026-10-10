/* 効果音と こえ
   ------------------------------------------------------------------
   音は ファイルを つかわず Web Audio で その場で つくります。
     ・牌を えらぶ「カチッ」・卓に 打つ「タンッ」・ツモの「スッ」
     ・リーチ・鳴き・ロン/ツモの 雷・役の「ドン」・点数の スタンプ など
   こえ（ポン・チー・カン・リーチ・ロン・ツモ・役の 名まえ）は
   端末の 読みあげ（speechSynthesis）を つかいます。
   どちらも つかえない 端末では だまって なにも しません。
   ------------------------------------------------------------------ */
import { store } from './store.js';

let ctx = null;
let master = null;
let verb = null;

function ac() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createDynamicsCompressor();
        master.threshold.value = -10;
        master.ratio.value = 4;
        master.connect(ctx.destination);
        verb = makeReverb(ctx);
        verb.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

function makeReverb(a) {
    // みじかい 部屋の ひびき（ノイズの インパルス）
    const len = Math.floor(a.sampleRate * 1.6);
    const buf = a.createBuffer(2, len, a.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const c = a.createConvolver();
    c.buffer = buf;
    const g = a.createGain();
    g.gain.value = 0.22;
    c.connect(g);
    const input = a.createGain();
    input.connect(c);
    input.out = g;
    // input に つなぐと ひびきが master へ
    return { connect: n => g.connect(n), input };
}

/** 画面を はじめて さわった ときに 音の じゅんびを します（スマホの きまり） */
export function unlockAudio() {
    try {
        const a = ac();
        if (a) {
            // iOS で 音を 出せる ように からの 音を 鳴らす
            const b = a.createBuffer(1, 1, 22050);
            const s = a.createBufferSource();
            s.buffer = b; s.connect(a.destination); s.start(0);
        }
        if ('speechSynthesis' in window) speechSynthesis.getVoices();
    } catch (e) { /* むし */ }
}

const noiseCache = {};
function noiseBuffer(a, kind = 'white', dur = 1) {
    const key = kind + dur;
    if (noiseCache[key]) return noiseCache[key];
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else d[i] = w;
    }
    noiseCache[key] = buf;
    return buf;
}

function out(a, wet = 0) {
    const g = a.createGain();
    g.connect(master);
    if (wet > 0) {
        const w = a.createGain();
        w.gain.value = wet;
        g.connect(w);
        w.connect(verb.input);
    }
    return g;
}

/** ノイズの みじかい 音 */
function noise(t0, { dur = 0.05, type = 'bandpass', freq = 2000, q = 1, gain = 0.5, attack = 0.001, kind = 'white', wet = 0, sweepTo = null }) {
    const a = ctx;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, kind, Math.max(1, dur + 0.1));
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(out(a, wet));
    src.start(t0);
    src.stop(t0 + dur + 0.05);
}

/** 音程の ある 音 */
function tone(t0, { freq = 440, dur = 0.2, type = 'sine', gain = 0.2, attack = 0.005, to = null, wet = 0, detune = 0 }) {
    const a = ctx;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    o.detune.value = detune;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out(a, wet));
    o.start(t0);
    o.stop(t0 + dur + 0.05);
}

function play(fn) {
    if (!store.settings.sound) return;
    try {
        const a = ac();
        if (!a) return;
        fn(a.currentTime + 0.005);
    } catch (e) { /* むし */ }
}

/* 牌の 音：樹脂の 牌どうし・牌と 卓が あたる 音を 部品で つくる */
function clack(t, power = 1) {
    // するどい 当たり（高い ノイズ）
    noise(t, { dur: 0.03, type: 'bandpass', freq: 3200, q: 2.5, gain: 0.55 * power });
    noise(t, { dur: 0.018, type: 'highpass', freq: 5000, q: 0.7, gain: 0.25 * power });
    // 牌の からだの ひびき
    tone(t, { freq: 1480, dur: 0.07, type: 'sine', gain: 0.16 * power, attack: 0.001 });
    tone(t, { freq: 2350, dur: 0.05, type: 'sine', gain: 0.09 * power, attack: 0.001 });
    tone(t, { freq: 3900, dur: 0.03, type: 'triangle', gain: 0.04 * power, attack: 0.001 });
}

function thud(t, power = 1) {
    // 卓（マット）に あたる 低い 音
    tone(t, { freq: 190, to: 90, dur: 0.09, type: 'sine', gain: 0.35 * power, attack: 0.002 });
    noise(t, { dur: 0.06, type: 'lowpass', freq: 700, q: 0.8, gain: 0.3 * power });
}

export const sfx = {
    /** 牌を えらぶ「カチッ」 */
    select: () => play(t => {
        noise(t, { dur: 0.012, type: 'highpass', freq: 4200, gain: 0.32 });
        tone(t, { freq: 2900, dur: 0.035, type: 'square', gain: 0.03, attack: 0.001 });
        tone(t + 0.004, { freq: 1700, dur: 0.03, type: 'sine', gain: 0.08, attack: 0.001 });
    }),
    /** 牌を 打つ「タンッ」 */
    discard: (power = 1) => play(t => { clack(t, power); thud(t + 0.002, power); }),
    /** リーチ宣言牌・強打 */
    slam: () => play(t => {
        clack(t, 1.3); thud(t, 1.6);
        tone(t, { freq: 85, to: 45, dur: 0.35, type: 'sine', gain: 0.5, attack: 0.002 });
        noise(t, { dur: 0.4, type: 'lowpass', freq: 400, gain: 0.25, kind: 'brown', wet: 0.6 });
    }),
    /** ツモ（山から とる） */
    draw: () => play(t => {
        noise(t, { dur: 0.08, type: 'bandpass', freq: 1800, q: 0.9, gain: 0.12, attack: 0.02, sweepTo: 3500 });
        clack(t + 0.07, 0.35);
    }),
    /** 配牌（4枚 まとめて） */
    deal: () => play(t => { clack(t, 0.5); clack(t + 0.035, 0.4); thud(t, 0.4); }),
    /** 山を くずす・牌を まぜる */
    shuffle: () => play(t => {
        for (let i = 0; i < 26; i++) {
            const dt = i * 0.045 + Math.random() * 0.03;
            clack(t + dt, 0.25 + Math.random() * 0.25);
        }
    }),
    /** サイコロ */
    dice: () => play(t => {
        for (let i = 0; i < 9; i++) {
            const dt = i * 0.07 + Math.random() * 0.04;
            noise(t + dt, { dur: 0.025, type: 'bandpass', freq: 2600 + Math.random() * 1500, q: 3, gain: 0.35 - i * 0.025 });
            tone(t + dt, { freq: 900 + Math.random() * 400, dur: 0.03, type: 'triangle', gain: 0.05 });
        }
        thud(t + 0.66, 0.6);
    }),
    /** 鳴き（ポン・チー・カン）の「バシッ」 */
    call: () => play(t => {
        noise(t, { dur: 0.18, type: 'bandpass', freq: 900, q: 0.8, gain: 0.25, attack: 0.04, sweepTo: 4000 });
        clack(t + 0.16, 1.2); thud(t + 0.16, 1.2);
        tone(t + 0.16, { freq: 660, dur: 0.25, type: 'triangle', gain: 0.08, wet: 0.5 });
        tone(t + 0.16, { freq: 990, dur: 0.25, type: 'triangle', gain: 0.06, wet: 0.5 });
    }),
    /** リーチの 光（キュイーン） */
    riichi: () => play(t => {
        tone(t, { freq: 300, to: 2400, dur: 0.45, type: 'sawtooth', gain: 0.07, attack: 0.03, wet: 0.5 });
        tone(t, { freq: 450, to: 3600, dur: 0.45, type: 'sine', gain: 0.08, attack: 0.03, wet: 0.5 });
        [1568, 2093, 2637].forEach((f, i) => tone(t + 0.4 + i * 0.05, { freq: f, dur: 0.5, type: 'sine', gain: 0.07, wet: 0.8 }));
    }),
    /** リーチ棒を おく */
    stick: () => play(t => { noise(t, { dur: 0.04, type: 'bandpass', freq: 2200, q: 4, gain: 0.3 }); tone(t, { freq: 1200, dur: 0.06, gain: 0.06 }); }),
    /** ドラが ふえる・裏ドラ めくり */
    flip: () => play(t => { noise(t, { dur: 0.05, type: 'bandpass', freq: 2800, q: 2, gain: 0.3 }); clack(t + 0.04, 0.6); }),
    sparkle: () => play(t => {
        [2093, 2637, 3136, 4186].forEach((f, i) => tone(t + i * 0.045, { freq: f, dur: 0.35, type: 'sine', gain: 0.06, wet: 0.8 }));
    }),
    /** 雷（level 0〜5 で 大きく なる） */
    thunder: (level = 1) => play(t => {
        const p = 0.6 + level * 0.18;
        // バリッ（さける 音）
        noise(t, { dur: 0.12 + level * 0.02, type: 'highpass', freq: 1500, gain: 0.7 * p, attack: 0.001 });
        noise(t + 0.02, { dur: 0.25, type: 'bandpass', freq: 2500, q: 0.6, gain: 0.45 * p });
        // ゴロゴロ
        noise(t + 0.05, { dur: 1.2 + level * 0.5, type: 'lowpass', freq: 160 + level * 20, q: 0.7, gain: 0.9 * p, attack: 0.08, kind: 'brown', wet: 0.7 });
        tone(t, { freq: 70, to: 32, dur: 0.9 + level * 0.25, type: 'sine', gain: 0.55 * p, attack: 0.005 });
        if (level >= 3) noise(t + 0.5, { dur: 1.6, type: 'lowpass', freq: 120, gain: 0.6, attack: 0.3, kind: 'brown', wet: 0.8 });
    }),
    /** 役が 1つ 出る「ドン」 */
    yaku: (i = 0) => play(t => {
        tone(t, { freq: 130, to: 70, dur: 0.28, type: 'sine', gain: 0.55, attack: 0.002 });
        noise(t, { dur: 0.12, type: 'lowpass', freq: 900, gain: 0.35 });
        tone(t, { freq: 523 * Math.pow(1.122, i), dur: 0.22, type: 'triangle', gain: 0.07, wet: 0.4 });
    }),
    /** 点数の スタンプ（level 0〜5） */
    stamp: (level = 0) => play(t => {
        thud(t, 1.5 + level * 0.2);
        tone(t, { freq: 60, to: 35, dur: 0.6 + level * 0.15, type: 'sine', gain: 0.6, attack: 0.002 });
        const chords = [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175], [659, 831, 988, 1319], [698, 880, 1047, 1397, 1760], [784, 988, 1175, 1568, 1976, 2349]];
        (chords[level] || chords[0]).forEach((f, i) => {
            tone(t + 0.02, { freq: f, dur: 1.2 + level * 0.3, type: level >= 4 ? 'sawtooth' : 'triangle', gain: 0.06, attack: 0.01, wet: 0.7, detune: i * 3 });
        });
        if (level >= 5) [1568, 2093, 2637, 3136, 4186].forEach((f, i) => tone(t + 0.3 + i * 0.08, { freq: f, dur: 0.8, type: 'sine', gain: 0.06, wet: 0.9 }));
    }),
    /** 点数が うごく */
    coin: () => play(t => { tone(t, { freq: 1318, dur: 0.08, type: 'square', gain: 0.03 }); tone(t + 0.06, { freq: 1975, dur: 0.16, type: 'square', gain: 0.03 }); }),
    /** 流局 */
    ryuukyoku: () => play(t => {
        [392, 349, 330, 262].forEach((f, i) => tone(t + i * 0.16, { freq: f, dur: 0.4, type: 'triangle', gain: 0.08, wet: 0.5 }));
    }),
    /** 自分の 番 */
    myTurn: () => play(t => tone(t, { freq: 1046, dur: 0.08, type: 'sine', gain: 0.05 })),
    /** 時間の カウント */
    tick: () => play(t => tone(t, { freq: 1800, dur: 0.03, type: 'square', gain: 0.025 })),
    /** ボタン */
    button: () => play(t => { tone(t, { freq: 880, dur: 0.05, type: 'sine', gain: 0.06 }); }),
    /** さいごの 順位 */
    win: () => play(t => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.11, { freq: f, dur: 0.35, type: 'triangle', gain: 0.08, wet: 0.5 }))),
    lose: () => play(t => [392, 370, 349, 330].forEach((f, i) => tone(t + i * 0.2, { freq: f, dur: 0.5, type: 'triangle', gain: 0.07, wet: 0.4 })))
};

/* ── こえ ───────────────────────────────── */

let voices = null;
function jaVoices() {
    if (!('speechSynthesis' in window)) return [];
    if (!voices || !voices.length) voices = speechSynthesis.getVoices();
    return voices.filter(v => /ja/i.test(v.lang));
}
if ('speechSynthesis' in window) {
    try { speechSynthesis.onvoiceschanged = () => { voices = speechSynthesis.getVoices(); }; } catch (e) { /* むし */ }
}

// 席（画面の 位置 0〜3）ごとに こえの 高さを かえて「べつの 人」に きこえる ように する
const SEAT_VOICE = [{ pitch: 1.05, rate: 1.1 }, { pitch: 0.7, rate: 1.05 }, { pitch: 1.4, rate: 1.12 }, { pitch: 0.9, rate: 1.0 }];

/**
 * 日本語で 読みあげます（日本語の こえが ない 端末では 読みません）
 * pos: 画面の 位置（0 自分・1 右・2 上・3 左）。null なら ナレーター
 */
export function say(text, pos = null, { interrupt = true, rate = null, pitch = null, volume = 1 } = {}) {
    if (!store.settings.sound || !store.settings.voice) return;
    try {
        const vs = jaVoices();
        if (!vs.length) return;
        const u = new SpeechSynthesisUtterance(text);
        // 席ごとに ちがう こえ（ある ときは）
        const v = pos === null ? vs[0] : vs[pos % vs.length];
        u.voice = v;
        u.lang = 'ja-JP';
        const sv = pos === null ? { pitch: 1, rate: 1.05 } : SEAT_VOICE[pos];
        u.rate = rate ?? sv.rate;
        u.pitch = pitch ?? sv.pitch;
        u.volume = volume;
        if (interrupt) speechSynthesis.cancel();
        speechSynthesis.speak(u);
    } catch (e) { /* むし */ }
}

export function stopVoice() {
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* むし */ }
}

/** 役の よみかた（読みあげ 用） */
export const YAKU_READING = {
    '立直': 'リーチ', 'ダブル立直': 'ダブルリーチ', '一発': 'イッパツ', '門前清自摸和': 'メンゼンツモ', '平和': 'ピンフ',
    '断么九': 'タンヤオ', '一盃口': 'イーペーコー', '二盃口': 'リャンペーコー', '役牌 白': 'ハク', '役牌 發': 'ハツ', '役牌 中': 'チュン',
    '自風 東': 'トン', '自風 南': 'ナン', '自風 西': 'シャー', '自風 北': 'ペー', '場風 東': 'ばかぜ トン', '場風 南': 'ばかぜ ナン', '場風 西': 'ばかぜ シャー', '場風 北': 'ばかぜ ペー',
    '嶺上開花': 'リンシャンカイホー', '槍槓': 'チャンカン', '海底摸月': 'ハイテイ', '河底撈魚': 'ホーテイ',
    '七対子': 'チートイツ', '三色同順': 'サンショク', '三色同刻': 'サンショクドーコー', '一気通貫': 'イッツー', '混全帯么九': 'チャンタ',
    '純全帯么九': 'ジュンチャン', '対々和': 'トイトイ', '三暗刻': 'サンアンコー', '三槓子': 'サンカンツ', '小三元': 'ショーサンゲン',
    '混老頭': 'ホンロートー', '混一色': 'ホンイツ', '清一色': 'チンイツ',
    '国士無双': 'コクシムソウ', '国士無双十三面待ち': 'コクシムソウ じゅうさんめん', '四暗刻': 'スーアンコー', '四暗刻単騎': 'スーアンコー タンキ',
    '大三元': 'ダイサンゲン', '小四喜': 'ショースーシー', '大四喜': 'ダイスーシー', '字一色': 'ツーイーソー', '緑一色': 'リューイーソー',
    '清老頭': 'チンロートー', '九蓮宝燈': 'チューレンポートー', '純正九蓮宝燈': 'じゅんせい チューレンポートー', '四槓子': 'スーカンツ',
    '天和': 'テンホー', '地和': 'チーホー', 'ドラ': 'ドラ', '赤ドラ': 'アカドラ', '裏ドラ': 'ウラドラ'
};
