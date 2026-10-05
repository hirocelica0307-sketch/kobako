interface Props { remain: number; limit: number }

export function TimerBar({ remain, limit }: Props) {
  const ratio = Math.max(0, Math.min(1, remain / limit));
  const low = remain <= 10;
  return (
    <div className="timer-bar" role="timer" aria-label="残り時間">
      <div className={`timer-fill${low ? ' low' : ''}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
