---
name: f2w-capture
description: frontend-to-workflow 管線的第二步。讀取執行中的 Project，列舉所有 Page（路由正規化、同路由下不同 tab 各成一頁）並逐 Page 截圖，產出 pages.json 與 screenshots/。Use when the user wants to run f2w-capture, enumerate a running project's pages, or capture screenshots for the frontend-to-workflow pipeline.
---

# f2w-capture：列舉 Page 並截圖

管線四步的第二步。讀取 f2w-start 保存的 **Manifest**（`output/<project>/manifest.yml`，指向執行中的 **Project**），把整個純前端**列舉出所有 Page**（一條正規化路由，或某路由底下的一個 tab 狀態），逐 Page 截圖，產出 `output/<project>/pages.json` 與 `output/<project>/screenshots/`，交給後續 `f2w-describe`。

前置：`output/<project>/manifest.yml`（由 f2w-start 產出）。缺檔即中止並提示先跑 f2w-start。
產出：`output/<project>/pages.json`、`output/<project>/screenshots/`。
假設：**純前端**，無後端、無登入。某頁因無後端而回空資料／錯誤狀態時，照實截圖為該頁樣貌。

## 流程

1. **讀取前置** — `loadRunningManifest(outputRoot, project)`
   - 回傳 Manifest（含 `baseUrl`、`port`）。缺 `manifest.yml` 會丟 `MissingPrerequisiteError`，提示先跑 f2w-start，**中止**。
2. **確認 project 執行中**
   - capture 針對「執行中」的 `baseUrl`。若尚未啟動，先用 f2w-start 的 `launchProject(manifest, projectDir)` 把它跑起來，或確認 `baseUrl` 可存取。
3. **列舉 Page**（從 `baseUrl` 廣度優先走訪，用瀏覽器工具）
   - 開啟 `baseUrl`，抓頁面上的連結（`<a href>`）。
   - 每個 href 用 `normalizeRoute(href, baseUrl)` 正規化：站外／非 http(s)／無法解析回 `null`（略過）；**等價 URL**（差在 query、fragment、結尾斜線、連續斜線）收斂為同一 route，**不重複列為多個 Page**。
   - 對每條新 route 繼續走訪，直到沒有新 route（同一正規化 route 只走一次）。
   - **tab 狀態**：某路由底下若有多個 tab（如 `role="tab"` 的切換），**每個 tab 狀態各列為一個 Page**（route + tab）。純前端下 API 回空／錯誤的頁面也照列為一個 Page。
   - 目標：對執行中的 project 無明顯漏頁；不確定或漏抓時，用下方逃生口手補。
4. **命名並截圖** — `buildPages(project, pageIds)`
   - 把列舉到的 Page 識別（route + 可選 tab）組成 pages 物件；每頁自動分配**唯一**截圖檔名（`screenshotFilename` 產生，碰撞自動加數字後綴）。
   - 逐 Page：導覽到該 route（tab 狀態要先點到對應 tab）→ 用瀏覽器工具截圖，存到 `output/<project>/screenshots/<screenshot>`（目錄由 `screenshotsPath(outputRoot, project)` 指出）。純前端錯誤／空狀態照實截。
5. **保存** — `savePages(outputRoot, project, pages)`
   - 通過契約驗證（至少一頁、Page 識別唯一、route 已正規化）才寫 `output/<project>/pages.json`；驗證失敗丟 `ContractValidationError` 且不落地。

## 逃生口

`pages.json` 是宣告式逃生口：自動列舉漏頁或多頁時，直接手改該檔（增刪 Page、改截圖對應），並補／刪 `screenshots/` 下對應檔，再交給下一步。

**已知列舉盲點**（正規化後的 route 依契約不含 `#`，故以下情形自動走訪可能漏頁，需用上述逃生口手補）：

- **Hash routing**：`/#/about`、`/#/contact` 這類 hash 路由，pathname 都是 `/`，會收斂成同一頁。
- **非 `<a>` 導覽**：以 button／`onClick` router.push 等 JS 觸發的頁面切換，抓不到 `<a href>`。

## 對應實作

`src/capture/`：`loadRunningManifest`（前置檢查＋讀 manifest）、`normalizeRoute`（路由正規化的確定性核心）、`buildPages`／`screenshotFilename`（組裝與命名）、`savePages`（驗證後保存）。契約見 `src/contracts/page.ts`、`src/contracts/pages.ts`；路徑見 `src/output.ts`（`screenshotsPath`、`contractPath`）。
