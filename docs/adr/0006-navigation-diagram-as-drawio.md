# Navigation diagram 改出 draw.io mxGraph，砍掉分歧節點與終點節點

`f2w-bpmn` 更名為 `f2w-diagram`，產物由 `workflow.bpmn`（BPMN 2.0 ＋ DI）換成 `workflow.drawio`（明文 mxGraphModel）。ADR-0005 的三個決策中，**圖的主體是導覽、零推論、確定性生成**完整保留；**格式**與**多出口插 `exclusiveGateway`** 兩項由本 ADR 取代。起因是實測：BPMN 2.0 檔在 draw.io 桌面版根本開不起來（不吃 `.bpmn`），在 bpmn.io 又跳一整排 `no bpmnElement referenced in <bpmndi:BPMNEdge/>` 匯入警告——ADR-0005 宣稱的兩個檢視工具都不順，而收圖的對象只用 draw.io，沒有要交 BPMN 給流程／Camunda 那邊。

## Considered Options

**格式**

- **維持 BPMN 2.0、另出一份 `.drawio`**：兩個檢視對象都照顧到；但要養兩套序列化與兩套測試，而 BPMN 那份沒有讀者。
- **維持 BPMN，`.drawio` 只當本地檢視轉檔、不進 `output/`**：交付物不動；但「交付物打不開、要先轉檔才看得到」本身就是缺陷。
- **只出 `.drawio`（採用）**：導覽圖只用到 BPMN 最貧乏的三種元素（task／gateway／event），換成 mxGraph 幾乎不損失語意，而 draw.io 是實際使用的工具。代價：交給要 BPMN 的對象會被退件——接受，因為目前沒有這種對象（若日後出現，回頭加一個並行的序列化器，而不是換回去）。

**多出口與終點**

- **保留 `exclusiveGateway` 與 `endEvent`**：維持與 BPMN 版一致的視覺語意。但 gateway 當初的主要理由是「部分 BPMN 工具校驗會警告」，draw.io 不做這種校驗；而「使用者選一條路」在導覽圖裡就是「一頁有多個連結」的常識。
- **砍掉兩者（採用）**：一頁多出口直接拉多條帶 label 的邊、葉頁就是沒有出邊。節點數由 73 降到 42（41 頁＋1 入口記號），每條路徑少一跳。代價：日後要在分歧上掛條件就沒有現成掛點——但條件資訊 `workflow.json` 裡沒有，預留掛點等於為推論維度開後門，與本步「零推論」相衝。
- **連入口記號也砍**：零合成節點；但「使用者從哪一頁進場」在圖上就真的看不出來了，所以保留這 1 個節點。

**layout**

- **一頁一列（BPMN 版的作法）**：41 頁 → 41 列，匯出 5724px 高的對角階梯，看不完。
- **交給 draw.io 的 Arrange › Layout 自動排**：省掉 layout 程式碼，但每次開檔版面都不同、無法斷言，會破掉 ADR-0005 的「確定性可被斷言」。
- **網格：欄＝BFS 層、列＝該層內原順序（採用）**：這份資料的層級分布是 `{0:1, 1:2, 2:7, 3:9, 4:12, 5:7, 6:3}`，7 欄 × 最多 12 列，一個螢幕看得完，且仍可斷言。

## Consequences

- **明文、不壓縮**：`.drawio` 的 `<diagram>` 內容不做 deflate+base64，且刻意不寫 draw.io 存檔才會補的 `modified`／`etag`／`agent`——那些帶時間戳，會讓「同一份 diagram 兩次序列化字串完全相同」這條斷言破掉。使用者在 draw.io 裡存過檔後，該檔與本步產出不再逐字元可比，這與「交付物、重跑覆寫」的語意一致。
- **邊的座標不再由我們算**：只宣告 source／target 與 `edgeStyle=orthogonalEdgeStyle`，繞路交給 draw.io。確定性仍成立（XML 逐字元相同），但「圖上每個座標都是我們算的」這句話不再為真——邊的走法屬於檢視端行為。
- **不換頁的操作降級為 tooltip**：BPMN 版寫在 `<bpmn:documentation>`，現在寫進 `UserObject` 的 `tooltip`（換行用 `<br>`）。滑過節點才看得到、匯出 PNG 會掉這段；接受的前提是 `workflow.xlsx` 仍是操作清單的權威來源。
- **驗證多一層「真的打得開」**：這次的教訓是 XML 自洽（id 唯一、參照零 dangling）不代表工具吃得下。`src/` 的單元測試維持純函式斷言，driver 則在 save 之後用 draw.io CLI 匯出 PNG；找不到執行檔時出聲 skip（`DRAWIO_EXE` 可覆寫路徑），不誤紅也不靜默。
- **repo 裡不再有 BPMN 這個詞**（除本 ADR 與 ADR-0005 作為歷史記錄）：`src/bpmn/` → `src/diagram/`、`buildBpmn`／`renderBpmn`／`saveBpmn` → `buildDiagram`／`renderDiagram`／`saveDiagram`、`BpmnConsistencyError` → `DiagramConsistencyError`、契約鍵 `bpmn` → `diagram`（鍵名對齊詞彙 Navigation diagram，與 `workbook` 同一套慣例，不綁工具名）。
