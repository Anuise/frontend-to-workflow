# T7：流程重整與文件——刪 f2w-sourcing、修過期敘述、補修訂生效回路

State: open
Status: ready-for-agent
Created: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

刪掉 `.claude/skills/f2w-sourcing/`，並把管線敘述統一成：`f2w-start` → `f2w-capture` → `f2w-describe` → `f2w-export`（分支步 `f2w-diagram`）→ `f2w-breakdown` → `f2w-breakdown-export`，加可隨時插入且可重複的 `f2w-revise`。**沒有小數點編號**，「5.5」這個寫法整份消失。

逐項要改：

- **`f2w-breakdown/SKILL.md`**：吸收派工（輸入自動發現與三態、鏈硬底線、`partyChain` 的形狀與 leg 散文規則）；明文寫**手改 `workitems.json` 是零重跑的逃生口**（合併掉一步之後這是唯一補回操作成本的地方，見 ADR-0015）；補一句往 `f2w-breakdown-export` 的分流提示（現行全文 0 次提到下一步的分工議題）。
- **`f2w-breakdown-export/SKILL.md`**：frontmatter 與正文補上 leg 展開規則、工作副本需人工對照遷移。
- **四支前段 skill**（`f2w-start`／`f2w-capture`／`f2w-describe`／`f2w-export`）：正文的「管線四步」改成不帶總數的說法，與 breakdown 系列的「六步」不再互相矛盾。
- **`f2w-revise/SKILL.md`**：`set` 可覆蓋 `partyChain`、leg 標籤可當 anchor、`--prune` 的範圍與**它買不到正確性**這件事；補「修訂生效回路」——revise 落檔 → 重跑 `f2w-describe`／`f2w-breakdown` 才生效 → 交付物要重跑 `f2w-export`／`f2w-breakdown-export`／`f2w-diagram`，其中 `mainflow.json` 已存在就沿用、要重推得刪檔。
- **`frontend-to-workflow/SKILL.md`（總說明）**：交接表移除 `workitems-sourced.json` 與 `f2w-sourcing`。**兩份鏡像都要改**：`.claude/skills/frontend-to-workflow/SKILL.md` 與 `.agents/skills/frontend-to-workflow/SKILL.md`（實測 `.agents/skills/` 只鏡像了這一支，六支 `f2w-*` step skill 沒有鏡像）。
- **`workspace/README.md`**：佈局描述兩處與現實不符，改成實話；加上 `spec/<project>/<方名>/` 的目錄慣例與 `revisions.archive.json`。
- **`f2w-diagram/SKILL.md`**：把「配對待確認」誤引 ADR-0004 的地方改指 `0007-party-assignment-from-swimlane-diagram.md`。
- **`CONTEXT.md`**：新增 Party chain（分工鏈）、leg、宣告鏈三個詞條；泳道圖「平台級共用、可跨 project」的說法改成逐 project（與 ADR-0018 一致）。

引用 ADR 時**寫出檔名**而不只是編號（`docs/adr/` 有兩個 0007，編號是歧義的）。

決策見 ADR-0015、ADR-0018。

## Acceptance criteria

- [ ] `.claude/skills/f2w-sourcing/` 已刪除；全 repo（含兩份鏡像與 `docs/`）grep `f2w-sourcing` 只剩 ADR 裡的歷史敘述
- [ ] 全 repo grep `workitems-sourced` 只剩 ADR 裡的歷史敘述
- [ ] 全 repo grep `5.5` 在 skill 文件裡 0 命中
- [ ] 四支前段 skill 不再出現「管線四步」，與 breakdown 系列的步數敘述一致
- [ ] `f2w-breakdown/SKILL.md` 含「手改 `workitems.json` 零重跑」這條逃生口敘述
- [ ] `f2w-revise/SKILL.md` 含修訂生效回路，且明說 `--prune` 只買體積與可讀性、不買正確性
- [ ] 兩份 `frontend-to-workflow/SKILL.md` 逐字一致（diff 為空）
- [ ] `CONTEXT.md` 有 Party chain／leg／宣告鏈三個詞條，且泳道圖的層級敘述與 ADR-0018 一致
- [ ] 散文裡引用 ADR-0007 的地方都寫出檔名
- [ ] `workspace/README.md` 的佈局與實際目錄一致
- [ ] 任何 SKILL.md 裡逐字寫出的函式簽名與實際相符（現行 `f2w-sourcing/SKILL.md:36` 那種四參數寫法不得留下同類問題）

## Blocked by

- T3、T4、T5、T6（文件要描述最終行為）
