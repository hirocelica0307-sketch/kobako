import { describe, expect, it } from 'vitest';
import { ImeWatcher } from '../ime';

/**
 * ここは DOM 無しで動く部分（keydown の解釈と通知）だけを検証する。
 * 隠し input と window リスナは attach() 側なので jsdom が要る。
 */
function key(opts: { isComposing?: boolean; keyCode?: number }): KeyboardEvent {
  return {
    isComposing: opts.isComposing ?? false,
    keyCode: opts.keyCode ?? 65,
  } as unknown as KeyboardEvent;
}

describe('ImeWatcher', () => {
  it('isComposing の keydown で ON になる', () => {
    const w = new ImeWatcher();
    expect(w.inspectKeydown(key({ isComposing: true }))).toBe(true);
    expect(w.isOn).toBe(true);
  });

  it('keyCode 229 でも ON になる（isComposing が来ないブラウザ向け）', () => {
    const w = new ImeWatcher();
    expect(w.inspectKeydown(key({ keyCode: 229 }))).toBe(true);
    expect(w.isOn).toBe(true);
  });

  /**
   * これが今回の不具合そのもの。
   * 英数に戻したあと最初の打鍵で、再読み込みなしに必ず OFF へ戻ること。
   */
  it('英数に戻して1打鍵すると即座に OFF へ戻る', () => {
    const w = new ImeWatcher();
    const seen: boolean[] = [];
    w.subscribe((on) => seen.push(on));

    w.inspectKeydown(key({ keyCode: 229 }));      // かな入力のまま打った
    expect(w.isOn).toBe(true);

    const handled = w.inspectKeydown(key({}));    // 英数に切り替えて打ち直した
    expect(handled).toBe(false);                  // この打鍵は通常の文字として扱える
    expect(w.isOn).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('状態が変わらない打鍵では通知しない', () => {
    const w = new ImeWatcher();
    let count = 0;
    w.subscribe(() => { count += 1; });
    w.inspectKeydown(key({}));
    w.inspectKeydown(key({}));
    expect(count).toBe(0);
    w.inspectKeydown(key({ isComposing: true }));
    w.inspectKeydown(key({ isComposing: true }));
    expect(count).toBe(1);
  });

  it('subscribe の解除後は通知されない', () => {
    const w = new ImeWatcher();
    let count = 0;
    const unsub = w.subscribe(() => { count += 1; });
    unsub();
    w.inspectKeydown(key({ isComposing: true }));
    expect(count).toBe(0);
  });
});
