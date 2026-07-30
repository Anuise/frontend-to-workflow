# f2w-export：組裝 Workbook（workflow.xlsx）

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-16
Author: Anuise
Origin: GitHub issue #9 — https://github.com/Anuise/frontend-to-workflow/issues/9
Parent: ../spec.md (originally #4)

## What to build

`f2w-export` 讀取 `workflow.json` 與 `screenshots/`，組裝出 Workbook `workflow.xlsx`：含「概述」sheet（放 Overview）與「逐頁工作流程」sheet（每列一個 Page，含 Workflow description 且嵌入該頁截圖縮圖）。缺前置檔時報「請先跑上一步」。

## Acceptance criteria

- [ ] 產出的 `workflow.xlsx` 含「概述」與「逐頁工作流程」兩個 sheet。
- [ ] 「逐頁工作流程」每列對應一個 Page，含描述並嵌入截圖縮圖（可獨立單元測試的確定性核心）。
- [ ] 「概述」sheet 呈現 Overview。
- [ ] 缺 `workflow.json` / `screenshots/` 時中止並提示先跑 `f2w-describe`。

## Blocked by

- `f2w-describe` ticket。
