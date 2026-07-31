# f2w 中段收斂：工項只有一份檔，分工鏈長在工項身上

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung

## Problem Statement

`f2w-sourcing` 把 `workitems.json` 複製成 `workitems-sourced.json`，並在複製時**改寫後端工項的 id**：一筆跨方工項被拆成 `-M`／`-B` 兩筆，原 id 從產出裡刪掉（`src/sourcing/buildSourcedWorkitems.ts:193-195`）。這一個動作是以下四個症狀的共同成因。

**症狀一：修訂錨不到交付物上的東西。** 實測 `new_0724`（41 頁、257 筆前端工項、60 筆後端工項）累積 190 筆修訂，workitems 側用了 59 個相異 anchor。這 59 個在 `workitems.json` 裡全部存在（孤兒 0 筆），但在 `workitems-sourced.json` 裡有 **39 個（66%）不存在**——且逐一對應 39 筆被拆項的原工項。使用者看的是交付物、修訂作用的是上游，兩邊各有一套 id 命名空間，對不上。

**症狀二：交付物少了一整個分工方的工項，而管線裡沒有一處讀那張圖。** 權責泳道圖的 `leg_chain` cell 逐字寫著「API 呼叫鏈只有三種：① frontend → mobagel　② frontend → mobagel → gary　③ frontend → mobagel → gary → leadtek」，三個泳道 cell（`lane_m`／`lane_g`／`lane_l`）逐字是 mobagel／gary／leadtek。但現行 99 列後端工項依 `originItemId` 分組後的方序列分布是 24×`mobagel > leadtek`、17×`mobagel`、15×`mobagel > gary`、4×`needs-investigation`——那 24 筆走的鏈不在宣告的三種之內，而圖上根本沒有 `m_back1 → l_apiserver` 這條邊（唯一到 `l_apiserver` 的邊是 `g_apisix → l_apiserver`）。gary 當純通道時被整列蒸發，沒有人為那一段畫押。

缺的是 reader 不是 writer：泳道名是 AI 讀圖後傳進 `buildSourcedWorkitems` 的字串陣列，`leg_chain` 那段人寫的宣告**沒有任何 reader**，而「哪份 spec 屬於哪個方」只活在一支未納版控的 driver 常數（`f2w-run/run-sourcing-new0724.test.ts:42` 的 `SPEC_OWNER`）裡——那支 driver 的註解（`:15`）至今還引用早已不存在的那條邊。

**症狀三：兩份檔之間沒有新鮮度關係。** `loadWorkitemsForExport` 只對 sourced 檔做 `existsSync`，沒有 mtime、雜湊或 project 一致性比對，所以重跑 `f2w-breakdown` 套進新修訂之後，舊的 sourced 檔仍會靜默勝出、xlsx 拿不到新修訂；要退回無分工版只能自己刪檔，文件沒寫這件事。

**症狀四：修訂檔只會越跑越肥。** 190 筆摺疊成 111 個作用點，79 筆是同作用點被後寫覆蓋的歷史，佔全檔 39.7% 的體積。

而「過時」實測起來與直覺相反：190 筆裡孤兒 **0 筆**、純重複 append **0 筆**、乾跑全綠；109 筆是 no-op（value 與當前 json 逐字相同），但那正因為 `workitems.json` 是在修訂落檔之後才重跑產出的（`revisions.json` mtime 07-31T00:51 早於 `workitems.json` 07-31T01:08）——它們是「修訂已成功套上」的證據，砍掉等於讓 108 個欄位在下次重跑靜默退回 AI 原文。真正可證明過時的只有那 79 筆被覆蓋的歷史。凍結規模同時具體了：59 個相異工項被錨住、106 個（工項, 欄位）對被凍結，60 筆後端工項有 57 筆（95%）至少被凍結一個欄位。

流程本身也已經對不上自己的描述：`f2w-sourcing` 的「5.5」只存在於總說明表、它自己稱「可選插入步」；四支前段 skill 的正文寫「管線四步」而 breakdown 系列寫「管線六步」；`f2w-breakdown` 全文 0 次提到 sourcing，剛跑完第五步的使用者在原地拿不到分流提示；泳道圖被宣告為「平台級共用、可跨 project」卻住在 `workspace/spec/<project>/` 底下；`workspace/README.md` 描述的佈局兩處與現實不符。

## Solution

四個症狀共用一個解：**讓 workitems 只有一份檔、一個 id 命名空間，分工鏈長在工項身上，多列只在交付物層展開。**

`f2w-sourcing` 退場，派工併入 `f2w-breakdown`；`workitems-sourced.json` 契約一併退場。管線從「六步＋一個 5.5」變回乾淨的六步，加上分支步 `f2w-diagram` 與可重複的插入步 `f2w-revise`。`f2w-breakdown` 不改名——吸收一步不是改名。

後端工項不再被拆成多筆，改成帶一個 **Party chain（分工鏈）**：一個 leg 陣列，每個 leg 是 `{ party, vendor?, vendorEndpoints, title?, scope?, acceptance? }`。id 不改寫，所以症狀一的成因結構性消失，`originItemId` 與 `dependsOn` 重映射整段退場，逐筆冪等回來。

**leg 帶自己的散文，這一點不可讓步。** 實測 39 組拆項的 `title`／`scope`／`acceptance` 三欄**各 leg 逐組全異（39/39/39）**——那不是樣板複製，是唯一寫著各方要做什麼、驗收什麼的地方。例：`BE-MODEL-1` 的 mobagel leg 驗收是「前端不直接呼叫 leadtek；請求經 mobagel 授權後穿 gary API gateway 轉發…」，leadtek leg 是「清單欄位齊全，支援分頁與排序。」。抽掉 leg 散文，gary 那一列會顯示 leadtek 的活與 leadtek 的驗收，而 gary 要以單一 A 在上面畫押——ADR-0004 的原始理由逐字就是「可各自畫押」。三欄為 optional、缺欄時繼承工項層（單 leg 情形自然正確），但多 leg 工項的每個 leg 都必須自帶三欄。

使用者拍板的「gary 要在交付物裡佔自己一列」在 `f2w-breakdown-export` 兌現：一筆 partyChain 有 N 個 leg 就展開成 N 列，每列一個分工方、各自帶供應商與端點與散文、各自畫押。列標籤由鏈索引**確定性推導**：單 leg 就是工項 id，多 leg 是 `<工項id>#<leg序>`（如 `BE-MODEL-1#2`），`#` 在契約層被禁止出現在工項 id 裡，所以標籤永不撞號。

**而這個列標籤是合法的修訂錨，不是「永遠不是錨」。** 使用者照交付物寫下 `BE-MODEL-1#2` 必須錨得到東西——比照 ADR-0013 對前端 id 做的事：標籤由 (工項 id, leg 序) 確定性推導，`f2w-revise` 的 anchor 解析器把它拆回工項與 leg 序再套用。把它定為「非錨」等於讓使用者照交付物抄的錨系統性落空，那是把症狀一從 json 層搬到交付物層，不是解掉它。

派工的依據第一次真的被讀：新增確定性解析器 **`parseSwimlaneDiagram`**（與 `parseVendorSpec` 對稱），抽出泳道名、把節點解析到所屬方（先走 `parent` 鏈，掛 root 的節點以矩形包含補判）、從邊算出方層跳躍圖、並讀 `leg_chain` 切出宣告鏈。宣告文字與邊圖**兩者都讀**且互為交叉檢查：邊圖是結構事實但不封閉（`n_ext → g_apisix` 讓外部 AP 直打 gary，所以「只有三種鏈」推不出來），宣告文字封閉但是人手寫的、會過期，所以**宣告鏈是權威、進硬底線**，而宣告鏈裡某個相鄰跳躍在邊圖上找不到支持時發 warning 不中止。

解析器**不宣稱能配對**，只推導路徑與讀宣告，所以是 ADR-0007 的補充而非推翻：ADR-0007 否決解析器的論據是「保不了這格對應這個工項」，配對仍全程是 AI 推論、靠 `sourcingConfirmed: false` 人核兜底。

宣告鏈當 builder 的**鏈硬底線**：每筆後端工項的方序列必須逐字等於宣告鏈之一（含單 leg），否則整步丟錯不落地並逐一列名。底線跑在**套用修訂之後**（`set partyChain` 也要被校）。這條正好擋掉現行那 24 筆 `mobagel > leadtek`，逼出 gary 的中繼 leg——交付物後端列數從 99 變 **123**（21 筆單 leg ＋ 15 筆兩 leg ＋ 24 筆三 leg）。

派工輸入自動發現：掃 `workspace/spec/<project>/`，project 根的 `.drawio` 是泳道圖，`<方名>/*.json` 過 OpenAPI 指紋的是那個方的 Vendor spec，`.$*` 與 `*.bkp` 依**檔名**排除（draw.io 的自動備份本身是合法 mxfile，內容指紋分不出來）。**目錄名即分工方名**讓 spec→方 的對應變成確定性推導（`aidms/` 改名為 `leadtek/`），也消滅「沒被引用的 spec 檔名成為合法方名」這個舊行為（現行 `IDP-service.json` 是合法 `assignedParty`）——分工方集合改成純由泳道名決定，spec 目錄名必須是泳道名的子集。發現結果**每次都列給使用者看**，也可手動指定路徑覆蓋，不落第二份清單。

找不到輸入時分兩種嚴格度：`workspace/spec/<project>/` **目錄不存在**＝安靜照跑、不產 partyChain（純自建專案如 `0714` 什麼都不用做）；**目錄存在但沒有任何可用檔**＝中止（那更像擺錯位置而不是沒有）。

「改派工」的操作退化明文以逃生口補回：`workitems.json` 仍是宣告式逃生口，派錯方可以直接手改該檔、零重跑，與現行手改 sourced 檔對等；想跨重跑存活再寫成修訂。這一點要寫進 ADR-0015 與 SKILL.md，因為合併確實少了一道 checkpoint。

「自動清除過時規則」只做**可證明**的一類，而且是**搬檔不是刪除**：`f2w-revise --prune` 把同作用點被後寫覆蓋的筆（判定沿用 `applyRevisions` 自己的 `actionPoint`）移進同目錄的 `revisions.archive.json`，`revisions.json` 只留有效修訂集。`upsert` 與 `remove` **不參與**作用點摺疊——`actionPoint` 讓兩者共用作用點，搬走 upsert 會廢掉 ADR-0012:29 認可的唯一放棄途徑。no-op 與孤兒一律只報告：no-op 不可證明過時（108/111 筆有效修訂是 no-op，正是修訂已成功套上的證據），孤兒不可證明永久過時（ADR-0012:41：上游 tab 命名改回來它就活了）。`DryRunReport` 同時擴成帶可機讀分類與有效修訂集大小，順手答了「我的校正現在還有幾筆錨得住」。

配套修補三項既有缺陷：`set` 的 field union 加 `partyChain`（手改 sourced 檔那個逃生口隨檔案退場，換成撐得過重跑的管道）；`buildWorkitems.ts:143-152` 的 `sourcePage` 正規化在套用之後而 `dryRun.ts:52-54` 沒有它——正是 ADR-0012:35 點名會讓兩邊分岔的後處理，本次把正規化搬進乾跑共用；並清掉過期文字（管線步數措辭、泳道圖路徑與「平台級共用」的說法、`workspace/README.md` 佈局、`f2w-diagram` 誤把「配對待確認」歸給 ADR-0004 的引用、`f2w-breakdown-export` 補展開規則），補一段「修訂生效回路」。

## User Stories

### 管線使用者

1. As a 管線使用者, I want 交付物上 gary 當純通道時也有自己一列並寫著 gary 那一段要做什麼, so that 我能請 gary 在上面畫押。
2. As a 管線使用者, I want 我照交付物列標籤寫下的修訂錨得到東西, so that 我不必先搞懂 json 有兩層 id 命名空間。
3. As a 管線使用者, I want 我寫在泳道圖上的呼叫鏈宣告真的被讀進去, so that 我不必把同一條規則逐筆手抄進工項。
4. As a 管線使用者, I want AI 派出不在宣告鏈上的方序列時整步失敗並指名, so that 缺一整個分工方的交付物不會靜默出貨。
5. As a 管線使用者, I want 派工輸入自動被找到並列給我看, so that 我不必每次觸發都打五份路徑。
6. As a 管線使用者, I want 派錯方可以直接手改 `workitems.json` 零重跑, so that 合併掉一步之後我的日常操作沒有變貴。
7. As a 管線使用者, I want 修訂檔裡已經不生效的歷史可以被搬走, so that 我還看得懂自己有哪些校正還活著。
8. As a 管線使用者, I want 一份修訂被搬走時仍可還原, so that 自動清除不會變成不可逆的資料遺失。

## Implementation Decisions

**合併形態採 M3b：一筆工項帶 partyChain，交付物才展開成多列。** 66% 錨定裂縫的成因是拆項改寫 id；只合併不改形狀（單一產出仍拆項／只合併觸發）不改變套用點與 id 改寫的先後，裂縫原封不動。

**leg 帶自己的 optional 散文，多 leg 時必填。** 實測 39/39/39 全異；沒有 leg 散文，交付物那一列就沒有屬於該方的資訊可畫押。

**leg 標籤 `<工項id>#<leg序>` 是確定性推導的合法修訂錨。** 契約層加 refine 禁止工項 id 含 `#`。`f2w-revise` 的 anchor 解析先切 `#`，右側是 leg 序。

**partyChain 與 sourcingConfirmed 皆 optional，但後端工項全有全無。** `upsert` 的 `value` 是 `workItemSchema`，設成必填會讓使用者補後端工項時過不了契約。全有全無讓「有派工但這次忘了給輸入」變成大聲的錯誤而不是靜默半套。

**分工方集合純由泳道名決定，spec 目錄名必須是子集。** 現行 `partySet = parties ∪ spec 檔名`，於是 `IDP-service.json` 成為合法 `assignedParty`。

**鏈硬底線跑在套用修訂之後，`[needs-investigation]` 這條長度 1 的鏈永遠合法**且不得出現在多 leg 鏈裡。

**只把 `sourcePage` 正規化搬進乾跑共用，不動 `checkWorkitemsConsistency` 的既有位置**（`buildWorkitems.ts:141` 的註解就是那條不變式）。

**派工輸入三態**：目錄不存在＝安靜照跑不產 partyChain；目錄存在無可用檔＝中止；手動指定＝用指定的、忽略發現結果。

**prune 只搬 superseded，`upsert`／`remove` 不參與摺疊，搬進 `revisions.archive.json`。** 不設 `prunedAt` 墓碑欄位（只會更肥），不在 `loadProjectRevisions` 過濾（會讓乾跑與上游看到不同輸入）。

**步驟形狀**：`f2w-start` → `f2w-capture` → `f2w-describe` → `f2w-export`（分支 `f2w-diagram`）→ `f2w-breakdown` → `f2w-breakdown-export`，加可隨時插入且可重複的 `f2w-revise`。沒有小數點編號。

**遷移分三檔**：`0721`／`0729` 無 `workitems.json`，不用動；`0714` 不重跑、不改一個字就能過新契約；`new_0724` 是唯一要實跑的，並在 `revisions.json` 的兩筆 upsert（`BE-EXTRA-01`／`BE-EXTRA-02`）的 value 補上 `partyChain`。

## Testing Decisions

單元測試照既有慣例落在 `src/**` 旁邊。`parseSwimlaneDiagram` 拿本 repo 實檔 `workspace/spec/new_0724_.../桃園刑大ai_platform.drawio` 當 fixture——它同時涵蓋 `parent` 鏈、掛 root 需幾何補判（`l_apiserver`）、泳道外節點（`n_ext`）、純標籤 cell、圖例色塊四種形態。

端到端驗收仍用 `f2w-run/` 的 vitest driver（`-c` 自訂 config）驅動 `src` 函式。本次要把 driver 從「扛政策表」降級為「只驅動」：`SPEC_OWNER` 隨目錄慣例消失，`POLICY` 表的鏈決策交給宣告鏈硬底線把關。六支 untracked driver 收斂成兩支並納入版控（一支跑新形狀的 breakdown＋export、一支跑 revise 乾跑與 prune）。

驗收數字以實測為準，不接受估算：後端交付物列數 99 → 123、`workitems.json` 後端工項 60 筆不變、修訂有效集 190 → 111、archive 79 筆。

## Out of Scope

- **後端工項 id 的確定性化**。會限縮 ADR-0002 給後端推論的自由度，ADR-0013 已明確接受這個取捨。本 spec 讓 id 漂移的影響變小（不再多一層 `-M`／`-B` 改寫），但沒有消滅它。
- **ADR-0013 的殘餘風險：錯位但不算孤兒**。頁插在中間導致 id 整批位移，錨在舊 id 的修訂會落到別筆工項身上、不發 warning、乾跑也看不出來。prune 完全抓不到它——本 spec 不得讓人以為 prune 之後檔案就健康了。
- **no-op 的自動清除，以及為它落檔 AI-only 基準**。要讓 no-op 升格為可證明就得落檔一份不套修訂的基準產出，工程量與痛不成比例。記為未來選項。
- **`workspace/revisions/` 納入版控**。`workspace/` 一貫不追蹤（ADR-0011:20）。archive 提供的還原路徑是「把那一筆搬回去」，不是版本歷史。
- **`docs/adr/` 兩個 0007 的重編**。既有問題，重編會打斷現有引用。散文裡引到時寫出檔名而不只是編號。
- **`workflow.json` 的 Page 增刪**。契約層把 `upsert`／`remove` 的 target 寫死成 `literal("workitems")`。
- **泳道圖的幾何配對**（哪一格對應哪個工項）。ADR-0007 已否決，本 spec 不翻案。
- **`f2w-start`／`f2w-capture`／`f2w-describe`／`f2w-export`／`f2w-diagram` 的行為**。只改文件，程式不動。`mainflow.json` 的「已存在就沿用」不改成自動偵測，只加一句提醒。
- **一鍵跑完六步的 orchestrator 與獨立的導航步**。後者要把順序知識再抄一份，有第三份鏡像漂移的風險。
- **`f2w-run/` 那四支 revise sweep driver 手抄措辭的單一來源化**。那些修訂已落檔生效；本 spec 只讓 `-M` leg 那一份憑空消失（leg 散文改由 AI 逐 leg 產出、不再由樣板生成）。

## Further Notes

- `.agents/skills/` 底下只鏡像了 `frontend-to-workflow` 一支，六支 `f2w-*` step skill 沒有鏡像。改總說明時仍是兩份要同步，改 step skill 只有一份。
- `output/` 被 `.gitignore:149` 整個排除，所以任何以 `git status` 為判準的驗收條件都是空的——驗收要直接讀 json 數欄位。
- `.$桃園刑大ai_platform.drawio.bkp` 實際落在 `workspace/spec/` **根**，不在 project 目錄底下。掃描範圍是 project 目錄，所以它天然不會被掃到；`.$*`／`*.bkp` 的檔名排除規則仍要寫，因為備份也可能出現在 project 目錄內。
- 邊 `e9`（`g_dlp`@lane_g → `g_agent`@lane_l）純靠 `parent` 鏈就給出 `gary → leadtek`，所以幾何包含是**補判**不是必要條件。方層跳躍逐邊解析下是 3 條（含 `e9`）而非 2 條。
- driver 註解 `f2w-run/run-sourcing-new0724.test.ts:15` 那個過期的 `m_back1 → l_apiserver` 說法**不會**被宣告鏈 warning 抓到（warning 只比對圖上的邊與宣告文字，讀不到 driver 註解）。它靠票 08 的 driver 收斂手動清掉。
- `workitems.xlsx` 的既有欄名是「派工方」；改成一列一 leg 之後列數與 id 形態都變，會打斷範本承諾的「重跑只覆蓋範本、不動工作副本」。票 05 要處理這個遷移並在 SKILL.md 寫明。

## Implementation issues

- [01-parse-swimlane-diagram.md](issues/01-parse-swimlane-diagram.md) — 確定性泳道圖解析器（closed）
- [02-workitem-carries-party-chain.md](issues/02-workitem-carries-party-chain.md) — 契約合併：工項帶 partyChain（closed）
- [03-breakdown-absorbs-party-assignment.md](issues/03-breakdown-absorbs-party-assignment.md) — f2w-breakdown 吸收派工與鏈硬底線（closed）
- [04-discover-party-inputs.md](issues/04-discover-party-inputs.md) — 派工輸入自動發現（closed）
- [05-export-expands-party-chain.md](issues/05-export-expands-party-chain.md) — 交付物層展開成列（closed）
- [06-revise-party-chain-and-prune.md](issues/06-revise-party-chain-and-prune.md) — partyChain 可修訂與 --prune（closed）
- [07-docs-and-flow-reshape.md](issues/07-docs-and-flow-reshape.md) — 流程重整與文件（closed）
- [08-end-to-end-and-migration.md](issues/08-end-to-end-and-migration.md) — 實跑驗收與遷移（closed）
