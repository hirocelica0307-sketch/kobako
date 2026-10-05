import { PAUSE_ITEMS } from '../../engine/game/engine';

interface Props { index: number }

/**
 * 一時停止メニュー。
 * 以前は「再開」しか無く、ゲーム中にタイトルへ戻る手段が存在しなかった。
 */
export function PauseScreen({ index }: Props) {
  return (
    <div className="overlay">
      <div className="pause-panel">
        <div className="pause-title">■ いちじ ていし ■</div>
        <ul className="menu">
          {PAUSE_ITEMS.map((item, i) => (
            <li key={item.id} className={i === index ? 'menu-item selected' : 'menu-item'}>
              <span className="menu-cursor">{i === index ? '▸' : ' '}</span>
              <span className="menu-label">{item.label}</span>
              <span className="menu-key">[{item.key}]</span>
            </li>
          ))}
        </ul>
        <div className="keyhint">↑↓ で えらんで Enter、または [ ] の キーを おす</div>
      </div>
    </div>
  );
}
