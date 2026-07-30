# f2w-revise T1：前端工項 id 升格為確定性推導

State: closed
Status: ready-for-agent
Created: 2026-07-30
Closed: 2026-07-30
Author: weisshung
Parent: ../spec.md

## What to build

讓前端工項的 id 在重跑 `f2w-breakdown` 之後保持不變。

現況：工項契約只要求 id 非空且全域唯一。實測資料裡的 `FE-01-01` 是 AI 的習慣，不是強制。AI 重新拆、重新編號，id 就漂。

改成契約強制的確定性格式 **`FE-<頁序>-<該頁操作序>`**，兩個序號都取自 `workflow.json` 的陣列索引（頁序＝該 Page 在 `pages[]` 的位置，操作序＝該筆工項對應的 action 在該頁 `actions[]` 的位置，皆從 1 起、補零兩位）。`workflow.json` 沒變，id 必定相同。

這是 prefactor：**它本身不涉及修訂機制**，但沒有它，之後所有錨定在工項 id 上的修訂撐不過一次重拆，workitems 那半邊的修訂功能形同虛設。「先讓改變變容易，再做那個容易的改變」。

**後端 id 不受此格式約束，而且明確做不到確定性化。** `BE-<頁序>-<序>` 的「序」取決於 AI 這次推論出幾筆，每次可能不同。把後端也錨定到 action 會限縮 ADR-0002 給後端推論的自由度（後端工項刻意不與 action 一一對應），不做。這個殘餘風險必須寫進 ADR，未來遇到後端修訂變孤兒時才知道那是已知取捨、不是 bug。

## Acceptance criteria

- [x] 工項契約新增 refine：前端工項 id 必須符合 `FE-<頁序>-<該頁操作序>`，不合格式被擋下且錯誤訊息指名該筆 id
- [x] 後端工項 id 不受此格式約束（測試直接蓋到，避免未來有人順手加上去）
- [x] `buildWorkitems` 產出的前端 id 由 `workflow.json` 的陣列索引推導，不由 AI 自由發揮
- [x] 既有的五重把關全部照舊通過，包含每個 Page 前端工項數 ≥ `max(1, 該頁 actions 數)` 這條硬底線
- [x] 拿 `new_0724_AI六大模組管理平台_桃園智發會_最新版` 重跑兩次 `f2w-breakdown`，兩次的前端 id 集合完全相同
- [x] `f2w-breakdown` 的 SKILL.md 寫明前端 id 的確定性格式要求
- [x] ADR-0013 記下：為何強制格式（修訂錨定必須撐過重拆）、後端為何做不到、殘餘風險是什麼

## Blocked by

- 無，可立刻開工
