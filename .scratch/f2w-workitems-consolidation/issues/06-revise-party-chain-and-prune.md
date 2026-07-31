# T6：f2w-revise——partyChain 可修訂、leg 標籤可當錨、--prune 只搬可證明的一類

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

三件事。

**（一）`set partyChain`。** `src/contracts/revisions.ts:38` 的 `setRevisionSchema` 加一個 option：`field: z.literal("partyChain")`，`value` 是整組 leg 陣列。`field` 這個判別鍵仍然有效（`partyChain` 與既有九個 field literal 不重疊），所以**不必**改成兩層判別、`REVISION_SCHEMA_BY_OP` 與前置篩不動。

**關鍵漏帳**：`src/revise/applyRevisions.ts:132-145` 的 `set` 是一串 if／else 分支，不加 `partyChain` 分支的話這筆修訂會**靜默 no-op**。這是本票必改的一處。

**（二）leg 標籤可當 anchor。** anchor 解析先切 `#`：左側是工項 id、右側是 leg 序（1 起）。錨在 `BE-MODEL-1#2` 的 `set` 作用在該工項 `partyChain[1]` 這個 leg 上，可覆蓋 leg 的 `party`／`vendor`／`vendorEndpoints`／`title`／`scope`／`acceptance`。這是刻意的——使用者照交付物列標籤寫下的修訂必須錨得到東西（見 ADR-0016）。工項 id 本身由 T2 的 refine 保證不含 `#`，所以切法無歧義。

**（三）`--prune`。** 只搬**同作用點被後寫覆蓋**的筆（superseded），判定逐字沿用 `applyRevisions` 的 `actionPoint`，搬進 `workspace/revisions/<project>/revisions.archive.json`。`upsert` 與 `remove` **不參與**摺疊（兩者共用同一個作用點，搬走 upsert 會廢掉 ADR-0012:29 認可的唯一放棄途徑）。no-op 與孤兒**只進報告、不動手**。`loadProjectRevisions` 不讀 archive。

`DryRunReport` 一併擴成帶可機讀分類（`superseded`／`noop`／`orphan`／`effective`）與有效修訂集大小。**兩個生產者都要跟**：`dryRunWorkitemsRevisions` 與 `dryRunWorkflowRevisions`（`src/revise/dryRun.ts:37`／`:39`）。

決策見 ADR-0016、ADR-0017。

## Acceptance criteria

- [ ] `set partyChain` 的修訂通過契約，且 `applyRevisions` 真的套上（加測試蓋住那條 if／else 分支，防止靜默 no-op）
- [ ] `field: "partyChain"` 加進 `setRevisionSchema` 後 `REVISION_SCHEMA_BY_OP` 與前置篩一行未改，`npx tsc --noEmit` 綠
- [ ] anchor `BE-MODEL-1#2` 的 `set` 只改該工項 `partyChain[1]`，其餘 leg 與工項層欄位逐字不變
- [ ] anchor 的 leg 序超出鏈長時發**孤兒 warning**（不中止、不自動清除）
- [ ] 工項 id 含 `#` 已被 T2 契約擋下，所以 anchor 切法無歧義（加一條測試釘住）
- [ ] `--prune` 對 `new_0724` 的實檔搬走 **79 筆**、`revisions.json` 剩 **111 筆**、`revisions.archive.json` 有 79 筆
- [ ] prune 前後套用結果**逐字相同**（同一份 `workitems.json`／`workflow.json` 輸入，輸出雜湊一致）
- [ ] `upsert` 與 `remove` 一筆都沒被搬走（實檔的 `BE-EXTRA-01`／`BE-EXTRA-02` 兩筆 upsert 留在 `revisions.json`）
- [ ] no-op（實檔 108 筆）與孤兒（實檔 0 筆）只出現在報告，`revisions.json` 裡一筆都沒少
- [ ] `DryRunReport` 帶四種分類計數與有效修訂集大小，`dryRunWorkitemsRevisions` 與 `dryRunWorkflowRevisions` 都回報
- [ ] `loadProjectRevisions` 不讀 `revisions.archive.json`（加測試：archive 裡放一筆，套用結果不變）

## Blocked by

- T2（`partyChain` 契約與 id 禁 `#`）
- T3（乾跑共用函式與新簽名）
