import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { contractPath } from "../output";
import type { BpmnDiagram, BpmnFlow, BpmnNode, BpmnNodeKind } from "./buildBpmn";

/** BPMN 2.0 元素名（含 namespace 前綴）。 */
const ELEMENT: Record<BpmnNodeKind, string> = {
  startEvent: "bpmn:startEvent",
  endEvent: "bpmn:endEvent",
  userTask: "bpmn:userTask",
  exclusiveGateway: "bpmn:exclusiveGateway",
};

/** XML 文字節點與屬性值的轉義。 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 邊的兩個端點：順向由來源右緣連到目標左緣，回邊（目標在左）反過來走；兩點直線、不繞線。 */
function waypoints(source: BpmnNode, target: BpmnNode): Array<{ x: number; y: number }> {
  const forward = target.x >= source.x;
  return [
    {
      x: forward ? source.x + source.width : source.x,
      y: source.y + source.height / 2,
    },
    {
      x: forward ? target.x : target.x + target.width,
      y: target.y + target.height / 2,
    },
  ];
}

function renderNode(node: BpmnNode): string {
  const element = ELEMENT[node.kind];
  const name = node.name ? ` name="${escapeXml(node.name)}"` : "";
  if (!node.documentation) {
    return `    <${element} id="${node.id}"${name} />`;
  }
  return [
    `    <${element} id="${node.id}"${name}>`,
    `      <bpmn:documentation>${escapeXml(node.documentation)}</bpmn:documentation>`,
    `    </${element}>`,
  ].join("\n");
}

function renderFlow(flow: BpmnFlow): string {
  const name = flow.name ? ` name="${escapeXml(flow.name)}"` : "";
  return `    <bpmn:sequenceFlow id="${flow.id}"${name} sourceRef="${flow.sourceRef}" targetRef="${flow.targetRef}" />`;
}

function renderShape(node: BpmnNode): string {
  return [
    `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">`,
    `        <dc:Bounds x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" />`,
    "      </bpmndi:BPMNShape>",
  ].join("\n");
}

function renderEdge(flow: BpmnFlow, nodesById: ReadonlyMap<string, BpmnNode>): string {
  const points = waypoints(nodesById.get(flow.sourceRef)!, nodesById.get(flow.targetRef)!);
  return [
    `      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">`,
    ...points.map((point) => `        <di:waypoint x="${point.x}" y="${point.y}" />`),
    "      </bpmndi:BPMNEdge>",
  ].join("\n");
}

/**
 * 把 Navigation diagram 序列化成 BPMN 2.0 XML（含 BPMNDiagram／DI 座標，Modeler 開起來即有版面）。
 * 同一份 diagram 兩次序列化字串完全相同——確定性、重跑幂等。
 */
export function renderBpmn(diagram: BpmnDiagram): string {
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node] as const));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"' +
      ' xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"' +
      ' xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"' +
      ' xmlns:di="http://www.omg.org/spec/DD/20100524/DI"' +
      ' id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">',
    `  <bpmn:process id="${diagram.processId}" isExecutable="false">`,
    ...diagram.nodes.map(renderNode),
    ...diagram.flows.map(renderFlow),
    "  </bpmn:process>",
    '  <bpmndi:BPMNDiagram id="BPMNDiagram_1">',
    `    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${diagram.processId}">`,
    ...diagram.nodes.map(renderShape),
    ...diagram.flows.map((flow) => renderEdge(flow, nodesById)),
    "    </bpmndi:BPMNPlane>",
    "  </bpmndi:BPMNDiagram>",
    "</bpmn:definitions>",
    "",
  ].join("\n");
}

/**
 * 把 XML 寫成 output/<project>/workflow.bpmn，回傳寫入路徑。缺目錄會自動建立。
 * 它是交付物、不是交接檔：重跑直接覆寫（排版手改請自行另存副本）。
 */
export function saveBpmn(outputRoot: string, project: string, xml: string): string {
  const path = contractPath(outputRoot, project, "bpmn");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, xml, "utf8");
  return path;
}
