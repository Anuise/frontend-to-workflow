import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import {
  BACKEND_COLUMNS,
  BACKEND_SHEET,
  buildWorkitemsWorkbook,
} from "../src/breakdown-export";
import { discoverPartyInputs } from "../src/breakdown";
import { loadWorkitems } from "../src/contracts/workitems";
import { contractPath } from "../src/output";
import {
  applyWorkitemsRevisions,
  dryRunWorkflowRevisions,
  dryRunWorkitemsRevisions,
  loadProjectRevisions,
  loadWorkflowForRevise,
  loadWorkitemsForRevise,
  pruneProjectRevisions,
} from "../src/revise";

// new_0724 實跑驅動：f2w-revise 的乾跑體檢與 --prune。
// 本檔只驅動、不扛政策——修訂內容由 workspace/revisions/<project>/revisions.json 承載。
const OUTPUT_ROOT = "output";
const WORKSPACE_ROOT = "workspace";
const PROJECT = "new_0724_AI六大模組管理平台_桃園智發會_最新版";
const LEGACY_PROJECT = "AI六大模組管理平台_桃園智發會_0714";
const SPEC_ROOT = "workspace/spec";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

test("f2w-revise 乾跑：兩側都綠、孤兒 0 筆，分類計數對得上", () => {
  const revisions = loadProjectRevisions(WORKSPACE_ROOT, PROJECT);
  const workflow = loadWorkflowForRevise(OUTPUT_ROOT, PROJECT);
  const workitems = loadWorkitemsForRevise(OUTPUT_ROOT, PROJECT);

  const wf = dryRunWorkflowRevisions(workflow, revisions);
  // 乾跑也要吃派工輸入，鏈硬底線才會跑在乾跑那側（否則 set partyChain 改壞了要等重跑才炸）。
  const party = discoverPartyInputs(SPEC_ROOT, PROJECT);
  const wi = dryRunWorkitemsRevisions(workitems, workflow, revisions, party);
  for (const report of [wf, wi]) {
    console.log(
      `${report.target}：ok=${report.ok} 有效=${report.counts.effective} superseded=${report.counts.superseded} no-op=${report.counts.noop} 孤兒=${report.counts.orphan}`,
    );
    if (!report.ok) console.error(report.error);
    expect(report.ok).toBe(true);
    expect(report.orphans).toEqual([]);
  }

  // 兩側的分類計數加起來就是整份檔的樣貌。
  const total =
    wf.counts.effective + wf.counts.superseded + wi.counts.effective + wi.counts.superseded;
  expect(total).toBe(revisions.length);
  expect(wf.counts.effective + wi.counts.effective).toBe(111);
  expect(wf.counts.superseded + wi.counts.superseded).toBe(revisions.length - 111);
});

test("f2w-revise --prune：只搬 superseded，套用結果雜湊不變", () => {
  const before = loadProjectRevisions(WORKSPACE_ROOT, PROJECT);
  const workitems = loadWorkitemsForRevise(OUTPUT_ROOT, PROJECT);
  const appliedBefore = hash(applyWorkitemsRevisions(workitems, before).result);

  const result = pruneProjectRevisions(WORKSPACE_ROOT, PROJECT);
  console.log(`prune：搬走 ${result.archived.length} 筆，留下 ${result.kept.length} 筆`);

  // 重跑本 driver 時已經 prune 過，所以釘住的是終態：有效集 111 筆。
  const after = loadProjectRevisions(WORKSPACE_ROOT, PROJECT);
  expect(after).toHaveLength(111);
  expect(before.length - after.length).toBe(result.archived.length);

  // upsert 與 remove 一筆都沒被搬走（BE-EXTRA-01／BE-EXTRA-02 留在 revisions.json）。
  expect(result.archived.every((r) => r.op === "set")).toBe(true);
  const upserts = after.filter((r) => r.op === "upsert").map((r) => r.anchor);
  expect(upserts).toEqual(["BE-EXTRA-01", "BE-EXTRA-02"]);

  // prune 買的是體積與可讀性，不買正確性——套用結果逐字相同。
  expect(hash(applyWorkitemsRevisions(workitems, after).result)).toBe(appliedBefore);
});

test("0714 不改一個字通過新契約，匯出仍是一工項一列", () => {
  const workitems = loadWorkitems(contractPath(OUTPUT_ROOT, LEGACY_PROJECT, "workitems"));
  expect(workitems.frontend).toHaveLength(94);
  expect(workitems.backend).toHaveLength(19);
  expect(workitems.backend.every((i) => i.partyChain === undefined)).toBe(true);

  // 只在記憶體組，不落檔——0714 刻意不重跑。
  const wb = buildWorkitemsWorkbook(workitems);
  const backend = wb.getWorksheet(BACKEND_SHEET)!;
  expect(backend.rowCount - 1).toBe(19);
  const header = (backend.getRow(1).values as unknown[]).slice(1).map(String);
  expect(header).toEqual([...BACKEND_COLUMNS]); // 沒有分工欄
});
