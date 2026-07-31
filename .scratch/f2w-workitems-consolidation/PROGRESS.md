# 實作進度（/loop /implement 八張票）

分支：`feat/f2w-workitems-consolidation`

## 狀態：八張票全部完成

- [x] T1 `parseSwimlaneDiagram`（`src/breakdown/parseSwimlaneDiagram.ts`）
- [x] T2 契約合併（`src/contracts/workitems.ts` 吸收 `partyChain`；`sourcedWorkitems.ts` 已刪）
- [x] T3 breakdown 吸收派工（`src/sourcing/` 已刪、具名 options、`checkPartyChains`、`canonicalizeSourcePages`）
- [x] T4 派工輸入自動發現（`src/breakdown/discoverPartyInputs.ts`；`aidms/` → `leadtek/`）
- [x] T5 export 一 leg 一列展開（`src/breakdown-export/`）
- [x] T6 revise：`set partyChain`、leg 標籤當 anchor、`--prune`（`src/revise/prune.ts`）
- [x] T7 文件與流程重整（`.claude/skills/f2w-sourcing/` 已刪、兩份鏡像一致）
- [x] T8 實跑 new_0724 ＋ driver 收斂

## 實跑數字（實測，非估算）

| 項目 | 值 |
|---|---|
| `workitems.json` 後端工項 | 60 筆（不拆項、id 不改寫） |
| partyChain 長度分布 | 21 單 leg／15 兩 leg／24 三 leg |
| `workitems.xlsx` 後端列數 | 123（99 → 123） |
| 三段鏈方序列 | 逐字 `["mobagel","gary","leadtek"]`，中繼段 vendor／端點皆空、scope 寫出「gary 需開代理 API」 |
| 修訂 | 190 → `revisions.json` 111、`revisions.archive.json` 79；孤兒 0；prune 前後套用雜湊相同 |
| `0714` | 不改一字過新契約（94 前端 ＋ 19 後端），匯出仍一工項一列 |

## 與票面不符之處（已按實測修正）

**票 04 的「4 份 spec，gary×3 ＋ leadtek×1」是錯的**：`gary/` 底下四份
（`AI-security`／`Gateway-API`／`IDP-service`／`Model-Maintenance`）全部帶 `openapi: 3.1.0` 與
`paths`，加 `leadtek/aidms-openapi.json`（`swagger: 2.0`）共 **5 份、gary×4 ＋ leadtek×1**。
票上那個數字沿用舊 driver 的 `SPEC_OWNER`（漏列 `IDP-service`）。測試已對齊實測。

## 已知未解（非本次範圍）

- `f2w-run/run-start.test.ts` 失敗：它斷言 `resolveManifest(...).reused === false`，但
  `output/<project>/manifest.yml` 已存在。**先於本次改動**（該 driver 只在乾淨的 output 下會過），
  與本次八張票無關。
