/* 牌の データ
   ------------------------------------------------------------------
   牌は 136枚。id は 0〜135、種類（kind）は id を 4で わった 数（0〜33）。
     0〜8   萬子 1〜9
     9〜17  筒子 1〜9
     18〜26 索子 1〜9
     27〜30 東 南 西 北
     31〜33 白 發 中
   赤ドラ：各 5 の 1枚め（id 16・52・88）。ルールで 赤なしの ときは ふつうの 5。
   ------------------------------------------------------------------ */

export const KINDS = 34;
export const RED_IDS = [16, 52, 88];

export const kindOf = id => id >> 2;
export const isRedId = id => id === 16 || id === 52 || id === 88;
export const suitOf = k => (k < 27 ? Math.floor(k / 9) : 3);      // 0萬 1筒 2索 3字
export const numOf = k => (k < 27 ? (k % 9) + 1 : 0);
export const isHonor = k => k >= 27;
export const isTerminal = k => k < 27 && (k % 9 === 0 || k % 9 === 8);
export const isYaochu = k => k >= 27 || k % 9 === 0 || k % 9 === 8;
export const isDragon = k => k >= 31;
export const isWind = k => k >= 27 && k <= 30;
export const YAOCHU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
export const GREEN = new Set([19, 20, 21, 23, 25, 32]);            // 2・3・4・6・8索・發

export const WIND_NAMES = ['東', '南', '西', '北'];
const HONOR_NAMES = ['東', '南', '西', '北', '白', '發', '中'];
const SUIT_NAMES = ['萬', '筒', '索'];
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 牌の なまえ（例：五萬・赤五筒・東） */
export function tileName(k, red = false) {
    if (k >= 27) return HONOR_NAMES[k - 27];
    return (red ? '赤' : '') + KANJI_NUM[k % 9] + SUIT_NAMES[Math.floor(k / 9)];
}

/** ドラ表示牌から ドラの 種類 */
export function doraFromIndicator(k) {
    if (k < 27) return Math.floor(k / 9) * 9 + ((k % 9) + 1) % 9;
    if (k <= 30) return 27 + ((k - 27) + 1) % 4;
    return 31 + ((k - 31) + 1) % 3;
}

const FILE_NAMES = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => 'Man' + n),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => 'Pin' + n),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => 'Sou' + n),
    'Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'
];

/** 牌の 絵の ファイル（assets/tiles/） */
export function tileImage(id, redRule = true) {
    const k = kindOf(id);
    let f = FILE_NAMES[k];
    if (redRule && isRedId(id)) f += '-Dora';
    return 'assets/tiles/' + f + '.svg';
}

/** 牌の ならべかえ用の キー（赤5は ふつうの 5の すぐ前） */
export const sortKey = id => kindOf(id) * 4 + (isRedId(id) ? 0 : 1 + (id & 3));
export const sortTiles = ids => ids.slice().sort((a, b) => sortKey(a) - sortKey(b));

/** id の ならびを 種類ごとの 数（34こ）に */
export function toCounts(ids) {
    const c = new Array(KINDS).fill(0);
    for (const id of ids) c[id >> 2]++;
    return c;
}
