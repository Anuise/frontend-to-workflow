# T5：交付物層展開——一筆 partyChain 展開成 N 列，gary 中繼列現身

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

`f2w-breakdown-export` 只讀 `workitems.json`（`existsSync` 的 sourced fallback 整段刪掉），並在組後端 sheet 時把每筆 `partyChain` 展開成列：**一個 leg 一列**。

每列的內容：

- **列標籤**用 T2 匯出的 `partyLegLabel`：單 leg ＝ 工項 id；多 leg ＝ `<工項id>#<leg序>`。
- **分工方**＝該 leg 的 `party`；**供應商**／**端點**＝該 leg 的 `vendor`／`vendorEndpoints`（gary 當純通道時兩欄留空）。
- **標題／範疇／驗收**取該 leg 的 `title`／`scope`／`acceptance`；缺欄時（只可能是單 leg）繼承工項層。**這是本票的重點**——沒有 leg 散文，gary 那一列就會顯示 leadtek 的活與 leadtek 的驗收。
- **分工段**欄顯示 `<leg序>/<鏈長>`（如 `2/3`），讓讀者一眼看出這是中繼段。
- **推論狀態**沿用「推論·待確認」，**畫押欄（估時／優先級／RACI／簽核日期／狀態）逐列留白**——一列一個 leg 一個 A，滿足 RACI 鐵律。

不帶 `partyChain` 的專案（如 `0714`）走原本的一工項一列，不多欄、不多列。

**工作副本遷移**：列數與 id 形態都變（`new_0724` 實測後端 99 → 123 列），會打斷範本承諾的「重跑只覆蓋範本、不動工作副本」。既有工作副本無法自動遷移，SKILL.md 要寫明「舊工作副本的列與新範本對不上，需人工對照」。既有欄名「派工方」保留，不改名。

決策見 ADR-0016。

## Acceptance criteria

- [ ] `f2w-breakdown-export` 不再有讀 `workitems-sourced.json` 的程式路徑
- [ ] `new_0724` 重跑後 `workitems.xlsx` 的後端 sheet 有 **123 列**（21 筆單 leg ＋ 15 筆兩 leg ＋ 24 筆三 leg）
- [ ] 24 筆三 leg 工項各有一列 `分工方 = gary`、`供應商` 與 `端點` 皆空、`分工段 = 2/3`
- [ ] 那 24 列 gary 的標題／範疇／驗收**不等於**同組 leadtek 列的對應欄（逐列比對，0 筆相同）
- [ ] `BE-MODEL-1` 的三列標籤為 `BE-MODEL-1#1`／`BE-MODEL-1#2`／`BE-MODEL-1#3`
- [ ] 單 leg 工項的列標籤是裸 id（無 `#`）
- [ ] 畫押欄逐列留白；「推論狀態」逐列為「推論·待確認」
- [ ] `0714`（不帶 `partyChain`）匯出後列數等於後端工項數 19，無分工欄位造成的空白列
- [ ] `f2w-breakdown-export` 的 SKILL.md 寫明展開規則與工作副本需人工對照遷移

## Blocked by

- T2（`partyChain` 契約與 `partyLegLabel`）
- T3（產得出帶三 leg 的資料）
