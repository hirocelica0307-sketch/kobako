import { Furigana } from '../components/Furigana';
import { OkayamaMap } from '../components/OkayamaMap';
import { getStation } from '../../data/stations';
import type { Line } from '../../data/types';

interface Props {
  lines: readonly Line[];
  index: number;
  bestOf: (lineId: string) => number | null;
}

/** 難易度を★と、ひらがなの言葉の両方で見せる。 */
export function difficultyOf(line: Line): { stars: string; word: string; rank: number } {
  const d = line.difficultyOverride ?? 40;
  if (d < 20) return { stars: '★☆☆☆☆', word: 'やさしい', rank: 1 };
  if (d < 32) return { stars: '★★☆☆☆', word: 'すこしやさしい', rank: 2 };
  if (d < 50) return { stars: '★★★☆☆', word: 'ふつう', rank: 3 };
  if (d < 76) return { stars: '★★★★☆', word: 'むずかしい', rank: 4 };
  return { stars: '★★★★★', word: 'とてもむずかしい', rank: 5 };
}

/**
 * 路線選択。
 *
 * 左に岡山県の路線図（SVG）、右に15路線の一覧（DOM）。
 * 地図だけだと「今どの路線を見ているのか」「あと何本あるのか」が分からず
 * 選びにくかったので、全部が一度に見える一覧を並べた。
 *
 * 地図はもと Canvas（320×180）に描いて拡大していたが、
 * 線も電車もギザギザで見えにくいと言われたので SVG に置き換えた。
 */
export function LineSelectScreen({ lines, index, bestOf }: Props) {
  const current = lines[index]!;
  const d = difficultyOf(current);
  const origin = getStation(current.stops[0]!);
  const dest = getStation(current.stops[current.stops.length - 1]!);
  const best = bestOf(current.id);

  return (
    <div className="mapselect">
      <OkayamaMap selectedId={current.id} color={current.lineColor} />

      <div className="mapselect-head">
        <Furigana kana="ろせん">路線</Furigana>を えらんでください
        <span className="ms-count">{index + 1} / {lines.length}</span>
      </div>

      {/* 右側の一覧。15本すべてを一度に見せる */}
      <ul className="linelist">
        {lines.map((l, i) => {
          const ld = difficultyOf(l);
          return (
            <li key={l.id} className={`ll-row${i === index ? ' selected' : ''}`}>
              <span className="ll-cursor">{i === index ? '▸' : ''}</span>
              <span className="ll-color" style={{ background: l.lineColor }} />
              <span className="ll-name">
                <Furigana kana={l.nameKana}>{l.nameJp}</Furigana>
              </span>
              <span className={`ll-stars r${ld.rank}`}>{ld.stars}</span>
            </li>
          );
        })}
      </ul>

      {/* 選択中の路線の詳細 */}
      <div className="mapselect-card" style={{ ['--line-color' as string]: current.lineColor }}>
        <div className="ms-title">
          <span className="ms-type">{current.trainType}</span>
          <Furigana kana={current.nameKana}>{current.nameJp}</Furigana>
          {current.nickname !== undefined && <span className="ms-nick">（{current.nickname}）</span>}
        </div>
        <div className="ms-route">
          <Furigana kana={origin.kana}>{origin.kanji}</Furigana>
          <span className="ms-arrow">▸▸</span>
          <Furigana kana={dest.kana}>{dest.kanji}</Furigana>
        </div>
        <div className="ms-facts">
          <span className="ms-word">{d.word}</span>
          <span>{current.stops.length}えき</span>
          <span className="ms-best">{best === null ? 'きろくなし' : `¥${best.toLocaleString('ja-JP')}`}</span>
        </div>
      </div>

      <div className="mapselect-hint">↑↓ で えらんで Enter　[Esc] もどる</div>
    </div>
  );
}
