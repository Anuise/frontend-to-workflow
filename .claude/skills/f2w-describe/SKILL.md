---
name: f2w-describe
description: frontend-to-workflow 管線的第三步。讀取 pages.json 與 screenshots/，以使用者視角為每個 Page 產出 Workflow description（頁面用途、主要內容、可執行操作、每個操作的操作去向）與一段跨頁 Overview，寫入 workflow.json。缺前置檔時提示先跑 f2w-capture。Use when the user wants to run f2w-describe, describe captured pages, or produce workflow.json for the frontend-to-workflow pipeline.
---

# f2w-describe：逐頁工作流程描述

管線四步的第三步。讀取 f2w-capture 的產出（`output/<project>/pages.json` 與 `output/<project>/screenshots/`），以**使用者視角**為每個 **Page** 寫一段 **Workflow description**（頁面用途、主要內容、可執行操作、每個操作的**操作去向**），並另外寫一段跨所有 Page 的 **Overview**，組裝驗證後產出 `output/<project>/workflow.json`，交給後續 `f2w-export`。

前置：`output/<project>/pages.json` 與 `output/<project>/screenshots/`（由 f2w-capture 產出）。任一缺件即中止並提示先跑 f2w-capture。
產出：`output/<project>/workflow.json`。
假設：**純前端**，無後端、無登入。某頁因無後端而呈空資料／錯誤狀態時，照該截圖實際樣貌描述。

## 流程

1. **讀取前置** — `loadCapturedPages(outputRoot, project)`
   - 回傳 `Pages`（每個 Page 的 route／tab 與對應截圖檔名）。缺 `pages.json` 或缺 `screenshots/` 會丟 `MissingPrerequisiteError`，提示先跑 f2w-capture，**中止**。
2. **逐 Page 描述**（看截圖寫，以使用者視角、**繁體中文**）
   - 對 `pages.json` 列出的**每一個** Page，開啟對應的 `screenshots/<screenshot>` 看畫面，寫出：
     - **purpose**（頁面用途）：這頁對使用者是做什麼的。
     - **content**（主要內容）：畫面上主要有什麼。
     - **actions**（可執行操作清單）：每個操作是一組 `label`（操作說明）＋ `destination`（**操作去向**）。
   - **操作去向 destination**：這個操作會前往哪一個 Page，寫成該 Page 的識別（`route` +（可選）`tab`），且必須是 `pages.json` 裡已列出的 Page；若操作不換頁（停留原頁，如捲動、填欄位）則寫 `null`。
3. **寫 Overview**
   - 跨所有 Page 寫一段整體使用者流程的總覽敘述，**獨立於**逐頁描述。
4. **組裝並驗證** — `buildWorkflow(pages, overview, descriptions)`
   - 三重把關：**涵蓋**（描述與截到的 Page 一一對應，漏頁／多頁／重複皆擋）、**操作去向**（每個非 null 的 destination 必須指向 `pages.json` 內存在的 Page）、**契約**（overview／purpose／label 非空、Page 識別唯一）。route／tab 一律取自 `pages.json`（單一真實來源）。
   - 涵蓋或去向不符丟 `WorkflowConsistencyError`；不合契約丟 `ContractValidationError`。
5. **保存** — `saveWorkflow(outputRoot, project, workflow)`
   - 通過契約驗證才寫 `output/<project>/workflow.json`；驗證失敗丟 `ContractValidationError` 且不落地。

## 逃生口

`workflow.json` 是宣告式逃生口：描述不準、漏頁或操作去向抓錯時，直接手改該檔（增刪 Page、改 purpose／content／actions、改 destination），符合契約即可交給下一步。若是**漏頁**（f2w-capture 的已知盲點，如 hash routing、非 `<a>` 導覽），先回頭手改 `pages.json` 補上該 Page 並補對應 `screenshots/`，再重跑本步。

## 對應實作

`src/describe/`：`loadCapturedPages`（前置檢查＋讀回 pages.json）、`buildWorkflow`（涵蓋＋操作去向＋契約三重把關的組裝核心）、`saveWorkflow`（驗證後保存）。契約見 `src/contracts/workflow.ts`；路徑見 `src/output.ts`（`contractPath`、`screenshotsPath`）。
