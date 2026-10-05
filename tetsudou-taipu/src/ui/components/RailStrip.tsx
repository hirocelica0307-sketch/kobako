import { useLayoutEffect, useRef } from 'react';
import type { Snapshot } from '../../engine/game/engine';

interface Props { snap: Snapshot }

/**
 * 線路沿いの駅名帯。
 *
 *   ● 庭瀬            ● 中 庄 ●          倉敷 ●
 *     (通過)          なかしょう           (次)
 *                     nakashou
 *
 * 中央＝いま打っている駅、進行方向の側＝次の駅、その反対＝通過した駅。
 * 折り返して左へ進むときは左右が入れ替わる（.reversed）。
 * 発車すると帯全体が1スロット分スライドして、次の駅が中央に来る。
 * これで「1駅進んだ」が必ず目に見える。
 */
export function RailStrip({ snap }: Props) {
  const romajiRef = useRef<HTMLDivElement>(null);

  // 長い駅名（東岡山・新倉敷など）でも1行に収める。
  // 改行するとカーソル追従が破綻するので、横方向の縮小で逃がす。
  useLayoutEffect(() => {
    const el = romajiRef.current;
    if (el === null) return;
    el.style.removeProperty('transform');
    const avail = (el.parentElement?.clientWidth ?? 0) - 8;
    if (avail > 0 && el.scrollWidth > avail) {
      el.style.transform = `scaleX(${Math.max(0.55, avail / el.scrollWidth)})`;
    }
  }, [snap.stationKanji, snap.romaji.committed, snap.romaji.active]);

  const kana = snap.stationKana;
  const { done, active } = snap.furigana;

  // 進行方向へ列車が進む＝帯は逆向きに流れる
  const shift = -snap.slide * snap.slideDir * 36;

  return (
    <div className={`railstrip${snap.slideDir === -1 ? ' reversed' : ''}`}>
      <div className="railstrip-track" />
      <div className="railstrip-slots" style={{ transform: `translateX(${shift}%)` }}>
        <div className="slot slot-side slot-prev">
          <span className="pin" />
          <span className="slot-name">{snap.prevStationKanji ?? ''}</span>
          <span className="slot-tag">通過</span>
        </div>

        <div className={`slot slot-now${snap.missFlash ? ' flash' : ''}`}>
          <span className="pin pin-now" />
          <div className="now-kanji">{snap.stationKanji}</div>
          <div className="now-kana">
            <span className="k-done">{kana.slice(0, done)}</span>
            <span className="k-active">{kana.slice(done, done + active)}</span>
            <span>{kana.slice(done + active)}</span>
          </div>
          {snap.showRomaji && (
            <div className="now-romaji" ref={romajiRef}>
              <span className="r-done">{snap.romaji.committed}{snap.romaji.active}</span>
              <span className="caret">&nbsp;</span>
              <span className="r-rest">{snap.romaji.rest}</span>
              <span className="r-next">{snap.romaji.upcoming}</span>
            </div>
          )}
          {snap.landmarkLabels.length > 0 && (
            <div className="now-landmark">▸ {snap.landmarkLabels.join('　・　')}</div>
          )}
        </div>

        <div className="slot slot-side slot-next">
          <span className="pin" />
          <span className="slot-name">{snap.nextStationKanji ?? '終点'}</span>
          <span className="slot-tag">
            {snap.nextStationKanji === null ? '折り返し' : `次 ${snap.nextSegmentKm.toFixed(1)}km`}
          </span>
        </div>
      </div>
    </div>
  );
}
