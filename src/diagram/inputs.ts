import { existsSync } from "node:fs";
import { type Mainflow, loadMainflow } from "../contracts/mainflow";
import { type Workflow, loadWorkflow } from "../contracts/workflow";
import { CONTRACT_FILES, contractPath } from "../output";
import { requireContract, requirePrerequisite } from "../prerequisites";

/**
 * f2w-diagram 的前置入口：確認 f2w-describe 的 workflow.json 已存在，讀回並驗證後回傳。
 * 缺 workflow.json 丟 MissingPrerequisiteError，提示先跑 f2w-describe。
 * 節點與邊的素材全部來自 Page 與其「操作去向」，不需截圖。
 */
export function loadWorkflowForDiagram(outputRoot: string, project: string): Workflow {
  return loadWorkflow(requireContract(outputRoot, project, "workflow"));
}

/** mainflow.json（主線推論交接檔）的路徑。 */
export function mainflowPath(outputRoot: string, project: string): string {
  return contractPath(outputRoot, project, "mainflow");
}

/** mainflow.json 是否已存在——已存在就沿用手改後的版本，不重推論。 */
export function hasMainflow(outputRoot: string, project: string): boolean {
  return existsSync(mainflowPath(outputRoot, project));
}

/**
 * 讀回並驗證 mainflow.json。缺檔丟 MissingPrerequisiteError——
 * 它由 f2w-diagram 的主線推論寫出（也可以自己手寫一份），純函式這一側不做推論。
 */
export function loadMainflowForDiagram(outputRoot: string, project: string): Mainflow {
  const path = mainflowPath(outputRoot, project);
  requirePrerequisite({
    path,
    file: CONTRACT_FILES.mainflow,
    previousStep: "f2w-diagram 的主線推論",
  });
  return loadMainflow(path);
}
