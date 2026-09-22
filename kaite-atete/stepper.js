/* 数を えらぶ ボタン
   ------------------------------------------------------------------
   キーボードは つかいません。「－10 －1 ＋1 ＋10」を おして
   数を かえます。1 から 99 までです。
   ------------------------------------------------------------------ */

export const MIN = 1;
export const MAX = 99;

/**
 * @param {object} opt
 *   opt.value  さいしょの 数
 *   opt.unit   数の うしろに つける ことば（'ふん'・'びょう' など）
 *   opt.onChange 数が かわったら よばれる
 */
export function createStepper(opt = {}) {
    const unit = opt.unit || '';
    const onChange = opt.onChange || (() => {});
    let value = clamp(opt.value || MIN);

    const el = document.createElement('div');
    el.className = 'stepper';

    const show = document.createElement('div');
    show.className = 'stepval';

    const num = document.createElement('b');
    const suffix = document.createElement('span');
    suffix.textContent = unit;
    show.append(num, suffix);

    const paint = () => {
        num.textContent = value;
        for (const b of el.querySelectorAll('.stepbtn')) {
            const d = Number(b.dataset.delta);
            b.disabled = clamp(value + d) === value;
        }
        onChange(value);
    };

    const makeBtn = (label, delta) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stepbtn';
        b.dataset.delta = String(delta);
        b.textContent = label;
        b.addEventListener('click', () => { value = clamp(value + delta); paint(); });
        return b;
    };

    el.append(
        makeBtn('－10', -10), makeBtn('－1', -1),
        show,
        makeBtn('＋1', 1), makeBtn('＋10', 10)
    );
    paint();

    return {
        el,
        getValue: () => value,
        setValue(v) { value = clamp(v); paint(); }
    };
}

function clamp(v) {
    return Math.min(MAX, Math.max(MIN, Math.round(v)));
}
