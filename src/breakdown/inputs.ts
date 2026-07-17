import { type Workflow, loadWorkflow } from "../contracts/workflow";
import { requireContract } from "../prerequisites";

/**
 * f2w-breakdown 的前置入口：確認 f2w-describe 的產出 workflow.json 已存在，
 * 讀回並驗證後回傳 Workflow。缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-describe。
 * 回傳的 Workflow 是工項劃分的來源：逐 Page 的用途、內容與可執行操作。
 */
export function loadWorkflowForBreakdown(outputRoot: string, project: string): Workflow {
  const path = requireContract(outputRoot, project, "workflow");
  return loadWorkflow(path);
}
