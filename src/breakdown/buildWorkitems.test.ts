import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContractValidationError } from "../contracts/validate";
import { parseRevisions } from "../contracts/revisions";
import { type Workflow, loadWorkflow, parseWorkflow } from "../contracts/workflow";
import { frontendWorkitemId, loadWorkitems } from "../contracts/workitems";
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
    id: "FE-01-01",
    sourcePage: { route: "/" },
    title: "首頁",
    scope: "渲染歡迎訊息與連結。",
    acceptance: "能看到連結。",
    dependsOn: [],
    risk: "",
  },
  {
    id: "FE-02-01",
    sourcePage: { route: "/settings", tab: "個人資料" },
    title: "個人資料表單",
    scope: "顯示並編輯姓名與 Email。",
    acceptance: "可提交合法值。",
    dependsOn: ["FE-01-01"],
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
    dependsOn: ["FE-02-01"],
    risk: "",
  },
];

// 顆粒度底線用：單一 Page 有兩個可執行操作（停留原頁），floor = max(1, 2) = 2。
const granularityWorkflow: Workflow = parseWorkflow({
  project: "demo",
  overview: "儀表板有兩個原頁操作。",
  pages: [
    {
      route: "/dashboard",
      purpose: "儀表板。",
      content: "篩選與匯出兩個操作。",
      actions: [
        { label: "展開篩選", destination: null },
        { label: "匯出報表", destination: null },
      ],
    },
  ],
});

describe("buildWorkitems", () => {
  it("組出合法 workitems；前端 inferred=false、後端 inferred=true 由陣列決定", () => {
    const { workitems: w } = buildWorkitems(workflow, frontendItems, backendItems);
    expect(w.project).toBe("demo");
    expect(w.frontend).toHaveLength(2);
    expect(w.backend).toHaveLength(1);
    expect(w.frontend.every((i) => i.inferred === false)).toBe(true);
    expect(w.backend.every((i) => i.inferred === true)).toBe(true);
    expect(w.frontend[1]?.sourcePage).toEqual({ route: "/settings", tab: "個人資料" });
  });

  it("前端 id：未依 workflow.json 的陣列索引編號時丟 WorkitemsConsistencyError", () => {
    const misnumbered = frontendItems.map((i, n) => (n === 0 ? { ...i, id: "FE-09-09" } : i));
    const call = () => buildWorkitems(workflow, misnumbered, backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/FE-09-09（該頁第 1 筆，應為 FE-01-01）/);
  });

  it("後端 id 不受前端格式約束（自訂 id 照樣組得出來）", () => {
    const custom = backendItems.map((i) => ({ ...i, id: "BE-EXTRA-01" }));
    expect(buildWorkitems(workflow, frontendItems, custom).workitems.backend[0]?.id).toBe("BE-EXTRA-01");
  });

  it("涵蓋：有 Page 無任何前端工項時丟 WorkitemsConsistencyError", () => {
    const call = () => buildWorkitems(workflow, [frontendItems[0]!], backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/settings/);
  });

  it("顆粒度：某 Page 前端工項數少於可執行操作數時丟 WorkitemsConsistencyError", () => {
    const one: WorkItemInput = {
      id: "FE-01-01",
      sourcePage: { route: "/dashboard" },
      title: "儀表板整頁",
      scope: "把整頁一次做完。",
      acceptance: "能操作。",
      dependsOn: [],
      risk: "",
    };
    const call = () => buildWorkitems(granularityWorkflow, [one], []);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/dashboard/);
  });

  it("顆粒度：前端工項數達 max(1, actions 數) 時通過", () => {
    const mk = (n: number): WorkItemInput => ({
      id: frontendWorkitemId(0, n - 1),
      sourcePage: { route: "/dashboard" },
      title: `操作 ${n}`,
      scope: "範疇。",
      acceptance: "驗收。",
      dependsOn: [],
      risk: "",
    });
    const { workitems: w } = buildWorkitems(granularityWorkflow, [mk(1), mk(2)], []);
    expect(w.frontend).toHaveLength(2);
  });

  it("參照：sourcePage 不存在於 workflow.pages 時丟 WorkitemsConsistencyError", () => {
    const bad: WorkItemInput = { ...frontendItems[0]!, id: "FE-X", sourcePage: { route: "/ghost" } };
    const call = () => buildWorkitems(workflow, [...frontendItems, bad], backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/ghost/);
  });

  it("參照：dependsOn 指向不存在的工項 id 時丟 WorkitemsConsistencyError", () => {
    const bad = frontendItems.map((i) => (i.id === "FE-02-01" ? { ...i, dependsOn: ["FE-404"] } : i));
    const call = () => buildWorkitems(workflow, bad, backendItems);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/FE-404/);
  });

  it("契約：空 title 冒泡 ContractValidationError", () => {
    const bad = frontendItems.map((i) => (i.id === "FE-01-01" ? { ...i, title: "" } : i));
    expect(() => buildWorkitems(workflow, bad, backendItems)).toThrow(ContractValidationError);
  });

  it("契約：id 跨前後端重複時冒泡 ContractValidationError", () => {
    const dupBackend = backendItems.map((i) => ({ ...i, id: "FE-01-01" }));
    expect(() => buildWorkitems(workflow, frontendItems, dupBackend)).toThrow(
      ContractValidationError,
    );
  });

  it("端到端（真實 fixtures）：讀 workflow.json 後可組出涵蓋所有 Page 的 workitems", () => {
    const wf = loadWorkflow(join(process.cwd(), "fixtures/contracts/workflow.json"));
    // 每頁依 max(1, actions 數) 產出對應筆數，滿足逐操作顆粒度底線。
    const fe: WorkItemInput[] = wf.pages.flatMap((p, pi) => {
      const floor = Math.max(1, p.actions.length);
      const sourcePage = p.tab === undefined ? { route: p.route } : { route: p.route, tab: p.tab };
      return Array.from({ length: floor }, (_, k) => ({
        id: frontendWorkitemId(pi, k),
        sourcePage,
        title: `工項 ${pi + 1}-${k + 1}`,
        scope: "範疇。",
        acceptance: "驗收。",
        dependsOn: [],
        risk: "",
      }));
    });
    const expected = wf.pages.reduce((n, p) => n + Math.max(1, p.actions.length), 0);
    const { workitems: w } = buildWorkitems(wf, fe, []);
    expect(w.frontend).toHaveLength(expected);
    expect(w.backend).toHaveLength(0);
  });
});

describe("saveWorkitems", () => {
  it("驗證後寫出 workitems.json，可被 loadWorkitems 讀回", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-breakdown-save-"));
    const { workitems: w } = buildWorkitems(workflow, frontendItems, backendItems);
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

describe("buildWorkitems：修訂接線", () => {
  it("傳入的修訂確實被套進輸出（set 與自訂 id 的 upsert）", () => {
    const revisions = parseRevisions([
      {
        target: "workitems",
        op: "set",
        anchor: "FE-01-01",
        field: "title",
        value: "首頁（校正後）",
        reason: "標題要與客戶說法一致。",
      },
      {
        target: "workitems",
        op: "upsert",
        anchor: "BE-EXTRA-01",
        value: {
          id: "BE-EXTRA-01",
          sourcePage: { route: "/settings", tab: "個人資料" },
          title: "AI 漏拆的稽核 API",
          scope: "記錄變更。",
          acceptance: "可追溯。",
          dependsOn: [],
          risk: "",
          inferred: true,
        },
        reason: "AI 漏拆。",
      },
    ]);
    const { workitems: w, warnings } = buildWorkitems(
      workflow,
      frontendItems,
      backendItems,
      revisions,
    );
    expect(w.frontend[0]?.title).toBe("首頁（校正後）");
    expect(w.backend.map((i) => i.id)).toContain("BE-EXTRA-01");
    expect(warnings).toEqual([]);
  });

  it("套用後跌破前端顆粒度底線時丟 WorkitemsConsistencyError（不落地）", () => {
    const revisions = parseRevisions([
      { target: "workitems", op: "remove", anchor: "FE-01-01", reason: "覺得多餘。" },
    ]);
    const call = () => buildWorkitems(workflow, frontendItems, backendItems, revisions);
    expect(call).toThrow(WorkitemsConsistencyError);
    expect(call).toThrow(/顆粒度不足/);
  });

  it("孤兒工項修訂保留該筆、發 warning，其餘照套", () => {
    const revisions = parseRevisions([
      {
        target: "workitems",
        op: "set",
        anchor: "BE-99",
        field: "title",
        value: "重跑後這個 id 不存在。",
        reason: "後端 id 漂掉。",
      },
      {
        target: "workitems",
        op: "set",
        anchor: "FE-02-01",
        field: "risk",
        value: "欄位驗證規則待確認。",
        reason: "補上風險。",
      },
    ]);
    const { workitems: w, warnings } = buildWorkitems(
      workflow,
      frontendItems,
      backendItems,
      revisions,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("BE-99");
    expect(w.frontend[1]?.risk).toBe("欄位驗證規則待確認。");
  });
});
