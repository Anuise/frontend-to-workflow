---
name: f2w-export
description: frontend-to-workflow 管線的第四步。讀取 workflow.json、pages.json 與 screenshots/，組裝出 Workbook workflow-<年月日-時分秒>.xlsx（如 workflow-20260803-153012.xlsx）：含「概述」sheet（放 Overview）與「逐頁工作流程」sheet（每列一個 Page，含 Workflow description 且嵌入該頁截圖縮圖）。檔名帶時戳，每次重跑各留一份、不覆蓋舊檔。缺前置檔時提示先跑上一步。Use when the user wants to run f2w-export, assemble the workflow workbook, or produce a timestamped workflow xlsx for the frontend-to-workflow pipeline.
---

# f2w-export：組裝 Workbook（workflow-<年月日-時分秒>.xlsx）

管線的第四步。讀取 f2w-describe 的產出 `output/<project>/workflow.json`（Overview 與逐頁 Workflow description，新版每頁含 `screenshot` 截圖來源）、f2w-capture 的 `output/<project>/pages.json`（Page → 截圖檔名對應）與 `output/<project>/screenshots/`，組裝出交付物 `output/<project>/workflow-<YYYYMMDD-HHmmss>.xlsx`：含「概述」與「逐頁工作流程」兩個 sheet，逐頁列出描述並嵌入截圖縮圖。

前置：`output/<project>/workflow.json`（f2w-describe 產出）、`output/<project>/pages.json` 與 `output/<project>/screenshots/`（f2w-capture 產出）。缺 `workflow.json` 中止並提示先跑 f2w-describe；缺 `pages.json` 或 `screenshots/`（含個別截圖檔）中止並提示先跑 f2w-capture。
產出：`output/<project>/workflow-<YYYYMMDD-HHmmss>.xlsx`（時戳＝寫檔當下的**本地**年月日時分秒，如 `workflow-20260803-153012.xlsx`）。每次重跑各留一份、**不覆蓋**舊檔；要最新的一份就取時戳最大的（檔名可直接字典序排序）。
假設：**純前端**，無後端、無登入。截圖照 f2w-capture 截到的實際樣貌嵌入（含空資料／錯誤狀態）。

**為何仍要讀 `pages.json`**：新版 `workflow.json` 每頁會保留 `screenshot`，方便人工檢查；但 `pages.json` 仍是 f2w-capture 的截圖對應來源，也提供舊版 `workflow.json` 缺 `screenshot` 時的 fallback。`f2w-export` 必須讀兩者並用 Page 識別比對：Page 集合要一一對應，且 workflow 有 `screenshot` 時必須等於 pages 的 `screenshot`；不一致即中止。

## 流程

1. **讀取前置** — `loadDescribedWorkflow(outputRoot, project)`
   - 確認 `workflow.json`、`pages.json`、`screenshots/` 皆在，讀回並驗證後回傳 `workflow` 與「Page → 截圖影像」對應（key 為 Page 識別，值為截圖位元組＋副檔名）。
   - 先比對 `workflow.json` 與 `pages.json`：兩邊 Page 集合必須一致；若 workflow page 有 `screenshot`，必須與 pages entry 的 `screenshot` 相同。不一致丟 `ExportInputConsistencyError`，**中止**。
   - 嵌圖檔名優先取 `workflow.json.pages[].screenshot`；舊版 workflow 缺欄位時 fallback 到 `pages.json.pages[].screenshot`。
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`（提示先跑 f2w-describe）；缺 `pages.json`／`screenshots/`／個別截圖檔丟 `MissingPrerequisiteError`（提示先跑 f2w-capture）。任一缺件即**中止**。
2. **組裝 Workbook** — `buildWorkbook(workflow, screenshots)`（確定性核心）
   - 「概述」sheet：呈現 Overview。
   - 「逐頁工作流程」sheet：標頭列 + 每個 Page 一列（Page 識別、用途、主要內容、可執行操作），並在該列嵌入該頁截圖縮圖。
   - 某 Page 在對應表裡找不到截圖即丟 `WorkbookConsistencyError`（描述與截圖不一致）。此函式不碰檔案，可獨立單元測試。
3. **保存** — `saveWorkbook(outputRoot, project, workbook, at?)`
   - 把組好的 Workbook 寫成 `output/<project>/workflow-<YYYYMMDD-HHmmss>.xlsx`，回傳寫入路徑（含時戳，回報給使用者時照抄）。
   - `at` 省略時取寫檔當下的本地時間；可注入固定 `Date` 讓測試斷言檔名。

## 逃生口

產出的 xlsx 是**最終交付物**、不是交接檔，不預期手改。內容不對時回頭改上游的宣告式檔案再重跑本步：描述文字或 Overview 改 `workflow.json`；Page → 截圖對應改 `pages.json`（並補／換 `screenshots/` 下對應檔）。重跑產生的是**新一份帶時戳的檔**，舊檔原地留著——不再有「重跑覆蓋」這回事，要清舊檔由使用者自行決定。

## 對應實作

`src/export/`：`loadDescribedWorkflow`（前置檢查＋讀回 workflow/pages/截圖位元組）、`buildWorkbook`（組出兩個 sheet 並逐列嵌入縮圖的確定性核心）、`saveWorkbook`（寫出帶時戳的 workflow xlsx）。契約見 `src/contracts/workflow.ts`、`src/contracts/pages.ts`；路徑見 `src/output.ts`（前置檔讀取走 `contractPath`、`screenshotsPath`；交付物檔名走 `timestampedContractPath` 與 `timestampSuffix`，時戳格式 `YYYYMMDD-HHmmss` 的單一來源就在那裡）。Excel 產生使用 `exceljs`。
