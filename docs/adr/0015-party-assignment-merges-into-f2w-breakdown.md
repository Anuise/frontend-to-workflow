# 派工併入 f2w-breakdown，workitems-sourced.json 退場

`f2w-sourcing` 這一步取消，分工歸屬併入 `f2w-breakdown`；契約檔 `workitems-sourced.json` 一併退場。管線回到乾淨的六步（`f2w-start` → `f2w-capture` → `f2w-describe` → `f2w-export` → `f2w-breakdown` → `f2w-breakdown-export`）加一個分支步 `f2w-diagram` 與一個可重複的插入步 `f2w-revise`，沒有小數點編號。`f2w-breakdown` 不改名——吸收一步不是改名。

理由不是「少一步比較簡潔」，而是兩份檔各有一套 id 命名空間這件事本身在製造缺陷。sourcing 複製工項時會拆項並把原 id 從產出刪掉，於是使用者累積的 59 個修訂 anchor 有 39 個（66%）在交付物那一層根本不存在；`loadWorkitemsForExport` 又只對 sourced 檔做 `existsSync`、沒有任何新鮮度比對，所以重跑 `f2w-breakdown` 套進新修訂之後，舊的 sourced 檔仍會靜默勝出。一個產出一個檔，這兩個靜默失敗都沒有立足點。

## Considered Options

- **維持兩步兩檔，只修 fallback 的新鮮度比對（否決）**：治得了 sourced 檔靜默勝出，治不了 id 命名空間分裂——那 39 個錨不到的 anchor 與拆項改寫 id 的先後順序有關，不是新鮮度問題。
- **只合併觸發、仍落兩份檔（否決）**：使用者少打一次指令，套用點與 id 改寫的先後完全不變，66% 的裂縫原封不動。表面收斂、實質不變。
- **合併成一步、單一產出（採用）**：`workitems.json` 是唯一的工項檔，分工鏈長在工項身上（見 ADR-0016）。乾跑因此拿得到派工事實，鏈硬底線可以在乾跑就算得出來。

## checkpoint 少一道，用逃生口補回

ADR-0001 拆步的三個理由是 checkpoint、可單獨重跑、可局部除錯。合併確實拿掉一道 checkpoint，也確實讓「改派工」變貴：今天改派工是手改 `workitems-sourced.json` 一次、零重跑；合併後若只有修訂這條路，就變成寫 `set partyChain` ＋重跑 `f2w-breakdown`，而後端 id 非確定性（ADR-0013:16），這一跑會把當前錨得住的 106 個凍結點放上賭桌。

所以**明文保留手改逃生口**：`workitems.json` 是宣告式逃生口，派錯方可以直接手改該檔、零重跑，與現行手改 sourced 檔對等；只有想讓校正跨重跑存活時才寫成修訂。這一點要寫進 `f2w-breakdown` 的 SKILL.md，否則合併就是純退化。

「可單獨重跑」與「可局部除錯」由三態保護（見 ADR-0018）：沒有派工輸入時照跑不產 `partyChain`，所以純自建專案不受影響；派工失敗時整步不落地並逐一列名，除錯範圍仍然是一步。

## Consequences

- `src/sourcing/` 整個目錄退場，`buildSourcedWorkitems`／`loadWorkitemsForSourcing`／`saveSourcedWorkitems`／`SourcingConsistencyError` 隨之消失；`parseVendorSpec` 與 `parseSwimlaneDiagram` 移入 `src/breakdown/`。
- `src/output.ts` 的 `CONTRACT_FILES` 移除 `workitemsSourced`，`CONTRACT_PRODUCER` 對應項一併移除。
- `f2w-breakdown-export` 只讀 `workitems.json`，`existsSync` 的 fallback 分支整段刪掉。
- ADR-0004 的「獨立可選插入步」與「sourced 檔在就讀、不在退回」兩條被取代；其餘條文（注入後端事實、`sourcingConfirmed` 獨立於 `inferred`、`assignedParty` 值域隨輸入而定、端點存在性照校）全數存活。
- ADR-0007 中依附 `workitems-sourced.json` 的部分被取代，決策本體（以泳道圖派工、Vendor spec 為輔助證據）不變。
- 既有四份 `output/`：`0721`／`0729` 沒有 `workitems.json`，不受影響；`0714` 沒有分工需求，不改一個字就能過新契約；`new_0724` 是唯一要重跑的。
