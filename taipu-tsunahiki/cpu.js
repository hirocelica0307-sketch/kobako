/* コンピューターの あいて
   ------------------------------------------------------------------
   人と おなじ ことばを、おなじ ローマ字の はんていで 1キーずつ 打ちます。
   ・はやさは「1ぷんに 打つ かなの 数」（words.js の LEVELS の cpu）
   ・キーの 間かくは ばらつかせ、ことばの はじめで すこし 考えます
   ・ときどき まちがえます（o.miss の わりあい。レベルが ひくいほど 多め）
   あいての ようすの らんに、人と おなじ ように 打ちかけの キーが 出ます。
   ------------------------------------------------------------------ */
import { createTyper } from './romaji.js';


/**
 * @param {object} o
 *   o.words   ことばの ならび（人と 同じ もの）
 *   o.perMin  1ぷんに 打つ かなの 数
 *   o.miss    まちがえる わりあい（0.03 なら 100キーに 3かい）
 *   o.onProg  すすんだら よばれる（{n, w, k, buf, miss}）
 */
export function createCpu(o) {
    const prefs = {};
    let wi = 0, n = 0, miss = 0;
    let typer = createTyper(o.words[0], prefs);
    let timer = null, running = false;
    const missRate = o.miss != null ? o.miss : 0.05;

    const msPerKana = 60000 / o.perMin;
    /* まちがえた ぶんの 時間（1回 まちがえると ふつうの 1.8ばい かかる）*/
    const missCost = 1 + 1.8 * missRate / (1 - missRate);

    /* 1つの ことばに かける 時間 ＝ かなの 数 × msPerKana。
       その 85% を キーを 打つ 時間、15% を つぎの ことばを 読む 間 に します */
    function keyDelay(word) {
        const keysInWord = Math.max(1, createTyper(word).view().rest.length);
        const base = 0.85 * msPerKana * word.length / keysInWord / missCost;
        return base * (0.65 + Math.random() * 0.7);
    }

    function report() {
        o.onProg({ n, w: wi, k: typer.kanaDone(), buf: typer.buffer(), miss });
    }

    function step() {
        if (!running) return;
        const word = o.words[wi % o.words.length];
        let wait = keyDelay(word);
        if (Math.random() < missRate) {
            miss++;
            wait *= 1.8;                        // まちがえたら すこし あわてる
        } else {
            const key = typer.view().rest[0];
            const r = typer.input(key);
            n += r.kana;
            if (typer.done()) {
                wi++;
                typer = createTyper(o.words[wi % o.words.length], prefs);
                /* つぎの ことばを 読む 間 */
                wait += 0.15 * msPerKana * word.length * (0.6 + Math.random() * 0.8);
            }
        }
        report();
        timer = setTimeout(step, wait);
    }

    return {
        start() {
            if (running) return;
            running = true;
            timer = setTimeout(step, 300 + Math.random() * 500);   // よーい どん の はんのう
        },
        stop() { running = false; clearTimeout(timer); },
        stats: () => ({ n, miss })
    };
}
