# 駅データの出典

駅名・読み・営業キロは、各鉄道事業者の公式サイトに掲載されている駅一覧・路線図・
営業キロ程を参照して入力している。

- JR西日本 各駅情報 https://www.jr-odekake.net/eki/
- 岡山電気軌道 https://okayama-kido.co.jp/
- 水島臨海鉄道 https://www.mizurin.co.jp/
- 井原鉄道 https://www.ibatetsu.co.jp/
- 智頭急行 https://www.chizukyu.co.jp/

## 運用ルール

- `Station.verified` は、上記の一次情報で読みを確認できた駅にだけ `true` を立てる。
- `src/data/__tests__/data.test.ts` が未確認駅の存在を検出して落とす。
- 読みの誤りはゲームとして致命的（打てない駅が生まれる）なので、
  路線データを追加したら必ず1駅ずつ読み合わせを行う。

## 収録済み

| 路線 | 区間 | 駅数 | 状態 |
|---|---|---|---|
| 山陽本線 下り | 岡山〜笠岡 | 11 | 確認済み |

Phase 2 で残り14路線・約200駅を追加する。
