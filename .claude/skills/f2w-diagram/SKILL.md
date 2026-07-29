---
name: f2w-diagram
description: frontend-to-workflow 管線中與 f2w-export 並列的分支步。讀取 workflow.json，依階層路徑把 Page 切成 Section，產出多分頁的 Navigation diagram workflow.drawio——第 1 頁總覽、之後每個 Section 一頁，內部依麵包屑樹展開。側欄邊收成全域導覽記號、同父 tab 互跳收成 tab 群組框、返回操作降進 tooltip，圖上只留推進邊。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-diagram, produce a draw.io diagram of a project's page navigation, or generate workflow.drawio for the frontend-to-workflow pipeline.
---

# f2w-diagram：導覽流程圖（Navigation diagram）

與 `f2w-export` **並列的分支步**（不是插入步、不佔步驟編號）：兩者都只讀 `f2w-describe` 產出的 `output/<project>/workflow.json`、互不依賴、可各自單獨重跑。本步把頁面與「操作去向」確定性地轉成一份 **Navigation diagram**——draw.io 檔 `output/<project>/workflow.drawio`（明文 mxGraphModel、含座標、多分頁），draw.io 開起來即有版面。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。
產出：`output/<project>/workflow.drawio`。
**零推論**：本步全部由 `workflow.json` 確定性生成，不引入任何新的「待確認」維度（對比 ADR-0002 的推論工項、ADR-0004 的配對待確認）。畫錯就是上游描述錯。

## 這張圖畫的是導覽，不是業務流程

節點是 **Page**、邊是**換頁操作**。它**不含**業務決策條件、角色泳道、訊息事件——那些資訊 `workflow.json` 裡沒有，要憑空生只能靠 AI 推論。決策與理由見 `docs/adr/0005-navigation-diagram-as-bpmn.md`（導覽圖主體）、`0006-navigation-diagram-as-drawio.md`（改出 draw.io、砍分歧與終點節點）與 `0007-navigation-diagram-one-section-per-page.md`（改成多分頁、一個 Section 一條路線）。

## 一個 Section 一條完整的路線

**階層路徑**＝`route` 的 path 段（去掉空段與 `index`）接上 `tab` 以全形直線切開的段。**Section** 由其中第一個**具區辨力**的段決定；這一層只要符合下列任一條就整體往下一層再試：

- 只切出一個桶（大家第一段都一樣）；
- **兩個桶共用子段名**——這一層切的是橫切所有模組的模式前綴（例如 `SSO` 與 `一般登入` 底下都有 `算力申請與審核`）；
- 只有一個桶裝得下 2 頁以上（其餘都是單頁，那個桶就是全部）。

每個 Section 成為 draw.io 的一個分頁。**版面由階層決定、與邊無關**——上游漏掉幾條操作去向時版面不會垮。

## 語意映射

| workflow.json | draw.io |
|---|---|
| 每個 `pages[n]` | 一個 vertex，落在自己 Section 的分頁上：`id` 由正規化 route(+tab) 衍生（`Page_<slug>`，撞名補 `_2`）；兩段式標籤＝**粗體階層路徑末段** ＋ 小字 `purpose` |
| 每個 Section | 總覽頁一個方框（標「Section 名（n 頁）」、掛 draw.io 分頁連結）＋ 一個分頁 |
| `pages[0]` | 總覽頁的**入口記號**（小綠圓，`Entry_1`）接到它所屬的 Section 方框 |
| 跨 Section 且目的地為該 Section **首頁** | 側欄導覽：收成單一**全域導覽記號**（`GlobalNav_1`）發出的一條邊，原 label 不上圖 |
| 跨 Section 且目的地**非**首頁 | 真實轉場：畫在總覽頁的 Section 方框之間，label 原文照印，繞到那一列底下走 |
| 同 Section，父 → 子 或其他 | 推進邊，畫在該 Section 分頁上，label 原文照印、不截斷 |
| 同 Section，兄弟 ↔ 兄弟 | **不畫邊**：改用 **tab 群組**框圈住（標題「可互相切換的 tab」）。該組兄弟之間真的有互跳才生框 |
| 同 Section，子 → 祖先 | **不畫邊**：label 併入來源節點 tooltip 的「返回操作」段 |
| `actions[].destination` 為 null | 寫進該節點 tooltip 的「不換頁的操作」段 |
| 麵包屑有段、無對應 Page | **隱含節點**（`Implied_<slug>`），當子節點的父框 |
| 從入口 BFS 走不到的 Page | 照樣排在自己 Section 的樹裡，標題加 `⚠` 前綴 |

## 流程

1. **讀取前置** — `loadWorkflowForDiagram(outputRoot, project)`
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **組裝＋排版** — `buildDiagram(workflow)`
   - 依上表映射；操作去向指到 `pages` 內不存在的 Page（手改壞掉）丟 `DiagramConsistencyError`。
   - 總覽頁：Section 方框**橫排一列**、入口記號與全域導覽記號放上方，導覽邊才會各自往下扇開。
   - Section 分頁：麵包屑樹，欄＝相對 Section 根的階層深度、列＝深度優先走訪順序（子樹連續佔列）。邊不算座標，直角繞路交給 draw.io。
3. **序列化** — `renderDiagram(diagram)`
   - 吐明文 mxGraphModel XML（`mxfile` ＋ 每個分頁一個 `diagram`），刻意不寫 draw.io 存檔才會補的 `modified`／`etag`／`agent`。同一份 diagram 兩次序列化字串完全相同。
4. **保存** — `saveDiagram(outputRoot, project, xml)`
   - 寫 `output/<project>/workflow.drawio`，**直接覆寫**。
5. **回報提醒** — 把 `diagram.warnings` 原文轉述給使用者（見下）。
6. **開檔驗證** — XML 自洽不等於工具吃得下，所以要真的開一次。driver（`f2w-run/run-diagram.test.ts`）跑完 save 後會用 draw.io CLI 匯出 **全部分頁** 當驗證；找不到執行檔時會出聲 skip，設 `DRAWIO_EXE` 指向它即可。手動驗：

   ```bash
   "$LOCALAPPDATA/Programs/draw.io/draw.io.exe" --export --format png --all-pages --scale 1 --border 20 -o nav.png "output/<project>/workflow.drawio"
   ```

   匯出成功還不夠——**工具吃得下不代表人看得懂**。改過 layout 就實際看一眼匯出的 PNG，確認邊沒有穿過方框、label 沒有被壓住。

## 兩種一定要回報的情形

- **退回分層網格**：某個 Section 內的頁面在該段上不同名（長不出單根麵包屑樹）時，那一個 Section 退回「欄＝從入口 BFS 的層級、列＝該層內原順序」的舊版面並發 warning。逐 Section 判定，不是全域。常見於 `route` 與 `tab` 都是平的專案；若非本意，回頭調整 f2w-capture 的命名。
- **孤立頁**：從入口 BFS 走不到、又不是 `pages[0]` 的 Page。節點照畫在自己 Section 的樹裡、標題帶 `⚠`，並提醒回頭補 `workflow.json` 裡指向它的操作去向——這通常是 f2w-capture 的已知盲點（hash routing、非 `<a>` 導覽）造成的漏邊。

## 逃生口

`workflow.drawio` 是**交付物、不是交接檔**（同 `workflow.xlsx` 語意）：圖不對就回頭改 `workflow.json` 的 `purpose`／`actions`／`destination`／`tab` 再重跑本步。可以在 draw.io 裡圖形化調版面，但**重跑會直接覆寫**——要保留手調的排版請自己另存一份副本（draw.io 存檔後也會補上時間戳屬性、可能改成壓縮格式，與本步產出的明文檔不再逐字元可比）。

圖上被收掉的操作說明（側欄導覽、tab 互跳、返回操作）**完整保留在 `workflow.xlsx`**——它是操作清單的權威來源。

## 對應實作

`src/diagram/`：`loadWorkflowForDiagram`（前置檢查＋讀回 workflow.json）、`sections`（階層路徑與 Section 分組）、`buildDiagram`（語意映射＋邊分類＋麵包屑樹 layout 的確定性核心）、`renderDiagram`（多分頁 mxGraph XML 序列化）、`saveDiagram`（覆寫保存）。契約見 `src/contracts/workflow.ts`；路徑見 `src/output.ts`（`contractPath(..., "diagram")`）。詞彙見 `CONTEXT.md`。
