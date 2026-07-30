# f2w-revise T3：workitems 修訂——set／upsert／remove，重跑 f2w-breakdown 套回

State: open
Status: ready-for-agent
Created: 2026-07-30
Author: weisshung
Parent: ../spec.md

## What to build

把 T2 建好的修訂機制接到 `workitems.json` 上，並補齊 workflow 用不到的兩個 op。

使用者可以：改 AI 寫錯的工項欄位、**補 AI 漏拆的後端工項**、**刪 AI 多拆的重複工項**。重跑 `f2w-breakdown` 之後三件事都還在。

```
f2w-revise workitems <修改需求>
```

### 三個 op

- **`set`** — 覆蓋 `title`、`scope`、`acceptance`、`risk`、`dependsOn`（整組）。`inferred` **不可被覆蓋**：它由工項落在 `frontend` 或 `backend` 陣列決定，既有契約已有 refine 把守
- **`upsert`** — `value` 是一整筆 Work item 物件。id 已存在則整筆覆蓋，不存在則新增。**使用者自己補的工項可以用自訂 id**（如 `BE-EXTRA-01`），完全不受 AI 重新編號影響——這是後端修訂的主要用途
- **`remove`** — 刪掉一筆工項

`upsert` 與 `remove` 的作用點是 `(target, itemId)`，**兩者共用同一個作用點空間**。後果是刻意的：`remove FE-01-03` 之後又 `upsert FE-01-03`，最後一筆是 upsert，該工項活著；反過來則被刪掉。這符合直覺。

有效修訂集內按**固定序 `remove → upsert → set`** 套用。這個優先序是寫死的規則、不是檔案順序，所以有效修訂集本身對排列不敏感——`set` 永遠作用在最終存在的物件上。

### 套用之後仍要過全部把關

`buildWorkitems` 在套用修訂之後，既有的五重把關照跑，特別是**每個 Page 前端工項數 ≥ `max(1, 該頁 actions 數)`** 這條硬底線。使用者 `remove` 掉太多前端工項而跌破底線時，**整步丟錯中止、不落地**——寧可讓人拿不到檔，也不要拿到一份通不過契約的 `workitems.json`。

### 已知的殘餘風險

T1 已經讓前端 id 確定性化，前端錨得住。**後端 id 錨不住**：`set` 改 AI 寫錯的後端工項，錨在 AI 生成的 id 上，重跑後可能孤兒。這是 spec 明確接受的取捨，不要在實作時試圖翻案。實務假設是「補漏比改錯常見」，這個假設由 T5 實跑驗證。

### 露出兩個 apply、不做泛型

`applyRevisions` 對外是兩個純函式（套 workflow 的、套 workitems 的），各回 `{ result, warnings }`。**不做泛型合併**：可覆蓋的欄位集與能否增刪本來就不同，泛型會把差異藏進 runtime 判斷。

## Acceptance criteria

- [ ] `f2w-revise workitems <修改需求>` 落檔並列出每一筆全文，行為與 T2 的 workflow 側一致
- [ ] 缺 `workitems.json` 時丟 `MissingPrerequisiteError`，提示先跑 `f2w-breakdown`，中止
- [ ] 重跑 `f2w-breakdown`，`set` 過的工項欄位、`upsert` 補的工項、`remove` 刪的工項三者全部照舊生效
- [ ] `upsert` 的兩個分支都蓋到：id 已存在則整筆覆蓋、不存在則新增
- [ ] 自訂 id（如 `BE-EXTRA-01`）的 `upsert` 工項在重跑後仍在
- [ ] `upsert` 與 `remove` 共用作用點：`remove` 後 `upsert` 同 id 則工項活著，反之被刪
- [ ] 固定序 `remove → upsert → set`，`set` 作用在最終存在的物件上
- [ ] `set` 覆蓋純量欄位與覆蓋整組 `dependsOn` 陣列都可行
- [ ] `inferred` 不在可覆蓋欄位集內，契約層擋下
- [ ] 套用後跌破前端工項顆粒度底線時整步丟錯、**不落地**
- [ ] 套用後仍跑既有五重把關（涵蓋、參照、顆粒度全部照舊）
- [ ] 孤兒工項修訂保留該筆、發 warning、其餘照套
- [ ] `buildWorkitems` 的薄接線案例：只證明傳入的修訂確實被套進輸出，深層行為不在這裡重複
- [ ] 改寫 `f2w-breakdown` 的 SKILL.md：多一個前置輸入、存檔前套用、欄位凍結語意
- [ ] `f2w-revise` 的 SKILL.md 補上 workitems 段，含「後端 id 可能漂、建議補漏用自訂 id」這個實務建議

## Blocked by

- 01（前端 id 確定性化——沒有它 workitems 修訂撐不過一次重拆）
- 02（Revision 契約、路徑 helper、load／append、摺疊全部在那張票落地）
