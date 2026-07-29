import { type Workflow, loadWorkflow } from "../contracts/workflow";
import { requireContract } from "../prerequisites";

/**
 * f2w-bpmn 的前置入口：確認 f2w-describe 的 workflow.json 已存在，讀回並驗證後回傳。
 * 缺 workflow.json 丟 MissingPrerequisiteError，提示先跑 f2w-describe。
 * 本步只需 workflow.json——Navigation diagram 的節點與邊全部來自 Page 與其「操作去向」，不需截圖。
 */
export function loadWorkflowForBpmn(outputRoot: string, project: string): Workflow {
  return loadWorkflow(requireContract(outputRoot, project, "workflow"));
}
