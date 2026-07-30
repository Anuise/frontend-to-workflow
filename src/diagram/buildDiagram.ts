import {
  type ExcludedPage,
  type Mainflow,
  type MainflowFlow,
  type MainflowStep,
  coveredPages,
} from "../contracts/mainflow";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";

/** Main flow diagram 上的圖元種類：主線標題、標題下的細橫線、業務步驟。 */
export type DiagramNodeKind = "flowTitle" | "rule" | "step";

/** 單一圖元：語意（id／種類／標題／小字／提示）＋色系＋座標與尺寸。 */
export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  /** step 的粗體標題：編號 ＋ 業務動作名。 */
  title?: string;
  /** step 的小字業務說明；flowTitle 的主線名；rule 沒有文字。 */
  label: string;
  /** 這一步收攏了哪些 Page；畫成 draw.io 的 tooltip，不佔版面。 */
  tooltip?: string;
  /** 屬於第幾條主線，決定色系。掛在圖元而不是分頁——總覽頁一頁就有全部主線的色。 */
  colorIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 步驟之間的推進邊；label 是業務轉場動作（≤8 字）。 */
export interface DiagramEdge {
  id: string;
  label: string;
  sourceId: string;
  targetId: string;
}

/** draw.io 的一個分頁：每條主線各一頁，最後再一頁把全部主線由上到下排在一起的總覽。 */
export interface DiagramPage {
  id: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** 組好的 Main flow diagram：一條主線一頁＋最後一頁總覽，以及要回報給使用者（不是業主）的提醒。 */
export interface MainFlowDiagram {
  name: string;
  pages: DiagramPage[];
  /** 落選頁等情形；由 f2w-diagram 原文轉述給使用者。 */
  warnings: string[];
}

/** workflow.json 與 mainflow.json 對不上時丟出：斷掉的去向、project 不一致、漏掉的頁、接不上的相鄰步。 */
export class DiagramConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagramConsistencyError";
  }
}

/** tooltip 裡「這一步收攏了哪些頁」那一段的抬頭。 */
export const COVERED_TOOLTIP_HEADER = "此步驟涵蓋的頁面：";

/** 最後一頁的分頁名：全部主線由上到下排在一起，一頁看完整個平台。 */
export const OVERVIEW_PAGE_NAME = "總覽";

// 版面（像素）。一條主線＝單列橫排、不折行；240×100 才放得下「粗體標題＋小字說明」兩段。
const STEP_WIDTH = 240;
const STEP_HEIGHT = 100;
const COLUMN_SPACING = 340;
const ORIGIN_X = 60;
const TITLE_Y = 40;
const TITLE_HEIGHT = 40;
const RULE_HEIGHT = 2;
const RULE_Y = TITLE_Y + TITLE_HEIGHT + 12;
const STEP_Y = RULE_Y + RULE_HEIGHT + 36;
/** 總覽頁上下相鄰兩條主線的縱向間距：一條主線的內容高 ＋ 主線之間的留白。 */
const ROW_SPACING = STEP_Y + STEP_HEIGHT + 80;

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/** 落選頁提醒：圖上不畫，但要讓使用者一眼看出 AI 砍了什麼、要不要救回來。 */
export function excludedPagesWarning(excluded: readonly ExcludedPage[]): string {
  const listed = excluded.map((page) => `${pageLabel(page)}（${page.reason}）`).join("、");
  return `以下 ${excluded.length} 頁不屬任何主線，圖上不畫：${listed}。要救回來就把它移進 mainflow.json 的某一步；完整操作清單見 workflow.xlsx。`;
}

/** 該頁的換頁操作（destination 非 null）；不換頁的操作不成邊。 */
function navigatingActions(page: WorkflowPage): Array<WorkflowAction & { destination: PageId }> {
  return page.actions.filter(
    (action): action is WorkflowAction & { destination: PageId } => action.destination !== null,
  );
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

/** 兩份檔要講同一個 project，否則是把別的專案的主線接上來了。 */
function requireSameProject(workflow: Workflow, mainflow: Mainflow): void {
  if (workflow.project !== mainflow.project) {
    throw new DiagramConsistencyError(
      `mainflow.json 的 project「${mainflow.project}」與 workflow.json 的「${workflow.project}」不同`,
    );
  }
}

/**
 * 涵蓋完整性：主線收攏的頁 ∪ 落選頁必須剛好等於 workflow.json 的頁集合。
 * 這條硬驗讓推論必須為每一頁表態——圖上少了什麼永遠查得到。
 */
function requireExactCoverage(workflow: Workflow, mainflow: Mainflow): void {
  const known = new Set(workflow.pages.map(pageIdKey));
  const covered = coveredPages(mainflow);

  const unknown = covered.filter((page) => !known.has(pageIdKey(page)));
  if (unknown.length > 0) {
    throw new DiagramConsistencyError(
      `mainflow.json 提到 workflow.json 裡不存在的 Page：${unknown.map(pageLabel).join("、")}`,
    );
  }

  const coveredKeys = new Set(covered.map(pageIdKey));
  const missing = workflow.pages.filter((page) => !coveredKeys.has(pageIdKey(page)));
  if (missing.length > 0) {
    throw new DiagramConsistencyError(
      `以下 Page 既不在任何主線步驟裡、也不在 excludedPages：${missing.map(pageLabel).join("、")}。每一頁都要表態。`,
    );
  }
}

/** 這一步收攏的頁能走到的所有 Page。 */
function reachableFrom(step: MainflowStep, byKey: Map<string, WorkflowPage>): Set<string> {
  const keys = new Set<string>();
  for (const id of step.pages) {
    for (const action of navigatingActions(byKey.get(pageIdKey(id))!)) {
      keys.add(pageIdKey(action.destination));
    }
  }
  return keys;
}

/**
 * 相鄰兩步之間必須有真實的操作去向墊背（來源步任一頁 → 目標步任一頁）。
 * 圖是業務措辭、但每條邊都有 workflow.json 事實支撐；接不上就要求改順序或改分步，不畫虛線。
 */
function requireRealEdges(workflow: Workflow, mainflow: Mainflow): void {
  const byKey = new Map(workflow.pages.map((page) => [pageIdKey(page), page] as const));
  for (const flow of mainflow.flows) {
    for (const [index, step] of flow.steps.slice(0, -1).entries()) {
      const next = flow.steps[index + 1]!;
      const reachable = reachableFrom(step, byKey);
      if (!next.pages.some((id) => reachable.has(pageIdKey(id)))) {
        throw new DiagramConsistencyError(
          `主線「${flow.name}」第 ${index + 1} 步「${step.title}」到第 ${index + 2} 步「${next.title}」在 workflow.json 裡沒有任何操作去向可走：請調整步驟順序或重新分步。`,
        );
      }
    }
  }
}

/** 收攏的頁進 tooltip：圖面乾淨，但從圖回溯得到 Page。 */
function coveredTooltip(pages: readonly PageId[]): string {
  return [COVERED_TOOLTIP_HEADER, ...pages.map((page) => `• ${pageLabel(page)}`)].join("\n");
}

/**
 * 一條主線的一列：標題 ＋ 細橫線 ＋ 單列橫排的步驟與推進邊。
 * 主線自己那頁用 yOffset 0，總覽頁按主線順序往下堆；idPrefix 讓同一條主線在兩頁各有一組 id。
 */
function buildFlowRow(
  flow: MainflowFlow,
  flowIndex: number,
  idPrefix: string,
  yOffset: number,
): Pick<DiagramPage, "nodes" | "edges"> {
  const rowWidth = (flow.steps.length - 1) * COLUMN_SPACING + STEP_WIDTH;
  const stepId = (index: number) => `${idPrefix}Step_${flowIndex + 1}_${index + 1}`;
  const nodes: DiagramNode[] = [
    {
      id: `${idPrefix}Title_${flowIndex + 1}`,
      kind: "flowTitle",
      label: flow.name,
      colorIndex: flowIndex,
      x: ORIGIN_X,
      y: yOffset + TITLE_Y,
      width: rowWidth,
      height: TITLE_HEIGHT,
    },
    {
      id: `${idPrefix}Rule_${flowIndex + 1}`,
      kind: "rule",
      label: "",
      colorIndex: flowIndex,
      x: ORIGIN_X,
      y: yOffset + RULE_Y,
      width: rowWidth,
      height: RULE_HEIGHT,
    },
  ];
  const edges: DiagramEdge[] = [];

  flow.steps.forEach((step, index) => {
    nodes.push({
      id: stepId(index),
      kind: "step",
      title: `${index + 1}. ${step.title}`,
      label: step.note,
      tooltip: coveredTooltip(step.pages),
      colorIndex: flowIndex,
      x: ORIGIN_X + index * COLUMN_SPACING,
      y: yOffset + STEP_Y,
      width: STEP_WIDTH,
      height: STEP_HEIGHT,
    });
    if (step.edgeLabel !== undefined) {
      edges.push({
        id: `${idPrefix}Edge_${flowIndex + 1}_${index + 1}`,
        label: step.edgeLabel,
        sourceId: stepId(index),
        targetId: stepId(index + 1),
      });
    }
  });

  return { nodes, edges };
}

/** 一條主線一個分頁，分頁名照抄主線名。 */
function buildFlowPage(flow: MainflowFlow, flowIndex: number): DiagramPage {
  return {
    id: `Diagram_${flowIndex + 1}`,
    name: flow.name,
    ...buildFlowRow(flow, flowIndex, "", 0),
  };
}

/** 最後一頁：把每條主線那一列**照 flows 順序由上到下**排在同一頁，一頁看完整個平台。 */
function buildOverviewPage(flows: readonly MainflowFlow[]): DiagramPage {
  const rows = flows.map((flow, index) =>
    buildFlowRow(flow, index, "Overview_", index * ROW_SPACING),
  );
  return {
    id: "Diagram_Overview",
    name: OVERVIEW_PAGE_NAME,
    nodes: rows.flatMap((row) => row.nodes),
    edges: rows.flatMap((row) => row.edges),
  };
}

/**
 * 由 Workflow description ＋ Main flow 組出 Main flow diagram（確定性核心，不碰 fs）。
 *
 * 一條主線一個分頁，最後再一頁「總覽」把全部主線由上到下排在一起（主線只有一條時仍照出——
 * 分頁位置固定好過視情況消失）；一步可收攏多個 Page（收攏的頁只進 tooltip）。
 * 推論在上游的 mainflow.json，這裡只做版面與四道一致性硬驗。
 */
export function buildDiagram(workflow: Workflow, mainflow: Mainflow): MainFlowDiagram {
  requireKnownDestinations(workflow);
  requireSameProject(workflow, mainflow);
  requireExactCoverage(workflow, mainflow);
  requireRealEdges(workflow, mainflow);

  return {
    name: workflow.project,
    pages: [...mainflow.flows.map(buildFlowPage), buildOverviewPage(mainflow.flows)],
    warnings:
      mainflow.excludedPages.length > 0 ? [excludedPagesWarning(mainflow.excludedPages)] : [],
  };
}
