# Spec: f2w-breakdown + f2w-breakdown-export（前端／後端工項劃分與 RACI 畫押 Excel）

State: closed
Status: ready-for-agent
Created: 2026-07-17
Closed: 2026-07-21
Author: Anuise
Origin: GitHub issue #19 — https://github.com/Anuise/frontend-to-workflow/issues/19

## Problem Statement

跑完 frontend-to-workflow 的四步管線後，使用者手上有一份 `workflow.json`（逐頁 Workflow description）與最終的 `workflow.xlsx`（Workbook）。這份交付物「說明了前端在做什麼」，但**不是一份可以分工開工的計畫**：

- 它沒有把工作切成「可分派、可畫押的最小工作單位」（Work item），團隊拿到只能自己重新拆。
- 它完全沒有後端視角——整條管線假設 Project 是 Pure-frontend，`workflow.json` 零後端欄位——所以要規劃「這個前端背後要做哪些後端」時無據可依。
- 多人協作時沒有權責歸屬：誰當責、誰負責、誰諮詢、誰告知、估時多少、優先級為何、目前狀態，全都無處可填、無處可簽。

使用者要的是：**從既有的 `workflow.json`，自動產出一份前端＋後端的 Work breakdown（工項劃分），並落成一份能讓多人協作、逐項權責畫押（RACI sign-off）的 Excel。**

## Solution

在既有四步管線後**向後新增兩個 step skill**，延續「一步一 skill、狀態靠檔案交接、步間有 checkpoint」的既有架構（見 ADR-0001）：

1. **`f2w-breakdown`（第五步）**：讀 `output/<project>/workflow.json`，由 AI 以逐頁 Workflow description 為據，把每個 Page 拆成**前端 Work item**（觀察自畫面）與**後端 Work item**（AI 從前端操作**推論**、標為「推論·待確認」）。組裝驗證後產出宣告式逃生口 `output/<project>/workitems.json`。

2. **`f2w-breakdown-export`（第六步）**：讀 `workitems.json`，確定性地組裝出 `output/<project>/workitems.xlsx`——一份含三個 sheet（概述／前端工項／後端工項）、且**畫押欄留白**的**範本（Template workbook）**。

交付物 `workitems.xlsx` 每列是一筆 Work item，內容型欄位由 AI 填好，承諾型欄位（估時、優先級、RACI、狀態、簽核）留白，交給人在**工作副本（Working copy）**上填定與簽核。重跑只覆蓋範本、不動工作副本。

後端工項為 AI 推論、刻意打破 Pure-frontend 地基的決定，見 ADR-0002。

## User Stories

1. 身為專案負責人，我想從既有的 `workflow.json` 一鍵產出前端＋後端的 Work breakdown，這樣我不必人工重拆就能開始分工。
2. 身為前端工程師，我想看到每個 Page 對應到哪些前端 Work item，這樣我知道這頁具體要做哪些事。
3. 身為前端工程師，我想每個前端 Work item 都標出它錨定的來源 Page，這樣我能回頭對照畫面確認範疇。
4. 身為後端工程師，我想看到由前端操作推論出的後端 Work item 草稿，這樣即使沒有後端規格我也有一份起點。
5. 身為後端工程師，我想每一筆後端 Work item 都清楚標為「推論·待確認」，這樣我知道開工前必須先跟需求方確認、不能照單全收。
6. 身為專案負責人，我想每個 Page 至少產出一筆前端 Work item，這樣沒有畫面會被漏掉不分工。
7. 身為團隊成員，我想每筆 Work item 都有唯一的工項 ID，這樣我們在討論與追蹤時能明確指涉某一筆。
8. 身為團隊成員，我想 Work item 之間能標記依賴關係，這樣我知道哪些工項要先做、排程時不會卡住。
9. 身為專案負責人，我想在交付的 Excel 上為每筆 Work item 填 RACI（A 當責、R 負責、C 諮詢、I 告知），這樣多人協作時權責分明。
10. 身為專案負責人，我想「A 當責」限定為單一人、「R 負責」可為多人，這樣責任歸屬不模糊、但執行可分擔。
11. 身為團隊成員，我想在 Excel 上填估時與優先級，這樣我們能據以排程與取捨。
12. 身為團隊成員，我想在 Excel 上記錄每筆 Work item 的狀態（未開始／進行中／審查中／完成／擱置），這樣進度一目了然。
13. 身為簽核者，我想每筆 Work item 有簽核日期欄，這樣權責畫押有明確的時間憑證。
14. 身為使用者，我想 AI 只填「內容型」欄位（標題、範疇、驗收標準、依賴），不代填「承諾型」欄位（估時、優先級、RACI、狀態、簽核），這樣機器不替人做承諾、責任落在人身上。
15. 身為專案負責人，我想 Excel 的「概述」sheet 呈現整體 Overview 加上工項統計（前端／後端筆數、推論筆數），這樣我開會時能快速說明全貌。
16. 身為使用者，我想「概述」sheet 附上 RACI 與狀態的圖例說明，這樣填表的人不必另外問規則。
17. 身為使用者，我想前端工項與後端工項分成兩個 sheet，這樣兩個角色各看各的、不互相干擾。
18. 身為後端工程師，我想後端工項 sheet 比前端多一欄「推論狀態」，這樣「推論·待確認」的旗標在表上顯眼、不會被忽略。
19. 身為使用者，我想 `workitems.xlsx` 是畫押欄留白的範本、可被重跑覆蓋，這樣上游描述更新後我能重新產生最新版。
20. 身為使用者，我想自己另存一份工作副本來填畫押值，且重跑只覆蓋範本、不動我的工作副本，這樣我填好的 RACI 與簽核不會被重跑洗掉。
21. 身為使用者，當我在還沒有 `workflow.json` 時就跑 `f2w-breakdown`，我想得到清楚提示「請先跑 f2w-describe」，這樣我知道下一步該做什麼。
22. 身為使用者，當我在還沒有 `workitems.json` 時就跑 `f2w-breakdown-export`，我想得到清楚提示「請先跑 f2w-breakdown」，這樣管線順序不會錯。
23. 身為使用者，當 AI 產出的工項有問題（範疇抓錯、漏拆、依賴指錯）時，我想直接手改 `workitems.json` 再重跑 export，這樣我有一個宣告式逃生口不必重跑 AI。
24. 身為維護者，我想 `workitems.json` 若不合契約（ID 重複、`dependsOn` 懸空、`sourcePage` 不存在、後端未標 `inferred`）就在保存前擋下並報錯，這樣落地的檔案永遠是合法的。
25. 身為維護者，我想 `f2w-breakdown` 的組裝核心與 export 的組裝核心都是不碰檔案的純函式，這樣它們能被獨立單元測試。
26. 身為新加入的開發者，我想 `frontend-to-workflow` 總說明 skill 把管線從四步更新成六步，這樣我一眼看懂新增了哪兩步、各吃什麼吐什麼。
27. 身為使用者，我想每筆 Work item 有風險備註欄，這樣推論的不確定性或已知風險能被記下來。

## Implementation Decisions

**新增／修改的模組**

- **新契約 `src/contracts/workitems.ts`**：定義 `workitems.json` 的 zod schema 與 `parseWorkitems` / `loadWorkitems`，比照 `workflow.ts`。`workitems.json` 只承載 AI 推論的**內容型**資料，**不含**承諾型欄位（RACI／估時／優先級／狀態／簽核只存在於人的工作副本，不進 json）。schema 形狀：

  ```
  workitems = {
    project: string,
    frontend: WorkItem[],   // 每筆 inferred 省略或為 false
    backend:  WorkItem[],   // 每筆 inferred === true
  }
  WorkItem = {
    id: string,             // 全域唯一（跨 frontend + backend）
    sourcePage: PageId,     // route + 可選 tab；須存在於 workflow.pages
    title: string,          // 內容型，AI 填
    scope: string,          // 範疇，內容型，AI 填
    acceptance: string,     // 驗收標準，內容型，AI 填
    dependsOn: string[],    // 指向其它 WorkItem.id，不得懸空
    risk: string,           // 風險備註（可空字串）
    inferred: boolean,      // 後端一律 true；前端 false
  }
  ```
  （以上型別形狀源自本次 grilling 的定案，非可執行程式碼。）

- **新模組 `src/breakdown/`**（比照 `src/describe/`）：
  - `loadWorkflowForBreakdown`（或複用 `loadWorkflow` + 前置檢查）：確認 `workflow.json` 在，缺則丟 `MissingPrerequisiteError` 提示先跑 f2w-describe。
  - `buildWorkitems(workflow, frontendDescriptions, backendDescriptions)`：**確定性組裝核心**，不碰 fs。五重把關：(a) **涵蓋**——`workflow.pages` 的每個 Page 至少對應一筆前端 Work item；(b) **ID 唯一**——跨 frontend＋backend 全域唯一；(c) **`sourcePage` 存在**——每筆的 `sourcePage` 必須是 `workflow.pages` 內存在的 Page；(d) **`dependsOn` 不懸空**——每個依賴的 id 必須存在於本批 Work item；(e) **後端 `inferred`**——backend 每筆 `inferred === true`。涵蓋／參照類不符丟 `WorkitemsConsistencyError`；不合契約（空 title 等、ID 唯一性）冒泡 `ContractValidationError`。
  - `saveWorkitems(outputRoot, project, workitems)`：通過契約驗證才寫 `output/<project>/workitems.json`，失敗不落地。

- **新模組 `src/export`（workitems 版）**：`buildWorkitemsWorkbook(workitems)` 確定性核心 + `saveWorkitemsWorkbook`。三個 sheet：
  - **概述**：Overview 敘述（若 `workitems.json` 不帶 overview，則放專案名＋統計）＋工項統計（前端筆數／後端筆數／推論筆數）＋ RACI 與狀態的圖例說明。
  - **前端工項**：每列一筆前端 Work item。欄位＝`工項ID｜來源Page｜標題｜範疇｜驗收標準｜依賴`（AI 填）＋`估時｜優先級｜R｜A｜C｜I｜簽核日期｜狀態`（留白，供人畫押）＋`風險備註`。
  - **後端工項**：同前端，額外一欄「推論狀態」（顯示「推論·待確認」）。
  - **不嵌截圖**（與 `f2w-export` 的 Workbook 不同，工項表不放縮圖）。

- **`src/output.ts` 擴充**：`CONTRACT_FILES` 增 `workitems: "workitems.json"` 與 `workitemsWorkbook: "workitems.xlsx"`；`CONTRACT_PRODUCER` 增 `workitems: "f2w-breakdown"`、`workitemsWorkbook: "f2w-breakdown-export"`。既有四個 entry 不動。

- **兩個新 SKILL.md**：`.claude/skills/f2w-breakdown/SKILL.md`、`.claude/skills/f2w-breakdown-export/SKILL.md`，比照 `f2w-describe`／`f2w-export` 的體例（前置／產出／假設／流程／逃生口／對應實作）。

- **`frontend-to-workflow` 總說明 skill**：四步表擴成六步。

**架構決定**

- 延續 ADR-0001：新 step = 新 f2w-* skill，不自動串接、步間走 checkpoint、狀態靠 `output/<project>/` 檔案交接。
- 延續既有「AI 判斷與確定性組裝分離」：AI 產描述（不可測），`buildWorkitems`／`buildWorkitemsWorkbook` 做確定性組裝＋驗證（可測）。
- 承接 ADR-0002：後端工項為 AI 推論、標 `inferred: true`／「推論·待確認」；正確性責任在開工前的人工確認。
- **範本／工作副本分離**：`workitems.xlsx` 為留白範本、可重跑覆蓋；承諾型畫押值只存在人另存的工作副本，故不進 `workitems.json`、重跑不觸及工作副本。

**預設值**（寫入圖例與 skill 文件）

- 估時單位：人天（person-days）。
- 優先級：P0／P1／P2。
- 狀態：未開始／進行中／審查中／完成／擱置。
- RACI：A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知。

**缺前置行為**

- `f2w-breakdown` 缺 `workflow.json` → `MissingPrerequisiteError`，提示先跑 f2w-describe，中止。
- `f2w-breakdown-export` 缺 `workitems.json` → `MissingPrerequisiteError`，提示先跑 f2w-breakdown，中止。

## Testing Decisions

好的測試只驗**外部行為**，不綁實作細節：驗 `workitems.json` 契約、驗 workbook 的 sheet 結構與欄位、驗缺前置的錯誤型別，而非內部私有函式。**AI 推論本身不測**（同 `f2w-describe` 逐頁描述＝Claude 判斷，無法單元測試）；測的是它下游的確定性組裝與驗證。

測試的模組與其**最高 seam**（與使用者確認採「照抄現有 f2w-describe／f2w-export 的確定性核心 seam」）：

- **`buildWorkitems`（主 seam，一個點擋掉全部 invariant）**：以記憶體物件直接驗五重把關——每頁≥1 前端工項（涵蓋）、ID 全域唯一、`sourcePage` 存在、`dependsOn` 不懸空、後端 `inferred:true`；違反各自丟 `WorkitemsConsistencyError` 或 `ContractValidationError`。**Prior art**：`src/describe/buildWorkflow.test.ts`（涵蓋／去向／契約三把關，逐案 `toThrow`）。
- **`buildWorkitemsWorkbook`**：驗三個 sheet 存在、前端／後端每列對應一筆 Work item、承諾型欄位留白（表頭在、值空）、後端 sheet 有「推論狀態」欄且顯示「推論·待確認」、概述 sheet 含統計與圖例、不含嵌入圖片。**Prior art**：`src/export/buildWorkbook.test.ts`（sheet 定義、每列一 Page、`getImages()` 計數、一致性錯誤）。
- **`saveWorkitems` / `saveWorkitemsWorkbook`（round-trip）**：寫出後能被 `loadWorkitems` / ExcelJS 讀回；不合契約時丟 `ContractValidationError` 且不落地任何檔案。**Prior art**：`buildWorkflow.test.ts` 的 `saveWorkflow`、`buildWorkbook.test.ts` 的 `saveWorkbook`。
- **契約 `workitems.ts`**：ID 唯一性、空欄位等契約規則（可比照 `src/contracts/workflow.test.ts` 直接測 schema，或隨 `buildWorkitems` 冒泡）。**Prior art**：`src/contracts/workflow.test.ts`。
- **缺前置**：`loadWorkflowForBreakdown` 缺 `workflow.json`、`loadWorkitems` 缺 `workitems.json` 各丟 `MissingPrerequisiteError`。**Prior art**：`src/prerequisites.test.ts`、各 step 的 `inputs.test.ts`。
- **端到端（真實 fixtures）**：以 `fixtures/contracts/workflow.json` 跑 `buildWorkitems`（需先有一批合法的 frontend／backend 描述作輸入樣本）→ 組裝 → `buildWorkitemsWorkbook` → 寫出可讀回的 `workitems.xlsx`。**Prior art**：`buildWorkbook.test.ts` 的「端到端（真實 fixtures）」段。

測試框架沿用 `vitest`；Excel 讀回驗證沿用 `exceljs`。

## Out of Scope

- **不自動串接**：`f2w-breakdown` 不自動觸發 `f2w-breakdown-export`；沿用管線既有的手動、有 checkpoint 的節奏。
- **不吃後端輸入檔**：本版不接受使用者提供的後端規格／API 清單；後端工項一律 AI 推論。ADR-0002 已把「另吃一份後端輸入」列為未來擴充點。
- **AI 不代填承諾型欄位**：估時、優先級、RACI、狀態、簽核一律留白由人填；不做自動估時或自動指派。
- **不嵌截圖**：工項表不放縮圖。
- **不動既有四步**：`f2w-start`／`f2w-capture`／`f2w-describe`／`f2w-export` 的行為與檔案不變；Pure-frontend 假設仍適用於這四步（documentation 管線）。
- **不改 `workflow.json` 契約**：新功能只讀它、不擴充它。
- **工作副本的合併／版本控管不做**：範本重跑後如何把新工項併回已填的工作副本，屬人工流程，本版不提供工具輔助。

## Further Notes

- 本 spec 源自一次 `/grill-with-docs`（grilling ＋ domain-modeling）session，域決策已落地：`CONTEXT.md` 新增五條詞彙（Work item、Work breakdown、Inferred work item、權責畫押、範本／工作副本），`docs/adr/0002-backend-workitems-are-ai-inferred.md` 記錄打破 Pure-frontend 的取捨。實作務必沿用這套 ubiquitous language。
- 命名沿用管線慣例：`workitems.json`（宣告式逃生口）、`workitems.xlsx`（最終交付範本）、`build*`／`save*`／`load*` 函式命名、`*ConsistencyError`／`ContractValidationError`／`MissingPrerequisiteError` 錯誤型別。
- 交付 Excel 的中文欄名與圖例文字，最終以 skill 文件與範本實作為準；本 spec 給的是欄位集合與語義，不是像素級版面。

## Implementation issues

- [`issues/01-f2w-breakdown-workitems-json.md`](issues/01-f2w-breakdown-workitems-json.md) — f2w-breakdown → workitems.json（前端＋後端工項劃分，含契約與五重把關） (closed, originally #20)
- [`issues/02-f2w-breakdown-export-xlsx.md`](issues/02-f2w-breakdown-export-xlsx.md) — f2w-breakdown-export → workitems.xlsx（三 sheet、RACI 畫押欄留白範本） (closed, originally #21)
- [`issues/03-pipeline-overview-six-steps.md`](issues/03-pipeline-overview-six-steps.md) — 六步管線總說明更新（frontend-to-workflow skill 四步→六步） (closed, originally #22)
