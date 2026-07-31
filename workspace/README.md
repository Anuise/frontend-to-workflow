# workspace/ — 放要文件化的前端原始碼與人提供的輸入

**Workspace（工作區）**：存放前端專案原始碼、以及人提供給管線的輸入的容器資料夾。這裡的內容**不被 git 追蹤**（只有本 README 追蹤）。

## 實際佈局

```
workspace/
  frontend/                      # ← 前端原始碼，一個子資料夾 = 一個 Project
    my-admin-ui/                 #    子資料夾名即專案識別名（output/<project>/ 的 <project>）
      package.json
      src/
    another-app/
  spec/                          # ← 派工輸入，依 project 分（f2w-breakdown 自動掃）
    my-admin-ui/
      lanes.drawio               #    權責泳道圖：project 根的 .drawio，泳道＝分工方
      gary/                      #    Vendor spec：目錄名即分工方名
        Gateway-API.json
        AI-security.json
      leadtek/
        aidms-openapi.json
  revisions/                     # ← 人工修訂，依 project 分（f2w-revise 產出與讀回）
    my-admin-ui/
      revisions.json
      revisions.archive.json     #    --prune 搬走的 superseded 歷史（可搬回來還原）
```

## 規則

- **純前端假設**：無後端、無登入、不處理 auth。API 沒後端而回空資料／錯誤狀態，照實截圖。
- **一份可獨立啟動**：Project 內要能自己 install／start（`f2w-start` 會偵測並要你確認 install 指令、start 指令、port、base URL）。
- **派工輸入依 project 分，不是平台級共用**：放在 `spec/<project>/` 底下。同一張泳道圖要給兩個 project 用就各放一份——跨 project 共用會讓「這個 project 到底吃到哪張圖」變得看不出來（見 `docs/adr/0018-party-inputs-discovered-by-directory-convention.md`）。
- **目錄名即分工方名**：`spec/<project>/<方名>/*.json`。分工方集合純由泳道圖的泳道名決定，所以**目錄名必須是泳道名的子集**，不是就報錯。不再用檔名當供應商識別名。
- **自動掃、不用打路徑**：`f2w-breakdown` 每次都會掃 `spec/<project>/` 並把「用了哪張圖、哪幾份 spec、哪些檔被排除」列給你看。`.$*` 與 `*.bkp`（draw.io 自動備份）依檔名排除；`.json` 不帶 `openapi`／`swagger` 也會列進「已排除」並說明原因。
- **`spec/<project>/` 不存在不是錯誤**：純自建、無多方分工的專案什麼都不用放，管線安靜照跑、不產分工鏈。目錄存在但沒有任何可用檔才會中止——那更像擺錯位置。
- **修訂檔是唯一落在 `workspace/` 的管線產出**：因為內容作者是人（見 ADR-0011）。它不進版控，`revisions.archive.json` 提供的還原路徑是「把那一筆搬回 `revisions.json`」，不是版本歷史。
- **不要把產出放這裡**：所有管線產物一律落在 `output/<project>/`。

詞彙定義見 [CONTEXT.md](../CONTEXT.md)，管線總說明見 `frontend-to-workflow` skill。
