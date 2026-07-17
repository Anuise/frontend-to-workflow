import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { saveWorkflow } from "../describe/buildWorkflow";
import { MissingPrerequisiteError } from "../prerequisites";
import { loadWorkflowForBreakdown } from "./inputs";

const workflow = {
  project: "demo",
  overview: "從首頁可前往設定頁。",
  pages: [{ route: "/", purpose: "首頁。", content: "連結。", actions: [] }],
};

describe("loadWorkflowForBreakdown", () => {
  it("缺 workflow.json 時丟 MissingPrerequisiteError，訊息提示先跑 f2w-describe", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-in-"));
    const call = () => loadWorkflowForBreakdown(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });

  it("workflow.json 存在時讀回並驗證 Workflow", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-in-"));
    saveWorkflow(root, "demo", workflow);
    const w = loadWorkflowForBreakdown(root, "demo");
    expect(w.project).toBe("demo");
    expect(w.pages).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });
});
