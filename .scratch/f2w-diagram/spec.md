# f2w-diagram：Navigation diagram 改成一個 Section 一條完整路線（多分頁 draw.io）

State: closed
Status: ready-for-agent
Created: 2026-07-29
Closed: 2026-07-29
Author: Anuise
Origin: GitHub issue #35 — https://github.com/Anuise/frontend-to-workflow/issues/35

## Problem Statement

`f2w-diagram` 產出的 Navigation diagram 人看不懂。

實測一份 41 頁的專案（`output/new_0724_AI六大模組管理平台_桃園智發會_最新版`）：

- **邊亂**：41 個 Page 節點、180 條換頁邊全部擠在同一張 BFS 分層網格上。7 欄之內 180 條直角邊互相穿越，看不出任何一條使用者路徑。
- **標籤糊**：節點標籤是 `purpose` 全文，長度中位數 33 字、最長 50 字，塞進 160×80 的方框。掃視時認不出「這是哪一頁」。

收圖的人要的是「每一個流程一條完整的路線」，現在拿到的是一團毛球。

## Solution

`workflow.drawio` 從單張畫布改成 **多分頁**：第 1 頁是總覽，之後每個 **Section** 一頁，每頁畫成一條依麵包屑階層展開的完整路線。

同時做三件收斂，把 180 條邊砍到 39 條：

1. 側邊欄造成的全模組互通邊，收成一個 **Global nav marker**。
2. 同父 tab 之間的互跳邊，收成一個 **Tab group** 框。
3. 子頁回祖先的返回邊，降級進節點 tooltip。

節點改成兩段式：粗體標題（麵包屑末段）負責掃視，小字 `purpose` 負責理解。

ADR-0005 的三條底線完整保留：**畫的是導覽不是業務流程**、**零推論**、**確定性可斷言**。所有分組、分層、邊分類都只看結構（頁面識別與邊的拓撲），不讀 label 語意。

## User Stories

1. As a 收圖的專案關係人, I want 每個功能區各自一頁, so that 我一次只需要理解一條路線，而不是同時看 41 頁。
2. As a 收圖的專案關係人, I want 第一頁是一張只有九個節點的總覽, so that 我先知道整個系統有哪幾條路線再決定鑽進哪一條。
3. As a 收圖的專案關係人, I want 總覽頁上每個 Section 方框都能點進對應分頁, so that 我不用在 draw.io 的分頁列裡找名字。
4. As a 收圖的專案關係人, I want 總覽頁標出使用者從哪一頁進場, so that 我知道這份圖該從哪裡開始讀。
5. As a 收圖的專案關係人, I want 側邊欄「處處可達」被畫成單一個記號而不是 73 條線, so that 圖上剩下的線都是真的有流程意義的線。
6. As a 收圖的專案關係人, I want 每個節點一眼看到短標題, so that 我能在掃視時認出頁面身分，不必逐字讀 33 字的用途敘述。
7. As a 收圖的專案關係人, I want 節點上同時看得到頁面用途, so that 這張圖仍是工作流程文件，而不是退化成網站地圖。
8. As a 收圖的專案關係人, I want 節點與 Section 分頁的排列來自頁面本身的階層而非邊的拓撲, so that 上游漏掉幾條邊時版面不會整個垮掉。
9. As a 收圖的專案關係人, I want 同一個父頁底下可互相切換的 tab 被一個框圈起來, so that 我知道它們是平行的檢視而不是流程的六個步驟。
10. As a 收圖的專案關係人, I want 邊的說明文字原文照印不截斷, so that 我不會因為省略號而漏掉觸發條件。
11. As a 收圖的專案關係人, I want 從入口走不到的孤立頁仍出現在它該在的 Section 裡並標上警示記號, so that 我看得到它存在，也知道它的導覽路徑有缺口。
12. As a 收圖的專案關係人, I want 匯出 PNG 時看得到節點標題與用途, so that 我把圖貼進簡報時不需要滑鼠停留。
13. As a pipeline 使用者, I want 交付物仍然只有 `workflow.drawio` 一個檔, so that 交付清單不變、跟 `workflow.xlsx` 的單檔慣例一致。
14. As a pipeline 使用者, I want 同一份 `workflow.json` 重跑產出逐字元相同的檔案, so that 我可以把它納入版控並看出真正的差異。
15. As a pipeline 使用者, I want 圖畫錯時我改 `workflow.json` 重跑就好, so that 我不需要理解 layout 演算法。
16. As a pipeline 使用者, I want 某個專案的路由與 tab 都是平的時候本步仍然產得出圖, so that 這個 skill 不會只對麵包屑乾淨的專案有用。
17. As a pipeline 使用者, I want 退回舊分層演算法時本步出聲告訴我, so that 我知道這張圖為什麼長得跟預期不同，並可回頭調 `f2w-capture` 的 tab 命名。
18. As a pipeline 使用者, I want 缺 `workflow.json` 時本步中止並提示先跑 `f2w-describe`, so that 我不會拿到一張空圖。
19. As a pipeline 使用者, I want 操作去向指向不存在的 Page 時本步報錯而不是默默略過, so that 我手改壞的 `workflow.json` 會被抓出來。
20. As a pipeline 使用者, I want 被收掉的返回操作與不換頁操作仍留在節點 tooltip, so that 在 draw.io 裡滑過去仍查得到。
21. As a pipeline 使用者, I want 圖上被收掉的操作說明仍完整保留在 `workflow.xlsx`, so that 操作清單有一個不打折的權威來源。
22. As a f2w-diagram 的維護者, I want 分組、分層、邊分類的規則全部只看結構不讀語意, so that 本步維持零推論、不引進新的「待確認」維度。
23. As a f2w-diagram 的維護者, I want 這些規則在純函式接縫上以資料形式被斷言, so that 測試不必用 regex 打 XML 字串。
24. As a f2w-diagram 的維護者, I want driver 驗證匯出全部分頁, so that 「XML 自洽但 draw.io 開不起來」的舊教訓在多分頁形狀下也蓋得到。
25. As a f2w-diagram 的維護者, I want 麵包屑有一段但沒有對應實頁時自動生出一個框, so that `模型服務詳情｜資訊`／`｜資源` 這種只有 tab 子頁的分支不會平鋪成一排孤兒。

## Implementation Decisions

### 新增的領域詞彙（進 `CONTEXT.md`）

- **Section（區段）** — 分組後的一群 Page ＋ 它們的麵包屑樹 ＋ 對應的一個 draw.io 分頁。使用者口語的「一條完整的路線」即指 Section。不叫 Route（撞 `pages[].route`）、不叫 Flow（撞 `workflow`）。
- **Global nav marker（全域導覽記號）** — 收掉側邊欄邊之後代表「從任一頁都可跳到各 Section 首頁」的單一節點。與既有的 Entry marker（入口記號）同一類。
- **Implied node（隱含節點）** — 麵包屑階層有這一段、但 `workflow.json` 裡沒有對應 Page 而生出的框。名稱點明它由結構推得，不是 AI 推論。
- **Tab group（tab 群組）** — 圈住同父 tab 子頁的框。

### 階層路徑（hierarchy path）

每個 Page 的階層路徑 = `route` 的 path 段（去掉空段與 `index`）＋ `tab` 以 `｜` 切開的段，依序串接。深度即段數。這是本次所有分組與 layout 的唯一依據，與邊完全無關。

### Section 分組

階層路徑的**第一個具區辨力的段**決定 Section。實測資料每頁的第 0 段都是 `SSO`（登入方式），第 1 段才分岔 —— 規則是取第一個「不是所有頁面都相同」的段。切出 8 個 Section：`登入1／模型倉庫2／叢集資源總覽1／算力申請與審核9／算力排程與工作負載17／安全監控2／追蹤日誌5／帳號與權限管理4`。Section 的順序與命名沿用 `workflow.json` 的 Page 原順序。

### 邊的四類分類與處置

每條 `destination` 非 null 的操作先判跨不跨 Section，再依階層路徑判關係：

| 類別 | 判準 | 處置 | 實測條數 |
|---|---|---|---|
| 全域導覽 | 跨 Section 且目的地為該 Section 首頁 | 收成 Global nav marker 出發的邊（每 Section 一條） | 73 → 8 |
| 真實跨 Section 轉場 | 跨 Section 且目的地非該 Section 首頁 | 畫在總覽頁上，Section 方框之間 | 1 |
| 父 → 子 | 同 Section，目的地階層路徑為來源的直接子代 | 畫成推進邊 | 18 |
| 其他同 Section | 同 Section，非父子、非兄弟、非子→祖先 | 畫成推進邊 | 12 |
| 兄弟 ↔ 兄弟 | 同 Section，同父且同深度 | 不畫邊，改用 Tab group 框 | 46 → 0 |
| 子 → 祖先 | 同 Section，目的地為來源的祖先 | 不畫邊，label 併入來源節點 tooltip 的「返回操作」段 | 30 → 0 |

總邊數 180 → 39（30 推進 ＋ 8 全域導覽 ＋ 1 跨 Section 轉場）。

**明確接受的取捨**：返回邊的 label 帶語意差異（`按取消回專案詳情` vs `按儲存並建立回專案詳情`），後者其實是流程推進的終點。要確定性分辨兩者只能讀 label 文字 = 推論，違反本步底線。因此「儲存成功後回到哪裡」在圖上不畫，只在 tooltip 與 `workflow.xlsx`。`workflow.xlsx` 是操作清單的權威來源。

### 分頁結構

`workflow.drawio` 內含 `1 + Section 數` 個 `<diagram>`：

- **第 1 頁「總覽」**：Entry marker → `pages[0]` 所屬 Section 的方框；Global nav marker → 每個 Section 方框各一條邊；Section 方框標「Section 名（n 頁）」並掛 draw.io 的 page link 指向該 Section 分頁；真實跨 Section 轉場邊畫在方框之間。
- **第 2..n 頁**：每個 Section 一頁，頁名即 Section 名。

### Section 分頁的 layout

麵包屑樹，父在左、子在右：欄 = 相對於 Section 根的階層深度，列 = 深度優先走訪順序（子樹連續佔列），兄弟順序沿用 `workflow.json` 原順序。座標確定性，邊的繞路仍交給 draw.io。

Implied node 在階層路徑中間出現「有段無實頁」時生成，佔一個框位、無 `purpose`、無 tooltip。

Tab group 框圈住同父的 tab 子頁；框上標題固定字串「可互相切換的 tab」。只有當該組兄弟之間實際存在互跳邊時才生框（否則平行子頁不該被誤標成可切換）。

### fallback

某 Section 內切不出 ≥2 層階層時，該 Section 退回 BFS 分層網格（現行演算法），並發一條 warning。fallback 是逐 Section 判定，不是全域的。

### 節點外觀

- **兩段式**：第一行粗體 = 階層路徑末段；第二行小字 = `purpose`。框 240×100。
- **Tooltip**：`不換頁的操作：…`（既有）＋ `返回操作：…`（新增）。兩段都有時依序列出。
- **孤立頁**：從入口 BFS 走不到、且非 `pages[0]` 的 Page，標題前綴 `⚠`。它仍排在自己 Section 的麵包屑樹裡（layout 與邊無關，所以孤立不影響版面）。
- **邊 label**：原文照印，不截斷。

### warnings 的增減

- **刪除** `NO_LEAF_PAGE_WARNING`（純循環無終點）—— 麵包屑樹永遠有葉節點，這條在新形狀下失去意義。
- **保留** 孤立頁 warning（文字沿用）。
- **新增** fallback warning：某 Section 切不出 ≥2 層、已退回 BFS 分層。

### 模組與介面

`src/diagram/` 四個函式，簽章變動只在中間兩個：

- `loadWorkflowForDiagram(outputRoot, project) -> Workflow` — **不動**。
- `buildDiagram(workflow) -> NavigationDiagram` — 回傳型別由單層 `{ name, nodes, edges, warnings }` 改為 `{ name, pages: DiagramPage[], warnings }`，`DiagramPage = { id, name, nodes, edges, groups }`。節點型別多 `kind: "globalNav" | "implied" | "section"`、多 `title`（兩段式的第一行）；新增 `DiagramGroup`（Tab group 框）。`DiagramConsistencyError` 維持。
- `renderDiagram(diagram) -> string` — 輸出多個 `<diagram>`；新增 page link、群組框 cell、兩段式節點的 HTML label 與樣式。確定性前提（不寫 `modified`／`etag`／`agent`）維持。
- `saveDiagram(outputRoot, project, xml) -> path` — **不動**。

`src/contracts/workflow.ts` 契約**不動** —— 本次不改 `workflow.json` 的 schema，所有新資訊都從既有欄位推得。

### 文件

- 新增 `docs/adr/0007-*.md`：取代 ADR-0006 的「單張畫布」與「一頁一節點的 BFS 網格 layout」兩項決策；保留 ADR-0006 的明文不壓縮、邊座標交給 draw.io、不換頁操作降 tooltip。記錄 Implied node 與 Tab group 是本步第一次畫出不存在於 `workflow.json` 的圖元，並說明為何仍屬零推論。
- `CONTEXT.md` 加四個新詞；`Navigation diagram` 詞條補上多分頁與 Section。
- `.claude/skills/f2w-diagram/SKILL.md` 改寫語意映射表、流程、warnings 兩種情形、驗證指令加 `--all-pages`。

## Testing Decisions

**什麼是好測試**：只斷言外部行為。`buildDiagram` 的外部行為是它回傳的資料結構（哪些節點、落在哪一格、哪些邊還在、warnings 說了什麼），不是它內部怎麼走訪。`renderDiagram` 的外部行為是 XML 字串的結構與確定性。不去斷言 helper 函式、不去斷言中間變數。

**受測模組**：`src/diagram/buildDiagram.ts` 與 `src/diagram/renderDiagram.ts`，兩個既有的純函式接縫。`loadWorkflowForDiagram` 與 `saveDiagram` 的既有測試不動。

**Prior art**：`src/diagram/buildDiagram.test.ts` 與 `src/diagram/renderDiagram.test.ts` 現行寫法即範本 —— 檔頂一個手寫的 `Workflow` fixture、`describe` 依語意分組、用 `nodeById`／`edgesFrom` 這類小 helper 讀回傳值、`renderDiagram.test.ts` 用 `countOf(xml, /pattern/g)` 數 XML 元素。沿用。

**fixture 的處置**：現行 4 頁 fixture（首頁／關於／設定｜個人資料／孤立頁）階層太淺、切不出 ≥2 層，它改當 **fallback 路徑**的測試（退回 BFS 分層 ＋ 發 warning）。另外新增一份有麵包屑階層的 fixture 覆蓋主路徑，需要涵蓋：多 Section、側邊欄型跨 Section 邊、真實跨 Section 轉場、父子邊、兄弟 tab 互跳、子→祖先返回、有段無實頁的 Implied node、孤立頁。

**要斷言的行為**（不是窮舉，是必蓋的）：Section 切分與順序、每個 Section 一個 `DiagramPage`、總覽頁的節點組成與 page link、四類邊各自的存留與去向、Tab group 只在真有互跳時生成、返回操作進 tooltip、兩段式節點的 title 與 label、孤立頁的 `⚠` 與所屬 Section、fallback 觸發與 warning 文字、`NO_LEAF_PAGE_WARNING` 已不再出現、壞掉的 `destination` 仍丟 `DiagramConsistencyError`、兩次序列化逐字元相同。

**driver**：`f2w-run/run-diagram.test.ts` 在 `saveDiagram` 之後改用 `draw.io --export --all-pages` 匯出驗證真的打得開；找不到執行檔時維持出聲 skip（`DRAWIO_EXE` 可覆寫）。

## Out of Scope

- **不改 `workflow.json` 契約**。特別是「在 `action` 上加 `kind: advance | return | cancel`」這個提案已被明確排除在本次之外 —— 它會把推論責任推回 `f2w-describe`，是另一個決策。
- **不改其他 pipeline 步**：`f2w-export`／`f2w-breakdown`／`f2w-sourcing` 一律不動。
- **不畫業務流程**：決策條件、角色泳道、訊息事件仍然不畫（ADR-0005 底線）。
- **不做互動式版面調整**：draw.io 裡手調的版面重跑仍會被覆寫，逃生口語意不變。
- **不保留舊的單張全圖**：明確不做「總覽頁畫 41 節點全圖」的備查版本。
- **不做邊 label 截斷**。
- **不處理 `f2w-capture` 的漏邊盲點**（hash routing、非 `<a>` 導覽）—— 孤立頁 warning 照舊提醒，修在上游。

## Further Notes

**已知風險**：麵包屑階層是 `f2w-capture` 的 tab 命名慣例，不是契約強制的結構。實測這份資料剛好乾淨（8 個 Section、深度最多 4）。遇到平的 tab 就走 fallback，圖會退回接近現況的可讀性。fallback 路徑必須有測試蓋，否則這個風險是隱形的。

**驗證資料**：`output/new_0724_AI六大模組管理平台_桃園智發會_最新版/workflow.json`（41 頁、257 個 action、180 條換頁邊）是本 spec 所有數字的來源，可拿來做改完後的實跑驗收。

**決策來源**：本 spec 由一次 `/grill-with-docs` 逐題確認產生，Q1～Q8 的選項與取捨（含被否決的方案）記在 ADR-0007。

## Implementation issues

- [`issues/01-hierarchy-path-sections.md`](issues/01-hierarchy-path-sections.md) — f2w-diagram T1：抽出階層路徑與 Section 分組（prefactor） (closed, originally #36)
- [`issues/02-multipage-overview-global-nav.md`](issues/02-multipage-overview-global-nav.md) — f2w-diagram T2：多分頁 ＋ 總覽頁 ＋ 全域導覽記號 (closed, originally #37)
- [`issues/03-breadcrumb-tree-layout.md`](issues/03-breadcrumb-tree-layout.md) — f2w-diagram T3：麵包屑樹 layout ＋ 隱含節點 ＋ fallback (closed, originally #38)
- [`issues/04-edge-convergence.md`](issues/04-edge-convergence.md) — f2w-diagram T4：邊收斂——Tab group 框 ＋ 返回操作進 tooltip (closed, originally #39)
- [`issues/05-two-line-node-appearance.md`](issues/05-two-line-node-appearance.md) — f2w-diagram T5：兩段式節點外觀 (closed, originally #40)
- [`issues/06-docs-adr-0007.md`](issues/06-docs-adr-0007.md) — f2w-diagram T6：文件——ADR-0007、CONTEXT.md、SKILL.md (closed, originally #41)
