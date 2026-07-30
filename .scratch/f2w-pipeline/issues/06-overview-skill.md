# frontend-to-workflow：總說明 skill

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-16
Author: Anuise
Origin: GitHub issue #10 — https://github.com/Anuise/frontend-to-workflow/issues/10
Parent: ../spec.md (originally #4)

## What to build

建立總說明 skill `frontend-to-workflow`，向使用者說明四個 step skill 的正確觸發順序與各步的檔案交接（讀什麼、產出什麼），並明確聲明不自動串跑四步、每步之間保留使用者確認的 checkpoint。

## Acceptance criteria

- [ ] skill 準確列出四步順序與各步的輸入／產出檔。
- [ ] 明確聲明不自動串跑。
- [ ] 描述缺前置檔時「請先跑上一步」的行為。
- [ ] 用語對齊 `CONTEXT.md` 詞彙表。

## Blocked by

- `f2w-start` / `f2w-capture` / `f2w-describe` / `f2w-export` 四張 step ticket。
