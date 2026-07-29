---
name: f2w-bpmn
description: frontend-to-workflow 管線中與 f2w-export 並列的分支步。讀取 workflow.json，把每個 Page 映成 BPMN userTask、每個換頁操作映成 sequence flow（一頁多出口時插 exclusiveGateway），確定性算出 DI 座標後寫成 Navigation diagram workflow.bpmn，可用 bpmn.io／Camunda Modeler／draw.io 開啟。缺前置檔時提示先跑 f2w-describe。Use when the user wants to run f2w-bpmn, produce a BPMN diagram of a project's page navigation, or generate workflow.bpmn for the frontend-to-workflow pipeline.
---

# f2w-bpmn：導覽流程圖（Navigation diagram）

與 `f2w-export` **並列的分支步**（不是插入步、不佔步驟編號）：兩者都只讀 `f2w-describe` 產出的 `output/<project>/workflow.json`、互不依賴、可各自單獨重跑。本步把 Workflow description 裡的頁面與「操作去向」確定性地轉成一張 **Navigation diagram**——BPMN 2.0 檔 `output/<project>/workflow.bpmn`，含 DI 座標，Modeler 開起來即有版面。

前置：`output/<project>/workflow.json`（由 f2w-describe 產出）。缺件即中止並提示先跑 f2w-describe。
產出：`output/<project>/workflow.bpmn`。
**零推論**：本步全部由 `workflow.json` 確定性生成，不引入任何新的「待確認」維度（對比 ADR-0002 的推論工項、ADR-0004 的配對待確認）。畫錯就是上游描述錯。

## 這張圖畫的是導覽，不是業務流程

節點是 **Page**、邊是**換頁操作**。它**不含**業務決策條件、角色泳道、訊息事件——那些資訊 `workflow.json` 裡沒有，要憑空生只能靠 AI 推論。決策與理由見 `docs/adr/0005-navigation-diagram-as-bpmn.md`。

## 語意映射

| workflow.json | BPMN |
|---|---|
| 每個 `pages[n]` | `userTask`：`id` 由正規化 route(+tab) 衍生（`Page_<slug>`，撞名補 `_2`）、`name` 為 `purpose` |
| `actions[].destination` 非 null | `sequenceFlow`，`name` 為 `action.label` |
| 某頁有 **≥2** 條換頁操作 | 該頁 task → `exclusiveGateway`（未命名）→ 每條出口 flow 各帶 `label`；使用者選一條路 |
| 某頁有 **1** 條換頁操作 | task 直接連到目標頁，flow 帶 `label`（不插 gateway） |
| `actions[].destination` 為 null | 寫進該 task 的 `<documentation>`（「不換頁的操作：…」），不生節點、不生邊 |
| `pages[0]` | 接 `startEvent`（入口頁就是 f2w-capture 從 base URL 進場的第一頁） |
| 無換頁出口的 Page | 各接一個自己的 `endEvent` |

## 流程

1. **讀取前置** — `loadWorkflowForBpmn(outputRoot, project)`
   - 缺 `workflow.json` 丟 `MissingPrerequisiteError`，提示先跑 f2w-describe，**中止**。
2. **組裝＋排版** — `buildBpmn(workflow)`
   - 依上表映射出節點與邊；操作去向指到 `pages` 內不存在的 Page（手改壞掉）丟 `BpmnConsistencyError`。
   - layout：`startEvent` 為第 0 欄；可達 Page 依**從入口 BFS 的層級**決定欄、依 `(層級, workflow.json 原順序)` 各占一列；gateway／endEvent 落在該頁右邊一欄。回邊（環）拉直線、不繞線。
3. **序列化** — `renderBpmn(diagram)`
   - 吐 BPMN 2.0 XML（`bpmn:process` ＋ `bpmndi:BPMNDiagram`）。同一份 diagram 兩次序列化字串完全相同。
4. **保存** — `saveBpmn(outputRoot, project, xml)`
   - 寫 `output/<project>/workflow.bpmn`，**直接覆寫**。
5. **回報提醒** — 把 `diagram.warnings` 原文轉述給使用者（見下）。

## 兩種一定要回報的情形

- **純循環（無終點）**：每個 Page 都有換頁出口時畫不出 `endEvent`。照實不畫，並明說「此圖無終點，導覽為循環」。純前端專案每頁都有回首頁連結時很常見，不是錯。
- **孤立頁**：從入口 BFS 走不到、又不是 `pages[0]` 的 Page。仍畫出 task（在主圖下方**另一區**堆疊、不分層、**不接 startEvent**），並提醒回頭補 `workflow.json` 裡指向它的操作去向——這通常是 f2w-capture 的已知盲點（hash routing、非 `<a>` 導覽）造成的漏邊。

## 逃生口

`workflow.bpmn` 是**交付物、不是交接檔**（同 `workflow.xlsx` 語意）：圖不對就回頭改 `workflow.json` 的 `purpose`／`actions`／`destination` 再重跑本步。可以在 bpmn.io／Camunda Modeler／draw.io 裡圖形化調版面，但**重跑會直接覆寫**——要保留手調的排版請自己另存一份副本。

## 對應實作

`src/bpmn/`：`loadWorkflowForBpmn`（前置檢查＋讀回 workflow.json）、`buildBpmn`（語意映射＋BFS 分層 layout 的確定性核心）、`renderBpmn`（XML 序列化）、`saveBpmn`（覆寫保存）。契約見 `src/contracts/workflow.ts`；路徑見 `src/output.ts`（`contractPath(..., "bpmn")`）。詞彙見 `CONTEXT.md`。
