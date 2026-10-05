import type { RunSummary } from '../../engine/game/scoring';
import { storageFailed, ticketNumber } from '../../storage/save';

interface Props {
  summary: RunSummary;
  lineColor: string;
  isNewRecord: boolean;
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 正確率に応じたひとこと。数字だけだと小学生には手応えが伝わらない。 */
function praise(accuracy: number, reached: number): string {
  if (accuracy >= 99) return 'かんぺき！ ミスが ほとんど ありません';
  if (accuracy >= 95) return 'すばらしい！ とても せいかくです';
  if (accuracy >= 88) return 'いい ちょうし！ この ちょうしで つづけましょう';
  if (reached >= 5) return 'よく ここまで こられました';
  return 'ゆっくりでも だいじょうぶ。もう いちど どうぞ';
}

/**
 * リザルト＝乗車券。
 * 以前は8項目あって小学生には多すぎたので、4つに絞ってひらがなの見出しにした。
 * KPM・WPM・営業キロ・コンボは RunSummary には残してあるので、記録内容は変わらない。
 */
export function Ticket({ summary: s, lineColor, isNewRecord }: Props) {
  return (
    <div className="ticket-wrap">
      <div className="ticket-panel">
        <div className="ticket" style={{ ['--ticket-color' as string]: lineColor }}>
          {isNewRecord && <div className="new-record">しんきろく！</div>}

          <div className="ticket-head">
            <div className="ticket-title">じょうしゃけん</div>
            <div className="ticket-fare">{yen(s.fare)}</div>
          </div>

          <div className="ticket-route">
            <div className="ticket-stn">
              <div className="ticket-stn-kanji">{s.originKanji}</div>
              <div className="ticket-stn-kana">{s.originKana}</div>
            </div>
            <div className="ticket-arrow">▸▸▸</div>
            <div className="ticket-stn">
              <div className="ticket-stn-kanji">{s.reachedKanji}</div>
              <div className="ticket-stn-kana">{s.reachedKana}</div>
            </div>
          </div>

          <div className="ticket-cards">
            <div className="tcard">
              <div className="tcard-label">うんちん</div>
              <div className="tcard-value">{yen(s.baseFare)}</div>
            </div>
            <div className="tcard">
              <div className="tcard-label">ついたえき</div>
              <div className="tcard-value">{s.reachedCount}<small>えき</small></div>
            </div>
            <div className="tcard">
              <div className="tcard-label">のせたおきゃくさん</div>
              <div className="tcard-value">{s.passengers.toLocaleString('ja-JP')}<small>にん</small></div>
            </div>
            <div className="tcard">
              <div className="tcard-label">せいかくりつ</div>
              <div className="tcard-value">{s.accuracy.toFixed(1)}<small>%</small></div>
            </div>
          </div>

          <div className="ticket-praise">▸ {praise(s.accuracy, s.reachedCount)}</div>
          <div className="ticket-sub">
            うんちん {yen(s.baseFare)} ＋ ボーナス {yen(s.bonus)}　／　
            うった もじ {s.keystrokes.toLocaleString('ja-JP')}　／　
            えいぎょうキロ {s.km.toFixed(1)}km
          </div>

          <div className="ticket-foot">
            <span className="punch" />
            <span>{today()}　{s.lineName}　({ticketNumber()})</span>
          </div>

          <div className="ticket-magnetic" />
        </div>

        <div className="ticket-actions">
          <b>[R]</b> もう いちど　<b>[Esc]</b> タイトルへ
        </div>
        <div className="ticket-disclaimer">
          うんちんは ゲームようの けいさんで、じっさいの ねだんとは ちがいます。
          {storageFailed() && <span className="storage-warn">　きろくを ほぞんできませんでした。</span>}
        </div>
      </div>
    </div>
  );
}
