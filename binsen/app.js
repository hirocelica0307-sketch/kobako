/* 手紙ちゃん */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const FRAMES = window.FRAMES;
  const SIZES = window.FRAME_SIZES;      // シンプルな わく（すみ・へんの 絵）
  const RICH = window.RICH_SIZES || {};   // にぎやかな わく（まるごと 1まいの 絵）
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
    const set = RICH[byId(fid).src];
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
      src: `assets/frames/rich/${byId(fid).src}-${best.shape}.svg`,
      box: { x: ox, y: oy, w: w0 * s, h: h0 * s },
      inner: { x: ox + ix * s, y: oy + iy * s, w: iw * s, h: ih * s },
    };
  }

  // 行を ひける ところ（面の 中の mm）
  function areaFor(fid, fw, fh) {
    const f = byId(fid);
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
    const perLine = Math.max(1, Math.floor(along / gp));
    return { W, H, cols, rows, pw, ph, fw, fh, area, across, along, gp, fit, need, maxLines, auto, n, pitch, body, perLine };
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
  function linesHTML(L) {
    const { area, n, pitch } = L;
    const t = 0.25;                                  // 線の ふとさ
    const fs = Math.min(pitch * 0.55, 7, L.along * 0.13); // 「へ」「より」の 字の 大きさ
    const last = n - 1;
    let h = '';
    if (S.dir === 'yoko') {
      for (let r = 0; r < n; r++) {
        const y = area.y + pitch * (r + 1);
        let x0 = area.x, x1 = area.x + area.w;
        let mark = '';
        if (S.atena && r === 0) {
          x1 = area.x + area.w * 0.6;
          mark = `<span class="mark" style="left:${mm(x1 + 1.2)};top:${mm(y - fs - 0.6)};font-size:${mm(fs)}">へ</span>`;
        } else if (S.yori && r === last) {
          x1 = area.x + area.w - fs * 2.4;
          x0 = Math.min(area.x + area.w * 0.42, x1 - area.w * 0.35);
          mark = `<span class="mark" style="left:${mm(x1 + 1.2)};top:${mm(y - fs - 0.6)};font-size:${mm(fs)}">より</span>`;
        }
        h += `<div class="rule" style="left:${mm(x0)};top:${mm(y - t / 2)};width:${mm(x1 - x0)};height:${mm(t)}"></div>${mark}`;
      }
    } else {
      // たて書き：右から 左へ。行と 行の さかいめに 線を ひく
      const right = area.x + area.w;
      for (let r = 0; r <= n; r++) {
        const x = right - pitch * r;
        h += `<div class="rule" style="left:${mm(x - t / 2)};top:${mm(area.y)};width:${mm(t)};height:${mm(area.h)}"></div>`;
      }
      const cx = (r) => right - pitch * (r + 0.5) - fs / 2;
      if (S.atena) h += `<span class="mark vt" style="left:${mm(cx(0))};top:${mm(area.y + area.h * 0.62)};font-size:${mm(fs)}">へ</span>`;
      if (S.yori) h += `<span class="mark vt" style="left:${mm(cx(last))};top:${mm(area.y + area.h - fs * 2.3)};font-size:${mm(fs)}">より</span>`;
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
    return FRAMES.filter((f) => S.season === 'all' || f.season === S.season);
  }

  // ---------- 見本 ----------
  function renderSheet(L) {
    const sheet = $('#sheet');
    sheet.className = `sheet p-${S.paper}`;
    sheet.style.width = mm(L.W);
    sheet.style.height = mm(L.H);
    let h = '';
    const lines = linesHTML(L);
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const fid = frameFor(r * L.cols + c);
        const x = MARGIN + L.pw * c + CUT;
        const y = MARGIN + L.ph * r + CUT;
        h += `<div class="panel" style="left:${mm(x)};top:${mm(y)};width:${mm(L.fw)};height:${mm(L.fh)}">`
          + (fid === NONE ? '' : frameHTML(fid, L.fw, L.fh)) + lines + '</div>';
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
    $('#i-detail').textContent = `${parts.join('・')}　／　1行の はば ${f1(L.pitch)}mm　／　1行 やく${L.perLine}字・本文 ぜんぶで やく${L.perLine * L.body}字`;

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
