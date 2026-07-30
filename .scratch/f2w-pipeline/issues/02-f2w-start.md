# f2w-start：偵測並啟動 project

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-15
Author: Anuise
Origin: GitHub issue #6 — https://github.com/Anuise/frontend-to-workflow/issues/6
Parent: ../spec.md (originally #4)

## What to build

使用者把管線指向 Workspace 底下的一個 Project，`f2w-start` 首次自動偵測其安裝指令、啟動指令、對外 port 與 base URL，產生 Manifest 讓使用者確認後保存成 `manifest.yml`，並依此把 Project 實際跑起來。之後重跑同一 Project 直接重用既有 `manifest.yml`、不重新偵測，且尊重手動微調。純前端假設下不處理 auth。

## Acceptance criteria

- [ ] 對 sample fixture project 執行，能偵測出安裝／啟動指令、port、base URL。
- [ ] 偵測結果在保存前呈現給使用者確認。
- [ ] 確認後保存為 `manifest.yml`，符合契約 schema。
- [ ] 重跑時重用既有 `manifest.yml`、不重新偵測；手改後的值被尊重。
- [ ] 依 Manifest 能把 Project 啟動至可存取狀態。

## Blocked by

- 骨架 ticket（管線骨架與檔案契約）。
