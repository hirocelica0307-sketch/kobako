速読ラボ ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-10-17 に 依頼者から「アイコンは おまかせ」と 言われて、下の 2つに きめました。

1. icon/*.png … Microsoft Fluent Emoji「3D」（MIT License）
   素材: Open book（ひらいた 本）
   入手もと: https://github.com/microsoft/fluentui-emoji/blob/main/assets/Open%20book/3D/open_book_3d.png
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   つかう ところ: ブラウザの タブ・ブックマーク・ホーム画面の アイコン
   加工:
     app-icon-32.png / app-icon-192.png / app-icon-512.png … 大きさを かえただけ（すきとおった 背景）
     maskable-512.png … 画面の 背景色（#f7f6f2）の 上に 62% の 大きさで のせた（まるく 切りぬかれても はみ出さない ように）
     apple-touch-icon.png（180×180）… 画面の 背景色の 上に 78% の 大きさで のせた

2. icons.js … Phosphor Icons「regular」（MIT License）
   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json
             （Iconify の コレクション情報 info.license が MIT で ある ことを 確認）
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）
   つかって いる アイコン: caret-left / caret-right / gear-six / x / gauge / highlighter / repeat /
     list-magnifying-glass / books / chart-line-up / lightbulb / pause / play
   つかう ところ: もどる・設定・やめる の ボタン、ホームの 練習（速さチェック＝gauge・ペース読み＝highlighter・
     くり返し読み＝repeat・要点読み＝list-magnifying-glass）と「そのほか」の ボタン（books・chart-line-up・lightbulb）

3. 自分で えがいて いる もの（素材では ありません）
   記録の グラフ・要点読みの のこり時間の バー・読む 場所の 色づけ は、数や 時間を しめす 表示 なので
   SVG／CSS で えがいて います（絵の 素材では ありません）。
