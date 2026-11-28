#!/usr/bin/env python3
"""ゆびで おんがく：録音を しらべて 譜面（song-tengoku.js）を つくる 道具

つかいかた（yubi-de-ongaku/ の なかで）:
    pip install numpy scipy librosa soundfile
    python3 tools/make_song.py

なにを するか:
  1. 録音を しらべる
       ・はく（拍）の 時間
       ・音が なった 瞬間（オンセット）と その つよさ
       ・音の 大きさ（大きい／小さい）
       ・音の 高さの うごき（高い／低い。オーケストラ ぜんたいの 「上のほうの 音」の 重心）
  2. 下の PLAN（どの はくから どの はくまで、どの うごきかたで、画面の どこに）に そって、
     「音が なった 瞬間」に 線の かど・はね・まがりめが くる ように 点を ならべる
       ・音が 大きい ほど 大きく うごく、小さい ほど 小さく うごく
       ・音が 高い ほど 上、低い ほど 下（メロディー・かいだん など）
       ・こまかい 音が つづく ところは 小きざみに、のびる 音は ゆったり
       ・おなじ 線を 2かい なぞらない（まる・8の字は 1しゅう、ほし・しかく・さんかくは 一筆で 1かい）
  3. song-tengoku.js に 書きだす（このファイルは 手で なおさない）
"""
import json
import math
import os
import sys

import numpy as np
import librosa
import scipy.ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIO = os.path.join(ROOT, 'assets', 'music', 'tengoku-to-jigoku.ogg')
OUT = os.path.join(ROOT, 'song-tengoku.js')
SR, HOP = 22050, 256

W, H = 1600, 900
GAP = 0.19     # 点と 点の あいだの いちばん みじかい 時間（秒）

# 画面の ばしょ（x0, y0, x1, y1）
BOX = {
    'full':   (150, 140, 1450, 780),
    'top':    (150, 130, 1450, 390),
    'bottom': (150, 520, 1450, 790),
    'mid':    (150, 300, 1450, 620),
    'left':   (130, 150, 740, 770),
    'right':  (860, 150, 1470, 770),
    'center': (430, 130, 1170, 790),
    'tl':     (140, 120, 760, 420),
    'tr':     (840, 120, 1460, 420),
    'bl':     (140, 500, 760, 800),
    'br':     (840, 500, 1460, 800),
}

# 譜面の けいかく：がめんごとに [はじまりの はく, おわりの はく, うごきかた, ばしょ, いろ, むき(1:→ / -1:←), (点の あいだを 何ばいに するか)]
#   うごきかた … zigzag ギザギザ / mountain やま（高い音ほど 高い）/ wave なみ / melody メロディー /
#                stairs かいだん / bounce ぴょんぴょん / curl くるくる / circle まる / spiral うず（そとへ）/
#                spiralin うず（なかへ）/ eight 8の字 / star ほし / square しかく / triangle さんかく /
#                lightning いなずま / swoop すいーっ（ゆったり 大きく）
PLAN = [
    # はじまり：小さく ぽつぽつ
    [[0, 6, 'bounce', 'top', 'cyan', 1], [6, 11, 'stairs', 'bottom', 'yellow', -1]],
    # しずかに だんだん 大きく
    [[11, 17, 'wave', 'top', 'lavender', 1], [17, 21, 'curl', 'mid', 'pink', -1], [21, 27, 'melody', 'bottom', 'cyan', 1]],
    [[27, 33, 'spiral', 'center', 'orange', 1]],
    # おりてくる フレーズ × 4
    [[33, 39, 'swoop', 'left', 'orange', 1], [39, 45, 'melody', 'right', 'yellow', 1]],
    [[45, 51, 'lightning', 'left', 'lime', 1], [51, 57, 'stairs', 'right', 'cyan', 1]],
    # たかい 音が のびる
    [[57, 68, 'eight', 'full', 'purple', 1]],
    # カンカン
    [[68, 72, 'zigzag', 'top', 'orange', 1], [72, 78, 'bounce', 'bottom', 'lavender', -1]],
    [[78, 84, 'star', 'left', 'yellow', 1], [84, 90, 'circle', 'right', 'pink', 1]],
    [[90, 95, 'melody', 'top', 'lime', 1], [95, 101, 'mountain', 'bottom', 'orange', -1]],
    [[101, 104, 'curl', 'tl', 'cyan', 1], [104, 108, 'lightning', 'tr', 'yellow', 1], [108, 111, 'square', 'br', 'pink', 1]],
    # すこし しずかに
    [[111, 119, 'bounce', 'top', 'cyan', 1], [119, 128, 'stairs', 'bottom', 'lime', -1]],
    # しずか → だんだん 大きく
    [[128, 135, 'wave', 'mid', 'lavender', 1]],
    [[135, 143, 'spiral', 'center', 'pink', 1]],
    # カンカン ふたたび
    [[143, 147, 'zigzag', 'tl', 'orange', 1], [147, 151, 'mountain', 'tr', 'yellow', 1], [151, 159, 'curl', 'bottom', 'cyan', -1]],
    [[159, 165, 'eight', 'left', 'lime', 1], [165, 171, 'star', 'right', 'pink', 1]],
    [[171, 179, 'melody', 'top', 'lavender', 1], [179, 183, 'triangle', 'bl', 'orange', 1], [183, 187, 'lightning', 'br', 'yellow', 1]],
    [[187, 195, 'square', 'left', 'cyan', 1], [195, 203, 'bounce', 'right', 'pink', 1, 1.8]],
    # さいごに むかって もりあがる
    [[203, 214, 'zigzag', 'full', 'purple', 1, 2.0]],
]
# ジャン ジャン ジャン ジャーン と、さいごの のばす 音
POPS = [[214, 'orange', 220, 700], [215, 'yellow', 220, 200], [216, 'lime', 1380, 200], [217, 'pink', 1380, 700]]
FINAL = [218, 223, 'spiral', 'center', 'cyan', 1]


# ---------------------------------------------------------------- しらべる
def analyze(path):
    y, sr = librosa.load(path, sr=SR)
    dur = len(y) / sr
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)

    # はく：librosa の 拍 検出 → こまかい ゆれを はんぶん ならす（つよい 音の ところは そのまま）
    _, bt = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=HOP, units='time', tightness=100)
    n = len(bt)
    sm = np.zeros(n)
    for i in range(n):
        lo, hi = max(0, i - 4), min(n, i + 5)
        p = np.polyfit(np.arange(lo, hi), bt[lo:hi], 1)
        sm[i] = np.polyval(p, i)
    beats = sm + 0.5 * (bt - sm)
    for a in [33, 39, 45, 51, 214, 215, 216, 217]:
        beats[a] = bt[a]
    d = float(np.mean(np.diff(beats[-6:])))
    tail = [beats[-1] + d * k for k in range(1, 8) if beats[-1] + d * k < dur - 0.3]
    beats = np.concatenate([beats, tail])

    # 音が なった 瞬間
    on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=HOP, delta=0.07, wait=4)
    ot = librosa.frames_to_time(on, sr=sr, hop_length=HOP)
    ost = np.clip(oenv[on] / np.percentile(oenv[on], 95), 0, 1)

    # 音の 大きさ（0〜1）
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    db = 20 * np.log10(rms + 1e-6)
    loud = np.clip((nd.uniform_filter1d(db, 5) + 45) / 31, 0, 1)

    # 音の 高さの うごき（上位の つよい 音の 重心。半音 単位）
    C = np.abs(librosa.cqt(y, sr=sr, hop_length=HOP, fmin=librosa.note_to_hz('C3'), n_bins=48))
    P = C ** 2
    thr = np.quantile(P, 0.85, axis=0)
    Wt = np.where(P >= thr, P, 0)
    cent = 48 + (Wt * np.arange(48)[:, None]).sum(0) / (Wt.sum(0) + 1e-12)
    cent = nd.median_filter(cent, 25)

    ft = librosa.frames_to_time(np.arange(len(loud)), sr=sr, hop_length=HOP)
    return dict(dur=dur, beats=beats, ot=ot, ost=ost, loud=loud, cent=cent, ft=ft)


def at(A, arr, t):
    i = int(np.clip(np.searchsorted(A['ft'], t), 0, len(arr) - 1))
    return float(arr[i])


def loud_at(A, t):
    # その 音の あとの 0.12秒 の いちばん 大きい ところ
    return max(at(A, A['loud'], t + k * 0.03) for k in range(5))


# ---------------------------------------------------------------- 点を えらぶ
def pick_times(A, t0, t1, gap):
    """t0〜t1 の なかの 音が なった 瞬間から、gap 秒 いじょう はなれた ものを つよい じゅんに えらぶ"""
    idx = [i for i, t in enumerate(A["ot"]) if t0 + gap <= t <= t1 - gap]
    chosen = []
    for i in sorted(idx, key=lambda i: -A['ost'][i]):
        if all(abs(A['ot'][i] - A['ot'][j]) >= gap for j in chosen):
            chosen.append(i)
    ts = [t0] + sorted(float(A['ot'][i]) for i in chosen) + [t1]
    return ts


# ---------------------------------------------------------------- うごきかた
def norm_pitch(ps):
    ps = np.array(ps)
    lo, hi = ps.min(), ps.max()
    if hi - lo < 3:   # 高さが あまり かわらない ときは まんなか ふきん
        return list(0.5 + (ps - ps.mean()) / 6)
    return list((ps - lo) / (hi - lo))


def make_path(A, kind, box, ts, direction, rnd):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    t0, t1 = ts[0], ts[-1]
    round_kind = kind in ('circle', 'spiral', 'spiralin', 'eight')
    grid = set()
    if round_kind:
        # まるい うごきは、音の ない ところにも 0.1秒ごとに 通る 点を くわえて まるく えがく
        # （まわる はやさは 一定、まるの 大きさは その ときの 音の 大きさ）
        for g in np.arange(t0 + 0.1, t1 - 0.05, 0.1):
            if all(abs(g - t) > 0.05 for t in ts):
                grid.add(round(float(g), 3))
        ts = sorted(set(ts) | grid)
    L = [loud_at(A, t) for t in ts]
    Pn = norm_pitch([at(A, A['cent'], t + 0.05) for t in ts])
    # 高さの こまかい ぶれを ならす
    Pn = [Pn[0]] + [0.25 * Pn[i - 1] + 0.5 * Pn[i] + 0.25 * Pn[i + 1] for i in range(1, len(Pn) - 1)] + [Pn[-1]] if len(Pn) > 2 else Pn
    big = [0.3 + 0.7 * l for l in L]     # 大きさ（0.3〜1）
    def X(t):
        f = (t - t0) / (t1 - t0)
        return x0 + bw * (f if direction > 0 else 1 - f)
    # はやい 音（よこの すすみが みじかい）ほど 小さく うごく ための、となりとの よこの きょり
    xs = [X(t) for t in ts]
    def dxn(i):
        ds = [abs(xs[i] - xs[j]) for j in (i - 1, i + 1) if 0 <= j < len(xs)]
        return sum(ds) / len(ds)
    pts = []
    add = lambda t, x, y, s='L', q=0: pts.append([round(t, 3), round(x), round(y), s] + ([round(q)] if q else []))

    if kind in ('zigzag', 'lightning'):
        for i, t in enumerate(ts):
            sg = -1 if i % 2 == 0 else 1
            jit = (rnd.random() - 0.5) * 0.25 if kind == 'lightning' else 0
            add(t, X(t), cy + sg * min(bh / 2 * min(1, big[i] + jit), max(45, 1.5 * dxn(i))))
    elif kind == 'mountain':
        for i, t in enumerate(ts):
            hgt = min(bh * (0.35 + 0.65 * Pn[i]) * (0.55 + 0.45 * L[i]), max(60, 2.6 * dxn(i))) if i % 2 else 0
            add(t, X(t), y1 - hgt)
    elif kind == 'wave':
        for i, t in enumerate(ts):
            sg = -1 if i % 2 == 0 else 1
            add(t, X(t), cy + sg * min(bh / 2 * big[i], max(40, 1.4 * dxn(i))), 'C')
    elif kind in ('melody', 'swoop'):
        for i, t in enumerate(ts):
            add(t, X(t), cy - (Pn[i] - 0.5) * bh * (0.55 + 0.45 * L[i]), 'C')
    elif kind == 'stairs':
        lv = [round(p * 4) / 4 for p in Pn]
        for i, t in enumerate(ts):
            y = y1 - bh * (0.1 + 0.8 * lv[i])
            if i == 0:
                add(t, X(t), y)
                continue
            tm = ts[i - 1] + (t - ts[i - 1]) * 0.35
            add(tm, X(ts[i - 1]), y)      # たてに うごいて
            add(t, X(t), y)               # よこに すすむ
    elif kind == 'bounce':
        for i, t in enumerate(ts):
            if i == 0:
                add(t, X(t), y1)
                continue
            d = t - ts[i - 1]
            add(t, X(t), y1, 'H', min(bh * big[i] * min(1, (d / 0.45) ** 0.5), 1.7 * abs(X(t) - X(ts[i - 1]))))
    elif kind == 'curl':
        for i, t in enumerate(ts):
            if i == 0:
                add(t, X(t), cy + bh * 0.25)
                continue
            d = X(t) - X(ts[i - 1])
            r = min(abs(d) * 0.55, bh * 0.32) * (0.5 + 0.5 * L[i])
            add(t, X(t), cy + bh * 0.25, 'O', max(14, r))
    elif kind in ('circle', 'spiral', 'spiralin', 'eight'):
        R = min(bw, bh) / 2
        beats_len = (t1 - t0) / 0.465
        # おなじ 線を 2かい なぞらない：まる・8の字は 1しゅう だけ。うずは 大きさが かわるので かさならない（2しゅう まで）
        if kind in ('circle', 'eight'):
            turns = 1.0
        else:
            turns = min(2.0, max(1.0, round(beats_len / 4 * 2) / 2))
        for i, t in enumerate(ts):
            f = (t - t0) / (t1 - t0)
            th = -math.pi / 2 + direction * 2 * math.pi * turns * f
            sc = 'c' if t in grid else 'C'
            if kind == 'circle':
                r = R * (0.55 + 0.45 * L[i])
                add(t, cx + r * math.cos(th), cy + r * math.sin(th), sc)
            elif kind in ('spiral', 'spiralin'):
                g = f if kind == 'spiral' else 1 - f
                r = R * (0.12 + 0.88 * g) * (0.6 + 0.4 * L[i])
                add(t, cx + r * math.cos(th), cy + r * math.sin(th), sc)
            else:
                th2 = 2 * math.pi * turns * f
                s = 0.6 + 0.4 * L[i]
                add(t, cx + bw / 2 * s * math.sin(th2), cy + bh / 2 * s * math.sin(th2) * math.cos(th2) * 1.6, sc)
    elif kind in ('star', 'square', 'triangle'):
        R = min(bw, bh) / 2
        if kind == 'star':
            vs = [(-math.pi / 2 + k * 2 * math.pi / 5) for k in (0, 2, 4, 1, 3)]
        elif kind == 'square':
            vs = [(-3 * math.pi / 4 + k * math.pi / 2) for k in range(4)]
        else:
            vs = [(-math.pi / 2 + k * 2 * math.pi / 3) for k in range(3)]
        # 一筆で 1かい だけ なぞって、はじめの 点に もどる。
        # かどの 時間は、等分した 時間に いちばん ちかい「音が なった 瞬間」に あわせる
        n = len(vs)
        inner = ts[1:-1]
        corner = [t0]
        for k in range(1, n):
            want = t0 + (t1 - t0) * k / n
            cands = [t for t in inner if t > corner[-1] + 0.15 and t < t1 - 0.15 * (n - k)]
            corner.append(min(cands, key=lambda t: abs(t - want)) if cands else want)
        corner.append(t1)
        r = R * (0.55 + 0.45 * float(np.mean(L)))
        for i, t in enumerate(corner):
            a = vs[i % n]
            add(t, cx + r * math.cos(a), cy + r * math.sin(a))
    else:
        raise ValueError(kind)
    return pts


def stroke(A, b0, b1, kind, box, color, direction, rnd, mult=1.0):
    beats = A['beats']
    t0, t1 = float(beats[b0]), float(beats[b1])
    out = {'k': 'path', 'c': color}
    gap = GAP * (2.2 if kind in ('swoop', 'lightning') else 1.4 if kind == 'bounce' else 1) * mult
    ts = pick_times(A, t0, t1, gap)
    out['p'] = make_path(A, kind, BOX[box], ts, direction, rnd)
    # 線の ふとさ：その あいだの 音の 大きさ
    m = np.mean([loud_at(A, t) for t in np.linspace(t0, t1, 12)])
    out['w'] = int(round(14 + 14 * m))
    out['name'] = kind
    return out


def main():
    import random
    rnd = random.Random(7)
    A = analyze(AUDIO)
    scenes = []
    for sc in PLAN:
        scenes.append({'strokes': [stroke(A, *s[:6], rnd, *s[6:]) for s in sc]})
    scenes.append({'strokes': [{'k': 'pop', 'b': [b, b], 'c': c, 'x': x, 'y': y} for b, c, x, y in POPS]})
    scenes.append({'strokes': [stroke(A, *FINAL, rnd, 1.0)]})

    env = [int(round(100 * at(A, A['loud'], t))) for t in np.arange(0, A['dur'], 0.05)]
    onsets = [[round(float(t), 3), round(float(s), 2)] for t, s in zip(A['ot'], A['ost'])]

    def js(v):
        return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    lines = []
    lines.append('/* 「天国と地獄」（オッフェンバック）の 譜面\n'
                 '   ★ この ファイルは tools/make_song.py で つくって います（手で なおさない）。\n'
                 '   録音: Musopen の オーケストラ録音（パブリックドメイン）assets/music/tengoku-to-jigoku.ogg\n'
                 '   beats  … はく（4分音符）の 時間（秒）\n'
                 '   env    … 音の 大きさ（0〜100）。0.05秒ごと\n'
                 '   onsets … 音が なった 瞬間 [秒, つよさ0〜1]\n'
                 '   scenes … がめん。線は k:"path" の とき p:[[秒, x, y, つなぎかた, おおきさ], …]\n'
                 '            つなぎかた L まっすぐ / C なめらか / c なめらか（音の ない ところの 通る 点）/ H ぴょん（はねる 高さ）/ O くるっと（わの 大きさ）\n'
                 '*/')
    lines.append('(function (G) {')
    lines.append("    'use strict';")
    lines.append('    G.SONG_TENGOKU = {')
    lines.append(f'        duration: {A["dur"]:.2f},')
    lines.append('        leadBeats: 2,')
    lines.append('        beats: ' + js([round(float(b), 3) for b in A['beats']]) + ',')
    lines.append('        env: ' + js(env) + ',')
    lines.append('        onsets: ' + js(onsets) + ',')
    lines.append('        scenes: [')
    for sc in scenes:
        lines.append('            { strokes: [')
        for s in sc['strokes']:
            lines.append('                ' + js(s) + ',')
        lines.append('            ] },')
    lines.append('        ]')
    lines.append('    };')
    lines.append("})(typeof globalThis !== 'undefined' ? globalThis : this);")
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    n = sum(len(s.get('p', [])) for sc in scenes for s in sc['strokes'])
    print(f'wrote {OUT}: scenes={len(scenes)} points={n} beats={len(A["beats"])}')


if __name__ == '__main__':
    main()
