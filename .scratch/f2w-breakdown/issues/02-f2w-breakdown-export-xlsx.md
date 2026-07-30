# f2w-breakdown-export → workitems.xlsx（三 sheet、RACI 畫押欄留白範本）

State: closed
Status: ready-for-agent
Created: 2026-07-17
Closed: 2026-07-17
Author: Anuise
Origin: GitHub issue #21 — https://github.com/Anuise/frontend-to-workflow/issues/21
Parent: ../spec.md (originally #19)

## What to build

新增 `f2w-breakdown-export`（管線第六步、最後一步）：讀 `output/<project>/workitems.json`，確定性地組裝出最終交付範本 `output/<project>/workitems.xlsx`——含三個 sheet、且畫押欄留白的 Template workbook。

跑完這票，使用者能對一個已有 `workitems.json` 的 Project 執行 f2w-breakdown-export，得到一份可交給多人協作、逐項權責畫押的 Excel；上游更新後重跑只覆蓋範本、由人另存工作副本填畫押值。

## Acceptance criteria

- [ ] `buildWorkitemsWorkbook(workitems)` 確定性核心（不碰 fs）產三個 sheet：概述、前端工項、後端工項
- [ ] 概述 sheet：整體敘述＋工項統計（前端筆數／後端筆數／推論筆數）＋ RACI（A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知）與狀態（未開始／進行中／審查中／完成／擱置）圖例；估時單位人天、優先級 P0／P1／P2
- [ ] 前端工項 sheet：每列一筆前端 Work item；欄位＝工項ID｜來源Page｜標題｜範疇｜驗收標準｜依賴（AI 填）＋估時｜優先級｜R｜A｜C｜I｜簽核日期｜狀態（留白：表頭在、值空）＋風險備註
- [ ] 後端工項 sheet：同前端，額外一欄「推論狀態」顯示「推論·待確認」
- [ ] 不嵌截圖（工項表不放縮圖）
- [ ] load inputs 缺 `workitems.json` 丟 `MissingPrerequisiteError`，提示先跑 f2w-breakdown，中止
- [ ] `saveWorkitemsWorkbook(outputRoot, project, workbook)` 寫出 `output/<project>/workitems.xlsx`，可被 ExcelJS 讀回
- [ ] `.claude/skills/f2w-breakdown-export/SKILL.md`：比照 f2w-export 體例，說明範本／工作副本分離、逃生口回改 `workitems.json`
- [ ] 測試（vitest）：三 sheet 存在、每列對應一筆 Work item、承諾型欄留白、後端「推論狀態」欄、概述統計與圖例、無嵌入圖片、save round-trip 讀得回、缺前置 `MissingPrerequisiteError`、真檔 e2e
- [ ] 沿用 CONTEXT.md 詞彙與 ADR-0002 決策

## Blocked by

- #20（f2w-breakdown → workitems.json）：需其 `workitems.ts` 契約與一份真 `workitems.json` 做 e2e
