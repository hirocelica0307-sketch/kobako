# PDF → 1行ずつの JSON（ふりがな・ページ番号・つめ見出しを取りのぞく）
import sys, json, pymupdf
doc = pymupdf.open(sys.argv[1])
SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
out = []
for pn in range(30, 193):
    spans = []
    for b in doc[pn-1].get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"]
                if not t.strip(): continue
                sz = round(s["size"], 1); f = s["font"]
                if sz < 6: continue                      # ふりがな
                if 7 <= sz < 7.5 and t.strip().isdigit():  # cm² などの 右上の 小さい 数字
                    t = t.strip().translate(SUP)
                if f.startswith("HiraKakuPro-W3") and sz == 11.0: continue   # ページ番号
                if f.startswith("HiraKakuPro-W6") and sz in (9.6, 9.8, 11.2): continue  # つめ
                spans.append((s["bbox"][1], s["bbox"][3], s["bbox"][0], sz, f, t))
    spans.sort(key=lambda s: (s[0], s[2]))
    lines = []
    for s in spans:
        if lines and abs(lines[-1]["yt"] - s[0]) < 5:
            lines[-1]["sp"].append(s)
        else:
            lines.append({"yt": s[0], "sp": [s]})
    for ln in lines:
        sp = sorted(ln["sp"], key=lambda s: s[2])
        main = max(sp, key=lambda s: (s[3], len(s[5])))
        kind = "body"
        if main[3] >= 19.5: kind = "chapter"
        elif main[3] >= 18.5: kind = "section"
        elif main[3] == 14.0: kind = "part"
        elif main[3] == 12.0 and main[4].startswith("HiraKakuPro-W6"): kind = "block"
        elif main[4].startswith("HiraKakuStd-W5"): kind = "head"
        txt = "".join(s[5] for s in sp)
        out.append({"p": pn - 2, "x": round(sp[0][2]), "k": kind, "t": txt})
# 分数は 文字ではなく 図で 入っているので、原文の 画像を 見て 書きおこした ものを うめる
FRAC = [
    (68, r"（カ），など簡単な分数", "（カ）　1/2，1/3など簡単な分数"),
    (71, r"1000 ?倍，の大きさ", "1000倍，1/10の大きさ"),
    (73, r"小数の表し方及び\u3000の位", "小数の表し方及び1/10の位"),
    (73, r"（イ）\u3000\u3000の位まで", "（イ）　1/10の位まで"),
    (75, r"小数点\u3000の位", "小数点　1/10の位"),
    (75, r"分数のな$", "分数の1/10な"),
    (83, r"1000 ?倍，，など", "1000倍，1/10，1/100など"),
]
import re
for pg, pat, rep in FRAC:
    hit = [o for o in out if o["p"] == pg and re.search(pat, o["t"])]
    assert len(hit) == 1, (pg, pat, len(hit))
    hit[0]["t"] = re.sub(pat, rep, hit[0]["t"])
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
