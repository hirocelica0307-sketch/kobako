"""「にぎやかな わく」（まるごと 1まいの 絵）を SVG に して、書く ところ（内がわの あき）を はかる。

  python3 binsen/tools/make_rich.py

いる もの: Pillow / numpy / scipy / potracer（pip install potracer）

もと画像: assets/frames-src/rich/<名前>-<かたち>.webp
  かたち = tate（たて長 2:3）・yoko（よこ長 3:2）・kaku（正方形）
1. 白黒に はっきり させる
2. まん中を ふくむ いちばん 大きい 白い 長方形（＝ 行を ひく ところ）を さがす
3. potrace で まるごと ベクター（SVG）に する
できた もの: assets/frames/rich/<名前>-<かたち>.svg と assets/frames/rich/sizes.js
"""
import json
import pathlib

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "frames-src" / "rich"
OUT = ROOT / "assets" / "frames" / "rich"
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
        rect = inner_rect(ink)
        (OUT / f"{name}-{shape}.svg").write_text(to_svg(ink))
        info.setdefault(name, {})[shape] = {"size": [W, H], "inner": rect}
        print(name, shape, W, H, "inner", rect)
    (OUT / "sizes.js").write_text("// make_rich.py で 自動で 作った ファイル（手で 書きかえない）\n"
                                  "window.RICH_SIZES = " + json.dumps(info, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main()
