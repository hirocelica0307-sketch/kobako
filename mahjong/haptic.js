/* バイブ（自分の 番・鳴ける とき・あがれる とき）
   ------------------------------------------------------------------
   Android などは navigator.vibrate を つかいます。
   iPhone の Safari は navigator.vibrate が ないので、iOS 18 から つかえる
   「スイッチの 切りかえで 本体が コツッと ふるえる」しくみを ためします
   （古い iPhone や、ふるえない 設定の ときは なにも おきません）。
   ------------------------------------------------------------------ */
import { store } from './store.js';

let sw = null;
function iosTick() {
    try {
        if (!sw) {
            const label = document.createElement('label');
            label.setAttribute('aria-hidden', 'true');
            label.style.cssText = 'position:fixed;left:-200px;top:-200px;width:1px;height:1px;opacity:0;pointer-events:none';
            const inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.setAttribute('switch', '');
            inp.tabIndex = -1;
            label.appendChild(inp);
            document.body.appendChild(label);
            sw = label;
        }
        sw.click();
    } catch (e) { /* むし */ }
}

const PATTERN = { turn: 35, call: [50, 40, 50], win: [90, 50, 90, 50, 140] };

/** kind：'turn'（自分の 番）/ 'call'（鳴ける）/ 'win'（ロン・ツモ できる） */
export function buzz(kind = 'turn') {
    if (!store.settings.vibe) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { if (navigator.vibrate(PATTERN[kind] || 30)) return; } catch (e) { /* むし */ }
    }
    iosTick();
    if (kind !== 'turn') setTimeout(iosTick, 140);
    if (kind === 'win') setTimeout(iosTick, 280);
}
