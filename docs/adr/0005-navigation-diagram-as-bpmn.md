# f2w-bpmn 出的是導覽流程圖，用 BPMN 2.0 XML，多出口插 exclusiveGateway

新增與 `f2w-export` **並列的分支步** `f2w-bpmn`：讀同一份 `workflow.json`，產出 **Navigation diagram** `workflow.bpmn`。三個綁在一起的決策：圖的**主體是導覽**（不是業務流程）、格式是 **BPMN 2.0 XML**（不是 mermaid）、一頁多出口時**插 exclusiveGateway**（不是隱式分歧）。

## Considered Options

**圖的主體**

- **業務流程圖（含決策條件、角色泳道、訊息事件）**：交給做流程的人最有用；但 `workflow.json` 沒有這些資訊，只能由 AI 從畫面與描述推論，等於再開一個「推論·待確認」維度（第三個，見 ADR-0002／0004）。
- **工項執行流程圖（吃 `workitems.json`，節點為 Work item）**：對排程有用，但那是給開發看的依賴圖，與本管線「使用者視角」的交付主軸錯位。
- **導覽流程圖（採用）**：`workflow.json` 的 `pages[]` ＋ `actions[].destination` 本來就是一張完整的有向圖，**零推論、可確定性生成、可單元測試**。代價：它不回答「為什麼要走這條路」。

**格式**

- **Mermaid flowchart**：純文字、免算座標、手改極簡；但它不是 BPMN，交給要 BPMN 的對象會被退件。
- **只出 semantic BPMN、不含 DI**：省掉 layout；但 bpmn.io 不會自動排版，開起來一片空白，把排版責任推給使用者。
- **BPMN 2.0 XML ＋ DI 座標（採用）**：名符其實，且能在 bpmn.io／Camunda Modeler／draw.io 開啟與圖形化調整。代價：得自己寫 XML 組裝與一套確定性 layout（無現成庫，`exceljs`／`yaml`／`zod` 之外不加依賴）。

**多出口**

- **一個 task 直接拉多條帶 label 的 flow**：節點最少；但 BPMN 視為隱式分歧，部分工具校驗會警告，且看圖的人看不出「這是使用者選一條」。
- **插 exclusiveGateway（採用）**：分歧走 gateway 是 BPMN 規範作法，語意明確、工具不抱怨、日後要掛條件有現成掛點。代價：節點數約多一倍。

## Consequences

- **第三個「待確認」維度沒被打開**：本步零 AI 推論，圖上每個節點與每條邊都能逐一回溯到 `workflow.json` 的某個欄位。圖錯＝上游描述錯，修法是改 `workflow.json` 再重跑，不是修圖。
- **確定性可被斷言**：`buildBpmn` 是純函式、`renderBpmn` 對同一份 diagram 產出完全相同的字串。因此可測的不只是有幾個節點，還包括 gateway 只在 ≥2 出口時出現、葉頁 endEvent 數、BFS 分層後的欄位順序。
- **分支而非插入步**：`f2w-bpmn` 不餵任何下游（對比 ADR-0004 的 `f2w-sourcing` 會餵 breakdown-export），所以在步驟表上標「分支」、不佔編號；既有六步流程完全不受影響，不跑本步也不會壞。
- **兩種誠實的退讓**：導覽圖天生有環，全圖每頁都有出口時就是**沒有終點**——不硬造 endEvent，改為照實不畫並明說；從入口走不到的**孤立頁**也不硬給它一個 startEvent（那是把「資料缺一條邊」偽裝成「這是另一個入口」），而是另列一區並提醒回頭補 `destination`。兩者都指回 f2w-capture 的已知盲點（hash routing、非 `<a>` 導覽）。
- **交付物語意、不做範本／工作副本**：`workflow.bpmn` 重跑直接覆寫，與 `workflow.xlsx` 一致。刻意不把 `workitems.xlsx` 的「範本／工作副本」詞彙延伸過來——那組詞專指**畫押欄留白**，拿來講排版會稀釋它。代價：在 Modeler 手調的版面重跑會消失，需自行另存副本。
