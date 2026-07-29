---
name: f2w-diagram
description: frontend-to-workflow 管線中與 f2w-export 並列的分支步。讀取 workflow.json，把每個 Page 映成一個節點、每個換頁操作映成一條帶說明的有向邊（一頁多出口就直接拉多條邊、不插分歧節點），確定性算出座標後寫成 Navigation diagram workflow.drawio，可用 draw.io 開啟。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-diagram, produce a draw.io diagram of a project's page navigation, or generate workflow.drawio for the frontend-to-workflow pipeline.
---

# f2w-diagram：導覽流程圖（Navigation diagram）

與 `f2w-export` **並列的分支步**（不是插入步、不佔步驟編號）：兩者都只讀 `f2w-describe` 產出的 `output/<project>/workflow.json`、互不依賴、可各自單獨重跑。本步把 Workflow description 裡的頁面與「操作去向」確定性地轉成一張 **Navigation diagram**——draw.io 檔 `output/<project>/workflow.drawio`（明文 mxGraphModel、含座標），draw.io 開起來即有版面。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。
產出：`output/<project>/workflow.drawio`。
**零推論**：本步全部由 `workflow.json` 確定性生成，不引入任何新的「待確認」維度（對比 ADR-0002 的推論工項、ADR-0004 的配對待確認）。畫錯就是上游描述錯。

## 這張圖畫的是導覽，不是業務流程

節點是 **Page**、邊是**換頁操作**。它**不含**業務決策條件、角色泳道、訊息事件——那些資訊 `workflow.json` 裡沒有，要憑空生只能靠 AI 推論。決策與理由見 `docs/adr/0005-navigation-diagram-as-bpmn.md`（導覽圖主體）與 `docs/adr/0006-navigation-diagram-as-drawio.md`（改出 draw.io、砍分歧與終點節點）。

## 語意映射

| workflow.json | draw.io |
|---|---|
| 每個 `pages[n]` | 一個 vertex：`id` 由正規化 route(+tab) 衍生（`Page_<slug>`，撞名補 `_2`）、`value` 為 `purpose` |
| `actions[].destination` 非 null | 一條 edge，`value` 為 `action.label`；一頁多出口就多條邊，**不插分歧節點** |
| `actions[].destination` 為 null | 寫進該節點的 `tooltip`（`UserObject` 的屬性，「不換頁的操作：…」），不生節點、不生邊 |
| `pages[0]` | 接**入口記號**（小綠圓，`Entry_1`）——入口頁就是 f2w-capture 從 base URL 進場的第一頁 |
| 無換頁出口的 Page（葉頁） | 就是沒有出邊；**不補終點節點** |

## 流程

1. **讀取前置** — `loadWorkflowForDiagram(outputRoot, project)`
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **組裝＋排版** — `buildDiagram(workflow)`
   - 依上表映射出節點與邊；操作去向指到 `pages` 內不存在的 Page（手改壞掉）丟 `DiagramConsistencyError`。
   - layout：入口記號為第 0 欄；可達 Page **欄＝從入口 BFS 的層級**、**列＝該層內 `workflow.json` 的原順序**（網格，不是一頁一列的階梯）。邊不算座標，直角繞路交給 draw.io。
3. **序列化** — `renderDiagram(diagram)`
   - 吐明文 mxGraphModel XML（`mxfile` ＋ `diagram` ＋ `mxGraphModel`），刻意不寫 draw.io 存檔才會補的 `modified`／`etag`／`agent`。同一份 diagram 兩次序列化字串完全相同。
4. **保存** — `saveDiagram(outputRoot, project, xml)`
   - 寫 `output/<project>/workflow.drawio`，**直接覆寫**。
5. **回報提醒** — 把 `diagram.warnings` 原文轉述給使用者（見下）。
6. **開檔驗證** — XML 自洽不等於工具吃得下，所以要真的開一次。driver（`f2w-run/run-diagram.test.ts`）跑完 save 後會用 draw.io CLI 匯出 PNG 當驗證；找不到執行檔時會出聲 skip，設 `DRAWIO_EXE` 指向它即可。手動驗：

   ```bash
   "$LOCALAPPDATA/Programs/draw.io/draw.io.exe" --export --format png --scale 1 --border 20 -o nav.png "output/<project>/workflow.drawio"
   ```

## 兩種一定要回報的情形

- **純循環（無終點）**：每個 Page 都有換頁出口時全圖沒有任何葉頁。照實不畫終點，並明說「此圖無終點，導覽為循環」。純前端專案每頁都有回首頁連結時很常見，不是錯。
- **孤立頁**：從入口 BFS 走不到、又不是 `pages[0]` 的 Page。仍畫出節點（在主圖下方**另一區**堆疊、不分層、**不接入口記號**），並提醒回頭補 `workflow.json` 裡指向它的操作去向——這通常是 f2w-capture 的已知盲點（hash routing、非 `<a>` 導覽）造成的漏邊。

## 逃生口

`workflow.drawio` 是**交付物、不是交接檔**（同 `workflow.xlsx` 語意）：圖不對就回頭改 `workflow.json` 的 `purpose`／`actions`／`destination` 再重跑本步。可以在 draw.io 裡圖形化調版面，但**重跑會直接覆寫**——要保留手調的排版請自己另存一份副本（draw.io 存檔後也會補上時間戳屬性、可能改成壓縮格式，與本步產出的明文檔不再逐字元可比）。

## 對應實作

`src/diagram/`：`loadWorkflowForDiagram`（前置檢查＋讀回 workflow.json）、`buildDiagram`（語意映射＋BFS 分層網格 layout 的確定性核心）、`renderDiagram`（mxGraph XML 序列化）、`saveDiagram`（覆寫保存）。契約見 `src/contracts/workflow.ts`；路徑見 `src/output.ts`（`contractPath(..., "diagram")`）。詞彙見 `CONTEXT.md`。
