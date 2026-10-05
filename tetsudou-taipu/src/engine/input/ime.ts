/**
 * IME（日本語入力）が ON かどうかの検知。
 * 1打鍵ごとの判定は IME OFF が前提なので、ON のまま始まると何も打てない。
 *
 * 検知は多重化する:
 *   1. keydown の isComposing
 *   2. keyCode === 229（isComposing が来ない古いブラウザのフォールバック）
 *   3. 不可視 input の compositionstart
 *   4. window 全体の compositionstart / compositionend（capture）
 *
 * **復帰は必ず取れるようにする。**
 * 以前は「一度 ON になると、英数に戻しても警告が消えない」不具合があった。
 * 原因は、隠し input にフォーカスが無いと compositionend を拾えず、
 * かつ keydown 側が別インスタンスを見ていて誰にも通知されなかったこと。
 * いまは keydown / keyup / compositionend のどれか1つでも
 * 「変換中ではない」と言えば即座に OFF にする。
 */
export class ImeWatcher {
  private composing = false;
  private listeners = new Set<(on: boolean) => void>();
  private input: HTMLInputElement | null = null;
  private windowUnbind: (() => void) | null = null;

  attach(): void {
    if (this.input !== null) return;
    const el = document.createElement('input');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    // display:none だとフォーカスできないので、見えない大きさで置く
    Object.assign(el.style, {
      position: 'fixed', top: '0', left: '0',
      width: '1px', height: '1px', opacity: '0',
      border: 'none', padding: '0', pointerEvents: 'none',
    });
    el.addEventListener('compositionstart', () => this.set(true));
    el.addEventListener('compositionend', () => { el.value = ''; this.set(false); });
    el.addEventListener('input', () => { el.value = ''; });
    document.body.appendChild(el);
    this.input = el;
    el.focus({ preventScroll: true });

    // 隠し input の外で変換が始まる/終わることがあるので window でも見る。
    const onStart = () => this.set(true);
    const onEnd = () => this.set(false);
    // keyup は「英数に戻したあと最初のキーを離した瞬間」の保険。
    // keydown を取りこぼしても、ここで必ず復帰する。
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.isComposing && e.keyCode !== 229) this.set(false);
    };
    window.addEventListener('compositionstart', onStart, true);
    window.addEventListener('compositionend', onEnd, true);
    window.addEventListener('keyup', onKeyUp, true);
    this.windowUnbind = () => {
      window.removeEventListener('compositionstart', onStart, true);
      window.removeEventListener('compositionend', onEnd, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }

  detach(): void {
    this.windowUnbind?.();
    this.windowUnbind = null;
    this.input?.remove();
    this.input = null;
    this.listeners.clear();
  }

  /** フォーカスが外れると compositionstart を拾えなくなるので取り戻す。 */
  refocus(): void {
    this.input?.focus({ preventScroll: true });
  }

  /**
   * keydown から IME 状態を更新する。true なら打鍵として扱ってはいけない。
   * 変換中でなければ**必ず** OFF にする（復帰が取れなくなるのを防ぐ）。
   */
  inspectKeydown(e: KeyboardEvent): boolean {
    const on = e.isComposing || e.keyCode === 229;
    this.set(on);
    return on;
  }

  get isOn(): boolean {
    return this.composing;
  }

  subscribe(fn: (on: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(on: boolean): void {
    if (this.composing === on) return;
    this.composing = on;
    for (const fn of this.listeners) fn(on);
  }
}
