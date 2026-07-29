---
name: f2w-sourcing
description: frontend-to-workflow 管線 breakdown 與 breakdown-export 之間的可選插入步。吃人提供的權責泳道圖（draw.io，泳道＝分工方）與 Vendor spec（OpenAPI／Swagger，皆可選、至少一份），為 workitems.json 的每個後端工項定 Party assignment（分工歸屬）——派給一個分工方（如 mobagel／gary／leadtek）或 needs-investigation 待查，跨方接力的工項拆成多筆接力，組裝驗證後寫入 workitems-sourced.json。前端工項原封複製。有分工圖或供應商才插；缺 workitems.json 時提示先跑 f2w-breakdown。Use when the user wants to run f2w-sourcing, assign backend work items to responsible parties from a swimlane diagram, match backend items against a vendor OpenAPI spec, or produce workitems-sourced.json for the frontend-to-workflow pipeline.
---

# f2w-sourcing：後端工項分工歸屬（誰做哪一塊）

管線的**可選插入步**，位於第五步 `f2w-breakdown` 與第六步 `f2w-breakdown-export` 之間。讀 `output/<project>/workitems.json` 的後端 Work item，對照人提供的**權責泳道圖**與 **Vendor spec**，為每筆定一個 **Party assignment（分工歸屬）**，產出 `output/<project>/workitems-sourced.json`（**完整副本**：前端原封複製、後端貼標＋拆項）。有分工圖或供應商才插；純自建、無多方分工的專案跳過此步，`f2w-breakdown-export` 會退回讀 `workitems.json`。

前置：`output/<project>/workitems.json`（由 f2w-breakdown 產出）。缺件即中止並提示先跑 f2w-breakdown。

輸入（人提供，**兩種皆可選、至少一份**，皆缺即中止）：

1. **權責泳道圖**（draw.io，例：`workspace/spec/桃園刑大ai_platform.drawio`）——泳道＝分工方（Party）、格＝該方負責的元件、邊＝呼叫／資料流。**平台級共用文件、可跨 project**，不必為單一專案而畫；觸發時指定路徑，一次一張。
2. **Vendor spec**（OpenAPI／Swagger，0..n 份，一檔一家）——供應商識別名＝檔名（去副檔名）；觸發時指定路徑。

產出：`output/<project>/workitems-sourced.json`。
決策見 ADR-0007（泳道圖注入分工事實、四桶改方名）與 ADR-0004（注入供應商事實的原始決策，部分被 0007 取代）。

## 流程

1. **讀取前置** — `loadWorkitemsForSourcing(outputRoot, project)`
   - 讀回並經契約驗證 `workitems.json`（前端／後端 Work item）。缺件丟 `MissingPrerequisiteError`（提示先跑 f2w-breakdown），**中止**。
2. **讀權責泳道圖**（若有提供；**AI 讀圖，不經解析器**）
   - AI 直接讀 draw.io XML，抽出**泳道名清單**（分工方集合）與各泳道負責的元件。圖是共用文件、細節與本專案的對應由 AI 推斷，錯配靠 `sourcingConfirmed` 人核兜底（ADR-0007 的取捨）。抽出的泳道名在執行紀錄中列給人看。
3. **解析 Vendor spec 成能力清單**（若有提供）— `parseVendorSpec(specPath)`（**確定性**，不由 AI 抽取）
   - 對每份 OpenAPI／Swagger 解析出 **Vendor capability** 清單（endpoint ＋ 參數 ＋ 回應 schema），標上供應商識別名。解析失敗（非合法 spec）即報錯中止。
   - 兩種輸入皆未提供即**中止**（分工方集合為空，本步無據可依）。
4. **逐後端工項定 Party assignment**（以泳道圖為主據、capabilities 為輔助證據、**繁體中文**）
   - 對 `workitems.json` 的**每一個**後端工項，AI 對照泳道元件與 Vendor capability 語意配對，填新欄：
     - **assignedParty**：分工方名（∈ 泳道名 ∪ spec 供應商名）；從圖與 spec 都判不出誰做時填 `needs-investigation`（待查）。
     - **vendor**／**vendorEndpoints**：配到某份 spec 的端點才**成對**填上（端點須真的存在於該 spec）；與 assignedParty **脫鉤**——派給 gary 但 gary 沒給 spec，合法（兩欄留空）。`needs-investigation` 不得帶。
     - **sourcingConfirmed**：一律 `false`（AI 配對·待確認，開工前人核）。
   - **跨方接力拆多筆**：一筆工項橫跨兩方（如一方出 API、另一方接回處理）時，拆成 ≥2 筆**接力**——首筆承接原依賴，其後逐筆 `dependsOn` 前一筆，各自 `assignedParty`、各帶 **originItemId**（溯回被拆的原始後端工項 id）。單一方能做完的不拆。
   - **前端工項原封複製**、不動。
5. **組裝並驗證** — `buildSourcedWorkitems(workitems, parties, capabilities, assignments)`
   - `parties` 是步驟 2 抽出的泳道名清單（無圖時傳空陣列）；builder 以 **parties ∪ spec 供應商名** 為分工方集合。
   - 硬底線把關：**每個後端工項都有 assignedParty**；**方名集合校驗**（`assignedParty ∈ 分工方集合 ∪ {needs-investigation}`；集合為空即報錯）；**端點參照**（`vendorEndpoints` 每條存在於對應 Vendor spec）；**欄位一致**（vendor 與 vendorEndpoints 成對；needs-investigation 不得攀附）；**sourcingConfirmed 一律 false**；**id 全域唯一**（含拆出的子工項）；**dependsOn** 每個 id 存在於本批（`originItemId` 純溯源、**不校參照**）；**前端逐項相符**（sourced 的 frontend 陣列與來源 workitems.json 逐項一致，擋複製漂移）。
   - 不一致丟 `SourcingConsistencyError`；不合契約冒泡 `ContractValidationError`。
6. **保存** — `saveSourcedWorkitems(outputRoot, project, sourced)`
   - 通過契約驗證才寫 `output/<project>/workitems-sourced.json`；驗證失敗丟 `ContractValidationError` 且不落地。

## 逃生口

`workitems-sourced.json` 是宣告式逃生口：派錯方、endpoint 配錯、拆項拆得不當時，直接手改該檔（改 `assignedParty`／`vendor`／`vendorEndpoints`、增刪拆項、調 `dependsOn`），符合契約即可交給 f2w-breakdown-export。若問題出在上游後端工項本身（漏項、推論抓錯），先回頭手改 `workitems.json` 或重跑 f2w-breakdown，再重跑本步。若泳道歸屬抓錯，回頭校對權責泳道圖再重跑；若供應商能力抓錯，校對 Vendor spec 再重跑。

## 對應實作

`src/sourcing/`：`loadWorkitemsForSourcing`（前置檢查＋讀回 workitems.json）、`parseVendorSpec`（OpenAPI／Swagger → Vendor capability 的確定性解析）、`buildSourcedWorkitems`（方名集合＋端點參照＋前端相符的硬底線把關、按跨方接力拆項的組裝核心；`PartyAssignment`／`SplitPart` 為決策輸入型別）、`saveSourcedWorkitems`（驗證後保存）。契約見 `src/contracts/sourcedWorkitems.ts`（`assignedParty` 等欄位、`NEEDS_INVESTIGATION` 保留值）；路徑見 `src/output.ts`（契約名 `workitemsSourced`＝`workitems-sourced.json`）。決策見 ADR-0007（分工歸屬）、ADR-0004（原四桶設計，部分被取代）、ADR-0002（後端工項為 AI 推論）、ADR-0003（前端工項逐操作硬底線）。
