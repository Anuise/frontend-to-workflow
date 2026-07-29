import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";
import { type Section, groupIntoSections, hierarchyPath } from "./sections";

/** Navigation diagram 上的節點種類。 */
export type DiagramNodeKind = "entry" | "globalNav" | "section" | "implied" | "page";

/** 單一節點：語意（id／種類／標籤／提示／連結）＋座標與尺寸。 */
export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  /** 掃視用的短標題（階層路徑末段）；有它時 label 降為第二行小字。 */
  title?: string;
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
  /** 從兩端的下緣進出，繞到那一列底下走；總覽頁的橫向轉場才不會穿過中間的方框。 */
  routeBelow?: boolean;
}

/** 圈住同父 tab 子頁的框：它們彼此可直接切換，不畫成邊。 */
export interface DiagramGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** draw.io 的一個分頁：總覽頁，或一個 Section。 */
export interface DiagramPage {
  id: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
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

/** 隱含節點（麵包屑有這一段但沒有對應 Page）的 id 前綴。 */
const IMPLIED_ID_PREFIX = "Implied_";

/** tooltip 裡「子頁回上層」那一段的抬頭。 */
export const RETURN_TOOLTIP_HEADER = "返回操作：";

/** tab 群組框的標題；同父 tab 之間可直接切換，不畫成邊。 */
export const TAB_GROUP_LABEL = "可互相切換的 tab";

/** 孤立頁（從入口走不到）的標題前綴。 */
export const ISOLATED_MARK = "⚠ ";

/** 某 Section 切不出單根的麵包屑樹、已退回分層網格的提醒。 */
export function fallbackLayoutWarning(name: string): string {
  return `Section「${name}」切不出 ≥2 層階層，已退回分層網格；若非本意，回頭調整 f2w-capture 的 route／tab 命名。`;
}

/** 孤立頁（從入口走不到）的提醒；列出 route 讓人回頭補 workflow.json 的操作去向。 */
export function isolatedPagesWarning(pages: readonly PageId[]): string {
  const labels = pages.map(pageLabel).join("、");
  return `以下 Page 從入口走不到，已另列一區且不接入口記號：${labels}。若非本意，回頭補 workflow.json 中指向它們的操作去向（f2w-capture 的已知盲點：hash routing、非 <a> 導覽）。`;
}

// 節點尺寸與間距（像素）。Page 方框加寬到 160 才放得下中文用途；欄距留給邊的直角轉折。
const PAGE_WIDTH = 240;
const PAGE_HEIGHT = 100;
const ENTRY_SIZE = 36;
const IMPLIED_HEIGHT = 40;
const GLOBAL_NAV_WIDTH = 160;
const GLOBAL_NAV_HEIGHT = 40;
const SECTION_WIDTH = 200;
const SECTION_HEIGHT = 60;
/** 一格的寬度：所有節點在格內置中對齊，圖才不會歪。 */
const SLOT_WIDTH = 240;
const COLUMN_SPACING = 340;
const ROW_SPACING = 140;
const BAND_GAP = 200; // 主圖與孤立頁區之間的留白
/** 總覽頁上 Section 方框所在的列；上面兩列留給進場記號與全域導覽記號的邊。 */
const OVERVIEW_SECTION_ROW = 2;
const GROUP_PADDING = 16;
const GROUP_HEADER = 22;
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
  if (kind === "implied") return { width: PAGE_WIDTH, height: IMPLIED_HEIGHT };
  return { width: PAGE_WIDTH, height: PAGE_HEIGHT };
}

/** Section 內的麵包屑樹節點；沒有 page 的就是隱含節點（有段無實頁）。 */
interface TreeNode {
  segment: string;
  page?: WorkflowPage;
  children: TreeNode[];
}

/**
 * Section 內每個 Page 在該 Section 那一段上都同名時，才長得成一棵單根樹。
 * 收成單一 Section 的「切不出階層」情形在這裡會是 false，退回分層網格。
 */
function canFormTree(section: Section): boolean {
  return new Set(section.pages.map((page) => hierarchyPath(page)[section.depth] ?? "")).size === 1;
}

/** 依相對於 Section 根的階層路徑組樹；路徑中間缺實頁的段成為隱含節點。 */
function buildTree(section: Section): TreeNode {
  const root: TreeNode = { segment: section.name, children: [] };
  for (const page of section.pages) {
    const relative = hierarchyPath(page).slice(section.depth + 1);
    let node = root;
    let parent = root;
    for (const segment of relative) {
      let child = node.children.find((candidate) => candidate.segment === segment);
      if (!child) {
        child = { segment, children: [] };
        node.children.push(child);
      }
      parent = node;
      node = child;
    }
    // 兩頁的相對路徑撞在一起時掛成兄弟，不覆蓋——一個 Page 都不能掉。
    if (node.page === undefined) node.page = page;
    else parent.children.push({ segment: node.segment, page, children: [] });
  }
  return root;
}

/** 一個分頁的組裝器：把「第幾欄第幾列」換算成座標，並發不撞名的邊 id。 */
class PageBuilder {
  readonly nodes: DiagramNode[] = [];
  readonly edges: DiagramEdge[] = [];
  readonly groups: DiagramGroup[] = [];

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
      // 窄節點在欄內、列內都對齊格子的中線，圖才不會歪
      x: ORIGIN_X + column * COLUMN_SPACING + (SLOT_WIDTH - width) / 2,
      y: ORIGIN_Y + row * ROW_SPACING + (PAGE_HEIGHT - height) / 2,
    });
  }

  addEdge(sourceId: string, targetId: string, label?: string, routeBelow?: boolean): void {
    this.edges.push({ id: this.nextEdgeId(), sourceId, targetId, label, ...(routeBelow && { routeBelow }) });
  }

  /** 圈住一組節點：框住它們的外接矩形，上緣多留一條放標題。 */
  addGroup(id: string, label: string, memberIds: readonly string[]): void {
    const members = this.nodes.filter((node) => memberIds.includes(node.id));
    if (members.length === 0) return;
    const left = Math.min(...members.map((node) => node.x));
    const top = Math.min(...members.map((node) => node.y));
    const right = Math.max(...members.map((node) => node.x + node.width));
    const bottom = Math.max(...members.map((node) => node.y + node.height));
    this.groups.push({
      id,
      label,
      x: left - GROUP_PADDING,
      y: top - GROUP_PADDING - GROUP_HEADER,
      width: right - left + GROUP_PADDING * 2,
      height: bottom - top + GROUP_PADDING * 2 + GROUP_HEADER,
    });
  }

  toPage(): DiagramPage {
    return {
      id: this.id,
      name: this.name,
      nodes: this.nodes,
      edges: this.edges,
      groups: this.groups,
    };
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
  // Section 方框橫排一列、記號放上方：8 條全域導覽邊才會各自往下扇開，
  // 不會全部擠進同一條垂直走廊穿過方框。
  overview.addNode({ id: ENTRY_NODE_ID, kind: "entry", label: ENTRY_LABEL }, 0, 0);
  overview.addNode({ id: GLOBAL_NAV_NODE_ID, kind: "globalNav", label: GLOBAL_NAV_LABEL }, 1, 0);
  sections.forEach((section, index) => {
    overview.addNode(
      {
        id: sectionIds.get(section)!,
        kind: "section",
        label: `${section.name}（${section.pages.length} 頁）`,
        linkToPageId: sectionPageIds.get(section)!,
      },
      index,
      OVERVIEW_SECTION_ROW,
    );
  });
  overview.addEdge(ENTRY_NODE_ID, sectionIds.get(sectionOf.get(pageIdKey(workflow.pages[0]!))!)!);

  // ---- 邊的分類 ----
  const treeReady = new Map(sections.map((section) => [section, canFormTree(section)] as const));
  const relativePath = (id: PageId, section: Section) =>
    hierarchyPath(id).slice(section.depth + 1);
  const globalNavTargets = new Set<Section>();
  const crossSection: Array<{ from: Section; to: Section; label: string }> = [];
  /** 子→祖先的返回操作，降級成來源節點 tooltip 的一段。 */
  const returnLabels = new Map<string, string[]>();
  /** 有兄弟互跳的父節點；只有這些父節點的子頁才圈 tab 群組。 */
  const tabGroupParents = new Set<string>();
  // 分隔符不能省：["a","bc"] 與 ["ab","c"] 直接串接會撞成同一個鍵。
  const parentKey = (section: Section, path: readonly string[]) =>
    [sectionIds.get(section)!, ...path].join(" ᛫ ");

  for (const page of workflow.pages) {
    const from = sectionOf.get(pageIdKey(page))!;
    for (const action of navigatingActions(page)) {
      const to = sectionOf.get(pageIdKey(action.destination))!;
      if (from === to) {
        const source = relativePath(page, from);
        const target = relativePath(action.destination, to);
        if (treeReady.get(from)) {
          // 子 → 祖先：返回／取消／關閉。樹上父節點就在左邊，不畫線。
          if (target.length < source.length && target.every((seg, i) => seg === source[i])) {
            const key = pageIdKey(page);
            returnLabels.set(key, [...(returnLabels.get(key) ?? []), action.label]);
            continue;
          }
          // 兄弟 ↔ 兄弟：同一組 tab 互跳，改用一個框圈起來。
          if (
            source.length === target.length &&
            source.slice(0, -1).join(" ᛫ ") === target.slice(0, -1).join(" ᛫ ")
          ) {
            tabGroupParents.add(parentKey(from, source.slice(0, -1)));
            continue;
          }
        }
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
    overview.addEdge(sectionIds.get(from)!, sectionIds.get(to)!, label, true);
  }

  // ---- 各 Section 分頁：麵包屑樹，父在左、子在右；列＝深度優先走訪順序 ----
  const warnings: string[] = [];
  const usedImpliedIds = new Set<string>();
  const depths = bfsDepths(workflow);
  const isolated = workflow.pages.filter((page) => !depths.has(pageIdKey(page)));
  const isolatedKeys = new Set(isolated.map(pageIdKey));

  const nodeOfPage = (page: WorkflowPage) => {
    const returns = returnLabels.get(pageIdKey(page)) ?? [];
    const segments = hierarchyPath(page);
    const title = `${isolatedKeys.has(pageIdKey(page)) ? ISOLATED_MARK : ""}${segments[segments.length - 1] ?? page.route}`;
    const sections_ = [
      stayingTooltip(page),
      returns.length > 0
        ? [RETURN_TOOLTIP_HEADER, ...returns.map((label) => `• ${label}`)].join("\n")
        : undefined,
    ].filter((part): part is string => part !== undefined);
    return {
      id: pageIds.get(pageIdKey(page))!,
      kind: "page" as const,
      title,
      label: page.purpose,
      tooltip: sections_.length > 0 ? sections_.join("\n") : undefined,
    };
  };

  for (const section of sections) {
    const builder = builders.get(section)!;

    if (!canFormTree(section)) {
      // 退路：欄＝從入口 BFS 的層級、列＝該層內的原順序（多分頁之前的作法）
      warnings.push(fallbackLayoutWarning(section.name));
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
          nodeOfPage(page),
          cell ? cell.column : 0,
          cell ? cell.row : isolatedFirstRow + sectionIsolated.indexOf(page),
        );
      }
      continue;
    }

    let row = 0;
    let groupSeq = 0;
    const visit = (node: TreeNode, path: readonly string[], column: number): string => {
      const current = row++;
      const id = node.page
        ? pageIds.get(pageIdKey(node.page))!
        : uniqueId(`${IMPLIED_ID_PREFIX}${toIdSlug(node.segment)}`, usedImpliedIds);
      if (node.page) builder.addNode(nodeOfPage(node.page), column, current);
      else builder.addNode({ id, kind: "implied", label: node.segment }, column, current);

      const childIds = node.children.map((child) =>
        visit(child, [...path, child.segment], column + 1),
      );
      // 這組兄弟之間真的有互跳才圈框；平行子頁不該被誤標成可切換。
      if (tabGroupParents.has(parentKey(section, path))) {
        builder.addGroup(
          `${sectionIds.get(section)!}_TabGroup_${++groupSeq}`,
          TAB_GROUP_LABEL,
          childIds,
        );
      }
      return id;
    };
    visit(buildTree(section), [], 0);
  }

  if (isolated.length > 0) warnings.push(isolatedPagesWarning(isolated));

  return {
    name: workflow.project,
    pages: [overview.toPage(), ...sections.map((section) => builders.get(section)!.toPage())],
    warnings,
  };
}
