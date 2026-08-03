---
name: f2w-breakdown
description: frontend-to-workflow 管線的第五步。讀取 workflow.json，依逐頁 Workflow description 把每個 Page 拆成前端工項（觀察自畫面、逐可執行操作至少一筆）與後端工項（AI 推論、標「推論·待確認」、依 API／驗證／查詢拆多筆），並在同一步為每筆後端工項定 Party chain（分工鏈），組裝驗證後寫入 workitems.json。前端有硬底線：每頁前端工項數 ≥ max(1, 該頁 actions 數)；後端有鏈硬底線：方序列必須逐字等於泳道圖上宣告的呼叫鏈之一。承諾型欄位（估時／優先級／RACI／簽核／狀態）刻意不進 json。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-breakdown, break workflow pages into frontend/backend work items, assign backend work to responsible parties, or produce workitems.json for the frontend-to-workflow pipeline.
---

# f2w-breakdown：前端／後端工項劃分與派工

管線的第五步。讀取 f2w-describe 的產出（`output/<project>/workflow.json`），依每個 **Page** 的 Workflow description，把工作拆成 **前端 Work item**（觀察自畫面）與 **後端 Work item**（AI 從前端操作推論而來），並為每筆後端工項定一條 **Party chain（分工鏈）**，組裝驗證後產出 `output/<project>/workitems.json`，交給後續 `f2w-breakdown-export`。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。另有兩份**可選**前置：`workspace/revisions/<project>/revisions.json`（由 f2w-revise 產出，缺檔視為沒有修訂）、`workspace/spec/<project>/`（權責泳道圖與 Vendor spec，目錄不存在即不派工）。
產出：`output/<project>/workitems.json`。
假設：**刻意打破純前端地基**（見 ADR-0002）。`workflow.json` 沒有後端資訊，後端工項只能由 AI 從每個 Page 的內容／操作**推論**，一律標為「推論·待確認」（`inferred: true`），與觀察自畫面的前端工項（`inferred: false`）嚴格區分；後端工項的正確性責任落在開工前的人工確認。**承諾型欄位**（估時／優先級／RACI／簽核日期／狀態）是多人協作的權責畫押值，**不進 `workitems.json`**——它們只在人工另存的工作副本裡填。

## 流程

1. **讀取前置** — `loadWorkflowForBreakdown(outputRoot, project)`
   - 回傳 `Workflow`（逐 Page 的用途、內容、可執行操作與操作去向）。缺 `workflow.json` 會丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **發現派工輸入** — `discoverPartyInputs(specRoot, project, manual?)`
   - 掃 `workspace/spec/<project>/`：project 根的 `.drawio` 是**權責泳道圖**（多於一張即報錯、要人指定）；`<方名>/*.json` 裡過 OpenAPI 指紋的是那個方的 **Vendor spec**，**目錄名即分工方名**（`gary/Gateway-API.json` → `gary`）。`.$*` 與 `*.bkp` 依檔名排除（draw.io 的自動備份本身是合法 mxfile，內容分不出來）；不過指紋的 `.json` 也列進「已排除」並說明原因，不靜默略過。
   - **三態**：目錄不存在＝安靜照跑、不產 `partyChain`（純自建專案什麼都不用做）；目錄存在但沒有任何可用檔＝**中止**（那更像擺錯位置而不是不派工）；手動指定路徑＝用指定的、忽略發現結果。
   - 分工方集合**純由泳道名決定**，所以 spec 目錄名必須是泳道名的子集，不是即報錯並列出兩邊集合（見 `docs/adr/0018-party-inputs-discovered-by-directory-convention.md`）。
   - 回傳的 `report` **每次都要列給使用者看**：用了哪張圖、哪幾份 spec、各自推出哪個方、哪些檔被排除與原因。不落第二份清單檔。
3. **逐 Page 劃分前端工項**（以 `workflow.json` 為據、**繁體中文**）
   - 對 `workflow.pages` 列出的**每一個** Page，依其 `actions`（可執行操作）**逐操作至少產出一筆**前端 Work item——不要把整頁塞成一團；純顯示頁（無 actions）至少產出一筆。涵蓋不得漏頁、顆粒度不得低於操作數（步驟 5 有硬底線把關）。每筆填**內容型欄位**：
     - **id**：全域唯一（跨前端＋後端）、**不得含 `#`**（那個字元保留給交付物的分工鏈列標籤）。**前端一律是 `FE-<頁序>-<該頁工項序>`**（兩段皆從 1 起、補零兩位，取自 `workflow.json` 的陣列索引；用 `frontendWorkitemId(pageIndex, itemIndex)` 算，不要自己編）——契約與 `buildWorkitems` 都會擋下不合推導值的 id，這是為了讓錨在 id 上的修訂撐得過一次重拆（見 ADR-0013）。後端 id 不受此格式約束。
     - **sourcePage**：此工項來源的 Page（`route` +（可選）`tab`），必須是 `workflow.pages` 裡存在的 Page。
     - **title**（標題）／**scope**（範疇）／**acceptance**（驗收標準）。
     - **dependsOn**：所依賴的其它工項 id（可空陣列），每個 id 必須存在於本批工項。
     - **risk**：風險備註（可空字串）。
4. **推論後端工項與分工鏈**
   - 從各 Page 的操作與內容推論所需的後端工作，**依 API／驗證／查詢等拆成多筆而非一團**（如儲存 API、欄位驗證、清單查詢各自成項），比照前端填同一組內容型欄位；這些工項一律是**推論·待確認**（`inferred` 由落在 backend 陣列決定，不用手填）。後端筆數無硬底線（推論而來、無法錨定 actions）。
   - 有派工輸入時，**每筆**後端工項再帶一個 `partyChain`：leg 陣列，每個 leg 是 `{ party, vendor?, vendorEndpoints, title?, scope?, acceptance? }`。
     - **一筆工項一份 id，多方接力只是多一個 leg，絕不拆項**——拆項會改寫 id、讓使用者照交付物寫下的修訂錨不到東西（見 `docs/adr/0016-work-item-carries-party-chain.md`）。
     - **多 leg 時每個 leg 的 `title`／`scope`／`acceptance` 都必須自己寫**，不可樣板複製：交付物上一個 leg 一列、一列一個 A，中繼那一列若顯示下游方的活與下游方的驗收，該方就無從畫押。單 leg 可缺這三欄，缺時繼承工項層。
     - **中繼段（純通道）的 `vendor`／`vendorEndpoints` 留空是合法的**，但 `scope` 要寫出「該方需開代理 API 轉呼下游、現有 spec 未提供」這類事實。**留空前先查該方自己的 capability**：那句「未提供對應端點」是可被 spec 反證的事實陳述，該方的 spec 若已代理了本鏈用到的端點（同一支 API 被兩個方各交一份 spec 時最常見，端點字串會逐字相同），中繼段就該指名 `vendor` 並列出那些端點，否則交付物上會抹掉一個已存在的代理層。步驟 5 有硬底線把關。
     - 判不出誰做時整筆用 `[{ party: "needs-investigation", vendorEndpoints: [] }]`；它是長度 1 的鏈，**不得**出現在多 leg 鏈裡。
     - `partyChain` **全有全無**：後端要嘛每筆都有、要嘛每筆都沒有（半套比沒派工更難察覺）。
   - 配對本身仍是 **AI 推論**，不是解析器算出來的——`sourcingConfirmed` 一律寫 `false`，開工前要人核（見 `docs/adr/0007-party-assignment-from-swimlane-diagram.md`）。它與後端既有的「推論·待確認」是兩個獨立的待確認維度。
5. **組裝並驗證** — `buildWorkitems(workflow, frontendItems, backendItems, { revisions, declaredChains, parties, capabilities })`
   - 第四個參數是**具名 options 物件**，四個欄位全部可選：`revisions`（讀回來的修訂集）、`declaredChains`／`parties`／`capabilities`（來自步驟 2 的發現結果）。
   - **存檔前套上人工修訂**，支援 `set`（覆蓋欄位，含 `partyChain`）／`upsert`（補一筆工項）／`remove`（刪一筆工項）。**人的校正壓過 AI 的新產出**——一個欄位被 `set` 過就**凍結**在使用者的值，重跑再也改不動，除非手動從 `revisions.json` 刪掉那筆；要向使用者交代這件事。套用**之後**才跑下面全部把關，所以 `remove` 掉太多前端工項而跌破底線、或 `set partyChain` 改成非宣告鏈時，都會丟錯**不落地**。
   - 回傳 `{ workitems, warnings }`。`warnings` 是**孤兒修訂**（錨指向的工項或 leg 這次不存在，後端 id 漂掉最常見）：保留該筆、發 warning、其餘照套，不中止。把 warnings 報給使用者。
   - 把關：**涵蓋＋顆粒度**（每個 Page 的前端工項數 ≥ `max(1, 該頁 actions 數)`）、**參照**（每筆 `sourcePage` 存在於 `workflow.pages`、`dependsOn` 每個 id 存在於本批）、**id 全域唯一且不含 `#`**、**inferred 旗標**（前端 false、後端 true，由陣列決定）、**分工鏈**。`sourcePage` 一律取自 `workflow.pages`（單一真實來源）。
   - **鏈硬底線**：每筆後端工項的方序列（`partyChain.map(l => l.party)`）必須**逐字等於宣告鏈之一**，含**單 leg**——否則一筆 `[{party:"leadtek"}]`（字面上的前端直打 leadtek）會零攔截。`["needs-investigation"]` 永遠合法。違反即丟錯不落地並逐一列名工項 id 與它實際的方序列。另外 `party` 必須在分工方集合（＝泳道名）∪ `{needs-investigation}` 內、leg 的 `vendor` 必須在已解析的 capability 內、`vendorEndpoints` 每條必須真的存在於該 spec。**留空底線**：`vendorEndpoints` 留空的 leg，若該 party 自己的 capability 裡就有本鏈其它 leg 用到的端點，即丟錯並列名那幾條——「該方未提供對應端點」被自家 spec 反證。修法二選一：把端點列進那個 leg（並指名 `vendor`），或那份 spec 掛錯目錄、把它移出 `workspace/spec/<project>/<方名>/`。
   - 涵蓋／參照／分工鏈不符丟 `WorkitemsConsistencyError`；不合契約（空欄位、id 重複或含 `#`、inferred 旗標、`partyChain` 半套、多 leg 缺散文）冒泡 `ContractValidationError`。
6. **保存** — `saveWorkitems(outputRoot, project, workitems)`
   - 通過契約驗證才寫 `output/<project>/workitems.json`；驗證失敗丟 `ContractValidationError` 且不落地。
7. **分流提示** — 落檔後告訴使用者下一步：跑 `f2w-breakdown-export` 出 `workitems-<時戳>.xlsx`。帶 `partyChain` 時提醒後端 sheet 會**一個 leg 一列**展開（列數會多於後端工項筆數），列標籤是 `<工項id>#<leg序>`。

## 逃生口

`workitems.json` 是宣告式逃生口：工項拆得不準、漏頁、依賴或後端推論抓錯時，直接手改該檔（增刪工項、改 title／scope／acceptance／dependsOn、調整 frontend／backend 歸屬），符合契約即可交給下一步。

**派錯方就直接手改該檔的 `partyChain`，零重跑**——派工併進本步之後，這是補回操作成本的地方，與過去手改 sourced 檔對等（見 `docs/adr/0015-party-assignment-merges-into-f2w-breakdown.md`）。

**但手改只活到下一次重跑本步為止**（本步整份覆寫 `workitems.json`）；要讓校正撐過重跑，走 `f2w-revise workitems <修改需求>` 把它變成一筆修訂——補工項建議用自訂 id（如 `BE-EXTRA-01`），完全不受 AI 重新編號影響；改派工則用 `set partyChain`（錨可以是工項 id，也可以是交付物上的 leg 標籤 `<工項id>#<leg序>`）。若問題出在上游描述本身（漏頁、操作去向錯），先回頭手改 `workflow.json` 或重跑 f2w-describe，再重跑本步。

## 對應實作

`src/breakdown/`：`loadWorkflowForBreakdown`（前置檢查＋讀回 workflow.json）、`discoverPartyInputs`（派工輸入自動發現、三態、子集檢查、強制回報）、`parseSwimlaneDiagram`（確定性泳道圖解析：泳道名、節點歸屬、方層跳躍、宣告鏈）、`parseVendorSpec`（OpenAPI／Swagger → capability，識別名由呼叫端傳入）、`buildWorkitems`（涵蓋／顆粒度＋參照＋契約＋分工鏈把關、前端 id 推導把關、存檔前套修訂、由陣列決定 inferred 的組裝核心）、`checkWorkitemsConsistency` 與 `checkPartyChains`（套用後重跑的把關）、`canonicalizeSourcePages`（套用後的 sourcePage 正規化，乾跑共用）、`saveWorkitems`（驗證後保存）。修訂的讀回與套用見 `src/revise/`（`loadProjectRevisions`、`applyWorkitemsRevisions`）。契約見 `src/contracts/workitems.ts`；路徑見 `src/output.ts`（`contractPath`）。決策見 ADR-0001（步驟間以檔案交接、checkpoint）、ADR-0002（後端工項為 AI 推論）、ADR-0003（前端工項逐操作硬底線）、ADR-0012（修訂由上游套用）、ADR-0013（前端 id 確定性推導、後端 id 的殘餘風險）、`docs/adr/0014-swimlane-diagram-read-by-deterministic-parser.md`、`docs/adr/0015-party-assignment-merges-into-f2w-breakdown.md`、`docs/adr/0016-work-item-carries-party-chain.md` 與 `docs/adr/0018-party-inputs-discovered-by-directory-convention.md`。
