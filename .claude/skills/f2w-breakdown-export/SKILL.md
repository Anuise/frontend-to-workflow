---
name: f2w-breakdown-export
description: frontend-to-workflow 管線的第六步（最後一步）。讀取 workitems.json，確定性地組裝出最終交付範本 workitems-<年月日-時分秒>.xlsx（如 workitems-20260803-153012.xlsx）：含「概述」「前端工項」「後端工項」三個 sheet，承諾型畫押欄（估時／優先級／RACI／簽核日期／狀態）留白的 Template workbook；後端工項多一欄「推論狀態」標「推論·待確認」。帶 Party chain（分工鏈）時後端 sheet 一個 leg 一列展開，列標籤是 <工項id>#<leg序>。檔名帶時戳，每次重跑各留一份、不覆蓋舊檔。不嵌截圖。缺前置檔時提示先跑 f2w-breakdown。Use when the user wants to run f2w-breakdown-export, assemble the workitems workbook, expand party chains into one row per leg, or produce a timestamped workitems xlsx for the frontend-to-workflow pipeline.
---

# f2w-breakdown-export：組裝工項範本（workitems-<年月日-時分秒>.xlsx）

管線的第六步（最後一步）。讀取 f2w-breakdown 的產出 `output/<project>/workitems.json`（前端／後端 Work item 的內容型欄位，後端可帶分工鏈），確定性地組裝出最終交付範本 `output/<project>/workitems-<YYYYMMDD-HHmmss>.xlsx`：含「概述」「前端工項」「後端工項」三個 sheet，且**權責畫押欄留白**的 **Template workbook（範本）**。跑完這票，使用者能對一個已有 `workitems.json` 的 Project 得到一份可交給多人協作、逐項權責畫押的 Excel。

前置：`output/<project>/workitems.json`（由 f2w-breakdown 產出）。缺件即中止並提示先跑 f2w-breakdown。
產出：`output/<project>/workitems-<YYYYMMDD-HHmmss>.xlsx`（時戳＝寫檔當下的**本地**年月日時分秒，如 `workitems-20260803-153012.xlsx`）。每次重跑各留一份、**不覆蓋**舊檔；最新的一份就是時戳最大的（檔名可直接字典序排序）。
假設：沿用 ADR-0002——後端 Work item 一律是 AI 推論的 **Inferred work item**，在「後端工項」sheet 以「推論狀態＝推論·待確認」明示，開工前的正確性責任落在人工確認。

**只有一份來源檔**：分工鏈長在工項身上、多列只在本步展開，所以沒有第二份 sourced 檔要挑，也就沒有兩份檔之間的新鮮度問題（見 `docs/adr/0016-work-item-carries-party-chain.md`）。

**為何畫押欄留白**：估時／優先級／RACI／簽核日期／狀態是多人協作的**承諾型**權責畫押值，不由 AI 代填、也不進 `workitems.json`（見 f2w-breakdown 與 CONTEXT.md「權責畫押」「範本／工作副本」）。本步只出**表頭在、值空**的範本；畫押值由人在另存的**工作副本（Working copy）**填。

## 分工鏈的展開規則

後端工項帶 `partyChain` 時，「後端工項」sheet **一個 leg 一列**（一筆 N 個 leg 的工項展開成 N 列），並在「推論狀態」之後多一組分工欄：

- **列標籤（工項ID 欄）**：單 leg ＝ 裸工項 id；多 leg ＝ `<工項id>#<leg序>`（leg 序從 1 起，如 `BE-MODEL-1#2`）。工項 id 由契約層保證不含 `#`，所以標籤永不撞號——**它也是合法的修訂錨**，照著抄進 `f2w-revise` 錨得到東西。
- **派工方**＝該 leg 的 `party`（`needs-investigation` 顯示「待查」）；**供應商**／**供應商端點**＝該 leg 的 `vendor`／`vendorEndpoints`。純通道的中繼段兩欄留空是正常的（該方只做轉發）。
- **標題／範疇／驗收標準**取**該 leg 自己的**散文，缺欄時（只可能是單 leg）才繼承工項層。這是本步的重點：沒有 leg 散文，中繼那一列會顯示下游方的活與下游方的驗收，該方就無從畫押。
- **分工段**＝`<leg序>/<鏈長>`（如 `2/3`），一眼看出這是中繼段還是終點。
- **來源狀態**＝「配對·待確認」（契約層 `sourcingConfirmed` 恆為 false）。它與「推論狀態」是兩個獨立的待確認維度。
- **畫押欄逐列留白**——一列一個 leg 一個 A，滿足 RACI 鐵律。

不帶 `partyChain` 的專案走原本的一工項一列，不多欄、不多列。

> **工作副本遷移**：改成一 leg 一列之後，後端列數與列標籤形態都變了（實測 `new_0724` 由 99 列變 123 列），舊工作副本與新範本對不上。**既有工作副本無法自動遷移**：舊副本的列與新範本對不上，需人工對照把畫押值搬過去。既有欄名「派工方」保留、不改名，減少對照成本。

## 流程

1. **讀取前置** — `loadWorkitemsForExport(outputRoot, project)`
   - 讀回並驗證 `workitems.json`，回傳 `Workitems`。缺件丟 `MissingPrerequisiteError`（提示先跑 f2w-breakdown），**中止**。
2. **組裝 Workbook** — `buildWorkitemsWorkbook(workitems)`（確定性核心，不碰 fs、不嵌截圖）
   - 「概述」sheet：整體敘述 ＋ 工項統計（前端筆數／後端筆數／推論筆數）＋ RACI 圖例（A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知）、狀態圖例（未開始／進行中／審查中／完成／擱置）、估時單位（人天）與優先級（P0／P1／P2）；帶分工鏈時再補一段分工圖例（本批出現的派工方、展開後的列數、列標籤與「分工段」欄的讀法）。
   - 「前端工項」sheet：每列一筆前端 Work item。AI 內容型欄填值：工項ID｜來源Page｜標題｜範疇｜驗收標準｜依賴｜風險備註；承諾型欄留白：估時｜優先級｜R｜A｜C｜I｜簽核日期｜狀態。
   - 「後端工項」sheet：欄位同前端，額外一欄「推論狀態」一律顯示「推論·待確認」；帶分工鏈時依上節的展開規則出列並加分工欄（派工方｜供應商｜供應商端點｜分工段｜來源狀態）。
   - 此函式不碰檔案，可獨立單元測試。
3. **保存** — `saveWorkitemsWorkbook(outputRoot, project, workbook, at?)`
   - 把組好的 Workbook 寫成 `output/<project>/workitems-<YYYYMMDD-HHmmss>.xlsx`，回傳寫入路徑（含時戳，回報給使用者時照抄）。
   - `at` 省略時取寫檔當下的本地時間；可注入固定 `Date` 讓測試斷言檔名。

## 逃生口

產出的 xlsx 是**範本**，不預期直接手改：內容不對時回頭改上游宣告式檔案 `workitems.json`（增刪工項、改 title／scope／acceptance／dependsOn、調整前端／後端歸屬、**改 `partyChain` 派工**）再重跑本步。重跑產生的是**新一份帶時戳的範本**，舊範本原地留著、**不被覆蓋**——人填畫押值的**工作副本**本來就另存，現在連範本本身也不會被重跑動到（要清舊範本由使用者自行決定）。換到新範本時畫押值仍須人工搬（首次切到分工鏈形態的列形態變動見上方遷移說明）。若問題出在更上游的頁面描述，先回頭改 `workflow.json` 或重跑 f2w-describe／f2w-breakdown。

## 對應實作

`src/breakdown-export/`：`loadWorkitemsForExport`（前置檢查＋讀回 workitems.json）、`hasPartyChains`（這批工項是否帶分工鏈）、`expandBackendRows`（一個 leg 一列的展開，列標籤走 `partyLegLabel`、散文缺欄才繼承工項層）、`buildWorkitemsWorkbook`（組出三個 sheet、承諾型欄逐列留白、後端加「推論狀態」與分工欄的確定性核心）、`saveWorkitemsWorkbook`（寫出帶時戳的 workitems xlsx）。列標籤公式 `partyLegLabel` 與其反向 `parsePartyLegLabel` 是單一來源，見 `src/contracts/workitems.ts`；路徑見 `src/output.ts`（交付物檔名走 `timestampedContractPath`，契約名 `workitemsWorkbook` 的基底檔名＝`workitems.xlsx`，時戳插在副檔名之前；時戳格式 `YYYYMMDD-HHmmss` 的單一來源是同檔的 `timestampSuffix`）。決策見 ADR-0002（後端工項為 AI 推論）、`docs/adr/0007-party-assignment-from-swimlane-diagram.md`（配對仍是 AI 推論、靠人核兜底）與 `docs/adr/0016-work-item-carries-party-chain.md`（工項帶分工鏈、交付物才展開成列）。Excel 產生使用 `exceljs`。
