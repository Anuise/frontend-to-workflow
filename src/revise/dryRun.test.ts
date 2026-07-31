import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevisions } from "../contracts/revisions";
import { type Workflow, parseWorkflow } from "../contracts/workflow";
import { type Workitems, parseWorkitems } from "../contracts/workitems";
import { saveWorkflow } from "../describe/buildWorkflow";
import { dryRunWorkflowRevisions, dryRunWorkitemsRevisions } from "./dryRun";
import { loadWorkflowForRevise } from "./inputs";

const profile = { route: "/settings", tab: "個人資料" };

/** 一頁一個操作的 workflow：顆粒度底線 max(1, 1) = 1。 */
const workflow: Workflow = parseWorkflow({
  project: "demo",
  overview: "從首頁可前往設定頁。",
  pages: [
    {
      route: "/",
      purpose: "首頁進入點。",
      content: "歡迎訊息。",
      actions: [{ label: "前往設定", destination: profile }],
    },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名欄位。",
      actions: [],
    },
  ],
});

const workitems: Workitems = parseWorkitems({
  project: "demo",
  frontend: [
    {
      id: "FE-01-01",
      sourcePage: { route: "/" },
      title: "首頁",
      scope: "渲染。",
      acceptance: "看得到。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
    {
      id: "FE-02-01",
      sourcePage: profile,
      title: "個人資料表單",
      scope: "編輯。",
      acceptance: "可提交。",
      dependsOn: [],
      risk: "",
      inferred: false,
    },
  ],
  backend: [
    {
      id: "BE-1",
      sourcePage: profile,
      title: "儲存 API",
      scope: "持久化。",
      acceptance: "可讀回。",
      dependsOn: [],
      risk: "",
      inferred: true,
    },
  ],
});

describe("dryRunWorkflowRevisions", () => {
  it("修訂健康時回 ok、沒有孤兒", () => {
    const report = dryRunWorkflowRevisions(
      workflow,
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: profile,
          field: "purpose",
          value: "其實是 SSO 轉導的中繼頁。",
          reason: "用途寫錯。",
        },
      ]),
    );
    expect(report).toMatchObject({ target: "workflow", ok: true, orphans: [] });
  });

  it("修訂會讓契約驗證失敗時回 ok=false 與完整錯誤訊息", () => {
    const report = dryRunWorkflowRevisions(
      workflow,
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: profile,
          field: "actions",
          value: [{ label: "前往不存在的頁", destination: { route: "/ghost" } }],
          reason: "操作去向改錯了。",
        },
      ]),
    );
    expect(report.ok).toBe(false);
    expect(report.error).toContain("/ghost");
  });

  it("列出當前的孤兒修訂，指名錨在哪裡", () => {
    const report = dryRunWorkflowRevisions(
      workflow,
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: { route: "/settings", tab: "已改名的分頁" },
          field: "purpose",
          value: "上游改過 tab 名稱。",
          reason: "先前的校正。",
        },
      ]),
    );
    expect(report.ok).toBe(true);
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]).toContain("已改名的分頁");
  });

  it("不寫回任何 json：跑完乾跑後檔案內容逐字未變", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-dryrun-"));
    const path = saveWorkflow(root, "demo", workflow);
    const before = readFileSync(path, "utf8");
    dryRunWorkflowRevisions(
      loadWorkflowForRevise(root, "demo"),
      parseRevisions([
        {
          target: "workflow",
          op: "set",
          anchor: profile,
          field: "purpose",
          value: "乾跑不該把這句寫進檔案。",
          reason: "驗證乾跑不落地。",
        },
      ]),
    );
    expect(readFileSync(path, "utf8")).toBe(before);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("dryRunWorkitemsRevisions", () => {
  it("修訂健康時回 ok、沒有孤兒", () => {
    const report = dryRunWorkitemsRevisions(
      workitems,
      workflow,
      parseRevisions([
        {
          target: "workitems",
          op: "set",
          anchor: "BE-1",
          field: "title",
          value: "個人資料儲存與稽核 API",
          reason: "標題要更精確。",
        },
      ]),
    );
    expect(report).toMatchObject({ target: "workitems", ok: true, orphans: [] });
  });

  it("修訂會跌破顆粒度底線時報出來", () => {
    const report = dryRunWorkitemsRevisions(
      workitems,
      workflow,
      parseRevisions([
        { target: "workitems", op: "remove", anchor: "FE-01-01", reason: "覺得多餘。" },
      ]),
    );
    expect(report.ok).toBe(false);
    expect(report.error).toContain("顆粒度不足");
  });

  it("修訂會讓契約驗證失敗時報出完整錯誤訊息", () => {
    const report = dryRunWorkitemsRevisions(
      workitems,
      workflow,
      parseRevisions([
        {
          target: "workitems",
          op: "set",
          anchor: "FE-01-01",
          field: "dependsOn",
          value: ["BE-404"],
          reason: "依賴一筆不存在的工項。",
        },
      ]),
    );
    expect(report.ok).toBe(false);
    expect(report.error).toContain("BE-404");
  });

  it("列出孤兒工項修訂（後端 id 漂掉的那種）", () => {
    const report = dryRunWorkitemsRevisions(
      workitems,
      workflow,
      parseRevisions([
        {
          target: "workitems",
          op: "set",
          anchor: "BE-99",
          field: "title",
          value: "重跑後這個 id 已經不存在。",
          reason: "後端 id 漂掉。",
        },
      ]),
    );
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]).toContain("BE-99");
  });
});
