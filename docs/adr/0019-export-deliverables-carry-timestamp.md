# ADR-0019：兩支 xlsx 交付物的檔名帶時戳，重跑不再覆蓋

## 決策

`f2w-export` 與 `f2w-breakdown-export` 產出的檔名各自帶上**寫檔當下的本地年月日時分秒**：

- `output/<project>/workflow-<YYYYMMDD-HHmmss>.xlsx`
- `output/<project>/workitems-<YYYYMMDD-HHmmss>.xlsx`

時戳插在副檔名之前，格式 `YYYYMMDD-HHmmss`（例：`workflow-20260803-153012.xlsx`）。單一來源是 `src/output.ts` 的 `timestampSuffix` 與 `timestampedContractPath`；`saveWorkbook` / `saveWorkitemsWorkbook` 收一個可選的 `at: Date`（省略時取當下），讓檔名可在測試裡被斷言。

**只出帶時戳的一份**——不另寫一份無時戳的「最新」檔。最新的一份就是時戳最大的那個，`YYYYMMDD-HHmmss` 補零對齊，檔名字典序＝時間序。

範圍**只有這兩支交付物**。`manifest.yml`、`pages.json`、`workflow.json`、`mainflow.json`、`workitems.json` 是跨步驟交接檔，檔名必須固定才讀得回，一律不動；`mainflow.drawio` 雖是交付物但也不帶時戳、維持重跑覆寫（見「後果」）。

## 為何

交付物是拿給業主與協作方的東西，重跑一次就把上一版原地蓋掉，等於沒有版本可回頭比對。帶時戳之後每次重跑各留一份，要哪一版看檔名就知道。

## 後果

- **「範本／工作副本」的覆蓋承諾作廢**：ADR-0016 與 f2w-breakdown-export 原本承諾「重跑只覆蓋範本、不動工作副本」。現在重跑根本不覆蓋任何東西，出的是新一份範本。工作副本仍要人另存、換範本時畫押值仍要人工搬——這點沒有變好也沒有變壞，只是理由從「範本會被蓋掉」變成「範本換了一份新的」。
- **舊檔會累積**：`output/<project>/` 下會長出一堆 xlsx，工具不自動清，由使用者決定。
- **`mainflow.drawio` 語意分岔**：它仍是固定檔名、重跑覆寫。原本 f2w-diagram 的 SKILL.md 寫「同 `workflow.xlsx` 語意」，現在這句不成立，已改寫成明講差異。要不要讓圖也帶時戳是另一個決策，不在本 ADR 範圍。
- **時戳取本地時間**：跨時區協作時檔名不可比。此專案是單一時區使用，接受。
