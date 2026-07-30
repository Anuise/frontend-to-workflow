# f2w-diagram T2：多分頁 ＋ 總覽頁 ＋ 全域導覽記號

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #37 — https://github.com/Anuise/frontend-to-workflow/issues/37
Parent: ../spec.md (originally #35)

## What to build

`workflow.drawio` 從單張畫布變成多分頁：第 1 頁總覽，之後每個 Section 一頁。收圖的人先看總覽決定鑽哪一條路線，再點進去。

**跨 Section 邊的分類與處置**：
- 跨 Section 且目的地為該 Section 首頁 ⇒ 側邊欄全域導覽，收成單一個 **Global nav marker（全域導覽記號）**，從它往每個 Section 首頁各拉一條邊。驗證資料 73 條 → 8 條。
- 跨 Section 且目的地非該 Section 首頁 ⇒ 真實跨 Section 轉場，畫在總覽頁的 Section 方框之間。驗證資料 1 條。

**總覽頁內容**：Entry marker 接 `pages[0]` 所屬 Section 的方框；Global nav marker 接每個 Section 方框；Section 方框標「Section 名（n 頁）」並掛 draw.io page link 指向該分頁；真實跨 Section 轉場邊。

Section **內部** layout 本票不動，沿用現行 BFS 分層網格（樹狀 layout 是 T3）。

## Acceptance criteria

- [ ] `buildDiagram` 回傳多分頁結構（每個 Section 一頁 ＋ 一頁總覽），warnings 仍在頂層
- [ ] `renderDiagram` 輸出 `1+N` 個 `<diagram>`，分頁名即 Section 名
- [ ] 總覽頁對驗證資料為 9 個節點（Entry marker ＋ Global nav marker ＋ 8 個 Section 方框，其中入口 Section 與 Entry marker 相接）
- [ ] Section 方框帶 draw.io page link，點擊可跳到對應分頁
- [ ] 指向 Section 首頁的跨 Section 邊全部消失，改由 Global nav marker 發出
- [ ] 非指向首頁的跨 Section 邊仍在總覽頁上畫得出來且保留原 label
- [ ] 序列化仍不含 `modified`／`etag`／`agent`，同一份 diagram 兩次序列化逐字元相同
- [ ] driver 改用 draw.io CLI 的 `--all-pages` 匯出驗證；找不到執行檔時維持出聲 skip
- [ ] 實跑驗證資料，draw.io 開得起來且分頁數正確

## Blocked by

- #36
