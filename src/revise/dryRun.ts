import { checkWorkitemsConsistency } from "../breakdown/buildWorkitems";
import type { Revision, RevisionTarget } from "../contracts/revisions";
import { type Workflow, parseWorkflow } from "../contracts/workflow";
import { type Workitems, parseWorkitems } from "../contracts/workitems";
import { checkWorkflowDestinations } from "../describe/buildWorkflow";
import { applyWorkflowRevisions, applyWorkitemsRevisions } from "./applyRevisions";

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
}

/**
 * workflow 側的乾跑：套上修訂、驗操作去向與契約，回報結果與孤兒清單。
 * 呼叫的是與 f2w-describe 同一支 applyWorkflowRevisions——兩份實作會漂，
 * 乾跑報「沒問題」而上游實際套出來炸掉比沒有乾跑更糟（見 ADR-0012）。
 */
export function dryRunWorkflowRevisions(
  workflow: Workflow,
  revisions: readonly Revision[],
): DryRunReport {
  const { result, warnings } = applyWorkflowRevisions(workflow, revisions);
  try {
    checkWorkflowDestinations(result);
    parseWorkflow(result);
  } catch (e) {
    return { target: "workflow", ok: false, error: (e as Error).message, orphans: warnings };
  }
  return { target: "workflow", ok: true, orphans: warnings };
}

/**
 * workitems 側的乾跑：套上修訂、跑參照與顆粒度底線把關與契約，回報結果與孤兒清單。
 * 需要 workflow 是因為顆粒度底線 `max(1, 該頁 actions 數)` 的來源是 workflow.json。
 * 呼叫的是與 f2w-breakdown 同一支 applyWorkitemsRevisions 與 checkWorkitemsConsistency。
 */
export function dryRunWorkitemsRevisions(
  workitems: Workitems,
  workflow: Workflow,
  revisions: readonly Revision[],
): DryRunReport {
  const { result, warnings } = applyWorkitemsRevisions(workitems, revisions);
  try {
    checkWorkitemsConsistency(workflow, result);
    parseWorkitems(result);
  } catch (e) {
    return { target: "workitems", ok: false, error: (e as Error).message, orphans: warnings };
  }
  return { target: "workitems", ok: true, orphans: warnings };
}
