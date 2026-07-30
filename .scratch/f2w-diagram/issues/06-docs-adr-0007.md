# f2w-diagram T6：文件——ADR-0007、CONTEXT.md、SKILL.md

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #41 — https://github.com/Anuise/frontend-to-workflow/issues/41
Parent: ../spec.md (originally #35)

## What to build

讓 repo 裡對 `f2w-diagram` 的描述與實際產物一致。

**新增 `docs/adr/0007-*.md`**：取代 ADR-0006 的「單張畫布」與「一頁一節點的 BFS 網格 layout」兩項；保留 ADR-0006 的明文不壓縮、邊座標交給 draw.io、不換頁操作降 tooltip。要記下 Q1～Q8 各自被否決的選項與理由，特別是：為何不用簡單路徑列舉界定流程（組合爆炸）、為何不保留舊的 41 節點全圖、為何不在 `action` 上加 `kind` 欄位（把推論推回 f2w-describe 是另一個決策）。並說明 Implied node 與 Tab group 是本步第一次畫出不存在於 `workflow.json` 的圖元，為何仍屬零推論。

**`CONTEXT.md`**：新增 Section／Global nav marker／Implied node／Tab group 四個詞條（含 `_Avoid_` 行），並在既有的 Navigation diagram 詞條補上多分頁與 Section。Section 詞條要寫明「使用者口語的『一條完整的路線』即指 Section」，以及為何不叫 Route（撞 `pages[].route`）或 Flow（撞 `workflow`）。

**`.claude/skills/f2w-diagram/SKILL.md`**：改寫語意映射表、流程、兩種一定要回報的情形、逃生口與驗證指令（加 `--all-pages`）。

## Acceptance criteria

- [ ] ADR-0007 存在，明列它取代 ADR-0006 的哪兩項、保留哪三項
- [ ] ADR-0007 記錄被否決的選項與理由，不只記錄採用的方案
- [ ] `CONTEXT.md` 四個新詞條齊備且格式與既有詞條一致
- [ ] SKILL.md 的語意映射表反映實際產物（多分頁、Global nav marker、Implied node、Tab group、tooltip 兩段）
- [ ] SKILL.md 的驗證指令含 `--all-pages`
- [ ] SKILL.md 的 warnings 章節與程式碼實際發出的 warnings 一致
- [ ] repo 內沒有殘留描述單張畫布或 BFS 網格為主要 layout 的文字（ADR-0005／0006 作為歷史記錄除外）

## Blocked by

- #38
- #39
- #40
