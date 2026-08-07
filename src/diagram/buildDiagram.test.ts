import { describe, expect, it } from "vitest";
import { type Mainflow, parseMainflow } from "../contracts/mainflow";
import type { Workflow } from "../contracts/workflow";
import {
  COVERED_TOOLTIP_HEADER,
  DiagramConsistencyError,
  type MainFlowDiagram,
  OVERVIEW_PAGE_NAME,
  buildDiagram,
  excludedPagesWarning,
} from "./buildDiagram";

const R = "/index";
const to = (tab: string) => ({ route: R, tab });
/** 出口的事實憑據：某一頁上真的存在的一個操作（label 要逐字命中 workflow.json 的 actions[]）。 */
const at = (tab: string, label: string) => ({ ...to(tab), label });

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

/** 兩條主線都是一路走到底：每步單出口，終點明寫空 outcomes。 */
const mainflow: Mainflow = parseMainflow({
  project: "demo",
  flows: [
    {
      name: "處理訂單",
      steps: [
        {
          title: "進入首頁",
          note: "從入口開始",
          pages: [to("首頁")],
          outcomes: [{ condition: "看訂單", target: 2, evidence: at("首頁", "點「訂單」") }],
        },
        {
          title: "檢視訂單清單",
          note: "掌握所有訂單",
          pages: [to("訂單｜清單")],
          outcomes: [{ condition: "開單筆", target: 3, evidence: at("訂單｜清單", "點某筆訂單") }],
        },
        {
          title: "維護單筆訂單",
          note: "檢視明細並出貨",
          pages: [to("訂單｜詳情"), to("訂單｜詳情｜出貨")],
          outcomes: [],
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
          outcomes: [{ condition: "切到安全", target: 2, evidence: at("設定｜個人", "切到「安全」") }],
        },
        {
          title: "維護帳號安全",
          note: "更新密碼",
          pages: [to("設定｜安全")],
          outcomes: [{ condition: "設定通知", target: 3, evidence: at("設定｜安全", "切到「通知」") }],
        },
        { title: "設定通知偏好", note: "決定收哪些通知", pages: [to("設定｜通知")], outcomes: [] },
      ],
    },
  ],
  excludedPages: [{ ...to("稽核"), reason: "稽核紀錄，不屬任何主線" }],
});

/**
 * 同一份 workflow 的另一種切法：「處理訂單」拆成 4 步，第 3 步兩個出口——
 * 一條往前推到出貨（第 4 步）、一條退回清單（第 2 步，迴圈）。用來驗菱形與繞路帶。
 */
const branchingMainflow: Mainflow = parseMainflow({
  project: "demo",
  flows: [
    {
      name: "處理訂單",
      steps: [
        {
          title: "進入首頁",
          note: "從入口開始",
          pages: [to("首頁")],
          outcomes: [{ condition: "看訂單", target: 2, evidence: at("首頁", "點「訂單」") }],
        },
        {
          title: "檢視訂單清單",
          note: "掌握所有訂單",
          pages: [to("訂單｜清單")],
          outcomes: [{ condition: "開單筆", target: 3, evidence: at("訂單｜清單", "點某筆訂單") }],
        },
        {
          title: "檢視訂單明細",
          note: "決定出貨或退回清單",
          pages: [to("訂單｜詳情")],
          outcomes: [
            { condition: "要出貨", target: 4, evidence: at("訂單｜詳情", "按「出貨」") },
            { condition: "回清單", target: 2, evidence: at("訂單｜詳情", "按「返回清單」") },
          ],
        },
        {
          title: "建立出貨單",
          note: "填出貨表單",
          pages: [to("訂單｜詳情｜出貨")],
          outcomes: [],
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
          outcomes: [{ condition: "切到安全", target: 2, evidence: at("設定｜個人", "切到「安全」") }],
        },
        {
          title: "維護帳號安全",
          note: "更新密碼",
          pages: [to("設定｜安全")],
          outcomes: [{ condition: "設定通知", target: 3, evidence: at("設定｜安全", "切到「通知」") }],
        },
        { title: "設定通知偏好", note: "決定收哪些通知", pages: [to("設定｜通知")], outcomes: [] },
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
  it("一條主線一個分頁，最後一頁是總覽", () => {
    const diagram = buildDiagram(workflow, mainflow);
    expect(diagram.pages.map((page) => page.name)).toEqual([
      "處理訂單",
      "設定帳號",
      OVERVIEW_PAGE_NAME,
    ]);
    // 色系掛在圖元：主線自己那頁整頁同色
    expect(
      diagram.pages.slice(0, 2).map((page) => new Set(page.nodes.map((node) => node.colorIndex))),
    ).toEqual([new Set([0]), new Set([1])]);
    expect(diagram.name).toBe("demo");
  });

  it("總覽頁把每條主線依序由上到下排一列，各自沿用自己的色系", () => {
    const overview = pageNamed(buildDiagram(workflow, mainflow), OVERVIEW_PAGE_NAME);
    const titles = overview.nodes.filter((node) => node.kind === "flowTitle");
    expect(titles.map((node) => node.label)).toEqual(["處理訂單", "設定帳號"]);
    expect(titles.map((node) => node.colorIndex)).toEqual([0, 1]);
    // 由上到下：第 2 條主線的標題落在第 1 條所有圖元的下方
    const firstRowBottom = Math.max(
      ...overview.nodes.filter((node) => node.colorIndex === 0).map((node) => node.y + node.height),
    );
    expect(titles[1]!.y).toBeGreaterThan(firstRowBottom);
    // 內容與兩條主線自己那頁加起來一樣多
    expect(overview.nodes.filter((node) => node.kind === "step")).toHaveLength(6);
    expect(overview.edges).toHaveLength(4);
  });

  it("總覽頁的縱向位置按各主線實際高度累計：帶繞路的主線把下一條往下推", () => {
    const secondTitleY = (source: Mainflow) =>
      pageNamed(buildDiagram(workflow, source), OVERVIEW_PAGE_NAME).nodes.find(
        (node) => node.kind === "flowTitle" && node.label === "設定帳號",
      )!.y;
    // 沒有繞路：第 1 條佔 130 + 100 = 230，加 80 的主線間隔，再加標題自己的 40
    expect(secondTitleY(mainflow)).toBe(350);
    // 多一條迴圈出口 → 第 1 條主線下方讓出「離框 60 ＋ 一條 60 的繞路帶」，第 2 條整列跟著往下推
    expect(secondTitleY(branchingMainflow)).toBe(470);
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

  it("分歧步到下一步多讓一段橫向間距，好讓菱形出去的條件 label 有地方放", () => {
    const stepXs = (source: Mainflow, page: string) =>
      pageNamed(buildDiagram(workflow, source), page)
        .nodes.filter((node) => node.kind === "step")
        .map((node) => node.x);
    // 每步單出口：一律 60 起算、逐步 +340
    expect(stepXs(mainflow, "處理訂單")).toEqual([60, 400, 740]);
    // 第 3 步兩個出口 → 它到第 4 步是 340 + 160，其餘相鄰步仍是 340
    expect(stepXs(branchingMainflow, "處理訂單")).toEqual([60, 400, 740, 1240]);
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
    for (const source of [mainflow, branchingMainflow]) {
      const diagram = buildDiagram(workflow, source);
      const nodeIds = diagram.pages.flatMap((page) => page.nodes.map((node) => node.id));
      const edgeIds = diagram.pages.flatMap((page) => page.edges.map((edge) => edge.id));
      expect(new Set(nodeIds).size).toBe(nodeIds.length);
      expect(new Set(edgeIds).size).toBe(edgeIds.length);
    }
  });
});

describe("buildDiagram 邊", () => {
  it("每個 outcome 一條邊，label 是條件措辭；outcomes 空的終點步沒有出邊", () => {
    const page = pageNamed(buildDiagram(workflow, mainflow), "處理訂單");
    expect(page.edges.map((edge) => edge.label)).toEqual(["看訂單", "開單筆"]);
    const stepIds = page.nodes.filter((node) => node.kind === "step").map((node) => node.id);
    expect(page.edges.map((edge) => [edge.sourceId, edge.targetId])).toEqual([
      [stepIds[0], stepIds[1]],
      [stepIds[1], stepIds[2]],
    ]);
    // 單出口不生菱形：邊直接從步驟框拉出去
    expect(page.nodes.some((node) => node.kind === "decision")).toBe(false);
  });

  it("一步兩個出口就是決策點：右邊長出菱形，一條無 label 進、兩條帶 condition 出", () => {
    const page = pageNamed(buildDiagram(workflow, branchingMainflow), "處理訂單");
    const decisions = page.nodes.filter((node) => node.kind === "decision");
    expect(decisions).toHaveLength(1);
    const decision = decisions[0]!;
    expect(decision.id).toBe("Decision_1_3");
    // 夾在第 3 步右緣與下一步左緣之間（240 + 20），60×60、垂直置中對齊步驟框
    const third = page.nodes.find((node) => node.id === "Step_1_3")!;
    expect([decision.width, decision.height]).toEqual([60, 60]);
    expect(decision.x).toBe(third.x + 240 + 20);
    expect(decision.y).toBe(third.y + (100 - 60) / 2);
    expect(decision.colorIndex).toBe(third.colorIndex);

    // 迴圈那條另外還帶繞路帶的轉折點（下一則測試驗），這裡只比語意欄位
    expect(
      page.edges
        .filter((edge) => edge.id.startsWith("Edge_1_3_"))
        .map(({ waypoints: _waypoints, ...edge }) => edge),
    ).toEqual([
      { id: "Edge_1_3_0", label: "", sourceId: "Step_1_3", targetId: "Decision_1_3" },
      { id: "Edge_1_3_1", label: "要出貨", sourceId: "Decision_1_3", targetId: "Step_1_4" },
      { id: "Edge_1_3_2", label: "回清單", sourceId: "Decision_1_3", targetId: "Step_1_2" },
    ]);
  });

  it("target 指回前面的步就是迴圈：邊接回同一頁上較早的那個步驟框", () => {
    const page = pageNamed(buildDiagram(workflow, branchingMainflow), "處理訂單");
    const loop = page.edges.find((edge) => edge.label === "回清單")!;
    const steps = page.nodes.filter((node) => node.kind === "step");
    // 不另生新框：接的就是第 2 步本人，而且它排在來源步左邊
    expect(loop.targetId).toBe(steps[1]!.id);
    expect(steps).toHaveLength(4);
    expect(steps[1]!.x).toBeLessThan(steps[2]!.x);
    // 回頭的邊壓進步驟框下方的繞路帶（離框底 60），不橫穿中間那幾個框
    const decision = page.nodes.find((node) => node.kind === "decision")!;
    const detourY = steps[0]!.y + 100 + 60;
    expect(loop.waypoints).toEqual([
      { x: decision.x + 30, y: detourY },
      { x: steps[1]!.x + 120, y: detourY },
    ]);
  });

  it("出口的憑據不是來源步自己收攏的頁時丟 DiagramConsistencyError", () => {
    // 拿下一步的畫面替第 1 步作證
    const call = withMainflow((draft) => {
      draft.flows[0]!.steps[0]!.outcomes[0]!.evidence = at("訂單｜清單", "點某筆訂單");
    });
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/憑據只能取自本步收攏的頁/);
  });

  it("憑據的 label 沒有逐字命中該頁的 actions[] 時丟 DiagramConsistencyError", () => {
    const call = withMainflow((draft) => {
      draft.flows[0]!.steps[0]!.outcomes[0]!.evidence.label = "點「訂單」按鈕";
    });
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/逐字命中/);
  });

  it("憑據操作的去向不落在 target 步收攏的頁裡時丟 DiagramConsistencyError", () => {
    // 「點「訂單」」會前往訂單｜清單（第 2 步），出口卻指到第 3 步
    const call = withMainflow((draft) => {
      draft.flows[0]!.steps[0]!.outcomes[0]!.target = 3;
    });
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/請改 target 或重新分步/);
  });

  it("同一步的兩個出口共用同一個憑據時丟 DiagramConsistencyError", () => {
    const draft = structuredClone(branchingMainflow);
    // 同一顆「出貨」按鈕被標成兩種語意——語意上不可能，分歧是掰出來的
    draft.flows[0]!.steps[2]!.outcomes = [
      { condition: "要出貨", target: 4, evidence: at("訂單｜詳情", "按「出貨」") },
      { condition: "先出貨", target: 4, evidence: at("訂單｜詳情", "按「出貨」") },
    ];
    const call = () => buildDiagram(workflow, draft);
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/主線「處理訂單」第 3 步/);
    expect(call).toThrow(/重複引用.*按「出貨」/);
  });

  it("不同步之間引用同名操作是合法的：憑據以頁為界", () => {
    // 首頁也長出一個和訂單清單同名的「捲動頁面」操作
    const shared: Workflow = {
      ...workflow,
      pages: workflow.pages.map((page) =>
        page.tab === "首頁"
          ? { ...page, actions: [...page.actions, { label: "捲動頁面", destination: null }] }
          : page,
      ),
    };
    const draft = structuredClone(mainflow);
    draft.flows[0]!.steps[0]!.outcomes = [
      { condition: "看訂單", target: 2, evidence: at("首頁", "捲動頁面") },
    ];
    draft.flows[0]!.steps[1]!.outcomes = [
      { condition: "看完清單", target: 3, evidence: at("訂單｜清單", "捲動頁面") },
    ];
    expect(() => buildDiagram(shared, draft)).not.toThrow();
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
    for (const node of buildDiagram(workflow, branchingMainflow).pages.flatMap(
      (page) => page.nodes,
    )) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });
});
