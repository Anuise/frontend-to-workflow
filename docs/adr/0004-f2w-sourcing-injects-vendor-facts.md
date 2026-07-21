# 新增 f2w-sourcing 可選插入步：注入供應商事實，為後端工項定來源決策

在 `f2w-breakdown` 與 `f2w-breakdown-export` 之間新增一個**可選插入步** `f2w-sourcing`：吃人提供的 **Vendor spec**（OpenAPI／Swagger），為每個後端 Work item 定一個 **Sourcing decision**（vendor-direct／vendor-adapted／self-built／needs-investigation），產出 `workitems-sourced.json`。這**再一次刻意逸出** ADR-0002 的地基——ADR-0002 讓後端工項全由 AI 推論（無後端事實可觀察），本步反過來**注入一份後端事實**（供應商能力），讓「哪些後端工作根本不必自建」有據可依。

## Considered Options

- **不做、後端一律當自建**：最簡；但漏掉「供應商 API 已能達成」這個對估時與分工影響極大的事實，交付的後端劃分失真。
- **在 f2w-breakdown 內就吃供應商 spec**：少一步；但把「純推論」與「對事實配對」兩種本質不同的職責混進同一步，且逼每個專案都要有 spec，破壞 breakdown 對無供應商專案的適用性。
- **獨立可選插入步 f2w-sourcing（採用）**：有供應商才插，純自建專案原六步不受影響（`f2w-breakdown-export`「sourced 檔在就讀、不在退回 `workitems.json`」）；推論與配對兩職責分屬兩步、各自可重跑除錯。

## Consequences

- **兩個獨立的誠實維度並存**：`inferred`（工項存不存在待後端確認，ADR-0002 的防線）＋ `sourcingConfirmed`（AI 配對對不對待人核，本步的防線，AI 產出一律 false）。Vendor capability 的**存在**是事實（spec 確定性解析），但「這條 endpoint 滿足這個工項」是推論。
- **讓渡冪等換表達力**：本步准許**重構拆項**——vendor-adapted 拆成 fetch（串接）＋ process（自建處理）兩筆、以 `dependsOn` 串、各帶 `originItemId` 溯回被拆的原始工項。原工項被移除，故 `originItemId` 是**純溯源字串、不做參照完整性檢查**（有別於 `dependsOn` 須存在於本批）。代價是重跑不再逐筆冪等；換得的是串接與處理職責分離，後端可分派、可各自畫押。
- **可確定性校驗的新硬底線**：因 spec 被解析成 Vendor capability，vendor-direct／vendor-adapted 工項參照的 endpoint **必須真的存在於該 spec**（可校驗，不像後端工項本身無法錨定）；self-built／needs-investigation 不得帶 vendor／endpoint；`adaptationRole` 存在 iff sourcing=vendor-adapted；前端陣列與來源 `workitems.json` 逐項相符（擋完整副本的複製漂移）。
- **spec 是人提供的輸入、不是上一步產物**：放 Workspace 的 Project 內、觸發時強制指定路徑，呼應「source code 住 Workspace、產物住 output」的既有分界；衍生的來源劃分仍落 `output/<project>/`。
