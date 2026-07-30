# f2w-diagram T4：邊收斂——Tab group 框 ＋ 返回操作進 tooltip

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #39 — https://github.com/Anuise/frontend-to-workflow/issues/39
Parent: ../spec.md (originally #35)

## What to build

把 Section 內剩下的兩類非推進邊收掉，讓圖上每一條線都是真的在推進流程。

**兄弟 ↔ 兄弟（同父同深度）**：不畫邊，改用 **Tab group（tab 群組）** 框把它們圈起來，框標題固定字串「可互相切換的 tab」。只有當該組兄弟之間**實際存在互跳邊**時才生框——平行子頁不該被誤標成可切換。驗證資料 46 條 → 0。

**子 → 祖先**：不畫邊，label 併入來源節點 tooltip 的「返回操作」段。驗證資料 30 條 → 0。

已知取捨（spec 已裁決，不要在實作時翻案）：返回邊的 label 帶語意差異（`按取消回專案詳情` vs `按儲存並建立回專案詳情`），要確定性分辨只能讀 label 文字＝推論，違反本步零推論底線。因此「儲存成功後回到哪裡」在圖上不畫，`workflow.xlsx` 是操作清單的權威來源。

## Acceptance criteria

- [ ] 同父同深度的兄弟之間不再有邊
- [ ] 兄弟之間有互跳邊時生 Tab group 框；沒有互跳邊的平行子頁不生框
- [ ] 子→祖先的邊消失，其 label 出現在來源節點 tooltip 的「返回操作」段
- [ ] tooltip 同時有「不換頁的操作」與「返回操作」時兩段皆在且順序固定
- [ ] 實跑驗證資料，總邊數由 180 降為 39（30 推進 ＋ 8 全域導覽 ＋ 1 跨 Section 轉場）
- [ ] 父→子與其他同 Section 邊（驗證資料 18 ＋ 12 條）完整保留且 label 不變

## Blocked by

- #38
