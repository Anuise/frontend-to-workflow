# 六步管線總說明更新（frontend-to-workflow skill 四步→六步）

State: closed
Status: ready-for-agent
Created: 2026-07-17
Closed: 2026-07-17
Author: Anuise
Origin: GitHub issue #22 — https://github.com/Anuise/frontend-to-workflow/issues/22
Parent: ../spec.md (originally #19)

## What to build

把 `frontend-to-workflow` 總說明 skill 從四步管線更新成六步，讓新加入的開發者一眼看懂新增了 `f2w-breakdown` 與 `f2w-breakdown-export` 兩步、各吃什麼吐什麼。純文件。

## Acceptance criteria

- [ ] `frontend-to-workflow` 總說明 skill 的管線步驟表由四步擴為六步，依序含 f2w-start／f2w-capture／f2w-describe／f2w-export／f2w-breakdown／f2w-breakdown-export
- [ ] 新增兩步各標明輸入與產出：f2w-breakdown 讀 `workflow.json` 產 `workitems.json`；f2w-breakdown-export 讀 `workitems.json` 產 `workitems.xlsx`
- [ ] 反映範本／工作副本分離與後端推論·待確認，用語與 CONTEXT.md 一致
- [ ] 不改動既有四步的敘述

## Blocked by

- #20（f2w-breakdown → workitems.json）
- #21（f2w-breakdown-export → workitems.xlsx）
