フリーボード ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-11-18 に 依頼者に 候補（素材名・ライブラリ・ライセンス）を 見せて、
「アプリの アイコンは Crayon」「ボタンの アイコンは つかわない（文字だけ）」と きめました。

1. icon/*.png … Microsoft Fluent Emoji「3D」（MIT License）
   素材: Crayon（クレヨン）
   入手もと: https://github.com/microsoft/fluentui-emoji/blob/main/assets/Crayon/3D/crayon_3d.png
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   つかう ところ: ブラウザの タブ・ブックマーク・ホーム画面（Chromebook の シェルフ）の アイコン
   加工:
     app-icon-32.png / app-icon-192.png / app-icon-512.png … 大きさを かえただけ（すきとおった 背景）
     maskable-512.png … 白い 地の 上に 62% の 大きさで のせた（まるく 切りぬかれても はみ出さない ように）
     apple-touch-icon.png（180×180）… 白い 地の 上に 78% の 大きさで のせた

ボタンには アイコンを つかわず、文字だけに して います。
背景の マス目・罫線・点、先生が かく 線・図形 は、ボードの 機能 なので canvas で えがいて います（絵の 素材では ありません）。
文字の 書体「教科書体ふう（Klee One）」「丸ゴシック（Zen Maru Gothic）」は Google Fonts から よみこみます
（ほかの アプリ〔漢字プリ＆テスト など〕と おなじ。インターネットに つながって いない ときは ふつうの ゴシックに なります）。
