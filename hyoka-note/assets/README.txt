評価ノート ― つかって いる 素材（assets/）
==================================================================

この フォルダーの 素材は、すべて 下の ライブラリから ダウンロードして 保存した ものです。
ライセンスの 全文は リポジトリ直下の THIRD_PARTY_LICENSES.txt に あります（画面には 表示しません）。

1. icons/*-duotone.svg … Phosphor Icons「duotone」（MIT License）
   入手もと: Iconify の アイコンセット データ https://github.com/iconify/icon-sets/blob/master/json/ph.json
             （Phosphor 2.1.1。Iconify の コレクション情報で ライセンスが MIT で ある ことを 確認）
   もとの プロジェクト: https://github.com/phosphor-icons/core（LICENSE: MIT で ある ことを 確認）
   加工: Iconify の データ（body）を そのまま <svg viewBox="0 0 256 256"> に 入れただけ。色は まわりの 文字の 色になる。
   組みこみかた: GAS の 画面は フォルダーの ファイルを 読みこめないので、
                 tools/build-icons.js が この フォルダーの SVG を index.html の ICONS-BEGIN 〜 ICONS-END に 書きこむ。
                 SVG を ふやしたり かえたり したら、node hyoka-note/tools/build-icons.js を 実行する。

   ファイル                          つかう ところ
   notebook-duotone.svg              ロゴ（画面の 左上・はじめの 画面）
   table-duotone.svg                 成績一覧
   user-circle-duotone.svg           個人シート
   list-checks-duotone.svg           未実施チェック
   book-open-duotone.svg             使い方
   download-simple-duotone.svg       バックアップ
   gear-six-duotone.svg              設定
   lock-key-duotone.svg              合言葉
   pencil-simple-duotone.svg         編集
   note-pencil-duotone.svg           メモ
   dots-six-vertical-duotone.svg     並べかえの つまみ
   printer-duotone.svg               印刷
   file-xls-duotone.svg              Excel出力
   arrow-counter-clockwise-duotone.svg  取消
