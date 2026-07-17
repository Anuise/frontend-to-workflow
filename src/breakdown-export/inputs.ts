import { type Workitems, loadWorkitems } from "../contracts/workitems";
import { requireContract } from "../prerequisites";

/**
 * f2w-breakdown-export 的前置入口：確認 f2w-breakdown 的產出 workitems.json 已存在，
 * 讀回並驗證後回傳 Workitems。缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown。
 * 回傳的 Workitems 是 workitems.xlsx 每列的來源：前端與後端 Work item 的內容型欄位。
 */
export function loadWorkitemsForExport(outputRoot: string, project: string): Workitems {
  const path = requireContract(outputRoot, project, "workitems");
  return loadWorkitems(path);
}
