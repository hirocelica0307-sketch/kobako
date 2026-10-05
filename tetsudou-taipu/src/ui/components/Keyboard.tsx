import { HOME_KEYS, KEY_ROWS, keyMatches } from '../keyboard/layout';

/**
 * 画面下の JIS キーボード（Chromebook 配列）。
 *
 * ローマ字を習いたての子は「次にどのキーを押すか」を探すのに時間がかかり、
 * 手元を見てしまうので画面の駅名を見失う。次に押せるキーをここで光らせる。
 *
 * 表示は**すべて小文字**。実物のキーには大文字が刻印されているが、
 * 画面のローマ字は小文字なので、大文字で出すと別のものに見えてしまう。
 *
 * 光るキーが複数あることもある（「し」は s と、次の h / i のどちらでもよい）。
 * そのときは全部光らせる。どちらでもいい、が見たまま分かる。
 */
interface Props {
  /** いま押せるキー（matcher の expectedChars）。 */
  expected: readonly string[];
  /** 直前にミスしたか。枠を赤くして気づかせる。 */
  miss: boolean;
  /** 入力を受け付けていないとき（走行中・カウントダウン中）は光らせない。 */
  active: boolean;
}

export function Keyboard({ expected, miss, active }: Props) {
  return (
    <div className={`kbd${miss ? ' kbd-miss' : ''}`} aria-hidden="true">
      {KEY_ROWS.map((row, r) => (
        <div className="kbd-row" key={r}>
          {row.map((k, i) => {
            const on = active && expected.some((ch) => keyMatches(k, ch));
            const cls = ['kbd-key'];
            if (k.mod === true) cls.push('kbd-mod');
            if (on) cls.push('lit');
            if (k.code !== null && HOME_KEYS.has(k.code)) cls.push('kbd-home');
            return (
              <span
                key={`${r}-${i}`}
                className={cls.join(' ')}
                style={{ ['--span' as string]: String(k.u) }}
              >
                {/*
                  Shift の段は、その文字が無いキーでも空けておく。
                  空けないとキーごとに刻印の高さが変わってガタガタに見える。
                */}
                {k.mod !== true && <span className="kbd-shifted">{k.shifted ?? ' '}</span>}
                <span className="kbd-main">{k.label}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
