---
name: f2w-diagram
description: frontend-to-workflow 管線中與 f2w-export 並列的分支步，也是唯一畫圖的推論步。讀取 workflow.json，按頂層 Page 分類切主線（一個分類一條主線、分頁名照抄、順序照頁序），落成交接檔 mainflow.json（可手改；已存在就沿用、不重推論），再由純函式產出多分頁的 Main flow diagram mainflow.drawio——一條主線一張大分頁、最後一頁是把全部主線由上到下依序排在一起的總覽，頁內單列橫排 1–10 個編號步驟、只留主幹（彈窗與明細頁不畫），一步可收攏多個 Page（收攏的頁只進 tooltip）。讀者是業主，圖上乾淨：不標「推論·待確認」、不標 ⚠。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-diagram, infer a project's main business flows, or produce mainflow.json and the Main flow diagram mainflow.drawio for the frontend-to-workflow pipeline.
---

# f2w-diagram：主線流程圖（Main flow diagram）

與 `f2w-export` **並列的分支步**（不是插入步、不佔步驟編號）：兩者都只讀 `f2w-describe` 產出的 `output/<project>/workflow.json`、互不依賴、可各自單獨重跑。本步把專案的每個**頂層 Page 分類**各收成一條 **Main flow（主線）**，畫成一份 **Main flow diagram**——draw.io 檔 `output/<project>/mainflow.drawio`（明文 mxGraphModel、含座標、多分頁），draw.io 開起來即有版面。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。
產出：`output/<project>/mainflow.json`（推論交接檔、可手改）與 `output/<project>/mainflow.drawio`（交付物）。

決策與理由見 `docs/adr/0006-navigation-diagram-as-drawio.md`（draw.io 明文不壓縮、邊座標交給 draw.io、tooltip 承載圖上收掉的資訊——這三條仍有效）、`docs/adr/0008-main-flow-diagram-ai-inferred.md`（改成主線流程圖、推論落在 mainflow.json）、`docs/adr/0009-main-flow-per-top-level-page-group.md`（**主線邊界＝頂層 Page 分類、分頁名照抄、步數 1–10**，取代 0008 的邊界那一節）與 `docs/adr/0010-main-flow-overview-page-last.md`（**最後一頁固定是總覽**，取代 0008 的「要不要總覽頁」那一節）。`docs/adr/0005-navigation-diagram-as-bpmn.md` 是歷史（它的「畫的是導覽不是業務流程」與「零推論」兩條底線已被取代）；`docs/adr/0007-navigation-diagram-one-section-per-page.md` 整份已被取代（Section 分頁、麵包屑樹、收邊三規則、分層網格 fallback、孤立頁 warning 全部退場）。

## 這一步是推論步

本步**會推論**：`workflow.json` 裡沒有「每條主線分幾步、每步叫什麼」這件事，那是業務層級的歸納。推論素材是每頁的 `purpose`（步驟措辭與分步依據）與 `overview`（業務語氣參考）。

**主線邊界不推論**：一條主線＝一個**頂層 Page 分類**（此類專案即側欄模組），`flows[].name` **照抄該分類名、不改字**，`flows` 順序照 `workflow.json` 的頁序。這樣業主看圖就是看側欄，不必把圖上的名字對回系統。分類本身仍由 AI 從 `pages[]` 讀出來（`｜` 階層是 f2w-capture 的命名慣例、不是契約欄位，所以 `src/` 不解析它）。

推論結果**一律先落成 `mainflow.json`**，再由純函式照它畫圖（前例＝`f2w-breakdown` 吃外部事實（權責泳道圖與 Vendor spec）產出帶分工鏈的 `workitems.json`）。`src/diagram/` 這一側維持純函式、可斷言：不讀語意、不猜順序，只做版面與一致性硬驗。

推論的痕跡**不上圖面**：不標「推論·待確認」、不標 ⚠。這張圖是給**業主**看的，要乾淨好懂；要查 AI 判斷了什麼就看 `mainflow.json`。（與 ADR-0002 的推論工項、`docs/adr/0007-party-assignment-from-swimlane-diagram.md` 的配對待確認是不同維度，那兩者不變。）

## 這張圖只畫主幹

一條主線一張大分頁（第 1 頁就是第一條主線），**最後一頁固定是「總覽」**——把每條主線那一列**照 `flows` 順序由上到下**排在同一頁，內容與該主線自己那頁逐字相同、只換 y 座標，拿來簡報與列印用。頁內是**單列橫排、不折行**的主鏈，1–10 步，**只留主幹**——彈窗與明細頁不畫。**一步可收攏多個 Page**（例如服務維護的五個 tab 收成「維運模型服務」一步），收攏的頁只進 tooltip、不上圖面。

步數**不必每頁一樣長**：頁多的分類切細（0729 的 `算力排程與工作負載` 15 頁切 7 步）、頁少的就 1–2 步（`系統設定` 只有 1 頁＝1 步）。不要為了讓每頁看起來一樣長而併分類或硬拆步。

業主向的字數上限寫進契約由 zod 擋下，不靠提示詞自律：節點標題 `title` ≤ **12** 字（`STEP_TITLE_MAX`）、節點小字 `note` ≤ **30** 字（`STEP_NOTE_MAX`）、邊 label `edgeLabel` ≤ **8** 字（`EDGE_LABEL_MAX`）、一條主線 **1–10** 步（`STEPS_MIN`／`STEPS_MAX`）。

## 語意映射

| mainflow.json | draw.io（mainflow.drawio） |
|---|---|
| 每個 `flows[n]` | 一個分頁（`Diagram_<n>`，分頁名＝主線 `name`）：頂端 24px 粗體主線標題（`Title_<n>`）＋ 正下方同色系細橫線（`Rule_<n>`）。整頁色系依 `flows` 順序取固定 9 色色表、超過循環 |
| 每個 `steps[n]` | 單列橫排的一個步驟框（`Step_<flow>_<step>`，240×100、圓角淡底深框）：兩段式＝**粗體「編號. `title`」** ＋ 小字 `note` |
| `steps[].pages` | 該步驟框的 draw.io tooltip，抬頭「此步驟涵蓋的頁面：」逐頁列 route（含 tab）；**不上圖面** |
| `steps[].edgeLabel` | 往下一步的推進邊（`Edge_<flow>_<step>`）的 label——AI 寫的**業務轉場動作**，不逐字引用 action label。最後一步不得有 |
| `excludedPages` | **圖上完全不提**；只留在 mainflow.json（各帶一句 `reason`）與本步回報的 warning |
| 全部 `flows` | 額外一個**最後分頁**（`Diagram_Overview`，分頁名「總覽」）：每條主線一列、照 `flows` 順序由上到下（列距 310px），圖元 id 加 `Overview_` 前綴。內容與各主線那頁逐字相同，色系各自沿用 |

## 流程

1. **讀取前置** — `loadWorkflowForDiagram(outputRoot, project)`
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **主線推論**（本步唯一的推論處，**繁體中文**）
   - 先問 `hasMainflow(outputRoot, project)`：**已存在就沿用**——用 `loadMainflowForDiagram` 讀回驗證，**跳過推論**（含使用者手改過的版本）。要重推論就先刪掉該檔或明講「重推主線」。
   - 不存在才推論：先把 `pages[]` 按**頂層分類**分組，一組一條主線、`name` 照抄分類名、順序照頁序；再依每頁 `purpose` 把該組切成 1–10 個 step，逐步填 `title`（≤12 字）、`note`（≤30 字）、`pages`（≥1，一步可收攏多個 Page）、`edgeLabel`（≤8 字，最後一步不填）。分步時**先看操作去向再定順序**：模組內部常是樞紐頁連出所有彈窗、彈窗只連回樞紐（hub-and-spoke），這種時候彈窗與同層 tab 要**併進樞紐那一步**，否則過不了真實邊硬驗。真的不該上圖的頁才進 `excludedPages`（各寫一句 `reason`）；分類全出時它就是空陣列。
   - 寫出 `output/<project>/mainflow.json`（路徑見 `mainflowPath`）後**先給使用者看過**再往下走——主線分錯在這裡改最省事。
3. **組裝** — `buildDiagram(workflow, mainflow)`
   - 依上表映射：一條主線一個分頁、標題＋細橫線＋單列橫排的步驟與推進邊，最後再補一個總覽分頁（同一段 layout 程式、只換 y 座標與 id 前綴，所以總覽頁不可能與主線頁長得不一樣）。步驟框座標算死（欄距 340px、總覽頁列距 310px），邊不算座標、直角繞路交給 draw.io。
   - 同時跑一致性硬驗，不一致丟 `DiagramConsistencyError`（見下）。
4. **序列化** — `renderDiagram(diagram)`
   - 吐明文 mxGraphModel XML（`mxfile` ＋ 一條主線一個 `diagram`、最後一個是總覽）。色系寫死在序列化層（`FLOW_PALETTE`）以維持確定性、掛在圖元的 `colorIndex` 上（總覽頁一頁多色）；帶 tooltip 的節點包一層 `UserObject`。
   - 刻意不寫 draw.io 存檔才會補的 `modified`／`etag`／`agent`／`version`——那些帶時間戳。同一份 diagram 兩次序列化字串完全相同。
5. **保存** — `saveDiagram(outputRoot, project, xml)`
   - 寫 `output/<project>/mainflow.drawio`，**直接覆寫**。
6. **回報 warnings** — 把 `diagram.warnings` 原文轉述給**使用者**（不是業主）
   - 目前只有一條：落選頁清單（`excludedPagesWarning`），逐頁列 route（含 tab）與 `reason`，並提醒「要救回來就把它移進 mainflow.json 的某一步」。
7. **開檔驗證** — XML 自洽不等於工具吃得下，所以要真的開一次。driver（`f2w-run/run-diagram*.test.ts`）是 vitest、**不叫 LLM**：它讀 `output/<project>/mainflow.json`，**缺檔就出聲 skip**（推論那一步得先由本 skill 跑過）；save 完用 draw.io CLI 匯出**全部分頁**當驗證，找不到執行檔時出聲 skip，設 `DRAWIO_EXE` 指向它即可。手動驗：

   ```bash
   "$LOCALAPPDATA/Programs/draw.io/draw.io.exe" --export --format pdf --all-pages -o mainflow.pdf "output/<project>/mainflow.drawio"
   ```

   `--all-pages` 對 PNG 無效（只吐第 1 頁），要驗「每個分頁都打得開」得走 PDF；要看單頁 PNG 用 `--page-index N`（總覽是最後一頁，`N` ＝ 主線數）。匯出成功還不夠——**工具吃得下不代表業主看得懂**：真的看一眼匯出的 PDF／PNG，確認單列橫排沒被邊穿過、label 沒有被壓住、總覽頁每列沒有互相疊到。縮圖上看起來疊字時**先回查 XML 座標**（同座標才是真的疊）——draw.io 匯 PNG 時吐 GPU 警告的話，縮放後的假影會很像疊字。

## 四道硬錯：改 mainflow.json 重排，不是放寬驗證

`buildDiagram` 撞到下列任一種即丟 `DiagramConsistencyError` 並**不產檔**：

- **project 不一致** — `mainflow.json` 與 `workflow.json` 的 `project` 不同名（把別的專案的主線接上來了）。
- **涵蓋不完整** — `steps[].pages` ∪ `excludedPages` 沒有剛好等於 `workflow.json` 的頁集合：提到不存在的 Page，或有 Page「既不在任何主線步驟裡、也不在 excludedPages」。**每一頁都要表態**，圖上少了什麼才永遠查得到。
- **相鄰步之間沒有真實操作去向墊背** — 來源步任一頁 → 目標步任一頁，在 `workflow.json` 裡至少要有一條 `destination` 邊。邊 label 可以是業務措辭，但每條邊都得有事實支撐；接不上就**調整步驟順序或重新分步**，不畫虛線。
- （沿用的上游硬錯）**操作去向指向不存在的 Page** — `workflow.json` 自己被手改壞了。

契約層由 zod 先擋一輪，違反丟 `ContractValidationError`：字數上限（12／30／8）、步數 1–10、`edgeLabel` 位置（除最後一步外每步都要有、最後一步不得有）、每個 Page 只能出現一次。

上述任何一種的處理方式都是**回頭改 `mainflow.json` 重排主線**（改分步、改順序、改字數、把頁移進某一步或移進 `excludedPages`），不是放寬驗證。

## 逃生口

`mainflow.json` 是**交接檔**：主線分錯、步驟名不對、某頁該進圖卻被踢掉，直接手改該檔即可，符合契約就畫得出來。**手改優先、重跑沿用**——本步不會覆寫已存在的 mainflow.json；要 AI 重推一遍就刪檔或明講「重推主線」。

`mainflow.drawio` 是**交付物、不是交接檔**（同 `workflow.xlsx` 語意）：圖不對就回頭改 `mainflow.json`（或更上游的 `workflow.json`）再重跑本步。可以在 draw.io 裡圖形化調版面，但**重跑會直接覆寫**——要保留手調的排版請自己另存一份副本（draw.io 存檔後也會補上時間戳屬性、可能改成壓縮格式，與本步產出的明文檔不再逐字元可比）。

圖上被省略的操作（彈窗、明細頁、落選頁、被收攏進某一步的頁）**完整保留在 `workflow.xlsx`**——它是操作清單的權威來源。舊版產出的 `output/<project>/workflow.drawio` 已不再是本步的交付物，是孤兒檔，要不要清由使用者自行決定。

## 對應實作

`src/diagram/`：`loadWorkflowForDiagram`（前置檢查＋讀回 workflow.json）、`mainflowPath`／`hasMainflow`／`loadMainflowForDiagram`（推論交接檔的路徑、存在判定與讀回驗證）、`buildDiagram(workflow, mainflow)`（語意映射＋單列橫排 layout ＋總覽頁堆疊＋一致性硬驗的確定性核心，`DiagramConsistencyError`；一列的 layout 抽成 `buildFlowRow`，主線頁與總覽頁共用，`OVERVIEW_PAGE_NAME` ＝分頁名）、`renderDiagram`（多分頁 mxGraph XML 序列化＋色系，色掛在 `DiagramNode.colorIndex`）、`saveDiagram`（覆寫保存）。`sections.ts`（階層路徑與 Section 分組）與麵包屑樹 layout、分層網格 fallback 已隨 ADR-0008 刪除。

契約見 `src/contracts/mainflow.ts`（`mainflowSchema`、`STEP_TITLE_MAX`／`STEP_NOTE_MAX`／`EDGE_LABEL_MAX`、`STEPS_MIN`／`STEPS_MAX`、`excludedPageSchema`）與 `src/contracts/workflow.ts`；路徑見 `src/output.ts`（契約名 `mainflow`＝`mainflow.json`、`diagram`＝`mainflow.drawio`）。詞彙見 `CONTEXT.md`。
