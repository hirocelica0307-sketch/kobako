おまつり リズム ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-11-18 に 依頼者に 候補（素材名・ライブラリ・ライセンス）を 見せて、OK を もらいました。

1. emoji/*.webp・app-icon*.png … Microsoft Fluent Emoji「3D」（MIT License）
   入手もと: https://github.com/microsoft/fluentui-emoji
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）

   emoji/drum.webp       … Drum（たいこ）
                           https://github.com/microsoft/fluentui-emoji/blob/main/assets/Drum/3D/drum_3d.png
                           つかう ところ: した の バーの たいこ（たたくと はねる）
   emoji/lantern.webp    … Red paper lantern（赤ちょうちん）
                           https://github.com/microsoft/fluentui-emoji/blob/main/assets/Red%20paper%20lantern/3D/red_paper_lantern_3d.png
                           つかう ところ: うえの だいめいの りょうがわ
   app-icon.png（64×64・すきとおし）・app-icon-180.png（180×180・白い 地）
                         … Drum から つくった ブラウザの タブ・ホーム画面の アイコン
   加工: 256×256 の PNG を WebP に した／縮めた（180 は 白い 地に のせた）だけ。形・いろは かえていない。

2. icons.js … Material Design Icons（Pictogrammers）（Apache License 2.0）
   入手もと: Iconify の mdi データ（npm パッケージ @iconify-json/mdi 1.2.3 の icons.json）
             https://github.com/Templarian/MaterialDesign
   ライセンス確認: @iconify-json/mdi の info.json（license: Apache 2.0 / spdx: Apache-2.0）と
                   https://github.com/Templarian/MaterialDesign/blob/master/LICENSE（Icons: Apache 2.0）
   つかう もの:
     音符・休符 … music-note-quarter（4分音符）・music（8分音符 2つ）・music-note-eighth（8分音符）・
                  music-rest-quarter（4分休符）・music-rest-eighth（8分休符）
     ボタン     … play・stop・repeat・close・delete-outline・volume-high・metronome
   加工: icons.json から つかう ものだけ ぬきだした（形は かえていない）。

自分で えがいた 絵・アイコンは ありません。
たいこ・ふち（カッ）の 音は 音の ファイルを つかわず、Web Audio で その場で つくって います。
文字の 書体（Mochiy Pop One・M PLUS Rounded 1c）は Google Fonts から よみこみます
（ほかの アプリ〔ドレミ がっき など〕と おなじ）。
