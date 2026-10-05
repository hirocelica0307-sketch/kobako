/**
 * キーボード入力の受け口。
 *
 * event.code（物理キー位置）ではなく event.key を使う。
 * code だと Dvorak/AZERTY 配列のユーザーが打てなくなる。
 */
export interface KeyHandlers {
  /** 打鍵として扱う1文字。 */
  onChar: (key: string) => void;
  /** Enter / Escape / Space などの操作キー。 */
  onCommand: (key: string) => void;
}

const COMMAND_KEYS = new Set(['Enter', 'Escape', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createKeyListener(
  handlers: KeyHandlers,
  isComposing: (e: KeyboardEvent) => boolean,
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    // ブラウザのショートカットを壊さない
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    if (isComposing(e)) return;

    if (COMMAND_KEYS.has(e.key)) {
      // Space でページがスクロールするのを防ぐ
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
      handlers.onCommand(e.key);
      return;
    }
    if (e.key.length === 1) {
      handlers.onChar(e.key);
    }
  };
}
