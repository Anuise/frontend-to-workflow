# 實作進度（/loop /implement 八張票）

分支：`feat/f2w-workitems-consolidation`（已開，尚未 commit）

## 下一步（照這個順序做）

1. `npx tsc --noEmit` 一定會炸一片——把所有呼叫點修到綠：
   - `buildWorkitems(...)` 第四參數改成 `{ revisions }`（`src/revise/crossRerunSurvival.test.ts`、
     `src/breakdown/buildWorkitems.test.ts`、`f2w-run/run-breakdown*.test.ts`）
   - `parseVendorSpec(path)` → `parseVendorSpec(path, vendor)`（`src/breakdown/parseVendorSpec.test.ts`）
   - `src/breakdown-export/inputs.ts` 還在讀 `workitems-sourced.json`／`loadSourcedWorkitems`（T5 要整段刪）
   - `src/prerequisites.ts`／`src/output.test.ts` 可能還提到 `workitemsSourced`
2. T5 export 展開、T6 revise、T7 文件、T8 實跑。

## 狀態

- [x] **T1 parseSwimlaneDiagram** — `src/breakdown/parseSwimlaneDiagram.ts` ＋ `.test.ts`，11 tests 綠。
      尚未加進 `src/breakdown/index.ts` 的 re-export（T3 一起做）。
- [x] **T2 契約合併** — `src/contracts/workitems.ts` 已改寫：加 `partyChain`／`sourcingConfirmed`、
      五條 refine、`partyLegLabel`／`parsePartyLegLabel`／`NEEDS_INVESTIGATION`／`PARTY_LEG_SEPARATOR`。
      `src/contracts/sourcedWorkitems.ts` 已 `git rm`；`src/output.ts` 已移除 `workitemsSourced`。
      **未做**：`src/contracts/workitems.test.ts` 補新 refine 的測試。
- [x] **T3 骨幹** — `src/sourcing/` 整個 `git rm`；`parseVendorSpec.ts`/`.test.ts` `git mv` 進
      `src/breakdown/`（識別名改由呼叫端傳）；`buildWorkitems` 改具名 `BuildWorkitemsOptions`、
      新增 `checkPartyChains`（鏈硬底線，跑在套用修訂之後）與 `canonicalizeSourcePages`。
      **未做**：`dryRun.ts` 改呼叫 `canonicalizeSourcePages`、全 repo 呼叫點修正、單元測試。
- [x] **T4 骨幹** — 新增 `src/breakdown/discoverPartyInputs.ts`（三態、目錄名即方名、
      `.$*`／`*.bkp` 依檔名排除、子集檢查、強制回報）；`workspace/spec/new_0724_.../aidms/` 已改名
      `leadtek/`。**未做**：`discoverPartyInputs.test.ts`。
- [ ] T5 export 展開成列
- [ ] T6 revise：`set partyChain`、leg 標籤當 anchor、`--prune`
- [ ] T7 文件與流程重整（刪 `.claude/skills/f2w-sourcing/`）
- [ ] T8 實跑 new_0724 ＋ driver 收斂成兩支納版控

## 關鍵決策備忘

- `partyLegLabel(itemId, legIndex, chainLength = legIndex)`：預設值讓票 02 的
  `partyLegLabel("BE-MODEL-1", 1) === "BE-MODEL-1"` 與票 05 的多 leg `#1/#2/#3` 同時成立。
- `workItemSchema` 現在是 `ZodEffects`（superRefine），不能再 `.extend()`。
- T1 排除規則：`rect.y >= 最下方泳道底緣` 即排除（涵蓋 `leg_*` 圖例與 `leg_chain` 宣告 cell，
  宣告 cell 另由「含①…⑩＋→」的內容規則另外讀）。

## 驗收數字（實測基準，不接受估算）

後端交付物列數 99 → 123（21 單 leg ＋ 15 兩 leg ＋ 24 三 leg）；`workitems.json` 後端 60 筆不變；
修訂 190 → 有效 111、archive 79；`0714` 不改一字過新契約。
