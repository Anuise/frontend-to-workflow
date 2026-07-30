import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { contractPath } from "../output";
import type { DiagramEdge, DiagramNode, DiagramPage, MainFlowDiagram } from "./buildDiagram";

/**
 * 每條主線一個色系（依主線順序取，超過就循環）。
 * 用 draw.io 的標準配色，印黑白時淡底仍分得出深淺。
 */
const FLOW_PALETTE = [
  { fill: "#dae8fc", stroke: "#6c8ebf" },
  { fill: "#d5e8d4", stroke: "#82b366" },
  { fill: "#ffe6cc", stroke: "#d79b00" },
  { fill: "#e1d5e7", stroke: "#9673a6" },
  { fill: "#fff2cc", stroke: "#d6b656" },
  { fill: "#f8cecc", stroke: "#b85450" },
  { fill: "#b0e3e6", stroke: "#0e8088" },
  { fill: "#d0cee2", stroke: "#56517e" },
  { fill: "#eeeeee", stroke: "#666666" },
] as const;

function colorOf(colorIndex: number): (typeof FLOW_PALETTE)[number] {
  return FLOW_PALETTE[colorIndex % FLOW_PALETTE.length]!;
}

/** 步驟框：圓角、淡底、深框線，兩段式文字置中。 */
function stepStyle(colorIndex: number): string {
  const { fill, stroke } = colorOf(colorIndex);
  return `rounded=1;arcSize=12;whiteSpace=wrap;html=1;verticalAlign=middle;fillColor=${fill};strokeColor=${stroke};fontSize=12;`;
}

/** 主線標題：24px 粗體、無框無底，字色跟著該主線的色系。 */
function flowTitleStyle(colorIndex: number): string {
  return `text;html=1;whiteSpace=wrap;align=left;verticalAlign=middle;strokeColor=none;fillColor=none;fontSize=24;fontStyle=1;fontColor=${colorOf(colorIndex).stroke};`;
}

/** 標題下的細橫線：同色系的實心細長方形。 */
function ruleStyle(colorIndex: number): string {
  return `rounded=0;html=1;fillColor=${colorOf(colorIndex).stroke};strokeColor=none;`;
}

/** 邊一律走直角、繞路交給 draw.io 自己算；label 壓白底才不被線劃穿。 */
const EDGE_STYLE =
  "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;fontSize=10;fontColor=#666666;strokeColor=#999999;labelBackgroundColor=#ffffff;";

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

/**
 * 節點的顯示值。步驟是兩段式：第一行粗體「編號＋業務動作名」負責掃視、第二行小字說明負責理解。
 * 整串 HTML escape 一次——draw.io 讀進屬性後還原成標記再以 html=1 渲染。
 */
function nodeValue(node: DiagramNode): string {
  if (!node.title) return escapeXml(node.label);
  return escapeXml(`<b>${node.title}</b><br><font style="font-size:10px">${node.label}</font>`);
}

function styleOf(node: DiagramNode): string {
  if (node.kind === "flowTitle") return flowTitleStyle(node.colorIndex);
  if (node.kind === "rule") return ruleStyle(node.colorIndex);
  return stepStyle(node.colorIndex);
}

function renderNode(node: DiagramNode): string {
  const geometry = `<mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry" />`;
  const style = styleOf(node);
  if (!node.tooltip) {
    return [
      `        <mxCell id="${node.id}" value="${nodeValue(node)}" style="${style}" vertex="1" parent="1">`,
      `          ${geometry}`,
      "        </mxCell>",
    ].join("\n");
  }
  // 帶 tooltip 的節點要包一層 UserObject——mxCell 本身沒有 tooltip 屬性
  return [
    `        <UserObject id="${node.id}" label="${nodeValue(node)}" tooltip="${escapeTooltip(node.tooltip)}">`,
    `          <mxCell style="${style}" vertex="1" parent="1">`,
    `            ${geometry}`,
    "          </mxCell>",
    "        </UserObject>",
  ].join("\n");
}

function renderEdge(edge: DiagramEdge): string {
  return [
    `        <mxCell id="${edge.id}" value="${escapeXml(edge.label)}" style="${EDGE_STYLE}" edge="1" parent="1" source="${edge.sourceId}" target="${edge.targetId}">`,
    '          <mxGeometry relative="1" as="geometry" />',
    "        </mxCell>",
  ].join("\n");
}

function renderPage(page: DiagramPage): string[] {
  const width = Math.max(0, ...page.nodes.map((node) => node.x + node.width)) + PAGE_MARGIN;
  const height = Math.max(0, ...page.nodes.map((node) => node.y + node.height)) + PAGE_MARGIN;
  return [
    `  <diagram id="${escapeXml(page.id)}" name="${escapeXml(page.name)}">`,
    `    <mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">`,
    "      <root>",
    '        <mxCell id="0" />',
    '        <mxCell id="1" parent="0" />',
    ...page.nodes.map(renderNode),
    ...page.edges.map(renderEdge),
    "      </root>",
    "    </mxGraphModel>",
    "  </diagram>",
  ];
}

/**
 * 把 Main flow diagram 序列化成 draw.io 的 mxGraphModel XML（明文、不壓縮）。
 * 一條主線一個 <diagram> 分頁，最後一個是總覽。同一份 diagram 兩次序列化字串完全相同——確定性、重跑幂等。
 * 刻意不寫 draw.io 存檔時會補的 modified／etag／agent／version：那些帶時間戳，會破壞確定性。
 */
export function renderDiagram(diagram: MainFlowDiagram): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="f2w-diagram">',
    ...diagram.pages.flatMap(renderPage),
    "</mxfile>",
    "",
  ].join("\n");
}

/**
 * 把 XML 寫成 output/<project>/mainflow.drawio，回傳寫入路徑。缺目錄會自動建立。
 * 它是交付物、不是交接檔：重跑直接覆寫（版面手改請自行另存副本）。
 */
export function saveDiagram(outputRoot: string, project: string, xml: string): string {
  const path = contractPath(outputRoot, project, "diagram");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, xml, "utf8");
  return path;
}
