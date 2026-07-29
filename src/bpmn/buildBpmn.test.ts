import { describe, expect, it } from "vitest";
import type { Workflow } from "../contracts/workflow";
import {
  BpmnConsistencyError,
  type BpmnDiagram,
  NO_END_EVENT_WARNING,
  START_EVENT_ID,
  buildBpmn,
} from "./buildBpmn";

/** 首頁兩條出口（插 gateway）、關於頁無出口（葉節點）、設定頁單一出口，另有一個孤立頁。 */
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

function nodeById(diagram: BpmnDiagram, id: string) {
  const node = diagram.nodes.find((n) => n.id === id);
  expect(node, `找不到節點 ${id}`).toBeDefined();
  return node!;
}

function flowsFrom(diagram: BpmnDiagram, sourceRef: string) {
  return diagram.flows.filter((flow) => flow.sourceRef === sourceRef);
}

describe("buildBpmn 語意映射", () => {
  it("每個 Page 一個 userTask，id 由正規化 route(+tab) 衍生、name 為頁面用途", () => {
    const diagram = buildBpmn(workflow);
    const tasks = diagram.nodes.filter((n) => n.kind === "userTask");
    expect(tasks.map((t) => t.id)).toEqual([
      "Page_root",
      "Page_about",
      "Page_settings_個人資料",
      "Page_orphan",
    ]);
    expect(nodeById(diagram, "Page_root").name).toBe("首頁，是進入點。");
  });

  it("startEvent 接 pages 陣列第一筆", () => {
    const diagram = buildBpmn(workflow);
    expect(nodeById(diagram, START_EVENT_ID).kind).toBe("startEvent");
    expect(flowsFrom(diagram, START_EVENT_ID)).toEqual([
      { id: "Flow_1", sourceRef: START_EVENT_ID, targetRef: "Page_root", name: undefined },
    ]);
  });

  it("某頁有 ≥2 條換頁操作時插一個 exclusiveGateway，出口 flow 各帶操作說明", () => {
    const diagram = buildBpmn(workflow);
    expect(nodeById(diagram, "Gateway_root").kind).toBe("exclusiveGateway");
    // task 只連到 gateway（未命名），分歧由 gateway 的出口承擔
    expect(flowsFrom(diagram, "Page_root")).toEqual([
      { id: "Flow_2", sourceRef: "Page_root", targetRef: "Gateway_root", name: undefined },
    ]);
    expect(flowsFrom(diagram, "Gateway_root")).toEqual([
      {
        id: "Flow_3",
        sourceRef: "Gateway_root",
        targetRef: "Page_about",
        name: "點擊「關於」",
      },
      {
        id: "Flow_4",
        sourceRef: "Gateway_root",
        targetRef: "Page_settings_個人資料",
        name: "點擊「前往設定」",
      },
    ]);
  });

  it("單一換頁操作不插 gateway，flow 直接帶操作說明", () => {
    const diagram = buildBpmn(workflow);
    expect(diagram.nodes.some((n) => n.id === "Gateway_settings_個人資料")).toBe(false);
    expect(flowsFrom(diagram, "Page_settings_個人資料")).toEqual([
      {
        id: "Flow_6",
        sourceRef: "Page_settings_個人資料",
        targetRef: "Page_root",
        name: "點擊「回首頁」",
      },
    ]);
  });

  it("無換頁出口的 Page 各接一個 endEvent（葉頁數＝endEvent 數）", () => {
    const diagram = buildBpmn(workflow);
    const ends = diagram.nodes.filter((n) => n.kind === "endEvent");
    expect(ends.map((n) => n.id)).toEqual(["End_about", "End_orphan"]);
    expect(flowsFrom(diagram, "Page_about")[0]!.targetRef).toBe("End_about");
  });

  it("不換頁的操作寫進該 task 的 documentation，不生節點也不生邊", () => {
    const diagram = buildBpmn(workflow);
    expect(nodeById(diagram, "Page_root").documentation).toContain("捲動頁面");
    expect(nodeById(diagram, "Page_about").documentation).toBeUndefined();
    // 「捲動頁面」不該變成任何一條 flow 的名稱
    expect(diagram.flows.some((f) => f.name === "捲動頁面")).toBe(false);
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
    const ids = buildBpmn(colliding)
      .nodes.filter((n) => n.kind === "userTask")
      .map((n) => n.id);
    expect(ids).toEqual(["Page_s_設定", "Page_s_設定_2"]);
  });

  it("操作去向指向不存在的 Page 時丟 BpmnConsistencyError", () => {
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
    const call = () => buildBpmn(broken);
    expect(call).toThrow(BpmnConsistencyError);
    expect(call).toThrow(/ghost/);
  });

  it("同一份 workflow 兩次組裝結果完全相同（確定性）", () => {
    expect(buildBpmn(workflow)).toEqual(buildBpmn(workflow));
  });
});

describe("buildBpmn layout", () => {
  it("BFS 分層決定欄：入口在最左，同層的 Page 同欄不同列", () => {
    const diagram = buildBpmn(workflow);
    const start = nodeById(diagram, START_EVENT_ID);
    const root = nodeById(diagram, "Page_root");
    const about = nodeById(diagram, "Page_about");
    const settings = nodeById(diagram, "Page_settings_個人資料");
    expect(start.x).toBeLessThan(root.x);
    expect(root.x).toBeLessThan(about.x);
    // /about 與 /settings（個人資料）皆為第 1 層：同欄、不同列
    expect(settings.x).toBe(about.x);
    expect(settings.y).not.toBe(about.y);
  });

  it("孤立頁畫出來但不接 startEvent，且排在主圖下方另一區", () => {
    const diagram = buildBpmn(workflow);
    const orphan = nodeById(diagram, "Page_orphan");
    expect(diagram.flows.some((f) => f.targetRef === "Page_orphan")).toBe(false);
    const reachableMaxY = Math.max(
      ...["Page_root", "Page_about", "Page_settings_個人資料"].map((id) => nodeById(diagram, id).y),
    );
    expect(orphan.y).toBeGreaterThan(reachableMaxY);
  });
});

describe("buildBpmn 提醒", () => {
  it("有孤立頁時提醒回頭補操作去向，並點出是哪一頁", () => {
    expect(buildBpmn(workflow).warnings.some((w) => w.includes("/orphan"))).toBe(true);
  });

  it("每頁都有換頁出口（純循環）時不畫 endEvent，並提醒此圖無終點", () => {
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
    const diagram = buildBpmn(cyclic);
    expect(diagram.nodes.some((n) => n.kind === "endEvent")).toBe(false);
    expect(diagram.warnings).toContain(NO_END_EVENT_WARNING);
  });
});
