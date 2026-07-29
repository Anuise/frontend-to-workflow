import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { contractPath } from "../output";
import type { DiagramEdge, DiagramNode, NavigationDiagram } from "./buildDiagram";

/** draw.io 的節點樣式：入口是小綠圓、Page 是圓角方框。 */
const NODE_STYLE: Record<DiagramNode["kind"], string> = {
  entry: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=9;",
  page: "rounded=1;whiteSpace=wrap;html=1;verticalAlign=middle;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=9;",
};

/** 邊一律走直角、繞路交給 draw.io 自己算；label 壓白底才不被線劃穿。 */
const EDGE_STYLE =
  "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;fontSize=8;labelBackgroundColor=#ffffff;";

/** 版面右下再留的白邊。 */
const PAGE_MARGIN = 200;

/** XML 屬性值的轉義。 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * tooltip 由 draw.io 當 HTML 渲染，換行要靠 <br>。
 * 先做一般轉義、最後才補 &lt;br&gt;，避免這個 br 被二次轉義成字面字串。
 */
function escapeTooltip(value: string): string {
  return escapeXml(value).replace(/\n/g, "&lt;br&gt;");
}

function renderNode(node: DiagramNode): string {
  const geometry = `<mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry" />`;
  const style = NODE_STYLE[node.kind];
  if (!node.tooltip) {
    return [
      `        <mxCell id="${node.id}" value="${escapeXml(node.label)}" style="${style}" vertex="1" parent="1">`,
      `          ${geometry}`,
      "        </mxCell>",
    ].join("\n");
  }
  // 帶 tooltip 的節點要包一層 UserObject——mxCell 本身沒有 tooltip 屬性
  return [
    `        <UserObject id="${node.id}" label="${escapeXml(node.label)}" tooltip="${escapeTooltip(node.tooltip)}">`,
    `          <mxCell style="${style}" vertex="1" parent="1">`,
    `            ${geometry}`,
    "          </mxCell>",
    "        </UserObject>",
  ].join("\n");
}

function renderEdge(edge: DiagramEdge): string {
  return [
    `        <mxCell id="${edge.id}" value="${edge.label ? escapeXml(edge.label) : ""}" style="${EDGE_STYLE}" edge="1" parent="1" source="${edge.sourceId}" target="${edge.targetId}">`,
    '          <mxGeometry relative="1" as="geometry" />',
    "        </mxCell>",
  ].join("\n");
}

/**
 * 把 Navigation diagram 序列化成 draw.io 的 mxGraphModel XML（明文、不壓縮）。
 * 同一份 diagram 兩次序列化字串完全相同——確定性、重跑幂等。
 * 刻意不寫 draw.io 存檔時會補的 modified／etag／agent／version：那些帶時間戳，會破壞確定性。
 */
export function renderDiagram(diagram: NavigationDiagram): string {
  const width = Math.max(0, ...diagram.nodes.map((node) => node.x + node.width)) + PAGE_MARGIN;
  const height = Math.max(0, ...diagram.nodes.map((node) => node.y + node.height)) + PAGE_MARGIN;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="f2w-diagram">',
    `  <diagram id="Diagram_1" name="${escapeXml(diagram.name)}">`,
    `    <mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">`,
    "      <root>",
    '        <mxCell id="0" />',
    '        <mxCell id="1" parent="0" />',
    ...diagram.nodes.map(renderNode),
    ...diagram.edges.map(renderEdge),
    "      </root>",
    "    </mxGraphModel>",
    "  </diagram>",
    "</mxfile>",
    "",
  ].join("\n");
}

/**
 * 把 XML 寫成 output/<project>/workflow.drawio，回傳寫入路徑。缺目錄會自動建立。
 * 它是交付物、不是交接檔：重跑直接覆寫（版面手改請自行另存副本）。
 */
export function saveDiagram(outputRoot: string, project: string, xml: string): string {
  const path = contractPath(outputRoot, project, "diagram");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, xml, "utf8");
  return path;
}
