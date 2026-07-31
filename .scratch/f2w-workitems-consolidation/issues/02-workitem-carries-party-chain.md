# T2：契約合併——工項帶 partyChain，workitems-sourced.json 契約退場

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

把分工欄位從 `src/contracts/sourcedWorkitems.ts` 搬進 `src/contracts/workitems.ts`，讓 `workitems.json` 成為唯一的工項檔。

`workItemSchema` 新增兩個 **optional** 欄位：

- `partyChain: Array<{ party: string, vendor?: string, vendorEndpoints: string[], title?: string, scope?: string, acceptance?: string }>`
- `sourcingConfirmed: boolean`

兩者 optional 是硬約束——`upsert` 的 `value` 走的就是 `workItemSchema`，設成必填會讓使用者補後端工項時過不了契約。

新增的 refine：

1. **id 禁含 `#`**（前後端皆然）。列標籤 `<工項id>#<leg序>` 因此永不撞號。
2. **後端 partyChain 全有全無**：`backend[]` 裡要嘛每筆都有 `partyChain`、要嘛每筆都沒有。
3. **多 leg 時 leg 三欄必填**：`partyChain.length > 1` 時每個 leg 的 `title`／`scope`／`acceptance` 都不得缺（實測 39/39/39 全異，這是真實需求）；單 leg 可缺、缺時繼承工項層。
4. **leg 的 vendor 與 vendorEndpoints 成對**（一有俱有、一空俱空），語意沿用 `sourcedWorkitems.ts:43` 的既有 refine。
5. **`needs-investigation` 不得帶 vendor／vendorEndpoints，且不得出現在多 leg 鏈裡**。

匯出列標籤公式為單一函式（如 `partyLegLabel(itemId, legIndex)`），供 export、revise、測試共用——比照 `frontendWorkitemId` 的做法，只有一份。

刪除 `src/contracts/sourcedWorkitems.ts` 與其型別（`SourcedWorkitems`／`SourcedBackendItem`／`parseSourcedWorkitems`／`NEEDS_INVESTIGATION` 移到 workitems 契約）；`src/output.ts` 的 `CONTRACT_FILES` 與 `CONTRACT_PRODUCER` 移除 `workitemsSourced`。

決策見 ADR-0016。

## Acceptance criteria

- [ ] `workItemSchema` 接受不帶 `partyChain` 的工項（`0714` 的 113 筆工項不改一個字就能過）
- [ ] 後端只有部分工項帶 `partyChain` 時被契約擋下，錯誤訊息指出缺的那幾筆 id
- [ ] 工項 id 含 `#` 被擋下，錯誤訊息指名該筆
- [ ] `partyChain.length > 1` 而某個 leg 缺 `title`／`scope`／`acceptance` 時被擋下並指名該 leg 序
- [ ] 單 leg 且 leg 三欄皆缺時合法
- [ ] leg 的 `vendor` 有值但 `vendorEndpoints` 空（或反之）被擋下
- [ ] `party: "needs-investigation"` 帶 `vendor` 被擋下；出現在 `partyChain.length > 1` 的鏈裡被擋下
- [ ] `partyLegLabel("BE-MODEL-1", 1)` 回 `"BE-MODEL-1"`（單 leg 情形由呼叫端決定不加後綴）、`partyLegLabel("BE-MODEL-1", 2)` 回 `"BE-MODEL-1#2"`
- [ ] `src/contracts/sourcedWorkitems.ts` 已刪除，全 repo 無殘留 import；`contractPath(root, project, "workitemsSourced")` 不再存在
- [ ] `npx tsc --noEmit` 與全 repo 測試綠（含 `src/sourcing/*.test.ts` 的移除或改寫）

## Blocked by

- 無，可與 T1 並行
