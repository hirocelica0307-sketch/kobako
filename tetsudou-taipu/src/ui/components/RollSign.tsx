interface Props {
  trainType: string;
  lineName: string;
  destination: string;
  lineColor: string;
}

/** 方向幕。路線カラーを地にして、いまどの路線に乗っているかを一目で分かるようにする。 */
export function RollSign({ trainType, lineName, destination, lineColor }: Props) {
  return (
    <div className="rollsign" style={{ ['--sign-color' as string]: lineColor }}>
      <div className="rollsign-top">
        <span className="rollsign-type">{trainType}</span>
        <span className="rollsign-dest">{destination}</span>
      </div>
      <div className="rollsign-line">{lineName}</div>
    </div>
  );
}
