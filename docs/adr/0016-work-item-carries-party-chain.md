# 跨方工項不再拆項，改帶 partyChain，多列只在交付物層展開

一筆後端 Work item 橫跨多方時不再被拆成多筆，改成帶一個 **Party chain（分工鏈）**：`partyChain: Array<{ party, vendor?, vendorEndpoints, title?, scope?, acceptance? }>`。工項 id 不改寫，`originItemId` 與「把指向被拆原 id 的 dependsOn 改指最後一筆」這段重映射整段退場，逐筆冪等回來。

交付物的多列由 `f2w-breakdown-export` 展開：一筆 partyChain 有 N 個 leg 就展開成 N 列，每列一個分工方、各自帶供應商、端點與散文、各自畫押。列標籤確定性推導——單 leg 就是工項 id，多 leg 是 `<工項id>#<leg序>`（如 `BE-MODEL-1#2`），契約層加一條 refine 禁止工項 id 含 `#`，所以標籤永不撞號。

驅動這個改動的是實測數字：使用者累積的 59 個修訂 anchor 有 39 個在 `workitems-sourced.json` 不存在，而那 39 個逐一對應 39 筆被拆項的原工項。拆項改寫 id 是成因，不改寫 id 是治好它的充分條件之一。

## Considered Options

- **維持拆項，另為 leg id 建確定性推導公式（否決）**：leg id ＝「AI 重編的 BE-* × 這次判斷拆幾筆」兩層非確定性相乘，公式的兩個輸入本身都不確定，拿不到 ADR-0013 給前端 id 那種保證。而且原 id 從產出消失這件事不會因為 leg id 有公式而改變。
- **維持拆項，讓 `f2w-revise` 新增第三個 target 錨到 sourced 檔（否決）**：治療而非預防。能可靠錨住的只有 99 列裡沒被拆的 21 列，且修訂的套用點在 builder 全部硬底線之後，一筆修訂就能把 `assignedParty` 改成集合外的方名、靜默繞過 ADR-0007:13 的把關。
- **一筆帶鏈，leg 不帶散文（否決）**：實測 39 組拆項的 `title`／`scope`／`acceptance` 三欄**各 leg 逐組全異（39/39/39）**——leg 散文不是樣板的複製品，是唯一寫著各方要做什麼、驗收什麼的地方。`BE-MODEL-1` 的 mobagel leg 驗收是「前端不直接呼叫 leadtek…」、leadtek leg 是「清單欄位齊全，支援分頁與排序。」。抽掉之後 gary 那一列會顯示 leadtek 的活與 leadtek 的驗收，而 gary 要以單一 A 在上面畫押——ADR-0004:16 的原始理由逐字就是「可各自畫押」。
- **一筆帶鏈，leg 帶自己的 optional 散文（採用）**：三欄 optional、缺欄時繼承工項層（單 leg 情形自然正確），但多 leg 工項的每個 leg 都必須自帶三欄（契約 refine）。id 不改寫、散文不流失、畫押粒度保住。

## 列標籤是合法的修訂錨，不是「非錨」

`<工項id>#<leg序>` 這個標籤**可以當 anchor 用**：`f2w-revise` 的 anchor 解析先切 `#`，左側是工項 id、右側是 leg 序。這是刻意的——使用者照交付物列標籤寫下的修訂必須錨得到東西。

把含 `#` 的標籤定為「永遠不是錨、遇到就當永久孤兒清掉」是行不通的：59 個 anchor 有 39 個落在多 leg 工項上，那正是使用者最會照交付物抄的那批。這樣做等於把「錨不到」從 json 層搬到交付物層，還多一個自動清除把它靜默吞掉——比現行「保留＋每次發 warning」更難察覺。

標籤的確定性來自 (工項 id, leg 序) 兩段，做法與 ADR-0013 對前端 id 的處理同源：公式匯出成單一函式給 export、revise 與測試共用，只有一份。

## Consequences

- 推翻 ADR-0004 的「讓渡冪等換表達力」一條（拆項、`originItemId`、原工項被移除），並因此穿破 ADR-0007:16「該條全數存活」的宣告——ADR-0007 對這一條的引用視為已被本 ADR 取代。「跨方接力」的語意保留，實現從「拆成多筆」改為「一筆多 leg」。
- RACI 鐵律（一筆工項不能派給兩個 A）在交付物層由「一列一個 leg 一個 A」滿足。
- `partyChain` 與 `sourcingConfirmed` 皆 optional（`upsert` 的 value 是 `workItemSchema`，設成必填會讓使用者補後端工項時過不了契約），但加一條 refine：後端工項的 `partyChain` 要嘛全部有、要嘛全部沒有，避免「有派工但這次忘了給輸入」靜默降級成半套檔。
- `vendor`／`vendorEndpoints` 從工項層下移到 leg 層並仍成對，端點存在性照校（ADR-0007:14 明文要保的防線）。派給沒提供 spec 的方仍合法（兩欄留空）——`gary` 當純通道就是這一格。
- `workitems.xlsx` 的後端 sheet 列數與 id 形態都變（`new_0724` 實測 99 → 123 列），會打斷範本承諾的「重跑只覆蓋範本、不動工作副本」。既有工作副本需人工對照遷移，SKILL.md 要寫明。
