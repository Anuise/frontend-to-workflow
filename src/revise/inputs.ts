import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  REVISIONS_ARCHIVE_FILE,
  REVISIONS_FILE,
  type Revision,
  loadRevisionsFile,
  parseRevisions,
} from "../contracts/revisions";
import { type Workflow, loadWorkflow } from "../contracts/workflow";
import { type Workitems, loadWorkitems } from "../contracts/workitems";
import { requireContract } from "../prerequisites";

/** 修訂檔在 workspace/ 底下的子目錄名——與權責泳道圖、Vendor spec 同屬「人提供給管線的東西」。 */
export const REVISIONS_DIR = "revisions";

/** workspace/revisions/<project>/revisions.json 的路徑。 */
export function revisionsPath(workspaceRoot: string, project: string): string {
  return join(workspaceRoot, REVISIONS_DIR, project, REVISIONS_FILE);
}

/** workspace/revisions/<project>/revisions.archive.json 的路徑（`--prune` 搬過去的地方）。 */
export function revisionsArchivePath(workspaceRoot: string, project: string): string {
  return join(workspaceRoot, REVISIONS_DIR, project, REVISIONS_ARCHIVE_FILE);
}

/**
 * 讀回某專案累積的修訂；缺檔回空陣列（修訂是可選的）。
 * **不讀 revisions.archive.json**——在這裡過濾會讓乾跑與上游看到不同輸入（見 ADR-0017）。
 */
export function loadProjectRevisions(workspaceRoot: string, project: string): Revision[] {
  return loadRevisionsFile(revisionsPath(workspaceRoot, project));
}

/**
 * 把新的幾筆修訂 append 到累積陣列的尾端並落檔。
 * 檔案是 append-only 的累積陣列（越後面越新），同一欄位改第二次時舊的那筆仍留著——
 * 使用者看得出調整過幾次、每次的理由。整份通過驗證才寫，否則丟錯且不落地。
 * 回傳寫到哪，以及落檔後的完整修訂集（乾跑要套的就是這一份）。
 */
export function appendRevisions(
  workspaceRoot: string,
  project: string,
  additions: readonly unknown[],
): { path: string; all: Revision[] } {
  const path = revisionsPath(workspaceRoot, project);
  const all = parseRevisions([...loadRevisionsFile(path), ...additions]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  return { path, all };
}

/**
 * f2w-revise（target 為 workflow）的前置入口：確認 f2w-describe 的產出已存在並讀回。
 * 缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-describe。
 */
export function loadWorkflowForRevise(outputRoot: string, project: string): Workflow {
  return loadWorkflow(requireContract(outputRoot, project, "workflow"));
}

/**
 * f2w-revise（target 為 workitems）的前置入口：確認 f2w-breakdown 的產出已存在並讀回。
 * 缺件即丟 MissingPrerequisiteError，訊息提示先跑 f2w-breakdown。
 */
export function loadWorkitemsForRevise(outputRoot: string, project: string): Workitems {
  return loadWorkitems(requireContract(outputRoot, project, "workitems"));
}
