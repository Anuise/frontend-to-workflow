# f2w-diagram T1：抽出階層路徑與 Section 分組（prefactor）

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #36 — https://github.com/Anuise/frontend-to-workflow/issues/36
Parent: ../spec.md (originally #35)

## What to build

替 Navigation diagram 的後續改造鋪路：把「一個 Page 屬於哪一條路線」這件事，從邊的拓撲改成由頁面識別本身決定。

定義 **階層路徑（hierarchy path）**：`route` 的 path 段（去掉空段與 `index`）＋ `tab` 以全形直線切開的段，依序串接。深度即段數。

定義 **Section（區段）**：階層路徑中**第一個具區辨力的段**（第一個「不是所有頁面都相同」的段）決定 Section 歸屬。Section 的順序與命名沿用 `workflow.json` 的 Page 原順序。

本票只做抽出，**不改任何外顯行為**。`buildDiagram` 內部改用這兩個概念，回傳形狀維持現狀（單層 nodes/edges）。

## Acceptance criteria

- [ ] 階層路徑與 Section 分組是可獨立斷言的純函式
- [ ] 對驗證資料（41 頁）切出 8 個 Section，頁數為 登入1／模型倉庫2／叢集資源總覽1／算力申請與審核9／算力排程與工作負載17／安全監控2／追蹤日誌5／帳號與權限管理4
- [ ] 每頁第 0 段皆為 `SSO` 時，分組落在第 1 段（驗證「第一個具區辨力的段」規則）
- [ ] 所有頁面階層路徑完全相同時不會爆炸，退化成單一 Section
- [ ] `src/diagram/` 既有測試全數維持綠燈
- [ ] 對同一份 `workflow.json` 實跑，產出的 `workflow.drawio` 與改動前逐字元相同

## Blocked by

- None — can start immediately.
