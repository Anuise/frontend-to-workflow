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
_Avoid_: intro, abstract

**Workbook（工作流程 Excel）**:
最終交付物 `workflow.xlsx`：含「概述」與「逐頁工作流程」兩個 sheet，逐頁列出 Workflow description 並嵌入截圖縮圖。
_Avoid_: report, spreadsheet, 報表

**Navigation diagram（導覽流程圖）**:
以 Page 為節點、換頁操作為有向邊的導覽交付圖 `workflow.drawio`；由 `f2w-diagram` 從 Workflow description 確定性生成、零推論。畫的是使用者在頁面之間怎麼走，不含業務決策條件、角色泳道與訊息事件。
_Avoid_: 業務流程圖, BPMN 圖, flowchart, 流程圖（泛稱）

**Work item（工項）**:
一筆可分派、可畫押的最小工作單位；錨定在某個 Page，分前端／後端兩層，是 `workitems.xlsx` 每列的單位。
_Avoid_: task, ticket, 任務（泛稱）

**Work breakdown（工項劃分）**:
把一個 Project 的 Workflow 拆成前端＋後端 Work item 的產物；由 `f2w-breakdown` 產出 `workitems.json`（宣告式逃生口），`f2w-breakdown-export` 組成 `workitems.xlsx`。
_Avoid_: WBS（泛稱）, 拆解, 任務清單

**Inferred work item（推論工項）**:
後端 Work item 因本 skill 假設無後端可觀察，一律由 AI 從前端操作推論而來、標為「推論·待確認」（`inferred: true`）；開工前須與後端確認。與觀察自畫面的前端 Work item 嚴格區分。
_Avoid_: 假設工項, 臆測工項

**權責畫押（RACI sign-off）**:
在工作副本上為每筆 Work item 填定 RACI 責任（A 當責＝單一人、R 負責＝可多人、C 諮詢、I 告知）與簽核；由人填寫，AI 不代填「承諾型」欄位（估時、優先級、RACI）。
_Avoid_: 分工, 指派, assignment（泛稱）

**範本／工作副本（Template workbook／Working copy）**:
`workitems.xlsx` 是畫押欄留白的**範本**、可被重跑覆蓋；人須另存一份**工作副本**填畫押值，重跑只覆蓋範本、不動工作副本。
_Avoid_: 空白表／填好的表（泛稱）

## 分工歸屬（Sourcing）

**權責泳道圖（Responsibility swimlane diagram）**:
人畫的 draw.io 泳道圖：泳道＝分工方（Party）、格＝該方負責的元件、邊＝呼叫／資料流。**平台級共用文件、可跨 project**，是 `f2w-sourcing` 派工的主要依據；AI 直接讀圖推斷（不經確定性解析器），錯配靠人核兜底。
_Avoid_: Navigation diagram（那是 f2w-diagram 的零推論產物，明文不含泳道）, 流程圖（泛稱）, BPMN 圖

**Party（分工方）**:
權責泳道圖中一條泳道代表的責任單位；自家與外部廠商一視同仁。分工方名集合 = 泳道名 ∪ Vendor spec 檔名。
_Avoid_: vendor（保留給「有提供 Vendor spec 的分工方」）, 廠商（泛稱）, 團隊

**Vendor（供應商）**:
有提供 Vendor spec（OpenAPI）的分工方；以其 spec 檔名（去副檔名）為識別名。
_Avoid_: 廠商, supplier, third-party（泛稱）

**Vendor spec（供應商規格）**:
單一 Vendor 的 OpenAPI／Swagger 契約檔；由人提供、觸發 `f2w-sourcing` 時指定路徑（可選，0..n 份、一檔一家；與權責泳道圖至少給一種）。是派工的輔助證據。
_Avoid_: API doc, 文件（泛稱）

**Vendor capability（供應商能力）**:
從 Vendor spec **確定性解析**出的單一可呼叫端點（endpoint ＋ 參數 ＋ 回應 schema）；是 `vendorEndpoints` 配對的對象。機器解析而來，非 AI 抽取。
_Avoid_: endpoint（單指 URL 路徑時可用）, feature

**Party assignment（分工歸屬）**:
為單一後端 Work item 派定「誰做」：一個分工方名，或 **needs-investigation**（從圖與 spec 都判不出誰做、待查）。一筆工項橫跨兩方時拆成多筆**跨方接力**（`dependsOn` 串、`originItemId` 溯源）。由 `f2w-sourcing` 產出。
_Avoid_: Sourcing decision／來源決策（四桶舊語）, vendor-direct, vendor-adapted, self-built（已廢值）, 分派（泛稱）

**配對·待確認（Sourcing confirmation）**:
Party assignment 由 AI 語意配對而來，一律標 `sourcingConfirmed: false`；與 Inferred work item 的「推論·待確認」是**兩個獨立維度**——一個問工項存不存在、一個問派的方與配的 API 對不對，開工前各自要人核。
_Avoid_: 待驗證（泛稱）

**Sourced work breakdown（來源劃分）**:
`f2w-sourcing` 產出的 `workitems-sourced.json`：把 Work breakdown 的後端工項貼上 Party assignment、並把跨方接力的工項拆成多筆後的**完整副本**（前端原封複製）。是可選插入步的產物，`f2w-breakdown-export` 有它就讀它。
_Avoid_: 加工工項清單（泛稱）
