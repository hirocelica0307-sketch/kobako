/* フリーボード：一度 ひらけば インターネット なしでも ひらける ように する。
 * ネットに つながる ときは いつも 新しい ものを とりに いき（3びょう まで まつ）、
 * つながらない ときだけ 前に とって おいた ものを 出す。
 * PDF の 日本語の 文字の 表（lib/pdfjs/cmaps/）は 169こ あるので、つかった ときに おぼえる。 */
var CACHE="free-board-v2";
var FILES=["./","./index.html","./style.css","./logic.js","./app.js","./manifest.webmanifest",
  "./lib/pdfjs/pdf.min.js","./lib/pdfjs/pdf.worker.min.js","./lib/pdfjs/wasm/jbig2.wasm","./lib/pdfjs/wasm/openjpeg.wasm",
  "./lib/pdfjs/wasm/qcms_bg.wasm","./lib/pdfjs/iccs/CGATS001Compat-v2-micro.icc",
  "./assets/icon/app-icon-32.png","./assets/icon/app-icon-192.png","./assets/icon/app-icon-512.png",
  "./assets/icon/maskable-512.png","./assets/icon/apple-touch-icon.png"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES)}));
  self.skipWaiting();
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf("free-board-")===0&&k!==CACHE})
      .map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
  var net=fetch(req).then(function(r){
    if(r.ok){var c=r.clone();caches.open(CACHE).then(function(x){x.put(req,c)})}
    return r;
  });
  var slow=new Promise(function(_,ng){setTimeout(ng,3000)});
  e.respondWith(Promise.race([net,slow]).catch(function(){
    return caches.match(req,{ignoreSearch:true}).then(function(r){
      return r||(req.mode==="navigate"?caches.match("./index.html"):net);
    });
  }));
});
