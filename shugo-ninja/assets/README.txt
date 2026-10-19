ことばにんじゃ道場 ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-10-19 に 依頼者に 候補（素材名・ライブラリ・ライセンス）を 見せて きめました。

1. emoji/*.webp … Microsoft Fluent Emoji「3D」（MIT License）
   入手もと: https://github.com/microsoft/fluentui-emoji （assets/<名前>/3D/*_3d.png）
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   加工: 160×160 に 縮めて WebP（品質 90）に しました。ファイル名は Fluent Emoji の 名前を 小文字・ハイフンに したもの。

2. app-icon.png（64×64・すきとおし）・app-icon-180.png（180×180・白い 地）
   もと: Microsoft Fluent Emoji「3D」の Ninja（Default）
   入手もと: https://github.com/microsoft/fluentui-emoji/blob/main/assets/Ninja/Default/3D/ninja_3d_default.png
   ライセンス: MIT License
   加工: 縮めた（180 は 白い 地に のせた）。

3. icons.js … Phosphor Icons「duotone」（MIT License）
   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json
             （Iconify の コレクション情報 info.license が MIT で ある ことを 確認）
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）
   つかって いる アイコン: speaker-high / speaker-slash / lightbulb / x-circle / arrow-right / house /
     sign-out / lock / copy / arrow-counter-clockwise / star-four / check-circle / trash / backspace /
     map-trifold（すべて -duotone）

4. 自分で かいて いる もの（素材では ありません）
   主語の 赤い 1本線・じゅつ語の 青い 2本線、キャラクターの まわりの 赤・青の まるい わく は、
   国語の 記号・色わけ として CSS で つけて います。キャラクター・物の 絵は 1. だけです。

----------------------------------------------------------------
emoji/ の ファイル いちらん（ファイル・Fluent Emoji の 名前・つかう ところ・入手もと）
----------------------------------------------------------------
ninja.webp	Ninja（Default）	しゅごまる（赤い わく）・じゅつまる（青い わく）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Ninja/Default/3D/ninja_3d_default.png
cat-face.webp	Cat face	にゃんじゃ先生（ヒント・せつめい）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Cat%20face/3D/cat_face_3d.png
star.webp	Star	ほし（しゅぎょうの ひょうか）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Star/3D/star_3d.png
scroll.webp	Scroll	ごほうびの まきもの（クリアした しゅぎょう）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Scroll/3D/scroll_3d.png
party-popper.webp	Party popper	けっかの 画面	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Party%20popper/3D/party_popper_3d.png
cherry-blossom.webp	Cherry blossom	けっかの 画面で ふる さくら	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Cherry%20blossom/3D/cherry_blossom_3d.png
