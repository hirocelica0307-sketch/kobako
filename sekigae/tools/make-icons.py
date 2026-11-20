#!/usr/bin/env python3
"""
assets/icons/*.svg から、GAS に貼り付ける icons.html を作る。

GAS（HtmlService）はフォルダの画像ファイルを直接読み込めないので、
assets/icons/ に保存した SVG の中身を、そのまま 1 つの HTML ファイルにまとめる。
アイコンを足したり変えたりしたら、sekigae/ で次を実行して icons.html を作り直す。

    python3 tools/make-icons.py
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent.parent
icons = {}
for path in sorted((HERE / 'assets' / 'icons').glob('*.svg')):
    icons[path.stem] = path.read_text(encoding='utf-8').strip()

body = json.dumps(icons, ensure_ascii=False, indent=2).replace('</', '<\\/')
out = (
    '<script>\n'
    '/**\n'
    ' * 席替えアプリ — ボタンのアイコン（Tabler Icons・MIT）\n'
    ' * assets/icons/*.svg から tools/make-icons.py で作ったファイルです。手で直さないでください。\n'
    ' * 出どころとライセンスは assets/README.txt と、リポジトリの THIRD_PARTY_LICENSES.txt にあります。\n'
    ' */\n'
    'var Icons = ' + body + ';\n'
    '</script>\n'
)
(HERE / 'icons.html').write_text(out, encoding='utf-8')
print('icons.html を作りました（%d 個）' % len(icons))
