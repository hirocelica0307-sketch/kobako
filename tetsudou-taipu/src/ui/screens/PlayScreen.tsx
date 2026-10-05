import { FarePanel } from '../components/FarePanel';
import { RailStrip } from '../components/RailStrip';
import { RollSign } from '../components/RollSign';
import { TimerBar } from '../components/TimerBar';
import type { Snapshot } from '../../engine/game/engine';

interface Props { snap: Snapshot }

export function PlayScreen({ snap }: Props) {
  return (
    <div className="hud">
      <div className="hud-top">
        <RollSign
          trainType={snap.trainType}
          lineName={snap.lineName}
          destination={snap.destination}
          lineColor={snap.lineColor}
        />
        <TimerBar remain={snap.remainSec} limit={snap.timeLimit} />
        <span className="hud-value">{snap.remainSec.toFixed(1)}s</span>
        {snap.combo > 1 && <span className="combo">COMBO {snap.combo}</span>}
        <span className="weather-badge">{snap.weatherLabel}</span>
        {/* 一時停止できることが分からないと、やめたいときに困る */}
        <span className="hud-esc">[Esc] メニュー</span>
      </div>

      {/*
        運賃とお客さんは上のバーではなく、専用のパネルに大きく出す。
        バーの端に小さく並べていたときは増えたことに気づいてもらえなかった。
      */}
      <FarePanel
        fare={snap.baseFare}
        bonus={snap.bonus}
        onboard={snap.onboard}
        passengersTotal={snap.passengersTotal}
        nextFareIncrease={snap.nextFareIncrease}
        progress={snap.stationProgress}
      />

      <div className="toasts">
        {snap.toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>

      {snap.phase === 'turnaround' ? (
        <div className="turnaround-banner">
          <div className="turnaround-title">終点 — 折り返します</div>
          <div className="turnaround-sub">まもなく {snap.destination} 方面へ発車します</div>
        </div>
      ) : (
        <RailStrip snap={snap} />
      )}
    </div>
  );
}
