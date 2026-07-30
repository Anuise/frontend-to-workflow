# f2w-breakdown 前端工項逐操作硬底線：每頁 ≥ max(1, actions 數)

State: closed
Status: ready-for-agent
Created: 2026-07-17
Closed: 2026-07-21
Author: Anuise
Origin: GitHub issue #27 — https://github.com/Anuise/frontend-to-workflow/issues/27

## Problem Statement

f2w-breakdown（frontend-to-workflow 管線第五步）讀 `workflow.json`，把每個 **Page** 拆成前端 Work item（觀察自畫面）與後端 Work item（AI 推論）。原本 `buildWorkitems` 只把關「每個 Page 至少一筆前端工項」。實務上 AI 常把整頁塞成一兩筆大工項，顆粒度過粗——一頁有多個可執行操作（`actions`）時，被壓成單筆「整頁做完」的巨型工項。後續 `f2w-breakdown-export` 產出的 `workitems.xlsx` 每列因此無法個別估時、指派或驗收。使用者要「顆粒度更細」，但當時沒有可驗證的下限，只靠 SKILL.md 的口頭約定，AI 容易漂回粗顆粒。

## Solution

在 `buildWorkitems` 組裝階段加一道**機器可驗證的硬底線**：每個 Page 的前端工項數必須 ≥ `max(1, 該頁 actions 數)`——逐可執行操作至少產出一筆前端工項；純顯示頁（0 actions）至少一筆。不足即丟 `WorkitemsConsistencyError`，訊息列出違反的 Page 與「前端 N／需 M」。此底線因 `max(1, …)` 恆 ≥1，**涵蓋並取代**舊的 per-page ≥1 涵蓋檢查。

SKILL.md 同步更新引導：前端逐操作至少一筆、後端依 API／驗證／查詢拆多筆（prose 引導、無硬底線）。**不動** `workitems.json` 契約 schema——以「計數」當代理，換取零 schema 變更。

## User Stories

1. 身為 f2w 使用者，我要每頁的前端工項按可執行操作逐一拆開，這樣每筆工項才小到能個別估時與指派。
2. 身為 f2w 使用者，我要顆粒度不足時管線直接擋下並報錯，這樣就不必等產出 xlsx 後才發現工項太粗。
3. 身為 f2w 使用者，我要錯誤訊息點名是哪一頁、目前幾筆、需要幾筆，這樣我能快速定位補齊。
4. 身為 f2w 使用者，我要純顯示頁（無 actions）仍維持至少一筆前端工項，這樣不漏頁。
5. 身為 f2w 使用者，我要後端工項不被套上同一硬底線，因為後端是 AI 推論、無法可靠錨定 actions，強制計數只會製造假失敗。
6. 身為 f2w 使用者，我要 SKILL.md 明確要求後端依 API／驗證／查詢拆多筆而非一團，這樣後端推論也夠細。
7. 身為 f2w 使用者，我要這道底線不改動 `workitems.json` 契約結構，這樣既有手改逃生口與下游 export 不受影響。
8. 身為 f2w 使用者，當某頁 actions 多但真的只需較少工項而被誤擋時，我要能回頭手改 `workflow.json` 的 actions 或在 `workitems.json` 補足，這樣有逃生口。
9. 身為維護者，我要這個決策記進 ADR，這樣後人知道為何選計數代理而非 schema 連結欄位。
10. 身為維護者，我要底線邏輯留在 `buildWorkitems` 單一把關點，這樣涵蓋、參照、契約、顆粒度四類檢查集中一處。

## Implementation Decisions

- **改動點**：`buildWorkitems`（`src/breakdown/`）的組裝驗證，新增顆粒度把關；不動 `workitems.ts` 契約 schema、不動函式簽章。
- **下限公式**：每頁 `floor = max(1, page.actions.length)`；前端工項按 `sourcePage` 分組計數，`count < floor` 即違反。
- **計數代理，非連結**：只保證每頁工項「數量」足夠，不逐一驗證某個 action 確有對應工項——換得零 schema 變更（見 ADR-0003）。
- **涵蓋合併**：新底線因 `max(1, …)` 恆 ≥1，涵蓋並取代舊的 per-page ≥1 涵蓋檢查，不再另留獨立涵蓋分支。
- **後端不套底線**：後端為 AI 推論、無法錨定 actions（見 ADR-0002），只在 SKILL.md 以 prose 引導依 API／驗證／查詢拆細。
- **錯誤型別沿用**：顆粒度不足丟既有 `WorkitemsConsistencyError`（與涵蓋／參照同型別），契約層違反仍冒泡 `ContractValidationError`。
- **文件**：SKILL.md frontmatter 與步驟 2／3／4 更新；新增 ADR-0003 記錄決策與被否選項。

## Testing Decisions

- **好測試定義**：只測外部行為（給定輸入工項與 workflow → 丟/不丟 error、錯誤訊息含違反頁 route），不斷言內部 Map／分組實作。
- **單一 seam**：`buildWorkitems` 純函式的單元測試（`buildWorkitems.test.ts`）——最高點，純輸入輸出、無 IO。不新增 seam。
- **紅／綠**：一頁兩 actions 的 fixture，給 1 筆前端工項 → 丟 `WorkitemsConsistencyError` 且訊息含該頁 route（紅）；給 2 筆 → 通過（綠）。
- **prior art**：同檔既有的涵蓋、參照（sourcePage／dependsOn）、契約（空欄位、id 重複）把關測試，同 seam 同風格。
- **既有測試維護**：真實 fixtures 的端到端測試改為逐頁產出 `max(1, actions 數)` 筆，維持在新底線下為綠。

## Out of Scope

- `workitems.json` schema 新增來源連結欄位、逐 action 精確涵蓋（被否選項，成本／侵入性最高）。
- 後端工項的硬底線。
- 承諾型欄位（估時／優先級／RACI／簽核／狀態）——一律不進 json。
- `saveWorkitems` 檔案 IO 的顆粒度測試（seam 在 `buildWorkitems`）。
- CONTEXT.md glossary 變更（floor 是實作規則，歸 ADR）。

## Further Notes

- **false-failure 風險**：某頁 actions 多但實際只需較少工項時會被擋；逃生口為調 `workflow.json` 的該頁 actions，或在 `workitems.json` 補足真實小工項；宣告式逃生口不變。
- 相關決策：ADR-0003（前端逐操作硬底線）、ADR-0002（後端工項為 AI 推論）、ADR-0001（步驟間以檔案交接）。
- 本 spec 為既成事實的回溯記錄：已於 PR #26 實作完畢（104 測試綠、typecheck 乾淨）。
