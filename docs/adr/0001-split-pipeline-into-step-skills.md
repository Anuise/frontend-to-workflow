# 將 frontend-to-workflow 拆成獨立觸發的 step skill，以檔案交接狀態

frontend-to-workflow 要把純前端專案轉成使用者視角的工作流程 Excel，過程有啟動、截圖、描述、匯出四個階段。我們決定**不做單一 orchestrator skill**，而是拆成 4 個各自可觸發的 step skill（`f2w-start` / `f2w-capture` / `f2w-describe` / `f2w-export`），總說明 skill `frontend-to-workflow` 只講操作順序、不自動串跑。因為每步分開觸發、無法靠記憶體傳遞，狀態一律落地到 `output/<project>/`（manifest.yml、pages.json、screenshots/、workflow.json、workflow.xlsx），下一步再讀回；缺前置檔就報「請先跑上一步」。

## Considered Options

- **單一 skill 一次跑完四階段**：最省觸發次數，但每個高風險點（啟動契約、頁面涵蓋範圍）猜錯要整條重跑，且不易單獨重跑某一步。
- **拆成 4 個獨立 step skill（採用）**：使用者在每步之間天然形成 checkpoint，可單獨重跑、可局部除錯；代價是要維護明確的檔案交接契約、觸發次數較多。

## Consequences

- 未來新增步驟＝新增一個 `f2w-*` skill，沿用同一套 `output/<project>/` 檔案契約即可，不動既有步驟。
- `manifest.yml` 與 `pages.json` 成為可手改的宣告式逃生口，是主要擴充點。
- 「一鍵跑完 4 步」的 orchestrator 本身被列為未來擴充，現階段刻意不做。
