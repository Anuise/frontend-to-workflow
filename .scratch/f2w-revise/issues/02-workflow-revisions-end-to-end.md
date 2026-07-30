# f2w-revise T2：workflow 修訂——一句話落檔，重跑 f2w-describe 校正自動回來

State: closed
Status: ready-for-agent
Created: 2026-07-30
Closed: 2026-07-30
Author: weisshung
Parent: ../spec.md

## What to build

使用者對 `workflow.json` 講一句「這頁的用途寫錯了，其實是 SSO 轉導」，這句話變成一筆宣告式的 **Revision** 存起來；之後不管重跑幾次 `f2w-describe`，那個欄位都是使用者的值，而新截到的頁照樣拿得到 AI 的新描述。

這是整個 feature 的第一條完整通路：**講話 → 落檔 → 重跑上游 → 校正回來**。

### 觸發形式

```
f2w-revise workflow <修改需求>
```

target 由使用者講明，**不由 AI 從話裡判斷**——判錯的後果是修訂錨到錯的檔、靜默變孤兒，而講明的成本近乎為零。

### Revision 的形狀

這個形狀是 grilling 逐題敲定的，照抄不要重新設計：

```
{ target, op, anchor, field?, value, reason, at? }
```

- `target` — `"workflow" | "workitems"` 的 **union 而非布林**，未來支援 `workitems-sourced.json` 只是多一個值
- `op` — 本票只實作 `"set"`；`"upsert"` 與 `"remove"` 只對 `workitems` 開放（T3），`workflow` 收到這兩個 op 要報錯
- `anchor` — 字面值 `"overview"`，或一個 Page 識別（route ＋可選 tab）
- `field` — `purpose`、`content`、`actions`（整組）、`overview`
- `value` — **依 `field` 做 discriminated union 驗型別，不用 `z.unknown()` 讓下游契約兜底**。理由是錯誤訊息：`validate()` 會把檔名冠在訊息前，用 `z.unknown()` 時「`purpose` 填成陣列」會被報成 `workflow.json` 的問題，但那個檔沒問題、問題在修訂檔，使用者會去錯的地方找
- `reason` — 人寫的自由文字，**不參與套用**
- `at` — 選填 `YYYY-MM-DD`，**純註記、不參與排序**；寫入時自動填當天，手寫可省略

### 落在哪、怎麼累積

`workspace/revisions/<project>/revisions.json`，與權責泳道圖、Vendor spec 同屬「人提供給管線的東西」。**不進 `CONTRACT_FILES`**——那組常數與 `contractPath`、`requireContract`、`CONTRACT_PRODUCER` 綁在一起，全部假設檔案在 `output/<project>/`。另開一組路徑 helper，接受 workspace 根目錄與 project 名。

檔案是 **append-only 的累積陣列**，越後面越新，歷史留在裡面。同一個欄位改第二次，舊的那筆仍在檔案裡（使用者看得出調整過幾次、每次的理由）。

套用前先摺疊成**有效修訂集**：`set` 的作用點是 `(target, anchor, field)`，每個作用點只取陣列中最後出現的那一筆。摺疊是確定性純函式，是唯一在乎順序的一步；摺疊之後對排列不敏感。

### 誰執行套用

**上游。** `f2w-describe` 在存檔前讀修訂並套上去。`f2w-revise` 本身不碰任何 json。

代價是效果不即時——講完話 `workflow.json` 不會變，要等下一次重跑上游。乾跑驗證是對這個代價的補償，但那是 T4，本票不做。

### 欄位凍結語意

由上游套用意味著**人的校正永遠壓過 AI 的新產出，即使 AI 這次寫得更好**。一個欄位被下過 `set` 就凍結在使用者的值，重跑再也改不動，除非手動從修訂檔刪掉那筆。這是正確的（人說了算），但**必須寫進 SKILL.md**，否則會變成「為什麼我重跑了它還是舊的」這種找不到原因的困惑。

**不加 `once: true` 之類的單次套用機制**——那是為假想情境增加的複雜度，放棄一筆修訂已經有辦法（手動刪除）。

### 軟提示

`f2w-describe` 在寫描述之前先讀一遍既有修訂，當作「已知的人工校正」。這是 SKILL.md 的一句話，不是程式碼。價值在**沒有被錨到的鄰近欄位**：使用者改了某頁的 `purpose` 說那是 SSO 轉導，AI 下次寫該頁的 `content` 就不會再寫錯。硬覆蓋管被錨到的欄位，軟提示管旁邊的。

### 失敗模式

- **套用後不合契約** — 丟錯、不落地，與 `saveWorkflow` 既有的「通過驗證才寫」一致
- **孤兒修訂**（錨指向的 Page 重跑後不存在）— 保留該筆、發 warning、其餘照套。**不中止**：一筆孤兒不該擋掉其他數十筆有效修訂。**不在檔案裡標記** `orphaned` 之類的狀態——那是能從當前 json 算出來的衍生狀態，寫進檔案就會不同步；孤兒常是暫時的，上游 tab 命名改回來它就活了
- **`workflow` 收到 `upsert` 或 `remove`** — 報錯。`buildWorkflow` 有描述與 `pages.json` 一一對應的硬檢查，Page 增刪本來就過不了；要增刪頁應回頭改 `pages.json` 再重跑

## Acceptance criteria

- [x] `f2w-revise workflow <修改需求>` 把使用者的話轉成 Revision，append 進 `workspace/revisions/<project>/revisions.json`（**不做事先確認，直接落檔**）
- [x] 落檔後列出這次寫進去的每一筆全文：錨、欄位、新值、reason
- [x] 缺 `workflow.json` 時丟 `MissingPrerequisiteError`，提示先跑 `f2w-describe`，中止
- [x] 重跑 `f2w-describe`，被 `set` 過的 `purpose`／`content`／`actions`／`overview` 回到 `workflow.json`
- [x] 同一次重跑，**沒有被錨到的新頁拿得到 AI 的新描述**（保住校正與吃到新資訊兩件事同時成立）
- [x] 同一作用點多筆時取最後一筆；同一組修訂以不同順序給入（同作用點相對順序不變）結果相同
- [x] `set` 覆蓋純量欄位與覆蓋整組 `actions` 陣列都可行
- [x] 空修訂集時回傳的物件與輸入相同
- [x] 孤兒修訂保留該筆、發 warning、其餘照套
- [x] `workflow` 搭 `upsert`／`remove` 在契約層被擋下
- [x] `value` 型別依 `field` 分派：`purpose` 給陣列被擋下、`actions` 給字串被擋下，**訊息指名修訂檔而非 `workflow.json`**
- [x] `at` 缺席時通過；修訂檔缺席時 load 回空陣列而非丟錯
- [x] 套用邏輯是不依賴檔案系統的純函式，回 `{ result, warnings }`；摺疊是內部細節、不對外露出
- [x] `CONTEXT.md` 加 **Revision（修訂）** 與 **Effective revision set（有效修訂集）** 兩詞，並補上「`workspace/` 與 `output/` 依內容的作者分」這條分界原則（要能回答「那 `mainflow.json` 為什麼在 `output/`」——因為它的內容作者是 AI）
- [x] ADR-0011：Revision 落在 `workspace/` 而非 `output/`
- [x] ADR-0012：宣告式 override、由上游套用。記下被否決的敘述式提議（重播不確定、無法斷言）與指令式 patch（序列相依）、被否決的「由 `f2w-revise` 就地套」與「兩邊都做」、欄位凍結語意、「直接落檔不做事先確認」如何偏離本 repo 的 checkpoint 慣例及其理由、以及「乾跑與上游實際套用必須共用同一份實作」這條約束
- [x] 新增 `f2w-revise` 的 SKILL.md（workflow 部分）
- [x] 改寫 `f2w-describe` 的 SKILL.md：多一個前置輸入、存檔前套用、欄位凍結語意、描述前先讀修訂當提示，以及「同一份 `pages.json` 配不同修訂檔會產出不同 `workflow.json`」這件事（形式上仍確定性，但削弱了「重跑必然重現」的直覺）

## Blocked by

- 無，可立刻開工
