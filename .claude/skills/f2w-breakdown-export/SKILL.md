---
name: f2w-breakdown-export
description: frontend-to-workflow 管線的第六步（最後一步）。讀取 workitems.json，確定性地組裝出最終交付範本 workitems.xlsx：含「概述」「前端工項」「後端工項」三個 sheet，承諾型畫押欄（估時／優先級／RACI／簽核日期／狀態）留白的 Template workbook；後端工項多一欄「推論狀態」標「推論·待確認」。不嵌截圖。缺前置檔時提示先跑 f2w-breakdown。Use when the user wants to run f2w-breakdown-export, assemble the workitems workbook, or produce workitems.xlsx for the frontend-to-workflow pipeline.
---

# f2w-breakdown-export：組裝工項範本（workitems.xlsx）

管線六步的第六步（最後一步）。讀取 f2w-breakdown 的產出 `output/<project>/workitems.json`（前端／後端 Work item 的內容型欄位），確定性地組裝出最終交付範本 `output/<project>/workitems.xlsx`：含「概述」「前端工項」「後端工項」三個 sheet，且**權責畫押欄留白**的 **Template workbook（範本）**。跑完這票，使用者能對一個已有 `workitems.json` 的 Project 得到一份可交給多人協作、逐項權責畫押的 Excel。

前置：`output/<project>/workitems.json`（由 f2w-breakdown 產出）。缺件即中止並提示先跑 f2w-breakdown。
產出：`output/<project>/workitems.xlsx`。

> **可選 f2w-sourcing 的接法（規劃中，隨 f2w-sourcing 實作）**：若可選插入步 `f2w-sourcing` 已跑、`output/<project>/workitems-sourced.json` 存在，本步**優先讀 sourced 檔**、不在才退回 `workitems.json`（見 ADR-0004）。讀到 sourced 檔時，「後端工項」sheet 額外呈現來源決策欄：`sourcing`（四桶）｜`adaptationRole`（fetch／process）｜`vendor`｜`vendorEndpoints`｜「來源狀態」（`sourcingConfirmed=false` 顯示「配對·待確認」）。純自建專案沒有 sourced 檔，行為與現況一致。
假設：沿用 ADR-0002——後端 Work item 一律是 AI 推論的 **Inferred work item**，在「後端工項」sheet 以「推論狀態＝推論·待確認」明示，開工前的正確性責任落在人工確認。

**為何畫押欄留白**：估時／優先級／RACI／簽核日期／狀態是多人協作的**承諾型**權責畫押值，不由 AI 代填、也不進 `workitems.json`（見 f2w-breakdown 與 CONTEXT.md「權責畫押」「範本／工作副本」）。本步只出**表頭在、值空**的範本；畫押值由人在另存的**工作副本（Working copy）**填。

## 流程

1. **讀取前置** — `loadWorkitemsForExport(outputRoot, project)`
   - 確認 `workitems.json` 在，讀回並經契約驗證後回傳 `Workitems`（前端／後端 Work item）。
   - 缺 `workitems.json` 丟 `MissingPrerequisiteError`（提示先跑 f2w-breakdown），**中止**。
2. **組裝 Workbook** — `buildWorkitemsWorkbook(workitems)`（確定性核心，不碰 fs、不嵌截圖）
   - 「概述」sheet：整體敘述 ＋ 工項統計（前端筆數／後端筆數／推論筆數）＋ RACI 圖例（A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知）、狀態圖例（未開始／進行中／審查中／完成／擱置）、估時單位（人天）與優先級（P0／P1／P2）。
   - 「前端工項」sheet：每列一筆前端 Work item。AI 內容型欄填值：工項ID｜來源Page｜標題｜範疇｜驗收標準｜依賴｜風險備註；承諾型欄留白：估時｜優先級｜R｜A｜C｜I｜簽核日期｜狀態。
   - 「後端工項」sheet：欄位同前端，額外一欄「推論狀態」一律顯示「推論·待確認」。
   - 此函式不碰檔案，可獨立單元測試。
3. **保存** — `saveWorkitemsWorkbook(outputRoot, project, workbook)`
   - 把組好的 Workbook 寫成 `output/<project>/workitems.xlsx`，回傳寫入路徑。

## 逃生口

`workitems.xlsx` 是**範本**、可被重跑覆蓋，不預期直接手改：內容不對時回頭改上游宣告式檔案 `workitems.json`（增刪工項、改 title／scope／acceptance／dependsOn、調整前端／後端歸屬）再重跑本步。人須**另存一份工作副本**填畫押值——上游更新後重跑只覆蓋範本、不動工作副本。若問題出在更上游的頁面描述，先回頭改 `workflow.json` 或重跑 f2w-describe／f2w-breakdown。

## 對應實作

`src/breakdown-export/`：`loadWorkitemsForExport`（前置檢查＋讀回 workitems.json）、`buildWorkitemsWorkbook`（組出三個 sheet、承諾型欄留白、後端加「推論狀態」欄的確定性核心）、`saveWorkitemsWorkbook`（寫出 workitems.xlsx）。契約見 `src/contracts/workitems.ts`；路徑見 `src/output.ts`（`contractPath`，契約名 `workitemsWorkbook`＝`workitems.xlsx`）。決策見 ADR-0002（後端工項為 AI 推論）。Excel 產生使用 `exceljs`。
