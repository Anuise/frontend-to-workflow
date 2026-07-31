# T3：f2w-breakdown 吸收派工——鏈硬底線，並把套用後的正規化收成乾跑共用

State: open
Status: ready-for-agent
Created: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

`buildWorkitems` 接手派工。簽名只改**一次**（避免多張票各加一個參數疊成一長串位置參數）：把新輸入收成一個具名的 options 物件，帶 `revisions`、`declaredChains`、`parties`、`capabilities`。

新增**鏈硬底線**：每筆後端工項的 `partyChain.map(l => l.party)` 必須逐字等於 `declaredChains` 裡的某一條。含**單 leg**（不能只校拆項的那批，否則一筆 `partyChain: [{party:"leadtek"}]`——字面上的前端直打 leadtek——會零攔截）。`["needs-investigation"]` 這條長度 1 的鏈永遠合法。違反即丟錯**不落地**並逐一列名工項 id 與它實際的方序列。

底線跑在**套用修訂之後**，因為 `set partyChain` 也要被校。

沿用既有的方名與端點把關（從退場的 `checkAssignmentFields` 搬過來）：`party` ∈ 分工方集合 ∪ `{needs-investigation}`；leg 的 `vendor` 必須在已解析的 capability 內、`vendorEndpoints` 每條必須真的存在於該 spec（ADR-0007:14 明文要保的防線）。分工方集合純由 `parties`（泳道名）決定，**不再 ∪ spec 檔名**。

`sourcingConfirmed` 一律寫 `false`。

**乾跑一致性**：`buildWorkitems.ts:143-152` 的 `sourcePage` 正規化在套用修訂之後，而 `dryRun.ts:52-54` 沒有它——這正是 ADR-0012:35 點名會讓兩邊分岔的後處理。把該段正規化抽成共用函式，`dryRunWorkitemsRevisions` 呼叫同一支。**不動** `checkWorkitemsConsistency` 在既有位置的先後（`buildWorkitems.ts:141` 的註解就是那條不變式），只把正規化搬進乾跑。

`src/sourcing/` 整個目錄退場：`parseVendorSpec` 與 T1 的 `parseSwimlaneDiagram` 移入 `src/breakdown/`，`buildSourcedWorkitems`／`loadWorkitemsForSourcing`／`saveSourcedWorkitems`／`SplitPart`／`PartyAssignment`／`SourcingConsistencyError`／`originItemId` 全部刪除。

決策見 ADR-0015、ADR-0016。

## Acceptance criteria

- [ ] `buildWorkitems` 簽名只改一次，新輸入走具名 options 物件；全 repo 呼叫點（實測納入版控 46 次／9 檔）一次改完，`npx tsc --noEmit` 綠
- [ ] 一筆後端工項的方序列不在 `declaredChains` 內時丟錯不落地，訊息列出該筆 id 與實際方序列
- [ ] **單 leg** 的 `[{party:"leadtek"}]` 在宣告鏈只有 `[mobagel]`／`[mobagel,gary]`／`[mobagel,gary,leadtek]` 時被擋下（不是只校多 leg）
- [ ] `["needs-investigation"]` 合法；`needs-investigation` 出現在多 leg 鏈裡被擋下
- [ ] leg 的 `vendorEndpoints` 帶一條 spec 裡不存在的端點時被擋下並指名該端點
- [ ] `party` 為 spec 檔名（如 `IDP-service`）而非泳道名時被擋下——舊行為「spec 檔名成為合法方名」已消失
- [ ] `set partyChain` 的修訂在鏈硬底線**之前**套上：一筆把方序列改成非宣告鏈的修訂會讓整步丟錯不落地
- [ ] `sourcePage` 正規化由 `buildWorkitems` 與 `dryRunWorkitemsRevisions` 呼叫同一支函式；既有 `crossRerunSurvival.test.ts` 全綠
- [ ] `src/sourcing/` 已刪除，全 repo 無殘留 import

## Blocked by

- T1（宣告鏈與泳道名的來源）
- T2（`partyChain` 契約）
