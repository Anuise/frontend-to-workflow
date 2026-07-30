import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContractValidationError } from "../contracts/validate";
import { saveWorkflow } from "../describe/buildWorkflow";
import { MissingPrerequisiteError } from "../prerequisites";
import {
  appendRevisions,
  loadProjectRevisions,
  loadWorkflowForRevise,
  loadWorkitemsForRevise,
  revisionsPath,
} from "./inputs";

const PROJECT = "demo";

const setPurpose = (value: string) => ({
  target: "workflow",
  op: "set",
  anchor: { route: "/settings", tab: "個人資料" },
  field: "purpose",
  value,
  reason: "校正頁面用途。",
  at: "2026-07-30",
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "f2w-revise-inputs-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("revisionsPath", () => {
  it("落在 workspace/revisions/<project>/revisions.json，不在 output/ 底下", () => {
    expect(revisionsPath("workspace", PROJECT)).toBe(
      join("workspace", "revisions", PROJECT, "revisions.json"),
    );
  });
});

describe("appendRevisions", () => {
  it("首次落檔後讀得回來，且回傳落檔後的完整修訂集", () => {
    const { path, all } = appendRevisions(root, PROJECT, [setPurpose("第一次的說法。")]);
    expect(path).toBe(revisionsPath(root, PROJECT));
    expect(all).toHaveLength(1);
    expect(loadProjectRevisions(root, PROJECT)).toEqual(all);
  });

  it("append-only：第二次落檔保留歷史，越後面越新", () => {
    appendRevisions(root, PROJECT, [setPurpose("第一次的說法。")]);
    const { all } = appendRevisions(root, PROJECT, [setPurpose("第二次的說法。")]);
    expect(all).toHaveLength(2);
    expect(all.map((r) => (r.op === "set" ? r.value : null))).toEqual([
      "第一次的說法。",
      "第二次的說法。",
    ]);
  });

  it("新增的修訂不合契約時丟 ContractValidationError 且不落地", () => {
    expect(() => appendRevisions(root, PROJECT, [{ ...setPurpose("x"), value: 42 }])).toThrow(
      ContractValidationError,
    );
    expect(existsSync(revisionsPath(root, PROJECT))).toBe(false);
  });

  it("有一筆不合契約時整份擋下，既有檔案不被覆蓋成半套的樣子", () => {
    appendRevisions(root, PROJECT, [setPurpose("第一次的說法。")]);
    const before = readFileSync(revisionsPath(root, PROJECT), "utf8");
    expect(() => appendRevisions(root, PROJECT, [{ target: "workflow", op: "patch" }])).toThrow(
      ContractValidationError,
    );
    expect(readFileSync(revisionsPath(root, PROJECT), "utf8")).toBe(before);
  });
});

describe("loadProjectRevisions", () => {
  it("缺檔時回空陣列（修訂是可選的，沒提過修訂也能跑上游）", () => {
    expect(loadProjectRevisions(root, PROJECT)).toEqual([]);
  });
});

describe("loadWorkflowForRevise／loadWorkitemsForRevise", () => {
  it("缺 workflow.json 時丟 MissingPrerequisiteError，提示先跑 f2w-describe", () => {
    const call = () => loadWorkflowForRevise(root, PROJECT);
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-describe/);
  });

  it("缺 workitems.json 時丟 MissingPrerequisiteError，提示先跑 f2w-breakdown", () => {
    const call = () => loadWorkitemsForRevise(root, PROJECT);
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-breakdown/);
  });

  it("檔案存在時讀回並驗證", () => {
    saveWorkflow(root, PROJECT, {
      project: PROJECT,
      overview: "一頁的示範專案。",
      pages: [{ route: "/", purpose: "首頁。", content: "內容。", actions: [] }],
    });
    expect(loadWorkflowForRevise(root, PROJECT).pages).toHaveLength(1);
  });
});
