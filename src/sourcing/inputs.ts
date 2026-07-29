import { type Workitems, loadWorkitems } from "../contracts/workitems";
import { requireContract } from "../prerequisites";

/**
 * f2w-sourcing 的前置入口：確認 f2w-breakdown 的產出 workitems.json 已存在，
 * 讀回並驗證後回傳 Workitems。缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown。
 * 回傳的 backend 陣列就是要逐筆定來源決策的對象；frontend 原封帶著待複製。
 */
export function loadWorkitemsForSourcing(outputRoot: string, project: string): Workitems {
  const path = requireContract(outputRoot, project, "workitems");
  return loadWorkitems(path);
}
