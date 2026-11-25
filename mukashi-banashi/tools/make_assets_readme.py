# assets/README.txt を つくる（素材の 入手もと・ライセンスの 一覧）
import json, os, glob, sys, urllib.parse
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
sel = json.load(open(os.path.join(here, 'pd_list.json'), encoding='utf-8'))
emoji = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(root, 'assets/emoji/*.webp')))
SKIN = {"baby","boy","man","woman","old-man","old-woman","flexed-biceps","woman-mage"}
def furl(k):
    name = k.replace('-', ' ').capitalize(); fn = k.replace('-', '_')
    if k in SKIN: return f"https://github.com/microsoft/fluentui-emoji/blob/main/assets/{urllib.parse.quote(name)}/Default/3D/{fn}_3d_default.png", name + '（Default）'
    return f"https://github.com/microsoft/fluentui-emoji/blob/main/assets/{urllib.parse.quote(name)}/3D/{fn}_3d.png", name
L = []
L += ["むかしばなし文庫 ― つかって いる 素材（assets/）", "=" * 66, "",
 "この フォルダーの 素材は、すべて 下の ところから ダウンロードして 保存した ものです。",
 "画面には クレジットを 表示しません（CLAUDE.md の きまり）。MIT の ものの ライセンス全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります。",
 "2026-11-25 に 依頼者に 候補（絵・ライブラリ・ライセンス）を 一覧で 見せて きめました。",
 "依頼者の きぼうで、この アプリでは 画風が まざって よい（白黒の むかしの さし絵 と Fluent Emoji 3D）。", "",
 "1. e/*.jpg … むかしの 昔話の 本の 絵（Wikimedia Commons・パブリックドメイン または CC0）",
 "   ライセンス確認: Commons の API（prop=imageinfo の extmetadata）で 1まいずつ、",
 "     LicenseShortName が「Public domain」か「CC0」で、AttributionRequired が false（表記は いらない）で ある ことを たしかめました。",
 "   もとの 本:",
 "     ・Yei Theodora Ozaki『The Japanese Fairy Book』（1908年。絵は 藤山鶴城〔Fujiyama Kakuzō〕）",
 "     ・長谷川武次郎 発行の ちりめん本「Japanese Fairy Tale Series」（1885〜1892年）の ひょうし",
 "   加工: Commons の 960px の サムネイルを ダウンロードし、ひょうしは 英語の 題名や 美術館の シールが 入らないように 切りぬき、",
 "         よこ・たて 900px いないに 縮めて JPEG（品質 82）に しました。", ""]
for k, v in sel.items():
    L.append(f"  e/{k}.jpg（{v['alt']}）")
    L.append(f"    もとの ファイル: {v['title'][5:]}")
    L.append(f"    ページ: {v['page']}")
    L.append(f"    ライセンス: {v['lic']}（表記は いらない）")
    if v.get('crop'): L.append(f"    切りぬき: {v['crop']}")
    L.append("")
L += ["2. emoji/*.webp … Microsoft Fluent Emoji「3D」（MIT License）",
 "   入手もと: https://github.com/microsoft/fluentui-emoji （assets/<名前>/3D/*_3d.png）",
 "   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）",
 "   加工: 200×200 に 縮めて WebP（品質 88）に しました。ファイル名は Fluent Emoji の 名前を 小文字・ハイフンに したもの。",
 "   かえた もの: 小判は Coin が 銀行の しるしの 絵なので Gem stone に、やまんばは Woman mage（西洋の まじょ）では なく Troll に、",
 "               つるは Swan（白くて くびの 長い 鳥）に しました。", "",
 "3. app-icon.png（64×64）・app-icon-180.png（180×180・白い 地）… Fluent Emoji 3D の Scroll（MIT）を 縮めた もの", "",
 "4. icons.js … Phosphor Icons「duotone」（MIT License）",
 "   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json",
 "             （Iconify の コレクション情報 info.license が MIT で ある ことを 確認）",
 "   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）",
 "   つかって いる アイコン: caret-left / caret-right / books / book-open-text / minus-circle / plus-circle / x-circle（すべて -duotone）", "",
 "5. images.js … 上の 絵の 一覧（tools/make_images.py で つくる）", "",
 "-" * 64, "emoji/ の ファイル いちらん（ファイル・Fluent Emoji の 名前・入手もと）", "-" * 64]
for k in emoji:
    u, n = furl(k); L.append(f"{k}.webp\t{n}\t{u}")
open(os.path.join(root, 'assets/README.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('ok', len(sel), len(emoji))
