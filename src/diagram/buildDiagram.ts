import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";
import { type Section, groupIntoSections } from "./sections";

/** Navigation diagram 上的節點種類。 */
export type DiagramNodeKind = "entry" | "globalNav" | "section" | "page";

/** 單一節點：語意（id／種類／標籤／提示／連結）＋座標與尺寸。 */
export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label: string;
  /** 不換頁的操作；畫成 draw.io 的 tooltip，不佔版面。 */
  tooltip?: string;
  /** 點擊要跳去的分頁 id；只有總覽頁的 Section 方框有。 */
  linkToPageId?: string;
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

/** draw.io 的一個分頁：總覽頁，或一個 Section。 */
export interface DiagramPage {
  id: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** 組好的 Navigation diagram：一頁總覽 ＋ 每個 Section 一頁，以及需要人回頭處理的提醒。 */
export interface NavigationDiagram {
  name: string;
  pages: DiagramPage[];
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

/** 唯一的全域導覽記號 id。 */
export const GLOBAL_NAV_NODE_ID = "GlobalNav_1";

/** 全域導覽記號的標籤：側欄可從任一頁跳到各 Section 的首頁。 */
export const GLOBAL_NAV_LABEL = "全域導覽（側欄）";

/** 總覽分頁的 id 與名稱。 */
export const OVERVIEW_PAGE_ID = "Diagram_1";
export const OVERVIEW_PAGE_NAME = "總覽";

/** 每頁一個節點，id 前綴固定。 */
const PAGE_ID_PREFIX = "Page_";

/** 每個 Section 一個方框，id 前綴固定。 */
const SECTION_ID_PREFIX = "Section_";

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
const GLOBAL_NAV_WIDTH = 160;
const GLOBAL_NAV_HEIGHT = 40;
const SECTION_WIDTH = 200;
const SECTION_HEIGHT = 60;
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

/** 依既有 id 集合配一個不撞名的 id：撞名依序補 _2、_3。 */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
  used.add(id);
  return id;
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
    ids.set(pageIdKey(page), uniqueId(base, used));
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

/** 節點種類決定尺寸。 */
function sizeOf(kind: DiagramNodeKind): { width: number; height: number } {
  if (kind === "entry") return { width: ENTRY_SIZE, height: ENTRY_SIZE };
  if (kind === "globalNav") return { width: GLOBAL_NAV_WIDTH, height: GLOBAL_NAV_HEIGHT };
  if (kind === "section") return { width: SECTION_WIDTH, height: SECTION_HEIGHT };
  return { width: PAGE_WIDTH, height: PAGE_HEIGHT };
}

/** 一個分頁的組裝器：把「第幾欄第幾列」換算成座標，並發不撞名的邊 id。 */
class PageBuilder {
  readonly nodes: DiagramNode[] = [];
  readonly edges: DiagramEdge[] = [];

  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly nextEdgeId: () => string,
  ) {}

  addNode(
    node: Pick<DiagramNode, "id" | "kind" | "label" | "tooltip" | "linkToPageId">,
    column: number,
    row: number,
  ): void {
    const { width, height } = sizeOf(node.kind);
    this.nodes.push({
      ...node,
      width,
      height,
      // 窄節點在欄內、列內都對齊最寬節點的中線，圖才不會歪
      x: ORIGIN_X + column * COLUMN_SPACING + (SECTION_WIDTH - width) / 2,
      y: ORIGIN_Y + row * ROW_SPACING + (PAGE_HEIGHT - height) / 2,
    });
  }

  addEdge(sourceId: string, targetId: string, label?: string): void {
    this.edges.push({ id: this.nextEdgeId(), sourceId, targetId, label });
  }

  toPage(): DiagramPage {
    return { id: this.id, name: this.name, nodes: this.nodes, edges: this.edges };
  }
}

/**
 * 由 Workflow description 組出 Navigation diagram（確定性核心，不碰 fs）。
 *
 * 分頁：第 1 頁總覽，之後每個 Section 一頁。
 *
 * 邊的處置：
 *  - 跨 Section 且目的地為該 Section 首頁 ⇒ 側欄的全域導覽，收成全域導覽記號發出的一條邊。
 *  - 跨 Section 且目的地非首頁 ⇒ 真實轉場，畫在總覽頁的 Section 方框之間。
 *  - 同 Section ⇒ 畫在該 Section 的分頁上。
 *  - 不換頁的操作 ⇒ 寫進該節點的 tooltip。
 */
export function buildDiagram(workflow: Workflow): NavigationDiagram {
  requireKnownDestinations(workflow);

  const pageIds = assignPageIds(workflow.pages);
  const sections = groupIntoSections(workflow.pages);
  const sectionOf = new Map<string, Section>();
  for (const section of sections) {
    for (const page of section.pages) sectionOf.set(pageIdKey(page), section);
  }

  const usedSectionIds = new Set<string>();
  const sectionIds = new Map<Section, string>();
  const sectionPageIds = new Map<Section, string>();
  sections.forEach((section, index) => {
    sectionIds.set(
      section,
      uniqueId(`${SECTION_ID_PREFIX}${toIdSlug(section.name)}`, usedSectionIds),
    );
    sectionPageIds.set(section, `Diagram_${index + 2}`);
  });

  let edgeSeq = 0;
  const nextEdgeId = () => `Edge_${++edgeSeq}`;

  const overview = new PageBuilder(OVERVIEW_PAGE_ID, OVERVIEW_PAGE_NAME, nextEdgeId);
  const builders = new Map<Section, PageBuilder>(
    sections.map((section) => [
      section,
      new PageBuilder(sectionPageIds.get(section)!, section.name, nextEdgeId),
    ]),
  );

  // ---- 總覽頁：進場記號、全域導覽記號、每個 Section 一個方框 ----
  overview.addNode({ id: ENTRY_NODE_ID, kind: "entry", label: ENTRY_LABEL }, 0, 0);
  overview.addNode({ id: GLOBAL_NAV_NODE_ID, kind: "globalNav", label: GLOBAL_NAV_LABEL }, 0, 1);
  sections.forEach((section, index) => {
    overview.addNode(
      {
        id: sectionIds.get(section)!,
        kind: "section",
        label: `${section.name}（${section.pages.length} 頁）`,
        linkToPageId: sectionPageIds.get(section)!,
      },
      1,
      index,
    );
  });
  overview.addEdge(ENTRY_NODE_ID, sectionIds.get(sectionOf.get(pageIdKey(workflow.pages[0]!))!)!);

  // ---- 邊的分類 ----
  const globalNavTargets = new Set<Section>();
  const crossSection: Array<{ from: Section; to: Section; label: string }> = [];
  for (const page of workflow.pages) {
    const from = sectionOf.get(pageIdKey(page))!;
    for (const action of navigatingActions(page)) {
      const to = sectionOf.get(pageIdKey(action.destination))!;
      if (from === to) {
        builders
          .get(from)!
          .addEdge(
            pageIds.get(pageIdKey(page))!,
            pageIds.get(pageIdKey(action.destination))!,
            action.label,
          );
        continue;
      }
      if (pageIdKey(to.pages[0]!) === pageIdKey(action.destination)) {
        globalNavTargets.add(to);
        continue;
      }
      crossSection.push({ from, to, label: action.label });
    }
  }
  for (const section of sections) {
    if (globalNavTargets.has(section)) {
      overview.addEdge(GLOBAL_NAV_NODE_ID, sectionIds.get(section)!);
    }
  }
  for (const { from, to, label } of crossSection) {
    overview.addEdge(sectionIds.get(from)!, sectionIds.get(to)!, label);
  }

  // ---- 各 Section 分頁：欄＝從入口 BFS 的層級、列＝該層內的原順序 ----
  const depths = bfsDepths(workflow);
  const isolated = workflow.pages.filter((page) => !depths.has(pageIdKey(page)));
  for (const section of sections) {
    const builder = builders.get(section)!;
    const rowsPerDepth = new Map<number, number>();
    const cells = new Map<string, { column: number; row: number }>();
    for (const page of section.pages) {
      const depth = depths.get(pageIdKey(page));
      if (depth === undefined) continue;
      const row = rowsPerDepth.get(depth) ?? 0;
      rowsPerDepth.set(depth, row + 1);
      cells.set(pageIdKey(page), { column: depth, row });
    }
    const mainRows = Math.max(0, ...rowsPerDepth.values());
    const isolatedFirstRow = mainRows + Math.ceil(BAND_GAP / ROW_SPACING);
    const sectionIsolated = section.pages.filter((page) => !cells.has(pageIdKey(page)));
    for (const page of section.pages) {
      const cell = cells.get(pageIdKey(page));
      builder.addNode(
        {
          id: pageIds.get(pageIdKey(page))!,
          kind: "page",
          label: page.purpose,
          tooltip: stayingTooltip(page),
        },
        cell ? cell.column : 0,
        cell ? cell.row : isolatedFirstRow + sectionIsolated.indexOf(page),
      );
    }
  }

  const warnings: string[] = [];
  const hasLeafPage = workflow.pages.some((page) => navigatingActions(page).length === 0);
  if (!hasLeafPage) warnings.push(NO_LEAF_PAGE_WARNING);
  if (isolated.length > 0) warnings.push(isolatedPagesWarning(isolated));

  return {
    name: workflow.project,
    pages: [overview.toPage(), ...sections.map((section) => builders.get(section)!.toPage())],
    warnings,
  };
}
