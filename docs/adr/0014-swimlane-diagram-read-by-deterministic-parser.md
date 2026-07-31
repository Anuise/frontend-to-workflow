# 權責泳道圖改由確定性解析器讀出泳道、方層拓樸與宣告鏈

`workspace/spec/<project>/*.drawio` 改由純函式 `parseSwimlaneDiagram` 讀取，與 `parseVendorSpec` 對稱：抽出泳道名（分工方集合）、把節點解析到所屬方、由邊算出方層跳躍圖、並讀出圖上人寫的**宣告鏈**。節點歸屬先走 `parent` 鏈，掛在 root 的節點再以矩形包含補判。

原本這些事實由 AI 讀圖口述後傳進 `buildSourcedWorkitems`（ADR-0007 的採用方案），而實測結果是：一支驅動的註解宣稱圖上有 `m_back1 → l_apiserver` 這條邊，圖上根本沒有（唯一到 `l_apiserver` 的邊是 `g_apisix → l_apiserver`），於是 24 筆工項的方序列少了中間那一跳，而管線裡沒有任何一處攔得下來。泳道名是字串陣列、宣告鏈沒有 reader，AI 說什麼就是什麼。

宣告鏈與邊圖**兩者都讀，互為交叉檢查**。邊圖是結構事實但**不封閉**：`n_ext → g_apisix`（外部 AP 直打 gary）讓「呼叫鏈只有三種」這件事推導不出來，所以封閉性只能來自人寫的宣告。宣告文字封閉但會過期，所以宣告鏈是權威、進硬底線，而宣告鏈裡某個相鄰跳躍在邊圖上找不到支持時**發 warning 不中止**。

## Considered Options

- **維持 AI 讀圖口述（否決）**：ADR-0007 的原方案。實測已產出一次「圖上沒有的邊」被當成事實使用、24 筆工項因此缺一整個分工方，而 `sourcingConfirmed: false` 的人核兜底沒有攔到——人核看的是逐筆歸屬，看不出整批少了一跳。
- **只解析邊、不讀宣告文字（否決）**：`n_ext → g_apisix` 讓邊圖不封閉，推不出「只有三種鏈」。封閉性是硬底線的前提，光有邊無法成立。
- **只讀宣告文字、不解析邊（否決）**：宣告是人手寫的，會與圖上結構分岔而沒有任何跡象。交叉檢查的 warning 是唯一能讓「宣告過期」浮出水面的機制。
- **確定性解析器讀泳道＋邊＋宣告鏈，配對仍交 AI（採用）**：解析器**不宣稱能配對**——「哪一格對應哪個工項」仍全程是 AI 推論。ADR-0007 否決解析器的論據是「解析器只能保真格在哪條泳道，保不了這格對應這個工項」，本 ADR 完全同意並只做前者，所以是補充不是推翻。

## 幾何包含是補判，不是必要條件

邊 `e9`（`g_dlp` 在 `lane_g` → `g_agent` 在 `lane_l`）純靠 `parent` 鏈就給得出 `gary → leadtek` 這條方層跳躍。幾何包含只用來救掛在 root 的節點（實檔的 `l_apiserver` 與 `m_front1` 都是 `parent="1"`），不是解析的主要依據。

節點級歧義存在且**不影響方級鏈**：`g_agent` 有三個矛盾訊號（value 自述「gary 建置」、填色是 gary 的藍、`parent=lane_l`）。窮舉兩種歸屬假設，節點路徑數會從 3 條變 1 條，但方序列都收斂成 `mobagel > gary > leadtek`。歧義節點列進 `warnings` 給人看，不中止——與 ADR-0007:13「泳道名由 AI 抽出、在執行紀錄中列給人看」的既有慣例一致。

## Consequences

- 分工方集合改成**純由泳道名決定**（無圖時退為 spec 目錄名）。現行 `partySet = 泳道名 ∪ spec 檔名` 讓沒被任何工項引用的 `IDP-service.json` 成為合法 `assignedParty`，這個舊行為隨之消失。
- 圖上的純標籤 cell（`style` 以 `text;` 開頭）、圖例色塊（幾何落在最下方泳道底緣之外）與 `.$*`／`*.bkp` 自動備份都要排除。備份本身是合法 mxfile、`diagram` 的 name 與 id 與正本相同，內容指紋分不出來，**只能靠檔名排除**。
- ADR-0007 的兩個待確認維度（`inferred`／`sourcingConfirmed`）不動，配對正確性仍讓渡給人核。
- 實檔 `workspace/spec/new_0724_.../桃園刑大ai_platform.drawio` 成為解析器的 fixture：三個泳道逐字 mobagel／gary／leadtek，`l_apiserver` 由幾何補判落在 leadtek，`n_ext` 落在「非任一方」，宣告鏈切出 `[mobagel]`／`[mobagel, gary]`／`[mobagel, gary, leadtek]`（`frontend` 這種非泳道名的 token 丟掉）。
