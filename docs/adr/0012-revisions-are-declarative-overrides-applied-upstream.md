# Revision 是宣告式 override，由上游套用

一筆 **Revision** 記的是「哪個 Page 或哪個 Work item 的哪個欄位，**最終該是什麼**」——欄位級的最終值，附一句 `reason`。套用的執行者是**上游**：`f2w-describe` 與 `f2w-breakdown` 在存檔前讀修訂並套上去。`f2w-revise` 自己**不碰任何 json**。

起因是 `workflow.json` 與 `workitems.json` 都是整份覆寫：`saveWorkflow`／`saveWorkitems` 沒有合併語意，重跑上游就是拿新內容整份蓋掉。於是「宣告式逃生口」只能用一次，使用者不敢重跑，管線的可重跑性形同虛設。

## Considered Options

**修訂的形狀**

- **敘述式提議（否決）**：把使用者的話原樣存起來，下次重跑餵給 AI 當指示。重播不確定——同一句話兩次可能寫出不同結果，且「這筆修訂到底套上了沒有」無法斷言，測不出來。
- **指令式 patch（否決）**：存成一串變更指令（append 這筆、把第 3 筆改成 X）。序列相依：上游一變，「第 3 筆」是誰就變了；而且需要乾淨基準才能重播。
- **宣告式欄位級最終值（採用）**：與當前狀態無關，套用冪等，順序無關（除摺疊那一步），可用手寫 fixture 直接斷言結果。

**誰執行套用**

- **由 `f2w-revise` 就地改寫 json（否決）**：零侵入、講完立刻生效。但重跑上游後若忘記補跑 `f2w-revise`，會**靜默**拿到沒套校正的交付物——這正是本 feature 要解決的問題本身。而且就地改寫之後下次讀到的已是套過的版本，等於重複套用，`upsert` 型的 op 會撞號爆炸。
- **兩邊都做（否決）**：兩個洞都補，但要動的既有 skill 一樣多，卻多一份冗餘語意要維護。
- **由上游套用（採用）**：代價是**效果不即時**——講完話 json 不會變，要等下一次重跑上游。乾跑驗證是對這個代價的補償。

**落檔前要不要確認**

- **不確認，直接 append（採用）**：偏離了本 repo「每步之間保留使用者確認的 checkpoint」的慣例（ADR-0001），是刻意的取捨。理由是 Revision 的累積**後者勝**語意讓「再講一次蓋掉」很便宜，而每次確認都要一輪對話；落檔後把每一筆全文列出來，等於用事後回報取代事前確認。

## 欄位凍結語意

由上游套用意味著**人的校正永遠壓過 AI 的新產出，即使 AI 這次寫得更好**。一個欄位被下過 `set` 就凍結在使用者的值，重跑上游再也改不動，除非手動從修訂檔刪掉那筆。這是正確的（人說了算），但必須寫進三支 SKILL.md，否則會變成「為什麼我重跑了它還是舊的」這種找不到原因的困惑。

**不加 `once: true` 之類的單次套用機制**——那是為假想情境增加的複雜度，而放棄一筆修訂已經有辦法（手動刪除）。

## 一致性約束：乾跑與上游必須共用同一份實作

乾跑（`dryRunWorkflowRevisions`／`dryRunWorkitemsRevisions`）呼叫的必須是上游用的**同一支** `applyWorkflowRevisions`／`applyWorkitemsRevisions`，`checkWorkitemsConsistency` 亦同。兩份實作會漂，而乾跑報「沒問題」、上游實際套出來炸掉，比沒有乾跑更糟。

**這個保證會在什麼情況下破掉**：只要有人在上游 `buildWorkflow`／`buildWorkitems` 裡、**套用修訂之後**再加任何後處理（再改一次欄位、再排序、再補預設值），乾跑就看不到那一段，兩邊結果會分岔。要加後處理，就得同時讓乾跑走同一條路。

## Consequences

- 摺疊（每個作用點只取最後一筆）是 `applyRevisions` 的**內部細節**，不對外露出。作用點：`set` 是 `(target, anchor, field)`；`upsert` 與 `remove` 共用 `(target, itemId)`——`remove` 後又 `upsert` 同 id 則工項活著，反過來則被刪掉。有效修訂集內按固定序 `remove` → `upsert` → `set` 套用，所以 `set` 永遠作用在最終存在的物件上。
- 套用後仍跑全部既有把關：workflow 側重驗操作去向，workitems 側重跑參照＋顆粒度底線。跌破底線即丟錯**不落地**——寧可讓人拿不到檔，也不要拿到一份通不過契約的產出。
- 孤兒修訂（錨指向的 Page 或工項已不存在）**保留該筆、發 warning、其餘照套**，不中止。不在檔案裡標記 `orphaned`：那是能從當前 json 算出來的衍生狀態，寫進檔案就會不同步；孤兒常是暫時的（上游 tab 命名改回來它就活了）。
- `workflow` 搭 `upsert`／`remove` 由**契約層**擋下（兩個 op 的 `target` 是 `literal("workitems")`）。`buildWorkflow` 有描述與 `pages.json` 一一對應的硬檢查，Page 增刪本來就過不了；要增刪頁應回頭改 `pages.json` 再重跑。
- `f2w-describe` 的產出不再只由 `pages.json` 與截圖決定：同一份輸入配不同修訂檔會產出不同 `workflow.json`。形式上仍確定性（修訂檔是宣告的輸入之一），但確實削弱了「重跑必然重現」的直覺，SKILL.md 要講清楚。
- `value` 的型別依 `field` 做 discriminated union，**不用 `z.unknown()` 讓下游契約兜底**。理由是錯誤訊息：`validate()` 會把檔名冠在訊息前，用 `z.unknown()` 時「`purpose` 填成陣列」會被報成 `workflow.json` 的問題，但那個檔沒問題、問題在修訂檔。逐筆驗證時訊息冠的是 `revisions.json（第 N 筆）`。
