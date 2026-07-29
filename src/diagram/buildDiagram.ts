import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";

/** Navigation diagram 上只有兩種節點：進場記號與 Page。 */
export type DiagramNodeKind = "entry" | "page";

/** 單一節點：語意（id／種類／標籤／提示）＋座標與尺寸。 */
export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label: string;
  /** 不換頁的操作；畫成 draw.io 的 tooltip，不佔版面。 */
  tooltip?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 單一有向邊；label 為該換頁操作的說明。 */
export interface DiagramEdge {
  id: string;
  label?: string;
  sourceId: string;
  targetId: string;
}

/** 組好的 Navigation diagram：節點、邊，以及需要人回頭處理的提醒。 */
export interface NavigationDiagram {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** 純循環無終點、孤立頁等情形；由 f2w-diagram 原文回報給使用者。 */
  warnings: string[];
}

/** 操作去向指向 pages 裡不存在的 Page 時丟出——手改過的 workflow.json 有斷掉的去向。 */
export class DiagramConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagramConsistencyError";
  }
}

/** 唯一的進場記號 id。 */
export const ENTRY_NODE_ID = "Entry_1";

/** 進場記號的標籤：回答「使用者從哪一頁進場」。 */
export const ENTRY_LABEL = "入口";

/** 每頁一個節點，id 前綴固定。 */
const PAGE_ID_PREFIX = "Page_";

/** 全圖每個 Page 都有換頁出口時的提醒（導覽為循環，沒有任何葉頁）。 */
export const NO_LEAF_PAGE_WARNING =
  "此圖無終點：每個 Page 都有換頁出口，導覽為循環，沒有任何葉頁。";

/** 孤立頁（從入口走不到）的提醒；列出 route 讓人回頭補 workflow.json 的操作去向。 */
export function isolatedPagesWarning(pages: readonly PageId[]): string {
  const labels = pages.map(pageLabel).join("、");
  return `以下 Page 從入口走不到，已另列一區且不接入口記號：${labels}。若非本意，回頭補 workflow.json 中指向它們的操作去向（f2w-capture 的已知盲點：hash routing、非 <a> 導覽）。`;
}

// 節點尺寸與間距（像素）。Page 方框加寬到 160 才放得下中文用途；欄距留給邊的直角轉折。
const PAGE_WIDTH = 160;
const PAGE_HEIGHT = 80;
const ENTRY_SIZE = 36;
const COLUMN_SPACING = 260;
const ROW_SPACING = 140;
const BAND_GAP = 200; // 主圖與孤立頁區之間的留白
const ORIGIN_X = 60;
const ORIGIN_Y = 80;

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/** 轉成 id 可用的片段：保留字母（含中日文）／數字／底線，其餘一律換成底線並修掉頭尾。 */
function toIdSlug(raw: string): string {
  const slug = raw.replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "");
  return slug || "root";
}

/**
 * 為每個 Page 定節點 id：由正規化 route(+tab) 衍生，好從圖回溯到 Page。
 * 兩頁 slug 相同時（例如 tab 名去掉符號後撞在一起）依 workflow.json 順序補 _2、_3。
 */
function assignPageIds(pages: readonly WorkflowPage[]): Map<string, string> {
  const used = new Set<string>();
  const ids = new Map<string, string>();
  for (const page of pages) {
    const base = `${PAGE_ID_PREFIX}${toIdSlug(page.tab ? `${page.route}_${page.tab}` : page.route)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
    used.add(id);
    ids.set(pageIdKey(page), id);
  }
  return ids;
}

/** 該頁的換頁操作（destination 非 null）；不換頁的操作不成邊。 */
function navigatingActions(page: WorkflowPage): Array<WorkflowAction & { destination: PageId }> {
  return page.actions.filter(
    (action): action is WorkflowAction & { destination: PageId } => action.destination !== null,
  );
}

/** 不換頁的操作寫進該節點的 tooltip：資訊不掉，但不佔版面。 */
function stayingTooltip(page: WorkflowPage): string | undefined {
  const staying = page.actions.filter((action) => action.destination === null);
  if (staying.length === 0) return undefined;
  return ["不換頁的操作：", ...staying.map((action) => `• ${action.label}`)].join("\n");
}

/** 操作去向必須指向 pages 內存在的 Page，否則畫不出邊。 */
function requireKnownDestinations(workflow: Workflow): void {
  const known = new Set(workflow.pages.map(pageIdKey));
  for (const page of workflow.pages) {
    for (const action of navigatingActions(page)) {
      if (!known.has(pageIdKey(action.destination))) {
        throw new DiagramConsistencyError(
          `Page ${pageLabel(page)} 的操作「${action.label}」指向不存在的 Page ${pageLabel(action.destination)}`,
        );
      }
    }
  }
}

/** 從入口（pages[0]）沿換頁操作做 BFS，回傳每個可達 Page 的層級；走不到的 Page 不在表內。 */
function bfsDepths(workflow: Workflow): Map<string, number> {
  const byKey = new Map(workflow.pages.map((page) => [pageIdKey(page), page] as const));
  const entry = pageIdKey(workflow.pages[0]!);
  const depths = new Map<string, number>([[entry, 0]]);
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]!;
    for (const action of navigatingActions(byKey.get(key)!)) {
      const next = pageIdKey(action.destination);
      if (depths.has(next)) continue;
      depths.set(next, depths.get(key)! + 1);
      queue.push(next);
    }
  }
  return depths;
}

/**
 * 由 Workflow description 組出 Navigation diagram（確定性核心，不碰 fs）。
 *
 * 語意映射：
 *  - 每個 Page 一個節點（id 由正規化 route(+tab) 衍生、label 為頁面用途）。
 *  - 每個換頁操作一條邊，label 為操作說明；一頁多出口就直接拉多條邊，不插分歧節點。
 *  - 不換頁的操作寫進該節點的 tooltip。
 *  - `pages[0]` 接進場記號；葉頁（無換頁出口）就是沒有出邊，不補終點節點。
 *
 * layout：進場記號為第 0 欄；可達 Page 依 BFS 層級決定欄、依該層內的 workflow.json 原順序決定列；
 * 孤立頁（從入口走不到）不接進場記號、不分層，於主圖下方另一區堆疊。
 */
export function buildDiagram(workflow: Workflow): NavigationDiagram {
  requireKnownDestinations(workflow);

  const pageIds = assignPageIds(workflow.pages);
  const depths = bfsDepths(workflow);
  const isolated = workflow.pages.filter((page) => !depths.has(pageIdKey(page)));

  // 欄＝BFS 層（+1 讓第 0 欄留給進場記號）、列＝該層內的 workflow.json 原順序
  const cells = new Map<string, { column: number; row: number }>();
  const rowsPerDepth = new Map<number, number>();
  for (const page of workflow.pages) {
    const depth = depths.get(pageIdKey(page));
    if (depth === undefined) continue;
    const row = rowsPerDepth.get(depth) ?? 0;
    rowsPerDepth.set(depth, row + 1);
    cells.set(pageIdKey(page), { column: 1 + depth, row });
  }
  const mainRows = Math.max(0, ...rowsPerDepth.values());
  // 孤立頁區的起始列：主圖最後一列再往下留 BAND_GAP
  const isolatedFirstRow = mainRows + Math.ceil(BAND_GAP / ROW_SPACING);

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const addNode = (
    node: Pick<DiagramNode, "id" | "kind" | "label" | "tooltip">,
    column: number,
    row: number,
  ): void => {
    const width = node.kind === "entry" ? ENTRY_SIZE : PAGE_WIDTH;
    const height = node.kind === "entry" ? ENTRY_SIZE : PAGE_HEIGHT;
    nodes.push({
      ...node,
      width,
      height,
      // 窄節點在欄內、列內都對齊 Page 方框的中線，圖才不會歪
      x: ORIGIN_X + column * COLUMN_SPACING + (PAGE_WIDTH - width) / 2,
      y: ORIGIN_Y + row * ROW_SPACING + (PAGE_HEIGHT - height) / 2,
    });
  };

  const addEdge = (sourceId: string, targetId: string, label?: string): void => {
    edges.push({ id: `Edge_${edges.length + 1}`, sourceId, targetId, label });
  };

  addNode({ id: ENTRY_NODE_ID, kind: "entry", label: ENTRY_LABEL }, 0, 0);
  addEdge(ENTRY_NODE_ID, pageIds.get(pageIdKey(workflow.pages[0]!))!);

  for (const page of workflow.pages) {
    const cell = cells.get(pageIdKey(page));
    addNode(
      {
        id: pageIds.get(pageIdKey(page))!,
        kind: "page",
        label: page.purpose,
        tooltip: stayingTooltip(page),
      },
      cell ? cell.column : 1,
      cell ? cell.row : isolatedFirstRow + isolated.indexOf(page),
    );
  }

  for (const page of workflow.pages) {
    const sourceId = pageIds.get(pageIdKey(page))!;
    for (const action of navigatingActions(page)) {
      addEdge(sourceId, pageIds.get(pageIdKey(action.destination))!, action.label);
    }
  }

  const warnings: string[] = [];
  const hasLeafPage = workflow.pages.some((page) => navigatingActions(page).length === 0);
  if (!hasLeafPage) warnings.push(NO_LEAF_PAGE_WARNING);
  if (isolated.length > 0) warnings.push(isolatedPagesWarning(isolated));

  return { name: workflow.project, nodes, edges, warnings };
}
