# T1：確定性泳道圖解析器（泳道名、節點歸屬、方層跳躍、宣告鏈）

State: open
Status: ready-for-agent
Created: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

新增純函式 `parseSwimlaneDiagram(diagramPath): SwimlaneGraph`，與 `parseVendorSpec` 對稱（`readFileSync` ＋ 純結構走訪，不經 AI，自帶 Error class，由 index re-export）。

回傳 `SwimlaneGraph { parties: string[], nodes: SwimlaneNode[], partyEdges: Array<[string, string]>, declaredChains: string[][], warnings: string[] }`。

解析規則：

1. **泳道**＝`style` 以 `swimlane` 開頭的 cell，`value` 即分工方名。實檔為 `lane_m`／`lane_g`／`lane_l`，`value` 逐字 `mobagel`／`gary`／`leadtek`，三者 `parent="1"`。
2. **節點歸屬**先走 `parent` 鏈上溯到泳道；掛在 root（`parent="1"`）的節點以**矩形包含**補判（子 cell 座標是相對於泳道的，要累加成絕對座標）。實檔的 `l_apiserver` 與 `m_front1` 都是 `parent="1"`，靠幾何才落對。
3. **排除**：`style` 以 `text` 開頭的純標籤 cell；幾何落在最下方泳道底緣之外的圖例色塊（實檔的 `leg_*`）。
4. **方層跳躍**：對每條有 `source`／`target` 的邊，把兩端解析到所屬方，兩端方不同就產生一條 `partyEdges`。指向群組框的邊要 fan-out 到群組成員。任一端落在「非任一方」（如 `n_ext`）時不產生方層跳躍，但要列進 `warnings`。
5. **宣告鏈**：讀出寫著呼叫鏈宣告的 cell（實檔是 `leg_chain`，`value` 逐字「API 呼叫鏈只有三種：① frontend → mobagel　② frontend → mobagel → gary　③ frontend → mobagel → gary → leadtek」），依序號切成多條鏈，每條鏈按箭頭切 token，**不是泳道名的 token（如 `frontend`）丟掉**。
6. **交叉檢查**：宣告鏈裡某個相鄰跳躍在 `partyEdges` 找不到支持時發 warning **不中止**。

另加 `derivePartyChains(graph)` 之類的存取器讓下游拿到宣告鏈；不做「哪一格對應哪個工項」的配對——那仍是 AI 的事（ADR-0007）。

決策見 ADR-0014。

## Acceptance criteria

- [ ] `parseSwimlaneDiagram` 拿實檔 `workspace/spec/new_0724_AI六大模組管理平台_桃園智發會_最新版/桃園刑大ai_platform.drawio` 解析出 `parties` 逐字 `["mobagel", "gary", "leadtek"]`
- [ ] `l_apiserver`（`parent="1"`）由幾何包含落在 `leadtek`；`m_front1`（`parent="1"`）落在 `mobagel`
- [ ] `n_ext`（外部 AP，泳道外）歸屬為「非任一方」，且它的邊 `n_ext → g_apisix` 不產生方層跳躍、列進 `warnings`
- [ ] 六個 `style` 以 `text` 開頭的純標籤 cell 與四個圖例色塊 `leg_*` 都不出現在 `nodes`
- [ ] `partyEdges` 含 `mobagel → gary` 與 `gary → leadtek`；**不含** `mobagel → leadtek`（圖上沒有 `m_back1 → l_apiserver`）
- [ ] 邊 `e9`（`g_dlp`@lane_g → `g_agent`@lane_l）純由 `parent` 鏈就解析出 `gary → leadtek`，不依賴幾何
- [ ] `declaredChains` 逐字等於 `[["mobagel"], ["mobagel","gary"], ["mobagel","gary","leadtek"]]`，`frontend` 這個 token 被丟掉
- [ ] 非合法 mxfile 丟自帶的 Error class；`.$*`／`*.bkp` 的排除不在本函式（是票 04 的掃描層職責），本函式收到備份檔路徑仍應正常解析

## Blocked by

- 無，可立刻開工
