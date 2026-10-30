/* ==========================================================================
   所見メモ作成 ─ 校正エンジン
   --------------------------------------------------------------------------
   画面（index.html）とテスト（tests/*.test.js）の両方から使う、画面に依存しない部分。
     ・字数の数え方と範囲
     ・校正（checkText）とハイライト
     ・クラス内の似ている所見さがし
     ・Claude の出力の読み取り
   ルールは rules/shoken-rules.js、学習指導要領は rules/course-of-study.js にあります。

   使い方：  const E = ShokenEngine.create(window.SHOKEN_RULES, window.COURSE_OF_STUDY);
   ========================================================================== */
(function (root) {
  'use strict';

  /* 「 」の中身を伏せるときに使う文字（どのルールにも当たらない私用領域の文字） */
  var MASK = '';

  function create(R, CS) {
    var reCache = new Map();

    function reOf(src) {
      if (reCache.has(src)) { var c = reCache.get(src); c.lastIndex = 0; return c; }
      var re = null;
      try { re = new RegExp(src, 'g'); } catch (e) { re = null; }  // 後読み未対応ブラウザ向けの保険
      reCache.set(src, re);
      return re;
    }
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function scan(text, pattern, make) {
      var re = reOf(pattern);
      if (!re) return [];
      re.lastIndex = 0;
      var out = [], m, guard = 0;
      while ((m = re.exec(text)) && guard++ < 500) {
        if (m[0] === '') { re.lastIndex++; continue; }
        out.push(Object.assign({ index: m.index, length: m[0].length, hit: m[0] }, make(m)));
      }
      return out;
    }

    /* ---------- 字数 ---------- */
    function countChars(t) { return Array.from((t || '').replace(/\r?\n/g, '').trim()).length; }
    function lenRange(typeKey) {
      var t = R.types[typeKey];
      var tol = t.tolerance != null ? t.tolerance : 0.12;
      return {
        min: (typeof t.min === 'number') ? t.min : Math.round(t.target * (1 - tol)),
        max: (typeof t.max === 'number') ? t.max : Math.round(t.target * (1 + tol)),
        target: t.target
      };
    }

    /* ---------- 「 」の中を伏せる ----------
       長さは変えないので、伏せた文で見つけた位置はそのまま元の文の位置になる。
       かっこ自体は残す。入れ子（「…『…』…」）にも対応する。 */
    function maskQuotes(text) {
      var Q = R.quote || { open: '「『', close: '」』' };
      var out = '', depth = 0;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (Q.open.indexOf(ch) >= 0) { depth++; out += ch; continue; }
        if (Q.close.indexOf(ch) >= 0 && depth > 0) { depth--; out += ch; continue; }
        out += depth > 0 ? MASK : ch;
      }
      return out;
    }
    function skipInQuote(kind) {
      var s = (R.quote && R.quote.skip) || [];
      return s.indexOf(kind) >= 0;
    }

    /* ---------- 学年段階 ---------- */
    function stageOf(grade) { return CS ? (CS.stageOf[String(grade)] || '中') : '中'; }

    /* ======================================================================
       校正
       1つの指摘 = {level, kind, msg, ng, ok, index, length, hit, fixable}
       ctx = { stage:'低'|'中'|'高', others:[{label, text}] }
       ====================================================================== */
    function checkText(text, typeKey, ctx) {
      ctx = ctx || {};
      var issues = [];
      if (!text || !text.trim()) return issues;
      var masked = maskQuotes(text);
      var src = function (kind) { return skipInQuote(kind) ? masked : text; };

      /* --- 字数 --- */
      var n = countChars(text), rg = lenRange(typeKey);
      if (n > rg.max) issues.push({ level: 'error', kind: '字数', msg: n + '字です。' + R.types[typeKey].label + 'は' + rg.target + '字程度（' + rg.min + '〜' + rg.max + '字）に収めます。' });
      else if (n < rg.min) issues.push({ level: 'warn', kind: '字数', msg: n + '字です。' + rg.target + '字程度（' + rg.min + '〜' + rg.max + '字）まで書き足します。' });

      /* --- 個人情報：氏名らしい表記（かっこの中も見る） --- */
      var pv = R.privacy;
      scan(text, pv.honorific.re, function (m) { return { level: 'error', kind: '個人情報', msg: pv.honorific.msg, ng: m[0], ok: '（削る）' }; })
        .filter(function (i) {
          /* 「〜さん」の部分が許可語（たくさん・お父さん など）で終わっていれば OK */
          var end = i.index + i.length;
          return !pv.honorific.allow.some(function (a) {
            return end - a.length >= 0 && text.slice(end - a.length, end) === a;
          });
        })
        .forEach(function (i) { issues.push(i); });

      /* --- 個人情報：知らないカタカナ語（固有名詞の疑い） --- */
      scan(src('katakana'), '[ァ-ヴー]{2,}', function (m) {
        return { level: 'info', kind: '固有名詞', msg: '固有名詞（人名・大会名・商品名など）ではありませんか。所見には書きません。', ng: m[0], ok: '（一般的な言葉に）' };
      })
        .filter(function (i) { return !pv.katakanaAllow.some(function (w) { return w.indexOf(i.hit) >= 0 || i.hit.indexOf(w) >= 0; }); })
        .forEach(function (i) { issues.push(i); });

      /* --- 性格の記述 --- */
      R.personality.words.forEach(function (w) {
        scan(src('personality'), escRe(w), function () { return { level: R.personality.level, kind: '性格', msg: R.personality.msg, ng: w, ok: '（行動の事実で書く）' }; })
          .forEach(function (i) { issues.push(i); });
      });

      /* --- 曖昧・主観表現 --- */
      R.vague.forEach(function (v) {
        scan(src('vague'), v.re || escRe(v.ng), function () {
          return { level: v.level || 'warn', kind: '表現', msg: v.msg || ('「' + v.ng + '」は避けます。'), ng: v.ng, ok: v.ok };
        }).forEach(function (i) { issues.push(i); });
      });

      /* --- 教科名の「科」 --- */
      R.subjects.checks.forEach(function (c) {
        scan(src('subject'), c.re || escRe(c.ng), function () {
          return { level: c.level, kind: '教科名', msg: '教科名は「〜〜科」と表します。', ng: c.ng, ok: c.ok };
        }).forEach(function (i) { issues.push(i); });
      });

      /* --- 表記ルール --- */
      R.hyoki.forEach(function (h) {
        scan(src('hyoki'), h.re || escRe(h.ng), function () {
          return { level: h.level || 'warn', kind: '表記',
            msg: h.note ? ('「' + h.ok + '」と書きます。' + h.note) : ('「' + h.ok + '」と書きます。'),
            ng: h.ng, ok: h.ok };
        }).forEach(function (i) { issues.push(i); });
      });

      /* --- 文末（現在形 → 過去形） --- */
      for (var p = 0; p < R.sentenceEnd.patterns.length; p++) {
        var pat = R.sentenceEnd.patterns[p];
        var hits = scan(src('sentenceEnd'), escRe(pat.re), function () {
          return { level: R.sentenceEnd.level, kind: '文末', msg: R.sentenceEnd.msg, ng: pat.re, ok: pat.ok };
        });
        if (hits.length) { hits.forEach(function (i) { issues.push(i); }); break; }  // 最も具体的な1種だけ出す
      }

      /* --- 句読点・書式 --- */
      R.format.forEach(function (f) {
        scan(text, f.re, function (m) {
          return { level: f.level, kind: '書式', msg: f.msg, ng: m[0] === '　' ? '全角スペース' : (m[0].trim() || '先頭の空白'), ok: '' };
        }).forEach(function (i) { issues.push(i); });
      });

      /* --- 数字表記 --- */
      R.numberFormat.rules.forEach(function (f) {
        scan(text, f.re, function (m) { return { level: f.level, kind: '数字', msg: f.msg, ng: m[0], ok: '' }; })
          .forEach(function (i) { issues.push(i); });
      });

      /* --- 構成：教科の所見1つ＋教科以外1つ／順序 --- */
      if (typeKey === 'shoken') {
        var has = function (w) { return masked.indexOf(w) >= 0; };
        /* 「体育」のように「科」が抜けている場合も、教科の記述はあるものとして数える
           （「科」を付ける指摘は教科名チェックが別に出しているので、二重に言わない） */
        var subjNames = R.subjects.list.concat(R.subjects.checks.filter(function (c) { return c.level === 'error'; }).map(function (c) { return c.ng; }));
        var hasSubject = subjNames.some(has);
        var outWords = ['掃除', '給食', '当番', '係', '委員会', 'クラブ', '休憩時間', '運動会', '学習発表会',
          'あいさつ', '整とん', '友達', '行事', '遠足', '宿泊', '集会', '片付け', 'なわとび', '班'];
        var hasOut = outWords.some(has);
        if (!hasSubject) issues.push({ level: 'warn', kind: '構成', msg: '教科に関する所見が見あたりません。教科名（〜〜科）を挙げて1つ書きます。' });
        if (!hasOut) issues.push({ level: 'warn', kind: '構成', msg: '教科以外（生活・行事など）の所見が見あたりません。原則として1つ書きます。' });

        if (hasSubject && hasOut && R.structure) {
          var firstOf = function (words) {
            return words.map(function (w) { return masked.indexOf(w); })
              .filter(function (i) { return i >= 0; })
              .reduce(function (a, b) { return Math.min(a, b); }, Infinity);
          };
          var iSubject = firstOf(subjNames);
          var iLife = firstOf(R.structure.lifeWords);
          if (iSubject !== Infinity && iLife !== Infinity && iLife < iSubject) {
            issues.push({ level: R.structure.level, kind: '順序', msg: R.structure.msg, index: iLife, length: 1 });
          }
        }
      }

      /* --- 道徳所見の型（2文構成・2文目は「特に「内容項目」の学習では、」） --- */
      if (typeKey === 'doutoku' && R.doutokuFormat) {
        var DF = R.doutokuFormat;
        var at = text.indexOf('特に「');
        if (at < 0) {
          issues.push({ level: 'error', kind: '道徳の型',
            msg: '2文目は「特に「内容項目」の学習では、」で始めます。この形が無いと要録に使えません。' });
        } else {
          var mm = text.slice(at).match(/^特に「([^」]{1,24})」の学習/);
          if (!mm) {
            issues.push({ level: 'error', kind: '道徳の型', index: at, length: 3,
              msg: '「特に「内容項目」の学習では、」の形にします。（例：特に「規則の尊重」の学習では、）' });
          } else {
            var st = ctx.stage || '中';
            var list = DF.contentItems[st] || DF.contentItems['中'];
            /* 「友情・信頼」のような中黒表記も、正式名称に照らして拾う。
               「自由と責任」のように、正式名称の一部（、で区切られた語）でもよい */
            var norm = function (s) { return s.replace(/[・､、\s]/g, ''); };
            var name = norm(mm[1]);
            var ok = list.some(function (x) {
              if (norm(x) === name || norm(x).indexOf(name) === 0) return true;
              return x.split('、').some(function (part) { return norm(part) === name; });
            });
            if (!ok) {
              issues.push({ level: 'warn', kind: '内容項目', index: at + 3, length: mm[1].length,
                ng: mm[1], ok: '（学習指導要領の内容項目名）',
                msg: '学習指導要領の内容項目名と一致しません。' + (CS ? CS.stageLabel[st] : '') + 'で使えるのは：' +
                  list.slice(0, 8).join('／') + ' など。' });
            }
          }
          /* 1文目が無い（いきなり「特に」で始まる） */
          if (at === 0) issues.push({ level: 'error', kind: '道徳の型', msg: '1文目（道徳全体の評価）がありません。2文で書きます。' });
        }
        /* 文の数は、かっこの中の「。」を数えない */
        var sentences = masked.split('。').filter(function (s) { return s.trim(); }).length;
        if (sentences > 2) issues.push({ level: 'warn', kind: '道徳の型', msg: sentences + '文あります。道徳所見は2文で書きます。' });
      }

      /* --- 他の学期と同じ教科になっていないか --- */
      if (typeKey === 'shoken' && ctx.others && ctx.others.length) {
        var mine = R.subjects.list.filter(function (s) { return masked.indexOf(s) >= 0; });
        ctx.others.forEach(function (o) {
          var same = mine.filter(function (s) { return o.text.indexOf(s) >= 0; });
          if (same.length) issues.push({ level: 'error', kind: '同一教科',
            msg: o.label + 'の所見と同じ教科（' + same.join('・') + '）です。学期ごとに違う教科にします。' });
        });
      }

      /* 「直す」ボタンを出せるか。
         置き換え先が1つに定まり、見つかった文字が ng そのもののときだけ。
         （「正確に／分かりやすく」のような選択肢や「（削る）」は先生が判断する） */
      issues.forEach(function (i) {
        i.fixable = !!(i.ng && i.ok && i.index != null && i.hit === i.ng && !/[（(／\/〜～]/.test(i.ok));
      });

      /* 重複した指摘を1つにまとめ、重い順に並べる */
      var seen = new Set(), uniq = [];
      var order = { error: 0, warn: 1, info: 2 };
      issues.sort(function (a, b) {
        return (order[a.level] - order[b.level]) || ((a.index != null ? a.index : 1e9) - (b.index != null ? b.index : 1e9));
      });
      issues.forEach(function (i) {
        var k = i.kind + '|' + (i.ng || '') + '|' + i.msg;
        if (seen.has(k)) return;
        seen.add(k); uniq.push(i);
      });
      return uniq;
    }

    /* 同じ文を何度も校正しないように覚えておく（入力のたびに全員分を数えるため） */
    var memo = new Map();
    function checkCached(text, typeKey, ctx) {
      ctx = ctx || {};
      var key = typeKey + '\u0001' + (ctx.stage || '') + '\u0001' +
        (ctx.others || []).map(function (o) { return o.label + '\u0002' + o.text; }).join('\u0003') + '\u0001' + text;
      var hit = memo.get(key);
      if (hit) return hit;
      var res = checkText(text, typeKey, ctx);
      if (memo.size > 4000) memo.clear();
      memo.set(key, res);
      return res;
    }

    function worst(issues) {
      if (issues.some(function (i) { return i.level === 'error'; })) return 'error';
      if (issues.some(function (i) { return i.level === 'warn'; })) return 'warn';
      return 'ok';
    }

    /* ---------- ハイライト表示 ---------- */
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function highlight(text, issues) {
      var spans = issues.filter(function (i) { return i.index != null; })
        .map(function (i) { return { s: i.index, e: i.index + i.length, lv: i.level }; })
        .sort(function (a, b) { return a.s - b.s || b.e - a.e; });
      var kept = [], end = -1;
      spans.forEach(function (sp) { if (sp.s >= end) { kept.push(sp); end = sp.e; } });
      var out = '', p = 0;
      kept.forEach(function (sp) {
        out += esc(text.slice(p, sp.s)) + '<mark class="' + sp.lv + '">' + esc(text.slice(sp.s, sp.e)) + '</mark>';
        p = sp.e;
      });
      return out + esc(text.slice(p));
    }

    /* ---------- クラス内の重複 ---------- */
    function bigrams(t) {
      var s = (t || '').replace(/[、。「」\s]/g, '');
      var g = new Set();
      for (var i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
      return g;
    }
    function jaccard(a, b) {
      if (!a.size || !b.size) return 0;
      var inter = 0;
      a.forEach(function (x) { if (b.has(x)) inter++; });
      return inter / (a.size + b.size - inter);
    }
    /* list = [{no, text}] */
    function findDuplicates(list) {
      var g = list.filter(function (x) { return (x.text || '').trim(); })
        .map(function (x) { return { no: x.no, g: bigrams(x.text) }; });
      var out = [];
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) {
        var sim = jaccard(g[i].g, g[j].g);
        if (sim >= R.duplication.warnThreshold) out.push({ a: g[i].no, b: g[j].no, sim: sim });
      }
      return out.sort(function (x, y) { return y.sim - x.sim; });
    }

    /* ======================================================================
       Claude の出力の読み取り
         児童の区切り  #12 / ＃12 / 【12】（見出しだけの行）
         案の区切り    1) 2) … / 案1 / [案1] / 1．
         工夫した点    ※ で始まる行
       案の区切りが1つも無ければ、その児童の本文全体を1案として扱う。
       ====================================================================== */
    var RE_HEAD_HASH = /^\s*(?:[#＃]+|【|\[)\s*(\d{1,2})\s*(?:番)?\s*(?:】|\])?\s*[:：.．]?\s*$/;
    var RE_HEAD_BARE = /^\s*(\d{1,2})\s*番?\s*[:：.．]?\s*$/;
    var RE_CAND = /^\s*(?:\[?\s*案\s*)?([1-5１-５])\s*(?:案)?\s*[).）．.:：\]、]\s*(.*)$/;
    var RE_NOTE = /^\s*[※＊*]\s*(.+)$/;

    function splitCandidates(block) {
      var out = [], cur = null, sawMarker = false;
      block.forEach(function (ln) {
        var mc = ln.match(RE_CAND);
        if (mc) { sawMarker = true; cur = { text: (mc[2] || '').trim(), note: '' }; out.push(cur); return; }
        var mn = ln.match(RE_NOTE);
        if (mn) { if (cur) cur.note = (cur.note ? cur.note + ' ' : '') + mn[1].trim(); return; }
        if (cur) cur.text += ln.trim();
        else if (!sawMarker && ln.trim()) { cur = { text: ln.trim(), note: '' }; out.push(cur); }
      });
      return out.filter(function (c) { return c.text.trim(); })
        .map(function (c) { return { text: c.text.trim(), note: c.note.trim() }; });
    }

    /* 戻り値 { blocks: {番号: [{text, note}, …]}, order: [番号…] } */
    function parsePasted(raw) {
      var lines = String(raw || '').replace(/\r/g, '').split('\n');
      /* #付きの見出しが1つでもあれば、裸の数字は本文の一部として扱う（案の番号と紛れないため） */
      var hasHash = lines.some(function (l) { return RE_HEAD_HASH.test(l); });
      var raws = {}, order = [], curNo = null, buf = [];
      var flush = function () {
        if (curNo != null && buf.length) raws[curNo] = (raws[curNo] || []).concat(buf);
        buf = [];
      };
      lines.forEach(function (ln) {
        var m = ln.match(RE_HEAD_HASH);
        if (!m && !hasHash) m = ln.match(RE_HEAD_BARE);
        if (m) { flush(); curNo = +m[1]; if (order.indexOf(curNo) < 0) order.push(curNo); return; }
        if (curNo != null) buf.push(ln);
      });
      flush();
      var blocks = {};
      order.forEach(function (no) {
        var list = splitCandidates(raws[no] || []);
        if (list.length) blocks[no] = list;
      });
      return { blocks: blocks, order: order.filter(function (no) { return blocks[no]; }) };
    }

    return {
      MASK: MASK,
      countChars: countChars, lenRange: lenRange, stageOf: stageOf,
      maskQuotes: maskQuotes, checkText: checkText, checkCached: checkCached, worst: worst,
      highlight: highlight, esc: esc,
      bigrams: bigrams, jaccard: jaccard, findDuplicates: findDuplicates,
      splitCandidates: splitCandidates, parsePasted: parsePasted
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShokenEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
