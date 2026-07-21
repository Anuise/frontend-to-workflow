---
name: f2w-sourcing
description: frontend-to-workflow 管線 breakdown 與 breakdown-export 之間的可選插入步。吃人提供的 Vendor spec（OpenAPI／Swagger），為 workitems.json 的每個後端工項定 Sourcing decision（vendor-direct 直接呼叫／vendor-adapted 接回自建處理／self-built 自建／needs-investigation 待查），vendor-adapted 拆成串接＋自建處理兩筆，組裝驗證後寫入 workitems-sourced.json。前端工項原封複製。有供應商才插；缺 workitems.json 時提示先跑 f2w-breakdown。Use when the user wants to run f2w-sourcing, decide vendor-vs-self sourcing for backend work items, match backend items against a vendor OpenAPI spec, or produce workitems-sourced.json for the frontend-to-workflow pipeline.
---

# f2w-sourcing：後端工項來源決策（供應商 vs 自建）

管線的**可選插入步**，位於第五步 `f2w-breakdown` 與第六步 `f2w-breakdown-export` 之間。讀 `output/<project>/workitems.json` 的後端 Work item，對照人提供的 **Vendor spec**，為每筆定一個 **Sourcing decision**，產出 `output/<project>/workitems-sourced.json`（**完整副本**：前端原封複製、後端貼標＋拆項）。有供應商才插；純自建專案跳過此步，`f2w-breakdown-export` 會退回讀 `workitems.json`。

前置：`output/<project>/workitems.json`（由 f2w-breakdown 產出）。缺件即中止並提示先跑 f2w-breakdown。
輸入（人提供）：一份以上 **Vendor spec**（OpenAPI／Swagger），放在 Workspace 的 Project 內，**觸發本步時強制指定路徑**；供應商識別名 = 檔名（去副檔名）。未指定任何 spec 即中止（本步意義在有 spec）。
產出：`output/<project>/workitems-sourced.json`。
決策見 ADR-0004（注入供應商事實、逸出 ADR-0002；重構拆項讓渡冪等）。

## 流程

1. **讀取前置** — `loadWorkitemsForSourcing(outputRoot, project)`
   - 讀回並經契約驗證 `workitems.json`（前端／後端 Work item）。缺件丟 `MissingPrerequisiteError`（提示先跑 f2w-breakdown），**中止**。
2. **解析 Vendor spec 成能力清單** — `parseVendorSpec(specPath)`（**確定性**，不由 AI 抽取）
   - 對觸發時指定的每份 OpenAPI／Swagger，解析出 **Vendor capability** 清單（endpoint ＋ 參數 ＋ 回應 schema），標上供應商識別名。解析失敗（非合法 spec）即報錯中止。無 spec 指定即中止。
3. **逐後端工項定 Sourcing decision**（以 capabilities 為據、**繁體中文**）
   - 對 `workitems.json` 的**每一個**後端工項，AI 對 union of Vendor capability 語意配對，歸入四桶之一並填新欄：
     - **sourcing**：`vendor-direct`（直接呼叫）／`vendor-adapted`（接回自建處理）／`self-built`（自建）／`needs-investigation`（規格不明無法判定）。
     - **vendor**／**vendorEndpoints**：vendor-direct／vendor-adapted 填配到的供應商與端點（端點須真的存在於該 spec）；self-built／needs-investigation 留空。
     - **sourcingConfirmed**：一律 `false`（AI 配對·待確認，開工前人核）。
   - **vendor-adapted 拆兩筆**：一筆「串接供應商端點」（`adaptationRole: "fetch"`）＋一筆「自建處理層」（`adaptationRole: "process"`），process 筆 `dependsOn` 串接筆；兩筆都填 `sourcing: "vendor-adapted"` 與 **originItemId**（溯回被拆的原始後端工項 id）。其餘三桶不拆。
   - **前端工項原封複製**、不動。
4. **組裝並驗證** — `buildSourcedWorkitems(workitems, capabilities, decisions)`
   - 硬底線把關：**每個後端工項都有 sourcing 值**；**端點參照**（vendor-direct／vendor-adapted 的 `vendorEndpoints` 每條存在於對應 Vendor spec）；**桶別欄位一致**（self-built／needs-investigation 不得帶 vendor／endpoint；`adaptationRole` 存在 iff sourcing=vendor-adapted）；**sourcingConfirmed 一律 false**；**id 全域唯一**（含新拆出的子工項）；**dependsOn** 每個 id 存在於本批（`originItemId` 純溯源、**不校參照**）；**前端逐項相符**（sourced 的 frontend 陣列與來源 workitems.json 逐項一致，擋複製漂移）。
   - 端點或欄位一致性不符丟 `SourcingConsistencyError`；不合契約冒泡 `ContractValidationError`。
5. **保存** — `saveSourcedWorkitems(outputRoot, project, sourced)`
   - 通過契約驗證才寫 `output/<project>/workitems-sourced.json`；驗證失敗丟 `ContractValidationError` 且不落地。

## 逃生口

`workitems-sourced.json` 是宣告式逃生口：配錯桶、endpoint 配錯、vendor-adapted 拆得不當時，直接手改該檔（改 `sourcing`／`vendor`／`vendorEndpoints`、增刪拆項、調 `dependsOn`／`adaptationRole`），符合契約即可交給 f2w-breakdown-export。若問題出在上游後端工項本身（漏項、推論抓錯），先回頭手改 `workitems.json` 或重跑 f2w-breakdown，再重跑本步。若供應商能力抓錯，回頭校對 Vendor spec 再重跑。

## 對應實作

`src/sourcing/`（規劃中，本場僅定案設計）：`loadWorkitemsForSourcing`（前置檢查＋讀回 workitems.json）、`parseVendorSpec`（OpenAPI／Swagger → Vendor capability 的確定性解析）、`buildSourcedWorkitems`（端點參照＋桶別欄位＋前端相符的硬底線把關、按 vendor-adapted 拆項的組裝核心）、`saveSourcedWorkitems`（驗證後保存）。契約見 `src/contracts/sourcedWorkitems.ts`（規劃中，擴充 `workitems.ts` 的後端工項欄位）；路徑見 `src/output.ts`（新增契約名對到 `workitems-sourced.json`）。決策見 ADR-0004（來源決策、注入供應商事實、重構拆項）、ADR-0002（後端工項為 AI 推論）、ADR-0003（前端工項逐操作硬底線）。
