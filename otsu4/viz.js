/* おつよん ― グラフの 部品（インラインSVG）
   ・色は 系列（entity）に ひもづけ、順番で 変えない
   ・たて軸は 1本だけ（2軸グラフは つくらない）
   ・2つ以上の系列には かならず 凡例。値は 選んだ所だけに 直接ラベル
   ・棒は 24px以下、はしを 4px 丸め、となりとは 2px あける
   ・線は 2px、点は 直径8px以上＋ 2px の 地色リング
   ・目もりと 線は 細い実線（点線にしない） */

var O4Viz = (function(){
'use strict';

var NS = 'http://www.w3.org/2000/svg';
function E(tag, attrs, text){
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgRoot(w, h){
  /* 大きさは CSS（.viz）で 決めます。SVGの height に auto は 書けません */
  var s = E('svg', { viewBox:'0 0 ' + w + ' ' + h, preserveAspectRatio:'xMidYMid meet',
                     role:'img', 'class':'viz' });
  return s;
}
/* 置き場所の 幅で 描く（拡大縮小しないので 文字が つぶれない） */
function width(root){
  var w = root.clientWidth || (root.parentNode && root.parentNode.clientWidth) || 640;
  return Math.max(260, Math.min(720, Math.round(w)));
}

function css(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---- ツールチップ（1つを 使いまわす） ---- */
var tip = null;
function showTip(ev, html){
  if (!tip){ tip = document.createElement('div'); tip.className = 'viz-tip'; document.body.appendChild(tip); }
  tip.innerHTML = html;
  tip.style.display = 'block';
  var x = ev.clientX, y = ev.clientY;
  tip.style.left = Math.min(x + 12, window.innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top  = Math.max(8, y - tip.offsetHeight - 12) + 'px';
}
function hideTip(){ if (tip) tip.style.display = 'none'; }
function hover(node, html){
  node.addEventListener('mouseenter', function(ev){ showTip(ev, html); });
  node.addEventListener('mousemove',  function(ev){ showTip(ev, html); });
  node.addEventListener('mouseleave', hideTip);
  node.addEventListener('touchstart', function(ev){ showTip(ev.touches[0], html); }, { passive:true });
  node.addEventListener('touchend', hideTip);
}

function niceMax(v){
  if (v <= 5) return 5;
  var p = Math.pow(10, String(Math.floor(v)).length - 1);
  return Math.ceil(v / p) * p;
}

/* ================= たて棒（1〜2系列）================= */
/* opt: { labels:[], series:[{name,color,values:[]}], unit } */
function columns(root, opt){
  var W = width(root), H = 240, padL = 34, padR = 10, padT = 14, padB = 34;
  var s = svgRoot(W, H);
  var n = opt.labels.length, ns = opt.series.length;
  var max = niceMax(Math.max(1, Math.max.apply(null, opt.series.reduce(function(a, x){ return a.concat(x.values); }, [0]))));
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var band = plotW / n;
  var barW = Math.min(24, (band - 8) / ns - 2);

  /* 目もり線 */
  [0, 0.5, 1].forEach(function(f){
    var y = padT + plotH * (1 - f);
    s.appendChild(E('line', { x1:padL, y1:y, x2:W - padR, y2:y, 'class':'viz-grid' }));
    s.appendChild(E('text', { x:padL - 6, y:y + 4, 'text-anchor':'end', 'class':'viz-axis' }, String(Math.round(max * f))));
  });

  opt.series.forEach(function(ser, si){
    ser.values.forEach(function(v, i){
      var x = padL + band * i + (band - (barW * ns + 2 * (ns - 1))) / 2 + si * (barW + 2);
      var h = v / max * plotH;
      if (h > 0){
        var y = padT + plotH - h;
        var r = Math.min(4, h);
        var d = 'M' + x + ' ' + (padT + plotH) +
                ' V' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
                ' H' + (x + barW - r) + ' Q' + (x + barW) + ' ' + y + ' ' + (x + barW) + ' ' + (y + r) +
                ' V' + (padT + plotH) + ' Z';
        var p = E('path', { d:d, fill:ser.color });
        hover(p, '<b>' + opt.labels[i] + '</b>' + ser.name + ' ' + v + (opt.unit || ''));
        s.appendChild(p);
      }
    });
  });

  /* よこ軸（多いときは 間引く） */
  var fit = Math.max(1, Math.floor(plotW / 44));
  var every = Math.ceil(n / fit);
  opt.labels.forEach(function(l, i){
    if ((n - 1 - i) % every) return;
    s.appendChild(E('text', { x:padL + band * i + band / 2, y:H - 12, 'text-anchor':'middle', 'class':'viz-axis' }, l));
  });

  root.innerHTML = '';
  root.appendChild(s);
  if (opt.series.length >= 2) root.appendChild(legend(opt.series));
}

/* ================= 折れ線（1〜3系列）================= */
/* opt: { labels, series:[{name,color,values(null可)}], max, ref:{v,label}, unit, endLabel } */
function lines(root, opt){
  var W = width(root), H = 240, padL = 34, padR = opt.endLabel ? 44 : 14, padT = 14, padB = 34;
  var s = svgRoot(W, H);
  var n = opt.labels.length;
  var max = opt.max || niceMax(Math.max.apply(null, opt.series.reduce(function(a, x){
    return a.concat(x.values.filter(function(v){ return v !== null; })); }, [1])));
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var X = function(i){ return padL + (n <= 1 ? plotW / 2 : plotW * i / (n - 1)); };
  var Y = function(v){ return padT + plotH * (1 - v / max); };

  [0, 0.5, 1].forEach(function(f){
    var y = padT + plotH * (1 - f);
    s.appendChild(E('line', { x1:padL, y1:y, x2:W - padR, y2:y, 'class':'viz-grid' }));
    s.appendChild(E('text', { x:padL - 6, y:y + 4, 'text-anchor':'end', 'class':'viz-axis' }, Math.round(max * f) + (opt.unit || '')));
  });

  /* 目じるしの線（合格ラインなど） */
  var refLabel = null;
  if (opt.ref){
    var ry = Y(opt.ref.v);
    s.appendChild(E('line', { x1:padL, y1:ry, x2:W - padR, y2:ry, 'class':'viz-ref' }));
    /* 目じるしの ことばは 線や 点と 重なるので、地色の 下じきを 敷く */
    var bg = E('rect', { x:W - padR - 86, y:ry - 18, width:86, height:15, rx:3, 'class':'viz-labbg' });
    refLabel = E('text', { x:W - padR, y:ry - 6, 'text-anchor':'end', 'class':'viz-axis' }, opt.ref.label);
    s.appendChild(bg); s.appendChild(refLabel);
  }

  opt.series.forEach(function(ser){
    var pts = [], d = '', started = false;
    ser.values.forEach(function(v, i){
      if (v === null || v === undefined){ started = false; return; }
      var x = X(i), y = Y(v);
      d += (started ? ' L' : ' M') + x + ' ' + y;
      started = true;
      pts.push({ x:x, y:y, v:v, i:i });
    });
    if (d) s.appendChild(E('path', { d:d.trim(), fill:'none', stroke:ser.color, 'stroke-width':2,
                                     'stroke-linejoin':'round', 'stroke-linecap':'round' }));
    pts.forEach(function(p){
      s.appendChild(E('circle', { cx:p.x, cy:p.y, r:5, fill:ser.color, 'class':'viz-dot' }));
      var hit = E('circle', { cx:p.x, cy:p.y, r:12, fill:'transparent' });
      hover(hit, '<b>' + opt.labels[p.i] + '</b>' + ser.name + ' ' + p.v + (opt.unit || ''));
      s.appendChild(hit);
    });
    /* 終わりの点にだけ 値を そえる */
    if (opt.endLabel && pts.length){
      var last = pts[pts.length - 1];
      s.appendChild(E('text', { x:last.x + 8, y:last.y + 4, 'class':'viz-axis' }, last.v + (opt.unit || '')));
    }
  });

  var fit = Math.max(1, Math.floor(plotW / 44));
  var every = Math.ceil(n / fit);
  opt.labels.forEach(function(l, i){
    if ((n - 1 - i) % every) return;
    s.appendChild(E('text', { x:X(i), y:H - 12, 'text-anchor':'middle', 'class':'viz-axis' }, l));
  });
  if (refLabel){ s.appendChild(refLabel.previousSibling); s.appendChild(refLabel); }

  root.innerHTML = '';
  root.appendChild(s);
  if (opt.series.length >= 2) root.appendChild(legend(opt.series));
}

/* ================= よこ棒（分類ごと・値を 直接ラベル）================= */
/* opt: { rows:[{label,value,color,note}], max, unit } */
function hbars(root, opt){
  var rows = opt.rows, rowH = 34, W = width(root), H = rows.length * rowH + 8;
  var labW = Math.min(112, Math.round(W * 0.34)), padR = 52;
  var s = svgRoot(W, H);
  var max = opt.max || niceMax(Math.max.apply(null, rows.map(function(r){ return r.value; }).concat([1])));
  rows.forEach(function(r, i){
    var y = i * rowH + 6, h = Math.min(24, rowH - 14);
    s.appendChild(E('text', { x:0, y:y + h / 2 + 5, 'class':'viz-axis' }, r.label));
    var full = W - labW - padR;
    s.appendChild(E('rect', { x:labW, y:y, width:full, height:h, rx:4, 'class':'viz-track' }));
    var w = Math.max(0, r.value / max * full);
    if (w > 0){
      var rr = Math.min(4, w);
      var d = 'M' + labW + ' ' + y + ' H' + (labW + w - rr) + ' Q' + (labW + w) + ' ' + y + ' ' + (labW + w) + ' ' + (y + rr) +
              ' V' + (y + h - rr) + ' Q' + (labW + w) + ' ' + (y + h) + ' ' + (labW + w - rr) + ' ' + (y + h) +
              ' H' + labW + ' Z';
      var p = E('path', { d:d, fill:r.color });
      hover(p, '<b>' + r.label + '</b>' + r.value + (opt.unit || '') + (r.note ? '<br>' + r.note : ''));
      s.appendChild(p);
    }
    s.appendChild(E('text', { x:W - 4, y:y + h / 2 + 5, 'text-anchor':'end', 'class':'viz-val' },
                    r.value + (opt.unit || '')));
  });
  root.innerHTML = '';
  root.appendChild(s);

  /* ラベルが 入りきらないときは 切って「…」。全文は ツールチップと 表に のこる */
  Array.prototype.forEach.call(s.querySelectorAll('text.viz-axis'), function(t, i){
    var full = rows[i] ? rows[i].label : t.textContent;
    var limit = labW - 8, guard = 0;
    while (t.getComputedTextLength() > limit && t.textContent.length > 2 && guard++ < 40){
      t.textContent = t.textContent.replace(/…$/, '').slice(0, -1) + '…';
    }
    if (t.textContent !== full){
      var ttl = E('title', {}, full);
      t.appendChild(ttl);
      hover(t, '<b>' + full + '</b>' + (rows[i] ? rows[i].value + (opt.unit || '') : ''));
    }
  });
}

/* ================= 積み上げ1本（箱の分布）================= */
/* opt: { segs:[{label,value,color}], unit } */
function stack(root, opt){
  var W = width(root), H = 46, gap = 2;
  var s = svgRoot(W, H);
  var total = opt.segs.reduce(function(a, x){ return a + x.value; }, 0) || 1;
  var x = 0;
  opt.segs.forEach(function(g){
    var w = g.value / total * W;
    if (w <= 0) return;
    var ww = Math.max(0, w - gap);
    var p = E('rect', { x:x, y:6, width:ww, height:26, rx:4, fill:g.color });
    hover(p, '<b>' + g.label + '</b>' + g.value + (opt.unit || '') + '　' + Math.round(g.value / total * 100) + '％');
    s.appendChild(p);
    if (ww > 34) s.appendChild(E('text', { x:x + ww / 2, y:24, 'text-anchor':'middle',
                                           'class':'viz-inlab', fill:g.ink || '#fff' }, String(g.value)));
    x += w;
  });
  root.innerHTML = '';
  root.appendChild(s);
  root.appendChild(legend(opt.segs, true));
}

/* ================= 凡例 ================= */
function legend(series, small){
  var d = document.createElement('div');
  d.className = 'viz-legend' + (small ? ' small' : '');
  series.forEach(function(s){
    var i = document.createElement('span');
    i.innerHTML = '<i style="background:' + (s.color) + '"></i>' + (s.name || s.label);
    d.appendChild(i);
  });
  return d;
}

return { columns:columns, lines:lines, hbars:hbars, stack:stack, css:css };
})();
