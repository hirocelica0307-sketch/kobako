毎日教養 ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-10-18 に 依頼者から「素材は おまかせ」と 言われて、下の 2つに きめました。

1. genre/*.webp・emoji/*.webp・icon/*.png … Microsoft Fluent Emoji「3D」（MIT License）
   入手もと: https://github.com/microsoft/fluentui-emoji/tree/main/assets/<素材名>/3D/
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   加工: 160×160 に ちぢめて WebP に した（アプリの アイコンは PNG）

   ジャンルの 絵（genre/）
     seiji.webp     政治・法律           … Balance scale（てんびん）
     keizai.webp    経済・お金           … Money bag（お金の ふくろ）
     business.webp  ビジネス・経営       … Briefcase（かばん）
     chiri.webp     国際・地理           … World map（世界地図）
     nihonshi.webp  日本史               … Japanese castle（日本の 城）
     sekaishi.webp  世界史               … Classical building（古代 ギリシャ風の 建物）
     tetsugaku.webp 哲学・思想           … Thinking face（考える 顔）
     shukyo.webp    宗教・神話           … Shinto shrine（鳥居）
     shinri.webp    心理学・行動経済学   … Brain（脳）
     bungaku.webp   文学                 … Books（本）
     bijutsu.webp   美術・建築           … Artist palette（パレット）
     ongaku.webp    音楽                 … Musical notes（音符）
     geinou.webp    芸能・映画・伝統芸能 … Performing arts（仮面）
     sports.webp    スポーツ             … Sports medal（メダル）
     kagaku.webp    科学・宇宙           … Ringed planet（環の ある 惑星）
     seibutsu.webp  生物・医学・健康     … DNA
     it.webp        IT・テクノロジー     … Laptop（ノートパソコン）
     suugaku.webp   数学・統計・論理     … Abacus（そろばん）
     kotoba.webp    ことば               … Fountain pen（万年筆）
     kurashi.webp   食・暮らし・マナー   … Bento box（弁当）

   そのほかの 絵（emoji/）
     owl.webp     … Owl（ふくろう）  ホーム画面の 案内役・おわりの 画面
     fire.webp    … Fire（ほのお）   つづけた 日数
     bulb.webp    … Light bulb（電球） ワンポイント
     trophy.webp  … Trophy（トロフィー） 覚えた 問題の 数

   アプリの アイコン（icon/）… Owl（ふくろう）
     app-icon-32.png / app-icon-192.png / app-icon-512.png … 大きさを かえただけ（すきとおった 背景）
     maskable-512.png … 背景色（#f5f1e8）の 上に 62% の 大きさで のせた
     apple-touch-icon.png（180×180）… 背景色の 上に 78% の 大きさで のせた

2. icons.js … Phosphor Icons「regular」と「fill」（MIT License）
   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json
             （Iconify の コレクション情報 info.license が MIT で ある ことを 確認）
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）
   つかって いる アイコン: house(-fill) / cards(-fill) / notebook(-fill) / chart-bar(-fill) / gear-six(-fill) /
     caret-left / caret-right / x / check-circle / x-circle / lightbulb / flag / arrow-counter-clockwise /
     shuffle / magnifying-glass / eye / star(-fill) / warning-circle / play / target / info / arrow-right /
     trash / download-simple / upload-simple / check / sparkle / copy / squares-four / speaker-high /
     speaker-slash / lightning / calendar-blank / list-checks
   つかう ところ: 下の タブ・もどる・設定・ボタン（fill は いま ひらいて いる タブと 星じるしの 印だけ）

3. 自分で えがいて いる もの（素材では ありません）
   記録の 棒グラフ・カレンダーの ます・進み具合の バーは、数を しめす 表示 なので CSS で えがいて います。
