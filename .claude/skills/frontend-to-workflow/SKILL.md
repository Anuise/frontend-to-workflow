---
name: frontend-to-workflow
description: frontend-to-workflow 管線的總說明。說明六個 step skill（f2w-start → f2w-capture → f2w-describe → f2w-export → f2w-breakdown → f2w-breakdown-export）的正確觸發順序與各步的檔案交接（讀什麼、產出什麼），外加與 f2w-export 併行的分支步 f2w-diagram 與可選插入步 f2w-sourcing，並聲明不自動串跑、每步之間保留使用者確認的 checkpoint。Use when the user wants an overview of the frontend-to-workflow pipeline, which step to run next, the order of the six steps, or what each step reads and produces.
---

# frontend-to-workflow：管線總說明

把一個 **Pure-frontend** 的 **Project** 轉成「使用者視角的 **Workflow description**」，交付成 **Workbook**（`workflow.xlsx`）；並進一步把工作流程拆成可分派、可畫押的 **Work item**，交付成畫押欄留白的**範本** `workitems.xlsx`。整條管線拆成六個各自觸發的 step skill，外加一個位於 breakdown 與 breakdown-export 之間的**可選插入步** `f2w-sourcing`（有權責泳道圖或供應商 API 才插），以及一個與 `f2w-export` 併行的**分支步** `f2w-diagram`（同讀 `workflow.json`、推論出主線後出 draw.io **Main flow diagram**、不餵任何下游）。本 skill 只講**正確順序**與**檔案交接**，不執行任何一步。

## 核心原則：不自動串跑

六步**分開觸發**，本 skill **不會**自動接連跑完六步。每步之間刻意保留一個**使用者確認的 checkpoint**：上一步產出可先檢視（甚至手改逃生口檔案）再決定是否進入下一步。這是本管線的設計決定，理由見 `docs/adr/0001-split-pipeline-into-step-skills.md`——分步的代價是觸發次數較多，換來的是每步可單獨重跑、可局部除錯。

「一鍵跑完六步」的 orchestrator 目前**刻意未提供**，列為未來擴充。

## 六步順序與檔案交接

所有跨步驟狀態一律落地在 `output/<project>/` 底下，下一步再讀回（分開觸發無法靠記憶體傳遞）。

| 步 | skill | 讀（前置） | 產出 |
|----|-------|-----------|------|
| 1 | `f2w-start` | 無（管線起點） | `output/<project>/manifest.yml` |
| 2 | `f2w-capture` | `manifest.yml` | `output/<project>/pages.json`、`output/<project>/screenshots/` |
| 3 | `f2w-describe` | `pages.json`、`screenshots/` | `output/<project>/workflow.json` |
| 4 | `f2w-export` | `workflow.json`、`pages.json`、`screenshots/` | `output/<project>/workflow.xlsx` |
| 分支（與步 4 併行） | `f2w-diagram` | `workflow.json` | `output/<project>/mainflow.json`、`output/<project>/mainflow.drawio` |
| 5 | `f2w-breakdown` | `workflow.json` | `output/<project>/workitems.json` |
| 5.5（可選） | `f2w-sourcing` | `workitems.json` ＋ 人指定的權責泳道圖（draw.io）／Vendor spec（OpenAPI）——皆可選、至少一份 | `output/<project>/workitems-sourced.json` |
| 6 | `f2w-breakdown-export` | `workitems-sourced.json`（在就讀）否則 `workitems.json` | `output/<project>/workitems.xlsx` |

- **f2w-start**：偵測 Project 如何安裝／啟動／對外 port／base URL，經使用者確認後保存成 **Manifest**（`manifest.yml`），並把 Project 實際跑起來。
- **f2w-capture**：讀執行中 Project，列舉所有 **Page**（正規化路由；同路由下不同 tab 各成一頁）並逐頁截圖，產出 `pages.json` 與 `screenshots/`。
- **f2w-describe**：看截圖，以使用者視角為每個 Page 寫一段 **Workflow description**（截圖來源、頁面用途、主要內容、可執行操作、每個操作的操作去向），另寫一段跨頁 **Overview**，產出 `workflow.json`。
- **f2w-export**：組裝最終 **Workbook** `workflow.xlsx`：含「概述」sheet（放 Overview）與「逐頁工作流程」sheet（每列一個 Page，含 Workflow description 且嵌入該頁截圖縮圖）。新產出的 `workflow.json` 每頁會保留 `screenshot`；本步仍讀 `pages.json` 作為截圖對應的 fallback 與一致性來源。
- **f2w-diagram**（分支步，與 f2w-export 併行）：**推論步**。讀 `workflow.json`，把 Page 按**頂層分類**分組——一個分類一條 **Main flow（主線）**、`name` 照抄分類名、順序照頁序——再依每個 Page 的頁面用途切步，先寫成可手改的交接檔 `mainflow.json`——**已存在就沿用、不重推論**（要重推請先刪檔或明講「重推主線」）；再依 `mainflow.json` 確定性地畫出多分頁的 **Main flow diagram** `mainflow.drawio`，讀者是**業主**：**一條主線一張大分頁、沒有總覽頁**（第 1 頁就是第一條主線），頁內是主線名 24px 粗體標題 ＋ 同色系細橫線 ＋ **單列橫排、不折行**的 1–10 個 **Step（步驟）**，每步兩段式（粗體「編號. 業務動作名」＋ 小字說明），每條主線各一個色系（固定色表依主線順序取、超過循環）。圖上**只畫主幹**，彈窗與明細頁不畫；**一步可收攏多個 Page**（例如服務維護的五個 tab 收成「維運模型服務」一步），收攏的頁不上圖面、只進 tooltip（抬頭「此步驟涵蓋的頁面：」）。邊的 label 是 AI 寫的業務轉場動作，但相鄰兩步之間必須有 `workflow.json` 裡真實的操作去向墊背（來源步任一頁 → 目標步任一頁），接不上就丟 `DiagramConsistencyError`、要求改順序或重新分步，不畫虛線；`steps[].pages` ∪ `excludedPages` 也必須剛好等於 `workflow.json` 的頁集合、每頁只表態一次。落選頁圖上完全不提，只在 `mainflow.json` 的 `excludedPages`（各附一句原因）與對話回報裡交代，完整操作清單仍以 `workflow.xlsx` 為權威（分類全部上圖時 `excludedPages` 就是空的）。圖上**不標「推論·待確認」、不標 ⚠**——給業主看的圖要乾淨好懂。決策見 ADR-0006、ADR-0008 與 ADR-0009（主線邊界＝頂層 Page 分類）。
- **f2w-breakdown**：讀 `workflow.json`，依每個 Page 的 Workflow description 把工作拆成**前端 Work item**（觀察自畫面）與**後端 Work item**（AI 推論、一律標「推論·待確認」），產出 **Work breakdown** `workitems.json`。承諾型欄位（估時／優先級／RACI／簽核／狀態）刻意不進 json。
- **f2w-sourcing**（可選插入步，有權責泳道圖或供應商 API 才跑）：讀 `workitems.json`，對照人提供的**權責泳道圖**（draw.io，泳道＝分工方）與 **Vendor spec**（OpenAPI／Swagger）——兩種輸入皆可選、至少一份、觸發時指定路徑——為每個後端 Work item 定 **Party assignment（分工歸屬）**：派給一個分工方（泳道名或 spec 供應商名，如 mobagel／gary／leadtek）或 `needs-investigation` 待查；一筆工項橫跨兩方時拆成多筆**跨方接力**（`dependsOn` 串、`originItemId` 溯源），產出 **Sourced work breakdown** `workitems-sourced.json`（前端原封複製、後端貼標＋拆項）。配對一律標 `sourcingConfirmed: false`，與後端既有的「推論·待確認」是兩個獨立待確認維度。決策見 ADR-0007（ADR-0004 部分被其取代）。
- **f2w-breakdown-export**：讀 `workitems-sourced.json`（有就讀）否則退回 `workitems.json`，組裝最終交付**範本** `workitems.xlsx`（「概述」「前端工項」「後端工項」三個 sheet，畫押欄留白、不嵌截圖；讀到 sourced 檔時後端 sheet 多帶分工歸屬欄）。範本可被重跑覆蓋；人須另存一份**工作副本**填**權責畫押**值（RACI／估時／優先級／簽核／狀態），重跑只覆蓋範本、不動工作副本。

## 缺前置檔：請先跑上一步

每步開頭都會檢查自己的前置檔；缺件即**中止**並提示先跑產出該檔的那一步：

- 缺 `manifest.yml` → 請先跑 **f2w-start**。
- 缺 `pages.json` 或 `screenshots/` → 請先跑 **f2w-capture**。
- 缺 `workflow.json` → 請先跑 **f2w-describe**。
- 缺 `workitems.json` → 請先跑 **f2w-breakdown**。

（`workflow.xlsx` 與 `workitems.xlsx` 都是終點交付物，沒有再下一步。）

## 逃生口

`manifest.yml`、`pages.json`、`workflow.json`、`mainflow.json`、`workitems.json` 都是**宣告式逃生口**：自動偵測／列舉／描述／主線推論／拆項不完美時，可直接手改該檔再重跑後續步驟，重跑會尊重手改值（`mainflow.json` 已存在時 f2w-diagram 不重推論，直接照手改後的版本畫）。`workflow.xlsx`、`mainflow.drawio` 與 `workitems.xlsx` 是交付物、不是交接檔：`workflow.xlsx` 不預期手改，內容不對時回頭改上游的宣告式檔案再重跑 f2w-export；`mainflow.drawio` 同理（內容不對改 `mainflow.json` 再重跑；重跑直接覆寫，可在 draw.io 圖形化調版面但要另存副本才留得住）；`workitems.xlsx` 是畫押欄留白的**範本**、可被重跑覆蓋，人須另存一份**工作副本**填權責畫押值，重跑只覆蓋範本、不動工作副本。

## 各步細節

各步的流程、契約驗證與逃生口見該 step skill 本身：`f2w-start`、`f2w-capture`、`f2w-describe`、`f2w-export`、`f2w-diagram`、`f2w-breakdown`、`f2w-breakdown-export`。詞彙定義見 `CONTEXT.md`。
