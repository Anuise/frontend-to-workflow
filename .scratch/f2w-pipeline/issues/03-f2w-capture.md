# f2w-capture：列舉 Page 並截圖

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-15
Author: Anuise
Origin: GitHub issue #7 — https://github.com/Anuise/frontend-to-workflow/issues/7
Parent: ../spec.md (originally #4)

## What to build

`f2w-capture` 讀取 `manifest.yml` 指向的執行中 Project，列舉出所有 Page（路由正規化，等價 URL 收斂為同一 Page；同路由下不同 tab 狀態視為不同 Page），逐 Page 截圖，產出 `pages.json` 與 `screenshots/`。純前端下 API 回傳空資料或錯誤狀態時照實截圖。缺 `manifest.yml` 時報「請先跑上一步」。

## Acceptance criteria

- [ ] 對執行中的 sample project 列舉出所有 Page，無明顯漏頁。
- [ ] 路由正規化：等價 URL 不重複列為多個 Page（可獨立單元測試的確定性核心）。
- [ ] 同路由下的不同 tab 狀態各自成為一個 Page。
- [ ] 每個 Page 有一張對應截圖存於 `screenshots/`。
- [ ] `pages.json` 符合契約 schema。
- [ ] 缺 `manifest.yml` 時中止並提示先跑 `f2w-start`。

## Blocked by

- `f2w-start` ticket。
