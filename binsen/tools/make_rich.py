"""「にぎやかな わく」（まるごと 1まいの 絵）を SVG に して、書く ところ（内がわの あき）を はかる。

  python3 binsen/tools/make_rich.py

いる もの: Pillow / numpy / scipy / potracer（pip install potracer）

もと画像: assets/frames-src/rich/<名前>-<かたち>.webp（四角い わく）
          assets/frames-src/round/<名前>-<かたち>.webp（丸い わく）
  かたち = tate（たて長 2:3）・yoko（よこ長 3:2）・kaku（正方形）
1. 白黒に はっきり させる
2. 四角い わく：まん中を ふくむ いちばん 大きい 白い 長方形（＝ 行を ひく ところ）を さがす
   丸い わく：まん中の 白い ところ（わくの 内がわ）を さがし、
             よこ・たての すじごとに 「どこから どこまで 書けるか」を 書き出す（行の ながさを 1行ずつ かえる ため）
3. potrace で まるごと ベクター（SVG）に する
できた もの: assets/frames/rich/・round/ の <名前>-<かたち>.svg と sizes.js
"""
import json
import pathlib

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SETS = [  # （もと画像の フォルダー, できた ものの フォルダー, sizes.js の 名前, 丸い わくか）
    (ROOT / "assets" / "frames-src" / "rich", ROOT / "assets" / "frames" / "rich", "RICH_SIZES", False),
    (ROOT / "assets" / "frames-src" / "round", ROOT / "assets" / "frames" / "round", "ROUND_SIZES", True),
]
STEP = 8  # 丸い わくの 「書ける はば」を 何ピクセルごとに 書き出すか
SHAPES = ("tate", "yoko", "kaku")


def inner_rect(ink):
    """まん中を ふくむ、絵に ふれない いちばん 大きい 長方形 [x, y, w, h]（もとの 画像の ピクセル）。"""
    k = 2  # はやく する ため 半分の 大きさで さがす
    m = ndimage.binary_dilation(ink[::k, ::k], iterations=4)  # 絵から 少し はなす
    h, w = m.shape
    cy, cx = h // 2, w // 2
    free = ~m[:, cx]
    left = np.zeros(h, int)
    right = np.zeros(h, int)
    for y in range(h):
        lft = np.flatnonzero(m[y, :cx])
        rgt = np.flatnonzero(m[y, cx:])
        left[y] = cx - (lft[-1] + 1 if len(lft) else 0)
        right[y] = rgt[0] if len(rgt) else w - cx
    best = (0, 0, 0, 0, 0)
    for t in range(cy, -1, -1):
        if not free[t]:
            break
        ml, mr = left[t], right[t]
        for b in range(t, h):
            if not free[b]:
                break
            ml, mr = min(ml, left[b]), min(mr, right[b])
            if b >= cy and (b - t + 1) * (ml + mr) > best[0]:
                best = ((b - t + 1) * (ml + mr), cx - ml, t, ml + mr, b - t + 1)
    return [int(v) * k for v in best[1:]]


def inner_region(ink):
    """丸い わく：まん中を ふくむ 白い ところ（絵から 少し はなす）。外に もれる ときは はなす はばを ふやす。"""
    H, W = ink.shape
    cy, cx = H // 2, W // 2
    for margin in range(8, 41, 4):
        free = ~ndimage.binary_dilation(ink, iterations=margin)
        lab, _ = ndimage.label(free)
        k = lab[cy, cx]
        if not k:
            continue
        reg = lab == k
        if not (reg[0].any() or reg[-1].any() or reg[:, 0].any() or reg[:, -1].any()):
            return reg, margin
    raise SystemExit("わくの 内がわが 外と つながって います（線の とぎれが 大きい）")


def spans(reg, axis):
    """すじ（axis=0: よこの 行・1: たての 列）ごとに、まん中を ふくむ 白い はんい [位置, はじめ, おわり]。"""
    r = reg if axis == 0 else reg.T
    n, m = r.shape
    c = m // 2
    out = []
    for i in range(0, n, STEP):
        line = r[i]
        if not line[c]:
            continue
        lo = np.flatnonzero(~line[:c])
        hi = np.flatnonzero(~line[c:])
        out.append([i, int(lo[-1] + 1 if len(lo) else 0), int(c + hi[0] if len(hi) else m)])
    return out


def to_svg(ink):
    h, w = ink.shape
    # potracer は 0（くろ）の ところを 線と みなすので、反てんして わたす
    plist = potrace.Bitmap(~ink).trace(turdsize=8, alphamax=1.0, opticurve=True, opttolerance=0.3)
    d = []
    for curve in plist:
        p = curve.start_point
        d.append(f"M{p.x:.1f} {p.y:.1f}")
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}")
            else:
                d.append(f"C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}")
        d.append("Z")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<path fill="#000" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')


def main():
    for src_dir, out_dir, var, rnd in SETS:
        if src_dir.exists():
            make(src_dir, out_dir, var, rnd)


def make(SRC, OUT, var, rnd):
    OUT.mkdir(parents=True, exist_ok=True)
    info = {}
    for src in sorted(SRC.glob("*.webp")):
        name, shape = src.stem.rsplit("-", 1)
        if shape not in SHAPES:
            print("skip", src.name)
            continue
        a = np.array(Image.open(src).convert("L"))
        ink = a < 128
        # メモ: 線の とぎれを 自動で つなぐ（closing）と 花の しべが 黒く つぶれるので しない。
        #       とぎれが 目立つ 画像は ChatGPT で 作り直して もらう
        H, W = ink.shape
        if rnd:
            reg, margin = inner_region(ink)
            ys, xs = np.nonzero(reg)
            rect = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
            entry = {"size": [W, H], "inner": rect, "step": STEP, "rows": spans(reg, 0), "cols": spans(reg, 1)}
            print(name, shape, W, H, "inner", rect, "margin", margin)
        else:
            rect = inner_rect(ink)
            entry = {"size": [W, H], "inner": rect}
            print(name, shape, W, H, "inner", rect)
        (OUT / f"{name}-{shape}.svg").write_text(to_svg(ink))
        info.setdefault(name, {})[shape] = entry
    (OUT / "sizes.js").write_text("// make_rich.py で 自動で 作った ファイル（手で 書きかえない）\n"
                                  f"window.{var} = " + json.dumps(info, ensure_ascii=False, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
