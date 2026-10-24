# raw.json（parse.py の 出力）＋ labels.py → ../data.js
# つかいかた: python3 -I build.py raw.json ../data.js
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from labels import OVERVIEW, TABLES

RAW = json.load(open(sys.argv[1]))
SRC = "https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf"
KAISETSU_PAGE = "https://www.mext.go.jp/a_menu/shotou/new-cs/1387014.htm"
M = "https://www.mext.go.jp"
META = {  # 短い名前・色・アイコン・解説PDF
    "kokugo": ("国語", "#d9534f", "open_book", "/content/20220606-mxt_kyoiku02-100002607_002.pdf"),
    "shakai": ("社会", "#c77c1e", "globe", "/content/20230308-mxt_kyoiku02-100002607_003.pdf"),
    "sansu": ("算数", "#2f6fd6", "triangular_ruler", "/content/20211102-mxt_kyoiku02-100002607_04.pdf"),
    "rika": ("理科", "#2e9e5b", "test_tube", "/content/20211020-mxt_kyoiku02-100002607_05.pdf"),
    "seikatsu": ("生活", "#d63c8f", "seedling", "/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387017_006.pdf"),
    "ongaku": ("音楽", "#8a4fd6", "musical_notes", "/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387017_007.pdf"),
    "zuko": ("図画工作", "#e0702a", "artist_palette", "/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387017_008.pdf"),
    "katei": ("家庭", "#c2416b", "cooking", "/content/20240918-mxt_kyoiku01-100002607_02.pdf"),
    "taiiku": ("体育", "#1b8fb3", "soccer_ball", "/content/20240918-mxt_kyoiku01-100002607.pdf"),
    "gaikokugo": ("外国語", "#3d59c2", "input_latin_letters", "/content/20220614-mxt_kyoiku02-100002607_11.pdf"),
    "dotoku": ("道徳", "#d6455d", "red_heart", "/content/20260318-mxt_kyoiku01-100002607_12.pdf"),
    "gaikokugokatsudo": ("外国語活動", "#4a7fd0", "speech_balloon", "/content/20220614-mxt_kyoiku02-100002607_11.pdf"),
    "sogo": ("総合", "#7a8a16", "compass", "/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387017_013_1.pdf"),
    "tokkatsu": ("特別活動", "#b5651d", "handshake", "/content/20221213-mxt_kyoiku02-100002607_014.pdf"),
}
# 一覧に ならべる 順（告示の 順）
ORDER = ["kokugo", "shakai", "sansu", "rika", "seikatsu", "ongaku", "zuko", "katei", "taiiku",
         "gaikokugo", "dotoku", "gaikokugokatsudo", "sogo", "tokkatsu"]
SECKEY = {"目標": "mokuhyo", "内容": "naiyo", "内容の取扱い": "toriatsukai",
          "指導計画の作成と内容の取扱い": "keikaku", "_lead": "lead",
          "各学校において定める目標及び内容の取扱い": "toriatsukai"}

def assign(node, prefix):
    for i, c in enumerate(node.get("c", [])):
        c["id"] = f"{prefix}-{i}"
        assign(c, c["id"])

subj = {s["id"]: s for s in RAW}
for b in subj["gaikokugo"]["blocks"]:
    if b["label"] == "その他の外国語": b["grades"] = [5, 6]
for sid, s in subj.items():
    if "goal" in s: assign(s["goal"], f"{sid}-g")
    if "plan" in s: assign(s["plan"], f"{sid}-p")
    if "part2Lead" in s: assign(s["part2Lead"], f"{sid}-l")
    for bi, b in enumerate(s.get("blocks", [])):
        b["id"] = f"{sid}-b{bi}"
        for sec in b.get("secs", []):
            sec["key"] = SECKEY[sec["h"]]
            sec["tree"]["id"] = f"{sid}-b{bi}-{sec['key']}"
            assign(sec["tree"], sec["tree"]["id"])

def resolve(sid, ref):
    if ":" in ref.split("|")[0]:
        sid, ref = ref.split(":", 1)
    bi, h, path = ref.split("|")
    b = subj[sid]["blocks"][int(bi)]
    sec = next(x for x in b["secs"] if x["h"] == h)
    node = sec["tree"]
    for seg in [p for p in path.split("/") if p]:
        nxt = [c for c in node.get("c", []) if c.get("m") == seg or c.get("t") == seg]
        assert len(nxt) >= 1, (sid, ref, seg)
        node = nxt[0]
    return node["id"]

def grades_of(sid, key):
    if isinstance(key, str) and ":" in key:
        o, bi = key.split(":"); return subj[o]["blocks"][int(bi)]["grades"], o
    return subj[sid]["blocks"][int(key)]["grades"], sid

def strip_title(t):  # 理科・家庭・特活の ⑴ は 見出しだけの 行
    return t if len(t) <= 30 and "。" not in t else None

def auto_table(sid, kind):
    s = subj[sid]; rows = {}
    order = []
    def row(key, label):
        if key not in rows:
            rows[key] = {"label": label, "cells": {}}; order.append(key)
        return rows[key]
    for bi, b in enumerate(s["blocks"]):
        sec = next((x for x in b["secs"] if x["h"] == "内容"), None)
        if not sec: continue
        if kind == "domain-num":
            for d in sec["tree"]["c"]:
                r = row(d["m"], d["m"] + " " + d["t"])
                for u in d.get("c", []):
                    r["cells"].setdefault(bi, []).append((strip_title(u["t"]) or u["t"][:20], f"{bi}|内容|{d['m']}/{u['m']}", True))
        elif kind == "taiiku":
            for d in sec["tree"]["c"]:
                r = row(d["m"], d["m"])
                if d["m"] == "Ｇ":
                    for u in d["c"]:
                        lab = re.sub(r"について.*$", "", u["t"])
                        r["cells"].setdefault(bi, []).append((lab, f"{bi}|内容|Ｇ/{u['m']}", True))
                else:
                    r["cells"].setdefault(bi, []).append((d["t"], f"{bi}|内容|{d['m']}", True))
        elif kind == "dotoku":
            for d in sec["tree"]["c"]:
                r = row(d["m"], d["m"] + " " + d["t"])
                for u in d["c"]:
                    r["cells"].setdefault(bi, []).append((u["t"], f"{bi}|内容|{d['m']}/{u['t']}", True))
        elif kind == "tokkatsu":
            r = row(b["label"], b["label"])
            for u in sec["tree"].get("c", []):
                r["cells"].setdefault(bi, []).append((u["t"], f"{bi}|内容|{u['m']}", True))
    # 体育の 行の 名前は 学年で かわるので まとめる
    if kind == "taiiku":
        names = {}
        for bi, b in enumerate(s["blocks"]):
            sec = next(x for x in b["secs"] if x["h"] == "内容")
            for d in sec["tree"]["c"]:
                names.setdefault(d["m"], [])
                if d["t"] not in names[d["m"]]: names[d["m"]].append(d["t"])
        for k in rows: rows[k]["label"] = k + " " + "／".join(names[k])
    return [rows[k] for k in order]

tables = {}
for sid in ORDER:
    spec = TABLES[sid]
    if "auto" in spec:
        rows = auto_table(sid, spec["auto"])
    else:
        rows = spec["rows"]
        if isinstance(rows, str):  # 外国語活動は 外国語の 表を つかう
            rows = [{**r, "cells": {(f"{rows}:{k}" if not (isinstance(k, str) and ":" in k) else k): v
                                    for k, v in r["cells"].items()}} for r in TABLES[rows]["rows"]]
            # 外国語活動 から 見ると、自分の ブロックは "gaikokugokatsudo:0" → 0 に もどす
            for r in rows:
                r["cells"] = {(k.split(":")[1] if k.startswith(sid + ":") else k): v for k, v in r["cells"].items()}
                r["cells"] = {(int(k) if isinstance(k, str) and k.isdigit() else k): v for k, v in r["cells"].items()}
        rows = [{**r, "cells": {k: [(lab, ref, False) for lab, ref in v] for k, v in r["cells"].items()}} for r in rows]
    out_rows = []
    for r in rows:
        cells = []
        for key, items in r["cells"].items():
            g, owner = grades_of(sid, key)
            pre = "" if owner == sid else owner + ":"
            cells.append({"grades": g, "subject": owner,
                          "items": [{"label": lab, "ref": resolve(sid, ref if ":" in ref.split("|")[0] else pre + ref),
                                     "auto": auto} for lab, ref, auto in items]})
        cells.sort(key=lambda c: c["grades"][0])
        out_rows.append({"label": r["label"], "group": r.get("group"), "cells": cells})
    tables[sid] = out_rows

overview = {}
for sid in ORDER:
    overview[sid] = [{"grades": subj[sid]["blocks"][bi]["grades"], "text": t, "ref": subj[sid]["blocks"][bi]["id"]}
                     for bi, t in OVERVIEW[sid].items()]

def slim(n):
    o = {}
    for k in ("id", "m", "t", "p", "lead"):
        if k in n and n[k] not in (None, "", []): o[k] = n[k]
    if n.get("c"): o["c"] = [slim(c) for c in n["c"]]
    return o

subjects = []
for sid in ORDER:
    s = subj[sid]; short, color, icon, kai = META[sid]
    subjects.append({
        "id": sid, "name": s["name"], "short": short, "color": color, "icon": icon,
        "kaisetsu": M + kai, "page": s["page"], "planPage": s.get("planPage"),
        "part2Title": s.get("part2Title"),
        "goal": slim(s["goal"]) if "goal" in s else None,
        "part2Lead": slim(s["part2Lead"]) if "part2Lead" in s else None,
        "plan": slim(s["plan"]) if "plan" in s else None,
        "blocks": [{"id": b["id"], "label": b["label"], "grades": b["grades"], "page": b["page"],
                    "secs": [{"h": sec["h"], "key": sec["key"], "tree": slim(sec["tree"])} for sec in b.get("secs", [])]}
                   for b in s.get("blocks", [])],
    })

data = {"source": {"title": "小学校学習指導要領（平成29年告示）", "publisher": "文部科学省", "url": SRC,
                   "kaisetsuPage": KAISETSU_PAGE},
        "subjects": subjects, "tables": tables, "overview": overview}
js = "// 自動で つくった ファイル（tools/build.py）。手で なおさない こと。\n"
js += "window.YN_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(sys.argv[2], "w").write(js)
n = sum(len(c["items"]) for t in tables.values() for r in t for c in r["cells"])
print("ok", len(subjects), "教科", n, "見出し", len(js) // 1024, "KB")
