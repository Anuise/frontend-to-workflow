# T4：派工輸入自動發現——目錄慣例掃描，強制回報，可手動覆蓋

State: closed
Status: ready-for-agent
Created: 2026-07-31
Closed: 2026-07-31
Author: weisshung
Parent: ../spec.md

## What to build

新增確定性函式掃 `workspace/spec/<project>/`，回傳一份「本次用了什麼」的發現結果：

- **權責泳道圖**＝project 根的 `.drawio`（多於一張即報錯，要人指定）。
- **Vendor spec**＝`<方名>/*.json` 裡根物件帶 `openapi` 或 `swagger` 的檔。**目錄名即分工方名**（`gary/Gateway-API.json` → `gary`），不再用檔名當識別名。
- **排除**：`.$*` 與 `*.bkp` 依**檔名**排除（draw.io 自動備份是合法 mxfile、`diagram` 的 name 與 id 與正本相同，內容分不出來）；不過 OpenAPI 指紋的 `.json` 也列進「已排除」並說明原因，不靜默略過。

`parseVendorSpec` 的供應商識別名改為由呼叫端傳入（＝目錄名），不再從檔名推。

**spec 目錄名必須是泳道名的子集**，不是即報錯並列出兩邊集合。

**三態**：

1. `workspace/spec/<project>/` **目錄不存在** → 安靜照跑、不產 `partyChain`，回報中說明原因。
2. 目錄存在但沒有任何可用檔 → **中止**（更像擺錯位置而不是不派工）。
3. 手動指定路徑 → 用指定的、忽略發現結果。

發現結果**每次都列給使用者看**：用了哪張圖、哪幾份 spec、各自推出哪個方、哪些檔被排除與原因。不落第二份清單檔。

一併把 `workspace/spec/new_0724_.../aidms/` 改名為 `leadtek/`。

決策見 ADR-0018。

## Acceptance criteria

- [ ] 掃 `workspace/spec/new_0724_AI六大模組管理平台_桃園智發會_最新版/` 找到 1 張泳道圖與 4 份 spec，方歸屬為 `gary`×3 ＋ `leadtek`×1（改名後）
- [ ] `aidms/` 已改名為 `leadtek/`，且 `SPEC_OWNER` 這個 driver 常數不再需要存在
- [ ] 供應商識別名來自目錄名：`leadtek/aidms-openapi.json` 的識別名是 `leadtek`，不是 `aidms-openapi`
- [ ] 同一方目錄下多份 spec 的 capability 合併成該方一份集合
- [ ] `.$foo.drawio.bkp` 與 `foo.bkp` 放進 project 目錄時被排除，且出現在回報的「已排除」清單裡
- [ ] 一份不帶 `openapi`／`swagger` 的 `.json` 被列進「已排除」並註明原因，不靜默略過
- [ ] spec 目錄名多一個不在泳道名內的（如 `acme/`）時報錯，訊息列出泳道名集合與 spec 目錄名集合
- [ ] 三態逐一有測試：目錄不存在＝照跑無 `partyChain`；目錄存在無可用檔＝中止；手動指定＝忽略發現結果
- [ ] `0714` 專案（`workspace/spec/` 底下無對應目錄）跑 `f2w-breakdown` 仍產出不帶 `partyChain` 的 `workitems.json`

## Blocked by

- T1（泳道名是子集檢查的對照）
