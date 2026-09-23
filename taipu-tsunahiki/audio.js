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
   ------------------------------------------------------------------ */

const KEY = 'tt_sound';
let ctx = null;
let on = true;

try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}

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

    /** ひきわけ */
    draw() { play(() => { note(659, 0, 0.16); note(659, 0.16, 0.26); }); }
};
