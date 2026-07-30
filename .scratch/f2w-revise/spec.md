# f2w-revise：讓人工修訂跨重跑存活

State: closed
Status: ready-for-agent
Created: 2026-07-30
Closed: 2026-07-30
Author: weisshung

## Problem Statement

`workflow.json` 與 `workitems.json` 都明文是「宣告式逃生口」——AI 描述得不準、操作去向抓錯、工項漏拆，使用者可以直接手改該檔，符合契約就交給下一步。

但這兩支檔的產出方式是**整份覆寫**。`saveWorkflow` 與 `saveWorkitems` 沒有任何合併語意，重跑 `f2w-describe` 或 `f2w-breakdown` 就是拿新的內容整份蓋掉舊檔。

於是逃生口只能用一次。實測一份 41 頁、257 個 action 的專案，使用者花時間校正了十幾處描述與操作去向，接著因為上游截圖補了兩頁而重跑 `f2w-describe`，全部校正歸零，而且沒有任何一處留下痕跡——連「我上次改了什麼」都查不到。

結果是使用者不敢重跑。上游明明有新資訊（補截到的頁、修正過的 tab 命名），卻因為重跑的代價是丟掉所有人工校正而不敢動，管線的可重跑性形同虛設。

`mainflow.json` 用「已存在就沿用、不重推論」迴避了這個問題，但那是整檔級的全有全無：沿用就完全拿不到新資訊。`workflow.json` 與 `workitems.json` 不能這樣做——它們是逐頁、逐工項的，新頁的描述必須進得來，被校正過的欄位必須留得住，兩件事要同時成立。

## Solution

新增 **`f2w-revise`**，一個可選、可重複的插入步。它不產交付物，只做一件事：把使用者提出的修改需求，轉寫成一批**宣告式的 Revision**，落在 `workspace/revisions/<project>/revisions.json`。

```
f2w-revise <workflow|workitems> <修改需求>
```

Revision 是欄位級的最終值，不是變更指令，也不是自然語言提議。每一筆記錄「哪個 Page 或哪個 Work item 的哪個欄位，最終該是什麼」，附一句 `reason`。

套用的執行者是**上游**：`f2w-describe` 與 `f2w-breakdown` 在存檔前讀取修訂並套上去。所以重跑上游不再是「丟掉校正」，而是「拿到新資訊，並自動帶回所有校正」。使用者可以放心重跑。

`f2w-revise` 本身不碰任何 json，但落檔後會做一次**乾跑驗證**：讀當前的 json、套一次、跑完整的契約與底線檢查、報出 warnings 與孤兒——不寫回。使用者在講完話的當下就知道這筆修訂會不會炸，不必等一次昂貴的上游重跑才發現。

配套一項既有契約的收緊：前端工項 id 從「AI 自由發揮」升格為**確定性推導**（`FE-<頁序>-<該頁操作序>`）。沒有這一項，錨在 id 上的 Revision 撐不過一次 `f2w-breakdown` 重跑。

## User Stories

### 管線使用者

1. As a 管線使用者, I want 我提出的修改被存成獨立的檔案, so that 它不會跟著被重跑覆寫的產物一起消失。
2. As a 管線使用者, I want 重跑 `f2w-describe` 之後我的校正自動回到 `workflow.json`, so that 我不必在每次重跑後重做一遍人工修正。
3. As a 管線使用者, I want 重跑 `f2w-breakdown` 之後我的工項校正自動回到 `workitems.json`, so that 上游描述更新時我不用重新拆一遍工項。
4. As a 管線使用者, I want 重跑仍然拿得到新頁的新描述, so that 我不會為了保住校正而放棄上游的新資訊。
5. As a 管線使用者, I want 用一句話講出要改什麼而不必自己開 json 找欄位, so that 校正一份 41 頁的專案不需要我逐字編輯巢狀結構。
6. As a 管線使用者, I want 觸發時自己講明要改 workflow 還是 workitems, so that 不會因為 AI 判錯 target 而讓修訂靜默失效。
7. As a 管線使用者, I want 修改被落檔之後立刻看到每一筆的全文, so that AI 幫我重寫的那段字我事後看得到、不滿意可以馬上再講一次。
8. As a 管線使用者, I want 落檔後當場跑一次乾跑驗證, so that 我不用等一次昂貴的上游重跑才發現這筆修訂會讓契約驗證失敗。
9. As a 管線使用者, I want 乾跑會告訴我哪些修訂已經變成孤兒, so that 我知道上游改動打斷了哪些校正。
10. As a 管線使用者, I want 什麼修改需求都不講也能跑這一步, so that 我可以單純檢查目前累積的修訂是否還健康。
11. As a 管線使用者, I want 同一個欄位改第二次時舊的那筆仍留在檔案裡, so that 我看得出這個欄位被調整過幾次、每次的理由是什麼。
12. As a 管線使用者, I want 每一筆修訂帶著提出的日期, so that 我能對得起來哪一批校正是哪一次重跑之後提的。
13. As a 管線使用者, I want 修訂檔是我看得懂、改得動的 json, so that 我可以不透過 AI 直接手寫或刪除一筆修訂。
14. As a 管線使用者, I want 手動刪掉一筆修訂之後重跑上游就會回到 AI 的版本, so that 我有辦法放棄一個不再需要的校正。
15. As a 管線使用者, I want 修訂檔跟權責泳道圖、Vendor spec 放在同一個地方, so that 「我提供給管線的東西」全部集中在一處。
16. As a 管線使用者, I want 修訂裡能改一頁的完整操作清單, so that 我修得了操作去向抓錯這個最常見、也最會讓流程圖歪掉的問題。
17. As a 管線使用者, I want 修訂裡能補上 AI 漏拆的後端工項, so that 我補的工項不會在下一次 `f2w-breakdown` 被沖掉。
18. As a 管線使用者, I want 修訂裡能刪掉 AI 多拆的工項, so that 重複或不成立的工項不會每次重跑都回來。
19. As a 管線使用者, I want 我補的工項可以用自己取的 id, so that 它完全不受 AI 重新編號的影響。
20. As a 管線使用者, I want 套用之後跌破工項顆粒度底線時整步中止而不是寫出壞檔, so that 我不會拿到一份通不過契約的 `workitems.json`。
21. As a 管線使用者, I want 修訂檔本身型別寫錯時錯誤訊息指名是修訂檔的問題, so that 我知道要去改哪一個檔，而不是被指到 `workflow.json` 去空找。
22. As a 管線使用者, I want 缺 `workflow.json` 或 `workitems.json` 時本步中止並提示先跑上一步, so that 我不會對著不存在的東西提修改。
23. As a 管線使用者, I want 這一步是可選的、不跑也不影響管線, so that 沒有校正需求的專案不必多跑一步。
24. As a 管線使用者, I want 同一個專案可以反覆跑這一步, so that 校正可以分好幾次慢慢累積，不必一次講完。

### 收交付物的專案關係人

25. As a 收交付物的專案關係人, I want 我在會議上指出的描述錯誤下次拿到的檔案就是對的, so that 同一個錯不必指正第二次。
26. As a 收交付物的專案關係人, I want 人工校正過的欄位不會被後來的 AI 重跑改掉, so that 已經談定的措辭是穩定的。
27. As a 收交付物的專案關係人, I want 交付物本身看不出哪些欄位被人改過, so that 我拿到的 `workflow.xlsx` 仍是一份乾淨的文件，不帶編修痕跡。

### f2w-revise 的維護者

28. As a f2w-revise 的維護者, I want 套用邏輯是一個不依賴檔案系統的純函式, so that 全部行為可以用手寫 fixture 斷言。
29. As a f2w-revise 的維護者, I want 修訂集合除了摺疊之外對順序不敏感, so that 套用結果可預測、測試不必依賴陣列排列。
30. As a f2w-revise 的維護者, I want 套用邏輯被 `f2w-describe`、`f2w-breakdown` 與乾跑三處共用, so that 乾跑報的結果跟上游真正套出來的結果一定一致。
31. As a f2w-revise 的維護者, I want 前端工項 id 由契約強制成確定性格式, so that 錨定在 id 上的修訂撐得過一次重拆。
32. As a f2w-revise 的維護者, I want 後端工項 id 無法確定性這件事被明文寫下, so that 未來遇到後端修訂變孤兒時知道那是已知取捨不是 bug。
33. As a f2w-revise 的維護者, I want 修訂只支援 workflow 的欄位覆蓋而不支援 Page 增刪, so that 不會跟 `buildWorkflow` 既有的一一對應硬檢查打架。
34. As a f2w-revise 的維護者, I want `target` 是一個 union 而不是布林, so that 未來要支援 `workitems-sourced.json` 時只是多一個值。

## Implementation Decisions

### 新增的領域詞彙（進 `CONTEXT.md`）

- **Revision（修訂）** — 一筆錨定在 Page 或 Work item 上的人工校正，覆蓋 AI 產出的單一欄位或整筆工項，帶 `reason`。由 `f2w-revise` 從使用者的話轉寫而來，也可手寫。不叫 Override（偏實作語彙）、不叫 Correction（預設原本是錯的，但有些修訂只是偏好）、不叫 Feedback（太軟，聽起來不會被套用）。
- **Effective revision set（有效修訂集）** — 把累積的 Revision 依作用點摺疊、每個作用點只取最後一筆的結果。順序無關，是實際被套用的那一組。

同時要補進 `CONTEXT.md` 的一條分界原則：**`workspace/` 與 `output/` 依內容的作者分**。`workspace/` 放人的意圖（權責泳道圖、Vendor spec、Revision），`output/` 放管線寫出來的東西（含 AI 推論但人可手改的 `mainflow.json`）。這條原則要能回答「那 `mainflow.json` 為什麼在 `output/`」——因為它的內容作者是 AI，不是人。

### 檔案位置

修訂檔落在 `workspace/revisions/<project>/revisions.json`，與 `workspace/spec/` 底下的權責泳道圖屬同一類「人提供給管線的東西」。

它**不進 `CONTRACT_FILES`**——那組常數與 `contractPath`、`requireContract`、`CONTRACT_PRODUCER` 綁在一起，全部假設檔案在 `output/<project>/` 底下。修訂檔另開一組路徑 helper，接受 workspace 根目錄與 project 名。

`/workspace/*` 未被 git 追蹤，但 `/output/*` 同樣未被追蹤，所以這不是新增的風險，是這條管線一貫的狀態。

### Revision 契約

新增一支契約模組，每筆修訂的形狀為：

```
{ target, op, anchor, field?, value, reason, at? }
```

- **`target`** — `"workflow" | "workitems"` 的 union。刻意用 union 而非布林，未來要支援 `workitems-sourced.json` 只是多一個值。
- **`op`** — `"set" | "upsert" | "remove"`。`upsert` 與 `remove` **只對 `workitems` 開放**；`workflow` 收到這兩個 op 要報錯。
- **`anchor`** — `workflow` 是字面值 `"overview"` 或一個 Page 識別（route ＋可選 tab）；`workitems` 是工項 id。
- **`field`** — 僅 `set` 需要。`workflow` 可覆蓋 `purpose`、`content`、`actions`（整組）與 `overview`；`workitems` 可覆蓋 `title`、`scope`、`acceptance`、`risk`、`dependsOn`（整組）。
- **`value`** — 依 `field` 做 discriminated union 驗型別，**不使用 `z.unknown()` 讓下游契約兜底**。理由是錯誤訊息：`validate()` 會把檔名冠在訊息前，用 `z.unknown()` 時「`purpose` 填成陣列」會被報成 `workflow.json` 的問題，但那個檔沒問題、問題在修訂檔，使用者會去錯的地方找。
- **`reason`** — 使用者提出這筆修訂的理由，人寫的自由文字。**不參與套用**，是給人看的。
- **`at`** — 選填日期字串（`YYYY-MM-DD`）。**純註記、不參與排序**。`f2w-revise` 寫入時自動填當天日期；使用者手寫時可以省略，省略不影響套用正確性。

`inferred` 不可被修訂覆蓋——它由工項落在 `frontend` 或 `backend` 陣列決定，既有契約已有 refine 把守。

`upsert` 的 `value` 是一整筆 Work item 物件。

### 摺疊與套用

修訂檔是 **append-only 的累積陣列**，越後面越新。歷史保留在這裡。套用前先摺疊成有效修訂集：

**作用點**的定義：

- `set` 的作用點是 `(target, anchor, field)`
- `upsert` 與 `remove` 的作用點是 `(target, itemId)`，兩者**共用同一個作用點空間**

每個作用點只取陣列中最後出現的那一筆。共用作用點的後果是刻意的：`remove FE-01-03` 之後又 `upsert FE-01-03`，最後一筆是 upsert，該工項活著；反過來則被刪掉。這符合直覺。

有效修訂集內按**固定序** `remove → upsert → set` 套用。這個優先序是寫死的規則、不是檔案順序，所以有效修訂集本身對排列不敏感——`set` 永遠作用在最終存在的物件上。

順序只在摺疊那一步有意義，摺疊本身是確定性純函式。這讓「保留完整歷史」與「套用結果與排列無關」兩件事同時成立。

### 套用的執行者是上游

`f2w-describe` 與 `f2w-breakdown` 在存檔前讀取修訂並套用。`f2w-revise` 本身**不改任何 json**。

被否決的兩個替代方案，理由記在 ADR：

- **由 `f2w-revise` 就地改寫 json** — 零侵入、講完立刻生效，但重跑上游後若忘記補跑，會靜默拿到沒套校正的交付物。而且它需要「乾淨基準」——就地改寫之後下次讀到的已是套過的版本，等於重複套用，`add` 型的 op 會撞號爆炸。
- **兩邊都做** — 兩個洞都補，但要動的既有 skill 一樣多，卻多一份冗餘語意要維護。

選上游套的代價是**效果不即時**：講完話 json 不會變，要等下一次重跑上游。乾跑驗證是對這個代價的補償。

### 前端工項 id 升格為確定性推導

既有契約只要求工項 id 非空且全域唯一。實測資料的 `FE-01-01` 格式是 AI 的習慣，不是強制。

重跑 `f2w-breakdown` 時 AI 重新拆、重新編號，id 一漂，所有錨在 id 上的修訂全變孤兒——這會讓 workitems 那一半的修訂功能形同虛設。

因此收緊契約：**前端工項 id 為 `FE-<頁序>-<該頁操作序>`**，兩個序號都取自 `workflow.json` 的陣列索引，完全確定性。workflow 沒變，id 必定相同。workflow 變了（頁增刪、action 增刪）導致 id 位移、修訂變孤兒，這是**正確的行為**——上游真的變了。

`workflow` 那一半沒有這個問題：錨是 Page 識別（route ＋ tab），來自 `pages.json`，本來就確定性。

**後端 id 無法確定性化，這是明確接受的取捨。** `BE-<頁序>-<序>` 的「序」取決於 AI 這次推論出幾筆，每次可能不同。後果分兩種：

- **`upsert` 補 AI 漏掉的後端工項** — 使用者可用自訂 id（如 `BE-EXTRA-01`），完全穩定，不受影響。這是後端修訂的主要用途。
- **`set` 改 AI 寫錯的後端工項** — 錨在 AI 生成的 id 上，重跑後可能孤兒。這一種脆。

把後端工項也錨定到 action 以求確定性會限縮 ADR-0002 給推論的自由度（後端工項刻意不與 action 一一對應），不做。

### f2w-revise 的流程

觸發形式為 `f2w-revise <workflow|workitems> <修改需求>`。**target 由使用者講明，不由 AI 從話裡判斷**——判錯的後果是修訂錨到錯的檔、靜默變孤兒，而講明的成本近乎為零。

1. **讀當前 json** — 依 target 讀 `workflow.json` 或 `workitems.json`。缺檔丟 `MissingPrerequisiteError`，提示先跑對應的上一步，中止。
2. **產出 Revision** — AI 依當前狀態與使用者的話，寫出一批 Revision，含它自己重寫的欄位全文。
3. **直接 append 落檔** — 不做事先確認。理由是 Revision 的累積後者勝語意讓「再講一次蓋掉」很便宜，而每次確認都要一輪對話。這一點偏離了本 repo「每步之間保留使用者確認的 checkpoint」的慣例，是刻意的取捨，記在 ADR。
4. **乾跑驗證** — 把落檔後的完整修訂集套到當前 json 上，跑契約驗證與工項顆粒度底線，收集 warnings 與孤兒清單，**不寫回任何 json**。
5. **回報** — 列出這次寫進去的每一筆全文（錨、欄位、新值、reason），加上乾跑的結果。落檔後回報取代了落檔前確認。

不帶修改需求直接觸發時，跳過 2 與 3，只做乾跑與回報——用來檢查目前累積的修訂是否還健康。

### 欄位凍結語意

由上游套用意味著**人的校正永遠壓過 AI 的新產出，即使 AI 這次寫得更好**。一個欄位被下過 `set`，它就凍結在使用者的值，重跑上游再也改不動，除非手動從修訂檔刪掉那筆。

這是正確的（人說了算），但必須寫進 `f2w-revise` 與兩支上游 skill 的 SKILL.md，否則會變成「為什麼我重跑了它還是舊的」這種找不到原因的困惑。

**不加 `once: true` 之類的單次套用機制**——那是為假想情境增加的複雜度，而放棄一筆修訂已經有辦法（手動刪除）。

### AI 描述時把修訂當提示

`f2w-describe` 在寫描述之前先讀一遍既有修訂，當作「已知的人工校正」。這是 SKILL.md 的一句話，不是程式碼。

價值在**沒有被錨到的鄰近欄位**：使用者改了某頁的 `purpose` 說那是 SSO 轉導，AI 下次寫該頁的 `content` 就不會再寫錯。硬覆蓋管被錨到的欄位，軟提示管旁邊的。

### 失敗模式

- **套用後不合契約，或跌破前端工項顆粒度底線** — 丟錯、**不落地**。與 `saveWorkflow`／`saveWorkitems` 既有的「通過驗證才寫」一致。
- **孤兒修訂**（錨指向的 Page 或工項在重跑後不存在） — **保留該筆、發 warning、其餘照套**。不中止：一筆孤兒不該擋掉其他數十筆有效修訂。**不在檔案裡標記** `orphaned` 之類的狀態：那是能從當前 json 算出來的衍生狀態，寫進檔案就會不同步。孤兒常是暫時的，上游 tab 命名改回來它就活了。
- **`workflow` 收到 `upsert` 或 `remove`** — 報錯。`buildWorkflow` 有描述與 `pages.json` 一一對應的硬檢查，Page 增刪本來就過不了，明文不支援；要增刪頁應回頭改 `pages.json` 再重跑。

### 模組與介面

**新增**

- **Revision 契約模組** — schema、parse、load。缺檔時回空陣列而不是報錯（修訂是可選的）。
- **`applyRevisions`** — 露出兩個純函式：套 workflow 的與套 workitems 的，各回 `{ result, warnings }`。摺疊是這個模組的內部細節，不對外露出。兩個 apply 分開、不做泛型：可覆蓋的欄位集與能否增刪本來就不同，泛型會把差異藏進 runtime 判斷。
- **`f2w-revise` 的 inputs／save** — 修訂檔路徑 helper、讀回、append 落檔。

**修改**

- **工項契約** — 前端 id 格式的 refine。
- **`buildWorkflow`** — 簽章多一個修訂參數，存檔前套用。
- **`buildWorkitems`** — 同上。
- **`f2w-describe`／`f2w-breakdown` 的 inputs** — 多讀修訂檔。

`applyRevisions` 被三處共用：`f2w-describe`、`f2w-breakdown`、`f2w-revise` 的乾跑。共用是硬需求——乾跑報的結果必須與上游真正套出來的結果一致，兩份實作會漂。

### 文件

- 新增 `f2w-revise` 的 SKILL.md。
- 改寫 `f2w-describe` 與 `f2w-breakdown` 的 SKILL.md：多一個前置輸入、存檔前套用、欄位凍結語意；`f2w-describe` 另加「描述前先讀修訂當提示」。
- `f2w-breakdown` 的 SKILL.md 補上前端 id 的確定性格式要求。
- 總說明 skill 加上這個可選插入步。**總說明有 `.claude` 與 `.agents` 兩份鏡像，改一必改另一。**
- `CONTEXT.md` 加兩個新詞，並補上 `workspace/`／`output/` 的分界原則。
- 三份 ADR，見下。

### ADR

- **ADR-0011 — Revision 落在 `workspace/` 而非 `output/`**：這是唯一一個「管線寫出、卻不放 `output/`」的例外，未來的人一定會問。記下「依內容的作者分類」這條原則，以及它如何解釋 `mainflow.json` 為何仍在 `output/`。
- **ADR-0012 — Revision 是宣告式 override、由上游套用**：記下被否決的敘述式提議（重播不確定、無法斷言）與指令式 patch（序列相依）；記下被否決的「由 `f2w-revise` 就地套」與「兩邊都做」；記下欄位凍結語意；記下「直接落檔不做事先確認」如何偏離本 repo 的 checkpoint 慣例及其理由；記下「乾跑與上游實際套用必須共用同一份實作」這條約束。
- **ADR-0013 — 前端工項 id 為確定性推導**：為何強制格式（修訂錨定必須撐過重拆），以及後端為何做不到、殘餘風險是什麼。

編號從 0011 起跳。（既有問題、本次不動：`docs/adr/` 目前有兩個 0007。）

## Testing Decisions

**什麼是好測試**：只斷言外部行為。`applyRevisions` 的外部行為是它回傳的資料結構與 warnings——哪些欄位變成什麼、哪些工項還在、哪些修訂被判為孤兒。不去斷言摺疊的中間結果，也不去斷言內部走訪順序。契約模組的外部行為是「什麼通過、什麼被擋下、擋下時訊息說什麼」。

**受測接縫**（新增兩個，既有兩個加案例）：

| 接縫 | 新舊 | 斷言範圍 |
|---|---|---|
| `applyRevisions` | 新 | 套用的全部行為 |
| Revision 契約 | 新 | schema 驗證與錯誤訊息 |
| 工項契約 | 既有 | 新增的前端 id 格式 |
| `buildWorkflow`／`buildWorkitems` | 既有 | 薄接線案例 |

`foldRevisions` **不獨立成接縫**，收進 `applyRevisions` 內部。它的外部行為就是「哪一筆勝出」，而那只在套用結果上看得見；獨立測等於斷言內部資料結構。

**Prior art**：`buildWorkitems.test.ts` 與 `buildDiagram.test.ts` 的現行寫法即範本——檔頂手寫 fixture、`describe` 依語意分組、用小 helper 讀回傳值。契約測試照 `workitems.test.ts`（逐條 refine 各一個 happy 與一個被擋下的案例）。沿用。

**`applyRevisions` 必蓋的行為**：

- 同一作用點多筆時取最後一筆
- `upsert` 與 `remove` 共用作用點——`remove` 後 `upsert` 同 id 則工項活著，反之被刪
- 固定序 `remove → upsert → set`，`set` 作用在最終存在的物件上
- **除摺疊外對排列不敏感**：同一組修訂以不同順序給入（同作用點的相對順序不變），結果相同
- `set` 覆蓋純量欄位與覆蓋整組陣列（`actions`、`dependsOn`）
- `upsert` 的兩個分支：id 已存在則整筆覆蓋、不存在則新增
- 孤兒修訂保留該筆、發 warning、其餘照套
- `workflow` 收到 `upsert` 或 `remove` 報錯
- 空修訂集時回傳的物件與輸入相同

**契約必蓋的行為**：

- `value` 型別依 `field` 分派——`purpose` 給陣列被擋下，`actions` 給字串被擋下
- 型別錯誤時訊息指名修訂檔，不是 `workflow.json`
- `workflow` 搭 `upsert`／`remove` 被擋下
- `at` 缺席時通過
- 修訂檔缺席時 load 回空陣列而非丟錯

**工項契約必蓋的行為**：

- 合規的 `FE-<頁序>-<操作序>` 通過
- 不合規的前端 id 被擋下
- 後端 id 不受此格式約束

**`buildWorkflow`／`buildWorkitems` 的薄案例**：只證明接線——傳入的修訂確實被套進了輸出，以及套用後仍跑既有的涵蓋／參照／顆粒度全部把關（套用後跌破底線會丟錯不落地）。深層行為不在這裡重複。

**跨重跑的存活**：一個端到端形狀的案例——同一批修訂套在兩份不同的上游產出上（模擬重跑前後，其中一份多了一頁），斷言原本錨得住的修訂仍然套上、新頁不受影響。這是整個 feature 的核心承諾，必須有測試直接蓋到。

## Out of Scope

- **`mainflow.json`**。它已經是「已存在就沿用、不重推論」，不會被沖掉，沒有這個痛。
- **`workitems-sourced.json`**。改 Party assignment 是同一類需求，但這次不做；`target` 的 union 留了擴充位。
- **`workflow.json` 的 Page 增刪**。`buildWorkflow` 的一一對應硬檢查擋死，明文不支援；要增刪頁回頭改 `pages.json`。
- **後端工項 id 的確定性化**。會限縮 ADR-0002 給後端推論的自由度。
- **修訂史的呈現**。累積的陣列本身就是史，不做 UI、不做 md 衍生檔、不做 diff 視圖。
- **`once: true` 之類的單次套用機制**。放棄一筆修訂用手動刪除即可。
- **修訂檔納入版控**。`workspace/` 一貫不追蹤，這次不改。
- **`f2w-revise` 就地改寫 json**。已在 ADR-0012 明確否決。
- **`f2w-sourcing`／`f2w-export`／`f2w-breakdown-export`／`f2w-diagram` 一律不動**。sourcing 吃的 `workitems.json` 已是校正過的，自然繼承，不需要自己讀修訂。

## Further Notes

**最大的已知風險是後端工項 id 的漂移。** 前端錨得住，後端只有自訂 id 的 `upsert` 錨得住。實務上「補 AI 漏掉的後端工項」比「改 AI 寫錯的後端工項」常見，所以影響應該可控，但這個假設沒有實測支撐。第一次在真實專案上重跑 `f2w-breakdown` 之後，值得數一下有多少後端修訂變孤兒；如果比例高，`BE` 的錨定策略要重新設計。

**乾跑與上游實際套用之間的一致性靠共用實作保證，不靠測試比對。** 兩者都呼叫同一個 `applyRevisions`。如果未來有人在上游加了額外的後處理，這個保證就破了——ADR-0012 要把這一點寫成約束。

**這個 feature 讓 `f2w-describe` 的產出不再只由 `pages.json` 與截圖決定。** 同一份輸入配不同的修訂檔會產出不同的 `workflow.json`。這在形式上仍是確定性的（修訂檔是宣告的輸入之一），但它確實削弱了「重跑必然重現」這個直覺，SKILL.md 要講清楚。

**驗證資料**：`output/new_0724_AI六大模組管理平台_桃園智發會_最新版`（41 頁、257 個 action）與 `output/0729_AI六大模組管理平台_5E_AI平台最新版` 都有完整的 `workflow.json` 與 `workitems.json`，可拿來做實跑驗收，特別是「重跑 `f2w-breakdown` 之後前端 id 是否真的穩定」這一項。

**決策來源**：本 spec 由一次 `/grill-with-docs` 逐題確認產生。過程中「誰執行套用」被使用者重開一次，從「`f2w-revise` 就地套」改為「上游套」；前端 id 的穩定性問題是在那次重開之後才浮現的。被否決的選項與理由記在 ADR-0011 至 0013。

**實測的後端修訂孤兒比例（T5 量出來的數字）**：在 `new_0724_AI六大模組管理平台_桃園智發會_最新版`（41 頁、257 action、58 筆後端工項）上提了 6 筆錨在 AI 生成後端 id 的 `set` 修訂，重跑 `f2w-breakdown` 之後**孤兒 0 筆（0%）**，6 筆全部套上。但這個數字是**下限、不是結論**：該專案的後端工項清單寫在驅動裡、id 是手寫常數，重跑必然一致；真正的漂移來自 AI 重新推論後端清單那一刻，本次沒有重新推論。要驗那個情境得讓 AI 重拆一次後端，是另一次實跑。同一批修訂裡的自訂 id `upsert`（`BE-EXTRA-01`）與兩筆前端 `set`（`FE-01-01`／`FE-01-02`）也都在重跑後回到 `workitems.json`。

**前端 id 的確定性已實測**：同一專案連跑兩次 `f2w-breakdown`，257 筆前端 id 逐字相同（SHA-1 `c7370a0c`）。

**T5 找到一個 spec 沒預期到的行為，比「變孤兒」更難察覺**：`workflow.json` 新增的頁若**插在既有頁中間**，工項 id 整批位移，原本錨在 `FE-02-01` 的修訂**不會變孤兒**——它會套到位移後占用該 id 的另一筆工項身上，而且**不發 warning**（那個 id 確實存在），乾跑也看不出來。根因是 anchor 只有 id、沒有頁身分可交叉核對。已記進 ADR-0013 並有測試蓋住（`src/revise/crossRerunSurvival.test.ts`），要根治得在 anchor 上補 `sourcePage` 或改用內容雜湊——那是另一張票。

## Implementation issues

- [`issues/01-frontend-workitem-id-deterministic.md`](issues/01-frontend-workitem-id-deterministic.md) — f2w-revise T1：前端工項 id 升格為確定性推導（prefactor） (closed)
- [`issues/02-workflow-revisions-end-to-end.md`](issues/02-workflow-revisions-end-to-end.md) — f2w-revise T2：workflow 修訂——一句話落檔，重跑 f2w-describe 校正自動回來 (closed)
- [`issues/03-workitems-revisions-end-to-end.md`](issues/03-workitems-revisions-end-to-end.md) — f2w-revise T3：workitems 修訂——set／upsert／remove，重跑 f2w-breakdown 套回 (closed)
- [`issues/04-dry-run-validation.md`](issues/04-dry-run-validation.md) — f2w-revise T4：乾跑驗證 (closed)
- [`issues/05-cross-rerun-survival-acceptance.md`](issues/05-cross-rerun-survival-acceptance.md) — f2w-revise T5：跨重跑存活驗收 (closed)

依賴：01 與 02 無 blocker、可並行；03 卡 01＋02；04 卡 02＋03；05 卡 03＋04。
