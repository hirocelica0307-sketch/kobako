/* 毎日教養：一度ひらけば、インターネットにつながっていなくてもひらけるようにする。
 * つながるときはいつも新しいものを取りにいき（3秒まで待つ）、つながらないときだけ前に取っておいたものを出す。 */
var CACHE = "mainichi-kyouyou-v1";
var GENRES = ["seiji", "keizai", "business", "chiri", "nihonshi", "sekaishi", "tetsugaku", "shukyo", "shinri", "bungaku",
  "bijutsu", "ongaku", "geinou", "sports", "kagaku", "seibutsu", "it", "suugaku", "kotoba", "kurashi"];
var FILES = ["./", "./index.html", "./style.css", "./logic.js", "./app.js", "./manifest.webmanifest", "./assets/icons.js",
  "./data/_base.js", "./assets/emoji/owl.webp", "./assets/emoji/fire.webp", "./assets/emoji/bulb.webp", "./assets/emoji/trophy.webp",
  "./assets/icon/app-icon-32.png", "./assets/icon/app-icon-192.png", "./assets/icon/apple-touch-icon.png"]
  .concat(GENRES.map(function (g) { return "./data/" + g + ".js"; }))
  .concat(GENRES.map(function (g) { return "./assets/genre/" + g + ".webp"; }));

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("mainichi-kyouyou-") === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  var net = fetch(req).then(function (r) {
    if (r.ok) { var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(req, c); }); }
    return r;
  });
  var slow = new Promise(function (_, ng) { setTimeout(ng, 3000); });
  e.respondWith(Promise.race([net, slow]).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || (req.mode === "navigate" ? caches.match("./index.html") : net);
    });
  }));
});
