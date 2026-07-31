---
name: f2w-revise
description: frontend-to-workflow 管線的可選插入步，可重複跑。把使用者的一句修改需求轉寫成一批宣告式的 Revision（修訂），append 落檔到 workspace/revisions/<project>/revisions.json，並當場做一次乾跑驗證（不寫回任何 json）。修訂由上游套用：重跑 f2w-describe／f2w-breakdown 時人工校正自動回到 workflow.json／workitems.json。錨可以是工項 id，也可以是交付物上的分工鏈列標籤 <工項id>#<leg序>；set 也可覆蓋 partyChain。不帶修改需求時只做乾跑體檢；--prune 把同作用點被後寫覆蓋的歷史搬進 revisions.archive.json。缺 workflow.json／workitems.json 時提示先跑對應的上一步。Use when the user wants to run f2w-revise, correct a page description or work item that keeps getting overwritten by reruns, durably add or remove a work item, change a party assignment that survives reruns, prune superseded revisions, or check whether accumulated revisions still anchor.
---

# f2w-revise：把人工校正變成撐得過重跑的修訂

可選插入步，同一個專案可反覆跑。它**不產交付物、不碰任何 json**，只做一件事：把使用者提出的修改需求，轉寫成一批**宣告式的 Revision**，落在 `workspace/revisions/<project>/revisions.json`。

套用的執行者是**上游**：`f2w-describe` 與 `f2w-breakdown` 在存檔前讀修訂並套上去。所以重跑上游不再是「丟掉校正」，而是「拿到新資訊，並自動帶回所有校正」。

```
f2w-revise <workflow|workitems> <修改需求>
f2w-revise <workflow|workitems>
```

不帶修改需求時只做乾跑體檢。**target 由使用者講明，不由 AI 從話裡判斷**——判錯的後果是修訂錨到錯的檔、靜默變孤兒，而講明的成本近乎為零。

前置：`output/<project>/workflow.json`（target 為 workflow）或 `output/<project>/workitems.json`（target 為 workitems）。缺件即中止並提示先跑 f2w-describe／f2w-breakdown。
產出：`workspace/revisions/<project>/revisions.json`（append-only 的累積陣列）。

## 流程

1. **讀當前產出** — `loadWorkflowForRevise(outputRoot, project)` 或 `loadWorkitemsForRevise(outputRoot, project)`
   - 缺檔丟 `MissingPrerequisiteError`，提示先跑對應的上一步，**中止**。修訂要錨在真實存在的 Page 或工項上，所以先讀。
2. **產出 Revision**（依當前狀態與使用者的話，**繁體中文**）
   - 每筆的形狀是 `{ target, op, anchor, field?, value, reason, at? }`：
     - **`target`** — `"workflow"` 或 `"workitems"`，就是使用者講明的那個。
     - **`op`** — `"set"`（覆蓋欄位）／`"upsert"`（整筆新增或覆蓋工項）／`"remove"`（刪掉工項）。**`upsert` 與 `remove` 只對 `workitems` 開放**；workflow 要增刪頁請回頭改 `pages.json` 再重跑 f2w-capture／f2w-describe。
     - **`anchor`** — workflow 是字面值 `"overview"` 或一個 Page 識別（`{ route, tab? }`，逐字取自 `workflow.json`）；workitems 是工項 id，**也可以是交付物上的分工鏈列標籤 `<工項id>#<leg序>`**（如 `BE-MODEL-1#2`，leg 序從 1 起）——使用者照 `workitems.xlsx` 抄下來的錨必須錨得到東西。工項 id 由契約層保證不含 `#`，所以切法無歧義。
     - **`field`** — 只有 `set` 需要。workflow 可覆蓋 `purpose`／`content`／`actions`（整組）／`overview`；workitems 可覆蓋 `title`／`scope`／`acceptance`／`risk`／`dependsOn`（整組）／`partyChain`（整組 leg 陣列）。**`inferred` 不可被覆蓋**（它由工項落在 frontend 或 backend 陣列決定）。
     - **錨在 leg 上時**：`title`／`scope`／`acceptance` 寫進**那一段**；`partyChain` 給長度 1 的陣列即**取代那一段**（這是覆蓋 leg 的 `party`／`vendor`／`vendorEndpoints` 的途徑）；`risk`／`dependsOn` 沒有 leg 層版本，仍落在工項層。leg 序超出鏈長時算孤兒（發 warning、不中止）。
     - **`value`** — 你重寫的**欄位全文**，型別依 `field` 決定（`purpose` 是字串、`actions` 是操作陣列、`dependsOn` 是 id 陣列、`upsert` 是一整筆 Work item 物件，其 `id` 必須與 `anchor` 相同、`inferred` 決定它落在前端還是後端陣列）。
     - **`reason`** — 使用者為什麼要改，人看的自由文字，**不參與套用**。
     - **`at`** — 寫入時填當天日期（`YYYY-MM-DD`），純註記、不參與排序。
   - 補工項時**建議用自訂 id**（如 `BE-EXTRA-01`）：後端 id 由 AI 每次重新編號，錨在 AI 生成的後端 id 上的 `set` 重跑後可能變孤兒；自訂 id 的 `upsert` 完全穩定。前端 id 是確定性的（`FE-<頁序>-<該頁工項序>`），錨得住。
3. **直接 append 落檔** — `appendRevisions(workspaceRoot, project, additions)`
   - **不做事先確認**，直接寫。累積陣列是 append-only 的：同一個欄位改第二次，舊的那筆仍留在檔案裡（看得出調整過幾次、每次的理由），套用時每個作用點只取最後一筆。整份通過驗證才寫，否則丟錯且不落地。
4. **乾跑驗證** — `dryRunWorkflowRevisions(workflow, all)` 或 `dryRunWorkitemsRevisions(workitems, workflow, all, partyInputs)`
   - 把**落檔後的完整累積修訂集**（不只這次新增的幾筆）套到當前 json 上，跑契約驗證與工項顆粒度底線，收集孤兒清單。**不寫回任何 json。**
   - workitems 側的第四個參數是派工輸入（`discoverPartyInputs(specRoot, project)` 的結果）。**給了就連鏈硬底線一起跑**——`set partyChain` 把方序列改成不在宣告鏈上的，乾跑當場就紅，不必等下次重跑 f2w-breakdown 才炸。沒給就跳過鏈那一關（沒有宣告鏈可對照）。
5. **回報**（落檔後回報取代了落檔前確認）
   - 列出這次寫進去的**每一筆全文**：錨、欄位、新值、reason。
   - 接著報乾跑結果：契約驗證過或不過（不過時給完整錯誤訊息）、顆粒度底線有沒有跌破、哪些修訂現在是孤兒（指名錨在哪裡）。
   - 提醒使用者：修訂要等**下次重跑 f2w-describe／f2w-breakdown** 才會反映到 json 與交付物上。

不帶修改需求直接觸發時，**跳過步驟 2 與 3**，只做乾跑與回報——用來體檢目前累積的修訂是否還健康（「我的校正現在還有幾筆錨得住」）。乾跑回報帶四種**可機讀分類**的計數：`effective`（有效修訂集大小，就是那個問題的答案）、`superseded`、`noop`、`orphan`（後兩者是 `effective` 的子集）。

## `--prune`：只搬可證明過時的那一類

```
f2w-revise <workflow|workitems> --prune
```

把**同作用點被後寫覆蓋**（superseded）的筆搬進同目錄的 `revisions.archive.json`，`revisions.json` 只留有效修訂集。判定逐字沿用套用時的作用點規則，所以搬走的都是不生效的筆——**prune 前後套用結果逐字相同**。

**它買的是體積與可讀性，不買正確性。** 檔案瘦了不代表剩下的修訂都對，尤其抓不到 ADR-0013 記下的「錯位但不算孤兒」（頁插在中間導致 id 整批位移，錨落到別筆工項身上）。prune 完不要以為檔案就健康了。

只搬 superseded，其餘一律**只報告、不動手**：

- **`upsert` 與 `remove` 不參與摺疊**——兩者共用同一個作用點，搬走 upsert 會廢掉唯一的放棄途徑。
- **no-op**（value 與當前 json 逐字相同）不可證明過時：它多半正是「這筆修訂已經成功套上」的證據，砍掉等於讓那些欄位下次重跑靜默退回 AI 原文。
- **孤兒**不可證明**永久**過時：上游把 tab 命名改回來它就活了。

**搬檔不是刪除**：`revisions.archive.json` 就是還原路徑——把那一筆搬回 `revisions.json` 即可。`loadProjectRevisions` **不讀** archive（在那裡過濾會讓乾跑與上游看到不同輸入）。決策見 `docs/adr/0017-revision-prune-only-provable-and-archives.md`。

## 修訂生效回路（要講給使用者聽）

修訂落檔**當下不生效**，要走完這個回路：

1. `f2w-revise` 落檔到 `revisions.json`（本步；只做乾跑，不寫回任何 json）。
2. **重跑上游**才套用：`f2w-describe` 套 workflow 側、`f2w-breakdown` 套 workitems 側。這一步之後 `workflow.json`／`workitems.json` 才帶著校正。
3. **重跑交付物**才看得到：`f2w-export`（`workflow.xlsx`）、`f2w-breakdown-export`（`workitems.xlsx`）、`f2w-diagram`（`mainflow.drawio`）。
   - `f2w-diagram` 有個陷阱：`mainflow.json` **已存在就沿用、不重推論**。要讓 workflow 側的校正反映到主線上，得先刪掉 `mainflow.json` 或明講「重推主線」。

## 欄位凍結語意（一定要講給使用者聽）

由上游套用意味著**人的校正永遠壓過 AI 的新產出，即使 AI 這次寫得更好**。一個欄位被下過 `set`，它就**凍結**在使用者的值，重跑上游再也改不動——除非手動從 `revisions.json` 刪掉那筆。

沒有「只套一次」的機制。要放棄一筆修訂，就是手動刪掉它，然後重跑上游拿回 AI 的版本。

## 乾跑的邊界

乾跑報的是「**現在**套會怎樣」，不是「下次重跑上游會怎樣」。上游重跑時 Page 或工項可能增減，孤兒清單會跟著變。乾跑與上游呼叫的是同一支 `applyRevisions`（見 ADR-0012），所以兩者對**同一份輸入**的結果一定一致；差異只來自輸入本身變了。

還有一種乾跑看不出來的情況：`workflow.json` 新增的頁**插在既有頁中間**時，工項 id 會整批位移，錨在舊 id 上的修訂會套到別筆工項身上而**不算孤兒**。這是 ADR-0013 記下的已知殘餘風險。

## 逃生口

`revisions.json` 是人看得懂、改得動的 json：可以直接手寫一筆、也可以刪掉一筆。刪掉之後重跑上游就會回到 AI 的版本。手寫時 `at` 可以省略，不影響套用正確性。

## 對應實作

`src/revise/`：`revisionsPath`／`revisionsArchivePath`／`loadProjectRevisions`／`appendRevisions`（修訂檔路徑、讀回、append 落檔）、`loadWorkflowForRevise`／`loadWorkitemsForRevise`（前置檢查＋讀回）、`applyWorkflowRevisions`／`applyWorkitemsRevisions`（套用的純函式，各回 `{ result, warnings }`）、`dryRunWorkflowRevisions`／`dryRunWorkitemsRevisions`（乾跑，回報帶四種分類計數）、`partitionSuperseded`／`pruneProjectRevisions`（`--prune`）。列標籤的切法走 `parsePartyLegLabel`（`src/contracts/workitems.ts`，與匯出端同一支公式的反向）。契約見 `src/contracts/revisions.ts`。決策見 ADR-0011（為何落在 `workspace/`）、ADR-0012（宣告式 override、由上游套用、乾跑共用實作）、ADR-0013（前端 id 確定性化與後端的殘餘風險）、`docs/adr/0016-work-item-carries-party-chain.md`（leg 標籤是合法的錨）與 `docs/adr/0017-revision-prune-only-provable-and-archives.md`（prune 只搬可證明的一類、搬檔不刪除）。
