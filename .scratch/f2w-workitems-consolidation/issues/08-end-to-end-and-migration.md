# T8：實跑驗收與遷移——0724 走完新形狀，四份 output 各自到位，driver 收斂

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

拿真專案把新形狀跑完，並把 `f2w-run/` 的驅動從「扛政策表」降級為「只驅動」。

**`new_0724` 實跑**：重跑 `f2w-breakdown`（帶自動發現的派工）→ 重跑 `f2w-breakdown-export`。跑之前先在 `revisions.json` 的兩筆 upsert（`BE-EXTRA-01`／`BE-EXTRA-02`）的 value 補上 `partyChain`，否則新契約的「後端全有全無」refine 會擋下。

**鏈修正的實質驗收**：現行 24 筆方序列為 `mobagel > leadtek` 的工項不在宣告鏈內，鏈硬底線會擋下；補上 gary 中繼 leg 之後方序列成為 `mobagel > gary > leadtek`。gary 那個 leg 的 `vendor`／`vendorEndpoints` **留空**（gary 沒提供對應 API，契約上合法），`scope` 要寫出「gary 需開代理 API 轉呼 leadtek，現有四份 spec 未提供」這個事實。

**driver 收斂**：六支未納版控的 `f2w-run/*.test.ts` 收成兩支並**納入版控**——一支跑新形狀的 breakdown ＋ export，一支跑 revise 乾跑與 prune。`SPEC_OWNER` 隨目錄慣例消失；`POLICY` 表只保留「這筆工項的目標方與端點」，鏈的形狀交給宣告鏈硬底線。順手清掉 `run-sourcing-new0724.test.ts:15` 那句過期的 `m_back1 → l_apiserver` 註解（它不會被任何 warning 抓到，只能手動清）。

**四份 output 遷移**：`0721`／`0729` 沒有 `workitems.json`，什麼都不用做；`0714` 不重跑、不改一個字就要能過新契約（113 筆工項，無 `partyChain`）；`new_0724` 是唯一實跑的。

驗收數字直接讀 json／xlsx 數，**不要用 `git status` 當判準**——`output/` 被 `.gitignore:149` 整個排除，那個檢查是空的。

## Acceptance criteria

- [ ] `new_0724` 重跑 `f2w-breakdown` 成功落檔，`workitems.json` 後端工項仍是 **60 筆**（不拆項，筆數不變）
- [ ] 60 筆的 `partyChain` 長度分布為 21 筆單 leg、15 筆兩 leg、24 筆三 leg
- [ ] 那 24 筆三 leg 的方序列逐字為 `["mobagel","gary","leadtek"]`，中間 leg 的 `vendor`／`vendorEndpoints` 皆空
- [ ] 中間 leg 的 `scope` 寫出「gary 需開代理 API」這個事實（逐筆檢查，24/24）
- [ ] 重跑後 `workitems.xlsx` 後端 sheet **123 列**
- [ ] 把某一筆的方序列手改成 `["mobagel","leadtek"]` 後重跑，整步丟錯**不落地**並指名該筆
- [ ] 連跑兩次 `f2w-breakdown`，後端工項 id 集合與 `partyChain` 逐字相同（不再有拆項造成的 id 改寫）
- [ ] 190 筆修訂全數仍能錨到（孤兒 0 筆）；`--prune` 後 `revisions.json` 111 筆、archive 79 筆、套用結果雜湊不變
- [ ] `0714` 不改一個字通過新契約（`parseWorkitems` 直接讀既有檔成功）
- [ ] `f2w-run/` 收斂成兩支並納入版控，`SPEC_OWNER` 不存在，過期註解已清；全 repo 測試綠、`npx tsc --noEmit` 綠

## Blocked by

- T3、T4、T5、T6、T7
