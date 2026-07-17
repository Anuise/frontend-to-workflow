import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContractValidationError } from "../contracts/validate";
import { type Workflow, loadWorkflow, parseWorkflow } from "../contracts/workflow";
import { loadWorkitems } from "../contracts/workitems";
import { contractPath } from "../output";
import {
  type WorkItemInput,
  WorkitemsConsistencyError,
  buildWorkitems,
  saveWorkitems,
} from "./buildWorkitems";

const workflow: Workflow = parseWorkflow({
  project: "demo",
  overview: "從首頁可前往設定頁編輯個人資料。",
  pages: [
    { route: "/", purpose: "首頁進入點。", content: "歡迎訊息與連結。", actions: [] },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名與 Email 欄位。",
      actions: [],
    },
  ],
});

const frontendItems: WorkItemInput[] = [
  {
    id: "FE-1",
    sourcePage: { route: "/" },
    title: "首頁",
    scope: "渲染歡迎訊息與連結。",
    acceptance: "能看到連結。",
    dependsOn: [],
    risk: "",
  },
  {
    id: "FE-2",
    sourcePage: { route: "/settings", tab: "個人資料" },
    title: "個人資料表單",
    scope: "顯示並編輯姓名與 Email。",
    acceptance: "可提交合法值。",
    dependsOn: ["FE-1"],
    risk: "",
  },
];

const backendItems: WorkItemInput[] = [
  {
    id: "BE-1",
    sourcePage: { route: "/settings", tab: "個人資料" },
    title: "個人資料儲存 API",
    scope: "接收並持久化個人資料。",
    acceptance: "提交後可讀回。",
    dependsOn: ["FE-2"],
    risk: "",
  },
];

describe("buildWorkitems", () => {
  it("組出合法 workitems；前端 inferred=false、後端 inferred=true 由陣列決定", () => {
    const w = buildWorkitems(workflow, frontendItems, backendItems);
    expect(w.project).toBe("demo");
    expect(w.frontend).toHaveLength(2);
    expect(w.backend).toHaveLength(1);
    expect(w.frontend.every((i) => i.inferred === false)).toBe(true);
    expect(w.backend.every((i) => i.inferred === true)).toBe(true);
    expect(w.frontend[1]?.sourcePage).toEqual({ route: "/settings", tab: "個人資料" });
  });

  it("涵蓋：有 Page 無任何前端工項時丟 WorkitemsConsistencyError", () => {
    const call = () => buildWorkitems(workflow, [frontendItems[0]!], backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/settings/);
  });

  it("參照：sourcePage 不存在於 workflow.pages 時丟 WorkitemsConsistencyError", () => {
    const bad: WorkItemInput = { ...frontendItems[0]!, id: "FE-X", sourcePage: { route: "/ghost" } };
    const call = () => buildWorkitems(workflow, [...frontendItems, bad], backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/ghost/);
  });

  it("參照：dependsOn 指向不存在的工項 id 時丟 WorkitemsConsistencyError", () => {
    const bad = frontendItems.map((i) => (i.id === "FE-2" ? { ...i, dependsOn: ["FE-404"] } : i));
    const call = () => buildWorkitems(workflow, bad, backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/FE-404/);
  });

  it("契約：空 title 冒泡 ContractValidationError", () => {
    const bad = frontendItems.map((i) => (i.id === "FE-1" ? { ...i, title: "" } : i));
    expect(() => buildWorkitems(workflow, bad, backendItems)).toThrow(ContractValidationError);
  });

  it("契約：id 跨前後端重複時冒泡 ContractValidationError", () => {
    const dupBackend = backendItems.map((i) => ({ ...i, id: "FE-1" }));
    expect(() => buildWorkitems(workflow, frontendItems, dupBackend)).toThrow(
      ContractValidationError,
    );
  });

  it("端到端（真實 fixtures）：讀 workflow.json 後可組出涵蓋所有 Page 的 workitems", () => {
    const wf = loadWorkflow(join(process.cwd(), "fixtures/contracts/workflow.json"));
    const fe: WorkItemInput[] = wf.pages.map((p, idx) => ({
      id: `FE-${idx + 1}`,
      sourcePage: p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab },
      title: `工項 ${idx + 1}`,
      scope: "範疇。",
      acceptance: "驗收。",
      dependsOn: [],
      risk: "",
    }));
    const w = buildWorkitems(wf, fe, []);
    expect(w.frontend).toHaveLength(wf.pages.length);
    expect(w.backend).toHaveLength(0);
  });
});

describe("saveWorkitems", () => {
  it("驗證後寫出 workitems.json，可被 loadWorkitems 讀回", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-save-"));
    const w = buildWorkitems(workflow, frontendItems, backendItems);
    const path = saveWorkitems(root, "demo", w);
    expect(path).toBe(contractPath(root, "demo", "workitems"));
    expect(loadWorkitems(path)).toEqual(w);
    rmSync(root, { recursive: true, force: true });
  });

  it("不合契約時丟 ContractValidationError 且不落地任何檔案", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-save-"));
    const path = contractPath(root, "demo", "workitems");
    expect(() =>
      saveWorkitems(root, "demo", { project: "", frontend: [], backend: [] }),
    ).toThrow(ContractValidationError);
    expect(existsSync(path)).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
