くじびき ひろば ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。
2026-10-16 に 依頼者に 候補（素材名・ライブラリ・ライセンス）を 見せて、この 一覧で よいと きめました。
ばくだん リレーを なくした ときに Bomb（bomb.webp）は けしました。

1. emoji/*.webp … Microsoft Fluent Emoji「3D」（MIT License）
   入手もと: https://github.com/microsoft/fluentui-emoji （assets/<名前>/3D/*_3d.png）
   ライセンス確認: https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE（MIT）
   加工: 256×256 に 縮めて WebP（品質 90）に しました。ファイル名は Fluent Emoji の 名前を 小文字・ハイフンに したもの。

2. app-icon.png（64×64・すきとおし）・app-icon-180.png（180×180・白い 地）
   もと: Microsoft Fluent Emoji「3D」の Admission tickets（上と おなじ ライセンス）
   入手もと: https://github.com/microsoft/fluentui-emoji/blob/main/assets/Admission%20tickets/3D/admission_tickets_3d.png
   加工: 縮めた（180 は 白い 地に 140×140 で のせた）

3. icons.js … Phosphor Icons「fill」（MIT License）
   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json
             （Iconify の コレクション情報 info.license が MIT で ある ことを 確認）
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT）
   つかって いる アイコン（すべて -fill）: house / caret-left / pencil-simple / gear-six / speaker-high / speaker-slash /
     play / arrow-counter-clockwise / arrows-clockwise / trash / plus / minus / check-circle / shuffle / list-numbers /
     users-three / printer / fast-forward / corners-out / corners-in / eye / eye-slash / hand-tap / x-bold /
     skip-forward / device-mobile / chair

4. 自分で えがいて いる もの（素材では ありません）
   ルーレットの ばん・あみだの 線と 火花・ビンゴの 球と 玉・おみくじの 箱と 棒と 紙・ガチャの 機械と カプセル・
   席がえの 席・紙ふぶき や 花火の つぶ は、うごく「しかけ」なので canvas／CSS で えがいて います
   （2026-10-16 に 依頼者に たしかめて「しかけ だけ 描いて よい」と きめました）。
   キャラクター・物の 絵は 1. だけです。
   効果音も 音声ファイルは つかわず、sound.js で その場で 合成して います。

----------------------------------------------------------------
emoji/ の ファイル いちらん（ファイル・Fluent Emoji の 名前・つかう ところ・入手もと）
----------------------------------------------------------------
admission-tickets.webp	Admission tickets	タイトル・メニュー	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Admission%20tickets/3D/admission_tickets_3d.png
party-popper.webp	Party popper	ルーレット（メニュー）・あたりの けっか	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Party%20popper/3D/party_popper_3d.png
confetti-ball.webp	Confetti ball	ガチャガチャ（メニュー）・あたりの けっか	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Confetti%20ball/3D/confetti_ball_3d.png
glowing-star.webp	Glowing star	チームわけ・席がえ（メニュー）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Glowing%20star/3D/glowing_star_3d.png
trophy.webp	Trophy	発表の じゅんばん（メニュー）・大あたりの けっか	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Trophy/3D/trophy_3d.png
drum.webp	Drum	発表の じゅんばん（ドラムロール中）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Drum/3D/drum_3d.png
fire.webp	Fire	あみだくじ（メニュー・導火線の 火）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Fire/3D/fire_3d.png
collision.webp	Collision	あみだくじの ドカン！	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Collision/3D/collision_3d.png
shinto-shrine.webp	Shinto shrine	おみくじ（メニュー・うしろの 鳥居）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Shinto%20shrine/3D/shinto_shrine_3d.png
scroll.webp	Scroll	おみくじの 紙	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Scroll/3D/scroll_3d.png
ghost.webp	Ghost	はずれの けっか	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Ghost/3D/ghost_3d.png
crystal-ball.webp	Crystal ball	ビンゴ（メニュー）	https://github.com/microsoft/fluentui-emoji/blob/main/assets/Crystal%20ball/3D/crystal_ball_3d.png
