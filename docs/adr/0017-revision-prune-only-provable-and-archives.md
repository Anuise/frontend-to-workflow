# 修訂的自動清除只做可證明的一類，而且是搬進 archive 不是刪除

`f2w-revise --prune` 只處理一種形態：**同作用點被後寫覆蓋的筆**（superseded）。判定規則逐字沿用 `applyRevisions` 自己的 `actionPoint`（`target|anchor|field`），所以「哪一筆不生效」與套用邏輯永遠是同一個定義。被判定的筆**搬進** `workspace/revisions/<project>/revisions.archive.json`，`revisions.json` 只留有效修訂集。搬完套用結果必須逐字不變——這是 prune 的正確性判準。

`upsert` 與 `remove` **不參與**作用點摺疊。`actionPoint` 讓這兩個 op 共用同一個作用點（都沒有 `field`），把 `upsert` 當 superseded 搬走會廢掉 ADR-0012:29 認可的唯一放棄途徑。

實測 `new_0724` 的 190 筆修訂：孤兒 0 筆、純重複 append 0 筆、乾跑全綠，superseded 79 筆（佔全檔 39.7% 體積），有效集 111 筆。

## Considered Options

- **連 no-op 一起清（否決）**：111 筆有效修訂裡 108 筆是 no-op（value 與當前 json 逐字相同），但那是因為 `workitems.json` 在修訂落檔之後才重跑產出（`revisions.json` mtime 早於 `workitems.json`）——它們是「修訂已成功套上」的**證據**，砍掉等於讓 108 個欄位在下次重跑靜默退回 AI 原文。要區分「已套上」與「AI 現在自己也寫對了」需要一份不套修訂的 AI-only 基準產出，管線從不落檔那個東西。
- **連孤兒一起清（否決）**：孤兒不可證明**永久**過時。ADR-0012:41 已記下上游 tab 命名改回來它就活了。現行行為（保留＋每次發 warning）是使用者唯一會撞到的提示。
- **把含 `#` 的 leg 標籤當永久孤兒清（否決）**：見 ADR-0016——那個標籤是合法錨，而且 59 個 anchor 有 39 個落在多 leg 工項上，正是使用者最會照交付物抄的那批。自動吞掉它們比現行的 warning 更難察覺。
- **加 `prunedAt` 墓碑欄位，原地標記不搬（否決）**：`revisions.json` 只會更肥，完全沒解掉體積問題；而過濾點若放 `loadProjectRevisions`，乾跑與上游會看到不同輸入，直接踩爛 ADR-0012:31 的一致性約束。
- **只清 superseded、搬進 archive（採用）**：唯一**不依賴任何當前 json 快照**就能證明不生效的形態，所以 prune 的結果與上游同步不同步無關。搬檔而非刪除，還原路徑是「把那一筆搬回去」。

## 使用者真正要的那個答案由乾跑回報，不是由寫檔給的

「我的校正現在還有幾筆錨得住」這個問題的答案在 `DryRunReport`，不在檔案體積。所以 `DryRunReport` 一併擴成帶可機讀分類（superseded／no-op／orphan／effective）與有效修訂集大小，兩個生產者（`dryRunWorkitemsRevisions`／`dryRunWorkflowRevisions`）都要跟上。

prune 只買到體積與可讀性，不買到正確性——這一點要在 SKILL.md 寫清楚，否則使用者會以為 prune 過的檔案就健康了。而 ADR-0013:21 記下的殘餘風險（id 位移導致修訂落到別筆工項身上、不發 warning、乾跑也看不出來）比任何一種可證明的過時都危險，prune 完全抓不到它。

## Consequences

- ADR-0012 的五條全部維持：append-only 的累積語意、欄位凍結、不加自動失效機制、孤兒不在檔案裡標記 `orphaned`、乾跑與上游共用同一份實作。本 ADR 只新增「已經不生效的筆可以被搬走」。
- `workspace/` 不進版控（ADR-0011:20），archive 提供的是還原路徑而非版本歷史。搬檔前後 `revisions.json` 的套用結果必須逐字相同，這條進測試。
- prune 是明確觸發的動作（`--prune`），不在任何上游重跑時自動發生。
- `revisions.archive.json` 只被 prune 讀寫，`loadProjectRevisions` 不讀它——否則搬走等於沒搬。
