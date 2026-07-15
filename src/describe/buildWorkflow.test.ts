import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Pages } from "../contracts/pages";
import { ContractValidationError } from "../contracts/validate";
import { loadWorkflow } from "../contracts/workflow";
import { contractPath } from "../output";
import {
  type PageDescription,
  WorkflowConsistencyError,
  buildWorkflow,
  saveWorkflow,
} from "./buildWorkflow";

const pages: Pages = {
  project: "demo",
  pages: [
    { route: "/", screenshot: "index.png" },
    { route: "/settings", tab: "個人資料", screenshot: "settings-profile.png" },
  ],
};

const overview = "從首頁可前往設定頁編輯個人資料。";

const descriptions: PageDescription[] = [
  {
    route: "/",
    purpose: "首頁，是整個前端的進入點。",
    content: "顯示歡迎訊息與前往設定的連結。",
    actions: [
      { label: "前往設定", destination: { route: "/settings", tab: "個人資料" } },
      { label: "捲動頁面", destination: null },
    ],
  },
  {
    route: "/settings",
    tab: "個人資料",
    purpose: "編輯使用者的個人資料。",
    content: "顯示姓名與 Email 欄位。",
    actions: [{ label: "返回首頁", destination: { route: "/" } }],
  },
];

describe("buildWorkflow", () => {
  it("接合逐頁描述與 pages.json，回傳含 Overview 的合法 Workflow", () => {
    const w = buildWorkflow(pages, overview, descriptions);
    expect(w.project).toBe("demo");
    expect(w.overview).toBe(overview);
    expect(w.pages).toHaveLength(2);
    // route/tab 取自 pages.json（單一真實來源）
    expect(w.pages[0]).toMatchObject({ route: "/", purpose: "首頁，是整個前端的進入點。" });
    expect(w.pages[1]).toMatchObject({ route: "/settings", tab: "個人資料" });
    // 操作去向：指向真實 Page，或 null（停留原頁）
    expect(w.pages[0]?.actions[0]?.destination).toEqual({ route: "/settings", tab: "個人資料" });
    expect(w.pages[0]?.actions[1]?.destination).toBeNull();
  });

  it("涵蓋：有截到的 Page 未被描述時丟 WorkflowConsistencyError", () => {
    const call = () => buildWorkflow(pages, overview, [descriptions[0]!]);
    expect(call).toThrow(WorkflowConsistencyError);
    expect(call).toThrow(/\/settings/);
  });

  it("涵蓋：描述了未截到的 Page 時丟 WorkflowConsistencyError", () => {
    const extra: PageDescription = {
      route: "/ghost",
      purpose: "不存在的頁",
      content: "x",
      actions: [],
    };
    const call = () => buildWorkflow(pages, overview, [...descriptions, extra]);
    expect(call).toThrow(WorkflowConsistencyError);
    expect(call).toThrow(/\/ghost/);
  });

  it("去向：操作去向指向未截到的 Page 時丟 WorkflowConsistencyError", () => {
    const bad = descriptions.map((d) => ({ ...d, actions: [...d.actions] }));
    bad[0]!.actions = [{ label: "前往不存在的頁", destination: { route: "/nope" } }];
    const call = () => buildWorkflow(pages, overview, bad);
    expect(call).toThrow(WorkflowConsistencyError);
    expect(call).toThrow(/\/nope/);
  });

  it("契約：空 overview 或空 purpose 冒泡為 ContractValidationError", () => {
    expect(() => buildWorkflow(pages, "", descriptions)).toThrow(ContractValidationError);
    const blankPurpose = descriptions.map((d, i) => (i === 0 ? { ...d, purpose: "" } : d));
    expect(() => buildWorkflow(pages, overview, blankPurpose)).toThrow(ContractValidationError);
  });
});

describe("saveWorkflow", () => {
  it("驗證後寫出 workflow.json，可被 loadWorkflow 讀回", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-desc-save-"));
    const w = buildWorkflow(pages, overview, descriptions);
    const path = saveWorkflow(root, "demo", w);
    expect(path).toBe(contractPath(root, "demo", "workflow"));
    expect(loadWorkflow(path)).toEqual(w);
    rmSync(root, { recursive: true, force: true });
  });

  it("不合契約時丟 ContractValidationError 且不落地任何檔案", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-desc-save-"));
    const path = contractPath(root, "demo", "workflow");
    expect(() => saveWorkflow(root, "demo", { project: "demo", overview: "", pages: [] })).toThrow(
      ContractValidationError,
    );
    expect(existsSync(path)).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
