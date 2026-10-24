# lines.json → 教科ごとの構造データ
import json, re, sys
L = json.load(open(sys.argv[1]))

SUBJ = [  # (見出しにふくまれる語, id, 名前)
    ("国語", "kokugo", "国語"), ("社会", "shakai", "社会"), ("算数", "sansu", "算数"),
    ("理科", "rika", "理科"), ("生活", "seikatsu", "生活"), ("音楽", "ongaku", "音楽"),
    ("図画工作", "zuko", "図画工作"), ("家庭", "katei", "家庭"), ("体育", "taiiku", "体育"),
    ("外国語活動", "gaikokugokatsudo", "外国語活動"), ("外国語", "gaikokugo", "外国語"),
    ("道徳", "dotoku", "特別の教科 道徳"), ("総合的な学習の時間", "sogo", "総合的な学習の時間"),
    ("特別活動", "tokkatsu", "特別活動"),
]
KANJI = {"１": 1, "２": 2, "３": 3, "４": 4, "５": 5, "６": 6}
MARK = [
    ("group", re.compile(r"^(〔[^〕]*〕)[\u3000 ]*$")),
    ("kakko", re.compile(r"^(［[^］]*］)[\u3000 ]*$")),
    ("domain", re.compile(r"^([Ａ-Ｚ])[\u3000 ]+")),
    ("num", re.compile(r"^([⑴-⒇])[\u3000 ]+")),
    ("kata", re.compile(r"^([ア-ン])[\u3000 ]+")),
    ("pkata", re.compile(r"^(（[ア-ン]）)[\u3000 ]+")),
    ("circ", re.compile(r"^([①-⑳])[\u3000 ]+")),
    ("arabic", re.compile(r"^([１-９][０-９]?)[\u3000 ]+")),
]

RANK = {"arabic": 0, "group": 1, "domain": 2, "kakko": 2.5, "band": 2.7, "num": 3, "circ": 3.5, "kata": 4, "pkata": 5}

def mark_of(s):
    for k, r in MARK:
        m = r.match(s)
        if m:
            return k, m.group(1), s[m.end():]
    return None, None, s

def grades_of(label):
    m = re.findall(r"第([１-６])学年", label)
    return [KANJI[g] for g in m]

def clean(t):
    t = t.replace("　", "　").rstrip()
    return t

# 1. 教科ごと・見出しごとに行を分ける
subjects = []; cur = None; part = None; block = None; head = None
def newpara_sink():
    if block is not None:
        return block.setdefault(head or "_", [])
    return part.setdefault("_lines", [])

for l in L:
    t = clean(l["t"]); k = l["k"]
    if k in ("chapter", "section"):
        name = re.sub(r"^第\s*\d+\s*[章節]\s*", "", t).replace("　", "").replace(" ", "")
        hit = next((s for s in sorted(SUBJ, key=lambda x: -len(x[0])) if s[0] in name), None)
        if hit:
            cur = {"id": hit[1], "name": hit[2], "page": l["p"], "parts": []}
            subjects.append(cur); part = None; block = None; head = None
        continue
    if cur is None:
        continue
    if k == "part":
        part = {"title": t.replace("　", " ").strip(), "blocks": [], "page": l["p"]}
        cur["parts"].append(part); block = None; head = None; continue
    if k == "block" or (k == "head" and t.strip().startswith("〔")):
        lab = t.strip().strip("〔〕").replace("　", "")
        if cur["id"] in ("gaikokugo", "gaikokugokatsudo") and t.strip().startswith("〔"):
            # 〔第５学年及び第６学年〕は 英語の 内容の 中の 見出し → 学年を つけるだけ
            block["grades"] = grades_of(lab); continue
        block = {"label": lab, "grades": grades_of(lab), "page": l["p"]}
        part["blocks"].append(block); head = None; continue
    if k == "head":
        h = re.sub(r"^[１-９]　", "", t.strip()).replace("　", "")
        head = h
        if block is None:  # 総合：見出しが ブロックの かわり
            block = {"label": "", "grades": [], "page": l["p"]}; part["blocks"].append(block)
        continue
    sink = block.setdefault(head or "_lead", []) if block is not None else part.setdefault("_lead", [])
    sink.append({"p": l["p"], "x": l["x"] - (39 if l["p"] % 2 == 0 else 0), "t": t})

# 2. 行 → 段落
def to_paras(lines):
    paras = []
    for ln in lines:
        t = ln["t"]; s = t.lstrip("　 ")
        mk, mtxt, rest = mark_of(s)
        if mk:
            if mk in ("domain", "group") and len(rest) <= 6: rest = rest.replace("\u3000", "")
            if mk == "group": mtxt, rest = mtxt.strip("〔〕"), ""
            paras.append({"m": mk, "mk": mtxt, "t": rest, "p": ln["p"]})
        elif t.startswith("　") and s is not None:
            paras.append({"m": None, "t": s, "p": ln["p"]})
        elif paras:
            nxt = t.strip("　 "); prev = paras[-1]["t"]
            if re.match(r"^(・|[a-e]　|「)", nxt) and not re.search(r"[，、（「]$", prev):
                prev += "　"
            elif re.search(r"[A-Za-z,]$", prev) and re.match(r"^[A-Za-z]", nxt):
                prev += " "
            paras[-1]["t"] = prev + nxt
        else:
            paras.append({"m": None, "t": t.strip(), "p": ln["p"]})
    for p in paras:
        t = re.sub(r"[ \t]+", " ", p["t"])
        t = re.sub(r"(?<=[^\x00-\x7f]) | (?=[^\x00-\x7f])", "", t)
        p["t"] = t.strip("\u3000 ")
    return paras

# 3. 段落 → 木（しるしの 種類で 入れ子に する）
def to_tree(paras):
    root = {"c": []}; stack = [(None, root)]
    for p in paras:
        if p["m"] is None:
            node = stack[-1][1]
            node.setdefault("lead", []).append(p["t"]); continue
        r = RANK[p["m"]]
        while len(stack) > 1 and RANK[stack[-1][0]] >= r:
            stack.pop()
        node = {"m": p["mk"], "t": p["t"], "p": p["p"], "c": []}
        stack[-1][1]["c"].append(node); stack.append((p["m"], node))
    def strip(n):
        if not n["c"]: n.pop("c")
        else:
            for c in n["c"]: strip(c)
        return n
    return strip(root)

def dotoku_blocks(lines):
    paras = to_paras(lines)
    lead = []; bands = {}; dom = None; item = None; band = None
    order = []
    for p in paras:
        if p["m"] == "domain":
            dom = p["mk"] + "　" + p["t"]; item = None; band = None
        elif p["m"] == "kakko":
            item = p["mk"].strip("［］"); band = None
        elif p["m"] == "group":
            band = p["mk"]
            if band not in bands: bands[band] = []; order.append(band)
        elif p["m"] is None:
            if band is None:
                lead.append(p["t"])
            else:
                bands[band].append((dom, item, p["t"], p["p"]))
    blocks = []
    for b in order:
        root = {"lead": lead, "c": []}
        for dom, item, t, pg in bands[b]:
            dn = next((c for c in root["c"] if c["t0"] == dom), None)
            if dn is None:
                dn = {"t0": dom, "m": dom[0], "t": dom[2:], "p": pg, "c": []}; root["c"].append(dn)
            dn["c"].append({"m": "", "t": item, "p": pg, "lead": [t]})
        for dn in root["c"]: dn.pop("t0")
        blocks.append({"label": b, "grades": grades_of(b), "page": bands[b][0][3],
                       "secs": [{"h": "内容", "tree": root}]})
    return blocks

out = []
for s in subjects:
    o = {"id": s["id"], "name": s["name"], "page": s["page"]}
    for part in s["parts"]:
        title = part["title"]
        if title.startswith("第１"):
            o["goal"] = to_tree(to_paras(part.get("_lead", [])))
        elif title.startswith("第３"):
            o["plan"] = to_tree(to_paras(part.get("_lead", [])))
            o["planPage"] = part["page"]
        else:
            o["part2Title"] = re.sub(r"^第２\s*", "", title).replace("　", "")
            if s["id"] == "dotoku":
                o["blocks"] = dotoku_blocks(part.get("_lead", [])); continue
            if part.get("_lead"):
                o["part2Lead"] = to_tree(to_paras(part["_lead"]))
            bl = []
            for b in part["blocks"]:
                nb = {"label": b["label"], "grades": b["grades"], "page": b["page"]}
                for key, val in b.items():
                    if isinstance(val, list) and val and isinstance(val[0], dict):
                        nb.setdefault("secs", []).append({"h": key, "tree": to_tree(to_paras(val))})
                bl.append(nb)
            o["blocks"] = bl
    if s["id"] == "sogo":
        for b in o["blocks"]: b["grades"] = [3, 4, 5, 6]; b["label"] = "第３学年〜第６学年"
    if s["id"] == "tokkatsu":
        for b in o["blocks"]: b["grades"] = [4, 5, 6] if b["label"] == "クラブ活動" else [1, 2, 3, 4, 5, 6]
    if s["id"] == "gaikokugo":
        o["blocks"] = [b for b in o["blocks"] if b["label"] != "その他の外国語"] + [b for b in o["blocks"] if b["label"] == "その他の外国語"]
    out.append(o)
# 4. 図や 表の 部分を 読みやすく なおす
MUSIC_FIG = ("（ここは原文では記号の図です。図にある記号を文字で並べました）"
    "全音符，付点２分音符，２分音符，付点４分音符，４分音符，付点８分音符，８分音符，16分音符，"
    "付点８分音符と16分音符，４分休符，８分休符，ト音記号，ヘ音記号，五線と加線，縦線，終止線，"
    "シャープ，フラット，ナチュラル，フォルテ（f），メゾフォルテ（mf），ピアノ（p），メゾピアノ（mp），ブレス，"
    "４分の２拍子，４分の３拍子，４分の４拍子，８分の６拍子，クレシェンド，デクレシェンド，"
    "反復記号，タイ，スラー，アクセント，スタッカート，速度記号（例：♩＝96）")
def fix(sid, n):
    for c in n.get("c", []):
        t = re.sub("　{2,}", "　", c["t"])
        if sid == "ongaku" and "五線と加線" in t:
            t = t[:t.index("取り扱うこと。") + 7]; c["lead"] = [MUSIC_FIG]
        if sid == "gaikokugo" and t.startswith("文構造a"):
            t = "文構造"; c["lead"] = ["a　［主語＋動詞］",
                "b　［主語＋動詞＋補語］のうち，主語＋be動詞＋｛名詞／代名詞／形容詞｝",
                "c　［主語＋動詞＋目的語］のうち，主語＋動詞＋｛名詞／代名詞｝"]
        elif sid == "gaikokugo" and t.startswith("文a　"):
            c["lead"] = [x.strip("　") for x in re.split(r"(?=[a-f]　)", t[1:])]; t = "文"
        if c.get("m") == "用語・記号":
            t = t.replace("平行垂直", "平行　垂直").replace("ドットプロット平均値", "ドットプロット　平均値")
        c["t"] = t
        if "lead" in c: c["lead"] = [re.sub("　{2,}", "　", x) for x in c["lead"]]
        fix(sid, c)
    if "lead" in n: n["lead"] = [re.sub("　{2,}", "　", x) for x in n["lead"]]
for o in out:
    for k in ("goal", "plan", "part2Lead"):
        if k in o: fix(o["id"], o[k])
    for b in o.get("blocks", []):
        for sec in b.get("secs", []): fix(o["id"], sec["tree"])

json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
