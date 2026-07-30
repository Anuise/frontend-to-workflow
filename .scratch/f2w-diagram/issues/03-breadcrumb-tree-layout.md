# f2w-diagram T3：麵包屑樹 layout ＋ 隱含節點 ＋ fallback

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #38 — https://github.com/Anuise/frontend-to-workflow/issues/38
Parent: ../spec.md (originally #35)

## What to build

Section 分頁內的排列從 BFS 網格改成 **麵包屑樹**：父在左、子在右。欄＝相對 Section 根的階層深度，列＝深度優先走訪順序（子樹連續佔列），兄弟順序沿用 `workflow.json` 原順序。

關鍵性質：**版面來自頁面階層，與邊完全無關**。上游漏掉幾條邊時版面不會垮，孤立頁也照樣排在它該在的位置。

**Implied node（隱含節點）**：階層路徑中間有這一段、但 `workflow.json` 沒有對應 Page 時生一個框（例如只有 tab 子頁的 `模型服務詳情`）。無 `purpose`、無 tooltip。

**fallback**：某 Section 內切不出 ≥2 層階層時，該 Section 退回 BFS 分層網格並發 warning。逐 Section 判定，不是全域。

**warnings 增減**：刪除「純循環無終點」（樹狀骨架永遠有葉節點，這條失去意義）；保留孤立頁 warning；新增 fallback warning。

## Acceptance criteria

- [ ] Section 內節點依麵包屑樹定位，父節點的欄小於子節點
- [ ] 驗證資料的 `算力排程與工作負載` 展開成 新建專案／專案詳情／模型服務詳情 三支，深度最多 4
- [ ] 有段無實頁時生出 Implied node，且它是子節點的父框
- [ ] 淺階層 Section（切不出 ≥2 層）退回 BFS 分層並發出 fallback warning，warning 指名是哪個 Section
- [ ] 「純循環無終點」warning 已從程式碼與測試中移除
- [ ] 孤立頁仍排在自己 Section 的樹裡，其位置不受它從入口走不到影響
- [ ] 現行 4 頁淺階層 fixture 轉為 fallback 路徑的測試
- [ ] 新增一份含麵包屑階層的 fixture 覆蓋主路徑

## Blocked by

- #37
