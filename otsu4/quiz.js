/* おつよん ― 問題を1問ずつ 出す しくみ（れんしゅう・にがてノート 共通）
   ながれ： ①答えをえらぶ → ②自信を こたえる → ③正解と解説を見る
   ②を 答えの前に 聞くのは、「わかったつもり」を 正直に 記録するためです。 */

var O4Quiz = (function(){
'use strict';

function el(tag, cls, html){
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function stars(n){ return '★★★★★'.slice(0, n || 0); }

/* opts: { questions, root, onAnswer(q, correct, conf), onDone(log), label } */
function run(opts){
  var qs = opts.questions, root = opts.root;
  var i = 0, log = [];

  function draw(){
    var q = qs[i];
    var mix = O4Engine.shuffleChoices(q);
    var th = OTSU4_THEME_MAP[q.theme] || { name:'' };
    var chosen = -1, conf = '';

    root.innerHTML = '';
    var prog = el('div', 'progress', (i + 1) + ' / ' + qs.length + ' 問　' +
      (opts.label ? opts.label + '　' : '') +
      '<span class="tag ' + q.subject + '">' + OTSU4_SUBJECTS[q.subject].name + '</span>' +
      '<span class="tag">' + th.name + '</span>' +
      '<span class="star">' + stars(q.star) + '</span>' +
      (q.src === 'official' ? '<span class="tag">公式過去問</span>' : ''));
    root.appendChild(prog);

    var card = el('div', 'card');
    card.appendChild(el('div', 'qtext', esc(q.q)));
    var ul = el('ul', 'choices');
    mix.choices.forEach(function(text, n){
      var li = el('li');
      var b = el('button', 'choice', '<span class="n">' + (n + 1) + '</span><span>' + esc(text) + '</span>');
      b.onclick = function(){
        if (chosen >= 0) return;
        chosen = n;
        Array.prototype.forEach.call(ul.querySelectorAll('.choice'), function(x){ x.classList.remove('sel'); });
        b.classList.add('sel');
        askConf();
      };
      li.appendChild(b); ul.appendChild(li);
    });
    card.appendChild(ul);
    root.appendChild(card);

    var area = el('div');
    root.appendChild(area);
    area.innerHTML = '<div class="muted center">答えを えらんでください</div>';

    function askConf(){
      area.innerHTML = '';
      area.appendChild(el('div', 'muted center', 'いまの答え、どのくらい 自信がある？'));
      var row = el('div', 'row');
      [['high','ばっちり'],['mid','なんとなく'],['low','あてずっぽう']].forEach(function(p, k){
        var b = el('button', 'btn ' + (k === 0 ? '' : 'ghost') + ' sm', p[1]);
        b.onclick = function(){ conf = p[0]; reveal(); };
        row.appendChild(b);
      });
      area.appendChild(row);
      area.appendChild(el('div', 'muted center', '<br>正解でも 自信が なければ、にがてノートに 入れて 類似問題を 出します。'));
    }

    function reveal(){
      var correct = (chosen === mix.a);
      var mixed = mix.order && mix.order.some(function(v, k){ return v !== k; });
      Array.prototype.forEach.call(ul.querySelectorAll('.choice'), function(x, n){
        x.disabled = true;
        if (n === mix.a) x.classList.add('ok');
        else if (n === chosen) x.classList.add('ng');
        if (mixed){
          var tag = el('span', 'muted', '（もとの' + (mix.order[n] + 1) + '番）');
          x.appendChild(tag);
        }
      });

      if (opts.onAnswer) opts.onAnswer(q, correct, conf);
      log.push({ id:q.id, correct:correct, conf:conf, subject:q.subject, theme:q.theme });

      area.innerHTML = '';
      area.appendChild(el('div', 'judge ' + (correct ? 'ok' : 'ng'),
        (correct ? '○ 正解' : '× まちがい') + '　正解は ' + (mix.a + 1) + ' 番' +
        (correct && conf !== 'high' ? '　<span class="muted">（自信なし → にがてノートへ）</span>' : '')));

      var ex = el('div', 'explain');
      ex.innerHTML = '<p><b>なぜ そうなる？</b>' + esc(q.why) + '</p>' +
                     (q.others ? '<p><b>ほかの選択肢・ポイント</b>' + esc(q.others) + '</p>' : '') +
                     (mixed ? '<p class="muted">※選択肢の ならびを まぜています。解説の 番号は「もとの番号」です。</p>' : '') +
                     (q.ref ? '<p class="muted">くわしくは docs/' + refFile(q.ref) + '</p>' : '');
      area.appendChild(ex);

      if (q.steps && q.steps.length) area.appendChild(stepsBlock(q));
      if (!correct || conf !== 'high') area.appendChild(cardsBlock(q, correct));

      var b = el('button', 'btn wide', (i + 1 < qs.length) ? 'つぎの問題へ' : '結果を見る');
      b.onclick = function(){
        i++;
        if (i < qs.length) draw();
        else if (opts.onDone) opts.onDone(log);
      };
      area.appendChild(b);
      window.scrollTo(0, 0);
    }
  }

  /* ---- まちがえた（自信がなかった）とき、もとの 知識に もどす ---- */
  function cardsBlock(q, correct){
    var cards = O4Engine.relatedCards(q, 3);
    var box = el('div', 'card');
    var th = OTSU4_THEME_MAP[q.theme] || { name:'' };
    box.appendChild(el('h3', '', (correct ? '自信が なかったので' : 'まちがえたので') + '、もとの 知識に もどります'));

    if (!cards.length){
      box.appendChild(el('div', 'muted', 'このテーマの カードは ありません。'));
      return box;
    }

    /* きょうの カードに 自動で もどす */
    var revived = O4Store.reviveCards(cards.map(function(c){ return c.id; }));

    cards.forEach(function(c){
      var d = el('div', 'kcard');
      d.innerHTML = '<b>' + esc(c.front) + '</b><span>' + esc(c.back) + '</span>' +
                    (c.hint ? '<i>💡 ' + esc(c.hint) + '</i>' : '');
      box.appendChild(d);
    });

    box.appendChild(el('div', 'muted',
      revived ? 'この ' + revived + ' 枚を「きょう 出すカード」に もどしました。'
              : 'この カードは すでに きょうの 分に 入っています。'));

    var a = el('a', 'btn ghost wide', '「' + th.name + '」の カードで おぼえ直す');
    a.href = 'oboeru.html?theme=' + q.theme;
    box.appendChild(a);
    return box;
  }

  /* ---- 計算問題の 途中式（1つずつ ひらく） ---- */
  function stepsBlock(q){
    var box = el('div', 'card');
    box.appendChild(el('h3', '', '途中式を 1つずつ 見る'));
    var list = el('div', 'steps');
    box.appendChild(list);

    var n = 0;
    var more = el('button', 'btn ghost wide', '① から 見る');
    var all  = el('button', 'btn ghost wide', 'ぜんぶ 出す');

    function addOne(){
      var st = q.steps[n];
      var d = el('div', 'step');
      d.innerHTML = '<b>' + esc(st.t) + '</b><span>' + esc(st.d) + '</span>';
      list.appendChild(d);
      n++;
      if (n >= q.steps.length){
        more.remove(); all.remove();
        if (q.trick) list.appendChild(el('div', 'trick', '<b>いちばん ラクな 解き方</b>' + esc(q.trick)));
      } else {
        more.textContent = 'つぎの式（' + (n + 1) + '／' + q.steps.length + '）';
      }
    }
    more.onclick = addOne;
    all.onclick = function(){ while (n < q.steps.length) addOne(); };

    box.appendChild(more);
    box.appendChild(all);
    return box;
  }

  function refFile(ref){
    var m = { 'HOUREI':'HOUREI.md', 'BUTSURI':'BUTSURI-KAGAKU.md', 'SEISHITSU':'SEISHITSU-SHOUKA.md', 'KEISAN':'KEISAN.md' };
    var k = String(ref).split('#')[0];
    return (m[k] || ref) + '　第' + (String(ref).split('#')[1] || '') + '節';
  }

  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  draw();
}

/* 答えたときの記録（共通） */
function record(q, correct, conf){
  var st = O4Store.state('q', q.id);
  O4Store.put('q', q.id, O4Srs.gradeQuestion(st, correct, conf));
  O4Store.countUp('q', correct);
}

return { run:run, record:record };
})();
