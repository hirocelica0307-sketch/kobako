/* おつよん ― 「このテーマの 全体像」を 出す 部品
   答えだけでは 納得できないので、答えあわせの たびに
   なぜ そうなっているのか・仲間は 何かを ひらけるように します。 */

var O4Note = (function(){
'use strict';

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* 太字 **…** と 改行を 反映する */
function rich(s){
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '</p><p>');
}

function html(themeKey){
  var n = (typeof OTSU4_NOTES !== 'undefined') ? OTSU4_NOTES[themeKey] : null;
  if (!n) return '';
  var th = (typeof OTSU4_THEME_MAP !== 'undefined' && OTSU4_THEME_MAP[themeKey]) || { name:'' };

  var h = '<div class="note-body">';
  h += '<div class="note-title">' + esc(n.title) + '</div>';
  h += '<p>' + rich(n.body) + '</p>';

  if (n.table){
    h += '<div class="note-table"><table><tr>';
    n.table.head.forEach(function(c){ h += '<th>' + esc(c) + '</th>'; });
    h += '</tr>';
    n.table.rows.forEach(function(r){
      h += '<tr>';
      r.forEach(function(c, i){ h += '<td' + (i === 0 ? ' class="k"' : '') + '>' + esc(c) + '</td>'; });
      h += '</tr>';
    });
    h += '</table></div>';
    if (n.table.head.length >= 3) h += '<div class="note-scroll">← 表は よこに スクロールできます</div>';
  }
  if (n.tip) h += '<div class="note-tip">' + rich(n.tip) + '</div>';
  h += '<div class="muted">テーマ：' + esc(th.name) + '</div>';
  h += '</div>';
  return h;
}

/* ひらく／とじる ができる かたまりを つくる */
function block(themeKey, opts){
  opts = opts || {};
  var inner = html(themeKey);
  if (!inner) return null;

  var box = document.createElement('div');
  box.className = 'card note-card';

  var btn = document.createElement('button');
  btn.className = 'btn ghost wide';
  btn.textContent = opts.label || '📘 このテーマの 全体像を 見る（なぜ そうなるか）';

  var body = document.createElement('div');
  body.innerHTML = inner;
  body.style.display = opts.open ? '' : 'none';

  btn.onclick = function(){
    var show = (body.style.display === 'none');
    body.style.display = show ? '' : 'none';
    btn.textContent = show ? '📘 とじる' : (opts.label || '📘 このテーマの 全体像を 見る（なぜ そうなるか）');
  };

  box.appendChild(btn);
  box.appendChild(body);
  return box;
}

return { html:html, block:block, rich:rich };
})();
