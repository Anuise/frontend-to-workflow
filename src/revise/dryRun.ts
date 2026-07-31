import {
  type PartyChainInputs,
  canonicalizeSourcePages,
  checkPartyChains,
  checkWorkitemsConsistency,
} from "../breakdown/buildWorkitems";
import { pageIdKey } from "../contracts/page";
import { OVERVIEW_ANCHOR, type Revision, type RevisionTarget } from "../contracts/revisions";
import { type Workflow, parseWorkflow } from "../contracts/workflow";
import { type Workitems, parsePartyLegLabel, parseWorkitems } from "../contracts/workitems";
import { checkWorkflowDestinations } from "../describe/buildWorkflow";
import { applyWorkflowRevisions, applyWorkitemsRevisions, foldRevisions } from "./applyRevisions";
import { partitionSuperseded } from "./prune";

/**
 * 修訂的可機讀分類計數。
 * - `effective`：有效修訂集大小（同作用點只留最後一筆之後剩下的筆數）——「我的校正現在還有幾筆錨得住」。
 * - `superseded`：同作用點被後寫覆蓋的歷史，唯一**可證明**過時的一類（`--prune` 只搬這一類）。
 * - `noop`：有效但 value 與當前 json 逐字相同。**不可證明過時**——它多半正是「修訂已成功套上」的證據。
 * - `orphan`：錨到當前產出裡不存在的東西。也不可證明**永久**過時（上游改回來它就活了）。
 * `noop` 與 `orphan` 都是 `effective` 的子集；`effective` 與 `superseded` 用各自的來源判定
 * （前者是套用真的用哪幾筆、後者是 `--prune` 真的搬哪幾筆），不保證加總等於總筆數。
 */
export interface RevisionCounts {
  effective: number;
  superseded: number;
  noop: number;
  orphan: number;
}

/**
 * 乾跑的回報：把累積的修訂套到當前產出上會發生什麼。
 * 乾跑**不寫回任何 json**——它的用途是讓使用者講完話的當下就知道這批修訂會不會炸，
 * 不必等一次昂貴的上游重跑。
 */
export interface DryRunReport {
  target: RevisionTarget;
  /** 套用後是否通過契約驗證與（workitems 的）參照／顆粒度把關。 */
  ok: boolean;
  /** 不過時的完整錯誤訊息。 */
  error?: string;
  /** 當前的孤兒修訂清單，指名錨在哪裡。 */
  orphans: string[];
  /** 可機讀分類計數，含有效修訂集大小。 */
  counts: RevisionCounts;
}

/** 深比較用的正規化字串（兩邊都是同一支 schema 出來的形狀，欄序穩定）。 */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 一筆 workflow 修訂的 value 是否與當前 workflow 逐字相同。 */
function isWorkflowNoop(workflow: Workflow, r: Revision): boolean {
  if (r.op !== "set" || r.target !== "workflow") return false;
  if (r.anchor === OVERVIEW_ANCHOR) return same(workflow.overview, r.value);
  const page = workflow.pages.find((p) => pageIdKey(p) === pageIdKey(r.anchor));
  if (!page) return false;
  if (r.field === "purpose") return same(page.purpose, r.value);
  if (r.field === "content") return same(page.content, r.value);
  if (r.field === "actions") return same(page.actions, r.value);
  return false;
}

/** 一筆 workitems 修訂的 value 是否與當前 workitems 逐字相同。 */
function isWorkitemsNoop(workitems: Workitems, r: Revision): boolean {
  if (r.target !== "workitems" || r.op === "remove") return false;
  const { itemId, legIndex } = parsePartyLegLabel(r.anchor);
  const item = [...workitems.frontend, ...workitems.backend].find((i) => i.id === itemId);
  if (!item) return false;
  if (r.op === "upsert") return same(item, r.value);
  if (legIndex === undefined) {
    if (r.field === "partyChain") return same(item.partyChain, r.value);
    return same((item as Record<string, unknown>)[r.field], r.value);
  }
  const leg = (item.partyChain ?? [])[legIndex - 1];
  if (leg === undefined) return false;
  if (r.field === "partyChain") return same(leg, r.value[0]);
  return same((leg as Record<string, unknown>)[r.field], r.value);
}

/** 把「全部修訂」與「這一輪的孤兒」摺成四種分類計數。 */
function countRevisions(
  all: readonly Revision[],
  orphans: readonly string[],
  isNoop: (r: Revision) => boolean,
): RevisionCounts {
  // effective 走 applyRevisions 的摺疊（套用真的用哪幾筆）；
  // superseded 走 prune 的判定（--prune 真的會搬哪幾筆）。兩者刻意用各自的來源函式，
  // 否則報告說「1 筆過時」而 --prune 一筆也沒搬。upsert／remove 共用作用點的那幾筆
  // 兩邊都不算，所以兩個數字不保證加總等於總筆數。
  const effective = foldRevisions(all);
  return {
    effective: effective.length,
    superseded: partitionSuperseded(all).superseded.length,
    noop: effective.filter(isNoop).length,
    orphan: orphans.length,
  };
}

/**
 * workflow 側的乾跑：套上修訂、驗操作去向與契約，回報結果、孤兒清單與分類計數。
 * 呼叫的是與 f2w-describe 同一支 applyWorkflowRevisions——兩份實作會漂，
 * 乾跑報「沒問題」而上游實際套出來炸掉比沒有乾跑更糟（見 ADR-0012）。
 */
export function dryRunWorkflowRevisions(
  workflow: Workflow,
  revisions: readonly Revision[],
): DryRunReport {
  const mine = revisions.filter((r) => r.target === "workflow");
  const { result, warnings } = applyWorkflowRevisions(workflow, revisions);
  const counts = countRevisions(mine, warnings, (r) => isWorkflowNoop(workflow, r));
  try {
    checkWorkflowDestinations(result);
    parseWorkflow(result);
  } catch (e) {
    return { target: "workflow", ok: false, error: (e as Error).message, orphans: warnings, counts };
  }
  return { target: "workflow", ok: true, orphans: warnings, counts };
}

/**
 * workitems 側的乾跑：套上修訂、跑參照與顆粒度底線把關與契約，回報結果、孤兒清單與分類計數。
 * 需要 workflow 是因為顆粒度底線 `max(1, 該頁 actions 數)` 的來源是 workflow.json。
 * 呼叫的是與 f2w-breakdown 同一支 applyWorkitemsRevisions、checkWorkitemsConsistency、
 * checkPartyChains 與 canonicalizeSourcePages——**含套用之後的正規化與鏈硬底線**，
 * 否則兩邊會分岔（ADR-0012:35）：一筆把方序列改成非宣告鏈的 `set partyChain` 會乾跑報綠、
 * 下次重跑 f2w-breakdown 才炸。`partyInputs` 不給時不校鏈（沒有宣告鏈可對照）。
 */
export function dryRunWorkitemsRevisions(
  workitems: Workitems,
  workflow: Workflow,
  revisions: readonly Revision[],
  partyInputs: PartyChainInputs = {},
): DryRunReport {
  const mine = revisions.filter((r) => r.target === "workitems");
  const { result, warnings } = applyWorkitemsRevisions(workitems, revisions);
  const counts = countRevisions(mine, warnings, (r) => isWorkitemsNoop(workitems, r));
  try {
    checkWorkitemsConsistency(workflow, result);
    // 沒給宣告鏈就沒有東西可對照——這時跳過鏈硬底線，而不是把每筆都判成違規。
    // f2w-breakdown 那側不跳過：它一定拿得到發現結果，缺宣告鏈本身就是該報的狀況。
    if (partyInputs.declaredChains?.length) checkPartyChains(result, partyInputs);
    parseWorkitems(canonicalizeSourcePages(workflow, result));
  } catch (e) {
    return {
      target: "workitems",
      ok: false,
      error: (e as Error).message,
      orphans: warnings,
      counts,
    };
  }
  return { target: "workitems", ok: true, orphans: warnings, counts };
}
