# data.js → midashi-ichiran.md（Claude が まとめた 見出しと、もとの 本文の 書き出しを ならべた 確認用の 一覧）
import json, sys
s = open(sys.argv[1]).read()
d = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
nodes = {}
def walk(n):
    if n.get("id"): nodes[n["id"]] = n
    for c in n.get("c", []): walk(c)
for x in d["subjects"]:
    for k in ("goal", "plan", "part2Lead"):
        if x.get(k): walk(x[k])
    for b in x["blocks"]:
        for sec in b["secs"]: walk(sec["tree"])
G = lambda g: "全学年" if len(g) == 6 else (f"{g[0]}年" if len(g) == 1 else f"{g[0]}〜{g[-1]}年")
def head(n):
    t = (n.get("m", "") + " " + n.get("t", "")).strip() or "　".join(n.get("lead", []))
    return t[:60] + ("…" if len(t) > 60 else "")
out = ["# 系統表の見出し 一覧（確認用）", "",
       "Claude が告示の本文をもとにまとめた見出しと、つながっている本文の書き出しです。",
       "「告示の見出し」とあるものは、告示に書かれている見出しをそのまま使っています。",
       "なおしたいときは `tools/labels.py` を書きかえて `tools/build.py` をもう一度動かします。", ""]
S = {x["id"]: x for x in d["subjects"]}
out += ["## 全体の系統表（教科 × 学年）のまとめ", ""]
for x in d["subjects"]:
    for o in d["overview"][x["id"]]:
        out.append(f"- {x['short']}・{G(o['grades'])}：{o['text']}")
out.append("")
for x in d["subjects"]:
    out += [f"## {x['name']}", ""]
    for r in d["tables"][x["id"]]:
        out.append(f"### {(r['group'] + ' › ') if r.get('group') else ''}{r['label']}")
        for c in r["cells"]:
            other = "" if c["subject"] == x["id"] else f"（{S[c['subject']]['short']}）"
            for it in c["items"]:
                kind = "告示の見出し" if it["auto"] else "まとめ"
                out.append(f"- {G(c['grades'])}{other}｜**{it['label']}**（{kind}）← {head(nodes[it['ref']])}")
        out.append("")
open(sys.argv[2], "w").write("\n".join(out) + "\n")
print("ok")
