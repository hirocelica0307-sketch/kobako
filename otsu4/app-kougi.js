/* おつよん ― 講義（眺めて おぼえる ページ）
   1テーマ ＝「なぜ そうなるのか」＋「覚え方」＋「これだけは 覚える」 */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
var stars = function(n){ return '★★★★★'.slice(0, n || 0) + '☆☆☆☆☆'.slice(0, 5 - (n || 0)); };

var filter = 'all';      /* all / law / phys / prop / unread */
var ICON = { goro:'🔤', uta:'🎵', image:'💡', kotsu:'📌' };
var LABEL = { goro:'語呂合わせ', uta:'となえ歌', image:'イメージ', kotsu:'ひとこと' };

/* ---------- 科目タブ ---------- */
function renderTabs(){
  var h = '';
  [['all','ぜんぶ'],['law','法令'],['phys','物理化学'],['prop','性質消火']].forEach(function(p){
    h += '<button class="btn ' + (filter === p[0] ? '' : 'ghost') + ' sm" data-f="' + p[0] + '">' + p[1] + '</button>';
  });
  $('subjTabs').innerHTML = h;
  Array.prototype.forEach.call($('subjTabs').querySelectorAll('button'), function(b){
    b.onclick = function(){ filter = b.dataset.f; renderTabs(); renderList(); };
  });
}

/* ---------- 一覧 ---------- */
function themesToShow(){
  var read = O4Store.readMap();
  return OTSU4_THEMES.filter(function(th){
    if (filter === 'unread') return !read[th.key];
    if (filter !== 'all' && th.subject !== filter) return false;
    return true;
  });
}

function renderList(){
  var read = O4Store.readMap();
  var list = themesToShow();
  var h = '';

  list.forEach(function(th){
    var cards = OTSU4_CARDS.filter(function(c){ return c.theme === th.key; });
    var qs = OTSU4_QUESTIONS.filter(function(q){ return q.theme === th.key; });
    h += '<div class="card kougi" id="t-' + th.key + '">';
    h += '<button class="kougi-head" data-open="' + th.key + '">' +
         '<span class="tag ' + th.subject + '">' + OTSU4_SUBJECTS[th.subject].name + '</span>' +
         '<span class="kougi-name">' + esc(th.name) + '</span>' +
         '<span class="star">' + stars(th.star) + '</span>' +
         (read[th.key] ? '<span class="tag done">読んだ</span>' : '') +
         '<span class="muted">カード' + cards.length + '・問題' + qs.length + '</span>' +
         '<span class="kougi-arrow">▼</span></button>';
    h += '<div class="kougi-body" data-body="' + th.key + '" style="display:none"></div>';
    h += '</div>';
  });

  if (!list.length) h = '<div class="card center muted">ぜんぶ 読みました。</div>';
  $('list').innerHTML = h;

  Array.prototype.forEach.call($('list').querySelectorAll('[data-open]'), function(b){
    b.onclick = function(){ toggle(b.dataset.open); };
  });
  updateCount();
}

function updateCount(){
  var read = O4Store.readMap();
  var n = OTSU4_THEMES.filter(function(t){ return read[t.key]; }).length;
  $('readCount').textContent = '読んだ ' + n + '/' + OTSU4_THEMES.length;
}

/* ---------- 1テーマの 中身 ---------- */
function toggle(key, force){
  var body = $('list').querySelector('[data-body="' + key + '"]');
  if (!body) return;
  var show = (force === true) || (force === undefined && body.style.display === 'none');
  if (force === false) show = false;
  body.style.display = show ? '' : 'none';
  if (show && !body.dataset.filled){ body.innerHTML = buildBody(key); body.dataset.filled = '1'; bind(key, body); }
}

function buildBody(key){
  var th = OTSU4_THEME_MAP[key];
  var note = (typeof OTSU4_NOTES !== 'undefined') ? OTSU4_NOTES[key] : null;
  var goro = (typeof OTSU4_GORO !== 'undefined') ? (OTSU4_GORO[key] || []) : [];
  var cards = OTSU4_CARDS.filter(function(c){ return c.theme === key; })
                          .sort(function(a, b){ return (b.star || 0) - (a.star || 0); });
  var h = '';

  /* ① なぜ そうなっているのか */
  if (note){
    h += '<h3 class="sec">① なぜ そうなっている？</h3>';
    h += '<div class="note-title">' + esc(note.title) + '</div>';
    h += '<div class="note-body" style="margin-top:6px"><p>' + O4Note.rich(note.body) + '</p></div>';
    if (note.table){
      h += '<h3 class="sec">② 表で くらべる</h3>';
      h += '<div class="note-table"><table><tr>';
      note.table.head.forEach(function(c){ h += '<th>' + esc(c) + '</th>'; });
      h += '</tr>';
      note.table.rows.forEach(function(r){
        h += '<tr>';
        r.forEach(function(c, i){ h += '<td' + (i === 0 ? ' class="k"' : '') + '>' + esc(c) + '</td>'; });
        h += '</tr>';
      });
      h += '</table></div>';
      if (note.table.head.length >= 3) h += '<div class="note-scroll">← 表は よこに スクロールできます</div>';
    }
  }

  /* ③ おぼえ方 */
  if (goro.length){
    h += '<h3 class="sec">③ おぼえ方</h3>';
    goro.forEach(function(g){
      h += '<div class="goro g-' + g.type + '">' +
           '<div class="goro-h"><span class="goro-ico">' + (ICON[g.type] || '📌') + '</span>' +
           '<span class="goro-lab">' + (LABEL[g.type] || '') + '</span></div>' +
           '<div class="goro-t">' + esc(g.t) + '</div>' +
           '<div class="goro-d">' + esc(g.d) + '</div></div>';
    });
  }

  /* ④ これだけは 覚える */
  if (cards.length){
    h += '<h3 class="sec">④ これだけは 覚える（' + cards.length + '）</h3>';
    cards.forEach(function(c){
      h += '<div class="kpoint">' +
           '<div class="kq">' + esc(c.front) + '<span class="star">' + stars(c.star) + '</span></div>' +
           '<div class="ka">' + esc(c.back) + '</div>' +
           (c.why ? '<div class="kw">' + esc(c.why) + '</div>' : '') +
           (c.hint ? '<div class="kh">💡 ' + esc(c.hint) + '</div>' : '') +
           (c.note ? '<div class="kn">⚠️ ' + esc(c.note) + '</div>' : '') +
           '</div>';
    });
  }

  /* ⑤ ひとことメモ */
  if (note && note.tip){
    h += '<h3 class="sec">⑤ ひとこと</h3>';
    h += '<div class="note-tip">' + O4Note.rich(note.tip) + '</div>';
  }

  /* ボタン */
  var readNow = !!O4Store.readMap()[key];
  h += '<div class="row" style="margin-top:14px">' +
       '<button class="btn ' + (readNow ? 'ghost' : '') + ' sm" data-read="' + key + '">' +
       (readNow ? '✓ 読んだ（もう一度 読む）' : '読んだ！') + '</button>' +
       '<a class="btn ghost sm" href="oboeru.html?theme=' + key + '">カードで 確かめる</a>' +
       '<a class="btn ghost sm" href="renshuu.html?theme=' + key + '">問題を 解く</a>' +
       '</div>';
  return h;
}

function bind(key, body){
  var b = body.querySelector('[data-read]');
  if (!b) return;
  b.onclick = function(){
    var now = !!O4Store.readMap()[key];
    O4Store.readMark(key, !now);
    body.dataset.filled = '';
    body.innerHTML = buildBody(key);
    bind(key, body);
    updateCount();
    var head = $('list').querySelector('[data-open="' + key + '"]');
    if (head){
      var tag = head.querySelector('.tag.done');
      if (!now && !tag){
        var s = document.createElement('span'); s.className = 'tag done'; s.textContent = '読んだ';
        head.insertBefore(s, head.querySelector('.muted'));
      } else if (now && tag){ tag.remove(); }
    }
  };
}

/* ---------- ぜんぶ ひらく／とじる ---------- */
$('btnOpenAll').onclick = function(){
  themesToShow().forEach(function(th){ toggle(th.key, true); });
};
$('btnCloseAll').onclick = function(){
  themesToShow().forEach(function(th){ toggle(th.key, false); });
};
$('btnUnread').onclick = function(){ filter = 'unread'; renderTabs(); renderList(); };

renderTabs();
renderList();

/* 直接 テーマを ひらく（ほかのページから ?theme=… で 来たとき） */
(function(){
  var m = /[?&]theme=([^&]+)/.exec(location.search);
  if (!m) return;
  var t = decodeURIComponent(m[1]);
  if (!OTSU4_THEME_MAP[t]) return;
  toggle(t, true);
  var el = $('t-' + t);
  if (el) el.scrollIntoView();
})();
})();
