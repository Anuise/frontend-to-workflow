# frontend-to-workflow：純前端專案轉使用者視角工作流程 Excel 的 4-step skill 管線

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-21
Author: Anuise
Origin: GitHub issue #4 — https://github.com/Anuise/frontend-to-workflow/issues/4

## Problem Statement

我手上有一批**純前端（pure-frontend）**專案，需要把每個專案「使用者實際會看到什麼、能做什麼、操作後會去哪一頁」整理成一份交接用的文件。目前只能手動做：把專案跑起來、一頁一頁點過去、逐一截圖、用文字描述每頁在做什麼、再把截圖和描述貼進 Excel。這件事極其瑣碎、容易漏頁、描述前後不一致，而且每換一個專案就要從頭再來一次，完全無法規模化。我要的是把這條流程自動化。

## Solution

一條由 skill 驅動的自動化管線 `frontend-to-workflow`。把它指向 **Workspace（工作區）** 底下的一個 **Project（專案）**，它會：偵測這個 project 要如何安裝與啟動（產生 **Manifest／啟動描述檔**）、把它跑起來、走訪每一個 **Page（頁面）**、逐頁截圖、以使用者視角描述每個 Page 的 **Workflow description（工作流程描述）**、寫一段跨頁的 **Overview（整體流程概述）**，最後匯出一份 **Workbook（工作流程 Excel，`workflow.xlsx`）**：含「概述」與「逐頁工作流程」兩個 sheet，逐頁列出描述並嵌入截圖縮圖。

依 ADR-0001，整條管線**不做單一 orchestrator**，而是拆成 4 個各自可獨立觸發的 step skill：

| Step skill | 讀入 | 產出 |
|------------|------|------|
| `f2w-start` | project 原始碼 | `manifest.yml` |
| `f2w-capture` | `manifest.yml` | `pages.json` + `screenshots/` |
| `f2w-describe` | `pages.json` + `screenshots/` | `workflow.json` |
| `f2w-export` | `workflow.json` + `screenshots/` | `workflow.xlsx` |

外加一個總說明 skill `frontend-to-workflow`，只講操作順序、**不自動串跑**。各步之間靠落地在 `output/<project>/` 的檔案交接狀態，因此任何一步都能單獨重跑；缺前置檔就報「請先跑上一步」。

## User Stories

1. As a 開發者, I want 把一個 project 指定給管線, so that 我不必手動走訪與截圖就能得到它的工作流程文件。
2. As a 開發者, I want 管線把 project 原始碼放在 repo 根目錄、不被 git 追蹤的 Workspace 底下辨識, so that 我要文件化的前端原始碼不會混進這個工具本身的版控。
3. As a 開發者, I want 用子資料夾名當作 project 的識別名, so that 我可以同時管理多個 project 且輸出不會互相覆蓋。
4. As a 開發者, I want `f2w-start` 首次自動偵測 project 的安裝指令、啟動指令、對外 port 與 base URL, so that 我不必自己翻 package.json 找怎麼跑起來。
5. As a 開發者, I want 偵測出的 Manifest 在保存前先讓我確認, so that 偵測猜錯時我能在啟動前更正，而不是整條跑壞才發現。
6. As a 開發者, I want Manifest 一旦確認就保存成 `manifest.yml`, so that 之後重跑同一個 project 時直接重用、不必再偵測一次。
7. As a 開發者, I want 手動微調 `manifest.yml`, so that 偵測不完美時我有一個宣告式的逃生口可以修正啟動方式。
8. As a 開發者, I want `f2w-start` 依 Manifest 把 project 實際跑起來, so that 後續步驟有一個可截圖的執行中前端。
9. As a 開發者, I want `f2w-capture` 列舉出所有 Page, so that 我能確保文件涵蓋整個前端、不漏頁。
10. As a 開發者, I want 每個 Page 以「正規化後的路由 +（可選）tab 名稱」識別, so that 同一路由底下的不同 tab 狀態能被當成不同 Page 各自截圖與描述。
11. As a 開發者, I want 路由被正規化, so that 帶參數或等價形式的 URL 不會被重複列成多個 Page。
12. As a 開發者, I want 列舉出的 Page 清單存成 `pages.json`, so that 截圖與描述都以同一份清單為準、單位一致。
13. As a 開發者, I want 手動編輯 `pages.json`, so that 自動列舉漏抓或多抓時，我能增刪 Page 再重跑後續步驟。
14. As a 開發者, I want `f2w-capture` 逐 Page 截圖並存進 `screenshots/`, so that 每個 Page 都有一張對應畫面可放進 Workbook。
15. As a 開發者, I want 管線把每個 project 都當成無後端、無登入的純前端處理, so that 我不必為了跑文件化流程去架後端或設定登入。
16. As a 開發者, I want 當某頁因為沒有後端而 API 回傳空資料或錯誤狀態時照實截圖, so that 文件忠實反映純前端啟動下的真實畫面，而不是假造成功狀態。
17. As a 開發者, I want `f2w-describe` 以使用者視角描述每個 Page 的用途與主要內容, so that 讀文件的人不必看程式碼就懂這頁在做什麼。
18. As a 開發者, I want 每個 Page 的描述列出可執行的操作, so that 讀者知道在這頁上能做哪些事。
19. As a 開發者, I want 每個操作標明「操作去向」（點下去會前往哪一頁）, so that 讀者能把散頁串成一條可跟隨的使用者流程。
20. As a 開發者, I want 逐 Page 的 Workflow description 存成 `workflow.json`, so that 它成為 Workbook 每一列的單一資料來源。
21. As a 開發者, I want `f2w-describe` 另外產生一段跨所有 Page 的 Overview, so that 讀者先有整體流程的鳥瞰，再進到逐頁細節。
22. As a 開發者, I want Overview 與逐 Page 的 Workflow description 是各自獨立的內容, so that 總覽敘述不會被綁死在某一頁上。
23. As a 開發者, I want `f2w-export` 把 `workflow.json` 與 `screenshots/` 組成 `workflow.xlsx`, so that 我得到一份可直接交付、可用 Excel 開啟的成果。
24. As a 開發者, I want Workbook 含「概述」與「逐頁工作流程」兩個 sheet, so that 總覽與細節在同一個檔案內分頁清楚。
25. As a 開發者, I want「逐頁工作流程」sheet 每一列對應一個 Page 並嵌入該頁截圖縮圖, so that 讀者看列表就能同時對照畫面與描述。
26. As a 開發者, I want 四個 step 各自可獨立觸發, so that 我在每一步之間有天然的 checkpoint，可以檢查產出再決定是否往下。
27. As a 開發者, I want 只重跑其中某一步, so that 某步猜錯（例如漏頁或描述不佳）時我能局部修正，不必整條重來。
28. As a 開發者, I want 在缺少前置檔就執行某一步時，該步報「請先跑上一步」, so that 我能立刻知道狀態缺口在哪，而不是拿到一個莫名其妙的結果。
29. As a 開發者, I want 所有中間狀態都落地在 `output/<project>/`, so that 步驟之間即使無法用記憶體傳遞，也能靠檔案可靠交接、且我能直接檢視。
30. As a 開發者, I want 總說明 skill `frontend-to-workflow` 告訴我四步的正確順序, so that 我知道該依序觸發哪些 skill，而不必記住細節。
31. As a 開發者, I want 總說明 skill 明確地不自動串跑四步, so that 每一步的高風險決策（啟動契約、頁面涵蓋範圍）都保留我介入確認的機會。
32. As a 讀者（交接對象）, I want 打開 `workflow.xlsx` 就能看懂整個前端的使用者流程, so that 我不必存取原始碼或請人導覽就能上手這個 project。
33. As a 開發者, I want 未來要新增流程步驟時，只需新增一個沿用同一套 `output/<project>/` 檔案契約的 `f2w-*` skill, so that 擴充管線不必改動既有步驟。

## Implementation Decisions

- **整體架構（ADR-0001）**：實作為 5 個 skill——4 個 step skill（`f2w-start` / `f2w-capture` / `f2w-describe` / `f2w-export`）＋ 1 個總說明 skill（`frontend-to-workflow`）。刻意**不做 orchestrator**；總說明 skill 只描述觸發順序，不自動串跑。

- **狀態交接契約**：所有跨步驟狀態一律落地在 `output/<project>/`，下一步讀回上一步的產出。每個 step 開頭先檢查前置檔是否存在，缺就中止並報「請先跑上一步」。這組**檔案邊界就是本功能的測試 seam**（見 Testing Decisions）。落地檔：`manifest.yml`、`pages.json`、`screenshots/`、`workflow.json`、`workflow.xlsx`。

- **`manifest.yml`（Manifest 契約）**：`f2w-start` 首次自動偵測後、經使用者確認才保存；之後重跑重用，可手動微調。至少描述：安裝指令、啟動指令、對外 port、base URL。是主要的宣告式擴充點／逃生口之一。

- **`pages.json`（Page 清單契約）**：`f2w-capture` 列舉出的 Page 清單。每個 Page 以「正規化後的路由 +（可選）tab 名稱」識別；是截圖、描述、Excel 列的共同單位。可手動增刪，是第二個逃生口。

- **`workflow.json`（Workflow description 契約）**：`f2w-describe` 產出。逐 Page 記錄：頁面用途、主要內容、可執行操作、每個操作的操作去向（前往哪一 Page）；另含一段獨立的 Overview。是 Workbook 每列的來源。

- **`workflow.xlsx`（Workbook）**：`f2w-export` 產出。兩個 sheet——「概述」（放 Overview）與「逐頁工作流程」（每列一個 Page，含描述與嵌入的截圖縮圖）。

- **純前端假設**：每個 project 一律當成無後端、無登入。不處理 auth。API 因無後端而回傳空資料／錯誤狀態時，照實截圖，不嘗試修復或偽造成功畫面。

- **確定性核心抽離**：把兩塊機械式邏輯抽成可獨立測試的小模組，由 prose skill 呼叫——(1) **路由正規化**（決定兩個 URL 是否為同一 Page）；(2) **xlsx 組裝**（產生兩個 sheet 並嵌入截圖縮圖）。其餘（Page 列舉、Workflow description、Overview）為 LLM 判斷，不做單元測試。

- **截圖工具**：採用可用的 Playwright MCP 進行逐 Page 截圖（本環境已提供）。此為預設選擇，若有更適合的瀏覽器自動化工具可於實作時調整。

- **輸出語言**：Workflow description 與 Overview 以繁體中文撰寫，對齊本 repo 的文件慣例（CONTEXT.md 為 zh-TW）。

- **詞彙**：spec 與產出一律使用 CONTEXT.md 詞彙表定義的用語（Workspace / Project / Manifest / Page / Pure-frontend / Workflow description / Overview / Workbook），不漂移到詞彙表明列避免的同義詞。

## Testing Decisions

- **什麼是好測試**：只測外部行為，不測實作細節。本功能的外部行為＝每個 step 在 `output/<project>/` 的**產出檔是否符合其契約**，以及最終 Workbook 的結構。測試不應斷言 prose skill 的內部措辭或 LLM 產生的描述字句。

- **選定的 seam：檔案交接契約**（經與開發者確認）。這是最高、最穩定的接縫——因為每步各自觸發、無法用記憶體傳遞，`output/<project>/` 的檔案邊界是狀態唯一的匯集點。每個 step 用 fixture 當輸入檔，斷言其輸出檔符合 schema 契約：
  - `f2w-capture` → `pages.json` 每個 Page 具備路由與（可選）tab 識別，且路由已正規化。
  - `f2w-describe` → `workflow.json` 每個 Page 具備用途／主要內容／操作／操作去向，且有一段 Overview。
  - `f2w-export` → `workflow.xlsx` 具備「概述」「逐頁工作流程」兩個 sheet，且逐頁列含縮圖。

- **確定性單元測試**：對抽離出的兩塊核心做單元測試——(1) 路由正規化：等價 URL 收斂成同一 Page、不同 tab 視為不同 Page；(2) xlsx 組裝：給定 `workflow.json` + `screenshots/` fixture，產出的 workbook sheet 數、列數與縮圖嵌入正確。

- **一次黃金端對端**：repo 內建一個 sample 純前端 project，跑完整 4 步，斷言最終 `workflow.xlsx` 的兩個 sheet 與縮圖。用來守住整條管線串接。

- **會被測試的模組**：路由正規化、xlsx 組裝，以及各 step 的檔案契約驗證。`f2w-start` 的偵測與啟動因高度依賴外部環境，僅由端對端 golden run 涵蓋。

- **既有 prior art**：無——本 repo 為綠地，尚無測試。測試檔沿用 repo 慣例的 `*.test.*` 命名並與受測模組就近放置；測試框架於實作時依所選 runtime 決定。

## Out of Scope

- **一鍵跑完 4 步的 orchestrator**：依 ADR-0001 刻意列為未來擴充，本 spec 不做。
- **後端與登入**：純前端假設下不處理 auth，也不支援需要登入才能進入的 project。
- **非前端／需後端才能啟動的 project**。
- **修復或詮釋 API 錯誤**：無後端造成的空資料／錯誤狀態照實截圖，不做修復。
- **截圖的視覺回歸／像素比對**：不在本 spec 的測試範圍。
- **多 context repo 處理**：本 repo 為單一 context（無 `CONTEXT-MAP.md`）。

## Further Notes

- `manifest.yml` 與 `pages.json` 是兩個宣告式逃生口，也是主要擴充點（ADR-0001）——先讓自動偵測／列舉盡量準，再讓使用者手改補洞。
- 未來新增步驟＝新增一個沿用同一套 `output/<project>/` 檔案契約的 `f2w-*` skill，不動既有步驟。
- 設計來源：`CONTEXT.md`（詞彙表）與 `docs/adr/0001-split-pipeline-into-step-skills.md`。若實作與 ADR-0001 衝突，應先回頭重開該 ADR 討論，而非默默覆蓋。

## Implementation issues

- [`issues/01-pipeline-skeleton-contracts.md`](issues/01-pipeline-skeleton-contracts.md) — f2w：管線骨架與檔案契約（prefactor） (closed, originally #5)
- [`issues/02-f2w-start.md`](issues/02-f2w-start.md) — f2w-start：偵測並啟動 project (closed, originally #6)
- [`issues/03-f2w-capture.md`](issues/03-f2w-capture.md) — f2w-capture：列舉 Page 並截圖 (closed, originally #7)
- [`issues/04-f2w-describe.md`](issues/04-f2w-describe.md) — f2w-describe：逐頁工作流程描述 (closed, originally #8)
- [`issues/05-f2w-export.md`](issues/05-f2w-export.md) — f2w-export：組裝 Workbook（workflow.xlsx） (closed, originally #9)
- [`issues/06-overview-skill.md`](issues/06-overview-skill.md) — frontend-to-workflow：總說明 skill (closed, originally #10)
- [`issues/07-golden-e2e-test.md`](issues/07-golden-e2e-test.md) — f2w：黃金端對端測試 (closed, originally #11)
