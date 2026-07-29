# f2w-sourcing 改以權責泳道圖派工：四桶來源決策改為分工歸屬

`f2w-sourcing` 的決策本體從「自建 vs 供應商」四桶（vendor-direct／vendor-adapted／self-built／needs-investigation，ADR-0004）改為 **Party assignment（分工歸屬）**：每筆後端 Work item 派給一個**分工方**（Party，權責泳道圖的泳道名或 Vendor spec 檔名，如 mobagel／gary／leadtek）或 `needs-investigation`。動機是實際專案（如桃園刑大 AI 平台）是**多方分工共建**模型——三方各蓋一塊，不是「我方採購供應商 API」模型；四桶回答「要不要自建」，回答不了「這塊誰做」。新輸入**權責泳道圖**（draw.io、泳道＝分工方）為派工主據，Vendor spec 降為輔助證據；兩種輸入**皆可選、至少一份**。

## Considered Options

- **保留四桶、另加責任方欄**：兼容舊契約；但一筆工項同時回答兩個問題（要不要自建＋誰做），兩欄語意重疊、四桶的「自建」視角在多方共建下根本沒有錨（誰的「自建」？），劃分照樣失真。
- **建確定性泳道圖解析器（parent 鏈＋幾何包含）再配對**：與 `parseVendorSpec` 對稱、`assignedParty` 可硬校驗；但泳道圖是**平台級共用文件**、人畫得自由（節點掛 root、跨泳道群組），且圖與單一專案工項的對應本來就要語意推斷——解析器只能保真「格在哪條泳道」，保不了「這格對應這個工項」。成本換不到防線的關鍵段。
- **AI 直接讀圖、builder 只校方名集合（採用）**：AI 讀 draw.io XML 抽泳道名與元件、做工項配對；泳道名清單傳入 `buildSourcedWorkitems`，硬底線校 `assignedParty ∈ 泳道名 ∪ spec 供應商名 ∪ {needs-investigation}`。責任歸屬全程是推論，靠 `sourcingConfirmed: false` 人核兜底。

## Consequences

- **值域隨輸入而定**：契約層只驗 `assignedParty` 為非空字串，集合成員資格由 builder 在執行時把關（泳道名由 AI 抽出、在執行紀錄中列給人看）。兩種輸入皆缺＝分工方集合為空，builder 直接報錯——本步無據不跑。
- **vendor 欄與派工脫鉤**：`vendor`／`vendorEndpoints` 成對、只在配到某份 spec 的端點時填（端點存在性照校，ADR-0004 留下的可校驗防線）；派給沒提供 spec 的方是合法的（兩欄留空）。`needs-investigation` 不得攀附供應商。
- **拆項觸發改為跨方接力**：一筆工項橫跨兩方（一方出 API、另一方接回處理）時拆成 ≥2 筆接力（首筆承接原依賴、其後逐筆依賴前一筆、各帶 `originItemId` 溯源）。RACI 鐵律不變：一筆工項不能派給兩個 A。`adaptationRole`（fetch／process）與其四條機器防線隨四桶廢除——拆項角色已由各筆的 `assignedParty` 與工項描述自然承載，正確性讓渡給人核。
- **ADR-0004 部分被取代**：「注入後端事實、可選插入步、`sourcingConfirmed` 獨立於 `inferred`、讓渡冪等換拆項表達力、originItemId 純溯源」全數存活；「四桶值域、spec 必備、spec 放 Project 內、adaptationRole 充要條件」被本決策取代。
- **兩個待確認維度不變**：`inferred`（工項存不存在）＋ `sourcingConfirmed`（派的方與配的 API 對不對），開工前各自要人核。
