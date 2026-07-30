# f2w-describe：逐頁工作流程描述

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-15
Author: Anuise
Origin: GitHub issue #8 — https://github.com/Anuise/frontend-to-workflow/issues/8
Parent: ../spec.md (originally #4)

## What to build

`f2w-describe` 讀取 `pages.json` 與 `screenshots/`，以使用者視角為每個 Page 產出 Workflow description（頁面用途、主要內容、可執行操作、每個操作的操作去向），並另外產出一段跨頁的 Overview，寫入 `workflow.json`。缺前置檔時報「請先跑上一步」。

## Acceptance criteria

- [ ] 每個 Page 都有用途、主要內容、操作清單、每個操作的操作去向。
- [ ] 產出一段獨立於逐頁描述的 Overview。
- [ ] 描述以繁體中文、使用者視角撰寫。
- [ ] `workflow.json` 符合契約 schema。
- [ ] 缺 `pages.json` / `screenshots/` 時中止並提示先跑 `f2w-capture`。

## Blocked by

- `f2w-capture` ticket。
