# f2w-breakdown 前端工項顆粒度：每頁 ≥ max(1, actions 數) 硬底線

`f2w-breakdown` 原本只要求「每個 Page 至少一筆前端 Work item」，實務上 AI 常把整頁塞成一兩筆大工項、顆粒度過粗。為了讓「拆更細」可驗證、不靠嘴上約定，`buildWorkitems` 新增一道硬底線：**每頁前端工項數必須 ≥ `max(1, 該頁 actions 數)`**（逐可執行操作至少一筆、純顯示頁至少一筆），不足即丟 `WorkitemsConsistencyError`。此底線涵蓋並取代舊的 per-page ≥1 涵蓋檢查。

## Considered Options

- **純指令引導（不加檢查）**：只在 SKILL.md 要求逐操作拆項；最簡、無誤報，但不可驗證，AI 容易漂回粗顆粒。
- **嚴格計數硬底線（採用）**：以 `workflow.json` 每頁 `actions` 數當下限，不動 `workitems.ts` schema、只動 `buildWorkitems` 組裝檢查。可機器驗證、改動最小。
- **新增來源連結欄位＋逐操作涵蓋**：工項加一欄指向所涵蓋的 action，強制每個 action 至少被一筆前端工項涵蓋；最精確，但要改契約 schema，成本與侵入性最高。

## Consequences

- 用「計數」而非「連結」當代理：只保證工項數足夠、不逐一驗證某 action 確有對應工項——換得零 schema 變更。
- **false-failure 風險**：某頁 actions 多但真的只需較少工項時會被擋下。逃生口是回頭調 `workflow.json`（該頁 actions），或在 `workitems.json` 補足真實的小工項；宣告式逃生口不變。
- 後端工項**不套**此底線：後端是 AI 推論、無法可靠錨定 actions（見 ADR-0002）；後端拆細只在 SKILL.md 以 prose 引導。
- 承諾型欄位政策與 `workitems.json` 契約結構不受影響。
