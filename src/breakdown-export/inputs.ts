import { existsSync } from "node:fs";
import { type SourcedWorkitems, loadSourcedWorkitems } from "../contracts/sourcedWorkitems";
import { type Workitems, loadWorkitems } from "../contracts/workitems";
import { contractPath } from "../output";
import { requireContract } from "../prerequisites";

/**
 * workitems.xlsx 的來源：純自建專案是 workitems.json，插過 f2w-sourcing 的是 workitems-sourced.json。
 * 兩者的內容型欄位相同，sourced 版的 backend 每筆多帶來源決策欄位。
 */
export type ExportWorkitems = Workitems | SourcedWorkitems;

/**
 * f2w-breakdown-export 的前置入口：sourced 檔在就優先讀（見 ADR-0004），不在才退回 workitems.json。
 * 兩者都缺即丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown。
 * 回傳值是 workitems.xlsx 每列的來源：前端與後端 Work item 的內容型欄位（sourced 版另含來源決策）。
 */
export function loadWorkitemsForExport(outputRoot: string, project: string): ExportWorkitems {
  const sourcedPath = contractPath(outputRoot, project, "workitemsSourced");
  if (existsSync(sourcedPath)) {
    return loadSourcedWorkitems(sourcedPath);
  }
  return loadWorkitems(requireContract(outputRoot, project, "workitems"));
}

/** 這批工項是否帶來源決策（sourced 版的 backend 每筆都有 sourcing）。 */
export function isSourcedWorkitems(
  workitems: ExportWorkitems,
): workitems is SourcedWorkitems {
  return workitems.backend.some((item) => "sourcing" in item);
}
