# output/ — 管線產出放這裡

所有跨步驟狀態與交付物一律落在 `output/<project>/`（`<project>` = `workspace/frontend/` 底下那個子資料夾名）。這裡的內容**不被 git 追蹤**（只有本 README 追蹤）。

## 目錄長相

```
output/
  my-admin-ui/
    manifest.yml                # f2w-start            啟動描述檔
    pages.json                  # f2w-capture          Page 清單
    screenshots/                # f2w-capture          逐 Page 截圖
    workflow.json               # f2w-describe         逐頁 Workflow description ＋ Overview
    workflow-20260803-153012.xlsx  # f2w-export        交付物：工作流程 Workbook（檔名帶時戳）
    mainflow.json               # f2w-diagram（分支）   Main flow（主線）推論交接檔
    mainflow.drawio             # f2w-diagram（分支）   交付物：Main flow diagram（draw.io）
    workitems.json              # f2w-breakdown        前端／後端 Work item（後端可帶 Party chain）
    workitems-20260803-153012.xlsx # f2w-breakdown-export 交付物：工項範本（畫押欄留白、檔名帶時戳）
```

兩支 `.xlsx` 交付物的檔名都帶**寫檔當下的本地年月日時分秒**（`YYYYMMDD-HHmmss`）：每跑一次各留一份、不覆蓋舊檔，最新的一份就是時戳最大的（檔名可直接字典序排序）。其餘檔名固定，重跑直接覆寫。

## 哪一步讀哪一個

| 步 | skill | 讀 | 產出 |
|----|-------|----|------|
| 1 | `f2w-start` | 無 | `manifest.yml` |
| 2 | `f2w-capture` | `manifest.yml` | `pages.json`、`screenshots/` |
| 3 | `f2w-describe` | `pages.json`、`screenshots/` | `workflow.json` |
| 4 | `f2w-export` | `workflow.json`、`pages.json`、`screenshots/` | `workflow-<YYYYMMDD-HHmmss>.xlsx` |
| 分支（與步 4 併行） | `f2w-diagram` | `workflow.json` | `mainflow.json`、`mainflow.drawio` |
| 5 | `f2w-breakdown` | `workflow.json`；有派工時另掃 `workspace/spec/<project>/` | `workitems.json` |
| 6 | `f2w-breakdown-export` | `workitems.json` | `workitems-<YYYYMMDD-HHmmss>.xlsx` |

缺前置檔時該步會中止，並提示先跑產出那一檔的步驟。

## 可以手改的 / 不要手改的

- **宣告式逃生口，可手改**：`manifest.yml`、`pages.json`、`workflow.json`、`mainflow.json`、`workitems.json`。自動偵測／描述／主線推論／拆項與派工不完美時直接改檔再重跑後續步驟（**派錯方直接改 `workitems.json` 的 `partyChain`，零重跑**），重跑會尊重手改值（`mainflow.json` 已存在時 `f2w-diagram` 不重推論，直接照手改後的版本畫）。
- **交付物**：`workflow-<時戳>.xlsx` 不預期手改，內容不對回頭改上游 json 再重跑 `f2w-export`（重跑出新一份時戳檔，舊檔留著）。`mainflow.drawio` 沒有時戳、**重跑直接覆寫**（內容不對改 `mainflow.json` 再重跑）：可在 draw.io 圖形化調版面，但要保留手調排版請自行另存副本。
- **`workitems-<時戳>.xlsx` 是範本**：要填 RACI／估時／優先級／簽核／狀態，請**另存一份工作副本**再填。重跑出的是新一份時戳範本、不覆蓋舊的，換範本時畫押值須人工搬。帶 Party chain 時後端 sheet **一個 leg 一列**，列標籤是 `<工項id>#<leg序>`。

詞彙定義見 [CONTEXT.md](../CONTEXT.md)。
