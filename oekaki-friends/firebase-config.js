/* このアプリが つかう Firebase の 設定
   ------------------------------------------------------------------
   index.html / room.html / odaieditor.html / wordstats.html の
   4つが この1ファイルを 読みます。
   Firebase を つくりなおしたら、下の5行を 書きかえるだけで
   4つ全部に 反映されます（HTML は さわらなくて よいです）。

   書きかえる 値の とりかたは README.md の
   「Firebase を つくりなおす」を みてください。
   ------------------------------------------------------------------ */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBsf_UntQvkfRl0fZijHBYH7Ctm00OPLZY",
    authDomain: "hiro-kobako.firebaseapp.com",
    databaseURL: "https://hiro-kobako-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hiro-kobako",
    appId: "1:781860379018:web:745ea72a961a7575aa9073"
};
