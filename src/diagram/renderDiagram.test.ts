import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Workflow } from "../contracts/workflow";
import { contractPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import {
  NO_LEAF_PAGE_WARNING,
  type NavigationDiagram,
  OVERVIEW_PAGE_NAME,
  buildDiagram,
} from "./buildDiagram";
import { loadWorkflowForDiagram } from "./inputs";
import { renderDiagram, saveDiagram } from "./renderDiagram";

const workflow: Workflow = {
  project: "demo",
  overview: "首頁可前往關於與設定。",
  pages: [
    {
      route: "/",
      purpose: "首頁 <入口> 與 A&B 專區",
      content: "導覽連結。",
      actions: [
        { label: "點擊「關於」", destination: { route: "/about" } },
        { label: "點擊「設定」", destination: { route: "/settings" } },
        { label: "捲動頁面", destination: null },
      ],
    },
    { route: "/about", purpose: "介紹。", content: "說明文字。", actions: [] },
    { route: "/settings", purpose: "設定。", content: "表單。", actions: [] },
  ],
};

function countOf(xml: string, pattern: RegExp): number {
  return xml.match(pattern)?.length ?? 0;
}

/** 節點與邊散在各分頁上，數量斷言要先攤平。 */
const allNodes = (diagram: NavigationDiagram) => diagram.pages.flatMap((page) => page.nodes);
const allEdges = (diagram: NavigationDiagram) => diagram.pages.flatMap((page) => page.edges);

describe("renderDiagram", () => {
  it("產出 draw.io 的 mxfile／mxGraphModel 明文 XML", () => {
    const xml = renderDiagram(buildDiagram(workflow));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<mxfile host="f2w-diagram">');
    expect(xml).toContain(`<diagram id="Diagram_1" name="${OVERVIEW_PAGE_NAME}">`);
    expect(xml).toContain("<mxGraphModel ");
    expect(xml).toContain("</mxfile>");
  });

  it("每個分頁一個 <diagram>：第 1 頁總覽，之後每個 Section 一頁", () => {
    const diagram = buildDiagram(workflow);
    const xml = renderDiagram(diagram);
    expect(countOf(xml, /<diagram /g)).toBe(diagram.pages.length);
    expect(countOf(xml, /<mxGraphModel /g)).toBe(diagram.pages.length);
    for (const page of diagram.pages) {
      expect(xml).toContain(`<diagram id="${page.id}" name="${page.name}">`);
    }
  });

  it("Section 方框帶 draw.io 的分頁連結", () => {
    const diagram = buildDiagram(workflow);
    const box = diagram.pages[0]!.nodes.find((node) => node.kind === "section")!;
    expect(renderDiagram(diagram)).toContain(`link="data:page/id,${box.linkToPageId}"`);
  });

  it("不寫 draw.io 存檔才會補的時間戳屬性（確定性前提）", () => {
    const xml = renderDiagram(buildDiagram(workflow));
    expect(xml).not.toContain("modified=");
    expect(xml).not.toContain("etag=");
    expect(xml).not.toContain("agent=");
  });

  it("每個節點一個 vertex（含 root 的兩個骨架 cell）、每條邊一個 edge", () => {
    const diagram = buildDiagram(workflow);
    const xml = renderDiagram(diagram);
    expect(countOf(xml, /vertex="1"/g)).toBe(allNodes(diagram).length);
    expect(countOf(xml, /edge="1"/g)).toBe(allEdges(diagram).length);
    expect(countOf(xml, /<mxGeometry /g)).toBe(
      allNodes(diagram).length + allEdges(diagram).length,
    );
    expect(countOf(xml, /<mxCell id="0" \/>/g)).toBe(diagram.pages.length);
    expect(countOf(xml, /<mxCell id="1" parent="0" \/>/g)).toBe(diagram.pages.length);
  });

  it("入口與 Page 各用自己的樣式，邊走直角路由", () => {
    const xml = renderDiagram(buildDiagram(workflow));
    expect(xml).toContain('<mxCell id="Entry_1" value="入口" style="ellipse;');
    expect(xml).toContain('<mxCell id="Page_about" value="介紹。"');
    expect(xml).toContain("edgeStyle=orthogonalEdgeStyle;");
  });

  it("不換頁的操作進 UserObject 的 tooltip、換行用 <br>；換頁操作進邊的 value", () => {
    const xml = renderDiagram(buildDiagram(workflow));
    expect(xml).toContain('<UserObject id="Page_root"');
    expect(xml).toContain("tooltip=\"不換頁的操作：&lt;br&gt;• 捲動頁面\"");
    expect(xml).toContain('value="點擊「關於」"');
    // 沒有 tooltip 的節點不包 UserObject
    expect(xml).toContain('<mxCell id="Page_about"');
  });

  it("XML 特殊字元轉義，中文原樣保留", () => {
    const xml = renderDiagram(buildDiagram(workflow));
    expect(xml).toContain("首頁 &lt;入口&gt; 與 A&amp;B 專區");
    expect(xml).not.toContain("首頁 <入口>");
  });

  it("同一份 diagram 兩次序列化字串完全相同（確定性）", () => {
    const diagram = buildDiagram(workflow);
    expect(renderDiagram(diagram)).toBe(renderDiagram(diagram));
  });
});

describe("saveDiagram", () => {
  it("寫出 output/<project>/workflow.drawio，重跑直接覆寫", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-save-"));
    const xml = renderDiagram(buildDiagram(workflow));
    const path = saveDiagram(root, "demo", xml);
    expect(path).toBe(contractPath(root, "demo", "diagram"));
    expect(readFileSync(path, "utf8")).toBe(xml);

    // 覆寫語意：再寫一次不會累加內容
    saveDiagram(root, "demo", xml);
    expect(readFileSync(path, "utf8")).toBe(xml);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("loadWorkflowForDiagram", () => {
  it("缺 workflow.json 時丟 MissingPrerequisiteError，提示先跑 f2w-describe", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-missing-"));
    const call = () => loadWorkflowForDiagram(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("端到端（真實 fixtures）", () => {
  it("讀真實 workflow.json → 組裝 → 寫出 workflow.drawio", () => {
    const loaded = loadWorkflowForDiagram(join(process.cwd(), "fixtures"), "contracts");
    const diagram = buildDiagram(loaded);
    // 每個真實 Page 一個節點，含帶中文 tab 的兩頁
    expect(allNodes(diagram).filter((n) => n.kind === "page")).toHaveLength(loaded.pages.length);
    expect(allNodes(diagram).some((n) => n.id === "Page_settings_個人資料")).toBe(true);
    // 這份 fixture 每頁都有換頁出口＝純循環：沒有葉頁，提醒無終點
    expect(diagram.warnings).toContain(NO_LEAF_PAGE_WARNING);

    const root = mkdtempSync(join(tmpdir(), "f2w-diagram-e2e-"));
    const path = saveDiagram(root, "contracts", renderDiagram(diagram));
    const written = readFileSync(path, "utf8");
    expect(path.endsWith("workflow.drawio")).toBe(true);
    expect(countOf(written, /vertex="1"/g)).toBe(allNodes(diagram).length);
    rmSync(root, { recursive: true, force: true });
  });
});
