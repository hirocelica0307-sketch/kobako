席替えアプリ ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ところから ダウンロードして 保存した ものです。
画面には クレジットを 表示しません（CLAUDE.md の きまり）。
2026-11-11 に 依頼者に 候補（System UIcons と Tabler Icons の 見本・ライブラリ・ライセンス）を
見せて、Tabler Icons に きめました。

1. icons/*.svg … Tabler Icons（ボタンの アイコン）
   ライブラリ: Tabler Icons（作者 Paweł Kuna） https://tabler.io/icons
   入手もと: Iconify の Tabler（tabler）データ
     npm パッケージ @iconify-json/tabler 1.2.44 の icons.json から、下の 10 個の body を
     そのまま <svg width="24" height="24" viewBox="0 0 24 24"> で つつんで 保存しました。
     （Iconify の 検索 API api.iconify.design は この 作業 環境の ネットワーク 設定で 使えなかったので、
       Iconify が npm で くばって いる 公式の データを つかいました。中身の コレクション情報は 同じ です。）
   ライセンス: MIT License
     たしかめた ところ: @iconify-json/tabler の info.json（license: MIT、
       https://github.com/tabler/tabler-icons/blob/master/LICENSE）と、
       公式 パッケージ @tabler/icons 3.51.0 の LICENSE ファイル。
     画面には 何も 出さず、ライセンス文は リポジトリの THIRD_PARTY_LICENSES.txt に のせました。
   加工: なし（色は 文字と おなじ 色に なるよう、もとから stroke="currentColor"）

     ファイル                アイコン名        つかう ところ
     users.svg              users            「名簿を ひらく」
     heart-handshake.svg    heart-handshake  「配慮事項を ひらく」
     arrows-shuffle.svg     arrows-shuffle   「席替えする」
     arrow-back-up.svg      arrow-back-up    「元に 戻す」
     device-floppy.svg      device-floppy    「記録する」
     printer.svg            printer          「印刷する」
     presentation.svg       presentation     「子どもに 見せる」
     help-circle.svg        help-circle      「使い方」
     settings.svg           settings         「設定」
     history.svg            history          「記録の 一覧」

GAS への 組みこみかた
  GAS は フォルダーの 画像ファイルを 直接 読みこめないので、tools/make-icons.py で
  icons/*.svg の 中身を icons.html に まとめ、それを Apps Script に 貼りつけて つかいます。
  アイコンを 足したり 変えたり したら、sekigae/ で python3 tools/make-icons.py を 実行して
  icons.html を 作りなおして ください。
