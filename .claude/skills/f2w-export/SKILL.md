---
name: f2w-export
description: frontend-to-workflow 管線的第四步（最後一步）。讀取 workflow.json、pages.json 與 screenshots/，組裝出 Workbook workflow.xlsx：含「概述」sheet（放 Overview）與「逐頁工作流程」sheet（每列一個 Page，含 Workflow description 且嵌入該頁截圖縮圖）。缺前置檔時提示先跑上一步。Use when the user wants to run f2w-export, assemble the workflow workbook, or produce workflow.xlsx for the frontend-to-workflow pipeline.
---

# f2w-export：組裝 Workbook（workflow.xlsx）

管線四步的第四步（最後一步）。讀取 f2w-describe 的產出 `output/<project>/workflow.json`（Overview 與逐頁 Workflow description）、f2w-capture 的 `output/<project>/pages.json`（Page → 截圖檔名對應）與 `output/<project>/screenshots/`，組裝出最終交付物 `output/<project>/workflow.xlsx`：含「概述」與「逐頁工作流程」兩個 sheet，逐頁列出描述並嵌入截圖縮圖。

前置：`output/<project>/workflow.json`（f2w-describe 產出）、`output/<project>/pages.json` 與 `output/<project>/screenshots/`（f2w-capture 產出）。缺 `workflow.json` 中止並提示先跑 f2w-describe；缺 `pages.json` 或 `screenshots/`（含個別截圖檔）中止並提示先跑 f2w-capture。
產出：`output/<project>/workflow.xlsx`。
假設：**純前端**，無後端、無登入。截圖照 f2w-capture 截到的實際樣貌嵌入（含空資料／錯誤狀態）。

**為何要讀 `pages.json`**：`workflow.json` 逐頁只帶 route/tab 與描述，**不含截圖檔名**（截圖檔名由 f2w-capture 任意指派、只存在 `pages.json`）。要讓每列嵌入正確的縮圖，就得以 `pages.json` 的 Page → screenshot 對應（單一真實來源）把每個 Page 對回它的截圖檔。

## 流程

1. **讀取前置** — `loadDescribedWorkflow(outputRoot, project)`
   - 確認 `workflow.json`、`pages.json`、`screenshots/` 皆在，讀回並驗證後回傳 `workflow` 與「Page → 截圖影像」對應（key 為 Page 識別，值為截圖位元組＋副檔名）。
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`（提示先跑 f2w-describe）；缺 `pages.json`／`screenshots/`／個別截圖檔丟 `MissingPrerequisiteError`（提示先跑 f2w-capture）。任一缺件即**中止**。
2. **組裝 Workbook** — `buildWorkbook(workflow, screenshots)`（確定性核心）
   - 「概述」sheet：呈現 Overview。
   - 「逐頁工作流程」sheet：標頭列 + 每個 Page 一列（Page 識別、用途、主要內容、可執行操作），並在該列嵌入該頁截圖縮圖。
   - 某 Page 在對應表裡找不到截圖即丟 `WorkbookConsistencyError`（描述與截圖不一致）。此函式不碰檔案，可獨立單元測試。
3. **保存** — `saveWorkbook(outputRoot, project, workbook)`
   - 把組好的 Workbook 寫成 `output/<project>/workflow.xlsx`，回傳寫入路徑。

## 逃生口

`workflow.xlsx` 是**最終交付物**、不是交接檔，不預期手改。內容不對時回頭改上游的宣告式檔案再重跑本步：描述文字或 Overview 改 `workflow.json`；Page → 截圖對應改 `pages.json`（並補／換 `screenshots/` 下對應檔）。

## 對應實作

`src/export/`：`loadDescribedWorkflow`（前置檢查＋讀回 workflow/pages/截圖位元組）、`buildWorkbook`（組出兩個 sheet 並逐列嵌入縮圖的確定性核心）、`saveWorkbook`（寫出 workflow.xlsx）。契約見 `src/contracts/workflow.ts`、`src/contracts/pages.ts`；路徑見 `src/output.ts`（`contractPath`、`screenshotsPath`）。Excel 產生使用 `exceljs`。
