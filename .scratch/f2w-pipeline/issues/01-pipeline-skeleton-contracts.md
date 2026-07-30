# f2w：管線骨架與檔案契約（prefactor）

State: closed
Status: ready-for-agent
Created: 2026-07-15
Closed: 2026-07-15
Author: Anuise
Origin: GitHub issue #5 — https://github.com/Anuise/frontend-to-workflow/issues/5
Parent: ../spec.md (originally #4)

## What to build

為整條管線建立共用地基（綠地 prefactor，先讓後續改動容易）。建立專案 runtime 與測試 harness；定義並實作 `output/<project>/` 的檔案交接契約——`manifest.yml`、`pages.json`、`workflow.json` 的 schema 與可呼叫的驗證——這組檔案邊界就是後續每個 step 的測試 seam。並提供一個可獨立啟動的 sample 純前端 fixture project，以及各步驟的手寫契約 fixture 輸入檔，供後續 step 開發與黃金端對端使用。

## Acceptance criteria

- [x] runtime 與測試 harness 就位，可執行測試並全綠。
- [x] `manifest.yml` / `pages.json` / `workflow.json` 各有明確 schema 與驗證，對合法輸入通過、對非法輸入拒絕。
- [x] Page 以「正規化路由 +（可選）tab 名稱」為識別的結構在契約中定義。
- [x] repo 內含一個可啟動的 sample 純前端 fixture project，及各步驟的手寫 fixture 輸入檔。
- [x] 提供共用的「缺前置檔」偵測工具，供各 step 報「請先跑上一步」。

## Blocked by

- None — can start immediately.

## Status

已於 PR #12 實作完成（branch `claude/issue-5-822d42`）。

## Comments

### Anuise — 2026-07-15

已於 PR #12 完成實作。

**交付內容**
- runtime + 測試 harness：Node 20 + TypeScript + Vitest + Zod（`npm install` 0 弱點）
- 檔案交接契約 + 可呼叫驗證：`manifest.yml` / `pages.json` / `workflow.json`（Zod schema + parse/load，合法通過、非法丟 `ContractValidationError`）
- Page 識別結構：正規化路由 +（可選）tab，於契約中共用並強制唯一
- `output/<project>/` 路徑 helper + 缺前置檔偵測工具 `requireContract`（報「請先跑上一步」）
- 可啟動 sample 純前端 fixture project + 各步手寫 fixture 輸入檔（含 `screenshots/`）

**驗證**：typecheck 乾淨、23 測試通過、sample project 實測路由 200、已過 /code-review 兩軸審查。

五條驗收標準全數達成。
