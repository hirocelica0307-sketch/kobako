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
  O4Store.countUp('q');
}

return { run:run, record:record };
})();
