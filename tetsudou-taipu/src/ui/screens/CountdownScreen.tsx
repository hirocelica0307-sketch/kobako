interface Props {
  count: number;
  departureCall: boolean;
  lineName: string;
  destination: string;
}

/** 3 → 2 → 1 のあと、笛とともに「出発進行！」で発車する。 */
export function CountdownScreen({ count, departureCall, lineName, destination }: Props) {
  if (departureCall) {
    return (
      <div className="overlay">
        <div className="departure-call">
          <div className="dc-main">出発進行！</div>
          <div className="dc-sub">しゅっぱつ しんこう</div>
        </div>
      </div>
    );
  }
  return (
    <div className="overlay">
      <div className="panel">
        <div className="title-sub">{lineName}　{destination}ゆき</div>
        <div className="big">{count}</div>
        <div className="keyhint">日本語入力（IME）が OFF か たしかめてください</div>
      </div>
    </div>
  );
}
