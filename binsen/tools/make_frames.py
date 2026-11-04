"""枠の もと画像（assets/frames-src/*.webp）から、すみ・へんの 絵を 切り出して SVG に する。

  python3 binsen/tools/make_frames.py

いる もの: Pillow / numpy / scipy / potracer（pip install potracer）

1. 白黒に はっきり させる（灰色の よごれ・ぼかしを なくす）
2. 絵を 1つずつ 見つける（はなれた 線の かたまり ＋ 外わくが かさなる ものは 1つに まとめる）
3. 左上の すみの 絵 ＝ corner、上の へんの 絵を 左から 交互に A・B と して、まん中あたりの 1つずつを えらぶ
4. potrace で 線を なめらかな ベクター（SVG）に する（いんさつで ギザギザ しない）
できた もの: assets/frames/<名前>/corner.svg・a.svg・b.svg と assets/frames/sizes.js（たて・よこの 大きさ）
"""
import json
import pathlib

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "frames-src"
OUT = ROOT / "assets" / "frames"
PAD = 4


def groups(ink):
    lab, n = ndimage.label(ndimage.binary_dilation(ink, iterations=2))
    boxes = [[s[0].start, s[1].start, s[0].stop, s[1].stop] for s in ndimage.find_objects(lab)]
    # ほかの 絵の 中に ある かたまりは 1つの 絵に まとめる（にんじんの 顔の 線 など）
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                iy = min(a[2], b[2]) - max(a[0], b[0])
                ix = min(a[3], b[3]) - max(a[1], b[1])
                # 小さい ほうが 7わり いじょう 大きい ほうの 中に ある ときだけ（となりの 絵とは まとめない）
                if iy > 0 and ix > 0 and iy * ix >= 0.7 * min(area(a), area(b)):
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    boxes.pop(j)
                    merged = True
                    break
            if merged:
                break
    # とても 小さい かたまり（パトカーの ランプの 光の 線 など）は いちばん 近い 絵に まとめる
    big = max(area(b) for b in boxes)
    small = [b for b in boxes if area(b) < big * 0.04]
    boxes = [b for b in boxes if area(b) >= big * 0.04]

    def gap(a, b):
        dy = max(0, max(a[0], b[0]) - min(a[2], b[2]))
        dx = max(0, max(a[1], b[1]) - min(a[3], b[3]))
        return dx * dx + dy * dy

    for s in small:
        k = min(range(len(boxes)), key=lambda i: gap(s, boxes[i]))
        b = boxes[k]
        boxes[k] = [min(s[0], b[0]), min(s[1], b[1]), max(s[2], b[2]), max(s[3], b[3])]
    return boxes


def area(b):
    return (b[2] - b[0]) * (b[3] - b[1])


def to_svg(ink, box):
    y0, x0, y1, x1 = box
    crop = np.pad(ink[y0:y1, x0:x1], PAD)
    h, w = crop.shape
    # potracer は 0（くろ）の ところを 線と みなすので、反てんして わたす
    plist = potrace.Bitmap(~crop).trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.2)
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
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
           f'<path fill="#000" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')
    return svg, w, h


def main():
    info = {}
    for src in sorted(SRC.glob("*.webp")):
        a = np.array(Image.open(src).convert("L"))
        H, W = a.shape
        ink = a < 128
        boxes = groups(ink)
        corner = max((b for b in boxes if b[0] < H * 0.15 and b[1] < W * 0.15), key=area)
        top = sorted((b for b in boxes
                      if (b[0] + b[2]) / 2 < H * 0.15 and b[1] >= corner[3] - 4
                      and area(b) < area(corner) * 0.6), key=lambda b: b[1])
        A, B = top[0::2], top[1::2]
        pick = {"corner": corner, "a": A[len(A) // 2], "b": B[len(B) // 2]}
        name = src.stem
        (OUT / name).mkdir(parents=True, exist_ok=True)
        info[name] = {}
        for part, box in pick.items():
            svg, w, h = to_svg(ink, box)
            (OUT / name / f"{part}.svg").write_text(svg)
            info[name][part] = [w, h]
        print(name, "edge motifs:", len(top), info[name])
    # アプリが file:// でも よめる ように JS で 書き出す
    (OUT / "sizes.js").write_text("// make_frames.py で 自動で 作った ファイル（手で 書きかえない）\n"
                                  "window.FRAME_SIZES = " + json.dumps(info, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main()
