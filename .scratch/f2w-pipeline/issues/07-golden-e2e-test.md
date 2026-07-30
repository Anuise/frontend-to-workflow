# f2w：黃金端對端測試

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-21
Author: Anuise
Origin: GitHub issue #11 — https://github.com/Anuise/frontend-to-workflow/issues/11
Parent: ../spec.md (originally #4)

## What to build

建立黃金端對端測試：對 repo 內建的 sample 純前端 fixture project，依序跑完 `f2w-start` → `f2w-capture` → `f2w-describe` → `f2w-export`，斷言最終 `workflow.xlsx` 具備「概述」「逐頁工作流程」兩個 sheet 且逐頁含縮圖。作為整條管線串接的回歸守門。

## Acceptance criteria

- [ ] 對 sample project 能一路跑到產出 `workflow.xlsx`。
- [ ] 斷言最終 Workbook 的兩個 sheet 與逐頁縮圖。
- [ ] 測試可重複執行並穩定通過（截圖／LLM 步驟以最小穩定 fixture 控制波動）。

## Blocked by

- `f2w-start` / `f2w-capture` / `f2w-describe` / `f2w-export` 四張 step ticket。
