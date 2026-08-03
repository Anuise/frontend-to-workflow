# frontend-to-workflow

將前端專案的實際畫面，轉成「使用者視角的工作流程文件」的自動化流程。skill 讀取一份前端原始碼，把它跑起來、逐頁截圖，再描述使用者如何操作，最後輸出成文件。

## Language

**Workspace（工作區）**:
存放多個前端專案原始碼的容器資料夾，位於 repo 根目錄且不被 git 追蹤。
_Avoid_: projects folder, 專案夾, source dir

**Project（專案）**:
Workspace 底下的單一子資料夾，內含一份可獨立啟動的前端原始碼；子資料夾名即專案識別名。
_Avoid_: app, repo, frontend（泛稱時可用「前端」，但作為識別單位一律稱 project）

**Manifest（啟動描述檔）**:
描述單一 project 如何安裝、啟動、對外 port 與 base URL 的檔案；由 skill 首次自動偵測生成、經確認後保存，之後重跑時重用並可手動微調。
_Avoid_: config, settings, 設定檔（泛稱）

**Page（頁面／截圖單位）**:
一個被截圖的畫面單位：可以是一條正規化後的路由，或是某路由底下的一個 tab 狀態；以「路由 +（可選）tab 名稱」識別。是後續一張截圖、一段描述、Excel 一列的共同單位。
_Avoid_: screen, view, route（route 專指 URL 路徑，Page 比 route 大，因為含 tab 狀態）

**Pure-frontend（純前端）**:
本 skill 假設每個 project 都是無後端、無登入的純前端；因此不處理 auth，API 若無後端而回傳空資料/錯誤狀態則照實截圖。
_Avoid_: standalone, mock app

**Workflow description（工作流程描述）**:
以使用者視角描述單一 Page 的內容：頁面用途、主要內容、可執行操作、以及每個操作會前往哪一頁（操作去向）。逐 Page 存於 `workflow.json`，是 Excel 每列的來源。
_Avoid_: summary, caption, 說明（泛稱）

**Overview（整體流程概述）**:
跨所有 Page 的一段總覽敘述，說明整個前端的使用者流程樣貌；獨立於逐 Page 的 Workflow description。
_Avoid_: intro, abstract, 總覽頁（那是 Main flow diagram 的最後一個 draw.io 分頁，與這段敘述無關）

**Workbook（工作流程 Excel）**:
最終交付物 `workflow-<YYYYMMDD-HHmmss>.xlsx`：含「概述」與「逐頁工作流程」兩個 sheet，逐頁列出 Workflow description 並嵌入截圖縮圖。檔名帶寫檔當下的**本地**年月日時分秒（如 `workflow-20260803-153012.xlsx`），重跑各留一份、不覆蓋舊檔。
_Avoid_: report, spreadsheet, 報表

**Main flow diagram（主線流程圖）**:
以業務 Step 為節點、步驟之間的業務轉場為有向邊的交付圖 `mainflow.drawio`；讀者是**業主**。由 `f2w-diagram` 從 Workflow description ＋ Main flow 組出（`buildDiagram(workflow, mainflow)`）：一條主線一個 draw.io 分頁（第 1 頁就是第一條主線），**最後一頁固定是總覽**（分頁名「總覽」＝`OVERVIEW_PAGE_NAME`）——把每條主線那一列照 `flows` 順序由上到下排在同一頁，內容與該主線自己那頁逐字相同、只換 y 座標，是簡報與列印用的全景，不是另一種圖。節點是業務動作而不是 Page。圖上不標「推論·待確認」也不標 ⚠——要乾淨好懂，推論的表態留在 `mainflow.json` 與對話回報。不含業務決策條件、角色泳道與訊息事件。
_Avoid_: BPMN 圖, flowchart, 流程圖（泛稱）, 網站地圖, Navigation diagram（已被取代的舊語）

**Main flow（主線）**:
一個**頂層 Page 分類**（此類專案即側欄模組）收成的一條流程；是 `mainflow.json` 的 `flows[]` 一筆，也是 draw.io 的一個分頁單位。`name` **照抄該分類名、不改字**，`flows` 順序照 `workflow.json` 的頁序——業主看圖就是看側欄。邊界不推論，推論的是每條主線切成幾步、每步怎麼措辭（素材是每頁的頁面用途，Overview 只當語氣參考）。每條主線 1–10 個 Step、單列橫排不折行，各自一個色系（9 色色表依 `flows` 順序取、超過循環）；步數不必每頁一樣長，頁多的分類切細、只有一頁的分類就是一步。推論落在交接檔 `mainflow.json`：**可手改，已存在就沿用、不重推論**（要重推得先刪檔或明講）。有涵蓋完整性硬驗——`steps[].pages` ∪ `excludedPages` 必須剛好等於 `workflow.json` 的頁集合、每頁只出現一次；不在任何主線上的落選頁圖上完全不提，只在 `excludedPages`（含一句 `reason`）與對話 warning 交代，完整操作清單仍以 `workflow-<時戳>.xlsx` 為權威；頂層分類全部上圖時 `excludedPages` 就是空陣列。
_Avoid_: Section（已退場的舊分頁單位）, Route（專指 `pages[].route` 的 URL 路徑）, 模組（產品功能區的泛稱；主線邊界雖與它一致，文件上一律稱主線）

**Step（步驟）**:
主線上的一個業務層級動作，是圖上一個節點：粗體「編號. 業務動作名」＋ 小字說明的兩段式。**一步可收攏多個 Page**（例如服務維護的五個 tab 收成「維運模型服務」一步）；只留主幹，彈窗與明細頁不畫，收攏的頁不上圖面、只進 tooltip（抬頭「此步驟涵蓋的頁面：」）。字數上限寫進契約由驗證擋下：標題 `title` ≤12 字、小字 `note` ≤30 字、往下一步的邊 label `edgeLabel` ≤8 字（掛在來源步，最後一步不得有）。邊 label 是 AI 寫的業務轉場動作，但相鄰兩步之間必須有真實的操作去向墊背，接不上就丟 `DiagramConsistencyError` 要求改順序或重新分步——不畫虛線。
_Avoid_: Page（Step 比 Page 大，一步可收攏多頁）, 節點（泛稱）, 任務（撞 Work item）

**Work item（工項）**:
一筆可分派、可畫押的最小工作單位；錨定在某個 Page，分前端／後端兩層，是 `workitems-<時戳>.xlsx` 每列的單位。
_Avoid_: task, ticket, 任務（泛稱）

**Work breakdown（工項劃分）**:
把一個 Project 的 Workflow 拆成前端＋後端 Work item 的產物；由 `f2w-breakdown` 產出 `workitems.json`（宣告式逃生口），`f2w-breakdown-export` 組成 `workitems-<時戳>.xlsx`。
_Avoid_: WBS（泛稱）, 拆解, 任務清單

**Inferred work item（推論工項）**:
後端 Work item 因本 skill 假設無後端可觀察，一律由 AI 從前端操作推論而來、標為「推論·待確認」（`inferred: true`）；開工前須與後端確認。與觀察自畫面的前端 Work item 嚴格區分。
_Avoid_: 假設工項, 臆測工項

**權責畫押（RACI sign-off）**:
在工作副本上為每筆 Work item 填定 RACI 責任（A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知）與簽核；由人填寫，AI 不代填「承諾型」欄位（估時、優先級、RACI）。
_Avoid_: 分工, 指派, assignment（泛稱）

**範本／工作副本（Template workbook／Working copy）**:
`workitems-<YYYYMMDD-HHmmss>.xlsx` 是畫押欄留白的**範本**；人須另存一份**工作副本**填畫押值。範本檔名帶時戳，重跑出的是新一份範本、不覆蓋舊的，換到新範本時畫押值須人工搬。
_Avoid_: 空白表／填好的表（泛稱）

## 人工修訂（Revision）

**Revision（修訂）**:
一筆錨定在 Page 或 Work item 上的人工校正，覆蓋 AI 產出的**單一欄位**或**整筆工項**，帶一句 `reason`。由 `f2w-revise` 從使用者的話轉寫而來，也可手寫；落在 `workspace/revisions/<project>/revisions.json`，是 append-only 的累積陣列。套用的執行者是**上游**（`f2w-describe`／`f2w-breakdown` 存檔前套），所以重跑上游會帶回校正而不是沖掉它；代價是效果不即時，且被覆蓋過的欄位就凍結在人的值。
_Avoid_: Override（偏實作語彙）, Correction（預設原本是錯的，但有些修訂只是偏好）, Feedback（太軟，聽起來不會被套用）

**Effective revision set（有效修訂集）**:
把累積的 Revision 依**作用點**摺疊、每個作用點只取最後一筆的結果——`set` 的作用點是 `(target, anchor, field)`，`upsert` 與 `remove` 共用 `(target, itemId)`。順序只在摺疊那一步有意義，摺疊之後套用對排列不敏感（固定序 `remove` → `upsert` → `set`）。是實際被套用的那一組。
_Avoid_: 修訂清單（那是含歷史的完整陣列）, patch set, diff

**`workspace/` 與 `output/` 的分界**：**依內容的作者分**，不是依誰寫出檔案。`workspace/` 放**人的意圖**（權責泳道圖、Vendor spec、Revision）；`output/` 放**管線寫出來的內容**。這也回答了「那 `mainflow.json` 為什麼在 `output/`」——它可以手改，但內容作者是 AI（主線推論），人只是校正。見 ADR-0011。

## 分工歸屬（Sourcing）

**權責泳道圖（Responsibility swimlane diagram）**:
人畫的 draw.io 泳道圖：泳道＝分工方（Party）、格＝該方負責的元件、邊＝呼叫／資料流。**逐 project 一份**，放在 `workspace/spec/<project>/` 的根，由 `f2w-breakdown` 自動掃出。泳道名、節點歸屬、方層跳躍與**宣告鏈**由確定性解析器 `parseSwimlaneDiagram` 讀出（見 `docs/adr/0014-swimlane-diagram-read-by-deterministic-parser.md`）；「哪一格對應哪個工項」仍是 AI 推論，錯配靠人核兜底。
_Avoid_: Main flow diagram（那是 f2w-diagram 的業主向產物，明文不含泳道）, 流程圖（泛稱）, BPMN 圖, 平台級共用文件（已改為逐 project）

**宣告鏈（Declared chain）**:
人寫在權責泳道圖上的一句話，宣告 API 呼叫鏈只有哪幾種（如「① frontend → mobagel　② frontend → mobagel → gary」）。解析器依序號切鏈、按箭頭切 token、丟掉不是泳道名的 token。**它是鏈硬底線的權威**：每筆後端工項的方序列必須逐字等於其中一條，否則 `f2w-breakdown` 整步丟錯不落地。邊圖只當交叉檢查——邊圖是結構事實但不封閉（外部呼叫端可以直打中段），宣告文字封閉但是人手寫的、會過期，所以相鄰跳躍在邊圖上找不到支持時只發 warning、不中止。
_Avoid_: 呼叫鏈規則（泛稱）, partyEdges（那是從邊算出的方層跳躍，不是宣告）

**Party（分工方）**:
權責泳道圖中一條泳道代表的責任單位；自家與外部廠商一視同仁。**分工方名集合純由泳道名決定**——spec 目錄名必須是泳道名的子集，沒被畫進圖的目錄不會憑空變成一個合法的方。
_Avoid_: vendor（保留給「有提供 Vendor spec 的分工方」）, 廠商（泛稱）, 團隊

**Vendor（供應商）**:
有提供 Vendor spec（OpenAPI）的分工方；識別名即它的 spec **目錄名**（`workspace/spec/<project>/<方名>/`），與泳道名相同。
_Avoid_: 廠商, supplier, third-party（泛稱）, spec 檔名（已不再是識別名）

**Vendor spec（供應商規格）**:
單一 Vendor 的 OpenAPI／Swagger 契約檔，放在 `workspace/spec/<project>/<方名>/*.json`（可選，一方 0..n 份，同一方多份會合併成該方一份 capability 集合）。由 `f2w-breakdown` 依目錄慣例自動發現，不用打路徑。是派工的輔助證據。
_Avoid_: API doc, 文件（泛稱）

**Vendor capability（供應商能力）**:
從 Vendor spec **確定性解析**出的單一可呼叫端點（endpoint ＋ 參數 ＋ 回應 schema）；是 `vendorEndpoints` 配對的對象。機器解析而來，非 AI 抽取。
_Avoid_: endpoint（單指 URL 路徑時可用）, feature

**Party chain（分工鏈）**:
一筆後端 Work item 的分工歸屬，形狀是一個 **leg** 陣列：單方做完就一個 leg，多方接力就多個 leg（依序）。**工項不拆項、id 不改寫**——拆項會改寫 id、讓使用者照交付物寫下的修訂錨不到東西（見 `docs/adr/0016-work-item-carries-party-chain.md`）。多列只在 `workitems-<時戳>.xlsx` 展開。方序列必須逐字等於宣告鏈之一。
_Avoid_: 跨方接力拆項（已廢做法）, originItemId（已廢欄位）, 分工歸屬（單筆時可用，但別拿來指整條鏈）

**leg（分工段）**:
Party chain 上的一段：`{ party, vendor?, vendorEndpoints, title?, scope?, acceptance? }`。**多 leg 時 `title`／`scope`／`acceptance` 三欄必填且各 leg 各寫**——交付物上一個 leg 一列、一列一個 A，中繼那一列若顯示下游方的活與下游方的驗收，該方就無從畫押；單 leg 可缺，缺時繼承工項層。純通道的中繼段 `vendor`／`vendorEndpoints` 留空是合法的。交付物列標籤由 (工項 id, leg 序) 確定性推導：單 leg 是裸 id、多 leg 是 `<工項id>#<leg序>`，**它是合法的修訂錨**。
_Avoid_: part（舊的拆項語）, 子工項（leg 不是獨立工項，沒有自己的 id）

**Party assignment（分工歸屬）**:
一個 leg 上的「誰做」：一個分工方名，或 **needs-investigation**（從圖與 spec 都判不出誰做、待查）。`needs-investigation` 是長度 1 的鏈、不得出現在多 leg 鏈裡。由 `f2w-breakdown` 產出。
_Avoid_: Sourcing decision／來源決策（四桶舊語）, vendor-direct, vendor-adapted, self-built（已廢值）, 分派（泛稱）

**配對·待確認（Sourcing confirmation）**:
Party chain 由 AI 語意配對而來，一律標 `sourcingConfirmed: false`；與 Inferred work item 的「推論·待確認」是**兩個獨立維度**——一個問工項存不存在、一個問派的方與配的 API 對不對，開工前各自要人核。
_Avoid_: 待驗證（泛稱）
