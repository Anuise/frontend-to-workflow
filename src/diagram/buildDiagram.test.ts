import { describe, expect, it } from "vitest";
import type { Workflow } from "../contracts/workflow";
import {
  DiagramConsistencyError,
  ENTRY_NODE_ID,
  NO_LEAF_PAGE_WARNING,
  type NavigationDiagram,
  buildDiagram,
} from "./buildDiagram";

/** 首頁兩條出口、關於頁無出口（葉頁）、設定頁單一出口，另有一個孤立頁。 */
const workflow: Workflow = {
  project: "demo",
  overview: "從首頁進入，可前往關於或設定。",
  pages: [
    {
      route: "/",
      purpose: "首頁，是進入點。",
      content: "歡迎訊息與導覽連結。",
      actions: [
        { label: "點擊「關於」", destination: { route: "/about" } },
        { label: "點擊「前往設定」", destination: { route: "/settings", tab: "個人資料" } },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      route: "/about",
      purpose: "介紹本專案。",
      content: "一段說明文字。",
      actions: [],
    },
    {
      route: "/settings",
      tab: "個人資料",
      purpose: "編輯個人資料。",
      content: "姓名與 Email 欄位。",
      actions: [{ label: "點擊「回首頁」", destination: { route: "/" } }],
    },
    {
      route: "/orphan",
      purpose: "沒有任何頁面連得到這裡。",
      content: "孤立內容。",
      actions: [],
    },
  ],
};

function nodeById(diagram: NavigationDiagram, id: string) {
  const node = diagram.nodes.find((n) => n.id === id);
  expect(node, `找不到節點 ${id}`).toBeDefined();
  return node!;
}

function edgesFrom(diagram: NavigationDiagram, sourceId: string) {
  return diagram.edges.filter((edge) => edge.sourceId === sourceId);
}

describe("buildDiagram 語意映射", () => {
  it("每個 Page 一個節點，id 由正規化 route(+tab) 衍生、label 為頁面用途", () => {
    const diagram = buildDiagram(workflow);
    const pages = diagram.nodes.filter((n) => n.kind === "page");
    expect(pages.map((p) => p.id)).toEqual([
      "Page_root",
      "Page_about",
      "Page_settings_個人資料",
      "Page_orphan",
    ]);
    expect(nodeById(diagram, "Page_root").label).toBe("首頁，是進入點。");
  });

  it("進場記號接 pages 陣列第一筆", () => {
    const diagram = buildDiagram(workflow);
    expect(nodeById(diagram, ENTRY_NODE_ID).kind).toBe("entry");
    expect(edgesFrom(diagram, ENTRY_NODE_ID)).toEqual([
      { id: "Edge_1", sourceId: ENTRY_NODE_ID, targetId: "Page_root", label: undefined },
    ]);
  });

  it("一頁多出口直接拉多條帶 label 的邊，不插分歧節點", () => {
    const diagram = buildDiagram(workflow);
    expect(diagram.nodes.every((n) => n.kind === "entry" || n.kind === "page")).toBe(true);
    expect(edgesFrom(diagram, "Page_root")).toEqual([
      { id: "Edge_2", sourceId: "Page_root", targetId: "Page_about", label: "點擊「關於」" },
      {
        id: "Edge_3",
        sourceId: "Page_root",
        targetId: "Page_settings_個人資料",
        label: "點擊「前往設定」",
      },
    ]);
  });

  it("單一換頁操作也是一條帶 label 的邊", () => {
    const diagram = buildDiagram(workflow);
    expect(edgesFrom(diagram, "Page_settings_個人資料")).toEqual([
      {
        id: "Edge_4",
        sourceId: "Page_settings_個人資料",
        targetId: "Page_root",
        label: "點擊「回首頁」",
      },
    ]);
  });

  it("葉頁沒有出邊，也不補終點節點", () => {
    const diagram = buildDiagram(workflow);
    expect(edgesFrom(diagram, "Page_about")).toEqual([]);
    expect(diagram.nodes).toHaveLength(5); // 1 個進場記號 ＋ 4 頁
  });

  it("不換頁的操作寫進該節點的 tooltip，不生節點也不生邊", () => {
    const diagram = buildDiagram(workflow);
    expect(nodeById(diagram, "Page_root").tooltip).toContain("捲動頁面");
    expect(nodeById(diagram, "Page_about").tooltip).toBeUndefined();
    expect(diagram.edges.some((e) => e.label === "捲動頁面")).toBe(false);
  });

  it("id 撞名時依 workflow.json 順序補 _2，保持唯一", () => {
    const colliding: Workflow = {
      project: "demo",
      overview: "兩個 tab 名去掉符號後撞在一起。",
      pages: [
        { route: "/s", tab: "設定！", purpose: "一", content: "一", actions: [] },
        { route: "/s", tab: "設定？", purpose: "二", content: "二", actions: [] },
      ],
    };
    const ids = buildDiagram(colliding)
      .nodes.filter((n) => n.kind === "page")
      .map((n) => n.id);
    expect(ids).toEqual(["Page_s_設定", "Page_s_設定_2"]);
  });

  it("操作去向指向不存在的 Page 時丟 DiagramConsistencyError", () => {
    const broken: Workflow = {
      project: "demo",
      overview: "手改壞掉的去向。",
      pages: [
        {
          route: "/",
          purpose: "首頁",
          content: "內容",
          actions: [{ label: "前往幽靈頁", destination: { route: "/ghost" } }],
        },
      ],
    };
    const call = () => buildDiagram(broken);
    expect(call).toThrow(DiagramConsistencyError);
    expect(call).toThrow(/ghost/);
  });

  it("同一份 workflow 兩次組裝結果完全相同（確定性）", () => {
    expect(buildDiagram(workflow)).toEqual(buildDiagram(workflow));
  });
});

describe("buildDiagram layout", () => {
  it("欄＝BFS 層：入口記號最左，同層的 Page 同欄不同列", () => {
    const diagram = buildDiagram(workflow);
    const entry = nodeById(diagram, ENTRY_NODE_ID);
    const root = nodeById(diagram, "Page_root");
    const about = nodeById(diagram, "Page_about");
    const settings = nodeById(diagram, "Page_settings_個人資料");
    expect(entry.x).toBeLessThan(root.x);
    expect(root.x).toBeLessThan(about.x);
    // /about 與 /settings（個人資料）皆為第 1 層：同欄、不同列
    expect(settings.x).toBe(about.x);
    expect(settings.y).not.toBe(about.y);
  });

  it("列＝該層內的 workflow.json 原順序：每層都從第一列重新開始", () => {
    const diagram = buildDiagram(workflow);
    // 第 0 層的 /（唯一一頁）與第 1 層的 /about（該層第一頁）落在同一列
    expect(nodeById(diagram, "Page_about").y).toBe(nodeById(diagram, "Page_root").y);
  });

  it("孤立頁畫出來但不接入口記號，且排在主圖下方另一區", () => {
    const diagram = buildDiagram(workflow);
    const orphan = nodeById(diagram, "Page_orphan");
    expect(diagram.edges.some((e) => e.targetId === "Page_orphan")).toBe(false);
    const reachableMaxY = Math.max(
      ...["Page_root", "Page_about", "Page_settings_個人資料"].map((id) => nodeById(diagram, id).y),
    );
    expect(orphan.y).toBeGreaterThan(reachableMaxY);
  });
});

describe("buildDiagram 提醒", () => {
  it("有孤立頁時提醒回頭補操作去向，並點出是哪一頁", () => {
    expect(buildDiagram(workflow).warnings.some((w) => w.includes("/orphan"))).toBe(true);
  });

  it("有葉頁時不提醒無終點", () => {
    expect(buildDiagram(workflow).warnings).not.toContain(NO_LEAF_PAGE_WARNING);
  });

  it("每頁都有換頁出口（純循環）時提醒此圖無終點", () => {
    const cyclic: Workflow = {
      project: "demo",
      overview: "兩頁互連，走不完。",
      pages: [
        {
          route: "/",
          purpose: "首頁",
          content: "內容",
          actions: [{ label: "前往設定", destination: { route: "/settings" } }],
        },
        {
          route: "/settings",
          purpose: "設定",
          content: "內容",
          actions: [{ label: "回首頁", destination: { route: "/" } }],
        },
      ],
    };
    expect(buildDiagram(cyclic).warnings).toContain(NO_LEAF_PAGE_WARNING);
  });
});
