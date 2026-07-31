import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type Revision, loadRevisionsFile, parseRevisions } from "../contracts/revisions";
import { actionPoint } from "./applyRevisions";
import { revisionsArchivePath, revisionsPath } from "./inputs";

/** `--prune` 的結果：搬走了哪些、留下哪些、寫到哪兩個檔。 */
export interface PruneResult {
  revisionsPath: string;
  archivePath: string;
  kept: Revision[];
  archived: Revision[];
}

/**
 * 把修訂切成「留下」與「同作用點被後寫覆蓋（superseded）」兩堆。
 *
 * 判定逐字沿用 applyRevisions 的 `actionPoint`：同一個 `(target, anchor, field)` 出現多次時，
 * 只有陣列中**最後**那一筆會生效，前面的都是歷史。
 *
 * `upsert` 與 `remove` **不參與**摺疊——`actionPoint` 讓兩者共用同一個作用點，
 * 搬走 upsert 會廢掉 ADR-0012:29 認可的唯一放棄途徑（見 ADR-0017）。
 */
export function partitionSuperseded(revisions: readonly Revision[]): {
  kept: Revision[];
  superseded: Revision[];
} {
  const lastIndexByPoint = new Map<string, number>();
  revisions.forEach((r, i) => {
    if (r.op === "set") lastIndexByPoint.set(actionPoint(r), i);
  });
  const kept: Revision[] = [];
  const superseded: Revision[] = [];
  revisions.forEach((r, i) => {
    if (r.op === "set" && lastIndexByPoint.get(actionPoint(r)) !== i) superseded.push(r);
    else kept.push(r);
  });
  return { kept, superseded };
}

function writeRevisionsFile(path: string, revisions: readonly Revision[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(revisions, null, 2)}\n`, "utf8");
}

/**
 * `f2w-revise --prune`：把**可證明過時**的那一類搬進 revisions.archive.json，
 * revisions.json 只留有效修訂集。**搬檔不是刪除**——archive 就是還原路徑（把那一筆搬回去）。
 *
 * 只搬 superseded。no-op 與孤兒**一律只報告、不動手**：
 * no-op 不可證明過時（它多半正是修訂已成功套上的證據），孤兒不可證明**永久**過時
 * （上游 tab 命名改回來它就活了，見 ADR-0012:41）。
 *
 * 搬走的都是不生效的筆，所以 prune 前後套用結果逐字相同——它買的是體積與可讀性，**不買正確性**。
 */
export function pruneProjectRevisions(workspaceRoot: string, project: string): PruneResult {
  const path = revisionsPath(workspaceRoot, project);
  const archivePath = revisionsArchivePath(workspaceRoot, project);
  const { kept, superseded } = partitionSuperseded(loadRevisionsFile(path));
  if (superseded.length) {
    // 既有 archive 在前、這次搬的在後——archive 也是 append-only 的累積陣列。
    writeRevisionsFile(
      archivePath,
      parseRevisions([...loadRevisionsFile(archivePath), ...superseded]),
    );
    writeRevisionsFile(path, kept);
  }
  return { revisionsPath: path, archivePath, kept, archived: superseded };
}
