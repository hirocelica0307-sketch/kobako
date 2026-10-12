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

2. chars/*.webp … キャラクター「どうぶつ（十二支）」（Microsoft Fluent Emoji「3D」の 動物）
   入手もと: https://github.com/microsoft/fluentui-emoji （assets/<名前>/3D/*_3d.png）
   ライセンス: MIT License（全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt）
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   加工: 256×256 の PNG を 160×160 に 縮めて WebP（品質 90）に しました。
   2026-10-11 に「ぜんぶ 3D の 動物に そろえる」「柴犬は Dog（全身）」と きめました。
   2026-10-12 に 依頼者から「動物は 十二支に」と たのまれ、候補（顔中心の 案A／全身の 案B）を 見せて
   「案A（顔が ある ものは 顔、ない ものは 体・頭）」に きめました。いぬは 前に きめた 柴犬（Dog 全身）。
   （柴犬 そのものの 素材は 表記不要の ライブラリに なかったので、茶色で しっぽが まいた Dog を 柴犬と して つかう）
   ファイル・Fluent Emoji の 名前・画面の 名まえ:
     mouse.webp    Mouse face   ねずみ（子）  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Mouse%20face/3D/mouse_face_3d.png
     cow.webp      Cow face     うし（丑）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Cow%20face/3D/cow_face_3d.png
     tiger.webp    Tiger face   とら（寅）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Tiger%20face/3D/tiger_face_3d.png
     rabbit.webp   Rabbit face  うさぎ（卯）  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Rabbit%20face/3D/rabbit_face_3d.png
     dragon.webp   Dragon face  たつ（辰）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Dragon%20face/3D/dragon_face_3d.png
     snake.webp    Snake        へび（巳）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Snake/3D/snake_3d.png
     horse.webp    Horse face   うま（午）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Horse%20face/3D/horse_face_3d.png
     sheep.webp    Ewe          ひつじ（未）  https://github.com/microsoft/fluentui-emoji/blob/main/assets/Ewe/3D/ewe_3d.png
     monkey.webp   Monkey face  さる（申）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Monkey%20face/3D/monkey_face_3d.png
     chicken.webp  Chicken      とり（酉）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Chicken/3D/chicken_3d.png
     shiba.webp    Dog          柴犬（戌）    https://github.com/microsoft/fluentui-emoji/blob/main/assets/Dog/3D/dog_3d.png
     boar.webp     Boar         いのしし（亥）https://github.com/microsoft/fluentui-emoji/blob/main/assets/Boar/3D/boar_3d.png

2c. fx/hand.webp … 満貫いじょうの ツモで 牌を 引く 手（Microsoft Fluent Emoji「3D」の Pinching hand・Default）
   入手もと: https://github.com/microsoft/fluentui-emoji/blob/main/assets/Pinching%20hand/Default/3D/pinching_hand_3d_default.png
   ライセンス: MIT License（全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt）
   加工: 256×256 の PNG を WebP（品質 92）に しました。画面では style.css で 半透明に して 白っぽく 光らせて います。
   2026-10-12 に 候補（つまむ手・すぼめた手・手のこう）を 見せて「つまむ手」に きめました。

2b. avatars/*.svg … キャラクター「ひと」（DiceBear「Notionists」。まえの 版の 人の アバター）
   入手もと: DiceBear https://www.dicebear.com/styles/notionists/ （npm @dicebear/core 9・@dicebear/collection 9 で この 場で 生成）
   ライセンス: デザインは CC0 1.0（Notionists by Zoish）
   ライセンス確認: npm パッケージ @dicebear/notionists の LICENSE
     「Source: Notionists (https://heyzoish.gumroad.com/l/notionists) / Designer: Zoish / License: CC0 1.0」
   2026-10-12 に 依頼者から「まえの 人の バージョンも えらべる ように」と たのまれて もどしました
   （どうぶつ〔3D〕と ひと〔平面〕で 画風が ちがうので、コンピューターは 1人めの 人と 同じ なかまから えらぶ）。
   生成に つかった 文字（シード）・背景色・画面の 名まえ（仮の 名まえ。実名は つかって いません）:
     you.svg     seed: cpu-04  背景 #ffd88a  アオ
     friend.svg  seed: cpu-13  背景 #a8e6cf  ユウ
     cpu1.svg    seed: cpu-01  背景 #ffb3a7  ハル
     cpu2.svg    seed: cpu-05  背景 #c7b8ff  ミオ
     cpu3.svg    seed: cpu-07  背景 #9fd8ff  ソラ
     cpu4.svg    seed: cpu-09  背景 #ffe0a3  ジン
     cpu5.svg    seed: cpu-10  背景 #f8b4d9  リン
     cpu6.svg    seed: cpu-14  背景 #b9f0a6  ケイ
   加工: svgo で 小さく しました。

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
   ・雷・光・ゆれ・火花・役満の ツモ牌の キラキラ などの 演出 … fx.js で Canvas に 線や 光を えがく 画面効果
   （2026-10-10 に 依頼者に たしかめて、この 方法で よいと きめました）
