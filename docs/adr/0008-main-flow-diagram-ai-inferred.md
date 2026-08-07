# 圖改畫業主向的 Main flow diagram，主線推論落在 mainflow.json

> **部分已被 ADR-0009 取代**：「『一個流程』的邊界」一節（AI 從 `overview` 歸納業務主線）改成「一個頂層 Page 分類一條主線、分頁名照抄」；步數區間 2–7 改成 1–10；`FLOW_PALETTE` 6 色補到 9 色。
> **「要不要總覽頁」一節已被 ADR-0010 取代**：改成最後一個分頁固定是總覽，把每條主線那一列原樣由上到下堆疊（第 1 頁仍是第一條主線）。
> **「邊 label 的來源」與「相鄰兩步在 `workflow.json` 裡接不上時」兩節已被 [ADR-0020](0020-main-flow-carries-conditional-branches.md) 取代**：`edgeLabel`（一步一條、只能指向下一步、最後一步不得有）退場，改成每一步一個 `outcomes[]`（`condition` ≤8 字 ＋ `target` 步號 ＋ `evidence` 事實憑據，終點步明寫空陣列），一步 ≥2 個出口就在圖上長出菱形決策點；`requireRealEdges` 的「相鄰兩步要有真實 `destination` 墊背」換成 `requireEvidencedOutcomes` 的「`evidence` 逐字命中來源步某頁的 `actions[].label`」。本 ADR 其餘各節仍有效。

`f2w-diagram` 由**零推論步**變成**推論步**。產物由 Navigation diagram（導覽圖，實際上是網站地圖）換成 **Main flow diagram（主線流程圖）**，檔名由 `workflow.drawio` 改成 `mainflow.drawio`（契約鍵 `diagram` 不動），讀者是**業主**。本 ADR 取代 **ADR-0007 整份**（Section 分頁、麵包屑樹 layout、收邊三規則、退回分層網格的 fallback、孤立頁 warning），以及 **ADR-0005 三條底線中的兩條**——「畫的是導覽不是業務流程」與「零推論」。ADR-0005 的第三條「確定性可被斷言」保留；**ADR-0006 的三項**（明文不壓縮 `.drawio`、邊的座標交給 draw.io、圖上收掉的資訊降 tooltip）保留——但第三項只保留機制：tooltip 承載的內容由「不換頁的操作」換成「這一步收攏了哪些 Page」，不換頁的操作不再進圖，一律回 `workflow.xlsx` 查。

起因是把 ADR-0007 的規則實跑在 0729 專案（`output/0729_AI六大模組管理平台_5E_AI平台最新版`，41 頁、257 個操作中 236 個有去向）：Section 規則把它切成 **24 個 Section ＝ 25 個 drawio 分頁**，多數分頁只有 1–3 個節點，全檔僅 69 個 vertex／36 條邊；分頁名直接取自階層路徑末段，於是出現「往下」「已修改」「修改回覆」這種讀不出業務意義的頁籤。根因是這個站的 `route` **恆為 `/`**、41 頁全靠 tab 分層，ADR-0007 賴以切 Section 的階層路徑規則整體失效。反倒是同一份 `workflow.json` 的 `overview` 早就自報：「核心使用流程有五條主線：（1）模型供給（2）算力供給與部署（3）代理人治理（4）安全治理與觀測（5）人工覆核」——業主要看的東西上游已經寫下來了，只是圖沒畫它。

## Considered Options

**「一個流程」的邊界**

- **純結構推進邊**（照 ADR-0007 收邊後剩下的推進邊拉路線）：零推論、可斷言；但這份資料收完只剩 36 條邊散在 25 個分頁，拉出來的「流程」是 1–3 步的碎片，回答不了「業主的一條主線長什麼樣」。
- **從入口跑 BFS 生成樹當骨幹**：仍是確定性的；但樹的形狀由 f2w-capture 的走訪順序與漏邊決定，深頁接淺頁的假相鄰照樣出現，而且它把「哪條路重要」交給拓撲——拓撲不知道業務權重。
- **連節點也砍**（每個模組只留首頁，畫 5–8 個大方框）：一定乾淨，但退化成模組清單，沒有流程。
- **由 AI 讀 `overview` 與每頁 `purpose` 判斷業務主線（採用）**：這正是 ADR-0007 當時明文拒絕的選項（理由是「引進新的推論維度，違反本步零推論」）。現在反過來採用，因為實測顯示零推論的天花板就是網站地圖，而收圖的是業主。推論素材不是憑空猜：`overview` 已自報五條主線，逐頁 `purpose` 是主線歸屬與步驟措辭的判斷依據。代價：本步不再零推論，`workflow.json` 到圖之間多了一層要人覆核的推論。

**推論住哪一層**

- **推回 `f2w-describe`，在 Page 或 action 上加 `kind` 欄位**：那裡本來就是推論步（ADR-0007 的 Consequences 也把這條列為「合法但屬另一個決策」）。但主線分組是**圖的版面決策**，寫進 `workflow.json` 會讓不畫圖的下游（`f2w-export`、`f2w-breakdown`）也被迫扛一組與它們無關的欄位。
- **在 `buildDiagram` 裡叫 LLM**：省一個檔；但 `src/` 就再也不是純函式、不可斷言、重跑不幂等，ADR-0005 保留下來的確定性底線會當場破掉。
- **f2w-diagram 自己的推論交接檔 `mainflow.json`（採用）**：沿用 ADR-0004 `f2w-sourcing` 的前例——推論步吃外部事實、產出一份新契約檔，`src/` 只負責讀檔、驗證、排版。`src/contracts/mainflow.ts` 以 zod 定義 `mainflowSchema`（`project`／`flows`／`excludedPages`），`buildDiagram(workflow, mainflow)` 是兩參數純函式。這個檔**可手改**，而且**已存在就沿用、不重推論**（要重推得先刪檔或明講「重推主線」）——給業主看的圖需要人調字，重跑不該把人的修改沖掉。

**要不要總覽頁**

- **第 1 頁放五條主線的總覽**：符合 ADR-0007 的多分頁慣例，也讓人一眼看到全站骨架。但總覽頁在 ADR-0007 就是最難排的一頁（8 條全域導覽邊擠成一條垂直走廊），而主線之間**本來就沒有先後關係**，總覽只會退化成五個色塊並排，等於把目錄畫成圖。
- **不要總覽頁（採用）**：第 1 個 `<diagram>` 就是第一條主線。分頁名＝主線名，draw.io 的頁籤本身就是目錄。

**主線頁內的骨架**

- **麵包屑樹（ADR-0007 的作法）**：階層路徑失效的專案長不出樹——這就是起因本身。
- **主鏈橫排 ＋ 短枝下掛**：彈窗與明細頁不丟資訊，但一步掛兩三根枝就回到局部毛球，而業主並不需要知道「按編輯會開彈窗」。
- **只留主幹、單列橫排不折行（採用）**：一條主線一張大分頁，頁內 2–7 步（`STEPS_MIN`／`STEPS_MAX` 寫進契約），彈窗與明細頁不畫。節點沿用 ADR-0007 的兩段式：粗體「編號. 業務動作名」負責掃視、小字說明負責理解，框 240×100；上方加 24px 粗體主線名與同色系細橫線（`DiagramNodeKind` 就是 `flowTitle`／`rule`／`step` 三種）。步驟編號是為了讓業主能用「第 3 步」指稱。

**一步對一頁，還是一步可收多頁**

- **一步一頁**：從圖回溯到 Page 最直接；但 41 頁分給 5 條主線平均超過 8 步，過不了 7 步上限，而服務維護那 5 個 tab 在業務上本來就是一件事。
- **一步可收攏多個 Page（採用）**：`steps[].pages` 是陣列（`min(1)`）；例如服務維護的 5 個 tab 收成「維運模型服務」一步。收攏的頁**不上圖面**、只進 tooltip，抬頭是 `COVERED_TOOLTIP_HEADER`（`此步驟涵蓋的頁面：`）——沿用 ADR-0006「圖上收掉的資訊降 tooltip」那一條。

**邊 label 的來源**

- **不給 label**：最保守，但「為什麼從這一步走到下一步」正是業主最想看的一格。
- **逐字引用 action 的 `label`**：完全可回溯，但那是介面措辭（「往下」「已修改」），業主讀不出業務意義——這與分頁名爛掉是同一個病。
- **AI 寫業務轉場動作 ＋ 真實邊硬驗（採用）**：`edgeLabel` ≤ 8 字（`EDGE_LABEL_MAX`）、掛在**來源步**、最後一步不得有（`EDGE_LABEL_RULE_MESSAGE`）。措辭自由，結構不自由。字數上限（`STEP_TITLE_MAX` 12／`STEP_NOTE_MAX` 30／`EDGE_LABEL_MAX` 8）寫進 zod 而不是寫在提示詞裡——靠自律的上限等於沒有上限。

**相鄰兩步在 `workflow.json` 裡接不上時**

- **畫成虛線，表示「這一跳是推論的」**：圖不會斷，但業主看不出虛線代表什麼，而我們也放棄了追查機會。
- **丟 `DiagramConsistencyError`，要求重排或重新分步（採用）**：`requireRealEdges` 檢查相鄰兩步之間是否存在至少一條真實的 `destination` 邊（來源步任一頁 → 目標步任一頁），訊息點名是哪條主線的第幾步到第幾步，收尾是「請調整步驟順序或重新分步」。理由：接不上通常表示分步錯了，或上游漏了一條 `destination`，兩者都該修，不該用虛線蓋過去。

**上色**

- **統一色**：最中性，五張分頁看起來像同一份文件；但業主在頁籤之間切換時，失去「我現在在哪條主線」的即時線索。
- **五條主線各自不同色系（採用）**：`renderDiagram.ts` 的 `FLOW_PALETTE` 依 `flows` 順序取 6 組 draw.io 標準的淡底／深框配色（超過就 `colorIndex % FLOW_PALETTE.length` 循環），主線標題字色與細橫線跟著同一組的 `stroke`。色表寫死在序列化層、不進契約，所以顏色仍是確定性的，不必手挑。

## Consequences

- **零推論這條底線消失後，用四件事補**：(1) `mainflow.json` 是**交接檔、可手改**，且已存在就沿用——AI 推錯就改檔重跑，不用改程式；(2) 兩道硬驗撐住結構——`requireExactCoverage`（`steps[].pages` ∪ `excludedPages` 必須剛好等於 `workflow.json` 的頁集合，每頁只出現一次，重複由契約的 `UNIQUE_COVERAGE_MESSAGE` 擋）與 `requireRealEdges`（每條邊都要有真實去向墊背）；(3) 落選頁必須連一句 `reason` 一起列進 `excludedPages`，由 `excludedPagesWarning` 原文轉述給使用者（不是業主）；(4) **圖上刻意不標「推論·待確認」、不標 ⚠**。第 4 點是選擇、不是遺漏：這張圖給業主看，標記只會製造「這份東西還沒做完」的疑慮，待確認的責任移到 `mainflow.json` 與對話回報。這與 ADR-0002 的推論工項、ADR-0004 的配對待確認是不同維度——那兩處的標記照舊。
- **步數下限訂 2，不是 3**：第一版訂 3，實跑 0729 立刻打臉——`overview` 自報的第一條主線「模型供給」只有 2 頁（`模型倉庫` ＋ `模型倉庫｜上傳模型`），3 步下限逼它併進「算力供給與部署」，圖上剩 4 條主線、與上游敘述的 5 條對不起來。下限改 2（至少要有一個轉場才算流程），主線數就回到與 `overview` 一致。1 步仍擋下：沒有轉場的單框不是流程。
- **確定性仍成立，但範圍要講清楚**：同一份 `workflow.json` ＋ `mainflow.json` 兩次序列化仍逐字元相同（仍不寫 `modified`／`etag`／`agent`／`version`），`buildDiagram` 仍是純函式、座標仍可斷言。但 ADR-0005 的「本步零 AI 推論，圖上每個節點與每條邊都能逐一回溯到 `workflow.json` 的某個欄位」**不再為真**：節點的 `title`／`note` 與邊的 `edgeLabel` 是 AI 寫的字，可回溯的只有「這一步涵蓋哪些頁」與「這條邊有真實去向」。
- **落選頁在圖上完全不提**：不畫、不列、不標記。代價是只看圖的人不會知道有頁被砍掉；接受的前提與 ADR-0006 同一條——`workflow.xlsx` 仍是操作清單的權威來源，`mainflow.json` 的 `excludedPages` 是砍頁紀錄。
- **交付物改名，舊檔變孤兒**：`CONTRACT_FILES.diagram` 由 `workflow.drawio` 改成 `mainflow.drawio`；契約鍵 `diagram` 不動，沿用 ADR-0006「鍵名不綁工具名」的慣例。既有專案 `output/` 底下的舊 `workflow.drawio` 不會被覆寫、也不會被刪，就此成為孤兒檔，要不要清由使用者決定。
- **退場的圖元與程式**：總覽頁的 Section 方框、Global nav marker（全域導覽記號）、Tab group（tab 群組框）、Implied node（隱含節點）、Entry marker（入口記號）、孤立頁的警示前綴全部拿掉；`src/diagram/sections.ts` 與其測試、麵包屑樹 layout、BFS 分層網格 fallback 與「已退回分層網格」warning、孤立頁 warning 一併刪除。`buildDiagram` 只畫一種圖、沒有 fallback——排不出來就是 `mainflow.json` 要改。
- **driver 只能 skip，不能推論**：`f2w-run/run-diagram*.test.ts` 是 vitest、叫不動 LLM，所以它讀既有的 `output/<project>/mainflow.json`，**缺檔就出聲 skip**（不誤紅，也不自己編一份主線）。`loadMainflowForDiagram` 缺檔丟 `MissingPrerequisiteError`，提示的前一步是「f2w-diagram 的主線推論」。draw.io CLI 匯出仍要 `--all-pages`，否則只驗到第一條主線。
- **「工具吃得下不代表人看得懂」再應驗一次**：ADR-0007 的 layout 每一條都過了單元測試——Section 切得出來、座標可斷言、XML 自洽——匯出來卻是 25 個 1–3 節點的分頁配上「往下」這種頁籤。這條沿襲下來的教訓加一句操作規則：**改過 layout 就要真的匯出看一眼**，不要只讀測試綠燈。
