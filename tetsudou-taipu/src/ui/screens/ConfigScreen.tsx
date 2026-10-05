import { TIME_LIMITS } from '../../engine/game/engine';
import type { TimeLimit } from '../../engine/game/engine';

interface Props {
  selected: TimeLimit;
  best: number | null;
  lineName: string;
  destination: string;
  scopeNote: string;
}

/** 制限時間の選択。券売機のボタンに見立てる。 */
export function ConfigScreen({ selected, best, lineName, destination, scopeNote }: Props) {
  return (
    <div className="overlay">
      <div className="panel">
        <div className="config-head">きっぷ を おもとめください</div>
        <div className="config-route">{lineName}　{destination}ゆき</div>
        <div className="config-scope">{scopeNote}</div>

        <div className="fare-buttons">
          {TIME_LIMITS.map((t) => (
            <div key={t} className={`fare-button${t === selected ? ' selected' : ''}`}>
              <div className="fare-button-sec">{t}</div>
              <div className="fare-button-unit">秒</div>
            </div>
          ))}
        </div>

        <div className="config-best">
          この じかんの さいこう うんちん　
          {best === null ? 'きろくなし' : `¥${best.toLocaleString('ja-JP')}`}
        </div>
        <div className="keyhint">← → で えらんで Enter で はっしゃ　[Esc] もどる</div>
      </div>
    </div>
  );
}
