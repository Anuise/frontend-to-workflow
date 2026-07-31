import { readFileSync } from "node:fs";

/** 圖上的矩形（座標已由 parent 鏈累加成絕對值）。 */
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 權責泳道圖上的一個節點；`party` 為所屬分工方，落在泳道外時為 undefined。 */
export interface SwimlaneNode {
  id: string;
  value: string;
  party?: string;
}

/**
 * 權責泳道圖解析結果（確定性，不經 AI）。
 * - `parties`：泳道名，依文件順序，即分工方集合的唯一來源。
 * - `nodes`：泳道內外的實體節點（純標籤 cell 與最下方泳道底緣之外的圖例已排除）。
 * - `partyEdges`：由邊算出的方層跳躍（兩端方不同才算一條），已去重。
 * - `declaredChains`：人寫在圖上的 API 呼叫鏈宣告，非泳道名的 token（如 frontend）已丟掉。
 * - `warnings`：邊有一端不屬任一方、或宣告鏈的某個相鄰跳躍在邊圖上找不到支持。
 */
export interface SwimlaneGraph {
  parties: string[];
  nodes: SwimlaneNode[];
  partyEdges: Array<[string, string]>;
  declaredChains: string[][];
  warnings: string[];
}

/** 泳道圖不是合法 mxfile、或裡面找不到任何泳道時丟出。 */
export class SwimlaneDiagramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwimlaneDiagramError";
  }
}

/** 宣告鏈的序號標記：①…⑩。用它切出「只有三種鏈」那句話裡的各條鏈。 */
const CIRCLED_NUMERALS = /[①-⑩]/;

/** 宣告鏈的箭頭。 */
const CHAIN_ARROW = "→";

/** mxCell／mxGeometry 的屬性。 */
type Attrs = Record<string, string>;

/** XML 屬性值的還原（draw.io 只會用到這五個實體）。 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:#39|apos);/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  for (const m of source.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[m[1]!] = decodeEntities(m[2]!);
  }
  return attrs;
}

function num(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 一個 mxCell 的原始形態（座標仍相對於 parent）。 */
interface RawCell {
  id: string;
  value: string;
  style: string;
  parent: string;
  source?: string;
  target?: string;
  geometry?: Rect;
}

/**
 * 把 mxGraphModel XML 掃成 mxCell 清單。
 * mxCell 在 draw.io 的存檔裡不巢狀，所以「下一個 </mxCell> 之前的第一個 mxGeometry」就是自己的幾何。
 */
function scanCells(xml: string): RawCell[] {
  const cells: RawCell[] = [];
  const cellPattern = /<mxCell\b([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null = cellPattern.exec(xml);
  while (match !== null) {
    const attrs = parseAttrs(match[1]!);
    const id = attrs.id;
    if (id !== undefined) {
      let geometry: Rect | undefined;
      if (match[2] !== "/") {
        const end = xml.indexOf("</mxCell>", cellPattern.lastIndex);
        const body = xml.slice(cellPattern.lastIndex, end === -1 ? undefined : end);
        const g = /<mxGeometry\b([^>]*?)\/?>/.exec(body);
        if (g) {
          const ga = parseAttrs(g[1]!);
          geometry = { x: num(ga.x), y: num(ga.y), width: num(ga.width), height: num(ga.height) };
        }
      }
      cells.push({
        id,
        value: attrs.value ?? "",
        style: attrs.style ?? "",
        parent: attrs.parent ?? "",
        source: attrs.source,
        target: attrs.target,
        geometry,
      });
    }
    match = cellPattern.exec(xml);
  }
  return cells;
}

/** 子 cell 的座標相對於 parent，累加整條 parent 鏈才是絕對座標。 */
function absoluteRect(cell: RawCell, byId: ReadonlyMap<string, RawCell>): Rect | undefined {
  if (!cell.geometry) return undefined;
  let { x, y } = cell.geometry;
  const seen = new Set([cell.id]);
  let parent = byId.get(cell.parent);
  while (parent !== undefined && !seen.has(parent.id)) {
    seen.add(parent.id);
    if (parent.geometry) {
      x += parent.geometry.x;
      y += parent.geometry.y;
    }
    parent = byId.get(parent.parent);
  }
  return { x, y, width: cell.geometry.width, height: cell.geometry.height };
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** 沿 parent 鏈上溯，回傳第一個泳道的方名。 */
function partyByParentChain(
  cell: RawCell,
  byId: ReadonlyMap<string, RawCell>,
  lanes: ReadonlyMap<string, string>,
): string | undefined {
  const seen = new Set([cell.id]);
  let parent = byId.get(cell.parent);
  while (parent !== undefined && !seen.has(parent.id)) {
    const party = lanes.get(parent.id);
    if (party !== undefined) return party;
    seen.add(parent.id);
    parent = byId.get(parent.parent);
  }
  return undefined;
}

/** 把宣告鏈那句話切成多條鏈；不是泳道名的 token（如 frontend）丟掉。 */
function parseDeclaredChains(text: string, parties: ReadonlySet<string>): string[][] {
  return text
    .split(CIRCLED_NUMERALS)
    .slice(1) // 第一段是「API 呼叫鏈只有三種：」這類前綴
    .map((segment) =>
      segment
        .split(CHAIN_ARROW)
        .map((token) => token.trim())
        .filter((token) => parties.has(token)),
    )
    .filter((chain) => chain.length > 0);
}

/**
 * 把一份 draw.io 權責泳道圖解析成方層事實（確定性，不經 AI，與 parseVendorSpec 對稱）。
 *
 * 解析規則：
 * 1. 泳道＝`style` 以 `swimlane` 開頭的 cell，`value` 即分工方名。
 * 2. 節點歸屬先走 `parent` 鏈上溯到泳道；掛在 root 的節點以矩形包含補判。
 * 3. 排除 `style` 以 `text` 開頭的純標籤 cell，以及幾何落在最下方泳道底緣之外的圖例色塊。
 * 4. 方層跳躍：邊的兩端解析到所屬方，兩端方不同即一條 partyEdges；指向群組框的邊
 *    fan-out 到框內成員。任一端不屬任一方時不產生跳躍，改列進 warnings。
 * 5. 宣告鏈：讀寫著呼叫鏈宣告的 cell（帶序號①…⑩與箭頭），依序號切鏈、按箭頭切 token。
 * 6. 交叉檢查：宣告鏈的相鄰跳躍在 partyEdges 找不到支持時發 warning，**不中止**——
 *    邊圖是結構事實但不封閉，宣告文字才是權威（見 ADR-0014）。
 *
 * 刻意不做「哪一格對應哪個工項」的配對，那仍是 AI 的事
 * （見 docs/adr/0007-party-assignment-from-swimlane-diagram.md）。
 */
export function parseSwimlaneDiagram(diagramPath: string): SwimlaneGraph {
  let xml: string;
  try {
    xml = readFileSync(diagramPath, "utf8");
  } catch (e) {
    throw new SwimlaneDiagramError(`權責泳道圖讀不到：${diagramPath}（${(e as Error).message}）`);
  }
  if (!xml.includes("<mxfile") || !xml.includes("<mxGraphModel")) {
    throw new SwimlaneDiagramError(`權責泳道圖不是合法 mxfile：${diagramPath}`);
  }

  const cells = scanCells(xml);
  const byId = new Map(cells.map((c) => [c.id, c]));

  // 1. 泳道
  const laneCells = cells.filter((c) => c.style.startsWith("swimlane") && c.value.trim() !== "");
  if (laneCells.length === 0) {
    throw new SwimlaneDiagramError(
      `權責泳道圖裡找不到任何泳道（style 以 swimlane 開頭的 cell）：${diagramPath}`,
    );
  }
  const laneParty = new Map(laneCells.map((c) => [c.id, c.value.trim()]));
  const parties = [...new Set(laneCells.map((c) => c.value.trim()))];
  const partySet = new Set(parties);
  const laneRects = laneCells.flatMap((c) => {
    const rect = absoluteRect(c, byId);
    return rect ? [{ party: laneParty.get(c.id)!, rect }] : [];
  });
  const lanesBottom = Math.max(...laneRects.map((l) => l.rect.y + l.rect.height));

  // 2＋3. 節點與歸屬：排除泳道自身、邊、純標籤 cell、以及最下方泳道底緣之外的圖例
  const rectById = new Map<string, Rect>();
  const nodes: SwimlaneNode[] = [];
  for (const cell of cells) {
    if (laneParty.has(cell.id)) continue;
    if (cell.source !== undefined || cell.target !== undefined) continue;
    if (cell.style.startsWith("text")) continue;
    const rect = absoluteRect(cell, byId);
    if (!rect) continue;
    if (rect.y >= lanesBottom) continue;
    const party =
      partyByParentChain(cell, byId, laneParty) ??
      laneRects.find((lane) => contains(lane.rect, rect))?.party;
    rectById.set(cell.id, rect);
    nodes.push(
      party === undefined
        ? { id: cell.id, value: cell.value }
        : { id: cell.id, value: cell.value, party },
    );
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 一端不屬任一方時，若它是群組框就 fan-out 到框內成員（框本身沒有方，成員可能有）。
  const partiesOfEnd = (id: string): string[] => {
    const own = nodeById.get(id)?.party;
    if (own !== undefined) return [own];
    const rect = rectById.get(id);
    if (!rect) return [];
    return [
      ...new Set(
        nodes
          .filter((n) => n.id !== id && n.party !== undefined && contains(rect, rectById.get(n.id)!))
          .map((n) => n.party!),
      ),
    ];
  };

  // 4. 方層跳躍
  const warnings: string[] = [];
  const partyEdges: Array<[string, string]> = [];
  const seenEdges = new Set<string>();
  for (const cell of cells) {
    if (cell.source === undefined || cell.target === undefined) continue;
    const from = partiesOfEnd(cell.source);
    const to = partiesOfEnd(cell.target);
    if (from.length === 0 || to.length === 0) {
      const orphan = from.length === 0 ? cell.source : cell.target;
      warnings.push(`邊 ${cell.id}（${cell.source} → ${cell.target}）有一端不屬任一方：${orphan}`);
      continue;
    }
    for (const a of from) {
      for (const b of to) {
        if (a === b) continue;
        const key = `${a} ${b}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        partyEdges.push([a, b]);
      }
    }
  }

  // 5. 宣告鏈
  const declarationCell = cells.find(
    (c) => CIRCLED_NUMERALS.test(c.value) && c.value.includes(CHAIN_ARROW),
  );
  const declaredChains = declarationCell
    ? parseDeclaredChains(declarationCell.value, partySet)
    : [];
  if (declaredChains.length === 0) {
    warnings.push("圖上找不到 API 呼叫鏈宣告（帶序號①…⑩與箭頭的 cell），無法推出宣告鏈");
  }

  // 6. 交叉檢查：宣告鏈的相鄰跳躍是否有邊圖支持
  for (const chain of declaredChains) {
    for (let i = 1; i < chain.length; i += 1) {
      const [a, b] = [chain[i - 1]!, chain[i]!];
      if (seenEdges.has(`${a} ${b}`)) continue;
      warnings.push(
        `宣告鏈 ${chain.join(` ${CHAIN_ARROW} `)} 的跳躍 ${a} ${CHAIN_ARROW} ${b} 在圖上找不到對應的邊`,
      );
    }
  }

  return { parties, nodes, partyEdges, declaredChains, warnings };
}

/**
 * 取出宣告鏈供下游當鏈硬底線用。
 * 宣告鏈是權威（人寫的、封閉），邊圖只當交叉檢查（結構事實但不封閉）——見 ADR-0014。
 */
export function derivePartyChains(graph: SwimlaneGraph): string[][] {
  return graph.declaredChains.map((chain) => [...chain]);
}
