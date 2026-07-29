import { describe, expect, it } from "vitest";
import type { Workflow } from "../contracts/workflow";
import {
  DiagramConsistencyError,
  ENTRY_NODE_ID,
  GLOBAL_NAV_NODE_ID,
  ISOLATED_MARK,
  type NavigationDiagram,
  OVERVIEW_PAGE_NAME,
  RETURN_TOOLTIP_HEADER,
  TAB_GROUP_LABEL,
  buildDiagram,
  fallbackLayoutWarning,
  isolatedPagesWarning,
} from "./buildDiagram";
import { SINGLE_SECTION_NAME } from "./sections";

const R = "/index";
const to = (tab: string) => ({ route: R, tab });

/**
 * 帶麵包屑階層的 fixture，形狀比照驗證資料：
 * 第 0 段是登入方式（SSO／一般登入，底下都有訂單 ⇒ 不具區辨力），第 1 段才是 Section。
 * 切出 4 個 Section：登入1／訂單3／設定2／稽核1。
 */
const workflow: Workflow = {
  project: "demo",
  overview: "從登入頁進入，可走訂單或設定。",
  pages: [
    {
      ...to("登入"),
      purpose: "平台入口，選擇身分。",
      content: "兩顆登入按鈕。",
      actions: [
        { label: "點「SSO 登入」", destination: to("SSO｜訂單｜清單") },
        { label: "點「一般登入」直接進到某張單", destination: to("一般登入｜訂單｜清單") },
      ],
    },
    {
      ...to("SSO｜訂單｜清單"),
      purpose: "訂單總覽。",
      content: "訂單表格。",
      actions: [
        { label: "點某筆訂單", destination: to("SSO｜訂單｜清單｜詳情") },
        { label: "點側欄「設定」", destination: to("SSO｜設定｜個人") },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      ...to("SSO｜訂單｜清單｜詳情"),
      purpose: "單筆訂單內容。",
      content: "明細欄位。",
      actions: [{ label: "按「返回清單」", destination: to("SSO｜訂單｜清單") }],
    },
    {
      ...to("SSO｜設定｜個人"),
      purpose: "編輯個人資料。",
      content: "姓名與 Email。",
      actions: [
        { label: "切到「安全」", destination: to("SSO｜設定｜安全") },
        { label: "點側欄「訂單」", destination: to("SSO｜訂單｜清單") },
      ],
    },
    { ...to("SSO｜設定｜安全"), purpose: "改密碼。", content: "密碼欄位。", actions: [] },
    {
      ...to("一般登入｜訂單｜清單"),
      purpose: "一般身分的訂單總覽。",
      content: "簡化表格。",
      actions: [],
    },
    { ...to("SSO｜稽核"), purpose: "沒有任何頁面連得到這裡。", content: "稽核紀錄。", actions: [] },
  ],
};

function pageNamed(diagram: NavigationDiagram, name: string) {
  const page = diagram.pages.find((p) => p.name === name);
  expect(page, `找不到分頁 ${name}`).toBeDefined();
  return page!;
}

function nodeById(diagram: NavigationDiagram, id: string) {
  const node = diagram.pages.flatMap((p) => p.nodes).find((n) => n.id === id);
  expect(node, `找不到節點 ${id}`).toBeDefined();
  return node!;
}

describe("buildDiagram 分頁結構", () => {
  it("第 1 頁是總覽，之後每個 Section 一頁", () => {
    const diagram = buildDiagram(workflow);
    expect(diagram.pages.map((page) => page.name)).toEqual([
      OVERVIEW_PAGE_NAME,
      "登入",
      "訂單",
      "設定",
      "稽核",
    ]);
  });

  it("每個 Page 一個節點，落在自己的 Section 分頁上，父在左子在右", () => {
    const diagram = buildDiagram(workflow);
    const order = pageNamed(diagram, "訂單").nodes;
    // 麵包屑沒有「訂單」這一頁，所以樹根是隱含節點；其餘依深度優先走訪
    expect(order.map((node) => [node.kind, node.label])).toEqual([
      ["implied", "訂單"],
      ["page", "訂單總覽。"],
      ["page", "單筆訂單內容。"],
      ["page", "一般身分的訂單總覽。"],
    ]);
    expect(order[0]!.x).toBeLessThan(order[1]!.x);
    expect(pageNamed(diagram, "設定").nodes.filter((node) => node.kind === "page")).toHaveLength(2);
  });

  it("分頁 id 互不重複，邊 id 跨分頁也不重複", () => {
    const diagram = buildDiagram(workflow);
    const pageIds = diagram.pages.map((page) => page.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    const edgeIds = diagram.pages.flatMap((page) => page.edges.map((edge) => edge.id));
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });
});

describe("buildDiagram 總覽頁", () => {
  it("由進場記號、全域導覽記號與每個 Section 一個方框組成", () => {
    const overview = pageNamed(buildDiagram(workflow), OVERVIEW_PAGE_NAME);
    expect(overview.nodes.map((node) => node.kind)).toEqual([
      "entry",
      "globalNav",
      "section",
      "section",
      "section",
      "section",
    ]);
    expect(
      overview.nodes.filter((node) => node.kind === "section").map((node) => node.label),
    ).toEqual(["登入（1 頁）", "訂單（3 頁）", "設定（2 頁）", "稽核（1 頁）"]);
  });

  it("Section 方框掛分頁連結，指向自己那一頁", () => {
    const diagram = buildDiagram(workflow);
    const box = pageNamed(diagram, OVERVIEW_PAGE_NAME).nodes.find((node) =>
      node.label.startsWith("訂單"),
    );
    expect(box?.linkToPageId).toBe(pageNamed(diagram, "訂單").id);
  });

  it("進場記號接 pages[0] 所屬的 Section", () => {
    const diagram = buildDiagram(workflow);
    const overview = pageNamed(diagram, OVERVIEW_PAGE_NAME);
    const entryEdge = overview.edges.find((edge) => edge.sourceId === ENTRY_NODE_ID);
    const target = overview.nodes.find((node) => node.id === entryEdge?.targetId);
    expect(target?.label).toBe("登入（1 頁）");
  });
});

describe("buildDiagram 邊的分類", () => {
  it("跨 Section 且指向該 Section 首頁的邊收成全域導覽記號發出的邊", () => {
    const overview = pageNamed(buildDiagram(workflow), OVERVIEW_PAGE_NAME);
    const navEdges = overview.edges.filter((edge) => edge.sourceId === GLOBAL_NAV_NODE_ID);
    const targets = navEdges.map(
      (edge) => overview.nodes.find((node) => node.id === edge.targetId)?.label,
    );
    expect(targets).toEqual(["訂單（3 頁）", "設定（2 頁）"]);
    // 收掉的側欄操作說明不再出現在圖上
    expect(navEdges.every((edge) => edge.label === undefined)).toBe(true);
  });

  it("跨 Section 但不指向首頁的邊是真實轉場，畫在總覽頁且保留原 label", () => {
    const overview = pageNamed(buildDiagram(workflow), OVERVIEW_PAGE_NAME);
    const transitions = overview.edges.filter((edge) => edge.label !== undefined);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.label).toBe("點「一般登入」直接進到某張單");
  });

  it("同 Section 的推進邊（父→子）畫在該 Section 的分頁上", () => {
    const diagram = buildDiagram(workflow);
    expect(pageNamed(diagram, "訂單").edges.map((edge) => edge.label)).toEqual(["點某筆訂單"]);
  });

  it("子→祖先的返回邊不畫，label 進來源節點 tooltip 的返回操作段", () => {
    const diagram = buildDiagram(workflow);
    const detail = pageNamed(diagram, "訂單").nodes.find((n) => n.label === "單筆訂單內容。")!;
    expect(detail.tooltip).toBe(`${RETURN_TOOLTIP_HEADER}\n• 按「返回清單」`);
  });

  it("兄弟互跳不畫邊，改用 tab 群組框圈起來", () => {
    const diagram = buildDiagram(workflow);
    const settings = pageNamed(diagram, "設定");
    expect(settings.edges).toHaveLength(0);
    expect(settings.groups.map((group) => group.label)).toEqual([TAB_GROUP_LABEL]);
    // 框住兩個 tab 子頁
    const group = settings.groups[0]!;
    const members = settings.nodes.filter(
      (node) => node.x >= group.x && node.x + node.width <= group.x + group.width,
    );
    expect(members.map((node) => node.label)).toEqual(["編輯個人資料。", "改密碼。"]);
  });

  it("沒有互跳的平行子頁不圈框", () => {
    // 訂單底下兩個「清單」是平行子頁，彼此沒有互跳
    expect(pageNamed(buildDiagram(workflow), "訂單").groups).toHaveLength(0);
  });

  it("不換頁的操作寫進該節點的 tooltip，不生節點也不生邊", () => {
    const diagram = buildDiagram(workflow);
    const node = pageNamed(diagram, "訂單").nodes.find((n) => n.label === "訂單總覽。")!;
    expect(node.tooltip).toBe("不換頁的操作：\n• 捲動頁面");
  });

  it("操作去向指向不存在的 Page 時丟 DiagramConsistencyError", () => {
    const broken: Workflow = {
      ...workflow,
      pages: [
        {
          ...workflow.pages[0]!,
          actions: [{ label: "點壞掉的連結", destination: to("SSO｜不存在") }],
        },
        ...workflow.pages.slice(1),
      ],
    };
    expect(() => buildDiagram(broken)).toThrow(DiagramConsistencyError);
  });
});

describe("buildDiagram warnings", () => {
  it("孤立頁仍畫在自己的 Section 分頁上、標題帶警示前綴，並原文提醒", () => {
    const diagram = buildDiagram(workflow);
    const nodes = pageNamed(diagram, "稽核").nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.title).toBe(`${ISOLATED_MARK}稽核`);
    expect(diagram.warnings).toContain(isolatedPagesWarning([to("SSO｜稽核")]));
  });

  it("非孤立頁的標題是階層路徑末段，不帶警示前綴", () => {
    const diagram = buildDiagram(workflow);
    const detail = pageNamed(diagram, "訂單").nodes.find((n) => n.label === "單筆訂單內容。")!;
    expect(detail.title).toBe("詳情");
    expect(detail.width).toBe(240);
    expect(detail.height).toBe(100);
  });

  it("不再有「無終點」這條提醒——麵包屑樹永遠有葉節點", () => {
    expect(buildDiagram(workflow).warnings.some((w) => w.includes("無終點"))).toBe(false);
  });

  it("Section 內切不出單根麵包屑樹時退回分層網格並提醒", () => {
    // 路由都是平的：每頁自成一段，收成單一 Section 後長不出樹。
    const flat: Workflow = {
      project: "flat",
      overview: "三頁互不從屬。",
      pages: [
        {
          route: "/",
          purpose: "首頁。",
          content: "連結。",
          actions: [{ label: "去關於", destination: { route: "/about" } }],
        },
        { route: "/about", purpose: "介紹。", content: "文字。", actions: [] },
        { route: "/contact", purpose: "聯絡。", content: "表單。", actions: [] },
      ],
    };
    const diagram = buildDiagram(flat);
    expect(diagram.warnings).toContain(fallbackLayoutWarning(SINGLE_SECTION_NAME));
    expect(diagram.pages.map((page) => page.name)).toEqual([
      OVERVIEW_PAGE_NAME,
      SINGLE_SECTION_NAME,
    ]);
    // 退路不生隱含節點，每個 Page 一個節點
    expect(pageNamed(diagram, SINGLE_SECTION_NAME).nodes.every((n) => n.kind === "page")).toBe(true);
  });
});

describe("buildDiagram 座標", () => {
  it("同一份 workflow 兩次組裝結果相同（確定性）", () => {
    expect(buildDiagram(workflow)).toEqual(buildDiagram(workflow));
  });

  it("節點都有正座標與尺寸", () => {
    const diagram = buildDiagram(workflow);
    for (const node of diagram.pages.flatMap((page) => page.nodes)) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
    expect(nodeById(diagram, GLOBAL_NAV_NODE_ID).kind).toBe("globalNav");
  });
});
