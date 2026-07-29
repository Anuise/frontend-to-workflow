# workspace/ — 放要文件化的前端原始碼

**Workspace（工作區）**：存放多個前端專案原始碼的容器資料夾。這裡的內容**不被 git 追蹤**（只有本 README 追蹤）。

## 檔案放這裡

一個子資料夾 = 一個 **Project**，子資料夾名即專案識別名（後面 `output/<project>/` 的 `<project>` 就是它）。

```
workspace/
  my-admin-ui/          # ← Project：一份可獨立啟動的純前端原始碼
    package.json
    src/
    vendor-spec.yaml    # ← 可選：Vendor spec（OpenAPI／Swagger），f2w-sourcing 才用得到
  another-app/
```

## 規則

- **純前端假設**：無後端、無登入、不處理 auth。API 沒後端而回空資料／錯誤狀態，照實截圖。
- **一份可獨立啟動**：Project 內要能自己 install／start（`f2w-start` 會偵測並要你確認 install 指令、start 指令、port、base URL）。
- **Vendor spec 放 Project 內**：一檔一家供應商，檔名（去副檔名）即供應商識別名；觸發 `f2w-sourcing` 時要指定路徑。
- **不要把產出放這裡**：所有管線產物一律落在 `output/<project>/`。

詞彙定義見 [CONTEXT.md](../CONTEXT.md)，管線總說明見 `frontend-to-workflow` skill。
