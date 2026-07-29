# output/ — 管線產出放這裡

所有跨步驟狀態與交付物一律落在 `output/<project>/`（`<project>` = `workspace/` 底下那個子資料夾名）。這裡的內容**不被 git 追蹤**（只有本 README 追蹤）。

## 目錄長相

```
output/
  my-admin-ui/
    manifest.yml                # f2w-start            啟動描述檔
    pages.json                  # f2w-capture          Page 清單
    screenshots/                # f2w-capture          逐 Page 截圖
    workflow.json               # f2w-describe         逐頁 Workflow description ＋ Overview
    workflow.xlsx               # f2w-export           交付物：工作流程 Workbook
    workflow.bpmn               # f2w-bpmn（分支）      交付物：Navigation diagram（BPMN 2.0）
    workitems.json              # f2w-breakdown        前端／後端 Work item
    workitems-sourced.json      # f2w-sourcing（可選）  貼上 Sourcing decision 的完整副本
    workitems.xlsx              # f2w-breakdown-export 交付物：工項範本（畫押欄留白）
```

## 哪一步讀哪一個

| 步 | skill | 讀 | 產出 |
|----|-------|----|------|
| 1 | `f2w-start` | 無 | `manifest.yml` |
| 2 | `f2w-capture` | `manifest.yml` | `pages.json`、`screenshots/` |
| 3 | `f2w-describe` | `pages.json`、`screenshots/` | `workflow.json` |
| 4 | `f2w-export` | `workflow.json`、`pages.json`、`screenshots/` | `workflow.xlsx` |
| 分支（與步 4 併行） | `f2w-bpmn` | `workflow.json` | `workflow.bpmn` |
| 5 | `f2w-breakdown` | `workflow.json` | `workitems.json` |
| 5.5（可選） | `f2w-sourcing` | `workitems.json` ＋ Vendor spec | `workitems-sourced.json` |
| 6 | `f2w-breakdown-export` | `workitems-sourced.json`（在就讀）否則 `workitems.json` | `workitems.xlsx` |

缺前置檔時該步會中止，並提示先跑產出那一檔的步驟。

## 可以手改的 / 不要手改的

- **宣告式逃生口，可手改**：`manifest.yml`、`pages.json`、`workflow.json`、`workitems.json`、`workitems-sourced.json`。自動偵測／描述／拆項不完美時直接改檔再重跑後續步驟，重跑會尊重手改值。
- **交付物**：`workflow.xlsx` 不預期手改，內容不對回頭改上游 json 再重跑 `f2w-export`。`workflow.bpmn` 同理（重跑直接覆寫）：可在 bpmn.io／Camunda Modeler／draw.io 圖形化調版面，但要保留手調排版請自行另存副本。
- **`workitems.xlsx` 是可被重跑覆蓋的範本**：要填 RACI／估時／優先級／簽核／狀態，請**另存一份工作副本**再填。重跑只覆蓋範本、不動工作副本。

詞彙定義見 [CONTEXT.md](../CONTEXT.md)。
