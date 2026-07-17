# 新增 f2w-breakdown 步驟：後端工項為 AI 推論，刻意打破 pure-frontend 地基

frontend-to-workflow 原本每一步都假設 Project 是 **Pure-frontend**、無後端（見 `CONTEXT.md`），`workflow.json` 也零後端欄位。新增的 `f2w-breakdown` 步驟要產出「後端工項劃分」，因此**刻意打破這個地基假設**：既然 `workflow.json` 沒有後端資訊，後端 Work item 只能由 AI 從每個 Page 的 `actions`／`content` **推論**而來，一律標為「推論·待確認」（`inferred: true`），與觀察自畫面的前端 Work item 嚴格區分。

## Considered Options

- **只做前端工項**：完全守住 pure-frontend、最安全；但交付物少了後端分工，不符「前端＋後端工項劃分」的需求。
- **另外要求使用者提供後端輸入（API 清單／需求檔）**：不臆測、最準；但多增一個前置輸入，且多數情況使用者手上根本沒有這份輸入。
- **AI 推論後端工項、標「推論·待確認」（採用）**：從既有前端上下文生出可用的後端工項草稿，代價是這些工項是推論而非事實，必須明確標注、開工前由人確認。

## Consequences

- pure-frontend 不再是全管線一致的假設：它仍適用於 `f2w-start`／`f2w-capture`／`f2w-describe`／`f2w-export`（記錄既有前端），但 `f2w-breakdown` 明確逸出——這是 **documentation 管線**與 **planning 管線**的分界。
- 後端工項的正確性責任落在「開工前的人工確認」，不在工具；`workitems.xlsx` 的「推論·待確認」旗標與 `workitems.json` 的 `inferred: true` 是這道防線。
- 未來若要提高後端準確度，擴充點是「另吃一份後端輸入」，可與推論並存（推論為預設、有輸入時以輸入為準）。
