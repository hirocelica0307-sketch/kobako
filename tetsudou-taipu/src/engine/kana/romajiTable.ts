/**
 * ローマ字テーブル。
 *
 * 手書きするのは3つだけ:
 *   BASE    … 基本かな単独の綴り
 *   SMALL   … 小書きかな単独の綴り（x/l 系のみ。'ya' 等を入れると「しや」と衝突する）
 *   DIGRAPH … 拗音の短縮形（機械生成できないもの）
 *
 * 拗音ノードの綴り = DIGRAPH ∪ { BASE[基本] × SMALL[小書き] }
 */

export const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/** 基本かな単独。配列の先頭が preferred（ヒント表示の既定）。 */
export const BASE: Readonly<Record<string, readonly string[]>> = {
  あ: ['a'], い: ['i', 'yi'], う: ['u', 'wu', 'whu'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  だ: ['da'], ぢ: ['di'], づ: ['du', 'dzu'], で: ['de'], ど: ['do'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], ゐ: ['wi'], ゑ: ['we'], を: ['wo'],
  ゔ: ['vu'],
};

/**
 * 小書きかな単独。
 * 'ya' / 'a' のような裸の綴りは絶対に入れない
 * （`しゃ` の生成で `shiya` が出てしまい、「しや」と区別できなくなる）。
 */
export const SMALL: Readonly<Record<string, readonly string[]>> = {
  ぁ: ['xa', 'la'], ぃ: ['xi', 'li', 'xyi', 'lyi'], ぅ: ['xu', 'lu'],
  ぇ: ['xe', 'le'], ぉ: ['xo', 'lo'],
  ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'],
  ゎ: ['xwa', 'lwa'],
  っ: ['xtu', 'ltu', 'xtsu', 'ltsu'],
  ゕ: ['xka', 'lka'], ゖ: ['xke', 'lke'],
};

/** 拗音の短縮形。BASE×SMALL では作れないものだけを列挙する。 */
export const DIGRAPH: Readonly<Record<string, readonly string[]>> = {
  きゃ: ['kya'], きぃ: ['kyi'], きゅ: ['kyu'], きぇ: ['kye'], きょ: ['kyo'],
  ぎゃ: ['gya'], ぎぃ: ['gyi'], ぎゅ: ['gyu'], ぎぇ: ['gye'], ぎょ: ['gyo'],
  しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しぇ: ['she', 'sye'], しょ: ['sho', 'syo'],
  しぃ: ['syi'],
  じゃ: ['ja', 'zya', 'jya'], じゅ: ['ju', 'zyu', 'jyu'],
  じぇ: ['je', 'zye', 'jye'], じょ: ['jo', 'zyo', 'jyo'], じぃ: ['zyi', 'jyi'],
  ちゃ: ['cha', 'tya', 'cya'], ちゅ: ['chu', 'tyu', 'cyu'],
  ちぇ: ['che', 'tye', 'cye'], ちょ: ['cho', 'tyo', 'cyo'], ちぃ: ['tyi', 'cyi'],
  ぢゃ: ['dya'], ぢゅ: ['dyu'], ぢぇ: ['dye'], ぢょ: ['dyo'], ぢぃ: ['dyi'],
  にゃ: ['nya'], にぃ: ['nyi'], にゅ: ['nyu'], にぇ: ['nye'], にょ: ['nyo'],
  ひゃ: ['hya'], ひぃ: ['hyi'], ひゅ: ['hyu'], ひぇ: ['hye'], ひょ: ['hyo'],
  びゃ: ['bya'], びぃ: ['byi'], びゅ: ['byu'], びぇ: ['bye'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴぃ: ['pyi'], ぴゅ: ['pyu'], ぴぇ: ['pye'], ぴょ: ['pyo'],
  みゃ: ['mya'], みぃ: ['myi'], みゅ: ['myu'], みぇ: ['mye'], みょ: ['myo'],
  りゃ: ['rya'], りぃ: ['ryi'], りゅ: ['ryu'], りぇ: ['rye'], りょ: ['ryo'],
  ふぁ: ['fa', 'fwa'], ふぃ: ['fi', 'fwi', 'fyi'], ふぇ: ['fe', 'fwe', 'fye'],
  ふぉ: ['fo', 'fwo'], ふゅ: ['fyu'], ふょ: ['fyo'],
  てぃ: ['thi'], てぇ: ['the'], てゃ: ['tha'], てゅ: ['thu'], てょ: ['tho'],
  でぃ: ['dhi'], でぇ: ['dhe'], でゃ: ['dha'], でゅ: ['dhu'], でょ: ['dho'],
  とぁ: ['twa'], とぃ: ['twi'], とぅ: ['twu'], とぇ: ['twe'], とぉ: ['two'],
  どぁ: ['dwa'], どぃ: ['dwi'], どぅ: ['dwu'], どぇ: ['dwe'], どぉ: ['dwo'],
  つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
  うぁ: ['wha'], うぃ: ['wi', 'whi'], うぇ: ['we', 'whe'], うぉ: ['who'],
  ゔぁ: ['va'], ゔぃ: ['vi', 'vyi'], ゔぇ: ['ve', 'vye'], ゔぉ: ['vo'],
  ゔゃ: ['vya'], ゔゅ: ['vyu'], ゔょ: ['vyo'],
  くぁ: ['qa', 'kwa', 'qwa'], くぃ: ['qi', 'qwi', 'qyi'], くぅ: ['qwu'],
  くぇ: ['qe', 'qwe', 'qye'], くぉ: ['qo', 'qwo'],
  ぐぁ: ['gwa'], ぐぃ: ['gwi'], ぐぅ: ['gwu'], ぐぇ: ['gwe'], ぐぉ: ['gwo'],
  すぁ: ['swa'], すぃ: ['swi'], すぅ: ['swu'], すぇ: ['swe'], すぉ: ['swo'],
};

/** 小書きかな（拗音の後半になりうる文字）。 */
export const SMALL_KANA = new Set(Object.keys(SMALL));

/** 撥音 `ん` の直後に来ると、単独 "n" での確定を許さないかな。 */
export const N_BLOCKING_HEADS = new Set([
  'あ', 'い', 'う', 'え', 'お',
  'な', 'に', 'ぬ', 'ね', 'の',
  'や', 'ゆ', 'よ',
  'ん',
  'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ',
]);

/** 長音符の綴り。 */
export const CHOON_PATTERNS: readonly string[] = ['-'];

/** 撥音の綴り（"n" は文脈により先頭に追加される）。 */
export const HATSUON_PATTERNS: readonly string[] = ['nn', 'xn', "n'"];

/** 促音単独（次のかなが無い、語尾の「っ」）の綴り。 */
export const SOKUON_STANDALONE: readonly string[] = ['xtu', 'ltu', 'xtsu', 'ltsu'];
