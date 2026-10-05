export type StationId = string;
export type LineId = string;
export type VehicleId =
  | '115-yellow' | '213-marine' | '105-red' | 'kiha40-orange'
  | 'kiha120-mizurin' | 'hot7000' | 'ibara' | 'momo-tram' | 'n700-shinkansen';

export type SceneKind =
  | 'city' | 'suburb' | 'rural' | 'mountain' | 'tunnel'
  | 'bridge' | 'sea' | 'river' | 'street';

export type StationSpriteKind =
  | 'urban' | 'rural' | 'terminal' | 'tram-stop' | 'shinkansen' | 'unmanned';

/** 名所・特産のドット絵の種類。render/sprites/landmarks.ts と対応する。 */
export type LandmarkId =
  | 'castle' | 'peach' | 'kura' | 'denim' | 'dome' | 'campus'
  | 'torii' | 'wisteria' | 'brickkiln' | 'brewery' | 'thatched'
  | 'ruins' | 'somen' | 'ramen' | 'horseshoecrab' | 'shinkansen'
  | 'shrinehall' | 'atom' | 'junction' | 'gate'
  | 'pagoda' | 'turtle' | 'tatami' | 'ferry'
  | 'setoohashi' | 'cave' | 'udon' | 'onsen'
  | 'sword' | 'pottery' | 'oyster' | 'heart' | 'kombinat';

export interface Landmark {
  readonly sprite: LandmarkId;
  /** 券面やキャプションに出す名前。 */
  readonly label: string;
}

export interface Station {
  readonly id: StationId;
  readonly kanji: string;
  /** 読み。入力判定の唯一のソース。ローマ字は engine が導出する。 */
  readonly kana: string;
  readonly pref: '岡山' | '兵庫' | '鳥取' | '広島' | '香川';
  /** 難読駅。難易度計算に使う。 */
  readonly rare?: boolean;
  readonly sprite?: StationSpriteKind;
  /** その駅ならではの名所・特産。確証が無い駅は空にしておく（推測で埋めない）。 */
  readonly landmarks?: readonly Landmark[];
  /** 停車時に出すトリビア。 */
  readonly note?: string;
  /** 読みの出典を確認済みか。 */
  readonly verified: boolean;
}

export interface Segment {
  readonly from: StationId;
  readonly to: StationId;
  /** 営業キロ。 */
  readonly km: number;
  readonly scene: SceneKind;
}

export interface Line {
  readonly id: LineId;
  readonly nameJp: string;
  readonly nameKana: string;
  readonly nickname?: string;
  readonly company: 'JR西日本' | '岡山電気軌道' | '水島臨海鉄道' | '井原鉄道' | '智頭急行';
  /** HUD・方向幕・切符の帯に使う路線カラー。 */
  readonly lineColor: string;
  readonly vehicle: VehicleId;
  /** 下り方向の行先。折り返すと origin が行先になる。 */
  readonly destination: string;
  /** 上り方向（折り返し後）の行先。 */
  readonly originName: string;
  readonly trainType: string;
  /** 起点→終点の順。 */
  readonly stops: readonly StationId[];
  readonly segments: readonly Segment[];
  readonly fareRule: string;
  /** 新幹線・特急の料金を上乗せする。 */
  readonly surchargeRule?: 'shinkansen' | 'ltd-express';
  readonly difficultyOverride?: number;
  readonly hideRomajiDefault?: boolean;
  readonly scopeNote?: string;
}
