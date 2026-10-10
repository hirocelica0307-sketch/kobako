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

2. avatars/*.svg … プレイヤーの アバター（DiceBear「Notionists」）
   入手もと: DiceBear https://www.dicebear.com/styles/notionists/ （npm @dicebear/core 9・@dicebear/collection 9 で この 場で 生成）
   ライセンス: デザインは CC0 1.0（Notionists by Zoish）
   ライセンス確認: npm パッケージ @dicebear/notionists の LICENSE
     「Source: Notionists (https://heyzoish.gumroad.com/l/notionists) / Designer: Zoish / License: CC0 1.0」
   生成に つかった 文字（シード）と 背景色。実名は つかって いません。
     you.svg     あなた        seed: cpu-04  背景 #ffd88a
     friend.svg  ともだち      seed: cpu-13  背景 #a8e6cf
     cpu1.svg    コンピューター seed: cpu-01  背景 #ffb3a7
     cpu2.svg    コンピューター seed: cpu-05  背景 #c7b8ff
     cpu3.svg    コンピューター seed: cpu-07  背景 #9fd8ff
     cpu4.svg    コンピューター seed: cpu-09  背景 #ffe0a3
     cpu5.svg    コンピューター seed: cpu-10  背景 #f8b4d9
     cpu6.svg    コンピューター seed: cpu-14  背景 #b9f0a6
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
   ・雷・光・ゆれ・火花 などの 演出 … fx.js で Canvas に 線や 光を えがく 画面効果
   （2026-10-10 に 依頼者に たしかめて、この 方法で よいと きめました）
