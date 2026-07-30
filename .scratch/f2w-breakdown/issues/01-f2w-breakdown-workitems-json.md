# f2w-breakdown → workitems.json（前端＋後端工項劃分，含契約與五重把關）

State: closed
Status: ready-for-agent
Created: 2026-07-17
Closed: 2026-07-17
Author: Anuise
Origin: GitHub issue #20 — https://github.com/Anuise/frontend-to-workflow/issues/20
Parent: ../spec.md (originally #19)

## What to build

新增 `f2w-breakdown`（管線第五步）：讀 `output/<project>/workflow.json`，由 AI 以逐頁 Workflow description 為據，把每個 Page 拆成前端 Work item（觀察自畫面）與後端 Work item（AI 從前端操作推論、`inferred: true`），組裝驗證後寫出宣告式逃生口 `output/<project>/workitems.json`。

跑完這票，使用者能對一個已有 `workflow.json` 的 Project 執行 f2w-breakdown，得到一份通過契約與一致性驗證的 `workitems.json`；描述抓錯時可直接手改該檔。

先做 prefactor（`output.ts` 契約檔登記）再做主體。

## Acceptance criteria

- [ ] `src/output.ts`：`CONTRACT_FILES` 新增 `workitems: "workitems.json"` 與 `workitemsWorkbook: "workitems.xlsx"`；`CONTRACT_PRODUCER` 新增 `workitems: "f2w-breakdown"`、`workitemsWorkbook: "f2w-breakdown-export"`；既有四個 entry 不動
- [ ] 新契約 `src/contracts/workitems.ts`：zod schema（`{ project, frontend: WorkItem[], backend: WorkItem[] }`，`WorkItem = { id, sourcePage: PageId, title, scope, acceptance, dependsOn: string[], risk, inferred }`）＋ `parseWorkitems` / `loadWorkitems`，比照 `workflow.ts`
- [ ] `buildWorkitems(workflow, frontendItems, backendItems)` 確定性核心（不碰 fs）五重把關：每個 `workflow.pages` 至少一筆前端 Work item（涵蓋）、ID 跨 frontend＋backend 全域唯一、每筆 `sourcePage` 存在於 `workflow.pages`、`dependsOn` 每個 id 存在於本批、backend 每筆 `inferred === true`
- [ ] 涵蓋／參照類違反丟 `WorkitemsConsistencyError`；契約類（空欄位、ID 唯一）冒泡 `ContractValidationError`
- [ ] `saveWorkitems(outputRoot, project, workitems)` 通過契約驗證才寫 `output/<project>/workitems.json`；驗證失敗不落地
- [ ] 缺 `workflow.json` 的前置檢查丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，中止
- [ ] `.claude/skills/f2w-breakdown/SKILL.md`：比照 f2w-describe 體例（前置／產出／假設／流程／逃生口／對應實作），說明後端工項為推論·待確認、承諾型欄位不進 json
- [ ] 測試（vitest）：`buildWorkitems` 逐 invariant `toThrow`、`saveWorkitems` round-trip 可被 `loadWorkitems` 讀回且不合契約不落地、缺前置 `MissingPrerequisiteError`、以 `fixtures/contracts/workflow.json` 的真檔 e2e
- [ ] 沿用 CONTEXT.md 詞彙與 ADR-0001／0002 決策；不修改 `workflow.json` 契約

## Blocked by

- None — can start immediately
