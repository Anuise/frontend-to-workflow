# Revision 落在 workspace/ 而非 output/

人工修訂（**Revision**）落在 `workspace/revisions/<project>/revisions.json`。這是管線唯一一個「由管線寫出、卻不放 `output/`」的檔案，未來的人一定會問，所以記在這裡。

分界原則是**依內容的作者分**，不是依誰寫出檔案：

- `workspace/` 放**人的意圖**——權責泳道圖、Vendor spec、Revision。
- `output/` 放**管線寫出來的內容**——`manifest.yml`、`pages.json`、`workflow.json`、`workitems.json`、交付物。

這條原則也回答了「那 `mainflow.json` 為什麼在 `output/`」：它可以手改、甚至常常被手改，但它的**內容作者是 AI**（主線推論），人只是校正。Revision 相反——每一筆的作者都是人，AI 只是把人的話轉寫成結構。

## Considered Options

- **放 `output/<project>/revisions.json`（否決）**：位置最直覺，但 `output/` 的語意會從「管線產出」鬆掉成「管線相關的任何東西」，而 `output/<project>/` 的檔案在概念上都可以被重跑覆寫——修訂檔剛好是那個**絕不可被重跑覆寫**的檔案，放在一堆可覆寫的東西中間是誤導。
- **納入 `CONTRACT_FILES`（否決）**：那組常數與 `contractPath`／`requireContract`／`CONTRACT_PRODUCER` 綁在一起，三者都假設檔案在 `output/<project>/` 底下，且 `CONTRACT_PRODUCER` 的語意是「缺這個檔請先跑哪一步」——修訂檔缺席是正常狀態（修訂是可選的），不該有「請先跑」的提示。因此另開一組路徑 helper（`revisionsPath(workspaceRoot, project)`），吃 workspace 根目錄與 project 名。
- **放 `workspace/spec/`（與泳道圖同一層，否決）**：泳道圖是**平台級共用文件、可跨 project**，修訂是**逐 project** 的。混在一起會讓「這份檔案適用於哪個 project」變成要看檔名猜。

## Consequences

- `workspace/` 未被 git 追蹤，修訂因此不進版控——但 `output/` 同樣未被追蹤，所以這不是新增的風險，是這條管線一貫的狀態。
- 讀寫修訂檔的函式（`revisionsPath`／`loadProjectRevisions`／`appendRevisions`）住在 `src/revise/inputs.ts`，與 `src/output.ts` 的路徑 helper 完全分開，兩邊不共用常數。
- 上游要吃修訂就必須同時知道 workspace 根與 output 根。這是本決定的代價：兩支上游 skill 的驅動各多一個路徑。
