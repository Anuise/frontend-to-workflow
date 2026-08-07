import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Mainflow, parseMainflow } from "../contracts/mainflow";
import type { Workflow } from "../contracts/workflow";
import { contractPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import { type MainFlowDiagram, OVERVIEW_PAGE_NAME, buildDiagram } from "./buildDiagram";
import { hasMainflow, loadMainflowForDiagram, loadWorkflowForDiagram } from "./inputs";
import { renderDiagram, saveDiagram } from "./renderDiagram";

const workflow: Workflow = {
  project: "demo",
  overview: "首頁可前往說明與訂單。",
  pages: [
    {
      route: "/",
      purpose: "首頁 <入口> 與 A&B 專區",
      content: "導覽連結。",
      actions: [
        { label: "點擊「關於」", destination: { route: "/about" } },
        { label: "點擊「訂單」", destination: { route: "/orders" } },
        { label: "捲動頁面", destination: null },
      ],
    },
    {
      route: "/about",
      purpose: "介紹。",
      content: "說明文字。",
      actions: [{ label: "點擊「設定」", destination: { route: "/settings" } }],
    },
    { route: "/settings", purpose: "設定。", content: "表單。", actions: [] },
    {
      route: "/orders",
      purpose: "訂單清單。",
      content: "表格。",
      actions: [{ label: "點某筆訂單", destination: { route: "/orders/1" } }],
    },
    {
      route: "/orders/1",
      purpose: "單筆訂單。",
      content: "明細。",
      actions: [{ label: "按「出貨」", destination: { route: "/orders/1/ship" } }],
    },
    { route: "/orders/1/ship", purpose: "出貨單。", content: "表單。", actions: [] },
  ],
};

const mainflow: Mainflow = parseMainflow({
  project: "demo",
  flows: [
    {
      name: "了解與設定",
      steps: [
        {
          title: "進入首頁",
          note: "首頁 <入口> 與 A&B",
          pages: [{ route: "/" }],
          outcomes: [
            { condition: "看說明", target: 2, evidence: { route: "/", label: "點擊「關於」" } },
          ],
        },
        {
          title: "閱讀說明",
          note: "了解專案用途",
          pages: [{ route: "/about" }],
          outcomes: [
            {
              condition: "去設定",
              target: 3,
              evidence: { route: "/about", label: "點擊「設定」" },
            },
          ],
        },
        { title: "調整設定", note: "維護偏好", pages: [{ route: "/settings" }], outcomes: [] },
      ],
    },
    {
      name: "處理訂單",
      steps: [
        {
          title: "檢視清單",
          note: "掌握所有訂單",
          pages: [{ route: "/orders" }],
          outcomes: [
            {
              condition: "開單筆",
              target: 2,
              evidence: { route: "/orders", label: "點某筆訂單" },
            },
          ],
        },
        {
          title: "檢視單筆",
          note: "看訂單明細",
          pages: [{ route: "/orders/1" }],
          outcomes: [
            {
              condition: "建出貨",
              target: 3,
              evidence: { route: "/orders/1", label: "按「出貨」" },
            },
          ],
        },
        {
          title: "建立出貨單",
          note: "填出貨資訊",
          pages: [{ route: "/orders/1/ship" }],
          outcomes: [],
        },
      ],
    },
  ],
  excludedPages: [],
});

/**
 * 帶業務決策點與迴圈的第二組樣本：送件 →（核准／退件）→ 通知，退件那條指回第 1 步。
 * 審核那一步有兩個出口，圖上要長出菱形；兩條出口的憑據都是畫面上真的按得到的按鈕。
 */
const reviewWorkflow: Workflow = {
  project: "review",
  overview: "送件後審核，退件會回到送件頁重填。",
  pages: [
    {
      route: "/apply",
      purpose: "填寫申請單。",
      content: "申請表單。",
      actions: [{ label: "按「送出申請」", destination: { route: "/review" } }],
    },
    {
      route: "/review",
      purpose: "審核申請。",
      content: "申請明細與審核按鈕。",
      actions: [
        { label: "按「核准」", destination: { route: "/done" } },
        { label: "按「退件」", destination: { route: "/apply" } },
      ],
    },
    { route: "/done", purpose: "完成通知。", content: "審核結果。", actions: [] },
  ],
};

const reviewMainflow: Mainflow = parseMainflow({
  project: "review",
  flows: [
    {
      name: "申請審核",
      steps: [
        {
          title: "送出申請",
          note: "填寫並送件",
          pages: [{ route: "/apply" }],
          outcomes: [
            {
              condition: "送件",
              target: 2,
              evidence: { route: "/apply", label: "按「送出申請」" },
            },
          ],
        },
        {
          title: "審核申請",
          note: "決定核准或退件",
          pages: [{ route: "/review" }],
          outcomes: [
            { condition: "核准", target: 3, evidence: { route: "/review", label: "按「核准」" } },
            { condition: "退件", target: 1, evidence: { route: "/review", label: "按「退件」" } },
          ],
        },
        { title: "通知結果", note: "告知申請人", pages: [{ route: "/done" }], outcomes: [] },
      ],
    },
  ],
  excludedPages: [],
});

function countOf(xml: string, pattern: RegExp): number {
  return xml.match(pattern)?.length ?? 0;
}

/** 一條邊在 XML 裡的樣子：id／label／來源／去向都要對得上，中間的 style 不比。 */
function hasEdge(
  xml: string,
  id: string,
  label: string,
  sourceId: string,
  targetId: string,
): boolean {
  return new RegExp(
    `<mxCell id="${id}" value="${label}" style="[^"]*" edge="1" parent="1" source="${sourceId}" target="${targetId}">`,
  ).test(xml);
}

const allNodes = (diagram: MainFlowDiagram) => diagram.pages.flatMap((page) => page.nodes);
const allEdges = (diagram: MainFlowDiagram) => diagram.pages.flatMap((page) => page.edges);

describe("renderDiagram", () => {
  it("產出 draw.io 的 mxfile／mxGraphModel 明文 XML", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<mxfile host="f2w-diagram">');
    expect(xml).toContain('<diagram id="Diagram_1" name="了解與設定">');
    expect(xml).toContain("</mxfile>");
  });

  it("一條主線一個 <diagram> 分頁，最後一個是總覽", () => {
    const diagram = buildDiagram(workflow, mainflow);
    const xml = renderDiagram(diagram);
    expect(countOf(xml, /<diagram /g)).toBe(3);
    expect(countOf(xml, /<mxGraphModel /g)).toBe(3);
    expect(xml).toContain(`<diagram id="Diagram_Overview" name="${OVERVIEW_PAGE_NAME}">`);
    // 總覽頁一頁就帶到全部主線的色系
    expect(xml.split('<diagram id="Diagram_Overview"')[1]).toContain(
      "fillColor=#dae8fc;strokeColor=#6c8ebf;",
    );
    expect(xml.split('<diagram id="Diagram_Overview"')[1]).toContain(
      "fillColor=#d5e8d4;strokeColor=#82b366;",
    );
  });

  it("不寫 draw.io 存檔才會補的時間戳屬性（確定性前提）", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).not.toContain("modified=");
    expect(xml).not.toContain("etag=");
    expect(xml).not.toContain("agent=");
  });

  it("每個節點一個 vertex、每條邊一個 edge", () => {
    const diagram = buildDiagram(workflow, mainflow);
    const xml = renderDiagram(diagram);
    expect(countOf(xml, /vertex="1"/g)).toBe(allNodes(diagram).length);
    expect(countOf(xml, /edge="1"/g)).toBe(allEdges(diagram).length);
    expect(countOf(xml, /<mxGeometry /g)).toBe(allNodes(diagram).length + allEdges(diagram).length);
    expect(countOf(xml, /<mxCell id="0" \/>/g)).toBe(diagram.pages.length);
  });

  it("步驟框是兩段式：粗體「編號. 業務動作名」在上、小字說明在下", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).toContain(
      'label="&lt;b&gt;2. 閱讀說明&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:10px&quot;&gt;了解專案用途&lt;/font&gt;"',
    );
  });

  it("主線標題是 24px 粗體、色隨主線；每條主線一個色系", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).toContain("fontSize=24;fontStyle=1;fontColor=#6c8ebf;");
    expect(xml).toContain("fontSize=24;fontStyle=1;fontColor=#82b366;");
    // 第 1 條主線的步驟框藍色系、第 2 條綠色系
    expect(xml).toContain("fillColor=#dae8fc;strokeColor=#6c8ebf;");
    expect(xml).toContain("fillColor=#d5e8d4;strokeColor=#82b366;");
  });

  it("收攏的頁進 UserObject 的 tooltip、換行用 <br>；條件措辭進邊的 value", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).toContain('<UserObject id="Step_1_1"');
    expect(xml).toContain('tooltip="此步驟涵蓋的頁面：&lt;br&gt;• /"');
    expect(xml).toContain('value="看說明"');
    expect(xml).toContain("edgeStyle=orthogonalEdgeStyle;");
  });

  it("單出口不生菱形，直接從步驟框拉一條帶條件的邊", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).not.toContain("rhombus;");
    expect(xml).not.toContain('id="Decision_1_1"');
    expect(hasEdge(xml, "Edge_1_1_1", "看說明", "Step_1_1", "Step_1_2")).toBe(true);
  });

  it("一步兩個出口就長出菱形：一條無 label 進菱形、兩條帶條件出菱形", () => {
    const diagram = buildDiagram(reviewWorkflow, reviewMainflow);
    const xml = renderDiagram(diagram);
    // 菱形不寫字、同色系、夾在該步右緣與下一步左緣之間（60 + 340 + 240 + 20），垂直置中
    expect(xml).toContain(
      '<mxCell id="Decision_1_2" value="" style="rhombus;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">',
    );
    expect(xml).toContain('<mxGeometry x="660" y="150" width="60" height="60" as="geometry" />');
    expect(hasEdge(xml, "Edge_1_2_0", "", "Step_1_2", "Decision_1_2")).toBe(true);
    expect(hasEdge(xml, "Edge_1_2_1", "核准", "Decision_1_2", "Step_1_3")).toBe(true);
    expect(hasEdge(xml, "Edge_1_2_2", "退件", "Decision_1_2", "Step_1_1")).toBe(true);
    // 只有第 2 步分歧：主線那頁與總覽頁各一個菱形，第 1 步不生
    expect(countOf(xml, /rhombus;/g)).toBe(2);
    expect(countOf(xml, /vertex="1"/g)).toBe(allNodes(diagram).length);
    expect(countOf(xml, /edge="1"/g)).toBe(allEdges(diagram).length);
  });

  it("迴圈：target 指回前面的步，邊帶著條件接回那一步", () => {
    const xml = renderDiagram(buildDiagram(reviewWorkflow, reviewMainflow));
    // 退件回到第 1 步；主線那頁與總覽頁各有一條，id 只差 Overview_ 前綴
    expect(hasEdge(xml, "Edge_1_2_2", "退件", "Decision_1_2", "Step_1_1")).toBe(true);
    expect(
      hasEdge(xml, "Overview_Edge_1_2_2", "退件", "Overview_Decision_1_2", "Overview_Step_1_1"),
    ).toBe(true);
    expect(countOf(xml, /value="退件"/g)).toBe(2);
  });

  it("XML 特殊字元轉義，中文原樣保留", () => {
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    expect(xml).toContain("首頁 &lt;入口&gt; 與 A&amp;B");
    expect(xml).not.toContain("首頁 <入口>");
  });

  it("同一份 diagram 兩次序列化字串完全相同（確定性）", () => {
    const diagram = buildDiagram(workflow, mainflow);
    expect(renderDiagram(diagram)).toBe(renderDiagram(diagram));
    const branching = buildDiagram(reviewWorkflow, reviewMainflow);
    expect(renderDiagram(branching)).toBe(renderDiagram(branching));
  });
});

describe("saveDiagram", () => {
  it("寫出 output/<project>/mainflow.drawio，重跑直接覆寫", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-save-"));
    const xml = renderDiagram(buildDiagram(workflow, mainflow));
    const path = saveDiagram(root, "demo", xml);
    expect(path).toBe(contractPath(root, "demo", "diagram"));
    expect(path.endsWith("mainflow.drawio")).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(xml);

    saveDiagram(root, "demo", xml);
    expect(readFileSync(path, "utf8")).toBe(xml);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("前置檔入口", () => {
  it("缺 workflow.json 時提示先跑 f2w-describe", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-missing-"));
    const call = () => loadWorkflowForDiagram(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });

  it("缺 mainflow.json 時 hasMainflow 為 false 且讀取會丟 MissingPrerequisiteError", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-no-mainflow-"));
    expect(hasMainflow(root, "demo")).toBe(false);
    const call = () => loadMainflowForDiagram(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/mainflow\.json/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("端到端（真實 fixtures）", () => {
  it("讀真實 workflow.json ＋ mainflow.json → 組裝 → 寫出 mainflow.drawio", () => {
    const fixtures = join(process.cwd(), "fixtures");
    expect(hasMainflow(fixtures, "contracts")).toBe(true);
    const diagram = buildDiagram(
      loadWorkflowForDiagram(fixtures, "contracts"),
      loadMainflowForDiagram(fixtures, "contracts"),
    );
    expect(diagram.pages.map((page) => page.name)).toEqual([
      "設定個人帳號",
      OVERVIEW_PAGE_NAME,
    ]);
    // /about 落選：不上圖，只在 warning 裡交代
    expect(diagram.warnings).toHaveLength(1);
    expect(diagram.warnings[0]).toContain("/about");

    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-e2e-"));
    const path = saveDiagram(root, "contracts", renderDiagram(diagram));
    expect(countOf(readFileSync(path, "utf8"), /vertex="1"/g)).toBe(allNodes(diagram).length);
    rmSync(root, { recursive: true, force: true });
  });
});
