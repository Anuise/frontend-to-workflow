---
name: f2w-breakdown
description: frontend-to-workflow 管線的第五步。讀取 workflow.json，依逐頁 Workflow description 把每個 Page 拆成前端工項（觀察自畫面、逐可執行操作至少一筆）與後端工項（AI 推論、標「推論·待確認」、依 API／驗證／查詢拆多筆），組裝驗證後寫入 workitems.json。前端有硬底線：每頁前端工項數 ≥ max(1, 該頁 actions 數)。承諾型欄位（估時／優先級／RACI／簽核／狀態）刻意不進 json。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-breakdown, break workflow pages into frontend/backend work items, or produce workitems.json for the frontend-to-workflow pipeline.
---

# f2w-breakdown：前端／後端工項劃分

管線六步的第五步。讀取 f2w-describe 的產出（`output/<project>/workflow.json`），依每個 **Page** 的 Workflow description，把工作拆成 **前端 Work item**（觀察自畫面）與 **後端 Work item**（AI 從前端操作推論而來），組裝驗證後產出 `output/<project>/workitems.json`，交給後續 `f2w-breakdown-export`。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。另有一份**可選**前置：`workspace/revisions/<project>/revisions.json`（由 f2w-revise 產出，缺檔視為沒有修訂）。
產出：`output/<project>/workitems.json`。
假設：**刻意打破純前端地基**（見 ADR-0002）。`workflow.json` 沒有後端資訊，後端工項只能由 AI 從每個 Page 的內容／操作**推論**，一律標為「推論·待確認」（`inferred: true`），與觀察自畫面的前端工項（`inferred: false`）嚴格區分；後端工項的正確性責任落在開工前的人工確認。**承諾型欄位**（估時／優先級／RACI／簽核日期／狀態）是多人協作的權責畫押值，**不進 `workitems.json`**——它們只在人工另存的工作副本裡填。

## 流程

1. **讀取前置** — `loadWorkflowForBreakdown(outputRoot, project)`
   - 回傳 `Workflow`（逐 Page 的用途、內容、可執行操作與操作去向）。缺 `workflow.json` 會丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **逐 Page 劃分前端工項**（以 `workflow.json` 為據、**繁體中文**）
   - 對 `workflow.pages` 列出的**每一個** Page，依其 `actions`（可執行操作）**逐操作至少產出一筆**前端 Work item——不要把整頁塞成一團；純顯示頁（無 actions）至少產出一筆。涵蓋不得漏頁、顆粒度不得低於操作數（步驟 4 有硬底線把關）。每筆填**內容型欄位**：
     - **id**：全域唯一（跨前端＋後端）。**前端一律是 `FE-<頁序>-<該頁工項序>`**（兩段皆從 1 起、補零兩位，取自 `workflow.json` 的陣列索引；用 `frontendWorkitemId(pageIndex, itemIndex)` 算，不要自己編）——契約與 `buildWorkitems` 都會擋下不合推導值的 id，這是為了讓錨在 id 上的修訂撐得過一次重拆（見 ADR-0013）。後端 id 不受此格式約束。
     - **sourcePage**：此工項來源的 Page（`route` +（可選）`tab`），必須是 `workflow.pages` 裡存在的 Page。
     - **title**（標題）／**scope**（範疇）／**acceptance**（驗收標準）。
     - **dependsOn**：所依賴的其它工項 id（可空陣列），每個 id 必須存在於本批工項。
     - **risk**：風險備註（可空字串）。
3. **推論後端工項**
   - 從各 Page 的操作與內容推論所需的後端工作，**依 API／驗證／查詢等拆成多筆而非一團**（如儲存 API、欄位驗證、清單查詢各自成項），比照前端填同一組內容型欄位；這些工項一律是**推論·待確認**（`inferred` 由落在 backend 陣列決定，不用手填）。後端無硬底線（推論而來、無法錨定 actions）。
4. **組裝並驗證** — `buildWorkitems(workflow, frontendItems, backendItems, revisions)`
   - **存檔前套上人工修訂**：第四個參數就是讀回來的修訂集，支援 `set`（覆蓋欄位）／`upsert`（補一筆工項）／`remove`（刪一筆工項）。**人的校正壓過 AI 的新產出**——一個欄位被 `set` 過就**凍結**在使用者的值，重跑再也改不動，除非手動從 `revisions.json` 刪掉那筆；要向使用者交代這件事。套用**之後**才跑下面全部把關，所以 `remove` 掉太多前端工項而跌破底線時會丟錯**不落地**。
   - 回傳 `{ workitems, warnings }`。`warnings` 是**孤兒修訂**（錨指向的工項這次不存在，後端 id 漂掉最常見）：保留該筆、發 warning、其餘照套，不中止。把 warnings 報給使用者。
   - 五重把關：**涵蓋＋顆粒度**（每個 Page 的前端工項數 ≥ `max(1, 該頁 actions 數)`——逐操作至少一筆、純顯示頁至少一筆；此底線涵蓋並取代舊的 per-page ≥1 涵蓋檢查）、**參照**（每筆 `sourcePage` 存在於 `workflow.pages`、`dependsOn` 每個 id 存在於本批）、**id 全域唯一**、**inferred 旗標**（前端 false、後端 true，由陣列決定）。`sourcePage` 一律取自 `workflow.pages`（單一真實來源）。
   - 涵蓋或參照不符丟 `WorkitemsConsistencyError`；不合契約（空欄位、id 重複、inferred 旗標）冒泡 `ContractValidationError`。
5. **保存** — `saveWorkitems(outputRoot, project, workitems)`
   - 通過契約驗證才寫 `output/<project>/workitems.json`；驗證失敗丟 `ContractValidationError` 且不落地。

## 逃生口

`workitems.json` 是宣告式逃生口：工項拆得不準、漏頁、依賴或後端推論抓錯時，直接手改該檔（增刪工項、改 title／scope／acceptance／dependsOn、調整 frontend／backend 歸屬），符合契約即可交給下一步。**但手改只活到下一次重跑本步為止**（本步整份覆寫 `workitems.json`）；要讓校正撐過重跑，走 `f2w-revise workitems <修改需求>` 把它變成一筆修訂——補工項建議用自訂 id（如 `BE-EXTRA-01`），完全不受 AI 重新編號影響。若問題出在上游描述本身（漏頁、操作去向錯），先回頭手改 `workflow.json` 或重跑 f2w-describe，再重跑本步。

## 對應實作

`src/breakdown/`：`loadWorkflowForBreakdown`（前置檢查＋讀回 workflow.json）、`buildWorkitems`（涵蓋／顆粒度＋參照＋契約五重把關、前端 id 推導把關、存檔前套修訂、由陣列決定 inferred 的組裝核心）、`checkWorkitemsConsistency`（套用後重跑的參照＋顆粒度把關，乾跑共用）、`saveWorkitems`（驗證後保存）。修訂的讀回與套用見 `src/revise/`（`loadProjectRevisions`、`applyWorkitemsRevisions`）。契約見 `src/contracts/workitems.ts`；路徑見 `src/output.ts`（`contractPath`）。決策見 ADR-0001（步驟間以檔案交接、checkpoint）、ADR-0002（後端工項為 AI 推論）、ADR-0003（前端工項逐操作硬底線）、ADR-0012（修訂由上游套用）與 ADR-0013（前端 id 確定性推導、後端 id 的殘餘風險）。
