/**
 * ひらがなキーボード（お試し版）
 * 小学校低学年むけ 短文入力ツール
 * © Hiroyuki
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ひらがなキーボード')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** index.html から <?!= include('辞書') ?> などで呼び出す */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 * スプレッドシートとの つなぎ
 *
 * SHEET_ID を入れるだけで、先生がスプレッドシートから
 * 「辞書」と「ことばパレット」を編集できるようになります。
 * 空のままでも、アプリは中に持っている辞書だけで動きます。
 *
 * 【シート1】 じしょ
 *   A列: よみ（ひらがな）   B列: ひょうき（漢字など）
 *   例:  うんどうかい        運動会
 *   例:  うんどうかい        運(うん)動(どう)会(かい)
 *   ※ 2つめの 書きかたに すると、ならっていない 漢字だけ ひらがなに なります
 *      （2年なら「うんどう会」）。1つめの 書きかたの ときは、
 *      ぜんぶの 漢字を ならった 学年から 出ます。
 *   ※ C列以降は自由に使ってかまいません（読み飛ばします）
 *
 * 【シート2】 ことばパレット
 *   A列: カテゴリ   B列: ボタンの字   C列: 入れる文字   D列: えもじ
 *   例:  きもち      うれしい          うれしかったです。   😊
 *   ※ カテゴリを1つでも書くと、アプリ内蔵のパレットの
 *      その カテゴリ が置きかわります。
 *
 * どちらのシートも 1行目は見出し行として読み飛ばします。
 * ============================================================ */

var SHEET_ID    = '';              // 例: '1AbC...xyz'
var SH_DICT     = 'じしょ';
var SH_PALETTE  = 'ことばパレット';
var CACHE_SEC   = 21600;           // 6時間

/**
 * 画面から google.script.run.getBundle() で1回だけ呼ばれます。
 * 往復を1回に まとめてあるので 起動が速くなります。
 */
function getBundle() {
  if (!SHEET_ID) return { dict: {}, palette: {} };

  var cache = CacheService.getScriptCache();
  var hit = cache.get('bundle');
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }

  var out = { dict: {}, palette: {} };
  var ss;
  try { ss = SpreadsheetApp.openById(SHEET_ID); }
  catch (e) { return out; }

  // ---- じしょ ----
  var sh = ss.getSheetByName(SH_DICT);
  if (sh && sh.getLastRow() > 1) {
    var d = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < d.length; i++) {
      var yomi = String(d[i][0]).trim();
      var word = String(d[i][1]).trim();
      if (!yomi || !word) continue;
      if (!out.dict[yomi]) out.dict[yomi] = [];
      if (out.dict[yomi].indexOf(word) === -1) out.dict[yomi].push(word);
    }
  }

  // ---- ことばパレット ----
  var sp = ss.getSheetByName(SH_PALETTE);
  if (sp && sp.getLastRow() > 1) {
    var p = sp.getRange(2, 1, sp.getLastRow() - 1, 4).getValues();
    for (var j = 0; j < p.length; j++) {
      var cat   = String(p[j][0]).trim();
      var label = String(p[j][1]).trim();
      var text  = String(p[j][2]).replace(/^\s+/, '');   // おわりの 空白は のこす（「きょうは␣」）
      var emoji = String(p[j][3] || '').trim();
      if (!cat || !label) continue;
      if (!text.trim()) text = label;
      if (!out.palette[cat]) out.palette[cat] = [];
      out.palette[cat].push([label, text, emoji]);
    }
  }

  try { cache.put('bundle', JSON.stringify(out), CACHE_SEC); } catch (e) {}
  return out;
}

/**
 * 先生用：シートを直したのに 画面に出ないときは これを実行してください。
 * （スクリプトエディタで clearCache を選んで▶を押す）
 */
function clearCache() {
  CacheService.getScriptCache().remove('bundle');
}
