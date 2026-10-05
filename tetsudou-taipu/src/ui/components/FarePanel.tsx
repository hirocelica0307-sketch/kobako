import { useEffect, useRef, useState } from 'react';

/**
 * 運賃とお客さんの数を大きく出すパネル。
 *
 * HUD の隅に小さく出していたときは「増えているのが分からない」と言われた。
 * 数字がパッと差し替わるだけだと、増えた瞬間を見逃してしまう。
 * そこで
 *   - 数字は**カウントアップ**して増える（動くので目が行く）
 *   - 増えた額を +¥190 と一瞬大きく出す
 *   - 次の駅でいくら増えるかを、打った分だけ伸びるゲージで先に見せる
 * の3つで「打つとお金が増える」を見えるようにしている。
 */

/** 目標値まで 0.45 秒で寄せる。差が1未満になったら確定させる。 */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const raf = useRef(0);
  const from = useRef(target);
  const start = useRef(0);

  useEffect(() => {
    if (shown === target) return;
    from.current = shown;
    start.current = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start.current) / 450, 1);
      // 終わりぎわをゆっくりにすると「止まった」のが分かりやすい
      const e = 1 - (1 - t) * (1 - t);
      const v = from.current + (target - from.current) * e;
      setShown(t >= 1 ? target : Math.round(v));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // shown を依存に入れると毎フレーム作り直しになるので target だけ見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return shown;
}

/** 値が増えたときだけ「+N」を一定時間だけ出す。 */
function useGain(value: number, life = 1100): number | null {
  const [gain, setGain] = useState<number | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (delta <= 0) return;
    setGain(delta);
    const id = setTimeout(() => setGain(null), life);
    return () => clearTimeout(id);
  }, [value, life]);

  return gain;
}

interface Props {
  fare: number;
  bonus: number;
  onboard: number;
  passengersTotal: number;
  /** 次の駅に着いたら増える額。打つ前から見せる。 */
  nextFareIncrease: number;
  /** いまの駅をどれだけ打てたか 0..1。ゲージの伸びに使う。 */
  progress: number;
}

const yen = (n: number) => n.toLocaleString('ja-JP');

export function FarePanel({ fare, bonus, onboard, passengersTotal, nextFareIncrease, progress }: Props) {
  const shownFare = useCountUp(fare);
  const shownPax = useCountUp(passengersTotal);
  const fareGain = useGain(fare);
  const paxGain = useGain(passengersTotal);

  return (
    <div className="farepanel">
      <div className="fp-block">
        <div className="fp-label">うんちん</div>
        <div className={`fp-value${fareGain !== null ? ' bump' : ''}`}>
          <span className="fp-yen">¥</span>{yen(shownFare)}
        </div>
        {fareGain !== null && <div className="fp-gain">+¥{yen(fareGain)}</div>}
        {bonus > 0 && <div className="fp-bonus">ボーナス +¥{yen(bonus)}</div>}
      </div>

      {/* 打つほど伸びるゲージ。満タンになると上の運賃がその額だけ増える。 */}
      <div className="fp-next">
        <div className="fp-next-head">
          {/*
            本物の運賃は距離で段が決まるので、1駅進んでも変わらないことがある。
            そこで「+¥0」とは出さない。増えないことを言葉で伝える。
          */}
          {nextFareIncrease > 0
            ? <>つぎの えきで <b>+¥{yen(nextFareIncrease)}</b></>
            : <>つぎの えきは <b>おなじ</b> うんちん</>}
        </div>
        <div className="fp-gauge">
          <div className="fp-gauge-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <div className="fp-block">
        <div className="fp-label">おきゃくさん</div>
        <div className={`fp-value fp-pax${paxGain !== null ? ' bump' : ''}`}>
          {yen(shownPax)}<span className="fp-unit">にん</span>
        </div>
        {paxGain !== null && <div className="fp-gain">+{paxGain}にん のった</div>}
        <div className="fp-bonus">いま しゃないに {onboard}にん</div>
      </div>
    </div>
  );
}
