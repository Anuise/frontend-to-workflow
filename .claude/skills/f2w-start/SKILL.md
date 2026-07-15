---
name: f2w-start
description: frontend-to-workflow 管線的第一步。偵測並啟動 Workspace 底下的一個 Project，產生經確認的 manifest.yml。Use when the user wants to run f2w-start, detect a project's launch manifest, or start a project for the frontend-to-workflow pipeline.
---

# f2w-start：偵測並啟動 project

管線四步的第一步。把一個 **Project**（Workspace 底下的子資料夾）偵測出如何安裝、啟動、對外 port 與 base URL，經使用者確認後保存成 **Manifest**（`output/<project>/manifest.yml`），並依此把 project 實際跑起來，給後續 `f2w-capture` 一個可截圖的執行中前端。

前置：無（本步是管線起點）。產出：`output/<project>/manifest.yml`。
假設：**純前端**，無後端、無登入，不處理 auth。

## 流程

1. **決定重用或偵測** — `resolveManifest(outputRoot, project, projectDir)`
   - 已有 `manifest.yml`（`reused: true`）：重用既有值（含使用者手改），**不重新偵測**，直接跳到步驟 4 啟動。
   - 沒有（`reused: false`）：得到一份偵測出的**候選** Manifest，進入步驟 2。
2. **呈現候選給使用者確認** — 這一步是人在迴路的關卡，**不可略過**。
   - 把候選的 install／start／port／baseUrl 逐項列給使用者看。
   - 偵測是「盡力而為＋合理預設」（例如偵測不到明確 port 時預設 `4173`），port 特別容易猜錯，請使用者核對。
   - 使用者確認或口頭更正後才往下。
3. **保存** — `saveManifest(outputRoot, project, confirmedManifest)`
   - 通過契約驗證才寫檔；驗證失敗會丟 `ContractValidationError` 且不落地。
   - 之後重跑同一 project 會自動重用此檔（回到步驟 1 的 `reused: true`）。
4. **啟動** — `launchProject(manifest, projectDir)`
   - 以 `manifest.port` 覆寫 `PORT` 環境變數啟動，輪詢 `baseUrl` 直到可存取，回傳可 `stop()` 的 handle。
   - 純前端下即使某頁因無後端而回 4xx/5xx，只要 server 有回應就算啟動成功，照實保留。

## 逃生口

`manifest.yml` 是宣告式逃生口：偵測不完美時直接手改該檔再重跑；重跑會尊重手改值、不覆寫。

## 對應實作

`src/start/`：`detectManifest`（偵測）、`resolveManifest`（重用或偵測）、`saveManifest`（確認後保存）、`launchProject`（啟動）。契約與路徑見 `src/contracts/manifest.ts` 與 `src/output.ts`。
