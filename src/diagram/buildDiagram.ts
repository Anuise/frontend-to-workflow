import {
  type ExcludedPage,
  type Mainflow,
  type MainflowFlow,
  type MainflowOutcome,
  coveredPages,
} from "../contracts/mainflow";
import { type PageId, pageIdKey } from "../contracts/page";
import type { Workflow, WorkflowAction, WorkflowPage } from "../contracts/workflow";

/** Main flow diagram 上的圖元種類：主線標題、標題下的細橫線、業務步驟、業務決策點。 */
export type DiagramNodeKind = "flowTitle" | "rule" | "step" | "decision";

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

/** 步驟之間的邊；label 是條件措辭（≤8 字），決策點進來的那條無 label。 */
export interface DiagramEdge {
  id: string;
  label: string;
  sourceId: string;
  targetId: string;
  /**
   * 跳步與迴圈邊要走的轉折點（主線下方的繞路帶）。
   * 不給就交給 draw.io 自己算——它會走最短路徑，也就是直接穿過中間那幾個步驟框。
   */
  waypoints?: Array<{ x: number; y: number }>;
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
/** 決策菱形：夾在該步右緣與下一步左緣之間（240 + 20 + 60 + 20 = 340），垂直置中對齊步驟框。 */
const DECISION_SIZE = 60;
const DECISION_GAP = 20;
/** 分歧步要多讓一段橫向空間，否則菱形出去的條件 label 會疊在下一步的框上。 */
const BRANCH_EXTRA = 160;
/** 每一條「不是走去下一步」的出口（跳步或迴圈）在主線下方各佔一條繞路帶。 */
const DETOUR_LANE = 60;
/** 第一條繞路帶離步驟框底部的距離。 */
const DETOUR_GAP = 60;
/** 總覽頁上下相鄰兩條主線之間的留白。 */
const LANE_GAP = 80;

/** 把 Page 識別轉成可讀標籤（含 tab）。 */
function pageLabel(id: PageId): string {
  return id.tab ? `${id.route}（${id.tab}）` : id.route;
}

/** 落選頁提醒：圖上不畫，但要讓使用者一眼看出 AI 砍了什麼、要不要救回來。 */
export function excludedPagesWarning(excluded: readonly ExcludedPage[]): string {
  const listed = excluded.map((page) => `${pageLabel(page)}（${page.reason}）`).join("、");
  return `以下 ${excluded.length} 頁不屬任何主線，圖上不畫：${listed}。要救回來就把它移進 mainflow.json 的某一步；完整操作清單見 f2w-export 產出的 workflow-<時戳>.xlsx。`;
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

/**
 * 每條出口都要有事實憑據：evidence 指的 (page, label) 必須逐字命中 workflow.json 的某個操作，
 * 而且那一頁必須是來源步自己收攏的頁——不能拿別步的畫面替這一步作證。
 * 該操作若真的會換頁（destination 非 null），去向還必須落在目標步收攏的頁裡。
 *
 * 同一步之內憑據還要彼此相異：同一顆按鈕不可能同時是「核准」又是「退件」，
 * 共用憑據代表分歧是掰出來的。跨步共用同一個 label 則合法——不同步本來就會操作同一個畫面。
 *
 * 圖是業務措辭、但每條邊都有 workflow.json 事實支撐；接不上就要求改分步或改 target，不畫虛線。
 */
function requireEvidencedOutcomes(workflow: Workflow, mainflow: Mainflow): void {
  const byKey = new Map(workflow.pages.map((page) => [pageIdKey(page), page] as const));
  for (const flow of mainflow.flows) {
    flow.steps.forEach((step, index) => {
      const where = `主線「${flow.name}」第 ${index + 1} 步「${step.title}」`;
      const ownPages = new Set(step.pages.map(pageIdKey));
      /** 本步已被引用過的憑據（route + tab + label），用來擋同一步之內的重複引用。 */
      const usedEvidence = new Set<string>();
      for (const outcome of step.outcomes) {
        const evidenceKey = pageIdKey(outcome.evidence);
        if (!ownPages.has(evidenceKey)) {
          throw new DiagramConsistencyError(
            `${where}的出口「${outcome.condition}」拿 ${pageLabel(outcome.evidence)} 當憑據，但那一頁不屬於這一步：憑據只能取自本步收攏的頁。`,
          );
        }
        const action = byKey
          .get(evidenceKey)!
          .actions.find((candidate) => candidate.label === outcome.evidence.label);
        if (action === undefined) {
          throw new DiagramConsistencyError(
            `${where}的出口「${outcome.condition}」在 ${pageLabel(outcome.evidence)} 上找不到操作「${outcome.evidence.label}」：憑據必須逐字命中 workflow.json 的 actions[]。`,
          );
        }
        const target = flow.steps[outcome.target - 1]!;
        const destination = action.destination;
        if (
          destination !== null &&
          !target.pages.some((id) => pageIdKey(id) === pageIdKey(destination))
        ) {
          throw new DiagramConsistencyError(
            `${where}的出口「${outcome.condition}」的操作會前往 ${pageLabel(destination)}，但第 ${outcome.target} 步「${target.title}」不含那一頁：請改 target 或重新分步。`,
          );
        }
        const usageKey = JSON.stringify([evidenceKey, outcome.evidence.label]);
        if (usedEvidence.has(usageKey)) {
          throw new DiagramConsistencyError(
            `${where}的出口「${outcome.condition}」重複引用 ${pageLabel(outcome.evidence)} 的操作「${outcome.evidence.label}」：同一步之內，兩個出口不得拿同一個操作當憑據。`,
          );
        }
        usedEvidence.add(usageKey);
      }
    });
  }
}

/** 收攏的頁進 tooltip：圖面乾淨，但從圖回溯得到 Page。 */
function coveredTooltip(pages: readonly PageId[]): string {
  return [COVERED_TOOLTIP_HEADER, ...pages.map((page) => `• ${pageLabel(page)}`)].join("\n");
}

/**
 * 這條出口是不是「不是走去下一步」——跳步或迴圈，要壓進主線下方的繞路帶。
 * 預留高度（detourCount）與實際轉折點（buildFlowLane）共用這一個判準：
 * 兩邊各寫一份的話，只改一邊就會讓讓出的高度與真正的轉折點靜默錯位。
 */
function isDetour(outcome: MainflowOutcome, stepIndex: number): boolean {
  return outcome.target !== stepIndex + 2;
}

/** 這條主線有幾條「不是走去下一步」的出口——跳步與迴圈，每一條在主線下方各佔一條繞路帶。 */
function detourCount(flow: MainflowFlow): number {
  return flow.steps.reduce(
    (total, step, index) => total + step.outcomes.filter((o) => isDetour(o, index)).length,
    0,
  );
}

/**
 * 一條主線佔的縱向高度：標題與單列橫排的步驟，再加上繞路邊要走的下方空間。
 * 帶了分歧之後主線高度不再一致，所以這是算出來的，不是常數。
 */
function laneHeight(flow: MainflowFlow): number {
  const detours = detourCount(flow);
  return STEP_Y + STEP_HEIGHT + (detours > 0 ? DETOUR_GAP + detours * DETOUR_LANE : 0);
}

/**
 * 一條主線的一列：標題 ＋ 細橫線 ＋ 單列橫排的步驟，出口邊照 outcomes 拉。
 * 一步有 ≥2 個出口就是業務決策點，右邊長出一個菱形（不佔步號、不寫進 mainflow.json），
 * 條件 label 掛在菱形出去的每一條邊上；單出口直接從步驟框拉一條帶 label 的邊。
 * 主線自己那頁用 yOffset 0，總覽頁按主線順序往下堆；idPrefix 讓同一條主線在兩頁各有一組 id。
 */
function buildFlowLane(
  flow: MainflowFlow,
  flowIndex: number,
  idPrefix: string,
  yOffset: number,
): Pick<DiagramPage, "nodes" | "edges"> {
  // 步驟橫向座標逐步累加：分歧步多讓一段，好讓菱形出去的條件 label 有地方放。
  const stepXs: number[] = [];
  let cursorX = ORIGIN_X;
  for (const step of flow.steps) {
    stepXs.push(cursorX);
    cursorX += COLUMN_SPACING + (step.outcomes.length >= 2 ? BRANCH_EXTRA : 0);
  }
  const lastStepBranches = (flow.steps.at(-1)?.outcomes.length ?? 0) >= 2;
  const rowWidth =
    stepXs.at(-1)! -
    ORIGIN_X +
    STEP_WIDTH +
    (lastStepBranches ? DECISION_GAP + DECISION_SIZE : 0);
  /** 繞路邊由上往下依序佔用下方的帶，一條一帶，避免兩條疊在同一條線上。 */
  let detourLane = 0;
  const stepId = (index: number) => `${idPrefix}Step_${flowIndex + 1}_${index + 1}`;
  const decisionId = (index: number) => `${idPrefix}Decision_${flowIndex + 1}_${index + 1}`;
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
    const stepX = stepXs[index]!;
    nodes.push({
      id: stepId(index),
      kind: "step",
      title: `${index + 1}. ${step.title}`,
      label: step.note,
      tooltip: coveredTooltip(step.pages),
      colorIndex: flowIndex,
      x: stepX,
      y: yOffset + STEP_Y,
      width: STEP_WIDTH,
      height: STEP_HEIGHT,
    });

    const branching = step.outcomes.length >= 2;
    if (branching) {
      nodes.push({
        id: decisionId(index),
        kind: "decision",
        label: "",
        colorIndex: flowIndex,
        x: stepX + STEP_WIDTH + DECISION_GAP,
        y: yOffset + STEP_Y + (STEP_HEIGHT - DECISION_SIZE) / 2,
        width: DECISION_SIZE,
        height: DECISION_SIZE,
      });
      edges.push({
        id: `${idPrefix}Edge_${flowIndex + 1}_${index + 1}_0`,
        label: "",
        sourceId: stepId(index),
        targetId: decisionId(index),
      });
    }

    step.outcomes.forEach((outcome, outcomeIndex) => {
      const edge: DiagramEdge = {
        id: `${idPrefix}Edge_${flowIndex + 1}_${index + 1}_${outcomeIndex + 1}`,
        label: outcome.condition,
        sourceId: branching ? decisionId(index) : stepId(index),
        targetId: stepId(outcome.target - 1),
      };
      // 走去下一步的邊是主鏈，讓 draw.io 直接連；跳步與迴圈得壓進下方繞路帶，
      // 否則它會走最短路徑直接橫穿中間那幾個步驟框，label 也會疊在框上。
      if (isDetour(outcome, index)) {
        const detourY = yOffset + STEP_Y + STEP_HEIGHT + DETOUR_GAP + detourLane * DETOUR_LANE;
        detourLane += 1;
        const fromX = branching
          ? stepX + STEP_WIDTH + DECISION_GAP + DECISION_SIZE / 2
          : stepX + STEP_WIDTH / 2;
        edge.waypoints = [
          { x: fromX, y: detourY },
          { x: stepXs[outcome.target - 1]! + STEP_WIDTH / 2, y: detourY },
        ];
      }
      edges.push(edge);
    });
  });

  return { nodes, edges };
}

/** 一條主線一個分頁，分頁名照抄主線名。 */
function buildFlowPage(flow: MainflowFlow, flowIndex: number): DiagramPage {
  return {
    id: `Diagram_${flowIndex + 1}`,
    name: flow.name,
    ...buildFlowLane(flow, flowIndex, "", 0),
  };
}

/**
 * 最後一頁：把每條主線那一列**照 flows 順序由上到下**排在同一頁，一頁看完整個平台。
 * 縱向位置是逐條累計出來的——主線帶分歧之後高度不再一致，固定間距乘序號會讓長主線壓到下一條。
 */
function buildOverviewPage(flows: readonly MainflowFlow[]): DiagramPage {
  let y = 0;
  const rows = flows.map((flow, index) => {
    const row = buildFlowLane(flow, index, "Overview_", y);
    y += laneHeight(flow) + LANE_GAP;
    return row;
  });
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
  requireEvidencedOutcomes(workflow, mainflow);

  return {
    name: workflow.project,
    pages: [...mainflow.flows.map(buildFlowPage), buildOverviewPage(mainflow.flows)],
    warnings:
      mainflow.excludedPages.length > 0 ? [excludedPagesWarning(mainflow.excludedPages)] : [],
  };
}
