/* 手紙ちゃん */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const FRAMES = window.FRAMES;
  const SIZES = window.FRAME_SIZES;      // シンプルな わく（すみ・へんの 絵）
  const RICH = window.RICH_SIZES || {};   // にぎやかな わく（まるごと 1まいの 絵）
  const ROUND = window.ROUND_SIZES || {}; // 丸い わく（まるごと 1まいの 絵 ＋ すじごとの 書ける はば）
  const byId = (id) => FRAMES.find((f) => f.id === id);
  const NONE = 'none';

  // ---------- きまり（mm） ----------
  const PAPER = { tate: [210, 297], yoko: [297, 210] };
  const GRID = { // [よこに いくつ, たてに いくつ]
    tate: { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 12: [3, 4], 16: [4, 4] },
    yoko: { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 12: [4, 3], 16: [4, 4] },
  };
  const GRADES = {
    tei: { name: 'ていがくねん（1・2年）', pitch: 15 },
    chu: { name: 'ちゅうがくねん（3・4年）', pitch: 12 },
    kou: { name: 'こうがくねん（5・6年）', pitch: 8 },
  };
  const MARGIN = 8;    // 紙の ふち（プリンターが いんさつ できない ところ）
  const CUT = 3;       // 面の まわりの 切りしろ
  const MIN_PITCH = 5; // これより せまい 行は 作らない
  const PX_PER_MM = 96 / 25.4;

  const DEF = { paper: 'tate', faces: 2, dir: 'yoko', grade: 'chu', lines: null, atena: true, yori: true,
    frame: 'haru-sakura-r', mode: 'same', season: 'all', view: 'fit' };
  const KEY = 'binsen.v1';
  let S = load();

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') {
        const s = { ...DEF, ...v };
        if (!PAPER[s.paper] || !GRID[s.paper][s.faces] || !GRADES[s.grade]) return { ...DEF };
        if (s.frame !== NONE && !byId(s.frame)) s.frame = DEF.frame;
        return s;
      }
    } catch (e) { /* つかえない ときは はじめの 設定 */ }
    return { ...DEF };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* のこせなくても うごく */ }
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const mm = (v) => `${+v.toFixed(3)}mm`;

  // ---------- 大きさの 計算 ----------
  // b = わくの 帯の はば、c = すみの 絵の 大きさの めやす
  // cw・ch = すみの 絵の ほんとうの はば・高さ（バスの ような よこ長の 絵も 小さく なりすぎない ように 面積で あわせる）
  function frameGeom(fw, fh, fid) {
    if (!fid || !SIZES[fid]) return { b: 0, c: 0, cw: 0, ch: 0 };
    const b = clamp(Math.min(fw, fh) * 0.1, 4.5, 13);
    const c = b * 1.55;
    const [w0, h0] = SIZES[fid].corner;
    const s = Math.min(c / Math.sqrt(w0 * h0), (c * 1.4) / Math.max(w0, h0));
    return { b, c, cw: w0 * s, ch: h0 * s };
  }

  // にぎやかな わく：面の 形に いちばん 近い 絵（たて長・よこ長・正方形）を えらび、ゆがめずに 面の 中へ おさめる
  function richGeom(fid, fw, fh) {
    const f = byId(fid);
    const set = (f.round ? ROUND : RICH)[f.src];
    let best = null;
    for (const [shape, v] of Object.entries(set)) {
      const d = Math.abs(Math.log(fw / fh) - Math.log(v.size[0] / v.size[1]));
      if (!best || d < best.d) best = { d, shape, v };
    }
    const [w0, h0] = best.v.size;
    const s = Math.min(fw / w0, fh / h0);
    const ox = (fw - w0 * s) / 2, oy = (fh - h0 * s) / 2;
    const [ix, iy, iw, ih] = best.v.inner;
    return {
      src: `assets/frames/${f.round ? 'round' : 'rich'}/${f.src}-${best.shape}.svg`,
      box: { x: ox, y: oy, w: w0 * s, h: h0 * s },
      inner: { x: ox + ix * s, y: oy + iy * s, w: iw * s, h: ih * s },
      v: best.v, s, ox, oy,
    };
  }

  // 丸い わく：よこの すじ（axis 'rows'）・たての すじ（'cols'）で、a〜b mm の はばの 中で ずっと 書ける はんい [はじめ, おわり]（mm）
  const ROUND_PAD = 1.5;
  function roundSpan(G, axis, a, b) {
    const { v, s } = G;
    const o0 = axis === 'rows' ? G.oy : G.ox; // すじの 位置の ずれ
    const o1 = axis === 'rows' ? G.ox : G.oy; // はんいの ずれ
    const map = G[axis] || (G[axis] = new Map(v[axis].map(([p, lo, hi]) => [p, [lo, hi]])));
    const p0 = Math.ceil(((a - o0) / s) / v.step) * v.step;
    const p1 = (b - o0) / s;
    let lo = -Infinity, hi = Infinity, any = false;
    for (let p = p0; p <= p1; p += v.step) {
      const sp = map.get(p);
      if (!sp) return null;
      lo = Math.max(lo, sp[0]); hi = Math.min(hi, sp[1]); any = true;
    }
    if (!any) return null;
    const r = [o1 + lo * s + ROUND_PAD, o1 + hi * s - ROUND_PAD];
    return r[1] > r[0] ? r : null;
  }

  // 行を ひける ところ（面の 中の mm）
  function areaFor(fid, fw, fh) {
    const f = byId(fid);
    if (f && f.round) {
      // 丸い わく：行の ながさが わくの はばの 半分 いじょう ある ところだけ つかう（上と 下の はしは 短すぎる）
      const G = richGeom(fid, fw, fh);
      const p = ROUND_PAD;
      const axis = S.dir === 'yoko' ? 'rows' : 'cols';
      const prof = G.v[axis];
      const maxLen = Math.max(...prof.map(([, lo, hi]) => hi - lo));
      const ok = prof.filter(([, lo, hi]) => hi - lo >= maxLen * 0.5).map(([q]) => q);
      const a = Math.min(...ok) * G.s, b = Math.max(...ok) * G.s;
      const { inner } = G;
      return S.dir === 'yoko'
        ? { x: inner.x + p, y: G.oy + a + p, w: inner.w - 2 * p, h: b - a - 2 * p }
        : { x: G.ox + a + p, y: inner.y + p, w: b - a - 2 * p, h: inner.h - 2 * p };
    }
    if (f && f.rich) {
      const { inner } = richGeom(fid, fw, fh);
      const p = 1.5;
      return { x: inner.x + p, y: inner.y + p, w: inner.w - 2 * p, h: inner.h - 2 * p };
    }
    const g = frameGeom(fw, fh, fid);
    const pad = g.b ? 2 : 5;
    // 行が すみの 絵に ぶつからない ように、行の はしの ほうは すみの 絵の 内がわから
    let ix = g.b + pad;
    let iy = g.b + pad;
    if (g.b) { if (S.dir === 'yoko') iy = g.ch + 1.5; else ix = g.cw + 1.5; }
    return { x: ix, y: iy, w: fw - 2 * ix, h: fh - 2 * iy };
  }

  function layout() {
    const [W, H] = PAPER[S.paper];
    const [cols, rows] = GRID[S.paper][S.faces];
    const pw = (W - 2 * MARGIN) / cols;
    const ph = (H - 2 * MARGIN) / rows;
    const fw = pw - 2 * CUT;
    const fh = ph - 2 * CUT;
    // 面ごとに わくが ちがう ときは、どの わくでも 絵に ぶつからない ところ（かさなる ところ）に 行を ひく
    const fids = [...new Set(Array.from({ length: cols * rows }, (_, i) => frameFor(i)))];
    const area = fids.map((f) => areaFor(f, fw, fh)).reduce((a, b) => {
      const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
      return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
    });
    const across = S.dir === 'yoko' ? area.h : area.w; // 行が ならぶ ほう
    const along = S.dir === 'yoko' ? area.w : area.h;  // 1行の ながさ
    const gp = GRADES[S.grade].pitch;
    const fit = Math.max(0, Math.floor(across / gp + 1e-6));
    const need = 1 + (S.atena ? 1 : 0) + (S.yori ? 1 : 0);
    const maxLines = Math.max(need, Math.floor(across / MIN_PITCH));
    const auto = clamp(fit, need, maxLines);
    const n = S.lines == null ? auto : clamp(S.lines, need, maxLines);
    const pitch = across / n;
    const body = n - need + 1;
    const L = { W, H, cols, rows, pw, ph, fw, fh, area, across, along, gp, fit, need, maxLines, auto, n, pitch, body };
    // 1行に 書ける 字の 数（丸い わくは 行ごとに ちがうので、本文の 行の いちばん 少ない〜多い）
    const per = lineSegs(L, frameFor(0)).filter((g) => g.body).map((g) => Math.max(1, Math.floor((g.e - g.b) / gp)));
    L.perMin = per.length ? Math.min(...per) : 0;
    L.perMax = per.length ? Math.max(...per) : 0;
    L.total = per.reduce((a, b) => a + b, 0);
    return L;
  }

  // ---------- わくを かく ----------
  function frameHTML(fid, fw, fh) {
    const f = byId(fid);
    if (f && f.rich) {
      const { src, box } = richGeom(fid, fw, fh);
      return `<img class="motif" src="${src}" alt="" style="left:${mm(box.x)};top:${mm(box.y)};width:${mm(box.w)};height:${mm(box.h)}">`;
    }
    const sz = SIZES[fid];
    if (!sz) return '';
    const g = frameGeom(fw, fh, fid);
    const src = (p) => `assets/frames/${fid}/${p}.svg`;
    let h = '';
    // すみ：左がわは そのまま、右がわは 左右 はんてん（絵が 内がわを むく）
    const { cw, ch } = g;
    const corner = (x, y, flip) =>
      `<img class="motif${flip ? ' flip' : ''}" src="${src('corner')}" alt="" style="left:${mm(x)};top:${mm(y)};width:${mm(cw)};height:${mm(ch)}">`;
    h += corner(0, 0, false) + corner(fw - cw, 0, true) + corner(0, fh - ch, false) + corner(fw - cw, fh - ch, true);

    // へん：A・B を 交互に 同じ 間かくで ならべる（A と B の 大きさの ちがいは もとの 絵の まま）
    const m = g.b * 0.92;
    const ms = m / Math.max(...sz.a, ...sz.b);
    const dim = { a: [sz.a[0] * ms, sz.a[1] * ms], b: [sz.b[0] * ms, sz.b[1] * ms] };
    const put = (p, cx, cy) => {
      const [w, hh] = dim[p];
      return `<img class="motif" src="${src(p)}" alt="" style="left:${mm(cx - w / 2)};top:${mm(cy - hh / 2)};width:${mm(w)};height:${mm(hh)}">`;
    };
    const run = (len, cornerLen, fn) => {
      const L = len - 2 * cornerLen;
      if (L < m) return;
      const k = Math.max(1, Math.round(L / (m * 1.55)));
      for (let i = 0; i < k; i++) h += fn(cornerLen + (L * (i + 0.5)) / k, i % 2 ? 'b' : 'a');
    };
    run(fw, cw, (x, p) => put(p, x, g.b / 2) + put(p, x, fh - g.b / 2));
    run(fh, ch, (y, p) => put(p, g.b / 2, y) + put(p, fw - g.b / 2, y));
    return h;
  }

  // ---------- 行を かく ----------
  // 1行ずつの はんい。よこ書き：r 行めの 下の 線の y と、書ける x の はじめ（b）・おわり（e）。
  // たて書き：r 行め（右から）の 右はし x と、書ける y の はじめ・おわり。丸い わくは 行ごとに ながさが かわる
  function lineSegs(L, fid) {
    const { area, n, pitch } = L;
    const f = byId(fid);
    const G = f && f.round ? richGeom(fid, L.fw, L.fh) : null;
    const segs = [];
    for (let r = 0; r < n; r++) {
      const body = !(S.atena && r === 0) && !(S.yori && r === n - 1);
      if (S.dir === 'yoko') {
        const y = area.y + pitch * (r + 1);
        let b = area.x, e = area.x + area.w;
        if (G) {
          const sp = roundSpan(G, 'rows', y - pitch, y);
          if (!sp) continue;
          b = Math.max(b, sp[0]); e = Math.min(e, sp[1]);
        }
        segs.push({ r, pos: y, b, e, body });
      } else {
        const x = area.x + area.w - pitch * r;
        let b = area.y, e = area.y + area.h;
        if (G) {
          const sp = roundSpan(G, 'cols', x - pitch, x);
          if (!sp) continue;
          b = Math.max(b, sp[0]); e = Math.min(e, sp[1]);
        }
        segs.push({ r, pos: x, b, e, body });
      }
    }
    return segs.filter((g) => g.e - g.b > pitch);
  }

  function linesHTML(L, fid) {
    const { pitch } = L;
    const t = 0.25;                                  // 線の ふとさ
    const fs = Math.min(pitch * 0.55, 7, L.along * 0.13); // 「へ」「より」の 字の 大きさ
    const segs = lineSegs(L, fid);
    const last = L.n - 1;
    let h = '';
    if (S.dir === 'yoko') {
      for (const { r, pos: y, b, e } of segs) {
        const w = e - b;
        let x0 = b, x1 = e;
        let mark = '';
        if (S.atena && r === 0) {
          x1 = b + w * 0.6;
          mark = `<span class="mark" style="left:${mm(x1 + 1.2)};top:${mm(y - fs - 0.6)};font-size:${mm(fs)}">へ</span>`;
        } else if (S.yori && r === last) {
          x1 = e - fs * 2.4;
          x0 = Math.min(b + w * 0.42, x1 - w * 0.35);
          mark = `<span class="mark" style="left:${mm(x1 + 1.2)};top:${mm(y - fs - 0.6)};font-size:${mm(fs)}">より</span>`;
        }
        h += `<div class="rule" style="left:${mm(x0)};top:${mm(y - t / 2)};width:${mm(x1 - x0)};height:${mm(t)}"></div>${mark}`;
      }
    } else {
      // たて書き：右から 左へ。行と 行の さかいめに 線を ひく（さかいめの 線は となりあう 2行の はんいを あわせた ながさ）
      const byR = new Map(segs.map((g) => [g.r, g]));
      for (let k = 0; k <= L.n; k++) {
        const a = byR.get(k - 1), c = byR.get(k);
        if (!a && !c) continue;
        const x = (c || a).pos - (c ? 0 : pitch);
        const y0 = Math.min(a ? a.b : Infinity, c ? c.b : Infinity);
        const y1 = Math.max(a ? a.e : -Infinity, c ? c.e : -Infinity);
        h += `<div class="rule" style="left:${mm(x - t / 2)};top:${mm(y0)};width:${mm(t)};height:${mm(y1 - y0)}"></div>`;
      }
      const cx = (g) => g.pos - pitch / 2 - fs / 2;
      const first = byR.get(0), lastSeg = byR.get(last);
      if (S.atena && first) h += `<span class="mark vt" style="left:${mm(cx(first))};top:${mm(first.b + (first.e - first.b) * 0.62)};font-size:${mm(fs)}">へ</span>`;
      if (S.yori && lastSeg) h += `<span class="mark vt" style="left:${mm(cx(lastSeg))};top:${mm(lastSeg.e - fs * 2.3)};font-size:${mm(fs)}">より</span>`;
    }
    return h;
  }

  function frameFor(i) {
    if (S.mode !== 'cycle') return S.frame;
    const list = seasonFrames();
    if (!list.length) return S.frame;
    const start = Math.max(0, list.findIndex((f) => f.id === S.frame));
    return list[(start + i) % list.length].id;
  }
  function seasonFrames() {
    return FRAMES.filter((f) => S.season === 'all' || (S.season === 'maru' ? f.round : f.season === S.season));
  }

  // ---------- 見本 ----------
  function renderSheet(L) {
    const sheet = $('#sheet');
    sheet.className = `sheet p-${S.paper}`;
    sheet.style.width = mm(L.W);
    sheet.style.height = mm(L.H);
    let h = '';
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const fid = frameFor(r * L.cols + c);
        const x = MARGIN + L.pw * c + CUT;
        const y = MARGIN + L.ph * r + CUT;
        h += `<div class="panel" style="left:${mm(x)};top:${mm(y)};width:${mm(L.fw)};height:${mm(L.fh)}">`
          + (fid === NONE ? '' : frameHTML(fid, L.fw, L.fh)) + linesHTML(L, fid) + '</div>';
      }
    }
    // 切りはなす 点線
    for (let c = 1; c < L.cols; c++) {
      h += `<div class="cut" style="left:${mm(MARGIN + L.pw * c)};top:${mm(MARGIN)};height:${mm(L.H - 2 * MARGIN)};border-left-width:0.2mm"></div>`;
    }
    for (let r = 1; r < L.rows; r++) {
      h += `<div class="cut" style="left:${mm(MARGIN)};top:${mm(MARGIN + L.ph * r)};width:${mm(L.W - 2 * MARGIN)};border-top-width:0.2mm"></div>`;
    }
    sheet.innerHTML = h;
    fitZoom();
  }

  function fitZoom() {
    const z = $('#zoom');
    if (S.view === 'big') { z.style.zoom = 1; return; }
    const stage = $('#stage');
    const [W, H] = PAPER[S.paper];
    const availW = stage.clientWidth - 4;
    const availH = window.innerHeight - stage.getBoundingClientRect().top - 16;
    const k = Math.min(availW / (W * PX_PER_MM), Math.max(availH, 300) / (H * PX_PER_MM), 1);
    z.style.zoom = k > 0 ? k : 1;
  }

  // ---------- わくの えらぶ ところ ----------
  const TW = 36, TH = 46; // 見本の 大きさ（mm）
  function renderPicker() {
    $('#s-season').innerHTML = window.SEASONS.map(([v, name]) =>
      `<button data-v="${v}" class="${S.season === v ? 'on' : ''}">${name}</button>`).join('');
    const items = [{ id: NONE, name: 'むじ' }, ...seasonFrames()];
    $('#frames').innerHTML = items.map((f) => {
      const inner = f.id === NONE
        ? '<div class="plain">わく なし</div>'
        : `<div class="sheet" style="width:${mm(TW)};height:${mm(TH)}"><div class="panel" style="left:0;top:0;width:${mm(TW)};height:${mm(TH)}">${frameHTML(f.id, TW, TH)}</div></div>`;
      return `<button class="fbtn${S.frame === f.id ? ' on' : ''}" data-id="${f.id}" title="${f.name}"><div class="thumb">${inner}</div><small>${f.name}</small></button>`;
    }).join('');
    scaleThumbs();
  }
  function scaleThumbs() {
    document.querySelectorAll('.fbtn .thumb .sheet').forEach((el) => {
      const w = el.parentElement.clientWidth;
      if (w) el.style.transform = `scale(${w / (TW * PX_PER_MM)})`;
    });
  }

  // ---------- 画面の ぜんぶを 新しく ----------
  function setSeg(id, v) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
  }

  function render() {
    setSeg('s-paper', S.paper);
    setSeg('s-faces', S.faces);
    setSeg('s-dir', S.dir);
    setSeg('s-grade', S.grade);
    setSeg('s-mode', S.mode);
    setSeg('s-view', S.view);
    $('#c-atena').checked = S.atena;
    $('#c-yori').checked = S.yori;

    const L = layout();
    $('#i-face').textContent = `1面 ＝ ${f1(L.pw)} × ${f1(L.ph)} mm`;
    $('#i-fit').textContent = `→ この 大きさだと ${GRADES[S.grade].name}の 行は ${L.fit}行 はいります`;
    $('#i-lines').textContent = L.n;
    $('#b-minus').disabled = L.n <= L.need;
    $('#b-plus').disabled = L.n >= L.maxLines;
    $('#b-reset').disabled = S.lines == null || L.n === L.auto;

    const parts = [];
    if (S.atena) parts.push('あて名 1');
    parts.push(`本文 ${L.body}`);
    if (S.yori) parts.push('なまえ 1');
    $('#i-detail').textContent = `${parts.join('・')}　／　1行の はば ${f1(L.pitch)}mm　／　1行 やく${L.perMin === L.perMax ? L.perMax : `${L.perMin}〜${L.perMax}`}字・本文 ぜんぶで やく${L.total}字`;

    const warn = [];
    if (L.fit < L.need) {
      warn.push(`この 大きさでは ${GRADES[S.grade].name}の 行の はばで 書けません。面の 数を へらすか、わくを むじに してください。`);
    } else if (L.pitch < L.gp - 0.05) {
      warn.push(`行の はばが 学年の めやす（${L.gp}mm）より せまく なって います。`);
    }
    const fr = byId(S.frame);
    if (S.faces >= 12 && (S.mode === 'cycle' ? seasonFrames().some((f) => f.fine) : fr && fr.fine)) {
      warn.push('こまかい 絵の わくは、小さい 面だと 絵が つぶれやすいです。');
    }
    $('#i-warn').hidden = !warn.length;
    $('#i-warn').textContent = warn.join(' ');

    const cur = S.frame === NONE ? 'むじ（わく なし）' : (fr ? fr.name : '');
    $('#i-frame').textContent = S.mode === 'cycle'
      ? `「${SEASONS_NAME()}」の わくを じゅんに つかいます（${cur} から）`
      : `えらんで いる わく：${cur}`;

    renderSheet(L);
    save();
  }
  const SEASONS_NAME = () => (window.SEASONS.find(([v]) => v === S.season) || [0, ''])[1];

  // 行の 数が 自動で かわった ときに しらせる
  function change(what, fn) {
    const before = layout().n;
    const hadOverride = S.lines != null;
    fn();
    S.lines = null;
    const after = layout().n;
    const note = $('#note');
    if (hadOverride || before !== after) {
      note.hidden = false;
      note.textContent = `${what}を かえたので、行の 数を ${after}行に しました`;
    } else {
      note.hidden = true;
    }
    render();
  }

  // ---------- そうさ ----------
  const segHandler = (id, what, key, conv = (v) => v) => {
    $(`#${id}`).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      change(what, () => { S[key] = conv(b.dataset.v); });
    });
  };
  segHandler('s-paper', 'ようし', 'paper');
  segHandler('s-faces', '面の 数', 'faces', Number);
  segHandler('s-dir', 'かきかた', 'dir');
  segHandler('s-grade', '学年', 'grade');
  segHandler('s-mode', 'わくの つかいかた', 'mode');

  $('#s-view').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.view = b.dataset.v;
    render();
  });
  $('#c-atena').addEventListener('change', (e) => change('あて名の 行', () => { S.atena = e.target.checked; }));
  $('#c-yori').addEventListener('change', (e) => change('なまえの 行', () => { S.yori = e.target.checked; }));

  $('#b-minus').addEventListener('click', () => { S.lines = layout().n - 1; $('#note').hidden = true; render(); });
  $('#b-plus').addEventListener('click', () => { S.lines = layout().n + 1; $('#note').hidden = true; render(); });
  $('#b-reset').addEventListener('click', () => { S.lines = null; $('#note').hidden = true; render(); });

  $('#s-season').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.season = b.dataset.v;
    renderPicker();
    render();
  });
  $('#frames').addEventListener('click', (e) => {
    const b = e.target.closest('.fbtn');
    if (!b) return;
    change('わく', () => { S.frame = b.dataset.id; });
    document.querySelectorAll('.fbtn').forEach((x) => x.classList.toggle('on', x.dataset.id === S.frame));
  });

  $('#b-print').addEventListener('click', () => window.print());
  window.addEventListener('resize', () => { fitZoom(); scaleThumbs(); });

  renderPicker();
  render();
})();
