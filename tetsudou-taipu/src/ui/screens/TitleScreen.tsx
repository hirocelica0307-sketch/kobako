import { Furigana } from '../components/Furigana';

interface Props {
  best: number | null;
  lineName: string;
  lineKana: string;
  destination: string;
  timeLimit: number;
  pointerCoarse: boolean;
}

export function TitleScreen({ best, lineName, lineKana, destination, timeLimit, pointerCoarse }: Props) {
  return (
    <div className="overlay soft">
      <div>
        <div className="title-logo">岡山鉄道タイピング</div>
        <div className="title-sub">OKAYAMA RAIL TYPING</div>

        <div className="title-meta">
          <Furigana kana={lineKana}>{lineName}</Furigana>　{destination}ゆき<br />
          {timeLimit}びょうの さいこううんちん　
          {best === null ? 'きろくなし' : `¥${best.toLocaleString('ja-JP')}`}
        </div>

        <div className="title-press">▶ PRESS SPACE</div>

        <div className="keyhint">
          えきめいを ローマ字で うちます。日本語入力は<b>OFF</b>にしてください。
        </div>
        <div className="keyhint">M キーで 音を けせます</div>
        {pointerCoarse && <div className="keyhint warn">※パソコンのキーボードでんよう です</div>}
      </div>
    </div>
  );
}
