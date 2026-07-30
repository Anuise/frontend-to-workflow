# f2w-diagram T5：兩段式節點外觀

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #40 — https://github.com/Anuise/frontend-to-workflow/issues/40
Parent: ../spec.md (originally #35)

## What to build

節點標籤現在是 `purpose` 全文（中位數 33 字、最長 50 字）塞進 160×80 的框，糊到掃視時認不出頁面身分。改成兩段式：**第一行粗體＝階層路徑末段**（負責掃視），**第二行小字＝`purpose`**（負責理解）。框放大到 240×100。兩者都畫在畫布上，匯出 PNG 不會掉。

**孤立頁**（從入口 BFS 走不到、且非 `pages[0]`）：標題前綴警示記號。

**邊 label**：原文照印，不截斷（最長 44 字；收邊後只剩 39 條，密度撐得住）。

## Acceptance criteria

- [ ] 節點同時帶短標題與 `purpose`，標題為階層路徑末段
- [ ] 節點框為 240×100，深度 4 的 Section 寬度在一個螢幕內
- [ ] 孤立頁標題帶警示前綴，非孤立頁沒有
- [ ] 邊 label 一律原文，無截斷或省略號
- [ ] 匯出 PNG 後標題與 `purpose` 皆可見
- [ ] 序列化的確定性維持（兩次逐字元相同）

## Blocked by

- #37
