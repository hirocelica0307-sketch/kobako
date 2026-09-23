/* 画面に 出す キーボード（タイピングの おてほん）
   ------------------------------------------------------------------
   ・つぎに おす キーを 黄色く 光らせます
   ・キーは「どの ゆびで おすか」で うすく 色わけ しています
   ・F と J には ホームポジションの しるし（下の 線）
   ・Chromebook の 日本語キーボード（JIS）の ならびです
     （文字の キーの ならびは 英語キーボードでも 同じです）
   ------------------------------------------------------------------ */

const ROWS = [
    ['1','2','3','4','5','6','7','8','9','0','-','^','¥'],
    ['q','w','e','r','t','y','u','i','o','p','@','['],
    ['a','s','d','f','g','h','j','k','l',';',':',']'],
    ['z','x','c','v','b','n','m',',','.','/','_']
];
/* だんごとの ずれ（ほんものの キーボードと 同じ ように すこしずつ 右へ）*/
const INDENT = [0, 0.5, 0.8, 1.3];

/* ゆび：0 ひだり こゆび … 3 ひだり ひとさしゆび ／ 4 みぎ ひとさしゆび … 7 みぎ こゆび */
const FINGER = {};
const put = (keys, f) => { for (const k of keys) FINGER[k] = f; };
put('1qaz', 0); put('2wsx', 1); put('3edc', 2); put('45rtfgvb', 3);
put('67yuhjnm', 4); put('8ik,', 5); put('9ol.', 6); put("0-^¥p@[;:]/_", 7);

export const FINGER_NAMES = [
    'ひだりの こゆび', 'ひだりの くすりゆび', 'ひだりの なかゆび', 'ひだりの ひとさしゆび',
    'みぎの ひとさしゆび', 'みぎの なかゆび', 'みぎの くすりゆび', 'みぎの こゆび'
];
export const fingerOf = key => FINGER[key];

/**
 * @param {HTMLElement} box 入れもの（この 大きさに あわせて キーの 大きさを きめます）
 */
export function createKeyboard(box) {
    const el = document.createElement('div');
    el.className = 'kbd';
    const keys = {};
    ROWS.forEach((row, r) => {
        const line = document.createElement('div');
        line.className = 'kbd-row';
        line.style.paddingLeft = `calc(var(--k) * ${INDENT[r]})`;
        for (const k of row) {
            const b = document.createElement('div');
            b.className = 'kbd-key f' + FINGER[k] + (r === 0 ? ' dim' : '');
            b.textContent = /[a-z]/.test(k) ? k.toUpperCase() : k;
            if (k === 'f' || k === 'j') b.classList.add('home');
            line.appendChild(b);
            keys[k] = b;
        }
        el.appendChild(line);
    });
    box.appendChild(el);

    /* 入れものの 大きさに あわせて キー1つの 大きさ（--k）を きめます。
       よこは 13.6こぶん、たては 4だん ＋ すきま です */
    const fit = () => {
        const w = box.clientWidth, h = box.clientHeight;
        if (!w || !h) return;
        const k = Math.max(18, Math.min(w / 14.4, h / 4.5, 64));
        el.style.setProperty('--k', k.toFixed(1) + 'px');
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(box);
    window.addEventListener('resize', fit);
    fit();
    requestAnimationFrame(fit);

    let lit = null;
    return {
        el,
        fit,
        /** つぎに おす キーを 光らせます（null で けす）*/
        light(key) {
            const b = key ? keys[key] : null;
            if (b === lit) return;
            if (lit) lit.classList.remove('next');
            lit = b;
            if (b) b.classList.add('next');
        },
        /** おした キーを 一しゅん 光らせます（まちがい なら 赤く）*/
        press(key, ok) {
            const b = keys[key];
            if (!b) return;
            const cls = ok ? 'hit' : 'miss';
            b.classList.remove('hit', 'miss');
            void b.offsetWidth;
            b.classList.add(cls);
            setTimeout(() => b.classList.remove(cls), 180);
        }
    };
}
