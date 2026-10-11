雷鳴麻雀 ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
画面には クレジットを 表示しません（CC0 は 表記 不要、MIT は THIRD_PARTY_LICENSES.txt に 記載）。

1. tiles/*.svg … 麻雀牌の 絵（FluffyStuff「riichi-mahjong-tiles」Regular）
   入手もと: https://github.com/FluffyStuff/riichi-mahjong-tiles （Regular/*.svg）
   ライセンス: CC0 1.0（パブリックドメイン）
   ライセンス確認: https://github.com/FluffyStuff/riichi-mahjong-tiles/blob/master/LICENSE.md
     「This work is in the public domain. ... creativecommons.org/publicdomain/zero/1.0/」
   加工: 牌の 面の 絵だけ（Front.svg・Back.svg・Blank.svg は つかわない）を svgo で 小さく し、viewBox を つけました。
         牌の 白い 地と キャラメル色の 背は style.css の 色で つけて います。
   ファイル: Man1〜9（萬子）・Pin1〜9（筒子）・Sou1〜9（索子）・Man5-Dora / Pin5-Dora / Sou5-Dora（赤5）・
             Ton 東・Nan 南・Shaa 西・Pei 北・Haku 白・Hatsu 發・Chun 中

2. chars/*.webp … キャラクター（Microsoft Fluent Emoji「3D」の 動物）
   入手もと: https://github.com/microsoft/fluentui-emoji （assets/<名前>/3D/*_3d.png）
   ライセンス: MIT License（全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt）
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   加工: 256×256 の PNG を 160×160 に 縮めて WebP（品質 90）に しました。
   2026-10-11 に 依頼者に 候補の 一覧を 見せて「ぜんぶ 3D の 動物に そろえる」「柴犬は Dog（全身）」と きめました。
   （柴犬 そのものの 素材は 表記不要の ライブラリに なかったので、茶色で しっぽが まいた Dog を 柴犬と して つかう）
   ファイル・Fluent Emoji の 名前・画面の 名まえ:
     shiba.webp    Dog          柴犬      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Dog/3D/dog_3d.png
     cat.webp      Cat face     ねこ      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Cat%20face/3D/cat_face_3d.png
     fox.webp      Fox          きつね    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Fox/3D/fox_3d.png
     rabbit.webp   Rabbit face  うさぎ    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Rabbit%20face/3D/rabbit_face_3d.png
     panda.webp    Panda        パンダ    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Panda/3D/panda_3d.png
     bear.webp     Bear         くま      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Bear/3D/bear_3d.png
     tiger.webp    Tiger face   とら      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Tiger%20face/3D/tiger_face_3d.png
     hamster.webp  Hamster      ハムスター https://github.com/microsoft/fluentui-emoji/blob/main/assets/Hamster/3D/hamster_3d.png
     monkey.webp   Monkey face  さる      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Monkey%20face/3D/monkey_face_3d.png
     frog.webp     Frog         かえる    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Frog/3D/frog_3d.png
     penguin.webp  Penguin      ペンギン  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Penguin/3D/penguin_3d.png
     koala.webp    Koala        コアラ    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Koala/3D/koala_3d.png
     lion.webp     Lion         ライオン  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Lion/3D/lion_3d.png
     mouse.webp    Mouse face   ねずみ    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Mouse%20face/3D/mouse_face_3d.png
     owl.webp      Owl          ふくろう  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Owl/3D/owl_3d.png
     dog.webp      Dog face     いぬ      https://github.com/microsoft/fluentui-emoji/blob/main/assets/Dog%20face/3D/dog_face_3d.png
   （まえは DiceBear Notionists の 人の アバターを つかって いましたが、画風を 3D に そろえる ため やめました）

3. icons.js … ボタンの アイコン（Phosphor Icons「fill」）
   入手もと: Iconify の アイコンセット データ（npm @iconify-json/ph。https://github.com/iconify/icon-sets/blob/master/json/ph.json と 同じ もの）
             Iconify の コレクション情報 info.license が MIT で ある ことを 確認
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）
   ライセンス: MIT License（全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt）
   つかって いる アイコン（すべて -fill）:
     house / gear-six / robot / users-three / door-open / plus-circle / arrow-left / list / x / check / copy /
     speaker-high / speaker-slash / lightning / trophy / book-open-text / play / dice-one〜dice-six（サイコロ）/
     sign-out / lightbulb / arrow-clockwise / info / backspace / hand-pointing / eye / user / crown-simple / timer / wifi-slash

4. 素材では ない もの（プログラムで その場で つくる もの）
   ・効果音（牌を えらぶ カチッ・卓に 当たる 音・雷 など）… sound.js で Web Audio を つかって 合成
   ・ポン／チー／カン／リーチ／ロン／ツモ の こえ … 端末の 日本語 読みあげ（speechSynthesis）
   ・雷・光・ゆれ・火花 などの 演出 … fx.js で Canvas に 線や 光を えがく 画面効果
   （2026-10-10 に 依頼者に たしかめて、この 方法で よいと きめました）
