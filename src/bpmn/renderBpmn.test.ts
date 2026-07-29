import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Workflow } from "../contracts/workflow";
import { contractPath } from "../output";
import { MissingPrerequisiteError } from "../prerequisites";
import { NO_END_EVENT_WARNING, buildBpmn } from "./buildBpmn";
import { loadWorkflowForBpmn } from "./inputs";
import { renderBpmn, saveBpmn } from "./renderBpmn";

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

describe("renderBpmn", () => {
  it("產出 BPMN 2.0 definitions，process 標為不可執行", () => {
    const xml = renderBpmn(buildBpmn(workflow));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
    expect(xml).toContain('<bpmn:process id="Process_demo" isExecutable="false">');
    expect(xml).toContain("</bpmn:definitions>");
  });

  it("節點與邊都有 DI：BPMNShape 數＝節點數、BPMNEdge 數＝flow 數，每條邊兩個 waypoint", () => {
    const diagram = buildBpmn(workflow);
    const xml = renderBpmn(diagram);
    expect(countOf(xml, /<bpmndi:BPMNShape /g)).toBe(diagram.nodes.length);
    expect(countOf(xml, /<bpmndi:BPMNEdge /g)).toBe(diagram.flows.length);
    expect(countOf(xml, /<di:waypoint /g)).toBe(diagram.flows.length * 2);
    expect(countOf(xml, /<dc:Bounds /g)).toBe(diagram.nodes.length);
  });

  it("四種節點與 sequenceFlow 都用對應的 BPMN 元素", () => {
    const xml = renderBpmn(buildBpmn(workflow));
    expect(xml).toContain('<bpmn:startEvent id="StartEvent_1"');
    expect(xml).toContain('<bpmn:userTask id="Page_about"');
    expect(xml).toContain('<bpmn:exclusiveGateway id="Gateway_root"');
    expect(xml).toContain('<bpmn:endEvent id="End_about"');
    expect(xml).toContain('<bpmn:sequenceFlow id="Flow_1"');
  });

  it("不換頁的操作出現在 documentation，換頁操作出現在 flow 的 name", () => {
    const xml = renderBpmn(buildBpmn(workflow));
    expect(xml).toContain("<bpmn:documentation>不換頁的操作：");
    expect(xml).toContain("捲動頁面");
    expect(xml).toContain('name="點擊「關於」"');
  });

  it("XML 特殊字元轉義，中文原樣保留", () => {
    const xml = renderBpmn(buildBpmn(workflow));
    expect(xml).toContain("首頁 &lt;入口&gt; 與 A&amp;B 專區");
    expect(xml).not.toContain("首頁 <入口>");
  });

  it("同一份 diagram 兩次序列化字串完全相同（確定性）", () => {
    const diagram = buildBpmn(workflow);
    expect(renderBpmn(diagram)).toBe(renderBpmn(diagram));
  });
});

describe("saveBpmn", () => {
  it("寫出 output/<project>/workflow.bpmn，重跑直接覆寫", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-bpmn-save-"));
    const xml = renderBpmn(buildBpmn(workflow));
    const path = saveBpmn(root, "demo", xml);
    expect(path).toBe(contractPath(root, "demo", "bpmn"));
    expect(readFileSync(path, "utf8")).toBe(xml);

    // 覆寫語意：再寫一次不會累加內容
    saveBpmn(root, "demo", xml);
    expect(readFileSync(path, "utf8")).toBe(xml);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("loadWorkflowForBpmn", () => {
  it("缺 workflow.json 時丟 MissingPrerequisiteError，提示先跑 f2w-describe", () => {
    const root = mkdtempSync(join(tmpdir(), "f2w-bpmn-missing-"));
    const call = () => loadWorkflowForBpmn(root, "demo");
    expect(call).toThrow(MissingPrerequisiteError);
    expect(call).toThrow(/f2w-describe/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("端到端（真實 fixtures）", () => {
  it("讀真實 workflow.json → 組裝 → 寫出含 DI 的 workflow.bpmn", () => {
    const loaded = loadWorkflowForBpmn(join(process.cwd(), "fixtures"), "contracts");
    const diagram = buildBpmn(loaded);
    // 每個真實 Page 一個 userTask，含帶中文 tab 的兩頁
    expect(diagram.nodes.filter((n) => n.kind === "userTask")).toHaveLength(loaded.pages.length);
    expect(diagram.nodes.some((n) => n.id === "Page_settings_個人資料")).toBe(true);
    // 這份 fixture 每頁都有換頁出口＝純循環：不畫 endEvent，並提醒無終點
    expect(diagram.nodes.some((n) => n.kind === "endEvent")).toBe(false);
    expect(diagram.warnings).toContain(NO_END_EVENT_WARNING);

    const root = mkdtempSync(join(tmpdir(), "f2w-bpmn-e2e-"));
    const path = saveBpmn(root, "contracts", renderBpmn(diagram));
    const written = readFileSync(path, "utf8");
    expect(written).toContain("<bpmndi:BPMNPlane");
    expect(countOf(written, /<bpmndi:BPMNShape /g)).toBe(diagram.nodes.length);
    rmSync(root, { recursive: true, force: true });
  });
});
