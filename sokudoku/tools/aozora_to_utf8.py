# 速読ラボ ── 青空文庫の Shift_JIS テキストを UTF-8 にし、外字の注記を本当の字に置きかえる
# 使いかた：python3 tools/aozora_to_utf8.py <作品.txt（Shift_JIS）> <出力.txt（UTF-8）>
# 「※［＃「…」、第3水準1-85-25］」のような注記は、JIS X 0213 の面区点から字を出す（Python の euc_jis_2004 を使う）。
# 「U+xxxx」があればその字にする。「小書き平仮名ん」のような注記は、ふつうの大きさの字にする。
# どれにも当たらない注記はそのまま残し、import-aozora.js が〓にする。
import re, sys, json
def jis(m):
    plane, row, cell = int(m.group(1)), int(m.group(2)), int(m.group(3))
    b = (bytes([0xA0 + row, 0xA0 + cell]) if plane == 1 else bytes([0x8F, 0xA0 + row, 0xA0 + cell]))
    try:
        ch = b.decode('euc_jis_2004')
        return ch if len(ch) >= 1 else None
    except Exception:
        return None
def rep(m):
    s = m.group(0)
    k = re.search(r'小書き[平片]仮名(.)', s)  # 小書きの「ん」など：Unicode に無いものは、ふつうの大きさの字にする
    if k: return k.group(1)
    u = re.search(r'U\+([0-9A-Fa-f]{4,6})', s)
    if u: return chr(int(u.group(1), 16))
    k = re.search(r'第[34]水準(\d)-(\d+)-(\d+)', s)
    if k:
        c = jis(k)
        if c: return c
    return s
src, dst = sys.argv[1], sys.argv[2]
t = open(src, 'rb').read().decode('cp932', errors='replace')
t = re.sub(r'※［＃[^］]*］', rep, t)
open(dst, 'w', encoding='utf-8').write(t)
