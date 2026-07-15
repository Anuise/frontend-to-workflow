import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContractValidationError } from "./validate";
import { loadWorkflow, parseWorkflow } from "./workflow";

const validWorkflow = {
  project: "sample-frontend",
  overview: "示範純前端專案的整體使用者流程：從首頁出發，可前往關於頁與設定頁。",
  pages: [
    {
      route: "/",
      purpose: "首頁，作為整個前端的進入點。",
      content: "顯示歡迎訊息與主要導覽連結。",
      actions: [
        { label: "前往設定", destination: { route: "/settings", tab: "個人資料" } },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "顯示姓名與 Email 欄位。",
      actions: [{ label: "返回首頁", destination: { route: "/" } }],
    },
  ],
};

describe("parseWorkflow", () => {
  it("接受合法 workflow（含 Overview、操作去向、可停留原頁的 null 去向）", () => {
    const w = parseWorkflow(validWorkflow);
    expect(w.overview.length).toBeGreaterThan(0);
    expect(w.pages[0]?.actions[0]?.destination).toEqual({ route: "/settings", tab: "個人資料" });
    expect(w.pages[0]?.actions[1]?.destination).toBeNull();
  });

  it("拒絕缺 overview、缺 purpose、缺 action label、重複 Page", () => {
    const invalid: unknown[] = [
      { ...validWorkflow, overview: "" },
      { ...validWorkflow, pages: [{ route: "/", content: "x", actions: [] }] },
      {
        ...validWorkflow,
        pages: [{ route: "/", purpose: "p", content: "c", actions: [{ destination: null }] }],
      },
      {
        ...validWorkflow,
        pages: [
          { route: "/", purpose: "p", content: "c", actions: [] },
          { route: "/", purpose: "p2", content: "c2", actions: [] },
        ],
      },
    ];
    for (const bad of invalid) {
      expect(() => parseWorkflow(bad)).toThrow(ContractValidationError);
    }
  });
});

describe("loadWorkflow", () => {
  it("讀取並驗證手寫 fixture workflow.json", () => {
    const w = loadWorkflow(join(process.cwd(), "fixtures/contracts/workflow.json"));
    expect(w.pages.length).toBeGreaterThan(0);
    expect(w.overview.length).toBeGreaterThan(0);
  });
});
