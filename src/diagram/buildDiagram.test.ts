import { describe, expect, it } from "vitest";
import { type Mainflow, parseMainflow } from "../contracts/mainflow";
import type { Workflow } from "../contracts/workflow";
import {
  COVERED_TOOLTIP_HEADER,
  DiagramConsistencyError,
  type MainFlowDiagram,
  buildDiagram,
  excludedPagesWarning,
} from "./buildDiagram";

const R = "/index";
const to = (tab: string) => ({ route: R, tab });

/** 8 頁：兩條主線各 3 步（其中一步收攏兩頁）＋ 1 頁落選。 */
const workflow: Workflow = {
  project: "demo",
  overview: "從首頁可走訂單或設定。",
  pages: [
    {
      ...to("首頁"),
      purpose: "平台入口。",
      content: "兩個入口連結。",
      actions: [
        { label: "點「訂單」", destination: to("訂單｜清單") },
        { label: "點「設定」", destination: to("設定｜個人") },
      ],
    },
    {
      ...to("訂單｜清單"),
      purpose: "訂單總覽。",
      content: "訂單表格。",
      actions: [
        { label: "點某筆訂單", destination: to("訂單｜詳情") },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      ...to("訂單｜詳情"),
      purpose: "單筆訂單內容。",
      content: "明細欄位。",
      actions: [
        { label: "按「出貨」", destination: to("訂單｜詳情｜出貨") },
        { label: "按「返回清單」", destination: to("訂單｜清單") },
      ],
    },
    {
      ...to("訂單｜詳情｜出貨"),
      purpose: "建立出貨單。",
      content: "出貨表單。",
      actions: [{ label: "按「取消」", destination: to("訂單｜詳情") }],
    },
    {
      ...to("設定｜個人"),
      purpose: "編輯個人資料。",
      content: "姓名與 Email。",
      actions: [{ label: "切到「安全」", destination: to("設定｜安全") }],
    },
    {
      ...to("設定｜安全"),
      purpose: "改密碼。",
      content: "密碼欄位。",
      actions: [{ label: "切到「通知」", destination: to("設定｜通知") }],
    },
    { ...to("設定｜通知"), purpose: "設定通知。", content: "開關。", actions: [] },
    { ...to("稽核"), purpose: "稽核紀錄。", content: "紀錄表格。", actions: [] },
  ],
};

const mainflow: Mainflow = parseMainflow({
  project: "demo",
  flows: [
    {
      name: "處理訂單",
      steps: [
        { title: "進入首頁", note: "從入口開始", pages: [to("首頁")], edgeLabel: "看訂單" },
        {
          title: "檢視訂單清單",
          note: "掌握所有訂單",
          pages: [to("訂單｜清單")],
          edgeLabel: "開單筆",
        },
        {
          title: "維護單筆訂單",
          note: "檢視明細並出貨",
          pages: [to("訂單｜詳情"), to("訂單｜詳情｜出貨")],
        },
      ],
    },
    {
      name: "設定帳號",
      steps: [
        {
          title: "編輯個人資料",
          note: "維護姓名與 Email",
          pages: [to("設定｜個人")],
          edgeLabel: "切到安全",
        },
        {
          title: "維護帳號安全",
          note: "更新密碼",
          pages: [to("設定｜安全")],
          edgeLabel: "設定通知",
        },
        { title: "設定通知偏好", note: "決定收哪些通知", pages: [to("設定｜通知")] },
      ],
    },
  ],
  excludedPages: [{ ...to("稽核"), reason: "稽核紀錄，不屬任何主線" }],
});

/** 換一份 mainflow 再驗，避免測試之間互相污染。 */
function withMainflow(change: (draft: Mainflow) => void) {
  const draft = structuredClone(mainflow);
  change(draft);
  return () => buildDiagram(workflow, draft);
}

function pageNamed(diagram: MainFlowDiagram, name: string) {
  const page = diagram.pages.find((p) => p.name === name);
  expect(page, `找不到分頁 ${name}`).toBeDefined();
  return page!;
}

describe("buildDiagram 分頁結構", () => {
  it("一條主線一個分頁，沒有總覽頁", () => {
    const diagram = buildDiagram(workflow, mainflow);
    expect(diagram.pages.map((page) => page.name)).toEqual(["處理訂單", "設定帳號"]);
    expect(diagram.pages.map((page) => page.colorIndex)).toEqual([0, 1]);
    expect(diagram.name).toBe("demo");
  });

  it("每頁＝主線標題 ＋ 細橫線 ＋ 每步一個框", () => {
    const page = pageNamed(buildDiagram(workflow, mainflow), "處理訂單");
    expect(page.nodes.map((node) => node.kind)).toEqual([
      "flowTitle",
      "rule",
      "step",
      "step",
      "step",
    ]);
    expect(page.nodes[0]!.label).toBe("處理訂單");
  });

  it("步驟單列橫排、不折行，寬高固定 240×100", () => {
    const steps = pageNamed(buildDiagram(workflow, mainflow), "處理訂單").nodes.filter(
      (node) => node.kind === "step",
    );
    expect(new Set(steps.map((node) => node.y)).size).toBe(1);
    expect(steps.map((node) => node.x)).toEqual(
      [...steps.map((node) => node.x)].sort((a, b) => a - b),
    );
    expect(steps.every((node) => node.width === 240 && node.height === 100)).toBe(true);
  });

  it("步驟標題帶編號、小字是業務說明", () => {
    const steps = pageNamed(buildDiagram(workflow, mainflow), "設定帳號").nodes.filter(
      (node) => node.kind === "step",
    );
    expect(steps.map((node) => node.title)).toEqual([
      "1. 編輯個人資料",
      "2. 維護帳號安全",
      "3. 設定通知偏好",
    ]);
    expect(steps[0]!.label).toBe("維護姓名與 Email");
  });

  it("一步收攏的頁只進 tooltip，不上圖面", () => {
    const collapsed = pageNamed(buildDiagram(workflow, mainflow), "處理訂單").nodes.find(
      (node) => node.title === "3. 維護單筆訂單",
    )!;
    expect(collapsed.tooltip).toBe(
      `${COVERED_TOOLTIP_HEADER}\n• ${R}（訂單｜詳情）\n• ${R}（訂單｜詳情｜出貨）`,
    );
  });

  it("節點與邊 id 跨分頁都不重複", () => {
    const diagram = buildDiagram(workflow, mainflow);
    const nodeIds = diagram.pages.flatMap((page) => page.nodes.map((node) => node.id));
    const edgeIds = diagram.pages.flatMap((page) => page.edges.map((edge) => edge.id));
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });
});

describe("buildDiagram 邊", () => {
  it("相鄰兩步一條邊，label 是業務轉場動作；最後一步沒有出邊", () => {
    const page = pageNamed(buildDiagram(workflow, mainflow), "處理訂單");
    expect(page.edges.map((edge) => edge.label)).toEqual(["看訂單", "開單筆"]);
    const stepIds = page.nodes.filter((node) => node.kind === "step").map((node) => node.id);
    expect(page.edges.map((edge) => [edge.sourceId, edge.targetId])).toEqual([
      [stepIds[0], stepIds[1]],
      [stepIds[1], stepIds[2]],
    ]);
  });

  it("相鄰兩步之間沒有真實操作去向時丟 DiagramConsistencyError", () => {
    // 把兩條主線的頁互換：「檢視訂單清單」變成設定頁，走不到下一步
    const call = withMainflow((draft) => {
      draft.flows[0]!.steps[1]!.pages = [to("設定｜通知")];
      draft.flows[1]!.steps[2]!.pages = [to("訂單｜清單")];
    });
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/沒有任何操作去向可走/);
  });

  it("workflow.json 自己的操作去向斷掉時丟 DiagramConsistencyError", () => {
    const broken: Workflow = {
      ...workflow,
      pages: [
        { ...workflow.pages[0]!, actions: [{ label: "點壞掉的連結", destination: to("不存在") }] },
        ...workflow.pages.slice(1),
      ],
    };
    expect(() => buildDiagram(broken, mainflow)).toThrow(DiagramConsistencyError);
  });
});

describe("buildDiagram 涵蓋完整性", () => {
  it("有頁既不在主線也不在 excludedPages 時丟 DiagramConsistencyError", () => {
    const call = withMainflow((draft) => draft.excludedPages.splice(0, 1));
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/每一頁都要表態/);
  });

  it("mainflow 提到 workflow 裡沒有的頁時丟 DiagramConsistencyError", () => {
    const call = withMainflow((draft) =>
      draft.excludedPages.push({ ...to("幽靈頁"), reason: "不存在" }),
    );
    expect(call).toThrow(/不存在的 Page/);
  });

  it("兩份檔的 project 不同時丟 DiagramConsistencyError", () => {
    const call = withMainflow((draft) => {
      draft.project = "另一個專案";
    });
    expect(call).toThrow(/project/);
  });
});

describe("buildDiagram 落選頁與確定性", () => {
  it("落選頁不上圖，只在 warning 裡交代", () => {
    const diagram = buildDiagram(workflow, mainflow);
    expect(diagram.warnings).toEqual([excludedPagesWarning(mainflow.excludedPages)]);
    expect(diagram.warnings[0]).toContain("稽核紀錄，不屬任何主線");
    const texts = diagram.pages.flatMap((page) =>
      page.nodes.flatMap((node) => [node.title ?? "", node.label, node.tooltip ?? ""]),
    );
    expect(texts.some((text) => text.includes("稽核"))).toBe(false);
    expect(texts.some((text) => text.includes("⚠"))).toBe(false);
  });

  it("沒有落選頁時沒有 warning", () => {
    const withoutAudit: Workflow = { ...workflow, pages: workflow.pages.slice(0, 7) };
    const noExcluded = structuredClone(mainflow);
    noExcluded.excludedPages = [];
    expect(buildDiagram(withoutAudit, noExcluded).warnings).toEqual([]);
  });

  it("同一份輸入兩次組裝結果相同（確定性）", () => {
    expect(buildDiagram(workflow, mainflow)).toEqual(buildDiagram(workflow, mainflow));
  });

  it("節點都有正座標與尺寸", () => {
    for (const node of buildDiagram(workflow, mainflow).pages.flatMap((page) => page.nodes)) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });
});
